/* Interactive diagrams: foundations, dynamodb, analytics, block-file modules. */

window.COURSE.registerDiagram({
  id: "global-infra",
  moduleId: "foundations",
  title: "Region, AZs, and the edge",
  sub: "The physical substrate everything else rests on. Click the pieces, then step through the three mental models: what an AZ is, blast radius, and control vs data plane.",
  w: 780, h: 440,
  nodes: [
    { id: "region", x: 20, y: 55, w: 470, h: 315, zone: true, label: "Region us-east-1" },
    { id: "aza", x: 40, y: 95, w: 140, h: 100, zone: true, label: "AZ us-east-1a" },
    { id: "azb", x: 310, y: 95, w: 140, h: 100, zone: true, label: "AZ us-east-1b" },
    { id: "azc", x: 175, y: 245, w: 140, h: 100, zone: true, label: "AZ us-east-1c" },
    { id: "dca", x: 60, y: 133, w: 100, h: 40, color: "green", label: "Datacenters", sub: "1+ per AZ",
      info: "An AZ is one or more discrete datacenters — AWS never tells you how many. Each has independent power, cooling, and physical security, and doesn't share a flood plain or utility feed with its siblings. Also: 'us-east-1a' is an account-specific alias — your 1a is not my 1a. Use AZ IDs (use1-az2) when coordinating capacity across accounts." },
    { id: "dcb", x: 330, y: 133, w: 100, h: 40, color: "green", label: "Datacenters", sub: "own power, cooling",
      info: "Same construction, miles away: far enough apart for independent failure modes (fire, flood, grid), close enough that synchronous replication is practical. That distance/latency balance is the entire reason Multi-AZ RDS and EBS-backed quorum systems can exist." },
    { id: "dcc", x: 195, y: 283, w: 100, h: 40, color: "green", label: "Datacenters", sub: "quorum's 3rd leg",
      info: "Three is the magic number for quorum systems — lose one AZ and ZooKeeper, etcd, Kafka, and DynamoDB all still hold a majority. Every region launched since 2019 guarantees at least three AZs; design for three even where more exist." },
    { id: "edge", x: 545, y: 70, w: 160, h: 46, color: "orange", label: "Edge location", sub: "CloudFront PoP",
      info: "600+ points of presence — an order of magnitude more numerous than regions, and NOT AZs: no EC2, no subnets. They terminate TLS near the user, serve CloudFront caches, onramp Global Accelerator traffic onto the AWS backbone, and host Route 53's answering data plane (the one with the 100% SLA)." },
    { id: "region2", x: 545, y: 160, w: 160, h: 46, color: "blue", label: "Second Region", sub: "eu-west-1",
      info: "A fully independent copy of the AWS stack: separate control planes, separate endpoints, separate failure domains. Nothing crosses regions synchronously by default — S3 CRR, DynamoDB global tables, and Aurora Global are all async, so any multi-region design has a nonzero RPO. That isolation is a feature: a region-wide event stops at this boundary." },
    { id: "cplane", x: 545, y: 260, w: 160, h: 46, color: "yellow", label: "Control plane", sub: "config + launch APIs",
      info: "The CRUD surface: RunInstances, CreateTable, ModifyDBInstance. Complex, stateful, regional — and statistically the layer most likely to be degraded during a large-scale event. AWS's own guidance: recovery paths should not depend on control plane calls succeeding." },
    { id: "dplane", x: 545, y: 350, w: 160, h: 46, color: "green", label: "Data plane", sub: "keeps serving",
      info: "What keeps already-provisioned things working: hypervisors keep instances up, ALBs keep forwarding, volumes keep accepting I/O, DNS keeps answering. Deliberately simpler and more distributed than the control plane, and engineered to a higher availability bar — which is exactly what static stability exploits." }
  ],
  edges: [
    { from: "dca", to: "dcb", label: "fiber, under 2 ms" },
    { from: "dcb", to: "dcc" },
    { from: "dca", to: "dcc", label: "meshed" },
    { from: "dcb", to: "region2", dashed: true, label: "async repl" },
    { from: "edge", to: "dcb", dashed: true, label: "origin fetch" }
  ],
  flows: [
    { title: "What an AZ actually is", steps: [
      { lit: ["aza", "dca"], text: "An AZ is not 'a datacenter' — it's <strong>one or more</strong> discrete datacenters presented as a single failure domain, each with independent power, cooling, and networking. You never learn the count; you design against the abstraction." },
      { lit: ["dca->dcb", "dca->dcc", "dcb->dcc"], text: "AZs are meshed with private, redundant, metro dark fiber: single-digit ms, typically <strong>under 2 ms</strong> round trip. That's low enough for synchronous replication — which is why Multi-AZ RDS commits to both AZs before acking, with tolerable latency cost." },
      { lit: ["region"], text: "A region is 3+ AZs sharing geography and a control plane but nothing physical. Cross-AZ traffic bills ~1 cent/GB each way — chatty microservices that ignore AZ affinity turn this into a real line item." },
      { lit: ["edge"], text: "Edge locations are a different animal entirely: no EC2, no subnets — just CloudFront, Route 53, and Global Accelerator getting your first byte close to users. Don't conflate 'edge' with 'AZ' on the exam." }
    ]},
    { title: "Blast radius: instance, AZ, region", steps: [
      { lit: ["dca"], text: "Smallest blast radius: a host or datacenter dies. An ASG replaces the instance; EBS survives (it's replicated within the AZ); nobody pages you. This layer is <strong>expected</strong> failure — design assumes it." },
      { lit: ["aza"], text: "An AZ fails: every single-AZ resource in it is gone at once — instances, their EBS volumes, a single-AZ RDS, any subnet-bound state. If your fleet was 2-AZ, you just lost 50% of capacity; this is why you spread across three and overprovision by one AZ's worth." },
      { lit: ["region"], text: "A region-wide event is rare but takes regional services with it — the S3 endpoint, DynamoDB, the whole control plane. No amount of multi-AZ helps here. The honest question: does your RTO actually justify multi-region cost and complexity, or is this scenario acceptable downtime?" },
      { lit: ["dcb->region2", "region2"], text: "The escape hatch is a second region fed by <strong>async</strong> replication — global tables, CRR, Aurora Global. Async means RPO is greater than zero: a regional DR failover loses the last seconds of writes. Say that out loud to the business before the incident, not during." }
    ]},
    { title: "Control plane vs data plane", steps: [
      { lit: ["cplane"], text: "The control plane creates, modifies, and deletes: RunInstances, CreateLoadBalancer, UpdateTable. It's the complex, stateful part of every service — and the part that historically degrades first in a large incident." },
      { lit: ["dplane"], text: "The data plane is what's already running: your instances keep executing, the ALB keeps routing, EBS keeps accepting writes, Route 53 keeps answering. It's simpler, zonally distributed, and built to a higher availability target — the two planes fail <strong>independently</strong>." },
      { lit: ["cplane", "dplane"], text: "This is why 'the launch API is down' does not mean 'the site is down' — running things keep serving. The design principle is <strong>static stability</strong>: pre-provision enough capacity in each AZ that surviving an AZ loss requires zero control plane calls. If your recovery runbook starts with 'launch new instances', it depends on the layer most likely to be broken." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "ddb-internals",
  moduleId: "dynamodb",
  title: "Inside a DynamoDB table",
  sub: "There is no server — but there are partitions, leaders, and quorums. Step through a write, a GSI's hidden second table, and the hot-key ceiling.",
  w: 760, h: 400,
  nodes: [
    { id: "aza", x: 260, y: 60, w: 180, h: 92, zone: true, label: "AZ a" },
    { id: "azb", x: 260, y: 172, w: 180, h: 92, zone: true, label: "AZ b" },
    { id: "azc", x: 260, y: 284, w: 180, h: 92, zone: true, label: "AZ c" },
    { id: "client", x: 25, y: 40, w: 120, h: 44, color: "blue", label: "Client", sub: "SDK, SigV4",
      info: "The SDK signs with SigV4 and sends HTTPS to the regional endpoint — no connections to pool, no cluster to discover. Jittered exponential backoff is built into every SDK; tune maxAttempts before writing your own retry loop." },
    { id: "router", x: 25, y: 170, w: 150, h: 48, color: "orange", label: "Request router", sub: "hashes the key",
      info: "A stateless fleet behind the endpoint. It hashes your partition key, consults the partition metadata map, and forwards to the owning storage node. That O(1) lookup — no query planner, no joins — is why latency stays flat whether the table holds 1 GB or 100 TB." },
    { id: "p1", x: 280, y: 92, w: 140, h: 44, color: "green", label: "Partition 1", sub: "leader + 2 replicas",
      info: "A partition owns a contiguous range of key hashes, capped near 10 GB of data and 3000 RCU / 1000 WCU of throughput. It's a Paxos replication group: one leader takes every write (and every strongly consistent read), two replicas in the other AZs follow." },
    { id: "p2", x: 280, y: 204, w: 140, h: 44, color: "green", label: "Partition 2", sub: "leader + 2 replicas",
      info: "Partitions split automatically on size or sustained throughput — you never manage them, but you feel them: provisioned capacity is divided across partitions, which is why a skewed key schema throttles at a fraction of what you're paying for." },
    { id: "p3", x: 280, y: 316, w: 140, h: 44, color: "green", label: "Partition 3", sub: "leader + 2 replicas",
      info: "Eventually consistent reads can be served by any of the three replicas — half the RCU cost, usually caught up within milliseconds. Strongly consistent reads must hit the leader. GSIs never offer strong consistency at all, on any partition." },
    { id: "gsi", x: 530, y: 80, w: 170, h: 48, color: "yellow", label: "GSI partitions", sub: "own partitions + WCU",
      info: "A GSI is physically a second table: its own partitions, hashed on the index's key, with its own capacity settings and its own hot-key problems. Base-table writes arrive here asynchronously — typically sub-second, but unbounded under stress." },
    { id: "streams", x: 530, y: 180, w: 170, h: 48, color: "orange", label: "DynamoDB Streams", sub: "24h ordered log",
      info: "An ordered, 24-hour log of item-level changes, sharded like the table, consumed by Lambda or KCL. This is the CDC backbone: fan out events, replicate to OpenSearch, drive global tables. Delivery to consumers is at-least-once — design them idempotent." },
    { id: "adaptive", x: 530, y: 280, w: 170, h: 48, color: "red", label: "Adaptive capacity", sub: "moves heat, not caps",
      info: "Adaptive capacity shifts the table's throughput toward hot partitions within minutes, and can isolate a single hot item onto its own partition. What it can never do is raise the hard per-partition ceiling — 3000 RCU / 1000 WCU stands no matter what you provision." }
  ],
  edges: [
    { from: "client", to: "router", label: "PutItem" },
    { from: "router", to: "p1", label: "hash(pk)" },
    { from: "router", to: "p2", dashed: true },
    { from: "router", to: "p3", dashed: true },
    { from: "p1", to: "gsi", dashed: true, label: "async" },
    { from: "p2", to: "streams", dashed: true },
    { from: "adaptive", to: "p2", dashed: true }
  ],
  flows: [
    { title: "A PutItem in single-digit ms", steps: [
      { lit: ["client", "client->router"], text: "The SDK signs the request and sends it to the regional endpoint. No session, no prepared statement, no connection state — every request is self-contained, which is what lets the fleet in front scale horizontally without you noticing." },
      { lit: ["router"], text: "The router hashes the partition key and looks up which partition owns that hash range. This is the <strong>entire</strong> query plan — no optimizer, no statistics. It's also why every access pattern must be expressible as 'give me this key': the router can't do anything else fast." },
      { lit: ["router->p1", "p1"], text: "The write lands on the partition's <strong>leader</strong> replica, which appends to its write-ahead log and updates its B-tree." },
      { lit: ["p1", "azb", "azc"], text: "The leader replicates to its two follower replicas in the other AZs and acks the client once <strong>2 of 3</strong> are durable. Three-AZ durability, no cross-partition coordination, one key lookup: that's the whole recipe for single-digit-millisecond writes at any table size." }
    ]},
    { title: "The GSI write you didn't see", steps: [
      { lit: ["p1"], text: "Your PutItem acked when the base partition's quorum committed. The GSI has <strong>not</strong> been updated yet — a read from the index immediately after can miss the item. That's the eventual consistency you signed up for." },
      { lit: ["p1->gsi", "gsi"], text: "The base partition propagates the change asynchronously to the GSI's OWN partitions — hashed on the index's partition key, throttled by the index's OWN capacity. An index on a low-cardinality attribute (status, date) concentrates those writes onto few partitions." },
      { lit: ["gsi"], text: "Here's the trap: if GSI partitions throttle, the replication buffer fills, and DynamoDB starts rejecting <strong>base table writes</strong>. An under-provisioned or badly-keyed GSI backpressures the table it indexes — size every GSI for the full write rate it will receive." }
    ]},
    { title: "A hot key meets the ceiling", steps: [
      { lit: ["p2"], text: "One tenant, one celebrity, one 'today' date — a single partition key starts taking a disproportionate share of traffic while the rest of the table idles." },
      { lit: ["adaptive", "adaptive->p2"], text: "Adaptive capacity reacts in minutes: it shifts unused throughput from cold partitions to the hot one and can even split the hot item out to a dedicated partition. Useful — but the per-partition ceiling of <strong>3000 RCU / 1000 WCU</strong> is physics here; no amount of provisioned capacity lifts it." },
      { lit: ["router"], text: "The real fix is upstream, in key design: <strong>write sharding</strong>. Suffix the hot key (orderdate#7) to spread writes across N partitions, and scatter-gather on read. Adaptive capacity buys you time; the key schema is the cure." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "data-lake",
  moduleId: "analytics",
  title: "The S3 data lake pattern",
  sub: "Storage and compute, decoupled: S3 holds the bytes, Glue holds the schema, Athena brings the SQL. Step through ingest, transform, and the governed query.",
  w: 800, h: 460,
  nodes: [
    { id: "appdb", x: 20, y: 50, w: 130, h: 44, color: "blue", label: "App database", sub: "RDS, via DMS",
      info: "The operational store — schema'd for transactions, not scans. Analytics queries here compete with production traffic, which is the whole reason the lake exists. DMS CDC streams row changes out continuously instead of hammering it with a nightly full dump." },
    { id: "kds", x: 20, y: 130, w: 130, h: 44, color: "blue", label: "Kinesis Streams", sub: "clicks, events, CDC",
      info: "Clickstream, IoT, and app events land here first: ordered shards, multiple independent consumers, replayable for up to 365 days. DMS can target it too, unifying database changes and behavioral events into one pipe." },
    { id: "firehose", x: 195, y: 88, w: 130, h: 48, color: "orange", label: "Firehose", sub: "buffers 1-15 min",
      info: "Zero-admin delivery: buffers by size or time, optionally converts to Parquet and compresses in flight, then batches into S3. The buffering is the point — a lake made of millions of tiny objects makes every downstream query slow and expensive (per-object overhead dominates)." },
    { id: "s3raw", x: 370, y: 88, w: 130, h: 48, color: "green", label: "S3 raw zone", sub: "as-landed, immutable",
      info: "Immutable, as-landed truth. Never transform in place: when the ETL logic turns out to have a bug (it will), you fix the job and re-run against raw. Lifecycle old raw data to Glacier tiers rather than deleting it." },
    { id: "crawler", x: 370, y: 180, w: 130, h: 44, color: "yellow", label: "Glue crawler", sub: "infers schema",
      info: "Samples objects, infers schema and partition layout, and writes table definitions into the catalog. Run it on a schedule or trigger it on delivery; on schema drift it versions the table definition instead of breaking it." },
    { id: "catalog", x: 560, y: 180, w: 160, h: 48, color: "orange", label: "Glue Data Catalog", sub: "tables, partitions",
      info: "The Hive-compatible metastore for the entire lake: databases, tables, columns, and the S3 location of every partition. Athena, Redshift Spectrum, EMR, and Glue ETL all resolve schema here — the catalog holds only metadata; the bytes never leave S3." },
    { id: "etl", x: 195, y: 290, w: 130, h: 48, color: "yellow", label: "Glue ETL job", sub: "Spark, serverless",
      info: "Serverless Spark: reads raw, dedupes, flattens nested JSON, and writes curated output. Job bookmarks track what's already been processed, so scheduled runs are incremental instead of full rescans of the raw zone." },
    { id: "s3cur", x: 370, y: 290, w: 130, h: 48, color: "green", label: "S3 curated zone", sub: "Parquet, partitioned",
      info: "Partitioned (dt=2026-07-22/) Snappy-compressed Parquet, sized roughly 128 MB to 1 GB per object. This physical layout — not query tuning — is where Athena performance and cost are actually won or lost." },
    { id: "athena", x: 560, y: 290, w: 130, h: 48, color: "orange", label: "Athena", sub: "$5 per TB scanned",
      info: "Managed Trino: no cluster to run, priced at $5 per TB scanned. Cost control is therefore entirely about scanning less — partitions pruned by the WHERE clause, columns skipped thanks to Parquet. CTAS lets it write transformed results straight back into the lake." },
    { id: "quicksight", x: 560, y: 380, w: 130, h: 44, color: "blue", label: "QuickSight", sub: "SPICE in-memory",
      info: "Serverless BI. SPICE ingests query results into memory so dashboards don't re-scan S3 — and re-bill you — for every viewer. Row-level security maps each user to the data slice they're allowed to see." },
    { id: "lf", x: 20, y: 380, w: 150, h: 48, color: "red", label: "Lake Formation", sub: "table + row grants",
      info: "Centralized grants over catalog resources: database, table, column, even row-level via data filters. It replaces a sprawl of per-bucket IAM policies — analysts get SELECT on exactly what they're entitled to, enforced by Athena, Redshift, and EMR at query time." }
  ],
  edges: [
    { from: "appdb", to: "kds", label: "DMS CDC" },
    { from: "kds", to: "firehose" },
    { from: "firehose", to: "s3raw", label: "batched PUTs" },
    { from: "s3raw", to: "crawler" },
    { from: "crawler", to: "catalog", label: "table defs" },
    { from: "s3raw", to: "etl", label: "read raw" },
    { from: "etl", to: "s3cur", label: "Parquet out" },
    { from: "catalog", to: "athena", label: "schema" },
    { from: "s3cur", to: "athena", label: "scan" },
    { from: "athena", to: "quicksight" },
    { from: "lf", to: "athena", dashed: true, label: "permissions" }
  ],
  flows: [
    { title: "Ingest: land it raw", steps: [
      { lit: ["appdb", "appdb->kds", "kds"], text: "Operational data leaves the database as a CDC stream (DMS), joining clickstream and app events in Kinesis. Nothing queries the production DB for analytics — that's the sin the lake exists to end." },
      { lit: ["kds->firehose", "firehose"], text: "Firehose buffers by size or time (1-15 minutes), compresses, and batches. Accept the latency: it's what turns a firehose of tiny records into the large objects S3 analytics needs. Sub-minute freshness requirements mean this is the wrong pattern — reach for Kinesis consumers instead." },
      { lit: ["firehose->s3raw", "s3raw"], text: "Everything lands in the raw zone exactly as it arrived. Raw is your <strong>immutable source of truth</strong> — every downstream dataset can be rebuilt from it, so downstream bugs are never fatal." },
      { lit: ["s3raw->crawler", "crawler", "crawler->catalog", "catalog"], text: "The crawler samples new objects, infers schema and partition structure, and registers tables in the Glue Data Catalog. The data hasn't moved — the catalog stores <strong>only metadata</strong>, and suddenly the raw zone is queryable by name." }
    ]},
    { title: "Transform: the 10-100x lever", steps: [
      { lit: ["s3raw->etl", "etl"], text: "A Glue Spark job reads raw JSON, dedupes, flattens, and applies business logic. Job bookmarks make each scheduled run incremental — only unprocessed objects are read." },
      { lit: ["etl->s3cur", "s3cur"], text: "Output is <strong>partitioned, compressed Parquet</strong>: Hive-style prefixes (dt=2026-07-22/) with objects sized in the 128 MB-1 GB sweet spot. Columnar layout plus partition structure is the entire optimization." },
      { lit: ["s3cur"], text: "Why 10-100x: Athena bills per byte scanned. Partitioning lets it skip whole prefixes (a one-day query over three years of data reads 0.1% of it); Parquet lets it read only the referenced columns (3 of 300). Multiply the two and a $50 scan becomes $0.50 — same data, same query." }
    ]},
    { title: "Query: governed SQL on objects", steps: [
      { lit: ["athena", "catalog", "catalog->athena"], text: "An analyst runs SQL. Athena — managed Trino, no cluster — resolves the table in the catalog and gets back the schema plus the partition list with S3 locations. Planning happens on metadata alone." },
      { lit: ["s3cur->athena", "s3cur"], text: "The WHERE clause prunes partitions before a single object is opened; Parquet footers let it read only the needed columns from the objects that remain. Bytes scanned — and the bill — collapse accordingly." },
      { lit: ["lf", "lf->athena"], text: "Lake Formation sits in the authorization path: this analyst's grants say which tables, columns, and (via data filters) rows come back. One permission model across Athena, Redshift, and EMR — instead of per-bucket IAM archaeology." },
      { lit: ["athena->quicksight", "quicksight"], text: "QuickSight caches results in SPICE, so a dashboard viewed by 500 people scans S3 once, not 500 times. The pattern end to end: storage, metadata, compute, and governance — each a separate, independently scalable layer." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "storage-decision",
  moduleId: "block-file",
  title: "Which storage? The decision map",
  sub: "Every storage scenario resolves in three questions or fewer. Click any node for the sharp edges; step through one branch at a time.",
  w: 800, h: 460,
  nodes: [
    { id: "start", x: 320, y: 20, w: 160, h: 44, color: "orange", label: "What are the bytes", sub: "block / file / object",
      info: "Storage choice is the first fork in nearly every SAA scenario. Classify the access pattern first — raw block device, shared filesystem, or object API — and two-thirds of the candidate services eliminate themselves before you compare a single feature." },
    { id: "bblock", x: 60, y: 110, w: 150, h: 44, color: "blue", label: "Block device?", sub: "one instance mounts",
      info: "A raw device attached to ONE instance; the OS supplies the filesystem. This is boot volumes, database files, anything wanting low-latency random I/O. If two instances must see the same data, block is almost never the answer — io2 Multi-Attach with a cluster-aware filesystem is the narrow exception." },
    { id: "bfile", x: 330, y: 110, w: 150, h: 44, color: "blue", label: "Shared filesystem?", sub: "many clients, POSIX",
      info: "Multiple clients mounting one namespace, with locking, permissions, and hierarchy semantics. The protocol your clients already speak — NFS, SMB, or Lustre — picks the service for you; don't fight it." },
    { id: "bobject", x: 600, y: 110, w: 150, h: 44, color: "blue", label: "Object via API?", sub: "GET/PUT over HTTP",
      info: "Whole objects written and read over HTTP — no mounts, no in-place edits, no appends. The dominant pattern for app assets, backups, logs, and lakes, because it decouples storage from any particular compute." },
    { id: "qpersist", x: 60, y: 200, w: 150, h: 44, color: "yellow", label: "Survives stop?", sub: "or scratch is fine",
      info: "The only block question that matters: must the data outlive the instance? Stop, terminate, host failure — if the bytes must survive any of those, you need network-attached persistence and you pay a latency premium for it. If not, the local disk is free and dramatically faster." },
    { id: "qos", x: 330, y: 200, w: 150, h: 44, color: "yellow", label: "Which protocol?", sub: "NFS, SMB, or Lustre",
      info: "Linux fleet speaking NFS, Windows fleet needing SMB and AD ACLs, or an HPC cluster demanding hundreds of GB/s? Each maps to exactly one managed service — the exam's signal words are the protocol names themselves." },
    { id: "qarchive", x: 600, y: 200, w: 150, h: 44, color: "yellow", label: "Hot or archive?", sub: "ms vs hours latency",
      info: "Access frequency and retrieval tolerance drive the tier. Milliseconds on demand is standard S3; write-once-read-maybe-never compliance data belongs in an archive tier at a tenth of the cost — with retrieval measured in minutes to hours." },
    { id: "ebs", x: 20, y: 290, w: 115, h: 44, color: "green", label: "EBS", sub: "gp3 / io2, snapshots",
      info: "Network-attached, single-AZ, persists independently of the instance. gp3 is the default (3000 IOPS baseline, provision more without resizing); io2 Block Express when a database needs 64k+ IOPS with sub-ms consistency. Snapshots to S3 are incremental and portable across AZs and regions." },
    { id: "istore", x: 155, y: 290, w: 130, h: 44, color: "red", label: "Instance store", sub: "NVMe, ephemeral",
      info: "NVMe physically inside the host: millions of IOPS, microsecond latency, no added cost. Stop or terminate and the data is <em>gone</em> — so it's strictly for data you can lose: caches, scratch, or replicated stores like Cassandra where the cluster itself is the durability layer." },
    { id: "efs", x: 305, y: 290, w: 105, h: 44, color: "green", label: "EFS", sub: "NFS, elastic, POSIX",
      info: "Managed NFS: elastic to petabytes, regional (mountable from every AZ, on-prem, and Lambda), pay only for bytes stored. Lifecycle to Infrequent Access cuts cost ~92% for cold files. Throughput scales with stored size — small-but-hot filesystems may need elastic or provisioned throughput mode." },
    { id: "fsxw", x: 430, y: 290, w: 125, h: 44, color: "green", label: "FSx for Windows", sub: "SMB, AD-joined",
      info: "A real Windows file server: SMB, NTFS ACLs, Active Directory integration, DFS namespaces. The answer whenever the scenario says 'Windows shares' or 'AD permissions' — EFS speaks only NFS and cannot do NTFS semantics." },
    { id: "fsxl", x: 430, y: 370, w: 125, h: 44, color: "green", label: "FSx for Lustre", sub: "HPC scratch, S3 sync",
      info: "A parallel filesystem for HPC and ML training: hundreds of GB/s aggregate, sub-ms, POSIX. The killer feature is the S3 link — it presents a bucket as a filesystem, lazy-loads objects on first read, and writes results back. Scratch deployment is cheap and disposable by design." },
    { id: "s3", x: 575, y: 290, w: 100, h: 44, color: "green", label: "S3", sub: "11 nines, lifecycle",
      info: "Object storage: 11 nines of durability across 3+ AZs, effectively infinite capacity, per-request pricing. No filesystem semantics — you PUT a whole new version, you don't edit. Intelligent-Tiering handles unknown access patterns automatically for a tiny monitoring fee." },
    { id: "glacier", x: 695, y: 290, w: 100, h: 44, color: "green", label: "S3 Glacier", sub: "+ Object Lock",
      info: "The archive tiers: Instant Retrieval (ms), Flexible (minutes to hours), Deep Archive (~$1/TB-month, 12-hour restores). For compliance, add Object Lock in compliance mode — WORM retention that no identity, including the root user, can shorten or remove." }
  ],
  edges: [
    { from: "start", to: "bblock", label: "block" },
    { from: "start", to: "bfile", label: "file" },
    { from: "start", to: "bobject", label: "object" },
    { from: "bblock", to: "qpersist" },
    { from: "qpersist", to: "ebs", label: "must persist" },
    { from: "qpersist", to: "istore", label: "scratch ok" },
    { from: "bfile", to: "qos" },
    { from: "qos", to: "efs", label: "Linux NFS" },
    { from: "qos", to: "fsxw", label: "Windows SMB" },
    { from: "qos", to: "fsxl", label: "HPC" },
    { from: "bobject", to: "qarchive" },
    { from: "qarchive", to: "s3", label: "hot" },
    { from: "qarchive", to: "glacier", label: "archive" }
  ],
  flows: [
    { title: "Block: the database volume", steps: [
      { lit: ["start", "start->bblock", "bblock"], text: "A self-managed PostgreSQL instance needs a data volume: raw block device, one instance, low-latency random I/O. That's the block branch — file and object are out before we compare anything." },
      { lit: ["bblock->qpersist", "qpersist"], text: "Must the data survive the instance? For a database, obviously yes — an instance stop, a host failure, or a resize must not destroy the data files." },
      { lit: ["qpersist->ebs", "ebs"], text: "So: <strong>EBS</strong>. gp3 covers most databases (provision IOPS and throughput independently of size); step up to io2 Block Express when you need 64k+ IOPS with consistent sub-ms latency. Snapshots give you incremental, cross-region-copyable backups." },
      { lit: ["qpersist->istore", "istore"], text: "The contrast case: instance store is faster and free, and it's the <strong>wrong</strong> answer here — a stopped instance returns with the disk empty. It wins only when the app supplies its own durability (Cassandra replication) or the data is disposable scratch." }
    ]},
    { title: "File: three protocols, three answers", steps: [
      { lit: ["start->bfile", "bfile"], text: "A fleet of instances must share one directory tree with POSIX or SMB semantics — content management, home directories, shared build workspace. Block can't do this (one writer per volume); this is the file branch." },
      { lit: ["qos", "qos->efs", "efs"], text: "Linux clients speaking NFS: <strong>EFS</strong>. Elastic capacity, mountable from every AZ simultaneously (and from Lambda), pay-per-GB with IA lifecycle for cold files. The default answer for 'shared storage for EC2 Linux'." },
      { lit: ["qos->fsxw", "fsxw"], text: "The moment the scenario says Windows, SMB shares, or NTFS ACLs with Active Directory: <strong>FSx for Windows File Server</strong>. EFS cannot serve this — it's NFS-only, and no amount of configuration changes that." },
      { lit: ["qos->fsxl", "fsxl"], text: "HPC or ML training needing hundreds of GB/s across thousands of cores: <strong>FSx for Lustre</strong>, linked to an S3 bucket — objects lazy-load into the filesystem on first read, results sync back, and the scratch filesystem is deleted when the job ends. S3 economics, Lustre speed." }
    ]},
    { title: "Object: assets now, compliance forever", steps: [
      { lit: ["start->bobject", "bobject"], text: "User uploads, static assets, logs, backups: written once over HTTP, read whole, never edited in place. Object storage — and nothing on the other branches competes on durability or cost." },
      { lit: ["qarchive", "qarchive->s3", "s3"], text: "Hot, unpredictable access: <strong>S3 with Intelligent-Tiering</strong>, which moves each object between access tiers automatically. Eleven nines of durability across 3+ AZs, and lifecycle rules handle aging without code." },
      { lit: ["qarchive->glacier", "glacier"], text: "Seven-year regulatory retention: lifecycle into <strong>Glacier Deep Archive</strong> at roughly $1/TB-month, and apply <strong>Object Lock in compliance mode</strong> — WORM retention that nobody, root included, can shorten. Retrieval takes hours; for an archive that's read only by auditors, that's the correct trade." }
    ]}
  ]
});
