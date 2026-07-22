/* Intuition builders — SAP-track + AI modules.
 * One registerExplainer per module; four fixed levels per explainer. */
"use strict";

/* ---------------- 1. security-services: envelope encryption ---------------- */
window.COURSE.registerExplainer({
  id: "security-services-intuition",
  moduleId: "security-services",
  title: "Envelope encryption: lockboxes inside a vault that never opens",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>Imagine a bank with one enormous master key locked inside its vault. The rule is absolute: <strong>that key never, ever leaves the vault</strong>. Not for the president, not for the police, not for you.</p>" +
        "<p>So how do you protect your valuables? The bank hands you a small lockbox and a fresh little key for it. You lock your things in the box, and here is the trick: the teller takes your little key into the vault, seals it inside an envelope that only the master key can open, hands the sealed envelope back, and you <em>destroy the plain copy</em>. You tape the sealed envelope to the box and store both wherever you like — even at home.</p>" +
        "<p>To open the box later, you bring just the envelope to the bank. Inside the vault it gets unsealed, you use the little key for a moment, then destroy it again. Millions of boxes, millions of envelopes, one master key that no thief can ever steal — because it never travels.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>Map it straight across:</p>" +
        "<ul>" +
        "<li>The <strong>vault</strong> is KMS. The <strong>master key</strong> is a KMS key: it is created inside KMS and can never be exported in plaintext.</li>" +
        "<li>The <strong>little lockbox key</strong> is a <em>data key</em>. You call <code>GenerateDataKey</code> and KMS returns two things at once: the plaintext data key and the same key encrypted under the KMS key (the sealed envelope).</li>" +
        "<li>You encrypt your file locally with the plaintext data key, then <strong>throw the plaintext key away</strong>. You store the encrypted data key right next to the ciphertext — that is why it is called <em>envelope</em> encryption.</li>" +
        "<li>To read the file, you send the encrypted data key to <code>kms:Decrypt</code>. KMS unwraps it inside the vault, hands back the plaintext key, you decrypt, and discard it again.</li>" +
        "</ul>" +
        "<p>S3, EBS, RDS, and DynamoDB all do exactly this dance under the hood when you enable KMS encryption — one data key per object or volume, one shared master key that never moves.</p>"
    },
    {
      name: "How it actually works",
      html:
        "<p>The KMS key material lives in FIPS-validated hardware security modules; every cryptographic operation happens inside them. The direct <code>Encrypt</code> API is capped at <strong>4 KB of payload</strong> — that limit is the whole reason envelope encryption exists. Anything bigger uses a locally generated AES-256-GCM data key.</p>" +
        "<p>Access is governed by <em>two</em> gates that must both open: the <strong>key policy</strong> (resource-based, lives on the key) and the caller's IAM policy. AWS services like EBS use <strong>grants</strong> — temporary, scoped permissions — so a stopped-and-started instance can re-decrypt its volume key without you in the loop.</p>" +
        "<p>Automatic <strong>key rotation</strong> swaps the backing material yearly but keeps every previous version, so old ciphertext still decrypts; the key ID never changes and existing data keys are <em>not</em> re-wrapped. An <strong>encryption context</strong> (key-value pairs used as authenticated data) can bind a ciphertext to its purpose — decryption fails if the context does not match, and it appears in CloudTrail, which logs every single <code>Decrypt</code> call for audit.</p>" +
        "<p>For S3 at scale, <strong>S3 Bucket Keys</strong> insert an intermediate key so millions of objects do not each hammer the KMS API.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<p>Where it bites:</p>" +
        "<ul>" +
        "<li><strong>Deleting a KMS key is a kill switch.</strong> After the 7-to-30-day waiting period, every envelope sealed by it becomes permanently unopenable — all dependent data is cryptographically shredded. That is a feature (crypto-shredding) and a catastrophic footgun.</li>" +
        "<li><strong>Cross-account use needs both gates:</strong> the key policy must allow the external account <em>and</em> the caller needs IAM permission. One without the other fails.</li>" +
        "<li><strong>Imported key material (BYOK)</strong> cannot be auto-rotated and can expire; CloudHSM-backed custom key stores shift availability risk to you.</li>" +
        "<li>KMS keys are <strong>regional</strong>. Multi-Region keys are synchronized copies with the same material, not one global key — useful for cross-Region decryption without re-encrypting.</li>" +
        "<li>The analogy lies in one place: the bank remembers nothing. KMS stores <em>no</em> data keys and no record of your boxes — it just unwraps whatever valid envelope is presented. Anyone with <code>kms:Decrypt</code> on that key is a teller. Guard that permission, not the ciphertext.</li>" +
        "</ul>" +
        "<p><strong>exam reflex:</strong> encrypting data larger than 4 KB with KMS means <code>GenerateDataKey</code> and envelope encryption — never the raw <code>Encrypt</code> API.</p>"
    }
  ]
});

