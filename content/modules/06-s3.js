window.COURSE.register({
  id: "s3",
  order: 6,
  track: "saa",
  title: "S3 Deep Dive",
  description: "S3 as it actually is: a strongly consistent key-value store over immutable objects, with a dozen storage classes, a policy-evaluation maze, and a cost model full of traps. This module covers the object model, consistency semantics, storage class economics, replication, encryption, access control, performance limits, and the operational features (Object Lock, events, Storage Lens) the exam loves.",
  examWeight: "Heaviest single service on SAA-C03. Expect 8-12 questions touching S3 directly: storage class selection with cost constraints, encryption key management, replication design, public-access lockdown, and presigned URL scenarios. It also appears as the substrate in half the other domains (data lakes, static hosting, backup targets).",
  lessons: [
    {
      id: "object-model",
      title: "What S3 actually is: a KV store, not a filesystem",
      html: `
<p>Strip away the console UI and S3 is a massively replicated <strong>key-value store</strong>: the key is a UTF-8 string up to 1,024 bytes, the value is an <strong>immutable blob</strong> up to 5 TiB plus a small bag of metadata. Everything else — folders, renames, appends — is an illusion layered on top by clients, and most S3 design mistakes come from believing the illusion.</p>

<h3>Immutability is the core invariant</h3>
<p>You never modify an object in place. A PUT to an existing key writes a complete new object (or, with versioning, a new version). There is no append, no partial overwrite, no <code>seek()</code>-and-write. If you need to change byte 5 of a 1 GiB object, you upload 1 GiB again (or copy parts server-side with multipart <code>UploadPartCopy</code>). This is why S3 is superb for write-once artifacts, logs, images, and backups, and wrong as a POSIX substitute for databases or actively mutated files.</p>

<p>There is also <strong>no rename</strong>. What every tool calls "rename" or "move" is <code>CopyObject</code> + <code>DeleteObject</code> — two operations, two requests billed, non-atomic, and O(size) for the copy. "Renaming a directory" of a million objects is a million copies plus a million deletes. Systems that lean on atomic directory renames for commit protocols (classic Hadoop output committers, some ETL tools) either need rewritten committers or a table format (Iceberg, Delta, Hudi) that commits via metadata instead of renames.</p>

<h3>Prefixes, not directories</h3>
<p>Keys like <code>logs/2026/07/21/host1.gz</code> contain slashes, but S3 stores that as one flat key. "Folders" are a client-side convention: the <code>ListObjectsV2</code> API takes a <code>prefix</code> and an optional <code>delimiter</code> (usually <code>/</code>) and synthesizes a hierarchy by grouping keys into <code>CommonPrefixes</code>. Consequences a senior engineer should internalize:</p>
<ul>
<li>An "empty folder" doesn't exist unless a client created a zero-byte object with a trailing slash.</li>
<li>Listing is lexicographic over the keyspace, paginated 1,000 keys per response. Enumerating 100 M objects via List is slow and expensive — use <strong>S3 Inventory</strong> (daily/weekly manifest to a bucket) for bulk enumeration instead.</li>
<li>Deleting a "folder" means listing and deleting every key under the prefix (DeleteObjects batches 1,000 per call).</li>
</ul>

<h3>Buckets, naming, and the namespace</h3>
<p>Buckets are the unit of policy, region residency, replication, and (partially) throughput. Names are <strong>globally unique across all AWS accounts</strong>, DNS-compatible, and unchangeable — as is the bucket's region. Requests are addressed virtual-hosted style (<code>bucket.s3.region.amazonaws.com</code>); path-style addressing is deprecated. Because bucket names land in DNS and in certificate SANs, treat them as public information: never embed secrets in bucket or key names.</p>

<div class="callout limits">Numbers worth memorizing: max object size <strong>5 TiB</strong>; max single PUT <strong>5 GiB</strong> (use multipart above that, recommended above 100 MiB); key length 1,024 bytes; default <strong>10,000 buckets per account</strong> (raised from 100; can go to 1 M via quota increase); metadata per object ~2 KB of user-defined headers; tags 10 per object. Buckets per account is a soft quota — but bucket <em>names</em> are a global race, so infra code must tolerate name collisions.</div>

<h3>What an object carries</h3>
<p>Besides the payload: system metadata (size, last-modified, <strong>ETag</strong>, storage class), user metadata (<code>x-amz-meta-*</code> headers, set only at write time — changing metadata means rewriting the object via self-copy), up to 10 tags (mutable, usable in IAM conditions, lifecycle filters, and cost allocation), and an optional checksum (CRC32/CRC32C/CRC64NVME/SHA-1/SHA-256) if you enable additional checksums. The ETag is the MD5 of the payload <em>only</em> for single-part, non-KMS uploads; for multipart uploads it is the MD5 of the concatenated part MD5s plus a part-count suffix. Code that "verifies integrity" by comparing ETag to a local MD5 silently breaks the day someone uploads with multipart or SSE-KMS — use the checksum feature instead.</p>

<h3>Durability vs availability</h3>
<p>S3 advertises <strong>99.999999999% (11 nines) durability</strong>: objects are erasure-coded/replicated across devices in <strong>at least 3 Availability Zones</strong> (except the One Zone classes). Durability is about not losing bytes; <strong>availability</strong> is a separate, much weaker promise — 99.99% design / 99.9% SLA for Standard. Design for it: S3 can and does return 500/503 under normal operation, and every serious client (including the AWS SDKs) retries with exponential backoff and jitter. Durability also does not protect you from yourself: deletion, overwrite, and account compromise are the real data-loss vectors, which is why versioning, replication, and Object Lock exist.</p>

<div class="callout deep">Under the hood S3 is a set of microservices over a keymap (index) layer and a storage layer (ShardStore). The index is partitioned by key range — this is why per-prefix throughput limits exist and why S3 "scales to your workload" by splitting hot key-range partitions over minutes, returning <code>503 SlowDown</code> while it does. The 2020 strong-consistency work put the metadata cache behind a consensus-backed witness so reads always observe the latest ack'd write.</div>

<div class="callout exam">Trap patterns: "application needs to modify part of a large file frequently" → S3 is the wrong answer; pick EBS/EFS. "Rename thousands of files atomically" → not S3. "Hierarchical file permissions per directory" → EFS/FSx, not S3. Conversely "unlimited scale, 11 nines durability, pay per GB, static content / backups / data lake" → S3 every time.</div>

<div class="callout war">Real-world bite: tools that "sync" by comparing ETags to MD5s report false mismatches on multipart uploads; teams then re-upload terabytes nightly. Second bite: lexicographic listing means a prefix scheme of <code>date/customer</code> forces full-range scans for per-customer queries — key design is schema design. Decide your query patterns before you write your first key.</div>
`
    },
    {
      id: "consistency",
      title: "Consistency: what strong read-after-write does and doesn't give you",
      html: `
<p>Since <strong>December 2020</strong>, S3 is <strong>strongly consistent</strong> for all operations, in all regions, at no extra cost: after a successful PUT (new object <em>or</em> overwrite) or DELETE, any subsequent GET, HEAD, or LIST observes the change. The old caveats you may remember — eventual consistency on overwrite, negative-caching after a GET-before-PUT, lists lagging writes — are gone. Read-after-write, read-after-update, read-after-delete, and list consistency all hold.</p>

<h3>The mental model</h3>
<p>Think linearizable per-key register. Every ack'd write is immediately visible to every reader worldwide (within the region — S3 is regional; cross-region replication is a separate, asynchronous story). This killed a whole genre of workarounds: no more "write then poll until visible," no more DynamoDB-backed consistency layers (EMRFS consistent view, S3Guard) — both were retired after the change.</p>

<h3>What strong consistency still does NOT give you</h3>
<p>This is where the exam and production both bite. S3 is a per-object register, not a database:</p>
<ul>
<li><strong>No cross-object transactions.</strong> Writing <code>data.parquet</code> then <code>_SUCCESS</code> is two independent operations; a reader can see the marker while a concurrent failure left other files missing, and a crash between the two leaves a torn state. Multi-object atomicity must come from your own commit protocol — typically a single manifest/pointer object written last, which readers treat as the source of truth (exactly how Iceberg and Delta Lake commit).</li>
<li><strong>No locking, no compare-and-swap on content.</strong> Two clients PUT the same key concurrently: both succeed, <strong>last writer wins</strong>, and "last" is decided by S3's internal ordering, not by your wall clocks. There is no built-in mutex, lease, or fencing token.</li>
<li><strong>No read-modify-write primitive.</strong> GET, mutate locally, PUT is a race window; two updaters silently drop each other's changes.</li>
<li><strong>No multi-key snapshot isolation.</strong> A LIST plus a series of GETs can interleave with writers; you can observe a state that never existed at any single instant.</li>
</ul>

<h3>Conditional writes: the escape hatch</h3>
<p>S3 now supports write preconditions, and they matter architecturally. <code>If-None-Match: *</code> on PUT/CompleteMultipartUpload means "create only if the key does not exist" — the PUT fails with <code>412 Precondition Failed</code> if someone beat you. <code>If-Match: &lt;etag&gt;</code> means "overwrite only if the current object still has this ETag" — an optimistic-concurrency CAS. With these you can build leader election, exactly-once manifest commits, and idempotent writers directly on S3, no DynamoDB lock table required. They are per-key only; there is still nothing transactional across keys.</p>

<pre><code>aws s3api put-object \
  --bucket my-bucket --key manifests/commit-000123.json \
  --body commit.json \
  --if-none-match "*"
# second concurrent writer receives: PreconditionFailed (412)</code></pre>

<div class="callout deep">How AWS made it strong: object metadata is served from a replicated cache, and the 2020 change added per-key witness state that the cache checks so a read is never served from a stale replica. Strong consistency applies to object data and its metadata together — a HEAD after PUT sees the new size, ETag, and storage class. It cost nothing in latency because the witness check is on the metadata path, not the data path.</div>

<div class="callout exam">Keyword mapping: "application immediately reads objects after writing them" → no special design needed, S3 is strongly consistent (answers proposing 'wait and retry' or 'use DynamoDB to track state for consistency' are wrong post-2020). But "multiple writers update the same object and updates are being lost" → S3 has no locking; the fix is application-level (conditional writes, a queue serializing writers, or DynamoDB for the mutable record). "Atomic update of many related files" → write a manifest object last, or use a transactional table format.</div>

<h3>Versioning interaction</h3>
<p>With versioning enabled, concurrent PUTs to one key don't destroy each other's bytes — each writer's payload persists as a distinct version, and the "current" version is whichever S3 ordered last. That converts silent data loss into recoverable history, which is one of the strongest operational arguments for versioning even when you never plan to "roll back." But note: readers doing plain GETs still only see the current version, so versioning does not fix race semantics — it only makes the losing write recoverable by a human later.</p>

<h3>Design consequences</h3>
<ul>
<li>Model mutable state as <em>new immutable objects plus a pointer</em>, not in-place edits. The pointer object is the unit of atomicity; swing it with If-Match.</li>
<li>Serialize genuinely contended writes through one writer (an SQS FIFO consumer, a single Lambda per key-partition) rather than hoping.</li>
<li>Idempotency: S3 retries (yours and the SDK's) mean the same PUT may land twice. Immutability makes blind PUT retries safe; DELETE retries are safe; but sequences of dependent operations need your own idempotency keys.</li>
<li>Cross-region reads after cross-region replication are <em>eventually</em> consistent by nature — replication lag is seconds to minutes (or bounded at 15 minutes with RTC, next lessons). Strong consistency is a single-region promise.</li>
</ul>

<div class="callout war">A classic incident shape: a "config service" stores one JSON object that several deployers write with GET-edit-PUT. Two simultaneous releases each read v17, wrote v18, and one team's flags vanished — no error anywhere, because last-writer-wins is not an error. Post-mortem fix was a one-line change to conditional PUT with If-Match and retry-on-412. If a single object is a shared mutable record, treat it like a row with optimistic locking or move it to DynamoDB.</div>
`
    },
    {
      id: "storage-classes",
      title: "Storage classes and the cost-trap math",
      html: `
<p>Storage classes are per-<em>object</em> (not per-bucket) and are pure economics: same API, same 11-nines durability (except One Zone's blast radius), different prices on three dimensions — <strong>storage per GB-month</strong>, <strong>request/retrieval fees</strong>, and <strong>minimum billable duration</strong>. Choosing well is arithmetic, not taste; the exam tests exactly that arithmetic.</p>

<h3>The lineup (us-east-1 ballpark prices — memorize relative order, not cents)</h3>
<table>
<thead><tr><th>Class</th><th>Storage/GB-mo</th><th>Retrieval fee</th><th>Min duration</th><th>First byte</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>Standard</td><td>~$0.023</td><td>none</td><td>none</td><td>ms</td><td>default; 3+ AZs</td></tr>
<tr><td>Intelligent-Tiering</td><td>tier-dependent</td><td><strong>none</strong></td><td>none</td><td>ms (opt-in archive tiers slower)</td><td>+$0.0025/1,000 objects monitoring</td></tr>
<tr><td>Standard-IA</td><td>~$0.0125</td><td>$0.01/GB</td><td><strong>30 days</strong></td><td>ms</td><td>128 KiB min billable size</td></tr>
<tr><td>One Zone-IA</td><td>~$0.01</td><td>$0.01/GB</td><td>30 days</td><td>ms</td><td><strong>single AZ</strong> — AZ loss destroys data</td></tr>
<tr><td>Glacier Instant Retrieval</td><td>~$0.004</td><td>$0.03/GB</td><td><strong>90 days</strong></td><td>ms</td><td>archive economics, live access</td></tr>
<tr><td>Glacier Flexible Retrieval</td><td>~$0.0036</td><td>varies</td><td>90 days</td><td>minutes-hours</td><td>expedited 1-5 min / standard 3-5 h / bulk 5-12 h (bulk free)</td></tr>
<tr><td>Glacier Deep Archive</td><td>~$0.00099</td><td>varies</td><td><strong>180 days</strong></td><td>hours</td><td>standard ~12 h / bulk up to 48 h</td></tr>
</tbody>
</table>

<p>Flexible Retrieval and Deep Archive objects are <strong>not directly readable</strong>: you issue a <code>RestoreObject</code>, wait for the retrieval tier's window, then read a temporary Standard-class copy that lives for the number of days you asked for. Instant Retrieval, by contrast, is a normal GET — you pay the fat per-GB retrieval price instead of waiting.</p>

<h3>Intelligent-Tiering: the "stop thinking about it" class</h3>
<p>I-T watches each object's access and moves it automatically: <strong>Frequent Access</strong> → after 30 days untouched, <strong>Infrequent Access</strong> (IA prices) → after 90 days, <strong>Archive Instant Access</strong> (Glacier IR prices). Two opt-in async tiers go further: <strong>Archive Access</strong> (90+ days, Flexible-like, needs restore) and <strong>Deep Archive Access</strong> (180+ days). Any access moves the object back to Frequent — with <strong>no retrieval fee, ever</strong>, which is I-T's superpower versus hand-rolled IA transitions. You pay a monitoring fee of $0.0025 per 1,000 objects/month; objects under 128 KiB are not monitored and just ride at Frequent rates. There is no minimum duration. Rule of thumb: unknown or shifting access patterns → I-T; the monitoring fee only hurts when objects are tiny and numerous.</p>

<h3>The cost traps — do the math the exam wants</h3>
<ul>
<li><strong>Minimum duration charges.</strong> Delete (or transition, or overwrite) an IA object at day 10 and you're billed the remaining 20 days pro-rated. Deep Archive at day 30 → billed 150 more days. Churny data in archive classes costs more than Standard.</li>
<li><strong>Minimum object size.</strong> Standard-IA/One Zone-IA bill at least <strong>128 KiB</strong> per object. A million 4 KiB objects "moved to IA to save money" bill as 122 GiB instead of 3.8 GiB — a cost <em>increase</em>.</li>
<li><strong>Per-object archive overhead.</strong> Every object in the Glacier classes carries ~<strong>40 KiB</strong> of metadata overhead (8 KiB at Standard rates for the name/index + 32 KiB at Glacier rates). Millions of small files in Deep Archive can cost more in overhead than payload. Fix: aggregate small files (tar) before archiving.</li>
<li><strong>Retrieval fees dominate for warm data.</strong> Standard-IA saves ~$0.0105/GB-mo but charges $0.01/GB to read. Break-even is roughly <strong>reading the data once a month</strong> — if average access frequency is higher, IA is more expensive than Standard. Same logic, harsher, for Glacier IR at $0.03/GB.</li>
<li><strong>Transition request fees.</strong> Lifecycle transitions bill per 1,000 requests (Glacier-bound transitions ~$0.03-0.05/1,000). Ten million objects to Deep Archive is a real invoice line; again, aggregation helps.</li>
</ul>

<div class="callout exam">Class-selection questions are keyword arithmetic. "Accessed once a quarter, needed within milliseconds when accessed, minimize cost" → Glacier Instant Retrieval. "Regulatory archive, retained 7 years, retrieval within 12-48 hours acceptable" → Deep Archive. "Unpredictable access pattern" → Intelligent-Tiering. "Re-creatable data, secondary copy, lowest cost with instant access" → One Zone-IA (the word <em>re-creatable</em> or <em>easily reproduced</em> is the tell — you accept AZ loss). "Must be retained 30 days then rarely read" → careful: transition to IA at day 30, not before (transitions to IA earlier than 30 days are disallowed/pointless anyway).</div>

<div class="callout limits">Minimum durations: IA classes <strong>30 days</strong>, Glacier IR + Flexible <strong>90 days</strong>, Deep Archive <strong>180 days</strong>. Retrieval windows: expedited 1-5 min (Flexible only, capacity not guaranteed without provisioned capacity units), standard 3-5 h (Flexible) / ~12 h (Deep), bulk 5-12 h (free on Flexible) / up to 48 h (Deep). Lifecycle cannot transition objects smaller than 128 KiB to IA classes.</div>

<div class="callout war">The recurring production story: someone lifecycle-transitions a logging bucket with hundreds of millions of ~10 KiB objects into Glacier. Result — a one-time transition bill in the thousands, per-object overhead exceeding payload, and a compliance restore later that takes days and costs per-GB retrieval on the whole set. The professional pattern is: compact small objects into large archives (Athena/EMR job writing daily tarballs or Parquet), then archive the aggregates. Also: One Zone-IA in a bucket people assumed was "normal S3" — an AZ event is a permanent data loss event for that class; it must only ever hold copies you can regenerate.</div>

<p><strong>When NOT to tier at all:</strong> data with sub-30-day lifetime (just expire it from Standard), hot data (Standard's zero retrieval fee wins), and tiny objects (minimum-size and overhead rules eat the savings). Storage class analysis and Storage Lens (last lesson) tell you empirically which prefixes are actually cold before you commit.</p>
`
    },
    {
      id: "lifecycle-versioning",
      title: "Lifecycle rules, versioning, and delete markers",
      html: `
<p>Lifecycle and versioning are two halves of one system: versioning defines <em>what states an object can be in</em>; lifecycle is the <em>declarative garbage collector</em> that moves and deletes those states on a schedule. Misunderstanding their interaction is the number-one cause of both surprise bills and surprise data loss in S3.</p>

<h3>Versioning mechanics</h3>
<p>Versioning is a bucket-level, three-state setting: <strong>unversioned → enabled → suspended</strong> (never back to unversioned). Once enabled, every PUT creates a new version with an opaque <code>versionId</code>; the newest is the "current" version. Old versions ("noncurrent") persist — and bill — until explicitly deleted. GETs without a versionId return the current version; GETs with one fetch any version (subject to permissions — <code>s3:GetObjectVersion</code> is a distinct action).</p>

<p>A plain DELETE on a versioned bucket deletes nothing. It inserts a <strong>delete marker</strong> — a zero-byte tombstone that becomes the current version, making the key invisible to normal GETs (404) and LISTs. All prior versions remain. To truly remove data you must delete <em>specific versionIds</em>; to "undelete," you delete the delete marker itself and the previous version becomes current again. Suspending versioning stops creating new versions but leaves all existing versions and markers in place.</p>

<pre><code># the tombstone
aws s3api delete-object --bucket b --key app.conf
# undelete: remove the marker (needs its versionId)
aws s3api list-object-versions --bucket b --prefix app.conf
aws s3api delete-object --bucket b --key app.conf \
  --version-id &lt;delete-marker-version-id&gt;</code></pre>

<div class="callout war">Two production classics. (1) "We enabled versioning for safety" on a bucket where an app overwrites the same 100 MB file every 5 minutes — six months later the bucket holds 50,000 invisible noncurrent versions and a 5 TB bill for a 100 MB file. Versioning without a noncurrent-expiration lifecycle rule is an unbounded storage leak. (2) An emptied-and-"deleted" bucket that won't die: <code>aws s3 rm --recursive</code> only issues plain DELETEs, which on a versioned bucket just piles delete markers on top. You must purge with <code>list-object-versions</code> and delete every versionId and marker explicitly.</div>

<h3>Lifecycle rules: the declarative GC</h3>
<p>A lifecycle configuration is up to 1,000 rules per bucket. Each rule has a <strong>filter</strong> (prefix, tags, object size min/max, or a combination) and <strong>actions</strong>:</p>
<ul>
<li><strong>Transition</strong> current versions to another class after N days (only "downhill": Standard → IA → Glacier IR → Flexible → Deep Archive; never back up — moving data back is a copy you do yourself).</li>
<li><strong>Expiration</strong> of current versions after N days (on a versioned bucket this creates a delete marker, it does not destroy data).</li>
<li><strong>NoncurrentVersionTransition / NoncurrentVersionExpiration</strong> — act on versions N days after they <em>became noncurrent</em>, optionally keeping the newest K noncurrent versions. This is the leak-plugging rule every versioned bucket needs.</li>
<li><strong>ExpiredObjectDeleteMarker</strong> — removes delete markers that have no versions left behind them (otherwise tombstones linger forever and slow listings).</li>
<li><strong>AbortIncompleteMultipartUpload</strong> after N days — orphaned MPU parts are invisible to every listing you normally run but bill as storage. Every bucket, ever, should have this rule (7 days is conventional).</li>
</ul>

<h3>Timing and evaluation semantics</h3>
<p>Lifecycle runs <strong>once a day, asynchronously</strong>, and rounds to midnight UTC of the following day — an object "expiring after 1 day" may live ~48 hours. Billing, however, stops at the object's <em>eligibility</em> time, not when the daily run gets to it. Transitions are one-way per run; an object can cascade (Standard → IA at 30 → Deep Archive at 365) across rules. When rules conflict, expiration beats transition, and the cheaper/deeper transition wins among transitions. Remember the interaction with class minimums from the last lesson: transitioning an IA object at day 35 that only arrived in IA at day 30 triggers the 30-day-minimum early-transition charge.</p>

<div class="callout exam">Lifecycle scenarios test three things. (1) The versioning trap: "delete objects after 90 days" on a versioned bucket → you need <em>both</em> current-version expiration <em>and</em> noncurrent-version expiration (plus delete-marker cleanup) or the data never actually leaves. (2) Cost cleanup: "storage costs growing despite deleting objects" → noncurrent versions or incomplete multipart uploads; answer is the corresponding lifecycle rule. (3) Sequencing: minimum 30 days before IA transition, and you cannot transition to One Zone-IA before 30 days either — an option offering "transition to Standard-IA after 7 days" is a distractor (S3 disallows it).</div>

<div class="callout deep">Delete markers are real index entries: a key deleted-and-rewritten daily accumulates markers that make <code>ListObjectVersions</code> responses balloon. MFA Delete is the paranoid cousin of all this — with it enabled (root + CLI only, cannot be set in console), changing versioning state or permanently deleting a version requires an MFA code. It predates Object Lock and is awkward operationally (root credentials on the CLI); the modern answer for tamper-proofing is Object Lock, but MFA Delete still appears as an exam option and is legitimate for "prevent accidental permanent deletion by administrators."</div>

<div class="callout limits">1,000 rules per bucket; filters combine prefix + up to some tags + size bounds; minimum 30 days in Standard before IA transition; lifecycle is free to configure but transition <em>requests</em> are billed per 1,000 objects; expiration requests are free. Lifecycle actions do <strong>not</strong> fire event notifications you might expect — they emit specific <code>LifecycleExpiration</code>/<code>LifecycleTransition</code> event types only if you subscribed to them (EventBridge or the newer notification types), not ordinary delete events in older setups.</div>

<h3>Design guidance</h3>
<p>Treat lifecycle as part of the bucket's contract, defined in IaC alongside the bucket: (1) AbortIncompleteMultipartUpload — always. (2) If versioned: noncurrent expiration (keep K versions for N days sized to your recovery SLO) plus expired-marker cleanup — always. (3) Transitions only after Storage Lens / storage-class-analysis evidence, and only for objects large enough to clear the 128 KiB floor. When you can tag at write time (e.g., <code>retention=7y</code>), tag-based rules beat prefix archaeology later.</p>
`
    },
    {
      id: "replication",
      title: "Replication: SRR, CRR, RTC, and what doesn't replicate",
      html: `
<p>S3 replication is an <strong>asynchronous, server-side, one-way copy</strong> of objects from a source bucket to one or more destinations, driven by rules in the source bucket's replication configuration. It is not a sync protocol and not a backup by itself — it is a pipeline that forwards <em>new writes</em>. Internalize that and its many exclusions make sense.</p>

<h3>Prerequisites and variants</h3>
<p><strong>Versioning must be enabled on both source and destination</strong> — replication is defined over versions, not keys. Replication needs an IAM role S3 assumes to read source and write destination. Variants:</p>
<ul>
<li><strong>CRR</strong> (cross-region): DR, latency-local copies, compliance residency. Pays inter-region transfer per GB.</li>
<li><strong>SRR</strong> (same-region): log aggregation from many buckets into one, prod→test data copies, or a second copy in another <em>account</em> for isolation.</li>
<li><strong>Cross-account</strong> (either variant): destination bucket policy must let the source's replication role write; add <strong>owner override</strong> so replicas are owned by the destination account — critical for security isolation, otherwise the compromised source account still owns (and can delete) the "offsite" copies.</li>
<li>One-to-many (multiple destination rules) and bi-directional (two independent configs) are supported; two-way replication needs <strong>replica modification sync</strong> both ways to converge metadata.</li>
</ul>

<h3>What replicates, what doesn't — the exam's favorite list</h3>
<ul>
<li><strong>Only objects written after the rule exists.</strong> Pre-existing objects need <strong>S3 Batch Replication</strong> (a Batch Operations job, also used to retry previously failed/skipped objects).</li>
<li><strong>Delete markers: optional.</strong> Off by default. <strong>Deletes of specific versionIds never replicate</strong> — deliberate, so a malicious or accidental permanent delete at the source cannot destroy the replica. Your replica cleans up via its own lifecycle rules.</li>
<li><strong>Replicas don't re-replicate.</strong> A→B and B→C does not put A's objects in C (no transitive chaining through the same objects).</li>
<li><strong>Lifecycle actions don't replicate.</strong> Expirations/transitions at the source are not forwarded; each side runs its own lifecycle. (Replication rules can, however, target a different storage class on write — replicate straight into Deep Archive for the DR copy.)</li>
<li><strong>SSE-C objects don't replicate.</strong> SSE-S3 replicates by default; SSE-KMS replicates only if the rule opts in and the role can decrypt with the source key and encrypt with the destination key (multi-Region keys make this less painful but are not required).</li>
<li>Objects the role can't read (deny policies), and Glacier/Deep Archive class objects, are skipped.</li>
</ul>

<h3>Timing: best-effort vs RTC</h3>
<p>Default replication is best-effort — the vast majority of objects land within seconds-to-minutes, but there is <strong>no SLA</strong>, and backlogs during incidents can stretch to hours. <strong>Replication Time Control (RTC)</strong> gives a contractual <strong>99.99% of objects within 15 minutes</strong>, and turns on per-minute replication metrics (bytes/operations pending, latency) plus <code>OperationMissedThreshold</code> EventBridge events. RTC costs extra per GB. The design rule: RPO requirement stated in minutes → RTC; "eventually, for DR" → default is fine, but alarm on the metrics either way.</p>

<h3>Replica modification sync</h3>
<p>Normally replication is strictly source→destination and only for writes. <strong>Replica modification sync</strong> extends it to <em>metadata changes made on replicas</em> (tags, ACLs, Object Lock retention) so they flow back and both sides converge — the ingredient that makes active-active, two-way replication setups coherent. Without it, a tag added on the replica silently diverges forever.</p>

<div class="callout deep">Mechanically, replication is an internal changefeed consumer: each new version lands on a per-rule queue, and workers copy object + metadata with the assumed role. <code>HeadObject</code> on a source object shows <code>ReplicationStatus: PENDING → COMPLETED</code> (or FAILED); the replica shows <code>REPLICA</code>. That header is your per-object audit tool. Because the copy is async, a region failover can lose the tail — measure it with the pending-bytes metric, and drain writes before planned failovers.</div>

<div class="callout exam">Keyword mapping: "objects must appear in the second region within 15 minutes, with visibility into compliance" → CRR + <strong>RTC</strong>. "Replicate existing objects" → <strong>Batch Replication</strong> (any answer implying enabling the rule copies history is wrong). "Aggregate logs from multiple buckets into one, same region" → <strong>SRR</strong>. "Protect the copy from deletion if the production account is compromised" → cross-<em>account</em> replication + owner override (+ Object Lock on the destination for full ransomware posture). "Deleted a version at source, replica still has it" → by design; versionId deletes don't replicate.</div>

<div class="callout war">Failure modes seen in the wild: (1) KMS — rule enabled, role lacks <code>kms:Decrypt</code> on the source CMK; everything silently lands FAILED until someone checks ReplicationStatus months later. Alarm on replication metrics from day one. (2) Cost surprise — CRR of a churny bucket pays inter-region transfer on every version, including the 50,000 overwrites per day from lesson 4's versioning leak; replication multiplies whatever hygiene problems the source has. (3) Two-way replication without replica modification sync producing split-brain tags that broke tag-based lifecycle on one side only.</div>

<div class="callout limits">Both buckets versioned — non-negotiable. RTC SLA: 99.99% within 15 min. Delete markers optional (and incompatible with tag-based filters). No replication out of Glacier Flexible/Deep Archive. Batch Replication for anything pre-existing. Replication does not chain. Metrics are free with RTC, optional (paid) without.</div>

<p><strong>When NOT to use replication:</strong> one-time or scheduled bulk copies (use <code>aws s3 sync</code>, DataSync, or Batch Operations Copy — cheaper and simpler); "backup" where the threat model is bad writes (replication faithfully forwards your corruption within seconds — you want versioning + Object Lock, or AWS Backup, for point-in-time restore); and same-account "safety copies" that share the deleting principal's permissions anyway.</p>
`
    },
    {
      id: "encryption",
      title: "Encryption: SSE-S3, SSE-KMS, bucket keys, DSSE, SSE-C, client-side",
      html: `
<p>Everything in S3 is encrypted at rest — since January 2023, <strong>SSE-S3 is applied by default</strong> to every new object, and TLS covers transit. So the engineering question is no longer "encrypt?" but <strong>"who controls the keys, who can audit use, and what does key management cost at your request rate?"</strong> The options form a ladder of control vs operational burden.</p>

<h3>The ladder</h3>
<table>
<thead><tr><th>Mode</th><th>Keys owned/managed by</th><th>Audit trail of key use</th><th>Blast-radius control</th><th>Cost/complexity</th></tr></thead>
<tbody>
<tr><td>SSE-S3 (AES256)</td><td>S3-managed</td><td>none (just S3 access logs)</td><td>none beyond S3 IAM</td><td>free, zero ops</td></tr>
<tr><td>SSE-KMS</td><td>KMS key (AWS-managed alias/aws/s3 or customer-managed CMK)</td><td>every Decrypt in CloudTrail</td><td>key policy = second, independent gate; revoke = instant lockout</td><td>KMS request fees + throttling risk</td></tr>
<tr><td>DSSE-KMS</td><td>KMS, two independent layers</td><td>CloudTrail</td><td>as SSE-KMS</td><td>higher per-GB fee; compliance-driven</td></tr>
<tr><td>SSE-C</td><td>you, per request</td><td>yours</td><td>total — S3 keeps only a salted key hash</td><td>you ship the key on every call; lose it = data gone</td></tr>
<tr><td>Client-side</td><td>you, before upload</td><td>yours</td><td>total — S3 only ever sees ciphertext</td><td>your KMS/library problem; kills range GETs, Athena, etc.</td></tr>
</tbody>
</table>

<h3>SSE-KMS mechanics and the throttling issue</h3>
<p>SSE-KMS uses envelope encryption: each PUT calls <code>kms:GenerateDataKey</code> (unique data key per object, encrypted copy stored with the object); each GET calls <code>kms:Decrypt</code>. Two consequences:</p>
<ul>
<li><strong>Authorization is two-gate.</strong> A reader needs <code>s3:GetObject</code> <em>and</em> <code>kms:Decrypt</code> on the CMK. This is a feature — the key policy is an independent control plane. Cross-account access that "should work" and returns 403 is very often the KMS half missing.</li>
<li><strong>Every object touch is a KMS API call</strong>, and KMS has a shared, per-account, per-region request quota — 5,500 to 50,000 req/s depending on region (raisable). A data-lake job doing 100k GET/s against KMS-encrypted objects will blow through it and take down <em>every other KMS consumer in the account</em> (EBS attach, Secrets Manager, other buckets) with <code>ThrottlingException</code>. KMS throttling is an account-wide blast radius.</li>
</ul>
<p><strong>S3 Bucket Keys</strong> are the fix: S3 asks KMS for a short-lived <em>bucket-level</em> data key and locally derives per-object keys from it, collapsing millions of KMS calls into a handful. Result: up to ~99% reduction in KMS request cost and throttle pressure. It's a checkbox on the bucket (or per-PUT header), on by default for new configurations. Trade-off: CloudTrail now shows far fewer KMS events (coarser audit granularity), and objects written with bucket keys are tied to that derivation — fine for almost everyone; audit-per-object shops may keep it off.</p>

<h3>DSSE-KMS, SSE-C, client-side — when each exists</h3>
<p><strong>DSSE-KMS</strong> applies two independent AES-256 layers with distinct data keys — it exists for compliance regimes (e.g., US DoD guidance) that literally require multi-layer at-rest encryption. Functionally identical to SSE-KMS otherwise; costs more per GB. <strong>SSE-C</strong>: you send the raw 256-bit key in headers on every request (HTTPS mandatory); S3 encrypts/decrypts in flight and stores only an HMAC of the key. Nobody at AWS can ever decrypt — and neither can you, if you lose the key; there is no recovery and no console access to such objects. <strong>Client-side encryption</strong> moves crypto entirely into your process (e.g., the S3 Encryption Client with KMS): S3 stores opaque ciphertext. Maximum control, but you forfeit every server-side feature that needs plaintext — S3 Select is gone, Athena needs the same client config, range GETs break unless your scheme supports them, and key rotation means re-uploading.</p>

<h3>Enforcement and rotation realities</h3>
<ul>
<li>Default encryption is a bucket setting (SSE-S3 or SSE-KMS + chosen key + bucket-key flag). A PUT with explicit headers overrides the default; to <em>forbid</em> weaker choices, add a bucket policy denying <code>s3:PutObject</code> unless <code>s3:x-amz-server-side-encryption</code> equals your required mode (and optionally pin the exact KMS key ARN).</li>
<li>Changing the bucket default <strong>never re-encrypts existing objects</strong> — encryption settings are stamped per object at write. Re-encrypting history = copy every object onto itself (Batch Operations Copy is the tool at scale).</li>
<li>KMS key rotation rotates the <em>backing key material</em> for new data keys; old data keys stay decryptable — no S3 rewrite needed. Cryptographic re-wrap of old objects, if a policy demands it, is again a mass copy.</li>
</ul>

<div class="callout exam">Mappings: "audit every access to encryption keys" or "keys must be revocable/rotated under our control" → <strong>SSE-KMS with a customer-managed key</strong> (SSE-S3 gives no key audit). "Reduce KMS costs / KMS throttling at high request rates" → <strong>Bucket Keys</strong>. "Company must manage keys on-premises / AWS must never hold the key" → <strong>SSE-C</strong> or client-side (client-side if they also say data must be encrypted <em>before</em> it leaves the DC). "Two layers of encryption for compliance" → <strong>DSSE-KMS</strong>. A distractor to spot: "enable default encryption to encrypt existing objects" — it doesn't; existing objects need re-copying.</div>

<div class="callout war">The KMS-throttle incident is a rite of passage: a batch backfill against an SSE-KMS bucket without bucket keys starts throttling KMS account-wide; suddenly unrelated services can't decrypt secrets and EBS volumes fail to attach on new instances. Enable bucket keys on day one for any high-traffic KMS bucket, and put KMS request-rate alarms in the account baseline. Second gotcha: presigned URLs for KMS objects fail with 403 if the <em>signing principal</em> lacks kms:Decrypt — the URL's permissions are the signer's, both gates included.</div>

<div class="callout limits">KMS request quota: 5,500-50,000 req/s per account-region (shared across all services; raisable). Bucket keys: ~99% KMS call reduction. SSE-C requires HTTPS and the key on every request, and SSE-C objects are excluded from replication. Default-encryption change is forward-only. DSSE-KMS is the only two-layer server-side option.</div>
`
    },
    {
      id: "access-control",
      title: "Access control: policies, Block Public Access, access points, presigned URLs",
      html: `
<p>S3 predates IAM, so it accumulated four overlapping authorization systems — ACLs, bucket policies, IAM policies, and access points — plus a safety interlock (Block Public Access) bolted over the top. Modern S3 has collapsed this: <strong>ACLs are disabled by default</strong> and the real model is policy evaluation. Knowing the evaluation order cold is worth several exam questions and most real-world 403 debugging.</p>

<h3>The evaluation model</h3>
<p>A request is allowed only if: <strong>no explicit Deny anywhere</strong> (IAM policies, bucket policy, SCPs, permission boundaries, VPC endpoint policy, access point policy) <em>and</em> <strong>at least one explicit Allow</strong> in a relevant policy. Same-account, IAM Allow <em>or</em> bucket-policy Allow suffices (union). <strong>Cross-account requires both sides</strong>: the caller's IAM must allow it and the bucket policy must allow that external principal. Bucket policies are the resource-based half — they're also the only way to grant anonymous/public access, to enforce conditions on all callers regardless of their IAM (e.g., deny non-TLS with <code>aws:SecureTransport</code>, deny wrong-VPC with <code>aws:SourceVpce</code>, require encryption headers), and they cap out at 20 KB.</p>

<h3>ACLs: legacy, now off</h3>
<p>Since April 2023 new buckets default to <strong>Object Ownership = BucketOwnerEnforced</strong>: ACLs are ignored entirely, every object is owned by the bucket owner, and authorization is purely policy-based. This retired the classic cross-account trap where account B uploaded objects into account A's bucket and A couldn't read its "own" bucket's contents because B owned the objects. Leave ACLs disabled; the only lingering legitimate ACL use was S3 server access logging's log-delivery group, and that too has policy-based alternatives. If the exam mentions ACLs, the modern answer is almost always "disable them / use BucketOwnerEnforced."</p>

<h3>Block Public Access (BPA)</h3>
<p>BPA is a four-flag interlock at bucket <em>and</em> account level, <strong>on by default</strong>, that overrides everything else: two flags block <em>new</em> public ACLs/policies from being applied, two <em>ignore/restrict</em> existing ones. "Public" has a precise meaning — a grant to <code>*</code> or AWS without narrowing conditions. The account-level setting is the org guardrail: with it on, no bucket in the account can be made public no matter what a developer applies (enforce it org-wide with an SCP denying <code>s3:PutAccountPublicAccessBlock</code>). Genuinely public buckets (rare, post-CloudFront) need BPA relaxed deliberately at both levels — which is exactly the audit trail you want.</p>

<h3>Access points</h3>
<p>Bucket policies for a data-lake bucket shared with 40 teams turn into an unmaintainable 20 KB blob. <strong>Access points</strong> fix the management problem: each is a named endpoint (own hostname, own ARN) onto the bucket with its <em>own</em> policy, optionally locked to a single VPC (<code>--vpc-configuration</code>), so each consumer gets a scoped policy on their own access point while the bucket policy shrinks to "delegate to my access points." Multi-Region Access Points add a global endpoint routing to the nearest of several replicated buckets; Object Lambda access points rewrite GET responses through a Lambda (redaction, format-shifting) without storing variants.</p>

<h3>Presigned URLs: mechanics and expiry limits</h3>
<p>A presigned URL is just a normal S3 REST URL with SigV4 query parameters: the signer's access key ID, timestamp, expiry, signed-header list, and an HMAC signature computed with the signer's <em>secret key</em>. Nothing is registered server-side — S3 validates the signature on arrival. Three consequences engineers routinely miss:</p>
<ul>
<li><strong>The URL acts as the signer.</strong> Whoever holds it performs exactly that one operation (method + key baked in) with the signer's permissions at <em>request time</em>. If the signer's permissions are revoked, or the signer was a role whose session expired, the URL dies early.</li>
<li><strong>Effective expiry = min(requested expiry, credential lifetime).</strong> Hard cap: <strong>7 days</strong> (604,800 s) with SigV4 — and that maximum is only reachable when signing with long-lived IAM user credentials. Sign with an assumed-role session and the URL is valid at most for that session's remaining duration (role max 12 h; instance-profile creds ~6 h); the console's own share links cap at 12 h. "My presigned URL expires after an hour even though I asked for a week" = it was signed by a Lambda's role session.</li>
<li>Presigned <strong>PUT</strong> is the standard browser-upload pattern (the legacy POST-policy form is its older sibling supporting size limits and conditions). Content-type or other headers included in the signature must be sent verbatim by the uploader.</li>
</ul>

<pre><code>aws s3 presign s3://my-bucket/report.pdf --expires-in 3600
# https://my-bucket.s3.us-east-1.amazonaws.com/report.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&amp;X-Amz-Credential=...&amp;X-Amz-Expires=3600&amp;X-Amz-Signature=...</code></pre>

<div class="callout exam">Mappings: "grant a mobile/web user temporary download/upload access without credentials" → presigned URL (generated by a backend). "Time-limited access for 30 days" → trap: presigned max is 7 days; the answer is regenerate, or CloudFront signed URLs (no such cap). "Different teams need different access to one shared bucket; simplify policy management" → access points. "Ensure no bucket can ever be made public organization-wide" → account-level BPA + SCP. "Cross-account upload, bucket owner can't access objects" → the legacy ACL problem; answer: Object Ownership BucketOwnerEnforced. "Enforce TLS" → bucket policy deny on aws:SecureTransport false.</div>

<div class="callout war">403-debugging order in real life: explicit Deny in an SCP or the bucket policy (aws:SourceVpce conditions strand callers coming over the wrong path), then BPA (a policy that <em>looks</em> non-public but BPA classifies as public silently fails to apply or blocks access), then the KMS second gate from the previous lesson, then object ownership on pre-2023 buckets. Also: a leaked presigned URL is a bearer token — you can't revoke one URL, only revoke the signer's credentials or add a Deny; keep expiries short and sign per-request.</div>

<div class="callout limits">Bucket policy max 20 KB. Presigned URLs: 7-day hard max (SigV4), bounded by signer credential lifetime; console 12 h. BPA: 4 flags, bucket + account scope, on by default since April 2023, as is BucketOwnerEnforced. Access points: 10,000 per account per region; VPC-restricted access points are the standard data-lake pattern. Tag limit interplay: ABAC on S3 uses aws:ResourceTag / s3:ExistingObjectTag conditions — 10 tags per object.</div>
`
    },
    {
      id: "performance-events",
      title: "Performance limits, multipart, acceleration, and event notifications",
      html: `
<p>S3's throughput story is "effectively infinite, but per-partition." The published floor: <strong>3,500 PUT/COPY/POST/DELETE and 5,500 GET/HEAD requests per second per prefix</strong>, with no cap on the number of prefixes. "Prefix" here means an S3 <em>index partition</em>, not literally each slash-delimited path — S3 automatically splits hot key ranges into more partitions as sustained load grows, so aggregate throughput scales to millions of requests/second... eventually.</p>

<h3>The scaling dance and 503s</h3>
<p>Partition splits take minutes to tens of minutes of sustained pressure. During the gap S3 returns <code>503 SlowDown</code>, which well-behaved clients absorb with exponential backoff + jitter (the SDKs do; naive HTTP clients don't). Two design rules follow:</p>
<ul>
<li><strong>Spread hot traffic across key ranges.</strong> Sequential keys (timestamps, monotonically increasing IDs) concentrate load on one partition. The old advice to randomize key prefixes is mostly obsolete for steady workloads — S3 repartitions on its own — but for <em>bursty</em> workloads (a 10k-writer batch job starting cold at midnight against date-prefixed keys) a few high-cardinality prefix characters up front still prevents the 503 storm during ramp-up.</li>
<li><strong>Ramp gradually</strong> when you can; S3's own guidance for very high request rates is to grow load over minutes rather than step-function it.</li>
</ul>

<h3>Multipart upload: the large-object workhorse</h3>
<p>Multipart upload (MPU) splits an object into parts of <strong>5 MiB-5 GiB</strong> (last part any size), up to <strong>10,000 parts</strong>, hard object ceiling 5 TiB. It's mandatory above 5 GiB and recommended above ~100 MiB, for three reasons: parts upload <strong>in parallel</strong> (aggregate bandwidth ≫ single-stream TCP, which throughput-limits on RTT), parts <strong>retry independently</strong> (a blip costs you one 100 MiB part, not a 2 TiB restart), and uploads can pause/resume. The lifecycle: <code>CreateMultipartUpload</code> → N × <code>UploadPart</code> (or <code>UploadPartCopy</code> for server-side assembly from existing objects) → <code>CompleteMultipartUpload</code>, which atomically materializes the object. Until Complete (or Abort), parts sit invisible-but-billed — the lifecycle Abort rule from lesson 4 is the garbage collector. The high-level CLI (<code>aws s3 cp</code>) does MPU automatically with configurable <code>multipart_chunksize</code> and concurrency.</p>

<h3>Byte-range GETs</h3>
<p>The read-side mirror: <code>Range: bytes=0-1048575</code> fetches a slice, and issuing many ranges in parallel saturates NICs the same way MPU does — this is precisely how the CRT-based transfer manager and analytics engines read Parquet footers + column chunks without touching whole objects. Range GETs also give you resumable downloads and "read the header before deciding" patterns. Each range request bills as one GET, and each counts against the per-prefix rate — a Parquet-heavy query engine issues far more requests than files, which is why data layout (fewer, bigger row groups) is an S3 request-cost lever.</p>

<h3>Transfer Acceleration</h3>
<p>Transfer Acceleration gives the bucket a special endpoint (<code>bucket.s3-accelerate.amazonaws.com</code>) that ingests traffic at the nearest CloudFront edge and carries it to the bucket region over AWS's backbone — long-haul TCP over a tuned private network instead of the public internet. Worth it for <em>distant clients uploading large objects</em> (cross-continent), pointless intra-region (S3 rejects billing for non-improving transfers via its speed-comparison behavior, and you shouldn't pay the per-GB acceleration premium for nearby clients). Alternatives to weigh: CloudFront in front for <em>downloads</em>, multipart parallelism alone often closes most of the gap for uploads with fat pipes.</p>

<h3>Event notifications: S3 as a pipeline trigger</h3>
<p>S3 emits events (ObjectCreated:*, ObjectRemoved:*, ObjectRestore, Replication, LifecycleExpiration, IntelligentTiering transitions...) to two systems:</p>
<ul>
<li><strong>Classic notifications</strong> → SQS, SNS, or Lambda directly. Configured on the bucket with per-rule <strong>prefix/suffix filters</strong>; one important constraint — <strong>overlapping prefix/suffix rules for the same event type are rejected</strong>, so two consumers wanting all ObjectCreated events must fan out via SNS or move to EventBridge. Delivery is at-least-once, typically seconds, unordered; consumers must be idempotent and must not assume the object still exists (it may have been deleted before processing).</li>
<li><strong>EventBridge integration</strong> (one bucket-level switch): every event goes to the account's default bus as structured JSON. You get full rule-language filtering (on key, size, metadata fields), fan-out to many targets, archive/replay, and cross-account routing — strictly more capable, tiny per-event cost. Modern default for anything non-trivial.</li>
</ul>
<p>The canonical serverless pattern — S3 → SQS → Lambda (queue in the middle for buffering, DLQ, and concurrency control) — beats direct S3 → Lambda for any bursty source, because a million-object backfill otherwise slams Lambda concurrency limits with no backpressure.</p>

<div class="callout exam">Mappings: "users worldwide upload large files to a central bucket, speed it up" → <strong>Transfer Acceleration</strong> (if it says download/static content → CloudFront). "Uploads of multi-GB files fail/restart over unreliable links" → <strong>multipart upload</strong>. "503 Slow Down errors during traffic spikes" → spread keys across prefixes / back off; per-prefix limits are the cause. "Process each uploaded object exactly once with retries and DLQ" → S3 → SQS → Lambda. "Multiple applications must react to the same uploads with complex filtering" → EventBridge.</div>

<div class="callout limits">3,500 writes / 5,500 reads per second per prefix, unlimited prefixes. MPU: parts 5 MiB-5 GiB, ≤10,000 parts, object ≤5 TiB, single PUT ≤5 GiB. Notifications: at-least-once, no ordering; classic rules can't overlap per event type; EventBridge has no such restriction. Acceleration: per-GB surcharge, only billed when it actually accelerates.</div>

<div class="callout war">Two repeat offenders. (1) The midnight batch: thousands of workers start writing <code>2026-07-21/...</code> keys at 00:00 — one cold partition, instant 503 storm, job "randomly" fails nightly. Fix: prefix with a shard byte or start workers with jitter. (2) Event loops: a Lambda triggered on ObjectCreated writes its output to the same prefix it watches → infinite recursion and a five-figure bill by morning. Always write output to a different prefix/bucket and scope the trigger filter tightly.</div>
`
    },
    {
      id: "protection-hosting-cost",
      title: "Object Lock, static hosting, requester pays, Storage Lens, and the bill",
      html: `
<p>This lesson collects the operational corners the exam loves: WORM protection, the static-website pattern, cost-shifting, and fleet-wide visibility — plus the shape of the S3 bill, which is where architecture meets the CFO.</p>

<h3>Object Lock: WORM for S3</h3>
<p>Object Lock makes versions <strong>immutable for a retention period</strong> — write-once-read-many, the control regulators (SEC 17a-4, FINRA) and ransomware playbooks want. Facts that matter:</p>
<ul>
<li>It must be <strong>enabled at bucket creation</strong> (it forces versioning on); enabling it later requires an AWS support path. Protection applies per <em>version</em> — a "delete" still just adds a delete marker; the locked versions persist and are un-deletable until retention expires.</li>
<li><strong>Governance mode</strong>: protected, but principals holding <code>s3:BypassGovernanceRetention</code> can shorten/remove retention (must pass the <code>x-amz-bypass-governance-retention</code> header). Use for internal discipline — protects against fat fingers and most compromise, but a sufficiently privileged admin can undo it.</li>
<li><strong>Compliance mode</strong>: nobody — not the root user, not AWS support at your request — can shorten retention or delete the version until the clock runs out. The only exit is closing the AWS account. Test with hours-long retention before you commit to years; a mis-set 7-year compliance lock on the wrong prefix is a 7-year mistake you will pay storage on.</li>
<li><strong>Legal hold</strong>: an independent on/off flag per version, no expiry date, toggled by anyone with <code>s3:PutObjectLegalHold</code>. Retention and legal hold are evaluated independently; either one blocks deletion. Buckets can also set a <em>default retention</em> applied to new objects.</li>
</ul>

<div class="callout exam">"Regulatory requirement that data cannot be deleted or altered by any user, including administrators, for N years" → <strong>compliance mode</strong>. "Protect from accidental deletion but allow authorized admins to remove protection" → <strong>governance mode</strong>. "Retain until litigation concludes (indefinite)" → <strong>legal hold</strong>. "Ransomware-resilient backups" → Object Lock (often compliance) on a <em>separate account's</em> replication destination. MFA Delete appears as a distractor — it protects versioning state, not WORM semantics.</div>

<h3>Static website hosting + CloudFront: the modern pattern</h3>
<p>S3's built-in website hosting gives a bucket a <em>website endpoint</em> (index/error documents, redirect rules) — but it is <strong>HTTP-only, no custom-domain TLS, and requires the bucket to be public</strong>. That combination is why the built-in feature alone is now almost always the wrong answer. The production pattern:</p>
<ul>
<li><strong>CloudFront in front of the bucket's REST endpoint</strong> with <strong>Origin Access Control (OAC)</strong>: CloudFront signs origin requests (SigV4), and the bucket policy allows only <code>cloudfront.amazonaws.com</code> with a condition on your distribution's ARN. Bucket stays fully private, BPA stays on, TLS via ACM certificate on the distribution, HTTP/2+3, edge caching, WAF attachable. (OAC replaced the legacy OAI and, unlike OAI, supports SSE-KMS objects and all HTTP methods.)</li>
<li>Only use the website <em>endpoint</em> as a CloudFront origin when you specifically need S3's redirect/index-document behavior — and then it's a custom origin, no OAC, so you fake privacy with a secret Referer header. For SPAs, CloudFront Functions or error-page mapping handle index routing against the private REST origin instead.</li>
<li>Route 53 ALIAS record → CloudFront. Naked S3 website hosting requires bucket name = domain name; CloudFront removes that constraint.</li>
</ul>

<h3>Requester pays</h3>
<p>A bucket flag that shifts <strong>request and data-transfer costs to the caller</strong>; the owner keeps paying storage. Callers must be authenticated (no anonymous access, by construction) and must explicitly opt in with the <code>x-amz-request-payer: requester</code> header / <code>--request-payer requester</code> — an un-flagged request fails with 403, which is the mechanism's consent proof. It exists for open-data and data-marketplace patterns: you host a large shared dataset; consumers pay their own egress. Not usable together with the free-transfer assumptions of some services, and if you see surprise 403s on a public dataset, this flag is the first suspect.</p>

<h3>Storage Lens: fleet-wide visibility</h3>
<p>Storage Lens is the org-level analytics layer: metrics across <em>all buckets, all accounts</em> (via Organizations), surfaced as dashboards and optional daily metric exports to S3/CloudWatch. The free tier answers "where is my storage and how fast is it growing" (usage by bucket/prefix/account/region/class); the <strong>advanced tier</strong> adds activity metrics (requests, bytes downloaded), cost-optimization findings — incomplete MPU bytes, noncurrent-version bloat, objects that should be tiered — and prefix-level drill-down. It's how you find the versioning leak from lesson 4 across 900 buckets without scripting. Distinguish it from: <em>S3 Inventory</em> (per-bucket object manifest for batch processing), <em>storage class analysis</em> (per-bucket access-pattern study to justify IA transitions), and <em>server access logs / CloudTrail data events</em> (per-request audit).</p>

<h3>The bill: what dimensions you actually pay on</h3>
<table>
<thead><tr><th>Dimension</th><th>Driver</th><th>Architect's lever</th></tr></thead>
<tbody>
<tr><td>Storage GB-month</td><td>bytes × class × time (incl. noncurrent versions, MPU parts, overheads)</td><td>lifecycle, class choice, version GC</td></tr>
<tr><td>Requests</td><td>per 1,000; PUT/LIST ~10× GET price; higher in IA/Glacier classes</td><td>object sizing, fewer LISTs (Inventory), batch deletes</td></tr>
<tr><td>Retrieval</td><td>per-GB fees in IA/Glacier + restore requests</td><td>class-vs-access math (lesson 3)</td></tr>
<tr><td>Data transfer out</td><td>per GB to internet (in is free; to CloudFront free; cross-region billed)</td><td>CloudFront in front, VPC gateway endpoints (free) instead of NAT for in-VPC access</td></tr>
<tr><td>Management/analytics</td><td>Inventory, Storage Lens advanced, I-T monitoring, Batch Ops, tags</td><td>enable where evidence, not vibes</td></tr>
</tbody>
</table>
<p>The chronically forgotten line items: <strong>NAT gateway processing for S3 traffic</strong> (fix: gateway VPC endpoint, which is free), noncurrent versions, orphaned MPU parts, and cross-region replication transfer. None of them appear under "S3 storage" on a naive bill read.</p>

<div class="callout war">Object Lock war story: a backup vendor's misconfig applied 10-year compliance retention to a test prefix; the team's only options were paying a decade of storage or deleting the whole account. Rehearse lock settings in a sacrificial bucket. Hosting war story: a "temporarily public" website bucket with BPA off became a scraping target; the bill spiked on egress before anyone noticed — CloudFront + OAC + private bucket also caps egress exposure behind cacheable, WAF-protected edges.</div>

<div class="callout limits">Object Lock: bucket-creation-time flag, versioning mandatory, compliance mode irrevocable, governance bypass = s3:BypassGovernanceRetention + explicit header, legal hold has no expiry. Website endpoint: HTTP only, public bucket required. Requester pays: authenticated + explicit header or 403. Storage Lens free tier ~14-day retention vs advanced ~15 months + prefix metrics.</div>
`
    }
  ],
  quiz: [
    {
      q: "A media company stores 900 GB video masters in S3 Standard. Each master is accessed heavily for 2 weeks after upload, rarely afterward, but when legal requests one it must be available within milliseconds. Retention is indefinite. What is the most cost-effective storage design?",
      options: [
        "Lifecycle rule transitioning objects to S3 Glacier Flexible Retrieval 30 days after creation",
        "Lifecycle rule transitioning objects to S3 Glacier Instant Retrieval 30 days after creation",
        "Lifecycle rule transitioning objects to S3 One Zone-IA 30 days after creation",
        "Store everything in S3 Intelligent-Tiering with the optional Deep Archive Access tier enabled"
      ],
      answer: [1],
      multi: false,
      explanation: "The binding constraint is <strong>millisecond access to cold data</strong>. <strong>B</strong> is correct: Glacier Instant Retrieval offers archive-level storage pricing (~$0.004/GB-mo) with synchronous millisecond GETs — exactly the 'rarely accessed but instantly needed' profile; large objects clear the 90-day minimum comfortably given indefinite retention. <strong>A</strong> fails the requirement outright: Flexible Retrieval requires an asynchronous restore taking minutes to hours. <strong>C</strong> keeps millisecond access but One Zone-IA stores a single copy in one AZ — wrong for irreplaceable masters — and is barely cheaper than Glacier IR while charging similar retrieval fees. <strong>D</strong> almost works, but the opt-in Deep Archive Access tier makes long-idle objects require 12+ hour restores, violating the millisecond requirement; I-T without the archive tiers would be acceptable but is not what the option says, and the monitoring fee adds cost with no benefit given the access pattern is known."
    },
    {
      q: "An analytics pipeline writes a manifest object to S3 after writing 200 data files, and readers begin processing when they see the manifest. Occasionally two pipeline runs execute concurrently and both write the same manifest key, corrupting downstream state. What is the simplest fix?",
      options: [
        "Enable S3 Transfer Acceleration so writes complete faster and cannot overlap",
        "Use a conditional PUT with the If-None-Match header so only the first writer's manifest is accepted",
        "Enable versioning so both manifests are retained and readers pick the correct one",
        "Front all writes with an SQS standard queue so manifests are written in order"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: S3 conditional writes (If-None-Match: *) make PUT-if-absent atomic at the service — the losing writer gets a 412 and can abort or retry its whole run, which is exactly the commit-protocol primitive needed. <strong>A</strong> is irrelevant; acceleration changes network path, not concurrency semantics — S3 has no locking regardless of speed. <strong>C</strong> preserves both payloads but does not help readers: plain GETs still return whichever version S3 ordered last, so the race remains — versioning aids forensics, not correctness. <strong>D</strong> doesn't serialize anything: SQS standard queues are unordered and at-least-once, and even a FIFO queue would only help if a single consumer performed all writes — a much heavier redesign than one request header."
    },
    {
      q: "A bucket has versioning enabled. A developer runs a recursive CLI delete across the bucket, then reports that storage costs have not decreased at all. Why, and what removes the data?",
      options: [
        "The deletes created delete markers only; a lifecycle rule expiring noncurrent versions and removing expired delete markers will purge the data",
        "S3 retains deleted objects for a mandatory 30-day recovery window before space is freed",
        "The bucket has MFA Delete enabled, so the CLI deletes were silently ignored",
        "Versioned buckets require the bucket owner to empty the bucket from the console before space is reclaimed"
      ],
      answer: [0],
      multi: false,
      explanation: "<strong>A</strong> is correct: on a versioned bucket, a plain DELETE inserts a zero-byte delete marker and leaves every prior version intact and billable. Purging requires deleting specific version IDs — either via list-object-versions scripting or, declaratively, a lifecycle rule with NoncurrentVersionExpiration plus ExpiredObjectDeleteMarker cleanup. <strong>B</strong> invents a retention window that doesn't exist — S3 has no mandatory recovery period (that's an Object Lock or vault-style concept). <strong>C</strong> is wrong twice: MFA Delete blocks permanent version deletion with an error, not silently, and plain deletes (marker creation) still succeed. <strong>D</strong> is fiction; the console 'empty bucket' button is just a convenience that does the same version-by-version deletion you can do via API."
    },
    {
      q: "A financial services firm must keep trade records for 7 years such that no user — including account administrators and the root user — can delete or modify them during that period. Which configuration meets the requirement?",
      options: [
        "S3 Object Lock in governance mode with a 7-year retention period",
        "S3 Object Lock in compliance mode with a 7-year retention period on a versioned bucket",
        "Versioning plus MFA Delete enabled by the root user",
        "A bucket policy denying s3:DeleteObject to all principals for 7 years"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: compliance mode is the only S3 control where retention cannot be shortened or removed by anyone — not privileged admins, not root — until it expires (Object Lock requires versioning, which the option correctly includes). <strong>A</strong> fails the 'including administrators' clause: governance mode is bypassable by any principal granted s3:BypassGovernanceRetention. <strong>C</strong> protects against casual permanent deletion but root (the only identity that can even use MFA Delete) can simply perform the MFA-authenticated delete — the threat model explicitly includes root. <strong>D</strong> is circular: administrators who can edit the bucket policy can remove the deny; policies are configuration, not WORM."
    },
    {
      q: "An application generates presigned GET URLs from a Lambda function using its execution role and requests a 7-day expiry. Users report the links stop working after roughly an hour. What is the cause?",
      options: [
        "S3 caps presigned URLs generated by Lambda functions at 60 minutes",
        "The URL validity is bounded by the lifetime of the temporary role-session credentials that signed it",
        "The bucket's Block Public Access settings expire presigned URLs early",
        "SigV4 presigned URLs require re-signing every hour by design"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: a presigned URL is validated against the credentials that signed it. Lambda signs with temporary role-session credentials; when that session expires (about an hour for Lambda's rotating credentials), every URL it signed dies regardless of the requested X-Amz-Expires. The 7-day maximum is only achievable with long-lived IAM user credentials. <strong>A</strong> invents a Lambda-specific S3 cap that doesn't exist — the limit is a property of the credential type, not the compute service. <strong>C</strong> is unrelated: BPA governs public ACLs/policies; presigned URLs are authenticated requests as the signer and are unaffected. <strong>D</strong> is false; SigV4 supports up to 604,800 seconds when the underlying credentials live that long."
    },
    {
      q: "A company enables cross-region replication on an existing bucket containing 40 million objects, then discovers the destination bucket only contains objects created after the rule was enabled. They also notice that when a version is permanently deleted in the source, the replica version remains. Which statements explain this? (Select TWO.)",
      options: [
        "Replication only applies to objects written after the configuration exists; pre-existing objects require S3 Batch Replication",
        "The replication IAM role lacks s3:GetObject permission on old objects",
        "Deletions of specific version IDs are never replicated, by design, to protect replicas from malicious deletes",
        "Delete marker replication was not enabled, which also controls version deletions",
        "The destination bucket must have versioning enabled before old objects can replicate"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<strong>A</strong> is correct: replication is a forward-only changefeed; history needs a Batch Replication job. <strong>C</strong> is correct: version-ID deletes are deliberately never propagated so a compromised or fat-fingered source cannot destroy the replica set. <strong>B</strong> is a plausible-sounding misdiagnosis — permission problems mark objects FAILED, they don't explain the clean 'only new objects' cutoff described. <strong>D</strong> conflates two things: the delete-marker setting controls only marker propagation; version deletions are excluded unconditionally, whatever the setting. <strong>E</strong> is wrong because destination versioning is required for replication to be configured at all — the rule is working for new objects, so versioning is evidently on."
    },
    {
      q: "A data lake bucket encrypted with SSE-KMS using a customer managed key serves about 20,000 GET requests per second at peak. The security team reports KMS ThrottlingException errors affecting unrelated workloads in the account. What is the best remediation?",
      options: [
        "Switch the bucket to SSE-S3 to eliminate KMS calls",
        "Enable S3 Bucket Keys on the bucket so S3 derives object keys from a bucket-level data key",
        "Request a KMS quota increase and add retry logic to all applications",
        "Re-encrypt the objects with SSE-C so clients supply keys directly"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: Bucket Keys collapse per-object GenerateDataKey/Decrypt calls into rare bucket-level key requests, cutting KMS traffic by up to ~99% while preserving the customer-managed key, its policy gate, and CloudTrail-of-key-use that presumably motivated SSE-KMS. <strong>A</strong> 'works' but abandons the security posture — no key-usage audit, no independent revocation — which a security team demanding KMS chose deliberately; it's a governance regression, not a fix. <strong>C</strong> treats symptoms: a raise plus retries may hold today's peak but scales linearly with traffic, keeps paying per-request KMS fees, and leaves the account-wide shared-quota blast radius. <strong>D</strong> is operationally absurd at this scale (keys shipped on every request, no server-side key management) and SSE-C objects also lose replication support."
    },
    {
      q: "A nightly batch job with 5,000 parallel workers uploads objects named with the pattern year/month/day/objectid to a bucket, all starting at 00:00 UTC. The job intermittently fails with 503 Slow Down errors in its first minutes, then stabilizes. What change most directly prevents the errors?",
      options: [
        "Enable S3 Transfer Acceleration for the bucket",
        "Introduce high-cardinality key prefixes (or stagger worker start) so the burst spreads across index partitions",
        "Switch the workers to multipart uploads",
        "Raise the account's S3 request quota via Service Quotas"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: all writes land under one fresh date prefix, i.e. one index partition limited to ~3,500 writes/sec, and S3's automatic repartitioning takes minutes of sustained load — precisely the observed 'fails then stabilizes' shape. Sharding the keyspace (a hash byte before the date, or per-worker prefixes) or ramping the fleet spreads the burst. <strong>A</strong> changes the network path to the region, not the per-partition request ceiling — 503s are an index limit, not a bandwidth problem. <strong>C</strong> helps large-object throughput and retry granularity but each part still counts as a write to the same partition; for many small objects it can even increase request count. <strong>D</strong> is a distractor: per-prefix request rates are not an adjustable Service Quota — scaling is automatic and design-driven."
    },
    {
      q: "An external partner in another AWS account must upload files into your bucket. With Object Ownership set to BucketOwnerEnforced, which statements are true? (Select TWO.)",
      options: [
        "Objects the partner uploads are automatically owned by your account",
        "The partner must set the bucket-owner-full-control canned ACL on every upload",
        "Cross-account write access requires both the partner's IAM policy and your bucket policy to allow the action",
        "BucketOwnerEnforced requires the partner to assume a role in your account before uploading",
        "ACL-based grants can still override the bucket policy for individual objects"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<strong>A</strong> is correct — BucketOwnerEnforced makes the bucket owner own every object unconditionally, which retired the classic cross-account ownership trap. <strong>C</strong> is correct — cross-account access always needs an allow on both sides: the caller's identity policy and the resource (bucket) policy. <strong>B</strong> describes the legacy pre-2023 workaround; with ACLs disabled the canned ACL is unnecessary (uploads that set most ACLs other than that one are in fact rejected). <strong>D</strong> is false: role assumption is one valid pattern but not a requirement — direct cross-account bucket-policy grants work fine. <strong>E</strong> is exactly what BucketOwnerEnforced eliminates: ACLs are ignored entirely for authorization."
    },
    {
      q: "A company hosts a single-page application from S3 and needs HTTPS on a custom domain, a private bucket that satisfies Block Public Access, and the ability to use SSE-KMS encrypted objects. Which architecture meets all requirements?",
      options: [
        "Enable S3 static website hosting and attach an ACM certificate to the website endpoint",
        "CloudFront distribution using the bucket's REST endpoint as origin, with Origin Access Control and a bucket policy allowing only the distribution",
        "CloudFront distribution using the S3 website endpoint as origin with an Origin Access Identity",
        "Enable static website hosting and restrict the bucket policy to the CloudFront service principal"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: OAC against the REST endpoint signs origin fetches with SigV4, so the bucket stays private with BPA fully on, the distribution carries the ACM certificate for HTTPS on the custom domain, and OAC (unlike the legacy OAI) supports SSE-KMS objects — SPA index routing is handled with a CloudFront function or error-document mapping. <strong>A</strong> is impossible: the website endpoint is HTTP-only and cannot carry a certificate, and website hosting requires public access. <strong>C</strong> fails twice: the website endpoint is treated as a custom origin where OAI/OAC cannot be used, and OAI never supported SSE-KMS anyway. <strong>D</strong> is contradictory — website hosting requires public reads, so a policy restricted to CloudFront's principal breaks the site and the website endpoint can't authenticate CloudFront regardless."
    },
    {
      q: "Which S3 event-processing design handles a burst of 2 million object uploads without losing events or overwhelming downstream processing, while allowing failed items to be retried?",
      options: [
        "S3 event notification invoking a Lambda function directly for each object",
        "S3 event notification to an SQS queue consumed by Lambda with a dead-letter queue configured",
        "S3 server access logging analyzed hourly by Athena to find new objects",
        "An EC2 cron job listing the bucket every minute and diffing against a manifest"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: the queue absorbs the burst (S3 notification delivery is at-least-once into effectively unlimited SQS depth), Lambda's SQS event-source scales consumption under its concurrency controls providing backpressure, and the DLQ captures poison messages for replay — the canonical resilient pattern. <strong>A</strong> couples S3's burst directly to Lambda: throttled invocations from async delivery retry only for a limited period and can ultimately be dropped without a carefully configured on-failure destination, and there is no consumption-rate control. <strong>C</strong> isn't event processing at all — access logs are delivered on a best-effort basis with delays of hours and no completeness guarantee. <strong>D</strong> is the pattern events exist to replace: listing 2M+ objects per minute is slow, expensive in LIST requests, and race-prone."
    },
    {
      q: "A genomics provider hosts a 400 TB public reference dataset in S3. Thousands of external researchers download from it, and the provider wants to stop paying the data transfer costs while still requiring downloads to work with standard AWS tooling. What should they configure?",
      options: [
        "Enable Requester Pays on the bucket",
        "Move the dataset to S3 One Zone-IA to reduce costs",
        "Front the bucket with CloudFront and pass through the costs",
        "Create presigned URLs and bill researchers per URL issued"
      ],
      answer: [0],
      multi: false,
      explanation: "<strong>A</strong> is correct: Requester Pays shifts request and data-transfer charges to the downloading account; callers must be authenticated and add the request-payer flag (supported natively by the CLI/SDKs), while the owner keeps paying only storage — the purpose-built mechanism for shared public datasets. <strong>B</strong> reduces the storage line, not transfer, actually adds per-GB retrieval fees on every download, and puts an irreplaceable-looking dataset in a single AZ. <strong>C</strong> makes economics worse: CloudFront egress is billed to the distribution owner — the provider — with no native way to charge viewers. <strong>D</strong> doesn't shift AWS billing at all (the signer's account still pays transfer) and invents an out-of-band invoicing system with 7-day URL lifetime headaches."
    },
    {
      q: "During a security review you must ensure that no S3 bucket in any account of the organization can ever be configured for public access, even by account administrators. Which combination achieves this? (Select TWO.)",
      options: [
        "Enable account-level Block Public Access in every account",
        "Set Object Ownership to BucketOwnerEnforced on all buckets",
        "Apply a Service Control Policy denying s3:PutAccountPublicAccessBlock so the setting cannot be disabled",
        "Enable default SSE-KMS encryption on all buckets",
        "Require MFA Delete on all versioned buckets"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<strong>A</strong> plus <strong>C</strong> form the interlock: account-level BPA overrides any bucket policy or ACL that would grant public access, and the SCP prevents account admins from switching BPA back off — without the SCP, an administrator can simply disable the account setting, failing the 'even by administrators' requirement. <strong>B</strong> disables ACLs (good hygiene) but does nothing about public <em>bucket policies</em>, which are the main public-access vector. <strong>D</strong> is orthogonal: encryption at rest does not prevent a public policy from serving decrypted objects to the world. <strong>E</strong> protects version deletion, which has no relationship to public exposure."
    },
    {
      q: "An application uploads 800 GB backup archives from an on-premises data center in Frankfurt to a bucket in eu-central-1 over a 10 Gbps link. Uploads are slow and restart from zero when the connection drops. Which change gives the largest improvement?",
      options: [
        "Enable S3 Transfer Acceleration on the bucket",
        "Use multipart upload with parallel part uploads and retry of individual failed parts",
        "Switch the bucket to S3 Standard-IA to prioritize its traffic",
        "Compress each archive with a faster algorithm before upload"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: the described pain — single-stream throughput and full restarts — is exactly what multipart fixes: parallel parts saturate the 10 Gbps link past single-TCP-flow limits, and a dropped connection costs only the in-flight parts, which retry independently. <strong>A</strong> is the classic distractor: Transfer Acceleration helps geographically <em>distant</em> clients by onboarding at a nearby edge, but Frankfurt to eu-central-1 (Frankfurt) has no long-haul path to optimize — AWS even skips charging when there's no improvement, which tells you the expected gain is nil. <strong>C</strong> is nonsense: storage class affects pricing and retrieval, never upload priority or bandwidth. <strong>D</strong> may shave bytes but does nothing for the restart problem and is workload-dependent — it's a secondary optimization, not the largest improvement."
    },
    {
      q: "A bucket must allow object reads only from within a specific VPC via a gateway VPC endpoint, and all other access must be denied, including from the internet. Which mechanism enforces this?",
      options: [
        "A bucket policy with a Deny statement using the aws:SourceVpce condition for all requests not arriving via the endpoint",
        "A security group attached to the S3 bucket allowing only the VPC CIDR",
        "An S3 access point without a VPC configuration, plus Block Public Access",
        "A NACL on the VPC subnets blocking S3 IP ranges"
      ],
      answer: [0],
      multi: false,
      explanation: "<strong>A</strong> is correct: S3 authorization is policy-based, and a bucket policy denying every request whose aws:SourceVpce is not the approved endpoint ID cuts off all other paths — internet, other VPCs, even console access (which is why you scope such denies carefully). A VPC-restricted <em>access point</em> would also be a valid building block, but option C's access point explicitly lacks the VPC configuration, so it enforces nothing path-related. <strong>B</strong> is a category error — S3 is a regional service reached over its API; buckets don't have ENIs and can't have security groups. <strong>C</strong> as stated fails: BPA blocks public grants but doesn't restrict authenticated access to a network path. <strong>D</strong> controls what the subnets can reach outbound — it can block the VPC's own access but cannot stop anyone outside the VPC from reaching the bucket."
    }
  ],
  flashcards: [
    { front: "What are the two things S3 fundamentally does not support at the object level?", back: "In-place modification (objects are <strong>immutable</strong> — every change is a full rewrite/new version) and <strong>rename</strong> (rename = Copy + Delete, non-atomic, O(size))." },
    { front: "What consistency does S3 provide since December 2020?", back: "<strong>Strong read-after-write for all operations</strong>: GET/HEAD/LIST reflect every successful PUT (new or overwrite) and DELETE immediately. No extra cost, all regions." },
    { front: "What does S3 strong consistency NOT provide?", back: "No cross-object <strong>transactions</strong>, no <strong>locking</strong>/CAS on content by default (concurrent PUTs = last-writer-wins), no read-modify-write primitive, no multi-key snapshots. Use conditional writes (If-None-Match / If-Match) or an external coordinator." },
    { front: "Minimum storage durations: Standard-IA, Glacier Instant, Deep Archive?", back: "Standard-IA / One Zone-IA: <strong>30 days</strong>. Glacier Instant + Flexible: <strong>90 days</strong>. Deep Archive: <strong>180 days</strong>. Early delete/transition bills the remainder pro-rated." },
    { front: "S3 Standard-IA minimum billable object size and why it matters", back: "<strong>128 KiB</strong> — smaller objects bill as 128 KiB in IA classes, so transitioning millions of tiny objects to IA can <em>raise</em> costs. Aggregate small files before tiering." },
    { front: "Glacier per-object overhead", back: "~<strong>40 KiB</strong> per archived object: 32 KiB at Glacier rates + 8 KiB at Standard rates for index/metadata. Punishes small objects — tar them first." },
    { front: "Intelligent-Tiering: automatic tiers and fees", back: "Frequent → Infrequent (30 d idle) → Archive Instant (90 d); opt-in async Archive (90 d+) and Deep Archive (180 d+) tiers. <strong>No retrieval fees, no min duration</strong>; monitoring $0.0025/1,000 objects; objects under 128 KiB not monitored." },
    { front: "Glacier Flexible retrieval tiers and speeds", back: "<strong>Expedited</strong> 1-5 min, <strong>Standard</strong> 3-5 h, <strong>Bulk</strong> 5-12 h (free). Deep Archive: Standard ~12 h, Bulk up to 48 h. Restore creates a temporary Standard-class copy." },
    { front: "What does a plain DELETE do on a versioned bucket?", back: "Creates a <strong>delete marker</strong> (zero-byte tombstone) as the new current version; all data versions remain and keep billing. Undelete = delete the marker. Permanent removal requires deleting specific versionIds." },
    { front: "Two lifecycle rules every bucket should have", back: "1) <strong>AbortIncompleteMultipartUpload</strong> (orphaned parts bill invisibly). 2) On versioned buckets: <strong>NoncurrentVersionExpiration</strong> + expired delete-marker cleanup (stops the versioning storage leak)." },
    { front: "S3 replication: four things that do NOT replicate", back: "Pre-existing objects (need <strong>Batch Replication</strong>), permanent version-ID deletes (by design), lifecycle actions, SSE-C objects. Replicas also don't re-replicate to a third bucket, and delete markers only if opted in." },
    { front: "What is S3 Replication Time Control (RTC)?", back: "SLA-backed replication: <strong>99.99% of objects within 15 minutes</strong>, plus replication metrics (pending bytes/ops, latency) and missed-threshold events. Extra per-GB charge. Answer for 'must replicate within N minutes'." },
    { front: "Replica modification sync does what?", back: "Replicates <strong>metadata changes made on replicas</strong> (tags, ACLs, retention) back toward the other side — required for coherent two-way/active-active replication setups." },
    { front: "SSE-KMS: why can high request rates break other services?", back: "Every PUT/GET calls KMS (GenerateDataKey/Decrypt) against a <strong>shared per-account-region quota</strong> (5,500-50,000 req/s). Hot buckets can throttle KMS for the whole account. Fix: <strong>S3 Bucket Keys</strong> (~99% fewer KMS calls)." },
    { front: "SSE-C in one sentence", back: "You supply the raw AES-256 key on <strong>every request</strong> over HTTPS; S3 encrypts/decrypts but stores only a key HMAC — lose the key, lose the data. Not replicable, no console access." },
    { front: "Does enabling default bucket encryption re-encrypt existing objects?", back: "<strong>No.</strong> Encryption is stamped per object at write time. Re-encrypting history requires copying each object over itself (S3 Batch Operations at scale)." },
    { front: "Cross-account S3 access requires what?", back: "An Allow on <strong>both sides</strong>: the caller's identity (IAM) policy AND the bucket (resource) policy — plus no explicit Deny anywhere (SCP, endpoint policy, BPA) and the KMS key grant if SSE-KMS." },
    { front: "Object Ownership: BucketOwnerEnforced means?", back: "<strong>ACLs disabled entirely</strong>; bucket owner owns every object regardless of uploader; authorization is purely policy-based. Default for new buckets since April 2023 — kills the cross-account object-ownership trap." },
    { front: "Presigned URL maximum expiry and the hidden bound", back: "SigV4 hard cap <strong>7 days</strong> (604,800 s), but real validity = min(requested, <strong>signing credential lifetime</strong>): role sessions cap it at hours; only IAM user keys reach 7 days. Need longer → CloudFront signed URLs." },
    { front: "S3 request-rate limits per prefix", back: "<strong>3,500 PUT/COPY/POST/DELETE and 5,500 GET/HEAD per second per prefix</strong> (index partition), unlimited prefixes. S3 auto-splits hot partitions over minutes — expect 503 SlowDown during the ramp; spread bursty keys." },
    { front: "Multipart upload limits", back: "Parts <strong>5 MiB-5 GiB</strong> (last part smaller OK), max <strong>10,000 parts</strong>, object max <strong>5 TiB</strong>, single PUT max 5 GiB. Recommended above ~100 MiB for parallelism and per-part retry." },
    { front: "Object Lock: governance vs compliance vs legal hold", back: "<strong>Governance</strong>: bypassable with s3:BypassGovernanceRetention + explicit header. <strong>Compliance</strong>: nobody, not even root, until retention expires. <strong>Legal hold</strong>: independent flag, no expiry date. Requires versioning; enable at bucket creation." },
    { front: "Why is the S3 website endpoint usually the wrong CloudFront origin?", back: "Website endpoint is <strong>HTTP-only and requires a public bucket</strong>; it's a custom origin so OAC/OAI can't authenticate to it. Standard pattern: REST endpoint origin + <strong>OAC</strong> + bucket policy scoped to the distribution (OAC also supports SSE-KMS)." },
    { front: "Requester Pays: who pays what, and the required header", back: "Requester pays <strong>requests + data transfer</strong>; owner still pays storage. Callers must be authenticated and send <strong>x-amz-request-payer: requester</strong> (CLI: --request-payer) or get 403." },
    { front: "Storage Lens vs S3 Inventory vs storage class analysis", back: "<strong>Storage Lens</strong>: org/account-wide usage + activity dashboards (advanced tier adds prefix drill-down, cost findings). <strong>Inventory</strong>: per-bucket object manifest for batch jobs. <strong>Class analysis</strong>: per-bucket access-pattern study to justify IA transitions." }
  ],
  lab: {
    title: "Lab: versioning, delete markers, presigned URLs, and lifecycle — the S3 sharp edges, hands on",
    html: `
<h3>Goal</h3>
<p>Build one bucket and personally trigger the behaviors this module warns about: verify default encryption, watch a delete become a delete marker and undelete it, feel multipart upload from the CLI, generate and expire a presigned URL, attach the two hygiene lifecycle rules, and — the part most engineers get wrong — fully purge a versioned bucket in teardown. Cost: a few cents at most (a handful of PUTs and a few MB of storage for minutes).</p>

<h3>Architecture</h3>
<p>A single versioned, SSE-S3-encrypted, BPA-locked bucket in your default region; you drive everything with <code>aws s3api</code> (the low-level client) so nothing is hidden by high-level sync magic. No other services involved.</p>

<h3>Steps</h3>
<ol>
<li><p><strong>Create the bucket and confirm the safe-by-default posture.</strong> Pick a unique name (bucket names are a global namespace — expect collisions):</p>
<pre><code>export BUCKET=s3-deep-dive-lab-$RANDOM$RANDOM
export AWS_DEFAULT_REGION=us-east-1
aws s3api create-bucket --bucket $BUCKET

aws s3api get-public-access-block --bucket $BUCKET
aws s3api get-bucket-encryption --bucket $BUCKET</code></pre>
<p>Both should show the defaults: all four BPA flags true, and SSE-S3 (AES256) default encryption — you did not configure either.</p></li>

<li><p><strong>Enable versioning</strong> (a one-way door: you can suspend later, never return to unversioned):</p>
<pre><code>aws s3api put-bucket-versioning --bucket $BUCKET \
  --versioning-configuration Status=Enabled</code></pre></li>

<li><p><strong>Create versions and observe last-writer-wins.</strong></p>
<pre><code>echo v1 &gt; app.conf
aws s3api put-object --bucket $BUCKET --key app.conf --body app.conf
echo v2 &gt; app.conf
aws s3api put-object --bucket $BUCKET --key app.conf --body app.conf

aws s3api list-object-versions --bucket $BUCKET --prefix app.conf \
  --query 'Versions[].{id:VersionId,latest:IsLatest,size:Size}'</code></pre>
<p>Two versions exist; only one is <code>latest: true</code>. A plain GET returns v2; both bill.</p></li>

<li><p><strong>Delete — and see that nothing was deleted.</strong></p>
<pre><code>aws s3api delete-object --bucket $BUCKET --key app.conf
aws s3api get-object --bucket $BUCKET --key app.conf /tmp/out.txt || echo "404 as expected"
aws s3api list-object-versions --bucket $BUCKET --prefix app.conf \
  --query '{markers:DeleteMarkers,versions:length(Versions)}'</code></pre>
<p>You now have a <strong>delete marker</strong> on top of two intact versions. This is the versioned-bucket storage leak in miniature.</p></li>

<li><p><strong>Undelete by removing the marker.</strong> Grab the marker's VersionId from the previous output, then:</p>
<pre><code>aws s3api delete-object --bucket $BUCKET --key app.conf \
  --version-id PASTE_DELETE_MARKER_VERSION_ID
aws s3api get-object --bucket $BUCKET --key app.conf /tmp/out.txt &amp;&amp; cat /tmp/out.txt</code></pre>
<p>v2 is back. Deleting a delete marker is the undelete operation.</p></li>

<li><p><strong>Multipart upload, explicitly.</strong> The high-level CLI hides MPU; do one by hand to see the three-phase protocol and the orphaned-parts hazard:</p>
<pre><code>dd if=/dev/urandom of=big.bin bs=1M count=12
split -b 6m big.bin part-
aws s3api create-multipart-upload --bucket $BUCKET --key big.bin
# note the UploadId, then upload both parts:
aws s3api upload-part --bucket $BUCKET --key big.bin \
  --part-number 1 --body part-aa --upload-id PASTE_UPLOAD_ID
aws s3api upload-part --bucket $BUCKET --key big.bin \
  --part-number 2 --body part-ab --upload-id PASTE_UPLOAD_ID</code></pre>
<p>Each upload-part returns an ETag. Now complete, quoting both ETags:</p>
<pre><code>aws s3api complete-multipart-upload --bucket $BUCKET --key big.bin \
  --upload-id PASTE_UPLOAD_ID \
  --multipart-upload 'Parts=[{ETag=ETAG1,PartNumber=1},{ETag=ETAG2,PartNumber=2}]'
aws s3api head-object --bucket $BUCKET --key big.bin --query ETag</code></pre>
<p>Note the ETag ends in <code>-2</code>: multipart ETags are not the MD5 of the object — the detail that breaks naive integrity checkers.</p></li>

<li><p><strong>Presigned URL: mint, use, and watch it expire.</strong></p>
<pre><code>aws s3 presign s3://$BUCKET/app.conf --expires-in 60
curl -s "PASTE_THE_URL"        # returns v2
sleep 70
curl -s "PASTE_THE_URL"        # AccessDenied: Request has expired</code></pre>
<p>Inspect the query string: algorithm, your access key ID, expiry, signature — the whole grant is client-side math; S3 registered nothing.</p></li>

<li><p><strong>Attach the two hygiene lifecycle rules</strong> (abort stale MPUs; expire noncurrent versions and clean markers):</p>
<pre><code>cat &gt; lifecycle.json &lt;&lt;'EOF'
{"Rules":[
 {"ID":"abort-mpu","Status":"Enabled","Filter":{},
  "AbortIncompleteMultipartUpload":{"DaysAfterInitiation":7}},
 {"ID":"version-gc","Status":"Enabled","Filter":{},
  "NoncurrentVersionExpiration":{"NoncurrentDays":30},
  "Expiration":{"ExpiredObjectDeleteMarker":true}}
]}
EOF
aws s3api put-bucket-lifecycle-configuration --bucket $BUCKET \
  --lifecycle-configuration file://lifecycle.json
aws s3api get-bucket-lifecycle-configuration --bucket $BUCKET</code></pre></li>
</ol>

<h3>Verify</h3>
<ul>
<li><code>get-public-access-block</code> and <code>get-bucket-encryption</code> showed secure defaults you never set.</li>
<li><code>list-object-versions</code> showed multiple versions plus (in step 4) a delete marker; undelete worked by deleting the marker.</li>
<li>The multipart object's ETag has a <code>-&lt;parts&gt;</code> suffix.</li>
<li>The presigned URL worked before expiry and returned an expired-request error after.</li>
<li>The lifecycle configuration echoes both rules back.</li>
</ul>

<h3>Teardown</h3>
<p>This is itself a lesson: <code>aws s3 rb --force</code> does not remove versions and markers on a versioned bucket. Purge everything explicitly, in order:</p>
<ol>
<li><p>Abort any incomplete multipart uploads (if you left one hanging):</p>
<pre><code>aws s3api list-multipart-uploads --bucket $BUCKET \
  --query 'Uploads[].{Key:Key,UploadId:UploadId}'
# for each: aws s3api abort-multipart-upload --bucket $BUCKET --key KEY --upload-id ID</code></pre></li>
<li><p>Delete every object version:</p>
<pre><code>aws s3api list-object-versions --bucket $BUCKET \
  --query 'Versions[].{Key:Key,VersionId:VersionId}' --output text |
while read key vid; do
  aws s3api delete-object --bucket $BUCKET --key "$key" --version-id "$vid"
done</code></pre></li>
<li><p>Delete every delete marker the same way:</p>
<pre><code>aws s3api list-object-versions --bucket $BUCKET \
  --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' --output text |
while read key vid; do
  aws s3api delete-object --bucket $BUCKET --key "$key" --version-id "$vid"
done</code></pre></li>
<li><p>Confirm empty, then delete the bucket and local files:</p>
<pre><code>aws s3api list-object-versions --bucket $BUCKET \
  --query '{v:length(Versions),m:length(DeleteMarkers)}'
aws s3api delete-bucket --bucket $BUCKET
rm -f app.conf big.bin part-aa part-ab lifecycle.json /tmp/out.txt</code></pre></li>
</ol>
<p>Nothing remains to bill: no versions, no markers, no parts, no bucket.</p>
`
  }
});
