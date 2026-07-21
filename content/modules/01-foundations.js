/* Module 1 — Cloud Architecture Foundations (SAA track) */
window.COURSE.register({
  id: "foundations",
  order: 1,
  track: "saa",
  title: "Cloud Architecture Foundations",
  description: "The physical and logical substrate everything else sits on: regions, AZs, partitions, ARNs, control vs data planes, the Well-Architected pillars, the shared responsibility model — plus how the SAA-C03 exam itself is built and how to beat it.",
  examWeight: "Not a named exam domain, but this vocabulary underlies every question. AZ semantics, static stability, and shared responsibility each show up directly in several questions per exam.",
  lessons: [
    {
      id: "global-infrastructure",
      title: "Regions, AZs, and the physical reality underneath",
      html: `
<p>Start with the mental model: AWS is not one cloud, it is a federation of mostly independent regional deployments stitched together by a private global backbone and a thin set of truly global services. Almost every service you touch is <strong>regional</strong> — its API endpoints, its data, its failure domain all live inside one region. The exceptions (IAM, Route 53's control plane, CloudFront's configuration, parts of S3's namespace) are global, and each of those is a special case you should treat with suspicion in a resilience design precisely because it is shared world-state.</p>

<h3>What an AZ physically is</h3>
<p>An Availability Zone is not "a datacenter." It is <strong>one or more discrete datacenters</strong> — some AZs are campuses of several buildings — with independent, redundant power (separate utility feeds, separate generators, separate UPS), independent cooling, and independent physical security, connected to the other AZs in the region by high-bandwidth, low-latency private fiber. AWS engineers the separation deliberately: AZs sit in different flood plains, on different power grids where possible, and are typically several kilometers to roughly 100 km apart — far enough that a fire, flood, or grid failure is unlikely to hit two at once, close enough that synchronous replication is practical. Inter-AZ round-trip latency is single-digit milliseconds, usually under 2 ms. That number is the whole reason multi-AZ synchronous replication (RDS Multi-AZ, EBS-backed quorum systems, Aurora's storage layer) works: you can afford to wait for the other AZ's ack on every write.</p>

<div class="callout deep">The AZ letters in your console (us-east-1a, us-east-1b) are <strong>randomized per account</strong> to spread load — your us-east-1a is probably not another account's us-east-1a. The stable identifier is the <strong>AZ ID</strong> (use1-az1, use1-az2). When you coordinate placement across accounts — shared VPC subnets, cross-account latency-sensitive traffic, capacity reservations — you must compare AZ IDs, not letters. The lab in this module makes you prove it with the CLI.</div>

<h3>Regions</h3>
<p>A region is a cluster of (at minimum three, in newer regions) AZs plus a full, independent copy of the AWS service stack: its own EC2 control plane, its own S3, its own endpoint DNS. Regions are isolated on purpose — there is no synchronous anything between regions, and the design goal is that a region-wide failure in one region cannot cascade into another. Cross-region replication (S3 CRR, Aurora Global Database, DynamoDB global tables) is always <strong>asynchronous</strong>, which means cross-region DR always has an RPO greater than zero unless the application itself writes to two regions. Newer regions are <strong>opt-in</strong> (they do not appear in your account until enabled), which matters for security tooling: an SCP or config rule that enumerates regions can silently miss a newly opted-in one.</p>

<h3>Local Zones, Wavelength, Outposts, edge</h3>
<ul>
<li><strong>Local Zones</strong>: single-zone extensions of a parent region placed in metro areas (Los Angeles, Chicago, Lagos...) for single-digit-millisecond latency to end users. They run a subset of services (EC2, EBS, some ELB), and their subnets live inside your regional VPC. Think of one as a remote AZ with fewer services and no independent survival story — it depends on its parent region's control plane.</li>
<li><strong>Wavelength Zones</strong>: the same idea embedded inside 5G carrier networks, so mobile traffic reaches your compute without leaving the carrier.</li>
<li><strong>Outposts</strong>: an AWS-owned rack in your own datacenter, presenting a slice of a region locally. For "must stay on premises for latency or data residency but wants AWS APIs" scenarios.</li>
<li><strong>Edge locations</strong>: 400+ points of presence running CloudFront, Route 53 resolvers, and Global Accelerator ingress. They are not AZs; you cannot run EC2 there. Lambda@Edge and CloudFront Functions are the only compute at the edge, and they are severely constrained by design.</li>
</ul>

<h3>Partitions</h3>
<p>Above regions sits the least-known layer: <strong>partitions</strong>. There are three: <code>aws</code> (commercial), <code>aws-cn</code> (China, operated by local partners), and <code>aws-us-gov</code> (GovCloud). Partitions are hard boundaries — separate IAM, separate ARN namespaces, no cross-partition role assumption, no cross-partition VPC peering. If you write tooling that hardcodes <code>arn:aws:</code>, it breaks in GovCloud (<code>arn:aws-us-gov:</code>). Cross-partition data movement is an application-level exercise: you copy data out and in with two sets of credentials.</p>

<div class="callout exam">Keyword mappings: "lowest latency to users in a specific metro" with EC2 involved means Local Zones; "5G mobile devices" means Wavelength; "must remain in our datacenter" means Outposts; "static content to global users" means CloudFront edge locations. "Survive the loss of a datacenter" means multi-AZ; "survive the loss of a region" or "regulatory geographic separation" means multi-region. The exam never requires multi-region for plain availability — multi-AZ is the default answer unless the question explicitly says region-level failure or geography.</div>

<div class="callout war">us-east-1 is special in bad ways: it is the oldest and largest region, it hosts the control planes for several global services (IAM's write path, CloudFront distributions, ACM certs for CloudFront, Route 53's API), and historically it has had the most visible incidents. During a us-east-1 control-plane event you may be unable to update Route 53 records or IAM policies globally even though your workloads in eu-west-1 are healthy. Design recovery paths that do not require those global write APIs — that is the static-stability lesson two lessons from now.</div>

<div class="callout limits">Numbers worth knowing: 30+ regions, 95+ AZs, 400+ edge locations (these grow; the ratios matter more than exact counts). Every AZ connects to every other AZ in-region with metro fiber at sub-2 ms RTT. Inter-AZ data transfer bills at 0.01 USD per GB each direction in most regions — free within an AZ using private IPs. That penny per GB is why cross-zone load balancing and chatty multi-AZ microservices show up on cost-optimization questions.</div>
`
    },
    {
      id: "arns-accounts",
      title: "Accounts as blast-radius boundaries, and ARN anatomy",
      html: `
<p>The AWS account is the strongest isolation boundary the platform offers — stronger than VPCs, stronger than IAM policies within an account. Every resource belongs to exactly one account; every bill, every service quota, every IAM principal namespace, and by default every permission stops at the account edge. Nothing crosses an account boundary unless <em>both</em> sides explicitly allow it. That property is why modern AWS architecture is multi-account by default: accounts are cheap, and they turn "a bug or a compromised credential" from a company-wide event into a contained one.</p>

<h3>Why seniors run many accounts</h3>
<ul>
<li><strong>Blast radius</strong>: a leaked admin key in the dev account cannot touch prod. A runaway script that deletes "all buckets" deletes one account's buckets.</li>
<li><strong>Quota isolation</strong>: service quotas (EC2 vCPUs, Lambda concurrency, API rate limits) are per account per region. A load test in one account cannot throttle another team's prod API calls.</li>
<li><strong>Billing attribution</strong>: cost allocation by account is exact; cost allocation by tag is only as good as your tagging discipline.</li>
<li><strong>Guardrails</strong>: Service Control Policies (module 2) attach to accounts and organizational units, so account structure <em>is</em> your policy structure.</li>
</ul>
<p>The standard shape is an AWS Organization with a management account that owns billing and nothing else, plus member accounts per environment and per workload, grouped into OUs (Security, Infrastructure, Workloads/Prod, Workloads/Dev, Sandbox). Log archive and security tooling get dedicated accounts so that even prod admins cannot tamper with audit trails.</p>

<h3>ARN anatomy</h3>
<p>Every resource has an Amazon Resource Name. Learn to read them cold — policies, error messages, and exam answers all hinge on the fields:</p>
<pre><code>arn:partition:service:region:account-id:resource
arn:aws:s3:::my-bucket                                 (S3: no region, no account)
arn:aws:s3:::my-bucket/some/key.txt                    (object = bucket ARN + /key)
arn:aws:iam::123456789012:role/DeployRole              (IAM: no region — global)
arn:aws:ec2:eu-west-1:123456789012:instance/i-0abc123
arn:aws:lambda:us-east-1:123456789012:function:api-fn
arn:aws:dynamodb:us-east-1:123456789012:table/orders</code></pre>
<p>Observations that matter:</p>
<ul>
<li>The <strong>partition</strong> field is why cross-partition tooling breaks; write <code>arn:aws-us-gov:</code> in GovCloud.</li>
<li><strong>Empty fields are meaningful.</strong> S3 ARNs omit both region and account because bucket names are globally unique within a partition — the name alone identifies the bucket. IAM ARNs omit region because IAM is a global service.</li>
<li>The resource part varies per service: <code>type/id</code>, <code>type:id</code>, or bare name. When writing policies, this is where wildcards go — <code>arn:aws:s3:::my-bucket/*</code> matches every object but <em>not</em> the bucket itself, which is why S3 policies routinely need two resource lines (bucket ARN for ListBucket, bucket/* for GetObject). That distinction is a recurring exam trap and a recurring production incident.</li>
</ul>

<div class="callout deep">Account IDs are 12-digit identifiers with no internal structure, and they are not secrets — they appear in ARNs you share, in S3 access logs, in error messages. Treat them as public identifiers (do not panic-redact them), but also never treat knowledge of an account ID as any kind of authentication. Authorization in AWS is always policy-based, never possession-of-identifier-based; the confused-deputy discussion in module 2 builds on exactly this point.</div>

<h3>Endpoints and the request path</h3>
<p>Every regional service exposes DNS endpoints like <code>ec2.eu-west-1.amazonaws.com</code>. Your CLI or SDK signs requests with SigV4 — an HMAC over the canonical request using your secret key, scoped to (date, region, service). Two practical consequences: a request signed for one region cannot be replayed against another, and clock skew beyond 5 minutes breaks signing (the classic "signature expired" error on a VM with a drifted clock). Global services mostly sign as us-east-1 — another reason that region is load-bearing.</p>

<div class="callout exam">The exam tests accounts obliquely: "separate teams need isolated environments with consolidated billing" means AWS Organizations with multiple accounts, not one account with IAM boundaries. "Prevent any user in the account, including root, from disabling CloudTrail" means an SCP from the org — no in-account IAM policy can bind root. "Limit blast radius" is nearly always answered by more accounts, not more policies.</div>

<div class="callout war">The management (payer) account is a standing hazard: SCPs do not apply to it, and it can see every member account's bill. Keep zero workloads in it, keep zero day-to-day human access to it, and protect its root credentials like the master keys they are — hardware MFA, no access keys, break-glass procedure documented. Most real-world org compromises that become catastrophic ran through an over-privileged management account.</div>

<div class="callout limits">Defaults worth memorizing: 10 accounts per Organization by default (raisable into the thousands), 5 levels of OU nesting below the root, and account IDs are 12 digits always. S3 bucket names are globally unique per partition — squatting on a name in another account can deny it to you forever, which is why generated names include the account ID.</div>
`
    },
    {
      id: "control-vs-data-plane",
      title: "Control plane vs data plane, and static stability",
      html: `
<p>This is the single most valuable mental model in the module, and AWS's own resilience documentation is built around it. Every service splits into a <strong>control plane</strong> — the APIs that create, modify, and delete resources — and a <strong>data plane</strong> — the machinery that does the actual continuous work. EC2's control plane is RunInstances, TerminateInstances, AttachVolume; its data plane is your already-running instances, the hypervisors, the network fabric. Route 53's control plane is ChangeResourceRecordSets; its data plane is the fleet of DNS servers answering queries. S3's control plane is CreateBucket and PutBucketPolicy; its data plane is GET and PUT of objects.</p>

<p>The asymmetry that matters: <strong>data planes are engineered to much higher availability than control planes.</strong> They are simpler, more replicated, more static, and deliberately decoupled so that a control-plane outage leaves them running on their last-known-good configuration. Historically, most major AWS incidents have been control-plane incidents: you could not launch new instances or update DNS records, but existing instances kept serving and existing records kept resolving. Route 53's data plane carries a 100% availability SLA; its control plane does not.</p>

<h3>Static stability</h3>
<p>A system is <strong>statically stable</strong> when it keeps operating correctly during a dependency failure <em>without needing to make any changes</em> — no API calls, no reconfiguration, no human action. The system's steady state already contains everything needed to survive the failure. Concretely:</p>
<ul>
<li><strong>Pre-provision AZ failover capacity.</strong> If you need 30 instances and run 10 per AZ across three AZs, losing an AZ leaves you at 66% capacity and betting that EC2's control plane will grant you 10 fresh instances during the exact event when everyone else in the region is asking for the same thing (and when the control plane itself may be impaired). The statically stable design runs 15 per AZ across three AZs — or 10 per AZ across four — so that losing one AZ still leaves full capacity <em>with zero API calls</em>. You pay for headroom; that is the price of the property.</li>
<li><strong>Keep control-plane calls out of the recovery path.</strong> A DR runbook that says "when the region fails, update the Route 53 record" depends on the Route 53 control plane at the worst possible moment. Route 53 health checks with failover routing move traffic using only the data plane — the checks and the answering servers keep working while the ChangeResourceRecordSets API is down. Similarly, Route 53 Application Recovery Controller keeps its routing-control data plane in five regions precisely so failover never depends on one region's control plane.</li>
<li><strong>Fail static on dependency loss.</strong> When a downstream config or discovery service goes dark, keep serving from the last-known-good state rather than crashing or blocking on refresh. A cache that serves stale beats an outage that serves nothing.</li>
</ul>

<div class="callout deep">Multi-AZ services you think of as magic are statically stable underneath. An NLB is not one box — it is nodes in every enabled AZ, each already routing; losing an AZ removes those nodes from DNS without any reconfiguration of the others. RDS Multi-AZ has already replicated every write synchronously to the standby before failover is ever needed; failover is a DNS flip plus promotion, not a rebuild. The pattern is always the same: do the expensive preparation continuously in steady state so the failure event requires nothing clever.</div>

<div class="callout war">Auto Scaling is a control-plane dependency hiding in plain sight. Teams run "lean and elastic" — minimum capacity sized for the happy path — and assume scaling will save them during an AZ event. During large incidents, launch APIs get throttled, capacity in surviving AZs gets contended, and the scale-out you counted on arrives late or not at all. Rule of thumb for tier-1 services: Auto Scaling is for absorbing demand growth, not for AZ failure recovery. Size minimums so N-1 AZs carry the load.</div>

<div class="callout exam">Trap pattern: any answer whose disaster-recovery step is "then call an API to reconfigure" is weaker than an answer where routing shifts automatically. "Route 53 failover routing with health checks" beats "a Lambda that updates the DNS record when an alarm fires." "Pre-provisioned capacity in each AZ" beats "Auto Scaling will replace the lost AZ's instances." When two answers both work, the one with fewer moving parts during the failure wins. The word "automatically" in the question stem is your cue.</div>

<div class="callout limits">Data-plane vs control-plane SLA gap, in one example: Route 53 data plane (query answering) is designed for 100% availability; the management APIs are not. EC2 instance launch (control plane) can be throttled per account per region — RunInstances has a request-rate budget and a vCPU quota — while already-running instances have no such throttle. Design so the thing with a quota is never in your emergency path.</div>

<p>Carry this lens through the whole course. For every managed service ask: what is its control plane, what is its data plane, what happens to my architecture when the control plane disappears for four hours? Services and designs that answer "nothing happens" are the ones you bet production on.</p>
`
    },
    {
      id: "well-architected",
      title: "The Well-Architected Framework: what the six pillars actually demand",
      html: `
<p>The Well-Architected Framework is easy to dismiss as consulting boilerplate. Read it instead as AWS's compressed incident history: each pillar exists because a category of expensive failure keeps recurring. The exam uses pillar vocabulary constantly, and more usefully, each pillar names a design pressure that legitimate architectures must trade off against the others. Here is each pillar as an architectural demand rather than a slogan.</p>

<h3>1. Operational Excellence</h3>
<p>Demand: <strong>everything about how the system runs is code, and change is small, frequent, and reversible.</strong> Infrastructure as code (CloudFormation, CDK, Terraform) not because it is fashionable but because unreproducible environments make recovery a guessing game. Runbooks executable as automation, not wiki pages. Telemetry designed before the incident: if you cannot answer "what changed in the last hour" from logs and deploy history, you do not have operational excellence. The pillar's sharpest question is about failure anticipation — game days, failure injection, and learning from every incident without blame.</p>

<h3>2. Security</h3>
<p>Demand: <strong>identity is the perimeter, and every layer assumes the layer outside it has failed.</strong> Least privilege enforced mechanically (SCPs, permission boundaries, short-lived credentials — module 2 is entirely this). Encryption everywhere because it is cheap: at rest via KMS, in transit via TLS, with key access controlled separately from data access so a storage-level compromise does not yield plaintext. Traceability: CloudTrail on in every account and region, logs shipped to an account the workload admins cannot touch. The senior insight: security controls that require humans to remember them are not controls; encode them as guardrails that make the wrong thing impossible or loud.</p>

<h3>3. Reliability</h3>
<p>Demand: <strong>define what the system must survive, then prove it, continuously.</strong> This pillar owns the vocabulary the exam leans on: RTO (how long recovery takes) and RPO (how much data loss is acceptable), and the DR spectrum from backup-and-restore through pilot light and warm standby to multi-region active-active. It demands you stop treating servers as pets (replace, never repair), respect and monitor service quotas before they become the outage, use multi-AZ as the default posture, and test recovery paths as routinely as you test features — an untested backup is a hypothesis. Static stability from the previous lesson lives here.</p>

<h3>4. Performance Efficiency</h3>
<p>Demand: <strong>match resource types to workload shape, and re-match as offerings evolve.</strong> Not "make it fast" — "stop paying for generality you do not use." Use managed and serverless services so undifferentiated heavy lifting is AWS's problem; pick purpose-built databases (DynamoDB for key-value at scale, ElastiCache for microsecond reads, OpenSearch for text) instead of defaulting everything onto one relational instance; push content to the edge; and benchmark with data, because instance families and storage tiers change yearly and last year's right answer decays.</p>

<h3>5. Cost Optimization</h3>
<p>Demand: <strong>make spend visible, attributable, and proportional to value.</strong> Mechanisms: tagging and cost allocation so every dollar has an owner; right-sizing from actual utilization data (Compute Optimizer), not from launch-day guesses; matching purchase model to workload shape — Savings Plans and Reserved Instances for steady baselines, Spot for interruptible batch, on-demand only for the genuinely unpredictable remainder; and lifecycle policies so storage cools automatically (S3 tiering, snapshot expiry). The pillar's trap is the same as performance's inverse: over-optimizing cost until you have traded away the reliability headroom that static stability requires. The pillars conflict on purpose; architecture is choosing the trade.</p>

<h3>6. Sustainability</h3>
<p>The newest pillar (2021). Demand: minimize resources consumed per unit of work — which in practice is 90% overlapping with cost optimization: higher utilization, right-sizing, serverless where idle time dominates, efficient data lifecycle, and choosing regions with greener grids when latency allows. On the exam it appears rarely and its answers align with cost answers.</p>

<div class="callout exam">The four scored SAA-C03 domains map almost one-to-one onto pillars two through five: Design Secure Architectures is the Security pillar, Design Resilient Architectures is Reliability, High-Performing is Performance Efficiency, Cost-Optimized is Cost Optimization. When a question asks for the "MOST operationally efficient" solution, it is invoking Operational Excellence and the answer is the one with the least custom code and fewest self-managed components — managed service beats DIY script beats fleet of cron jobs, essentially always.</div>

<div class="callout war">The framework's real-world failure mode is the annual "Well-Architected review" performed as theater: a spreadsheet filled in, risks acknowledged, nothing funded. The pillars only bite when their questions gate real decisions — a launch checklist that blocks going live without tested restores, alarms on quota consumption, and an owner for every cost line. Use the pillar questions as engineering review prompts, not compliance artifacts.</div>

<div class="callout deep">There is a seventh structure worth knowing: pillars decompose into design principles and then into specific questions (REL 9: "How do you back up data?"), and AWS publishes domain lenses (Serverless, SaaS, Analytics) that re-derive the pillars for specific workload shapes. The Well-Architected Tool in the console is a free structured self-review against exactly these questions — harmless to run, occasionally revealing, and it shows up as a correct answer when a question asks how to "assess workloads against best practices at no additional cost."</div>
`
    },
    {
      id: "shared-responsibility",
      title: "The shared responsibility model, per service — not the poster version",
      html: `
<p>The one-line version — AWS is responsible for security <em>of</em> the cloud, you are responsible for security <em>in</em> the cloud — is true and nearly useless. The senior version: <strong>the responsibility line is drawn at a different height for every service, it moves as you adopt more managed services, and every real breach on AWS in the last decade happened above the line, in customer configuration.</strong></p>

<h3>The invariants</h3>
<p>AWS always owns: physical facilities, hardware, the hypervisor and virtualization layer, the software of the managed services themselves, and the global network. You always own: your data, its classification, IAM (who can do what), and the client-side of everything. Everything between those poles slides depending on the service model.</p>

<h3>The line by service, concretely</h3>
<table>
<thead><tr><th>Service</th><th>AWS handles</th><th>You still own</th></tr></thead>
<tbody>
<tr><td>EC2</td><td>Hypervisor and below, physical network</td><td>Guest OS patching, hardening, host firewalls, security groups, IAM, data encryption choices, everything installed on the box</td></tr>
<tr><td>RDS</td><td>All of the above plus OS and database engine patching, backup machinery, failover plumbing</td><td>Choosing multi-AZ, enabling encryption at creation, network exposure (subnets, SGs, the publicly-accessible flag), DB users and grants, IAM, actually configuring backups and testing restores</td></tr>
<tr><td>Lambda</td><td>Everything through the runtime — fleet, OS, runtime patching (for managed runtimes), scaling</td><td>Your code and its dependencies, the execution role's permissions, environment secrets handling, VPC egress decisions</td></tr>
<tr><td>S3</td><td>Durability machinery, infrastructure, the service software</td><td>Bucket policies, Block Public Access, encryption configuration, object ACL posture, access logging, lifecycle, versioning, replication choices</td></tr>
<tr><td>DynamoDB / SQS / fully managed</td><td>Nearly everything operational</td><td>IAM, encryption key choice, data modeling, and data itself</td></tr>
</tbody>
</table>

<p>Read the table vertically and the pattern is: as you move from IaaS toward fully managed, AWS absorbs the <em>operational</em> security work (patching, availability of the service software) but your share never reaches zero — IAM, data, and network posture are permanently yours. Moving to managed services does not reduce your responsibility so much as it <strong>concentrates it into configuration</strong>, which is precisely why misconfiguration (a public S3 bucket, an over-broad role, a 0.0.0.0/0 security group) is the dominant real-world breach vector, not hypervisor escapes.</p>

<div class="callout deep">Two categories AWS formalizes but the poster omits. <strong>Shared controls</strong>: both parties do the same kind of work at different layers — AWS patches the infrastructure, you patch your AMIs; AWS trains its staff, you train yours; AWS configures its infrastructure, you configure your resources. <strong>Awareness and training</strong> and configuration management always appear on both sides. Also note abuse handling: if your compromised EC2 instance attacks others, AWS notifies you and can act, but cleaning it up is your job — AWS will not log into your guest OS, ever; they cannot, and that inability is itself a security property they advertise.</div>

<div class="callout exam">The exam tests the line with "who patches X" and "who configures X" phrasing. Reliable mappings: guest OS patching on EC2 — customer. Database engine patching on RDS — AWS (you control the maintenance window). Runtime patching on Lambda managed runtimes — AWS; on container images you supply — you. Physical security, hypervisor, hardware disposal — always AWS. Security group rules, IAM policies, bucket policies, data classification, encryption <em>choices</em> — always customer, on every service. If an option makes AWS responsible for anything inside your OS or your IAM, eliminate it.</div>

<div class="callout war">The gap that burns real teams is the word "managed" doing too much work in their heads. RDS is managed, so nobody owns verifying that backups restore. GuardDuty is on, so nobody triages its findings. The service being managed means the <em>machinery</em> runs; it does not mean anyone is looking at the output or has tested the recovery path. Assign a human owner to every above-the-line responsibility per service, in writing. The shared responsibility model is ultimately an org-chart document.</div>

<div class="callout limits">Compliance inheritance has a useful boundary: AWS's certifications (SOC 2, ISO 27001, PCI DSS attestation of the infrastructure, via the Artifact service) cover their side of the line only. Your workload is not "PCI compliant because it runs on AWS" — you inherit the infrastructure controls and must still evidence every control above the line. Auditors know this; exam questions about "reducing compliance scope" answer with managed services because they shrink, never eliminate, your control surface.</div>
`
    },
    {
      id: "saa-exam-strategy",
      title: "The SAA-C03 exam: domains, question anatomy, and how to beat it",
      html: `
<p>Know the instrument before you practice for it. SAA-C03 is 65 questions in 130 minutes — exactly two minutes per question — of which <strong>50 are scored and 15 are unscored experimental items</strong> you cannot identify, so treat every question as real. Scoring is scaled 100-1000 with a pass mark of <strong>720</strong>, compensatory across domains: you need 720 overall, not a pass in each domain, so a weak domain can be carried by strong ones. There is no penalty for wrong answers — never leave a blank. Question formats are multiple choice (4 options, 1 correct) and multiple response (5-6 options, choose 2 or 3; the count is always stated, and there is no partial credit).</p>

<h3>The four domains and their weights</h3>
<table>
<thead><tr><th>Domain</th><th>Weight</th><th>Center of gravity</th></tr></thead>
<tbody>
<tr><td>1. Design Secure Architectures</td><td><strong>30%</strong></td><td>IAM, policies, KMS, network security layers, secure access patterns</td></tr>
<tr><td>2. Design Resilient Architectures</td><td><strong>26%</strong></td><td>Multi-AZ vs multi-region, RTO/RPO, decoupling with queues, DR strategies</td></tr>
<tr><td>3. Design High-Performing Architectures</td><td><strong>24%</strong></td><td>Right service for the workload: storage tiers, caching, database selection, scaling</td></tr>
<tr><td>4. Design Cost-Optimized Architectures</td><td><strong>20%</strong></td><td>Purchase models, storage classes, data transfer costs, right-sizing</td></tr>
</tbody>
</table>
<p>Security plus resilience is 56% of the exam. That is why this course front-loads modules 2 and 15 (IAM and security services) and hammers multi-AZ semantics everywhere.</p>

<h3>Question anatomy</h3>
<p>Nearly every scored question has the same skeleton: <em>context</em> (a company and workload), <em>constraints</em> (the load-bearing sentence), and <em>the ask</em> — which ends with a superlative: MOST cost-effective, LEAST operational overhead, MOST resilient, MINIMAL changes to the application. The superlative is the actual question. Typically two of the four options are eliminable on correctness; the remaining two both <em>work</em>, and the superlative alone decides between them. Read the last sentence first, then read the scenario hunting for the constraint that discriminates.</p>

<h3>Elimination discipline</h3>
<ul>
<li>Kill options naming a service that does not do the thing (WAF does not encrypt; Macie does not scan EC2; ACM does not export public certs). A large fraction of distractors are category errors.</li>
<li>Kill options that violate a stated constraint ("no application changes" eliminates anything requiring an SDK swap; "within 15 minutes" as RTO eliminates backup-and-restore).</li>
<li>Between two working answers: LEAST operational overhead means the more managed option wins; MOST cost-effective means the option that still meets the requirements at the lowest cost wins — cheapness that misses a requirement is wrong, which is the trap in half the cost questions.</li>
</ul>

<h3>Keyword-to-answer reflexes</h3>
<p>These patterns pay rent. A sample (each module adds its own): "decouple" — SQS. "Fan-out" — SNS to SQS. "Millisecond latency at any scale, key-value" — DynamoDB. "Microsecond" — ElastiCache. "Petabyte transfer, limited bandwidth" — Snowball family. "Static IP for a load balancer" — NLB or Global Accelerator. "Serverless SQL on S3 data" — Athena. "Lowest-cost archival, retrieval time flexible" — S3 Glacier Deep Archive. "Single point of failure" in the stem — the answer adds multi-AZ or a second instance of whatever is singular. Treat these as priors, not laws — a stated constraint overrides a keyword every time.</p>

<div class="callout exam">Time strategy: first pass at under 90 seconds per question, flagging anything that needs thought; that banks 20+ minutes for the flagged set. Answer everything on first pass even when flagging — first instincts on eliminated-to-two questions are right more often than late-exam second-guessing. For multiple-response, eliminate independently: each correct option must stand alone as true and relevant; wrong options in select-TWO questions are usually one category error plus one constraint violation.</div>

<div class="callout war">The two ways prepared people fail: reading speed (non-native readers and slow readers should drill full-length timed exams, not just topic quizzes — stamina at question 55 is trainable), and studying the wrong decade — older material teaches answers that are now wrong, because the "best" answer moves as services evolve (gp3 displaced gp2, Graviton displaced x86 defaults, S3 Intelligent-Tiering displaced hand-rolled lifecycle rules in many questions). This course targets current service behavior; when a fact is version-sensitive the lesson says so.</div>

<h3>How this course's study loop works</h3>
<p>Each module: read the lessons (mental model first — if you only skim, skim the callouts), then take the quiz <em>closed-book</em> and read every explanation including for questions you got right, because the option-by-option dissections are where distractor patterns get burned in. Flashcards are for the numbers and one-line discriminations; run them spaced — the app resurfaces cards you miss. Do the lab if the module's service behavior is new to you; typing the CLI commands builds recall that reading never will. After every five modules, take a full timed practice exam and review by domain, then re-drill your weakest domain's flashcards. Target: two consecutive practice exams above 80% before booking. The real pass mark is 720/1000, but practice-exam difficulty calibration is noisy — 80% is the honest buffer.</p>
`
    }
  ],
  quiz: [
    {
      q: "A company runs a stateless API on 12 EC2 instances behind an ALB, 4 per AZ across three AZs, sized so that exactly 12 instances handle peak load. An architect must ensure the API survives the loss of any single AZ at peak with no degradation and no dependency on control-plane actions during the event. What should they do?",
      options: [
        "Configure the Auto Scaling group to scale out aggressively when average CPU rises after an AZ failure",
        "Increase the group to 18 instances, 6 per AZ, so any two AZs can carry the full peak load",
        "Create a warm standby copy of the stack in a second region with Route 53 failover",
        "Enable ALB cross-zone load balancing so surviving instances receive traffic evenly"
      ],
      answer: [1],
      multi: false,
      explanation: "This is the static stability pattern: pre-provision so that N-1 AZs carry 100% of peak, requiring zero API calls during the failure. 18 instances at 6 per AZ leaves 12 after losing an AZ — exactly full capacity. <strong>A</strong> is the trap: Auto Scaling depends on the EC2 control plane during the exact event when launch APIs may be throttled or impaired and surviving-AZ capacity is contended — the question explicitly forbids control-plane dependency. <strong>C</strong> answers a region-failure question that was not asked, adds cost and complexity, and its failover is itself an event-time action. <strong>D</strong> changes traffic distribution but adds no capacity; 8 surviving instances still cannot carry a 12-instance peak."
    },
    {
      q: "Two companies with separate AWS accounts run latency-sensitive workloads and want to confirm their EC2 instances are in the same physical availability zone. Company A's instances are in us-east-1a and Company B's are in us-east-1a. What should the architects check?",
      options: [
        "Nothing further - identical AZ names guarantee the same physical zone",
        "Compare the AZ IDs (such as use1-az4) for each account's subnets, because AZ names are randomized per account",
        "Open a support case, since physical AZ mapping is not exposed to customers",
        "Compare the regional API endpoints each account uses"
      ],
      answer: [1],
      multi: false,
      explanation: "AZ name-to-physical-zone mapping is shuffled per account to spread load, so two accounts' us-east-1a are usually different physical zones. The stable cross-account identifier is the AZ ID, visible in describe-availability-zones and on subnets. <strong>A</strong> is exactly the misconception the shuffling creates. <strong>C</strong> is outdated — AZ IDs have been exposed to customers for years precisely for this purpose. <strong>D</strong> is irrelevant; both accounts use the same regional endpoints regardless of AZ placement."
    },
    {
      q: "A media company needs to serve an interactive application requiring single-digit-millisecond latency from EC2 and EBS to end users in a specific metropolitan area that is far from the nearest AWS region. Which option meets the requirement?",
      options: [
        "Deploy the application to a CloudFront edge location in that city",
        "Deploy the application to an AWS Local Zone associated with the parent region",
        "Deploy the application to an additional availability zone in the nearest region",
        "Use AWS Outposts racks in the company's headquarters datacenter"
      ],
      answer: [1],
      multi: false,
      explanation: "Local Zones are metro-area extensions of a region that run EC2 and EBS close to users — exactly the single-digit-millisecond-to-a-metro requirement. <strong>A</strong> fails because edge locations cannot run EC2 or EBS; they host CloudFront, not general compute. <strong>C</strong> does not help — every AZ in a region is in the same general geographic area, and the premise says the region is too far. <strong>D</strong> puts compute in the company's own building, which serves employees there, not end users spread across the metro, and carries much higher cost and operational weight."
    },
    {
      q: "A deployment tool built for commercial AWS regions fails in AWS GovCloud with errors about invalid resource identifiers. The tool constructs ARNs from a template string. What is the MOST likely cause?",
      options: [
        "GovCloud requires ARNs to include the availability zone",
        "The tool hardcodes the aws partition in ARNs, but GovCloud ARNs use the aws-us-gov partition",
        "IAM ARNs in GovCloud must include a region field",
        "GovCloud account IDs are longer than 12 digits and break the template"
      ],
      answer: [1],
      multi: false,
      explanation: "GovCloud is a separate partition; every ARN there begins arn:aws-us-gov: and tooling that hardcodes arn:aws: constructs identifiers that do not exist. <strong>A</strong> is fictional — no ARN format includes an AZ. <strong>C</strong> is backwards; IAM is global in every partition and its ARNs have an empty region field everywhere. <strong>D</strong> is false — account IDs are 12 digits in all partitions. Partition-awareness is the classic cross-partition portability bug."
    },
    {
      q: "During a major incident in a region, an operations team observes that their running EC2 instances and existing Route 53 DNS answers continue working, but they cannot launch new instances or update DNS records. Which statement BEST explains this?",
      options: [
        "The region's data planes have failed while control planes remain healthy",
        "The service control planes are impaired while the data planes, which are engineered for higher availability and operate on last-known-good state, continue serving",
        "IAM has failed regionally, blocking all mutating and non-mutating API operations",
        "The account hit service quotas for instance launches and DNS record changes simultaneously"
      ],
      answer: [1],
      multi: false,
      explanation: "Create/modify/delete operations (RunInstances, ChangeResourceRecordSets) are control-plane; already-running instances and DNS query answering are data-plane. AWS deliberately decouples them so data planes keep serving from last-known-good configuration during control-plane impairment — the historically common incident shape. <strong>A</strong> inverts the observation: what keeps working is the data plane. <strong>C</strong> would also break read APIs and data-plane authentication paths, and IAM failure does not match the symptom set. <strong>D</strong> cannot explain two unrelated services degrading at once and quotas do not block DNS record updates."
    },
    {
      q: "An architecture review flags that a company's disaster recovery runbook requires an operator to run a script that calls the Route 53 API to repoint DNS at the standby site. Which change makes the failover statically stable?",
      options: [
        "Convert the script to a Lambda function triggered by a CloudWatch alarm",
        "Configure Route 53 failover routing records with health checks so the DNS data plane shifts traffic without any API calls",
        "Lower the record TTL to 30 seconds so manual changes propagate faster",
        "Replicate the script to a second region so it can run even if the primary region is down"
      ],
      answer: [1],
      multi: false,
      explanation: "Failover routing with health checks moves traffic entirely within Route 53's data plane — the health checkers and DNS servers keep operating during control-plane impairment, and no ChangeResourceRecordSets call is needed. <strong>A</strong> automates the dependency but keeps it: the Lambda still calls the control-plane API at event time. <strong>C</strong> speeds propagation of a change that still requires the API to accept the change. <strong>D</strong> addresses where the script runs, not the fact that its target API may be the impaired component — Route 53's control plane is global and singular."
    },
    {
      q: "A solutions architect must choose between multi-AZ and multi-region for a customer-facing application. The stated requirements are 99.9% availability, protection against building-level infrastructure failure, and minimal operational complexity. There is no compliance or geographic requirement. What should the architect recommend?",
      options: [
        "Multi-region active-active, because it provides the highest availability",
        "Multi-AZ within one region, because AZ isolation covers building-level failure at far lower complexity",
        "Single AZ with aggressive Auto Scaling, because AZ failures are rare",
        "Multi-region pilot light, to balance cost against region failure"
      ],
      answer: [1],
      multi: false,
      explanation: "AZs are physically separate facilities with independent power, cooling, and networking — building-level failure is precisely the failure domain they isolate. Multi-AZ meets 99.9% comfortably and is dramatically simpler than any multi-region posture. <strong>A</strong> over-engineers: active-active multi-region adds data-consistency and operational burden the requirements explicitly weigh against, and nothing in the requirements demands region-level survival. <strong>C</strong> leaves a single failure domain: an AZ event takes the application down regardless of scaling. <strong>D</strong> still adds cross-region replication and failover machinery for a requirement nobody stated. On this exam, multi-region needs an explicit justification in the stem; default to multi-AZ."
    },
    {
      q: "A company wants to guarantee that no principal in any member account, including account root users, can disable CloudTrail logging. Where must this control be implemented?",
      options: [
        "An IAM policy denying cloudtrail:StopLogging attached to every IAM user and role in each account",
        "A service control policy attached at the organization level, because SCPs bind all principals in member accounts including root",
        "A CloudTrail resource policy denying modification",
        "An IAM permission boundary applied to all administrators"
      ],
      answer: [1],
      multi: false,
      explanation: "Only SCPs constrain the root user of a member account; they are organization-level guardrails that cap what any principal in the account can do. <strong>A</strong> fails on root — root is not subject to IAM identity policies — and is operationally unmaintainable across principals. <strong>C</strong> is not a thing: CloudTrail trails do not have resource policies that gate StopLogging. <strong>D</strong> fails twice: boundaries apply only to the principals they are attached to and never to root. The keyword pattern is: restrict root or restrict an entire account means SCP."
    },
    {
      q: "Under the shared responsibility model, a company runs a workload on Amazon RDS for PostgreSQL and another on EC2 with self-managed PostgreSQL. Which TWO responsibilities remain with the customer in BOTH deployments? (Select TWO.)",
      options: [
        "Patching the PostgreSQL database engine",
        "Configuring network exposure through security groups and subnet placement",
        "Patching the underlying operating system",
        "Managing database user accounts, grants, and IAM access policies",
        "Replacing failed host hardware"
      ],
      answer: [1, 3],
      multi: true,
      explanation: "Network posture (<strong>B</strong>) and identity/access management including in-database users (<strong>D</strong>) are customer-owned in every service model — the responsibilities that never transfer. <strong>A</strong> splits: on RDS, AWS patches the engine (you set the window); on EC2 it is yours — so it is not common to both in the customer column the same way, and the exam treats engine patching on RDS as AWS's side. <strong>C</strong> likewise splits: AWS owns the OS on RDS, you own it on EC2. <strong>E</strong> is AWS's responsibility in both cases — physical hardware never crosses the line to the customer."
    },
    {
      q: "A security auditor asks who is responsible for patching the runtime when a team runs Node.js functions on AWS Lambda using an AWS managed runtime, and who is responsible when another team deploys Lambda functions from custom container images. What is the correct answer?",
      options: [
        "AWS patches both, because Lambda is fully managed",
        "AWS patches the managed runtime; the customer is responsible for updating the runtime inside their own container images",
        "The customer patches both, because code is always a customer responsibility",
        "AWS patches container images automatically if they are stored in Amazon ECR"
      ],
      answer: [1],
      multi: false,
      explanation: "With managed runtimes, the runtime and everything below it is AWS's side of the line. Supplying your own container image moves the runtime above the line: you built the image, you rebuild it with patches. <strong>A</strong> ignores that a customer-supplied image is customer-owned content — AWS never modifies your artifacts. <strong>C</strong> confuses code (always yours) with the managed runtime (AWS's when they supply it). <strong>D</strong> is fiction: ECR stores images; it does not rewrite them. ECR image scanning can detect stale packages, but detection is not patching."
    },
    {
      q: "A SAA-C03 question describes a workload and asks for the MOST cost-effective storage solution. Two remaining options both satisfy every stated requirement: one costs less, and a third eliminated option costs least of all but misses a stated retrieval-time requirement. How should the candidate reason?",
      options: [
        "Choose the absolute cheapest option, because the question prioritizes cost",
        "Choose the cheaper of the options that satisfy all stated requirements, because cost only ranks solutions that first meet the constraints",
        "Choose the more expensive qualifying option, because AWS prefers durable solutions",
        "Flag the question as flawed, since two options cannot both be correct"
      ],
      answer: [1],
      multi: false,
      explanation: "The superlative ranks only the feasible set: requirements are hard constraints, cost is the tiebreaker among options that meet them. <strong>A</strong> is the designed trap in most cost questions — the cheapest option violates a requirement (here, retrieval time) precisely to punish cost-first reasoning. <strong>C</strong> has no basis; gold-plating loses to a cheaper qualifying answer every time the stem says MOST cost-effective. <strong>D</strong> misreads the format: both options working is normal — the superlative exists to decide between them."
    },
    {
      q: "Which TWO statements about the SAA-C03 exam's structure are accurate? (Select TWO.)",
      options: [
        "Candidates must score at least 720 in each of the four domains to pass",
        "The exam contains 15 unscored questions that cannot be distinguished from scored ones",
        "Design Secure Architectures carries the largest domain weight at 30 percent",
        "Multiple-response questions award partial credit for each correct selection",
        "Unanswered questions are scored the same as wrong answers, so guessing is penalized"
      ],
      answer: [1, 2],
      multi: true,
      explanation: "The exam has 65 questions of which 15 are unscored experimental items (<strong>B</strong>), and the domain weights are Secure 30%, Resilient 26%, High-Performing 24%, Cost-Optimized 20%, making security the heaviest (<strong>C</strong>). <strong>A</strong> is wrong because scoring is compensatory — 720 overall, with no per-domain minimum. <strong>D</strong> is wrong: multiple-response items are all-or-nothing. <strong>E</strong> is self-contradictory as a reason not to guess: blanks and wrong answers score identically zero, which is exactly why you should always answer — there is no penalty beyond the miss itself."
    },
    {
      q: "An application in one AZ makes millions of small requests per day to a database replica it maintains in a different AZ of the same region, using private IP addresses. The team is surprised by a growing line item on the bill. What explains the cost?",
      options: [
        "Data transfer between AZs in the same region is billed per GB in each direction",
        "Private IP traffic is always free within a region; the cost must come from elsewhere",
        "The traffic is routing over the public internet because private IPs were used",
        "AWS charges per request for cross-AZ API calls between EC2 instances"
      ],
      answer: [0],
      multi: false,
      explanation: "Inter-AZ traffic bills at about one cent per GB each direction even on private IPs — chatty cross-AZ architectures accumulate real cost, which is why cross-zone load balancing and cross-AZ replication decisions deserve deliberate thought. <strong>B</strong> states the common misconception: only intra-AZ private-IP traffic is free. <strong>C</strong> is backwards — private IPs keep traffic on the AWS network; they do not push it to the internet. <strong>D</strong> invents a billing dimension: AWS bills this as bytes transferred, not per request."
    },
    {
      q: "A startup asks whether to structure as one AWS account with strict IAM separation between prod and dev, or as multiple accounts under AWS Organizations. Their priorities are limiting the blast radius of credential compromise and preventing dev experiments from consuming prod service quotas. What should the architect recommend and why?",
      options: [
        "One account, because IAM policies can achieve equivalent isolation with less overhead",
        "Multiple accounts, because the account is the strongest isolation boundary and service quotas are enforced per account per region",
        "One account, because service quotas can be partitioned between IAM roles",
        "Multiple accounts, but only because consolidated billing requires it"
      ],
      answer: [1],
      multi: false,
      explanation: "Both stated priorities point directly at account separation: nothing crosses an account boundary without explicit two-sided permission, and quotas (vCPUs, Lambda concurrency, API rates) are per account per region, so dev load testing cannot starve prod. <strong>A</strong> understates the difference — within one account, a policy mistake or a compromised admin credential reaches everything, and quota exhaustion is shared regardless of IAM. <strong>C</strong> is false: quotas cannot be divided among roles. <strong>D</strong> gets the recommendation right with a wrong reason: consolidated billing is a benefit of Organizations, not a requirement forcing multiple accounts."
    }
  ],
  flashcards: [
    { front: "What physically is an availability zone?", back: "One or more discrete datacenters with independent power, cooling, and networking, connected to other AZs by private metro fiber. Kilometers to ~100 km apart; inter-AZ RTT typically under 2 ms — close enough for synchronous replication, far enough to isolate facility-level disasters." },
    { front: "AZ name vs AZ ID — which is stable across accounts?", back: "The <strong>AZ ID</strong> (use1-az4). AZ <em>names</em> (us-east-1a) are randomized per account to spread load. Cross-account placement coordination must use AZ IDs." },
    { front: "The three AWS partitions", back: "<code>aws</code> (commercial), <code>aws-cn</code> (China), <code>aws-us-gov</code> (GovCloud). Hard boundaries: separate IAM, separate ARN namespaces, no cross-partition role assumption or peering." },
    { front: "Local Zone vs Wavelength Zone vs Outposts — one line each", back: "Local Zone: metro-area extension of a region for single-digit-ms latency to a city. Wavelength: compute embedded in 5G carrier networks. Outposts: AWS-owned rack in your own datacenter. All are extensions of a parent region, not independent regions." },
    { front: "Can you run EC2 at a CloudFront edge location?", back: "No. Edge locations host CloudFront, Route 53 resolution, and Global Accelerator ingress. The only edge compute is Lambda@Edge and CloudFront Functions, both heavily constrained." },
    { front: "ARN format, and which fields S3 and IAM leave empty", back: "<code>arn:partition:service:region:account-id:resource</code>. S3 omits region AND account (bucket names are globally unique per partition). IAM omits region (global service)." },
    { front: "Why do S3 policies often need two Resource lines?", back: "<code>arn:aws:s3:::bucket</code> covers bucket-level actions (ListBucket); <code>arn:aws:s3:::bucket/*</code> covers object-level actions (GetObject, PutObject). The wildcard form does not match the bucket itself, and vice versa." },
    { front: "Control plane vs data plane — define and give the Route 53 example", back: "Control plane: APIs that create/modify/delete (ChangeResourceRecordSets). Data plane: the machinery doing continuous work (DNS servers answering queries). Data planes are engineered for higher availability; Route 53's query-answering data plane has a 100% availability design goal." },
    { front: "Define static stability", back: "A system that keeps operating correctly through a dependency failure <strong>without any changes</strong> — no API calls, no reconfiguration, no human action. Achieved by pre-provisioning (N-1 AZ capacity) and keeping control-plane calls out of recovery paths." },
    { front: "Why is relying on Auto Scaling for AZ-failure recovery risky?", back: "It depends on the EC2 control plane at event time: launch APIs can be throttled or impaired during large incidents and surviving-AZ capacity is contended. Statically stable designs pre-provision so N-1 AZs carry peak load with zero launches." },
    { front: "The six Well-Architected pillars", back: "Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, Sustainability. The four SAA-C03 scored domains map onto pillars 2-5." },
    { front: "RTO vs RPO", back: "RTO: maximum acceptable time to restore service after failure. RPO: maximum acceptable data loss measured in time (how far back the last recoverable state may be). Cross-region async replication always implies RPO greater than zero." },
    { front: "Shared responsibility: who patches what on EC2, RDS, and Lambda?", back: "EC2 guest OS: customer. RDS OS and DB engine: AWS (customer sets maintenance window). Lambda managed runtime: AWS; customer-supplied container images: customer. Physical/hypervisor layer: always AWS. IAM, data, network posture: always customer." },
    { front: "What does moving to managed services do to your security responsibility?", back: "Concentrates it into configuration rather than eliminating it. IAM, data classification, encryption choices, and network exposure remain yours on every service — which is why misconfiguration is the dominant real-world breach vector." },
    { front: "SAA-C03: question count, time, pass mark, scoring model", back: "65 questions (50 scored + 15 unscored, indistinguishable), 130 minutes, scaled score 100-1000, pass at <strong>720</strong>, compensatory across domains (no per-domain minimum), no penalty for guessing, no partial credit on multi-response." },
    { front: "SAA-C03 domain weights", back: "Design Secure Architectures 30%, Resilient 26%, High-Performing 24%, Cost-Optimized 20%. Security + resilience = 56% of the exam." },
    { front: "Reading strategy for a scenario question", back: "Read the final sentence (the ask + superlative) first, then scan the scenario for the discriminating constraint. Usually two options are eliminable on correctness; the superlative (MOST cost-effective, LEAST operational overhead) decides between the two that both work." },
    { front: "What does the aws-us-gov partition change about ARNs?", back: "Every ARN begins <code>arn:aws-us-gov:</code> instead of <code>arn:aws:</code>. Tooling that hardcodes the commercial partition constructs invalid identifiers in GovCloud (and in China, arn:aws-cn:)." },
    { front: "Inter-AZ data transfer pricing shape", back: "About 0.01 USD per GB <em>in each direction</em> in most regions, even over private IPs. Intra-AZ private-IP traffic is free. This is the cost dimension behind cross-zone load balancing and chatty multi-AZ designs." },
    { front: "Which control can restrict a member account's root user?", back: "Only a service control policy (SCP) from AWS Organizations. IAM identity policies and permission boundaries never bind root. 'Restrict root' or 'restrict the whole account' on the exam means SCP." },
    { front: "Why are new AWS regions opt-in a security consideration?", back: "Opt-in regions do not exist in your account until enabled, so region-enumerating controls (SCP region allowlists, Config rules, monitoring) written before enablement can silently miss them. Enumerate dynamically or deny by default." }
  ],
  lab: {
    title: "Lab: map your account's physical AZs and read ARNs from the CLI",
    html: `
<h3>Goal</h3>
<p>Use the CLI to (1) prove that AZ names are account-randomized by finding your AZ IDs, (2) enumerate regions including opt-in status, and (3) create one real resource and dissect its ARN. Everything here is free-tier or fractions of a cent; total time about 20 minutes.</p>

<h3>Architecture</h3>
<p>No architecture to build — this lab interrogates the global infrastructure layer itself, then creates and destroys a single S3 bucket as an ARN specimen. The only billable artifact is a bucket that exists for minutes with one tiny object.</p>

<h3>Steps</h3>
<ol>
<li><p><strong>Identify yourself and capture your account ID.</strong> Every later ARN embeds it.</p>
<pre><code>aws sts get-caller-identity
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo $ACCOUNT_ID</code></pre>
<p>Note the ARN in the output: <code>arn:aws:sts::ACCOUNT:assumed-role/...</code> or <code>arn:aws:iam::ACCOUNT:user/...</code> — region field empty, because STS/IAM identities are global.</p></li>

<li><p><strong>List regions, including ones you have not opted into.</strong></p>
<pre><code>aws ec2 describe-regions --all-regions \
  --query 'Regions[].[RegionName,OptInStatus]' --output table</code></pre>
<p>Look for the three OptInStatus values: <code>opt-in-not-required</code> (the original regions), <code>opted-in</code>, and <code>not-opted-in</code>. Any region in the third state is invisible to most of your tooling today but could appear tomorrow — the guardrail lesson from module 1.</p></li>

<li><p><strong>Map AZ names to AZ IDs in two regions.</strong></p>
<pre><code>aws ec2 describe-availability-zones --region us-east-1 \
  --query 'AvailabilityZones[].[ZoneName,ZoneId,ZoneType]' --output table

aws ec2 describe-availability-zones --region us-west-2 \
  --all-availability-zones \
  --query 'AvailabilityZones[].[ZoneName,ZoneId,ZoneType]' --output table</code></pre>
<p>Record your mapping (for example us-east-1a = use1-az6). If you can compare with a colleague's account, do it — your letters will usually map to different zone IDs. Note also that with <code>--all-availability-zones</code> you may see ZoneType values of <code>local-zone</code> or <code>wavelength-zone</code> alongside <code>availability-zone</code>: Local Zones surface in the same API, as children of the parent region.</p></li>

<li><p><strong>Create an ARN specimen.</strong> Make a bucket (name must be globally unique — the account ID suffix handles that) and an object:</p>
<pre><code>BUCKET=arn-lab-$ACCOUNT_ID
aws s3api create-bucket --bucket $BUCKET --region us-east-1
echo 'hello' &gt; /tmp/specimen.txt
aws s3 cp /tmp/specimen.txt s3://$BUCKET/dir/specimen.txt</code></pre></li>

<li><p><strong>Dissect the ARNs.</strong> Write out by hand, then verify your reasoning:</p>
<ul>
<li>Bucket ARN: <code>arn:aws:s3:::arn-lab-ACCOUNT_ID</code> — no region, no account field. Why? Global bucket namespace.</li>
<li>Object ARN: bucket ARN plus <code>/dir/specimen.txt</code>.</li>
<li>Confirm the two-resource-line policy point: run a simulated check of which ARN a ListBucket vs a GetObject action needs.</li>
</ul>
<pre><code>aws s3api list-objects-v2 --bucket $BUCKET --query 'Contents[].Key'</code></pre>
<p>ListObjectsV2 authorizes against the <em>bucket</em> ARN; GetObject authorizes against the <em>object</em> ARN. Same API namespace, different resource lines — the source of countless AccessDenied surprises.</p></li>

<li><p><strong>Check a quota, to internalize that quotas are per account per region.</strong></p>
<pre><code>aws service-quotas get-service-quota \
  --service-code ec2 --quota-code L-1216C47A \
  --region us-east-1 \
  --query 'Quota.[QuotaName,Value]' --output text</code></pre>
<p>That is your On-Demand Standard vCPU quota in us-east-1. Run it again with <code>--region eu-west-1</code> and observe it is tracked independently.</p></li>
</ol>

<h3>Verify</h3>
<ul>
<li>You have a written mapping of AZ names to AZ IDs for at least one region.</li>
<li>You can state why the S3 bucket ARN has two empty fields and the IAM ARN has one.</li>
<li>You saw at least one region with OptInStatus not-opted-in (newer accounts) or understand why none appeared (older account with everything enabled).</li>
</ul>

<h3>Teardown</h3>
<p>One bucket to remove. Order matters: objects first, then the bucket.</p>
<ol>
<li><pre><code>aws s3 rm s3://$BUCKET --recursive
aws s3api delete-bucket --bucket $BUCKET
rm /tmp/specimen.txt</code></pre></li>
<li><p>Confirm nothing remains:</p>
<pre><code>aws s3api head-bucket --bucket $BUCKET 2&gt;&amp;1 || echo 'bucket gone'</code></pre></li>
</ol>
<p>Nothing else in this lab created billable resources — describe and get-quota calls are free.</p>
`
  }
});