/* ---------------- 2. observability: metrics vs logs vs traces vs audit ---------------- */
window.COURSE.registerExplainer({
  id: "observability-intuition",
  moduleId: "observability",
  title: "Metrics, logs, traces, audit: four instruments, four questions",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>Picture a parcel delivery company with a fleet of trucks. It watches its world through four completely different instruments:</p>" +
        "<ul>" +
        "<li><strong>Dashboard gauges</strong> in every truck: speed, fuel, engine temperature. Cheap little numbers, glanceable, updated constantly. They tell you <em>that</em> something is wrong — the temperature needle is in the red — never <em>why</em>.</li>" +
        "<li><strong>The driver's diary</strong>: every event written down in order — hit traffic at 9:12, customer refused package, engine rattled on the hill. Rich detail, but you have to sit down and read it after the fact.</li>" +
        "<li><strong>A GPS tag on one parcel</strong>: it rides along through every handoff — depot, truck, sorting belt, van — and shows exactly where that one parcel sat waiting for forty minutes.</li>" +
        "<li><strong>The security camera in the key room</strong>: it records who took which truck's keys, and when. Nobody watches it live; you pull the tape when something goes missing.</li>" +
        "</ul>" +
        "<p>Four instruments, four questions: is something wrong, why, where in the chain, and who did it.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>Each instrument is a different AWS service, and picking the right one is usually the whole question:</p>" +
        "<ul>" +
        "<li><strong>Gauges = CloudWatch Metrics.</strong> Numeric time series (CPU, latency, queue depth). Alarms watch a gauge and act when it crosses a line. Answers: <em>is something wrong right now?</em></li>" +
        "<li><strong>Diary = CloudWatch Logs.</strong> Timestamped text from apps and services, organized into log groups; you search it with Logs Insights. Answers: <em>why did it go wrong?</em></li>" +
        "<li><strong>GPS tag = X-Ray.</strong> One request carries a trace ID across API Gateway, Lambda, DynamoDB and friends; the service map shows where the time went. Answers: <em>where in the chain is it slow?</em></li>" +
        "<li><strong>Security camera = CloudTrail.</strong> A record of API calls — who called what, from where, when. Answers: <em>who did it?</em></li>" +
        "</ul>" +
        "<p>They compose: a metric alarm tells you the engine is hot, logs tell you why, a trace shows which leg of the journey overheated, and CloudTrail tells you who changed the routing last night.</p>"
    },
    {
      name: "How it actually works",
      html:
        "<p><strong>Metrics</strong> are pre-aggregated statistics, not raw events: standard resolution is one minute, high resolution one second, and data ages into coarser rollups over 15 months. Alarms evaluate N datapoints over M periods — the datapoints-to-alarm setting is how you stop flapping. The <strong>CloudWatch agent</strong> is required for anything inside the OS (memory, disk) because the hypervisor cannot see it. <strong>Metric filters</strong> turn diary entries into gauges — count ERROR lines into a metric and alarm on it.</p>" +
        "<p><strong>Logs</strong> bill mostly on ingestion, so volume discipline matters; subscription filters can stream them to Kinesis or Lambda in near real time.</p>" +
        "<p><strong>X-Ray</strong> samples rather than records everything — by default the first request each second plus five percent of the rest — and propagates a trace header downstream; each hop reports segments and subsegments.</p>" +
        "<p><strong>CloudTrail</strong> records management events (control-plane calls) by default with 90 days of event history free; <em>data events</em> — S3 object reads, Lambda invocations — are off by default and cost extra. An organization trail captures every account into one S3 bucket, with log file validation to prove nothing was doctored.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<p>The classic traps live in the gaps between instruments:</p>" +
        "<ul>" +
        "<li><strong>CloudTrail is not real time.</strong> Delivery to S3 typically lags by minutes. Never pick it for latency alerting — the camera tape is for investigations, not for driving.</li>" +
        "<li><strong>The camera only films the key room.</strong> CloudTrail records API calls, not data-plane activity, unless you explicitly enable data events. Who read this S3 object requires data events turned on <em>beforehand</em>.</li>" +
        "<li><strong>X-Ray samples</strong>, so it is never an audit or a complete record — the GPS tag rides on some parcels, not all.</li>" +
        "<li><strong>Metrics cannot explain.</strong> A gauge with no diary behind it leaves you guessing; conversely, grepping logs for what a metric alarm would catch is slow and expensive.</li>" +
        "<li>The analogy breaks on cost: real gauges are free to glance at, but custom metrics, log ingestion, and data events each carry real per-unit prices — high-cardinality custom metrics are a known bill inflator.</li>" +
        "</ul>" +
        "<p><strong>exam reflex:</strong> who made this API call means CloudTrail; why is it slow across services means X-Ray; OS-level memory or disk means CloudWatch agent.</p>"
    }
  ]
});

