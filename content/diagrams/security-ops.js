/* Interactive diagrams: security & operations modules (security-services, observability, ha-dr). */

window.COURSE.registerDiagram({
  id: "envelope-encryption",
  moduleId: "security-services",
  title: "Envelope encryption with KMS",
  sub: "Why nothing in AWS encrypts data with the CMK directly. Click the pieces, then walk the encrypt and decrypt paths.",
  w: 780, h: 440,
  nodes: [
    { id: "kmszone", x: 500, y: 30, w: 260, h: 250, zone: true, label: "AWS KMS (FIPS 140 HSMs)" },
    { id: "app", x: 40, y: 160, w: 150, h: 48, color: "green", label: "Application", sub: "SDK, local crypto",
      info: "Your process does the bulk encryption itself — AES-256-GCM in memory, at memory bandwidth, on data of any size. KMS is only consulted for key material, so KMS latency and its request quota (and per-request price) are paid once per object, not once per byte." },
    { id: "cmk", x: 545, y: 75, w: 170, h: 46, color: "orange", label: "KMS key (CMK)", sub: "never leaves the HSM",
      info: "The root of trust. Its key material is generated in and never exported from the HSM fleet — every use is an API call evaluated against the key policy plus IAM. That non-exportability is the whole security argument: compromise of your app leaks data keys for objects it touched, never the CMK." },
    { id: "gendk", x: 545, y: 148, w: 170, h: 42, color: "blue", label: "GenerateDataKey", sub: "one call, two keys",
      info: "Returns a fresh 256-bit data key twice: once in plaintext, once encrypted under the CMK. One network round trip per object. GenerateDataKeyWithoutPlaintext exists for the pattern where the producer should never be able to read what it stores." },
    { id: "decrypt", x: 545, y: 213, w: 170, h: 42, color: "blue", label: "Decrypt", sub: "unwraps the data key",
      info: "You send the wrapped data key blob — KMS knows which CMK made it from metadata baked into the ciphertext. The call succeeds only if the key policy AND the caller's IAM policy allow kms:Decrypt, and the key is Enabled. This is the runtime choke point for all access to the data." },
    { id: "ptkey", x: 250, y: 80, w: 150, h: 44, color: "red", label: "Plaintext data key", sub: "ephemeral, RAM only",
      info: "Exists only in your process memory for the duration of the crypto operation, then is zeroed and discarded. It must never be written to disk, logs, or an env var — persisting it silently converts envelope encryption back into client-side key management." },
    { id: "enckey", x: 250, y: 240, w: 150, h: 44, color: "blue", label: "Wrapped data key", sub: "ciphertext of the key",
      info: "The same data key encrypted under the CMK. Useless on its own — it is safe to store right next to the data it protects, which is exactly what S3 SSE-KMS and EBS encryption do. Losing it means losing the object; that is why it travels with the ciphertext." },
    { id: "obj", x: 250, y: 350, w: 170, h: 46, color: "orange", label: "S3 / EBS object", sub: "ciphertext + key blob",
      info: "The stored unit is self-describing: encrypted payload plus the wrapped key in metadata (x-amz-*-key headers for S3, volume metadata for EBS). Every object gets its own data key, so there is no shared-key blast radius and no re-encrypt storm on rotation." },
    { id: "trail", x: 545, y: 350, w: 170, h: 46, color: "yellow", label: "CloudTrail", sub: "every KMS API call",
      info: "GenerateDataKey and Decrypt are management-plane API calls, so each one lands in CloudTrail with caller identity, key ARN, and encryption context. Reading a KMS-encrypted object is therefore auditable per access — something raw client-side encryption can never give you." }
  ],
  edges: [
    { from: "app", to: "gendk", label: "1. request key" },
    { from: "gendk", to: "ptkey", label: "plaintext copy" },
    { from: "gendk", to: "enckey", label: "wrapped copy" },
    { from: "ptkey", to: "app", label: "AES-256 locally" },
    { from: "app", to: "obj", label: "write" },
    { from: "enckey", to: "obj", label: "stored together" },
    { from: "obj", to: "decrypt", dashed: true, label: "wrapped key" },
    { from: "decrypt", to: "app", dashed: true, label: "plaintext key" },
    { from: "decrypt", to: "trail", dashed: true, label: "logged" }
  ],
  flows: [
    { title: "Encrypt path", steps: [
      { lit: ["app", "app->gendk", "gendk"], text: "The app calls <strong>GenerateDataKey</strong>, naming the CMK and (ideally) an encryption context. This is the only network hop in the whole encrypt path — everything after is local CPU." },
      { lit: ["cmk", "gendk->ptkey", "gendk->enckey", "ptkey", "enckey"], text: "Inside the HSM, KMS mints a fresh 256-bit key and returns it twice: plaintext for immediate use, and wrapped under the CMK. The CMK itself never crossed the wire." },
      { lit: ["ptkey", "ptkey->app"], text: "The app encrypts the payload locally with the plaintext key (AES-GCM), then <strong>discards the plaintext key from memory</strong>. Its lifetime should be milliseconds — if it persists anywhere, the model is broken." },
      { lit: ["app->obj", "enckey->obj", "obj"], text: "Ciphertext and the wrapped key are stored together as one self-contained unit. Nothing needs to be looked up elsewhere later; the object carries everything needed to ask KMS for its own key." }
    ]},
    { title: "Decrypt path", steps: [
      { lit: ["obj", "obj->decrypt"], text: "A reader fetches the object, peels off the wrapped key blob, and sends it to <strong>kms:Decrypt</strong>. Note it does not name the CMK — the blob's metadata identifies it." },
      { lit: ["decrypt", "cmk"], text: "KMS authorizes the call against <strong>both</strong> the key policy and the caller's IAM policy (and the encryption context must match). Two independent documents must say yes — this is the intersection model the exam probes." },
      { lit: ["decrypt->trail", "trail"], text: "Allowed or denied, the call is recorded in CloudTrail: who, which key ARN, which context, when. Anomalous Decrypt volume is one of the highest-signal detections you can build." },
      { lit: ["decrypt->app", "app"], text: "KMS returns the plaintext data key; the app decrypts locally and again discards the key. Steady-state cost: one KMS request per object read — cache data keys (S3 Bucket Keys, the Encryption SDK's caching CMM) when request volume or price bites." }
    ]},
    { title: "Why envelope at all?", steps: [
      { lit: ["cmk"], text: "Direct kms:Encrypt is capped at <strong>4 KB</strong> of payload — it exists for secrets, not data. Shipping every gigabyte through a remote HSM would be absurd for latency, throughput, and per-request cost anyway." },
      { lit: ["ptkey", "obj"], text: "Envelope gives you a <strong>unique key per object</strong> at local-CPU speed. Compromise of one data key exposes one object; rotating the CMK requires re-wrapping nothing, because old wrapped keys still decrypt under retained backing key versions." },
      { lit: ["cmk", "decrypt"], text: "The kill switch: disable the CMK, revoke a grant, or schedule key deletion (7-30 day wait) and <strong>every object it ever wrapped becomes unreadable at once</strong> — millions of objects fenced off by one control-plane action. That is crypto-shredding, and why key deletion is deliberately slow and loud." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "observability-pipeline",
  moduleId: "observability",
  title: "The three pipelines: metrics, logs, audit",
  sub: "Metrics answer 'is it broken', logs answer 'why', CloudTrail answers 'who'. Click nodes, then trace each signal end to end.",
  w: 790, h: 450,
  nodes: [
    { id: "ec2", x: 30, y: 50, w: 150, h: 48, color: "green", label: "EC2 + CW agent", sub: "metrics and logs",
      info: "The unified CloudWatch agent ships OS-level metrics the hypervisor cannot see (memory, disk used, per-process) plus log files. Default EC2 metrics are 5-minute; detailed monitoring buys 1-minute at extra cost. Agent config lives in SSM Parameter Store for fleet-wide consistency." },
    { id: "custom", x: 30, y: 140, w: 150, h: 44, color: "green", label: "Custom metrics", sub: "EMF or PutMetricData",
      info: "Two routes: PutMetricData API calls (throttled, priced per metric, painful at high cardinality) or Embedded Metric Format — structured JSON printed to stdout that CloudWatch extracts asynchronously. EMF is the modern default: zero API calls from the hot path, and the raw log line survives as evidence." },
    { id: "trail", x: 30, y: 330, w: 150, h: 46, color: "yellow", label: "CloudTrail", sub: "mgmt + data events",
      info: "The audit pipeline: every control-plane API call, delivered within ~15 minutes. Management events are on by default and free once; data events (S3 object-level, Lambda invoke) are opt-in and priced. CloudTrail is about WHO acted — it is not a debugging or performance tool." },
    { id: "metrics", x: 250, y: 50, w: 150, h: 46, color: "orange", label: "CloudWatch Metrics", sub: "namespaced time series",
      info: "Time-series store keyed by namespace + metric + dimensions; every distinct dimension combination is a separate billed metric. Standard resolution is 1 minute, high resolution 1 second. Retention is automatic but rolls up: 1-second data lives 3 hours, 1-minute lives 15 days, aggregates up to 15 months." },
    { id: "logs", x: 250, y: 210, w: 150, h: 46, color: "orange", label: "CloudWatch Logs", sub: "groups and streams",
      info: "Ingest is the expensive part (~$0.50/GB), storage is cheap — set retention per group or pay forever, since the default is never-expire. Logs Insights queries it ad hoc; the two filter types on the right turn passive storage into an active pipeline." },
    { id: "s3arch", x: 250, y: 380, w: 140, h: 40, color: "blue", label: "S3 archive", sub: "trail, org-wide",
      info: "The durable audit record: an organization trail writing to a central, locked-down bucket (SSE-KMS, MFA delete or Object Lock, separate security account). Athena queries it directly. CloudTrail Lake is the managed alternative with 7-year retention and SQL built in." },
    { id: "mfilter", x: 470, y: 140, w: 140, h: 36, color: "yellow", label: "Metric filter", sub: "log line to metric",
      info: "A pattern match applied at ingest that increments a metric — count of 5xx lines, parsed latency values, JSON field extraction. Zero code, near-real-time, and the standard SAA answer to 'alarm when a specific string appears in logs'. It only sees data arriving after creation, never historical." },
    { id: "sfilter", x: 470, y: 255, w: 140, h: 36, color: "yellow", label: "Subscription", sub: "filter, streams out",
      info: "Streams matching log events out of CloudWatch in near real time to Kinesis Data Streams, Firehose, or Lambda. This is the export path for SIEMs, cross-account log centralization, and OpenSearch. Two subscription filters max per log group — plan the fan-out at the Kinesis layer." },
    { id: "alarm", x: 470, y: 50, w: 140, h: 44, color: "red", label: "CloudWatch alarm", sub: "M of N datapoints",
      info: "Evaluates one metric or a metric-math expression: threshold, N evaluation periods, M-of-N to ride out flappy signals. Three states — OK, ALARM, INSUFFICIENT_DATA — and the treat-missing-data setting decides whether silence (an agent that died) counts as breach. Composite alarms AND/OR children to cut pager noise." },
    { id: "evb", x: 470, y: 330, w: 140, h: 46, color: "orange", label: "EventBridge", sub: "rules match events",
      info: "The event router: alarm state changes, CloudTrail-sourced API events, schedules, and 3rd-party partners all land on the bus, and rules pattern-match JSON to fan out to targets. This is the glue layer of every event-driven ops answer — SNS notifies humans, EventBridge drives machines." },
    { id: "sns", x: 660, y: 50, w: 120, h: 44, color: "blue", label: "SNS to on-call", sub: "page, email, HTTPS",
      info: "The human notification leg: alarm actions publish to a topic fanning out to PagerDuty/Opsgenie endpoints, email, or chat webhooks. Cross-region alarms cannot target a topic in another region — topic and alarm must be co-located, a classic gotcha." },
    { id: "kinesis", x: 660, y: 250, w: 120, h: 44, color: "blue", label: "Kinesis / Lambda", sub: "stream processing",
      info: "Subscription-filter targets: Lambda for per-event logic, Kinesis Data Streams for ordered multi-consumer fan-out, Firehose for dump-to-S3/OpenSearch with buffering. Events arrive base64-gzipped — every consumer starts by decompressing; forgetting that is a rite of passage." },
    { id: "remed", x: 660, y: 330, w: 120, h: 44, color: "green", label: "Auto-remediation", sub: "Lambda / SSM doc",
      info: "The machine leg: an EventBridge target invoking Lambda or an SSM Automation runbook — restart the service, revert the public bucket ACL, snapshot then isolate the instance. Alarms page people; EventBridge rules fix things. Keep both, in that order of trust." }
  ],
  edges: [
    { from: "ec2", to: "metrics", label: "agent push" },
    { from: "ec2", to: "logs", label: "log files" },
    { from: "custom", to: "logs", label: "EMF JSON" },
    { from: "custom", to: "metrics", dashed: true, label: "PutMetricData" },
    { from: "logs", to: "mfilter" },
    { from: "mfilter", to: "metrics", label: "counts" },
    { from: "logs", to: "sfilter" },
    { from: "sfilter", to: "kinesis", label: "near-real-time" },
    { from: "metrics", to: "alarm", label: "evaluate" },
    { from: "alarm", to: "sns", label: "alarm action" },
    { from: "alarm", to: "evb", dashed: true, label: "state change" },
    { from: "trail", to: "s3arch", label: "every 5 min" },
    { from: "trail", to: "logs", dashed: true, label: "optional" },
    { from: "trail", to: "evb", label: "API events" },
    { from: "evb", to: "remed", label: "target" }
  ],
  flows: [
    { title: "A latency spike, end to end", steps: [
      { lit: ["ec2", "ec2->metrics", "metrics"], text: "p99 latency climbs. The agent (or EMF) has been publishing it as a custom metric at 1-minute resolution — dimensions pinned to service and AZ so you can tell 'one bad AZ' from 'everything'." },
      { lit: ["metrics->alarm", "alarm"], text: "The alarm is set to <strong>3 of 3 datapoints over threshold</strong> — it tolerates one bad minute, then flips OK to ALARM. Detection floor: roughly resolution times evaluation periods, so about 3 minutes here. Tighter needs high-resolution metrics and 10-second periods." },
      { lit: ["alarm->sns", "sns"], text: "The ALARM action publishes to SNS and the on-call is paged. Notification is a state-<strong>transition</strong> action — a metric that stays bad does not re-page unless you build re-notification yourself." },
      { lit: ["alarm->evb", "evb", "evb->remed", "remed"], text: "In parallel, the state change hits EventBridge and a rule fires the runbook — recycle the bad tasks, shift weight off the sick AZ. Human paged, machine already acting; that pairing is the target architecture in every ops question." }
    ]},
    { title: "Log line to metric to alarm", steps: [
      { lit: ["custom", "custom->logs", "logs"], text: "The app logs a structured error line — say a JSON payment failure event. It is sitting in a log group; on its own, storage that no one is watching." },
      { lit: ["logs->mfilter", "mfilter", "mfilter->metrics"], text: "A <strong>metric filter</strong> matches the pattern at ingest and increments PaymentFailures. No code, no poller, seconds of latency — the canonical bridge from the log pipeline into the metric pipeline." },
      { lit: ["metrics", "metrics->alarm", "alarm", "alarm->sns"], text: "From here it is the normal metric machinery: threshold, M-of-N, page. Remember filters are forward-only — creating one never backfills, so you cannot alarm on last week." },
      { lit: ["logs->sfilter", "sfilter", "sfilter->kinesis", "kinesis"], text: "The same log group also streams out via a <strong>subscription filter</strong> to Kinesis/Lambda — enrichment, the SIEM, cross-account central logging. Metric filter = aggregate and alert; subscription filter = move the raw events. Two filters, two different exam answers." }
    ]},
    { title: "Who deleted the bucket?", steps: [
      { lit: ["trail"], text: "DeleteBucket is a management-plane call, so CloudTrail captured it: ARN of the caller, source IP, assumed-role session name, timestamp. This pipeline answers <strong>who and what</strong> — never how slow or how many." },
      { lit: ["trail->evb", "evb", "evb->remed"], text: "For detection you do not poll the trail: CloudTrail feeds EventBridge, and a rule matching eventName DeleteBucket fires within a minute or two — alert the security channel, or auto-apply an SCP-style lockdown via Lambda." },
      { lit: ["trail->s3arch", "s3arch"], text: "The forensic copy lands in the locked-down org-trail bucket for Athena. Real-time reaction comes from EventBridge; the immutable record comes from S3 — different consumers, same source." },
      { lit: ["trail", "metrics", "logs"], text: "The triangle, for the exam: <strong>CloudTrail</strong> = who called which API. <strong>CloudWatch</strong> = how the system is performing. <strong>AWS Config</strong> (off-canvas) = what the resource configuration was at time T and whether it was compliant. Every audit-flavored question is asking you to pick the right vertex." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "dr-failover",
  moduleId: "ha-dr",
  title: "Multi-region failover, step by step",
  sub: "Warm standby with Aurora Global. Click each piece, then run the failure — and see why the pros distrust control planes.",
  w: 800, h: 460,
  nodes: [
    { id: "primary", x: 20, y: 175, w: 365, h: 265, zone: true, label: "us-east-1 (primary)" },
    { id: "standby", x: 415, y: 175, w: 365, h: 265, zone: true, label: "us-west-2 (standby)" },
    { id: "users", x: 330, y: 15, w: 140, h: 38, color: "blue", label: "Users",
      info: "Clients resolve DNS and then cache the answer for the record's TTL — plus whatever their OS, browser, and misbehaving corporate resolvers add on top. During failover, this cache is your floor on client-visible RTO no matter how fast AWS moves." },
    { id: "r53", x: 200, y: 85, w: 150, h: 46, color: "orange", label: "Route 53", sub: "failover routing",
      info: "Failover routing policy: a PRIMARY record served while healthy, a SECONDARY served when the associated health check fails. The DNS data plane answering queries is globally distributed and holds a 100% SLA — the control plane (API, console) is a single-region dependency in us-east-1. That asymmetry drives the whole third flow." },
    { id: "hc", x: 420, y: 85, w: 150, h: 44, color: "yellow", label: "Health checks", sub: "15 checkers, 30s",
      info: "A fleet of checkers in multiple regions probes the endpoint every 30s (10s for fast checks); the target is unhealthy when fewer than 18% of checkers succeed, after the failure threshold — typically 3 consecutive misses. Check a deep /health endpoint that exercises real dependencies, not a static 200." },
    { id: "arc", x: 630, y: 85, w: 150, h: 46, color: "red", label: "Route 53 ARC", sub: "data-plane switch",
      info: "Application Recovery Controller: routing controls are simple on/off switches stored in a cluster spanning 5 regions, flipped via a data-plane API with an extreme-availability SLA. Health checks reference the control state, so failover becomes a deliberate, quorum-backed toggle instead of an inference — and it works even when a region's control plane is down." },
    { id: "alb1", x: 50, y: 215, w: 140, h: 44, color: "orange", label: "ALB (primary)",
      info: "Takes 100% of traffic in steady state. It is also the health-check target — via a deep /health route — so its view of downstream dependencies is what Route 53 acts on." },
    { id: "asg1", x: 225, y: 215, w: 140, h: 44, color: "green", label: "App ASG", sub: "full size, 3 AZs",
      info: "Full production capacity across three AZs. Everything needed to rebuild it — AMIs, container images, launch templates, config — must already exist in the standby region too; discovering at failover time that an artifact lives only in the dead region is the classic DR post-mortem." },
    { id: "aurora1", x: 225, y: 310, w: 140, h: 44, color: "blue", label: "Aurora primary", sub: "the only writer",
      info: "The single writable cluster. Aurora Global Database replicates at the storage layer to the secondary region — dedicated infrastructure, not binlog replay — so replica lag is typically under a second even at high write throughput, and the primary pays almost no performance tax for it." },
    { id: "alb2", x: 445, y: 215, w: 140, h: 44, color: "orange", label: "ALB (standby)",
      info: "Pre-provisioned and answering health checks, receiving no user traffic while the primary record is healthy. Keeping it warm means DNS failover points at something that already works — pilot-light designs that create the load balancer at failover time add minutes of CloudFormation to the RTO." },
    { id: "asg2", x: 620, y: 215, w: 140, h: 44, color: "green", label: "App (scaled down)", sub: "warm standby",
      info: "The warm-standby signature: identical stack at a fraction of capacity — enough to serve degraded traffic instantly, cheap enough to run forever. On failover it scales out; the RTO cost is instance boot plus health-check warmup, minutes not hours. This capacity-versus-cost dial is exactly what separates the four DR strategies on the exam." },
    { id: "aurora2", x: 620, y: 310, w: 140, h: 44, color: "blue", label: "Aurora Global", sub: "read-only secondary",
      info: "A read-only secondary cluster fed by storage-level replication. Managed failover promotes it to writer in about a minute; unplanned failover accepts data loss up to the replica lag (your RPO, typically about 1s). Until promotion, any write sent here fails — the app must tolerate a read-only window." },
    { id: "repl", x: 205, y: 385, w: 160, h: 38, color: "yellow", label: "Storage replication", sub: "async, lag under 1s",
      info: "Aurora Global ships redo log at the storage layer over the AWS backbone. Asynchronous — the primary never waits on the remote region — so RPO is nonzero by design. If the business truly requires RPO of zero across regions, the answer changes to synchronous designs like DynamoDB global tables plus idempotent writes, with different trade-offs." }
  ],
  edges: [
    { from: "users", to: "r53", label: "DNS query" },
    { from: "r53", to: "alb1", label: "PRIMARY record" },
    { from: "r53", to: "alb2", dashed: true, label: "SECONDARY record" },
    { from: "hc", to: "alb1", label: "GET /health" },
    { from: "arc", to: "r53", dashed: true, label: "routing control" },
    { from: "alb1", to: "asg1" },
    { from: "asg1", to: "aurora1", label: "read/write" },
    { from: "alb2", to: "asg2", dashed: true },
    { from: "asg2", to: "aurora2", dashed: true, label: "read-only" },
    { from: "aurora1", to: "repl", label: "redo log" },
    { from: "repl", to: "aurora2", label: "async, ~1s lag" }
  ],
  flows: [
    { title: "Steady state", steps: [
      { lit: ["users", "users->r53", "r53", "r53->alb1"], text: "Users resolve the app's name; Route 53 serves the PRIMARY record because its health check is passing. Keep the TTL short — 60s or less — <strong>before</strong> the incident; you cannot retroactively shorten a TTL that is already cached worldwide." },
      { lit: ["alb1", "alb1->asg1", "asg1", "asg1->aurora1"], text: "All traffic lands on the primary stack: full-capacity ASG across three AZs, reads and writes against the single Aurora writer. Multi-AZ inside the region already absorbs instance and AZ failures — the second region exists for the rarer, bigger event." },
      { lit: ["aurora1->repl", "repl", "repl->aurora2", "aurora2"], text: "Continuously, Aurora Global replicates at the storage layer to us-west-2 with sub-second typical lag. That lag is the standing <strong>RPO</strong>: at any instant, up to about one second of committed writes exists only in the primary region." },
      { lit: ["alb2", "asg2"], text: "The standby serves no users but is alive: ALB answering health checks, a scaled-down ASG proving the AMIs, config, and deploy pipeline actually work there. A standby that is not continuously exercised is a hypothesis, not a DR plan." }
    ]},
    { title: "Regional failure and failover", steps: [
      { lit: ["hc", "hc->alb1", "alb1"], text: "us-east-1 has a bad day. The health-check fleet misses <strong>3 consecutive</strong> probes — roughly 90 seconds at the 30s interval to declare the endpoint unhealthy. Fast (10s) checks cut this to ~30s. This detection window is the first RTO component." },
      { lit: ["r53", "r53->alb2"], text: "Route 53's data plane stops serving PRIMARY and answers with the SECONDARY record. New resolutions go west immediately — but clients holding cached answers keep hitting the dead region until their TTL expires. Detection plus TTL: you are ~2-3 minutes in." },
      { lit: ["alb2", "asg2"], text: "Traffic arrives at the warm standby, which serves — degraded — from its skeleton capacity while the ASG scales out. Boot plus warmup is minutes; raise the standby's desired capacity as the incident opens rather than waiting for CPU alarms to do it organically." },
      { lit: ["aurora2", "repl->aurora2"], text: "The database is still read-only. You trigger Aurora Global failover: <strong>managed planned failover</strong> is lossless (RPO 0) but waits to sync; unplanned <strong>detach-and-promote</strong> takes about a minute and abandons unreplicated writes — RPO equals the replica lag. Writes resume once the app's endpoint flips to the new writer." },
      { lit: ["users", "r53", "alb2", "aurora2"], text: "Net: reads degrade for ~2-3 minutes (detection + DNS), writes for ~5-10 (plus promotion and scale-out), RPO ~1s if you detached. Every one of those numbers was chosen by architecture — warm standby capacity, TTL, check interval — not discovered during the incident." }
    ]},
    { title: "Data plane vs control plane", steps: [
      { lit: ["r53", "hc"], text: "The failover above needed only Route 53's <strong>data plane</strong> — globally distributed DNS answers and health-check evaluation, 100% SLA. It required no API call to succeed. That property is called <strong>static stability</strong>: the recovery path needs nothing created or reconfigured at recovery time." },
      { lit: ["r53"], text: "The trap: runbooks that call UpdateHealthCheck or change record sets during the incident depend on the Route 53 <strong>control plane</strong> — which lives in us-east-1. In a us-east-1 event, the API you planned to call may be the thing that is down. Same trap: 'we will raise quotas / create the ASG / update the Lambda env var during failover'." },
      { lit: ["arc", "arc->r53"], text: "Route 53 ARC exists precisely for the deliberate-failover case: routing controls stored redundantly across a 5-region quorum cluster, flipped through a highly available data-plane API. You get an explicit big red switch — auditable, safety-rule-guarded — that works when the affected region's control plane does not." },
      { lit: ["asg2", "aurora2", "arc"], text: "Design rule to carry into the exam and into production: <strong>pre-provision capacity, pre-create everything, and make failover a data-plane action</strong> — flip a routing control, promote a replica. If your DR plan's critical path contains a CreateSomething call, it is a plan to be disappointed." }
    ]}
  ]
});
