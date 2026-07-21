/* Module 13 — Messaging & Streaming: SQS, SNS, EventBridge & Kinesis (SAA track) */
window.COURSE.register({
  id: "messaging",
  order: 13,
  track: "saa",
  title: "Messaging & Streaming: SQS, SNS, EventBridge & Kinesis",
  description: "The decoupling toolbox: SQS semantics down to the visibility-timeout state machine, SNS fanout done durably, EventBridge as the event router, and Kinesis as the ordered replayable log. Closes with the decision table that answers half the messaging questions on the exam.",
  examWeight: "One of the highest-yield SAA-C03 areas. 'Decouple these tiers' is nearly always SQS; expect questions on FIFO throughput, visibility timeout, SNS-to-SQS fanout, EventBridge routing, and Kinesis vs SQS selection.",
  lessons: [
    {
      id: "sqs-semantics",
      title: "SQS semantics: why standard queues duplicate, and how FIFO fixes it",
      html: `
<p>SQS predates almost everything else in AWS (2006), and its design is a masterclass in what you give up to get unbounded scale. A queue is not one server: it is a fleet of storage hosts, each holding redundant copies of a subset of messages across AZs. There is no global index, no single sequencer. That architecture dictates the semantics — and the semantics are the exam material.</p>

<h3>Standard queues: at-least-once, best-effort ordering</h3>
<p>When you call ReceiveMessage, SQS polls a <em>sample</em> of storage hosts and returns what it finds — which is why a receive on a nearly-empty queue can return nothing even when messages exist (and why long polling exists: it queries all hosts and waits). Two consequences fall directly out of the distributed design:</p>
<ul>
<li><strong>At-least-once delivery.</strong> A message is stored on multiple hosts. If a host is unavailable when its copy should be deleted, that copy resurfaces later — a duplicate, with no error anywhere in your stack. Duplicates are not a bug or a rare edge; they are <em>inherent</em> to the replication model. Every standard-queue consumer must be idempotent. Full stop.</li>
<li><strong>Best-effort ordering.</strong> Messages come back approximately in order, but sampling across hosts plus retries means reordering is normal. If your consumer logic breaks under reordering, standard queues are the wrong tool.</li>
</ul>
<p>What you get in exchange: <strong>nearly unlimited throughput</strong> — no TPS quota worth worrying about — and the lowest-friction scaling story in AWS. This trade (unordered, possibly-duplicated, infinitely scalable) is exactly the trade Dynamo-style systems make, and for the same reasons.</p>

<h3>FIFO queues: exactly-once processing via two mechanisms</h3>
<p>FIFO queues (names end in <code>.fifo</code>) bolt a sequencing layer on top and give you two guarantees, each implemented by a distinct mechanism you should keep separate in your head:</p>
<ul>
<li><strong>Deduplication (producer side).</strong> Within a <strong>5-minute deduplication interval</strong>, a message with the same deduplication ID is accepted but silently dropped as a duplicate. The ID comes either from an explicit <code>MessageDeduplicationId</code> or, with content-based deduplication enabled, an SHA-256 of the body. This defeats producer retries (SDK resends after a timeout). Note the window: the same logical message sent 6 minutes apart is two messages — dedup is a retry-shield, not a forever-guarantee.</li>
<li><strong>Message groups (consumer side).</strong> Every FIFO message carries a <code>MessageGroupId</code>. Ordering is guaranteed <em>within a group only</em>, and — the crucial mechanic — while any message of a group is in flight, SQS will not deliver further messages from that group. A group is an <strong>ordered lane with concurrency 1</strong>. Different groups are delivered in parallel. Your parallelism ceiling is therefore your group-key cardinality: one global group ID serializes the entire queue; per-customer or per-order group IDs give you per-entity ordering with fleet-wide parallelism — the same reasoning you apply to Kafka partition keys or Kinesis partition keys.</li>
</ul>

<div class="callout limits">FIFO throughput: <strong>300 transactions/s</strong> (send, receive, or delete each count), or <strong>3,000 messages/s with batching</strong> (10 per batch). High-throughput mode raises this dramatically (tens of thousands of msg/s, scaling by partitioned message groups), but the exam's numbers are 300/3,000. Standard queues: effectively unlimited. Message size: <strong>256 KB</strong> both types. Retention: 60 s to <strong>14 days</strong> (default 4 days). Backlog size: unlimited (standard); 120,000 in-flight messages standard / 20,000 FIFO.</div>

<div class="callout exam">Keyword mapping: "messages processed exactly once, in order" → FIFO. "Maximum throughput, order does not matter" → standard. "Duplicate orders being created" with a standard queue → make the consumer idempotent or move to FIFO with dedup IDs. A distractor pattern: FIFO offered as the fix for <em>consumer-side</em> redelivery after failures — wrong, redelivery-on-failure is at-least-once behavior on both queue types; dedup only suppresses producer-side duplicates within 5 minutes.</div>

<h3>Exactly-once: the honest asterisk</h3>
<p>AWS markets FIFO as "exactly-once processing," and within its mechanics that holds: dedup kills producer duplicates, group locking prevents concurrent double-delivery. But if your consumer crashes <em>after</em> side effects and <em>before</em> DeleteMessage, the message returns after the visibility timeout and is processed again — same as standard. Exactly-once <em>delivery</em> across arbitrary failure is impossible (you know the two-generals argument); FIFO narrows the duplicate window, it does not repeal distributed systems. Senior take: idempotent consumers everywhere, FIFO where ordering genuinely matters, and treat dedup as protection against retry storms, not as a license to skip idempotency.</p>

<div class="callout war">The message-group hot-key problem mirrors every partitioned system: one whale customer generating 80% of traffic serializes into one lane while the rest of the fleet idles. Watch the age-of-oldest-message metric per queue and consider composite group keys (customer + order) when strict per-customer ordering is stronger than the business actually requires.</div>
`
    },
    {
      id: "sqs-mechanics",
      title: "SQS mechanics: visibility timeout, DLQs, polling, and size limits",
      html: `
<p>SQS has no concept of "delivered." It has a small state machine per message, and the <strong>visibility timeout</strong> is its heart: when a consumer receives a message, the message is not removed — it becomes <em>invisible</em> for the timeout duration (default <strong>30 s</strong>, max <strong>12 hours</strong>). The consumer processes and then calls DeleteMessage. If it does not (crash, timeout, exception), the message reappears for redelivery. This is a lease, exactly like a lock with TTL — and every classic lease pathology applies.</p>

<h3>Tuning the lease</h3>
<ul>
<li><strong>Too short:</strong> the consumer is still working when the lease expires; a second consumer gets the message → duplicate processing. Rule of thumb: visibility timeout ≥ 6× your worst-case processing time when Lambda is the consumer (the ESM may hold batches through retries).</li>
<li><strong>Too long:</strong> a crashed consumer's messages are stuck invisible for the full timeout → latency spikes on failure. </li>
<li><strong>Dynamic extension:</strong> a consumer that discovers a message needs more time can call ChangeMessageVisibility to extend its own lease (heartbeat pattern) — far better than a blanket 12-hour timeout.</li>
</ul>

<h3>The poison-pill pattern: maxReceiveCount and DLQs</h3>
<p>A malformed message that always crashes its consumer would cycle forever: receive → crash → visibility expiry → receive. The <strong>redrive policy</strong> breaks the loop: each receive increments a counter, and when it exceeds <code>maxReceiveCount</code>, SQS moves the message to the designated <strong>dead-letter queue</strong>. Mechanics worth knowing cold:</p>
<ul>
<li>The DLQ is just another queue you create; the redrive policy lives on the <em>source</em> queue. A FIFO source requires a FIFO DLQ.</li>
<li>Set maxReceiveCount high enough (5+) that transient failures (deploy blips, downstream timeouts) don't spuriously dead-letter good messages.</li>
<li>The message's original enqueue timestamp is preserved — so the DLQ's retention clock has already been running. Give DLQs the full 14-day retention.</li>
<li><strong>Redrive to source</strong> lets you replay DLQ messages back to the source queue after fixing the bug — built in, no custom pump script.</li>
<li>Alarm on the DLQ's ApproximateNumberOfMessagesVisible: a silent, growing DLQ is data loss on a delay timer.</li>
</ul>

<div class="callout exam">"Some messages repeatedly fail and block processing / need investigation" → DLQ with maxReceiveCount. "Reprocess the failed messages after a fix" → DLQ redrive. "Consumer processing takes 3 minutes but messages are being processed twice" → raise visibility timeout above processing time.</div>

<h3>Polling: short vs long</h3>
<p><strong>Short polling</strong> (WaitTimeSeconds = 0) samples a subset of hosts and returns immediately — possibly empty even when messages exist, and each call bills as a request. <strong>Long polling</strong> (WaitTimeSeconds up to <strong>20 s</strong>) queries all hosts and holds the connection until a message arrives or the wait expires. Long polling is strictly better for almost everyone: fewer empty receives (lower cost — SQS bills per request), lower delivery latency, no missed messages from sampling. Set it queue-wide via ReceiveMessageWaitTimeSeconds. The only reason to short-poll is a single thread multiplexing many queues.</p>

<h3>Delay queues vs message timers, and size limits</h3>
<p>A <strong>delay queue</strong> (DelaySeconds on the queue, up to 15 minutes) hides <em>every</em> message for the delay after enqueue; a <strong>message timer</strong> sets DelaySeconds per message (standard queues only — FIFO forbids per-message timers because they would violate ordering). Use case: give an upstream transaction time to commit before consumers read the event.</p>
<p>The message cap is <strong>256 KB</strong> (recently extended to 1 MB for standard queues, but 256 KB remains the number to know). Bigger payloads use the <strong>claim-check pattern</strong>: the Extended Client Library writes the payload to S3 and enqueues a pointer; the receiving side dereferences transparently. Design note: you now own S3 lifecycle for those objects and have coupled queue retention to object retention.</p>
<p><strong>Temporary queues</strong> (via the Temporary Queue Client) implement cheap request-response over SQS: thousands of lightweight, application-managed virtual queues multiplexed over one physical queue — the pattern for RPC-ish flows without creating a queue per client.</p>

<div class="callout deep">Why is there no push mode? Because the lease model requires the consumer to control pacing. This is the fundamental SQS-vs-SNS split: SQS consumers <em>pull at their own rate</em>, which is what makes a queue a buffer — the backlog absorbs the mismatch between producer and consumer rates. Any exam scenario about "protect the database from traffic spikes" or "decouple tiers so the backend processes at its own pace" is describing pull-based buffering: SQS.</div>

<div class="callout war">Two production classics. (1) The forgotten DLQ: created in 2022, alarmed never, discovered during an audit with 40,000 expired-and-purged messages — pair every DLQ with an alarm the day you create it. (2) Visibility-timeout vs Lambda: the ESM can hold a batch across function retries; with timeout 30 s and function timeout 25 s plus a retry, the batch reappears mid-flight and a second poller processes it concurrently. The 6× rule exists because people got burned.</div>
`
    },
    {
      id: "sns-fanout",
      title: "SNS: durable fanout, filtering, and FIFO topics",
      html: `
<p>SNS is the push half of the toolbox: a topic receives a message and immediately attempts delivery to every subscription — Lambda, SQS, HTTP/S endpoints, Kinesis Data Firehose, email, SMS, mobile push. It stores nothing you can read back: no retention, no replay, no backlog. If a message cannot be delivered within the retry policy, it is gone (or dead-lettered). That single fact drives every architectural decision around it.</p>

<h3>The fanout pattern — and why you subscribe queues, not functions</h3>
<p>The canonical serverless fanout is <strong>SNS → multiple SQS queues → consumers</strong>: an order-placed event fans out to the inventory queue, the billing queue, the analytics queue. Why interpose queues instead of subscribing Lambdas directly?</p>
<ul>
<li><strong>Durability.</strong> A queue persists the message for up to 14 days; each consumer drains at its own pace and survives its own outages. Direct Lambda subscription rides SNS's retry policy, and after retries exhaust, the message is dropped (unless you add a subscription DLQ) — an SNS-side DLQ catches delivery failure, but a queue also absorbs <em>processing</em> failure, backpressure, and consumer deploys.</li>
<li><strong>Independent scaling and isolation.</strong> Billing being down for an hour costs nothing; its queue buffers. With direct push, billing's outage becomes message loss or a thundering retry herd.</li>
<li><strong>Replayability-lite.</strong> A queue plus a DLQ gives each consumer its own retry/inspect/redrive story.</li>
</ul>
<p>Wiring detail the exam checks: the SQS queue's <strong>access policy must allow the topic to SendMessage</strong> (condition on the topic ARN); and for Raw Message Delivery <em>disabled</em> (the default), the consumer receives an SNS envelope JSON with the payload in the Message field — enable <strong>raw message delivery</strong> to get the bare payload and skip the unwrapping.</p>

<h3>Message filtering: routing without consumer-side waste</h3>
<p>A <strong>filter policy</strong> on a subscription makes SNS deliver only matching messages — matching against message <em>attributes</em> by default, or the message <em>body</em> with scope set accordingly. Policies support exact match, prefix, numeric ranges, anything-but, and exists. This turns one topic into a content-based router: the EU-orders queue subscribes with a filter on region = eu, the high-value queue filters amount &gt; 10000. Without filtering, every consumer receives everything and discards most of it — paying for the deliveries, the SQS requests, and the compute. Filtering moves that cost to zero. It is also the difference between SNS-as-broadcast and SNS-as-poor-man's-EventBridge (EventBridge does richer content routing on the full event body — next lesson).</p>

<h3>FIFO topics</h3>
<p><strong>SNS FIFO topics</strong> pair with SQS FIFO queues to extend ordering and deduplication through the fanout: message group IDs and dedup IDs pass through, ordering is preserved per group into each subscribed FIFO queue. Constraints that keep exam-writers employed: FIFO topics can deliver to <strong>SQS queues (FIFO or standard) and, more recently, Lambda/Firehose-style endpoints — but the safe exam answer is SQS FIFO</strong>; throughput mirrors SQS FIFO (300/3,000 msg/s); a standard topic cannot deliver to a FIFO queue's ordering guarantees meaningfully. Pattern: "fan out order events to multiple services, preserving per-order processing sequence" → SNS FIFO topic + SQS FIFO queues, group ID = order ID.</p>

<h3>Delivery retries: per-protocol policies</h3>
<p>SNS retry behavior depends on the endpoint type, and the differences matter:</p>
<ul>
<li><strong>AWS endpoints (SQS, Lambda):</strong> retried aggressively for up to ~23 days with backoff — effectively "AWS will get it there unless the target is misconfigured."</li>
<li><strong>HTTP/S endpoints:</strong> a configurable delivery policy (linear/geometric backoff, min/max delay, number of retries) with a default that gives up in minutes. Then the message is dropped unless the subscription has a <strong>redrive policy to a DLQ (an SQS queue)</strong>.</li>
<li><strong>Email/SMS:</strong> best-effort, no meaningful retry contract.</li>
</ul>
<p>Also know: <strong>server-side encryption</strong> with KMS (producers need kms:GenerateDataKey via the topic's key), <strong>cross-account and cross-region</strong> subscriptions work (policy on both ends), and <strong>message size is 256 KB</strong> like SQS.</p>

<div class="callout exam">"Notify multiple downstream systems of one event, each must process independently and reliably" → SNS fanout to SQS queues. "Consumers only need a subset of messages, reduce processing cost" → subscription filter policies. "Push notification failed deliveries must not be lost" → subscription DLQ. "Same event to email, SMS, and a queue" → SNS is the only service on the list that speaks all three protocols.</div>

<div class="callout war">The silent-drop failure mode: teams subscribe an HTTPS microservice endpoint, the service has a bad deploy for 40 minutes, SNS exhausts its HTTP retry policy, and a slice of events simply never happened — no error in the producer, nothing in the consumer's logs. If the message matters, it lands in a queue first. Reserve direct HTTP push for genuinely-best-effort webhooks, and even then attach a subscription DLQ.</div>

<div class="callout limits">SNS: 256 KB messages; ~23-day retry for SQS/Lambda targets; HTTP retry policy configurable, minutes by default; filter policies match attributes (or body with message-body scope); up to 12.5M subscriptions per standard topic, 100 per FIFO topic; FIFO throughput matches SQS FIFO.</div>
`
    },
    {
      id: "eventbridge",
      title: "EventBridge: the event router — buses, rules, pipes, and replay",
      html: `
<p>EventBridge (né CloudWatch Events) is a different animal from SNS: a <strong>content-based event router</strong> with a schema-aware rule engine. The mental model is a pattern-matching switchboard: JSON events arrive on a <strong>bus</strong>, every <strong>rule</strong> on that bus tests its event pattern against each event, and matching rules forward (optionally transformed) copies to their <strong>targets</strong>. Where SNS is topic-per-subject broadcast, EventBridge is one pipe with declarative routing on the payload itself.</p>

<h3>Buses: default, custom, partner</h3>
<ul>
<li><strong>Default bus</strong> — exists in every account/region; receives all AWS service events (EC2 state changes, S3 via EventBridge notifications, CodePipeline phases, Health events…). Operational automation lives here.</li>
<li><strong>Custom buses</strong> — for your application domains (an orders bus, a payments bus). Resource policies make cross-account event delivery first-class: spoke accounts put events onto a hub account's bus, or a hub fans out to spoke buses — the standard multi-account event backbone.</li>
<li><strong>Partner buses</strong> — SaaS vendors (Datadog, Stripe-alikes, Zendesk, Auth0…) push their events into your account natively. Exam cue: "receive events from a third-party SaaS without webhooks/polling infrastructure" → EventBridge partner event source.</li>
</ul>

<h3>Rules: content filtering and input transformation</h3>
<p>An <strong>event pattern</strong> is a JSON document matched against the event: exact values, prefix/suffix, numeric ranges, anything-but, exists, wildcards, IP-address (CIDR) matching, plus and/or composition. This is filtering on the <em>entire event body</em>, natively — richer than SNS filter policies. Each rule fans out to up to <strong>5 targets</strong> (need more? route to SNS, or add rules): Lambda, Step Functions, SQS, SNS, Kinesis, ECS RunTask, API destinations (signed HTTP calls to external APIs with OAuth and built-in rate limiting), another bus, and ~20 more. An <strong>input transformer</strong> extracts fields from the event and rewrites the payload per target — so a raw EC2 state-change event becomes a tidy human-readable message for the ops channel target and a compact JSON for the Lambda target, from the same rule. Delivery to targets is at-least-once with retry (up to 24 h / 185 attempts by default) and per-target DLQ support.</p>

<h3>Scheduler vs scheduled rules</h3>
<p>Old way: cron/rate scheduled rules on a bus. Current way: <strong>EventBridge Scheduler</strong>, a separate, higher-scale facility — millions of schedules, <em>one-time</em> schedules, timezone awareness (cron in a named timezone, DST handled), flexible time windows, and calls to any AWS API as the target, not just bus targets. New designs and exam answers involving "schedule a task at a specific local time" or "millions of per-customer reminders" → Scheduler.</p>

<h3>Archive and replay, schema registry</h3>
<p>An <strong>archive</strong> captures events matching a filter, with configurable retention; <strong>replay</strong> re-emits archived events onto the bus for a chosen time window — rules process them again (targets should handle a replay flag; events carry a replay-name field). This is EventBridge's answer to "we deployed a bug and dropped a day of events" — something SNS categorically cannot do. It is not Kinesis-grade replay (no consumer-controlled cursors), but it converts the router from fire-and-forget to recoverable. The <strong>schema registry</strong> infers schemas from observed events and generates typed bindings — modestly useful, occasionally an exam distractor.</p>

<h3>Pipes: point-to-point with the boring parts included</h3>
<p><strong>EventBridge Pipes</strong> is a managed point-to-point connector: <em>one source</em> (SQS, Kinesis, DynamoDB Streams, MSK, MQ) → optional filter → optional enrichment step (Lambda, Step Functions, API destination) → <em>one target</em>. It replaces the single-purpose glue Lambda whose whole job was "read stream, filter, call enrichment, forward." Pipes vs bus: a bus is many-to-many routing; a pipe is a 1:1 conveyor with filtering/enrichment built in.</p>

<h3>SNS vs EventBridge: the decision</h3>
<table>
<thead><tr><th></th><th>SNS</th><th>EventBridge</th></tr></thead>
<tbody>
<tr><td>Model</td><td>Topic broadcast (pub/sub)</td><td>Content-routed bus</td></tr>
<tr><td>Filtering</td><td>Attribute (or body) filter policies</td><td>Rich patterns on full body</td></tr>
<tr><td>Fan-out scale</td><td>Millions of subscribers</td><td>5 targets/rule, 300 rules/bus (soft)</td></tr>
<tr><td>Latency / throughput</td><td>Lower latency, very high TPS</td><td>~0.5 s typical latency, throttled per-region (soft)</td></tr>
<tr><td>Replay</td><td>None</td><td>Archive + replay</td></tr>
<tr><td>SaaS ingestion</td><td>No</td><td>Partner event sources</td></tr>
<tr><td>Non-AWS targets</td><td>HTTP, email, SMS, push</td><td>API destinations (OAuth, rate-limited)</td></tr>
<tr><td>FIFO/ordering</td><td>FIFO topics</td><td>No ordering guarantee</td></tr>
</tbody>
</table>
<p>Rules of thumb: mass fanout to many identical subscribers or non-HTTP protocols → SNS. Routing by event content across services/accounts, SaaS events, replay, direct-to-external-API → EventBridge. They compose: EventBridge rule → SNS target for the mass-fanout leaf.</p>

<div class="callout exam">Trigger phrases: "route events to different targets based on event content" → EventBridge rules. "Third-party SaaS events into AWS" → partner event source. "Replay events after fixing a consumer" → archive + replay. "Cross-account event routing" → custom bus + resource policy. "Millions of scheduled one-time actions / timezone-aware cron" → EventBridge Scheduler.</div>

<div class="callout war">EventBridge's default-bus events are regional: an EC2 state change fires in the instance's region. Multi-region orgs forget this and wonder why the us-west-2 automation never sees us-east-1 events — you must forward cross-region explicitly (bus-to-bus targets support it). Also budget for rule sprawl: hundreds of rules with overlapping patterns become an unqueryable routing table; name and tag rules like the routing config they are.</div>
`
    },
    {
      id: "kinesis-streams",
      title: "Kinesis Data Streams: shards as ordered, replayable logs",
      html: `
<p>Kinesis Data Streams is AWS's Kafka-shaped primitive: a partitioned, append-only log with consumer-controlled cursors. If you know Kafka, map vocabulary and you are 80% done — shard ≈ partition, partition key ≈ key, sequence number ≈ offset, KCL ≈ consumer group, enhanced fan-out ≈ dedicated consumer bandwidth. The remaining 20% is the AWS-specific limits and consumer models, which is what the exam tests.</p>

<h3>Shards and partition keys</h3>
<p>A stream is a set of <strong>shards</strong>, each an ordered log. A record's <strong>partition key</strong> is MD5-hashed onto the shard keyspace; all records sharing a key land on the same shard, in order. Ordering is therefore <em>per key</em> (per shard), never stream-wide — identical reasoning to SQS FIFO message groups and Kafka keys, with the identical hot-key hazard: skewed keys (one device generating half the traffic) hot-spot one shard while the rest idle, and no amount of resharding fixes a single over-weight key.</p>

<div class="callout limits">Per shard: <strong>1 MB/s or 1,000 records/s write</strong>; <strong>2 MB/s read</strong> shared across all classic consumers, max 5 GetRecords calls/s. Enhanced fan-out: <strong>2 MB/s per consumer per shard</strong>, push over HTTP/2, up to 20 registered consumers. Record size max <strong>1 MB</strong>. Retention: 24 h default, extendable to 7 days, max <strong>365 days</strong>. These numbers are the exam's favorite arithmetic: required 8 MB/s ingest → at least 8 shards.</div>

<h3>Consumers: shared vs enhanced fan-out</h3>
<p>The <strong>shared (classic) model</strong> has consumers polling GetRecords against a per-shard budget of 2 MB/s and 5 calls/s <em>total across all consumers</em>. Two consumers halve each other's bandwidth; three or more start tripping ReadProvisionedThroughputExceeded and adding propagation latency (polling every 200 ms × N apps). <strong>Enhanced fan-out (EFO)</strong> registers each consumer with the stream; the service then <em>pushes</em> records over long-lived HTTP/2 connections, giving every registered consumer its own dedicated 2 MB/s per shard and ~70 ms propagation vs ~200+ ms polling. EFO costs extra (per consumer-shard-hour plus per-GB retrieved) — the decision is simply consumer count and latency sensitivity: 1-2 tolerant consumers → shared; 3+ or latency-critical → EFO.</p>

<h3>KCL, checkpointing, and the worker model</h3>
<p>The <strong>Kinesis Client Library</strong> is the consumer-group runtime: it leases shards across worker instances, checkpoints progress (classically to a DynamoDB table it creates — which has its own RCU/WCU costs and throttling failure modes people forget to provision for), rebalances when workers join/die, and handles resharding transitions. KCL guarantees at-least-once processing: a worker crash after processing but before checkpoint means replay from the last checkpoint. Idempotency again. Lambda via event source mapping is the "managed KCL" for most workloads — per-shard batching, parallelization factor up to 10, bisect-on-error, partial batch response — the same ESM machinery from the serverless module.</p>

<h3>Capacity modes and resharding</h3>
<p><strong>Provisioned</strong> mode: you set the shard count, pay per shard-hour plus per-million PUT payload units, and you own scaling. Scaling means <strong>resharding</strong>: splitting a shard (more throughput) or merging two (less cost) — pairwise, non-instant operations; a heavy rescale is a scripted sequence, and children only start filling after parents close (consumers must drain parents first to preserve order — KCL handles this). <strong>On-demand</strong> mode: pay per GB in/out, no shard management, auto-scales to double your previous peak (default write ceiling grows into the multi-GB/s range on request). On-demand wins for spiky/unknown traffic; provisioned is materially cheaper for steady, well-understood throughput. You can switch modes twice per 24 h.</p>

<h3>Kinesis vs SQS: the decision that decides the question</h3>
<table>
<thead><tr><th></th><th>SQS</th><th>Kinesis Data Streams</th></tr></thead>
<tbody>
<tr><td>Model</td><td>Queue: a message is consumed and deleted</td><td>Log: records persist for the retention window; reads don't delete</td></tr>
<tr><td>Multiple consumers of same data</td><td>No (one consumer per message; fanout needs SNS)</td><td>Yes — each consumer keeps its own cursor</td></tr>
<tr><td>Replay</td><td>No</td><td>Yes, up to 365 days back</td></tr>
<tr><td>Ordering</td><td>FIFO queues, 3k msg/s batched</td><td>Per partition key, at ingest scale</td></tr>
<tr><td>Scaling</td><td>Automatic, unbounded</td><td>Shards (provisioned) or on-demand</td></tr>
<tr><td>Consumer pacing</td><td>Each message at its own pace, per-message retry/DLQ</td><td>Sequential per shard; a slow record delays its shard</td></tr>
</tbody>
</table>
<p>Translation: <em>work distribution</em> (each message processed once by whoever grabs it, per-message retry, buffering) → SQS. <em>Data streaming</em> (ordered history, multiple independent readers, replay, real-time analytics) → Kinesis. The exam signals Kinesis with: "clickstream," "IoT telemetry," "real-time analytics," "multiple applications consume the same data," "reprocess historical data."</p>

<div class="callout war">The classic Kinesis production incident is silent consumer lag: throughput fits, but one consumer slows, falls hours behind, and nobody notices until records age out of retention — permanent loss with zero errors. Alarm on <strong>IteratorAgeMilliseconds</strong> (and MillisBehindLatest for EFO) from day one; it is the queue-depth metric of the streaming world. Second classic: provisioned streams sized for peak and billed 24/7 — shard-hours are the cost dimension, so idle overnight capacity is pure burn; either script scale-downs or go on-demand.</div>

<div class="callout deep">Why does Kinesis replay and SQS not? Storage model. SQS stores messages individually, replicated across hosts, deleted on ack — there is no ordered history to rewind. Kinesis writes an immutable sequence per shard; a consumer is just a cursor (shard iterator) into that sequence — AT_SEQUENCE_NUMBER, AT_TIMESTAMP, TRIM_HORIZON, LATEST. Deletion never happens per-record; only the retention window trims the log. Same dichotomy as RabbitMQ vs Kafka.</div>
`
    },
    {
      id: "firehose-msk-mq",
      title: "Firehose, MSK, and Amazon MQ: the rest of the roster",
      html: `
<p>Three more services complete the messaging roster, and each exists to answer one specific question. Know the one-liner and the discriminating details.</p>

<h3>Amazon Data Firehose: the delivery pipe</h3>
<p>Firehose (formerly Kinesis Data Firehose) is <strong>managed ETL-lite delivery</strong>: it ingests records (direct PUT, or reading from a Kinesis stream, or MSK), buffers them, optionally transforms them, and delivers batches to a destination — <strong>S3, Redshift, OpenSearch, Splunk, and HTTP endpoints for third-party observability platforms (Datadog, New Relic, etc.)</strong>. The defining characteristics:</p>
<ul>
<li><strong>Near-real-time, not real-time.</strong> Delivery waits for a buffer to fill: buffer size (1–128 MB) or buffer interval (from as low as 0–60 s minimum up to 900 s) — whichever trips first. Zero-buffering options have shrunk the floor, but the exam's mental model stands: Firehose = buffered batches, Kinesis Data Streams = per-record millisecond access.</li>
<li><strong>No storage, no replay, no consumers.</strong> It is a pipe, not a log. Nothing reads <em>from</em> Firehose. If delivery fails, it retries and then drops failed records into an S3 error prefix — that is the whole failure story.</li>
<li><strong>Fully serverless:</strong> no shards, no capacity planning; scales automatically; you pay per GB ingested (plus format conversion/VPC delivery extras).</li>
<li><strong>Transformations:</strong> an inline Lambda can transform/filter each batch (records come back with Ok/Dropped/ProcessingFailed statuses), and built-in <strong>format conversion</strong> writes Parquet/ORC — the standard "land JSON clickstream as Parquet in the data lake partitioned by hour" answer, with dynamic partitioning by record fields.</li>
</ul>

<div class="callout exam">Discriminator: "load streaming data into S3/Redshift/OpenSearch/Splunk with minimal administration" → Firehose. "Custom application processes records with sub-second latency" or "multiple consumers / replay" → Kinesis Data Streams. They chain: Streams for real-time consumers, plus Firehose reading the same stream to archive everything to S3. If the option list has both, the presence of the words 'near real time' or a named destination (Splunk!) points at Firehose.</div>

<h3>Amazon MSK: Kafka, managed</h3>
<p>MSK runs actual Apache Kafka — brokers, ZooKeeper/KRaft, patching, metrics — in your VPC. Choose it over Kinesis when the requirement is <em>Kafka itself</em>: existing Kafka applications and their ecosystem (Kafka Connect, Streams, Flink jobs, Debezium CDC, exactly-once transactions, log compaction), producer/consumer code you will not rewrite, records over 1 MB (configurable to tens of MB), or unlimited retention. MSK Serverless removes capacity management for spiky workloads; MSK Connect runs Connect connectors managed. The trade: even managed, Kafka carries operational surface (partitions, consumer groups, rebalancing storms, broker sizing on provisioned clusters) that Kinesis on-demand simply doesn't have. Exam heuristic: the word "Kafka" or "migrate an existing Kafka workload" appears → MSK; otherwise a greenfield AWS-native streaming requirement → Kinesis.</p>

<h3>Amazon MQ: the lift-and-shift broker</h3>
<p>Amazon MQ is managed <strong>ActiveMQ or RabbitMQ</strong>. It exists for exactly one exam pattern: <em>an existing on-prem application speaks an open messaging protocol — AMQP, MQTT, OpenWire, STOMP, JMS — and must move to AWS without rewriting messaging code.</em> SQS/SNS have proprietary HTTP APIs; a JMS-based order system would need a code rewrite to adopt them. Amazon MQ speaks the standard protocols, so the app repoints a connection string. Architecture notes: brokers run on instances in your VPC (instance-hour pricing — not serverless), with active/standby across AZs via shared EFS storage (ActiveMQ) or mirrored/quorum queues (RabbitMQ); failover flips a DNS endpoint in under a minute — so this is also the rare AWS messaging service with a maintenance window and a failover event to design around. It does not scale like SQS; throughput is bounded by broker size.</p>

<div class="callout exam">The Amazon MQ tell is protocol vocabulary: "JMS," "AMQP 0-9-1," "MQTT," "STOMP," "ActiveMQ," "RabbitMQ," "minimal changes to the application." Any of those → Amazon MQ. Conversely, greenfield cloud-native design questions should <em>never</em> answer Amazon MQ — SQS/SNS are the default, and the exam expects you to know MQ is the compatibility play, not the scalability play. MQTT for a fleet of IoT devices at scale → AWS IoT Core, a different product.</div>

<div class="callout war">Teams pick Amazon MQ for greenfield systems because RabbitMQ is familiar, then rediscover why SQS exists: broker CPU ceilings under fanout, queue mirroring lag during AZ failover, connection-count exhaustion from microservice sprawl, and the 2 a.m. maintenance-window page. The compatibility bridge is for crossing, not for living on: land the migration, then peel high-throughput paths onto SQS/SNS/EventBridge.</div>

<div class="callout limits">Firehose: buffering 1–128 MB / up to 900 s per destination; record max 1,000 KB; pay per GB. MSK: Kafka-native limits (broker/partition sizing yours to manage); MSK Serverless caps per-partition throughput. Amazon MQ: broker instance sizes bound throughput; active/standby failover typically under a minute; protocols AMQP, MQTT, OpenWire, STOMP, WSS.</div>
`
    },
    {
      id: "choosing-messaging",
      title: "The decision table: choosing the right messaging service",
      html: `
<p>Every messaging question on the exam — and most architecture reviews — reduces to identifying which properties the scenario actually requires. Work from properties to service, never from familiarity to justification.</p>

<h3>The properties that decide</h3>
<ul>
<li><strong>Consumption model.</strong> Is a message a <em>task</em> (processed once, by one worker, then gone) or a <em>fact</em> (an event others observe; possibly many observers; possibly re-observed later)? Tasks → queue (SQS). Facts → topic/bus/log (SNS, EventBridge, Kinesis).</li>
<li><strong>Fan-out.</strong> How many independent consumers of the same message? One → SQS. Several, push-style → SNS (durably: SNS → SQS per consumer). Several with content-based routing → EventBridge. Several with replay/cursors → Kinesis.</li>
<li><strong>Ordering.</strong> None needed → standard anything. Per-entity → FIFO (SQS/SNS) or partition keys (Kinesis). Global total order → redesign; nothing scales that.</li>
<li><strong>Replay.</strong> Must re-read history → Kinesis (365 d) or MSK; EventBridge archive/replay for router-level recovery. SQS and SNS: consumed means gone.</li>
<li><strong>Buffering/backpressure.</strong> Producer and consumer rates mismatch; consumer must be protected → SQS (the backlog <em>is</em> the feature). Push systems (SNS, EventBridge) transfer the spike to the target.</li>
<li><strong>Latency shape.</strong> Milliseconds per record → Kinesis Streams/SNS. Near-real-time batches to storage → Firehose. Seconds acceptable, at own pace → SQS.</li>
<li><strong>Protocol compatibility.</strong> JMS/AMQP/MQTT legacy code → Amazon MQ. Kafka ecosystem → MSK.</li>
</ul>

<h3>The table</h3>
<table>
<thead><tr><th>Requirement in the scenario</th><th>Answer</th><th>Why</th></tr></thead>
<tbody>
<tr><td>Decouple web tier from workers; absorb spikes; protect the DB</td><td>SQS</td><td>Pull-based buffering; backlog absorbs rate mismatch</td></tr>
<tr><td>Process in order per customer, no duplicates from retries</td><td>SQS FIFO</td><td>Message groups = ordered lanes; 5-min dedup window</td></tr>
<tr><td>One event, several services each act independently</td><td>SNS → SQS fanout</td><td>Push broadcast + per-consumer durable buffer</td></tr>
<tr><td>Route events to targets by content; cross-account; SaaS sources</td><td>EventBridge</td><td>Pattern-matching rules, resource policies, partner buses</td></tr>
<tr><td>Real-time analytics; multiple readers; reprocess history</td><td>Kinesis Data Streams</td><td>Ordered log, per-consumer cursors, up to 365-d retention</td></tr>
<tr><td>Stream data into S3/Redshift/OpenSearch/Splunk, no code</td><td>Firehose</td><td>Managed buffered delivery, optional transform, serverless</td></tr>
<tr><td>Existing Kafka apps / Kafka ecosystem tooling</td><td>MSK</td><td>It is Kafka; no client changes</td></tr>
<tr><td>Migrate JMS/AMQP/MQTT app without code changes</td><td>Amazon MQ</td><td>Speaks open protocols SQS/SNS do not</td></tr>
<tr><td>Send email/SMS/mobile push about an event</td><td>SNS</td><td>Only multi-protocol notifier in the lineup</td></tr>
<tr><td>Schedule millions of one-time or timezone-aware actions</td><td>EventBridge Scheduler</td><td>Purpose-built; scheduled rules are legacy</td></tr>
</tbody>
</table>

<h3>Composition patterns worth recognizing</h3>
<p>Real architectures chain these, and the exam increasingly shows composed options:</p>
<ul>
<li><strong>EventBridge → SQS → Lambda:</strong> routing plus buffering plus compute — the default event-driven backbone. The queue in the middle is what makes consumer failures survivable and rates controllable (ESM maximum concurrency).</li>
<li><strong>SNS → SQS (×N) with filter policies:</strong> classic fanout when all consumers want (a subset of) the same firehose of notifications and you don't need EventBridge's routing/replay.</li>
<li><strong>Kinesis Streams → Lambda + Firehose → S3:</strong> real-time consumers on the stream, and Firehose tapping the same stream for the archival copy. One log, many uses — the streaming advantage in one picture.</li>
<li><strong>DynamoDB Streams → EventBridge Pipes → target:</strong> CDC without glue Lambdas.</li>
<li><strong>API Gateway → SQS (service integration):</strong> webhook ingestion with zero compute on the hot path; workers drain at leisure.</li>
</ul>

<div class="callout exam">Elimination heuristics that pay for themselves: (1) The words "decouple," "buffer," or "burst" in a compute-protection scenario → the answer contains SQS. (2) "Multiple consumers need the same messages" instantly eliminates bare SQS. (3) "Replay" or "reprocess" eliminates SQS <em>and</em> SNS. (4) "Order across all messages globally" is a trap — pick the per-entity ordering option. (5) "Fewest changes to existing application" + any open protocol name → Amazon MQ. (6) "Near real time" + a storage/analytics destination → Firehose over Streams. (7) An option that subscribes Lambda directly to SNS when the scenario stresses durability/retries loses to the SNS→SQS→Lambda option.</div>

<div class="callout war">The most expensive wrong choice in this space is Kinesis-as-a-queue: a team needs work distribution, picks Kinesis "because streaming is modern," then fights per-shard ordering they didn't need, hot shards, consumer lag alarms, and shard-hour bills — where SQS would have auto-scaled silently for a tenth the effort. The reverse error — SQS where three teams need the same events — ends with consumers competing for messages and someone building a homemade fanout copier. Match the storage model to the consumption model and the rest of the design falls out.</div>

<div class="callout deep">A last mental model for the road: these services differ mainly in <em>who owns the cursor</em>. SQS: the service owns delivery state per message. SNS/EventBridge: nobody does — delivery is attempted, then forgotten. Kinesis/MSK: the <em>consumer</em> owns its cursor, and the service just stores an immutable log. Every capability difference — replay, fanout, buffering, ordering — is a corollary of that one design choice.</div>
`
    }
  ],
  quiz: [
    {
      q: "An e-commerce checkout publishes order events to a standard SQS queue. The fulfillment consumer occasionally processes the same order twice, creating duplicate shipments, even though producers send each order exactly once. What is the correct explanation and primary remediation?",
      options: [
        "A misconfigured retry policy on the producer is duplicating sends; fix the SDK configuration",
        "Standard queues are at-least-once by design, so duplicates are inherent; make the consumer idempotent, or use a FIFO queue if ordering and dedup are required",
        "The queue's encryption key is causing message corruption; disable SSE-SQS",
        "Long polling is returning the same message to multiple consumers; switch to short polling"
      ],
      answer: [1],
      multi: false,
      explanation: "Standard SQS stores redundant copies across hosts; an unavailable host at delete time means a surviving copy resurfaces later — at-least-once delivery is architectural, not a misconfiguration. The consumer must be idempotent (or the design moves to FIFO for dedup + ordering, at a throughput cost). <strong>A</strong> could add more duplicates but the question stipulates single sends — and even perfect producers see duplicates on standard queues. <strong>C</strong> is fabricated; SSE does not duplicate messages. <strong>D</strong> reverses reality: polling mode does not cause multi-delivery — visibility timeout mechanics and replication do, and short polling only adds sampling misses."
    },
    {
      q: "A trading application requires events for each account to be processed strictly in order, while different accounts may be processed in parallel. Peak load is 2,500 messages per second across all accounts. Which solution meets the requirements?",
      options: [
        "A standard SQS queue with one consumer thread",
        "An SQS FIFO queue with MessageGroupId set to the account ID, producers batching sends",
        "One SQS FIFO queue per account",
        "An SQS FIFO queue with a single MessageGroupId for all messages"
      ],
      answer: [1],
      multi: false,
      explanation: "MessageGroupId = account ID gives per-account ordered lanes with cross-account parallelism, and FIFO's batched throughput ceiling of 3,000 msg/s covers the 2,500 msg/s peak (the unbatched limit is 300 TPS — batching is the load-bearing detail). <strong>A</strong> serializes everything through one consumer: no per-account parallelism, no ordering guarantee from the queue itself, and a throughput ceiling far below peak. <strong>C</strong> technically works but is operationally absurd (thousands of queues, consumer wiring, quota management) — a classic over-engineering distractor. <strong>D</strong> collapses all accounts into one lane: strict global ordering, concurrency 1, nowhere near 2,500 msg/s."
    },
    {
      q: "Messages in an SQS-backed image pipeline take up to 4 minutes to process. The team reports that some images are processed by two workers concurrently. The queue uses the default visibility timeout. What should be changed?",
      options: [
        "Increase the visibility timeout from the 30-second default to comfortably exceed worst-case processing time, and have workers extend it via ChangeMessageVisibility for long jobs",
        "Enable long polling with WaitTimeSeconds of 20",
        "Convert the queue to FIFO to prevent concurrent delivery",
        "Add a dead-letter queue with maxReceiveCount of 1"
      ],
      answer: [0],
      multi: false,
      explanation: "With the default 30 s visibility timeout, a message being processed for 4 minutes reappears after 30 s and a second worker legitimately receives it — the lease expired mid-job. Raise the timeout above worst-case processing (and use the heartbeat/extension pattern for outliers). <strong>B</strong> reduces empty receives and cost; it has zero effect on redelivery of in-flight messages. <strong>C</strong> is a misconception: FIFO blocks concurrent delivery within a message group, but the message would still be redelivered after visibility expiry — and turning on FIFO to mask a lease bug adds throughput limits for nothing. <strong>D</strong> makes things worse: one visibility expiry would dead-letter a perfectly good message."
    },
    {
      q: "An order-processing system must notify three independent services (inventory, billing, notifications) when an order is placed. Each service must be able to process events at its own pace, survive its own downtime without losing events, and receive only relevant event types. Which architecture is best?",
      options: [
        "An SNS topic with each service's Lambda function subscribed directly, using filter policies",
        "An SNS topic with one SQS queue per service subscribed, filter policies on each subscription, and each service consuming from its own queue",
        "A single SQS queue that all three services poll, with each service ignoring irrelevant messages",
        "Three separate SNS topics, with the producer publishing each event to all three"
      ],
      answer: [1],
      multi: false,
      explanation: "SNS-to-SQS fanout is the canonical pattern for exactly these requirements: the topic broadcasts once, each queue durably buffers for its consumer (own pace, survives downtime, per-consumer DLQ), and subscription filter policies deliver only matching event types. <strong>A</strong> fails the durability requirement: direct Lambda subscription depends on SNS's retry policy, and a service outage longer than retries means lost events (a subscription DLQ catches delivery failure but gives no backpressure or paced consumption). <strong>C</strong> breaks fundamentally: SQS delivers each message to <em>one</em> consumer — the services would steal each other's messages. <strong>D</strong> pushes fanout into the producer (triple publishes, partial-failure handling) and still lacks buffering."
    },
    {
      q: "A SaaS company wants events from its Datadog and Zendesk accounts routed to different Lambda functions based on event content, with the ability to replay the last 30 days of events after consumer bugs. Which service should be the backbone?",
      options: [
        "SNS topics with filter policies and a subscription DLQ",
        "EventBridge with partner event sources, content-based rules, and an archive with 30-day retention for replay",
        "Kinesis Data Streams with 30-day retention and one consumer per team",
        "SQS FIFO queues with message attributes for routing"
      ],
      answer: [1],
      multi: false,
      explanation: "Three requirements map one-to-one to EventBridge: SaaS ingestion → partner event sources (Datadog and Zendesk are actual EventBridge partners, no webhook infrastructure needed); content-based routing → rule patterns on the event body; replay → archive with retention and replay onto the bus. <strong>A</strong> has no SaaS ingestion story and no replay — SNS cannot re-deliver past messages. <strong>C</strong> offers retention/replay but no native SaaS integration (you would build webhook receivers) and no declarative content routing to different Lambdas. <strong>D</strong> is a queue, not a router: no fanout, no SaaS sources, no replay."
    },
    {
      q: "A web application experiences unpredictable traffic spikes that overwhelm its RDS database during writes. Writes can tolerate a few seconds of delay. What is the standard architectural remediation?",
      options: [
        "Put the write requests into an SQS queue and have a worker fleet consume at a controlled rate the database can sustain",
        "Publish writes to an SNS topic subscribed by the database",
        "Enable RDS Multi-AZ so the standby absorbs the extra writes",
        "Stream the writes through Kinesis Data Firehose into RDS"
      ],
      answer: [0],
      multi: false,
      explanation: "This is the exam's signature SQS scenario: pull-based consumption means workers drain at a rate you control, and the queue backlog absorbs the spike — the database never sees more than the workers send. A few seconds of tolerated delay is the tell that asynchronous buffering is acceptable. <strong>B</strong> is impossible as stated (databases don't subscribe to SNS) and push delivery would transfer the spike, not absorb it. <strong>C</strong> is availability, not capacity: the Multi-AZ standby serves no traffic. <strong>D</strong> is wrong twice — RDS is not a Firehose destination, and Firehose's buffered batch delivery is for analytics stores, not OLTP writes."
    },
    {
      q: "Clickstream data at 6 MB per second must be consumed in near-real time by three independent applications: fraud detection (latency-critical), personalization, and an archival process. Historical reprocessing for up to 7 days must be possible. Which design fits?",
      options: [
        "An SQS standard queue with all three applications polling it",
        "A Kinesis Data Stream with at least 6 shards, 7-day retention, enhanced fan-out consumers for the applications, and Firehose (or the archival app) writing to S3",
        "An SNS topic fanning out to three SQS queues with 7-day message retention",
        "Kinesis Data Firehose delivering to S3, with all three applications reading from S3"
      ],
      answer: [1],
      multi: false,
      explanation: "6 MB/s ingest needs ≥6 shards (1 MB/s write each); three consumers on the shared 2 MB/s read path would starve each other, so enhanced fan-out gives each its own 2 MB/s per shard with ~70 ms push latency (fraud detection's requirement); 7-day retention enables reprocessing; the log model lets every consumer keep its own cursor. <strong>A</strong> fails immediately: three SQS consumers compete for messages — each message reaches only one app — and there is no replay. <strong>C</strong> gets fanout but SQS retention is not replay: once a consumer deletes a message it is gone, and 14-day retention only holds unconsumed messages; reprocessing already-consumed data is impossible. <strong>D</strong> sacrifices latency (buffered batch delivery) — fatal for fraud detection — though it would suit the archival leg alone."
    },
    {
      q: "A Kinesis Data Streams consumer application has begun logging ReadProvisionedThroughputExceeded errors and increased propagation delay after a fourth consuming application was added to the stream. Writes are unaffected. What is the most direct fix?",
      options: [
        "Split every shard to double the stream's capacity",
        "Register the consumers for enhanced fan-out so each gets a dedicated 2 MB/s per shard over HTTP/2 push",
        "Switch the stream from provisioned to on-demand capacity mode",
        "Reduce the batch size in each consumer's GetRecords calls"
      ],
      answer: [1],
      multi: false,
      explanation: "The symptom is the classic shared-throughput ceiling: all classic consumers split 2 MB/s and 5 GetRecords calls/s per shard, so a fourth application tipped the read path into throttling. Enhanced fan-out removes the contention — each registered consumer gets its own 2 MB/s per shard, pushed with ~70 ms latency. <strong>A</strong> would also double read capacity but doubles cost across the board and re-keys the shard map — a blunt instrument when the write side is healthy and the problem is per-shard read <em>sharing</em>. <strong>C</strong> changes billing and write scaling, not the shared consumer read model — on-demand streams still cap classic consumers the same way. <strong>D</strong> shuffles the same insufficient budget among the same consumers."
    },
    {
      q: "A company must load streaming application logs into Amazon OpenSearch Service and an S3 data lake in Parquet format. They want no consumer code and no capacity management, and near-real-time delivery is acceptable. Which service should they use?",
      options: [
        "Kinesis Data Streams with a KCL application writing to both destinations",
        "Amazon Data Firehose with two delivery configurations, using built-in format conversion for the S3 Parquet output",
        "EventBridge rules targeting OpenSearch and S3",
        "Amazon MQ with consumers writing to each destination"
      ],
      answer: [1],
      multi: false,
      explanation: "Firehose is purpose-built for this: fully serverless buffered delivery to OpenSearch and S3, built-in JSON-to-Parquet format conversion (with dynamic partitioning), retries plus an error prefix — zero consumer code, zero shards. Near-real-time tolerance is the explicit signal that Firehose's buffering is acceptable. <strong>A</strong> means writing, hosting, and scaling a KCL fleet plus the Parquet conversion yourself — everything the question excludes. <strong>C</strong> is not a data-delivery pipeline; EventBridge has no OpenSearch bulk-loading or Parquet capability and is throttled far below log-stream volumes. <strong>D</strong> is a message broker for protocol compatibility, with no delivery-to-analytics story at all."
    },
    {
      q: "A manufacturer is migrating an on-premises order system to AWS. The system's components communicate through IBM-MQ-style JMS queues over AMQP, and the business mandates minimal changes to application code. Which migration target should the architect choose for messaging?",
      options: [
        "Amazon SQS FIFO queues, since they also guarantee ordering",
        "Amazon MQ, because it exposes standard protocols such as AMQP, MQTT, and JMS-compatible interfaces the existing code can use with a connection-string change",
        "Amazon SNS with HTTP subscriptions wrapping the legacy endpoints",
        "Amazon MSK, because Kafka can emulate JMS semantics"
      ],
      answer: [1],
      multi: false,
      explanation: "The keywords are 'JMS,' 'AMQP,' and 'minimal changes' — the Amazon MQ pattern verbatim. MQ runs managed ActiveMQ/RabbitMQ speaking open wire protocols, so legacy clients repoint a broker URL instead of being rewritten. <strong>A</strong> fails the constraint: SQS's proprietary HTTP API means rewriting every producer and consumer — ordering was never the blocker. <strong>C</strong> misunderstands the problem: SNS neither speaks AMQP nor replaces queue semantics for JMS clients. <strong>D</strong> is wrong tooling: Kafka's protocol is its own; 'emulating JMS' would be a porting project, not a migration shortcut — MSK answers 'we already run Kafka,' not 'we run JMS.'"
    },
    {
      q: "An EventBridge rule routes payment events to a Lambda target. During a regional incident, some events failed delivery to the target after all retries, and the team discovered they were lost. Additionally, they now need failed events preserved and the last 90 days of matched events re-processable. Which TWO configurations address these needs? (Select TWO.)",
      options: [
        "Configure a dead-letter queue on the rule's target so undeliverable events are preserved in SQS",
        "Create an EventBridge archive with 90-day retention for the event pattern and use replay when reprocessing is needed",
        "Enable content-based deduplication on the event bus",
        "Increase the rule's target limit from 5 to 50",
        "Enable EventBridge Scheduler on the bus"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<strong>A</strong>: each EventBridge target supports a DLQ; events that exhaust the retry policy (default up to 24 h / 185 attempts) land in the queue instead of vanishing — solving the loss. <strong>B</strong>: an archive captures matching events for its retention window, and replay re-emits them through the bus's rules — solving the 90-day reprocessing requirement. <strong>C</strong> does not exist — buses have no dedup feature (and duplicates were not the problem). <strong>D</strong> is a fake knob; the 5-targets-per-rule limit is fixed and irrelevant to delivery failure. <strong>E</strong> confuses the Scheduler (cron/one-time schedule invocations) with delivery reliability."
    },
    {
      q: "A team needs to read records from a DynamoDB stream, filter for only ORDER_CANCELLED events, enrich each with customer data from an internal API, and deliver the result to a Step Functions workflow — with as little custom glue code as possible. What is the most direct solution?",
      options: [
        "A Lambda function on the DynamoDB stream that filters, calls the API, and starts the workflow",
        "An EventBridge Pipe with the DynamoDB stream as source, a filter step, an API destination or Lambda enrichment, and the Step Functions state machine as target",
        "Kinesis Data Firehose reading the stream with a transformation Lambda",
        "An SNS topic subscribed to the DynamoDB stream with a filter policy"
      ],
      answer: [1],
      multi: false,
      explanation: "This is the EventBridge Pipes use case stated almost as its documentation describes it: one source (DynamoDB Streams is supported), declarative filtering, an enrichment stage, one target (Step Functions) — the glue Lambda's entire job absorbed into configuration. <strong>A</strong> works and is the traditional answer, but the question's 'as little custom glue code as possible' disqualifies it against Pipes. <strong>C</strong> is invalid — Firehose does not read DynamoDB streams and delivers to analytics stores, not Step Functions. <strong>D</strong> is impossible: SNS cannot subscribe to a DynamoDB stream, and filter policies would not enrich anything."
    },
    {
      q: "During a flash sale, a Kinesis Data Stream in provisioned mode with 4 shards began rejecting writes with ProvisionedThroughputExceededException. Producers send user-ID-keyed records averaging 1 KB at peaks of 9,000 records per second, spread evenly across users. Which changes would resolve the write throttling? (Select TWO.)",
      options: [
        "Reshard the stream to at least 9 shards to cover 9,000 records per second at 1,000 records per shard",
        "Switch the stream to on-demand capacity mode ahead of sales events",
        "Enable enhanced fan-out for the producers",
        "Reduce the partition key cardinality so records concentrate on fewer shards",
        "Increase the visibility timeout on the stream"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "Each shard ingests 1 MB/s <em>or</em> 1,000 records/s, whichever binds first — here the record-count dimension binds (9,000 rec/s at only ~9 MB/s… actually ~9 MB/s also needs 9 shards; both dimensions agree): 4 shards cap at 4,000 rec/s, so <strong>A</strong> (reshard to ≥9) directly fixes it. <strong>B</strong> also works: on-demand mode auto-scales write capacity for spiky, event-driven traffic — the recommended posture for unpredictable sales peaks. <strong>C</strong> is a <em>consumer</em>-side feature; it cannot affect write throttling. <strong>D</strong> is backwards — lower key cardinality causes hot shards and makes throttling worse. <strong>E</strong> imports an SQS concept; streams have no visibility timeout."
    },
    {
      q: "A batch-oriented consumer polls an SQS queue every few seconds. Cost analysis shows a large bill from millions of empty ReceiveMessage responses, and message latency is inconsistent. What is the recommended change?",
      options: [
        "Enable long polling by setting ReceiveMessageWaitTimeSeconds to 20 on the queue",
        "Reduce the message retention period to 1 hour",
        "Switch to a FIFO queue to make polling deterministic",
        "Add a delay queue setting of 15 minutes"
      ],
      answer: [0],
      multi: false,
      explanation: "Long polling holds each ReceiveMessage call open up to 20 s until messages arrive, querying all storage hosts: empty responses (and their per-request charges) collapse, and delivery latency improves because messages return the moment they arrive instead of on the next poll tick. It is the default recommendation for almost every SQS consumer. <strong>B</strong> changes how long unconsumed messages survive — irrelevant to request volume. <strong>C</strong>: FIFO alters ordering/dedup semantics, not polling economics; empty receives bill the same. <strong>D</strong> hides new messages for 15 minutes — actively increasing latency while doing nothing about empty polls."
    },
    {
      q: "An architect must choose between Kinesis Data Streams and SQS for a new workload. Which THREE requirements, if present, specifically indicate Kinesis over SQS? (Select THREE.)",
      options: [
        "Multiple independent applications must consume every record",
        "Records must be re-processable for up to a year after ingestion",
        "Consumers must acknowledge and delete each message individually after processing",
        "Strict ordering by device ID at hundreds of thousands of records per second",
        "The queue backlog must absorb producer bursts while a small worker fleet drains slowly",
        "Messages larger than 100 MB must be supported natively"
      ],
      answer: [0, 1, 3],
      multi: true,
      explanation: "<strong>A</strong>: SQS delivers each message to one consumer; Kinesis gives every consumer an independent cursor over the same log. <strong>B</strong>: Kinesis retention extends to 365 days with replay from any point; consumed SQS messages are gone. <strong>D</strong>: partition-key ordering at ingest scale is Kinesis's model — SQS FIFO tops out at 3,000 msg/s batched, orders of magnitude short. <strong>C</strong> indicates SQS: per-message ack/delete is queue semantics; Kinesis checkpoints positions, not messages. <strong>E</strong> indicates SQS: pull-paced buffering is its defining feature. <strong>F</strong> indicates neither natively (Kinesis caps at 1 MB, SQS at 256 KB/1 MB) — that requirement points to the S3 claim-check pattern or MSK with tuned limits."
    }
  ],
  flashcards: [
    { front: "Why are duplicates inherent to SQS standard queues?", back: "Messages are stored as redundant copies across a fleet of hosts; if a host is unreachable when a delete lands, its copy resurfaces later. At-least-once delivery is architectural — consumers must be idempotent." },
    { front: "SQS FIFO: what are the two mechanisms behind exactly-once processing?", back: "<strong>Deduplication</strong> (5-minute window, explicit ID or content hash — defeats producer retries) and <strong>message groups</strong> (per-group ordered delivery with only one batch in flight per group)." },
    { front: "SQS FIFO throughput limits?", back: "<strong>300 TPS</strong> unbatched, <strong>3,000 messages/s with 10-message batches</strong>. High-throughput mode raises this via partitioned message groups. Standard queues: effectively unlimited." },
    { front: "What is a message group in a FIFO queue, conceptually?", back: "An <strong>ordered lane with concurrency 1</strong>: strict order within the group, parallelism across groups. Group-key cardinality sets your parallelism ceiling — same logic as Kafka/Kinesis partition keys." },
    { front: "SQS visibility timeout: default, max, and what happens on expiry?", back: "Default <strong>30 s</strong>, max <strong>12 h</strong>. It is a lease: if the consumer doesn't delete in time, the message becomes visible again and is redelivered — the source of duplicate processing when set too short. Extend via ChangeMessageVisibility." },
    { front: "How does the poison-pill / DLQ pattern work in SQS?", back: "Redrive policy on the source queue: after <code>maxReceiveCount</code> receives, the message moves to the dead-letter queue. Alarm on DLQ depth; use redrive-to-source to replay after fixing the bug. FIFO source needs FIFO DLQ." },
    { front: "Long polling vs short polling in SQS?", back: "Short: samples a host subset, returns instantly (can be falsely empty), bills per call. Long (WaitTimeSeconds up to <strong>20 s</strong>): queries all hosts, waits for messages — fewer requests, lower cost, lower latency. Almost always use long." },
    { front: "How do you send a 5 MB payload through SQS or SNS?", back: "Claim-check pattern: the Extended Client Library stores the payload in S3 and enqueues a pointer (both cap at 256 KB natively). You then own S3 lifecycle for the payload objects." },
    { front: "Why fan out SNS to SQS queues instead of subscribing Lambdas directly?", back: "Queues add per-consumer <strong>durability</strong> (14-day buffer), pacing/backpressure, isolation of consumer outages, and their own retry/DLQ/redrive story. Direct push depends on SNS retry policy and drops messages after exhaustion." },
    { front: "What do SNS filter policies do, and on what do they match?", back: "Per-subscription filtering so SNS delivers only matching messages — exact/prefix/numeric-range/anything-but/exists operators against message <strong>attributes</strong> (or the body with message-body scope). Turns one topic into a content-based router." },
    { front: "SNS raw message delivery — what changes?", back: "Disabled (default): subscriber receives the SNS JSON envelope with the payload in the Message field. Enabled: the bare original payload is delivered — essential for SQS subscribers whose consumers shouldn't unwrap envelopes." },
    { front: "SNS delivery retries: AWS endpoints vs HTTP endpoints?", back: "SQS/Lambda targets: retried with backoff for up to ~<strong>23 days</strong>. HTTP/S: a configurable delivery policy that gives up in minutes by default — then the message is dropped unless a subscription DLQ is set." },
    { front: "SNS vs EventBridge in one line each", back: "SNS: massive push fanout, multi-protocol (SQS/Lambda/HTTP/email/SMS), FIFO topics, no replay. EventBridge: content-pattern routing on a bus, cross-account, SaaS partner sources, archive+replay, API destinations — ~5 targets/rule, no ordering." },
    { front: "What are EventBridge partner event sources?", back: "SaaS vendors (Datadog, Zendesk, Auth0…) push events natively into a partner event bus in your account — no webhook receivers or polling infrastructure. A strong exam tell for EventBridge." },
    { front: "EventBridge archive and replay — capability and limit?", back: "Archives capture pattern-matched events with configurable retention; replay re-emits them onto the bus for a chosen time window so rules reprocess them. Router-level recovery — not consumer-cursor replay like Kinesis." },
    { front: "What is an EventBridge Pipe?", back: "Managed point-to-point connector: one source (SQS, Kinesis, DynamoDB Streams, MSK, MQ) → filter → optional enrichment (Lambda/Step Functions/API) → one target. Replaces single-purpose glue Lambdas." },
    { front: "EventBridge Scheduler vs scheduled rules?", back: "Scheduler is the newer, larger-scale facility: millions of schedules, <strong>one-time</strong> schedules, timezone-aware cron with DST handling, flexible windows, any AWS API as target. Scheduled rules are the legacy mechanism." },
    { front: "Kinesis shard limits (the exam arithmetic)", back: "Write: <strong>1 MB/s or 1,000 records/s</strong> per shard. Read: <strong>2 MB/s per shard shared</strong> across classic consumers (5 GetRecords/s) — or 2 MB/s <em>per consumer</em> per shard with enhanced fan-out. Record max 1 MB." },
    { front: "Kinesis retention range?", back: "Default <strong>24 hours</strong>, extendable to 7 days, maximum <strong>365 days</strong> (extended retention billed extra). Consumers replay from any point in retention via shard iterators (AT_TIMESTAMP, TRIM_HORIZON…)." },
    { front: "When do you need Kinesis enhanced fan-out?", back: "Three or more consumers on one stream, or latency-sensitive consumers: EFO gives each registered consumer a dedicated 2 MB/s per shard, pushed over HTTP/2 at ~70 ms vs ~200 ms+ shared polling. Costs per consumer-shard-hour + per GB." },
    { front: "Kinesis provisioned vs on-demand mode?", back: "Provisioned: you manage shard count (split/merge resharding), pay per shard-hour — cheapest for steady known load. On-demand: pay per GB, auto-scales to ~2x prior peak — for spiky/unknown traffic. Switchable twice per 24 h." },
    { front: "Kinesis vs SQS: the three-word discriminators", back: "Kinesis: <strong>replay, ordering (per key at scale), multiple consumers</strong>. SQS: <strong>buffering, per-message retry/delete, work distribution</strong>. 'Real-time analytics / clickstream / IoT' → Kinesis; 'decouple / burst protection' → SQS." },
    { front: "Firehose in one line — and what it cannot do", back: "Serverless <em>buffered</em> delivery of streaming data to S3/Redshift/OpenSearch/Splunk/HTTP with optional Lambda transform and Parquet conversion; pay per GB. No storage, no replay, no consumers read from it — it is a pipe, not a log." },
    { front: "When is Amazon MQ the right answer?", back: "Lift-and-shift of apps speaking open protocols — <strong>JMS, AMQP, MQTT, OpenWire, STOMP</strong> (ActiveMQ/RabbitMQ) — with minimal code change. Broker-based, instance-priced, active/standby failover. Never the greenfield choice; that's SQS/SNS/EventBridge." },
    { front: "Who owns the cursor: SQS vs SNS/EventBridge vs Kinesis?", back: "SQS: the <strong>service</strong> tracks per-message delivery state. SNS/EventBridge: <strong>nobody</strong> — deliver and forget. Kinesis/MSK: the <strong>consumer</strong> owns its cursor over an immutable log. Every capability difference (replay, fanout, buffering) follows from this." }
  ],
  lab: {
    title: "Lab: SNS fanout to filtered SQS queues with a DLQ and redrive",
    html: `
<h3>Goal</h3>
<p>Build the canonical fanout: one SNS topic, two SQS queues subscribed with filter policies (orders vs high-value orders), raw message delivery, a DLQ with maxReceiveCount, and a redrive back to source. Everything is free-tier; total cost is effectively zero. Region assumed us-east-1.</p>

<h3>Architecture</h3>
<p>Topic <code>orders-topic</code> fans out to <code>orders-all</code> (every order) and <code>orders-vip</code> (filter: amount &gt;= 1000). A third queue <code>orders-dlq</code> is wired as the DLQ of <code>orders-all</code> with maxReceiveCount 2, so we can watch a poison message dead-letter and then redrive it.</p>

<h3>Steps</h3>
<ol>
<li><p>Create the topic and queues, and capture their identifiers:</p>
<pre><code>TOPIC_ARN=$(aws sns create-topic --name orders-topic --query TopicArn --output text)
for q in orders-all orders-vip orders-dlq; do aws sqs create-queue --queue-name $q; done
Q_ALL=$(aws sqs get-queue-url --queue-name orders-all --query QueueUrl --output text)
Q_VIP=$(aws sqs get-queue-url --queue-name orders-vip --query QueueUrl --output text)
Q_DLQ=$(aws sqs get-queue-url --queue-name orders-dlq --query QueueUrl --output text)
ARN_ALL=$(aws sqs get-queue-attributes --queue-url $Q_ALL --attribute-names QueueArn --query Attributes.QueueArn --output text)
ARN_VIP=$(aws sqs get-queue-attributes --queue-url $Q_VIP --attribute-names QueueArn --query Attributes.QueueArn --output text)
ARN_DLQ=$(aws sqs get-queue-attributes --queue-url $Q_DLQ --attribute-names QueueArn --query Attributes.QueueArn --output text)</code></pre></li>

<li><p>Allow the topic to send to both queues (the step everyone forgets — without this policy, SNS deliveries silently fail):</p>
<pre><code>for pair in "$Q_ALL $ARN_ALL" "$Q_VIP $ARN_VIP"; do
  set -- $pair
  aws sqs set-queue-attributes --queue-url $1 --attributes '{
    "Policy": "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"sns.amazonaws.com\"},\"Action\":\"sqs:SendMessage\",\"Resource\":\"'$2'\",\"Condition\":{\"ArnEquals\":{\"aws:SourceArn\":\"'$TOPIC_ARN'\"}}}]}"
  }'
done</code></pre></li>

<li><p>Subscribe both queues with raw message delivery; add a numeric filter policy to the VIP queue:</p>
<pre><code>SUB_ALL=$(aws sns subscribe --topic-arn $TOPIC_ARN --protocol sqs \
  --notification-endpoint $ARN_ALL --attributes RawMessageDelivery=true \
  --query SubscriptionArn --output text)
SUB_VIP=$(aws sns subscribe --topic-arn $TOPIC_ARN --protocol sqs \
  --notification-endpoint $ARN_VIP --attributes RawMessageDelivery=true \
  --query SubscriptionArn --output text)
aws sns set-subscription-attributes --subscription-arn $SUB_VIP \
  --attribute-name FilterPolicy \
  --attribute-value '{"amount":[{"numeric":[">=",1000]}]}'</code></pre></li>

<li><p>Wire the DLQ onto orders-all with maxReceiveCount 2, and set a short visibility timeout so the lab moves fast:</p>
<pre><code>aws sqs set-queue-attributes --queue-url $Q_ALL --attributes '{
  "RedrivePolicy": "{\"deadLetterTargetArn\":\"'$ARN_DLQ'\",\"maxReceiveCount\":\"2\"}",
  "VisibilityTimeout": "5",
  "ReceiveMessageWaitTimeSeconds": "20"
}'</code></pre></li>

<li><p>Publish two orders — one small, one VIP — with the amount as a message attribute (filter policies match attributes by default):</p>
<pre><code>aws sns publish --topic-arn $TOPIC_ARN --message '{"orderId":"A1","amount":50}' \
  --message-attributes '{"amount":{"DataType":"Number","StringValue":"50"}}'
aws sns publish --topic-arn $TOPIC_ARN --message '{"orderId":"B2","amount":2500}' \
  --message-attributes '{"amount":{"DataType":"Number","StringValue":"2500"}}'</code></pre></li>

<li><p>Verify the fanout and the filter: orders-all should hold both messages; orders-vip only the 2500 one, and (thanks to raw delivery) the body is your bare JSON, no SNS envelope:</p>
<pre><code>aws sqs receive-message --queue-url $Q_VIP --max-number-of-messages 10 \
  --query 'Messages[].Body'
aws sqs receive-message --queue-url $Q_ALL --max-number-of-messages 10 \
  --query 'Messages[].Body'</code></pre></li>

<li><p>Simulate a poison message: receive from orders-all repeatedly <em>without deleting</em>. After 2 failed receive cycles (maxReceiveCount 2, visibility timeout 5 s), SQS moves the messages to the DLQ:</p>
<pre><code>for i in 1 2 3; do
  aws sqs receive-message --queue-url $Q_ALL --wait-time-seconds 10 \
    --query 'Messages[].{id:MessageId,rc:Attributes.ApproximateReceiveCount}' \
    --attribute-names ApproximateReceiveCount
  sleep 6   # let the visibility timeout lapse
done
aws sqs get-queue-attributes --queue-url $Q_DLQ \
  --attribute-names ApproximateNumberOfMessages --query Attributes</code></pre></li>

<li><p>Redrive the dead-lettered messages back to the source queue — the built-in replay:</p>
<pre><code>aws sqs start-message-move-task --source-arn $ARN_DLQ
sleep 5
aws sqs get-queue-attributes --queue-url $Q_ALL \
  --attribute-names ApproximateNumberOfMessages --query Attributes</code></pre></li>
</ol>

<h3>Verify</h3>
<ul>
<li>Step 6: orders-vip contains only order B2 (the filter dropped A1 at the topic, not in your code); bodies are raw JSON.</li>
<li>Step 7: ApproximateReceiveCount climbs to 2, then the DLQ count goes positive while orders-all empties — the poison-pill lifecycle end to end.</li>
<li>Step 8: messages return to orders-all with the DLQ empty — redrive-to-source, no pump script.</li>
</ul>

<h3>Teardown</h3>
<p>Subscriptions die with the topic; queues are deleted directly. Order: topic first (stops deliveries), then queues.</p>
<ol>
<li><pre><code>aws sns delete-topic --topic-arn $TOPIC_ARN</code></pre></li>
<li><pre><code>aws sqs delete-queue --queue-url $Q_ALL
aws sqs delete-queue --queue-url $Q_VIP
aws sqs delete-queue --queue-url $Q_DLQ</code></pre></li>
<li><p>Confirm nothing remains:</p>
<pre><code>aws sqs list-queues --queue-name-prefix orders-
aws sns list-topics --query 'Topics[?contains(TopicArn, &#96;orders&#96;)]'</code></pre>
<p>(If the JMESPath backtick syntax fights your shell, plain <code>aws sns list-topics</code> and an eyeball works fine.)</p></li>
</ol>
<p>Cost check: SNS and SQS free tiers cover millions of requests monthly; this lab used a few dozen. Nothing here bills while idle, but deleting keeps the account clean.</p>
`
  }
});