/* ---------------- 3. cost: find every meter before you buy ---------------- */
window.COURSE.registerExplainer({
  id: "cost-intuition",
  moduleId: "cost",
  title: "Every service bills on 2-4 meters — find them before you buy",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>You rent a house. The listing shows one friendly number — the rent — and you sign. Then the first month's mail arrives: an electricity bill from a meter spinning in the basement, a water bill from a dial under the porch, a fixed trash-collection fee, and a sewage charge you never saw coming because it is <em>calculated from the water meter</em>.</p>" +
        "<p>Nobody lied to you. Every one of those meters was on the property the whole time; you just never walked around and looked.</p>" +
        "<p>Experienced renters do the walk before signing: find every meter, ask which ones spin even when the house is empty (the trash fee ticks whether or not you produce trash) and which spin with use. Almost every house has two to four meters — never just one.</p>" +
        "<p>Cloud services are houses. The headline price is the rent. The surprises are the other meters, and the biggest surprise is always the one derived from another meter you were not watching.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>Every AWS service bills on a handful of meters — usually two to four. Learn to name them before deploying:</p>" +
        "<ul>" +
        "<li><strong>S3:</strong> storage (GB-month), requests (per 1,000), data transfer out, and — for the colder tiers — retrieval per GB.</li>" +
        "<li><strong>Lambda:</strong> invocations and GB-seconds of compute duration.</li>" +
        "<li><strong>DynamoDB:</strong> read units, write units, storage.</li>" +
        "<li><strong>NAT Gateway:</strong> hours <em>and</em> GB processed — it spins while the house is empty and again with every liter of water.</li>" +
        "</ul>" +
        "<p>The universal sewage charge is <strong>data transfer</strong>: derived from usage elsewhere, itemized separately, and the most common bill surprise in real accounts.</p>" +
        "<p>The one question that sorts every meter: <em>does it spin when idle, or only when used?</em> Hourly meters (NAT Gateway, ALB, provisioned RDS, EBS volumes) charge for existing. Usage meters (Lambda, S3 requests, on-demand DynamoDB) charge for activity. Idle-heavy workloads want usage meters; steady-heavy workloads want hourly meters with commitment discounts.</p>"
    },
    {
      name: "How it actually works",
      html:
        "<p>The meters are not metaphorical — they are literal <strong>usage types</strong> in the billing pipeline. Open Cost Explorer and group by usage type and you will see them by name: DataTransfer-Out-Bytes, NatGateway-Hours, TimedStorage-ByteHrs. The <strong>Cost and Usage Report</strong> is the raw meter-reading ledger, one line per resource per meter per hour, queryable with Athena.</p>" +
        "<p>Attribution runs on <strong>cost allocation tags</strong> — untagged resources are meters with no name on the mailbox, so tag discipline is a governance problem, not an accounting one. <strong>Budgets</strong> alarm on forecasted or actual spend; <strong>Cost Anomaly Detection</strong> watches for a meter suddenly spinning faster than its history.</p>" +
        "<p>Commitments discount specific meters only: <strong>Savings Plans and Reserved Instances</strong> prepay the compute-hours meter and touch nothing else — your S3 requests and data transfer are untouched by them.</p>" +
        "<p>Meter analysis drives architecture: a NAT Gateway pushing S3 traffic pays per GB processed, while a <strong>gateway VPC endpoint</strong> for S3 is free — same traffic, different meter. DynamoDB on-demand versus provisioned is a pure break-even calculation between a usage meter and an hourly one. ALB hides four sub-meters inside one LCU: connections, requests, bandwidth, and rule evaluations — you pay whichever dimension is highest.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<p>Where meters ambush even careful people:</p>" +
        "<ul>" +
        "<li><strong>Cross-AZ transfer is charged in both directions</strong> — chatty microservices spread across AZs pay a tax per conversation, per direction.</li>" +
        "<li><strong>Cold tiers have hidden meters:</strong> Glacier tiers carry retrieval fees plus minimum storage durations (90 or 180 days) — early deletion bills the remainder. Lifecycle transitions themselves cost per 1,000 requests, so transitioning millions of tiny objects to save on storage can cost more than it saves.</li>" +
        "<li><strong>The exit route changes the price:</strong> data leaving via CloudFront is cheaper than the same bytes leaving S3 directly — the same water through a different pipe.</li>" +
        "<li><strong>Meters interact.</strong> Optimizing one can spin another: compressing objects cuts the storage meter but adds compute; caching cuts request meters but adds an hourly cache fee.</li>" +
        "</ul>" +
        "<p>The analogy lies in visibility: house meters are bolted to the wall where you can walk up and read them, while AWS meters reveal themselves only in pricing pages before launch and in Cost Explorer after. There is no walk-around unless you deliberately do it — that discipline is the skill.</p>" +
        "<p><strong>exam reflex:</strong> on any cost question, first identify which meter dominates — hours, storage, requests, or transfer — then pick the option that shrinks <em>that</em> meter.</p>"
    }
  ]
});

