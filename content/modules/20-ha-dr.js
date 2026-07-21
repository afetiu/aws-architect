/* Module 20 — High Availability & Disaster Recovery */
window.COURSE.register({
  id: "ha-dr",
  order: 20,
  track: "saa",
  title: "High Availability & Disaster Recovery",
  description: "Availability as arithmetic, failure domains as design inputs: serial vs parallel composition, static stability, the four DR strategies mapped to RTO/RPO/cost, AWS Backup and DRS, database DR options compared, Route 53 ARC, and the failure modes of recovery itself — retry storms, quota exhaustion, and untested runbooks.",
  examWeight: "Resilient Architectures is the largest SAA-C03 domain (~26%). Expect multiple 'choose the DR strategy for this RTO/RPO' questions, Aurora Global vs cross-region replica comparisons, and at least one question where the trap is a control-plane dependency during failover.",
  lessons: [
    {
      id: "availability-math",
      title: "Availability math: serial chains, parallel redundancy, and what SLAs are not",
      html: `
<p>Availability composes like reliability block diagrams, and the two rules explain most
architecture decisions AWS will ever show you:</p>
<ul>
<li><strong>Serial composition multiplies.</strong> A request path through components A and B is up
only when both are: A_total = A_a x A_b. Availabilities are &le; 1, so every hop <em>subtracts</em>
nines. Five dependencies at 99.99% each: 0.9999^5 ≈ 99.95% — your 'four nines' chain is a
three-and-a-half-nines system before you wrote any bugs.</li>
<li><strong>Parallel redundancy multiplies unavailability.</strong> Two independent 99% components
where either suffices: 1 - (0.01 x 0.01) = 99.99%. Redundancy buys nines multiplicatively —
<em>if and only if</em> failures are independent, which is the entire game.</li>
</ul>

<h3>The numbers as time</h3>
<table>
<thead><tr><th>Availability</th><th>Downtime/year</th><th>Downtime/month</th></tr></thead>
<tbody>
<tr><td>99% (2 nines)</td><td>~3.65 days</td><td>~7.3 hours</td></tr>
<tr><td>99.9%</td><td>~8.77 hours</td><td>~43.8 min</td></tr>
<tr><td>99.95%</td><td>~4.38 hours</td><td>~21.9 min</td></tr>
<tr><td>99.99%</td><td>~52.6 min</td><td>~4.4 min</td></tr>
<tr><td>99.999%</td><td>~5.26 min</td><td>~26 sec</td></tr>
</tbody>
</table>
<p>Two consequences senior engineers internalize: (1) at four nines and above, <em>humans cannot
be in the recovery loop</em> — 4.4 minutes a month does not survive a pager, a login, and a
decision; failover must be automatic; (2) your availability target dictates your <em>change</em>
process more than your architecture — most downtime is deployment-caused, and a 99.99% target is
mostly a statement about rollout safety (canaries, one-AZ-at-a-time, automatic rollback).</p>

<div class="callout deep">The independence assumption is where the math lies to you. Two 'redundant'
instances behind one ALB in one AZ share: the AZ, the deployment pipeline (a bad deploy hits both —
serially correlated by your CI/CD), configuration, certificates, upstream dependencies, and often a
single on-call human. Correlated failure modes put you back on the serial curve. This is why AWS's
resilience story is structured as <em>fault isolation boundaries</em> — AZ, region, cell, partition
— each one an engineering effort to manufacture independence, and why 'deploy the same bug to both
regions simultaneously' is the canonical way to defeat a multi-region architecture.</div>

<div class="callout exam">Exam math you should do in seconds: composite availability of serial
services = product (two 99.9% services in a chain = 99.8%); parallel identical components =
1 - (1-a)^n. And the qualitative version: 'adding a dependency lowers availability; adding a
redundant path raises it.' Questions phrase this as 'the application now calls an external service —
what happens to availability?' The answer is it drops, unless the call is made non-blocking /
gracefully degradable — turning a serial dependency into an optional one is an architecture
answer, not a math answer.</div>

<h3>SLA credits are not availability</h3>
<p>An SLA is a <strong>refund schedule, not an engineering guarantee</strong>. EC2's region-level
SLA (99.99%) pays back a percentage of the affected service's bill if breached — it does not
compensate your revenue loss, and it does not make failures less likely. Composing vendor SLAs
('EC2 99.99% x ALB 99.99% x RDS Multi-AZ 99.95% = my SLA') gives a <em>lower bound estimate</em>
for planning, but the contractual SLAs cover narrow definitions (region-pair unavailability,
specific error classes) that rarely match your user-visible failure modes. Design to your own SLOs
measured at the client; treat vendor SLAs as pricing metadata.</p>

<div class="callout war">A pattern from real postmortems: teams compute the composite SLA of the
happy path and forget the <em>recovery path</em> has its own availability. Your failover depends on
Route 53 health checks, IAM, the region's control plane, your CI system holding the runbook scripts,
and the VPN the on-call uses. If recovery-path availability is lower than steady-state availability,
your real number is dominated by how often you need recovery times how often recovery works. This is
the argument for static stability, next lesson.</div>

<p>Finally, MTBF/MTTR framing: availability = MTBF / (MTBF + MTTR). You usually cannot buy much
MTBF beyond what redundancy gives — but MTTR is nearly free to attack: detection time (alerting on
symptoms not causes), decision time (pre-authorized runbooks), execution time (automation). Halving
MTTR adds the same nines as doubling MTBF, at a fraction of the cost. Most 'HA engineering' with
high ROI is actually MTTR engineering.</p>
`
    },
    {
      id: "failure-domains",
      title: "Failure domains and static stability",
      html: `
<p>Design for failure starts with an inventory of what fails <em>together</em>. AWS gives you a
hierarchy of blast radii; your job is to decide which ones you survive, and to not accidentally
couple across them.</p>

<h3>The domain hierarchy and its real failure modes</h3>
<ul>
<li><strong>Instance/host</strong>: hardware death, EBS volume stuck, kernel panic. Handled by ASG
replacement and Multi-AZ data. Trivial if you are stateless; the whole art if you are not.</li>
<li><strong>AZ</strong>: power/cooling/network partition of one or more data centers. AZs are
engineered independent (separate facilities, power, flood plains; connected by ~sub-2ms metro
fiber) — the design unit of intra-region HA. Real AZ events are often <em>gray</em>, not binary:
elevated error rates, one AZ's NAT or EBS degraded — which is why zonal shift / zonal autoshift
(ARC) exists to evacuate an impaired AZ rather than waiting for it to 'fail'.</li>
<li><strong>Region</strong>: rare, but real events have taken out regional services (the historical
us-east-1 incidents). Surviving this is DR proper — the rest of this module.</li>
<li><strong>Control plane vs data plane — the most-tested and least-understood split.</strong> The
<em>data plane</em> is the thing doing steady-state work: running instances, existing Route 53
answers being served, an ALB forwarding, DynamoDB serving reads. The <em>control plane</em> is the
mutation API: RunInstances, CreateLoadBalancer, Route 53's record-change API, IAM propagation.
AWS engineers data planes for higher availability than control planes, and incidents reflect it:
a classic regional event leaves running things running while <em>changes</em> fail. Route 53 is
the canonical example: the DNS-answering data plane has a 100% availability design goal, while
the record-change control plane is a regional (us-east-1) service that has been unavailable during
exactly the incidents when people wanted to update records.</li>
</ul>

<h3>Static stability: the design consequence</h3>
<p>A system is <strong>statically stable</strong> when it keeps operating through a dependency
failure <em>without needing to make any changes</em> — no API calls, no scaling, no
reconfiguration, no human. The recovery path is 'nothing', which is the only recovery path with
100% availability. Concretely:</p>
<ul>
<li><strong>Pre-provision AZ-loss capacity</strong>: run 3 AZs at &le; 66% utilization each (or 2 at
50%), so losing an AZ requires <em>no</em> scale-up to absorb the load. The naive alternative —
'ASG will launch replacements' — depends on the EC2 control plane, at the exact moment everyone
else in the region is also calling RunInstances (capacity contention is real during AZ events).</li>
<li><strong>Failover via data-plane operations</strong>: Route 53 <em>health checks</em> flipping
between existing records are data-plane (serving answers); <em>changing</em> records via API is
control-plane. This is why Route 53 ARC routing controls exist as a separate, extremely-hardened
data plane spread across five regions — flipping a routing control is designed to work during the
disaster. Same logic: DynamoDB global tables already replicating (data plane) vs promoting an RDS
replica (control-plane operation).</li>
<li><strong>Pre-create, do not create-on-failover</strong>: the DR region's VPCs, roles, endpoints,
launch templates, and (for warm standby) running fleet exist <em>before</em> the event. Anything
your failover must create is a bet that a control plane is up and has capacity.</li>
</ul>

<div class="callout exam">Trap pattern: any answer where surviving an AZ/region failure requires
<em>launching</em> or <em>creating</em> something in the moment is weaker than an answer where
capacity/config already exists. 'Schedule an ASG to scale after failure' loses to 'run over-
provisioned across 3 AZs'. 'Update the Route 53 record when the region fails' loses to 'health
check + failover routing policy already configured' and even more so to 'ARC routing control'.
Keywords: 'statically stable', 'without requiring any changes during the event', 'must not depend
on the control plane'.</div>

<div class="callout deep">Why control planes are structurally less available: they are where the
hard consistency lives. Mutations must be validated, serialized, recorded durably, and propagated
— coordination-heavy work with more dependencies (auth, quota, billing, placement) — while data
planes are engineered to run from local, eventually-refreshed state. AWS builds data planes to
degrade gracefully when the control plane is away: an ALB keeps balancing with its last-known
target list, DNS keeps answering from replicated zone data, instances keep running. Architect the
same way: your services should serve from cached config when your own config service is down.</div>

<div class="callout war">Control-plane dependencies hide in innocuous places: a failover script
that calls STS AssumeRole in the failed region; boot-time user-data that pulls from a regional
package mirror; autoscaling lifecycle hooks calling a Lambda in the impaired AZ; 'break-glass'
IAM users whose console access needs a working identity provider. Audit the recovery path for
every API call it makes and ask: what if this call fails or takes 10 minutes? Game days (later
lesson) are how you find the ones the audit missed.</div>

<p>Blast-radius thinking completes the picture: prefer zonal isolation (independent stacks per AZ
with zonal load balancer targets) over region-spanning pools when you can, because it converts
gray AZ failures into a clean 'evacuate one-third of capacity' operation. That is the same instinct
that leads to cell-based architecture — covered in the final lesson.</p>
`
    },
    {
      id: "dr-strategies",
      title: "The four DR strategies: RTO/RPO/cost as one dial",
      html: `
<p>The four canonical strategies are points on a single trade-off curve: how much of the recovery
region's architecture exists (and runs) <em>before</em> the disaster. More pre-existing = lower
RTO/RPO = higher steady-state cost. Learn the tiers with their per-layer architecture, because the
exam tests the <em>composition</em>, not the names.</p>

<table>
<thead><tr><th>Strategy</th><th>RTO</th><th>RPO</th><th>What runs in DR region</th><th>Cost shape</th></tr></thead>
<tbody>
<tr><td><strong>Backup &amp; restore</strong></td><td>Hours (to a day+)</td><td>Hours (backup interval)</td><td>Nothing — backups + IaC templates only</td><td>Storage only</td></tr>
<tr><td><strong>Pilot light</strong></td><td>Tens of minutes</td><td>Seconds-minutes (data replicates live)</td><td>Data layer live; core services present but stopped/zero-scaled</td><td>Data replication + idle minimal footprint</td></tr>
<tr><td><strong>Warm standby</strong></td><td>Minutes</td><td>Seconds-minutes</td><td>Full stack running, scaled-down but serving-capable</td><td>A small fraction of prod, always on</td></tr>
<tr><td><strong>Multi-site active-active</strong></td><td>Near-zero</td><td>Near-zero</td><td>Full capacity, taking live traffic</td><td>~2x (or n/(n-1) across n regions)</td></tr>
</tbody>
</table>

<h3>Per-tier architecture detail</h3>
<ul>
<li><strong>Backup &amp; restore</strong>: AWS Backup copies (cross-region, cross-account) of
EBS/RDS/DynamoDB/EFS; S3 CRR for objects; AMIs and IaC (CloudFormation/CDK/Terraform) as the
'backup' of the infrastructure itself. Recovery = provision everything from scratch, restore data,
repoint DNS. RTO is dominated by data restore time (a 10 TB RDS restore is hours) — <em>measure
it</em>, do not estimate it. Cheapest by far; right for tier-3 workloads and as the universal
floor: everything gets this even if it also gets more.</li>
<li><strong>Pilot light</strong>: the 'pilot flame that lights the furnace'. Data layer is
<em>live</em> — RDS cross-region read replica or Aurora Global secondary, DynamoDB global table,
S3 CRR — because data cannot be 'quickly started'; it must already be there. Compute exists as
stopped instances / launch templates / ASGs at zero / ECS services at 0 tasks, images pre-baked
in the region. Recovery = promote the data layer, scale compute from 0, flip traffic. RTO is
boot + scale + promotion time.</li>
<li><strong>Warm standby</strong>: pilot light plus the fleet actually <em>running</em>, scaled
down (e.g., 10% capacity) but functional — it can serve a trickle of traffic continuously, which
means it is <em>continuously tested</em> by real requests, the property that makes warm standby
qualitatively more trustworthy than pilot light. Recovery = scale up + shift traffic; RTO is
minutes (scale-up time — and if you pre-provision full capacity, seconds).</li>
<li><strong>Active-active</strong>: both regions serve; data layer must handle multi-region writes
— DynamoDB global tables (last-writer-wins conflicts), Aurora Global with write forwarding (writes
still execute at the primary), or partitioned/home-region writes. Route 53 latency/geoproximity
or Global Accelerator spreads traffic; 'failover' is just removing a region from rotation. The
hard cost is not 2x infrastructure — it is the permanent engineering tax of conflict handling,
regional data residency, and deploys that cannot hit both regions at once.</li>
</ul>

<h3>Traffic failover layer</h3>
<p><strong>Route 53</strong> failover routing (health-checked primary → secondary) is the default;
remember TTL physics — clients and resolvers cache, so DNS failover time = detection + TTL +
client behavior, realistically minutes with 60s TTLs and worse with badly-behaved clients.
<strong>Global Accelerator</strong> moves failover below DNS: static anycast IPs, connection
termination at the edge, endpoint health steering in ~seconds, no client cache to wait out —
the answer when the scenario says 'static IPs' or 'clients cache DNS'. Both are data-plane
failover if health-check-driven; an operator changing records is control-plane (see ARC lesson).</p>

<div class="callout exam">The exam gives you RTO/RPO numbers and expects the tier: 'RPO 24h, RTO
24h, minimize cost' → backup &amp; restore. 'RPO minutes/seconds, RTO under an hour, cost-
conscious' → pilot light. 'RTO of minutes' → warm standby. 'RTO/RPO near zero, cost no object' →
active-active. Discriminator between pilot light and warm standby: is the app tier <em>running
and able to serve requests</em> (warm) or provisioned-but-stopped (pilot light)? Between warm and
active-active: is the second region taking production traffic? Also watch for 'the business will
accept re-creating data since the last nightly backup' — that sentence is an RPO of hours and
licenses backup &amp; restore.</div>

<div class="callout limits">Capacity in the recovery region is not guaranteed by default. During a
real regional event, everyone fails over into the same alternate regions at once; on-demand
capacity for large fleets may simply not be there, and default service quotas in a never-used
region are low (an account that has never launched in us-west-2 may have tiny EC2 limits). Fixes:
On-Demand Capacity Reservations (billed, certain) or at minimum pre-raised quotas in the DR region
— covered again in the final lesson because it is a real DR-killer.</div>

<div class="callout war">The most common warm-standby failure in practice is drift: prod gets a
new environment variable, a new queue, a security-group tweak — applied by hand, never to DR. Six
months later failover fails on the delta. Countermeasures: single IaC source deployed to both
regions in the same pipeline, drift detection, and routing a small percentage of real traffic
through the standby continuously (making it a de facto active-active at 95/5) so breakage
surfaces as a blip, not during the disaster.</div>

<p>Finally: DR strategy is per-workload, not per-company. Tier the portfolio by business impact
(next lesson derives RTO/RPO properly), give the payment path warm standby and the internal
wiki backup &amp; restore, and revisit at every architecture review — DR requirements decay into
fiction unless re-derived.</p>
`
    },
    {
      id: "rto-rpo-backup",
      title: "Deriving RTO/RPO, AWS Backup, and Elastic Disaster Recovery",
      html: `
<p><strong>RTO</strong> (Recovery Time Objective): maximum tolerable time from disruption to
service restoration. <strong>RPO</strong> (Recovery Point Objective): maximum tolerable data loss,
measured as time — 'we can lose up to 15 minutes of writes'. Neither is an engineering preference;
both are <em>derived from business impact and bought at a price</em>. The honest derivation
process: for each workload, quantify cost-of-downtime per hour (revenue, contractual penalties,
safety, reputation) and cost-of-data-loss per hour of lost writes; then pick the cheapest DR tier
whose RTO/RPO keeps expected loss below what the business will pay to avoid. Written down, this
kills the two standard dysfunctions: every team claiming RTO=0 (until they see the bill for
active-active), and DR budgets assigned by org chart instead of by impact.</p>

<div class="callout exam">RPO maps to <em>how you move data</em>: nightly backups → RPO 24h;
continuous async replication (Aurora Global, DynamoDB global tables, DRS block replication) →
RPO seconds; synchronous replication (Multi-AZ) → RPO ~0 but only within its distance domain.
RTO maps to <em>what already exists</em> at the recovery site (previous lesson). When a question
gives 'RPO 5 minutes', nightly-snapshot answers are eliminated instantly regardless of what else
they offer.</div>

<h3>AWS Backup: the centralized policy layer</h3>
<p>AWS Backup exists because per-service backup features (EBS snapshots, RDS automated backups,
DynamoDB PITR, EFS backups) grew up independently and auditing fifteen mechanisms is how backups
silently stop happening. The model:</p>
<ul>
<li><strong>Backup plans</strong>: schedule + lifecycle (transition to cold storage, retention)
+ copy rules, applied to resources by <strong>tag-based selection</strong> — 'everything tagged
backup:prod gets this plan' turns backup from per-resource configuration into governed policy.
Org-wide backup policies via Organizations push plans to every account.</li>
<li><strong>Vaults</strong>: encrypted (KMS) containers for recovery points with their own access
policies. <strong>Cross-region copy</strong> (DR) and <strong>cross-account copy</strong> (into a
locked-down backup account) can be chained — the standard ransomware posture is both: another
account in another region, unreachable with production credentials.</li>
<li><strong>Vault Lock</strong>: WORM enforcement on a vault. Governance mode is permissioned;
<strong>compliance mode, once its cooling-off period expires, cannot be removed by anyone,
including root and AWS Support</strong> — recovery points become undeletable until retention
lapses. This is the 'backups must survive compromised admin credentials / malicious insider /
ransomware' answer, and the reason to triple-check retention before locking: compliance mode is
a one-way door.</li>
<li>Extras worth knowing: point-in-time restore support for some services, restore <em>testing</em>
plans (scheduled automated restores that validate recoverability — backups are Schrödinger's data
until restored), legal holds, and an audit framework (Backup Audit Manager) for proving policy
compliance.</li>
</ul>

<div class="callout war">The universal backup pathologies AWS Backup is designed against: (1)
backups configured at creation, silently missing on resources created later — tag-based selection
plus an audit framework closes it; (2) backups stored with the same credentials/region as prod —
one compromised key deletes both copies; cross-account vault + Vault Lock closes it; (3) restores
never tested — the 10 TB restore that takes 14 hours against a 4-hour RTO is discovered during
the disaster; restore testing plans close it. If you cannot state your last successful restore
test date, you do not have backups; you have hope.</div>

<h3>Elastic Disaster Recovery (DRS)</h3>
<p>DRS is MGN's sibling (same CloudEndure lineage, same agent tech) aimed at DR instead of
migration: <strong>continuous block-level replication</strong> of on-prem or cloud servers into a
<strong>low-cost staging area</strong> in the recovery region — small EC2 instances + inexpensive
EBS holding a continuously-updated copy — with on-demand conversion and launch of full-size
recovery instances only when you fail over (or drill). The economics are the point: you pay
staging costs (a few percent of the protected fleet's run cost) continuously, and full compute
cost only during recovery/drills. That lands DRS between pilot light and warm standby for
<em>server-based</em> workloads: RPO seconds (continuous replication), RTO minutes-to-tens-of-
minutes (launch + conversion), without maintaining a parallel running fleet.</p>
<ul>
<li><strong>Point-in-time recovery</strong>: DRS keeps snapshots, so you can launch from minutes
ago or days ago — which makes it a ransomware answer too (recover to a pre-encryption point),
not just a site-loss answer.</li>
<li><strong>Drills are first-class</strong>: launch recovery instances in an isolated subnet
without touching replication; failback (reverse replication to the original site) is built in.</li>
<li>Use it for: lift-and-shift estates, on-prem DR into AWS (the 'replace the second data
center' pitch), databases on EC2 with no managed replication story. Do not use it where a
managed-service-native option is better: RDS/Aurora/DynamoDB replicate themselves; S3 has CRR;
DRS is for <em>servers</em>.</li>
</ul>

<div class="callout exam">Distinguish the siblings: <strong>MGN</strong> = migration (one-way,
cutover, then done). <strong>DRS</strong> = DR (continuous protection, drills, failback). Keywords
for DRS: 'on-premises disaster recovery to AWS', 'RPO of seconds, RTO of minutes, minimize ongoing
cost', 'point-in-time recovery from ransomware for servers'. Keyword for AWS Backup Vault Lock:
'backups protected from deletion even by administrators/root'. If the scenario is centralized
backup governance across accounts and services → AWS Backup, not per-service scripting.</div>

<div class="callout limits">Numbers: Backup vault lock compliance mode has a minimum 3-day
cooling-off before immutability hardens. DRS staging uses low-cost instances/volumes (that is
the pricing pitch) and per-server hourly pricing; replication lag — hence RPO — is typically
single-digit seconds on adequate bandwidth: size the replication link for write <em>rate</em>,
not disk size, after the initial sync.</div>
`
    },
    {
      id: "database-dr",
      title: "Database DR options compared: replicas, global tables, and CRR",
      html: `
<p>The data layer defines your real RPO — everything else is re-creatable from IaC. Compare the
options by three axes: replication mechanism (what RPO physics allows), failover mechanics (what
RTO the promotion path allows, and whether it is control-plane), and write topology afterward.</p>

<h3>RDS cross-region read replica promotion</h3>
<p>Classic engine-level async replication (binlog/WAL streaming) to another region. Replica serves
reads; on disaster you <strong>promote</strong> — a control-plane operation that breaks
replication, reboots the instance as a standalone writer, and takes minutes. Then <em>you</em>
repoint the application (DNS/config), rebuild Multi-AZ on the new primary, and — for failback —
re-establish replication manually in reverse. RPO: replication lag (seconds to unbounded under
heavy write load — monitor it, it is your live RPO gauge). RTO: promotion + your orchestration,
realistically tens of minutes. It is the budget option and the only cross-region option for some
engines; its weaknesses are manual orchestration and lag sensitivity.</p>

<h3>Aurora Global Database</h3>
<p>Replication happens at the <strong>storage layer</strong>, not the SQL engine: redo log records
ship to secondary-region storage with typical lag under a second, imposing near-zero load on the
primary (no replica applying SQL). Failover paths, and the distinction the exam loves:</p>
<ul>
<li><strong>Managed planned switchover</strong> (healthy regions, e.g., DR drills or region
rotation): coordinated, guarantees <strong>RPO = 0</strong> — replication drains before roles
swap, old primary automatically becomes a secondary. Minutes, no data loss, reversible.</li>
<li><strong>Unplanned failover / detach-and-promote</strong> (primary region down): promote a
secondary with <strong>RPO = replication lag (typically &lt; 1s)</strong>, RTO typically under
a few minutes. AWS publishes the design targets RPO ~1s / RTO ~1 minute for Global Database —
the marquee numbers to remember.</li>
<li>Secondaries serve low-lag global reads meanwhile; <strong>write forwarding</strong> lets apps
in secondary regions issue writes that transparently execute on the primary — convenience, not
multi-master.</li>
</ul>

<h3>DynamoDB Global Tables</h3>
<p><strong>Active-active multi-region writes</strong>: every replica table accepts writes,
replication is async (typically ~1s), conflicts resolve <strong>last-writer-wins</strong> on
timestamp. There is no 'failover' — a region's clients just use another replica; RTO is whatever
your routing layer needs, RPO is replication lag on writes not yet propagated from a lost region.
This is the easiest near-zero-RTO data layer in AWS <em>if</em> your data model tolerates LWW
(idempotent writes, or partitioned write ownership per region — the standard discipline is 'each
record has a home region' to make conflicts structurally impossible). If two regions concurrently
update the same item meaningfully, LWW silently discards one — that is your real RPO fine print.</p>

<h3>S3 Cross-Region Replication (+ RTC)</h3>
<p>Async object replication, new objects (existing via Batch Replication). Plain CRR has
<strong>no time SLA</strong> — most objects in minutes, but tail latency is unbounded.
<strong>Replication Time Control (RTC)</strong> adds an SLA: 99.99% of objects within
<strong>15 minutes</strong>, with replication metrics/events to alert on misses — that is the
compliance answer ('must prove replication within a deadline'). Replicate delete markers
deliberately or not at all (accidental-deletion protection vs true mirroring); combine with
versioning (mandatory) and consider bidirectional CRR for active-active buckets.</p>

<h3>The comparison table to carry into the exam</h3>
<table>
<thead><tr><th></th><th>RDS x-region replica</th><th>Aurora Global</th><th>DynamoDB Global Tables</th><th>S3 CRR + RTC</th></tr></thead>
<tbody>
<tr><td>Mechanism</td><td>Engine async (binlog/WAL)</td><td>Storage-layer redo shipping</td><td>Item-level async, multi-writer</td><td>Object async</td></tr>
<tr><td>Typical RPO</td><td>Lag: seconds→minutes, load-sensitive</td><td>&lt;1s (0 for planned switchover)</td><td>~1s + LWW conflict loss</td><td>Minutes; RTC: 15-min 99.99% SLA</td></tr>
<tr><td>RTO</td><td>Tens of minutes, manual orchestration</td><td>~1-few minutes, managed</td><td>~0 (reroute only)</td><td>~0 (bucket already live)</td></tr>
<tr><td>Writes after failover</td><td>Single new primary</td><td>Single new primary</td><td>Always multi-region</td><td>n/a</td></tr>
</tbody>
</table>

<div class="callout exam">Mappings: 'RPO ~1s / RTO ~1min for a relational database' → Aurora
Global Database. 'zero data loss during a planned regional switchover' → Aurora managed
switchover. 'multi-region active-active with single-digit-ms access' → DynamoDB global tables
(watch for the conflict caveat in a 'strongly consistent across regions' distractor — global
tables are NOT strongly consistent cross-region; strong consistency is within a region only).
'objects must be replicated within a defined time, with evidence' → S3 RTC. 'cheapest cross-region
relational DR, minutes of RPO acceptable' → RDS cross-region read replica.</div>

<div class="callout war">Post-failover amnesia is the recurring production wound: the app fails
over but its <em>writes-adjacent ecosystem</em> does not — KMS keys are regional (multi-Region
keys exist; plan them), Lambda event source mappings, SQS queues, Secrets Manager secrets
(replicate them), parameter store values, and IAM-attached resource policies referencing regional
ARNs. And after promotion, the old primary keeps accepting writes from stragglers unless you
fence it (security groups, revoked credentials) — split-brain via forgotten batch jobs writing to
the old endpoint is a classic. Failover is a system property, not a database property.</div>
`
    },
    {
      id: "arc-testing",
      title: "Route 53 ARC, failover testing, game days, and FIS",
      html: `
<p>If failover requires a human to run a DNS change through a regional control plane, your DR
plan's availability is bounded by that control plane's availability during the worst hour of its
year. Route 53 <strong>Application Recovery Controller (ARC)</strong> is AWS's answer, and it is
three separable features:</p>
<ul>
<li><strong>Routing controls</strong>: boolean switches (on/off per region/cell) evaluated by
Route 53 health checks. The switches live in a <strong>dedicated data plane replicated across
five regions</strong>, operated via any of five regional endpoints — designed so you can flip
traffic <em>away</em> from a broken region even while that region (and its control planes) is
down. Flipping a routing control is a data-plane operation against an extremely-hardened cluster;
compare with 'run a ChangeResourceRecordSets call' (single-region control plane) and you see the
entire point.</li>
<li><strong>Readiness checks</strong>: continuous audit that the standby actually matches the
primary — capacity (ASG sizes), quotas, throughput, configuration versions — surfacing drift
<em>before</em> you need the standby. It answers 'would failover work right now?' as a monitored
signal instead of a quarterly hope.</li>
<li><strong>Safety rules</strong>: guardrails on the switches themselves — assertion rules like
'at least one region must always be on' or gating rules requiring an approval control — so a
paged human at 3am cannot fat-finger both regions off. Encode the invariants; do not rely on
runbook prose.</li>
</ul>
<p>ARC also owns <strong>zonal shift / zonal autoshift</strong>: temporarily steering an ALB/NLB's
traffic away from one impaired AZ (the gray-failure evacuation tool) — practice-scale failover you
can use monthly, not yearly.</p>

<div class="callout exam">Keywords: 'fail over even if the primary region's control plane is
unavailable' / 'highly available manual failover switch' → ARC routing controls. 'verify the DR
region remains scaled and configured to take over' → readiness checks. 'prevent turning off both
regions simultaneously' → safety rules. 'shift traffic away from a degraded AZ without changing
the architecture' → zonal shift. A plain Route 53 failover policy with health checks remains the
right answer for simpler automatic failover — ARC is the answer when the question stresses
<em>operator-controlled</em> failover, control-plane independence, or audited readiness.</div>

<h3>Testing: game days and the discipline of breaking things</h3>
<p>An untested DR plan is a document, not a capability. The maturity ladder: (1) restore tests
(does the backup restore, how long does it take — feeds real RTO numbers); (2) component failover
tests (kill an instance, fail an AZ's worth of capacity, promote a replica in staging); (3)
<strong>game days</strong> — scheduled, announced exercises where a realistic scenario ('us-east-1
is degraded; payments RTO is 30 minutes; go') is run end-to-end by the on-call team using only the
runbooks, with observers logging every surprise; (4) production fault injection at steady state
(the Netflix end of the spectrum). Most organizations discover in their first game day that the
runbook's step 3 references a dashboard in the failed region, the failover credentials expired,
and two teams each thought the other owned DNS. That discovery costing an afternoon instead of an
outage is the entire ROI.</p>

<h3>Fault Injection Service (FIS)</h3>
<p>FIS is managed chaos engineering: <strong>experiment templates</strong> define actions
(terminate/stop EC2, throttle or blackhole network, inject API errors for a percentage of calls,
stress CPU/memory via SSM, AZ power interruption simulation, pause Aurora clusters, EKS/ECS task
kills) against <strong>targets</strong> selected by tags, with <strong>stop conditions</strong> —
CloudWatch alarms that automatically halt the experiment when blast radius exceeds intent. That
last part is what makes chaos engineering compatible with change management: the experiment
carries its own circuit breaker. The canonical FIS exercises: 'AZ availability: power interruption'
scenario to validate static stability (does the fleet keep serving when an AZ's instances die and
do NOT come back?), and API throttling injection to validate your retry/backoff behavior — which
connects directly to the next lesson.</p>

<div class="callout war">Rules learned from real game days: announce the first ones (unannounced
comes later; surprise tests of an unpracticed team just produce an outage with witnesses); define
abort criteria and a single empowered incident commander before starting; test the
<em>people-path</em> too — paging, escalation, the conference bridge; and write down RTO-actual vs
RTO-claimed. The delta between those two numbers is your DR program's honesty metric, and it is
the number leadership should see quarterly.</div>

<div class="callout deep">Why ARC's routing-control cluster is credible where a DIY flag in
DynamoDB is not: the cluster is a consensus group spread across five regions whose <em>only</em>
job is to store a few bits and answer health-check reads — minimal dependencies, massive
replication, no shared fate with your stack or any single region. Your homegrown 'failover flag'
table inevitably lives in a region, behind IAM, behind your deploy tooling — three shared fates.
The general principle: the mechanism that moves traffic must be strictly simpler and more
available than everything it protects.</div>
`
    },
    {
      id: "recovery-failure-modes",
      title: "When recovery is the outage: retry storms, cells, and quota exhaustion",
      html: `
<p>Mature DR thinking includes a humbling category: failure modes <em>caused by recovery itself</em>.
The three that matter: retry storms, insufficiently isolated blast radius, and quota exhaustion in
the recovery region.</p>

<h3>Retry storms and the thundering herd</h3>
<p>When a dependency comes back after an outage, it does not face normal load — it faces normal
load <em>times</em> every client's retry amplification, <em>plus</em> the queued backlog,
simultaneously. A service that handles 10k rps at steady state can face 5-10x that at the exact
moment it is cold (empty caches, fresh connections, JITs unwarmed, autoscaled-down). Result: it
buckles, clients retry harder, and the system enters a <strong>metastable failure</strong> state —
stuck in congestion collapse even though the original trigger is gone. Defenses, all of which the
exam and real life reward:</p>
<ul>
<li><strong>Exponential backoff with jitter</strong> — full jitter, not fixed backoff: synchronized
retries are the herd; randomization is what disperses it.</li>
<li><strong>Retry budgets and circuit breakers</strong> — cap retries as a fraction of requests
(e.g., 10%); a breaker converts a failing dependency into fast local failure instead of queued
pressure. Never retry at multiple layers multiplicatively (app x SDK x ALB x client = 3^4
amplification).</li>
<li><strong>Load shedding and admission control</strong> — a recovering service should serve
<em>some</em> requests well, not all requests badly: reject early (cheap) over queuing (expensive),
prioritize by request class, keep queues short (long queues serve dead requests to timed-out
clients — the classic doom loop).</li>
<li><strong>Warm the path back</strong> — slow-start traffic shifting (weighted DNS/ALB ramp),
cache pre-warming, and 'constant work' designs where the system does the same work at all times
so recovery has no extra work to do (the Route 53 health-check philosophy).</li>
</ul>

<div class="callout deep">Why queues make it worse: at overload, a queue of depth D at service
rate R adds D/R latency to every request. Once D/R exceeds client timeout, <em>every</em> queued
request is dead-on-arrival — the server spends 100% of capacity computing responses nobody is
waiting for, while clients retry into the queue. This is congestion collapse in miniature, and it
is why bounded queues + early rejection (and TCP-style admission control generally) beat 'never
drop anything' designs at recovery time.</div>

<h3>Cell-based architecture and shuffle sharding (intro)</h3>
<p>If a whole-service deployment is one failure domain, any poison pill — a corrupting request, a
bad config push, one whale customer's traffic spike — has 100% blast radius. <strong>Cells</strong>
partition a service into n self-contained replicas of the whole stack, each serving a fixed subset
of customers behind a thin routing layer; a poisoned cell takes down 1/n of customers, and cells
give you a natural canary sequence for deploys. Cell size is a trade: small cells = small blast
radius but more fleets to run; the routing layer must be as simple as possible (it is the new
shared fate). <strong>Shuffle sharding</strong> refines this beautifully: give each customer a
random <em>combination</em> of k workers out of m instead of a dedicated partition. Two customers
rarely share their whole shard (with 8 workers choose 2, ~28 combinations; the chance another
customer shares both of yours is ~3.6%), so a poison-pill customer degrades only the customers who
overlap on <em>all</em> their workers — with retries against non-overlapping members, effectively
almost no one. Route 53 famously shuffle-shards its name servers per zone: that is why every
delegation set is a different 4-server combination.</p>

<h3>Quota exhaustion: the DR failure mode nobody drills</h3>
<p>Service quotas are <strong>per-account per-region</strong>. Your DR region — precisely because
it is unused — has default quotas: vCPU limits that will not launch your fleet, EIP limit of 5,
default VPCs-per-region, Lambda concurrent executions at the default, on-demand instance limits,
EBS volume limits. Failover scripts then die on Throttling and LimitExceeded errors at the worst
possible moment, and Support tickets to raise limits during a regional event compete with every
other customer doing the same. The checklist:</p>
<ul>
<li><strong>Request quota increases in the DR region now</strong>, matching (or exceeding —
remember the herd) production quotas. Service Quotas supports templates applied to new accounts
via Organizations; ARC readiness checks can compare quotas across regions continuously.</li>
<li><strong>Capacity ≠ quota</strong>: a raised quota still is not reserved hardware; for hard-RTO
tiers, On-Demand Capacity Reservations in the DR region are the only certainty (and Savings Plans
can absorb their cost).</li>
<li><strong>API rate limits count too</strong>: recovery is control-plane-chatty (RunInstances,
CreateQueue, attach/detach), and mass failover can throttle your own automation. Batch, paginate,
back off with jitter — your recovery scripts need the same herd discipline as your clients.</li>
</ul>

<div class="callout exam">Scenario tells: 'failover to the DR region failed with instance launch
limit errors' → pre-raise service quotas in the DR region / use capacity reservations. 'one
customer's malformed requests degrade all customers' → cell-based architecture / shuffle sharding.
'after the dependency recovered, load spiked and it failed again' → exponential backoff with
jitter, retry budgets, load shedding. These map one-to-one; distractors will offer bigger
instances or more AZs, which do not address blast radius or amplification at all.</div>

<div class="callout war">A composite war story you should recognize as a genre: region impaired →
5 companies' worth of workloads fail into the neighbor region → on-demand capacity tightens →
your ASG scale-out gets InsufficientInstanceCapacity → your (unraised) vCPU quota would have
capped you anyway → your retry loop hammers RunInstances into API throttling → alarms fire into a
paging service that is itself degraded. Every layer was somebody's untested assumption. The teams
that sailed through had: capacity reservations, pre-raised quotas, jittered backoff in automation,
and a game day scar proving the path. DR is bought in advance or not at all.</div>
`
    }
  ],
  quiz: [
    {
      q: "An architect models a request path that traverses an API gateway (99.95%), a compute tier (99.99%), and a database (99.95%), each as independent serial dependencies. Leadership wants to claim 99.99% availability for the service. What does the math say?",
      options: [
        "The service achieves 99.99% because the weakest component is above 99.9%",
        "The composite is roughly 99.89%, so the chain cannot meet 99.99% without redundancy or removing serial dependencies",
        "The composite equals the lowest component, 99.95%",
        "Availability cannot be composed mathematically; only measurement can determine it"
      ],
      answer: [1],
      multi: false,
      explanation: "Serial availabilities multiply: 0.9995 x 0.9999 x 0.9995 ≈ 0.9989 — about 99.89%, nearly 10 hours/year of expected downtime versus the ~53 minutes that 99.99% implies. <strong>B</strong> also states the only real remedies: parallel redundancy on weak components, or converting hard serial dependencies into degradable ones. <strong>A</strong> has no mathematical basis. <strong>C</strong> is the common intuition error — the chain is strictly <em>worse</em> than its weakest link because every link subtracts. <strong>D</strong> is a half-truth used as a dodge: measured SLOs matter, but composition math gives a valid upper bound and is exactly how you evaluate designs before building them."
    },
    {
      q: "A payments platform targets 99.99% availability and currently runs its EC2 fleet in 2 AZs at 80% utilization each, relying on Auto Scaling to launch replacement capacity if an AZ fails. A resilience review flags this design. What is the core problem and fix?",
      options: [
        "Two AZs is fine, but the ASG health check grace period should be shortened for faster replacement",
        "The design depends on the EC2 control plane and available capacity during an AZ event; it should pre-provision so surviving AZs can absorb the full load with no scaling action",
        "The fleet should be moved to a single AZ with larger instances to reduce inter-AZ latency",
        "Auto Scaling should be replaced with scheduled scaling based on the AZ maintenance calendar"
      ],
      answer: [1],
      multi: false,
      explanation: "At 2 AZs x 80%, losing one AZ leaves 50% of capacity serving 160% of its normal load — the design only survives if Auto Scaling can launch replacements, which depends on the EC2 control plane and on regional spare capacity at the exact moment every other affected customer is also launching. That is the opposite of static stability. <strong>B</strong> is the fix: 3 AZs at ~66% (or 2 at 50%) means AZ loss requires <em>no action at all</em> — the highest-availability recovery path is 'nothing'. <strong>A</strong> tunes the speed of a mechanism whose availability is the problem. <strong>C</strong> abandons AZ fault tolerance entirely for a latency non-issue. <strong>D</strong> is nonsense — AZ failures do not follow a maintenance calendar."
    },
    {
      q: "A company classifies an internal analytics platform: the business tolerates up to 24 hours of downtime and can regenerate up to 12 hours of data from upstream sources. The DR budget should be minimal. Which strategy and mechanics fit?",
      options: [
        "Warm standby: a scaled-down full stack in a second Region with continuous data replication",
        "Backup and restore: scheduled AWS Backup jobs with cross-region copy, infrastructure as code templates, and a tested restore runbook",
        "Pilot light: live cross-region database replica with application servers stopped",
        "Multi-site active-active with DynamoDB global tables"
      ],
      answer: [1],
      multi: false,
      explanation: "RTO 24h / RPO 12h are hours-scale on both axes — the definition of the backup-and-restore tier, and 'minimal budget' confirms it: <strong>B</strong> pays only for backup storage, with AWS Backup cross-region copies covering regional loss and IaC serving as the backup of the infrastructure itself. The 'tested restore runbook' detail is what makes it a real strategy rather than a document. <strong>C</strong> and <strong>A</strong> both maintain continuously replicating (and for warm standby, continuously running) resources to achieve minutes-scale RPO/RTO the business explicitly does not need — paying for unrequired nines. <strong>D</strong> is the maximum-cost tier for a workload that tolerates a day of downtime; it fails the requirements in the most expensive possible way."
    },
    {
      q: "A trading application requires RTO under 15 minutes and RPO under 1 minute for its PostgreSQL-compatible database during a regional failure, and wants planned regional switchovers with zero data loss for quarterly DR drills. Which data layer meets this?",
      options: [
        "RDS for PostgreSQL with a cross-region read replica promoted during failover",
        "Aurora PostgreSQL Global Database using managed switchover for drills and failover promotion for disasters",
        "RDS Multi-AZ DB cluster with two readable standbys",
        "Nightly snapshots copied cross-region with restore automation"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> matches both requirements by construction: Aurora Global Database replicates at the storage layer with sub-second typical lag (design targets ~1s RPO, ~1min RTO for unplanned failover — inside the 15min/1min bounds), and its <em>managed planned switchover</em> drains replication before swapping roles, guaranteeing RPO=0 for the quarterly drills and automatically re-establishing the old primary as a secondary. <strong>A</strong> can approximate the unplanned numbers on a good day, but promotion plus manual re-pointing makes 15 minutes optimistic, replication lag is load-sensitive, and there is no zero-data-loss planned switchover — drills would break and manually rebuild replication. <strong>C</strong> is single-region: Multi-AZ standbys do not survive regional failure. <strong>D</strong> has an RPO of up to 24 hours — three orders of magnitude off."
    },
    {
      q: "A retail company runs active-active in two Regions with DynamoDB global tables storing shopping carts. During a network partition between Regions, customers in both Regions continued writing to their carts. What data behavior must the design accommodate?",
      options: [
        "DynamoDB blocks writes in the secondary Region during partitions, so no conflicts occur",
        "Concurrent updates to the same item in different Regions are resolved last-writer-wins after the partition heals, so one Region's conflicting update is silently discarded",
        "Global tables provide strong consistency across Regions, so both writes are merged",
        "The partition causes both replica tables to become read-only until an operator intervenes"
      ],
      answer: [1],
      multi: false,
      explanation: "Global tables are multi-writer with asynchronous replication and <strong>last-writer-wins</strong> conflict resolution on timestamps: during the partition both Regions accept writes locally (availability is the design goal), and on heal, conflicting versions of the same item collapse to the latest write — the loser is silently discarded, which is precisely the fine print the design must handle (idempotent writes, home-region write ownership, or cart-merge logic at the application layer). <strong>A</strong> and <strong>D</strong> describe consistency-first behaviors global tables deliberately do not have — no blocking, no read-only mode. <strong>C</strong> is the classic distractor: strong consistency exists only <em>within</em> a Region; cross-region replication is eventual, and 'merged' is not a thing LWW does."
    },
    {
      q: "A compliance regime requires that objects written to an S3 bucket be present in a second Region within 15 minutes, with metrics as evidence, and that backup recovery points be immune to deletion even by an administrator with root credentials. Which TWO features satisfy these? (Select TWO.)",
      options: [
        "S3 Cross-Region Replication with Replication Time Control",
        "S3 Transfer Acceleration on the destination bucket",
        "AWS Backup vault with Vault Lock in compliance mode",
        "AWS Backup vault with Vault Lock in governance mode",
        "S3 lifecycle rules transitioning objects to the second Region"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<strong>A</strong>: plain CRR replicates 'most objects in minutes' with no commitment; RTC adds the contractual shape — 99.99% of objects within 15 minutes — plus replication metrics and events, which is the 'with evidence' clause. <strong>C</strong>: Vault Lock in <em>compliance</em> mode, once its cooling-off period lapses, cannot be removed or shortened by anyone — not root, not AWS Support — making recovery points undeletable until retention expires; that is the 'immune even to administrators' requirement verbatim. <strong>D</strong> fails exactly there: governance mode is permission-based and a sufficiently privileged principal can lift it. <strong>B</strong> accelerates uploads from distant clients; it has nothing to do with replication deadlines. <strong>E</strong> is fictional — lifecycle rules change storage class within a bucket; they do not move objects between Regions."
    },
    {
      q: "A company wants to protect 200 on-premises VMware servers (including databases on VMs) with an AWS-based DR capability targeting RPO of seconds and RTO of about 15 minutes, while keeping ongoing costs far below running a duplicate environment. Which service and mechanism fit?",
      options: [
        "AWS Elastic Disaster Recovery with continuous block-level replication into a low-cost staging area, launching full-size instances only at drill or failover",
        "AWS Application Migration Service to cut the servers over to EC2 permanently",
        "AWS Backup with hourly on-premises backups copied to a cross-region vault",
        "AWS DataSync replicating the VMs' file systems to S3 every hour"
      ],
      answer: [0],
      multi: false,
      explanation: "The requirements are DRS's product definition (<strong>A</strong>): agent-based continuous block replication (RPO seconds) into staging infrastructure of small instances and cheap EBS (the cost pitch — a few percent of duplicate-environment cost), with conversion and launch of recovery instances on demand (RTO minutes), plus point-in-time recovery and built-in drills/failback. <strong>B</strong> is the sibling with the wrong job: MGN performs one-way migration cutovers, not ongoing protection with drills and failback — the scenario wants the servers to stay on-premises. <strong>C</strong> gives hourly RPO at best and restore-from-backup RTO measured in hours — both bounds missed by an order of magnitude. <strong>D</strong> copies files, not bootable servers, at hourly RPO — it cannot produce running recovery instances at all, let alone in 15 minutes."
    },
    {
      q: "During a regional incident, an operations team must shift all traffic from the primary Region to the standby. The runbook says to update Route 53 record sets via the API, but a previous incident showed this API can be impaired during exactly such events. The team wants a failover mechanism that works even when the primary Region and the Route 53 control plane are degraded, with a guardrail preventing both Regions from being disabled at once. What should they implement?",
      options: [
        "Route 53 Application Recovery Controller routing controls operated through its multi-Region cluster endpoints, with a safety rule asserting at least one Region stays active",
        "A Lambda function in the primary Region that updates Route 53 records when CloudWatch alarms fire",
        "Lower the TTL on all records to 10 seconds so API changes propagate faster",
        "An AWS Config rule that detects when both Regions are disabled"
      ],
      answer: [0],
      multi: false,
      explanation: "The scenario names both ARC differentiators: control-plane-independent failover and encoded guardrails. Routing controls (<strong>A</strong>) are bits in a dedicated data-plane cluster replicated across five Regions with five independent endpoints — flippable while the primary Region and the Route 53 record-change control plane are down — and safety rules (assertion rules) structurally prevent the both-Regions-off fat-finger. <strong>B</strong> compounds the problem: the failover automation lives <em>in the failing Region</em> and calls the exact API the scenario says is impaired — two shared fates with the disaster. <strong>C</strong> reduces cache delay after a successful change but does nothing when the change API itself is unavailable — TTL is irrelevant if you cannot write the record. <strong>D</strong> detects the fat-finger after the fact; a detective control is not a guardrail."
    },
    {
      q: "After a 40-minute database outage was resolved, the dependent API tier immediately failed again: request latency spiked, queues filled, and the database was overwhelmed despite the original fault being fixed. Client services retry failed calls up to 5 times, and their callers also retry 3 times. Which THREE changes address this failure mode? (Select THREE.)",
      options: [
        "Implement exponential backoff with full jitter and cap retries with a retry budget at a single layer",
        "Add load shedding so the recovering tier rejects excess requests early instead of queueing them",
        "Increase the database instance size so it can absorb the post-recovery surge",
        "Ramp traffic back gradually and pre-warm caches and connection pools before full restoration",
        "Increase client timeout values so requests wait longer instead of failing",
        "Add a second retry layer at the load balancer for resilience"
      ],
      answer: [0, 1, 3],
      multi: true,
      explanation: "This is a retry storm producing metastable failure: 5x3 multiplicative retries plus queued backlog hit a cold system. <strong>A</strong> attacks amplification — jitter desynchronizes the herd, and a retry budget at one layer replaces the 15x multiplier. <strong>B</strong> attacks the doom loop — early rejection keeps the queue short so served requests are still wanted; long queues serve dead requests to timed-out clients while capacity burns. <strong>D</strong> attacks the cold-start surge — slow-start traffic shifting and warmed caches/pools let capacity meet load incrementally. <strong>C</strong> buys headroom against an amplified load that grows with retry multiplication — the surge scales with the pathology, so sizing chases it. <strong>E</strong> makes it worse: longer waits mean deeper queues and more concurrent held resources. <strong>F</strong> adds another multiplicative retry layer — the precise anti-pattern being fixed."
    },
    {
      q: "A DR game day fails: the runbook's failover scripts in the recovery Region die with instance launch limit exceeded and Elastic IP limit errors, even though the Region's on-demand capacity was available. The DR Region had never run production-scale workloads. What is the root cause and the correct preventive measures?",
      options: [
        "AWS reserves capacity only in the primary Region; the fix is to purchase Reserved Instances in the DR Region",
        "Service quotas are per-account per-Region and the DR Region still had defaults; pre-raise quotas to match production, monitor parity (e.g., ARC readiness checks), and use capacity reservations for hard-RTO tiers",
        "The failover scripts used the wrong AMI IDs; AMIs must be copied to the DR Region",
        "The account hit AWS Organizations limits; the workload should fail over into a separate account"
      ],
      answer: [1],
      multi: false,
      explanation: "LimitExceeded-class errors with capacity available is the signature of default <strong>service quotas</strong> in a never-used Region — vCPU limits, 5 EIPs, and friends are per-account per-Region and do not follow your workload. <strong>B</strong> is the full prescription: raise quotas in advance (during an incident, quota-increase tickets queue behind every other failing-over customer), continuously verify parity so drift is caught (ARC readiness checks do exactly this), and note that quota is still not capacity — ODCRs are the only launch certainty for hard RTOs. <strong>A</strong> misstates both facts: RIs are a billing discount, not (in regional form) a capacity guarantee, and 'AWS reserves capacity only in the primary Region' is not a thing. <strong>C</strong> would produce InvalidAMIID errors, not limit errors. <strong>D</strong> invents an Organizations limit unrelated to instance launches; new accounts also start with <em>lower</em> quotas."
    },
    {
      q: "A multi-tenant API experiences complete outages for all customers whenever a single tenant sends malformed high-volume traffic that crashes backend workers. The team wants to bound the blast radius of one bad tenant to a small fraction of customers without doubling infrastructure. Which approach achieves this?",
      options: [
        "Deploy the entire fleet across three AZs instead of two",
        "Partition the service into cells or shuffle-shard tenants across worker subsets, so a poison-pill tenant affects only the workers in its shard",
        "Move all workers to larger instance types so crashes are less likely",
        "Add a global retry layer so requests from healthy tenants are retried against the same fleet"
      ],
      answer: [1],
      multi: false,
      explanation: "The problem is shared fate: one fleet means one bad tenant has 100% blast radius. <strong>B</strong> is the isolation answer — cells give each tenant subset its own full stack (bad tenant takes 1/n of customers), and shuffle sharding does even better without n full fleets: each tenant gets a random k-of-m worker combination, so few other tenants share <em>all</em> their workers, and with retries against non-overlapping shard members the effective blast radius approaches a single tenant. This is Route 53's own name-server design. <strong>A</strong> spreads the same shared-fate fleet across more AZs — the poison pill crashes workers in all three; AZs isolate infrastructure failure, not workload failure. <strong>C</strong> makes each crash more expensive without bounding its spread. <strong>D</strong> amplifies: retrying healthy tenants into a fleet being crashed by the bad one is a retry storm on top of a poison pill."
    },
    {
      q: "An architecture review of a warm standby setup notes: same IaC deployed to both Regions by one pipeline, 5% of production traffic continuously routed through the standby Region, and weekly automated restore tests of backups. What is the PRIMARY resilience benefit of routing the 5% of live traffic through the standby?",
      options: [
        "It reduces data transfer costs by distributing load",
        "It continuously validates the standby's full serving path with real traffic, so drift or breakage surfaces as a small blip instead of a failed failover",
        "It doubles the availability of the primary Region",
        "It keeps the standby's caches perfectly synchronized with the primary"
      ],
      answer: [1],
      multi: false,
      explanation: "The chronic killer of warm standby is drift — config, secrets, security groups diverge until the standby cannot actually serve, discovered only during the disaster. Trickling real production traffic through it (<strong>B</strong>) turns the standby into a continuously-exercised path: any breakage manifests immediately as elevated errors on 5% of traffic — a monitored blip — rather than as a dead Region during failover. It also keeps warm the things synthetic checks miss (auth flows, dependencies, quotas in use). <strong>A</strong> is backwards — cross-region routing adds transfer cost; nobody does this to save money. <strong>C</strong> misstates the math — the primary's availability is unchanged; the <em>system's</em> failover success probability improves. <strong>D</strong> overclaims — 5% of traffic warms caches somewhat but cannot keep them synchronized, and cache sync is not the point; path validation is."
    },
    {
      q: "A team must run a controlled experiment proving their EKS-based service survives the loss of one AZ: instances in that AZ should be terminated and stay gone while the experiment verifies the service continues within SLO, and the experiment must automatically halt if the error-rate alarm fires. Which implementation is correct?",
      options: [
        "An AWS FIS experiment template using the AZ availability scenario targeting the AZ's resources by tag, with a CloudWatch alarm configured as a stop condition",
        "A bash script that terminates instances in one AZ, run during a maintenance window",
        "Manually failing the NAT gateway in one AZ and observing dashboards",
        "Enabling zonal autoshift so AWS moves traffic automatically during real AZ impairments"
      ],
      answer: [0],
      multi: false,
      explanation: "The requirements — orchestrated AZ-loss simulation, sustained impact, targets by tag, and an automatic circuit breaker — are the FIS feature list (<strong>A</strong>): the AZ availability power-interruption scenario terminates/isolates zonal resources and can prevent replacements from landing back in the AZ for the duration, while stop conditions tied to CloudWatch alarms halt the experiment the moment blast radius exceeds intent. That built-in abort is what makes the test safe to run against meaningful environments. <strong>B</strong> can kill instances but has no stop condition, no coordinated multi-service actions, and no guard against ASGs immediately backfilling the AZ — it tests termination, not AZ loss. <strong>C</strong> tests one narrow dependency (egress) rather than AZ loss, and manually breaking shared infrastructure without an automatic abort is how experiments become incidents. <strong>D</strong> is a recovery mechanism for real events, not an experiment — it validates nothing on demand and proves nothing about the service's own static stability."
    },
    {
      q: "A business-impact analysis for an e-commerce checkout service finds downtime costs 200,000 USD per hour and lost orders cannot be re-entered. A proposal suggests RTO of 4 hours and RPO of 1 hour via backup and restore to minimize DR spend. What is the correct architectural critique?",
      options: [
        "The proposal is sound because DR spend should always be minimized",
        "Expected downtime and unrecoverable data loss costs vastly exceed the cost of a warm standby or active-active tier with near-zero RPO, so the DR tier should be derived from the impact numbers, not from the DR budget",
        "RTO and RPO are IT metrics and should be set by the infrastructure team's capabilities",
        "The proposal should use pilot light instead, because it is always the best cost-to-recovery balance"
      ],
      answer: [1],
      multi: false,
      explanation: "RTO/RPO are derived from business impact, then a tier is purchased to meet them — never the reverse. A 4-hour RTO prices a single regional event at ~800,000 USD in downtime alone, and a 1-hour RPO of <em>unrecoverable</em> orders adds direct revenue loss plus reconciliation chaos; against that, running warm standby (a fraction of prod, continuously) or active-active with a near-zero-RPO data layer costs far less than one expected incident (<strong>B</strong>). <strong>A</strong> optimizes the wrong objective — minimizing DR spend maximizes expected total cost when impact is this high. <strong>C</strong> inverts the derivation: capabilities constrain what is achievable, but objectives come from impact; teams that set RPO by 'what our backups do' have chosen a number by accident. <strong>D</strong> replaces analysis with a slogan — pilot light is a point on the curve, correct only when the impact math lands there, and its tens-of-minutes RTO may still be too slow here."
    }
  ],
  flashcards: [
    { front: "Serial vs parallel availability composition formulas?", back: "Serial chain: multiply availabilities — A = A1 x A2 x ... (every dependency subtracts nines). Parallel (either suffices, independent): A = 1 - (1-a)^n — redundancy multiplies <em>un</em>availability. Independence is the load-bearing assumption." },
    { front: "Downtime per year at 99.9%, 99.99%, 99.999%?", back: "99.9% ≈ 8.8 hours/yr; 99.99% ≈ 52.6 min/yr (~4.4 min/month — humans can no longer be in the loop; failover must be automatic); 99.999% ≈ 5.3 min/yr." },
    { front: "Why is an SLA not an availability guarantee?", back: "An SLA is a <strong>refund schedule</strong>: service credits against that service's bill if a narrowly-defined breach occurs. It does not compensate revenue loss or change failure probability. Design to your own client-measured SLOs; treat vendor SLAs as planning inputs." },
    { front: "Control plane vs data plane — and why it matters for DR?", back: "Data plane = steady-state serving (running instances, DNS answers, LB forwarding); control plane = mutation APIs (launch, create, change records). Data planes are engineered more available; regional incidents often break <em>changes</em> while running things keep running. DR paths must avoid control-plane dependencies." },
    { front: "Define static stability.", back: "The system keeps operating through a dependency/AZ failure <strong>without making any changes</strong> — no API calls, no scaling, no reconfiguration. E.g., 3 AZs at ≤66% each absorb AZ loss with zero action. The recovery path 'do nothing' is the only one with 100% availability." },
    { front: "The four DR strategies with RTO/RPO/cost?", back: "<strong>Backup &amp; restore</strong>: RTO/RPO hours, storage-only cost. <strong>Pilot light</strong>: RTO tens of minutes, RPO seconds (data live, compute stopped). <strong>Warm standby</strong>: RTO minutes (scaled-down stack running). <strong>Active-active</strong>: near-zero both, ~2x cost + conflict-handling engineering." },
    { front: "Pilot light vs warm standby — the discriminator?", back: "Both replicate data continuously. Pilot light: core services <em>provisioned but stopped/zero-scaled</em>. Warm standby: full stack <em>running</em>, scaled down, able to serve requests now — continuously exercised, hence more trustworthy." },
    { front: "Why must the data layer be live even in pilot light?", back: "Data cannot be 'started quickly' — it must already exist at the recovery site. Compute is re-creatable in minutes from templates; a 10 TB database restore is hours. Hence replicas/global tables/CRR run continuously in every tier above backup-and-restore." },
    { front: "Route 53 failover vs Global Accelerator for regional failover?", back: "Route 53: DNS-level; failover time = health-check detection + TTL + client cache behavior (realistically minutes). Global Accelerator: static anycast IPs, edge termination, endpoint health steering in seconds, no DNS cache to wait out — pick it for 'static IP' or 'clients cache DNS' scenarios." },
    { front: "How are RTO and RPO properly derived?", back: "From business impact: quantify cost-per-hour of downtime and of lost writes, then buy the cheapest DR tier meeting those bounds. RPO maps to data movement (nightly backup=24h, async replication=seconds, sync=~0); RTO maps to what pre-exists at the recovery site." },
    { front: "AWS Backup: the four capabilities that matter for DR/compliance?", back: "Tag-based backup <strong>plans</strong> (policy, not per-resource config, org-wide via Organizations); <strong>vaults</strong> with cross-region AND cross-account copies (ransomware posture); <strong>Vault Lock</strong> WORM; <strong>restore testing</strong> plans that prove recoverability and measure real restore times." },
    { front: "Vault Lock governance vs compliance mode?", back: "Governance: privileged principals can still alter/remove protection. <strong>Compliance: after the cooling-off (min 3 days), nobody — not root, not AWS Support — can remove it</strong>; recovery points are undeletable until retention lapses. One-way door; verify retention before locking." },
    { front: "What is Elastic Disaster Recovery (DRS) and its cost trick?", back: "Continuous <strong>block-level replication</strong> (MGN's sibling) of on-prem/cloud servers into a <strong>low-cost staging area</strong> (small instances + cheap EBS); full-size instances launched only at drill/failover. RPO seconds, RTO minutes, ongoing cost a few percent of a duplicate environment. Includes point-in-time recovery (ransomware) and failback." },
    { front: "MGN vs DRS?", back: "Same replication tech, different jobs. <strong>MGN</strong>: one-way migration — cut over, decommission source. <strong>DRS</strong>: ongoing DR — continuous protection, isolated drills, point-in-time launches, built-in failback to the original site." },
    { front: "Aurora Global Database: switchover vs failover?", back: "<strong>Managed switchover</strong> (planned, healthy regions): replication drains first — <strong>RPO=0</strong>, old primary auto-rejoins as secondary; use for drills. <strong>Failover/detach-and-promote</strong> (disaster): RPO = replication lag (typically &lt;1s), RTO ~1 minute design target. Replication is storage-layer redo shipping — near-zero primary impact." },
    { front: "RDS cross-region read replica as DR — strengths and weaknesses?", back: "Cheap, works broadly. But: engine-level async lag is write-load-sensitive (lag IS your live RPO), promotion is a manual control-plane op, app repointing and Multi-AZ rebuild are on you, failback is manual re-replication. RTO realistically tens of minutes." },
    { front: "DynamoDB global tables consistency fine print?", back: "Active-active multi-writer, ~1s async replication, conflicts resolved <strong>last-writer-wins</strong> — a concurrent conflicting update is silently discarded. Strong consistency exists only within one Region, never across. Discipline: idempotent writes or per-record home-region ownership." },
    { front: "S3 CRR vs CRR with Replication Time Control?", back: "Plain CRR: async, most objects in minutes, <strong>no SLA</strong>. RTC: 99.99% of objects within <strong>15 minutes</strong>, with replication metrics and events — the 'must prove replication within a deadline' compliance answer. Versioning required; existing objects need Batch Replication." },
    { front: "Route 53 ARC: the three features?", back: "<strong>Routing controls</strong>: failover switches in a dedicated 5-region data-plane cluster — flip traffic even when the primary region/control planes are down. <strong>Readiness checks</strong>: continuous standby-parity audit (capacity, quotas, config). <strong>Safety rules</strong>: guardrails (e.g., 'at least one region on') preventing fat-fingered total blackout. Plus zonal shift/autoshift for gray AZ evacuation." },
    { front: "What is FIS and what makes its experiments safe?", back: "Managed fault injection: templates of actions (terminate instances, AZ-loss scenario, API error/throttle injection, network blackhole, CPU stress) against tag-selected targets. <strong>Stop conditions</strong> — CloudWatch alarms that auto-halt the experiment — are the built-in circuit breaker." },
    { front: "Retry storm defenses (the four)?", back: "1) Exponential backoff with <strong>full jitter</strong>; 2) retry budgets + circuit breakers, retries at ONE layer only (layered retries multiply); 3) load shedding/admission control — reject early, keep queues short; 4) slow-start traffic ramp + cache warming on recovery." },
    { front: "Why do long queues doom a recovering service?", back: "Queue delay D/R exceeds client timeouts, so every queued request is abandoned before service — the server burns 100% capacity producing answers nobody awaits while clients retry into the queue. Bounded queues + early rejection break the loop (metastable failure / congestion collapse)." },
    { front: "Cell-based architecture vs shuffle sharding?", back: "Cells: n self-contained stacks each owning a customer subset — poison pill hits 1/n; routing layer must stay trivially simple. Shuffle sharding: each customer gets a random k-of-m worker combo — customers rarely share ALL workers, so a poison pill's effective blast radius approaches one customer (Route 53's name-server design)." },
    { front: "Why is quota exhaustion a DR failure mode, and the fix?", back: "Quotas are per-account <strong>per-Region</strong>; an unused DR Region has defaults (vCPU limits, 5 EIPs, Lambda concurrency) that kill failover scripts with LimitExceeded while everyone else's tickets flood Support. Fix in advance: raise DR-Region quotas to prod parity, monitor with ARC readiness checks, ODCRs for hard-RTO capacity (quota ≠ capacity)." },
    { front: "Availability = MTBF/(MTBF+MTTR) — why attack MTTR first?", back: "MTBF beyond redundancy is expensive; MTTR is cheap: faster detection (symptom alerts), pre-authorized runbooks, automated execution. Halving MTTR adds the same nines as doubling MTBF. Most high-ROI 'HA work' is MTTR work — and game days are MTTR training." },
    { front: "What does a game day actually validate that architecture review cannot?", back: "The people-path and hidden dependencies: runbooks referencing dashboards in the failed region, expired break-glass credentials, unclear DNS ownership, paging/escalation gaps — plus RTO-<em>actual</em> vs RTO-claimed, the honesty metric of a DR program." }
  ],
  lab: {
    title: "Lab: backup-and-restore fire drill — prove your RTO with AWS Backup",
    html: `
<h3>Goal</h3>
<p>Run a complete backup-and-restore DR drill on real infrastructure: protect an EBS volume with an
AWS Backup plan (tag-selected, like production), take an on-demand recovery point, destroy the
original volume (the 'disaster'), restore from the vault, and — the actual point — <em>measure</em>
your restore time, because RTO is a measured number, not an estimate. Cost: a 1 GiB gp3 volume,
backup storage, and minutes of clock time — well under a dime.</p>

<h3>Architecture</h3>
<p>One 1 GiB EBS volume tagged for backup; an AWS Backup vault and a plan whose resource selection
targets the tag (the governed-policy pattern — resources opt in by tag, not by per-resource
configuration); an IAM service role for AWS Backup. The drill exercises the exact path a real
region-local recovery would: vault → restore job → new volume.</p>

<h3>Steps</h3>
<ol>
<li><p>Create and tag the volume (pick any AZ in your region):</p>
<pre><code>AZ=$(aws ec2 describe-availability-zones \
  --query 'AvailabilityZones[0].ZoneName' --output text)
VOL_ID=$(aws ec2 create-volume --availability-zone $AZ \
  --size 1 --volume-type gp3 \
  --tag-specifications 'ResourceType=volume,Tags=[{Key=backup,Value=drill},{Key=Name,Value=ha-dr-lab}]' \
  --query VolumeId --output text)
echo $VOL_ID</code></pre></li>
<li><p>Create the vault and the IAM role AWS Backup assumes:</p>
<pre><code>aws backup create-backup-vault --backup-vault-name drill-vault
cat &gt; backup-trust.json &lt;&lt;'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "backup.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF
aws iam create-role --role-name drill-backup-role \
  --assume-role-policy-document file://backup-trust.json
aws iam attach-role-policy --role-name drill-backup-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup
aws iam attach-role-policy --role-name drill-backup-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores</code></pre>
<p>(In production this vault would also have a cross-account, cross-region copy rule and — for
the ransomware posture — Vault Lock. We skip Vault Lock here deliberately: compliance mode is a
one-way door and this is a teardown-complete lab.)</p></li>
<li><p>Create a backup plan with tag-based selection (daily schedule for realism; we will not
wait for it — the on-demand job below is the drill):</p>
<pre><code>ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
PLAN_ID=$(aws backup create-backup-plan --backup-plan '{
  "BackupPlanName": "drill-plan",
  "Rules": [{
    "RuleName": "daily",
    "TargetBackupVaultName": "drill-vault",
    "ScheduleExpression": "cron(0 5 * * ? *)",
    "Lifecycle": { "DeleteAfterDays": 7 }
  }]
}' --query BackupPlanId --output text)
SEL_ID=$(aws backup create-backup-selection --backup-plan-id $PLAN_ID \
  --backup-selection '{
    "SelectionName": "by-tag",
    "IamRoleArn": "arn:aws:iam::'"$ACCOUNT"':role/drill-backup-role",
    "ListOfTags": [{
      "ConditionType": "STRINGEQUALS",
      "ConditionKey": "backup",
      "ConditionValue": "drill"
    }]
  }' --query SelectionId --output text)</code></pre></li>
<li><p>Take the on-demand recovery point and wait for completion (typically 1-3 minutes for a
tiny volume):</p>
<pre><code>JOB_ID=$(aws backup start-backup-job \
  --backup-vault-name drill-vault \
  --resource-arn arn:aws:ec2:$(aws configure get region):$ACCOUNT:volume/$VOL_ID \
  --iam-role-arn arn:aws:iam::$ACCOUNT:role/drill-backup-role \
  --query BackupJobId --output text)
watch -n 10 "aws backup describe-backup-job --backup-job-id $JOB_ID \
  --query '{State:State,Percent:PercentDone}'"</code></pre></li>
<li><p><strong>The disaster.</strong> Delete the original volume, then start the clock:</p>
<pre><code>aws ec2 delete-volume --volume-id $VOL_ID
DRILL_START=$(date +%s)</code></pre></li>
<li><p>Restore from the vault:</p>
<pre><code>RP_ARN=$(aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name drill-vault \
  --query 'RecoveryPoints[0].RecoveryPointArn' --output text)
RESTORE_ID=$(aws backup start-restore-job \
  --recovery-point-arn "$RP_ARN" \
  --iam-role-arn arn:aws:iam::$ACCOUNT:role/drill-backup-role \
  --metadata '{"availabilityZone":"'"$AZ"'","volumeType":"gp3","volumeSize":"1","encrypted":"false"}' \
  --query RestoreJobId --output text)
watch -n 10 "aws backup describe-restore-job --restore-job-id $RESTORE_ID \
  --query '{Status:Status,Percent:PercentDone}'"</code></pre></li>
</ol>

<h3>Verify</h3>
<ol>
<li><p>When the restore job completes, record your measured RTO and confirm the restored volume
exists:</p>
<pre><code>echo "Restore took $(( $(date +%s) - DRILL_START )) seconds"
NEW_VOL=$(aws backup describe-restore-job --restore-job-id $RESTORE_ID \
  --query CreatedResourceArn --output text | awk -F/ '{print $NF}')
aws ec2 describe-volumes --volume-ids $NEW_VOL \
  --query 'Volumes[0].{State:State,Size:Size,AZ:AvailabilityZone}'</code></pre>
<p>Now the lesson: this number is your RTO <em>for 1 GiB</em>. Restore time scales with data
size — extrapolate to your production volumes and compare against your claimed RTO. If a 2 TB
restore projects to 6 hours against a 1-hour RTO, backup-and-restore is the wrong tier for that
workload and you have just proven it for the cost of a dime — this is exactly what AWS Backup's
restore testing plans automate on a schedule.</p></li>
</ol>

<h3>Teardown</h3>
<p>Ordered: restored resources, then recovery points (a vault cannot be deleted while it holds
any), then plan/selection, then vault, then IAM, then local files.</p>
<ol>
<li><pre><code>aws ec2 delete-volume --volume-id $NEW_VOL</code></pre></li>
<li><pre><code>aws backup delete-recovery-point --backup-vault-name drill-vault \
  --recovery-point-arn "$RP_ARN"
# wait until the vault reports zero recovery points:
aws backup describe-backup-vault --backup-vault-name drill-vault \
  --query NumberOfRecoveryPoints</code></pre></li>
<li><pre><code>aws backup delete-backup-selection --backup-plan-id $PLAN_ID --selection-id $SEL_ID
aws backup delete-backup-plan --backup-plan-id $PLAN_ID
aws backup delete-backup-vault --backup-vault-name drill-vault</code></pre></li>
<li><pre><code>aws iam detach-role-policy --role-name drill-backup-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup
aws iam detach-role-policy --role-name drill-backup-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores
aws iam delete-role --role-name drill-backup-role
rm -f backup-trust.json</code></pre></li>
<li><p>Final sweep — nothing should remain:</p>
<pre><code>aws ec2 describe-volumes --filters Name=tag:Name,Values=ha-dr-lab --query 'Volumes[].VolumeId'
aws backup list-backup-vaults --query 'BackupVaultList[].BackupVaultName'
aws backup list-backup-plans --query 'BackupPlansList[].BackupPlanName'</code></pre></li>
</ol>
`
  }
});
