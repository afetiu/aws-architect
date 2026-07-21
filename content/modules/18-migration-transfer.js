/* Module 18 — Migration & Data Transfer */
window.COURSE.register({
  id: "migration",
  order: 18,
  track: "saa",
  title: "Migration & Data Transfer",
  description: "How to move workloads and bytes into AWS without lying to yourself about bandwidth: the 7 Rs decision framework, the ship-vs-stream math, Snow family, DataSync, Transfer Family, DMS/SCT, and MGN cutover mechanics.",
  examWeight: "Heavily tested on SAA-C03. Expect at least 4-6 questions that reduce to 'pick the right transfer tool given data size, link speed, and deadline' plus 2-3 DMS/SCT database migration scenarios.",
  lessons: [
    {
      id: "seven-rs",
      title: "The 7 Rs: a decision framework, not a slide",
      html: `
<p>The 7 Rs are usually presented as consultant vocabulary. Treat them instead as a
<strong>decision tree over three axes</strong>: how much the workload matters to the business, how much
engineering budget you have per workload, and how badly the current architecture fights the cloud.
Every migration portfolio decision is a point in that space, and the R you pick is just the label
for where the point landed.</p>

<h3>The seven, with the actual decision criteria</h3>
<table>
<thead><tr><th>R</th><th>What it means</th><th>Pick it when</th><th>Cost/effort shape</th></tr></thead>
<tbody>
<tr><td><strong>Rehost</strong> (lift-and-shift)</td><td>Same bits, new hypervisor. MGN does block-level replication of the disks.</td><td>Deadline-driven exits (data center lease expiry), hundreds of servers, no per-app budget. You optimize later, in the cloud, where iteration is cheap.</td><td>Lowest effort per server; highest ongoing run cost (you pay for the inefficiency you shipped).</td></tr>
<tr><td><strong>Replatform</strong> (lift-tinker-shift)</td><td>Same app, swap undifferentiated components: self-managed MySQL to RDS, JBoss on VMs to Elastic Beanstalk or ECS.</td><td>The component swap is low-risk and kills a large operational toil line item (backups, patching, failover scripting).</td><td>Days-to-weeks per app; big ops win for small code delta.</td></tr>
<tr><td><strong>Repurchase</strong> (drop-and-shop)</td><td>Abandon the app for SaaS: Exchange to M365, homegrown CRM to Salesforce.</td><td>The app is commodity and your version is behind, unloved, or license-expensive.</td><td>Migration is a data-export project, not an infra project.</td></tr>
<tr><td><strong>Refactor / re-architect</strong></td><td>Rewrite for cloud-native: monolith to services, VM cron jobs to Step Functions/Lambda, Oracle to Aurora with schema conversion.</td><td>The workload is a differentiator with real scale/agility pressure, and you can fund a multi-quarter effort. Highest ROI <em>only</em> for the workloads that deserve it.</td><td>Highest cost and risk; the only R that changes the curve rather than the intercept.</td></tr>
<tr><td><strong>Relocate</strong></td><td>Move at the hypervisor layer: VMware Cloud on AWS, moving containers between clusters without touching the app.</td><td>Massive VMware estates with vMotion/HCX skills in-house and a hard deadline. No instance-type conversion at all.</td><td>Fastest bulk move; you carry the VMware licensing with you.</td></tr>
<tr><td><strong>Retain</strong></td><td>Leave it where it is, revisit later.</td><td>Mainframes with unknowable dependencies, latency-pinned workloads, apps 6 months from decommission, compliance anchors.</td><td>Zero now, but retained systems keep the data center (and its fixed costs) alive — a half-empty DC costs almost the same as a full one.</td></tr>
<tr><td><strong>Retire</strong></td><td>Turn it off.</td><td>Discovery shows nobody has logged in for a year. Typically 10-20% of a real estate.</td><td>Negative cost. The single highest-ROI R, and the one organizations resist most.</td></tr>
</tbody>
</table>

<div class="callout deep">The portfolio dynamics matter more than any single choice. Rehost-heavy
migrations succeed on schedule and then face a 'phase 2' optimization backlog that often never gets
funded — the lifted VMs run at 15% CPU on on-demand pricing for years. Refactor-heavy migrations
deliver beautiful architectures for the three apps that finished while the data center lease renews
for everything else. Mature programs run a 70/20/10-ish split: rehost or replatform the bulk,
refactor the crown jewels, and be ruthless about retire/retain.</div>

<div class="callout exam">Exam keyword mapping: 'quickly with minimal changes' or 'data center closing
in N months' → rehost (MGN). 'Reduce database administration overhead during migration' → replatform
(to RDS). 'Move off commercial database licensing' → refactor with SCT + DMS to Aurora. 'VMware
workloads without modification' → relocate (VMware Cloud on AWS). 'Application scheduled for
decommission' → retire or retain. The exam rarely says the R name; it describes the constraint and
expects you to pick the matching service.</div>

<div class="callout war">Discovery before deciding, always. Every large estate contains servers whose
owners left the company, apps with hardcoded IPs of other apps, and a licensing landmine (Oracle on
VMware is its own genre of horror). Running Application Discovery Service for 2-4 weeks before
committing to per-workload Rs is the difference between a plan and a guess. The most common real-world
failure is rehosting an app whose license terms prohibit running on shared-tenancy hardware — check
Dedicated Host requirements (BYOL Windows Server, Oracle in some contracts) during discovery, not
during cutover week.</div>

<p>One more framing worth internalizing: the Rs are <strong>per workload, not per program</strong>, and
they are <strong>not final</strong>. Rehost now and refactor later is a legitimate two-step; AWS's own
data shows most refactoring happens post-migration, once the team can iterate without a change-freeze
window and a VPN to the old data center. The anti-pattern is refactoring <em>during</em> the migration
under deadline pressure — you get the risk of both approaches and the benefits of neither.</p>
`
    },
    {
      id: "bandwidth-math",
      title: "Ship vs stream: the bandwidth math you must do in your head",
      html: `
<p>Every transfer-tool question — on the exam and in real life — starts with one equation:</p>
<pre><code>transfer_time = data_size / (link_bandwidth x utilization)</code></pre>
<p>Utilization is the part people forget. A '1 Gbps' link never gives you 1 Gbps for a migration:
the link is shared with production traffic, TCP over distance has throughput ceilings without
tuning, and nobody lets a migration saturate the office uplink at 2pm. Planning numbers: assume
<strong>50-80% utilization</strong> on a dedicated link, 20-40% on a shared one.</p>

<h3>The numbers to be able to do mentally</h3>
<p>Useful conversion: <strong>1 TB over a fully-utilized 100 Mbps link takes about a day</strong>
(actually ~22.2 hours: 8 x 10^12 bits / 10^8 bits/sec = 80,000 s). Scale linearly from there:</p>
<table>
<thead><tr><th>Link (100% util)</th><th>1 TB</th><th>10 TB</th><th>100 TB</th><th>1 PB</th></tr></thead>
<tbody>
<tr><td>100 Mbps</td><td>~1 day</td><td>~9 days</td><td>~3 months</td><td>~2.5 years</td></tr>
<tr><td>1 Gbps</td><td>~2.2 hrs</td><td>~1 day</td><td>~9 days</td><td>~3 months</td></tr>
<tr><td>10 Gbps</td><td>~13 min</td><td>~2.2 hrs</td><td>~1 day</td><td>~9 days</td></tr>
</tbody>
</table>

<h3>The classic exam question, worked</h3>
<p>'A company must migrate 500 TB to S3 within 2 weeks. The site has a 100 Mbps internet connection
that is also used for business traffic. What should they do?' Do the math: 500 TB at 100 Mbps full
utilization is 500 days. Even a 10 Gbps Direct Connect (which takes weeks-to-months to provision —
cross-connects and telco lead time, so it cannot save a 2-week deadline anyway) would need ~5 days
at full saturation. The only feasible answer is <strong>ship devices</strong>: Snowball Edge Storage
Optimized units (~80 TB usable each, so 6-7 devices, orderable in parallel), load locally at LAN
speed, ship back, AWS imports to S3. Round-trip is typically about a week per device including
shipping.</p>

<div class="callout exam">The exam pattern is always: (data size, link speed, deadline) → compute
feasibility → if online is infeasible, Snow family; if online is feasible but slow, DataSync with
the link you have (optionally over Direct Connect); if it is a one-time upload of user-proximate
data from many global locations, S3 Transfer Acceleration. If the scenario says 'no additional
hardware' or 'ongoing/recurring transfers', Snowball is wrong even if the math is tight — Snow is
for point-in-time bulk moves, not pipelines.</div>

<h3>The decision among S3 Transfer Acceleration, DataSync, and Snowball</h3>
<table>
<thead><tr><th></th><th>S3 Transfer Acceleration</th><th>DataSync</th><th>Snowball Edge</th></tr></thead>
<tbody>
<tr><td>What it is</td><td>Upload to the nearest CloudFront edge; rides the AWS backbone to the bucket region</td><td>Managed agent-based transfer engine (or agentless for S3/EFS/FSx sources)</td><td>Physical device you load and ship</td></tr>
<tr><td>Best for</td><td>Geographically dispersed clients PUTting to one distant bucket over long-haul internet; existing S3 API integrations</td><td>NFS/SMB/HDFS/object migrations, recurring syncs, online migrations that need scheduling, verification, filtering</td><td>Data too big for the link and the deadline; disconnected/edge sites</td></tr>
<tr><td>Speedup source</td><td>Shorter first-mile + tuned backbone; helps most when clients are far from the region (can be 50-500% faster; no benefit for nearby clients — it only charges when it actually accelerates)</td><td>Parallelized, TLS, inline verification, incremental (only changed files on re-run)</td><td>Sneakernet: bandwidth of a truck</td></tr>
<tr><td>Pricing dimension</td><td>Per GB accelerated (on top of normal S3 pricing)</td><td>Per GB copied</td><td>Per job + per-day fee after included days + shipping</td></tr>
</tbody>
</table>

<div class="callout deep">Why is Transfer Acceleration faster at all? Plain long-haul TCP suffers from
the bandwidth-delay product: high RTT means slow ramp and painful loss recovery. Terminating the TCP
connection at a nearby edge gives the client a low-RTT connection (fast window growth), and the
edge-to-region leg runs on AWS's private backbone with persistent, tuned, parallel connections. It is
the same trick CloudFront uses for dynamic content, applied to S3 PUTs. This also tells you when it
does nothing: client already near the bucket region, or the bottleneck is the client's own uplink.</div>

<div class="callout war">Real-world wrinkle the exam ignores: seed-then-sync. For a live dataset too
big to stream, the pattern is Snowball for the initial bulk (point-in-time copy), then DataSync or
storage-gateway-style replication for the delta accrued while the device was in transit, then a short
cutover freeze. If the delta accrues faster than your link can drain it, no amount of shipping saves
you — you need Direct Connect or an application-level replication strategy. Compute the delta rate
before promising a cutover date.</div>

<p>Finally, remember the direction asymmetry: data <em>into</em> AWS is free on every one of these
paths (you pay service fees, not bandwidth); data <em>out</em> is where egress pricing lives. Migration
planning is almost always about time, not transfer cost — the reverse of steady-state architecture,
where egress dominates. That asymmetry is intentional and strategic.</p>
`
    },
    {
      id: "snow-family",
      title: "Snow family: capacities, use cases, and what the devices really are",
      html: `
<p>A Snow device is a ruggedized, tamper-evident server with NVMe/HDD storage, an S3-compatible or
NFS endpoint, 256-bit encryption with keys held in KMS (never on the device — keys are delivered to
the device's enclave and destroyed on return), and an E Ink shipping label that reprograms itself for
the return trip. You are not buying storage; you are renting a secure, trackable envelope for bytes,
sometimes with compute inside.</p>

<h3>The lineup and the numbers worth memorizing</h3>
<table>
<thead><tr><th>Device</th><th>Capacity</th><th>Compute</th><th>Use it for</th></tr></thead>
<tbody>
<tr><td><strong>Snowcone</strong> / Snowcone SSD</td><td>8 TB HDD / 14 TB SSD</td><td>2 vCPU, 4 GB RAM</td><td>Small, portable (~2.1 kg, fits in a backpack), harsh or space-constrained edge sites: drones, vehicles, clinics. Can run a DataSync agent to sync online, or be shipped back. Battery-operable via USB-C power bank.</td></tr>
<tr><td><strong>Snowball Edge Storage Optimized</strong></td><td>~80 TB usable (210 TB variant for pure data migration)</td><td>Up to 40 vCPU, 80 GB RAM</td><td>The default bulk-migration brick. Multi-device clustering for larger local durability. S3-compatible endpoint on-device.</td></tr>
<tr><td><strong>Snowball Edge Compute Optimized</strong></td><td>~28 TB NVMe</td><td>Up to 104 vCPU, 416 GB RAM, optional GPU</td><td>Edge computing where the data is born: run EC2 AMIs and Lambda functions on-device for ML inference, video analytics, industrial preprocessing at disconnected sites — then optionally ship results back.</td></tr>
</tbody>
</table>
<p>(Snowmobile, the 100 PB truck, was discontinued in 2024 — if you see it as an answer option on a
current exam, it is a distractor; multi-petabyte moves are done with fleets of Snowball Edge devices
or, better, a fat Direct Connect provisioned early.)</p>

<div class="callout limits">Numbers the exam expects you to know cold: Snowcone 8 TB (14 TB SSD),
Snowball Edge Storage Optimized ~80 TB usable (largest single-device option), turnaround roughly one
week door-to-door per device, devices can be ordered in parallel (there is no meaningful fleet limit
for planning purposes). If a scenario needs more than ~10 PB on a deadline, the honest answer is
'this should have been Direct Connect a year ago' — but on the exam, pick multiple Snowball Edges.</div>

<h3>The job lifecycle and where people get burned</h3>
<ol>
<li>Create a job in the console (import or export), pick device type, S3 bucket, KMS key.</li>
<li>Device ships to you. Unlock with the manifest + 25-character unlock code via Snowball client or
OpsHub GUI. These two credentials travel separately from the device by design — do not store them
together, that is the tamper model.</li>
<li>Copy data via the on-device S3 endpoint or NFS mount. Throughput is LAN-limited: 10/25/40/100
GbE ports depending on device. Small files murder throughput — millions of small files should be
tar/batched first (the S3 adapter has per-object overhead just like real S3).</li>
<li>Ship back (E Ink label auto-updates). AWS ingests into your bucket, then performs an NIST
800-88-compliant erasure of the device.</li>
</ol>

<div class="callout war">Two production gotchas. First: the import writes objects with the storage
class of your choice but the S3 key layout you gave the adapter — plan prefixes for parallelism
<em>before</em> loading, because re-keying 80 TB after import is a second migration. Second: data on
a Snowball in transit is a point-in-time snapshot. Any writes at the source after you sealed the
device are your delta problem (see seed-then-sync in the bandwidth lesson). Teams forget to freeze
or journal changes and discover the gap at reconciliation time.</div>

<div class="callout deep">The edge-computing story is underrated and increasingly tested. Snowball
Edge Compute Optimized runs a subset of EC2 (sbe instance family) from AMIs you preload at job
creation, plus IoT Greengrass and Lambda. There is no control-plane dependency once deployed — the
device works fully disconnected, which is the point: ships, mines, forward-operating bases, factories
with air-gapped OT networks. The pattern 'process locally, ship summaries or ship the device' turns
a bandwidth problem into a compute-placement problem.</div>

<div class="callout exam">Keyword mapping: 'no network connectivity' / 'remote site' / 'harsh
environment' → Snow family. 'Portable, less than 10 TB, battery/USB powered' → Snowcone. 'Tens to
hundreds of TB, one-time migration' → Snowball Edge Storage Optimized. 'Run ML inference where data
is generated, limited connectivity' → Snowball Edge Compute Optimized. 'Data must not traverse the
internet' + big data → also Snow (or Direct Connect if ongoing). If the scenario emphasizes
<em>recurring</em> transfers over an adequate link, Snow is the trap and DataSync is the answer.</div>

<p>Pricing shape: per-job service fee including 10 days on-site (Snowball Edge; Snowcone includes
fewer), then a per-day fee for extra days, plus shipping. Data transfer <em>into</em> S3 via Snow
is free; export jobs (S3 to device to you) bill per-GB. Long-term on-prem retention of a device is
a different product (order with 1-3 year pricing for persistent edge deployments).</p>
`
    },
    {
      id: "datasync",
      title: "DataSync: the managed rsync you stop maintaining",
      html: `
<p>You could do online file migration with rsync/rclone in a tmux session. Every senior engineer
has. DataSync is what you graduate to when the dataset has millions of files, the transfer must
survive restarts, someone asks for an audit trail, and 'Steve's script' becomes a bus-factor risk.
Mentally: <strong>a purpose-built, parallelized transfer engine with a control plane</strong> —
scheduling, retries, bandwidth throttling, inline integrity verification, incremental re-runs, and
CloudWatch metrics, sold per-GB.</p>

<h3>Topology</h3>
<ul>
<li><strong>Agent-based</strong>: a VM appliance (VMware/Hyper-V/KVM/EC2) deployed next to the source
for on-prem <strong>NFS, SMB, HDFS</strong>, and self-managed object storage. The agent reads
locally at LAN speed and pushes compressed, encrypted (TLS) traffic to the DataSync service endpoint
— over the internet, or over Direct Connect via VPC (PrivateLink) endpoints when the security team
requires private transit.</li>
<li><strong>Agentless</strong>: transfers <em>between</em> AWS storage services — S3 to S3 (including
<strong>cross-account and cross-region</strong>), EFS, FSx (Windows, Lustre, ONTAP, OpenZFS) — run
entirely on AWS-managed infrastructure. This is the sanctioned answer for 'copy a bucket to another
account/region with verification' when you do not want to hand-roll S3 Batch Operations or
sync scripts.</li>
<li><strong>Other clouds</strong>: agents can read Google Cloud Storage / Azure Blob (via their
object APIs) for cloud-to-cloud migrations.</li>
</ul>

<h3>Task mechanics that matter</h3>
<ul>
<li><strong>Locations + task</strong>: you define source and destination locations, then a task with
options. A task execution has phases: launching, preparing (listing/diffing both sides), transferring,
verifying.</li>
<li><strong>Incremental by design</strong>: re-running a task copies only new/changed files — the
preparing phase computes the delta. This is what makes seed-then-sync and scheduled replication
(hourly/daily cron built in) practical.</li>
<li><strong>Bandwidth throttling</strong> per task (set a bytes-per-second cap) so the migration
does not fight production traffic — and you can change it mid-execution.</li>
<li><strong>Filters</strong>: include/exclude patterns; <strong>metadata fidelity</strong>: preserves
POSIX permissions, ownership, timestamps to EFS/FSx, and stores them in S3 object metadata for
round-tripping.</li>
<li><strong>Verification modes</strong>: verify-everything (full checksum comparison after transfer),
verify-only-transferred, or none — a real trade-off, since full verification on a 100M-file share
adds hours of metadata scanning.</li>
</ul>

<div class="callout limits">Per-task working numbers: a single agent sustains up to ~10 Gbps; tasks
handle tens of millions of files but the preparing phase scales with file count, not byte count — a
50M-file share can spend longer listing than transferring. For huge namespaces, split into multiple
tasks by directory to parallelize (and to keep any single failure domain small). Throughput per task
also depends on file size distribution: many small files → IOPS-bound, few big files → bandwidth-bound.
Same physics as rsync, better parallelism.</div>

<div class="callout deep">Versus rsync-yourself, what you are actually buying: multi-threaded transfer
pipelines (rsync is essentially single-stream per invocation), automatic retry with checkpointing
inside a task execution, a purpose-built protocol more efficient than rsync-over-ssh for high-latency
links, IAM-integrated auth instead of stored keys, per-file CloudWatch logging for the auditors, and
no server on your side to patch. What you are not buying: it is not continuous replication (minimum
schedule interval is 1 hour; executions are discrete runs, not a change stream) and not a backup tool
(no point-in-time versioning of its own — pair with S3 versioning if you need that).</div>

<div class="callout exam">Keyword mapping: 'migrate NFS/SMB share to EFS/FSx/S3' → DataSync.
'ongoing scheduled transfers' / 'bandwidth throttling' / 'data validation required' → DataSync.
'cross-account S3 copy, managed, verified' → DataSync agentless. 'petabytes over a 100 Mbps link'
→ NOT DataSync (do the math; Snowball). 'continuous, sub-minute replication' → not DataSync either
— that is replication (S3 CRR, storage gateway, or DRS depending on layer). DataSync vs Storage
Gateway is a classic confusion pair: DataSync <em>moves</em> data (migration/sync jobs); File
Gateway <em>presents</em> S3 as an ongoing NFS/SMB interface with local cache. Migration → DataSync;
hybrid access after migration → File Gateway. They compose: DataSync to seed, File Gateway to serve.</div>

<div class="callout war">Failure modes seen in production: (1) Agent placed across a WAN from the
source share — the agent must be network-adjacent to the source or every metadata operation pays the
WAN RTT and the preparing phase takes days. (2) SMB shares with deep ACL trees: DataSync preserves
ACLs to FSx for Windows, but mismatched AD domain configuration between source and FSx surfaces as
permission chaos post-cutover; validate a subtree first. (3) Cost surprise: per-GB pricing (order of
a cent per GB) is trivial for 10 TB, real money at petabyte scale — at that point compare against
Snowball economics, which is exactly the comparison the exam wants you to make.</div>

<p>Pricing shape: flat per-GB transferred (plus the usual charges of what you write to — S3 PUTs,
EFS storage, and cross-region data transfer if applicable, and the EC2 instance cost if you host
the agent on EC2 for cloud-to-cloud). No per-agent or per-task fee. The cost lever is simply how
many bytes you move, which keeps the mental model clean.</p>
`
    },
    {
      id: "transfer-family",
      title: "Transfer Family: SFTP as a managed front door to S3",
      html: `
<p>The pattern this service exists for is decades old: <em>partners send us files</em>. Banks,
insurers, logistics, healthcare — the world runs on SFTP drops of CSVs at 2am. Pre-cloud, that meant
a DMZ server, an sftp daemon, local disk that fills, a cron to sweep files inward, and key management
by wiki page. <strong>AWS Transfer Family replaces the server with a managed, highly-available
protocol endpoint whose backing store is S3 or EFS.</strong> The partner still sees boring SFTP;
you see objects landing in a bucket, triggering EventBridge → Lambda/Step Functions pipelines.</p>

<h3>Protocols and endpoint types</h3>
<ul>
<li><strong>SFTP</strong> (SSH File Transfer Protocol) — the workhorse; the only one supported on
public endpoints with full feature parity. Also available as an SFTP <em>connector</em>: outbound —
AWS calls a partner's SFTP server to push/pull files, so you can retire the cron box that did that too.</li>
<li><strong>FTPS</strong> (FTP over TLS) — for partners stuck on legacy FTPS clients.</li>
<li><strong>FTP</strong> — plaintext; allowed only inside a VPC (never internet-facing), for
captive legacy systems you cannot fix.</li>
<li><strong>AS2</strong> — EDI B2B transfers with signing/encryption/MDN receipts (retail and
logistics supply chains). Niche but shows up as a keyword: 'AS2' → Transfer Family, full stop.</li>
</ul>
<p>Endpoints can be public (AWS-managed IPs, DNS via your own CNAME), VPC-hosted with internet-facing
Elastic IPs (so partners can allowlist <strong>static IPs</strong> — a very common partner-security
requirement plain public endpoints cannot meet), or VPC-internal only (private connectivity over
VPN/Direct Connect).</p>

<h3>Identity: the part that decides your architecture</h3>
<ul>
<li><strong>Service-managed</strong>: users + SSH public keys stored in the service. Fine for a
handful of partners.</li>
<li><strong>Directory-based</strong>: AWS Directory Service / AD for password auth against corporate
identity.</li>
<li><strong>Custom identity provider</strong>: a Lambda (or API Gateway) hook that receives the
username/password/key and returns an IAM role + home directory + policy. This is how you integrate
Okta, secrets in DynamoDB, per-partner rate rules — arbitrary logic.</li>
</ul>
<p>Each user maps to an IAM role and a <strong>home directory</strong> in S3/EFS. Logical home
directories chroot the partner into what looks like / but is actually a per-partner prefix — combine
with a session policy scoping the role to that prefix and partners cannot see each other exists.
Getting this scoping right is the whole security model; a shared role with bucket-wide access and
'they will only look at their folder' is the classic misconfiguration.</p>

<div class="callout exam">Keyword mapping is blunt here: 'partners require SFTP' / 'cannot change
the third party's process' / 'existing FTPS workflow' + 'store in S3' → Transfer Family. Distractors
will be an EC2 instance running OpenSSH (undifferentiated heavy lifting — wrong), S3 presigned URLs
(requires partner tooling change — wrong when the scenario says partners cannot change), and DataSync
(that is for migrations you drive, not partner-driven drops). 'Partners must allowlist a static IP'
→ VPC endpoint with Elastic IPs.</div>

<div class="callout deep">What happens on PUT: the protocol frontend streams the file and writes it
as an S3 object on close; S3 event notifications / EventBridge then fire your processing. Because the
backing store is S3, you inherit its semantics — no partial-file visibility (object appears only when
the upload completes, which is <em>better</em> than the old 'is the partner done writing yet?'
.tmp-rename dance), versioning if enabled, lifecycle policies, replication. With EFS backing you get
POSIX semantics instead — pick EFS when a downstream Linux fleet must consume files as a filesystem.
Also note managed workflows: Transfer Family can run a post-upload step sequence (copy, tag, decrypt
with PGP, invoke Lambda) natively, before your own pipeline even starts.</div>

<div class="callout limits">The number that surprises people: pricing is <strong>per protocol per
endpoint per hour</strong> (roughly 30 cents/hour → about 216 USD/month per protocol, always-on)
plus per-GB uploaded/downloaded. There is no scale-to-zero. For one partner sending one file a day,
this is expensive SFTP; the alternative (EC2 + EBS + your ops time) usually still loses, but presigned
URLs win when <em>you</em> control both ends. Throughput per session is bounded by SFTP protocol
overhead — parallel sessions scale fine, single-stream speed is what it is.</div>

<div class="callout war">Migration gotcha: partners hardcode host keys. When you move partners from
the old box to Transfer Family, import the existing server's SSH <strong>host key</strong> into the
Transfer server (supported precisely for this) or every partner's client will scream
man-in-the-middle and half of them will silently stop sending instead of calling you. Similarly,
keep the DNS cutover as a CNAME flip with the old server in read-only mode for a week — partner
retry behavior is folklore, not documentation.</div>

<p>When NOT to use it: internal app-to-app transfer inside AWS (use S3 APIs directly), user-facing
uploads from browsers (presigned URLs / CloudFront), high-volume streaming ingestion (Kinesis/Firehose),
or anything where you control both endpoints and can speak S3 natively. Transfer Family's entire value
is meeting an external party on a protocol you cannot change.</p>
`
    },
    {
      id: "dms-sct",
      title: "DMS + SCT: database migration and the licensing escape narrative",
      html: `
<p>Two tools, one program. <strong>SCT (Schema Conversion Tool)</strong> converts the <em>shape</em>
of a database — DDL, stored procedures, functions, types — between engines. <strong>DMS (Database
Migration Service)</strong> moves the <em>data</em> and keeps it moving via change data capture.
Homogeneous migration (Oracle to Oracle on RDS, MySQL to Aurora MySQL) needs only DMS — same engine,
schema moves with native tools. Heterogeneous migration (Oracle to Aurora PostgreSQL, SQL Server to
Aurora MySQL) needs SCT first, then DMS. That pairing is the single most-tested fact in this domain.</p>

<h3>DMS mechanics</h3>
<p>A DMS deployment is: a <strong>replication instance</strong> (an EC2 box DMS manages, sized by
you) or <strong>DMS Serverless</strong> (you set min/max capacity in DCUs and it scales the
replication compute itself — the right default for unpredictable or one-shot work), plus
<strong>source and target endpoints</strong>, plus a <strong>task</strong>. Tasks run in three modes:</p>
<ul>
<li><strong>Full load</strong> — bulk copy of existing rows, table by table, parallelized.</li>
<li><strong>CDC only</strong> — stream ongoing changes from the source's transaction log (Oracle
redo/LogMiner or Binary Reader, MySQL binlog, Postgres logical decoding, SQL Server transaction log).</li>
<li><strong>Full load + CDC</strong> — the migration workhorse: bulk copy while <em>simultaneously
capturing</em> changes that occur during the copy, then apply the buffered changes, then keep
tailing. This is what enables minimal-downtime cutover.</li>
</ul>

<h3>The minimal-downtime cutover, step by step</h3>
<ol>
<li>SCT converts schema to the target; you fix what it could not (see below). Create secondary
indexes and constraints <em>after</em> full load for speed, or let DMS handle basic DDL.</li>
<li>Start full load + CDC. Full load takes hours/days; CDC accumulates and applies deltas.</li>
<li>Watch <strong>replication lag (CDC latency)</strong> converge to seconds.</li>
<li>Cutover window: stop application writes, wait for lag = 0, validate (DMS has row-count and
data validation features), repoint connection strings (or flip DNS/Route 53), resume writes on the
target. Downtime = minutes, not the days a dump/restore needs.</li>
<li>Optionally run DMS in reverse (target → old source) as a rollback safety net for the first weeks.</li>
</ol>

<div class="callout deep">What SCT actually does with a heterogeneous conversion: it parses source
DDL and procedural code (PL/SQL, T-SQL) and emits target-dialect equivalents, producing an
<strong>assessment report</strong> that grades every object: converted automatically, converted with
warnings, or requires manual rework. The report is the real product — run it <em>before</em> you
commit to the migration, because a 500K-line PL/SQL estate with heavy use of Oracle-only features
(autonomous transactions, BFILEs, fine-grained audit) can turn 'migrate off Oracle' from a quarter
into a multi-year rewrite. For the gnarly cases AWS ships extension packs (emulation libraries on
the target) and, for Oracle→PostgreSQL specifically, Babelfish exists on the Aurora side for the
SQL Server equivalent problem.</div>

<h3>The licensing escape narrative (know it as a story)</h3>
<p>The exam's favorite scenario: a company pays Oracle or SQL Server enterprise licenses, wants out.
The canonical answer: <strong>SCT assessment → SCT schema conversion → DMS full load + CDC →
cutover to Aurora PostgreSQL (or MySQL)</strong>. Why Aurora specifically in the answers: no license
cost, engine-compatible target with managed HA, and the whole motivation of the scenario is
license-cost elimination — so any answer that lands on 'RDS for Oracle' (still licensed, or
license-included pricing) fails the stated goal. Watch for the reverse trap too: if the scenario says
'minimal changes, keep Oracle features' the answer is RDS for Oracle (homogeneous, no SCT), not
Aurora.</p>

<div class="callout limits">Task-sizing realities: the replication instance needs RAM proportional
to CDC transaction volume (long-running transactions on the source are buffered in memory/swap until
commit — a bulk UPDATE of 50M rows on the source can OOM an undersized instance mid-migration). LOB
columns are the other classic pain: full LOB mode is slow, limited LOB mode truncates beyond the max
size you set — you must know your largest LOB. Multi-AZ replication instances exist for CDC pipelines
that must survive AZ loss. Table-level parallelism, filters, and transformations (rename schemas,
drop columns) are per-task settings.</div>

<div class="callout war">Production scars: (1) DMS is not a schema-drift tool — DDL on the source
mid-migration (someone runs a release) has limited replication support per engine and has broken more
cutovers than hardware ever did; freeze DDL. (2) Validation is not optional at the senior level:
row counts match while data diverges (charset mangling, timezone-naive timestamps, numeric precision).
Run DMS data validation or a checksum pass before you burn the old database. (3) Triggers and
sequences: disable triggers on the target during load (or you double-fire logic), and re-sync
sequence values before cutover or your first insert post-cutover collides.</div>

<div class="callout exam">Mappings: 'different database engines' → SCT + DMS. 'same engine' → DMS
only (or native tooling). 'minimal downtime' → full load + CDC. 'continuous replication to keep a
copy in sync' (e.g., feeding a reporting replica or a data lake) → DMS CDC ongoing — DMS is legitimate
as a permanent replication pipe, not just a migration tool; S3 as a DMS target is the standard
'database to data lake' answer. 'unpredictable migration workload sizing' → DMS Serverless.</div>
`
    },
    {
      id: "mgn-discovery",
      title: "MGN, Discovery Service, Migration Hub, and VM Import/Export",
      html: `
<p><strong>Application Migration Service (MGN)</strong> is the rehost engine — the successor to
Server Migration Service (SMS, deprecated; if SMS appears as an answer option, it is a distractor)
and to the older CloudEndure branding. The mental model: <strong>continuous block-level replication
of your source disks into a cheap staging area, with on-demand conversion to native EC2 instances
at test or cutover time.</strong></p>

<h3>How MGN actually works</h3>
<ol>
<li>Install the <strong>replication agent</strong> on each source server (physical, VMware, Hyper-V,
other clouds — anything running a supported OS; there is also agentless snapshot-based replication
for vCenter when agents are forbidden). The agent replicates at the block device layer, beneath the
filesystem — databases, boot volumes, weird apps all come along.</li>
<li>Blocks stream (compressed, encrypted) into a <strong>staging area subnet</strong> in your VPC:
lightweight EC2 instances plus EBS volumes that receive and hold the replicated data. This is the
cost trick — staging uses small shared instances and low-cost volumes, so replicating 200 servers
does not mean running 200 full-size instances.</li>
<li>Replication is <strong>continuous</strong>: after the initial sync, only changed blocks stream,
so the staging copy stays seconds-to-minutes behind.</li>
<li><strong>Test launch</strong>: MGN converts the staged volumes (injects drivers, fixes bootloader,
applies the launch template: instance type, subnet, SG) and boots a test instance — without touching
the source or stopping replication. You validate the app actually boots in AWS. Do this weeks early.</li>
<li><strong>Cutover launch</strong>: brief source quiesce, final delta sync, launch the real
instance, repoint DNS/load balancers. Downtime is minutes. Post-cutover, you finalize and MGN tears
down staging resources for that server.</li>
</ol>

<div class="callout deep">The conversion step is the interesting engineering: a temporary conversion
server takes the raw replicated volumes and performs OS-level surgery — installing EC2/Nitro drivers
(ENA networking, NVMe storage), regenerating initramfs on Linux or injecting virtio/AWS drivers on
Windows, adjusting boot configuration — because a disk image built for VMware's virtual hardware will
not boot on Nitro unmodified. This is exactly the failure mode of naive 'copy the VMDK' migrations,
and it is why MGN test launches exist: driver surgery occasionally needs help (ancient kernels,
custom boot setups, software RAID on boot).</div>

<div class="callout exam">Keyword mapping: 'lift-and-shift' / 'rehost' / 'migrate servers with
minimal downtime and minimal changes' → MGN. 'block-level replication' → MGN. Contrast trio the exam
loves: <strong>MGN</strong> migrates live servers; <strong>VM Import/Export</strong> converts static
VM images (OVA/VMDK/VHD you already exported) into AMIs — no replication, no sync, fine for a
golden-image or a powered-off VM, wrong for a live server with changing data; <strong>DRS (Elastic
Disaster Recovery)</strong> is the same replication tech aimed at DR (covered in the HA/DR module).
And note the adjacent answer: 'migrate VMware fleet without converting anything' → VMware Cloud on
AWS (relocate), not MGN.</div>

<h3>Application Discovery Service: know before you move</h3>
<p>Two collection modes with very different depth:</p>
<ul>
<li><strong>Agentless collector</strong> (VMware appliance): inventories VMs via vCenter — specs,
utilization, no OS access needed. Breadth, fast, shallow: no process-level data, no network
dependency map.</li>
<li><strong>Agent-based</strong>: installed per server (Windows/Linux); collects running processes,
performance time series, and <strong>network connections</strong> — which is what lets you build the
dependency graph ('what breaks if I move this?'). Depth for the servers that matter.</li>
</ul>
<p>Data lands in <strong>Migration Hub</strong>, which is the aggregation and tracking layer: group
discovered servers into applications, see migration status across tools (MGN, DMS, partner tools
report into it), and pick a 'home region' where the tracking data lives. Migration Hub also does EC2
instance recommendations from the collected utilization data — right-size at migration time instead
of copying the on-prem overprovisioning. There is also a simple import path (CSV) when you already
have a CMDB and just want tracking.</p>

<div class="callout war">The dependency map is the deliverable that saves cutovers. Real estates are
full of app servers making calls to an IP that turns out to be a license server under a desk, NFS
mounts to a filer nobody documented, and hardcoded connections to systems in the 'retire' column.
Move an app before its dependencies and you learn about them at 3am. Run agent-based discovery on
anything business-critical for at least two full business cycles (month-end matters!) before
sequencing migration waves.</div>

<h3>VM Import/Export specifics</h3>
<p>CLI-driven (<code>aws ec2 import-image</code>): upload OVA/VHD/VMDK/raw to S3, ImportImage
converts to an AMI (driver injection similar to MGN's conversion, licensing options for Windows
BYOL vs license-included). Export works in reverse for instances that originally came from imports
(with restrictions — you cannot export AWS-born AMIs with AWS-provided Windows licenses). Use cases:
golden image portability, importing an appliance vendor's OVA, compliance-driven image escrow. For
fleet migration it lost to MGN: no delta sync means the image is stale the moment you export it.</p>

<div class="callout limits">Numbers worth holding: MGN replication agent supports the mainstream
OS list (recent-ish Windows Server and major Linux distros — very old OSes may need VM Import
instead); staging area cost is small EC2 + EBS per replicated server (order of a few dollars/month
per server — cheap enough to replicate for weeks before cutover); MGN itself is free for 2,090 hours
(~90 days) per server, after which it bills hourly per server — an incentive to actually finish
cutovers, and a real bill if a migration program stalls with 300 agents installed.</div>
`
    }
  ],
  quiz: [
    {
      q: "A company must move 500 TB of archived media from an on-premises NAS to Amazon S3 within 3 weeks. The site has a 100 Mbps internet connection shared with business traffic. What is the MOST feasible approach?",
      options: [
        "Use S3 Transfer Acceleration to speed up uploads over the existing link",
        "Order multiple Snowball Edge Storage Optimized devices, load them in parallel, and ship them to AWS",
        "Deploy a DataSync agent and schedule transfers with bandwidth throttling during off-hours",
        "Provision a 10 Gbps Direct Connect connection and stream the data"
      ],
      answer: [1],
      multi: false,
      explanation: "Do the math first: 500 TB at 100 Mbps full utilization is roughly 500 days — no online option over this link can meet 3 weeks. <strong>B</strong> is correct: ~7 Snowball Edge Storage Optimized devices (~80 TB usable each) loaded in parallel at LAN speed, with about a week door-to-door turnaround, fits the window. <strong>A</strong> accelerates long-haul TCP but cannot create bandwidth the link does not have — the 100 Mbps uplink is the bottleneck. <strong>C</strong> is the right tool for feasible online migrations, but throttling makes an already-impossible timeline worse. <strong>D</strong> fails on lead time: Direct Connect provisioning (cross-connects, telco circuits) typically takes weeks to months, and even at 10 Gbps the transfer itself needs ~5 days of full saturation."
    },
    {
      q: "A financial services firm receives nightly CSV files from 40 external partners who can only use SFTP with public-key authentication. Files must land in S3 and trigger a processing pipeline. Partners cannot change their tooling, and several require a static IP to allowlist. Which architecture fits?",
      options: [
        "An EC2 Auto Scaling group running OpenSSH with an EFS mount, synced to S3 by cron",
        "AWS Transfer Family SFTP server with a VPC endpoint and Elastic IPs, per-partner home directories in S3, and EventBridge triggering the pipeline",
        "S3 presigned URLs distributed to partners monthly, with S3 event notifications",
        "AWS DataSync agents deployed at each partner site targeting the S3 bucket"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> hits every requirement: Transfer Family speaks real SFTP (no partner change), a VPC-hosted endpoint with Elastic IPs provides static allowlistable addresses, logical home directories chroot each partner to their own S3 prefix, and uploads emit events for the pipeline. <strong>A</strong> works but is exactly the undifferentiated heavy lifting (patching, HA, key management, sweep scripts) the managed service eliminates — on the exam, self-managed SSH loses to Transfer Family when requirements match. <strong>C</strong> requires partners to change tooling from SFTP to HTTPS, which the scenario forbids. <strong>D</strong> misunderstands DataSync: it is a migration/sync engine you deploy on infrastructure you control, not a protocol endpoint for external partners — you cannot install agents in 40 partner networks."
    },
    {
      q: "A company is migrating a 4 TB Oracle database to Amazon Aurora PostgreSQL to eliminate licensing costs. The application can tolerate at most 30 minutes of downtime. Which sequence of steps is correct?",
      options: [
        "Use DMS full-load-plus-CDC to migrate the schema and data, then cut over when replication lag reaches zero",
        "Use the Schema Conversion Tool to convert the schema, run a DMS full load plus CDC task, monitor CDC latency, then cut over during a short write freeze",
        "Export with Oracle Data Pump, import into Aurora PostgreSQL, and replay archived redo logs to catch up",
        "Use the Schema Conversion Tool to convert both schema and data, then use DMS only to validate row counts"
      ],
      answer: [1],
      multi: false,
      explanation: "This is a heterogeneous migration (Oracle to PostgreSQL), so the schema must be converted by <strong>SCT</strong> first, then <strong>DMS full load + CDC</strong> copies existing data while capturing ongoing changes, and cutover happens in a brief write freeze once lag converges — minutes of downtime. <strong>A</strong> fails because DMS does not convert schemas between engines; it creates only minimal target tables, and Oracle DDL/PLSQL will not run on PostgreSQL — SCT is mandatory for heterogeneous moves. <strong>C</strong> is wrong twice: Data Pump exports cannot be imported into PostgreSQL, and redo logs are Oracle-format. <strong>D</strong> inverts the tools — SCT converts schemas, not data; DMS moves data, and its validation feature is a complement, not the migration."
    },
    {
      q: "An enterprise plans to migrate 300 on-premises VMware servers to AWS within 6 months with minimal per-application changes. Leadership also wants a dependency map before scheduling migration waves, and progress tracking across teams. Which combination of services should they use? (Select TWO.)",
      options: [
        "AWS Application Migration Service for block-level replication and cutover",
        "AWS Server Migration Service for incremental AMI replication",
        "Application Discovery Service agents feeding Migration Hub for dependency mapping and tracking",
        "VM Import/Export to convert exported OVAs into AMIs",
        "AWS DataSync to replicate the servers' disks to EBS"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "This is a rehost program: <strong>A</strong> (MGN) is the current-generation rehost tool — continuous block-level replication, test launches, minutes-of-downtime cutover at fleet scale. <strong>C</strong> provides the requested dependency map (agent-based discovery captures network connections) and Migration Hub aggregates status across waves. <strong>B</strong> is the trap: SMS is deprecated and superseded by MGN — it appears in options precisely to test whether you know that. <strong>D</strong> converts static images with no ongoing sync; for 300 live servers the images would be stale before cutover. <strong>E</strong> misuses DataSync, which transfers file/object data between storage systems, not bootable server volumes."
    },
    {
      q: "A media company needs to copy 60 TB of files from an on-premises NFS array to Amazon EFS over an existing 1 Gbps Direct Connect link. The copy must preserve POSIX permissions, verify data integrity, avoid saturating the link during business hours, and re-run weekly to pick up changes until final cutover. Which solution meets all requirements with the least operational effort?",
      options: [
        "Schedule rsync over SSH from a bastion host to an EC2 instance mounting the EFS filesystem",
        "Use AWS DataSync with an on-premises agent, a bandwidth limit, a weekly schedule, and verification enabled",
        "Order a Snowball Edge device weekly and ship deltas to AWS",
        "Use S3 Transfer Acceleration to upload to S3, then copy the objects to EFS with Lambda"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is purpose-built for every stated requirement: agent reads NFS locally, per-task bandwidth throttling protects business hours, built-in scheduling handles the weekly re-run, incremental transfers copy only changes, verification is a checkbox, and POSIX metadata is preserved to EFS. 60 TB over 1 Gbps is ~6 days at full rate — feasible online, so shipping is unnecessary. <strong>A</strong> can be made to work but fails 'least operational effort': single-stream rsync throughput, hand-rolled scheduling/retries/verification, and a bastion to maintain. <strong>C</strong> misapplies Snow — weekly physical shipping for deltas over an adequate link is slower and operationally absurd. <strong>D</strong> adds an S3 detour, loses POSIX permissions in translation, and Transfer Acceleration does not apply to a private Direct Connect path anyway."
    },
    {
      q: "A research vessel operates offshore for 3-month stretches with no reliable connectivity. Onboard sensors generate about 2 TB of data per week that must be preprocessed with an ML model at sea, with results and raw data delivered to S3 after each voyage. Which solution fits?",
      options: [
        "AWS Snowcone devices with DataSync agents for continuous satellite upload",
        "A Snowball Edge Compute Optimized device running EC2 instances for onboard inference, shipped back after each voyage",
        "AWS Outposts installed on the vessel connected via VPN",
        "Store data on ruggedized USB drives and upload via S3 Transfer Acceleration in port"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> matches the profile exactly: Snowball Edge Compute Optimized runs EC2 AMIs (optionally with GPU) fully disconnected for the ML preprocessing, holds ~26 TB of a 3-month voyage's data, and the ship-back path handles ingestion to S3. <strong>A</strong> fails on both capacity (8-14 TB per Snowcone against ~26 TB per voyage) and the premise — 'no reliable connectivity' rules out continuous upload, and Snowcone's 2 vCPUs are inadequate for ML inference. <strong>C</strong> is wrong because Outposts requires a persistent network path back to its home region for its control plane — it is not designed for long fully-disconnected operation. <strong>D</strong> abandons the at-sea processing requirement and adds a manual, unencrypted, unverifiable transport step."
    },
    {
      q: "A company runs a self-managed MySQL 8 database on EC2 and wants to move it to Amazon Aurora MySQL with minimal downtime. What is the SIMPLEST approach that meets the requirement?",
      options: [
        "Use the Schema Conversion Tool to convert the schema, then run a DMS full-load task",
        "Take a snapshot-based backup, restore it to Aurora, and use binlog replication or a DMS CDC-only task to catch up before cutover",
        "Use DataSync to copy the MySQL data directory to the Aurora cluster volume",
        "Export to CSV with mysqldump and import with LOAD DATA, accepting a maintenance window"
      ],
      answer: [1],
      multi: false,
      explanation: "This is a homogeneous migration — same engine family — so no schema conversion is needed and native tooling is simplest: restore a backup (Percona XtraBackup restore or snapshot-based path into Aurora) for the bulk, then replicate changes (native binlog replication, or DMS CDC-only) until cutover, giving minutes of downtime. <strong>A</strong> is the classic trap: SCT is for heterogeneous migrations; MySQL to Aurora MySQL needs no conversion, and full load without CDC means downtime for the entire copy. <strong>C</strong> is nonsensical — Aurora's storage volume is not a filesystem target you can copy InnoDB files into; DataSync moves file/object data between storage services. <strong>D</strong> works but fails 'minimal downtime' — a 'maintenance window' for a full logical dump and reload of a production database is exactly what the requirement excludes."
    },
    {
      q: "During a lift-and-shift migration with AWS Application Migration Service, a migration engineer wants to confirm that a critical ERP server will boot and function correctly on EC2 without affecting the production source server or interrupting replication. What should the engineer do?",
      options: [
        "Perform a cutover launch during a maintenance window and roll back if it fails",
        "Use MGN to perform a test launch, validate the instance, then terminate the test instance while replication continues",
        "Stop the source server, take a final sync, and launch the instance to verify it boots",
        "Export the server as an OVA and use VM Import to create a trial AMI"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is exactly what MGN test launches are for: MGN converts the staged replica volumes (driver injection, boot fixes) and boots a test instance in an isolated launch template configuration while the source keeps running and block replication continues uninterrupted. Test early, terminate, iterate. <strong>A</strong> confuses test with cutover — cutover is the production event; using it as a test risks the exact disruption the engineer must avoid. <strong>C</strong> stops production, which violates the requirement outright. <strong>D</strong> tests a stale, separately-converted image through a different conversion pipeline — passing or failing it tells you little about what MGN's cutover will produce, and it adds days of manual work."
    },
    {
      q: "A company needs to copy 30 TB of objects from an S3 bucket in one AWS account to a bucket in a different account in another Region. The copy must be verified, repeatable for weekly deltas until cutover, and require no self-managed infrastructure. Which option is BEST?",
      options: [
        "Run aws s3 sync on a large EC2 instance with cross-account credentials",
        "Configure S3 Cross-Region Replication between the buckets",
        "Use an agentless DataSync task between the two S3 locations with a weekly schedule and verification",
        "Use S3 Batch Operations with a manifest generated weekly by S3 Inventory"
      ],
      answer: [2],
      multi: false,
      explanation: "<strong>C</strong> is the managed fit: DataSync supports S3-to-S3 transfers cross-account and cross-region with no agent (runs on AWS infrastructure), computes deltas on each scheduled run, and performs integrity verification — no infrastructure to run. <strong>A</strong> works but is self-managed infrastructure (the EC2 instance, retry logic, verification scripting) — excluded by the requirements. <strong>B</strong> is the strongest distractor: CRR replicates <em>new</em> objects going forward and existing objects only via a separately-initiated S3 Batch Replication job; it is a live replication configuration, not a verified scheduled copy job, and cross-account CRR setup plus the retroactive-copy caveat make it the wrong shape for a migration with weekly reconciliation. <strong>D</strong> can copy objects but you own the orchestration: generating manifests, diffing inventories for deltas, and verification are all manual assembly."
    },
    {
      q: "A global genomics company has field laboratories on five continents that each upload 200-500 GB daily to a single S3 bucket in us-east-1 using existing S3 API integrations. Labs on other continents report slow, unreliable uploads. Which change improves upload performance with the LEAST modification?",
      options: [
        "Enable S3 Transfer Acceleration on the bucket and switch uploads to the acceleration endpoint",
        "Deploy DataSync agents at each laboratory targeting the bucket",
        "Create regional buckets on each continent with Cross-Region Replication to us-east-1",
        "Ship Snowcone devices from each laboratory weekly"
      ],
      answer: [0],
      multi: false,
      explanation: "<strong>A</strong> is the textbook Transfer Acceleration case: many geographically distant clients, one distant bucket, existing S3 API code — the only change is the endpoint hostname, and uploads enter at the nearest edge location and ride the AWS backbone, fixing exactly the long-haul TCP problems described. It also only charges when it actually accelerates. <strong>B</strong> means deploying and operating VM appliances at five field labs and restructuring uploads into DataSync tasks — far more modification, aimed at file-share migration rather than app-integrated S3 uploads. <strong>C</strong> works but is a significant architecture change (multiple buckets, replication config, application logic to pick a bucket, doubled storage during replication) versus a hostname swap. <strong>D</strong> trades daily online uploads of a feasible size for weekly physical logistics — the link can carry 500 GB/day; shipping adds latency, not value."
    },
    {
      q: "A DMS full-load-plus-CDC task migrating a busy Oracle OLTP database keeps failing mid-migration, and the replication instance shows memory exhaustion during large batch updates on the source. CDC latency also spikes for hours afterward. Which TWO actions most directly address the problem? (Select TWO.)",
      options: [
        "Resize to a larger replication instance or switch to DMS Serverless with a higher maximum capacity",
        "Enable Multi-AZ on the replication instance",
        "Coordinate with the source team to avoid huge long-running transactions during migration, or split them into smaller batches",
        "Move the target to a larger Aurora instance class",
        "Switch the task from full-load-plus-CDC to full-load-only"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "DMS buffers in-flight source transactions on the replication instance until they commit, so giant batch updates inflate memory and stall the change stream. <strong>A</strong> attacks capacity: more RAM (or Serverless scaling headroom) absorbs the transaction buffering. <strong>C</strong> attacks the cause: smaller, shorter transactions on the source shrink what DMS must buffer and let CDC apply changes continuously. <strong>B</strong> improves availability of the replication instance but a standby has the same memory profile — it does nothing for exhaustion. <strong>D</strong> addresses target-side apply throughput, which is not the diagnosed bottleneck (memory on the replication instance during capture). <strong>E</strong> abandons the minimal-downtime requirement entirely — without CDC you would need a write freeze for the whole load."
    },
    {
      q: "An enterprise is closing a data center in 10 months. Discovery shows: 600 general-purpose VMs, a heavily customized Oracle ERP with deep PL/SQL logic, an unused reporting system with no logins in 14 months, and an email platform the company wants to stop operating entirely. Which migration strategy mapping is MOST appropriate?",
      options: [
        "Refactor the 600 VMs to containers, rehost the ERP, retire the email platform, retain the reporting system",
        "Rehost the 600 VMs with MGN, replatform or retain the ERP pending an SCT assessment, retire the reporting system, repurchase SaaS for email",
        "Relocate everything with VMware Cloud on AWS, including retirement candidates, and optimize later",
        "Rehost the 600 VMs, refactor the ERP to Aurora before the deadline, retire both the reporting system and the email platform"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> matches effort to value under a deadline: MGN rehosts the undifferentiated bulk on schedule; the customized PL/SQL-heavy ERP is exactly the workload where an SCT assessment must precede any conversion commitment (deep PL/SQL can make refactor a multi-year effort — so replatform to RDS for Oracle, or retain temporarily, is the defensible call); 14 months of no logins is the retire signal; 'stop operating email entirely' is the textbook repurchase-to-SaaS. <strong>A</strong> inverts effort: containerizing 600 generic VMs under a lease deadline is the classic refactor-during-migration anti-pattern, and retaining a dead reporting system wastes the easiest win. <strong>C</strong> pays to move workloads that should be deleted, and relocate assumes VMware skills/licensing are the constraint, which the scenario never states. <strong>D</strong> commits to an Oracle-to-Aurora refactor of a heavily customized ERP inside 10 months while also running a 600-VM rehost — schedule fiction the SCT assessment step exists to prevent."
    },
    {
      q: "A logistics company must exchange EDI documents with retail trading partners using the AS2 protocol with signed MDN receipts, storing payloads in S3. What should they implement?",
      options: [
        "AWS Transfer Family with the AS2 protocol",
        "Amazon API Gateway with a Lambda authorizer implementing AS2 semantics",
        "AWS DataSync with a custom EDI translation layer",
        "An Amazon MQ broker bridged to S3 via Lambda"
      ],
      answer: [0],
      multi: false,
      explanation: "AS2 is a first-class Transfer Family protocol, built for exactly this B2B EDI pattern: message signing, encryption, and MDN receipt handling, with payloads landing in S3 — <strong>A</strong>. <strong>B</strong> would mean hand-implementing the AS2 specification (MIME, S/MIME signing, MDN dispositions) on API Gateway — an enormous, error-prone build for something managed off the shelf. <strong>C</strong> misreads DataSync, which transfers storage data and speaks no partner-facing protocol. <strong>D</strong> is message-queue infrastructure; trading partners speak AS2 over HTTP, not AMQP/MQTT, and no MDN semantics exist there. On the exam, the keyword 'AS2' maps to Transfer Family with essentially no competition."
    },
    {
      q: "A company wants a nightly copy of changes from its production on-premises SQL Server database into an S3 data lake in Parquet-friendly form for analytics, ongoing indefinitely, without impacting the production schema. Which service is designed for this?",
      options: [
        "AWS DataSync with a nightly schedule against the database's data files",
        "AWS DMS with the database as source, S3 as target, running an ongoing CDC replication task",
        "AWS Application Migration Service replicating the database server's volumes",
        "AWS Transfer Family pulling nightly exports via an SFTP connector"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong>: DMS is not only a migration tool — S3 is a fully supported DMS target, and an ongoing CDC task streams committed changes from the SQL Server transaction log into S3 files (CSV/Parquet) continuously, the standard 'database to data lake' pipeline with no source schema changes. <strong>A</strong> fails structurally: DataSync copies files, and copying live MDF/LDF database files produces crash-inconsistent garbage, not usable change data. <strong>C</strong> replicates block devices for server rehosting — it yields a bootable server replica, not queryable change records in S3. <strong>D</strong> presupposes some other process creates nightly export files; the connector only moves files that already exist, so it does not solve the actual problem of extracting changes."
    }
  ],
  flashcards: [
    { front: "List the 7 Rs of migration.", back: "<strong>Rehost</strong> (lift-and-shift, MGN), <strong>Replatform</strong> (lift-tinker-shift, e.g., to RDS), <strong>Repurchase</strong> (move to SaaS), <strong>Refactor</strong> (re-architect cloud-native), <strong>Relocate</strong> (hypervisor-level, VMware Cloud on AWS), <strong>Retain</strong> (leave for now), <strong>Retire</strong> (decommission)." },
    { front: "Transfer time formula for migration planning?", back: "time = data_size / (bandwidth x utilization). Rule of thumb: <strong>1 TB over 100 Mbps ≈ 1 day</strong> at full utilization; plan for 50-80% on dedicated links, less on shared ones." },
    { front: "500 TB, 100 Mbps link, 2-week deadline — what is the answer and why?", back: "Snowball Edge Storage Optimized devices in parallel. 500 TB at 100 Mbps ≈ 500 days online — infeasible. ~7 devices at ~80 TB each, ~1 week turnaround. Direct Connect fails on provisioning lead time." },
    { front: "Snowcone capacity and differentiators?", back: "8 TB HDD (14 TB SSD variant), 2 vCPU / 4 GB RAM, ~2.1 kg, USB-C power. For small/portable/harsh edge sites. Can run a DataSync agent for online sync or be shipped back." },
    { front: "Snowball Edge Storage Optimized vs Compute Optimized?", back: "<strong>Storage Optimized</strong>: ~80 TB usable (210 TB migration variant), bulk data moves. <strong>Compute Optimized</strong>: ~28 TB NVMe but up to 104 vCPU / 416 GB RAM + optional GPU — run EC2/Lambda at disconnected edge sites." },
    { front: "How are Snow device data and keys protected?", back: "256-bit encryption with KMS keys that never persist on the device; unlock requires manifest + 25-char code delivered separately from the hardware; tamper-evident enclosure; NIST 800-88 erasure after ingest." },
    { front: "When does S3 Transfer Acceleration actually help, and how does it work?", back: "Clients far from the bucket region uploading over long-haul internet. Uploads terminate at the nearest CloudFront edge (low RTT = fast TCP ramp), then ride the AWS backbone. No benefit for nearby clients — and it only bills when it accelerates." },
    { front: "DataSync: which sources need an agent, and which transfers are agentless?", back: "Agent (VM appliance) for on-prem NFS, SMB, HDFS, self-managed object stores, and other clouds. Agentless for AWS-to-AWS: S3↔S3 (cross-account/cross-region), EFS, FSx family." },
    { front: "Four DataSync features that beat hand-rolled rsync?", back: "Built-in scheduling (min 1 hour), per-task bandwidth throttling, inline integrity verification, incremental delta-only re-runs — plus IAM auth, CloudWatch metrics/logs, and no server to maintain. Priced per GB." },
    { front: "DataSync vs Storage Gateway (File Gateway)?", back: "DataSync <strong>moves</strong> data: discrete migration/sync jobs. File Gateway <strong>presents</strong> S3 as ongoing NFS/SMB with local cache for hybrid access. Migrate with DataSync; serve afterwards with File Gateway." },
    { front: "Transfer Family: protocols and backing stores?", back: "SFTP, FTPS, FTP (VPC-only, plaintext), and AS2 (EDI with MDN receipts) in front of <strong>S3 or EFS</strong>. SFTP connectors additionally push/pull against external SFTP servers." },
    { front: "How do partners get a static allowlistable IP on Transfer Family?", back: "Host the endpoint in a VPC (internet-facing) and attach Elastic IPs. Plain public endpoints have AWS-managed, non-static addresses." },
    { front: "Transfer Family pricing shape and its gotcha?", back: "Per protocol per endpoint <strong>per hour</strong> (~216 USD/month always-on) plus per-GB transferred. No scale-to-zero — expensive for one tiny file a day, still usually cheaper than self-managed ops." },
    { front: "Homogeneous vs heterogeneous DB migration — which tools?", back: "Same engine: DMS alone (or native backup/replication). Different engines: <strong>SCT converts the schema and code first</strong>, then DMS moves the data. SCT-then-DMS is the heterogeneous signature." },
    { front: "The three DMS task modes?", back: "<strong>Full load</strong> (bulk copy), <strong>CDC only</strong> (stream tx-log changes), <strong>Full load + CDC</strong> (bulk copy while capturing concurrent changes, then apply and keep tailing) — the minimal-downtime migration mode." },
    { front: "How does DMS achieve minimal-downtime cutover?", back: "Full load + CDC runs until CDC latency ≈ 0; then a brief write freeze, final delta apply, validation, repoint connection strings. Downtime is minutes. Optionally reverse-replicate for rollback." },
    { front: "Why do large source transactions OOM a DMS replication instance?", back: "DMS buffers uncommitted transaction changes on the replication instance until commit. A 50M-row batch UPDATE inflates memory; fix by right-sizing the instance (or DMS Serverless max capacity) and splitting source batches." },
    { front: "What is DMS Serverless?", back: "DMS where replication capacity auto-scales between min/max DCUs you set — no replication instance sizing. Default choice for unpredictable or one-off migrations." },
    { front: "The Oracle-to-Aurora licensing-escape pattern?", back: "SCT assessment report (grades conversion difficulty) → SCT converts schema/PLSQL → DMS full load + CDC → cutover to Aurora PostgreSQL. Motivation: eliminate license spend; RDS for Oracle answers fail that goal." },
    { front: "MGN vs VM Import/Export vs the deprecated SMS?", back: "<strong>MGN</strong>: continuous block-level replication of live servers, test launches, minutes-downtime cutover — the rehost standard. <strong>VM Import/Export</strong>: one-shot conversion of static OVA/VMDK/VHD images to AMIs, no sync. <strong>SMS</strong>: deprecated predecessor — always a distractor." },
    { front: "What happens during an MGN launch (test or cutover)?", back: "A conversion step turns staged volumes into bootable EC2: injects ENA/NVMe (Nitro) drivers, fixes bootloader/initramfs, applies the launch template. Test launches do this without touching the source or pausing replication." },
    { front: "MGN cost model?", back: "Free per server for 2,090 hours (~90 days), then hourly per server; plus small staging-area EC2/EBS costs during replication. Stalled migration programs with agents installed accumulate real charges." },
    { front: "Application Discovery Service: agentless vs agent-based?", back: "<strong>Agentless</strong> (vCenter appliance): VM inventory + utilization, no OS access, no dependencies. <strong>Agent-based</strong>: processes, perf time series, and network connections — enables the dependency map. Both feed Migration Hub." },
    { front: "What does Migration Hub add on top of discovery?", back: "Single pane: group servers into applications, track migration status across MGN/DMS/partner tools in a chosen home region, EC2 right-sizing recommendations from collected utilization, CSV import for existing CMDBs." },
    { front: "Which transfer directions cost money on AWS?", back: "Data <strong>in</strong> is free on every path (internet, DataSync, Snow import, Transfer Family upload fees aside). Data <strong>out</strong> (egress, Snow export jobs, cross-region) is billed — migration cost planning is about time; steady-state cost planning is about egress." }
  ],
  lab: {
    title: "Lab: verified cross-bucket migration with DataSync (agentless)",
    html: `
<h3>Goal</h3>
<p>Run a real, verified, incremental DataSync task between two S3 buckets — the agentless pattern
used for cross-account/cross-region migrations — and observe the preparing/transferring/verifying
phases and the delta behavior on re-run. Cost: pennies (DataSync bills ~1.25 cents per GB; we move
megabytes).</p>

<h3>Architecture</h3>
<p>Two S3 buckets in the same account and region (the mechanics are identical cross-account — only
the destination bucket policy and location role differ). One IAM role that DataSync assumes to read
the source and write the destination. One task with verification enabled. No agent — S3-to-S3 runs
on AWS-managed infrastructure.</p>

<h3>Steps</h3>
<ol>
<li><p>Create the buckets and seed the source with a few files (unique suffix avoids name
collisions):</p>
<pre><code>SUFFIX=$(date +%s)
aws s3 mb s3://ds-lab-src-$SUFFIX
aws s3 mb s3://ds-lab-dst-$SUFFIX
mkdir -p /tmp/ds-lab &amp;&amp; cd /tmp/ds-lab
for i in 1 2 3 4 5; do dd if=/dev/urandom of=file$i.bin bs=1M count=5; done
aws s3 cp . s3://ds-lab-src-$SUFFIX/data/ --recursive</code></pre></li>
<li><p>Create the IAM role DataSync will assume. Trust policy (save as
<code>trust.json</code>):</p>
<pre><code>{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "datasync.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}</code></pre>
<pre><code>aws iam create-role --role-name ds-lab-role \
  --assume-role-policy-document file://trust.json
aws iam put-role-policy --role-name ds-lab-role --policy-name s3access \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      { "Effect": "Allow",
        "Action": ["s3:GetBucketLocation","s3:ListBucket","s3:ListBucketMultipartUploads"],
        "Resource": "*" },
      { "Effect": "Allow",
        "Action": ["s3:GetObject","s3:PutObject","s3:AbortMultipartUpload",
                   "s3:DeleteObject","s3:GetObjectTagging","s3:PutObjectTagging",
                   "s3:ListMultipartUploadParts"],
        "Resource": "*" }
    ]
  }'</code></pre>
<p>(Broad resource scope for lab brevity; in production scope to the two bucket ARNs. In a
cross-account migration, the destination location's role lives with the destination and the source
bucket policy grants it access.)</p></li>
<li><p>Create the two locations and the task (wait ~10s after role creation for IAM propagation):</p>
<pre><code>ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN=arn:aws:iam::$ACCOUNT:role/ds-lab-role
SRC_LOC=$(aws datasync create-location-s3 \
  --s3-bucket-arn arn:aws:s3:::ds-lab-src-$SUFFIX \
  --s3-config BucketAccessRoleArn=$ROLE_ARN \
  --query LocationArn --output text)
DST_LOC=$(aws datasync create-location-s3 \
  --s3-bucket-arn arn:aws:s3:::ds-lab-dst-$SUFFIX \
  --s3-config BucketAccessRoleArn=$ROLE_ARN \
  --query LocationArn --output text)
TASK_ARN=$(aws datasync create-task \
  --source-location-arn $SRC_LOC \
  --destination-location-arn $DST_LOC \
  --name ds-lab-task \
  --options VerifyMode=POINT_IN_TIME_CONSISTENT,OverwriteMode=ALWAYS,TransferMode=CHANGED \
  --query TaskArn --output text)</code></pre>
<p>Note <code>TransferMode=CHANGED</code> — this is the incremental behavior — and the
verification mode, which is the checkbox that replaces your hand-rolled checksum scripts.</p></li>
<li><p>Execute and watch the phases:</p>
<pre><code>EXEC_ARN=$(aws datasync start-task-execution --task-arn $TASK_ARN \
  --query TaskExecutionArn --output text)
watch -n 5 "aws datasync describe-task-execution --task-execution-arn $EXEC_ARN \
  --query '{Status:Status,Files:FilesTransferred,Bytes:BytesTransferred}'"</code></pre>
<p>You will see LAUNCHING → PREPARING (listing both sides, computing the delta) → TRANSFERRING →
VERIFYING → SUCCESS.</p></li>
</ol>

<h3>Verify</h3>
<ol>
<li><p>Contents match:</p>
<pre><code>aws s3 ls s3://ds-lab-dst-$SUFFIX/data/ --recursive</code></pre></li>
<li><p>Prove incrementality — add one file, re-run, and confirm only 1 file transfers:</p>
<pre><code>dd if=/dev/urandom of=/tmp/ds-lab/file6.bin bs=1M count=5
aws s3 cp /tmp/ds-lab/file6.bin s3://ds-lab-src-$SUFFIX/data/
EXEC2=$(aws datasync start-task-execution --task-arn $TASK_ARN \
  --query TaskExecutionArn --output text)
# when finished:
aws datasync describe-task-execution --task-execution-arn $EXEC2 \
  --query '{Status:Status,FilesTransferred:FilesTransferred}'</code></pre>
<p><code>FilesTransferred</code> should be 1 — the preparing phase diffed the namespaces and moved
only the delta. This is seed-then-sync in miniature.</p></li>
</ol>

<h3>Teardown</h3>
<p>Ordered so nothing is left billing (DataSync resources are free at rest, but buckets and the
role should go):</p>
<ol>
<li><pre><code>aws datasync delete-task --task-arn $TASK_ARN
aws datasync delete-location --location-arn $SRC_LOC
aws datasync delete-location --location-arn $DST_LOC</code></pre></li>
<li><pre><code>aws s3 rb s3://ds-lab-src-$SUFFIX --force
aws s3 rb s3://ds-lab-dst-$SUFFIX --force</code></pre></li>
<li><pre><code>aws iam delete-role-policy --role-name ds-lab-role --policy-name s3access
aws iam delete-role --role-name ds-lab-role
rm -rf /tmp/ds-lab</code></pre></li>
<li><p>Confirm nothing remains:</p>
<pre><code>aws datasync list-tasks
aws s3 ls | grep ds-lab || echo clean</code></pre></li>
</ol>
`
  }
});