/* ---------------- 4. multi-account: fire doors and building codes ---------------- */
window.COURSE.registerExplainer({
  id: "multi-account-intuition",
  moduleId: "multi-account",
  title: "Accounts as fire doors, SCPs as building codes",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>An old factory is one giant open hall. One dropped cigarette in the paint corner and the whole building burns — workshop, archive, payroll office, everything.</p>" +
        "<p>A modern building is built as <strong>fire compartments</strong>: concrete walls and heavy fire doors between sections. A blaze in the kitchen stays in the kitchen. The damage a single accident can do is capped by the walls around it.</p>" +
        "<p>Above all the rooms sits the <strong>city building code</strong>. It works in a peculiar way: it never grants anyone anything. No code says <em>you may cook</em> — the restaurant manager decides that. The code only <em>forbids</em>: no propane storage above the ground floor, no welding in the archive, ever, no matter who approves it. A manager can hand an employee every key in the building, and the code still stops the welding.</p>" +
        "<p>Two separate ideas, then: walls cap the <em>spread</em> of damage; codes cap what is <em>possible</em> inside each room, regardless of local permission.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>The mapping:</p>" +
        "<ul>" +
        "<li>An <strong>AWS account</strong> is a fire compartment. It is the hard boundary for security blast radius, for billing, and for service quotas. A compromised key, a runaway bill, an exhausted limit — all stop at the account wall.</li>" +
        "<li><strong>AWS Organizations</strong> is the building; <strong>organizational units (OUs)</strong> are floors and wings that group compartments — production wing, sandbox wing, security wing.</li>" +
        "<li><strong>Service control policies (SCPs)</strong> are the building code. They attach to OUs or accounts and set the <em>maximum</em> of what is possible inside. Crucially, <strong>an SCP never grants a permission</strong> — an SCP allowing <code>s3:*</code> gives nobody access to anything.</li>" +
        "<li><strong>IAM inside each account</strong> is the room manager handing out keys. Effective permission is the <em>intersection</em>: IAM must grant it AND every SCP above must allow it.</li>" +
        "</ul>" +
        "<p>The <strong>management account</strong> is the building owner's office — it creates the org, holds the master billing, and (memorably) the building code does not apply to it.</p>"
    },
    {
      name: "How it actually works",
      html:
        "<p>SCP evaluation is a filter that runs <em>before</em> IAM: for a request to succeed, the action must be allowed at <strong>every level of the OU path</strong> from root down to the account — root SCPs, then each OU's, then the account's. Every new org attaches <code>FullAWSAccess</code> by default; remove it and you have an allow-list regime where anything unlisted is denied. An <strong>explicit deny anywhere in the path wins over everything</strong>, which is why deny-list SCPs (deny leaving the approved regions, deny disabling CloudTrail, deny root-user actions) are the common pattern.</p>" +
        "<p>SCPs bind <em>principals in member accounts</em> — including, remarkably, the <strong>root user</strong> of member accounts, making SCPs one of the only mechanisms that can restrain root. They do not apply to service-linked roles, and they do not apply to the management account at all — which is precisely why best practice keeps the management account empty of workloads.</p>" +
        "<p>Around the compartments: <strong>Control Tower</strong> automates building the wings with guardrails pre-applied; <strong>IAM Identity Center</strong> gives humans one front door with per-compartment badges; consolidated billing aggregates every meter, and Reserved Instance and Savings Plan discounts float across compartments to wherever the matching usage runs.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<p>Where candidates get burned:</p>" +
        "<ul>" +
        "<li><strong>SCPs do not touch the management account.</strong> A guardrail question that assumes the management account is constrained is a trap; the fix is to run nothing there.</li>" +
        "<li><strong>SCPs grant nothing.</strong> Any option that grants access to something via an SCP is wrong by definition. Grants come from IAM or resource policies only.</li>" +
        "<li><strong>Windows in the fire wall:</strong> the compartment analogy hides that resource-based policies (an S3 bucket policy, a KMS key policy) can invite principals from <em>other</em> accounts straight through the wall. Fire doors do not model cross-account resource sharing — that is why the exam pairs SCPs with data-perimeter conditions like <code>aws:PrincipalOrgID</code> to brick those windows shut.</li>" +
        "<li><strong>Inheritance is intersection, not union:</strong> an allow at the OU does not help if the root-level SCP lacks it. Every level must allow.</li>" +
        "<li>Practical limits exist — a handful of SCPs per node and a size cap per policy — so codes must be written tersely.</li>" +
        "</ul>" +
        "<p><strong>exam reflex:</strong> prevent any account in the org from doing X means an SCP with an explicit deny attached at the root or OU.</p>"
    }
  ]
});

/* ---------------- 5. adv-networking: Transit Gateway as the airport hub ---------------- */
window.COURSE.registerExplainer({
  id: "adv-networking-intuition",
  moduleId: "adv-networking",
  title: "Transit Gateway: the airport hub; route tables as boarding passes",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>In the early days of flying, airlines flew point-to-point: a separate direct route between every pair of cities. Ten cities that all want to reach each other need <strong>forty-five separate routes</strong>. Add an eleventh city and you must negotiate ten new ones. It does not scale, and there are no connections — a ticket from A to B strictly flies A to B; you cannot hop through C.</p>" +
        "<p>Then came the <strong>hub airport</strong>. Every city flies one route to the hub; the hub connects everything to everything. Ten cities, ten routes. A new city joins by opening a single route to the hub.</p>" +
        "<p>But a hub is not a free-for-all. At check-in you get a <strong>boarding pass</strong>, and it lists exactly which onward connections you may take. Two passengers can stand at the same hub, and one may board the flight to the data-center city while the other is turned away at the gate. Whoever prints the boarding passes controls the entire network — quietly, completely.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>Translate the airport:</p>" +
        "<ul>" +
        "<li><strong>Point-to-point routes = VPC peering.</strong> A direct, pairwise link — and strictly <em>non-transitive</em>: if A peers with B and B peers with C, A still cannot reach C through B. No connections through an intermediate city, ever.</li>" +
        "<li><strong>The hub = Transit Gateway (TGW).</strong> VPCs, Site-to-Site VPNs, and Direct Connect gateways all <em>attach</em> to it once, and the hub routes between them.</li>" +
        "<li><strong>Boarding passes = TGW route tables.</strong> Each attachment is <em>associated</em> with exactly one TGW route table — that table is its boarding pass, listing every destination it may fly to. Separately, an attachment can <em>propagate</em> its own routes into tables — that is being listed on the departure board so others can fly to you.</li>" +
        "</ul>" +
        "<p>Segmentation falls out naturally: give production VPCs one route table and development another, and dev can reach shared services but never production — same hub, different passes. Ten VPCs full-mesh would need 45 peerings; with TGW it is ten attachments.</p>"
    },
    {
      name: "How it actually works",
      html:
        "<p>A VPC attachment places a TGW <strong>elastic network interface in one subnet per AZ</strong> you enable — traffic from an AZ enters the hub through that AZ's ENI, so you must attach a subnet in every AZ that has workloads. The two verbs do all the work: <strong>association</strong> (one route table per attachment — which pass you hold) and <strong>propagation</strong> (attachment CIDRs auto-populate chosen tables — which departure boards list you). Static routes and <strong>blackhole routes</strong> let you override or drop traffic deliberately.</p>" +
        "<p>Shared across an organization with <strong>AWS RAM</strong>, one hub serves attachments from many accounts — the classic network-account pattern. <strong>Inter-Region TGW peering</strong> connects hubs over the AWS backbone, encrypted, but exchanges <em>no</em> dynamic routes: you write static routes on both sides. <strong>ECMP across VPN tunnels</strong> aggregates bandwidth beyond a single tunnel's ~1.25 Gbps. <strong>Appliance mode</strong> pins a flow's two directions through the same AZ so a stateful firewall in an inspection VPC sees both halves of the conversation.</p>" +
        "<p>Billing is the airport's landing fees: an hourly charge per attachment plus a per-GB data processing charge on everything that transits the hub.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<p>The classic traps:</p>" +
        "<ul>" +
        "<li><strong>Peering is non-transitive</strong> — any answer that routes traffic <em>through</em> a peered VPC is wrong. Hub-through-a-spoke does not exist.</li>" +
        "<li><strong>Overlapping CIDRs stay broken.</strong> A hub cannot serve two cities with identical names: two attached VPCs with the same CIDR cannot both be routed. TGW does not NAT; you need private NAT or re-IP.</li>" +
        "<li><strong>TGW peering carries no propagation</strong> — forget the static routes on either side and traffic silently blackholes.</li>" +
        "<li><strong>Cost crossover:</strong> for two or three VPCs pushing heavy traffic, peering (no hourly fee, no processing fee) beats TGW. The hub wins on scale and manageability, not on price.</li>" +
        "<li>An attachment only reaches AZs where you enabled a subnet — a workload in an unattached AZ has no gate to the hub.</li>" +
        "</ul>" +
        "<p>The analogy lies at the gate: boarding passes are per-passenger, but a TGW route table is <strong>per-attachment</strong> — every instance in a VPC holds the identical pass. Per-workload discrimination needs security groups, NACLs, or an inspection VPC, not TGW routing.</p>" +
        "<p><strong>exam reflex:</strong> many VPCs plus hybrid connectivity plus transitive routing means Transit Gateway; exactly two VPCs at lowest cost means VPC peering.</p>"
    }
  ]
});

