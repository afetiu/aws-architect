window.COURSE.register({
  id: "pro-scenarios",
  order: 25,
  track: "sap",
  title: "Professional Scenario Walkthroughs",
  description: "Six complete SAP-C02-style scenarios dissected end to end: requirements extraction, candidate architectures with honest trade-offs, the chosen design, and how the exam disguises each one — trap options included.",
  examWeight: "This is exam technique distilled. Every SAP-C02 question is a compressed version of one of these six shapes: multi-region data, hybrid network, org security, cost program, modernization sequencing, or tiered DR.",
  lessons: [
    {
      id: "scenario-active-active",
      title: "Scenario A: global e-commerce goes multi-region active-active",
      html: `
<h3>The scenario</h3>
<p>A retailer running its e-commerce platform in us-east-1 serves customers in North America, Europe, and Asia. Revenue is roughly 2M USD per hour at peak. Two incidents last year — a regional service event and a bad deploy — each cost seven figures. The board mandates: no single region may take the platform down, and customers everywhere should see acceptable latency. The stack today: ALB → ECS services (stateless), ElastiCache for sessions, Aurora MySQL for orders and inventory, S3 for assets, a third-party payment gateway. Compliance requires EU customer PII to be storable in the EU. Budget exists, but the CTO wants the increment justified. The team has never operated multi-region.</p>

<h3>Requirements extraction</h3>
<table>
<thead><tr><th>Type</th><th>Requirement</th></tr></thead>
<tbody>
<tr><td>Functional</td><td>Serve reads/writes from at least two regions; low latency per geography; survive full region loss</td></tr>
<tr><td>RTO/RPO</td><td>Implied near-zero RTO (active-active mandate); RPO near-zero for orders/payments; sessions may be lossy</td></tr>
<tr><td>Compliance</td><td>EU PII residency — a data-partitioning requirement, not just replication</td></tr>
<tr><td>Cost</td><td>Justify increment; avoid paying 2x for everything if a cheaper tier meets the mandate</td></tr>
<tr><td>Operational</td><td>Team inexperience — favor managed replication over hand-built consensus</td></tr>
</tbody>
</table>

<h3>Candidate architectures</h3>
<p><strong>Candidate 1 — Active-passive (warm standby), pilot-light data.</strong> Full stack in us-east-1, scaled-down copy in eu-west-1, Aurora cross-region replica, Route 53 failover. Cheapest; RTO minutes-to-an-hour; does nothing for latency in Asia; fails the literal active-active mandate but is the honest baseline to price against.</p>
<p><strong>Candidate 2 — Active-active with Aurora Global Database (single write region).</strong> Three regions serve traffic; reads are local via Global Database secondary clusters (typical replication lag under a second); <em>all writes</em> route to the primary region (write forwarding makes this transparent to app code). Region loss: promote a secondary (managed failover, RPO typically ~1s, RTO around a minute plus app re-pointing). Sessions move to DynamoDB with TTL. This is "read-active-everywhere, write-active-one-place."</p>
<p><strong>Candidate 3 — True write-active-everywhere on DynamoDB Global Tables.</strong> Re-model orders/cart/session into DynamoDB; Global Tables replicate multi-master with last-writer-wins conflict resolution; each region reads and writes locally. Requires redesigning relational access patterns and accepting eventual consistency between regions — and LWW is <em>dangerous for money</em> unless writes are idempotent and conflict-free by construction (per-region keyspaces, append-only order events).</p>
<table>
<thead><tr><th></th><th>1: Warm standby</th><th>2: Aurora Global, local reads</th><th>3: DynamoDB Global Tables</th></tr></thead>
<tbody>
<tr><td>Region-loss RTO/RPO</td><td>Tens of min / seconds-min</td><td>~1 min / ~1 s</td><td>~0 / ~0 (in-flight replication at risk)</td></tr>
<tr><td>Write latency abroad</td><td>n/a (one region)</td><td>Cross-region for writes</td><td>Local</td></tr>
<tr><td>App change</td><td>None</td><td>Small (sessions out, write forwarding)</td><td>Large (data remodel)</td></tr>
<tr><td>Conflict risk</td><td>None</td><td>None (single writer)</td><td>Real — LWW must be designed around</td></tr>
<tr><td>Cost</td><td>+~25–40%</td><td>+~60–80%</td><td>+~70–100% plus migration</td></tr>
</tbody>
</table>

<h3>Chosen design and why</h3>
<p>Candidate 2, with surgical borrowing from 3: <strong>Aurora Global Database for the relational core (orders, inventory) with a single write region; DynamoDB Global Tables for sessions and cart</strong> (naturally idempotent, lossy-tolerant, benefit most from local writes). <strong>Global Accelerator</strong> in front of regional ALBs: anycast static IPs, connection-preserving traffic steering, and near-instant regional dial-off — versus Route 53, where failover waits on health-check detection plus resolver TTL behavior, and misbehaving resolvers ignore TTLs. Payment calls get an <strong>idempotency-key design</strong> (client-generated key stored with conditional writes) so a retry after failover cannot double-charge — the exam loves this detail, and so do auditors. EU PII: partition, don't replicate — EU customer profiles live in an eu-west-1 silo (cell-based routing by customer home region), while non-PII catalog/inventory replicates globally. Failover testing is scheduled game-days: dial a region to zero in Global Accelerator monthly, promote Aurora secondaries quarterly in a staging copy — an untested failover path is a rumor, not a capability.</p>

<div class="callout war">The strangler here is write latency: teams ship candidate 2, then someone notices checkout in Sydney pays a 200 ms cross-region write tax and quietly asks for multi-master. Hold the line: money flows must be single-writer or provably conflict-free. The postmortems that end careers are double-shipped orders, not slow checkouts.</div>

<h3>How the exam would ask this</h3>
<div class="callout exam">Disguise 1: "lowest RTO for regional failure with static IP allowlisting by partners" → Global Accelerator over Route 53 (static anycast IPs + no DNS caching). Disguise 2: "global users, local low-latency reads, strongly consistent writes" → Aurora Global Database with write forwarding — the trap is DynamoDB Global Tables, which sacrifices cross-region strong consistency (LWW). Disguise 3: "prevent duplicate payment on retry during failover" → idempotency keys with conditional writes, NOT "use SQS FIFO" (dedupe window is 5 minutes and the payment call is synchronous). Trap options to eliminate on sight: Aurora multi-master (effectively defunct, never cross-region), "RDS Multi-AZ" offered as a multi-<em>region</em> answer (it is multi-AZ only), and any answer that replicates EU PII worldwide despite a residency clause.</div>
`
    },
    {
      id: "scenario-hybrid-network",
      title: "Scenario B: hybrid network redesign after an acquisition",
      html: `
<h3>The scenario</h3>
<p>A financial-services firm acquires a competitor. The parent has 40 AWS accounts behind a Transit Gateway in eu-west-1, two 10 Gbps Direct Connect circuits, and on-prem datacenters using 10.0.0.0/8. The acquired company brings 15 accounts of VPC-peered spaghetti and — inevitably — VPCs and offices also numbered inside 10.0.0.0/8, with hard overlaps against both the parent's cloud and on-prem ranges. Regulators require all traffic between the two company environments to be inspected, and all internet egress to flow through an approved, logged egress point. Application teams need parent↔acquired connectivity for about 30 specific service pairs within a quarter; full network unification can take longer. Renumbering the acquired production estate this year is off the table.</p>

<h3>Requirements extraction</h3>
<table>
<thead><tr><th>Type</th><th>Requirement</th></tr></thead>
<tbody>
<tr><td>Functional</td><td>~30 service pairs reachable across overlapping CIDRs in ~90 days; eventual unified network</td></tr>
<tr><td>Compliance</td><td>Inspection of inter-company traffic; centralized, logged internet egress</td></tr>
<tr><td>Availability</td><td>Hybrid path must survive a DX circuit/location failure</td></tr>
<tr><td>Constraints</td><td>No renumbering of acquired prod this year; VPC peering cannot carry overlapping routes at all</td></tr>
<tr><td>Cost</td><td>TGW data processing and inspection per-GB costs at financial-firm volumes are material</td></tr>
</tbody>
</table>

<h3>Candidate architectures</h3>
<p><strong>Candidate 1 — Renumber and merge.</strong> Re-IP the acquired estate into unallocated space, attach everything to the parent TGW, one flat route domain. Cleanest end state; directly violates the no-renumbering constraint for prod this quarter. Verdict: this is the <em>destination</em>, not the quarter-one plan.</p>
<p><strong>Candidate 2 — Dual TGW segmentation + NAT bridging for overlaps + central inspection.</strong> Keep two route domains: parent TGW and a new TGW for the acquired estate (replacing peering spaghetti). Connect them via <strong>TGW peering</strong> — but peering cannot route overlapping prefixes either, so overlapping service pairs traverse a <strong>NAT translation layer</strong>: PrivateLink endpoints for the API-shaped services (an NLB-fronted service consumed through an interface endpoint needs <em>no</em> routable path between the VPCs at all — overlap becomes irrelevant), and for non-PrivateLink-able flows, private NAT gateways in a bridging VPC translating into a small non-overlapping carve-out range. Inspection: a centralized <strong>inspection VPC</strong> with Network Firewall / GWLB appliances; TGW route tables steer inter-domain and egress traffic through it (appliance mode on for symmetric flows). Egress: one egress VPC, NAT + firewall, logged.</p>
<p><strong>Candidate 3 — Full-mesh VPN overlay between specific VPC pairs.</strong> Site-to-site tunnels with NAT-traversal per pair. Works for 3 pairs; at 30 pairs it is an unmanageable snowflake farm at ~1.25 Gbps per tunnel, with no central inspection story. Verdict: distractor.</p>
<table>
<thead><tr><th></th><th>1: Renumber now</th><th>2: Segment + PrivateLink/NAT + inspect</th><th>3: VPN mesh</th></tr></thead>
<tbody>
<tr><td>Meets 90-day goal</td><td>No</td><td>Yes</td><td>Barely, then collapses</td></tr>
<tr><td>Handles CIDR overlap</td><td>By eliminating it</td><td>Yes (PrivateLink ignores it; NAT translates it)</td><td>Yes, painfully per-tunnel</td></tr>
<tr><td>Central inspection</td><td>Yes</td><td>Yes (inspection VPC)</td><td>No</td></tr>
<tr><td>Ops burden</td><td>Huge upfront</td><td>Moderate</td><td>Grows per pair forever</td></tr>
</tbody>
</table>

<h3>Chosen design and why</h3>
<p>Candidate 2 now, candidate 1 as the funded end state. Sequencing: (1) stand up the acquired-side TGW and collapse the peering mesh; (2) publish the ~30 services over <strong>PrivateLink first</strong> — it dissolves the overlap problem for anything that looks like a service behind an NLB/ALB, which is most of the 30; (3) private NAT gateway bridging only for the stubborn bidirectional/legacy flows; (4) inspection VPC with TGW appliance mode, all inter-domain routes pointing through it; (5) centralized egress with Network Firewall and flow/DNS logging for the regulator; (6) DX resiliency — the two circuits must terminate in <em>different DX locations</em>, with a Site-to-Site VPN over the internet as tested last-resort backup, and BGP prefixes/BFD tuned so failover is automatic; (7) IPAM adoption and a renumbering roadmap that retires the NAT bridges application by application.</p>

<div class="callout war">Two production landmines: TGW peering is non-transitive — on-prem traffic arriving over the parent's DX cannot hop through the parent TGW to the acquired TGW unless you explicitly design for it (Direct Connect gateway associations per TGW, or route through the inspection layer). And appliance-mode-off asymmetric routing through stateful firewalls produces intermittent, maddening resets that look like application bugs. Both surface only under real traffic.</div>

<h3>How the exam would ask this</h3>
<div class="callout exam">Disguise 1: "two companies merged, overlapping CIDRs, application in company A must consume a service in company B with least operational overhead" → <strong>PrivateLink</strong>, full stop — it is the only option unbothered by overlap. Trap options: VPC peering (rejected outright with overlaps), TGW attachment (cannot propagate overlapping routes), "renumber the VPC" (contradicts a stated constraint). Disguise 2: "all inter-VPC and egress traffic must be inspected" → inspection VPC + TGW route-table steering + appliance mode; the trap is per-VPC firewall sprawl or an answer using security groups as 'inspection'. Disguise 3: "resilient hybrid connectivity" → two DX at different locations + VPN backup; the trap is two circuits at the same location (shared facility failure) or 'DX is redundant by default' (it is not). Remember the number: a VPN tunnel ~1.25 Gbps; ECMP across tunnels to scale — an answer replacing 10 Gbps DX with one VPN tunnel fails on arithmetic.</div>
`
    },
    {
      id: "scenario-incident-hardening",
      title: "Scenario C: org-wide incident response and guardrail rollout",
      html: `
<h3>The scenario</h3>
<p>A SaaS company with 60 AWS accounts discovers, via an AWS abuse notice, cryptomining EC2 instances in three sandbox accounts. Investigation finds a developer's long-lived access key leaked in a public repo weeks ago. There is no organization-wide CloudTrail; GuardDuty is enabled in some accounts; SCPs are unused; several teams still deploy with IAM user keys. The CISO wants three things: contain and eradicate this incident with forensic evidence preserved; detect-and-respond automation so the next compromise is contained in minutes, not weeks; and preventive guardrails rolled out org-wide — without breaking production for the teams that currently depend on the very practices being banned.</p>

<h3>Requirements extraction</h3>
<table>
<thead><tr><th>Type</th><th>Requirement</th></tr></thead>
<tbody>
<tr><td>Immediate</td><td>Contain compromised credentials and instances; preserve forensics; scope the blast radius</td></tr>
<tr><td>Detect/respond</td><td>Org-wide telemetry; automated containment in minutes</td></tr>
<tr><td>Preventive</td><td>SCP guardrails, key elimination, org-wide baseline — rolled out without prod breakage</td></tr>
<tr><td>Compliance</td><td>Evidence chain for the incident; auditable configuration going forward</td></tr>
<tr><td>Cost</td><td>Modest — GuardDuty/CloudTrail/Config org-wide have real but justifiable line items</td></tr>
</tbody>
</table>

<h3>Incident response: the correct order</h3>
<ol>
<li><strong>Contain credentials:</strong> deactivate the leaked key. Then check for persistence — <em>the key is how they got in, not necessarily where they still are</em>: enumerate recently created IAM users, keys, roles, and role trust-policy edits made by the compromised principal (Athena over whatever CloudTrail exists; account-level 90-day event history if not). Attach a deny-all policy to the compromised principal rather than deleting it — deletion destroys the audit trail linkage. Revoke active STS sessions (the console 'revoke sessions' applies a condition denying tokens issued before now).</li>
<li><strong>Contain instances without destroying evidence:</strong> isolate with a no-rules security group (plus removing them from ASGs so replacement instances don't inherit compromise), snapshot EBS volumes, capture memory if capability exists, tag and move snapshots to a locked forensics account. Do <em>not</em> terminate first — termination is evidence destruction. Stop-then-snapshot loses memory but preserves disk; isolation preserves both while the miner spins harmlessly.</li>
<li><strong>Eradicate and recover:</strong> rebuild from known-good IaC/AMIs; never "clean" a compromised host back into service.</li>
</ol>

<h3>Detection and auto-containment architecture</h3>
<p>Delegated-administrator pattern throughout, from a security-tooling account: <strong>GuardDuty org-wide</strong> (auto-enroll new accounts), <strong>Security Hub</strong> as the aggregation plane, <strong>org CloudTrail</strong> from the management account into a locked log-archive bucket (SSE-KMS, object lock, access-denied to everyone), <strong>Config</strong> org-wide with conformance packs, <strong>IAM Access Analyzer</strong> at org level. The response loop: GuardDuty finding → <strong>EventBridge rule</strong> (matched on finding type/severity) → <strong>Step Functions / Lambda containment runbooks</strong>: for CryptoCurrency or Backdoor findings on EC2 — auto-apply quarantine SG, snapshot, notify; for IAMUser anomalies — auto-attach deny-all, revoke sessions, page a human. Severity gates matter: auto-contain machines aggressively; auto-containing <em>identities</em> in prod gets a human-in-the-loop confirmation step, because a false positive that locks out the deploy role is a self-inflicted outage.</p>

<h3>Guardrail rollout without breaking prod</h3>
<p>The Pro-level answer is a <em>staged, observed</em> rollout:</p>
<ol>
<li><strong>Author the SCP set:</strong> deny root user actions, deny CloudTrail/GuardDuty/Config tampering, deny leaving the org, region allowlist, deny unapproved instance families (the miner's favorites), require IMDSv2.</li>
<li><strong>Observe before enforcing:</strong> SCPs have no audit mode — so simulate: mine CloudTrail/Access Analyzer for principals currently doing what the SCP would deny; apply to a canary OU (sandbox) first; then expand OU by OU with a rollback plan. Never attach a new deny SCP org-root-first.</li>
<li><strong>Kill long-lived keys with a migration path, not an edict:</strong> inventory key usage via credential reports and Access Analyzer; move humans to Identity Center SSO, CI/CD to OIDC federation (GitHub/GitLab → STS), workloads to roles; <em>then</em> SCP-deny new key creation and age out the stragglers with dated exceptions.</li>
</ol>

<div class="callout war">The classic guardrail incident: an SCP denying ec2:RunInstances outside eu-west-1 ships org-wide on Friday; Monday, a team's us-east-1 DR pipeline — exempt in everyone's mental model but not in the policy — fails its scheduled test. SCPs affect <em>every principal including service roles</em>, and there is no dry-run. Canary OUs and CloudTrail-based pre-checks are not bureaucracy; they are the difference between a guardrail and an outage.</div>

<h3>How the exam would ask this</h3>
<div class="callout exam">Disguise 1: "EC2 credentials compromised, must preserve evidence" → isolate SG + snapshot + deactivate keys; the trap is 'terminate the instance immediately' (destroys evidence) or 'delete the IAM user' (destroys attribution). Disguise 2: "automatically remediate GuardDuty findings across all accounts" → delegated admin + EventBridge + Lambda/Step Functions, findings aggregated to the security account; the trap is per-account manual runbooks or CloudWatch alarms on CPU (detects mining by accident, not by design). Disguise 3: "prevent any user, including administrators, from disabling logging" → SCP denying cloudtrail:StopLogging etc. — IAM policies cannot bind other admins; only SCPs constrain everyone. Disguise 4: "roll out restrictions without impacting workloads" → the staged OU-by-OU answer with usage analysis first; the trap options apply at org root immediately or 'use IAM boundaries instead' (boundaries bind roles you control, not 60 accounts of them). Remember: SCPs never grant, don't apply to the management account, and service-linked roles are exempt.</div>
`
    },
    {
      id: "scenario-cost-program",
      title: "Scenario D: the cost blowout investigation",
      html: `
<h3>The scenario</h3>
<p>A scale-up's AWS bill has grown from 150k to 410k USD/month in a year, far outpacing traffic growth. Finance demands a 30% reduction without feature freezes. Nobody can say what the money buys: tagging is patchy, there is one shared account for most workloads plus a dozen stragglers, no commitments (everything on-demand), and engineering "doesn't look at the bill." A quick skim shows big line items: EC2, RDS, NAT gateway data processing, inter-AZ transfer, and a surprising CloudWatch charge. The CTO wants a defensible program: find the waste, fix the architecture where the architecture is the problem, and only then commit spend — in that order.</p>

<h3>Requirements extraction</h3>
<table>
<thead><tr><th>Type</th><th>Requirement</th></tr></thead>
<tbody>
<tr><td>Visibility</td><td>Attribute spend to teams/services before optimizing anything</td></tr>
<tr><td>Target</td><td>-30% run rate, no feature freeze, no availability regression</td></tr>
<tr><td>Sequencing</td><td>Waste → architecture → commitments (discounting a wasteful baseline locks in waste)</td></tr>
<tr><td>Governance</td><td>Make it stick: budgets, anomaly detection, showback</td></tr>
</tbody>
</table>

<h3>Phase 1 — Instrument: CUR + Athena, tags, anomaly detection</h3>
<p>Stand up the <strong>Cost and Usage Report</strong> (now via Data Exports) into S3, query with Athena; Cost Explorer for interactive triage; enforce a tag policy plus activate cost-allocation tags; account-per-team as the durable attribution boundary (tags lie, account IDs don't). Turn on <strong>Cost Anomaly Detection</strong> immediately — it is free and catches the next blowout while you fix this one. Compute Optimizer and Trusted Advisor cover rightsizing and idle-resource sweeps.</p>

<h3>Phase 2 — The usual suspects (and this bill has all of them)</h3>
<ul>
<li><strong>NAT gateway data processing:</strong> the classic. CUR shows NatGateway-Bytes at 4.5 cents/GB. Root causes ranked: (1) private subnets reaching <em>S3 and DynamoDB through NAT</em> — fix with free gateway VPC endpoints, often a five-figure monthly save for a routing-table change; (2) heavy ECR/API traffic → interface endpoints (1 cent/GB beats 4.5, plus hourly); (3) cross-AZ NAT hairpins — give each AZ its own NAT gateway.</li>
<li><strong>Inter-AZ transfer (1 cent/GB each direction):</strong> chatty microservices and Kafka replication crossing AZs. Fixes: AZ-aware routing (topology-aware clients, ALB cross-zone decisions made deliberately), co-locating chatty pairs — while <em>keeping</em> multi-AZ for the state layer; the goal is removing accidental crossings, not availability.</li>
<li><strong>EC2/RDS shape problems:</strong> Compute Optimizer flags overprovisioning (that 10–20% utilization again); dev/test running nights and weekends → Instance Scheduler; gp2 → gp3 (~20% cheaper, decoupled IOPS); prev-gen instances → current gen or Graviton (~10–20% better price-perf where compatible).</li>
<li><strong>CloudWatch surprise:</strong> almost always debug-level log ingestion at 50 cents/GB. Cut log levels, add retention policies (default is never-expire), route high-volume firehose logs to S3 instead.</li>
<li><strong>S3:</strong> no lifecycle policies, abandoned multipart uploads, versioned buckets with no noncurrent-version expiry → Storage Lens finds it, lifecycle + Intelligent-Tiering fixes it.</li>
</ul>

<h3>Phase 3 — Architecture fixes vs discounting fixes</h3>
<p>The distinction the CTO asked for, and the one the exam tests: an <strong>architecture fix</strong> changes the usage (endpoints, AZ-locality, scheduling, rightsizing, storage class); a <strong>discounting fix</strong> changes the unit price of usage you keep (Savings Plans, RIs, Spot). Sequencing matters because commitments are sized on the baseline: commit first and every subsequent architecture fix strands committed spend. So: waste out, shapes right, <em>then</em> commit.</p>
<table>
<thead><tr><th></th><th>Compute Savings Plans</th><th>EC2 Instance SPs / Standard RIs</th><th>Spot</th></tr></thead>
<tbody>
<tr><td>Covers</td><td>EC2 + Fargate + Lambda, any family/region</td><td>Specific family (deeper discount, ~up to 72%)</td><td>Interruptible capacity, up to ~90% off</td></tr>
<tr><td>Flexibility</td><td>High — survives Graviton/family moves</td><td>Low — bets on a family</td><td>n/a</td></tr>
<tr><td>Use for</td><td>The stable compute floor</td><td>Truly pinned workloads (licensed DBs on EC2)</td><td>Stateless/batch/CI with interruption handling</td></tr>
</tbody>
</table>
<p>Chosen program: cover ~70–80% of the post-cleanup steady-state floor with Compute Savings Plans (1-year to start, given growth uncertainty), RDS Reserved Instances for the databases, Spot for CI and batch. Governance to make it stick: budgets with alerts per account, anomaly detection subscriptions, a monthly cost review where each team sees its own showback, and unit economics (cost per order) on the exec dashboard — the metric that survives traffic growth arguments.</p>

<div class="callout war">Two program-killers seen in the wild: (1) buying three-year no-upfront Standard RIs for the pre-cleanup fleet — the rightsizing program then strands a third of the commitment; (2) declaring victory on a percentage while unit cost quietly rises. And politically: showback without account/tag hygiene collapses in the first meeting when 40% of spend is 'untagged/shared'. Fix attribution first; it is what makes every later conversation short.</div>

<h3>How the exam would ask this</h3>
<div class="callout exam">Disguise 1: "high NAT gateway charges for workloads accessing S3" → gateway VPC endpoints (free), the single most-tested cost fact in this domain; the trap is interface endpoints for S3 (work, but cost per-GB and per-hour) or 'bigger NAT gateway' (there is no such thing; it scales automatically and the charge is per-GB). Disguise 2: "steady baseline plus spiky batch, minimize compute cost" → Savings Plans for the floor + Spot for the batch; the trap is sizing commitments to peak. Disguise 3: "which to do FIRST" in a cost program → visibility/tagging/CUR before any optimization. Disguise 4: "unpredictable usage across Lambda, Fargate, EC2, may adopt Graviton" → Compute Savings Plans over EC2 Instance SPs/RIs — flexibility beats depth when the shape is uncertain. Numbers to hold: NAT processing 4.5c/GB, inter-AZ 1c/GB/direction, interface endpoint 1c/GB, CloudWatch ingestion 50c/GB, Spot up to ~90%, RIs/EC2-SPs up to ~72%.</div>
`
    },
    {
      id: "scenario-strangler-migration",
      title: "Scenario E: on-prem Java monolith to event-driven microservices",
      html: `
<h3>The scenario</h3>
<p>An insurer runs a 15-year-old Java monolith (policy admin, quoting, billing, documents) on WebLogic against a 6 TB Oracle database, on-prem. Two-week release cycles, four-hour maintenance windows, and quoting — the competitive differentiator — can only ship changes at monolith speed. The datacenter contract ends in 20 months. The mandate: quoting must iterate weekly within six months; the whole estate must be off-prem by contract end; billing (regulated, stable) must not be destabilized; and there is no tolerance for a big-bang cutover — the CIO explicitly cites a failed rewrite attempt three years ago. Team: strong Java, no cloud production experience yet.</p>

<h3>Requirements extraction</h3>
<table>
<thead><tr><th>Type</th><th>Requirement</th></tr></thead>
<tbody>
<tr><td>Functional</td><td>Quoting independently deployable in 6 months; full datacenter exit in 20</td></tr>
<tr><td>Risk</td><td>No big-bang; billing stability paramount; every step revertible</td></tr>
<tr><td>RTO/RPO</td><td>Business-hours criticality; data loss on policy/billing records unacceptable</td></tr>
<tr><td>Cost</td><td>Oracle license exit desirable but subordinate to the timeline</td></tr>
<tr><td>People</td><td>Java-strong, cloud-new — favor incremental learning curve (containers over a serverless leap)</td></tr>
</tbody>
</table>

<h3>Candidate architectures</h3>
<p><strong>Candidate 1 — Rehost everything, modernize later.</strong> MGN the WebLogic fleet, DMS the Oracle DB to RDS Oracle (BYOL). Meets the 20-month exit with margin; does nothing for the 6-month quoting mandate. Half right.</p>
<p><strong>Candidate 2 — Strangler fig with phased extraction and DB decomposition.</strong> Routing facade first, extract quoting immediately, rehost/replatform the remainder for the exit date, decompose further in the cloud. Meets both clocks.</p>
<p><strong>Candidate 3 — Rewrite as event-driven serverless in parallel, cut over at the end.</strong> The failed-rewrite pattern the CIO named, with a Lambda accent. Eighteen months of dual maintenance with zero incremental value delivery, then the riskiest possible cutover. Eliminate.</p>
<table>
<thead><tr><th></th><th>1: Rehost-only</th><th>2: Strangler + phased</th><th>3: Parallel rewrite</th></tr></thead>
<tbody>
<tr><td>Quoting in 6 months</td><td>No</td><td>Yes</td><td>No</td></tr>
<tr><td>Exit in 20 months</td><td>Yes</td><td>Yes</td><td>Coin flip</td></tr>
<tr><td>Billing risk</td><td>Low</td><td>Low (untouched until late)</td><td>High</td></tr>
<tr><td>Incremental/revertible</td><td>Partly</td><td>Fully — every step is a routing change</td><td>No</td></tr>
</tbody>
</table>

<h3>Chosen design: the sequencing is the architecture</h3>
<ol>
<li><strong>Facade first (month 1–2):</strong> ALB in AWS in front of the monolith (targets reach on-prem via DX/VPN as IP targets). All traffic flows through the seam <em>before</em> anything is extracted. Zero behavior change, total routing control gained.</li>
<li><strong>Quoting extraction (month 2–6):</strong> quoting is read-heavy against reference data (products, rates) and produces quotes — well-bounded. Build the service on ECS Fargate (Java stays Java; Spring Boot in containers is the low-slope path for this team). Feed it reference data via <strong>DMS CDC from the Oracle monolith DB into the service's own PostgreSQL</strong> — the monolith remains system of record while quoting reads locally. Route /quoting at the ALB with weighted target groups: 5% canary, compare outputs (shadow traffic diffing old vs new quotes), ramp, 100%. Rollback at every point = weight change.</li>
<li><strong>Write ownership and the outbox (month 6–9):</strong> quoting begins owning its writes. Emitted quote events use the <strong>transactional outbox</strong>: event row committed in the same transaction as state, relay publishes to EventBridge — never the dual-write. Billing consumes 'QuoteAccepted' events without a synchronous coupling to the new service.</li>
<li><strong>Dual-run and monolith DB decomposition (month 9–14):</strong> for each further extraction (documents, policy views), run <em>dual-read comparison</em> first (new service shadow-reads, results diffed against monolith responses in production traffic, no user impact), then cut reads, then writes. The Oracle schema loses tables to service-owned PostgreSQL databases one bounded context at a time — CDC keeps the monolith's read views warm during transitions (reverse replication for rollback windows).</li>
<li><strong>The remainder exits (month 12–20):</strong> the shrunken monolith and billing rehost/replatform: WebLogic → containerized or MGN-rehosted, Oracle remainder → RDS (BYOL initially; license exit becomes a post-exit program with SCT/DMS once the clock pressure is off). Billing is deliberately touched <em>last and least</em>.</li>
</ol>

<div class="callout war">The cutover discipline that saves this program: every write-path cutover has a <em>reverse CDC path</em> configured before the cutover, not after the incident. When the new quoting service owns writes and something is wrong in week two, you need last week's writes flowing back into Oracle to fall back — otherwise 'rollback' means data loss and the rollback option is fictional. Dual-run windows with reconciliation reports (row counts, checksums, business-level diffs) are what make the CIO's 'no big bang' real rather than rhetorical.</div>

<h3>How the exam would ask this</h3>
<div class="callout exam">Disguise 1: "modernize incrementally with ability to shift a percentage of traffic and roll back instantly" → ALB weighted target groups in a strangler pattern; the trap is Route 53 weighted records (DNS caching makes 'instantly' false) or blue/green of the whole monolith (not incremental). Disguise 2: "new service needs data owned by the monolith without modifying the monolith" → DMS CDC replication into the service's database; the trap is a shared database forever (couples deploys) or dual writes from the app (the consistency bug). Disguise 3: "guarantee events are published exactly when state changes commit" → transactional outbox; the trap options publish-then-write or write-then-publish. Disguise 4: "team is Java-strong, cloud-new, tight deadline" → containers on ECS/Fargate over a Lambda rewrite — match the answer to the team, a real SAP-C02 signal. Constraint words like 'previous rewrite failed' or 'no big-bang' are the examiner telling you to eliminate every option containing 'rewrite in parallel and switch over'.</div>
`
    },
    {
      id: "scenario-tiered-dr",
      title: "Scenario F: designing a tiered DR program",
      html: `
<h3>The scenario</h3>
<p>A logistics company runs ~120 applications in a single region after last year's migration. An auditor's resilience finding requires a documented, <em>tested</em> DR capability within 12 months. The CFO refuses a blanket approach after seeing one quote that priced full multi-region redundancy for everything at nearly double the current run rate. The CTO's direction: tier the portfolio by actual business impact, apply the cheapest strategy that meets each tier's requirement, and prove it works with evidence the auditor will accept. Known anchors: the shipment-tracking API and label-printing services stop warehouses (~1M USD/hour); finance reporting can wait a day; ~80 internal tools can wait days. The whole estate is IaC-defined except six legacy apps.</p>

<h3>Requirements extraction</h3>
<table>
<thead><tr><th>Type</th><th>Requirement</th></tr></thead>
<tbody>
<tr><td>Functional</td><td>Region-loss survival, per-tier; auditor-grade evidence of testing</td></tr>
<tr><td>RTO/RPO</td><td>Not uniform — that is the whole point; must be derived per app from business impact</td></tr>
<tr><td>Cost</td><td>Materially less than 2x; spend proportional to impact</td></tr>
<tr><td>Constraints</td><td>Six non-IaC legacy apps; 12-month deadline including test evidence</td></tr>
</tbody>
</table>

<h3>Step 1 — Tier by business impact, then assign RTO/RPO</h3>
<p>Run a business-impact analysis: revenue/hour of outage, regulatory exposure, dependency fan-in (an 'internal tool' that the Tier-1 API calls is Tier 1). Resist tier inflation — every owner claims Tier 1 until shown the per-tier price. Publishing the cost of each tier is the mechanism that makes tiering honest.</p>
<table>
<thead><tr><th>Tier</th><th>Example</th><th>RTO / RPO</th><th>Strategy</th><th>Cost shape (vs primary)</th></tr></thead>
<tbody>
<tr><td>1 (~8 apps)</td><td>Tracking API, label printing</td><td>Minutes / ~zero</td><td>Warm standby → active-active for the top 2–3</td><td>+40–100% per app</td></tr>
<tr><td>2 (~15 apps)</td><td>Customer portal, partner EDI</td><td>~1 hour / minutes</td><td>Warm standby (scaled-down live stack)</td><td>+20–40%</td></tr>
<tr><td>3 (~20 apps)</td><td>Finance reporting</td><td>4–24 h / 1 h</td><td>Pilot light (data live, compute dark)</td><td>+5–15%</td></tr>
<tr><td>4 (~80 apps)</td><td>Internal tools</td><td>Days / 24 h</td><td>Backup and restore, cross-region copies</td><td>+1–5%</td></tr>
</tbody>
</table>

<h3>Step 2 — Per-tier mechanics</h3>
<ul>
<li><strong>Tier 4 — backup and restore:</strong> AWS Backup with org-level backup policies, cross-region (and cross-account, for ransomware isolation) copies, vault lock for immutability. IaC makes restore credible: the runbook is 'deploy the stack in region B, restore data'. The six legacy apps are the real risk — either invest to IaC them or accept (in writing) a multi-day RTO backed by AMI/image copies.</li>
<li><strong>Tier 3 — pilot light:</strong> data replicates continuously (Aurora cross-region replica or Global Database, S3 CRR, DynamoDB Global Tables); compute exists as templates at zero/minimal footprint. Recovery = promote data, scale compute from zero. RTO is dominated by promotion + scale-up + <em>DNS/traffic cutover</em>.</li>
<li><strong>Tier 2 — warm standby:</strong> the full stack runs small-but-live in region B (min-capacity ASGs, small Fargate services) continuously serving synthetic checks — 'live' is what distinguishes warm standby from pilot light and is why its RTO is scale-up time only. Route 53 failover or Global Accelerator, health checks tested monthly.</li>
<li><strong>Tier 1 — warm-to-active:</strong> the 2–3 true money paths go active-active (scenario A's playbook: Global Accelerator, Aurora Global with managed failover or DynamoDB Global Tables where models permit, idempotent writes); the rest of Tier 1 runs warm standby at near-full scale. <strong>Elastic DR (DRS)</strong> covers anything not re-architectable — continuous block replication, sub-second RPO, minutes-scale RTO — the managed successor to CloudEndure and the right answer for 'low RTO/RPO DR without re-architecting'.</li>
</ul>

<h3>Step 3 — The testing regime (what the auditor actually accepts)</h3>
<ul>
<li>Tier 4: quarterly automated restore tests — an unrestored backup is Schrödinger's DR; AWS Backup restore testing plans automate the evidence.</li>
<li>Tier 3: semiannual pilot-light exercises to a parallel VPC, measured against declared RTO.</li>
<li>Tier 2/1: quarterly failover game-days; for the active-active pair, monthly region dial-downs in production (small percentage, then full) — plus chaos-style dependency checks (does the Tier-1 API secretly call a Tier-3 service?).</li>
<li>Every test emits a scorecard: declared vs achieved RTO/RPO, gaps, owners. Twelve months of these is the audit artifact.</li>
</ul>

<div class="callout war">Three DR frauds to hunt in reviews: (1) the untested runbook — a wiki page from 2023 referencing an ALB deleted in 2024; (2) the hidden dependency — Tier-1 failover succeeds but auth/DNS/CI lives only in region A (shared platform services must themselves be Tier 1); (3) quota surprise — region B has default quotas and no capacity assurance; pre-raise quotas and consider capacity reservations for Tier-1 failover fleets. Also: pilot light that has quietly rotted — the AMIs are 14 months old and the app no longer boots on them. Continuous deployment to the DR region (deploy dark, stay current) beats periodic 'DR refresh' projects.</div>

<h3>How the exam would ask this</h3>
<div class="callout exam">Disguise 1: "RTO 15 minutes, RPO near zero, cannot re-architect" → Elastic Disaster Recovery (DRS); traps are backup-and-restore (hours-days) and full active-active (violates 'cannot re-architect' and cost). Disguise 2: "RTO 4 hours, RPO 1 hour, minimize cost" → pilot light; the trap is warm standby (meets it but is not the cheapest that meets it — SAP-C02 grades on 'cheapest that satisfies'). Disguise 3: "scaled-down but running copy" → warm standby by definition; "data replicated, compute off" → pilot light — the exam tests the vocabulary boundary. Disguise 4: "prove DR works" → scheduled game-days + automated restore testing, never 'the runbook is documented'. The meta-pattern for the whole scenario: any answer applying one DR strategy uniformly across a large portfolio is wrong on cost or wrong on risk — the Pro answer tiers.</div>
`
    }
  ],
  quiz: [
    {
      q: "A global retailer serves an e-commerce application from three regions. Checkout writes must never be double-applied even if a client retries a payment call during a regional failover. Which design property most directly prevents duplicate charges?",
      options: [
        "Route payment traffic through an SQS FIFO queue to deduplicate requests",
        "Require clients to send an idempotency key that the payment service stores with a conditional write before processing",
        "Use DynamoDB Global Tables so all regions see the same payment records",
        "Enable sticky sessions on the load balancer so retries reach the same backend"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: an idempotency key persisted via a conditional write makes the payment operation safely retryable — the second attempt finds the key and returns the original result, which is exactly the failover-retry protection needed. <strong>A</strong> fails twice: payment authorization is a synchronous request/response flow that does not fit a queue, and FIFO deduplication only covers a 5-minute window against identical message bodies. <strong>C</strong> addresses replication, not idempotency — Global Tables' last-writer-wins conflict handling could actually mask a double-charge as two writes, and cross-region lag means the retry may not see the first attempt anyway. <strong>D</strong> is irrelevant during regional failover — the original backend (and its session state) is gone; stickiness cannot survive the event being designed for."
    },
    {
      q: "An application runs active-active in two regions behind DNS-based routing. During a failover test, a significant share of clients continued sending traffic to the failed region for over 10 minutes despite a 60-second TTL. Which change gives the fastest, most deterministic regional failover?",
      options: [
        "Reduce the Route 53 record TTL from 60 seconds to 10 seconds",
        "Place AWS Global Accelerator in front of both regional endpoints and shift traffic with endpoint dials",
        "Switch from Route 53 failover routing to latency-based routing",
        "Configure Route 53 health checks with a faster failure threshold"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: the observed problem is DNS caching disobedience — resolvers and clients that ignore TTLs — which no DNS-side tuning fixes. Global Accelerator removes DNS from the failover path entirely: clients hold static anycast IPs and traffic steering happens in the AWS network edge within seconds. <strong>A</strong> and <strong>D</strong> optimize the well-behaved path but do nothing about non-compliant resolvers, which were the stated failure. <strong>C</strong> changes routing policy, not the caching problem — latency-based routing still resolves through the same disobedient DNS layer."
    },
    {
      q: "A company must give its EU customers data residency for PII while running a global storefront in three regions. Product catalog data has no residency restriction. What is the appropriate data architecture?",
      options: [
        "Replicate all customer data to all three regions using DynamoDB Global Tables for low latency",
        "Keep EU customer PII in an EU-region silo with requests routed by customer home region, while replicating the catalog globally",
        "Encrypt all globally replicated PII with a KMS key stored in the EU region",
        "Store all customer data only in the EU region and serve other geographies from there"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: residency is a partitioning problem — PII stays in an EU silo (cell/home-region routing), while unrestricted data (catalog) replicates freely for latency. This satisfies the law and the latency goal simultaneously. <strong>A</strong> replicates EU PII worldwide, directly violating the residency requirement no matter how fast it is. <strong>C</strong> is the seductive trap: encryption with an EU-held key does not change where the data physically resides — residency regimes constrain storage location, not just key location. <strong>D</strong> satisfies residency by over-applying it, imposing EU round trips on all global customers and creating a single-region availability profile the scenario is trying to escape."
    },
    {
      q: "After an acquisition, an application in the parent company's VPC (10.20.0.0/16) must consume a REST service in the acquired company's VPC, which uses the overlapping range 10.20.0.0/16. Renumbering is not currently possible. Which solution requires the LEAST operational overhead?",
      options: [
        "Establish VPC peering between the two VPCs with specific /32 routes for the service hosts",
        "Attach both VPCs to a Transit Gateway and use route priority to disambiguate the overlap",
        "Expose the service through a Network Load Balancer and AWS PrivateLink, consumed via an interface endpoint in the parent VPC",
        "Deploy a site-to-site VPN between the VPCs with NAT translation rules on both sides"
      ],
      answer: [2],
      multi: false,
      explanation: "<strong>C</strong> is correct: PrivateLink is consumer-side an ENI with a local IP — no route between the two VPCs' CIDRs exists or is needed, so the overlap is simply irrelevant, and it is fully managed. <strong>A</strong> is impossible: VPC peering rejects overlapping CIDRs at creation; no /32 cleverness gets around it. <strong>B</strong> fails similarly — a TGW route table cannot hold usable routes for identical prefixes pointing at different attachments in one domain; overlap is a hard problem for TGW routing, not a priority setting. <strong>D</strong> can work but is the maximum-overhead option: per-tunnel NAT rule maintenance, ~1.25 Gbps tunnel limits, and a snowflake to operate — the opposite of least operational overhead."
    },
    {
      q: "A regulated enterprise requires that all traffic between its production VPCs and all outbound internet traffic pass through centralized inspection appliances. VPCs are attached to a Transit Gateway. Which design accomplishes this?",
      options: [
        "Deploy AWS Network Firewall endpoints in every production VPC and manage rules with Firewall Manager",
        "Use security group referencing across VPCs to enforce inspection policies",
        "Create an inspection VPC with firewall appliances behind a Gateway Load Balancer, enable TGW appliance mode on its attachment, and steer inter-VPC and egress routes through it",
        "Enable Traffic Mirroring on all ENIs and analyze mirrored traffic in a security VPC"
      ],
      answer: [2],
      multi: false,
      explanation: "<strong>C</strong> is correct: the hub-and-spoke inspection pattern — TGW route tables force spoke-to-spoke and spoke-to-egress traffic through an inspection VPC, GWLB scales the appliances, and appliance mode keeps both directions of a flow on the same appliance so stateful inspection works. <strong>A</strong> inspects but decentralizes — per-VPC firewalls multiply cost and rule drift, and the requirement says centralized. <strong>B</strong> is category confusion: security groups filter, they do not inspect payloads, and cross-VPC SG referencing only works over peering in limited cases — it is not an inspection architecture. <strong>D</strong> is passive: Traffic Mirroring copies packets for out-of-band analysis; it cannot block or enforce anything inline."
    },
    {
      q: "A company has two Direct Connect connections and must ensure hybrid connectivity survives both a device failure and a DX location failure, with an emergency fallback if both circuits fail. Which design meets this?",
      options: [
        "Two DX connections terminating on separate devices at the same DX location, with a backup VPN",
        "Two DX connections at different DX locations, plus a Site-to-Site VPN over the internet as a tested last-resort path",
        "One DX connection with a LAG of four ports for redundancy, plus a second virtual interface",
        "Two DX connections at different locations, with no VPN since dual DX already exceeds the availability target"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: location diversity covers facility-level failure (fiber cut, site power), and the VPN provides a last-resort path over a fully independent medium — with the key discipline that it is tested, since an unexercised backup fails when finally needed. <strong>A</strong> survives device failure but a single facility event takes both circuits — same-location redundancy is the classic planted flaw. <strong>C</strong> is one connection wearing a costume: LAG ports and extra VIFs share the same physical circuit and location; there is no path diversity at all. <strong>D</strong> gambles on correlated failures — dual DX can share intermediate fiber or provider infrastructure, and the scenario explicitly demands a fallback for the both-circuits-down case."
    },
    {
      q: "GuardDuty reports cryptocurrency mining activity on an EC2 instance in a production account. The security team must contain the instance while preserving evidence for forensic analysis. Which sequence is correct?",
      options: [
        "Terminate the instance immediately, then review CloudTrail for the root cause",
        "Stop the instance, create an AMI, and relaunch it in an isolated subnet for analysis",
        "Detach the instance from its Auto Scaling group, replace its security groups with an isolation group allowing no traffic, snapshot its EBS volumes, and preserve them in a forensics account",
        "Reboot the instance to clear the miner from memory, then patch the operating system"
      ],
      answer: [2],
      multi: false,
      explanation: "<strong>C</strong> is correct and ordered correctly: ASG detachment prevents automated replacement/termination interference, an isolation SG severs command-and-control while leaving the instance (and its memory) intact, and snapshots preserved in a separate locked account establish evidence with an intact chain of custody. <strong>A</strong> is evidence destruction — termination discards the volumes (with default delete-on-termination) and memory before any analysis. <strong>B</strong> loses volatile memory on stop and, worse, relaunches a compromised image — analysis happens on copies, never by running the compromised artifact. <strong>D</strong> is the worst option: reboot destroys memory evidence, does not remove persistence mechanisms, and 'patch and continue' leaves an attacker-touched host in production."
    },
    {
      q: "A security team must roll out an SCP that denies EC2 usage outside two approved regions across a 60-account organization. Several teams may have undocumented dependencies on other regions. What is the safest rollout approach?",
      options: [
        "Attach the SCP to the organization root immediately, since SCPs can be detached quickly if problems occur",
        "Analyze CloudTrail for out-of-region activity, attach the SCP to a sandbox OU first, then expand OU by OU with a rollback plan",
        "Enable the SCP in audit mode across the organization and review violations before switching it to enforce mode",
        "Replace the SCP with IAM permissions boundaries on each account's roles to achieve the same restriction"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: since SCPs have no dry-run capability, you simulate one — mine CloudTrail for principals currently active in to-be-denied regions, fix or exempt them, then canary the policy on a low-stakes OU and expand deliberately. <strong>A</strong> is the outage generator: 'detach quickly' happens after the DR pipeline or scheduled job has already failed, and SCPs bind every principal including service roles teams forgot they had. <strong>C</strong> describes a feature that does not exist — SCPs have no audit mode; that is precisely why the CloudTrail-analysis-plus-canary pattern is the answer (this option tests whether you know the feature gap). <strong>D</strong> mis-scopes the tool: permissions boundaries apply per-role in accounts you administer role-by-role — unenforceable as an org-wide guarantee and exactly what SCPs exist to provide."
    },
    {
      q: "A CISO requires that no principal in any member account, including account administrators, can stop or modify the organization's CloudTrail logging. Which mechanism enforces this?",
      options: [
        "An IAM policy in each account denying cloudtrail:StopLogging to all roles",
        "A service control policy attached above the member accounts denying CloudTrail stop, update, and delete actions",
        "CloudTrail log file validation combined with an S3 bucket policy on the log bucket",
        "AWS Config rules that detect and alert when a trail is stopped"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: only SCPs bind every principal in a member account including its administrators — an org trail plus an SCP denying cloudtrail:StopLogging/UpdateTrail/DeleteTrail is the standard tamper-proof logging pattern. <strong>A</strong> fails because account admins can edit or detach IAM policies in their own account — an IAM deny cannot constrain the person who administers IAM. <strong>C</strong> protects the integrity and storage of logs already written (validation detects tampering, bucket policy protects objects) but does not prevent stopping the trail from writing in the first place. <strong>D</strong> is detective, not preventive — it tells you logging stopped; the requirement is that it cannot stop."
    },
    {
      q: "A cost review finds that a company's largest growing line item is NAT gateway data processing. Analysis shows most of the traffic is private-subnet workloads writing objects to S3 in the same region. Which change eliminates the majority of this cost?",
      options: [
        "Create a gateway VPC endpoint for S3 and add it to the private subnets' route tables",
        "Create an interface VPC endpoint for S3 in each availability zone",
        "Replace the NAT gateway with a fleet of NAT instances on Graviton to lower the hourly rate",
        "Enable S3 Transfer Acceleration to reduce the volume of data processed"
      ],
      answer: [0],
      multi: false,
      explanation: "<strong>A</strong> is correct: a gateway endpoint for S3 costs nothing — no hourly fee, no per-GB processing — and same-region S3 traffic leaves the NAT path entirely with a route-table change. This is the single highest-yield cost fix on the exam. <strong>B</strong> works but is strictly worse for this case: interface endpoints bill hourly per AZ plus ~1 cent/GB — cheaper than NAT's 4.5 cents but not free; choose interface endpoints for S3 only when on-prem/cross-VPC private access requires an ENI. <strong>C</strong> misreads the bill: the dominant charge is per-GB processing driven by traffic volume, not the hourly rate, and NAT instances trade managed reliability for marginal savings. <strong>D</strong> is unrelated — Transfer Acceleration optimizes long-distance internet uploads (and adds cost); it does not reduce bytes traversing a NAT gateway."
    },
    {
      q: "A company completing a cost-optimization cleanup has a stable compute baseline across EC2, Fargate, and Lambda, and plans to migrate some services to Graviton over the next year. Which commitment strategy fits best?",
      options: [
        "Three-year Standard Reserved Instances covering current instance types at maximum discount",
        "One-year Compute Savings Plans sized to the post-cleanup baseline, with Spot for interruptible batch workloads",
        "EC2 Instance Savings Plans for each current instance family in each region",
        "No commitments, relying on continued rightsizing to reduce on-demand costs"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct on both axes the scenario stresses: Compute Savings Plans span EC2, Fargate, and Lambda and survive family/architecture changes — so the planned Graviton migration keeps its discount — while sizing to the post-cleanup baseline avoids committing to waste, and Spot layers on top for interruptible work. <strong>A</strong> and <strong>C</strong> buy deeper discounts by betting on specific families the company has said it will change; the Graviton moves would strand those commitments (Standard RIs and EC2 Instance SPs are family-locked). <strong>D</strong> leaves the guaranteed ~30–50%+ commitment discount on a stable baseline unclaimed — rightsizing and commitments are complementary, sequenced waste-first then commit, not either-or."
    },
    {
      q: "During a modernization program, a new microservice must serve quotes using product reference data that remains owned by the legacy monolith's Oracle database. The monolith cannot be modified, and the service must not query Oracle directly at runtime. Which approach fits?",
      options: [
        "Use DMS change data capture to continuously replicate the reference tables from Oracle into the microservice's own database",
        "Have the microservice call a new stored procedure added to the Oracle database",
        "Schedule a nightly export of the reference tables to S3 and reload the microservice database each morning",
        "Point the microservice at an Oracle read replica to isolate its query load"
      ],
      answer: [0],
      multi: false,
      explanation: "<strong>A</strong> is correct: CDC from Oracle's redo stream into the service's database gives near-real-time local reads, zero monolith modification, and clean ownership boundaries — the standard strangler-fig data pattern. <strong>B</strong> violates the no-modification constraint (a new stored procedure is a monolith change) and deepens coupling to the database being escaped. <strong>C</strong> satisfies the constraints but with up-to-24-hour staleness for quoting data and a brittle batch window — CDC dominates it on freshness at similar cost. <strong>D</strong> breaks the 'must not query Oracle at runtime' requirement — a replica is still Oracle, still couples the service to the monolith's schema, and still carries Oracle licensing."
    },
    {
      q: "A team is extracting a service from a monolith. When the service commits a state change, it must reliably publish an event to EventBridge; an event must never be published without the commit, and a commit must never silently miss its event. Which pattern satisfies this?",
      options: [
        "Publish the event to EventBridge first, then write the database change if publishing succeeds",
        "Write the database change and publish the event in sequence within the service code, with retries on the publish call",
        "Write the state change and an event record to an outbox table in one database transaction, with a relay process publishing outbox rows to EventBridge",
        "Wrap the database write and the EventBridge publish in a two-phase commit coordinated by the service"
      ],
      answer: [2],
      multi: false,
      explanation: "<strong>C</strong> is correct: the transactional outbox makes state and event atomic — both commit or neither — and the relay (polling or CDC-driven) delivers at-least-once to EventBridge, with consumers idempotent. <strong>A</strong> inverts the failure: a published event followed by a failed write announces something that never happened. <strong>B</strong> is the dual-write bug this question exists to test — a crash between the write and the publish (or after retries exhaust) silently drops the event, and retries cannot fix a process that died. <strong>D</strong> is not implementable: EventBridge is not a two-phase-commit participant — no XA-style coordinator spans a relational database and the event bus, which is exactly why the outbox pattern exists."
    },
    {
      q: "An application has a disaster recovery requirement of 15-minute RTO and near-zero RPO for a regional failure. The application runs on EC2 with a self-managed database and cannot be re-architected this year. The DR budget is limited. Which strategy fits?",
      options: [
        "Nightly AMI and database backups copied to a second region, restored on demand",
        "AWS Elastic Disaster Recovery replicating the servers continuously to a staging area in a second region, with recovery instances launched at failover",
        "An active-active deployment across two regions with the database converted to DynamoDB Global Tables",
        "A pilot light with database replication and AMIs, scaling compute from zero at failover"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: Elastic Disaster Recovery does continuous block-level replication into a cheap staging footprint (sub-second RPO) and launches recovery instances in minutes (RTO within the 15-minute bound) — purpose-built for low RTO/RPO without re-architecting, at pilot-light-like standby cost. <strong>A</strong> misses both numbers: nightly backups give up to 24 hours of RPO and multi-hour restore RTO. <strong>C</strong> meets the numbers but violates two stated constraints — it requires the re-architecture that is off the table (database conversion) and roughly doubles run cost against a limited budget. <strong>D</strong> is close but typically misses the strict RPO for the self-managed database unless replication is engineered per-engine — which is the re-architecture effort DRS avoids — and cold-start compute scaling strains a 15-minute RTO."
    },
    {
      q: "An auditor rejects a company's DR documentation, noting there is no evidence recovery actually works. Which combination provides auditor-grade, ongoing evidence for a tiered DR program? (Select TWO.)",
      options: [
        "Automated restore testing of backups on a schedule, with results recorded against declared recovery objectives",
        "Quarterly failover game-days for higher tiers, producing scorecards of declared versus achieved RTO and RPO",
        "Documented runbooks for each tier, reviewed and signed off annually by application owners",
        "Enabling AWS Backup vault lock to guarantee backups cannot be deleted",
        "Raising service quotas in the recovery region to match production"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<strong>A</strong> and <strong>B</strong> are correct because both produce recurring <em>evidence of successful recovery</em> — measured restore tests (AWS Backup restore testing automates this) and game-day scorecards comparing declared to achieved objectives, which is exactly what 'prove it works' means to an auditor. <strong>C</strong> is what the auditor just rejected: documentation and signatures attest intent, not capability — an unexercised runbook is unverified. <strong>D</strong> is valuable for ransomware-resistant immutability but proves backups exist, not that they restore into a working system. <strong>E</strong> is a sound preparatory step for real failovers, yet generates no evidence at all — a raised quota demonstrates nothing about recoverability."
    }
  ],
  flashcards: [
    { front: "Route 53 failover vs Global Accelerator — the deciding factors", back: "GA: static anycast IPs, no DNS-cache dependence, seconds-scale traffic dials — pick for fast deterministic failover and IP allowlisting. Route 53: DNS-based, at the mercy of TTLs and resolver behavior; fine when minutes-scale shifts are acceptable." },
    { front: "Aurora Global Database vs DynamoDB Global Tables for multi-region", back: "Aurora Global: single write region (write forwarding), ~1s replicated reads, managed failover ~1 min RTO / ~1s RPO — strong consistency per region. Global Tables: multi-master local writes, eventual consistency, last-writer-wins conflicts — only for idempotent/conflict-free models (sessions, carts), never naively for money." },
    { front: "Payment retry safety across failover", back: "Client-generated idempotency key, persisted with a conditional write before processing; retry returns the original result. Queues and stickiness do not solve this — the pattern does." },
    { front: "Data residency in a global architecture", back: "Partition, don't replicate: PII lives in a home-region silo with cell/home routing; only unrestricted data replicates globally. Encrypting with an in-country key does NOT satisfy storage-location requirements." },
    { front: "Overlapping CIDRs: what works and what doesn't", back: "PrivateLink works (no routed path needed — overlap irrelevant). Private NAT gateway translation works for stubborn flows. VPC peering: rejected outright. TGW: cannot route identical prefixes in one route domain." },
    { front: "Centralized inspection with Transit Gateway — three ingredients", back: "Inspection VPC (Network Firewall or appliances behind GWLB), TGW route tables steering spoke-to-spoke and egress through it, and <strong>appliance mode</strong> on the inspection attachment for flow symmetry through stateful devices." },
    { front: "Resilient Direct Connect design", back: "Two (or more) circuits at <strong>different DX locations</strong> (facility diversity), BGP/BFD for fast failover, and a tested Site-to-Site VPN as last resort. Same-location dual circuits are the planted exam flaw. VPN tunnel ceiling ~1.25 Gbps; ECMP to scale." },
    { front: "Compromised EC2 instance — evidence-preserving containment order", back: "Detach from ASG → isolation security group (no rules) → EBS snapshots (and memory capture if possible) → copy evidence to a locked forensics account → rebuild from clean IaC. Never terminate or reboot first — both destroy evidence." },
    { front: "Compromised IAM credentials — containment beyond the key", back: "Deactivate the key, attach explicit deny, revoke active STS sessions (deny tokens issued before now), then hunt persistence: users/keys/roles/trust-policy edits created by that principal in CloudTrail. Don't delete the principal — you lose attribution." },
    { front: "Auto-containment pipeline for GuardDuty findings", back: "Delegated admin GuardDuty org-wide → findings to EventBridge (filtered by type/severity) → Lambda/Step Functions runbooks (quarantine SG, snapshot, deny policy) → notify. Auto-contain machines aggressively; gate identity containment behind a human." },
    { front: "Why SCPs for tamper-proof logging, not IAM policies?", back: "Account admins can edit their own IAM policies; an SCP applied from the org binds every principal in member accounts including admins. Deny cloudtrail:StopLogging/UpdateTrail/DeleteTrail. SCPs never grant, don't bind the management account." },
    { front: "Safe SCP rollout (no audit mode exists)", back: "Simulate with CloudTrail/Access Analyzer usage mining → canary OU (sandbox) → expand OU by OU with rollback plan. Never attach a new deny at org root first. SCPs hit service roles and scheduled jobs nobody remembers." },
    { front: "NAT gateway cost triage", back: "S3/DynamoDB via NAT → free gateway endpoints (route-table change). Heavy AWS-API/ECR traffic → interface endpoints (~1c/GB beats NAT's 4.5c/GB). Cross-AZ hairpins → NAT per AZ. The NAT bill is a routing critique, not a price to negotiate." },
    { front: "Architecture fix vs discounting fix — and the order", back: "Architecture fixes change usage (endpoints, AZ-locality, rightsizing, scheduling, storage class); discounting fixes change unit price (SPs/RIs/Spot). Always waste-out and rightsize FIRST — commitments sized on a wasteful baseline lock the waste in." },
    { front: "Compute Savings Plans vs EC2 Instance SPs/Standard RIs", back: "Compute SP: EC2+Fargate+Lambda, any family/region/architecture — survives Graviton and container moves; up to ~66%. EC2 Instance SP / Standard RI: deeper (up to ~72%) but family-locked — only for truly pinned workloads. Uncertain shape → flexibility wins." },
    { front: "Cost numbers worth memorizing", back: "NAT processing 4.5c/GB; inter-AZ 1c/GB each direction; interface endpoint ~1c/GB + hourly; CloudWatch Logs ingestion ~50c/GB; Spot up to ~90% off; gp3 ~20% under gp2. Small rates × big bytes = the bill." },
    { front: "Strangler fig traffic control — why ALB weighted target groups over DNS", back: "ALB weights shift instantly and revert instantly (a rule change); Route 53 weighted records are hostage to resolver caching. Facade first, extract by business capability, canary percentages, rollback = weight change." },
    { front: "Transactional outbox — problem and mechanics", back: "Solves dual-write divergence: event row commits in the SAME transaction as state; a relay (poller or CDC) publishes at-least-once; consumers are idempotent. Any 'write then publish' two-step without it is the bug." },
    { front: "Write-path cutover safety in DB decomposition", back: "Configure REVERSE CDC replication before cutting writes over — falling back must not mean data loss. Dual-run with reconciliation (counts, checksums, business diffs) before, during, and after. No reverse path = no real rollback option." },
    { front: "DR strategy ladder with cost shape", back: "Backup & restore (hours-days RTO, +1–5%) → pilot light (data live, compute dark, ~hours, +5–15%) → warm standby (scaled-down LIVE stack, ~minutes-hour, +20–40%) → active-active (~zero, +60–100%). Exam grades 'cheapest that meets the stated RTO/RPO'." },
    { front: "Pilot light vs warm standby — the vocabulary boundary", back: "Pilot light: data replicates continuously, compute exists but is off/zero — recovery = promote + scale from nothing. Warm standby: a small but RUNNING copy serving health checks — recovery = scale up. 'Running' is the discriminator the exam tests." },
    { front: "Elastic Disaster Recovery (DRS) — when it's the answer", back: "'Low RTO (minutes) and sub-second RPO without re-architecting': continuous block-level replication to a cheap staging area, launch recovery instances on failover. CloudEndure's successor; MGN's sibling aimed at DR instead of migration." },
    { front: "What makes DR evidence auditor-grade?", back: "Recurring measured tests: automated backup restore testing, scheduled game-days, scorecards of declared vs achieved RTO/RPO with gaps and owners. Documentation and sign-offs attest intent, not capability." },
    { front: "Hidden DR program killers", back: "Shared platform services (auth, DNS, CI/CD) left single-region under Tier-1 apps; default quotas and no capacity assurance in the recovery region; stale AMIs/configs in pilot light. Fix: platform services inherit the top tier; pre-raise quotas; deploy continuously (dark) to the DR region." },
    { front: "Portfolio DR — the meta-heuristic", back: "Tier by business impact (BIA), assign RTO/RPO per tier, apply the cheapest strategy meeting each tier, publish per-tier cost to prevent tier inflation. Any uniform one-size DR answer for a large portfolio is wrong on cost or wrong on risk." }
  ],
  lab: {
    title: "Whiteboard exercise: dissect an unseen scenario with the six-shape method",
    html: `
<h3>Goal</h3>
<p>Internalize the dissection method used in this module so it runs automatically at exam speed. You will take one unseen scenario, run the full pipeline — requirements extraction, candidate architectures, trade-off table, chosen design, trap prediction — on paper or a whiteboard, in 35 minutes. No AWS account is used and nothing is deployed.</p>

<h3>The scenario (do not read ahead to the checklist)</h3>
<p>A national healthcare provider runs a patient-portal monolith and 30 supporting services in one region. A new regulation requires: patient data encrypted with customer-managed keys, all access logged immutably for 7 years, and a demonstrated ability to recover the portal within 1 hour (RPO 5 minutes) from a regional failure. The portal must also absorb a 10x traffic spike during open-enrollment month. Budget allows roughly a 25% run-rate increase. The security team must approve all cross-account access patterns, and two of the supporting services are vendor black boxes on EC2 that cannot be modified.</p>

<h3>Steps</h3>
<ol>
<li><p><strong>(5 min) Requirements extraction.</strong> Draw the four-row table from this module: functional, RTO/RPO, compliance, cost — plus a constraints row. Every phrase in the scenario lands in exactly one cell. Flag the numbers: 1 h RTO, 5 min RPO, 7-year immutable logs, 10x seasonal spike, +25% budget cap, two unmodifiable services.</p></li>
<li><p><strong>(5 min) Classify the shape.</strong> Which of the six scenario shapes is this closest to? (It is a hybrid: tiered-DR shape F with a security/compliance C overlay and a seasonal-scaling twist.) Write down which lessons' decision heuristics apply before designing anything.</p></li>
<li><p><strong>(10 min) Three candidates, one table.</strong> Sketch: (a) backup-and-restore only; (b) pilot light with continuous data replication; (c) warm standby. Score each against the extracted numbers in a trade-off table: RTO achievable, RPO achievable, cost delta, handling of the two black-box services (hint: which DR tool from this module handles unmodifiable EC2 workloads with sub-second RPO?), and the compliance overlay (CMK strategy, org trail with object lock, 7-year retention).</p></li>
<li><p><strong>(5 min) Choose and justify.</strong> One paragraph: which candidate, and — critically — which <em>per-component exceptions</em> you make (the portal vs the 30 services vs the black boxes do not all deserve the same tier). State what the 25% budget buys and what it explicitly does not.</p></li>
<li><p><strong>(10 min) Predict the exam.</strong> Write four plausible wrong answers an examiner would plant for this scenario and one sentence each on why a rushed candidate picks them. Good traps to reproduce: a same-region Multi-AZ answer dressed as DR; an active-active answer that blows the budget cap; a backup-only answer that misses the 5-minute RPO; an encryption answer that ignores key-location vs data-location.</p></li>
</ol>

<h3>Verify</h3>
<ul>
<li>Your requirements table has every number from the scenario placed, none invented.</li>
<li>Your chosen design tiers components differently (portal ≠ internal services ≠ black boxes) rather than applying one strategy uniformly — the meta-heuristic of scenario F.</li>
<li>The black boxes are covered by Elastic Disaster Recovery (continuous block replication, no modification needed) — if you re-architected them, re-read the constraint row.</li>
<li>Your four trap answers each violate exactly one extracted requirement — that is how real SAP-C02 distractors are built.</li>
<li>Total time under 40 minutes. On the exam this compresses to under 3 minutes; the pipeline is the same, run smaller.</li>
</ul>

<h3>Teardown</h3>
<p>Nothing to tear down — this exercise creates no AWS resources. Erase the whiteboard, keep the method.</p>
`
  }
});
