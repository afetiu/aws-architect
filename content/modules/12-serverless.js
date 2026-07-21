/* Module 12 — Serverless: Lambda, API Gateway & Step Functions (SAA track) */
window.COURSE.register({
  id: "serverless",
  order: 12,
  track: "saa",
  title: "Serverless: Lambda, API Gateway & Step Functions",
  description: "Lambda's real execution model (Firecracker micro-VMs, concurrency pools, cold starts), the three invocation paths and their retry semantics, API Gateway's REST-vs-HTTP split and auth stack, and Step Functions as the durable coordinator. Ends with when serverless is the wrong answer.",
  examWeight: "Heavily tested on SAA-C03 across all four domains. REST vs HTTP API, Lambda concurrency types, SQS-to-Lambda batching, and Standard vs Express Step Functions are near-guaranteed question territory.",
  lessons: [
    {
      id: "lambda-execution-model",
      title: "Lambda's execution model: micro-VMs, lifecycle, and cold starts",
      html: `
<p>Strip away the marketing and Lambda is a fleet scheduler for single-purpose micro-VMs. Every execution environment is a <strong>Firecracker</strong> micro-VM: a KVM-based VMM written in Rust that boots a minimal guest in ~125 ms with a ~5 MB memory footprint. Firecracker gives Lambda hardware-virtualization isolation between tenants (unlike containers, which share a kernel), which is why AWS is comfortable packing thousands of environments from different accounts onto one bare-metal host. If you have run gVisor or Kata Containers, Firecracker sits in the same design space but strips the device model down to virtio-net, virtio-block, and a serial console — nothing else to attack.</p>

<h3>The environment lifecycle</h3>
<p>An execution environment moves through three phases, and the boundaries between them explain almost every Lambda behavior that surprises people:</p>
<ul>
<li><strong>Init</strong> — Lambda creates the micro-VM, downloads your code (from an internal S3-backed store, or pulls and mounts your container image), starts the runtime, and runs all code <em>outside</em> the handler: top-of-file imports, static initializers, SDK client construction. Init gets a hard <strong>10-second</strong> budget for the function init phase; blow it and Lambda retries the init inside the invoke, billing you for it. For ZIP functions on x86 with under ~3 GB memory, init CPU is burst-boosted regardless of your memory setting — which is exactly why "do expensive setup at init" is real advice, not cargo cult.</li>
<li><strong>Invoke</strong> — the handler runs. One environment processes <strong>exactly one request at a time</strong>. There is no request-level concurrency inside an environment (ignoring the niche runtime-level exceptions like Lambda's own internal extensions). If ten requests arrive and one warm environment exists, Lambda spins up nine more.</li>
<li><strong>Shutdown</strong> — after minutes of idleness (undocumented, empirically ~5 to 15+ minutes, variable), Lambda tears the environment down. Extensions get a SIGTERM-equivalent shutdown event with a 2-second window; the runtime itself gets ~500 ms. Anything you cached in memory or /tmp evaporates.</li>
</ul>

<div class="callout deep">Between invokes, the environment is <strong>frozen</strong>, not idle: cgroup freezer semantics, no CPU cycles. Background threads, timers, and half-finished async work stop mid-flight and resume on the next invoke — possibly seconds or minutes later. This is the root cause of the classic "my fire-and-forget telemetry call never arrived" bug: the process was frozen before the socket flushed. Either await everything before returning, or use the Extensions API which lets registered extensions run after the response is returned.</div>

<h3>What actually drives cold starts</h3>
<p>A cold start is Init happening on the critical path of a request. Its cost decomposes into: Firecracker boot (~small, AWS's problem), code download (proportional to package size — a 250 MB uncompressed ZIP hurts; container images fare better than you'd expect because Lambda lazily pages image chunks from a deduplicated cache), runtime start (JVM and .NET are the heavy tails; Node/Python are ~100-300 ms; Go and Rust are near-negligible), and <em>your</em> init code (framework DI containers, config fetches, TLS handshakes to databases). On the exam and in production, the levers are: smaller deployment artifact, lighter runtime, lazy-load rarely used dependencies, and provisioned concurrency or SnapStart when the tail matters.</p>

<h3>Concurrency: one pool, three flavors</h3>
<p>Concurrency is Lambda's real capacity unit: <strong>concurrency = number of in-flight environments</strong>, roughly requests/sec × average duration in seconds. Your account gets a regional pool of <strong>1,000</strong> concurrent executions by default (a limit, raisable to tens of thousands). Every function in the region draws from that shared pool unless you carve it up:</p>
<table>
<thead><tr><th></th><th>Unreserved (default)</th><th>Reserved concurrency</th><th>Provisioned concurrency</th></tr></thead>
<tbody>
<tr><td>What it is</td><td>Shared pool, first come first served</td><td>A carve-out: max <em>and</em> guaranteed floor for one function</td><td>Pre-initialized warm environments held ready</td></tr>
<tr><td>Cold starts</td><td>Yes</td><td>Yes</td><td>No, up to the provisioned count</td></tr>
<tr><td>Cost</td><td>Free (pay per invoke)</td><td>Free (pay per invoke)</td><td>Paid per GB-hour <em>while allocated</em>, even at zero traffic</td></tr>
<tr><td>Doubles as</td><td>—</td><td>Throttle/kill-switch: set to 0 to block all invokes</td><td>SLA tool for latency-sensitive sync paths</td></tr>
</tbody>
</table>
<p>Reserved concurrency is both ceiling and floor — it subtracts from the shared pool, so other functions can never starve this one, and this one can never exceed its reservation. Setting it to 0 is the standard emergency stop for a runaway function. Provisioned concurrency sits <em>on top of</em> a function version or alias (never $LATEST) and is the only mechanism that actually eliminates cold starts; pair it with Application Auto Scaling on a schedule for diurnal traffic.</p>

<h3>Burst behavior</h3>
<p>Scaling is not instantaneous-to-1000. Under the current model, each function can scale up at a rate of <strong>1,000 additional concurrent executions every 10 seconds</strong> (per function), up to the account limit. That is fast — but a genuine stampede (cache expiry storm, TV-ad traffic) can still outrun it, and outrun requests get throttled with 429s (sync) or retried internally (async). Design spiky sync paths with provisioned concurrency or an SQS buffer in front.</p>

<div class="callout limits">Numbers to memorize: default account concurrency <strong>1,000</strong> per region (soft). Scale rate <strong>1,000/10 s per function</strong>. Function timeout max <strong>15 minutes</strong>. Memory <strong>128 MB to 10,240 MB</strong>. Init phase budget <strong>10 s</strong>. One request per environment at a time, always.</div>

<div class="callout exam">Exam mappings: "eliminate cold-start latency for a critical API" → provisioned concurrency. "Prevent one function from consuming all account concurrency / guarantee capacity" → reserved concurrency. "Function is being throttled at 1,000" → request a service quota increase, or check reserved carve-outs elsewhere in the account. "Immediately stop a misbehaving function without deleting it" → reserved concurrency = 0.</div>

<div class="callout war">The shared-pool failure mode bites real systems: one chatty async consumer scales to 900 and your customer-facing sync API starts throwing 429s with no code change on your side. Treat reserved concurrency on tier-1 functions as mandatory hygiene in shared accounts, the same way you'd set CPU requests in a shared Kubernetes cluster.</div>
`
    },
    {
      id: "lambda-invocation",
      title: "Invocation paths: sync, async, and event source mappings",
      html: `
<p>Every Lambda invoke arrives by one of exactly three paths, and each path owns different retry, error, and ordering semantics. Most production incidents traced to "Lambda retried and double-charged a customer" are really someone not knowing which path they were on.</p>

<h3>1. Synchronous (request-response)</h3>
<p>API Gateway, ALB, Cognito, and direct <code>Invoke</code> calls wait for the response. Lambda does <strong>zero retries</strong> — errors propagate to the caller, and retry policy is entirely the client's problem (the AWS SDKs retry on 429/5xx by default, which is its own gotcha for non-idempotent handlers). Throttles surface as HTTP 429. If you need exactly-once effects behind a sync path, you build idempotency yourself (conditional writes on an idempotency key in DynamoDB is the canonical pattern).</p>

<h3>2. Asynchronous (fire-and-forget with an internal queue)</h3>
<p>S3 event notifications, SNS, EventBridge, CloudWatch Events, and <code>InvocationType: Event</code> hand the payload to Lambda and get an immediate 202. Lambda drops the event onto an <strong>internal, service-owned queue</strong> you cannot see, then a poller invokes your function from it. Semantics that matter:</p>
<ul>
<li><strong>Retries:</strong> on function error, Lambda retries <strong>twice</strong> (so 3 attempts total), with waits of one minute then two minutes. On throttle, it retries with backoff for up to <strong>6 hours</strong>. Configure both knobs down (maximum event age, maximum retry attempts) if stale events are worse than dropped events.</li>
<li><strong>Duplicates:</strong> the internal queue is at-least-once. Occasionally your function sees the same event twice with no error anywhere. Idempotency is not optional on the async path.</li>
<li><strong>After exhaustion:</strong> the event goes to a <strong>DLQ</strong> (SQS or SNS, configured on the function — legacy mechanism, failure only) or, better, to <strong>destinations</strong>: separate targets for <em>on-success</em> and <em>on-failure</em>, choosing among SQS, SNS, EventBridge, or another Lambda. Destinations receive the full invocation record (request payload plus response or error), where a DLQ gets only the original event — that context is why destinations are the modern answer.</li>
</ul>

<div class="callout exam">"Process events that failed after all retries, including the error details" → on-failure destination. "Chain another step after successful async invocation without modifying code" → on-success destination. If the question says the failure target must capture the error/response context, DLQ is the distractor.</div>

<h3>3. Event source mappings (Lambda polls <em>you</em>)</h3>
<p>For SQS, Kinesis Data Streams, DynamoDB Streams, MSK/Kafka, and DocumentDB change streams, no one pushes to Lambda. A Lambda-managed poller fleet (the <strong>event source mapping</strong>, ESM) reads the source, assembles batches, and invokes your function <em>synchronously</em> with each batch. Your function's error handling is therefore batch-level, and the source's own semantics dominate:</p>
<ul>
<li><strong>SQS:</strong> the ESM polls with long polling, scales pollers up as backlog grows, deletes messages only after a successful invoke. A failed batch reappears after the visibility timeout — so a single poison message can recycle an entire batch repeatedly until the queue's <code>maxReceiveCount</code> ships it to the queue's DLQ (note: the DLQ lives on the <em>queue</em> here, not on Lambda). For FIFO queues, the ESM respects message-group ordering: one group is processed by one batch at a time.</li>
<li><strong>Kinesis / DynamoDB Streams:</strong> ordering is per shard. By default one batch per shard is in flight (raise with parallelization factor, up to 10, which shards by partition key across concurrent batches while preserving per-key order). A failing record <strong>blocks the shard</strong> — the ESM retries the batch until the record expires (up to the stream retention) unless you set maximum retry attempts, maximum record age, on-failure destination, or <strong>bisect batch on function error</strong>, which binary-searches the batch to isolate the poison record.</li>
</ul>

<h3>Partial batch response</h3>
<p>By default a batch is all-or-nothing: throw on record 9 of 10 and all 10 come back (SQS) or the shard replays from the batch start (Kinesis). Enable <code>ReportBatchItemFailures</code> and return the failed message IDs / sequence numbers in <code>batchItemFailures</code>; Lambda then deletes/checkpoints the successes and redelivers only the failures. This is the single highest-value ESM setting and the exam's favorite "reduce duplicate processing from SQS batches" answer.</p>

<div class="callout deep">Batching has two triggers: batch size (count) and <strong>maximum batching window</strong> (up to 300 s) — the invoke fires when either the size, the window, or the 6 MB sync payload cap is hit. A small batching window on a low-traffic queue trades latency for fewer invokes; with SQS you pay for polling via SQS API requests, not for the ESM itself, so long polling plus batching is also a cost lever.</div>

<div class="callout war">SQS-to-Lambda plus reserved concurrency used to be a footgun: pollers would fetch messages, get throttled invoking the function, and the messages would burn a receive attempt — enough throttles and clean messages landed in the DLQ. <strong>Maximum concurrency</strong> on the SQS event source (settable down to 2) fixed this by throttling the pollers themselves; use it, not reserved concurrency, to limit SQS-driven fan-out. Also remember visibility timeout must exceed function timeout (AWS recommends 6x) or in-flight batches reappear while still processing — instant duplicates.</div>

<div class="callout limits">Sync payload limit <strong>6 MB</strong> request and response; async payload <strong>256 KB</strong>. Async retries: 2 (errors), up to 6 h (throttles). SQS batch up to 10,000 messages / 6 MB with standard queues; Kinesis parallelization factor up to 10 per shard.</div>
`
    },
    {
      id: "lambda-tuning",
      title: "Memory-proportional CPU, timeouts, /tmp, layers, and versioning",
      html: `
<p>Lambda exposes exactly one performance knob, and it is mislabeled. The <strong>memory setting (128 MB to 10,240 MB)</strong> allocates memory, CPU, and network proportionally: at <strong>1,769 MB you get the equivalent of one full vCPU</strong>; at 10 GB you get 6 vCPUs. Below ~1.8 GB you are running on a fraction of a core; above it, single-threaded runtimes (Node, Python without multiprocessing) largely stop benefiting because they cannot use the extra cores — CPU-bound single-threaded code plateaus around 1.8-3.5 GB.</p>

<h3>The cost/performance curve is not intuitive</h3>
<p>Billing is GB-seconds: memory × duration, per 1 ms. Doubling memory doubles the rate but often <em>more</em> than halves the duration for CPU-bound work — so the bigger setting is simultaneously faster and cheaper. The curve is U-shaped: undersized functions pay for long durations; oversized ones pay for idle cores. Do not guess — run <strong>AWS Lambda Power Tuning</strong> (an open-source Step Functions state machine) which invokes your function across memory settings and plots cost vs latency. Typical finding: the 128 MB "frugal" default is the most expensive configuration for anything CPU-bound. I/O-bound functions (mostly awaiting DynamoDB or HTTP) are the exception — they genuinely can sit at low memory cheaply.</p>

<div class="callout exam">"Function is slow / timing out and is CPU-bound — how to speed it up?" → increase memory (which increases CPU). There is no separate CPU setting; any option offering one is fake. "Optimize Lambda cost" with a compute-heavy workload → benchmark memory settings, not blindly minimize memory.</div>

<h3>Timeouts and /tmp</h3>
<p>Maximum timeout is <strong>15 minutes</strong>, default 3 seconds. Two traps: API Gateway historically cut sync integrations at 29 seconds regardless of the function's timeout (now raisable for REST APIs, at a cost to your throttle quota — details in the API Gateway lesson), and ESM-invoked functions should keep timeouts well under the source's visibility timeout. Anything legitimately longer than 15 minutes is not a Lambda — that's Fargate, Batch, or a Step Functions decomposition.</p>
<p><strong>/tmp</strong> gives you 512 MB free, configurable to <strong>10,240 MB</strong> (billed per GB-s above 512 MB). It is instance storage on the micro-VM: survives across invokes on the same warm environment (usable as a cache — check-then-download is a legit pattern), vanishes at shutdown, and is never shared between environments. For shared or larger-than-10 GB state, mount <strong>EFS</strong> (requires VPC attachment) or stream from S3.</p>

<h3>Layers</h3>
<p>Layers are additional ZIPs unpacked into <code>/opt</code>, up to <strong>5 per function</strong>, sharing the same <strong>250 MB unzipped total</strong> budget as your code. They are a packaging and reuse mechanism — shared libs, custom runtimes, the AWS-provided extensions like Parameters and Secrets caching — not a performance feature: a dependency in a layer downloads and initializes exactly like one in your ZIP. Their real value is operational: version shared dependencies independently of function code, and keep your own artifact small enough to edit in the console (under 3 MB) when debugging.</p>

<h3>Versions, aliases, and weighted routing</h3>
<p>Publishing a <strong>version</strong> snapshots code plus configuration immutably (version numbers monotonically increase; <code>$LATEST</code> is the mutable head). An <strong>alias</strong> is a named pointer to a version — <code>prod</code>, <code>canary</code> — and event sources and permissions should bind to aliases, never to $LATEST or raw version numbers. Aliases support <strong>weighted routing between exactly two versions</strong> (e.g., 95/5), which is the primitive under CodeDeploy's canary and linear Lambda deployment strategies: shift 5% for 10 minutes, watch a CloudWatch alarm, auto-rollback on breach. Note the routing is probabilistic per invoke, not sticky per client.</p>

<div class="callout deep">Provisioned concurrency and SnapStart both attach to versions/aliases, not $LATEST — another reason alias-based deployment is the only sane production posture. When an alias's weights shift, provisioned concurrency follows the alias configuration, so pre-warm the new version before shifting meaningful traffic.</div>

<h3>The limits table</h3>
<table>
<thead><tr><th>Dimension</th><th>Limit</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>Memory</td><td>128 MB – 10,240 MB</td><td>CPU scales with it; 1 vCPU ≈ 1,769 MB, max 6 vCPUs</td></tr>
<tr><td>Timeout</td><td>900 s (15 min)</td><td>Hard. Default 3 s</td></tr>
<tr><td>Deployment package</td><td>50 MB zipped, 250 MB unzipped</td><td>Includes layers. Container images: 10 GB</td></tr>
<tr><td>/tmp</td><td>512 MB free, up to 10 GB</td><td>Per environment, ephemeral</td></tr>
<tr><td>Payload (sync)</td><td>6 MB request/response</td><td>Async: 256 KB</td></tr>
<tr><td>Env variables</td><td>4 KB total</td><td>Use SSM/Secrets Manager beyond that</td></tr>
<tr><td>Account concurrency</td><td>1,000 default (soft)</td><td>Regional, shared across functions</td></tr>
<tr><td>Layers</td><td>5 per function</td><td>Count against 250 MB unzipped</td></tr>
</tbody>
</table>

<div class="callout war">The 4 KB env-var ceiling is hit constantly by teams stuffing config into environment variables; the fix (SSM Parameter Store with the caching extension layer) also removes secrets from plaintext env vars, which your security review wanted anyway. And watch container-image functions in CI: pushing a 10 GB image per commit makes ECR storage a line item.</div>
`
    },
    {
      id: "lambda-vpc-snapstart",
      title: "VPC-attached Lambda, Hyperplane ENIs, and SnapStart",
      html: `
<p>By default Lambda runs in an AWS-managed VPC with open internet egress and no route into your private network. Attaching a function to <em>your</em> VPC (you specify subnets and security groups) is required to reach RDS on private subnets, ElastiCache, EFS, or anything behind internal DNS. How that attachment works changed fundamentally in 2019, and the exam still loves testing whether you know the old pain is gone.</p>

<h3>Hyperplane ENIs: the cold-start myth is dead</h3>
<p>The old model created an ENI in your subnet <strong>per execution environment</strong> — cold starts of 10+ seconds while EC2 attached ENIs, plus real risk of exhausting subnet IPs or your ENI quota under scale-out. The current model uses <strong>Hyperplane ENIs</strong>: Lambda creates a small number of shared ENIs per unique (subnet × security group) combination <em>when the function is created or its VPC config changes</em>, and execution environments tunnel through them (NAT-style multiplexing on Hyperplane, the same internal L4 fabric behind NLB and PrivateLink). Consequences:</p>
<ul>
<li>ENI creation cost moved from invoke time to <strong>deploy time</strong> — the first deploy can take a minute or two while ENIs materialize, but cold starts are within tens of milliseconds of non-VPC functions.</li>
<li>ENI count scales with distinct subnet/SG combinations, not with concurrency. IP exhaustion from Lambda is essentially solved (still: give Lambda its own small dedicated subnets for blast-radius hygiene).</li>
<li>If an answer choice on the exam justifies avoiding VPC attachment "because of ENI cold-start latency," it is testing whether your knowledge is from 2018.</li>
</ul>

<h3>What VPC attachment still costs you</h3>
<p>A VPC-attached function <strong>loses default internet access</strong>. Its traffic follows your subnet's route table, so egress to public APIs or non-gateway AWS endpoints needs a <strong>NAT gateway</strong> (in a public subnet, with the Lambda in private subnets) — and NAT gateways bill per hour and per GB processed, which at Lambda scale is real money. Cheaper routes: <strong>VPC gateway endpoints</strong> for S3 and DynamoDB (free), and <strong>interface endpoints</strong> for other AWS services (cheaper than NAT for heavy traffic to that one service). Never put a VPC Lambda in a public subnet expecting internet: Lambda ENIs get no public IPs, so an IGW route does nothing for them.</p>

<div class="callout exam">Pattern: "VPC Lambda cannot call an external API / S3" → add NAT gateway, or a gateway endpoint if the destination is S3/DynamoDB (the endpoint is the cost-optimized correct answer when offered). "Lambda must access RDS in private subnet" → attach to VPC, SG-to-SG rule from Lambda's SG to the DB's SG on 5432/3306.</div>

<div class="callout war">The database connection storm: 500 concurrent environments each opening its own Postgres connection will flatten a db.t3.medium (connection slots are memory-bounded). Per-environment client reuse helps but does not cap the total. The real fix is <strong>RDS Proxy</strong> — a connection pool that multiplexes thousands of Lambda-side connections onto a few dozen DB connections, and absorbs failover — or moving hot paths to DynamoDB. Aurora Serverless's Data API (HTTP, connectionless) is another exam-visible answer.</div>

<h3>SnapStart: checkpointing away the JVM tax</h3>
<p><strong>SnapStart</strong> attacks the worst cold-start offenders (JVM ~ multi-second inits; now also .NET and Python) with a checkpoint/restore trick: when you publish a version, Lambda runs the <em>entire init phase once</em>, then snapshots the full micro-VM — memory and disk — using Firecracker's snapshotting (CRIU-like semantics at the VM level). The encrypted snapshot goes to a tiered cache; a cold start becomes <strong>resume-from-snapshot</strong>, typically cutting multi-second Java inits to a few hundred milliseconds. It is free for Java (Python/.NET bill for cache and restores), but it has sharp edges a senior engineer should predict from the mechanism:</p>
<ul>
<li><strong>Uniqueness breaks.</strong> Anything derived during init — RNG seeds, UUIDs, timestamps, machine IDs — is baked into the snapshot and resumed <em>identically in every environment</em>. Crypto libraries had to add resume hooks; your own "unique instance ID generated at startup" is now cloned. Runtime hooks (beforeCheckpoint/afterRestore, via CRaC in Java) exist to re-seed state.</li>
<li><strong>Network connections and temp credentials</strong> established during init are stale on restore — reconnect in an afterRestore hook or lazily.</li>
<li>Requires a published <strong>version</strong>; incompatible with provisioned concurrency (they solve the same problem differently — snapshot-restore vs always-warm), and historically with EFS and 10 GB /tmp configurations.</li>
</ul>

<div class="callout deep">Why SnapStart instead of just provisioned concurrency? Cost shape. Provisioned concurrency bills for warm capacity 24/7 whether used or not — you are paying to pre-solve cold starts for a <em>predicted</em> concurrency. SnapStart pays a one-time init per version plus fast restores at any concurrency, so it wins for spiky or unpredictable Java traffic; provisioned concurrency wins for steady, latency-critical floors (and works on any runtime).</div>

<div class="callout limits">VPC ENIs: created per subnet×SG combo at configure time; allow minutes for propagation. SnapStart: Java, Python, .NET runtimes on published versions/aliases only; no provisioned-concurrency combo. RDS Proxy adds single-digit ms per query — the price of not falling over.</div>
`
    },
    {
      id: "api-gateway-types",
      title: "API Gateway: REST vs HTTP APIs, WebSockets, and endpoint types",
      html: `
<p>API Gateway is a managed front door: TLS termination, routing, auth, throttling, and protocol transformation in front of Lambda, HTTP backends, or AWS services directly. The catch is that "API Gateway" is really three products with different feature sets and price tags, and the SAA exam mines the differences relentlessly.</p>

<h3>REST API vs HTTP API — the comparison the exam loves</h3>
<p><strong>HTTP APIs</strong> are the v2, rebuilt-on-a-leaner-data-plane offering: roughly <strong>70% cheaper</strong> (about 1.00 vs 3.50 USD per million requests at the first tier) and measurably lower latency. They cover the 90% case: JWT auth, Lambda and HTTP proxy integrations, CORS, custom domains. <strong>REST APIs</strong> (v1) keep the long tail of enterprise features. Memorize this table:</p>
<table>
<thead><tr><th>Capability</th><th>HTTP API</th><th>REST API</th></tr></thead>
<tbody>
<tr><td>Price / latency</td><td>~70% cheaper, faster</td><td>Higher</td></tr>
<tr><td>Native JWT/OIDC authorizer</td><td>Yes (built-in)</td><td>No (use Cognito or Lambda authorizer)</td></tr>
<tr><td>Lambda + IAM auth</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Usage plans + API keys</td><td><strong>No</strong></td><td>Yes</td></tr>
<tr><td>Response caching</td><td><strong>No</strong></td><td>Yes (0.5–237 GB cache)</td></tr>
<tr><td>Request/response transformation (VTL mapping templates)</td><td>No (proxy-style only)</td><td>Yes</td></tr>
<tr><td>Request validation, WAF, X-Ray, canary stages</td><td>Limited/No</td><td>Yes</td></tr>
<tr><td>Endpoint types</td><td>Regional only</td><td>Edge-optimized, Regional, Private</td></tr>
<tr><td>Direct AWS service integrations</td><td>A curated set (SQS, SNS, Step Functions, Kinesis, EventBridge…)</td><td>Any service via VTL</td></tr>
</tbody>
</table>
<p>Decision rule: default to HTTP API; you are forced to REST by <em>usage plans/API keys (monetized or per-client-throttled APIs), caching, mapping templates, private endpoint type, or WAF</em>. The exam phrases it as "most cost-effective" (→ HTTP API) versus a requirement list containing one REST-only feature (→ REST API).</p>

<h3>WebSocket APIs</h3>
<p>The third product holds long-lived WebSocket connections for you and turns frames into Lambda invocations via three routes: <code>$connect</code>, <code>$disconnect</code>, <code>$default</code> plus custom routes selected by a JSON field in the message (the route selection expression). Server-to-client push works through a management API: you POST to the <code>@connections</code> endpoint with the connection ID — which means <em>you must persist connection IDs</em> (DynamoDB is the standard pattern, keyed by user/room) because your backend is stateless while the connections are not. Billing is per million messages plus per connection-minute. Idle connections drop at 10 minutes without traffic; hard cap 2 hours. For massive fan-out chat/live-data, compare with AppSync subscriptions or IoT Core, which manage the fan-out state for you.</p>

<h3>Endpoint types (REST APIs)</h3>
<ul>
<li><strong>Edge-optimized</strong> (old default): API Gateway fronts itself with a managed CloudFront distribution — TLS terminates at the nearest POP, riding the AWS backbone to the API's region. Good for geographically scattered clients; you do not control that CloudFront layer.</li>
<li><strong>Regional:</strong> plain regional endpoint. Choose it when clients are in-region, or when you want your <em>own</em> CloudFront distribution in front (with your own cache behaviors and WAF), or for latency-based multi-region routing with Route 53. Stacking edge-optimized behind your own CloudFront is a known anti-pattern (double CDN hop).</li>
<li><strong>Private:</strong> reachable only through an interface VPC endpoint; a resource policy pins which VPCs/endpoints may call it. This is the answer for "internal-only API, no traversal of the public internet."</li>
</ul>

<h3>Integration types and the 29-second wall</h3>
<p>Integrations: <strong>Lambda proxy</strong> (the whole request as an event; your function returns status/headers/body — the default choice), <strong>Lambda custom</strong> (VTL mapping templates rewrite request/response — powerful, and a maintenance tarpit), <strong>HTTP proxy/custom</strong> (pass-through to any HTTP backend, e.g., an ALB), <strong>AWS service</strong> (call SQS/SNS/Step Functions/DynamoDB <em>directly, with no Lambda in the middle</em> — the cost-and-latency optimization the exam rewards: "ingest webhook payloads into SQS with the least infrastructure" → API Gateway service integration straight to SQS), and <strong>mock</strong> (respond from templates, for stubs and CORS preflights).</p>

<div class="callout limits">The integration timeout: default maximum <strong>29 seconds</strong> on every API type. Your Lambda can run 15 minutes; API Gateway will still return a 504 at 29 s. Since mid-2024 REST APIs can raise it beyond 29 s (regional/private, and it may require reducing your account-level requests-per-second quota — a real trade), but the architectural answer to long work behind an API is still: return 202, run async (SQS + worker, or Step Functions), poll or push the result. Other numbers: 10,000 RPS default account throttle (soft), burst 5,000; 10 MB payload cap; 30 s is <em>not</em> the Lambda limit — do not conflate.</div>

<div class="callout war">The 29 s gotcha in the wild: a report endpoint works in dev (small data, 8 s), then 504s in prod at second 29 while the Lambda happily completes at second 40 — billed, effects applied, response discarded. Clients retry, the report generates twice. If a sync endpoint can ever exceed ~20 s, make it async before launch, not after the incident.</div>

<div class="callout exam">Keyword map: "reduce API cost, simple Lambda proxy + JWT" → HTTP API. "API keys for third-party developers with rate limits per key" → REST + usage plans. "cache backend responses" → REST + stage cache. "API must not be reachable from the internet" → private endpoint + interface endpoint. "clients worldwide, lowest latency" → edge-optimized (or your own CloudFront + regional).</div>
`
    },
    {
      id: "api-gateway-auth-throttling",
      title: "API Gateway auth, throttling, usage plans, and caching",
      html: `
<p>API Gateway's control features are where REST APIs earn their price premium. The auth options in particular form a neat decision tree the exam walks constantly.</p>

<h3>The four auth options</h3>
<ul>
<li><strong>IAM (SigV4):</strong> callers sign requests with AWS credentials; API Gateway authenticates the signature and authorizes against IAM policies (plus optional resource policies on the API). Zero extra infrastructure, full IAM policy expressiveness, and credentials can come from roles — the right answer whenever the caller is <em>inside your AWS estate</em> (services, EC2, other accounts via cross-account roles). Wrong for browsers and third parties: nobody hands SigV4 to the public.</li>
<li><strong>Cognito user pool authorizer (REST):</strong> API Gateway validates a JWT issued by a specific user pool — signature, expiry, audience — before invoking the backend. Cheap, no code. But it only proves <em>authentication</em>; fine-grained authorization (which resources this user may touch) still lives in your backend or requires groups/claims checks there. On HTTP APIs the equivalent is the generic <strong>JWT authorizer</strong>, which works with any OIDC issuer — Cognito, Auth0, Okta.</li>
<li><strong>Lambda authorizer</strong> (née custom authorizer): API Gateway invokes your function with the token (TOKEN type) or the whole request context (REQUEST type — headers, query, source IP); you return an IAM policy document plus optional context. This is the escape hatch for anything bespoke: opaque tokens needing introspection, legacy SSO, API-key-plus-tenant lookups, mTLS claim mapping. It costs a Lambda invoke per request — unless you set the <strong>authorizer result cache (TTL up to 1 hour, default 300 s)</strong>, which caches the returned policy keyed by the token/identity sources. Cache design is a security decision: cache key granularity determines whether a revoked token keeps working for up to TTL seconds.</li>
<li><strong>Resource policies + mTLS:</strong> resource policies gate by source VPC/VPC endpoint, IP CIDR, or account — mandatory for private APIs, useful as a coarse allowlist. Mutual TLS on custom domains authenticates clients by certificate — the pattern for B2B/webhook partners.</li>
</ul>

<div class="callout exam">Decision tree as the exam sees it: internal AWS callers → IAM. Mobile/web users with a user directory → Cognito authorizer (or JWT authorizer on HTTP API). Third-party/custom/legacy token scheme → Lambda authorizer, and "reduce authorizer latency/cost" → enable authorizer caching. "Restrict API to a specific VPC" → resource policy + private endpoint. API keys alone are <strong>never</strong> the security answer — they are for metering, and the exam plants them as a distractor for authentication.</div>

<h3>Throttling: the token buckets, stacked</h3>
<p>Every request passes a hierarchy of token buckets: the account-level regional limit (default <strong>10,000 rps, burst 5,000</strong> — soft), per-stage and per-method throttles you configure, and per-client throttles via usage plans. When any bucket empties: <strong>429 Too Many Requests</strong>, which well-behaved clients (and the AWS SDKs) retry with backoff. Throttling is your API's pressure-relief valve; per-method throttles also serve as blast-radius control so one hot endpoint cannot starve the stage.</p>

<h3>Usage plans and API keys (REST only)</h3>
<p>A <strong>usage plan</strong> binds API stages to a throttle (rate + burst) and a <strong>quota</strong> (requests per day/week/month); <strong>API keys</strong> identify clients and attach to plans. This is the productized-API stack: bronze partners get 10 rps and 100k/month, gold gets 100 rps and 10M. Keys travel in the <code>x-api-key</code> header. Two things seniors should insist on: keys are identifiers, not secrets-grade credentials — pair them with real auth; and key distribution/rotation is on you (or via the SaaS-ish integration with AWS Marketplace metering).</p>

<h3>Caching (REST only)</h3>
<p>Stage-level response cache, <strong>0.5 GB to 237 GB</strong>, TTL 0-3600 s (default 300), billed <em>per hour by cache size</em> — this is a provisioned Redis-ish appliance, not a request-priced feature, and the larger sizes cost real money. Cache keys are the method+path plus whichever headers/query strings you explicitly mark as cache key parameters — forget to include the parameter that varies the response and you will serve user A's data to user B (a genuine incident class, not a hypothetical). Per-key invalidation is possible; clients can send <code>Cache-Control: max-age=0</code> to bypass, and you choose whether that requires IAM authorization (leave it unauthenticated and anyone can stampede your backend past the cache).</p>

<div class="callout war">Authorizer cache + coarse identity source is a recurring pentest finding: a REQUEST authorizer caching only on the Authorization header returns the same policy for every path for TTL seconds — so a user authorized for GET /me gets a cached Allow that also matches DELETE /admin if your policy was written with a wildcard resource. Return least-privilege, specific-resource policies from Lambda authorizers, or set the policy resource to the requested ARN and keep TTL short.</div>

<div class="callout limits">Authorizer cache TTL max <strong>3600 s</strong>. Stage cache TTL max <strong>3600 s</strong>, size max <strong>237 GB</strong>, priced hourly. Account throttle default <strong>10,000 rps / 5,000 burst</strong> (regional, shared by all APIs in the account — one noisy API can throttle its siblings; fix with per-stage limits). Usage plan quotas: day/week/month granularity.</div>
`
    },
    {
      id: "step-functions-core",
      title: "Step Functions: Standard vs Express, states, and error handling",
      html: `
<p>Step Functions is a managed, durable state machine engine: you declare a workflow in Amazon States Language (JSON), and the service executes it, persisting every state transition so the workflow survives node failures, deploys, and (in Standard mode) up to a year of wall-clock time. The mental model for a senior engineer: it replaces the hand-rolled "orchestration table plus cron sweeper plus idempotent workers" pattern you have built at least once — the state persistence, retries, and audit history are the product.</p>

<h3>Standard vs Express — the fundamental fork</h3>
<table>
<thead><tr><th></th><th>Standard</th><th>Express</th></tr></thead>
<tbody>
<tr><td>Max duration</td><td><strong>1 year</strong></td><td><strong>5 minutes</strong></td></tr>
<tr><td>Execution semantics</td><td><strong>Exactly-once</strong> state transitions</td><td><strong>At-least-once</strong> (async type); sync is at-most-once</td></tr>
<tr><td>Pricing dimension</td><td>Per <strong>state transition</strong> (~25 USD per million)</td><td>Per <strong>request + GB-second duration</strong> (orders of magnitude cheaper at volume)</td></tr>
<tr><td>Rate</td><td>~2,000 executions/s start rate</td><td>100,000+ executions/s</td></tr>
<tr><td>History/debugging</td><td>Full execution history in the API/console, 90 days</td><td>CloudWatch Logs only</td></tr>
<tr><td>Callbacks (.waitForTaskToken)</td><td>Yes</td><td>No</td></tr>
<tr><td>Fit</td><td>Long-running, human-in-loop, auditable business workflows</td><td>High-volume, short event processing and IoT/streaming transforms</td></tr>
</tbody>
</table>
<p>The semantics difference is not a footnote: Express asynchronous executions can run a state <em>twice</em> — your tasks must be idempotent, exactly like SQS standard consumers. Standard's exactly-once transition guarantee is what lets you safely orchestrate non-idempotent side effects (charge card, then ship). Pricing shape flips the decision at scale: a Standard workflow with 20 transitions costs ~0.0005 USD per execution — negligible until you run 100 million executions a month, at which point Express (paying for milliseconds of duration instead) is dramatically cheaper. Exam phrasing: "runs for hours/days, needs audit trail, human approval" → Standard; "millions of short executions per hour, cost-sensitive, sub-5-minute" → Express. You can nest them: a Standard parent orchestrating Express children gets long-running audit at the top and cheap volume at the leaves.</p>

<h3>State types</h3>
<ul>
<li><strong>Task</strong> — do work: invoke Lambda, call one of 220+ services via SDK integrations, or hand work to an activity worker.</li>
<li><strong>Choice</strong> — branch on the state's JSON input (comparison operators, boolean logic). No work, just routing.</li>
<li><strong>Parallel</strong> — run fixed branches concurrently; output is the array of branch outputs; one branch failing (unhandled) fails the whole state.</li>
<li><strong>Map</strong> — for-each over an array in the input (dynamic fan-out; more next lesson).</li>
<li><strong>Wait</strong> — pause for N seconds or until a timestamp — up to a year, costing nothing while suspended (this is the killer feature vs holding a Lambda open: never sleep in a Lambda you could Wait in).</li>
<li><strong>Pass</strong> — inject/reshape data without work; <strong>Succeed/Fail</strong> — terminal states.</li>
</ul>
<p>Data flows through each state via JSONPath filters — InputPath, Parameters, ResultPath, ResultSelector, OutputPath (or the newer JSONata mode) — and the whole payload between states caps at <strong>256 KB</strong>. Big artifacts never ride the state machine: pass S3 pointers, not blobs.</p>

<h3>Error handling: Retry and Catch, declaratively</h3>
<p>Every Task (and Parallel/Map) can declare <strong>Retry</strong> policies: match on error names (custom errors, or built-ins like States.Timeout, States.TaskFailed, States.ALL as the catch-all), with <code>IntervalSeconds</code>, <code>MaxAttempts</code>, <code>BackoffRate</code> (exponential multiplier), and optionally MaxDelaySeconds and JitterStrategy. Retriers are evaluated in order; first match wins. <strong>Catch</strong> clauses fire after retries exhaust, routing to a fallback state with the error object injected via ResultPath — so the original input is preserved alongside the error. This moves retry/backoff/jitter logic out of application code into the workflow definition, where it is visible, versioned, and consistent.</p>

<div class="callout deep">Two timeout knobs on Task states matter in production: <code>TimeoutSeconds</code> (how long the task may run — <strong>default is effectively none for service integrations</strong>, meaning a hung callback task waits a year unless you set it) and <code>HeartbeatSeconds</code> for long tasks that should check in periodically. An unset TimeoutSeconds on a .waitForTaskToken task whose downstream died is the classic "zombie execution" — always set timeouts on callback tasks.</div>

<div class="callout exam">Trigger phrases: "coordinate multiple Lambda functions with retries and error handling, without writing orchestration code" → Step Functions (vs the distractor of chaining Lambdas via async invokes or SQS glue). "Workflow exceeds 15-minute Lambda limit" → Step Functions decomposition (or .sync to a Fargate task). "Exactly-once, one-year, audit" → Standard. "At-least-once acceptable, huge volume, short" → Express.</div>

<div class="callout war">The 256 KB payload limit arrives in production as States.DataLimitExceeded midway through a workflow that passed testing — usually a Map state aggregating results. Design the S3-pointer convention on day one. Also: Standard pricing is per transition, so a tight polling loop (Wait 10 s → Check → Choice → back) with a long-running job burns transitions; prefer .sync integrations or callbacks over polling loops when possible.</div>
`
    },
    {
      id: "step-functions-patterns",
      title: "Integration patterns, Map fan-out, sagas — and when serverless is wrong",
      html: `
<p>Step Functions' service integrations come in three call patterns, and choosing among them is most of the craft of designing a workflow.</p>

<h3>The three integration patterns</h3>
<ul>
<li><strong>Request-response</strong> (default): call the service, get the API response, move on immediately. Calling StartExecution or ecs:runTask this way means "fire it and proceed" — the workflow does <em>not</em> wait for the job to finish, a mistake everyone makes exactly once.</li>
<li><strong>Run a job (.sync)</strong>: append <code>.sync</code> to the resource ARN and Step Functions submits the job, then <em>waits for completion</em>, internally polling or consuming EventBridge events — supported for ECS/Fargate tasks, AWS Batch, Glue, EMR, CodeBuild, nested state-machine executions, and more. This is how a workflow runs a 3-hour Fargate container as a single Task state. (Standard workflows only.)</li>
<li><strong>Callback (.waitForTaskToken)</strong>: Step Functions generates a <strong>task token</strong>, passes it into the task's input (you must explicitly place it with a JSONPath reference to the token in Parameters), and then suspends — costing nothing — until something calls <code>SendTaskSuccess</code> or <code>SendTaskFailure</code> with that token. This is the human-approval pattern, the "wait for an external system's webhook" pattern, and the "hand a message to SQS and wait for the consumer to confirm" pattern. Pair with HeartbeatSeconds/TimeoutSeconds so lost tokens do not become year-long zombies. Standard only.</li>
</ul>

<div class="callout exam">"Pause the workflow until a manager approves" or "wait for an external/legacy system to confirm" → .waitForTaskToken. "Run a containerized batch job as part of the workflow and continue when it finishes" → .sync. If the option shows a Lambda polling in a loop for job status, it is the expensive distractor.</div>

<h3>Map and Distributed Map: fan-out</h3>
<p>The classic <strong>inline Map</strong> iterates a workflow fragment over an array in the payload, with <code>MaxConcurrency</code> capping parallelism (~40 practical concurrency, and everything still squeezes through the 256 KB payload). <strong>Distributed Map</strong> changes category: it reads its dataset directly from <strong>S3</strong> (a JSON/CSV manifest, or an S3 prefix listing of objects), runs each item as a <em>separate child workflow execution</em> (which can be Express for cost) at up to <strong>10,000 concurrent</strong> child executions, batches items per child, tolerates a configured failure percentage, and writes results back to S3. It is Step Functions' answer to "serverless map-reduce over millions of objects" — the kind of job you would otherwise reach to EMR or Batch for. Exam phrasing: "process millions of S3 objects in parallel with a serverless service" → Distributed Map.</p>

<h3>The saga pattern</h3>
<p>Distributed transactions across services (reserve inventory → charge payment → create shipment) cannot two-phase-commit; the saga pattern replaces atomicity with <strong>compensating actions</strong>. Step Functions is the natural saga coordinator: each forward Task carries a Catch that routes to the compensation chain (refund payment → release inventory → mark order failed), and Standard's exactly-once transitions plus the execution history give you a durable, auditable record of exactly how far each transaction got. Model compensations as first-class states with their own Retry policies — a compensation that fails silently is how you double-charge someone and never find out.</p>

<h3>Rounding out the toolbox: SAM and AppSync</h3>
<p><strong>SAM</strong> (Serverless Application Model) is a CloudFormation transform: shorthand resource types (AWS::Serverless::Function, ::Api, ::Table) that expand to full CFN, plus a CLI — <code>sam build</code>, <code>sam local invoke</code> for local Lambda emulation in Docker, <code>sam deploy</code>, and built-in CodeDeploy canary wiring for the alias-shifting deployments from the versioning lesson. Know it as "CloudFormation-native serverless tooling"; CDK is the general-purpose alternative.</p>
<p><strong>AppSync</strong> is managed GraphQL: schema-first, with resolvers mapping fields to DynamoDB, Lambda, Aurora, HTTP, or OpenSearch data sources; it can merge multiple backends into one graph. Its differentiator is <strong>subscriptions</strong> — managed WebSocket fan-out where clients subscribe to mutations and AppSync handles connection state and broadcast at scale, which is materially less work than the raw API Gateway WebSocket pattern of DynamoDB-tracked connection IDs. Exam cue: "GraphQL" or "real-time collaborative/offline-sync mobile data" → AppSync.</p>

<h3>When serverless is the WRONG answer</h3>
<p>A senior architect earns their title mostly by knowing this list:</p>
<ul>
<li><strong>Steady, high, predictable load.</strong> Lambda's per-ms premium buys elasticity you are not using; a flat 24/7 workload at meaningful scale is cheaper on Fargate or EC2 with Savings Plans, often by 5-10x.</li>
<li><strong>Long-lived or stateful processes:</strong> anything over 15 minutes, WebSocket-ish servers holding state, in-memory caches, GPU inference — wrong shape. (Batch, ECS, EC2.)</li>
<li><strong>Hard p99 latency floors:</strong> even with provisioned concurrency you own more variance than a warm fleet behind an NLB.</li>
<li><strong>Connection-hungry consumers of relational databases</strong> without RDS Proxy discipline.</li>
<li><strong>Very high sustained throughput per dollar</strong> (millions of rps): the request-pricing of API Gateway + Lambda dwarfs an ALB + container fleet; ALB-to-Lambda or plain containers win.</li>
<li><strong>Portability/regulatory constraints</strong> where deep coupling to proprietary event formats is a real cost.</li>
</ul>

<div class="callout war">The classic cost surprise is not Lambda — it is the retinue: API Gateway per-request pricing, NAT gateway GB charges from VPC functions, CloudWatch Logs ingestion from debug-level logging at scale, and provisioned concurrency left allocated on a dead canary alias. Serverless bills are death by a thousand line items; tag and budget-alarm from day one.</div>

<div class="callout limits">Distributed Map: 10,000 concurrent child executions, S3-scale input. Inline Map: payload-bound, ~40 concurrency. SAM local: emulation only — IAM and service limits are not simulated; do not trust sam local for authorization testing.</div>
`
    }
  ],
  quiz: [
    {
      q: "A payments API built on API Gateway (REST) and Lambda intermittently returns 504 errors on a report-generation endpoint. CloudWatch shows the Lambda completing successfully in 40-60 seconds. What is the root cause and the best architectural fix?",
      options: [
        "The Lambda timeout is too low; raise it to 90 seconds",
        "API Gateway's 29-second integration timeout is expiring; convert the endpoint to an asynchronous pattern that returns 202 and delivers results separately",
        "The Lambda is running out of memory; increase the memory allocation",
        "API Gateway throttling is rejecting requests; raise the account-level rate limit"
      ],
      answer: [1],
      multi: false,
      explanation: "The Lambda completes in 40-60 s but API Gateway's default maximum integration timeout is <strong>29 seconds</strong> — the gateway returns 504 while the function keeps running (and billing, and applying side effects). The durable fix is an async pattern: return 202 immediately, do the work via SQS + worker or Step Functions, and let the client poll or receive a push. <strong>A</strong> is wrong: the function is not timing out — it succeeds. <strong>C</strong> is wrong for the same reason; memory errors would surface as function errors, not gateway 504s. <strong>D</strong> is wrong: throttling produces 429, not 504. (Note: REST APIs can now raise the 29 s cap, but it may cost account throttle quota, and long-synchronous HTTP is still the fragile design.)"
    },
    {
      q: "A company runs 30 Lambda functions in one account and region. During a marketing event, an async image-processing function scaled out and consumed nearly all available concurrency, causing the customer-facing checkout function to be throttled. Which change prevents recurrence at no additional cost?",
      options: [
        "Configure provisioned concurrency on the checkout function",
        "Configure reserved concurrency on the checkout function to guarantee it capacity, and optionally cap the image processor with its own reservation",
        "Move the image-processing function to a different Availability Zone",
        "Enable SnapStart on the checkout function"
      ],
      answer: [1],
      multi: false,
      explanation: "Reserved concurrency carves a guaranteed slice out of the shared 1,000-per-region pool: the checkout function always has capacity, and a reservation on the image processor also caps its maximum. Reserved concurrency is <strong>free</strong> — you still pay only per invoke. <strong>A</strong> would work for warmth but costs money per GB-hour while allocated, and the question asks for no additional cost; also the core problem is pool starvation, which reservation solves directly. <strong>C</strong> is meaningless — Lambda concurrency is regional, not zonal. <strong>D</strong> addresses cold-start latency, not throttling."
    },
    {
      q: "An SQS standard queue triggers a Lambda function with batch size 10. When a single malformed message is in a batch, the entire batch returns to the queue and all 10 messages are reprocessed, causing duplicate side effects. Which TWO changes most directly address this? (Select TWO.)",
      options: [
        "Enable ReportBatchItemFailures on the event source mapping and return the failed message IDs from the function",
        "Configure a dead-letter queue on the source queue with an appropriate maxReceiveCount so the poison message is eventually removed",
        "Switch the queue to FIFO to prevent duplicates",
        "Increase the batch size to 100 to amortize failures",
        "Set the function's reserved concurrency to 1"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<strong>A</strong> (partial batch response) makes Lambda delete the successful messages and redeliver only the reported failures — eliminating the reprocess-the-whole-batch behavior. <strong>B</strong> ensures the poison message itself, after maxReceiveCount failed receives, moves to a DLQ for offline inspection instead of cycling forever. Together they are the canonical poison-pill pattern. <strong>C</strong> is wrong: FIFO deduplication addresses producer-side duplicates, not redelivery of failed batches — and at-least-once redelivery on failure is inherent to both queue types. <strong>D</strong> makes the blast radius worse (bigger batches recycled). <strong>E</strong> throttles throughput and does nothing about batch failure semantics."
    },
    {
      q: "A Java-based Lambda function serving unpredictable, spiky traffic suffers 4-6 second cold starts. Traffic can go from zero to hundreds of concurrent requests with no warning, and the team wants to minimize both latency and standing cost. What should they use?",
      options: [
        "Provisioned concurrency set to the maximum expected concurrency",
        "SnapStart on a published function version",
        "An EventBridge rule that pings the function every 5 minutes to keep it warm",
        "Increase the memory allocation to 10 GB to speed up initialization"
      ],
      answer: [1],
      multi: false,
      explanation: "SnapStart checkpoints the fully initialized micro-VM at version-publish time and resumes cold starts from the snapshot, cutting multi-second JVM inits to sub-second — with no per-hour standing cost for Java, and it works at any concurrency, which suits unpredictable spikes. <strong>A</strong> works but charges GB-hours 24/7 for peak capacity that is rarely used — exactly what the question excludes. <strong>C</strong> is the folk remedy: it keeps a handful of environments warm but does nothing when traffic jumps to hundreds of concurrent requests, each new environment cold-starting. <strong>D</strong> helps somewhat (init CPU scales with memory) but cannot remove the JVM startup tail and raises per-invoke cost permanently."
    },
    {
      q: "A Lambda function was attached to private subnets to reach an RDS PostgreSQL instance. Since then, its calls to a third-party HTTPS API fail with timeouts, though database access works. What is the cause and fix?",
      options: [
        "VPC-attached functions lose default internet egress; route the private subnets through a NAT gateway in a public subnet",
        "The Hyperplane ENIs add too much latency; move the function back out of the VPC",
        "The function's security group blocks outbound HTTPS; add an outbound rule for port 443",
        "Attach the function to a public subnet and enable auto-assign public IP"
      ],
      answer: [0],
      multi: false,
      explanation: "Attaching Lambda to your VPC replaces its default managed egress with your subnets' route tables — private subnets have no internet path, so external HTTPS calls time out. The fix is a NAT gateway (or NAT instance) in a public subnet with a route from the Lambda subnets. <strong>B</strong> is 2018 lore: Hyperplane ENIs add negligible latency and the DB requirement forces VPC attachment anyway. <strong>C</strong> is unlikely: security groups are allow-all outbound by default, and the DB connection works, showing egress within the VPC is fine. <strong>D</strong> does not work — Lambda ENIs never receive public IPs, so a public subnet plus IGW still provides no internet path for the function."
    },
    {
      q: "An architect must expose a low-latency JSON API backed by Lambda. Requirements: JWT authentication against an existing OIDC provider (Okta), lowest possible per-request cost, no response caching or API keys needed. Which API Gateway option fits best?",
      options: [
        "REST API with a Lambda authorizer validating the Okta JWT",
        "HTTP API with a built-in JWT authorizer configured for the Okta issuer",
        "REST API edge-optimized with a Cognito user pool authorizer",
        "WebSocket API with IAM authorization"
      ],
      answer: [1],
      multi: false,
      explanation: "HTTP APIs are ~70% cheaper and lower-latency than REST APIs and include a <strong>native JWT authorizer</strong> that validates tokens from any OIDC issuer (Okta included) with zero custom code — a perfect match since no REST-only feature (usage plans, caching, VTL transforms) is required. <strong>A</strong> works but pays the REST premium plus a Lambda authorizer invoke per request for something HTTP APIs do natively. <strong>C</strong> requires migrating identity into Cognito or federating — extra moving parts the requirements don't ask for. <strong>D</strong> is the wrong protocol entirely for a request/response JSON API."
    },
    {
      q: "A REST API uses a Lambda authorizer with a 60-minute result cache TTL keyed on the Authorization header. Security review flags that after a user's permissions are revoked, they retain access for up to an hour. The team must reduce this window without invoking the authorizer on every request. What is the best adjustment?",
      options: [
        "Disable the authorizer cache entirely",
        "Reduce the authorizer cache TTL to a short interval such as 5 minutes, balancing revocation latency against authorizer invocations",
        "Switch to API keys with a usage plan",
        "Enable API Gateway response caching so revoked users get cached responses"
      ],
      answer: [1],
      multi: false,
      explanation: "The authorizer result cache trades revocation latency for cost/latency: a short TTL (e.g., 300 s) bounds the exposure window while still absorbing the vast majority of authorizer invocations. <strong>A</strong> meets the security goal but violates the stated constraint of not invoking the authorizer on every request. <strong>C</strong> is a metering feature, not authentication/authorization — a classic exam distractor. <strong>D</strong> is nonsense in context: response caching serves backend responses and has nothing to do with revoking authorization; it would actually prolong data exposure."
    },
    {
      q: "A workflow processes insurance claims: it can take up to two weeks because it pauses for a human adjuster's approval, must never execute the payment step twice, and auditors require a full history of every step. Which orchestration choice is correct?",
      options: [
        "Step Functions Express workflow with a Lambda polling loop for approval status",
        "Step Functions Standard workflow using a callback task with .waitForTaskToken for the approval step",
        "A chain of Lambda functions connected by SQS queues with a DynamoDB table tracking state",
        "EventBridge Scheduler invoking a Lambda every hour to check claim state"
      ],
      answer: [1],
      multi: false,
      explanation: "Three requirements map directly to Standard workflows: up to <strong>1 year</strong> duration (two weeks fits; Express caps at 5 minutes), <strong>exactly-once</strong> state transitions (payment must not run twice; Express async is at-least-once), and full execution history for audit. The human approval is the textbook <strong>.waitForTaskToken</strong> callback — the workflow suspends at no cost until SendTaskSuccess is called with the token. <strong>A</strong> fails on duration (5 min max), semantics (at-least-once), and no callback support in Express. <strong>C</strong> is the hand-rolled orchestrator Step Functions replaces — possible, but you own idempotency, retries, sweepers, and audit. <strong>D</strong> is polling glue with no execution history or exactly-once guarantee."
    },
    {
      q: "A telemetry pipeline must run a short transformation workflow (4 Lambda steps, under 30 seconds total) for roughly 80 million events per month. Duplicate processing is tolerable because writes are idempotent. Cost is the primary concern. Which workflow type should be used?",
      options: [
        "Step Functions Standard workflows, one execution per event",
        "Step Functions Express workflows, one execution per event",
        "Step Functions Standard with a Wait state between events",
        "SWF (Simple Workflow Service) deciders and activity workers"
      ],
      answer: [1],
      multi: false,
      explanation: "Express workflows price on requests plus GB-second duration rather than per state transition — for 80M short executions this is orders of magnitude cheaper than Standard, which at ~25 USD per million transitions would cost roughly 80M × 5 transitions ≈ 10,000 USD/month. The workload fits Express constraints: under 5 minutes, and idempotent writes make at-least-once semantics acceptable — the question hands you that clue deliberately. <strong>A</strong> is functionally fine but fails the stated cost requirement. <strong>C</strong> makes Standard slower and adds transitions (more cost). <strong>D</strong> is legacy tech that AWS itself points away from; never the right answer on a current exam."
    },
    {
      q: "During a load test, a Lambda-backed sync API begins returning 429 errors from Lambda itself once traffic ramps sharply, even though total account concurrency (1,000) has not been reached. What is the most likely explanation?",
      options: [
        "The function's execution environments each handle only one request, and the per-function scale-up rate of 1,000 new concurrent executions per 10 seconds cannot keep pace with the traffic ramp",
        "API Gateway usage plan quotas were exceeded",
        "Lambda automatically throttles any function exceeding 100 requests per second",
        "The function's /tmp storage filled up"
      ],
      answer: [0],
      multi: false,
      explanation: "Two facts combine: each environment processes exactly one request at a time, so concurrency demand equals in-flight requests; and Lambda scales each function up at 1,000 additional concurrent executions per 10 seconds. A steep ramp outruns that rate and the excess sync invokes are throttled with 429 even below the account cap. Mitigations: pre-provisioned concurrency, smoothing with a queue, or slower ramp. <strong>B</strong> would return 429 from API Gateway, but the question states Lambda is throttling — and usage plans weren't mentioned. <strong>C</strong> is a fabricated limit. <strong>D</strong> causes function errors (5xx), not throttles."
    },
    {
      q: "A team needs an internal-only REST API for services inside their VPCs across two accounts. Compliance requires that traffic never traverse the public internet. Which design satisfies this?",
      options: [
        "Regional REST API with a resource policy allowing only the corporate NAT gateway's public IP",
        "Private REST API accessed via interface VPC endpoints, with a resource policy restricting access to those endpoints, shared across accounts",
        "Edge-optimized REST API with AWS WAF blocking non-corporate IPs",
        "HTTP API with a JWT authorizer and security groups on the Lambda functions"
      ],
      answer: [1],
      multi: false,
      explanation: "A <strong>private endpoint type</strong> REST API is reachable only through interface VPC endpoints (PrivateLink), keeping traffic on the AWS network; the API's resource policy pins the allowed VPC endpoints, and endpoints in other accounts' VPCs can be authorized the same way. <strong>A</strong> still sends traffic over the public internet to a public API endpoint — IP allowlisting is access control, not network isolation. <strong>C</strong> likewise: WAF filters public traffic; the path is still public. <strong>D</strong> fails twice — HTTP APIs do not support the private endpoint type, and security groups on the backend do not privatize the API's front door."
    },
    {
      q: "An async-invoked Lambda function (triggered by S3 events) occasionally fails after all automatic retries. The operations team needs to capture the failed events along with the error message and stack context for reprocessing. What is the recommended configuration?",
      options: [
        "Configure an on-failure destination targeting an SQS queue",
        "Configure a dead-letter queue on the function",
        "Enable X-Ray tracing on the function",
        "Configure S3 event notifications to also deliver to an SNS topic as backup"
      ],
      answer: [0],
      multi: false,
      explanation: "Lambda destinations for async invocations send a full <strong>invocation record</strong> — the original event plus the response/error context — to the on-failure target after retries exhaust. That error context is exactly what the team asked for and is why AWS recommends destinations over DLQs. <strong>B</strong> works but captures only the original event payload, not the error details — the discriminator the question hinges on. <strong>C</strong> gives traces for debugging but does not capture events for reprocessing. <strong>D</strong> duplicates delivery but captures nothing about failures."
    },
    {
      q: "A nightly job must process about 4 million objects under an S3 prefix, applying a transformation to each and writing results back to S3. The team wants a serverless solution with high parallelism and tolerance for a small percentage of item failures. Which approach fits best?",
      options: [
        "A single Lambda invocation that lists and processes all objects sequentially",
        "Step Functions Distributed Map reading the S3 prefix as its item source, running child workflow executions with a configured failure tolerance",
        "An inline Map state in a Standard workflow with the object list in the execution payload",
        "An EC2 Auto Scaling group of workers polling an SQS queue seeded by an S3 inventory"
      ],
      answer: [1],
      multi: false,
      explanation: "Distributed Map is purpose-built for this: it takes an S3 prefix listing (or manifest) as the item source — bypassing the 256 KB payload limit — runs up to 10,000 concurrent child executions (Express children keep it cheap), supports item batching, a tolerated failure percentage, and writes an output manifest to S3. <strong>A</strong> hits the 15-minute Lambda timeout millions of objects before completion. <strong>C</strong> is impossible: 4 million items cannot ride in a 256 KB state payload, and inline Map concurrency is ~40. <strong>D</strong> works but is not serverless and requires building the queueing, scaling, and failure-tracking machinery Distributed Map provides natively."
    },
    {
      q: "Which statements about Lambda layers are accurate? (Select TWO.)",
      options: [
        "Layers reduce cold-start time because layer contents are cached separately from function code",
        "A function can use at most 5 layers, and layer contents count toward the 250 MB unzipped size limit",
        "Layers are mounted under the /opt directory in the execution environment",
        "Layers can exceed the function payload limit, allowing up to 10 GB of dependencies for ZIP-based functions",
        "Layers automatically update functions when a new layer version is published"
      ],
      answer: [1, 2],
      multi: true,
      explanation: "<strong>B</strong> and <strong>C</strong> are the facts: max 5 layers per function, everything sharing the 250 MB unzipped budget, unpacked into /opt. <strong>A</strong> is a widespread myth — layers are a packaging/reuse mechanism; their bytes download and initialize like any other code, so they do not inherently speed cold starts. <strong>D</strong> is false: only container images get 10 GB; ZIP functions plus layers stay under 250 MB unzipped. <strong>E</strong> is false and important operationally: functions pin a specific layer version ARN and must be updated to adopt a new version — which is what makes layers safe."
    },
    {
      q: "A company wants to shift 10% of production traffic to a new Lambda function version, observe error rates, and roll back automatically if errors spike — without changing the API Gateway integration. Which mechanism enables this?",
      options: [
        "Point the API integration at $LATEST and deploy gradually",
        "Use an alias with weighted routing between the two published versions, managed by CodeDeploy with a CloudWatch alarm for automatic rollback",
        "Deploy the new version to a second region and use Route 53 weighted records",
        "Use reserved concurrency to limit the new version to 10% of capacity"
      ],
      answer: [1],
      multi: false,
      explanation: "Aliases support weighted routing between exactly two versions; the API integration targets the alias ARN and never changes. CodeDeploy's Lambda deployment types (canary/linear) automate the weight shift and roll back on a CloudWatch alarm breach. <strong>A</strong> is the anti-pattern: $LATEST is mutable, offers no gradual shift, and no rollback point. <strong>C</strong> is heavyweight multi-region machinery for a same-region canary and changes the routing layer the question said to leave alone. <strong>D</strong> misuses concurrency: reservation caps parallel executions, it does not route a traffic percentage."
    }
  ],
  flashcards: [
    { front: "What isolation technology runs each Lambda execution environment?", back: "<strong>Firecracker</strong> micro-VMs — KVM-based hardware virtualization (~125 ms boot, ~5 MB overhead), giving VM-grade tenant isolation rather than shared-kernel containers." },
    { front: "How many requests does one Lambda execution environment handle at a time?", back: "Exactly <strong>one</strong>. Concurrency = number of environments. N concurrent requests require N environments." },
    { front: "Default account-level Lambda concurrency per region?", back: "<strong>1,000</strong> (soft limit, raisable). Shared by all functions in the region unless carved up with reserved concurrency." },
    { front: "Reserved vs provisioned concurrency — one line each", back: "<strong>Reserved</strong>: free; guarantees a function capacity and caps it (0 = kill switch). <strong>Provisioned</strong>: paid per GB-hour; pre-initialized environments that eliminate cold starts; attaches to a version/alias." },
    { front: "Lambda per-function scale-up rate?", back: "<strong>1,000 additional concurrent executions per 10 seconds</strong>, per function, up to the account limit. Steeper ramps get throttled (429 on sync)." },
    { front: "Async Lambda invocation: retry behavior after a function error?", back: "Two retries (3 attempts total), ~1 min then ~2 min apart, from Lambda's internal queue. Throttles/system errors retry with backoff up to 6 hours. Then DLQ or on-failure destination." },
    { front: "Lambda destination vs DLQ — key difference?", back: "A <strong>destination</strong> receives the full invocation record including the error/response context and supports on-success and on-failure routes (SQS, SNS, EventBridge, Lambda). A <strong>DLQ</strong> gets only the original event, failure-only." },
    { front: "What does ReportBatchItemFailures do?", back: "Enables <strong>partial batch response</strong>: the function returns failed item IDs; Lambda deletes/checkpoints successes and redelivers only failures — the fix for whole-batch reprocessing from SQS/Kinesis." },
    { front: "At what memory setting does a Lambda function get one full vCPU?", back: "<strong>1,769 MB</strong>. CPU scales linearly with memory (128 MB–10,240 MB; up to 6 vCPUs at 10 GB). Memory is the only performance knob." },
    { front: "Lambda maximum timeout and sync payload size?", back: "Timeout <strong>15 minutes</strong> (900 s). Sync payload <strong>6 MB</strong> request/response; async event payload 256 KB." },
    { front: "What changed with Hyperplane ENIs for VPC Lambda?", back: "ENIs are now created per subnet×SG combination at <strong>function-configuration time</strong> and shared via Hyperplane NAT — VPC cold-start penalty and per-environment ENI/IP exhaustion are gone. Egress still needs NAT/endpoints." },
    { front: "How does SnapStart reduce cold starts?", back: "At version publish, Lambda runs init once and snapshots the whole micro-VM; cold starts resume from the snapshot (sub-second for Java). Watch for cloned randomness/unique IDs and stale connections — use before-checkpoint/after-restore hooks." },
    { front: "REST API features missing from HTTP APIs (the exam four)", back: "<strong>Usage plans + API keys, response caching, VTL request/response transformation, private (and edge-optimized) endpoint types</strong> — plus WAF and request validation. HTTP API is ~70% cheaper otherwise." },
    { front: "API Gateway default maximum integration timeout?", back: "<strong>29 seconds</strong> — independent of the Lambda's 15-minute limit. Long work behind an API should return 202 and run async. (REST APIs can now raise it, potentially trading account throttle quota.)" },
    { front: "API Gateway auth: internal AWS callers vs app users vs custom tokens?", back: "Internal AWS → <strong>IAM SigV4</strong>. User directory JWTs → <strong>Cognito authorizer</strong> (REST) / JWT authorizer (HTTP). Anything bespoke → <strong>Lambda authorizer</strong> with result caching (TTL ≤ 1 h)." },
    { front: "What are API Gateway usage plans?", back: "REST-only: bind API keys to per-client throttle (rate/burst) and quota (requests per day/week/month). Metering and monetization — <em>not</em> an authentication mechanism." },
    { front: "Step Functions Standard vs Express: duration, semantics, pricing", back: "Standard: <strong>1 year, exactly-once transitions, priced per state transition</strong>, full history, supports callbacks/.sync. Express: <strong>5 min, at-least-once (async), priced per request + GB-s</strong>, logs-only history, huge throughput." },
    { front: "Step Functions .sync vs .waitForTaskToken", back: "<strong>.sync</strong>: submit a job (ECS, Batch, Glue, nested execution) and wait for its completion. <strong>.waitForTaskToken</strong>: suspend until an external party calls SendTaskSuccess/Failure with the token — human approval / external callback pattern. Both Standard-only." },
    { front: "Maximum payload passed between Step Functions states?", back: "<strong>256 KB</strong>. Exceeding it throws States.DataLimitExceeded. Pass S3 pointers for anything big; Distributed Map reads datasets directly from S3." },
    { front: "Step Functions Distributed Map — what makes it different from inline Map?", back: "Reads items from <strong>S3</strong> (manifest or prefix), runs each batch as a separate child execution (can be Express) at up to <strong>10,000 concurrency</strong>, tolerates a failure percentage, writes results to S3. Inline Map is payload-bound with ~40 concurrency." },
    { front: "Saga pattern in Step Functions — core idea?", back: "Replace distributed transactions with <strong>compensating actions</strong>: each forward step's Catch routes to a compensation chain (refund → release → mark failed). Standard workflows give exactly-once transitions and an audit trail of how far each saga got." },
    { front: "When is serverless the wrong answer? (name three)", back: "Steady high 24/7 load (containers + Savings Plans cheaper), jobs over 15 min or stateful/GPU workloads, strict p99 floors, connection-heavy RDBMS access without RDS Proxy, extreme sustained throughput where per-request pricing dwarfs a container fleet." },
    { front: "What is AWS SAM?", back: "A CloudFormation transform with serverless shorthand resources plus a CLI: <code>sam build / local invoke / deploy</code>, Docker-based local emulation, and built-in CodeDeploy canary traffic shifting for Lambda aliases." },
    { front: "AppSync in one line, and its standout feature?", back: "Managed GraphQL over DynamoDB/Lambda/Aurora/HTTP data sources. Standout: <strong>subscriptions</strong> — managed real-time WebSocket fan-out (connection state handled for you), vs hand-rolling API Gateway WebSockets + DynamoDB connection tracking." },
    { front: "Why must fire-and-forget async work inside a Lambda handler be awaited?", back: "The environment is <strong>frozen</strong> (no CPU) between invokes — background work stops mid-flight when the handler returns and may never complete. Await everything, or move it to an extension that runs post-response." }
  ],
  lab: {
    title: "Lab: Lambda concurrency, weighted aliases, and an HTTP API front door",
    html: `
<h3>Goal</h3>
<p>Build a Lambda function you can observe cold starts and throttling on, publish two versions behind a weighted alias, front it with an HTTP API (JWT-free, keep it simple), and demonstrate reserved concurrency as a kill switch. Everything is free-tier or fractions of a cent. Region assumed us-east-1; adjust as needed.</p>

<h3>Architecture</h3>
<p>One Python Lambda (two published versions) → alias "live" with 90/10 weighted routing → API Gateway HTTP API with a Lambda proxy integration to the alias. CloudWatch Logs shows which version served each request and whether the invoke was a cold start.</p>

<h3>Steps</h3>
<ol>
<li><p>Create a working directory and the function. The code reports its version and whether this environment is cold:</p>
<pre><code>mkdir -p ~/svls-lab &amp;&amp; cd ~/svls-lab
cat &gt; app.py &lt;&lt;'EOF'
import json, os, time
COLD = True
def handler(event, context):
    global COLD
    was_cold = COLD
    COLD = False
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps({
            "version": context.function_version,
            "cold_start": was_cold,
            "env_id": os.environ.get("AWS_LAMBDA_LOG_STREAM_NAME", "")[-8:]
        })
    }
EOF
zip fn.zip app.py</code></pre></li>

<li><p>Create an execution role and the function:</p>
<pre><code>aws iam create-role --role-name svls-lab-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name svls-lab-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
sleep 10   # IAM propagation
ROLE_ARN=$(aws iam get-role --role-name svls-lab-role --query Role.Arn --output text)
aws lambda create-function --function-name svls-lab \
  --runtime python3.12 --handler app.handler \
  --zip-file fileb://fn.zip --role "$ROLE_ARN" \
  --memory-size 256 --timeout 10</code></pre></li>

<li><p>Publish version 1, then change an env var (any config change works) and publish version 2:</p>
<pre><code>aws lambda publish-version --function-name svls-lab --query Version --output text
aws lambda update-function-configuration --function-name svls-lab \
  --environment 'Variables={RELEASE=v2}'
aws lambda wait function-updated --function-name svls-lab
aws lambda publish-version --function-name svls-lab --query Version --output text</code></pre></li>

<li><p>Create the weighted alias: 90% to version 1, 10% to version 2:</p>
<pre><code>aws lambda create-alias --function-name svls-lab --name live \
  --function-version 1 \
  --routing-config 'AdditionalVersionWeights={"2"=0.1}'</code></pre></li>

<li><p>Create the HTTP API with a proxy integration to the <em>alias</em> ARN and grant invoke permission:</p>
<pre><code>ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ALIAS_ARN=arn:aws:lambda:us-east-1:$ACCOUNT:function:svls-lab:live
API_ID=$(aws apigatewayv2 create-api --name svls-lab-api \
  --protocol-type HTTP --target "$ALIAS_ARN" --query ApiId --output text)
aws lambda add-permission --function-name svls-lab:live \
  --statement-id apigw --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:$ACCOUNT:$API_ID/*"
echo "https://$API_ID.execute-api.us-east-1.amazonaws.com/"</code></pre></li>

<li><p>Exercise the weighted routing — expect roughly 90/10 version split and cold_start:true on first hits of each environment:</p>
<pre><code>URL=https://$API_ID.execute-api.us-east-1.amazonaws.com/
for i in $(seq 1 30); do curl -s "$URL"; echo; done | sort | uniq -c</code></pre></li>

<li><p>Demonstrate the kill switch. Set reserved concurrency to 0 and watch invocations fail immediately, then restore:</p>
<pre><code>aws lambda put-function-concurrency --function-name svls-lab \
  --reserved-concurrent-executions 0
curl -s -o /dev/null -w "%{http_code}\n" "$URL"    # expect 500 (throttled behind the API)
aws lambda delete-function-concurrency --function-name svls-lab
curl -s "$URL"; echo</code></pre></li>
</ol>

<h3>Verify</h3>
<ul>
<li>The uniq -c output shows both versions serving, near a 90/10 ratio over enough samples.</li>
<li>Repeat the curl loop after 20+ idle minutes: cold_start flips back to true — you watched an environment get reaped.</li>
<li><code>aws logs tail /aws/lambda/svls-lab --since 15m</code> shows INIT_START lines only on cold invokes, and REPORT lines with billed duration per request.</li>
</ul>

<h3>Teardown</h3>
<p>Ordered so nothing is left billing or orphaned:</p>
<ol>
<li><pre><code>aws apigatewayv2 delete-api --api-id $API_ID</code></pre></li>
<li><pre><code>aws lambda delete-alias --function-name svls-lab --name live
aws lambda delete-function --function-name svls-lab</code></pre></li>
<li><pre><code>aws logs delete-log-group --log-group-name /aws/lambda/svls-lab</code></pre></li>
<li><pre><code>aws iam detach-role-policy --role-name svls-lab-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name svls-lab-role</code></pre></li>
</ol>
<p>Cost check: Lambda and HTTP API usage here is deep inside free tier; the only durable artifacts were the log group and IAM role, both now deleted.</p>
`
  }
});