/* ---------------- 6. devops-iac: blueprint and the demolition-order problem ---------------- */
window.COURSE.registerExplainer({
  id: "devops-iac-intuition",
  moduleId: "devops-iac",
  title: "CloudFormation: a blueprint, a contractor, and the demolition-order problem",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>You do not build a house by shouting instructions at workers one at a time. You hand an architect's <strong>blueprint</strong> to a <strong>general contractor</strong>. The blueprint describes the finished building — it does not say <em>in which order</em> to build. The contractor works that out: foundation before walls, walls before roof, wiring before drywall. When done, the contractor keeps a signed copy of exactly what was built.</p>" +
        "<p>Want a change? You do not grab a hammer. You revise the blueprint, and the contractor compares it to the signed copy, quotes you the difference — <em>this wall moves, that window is replaced</em> — and renovates.</p>" +
        "<p>The underrated hard part is <strong>demolition</strong>. Tearing down runs in reverse order: roof before walls before foundation. And a decent contractor flat-out refuses to demolish a room that still has your belongings in it — the crew stops, the half-demolished building stands there, and someone has to make a decision.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>The mapping:</p>" +
        "<ul>" +
        "<li><strong>Template = blueprint.</strong> A declarative description of desired resources — never a script of steps.</li>" +
        "<li><strong>Stack = the built house</strong> plus the contractor's signed copy of what exists.</li>" +
        "<li><strong>Dependency order is inferred:</strong> every <code>Ref</code> and <code>GetAtt</code> says <em>this wall needs that foundation</em>; CloudFormation builds dependents after dependencies and independent resources in parallel. <code>DependsOn</code> is the handwritten note for orderings the drawings do not show.</li>" +
        "<li><strong>Change set = the renovation quote.</strong> A preview of exactly what an update will add, modify, or replace — reviewed before any work starts.</li>" +
        "<li><strong>Stack deletion = demolition</strong>, automatically in reverse dependency order.</li>" +
        "<li><strong>DeletionPolicy</strong> is the note taped to a door: <code>Retain</code> means leave this room standing when the house comes down; <code>Snapshot</code> means photograph the contents first (RDS, EBS).</li>" +
        "</ul>" +
        "<p>And the refusal? A non-empty S3 bucket is the room full of your belongings: deletion stops, the stack sits in a failed state, and you decide.</p>"
    },
    {
      name: "How it actually works",
      html:
        "<p>CloudFormation builds a <strong>dependency graph</strong> from intrinsic references and walks it — parallelizing wherever branches are independent, which is why flat templates deploy faster than reference-chained ones.</p>" +
        "<p>Updates come in three severities per resource, documented per property: <strong>no interruption</strong>, <strong>some interruption</strong>, and <strong>replacement</strong>. Replacement is the one to fear: CloudFormation creates a <em>new</em> physical resource, repoints references, and deletes the old one during cleanup — a new physical ID, and data on the old resource gone. Renaming certain properties (like an explicit resource name) forces replacement, and the create-new-first order collides with unique-name constraints.</p>" +
        "<p>On failure mid-update the stack <strong>rolls back</strong> to the previous state automatically. <strong>Drift detection</strong> compares the signed copy against reality and reports out-of-band manual edits. <strong>Stack policies</strong> protect named resources from accidental update; <strong>custom resources</strong> (Lambda-backed) extend the blueprint language to anything with an API.</p>" +
        "<p>Scale-out is two different tools: <strong>nested stacks</strong> decompose one big blueprint into referenced sub-blueprints within a single deployment; <strong>StackSets</strong> stamp the same blueprint across many accounts and Regions from one operation — the franchise model, one drawing built in every city.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<p>Where real pain lives:</p>" +
        "<ul>" +
        "<li><strong>Replacement equals data loss</strong> on stateful resources. An innocent property change on an RDS instance can silently mean new database, old one deleted. The exam answer is DeletionPolicy or UpdateReplacePolicy of Snapshot/Retain on anything stateful, and reading change sets before executing.</li>" +
        "<li><strong>DELETE_FAILED is routine:</strong> non-empty buckets, ENIs still attached, dependencies created outside the stack. Options: fix and retry, or delete while retaining the blocking resource.</li>" +
        "<li><strong>Drift is the contractor's copy going stale.</strong> Manual console edits are invisible to CloudFormation until drift detection runs, and the next update may clobber them or fail confusingly.</li>" +
        "<li><strong>UPDATE_ROLLBACK_FAILED</strong> strands a stack until you skip the unrollable resources — a state worth recognizing on sight.</li>" +
        "</ul>" +
        "<p>The analogy's big lie: a contractor you could call anytime, but CloudFormation is <strong>not a reconciliation loop</strong>. It acts only when handed a blueprint; between operations nobody watches the building. Continuous enforcement is Config rules or controls — not CloudFormation.</p>" +
        "<p><strong>exam reflex:</strong> deploy the same template across many accounts and Regions means StackSets; preview an update's blast radius means change sets.</p>"
    }
  ]
});

