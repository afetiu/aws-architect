/* Module 4: EC2 & Compute Fundamentals (SAA track) */
window.COURSE.register({
  id: "ec2",
  order: 4,
  track: "saa",
  title: "EC2 & Compute Fundamentals",
  description: "EC2 for people who already run fleets: instance taxonomy and the Nitro architecture underneath it, the full purchase-option economics (RIs, Savings Plans, Spot, capacity reservations), placement and networking internals (ENA/EFA), and the lifecycle/metadata semantics that show up in every real incident review.",
  examWeight: "EC2 is the connective tissue of SAA-C03 — purchase-option cost scenarios, Spot interruption handling, placement groups, IMDSv2 hardening, and instance-store-vs-EBS semantics each appear repeatedly across the Cost, Resilience, and Security domains.",
  lessons: [
    {
      id: "instance-anatomy",
      title: "Decoding instance types: families, generations, and Graviton economics",
      html: `
<p>An EC2 instance type name is a compressed spec sheet. Read <code>c7g.2xlarge</code> left to right: <strong>c</strong> is the family (compute-optimized), <strong>7</strong> is the generation, <strong>g</strong> is an attribute suffix (Graviton, AWS's Arm CPU), and <strong>2xlarge</strong> is the size. Once you internalize the grammar, you can price and capacity-plan an unfamiliar type from its name alone — and the exam assumes you can.</p>

<h3>The grammar</h3>
<table>
<thead><tr><th>Position</th><th>Meaning</th><th>Examples</th></tr></thead>
<tbody>
<tr><td>Family letter(s)</td><td>What the ratio of CPU:RAM:disk:network is tuned for</td><td>m (general), c (compute), r/x/u (memory), i/d (storage), p/g/trn/inf (accelerated), t (burstable), hpc (HPC)</td></tr>
<tr><td>Generation digit</td><td>Hardware generation; higher is newer, almost always cheaper per unit of work</td><td>m5 vs m6 vs m7</td></tr>
<tr><td>Attribute suffixes</td><td>Processor and capability variants</td><td>g = Graviton, a = AMD EPYC, i = Intel, d = local NVMe instance store, n = enhanced networking bandwidth, e = extra memory or storage, z = high frequency, flex = flexible-performance variants</td></tr>
<tr><td>Size</td><td>Linear scaling unit</td><td>large = 2 vCPU, xlarge = 4, 2xlarge = 8 ... up to 32xlarge/48xlarge, plus metal</td></tr>
</tbody>
</table>

<p>Sizes scale linearly within a family: a <code>2xlarge</code> is exactly two <code>xlarge</code> in vCPU, memory, and (roughly) baseline network/EBS bandwidth. This matters for a decision seniors get asked constantly: one 4xlarge or four xlarges? Same compute cost, but many small instances buy you blast-radius reduction and finer bin-packing, while fewer big ones buy you fewer network hops for chatty co-located processes and less per-instance agent overhead. The <code>.metal</code> size gives you the whole host with no hypervisor — needed for nested virtualization or license terms that demand bare metal.</p>

<h3>Family-to-workload mapping</h3>
<ul>
<li><strong>m (general purpose)</strong> — 1:4 vCPU:GiB. The default answer when nothing dominates: app servers, small databases, fleet baseline.</li>
<li><strong>c (compute optimized)</strong> — 1:2. Batch, video encoding, game servers, high-RPS stateless services, CPU-bound inference.</li>
<li><strong>r / x / High Memory u</strong> — 1:8, 1:16+, and up to 24 TiB. Redis/Memcached, real-time analytics, and (for x/u) SAP HANA and other certified in-memory databases. "SAP HANA" in a question is a direct pointer to X or High Memory instances.</li>
<li><strong>i (storage optimized, NVMe)</strong> — local NVMe with millions of IOPS at microsecond latency. NoSQL stores that replicate their own data (Cassandra, ScyllaDB), search clusters, low-latency OLTP where the application owns durability.</li>
<li><strong>d in a suffix</strong> (m6id, c6gd) — the parent family's ratios plus local NVMe for scratch/cache without going full storage-optimized.</li>
<li><strong>Accelerated: p</strong> (training GPUs), <strong>g</strong>-family GPU instances like g5/g6 (graphics and inference — do not confuse the g family letter with the g Graviton suffix), <strong>inf/trn</strong> (Inferentia/Trainium ASICs), <strong>f</strong> (FPGA).</li>
<li><strong>t (burstable)</strong> — baseline CPU with credits. Fine for dev boxes and spiky-low-average workloads; a trap for sustained load. In <code>unlimited</code> mode you silently pay overage instead of throttling — which converts a performance incident into a billing incident.</li>
</ul>

<div class="callout exam">Keyword mapping the exam leans on: "in-memory database, terabytes of RAM" means X/High Memory; "millions of IOPS, application handles replication" means i-family with instance store; "ML training" means p-family; "lowest cost for Arm-compatible workload" means Graviton (g suffix); "HPC, tightly coupled MPI" means hpc-family or c-family in a cluster placement group with EFA.</div>

<h3>Graviton economics</h3>
<p>Graviton (g suffix: c7g, m7g, r8g) is AWS's own Arm Neoverse silicon, and it is priced to move: roughly 10-20 percent cheaper than the comparable x86 type at typically better performance per vCPU for scale-out workloads — AWS quotes up to 40 percent better price-performance, and a further wrinkle is that a Graviton vCPU is a full physical core, not an SMT hyperthread. For anything you compile or that ships multi-arch images — Go, Rust, JVM, Node, Python services, nginx, Redis, and all the managed services (RDS, ElastiCache, OpenSearch, Lambda) where AWS did the porting for you — Graviton is close to free money.</p>
<p>When it does not win: x86-only binary dependencies (commercial agents, legacy vendor software), niche native extensions without Arm wheels, workloads tuned to AVX-512, and Windows (no Graviton support). The migration cost is a CI matrix entry and a bake test, not a rewrite — which is why "reduce compute cost with minimal code change for a Linux JVM service" on the exam is a Graviton answer, not a Spot answer.</p>

<div class="callout deep">Why Graviton is cheap: AWS controls the whole vertical — no Intel/AMD margin, cores designed for cloud tenancy (no SMT means no cross-thread side channels to mitigate), and predictable per-core performance makes capacity planning tighter for AWS itself. The discount is structural, not promotional.</div>

<div class="callout war">Two production traps. First, t-family credit exhaustion: a t3 fleet that survived load testing (fresh credits) collapses days later under sustained load, or with unlimited mode quietly bills you more than an m-family would have cost. Watch <code>CPUCreditBalance</code>, and treat sustained-load t-instances as a smell. Second, generation lag: fleets pinned to m4/c4 by old launch templates pay 20-30 percent more per unit of work than m7g for no benefit. A periodic "newest generation" sweep is one of the highest-ROI cost tasks that exists.</div>

<div class="callout limits">Numbers worth memorizing: sizes scale linearly (large = 2 vCPU, each step doubles); High Memory u-instances reach 24 TiB RAM; default per-region vCPU quotas (on-demand standard families share one vCPU-based limit) are the thing that breaks your first large scale-out — raise them before you need them. EBS-optimized bandwidth and network bandwidth both scale with size; small sizes often have "up to" burst bandwidth, not sustained — a c6gn.medium's "up to 25 Gbps" is not 25 Gbps sustained.</div>

<p>When NOT to use EC2 at all is also part of this lesson's mental model: if the unit of work is a request or an event and the fleet's average utilization is under ~20 percent, Lambda/Fargate will beat any instance-type optimization. Instance taxonomy only matters once you have committed to owning capacity.</p>
`
    },
    {
      id: "nitro",
      title: "The Nitro system: why modern EC2 behaves the way it does",
      html: `
<p>Almost every "why does EC2 do that?" question since 2017 has the same answer: Nitro. The mental model: AWS took everything a traditional hypervisor did besides CPU/memory virtualization — network virtualization, storage virtualization, monitoring, security — and moved it off the main board onto dedicated PCIe cards with their own SoCs. What remains on the host CPU is a deliberately thin, KVM-derived hypervisor that does little more than partition CPU and RAM.</p>

<h3>The components</h3>
<ul>
<li><strong>Nitro cards</strong> — separate cards for VPC networking (this is what presents the ENA device), EBS (presents NVMe devices), instance storage, and a system controller card that coordinates the host. Your instance's network packets are encapsulated (VPC overlay), security-group-filtered, and rate-limited on the card, not by host software. EBS volumes appear to the guest as local NVMe block devices; the card speaks the EBS storage protocol over the network on your behalf.</li>
<li><strong>Nitro hypervisor</strong> — stripped-down KVM. No QEMU device emulation, no dom0-style privileged guest OS, no general-purpose management stack on the host. On <code>.metal</code> instances it is absent entirely; the Nitro cards alone provide the virtual devices, which is why bare metal still gets EBS, VPC, and security groups.</li>
<li><strong>Nitro security chip</strong> — hardware root of trust that measures and attests firmware on every boot, and blocks writes to non-volatile storage from the main board. A compromised host CPU cannot persist malware into firmware.</li>
</ul>

<div class="callout deep">Why offload wins on performance: pre-Nitro Xen instances burned a double-digit percentage of host CPU on the dom0 doing I/O emulation, and that overhead was bursty — your neighbor's network storm was your latency jitter. With Nitro, close to 100 percent of the host's cores and memory are sellable to guests, and I/O virtualization runs at line rate on dedicated silicon with dedicated queues per instance. This is why EC2 can credibly claim near-bare-metal performance, why 100/200 Gbps instance networking exists, and why "noisy neighbor" largely stopped being an I/O story.</div>

<h3>The security model — the part the exam and your CISO care about</h3>
<p>Nitro's trust story is architectural, not procedural. The trusted computing base is narrow (cards, security chip, thin hypervisor — no general-purpose host OS in the data path), and critically, <strong>there is no operator access to hosts</strong>: no SSH daemon, no interactive shell, no API by which an AWS employee can read guest memory or guest storage. Administrative operations go through a narrow, logged, cryptographically authenticated API that structurally lacks memory-read capability. Live update of Nitro components happens without host reboot, which is also why maintenance reboots mostly disappeared. When AWS says "we cannot access your instance data," Nitro is the mechanism that makes it a design property rather than a policy promise.</p>

<div class="callout exam">Exam patterns: "sensitive workload, must guarantee cloud operator cannot access data in use" points at the Nitro security model and, for the stronger in-use isolation ask, <strong>Nitro Enclaves</strong>. "Process PII/keys in an isolated environment with no persistent storage, no interactive access, no external networking" is Enclaves almost verbatim. Also remember: security groups are enforced on the Nitro card — outside the guest — so a rooted instance cannot disable its own firewall.</div>

<h3>Nitro Enclaves</h3>
<p>An enclave is carved out of a running instance's own resources: you dedicate some vCPUs and memory, and Nitro spins up an isolated VM with <em>no</em> network interfaces, no persistent storage, no operator or even parent-instance interactive access. The only channel is a local vsock socket to the parent. The killer feature is <strong>cryptographic attestation</strong>: the enclave produces a signed document of measurements (PCRs) of exactly what code it booted, and KMS key policies can require specific measurements — so a decryption key can be released only to one specific, attested binary, not to the parent instance, not to root on the box, not to anyone. Standard pattern: TLS private keys, card-number processing, multi-party computation where even your own admins are out of scope.</p>

<div class="callout war">Practical Nitro consequences that bite people: (1) EBS volumes enumerate as <code>/dev/nvme1n1</code> style names regardless of the device name in the API, and NVMe ordering is not stable across stop/start — mount by filesystem UUID or the vendor-specific NVMe metadata, never by device path. (2) ENA and NVMe drivers are mandatory: an ancient AMI without them simply will not boot on modern types — this is the classic "why won't my 2014 AMI launch on m5" ticket. (3) Enclaves need enclave-capable Nitro instances with enough vCPUs to donate (at least 4 vCPUs on the parent, since the enclave takes whole cores) and are not available on every size.</div>

<div class="callout limits">Numbers: EBS bandwidth up to several GB/s and 400K+ IOPS on the largest Nitro sizes (io2 Block Express territory); instance networking to 100 Gbps on n-suffix types and 200-3200 Gbps on HPC/ML types with multiple EFAs; up to hundreds of Gbps of aggregate NVMe instance-store throughput on i4i/i3en class hardware. You do not memorize exact figures for the exam, but you should know the shape: bandwidth scales with instance size, and "up to" figures on small sizes are burst, not sustained.</div>

<p>Why this lesson matters beyond trivia: Nitro explains EC2's otherwise-arbitrary rules. Why can you not SSH to the hypervisor? There is nothing to SSH to. Why did older instance families keep some limitations (no ENA, lower IOPS)? Xen, not Nitro. Why does a security group update apply without touching the guest? Card-enforced. Why is bare metal a first-class citizen? Because the hypervisor was never where the cloud features lived. Once you file EC2 features under "which component of Nitro provides this," the platform stops being a bag of special cases.</p>
`
    },
    {
      id: "purchase-options",
      title: "Purchase options I: On-Demand, Reserved Instances, and Savings Plans",
      html: `
<p>EC2 pricing is one product sold under four contracts: pay-as-you-go (On-Demand), one- or three-year commitments (RIs and Savings Plans), scavenged spare capacity (Spot), and guaranteed capacity (Capacity Reservations — covered with lifecycle later). The architecture skill is matching commitment shape to workload certainty; the exam skill is knowing exactly what each instrument does and does not cover.</p>

<h3>On-Demand</h3>
<p>Per-second billing (60-second minimum) for Linux, no commitment, no capacity guarantee — a point people forget: On-Demand is a price, not a promise that capacity exists when you call <code>RunInstances</code>. It is the correct default for unknown or spiky workloads and for the first months of anything new, because every commitment instrument prices off the On-Demand baseline and you need usage data before committing.</p>

<h3>Reserved Instances</h3>
<p>An RI is a <em>billing discount</em> (up to ~72 percent off) matched against running instances each hour, plus — only for zonal RIs — a capacity reservation. Attributes that must match for the discount to apply: instance type, platform (Linux/Windows), tenancy, and scope.</p>
<table>
<thead><tr><th></th><th>Standard RI</th><th>Convertible RI</th></tr></thead>
<tbody>
<tr><td>Discount</td><td>Deepest (up to ~72%)</td><td>Lower (up to ~66%)</td></tr>
<tr><td>Change family/OS/tenancy</td><td>No</td><td>Yes, via exchange (equal or greater value)</td></tr>
<tr><td>Modify (AZ, size within family via normalization units, scope)</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Sell on RI Marketplace</td><td>Yes</td><td>No</td></tr>
</tbody>
</table>
<ul>
<li><strong>Scope:</strong> regional RIs apply the discount to matching usage in any AZ and flex across sizes in the same family (Linux, shared tenancy) using normalization factors — a 1x r6g.2xlarge RI can cover two r6g.xlarge. Zonal RIs pin to one AZ, do not size-flex, but reserve capacity there.</li>
<li><strong>Term and payment:</strong> 1 or 3 years; All Upfront, Partial Upfront, No Upfront — discount increases in that order of prepayment. Three-year All Upfront Standard is the ceiling.</li>
<li><strong>Marketplace:</strong> Standard RIs you no longer need can be resold; this is the escape hatch the exam expects when a scenario says "committed but the project was cancelled."</li>
</ul>

<div class="callout exam">RI trap patterns: "needs guaranteed capacity in a specific AZ for DR" means a <em>zonal</em> RI or an On-Demand Capacity Reservation — regional RIs guarantee nothing about capacity. "Company expects to change instance families as they migrate to Graviton" means Convertible RI or (better) Compute Savings Plan. "Wants to recoup cost of unused reservation" means Standard RI + Marketplace, because Convertibles cannot be sold.</div>

<h3>Savings Plans</h3>
<p>Savings Plans invert the model: instead of committing to an instance shape, you commit to <strong>spend</strong> — a dollars-per-hour floor for 1 or 3 years — and AWS applies the discount to whatever eligible usage you run, automatically, always applying the plan to the highest-discount-percentage usage first.</p>
<table>
<thead><tr><th></th><th>Compute Savings Plan</th><th>EC2 Instance Savings Plan</th></tr></thead>
<tbody>
<tr><td>Covers</td><td>Any EC2 (any family, size, region, OS, tenancy) + Fargate + Lambda</td><td>One instance family in one region (any size, OS, tenancy)</td></tr>
<tr><td>Max discount</td><td>~66% (Convertible-RI-like)</td><td>~72% (Standard-RI-like)</td></tr>
<tr><td>Mental model</td><td>Maximum flexibility, slightly worse rate</td><td>Family-pinned, best rate</td></tr>
</tbody>
</table>
<p>Neither flavor reserves capacity, and neither covers Spot (Spot has its own pricing) or, notably, RDS/other managed services (those have their own RIs). For most organizations the modern default is: Compute Savings Plans for the baseline you are sure of in aggregate, EC2 Instance SPs or Standard RIs only for ultra-stable known-family workloads, and nothing for the uncertain tail.</p>

<div class="callout deep">How application actually works each hour: the billing engine takes your committed dollars/hour, walks your eligible usage sorted by discount percentage (so a plan pays down the usage where it saves the most first), bills that usage at the discounted rate until the commitment is consumed, and bills the remainder On-Demand. Unused commitment in an hour is simply forfeited — commitments are use-it-or-lose-it per hour, which is why you commit to the <em>trough</em> of your usage curve, not the average.</div>

<div class="callout war">Real-world commitment failures: (1) committing to the average, then paying for unused commitment every night when the fleet scales in — commit to the 24/7 floor; (2) EC2 Instance SP on a family you then migrate off (the m5-to-m7g Graviton migration strands m5-pinned commitments — Convertible RIs can at least be exchanged; EC2 Instance SPs cannot); (3) forgetting that Savings Plans discounts apply account-wide (or org-wide with consolidated billing), so one team's "our" RI silently subsidizes another team's usage and their showback numbers stop making sense. Discount sharing across an Organization is a feature for the CFO and a haunting for platform teams doing chargeback.</div>

<div class="callout limits">Memorize the shape, not the decimals: Standard RI and EC2 Instance SP top out around 72 percent off; Convertible RI and Compute SP around 66; Spot up to 90. One and three year terms only — there is no 2-year instrument. Regional RI size-flex applies only to Linux/shared-tenancy, within one family, via normalization units (xlarge = 8 units, 2xlarge = 16, and so on).</div>

<p>When NOT to commit at all: workloads under ~9 months of expected life, anything about to be containerized onto a shared platform that already carries commitments, and pre-product-market-fit startups where the 30 percent saved is not worth the optionality lost. Commitment instruments are financial leverage; leverage cuts both ways.</p>
`
    },
    {
      id: "spot",
      title: "Purchase options II: Spot — engineering around interruption",
      html: `
<p>Spot is AWS selling the option value of its idle capacity: up to 90 percent off On-Demand, in exchange for a contract that says AWS can take the capacity back with two minutes' notice. The modern mental model matters: Spot prices no longer spike in bidding wars (the auction model died in 2017); prices drift slowly based on long-term supply and demand per <strong>capacity pool</strong> — a pool being one instance type in one AZ. Interruption risk, not price, is the variable you engineer around.</p>

<h3>The interruption contract</h3>
<ul>
<li><strong>Two-minute interruption notice</strong>, delivered two ways: an EventBridge event (<code>EC2 Spot Instance Interruption Warning</code>) and an IMDS field the instance can poll (<code>http://169.254.169.254/latest/meta-data/spot/instance-action</code> — 404 until an interruption is scheduled). Your handler drains connections, checkpoints work, deregisters from the load balancer/cluster.</li>
<li><strong>Rebalance recommendation</strong> — an earlier, softer signal (EventBridge + IMDS <code>events/recommendations/rebalance</code>) that a pool is at elevated interruption risk. It can arrive well before, or effectively simultaneously with, the two-minute notice — treat it as "start replacing proactively," not as a guaranteed head start. Auto Scaling groups can act on it automatically with Capacity Rebalancing (launch replacement before terminating the at-risk node).</li>
<li>On interruption you choose terminate, stop, or hibernate behavior; you do not pay for the interrupted partial hour if AWS interrupts you (Linux).</li>
</ul>

<div class="callout deep">Why diversification is the whole game: interruptions are per-pool events. c7g.2xlarge in us-east-1a is a different pool from c7g.2xlarge in us-east-1b and from c6i.2xlarge in 1a. A fleet spread across 10+ pools converts "we lost 40 percent of capacity at once" into "we lose a few percent, continuously, and replacements launch from healthier pools." Be flexible on size and family (your scheduler cares about aggregate vCPU/RAM, not the SKU) and you multiply your pool count. Attribute-based instance selection — declare vCPU/memory requirements instead of listing types — is the current best practice for exactly this reason.</div>

<h3>Fleets and allocation strategies</h3>
<p><strong>EC2 Fleet</strong> and <strong>Spot Fleet</strong> both launch capacity across multiple pools to a target (Spot Fleet is the older, standalone API; EC2 Fleet is the current-generation engine, and its instant mode plus Auto Scaling groups with mixed instances policies are what AWS steers new designs toward — an ASG with a mixed policy is the right answer for anything long-running). The allocation strategy decides which pools to draw from:</p>
<table>
<thead><tr><th>Strategy</th><th>Picks pools by</th><th>Use / verdict</th></tr></thead>
<tbody>
<tr><td>lowest-price</td><td>Cheapest pools first</td><td>Concentrates the fleet in few, often-crowded pools; highest interruption churn. Legacy default, almost never right.</td></tr>
<tr><td>capacity-optimized</td><td>Pools with the most spare capacity (lowest interruption likelihood)</td><td>Right call for anything where interruption has a real cost: batch with long tasks, stateful-ish services, CI.</td></tr>
<tr><td>price-capacity-optimized (PCO)</td><td>Capacity-optimized first, then price among the healthy pools</td><td>The recommended default for nearly all workloads — nearly the interruption profile of capacity-optimized at better cost.</td></tr>
</tbody>
</table>
<p>Why lowest-price loses: the cheapest pool is cheap because demand is low <em>now</em>; it is frequently a shallow pool where the next big On-Demand customer evicts you. Paying two percent more for a deep pool that interrupts 5x less is trivially worth it once you price the interruption (lost work, replacement launch latency, rebalancing churn).</p>

<div class="callout exam">Exam mappings: "fault-tolerant / batch / stateless / containerized, minimize cost" is Spot. "Minimize interruptions in a Spot fleet" is capacity-optimized or price-capacity-optimized allocation plus diversification across instance types and AZs. "React to interruption" is the 2-minute notice via IMDS or EventBridge. Anything stateful with no drain story, strict SLA, or single-pool rigidity is a wrong-answer flag for Spot. Also expect the Spot-plus-On-Demand blend: ASG mixed instances policy with an On-Demand base and a percentage split above it.</div>

<div class="callout war">Field lessons: (1) Two minutes is a budget — measure your drain time. If checkpointing takes four minutes, your architecture is wrong, not the notice. (2) Handle the interruption at the orchestration layer, not with per-app SIGTERM heroics: node-termination-handler on Kubernetes cordons and drains; ASG Capacity Rebalancing plus lifecycle hooks does it for plain fleets. (3) Spot capacity is correlated with everyone else's demand — us-east-1 GPU pools can go effectively dry for days; a p4d Spot strategy without an On-Demand or Capacity-Block fallback is a science project. (4) People forget stopped-then-restarted Spot workflows and hibernation have narrow support; design for terminate-and-replace.</div>

<div class="callout limits">Numbers: savings up to 90 percent, typically 60-80 in practice. Interruption notice: 120 seconds, IMDS endpoint <code>spot/instance-action</code>, poll interval guidance ~5 seconds. Rebalance recommendation: no guaranteed lead time. Spot capacity counts against the same regional vCPU quotas family ("All Standard Spot" quota, separate from On-Demand quotas). Historical average interruption frequency across pools is low single-digit percent per month, but the tail is everything — design for the pool that dies, not the average.</div>

<p>When NOT to use Spot: hard-deadline work that cannot checkpoint, licensed software with per-instance activation friction, tiny fleets (one interruption is 100 percent capacity loss), and anything whose recovery story you have not actually tested by killing instances on purpose. If you have not chaos-tested the interruption path, you do not have a Spot architecture — you have a discount and a pager.</p>
`
    },
    {
      id: "placement-networking",
      title: "Placement groups, ENA, and EFA: controlling locality and the fabric",
      html: `
<p>By default EC2 places your instances wherever its bin-packing likes, and gives you an ENA network device that behaves like a very good virtio NIC. Two knobs change that: placement groups (where instances land relative to each other) and EFA (how tightly the network integrates with your application). Both exist to serve the two ends of a spectrum — "as close as possible" for latency, "as far apart as possible" for failure independence.</p>

<h3>Placement groups: three strategies, three problems</h3>
<table>
<thead><tr><th>Strategy</th><th>Placement</th><th>Problem it solves</th><th>Canonical workloads</th></tr></thead>
<tbody>
<tr><td>Cluster</td><td>Same rack neighborhood, single AZ (typically same network spine)</td><td>Lowest latency, highest per-flow throughput between nodes</td><td>HPC/MPI, tightly coupled ML training, low-latency trading sims</td></tr>
<tr><td>Spread</td><td>Each instance on distinct hardware (separate racks, power, network)</td><td>Correlated hardware failure of a small set of critical instances</td><td>The 3 or 5 nodes of a quorum: ZooKeeper, etcd, database primaries</td></tr>
<tr><td>Partition</td><td>Up to 7 partitions per AZ; each partition on isolated racks; instances within a partition may share racks</td><td>Rack-awareness for large distributed systems that replicate across failure domains</td><td>Kafka, HDFS, Cassandra — map replicas/brokers to partitions</td></tr>
</tbody>
</table>
<ul>
<li><strong>Cluster</strong> is a locality bet with a capacity risk: the more instances you want adjacent, the more likely there is no contiguous slot. Launch the whole cluster in one request (or one fleet call) — incremental additions to an old cluster group are the classic Insufficient Capacity Error generator. Stopping and starting a member can also fail to re-place it. Best practice: homogeneous instance types, all-at-once launch, and if you get ICE, stop everything in the group and relaunch together.</li>
<li><strong>Spread</strong> has a hard ceiling: <strong>7 running instances per AZ per group</strong> (host-level spread on Outposts differs). It is for the handful of instances whose simultaneous loss is an outage, not for fleets. Multi-AZ spread groups give you 7 per AZ.</li>
<li><strong>Partition</strong> exposes topology: the partition index is visible in the instance metadata and API, so Kafka/Cassandra can place replicas in distinct partitions and survive a whole-rack loss exactly as their rack-awareness config intends. Up to 7 partitions per AZ; instance count per partition is bounded only by your quotas.</li>
</ul>

<div class="callout exam">Mappings: "lowest network latency between nodes" is cluster (accept the single-AZ blast radius — the question will say the workload is tightly coupled). "Small number of critical instances that must not share hardware" is spread — and if the number quoted is above 7 per AZ, that is the trap. "Kafka/HDFS/Cassandra needs rack-level failure isolation for large fleets" is partition. Placement groups are free; there is no charge dimension here.</div>

<h3>ENA: the baseline fabric</h3>
<p>ENA (Elastic Network Adapter) is SR-IOV enhanced networking: the Nitro VPC card exposes a virtual function directly into the guest, bypassing any software switch. You get up to 100 Gbps on n-suffix types, multi-queue with RSS, and consistent microsecond-class overhead. It is the default on all Nitro instances — the exam phrase "enable enhanced networking" is really about ensuring the ENA driver/attribute is present on older AMIs. ENA Express (SRD under TCP, single-AZ) is worth knowing as a name: it applies the same multi-path SRD transport EFA uses to boost single-flow throughput and cut tail latency between supported instances.</p>

<h3>EFA: when the kernel is the bottleneck</h3>
<p>EFA (Elastic Fabric Adapter) is ENA plus an <strong>OS-bypass</strong> path. HPC/ML applications talk to the NIC directly from userspace via libfabric — MPI or NCCL issue operations without kernel network-stack involvement — over SRD (Scalable Reliable Datagram), AWS's multipath transport that sprays packets across many fabric paths, tolerates out-of-order delivery, and retransmits in microseconds. The result is the two things collective operations care about: single-digit-microsecond latency and enormous effective bandwidth without head-of-line blocking.</p>
<p>Constraints that make exam answers easy: EFA's OS-bypass traffic works only <strong>within one subnet/AZ</strong> (it is not routable), demands a security group that allows all traffic from itself, and only pays off in cluster-style topologies — you deploy it with a cluster placement group and MPI/NCCL workloads. Regular IP traffic over an EFA still behaves like ENA, so the same device serves both paths. Windows treats EFA as plain ENA.</p>

<div class="callout deep">Why SRD instead of TCP or InfiniBand-style RC: data-center fabrics have massive path diversity, and a single 5-tuple TCP flow uses one path — one congested spine link caps your flow. SRD sprays a single logical stream across many paths simultaneously and reorders at the receiver, so throughput approaches the bisection bandwidth and a slow path costs microseconds, not a TCP retransmit timeout. It is AWS re-deriving something InfiniBand-like on commodity Ethernet, tuned for their own topology.</div>

<div class="callout war">Real-world notes: cluster placement groups punish heterogeneity — mixing generations in one group narrows the eligible hardware set and drives ICE. EFA requires software cooperation: your MPI must be built against libfabric; a misconfigured security group (not self-referencing all-traffic) yields silent fallback or hangs that look like application bugs. And do not put an EFA expectation on multi-AZ designs — teams have burned weeks discovering the OS-bypass path simply does not cross AZs.</div>

<div class="callout limits">Memorize: spread = max 7 running instances per AZ per group; partition = up to 7 partitions per AZ; cluster = one AZ only. ENA up to 100 Gbps (n-types), EFA-carrying ML/HPC types reach 400-3200 Gbps aggregate with multiple adapters. An instance can attach only one EFA on most types (the giant ML types take several). Placement group per-region quotas exist but are soft.</div>

<p>Decision rule: if instances are replicas, push them apart (spread/partition); if they are one workload split across nodes, pull them together (cluster + EFA). If they are neither — ordinary stateless fleets behind a load balancer — default placement across AZs via your ASG is already correct, and a placement group would only add failure modes.</p>
`
    },
    {
      id: "amis-storage",
      title: "AMIs, instance store vs EBS: boot semantics and data lifetime",
      html: `
<p>An AMI is three things stapled together: block-device mappings (pointers to EBS snapshots and/or instance-store volumes), launch metadata (architecture, virtualization type, required devices like ENA), and launch permissions (who may use it). The root volume's backing type dictates the instance's entire lifecycle semantics, so start there.</p>

<h3>EBS-backed vs instance-store-backed AMIs</h3>
<table>
<thead><tr><th></th><th>EBS-backed</th><th>Instance-store-backed</th></tr></thead>
<tbody>
<tr><td>Root device</td><td>EBS volume created from a snapshot</td><td>Local disk, image copied from S3 at launch</td></tr>
<tr><td>Stop / hibernate</td><td>Supported</td><td>Not possible — only run, reboot, terminate</td></tr>
<tr><td>Root persists on stop</td><td>Yes (and survives termination if DeleteOnTermination is false)</td><td>No stop exists; terminate discards everything</td></tr>
<tr><td>Boot time</td><td>Fast, lazy-loads blocks from snapshot</td><td>Slower, full image copy from S3</td></tr>
<tr><td>Resize instance</td><td>Stop, change type, start</td><td>Cannot (no stop)</td></tr>
</tbody>
</table>
<p>Instance-store-backed AMIs are a legacy corner — modern practice is EBS-backed AMIs even for instances that also mount instance-store data volumes. But the exam still probes the semantic difference, usually via "why can this instance not be stopped."</p>

<h3>Instance store vs EBS as data volumes — the semantics that matter</h3>
<p>Instance store is the NVMe (or SATA on ancient types) physically inside the host. Consequences follow mechanically:</p>
<ul>
<li><strong>Ephemerality:</strong> data survives an OS reboot (same host), but is cryptographically erased on stop, hibernate-incompatible, lost on terminate, and lost on host failure. Stop/start moves you to a new host; the old disks are scrubbed. There are no snapshots of instance store.</li>
<li><strong>Performance:</strong> local PCIe distance — i4i-class instances deliver millions of IOPS at tens-of-microseconds latency, far beyond any EBS volume, with no network variance and no per-IOPS charge. It is included in the instance price.</li>
<li><strong>Right uses:</strong> scratch/temp/spill space (Spark shuffle, video transcode, build caches), local caches rebuilt on start, and — the big one — data stores that own their replication: Cassandra, ScyllaDB, Elasticsearch/OpenSearch hot tiers, Kafka (with replication factor doing the durability work). The application-level replica set is the durability layer; the disk is allowed to be mortal.</li>
</ul>
<p>EBS is the opposite trade: network-attached, so latency is sub-millisecond rather than tens of microseconds and throughput is capped by both volume and instance EBS-bandwidth limits — but volumes persist independently of instances, snapshot to S3, re-attach elsewhere in the AZ, and encrypt/resize online. Default for anything whose durability story is "the disk must survive."</p>

<div class="callout war">The classic incident: a team benchmarks on i3en (glorious IOPS), ships it, and months later a routine stop/start — or an AWS host retirement notice auto-stop — silently lands them on fresh, empty NVMe. If data on instance store is not either disposable or replicated at the application layer with tested recovery, it is already lost; you just have not observed it yet. Treat "instance store" in a design review as a prompt for exactly one question: what re-creates this data?</div>

<h3>AMI operations you actually use</h3>
<ul>
<li><strong>Create:</strong> <code>aws ec2 create-image</code> snapshots all attached EBS volumes (by default rebooting the instance for consistency; <code>--no-reboot</code> trades crash-consistency risk for uptime).</li>
<li><strong>Share cross-account:</strong> add launch permissions for specific account IDs (or an Organization/OU ARN) — this shares the AMI in place; the underlying snapshots must also be shared, and the consumer launches in <em>your</em> region's AMI. Public AMIs: block-public-access for AMIs exists and should stay on.</li>
<li><strong>Copy cross-region:</strong> AMIs are regional; <code>aws ec2 copy-image</code> into the target region produces a new AMI ID (bake this into DR runbooks — your ASG launch template in the DR region needs the copied ID, not the original).</li>
<li><strong>Encryption on copy:</strong> copy-image can encrypt an unencrypted AMI, or re-encrypt to a different KMS key — the standard path for "make our golden image encrypted with the shared CMK" and for handing images across account boundaries with the right key policy. You cannot directly share an AMI encrypted with the default aws/ebs key; use a customer managed key and grant the consumer account access.</li>
<li><strong>Deregister vs snapshots:</strong> deregistering an AMI only removes the AMI record — the backing snapshots keep billing until you delete them yourself. Orphaned AMI snapshots are one of the most common silent line items in old accounts. (Deregistered AMIs sit in a recycle bin briefly if you enabled Recycle Bin rules.)</li>
</ul>

<div class="callout exam">Trap patterns: "stopped the instance and the data vanished" is instance store. "Cannot stop the instance at all" is an instance-store-backed AMI. "Share encrypted AMI with another account" requires a customer managed KMS key with a key grant, never the default key. "Use the AMI in another region" requires copy-image. "Deleted the AMI but still being charged" is the orphaned snapshots. "Millions of IOPS, Cassandra, application replicates data" is instance store on i-family.</div>

<div class="callout deep">Why EBS-backed boots are fast: the snapshot's blocks live in S3 and are pulled on first read (lazy restore), so the instance boots after fetching only the blocks the boot path touches — and first-touch latency on cold blocks is the price. Fast Snapshot Restore pre-warms a snapshot in an AZ for full performance on first read, at a real per-hour cost. This same lazy-restore behavior explains why a freshly restored database volume benchmarks terribly until warmed.</div>

<div class="callout limits">Numbers: instance store size and device count are fixed per instance type (you cannot ask for more); i3en tops out around 60 TB of NVMe per instance. Spread of EBS: gp3 up to 16,000 IOPS/1,000 MBps per volume, io2 Block Express to 256,000 IOPS — still an order of magnitude under big instance store. AMIs are regional objects; launch permissions cap out at sharing with accounts/OUs, and encrypted-AMI sharing requires CMK key policy plus snapshot sharing.</div>

<p>Golden-image strategy in one paragraph: bake AMIs in a pipeline (Image Builder or Packer), version them, share to workload accounts via the Organization, copy to DR regions, encrypt with a shared CMK, and lifecycle old versions including their snapshots. Mutable pet instances with years of drift are how you end up unable to reproduce prod during an incident.</p>
`
    },
    {
      id: "userdata-imds",
      title: "User data and IMDS: bootstrap plumbing and the SSRF blast door",
      html: `
<p>Two adjacent mechanisms wire an instance into your automation: user data (what runs at boot) and the Instance Metadata Service (what the instance can learn — and what credentials it holds). One of them was the pivot point of some of the most instructive cloud breaches of the last decade, so this lesson is half mechanics, half security model.</p>

<h3>User data</h3>
<p>User data is an up-to-16-KB blob delivered to the instance and consumed by cloud-init (Amazon Linux/Ubuntu) or EC2Launch (Windows). Semantics a senior should have precise: shell-script user data runs <strong>once, at first boot, as root</strong>, by default — not on every reboot (cloud-init records completion in <code>/var/lib/cloud</code>; a per-boot MIME directive or cloud-init config can change that). It is not secret storage: anyone with <code>DescribeInstanceAttribute</code> on the instance — and any process on the instance itself via IMDS at <code>latest/user-data</code> — can read it. Secrets go in Secrets Manager/SSM Parameter Store, fetched by the instance role; user data should contain only the bootstrap logic that does the fetching.</p>
<p>Modern usage keeps user data thin: register with config management, pull the real bootstrap from a versioned artifact, signal completion (cfn-signal or SSM). Thousand-line inline scripts are un-testable and un-diffable; treat user data as an entry point, not a program. Debugging: <code>/var/log/cloud-init-output.log</code> is where your script's stdout/stderr went.</p>

<div class="callout war">Two recurring user-data incidents: (1) a script that worked in testing fails in an ASG scale-out because it depends on a package repo or metadata endpoint that is slow at 6 a.m., cloud-init "succeeds" with a half-configured instance, and the ELB health check happily admits it — always gate instance service-readiness on the actual bootstrap result, and use ASG lifecycle hooks to hold instances out of service until signaled; (2) credentials pasted into user data, which then live forever in launch templates, console history, and CloudTrail-adjacent tooling. User data is config-visible to anyone with EC2 read access.</div>

<h3>IMDS: the credential vending machine</h3>
<p>IMDS lives at the link-local address <code>169.254.169.254</code> (and a v6 equivalent), answered by the Nitro card, unauthenticated by network position: any process on the instance can query it. It serves instance identity, network config, tags (if enabled), user data — and, critically, <strong>temporary credentials for the instance role</strong> at <code>iam/security-credentials/role-name</code>. Those credentials are the instance's identity; anything that can read IMDS can act as the instance.</p>

<h3>Why IMDSv1 is an SSRF hole</h3>
<p>IMDSv1 is plain request/response: a single GET returns credentials. Now compose that with any server-side request forgery: a WAF-bypassing proxy misconfiguration, an app that fetches user-supplied URLs, a vulnerable SSRF gadget in a library — the attacker asks your app to fetch <code>http://169.254.169.254/latest/meta-data/iam/security-credentials/...</code> and your app returns the role's keys in the HTTP response. That is the pattern behind the 2019 Capital One breach class of incidents: SSRF to IMDSv1, exfiltrated role credentials, then S3 enumeration from anywhere. No malware on the box required — the instance's own plumbing handed over its identity.</p>

<h3>IMDSv2: session-oriented by design</h3>
<p>IMDSv2 requires a two-step dance engineered so that common SSRF and proxy gadgets cannot perform it:</p>
<pre><code>TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
curl -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/iam/security-credentials/</code></pre>
<p>The defenses stack: (1) the token requires a <strong>PUT</strong> with a custom header — most SSRF primitives can only GET and cannot set arbitrary headers; (2) IMDS rejects token requests carrying an <code>X-Forwarded-For</code> header, killing the misconfigured-reverse-proxy path; (3) the response's IP TTL (hop limit) defaults to 1, so the token dies at the first router hop — it cannot transit out of the instance by accident. Tokens are session credentials with a TTL up to six hours, reusable across requests.</p>

<h3>Enforcing v2</h3>
<ul>
<li>Per instance/launch template: metadata options <code>HttpTokens=required</code> (v2-only), <code>HttpPutResponseHopLimit</code>, <code>HttpEndpoint=disabled</code> to turn IMDS off entirely for instances that need no role.</li>
<li><strong>Containers caveat:</strong> hop limit 1 breaks IMDS access from containers in some network modes (the container is one hop away through the bridge); set hop limit 2 for Docker-bridge workloads — or better, do not let pods touch IMDS at all: use IRSA/EKS Pod Identity and firewall 169.254.169.254 from pods so a compromised pod cannot steal the <em>node's</em> role.</li>
<li>Fleet governance: account-level default (<code>ec2 modify-instance-metadata-defaults</code>) can make v2 required region-wide for new launches; the IAM condition key <code>ec2:MetadataHttpTokens</code> blocks non-compliant RunInstances; the CloudWatch metric <code>MetadataNoToken</code> shows who still calls v1 before you flip the switch.</li>
</ul>

<div class="callout exam">Exam signatures: "protect against SSRF stealing instance credentials" means require IMDSv2 (HttpTokens=required). "User data did not run again after reboot" means it runs once at first boot by design. "Script needs instance ID / AZ at runtime" means query IMDS. "Containers cannot reach IMDSv2" means hop limit. "Secrets in user data" is always wrong — Secrets Manager plus instance role.</div>

<div class="callout deep">Where credentials actually come from: the instance profile's role credentials are minted by an internal STS flow and cached by the Nitro card's IMDS implementation, auto-rotated (typically refreshed in the last chunk of their roughly six-hour validity). SDKs resolve the credential chain to IMDS last, cache, and refresh ahead of expiry — which is why a briefly unreachable IMDS rarely pages you, but an instance with a clock badly skewed can present "expired" tokens and fail in ways that look like IAM.</div>

<div class="callout limits">Memorize: 169.254.169.254; user data max 16 KB; runs once, as root, at first boot; IMDSv2 token TTL max 21,600 seconds (6 hours); hop limit default 1, set 2 for bridged containers; account-wide v2 default is settable per region. GuardDuty's InstanceCredentialExfiltration findings fire when instance-role credentials are used from outside AWS or another account — the detective control that pairs with the v2 preventive control.</div>

<p>Bottom line: treat IMDS as the most sensitive HTTP endpoint in your fleet, because it is. Requiring v2 everywhere is one flag on a launch template and closes a real, exploited breach class for free.</p>
`
    },
    {
      id: "lifecycle-capacity",
      title: "Lifecycle, hibernation, capacity reservations, and dedicated tenancy",
      html: `
<p>The last cluster of EC2 mechanics the exam mines: what exactly happens on stop/terminate/hibernate (and what you pay in each state), how to guarantee capacity independently of discounts, and the two "dedicated" tenancy models that exist almost entirely because of software licensing.</p>

<h3>Stop vs terminate vs hibernate</h3>
<table>
<thead><tr><th></th><th>Stop</th><th>Hibernate</th><th>Terminate</th></tr></thead>
<tbody>
<tr><td>RAM</td><td>Lost</td><td>Written to encrypted EBS root, restored on start</td><td>Lost</td></tr>
<tr><td>EBS root/volumes</td><td>Persist</td><td>Persist</td><td>Root deleted if DeleteOnTermination=true (default); data volumes per flag</td></tr>
<tr><td>Instance store</td><td>Erased</td><td>Not supported as state target; contents lost</td><td>Erased</td></tr>
<tr><td>Host placement</td><td>New host on start (usually)</td><td>New host on start</td><td>n/a</td></tr>
<tr><td>Billing while in state</td><td>EBS + EIP only, no instance charge</td><td>EBS (including the RAM dump) + EIP, no instance charge</td><td>Nothing (post-deletion)</td></tr>
<tr><td>Public IPv4 (auto-assigned)</td><td>Changes on start</td><td>Changes on start</td><td>Released</td></tr>
</tbody>
</table>
<p><strong>Stop/start moves the host.</strong> That is the fix for a degraded-hardware notice, the reason instance-store data dies on stop, and the reason a stuck "Insufficient Capacity" launch sometimes clears by stopping and starting later (new placement attempt). Reboot, by contrast, stays on the same host — same instance store contents, same billing hour semantics, no IP change.</p>
<p><strong>Hibernate</strong> freezes RAM to the encrypted EBS root and resumes with processes, caches, and page tables intact — turning a minutes-long JVM warmup into seconds of resume. The prerequisites are a checklist the exam likes: EBS root volume, <em>encrypted</em>, large enough to hold RAM; hibernation enabled at launch (immutably); supported instance families/sizes with RAM up to a documented cap; supported OS. Hibernation duration is capped (60 days). Spot supports interruption-to-hibernate only in narrow legacy cases — assume terminate for Spot designs.</p>

<div class="callout war">Termination-adjacent incidents: (1) DeleteOnTermination defaults differ — root true, added data volumes false — so terminated fleets leave orphan volumes billing forever, while conversely someone flips root to false "for safety" and floods the account with unattached roots; (2) termination protection (<code>DisableApiTermination</code>) stops API terminate but does <em>not</em> stop an ASG scale-in or OS shutdown with the shutdown-behavior set to terminate; protecting a pet instance means all three settings, or better, not having pet instances; (3) stopped-instance drift — a box stopped for a quarter restarts with expired agents, dead certs, and a security-group world that moved on.</div>

<h3>On-Demand Capacity Reservations and Capacity Blocks</h3>
<p>Discounts and capacity are orthogonal, and AWS split the instruments accordingly. An <strong>On-Demand Capacity Reservation (ODCR)</strong> reserves capacity for a specific instance type, in a specific AZ, with no term commitment — create it and delete it whenever. You pay the On-Demand rate for the reservation whether or not instances are running in it (an empty reservation bills like a running instance), which is precisely the point: the money holds the hardware. Because ODCRs carry no discount, you <strong>combine them with Savings Plans or regional RIs</strong> — the commitment instrument discounts the bill, the ODCR guarantees the capacity. That combination is the canonical exam answer for "guaranteed capacity for DR failover in a specific AZ at the lowest cost." ODCRs can be open (matching instances consume them automatically) or targeted, and can be shared across accounts via RAM.</p>
<p><strong>Capacity Blocks for ML</strong> are the GPU variant: reserve p5-class capacity for a defined future window (days to weeks) at a market-based price — the answer to "we need 64 H100 instances for a two-week training run next month" in a world where GPU Spot and On-Demand are unreliable.</p>

<div class="callout exam">Keep the three-way distinction crisp: zonal RI = discount + capacity, 1-3 year lock; regional RI / Savings Plan = discount only, zero capacity assurance; ODCR = capacity only, zero discount, no term. Any question pairing "must guarantee capacity" with "already have Savings Plans" wants an ODCR layered on top.</div>

<h3>Dedicated Instances vs Dedicated Hosts</h3>
<table>
<thead><tr><th></th><th>Dedicated Instance</th><th>Dedicated Host</th></tr></thead>
<tbody>
<tr><td>Isolation</td><td>Your account's instances only on the hardware</td><td>You are allocated a whole physical server</td></tr>
<tr><td>Socket/core visibility</td><td>None</td><td>Full — sockets, physical cores, host ID</td></tr>
<tr><td>Placement control / affinity</td><td>None; host can change on stop/start</td><td>Host affinity pins an instance to a specific host across stop/start</td></tr>
<tr><td>BYOL per-socket/per-core licenses (Windows Server, SQL Server, Oracle)</td><td>Not compliant for most such licenses</td><td>The reason the product exists</td></tr>
<tr><td>Billing</td><td>Per instance + per-region dedicated fee</td><td>Per host (any allowed instances on it are free to run); RIs/SPs for hosts exist</td></tr>
</tbody>
</table>
<p>The decision is almost always licensing, not security: per-socket/per-core BYOL terms require counting physical hardware you control, which demands host visibility and stable placement — Dedicated Hosts, plus AWS License Manager to track consumption and host affinity so a stop/start does not silently migrate a licensed VM to an unlicensed socket. Dedicated Instances satisfy a compliance checkbox ("no shared tenancy") at lower operational burden but give you nothing countable. If the requirement is merely "isolation," modern answers also include the fact that Nitro's isolation already exceeds most regulatory intent — dedicated tenancy is a contracts feature more than a security feature.</p>

<div class="callout deep">Why stopped instances bill nothing for compute: a stopped EC2 instance is just metadata plus EBS volumes — no host resources are held (which is exactly why restart placement can fail with ICE, and why ODCRs exist for the cases where that is unacceptable). Hibernated instances are the same, plus the RAM image occupying paid EBS bytes. The billing model follows the physics.</div>

<div class="callout limits">Numbers to keep: hibernation requires an encrypted EBS root sized for RAM, with supported-RAM caps (well under the biggest instances) and a 60-day maximum hibernation; ODCRs are zonal and start billing immediately upon creation, used or not; Dedicated Hosts support a fixed set of instance sizes per host type (modern Nitro hosts allow mixed sizes within one family); termination protection does not block ASG scale-in. Auto-assigned public IPv4 changes on every stop/start — and IPv4 addresses now bill per hour, idle or not, which made EIP hygiene a real line item.</div>

<p>Closing mental model for the module: EC2 hands you four orthogonal dials — what hardware (type/tenancy), where (placement/AZ), under which contract (purchase option/capacity reservation), and with what lifetime semantics (EBS vs instance store, stop vs terminate). Senior-level EC2 architecture is refusing to let any one requirement (a license, a latency number, a discount) accidentally set the other three dials.</p>
`
    }
  ],
  quiz: [
    {
      q: "A genomics company runs tightly coupled MPI simulations across 64 nodes and needs the lowest possible inter-node latency and highest per-flow bandwidth. Which combination should the architect choose?",
      options: [
        "Spread placement group across three AZs with ENA Express enabled",
        "Cluster placement group in a single AZ with EFA-enabled instances",
        "Partition placement group with 7 partitions and jumbo frames",
        "Default placement across two AZs with Network Load Balancers between tiers",
        "Cluster placement group spanning two AZs for resilience with EFA"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> Tightly coupled MPI is the textbook case for a cluster placement group (same rack neighborhood, single AZ) plus EFA, whose OS-bypass/SRD path delivers single-digit-microsecond latency to libfabric-aware MPI stacks.</p><p><strong>A</strong> is backwards: spread groups push instances apart onto distinct hardware (and cap at 7 per AZ), maximizing latency between them — it solves correlated failure, not locality. <strong>C</strong> is for rack-aware distributed storage/streaming systems (Kafka, HDFS); partitions isolate racks and add no latency benefit. <strong>D</strong> offers no locality at all, and load balancers are irrelevant to MPI point-to-point traffic. <strong>E</strong> is impossible: cluster placement groups cannot span AZs, and EFA's OS-bypass traffic does not cross subnets/AZs either.</p>"
    },
    {
      q: "A payments platform runs 3 ZooKeeper nodes per AZ across 3 AZs. After a rack-level failure took down two nodes at once, the team wants EC2 to guarantee the nodes never share underlying hardware. What should they use?",
      options: [
        "A cluster placement group per AZ",
        "A partition placement group with one partition per node",
        "A spread placement group spanning the three AZs",
        "Dedicated Instances for all nine nodes",
        "An On-Demand Capacity Reservation per node"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>C is correct.</strong> A spread placement group places each instance on distinct racks with separate power/network; a multi-AZ spread group supports up to 7 running instances per AZ — 3 per AZ fits comfortably, and quorum members are exactly its intended use case.</p><p><strong>A</strong> does the opposite — cluster packs instances close together, increasing shared-hardware risk. <strong>B</strong> could work mechanically but is designed for large rack-aware fleets (Kafka/HDFS/Cassandra); for a handful of critical nodes, spread gives strictly stronger per-instance hardware isolation (each instance isolated, not each group-of-instances). <strong>D</strong> isolates you from other AWS customers, not your own instances from each other — two Dedicated Instances can share the same host. <strong>E</strong> guarantees capacity exists, not that instances land on distinct hardware.</p>"
    },
    {
      q: "A company committed to a 3-year EC2 Instance Savings Plan for the m5 family in us-east-1. Twelve months in, they are migrating all workloads to m7g Graviton instances for cost reasons. What is the consequence?",
      options: [
        "The Savings Plan automatically applies to the m7g usage since both are general purpose",
        "They can exchange the Savings Plan for an m7g-scoped plan of equal value",
        "They can sell the remaining Savings Plan term on the AWS Marketplace",
        "The plan keeps billing its hourly commitment but no longer matches their usage; the m7g instances bill at On-Demand rates unless other coverage applies",
        "AWS converts the plan to a Compute Savings Plan at the lower discount rate"
      ],
      answer: [3],
      multi: false,
      explanation: "<p><strong>D is correct.</strong> An EC2 Instance Savings Plan is pinned to one instance family in one region (m5/us-east-1). Savings Plans cannot be exchanged, modified to another family, or sold; the hourly commitment continues to bill for its full term whether or not matching usage exists, and the m7g usage falls to On-Demand (or other coverage). This is the classic stranded-commitment scenario — Compute Savings Plans or Convertible RIs are what preserve migration flexibility.</p><p><strong>A</strong> — family pinning is literal; m5 and m7g are different families. <strong>B</strong> — exchanges exist for Convertible RIs, not for any Savings Plan. <strong>C</strong> — only Standard RIs can be sold on the RI Marketplace; Savings Plans cannot. <strong>E</strong> — no such conversion mechanism exists.</p>"
    },
    {
      q: "A nightly batch pipeline of stateless containers can checkpoint work every 30 seconds and must minimize compute cost. The team also wants the fewest possible interruptions. Which Spot configuration best fits?",
      options: [
        "Single instance type in one AZ using the lowest-price allocation strategy",
        "Diversify across many instance types and AZs with the price-capacity-optimized allocation strategy",
        "Diversify across instance types in one AZ with lowest-price and a high Spot price cap",
        "Use On-Demand with a Compute Savings Plan instead, since Spot cannot be made reliable",
        "Single deep pool chosen manually from the Spot Instance Advisor, refreshed quarterly"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> Interruptions are per-pool events, so diversification across many type/AZ pools plus price-capacity-optimized (PCO) — which selects deep, low-interruption pools first and then optimizes price among them — is AWS's recommended default and directly serves both goals (lowest cost, fewest interruptions).</p><p><strong>A</strong> concentrates everything in one pool chosen for cheapness — cheap pools are often shallow and heavily contended, maximizing interruption risk. <strong>C</strong> still uses lowest-price (the churn-maximizing strategy), and raising the price cap does not reduce interruptions in the modern model — reclaims are capacity-driven, not outbid-driven. <strong>D</strong> is wasteful: a checkpointing stateless batch workload is the ideal Spot consumer; Savings Plans cap out around 66 percent vs Spot's up to 90. <strong>E</strong> is a static, single-pool bet that decays as pool depth shifts; allocation strategies exist to do this dynamically.</p>"
    },
    {
      q: "An application running on Spot must gracefully drain in-flight requests when AWS reclaims capacity. Which TWO mechanisms deliver the interruption signal? (Select TWO.)",
      options: [
        "An EventBridge event for the Spot instance interruption warning",
        "An SNS notification automatically published to the account's default topic",
        "The instance metadata path spot/instance-action returning the action and time",
        "A CloudWatch alarm on the SpotInterruption metric",
        "An SQS message delivered to a queue named by the fleet"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<p><strong>A and C are correct.</strong> The 2-minute interruption notice is delivered as an EventBridge event (EC2 Spot Instance Interruption Warning), which you can route to Lambda/SNS/SQS yourself, and via IMDS: <code>latest/meta-data/spot/instance-action</code> returns 404 until an interruption is scheduled, then returns the action and timestamp — on-instance agents poll it (roughly every 5 seconds) to trigger drains.</p><p><strong>B</strong> — no automatic SNS publication exists; you would wire that up from EventBridge yourself. <strong>D</strong> — there is no native SpotInterruption CloudWatch metric to alarm on for the notice. <strong>E</strong> — no automatic SQS delivery exists either; again, only as a target you configure on the EventBridge rule.</p>"
    },
    {
      q: "A security review found that a web application EC2 role's credentials were exfiltrated via a server-side request forgery bug that fetched an internal URL. Which change most directly prevents this class of attack?",
      options: [
        "Move the application into a private subnet with no internet gateway",
        "Require IMDSv2 by setting HttpTokens to required in the instance metadata options",
        "Rotate the IAM role's credentials every hour with a Lambda function",
        "Attach a security group rule blocking outbound traffic to 169.254.169.254",
        "Enable GuardDuty to detect credential exfiltration"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> IMDSv2 requires a session token obtained via a PUT with a custom header, rejects token requests with X-Forwarded-For, and defaults the response hop limit to 1 — engineered precisely so that typical SSRF gadgets (which can usually only GET a URL without custom headers) cannot retrieve credentials. Setting HttpTokens=required disables v1 entirely.</p><p><strong>A</strong> does not help: the SSRF request originates from the app to the link-local IMDS address — subnet routing and IGWs are irrelevant to link-local traffic (exfiltration of the response rides the existing app response channel). <strong>C</strong> — instance-role credentials already auto-rotate (roughly six-hour validity); rotation does not stop live theft-and-use. <strong>D</strong> — security groups do not filter traffic to the link-local metadata endpoint; it never traverses the VPC network path they govern. <strong>E</strong> — GuardDuty's InstanceCredentialExfiltration findings are valuable detection, but detection is not prevention; the question asks what prevents the attack.</p>"
    },
    {
      q: "A team launches instances from a launch template whose user data installs and configures their application. After patching, they reboot an instance and notice the user data script did not run again. What explains this?",
      options: [
        "User data was corrupted during the reboot and must be re-entered",
        "Shell-script user data runs only once, at first boot, by cloud-init design",
        "The instance lost IMDS access after reboot so the script could not be fetched",
        "User data only runs on instance-store-backed AMIs after reboots",
        "The 16 KB user data limit was exceeded, silently disabling re-execution"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> Cloud-init records first-boot completion (state under /var/lib/cloud) and, for shell-script user data, executes it once at first boot as root. Re-running on every boot requires an explicit cloud-init directive (a MIME multipart with a per-boot part) — the default behavior the team observed is by design, not a fault.</p><p><strong>A</strong> — user data is immutable instance configuration; reboots do not corrupt it. <strong>C</strong> — IMDS availability is unaffected by reboots, and even if it hiccuped, that is not the designed once-only semantics at play. <strong>D</strong> — backing type does not change user data semantics. <strong>E</strong> — exceeding 16 KB fails at launch/API time, not silently after reboots.</p>"
    },
    {
      q: "A Cassandra cluster on i4i instances stores data on local NVMe instance store, relying on replication factor 3 for durability. An engineer stops and starts one node to resolve a host degradation notice. What happens to that node's data?",
      options: [
        "The data persists because stop preserves attached storage",
        "The data is lost; the instance starts on a new host with empty instance store and must rebuild from replicas",
        "The data is automatically snapshotted to S3 before stop and restored on start",
        "Stop is not possible; instance store instances only support reboot and terminate",
        "The data persists only if the instance restarts on the same host within 24 hours"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> Instance store is host-local; stop releases the host, the disks are cryptographically erased, and start places the instance on a (new) host with blank NVMe. This is exactly why instance store is only appropriate when the application layer owns durability — the node rejoins and re-replicates from its peers, which is the designed recovery path here.</p><p><strong>A</strong> — that is EBS semantics, not instance store. <strong>C</strong> — no automatic snapshot mechanism exists for instance store; it cannot be snapshotted at all. <strong>D</strong> confuses instance-store-<em>backed AMIs</em> (root on instance store — those indeed cannot stop) with an EBS-backed instance that has instance store data volumes, which i4i instances are: they boot from EBS and can stop. <strong>E</strong> — there is no same-host restart guarantee or grace window; stop/start moves hosts.</p>"
    },
    {
      q: "A company must guarantee that 20 r6i.4xlarge instances can launch in us-east-1a during a disaster recovery failover, while minimizing ongoing cost. They already hold a Compute Savings Plan covering their steady-state usage. What should they add?",
      options: [
        "A zonal Standard Reserved Instance purchase for 20 r6i.4xlarge in us-east-1a",
        "On-Demand Capacity Reservations for 20 r6i.4xlarge in us-east-1a, discounted by the existing Savings Plan when consumed",
        "A regional Reserved Instance purchase for the r6i family",
        "An EC2 Fleet in maintain mode kept at zero capacity",
        "Nothing extra; the Compute Savings Plan already assures capacity"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> Capacity and discounts are decoupled instruments. ODCRs reserve zonal capacity with no term commitment, and while a reservation bills at the On-Demand rate whether used or not, Savings Plans and regional RIs apply their discount to the reservation's billing — layering ODCR capacity assurance on top of existing Savings Plan economics is the canonical pattern.</p><p><strong>A</strong> would also reserve capacity but locks a 1-3 year term and stacks a second discount instrument on usage the Savings Plan may already cover — worse flexibility and likely double-committed spend. <strong>C</strong> — regional RIs provide no capacity reservation whatsoever. <strong>D</strong> — a fleet at zero capacity holds nothing; capacity is only held by reservations or running instances. <strong>E</strong> — Savings Plans are purely billing constructs; they never guarantee capacity.</p>"
    },
    {
      q: "Which TWO statements about Dedicated Hosts versus Dedicated Instances are accurate? (Select TWO.)",
      options: [
        "Dedicated Hosts expose physical sockets and cores, enabling per-socket BYOL licensing for products like SQL Server and Oracle",
        "Dedicated Instances let you pin a workload to the same physical server across stop and start cycles",
        "Dedicated Hosts support host affinity so an instance returns to the same physical server after a stop",
        "Dedicated Instances provide visibility into the host ID and core count for license audits",
        "Dedicated Hosts and Dedicated Instances are billed identically, per instance-hour"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<p><strong>A and C are correct.</strong> The entire reason Dedicated Hosts exist is countable physical hardware: you see sockets, cores, and host IDs (satisfying per-socket/per-core BYOL terms), and host affinity pins an instance to that specific server across stop/start so licensed software stays on licensed silicon.</p><p><strong>B</strong> is false — Dedicated Instances offer no placement control; a stop/start can land on any dedicated hardware. <strong>D</strong> is false for the same reason Dedicated Hosts exist: Dedicated Instances expose no host-level visibility, which is precisely why they fail per-socket license audits. <strong>E</strong> is false — Dedicated Hosts bill per host (run as many allowed instances as fit), while Dedicated Instances bill per instance plus a regional dedicated-tenancy fee.</p>"
    },
    {
      q: "An architect wants to reduce EC2 spend for a Linux-based JVM microservices fleet with minimal engineering effort and no interruption risk. Current fleet runs on m5.2xlarge On-Demand. Which change delivers savings with the least risk?",
      options: [
        "Move the fleet to Spot instances with capacity-optimized allocation",
        "Migrate to m7g (Graviton) instances and purchase a Compute Savings Plan for the stable baseline",
        "Purchase zonal Standard RIs for m5.2xlarge in each AZ used",
        "Rearchitect the services onto Lambda",
        "Move to t3.2xlarge burstable instances in unlimited mode"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> A JVM workload is architecture-portable (rebuild/retag for arm64, bake, done), Graviton delivers materially better price-performance than m5, and a Compute Savings Plan discounts the stable baseline while staying flexible across families/regions — no interruption risk anywhere in that combination.</p><p><strong>A</strong> introduces exactly the interruption risk the question excludes. <strong>C</strong> saves money but pins 1-3 years to the old, more expensive family in specific AZs — it forecloses the Graviton upside and adds zonal rigidity for no stated capacity need. <strong>D</strong> is a rearchitecture — maximal engineering effort, explicitly excluded. <strong>E</strong> is a trap: sustained JVM services exhaust burst credits, and unlimited mode converts throttling into surprise spend that can exceed the m-family price.</p>"
    },
    {
      q: "A regulated workload processes payment card keys and must guarantee that neither AWS operators nor the instance's own root user can read the key material while in use. Which approach satisfies this?",
      options: [
        "Run the workload on a Dedicated Host with detailed monitoring enabled",
        "Process keys inside a Nitro Enclave whose attestation document is required by the KMS key policy",
        "Store keys in an encrypted EBS volume with a customer managed KMS key",
        "Run the instance in a private subnet with IMDSv2 required and SSH disabled",
        "Use an instance-store-backed instance so keys never persist"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> A Nitro Enclave is an isolated VM with no network, no persistent storage, and no interactive access — even root on the parent instance cannot inspect it — and KMS attestation-based key policies release the key only to the measured enclave image. That covers both threat actors named: the operator (Nitro's no-operator-access model) and the instance's own root.</p><p><strong>A</strong> — dedicated tenancy isolates you from other customers, not from your own root user, and monitoring reads no memory either way. <strong>C</strong> protects data at rest; in use, the key is plaintext in instance memory readable by root. <strong>D</strong> hardens the perimeter but root on the box still reads process memory. <strong>E</strong> — persistence is irrelevant; in-use memory access is the threat, and instance store does nothing about it.</p>"
    },
    {
      q: "After deregistering dozens of old AMIs, a cost report still shows significant EBS snapshot storage charges in the account. Why?",
      options: [
        "Deregistration takes 90 days to propagate to billing",
        "Deregistering an AMI does not delete its backing snapshots; they must be deleted separately",
        "The AMIs were shared with other accounts, so AWS retains the snapshots",
        "Snapshots referenced by launch templates cannot be deleted and keep billing",
        "The snapshots were automatically archived to S3 Glacier and billed there"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> An AMI is a registration record pointing at EBS snapshots; deregistering removes only the record. The snapshots persist — and bill — until explicitly deleted, which is why orphaned AMI snapshots are a classic silent cost item. The cleanup workflow is: deregister, then delete the associated snapshots (after confirming nothing else references them).</p><p><strong>A</strong> — deregistration is effectively immediate; there is no 90-day billing propagation. <strong>C</strong> — sharing grants launch permissions; it does not transfer or pin snapshot ownership, and AWS does not retain them on your behalf for consumers. <strong>D</strong> — launch template references do not protect snapshots from deletion (the template would simply break). <strong>E</strong> — snapshot archiving to a lower-cost tier is an explicit opt-in action, not automatic.</p>"
    },
    {
      q: "A company needs to share an encrypted golden AMI from a central account to production accounts in the same region. Which THREE actions are required? (Select THREE.)",
      options: [
        "Encrypt the AMI's snapshots with a customer managed KMS key rather than the default aws/ebs key",
        "Add launch permissions on the AMI for the target accounts or organization",
        "Grant the target accounts access to the KMS key via its key policy or grants",
        "Make the AMI public so all accounts can see it",
        "Copy the AMI to each target account's region using copy-image",
        "Convert the AMI to an instance-store-backed image first"
      ],
      answer: [0, 1, 2],
      multi: true,
      explanation: "<p><strong>A, B, and C are correct — and jointly sufficient.</strong> AMIs (and snapshots) encrypted with the AWS managed default key cannot be shared, so the image must use a customer managed key (<strong>A</strong>); the AMI needs launch permissions for the consumer accounts or org (<strong>B</strong>), with the backing snapshots shared alongside; and the consumers need kms:DescribeKey/Decrypt/CreateGrant-style access to that CMK via key policy or grants (<strong>C</strong>) or their launches fail at volume decryption.</p><p><strong>D</strong> — encrypted AMIs cannot be made public at all, and public sharing would be a governance failure anyway. <strong>E</strong> — the scenario is same-region; cross-region copy is unnecessary (it is the answer to a different question). <strong>F</strong> — instance-store-backed conversion is legacy machinery and unrelated to encrypted sharing.</p>"
    },
    {
      q: "An EKS platform team requires IMDSv2 and sets the default hop limit of 1 on all nodes. Pods using the bridge network mode can no longer retrieve node instance metadata that a legacy DaemonSet legitimately needs. What is the correct adjustment?",
      options: [
        "Re-enable IMDSv1 on the nodes for backward compatibility",
        "Set HttpPutResponseHopLimit to 2 on the node launch template",
        "Add a security group rule permitting pod traffic to 169.254.169.254",
        "Give every pod its own IAM role via IMDS",
        "Disable the metadata endpoint and hardcode instance IDs in the DaemonSet"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> With hop limit 1, the IMDSv2 token response's IP TTL expires crossing the container bridge (the pod is one routing hop from the node namespace), so bridged pods cannot complete the token handshake. Raising HttpPutResponseHopLimit to 2 in the launch template's metadata options keeps v2 required while letting the token survive exactly one extra hop.</p><p><strong>A</strong> reopens the SSRF credential-theft hole the v2 mandate was closing — the worst available trade. <strong>C</strong> — security groups do not mediate link-local metadata traffic; this rule would change nothing. <strong>D</strong> — per-pod identity is IRSA/Pod Identity, which is the right long-term direction but does not deliver node <em>instance metadata</em> to the DaemonSet, which is what is needed here. <strong>E</strong> breaks the legitimate consumers entirely and replaces dynamic metadata with config drift.</p>"
    }
  ],
  flashcards: [
    { front: "Decode the instance type name c7g.2xlarge", back: "c = compute-optimized family, 7 = generation, g = Graviton (Arm) suffix, 2xlarge = size (8 vCPU; sizes scale linearly, large = 2 vCPU). Other suffixes: a = AMD, i = Intel, d = local NVMe, n = enhanced networking." },
    { front: "Which instance families map to: general, compute, memory, storage, accelerated?", back: "m = general (1:4 vCPU:GiB), c = compute (1:2), r/x/u = memory (1:8 and up, to 24 TiB), i/d = storage (local NVMe), p/g/inf/trn/f = accelerated. t = burstable credit-based." },
    { front: "When does Graviton NOT make sense?", back: "x86-only binaries/agents, native deps without arm64 builds, AVX-512-tuned code, and Windows. Otherwise (Linux, JVM/Go/Rust/Python/containers) it is typically ~20% cheaper with better per-vCPU performance — and each vCPU is a full core, not an SMT thread." },
    { front: "What does the Nitro system offload, and what remains on the host CPU?", back: "Nitro cards handle VPC networking (ENA), EBS (as NVMe), instance storage, and monitoring; a security chip provides hardware root of trust. Only a thin KVM-based hypervisor for CPU/RAM partitioning stays on the host — absent entirely on .metal." },
    { front: "State the Nitro operator-access security claim", back: "No SSH to hosts, no interactive operator access, no API capable of reading guest memory/storage — administrative ops go through a narrow, logged, authenticated API. Isolation is an architectural property, not a policy. Security groups are enforced on the card, outside the guest." },
    { front: "What is a Nitro Enclave and its killer feature?", back: "An isolated VM carved from a parent instance: no network, no persistent storage, no interactive access, vsock-only channel to the parent. Killer feature: cryptographic attestation — KMS key policies can release keys only to a measured enclave image (PCRs)." },
    { front: "Standard RI vs Convertible RI in one line each", back: "<strong>Standard:</strong> deepest discount (~72%), family fixed, sellable on RI Marketplace. <strong>Convertible:</strong> lower discount (~66%), exchangeable across family/OS/tenancy for equal-or-greater value, not sellable." },
    { front: "Regional RI vs zonal RI: what does each guarantee?", back: "Regional: billing discount in any AZ + size flexibility within family (Linux/shared tenancy, via normalization units) — <strong>no capacity</strong>. Zonal: discount pinned to one AZ + <strong>capacity reservation</strong> there, no size flex." },
    { front: "Compute Savings Plan vs EC2 Instance Savings Plan", back: "Compute SP: any EC2 family/size/region/OS/tenancy + Fargate + Lambda, ~66% max discount. EC2 Instance SP: one family in one region (any size/OS), ~72% max. Neither reserves capacity, covers Spot, or can be exchanged/sold." },
    { front: "How does an On-Demand Capacity Reservation interact with Savings Plans?", back: "ODCR = zonal capacity guarantee, no term, no discount — bills at On-Demand rate even when empty. Savings Plans / regional RIs apply their discount to instances consuming it. Layer them: ODCR for capacity, SP/RI for price. Capacity Blocks = the GPU-cluster variant for future time windows." },
    { front: "How is a Spot interruption signaled, and how much notice do you get?", back: "120 seconds, via (1) EventBridge event 'EC2 Spot Instance Interruption Warning' and (2) IMDS path <code>spot/instance-action</code> (404 until scheduled; poll ~5s). The earlier rebalance recommendation signal has no guaranteed lead time." },
    { front: "Which Spot allocation strategy is the recommended default, and why not lowest-price?", back: "price-capacity-optimized (PCO): picks deep, low-interruption pools first, then price among them. lowest-price concentrates the fleet in shallow, contended pools and maximizes interruption churn; diversification across many type/AZ pools is the other half of the answer." },
    { front: "Cluster vs spread vs partition placement groups: limits and canonical workloads", back: "Cluster: single AZ, lowest latency — HPC/MPI/ML (capacity risk; launch all at once). Spread: distinct hardware, max 7 running instances per AZ per group — quorum nodes. Partition: up to 7 partitions per AZ, rack-aware — Kafka/HDFS/Cassandra." },
    { front: "EFA vs ENA: when do you need EFA, and its key constraints?", back: "ENA = SR-IOV enhanced networking, default on Nitro, up to 100 Gbps. EFA adds OS-bypass (libfabric, SRD transport) for MPI/NCCL collectives — single-digit-microsecond latency. Constraints: OS-bypass traffic stays within one subnet/AZ, needs self-referencing all-traffic SG, pairs with cluster placement groups." },
    { front: "What happens to instance store data on reboot vs stop vs terminate?", back: "Reboot: survives (same host). Stop or hibernate: lost — host is released and disks cryptographically erased; start lands on a new host with blank disks. Terminate: lost. No snapshots possible. Use only for scratch, caches, or app-replicated stores." },
    { front: "EBS-backed vs instance-store-backed AMI: the operational difference", back: "EBS-backed: root from a snapshot; supports stop, hibernate, instance-type resize; fast lazy-loading boot. Instance-store-backed: root copied from S3; cannot stop (only reboot/terminate), cannot resize; legacy corner but still examined." },
    { front: "Steps to share an encrypted AMI with another AWS account", back: "1) Encrypt with a customer managed KMS key (default aws/ebs key cannot be shared). 2) Add AMI launch permissions + share backing snapshots with the account/org. 3) Grant the account use of the CMK via key policy/grants. Cross-region use additionally requires copy-image (new AMI ID)." },
    { front: "Does deregistering an AMI delete its snapshots?", back: "No. Deregistration removes only the AMI record; the backing EBS snapshots keep billing until deleted separately. Orphaned AMI snapshots are a classic silent cost leak — clean both." },
    { front: "User data execution semantics (default)", back: "Runs once, at first boot, as root, via cloud-init; max 16 KB; not re-run on reboot unless configured per-boot. Readable via API and via IMDS from the instance — never put secrets in it; fetch secrets from Secrets Manager/SSM using the instance role. Logs: /var/log/cloud-init-output.log." },
    { front: "Why is IMDSv1 an SSRF risk and how does IMDSv2 fix it?", back: "v1: a single GET to 169.254.169.254 returns role credentials — any SSRF gadget can fetch them (Capital-One-pattern breaches). v2: session token via PUT + custom header (SSRF gadgets rarely can), rejects X-Forwarded-For, response hop limit defaults to 1 so tokens die at the first hop. Enforce with HttpTokens=required." },
    { front: "IMDSv2 with containers: what breaks and what is the fix?", back: "Hop limit 1 means the token response's TTL expires crossing the container bridge — bridged pods cannot complete the handshake. Fix: HttpPutResponseHopLimit=2, or better, block pod access to IMDS and use IRSA/Pod Identity so pods never hold the node role." },
    { front: "Stop vs hibernate vs terminate: billing and state", back: "Stop: no instance charge; EBS + EIP bill; RAM lost; new host on start; auto-assigned public IPv4 changes. Hibernate: same, plus RAM image persisted to the encrypted EBS root (prereqs: encrypted root sized for RAM, enabled at launch, supported type/OS; max 60 days). Terminate: root deleted if DeleteOnTermination=true (default); data volumes default to kept." },
    { front: "Does termination protection stop an Auto Scaling group from terminating an instance?", back: "No. DisableApiTermination blocks API terminate calls only. ASG scale-in and OS-initiated shutdown (with terminate behavior) proceed regardless — use ASG instance protection (protect-from-scale-in) for that case." },
    { front: "Dedicated Host vs Dedicated Instance: which supports per-socket BYOL and why?", back: "Dedicated Host — you get a whole physical server with visible sockets/cores/host ID plus host affinity across stop/start, satisfying per-socket/per-core licenses (Windows Server, SQL Server, Oracle); billed per host. Dedicated Instances only guarantee your account's instances share the hardware — no visibility, no affinity, no license countability; billed per instance + regional fee." },
    { front: "One 4xlarge or four xlarges — what actually differs?", back: "Same vCPU/RAM/cost (linear sizing). Many-small: smaller blast radius, finer bin-packing and scaling granularity. One-big: no network hops between co-located components, fewer per-instance agents/ENIs, higher per-instance EBS/network bandwidth caps. Also: small sizes often have burst ('up to') network bandwidth, not sustained." }
  ],
  lab: {
    title: "Lab: Spot economics, IMDSv2 hardening, and interruption plumbing from the CLI",
    html: `
<h3>Goal</h3>
<p>Launch a hardened, IMDSv2-only Graviton instance from a launch template, prove the v1/v2 behavior difference from inside the instance, compare Spot vs On-Demand pricing for the same capacity pool, and wire up the interruption-notice plumbing you would use in production. Everything runs on a t4g.small footprint: cost is pennies per hour, and a full Teardown at the end returns the account to zero recurring charges.</p>

<h3>Architecture</h3>
<p>One launch template (IMDSv2 required, hop limit 2, minimal user data) used to launch a single Spot instance into your default VPC with SSM Session Manager access (no SSH keys, no inbound security-group holes). An EventBridge rule matches Spot interruption warnings for observability. This mirrors the minimal production shape: template-driven launches, metadata hardening at the template layer, session-based access, event-driven interruption handling.</p>

<div class="callout limits">Cost note: a t4g.small Spot instance is roughly a cent per hour; the EBS root a few cents per month while it exists. Nothing here has a fixed monthly fee, but an instance or volume left running bills until the Teardown section is completed. The EventBridge rule and log group are free-tier scale.</div>

<h3>Steps</h3>
<ol>
<li><p><strong>Pick region and find the latest Arm Amazon Linux 2023 AMI</strong> via the public SSM parameter (never hardcode AMI IDs):</p>
<pre><code>export AWS_DEFAULT_REGION=us-east-1
AMI=$(aws ssm get-parameter \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
  --query Parameter.Value --output text)
echo "$AMI"</code></pre></li>

<li><p><strong>Create an instance role for SSM access</strong> (lets you open shells without SSH):</p>
<pre><code>aws iam create-role --role-name ec2-lab-ssm \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name ec2-lab-ssm \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam create-instance-profile --instance-profile-name ec2-lab-ssm
aws iam add-role-to-instance-profile \
  --instance-profile-name ec2-lab-ssm --role-name ec2-lab-ssm</code></pre></li>

<li><p><strong>Compare Spot and On-Demand price for the pool</strong> before launching. Current Spot price per AZ:</p>
<pre><code>aws ec2 describe-spot-price-history --instance-types t4g.small \
  --product-descriptions "Linux/UNIX" \
  --start-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
  --query 'SpotPriceHistory[].[AvailabilityZone,SpotPrice]' --output table</code></pre>
<p>Note how little the price varies across time (the post-2017 model) and how it differs per AZ — each AZ/type pair is a separate capacity pool. Compare with the On-Demand price (about 1.7 cents/hr for t4g.small in us-east-1) to see the discount.</p></li>

<li><p><strong>Create the launch template</strong> with IMDSv2 required, hop limit 2, the SSM role, and user data that stamps first-boot proof. Build the user-data payload first, then reference it:</p>
<pre><code>printf '#!/bin/bash\ndate &gt; /var/tmp/first-boot-stamp\n' &gt; /tmp/ud.sh
UD=$(base64 -w0 /tmp/ud.sh)
cat &gt; /tmp/lt.json &lt;&lt;EOF
{
  "ImageId": "$AMI",
  "InstanceType": "t4g.small",
  "IamInstanceProfile": {"Name": "ec2-lab-ssm"},
  "MetadataOptions": {"HttpTokens": "required", "HttpPutResponseHopLimit": 2},
  "UserData": "$UD",
  "TagSpecifications": [{"ResourceType": "instance",
    "Tags": [{"Key": "Name", "Value": "ec2-lab"}]}]
}
EOF
aws ec2 create-launch-template --launch-template-name ec2-lab \
  --launch-template-data file:///tmp/lt.json</code></pre></li>

<li><p><strong>Launch a Spot instance from the template.</strong> The market options ask for Spot with terminate-on-interruption — the production-correct default:</p>
<pre><code>IID=$(aws ec2 run-instances \
  --launch-template LaunchTemplateName=ec2-lab \
  --instance-market-options '{"MarketType":"spot","SpotOptions":{"SpotInstanceType":"one-time","InstanceInterruptionBehavior":"terminate"}}' \
  --query 'Instances[0].InstanceId' --output text)
aws ec2 wait instance-running --instance-ids "$IID"
aws ec2 describe-instances --instance-ids "$IID" \
  --query 'Reservations[0].Instances[0].[InstanceLifecycle,Placement.AvailabilityZone,MetadataOptions.HttpTokens]' \
  --output table</code></pre>
<p>InstanceLifecycle should read <code>spot</code> and HttpTokens <code>required</code>.</p></li>

<li><p><strong>Create the interruption-notice EventBridge rule</strong> (the observability half of production interruption handling):</p>
<pre><code>ACCT=$(aws sts get-caller-identity --query Account --output text)
aws events put-rule --name ec2-lab-spot-interruption \
  --event-pattern '{"source":["aws.ec2"],"detail-type":["EC2 Spot Instance Interruption Warning"]}'
aws logs create-log-group --log-group-name /ec2-lab/spot-interruptions
aws events put-targets --rule ec2-lab-spot-interruption \
  --targets "Id"="lab-logs","Arn"="arn:aws:logs:us-east-1:$ACCT:log-group:/ec2-lab/spot-interruptions"</code></pre>
<p>You cannot force AWS to interrupt you, so in this lab the rule will likely stay quiet — the point is to see exactly what a production wiring looks like.</p></li>

<li><p><strong>Open a shell via SSM and prove the IMDSv2 behavior</strong> (wait a minute for SSM registration):</p>
<pre><code>aws ssm start-session --target "$IID"</code></pre>
<p>Inside the session, first try the v1 pattern, then the v2 dance, then poll the Spot interruption path:</p>
<pre><code># v1-style GET: rejected (401) because HttpTokens=required
curl -s -o /dev/null -w "%{http_code}\n" http://169.254.169.254/latest/meta-data/

# v2: PUT for a session token, then GET with the token header
TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-life-cycle; echo

# interruption endpoint: 404 means "no interruption scheduled" — this IS the healthy state
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/spot/instance-action

# user data ran once at first boot, as root:
cat /var/tmp/first-boot-stamp
exit</code></pre></li>
</ol>

<h3>Verify</h3>
<ul>
<li>The tokenless IMDS request returned <strong>401</strong>; the tokened request returned <code>spot</code> for instance-life-cycle.</li>
<li><code>spot/instance-action</code> returned <strong>404</strong> — the correct steady-state your interruption handler polls against.</li>
<li><code>/var/tmp/first-boot-stamp</code> exists with the boot timestamp; reboot the instance (<code>sudo reboot</code> in a session) and confirm the stamp does <em>not</em> change — user data ran only at first boot.</li>
<li><code>aws ec2 describe-spot-price-history</code> output showed per-AZ prices well below the On-Demand rate.</li>
</ul>

<h3>Teardown</h3>
<p>Ordered so nothing survives to bill you. Run all of it — the instance and its volume are the only things with meaningful cost, but leaving IAM/template litter is how accounts rot.</p>
<ol>
<li><p>Terminate the instance (root volume auto-deletes via DeleteOnTermination):</p>
<pre><code>aws ec2 terminate-instances --instance-ids "$IID"
aws ec2 wait instance-terminated --instance-ids "$IID"</code></pre></li>
<li><p>Delete the EventBridge rule and log group:</p>
<pre><code>aws events remove-targets --rule ec2-lab-spot-interruption --ids lab-logs
aws events delete-rule --name ec2-lab-spot-interruption
aws logs delete-log-group --log-group-name /ec2-lab/spot-interruptions</code></pre></li>
<li><p>Delete the launch template:</p>
<pre><code>aws ec2 delete-launch-template --launch-template-name ec2-lab</code></pre></li>
<li><p>Dismantle the IAM plumbing (profile detach before role delete):</p>
<pre><code>aws iam remove-role-from-instance-profile \
  --instance-profile-name ec2-lab-ssm --role-name ec2-lab-ssm
aws iam delete-instance-profile --instance-profile-name ec2-lab-ssm
aws iam detach-role-policy --role-name ec2-lab-ssm \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam delete-role --role-name ec2-lab-ssm</code></pre></li>
<li><p>Confirm nothing is left running or attached:</p>
<pre><code>aws ec2 describe-instances \
  --filters Name=tag:Name,Values=ec2-lab Name=instance-state-name,Values=running,stopped \
  --query 'Reservations[].Instances[].InstanceId' --output text
aws ec2 describe-volumes --filters Name=status,Values=available \
  --query 'Volumes[].VolumeId' --output text</code></pre>
<p>Both commands should print nothing. If a volume ID appears, delete it with <code>aws ec2 delete-volume --volume-id ...</code> — an available volume bills monthly forever.</p></li>
</ol>
`
  }
});
