/* Interactive diagrams: data & serverless modules (rds-aurora, serverless, messaging). */

window.COURSE.registerDiagram({
  id: "aurora-storage",
  moduleId: "rds-aurora",
  title: "Aurora: compute/storage separation",
  sub: "Compute is disposable; the 6-way replicated storage volume is the database. Step through a write, a failover, and an AZ+1 failure.",
  w: 780, h: 440,
  nodes: [
    { id: "cluster-ep", x: 70, y: 12, w: 150, h: 38, color: "orange", label: "Cluster endpoint", sub: "always the writer",
      info: "A DNS CNAME that always resolves to the current writer. Point all write traffic here and never at an instance endpoint — after a failover the CNAME flips and clients reconnect to the new writer without config changes. Respect the 5s TTL: JVMs that cache DNS forever ride a failover straight into a dead node." },
    { id: "reader-ep", x: 440, y: 12, w: 150, h: 38, color: "green", label: "Reader endpoint", sub: "round-robin readers",
      info: "Load-balances connections (not queries) across all replicas via DNS round-robin. Because each new connection lands on one replica, connection pools can skew — custom endpoints let you carve replica subsets for analytics vs OLTP reads. Exam angle: reader endpoint = read scaling, cluster endpoint = HA." },
    { id: "writer", x: 70, y: 90, w: 150, h: 46, color: "orange", label: "Writer instance", sub: "one per cluster",
      info: "The only node that mutates data (in standard Aurora; multi-master is niche). It ships redo log records to storage and never writes full pages, checkpoints, or doublewrite buffers over the network — that is why Aurora claims ~5x MySQL throughput. Compute is stateless: kill it and the data is untouched." },
    { id: "reader1", x: 380, y: 90, w: 130, h: 46, color: "green", label: "Reader replica 1", sub: "tier-0, promotable",
      info: "Attaches to the SAME storage volume as the writer — it is not replaying a binlog like an RDS MySQL replica. Replica lag is typically 10-20ms because only cache-invalidation records ship to it. Failover priority tier 0-15: lowest tier promotes first, ties broken by largest instance size." },
    { id: "reader2", x: 540, y: 90, w: 130, h: 46, color: "green", label: "Reader replica 2", sub: "tier-1",
      info: "Up to 15 replicas per cluster, all sharing storage, so adding one costs compute only — no storage duplication and no seeding time proportional to data size. Size replicas like the writer: an undersized replica that gets promoted becomes an undersized writer at 3am." },
    { id: "storage", x: 20, y: 180, w: 620, h: 245, zone: true, label: "Aurora storage layer — 6 copies across 3 AZs" },
    { id: "az-a", x: 40, y: 215, w: 180, h: 190, zone: true, label: "AZ a" },
    { id: "az-b", x: 238, y: 215, w: 180, h: 190, zone: true, label: "AZ b" },
    { id: "az-c", x: 436, y: 215, w: 180, h: 190, zone: true, label: "AZ c" },
    { id: "sn-a1", x: 60, y: 250, w: 140, h: 38, color: "blue", label: "Storage node", sub: "10GB segments",
      info: "Holds one of six copies of each protection group (10GB segment). Storage nodes materialize data pages FROM redo log records on their own CPU — offloading page construction from the database instance entirely." },
    { id: "sn-a2", x: 60, y: 310, w: 140, h: 38, color: "blue", label: "Storage node", sub: "copy 2 of 6",
      info: "Second copy in the same AZ. Two copies per AZ times three AZs is what makes the quorum math work: lose a full AZ and you have only lost two of six votes, not three." },
    { id: "sn-b1", x: 258, y: 250, w: 140, h: 38, color: "blue", label: "Storage node", sub: "write quorum 4/6",
      info: "Writes commit when any 4 of 6 copies acknowledge the redo records — the writer never waits for the slowest node. This tolerates an entire AZ outage for writes with zero data loss." },
    { id: "sn-b2", x: 258, y: 310, w: 140, h: 38, color: "blue", label: "Storage node", sub: "read quorum 3/6",
      info: "Reads need only 3 of 6 copies in the recovery path (normal reads go to a known-current node, no quorum round-trip). The asymmetric 4/6 write, 3/6 read quorums guarantee any read quorum intersects any write quorum." },
    { id: "sn-c1", x: 456, y: 250, w: 140, h: 38, color: "blue", label: "Storage node", sub: "gossip repair",
      info: "Nodes gossip and peer-to-peer replicate to heal missing segments. Because a protection group is only 10GB, re-replicating one takes tens of seconds on 10Gbps links — the window of reduced durability is tiny." },
    { id: "sn-c2", x: 456, y: 310, w: 140, h: 38, color: "blue", label: "Storage node", sub: "grows to 128TiB",
      info: "The volume grows (and shrinks) automatically in 10GB increments to 128TiB; you pay for what is used. No pre-provisioning IOPS decisions like io1 RDS — I/O is billed per request in standard config, flat in I/O-Optimized." },
    { id: "s3", x: 660, y: 280, w: 110, h: 44, color: "yellow", label: "S3 backups", sub: "continuous, PITR",
      info: "The storage layer streams continuous, incremental backups to S3 with zero performance impact on the instances — there is no backup window. Point-in-time restore to any second in the retention period spins up a NEW cluster; restore is never in-place." }
  ],
  edges: [
    { from: "cluster-ep", to: "writer", label: "writes" },
    { from: "reader-ep", to: "reader1" },
    { from: "reader-ep", to: "reader2" },
    { from: "writer", to: "sn-a1", label: "redo log" },
    { from: "writer", to: "sn-b1", label: "redo log" },
    { from: "writer", to: "sn-c1", label: "redo log" },
    { from: "reader1", to: "sn-b1", dashed: true, label: "shared volume" },
    { from: "reader2", to: "sn-c1", dashed: true },
    { from: "sn-c2", to: "s3", dashed: true, label: "backup" }
  ],
  flows: [
    { title: "A write: redo log and the 4/6 quorum", steps: [
      { lit: ["cluster-ep", "cluster-ep->writer", "writer"], text: "The app commits a transaction against the <strong>cluster endpoint</strong>, which always resolves to the current writer. The writer generates redo log records — it does NOT write data pages, checkpoints, or doublewrite buffers." },
      { lit: ["writer->sn-a1", "writer->sn-b1", "writer->sn-c1"], text: "Only those redo records (a few hundred bytes each) ship to storage, fanned out to all six copies across three AZs. Network I/O per transaction drops to a fraction of what MySQL on EBS pushes." },
      { lit: ["sn-a1", "sn-a2", "sn-b1", "sn-b2", "sn-c1", "sn-c2"], text: "The commit acknowledges when <strong>4 of 6</strong> storage nodes confirm — the two slowest nodes (or a whole dead AZ) never gate latency. Storage nodes then materialize pages from the log on their own CPU, asynchronously." },
      { lit: ["reader1", "reader2", "reader-ep"], text: "Readers see the write in ~10-20ms. They share the same storage volume, so nothing is 'replicated' to them except cache-invalidation messages — this is why Aurora replica lag is milliseconds while RDS MySQL binlog replicas drift to seconds or minutes." }
    ]},
    { title: "Writer failure: promotion and the DNS flip", steps: [
      { lit: ["writer"], text: "The writer instance dies — hardware fault or AZ impairment. Compute is gone but the data is not: every committed transaction already lives on 4+ storage nodes." },
      { lit: ["reader1"], text: "Aurora promotes an existing replica by <strong>failover priority tier</strong> (0 is highest; ties go to the largest instance). Reader replica 1 at tier-0 wins. Promotion is fast because there is no data to copy or replay — it just opens the shared volume for writes." },
      { lit: ["cluster-ep", "cluster-ep->writer"], text: "The cluster endpoint CNAME flips to the promoted node — typically ~30 seconds end to end. Client-side, use short DNS caching or a topology-aware driver (AWS JDBC wrapper, RDS Proxy) to shrink perceived downtime further." },
      { lit: ["sn-a1", "sn-b1", "sn-c1"], text: "RPO is zero: because storage is shared, no committed data existed only on the dead writer. Contrast with promoting a lagging MySQL read replica, where whatever had not replicated is simply lost — a favorite exam discriminator." }
    ]},
    { title: "AZ+1 failure: reads survive, storage self-heals", steps: [
      { lit: ["az-a", "sn-a1", "sn-a2", "sn-b1"], text: "Worst-case design point: an entire AZ is lost <strong>plus</strong> one node elsewhere — three of six copies gone at once. This is the failure mode the 6-copy layout was explicitly engineered for." },
      { lit: ["sn-b2", "sn-c1", "sn-c2"], text: "Three copies remain, which still satisfies the <strong>3/6 read quorum</strong> — data stays readable and no committed write is lost. Write quorum (4/6) is temporarily unreachable, so writes stall rather than risk divergence." },
      { lit: ["storage"], text: "Repair is automatic: surviving nodes gossip, detect missing segments, and re-replicate 10GB protection groups peer-to-peer in tens of seconds. Write quorum is restored without an operator touching anything." },
      { lit: ["sn-c2->s3", "s3"], text: "Beneath all of it, continuous backup to S3 provides point-in-time restore as the independent last line of defense — for the failure quorums cannot save you from: a bad deploy that DELETEs the wrong rows with a perfectly healthy quorum." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "serverless-request",
  moduleId: "serverless",
  title: "Life of a serverless request",
  sub: "Client to DynamoDB through API Gateway and Lambda. Step through the warm path, the anatomy of a cold start, and what happens when limits bite.",
  w: 780, h: 400,
  nodes: [
    { id: "client", x: 20, y: 110, w: 110, h: 46, color: "blue", label: "Client", sub: "retries with jitter",
      info: "The caller owns retry behavior on synchronous paths. A well-behaved client retries 429/5xx with exponential backoff plus jitter; a naive retry loop turns a brief throttle into a self-inflicted retry storm that keeps the burst bucket empty." },
    { id: "apigw", x: 165, y: 60, w: 160, h: 200, zone: true, label: "API Gateway" },
    { id: "authorizer", x: 180, y: 100, w: 130, h: 44, color: "orange", label: "Authorizer", sub: "IAM / JWT / Lambda",
      info: "Runs before your backend: IAM (SigV4), Cognito/JWT verification, or a custom Lambda authorizer. Lambda authorizer results are cacheable up to 1 hour keyed on the token — skipping that cache adds a full Lambda invoke of latency and cost to every request. HTTP APIs do JWT natively and cost ~70% less than REST APIs." },
    { id: "throttle", x: 180, y: 180, w: 130, h: 44, color: "yellow", label: "Throttling", sub: "10k rps, burst 5k",
      info: "Token-bucket per account per region (default 10,000 rps, 5,000 burst), tightenable per stage/route or per API key via usage plans. Requests rejected here return 429 without ever invoking the backend — your cheapest failure. This is your front-line protection for everything downstream." },
    { id: "svc", x: 360, y: 40, w: 250, h: 250, zone: true, label: "Lambda service" },
    { id: "ctrl", x: 380, y: 85, w: 150, h: 44, color: "orange", label: "Control plane", sub: "placement + queue",
      info: "Routes each invoke to a warm execution environment or asks placement to create one. Sync invokes fail fast when concurrency is exhausted; async invokes land in an internal queue that Lambda drains with retries. Regional concurrency default is 1,000, shared by ALL functions — one runaway function can starve the rest unless you set reserved concurrency." },
    { id: "exec", x: 380, y: 175, w: 160, h: 48, color: "green", label: "Execution env", sub: "Firecracker microVM",
      info: "A Firecracker microVM running one request at a time (per env), reused across invokes for minutes to hours. Everything outside the handler — SDK clients, connections, config — survives between invokes: initialize once, reuse forever. CPU scales linearly with the memory setting (1,769MB = 1 vCPU), so more memory is often FASTER and cheaper per request." },
    { id: "ddb", x: 650, y: 100, w: 115, h: 46, color: "blue", label: "DynamoDB", sub: "single-digit ms",
      info: "Single-digit-millisecond key-value reads at any scale, no connection pool to manage — HTTP API, so it pairs with Lambda without the RDS-style connection exhaustion problem (that is what RDS Proxy exists to fix). On-demand billing matches Lambda's zero-idle-cost model." },
    { id: "cw", x: 650, y: 210, w: 115, h: 46, color: "green", label: "CloudWatch", sub: "logs ship async",
      info: "Logs, metrics, and X-Ray traces ship asynchronously after the handler returns — they never add caller latency. They do add cost: log ingestion at ~0.50 USD/GB regularly exceeds Lambda compute cost for chatty functions. Set retention policies; the default is keep-forever." }
  ],
  edges: [
    { from: "client", to: "authorizer", label: "HTTPS" },
    { from: "authorizer", to: "throttle" },
    { from: "throttle", to: "ctrl", label: "invoke" },
    { from: "ctrl", to: "exec", label: "route/create" },
    { from: "exec", to: "ddb", label: "SDK call" },
    { from: "exec", to: "cw", dashed: true, label: "async" }
  ],
  flows: [
    { title: "Warm path, end to end", steps: [
      { lit: ["client", "client->authorizer", "authorizer"], text: "Request arrives; the authorizer gate runs first. A cached Lambda-authorizer result or inline JWT check costs ~0ms; an uncached custom authorizer adds a full extra Lambda invoke before your business logic even exists." },
      { lit: ["throttle", "throttle->ctrl"], text: "Throttle check passes and API Gateway invokes Lambda synchronously. Note the integration timeout: <strong>29 seconds</strong>, hard default (raisable by quota request now, but the lesson stands) — anything long-running must decouple into an async pattern, not hold the HTTP connection." },
      { lit: ["ctrl", "ctrl->exec", "exec"], text: "A warm execution environment exists, so the control plane routes straight into it. No init runs — the handler starts in single-digit milliseconds with all globally-initialized SDK clients ready." },
      { lit: ["exec->ddb", "ddb"], text: "The handler hits DynamoDB and returns. Billed duration is handler wall-clock in 1ms increments times the memory setting — a 128MB function crawling for 3s often costs more than a 1024MB function finishing in 300ms." },
      { lit: ["exec->cw", "cw"], text: "Logs and metrics ship asynchronously after the response is already on its way back — observability adds zero caller latency, only ingestion cost. End-to-end warm p50 for this whole chain is routinely under 50ms." }
    ]},
    { title: "Cold start: what init actually does", steps: [
      { lit: ["ctrl"], text: "No warm environment is available — first invoke, a traffic spike beyond current capacity, or environments recycled after idle. Placement must build one, and the caller waits through all of it on a sync invoke." },
      { lit: ["exec"], text: "<strong>Environment provisioning</strong>: download the code package or container layers, boot the Firecracker microVM, start the runtime. This slice is AWS's problem — you influence it mainly by keeping packages small and preferring lean runtimes." },
      { lit: ["exec"], text: "<strong>INIT phase</strong>: your top-of-handler code runs — imports, SDK client construction, config fetches. This is the slice YOU own and where most cold-start pain lives. Managed runtimes get full CPU during init regardless of memory setting, so front-load work here rather than in the handler." },
      { lit: ["ctrl", "exec"], text: "<strong>Provisioned concurrency</strong> runs provisioning + INIT ahead of traffic, keeping N environments hot — you pay per env-hour, warm or idle. SnapStart (Java, .NET, Python) instead resumes from a memory snapshot taken after init, cutting p99 cold starts ~10x for free-ish. Know which fits which scenario for the exam." }
    ]},
    { title: "Throttling and failure paths", steps: [
      { lit: ["throttle", "client"], text: "Burst bucket empty at API Gateway: instant <strong>429</strong>, backend never invoked, nearly free. This is the correct place to shed load — a limit you tune deliberately per stage and per API key, not an accident." },
      { lit: ["ctrl"], text: "Deeper in, Lambda's own concurrency limit throttles too (default 1,000 per region, shared across all functions). Reserved concurrency both guarantees a function capacity AND caps it — setting it to 0 is the standard emergency kill switch." },
      { lit: ["client", "client->authorizer"], text: "<strong>Sync invokes</strong> (API Gateway, ALB): throttles and function errors surface directly to the caller. Nothing retries on your behalf — the client must implement backoff with jitter or the errors compound." },
      { lit: ["ctrl", "exec"], text: "<strong>Async invokes</strong> (S3, SNS, EventBridge sources): Lambda queues the event internally and retries twice, with the event retained up to 6 hours; exhausted events go to the failure destination or DLQ you configured. Errors never reach the original caller — which is exactly why async paths without a DLQ fail silently." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "fanout-dlq",
  moduleId: "messaging",
  title: "Fanout, retries, and the poison pill",
  sub: "SNS-to-SQS fanout with per-queue DLQs, and EventBridge as the alternative bus. Step through filtered fanout, a poison pill's death, and why the queue layer exists at all.",
  w: 780, h: 440,
  nodes: [
    { id: "producer", x: 20, y: 170, w: 120, h: 46, color: "blue", label: "Producer", sub: "publish once",
      info: "Publishes each event exactly once to one topic and knows nothing about consumers — adding a fifth subscriber requires zero producer changes. Message attributes (type, region, tier) ride along for filter policies to match on. This decoupling is the whole point." },
    { id: "eb", x: 185, y: 60, w: 130, h: 46, color: "yellow", label: "EventBridge", sub: "the alternative bus",
      info: "The other fanout brain: rules match on the full event BODY (not just attributes), 5 targets per rule, schema registry, and native archive + replay. Trade-offs vs SNS: softer default throughput and higher latency (~100ms+ vs SNS's ~30ms), but cross-account event buses and 90+ SaaS/AWS sources SNS cannot ingest." },
    { id: "sns", x: 185, y: 170, w: 130, h: 46, color: "orange", label: "SNS topic", sub: "orders-events",
      info: "Push-based pub/sub with essentially unlimited throughput and millions of subscriptions. Delivery to each subscription is independent — one subscriber's failure never affects another's delivery. FIFO topics exist for ordered fanout to FIFO queues only." },
    { id: "q-orders", x: 370, y: 100, w: 150, h: 46, color: "orange", label: "SQS: orders", sub: "filter: type=order",
      info: "Subscribed with a filter policy so only order events land here — filtering happens inside SNS, so non-matching messages are never delivered, never polled, never billed. Standard queue: at-least-once delivery, best-effort order; consumers MUST be idempotent." },
    { id: "q-analytics", x: 370, y: 250, w: 150, h: 46, color: "orange", label: "SQS: analytics", sub: "no filter: all events",
      info: "No filter policy — the firehose subscription that takes everything for warehousing. Retention up to 14 days (default 4) means a consumer can be down all weekend and lose nothing. Same topic, completely independent consumption cursor from the orders queue." },
    { id: "c-orders", x: 580, y: 100, w: 150, h: 46, color: "green", label: "Order service", sub: "ECS long-poll",
      info: "Long-polls (WaitTimeSeconds=20 — always; short polling burns money on empty receives), processes, then explicitly deletes each message. Scale workers on ApproximateNumberOfMessagesVisible per instance — queue-depth-based scaling, the canonical decoupled autoscaling pattern." },
    { id: "c-analytics", x: 580, y: 250, w: 150, h: 46, color: "green", label: "Analytics svc", sub: "Lambda, batch 10",
      info: "Lambda via event source mapping: the ESM polls SQS for you and invokes with batches. Partial batch responses (ReportBatchItemFailures) prevent one bad record from forcing redelivery of the other nine. Rule of thumb: queue visibility timeout at least 6x the function timeout." },
    { id: "dlq-orders", x: 370, y: 350, w: 150, h: 44, color: "red", label: "orders-DLQ", sub: "maxReceive=5",
      info: "Just another SQS queue, wired via the source queue's redrive policy. Alarm on its depth going nonzero — a silent DLQ is a black hole of lost orders. DLQ retention should exceed the source queue's, since messages arrive here already old." },
    { id: "dlq-analytics", x: 580, y: 350, w: 150, h: 44, color: "red", label: "analytics-DLQ", sub: "per-queue policy",
      info: "Each queue owns its own DLQ and its own maxReceiveCount, tuned to that consumer's failure profile — analytics might tolerate 2 tries where orders warrants 5. Per-queue failure isolation is exactly what direct SNS-to-Lambda subscriptions make awkward." }
  ],
  edges: [
    { from: "producer", to: "sns", label: "publish" },
    { from: "producer", to: "eb", dashed: true },
    { from: "eb", to: "q-orders", dashed: true, label: "rule match" },
    { from: "sns", to: "q-orders", label: "filter match" },
    { from: "sns", to: "q-analytics", label: "all events" },
    { from: "q-orders", to: "c-orders", label: "long poll" },
    { from: "q-analytics", to: "c-analytics", label: "ESM batch" },
    { from: "q-orders", to: "dlq-orders", dashed: true, label: "maxReceive" },
    { from: "q-analytics", to: "dlq-analytics", dashed: true }
  ],
  flows: [
    { title: "Publish once, filtered fanout", steps: [
      { lit: ["producer", "producer->sns"], text: "The producer publishes one event with message attributes (type=order, tier=gold). One publish call, one bill line — regardless of how many subscribers exist now or get added later." },
      { lit: ["sns", "sns->q-orders", "sns->q-analytics"], text: "SNS evaluates each subscription's <strong>filter policy</strong> server-side: the orders queue receives only type=order; the analytics queue takes everything. Non-matching messages are never delivered — no consumer-side discard code, no wasted polling cost." },
      { lit: ["q-orders", "q-analytics"], text: "Each queue buffers independently. A 10x spike or a slow consumer on one queue creates backlog THERE and nowhere else — no backpressure ever reaches the producer or the sibling consumer." },
      { lit: ["c-orders", "c-analytics"], text: "Each service drains at its own pace with its own scaling policy: ECS workers scaling on queue depth for orders, Lambda batches of 10 for analytics. Same event stream, fully independent operational lives." }
    ]},
    { title: "The poison pill's journey to the DLQ", steps: [
      { lit: ["q-orders->c-orders", "c-orders"], text: "A malformed message arrives; the consumer throws before calling DeleteMessage. The message is not lost — it is merely invisible for the duration of the <strong>visibility timeout</strong>." },
      { lit: ["q-orders"], text: "Visibility timeout expires; the message reappears and is redelivered, incrementing its ReceiveCount. If the failure is deterministic — a poison pill, not a transient blip — this loop burns compute on every cycle and can stall a FIFO message group entirely." },
      { lit: ["q-orders->dlq-orders", "dlq-orders"], text: "ReceiveCount exceeds <strong>maxReceiveCount</strong> (5) and SQS moves the message to the DLQ automatically. The healthy 99.9% of traffic keeps flowing — the entire point. Your CloudWatch alarm on DLQ depth fires; a human investigates with the evidence preserved." },
      { lit: ["dlq-orders", "q-orders"], text: "After the parser bug ships, use the built-in <strong>DLQ redrive</strong> to move messages back to the source queue at a controlled rate. No lost orders, no hand-written replay script — but only because the consumer was idempotent enough to survive redelivery." }
    ]},
    { title: "Why queues, not direct SNS-to-Lambda", steps: [
      { lit: ["sns"], text: "SNS could push straight to Lambda. But push means SNS owns the retry policy, a traffic spike becomes instant Lambda concurrency demand with no buffer, and a downstream outage leaves you with whatever SNS's delivery retries salvage." },
      { lit: ["q-orders", "q-analytics"], text: "A queue in the middle is a durable shock absorber: spikes become backlog instead of throttles, consumers pull at a rate THEY choose, and up to 14 days of retention turns a weekend outage into Monday's backlog instead of Monday's incident." },
      { lit: ["dlq-orders", "dlq-analytics"], text: "Retry ownership moves to where failures actually happen: each queue tunes its own visibility timeout, maxReceiveCount, and DLQ. Batch processing and partial-batch failure handling come free with the SQS-Lambda event source mapping." },
      { lit: ["eb", "producer->eb", "eb->q-orders"], text: "When you need content-based routing on the payload, cross-account buses, or native <strong>archive and replay</strong>, EventBridge is the upgrade path — often targeting these same SQS queues, because the buffering argument does not go away just because the router got smarter." }
    ]}
  ]
});