/* ---------------- 7. migration-pro: moving a hospital without closing the ER ---------------- */
window.COURSE.registerExplainer({
  id: "migration-pro-intuition",
  moduleId: "migration-pro",
  title: "Enterprise migration: moving a hospital without closing the ER",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>Moving a hospital to a new building is nothing like moving a house, for one reason: <strong>you cannot close</strong>. Patients keep arriving every hour of the move.</p>" +
        "<p>So nobody moves a hospital in one weekend. First you <strong>inventory every department</strong> — and discover the truth: some equipment can be wheeled across town as-is, some should be replaced with newer models on arrival, some is obsolete and goes to the dumpster, the giant MRI is bolted to the floor and stays for now, and one department is better served by outsourcing to a specialist clinic than by moving at all.</p>" +
        "<p>Before anyone moves, the new building gets its <strong>utilities, security desks, and safety rules</strong> working. Then departments move in <strong>waves</strong> — the records archive first, low risk; wards later. For a while both buildings run in parallel, with ambulances routed gradually toward the new address. The <strong>ER moves last</strong>, on a rehearsed night, with everything drilled in advance.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>Every phase has a service:</p>" +
        "<ul>" +
        "<li><strong>Inventory = discovery.</strong> Application Discovery Service and Migration Evaluator map what exists, what talks to what, and what it costs.</li>" +
        "<li><strong>The per-department decision = the 7 Rs:</strong> <em>rehost</em> (wheel the bed across as-is), <em>replatform</em> (same patient, better bed on arrival — e.g. onto RDS), <em>refactor</em> (a new course of treatment — rebuild cloud-native), <em>repurchase</em> (switch to SaaS), <em>retire</em> (the dumpster), <em>retain</em> (bolted down, stays for now), <em>relocate</em> (VMware moved wholesale).</li>" +
        "<li><strong>Utilities first = the landing zone.</strong> Control Tower sets up accounts, networking, and guardrails before workloads arrive.</li>" +
        "<li><strong>The moving trucks:</strong> MGN continuously replicates servers block-by-block; DMS copies databases <em>while they are still being written to</em>; Migration Hub tracks the waves.</li>" +
        "<li><strong>Gradual ambulance routing = Route 53 weighted records</strong>, shifting traffic percentage by percentage toward the new building.</li>" +
        "</ul>"
    },
    {
      name: "How it actually works",
      html:
        "<p><strong>MGN</strong> installs an agent that replicates disk blocks continuously into a low-cost staging area in the target account; the servers keep serving throughout. Cutover launches full-size instances from the up-to-date copy — downtime measured in minutes, and a test launch is possible any time without touching production. This is the rehost workhorse.</p>" +
        "<p><strong>DMS</strong> runs a full load and then tails the source's change log — <strong>change data capture</strong> — so the target stays continuously synchronized while the source keeps taking writes. For engine changes (Oracle to Aurora), the <strong>Schema Conversion Tool</strong> translates schema and code first and reports what it cannot convert.</p>" +
        "<p><strong>Wave planning</strong> is dependency-driven: applications that talk heavily must move in the same wave, or the chatty pair ends up conversing across a WAN link. During the parallel-run, <strong>Direct Connect or VPN</strong> is the corridor between buildings — sized deliberately, because everything crosses it.</p>" +
        "<p>And data has weight: 100 TB over a 1 Gbps line is roughly ten days of perfect saturation — the arithmetic that puts <strong>Snowball</strong> devices on the exam. Cutover discipline: shrink DNS TTLs days in advance, rehearse, keep a rollback path, reconcile after.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<p>Where migrations actually fail:</p>" +
        "<ul>" +
        "<li><strong>Broken dependency mapping.</strong> Move a ward but not its pharmacy: an app migrates while its database stays on-premises, and every query now crosses the WAN. Latency-sensitive pairs move together — that is the whole point of discovery and waves.</li>" +
        "<li><strong>Parallel-run costs double.</strong> Two buildings fully staffed. Budget questions that ignore the overlap window are traps.</li>" +
        "<li><strong>DMS moves data, not everything:</strong> triggers, stored procedures, users, and some objects need SCT plus manual work. A heterogeneous migration answer without SCT is incomplete.</li>" +
        "<li><strong>Retire is the highest-ROI R</strong> and the most forgotten: a real portfolio has 10-20 percent that should simply be turned off, not moved.</li>" +
        "<li><strong>Relocate</strong> (VMware Cloud on AWS) is the qualifier-triggered answer for fastest with no changes at datacenter scale.</li>" +
        "</ul>" +
        "<p>The analogy lies about the cargo: patients either are in one building or the other, but <em>data is copied, not carried</em> — two live copies can diverge, which is why CDC, reconciliation, and a rollback window exist at all.</p>" +
        "<p><strong>exam reflex:</strong> minimal-downtime database migration means DMS with CDC; large-scale lift-and-shift of servers means MGN.</p>"
    }
  ]
});

