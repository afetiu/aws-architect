window.COURSE.register({
  id: "block-file",
  order: 7,
  track: "saa",
  title: "EBS, EFS, FSx & Storage Gateway",
  description: "Block and file storage from the inside out: EBS performance math and failure domains, snapshot mechanics and encryption workflows, EFS internals, the FSx family decision matrix, and Storage Gateway hybrid patterns — plus the block-vs-file-vs-object framework the exam leans on constantly.",
  examWeight: "Heavy. Storage selection questions appear on nearly every SAA-C03 form: gp3-vs-io2-vs-st1 math, the encrypt-an-existing-volume workflow, EFS-vs-FSx-vs-EBS selection, the four FSx flavors as keyword matches, and Storage Gateway modes for hybrid scenarios.",
  lessons: [
    {
      id: "ebs-volume-types",
      title: "EBS volume types and the performance math",
      html: `
<p>Start with the mental model: an <strong>EBS volume is a network-attached SAN LUN, not a local disk</strong>. Your EC2 instance talks to it over a dedicated storage fabric (on Nitro instances it is presented as an NVMe device, but the NVMe controller is a facade over the network). That framing predicts almost everything: latency is single-digit milliseconds rather than microseconds, per-instance bandwidth to EBS is a separate quota from network bandwidth ("EBS-optimized" throughput, e.g. an m5.large caps at 4,750 Mbps), and the volume survives instance termination because it never lived in the box. The thing that actually behaves like a local disk is <strong>instance store</strong> — physically attached NVMe, microsecond latency, and gone when the instance stops.</p>

<h3>The three axes: IOPS, throughput, latency</h3>
<p>Every EBS selection question decomposes into three numbers you already reason about with any storage array: <strong>IOPS</strong> (small random operations per second — OLTP databases), <strong>throughput</strong> (MB/s of large sequential transfer — log processing, ETL, media), and <strong>latency</strong> (per-operation, which matters when a database commit blocks on fsync). The volume families each optimize one axis:</p>

<table>
<thead><tr><th>Type</th><th>Baseline</th><th>Max</th><th>Optimizes</th><th>Boot?</th><th>Price shape</th></tr></thead>
<tbody>
<tr><td><strong>gp3</strong></td><td>3,000 IOPS / 125 MBps regardless of size</td><td>16,000 IOPS / 1,000 MBps</td><td>General purpose</td><td>Yes</td><td>Per GiB + per provisioned IOPS/MBps above baseline</td></tr>
<tr><td><strong>gp2</strong> (legacy)</td><td>3 IOPS per GiB (min 100)</td><td>16,000 IOPS, burst to 3,000</td><td>General purpose</td><td>Yes</td><td>Per GiB only — IOPS come from size</td></tr>
<tr><td><strong>io1 / io2</strong></td><td>What you provision</td><td>64,000 IOPS (io2 Block Express: 256,000 IOPS / 4,000 MBps)</td><td>IOPS + latency</td><td>Yes</td><td>Per GiB + per provisioned IOPS (tiered on io2)</td></tr>
<tr><td><strong>st1</strong></td><td>40 MBps per TiB</td><td>500 MBps (burst 250 MBps/TiB)</td><td>Cheap sequential throughput</td><td>No</td><td>Per GiB (~45% of gp3)</td></tr>
<tr><td><strong>sc1</strong></td><td>12 MBps per TiB</td><td>250 MBps (burst 80 MBps/TiB)</td><td>Cheapest cold block</td><td>No</td><td>Per GiB (cheapest block storage)</td></tr>
</tbody>
</table>

<h3>gp3: decoupled and predictable</h3>
<p>gp3 gives every volume — a 1 GiB volume included — <strong>3,000 IOPS and 125 MBps baseline</strong>, and lets you buy more of either dimension independently, up to <strong>16,000 IOPS and 1,000 MBps</strong>. The only coupling left is a ratio cap of <strong>500 IOPS per GiB</strong> (so 16,000 IOPS needs at least 32 GiB) and 0.25 MBps per provisioned IOPS for throughput. This decoupling is the entire point: on gp2 you bought IOPS by buying capacity; on gp3 a 100 GiB volume can have 10,000 IOPS without paying for 3,334 GiB of space you don't need. gp3 is also ~20% cheaper per GiB than gp2. There is essentially no remaining reason to create new gp2 volumes.</p>

<h3>gp2: the burst-credit trap</h3>
<p>gp2 is worth understanding because it still runs half the internet's forgotten volumes and because the exam loves its failure mode. Baseline is <strong>3 IOPS per GiB</strong> (minimum 100). Volumes under 1,000 GiB can <strong>burst to 3,000 IOPS</strong> using a credit bucket: the bucket holds <strong>5.4 million credits</strong>, starts full, refills at the baseline rate, and drains at (actual − baseline) IOPS. Run the math for a 100 GiB volume: baseline 300 IOPS, so a sustained 3,000-IOPS workload drains 2,700 credits/sec — the bucket empties in 5,400,000 / 2,700 = 2,000 seconds, about <strong>33 minutes</strong>. Then the volume hard-drops to 300 IOPS and your database falls over. This is the classic "worked fine in testing, died under sustained load" incident. At 1,000 GiB baseline equals the 3,000 burst ceiling, and at 5,334 GiB you reach the 16,000 IOPS max.</p>

<div class="callout war">The gp2 credit crash presents as a sudden latency cliff 30–60 minutes into a batch job or traffic spike, with no errors — just I/O wait climbing. Check the <code>BurstBalance</code> CloudWatch metric before blaming the database. The fix in 2026 is a one-line elastic-volume modification to gp3, done live, no detach.</div>

<h3>io1 / io2: provisioned IOPS and Block Express</h3>
<p>When you need guaranteed IOPS with an SLA-backed consistency (io2 targets its provisioned rate 99.9% of the time) or sub-millisecond latency, you buy Provisioned IOPS. io1 allows <strong>50 IOPS per GiB</strong>; io2 allows <strong>500 IOPS per GiB</strong>, and io2 <strong>Block Express</strong> (the current io2 architecture on Nitro) scales to <strong>256,000 IOPS, 4,000 MBps, 64 TiB per volume, with sub-millisecond latency</strong> — SAN-class numbers over a fabric that behaves like NVMe-oF. io2 also carries <strong>99.999% durability</strong> (0.001% AFR) versus 99.8–99.9% for everything else — a 100–1000x difference that matters when the volume IS the database. Only io1/io2 support <strong>Multi-Attach</strong> (covered in the encryption lesson, with the filesystem-corruption caveat).</p>

<h3>st1 / sc1: throughput volumes, and where they betray you</h3>
<p>st1 and sc1 are built from spinning media and priced accordingly. Their model is throughput-per-TiB with a burst bucket, exactly parallel to gp2's IOPS bucket: st1 gives <strong>40 MBps per TiB baseline, bursting to 250 MBps per TiB</strong> (500 MBps volume max); sc1 gives 12/80 MBps per TiB (250 MBps max). The critical internals detail: they count I/O in <strong>1 MiB units</strong>. A 1 MiB sequential read is one I/O; a 16 KiB random read is <em>also</em> one I/O, so random small-block workloads waste 98% of each operation. Kafka logs, EMR spill, sequential ETL scans: great. Anything with a B-tree doing 8 KiB random reads: catastrophic. Neither can be a boot volume.</p>

<div class="callout limits">Numbers to memorize cold: gp3 baseline <strong>3,000 IOPS / 125 MBps</strong>, max <strong>16,000 / 1,000</strong>, ratio 500 IOPS:GiB. gp2 <strong>3 IOPS/GiB</strong>, burst 3,000, bucket 5.4M credits. io2 Block Express <strong>256,000 IOPS</strong>, 64 TiB, 500 IOPS:GiB, 99.999% durable. st1 <strong>40 MBps/TiB</strong>, sc1 <strong>12 MBps/TiB</strong>. Max volume size 16 TiB everywhere except io2 Block Express (64 TiB). Per-instance EBS bandwidth is a separate cap set by instance type.</div>

<div class="callout exam">Keyword mapping: "lowest cost boot/general volume" → gp3. "16,000+ IOPS", "sub-millisecond", "SAP HANA / large Oracle" → io2 Block Express. "Throughput-oriented, large sequential, big data, lowest cost that still performs" → st1. "Colder data, lowest-cost block, infrequent access" → sc1. "Latency degrades after ~30 minutes of sustained load on gp2" → burst credits exhausted; migrate to gp3. A distractor will offer "increase gp2 size to get IOPS" — legal (3 IOPS/GiB) but never the best answer when gp3 provisioning is an option.</div>

<p><strong>When not to use EBS at all:</strong> shared POSIX access from many instances (that's EFS), object-scale data with HTTP access (S3), scratch space where microsecond latency beats durability (instance store), or Windows shares (FSx). EBS is one instance, one AZ, block semantics — everything else in this module exists because of those three constraints.</p>
`
    },
    {
      id: "ebs-availability",
      title: "The EBS availability model: AZ-locked, and what that means for DR",
      html: `
<p>The single most important architectural fact about EBS: a volume is <strong>replicated synchronously across multiple storage nodes within one Availability Zone — and never leaves it</strong>. It is not RAID across AZs, it is not regional, and no setting makes it so. Think of each AZ as an independent SAN deployment: the array has internal redundancy (mirrored spindles/SSDs, redundant controllers), so a single storage-server failure is invisible to you, but if the datacenter floods, the array and every LUN in it are gone together.</p>

<h3>What the replication actually buys you</h3>
<p>Intra-AZ replication is why EBS quotes an annual failure rate of <strong>0.1–0.2%</strong> for gp2/gp3/st1/sc1/io1 (roughly "1–2 of every 1,000 volumes per year lose data") and <strong>0.001%</strong> for io2. Compare that with a raw disk's ~4% AFR and you see what the mirroring is doing. But the failure domains it does NOT cover are exactly the ones architects care about:</p>
<ul>
<li><strong>AZ failure:</strong> volume unavailable and possibly unrecoverable. Your only escape hatch is a snapshot, because snapshots live in S3, which is regional.</li>
<li><strong>Region failure:</strong> requires snapshot copies to another region. Nothing in EBS itself is cross-region.</li>
<li><strong>Logical corruption:</strong> replication faithfully mirrors your <code>rm -rf</code> and your ransomware. Point-in-time recovery is snapshots, full stop.</li>
</ul>

<div class="callout exam">Trap pattern: "The architect assumes the EBS volume will remain available if the Availability Zone fails." Wrong, always. The correct remediation in the answer set is some flavor of "take regular snapshots and restore in another AZ," or "use a service that is inherently multi-AZ (EFS, FSx Multi-AZ, RDS Multi-AZ)." Another trap: "attach the volume to an instance in another AZ" — impossible; attachment requires instance and volume in the <em>same</em> AZ.</div>

<h3>Moving a volume (you don't — you move a snapshot)</h3>
<p>There is no live migration of a volume between AZs or regions. The workflow is always: <strong>snapshot → (optionally copy to another region) → create volume from snapshot in the target AZ</strong>. The new volume is a different volume ID with the same data. This is also how you change an unencrypted volume to encrypted, and how AMIs move regions — the same primitive underneath. Internalize "snapshot is the unit of mobility" and half the EBS exam questions answer themselves.</p>

<h3>Elastic Volumes: live modification</h3>
<p>Since 2017 you can modify a volume <strong>while it is attached and in use</strong>: grow the size, change the type (gp2→gp3, gp3→io2, st1→gp3...), and change provisioned IOPS/throughput. Mechanically, EBS migrates data to new storage infrastructure in the background while serving I/O — the volume enters an <code>optimizing</code> state during which performance sits between old and new configs. The operational rules:</p>
<ul>
<li><strong>Grow only.</strong> You can never shrink an EBS volume. Downsizing means creating a smaller volume and copying data (rsync/dd), or snapshot-and-restore won't help — restored volumes must be at least snapshot size.</li>
<li><strong>One modification per volume per 6 hours</strong> (the cooldown). Plan type+size+IOPS changes as one call, not three.</li>
<li><strong>The filesystem is your problem.</strong> EBS grows the block device; you still run <code>growpart</code> then <code>xfs_growfs</code> or <code>resize2fs</code>. The exam occasionally checks that you know the OS step exists.</li>
</ul>

<pre><code>aws ec2 modify-volume --volume-id vol-XXXX \
  --volume-type gp3 --size 200 --iops 6000 --throughput 250
aws ec2 describe-volumes-modifications --volume-ids vol-XXXX
# then on the instance:
sudo growpart /dev/nvme0n1 1
sudo xfs_growfs /</code></pre>

<div class="callout war">The 6-hour cooldown bites during incidents: you bump IOPS to firefight, realize you also needed size, and now you wait. Also, a volume can sit in <code>optimizing</code> for hours on large volumes — the modification takes effect gradually, so don't expect the new IOPS ceiling the second the API returns. And test <code>growpart</code> automation before you need it at 3 a.m.; on NVMe naming (nvme0n1p1) hand-written scripts that assume /dev/xvda routinely break.</div>

<h3>Contrast: instance store</h3>
<p>Instance store is the true local disk: NVMe soldered near the CPU, latencies in the tens of microseconds, throughput in GB/s that would cost a fortune as io2. The price is its lifecycle: data survives an OS reboot but is <strong>lost on stop, hibernate, terminate, or underlying host failure</strong>. It supports no snapshots, no detach, no encryption management (it is encrypted at rest on Nitro, but you control nothing). Correct uses: caches, Kafka brokers and databases that replicate at the application layer (Cassandra, ClickHouse), tempdb/scratch, shuffle space. The exam phrase "highest possible storage performance and the data can be re-created" → instance store; "data must persist after stop/start" → EBS, because a stop/start also moves you to a new host, vaporizing instance store.</p>

<div class="callout deep">Why AZ-locked? Synchronous block replication needs sub-millisecond round trips to ack writes; inter-AZ latency is ~1–2 ms, which would poison every write. Multi-AZ block storage exists (io2 has a Multi-AZ sibling in some services, FSx Multi-AZ, RDS) but always as failover pairs with a standby — not as a single synchronously-stretched volume. When a service offers "multi-AZ block-like storage," look for the standby-and-failover machinery in the fine print; that is where the RTO lives.</div>

<div class="callout limits">Per-region default quotas you might actually hit: volumes and snapshots are effectively unlimited, but provisioned IOPS per region and total storage per volume type have soft limits (e.g. 100 TiB st1/sc1 storage per account per region by default) — batch platforms hit these. Attachment: one instance per volume (except Multi-Attach io1/io2, max 16 instances), and an instance-type-dependent cap on attached volumes (up to 28 total ENIs+volumes on most Nitro sizes, 128 on the largest).</div>

<p><strong>DR shape summary:</strong> intra-AZ hardware failure — EBS handles it, you see nothing. AZ loss — you restore from snapshot into another AZ; RPO is your snapshot cadence, RTO is minutes (plus first-read lazy-load latency, next lesson). Region loss — you restore from a copied snapshot in the DR region; RPO adds the copy lag. If those RPOs are unacceptable, stop architecting at the volume layer and replicate at the application layer (database replication, DRBD-style, or a managed multi-AZ service).</p>
`
    },
    {
      id: "ebs-snapshots",
      title: "Snapshots: incremental mechanics, FSR, and lifecycle tooling",
      html: `
<p>EBS snapshots are <strong>incremental, block-level, and stored in S3</strong> — but each of those words means something more precise than the marketing sentence suggests, and the precision is what the exam tests.</p>

<h3>The incremental mechanics</h3>
<p>A volume is a sequence of blocks (chunks of 512 KiB at the snapshot layer). The first snapshot copies every <em>written</em> block to S3 — never empty space, which is why a 1 TiB volume with 40 GiB of data produces a ~40 GiB first snapshot. Every later snapshot stores <strong>only blocks changed since the previous snapshot</strong>, plus a manifest referencing unchanged blocks in earlier snapshots. Think git commits over a content-addressed block store, not tar files.</p>
<p>The consequence people get wrong: <strong>deleting a snapshot never breaks the chain</strong>. When you delete snapshot #2 of 5, AWS checks which of its blocks are still referenced by snapshots #3–5, keeps those (billing them to the surviving snapshots), and garbage-collects only blocks unique to #2. Every remaining snapshot can still restore a complete volume. So there is no "keep the full and its increments" babysitting like tape-era backup chains — delete anything, anytime, and the rest remain self-sufficient. Corollary: deleting old snapshots often frees far less storage than expected, because most of their blocks live on in newer snapshots.</p>

<div class="callout deep">"Stored in S3" means AWS-managed S3 you cannot see — snapshots never appear in your buckets, and you pay a separate EBS-snapshot price (~$0.05/GiB-month standard tier). The block-level access is real though: the <strong>EBS Direct APIs</strong> (ListSnapshotBlocks, GetSnapshotBlock, PutSnapshotBlock) let backup vendors read/write raw snapshot blocks and diff two snapshots without ever creating a volume — that's how modern backup tooling does incremental-forever off EBS.</div>

<h3>Restore and the lazy-load tax</h3>
<p>Creating a volume from a snapshot returns in seconds regardless of size, because nothing is copied up front: blocks are <strong>fetched from S3 on first read</strong> (lazy loading / "initialization"). Until a block has been touched once, reading it costs an S3 round trip — so a freshly restored database volume can serve reads at a fraction of provisioned IOPS with painful latency for hours. Your options:</p>
<ul>
<li><strong>Pre-warm manually:</strong> read every block once with <code>fio</code> or <code>dd</code> before cutover. Free, slow, works.</li>
<li><strong>Fast Snapshot Restore (FSR):</strong> enable FSR on a snapshot in specific AZs and volumes created there are <strong>fully initialized at creation</strong> — full performance from the first I/O.</li>
</ul>

<div class="callout war">FSR pricing is the trap: roughly <strong>USD 0.75 per snapshot per AZ per hour</strong> — about <strong>USD 540/month for one snapshot in one AZ</strong>, and it bills whether or not you ever restore. Teams enable it "for DR readiness" on nightly snapshots in three AZs and wake up to a five-figure line item. Correct usage: enable briefly around a planned restore/migration, or on the one golden AMI-backing snapshot your autoscaling fleet hydrates from, then disable. The exam phrases it as "volumes restored from snapshots must deliver full performance immediately" → FSR; the cost-aware variant expects you to know it is expensive and per-AZ-hour.</div>

<h3>Copying: cross-region, cross-account, and re-encryption</h3>
<p>Snapshot copy is the mobility and DR primitive. <code>aws ec2 copy-snapshot</code> can target another region (DR), and snapshots can be <strong>shared to other accounts</strong> (modify permissions, or make public — don't). Key mechanics:</p>
<ul>
<li>Copies across regions are full copies the first time; subsequent copies of newer snapshots of the same volume to the same destination can be incremental (when encryption context allows).</li>
<li><strong>Copy is where re-encryption happens.</strong> During a copy you can enable encryption or switch KMS keys. This is the only path to "encrypt this existing unencrypted snapshot" and the standard way to re-key to a customer-managed key before cross-account sharing.</li>
<li>Snapshots encrypted with the default <code>aws/ebs</code> key <strong>cannot be shared</strong> — the default key is not grantable across accounts. Re-encrypt to a customer-managed KMS key via copy, then share the snapshot and grant the target account decrypt on the key.</li>
</ul>

<h3>Deletion protection: Recycle Bin</h3>
<p><strong>Recycle Bin</strong> is a regional service holding retention rules for deleted snapshots (and AMIs): matching resources go to the bin on delete and are recoverable until the retention period (1 day–1 year) lapses. It protects against fat-fingered and script-gone-wild deletion — and against an attacker with <code>DeleteSnapshot</code> but not Recycle Bin permissions. It is not a backup strategy; it is an undo buffer.</p>

<h3>Automation: DLM vs AWS Backup</h3>
<table>
<thead><tr><th></th><th>Data Lifecycle Manager (DLM)</th><th>AWS Backup</th></tr></thead>
<tbody>
<tr><td>Scope</td><td>EBS snapshots + AMIs only</td><td>EBS, RDS, DynamoDB, EFS, FSx, S3, VMware, ...</td></tr>
<tr><td>Model</td><td>Tag-based schedules, retention counts/ages, cross-region copy</td><td>Central backup plans, vaults, cross-account + cross-region</td></tr>
<tr><td>Compliance</td><td>None built in</td><td><strong>Vault Lock</strong> (WORM), access policies, audit via Backup Audit Manager</td></tr>
<tr><td>Cost</td><td>Free (pay for snapshots)</td><td>Free for snapshot storage-equivalent; some services bill backup storage</td></tr>
</tbody>
</table>
<p>Selection rule: EBS-only, simple cadence → DLM. Anything mentioning centralized/multi-service/multi-account backup governance, WORM/immutability, ransomware, or compliance reporting → AWS Backup with Vault Lock.</p>

<div class="callout limits">Snapshot archive tier: ~75% cheaper (~USD 0.0125/GiB-month) but each archived snapshot is converted to a <strong>full</strong> (non-incremental) copy, restore takes <strong>24–72 hours</strong>, and minimum retention is 90 days. Right for the quarterly compliance snapshot you'll probably never restore; wrong for anything in an RTO story. Also worth memorizing: snapshots are crash-consistent per volume; for multi-volume consistency use the multi-volume snapshot option (one crash-consistent set across all attached volumes), and for application consistency you still quiesce (fsfreeze, VSS on Windows).</div>

<div class="callout exam">Question patterns: "Do deleted snapshots break restores?" — no, remaining snapshots stay complete. "Reduce snapshot storage cost for rarely-restored long-retention snapshots" → archive tier. "Protect snapshots from accidental deletion" → Recycle Bin. "Centralize backup across EBS+RDS+EFS with compliance lock" → AWS Backup + Vault Lock. "Restored volume is slow at first" → lazy load; fix with FSR or pre-warming. "Share encrypted snapshot with another account" → copy with customer-managed KMS key, share snapshot, grant key access.</div>
`
    },
    {
      id: "ebs-encryption-multiattach",
      title: "EBS encryption workflows and Multi-Attach (with the filesystem caveat)",
      html: `
<p>EBS encryption is AES-256 done in the hypervisor/Nitro card with per-volume data keys wrapped by a KMS key — so it covers <strong>data at rest, data in transit between instance and volume, and every snapshot and volume descended from the encrypted original</strong>. Performance cost is effectively nil (the Nitro hardware does the crypto), and IAM never sees plaintext keys. The interesting parts are the workflows, because the primitive operations are asymmetric in ways that generate exam questions.</p>

<h3>The one-way doors</h3>
<ul>
<li><strong>You cannot encrypt an existing volume in place.</strong> There is no "turn on encryption" button for a live unencrypted volume. The workflow is: <strong>snapshot the volume → copy the snapshot with encryption enabled (choose the KMS key here) → create a new volume from the encrypted copy → detach old, attach new</strong>. Yes, that is downtime or at least a maintenance window; there is no faster path.</li>
<li><strong>You cannot remove encryption</strong> from an encrypted snapshot or volume, and you cannot copy an encrypted snapshot to an unencrypted one. Encryption is a ratchet.</li>
<li><strong>Changing keys is also copy-time:</strong> re-encrypting from the default key to a customer-managed key (or rotating to a new CMK) happens by copying the snapshot with a different key.</li>
</ul>

<pre><code># Encrypt an existing unencrypted volume, end to end
aws ec2 create-snapshot --volume-id vol-XXXX --description pre-encrypt
aws ec2 copy-snapshot --source-region us-east-1 --source-snapshot-id snap-XXXX \
  --encrypted --kms-key-id alias/prod-ebs --destination-region us-east-1
aws ec2 create-volume --snapshot-id snap-ENCRYPTED --availability-zone us-east-1a \
  --volume-type gp3
# stop instance (or umount), detach old, attach new, remount</code></pre>

<h3>Default encryption: the account-level ratchet</h3>
<p><strong>Encryption by default</strong> is a per-region account setting (<code>aws ec2 enable-ebs-encryption-by-default</code>). Once on, every new volume and every snapshot copy is encrypted with your chosen default key even if the API call doesn't ask for it — and launches from unencrypted AMIs transparently produce encrypted volumes. This is the correct answer to "ensure all future EBS volumes are encrypted without changing launch templates/pipelines." Note it is per region, so your compliance story needs it enabled in every region you allow, ideally enforced by an SCP or Config rule. It does nothing retroactive: existing unencrypted volumes stay unencrypted until you run the snapshot-copy-restore dance.</p>

<div class="callout exam">Encryption question kit: "encrypt existing volume" → snapshot, copy-with-encryption, restore (any answer claiming in-place encryption is wrong). "All new volumes must be encrypted, no pipeline changes" → enable encryption by default (+ SCP to prevent disabling). "Share encrypted snapshot cross-account" → must use a customer-managed key (the <code>aws/ebs</code> default key cannot be shared), grant the external account <code>kms:Decrypt</code>/<code>kms:CreateGrant</code>, share the snapshot; the recipient copies it re-encrypting with their own key. "KMS key deleted/disabled" → volumes already attached keep working from cached data keys until detach/stop, then the volume is unusable — a favorite failure-mode question.</div>

<div class="callout war">The KMS dependency is real operational risk: if a CMK is disabled or pending deletion, every instance that stops (including an unplanned host retirement) cannot re-attach its encrypted root volume, and Auto Scaling launches from encrypted AMIs fail account-wide. Alarm on KMS key state changes, and treat ScheduleKeyDeletion on an EBS key like dropping a production database. Also watch KMS request quotas: a mass instance-launch event (large ASG scale-out) generates a KMS Decrypt burst; the default 5,500–50,000 req/s per-region quota is shared with everything else using KMS.</div>

<h3>Multi-Attach: shared block storage, not a shared filesystem</h3>
<p><strong>Multi-Attach</strong> lets one io1/io2 volume attach to up to <strong>16 Nitro instances in the same AZ</strong> simultaneously, each with full read-write. What it does NOT do is coordinate anything: every instance sees a raw block device, all caching and locking is up to software. Mount ext4 or XFS from two instances concurrently and you will corrupt the filesystem — not "might," will. Both filesystems cache metadata (superblocks, inode tables, journal state) assuming exclusive ownership of the device; two journals replaying against the same blocks shred the structure in minutes. The kernel will not stop you; the mount succeeds on both nodes and the damage is silent until it isn't.</p>
<p>Legitimate Multi-Attach usage requires a <strong>cluster-aware filesystem or application</strong>: GFS2 or OCFS2 with a distributed lock manager (Pacemaker/corosync stack), or an application doing raw block I/O with its own fencing (classic Oracle RAC on ASM pattern, some clustered databases). The typical exam-correct scenarios are Linux HA clusters needing shared block with sub-ms latency and application-level arbitration.</p>

<div class="callout limits">Multi-Attach constraints worth memorizing: io1/io2 only (never gp3), <strong>16 instances max, all Nitro, all in the same AZ as the volume</strong> (the AZ-lock from lesson 2 still applies — this is not multi-AZ HA), volumes cannot be boot volumes, and I/O fencing is your job (SCSI persistent reservations are supported on io2 with NVMe reservations for cluster software that uses them). Multi-Attach also disables some Elastic Volume modifications while attached.</div>

<div class="callout deep">Why does ext4 corrupt but GFS2 survive? Single-node filesystems assume the page cache is the truth: node A caches an inode bitmap, node B allocates the same inode on disk, node A later flushes its stale bitmap on top. Cluster filesystems route every metadata operation through a distributed lock manager so only one node owns a given resource group at a time, and they maintain per-node journals with fencing so a dead node's journal can be replayed safely by a survivor. That coordination costs latency on every metadata op — which is why GFS2 is markedly slower than ext4 for metadata-heavy work, and why "just use EFS" is usually the better architecture unless you specifically need block semantics.</div>

<p><strong>When not to use Multi-Attach:</strong> almost always. If the requirement is "multiple instances share files," the answer is EFS (Linux) or FSx (Windows/other) — managed, multi-AZ, no DLM to operate. Multi-Attach is the answer only when the question explicitly needs shared <em>block</em> access with a cluster-aware stack, or ultra-fast storage-level failover between an active and standby node (attach-time removal from the failure path). If a question pairs Multi-Attach with ext4/XFS and no cluster filesystem, that option is wrong by construction.</p>
`
    },
    {
      id: "efs",
      title: "EFS: elastic NFS, throughput modes, storage classes, access points",
      html: `
<p>EFS is managed <strong>NFSv4.1</strong> — think of it as a NetApp filer you never scale, patch, or capacity-plan. The two properties that define it: it is <strong>elastic</strong> (no provisioned size; it grows and shrinks with usage, into the petabytes, and you pay per GiB-month actually stored) and, in its Regional flavor, it is <strong>multi-AZ by construction</strong> — data is stored redundantly across AZs, making it one of the few storage services where "the AZ died" is a non-event for durability <em>and</em> availability. That inverts the EBS mental model: EBS is fast, cheap-per-GiB-provisioned, single-writer, single-AZ; EFS is shared, POSIX, regional, pay-for-use, and slower per operation.</p>

<h3>Topology: mount targets, ENIs, security groups</h3>
<p>An EFS filesystem is reached through <strong>mount targets</strong> — one per AZ, each an ENI with an IP in your subnet, fronting the service. Clients mount the target in their own AZ (the DNS name resolves per-AZ) to avoid cross-AZ latency and data charges. Access control is layered: the mount target's <strong>security group must allow TCP 2049</strong> from clients (the classic "mount hangs forever" cause is a missing 2049 rule); the <strong>filesystem policy</strong> (IAM resource policy) can require TLS or specific roles; and POSIX permissions apply inside. The <code>amazon-efs-utils</code> mount helper adds TLS via a local stunnel and IAM auth.</p>

<h3>Performance modes and throughput modes (orthogonal knobs)</h3>
<table>
<thead><tr><th>Knob</th><th>Options</th><th>Guidance</th></tr></thead>
<tbody>
<tr><td>Performance mode</td><td><strong>General Purpose</strong> vs Max I/O</td><td>GP: lowest per-op latency (sub-ms reads, single-digit-ms writes), now scales to 250k+ read IOPS. <strong>Max I/O is effectively deprecated</strong> — higher aggregate parallelism at the cost of markedly higher latency; One Zone and Elastic-throughput filesystems don't even offer it. Exam answer is General Purpose unless the question is visibly ancient.</td></tr>
<tr><td>Throughput mode</td><td><strong>Elastic</strong> vs Provisioned vs Bursting</td><td><strong>Elastic</strong> (default, recommended): scales instantly with the workload, pay per GiB transferred — right for spiky/unknown workloads. <strong>Provisioned</strong>: fixed MiB/s you pay for 24/7 — right for steady, predictable throughput above what your stored size would earn. <strong>Bursting</strong> (legacy): throughput scales with stored data (50 MiB/s per TiB baseline, burst to 100 MiB/s per TiB via a credit bucket) — the gp2 trap again: small filesystems earn tiny baselines and stall when credits drain.</td></tr>
</tbody>
</table>

<div class="callout war">Bursting mode's classic incident: a 10 GiB filesystem (config files, shared app assets) earns a 0.5 MiB/s baseline. It runs for weeks on burst credits, then a deploy re-syncs assets, credits hit zero, and every web server's NFS reads crawl simultaneously — an outage that looks like a network problem. People used to pad the filesystem with dummy data to buy baseline; the real fix today is switching to Elastic throughput (a live, one-call change). Watch <code>BurstCreditBalance</code> if you're still on Bursting.</div>

<h3>Storage classes and lifecycle</h3>
<p>Per-GiB pricing is EFS's sore point — Regional Standard runs ~USD 0.30/GiB-month, roughly 4x gp3 — so the storage classes matter: <strong>Standard</strong>, <strong>Infrequent Access (IA)</strong> (~92% cheaper storage, per-GiB retrieval fee), and <strong>Archive</strong> (~97% cheaper, higher retrieval fee, for data touched a few times a year). <strong>Lifecycle policies</strong> move files automatically: transition to IA after N days without access (7/14/30/60/90...), to Archive after 90+ days, and optionally back to Standard on first access. Because most shared filesystems are 80–90% cold data, a lifecycle policy routinely cuts the EFS bill by two-thirds — the exam's favorite EFS cost-optimization answer. <strong>One Zone</strong> classes cut cost ~47% further by dropping multi-AZ redundancy — right for dev, rebuildable caches, and staging, wrong for anything whose loss you'd have to explain.</p>

<h3>Access points: enforced identity and chroot</h3>
<p><strong>Access points</strong> are application-specific entry doors: each one pins a <strong>root directory</strong> (the client sees only that subtree — a server-enforced chroot) and can <strong>enforce a POSIX uid/gid</strong> for all operations regardless of the client's identity. Combine with IAM (filesystem policy granting role X access only via access point Y) and you get multi-tenant isolation on one filesystem without trusting client-side uid mapping — this is exactly how <strong>Lambda and ECS/Fargate mount EFS</strong>. Exam keyword: "multiple applications share a filesystem, each restricted to its own directory with a fixed identity" → access points.</p>

<h3>Replication and DR</h3>
<p><strong>EFS Replication</strong> maintains a read-only replica in another region (or another AZ) with an RPO/RTO designed in minutes (15-minute RPO target); failover means breaking replication to make the replica writable. It replicates the filesystem for DR — it is not a backup (deletes replicate too); pair with AWS Backup, which supports EFS natively.</p>

<div class="callout exam">EFS selection cues: "shared storage for hundreds/thousands of EC2 instances or containers", "POSIX", "grows automatically", "multi-AZ file storage", "Lambda needs a filesystem" → EFS. Cost optimization → lifecycle to IA/Archive; dev/test cost → One Zone. Anti-cues that rule EFS out: <strong>Windows/SMB</strong> (EFS is NFS-only → FSx for Windows), sub-ms consistent latency or single-host database files (→ EBS), object/HTTP access patterns (→ S3). Also remember EFS is Linux-territory: no native Windows NFS client support worth deploying.</div>

<div class="callout limits">Numbers: NFSv4.1, port <strong>2049</strong>; one mount target per AZ; Elastic throughput scales to 20+ GiB/s reads and 5 GiB/s writes in current gens; GP mode 250k+ read IOPS / 50k+ write; per-file max size 47.9 TiB. Rather than chasing every figure, memorize the shape: latency is sub-ms read / low-ms write — an order of magnitude above EBS, two above instance store. Price shape: pay for GiB stored per class + per-GiB Elastic throughput or provisioned MiB/s + IA/Archive retrieval — no charge for provisioned capacity because there is none.</div>

<p><strong>When not to use EFS:</strong> as a database volume (latency and locking semantics will hurt; use EBS), for Windows workloads (no SMB), for metadata-heavy tiny-file workloads at scale (per-op latency dominates; consider FSx for Lustre/OpenZFS or redesign into S3), or where cost per warm GiB rules and sharing isn't needed (EBS/S3 are cheaper). EFS wins exactly when many Linux clients need the same POSIX tree with zero capacity management.</p>
`
    },
    {
      id: "fsx-family",
      title: "The FSx family: four filers and how to pick in ten seconds",
      html: `
<p>FSx is AWS running a specific filesystem product for you — four of them, each a lift of a technology you may already run on-prem. The exam almost never tests FSx internals; it tests <strong>which FSx</strong>, and every question contains a giveaway keyword. Learn the keywords and these are the fastest points on the paper. But since you'll also architect with them, here's the real substance behind each.</p>

<h3>FSx for Windows File Server</h3>
<p>A managed Windows Server file cluster: <strong>SMB</strong> (2.0–3.1.1), <strong>NTFS</strong> semantics, <strong>NTFS ACLs</strong>, and — the load-bearing feature — <strong>Active Directory integration</strong> (AWS Managed Microsoft AD or your self-managed AD). User home directories, departmental shares, profile storage for WorkSpaces/AppStream, lift-and-shift of the ancient file server everyone fears. Supports <strong>DFS Namespaces</strong> (present many filesystems under one namespace) and DFS Replication patterns, shadow copies (previous versions in Explorer), SSD or HDD storage, and <strong>Multi-AZ</strong> deployments — an active/standby pair with synchronous replication across AZs and automatic failover in ~30s, transparent to SMB clients via a floating DNS name. Note SMB means Windows <em>and</em> macOS/Linux clients can mount it, but identity is AD, full stop — no AD, look elsewhere.</p>

<h3>FSx for Lustre</h3>
<p>Lustre is the HPC parallel filesystem (the name is Linux+cluster): data striped across many storage servers (OSTs), metadata separated (MDS), clients talk to all stripes in parallel. Numbers that justify its existence: <strong>sub-millisecond latency, up to hundreds of GB/s aggregate throughput, millions of IOPS</strong> — per filesystem, scaling with capacity (e.g. persistent tiers at 125–1000 MB/s per TiB). Two deployment types: <strong>Scratch</strong> (no replication, cheapest, data can be lost on hardware failure — for temporary processing) and <strong>Persistent</strong> (in-AZ replication, for longer-lived data; still single-AZ). The exam's favorite feature is the <strong>S3 integration</strong>: link a filesystem to an S3 bucket and objects appear as files, with content <strong>lazy-loaded on first read</strong>; results can be exported back to S3 (data repository tasks / automatic export). The canonical pattern: training data or genomics datasets live cheaply in S3; you spin up a Lustre filesystem for the job, it hydrates on demand, the cluster hammers it at 100+ GB/s, results export to S3, filesystem deleted. Linux clients only, via a kernel module.</p>

<h3>FSx for NetApp ONTAP</h3>
<p>Actual ONTAP, managed. If the organization runs NetApp on-prem, this is the default landing zone, because everything carries over: <strong>SnapMirror</strong> replication for migration and DR (block-incremental replication from on-prem filers straight into AWS), <strong>FlexClone</strong> (instant, space-efficient writable clones — clone a 10 TiB database volume in seconds for dev/test), <strong>Snapshots</strong>, and the storage-efficiency stack (inline dedupe, compression, compaction — often 30–65% savings) plus automatic tiering of cold data to a capacity pool. Uniquely, it is <strong>multi-protocol: NFS, SMB, and iSCSI/NVMe-over-TCP from one filesystem</strong> — the only FSx that serves block. Multi-AZ available. Keywords: NetApp, SnapMirror, FlexClone, "NFS and SMB access to the same data", iSCSI.</p>

<h3>FSx for OpenZFS</h3>
<p>Managed ZFS: <strong>NFS (v3–v4.2)</strong>, ZFS <strong>snapshots and instant writable clones</strong>, adaptive compression, and very low latency (as low as hundreds of microseconds on the high end) with up to ~1 million IOPS. It's the target for migrating ZFS/NFS appliances and for Linux workloads that want snapshot/clone workflows without ONTAP's enterprise surface. No SMB, no AD requirement, no iSCSI. Keywords: ZFS, "clone datasets instantly for test", high-performance NFS for Linux without HPC striping.</p>

<h3>The decision table</h3>
<table>
<thead><tr><th></th><th>Windows FS</th><th>Lustre</th><th>NetApp ONTAP</th><th>OpenZFS</th></tr></thead>
<tbody>
<tr><td>Protocols</td><td>SMB</td><td>Lustre client (POSIX)</td><td>NFS + SMB + iSCSI</td><td>NFS</td></tr>
<tr><td>Killer feature</td><td>AD + NTFS ACLs + DFS</td><td>Parallel throughput + S3 lazy-load/export</td><td>SnapMirror, FlexClone, dedupe, multi-protocol</td><td>ZFS snapshots/clones, µs-class latency</td></tr>
<tr><td>Multi-AZ</td><td>Yes</td><td>No (scratch/persistent, single-AZ)</td><td>Yes</td><td>Yes (newer deployments)</td></tr>
<tr><td>Exam keywords</td><td>Windows, SMB, Active Directory, NTFS</td><td>HPC, ML training, genomics, hundreds of GB/s, S3-linked</td><td>NetApp, SnapMirror, iSCSI, NFS+SMB together</td><td>ZFS, NFS clones, low latency Linux</td></tr>
<tr><td>Wrong when</td><td>Linux-only POSIX (EFS)</td><td>General shared storage, Windows</td><td>Simple Linux NFS (EFS is simpler)</td><td>Need SMB/AD or parallel HPC</td></tr>
</tbody>
</table>

<div class="callout exam">Ten-second routing: <strong>SMB or Active Directory → Windows File Server. HPC / ML training / "process S3 data at high throughput" → Lustre. NetApp / SnapMirror / iSCSI / multi-protocol → ONTAP. ZFS or fast simple Linux NFS with clones → OpenZFS.</strong> And the meta-rule: plain "shared file storage for Linux EC2, scale automatically" with no such keyword → EFS, not FSx at all. Distractor to spot: "use FSx for Lustre for a Windows SMB share" (Lustre has no SMB) and "use EFS for Windows" (no SMB either).</div>

<div class="callout war">Real-world FSx gotchas: Windows FS capacity and throughput are <strong>provisioned</strong> — you pick GiB and MB/s at creation, and while you can grow, you pay for the provision, not usage (the EFS pay-per-use reflex misleads people into oversizing bills or undersizing performance). Lustre Scratch really does lose data — a scratch filesystem holding the only copy of three weeks of simulation output is a resume-generating event; export to S3 continuously. ONTAP's dedupe savings quotes assume dedupe-friendly data; encrypted or compressed source data dedupes at ~0%.</div>

<div class="callout deep">Why Lustre outruns EFS by orders of magnitude: EFS serves a POSIX tree through a replicated regional service — every operation traverses a multi-AZ consistency layer. Lustre stripes each file across N object storage targets and lets every client do parallel I/O directly to all of them, with metadata handled by a separate server — bandwidth scales with stripe count, and consistency is single-AZ POSIX with client-side locking (LDLM). You trade availability (single AZ, kernel client, operational sharp edges) for a 100x throughput ceiling. That trade is the whole HPC storage industry in one sentence.</div>

<p><strong>Pricing shape across the family:</strong> all FSx variants bill on <strong>provisioned capacity</strong> (GiB) plus <strong>provisioned throughput</strong> (MB/s tier), plus backups — unlike EFS's pay-per-use. Multi-AZ roughly doubles cost versus single-AZ. HDD tiers (Windows FS) and capacity-pool tiering (ONTAP) are the cost levers. When a question weighs "lowest cost shared storage for Linux" against FSx options, EFS with lifecycle management usually wins unless a protocol/feature keyword forces FSx.</p>
`
    },
    {
      id: "storage-gateway-decision",
      title: "Storage Gateway and the master block/file/object decision table",
      html: `
<p>Storage Gateway is the hybrid shim: a VM (or hardware appliance) in your datacenter that speaks legacy protocols to your LAN — NFS, SMB, iSCSI, or VTL — and translates to AWS storage behind the scenes, with a local cache so the LAN sees LAN latency for hot data. One product name, four very different modes; the exam tests mode selection via keywords.</p>

<h3>S3 File Gateway</h3>
<p>Exposes <strong>NFS/SMB shares backed by S3</strong>, mapping files 1:1 to objects (the file path becomes the object key — so objects remain directly usable by analytics, Lambda, Athena). The gateway keeps a <strong>local cache</strong> of recently used data for low-latency reads and buffers writes for async upload. Use cases: on-prem apps writing file data that should land in S3 (ingest for data lakes, backup targets, "extend the file server into S3"), migrations where the app keeps its file interface. Understand the semantics: it is not a distributed lock server — multiple sites writing the same objects need care (file upload notifications, RefreshCache when the bucket is modified out-of-band). SMB mode integrates with AD for auth.</p>

<h3>FSx File Gateway</h3>
<p>Local cache in front of <strong>FSx for Windows File Server</strong>: on-prem clients get low-latency SMB access to shares that actually live in AWS. The scenario is specific: you moved the file server to FSx, but a branch office with a thin WAN still needs fast access to the working set. Keywords: on-prem SMB, low latency, FSx in the cloud.</p>

<h3>Volume Gateway: cached vs stored</h3>
<p>Presents <strong>iSCSI block volumes</strong> to on-prem servers; data is backed to AWS and snapshotted as <strong>EBS snapshots</strong> (restorable as EBS volumes for cloud recovery). Two modes, one distinction the exam adores:</p>
<ul>
<li><strong>Cached volumes:</strong> primary data in S3, on-prem cache for the hot working set. Point: your datacenter storage footprint is a small cache of a large cloud volume (up to 32 volumes × 32 TiB). Keyword: "minimize on-premises storage."</li>
<li><strong>Stored volumes:</strong> full primary copy on-prem, async upload of snapshots to AWS. Point: LAN-speed access to <em>everything</em>, with cloud backup/DR. Keyword: "entire dataset on-premises with low latency" + "back up to AWS." Max 32 volumes × 16 TiB.</li>
</ul>

<h3>Tape Gateway</h3>
<p>A <strong>Virtual Tape Library</strong>: your existing backup software (Veeam, NetBackup, Commvault) sees an iSCSI tape robot and drives; virtual tapes live in S3, and ejected/archived tapes go to <strong>S3 Glacier Flexible Retrieval or Deep Archive</strong>. It exists so 20-year-old tape workflows can drop the physical tape supply chain without changing the backup application. Keywords: "backup software", "tape", "eliminate physical tape", "off-site tape storage."</p>

<div class="callout exam">Gateway keyword map: NFS/SMB files into S3 objects → <strong>S3 File Gateway</strong>. Branch-office SMB cache for cloud FSx → <strong>FSx File Gateway</strong>. iSCSI + minimize local storage → <strong>Volume Gateway cached</strong>. iSCSI + all data local + cloud backup → <strong>Volume Gateway stored</strong>. Existing backup app + tapes → <strong>Tape Gateway</strong>. One more: "migrate file data once, at maximum speed" is <strong>DataSync</strong>, not Storage Gateway — Gateway is for ongoing hybrid access, DataSync for transfers. They pair: DataSync to seed, File Gateway for steady state.</div>

<div class="callout war">Gateways live or die by cache sizing: an undersized cache disk on a File Gateway turns S3's latency into your file server's latency the moment the working set spills. The appliance also needs real resources (16+ GiB RAM, SSD-backed cache) — the "free" VM quietly consumes a hypervisor's worth of IOPS. And Volume Gateway snapshots are crash-consistent unless you quiesce the application; treat them like the EBS snapshots they are.</div>

<h3>The master table: block vs file vs object</h3>
<p>Nearly every storage question on the exam is this table wearing a costume:</p>
<table>
<thead><tr><th></th><th>Block (EBS, instance store)</th><th>File (EFS, FSx)</th><th>Object (S3)</th></tr></thead>
<tbody>
<tr><td>Access unit</td><td>Raw blocks; filesystem is the OS's job</td><td>POSIX/NTFS files over NFS/SMB</td><td>Whole objects over HTTP</td></tr>
<tr><td>Latency</td><td>Sub-ms to low ms</td><td>Sub-ms to several ms per op</td><td>Tens of ms first byte</td></tr>
<tr><td>Sharing</td><td>One instance (Multi-Attach is the exotic exception)</td><td>Hundreds to thousands of concurrent clients</td><td>Unlimited concurrent access</td></tr>
<tr><td>Scaling</td><td>Provisioned per volume, 16–64 TiB caps</td><td>Elastic (EFS) or provisioned (FSx), PiB-scale</td><td>Effectively infinite, no provisioning</td></tr>
<tr><td>You pay for</td><td>Provisioned GiB (+IOPS/MBps)</td><td>Used GiB (EFS) or provisioned (FSx)</td><td>Used GiB + requests + transfer</td></tr>
<tr><td>In-place update</td><td>Yes, any byte</td><td>Yes, any byte</td><td>No — replace the whole object</td></tr>
<tr><td>Wrong for</td><td>Shared data, cross-AZ HA, unbounded growth</td><td>Databases needing raw block latency, object-scale analytics</td><td>Filesystems, random partial writes, sub-ms latency</td></tr>
</tbody>
</table>

<div class="callout deep">The in-place-update row is the deepest differentiator: block and file expose mutable byte ranges, so a database can flip one 8 KiB page. S3 objects are immutable versions — "modifying" one byte means re-PUTting the object. That single semantic difference explains why databases live on block, shared app state on file, and everything append-only, immutable, or whole-file (logs, images, backups, data lakes) belongs on object storage where it's 10x cheaper.</div>

<div class="callout limits">Cost anchors (us-east-1 ballpark, memorize the ratios not the cents): S3 Standard ~USD 0.023/GiB-month, gp3 ~0.08 provisioned, EFS Standard ~0.30 used, EFS One Zone ~0.16, FSx varies by throughput tier. So: object is ~3–4x cheaper than block, block ~4x cheaper than shared file — sharing and elasticity are what you pay for. Any "most cost-effective storage" question starts by asking whether S3's semantics are survivable for the workload.</div>

<p><strong>Putting it together</strong> — the routing algorithm for any exam storage scenario: (1) Object semantics tolerable (whole-file, HTTP, no POSIX)? → S3, then pick a storage class. (2) Shared POSIX across instances? → EFS for Linux; keyword-check for FSx (SMB/AD, HPC, NetApp, ZFS). (3) Single-instance, low latency, mutable? → EBS, then run the IOPS/throughput/latency math from lesson 1. (4) Rebuildable scratch at max speed? → instance store. (5) On-prem in the sentence? → Storage Gateway mode by keyword, or DataSync/Snowball for one-time moves. Practice until it takes five seconds; a third of the storage domain is this loop.</p>
`
    }
  ],
  quiz: [
    {
      q: "A PostgreSQL instance on a 200 GiB gp2 volume performs well for about 40 minutes after the nightly batch import starts, then read latency spikes tenfold with no errors in the database logs. CloudWatch shows BurstBalance at zero. What is the MOST cost-effective fix?",
      options: [
        "Increase the gp2 volume to 1,000 GiB to raise the baseline to 3,000 IOPS",
        "Migrate the volume to io2 with 10,000 provisioned IOPS",
        "Modify the volume type to gp3 and provision the IOPS the workload needs",
        "Add a second gp2 volume and stripe them with RAID 0",
        "Move the database to an instance store volume"
      ],
      answer: [2],
      multi: false,
      explanation: `The symptom is the classic gp2 burst-credit exhaustion: 200 GiB earns a 600 IOPS baseline, bursts to 3,000, and the 5.4M-credit bucket drains in roughly 40 minutes under sustained load, then hard-drops to baseline. <strong>C</strong> is correct: an elastic-volume modification to gp3 is done live, gp3 has no burst mechanics (3,000 IOPS baseline regardless of size), and additional IOPS up to 16,000 are provisioned cheaply and independently of capacity. <strong>A</strong> works (3 IOPS/GiB) but forces you to buy 800 GiB of unneeded space — the distractor the exam plants precisely because it is legal but not cost-effective. <strong>B</strong> vastly overshoots on cost; io2 is for guaranteed high IOPS and sub-ms latency needs. <strong>D</strong> doubles cost and doubles the burst-credit problem while halving volume-level reliability. <strong>E</strong> sacrifices durability for a persistent database — instance store is lost on stop/terminate/host failure.`
    },
    {
      q: "An application needs a 500 GiB volume that can sustain 12,000 IOPS. Durability of 99.8-99.9 percent is acceptable and latency of a few milliseconds is fine. Which volume is the cheapest that meets the requirement?",
      options: [
        "gp2 sized at 4,000 GiB",
        "gp3 at 500 GiB with 12,000 provisioned IOPS",
        "io2 at 500 GiB with 12,000 provisioned IOPS",
        "st1 at 12 TiB for higher baseline throughput"
      ],
      answer: [1],
      multi: false,
      explanation: `<strong>B</strong> wins: gp3 decouples IOPS from size, its 500 IOPS-per-GiB ratio allows 12,000 IOPS on a volume as small as 24 GiB, and provisioned gp3 IOPS cost far less than io2 IOPS. <strong>A</strong> reaches 12,000 IOPS only by buying 8x the needed capacity (3 IOPS/GiB), which costs more than gp3's provisioned IOPS and wastes 3.5 TiB. <strong>C</strong> meets the specs but io2 charges a premium per provisioned IOPS for its 99.999 percent durability and latency SLA that the scenario explicitly does not require. <strong>D</strong> misunderstands st1 entirely: it is a throughput-per-TiB HDD family that counts I/O in 1 MiB units and collapses under small random I/O — it has no meaningful IOPS capability at any size.`
    },
    {
      q: "A financial-services firm is migrating an on-premises Oracle database that requires 180,000 IOPS with sub-millisecond latency on a single 20 TiB volume. Which EBS configuration can satisfy this?",
      options: [
        "gp3 with maximum provisioned IOPS and throughput",
        "io1 with 180,000 provisioned IOPS",
        "io2 Block Express with 180,000 provisioned IOPS",
        "Four st1 volumes striped with RAID 0",
        "gp2 at maximum volume size"
      ],
      answer: [2],
      multi: false,
      explanation: `<strong>C</strong> is the only option that gets there: io2 Block Express scales to 256,000 IOPS, 4,000 MBps, 64 TiB per volume, with consistent sub-millisecond latency — the SAN-replacement tier. <strong>A</strong> caps at 16,000 IOPS and 16 TiB, an order of magnitude short on IOPS and too small. <strong>B</strong> fails twice: io1 caps at 64,000 IOPS and 16 TiB. <strong>D</strong> is HDD-backed throughput storage; striping cannot conjure random-I/O performance or sub-ms latency from spinning media. <strong>E</strong> caps at 16,000 IOPS at 16 TiB and adds burst-bucket behavior. When you see six-figure IOPS plus sub-millisecond in a question, the answer is io2 Block Express before you finish reading the options.`
    },
    {
      q: "A log-analytics pipeline on EC2 sequentially scans multi-gigabyte files from an 8 TiB working set. It needs around 300 MBps sustained sequential throughput at the lowest possible storage cost. Random IOPS requirements are negligible. Which volume type fits?",
      options: [
        "sc1 Cold HDD",
        "st1 Throughput Optimized HDD",
        "gp3 with 300 MBps provisioned throughput",
        "io2 with provisioned IOPS equivalent to 300 MBps"
      ],
      answer: [1],
      multi: false,
      explanation: `<strong>B</strong> is the designed-for case: st1 delivers a 40 MBps-per-TiB baseline — 320 MBps at 8 TiB, meeting the target on baseline alone with burst headroom to 250 MBps/TiB — at roughly half the per-GiB price of gp3. Large sequential I/O matches its 1 MiB I/O accounting perfectly. <strong>A</strong> is cheaper still but its 12 MBps/TiB baseline yields only 96 MBps at 8 TiB with a 250 MBps hard cap even on burst — it cannot sustain the requirement. <strong>C</strong> works technically but costs materially more per GiB for 8 TiB plus a provisioned-throughput charge; the question asks for lowest cost. <strong>D</strong> is the most expensive family in the lineup — paying an io2 premium for sequential streaming is exactly backwards.`
    },
    {
      q: "An architect states that a critical application can tolerate an Availability Zone outage because its EBS volume is replicated by AWS. What is the correct assessment of this design?",
      options: [
        "The design is sound because EBS synchronously replicates every volume across at least two AZs",
        "The design is flawed: EBS replicates only within a single AZ, so the team must take snapshots and be ready to restore a volume in another AZ",
        "The design is sound if the volume type is io2, which adds cross-AZ replication",
        "The design is flawed but is fixed by enabling EBS Multi-Attach so a standby instance in another AZ can take over the volume"
      ],
      answer: [1],
      multi: false,
      explanation: `<strong>B</strong> is correct and is one of the most-tested facts in the storage domain: EBS replication is synchronous mirroring across storage nodes inside one AZ only. An AZ failure takes the volume with it; the escape hatch is snapshots, which live in regional S3 and can seed a new volume in any AZ (or, once copied, any region). <strong>A</strong> is simply false — no EBS volume ever spans AZs. <strong>C</strong> is false: io2's 99.999 percent durability comes from better intra-AZ replication, not cross-AZ placement. <strong>D</strong> fails on a hard constraint: Multi-Attach requires all instances in the same AZ as the volume, so it provides zero AZ-failure protection — a distractor built from a half-remembered feature.`
    },
    {
      q: "A compliance audit finds a production application running on an unencrypted 1 TiB EBS volume. The data must be encrypted with a customer-managed KMS key. Which TWO actions are part of the correct remediation? (Select TWO.)",
      options: [
        "Copy a snapshot of the volume with encryption enabled, specifying the customer-managed key",
        "Run a modify-volume operation on the existing volume with encryption enabled",
        "Create a new volume from the encrypted snapshot copy and swap it onto the instance",
        "Enable EBS encryption by default so the existing volume is encrypted on the next instance stop and start",
        "Use the KMS console to encrypt the attached volume in place"
      ],
      answer: [0, 2],
      multi: true,
      explanation: `There is no in-place encryption of an existing EBS volume — the only path is snapshot, copy-with-encryption, restore, swap. <strong>A</strong> is the step where encryption actually happens: snapshot copy is the operation that accepts a target KMS key. <strong>C</strong> completes the workflow: the encrypted snapshot becomes a new encrypted volume that replaces the original at the next maintenance window. <strong>B</strong> describes an API capability that does not exist — modify-volume changes size, type, IOPS, and throughput, never encryption state. <strong>D</strong> misstates what default encryption does: it affects newly created volumes and snapshot copies only, never retroactively touching existing volumes regardless of instance lifecycle. <strong>E</strong> is fiction; KMS manages keys, it does not rewrite volume data.`
    },
    {
      q: "A team is designing a Linux high-availability cluster where two EC2 instances need simultaneous read-write access to the same EBS volume. Which TWO requirements must the design satisfy? (Select TWO.)",
      options: [
        "The volume must be a Provisioned IOPS volume (io1 or io2) with Multi-Attach enabled",
        "The instances must be spread across two Availability Zones for resilience",
        "The instances must use a cluster-aware filesystem such as GFS2 rather than ext4 or XFS",
        "The volume must be gp3 with maximum provisioned throughput",
        "EBS encryption must be disabled, since Multi-Attach does not support encrypted volumes"
      ],
      answer: [0, 2],
      multi: true,
      explanation: `<strong>A</strong> is a hard platform constraint: Multi-Attach exists only on io1/io2 Provisioned IOPS volumes (up to 16 Nitro instances). <strong>C</strong> is the data-integrity constraint: single-node filesystems like ext4 and XFS cache metadata assuming exclusive device ownership, and two concurrent mounts will silently corrupt the filesystem — a cluster filesystem with a distributed lock manager (GFS2, OCFS2) is mandatory. <strong>B</strong> is impossible, not just unnecessary: Multi-Attach requires every instance to be in the same AZ as the volume, which is why it is not an AZ-level HA mechanism. <strong>D</strong> is wrong because gp3 does not support Multi-Attach at all. <strong>E</strong> is false — encrypted io1/io2 volumes support Multi-Attach; encryption is orthogonal.`
    },
    {
      q: "After restoring a large database volume from an EBS snapshot during a DR test, the team observes terrible read latency for several hours before performance normalizes. Future restores must deliver full provisioned performance immediately. What should they do?",
      options: [
        "Restore to an io2 volume instead, which initializes synchronously",
        "Enable Fast Snapshot Restore on the snapshot in the target Availability Zones before restoring",
        "Increase the provisioned IOPS on the restored volume during the restore window",
        "Copy the snapshot to the same region first, then restore from the copy"
      ],
      answer: [1],
      multi: false,
      explanation: `The slowness is lazy loading: volumes created from snapshots return instantly because blocks are fetched from S3 only on first read, so the first pass over cold blocks pays an S3 round trip each. <strong>B</strong> is the designed fix — Fast Snapshot Restore pre-initializes volumes created in the enabled AZs so they deliver full performance from the first I/O. Know the cost trap that comes with it: FSR bills per snapshot per AZ per hour (about USD 540 per month for one snapshot in one AZ), so enable it surgically, not on every nightly snapshot. <strong>A</strong> is false — the lazy-load behavior applies to every volume type including io2. <strong>C</strong> raises the performance ceiling but does nothing about blocks that still have to be hydrated from S3. <strong>D</strong> produces another snapshot with identical restore behavior. The free alternative, worth knowing even though it is not offered here, is pre-warming by reading every block once with dd or fio.`
    },
    {
      q: "An operations team keeps 30 daily incremental EBS snapshots of a volume. A new engineer warns that deleting snapshot 15 will corrupt every later snapshot because they are incremental. What actually happens when snapshot 15 is deleted?",
      options: [
        "All snapshots taken after snapshot 15 become unrestorable",
        "AWS blocks the deletion until all later snapshots are deleted first",
        "Blocks still referenced by other snapshots are retained, and every remaining snapshot can still restore a complete volume",
        "The volume must be re-snapshotted from scratch to re-establish a full baseline"
      ],
      answer: [2],
      multi: false,
      explanation: `<strong>C</strong> is how the block-reference model works: each snapshot is a manifest over a shared pool of stored blocks. Deleting one snapshot garbage-collects only the blocks no other snapshot references; anything still needed by snapshots 16-30 is retained and billed to them. Every surviving snapshot remains independently restorable — there is no tape-era full-plus-incrementals chain to protect. <strong>A</strong> is the intuition the question is built to trap, imported from traditional backup tools. <strong>B</strong> describes behavior that does not exist; any snapshot can be deleted at any time (barring Recycle Bin rules or locks). <strong>D</strong> is unnecessary for the same reason C is right. The practical corollary worth remembering: deleting old snapshots often frees far less storage than expected, because most of their blocks live on in newer snapshots.`
    },
    {
      q: "A media-processing platform runs an Auto Scaling group of Linux EC2 instances across three AZs. All instances need read-write access to the same POSIX directory tree, which grows unpredictably from gigabytes to hundreds of terabytes. Which storage service fits with the LEAST operational overhead?",
      options: [
        "A large gp3 volume attached to each instance, synchronized with rsync",
        "An io2 volume with Multi-Attach shared across the fleet",
        "Amazon EFS Regional with General Purpose performance mode",
        "FSx for Lustre persistent deployment",
        "S3 mounted on each instance with a FUSE adapter"
      ],
      answer: [2],
      multi: false,
      explanation: `<strong>C</strong> matches every requirement natively: EFS is NFSv4.1 POSIX storage, Regional mode stores data redundantly across AZs (so every AZ's instances mount a local target), capacity is fully elastic with pay-per-use, and there is nothing to provision or resize — minimal operational overhead by construction. <strong>A</strong> is an eventual-consistency science project: N divergent copies, rsync races, and write conflicts. <strong>B</strong> fails on two hard limits — Multi-Attach is single-AZ only and capped at 16 instances — plus it would require a cluster filesystem. <strong>D</strong> could perform, but Lustre is single-AZ, provisioned-capacity, and operationally heavier; it is for HPC throughput, not general shared storage. <strong>E</strong> breaks POSIX semantics (rename, append, locking) that applications on a directory tree typically assume — FUSE-over-object is a compatibility shim, not a filesystem.`
    },
    {
      q: "A company stores 60 TiB on EFS Standard. Analysis shows 85 percent of files have not been read in over 90 days, but occasionally an old file must be retrieved without operational intervention. What is the MOST cost-effective change?",
      options: [
        "Migrate the cold files to S3 Glacier Deep Archive with a script",
        "Configure EFS lifecycle management to transition files to Infrequent Access and Archive storage classes",
        "Convert the filesystem to EFS One Zone to reduce the per-GiB rate",
        "Move the filesystem to FSx for OpenZFS with compression enabled"
      ],
      answer: [1],
      multi: false,
      explanation: `<strong>B</strong> is the built-in answer: lifecycle policies transparently tier files into IA (about 92 percent cheaper) and Archive (about 97 percent cheaper) after configurable periods of no access, while every file stays in the same namespace and is retrieved automatically on access — no scripts, no operational retrieval step, and with 85 percent cold data the bill drops by well over half. <strong>A</strong> removes files from the filesystem namespace and Deep Archive restores take hours plus tooling — violating the retrieval requirement. <strong>C</strong> saves roughly 47 percent but silently downgrades durability and availability to a single AZ for all data, hot and cold — a resilience change disguised as a cost lever, and smaller savings than tiering. <strong>D</strong> is a migration project onto provisioned-capacity storage that eliminates the elastic pay-per-use model; compression will not beat 92-97 percent tiering discounts.`
    },
    {
      q: "An encrypted EBS snapshot must be shared with a partner AWS account so they can launch volumes from it. The snapshot is currently encrypted with the default aws/ebs key. Which TWO steps are required? (Select TWO.)",
      options: [
        "Copy the snapshot, re-encrypting it with a customer-managed KMS key",
        "Modify the snapshot permissions to make the snapshot public",
        "Grant the partner account usage permissions on the customer-managed KMS key",
        "Disable encryption on the snapshot copy so the partner can read it",
        "Enable EBS encryption by default in the partner account"
      ],
      answer: [0, 2],
      multi: true,
      explanation: `Snapshots encrypted with the account's default aws/ebs key can never be shared, because AWS-managed keys cannot be granted to other accounts. <strong>A</strong> fixes that: a snapshot copy is the operation where you can re-encrypt with a customer-managed key. <strong>C</strong> is the second half — sharing the snapshot alone is useless if the partner cannot decrypt, so the key policy or a grant must give the partner account kms:Decrypt and related permissions (the partner then typically copies the snapshot re-encrypting with their own key). <strong>B</strong> is both unnecessary and impossible — encrypted snapshots cannot be made public, only shared with specific accounts. <strong>D</strong> is impossible: encryption is a one-way ratchet; an encrypted snapshot cannot be copied to an unencrypted one. <strong>E</strong> affects volumes the partner creates, not their ability to read your snapshot.`
    },
    {
      q: "A company is retiring an on-premises Windows file server used for departmental shares. Requirements: SMB access, NTFS ACLs must keep working, authentication against the existing Active Directory, and the storage must survive an AZ outage. Which solution fits?",
      options: [
        "Amazon EFS with an access point per department",
        "FSx for Windows File Server deployed in Multi-AZ mode, joined to the existing AD",
        "FSx for Lustre with SMB enabled",
        "S3 File Gateway exposing SMB shares backed by S3"
      ],
      answer: [1],
      multi: false,
      explanation: `The keywords SMB, NTFS ACLs, and Active Directory route directly to <strong>B</strong>: FSx for Windows File Server is a managed Windows file cluster that joins your self-managed or AWS-managed AD, preserves NTFS ACLs, and in Multi-AZ mode runs a synchronous standby in a second AZ with automatic failover — every requirement met natively. <strong>A</strong> fails immediately: EFS speaks only NFS, has no SMB support, no NTFS ACLs, and no AD integration; access points enforce POSIX identities, not Windows ACLs. <strong>C</strong> invents a feature — Lustre has no SMB protocol support at all; it is a Linux HPC filesystem. <strong>D</strong> does offer SMB with AD auth, but it maps files to S3 objects and cannot preserve full NTFS ACL semantics, and a gateway is a hybrid cache appliance, not a replacement primary file server for an all-in-cloud migration.`
    },
    {
      q: "A genomics team stores 500 TiB of sequencing data in S3. Periodically they run analysis jobs on a large EC2 compute cluster that needs a POSIX filesystem with hundreds of GB/s of aggregate throughput. Results must land back in S3, and the filesystem is only needed during jobs. Which design is best?",
      options: [
        "EFS with Elastic throughput, syncing data from S3 with DataSync before each run",
        "FSx for Lustre linked to the S3 bucket, lazy-loading data on access and exporting results back to S3",
        "A fleet of io2 Block Express volumes striped across the cluster nodes",
        "FSx for NetApp ONTAP with the S3 data copied in via SnapMirror"
      ],
      answer: [1],
      multi: false,
      explanation: `This is the canonical FSx for Lustre scenario and <strong>B</strong> matches it feature for feature: a data repository association makes S3 objects visible as files with content hydrated lazily on first read (no bulk pre-copy of 500 TiB), the parallel architecture delivers hundreds of GB/s to a large client cluster, results export back to S3 via data repository tasks, and a scratch filesystem can be created per job and deleted afterward — you pay for the filesystem only while jobs run. <strong>A</strong> fails on physics and economics: EFS cannot reach hundreds of GB/s, and staging 500 TiB through DataSync before each run is slow and expensive. <strong>C</strong> is block storage per node, not a shared POSIX namespace, and striping EBS across nodes provides no shared filesystem semantics. <strong>D</strong> misuses SnapMirror (a NetApp-to-NetApp replication protocol, not an S3 ingest tool) and ONTAP is not built for parallel HPC throughput at this scale.`
    },
    {
      q: "An on-premises datacenter runs application servers that require iSCSI block volumes. The company wants to shrink its on-premises storage footprint to a small cache of frequently accessed data, keep the full dataset in AWS, and be able to recover volumes in EC2 during a disaster. Which service and mode fit?",
      options: [
        "Storage Gateway Volume Gateway in stored mode",
        "Storage Gateway Volume Gateway in cached mode",
        "Storage Gateway Tape Gateway with virtual tapes in Glacier",
        "S3 File Gateway with an NFS share",
        "FSx File Gateway in front of FSx for Windows File Server"
      ],
      answer: [1],
      multi: false,
      explanation: `<strong>B</strong> matches every clause: cached-mode Volume Gateway presents iSCSI volumes whose primary data lives in S3, keeps only the hot working set on local cache disks (the shrink-the-footprint requirement), and backs volumes with EBS snapshots that can be restored as EBS volumes for EC2-based DR. <strong>A</strong> inverts the storage placement: stored mode keeps the entire primary dataset on-premises and asynchronously backs it up to AWS — right when you need LAN latency for all data, wrong when the goal is minimizing local storage. <strong>C</strong> serves backup applications that expect a virtual tape library, not live iSCSI application volumes. <strong>D</strong> exposes file protocols mapped to S3 objects — the application requires block (iSCSI) semantics. <strong>E</strong> is an SMB cache for FSx for Windows shares, again file protocol, wrong layer entirely.`
    }
  ],
  flashcards: [
    { front: "gp3 baseline and maximum performance", back: `Baseline <strong>3,000 IOPS / 125 MBps at any size</strong>. Provision independently up to <strong>16,000 IOPS / 1,000 MBps</strong>; ratio cap 500 IOPS per GiB. ~20% cheaper per GiB than gp2.` },
    { front: "gp2 burst credit math", back: `Baseline <strong>3 IOPS per GiB</strong> (min 100), burst to 3,000 from a <strong>5.4M-credit bucket</strong>. Drain rate = actual minus baseline. 100 GiB volume at full burst dies in ~33 min. Watch <code>BurstBalance</code>.` },
    { front: "io2 Block Express headline numbers", back: `<strong>256,000 IOPS, 4,000 MBps, 64 TiB</strong> per volume, sub-millisecond latency, <strong>99.999% durability</strong>, 500 IOPS per GiB ratio. The SAN-replacement tier.` },
    { front: "st1 vs sc1 throughput model", back: `Per-TiB throughput with burst buckets: st1 <strong>40 MBps/TiB base, 250 burst</strong> (500 max); sc1 <strong>12/80</strong> (250 max). I/O counted in <strong>1 MiB units</strong> — sequential only, no boot volumes.` },
    { front: "Where is an EBS volume replicated?", back: `Synchronously across multiple storage nodes <strong>within a single AZ only</strong> — never across AZs. AZ failure = volume gone. Cross-AZ/region resilience comes from <strong>snapshots</strong> (stored in regional S3).` },
    { front: "How do you move an EBS volume to another AZ or region?", back: `You don't move the volume — <strong>snapshot it</strong>, optionally <code>copy-snapshot</code> to another region, then <strong>create a new volume from the snapshot</strong> in the target AZ. Snapshot is the unit of mobility.` },
    { front: "Elastic Volumes: three operational rules", back: `1) <strong>Grow only</strong> — never shrink. 2) <strong>One modification per 6 hours</strong> per volume. 3) EBS grows the device; <strong>you</strong> run <code>growpart</code> + <code>xfs_growfs</code>/<code>resize2fs</code>. Type/size/IOPS change live while attached.` },
    { front: "Does deleting a mid-chain EBS snapshot break later snapshots?", back: `<strong>No.</strong> Snapshots are manifests over shared blocks; deletion garbage-collects only blocks no other snapshot references. Every remaining snapshot can still restore a complete volume.` },
    { front: "Fast Snapshot Restore: what it fixes and what it costs", back: `Fixes the <strong>lazy-load penalty</strong> (restored volumes fetch blocks from S3 on first read). FSR pre-initializes volumes for full performance immediately. Cost: <strong>per snapshot, per AZ, per hour</strong> (~USD 540/month each) — enable surgically.` },
    { front: "Workflow to encrypt an existing unencrypted EBS volume", back: `No in-place path. <strong>Snapshot → copy the snapshot with encryption enabled</strong> (choose KMS key here) → <strong>create volume from encrypted copy</strong> → detach old, attach new. Encryption is also a ratchet: never removable.` },
    { front: "What does EBS encryption by default do and not do?", back: `Per-region account setting: all <strong>new</strong> volumes and snapshot copies are encrypted with the chosen KMS key, even from unencrypted AMIs. Does <strong>nothing retroactive</strong> to existing volumes.` },
    { front: "Sharing an encrypted snapshot with another account", back: `Impossible with the default <code>aws/ebs</code> key. Copy the snapshot re-encrypting with a <strong>customer-managed key</strong>, share the snapshot, and <strong>grant the account KMS permissions</strong> on that key.` },
    { front: "EBS Multi-Attach constraints", back: `<strong>io1/io2 only</strong>, up to <strong>16 Nitro instances</strong>, all in the <strong>same AZ</strong>, no boot volumes. Requires a <strong>cluster-aware filesystem</strong> (GFS2/OCFS2) — concurrent ext4/XFS mounts corrupt silently.` },
    { front: "DLM vs AWS Backup: when each?", back: `<strong>DLM</strong>: EBS snapshots/AMIs only, tag-driven schedules, free, simple. <strong>AWS Backup</strong>: multi-service (EBS, RDS, EFS, FSx, DynamoDB...), cross-account vaults, <strong>Vault Lock WORM</strong>, compliance reporting. Keywords centralized/immutable/compliance → AWS Backup.` },
    { front: "EFS protocol, port, and topology", back: `<strong>NFSv4.1 on TCP 2049</strong>, mounted via per-AZ <strong>mount targets</strong> (ENIs with security groups). Regional = multi-AZ redundant; One Zone = single AZ, ~47% cheaper. Mount hangs usually = missing SG rule for 2049.` },
    { front: "EFS throughput modes", back: `<strong>Elastic</strong> (default): scales instantly, pay per GiB transferred. <strong>Provisioned</strong>: fixed MiB/s billed 24/7 for steady loads. <strong>Bursting</strong> (legacy): 50 MiB/s per TiB stored + credit bucket — small filesystems stall when credits drain.` },
    { front: "EFS storage classes and lifecycle", back: `<strong>Standard / Infrequent Access (~92% cheaper) / Archive (~97% cheaper)</strong>, with retrieval fees on the cold tiers. Lifecycle policies auto-tier after N days without access and can return files to Standard on access. The default EFS cost-optimization answer.` },
    { front: "EFS access points", back: `Per-application entry doors that pin a <strong>root directory</strong> (server-side chroot) and can <strong>enforce a POSIX uid/gid</strong>, combined with IAM policies per access point. How Lambda/Fargate mount EFS; the multi-tenant isolation answer.` },
    { front: "FSx for Windows File Server: keywords", back: `<strong>SMB, NTFS ACLs, Active Directory, DFS Namespaces, Multi-AZ</strong> with automatic failover. Managed Windows file cluster for shares, home directories, lift-and-shift. Provisioned capacity + throughput pricing.` },
    { front: "FSx for Lustre: keywords and deployment types", back: `<strong>HPC/ML, sub-ms latency, hundreds of GB/s, S3 lazy-load + export</strong>. <strong>Scratch</strong> = no replication, cheap, temporary; <strong>Persistent</strong> = in-AZ replication. Single-AZ, Linux clients only.` },
    { front: "FSx for NetApp ONTAP: keywords", back: `<strong>Multi-protocol NFS + SMB + iSCSI</strong>, <strong>SnapMirror</strong> (migrate/replicate from on-prem NetApp), <strong>FlexClone</strong> instant writable clones, dedupe/compression/tiering, Multi-AZ. The only FSx serving block.` },
    { front: "FSx for OpenZFS: keywords", back: `<strong>NFS with ZFS snapshots and instant writable clones</strong>, latency down to hundreds of microseconds, ~1M IOPS. For ZFS/NFS appliance migrations and fast Linux NFS. No SMB, no AD.` },
    { front: "Volume Gateway: cached vs stored", back: `Both present <strong>iSCSI</strong> and snapshot to EBS. <strong>Cached</strong>: primary data in S3, local cache of hot set — minimize on-prem footprint. <strong>Stored</strong>: full primary copy on-prem, async backup to AWS — LAN latency for everything.` },
    { front: "S3 File Gateway vs Tape Gateway", back: `<strong>S3 File Gateway</strong>: NFS/SMB shares mapped 1:1 to S3 objects with local cache — file ingest to data lakes. <strong>Tape Gateway</strong>: iSCSI <strong>VTL</strong> for existing backup software; archived virtual tapes land in Glacier/Deep Archive.` },
    { front: "Block vs file vs object: cost and semantics in one line", back: `Ballpark: S3 ~0.023, gp3 ~0.08 (provisioned), EFS ~0.30 (used) USD/GiB-month. Block = mutable bytes, one writer, one AZ. File = shared POSIX/SMB, elastic. Object = immutable whole objects over HTTP, infinite scale, cheapest.` }
  ],
  lab: {
    title: "Lab: EBS performance tuning, snapshots, and the encrypt-by-copy workflow",
    html: `
<h3>Goal</h3>
<p>Exercise the full EBS lifecycle from the CLI: create a gp3 volume, attach and use it, modify performance live (Elastic Volumes), snapshot it, encrypt it via the snapshot-copy workflow, restore, and prove data integrity — the exact mechanics behind half the EBS exam questions. Cost: a t3.micro plus a few 10 GiB volumes and snapshots for under an hour — pennies. Everything is torn down at the end.</p>

<h3>Architecture</h3>
<p>One t3.micro (Amazon Linux 2023) in your default VPC with an attached 10 GiB gp3 data volume. You will write a marker file, bump the volume's IOPS live, snapshot it, copy the snapshot with KMS encryption, restore the encrypted copy as a second volume in the same AZ, attach it, and verify the marker file survived the round trip encrypted.</p>

<h3>Steps</h3>
<ol>
<li><p>Pick a region and AZ, and launch the instance. Get the current AL2023 AMI via SSM and launch (substitute your key pair name, or omit --key-name and use SSM Session Manager):</p>
<pre><code>aws ssm get-parameter \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query Parameter.Value --output text

aws ec2 run-instances --image-id ami-XXXX --instance-type t3.micro \
  --key-name YOUR_KEY --count 1 \
  --tag-specifications ResourceType=instance,Tags=[{Key=Name,Value=ebs-lab}] \
  --query Instances[0].[InstanceId,Placement.AvailabilityZone] --output text</code></pre>
<p>Note the instance ID (i-XXXX) and its AZ (e.g. us-east-1a) — the volume must be created in the <strong>same AZ</strong>; this constraint is the point of lesson 2.</p></li>

<li><p>Create a 10 GiB gp3 data volume in that AZ and attach it:</p>
<pre><code>aws ec2 create-volume --availability-zone us-east-1a \
  --size 10 --volume-type gp3 \
  --tag-specifications ResourceType=volume,Tags=[{Key=Name,Value=ebs-lab-data}] \
  --query VolumeId --output text

aws ec2 wait volume-available --volume-ids vol-XXXX
aws ec2 attach-volume --volume-id vol-XXXX --instance-id i-XXXX --device /dev/sdf</code></pre></li>

<li><p>SSH (or Session Manager) into the instance, make a filesystem, and write a marker. On Nitro the device appears as an NVMe name — find it with lsblk (it will be the 10 GiB disk, typically /dev/nvme1n1):</p>
<pre><code>lsblk
sudo mkfs.xfs /dev/nvme1n1
sudo mkdir -p /data
sudo mount /dev/nvme1n1 /data
echo "written-before-encryption" | sudo tee /data/marker.txt
sudo umount /data   # unmount so the snapshot is clean</code></pre></li>

<li><p>Modify the volume live — raise IOPS to 6,000 and throughput to 250 MBps (an Elastic Volumes operation; note you could not run a second modification for 6 hours):</p>
<pre><code>aws ec2 modify-volume --volume-id vol-XXXX --iops 6000 --throughput 250
aws ec2 describe-volumes-modifications --volume-ids vol-XXXX \
  --query VolumesModifications[0].[ModificationState,TargetIops] --output text</code></pre>
<p>The state moves through modifying → optimizing → completed. The volume serves I/O the whole time.</p></li>

<li><p>Snapshot the (unencrypted) volume and wait for completion:</p>
<pre><code>aws ec2 create-snapshot --volume-id vol-XXXX \
  --description "ebs-lab pre-encryption" --query SnapshotId --output text
aws ec2 wait snapshot-completed --snapshot-ids snap-XXXX</code></pre></li>

<li><p>Encrypt by copying. This is the only way to encrypt existing data — there is no in-place option. The copy uses your account's default EBS KMS key here; add --kms-key-id to choose a customer-managed key:</p>
<pre><code>aws ec2 copy-snapshot --source-region us-east-1 \
  --source-snapshot-id snap-XXXX --encrypted \
  --description "ebs-lab encrypted copy" --query SnapshotId --output text
aws ec2 wait snapshot-completed --snapshot-ids snap-YYYY
aws ec2 describe-snapshots --snapshot-ids snap-YYYY \
  --query Snapshots[0].Encrypted</code></pre>
<p>That last call must print <strong>true</strong>.</p></li>

<li><p>Restore the encrypted snapshot as a new volume in the same AZ and attach it as a second device:</p>
<pre><code>aws ec2 create-volume --availability-zone us-east-1a \
  --snapshot-id snap-YYYY --volume-type gp3 \
  --tag-specifications ResourceType=volume,Tags=[{Key=Name,Value=ebs-lab-encrypted}] \
  --query VolumeId --output text
aws ec2 wait volume-available --volume-ids vol-ENC
aws ec2 attach-volume --volume-id vol-ENC --instance-id i-XXXX --device /dev/sdg</code></pre></li>

<li><p>On the instance, mount the restored volume and read the marker. The first read of each block lazy-loads from S3 — on a 10 GiB volume you won't feel it, but this is the latency FSR eliminates at scale:</p>
<pre><code>lsblk    # the new 10 GiB disk, typically /dev/nvme2n1
sudo mkdir -p /restored
sudo mount /dev/nvme2n1 /restored
cat /restored/marker.txt</code></pre></li>
</ol>

<h3>Verify</h3>
<ul>
<li><code>cat /restored/marker.txt</code> prints <strong>written-before-encryption</strong> — the data made the unencrypted → snapshot → encrypted-copy → restore round trip intact.</li>
<li><code>aws ec2 describe-volumes --volume-ids vol-ENC --query Volumes[0].Encrypted</code> prints <strong>true</strong>, while the same query on vol-XXXX prints <strong>false</strong> — same data, different encryption state, proving encryption happened at copy time.</li>
<li><code>describe-volumes-modifications</code> on vol-XXXX shows ModificationState completed with TargetIops 6000 — a live performance change with zero downtime.</li>
</ul>

<h3>Teardown</h3>
<p>Order matters: unmount, detach, terminate, then delete volumes and snapshots (snapshots bill until deleted, and the instance must go before non-root volumes can be cleanly detached-deleted).</p>
<ol>
<li><p>On the instance: <code>sudo umount /data /restored</code> (ignore errors if not mounted).</p></li>
<li><p>Detach both data volumes:</p>
<pre><code>aws ec2 detach-volume --volume-id vol-XXXX
aws ec2 detach-volume --volume-id vol-ENC
aws ec2 wait volume-available --volume-ids vol-XXXX vol-ENC</code></pre></li>
<li><p>Terminate the instance (its root volume auto-deletes):</p>
<pre><code>aws ec2 terminate-instances --instance-ids i-XXXX
aws ec2 wait instance-terminated --instance-ids i-XXXX</code></pre></li>
<li><p>Delete both data volumes:</p>
<pre><code>aws ec2 delete-volume --volume-id vol-XXXX
aws ec2 delete-volume --volume-id vol-ENC</code></pre></li>
<li><p>Delete both snapshots (check for Recycle Bin retention rules if your account uses them — bin-held snapshots still bill):</p>
<pre><code>aws ec2 delete-snapshot --snapshot-id snap-XXXX
aws ec2 delete-snapshot --snapshot-id snap-YYYY</code></pre></li>
<li><p>Confirm nothing is left billing:</p>
<pre><code>aws ec2 describe-volumes \
  --filters Name=tag:Name,Values=ebs-lab-data,ebs-lab-encrypted --query Volumes
aws ec2 describe-snapshots --owner-ids self \
  --filters Name=description,Values="ebs-lab*" --query Snapshots</code></pre>
<p>Both should return empty lists.</p></li>
</ol>
`
  }
});
