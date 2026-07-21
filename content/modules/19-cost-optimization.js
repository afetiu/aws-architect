/* Module 19 — Cost Optimization & Billing */
window.COURSE.register({
  id: "cost",
  order: 19,
  track: "saa",
  title: "Cost Optimization & Billing",
  description: "The pricing-dimension mental model, data transfer as the #1 bill surprise, commitment economics (RIs vs Savings Plans vs Spot), the storage and database cost levers, and the tooling that turns billing from archaeology into engineering.",
  examWeight: "Cost Optimized Architectures is a full SAA-C03 domain (~20%). Nearly every scenario question has a 'MOST cost-effective' variant; the data-transfer and commitment questions are near-guaranteed.",
  lessons: [
    {
      id: "pricing-dimensions",
      title: "The pricing-dimension mental model",
      html: `
<p>You cannot memorize AWS prices — there are hundreds of thousands of SKUs and they change. You
can absolutely memorize <strong>dimensions</strong>: every AWS service bills on two to four axes, and
knowing the axes is what lets you predict a bill, spot a waste pattern, and answer every
'MOST cost-effective' exam question. Price is a coefficient; the dimension is the architecture.</p>

<h3>The recurring dimension families</h3>
<table>
<thead><tr><th>Dimension family</th><th>Examples</th><th>What it punishes</th></tr></thead>
<tbody>
<tr><td><strong>Time x capacity</strong></td><td>EC2 instance-hours, RDS/ElastiCache node-hours, NAT Gateway hours, Transfer Family endpoint-hours, provisioned IOPS-months</td><td>Idle. Anything provisioned bills whether used or not — the entire rightsizing/scheduling discipline exists for this dimension.</td></tr>
<tr><td><strong>Requests / operations</strong></td><td>S3 PUT/GET, Lambda invocations, API Gateway requests, DynamoDB reads/writes, KMS API calls</td><td>Chattiness. Millions of tiny objects, per-item writes, polling loops.</td></tr>
<tr><td><strong>Bytes stored x time</strong></td><td>S3 GB-months, EBS GB-months, snapshot GB-months, CloudWatch Logs retention</td><td>Hoarding. Data with no lifecycle policy grows monotonically forever.</td></tr>
<tr><td><strong>Bytes moved</strong></td><td>Egress to internet, inter-AZ, inter-region, NAT processing, CloudFront transfer, DataSync per-GB</td><td>Topology mistakes. The only dimension where the <em>path</em> matters as much as the volume.</td></tr>
</tbody>
</table>

<p>Work an example: 'What does an ALB cost?' Dimension answer: hours (it exists) + LCUs (a max() over
new connections, active connections, processed bytes, rule evaluations). You now know an idle ALB
still bills, that a long-polling workload with many held-open connections can be LCU-bound on active
connections while moving few bytes, and that the fix for LCU cost is architectural. You never needed
the per-LCU price.</p>

<h3>Why dimensions decide architectures</h3>
<p>Two services solving the same problem often bill on different dimensions, and that difference —
not the headline rate — decides the cheaper option at <em>your</em> workload shape:</p>
<ul>
<li>API Gateway REST bills ~3.5x per request vs HTTP APIs — a pure request-dimension comparison, so
at high volume HTTP APIs win unless you need REST-only features.</li>
<li>DynamoDB on-demand bills per request; provisioned bills per capacity-hour. The crossover is a
utilization calculation (covered in the database lesson), not a matter of one being 'cheaper'.</li>
<li>Aurora Standard bills per I/O; Aurora I/O-Optimized folds I/O into storage/compute rates.
I/O-heavy workloads flip which is cheaper.</li>
<li>NAT Gateway bills hours + per-GB processing; a VPC gateway endpoint for S3 bills nothing.
Identical traffic, radically different bills — pure path selection.</li>
</ul>

<div class="callout exam">The exam operationalizes this constantly. 'MOST cost-effective' questions
are usually resolved by asking: which option eliminates a dimension entirely (gateway endpoint kills
NAT processing; Intelligent-Tiering kills paying hot rates for cold data; Spot kills the on-demand
premium for interruptible work)? Eliminating a dimension beats discounting it, and both beat
provisioning it idle.</div>

<div class="callout deep">Under the hood, all of this lands in the Cost and Usage Report as line
items keyed by usage type (e.g., <code>USE1-DataTransfer-Out-Bytes</code>,
<code>EUC1-NatGateway-Bytes</code>) and operation. Learning to read usage types is learning the
dimensions empirically: group a CUR (or Cost Explorer) by usage type and the bill decomposes into
exactly the four families above. When an unfamiliar service appears in the bill, its usage types
tell you its pricing model faster than the pricing page does.</div>

<div class="callout war">The three chronic bill surprises, in observed order of frequency: (1) data
transfer paths nobody drew on the diagram (next lesson); (2) time x capacity resources that outlived
their project — unattached EBS volumes, idle ALBs and NAT gateways in abandoned VPCs, dev RDS
instances running weekends; (3) request-dimension explosions from retry loops and misconfigured
pollers — a Lambda retrying against a failing dependency at full concurrency turns a logic bug
directly into invoice line items. Each maps to a standing control: lifecycle/cleanup automation,
scheduling and TTL tagging for environments, and budget alarms with anomaly detection.</div>

<p>One more habit worth stealing from FinOps practice: express costs as <strong>unit economics</strong>
— cost per request, per customer, per GB processed — rather than absolute spend. Absolute spend
growing 30% while customers grow 60% is a win; flat spend on a shrinking product is a leak. The
pricing-dimension model gives you the numerator decomposition for free, and the exam's
'company wants to understand cost per team/product' phrasing maps to cost allocation tags feeding
that same unit math.</p>
`
    },
    {
      id: "data-transfer",
      title: "Data transfer: the #1 surprise on every first bill",
      html: `
<p>Compute and storage costs are visible in the console as things you created. Data transfer is a
property of <em>paths between</em> things, appears on no architecture diagram by default, and is
therefore the classic first-bill ambush. The rules compress well:</p>

<h3>The rules</h3>
<ul>
<li><strong>Ingress from the internet: free.</strong> Always. AWS wants your data.</li>
<li><strong>Egress to the internet: tiered per GB</strong> (order of 9 cents/GB from US regions at
low volume, falling with volume; ~100 GB/month account-wide is free). This is the moat dimension.</li>
<li><strong>Inter-AZ within a region: charged in BOTH directions</strong> (~1 cent/GB each way, so
~2 cents/GB round-trip effective). This is the one that shocks people — 'it is all in one region'
does not mean free.</li>
<li><strong>Inter-region: charged one direction</strong> (source side, ~2 cents/GB typical) — the
replication tax on every multi-region design.</li>
<li><strong>Same-AZ over private IPs: free.</strong> (Over public IPs/EIPs it is not — traffic
hairpinning through public addressing bills like inter-AZ.)</li>
<li><strong>To most regional services (S3, DynamoDB) from within the region: free</strong> — the
service endpoints are regional; you pay only if you insist on a silly path (see NAT below).</li>
</ul>

<h3>NAT Gateway: hours + processing + the classic waste</h3>
<p>NAT Gateway bills three ways: per hour (~4.5 cents), per GB <em>processed</em> (~4.5 cents), and
the underlying transfer of wherever the traffic goes next. The canonical waste pattern the exam tests
by name: <strong>private-subnet workloads reaching S3 or DynamoDB through the NAT Gateway</strong>.
Every byte pays NAT processing for a trip that a <strong>VPC gateway endpoint</strong> (S3/DynamoDB
only) makes free — gateway endpoints have no hourly or per-GB charge at all. A fleet pushing 10
TB/day to S3 through NAT is burning ~450 USD/day on routing. Interface endpoints (PrivateLink, for
everything else) are cheaper than NAT for the same traffic but not free: hourly per AZ + ~1 cent/GB,
so the ranking is gateway endpoint (free) &lt; interface endpoint &lt; NAT.</p>

<div class="callout exam">Guaranteed question shapes: 'reduce NAT Gateway data processing charges
for S3 access' → gateway VPC endpoint. 'EC2 in private subnet, large downloads from S3, minimize
cost' → gateway endpoint, not NAT, not interface endpoint (S3 and DynamoDB are the only two with the
free gateway flavor — memorize that pair). 'Reduce internet egress for content delivery' →
CloudFront, because CloudFront egress is priced lower than EC2/S3 direct egress AND origin-to-
CloudFront transfer is free — fronting even non-cacheable APIs with CloudFront can cut transfer cost.</div>

<h3>Topology charges: peering vs Transit Gateway</h3>
<p>VPC peering carries inter-AZ/inter-region rates but no per-GB premium of its own (same-AZ across
peered VPCs is free). Transit Gateway charges an attachment-hour per VPC <em>plus</em> ~2 cents/GB
processed on top of underlying transfer. That is the trade: TGW buys hub-and-spoke manageability at
n x attachment cost + a per-GB tax; peering is free-ish but O(n²) to manage. High-volume pairs
(database replication between two specific VPCs) sometimes justify a dedicated peering even in a TGW
shop — purely a bytes-moved calculation.</p>

<div class="callout deep">Why inter-AZ bills both directions while inter-region bills once: intra-
region transfer is metered per ENI — each instance's owner pays for bytes leaving its ENI, and
both ends of a cross-AZ flow have ENIs doing that. Cross-region is metered at the region boundary
on the sending side. Practical consequence: chatty cross-AZ microservice meshes pay twice on every
hop, which is why 'AZ affinity' features exist across the platform — ALB cross-zone load balancing
(on by default at the ALB tier, free there; NLB cross-zone is off by default and billed),
topology-aware routing in EKS, RabbitMQ/Kafka rack awareness, and client-side 'zone-local
preferred' routing in service meshes.</div>

<div class="callout war">Real bills that generated real postmortems: (1) Multi-AZ Kafka with
replication factor 3 — every produced byte crosses AZs twice for replication, then consumers in
other AZs fetch it back across; the transfer bill exceeded the broker EC2 bill. Fetch-from-
closest-replica exists for this. (2) A 'simple' log shipper pushing through NAT to a logging SaaS:
NAT processing + egress dwarfed the SaaS subscription. PrivateLink to the vendor halved it.
(3) Dev VPCs peered to shared services with database dumps flowing cross-region nightly 'because
the snapshot bucket was created in another region years ago'. Draw the bytes on the diagram; the
diagram is the bill.</div>

<div class="callout limits">Numbers worth carrying: internet egress from US regions starts ~9
cents/GB (first ~100 GB/month free account-wide); inter-AZ ~1 cent/GB <em>each direction</em>;
inter-region from ~2 cents/GB; NAT Gateway ~4.5 cents/hr + ~4.5 cents/GB processed; interface
endpoint ~1 cent/hr per AZ + ~1 cent/GB; gateway endpoints free; CloudFront egress cheaper than
EC2 egress at every tier and origin fetches from AWS origins free. Exact rates drift; the
<em>ordering</em> is stable and is what questions test.</div>

<p>Design heuristics that fall out: keep chatty flows same-AZ (and accept the AZ-failure blast
radius consciously); compress before you cross a boundary you pay for; put CloudFront in front of
anything internet-facing at volume; use gateway endpoints reflexively in every VPC template; and
treat any per-GB middlebox (NAT, TGW, PrivateLink) as a tollbooth you must justify per flow.</p>
`
    },
    {
      id: "commitments",
      title: "Commitment economics: RIs, Savings Plans, and the decision framework",
      html: `
<p>On-demand is the price of optionality. Commitments sell that optionality back to AWS: you promise
1 or 3 years of spend, AWS discounts 30-70%. The engineering problem is matching commitment
<em>shape</em> to workload <em>certainty</em> — over-commit and you pay for air; under-commit and
you donate the discount.</p>

<h3>Reserved Instances</h3>
<ul>
<li><strong>Standard RI</strong>: biggest discount (up to ~72% at 3yr all-upfront). Locked to
instance family/region (attributes modifiable within family via size flexibility for regional
Linux/shared-tenancy RIs — a 2xlarge RI covers two xlarges via normalization units). Sellable on
the RI Marketplace if you guessed wrong.</li>
<li><strong>Convertible RI</strong>: smaller discount (~up to 66% at 3yr), but exchangeable across
families, OS, tenancy — for equal-or-greater value. The hedge against instance-generation churn.</li>
<li><strong>Regional vs zonal</strong>: regional RIs apply the discount to matching usage in any AZ
(and size-flex within family) but reserve <em>no capacity</em>. Zonal RIs pin to one AZ, no size
flex, but include a <strong>capacity reservation</strong>. This is the exam's favorite distinction:
'guarantee capacity in a specific AZ' → zonal RI or (better, decoupled) On-Demand Capacity
Reservation; 'maximize discount flexibility' → regional.</li>
<li>Payment options — all/partial/no upfront — trade cash timing for a few points of discount.</li>
<li>RDS, ElastiCache, OpenSearch, Redshift have their own RIs; there is no Savings Plan for those
engines, which matters for the decision framework below.</li>
</ul>

<h3>Savings Plans</h3>
<ul>
<li><strong>Compute Savings Plan</strong>: commit dollars/hour; discount (~up to 66%) applies to
<em>any</em> EC2 instance in any region, any family — plus Fargate and Lambda. Maximum flexibility,
slightly lower ceiling.</li>
<li><strong>EC2 Instance Savings Plan</strong>: commit to a family in a region (e.g., m7g in
eu-west-1); matches Standard RI discounts (~72%) with size/OS/AZ flexibility inside that family.</li>
<li><strong>SageMaker Savings Plan</strong>: separate plan type for SageMaker compute.</li>
<li>No capacity reservation from any Savings Plan — capacity and discount are fully decoupled in
the SP world; use On-Demand Capacity Reservations (ODCR) for capacity, SPs for price. They stack.</li>
</ul>

<h3>The decision framework</h3>
<table>
<thead><tr><th>Certainty you have</th><th>Buy</th></tr></thead>
<tbody>
<tr><td>'We will spend at least N USD/hr on compute somewhere' (org-level, architecture fluid, containers/Lambda in the mix)</td><td>Compute Savings Plan</td></tr>
<tr><td>'This family in this region is stable for years' (steady-state fleets)</td><td>EC2 Instance SP (or Standard RI if you want marketplace resale as an exit)</td></tr>
<tr><td>'Long-lived databases/caches'</td><td>Service-specific RIs (RDS, ElastiCache, etc. — SPs do not cover them)</td></tr>
<tr><td>'We need guaranteed capacity in AZ-a for DR/events'</td><td>ODCR (+ SP for the discount)</td></tr>
<tr><td>'Interruptible, stateless, flexible timing'</td><td>Spot — no commitment at all (next lesson)</td></tr>
</tbody>
</table>

<div class="callout deep">Coverage vs utilization — the two metrics that run a commitment program.
<strong>Utilization</strong>: of what you bought, how much applied (unused commitment is pure
waste — target ~100%). <strong>Coverage</strong>: of your eligible usage, how much was discounted
(uncovered on-demand is opportunity cost). The operating loop: commit to your observed floor —
the trough of your usage curve, not the average — so utilization stays ~100%; then ladder
additional purchases quarterly as the floor provably rises. Laddering (many small commitments with
staggered expiries) also solves the exit problem: you shrink by letting tranches lapse.
Commitments apply automatically to matching usage account-wide and, with consolidated billing,
<strong>organization-wide</strong>: unused discounts float to matching usage in sibling accounts
(sharing can be disabled per account for chargeback hygiene). The payer-account view is where
coverage/utilization is managed; individual teams cannot see the whole picture by construction.</div>

<div class="callout exam">Mappings: 'steady predictable EC2 for 3 years, maximum savings' →
Standard RI or EC2 Instance SP (either is accepted; if both appear, the differentiator is
flexibility wording). 'may change instance families / regions / move to Fargate' → Compute SP.
'may change families but wants RI mechanics' → Convertible RI. 'guarantee capacity' → zonal
RI/ODCR — a regional RI answer is wrong there. 'RDS database running 24/7 for years' → RDS RI
(watch for a Savings Plan distractor — SPs do not cover RDS). Percent numbers are directional:
Spot ~90% off, 3yr RIs ~72%, Compute SP ~66% — the exam tests the ordering, not the decimals.</div>

<div class="callout war">Failure modes from real programs: (1) The 3-year all-upfront Standard RI
fleet bought the quarter before the company containerized — Compute SPs exist precisely because of
this scar tissue; when in doubt, buy the flexible instrument at a smaller discount. (2) Utilization
rot: someone rightsizes a fleet from m5.4xlarge to m5.xlarge and the RI pool silently goes 60%
utilized; alerts on utilization dropping below ~95% must page a human. (3) Chargeback wars:
discount sharing means team A's RI subsidizes team B's usage randomly; either disable sharing for
clean showback or (better) run commitments centrally as a 'discount desk' and allocate savings by
policy, not by float.</div>

<p>When NOT to commit: workloads under 8-ish months of expected life, anything pre-product-market-
fit, dev/test that should be scheduled off instead (a stopped instance needs no discount), and any
usage you have not yet rightsized — committing to a wrong-sized fleet locks in the waste at a
discount, which is still waste.</p>
`
    },
    {
      id: "spot-rightsizing",
      title: "Spot economics and rightsizing: the other 90%",
      html: `
<p>Spot is AWS selling the option value of its idle capacity: up to ~90% off on-demand, in exchange
for a <strong>2-minute interruption warning</strong> when AWS wants the capacity back. The modern
model (post-2017) is important: prices are smooth, adjust slowly on long-run supply/demand, and you
no longer bid in an auction — you pay the current Spot price, and interruption is driven by
<em>capacity reclamation</em>, not by being outbid. Strategy therefore is not about clever bidding;
it is about interruption tolerance and diversification.</p>

<h3>Engineering for Spot</h3>
<ul>
<li><strong>Diversify pools</strong>: a 'pool' is (instance type x AZ). Interruptions hit pools
independently, so an ASG or EC2 Fleet spread across 10+ pools rarely loses much at once. The
<strong>price-capacity-optimized</strong> allocation strategy (the modern default answer) picks
pools by depth of spare capacity <em>and</em> price — dramatically fewer interruptions than
lowest-price chasing.</li>
<li><strong>Attribute-based instance selection</strong>: specify vCPU/memory requirements instead
of naming types, and let the fleet use anything that fits — maximal pool diversity with no type
list to maintain.</li>
<li><strong>Handle the 2-minute warning</strong>: an EventBridge event and instance metadata flag
precede reclamation. Drain the node (capacity-rebalance can start a replacement even earlier, on
the rebalance recommendation signal), checkpoint work, deregister from the LB. Stateless or
checkpointable workloads only — batch, CI, rendering, big data executors (EMR task nodes are the
canonical case), containerized services behind an LB with headroom.</li>
<li><strong>Mix purchase options</strong>: ASGs and EKS/ECS capacity providers support an
on-demand base + percentage-above-base split — e.g., 30% on-demand floor (covered by Savings
Plans!) for stability, 70% Spot for economics. Commitments and Spot are complements, not
competitors: SP covers the floor, Spot covers the burst.</li>
</ul>

<div class="callout exam">Keyword mapping: 'fault-tolerant', 'flexible start/stop', 'batch',
'can be interrupted' → Spot. 'critical', 'stateful', 'cannot tolerate interruption' → never Spot
(the distractor will offer Spot with a big number next to it). 'minimize cost for a nightly batch
that must complete' → Spot with diversified pools + on-demand fallback, or Spot inside AWS Batch
which handles retries natively. Numbers: 2-minute warning, up to 90% discount — both are tested
as literals.</div>

<h3>Rightsizing: the discount you do not have to buy</h3>
<p>Before any commitment, fix the denominator. The usual estate audit finds 30-50% waste in three
buckets:</p>
<ul>
<li><strong>Oversized</strong>: p95 CPU under 10%, memory headroom of 4x. <strong>Compute
Optimizer</strong> is the tool — it reads CloudWatch (add the agent for memory metrics) and
recommends instance types across EC2, ASGs, EBS, Lambda memory, ECS/Fargate task sizes, including
cross-family moves to Graviton (typically ~20% better price-performance — the cheapest 'migration'
in the catalog for most Linux workloads).</li>
<li><strong>Idle-but-running</strong>: dev/test running nights and weekends. An instance scheduler
(or just tags + a Lambda cron) stopping non-prod off-hours removes ~65% of those hours — a bigger
percentage than any RI, for free.</li>
<li><strong>Abandoned</strong>: the unattached EBS volumes, aged snapshots, idle load balancers
and NAT gateways of projects past. Trusted Advisor's cost checks (idle instances, unassociated
EIPs, underutilized volumes) enumerate these; the fix is organizational — TTL tags and automated
reaping — not analytical.</li>
</ul>

<div class="callout deep">Why rightsize before committing, arithmetically: commit to a 4xlarge
fleet at 60% discount, then rightsize to xlarge, and your utilization of the commitment collapses
— you now pay the committed rate for capacity nothing uses; the 'discount' became a liability.
Sequence is always: measure → rightsize → schedule off-hours → put interruptible work on Spot →
commit to the remaining floor. Each step shrinks the base the next step operates on, and
commitments come last because they are the least reversible.</div>

<div class="callout war">Spot in production, the honest version: interruption rates vary wildly by
pool and time — popular types (latest-gen large boxes in busy regions) can see double-digit
monthly interruption rates while boring older types sit untouched for months. The Spot placement
score API and the interruption-rate data in the Spot Instance Advisor are worth consulting before
betting a deadline on a single pool. And the classic outage pattern: a team runs 100% Spot with
one instance type 'because it never got interrupted in dev', then a capacity crunch (new region
GPU rush, re:Invent week) reclaims the whole pool at once and the service discovers it had no
on-demand fallback path. Diversity + a base tier is not optional hygiene; it is the design.</div>

<div class="callout limits">Working numbers: Spot discount up to ~90% (varies by pool);
interruption notice 2 minutes; rebalance recommendation arrives earlier but with no guarantee;
Spot capacity is finite per pool and not SLA-backed — there is no 'Spot capacity guarantee'
instrument at all, which is precisely what distinguishes it from every commitment product.
Graviton price-performance gain ~20-40% for compatible workloads. Compute Optimizer needs 14 days
of metrics history (30+ preferred) before its recommendations stabilize.</div>
`
    },
    {
      id: "storage-costs",
      title: "S3 and EBS cost levers: classes, lifecycles, and the retrieval traps",
      html: `
<p>Storage bills grow monotonically unless something deletes or demotes data, because storage is a
bytes x time dimension with no natural decay. The levers are: put bytes in the right class, move
them as they cool, delete what is dead, and do not get ambushed by the retrieval-side fine print.</p>

<h3>S3 class selection: the honest decision rule</h3>
<p>Standard-IA costs ~45% less per GB stored than Standard, but adds a per-GB retrieval charge and
a <strong>30-day minimum storage duration</strong>; Glacier classes go further down the same slope.
So the decision is an access-frequency bet, and the traps are all about losing that bet:</p>
<ul>
<li><strong>Minimum durations</strong>: IA classes 30 days, Glacier Instant Retrieval 90,
Glacier Flexible 90, Deep Archive 180. Delete or transition earlier and you pay the remainder —
lifecycle-cycling short-lived objects through IA is a way to pay <em>more</em> than Standard.</li>
<li><strong>Minimum object size billing</strong>: IA classes bill at least 128 KB per object.
A bucket of a billion 4 KB objects 'saved' into IA bills 32x its actual bytes. Small objects
should be aggregated (tar/parquet) or left in Standard.</li>
<li><strong>Retrieval pricing</strong>: per-GB retrieval on IA and Glacier classes, plus (for
Flexible/Deep Archive) restore-request pricing tiers by speed (expedited/standard/bulk). A
'cheap' archive that analytics scans monthly is not cheap.</li>
<li><strong>Request pricing</strong>: PUTs cost ~10x GETs, and both are per-1000. Transition
requests bill too — a lifecycle rule that transitions a billion tiny objects to Glacier can cost
tens of thousands of dollars <em>in transition requests</em>. Object-count is a dimension; respect
it.</li>
</ul>

<h3>Intelligent-Tiering: the default-safe answer</h3>
<p><strong>S3 Intelligent-Tiering</strong> moves objects between hot/infrequent/archive-instant
access tiers automatically based on observed access, charges a small monitoring fee per 1,000
objects (waived under 128 KB — those just stay hot-priced), and — critically — has <strong>no
retrieval charges and no minimum durations</strong> on its automatic tiers. That combination is why
it is the exam's 'unknown or changing access patterns' answer and a sane real-world default for
anything over 128 KB you cannot characterize. Its opt-in Archive/Deep-Archive tiers reintroduce
async restore semantics, so leave those off for data that must stay milliseconds-addressable.
When you <em>can</em> characterize access (write-once-read-never logs), explicit lifecycle rules to
Glacier/Deep Archive beat IT — you skip the monitoring fee and go colder, faster.</p>

<div class="callout exam">Mappings: 'unpredictable access patterns' → Intelligent-Tiering.
'compliance archive, retrieval within 12 hours, lowest cost' → Deep Archive. 'rarely accessed but
needs millisecond access when needed' → Standard-IA or Glacier Instant Retrieval (GIR for ~quarterly
access, IA for ~monthly). 'determine the right class from data' → S3 Storage Class Analysis (feeds
lifecycle decisions; only analyzes Standard→IA suitability) or Storage Lens for org-wide hygiene
metrics. Every option that puts frequently-deleted or tiny objects into IA/Glacier is a deliberate
minimum-duration/minimum-size trap.</div>

<div class="callout war">The invisible S3 line item: <strong>incomplete multipart uploads</strong>.
Failed/abandoned multipart uploads retain their parts — billed, invisible to ListObjects, forever —
until aborted. Every serious bucket needs the lifecycle rule
AbortIncompleteMultipartUpload after ~7 days; Storage Lens exposes the metric, and multi-TB
surprises from years of crashed uploaders are routine findings in cost reviews. Same genus:
noncurrent versions in versioned buckets (add NoncurrentVersionExpiration or pay for every
overwrite forever) and orphaned delete markers.</div>

<h3>EBS and snapshots</h3>
<ul>
<li><strong>gp3 over gp2</strong>: ~20% cheaper per GB and decouples IOPS/throughput from size —
gp2's IOPS-scales-with-size model forced capacity overprovisioning to buy performance; gp3 sells
the dimensions separately. Migrating is a live modify-volume call; there is rarely a reason to
hold gp2.</li>
<li><strong>Unattached volumes bill fully</strong> — 'available' state is a billing state. Reap
them (after snapshotting if paranoid).</li>
<li><strong>Snapshots are incremental</strong> (changed blocks only) but chains add up;
lifecycle them with Data Lifecycle Manager or AWS Backup. <strong>Snapshot Archive tier</strong>
is ~75% cheaper for snapshots kept 90+ days that you will rarely restore — with a 90-day minimum
and 24-72h restore-to-standard latency, the same bet structure as Glacier.</li>
<li>io2 provisioned IOPS bill whether consumed or not (time x capacity dimension again) — an
io2 volume sized for a load test years ago is a subscription to nothing.</li>
</ul>

<div class="callout limits">Numbers to memorize: IA minimums — 30 days & 128 KB; GIR/Flexible 90
days; Deep Archive 180 days; Snapshot Archive 90 days; multipart-abort lifecycle ~7 days as best
practice; gp3 ~20% cheaper than gp2 with 3,000 IOPS/125 MBps baseline included regardless of size.
Standard-IA storage ~45% below Standard; Deep Archive roughly 23x cheaper than Standard per GB
stored. Ratios are stable even as absolute prices drift.</div>
`
    },
    {
      id: "db-serverless-costs",
      title: "Database and serverless cost shapes",
      html: `
<p>Databases and serverless are where pricing-dimension fluency pays off most, because AWS sells
the <em>same service</em> under multiple pricing shapes and the right one is a function of your
traffic curve, not of the service.</p>

<h3>DynamoDB: the on-demand vs provisioned crossover</h3>
<p>On-demand bills per request (per million RRU/WRU); provisioned bills per capacity-unit-hour
whether used or not, and can itself be discounted with DynamoDB reserved capacity. On-demand costs
roughly <strong>6-7x more per request</strong> than a fully-utilized provisioned unit. So the
crossover math: a provisioned table at average utilization U costs the same as on-demand when
1/U ≈ 7 — i.e., <strong>if you can keep average utilization above ~15-20% (including auto scaling
lag and headroom), provisioned is cheaper; below that, or with spiky/unpredictable traffic,
on-demand wins</strong>. Auto scaling narrows but does not close the gap — it reacts in minutes,
so diurnal curves fit provisioned+auto-scaling well, while flash-crowd workloads and empty dev
tables fit on-demand. On-demand is also the zero-ops answer: no throttling-vs-cost tuning loop.</p>

<h3>Aurora: Standard vs I/O-Optimized</h3>
<p>Aurora Standard bills instances + storage + <strong>per-million-I/O</strong>. That third
dimension is unpredictable — the one component you cannot capacity-plan from first principles.
<strong>I/O-Optimized</strong> removes the I/O charge entirely, in exchange for ~30% higher
instance and storage rates. The rule AWS itself publishes: <strong>if I/O is more than ~25% of
your Aurora bill, I/O-Optimized is cheaper</strong> — and it also caps tail risk (a query-plan
regression that 10x-es I/O no longer 10x-es the bill). You can switch per cluster once per 30
days, so measure on Standard, flip if I/O-heavy. Aurora Serverless v2 is the third shape: per-ACU-
second, for spiky/idle-prone workloads — its economics mirror the DynamoDB on-demand logic:
pay-per-use wins at low average utilization, provisioned wins at sustained load.</p>

<div class="callout exam">Mappings: 'unpredictable traffic, new application, avoid capacity
planning' → DynamoDB on-demand / Aurora Serverless v2. 'steady, predictable, high-volume' →
provisioned (+ reserved capacity / RIs). 'Aurora I/O charges are a large or volatile portion of
the bill' → I/O-Optimized. 'dev databases idle most of the day' → Aurora Serverless v2 (scales
to ~0.5 ACU) or stop RDS instances (stoppable for 7 days at a time — storage still bills).
RDS RIs exist and Savings Plans do NOT cover RDS — a recurring distractor.</div>

<h3>Lambda and API Gateway shapes</h3>
<ul>
<li><strong>Lambda bills GB-seconds</strong> (memory x duration, 1ms granularity) + per-request.
Memory is also the CPU knob, so cost tuning is non-monotonic: doubling memory can halve duration
and leave cost flat while halving latency. AWS Lambda Power Tuning (a Step Functions state
machine) finds the pareto point empirically; Compute Optimizer recommends memory too. Duration
priced per-ms means dependency latency is billed — a Lambda awaiting a slow downstream at 10 GB
memory is the most expensive way to sleep in AWS.</li>
<li><strong>API Gateway</strong>: REST APIs ~3.50 USD/million requests; <strong>HTTP APIs ~1.00
USD/million</strong> — same Lambda-proxy job at ~3.5x price difference. Choose REST only for the
features that need it (usage plans/API keys, request validation, WAF via stages, private APIs with
resource policies, caching). At a billion requests/month the delta is ~2,500 USD — 'reduce API
Gateway costs, no advanced features used' → migrate REST to HTTP API is a literal exam answer.
ALB is a third shape: hourly + LCU, no per-request price — cheaper than either at sustained very
high throughput.</li>
<li>Step Functions: Standard bills per state transition; Express bills per request+duration —
high-volume short workflows belong on Express (same 'request-shape vs time-shape' logic again).</li>
</ul>

<h3>Observability: the bill about the bills</h3>
<p>CloudWatch is a routine top-five line item in mature accounts. The dimensions:
<strong>Logs ingestion (~0.50 USD/GB)</strong> dwarfs storage (~0.03/GB-month) — ingestion is the
lever, so drop debug logs at the source, sample, and set retention (default is never-expire; unset
retention is the storage half of the leak). The Infrequent Access log class halves ingestion cost
for logs you only query occasionally. Custom metrics bill per-metric-month, and high-cardinality
dimensions (per-container, per-customer metric names) multiply silently — embedded metric format
plus aggregation beats one metric per instance. GetMetricData calls bill per datapoint fetched:
a third-party monitoring vendor polling everything at 1-minute resolution can cost more than
CloudWatch itself. X-Ray and Container Insights: sample, do not full-firehose.</p>

<div class="callout war">Observed pathology: a team enables debug logging during an incident,
forgets it, and ingestion runs at 40 GB/hour for a month — ~15,000 USD of logs nobody read.
Anomaly Detection (next lesson) catches this in days; a log-level TTL (auto-revert config) prevents
it. Second pathology: Lambda logging full request/response payloads 'temporarily' — payload logging
is an ingestion multiplier on your busiest dimension by construction.</div>

<div class="callout limits">Memorize the shapes, not the cents: DynamoDB on-demand ≈ 6-7x
provisioned per request (crossover ≈ 15-20% utilization); Aurora I/O-Optimized wins when I/O
&gt; ~25% of bill (switchable per 30 days); HTTP API ≈ 3.5x cheaper than REST; Lambda = GB-s +
requests (memory is the CPU knob); CW Logs ingestion ~0.50/GB vs storage ~0.03/GB-month; RDS
stoppable 7 days max, storage bills while stopped.</div>
`
    },
    {
      id: "cost-tooling",
      title: "Tooling and governance: Cost Explorer to CUR 2.0, budgets to anomaly detection",
      html: `
<p>The tools split cleanly by question answered: <em>what happened</em> (Cost Explorer, CUR),
<em>stop/alert when X</em> (Budgets, Anomaly Detection), <em>what should change</em> (Compute
Optimizer, Trusted Advisor), and <em>whose is it</em> (tags, cost categories, account structure).
Senior-level competence is knowing which tool is authoritative for which question.</p>

<h3>What happened: Cost Explorer and CUR 2.0</h3>
<ul>
<li><strong>Cost Explorer</strong>: interactive/API analysis, 13 months history (up to 38 by
opt-in), daily granularity free in-console, <strong>hourly + resource-level granularity as an
opt-in</strong>, grouping by service/account/tag/usage-type, plus the RI/SP recommendation,
coverage, and utilization reports. Also a simple ML forecast. The API bills ~1 cent per request —
a dashboard polling it every minute is its own cost lesson.</li>
<li><strong>CUR 2.0 (Data Exports)</strong>: the ground truth — every line item, hourly,
resource-level, with all cost allocation tags as columns, delivered to S3 in Parquet, queryable
with Athena, and the input to every serious FinOps pipeline (CUDOS dashboards, third-party
platforms). CUR 2.0 improved on legacy CUR with a stable SQL-selectable schema and nested fields.
When Cost Explorer's aggregations cannot answer the question ('which specific NAT gateway',
'cost per customer-id tag per hour'), CUR+Athena is the answer. Exam framing: 'most detailed /
granular cost data, programmatic analysis' → CUR to S3 + Athena, not Cost Explorer.</li>
</ul>

<h3>Guardrails: Budgets and Anomaly Detection</h3>
<ul>
<li><strong>AWS Budgets</strong>: thresholds on cost, usage, RI/SP utilization or coverage, with
alerts on actual or <em>forecasted</em> breach (forecasted alerts are the ones that fire before
the money is gone). <strong>Budget Actions</strong> can respond automatically: apply a restrictive
IAM/SCP policy, or stop EC2/RDS instances — the exam's 'automatically prevent further spend in
sandbox accounts' answer. Two free budgets, then ~2 cents/day each.</li>
<li><strong>Cost Anomaly Detection</strong>: ML baseline per service/account/tag monitor, alerts
on deviations with a root-cause hint (which service/account/usage-type moved). Free. It catches
the 40-GB/hour log leak and the crypto-mining incident in days instead of at invoice time. Budgets
are for known thresholds; anomaly detection is for unknown unknowns — deploy both, they are not
substitutes.</li>
</ul>

<h3>Recommendations: Compute Optimizer and Trusted Advisor</h3>
<p><strong>Compute Optimizer</strong> is the rightsizing authority (EC2/ASG/EBS/Lambda/ECS-Fargate,
metrics-driven, cross-family including Graviton). <strong>Trusted Advisor</strong> is the
checklist: idle instances, unassociated EIPs, underutilized EBS, idle load balancers and RDS,
RI optimization — full cost checks require Business/Enterprise support. They overlap at the edges;
the distinction the exam draws is metrics-based sizing recommendations (Optimizer) vs
best-practice checks across cost/security/limits (Advisor).</p>

<h3>Whose is it: tags, categories, and account structure</h3>
<ul>
<li><strong>Cost allocation tags</strong> must be <em>activated</em> in the billing console before
they appear in Cost Explorer/CUR — tagging resources is necessary but not sufficient, and
activation is not retroactive (untagged history stays untagged; also up to ~24h to appear). This
activation detail is a repeat exam item.</li>
<li><strong>Tag policies</strong> (AWS Organizations) enforce tag key/value standardization;
pair with SCPs or config rules to <em>require</em> tags at creation, because a cost-allocation
scheme with 60% coverage allocates 60% of the bill and an argument about the rest. <strong>Cost
Categories</strong> then map tags/accounts/services into business dimensions (team, product,
environment) with rules and split charges for shared costs.</li>
<li><strong>Consolidated billing</strong> (Organizations): one payer, aggregated volume tiers
(S3/CloudFront tiers pool across accounts), and RI/SP discount sharing across the org (disable
per-account when chargeback demands isolation). The account is the strongest cost-allocation
boundary — an account-per-team/workload structure makes showback trivial and blast radii small;
tags refine within accounts. This is a design-for-cost argument for multi-account architecture,
independent of the security arguments.</li>
</ul>

<div class="callout exam">Mappings: 'alert before budget is exceeded' → Budgets with forecasted
alert. 'automatically stop instances when budget breached' → Budget Actions. 'detect unusual
spend without setting thresholds' → Cost Anomaly Detection. 'most granular data / query with SQL'
→ CUR + Athena. 'view costs by department' → cost allocation tags (activated!) + Cost Categories.
'rightsizing recommendations' → Compute Optimizer. 'idle resource checks' → Trusted Advisor.
'benefit automatically from volume discounts across accounts' → consolidated billing. Each tool
name in the options usually has exactly one question-phrase it is the correct answer to.</div>

<div class="callout war">Governance findings that repeat everywhere: (1) the org has budgets but
alerts go to a mailing list nobody reads — route to Slack/pager via SNS/Chatbot and give anomaly
alerts an owner; (2) tags exist but were never activated for cost allocation, so six months of
'cost per product' data does not exist and cannot be backfilled; (3) the payer account's RI/SP
purchases make every team's showback look wrong in different directions — decide sharing policy
<em>before</em> the first big commitment, not after the first chargeback dispute; (4) sandbox
accounts with no SCP guardrails and no budget actions — the classic 'intern's forgotten
p3.16xlarge' costs more than the internship.</div>

<div class="callout deep">How the numbers reconcile (or do not): Cost Explorer shows unblended,
amortized, or net costs; CUR line items carry blended and unblended rates; amortized views spread
upfront RI/SP payments across the term. Chargeback systems must pick one lens and document it —
teams comparing an amortized dashboard against unblended CUR queries will 'find' discrepancies
forever. For exam purposes: amortized = commitment payments spread over time (the FinOps default),
unblended = what was charged when, blended = org-averaged rates on shared commitments.</div>
`
    }
  ],
  quiz: [
    {
      q: "A company runs EC2 instances in private subnets that write 15 TB per day of processed output to S3 in the same Region through a NAT gateway. The monthly bill shows large NAT gateway charges. What change eliminates MOST of this cost?",
      options: [
        "Replace the NAT gateway with a fleet of NAT instances on Spot",
        "Create a gateway VPC endpoint for S3 and route the private subnets' S3 traffic through it",
        "Create an interface VPC endpoint for S3 in each availability zone",
        "Enable S3 Transfer Acceleration to shorten the network path"
      ],
      answer: [1],
      multi: false,
      explanation: "This is THE classic waste pattern: same-region S3 traffic paying ~4.5 cents/GB NAT processing for no reason. A gateway VPC endpoint (<strong>B</strong>) carries S3 traffic over the VPC's private routing with <strong>zero hourly and zero per-GB charge</strong> — the dimension is eliminated, not discounted. <strong>A</strong> replaces a managed tollbooth with a self-managed one — NAT instances still process every byte, add ops burden, and Spot interruptions now break egress. <strong>C</strong> works functionally but bills hourly per AZ plus ~1 cent/GB — far better than NAT but strictly worse than the free gateway endpoint; interface endpoints are for the services that lack a gateway flavor (i.e., everything except S3 and DynamoDB). <strong>D</strong> is for long-haul internet uploads from distant clients and adds its own per-GB fee — irrelevant to intra-region private traffic."
    },
    {
      q: "A SaaS provider has a steady baseline of 40 m6i.2xlarge instances running 24/7, but the platform team plans to migrate portions of the workload to Fargate and possibly to Graviton instances over the next two years. They want the largest discount that survives these changes. What should they buy?",
      options: [
        "Three-year Standard Reserved Instances for m6i.2xlarge",
        "Three-year EC2 Instance Savings Plan for the m6i family",
        "Three-year Compute Savings Plan sized to the baseline spend",
        "Zonal Reserved Instances in each AZ used by the fleet"
      ],
      answer: [2],
      multi: false,
      explanation: "The stated certainty is dollar-level ('this much compute spend'), not family-level — and the plan explicitly includes Fargate and a family change. Only the <strong>Compute Savings Plan</strong> (<strong>C</strong>) applies across instance families, regions, Fargate, and Lambda; ~66% maximum discount but it survives every named change. <strong>A</strong> offers the top discount (~72%) but is locked to the m6i family — the Graviton move (m7g) and Fargate migration would strand it (Marketplace resale is the messy exit). <strong>B</strong> has the same discount ceiling as Standard RIs with intra-family flexibility only — same stranding on both planned changes. <strong>D</strong> adds a capacity reservation nobody asked for while giving up regional flexibility — zonal RIs answer 'guarantee capacity in this AZ' questions, not discount-flexibility questions."
    },
    {
      q: "A nightly analytics job runs 400 vCPUs of stateless Spark executors for about 4 hours and must finish by morning, though individual executors can be restarted freely. The team currently runs it entirely on on-demand instances. What is the MOST cost-effective safe change?",
      options: [
        "Purchase 3-year Standard RIs for the executor instance type",
        "Run executors on Spot capacity diversified across many instance pools with a price-capacity-optimized strategy, keeping the driver and a small baseline on on-demand",
        "Run the whole job, including the driver, on Spot instances of the single cheapest instance type",
        "Move the job to Lambda functions to avoid managing instances"
      ],
      answer: [1],
      multi: false,
      explanation: "Interruptible, stateless, restartable, time-flexible-within-a-window — the textbook Spot profile, worth up to ~90% off. <strong>B</strong> applies Spot correctly: pool diversification (instance type x AZ) plus the price-capacity-optimized allocation strategy minimizes correlated reclamation, while the driver and a baseline stay on on-demand so the job cannot lose its coordinator. <strong>A</strong> is backwards: RIs are for steady 24/7 usage; a 4-hour nightly job would leave the commitment ~83% idle — utilization is the whole game. <strong>C</strong> is the real-world outage pattern: one pool means one capacity crunch reclaims everything simultaneously, and a Spot driver turns an interruption into a full job restart that can miss the deadline. <strong>D</strong> misfits the platform — Spark executors need coordinated long-running compute; a Lambda rewrite is a re-architecture, and 400 vCPU-hours of Lambda GB-seconds would likely cost more, not less."
    },
    {
      q: "A bucket receives about 500 million objects per month averaging 6 KB each, which are read heavily for two days and rarely afterward, and deleted after 60 days by lifecycle rule. A proposal suggests transitioning objects to S3 Standard-IA after 3 days to cut costs. Why is this proposal flawed? (Select TWO.)",
      options: [
        "Standard-IA bills each object as if it were at least 128 KB, multiplying the effective stored size by roughly 20x",
        "Standard-IA has a 30-day minimum storage duration, and each object also pays a lifecycle transition request, which at 500 million objects per month is substantial",
        "Standard-IA cannot be combined with lifecycle expiration rules",
        "Standard-IA objects take minutes to retrieve, breaking the occasional-read requirement",
        "Standard-IA is only available in a single availability zone"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "Two traps fire at once. <strong>A</strong>: IA classes bill a 128 KB minimum per object, so 6 KB objects are billed at ~21x their real size — the 'discount' becomes a large premium. <strong>B</strong>: transition requests are billed per object (500M/month of them is real money), and although the 30-day minimum is technically satisfied by the 60-day life, transitioning at day 3 means paying IA rates plus transition fees on objects that are near-dead anyway — the arithmetic never recovers. The right answer for this workload is Standard with the existing 60-day expiration, possibly aggregating small objects at write time. <strong>C</strong> is false — expiration and transition rules coexist routinely. <strong>D</strong> is false — Standard-IA retrieval is milliseconds; minutes-to-hours describes Glacier Flexible/Deep Archive. <strong>E</strong> confuses Standard-IA with One Zone-IA."
    },
    {
      q: "A company cannot characterize the access pattern of 800 TB of mixed research data (objects 1 MB to 5 GB) and wants storage costs reduced without any risk of retrieval fees or minimum-duration penalties, and without ongoing manual analysis. Which storage class fits?",
      options: [
        "S3 Standard-IA with a 30-day lifecycle transition",
        "S3 Glacier Instant Retrieval",
        "S3 Intelligent-Tiering with the default automatic tiers",
        "S3 One Zone-IA"
      ],
      answer: [2],
      multi: false,
      explanation: "The requirements — unknown access pattern, no retrieval fees, no minimum-duration risk, no manual work — read like the Intelligent-Tiering feature list (<strong>C</strong>): it auto-moves objects between frequent, infrequent, and archive-instant tiers based on observed access, with no retrieval charges and no minimum duration on automatic tiers, for a small per-object monitoring fee (trivial at these object sizes). <strong>A</strong> bets that everything is cold after 30 days — the scenario says the pattern is unknown, and wrong bets pay per-GB retrieval fees plus minimum-duration penalties, exactly the excluded risks. <strong>B</strong> has a 90-day minimum duration and retrieval fees — both excluded. <strong>D</strong> adds those same IA-class economics plus a durability trade (single AZ) nobody asked for; it is for re-creatable data with a known-cold pattern."
    },
    {
      q: "An Aurora MySQL cluster's monthly bill is 2,000 USD of instance charges, 800 USD of storage, and 2,400 USD of I/O charges that spike unpredictably with reporting load. What should the architect do to reduce and stabilize the bill?",
      options: [
        "Switch the cluster to Aurora I/O-Optimized",
        "Purchase RDS Reserved Instances for the current instance class",
        "Migrate the cluster to Aurora Serverless v2",
        "Enable Aurora storage auto-scaling to reduce storage charges"
      ],
      answer: [0],
      multi: false,
      explanation: "I/O is 2,400 of 5,200 USD ≈ 46% of the bill — far above the ~25% threshold where I/O-Optimized wins. <strong>A</strong> eliminates the I/O dimension entirely for ~30% higher instance/storage rates: roughly (2000+800) x 1.3 ≈ 3,640 USD vs 5,200 — cheaper AND stable, which addresses the 'spike unpredictably' complaint directly (a bad query plan can no longer 10x the bill). <strong>B</strong> discounts only the instance component (~2,000) and does nothing about the volatile I/O majority. <strong>C</strong> changes the compute pricing shape (per-ACU-second) — useful for idle-prone workloads, but this cluster's problem is I/O charges, which Serverless v2 on Standard config would still incur. <strong>D</strong> is a non-answer: Aurora storage already grows automatically, and storage is the smallest, most stable component here."
    },
    {
      q: "A DynamoDB table serves a steady workload averaging 2,000 reads/sec around the clock with mild diurnal variation, currently on on-demand mode. Another table backs a rarely-used internal tool with a few hundred requests per day. What is the MOST cost-effective configuration?",
      options: [
        "Both tables on on-demand capacity mode",
        "The steady table on provisioned capacity with auto scaling (plus reserved capacity), the internal tool table on on-demand",
        "Both tables on provisioned capacity with auto scaling",
        "The steady table on on-demand, the internal tool table on provisioned capacity at minimum settings"
      ],
      answer: [1],
      multi: false,
      explanation: "On-demand costs roughly 6-7x more per request than well-utilized provisioned capacity, so the crossover is average utilization ~15-20%. The steady 24/7 table will run provisioned at high utilization (auto scaling trims the diurnal curve) — provisioned plus reserved capacity is decisively cheaper (<strong>B</strong>). The internal tool at a few hundred requests/day would leave even 1 provisioned unit idle ~99% of the time — on-demand's per-request pricing rounds to pennies. <strong>A</strong> pays the ~6-7x premium on billions of steady requests. <strong>C</strong> wastes on the tiny table (minimum provisioned capacity + auto scaling floor for near-zero traffic) — small, but strictly worse, and the pattern fails at scale across hundreds of dev tables. <strong>D</strong> inverts the correct assignment on both tables — the exact opposite of the utilization logic."
    },
    {
      q: "A serverless API on API Gateway REST APIs with Lambda proxy integration serves 900 million requests monthly. It uses no usage plans, no API keys, no request validation, and no API Gateway caching. Finance wants the API Gateway line item cut with minimal engineering effort. What should the team do?",
      options: [
        "Migrate the API to API Gateway HTTP APIs",
        "Enable API Gateway caching to reduce request charges",
        "Move the Lambda functions behind CloudFront with Lambda@Edge",
        "Add a usage plan with throttling to reduce request volume"
      ],
      answer: [0],
      multi: false,
      explanation: "HTTP APIs price at roughly 1.00 USD/million vs ~3.50 USD/million for REST — about 3.5x cheaper for the same Lambda-proxy job, and the scenario explicitly lists no REST-only features in use, so the migration is mostly configuration (<strong>A</strong>). At 900M requests/month that is ~2,250 USD/month saved. <strong>B</strong> misreads the pricing model: caching reduces backend (Lambda) invocations, not API Gateway request charges — every request still bills, and the cache itself is an hourly charge. <strong>C</strong> is a re-architecture with its own request pricing and operational model — not 'minimal effort', and Lambda@Edge is for edge logic, not cost reduction. <strong>D</strong> 'reduces cost' by refusing traffic — throttling paying customers is not a cost optimization."
    },
    {
      q: "Finance reports that last month's bill included 30,000 USD of CloudWatch charges, up from 4,000. Investigation shows a microservice was deployed with debug logging enabled, ingesting 35 GB/hour. Which TWO measures most directly prevent a recurrence of this class of surprise? (Select TWO.)",
      options: [
        "Enable AWS Cost Anomaly Detection with alerts routed to the platform team's channel",
        "Reduce CloudWatch Logs retention from never-expire to 30 days",
        "Set log-level configuration to auto-revert and drop debug logs at the source in production",
        "Purchase a Compute Savings Plan to discount the CloudWatch charges",
        "Export the logs to S3 Glacier for cheaper storage"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "The cost driver is <strong>ingestion</strong> (~0.50 USD/GB), not storage, so prevention means catching spend deviations fast and stopping debug volume at the source. <strong>A</strong> is the detection layer: an ML baseline flags the deviation within days with a usage-type root-cause hint, instead of at invoice time. <strong>C</strong> is the prevention layer: production log-level guardrails with auto-revert make the misconfiguration self-healing. <strong>B</strong> tunes the wrong dimension — retention affects the ~0.03/GB-month storage component; 35 GB/hour of ingestion bills identically whether kept 30 days or forever. <strong>D</strong> is category error: Savings Plans cover compute (EC2/Fargate/Lambda), not CloudWatch. <strong>E</strong> again optimizes storage after the ingestion money is already spent."
    },
    {
      q: "A company with 40 member accounts in AWS Organizations wants sandbox accounts to be automatically prevented from exceeding 500 USD per month, wants engineering-wide alerts when unusual spending patterns emerge in any service, and wants monthly cost-per-product reporting. Which combination addresses all three? (Select THREE.)",
      options: [
        "AWS Budgets with budget actions attaching a restrictive policy in sandbox accounts",
        "AWS Cost Anomaly Detection monitors with SNS alerting",
        "Activated cost allocation tags with Cost Categories mapping to products",
        "AWS Trusted Advisor cost optimization checks",
        "Compute Optimizer with organization-wide enrollment",
        "A zero-spend budget in the management account"
      ],
      answer: [0, 1, 2],
      multi: true,
      explanation: "Three requirements, three tools. <strong>A</strong>: Budget Actions are the only listed mechanism that <em>enforces</em> — on breach they can apply a deny-heavy IAM/SCP policy or stop instances, converting the 500 USD limit from an email into a control. <strong>B</strong>: Anomaly Detection is the threshold-free 'unusual patterns' detector with root-cause hints. <strong>C</strong>: cost-per-product requires tags activated for cost allocation (activation is the step teams forget — it is not retroactive) plus Cost Categories to roll tags/accounts into product dimensions. <strong>D</strong> surfaces idle-resource findings — useful, but enforces nothing and allocates nothing. <strong>E</strong> is rightsizing recommendations, orthogonal to all three requirements. <strong>F</strong> alerts on any spend at all — appropriate for accounts that should be dormant, not for a 500 USD sandbox allowance."
    },
    {
      q: "A three-tier application runs its web fleet in one AZ, its app fleet in a second AZ, and its Aurora writer in a third, with 40 TB/month flowing between web and app tiers. An architect reviewing the transfer bill wants to reduce inter-AZ charges without reducing availability. What should they recommend?",
      options: [
        "Deploy each tier across all three AZs and enable AZ-aware routing so requests prefer same-AZ targets, accepting cross-AZ only on failure",
        "Consolidate all tiers into a single AZ to eliminate inter-AZ transfer",
        "Route inter-tier traffic through a Transit Gateway to obtain bulk pricing",
        "Enable VPC peering between the subnets to remove the inter-AZ charge"
      ],
      answer: [0],
      multi: false,
      explanation: "The current design pays ~2 cents/GB effective (1 cent each direction) on 40 TB — about 800 USD/month — because tiers are pinned to <em>different</em> AZs, guaranteeing every hop crosses a boundary. <strong>A</strong> fixes the topology: every tier in every AZ with zone-aware routing keeps the hot path same-AZ (free over private IPs) and uses cross-AZ only during failures — cost falls AND availability improves. <strong>B</strong> eliminates the charge by eliminating AZ fault tolerance — explicitly excluded. <strong>C</strong> makes it worse: TGW adds ~2 cents/GB processing on top of the transfer it carries; it is a manageability tool, never a discount. <strong>D</strong> misunderstands peering — these tiers are in one VPC, and peering between VPCs still bills inter-AZ rates anyway; peering does not exempt cross-AZ bytes."
    },
    {
      q: "A cost review finds 220 unattached EBS gp2 volumes, 9,000 EBS snapshots retained indefinitely, and attached gp2 volumes provisioned large primarily to obtain IOPS. Which set of actions cleans this up with the LEAST risk and MOST savings?",
      options: [
        "Delete all snapshots older than 30 days, delete unattached volumes immediately, and leave attached volumes unchanged",
        "Snapshot then delete unattached volumes, adopt lifecycle management with Snapshot Archive for old long-retained snapshots, and migrate attached volumes to gp3 with explicitly provisioned IOPS",
        "Convert all volumes to io2 for better price-performance and enable Data Lifecycle Manager",
        "Archive all snapshots to S3 Deep Archive and convert unattached volumes to sc1"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> addresses all three findings safely: snapshot-then-delete preserves a cheap incremental restore path for the unattached volumes ('available' is a fully-billed state); snapshot lifecycle policies plus the Snapshot Archive tier (~75% cheaper, 90-day minimum) fix indefinite retention; and gp3 breaks gp2's IOPS-scales-with-size coupling — you buy IOPS directly at ~20% lower per-GB cost via a live modify-volume, then can shrink future provisioning. <strong>A</strong> deletes recovery points by age with no policy analysis (some may be the only backup of something) and deletes volumes with no restore path — savings, but not least risk. <strong>C</strong> moves in the wrong direction: io2 is the premium provisioned-IOPS tier and would raise costs dramatically. <strong>D</strong> is fictional plumbing: snapshots go to the EBS Snapshot Archive tier, not to S3 Deep Archive, and sc1 is for attached cold HDD throughput workloads — converting an unattached volume just bills a cheaper flavor of waste."
    },
    {
      q: "A media site serves 300 TB/month of content to global users directly from EC2 behind an ALB. Which change most reduces the data transfer bill?",
      options: [
        "Put CloudFront in front of the ALB so users are served from edge locations",
        "Move the EC2 fleet to the Region closest to the largest user population",
        "Enable S3 Transfer Acceleration on the content bucket",
        "Compress responses at the ALB to reduce egress volume"
      ],
      answer: [0],
      multi: false,
      explanation: "300 TB of internet egress from EC2 bills at the standard egress tiers (~9 cents/GB at the top tier — order of 20,000+ USD/month). <strong>A</strong> restructures the path: origin-to-CloudFront transfer is free, CloudFront egress is priced below EC2 egress at every volume tier (and negotiable lower with committed usage), and cache hits eliminate origin serving entirely — the standard answer for internet-facing volume. <strong>B</strong> changes latency, not rates — egress pricing is broadly similar across major regions and the bytes still exit to the internet. <strong>C</strong> misapplies a feature for <em>uploads</em> to S3 from distant clients; this workload is downloads from EC2. <strong>D</strong> helps (fewer bytes) and should be on anyway, but text compresses and media mostly does not — for a 300 TB media workload the achievable reduction is small next to the CloudFront rate-and-cache restructuring."
    },
    {
      q: "The FinOps team needs to attribute last month's costs to individual internal customers using a customer-id resource tag, at hourly granularity, joined against internal usage data, using SQL. Which approach is correct?",
      options: [
        "Use Cost Explorer grouped by the customer-id tag with daily granularity",
        "Enable CUR 2.0 delivery to S3 with resource IDs and cost allocation tags activated, and query it with Athena",
        "Use AWS Budgets filtered by tag to report per-customer costs",
        "Use the Cost Anomaly Detection API to export per-tag costs"
      ],
      answer: [1],
      multi: false,
      explanation: "The requirements — line-item tag columns, hourly granularity, arbitrary SQL joins against external data — describe the Cost and Usage Report exactly (<strong>B</strong>): CUR 2.0 lands in S3 (Parquet), carries activated cost allocation tags as columns and resource-level detail, and Athena is the standard query layer; note the tags must have been activated <em>before</em> the period, since activation is not retroactive. <strong>A</strong> fails multiple requirements: Cost Explorer's console/API aggregations do not support SQL joins with internal data, and its default granularity/grouping is a summary tool, not a ledger. <strong>C</strong> is a threshold/alerting tool — it monitors against limits, it does not produce attribution datasets. <strong>D</strong> misuses an ML deviation detector as a reporting engine; it emits anomalies, not comprehensive per-tag cost data."
    }
  ],
  flashcards: [
    { front: "What is the pricing-dimension mental model?", back: "Every service bills on 2-4 axes from four families: <strong>time x capacity</strong> (punishes idle), <strong>requests</strong> (punishes chattiness), <strong>bytes x time stored</strong> (punishes hoarding), <strong>bytes moved</strong> (punishes bad topology). Learn dimensions, not prices — eliminating a dimension beats discounting it." },
    { front: "The four core data transfer pricing rules?", back: "Internet <strong>in: free</strong>. Internet <strong>out: tiered (~9 cents/GB start)</strong>. <strong>Inter-AZ: ~1 cent/GB BOTH directions</strong>. <strong>Inter-region: ~2 cents/GB, source side</strong>. Same-AZ over private IPs: free." },
    { front: "NAT Gateway pricing and the classic waste pattern?", back: "~4.5 cents/hour + ~4.5 cents/GB <strong>processed</strong>. Classic waste: private subnets reaching S3/DynamoDB via NAT — a free <strong>gateway VPC endpoint</strong> eliminates the entire charge. Gateway endpoints exist only for S3 and DynamoDB." },
    { front: "Cost ranking: gateway endpoint vs interface endpoint vs NAT Gateway?", back: "Gateway endpoint: <strong>free</strong> (S3/DynamoDB only). Interface endpoint (PrivateLink): ~1 cent/hr per AZ + ~1 cent/GB. NAT Gateway: ~4.5 cents/hr + ~4.5 cents/GB. Order is stable: gateway &lt; interface &lt; NAT." },
    { front: "Why does CloudFront reduce transfer costs even for dynamic content?", back: "Origin-to-CloudFront transfer is <strong>free</strong> from AWS origins, and CloudFront egress is priced below EC2/S3 direct egress at every tier. Caching is a bonus; the rate arbitrage alone can pay for fronting APIs." },
    { front: "VPC peering vs Transit Gateway cost difference?", back: "Peering: no premium — just normal inter-AZ/inter-region rates (same-AZ free). TGW: attachment-hours per VPC <strong>plus ~2 cents/GB processed</strong> on top. TGW buys manageability with a per-GB tax; high-volume pairs may justify dedicated peering." },
    { front: "Standard RI vs Convertible RI?", back: "Standard: up to ~72% (3yr), locked to family (size-flex within family for regional Linux), resellable on RI Marketplace. Convertible: up to ~66%, exchangeable across family/OS/tenancy for equal-or-greater value." },
    { front: "Regional vs zonal RI — the key distinction?", back: "Regional: discount floats across AZs + size flexibility, <strong>no capacity reservation</strong>. Zonal: pinned to one AZ, no size flex, <strong>includes capacity reservation</strong>. 'Guarantee capacity' → zonal RI or ODCR; 'flexible discount' → regional." },
    { front: "Compute SP vs EC2 Instance SP vs SageMaker SP?", back: "Compute SP: ~66%, any EC2 family/region + <strong>Fargate + Lambda</strong> — maximum flexibility. EC2 Instance SP: ~72%, one family in one region (size/OS/AZ flex inside). SageMaker SP: separate plan for SageMaker. None reserve capacity; none cover RDS." },
    { front: "Which discount instruments cover RDS / ElastiCache?", back: "Service-specific <strong>Reserved Instances only</strong>. Savings Plans never cover RDS, ElastiCache, OpenSearch, or Redshift — a recurring exam distractor." },
    { front: "Coverage vs utilization for commitments?", back: "<strong>Utilization</strong> = fraction of purchased commitment actually applied (target ~100%; below = paying for air). <strong>Coverage</strong> = fraction of eligible usage discounted. Strategy: commit to the usage floor (trough, not average), ladder purchases quarterly." },
    { front: "How do commitments interact with consolidated billing?", back: "RI/SP discounts <strong>share across the organization</strong> — unused commitment floats to matching usage in other accounts (can be disabled per account). Volume tiers (S3, CloudFront) also aggregate org-wide under one payer." },
    { front: "Spot: discount, warning, and modern interruption model?", back: "Up to ~90% off; <strong>2-minute</strong> interruption warning (EventBridge + instance metadata). No bidding anymore — smooth prices; interruption is capacity reclamation. Defense: diversify (type x AZ) pools, price-capacity-optimized allocation, on-demand base tier." },
    { front: "The correct sequencing of cost optimization steps?", back: "Measure → <strong>rightsize</strong> → schedule off non-prod → Spot for interruptible work → <strong>commit last</strong> to the remaining floor. Committing before rightsizing locks in waste at a discount." },
    { front: "S3 minimum storage durations by class?", back: "Standard: none. Standard-IA / One Zone-IA: <strong>30 days</strong> (+128 KB min object billing). Glacier Instant & Flexible: <strong>90 days</strong>. Deep Archive: <strong>180 days</strong>. Intelligent-Tiering automatic tiers: none — part of why it is default-safe." },
    { front: "Why is Intelligent-Tiering the 'unknown access pattern' answer?", back: "Auto-tiers per object by observed access; <strong>no retrieval fees, no minimum durations</strong> on automatic tiers; small per-1,000-object monitoring fee (objects under 128 KB not monitored, stay hot-priced). Known-cold data still does better with explicit Glacier lifecycle rules." },
    { front: "The invisible S3 cost item every bucket needs a rule for?", back: "<strong>Incomplete multipart uploads</strong> — abandoned parts bill forever and are invisible to object listings. Add AbortIncompleteMultipartUpload (~7 days) lifecycle rule; also expire noncurrent versions in versioned buckets." },
    { front: "gp3 vs gp2 economics?", back: "gp3 ~20% cheaper per GB, includes 3,000 IOPS / 125 MBps baseline regardless of size, and sells extra IOPS/throughput separately. gp2 couples IOPS to size, forcing capacity overprovisioning for performance. Migration is a live modify-volume." },
    { front: "EBS Snapshot Archive tier?", back: "~75% cheaper than standard snapshot storage; <strong>90-day minimum</strong>; 24-72h restore to standard tier before use. For snapshots retained long-term and rarely restored. Unattached volumes, by contrast, bill at full rate — 'available' is a billing state." },
    { front: "DynamoDB on-demand vs provisioned crossover?", back: "On-demand ≈ <strong>6-7x</strong> the per-request cost of fully-utilized provisioned. Crossover ≈ <strong>15-20% average utilization</strong>: steadier than that → provisioned (+auto scaling, + reserved capacity); spikier/idler → on-demand." },
    { front: "Aurora I/O-Optimized decision rule?", back: "If I/O charges exceed <strong>~25% of the Aurora bill</strong>, I/O-Optimized (no I/O charges, ~30% higher instance/storage rates) is cheaper — and it caps tail risk from I/O spikes. Switchable per cluster once per 30 days." },
    { front: "Lambda cost formula and the counterintuitive tuning result?", back: "Requests + <strong>GB-seconds</strong> (memory x duration, 1ms granularity). Memory is also the CPU knob: raising memory can shorten duration enough that cost stays flat while latency halves — tune empirically (Power Tuning / Compute Optimizer)." },
    { front: "API Gateway REST vs HTTP API pricing?", back: "REST ~3.50 USD/million requests; HTTP ~1.00 USD/million — <strong>~3.5x cheaper</strong>. Choose REST only for features that need it (usage plans/API keys, request validation, caching, private APIs). 'Reduce API GW cost, no advanced features' → migrate to HTTP API." },
    { front: "CloudWatch Logs: which dimension is the cost lever?", back: "<strong>Ingestion (~0.50 USD/GB)</strong> dominates storage (~0.03/GB-month) by ~17x. Levers: drop debug at source, sample, Infrequent Access class, set retention (default never expires). Retention tuning barely helps an ingestion problem." },
    { front: "Cost Explorer vs CUR 2.0 — when is each authoritative?", back: "Cost Explorer: interactive/API aggregation, 13-month history, RI/SP coverage-utilization reports, forecasts. CUR 2.0: the ground-truth line-item ledger in S3 (Parquet), hourly + resource-level + tag columns, queried with Athena — 'most granular / SQL' → CUR." },
    { front: "Budgets vs Cost Anomaly Detection?", back: "Budgets: known thresholds — actual or <strong>forecasted</strong> alerts, and <strong>Budget Actions</strong> can enforce (apply restrictive policy, stop EC2/RDS). Anomaly Detection: ML baseline, catches unknown-unknown deviations with root-cause hints, free. Deploy both." },
    { front: "What must happen before tags appear in cost reports?", back: "Tags must be <strong>activated as cost allocation tags</strong> in the billing console — activation is not retroactive and takes up to ~24h. Enforce standards with tag policies + require-tag guardrails; roll up with Cost Categories." }
  ],
  lab: {
    title: "Lab: build the cost guardrail stack (budget + action, anomaly monitor, CE query)",
    html: `
<h3>Goal</h3>
<p>Stand up the minimum viable cost-governance stack on a real account: an activated view of your
own usage via the Cost Explorer API, a budget with a forecasted-spend alert, and a cost anomaly
monitor — then tear it down. Cost: Cost Explorer API calls bill 1 cent each (this lab makes 2-3);
the first two budgets are free; anomaly detection is free. Total: under a dime.</p>

<h3>Architecture</h3>
<p>No servers. AWS Budgets evaluates spend against a monthly limit and notifies an email endpoint
on forecasted breach; Cost Anomaly Detection runs an ML baseline over per-service spend with its
own alert subscription; the Cost Explorer API provides the programmatic what-happened view that a
FinOps pipeline would consume. (Budget <em>actions</em> — auto-applying a deny policy — need an
IAM role and real spend to demonstrate, so this lab configures the alerting tier; the action wiring
is noted where it would attach.)</p>

<h3>Steps</h3>
<ol>
<li><p>Query your last two months of spend by service — the dimension-decomposition habit
(1 cent per call):</p>
<pre><code>START=$(date -d "$(date +%Y-%m-01) -1 month" +%Y-%m-%d 2&gt;/dev/null || date -v-1m +%Y-%m-01)
END=$(date +%Y-%m-%d)
aws ce get-cost-and-usage \
  --time-period Start=$START,End=$END \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[].Groups[?Metrics.UnblendedCost.Amount!=to_string(&#96;0&#96;)]' \
  --output table 2&gt;/dev/null || \
aws ce get-cost-and-usage \
  --time-period Start=$START,End=$END \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE --output table</code></pre>
<p>Then re-run grouped by <code>Type=DIMENSION,Key=USAGE_TYPE</code> and find your transfer line
items (usage types containing DataTransfer, NatGateway-Bytes) — this is the bill decomposing into
the four dimension families from the lesson.</p></li>
<li><p>Create a monthly cost budget with an 80%-forecasted alert (save as
<code>budget.json</code> and <code>notif.json</code>; use your real email):</p>
<pre><code>cat &gt; budget.json &lt;&lt;'EOF'
{
  "BudgetName": "lab-monthly-guardrail",
  "BudgetLimit": { "Amount": "25", "Unit": "USD" },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
EOF
cat &gt; notif.json &lt;&lt;'EOF'
[{
  "Notification": {
    "NotificationType": "FORECASTED",
    "ComparisonOperator": "GREATER_THAN",
    "Threshold": 80,
    "ThresholdType": "PERCENTAGE"
  },
  "Subscribers": [
    { "SubscriptionType": "EMAIL", "Address": "you@example.com" }
  ]
}]
EOF
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
aws budgets create-budget --account-id $ACCOUNT \
  --budget file://budget.json \
  --notifications-with-subscribers file://notif.json</code></pre>
<p>Note <code>FORECASTED</code>: this is the alert that fires <em>before</em> the money is spent.
In production you would add a second, ACTUAL notification at 100%, and attach a budget action
(an IAM policy like DenyExpensiveOperations applied via a budgets-managed role) for sandbox
accounts.</p></li>
<li><p>Create an anomaly monitor (per-service baseline) and a daily alert subscription:</p>
<pre><code>MONITOR_ARN=$(aws ce create-anomaly-monitor --anomaly-monitor '{
  "MonitorName": "lab-service-monitor",
  "MonitorType": "DIMENSIONAL",
  "MonitorDimension": "SERVICE"
}' --query MonitorArn --output text)
SUB_ARN=$(aws ce create-anomaly-subscription --anomaly-subscription '{
  "SubscriptionName": "lab-anomaly-alerts",
  "MonitorArnList": ["'"$MONITOR_ARN"'"],
  "Subscribers": [{ "Type": "EMAIL", "Address": "you@example.com" }],
  "Frequency": "DAILY",
  "ThresholdExpression": {
    "Dimensions": {
      "Key": "ANOMALY_TOTAL_IMPACT_ABSOLUTE",
      "MatchOptions": ["GREATER_THAN_OR_EQUAL"],
      "Values": ["5"]
    }
  }
}' --query SubscriptionArn --output text)</code></pre>
<p>The threshold expression says: only alert on anomalies with at least 5 USD total impact —
tune this to taste; too low and you train yourself to ignore the alerts, which is the real-world
failure mode of every alerting system.</p></li>
</ol>

<h3>Verify</h3>
<ol>
<li><pre><code>aws budgets describe-budgets --account-id $ACCOUNT \
  --query 'Budgets[].{Name:BudgetName,Limit:BudgetLimit.Amount}'
aws ce get-anomaly-monitors --query 'AnomalyMonitors[].MonitorName'
aws ce get-anomaly-subscriptions --query 'AnomalySubscriptions[].SubscriptionName'</code></pre></li>
<li><p>Check your inbox for the budget confirmation. The anomaly monitor needs ~24-36h of data
before it baselines — leave it running a day if you want to see it live (it is free), or proceed
to teardown.</p></li>
</ol>

<h3>Teardown</h3>
<p>Ordered — subscription before monitor (the subscription references it):</p>
<ol>
<li><pre><code>aws ce delete-anomaly-subscription --subscription-arn $SUB_ARN
aws ce delete-anomaly-monitor --monitor-arn $MONITOR_ARN</code></pre></li>
<li><pre><code>aws budgets delete-budget --account-id $ACCOUNT \
  --budget-name lab-monthly-guardrail</code></pre></li>
<li><pre><code>rm -f budget.json notif.json</code></pre></li>
<li><p>Confirm clean:</p>
<pre><code>aws budgets describe-budgets --account-id $ACCOUNT --query 'Budgets[].BudgetName'
aws ce get-anomaly-monitors --query 'AnomalyMonitors'</code></pre>
<p>(Nothing here bills at rest, but leaving lab alerting configured pollutes the signal path
you would use for real — tear it down anyway. In a real account, you would now rebuild this
deliberately: two budgets, actions on sandboxes, anomaly monitors per team with owners.)</p></li>
</ol>
`
  }
});