/* ---------------- 8. pro-scenarios: dissecting a SAP scenario ---------------- */
window.COURSE.registerExplainer({
  id: "pro-scenarios-intuition",
  moduleId: "pro-scenarios",
  title: "Dissecting a SAP scenario: extract constraints, eliminate by qualifier",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>A detective has four suspects and one long, rambling witness statement — pages of atmosphere, family history, what everyone was wearing.</p>" +
        "<p>The amateur reads the story start to finish and picks whoever <em>feels</em> guilty. The detective works differently. She ignores the narrative and extracts the <strong>hard facts</strong> onto a card: the crime took under five minutes; it happened on the ground floor; the culprit was left-handed. Three facts, maybe four — everything else is scenery.</p>" +
        "<p>Then she walks the suspect line and <strong>eliminates anyone who violates a single hard fact</strong>, no matter how suspicious they otherwise look. The charming nephew with the obvious motive? Right-handed. Out. No agonizing, no weighing — one violated fact is fatal.</p>" +
        "<p>Usually two suspects survive. Now, and only now, she asks the closing question — <em>who had the most to gain?</em> — and that single question decides between the finalists. Facts eliminate; the closing question selects.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>A SAP question is the witness statement: 150-300 words, most of it scene-setting. Your job is the detective's two-phase method:</p>" +
        "<ol>" +
        "<li><strong>Extract the hard facts (constraints):</strong> every number (RPO of 15 minutes, within 6 months, 100 TB), every absolute (<em>no code changes</em>, <em>must remain on Oracle</em>, <em>data must stay in eu-central-1</em>), every fixed piece of the environment (VMware, Direct Connect already in place, an existing Organization). Three or four per question — write them down mentally as a card.</li>" +
        "<li><strong>Eliminate by violation:</strong> each wrong option is engineered to violate at least one stated constraint. An answer that requires refactoring dies on <em>no code changes</em>. A single-Region design dies on the stated RTO. Cross them off without weighing their other merits.</li>" +
        "</ol>" +
        "<p>Two options usually survive, and both <em>work</em>. The <strong>qualifier</strong> — MOST cost-effective, LEAST operational overhead, minimize downtime, fastest to implement — is the closing question. It is not decoration; it is the tiebreaker the examiners planted, and it picks exactly one winner.</p>"
    },
    {
      name: "How it actually works",
      html:
        "<p>Refine the method into mechanics. <strong>Read the last sentence first</strong> — the actual question and its qualifier — so you know what to hunt for during the single pass through the body. Harvest constraints as you read; do not re-read.</p>" +
        "<p>Each qualifier maps to a bias you can pre-compute:</p>" +
        "<ul>" +
        "<li><strong>LEAST operational overhead</strong> → managed and serverless beat anything you patch: prefer Aurora over EC2-hosted databases, Fargate over managed nodes, S3 over self-run storage. Any option containing <em>install on EC2</em> is nearly always the distractor.</li>" +
        "<li><strong>MOST cost-effective</strong> → find the dominant meter and shrink it: storage tiers, Spot, Graviton, gateway endpoints over NAT.</li>" +
        "<li><strong>Minimize downtime</strong> → replication-based options (DMS with CDC, MGN, blue-green) over backup-and-restore.</li>" +
        "</ul>" +
        "<p>Learn distractor anatomy too: a real service doing the wrong job; the right service with one wrong configuration detail; a technically superior design that violates a cost or timeline constraint; and the plausible-but-impossible combination. Time math enforces the discipline: 75 questions in 180 minutes is 2.4 minutes each — the elimination method fits that budget, careful reading of all four options as prose does not. Flag and move on; never stall.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<p>Where the method itself can fail you:</p>" +
        "<ul>" +
        "<li><strong>Both finalists work — stop proving they work.</strong> The exam does not ask what is correct; it asks what is <em>best under the qualifier</em>. Arguing yourself into the technically richer answer against a cost qualifier is the classic senior-engineer failure mode.</li>" +
        "<li><strong>Respect constraints you would ignore at work.</strong> <em>No code changes</em> kills the refactor answer even when refactoring is obviously the right long-term call. You are answering their question, not redesigning their company.</li>" +
        "<li><strong>If two options survive elimination, you missed a fact.</strong> Re-read only the numbers: RPO versus RTO confusion, minutes versus hours, GB versus TB. One number picks pilot light versus warm standby versus multi-site.</li>" +
        "<li><strong>Multi-answer questions:</strong> each selected answer must independently satisfy all constraints — they are separate suspects, not a team.</li>" +
        "</ul>" +
        "<p>And the analogy lies in one crucial way: a detective can go gather more evidence, interview again, revisit the scene. You cannot. The statement in front of you is the complete universe of facts — if a detail is not stated, it does not exist, and assuming unstated context is how prepared candidates fail.</p>" +
        "<p><strong>exam reflex:</strong> read the final sentence and its qualifier first; eliminate every option that violates a stated constraint before comparing any merits.</p>"
    }
  ]
});

