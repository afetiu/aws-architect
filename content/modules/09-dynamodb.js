/* Module 09 — DynamoDB Deep Dive (SAA track) */
window.COURSE.register({
  id: "dynamodb",
  order: 9,
  track: "saa",
  title: "DynamoDB Deep Dive",
  description: "DynamoDB from the partition layer up: how consistent hashing, 10 GB splits, and adaptive capacity actually behave; key design and capacity math that determine whether the service is cheap or a throttling incident; GSIs, transactions, Streams, Global Tables — and the honest list of things DynamoDB is bad at.",
  examWeight: "High yield on SAA-C03. RCU/WCU arithmetic, GSI vs LSI, DAX vs ElastiCache, Streams-triggers-Lambda, Global Tables for multi-region, and on-demand vs provisioned appear constantly.",
  lessons: [
    {
      id: "partitions-internals",
      title: "Partitions, hashing, and why hot keys still hurt",
      html: `
<p>DynamoDB is a partitioned, replicated key-value store descended from the Dynamo paper, but with a crucial difference a senior should note immediately: unlike the original Dynamo's eventually-consistent multi-master ring, DynamoDB uses <strong>single-leader replication per partition</strong> over three AZs, with Paxos-elected leaders. Every design rule and every throttling behavior falls out of the partition model, so start there.</p>

<h3>The partition model</h3>
<ul>
<li>Your table is split into <strong>partitions</strong>, each a replicated storage unit (three replicas across three AZs; the leader takes all writes and strongly consistent reads; followers serve eventually consistent reads).</li>
<li>An item's partition is chosen by <strong>hashing the partition key</strong> — consistent hashing over the keyspace. All items sharing a partition key (an <strong>item collection</strong>, when there is a sort key) live in the same partition and are stored <strong>sorted by the sort key</strong> — this is what makes Query efficient range scans within a collection.</li>
<li>Each physical partition has hard ceilings: roughly <strong>10 GB of storage, 3,000 RCU, and 1,000 WCU</strong>. These are per-partition physics, not table settings — the table's total throughput is the sum over partitions.</li>
</ul>

<h3>Splits: how tables scale</h3>
<p>DynamoDB splits partitions in two situations: a partition approaching <strong>10 GB</strong> splits by keyspace, and a partition under sustained throughput pressure can <strong>split for heat</strong> — including, in modern DynamoDB, splitting <em>within</em> a single item collection's sort-key range, so one huge collection can span partitions (with the caveat that an LSI-bearing table cannot split a collection, which is where the 10 GB collection limit comes from — next lessons). Splits are one-way; partitions never merge. A historical spike that forced splits leaves its footprint in partition count forever, which used to dilute per-partition throughput in the pre-adaptive era and still matters for understanding older write-ups.</p>

<div class="callout deep">Mental model for the storage engine: think LSM-ish B-tree per partition with the item collection as the unit of locality. A Query with a partition key and sort-key condition is a single-partition, index-ordered range read — this is the only access pattern the engine truly loves. Everything else (Scan, cross-collection aggregation) is the engine grinding through pages.</div>

<h3>Adaptive capacity — and its limits</h3>
<p>Historically, provisioned throughput was divided <em>evenly</em> across partitions: 10,000 WCU over 20 partitions meant 500 WCU each, and one hot key throttled while the table sat 95 percent idle. <strong>Adaptive capacity</strong> fixed most of that: it now works instantly and automatically, letting a hot partition <strong>borrow unused throughput from the rest of the table</strong>, and DynamoDB will isolate frequently-hot keys onto their own partitions via heat splits.</p>
<p>But adaptive capacity bends physics, it does not repeal it: <strong>a single partition key can never exceed 3,000 RCU / 1,000 WCU</strong>, because one key's item collection leader lives on one partition (a collection can split by sort-key range, but a single sort-key-less key cannot). If your workload funnels writes to one counter item or one tenant ID, no table-level setting saves you. That is a key-design problem, and it is yours.</p>

<div class="callout limits">Numbers to memorize: partition ceilings <strong>3,000 RCU / 1,000 WCU / ~10 GB</strong>; item max <strong>400 KB</strong>; Query/Scan response page <strong>1 MB</strong> before filtering; per-key ceiling = one partition's ceiling. Table-level throughput is effectively unlimited (account soft quotas aside) because partitions are added horizontally.</div>

<h3>Throttling semantics</h3>
<p>Exceeding capacity yields <code>ProvisionedThroughputExceededException</code> — a 400-class error the SDK retries with exponential backoff and jitter. Short bursts are absorbed by <strong>burst capacity</strong> (up to 5 minutes of unused throughput retained per partition, best-effort). Sustained hot-key pressure produces sustained throttling, and the CloudWatch metric to reach for is <code>ThrottledRequests</code> plus the CloudWatch Contributor Insights view that names the hot keys.</p>

<div class="callout war">The classic incident: a tenant goes viral, all their traffic shares one partition key, and the table throttles that tenant while global metrics look healthy. Dashboards that only watch table-level consumed-vs-provisioned miss it entirely. If per-tenant isolation matters, per-tenant heat is a first-class design input — write sharding or key redesign, covered next.</div>

<h3>Why this matters architecturally</h3>
<p>Relational engines let you defer physical design; DynamoDB does not. The partition key IS your unit of scale, isolation, and locality simultaneously. Every subsequent topic — key design, capacity math, GSI throttling, Global Tables — is a corollary of this lesson. When an exam scenario says "some requests are throttled although provisioned capacity far exceeds consumed capacity," it is testing exactly this: hot partition, fix the key schema or shard the writes, not the table's dials.</p>
`
    },
    {
      id: "key-design",
      title: "Key design: cardinality, write sharding, and single-table honesty",
      html: `
<p>DynamoDB schema design inverts the relational habit: you do not model entities and then query flexibly — you <strong>enumerate access patterns first</strong> and encode each one as a key lookup or a sort-key range. Get the keys right and DynamoDB is boringly fast at any scale; get them wrong and no capacity mode rescues you.</p>

<h3>Partition key: cardinality and spread</h3>
<p>The partition key must satisfy two properties: <strong>high cardinality</strong> (many distinct values) and <strong>even access distribution</strong> (no value dominates). User ID, order ID, device ID: good. Status flags, dates, country codes, boolean-ish enums: catastrophic — all of today's traffic hashes to a handful of partitions. Note the subtlety: cardinality alone is insufficient. Millions of device IDs where one device produces 80 percent of events is still a hot key.</p>

<h3>Write sharding: manufacturing cardinality</h3>
<p>When a naturally low-cardinality or naturally hot key is unavoidable — a global counter, a per-day leaderboard, a celebrity tenant — you <strong>shard the key</strong>: append a suffix (random from a fixed range, or calculated from an attribute) so writes spread over N partition keys.</p>
<pre><code>PK = "GAME#2026-07-21#" + (hash(userId) % 10)   // 10 shards</code></pre>
<ul>
<li>Writes scale by N (each shard gets its own partition-level ceiling).</li>
<li>Reads must now <strong>fan out</strong>: query all N shards and merge client-side. Choose N as small as your write rate allows, because read cost multiplies by it.</li>
<li>Calculated suffixes (deterministic, e.g. hash of an order ID) preserve single-shard reads for point lookups; random suffixes force scatter-gather for everything.</li>
</ul>

<div class="callout exam">"Writes to a single popular partition key are being throttled" → write sharding (add a suffix). "Requests throttled while table utilization is low" → hot partition, fix key design. Distractors offer switching to on-demand or raising provisioned capacity — neither lifts the per-key 1,000 WCU physics.</div>

<h3>Composite sort key patterns</h3>
<p>The sort key gives you ordered range queries inside an item collection. Overload it with a delimited hierarchy and one key schema answers many patterns:</p>
<pre><code>PK = "USER#123"
SK = "ORDER#2026-07-21#o-9812"      // orders by date: begins_with / between
SK = "PROFILE"                       // the singleton profile item
SK = "ADDR#home"                     // addresses
</code></pre>
<ul>
<li><code>begins_with(SK, "ORDER#2026-07")</code> = all July orders for that user, in order, one Query.</li>
<li>Sortable encodings matter: ISO-8601 timestamps, zero-padded numbers, ULIDs — anything whose lexicographic order equals its logical order.</li>
<li>Hierarchies compose left-to-right: <code>COUNTRY#STATE#CITY</code> supports country, country+state, and full-path queries — but never state-without-country. The sort key is a prefix tree, not an index per level.</li>
</ul>

<h3>Single-table design: the senior treatment</h3>
<p>Single-table design stores every entity type in one table with generic <code>PK</code>/<code>SK</code> attributes, overloaded per type, so related entities share item collections and a single Query fetches an aggregate (user + orders + addresses) in one round trip — the "pre-joined" read. The honest ledger:</p>
<table>
<thead><tr><th>Pro</th><th>Con</th></tr></thead>
<tbody>
<tr><td>1 request fetches a heterogeneous aggregate (no client-side join fan-out)</td><td>Illegible without the access-pattern doc; onboarding and debugging tax is real</td></tr>
<tr><td>Fewer tables to manage, alarm on, and autoscale (marginal in on-demand era)</td><td>GSIs are shared across all entity types — index overloading gets intricate</td></tr>
<tr><td>Item collections give transactional locality and LSI options</td><td>Analytics/export is painful: every consumer must understand the overloading</td></tr>
<tr><td>Encourages the discipline of enumerating access patterns up front</td><td>Access patterns change → key migrations, which in DynamoDB mean rewriting data</td></tr>
</tbody>
</table>
<p>The pragmatic position: single-table is a technique for <em>related entities queried together</em>, not an ideology. Unrelated domains gain nothing from cohabiting a table, and on-demand billing removed the old "capacity pooling" economic argument. Model aggregates together; keep strangers apart. The exam rarely tests single-table dogma — it tests whether you can pick a partition key and recognize hot-key scenarios.</p>

<div class="callout war">The costliest DynamoDB mistake is not a wrong capacity mode — it is choosing keys for entity elegance instead of access patterns, then discovering the missing pattern in production. A GSI can sometimes retrofit a pattern; a partition-key change means a full table migration (Scan → transform → write, or Streams-based dual-write). Budget design time up front where a relational schema would let you procrastinate.</div>

<div class="callout deep">Why "pre-joined" reads work: an item collection is physically contiguous and sorted, so Query returns user + orders + addresses from one partition's B-tree range — the same locality reasoning as a clustered index in SQL Server or an index-organized table in Oracle. You are trading write-time modeling effort for read-time locality, the oldest trade in databases.</div>
`
    },
    {
      id: "capacity-modes",
      title: "Capacity math: RCU/WCU arithmetic and on-demand economics",
      html: `
<p>DynamoDB bills on throughput, not compute, so the pricing model IS the performance model. The exam does straight arithmetic on this; production does compound-interest versions of the same arithmetic.</p>

<h3>The units</h3>
<ul>
<li><strong>1 WCU</strong> = one write per second of an item up to <strong>1 KB</strong>. Size rounds <em>up</em> per KB: a 3.1 KB item costs 4 WCU per write.</li>
<li><strong>1 RCU</strong> = one <strong>strongly consistent</strong> read per second of an item up to <strong>4 KB</strong>, or <strong>two eventually consistent</strong> reads of the same size. Size rounds up per 4 KB: an 8.5 KB item costs 3 RCU strong, 1.5 eventual.</li>
<li><strong>Transactional</strong> operations cost <strong>2x</strong>: a transactional write of a 1 KB item is 2 WCU; a transactional read of a 4 KB item is 2 RCU. (Under the hood: prepare + commit phases.)</li>
</ul>
<p>Worked example the exam loves: 10 writes/second of 2.5 KB items = 10 × ceil(2.5) = <strong>30 WCU</strong>. 20 eventually consistent reads/second of 5 KB items = 20 × ceil(5/4) / 2 = <strong>20 RCU</strong>. Query cost is computed on the <em>aggregate</em> size of items returned (rounded once), which is why fetching 100 small items via one Query is dramatically cheaper than 100 GetItems.</p>

<div class="callout exam">Do the arithmetic slowly: round item size up to the unit (1 KB writes, 4 KB reads) <em>before</em> multiplying by rate; halve for eventual reads; double for transactions. Most wrong answers on these questions are one forgotten rounding or one forgotten halving.</div>

<h3>Provisioned mode</h3>
<p>You declare RCU/WCU per table (and per GSI). Exceed it beyond burst capacity and you throttle. <strong>Auto scaling</strong> (Application Auto Scaling under the hood) adjusts provisioned capacity toward a target utilization (default 70 percent) between your min/max — but it reacts to CloudWatch metrics on a minutes-scale delay, so a vertical traffic spike outruns it and throttles until it catches up. Provisioned + reserved capacity is the cheapest possible DynamoDB for steady, predictable load.</p>

<h3>On-demand mode</h3>
<p>No dials: you pay per request. The economics: on-demand's per-request price corresponds to roughly <strong>6–7x</strong> the per-unit price of fully-utilized provisioned capacity. So the crossover is utilization: if your provisioned capacity would sit under about 15 percent average utilization (spiky, idle-most-of-the-day, unpredictable), on-demand is cheaper AND removes the throttling-on-spike problem. Flat 24/7 workloads should be provisioned (or better, reserved).</p>
<p><strong>On-demand still throttles.</strong> A new on-demand table sustains a floor of 4,000 WCU / 12,000 RCU equivalents, and beyond that it scales to <strong>double your previous peak</strong>; drive traffic past 2x prior peak fast enough and you get throttled until DynamoDB splits partitions and re-adapts (typically within 30 minutes). And per-partition/per-key physics (1,000 WCU per key) apply identically — on-demand is a billing mode, not a physics exemption. For known step-function events (product launch), either pre-warm by briefly provisioning high then switching modes, or ramp traffic.</p>

<div class="callout war">Two billing gotchas seniors hit. First: switching provisioned→on-demand is allowed but mode switches are limited (once per 24 h back to on-demand), so you cannot flap modes around a daily peak. Second: every GSI has its own capacity in provisioned mode — autoscaling the base table but forgetting the GSI is the most common self-inflicted throttling in provisioned tables, because a throttled GSI write throttles the base-table write (next lesson).</div>

<h3>Choosing</h3>
<table>
<thead><tr><th>Workload</th><th>Mode</th></tr></thead>
<tbody>
<tr><td>Steady, predictable, high volume</td><td>Provisioned + reserved capacity (cheapest)</td></tr>
<tr><td>Diurnal but forecastable</td><td>Provisioned + auto scaling (mind the lag)</td></tr>
<tr><td>Spiky, unpredictable, new product, dev/test</td><td>On-demand</td></tr>
<tr><td>Instant step to over 2x historical peak</td><td>Neither, without pre-warming — plan it</td></tr>
</tbody>
</table>

<div class="callout deep">Why the 2x-prior-peak rule exists: on-demand still runs on partitions, and accommodating more throughput means heat-splitting partitions, which takes time. DynamoDB pre-provisions 2x headroom over your observed peak so ordinary growth never notices; only step functions do. After a spike raises your peak, the new floor is remembered — capacity ratchets up, which is why the second launch-day never hurts like the first.</div>

<h3>Storage and other dimensions</h3>
<p>Beyond throughput you pay for storage GB-month (Standard vs <strong>Standard-IA</strong> table class — IA cuts storage cost ~60 percent but raises throughput prices ~25 percent; right for big, rarely-read tables), Streams reads, backups/PITR, Global Tables replicated writes, and data transfer out. There is no charge for the number of tables or indexes idle in on-demand — an empty on-demand table costs only its storage.</p>
`
    },
    {
      id: "gsi-vs-lsi",
      title: "GSIs vs LSIs: two very different animals",
      html: `
<p>Secondary indexes are how DynamoDB answers "query by something other than the primary key" — but the two index types have almost nothing in common mechanically, and the exam tests the differences precisely.</p>

<h3>Global Secondary Index (GSI)</h3>
<p>A GSI is best understood as <strong>a second table that DynamoDB maintains for you</strong>, with its own partition key and sort key chosen freely, populated asynchronously from the base table's write stream. Consequences:</p>
<ul>
<li><strong>Eventually consistent only.</strong> There is replication lag (normally milliseconds) between a base-table write and its visibility in the GSI. You cannot request a strongly consistent GSI read — the API refuses.</li>
<li><strong>Own capacity.</strong> In provisioned mode a GSI has its own RCU/WCU. Every base-table write that touches indexed attributes consumes GSI WCU too (more if the write moves an item between index key values — that is a delete + insert in the index).</li>
<li><strong>Throttling backpressure:</strong> if a GSI runs out of write capacity, <strong>the base table's writes throttle</strong> — DynamoDB will not let the index fall unboundedly behind. An under-provisioned GSI silently caps your table. This is a top-tier exam trap and a top-tier production incident.</li>
<li><strong>Created any time</strong>, including on existing tables (backfill runs online). Up to <strong>20 GSIs per table</strong> by default.</li>
<li><strong>Projections:</strong> KEYS_ONLY, INCLUDE (named attributes), or ALL. Projected attributes are duplicated storage; non-projected attributes are simply <em>not available</em> from the index — there is no automatic fetch-back to the base table (unlike an LSI, which does fetch back). Project exactly what the access pattern reads.</li>
<li>GSI keys don't require uniqueness and can be absent — which enables the <strong>sparse index</strong> pattern: only items that HAVE the GSI key attribute appear in the index. Set an attribute like <code>flagged</code> only on the few items that matter, index on it, and the GSI is a tiny, cheap materialized subset ("all unshipped orders", "all users pending review"). Deleting the attribute removes the item from the index.</li>
</ul>

<div class="callout deep">A GSI is a materialized view maintained by an internal change-propagation pipeline — think of it as DynamoDB running its own Streams consumer that writes to a second table. That is why it is async, why it has separate capacity, and why hot GSI partition keys (e.g. indexing on low-cardinality status values) create hot partitions in the index even when the base table's keys are perfect. Index keys need the same cardinality discipline as table keys.</div>

<h3>Local Secondary Index (LSI)</h3>
<p>An LSI shares the base table's <strong>partition key</strong> but substitutes an <strong>alternate sort key</strong> — a second sort order within each item collection, stored in the same partition:</p>
<ul>
<li><strong>Creation-time only.</strong> LSIs must be defined when the table is created and can never be added or removed. (This alone eliminates them from most designs.)</li>
<li><strong>Strongly consistent reads available</strong> — the index is co-located with the item collection, updated synchronously with the write.</li>
<li><strong>Shares the table's capacity</strong> — no separate throughput to manage.</li>
<li><strong>The 10 GB penalty:</strong> a table with any LSI caps every item collection at <strong>10 GB</strong> (collection cannot split across partitions), and the LSI's storage counts against it. Unbounded collections (a user's events forever) will eventually hit the wall with an ItemCollectionSizeLimitExceededException.</li>
<li>Non-projected attribute reads transparently <em>fetch from the base table</em> — convenient, but each fetch adds cost and latency.</li>
</ul>

<h3>Decision table</h3>
<table>
<thead><tr><th></th><th>GSI</th><th>LSI</th></tr></thead>
<tbody>
<tr><td>Partition key</td><td>Any attribute</td><td>Same as base table</td></tr>
<tr><td>Consistency</td><td>Eventual only</td><td>Strong available</td></tr>
<tr><td>Capacity</td><td>Own RCU/WCU (throttles base on exhaustion)</td><td>Shared with table</td></tr>
<tr><td>Add later?</td><td>Yes, online</td><td>No — table creation only</td></tr>
<tr><td>Count limit</td><td>20 (soft)</td><td>5, and 10 GB per item collection</td></tr>
<tr><td>Non-projected reads</td><td>Unavailable from index</td><td>Fetched from base (extra cost)</td></tr>
</tbody>
</table>

<p>The honest guidance: <strong>default to GSIs</strong>. Choose an LSI only when you specifically need strongly consistent queries on an alternate sort order within a partition, the collections are provably bounded, and you know the requirement at table-creation time. That conjunction is rare.</p>

<div class="callout exam">Mappings: "query by a different partition key" → GSI. "Strongly consistent reads on an alternate sort key" → LSI (the only index that can). "Index must be added to an existing table" → GSI (LSI impossible). "Base table writes throttled though table capacity is fine" → check GSI capacity. "Efficiently find the small fraction of items where X" → sparse GSI. Distractor patterns pair LSI with 'add later' or GSI with 'strongly consistent' — both are contradictions.</div>

<div class="callout war">GSI backfill on a large table consumes real capacity and can take hours; creating a GSI on a provisioned production table without temporarily raising capacity is a self-inflicted brownout. And watch GSI key cardinality: indexing a status enum funnels the whole table's index traffic into a handful of partitions — the hot-key lesson, relearned in the index.</div>
`
    },
    {
      id: "consistency-transactions",
      title: "Consistency options and transactions",
      html: `
<p>DynamoDB gives you a consistency dial per read and an ACID escape hatch — but both have precise semantics and costs, and the exam checks that you know which guarantee comes from where.</p>

<h3>The consistency spectrum</h3>
<ul>
<li><strong>Eventually consistent reads (default):</strong> may be served by any replica; typically consistent within milliseconds, but a read immediately after a write can return stale data. Half-price (1 RCU covers two reads).</li>
<li><strong>Strongly consistent reads:</strong> served by the partition leader; reflect all acknowledged writes. Full price, slightly higher latency, and unavailable on GSIs. Also not what Global Tables give you across regions — strong consistency is <em>within one region</em>.</li>
<li><strong>Transactional reads/writes:</strong> full ACID across items and tables (in one region). Double price.</li>
</ul>
<p>Note what is <em>always</em> true even with eventual consistency: writes are durably committed to a quorum of the 3 replicas before acknowledgment, single-item writes are atomic, and conditional writes are serialized per item. "Eventual" here is about read visibility, not durability.</p>

<div class="callout deep">Read-after-write patterns without paying for strong reads: read your own write from the response of the write (UpdateItem with ReturnValues), or design flows so the write and dependent read are the same item and use a strongly consistent GetItem only on that hot path. Blanket strong consistency doubles read cost for a guarantee most paths never exercise.</div>

<h3>Conditional writes: the workhorse</h3>
<p>Before reaching for transactions, remember every write op accepts a <strong>ConditionExpression</strong> — an atomic compare-and-set on that single item: <code>attribute_not_exists(pk)</code> for create-if-absent, version-number checks for optimistic locking, balance checks before decrement. Conditional writes are serialized by the partition leader, cost normal WCU (a failed condition check still bills one write unit), and solve most "race condition" requirements in one item. Single-item atomicity is free; multi-item atomicity is what transactions sell.</p>

<h3>TransactWriteItems / TransactGetItems</h3>
<ul>
<li><strong>TransactWriteItems:</strong> up to <strong>100 actions</strong> (Put/Update/Delete/ConditionCheck), across multiple tables, executed all-or-nothing. Total payload cap 4 MB. If any condition fails or any item is under contention, the whole transaction cancels with a TransactionCanceledException detailing per-item reasons.</li>
<li><strong>TransactGetItems:</strong> up to 100 reads returning a consistent snapshot — no torn reads across the set.</li>
<li><strong>Cost:</strong> 2x normal units on every item involved. Under the hood it is a two-phase protocol (prepare + commit) coordinated by a transaction coordinator; that is the physical reason for the 2x.</li>
<li><strong>Isolation:</strong> serializable between transactions and between a transaction and standard writes; but a non-transactional <em>read</em> can observe a transaction's partial effects (individual GetItems are not snapshot-isolated against an in-flight transaction — use TransactGetItems when that matters).</li>
<li><strong>ClientRequestToken (idempotency token):</strong> supplying a token makes TransactWriteItems idempotent for <strong>10 minutes</strong> — a retried transaction with the same token and same parameters is acknowledged without re-executing, and without double billing. This is how you make "charge the customer once" survive SDK retries and Lambda at-least-once invocation.</li>
</ul>

<div class="callout limits">Transaction numbers: <strong>100 items</strong>, <strong>4 MB</strong>, <strong>2x capacity</strong>, idempotency window <strong>10 minutes</strong>, single-region (transactions do not span Global Table replicas — replication of a committed transaction to other regions is asynchronous and non-transactional per item).</div>

<div class="callout war">Transactions under contention degrade sharply: two transactions touching the same item conflict, one cancels, clients retry, contention compounds. A high-contention counter or inventory row inside TransactWriteItems is an anti-pattern — use conditional single-item updates, sharded counters, or queue-serialized writers instead. Transactions are for low-contention multi-item invariants (order + inventory + ledger), not for hot rows.</div>

<div class="callout exam">"All-or-nothing update across multiple items/tables" → TransactWriteItems. "Prevent overwriting an existing item / implement optimistic locking" → ConditionExpression (not a transaction). "Ensure a retried payment is applied exactly once" → transaction with ClientRequestToken. "Strongly consistent query on a GSI" → impossible, redesign (that option is always the wrong answer). Numbers 100/4 MB/2x are directly testable.</div>
`
    },
    {
      id: "ttl-streams-dax",
      title: "TTL, Streams, Lambda triggers, and DAX",
      html: `
<p>This lesson covers the event-driven and caching bolt-ons: expiring data for free, reacting to changes, and microsecond reads — each with semantics you must not hand-wave.</p>

<h3>TTL: lazy deletion</h3>
<p>Mark a numeric attribute containing an <strong>epoch-seconds timestamp</strong>, enable TTL on it, and DynamoDB deletes expired items <strong>in the background, for free</strong> (no WCU consumed). The semantics that matter:</p>
<ul>
<li>Deletion is <strong>lazy</strong>: typically within a few days at most under load — AWS documents that expired items are usually removed within 48 hours, and you must not assume promptness. Expired-but-not-yet-deleted items <strong>still appear in reads</strong>; filter on the TTL attribute in queries if correctness requires it.</li>
<li>TTL deletes appear in Streams as system deletions (identifiable via the principal in the record) — a common pattern is TTL + Streams + Lambda to archive expiring items to S3: the free tier of data lifecycle.</li>
<li>Wrong-unit bugs are classic: milliseconds instead of seconds puts expiry in the year 56,000 — items never die. Or a past timestamp mass-expires a table.</li>
</ul>

<h3>DynamoDB Streams</h3>
<p>Streams is the table's <strong>ordered change log</strong>: every write produces a record (view options: KEYS_ONLY, NEW_IMAGE, OLD_IMAGE, NEW_AND_OLD_IMAGES) retained for <strong>24 hours</strong>. The guarantees, precisely:</p>
<ul>
<li><strong>Ordering is per item (per partition key), within a shard.</strong> All changes to a given item appear in exactly one shard, in modification order. There is <em>no total order across the table</em>.</li>
<li><strong>Exactly-once appearance in the stream; at-least-once processing by consumers.</strong> Each change appears once in the stream, but a Lambda consumer can see retries — handlers must be idempotent.</li>
<li>Lambda integration polls shards, invokes with batches, and processes each shard serially — so per-item ordering is preserved through Lambda, and a poison-pill record blocks its shard until skipped (configure bisect-on-error, max retry age, and an on-failure destination or the shard sticks for up to 24 h).</li>
</ul>
<p><strong>Kinesis Data Streams as an alternative destination:</strong> DynamoDB can publish changes into a Kinesis stream you own instead — buying longer retention (up to a year), multiple/fan-out consumers, Firehose delivery to S3, and the whole Kinesis ecosystem. The trade: Kinesis delivery is <strong>at-least-once with possible duplicates and no ordering guarantee</strong> (records carry timestamps for reordering), versus Streams' cleaner per-item ordering. Exam shorthand: tight Lambda trigger with ordering → DynamoDB Streams; long retention / many consumers / analytics pipeline → Kinesis destination.</p>

<div class="callout deep">Streams-to-Lambda is the standard change-data-capture backbone on AWS: materialized aggregates (maintain a counter table), replication to OpenSearch for search, cache invalidation, audit trails, TTL-archival. It is the same architectural role as Debezium on a binlog — with shard ordering as the contract you design idempotency around.</div>

<h3>DAX: DynamoDB Accelerator</h3>
<p>DAX is a <strong>write-through, API-compatible caching cluster</strong> in your VPC. You point the DAX SDK client at the cluster instead of the table endpoint; no application cache logic changes.</p>
<ul>
<li>Two caches: an <strong>item cache</strong> (GetItem/BatchGetItem, default 5-minute TTL) and a <strong>query cache</strong> (Query/Scan results keyed by exact parameters). The query cache is invalidated only by TTL — a write does NOT invalidate cached query results, only the item cache entry. Stale query results within TTL are by design.</li>
<li>Reads that hit are <strong>microseconds</strong>; misses pass through, costing normal RCU. Writes go through DAX to the table (write-through), so the item cache stays fresh for point reads.</li>
<li><strong>Strongly consistent reads bypass DAX entirely</strong> — the cache serves eventually consistent semantics only. A workload requiring strong reads gains nothing from DAX.</li>
<li>DAX vs ElastiCache: DAX when the cache target IS DynamoDB and you want zero code change; ElastiCache (Redis/Valkey) when you cache computed results, sessions, cross-source aggregations, or need data structures/pub-sub.</li>
</ul>

<div class="callout exam">"Read-heavy table, microsecond latency, minimal code change" → DAX. "Repeated reads of the same hot items driving RCU cost" → DAX (it also blunts hot-partition READ problems — the cache absorbs the hot key). "Application requires strongly consistent reads" → DAX is the wrong answer, deliberately placed. TTL questions: "delete expired items at no cost" → TTL; remember laziness (up to ~48 h) and that filters must exclude expired items if precision matters.</div>

<div class="callout war">DAX is a cluster you now operate: size it, monitor evictions, and know that a node failover briefly spikes misses into the table — provision the table (or use on-demand) for the miss storm, or a cache-node loss becomes a table throttling event. Cache TTL is also a data-freshness SLA you have implicitly signed; make it explicit with the business.</div>
`
    },
    {
      id: "global-tables-ops",
      title: "Global Tables, backups, hard limits, and when NOT to use DynamoDB",
      html: `
<p>The closing lesson: multi-region semantics (where DynamoDB's honesty about conflicts matters most), the backup/export toolbox, the limits table, and the judgment call the exam and real life both test — recognizing when DynamoDB is the wrong tool.</p>

<h3>Global Tables: multi-active, last-writer-wins</h3>
<p>Global Tables replicate a table across regions, <strong>every replica writable</strong> (multi-active), typically with sub-second replication lag. Conflict resolution is <strong>last writer wins</strong> (LWW) by timestamp: concurrent writes to the same item in two regions both succeed locally; replication then silently discards the earlier write. Design consequences a senior must draw:</p>
<ul>
<li>LWW means <strong>lost updates are a designed-in possibility</strong>, not a bug. If two regions can mutate the same item concurrently, one mutation can vanish without error. Counters, balances, and read-modify-write flows are unsafe across regions.</li>
<li>The robust patterns: <strong>route each item's writes to one home region</strong> (partition users/tenants geographically — multi-active infrastructure, single-writer data), design idempotent/commutative updates, or version items and reconcile via Streams. Reserve true concurrent multi-region writes for naturally LWW-safe data (presence flags, latest-state documents).</li>
<li><strong>Transactions and conditional-write guarantees are regional.</strong> A transaction is ACID in its origin region; it replicates as ordinary per-item writes. Strong consistency is regional too — a strongly consistent read in us-east-1 does not see an unreplicated write from eu-west-1.</li>
<li>Requirements: Streams enabled (NEW_AND_OLD_IMAGES); replicated writes bill on their own rWCU dimension. Failover is just DNS/routing — any region already accepts writes, which is why Global Tables headline "RTO near zero" architectures.</li>
</ul>

<div class="callout exam">"Multi-region active-active with local read/write latency" → Global Tables, almost verbatim. Follow-up trap: "how are conflicts resolved" → last writer wins. Contrast with Aurora Global Database: single writer region, ~1 s RPO, promotion for failover — relational vs DynamoDB multi-active is a recurring compare-and-choose stem.</div>

<h3>Backups, PITR, and export</h3>
<ul>
<li><strong>On-demand backups:</strong> full snapshots, no performance impact (they come from the replication layer, not table scans), kept until deleted; cross-account/cross-region management via AWS Backup.</li>
<li><strong>PITR:</strong> continuous protection with restore to any second in the last <strong>35 days</strong>. Restores (backup or PITR) always create a <strong>new table</strong> — and do NOT restore autoscaling settings, TTL config, alarms, tags, or IAM policies; your IaC must reapply them. GSIs can optionally be restored or excluded (excluding speeds restore).</li>
<li><strong>Export to S3:</strong> with PITR enabled, export any point-in-time to S3 (DynamoDB JSON or Ion; also incremental exports) <strong>without consuming table capacity</strong> — the sanctioned path to analytics: export → Athena/Glue, instead of scanning production. There is also zero-ETL integration to Redshift/OpenSearch for continuous replication.</li>
</ul>

<h3>Scan vs Query economics</h3>
<p>A <strong>Query</strong> touches one item collection and bills for items <em>read</em>. A <strong>Scan</strong> reads the entire table a 1 MB page at a time and bills for every byte scanned — <strong>FilterExpression does not reduce cost</strong>; filtering happens after the read, before the response. A daily full Scan of a 100 GB table costs 25,600 RCU-seconds every run and evicts your adaptive-capacity assumptions. If a Scan is on a hot path, the design is wrong: add a GSI (sparse if the target subset is small), maintain an aggregate via Streams, or export to S3 for analytics. Legitimate Scans exist (backfills, migrations) — run them with parallel segments, rate-limited, off-peak, or from an export instead.</p>

<div class="callout limits">The hard-limits table: item size <strong>400 KB</strong> (including attribute names); Query/Scan page <strong>1 MB</strong> pre-filter (paginate via LastEvaluatedKey); partition <strong>3,000 RCU / 1,000 WCU / ~10 GB</strong>; BatchGetItem <strong>100 items / 16 MB</strong>; BatchWriteItem <strong>25 items</strong> (and it is NOT atomic — unprocessed items must be retried, unlike transactions); transactions <strong>100 items / 4 MB / 2x cost</strong>; LSI collection cap <strong>10 GB</strong>; Streams retention <strong>24 h</strong>; PITR <strong>35 days</strong>; on-demand instant scale ceiling <strong>2x prior peak</strong>.</div>

<h3>When NOT to use DynamoDB</h3>
<ul>
<li><strong>Unenumerable access patterns / ad-hoc queries:</strong> OLAP, flexible filtering, search — DynamoDB answers key lookups; everything else is a Scan or a redesign. Relational or OpenSearch or a lake wins.</li>
<li><strong>Large objects:</strong> 400 KB cap; store blobs in S3, keep pointers + metadata in DynamoDB.</li>
<li><strong>Cross-item invariants at high contention or relational integrity:</strong> transactions exist but cost 2x, cap at 100 items, and degrade under contention; there are no foreign keys, no cascades, no joins. A ledger with rich constraints belongs in an RDBMS.</li>
<li><strong>Multi-region read-modify-write correctness:</strong> LWW makes it structurally unsafe without single-home routing.</li>
<li><strong>Cheap bulk analytics on the live table:</strong> scanning production is the anti-pattern; export to S3 or zero-ETL instead.</li>
</ul>

<div class="callout war">The failure mode that gets architectures rewritten: choosing DynamoDB for its ops story, then discovering month three that the product team wants "just one more filter" per screen. Each retrofit is a GSI (capacity, backfill, eventual consistency) or a Scan (cost bomb). DynamoDB rewards front-loaded certainty about access patterns and punishes exploratory querying — pick it where the access patterns are stable and enumerable, pair it with an export pipeline for everything else.</div>
`
    }
  ],
  quiz: [
    {
      q: "A multi-tenant SaaS table uses tenantId as the partition key. One large tenant now generates 40 percent of all writes and its requests are being throttled, although the table's overall consumed capacity is well below provisioned capacity. What is the correct long-term fix?",
      options: [
        "Switch the table to on-demand capacity mode",
        "Enable auto scaling with a higher maximum WCU",
        "Shard the hot tenant's partition key by appending a bounded suffix and fan out reads across the shards",
        "Add a GSI with tenantId as its partition key to absorb the extra writes"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>C</strong> is correct: a single partition key can never exceed one partition's ceiling (~1,000 WCU) regardless of table settings; write sharding spreads the tenant across N keys, multiplying available throughput, at the cost of scatter-gather reads.</p><p><strong>A</strong> and <strong>B</strong> change billing/table-level capacity, but the bottleneck is per-key physics — adaptive capacity already gave the key everything one partition can do.</p><p><strong>D</strong> makes it worse: a GSI with the same hot key duplicates the hot partition in the index, and its throttling would backpressure base-table writes.</p>"
    },
    {
      q: "An application writes 6 items per second, each 3.2 KB, using standard (non-transactional) writes, and performs 40 eventually consistent reads per second of 1.5 KB items. What capacity should be provisioned?",
      options: [
        "24 WCU and 20 RCU",
        "24 WCU and 10 RCU",
        "20 WCU and 40 RCU",
        "48 WCU and 20 RCU"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A</strong> is correct. Writes: item size rounds up to the next 1 KB, so 3.2 KB → 4 write units; 4 × 6 writes/s = <strong>24 WCU</strong>. Reads: 1.5 KB rounds up to one 4 KB read unit; eventually consistent reads cost half a unit, so 40 reads/s × 0.5 = <strong>20 RCU</strong>.</p><p><strong>B</strong> halves the read cost twice (0.25 per read) — the eventual-consistency discount applies once.</p><p><strong>C</strong> forgets the 1 KB write rounding (treating 3.2 KB as 3.33 units truncated) and charges reads at the full strongly consistent rate.</p><p><strong>D</strong> applies the transactional 2x multiplier to the writes, but the stem says standard writes.</p>"
    },
    {
      q: "A table stores IoT readings with deviceId as partition key and an ISO-8601 timestamp sort key. Operations wants to efficiently retrieve, for one device, all readings from a given calendar month, newest first. What is the right approach?",
      options: [
        "Scan the table with a FilterExpression on deviceId and timestamp range",
        "Query with the deviceId partition key and a begins_with condition on the timestamp sort key, with ScanIndexForward set to false",
        "Create a GSI with the timestamp as partition key and deviceId as sort key",
        "Use BatchGetItem with the list of expected timestamps for the month"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: this is the canonical single-collection range query — partition key equality plus a sort-key prefix (begins_with on the year-month prefix of an ISO-8601 key), and ScanIndexForward=false returns descending order. One partition, index-ordered, bills only for items returned.</p><p><strong>A</strong> reads the entire table and bills for every byte scanned — FilterExpression never reduces cost.</p><p><strong>C</strong> inverts the design: timestamp as partition key has pathological write heat (all current writes share the key) and fragments a device's data across the keyspace.</p><p><strong>D</strong> requires knowing exact timestamps in advance and caps at 100 items per call — not a range query.</p>"
    },
    {
      q: "A provisioned-mode table performs fine, but during peak hours base-table PutItem calls intermittently receive ProvisionedThroughputExceededException. Table-level consumed WCU is far below provisioned WCU. The table has one GSI on a status attribute. What is the most likely cause?",
      options: [
        "The GSI has insufficient write capacity, and its throttling is backpressuring base-table writes",
        "DynamoDB Streams is consuming the table's write capacity",
        "The items exceed 400 KB during peak hours",
        "Auto scaling is reducing capacity during peak by mistake"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A</strong> is correct and is a classic: every base write to an indexed attribute consumes GSI WCU; when the GSI (which in provisioned mode has its own, separately configured capacity) runs dry, DynamoDB throttles the <em>base table's</em> writes rather than let the index fall behind unboundedly. A GSI on a low-cardinality status attribute also concentrates index writes on few partitions, compounding it.</p><p><strong>B</strong> — Streams reads bill separately and never consume table WCU.</p><p><strong>C</strong> — writes over 400 KB fail with a validation error, not throughput throttling.</p><p><strong>D</strong> — autoscaling only moves between your configured min/max toward target utilization; and the stem says table capacity is ample.</p>"
    },
    {
      q: "An e-commerce checkout must atomically decrement inventory, create an order item, and append a ledger entry across three tables, and a Lambda retry must not apply the change twice. Which approach is correct?",
      options: [
        "Three sequential PutItem/UpdateItem calls wrapped in SDK retries",
        "TransactWriteItems containing the three actions, supplying a ClientRequestToken",
        "BatchWriteItem containing the three writes, with a conditional expression on each",
        "A Step Functions workflow issuing the three writes with a catch-and-compensate pattern"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: TransactWriteItems gives all-or-nothing semantics across up to 100 actions spanning multiple tables, and the ClientRequestToken makes the transaction idempotent for 10 minutes — a retried invocation with the same token is acknowledged without re-applying.</p><p><strong>A</strong> has no atomicity: a crash between calls leaves partial state, and retries double-apply.</p><p><strong>C</strong> — BatchWriteItem is not atomic (partial success with UnprocessedItems is normal) and does not support condition expressions at all.</p><p><strong>D</strong> can be built (saga pattern) but is strictly more machinery, provides eventual compensation rather than atomicity, and the stem's requirements map exactly onto the native transaction feature.</p>"
    },
    {
      q: "A team needs to find the roughly 0.1 percent of orders currently in DISPUTED state, from a table of 500 million orders keyed by orderId. Queries for disputed orders run continuously. What is the most efficient design?",
      options: [
        "Scan the table every few minutes with a FilterExpression on the status attribute",
        "Create a GSI with status as partition key and orderDate as sort key",
        "Set a disputedAt attribute only on disputed orders and create a GSI on it, so the index contains only disputed items",
        "Enable Streams and query the last 24 hours of change records for disputed transitions"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>C</strong> is correct — the sparse index pattern: GSI keys are optional, so indexing an attribute that exists only on disputed items yields a tiny index containing exactly the target subset; queries against it are cheap and fast, and clearing the attribute removes the item from the index.</p><p><strong>A</strong> scans 500 M items and bills for all of them every pass; filters do not reduce scan cost.</p><p><strong>B</strong> works but indexes ALL 500 M items under a handful of status values — massive storage duplication and severe hot partitions in the index (low-cardinality GSI key).</p><p><strong>D</strong> — Streams shows changes within 24 h, not current state; disputes older than a day vanish from view.</p>"
    },
    {
      q: "Which statements about Local Secondary Indexes are accurate? (Select TWO.)",
      options: [
        "They can be added to an existing table at any time",
        "They support strongly consistent reads",
        "They constrain each item collection, including index items, to 10 GB",
        "They require their own provisioned throughput, separate from the table",
        "They allow a different partition key from the base table"
      ],
      answer: [1, 2],
      multi: true,
      explanation: "<p><strong>B</strong> and <strong>C</strong> are correct: LSIs are co-located with the item collection and updated synchronously, so strong reads are available; the price is that collections in an LSI table cannot split across partitions, imposing the 10 GB item-collection cap (base + index items).</p><p><strong>A</strong> is the defining restriction violated: LSIs are creation-time only.</p><p><strong>D</strong> describes GSIs — LSIs share table capacity.</p><p><strong>E</strong> also describes GSIs — an LSI keeps the base partition key and only substitutes the sort key.</p>"
    },
    {
      q: "A gaming leaderboard table in on-demand mode has served a steady 2,000 writes per second for months. A marketing event suddenly pushes traffic to 15,000 writes per second within one minute, and the application sees throttling for a while before recovering. Why?",
      options: [
        "On-demand tables have a hard cap of 4,000 writes per second",
        "On-demand scales instantly only to about double the previous peak; beyond that, throttling occurs until DynamoDB adds partition capacity",
        "The account's WCU quota was exhausted and required a support ticket",
        "On-demand mode does not support burst capacity, so all spikes throttle"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: on-demand pre-provisions roughly 2x your historical peak (here ~4,000 sustained writes/s of headroom); a jump to 15,000 exceeds that, so requests throttle while DynamoDB heat-splits partitions — after which the new peak is remembered and the next event of this size would be absorbed. Pre-warming (temporarily provisioning high, or ramping traffic) is the mitigation for known step events.</p><p><strong>A</strong> — 4,000 WCU is the initial floor for a new on-demand table, not a cap.</p><p><strong>C</strong> — account quotas are soft limits that would not explain self-recovery within the event.</p><p><strong>D</strong> — on-demand absorbs bursts by design; the 2x-prior-peak boundary is the actual rule.</p>"
    },
    {
      q: "An architecture uses DynamoDB Streams with a Lambda trigger to maintain a per-customer aggregate in another table. During a load test, the team observes the aggregate is occasionally updated twice for a single source write. What should they conclude and do?",
      options: [
        "Streams emitted duplicate change records; enable exactly-once delivery on the event source mapping",
        "Lambda processing is at-least-once; make the handler idempotent, for example by conditioning updates on the stream sequence number",
        "The stream shard split mid-batch; disable shard splitting on the stream",
        "The table's eventual consistency caused double reads; switch the stream to strongly consistent mode"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: each change appears exactly once IN the stream, but Lambda consumption is at-least-once — retries after partial failures or checkpointing hiccups redeliver records. The contract is: design idempotent handlers (dedupe on sequence number, or make the aggregate update conditional/absolute rather than increment-blindly).</p><p><strong>A</strong> — there is no exactly-once switch; the duplication is in consumption, not emission.</p><p><strong>C</strong> — shard management is not user-controllable and resharding does not duplicate records.</p><p><strong>D</strong> — there is no consistency mode on Streams; this option is invented terminology.</p>"
    },
    {
      q: "A read-heavy product-catalog service on DynamoDB needs microsecond read latency for repeated reads of popular items with essentially no application rewrite. Reads are eventually consistent. Which solution fits?",
      options: [
        "ElastiCache for Redis with application-managed cache-aside logic",
        "DAX in front of the table, using the DAX SDK client",
        "A GSI projecting ALL attributes to spread read load",
        "Strongly consistent reads against additional read replicas"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: DAX is API-compatible write-through caching — swap the client, keep the code, get microsecond hits for eventually consistent GetItem/Query traffic, and it naturally absorbs hot-key read pressure.</p><p><strong>A</strong> achieves similar latency but requires writing and maintaining cache-aside logic (population, invalidation, stampede control) — exactly what the stem excludes.</p><p><strong>C</strong> — a GSI is another eventually-consistent table copy at millisecond latency; it adds write cost and solves a different problem (alternate keys).</p><p><strong>D</strong> — DynamoDB has no user-facing read replicas, and strong consistency would bypass any cache anyway; the option is a distractor built from RDS vocabulary.</p>"
    },
    {
      q: "A company runs a Global Table across us-east-1 and eu-west-1, both regions accepting writes. Support reports that occasionally a user's profile update made in Europe disappears after a nearly simultaneous update from a US-based batch job. What is happening, and what is the standard architectural remedy?",
      options: [
        "Replication is failing; enable strongly consistent cross-region reads to fix it",
        "Last-writer-wins conflict resolution is discarding one concurrent update; route each item's writes to a single home region or make updates commutative",
        "The transaction coordinator is timing out across regions; wrap profile updates in TransactWriteItems",
        "Streams retention expired before replication completed; increase retention to 7 days"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: Global Tables resolve concurrent writes to the same item with last-writer-wins by timestamp — the earlier write is silently discarded, exactly matching the symptom. The remedies are architectural: single-home each item's writes (tenant/user affinity), design commutative or idempotent updates, or version-and-reconcile via Streams.</p><p><strong>A</strong> — replication is functioning as designed; strongly consistent reads are regional and no cross-region strong mode exists.</p><p><strong>C</strong> — transactions are single-region; they replicate as ordinary writes and cannot span replicas.</p><p><strong>D</strong> — Streams retention is fixed at 24 h and unrelated; replication does not depend on user-configured retention.</p>"
    },
    {
      q: "A compliance team requires the ability to restore a DynamoDB table to any point within the last 30 days, and analysts need to run SQL over month-old table states without touching production capacity. Which combination satisfies both? (Select TWO.)",
      options: [
        "Enable point-in-time recovery on the table",
        "Schedule daily Scan jobs that copy the table into a second table",
        "Use export-to-S3 from PITR snapshots and query the exports with Athena",
        "Enable DynamoDB Streams with 35-day retention for replay",
        "Take manual on-demand backups every hour and restore for each analyst query"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<p><strong>A</strong> gives second-granularity restore over up to 35 days (covers the 30-day requirement); restores create a new table.</p><p><strong>C</strong> builds on PITR: export any covered point-in-time to S3 with zero table-capacity consumption, then Athena/Glue query the export — the sanctioned analytics path.</p><p><strong>B</strong> hammers production capacity daily (exactly what the stem forbids) and gives only daily granularity.</p><p><strong>D</strong> — Streams retention is 24 hours, not configurable to 35 days, and replay-based restore is a build-it-yourself project.</p><p><strong>E</strong> — hourly granularity misses the any-point requirement, and restoring a table per analyst query is operationally absurd.</p>"
    },
    {
      q: "Which access pattern is DynamoDB fundamentally the WRONG choice for, even with careful key design?",
      options: [
        "Storing session state for millions of concurrent users keyed by session ID",
        "An operational dashboard needing ad-hoc filtering and aggregation across arbitrary attribute combinations chosen at query time",
        "An order-history lookup returning a customer's orders in date ranges",
        "A device-shadow store holding the latest state document per IoT device"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: DynamoDB answers pre-designed key lookups and sort-key ranges; arbitrary attribute combinations chosen at query time mean either an unbounded set of GSIs or continuous Scans — the access patterns cannot be enumerated up front, which is the disqualifying property. That workload belongs in a relational store, OpenSearch, or a lake with Athena.</p><p><strong>A</strong> is a canonical fit — high-cardinality key, point lookups, TTL for expiry.</p><p><strong>C</strong> is the composite sort-key pattern working as intended.</p><p><strong>D</strong> is key-value latest-state — DynamoDB's home turf (it IS how IoT device shadows are built).</p>"
    },
    {
      q: "A table has TTL enabled on an expiresAt attribute. QA reports that items whose expiresAt passed 10 hours ago still appear in query results. What are correct responses to this finding? (Select TWO.)",
      options: [
        "This is expected: TTL deletion is background and lazy, and can take up to about 48 hours",
        "Add a filter expression on expiresAt so expired-but-undeleted items are excluded from results",
        "Open an AWS support case, because TTL guarantees deletion within one hour",
        "Switch the TTL attribute to millisecond epoch timestamps for faster processing",
        "Increase the table's WCU, since TTL deletions are consuming the write capacity needed"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>A</strong> and <strong>B</strong> are correct: TTL is an eventual, background process (typically prompt, documented as up to ~48 h under load) and consumes no capacity; correctness-sensitive reads must therefore filter on the TTL attribute themselves.</p><p><strong>C</strong> — no such guarantee exists.</p><p><strong>D</strong> — TTL requires <em>seconds</em>-epoch; milliseconds would be interpreted as a far-future date and items would never expire — the opposite of a fix.</p><p><strong>E</strong> — TTL deletes are free and do not draw from provisioned WCU, so capacity is irrelevant to deletion speed.</p>"
    }
  ],
  flashcards: [
    { front: "Per-partition hard limits in DynamoDB?", back: "<strong>~3,000 RCU, 1,000 WCU, ~10 GB storage</strong> per partition — and therefore per single partition key (a key's writes cannot exceed one partition's ceiling, ever). Tables scale by adding partitions; partitions split but never merge." },
    { front: "What does adaptive capacity do, and what can it NOT do?", back: "Instantly lets hot partitions <strong>borrow unused table throughput</strong> and isolates hot keys via heat splits. It cannot push a <strong>single key</strong> past one partition's 3,000 RCU / 1,000 WCU physics — that requires key redesign or write sharding." },
    { front: "Write sharding: pattern and trade-off?", back: "Append a bounded suffix to a hot partition key (random or calculated) so writes spread over N keys → N× write ceiling. Trade-off: reads must <strong>fan out over all N shards</strong> and merge; calculated suffixes keep point reads single-shard." },
    { front: "RCU definition, with the eventual and transactional multipliers?", back: "1 RCU = 1 <strong>strongly consistent</strong> read/s up to <strong>4 KB</strong> (round size up). Eventually consistent = <strong>half</strong> (2 reads per RCU). Transactional = <strong>2x</strong>. Query bills on aggregate returned size, rounded once." },
    { front: "WCU definition and multipliers?", back: "1 WCU = 1 write/s up to <strong>1 KB</strong> (round up per KB). Transactional writes = <strong>2x</strong>. GSIs consume additional WCU for every write touching indexed attributes (double if the item moves between index key values)." },
    { front: "On-demand mode: when does it throttle?", back: "Instant scale covers up to about <strong>2x the previous peak</strong> (new-table floor ~4,000 WCU / 12,000 RCU). Beyond that, throttling until partitions split (~up to 30 min). Per-key 1,000 WCU physics still applies. Mitigate known spikes by pre-warming." },
    { front: "On-demand vs provisioned: the economic crossover?", back: "On-demand costs roughly <strong>6–7x</strong> the per-unit price of fully utilized provisioned capacity → on-demand wins below roughly <strong>15 percent average utilization</strong> (spiky/idle), provisioned + reserved wins for steady load. Autoscaling lags spikes by minutes." },
    { front: "GSI: consistency model and capacity relationship to the base table?", back: "<strong>Eventually consistent only</strong> (strong reads impossible). Own RCU/WCU in provisioned mode. If the GSI exhausts write capacity, <strong>base-table writes throttle</strong> — the index is never allowed to fall behind unboundedly." },
    { front: "LSI: the three defining restrictions?", back: "1) <strong>Creation-time only</strong> — never added later. 2) Same partition key, alternate sort key; shares table capacity; strong reads available. 3) Caps every item collection at <strong>10 GB</strong> including index items (collections cannot split)." },
    { front: "Sparse index pattern — what is it?", back: "GSI key attributes are optional, so an index on an attribute that exists <strong>only on interesting items</strong> (e.g. disputedAt) contains only those items — a tiny, cheap materialized subset. Remove the attribute → item leaves the index." },
    { front: "TransactWriteItems: limits and cost?", back: "Up to <strong>100 actions / 4 MB</strong>, across tables, all-or-nothing, <strong>2x capacity</strong> (two-phase under the hood), serializable isolation, <strong>single-region</strong>. ClientRequestToken = idempotency for <strong>10 minutes</strong>." },
    { front: "BatchWriteItem vs TransactWriteItems?", back: "BatchWriteItem: up to <strong>25 writes</strong>, NOT atomic (partial success + UnprocessedItems to retry), no condition expressions, normal cost. TransactWriteItems: 100 actions, atomic, conditional, 2x cost. Batch = throughput; Transact = correctness." },
    { front: "What single-item tool solves most race conditions without transactions?", back: "<strong>ConditionExpression</strong> on any write — atomic compare-and-set per item: attribute_not_exists for create-if-absent, version checks for optimistic locking. Serialized by the partition leader; a failed check still bills a write unit." },
    { front: "DynamoDB TTL: mechanism and guarantees?", back: "Background deletion of items whose <strong>epoch-seconds</strong> TTL attribute has passed — <strong>free (no WCU)</strong>, lazy (typically prompt, up to ~<strong>48 h</strong>), expired items still readable until deleted (filter them out yourself). TTL deletes appear in Streams → archive-to-S3 pattern." },
    { front: "DynamoDB Streams: ordering and delivery guarantees?", back: "Change log, <strong>24 h retention</strong>. Each change appears <strong>exactly once in the stream</strong>; ordering is guaranteed <strong>per item (per partition key) within a shard</strong> — no table-wide order. Lambda consumption is <strong>at-least-once</strong> → handlers must be idempotent; a poison record blocks its shard." },
    { front: "DynamoDB Streams vs Kinesis Data Streams as the change destination?", back: "Streams: 24 h retention, per-item ordering, tight Lambda integration. Kinesis destination: up to <strong>1 year retention</strong>, many consumers, Firehose/analytics ecosystem — but <strong>possible duplicates and no ordering guarantee</strong>. Long retention/fan-out → Kinesis; ordered triggers → Streams." },
    { front: "DAX: what it caches and the two blind spots?", back: "API-compatible <strong>write-through</strong> cache: item cache (GetItem) + query cache (exact-parameter Query/Scan results, invalidated only by TTL — writes do not purge it). Blind spots: <strong>strongly consistent reads bypass DAX</strong>, and it is a cluster you must size/monitor. Microsecond hits." },
    { front: "DAX vs ElastiCache — the selection rule?", back: "<strong>DAX</strong>: the thing being cached IS DynamoDB and you want zero code change. <strong>ElastiCache</strong> (Redis/Valkey): computed results, sessions, cross-source aggregation, data structures, pub/sub. 'Minimal application changes' + DynamoDB → DAX." },
    { front: "Global Tables: writer topology and conflict resolution?", back: "<strong>Multi-active</strong> — every regional replica accepts writes; sub-second typical replication. Conflicts resolved by <strong>last writer wins</strong> (earlier concurrent write silently discarded). Requires Streams; replicated writes bill separately. Transactions and strong reads are <strong>regional only</strong>." },
    { front: "Designing safely on Global Tables' last-writer-wins?", back: "Avoid cross-region concurrent read-modify-write: <strong>route each item's writes to one home region</strong>, make updates idempotent/commutative, or version-and-reconcile via Streams. Reserve true multi-region writes for latest-state-wins data." },
    { front: "DynamoDB PITR and export-to-S3?", back: "PITR: continuous backup, restore to any second within <strong>35 days</strong> — always to a <strong>new table</strong>, without autoscaling/TTL/tags/alarms settings. Export-to-S3 (needs PITR): full or incremental export of any covered instant, <strong>zero table capacity consumed</strong> → Athena/Glue analytics." },
    { front: "Why does a FilterExpression not make Scan cheaper?", back: "Filtering happens <strong>after</strong> items are read (and billed) but before the response. A Scan bills every byte scanned, 1 MB per page. Reducing cost means reading less: Query a collection, use a (sparse) GSI, maintain aggregates via Streams, or query an S3 export." },
    { front: "The hard limits: item size, page size, batch sizes?", back: "Item <strong>400 KB</strong> (attribute names count). Query/Scan page <strong>1 MB</strong> pre-filter (paginate with LastEvaluatedKey). BatchGetItem <strong>100 items/16 MB</strong>; BatchWriteItem <strong>25 items</strong>. Transactions <strong>100 items/4 MB</strong>." },
    { front: "Top signals that DynamoDB is the wrong choice?", back: "Ad-hoc/unknown query patterns (OLAP, arbitrary filters), items over 400 KB (put blobs in S3), rich relational integrity or high-contention multi-item invariants, cross-region read-modify-write correctness (LWW), bulk analytics against the live table (export instead)." }
  ],
  lab: {
    title: "Lab: hot keys, RCU/WCU math, a sparse GSI, and TTL — measured, not believed",
    html: `
<h3>Goal</h3>
<p>Build a table with a composite key, watch consumed-capacity numbers confirm the RCU/WCU math, demonstrate Scan-vs-Query economics, add a sparse GSI online, and enable TTL. Everything is on-demand and costs cents at most; the teardown removes it all.</p>

<h3>Architecture</h3>
<p>One on-demand table <code>lab-orders</code> (PK <code>customerId</code>, SK <code>orderDate#orderId</code>), a sparse GSI on <code>disputedAt</code>, TTL on <code>expiresAt</code>. All interaction via CLI with <code>--return-consumed-capacity</code> so the billing model is visible per call.</p>

<h3>Steps</h3>
<ol>
<li><p>Create the table (on-demand):</p>
<pre><code>aws dynamodb create-table \
  --table-name lab-orders \
  --attribute-definitions \
    AttributeName=customerId,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=customerId,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

aws dynamodb wait table-exists --table-name lab-orders</code></pre></li>

<li><p>Load a few items and read the consumed capacity off each write. Note a small item costs exactly 1 WCU:</p>
<pre><code>for i in 1 2 3 4 5; do
  aws dynamodb put-item --table-name lab-orders \
    --item '{"customerId":{"S":"CUST#42"},"sk":{"S":"ORDER#2026-07-0'"$i"'#o-'"$i"'"},"amount":{"N":"120"},"status":{"S":"SHIPPED"}}' \
    --return-consumed-capacity TOTAL
done</code></pre></li>

<li><p>Now write one deliberately fat item (~5 KB of padding) and observe the WCU jump to 5 — size rounds up per KB:</p>
<pre><code>PAD=$(python3 -c "print('x'*5000)")
aws dynamodb put-item --table-name lab-orders \
  --item '{"customerId":{"S":"CUST#42"},"sk":{"S":"ORDER#2026-07-09#o-big"},"pad":{"S":"'"$PAD"'"}}' \
  --return-consumed-capacity TOTAL</code></pre></li>

<li><p>Query vs Scan economics. First a Query for one customer's July orders (bills only what it returns), then a Scan with a filter (bills everything it reads):</p>
<pre><code>aws dynamodb query --table-name lab-orders \
  --key-condition-expression "customerId = :c AND begins_with(sk, :p)" \
  --expression-attribute-values '{":c":{"S":"CUST#42"},":p":{"S":"ORDER#2026-07"}}' \
  --return-consumed-capacity TOTAL --query "ConsumedCapacity"

aws dynamodb scan --table-name lab-orders \
  --filter-expression "amount = :a" \
  --expression-attribute-values '{":a":{"N":"120"}}' \
  --return-consumed-capacity TOTAL --query "[Count,ScannedCount,ConsumedCapacity]"</code></pre>
<p>Compare <code>Count</code> vs <code>ScannedCount</code> on the Scan: you were billed for ScannedCount (including the fat item), returned Count. That gap, multiplied by a real table, is the Scan cost bomb.</p></li>

<li><p>Add a <strong>sparse GSI</strong> online (only items with a disputedAt attribute will appear in it):</p>
<pre><code>aws dynamodb update-table --table-name lab-orders \
  --attribute-definitions AttributeName=disputedAt,AttributeType=S \
  --global-secondary-index-updates '[{"Create":{
    "IndexName":"disputes",
    "KeySchema":[{"AttributeName":"disputedAt","KeyType":"HASH"}],
    "Projection":{"ProjectionType":"ALL"}}}]'

aws dynamodb wait table-exists --table-name lab-orders</code></pre>
<p>Mark exactly one order disputed, then query the index — it contains only that item:</p>
<pre><code>aws dynamodb update-item --table-name lab-orders \
  --key '{"customerId":{"S":"CUST#42"},"sk":{"S":"ORDER#2026-07-02#o-2"}}' \
  --update-expression "SET disputedAt = :d" \
  --expression-attribute-values '{":d":{"S":"2026-07-21"}}'

aws dynamodb query --table-name lab-orders --index-name disputes \
  --key-condition-expression "disputedAt = :d" \
  --expression-attribute-values '{":d":{"S":"2026-07-21"}}' \
  --query "[Count, Items[].sk]"</code></pre></li>

<li><p>Enable TTL and stamp one item with a past expiry. It will linger (lazy deletion) — exactly the behavior the lesson warned about:</p>
<pre><code>aws dynamodb update-time-to-live --table-name lab-orders \
  --time-to-live-specification "Enabled=true, AttributeName=expiresAt"

aws dynamodb update-item --table-name lab-orders \
  --key '{"customerId":{"S":"CUST#42"},"sk":{"S":"ORDER#2026-07-01#o-1"}}' \
  --update-expression "SET expiresAt = :t" \
  --expression-attribute-values '{":t":{"N":"1000000000"}}'</code></pre>
<p>Read it back immediately — it is still there. Check again later if curious; do not build systems that need it gone promptly without filtering.</p></li>
</ol>

<h3>Verify</h3>
<pre><code>aws dynamodb describe-table --table-name lab-orders \
  --query "Table.[TableStatus,ItemCount,BillingModeSummary.BillingMode,GlobalSecondaryIndexes[].IndexName]"
aws dynamodb describe-time-to-live --table-name lab-orders</code></pre>
<p>Expect ACTIVE, PAY_PER_REQUEST, the disputes index, and TTL ENABLED. (ItemCount updates only every ~6 hours — another eventual-consistency lesson for free.)</p>

<h3>Teardown</h3>
<p>One delete removes the table, its GSI, and all items. On-demand tables have no lingering capacity reservations.</p>
<ol>
<li><pre><code>aws dynamodb delete-table --table-name lab-orders
aws dynamodb wait table-not-exists --table-name lab-orders</code></pre></li>
<li><p>Confirm nothing remains (and that no backups were created during the lab):</p>
<pre><code>aws dynamodb list-tables
aws dynamodb list-backups --table-name lab-orders</code></pre></li>
</ol>
`
  }
});
