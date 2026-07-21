window.COURSE.register({
  id: "ec2",
  order: 4,
  track: "saa",
  title: "EC2 & Compute Fundamentals",
  description: "The compute layer everything else sits on: instance taxonomy, the Nitro system, purchase-option economics, placement, AMIs, IMDS, and the lifecycle semantics that decide whether your data survives. Senior-level treatment — mental models, internals, and the failure modes the exam loves.",
  examWeight: "Heavily weighted on SAA-C03 across all four domains. Purchase options (Spot/RI/Savings Plans), placement groups, IMDSv2, and dedicated hosts vs instances are near-guaranteed question sources.",
  lessons: [
    {
      id: "instance-anatomy",
      title: "Decoding instance types: families, generations, and Graviton",
      html: `
<p>An EC2 instance type name is a compact spec sheet. Take <code>c7g.2xlarge</code>: <strong>c</strong> is the family (compute-optimized), <strong>7</strong> is the generation, <strong>g</strong> is an attribute suffix (Graviton, AWS's Arm CPU), and <strong>2xlarge</strong> is the size. Sizes scale linearly within a family: an <code>xlarge</code> is 4 vCPU / some baseline RAM ratio, a <code>2xlarge</code> doubles both, a <code>4xlarge</code> doubles again, up to <code>metal</code> which hands you the whole host with no hypervisor. Because the scaling is linear, price per vCPU-hour is flat across sizes within a family — you pick size for per-node headroom (heap size, connection counts, NUMA locality), not for unit economics.</p>

<h3>The family letters that matter</h3>
<table>
<thead><tr><th>Family</th><th>Profile</th><th>vCPU:RAM ratio</th><th>Canonical workloads</th></tr></thead>
<tbody>
<tr><td><strong>M</strong> (general)</td><td>Balanced</td><td>1:4</td><td>App servers, small DBs, the default answer</td></tr>
<tr><td><strong>C</strong> (compute)</td><td>High clock/core density</td><td>1:2</td><td>Batch, encoding, HPC, game servers, high-RPS API tiers</td></tr>
<tr><td><strong>R</strong> (memory)</td><td>RAM-heavy</td><td>1:8</td><td>Redis/Memcached, in-memory analytics, big JVM heaps</td></tr>
<tr><td><strong>X / High Memory</strong></td><td>Extreme RAM</td><td>1:16 to 1:32+</td><td>SAP HANA, in-memory DBs measured in TB</td></tr>
<tr><td><strong>I / D</strong> (storage)</td><td>Local NVMe / dense HDD</td><td>varies</td><td>NoSQL (Cassandra, Scylla), Kafka, distributed FS, search</td></tr>
<tr><td><strong>P / G / Trn / Inf</strong> (accelerated)</td><td>GPU / ML ASICs</td><td>varies</td><td>Training (P/Trn), inference (G/Inf), graphics (G)</td></tr>
<tr><td><strong>T</strong> (burstable)</td><td>Baseline + CPU credits</td><td>1:4</td><td>Dev boxes, low-duty-cycle services, bastions</td></tr>
</tbody>
</table>

<h3>Attribute suffixes</h3>
<p>Suffix letters after the generation digit change the silicon or the I/O envelope:</p>
<ul>
<li><strong>g</strong> — Graviton (Arm64). <strong>a</strong> — AMD EPYC. <strong>i</strong> — Intel. No letter on older gens usually means Intel.</li>
<li><strong>d</strong> — local NVMe instance store attached (e.g. <code>m6id</code>).</li>
<li><strong>n</strong> — enhanced networking envelope, up to 100&nbsp;Gbps+ (e.g. <code>c6in</code>).</li>
<li><strong>e</strong> — extra memory or storage; <strong>z</strong> — high frequency; <strong>flex</strong> — variable-performance M/C variants at a discount.</li>
</ul>

<div class="callout deep">T-family burstable instances are a token bucket on CPU. Each instance earns credits at a baseline rate (e.g. a t3.micro baselines at 10 percent of one core) and spends them to burst to 100 percent. In the default <em>unlimited</em> mode (t3 and later), exhausting the bucket does not throttle you — it silently bills you surplus credits at roughly the M-family effective rate. In <em>standard</em> mode you get hard-throttled to baseline instead. A t3 pegged at 100 percent CPU in unlimited mode can quietly cost more than an m6i doing the same work; that is a real bill-shock pattern, not a hypothetical.</div>

<h3>Graviton: when Arm wins</h3>
<p>Graviton (g suffix) is AWS's own Arm CPU line. The economics are simple: roughly 10-20 percent lower price per instance and typically better price-performance (AWS claims up to 40 percent on some workloads) versus the same-generation x86 instance, because AWS keeps the silicon margin and the cores are physical — <strong>on Graviton, 1 vCPU = 1 physical core</strong>, no SMT/hyperthreading. For throughput-bound, well-threaded workloads (web tiers, JVM/Go/Rust/Python services, Redis, nginx) this often beats x86 on both latency variance and cost. The migration cost is the container/AMI rebuild for arm64 and any native dependencies; interpreted and JIT-compiled stacks usually just work. It is the default answer for "reduce compute cost without changing architecture" when the stack is portable.</p>

<div class="callout exam">Keyword mappings: "best price-performance, open-source stack, willing to recompile" → Graviton. "SAP HANA / in-memory database with terabytes of RAM" → X or High Memory family. "NoSQL database needing very high local IOPS" → I-family (storage optimized, NVMe instance store). "ML training" → P or Trn; "cost-effective inference" → Inf or G. "Unpredictable spiky low-average CPU" → T family. If the question just says "web application," M-family is the safe default.</div>

<div class="callout limits">Numbers worth caching: sizes scale 2x per step (xlarge = 4 vCPU in most families); vCPU on x86 = one hyperthread, on Graviton = one physical core; default per-region On-Demand vCPU quotas (a few hundred to ~1,152 vCPUs for standard families) are soft limits — new accounts hit them during load tests and incident scale-outs, so request increases before you need them.</div>

<div class="callout war">Do not benchmark families by vCPU count alone. An 8-vCPU c7i has 4 physical cores with SMT; an 8-vCPU c7g has 8 physical cores. Latency-sensitive services that pin threads or saturate cores can see wildly different tail latency at "identical" vCPU counts. Also watch EBS and network baselines: smaller sizes have <em>burst</em> network/EBS envelopes (e.g. "up to 12.5 Gbps") backed by token buckets — sustained transfer at the burst rate for tens of minutes gets you throttled to a much lower baseline, which surfaces as mysterious slow EBS exactly during your nightly batch window.</div>

<p><strong>When not to care:</strong> if the workload is containerized behind an orchestrator with mixed-instance policies, stop hand-picking types. Define CPU/RAM requirements and let the ASG or Karpenter choose from a diversified list — that is also the setup Spot needs (next lessons).</p>
`
    },
    {
      id: "nitro",
      title: "The Nitro system: why EC2 stopped being a normal hypervisor",
      html: `
<p>Pre-2017 EC2 ran Xen with a fat dom0: networking, storage emulation, and management all consumed host CPU and added jitter. The <strong>Nitro system</strong> inverted that design. Everything that is not your VM's CPU and RAM moved off the main board onto dedicated <strong>Nitro cards</strong> — PCIe boards with their own SoCs handling VPC networking (ENA), EBS (exposed as NVMe), instance store, and monitoring. What remains on the host is the <strong>Nitro hypervisor</strong>: a deliberately minimal KVM-derived layer that does little more than partition CPU and memory. There is no dom0, no general-purpose management OS on the host.</p>

<h3>Why you should care as an architect</h3>
<ul>
<li><strong>Near-bare-metal performance.</strong> Virtualization overhead is low single-digit percent because I/O never transits the hypervisor; the guest talks to hardware queues on the Nitro cards via SR-IOV. This is why AWS can sell <code>.metal</code> instances at all: the same Nitro cards enforce VPC and EBS semantics in hardware, so a bare-metal customer with no hypervisor underneath still cannot escape the network/storage control plane.</li>
<li><strong>Consistent tail latency.</strong> No noisy dom0 stealing cycles means p99 jitter dropped substantially versus Xen-era instances — relevant when you are chasing single-digit-millisecond SLOs.</li>
<li><strong>Bigger instances.</strong> Offloading I/O freed nearly all host resources for guests, enabling 128-vCPU-plus and multi-TB-RAM shapes.</li>
</ul>

<div class="callout deep">EBS volumes on Nitro instances appear as NVMe devices (<code>/dev/nvme1n1</code>, not <code>/dev/xvdf</code>). The device name you set in the API or console is metadata only; inside the guest, NVMe enumeration order is not stable across stops/starts. Mount by filesystem UUID or by the NVMe vendor metadata (the EBS volume ID is embedded and visible via <code>ebsnvme-id</code> or <code>nvme id-ctrl</code>), never by <code>/dev/nvme*</code> path. Fstab entries written against raw NVMe paths are a classic "instance came back with the wrong volume mounted" incident.</div>

<h3>The security model</h3>
<p>Nitro is also a security architecture, and this is what the exam and real audits care about:</p>
<ul>
<li><strong>No operator access.</strong> There is no SSH daemon, no interactive shell on production Nitro hosts. The management plane is a narrow, audited API; AWS operators cannot log into the host your instance runs on and inspect its memory. AWS publishes this as a design guarantee.</li>
<li><strong>Minimal TCB.</strong> The attack surface is the thin hypervisor plus firmware that is hardware-attested at boot (Nitro Security Chip verifies firmware, the host cannot boot modified images).</li>
<li><strong>No inter-instance trust paths.</strong> All host-to-host traffic on supported types is transparently encrypted on the Nitro cards; you get memory and I/O isolation enforced below the level any guest can reach.</li>
</ul>

<p><strong>Nitro Enclaves</strong> extend this to intra-instance isolation: you carve vCPUs and RAM off a parent instance into an enclave with <em>no</em> network, <em>no</em> persistent storage, and no interactive access — only a local vsock channel to the parent. The enclave produces a signed <strong>attestation document</strong> (hash of the enclave image), and KMS key policies can require that attestation, so a decryption key is only ever released into the enclave, never to the parent OS. That is the pattern for processing card numbers or private keys on a host whose root you do not fully trust.</p>

<div class="callout exam">Trap pattern: "process highly sensitive data so that even root on the instance cannot read it" → Nitro Enclaves with KMS attestation-bound key policy. Distractors will offer KMS envelope encryption alone (root can read the plaintext in memory), dedicated hosts (isolation from other tenants, not from your own OS), or SSM Session Manager restrictions (does not stop root). Also remember: enhanced networking (ENA/SR-IOV) exists <em>because</em> of Nitro cards — questions about "lowest network latency, highest PPS" assume current-gen Nitro instances.</div>

<div class="callout war">Nitro's NVMe-attached EBS changed timeout behavior: the guest NVMe driver has its own I/O timeout (historically 255 seconds on Linux, tunable via <code>nvme_core.io_timeout</code>). During an EBS degradation, applications that expected fast I/O errors instead see multi-minute hangs in uninterruptible sleep (D state), which then trips load-balancer health checks in confusing ways — the box looks alive but every request touching disk stalls. Set application-level timeouts; do not rely on the block layer to fail fast.</div>

<div class="callout limits">Worth memorizing: virtually all current-gen instance families (5-series onward, anything with a g/i/a/d/n suffix in gen 5+) are Nitro. Xen-era types (t2, m4, c4, r4 and earlier) lack ENA-by-default, NVMe EBS, and some IMDS/hibernate features. If an exam scenario requires 100 Gbps networking, EFA, io2 Block Express, or Enclaves — those are Nitro-only capabilities.</div>

<p><strong>Architectural consequence:</strong> because isolation and I/O policy are enforced in hardware below the hypervisor, the old instinct that "shared tenancy is the risky option" is mostly obsolete. You choose dedicated tenancy today for licensing and compliance checkboxes (covered later), not because Nitro multi-tenancy is a meaningful side-channel risk in practice — AWS's own security posture treats the Nitro boundary as equivalent to physical separation.</p>
`
    },
    {
      id: "purchase-options",
      title: "Purchase options: the economics of On-Demand, RIs, Savings Plans, and Spot",
      html: `
<p>Every EC2 pricing construct is a trade of <strong>commitment</strong> or <strong>interruption tolerance</strong> for discount. Model it as a portfolio: baseline load goes on commitments, variable load on On-Demand, and interruption-tolerant load on Spot. The exam tests whether you can map workload shape to instrument.</p>

<h3>The commitment instruments</h3>
<table>
<thead><tr><th>Instrument</th><th>Discount vs OD</th><th>What you commit to</th><th>Flexibility</th></tr></thead>
<tbody>
<tr><td>On-Demand</td><td>0%</td><td>Nothing</td><td>Total</td></tr>
<tr><td>Standard RI</td><td>up to ~72%</td><td>Instance family+region (or AZ), 1/3 yr</td><td>Size-flex within family (regional, Linux, shared tenancy); can sell on RI Marketplace</td></tr>
<tr><td>Convertible RI</td><td>up to ~66%</td><td>Spend, 1/3 yr</td><td>Exchange across family/OS/tenancy (equal or greater value); cannot sell</td></tr>
<tr><td>EC2 Instance Savings Plan</td><td>up to ~72%</td><td>$/hr in one family+region, 1/3 yr</td><td>Any size/OS/tenancy within that family+region</td></tr>
<tr><td>Compute Savings Plan</td><td>up to ~66%</td><td>$/hr of compute, 1/3 yr</td><td>Any family, region, OS — also covers Fargate and Lambda</td></tr>
<tr><td>Spot</td><td>up to ~90%</td><td>Nothing — AWS can reclaim with 2 min notice</td><td>Total, minus reliability</td></tr>
</tbody>
</table>

<p>Payment options (all-upfront, partial, none) shift the discount a few points — all-upfront is cheapest. A <strong>zonal</strong> RI additionally functions as a capacity reservation in that AZ; a <strong>regional</strong> RI gives size flexibility but reserves no capacity. Note the modern guidance: Savings Plans dominate RIs for pure billing purposes (same discount, applied automatically to whatever you run), so RIs mostly survive for the Marketplace resale option and the zonal capacity-reservation behavior. Compute Savings Plans are the only instrument that follows a workload migrating to Fargate or Lambda — a common exam discriminator.</p>

<div class="callout exam">Mappings: "steady-state for 1-3 years, cheapest, no change expected" → Standard RI or EC2 Instance SP. "Committed spend but may change instance family or move to Fargate" → Compute Savings Plan. "May need to change family/OS during term and RIs are mandated" → Convertible RI. "Fault-tolerant / batch / can be interrupted" → Spot. "Steady database + spiky front end" → RI/SP for the DB and baseline, On-Demand or Spot for the spike. Watch for the word <em>interruption</em>: any workload described as stateful, licensed, or time-critical disqualifies Spot.</div>

<h3>Spot mechanics — where the exam gets technical</h3>
<p>Spot sells spare capacity from pools (an AZ + instance-type pair). Prices float smoothly with long-run supply/demand (the old bidding war is gone; you pay the current Spot price up to an optional max). Reclamation is about <em>capacity</em>, not price spikes: when AWS needs the pool back, your instance gets a <strong>2-minute interruption notice</strong>, delivered via the IMDS path <code>spot/instance-action</code> and as an EventBridge event. Before that you may get a <strong>rebalance recommendation</strong> — an earlier, no-guarantee signal that the pool is at elevated risk, which ASG Capacity Rebalancing uses to launch a replacement proactively.</p>

<p>Your interruption playbook: poll IMDS or subscribe EventBridge; on notice, drain the node (deregister from target group, finish/checkpoint work, hand off partitions), because 120 seconds is enough for connection draining but not for long jobs — hence checkpointing to S3 is the standard pattern for batch. You can also configure interruption behavior as stop or hibernate instead of terminate for persistent Spot requests.</p>

<h3>Fleets and allocation strategies</h3>
<p><strong>Spot Fleet / EC2 Fleet</strong> (and ASG mixed-instance policies, which are the modern front door) launch across many pools to hit a target capacity. The allocation strategy is the decision that matters:</p>
<ul>
<li><strong>lowest-price</strong> — chases the cheapest pools. Maximizes churn: cheap pools are cheap because they are about to be reclaimed. Almost never the right answer anymore.</li>
<li><strong>capacity-optimized</strong> — picks pools with the deepest spare capacity, minimizing interruption probability. Right when interruptions are expensive (long-running batch, stateful-ish workers).</li>
<li><strong>price-capacity-optimized (PCO)</strong> — weights both; AWS's recommended default for nearly everything now.</li>
<li><strong>diversified</strong> — spreads evenly across pools (legacy Spot Fleet option).</li>
</ul>
<p>Whatever the strategy, <strong>diversify the pool list</strong>: 10+ instance types across all AZs. Each pool's capacity is independent; breadth is your real availability mechanism on Spot.</p>

<div class="callout war">Real-world Spot failure mode: a team pins one instance type ("we benchmarked on c5.2xlarge") in one AZ, runs fine for months, then an industry-wide GPU or C-family crunch drains that pool and their entire fleet evaporates in an afternoon — simultaneously, because it is one pool. Spot reliability is an emergent property of diversification, not of any single pool's history. Second gotcha: Spot capacity is reclaimed <em>before</em> On-Demand quota helps you — your fallback OD launches can then fail on insufficient capacity in the same crunch, so fall back across families too.</div>

<div class="callout limits">Numbers: Spot interruption notice = 2 minutes; rebalance recommendation = variable, earlier, best-effort. Spot discount up to ~90 percent, floating. RI/SP terms: 1 or 3 years only. Convertible exchanges must be equal-or-greater value. Savings Plans apply to usage in a fixed order: EC2 Instance SP first, then Compute SP, highest-discount-percentage usage first — you cannot target them.</div>

<div class="callout deep">How Savings Plans actually bill: they are not instances, they are a metering overlay. Every hour, your usage is priced at the SP rate until your committed $/hr is consumed; the remainder bills On-Demand. Under-utilization is pure waste (you pay commitment regardless); over-utilization just spills to OD. This is why you commit to ~70-80 percent of observed baseline, not peak — and why "we bought SPs and the bill went up" almost always means someone committed against a peak that autoscaling later shaved.</div>
`
    },
    {
      id: "placement-amis",
      title: "Placement groups and AMIs: controlling where and from what you launch",
      html: `
<p>By default EC2 scatters your instances across a region's hardware wherever capacity exists. <strong>Placement groups</strong> let you bias that scheduler in one of three directions — closer together, provably apart, or apart in labeled groups. Each maps to a distributed-systems need you already have.</p>

<h3>The three strategies</h3>
<table>
<thead><tr><th>Strategy</th><th>Semantics</th><th>Use case</th><th>Failure/limit profile</th></tr></thead>
<tbody>
<tr><td><strong>Cluster</strong></td><td>Pack onto the same rack / network spine, single AZ</td><td>HPC, MPI, distributed training, anything needing 10&nbsp;GbE-to-100&nbsp;Gbps node-to-node with lowest latency</td><td>Shared-rack blast radius; capacity errors when growing later</td></tr>
<tr><td><strong>Spread</strong></td><td>Each instance on distinct hardware (own rack, power, network)</td><td>Small sets of must-not-cofail nodes: etcd/ZooKeeper quorums, HA NAT or firewall pairs</td><td><strong>Max 7 running instances per AZ per group</strong></td></tr>
<tr><td><strong>Partition</strong></td><td>Instances grouped into partitions; partitions do not share racks</td><td>Rack-aware big data: Kafka, Cassandra, HDFS, OpenSearch — map partitions to replica placement</td><td>Up to <strong>7 partitions per AZ</strong>, hundreds of instances total</td></tr>
</tbody>
</table>

<p>Partition groups expose the partition number through instance metadata, so Cassandra/Kafka can be configured with real topology awareness — replicas land in different partitions, meaning a rack-level failure takes out at most one replica. Spread is the same guarantee at per-instance granularity but capped at 7 per AZ, which is why "hundreds of nodes, isolate hardware failures" → partition, and "handful of critical instances" → spread.</p>

<div class="callout war">Cluster group capacity is the classic trap: you launch 20 nodes fine on Monday, then try to add 4 more during a Friday incident and get <code>InsufficientInstanceCapacity</code> because the rack neighborhood is full. Best practice is to launch the whole cluster in one request (or stop/start everything to let it re-pack), use one instance type, and accept that cluster groups trade availability for bandwidth — a rack event can take the entire group. Never put an availability-critical quorum in a cluster group.</div>

<div class="callout exam">Keyword mappings: "lowest inter-node latency / HPC / tightly coupled" → cluster. "Critical instances that must be on distinct hardware" (and the count is small) → spread. "Kafka / Cassandra / Hadoop needing rack awareness at scale" → partition. Cluster is single-AZ by definition; spread and partition can span AZs within one region. You can combine cluster placement with EFA for the full HPC answer.</div>

<h3>AMIs: what an image actually is</h3>
<p>An AMI is metadata: a pointer to one or more <strong>EBS snapshots</strong> (or an S3-hosted bundle for instance-store AMIs), plus launch defaults (root device, block device mappings, virtualization type, architecture). Two backing types with different lifecycle semantics:</p>
<ul>
<li><strong>EBS-backed</strong> (essentially all modern AMIs): root volume is an EBS volume restored lazily from a snapshot. Instances can <strong>stop</strong> (root persists), boot fast, resize the root at launch. First-boot reads that hit un-hydrated snapshot blocks pay a latency penalty — pre-warm with Fast Snapshot Restore (FSR, billed per-AZ-hour) if p99 on fresh instances matters.</li>
<li><strong>Instance-store-backed</strong>: root is ephemeral local disk loaded from S3. No stop — only running or terminated; reboot keeps data, anything else loses it. Legacy; know it exists for the exam contrast.</li>
</ul>

<h3>Sharing, copying, encryption</h3>
<ul>
<li><strong>Cross-account sharing</strong> modifies the AMI's launch permissions — but the target account also needs access to the backing snapshots, and if those snapshots are encrypted with the default AWS-managed key (<code>aws/ebs</code>) they <em>cannot</em> be shared at all. Encrypted sharing requires a customer-managed KMS key with a key policy granting the other account, plus sharing the snapshot. Public AMIs cannot be encrypted.</li>
<li><strong>Cross-region</strong>: AMIs are regional objects. <code>copy-image</code> re-creates snapshots in the destination region, and the copy operation is your opportunity to <strong>apply or change encryption</strong> — you can encrypt an unencrypted AMI, or re-encrypt to a different CMK, during copy. That is the standard answer to "make this AMI usable in another region / encrypted with our key."</li>
<li><strong>Deregistration</strong> deletes the AMI record, <em>not</em> the snapshots — those keep billing until deleted separately. Orphaned AMI snapshots are a perennial line item; automate cleanup (Data Lifecycle Manager or a recycle-bin/retention policy).</li>
</ul>

<div class="callout deep">Golden-AMI pipelines vs boot-time config: baking (EC2 Image Builder, Packer) moves cost and failure risk from every boot to build time — instances launch in seconds and cannot fail on a dead package mirror during an autoscaling event. User-data bootstrapping keeps images generic but makes scale-out latency depend on apt/pip/artifact endpoints. The mature pattern is a hybrid: bake everything slow and stable, inject only per-environment config at boot (SSM Parameter Store / Secrets Manager), and treat AMI ID as an immutable release artifact pinned in the launch template.</div>

<div class="callout limits">Spread group: 7 running instances per AZ, hard. Partition group: 7 partitions per AZ. AMIs and snapshots are regional; launch permissions are per-AMI, snapshot access is separate. Default-key-encrypted snapshots are unshareable — CMK required. You cannot change a placement group on a running instance; stop it first (or launch fresh).</div>
`
    },
    {
      id: "imds-userdata-storage",
      title: "User data, IMDSv2, and instance store vs EBS semantics",
      html: `
<p>Three things every instance interacts with at boot: the <strong>user data</strong> you injected, the <strong>instance metadata service (IMDS)</strong> it introspects, and the storage devices whose durability semantics you had better have chosen deliberately.</p>

<h3>User data</h3>
<p>User data is an opaque blob (16&nbsp;KB max) delivered via IMDS and executed by cloud-init on first boot, <strong>as root, exactly once per instance by default</strong>. Subsequent reboots do not re-run it; a stop/start does not either, unless you wrap the payload in a MIME multi-part with a <code>cloud-config</code> directive setting scripts to run per-boot. Standard uses: join a cluster, pull config from SSM Parameter Store, register with a discovery service, install the CloudWatch agent. Anti-uses: secrets. User data is readable by <em>any process on the instance</em> via IMDS and by anyone with <code>ec2:DescribeInstanceAttribute</code> — treat it as public within your account. Secrets belong in Secrets Manager/Parameter Store fetched with the instance role.</p>

<h3>IMDS and the v1 problem</h3>
<p>IMDS lives at the link-local address <code>169.254.169.254</code> and serves instance identity, network config, tags (if enabled), user data, and — critically — the <strong>temporary credentials for the instance's IAM role</strong> at <code>iam/security-credentials/role-name</code>.</p>
<p><strong>IMDSv1</strong> is a plain unauthenticated GET. That makes it the canonical <strong>SSRF amplifier</strong>: any bug that lets an attacker make your app fetch an arbitrary URL (an image-proxy feature, a webhook tester, a misconfigured reverse proxy) lets them fetch the role credentials and become your instance from anywhere on the internet. This is not theoretical — the pattern behind the 2019 Capital One breach was exactly SSRF-to-IMDS-to-credentials, and it remains the most common cloud credential-theft primitive.</p>
<p><strong>IMDSv2</strong> converts every access into a session: first a <code>PUT</code> to <code>/latest/api/token</code> (with a TTL header, max 6 hours) returns a token; every subsequent GET must present it in a header. Why this kills the easy SSRF: typical SSRF primitives issue GETs and cannot set custom headers, and definitely cannot do a PUT-then-GET dance. Defense in depth: the token-issuing PUT is rejected if the request arrives with an <code>X-Forwarded-For</code> header (so open reverse proxies cannot mint tokens), and the response's IP TTL defaults to <strong>hop limit 1</strong>, so the token response dies at the instance and cannot transit a NAT or container bridge.</p>
<pre><code>TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id</code></pre>
<p>Enforce v2 with <code>--metadata-options HttpTokens=required</code> at launch (or modify in place, or set it in the launch template, or require it account-wide via the IMDS defaults setting). One operational nuance: containers using bridge networking sit one hop away from IMDS, so with hop limit 1 they cannot reach it — for ECS-on-EC2 with the task needing IMDS you raise <code>HttpPutResponseHopLimit</code> to 2 (though tasks should be using task roles via the ECS credential endpoint, not IMDS, anyway).</p>

<div class="callout exam">Any scenario mentioning "SSRF," "credentials stolen via metadata," or "enforce session-oriented metadata access" → require IMDSv2 (<code>HttpTokens=required</code>), and optionally detect v1 usage via the CloudWatch metric <code>MetadataNoToken</code> before flipping. Distractors: NACLs/security groups cannot block IMDS (it is link-local, never leaves the host), and disabling the instance role "fixes" it only by breaking the app.</div>

<h3>Instance store vs EBS</h3>
<table>
<thead><tr><th></th><th>Instance store</th><th>EBS</th></tr></thead>
<tbody>
<tr><td>Physical reality</td><td>NVMe/SSD on the host itself</td><td>Network-replicated block service</td></tr>
<tr><td>Survives reboot</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Survives stop / hibernate / terminate</td><td><strong>No — data gone</strong> (host changes)</td><td>Yes (until volume deleted)</td></tr>
<tr><td>Survives host failure</td><td>No</td><td>Yes (replicated within AZ)</td></tr>
<tr><td>Performance</td><td>Millions of IOPS, microsecond latency, no network hop</td><td>Capped by volume type + instance EBS envelope</td></tr>
<tr><td>Snapshot / detach / resize</td><td>No</td><td>Yes</td></tr>
<tr><td>Billing</td><td>Included in instance price</td><td>Per GB-month + IOPS/throughput</td></tr>
</tbody>
</table>
<p>The mental model: instance store is a <em>cache tier with the durability of RAM across stops</em>. Correct uses are data that is disposable or replicated at a higher layer: scratch/tmp for ETL, shuffle space, local caches, and — importantly — <strong>replicated data stores</strong> (Cassandra, Scylla, Kafka, Elasticsearch/OpenSearch data nodes) where the application layer owns durability via replication and you buy I-family instances precisely for the NVMe. Wrong uses: anything singular. A stop/start (including one forced by an underlying host retirement) silently hands you a blank disk.</p>

<div class="callout war">Two recurring incidents: (1) team runs a single-node database on an i3's NVMe "temporarily," an EC2 scheduled-maintenance stop/start lands, and the dataset is gone — instance store does not survive migration to a new host, and stop/start always migrates. (2) Team benchmarks EBS gp3 against instance-store NVMe, sees 10-50x IOPS difference, and moves a durability-critical workload to instance store for speed without adding application-level replication. The speed is real; so is the blast radius.</div>

<div class="callout limits">User data: 16&nbsp;KB, base64-encoded in the API. IMDSv2 token TTL: up to 21,600 s (6 h). Default hop limit 1 (raise to 2 for bridge-networked containers). IMDS endpoint: 169.254.169.254 (IPv6: fd00:ec2::254). Instance-store size and device count are fixed per instance type — you cannot add more; the d suffix tells you it is there.</div>
`
    },
    {
      id: "lifecycle-network-tenancy",
      title: "Lifecycle, ENA/EFA, capacity reservations, and dedicated tenancy",
      html: `
<p>This lesson collects the operational corners the exam mines for one-liners: what stop/hibernate/terminate actually do, when EFA beats ENA, how to guarantee capacity without paying for a discount, and the licensing math behind dedicated hosts.</p>

<h3>Stop, terminate, hibernate</h3>
<ul>
<li><strong>Stop</strong>: OS shuts down; EBS root persists; instance store is wiped; RAM is lost. Billing for compute stops (EBS keeps billing). On start you get a <strong>new host</strong> (fixes degraded-hardware events), usually a new public IP (unless EIP), same private IP and ENIs. Stop/start is also how you change instance type.</li>
<li><strong>Terminate</strong>: instance destroyed; EBS root deleted by default (<code>DeleteOnTermination=true</code> on root; non-root volumes default to persist). Enable <strong>termination protection</strong> (<code>DisableApiTermination</code>) on pets; note it does not block termination driven by an ASG or by <code>InstanceInitiatedShutdownBehavior=terminate</code>.</li>
<li><strong>Hibernate</strong>: freezes RAM to the <strong>encrypted EBS root volume</strong>, then stops. On start, RAM is restored — processes, caches, and JVM warm-up survive. Prerequisites: encrypted root with free space larger than RAM, RAM under 150&nbsp;GB, supported families/OSes, hibernation enabled <em>at launch</em> (cannot retrofit), and a maximum of 60 days hibernated. While hibernated you pay only storage. Use cases: pre-warmed capacity pools (ASG warm pools support it), long-initialization apps, dev boxes.</li>
</ul>

<div class="callout exam">"Preserve in-memory state / avoid long warm-up after stopping" → hibernation, and the follow-up requirement is always "encrypted root EBS volume, enabled at launch." "Instance failed hardware checks" → stop and start (migrates host); a reboot does not move hosts. "Accidentally terminated" prevention → termination protection plus root-volume DeleteOnTermination=false for data safety.</div>

<h3>ENA vs EFA</h3>
<p><strong>ENA</strong> (Elastic Network Adapter) is the standard enhanced-networking device on all Nitro instances: SR-IOV, up to 100-200&nbsp;Gbps on the n-suffix types, millions of PPS, kernel TCP/IP stack. You have it by default; there is nothing to decide.</p>
<p><strong>EFA</strong> (Elastic Fabric Adapter) is ENA plus an <strong>OS-bypass</strong> path: userspace applications talk to the NIC directly through libfabric using the SRD protocol (AWS's multipath, out-of-order-tolerant reliable datagram — think a modern take on InfiniBand verbs semantics over the AWS fabric). MPI and NCCL sit on top. The result is single-digit-microsecond latencies and the elimination of kernel/network-stack jitter that kills tightly coupled scaling. Constraints that make it exam-recognizable: OS-bypass traffic works only <strong>within one subnet/AZ</strong> (typically paired with a cluster placement group), it is for node-to-node east-west traffic (the same device still does normal ENA TCP/IP for everything else), and it only helps applications written to MPI/NCCL/libfabric — your REST microservice gains nothing.</p>

<div class="callout exam">"Tightly coupled HPC / MPI / distributed ML training needs to scale across nodes" → EFA + cluster placement group. "Just needs high throughput networking" → ENA (already there; maybe pick an n-suffix type). EFA never spans AZs for OS-bypass traffic.</div>

<h3>Capacity reservations</h3>
<p><strong>On-Demand Capacity Reservations (ODCR)</strong> pin capacity for an instance type in a specific AZ, starting immediately, no term. Crucial mental split: <em>capacity</em> and <em>discount</em> are separate axes. ODCRs guarantee launchability but bill at On-Demand rates <strong>whether or not you run instances in them</strong> — you then layer Savings Plans or regional RIs on top for the discount. Zonal RIs are the legacy construct that bundled both. Use ODCRs for known events (product launch, DR failover target, re:Invent-scale traffic) and for protecting scarce shapes; use <strong>Capacity Blocks for ML</strong> when the scarce shape is GPUs — a reservation of P/Trn capacity for a defined future window, priced dynamically.</p>

<div class="callout war">An unused ODCR is a silent money furnace: it bills the full On-Demand rate for zero running instances. Set <code>--instance-match-criteria targeted</code> or monitor utilization, and cancel event reservations the moment the event ends. Conversely, teams assume Savings Plans guarantee capacity — they do not; during an AZ capacity crunch your discounted launch fails like anyone else's without an ODCR.</div>

<h3>Dedicated Hosts vs Dedicated Instances</h3>
<table>
<thead><tr><th></th><th>Dedicated Instance</th><th>Dedicated Host</th></tr></thead>
<tbody>
<tr><td>Isolation</td><td>Your account's instances only on the hardware</td><td>Same, plus you control the host</td></tr>
<tr><td>Visibility</td><td>None — no socket/core/host info</td><td>Full: sockets, physical cores, host ID</td></tr>
<tr><td>Placement control</td><td>None; host can change on stop/start</td><td><strong>Affinity</strong>: pin an instance to a specific host</td></tr>
<tr><td>BYOL socket/core licenses</td><td>No</td><td><strong>Yes</strong> — Windows Server, SQL Server, Oracle per-socket/per-core BYOL</td></tr>
<tr><td>Billing</td><td>Per instance + region fee</td><td>Per whole host (On-Demand, SP, or reservation)</td></tr>
</tbody>
</table>
<p>The discriminator is <strong>licensing</strong>. Per-socket/per-core licenses (and license terms forbidding hardware mobility) require visibility into and control of the physical host — only Dedicated Hosts provide it, and host affinity ensures a stop/start does not silently move you to a new host and re-consume licenses. Dedicated Instances exist for the softer requirement "no other tenant on my hardware" (compliance checkbox) without licensing needs. If the requirement is merely "single-tenant," either works and Dedicated Instances are simpler; the words "existing per-socket licenses" or "license tied to physical cores" force Dedicated Hosts every time.</p>

<div class="callout limits">Hibernate: RAM under ~150&nbsp;GB, encrypted root, 60-day max, enable at launch. Stop/start = new host, new public IP (no EIP), private IP retained. ODCR = zonal, OD-rate billing while unused, stack with SP/regional RI for discount. Dedicated Host billing is per host regardless of instance count; License Manager tracks BYOL consumption.</div>
`
    }
  ],
  quiz: [
    {
      q: "A genomics company runs a tightly coupled MPI simulation across 64 nodes. Runs currently take hours, and profiling shows inter-node communication latency is the bottleneck. Which combination most improves performance?",
      options: [
        "Spread placement group with ENA-enabled instances in three AZs",
        "Cluster placement group with EFA-enabled instances in a single AZ",
        "Partition placement group with enhanced networking across two AZs",
        "Cluster placement group spanning two AZs with jumbo frames enabled"
      ],
      answer: [1],
      multi: false,
      explanation: "Tightly coupled MPI is the canonical case for a <strong>cluster placement group plus EFA</strong>: the cluster group packs nodes onto the same network spine and EFA gives OS-bypass, microsecond-latency messaging via libfabric/SRD — both only work within a single AZ. <strong>A</strong> is backwards: spread deliberately separates instances onto distinct hardware, maximizing availability and latency, and caps at 7 per AZ anyway. <strong>C</strong> partition groups are for rack-aware distributed storage (Kafka/Cassandra), not latency reduction, and EFA OS-bypass cannot cross AZs. <strong>D</strong> is impossible — cluster placement groups are single-AZ by definition."
    },
    {
      q: "A security review of a web application on EC2 finds that a server-side request forgery vulnerability could allow attackers to retrieve IAM role credentials from the instance metadata service. Which remediation directly addresses this with the least application change?",
      options: [
        "Add a security group rule blocking outbound traffic to 169.254.169.254",
        "Require IMDSv2 by setting HttpTokens to required in the instance metadata options",
        "Remove the IAM instance profile and embed access keys in encrypted user data",
        "Move the credentials endpoint behind a Network ACL deny rule"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is the designed fix: IMDSv2 requires a PUT-issued session token presented as a header on every request, which typical SSRF primitives (attacker-controlled GET URLs, no custom headers) cannot perform; the X-Forwarded-For rejection and hop-limit-1 default add further layers. <strong>A</strong> and <strong>D</strong> do not work — IMDS traffic is link-local and handled on the host itself; it never traverses security groups or NACLs. <strong>C</strong> makes things dramatically worse: user data is readable via IMDS and the DescribeInstanceAttribute API, and static keys are strictly weaker than role credentials."
    },
    {
      q: "A company commits to AWS for 3 years to cut compute cost. The workload currently runs on m6i instances, but the platform team plans to migrate some services to Fargate and evaluate Graviton over the next year. Which commitment preserves the discount across all of these changes?",
      options: [
        "Standard Reserved Instances for m6i in the current region",
        "EC2 Instance Savings Plan for the m6i family",
        "Compute Savings Plan",
        "Zonal Reserved Instances plus an On-Demand Capacity Reservation"
      ],
      answer: [2],
      multi: false,
      explanation: "<strong>C</strong> — a Compute Savings Plan is a dollar-per-hour commitment that applies across any instance family, size, region, OS, and tenancy, <em>and</em> covers Fargate and Lambda usage, so it follows the workload through both the Graviton switch and the Fargate migration. <strong>A</strong> Standard RIs are locked to the m6i family (size-flexible within family only) — worthless after moving to m7g or Fargate. <strong>B</strong> EC2 Instance SPs are also family+region locked. <strong>D</strong> zonal RIs are the least flexible RI form, and an ODCR adds capacity assurance, not discount portability."
    },
    {
      q: "A nightly ETL pipeline runs 4 hours of embarrassingly parallel batch jobs that checkpoint progress to S3 every few minutes. The team wants maximum cost savings and minimum job disruption. Which Spot configuration is best?",
      options: [
        "Single instance type in one AZ with the lowest-price allocation strategy",
        "Many instance types across all AZs with the price-capacity-optimized allocation strategy",
        "Many instance types across all AZs with the lowest-price allocation strategy",
        "One capacity-optimized pool per job with a persistent Spot request set to hibernate"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> combines the two Spot reliability levers: broad diversification (many type+AZ pools) and price-capacity-optimized allocation, AWS's recommended default, which weights pool depth against price to minimize interruptions while staying cheap. Checkpointing already handles the residual 2-minute interruptions. <strong>A</strong> is the worst of everything — one pool means one reclamation event kills the whole fleet, and lowest-price picks shallow, high-churn pools. <strong>C</strong> fixes diversification but lowest-price still steers into pools likely to be reclaimed, maximizing disruption. <strong>D</strong> hibernating batch workers adds complexity for jobs that already checkpoint, and one pool per job forfeits diversification."
    },
    {
      q: "An application team must run 3 ZooKeeper nodes such that no two share underlying hardware, racks, or power. They also run a 60-node Cassandra ring that needs rack-aware replica placement. Which placement groups fit? (Select TWO.)",
      options: [
        "Spread placement group for the ZooKeeper nodes",
        "Cluster placement group for the ZooKeeper nodes",
        "Partition placement group for the Cassandra ring",
        "Spread placement group for the Cassandra ring",
        "Cluster placement group for the Cassandra ring"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<strong>A</strong> — spread groups guarantee each instance lands on distinct hardware with separate power/network, perfect for a small quorum, and 3 nodes fits well under the 7-per-AZ cap. <strong>C</strong> — partition groups (up to 7 partitions per AZ, hundreds of instances) expose partition topology via metadata so Cassandra can place replicas rack-aware. <strong>B</strong> cluster groups pack instances together — the opposite of quorum isolation. <strong>D</strong> spread cannot hold 60 nodes (7 per AZ limit). <strong>E</strong> cluster for Cassandra concentrates the whole ring's failure domain onto shared racks."
    },
    {
      q: "A company must run SQL Server with existing per-socket licenses whose terms require the software to remain bound to specific physical servers. Which EC2 option satisfies the licensing requirement?",
      options: [
        "Dedicated Instances with termination protection enabled",
        "Dedicated Hosts with host affinity configured",
        "Default tenancy instances in a spread placement group",
        "Capacity Reservations in a single Availability Zone"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> — Dedicated Hosts expose physical sockets and cores, support BYOL per-socket/per-core licensing, and host affinity pins instances to the same physical host across stop/starts, satisfying license-to-server binding. <strong>A</strong> Dedicated Instances give single-tenant hardware but zero host visibility and no placement control — the host can change on stop/start, breaking socket-bound license terms. <strong>C</strong> spread groups separate hardware but it is still shared-tenant with no socket visibility. <strong>D</strong> ODCRs reserve capacity; they say nothing about tenancy or licensing."
    },
    {
      q: "A stateful analytics service takes 25 minutes to warm its in-memory caches after boot. The team stops instances overnight to save money but wants them productive within a couple of minutes each morning. What should they do?",
      options: [
        "Enable hibernation at launch on instances with encrypted EBS root volumes",
        "Use instance-store-backed AMIs so memory persists on the local NVMe",
        "Create an AMI each night and launch from it each morning",
        "Move the workload to a T-family instance in unlimited mode"
      ],
      answer: [0],
      multi: false,
      explanation: "<strong>A</strong> — hibernation writes RAM to the encrypted EBS root at stop and restores it at start, so processes resume with caches warm; prerequisites are exactly hibernation enabled at launch, an encrypted root with room for RAM, and RAM under the ~150 GB ceiling. <strong>B</strong> is doubly wrong: instance store is wiped on stop, and RAM never persists to disk automatically. <strong>C</strong> an AMI captures disk, not memory — the cache warm-up happens again on every launch. <strong>D</strong> T-family burst mode is about CPU credits and has nothing to do with preserving memory state."
    },
    {
      q: "During a traffic surge an Auto Scaling group fails to launch c5.4xlarge instances in us-east-1a with an InsufficientInstanceCapacity error, breaching the company's availability objective for a planned product launch next month. What best prevents a recurrence during the launch?",
      options: [
        "Purchase a Compute Savings Plan sized for the launch traffic",
        "Create On-Demand Capacity Reservations for the required capacity in the target AZs",
        "Enable termination protection on all instances in the group",
        "Convert the group to lowest-price Spot allocation for deeper capacity access"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> — ODCRs are the only construct here that actually reserves capacity: they pin instance-type capacity in specific AZs starting immediately, with no term, so launches during the event cannot fail for capacity. <strong>A</strong> is the classic trap: Savings Plans (and regional RIs) are billing discounts and guarantee zero capacity. <strong>C</strong> termination protection stops accidental termination; it cannot conjure launch capacity. <strong>D</strong> Spot makes availability strictly worse — spare capacity is what disappears first in a crunch, and lowest-price targets the shallowest pools."
    },
    {
      q: "A container platform team on ECS with EC2 hosts enforces IMDSv2 with the default metadata options. Applications in bridge-mode containers now fail to retrieve metadata. Instances themselves can query IMDS fine. What is the cause?",
      options: [
        "IMDSv2 tokens cannot be generated from container runtimes",
        "The default hop limit of 1 causes token responses to be dropped before reaching containers behind the bridge",
        "The containers' security groups block link-local traffic",
        "Bridge networking rewrites the PUT request into a GET, which IMDSv2 rejects"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> — IMDSv2 responses carry an IP TTL (hop limit) defaulting to 1, so the packet expires at the instance's network namespace and never crosses the bridge into the container's namespace; raising HttpPutResponseHopLimit to 2 fixes it (though tasks should prefer ECS task roles over raw IMDS). <strong>A</strong> is false — containers can perform the PUT/GET flow if packets can reach them. <strong>C</strong> security groups never see link-local IMDS traffic; it is handled on-host. <strong>D</strong> is fiction — bridges forward frames; they do not rewrite HTTP methods."
    },
    {
      q: "A team runs Cassandra on i3en instances, using the local NVMe for data with a replication factor of 3. An engineer proposes also running the company's single-instance Git server on an i3en to get the same fast storage. Why is this a mistake?",
      options: [
        "Instance store cannot be formatted with standard Linux filesystems",
        "Instance store data is lost on stop, hibernate, or host failure, and the Git server has no application-level replication to compensate",
        "NVMe instance store is slower than gp3 EBS for small random writes",
        "Instance store volumes cannot exceed 100 GB"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> — instance store is host-local ephemeral storage: any stop/start (including host-retirement events AWS initiates), hibernate, or hardware failure discards it. Cassandra tolerates this because durability lives in replication across nodes; a lone Git server has no such layer and one lifecycle event destroys the repository. <strong>A</strong> false — it is a normal block device; format it with ext4/xfs freely. <strong>C</strong> false — local NVMe massively outperforms gp3 on IOPS and latency. <strong>D</strong> false — i3en instances carry tens of TB of NVMe."
    },
    {
      q: "Which TWO statements about the AWS Nitro system are accurate? (Select TWO.)",
      options: [
        "Nitro offloads VPC networking and EBS processing to dedicated hardware cards, leaving a minimal hypervisor on the host",
        "Nitro hosts run a full management operating system that AWS operators access over SSH for maintenance",
        "Bare-metal instances bypass Nitro entirely, so VPC security groups do not apply to them",
        "Nitro Enclaves provide isolated compute with no persistent storage or external networking, communicating with the parent instance over a local channel",
        "Nitro requires customers to install paravirtual drivers to reach full network performance"
      ],
      answer: [0, 3],
      multi: true,
      explanation: "<strong>A</strong> is the core architecture: I/O and management live on Nitro cards, and the on-host hypervisor is a thin KVM-based layer — the source of near-bare-metal performance. <strong>D</strong> correctly describes Enclaves: CPU/RAM carved off the parent, no network/storage/interactive access, vsock-only communication, with KMS attestation as the key-release mechanism. <strong>B</strong> is the opposite of the Nitro security model — no interactive operator access exists by design. <strong>C</strong> is wrong precisely because Nitro cards enforce VPC/EBS policy in hardware, which is what makes .metal offerings safe. <strong>E</strong> describes the Xen era; Nitro instances use ENA/NVMe interfaces with drivers already in mainline kernels."
    },
    {
      q: "A company needs to share an encrypted, EBS-backed AMI with a partner AWS account and also make it launchable in another region. Which set of actions is required? (Select TWO.)",
      options: [
        "Re-encrypt the AMI's snapshots with a customer-managed KMS key and grant the partner account access in the key policy",
        "Mark the AMI public, since encrypted AMIs can only be shared publicly",
        "Copy the AMI to the target region, since AMIs are regional resources",
        "Share only the AMI launch permission; snapshot access is implied automatically",
        "Convert the AMI to instance-store-backed before sharing"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<strong>A</strong> — snapshots encrypted with the default aws/ebs key cannot be shared at all; you must use a customer-managed key whose policy grants the partner account, and share the underlying snapshots. <strong>C</strong> — AMIs are regional; copy-image recreates the snapshots in the destination region (and is also where you could change encryption keys). <strong>B</strong> is backwards — encrypted AMIs can never be public. <strong>D</strong> is a common operational miss: launch permissions and snapshot access are separate grants. <strong>E</strong> is nonsense — instance-store AMIs are legacy and would not help sharing."
    },
    {
      q: "A fleet uses Spot instances behind an Auto Scaling group with Capacity Rebalancing enabled. What does the rebalance recommendation signal provide beyond the standard interruption notice?",
      options: [
        "A guaranteed 15-minute warning before any interruption",
        "An earlier, best-effort signal that a Spot pool is at elevated interruption risk, allowing proactive replacement before the 2-minute notice",
        "An option to pay a premium to avoid the interruption entirely",
        "Notification that the Spot price has exceeded the On-Demand price"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> — the rebalance recommendation fires when AWS assesses a pool as elevated-risk; it can arrive well before (or in the worst case around the same time as) the 2-minute interruption notice, and ASG Capacity Rebalancing uses it to launch replacements and drain the at-risk instance proactively. <strong>A</strong> no fixed lead time is guaranteed. <strong>C</strong> there is no pay-to-stay mechanism; capacity reclamation is not negotiable. <strong>D</strong> Spot prices cannot exceed On-Demand, and modern reclamation is driven by capacity needs, not price crossings."
    },
    {
      q: "A media company runs video transcoding 24x7 at a stable baseline of 40 instances, with unpredictable bursts up to 120 instances that can tolerate interruption. Which purchasing mix is most cost-effective?",
      options: [
        "120 Standard Reserved Instances to cover peak",
        "Savings Plan or Standard RIs covering the 40-instance baseline, Spot for burst capacity",
        "All Spot with the capacity-optimized strategy, including the baseline",
        "On-Demand for everything with an Auto Scaling group"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is the portfolio answer the exam always wants: commit (RI or Savings Plan) exactly the steady 24x7 baseline for the ~72 percent discount, and serve interruption-tolerant burst on Spot at up to ~90 percent off. <strong>A</strong> commits to peak — 80 instances' worth of commitment sits idle most of the time, which is worse than On-Demand for the burst portion. <strong>C</strong> puts the always-on baseline at interruption risk with no commitment discount floor; even transcoding pipelines want a reliable core for queue management, and baseline load is precisely what commitments price best. <strong>D</strong> leaves the full ~72 percent baseline discount on the table."
    }
  ],
  flashcards: [
    { front: "Decode the instance type name c7g.2xlarge", back: "<strong>c</strong> = compute-optimized family, <strong>7</strong> = generation, <strong>g</strong> = Graviton (Arm), <strong>2xlarge</strong> = size (8 vCPU at the 1:2 c-family ratio). Other suffixes: a=AMD, i=Intel, d=local NVMe, n=enhanced networking." },
    { front: "vCPU meaning on x86 vs Graviton instances", back: "x86: 1 vCPU = 1 hyperthread (2 per physical core). Graviton: 1 vCPU = 1 physical core, no SMT — better per-vCPU throughput and tail latency." },
    { front: "Which instance families for: in-memory DB with TBs of RAM / NoSQL needing local IOPS / ML training?", back: "X or High Memory family; I-family (storage optimized, NVMe instance store); P or Trn family (accelerated)." },
    { front: "What does the Nitro system offload, and what remains on the host?", back: "Nitro cards handle VPC networking (ENA), EBS (as NVMe), instance store, and monitoring. The host runs only a minimal KVM-based hypervisor — no dom0, no operator SSH. Result: near-bare-metal performance and a tiny, attested TCB." },
    { front: "Nitro Enclaves: key properties and the KMS trick", back: "vCPUs+RAM carved from a parent instance; no network, no storage, no interactive access; vsock to parent only. Signed attestation document lets KMS key policies release keys only into the enclave — even instance root cannot see plaintext." },
    { front: "Standard RI vs Convertible RI", back: "Standard: up to ~72% off, locked to family (size-flex within family for regional Linux), sellable on RI Marketplace. Convertible: up to ~66% off, exchangeable across family/OS/tenancy for equal-or-greater value, not sellable." },
    { front: "Compute Savings Plan vs EC2 Instance Savings Plan", back: "Compute SP: $/hr commitment across any family, region, OS, tenancy — also covers <strong>Fargate and Lambda</strong>. EC2 Instance SP: locked to one family+region, higher discount (RI-level ~72%)." },
    { front: "Spot interruption: notice mechanism and lead time", back: "2-minute notice via IMDS (spot/instance-action) and EventBridge. Earlier best-effort <strong>rebalance recommendation</strong> signals elevated pool risk — used by ASG Capacity Rebalancing for proactive replacement." },
    { front: "Best default Spot allocation strategy and why", back: "price-capacity-optimized (PCO): weights pool depth and price, minimizing interruptions at low cost. lowest-price chases shallow, high-churn pools. Always diversify across many instance-type + AZ pools." },
    { front: "Placement groups: cluster vs spread vs partition", back: "Cluster: same rack/spine, single AZ, lowest latency (HPC + EFA), shared blast radius. Spread: distinct hardware per instance, max <strong>7 per AZ</strong> (quorums, HA pairs). Partition: up to <strong>7 partitions per AZ</strong>, rack-aware at scale (Kafka, Cassandra, HDFS)." },
    { front: "Can you share an AMI whose snapshots use the default aws/ebs KMS key?", back: "No. Default-key-encrypted snapshots are unshareable. Re-encrypt with a customer-managed key, grant the target account in the key policy, and share both AMI launch permission and the snapshots. Encrypted AMIs can never be public." },
    { front: "What happens to snapshots when you deregister an AMI?", back: "Nothing — deregistration removes only the AMI record. Backing snapshots persist and keep billing until deleted separately." },
    { front: "Why is IMDSv1 an SSRF hole and how does IMDSv2 fix it?", back: "v1 serves role credentials to any unauthenticated GET at 169.254.169.254 — an SSRF bug becomes full credential theft (Capital One pattern). v2 requires a PUT-minted session token in a header on every request, rejects tokens when X-Forwarded-For is present, and ships responses with hop limit 1. Enforce with HttpTokens=required." },
    { front: "IMDSv2 with containers in bridge networking: what breaks?", back: "Default hop limit 1 means token responses die before crossing the bridge into the container namespace. Raise HttpPutResponseHopLimit to 2 — or better, use task roles instead of raw IMDS." },
    { front: "Instance store: which lifecycle events destroy the data?", back: "Stop, hibernate, terminate, and host/hardware failure all wipe it (host changes). Only reboot preserves it. Use for scratch, caches, and app-replicated stores (Cassandra, Kafka) — never singular data." },
    { front: "User data: execution semantics and the security rule", back: "Max 16 KB, run by cloud-init as root <strong>once on first boot</strong> (not on reboot/stop-start unless configured per-boot). Readable via IMDS and DescribeInstanceAttribute — never put secrets in it; fetch them from Secrets Manager/SSM with the instance role." },
    { front: "Hibernation prerequisites and limits", back: "Enabled at launch only; encrypted EBS root with space exceeding RAM; RAM under ~150 GB; supported family/OS; max 60 days hibernated. RAM is written to the root volume and restored on start — pay only storage while hibernated." },
    { front: "Stop/start vs reboot: which one migrates hosts?", back: "Stop/start moves the instance to a new host (the fix for degraded-hardware notices) and typically changes the public IP (unless EIP). Reboot stays on the same host and keeps instance store intact." },
    { front: "EFA vs ENA — when do you need EFA?", back: "ENA = standard SR-IOV enhanced networking, always on for Nitro. EFA adds OS-bypass (libfabric/SRD) for MPI/NCCL workloads — tightly coupled HPC/ML training. OS-bypass traffic is single-subnet/single-AZ, usually paired with a cluster placement group." },
    { front: "Do Savings Plans or regional RIs reserve capacity?", back: "No — they are billing discounts only. Capacity guarantees come from On-Demand Capacity Reservations (zonal, immediate, no term, billed at OD rate even when unused) or legacy zonal RIs. Stack an ODCR with a SP/RI for discount + capacity." },
    { front: "Dedicated Host vs Dedicated Instance", back: "Both are single-tenant. Dedicated Host adds physical socket/core visibility, host affinity across stop/starts, and per-host billing — required for BYOL per-socket/per-core licenses (SQL Server, Oracle, Windows). Dedicated Instances = isolation checkbox only, no host control." },
    { front: "T-family unlimited mode gotcha", back: "Exhausting CPU credits does not throttle — it bills surplus credits at roughly M-family rates. A T instance pinned at 100% CPU can cost more than the equivalent fixed-performance instance. Standard mode throttles to baseline instead." },
    { front: "EBS device naming on Nitro instances", back: "EBS attaches as NVMe (/dev/nvme1n1...); enumeration order is not stable across stop/start. Mount by filesystem UUID or EBS volume ID embedded in NVMe metadata, never by raw device path." }
  ],
  lab: {
    title: "Lab: launch a hardened instance — IMDSv2-only, user data, Spot pricing recon, hibernation check",
    html: `
<h3>Goal</h3>
<p>Launch an instance with IMDSv2 enforced and user data, prove that IMDSv1-style requests fail and the token dance works, inspect Spot price history for capacity planning, and tear everything down. Cost: a t3.micro for under an hour — pennies, free-tier eligible.</p>

<h3>Architecture</h3>
<p>One t3.micro in your default VPC with a minimal security group (SSH only from your IP), a launch-time metadata policy of <code>HttpTokens=required</code>, and a user-data script that writes a marker file. No load balancer, no EBS beyond the root volume.</p>

<h3>Steps</h3>
<ol>
<li><p>Find a current Amazon Linux 2023 AMI and your default VPC/subnet:</p>
<pre><code>AMI=$(aws ssm get-parameter \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query Parameter.Value --output text)
VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' --output text)
SUBNET=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC \
  --query 'Subnets[0].SubnetId' --output text)
echo "$AMI $VPC $SUBNET"</code></pre></li>

<li><p>Create a key pair and a locked-down security group:</p>
<pre><code>aws ec2 create-key-pair --key-name lab-ec2 \
  --query KeyMaterial --output text &gt; lab-ec2.pem
chmod 400 lab-ec2.pem
MYIP=$(curl -s https://checkip.amazonaws.com)
SG=$(aws ec2 create-security-group --group-name lab-ec2-sg \
  --description "lab" --vpc-id $VPC --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $SG \
  --protocol tcp --port 22 --cidr $MYIP/32</code></pre></li>

<li><p>Write user data and launch with IMDSv2 required (note the metadata options — this is the lab's point):</p>
<pre><code>cat &gt; userdata.sh &lt;&lt;'EOF'
#!/bin/bash
echo "bootstrapped at $(date -u)" &gt; /etc/motd
EOF
IID=$(aws ec2 run-instances --image-id $AMI --instance-type t3.micro \
  --key-name lab-ec2 --security-group-ids $SG --subnet-id $SUBNET \
  --metadata-options "HttpTokens=required,HttpPutResponseHopLimit=1,HttpEndpoint=enabled" \
  --user-data file://userdata.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=imds-lab}]' \
  --query 'Instances[0].InstanceId' --output text)
aws ec2 wait instance-running --instance-ids $IID
IP=$(aws ec2 describe-instances --instance-ids $IID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)</code></pre></li>

<li><p>SSH in and prove the IMDS behavior. The first curl (v1 style) must fail with 401; the token dance must succeed:</p>
<pre><code>ssh -i lab-ec2.pem ec2-user@$IP

# v1-style request - expect HTTP 401 Unauthorized
curl -sw '%{http_code}\n' http://169.254.169.254/latest/meta-data/instance-id

# v2 dance - works
TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id
cat /etc/motd   # user data ran once, as root
exit</code></pre></li>

<li><p>Spot recon from your workstation — see pool pricing you would diversify across:</p>
<pre><code>aws ec2 describe-spot-price-history --instance-types t3.micro t3a.micro \
  --product-descriptions "Linux/UNIX" --start-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --query 'SpotPriceHistory[].[AvailabilityZone,InstanceType,SpotPrice]' --output table</code></pre></li>

<li><p>Confirm the metadata policy from the control plane, and note hibernation is not enabled (it must be set at launch):</p>
<pre><code>aws ec2 describe-instances --instance-ids $IID \
  --query 'Reservations[0].Instances[0].{IMDS:MetadataOptions.HttpTokens,Hib:HibernationOptions.Configured}'</code></pre></li>
</ol>

<h3>Verify</h3>
<p>You saw: 401 on the tokenless request, a successful token-authenticated read, the user-data marker in <code>/etc/motd</code>, <code>HttpTokens</code> reported as <code>required</code>, and per-AZ Spot prices demonstrating pool diversity.</p>

<h3>Teardown</h3>
<p>Ordered so nothing lingers or bills:</p>
<ol>
<li><pre><code>aws ec2 terminate-instances --instance-ids $IID
aws ec2 wait instance-terminated --instance-ids $IID</code></pre></li>
<li><pre><code>aws ec2 delete-security-group --group-id $SG
aws ec2 delete-key-pair --key-name lab-ec2
rm -f lab-ec2.pem userdata.sh</code></pre></li>
<li><p>Sanity check nothing remains: <code>aws ec2 describe-instances --filters Name=tag:Name,Values=imds-lab Name=instance-state-name,Values=running</code> should return no instances. The root EBS volume had DeleteOnTermination=true by default, so it is gone with the instance.</p></li>
</ol>
`
  }
});