/* ---------------- 9. ai-ml: RAG vs fine-tuning ---------------- */
window.COURSE.registerExplainer({
  id: "ai-ml-intuition",
  moduleId: "ai-ml",
  title: "RAG vs fine-tuning: the open-book exam vs re-studying",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>Two students must pass a weekly exam on the company rulebook — a fat binder that changes constantly.</p>" +
        "<p>The first student <strong>re-studies</strong>. Every time the binder changes, she spends an expensive weekend memorizing the whole thing again. In the exam she answers fast, fluently, in exactly the house style. But she cannot say <em>which page</em> an answer came from, and now and then she misremembers — confidently, in that same polished style, so nobody notices.</p>" +
        "<p>The second student takes it <strong>open-book</strong>. He never memorizes contents; he practices one skill — finding the right page fast. He walks in carrying the binder, flips to the relevant section, and answers by quoting it, pointing at the page as proof. When the rules change, nobody re-trains him: someone swaps the changed pages in the binder, and his very next answer reflects them.</p>" +
        "<p>One skill is <em>knowing</em>; the other is <em>looking things up</em>. They cost differently, go stale differently, and fail differently.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>The base model is a bright graduate: fluent, broadly educated, knows nothing about your company, and its education stopped at a cutoff date.</p>" +
        "<p><strong>Fine-tuning = re-studying.</strong> You continue training the model on your own examples, changing its weights. Best for teaching <em>behavior</em>: your tone, your output format, your domain's jargon. Costly up front, and the knowledge is frozen at training time — new facts mean training again.</p>" +
        "<p><strong>RAG (retrieval-augmented generation) = the open-book exam.</strong> Your documents are split into chunks and indexed in a searchable store — on AWS, <strong>Knowledge Bases for Amazon Bedrock</strong> wires this up from an S3 bucket. At question time the system retrieves the few most relevant chunks, pastes them into the prompt alongside the question, and the model answers <em>from those pages</em>, citing them. Updating knowledge means re-indexing a document — swapping pages in the binder — not retraining anything.</p>" +
        "<p>Rough guide: facts that change and need citations → RAG. Style, format, and specialized behavior → fine-tuning. They combine: a fine-tuned student can also sit an open-book exam.</p>"
    },
    {
      name: "How it actually works",
      html:
        "<p>The binder's index is an <strong>embedding model</strong>: it maps text to high-dimensional vectors where semantic similarity becomes geometric closeness. Ingestion chunks your documents (size and overlap are real tuning knobs — chunks too small lose context, too large dilute relevance), embeds each chunk, and stores the vectors in a <strong>vector database</strong> — OpenSearch Serverless, Aurora PostgreSQL with pgvector, and friends. A query is embedded the same way and a k-nearest-neighbor search (typically HNSW) returns the top chunks; hybrid keyword-plus-vector search and a reranking pass improve precision.</p>" +
        "<p>The hard truth of RAG: <strong>retrieval quality bounds answer quality</strong>. If the right page is never fetched, the most brilliant model answers from the wrong pages. The <strong>context window</strong> is the exam-desk size — only so many pages fit, and every retrieved token is billed.</p>" +
        "<p>On Bedrock: <strong>Knowledge Bases</strong> manages the whole pipeline (S3 source, chunking, Titan embeddings, vector store, retrieval APIs). <strong>Custom models</strong> cover fine-tuning on labeled examples and continued pre-training on raw text — both produce a private model that requires <strong>Provisioned Throughput</strong> to serve, a standing hourly cost. <strong>Agents</strong> add tool-calling around either. Guardrails filter both directions.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<p>Where each approach betrays you:</p>" +
        "<ul>" +
        "<li><strong>RAG does not teach behavior.</strong> Stuffing style guides into the prompt will not reliably make the model <em>write</em> in your style or emit a strict schema — that is weight territory: fine-tuning.</li>" +
        "<li><strong>Fine-tuning is the wrong tool for volatile facts.</strong> Every rulebook change means another training run, it cannot cite sources, and it raises serving cost via provisioned throughput. Exam options that fine-tune to add current or proprietary knowledge are distractors.</li>" +
        "<li><strong>RAG does not cure hallucination</strong> — it reduces it. The model can misread the retrieved page or blend it with its prior. Grounding checks and citations mitigate, not eliminate.</li>" +
        "<li><strong>Cost shapes differ:</strong> fine-tuning is capex-like (train once, pay hourly to host); RAG is opex-like (retrieval plus larger prompts on every single query). High query volume makes prompt-token bloat a real meter.</li>" +
        "</ul>" +
        "<p>And the analogy's lie: the student <em>knows</em> he is looking things up. The model does not. Retrieval is an external system that pastes text into the prompt; the model has no concept of quoting versus remembering and can freely ignore the pages it was handed. RAG is prompt engineering with a search engine bolted on — nothing inside the model changed.</p>" +
        "<p><strong>exam reflex:</strong> frequently updated proprietary knowledge with citations means RAG (Knowledge Bases); changing a model's style, format, or behavior means fine-tuning.</p>"
    }
  ]
});
