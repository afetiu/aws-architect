/* Module 10 — Caching: ElastiCache, DAX & CloudFront (SAA track) */
window.COURSE.register({
  id: "caching",
  order: 10,
  track: "saa",
  title: "Caching: ElastiCache, DAX & CloudFront",
  description: "Caching as an architectural discipline: cache-aside vs write-through trade-offs, ElastiCache (Redis/Valkey, Memcached, Serverless), DAX for DynamoDB, and CloudFront internals — cache keys, TTL math, OAC, signed URLs, edge compute, and the Global Accelerator confusion the exam loves.",
  examWeight: "Heavily tested on SAA-C03 across all four domains. Expect 4-8 questions: DAX vs ElastiCache, Memcached vs Redis keywords, CloudFront origin security (OAC), signed URLs vs cookies, CloudFront Functions vs Lambda@Edge, and at least one Global Accelerator vs CloudFront discriminator.",
  lessons: [
    {
      id: "strategy",
      title: "Caching strategy: patterns, TTLs, and stampedes",
      html: `
<p>You have been burned by caches before, so skip the sales pitch: a cache is a deliberate
consistency downgrade purchased for latency and cost. The architect-level questions are
always the same three: <strong>where</strong> in the stack does the cache live, <strong>how</strong> does data
get into it, and <strong>how stale</strong> are you willing to be. AWS just gives each answer a
product name. Get the pattern vocabulary precise, because both the exam and your incident
reviews will use it.</p>

<h3>Population patterns and their failure modes</h3>
<table>
<thead><tr><th>Pattern</th><th>Write path</th><th>Read path</th><th>Staleness</th><th>Cost you pay</th></tr></thead>
<tbody>
<tr><td><strong>Lazy loading (cache-aside)</strong></td><td>DB only; cache untouched</td><td>Check cache; on miss, read DB, populate cache</td><td>Up to TTL after any out-of-band write</td><td>Miss penalty (cache + DB round trips), stale reads</td></tr>
<tr><td><strong>Write-through</strong></td><td>Write DB and cache synchronously</td><td>Cache is (almost) always warm</td><td>Near zero for data written through the cache</td><td>Write amplification, cache full of never-read data, cold cache on node loss still needs lazy fallback</td></tr>
<tr><td><strong>Write-behind (write-back)</strong></td><td>Write cache, async flush to DB</td><td>Cache</td><td>DB is behind the cache</td><td>Data loss window if the cache node dies before flush</td></tr>
</tbody>
</table>

<p>In practice you run <strong>cache-aside plus TTL</strong> as the baseline and add write-through for
the hot, must-be-fresh entities. Pure write-through without TTLs quietly becomes an
unbounded memory leak of one-hit-wonder keys; pure lazy loading without invalidation
serves yesterday's price until the TTL saves you. Write-behind is the pattern the exam
punishes: any answer that treats an in-memory cache as the system of record before an
async flush is a durability bug wearing a performance costume.</p>

<div class="callout exam">Keyword mapping the exam uses constantly: "data can be slightly
stale, minimize DB load" → lazy loading with TTL. "Cache must never serve stale data
after an update" → write-through. "Reduce read load with minimal application change" →
a managed drop-in cache (DAX for DynamoDB, RDS read replicas otherwise — note replicas
are not caches, and the exam likes to make you choose between them).</div>

<h3>TTL strategy: jitter or die</h3>
<p>A fixed TTL is a synchronization primitive you did not mean to build. Deploy at 09:00,
warm 200k keys with TTL 3600, and at 10:00 they all expire in the same second — your DB
absorbs the entire read rate at once. Add <strong>jitter</strong>: TTL = base + random(0, 10-20% of
base). This is the same argument as exponential backoff jitter, applied to expiry.</p>

<h3>Thundering herd / cache stampede</h3>
<p>When one <em>hot</em> key expires, every concurrent reader misses simultaneously and each
one independently re-runs the expensive query. Mitigations, in ascending sophistication:</p>
<ol>
<li><strong>Request coalescing</strong> — only one in-flight recomputation per key; other readers wait
on it or serve stale. CloudFront does this for you at the edge (request collapsing);
in app code it is a per-key mutex or singleflight.</li>
<li><strong>Lock-and-recompute</strong> — miss takes a short-TTL lock key (SET NX PX in Redis); losers
serve the stale value or retry. Watch the failure mode: lock holder dies, lock TTL
must expire before anyone else recomputes.</li>
<li><strong>Probabilistic early expiry</strong> — each reader recomputes slightly before real expiry
with probability that rises as expiry approaches (the XFetch algorithm). No
coordination, no lock service, smooth refresh.</li>
<li><strong>Background refresh</strong> — never let hot keys expire; a worker refreshes them on a
schedule and TTL is only the safety net.</li>
</ol>

<div class="callout war">Classic production incident: Redis primary fails over, cache
comes back empty, and the database — sized for 10% miss traffic — gets 100% of reads.
The cache did not fail; the <em>database</em> fell over. If your DB cannot survive a cold
cache for a few minutes, you do not have a cache, you have an unacknowledged tier of
your storage system. Size the DB for cold-cache survival or implement gradual warmup
and load shedding.</div>

<h3>Invalidation: pick your poison</h3>
<p>Every invalidation strategy is a trade: <strong>TTL-only</strong> is simple and bounded-stale but
serves old data for up to the TTL. <strong>Explicit purge on write</strong> is fresh but couples every
writer to the cache topology and breaks silently when a writer forgets (or writes through
a path that does not know about the cache — batch jobs, DBAs, other services).
<strong>Versioned keys</strong> (embed a version or hash in the key/URL) sidestep invalidation
entirely — old entries die by eviction — and this is exactly why CloudFront best practice
is versioned object names instead of invalidation calls, as you will see later.</p>

<h3>Where to cache in the stack</h3>
<ul>
<li><strong>Client/browser</strong> — Cache-Control headers; zero infra, zero control after the fact.</li>
<li><strong>CDN (CloudFront)</strong> — offloads whole responses; keyed by URL + whatever you put in
the cache key; best RTT win for global users.</li>
<li><strong>App layer (ElastiCache)</strong> — caches computed objects, sessions, rate counters;
sub-ms; you own the invalidation logic.</li>
<li><strong>DB-adjacent (DAX, RDS buffer pool, read replicas)</strong> — transparent-ish, scoped to one
datastore's read path.</li>
</ul>
<p>Each layer down the stack caches a smaller unit at higher freshness cost. The exam's
multi-layer answers usually combine CloudFront (static + cacheable dynamic) with an
app-layer cache (hot query results, sessions) — recognize that as the intended
"reduce load at every tier" architecture rather than over-engineering.</p>

<div class="callout limits">Numbers worth having in your head: a same-AZ ElastiCache
round trip is ~300-500 microseconds; DAX advertises microseconds; DynamoDB single-digit
ms; cross-region anything is tens of ms. A cache only earns its complexity when it
removes work that costs meaningfully more than those numbers — do not front a 2 ms
DynamoDB read with a cache unless the motivation is cost (RCU offload) or a hot-key
ceiling, not latency vanity.</div>
`
    },
    {
      id: "redis",
      title: "ElastiCache for Redis/Valkey: topology, failover, and the durability lie",
      html: `
<p>ElastiCache runs Redis OSS or <strong>Valkey</strong> (the Linux Foundation fork AWS pivoted to
after the Redis license change — same protocol, roughly 20-30% cheaper on ElastiCache,
and the exam still says "Redis" for now). You know Redis; what you are buying from AWS is
topology management, failover orchestration, and the endpoints. That is also where all
the failure modes live.</p>

<h3>Two topologies, two endpoint models</h3>
<table>
<thead><tr><th></th><th>Cluster mode disabled (CMD)</th><th>Cluster mode enabled (CME)</th></tr></thead>
<tbody>
<tr><td>Shards</td><td>Exactly 1</td><td>Up to 500 nodes total across shards</td></tr>
<tr><td>Replicas</td><td>0-5 per the single shard</td><td>0-5 per shard</td></tr>
<tr><td>Write scaling</td><td>Vertical only (bigger node)</td><td>Horizontal — keyspace split across 16,384 hash slots</td></tr>
<tr><td>Endpoints</td><td>One <strong>primary endpoint</strong> (writes) + reader endpoint</td><td>One <strong>configuration endpoint</strong>; cluster-aware client discovers slot map</td></tr>
<tr><td>Client requirement</td><td>Any Redis client</td><td>Cluster-aware client; multi-key ops must hash-tag to one slot</td></tr>
</tbody>
</table>

<p>The architectural decision is the same as sharding any datastore: CMD caps your write
throughput and dataset at one primary node; CME buys horizontal scale and pays for it
with cross-slot restrictions (no MSET across slots without hash tags, Lua confined to one
slot, hot-slot skew if your key design is bad). The exam signals CME with "dataset larger
than the largest node" or "scale writes"; it signals CMD with "up to 5 read replicas" and
"a single primary endpoint".</p>

<div class="callout deep">Failover mechanics: with Multi-AZ automatic failover, ElastiCache
promotes the replica with the lowest replication lag and repoints DNS. Detection plus
promotion typically completes in well under a minute — but CMD clients only notice when
the primary endpoint's DNS re-resolves, so a client-side connection pool that caches DNS
(old JVMs, long-lived connections without reconnect logic) can keep writing into a dead
socket long after AWS has failed over. CME clients get slot-map updates via the protocol
(MOVED redirects), which is generally faster to converge. Either way, replication is
async: a failover can lose the last moments of acknowledged writes. Plan for it.</div>

<h3>Persistence: AOF, snapshots, and why neither makes it a database</h3>
<p>ElastiCache supports RDB-style <strong>snapshots</strong> (point-in-time, exportable to S3, used for
seeding new clusters) and, on some configurations, <strong>append-only files</strong>. Treat both as
recovery accelerants, not durability guarantees: replication is asynchronous, AOF does
not survive every hardware replacement scenario, and a failover restores <em>a</em> recent
state, not <em>the</em> committed state. If losing the data is an incident rather than a
cache-warm inconvenience, the data belongs in DynamoDB or RDS, with Redis in front.
The exam tests this as "team stores orders only in ElastiCache" — the correct answer
always moves the source of truth to a real database.</p>

<h3>Global Datastore</h3>
<p>Cross-region replication for CME: one primary (read/write) region, up to two secondary
(read-only) regions, typical replication lag under one second. Failover to a secondary is
<strong>manual</strong> (you promote it) and takes minutes — this is a DR and read-locality feature,
not an automatic multi-region active-active system. Writes only ever land in the primary
region. Exam keywords: "sub-second cross-region reads for a Redis workload" → Global
Datastore; do not confuse with DynamoDB global tables, which are active-active.</p>

<h3>Data tiering</h3>
<p>On <strong>r6gd</strong> nodes, ElastiCache spills least-recently-used <em>values</em> to local NVMe SSD,
keeping all keys in RAM. You get roughly 5x the effective capacity per node at ~60% lower
cost per GB, at the price of SSD latency on cold-value hits. Fit: large caches (hundreds
of GB to TB) where maybe 20% of data is hot. Not fit: uniformly hot working sets, or
tiny values where per-key RAM overhead dominates.</p>

<h3>Security model</h3>
<ul>
<li><strong>Redis AUTH</strong> — single shared token, legacy but still on the exam.</li>
<li><strong>RBAC</strong> (Redis 6+) — user groups with ACL command/key patterns; per-application users.</li>
<li><strong>IAM authentication</strong> — short-lived IAM-signed tokens instead of static passwords;
requires TLS; the "no stored credentials" answer.</li>
<li><strong>Encryption</strong> — in transit (TLS) and at rest (KMS) are separate toggles, chosen at
creation for older versions; both are required for HIPAA-style compliance answers.</li>
<li>Network: it lives in your VPC behind security groups. There is no public endpoint —
"expose ElastiCache to the internet" is always the wrong option.</li>
</ul>

<div class="callout war">Two production classics. First: scale-out re-sharding on CME
moves slots while serving traffic; it works, but latency-sensitive p99s notice — schedule
it. Second: a single hot key (celebrity object, global rate-limit counter) pins one shard
at 100% CPU while the other 14 idle; no amount of cluster scaling fixes key-design skew.
Redis is single-threaded per shard for command execution — one CPU core is your per-shard
ceiling, which is exactly the argument Memcached fans will make in the next lesson.</div>

<div class="callout limits">Memorize: 1 shard, up to 5 replicas, primary endpoint = CMD.
Up to 500 nodes, 16,384 hash slots, configuration endpoint = CME. Multi-AZ failover:
typically under a minute, async replication (small loss window). Global Datastore: ~1s
lag, up to 2 secondary regions, manual promotion. Data tiering: r6gd only, values to SSD,
keys stay in RAM.</div>
`
    },
    {
      id: "memcached-serverless",
      title: "Memcached vs Redis, and ElastiCache Serverless",
      html: `
<p>The Memcached-vs-Redis decision is twenty years old and the exam still asks it, because
it is really a question about what you are allowed to lose. Memcached is a pure
volatile object cache: <strong>multi-threaded</strong>, no persistence, no replication, no failover,
no data structures beyond string values, horizontal partitioning done <em>client-side</em>
(consistent hashing in your client library, helped by ElastiCache
<strong>auto-discovery</strong>, which lets clients learn node membership from a configuration
endpoint instead of a hardcoded list). Lose a node and you lose that partition of the
cache — and if that is fine, Memcached is the simplest, cheapest answer.</p>

<h3>The decision table</h3>
<table>
<thead><tr><th></th><th>Memcached</th><th>Redis/Valkey</th></tr></thead>
<tbody>
<tr><td>Threading</td><td>Multi-threaded — one big node uses all cores</td><td>Single-threaded command execution per shard</td></tr>
<tr><td>Data types</td><td>Blobs only</td><td>Strings, hashes, lists, sets, sorted sets, streams, geo, pub/sub</td></tr>
<tr><td>Replication / HA</td><td>None</td><td>Replicas, Multi-AZ auto failover</td></tr>
<tr><td>Persistence</td><td>None</td><td>Snapshots / AOF (recovery aid)</td></tr>
<tr><td>Scaling</td><td>Add/remove nodes; client re-partitions; cache partially cold</td><td>Re-sharding with slot migration (CME)</td></tr>
<tr><td>Use it when</td><td>Disposable object/page cache, simplest possible, big multi-core nodes</td><td>Anything with structure, HA, leaderboards, queues, sessions, pub/sub</td></tr>
</tbody>
</table>

<div class="callout exam">The exam telegraphs Memcached with a short list of exact words:
"<strong>simplest</strong> caching model", "<strong>multithreaded</strong>", "object caching", "can be
repopulated from the database on node failure", "no need for persistence or replication".
Any mention of sorted sets, leaderboards, pub/sub, persistence, failover, backup/restore,
or encryption-heavy compliance flips the answer to Redis. Do not overthink it — this is a
keyword question, and picking Redis "because it is better" is how people miss it.</div>

<div class="callout war">Memcached's real-world sharp edge is the scaling event, not the
steady state. Adding a node remaps a slice of the consistent-hash ring, so a fraction of
keys instantly go cold — on a fleet that leans hard on the cache, a routine scale-out
becomes a partial cold-cache incident (see lesson 1's stampede section). Redis CME
migrates slots <em>with</em> their data; Memcached does not. Budget DB headroom for
re-partition events or warm the new node before it takes traffic.</div>

<h3>ElastiCache Serverless</h3>
<p>Serverless removes the node-topology decision entirely: no instance types, no shard
counts, no replica math. You create a cache (Redis, Valkey, or Memcached flavor), get a
single endpoint, and it scales in seconds. Under the hood it is a multi-tenant fleet with
per-cache resource governance and automatic replication across AZs (yes — Serverless
gives even the Memcached API Multi-AZ resilience it never natively had).</p>

<p><strong>Pricing shape</strong> is the architecturally interesting part: you pay per
<strong>GB-hour of data stored</strong> plus per <strong>ECPU</strong> (ElastiCache Processing Unit — each ECPU
covers one simple request transferring up to 1 KB; bigger transfers and heavier commands
consume proportionally more). There is no idle instance cost, but there is also no
"free" headroom: a node-based cluster at high steady utilization is materially cheaper
per request than Serverless at the same load. The crossover logic is identical to
provisioned vs on-demand DynamoDB capacity:</p>

<ul>
<li><strong>Serverless fits</strong>: spiky or unpredictable traffic, dev/test, new workloads where you
cannot size nodes yet, teams that do not want to own failover/re-sharding operations,
Multi-AZ-by-default requirements with zero management.</li>
<li><strong>Node-based fits</strong>: high, steady, well-understood throughput (Serverless per-ECPU cost
exceeds a well-utilized reserved node), workloads needing specific engine parameters,
data tiering, or Global Datastore, and anything sensitive to multi-tenant p99 variance.</li>
</ul>

<div class="callout limits">Serverless caches scale to terabytes of storage and
millions of ECPUs per second, and you can set a <strong>maximum usage cap</strong> for both GB and
ECPU/s to bound your bill — set it, because an unbounded pay-per-use cache plus a
runaway loop is a very expensive way to discover a bug. Scaling is fast but not
instantaneous-to-any-height: sustained doubling is seamless; a 100x spike in one second
will briefly throttle while capacity follows.</div>

<div class="callout exam">Exam mapping: "unpredictable traffic, no capacity planning,
highly available cache with minimal operational overhead" → ElastiCache Serverless.
"Steady high throughput at lowest cost" → node-based with reserved nodes. Serverless
questions are usually easy points — the phrase "without managing infrastructure" does
most of the work.</div>

<p>One more positioning note: Serverless does not change the programming model. It is
still cache-aside/write-through logic in your code, still eventual staleness, still the
stampede math from lesson 1. What it removes is topology operations — which, if you
recall the failover and re-sharding war stories from the Redis lesson, is where most
ElastiCache operational pain actually lives. For a senior architect the honest summary
is: Serverless trades a higher unit price for the deletion of an entire class of 3 a.m.
pages, and for most mid-scale systems that trade is worth taking until the bill says
otherwise.</p>
`
    },
    {
      id: "dax",
      title: "DAX: DynamoDB's write-through cache",
      html: `
<p>DAX (DynamoDB Accelerator) is a managed, <strong>API-compatible, write-through</strong> cache that
sits in front of DynamoDB. The pitch that matters to an architect: you swap the DynamoDB
SDK client for the DAX client, change an endpoint, and reads that hit cache come back in
<strong>microseconds</strong> instead of single-digit milliseconds — with <em>no application logic
rewrite</em>. That "no rewrite" property is the exam's favorite discriminator between DAX
and a hand-rolled ElastiCache layer, where you own key design, population, and
invalidation yourself.</p>

<h3>Two caches inside, two TTLs</h3>
<ul>
<li><strong>Item cache</strong> — populated by GetItem/BatchGetItem, keyed by primary key. Default TTL
5 minutes.</li>
<li><strong>Query cache</strong> — populated by Query/Scan, keyed by the <em>entire request shape</em>
(table, index, key conditions, filters, limits). Separate TTL, also 5 minutes by
default.</li>
</ul>
<p>These are independent, and that has a subtle consequence: a write through DAX updates
the item cache <em>and</em> the underlying table, but it does <strong>not</strong> patch every cached
query result containing that item. A Query result cached 3 minutes ago keeps serving the
old item until the query cache TTL expires. If you have ever run a materialized view next
to a row cache, this is the same coherence gap.</p>

<div class="callout deep">Write path: the DAX client sends writes to the cluster; DAX
performs the write against DynamoDB first and only on success updates the item cache —
write-through, not write-behind, so DAX never acknowledges a write DynamoDB has not
durably taken. Corollary: DAX makes reads faster, never writes. Write-heavy workloads
get zero benefit and pay extra hops; the exam sometimes offers DAX for a write-latency
problem precisely to catch this.</div>

<h3>Consistency semantics — the trap the exam loves</h3>
<p>DAX serves <strong>eventually consistent</strong> reads from cache. A request with
<code>ConsistentRead=true</code> (strongly consistent) <em>bypasses the cache entirely</em> and goes
to DynamoDB — you pay DAX cluster cost and get no acceleration. So an application that
demands strong consistency on its hot path gets nothing from DAX. Also remember writes
that do <em>not</em> go through DAX (another service writing directly to the table, Streams-driven
fixups, console edits) leave stale entries in DAX until TTL — DynamoDB does not notify
DAX of external changes.</p>

<h3>Cluster shape and failure modes</h3>
<p>A DAX cluster is 1-11 nodes (one primary handling writes and cache misses'
write-back, replicas serving reads), Multi-AZ, in your VPC. Failover promotes a replica
in seconds-to-a-minute. Sizing note: the whole hot set should fit in one node's memory —
DAX replicates the cache rather than partitioning it, so adding nodes scales read
<em>throughput</em>, not cache <em>capacity</em>. A miss storm after node replacement hits
DynamoDB directly; keep table capacity able to absorb it (same cold-cache argument as
lesson 1).</p>

<h3>DAX vs a generic ElastiCache layer</h3>
<table>
<thead><tr><th></th><th>DAX</th><th>ElastiCache (Redis) in front of DynamoDB</th></tr></thead>
<tbody>
<tr><td>App changes</td><td>Client library swap only</td><td>You write cache-aside logic, keys, invalidation</td></tr>
<tr><td>Scope</td><td>Single-table/query results for DynamoDB only</td><td>Anything: cross-table aggregations, computed objects, non-DynamoDB data</td></tr>
<tr><td>Extras</td><td>None — it is a cache, full stop</td><td>Data structures, pub/sub, counters, sessions, leaderboards</td></tr>
<tr><td>Consistency</td><td>Eventually consistent reads only</td><td>Whatever your code enforces</td></tr>
<tr><td>Pricing</td><td>Per node-hour (plus normal DynamoDB)</td><td>Per node-hour or Serverless ECPU/GB</td></tr>
</tbody>
</table>

<p>Choose DAX when the problem is literally "DynamoDB reads are too slow/expensive and the
access pattern is repeated GetItem/Query". Choose ElastiCache when you need to cache the
<em>result of computation</em> across tables or services, need Redis data structures, or need
the cache for things DynamoDB never sees. The exam phrases the DAX side as
"microsecond latency for DynamoDB reads with minimal code changes" and the ElastiCache
side as "aggregate results from multiple tables" or "store session state and leaderboards".</p>

<div class="callout war">Cost reality check: DAX nodes are EC2-priced (a 3-node HA
cluster of even small nodes runs hundreds of dollars a month). Its economic win comes
from RCU offload — a 90%+ hit ratio on a heavy read table can cut provisioned RCUs
dramatically, which is often a bigger number than the latency story. Conversely, a
low-traffic table gains nothing: you pay three nodes to cache reads DynamoDB would have
served for pennies. Run the hit-ratio math before deploying it, and remember DAX
supports a subset of the API — always through the DAX SDK client, from inside the VPC.</div>

<div class="callout limits">Memorize: item cache and query cache with separate TTLs
(default 5 min each). Microsecond reads on hits. Write-through. Strongly consistent
reads bypass the cache. Up to 11 nodes (1 primary + up to 10 replicas), Multi-AZ.
Replicated cache, not partitioned — node RAM bounds cache size. VPC-only, DAX client
SDK required (that is the "no code rewrite" nuance: swap the client, keep the calls).</div>
`
    },
    {
      id: "sessions",
      title: "Session state: sticky sessions vs Redis vs DynamoDB",
      html: `
<p>"Make the web tier stateless" is one of the most reliable answer patterns on the SAA
exam, and session storage is where it gets tested. You have three realistic designs for
HTTP session state behind an ALB, and they form a maturity ladder.</p>

<h3>Option 1: sticky sessions (ALB session affinity)</h3>
<p>The ALB pins a client to one target using either <strong>duration-based cookies</strong> (ALB-generated
AWSALB cookie, configurable 1 second to 7 days) or <strong>application-based cookies</strong> (your
cookie name, ALB tracks it). State stays in target memory. Every senior engineer knows
the failure modes because they are the same as any affinity scheme:</p>
<ul>
<li><strong>Scale-in and deploys log users out</strong> — the instance holding their session terminates.
Auto Scaling plus stickiness is a standing conflict.</li>
<li><strong>Load skew</strong> — long-lived sessions concentrate on old instances; new instances start
cold while old ones run hot. Autoscaling metrics get distorted.</li>
<li><strong>Failover loses state</strong> — an AZ event or health-check failure drops every session on
the affected targets.</li>
</ul>
<div class="callout exam">On the exam, sticky sessions are almost always the <em>wrong</em>
answer dressed as the easy one. They appear as the "minimal change" distractor in
questions about resilience or scaling. The correct pattern is externalizing state so
"any instance can serve any request". The one place stickiness is legitimately correct:
a legacy app that genuinely cannot be modified and the question explicitly accepts the
trade-offs, or WebSocket-era servers with expensive per-client warmup.</div>

<h3>Option 2: ElastiCache (Redis) session store</h3>
<p>The canonical externalization: sessions as Redis hashes or serialized blobs, keyed by
session ID, with a TTL matching your idle timeout (Redis TTL handles expiry natively — no
reaper cron). Sub-millisecond reads keep per-request overhead invisible. Requirements
that push you here: very high request rates (every request touches the session), session
data you mutate frequently (carts, presence), or the need for atomic operations on
session fields. Run it Multi-AZ with automatic failover, and accept the lesson-2 caveat:
an unlucky failover can lose the last moments of writes. For sessions that is usually
"one user re-adds an item to a cart", i.e., acceptable — say so explicitly in a design
review rather than discovering the assumption later.</p>

<h3>Option 3: DynamoDB with TTL</h3>
<p>Sessions as items keyed by session ID, with a <strong>TTL attribute</strong> for expiry. Single-digit
millisecond access, serverless scaling, no cluster to fail over, pay-per-request pricing
that matches spiky login patterns beautifully. Two nuances a senior should carry:</p>
<ul>
<li>DynamoDB TTL deletion is a <strong>background process</strong> — items can persist up to ~48 hours
past expiry. Your read path must still filter expired sessions (check the timestamp);
TTL is garbage collection, not access control.</li>
<li>Hot-partition risk is negligible for random session IDs, but do not key sessions by
tenant or date prefix, which recreates the hot-key problem.</li>
</ul>

<h3>Choosing between them</h3>
<table>
<thead><tr><th></th><th>Sticky sessions</th><th>ElastiCache Redis</th><th>DynamoDB + TTL</th></tr></thead>
<tbody>
<tr><td>Latency</td><td>Zero (in-process)</td><td>Sub-ms</td><td>Single-digit ms</td></tr>
<tr><td>Survives instance loss</td><td>No</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Ops burden</td><td>None</td><td>Cluster to run (or Serverless)</td><td>None</td></tr>
<tr><td>Durability</td><td>None</td><td>Best-effort (async replication)</td><td>Durable</td></tr>
<tr><td>Cost shape</td><td>Free</td><td>Node-hours (idle cost) or ECPU</td><td>Per request (scales to zero)</td></tr>
<tr><td>Exam keywords</td><td>"minimal change" (usually a trap)</td><td>"lowest latency", "sub-millisecond"</td><td>"serverless", "no infrastructure to manage", "durable sessions"</td></tr>
</tbody>
</table>

<div class="callout war">Two real-world notes. First, session payload creep: teams stuff
serialized user objects, feature flags, and permission trees into the session until every
request drags 200 KB through the cache — cap the payload and store references, not
copies. Second, the JWT escape hatch: signed tokens move session state into the client
entirely and are the true "stateless" answer, but revocation then needs a denylist —
which lands you right back at a fast shared store (Redis) for the denylist. There is no
free lunch, only smaller lunches.</div>

<div class="callout limits">ALB duration-based stickiness: 1 second to 7 days per target
group. DynamoDB TTL: expiry is approximate, deletions lag up to ~48h, TTL deletes are
free (no WCU charge) and appear in Streams if you need logout events. Redis session TTL:
exact, enforced on read.</div>

<p>The composite exam answer to recognize: "move session state to ElastiCache or DynamoDB
so the Auto Scaling group can scale in without logging users out" — externalized state is
what makes instances disposable, which is what makes autoscaling, blue/green deploys, and
Spot usage in the web tier safe. Session storage is a small design choice that gates all
of those bigger ones, which is why the exam keeps returning to it.</p>
`
    },
    {
      id: "cloudfront-core",
      title: "CloudFront internals: cache keys, TTL math, invalidation, economics",
      html: `
<p>CloudFront is a two-tier read-through cache with ~600+ <strong>edge locations</strong> in front of
<strong>regional edge caches</strong> (larger, longer-retention mid-tier caches). A miss at the edge
checks the regional cache before going to origin, and CloudFront collapses concurrent
misses for the same object into a single origin fetch — built-in request coalescing, which
is why an origin behind CloudFront sees far less stampede pressure than a naked origin.
Mental model: it is Varnish with a global mid-tier, where the config language is
distributions, behaviors, and policies.</p>

<h3>Origins and origin groups</h3>
<p>Origins are S3 (native integration, OAC — next lesson) or <strong>custom origins</strong> (any
HTTP(S) endpoint: ALB, API Gateway, your own servers, even S3 static website endpoints,
which count as custom). An <strong>origin group</strong> pairs a primary and secondary origin:
CloudFront fails over to the secondary when the primary returns configured 4xx/5xx status
codes, times out, or refuses connections. The catch the exam tests: failover applies to
<strong>GET/HEAD/OPTIONS only</strong> — writes (PUT/POST) are never retried against the secondary,
so origin groups are a read-availability tool, not a multi-region write story.</p>

<h3>Cache behaviors: path routing with precedence</h3>
<p>A distribution has ordered <strong>cache behaviors</strong> matched by path pattern
(<code>/api/*</code>, <code>*.jpg</code>) plus a default behavior (<code>*</code>). First match wins,
top-down — exactly like route tables or nginx location blocks, and with the same classic
bug: a broad pattern above a specific one shadows it. Behaviors are where everything
attaches: policies, viewer protocol, allowed methods, signed-URL requirements, function
associations. The standard architecture is one distribution serving <code>/static/*</code>
from S3 (long TTL) and <code>/api/*</code> from an ALB (TTL 0 or short) — one domain, no CORS
gymnastics, per-path caching rules.</p>

<h3>The cache key: policies, and the over-keying trap</h3>
<p>Three policy types, and confusing them is the number one CloudFront exam trap:</p>
<ul>
<li><strong>Cache policy</strong> — defines the <strong>cache key</strong>: which headers, cookies, and query
strings are part of object identity, plus min/default/max TTL and compression support.</li>
<li><strong>Origin request policy</strong> — what gets <em>forwarded</em> to the origin <em>in addition</em>
to the cache key. Forwarding without keying lets the origin see (say) the User-Agent
without fragmenting the cache by it.</li>
<li><strong>Response headers policy</strong> — headers CloudFront <em>adds</em> to responses (CORS,
security headers like HSTS/CSP) without origin changes.</li>
</ul>
<p>A cache policy is <code>Vary</code> made explicit: everything you include in the key
partitions the cache. Include all cookies and every user gets a private cache — hit ratio
collapses to zero while you pay full origin load plus CloudFront request fees. The
discipline is: key on the minimum that changes the response; forward the rest via origin
request policy. Managed policies (CachingOptimized, CachingDisabled, AllViewer) cover the
common cases — use them in answers unless the scenario demands custom keys.</p>

<div class="callout deep">TTL arithmetic, worth knowing cold. If the origin sends
Cache-Control (or Expires), CloudFront caches for
<strong>clamp(header value, min TTL, max TTL)</strong>. If the origin sends nothing, CloudFront
uses <strong>default TTL</strong>. Defaults: min 0, default 86,400s (24h), max 31,536,000s (1 year).
So "origin says no-cache but CloudFront still caches" means min TTL is nonzero (min TTL
overrides the header floor), and "we set Cache-Control: max-age=604800 but objects
refresh daily" means max TTL is clamping you. Setting min=max forces a fixed TTL
regardless of origin headers.</div>

<h3>Invalidation vs versioned names</h3>
<p>Invalidations purge paths from every edge: the first <strong>1,000 paths per month are free</strong>,
then half a cent per path; a wildcard like <code>/images/*</code> counts as <em>one</em> path;
propagation takes a few minutes. But the architecturally correct pattern is
<strong>versioned object names</strong> (<code>app.2f4a9c.js</code>): deploys become atomic (old and new
coexist), rollback is instant, browser caches are also busted (invalidation cannot reach
those), and you never pay for or wait on invalidation. Reserve invalidation for
emergencies — pulled content, bad deploy of a non-versioned file.</p>

<h3>Transport features</h3>
<p>CloudFront compresses objects with <strong>gzip and Brotli</strong> at the edge when the viewer
advertises support and the cache policy enables it — turn it on and stop compressing at
origin. <strong>HTTP/3 (QUIC)</strong> is a checkbox: 0-RTT resumption and better behavior on lossy
mobile networks, viewer-side only (origin fetches stay HTTP/1.1/2). <strong>Field-level
encryption</strong> exists for the exam: asymmetric encryption of specific POST fields (card
numbers) at the edge so only the final service with the private key can read them —
recognize the phrase, know it protects specific fields even from your own app tier.</p>

<h3>Economics</h3>
<ul>
<li><strong>Origin fetch is free from AWS origins</strong> — S3/ALB/EC2 to CloudFront transfers cost
nothing, which usually makes fronting an ALB with CloudFront cost-neutral-or-better
even at low hit ratios (CloudFront egress is priced at-or-below EC2 egress).</li>
<li><strong>Egress to viewers</strong> is billed per GB by geography class — cheapest in NA/EU, most
expensive in South America/India — plus per-request fees.</li>
<li><strong>Price classes</strong> cap which edges serve you: PriceClass_100 (NA+EU),
PriceClass_200 (adds Asia/ME/Africa), PriceClass_All. Users outside your class still
get served — from a farther, cheaper edge with worse latency. It is a cost/latency
dial, not a geo-block (that is geo restriction, a separate feature).</li>
</ul>

<div class="callout war">The observability handles: the <code>x-cache</code> response header
tells you Hit/Miss/RefreshHit per request, <code>age</code> tells you how stale the copy is,
and the cache-hit-rate metric in the console tells you when someone ships an over-keyed
cache policy. Hit ratio dropping after a deploy is almost always a new header/cookie in
the cache key or a query-string param (cache-busting analytics tags — normalize them
away with a function, next lesson).</div>
`
    },
    {
      id: "cloudfront-security",
      title: "CloudFront security: OAC, signed URLs/cookies, locking down origins",
      html: `
<p>A CDN in front of an origin creates two doors, and both must be locked: viewers must
not bypass CloudFront to hit the origin directly (or your WAF, auth, and caching are
decorative), and unauthorized viewers must not fetch private content through CloudFront.
AWS has one mechanism per origin type for the first problem and signed URLs/cookies for
the second.</p>

<h3>S3 origins: Origin Access Control (OAC)</h3>
<p><strong>OAC</strong> is the current mechanism (replacing legacy <strong>OAI</strong>) for making a private S3
bucket readable only via CloudFront. CloudFront signs its origin requests with
<strong>SigV4</strong> as the service principal <code>cloudfront.amazonaws.com</code>, and the bucket
policy grants <code>s3:GetObject</code> to that principal <em>conditioned on the source
distribution ARN</em> — so only your distribution, not anyone's, can read. Why OAC beat OAI:
it supports <strong>SSE-KMS encrypted objects</strong> (OAI could not — the KMS key policy can trust
the signed service requests), all HTTP methods including PUT/DELETE, and all regions.
Migration note the exam likes: OAC and OAI can coexist on an origin during migration,
and every "which is the modern/recommended answer" question resolves to OAC.</p>

<div class="callout exam">Pattern: "S3 bucket must only be accessible through CloudFront"
→ OAC + bucket policy with the AWS:SourceArn condition + Block Public Access stays ON.
If the scenario mentions SSE-KMS objects returning errors through CloudFront with OAI,
the fix is migrating to OAC. If an option says "S3 static website endpoint", note that
website endpoints do not support OAC/OAI at all (they are anonymous HTTP custom origins)
— that option is only right when the question needs redirects or index documents in
subdirectories, and then the bucket is public or referer-header-restricted.</div>

<h3>Custom origins: the secret header pattern</h3>
<p>ALBs and other custom origins have no OAC equivalent (OAC covers S3, Lambda function
URLs, and a few media services). The standard lockdown is defense in depth:</p>
<ul>
<li>CloudFront adds a <strong>custom origin header</strong> (e.g. <code>X-Origin-Verify: long-random-secret</code>)
to every origin request; an <strong>ALB listener rule or WAF rule on the ALB</strong> rejects
requests lacking it. Rotate the secret (two-value overlap during rotation, ideally
automated via Secrets Manager).</li>
<li>Restrict the origin security group to the <strong>CloudFront managed prefix list</strong>
(com.amazonaws.global.cloudfront.origin-facing), so only CloudFront edge ranges can
even connect. Prefix list alone is not enough — any AWS customer's distribution egresses
from those ranges, hence the header check on top.</li>
</ul>

<h3>Private content: signed URLs vs signed cookies</h3>
<table>
<thead><tr><th></th><th>Signed URL</th><th>Signed cookies</th></tr></thead>
<tbody>
<tr><td>Grants access to</td><td>One object (the URL <em>is</em> the grant)</td><td>Many objects / path patterns without changing URLs</td></tr>
<tr><td>Use case</td><td>Single file download, per-object entitlement, links in emails</td><td>Whole video library, an entire subscriber area, HLS/DASH segment streams</td></tr>
<tr><td>Client requirements</td><td>None</td><td>Cookie support (breaks for some players/APIs)</td></tr>
<tr><td>Precedence</td><td colspan="2">If both are present, the signed URL wins</td></tr>
</tbody>
</table>
<p>Both carry a policy (expiry, optional start time, optional source IP range) signed with
a private key. The modern key model is <strong>trusted key groups</strong>: you upload public keys to
CloudFront, group them, and attach key groups to behaviors — manageable via API/IAM, with
key rotation by adding a new key and draining the old. The legacy model,
<strong>CloudFront key pairs on the AWS account root user</strong>, is the exam's "why is this
wrong" option: it requires root access and cannot be IAM-controlled. Requiring signed
requests is set <em>per cache behavior</em>, so you can sign <code>/premium/*</code> while
leaving <code>/public/*</code> open on the same distribution.</p>

<div class="callout deep">How the check works: the edge validates the signature against
the public keys in the behavior's trusted key groups and evaluates the policy
(expiry/IP) <em>before</em> touching cache or origin. Signing happens entirely in your app
(the signer library plus the private key from Secrets Manager/Parameter Store) — there
is no AWS API call to sign, so URL issuance adds no latency and cannot be throttled.
Contrast with S3 presigned URLs: those bypass CloudFront entirely, expose the S3 domain,
and are capped by the signing credential's lifetime — the exam distinguishes "presigned
S3 URL" (direct S3, simple, no CDN) from "CloudFront signed URL" (through the CDN,
cached, key-group controlled).</div>

<h3>Origin failover meets security</h3>
<p>Origin groups (previous lesson) interact with OAC cleanly: give both buckets an OAC
grant and CloudFront fails reads over between them — e.g., primary bucket in one region,
cross-region-replicated secondary in another, achieving multi-region static-content HA
with zero code. Remember the constraint: GET/HEAD only, and the secondary should be
reachable with the <em>same</em> path structure or you fail over into 404s.</p>

<div class="callout war">The bypass audit that catches real deployments: after locking
S3 behind OAC, grep your codebase and templates for direct
<code>bucket.s3.amazonaws.com</code> URLs — hard-coded direct links keep working until you
enable the bucket policy, then break in production at deploy time. Also verify the ALB
has no second, older listener without the header rule, and that the origin still accepts
health checks from within the VPC if you tightened security groups to the CloudFront
prefix list. Every one of these has caused a sev-2 somewhere.</div>

<div class="callout limits">Numbers: signed URL/cookie policies support expiry, start
time, and IP CIDR conditions. Up to 4 trusted key groups per cache behavior, up to 5
public keys per key group. OAC supports SigV4 signing to S3 in all regions and SSE-KMS.
CloudFront managed prefix list is origin-facing ranges only. Field-level encryption:
up to 10 fields per profile.</div>
`
    },
    {
      id: "edge-ga",
      title: "Edge compute (CloudFront Functions vs Lambda@Edge) and Global Accelerator",
      html: `
<p>Two closing topics that decide several exam questions each: which of CloudFront's two
compute options runs your edge logic, and whether the scenario wants CloudFront at all or
its L4 sibling, Global Accelerator.</p>

<h3>CloudFront Functions vs Lambda@Edge</h3>
<p>Model them as different animals: CloudFront Functions are a restricted JavaScript
engine embedded <em>in the edge process itself</em> — sub-millisecond, no network, no
filesystem, no request body. Lambda@Edge is real Lambda, replicated to regional edge
caches — slower to start, vastly more capable.</p>
<table>
<thead><tr><th></th><th>CloudFront Functions</th><th>Lambda@Edge</th></tr></thead>
<tbody>
<tr><td>Triggers</td><td><strong>Viewer request / viewer response only</strong></td><td>Viewer request/response <strong>and origin request/response</strong></td></tr>
<tr><td>Runtime</td><td>Lightweight JavaScript, sub-ms execution budget</td><td>Node.js or Python</td></tr>
<tr><td>Timeout</td><td>Under 1 ms of compute</td><td>5 s (viewer triggers), 30 s (origin triggers)</td></tr>
<tr><td>Memory</td><td>2 MB</td><td>128 MB (viewer) up to 10 GB (origin)</td></tr>
<tr><td>Network / filesystem / body</td><td>None / none / no body access</td><td>Yes / /tmp / body access (with limits)</td></tr>
<tr><td>Scale</td><td>Millions of req/s instantly</td><td>Thousands of req/s, regional Lambda scaling</td></tr>
<tr><td>Price</td><td>Roughly one-sixth of Lambda@Edge per invocation; free tier exists</td><td>Per request + GB-second, no free tier</td></tr>
<tr><td>Runs at</td><td>All ~600+ edge locations</td><td>Regional edge caches (~13)</td></tr>
</tbody>
</table>
<p>Use-case mapping follows directly. <strong>CloudFront Functions</strong>: header
normalization/manipulation, URL rewrites and redirects, cache-key normalization (strip
marketing query params — the hit-ratio fix from two lessons ago), lightweight JWT
validation (pure-JS crypto on a small token). <strong>Lambda@Edge</strong>: anything needing a
network call (auth lookup against DynamoDB, fetching per-user config), <strong>origin
selection</strong> (rewrite the origin per request — A/B tests, multi-region routing by
geo header), response generation/manipulation that needs real compute, and any
<em>origin-side</em> trigger, since CloudFront Functions simply cannot attach there.
Origin-side triggers run only on cache <em>misses</em>, which is where you want expensive
logic anyway; viewer triggers run on every request.</p>

<div class="callout war">Lambda@Edge deployment friction is real and exam-relevant: the
function must be authored in <strong>us-east-1</strong>, is replicated globally by CloudFront, and
is versioned — you associate a specific version, not an alias or latest. Deletion is the
famous pain: you must disassociate it from every behavior and then wait (historically
hours) for replicas to drain before the delete succeeds. Also no environment variables
and no VPC access for viewer-trigger functions — configuration goes in code or gets
fetched at runtime.</div>

<h3>Global Accelerator vs CloudFront — the classic confusion</h3>
<p>Both are "AWS edge network" products; the resemblance ends there. <strong>Global
Accelerator</strong> gives you <strong>two static anycast IPv4 addresses</strong>; client traffic enters the
AWS backbone at the nearest edge location and rides it — congestion-free relative to the
public internet — to your endpoints: ALB, NLB, EC2, or Elastic IPs, in one or many
regions. It is a <strong>Layer 4 (TCP/UDP)</strong> accelerator: <strong>no caching, no HTTP awareness,
no TLS termination</strong> (standard accelerator) — bytes in, bytes out, faster and steadier.
Health checks drive <strong>deterministic, near-instant regional failover</strong> (no DNS TTLs to
wait out, because the anycast IPs never change — failover is a routing decision inside
AWS, typically well under a minute and invisible to clients). Traffic dials and endpoint
weights give you controlled regional shifting for deployments and DR drills.</p>
<table>
<thead><tr><th></th><th>CloudFront</th><th>Global Accelerator</th></tr></thead>
<tbody>
<tr><td>Layer</td><td>7 (HTTP/HTTPS)</td><td>4 (TCP/UDP)</td></tr>
<tr><td>Caching</td><td>Yes — the whole point</td><td>None</td></tr>
<tr><td>Addresses</td><td>Dynamic, DNS-based (CNAME/alias)</td><td>2 static anycast IPs (bring-your-own supported)</td></tr>
<tr><td>Protocols</td><td>HTTP(S), WebSocket</td><td>Any TCP or UDP</td></tr>
<tr><td>Failover</td><td>Origin groups (GET/HEAD, per-request)</td><td>Health-check based regional shift, seconds, no client change</td></tr>
<tr><td>Sweet spot</td><td>Web content, APIs, static + dynamic HTTP</td><td>Gaming (UDP), VoIP, MQTT/IoT, financial TCP feeds, IP-allowlist requirements, multi-region NLB/ALB front door</td></tr>
</tbody>
</table>
<div class="callout exam">Keyword table — this is close to a free question once
memorized: "static IP addresses" / "customers must allowlist IPs" → Global Accelerator.
"UDP" / "gaming" / "VoIP" → Global Accelerator. "Deterministic fast failover across
regions" → Global Accelerator. "Cache content" / "HTTP" / "static and dynamic web
content" / "reduce load on origin" → CloudFront. Trap: an NLB needs static IPs per
region anyway (it has them) — GA's win is <em>global</em> static IPs spanning regions plus
backbone routing. Second trap: GA "improves performance for dynamic content" is true —
so does CloudFront (connection reuse, TLS at edge) — the tiebreakers are protocol (UDP
→ GA), caching (→ CloudFront), and static IP (→ GA).</div>

<div class="callout limits">GA pricing shape: fixed hourly fee per accelerator plus a
premium per GB (DT-Premium) on top of standard transfer — it is never the "cheapest"
answer, it is the "fastest failover / static IP / UDP" answer. CloudFront Functions:
2 MB memory, sub-ms, viewer triggers only. Lambda@Edge: 5 s / 30 s timeouts, us-east-1
authoring, versions only. Both can coexist on one behavior (a CloudFront Function on
viewer request plus Lambda@Edge on origin request is a common pairing).</div>
`
    }
  ],
  quiz: [
    {
      q: "A product catalog API caches results in ElastiCache with a fixed 3600-second TTL, warmed by a nightly batch job. Every morning at the same time, the RDS database CPU spikes to 100% for several minutes. What is the most likely cause and best fix?",
      options: [
        "The cache nodes are undersized; scale up the ElastiCache node type",
        "All cached keys expire simultaneously because they share one TTL; add randomized jitter to the TTL of each key",
        "RDS automated backups are running; move the backup window",
        "The batch job should use write-behind caching instead of write-through"
      ],
      answer: [1],
      multi: false,
      explanation: "Keys warmed together with an identical TTL expire together, producing a synchronized miss storm against the database — the classic mass-expiry stampede. Adding jitter (TTL = base + random offset) spreads the expirations. <strong>A</strong> is wrong because the cache is not failing — the misses are by design of the TTL, and bigger nodes would not change expiry timing. <strong>C</strong> is a plausible-sounding distractor, but the correlation with warm time plus TTL points at expiry, and backups do not cause read-miss floods. <strong>D</strong> misapplies pattern vocabulary: write-behind concerns write durability, not read-miss synchronization, and would introduce a data-loss window for no benefit."
    },
    {
      q: "A gaming leaderboard on ElastiCache for Redis has outgrown the largest available node type: write throughput and dataset size both exceed a single primary. What should the architect do?",
      options: [
        "Enable cluster mode and shard the keyspace across multiple node groups, connecting via the configuration endpoint",
        "Add 5 read replicas to the existing replication group and distribute writes across them",
        "Enable Multi-AZ automatic failover to add a second writable primary",
        "Migrate to Memcached, which supports client-side partitioning"
      ],
      answer: [0],
      multi: false,
      explanation: "Cluster mode enabled is the horizontal write-scaling answer: the keyspace splits across 16,384 hash slots over multiple shards (up to 500 nodes), each shard with its own primary, and cluster-aware clients use the configuration endpoint. <strong>B</strong> fails because replicas are read-only — Redis replication never scales writes, and 5 replicas is the per-shard cap, not a write path. <strong>C</strong> misunderstands Multi-AZ: failover provides availability, never a second concurrent writer. <strong>D</strong> would technically partition, but throws away the sorted sets a leaderboard depends on — Memcached has no data structures — making it a keyword trap."
    },
    {
      q: "A startup stores customer orders exclusively in ElastiCache for Redis with AOF enabled and daily snapshots, arguing this makes the data durable. During a failover, several minutes of orders disappear. What is the correct architectural assessment?",
      options: [
        "AOF was misconfigured; setting appendfsync to always would have prevented all loss",
        "Snapshots should have been taken hourly instead of daily",
        "Redis replication is asynchronous and ElastiCache persistence is a recovery aid, not a durability guarantee; the source of truth belongs in a durable database with Redis as a cache",
        "The cluster needed Global Datastore so a secondary region could recover the writes"
      ],
      answer: [2],
      multi: false,
      explanation: "ElastiCache replication is async, so a failover promotes a replica that may lack the last acknowledged writes; AOF and snapshots accelerate recovery but do not close that window or survive every replacement scenario. The fix is architectural: orders go to DynamoDB/RDS, Redis caches them. <strong>A</strong> is wrong both practically (ElastiCache does not expose that as a durability contract, and fsync-always still would not fix async replica promotion) and architecturally. <strong>B</strong> shrinks the loss window without eliminating it — still the wrong system of record. <strong>D</strong> makes it worse: Global Datastore replication is also asynchronous (~1s lag) and manual-failover, adding cost without durability."
    },
    {
      q: "An application needs the simplest possible caching layer for rendered HTML fragments. The team explicitly wants a multithreaded cache that can use all cores of large instances, needs no persistence or replication, and can tolerate repopulating from the database after a node failure. Which service fits?",
      options: [
        "ElastiCache for Redis with cluster mode enabled",
        "ElastiCache for Memcached with auto-discovery",
        "DAX with a single-node cluster",
        "ElastiCache for Redis with data tiering on r6gd nodes"
      ],
      answer: [1],
      multi: false,
      explanation: "This is the canonical Memcached keyword cluster: simplest, multithreaded, disposable object cache, no persistence/replication needed, cold-start acceptable — and auto-discovery handles node membership for the client-side partitioning. <strong>A</strong> and <strong>D</strong> offer replication, persistence, and data structures the scenario explicitly does not want, and Redis's single-threaded-per-shard execution wastes the big multi-core instances the team asked to exploit. <strong>C</strong> is wrong because DAX only caches DynamoDB API calls — it cannot cache arbitrary HTML fragments, and the backing store here is a database accessed generically."
    },
    {
      q: "A DynamoDB-backed product service has a read-heavy workload of repeated GetItem and Query calls. The team wants microsecond read latency and lower RCU consumption with the smallest possible code change. Which solution is best?",
      options: [
        "Add an ElastiCache for Redis cluster and implement cache-aside logic in the application",
        "Deploy a DAX cluster and switch the application to the DAX SDK client",
        "Enable DynamoDB auto scaling on the table to raise the read capacity",
        "Create a global secondary index to serve the repeated queries"
      ],
      answer: [1],
      multi: false,
      explanation: "DAX is purpose-built for this: API-compatible write-through cache, so swapping the SDK client for the DAX client is the entire change, hits return in microseconds, and cached reads consume no RCUs. <strong>A</strong> works but fails the 'smallest code change' requirement — you must design keys, population, and invalidation yourself. <strong>C</strong> raises throughput ceilings and cost but does nothing for latency (still single-digit ms) and increases RCU spend rather than reducing it. <strong>D</strong> is unrelated: a GSI serves different access patterns; it does not cache repeated identical reads, costs extra WCUs, and adds no latency benefit for GetItem traffic."
    },
    {
      q: "After deploying DAX in front of DynamoDB, a team notices that one critical read path shows no latency improvement at all, while other paths dropped to microseconds. The slow path uses ConsistentRead set to true. Why is DAX not helping there?",
      options: [
        "The query cache TTL is too short for that access pattern",
        "Strongly consistent reads bypass the DAX cache entirely and are served by DynamoDB",
        "DAX only accelerates writes, not reads",
        "The item cache only supports BatchGetItem, not single GetItem calls"
      ],
      answer: [1],
      multi: false,
      explanation: "DAX serves eventually consistent reads from cache; any request with ConsistentRead=true is passed straight through to DynamoDB, gaining nothing from the cluster. The fix is either relaxing that path to eventual consistency or accepting DynamoDB latency there. <strong>A</strong> would cause more misses but the misses would still populate the cache — some improvement would show; total absence of improvement points to bypass. <strong>C</strong> inverts reality: DAX is a read accelerator with write-through semantics; it never speeds up writes. <strong>D</strong> is fabricated — the item cache serves both GetItem and BatchGetItem."
    },
    {
      q: "A web application on an Auto Scaling group behind an ALB uses duration-based sticky sessions. Users report being logged out whenever the group scales in, and CloudWatch shows heavily uneven load across instances. The team wants users to stay logged in through scaling events with the lowest added request latency. What should they do?",
      options: [
        "Increase the stickiness cookie duration to the 7-day maximum",
        "Move session state to an ElastiCache for Redis replication group with Multi-AZ and disable stickiness",
        "Enable cross-zone load balancing to even out the traffic",
        "Store sessions on an EFS file system mounted by all instances"
      ],
      answer: [1],
      multi: false,
      explanation: "Externalizing sessions to Redis makes every instance able to serve every request — scale-in stops logging users out, load skew disappears, and sub-millisecond reads satisfy the latency requirement. <strong>A</strong> makes the problem worse: longer stickiness deepens skew and still loses sessions when the pinned instance terminates. <strong>C</strong> addresses AZ-level imbalance, not per-instance session pinning — stickiness overrides balanced distribution by design. <strong>D</strong> technically shares state but NFS round trips per request are far slower than Redis, with locking and latency pathologies that make EFS the wrong tool for hot session data. (DynamoDB with TTL would also be valid, but among these options Redis is the one offered and the lowest-latency choice.)"
    },
    {
      q: "A company serves private documents from an S3 bucket through CloudFront. Objects are encrypted with SSE-KMS. Security requires that the bucket rejects all direct access, allowing reads only via the distribution. What is the recommended configuration?",
      options: [
        "Create an Origin Access Identity, grant it in the bucket ACL, and keep the KMS key policy unchanged",
        "Enable S3 Block Public Access and share presigned S3 URLs generated by the application",
        "Create an Origin Access Control, add a bucket policy allowing the CloudFront service principal conditioned on the distribution ARN, and permit CloudFront in the KMS key policy",
        "Use the S3 static website endpoint as a custom origin restricted by a Referer header condition"
      ],
      answer: [2],
      multi: false,
      explanation: "OAC is the current mechanism: CloudFront signs origin requests with SigV4 as the cloudfront.amazonaws.com service principal, the bucket policy scopes access to your specific distribution via the SourceArn condition, and — critically for this scenario — OAC supports SSE-KMS. <strong>A</strong> fails on the stated requirement because legacy OAI cannot read SSE-KMS objects, and ACL-based grants are deprecated practice. <strong>B</strong> bypasses CloudFront entirely — presigned S3 URLs expose the S3 endpoint and lose caching. <strong>D</strong> is the weakest lockdown: website endpoints support neither OAC nor OAI, Referer headers are trivially spoofed, and website endpoints do not serve SSE-KMS objects."
    },
    {
      q: "A subscription video platform streams HLS content, where each video consists of hundreds of segment files requested by the player. Only paying subscribers may access any content under the /video/ path, and the player cannot rewrite each segment URL. Which CloudFront feature fits?",
      options: [
        "Signed URLs generated for every segment file",
        "Signed cookies set after subscription verification, required by the /video/* cache behavior",
        "Field-level encryption on the /video/* path",
        "An origin request policy forwarding the subscriber's session cookie to the origin"
      ],
      answer: [1],
      multi: false,
      explanation: "Signed cookies are designed for exactly this: grant access to many files under a path pattern without modifying URLs — the player fetches hundreds of segments and the browser attaches the cookies automatically; the behavior for /video/* requires them. <strong>A</strong> collapses operationally: the manifest references segment URLs the platform would have to rewrite and re-sign continuously, which the scenario explicitly rules out. <strong>C</strong> is unrelated — field-level encryption protects specific POST form fields, not content authorization. <strong>D</strong> pushes auth to the origin on every request, but cached segments would be served from the edge without any check at all (and forwarding cookies into the cache key would wreck the hit ratio if keyed)."
    },
    {
      q: "After a release, a CloudFront distribution's cache hit ratio drops from 92% to 15% and origin load spikes. The change added a custom cache policy that includes all cookies and the User-Agent header in the cache key so the origin can do analytics and device detection. What should the architect recommend?",
      options: [
        "Raise the default TTL so objects stay cached longer",
        "Remove cookies and User-Agent from the cache policy and forward them to the origin via an origin request policy instead",
        "Enable origin shield to absorb the additional origin requests",
        "Switch the distribution to PriceClass_All so more edge locations hold copies"
      ],
      answer: [1],
      multi: false,
      explanation: "Everything in the cache key fragments the cache: keying on all cookies and User-Agent makes nearly every request a unique object, so the hit ratio collapses. The origin can still receive those values through an origin request policy, which forwards without keying — that is precisely the division of labor between the two policy types. <strong>A</strong> does not help because the problem is key cardinality, not TTL — millions of one-hit keys stay useless however long they live. <strong>C</strong> adds a mid-tier cache but the fragmented key fragments it too; it treats the symptom at extra cost. <strong>D</strong> is irrelevant — price class selects serving geography and cost, not hit ratio."
    },
    {
      q: "A distribution serves a single-page app from S3. The origin sends Cache-Control max-age of 604800 on all assets, but the team observes CloudFront refetches objects from the origin after 24 hours. The cache policy uses default TTL settings. What explains this?",
      options: [
        "The maximum TTL in the cache policy is clamping the origin's max-age header",
        "CloudFront ignores Cache-Control from S3 origins and always uses the default TTL of 86400 seconds",
        "Invalidation requests are automatically issued daily by CloudFront",
        "The regional edge cache evicts all objects every 24 hours regardless of TTL"
      ],
      answer: [0],
      multi: false,
      explanation: "CloudFront caches for the origin header value clamped between min TTL and max TTL. With defaults (min 0, default 86400, max 31536000) a 604800 max-age would be honored — but a custom or modified policy with max TTL set to 86400 clamps the week down to a day, matching the observed behavior; checking and raising max TTL is the fix. Note the giveaway: refetch at exactly 24h means a TTL boundary, and 86400 is the classic clamp value. <strong>B</strong> is false — Cache-Control is honored from any origin type; default TTL applies only when the origin sends no caching headers. <strong>C</strong> is fabricated — invalidations are only ever user-initiated. <strong>D</strong> misdescribes regional edge caches — eviction is capacity-based LRU, not a fixed daily purge, and would not produce a precise 24-hour pattern."
    },
    {
      q: "A multiplayer game uses UDP for real-time state and runs NLBs in two regions. Requirements: two static IP addresses that never change for console allowlisting, routing users to the nearest healthy region, and failover within seconds if a region degrades. Which service satisfies all requirements?",
      options: [
        "CloudFront with an origin group containing both regional NLBs",
        "Route 53 latency-based routing with health checks over both NLB DNS names",
        "AWS Global Accelerator with both NLBs as endpoints",
        "An additional NLB in a third region configured with cross-region targets"
      ],
      answer: [2],
      multi: false,
      explanation: "Every requirement is a Global Accelerator keyword: UDP (L4 support), two static anycast IPs (allowlisting), nearest-edge onboarding onto the AWS backbone, and health-check-driven regional failover in seconds without any DNS dependency. <strong>A</strong> fails immediately — CloudFront is HTTP-only (no UDP), has no static IPs, and origin group failover covers GET/HEAD. <strong>B</strong> gets close on routing but fails static IPs (NLB IPs are per-region, resolved by DNS) and failover speed — DNS failover waits on TTLs and resolver behavior, which is not 'seconds, deterministic'. <strong>D</strong> is not a real pattern: NLB cross-region target support is limited and would still provide neither global anycast IPs nor backbone routing."
    },
    {
      q: "Which TWO measures together ensure that an internet-facing ALB origin only receives traffic that came through its CloudFront distribution? (Select TWO.)",
      options: [
        "Attach an Origin Access Control to the ALB origin",
        "Have CloudFront add a secret custom header to origin requests and reject requests without it using a WAF rule on the ALB",
        "Restrict the ALB security group to the CloudFront origin-facing managed prefix list",
        "Require signed URLs on the distribution's default cache behavior",
        "Enable field-level encryption between CloudFront and the ALB"
      ],
      answer: [1, 2],
      multi: true,
      explanation: "The standard custom-origin lockdown is defense in depth: the secret header (<strong>B</strong>) proves the request traversed <em>your</em> distribution, and the managed prefix list on the security group (<strong>C</strong>) ensures only CloudFront address ranges can even connect. Each alone is insufficient — the prefix list admits any AWS customer's distribution, and the header alone still leaves the ALB reachable for probing. <strong>A</strong> is wrong because OAC applies to S3 (and Lambda function URLs / media services), not ALBs. <strong>D</strong> controls which <em>viewers</em> may request content through CloudFront — it does nothing to stop direct-to-ALB traffic. <strong>E</strong> misuses field-level encryption, which protects specific POST fields end-to-end and is not an origin access control."
    },
    {
      q: "Which TWO requirements can only be met by Lambda@Edge and not by CloudFront Functions? (Select TWO.)",
      options: [
        "Rewriting the URL path on every viewer request with sub-millisecond overhead",
        "Calling an external DynamoDB table during request processing to look up authorization data",
        "Executing logic on the origin request trigger to select a different origin per request",
        "Normalizing query strings to improve the cache hit ratio",
        "Adding a security header to every viewer response"
      ],
      answer: [1, 2],
      multi: true,
      explanation: "CloudFront Functions have no network access, so any external lookup (<strong>B</strong>) requires Lambda@Edge; and CloudFront Functions attach only to viewer request/response triggers, so origin-request logic such as dynamic origin selection (<strong>C</strong>) is Lambda@Edge-only. <strong>A</strong> is the opposite — sub-millisecond URL rewriting on every request is the signature CloudFront Functions use case; Lambda@Edge cannot hit sub-ms. <strong>D</strong> (query normalization) and <strong>E</strong> (viewer-response header injection) are lightweight viewer-trigger transforms squarely within CloudFront Functions' capabilities — and E is often better served with zero code via a response headers policy."
    },
    {
      q: "An operations team must remove a leaked confidential PDF that was cached by CloudFront under /docs/report.pdf, and also wants a long-term strategy so future content updates never require waiting on cache purges. Which TWO actions should they take? (Select TWO.)",
      options: [
        "Submit an invalidation for the /docs/report.pdf path to purge it from all edge locations",
        "Lower the distribution's minimum TTL to zero so the object expires immediately",
        "Adopt versioned object names for future deployments so updates ship as new URLs",
        "Delete and recreate the distribution to clear its caches",
        "Enable origin shield so future updates propagate instantly"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "The emergency tool is an invalidation (<strong>A</strong>) — it purges the path from every edge within minutes, and the first 1,000 paths per month are free. The strategic fix is versioned object names (<strong>C</strong>): each release is a new URL, old and new coexist, browser caches are also bypassed, and no purge is ever needed. <strong>B</strong> does not remove the already-cached copy — TTL changes affect future caching decisions, and cached objects serve until their existing TTL lapses or an invalidation removes them. <strong>D</strong> would eventually work but takes far longer than an invalidation, breaks the domain during the gap, and is operationally absurd. <strong>E</strong> misstates origin shield, which is an additional mid-tier cache for origin offload — it makes content propagation neither instant nor purge-free."
    }
  ],
  flashcards: [
    { front: "Lazy loading (cache-aside) vs write-through: staleness trade-off?", back: "Lazy loading: data can be stale up to the TTL; only requested data is cached; miss penalty on first read. Write-through: cache updated at write time so reads are fresh, but you pay write amplification and cache never-read data. Real systems combine both plus TTL." },
    { front: "What is a cache stampede and name three mitigations", back: "A hot key expires and all concurrent readers recompute it simultaneously, hammering the backend. Mitigations: request coalescing (one in-flight recompute per key), lock-and-recompute (SET NX with lock TTL), probabilistic early expiry (XFetch), TTL jitter to de-synchronize mass expiry." },
    { front: "ElastiCache Redis cluster mode disabled: shard/replica limits and endpoint model", back: "Exactly 1 shard, 0-5 read replicas, writes via the single <strong>primary endpoint</strong> (plus a reader endpoint). Vertical write scaling only." },
    { front: "ElastiCache Redis cluster mode enabled: scale limits and endpoint model", back: "Keyspace split over <strong>16,384 hash slots</strong> across shards, up to <strong>500 nodes</strong> per cluster, 0-5 replicas per shard. Cluster-aware clients connect via the <strong>configuration endpoint</strong> and learn the slot map." },
    { front: "How fast is ElastiCache Multi-AZ automatic failover, and what can be lost?", back: "Detection plus replica promotion typically completes in well under a minute. Replication is <strong>asynchronous</strong>, so the last acknowledged writes before failure can be lost — never treat ElastiCache as the system of record." },
    { front: "ElastiCache Global Datastore: lag, topology, failover model", back: "Cross-region replication for cluster-mode-enabled Redis: one writable primary region, up to 2 read-only secondary regions, typical lag under 1 second. Failover is <strong>manual</strong> promotion — a DR/read-locality feature, not active-active." },
    { front: "What does ElastiCache data tiering do and which nodes support it?", back: "On <strong>r6gd</strong> nodes, least-recently-used <em>values</em> spill to local NVMe SSD while all keys stay in RAM — roughly 5x capacity per node at much lower cost per GB, with SSD latency on cold-value hits." },
    { front: "Three exam keywords that point to Memcached over Redis", back: "\"Simplest caching model\", \"multithreaded\" (uses all cores of big nodes), \"object cache that can be repopulated after node loss\" (no persistence/replication/failover needed). Any mention of data structures, pub/sub, HA, or backup flips to Redis." },
    { front: "ElastiCache Serverless: pricing dimensions and when it fits", back: "Pay per <strong>GB-hour stored</strong> plus per <strong>ECPU</strong> (request/compute unit); no idle node cost; scales in seconds; Multi-AZ by default; supports usage caps. Fits spiky/unknown workloads and minimal-ops teams; steady high throughput is cheaper on reserved node-based clusters." },
    { front: "DAX: what are the two internal caches and their default TTL?", back: "The <strong>item cache</strong> (GetItem/BatchGetItem, keyed by primary key) and the <strong>query cache</strong> (Query/Scan, keyed by full request shape) — separate TTLs, both defaulting to 5 minutes. A write-through updates the item cache but not previously cached query results." },
    { front: "Which DynamoDB reads bypass DAX entirely?", back: "Strongly consistent reads (ConsistentRead=true) go straight to DynamoDB — no caching, no acceleration. DAX serves only eventually consistent reads from cache. Writes made around DAX (direct to the table) leave stale cache entries until TTL." },
    { front: "When does ElastiCache beat DAX for a DynamoDB-heavy app?", back: "When you need to cache <em>computed results</em> (cross-table aggregations), need Redis data structures/pub-sub/counters/sessions, or cache non-DynamoDB data. DAX wins when the pattern is repeated GetItem/Query and you want microseconds with only a client-library swap." },
    { front: "Why are ALB sticky sessions usually the wrong exam answer?", back: "State dies with the instance: scale-in and deploys log users out, long sessions skew load across targets, and failover drops sessions. The exam pattern is a <strong>stateless tier</strong>: externalize sessions to ElastiCache Redis (sub-ms) or DynamoDB with TTL (serverless, durable)." },
    { front: "DynamoDB TTL for sessions: what is the deletion guarantee?", back: "None in real time — TTL deletion is a background process that can lag up to ~48 hours. Read paths must still check the expiry timestamp. TTL deletes cost no WCUs and appear in Streams (useful for logout events)." },
    { front: "CloudFront TTL formula when the origin sends Cache-Control", back: "Cache duration = origin header value clamped between the cache policy's <strong>min TTL</strong> and <strong>max TTL</strong>. No caching headers from origin → <strong>default TTL</strong> applies. Defaults: min 0, default 86,400s, max 31,536,000s. min=max forces a fixed TTL." },
    { front: "Cache policy vs origin request policy vs response headers policy", back: "Cache policy = defines the <strong>cache key</strong> (headers/cookies/query strings) + TTLs — everything in it fragments the cache. Origin request policy = what is <em>forwarded</em> to origin beyond the key. Response headers policy = headers CloudFront <em>adds</em> to responses (CORS, security headers)." },
    { front: "CloudFront origin group failover: trigger conditions and method restriction", back: "Fails over from primary to secondary origin on configured 4xx/5xx status codes, connection failures, or timeouts — but only for <strong>GET/HEAD/OPTIONS</strong>. It is read-availability only; writes are never retried against the secondary." },
    { front: "OAC vs OAI for S3 origins", back: "OAC is the replacement: CloudFront signs origin requests with SigV4 as the cloudfront.amazonaws.com service principal, scoped by a bucket policy condition on the distribution ARN. Unlike OAI it supports <strong>SSE-KMS</strong> objects, all methods, and all regions. New designs: always OAC." },
    { front: "Signed URLs vs signed cookies: when each?", back: "Signed URL = access to a <strong>single object</strong>; the URL is the grant (downloads, emailed links). Signed cookies = access to <strong>many objects/path patterns</strong> without changing URLs (video segment streams, subscriber areas). If both present, the URL wins. Keys live in trusted key groups (legacy root-account key pairs are deprecated)." },
    { front: "CloudFront invalidation: free tier and wildcard counting", back: "First <strong>1,000 paths per month free</strong>, then about half a cent per path; a wildcard path like /images/* counts as <strong>one</strong> path; propagation takes minutes. Preferred long-term strategy: versioned object names, which need no invalidation and also bust browser caches." },
    { front: "CloudFront Functions: triggers, runtime limits, and canonical use cases", back: "Viewer request and viewer response <strong>only</strong>. Lightweight JavaScript, sub-millisecond, 2 MB memory, no network/filesystem/body access, runs at all edge locations, scales to millions of req/s. Use for header manipulation, URL rewrites/redirects, cache-key normalization, simple JWT checks." },
    { front: "Lambda@Edge: triggers, timeouts, and deployment constraints", back: "All four triggers including origin request/response. Node.js/Python; 5s timeout on viewer triggers, 30s on origin triggers. Must be authored in <strong>us-east-1</strong>, associated by version (no aliases), replicated globally; deletion requires disassociation plus replica drain. Use for network calls, origin selection, heavier compute." },
    { front: "Global Accelerator vs CloudFront: the keyword discriminators", back: "GA: <strong>2 static anycast IPs</strong>, L4 TCP/<strong>UDP</strong>, no caching, AWS backbone from nearest edge, health-check regional failover in seconds — keywords: static IP, allowlist, UDP, gaming/VoIP, deterministic failover. CloudFront: HTTP caching — keywords: cache, static+dynamic web content, reduce origin load." },
    { front: "CloudFront price classes and what they actually control", back: "PriceClass_100 (NA+EU), 200 (adds Asia/ME/Africa), All. They restrict which <strong>edge locations serve</strong> the distribution to cap cost — out-of-class viewers are still served from a farther in-class edge with higher latency. Not a geo-block (that is geo restriction)." },
    { front: "What data transfer is free with CloudFront?", back: "Origin-to-CloudFront transfer from AWS origins (S3, ALB, EC2) is <strong>free</strong>; you pay CloudFront egress to viewers per GB by geographic class plus per-request fees. This often makes fronting an ALB with CloudFront roughly cost-neutral even at low hit ratios." }
  ],
  lab: {
    title: "Lab: S3 + CloudFront with OAC — observe cache hits, misses, and invalidation",
    html: `
<h3>Goal</h3>
<p>Stand up a private S3 origin behind CloudFront using Origin Access Control, prove the
bucket is unreachable directly, watch <code>x-cache</code> flip from Miss to Hit, observe TTL
behavior via the <code>age</code> header, then purge with an invalidation. Cost: pennies
(CloudFront requests + a few KB of transfer; the first 1,000 invalidation paths per month
are free). Time: ~30 minutes, most of it waiting on distribution deployment.</p>

<h3>Architecture</h3>
<p>One private S3 bucket (Block Public Access on) holding a single HTML object; one
CloudFront distribution with an OAC-signed S3 origin and the managed CachingOptimized
cache policy; a bucket policy admitting only the CloudFront service principal scoped to
this distribution's ARN. You interact purely via curl and watch response headers.</p>

<h3>Steps</h3>
<ol>
<li><p>Create the bucket (names are global — replace the suffix everywhere below) and
upload a test object. Keep Block Public Access on (it is the default):</p>
<pre><code>aws s3api create-bucket --bucket cf-oac-lab-YOURSUFFIX --region us-east-1
echo '&lt;h1&gt;version 1&lt;/h1&gt;' &gt; index.html
aws s3 cp index.html s3://cf-oac-lab-YOURSUFFIX/index.html \
  --content-type text/html --cache-control max-age=300</code></pre>
<p>Note the Cache-Control of 300s — small enough to watch TTL behavior inside the lab.</p></li>

<li><p>Create the Origin Access Control. Record the returned Id (call it OAC_ID):</p>
<pre><code>aws cloudfront create-origin-access-control --origin-access-control-config \
  Name=cf-oac-lab,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3</code></pre></li>

<li><p>Write the distribution config. The CachePolicyId below is the managed
CachingOptimized policy. Substitute OAC_ID and your bucket name:</p>
<pre><code>cat &gt; dist-config.json &lt;&lt;'EOF'
{
  "CallerReference": "cf-oac-lab-1",
  "Comment": "OAC lab",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Origins": { "Quantity": 1, "Items": [ {
      "Id": "s3origin",
      "DomainName": "cf-oac-lab-YOURSUFFIX.s3.us-east-1.amazonaws.com",
      "OriginAccessControlId": "OAC_ID",
      "S3OriginConfig": { "OriginAccessIdentity": "" }
  } ] },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": true
  }
}
EOF
aws cloudfront create-distribution --distribution-config file://dist-config.json</code></pre>
<p>Record the distribution Id (DIST_ID), ARN, and DomainName (like d1234abcd.cloudfront.net)
from the output.</p></li>

<li><p>Grant the distribution read access with a bucket policy scoped to its ARN
(substitute your account id and DIST_ID):</p>
<pre><code>cat &gt; bucket-policy.json &lt;&lt;'EOF'
{
  "Version": "2012-10-17",
  "Statement": [ {
    "Sid": "AllowCloudFrontServicePrincipal",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::cf-oac-lab-YOURSUFFIX/*",
    "Condition": { "StringEquals": {
      "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DIST_ID"
    } }
  } ]
}
EOF
aws s3api put-bucket-policy --bucket cf-oac-lab-YOURSUFFIX --policy file://bucket-policy.json</code></pre></li>

<li><p>Wait for deployment. Distribution deploys take several minutes (commonly 5-15) —
this is normal and is exactly the propagation delay you architect around in production:</p>
<pre><code>aws cloudfront wait distribution-deployed --id DIST_ID</code></pre></li>

<li><p>Exercise the cache. First request should be a Miss, the second a Hit with a
growing <code>age</code>:</p>
<pre><code>curl -sI https://YOUR_DOMAIN.cloudfront.net/index.html | grep -i -e x-cache -e age
curl -sI https://YOUR_DOMAIN.cloudfront.net/index.html | grep -i -e x-cache -e age</code></pre>
<p>Expect <code>x-cache: Miss from cloudfront</code> then <code>x-cache: Hit from cloudfront</code>.
(If you hit different edge POPs from different vantage points, each POP misses once —
that itself is a useful lesson in how the cache is per-edge.)</p></li>

<li><p>Prove the origin is locked. Direct bucket access must fail with 403:</p>
<pre><code>curl -sI https://cf-oac-lab-YOURSUFFIX.s3.us-east-1.amazonaws.com/index.html</code></pre></li>

<li><p>Update the object and observe staleness — the edge keeps serving version 1
(Hit) until the 300s TTL lapses:</p>
<pre><code>echo '&lt;h1&gt;version 2&lt;/h1&gt;' &gt; index.html
aws s3 cp index.html s3://cf-oac-lab-YOURSUFFIX/index.html \
  --content-type text/html --cache-control max-age=300
curl -s https://YOUR_DOMAIN.cloudfront.net/index.html</code></pre></li>

<li><p>Force freshness with an invalidation instead of waiting out the TTL:</p>
<pre><code>aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/index.html"
aws cloudfront wait invalidation-completed --distribution-id DIST_ID --id INVALIDATION_ID
curl -s https://YOUR_DOMAIN.cloudfront.net/index.html</code></pre>
<p>The next request is a Miss (refetched) and returns version 2.</p></li>
</ol>

<h3>Verify</h3>
<ul>
<li>Second identical request shows <code>x-cache: Hit from cloudfront</code> and an
<code>age</code> header that increases between requests.</li>
<li>Direct S3 URL returns 403 AccessDenied; the CloudFront URL returns 200.</li>
<li>After the invalidation completes, the CloudFront URL serves version 2 and the first
request after purge is a Miss.</li>
</ul>

<h3>Teardown (ordered — a distribution must be disabled before it can be deleted)</h3>
<ol>
<li><p>Fetch the current distribution config and its ETag:</p>
<pre><code>aws cloudfront get-distribution-config --id DIST_ID &gt; current.json</code></pre>
<p>Note the ETag value in current.json (call it ETAG). Edit the file: set
<code>"Enabled": false</code> inside DistributionConfig, and strip the outer wrapper so the
file contains only the DistributionConfig object.</p></li>
<li><p>Disable the distribution and wait for the change to deploy (again several minutes):</p>
<pre><code>aws cloudfront update-distribution --id DIST_ID --if-match ETAG \
  --distribution-config file://current.json
aws cloudfront wait distribution-deployed --id DIST_ID</code></pre></li>
<li><p>Delete the distribution, passing the NEW ETag returned by the update call:</p>
<pre><code>aws cloudfront delete-distribution --id DIST_ID --if-match NEW_ETAG</code></pre></li>
<li><p>Delete the Origin Access Control (get its current ETag first):</p>
<pre><code>aws cloudfront get-origin-access-control --id OAC_ID
aws cloudfront delete-origin-access-control --id OAC_ID --if-match OAC_ETAG</code></pre></li>
<li><p>Empty and delete the bucket:</p>
<pre><code>aws s3 rm s3://cf-oac-lab-YOURSUFFIX --recursive
aws s3api delete-bucket --bucket cf-oac-lab-YOURSUFFIX</code></pre></li>
<li><p>Confirm nothing is left billing:</p>
<pre><code>aws cloudfront list-distributions --query "DistributionList.Quantity"
aws s3api head-bucket --bucket cf-oac-lab-YOURSUFFIX</code></pre>
<p>The head-bucket call should return a 404 error. Distributions themselves have no
hourly cost, but leaving one enabled invites accidental traffic charges — always finish
the disable/delete cycle.</p></li>
</ol>
`
  }
});
