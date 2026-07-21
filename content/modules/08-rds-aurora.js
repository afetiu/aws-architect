/* Module 08 — RDS & Aurora (SAA track) */
window.COURSE.register({
  id: "rds-aurora",
  order: 8,
  track: "saa",
  title: "RDS & Aurora",
  description: "Managed relational databases done properly: what RDS actually manages (and takes away), the HA-vs-read-scaling axis that the exam tests relentlessly, backup/PITR mechanics, and Aurora's log-structured distributed storage engine — the one genuinely novel database architecture in the AWS catalog.",
  examWeight: "Very high yield on SAA-C03. Multi-AZ vs read replicas appears on nearly every exam form; Aurora endpoints, Global Database RPO/RTO, and encrypt-an-unencrypted-instance are recurring trap patterns.",
  lessons: [
    {
      id: "managed-not-magic",
      title: "RDS: managed, not magic",
      html: `
<p>RDS is best understood as <strong>your familiar database engine running on an EC2 instance you cannot log into</strong>, wrapped in an automation control plane. The engine is stock MySQL, PostgreSQL, MariaDB, SQL Server, Oracle, or Db2 — same wire protocol, same SQL dialect, same query planner you already know. What changes is the operational contract: AWS owns the host, the OS, the storage layer, patching, backups, and failover orchestration. You own schema, queries, indexes, and capacity decisions. That split is exactly what the exam probes with "shared responsibility" questions.</p>

<h3>What you give up</h3>
<ul>
<li><strong>No SSH, no OS access.</strong> You cannot install agents, tune kernel parameters, mount extra volumes, or read the filesystem. Anything you used to do on-box (log shipping scripts, cron-driven vacuum jobs, custom monitoring daemons) must move to RDS features or external tooling.</li>
<li><strong>No true superuser.</strong> The master user gets an <code>rds_superuser</code>-style role that can create databases and roles but cannot touch replication internals, load arbitrary C extensions, or bypass RDS-managed settings. On PostgreSQL only the extensions on the engine's allowlist are installable.</li>
<li><strong>No arbitrary filesystem-level configuration.</strong> Every engine parameter you would normally set in <code>my.cnf</code> or <code>postgresql.conf</code> is managed through a <strong>parameter group</strong>; features that were separate installs (Oracle TDE, SQL Server native backup) live in <strong>option groups</strong>.</li>
</ul>

<div class="callout deep">Parameter groups come in two flavors of parameter: <strong>dynamic</strong> (applied immediately to all instances using the group) and <strong>static</strong> (applied only after a reboot — the instance shows <em>pending-reboot</em> until you do it). A parameter group is decoupled from instances: editing the group changes every DB that references it, which is both a fleet-management feature and a blast-radius hazard. Never edit the default parameter group — you cannot, actually; RDS forces you to clone it first, which is a hint about how AWS wants you to work.</div>

<h3>What you get</h3>
<p>Automated provisioning across AZs, storage that can grow online, automated backups with point-in-time restore, one-API-call replicas, minor-version patching in a window you choose, CloudWatch metrics plus Enhanced Monitoring (an agent that reports real OS-level stats at up to 1-second granularity — the standard CloudWatch metrics are hypervisor-view) and Performance Insights for query-level load analysis.</p>

<h3>Storage: the knobs that matter</h3>
<p>RDS storage is EBS underneath. Three classes: <strong>gp3</strong> (general purpose, baseline IOPS with independent throughput/IOPS provisioning above defaults), <strong>io1/io2</strong> (provisioned IOPS for latency-sensitive OLTP), and legacy magnetic (ignore it). <strong>Storage autoscaling</strong> grows the allocation automatically when free space drops under 10 percent for 5 minutes and no scaling happened in the last 6 hours — you set a maximum-storage threshold and RDS handles the rest. Two things seniors should note: autoscaling only ever grows (<strong>you cannot shrink RDS storage</strong>; the only path down is dump-and-restore or DMS into a smaller instance), and a scaling event is not instantaneous, so autoscaling is a safety net against a 3 a.m. page, not a substitute for capacity planning.</p>

<div class="callout war">The classic production incident: a runaway query fills local temp or a forgotten table bloats, storage autoscaling fires, and now you are paying for storage you can never give back without a migration. Set the max-storage ceiling deliberately, and alarm on FreeStorageSpace well before autoscaling triggers.</div>

<h3>Maintenance windows and versioning</h3>
<p>Every instance has a weekly 30-minute <strong>maintenance window</strong> for hardware, OS, and minor engine patches. With auto-minor-version-upgrade enabled, RDS applies minor versions in that window. Major version upgrades are always manual and always your problem to test — parameter groups are version-scoped, so a major upgrade means a new parameter group family. On a Multi-AZ instance, many maintenance operations are performed on the standby first, then a failover promotes it, then the old primary is patched — turning a long outage into a roughly one-minute failover blip. Single-AZ instances just go down for the duration.</p>

<h3>Pricing shape</h3>
<p>You pay on four dimensions: instance-hours (by class, with reserved-instance discounts), storage GB-month plus provisioned IOPS, backup storage beyond 100 percent of your allocated storage, and data transfer (cross-AZ replication traffic for Multi-AZ is free; cross-region replica traffic is not). Licensing is baked in for MySQL/PostgreSQL/MariaDB; Oracle offers license-included or BYOL; SQL Server is license-included only.</p>

<h3>When NOT to use RDS</h3>
<ul>
<li>You need OS access, unsupported extensions, or exotic engine builds — that is <strong>RDS Custom</strong> (Oracle/SQL Server only, you get SSH and shared responsibility shifts back toward you) or self-managed EC2.</li>
<li>Your access pattern is a key-value lookup at massive scale — DynamoDB will be cheaper and faster.</li>
<li>You need more than the RDS ceiling of read scaling or storage — Aurora raises those ceilings, and beyond that you are into sharding territory RDS will not manage for you.</li>
</ul>

<div class="callout exam">Trap pattern: "the DBA needs to install a custom agent on the database server" or "requires access to the underlying operating system" → the answer is RDS Custom or EC2-hosted, never plain RDS. Conversely "reduce operational overhead of patching and backups" → RDS/Aurora over EC2, every time.</div>
`
    },
    {
      id: "ha-vs-read-scaling",
      title: "Multi-AZ vs read replicas: the HA / read-scaling axis",
      html: `
<p>This is the single most-tested RDS concept, and the mental model is one sentence: <strong>Multi-AZ is for availability (synchronous, invisible, not readable in the classic form); read replicas are for read scaling (asynchronous, visible, readable, promotable)</strong>. Every question in this space is asking you to place a requirement on that axis. There are now three deployment shapes, and the newer one deliberately blurs the line.</p>

<h3>1. Multi-AZ instance deployment (the classic)</h3>
<p>One primary, one <strong>standby</strong> in a different AZ. Replication is <strong>synchronous at the storage level</strong> — a commit does not acknowledge until the write is durable on both the primary's and the standby's storage. Consequences a senior should internalize:</p>
<ul>
<li>The standby is <strong>not readable</strong>. It accepts no connections at all. You are paying for a full second instance that serves zero queries. This is the number-one exam trap: "add Multi-AZ to scale reads" is always wrong.</li>
<li>Failover is <strong>DNS-based</strong>: the instance endpoint is a CNAME, and on failure RDS flips it to the standby. Typical failover is <strong>60–120 seconds</strong>, dominated by failure detection plus DNS propagation plus engine crash recovery. Clients with long DNS caching (looking at you, JVM defaults) can stick to the dead primary far longer — set JVM <code>networkaddress.cache.ttl</code> sensibly or use RDS Proxy, which fails over faster because it manages connections below DNS.</li>
<li>Synchronous replication adds write latency (one cross-AZ round trip, order of 1–2 ms) — usually acceptable, occasionally the reason a latency-critical system measures worse after enabling Multi-AZ.</li>
</ul>

<div class="callout deep">Failover triggers: AZ outage, primary host failure, storage failure, instance class change, OS patching, or a manual <code>reboot with failover</code>. That last one is how you test it — and you should, because the first failover you experience should not be a real outage.</div>

<h3>2. Multi-AZ DB cluster deployment (the newer shape)</h3>
<p>One writer plus <strong>two readable standbys</strong> in three AZs (MySQL and PostgreSQL only). Replication is <strong>semi-synchronous</strong>: a commit requires acknowledgment from at least one of the two standbys, not both. That buys three things: the standbys serve reads through a dedicated <strong>reader endpoint</strong>, failover is faster (typically <strong>under 35 seconds</strong>, often much less, because a standby is already open and warm), and writes can be faster than classic Multi-AZ because the commit path waits for one ack instead of full synchronous storage replication. The cost: three instances instead of two, and because only one standby must ack, the reader you hit may briefly lag the writer — reads from the reader endpoint are near-synchronous, not strictly consistent.</p>

<h3>3. Read replicas</h3>
<p>Asynchronous replicas fed by the engine's native replication (binlog for MySQL/MariaDB, WAL streaming for PostgreSQL). Up to <strong>15 per source</strong> for most engines, and they can be <strong>cross-region</strong>. Key properties:</p>
<ul>
<li><strong>Asynchronous</strong> — replica lag is a real, monitorable quantity (ReplicaLag metric). Read-after-write consistency is not guaranteed; an application that writes then immediately reads must go to the primary or tolerate staleness.</li>
<li><strong>Readable and individually addressable</strong> — each replica gets its own endpoint; your application or a proxy layer does the read routing (plain RDS has no built-in reader endpoint for replicas, unlike Aurora and unlike the Multi-AZ cluster shape).</li>
<li><strong>Promotable</strong> — promotion breaks replication and turns the replica into a standalone instance. It is a manual, one-way operation with data loss equal to replica lag. This is the DR pattern for plain RDS cross-region: replica in the second region, promote on disaster.</li>
<li>A read replica can itself be Multi-AZ, and can have its own replicas (chaining, with added lag).</li>
</ul>

<h3>The comparison table to burn in</h3>
<table>
<thead><tr><th></th><th>Multi-AZ instance</th><th>Multi-AZ DB cluster</th><th>Read replica</th></tr></thead>
<tbody>
<tr><td>Purpose</td><td>HA only</td><td>HA + some read scale</td><td>Read scale / DR</td></tr>
<tr><td>Replication</td><td>Synchronous</td><td>Semi-sync (1 of 2 acks)</td><td>Asynchronous</td></tr>
<tr><td>Standby readable?</td><td>No</td><td>Yes (2 readers)</td><td>Yes</td></tr>
<tr><td>Failover</td><td>~60–120 s, automatic</td><td>Typically under 35 s, automatic</td><td>Manual promotion only</td></tr>
<tr><td>Cross-region</td><td>No</td><td>No</td><td>Yes</td></tr>
<tr><td>RPO</td><td>Zero (sync)</td><td>Near zero</td><td>Replica lag</td></tr>
</tbody>
</table>

<div class="callout exam">Keyword mapping: "automatic failover / high availability / minimize downtime" → Multi-AZ. "Offload reporting queries / scale read traffic" → read replicas. "Both HA and readable standbys with faster failover" → Multi-AZ DB cluster. "Disaster recovery in another region" (plain RDS) → cross-region read replica + promote. Watch for the distractor that offers Multi-AZ for read scaling or replicas for automatic failover — both are wrong by definition.</div>

<div class="callout war">Replica lag on MySQL is historically single-threaded apply (much improved with parallel replication, but still a thing under bursty writes). A replica that falls hours behind during a bulk load is not broken — it is the design. If your DR RPO is measured in seconds, async replicas need lag alarms, or you need Aurora Global Database instead.</div>
`
    },
    {
      id: "backups-pitr",
      title: "Backups, snapshots, and how PITR actually works",
      html: `
<p>RDS backup has two distinct mechanisms that the exam loves to make you distinguish: <strong>automated backups</strong> (system-managed, enable point-in-time restore, expire) and <strong>manual snapshots</strong> (user-managed, single moment, live until you delete them). Understanding the mechanics tells you which answers are even possible.</p>

<h3>Automated backups and PITR mechanics</h3>
<p>With automated backups enabled (retention 1–35 days; 0 disables, which also breaks anything needing PITR), RDS takes a <strong>daily storage-level snapshot</strong> during your backup window and continuously uploads the engine's <strong>transaction logs</strong> (binlog / WAL / redo) to S3, roughly every 5 minutes. Point-in-time restore = restore the most recent daily snapshot before your target time, then <strong>replay the archived logs</strong> forward to the requested timestamp. Two consequences fall straight out of that design:</p>
<ul>
<li>The <strong>latest restorable time</strong> trails reality by up to about 5 minutes (the log-upload interval). PITR RPO is roughly 5 minutes, not zero.</li>
<li>Restore time depends on how much log has to be replayed since the base snapshot — restoring to 11 p.m. when the daily snapshot ran at midnight yesterday means nearly a full day of replay.</li>
</ul>
<p><strong>Every restore — PITR or snapshot — creates a new instance with a new endpoint.</strong> You never restore "in place." Plan for the DNS/config cutover in your runbook. On Single-AZ instances the daily snapshot causes a brief I/O suspension; on Multi-AZ the snapshot is taken from the standby, so production feels nothing — yet another quiet argument for Multi-AZ.</p>

<div class="callout deep">This is textbook full-plus-incremental recovery, same as PgBackRest or Percona XtraBackup plus binlog archiving — AWS just runs it for you. The snapshots themselves are EBS-style incrementals: only blocks changed since the previous snapshot are stored, which is why backup storage is cheaper than it looks and why deleting one snapshot in a chain does not lose data for the others.</div>

<h3>Manual snapshots</h3>
<p>User-initiated, kept <strong>forever</strong> until explicitly deleted — they survive instance deletion, which is exactly why the console offers (and you should take) a final snapshot on delete. No log replay: a snapshot restores to exactly its creation moment. Manual snapshots are the unit of <strong>sharing</strong> (to other accounts) and <strong>copying</strong> (to other regions).</p>

<div class="callout limits">Numbers worth memorizing: automated retention <strong>1–35 days</strong>. Log upload ~<strong>5 minutes</strong> (PITR granularity). Manual snapshots: no expiry, soft limit 100 per region. When you delete an instance, automated backups can be retained for their remaining window, but manual snapshots are the only guaranteed long-term artifact. Backup storage up to 100 percent of provisioned storage is free; beyond that you pay.</div>

<h3>Cross-region and cross-account patterns</h3>
<ul>
<li><strong>Cross-region snapshot copy</strong>: copy a snapshot to another region, restore there. This is the cheap, high-RPO DR pattern (RPO = snapshot age, RTO = restore time). Automate with AWS Backup or EventBridge-triggered copies.</li>
<li><strong>Cross-region automated backup replication</strong>: RDS can replicate automated backups and transaction logs to a second region, giving you cross-region PITR without a running replica — mid-tier DR between snapshot-copy and a live cross-region replica.</li>
<li><strong>Cross-account</strong>: share a manual snapshot with the target account, which copies it locally. Encrypted snapshots require sharing the KMS key too — and snapshots encrypted with the default <code>aws/rds</code> key <strong>cannot be shared cross-account at all</strong>; you must copy to a customer-managed key first. Recurring exam trap.</li>
</ul>

<h3>Choosing the DR tier</h3>
<table>
<thead><tr><th>Pattern</th><th>RPO</th><th>RTO</th><th>Cost while idle</th></tr></thead>
<tbody>
<tr><td>Cross-region snapshot copies</td><td>Hours (copy cadence)</td><td>Restore time (long)</td><td>Snapshot storage only</td></tr>
<tr><td>Cross-region automated backup replication</td><td>Minutes</td><td>Restore + replay</td><td>Backup storage only</td></tr>
<tr><td>Cross-region read replica</td><td>Seconds (lag)</td><td>Promotion (minutes)</td><td>Full instance</td></tr>
<tr><td>Aurora Global Database</td><td>~1 second</td><td>Under a minute (managed failover)</td><td>Full secondary cluster</td></tr>
</tbody>
</table>

<div class="callout exam">"Restore to a specific point in time" → automated backups/PITR, and remember the restore is a <em>new instance</em>. "Retain backups for 7 years for compliance" → manual snapshots (or AWS Backup vaults), because automated backups cap at 35 days. "Copy encrypted snapshot to another account" → re-encrypt with a customer-managed KMS key first. Watch RPO/RTO numbers in the stem — they select the row of the table above.</div>

<div class="callout war">Two production gotchas. First: disabling automated backups (retention 0) silently deletes all existing automated backups and kills PITR — people do this to "speed up a migration" and discover the blast radius later. Second: read replicas require binlog/WAL retention on the source, which automated backups provide; retention 0 on a MySQL source also breaks replica creation. Leave retention on.</div>
`
    },
    {
      id: "security-encryption-insights",
      title: "Encryption, IAM auth, and Performance Insights",
      html: `
<p>RDS security questions cluster around one asymmetry: <strong>encryption at rest is a creation-time decision</strong>. Everything else — TLS in transit, IAM authentication, Secrets Manager rotation — can be layered on later. Know the one-way doors.</p>

<h3>Encryption at rest: the one-way door</h3>
<p>RDS encryption uses KMS keys at the storage layer (EBS-style, AES-256), covering the instance, its automated backups, snapshots, and read replicas. The rules that generate exam questions:</p>
<ul>
<li>You <strong>cannot enable encryption on an existing unencrypted instance</strong>. The migration path is: snapshot the unencrypted instance → <strong>copy the snapshot with encryption enabled</strong> (specify a KMS key on the copy) → restore a new instance from the encrypted copy → repoint the application. There is downtime or a catch-up strategy involved; the exam usually accepts the snapshot-copy path as "the" answer.</li>
<li>You cannot decrypt an encrypted instance, and you cannot restore an encrypted snapshot to an unencrypted instance.</li>
<li>Replicas of an encrypted primary are encrypted; you cannot have an unencrypted replica of an encrypted source (or vice versa). Cross-region replicas/copies must specify a KMS key <em>in the destination region</em> — KMS keys are regional.</li>
</ul>

<div class="callout exam">"Existing production database must now be encrypted at rest" → snapshot, copy-with-encryption, restore, cutover. Distractors will offer "enable encryption in modify settings" (impossible) or "enable TLS" (in transit, not at rest). Also memorize: default <code>aws/rds</code>-key snapshots cannot be shared cross-account; customer-managed keys can (share key + snapshot).</div>

<h3>In transit, and TDE</h3>
<p>All engines support TLS; you can force it (PostgreSQL <code>rds.force_ssl</code>, MySQL <code>require_secure_transport</code>). Certificates chain to an RDS regional CA — rotate client trust stores when AWS rotates CAs (a real operational event that has paged many teams). Oracle and SQL Server additionally support <strong>TDE</strong> via option groups — that is engine-level encryption, orthogonal to (and combinable with) KMS storage encryption.</p>

<h3>IAM database authentication</h3>
<p>For MySQL, MariaDB, and PostgreSQL, IAM auth replaces the password with a <strong>15-minute signed token</strong> generated via <code>generate-db-auth-token</code>. The database user is still created in-engine and flagged for IAM (<code>rds_iam</code> role grant on PostgreSQL); IAM controls the <em>authentication</em>, not the in-database authorization. Practical shape:</p>
<ul>
<li>Best for humans and short-lived workloads (Lambda, ECS tasks with roles) — no long-lived password to leak or rotate.</li>
<li>Token generation is an API call and connections still cost engine-side auth work; AWS recommends staying under roughly <strong>200 new IAM-auth connections per second</strong> — pool your connections (RDS Proxy pairs beautifully here, since the proxy can hold IAM auth at the front and a pooled secret at the back).</li>
<li>The alternative for application credentials is <strong>Secrets Manager with managed rotation</strong> — RDS can now own the master password in Secrets Manager natively. IAM auth = no password at all; Secrets Manager = rotating password. Exam stems distinguish these.</li>
</ul>

<h3>Network posture</h3>
<p>Instances live in your VPC behind security groups; "publicly accessible" only controls whether the endpoint resolves to a public IP — the security group still gates traffic. The standard architecture is private subnets, app-tier security group as the only ingress source. Nothing exotic, but distractors love a public database with a "very restrictive" security group; the right answer keeps it private.</p>

<h3>Performance Insights</h3>
<p>Performance Insights (PI) is RDS's query-level load dashboard. The core abstraction is <strong>database load measured in Average Active Sessions (AAS)</strong> — how many sessions are running or waiting at each sampled instant — sliced by <strong>wait events, SQL statement, host, and user</strong>. If AAS exceeds vCPU count, sessions are queuing; the wait-event breakdown tells you whether the bottleneck is CPU, lock contention, or I/O. Any engineer who has read <code>pg_stat_activity</code> in a loop or used Oracle ASH will recognize this instantly — PI is managed ASH.</p>
<ul>
<li>Free tier keeps <strong>7 days</strong> of history; paid retention extends to months. Enabling PI is online, no restart.</li>
<li>Complementary, not overlapping: <strong>Enhanced Monitoring</strong> = OS-level metrics from an on-host agent (per-process CPU, real memory); <strong>CloudWatch</strong> = hypervisor-level instance metrics; <strong>PI</strong> = database-session-level load. Exam questions ask which tool finds "the query causing high CPU" — that is PI.</li>
</ul>

<div class="callout war">PI has saved more production incidents than any other RDS feature: the "database is slow" page becomes "this one SQL digest is 80 percent of load, waiting on LWLock". Turn it on everywhere; the free tier costs nothing and the data only exists if it was enabled before the incident.</div>

<div class="callout limits">Recap numbers: IAM auth token TTL <strong>15 minutes</strong>; recommended ceiling ~<strong>200 IAM-auth connections/s</strong>; PI free retention <strong>7 days</strong>; encryption decision fixed at creation; KMS keys are per-region, so cross-region encrypted copies re-encrypt with a destination-region key.</div>
`
    },
    {
      id: "rds-proxy",
      title: "RDS Proxy: connection pooling as a managed service",
      html: `
<p>Relational engines hate connection churn. Every PostgreSQL connection is a forked backend process costing real memory; MySQL threads are cheaper but still finite (<code>max_connections</code> scales with instance memory). Serverless compute — Lambda especially — is the pathological client: thousands of concurrent invocations, each wanting its own connection, each living milliseconds. Self-managed answers are PgBouncer or ProxySQL; <strong>RDS Proxy is that layer as a managed, Multi-AZ service</strong>.</p>

<h3>What it does</h3>
<ul>
<li><strong>Connection multiplexing.</strong> The proxy maintains a warm pool of connections to the database and shares them across many client connections. Client-side you can open thousands of cheap connections to the proxy; database-side the count stays bounded. Between statements, a client's session is detached from the backing connection so another client can use it.</li>
<li><strong>Faster, cleaner failover.</strong> The proxy holds client connections open across a database failover and re-routes to the new primary without waiting on DNS — cutting effective failover time by up to ~66 percent versus clients doing DNS-based reconnect (this pairs with the Multi-AZ DNS-flip mechanics from the HA lesson). Clients see a pause, not an error storm.</li>
<li><strong>Credential centralization.</strong> The proxy authenticates to the database using credentials in <strong>Secrets Manager</strong> (required — this is how you know a stem wants RDS Proxy when it mentions Secrets Manager plus Lambda plus RDS). Clients can authenticate to the proxy with native credentials or <strong>IAM auth</strong>, letting you put IAM in front of an engine even for the connection-heavy workloads where raw IAM auth rates would be a problem.</li>
</ul>

<h3>Pinning: the fine print that bites</h3>
<p>Multiplexing only works while a session is stateless enough to hand around. If a client does something that makes the session stateful — session variables, temporary tables, prepared statements in some configurations, advisory locks, <code>SET</code> statements — the proxy must <strong>pin</strong> that client to a dedicated database connection for the rest of the session. A heavily-pinned workload gets the latency overhead of a proxy with none of the pooling benefit: you are back to one backend connection per client, plus a hop.</p>

<div class="callout war">ORMs are the usual culprit: connection-initialization SQL (setting timezone, search_path, isolation level) or unconditional prepared-statement use can pin every session. Watch the <code>DatabaseConnectionsCurrentlySessionPinned</code> metric; if it tracks your client count, the proxy is doing nothing for you. Fixes: move session setup into proxy initialization queries, disable server-side prepares in the driver, or accept pinning and size the pool accordingly.</div>

<div class="callout deep">The proxy is not a query router: it does not parse SQL to split reads and writes, and the default endpoint targets the primary. You can create additional <strong>read-only proxy endpoints</strong> that target reader instances (Aurora) — but the application still chooses which endpoint to use. It is also VPC-only: no public proxy endpoints, so a Lambda using it must be VPC-attached.</div>

<h3>When it wins, and when it is overhead</h3>
<table>
<thead><tr><th>Situation</th><th>RDS Proxy?</th></tr></thead>
<tbody>
<tr><td>Lambda at scale hitting RDS/Aurora</td><td>Yes — canonical use case</td></tr>
<tr><td>Connection storms during deploys / failovers</td><td>Yes — absorbs the surge, smooths failover</td></tr>
<tr><td>Hundreds of app instances each holding small pools</td><td>Yes — collapses total backend connections</td></tr>
<tr><td>A steady app tier with a well-tuned pool (HikariCP etc.)</td><td>Marginal — you add a hop and hourly cost for little gain</td></tr>
<tr><td>Session-stateful workloads (temp tables everywhere)</td><td>No — everything pins; keep the direct pool</td></tr>
</tbody>
</table>

<p><strong>Pricing shape:</strong> per vCPU-hour of the target database instance (with a minimum), plus nothing per connection. It supports MySQL, PostgreSQL, MariaDB, and SQL Server on RDS, and Aurora MySQL/PostgreSQL. There is no proxy for Oracle.</p>

<h3>Operational notes</h3>
<ul>
<li>The proxy is itself Multi-AZ and managed — one less PgBouncer fleet to run, at the cost of less tuning control (you set a max connections percentage and idle timeouts, not low-level pool behavior).</li>
<li>Latency overhead is real but small (single-digit milliseconds typical). For most OLTP it is noise; for a 500-microsecond query loop it is not.</li>
<li>Because the proxy holds the pool, database-side <code>max_connections</code> can be tuned down, freeing engine memory for buffers — an underrated win on memory-bound instances.</li>
</ul>

<div class="callout exam">Keyword mapping: "Lambda functions exhausting database connections" / "too many connections errors" / "TimeoutError from the pool during traffic spikes" → RDS Proxy. "Reduce failover time for applications" → RDS Proxy is a valid answer alongside Multi-AZ. If the stem mentions storing DB credentials in Secrets Manager and pooling in one breath, it is describing RDS Proxy. Distractors: "increase max_connections" (treats the symptom, exhausts memory), "use ElastiCache" (different problem), "enable Multi-AZ" (availability, not connections).</div>
`
    },
    {
      id: "aurora-architecture",
      title: "Aurora internals: the log is the database",
      html: `
<p>Aurora is the one place AWS actually re-architected the database rather than hosting it. The engine front end is wire- and SQL-compatible MySQL or PostgreSQL, but the storage engine underneath is replaced with a <strong>purpose-built, log-structured, distributed storage service</strong>. If you understand this design, every Aurora feature — replica scale, fast failover, fast cloning, backtrack, Global Database — stops being a bullet list and becomes an obvious consequence.</p>

<h3>The core idea: ship only the redo log</h3>
<p>A traditional engine writes data pages, doublewrite/full-page images, and the redo log to disk, and replication ships some combination of those. Aurora's insight (from the original SIGMOD paper): <strong>the redo log already contains everything needed to reconstruct any page</strong>. So the compute node sends <em>only redo log records</em> to the storage layer. The storage nodes append them durably, acknowledge, and <strong>materialize data pages asynchronously in the background</strong> by applying log to prior page versions. No checkpointing on the compute node, no full page writes, no doublewrite buffer — roughly an order of magnitude less write I/O crossing the network than MySQL replicating the same workload.</p>

<h3>6 copies, 3 AZs, quorums</h3>
<p>The database volume is striped into <strong>10 GB protection groups (segments)</strong>, and each segment is replicated <strong>6 ways across 3 AZs (2 per AZ)</strong>. Quorum rules:</p>
<ul>
<li><strong>Writes need 4 of 6</strong> acknowledgments. The volume keeps accepting writes after losing an entire AZ <em>plus</em> one more node (any 2 of 6).</li>
<li><strong>Reads for recovery need 3 of 6</strong> — read and write quorums overlap, guaranteeing recovery sees every acknowledged write. (Steady-state reads do not pay a quorum: the compute node knows which segments are current and reads from one.)</li>
<li>Repair is fast because segments are small: a lost 10 GB segment re-replicates in seconds from peers, shrinking the double-fault window continuously.</li>
</ul>
<p>The volume <strong>auto-grows in 10 GB segments up to 128 TiB</strong> with no provisioning, and you pay for what is stored (modern Aurora also bills storage I/O differently in the I/O-Optimized configuration — flat storage price, no per-I/O charge — worth choosing when I/O is over ~25 percent of your Aurora bill).</p>

<div class="callout deep">Because storage is shared and separate from compute, <strong>replicas are not fed by binlog</strong>. All instances in a cluster mount the same distributed volume; the writer streams redo metadata to replicas only so they can invalidate cached pages, which is why <strong>replica lag is typically ~10–20 milliseconds</strong> rather than seconds, and why you can run <strong>up to 15 replicas</strong> without write amplification on the primary. Crash recovery also transforms: there is no redo replay on restart (storage is always self-healing forward), so failover time is dominated by detection and cache warmup, not log replay.</div>

<h3>Endpoints: how clients find the cluster</h3>
<table>
<thead><tr><th>Endpoint</th><th>Points at</th><th>Use</th></tr></thead>
<tbody>
<tr><td><strong>Cluster (writer)</strong></td><td>Current primary; follows failover</td><td>All writes; the only endpoint that is always the writer</td></tr>
<tr><td><strong>Reader</strong></td><td>Connection-level load balancing across all replicas</td><td>Read scaling without client-side routing</td></tr>
<tr><td><strong>Custom</strong></td><td>A subset you define</td><td>Isolate workloads — e.g. two big-memory replicas reserved for analytics</td></tr>
<tr><td><strong>Instance</strong></td><td>One specific instance</td><td>Diagnostics; avoid in app config</td></tr>
</tbody>
</table>
<p>The reader endpoint balances at DNS/connection level, not per-query — long-lived pools can end up lopsided across replicas; churn connections periodically or use RDS Proxy.</p>

<h3>Failover: replicas are the standbys</h3>
<p>Aurora needs no separate standby instance — <strong>any replica is a failover target</strong>, because storage is already shared. You assign each replica a <strong>promotion priority tier (0–15, lower wins)</strong>; on writer failure Aurora promotes the lowest tier (largest instance breaks ties), flips the cluster endpoint, and is typically done in <strong>under 30 seconds</strong>. A cluster with no replicas has to spin up a new writer instead — minutes, not seconds — so a serious Aurora deployment always runs at least one replica. There is no data loss on failover: acknowledged writes hit the 4/6 quorum, and the promoted replica sees the same volume.</p>

<div class="callout exam">Numbers the exam expects: <strong>6 copies / 3 AZs / 4-of-6 write quorum / 3-of-6 read quorum</strong>; <strong>15 replicas</strong>; <strong>128 TiB</strong> max volume; replica lag in <strong>milliseconds</strong>; failover <strong>under 30 s</strong> with a replica present; priority <strong>tier 0–15</strong>. "Survives loss of an AZ plus one more node for writes; loss of two full AZs still allows reads/recovery quorum" is a stem pattern. Aurora vs RDS Multi-AZ questions: Aurora replicas do double duty (read scaling AND failover target); the classic RDS standby does neither of those together.</div>

<div class="callout war">Aurora is not automatically cheaper. Storage I/O billing (in the standard configuration) surprises write-heavy or scan-heavy workloads, and the smallest sensible production cluster is two instances. A modest, steady MySQL workload on a right-sized RDS instance with Multi-AZ can cost less. Aurora earns its price when you need replica scale, fast failover, huge volumes, cloning, or Global Database — pick it for those, not by default.</div>
`
    },
    {
      id: "aurora-advanced",
      title: "Serverless v2, Global Database, and Aurora's party tricks",
      html: `
<p>The features in this lesson all fall out of Aurora's shared-storage design: because compute is stateless against a distributed volume, you can scale it continuously (Serverless v2), replicate the volume across regions (Global Database), rewind it (Backtrack), and fork it copy-on-write (fast cloning).</p>

<h3>Aurora Serverless v2</h3>
<p>Serverless v2 scales an instance's capacity <strong>in-place and continuously</strong>, measured in <strong>ACUs</strong> (Aurora Capacity Units, each ~2 GiB RAM plus proportional CPU/network), in steps as small as 0.5 ACU within a min/max you configure. Unlike the retired v1, v2 instances are first-class cluster members: they mix with provisioned instances in one cluster, work with replicas, Global Database, and Proxy, and scale without dropping connections — the buffer pool survives resizing because scaling is in-place, not instance replacement.</p>
<ul>
<li><strong>Wins:</strong> spiky or unpredictable load, dev/test fleets idling most of the day, multi-tenant SaaS with tenant-hour variance, and "scale the readers with traffic" patterns (a Serverless v2 reader behind the reader endpoint absorbs bursts a fixed-size reader cannot).</li>
<li><strong>Loses:</strong> flat, sustained load — a steady workload costs more per-ACU-hour than the equivalent provisioned (or reserved) instance. Also note min ACU floors: aggressive floors save money but cold-ish starts from a low floor add seconds of ramp under a sudden spike. Newer versions can scale to 0 ACUs and pause entirely, with a resume delay on first connection.</li>
</ul>

<div class="callout exam">"Unpredictable / intermittent / variable workload" + relational → Aurora Serverless v2. "Steady, predictable high throughput" → provisioned (reserved) instances. Watch for stems that combine both: provisioned writer for the steady base plus Serverless v2 readers for bursts is a legitimate architecture and occasionally the correct multi-select answer.</div>

<h3>Global Database</h3>
<p>Aurora Global Database replicates the <strong>storage volume itself</strong> to up to five secondary regions using dedicated replication infrastructure — not the engine, not binlog. Typical cross-region lag is <strong>under one second (RPO ~1 s)</strong>, with negligible load on the primary writer. Secondary clusters are readable (up to 16 replicas each) and have no writer of their own. Two failover paths, and the exam cares which is which:</p>
<ul>
<li><strong>Managed (switchover / planned failover):</strong> for planned regional moves — Aurora coordinates a lossless (RPO 0) role swap.</li>
<li><strong>Detach-and-promote (unplanned):</strong> in a real regional outage you promote a secondary; it detaches from the global cluster and accepts writes typically <strong>in under a minute (RTO)</strong>, accepting the ~1 s of unreplicated data as loss. Aurora also offers a managed unplanned failover flavor that automates this. Afterward, the old primary region rejoins as a secondary.</li>
</ul>
<p><strong>Write forwarding</strong> lets applications connected to a secondary region issue writes that Aurora transparently forwards to the primary writer — simplifying app deployment in read regions (one connection string) at the cost of cross-region write latency. It is a convenience, not multi-master: there is still exactly one writer region.</p>

<div class="callout limits">Global Database numbers: <strong>RPO ~1 second, RTO under a minute</strong>, up to <strong>5 secondary regions</strong>, <strong>16 readers per secondary</strong>. Compare: cross-region RDS read replica RPO is replica lag (seconds to worse) with manual promotion. When a stem says "RPO of 1 second and RTO under a minute for a relational database across regions", it is spelling out Aurora Global Database.</div>

<h3>Backtrack (Aurora MySQL only)</h3>
<p>Backtrack <strong>rewinds the existing cluster in place</strong> to a prior point in time (up to 72 hours) in minutes, without a restore — possible because the log-structured storage keeps prior page versions. Contrast with PITR: PITR creates a <em>new</em> cluster and takes as long as a restore; backtrack mutates the current cluster (brief pause, connections dropped) and is rerunnable — wind back, look, wind forward again. It is the "fat-fingered UPDATE without a WHERE clause at 2 p.m." tool. It is not a backup substitute and does not protect against volume loss.</p>

<h3>Fast database cloning</h3>
<p>Cloning creates a new cluster against the same storage volume using <strong>copy-on-write</strong>: creation is near-instant regardless of size, and you pay only for pages that diverge after the clone. The obvious uses: production-scale test databases, blue/green schema-migration rehearsal, giving analytics a frozen copy without a multi-hour restore or double storage bill. Clones can be cross-account (via RAM sharing). A senior instinct to keep: a clone shares the storage fleet's performance envelope with its parent initially, so do not point a load test at a clone and assume isolation is perfect.</p>

<h3>Babelfish for Aurora PostgreSQL</h3>
<p>Babelfish adds a <strong>TDS (SQL Server wire protocol) endpoint and T-SQL dialect layer</strong> on Aurora PostgreSQL, so SQL Server applications can connect with existing drivers, largely unmodified, while the data lives in PostgreSQL. It is a migration accelerator: instead of a full rewrite before cutover, you move the database first and burn down T-SQL incompatibilities over time (assessment tooling exists — Compass — to find unsupported constructs). Keyword mapping is mechanical: "migrate SQL Server application with minimal code changes to open source engine" → Babelfish.</p>

<div class="callout war">Backtrack and cloning change incident playbooks — teams that do not know they exist do a 4-hour PITR restore for what backtrack fixes in 5 minutes. Put them in the runbook before the incident. And rehearse Global Database failover: detach-and-promote is one API call, but the application-layer cutover (DNS, write endpoints, forwarding config) is where real RTO is spent.</div>
`
    }
  ],
  quiz: [
    {
      q: "A payment service runs on RDS for PostgreSQL, Single-AZ. The business now requires the database to survive an Availability Zone failure with automatic recovery and zero data loss for committed transactions. Reads are already handled adequately. What should the architect do?",
      options: [
        "Add a read replica in another AZ and promote it if the primary AZ fails",
        "Convert the instance to a Multi-AZ instance deployment",
        "Enable automated backups with 35-day retention and cross-region copy",
        "Migrate to an Aurora Serverless v2 cluster with a single instance"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: Multi-AZ instance deployment replicates synchronously to a standby in another AZ and fails over automatically (~60–120 s) with zero committed-data loss — exactly the requirement, with no read-scaling need to justify anything more.</p><p><strong>A</strong> fails both requirements: replicas are asynchronous (lag = data loss on promotion) and promotion is manual, not automatic.</p><p><strong>C</strong> is durability, not availability — a restore is a new instance, takes far too long, and PITR has ~5-minute RPO.</p><p><strong>D</strong> — a single-instance Aurora cluster has no ready failover target; Aurora storage survives the AZ, but compute recovery means launching a new writer, which is slower and not what the stem asks for versus the direct Multi-AZ answer.</p>"
    },
    {
      q: "An analytics team hammers a production RDS for MySQL Multi-AZ instance with heavy reporting queries every morning, degrading OLTP latency. What is the most appropriate fix?",
      options: [
        "Direct the reporting queries at the Multi-AZ standby instance",
        "Create a read replica and point the reporting workload at its endpoint",
        "Enable RDS Proxy and route reports through a read-only proxy endpoint",
        "Increase the instance class so both workloads fit"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: read replicas exist precisely to offload read-heavy workloads; reporting tolerates async replica lag.</p><p><strong>A</strong> is the classic trap — the Multi-AZ <em>instance</em> standby accepts no connections at all; it is not readable.</p><p><strong>C</strong> — RDS Proxy pools connections; it does not create read capacity, and on RDS MySQL there is no replica behind it here to route to anyway.</p><p><strong>D</strong> works briefly but scales cost vertically, couples the workloads' failure domains, and is not 'most appropriate' when a purpose-built horizontal option exists.</p>"
    },
    {
      q: "A company must keep database backups for 7 years for regulatory reasons, and also needs the ability to restore the production RDS database to any point within the last two weeks. Which combination meets both requirements?",
      options: [
        "Set automated backup retention to 7 years",
        "Enable automated backups with 14-day retention, and take periodic manual snapshots retained for 7 years",
        "Take daily manual snapshots for 14 days and enable backtrack for 7 years",
        "Enable automated backups with 35-day retention and rely on snapshot chaining for older data"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: automated backups (retention 14 days) provide PITR within the two-week window; manual snapshots have no expiry and satisfy the 7-year hold (AWS Backup vaults are the productionized version of the same idea).</p><p><strong>A</strong> is impossible — automated retention caps at <strong>35 days</strong>.</p><p><strong>C</strong> — manual snapshots restore only to their creation instant (no PITR between them), and backtrack is Aurora MySQL-only with a 72-hour ceiling.</p><p><strong>D</strong> — 35 days still expires; nothing in automated backups persists 7 years.</p>"
    },
    {
      q: "An unencrypted RDS for MySQL instance now falls under a policy requiring encryption at rest with a customer-managed KMS key. What is the correct approach?",
      options: [
        "Modify the instance and enable encryption with the CMK; apply during the next maintenance window",
        "Create an encrypted read replica of the instance and promote it",
        "Take a snapshot, copy the snapshot with encryption using the CMK, restore a new instance from the encrypted copy, and repoint the application",
        "Enable TLS enforcement via the parameter group and rotate the CA certificate"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>C</strong> is the canonical path: encryption at rest is a creation-time property, so you snapshot → copy-with-encryption (specifying the CMK) → restore → cut over.</p><p><strong>A</strong> is impossible — you cannot enable encryption on an existing instance by modification.</p><p><strong>B</strong> is impossible for the same reason — an unencrypted source cannot have an encrypted replica.</p><p><strong>D</strong> confuses in-transit (TLS) with at-rest (KMS); it does not touch the storage encryption requirement.</p>"
    },
    {
      q: "A serverless application with thousands of concurrent Lambda invocations intermittently fails with 'too many connections' errors against RDS for PostgreSQL. Database CPU and memory are healthy. What is the best remediation?",
      options: [
        "Raise max_connections in a custom parameter group and reboot",
        "Place RDS Proxy between the Lambda functions and the database",
        "Enable Multi-AZ so the standby can absorb overflow connections",
        "Move connection strings into Secrets Manager and enable rotation"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: RDS Proxy multiplexes many short-lived Lambda connections over a small pooled set of database connections — the canonical serverless-plus-RDS pattern.</p><p><strong>A</strong> treats the symptom: each PostgreSQL connection is a process consuming memory; raising the cap converts connection errors into memory pressure and does not stop growth with concurrency.</p><p><strong>C</strong> — the Multi-AZ standby accepts no connections; it adds availability, not capacity.</p><p><strong>D</strong> is good hygiene (and RDS Proxy requires Secrets Manager for its own DB credentials) but rotation does nothing about connection counts.</p>"
    },
    {
      q: "During a simulated failure test, an application took over 8 minutes to reconnect after an RDS Multi-AZ failover, even though the RDS console showed failover completed in 90 seconds. What is the most likely cause?",
      options: [
        "The standby had to replay transaction logs before accepting connections",
        "The application runtime cached the old DNS answer for the instance endpoint well beyond the failover",
        "The security group of the standby instance blocked the application subnets",
        "Automated backups ran during the failover and delayed the promotion"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: Multi-AZ failover works by flipping a CNAME; clients that cache DNS aggressively (the JVM's default indefinite caching being the classic offender) keep connecting to the dead primary long after RDS is done. Fixes: sane resolver TTL handling or RDS Proxy, which holds connections and reroutes below DNS.</p><p><strong>A</strong> — the standby is synchronously replicated at the storage level; there is no multi-minute log replay, and RDS already reported completion.</p><p><strong>C</strong> — Multi-AZ pairs share the same security-group behavior via the same endpoint; a blocked SG would not selectively appear post-failover, and the console showed a healthy failover.</p><p><strong>D</strong> — backups on Multi-AZ are taken from the standby and do not gate failover.</p>"
    },
    {
      q: "A company needs its RDS for MySQL data available in a second region for disaster recovery, with an RPO of a few seconds and the ability to serve reads in that region today. Which option fits best?",
      options: [
        "Cross-region automated backup replication",
        "Nightly cross-region snapshot copies via AWS Backup",
        "A cross-region read replica, promoted during a disaster",
        "Multi-AZ DB cluster deployment spanning two regions"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>C</strong> is correct: a cross-region read replica ships changes continuously (RPO = replica lag, typically seconds), serves reads in the second region now, and becomes the DR primary via promotion.</p><p><strong>A</strong> gives cross-region PITR with minutes-level RPO but nothing readable and a slow restore-based RTO.</p><p><strong>B</strong> has RPO of up to a day — nowhere near seconds.</p><p><strong>D</strong> does not exist: Multi-AZ (either form) is strictly intra-region. Cross-region relational HA at tighter RPO is Aurora Global Database territory, which was not offered.</p>"
    },
    {
      q: "Which statements about the Multi-AZ DB cluster deployment (as opposed to Multi-AZ instance deployment) are accurate? (Select TWO.)",
      options: [
        "It maintains two readable standby instances in different AZs",
        "It uses fully synchronous replication to both standbys before acknowledging commits",
        "It typically fails over faster than a Multi-AZ instance deployment",
        "It supports Oracle and SQL Server engines",
        "Its reader endpoint provides strongly consistent reads"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<p><strong>A</strong> and <strong>C</strong> are correct: the cluster form runs one writer plus two readable standbys, and fails over typically in under 35 seconds because a warm, open standby is promoted.</p><p><strong>B</strong> is wrong — replication is <em>semi-synchronous</em>: a commit needs an ack from at least one of the two standbys, not both.</p><p><strong>D</strong> is wrong — Multi-AZ DB clusters are MySQL and PostgreSQL only.</p><p><strong>E</strong> is wrong — because only one standby must ack each commit, a given reader can briefly lag; reads are near-current but not strongly consistent.</p>"
    },
    {
      q: "An architect must explain why Aurora can support 15 low-lag read replicas while RDS for MySQL replicas often lag under heavy writes. Which explanation is accurate?",
      options: [
        "Aurora replicas receive and replay the binary log over a faster dedicated network",
        "Aurora replicas share the same distributed storage volume as the writer, so they apply no write stream and only invalidate cached pages",
        "Aurora batches binlog events and applies them with more parallel threads than MySQL",
        "Aurora replicas are read-only snapshots refreshed every few seconds from S3"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct and is the heart of Aurora's design: compute is separated from a shared, log-structured storage volume. Replicas mount the same volume; the writer sends them redo metadata purely for buffer-cache invalidation, so lag is typically 10–20 ms and adding replicas adds no replication apply work.</p><p><strong>A</strong> and <strong>C</strong> both describe binlog replication, which Aurora replicas within a cluster do not use at all.</p><p><strong>D</strong> is fiction — Aurora storage is continuously backed up to S3, but replicas read the live volume, not snapshots.</p>"
    },
    {
      q: "Which statement accurately describes the fault tolerance of an Aurora cluster's storage volume?",
      options: [
        "Writes need a 3-of-6 quorum, so the volume keeps accepting writes after losing an entire Availability Zone plus one more node",
        "Writes need a 4-of-6 quorum, so write availability survives the loss of an entire Availability Zone; data survives (via the 3-of-6 read quorum) even an AZ plus one additional node",
        "All 6 copies must acknowledge each write, so any node loss blocks writes until repair completes",
        "Each Availability Zone holds one copy, so losing two AZs always loses data"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct and is the exact documented guarantee: 6 copies across 3 AZs (2 per AZ); the <strong>4/6 write quorum</strong> tolerates losing any two copies — including both in one AZ — without losing write availability, and the <strong>3/6 read/recovery quorum</strong> means even an 'AZ+1' failure (three copies gone) loses no data, with fast 10 GB segment repair shrinking the exposure window.</p><p><strong>A</strong> swaps the quorums: 3/6 is the read/recovery quorum. With AZ+1 lost, only 3 copies remain, which is below the 4/6 write quorum — writes pause until repair, but no data is lost.</p><p><strong>C</strong> describes fully synchronous 6/6 replication, which Aurora deliberately avoids — that design would make every node a write-availability SPOF.</p><p><strong>D</strong> is wrong on layout (two copies per AZ) and conclusion (3/6 read quorum protects data through AZ+1 loss).</p>"
    },
    {
      q: "A gaming company runs Aurora MySQL. A developer ran a bad migration at 14:05 that corrupted several tables. The team wants the whole cluster back to its 14:00 state as fast as possible, on the same endpoints, and had backtrack enabled with a 24-hour window. What should they do?",
      options: [
        "Restore the cluster to 14:00 with point-in-time restore and update the application to the new cluster endpoint",
        "Backtrack the cluster to 14:00",
        "Create a fast clone as of 14:00 and swap the application to the clone",
        "Fail over to the reader, which lags the writer and still has the old data"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: backtrack rewinds the <em>existing</em> cluster in place within its window — minutes, same endpoints, and you can wind forward again if you overshoot. Exactly this scenario is why it exists.</p><p><strong>A</strong> works but takes far longer and produces a new cluster with new endpoints — worse on both stated requirements.</p><p><strong>C</strong> — clones are copy-on-write forks of the <em>current</em> state; they are not point-in-time and would contain the corruption.</p><p><strong>D</strong> — Aurora replicas share the same storage volume; the corruption is already visible to them (lag is milliseconds, and it is cache-level, not data-level).</p>"
    },
    {
      q: "A SaaS provider needs a relational database for a new product with completely unpredictable load: near-idle nights, sharp weekday spikes, and occasional 20x bursts. They want to avoid capacity management but keep standard PostgreSQL compatibility, replicas, and fast failover. What fits best?",
      options: [
        "Aurora PostgreSQL with Serverless v2 instances",
        "RDS for PostgreSQL with storage autoscaling enabled",
        "Aurora PostgreSQL provisioned instances sized for peak",
        "DynamoDB on-demand with a relational access layer"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A</strong> is correct: Serverless v2 scales ACUs continuously and in place, supports replicas, Global Database, and normal cluster failover, and bills for capacity actually consumed — built for exactly this shape.</p><p><strong>B</strong> — storage autoscaling grows disk, not compute; it does nothing for load spikes.</p><p><strong>C</strong> meets the functional needs but pays peak price around the clock — the stem explicitly optimizes against that.</p><p><strong>D</strong> abandons the stated PostgreSQL compatibility requirement; a 'relational access layer' over DynamoDB is a rewrite, not an architecture.</p>"
    },
    {
      q: "A global application uses Aurora Global Database with the primary in eu-west-1 and a secondary in us-east-1. The business requires: reads served locally in us-east-1, an RPO of about 1 second, and a documented plan to take writes in us-east-1 within minutes if eu-west-1 fails. Which statements are true? (Select TWO.)",
      options: [
        "Storage-level replication keeps the secondary typically under one second behind, independent of engine load",
        "The us-east-1 secondary can take writes immediately during the outage because Global Database is multi-master",
        "During a regional outage, detach-and-promote (or managed unplanned failover) makes the secondary writable, typically in under a minute",
        "Write forwarding from us-east-1 removes the need for any failover plan",
        "The secondary cluster requires its own standby writer instance kept in sync via binlog"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<p><strong>A</strong> is correct — replication happens at the storage layer over dedicated infrastructure, typically sub-second lag with negligible writer impact.</p><p><strong>C</strong> is correct — the unplanned path is detaching/promoting the secondary (manually or via managed unplanned failover), giving an RTO typically under a minute at the database layer, accepting ~1 s of loss.</p><p><strong>B</strong> is wrong — there is exactly one writer region; secondaries are read-only until promoted.</p><p><strong>D</strong> is wrong — write forwarding routes writes <em>to the primary region</em>; if that region is down, forwarding is down. It simplifies app topology, not DR.</p><p><strong>E</strong> is wrong — secondaries replicate at the storage volume level; no binlog, no standby writer needed until promotion.</p>"
    },
    {
      q: "A team migrating a large SQL Server application wants to move to an open-source-compatible engine with minimal application code changes, keeping the existing TDS-based drivers and most T-SQL. Which service should the architect evaluate first?",
      options: [
        "Aurora MySQL with the MySQL Workbench migration wizard",
        "Babelfish for Aurora PostgreSQL",
        "RDS Custom for SQL Server",
        "RDS for PostgreSQL with the pg_tds extension"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: Babelfish adds a TDS endpoint and T-SQL translation layer to Aurora PostgreSQL, so SQL Server apps connect with existing drivers largely unchanged — the stated goal almost verbatim.</p><p><strong>A</strong> — MySQL speaks neither TDS nor T-SQL; this is a full application rewrite.</p><p><strong>C</strong> — RDS Custom stays on SQL Server (licensed, not open-source-compatible); it solves the OS-access problem, not this one.</p><p><strong>D</strong> — no such supported extension; a plain PostgreSQL move means rewriting the data access layer.</p>"
    },
    {
      q: "Which RDS/Aurora features require configuration at or before instance creation and cannot simply be switched on later in place? (Select TWO.)",
      options: [
        "Storage encryption at rest with KMS",
        "Performance Insights",
        "Aurora backtrack coverage for history that predates enabling it on a cluster created without a backtrack window",
        "IAM database authentication",
        "Multi-AZ standby for an existing instance"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<p><strong>A</strong> is correct — encryption at rest is fixed at creation; the only path is snapshot → encrypted copy → restore.</p><p><strong>C</strong> is correct — backtrack must be enabled (with a target window) when the cluster is created or via a restore that enables it; you cannot rewind through history that was never being recorded (enabling it later only covers time going forward, so the existing history remains unrecoverable in place).</p><p><strong>B</strong> — Performance Insights toggles on live, no restart.</p><p><strong>D</strong> — IAM auth is a modifiable setting plus in-engine user grants.</p><p><strong>E</strong> — converting Single-AZ to Multi-AZ is an online modification (RDS builds the standby from a snapshot in the background).</p>"
    }
  ],
  flashcards: [
    { front: "RDS Multi-AZ instance deployment: is the standby readable?", back: "<strong>No.</strong> The classic Multi-AZ standby accepts no connections — it exists purely for synchronous-replica failover. Readable standbys require the Multi-AZ <em>DB cluster</em> deployment or read replicas." },
    { front: "Typical RDS Multi-AZ instance failover time and mechanism?", back: "<strong>~60–120 seconds</strong>, via a DNS CNAME flip of the instance endpoint to the standby. Client DNS caching can stretch it — fix with sane resolver TTLs or RDS Proxy." },
    { front: "Multi-AZ DB cluster deployment: topology and replication mode?", back: "1 writer + <strong>2 readable standbys</strong> across 3 AZs (MySQL/PostgreSQL only). <strong>Semi-synchronous</strong>: commit needs an ack from at least 1 of the 2 standbys. Failover typically under 35 s; has a reader endpoint." },
    { front: "RDS read replicas: replication mode, max count, cross-region?", back: "<strong>Asynchronous</strong> (binlog/WAL). Up to <strong>15</strong> per source for most engines. <strong>Cross-region supported.</strong> Promotion is manual, one-way, loses data equal to replica lag." },
    { front: "How does RDS point-in-time restore actually work?", back: "Daily automated snapshot + transaction logs shipped to S3 about every <strong>5 minutes</strong>. PITR = restore latest snapshot before target time, replay logs to the timestamp. Result is always a <strong>new instance</strong>; latest restorable time trails by ~5 min." },
    { front: "Automated backup retention range, and what does retention 0 do?", back: "<strong>1–35 days.</strong> Setting 0 disables automated backups, deletes existing ones, kills PITR, and (MySQL) breaks read-replica creation. Manual snapshots never expire." },
    { front: "How do you encrypt an existing unencrypted RDS instance?", back: "You cannot in place. <strong>Snapshot → copy snapshot with encryption (choose KMS key) → restore new instance → repoint app.</strong> Encryption is otherwise a creation-time-only decision." },
    { front: "Sharing an encrypted RDS snapshot with another AWS account — key rule?", back: "Only snapshots encrypted with a <strong>customer-managed KMS key</strong> can be shared (share the key too). Snapshots using the default aws/rds key cannot be shared cross-account — copy to a CMK first." },
    { front: "RDS storage autoscaling: trigger conditions and the catch?", back: "Grows when free space is under <strong>10%</strong> for 5 minutes and no scale in the last 6 hours, up to your max threshold. Catch: storage <strong>never shrinks</strong> — going smaller means dump/restore or DMS." },
    { front: "Parameter group: dynamic vs static parameters?", back: "<strong>Dynamic</strong> parameters apply immediately to every instance using the group. <strong>Static</strong> parameters wait for a reboot (instance shows pending-reboot). Groups are shared — editing one changes all attached instances." },
    { front: "What is RDS Proxy pinning and why does it matter?", back: "When a session becomes stateful (session variables, temp tables, some prepared statements), the proxy <strong>pins</strong> the client to a dedicated backend connection — multiplexing benefits vanish. Watch the pinned-connections metric; ORM init SQL is the usual cause." },
    { front: "IAM database authentication: token lifetime and scaling guidance?", back: "Auth token lives <strong>15 minutes</strong>; generated via the RDS API, verified by the engine. Keep new IAM-auth connections under roughly <strong>200/s</strong> — pool connections (RDS Proxy) for high-churn workloads. Works on MySQL, MariaDB, PostgreSQL." },
    { front: "Performance Insights: core metric and what it tells you?", back: "<strong>Average Active Sessions (AAS)</strong> — sessions running or waiting, sampled continuously — sliced by wait event, SQL, host, user. AAS above vCPU count = queuing. Free tier keeps <strong>7 days</strong>. It is managed ASH / pg_stat_activity-over-time." },
    { front: "Aurora storage: copies, AZs, quorums, max size?", back: "<strong>6 copies across 3 AZs</strong> (2 per AZ), in 10 GB segments. <strong>Write quorum 4/6, read/recovery quorum 3/6.</strong> Volume auto-grows to <strong>128 TiB</strong>. Only redo log records are shipped from compute to storage; pages materialize in the background." },
    { front: "Why is Aurora replica lag milliseconds instead of seconds?", back: "Replicas share the <strong>same distributed storage volume</strong> as the writer — no binlog shipping or apply. The writer only sends redo metadata for buffer-cache invalidation, so lag is typically <strong>10–20 ms</strong> and up to 15 replicas add no write amplification." },
    { front: "Aurora endpoints: name the four types and their use.", back: "<strong>Cluster (writer)</strong> — always the current primary, follows failover. <strong>Reader</strong> — connection-balances across replicas. <strong>Custom</strong> — user-defined instance subset (e.g. analytics-only replicas). <strong>Instance</strong> — one node, diagnostics only." },
    { front: "How does Aurora pick which replica to promote on failover?", back: "Lowest <strong>promotion priority tier (0–15)</strong> wins; ties break to the largest instance. With a replica present, failover typically completes <strong>under 30 s</strong>. With no replicas, Aurora must launch a new writer — minutes." },
    { front: "Aurora Serverless v2: unit of capacity and scaling behavior?", back: "<strong>ACU</strong> (~2 GiB RAM + proportional CPU/network); scales <strong>in place, continuously</strong>, in 0.5-ACU steps between your min/max, without dropping connections. Mixes with provisioned instances in one cluster. Wins on spiky/idle loads; loses on flat sustained load." },
    { front: "Aurora Global Database: RPO, RTO, and the two failover paths?", back: "Storage-level cross-region replication: <strong>RPO ~1 s</strong>, promotion <strong>RTO under a minute</strong>. Planned <strong>managed switchover</strong> = lossless role swap; unplanned = <strong>detach-and-promote</strong> a secondary (accepts ~1 s loss). Up to 5 secondary regions, 16 readers each." },
    { front: "Aurora write forwarding — what it is and is NOT?", back: "Secondary-region connections can issue writes that Aurora forwards to the primary-region writer — one connection string per region. It is <strong>not multi-master</strong> and no help when the primary region is down (there is still exactly one writer)." },
    { front: "Aurora backtrack vs PITR?", back: "<strong>Backtrack</strong> (Aurora MySQL only): rewinds the <em>existing</em> cluster in place, up to 72 h, in minutes, same endpoints, re-windable — must be enabled ahead of time. <strong>PITR</strong>: builds a <em>new</em> cluster, slower, works on all engines, any time in retention." },
    { front: "Aurora fast cloning — mechanism and billing?", back: "<strong>Copy-on-write</strong> against the shared storage volume: clone creation is near-instant regardless of size; you pay only for diverged pages. Ideal for prod-scale test/staging and migration rehearsal; sharable cross-account via RAM." },
    { front: "What is Babelfish for Aurora PostgreSQL?", back: "A <strong>TDS wire-protocol endpoint + T-SQL translation layer</strong> on Aurora PostgreSQL, letting SQL Server applications connect with existing drivers and minimal code change. Keyword: migrate SQL Server app to open source with minimal rewrite." },
    { front: "When is plain RDS the wrong tool entirely?", back: "Need OS/SSH access or unsupported extensions → <strong>RDS Custom</strong>/EC2. Massive key-value access → <strong>DynamoDB</strong>. Cross-region sub-second RPO relational → <strong>Aurora Global Database</strong>. Beyond vertical + 15-replica scale → sharding or a different data model." }
  ],
  lab: {
    title: "Lab: Multi-AZ failover, PITR, and the encrypt-by-snapshot-copy path",
    html: `
<h3>Goal</h3>
<p>Stand up a small RDS PostgreSQL instance, watch a forced Multi-AZ failover from the client side, exercise the snapshot → encrypted-copy → restore path, and tear everything down. You will see the DNS flip and the creation-time nature of encryption first-hand.</p>

<h3>Architecture</h3>
<p>One db.t4g.micro PostgreSQL instance (free-tier eligible in most accounts; Multi-AZ doubles the instance-hours, so this lab costs at most a few tens of cents if torn down promptly) in your default VPC, private connectivity assumed from an existing instance or Cloud9/CloudShell environment inside the VPC.</p>

<h3>Steps</h3>
<ol>
<li><p>Create the instance (Multi-AZ, unencrypted on purpose):</p>
<pre><code>aws rds create-db-instance \
  --db-instance-identifier lab-pg \
  --engine postgres \
  --db-instance-class db.t4g.micro \
  --allocated-storage 20 \
  --master-username labadmin \
  --manage-master-user-password \
  --multi-az \
  --backup-retention-period 1 \
  --no-publicly-accessible

aws rds wait db-instance-available --db-instance-identifier lab-pg</code></pre>
<p>Note <code>--manage-master-user-password</code>: the master credential lands in Secrets Manager, not in your shell history.</p></li>

<li><p>Observe the endpoint and its DNS record. Run this from a host inside the VPC:</p>
<pre><code>aws rds describe-db-instances --db-instance-identifier lab-pg \
  --query "DBInstances[0].[Endpoint.Address,AvailabilityZone,SecondaryAvailabilityZone]"

dig +short $(aws rds describe-db-instances --db-instance-identifier lab-pg \
  --query "DBInstances[0].Endpoint.Address" --output text)</code></pre>
<p>Record the IP and the two AZs.</p></li>

<li><p>Force a failover and watch DNS flip. In one terminal, poll the record every 5 seconds; in another, reboot with failover:</p>
<pre><code>aws rds reboot-db-instance --db-instance-identifier lab-pg --force-failover</code></pre>
<p>Within a couple of minutes the A record changes to an address in the other AZ, and <code>describe-db-instances</code> shows the AZs swapped. This is the entire failover mechanism clients depend on — which is why client-side DNS caching is the classic failover-lag culprit.</p></li>

<li><p>Exercise PITR bookkeeping. Check the restorable window:</p>
<pre><code>aws rds describe-db-instances --db-instance-identifier lab-pg \
  --query "DBInstances[0].LatestRestorableTime"</code></pre>
<p>Note it trails the current time by up to ~5 minutes — that is the transaction-log upload interval, i.e. your PITR RPO.</p></li>

<li><p>Snapshot, then copy the snapshot <strong>with encryption</strong> (the only path to encrypt an existing unencrypted instance):</p>
<pre><code>aws rds create-db-snapshot \
  --db-instance-identifier lab-pg \
  --db-snapshot-identifier lab-pg-snap
aws rds wait db-snapshot-available --db-snapshot-identifier lab-pg-snap

aws rds copy-db-snapshot \
  --source-db-snapshot-identifier lab-pg-snap \
  --target-db-snapshot-identifier lab-pg-snap-enc \
  --kms-key-id alias/aws/rds
aws rds wait db-snapshot-available --db-snapshot-identifier lab-pg-snap-enc</code></pre></li>

<li><p>Restore an encrypted instance from the encrypted copy (Single-AZ to keep cost down):</p>
<pre><code>aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier lab-pg-enc \
  --db-snapshot-identifier lab-pg-snap-enc \
  --db-instance-class db.t4g.micro \
  --no-multi-az
aws rds wait db-instance-available --db-instance-identifier lab-pg-enc</code></pre></li>
</ol>

<h3>Verify</h3>
<pre><code>aws rds describe-db-instances \
  --query "DBInstances[].[DBInstanceIdentifier,StorageEncrypted,MultiAZ,Endpoint.Address]" \
  --output table</code></pre>
<p>Expect: <code>lab-pg</code> StorageEncrypted=false / MultiAZ=true, <code>lab-pg-enc</code> StorageEncrypted=true — and note the restored instance has a <strong>different endpoint</strong>: every restore is a new instance.</p>

<h3>Teardown</h3>
<p>Ordered so nothing lingers and bills. Skipping final snapshots is deliberate — this is a lab.</p>
<ol>
<li><pre><code>aws rds delete-db-instance --db-instance-identifier lab-pg-enc \
  --skip-final-snapshot</code></pre></li>
<li><pre><code>aws rds delete-db-instance --db-instance-identifier lab-pg \
  --skip-final-snapshot --delete-automated-backups</code></pre></li>
<li><pre><code>aws rds delete-db-snapshot --db-snapshot-identifier lab-pg-snap
aws rds delete-db-snapshot --db-snapshot-identifier lab-pg-snap-enc</code></pre></li>
<li><p>Delete the Secrets Manager secret RDS created for the master password (find it by the tag or name prefix rds!):</p>
<pre><code>aws secretsmanager list-secrets \
  --query "SecretList[?starts_with(Name, 'rds!')].[Name,ARN]" --output table
aws secretsmanager delete-secret --secret-id &lt;arn-from-above&gt; \
  --force-delete-without-recovery</code></pre></li>
<li><p>Confirm nothing remains:</p>
<pre><code>aws rds describe-db-instances --query "DBInstances[].DBInstanceIdentifier"
aws rds describe-db-snapshots --snapshot-type manual \
  --query "DBSnapshots[].DBSnapshotIdentifier"</code></pre></li>
</ol>
`
  }
});
