/* Intuition builders — SAA data & application services modules.
 * One anchor analogy per module, extended through four levels. */
"use strict";

/* ---------------------------------------------------------------- rds-aurora */
window.COURSE.registerExplainer({
  id: "rds-aurora-intuition",
  moduleId: "rds-aurora",
  title: "Compute/storage separation: chefs upstairs, one shared cellar below",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>Picture a classic diner. Every cook has a personal fridge bolted to their station. Want a second cook to help with the rush? You have to buy a second fridge, copy every ingredient into it, and keep both fridges matching by shouting across the kitchen. If a cook quits, their fridge — and everything in it — walks out with them.</p>" +
        "<p>Now picture <strong>Aurora's restaurant</strong>. The kitchen is upstairs, but all the ingredients live in one giant cellar in the basement, run by the building itself. Any number of cooks can walk downstairs and grab what they need. Only the head chef is allowed to put new ingredients in. Hiring another cook is trivial: they put on an apron and start cooking — there is nothing to copy. If the head chef collapses mid-service, you promote any cook on the spot, because <em>the cellar never moved</em>.</p>" +
        "<p>And the cellar staff quietly keep six copies of every ingredient spread across three separate wings of the building, so a fire in one wing loses nothing.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>Map it across:</p>" +
        "<ul>" +
        "<li><strong>Cooks</strong> = database instances (compute). <strong>Head chef</strong> = the single writer. Up to 15 other cooks are <strong>Aurora Replicas</strong> (readers).</li>" +
        "<li><strong>The cellar</strong> = Aurora's shared storage layer: one logical volume spanning three Availability Zones, holding six copies of the data (two per AZ). It grows automatically as you add data, up to 128 TiB — nobody pre-provisions shelves.</li>" +
        "<li><strong>Classic RDS</strong> = the personal-fridge diner: each instance owns its EBS volumes. Multi-AZ RDS keeps a standby with a mirrored fridge (synchronous copy) that sits idle until failover; read replicas get their own fridge filled asynchronously.</li>" +
        "</ul>" +
        "<p>Because Aurora readers share the writer's cellar rather than maintaining their own copy, adding a reader is fast, replica lag is tiny, and failover just means handing the head-chef hat to an existing cook — typically under 30 seconds via the cluster endpoint. Applications talk to a <strong>writer endpoint</strong> and a <strong>reader endpoint</strong> instead of individual cooks.</p>"
    },
    {
      name: "How it actually works",
      html:
        "<p>The trick that makes the shared cellar work: <strong>the log is the database</strong>. An Aurora writer does not ship full data pages to storage. It ships only redo log records — compact descriptions of each change — to the six storage nodes. The storage nodes themselves replay those logs into data pages, continuously and in the background. Compute is relieved of checkpointing, full-page writes, and most of the I/O that dominates a traditional database.</p>" +
        "<p>Writes use a <strong>4-of-6 quorum</strong>: the writer considers a log record durable once four of the six storage nodes acknowledge it. Reads need 3 of 6, though in practice the writer knows which nodes are current and reads from one. This tolerates the loss of an entire AZ (two copies) with <em>no loss of write availability</em>, and an AZ plus one more node while still preserving read availability and self-repairing.</p>" +
        "<p>Replicas attach to the <em>same</em> storage volume, so they hold no separate copy. The writer streams log records to them purely to invalidate stale pages in their in-memory buffer caches — which is why replica lag is typically 10&ndash;20 milliseconds, not seconds. Crash recovery is near-instant because storage was never behind. The same storage layer enables <strong>fast clones</strong> (copy-on-write), <strong>Backtrack</strong> (rewind without restore), and <strong>Global Database</strong> (storage-level cross-region replication with ~1s lag).</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<p>Where it bites, and where the analogy lies:</p>" +
        "<ul>" +
        "<li>The cellar is not a passive room. Storage nodes are computers doing log replay, gossip repair, and backup to S3. You pay for I/O requests to that layer, and pathological write patterns still cost real money (Aurora I/O-Optimized exists precisely because of this).</li>" +
        "<li>Readers do not literally read the same shelves. Each replica has its own buffer cache; the shared volume is the truth, but a replica can serve a page from cache that is milliseconds stale. Aurora replicas are <em>eventually</em> consistent readers.</li>" +
        "<li>Failover is fast but not free: DNS-based endpoint flips still take tens of seconds unless you use RDS Proxy or a driver that understands the topology.</li>" +
        "<li>Exam traps: a Multi-AZ RDS <strong>standby is not readable</strong> (a reader in Aurora <em>is</em> the standby); RDS read replicas are asynchronous and can lag seconds; Aurora Serverless v2 scales <em>compute</em> up and down — the storage floor is the same shared volume either way; you cannot pick per-replica storage, because there is only one volume.</li>" +
        "</ul>" +
        "<p><strong>exam reflex:</strong> the moment a question says shared storage, 15 read replicas, sub-30-second failover, or storage that grows automatically across three AZs — the answer is Aurora.</p>"
    }
  ]
});

/* ---------------------------------------------------------------- dynamodb */
window.COURSE.registerExplainer({
  id: "dynamodb-intuition",
  moduleId: "dynamodb",
  title: "Partitions as post-office boxes: the key IS the address",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>Think of a post office with a huge wall of numbered boxes. You never ask a clerk to <em>find</em> your mail by describing it — you walk straight to box 4172, because the box number is printed on your key. No searching, no waiting behind other people's searches. Whether the wall has a hundred boxes or a hundred million, walking to <em>your</em> box takes the same three seconds.</p>" +
        "<p>That is DynamoDB's entire bargain. The name on the envelope is run through a little machine that stamps out a box number, and the mail goes exactly there. Retrieval is instant <em>because the address is computed, not looked up</em>.</p>" +
        "<p>The bargain has a flip side. If you want &quot;all letters mentioning invoices,&quot; the only way is to open every single box in the building — slow and expensive. And if the whole town addresses mail to one celebrity's box, that one slot jams while ten million other boxes sit empty. The wall is infinitely wide, but <strong>each box has a fixed-size slot</strong>.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>Mapping it on:</p>" +
        "<ul>" +
        "<li><strong>Box number machine</strong> = hash of the <strong>partition key</strong>. The key IS the address; DynamoDB routes your read or write directly to one partition.</li>" +
        "<li><strong>Folders inside a box, kept alphabetized</strong> = the <strong>sort key</strong>. All items sharing a partition key live together, ordered, so you can grab &quot;orders for customer 42 from March&quot; as one contiguous pull — that is a <code>Query</code>.</li>" +
        "<li><strong>Opening every box</strong> = a <code>Scan</code>. Legal, occasionally necessary, always the expensive last resort.</li>" +
        "<li><strong>A second wall of boxes filed by a different attribute</strong> = a <strong>Global Secondary Index</strong>. Clerks copy incoming mail over to it in the background, so it is eventually consistent — but now &quot;find by email&quot; is a direct walk instead of a building search.</li>" +
        "<li><strong>The jammed celebrity box</strong> = a <strong>hot partition</strong>: one key receiving a disproportionate share of traffic, throttled even though the table as a whole has spare capacity.</li>" +
        "</ul>" +
        "<p>Design flows backwards from this: you list your access patterns first, then choose keys so every pattern is a direct walk to a box.</p>"
    },
    {
      name: "How it actually works",
      html:
        "<p>The partition key is hashed to select a physical partition; each partition is replicated three ways across AZs and holds roughly <strong>10 GB</strong> of data with a ceiling of about <strong>3,000 RCU and 1,000 WCU</strong>. When a partition outgrows its size or heat, DynamoDB splits it and redistributes the keyspace — invisible to you, which is how the wall gets wider forever.</p>" +
        "<p>Capacity math: one RCU is a strongly consistent read of up to 4 KB per second (an eventually consistent read costs half); one WCU is a 1 KB write. Items max out at <strong>400 KB</strong>. In provisioned mode you set RCU/WCU and can autoscale; in on-demand mode you pay per request and DynamoDB absorbs spikes.</p>" +
        "<p><strong>Adaptive capacity</strong> shifts throughput toward hot partitions and can even isolate a single hot key onto its own partition — but it can never push one key past the per-partition ceiling. GSIs are essentially separate tables maintained by asynchronous replication: they have their own capacity, support only eventual consistency, and can project some or all attributes. An LSI shares the base partition (same partition key, alternate sort key), must be created at table creation, and caps the item collection at 10 GB. Strongly consistent reads exist only on the base table and LSIs.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<ul>" +
        "<li><strong>The hot key ceiling is absolute.</strong> A single partition key can never exceed ~1,000 WCU / 3,000 RCU no matter how much you provision. Fix the key design (write sharding, adding a random or calculated suffix), not the capacity dial.</li>" +
        "<li><strong>An under-provisioned GSI throttles the base table.</strong> Writes must propagate to every GSI, so a starving index back-pressures writes you thought were healthy.</li>" +
        "<li><strong>No strongly consistent reads on a GSI</strong> — if a question demands strong consistency on an alternate key, a GSI is the wrong answer; consider an LSI or redesign.</li>" +
        "<li><strong>Scan burns capacity proportional to data scanned, not returned.</strong> A filter expression does not make a Scan cheap; filtering happens after the read is paid for.</li>" +
        "<li>Where the analogy lies: boxes are not fixed. The postmaster is constantly splitting, moving, and triple-replicating them across the town, and &quot;one box&quot; is really a replicated set of storage nodes. Also, DynamoDB gives single-digit <em>milliseconds</em>; if a question says <em>microseconds</em>, the answer is fronting it with DAX, not tuning the table.</li>" +
        "</ul>" +
        "<p><strong>exam reflex:</strong> key-value access at any scale with single-digit-millisecond latency means DynamoDB; uneven or throttled traffic means fix the partition key, and query-by-another-attribute means add a GSI.</p>"
    }
  ]
});

/* ---------------------------------------------------------------- caching */
window.COURSE.registerExplainer({
  id: "caching-intuition",
  moduleId: "caching",
  title: "Caching is remembered answers; staleness is the rent",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>An office receptionist sits at the front desk. The first time someone asks &quot;what time does the building close?&quot;, she walks down to the records room in the basement, finds the answer, and — crucially — writes it on a sticky note before returning. The next five hundred people who ask get an instant answer from the note. The basement never sees them.</p>" +
        "<p>That sticky note is a cache. It makes the common question absurdly fast and keeps the crowd away from the fragile records room.</p>" +
        "<p>The price: the day facilities changes the closing time, her note becomes a <em>confident lie</em>. She will keep repeating the wrong answer, cheerfully, until the note expires or someone walks up and tears it off. Every caching decision in every system is a version of the same three questions: <strong>how wrong is the note allowed to be, for how long, and whose job is it to tear it off?</strong> Answer those and the design falls out. Ignore them and the note lies to customers at the worst possible moment.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>The cast, in AWS terms:</p>" +
        "<ul>" +
        "<li><strong>Records room</strong> = your database or origin server. <strong>Sticky notes</strong> = ElastiCache (Redis or Memcached), DAX, or CloudFront's edge caches.</li>" +
        "<li><strong>Cache-aside (lazy loading)</strong> = the receptionist checks her notes first; on a miss she walks downstairs, gets the answer, and writes a note on the way back. Only questions people actually ask get notes.</li>" +
        "<li><strong>Write-through</strong> = whenever the records change, the note is updated in the same motion. Notes are never stale, but you write notes nobody may ever read.</li>" +
        "<li><strong>TTL</strong> = notes written in disappearing ink. Staleness is bounded by the fade time; no one has to remember to tear anything off.</li>" +
        "<li><strong>CloudFront</strong> = a receptionist stationed in every city's lobby, so answers do not require a trip to headquarters at all.</li>" +
        "<li><strong>DAX</strong> = a notepad glued directly to DynamoDB's front door: same API, write-through, microsecond answers.</li>" +
        "</ul>" +
        "<p>Most real systems combine cache-aside with a TTL: fast for hot data, bounded staleness, and self-healing when notes are lost.</p>"
    },
    {
      name: "How it actually works",
      html:
        "<p><strong>Cache-aside mechanics:</strong> app reads cache; on miss it reads the database, then populates the cache. Cost of a miss is three trips (cache, DB, cache write). Only requested data is cached, and a cache node dying is survivable — the notes get rewritten on demand. The catch: data changed in the DB stays stale until TTL expiry or explicit invalidation.</p>" +
        "<p><strong>Write-through mechanics:</strong> every write goes to cache and DB together. Reads are always fresh, but writes pay double latency, the cache fills with never-read data, and a new/empty cache node knows nothing until writes repopulate it — so write-through is usually paired with lazy loading rather than replacing it.</p>" +
        "<p><strong>Engine choice:</strong> Redis is single-threaded per shard but feature-rich — replication, automatic failover, persistence, cluster-mode sharding, sorted sets (leaderboards), pub/sub, geospatial. Memcached is multithreaded and dead simple — no replication, no persistence, scale by adding nodes; losing a node just loses those notes.</p>" +
        "<p><strong>Eviction and expiry:</strong> when memory fills, LRU-family policies discard the coldest notes. Add <em>jitter</em> to TTLs so a thousand notes written together do not all expire in the same second and stampede the records room. <strong>DAX</strong> keeps two caches — an item cache for GetItem and a query cache for Query/Scan — both write-through with configurable TTLs.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<ul>" +
        "<li><strong>Invalidation is the famously hard part.</strong> TTL bounds staleness but does not eliminate it; explicit invalidation is exact but must fire on every write path, forever. Miss one path and you serve confident lies.</li>" +
        "<li><strong>Cache stampede:</strong> a popular note expires and ten thousand simultaneous misses hit the database at once. Mitigate with TTL jitter, request coalescing, or serving stale while one worker refreshes.</li>" +
        "<li><strong>Hot keys shard-jam Redis:</strong> cluster mode spreads keys across shards, but one viral key lives on one shard — same celebrity-mailbox problem as DynamoDB.</li>" +
        "<li><strong>Losing a Memcached node</strong> means a cold cache and a thundering herd on the backend, because nothing was replicated. If cache loss would hurt, that alone points to Redis.</li>" +
        "<li><strong>CloudFront invalidations</strong> are slow and metered — the pro move is versioned object names so old notes are simply never asked for again.</li>" +
        "<li>Where the analogy lies: there is no single receptionist. Real caches are fleets of them with independent notepads that can disagree with each other, which is why &quot;read-your-own-write&quot; through a cache is never guaranteed.</li>" +
        "</ul>" +
        "<p><strong>exam reflex:</strong> microsecond DynamoDB reads mean DAX; leaderboards, persistence, or HA mean Redis; simplest multithreaded object cache means Memcached.</p>"
    }
  ]
});

/* ---------------------------------------------------------------- route53 */
window.COURSE.registerExplainer({
  id: "route53-intuition",
  moduleId: "route53",
  title: "DNS as the phone book that lies on purpose",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>Imagine a town's telephone directory desk. You ask the operator for &quot;Rossi's Pizza&quot; and she reads you a number. An honest phone book gives everyone the same number every time.</p>" +
        "<p>Route 53 employs an operator who is <strong>paid to lie helpfully</strong>. Ask for Rossi's and she might give you the branch nearest to <em>you</em>, so your delivery arrives hot. She might send one caller in ten to the brand-new branch, to see if it can handle the pace. She rings every branch herself every half minute, and if a branch's phone is dead she simply stops handing out that number — callers never know it existed. Callers from another country get their local branch, because that is the one legally allowed to serve them.</p>" +
        "<p>One complication: callers scribble the number on their hand and reuse it for a while instead of asking again. So when the operator changes her answer, the old number keeps getting dialed until the ink wears off. The lie is powerful, but it <em>propagates</em> — it does not switch.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>The pieces:</p>" +
        "<ul>" +
        "<li><strong>The book</strong> = a hosted zone; <strong>entries</strong> = record sets (A, AAAA, CNAME, alias...).</li>" +
        "<li><strong>The operator's lying strategies</strong> = routing policies: <em>simple</em> (honest book), <em>weighted</em> (send 10% to the new branch — canaries and gradual migrations), <em>latency</em> (nearest-by-network branch), <em>failover</em> (primary branch unless its phone is dead, then the backup), <em>geolocation</em> (answer based on where the caller is — compliance, localized content), <em>geoproximity</em> (like geolocation but with a bias dial to shift the boundary), <em>multivalue</em> (read out several healthy numbers, caller picks one).</li>" +
        "<li><strong>Ringing the branches</strong> = health checks: probes from multiple locations, marking endpoints healthy or unhealthy so records tied to them are given out or withheld.</li>" +
        "<li><strong>Ink on the hand</strong> = TTL: how long every resolver and client may reuse an answer before asking again.</li>" +
        "<li><strong>Alias records</strong> = an entry reading &quot;same number as the mall's front desk&quot;: point at an ALB, CloudFront, or S3 website endpoint, free of charge, and — unlike CNAME — legal at the zone apex (example.com itself).</li>" +
        "</ul>"
    },
    {
      name: "How it actually works",
      html:
        "<p>Resolution walks a chain: your resolver asks a root server, which points to the TLD servers, which point to Route 53's authoritative name servers for the zone. Route 53 answers from a globally distributed, anycast fleet — the &quot;operator&quot; is thousands of desks giving coordinated answers, which is how it backs a 100% availability SLA.</p>" +
        "<p><strong>Health checks</strong> run from multiple AWS checkers worldwide; an endpoint is unhealthy when the failing fraction crosses a threshold. Checks can probe an endpoint, watch a CloudWatch alarm (for private or internal signals), or be <em>calculated</em> — boolean combinations of other checks. Failover records pair a primary and secondary; weighted and multivalue records simply withhold unhealthy members from answers.</p>" +
        "<p><strong>Latency routing</strong> uses AWS's measured network latency between resolver locations and regions — network reality, not map distance. <strong>Geolocation</strong> maps the caller's IP to a country or continent and should always include a default record for unmapped callers. <strong>Geoproximity</strong> adds a bias value that grows or shrinks a region's catchment area.</p>" +
        "<p><strong>Alias records</strong> are resolved server-side: Route 53 chases the target itself and returns final IPs, with TTLs managed by AWS. They cost nothing per query and can target most AWS entry points plus other records in the same zone.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<ul>" +
        "<li><strong>DNS failover is not instant.</strong> Every resolver and OS between you and the user caches answers for the TTL — and some misbehaving resolvers hold answers longer. Low TTLs help but multiply query volume. If a question needs seconds-fast, connection-level failover, the answer is a load balancer or Global Accelerator, not DNS.</li>" +
        "<li><strong>DNS cannot drain a connection.</strong> Changing the answer does nothing for clients already connected to the dead branch; long-lived connections stay put.</li>" +
        "<li><strong>Health checks see from outside.</strong> A checker confirms the phone rings — not that the kitchen behind it works. Wire deep signals in via CloudWatch-alarm or calculated checks.</li>" +
        "<li><strong>CNAME at the zone apex is illegal</strong>; the alias record exists for exactly this. Free alias queries versus billed CNAME chains is a favorite exam discriminator.</li>" +
        "<li><strong>Multivalue answer is not a load balancer</strong> — it is DNS-level shuffling of up to eight healthy records with zero traffic awareness.</li>" +
        "<li>Where the analogy lies: there is no single operator and no single moment of truth — thousands of cached copies of the book expire at different times, so every change is a <em>rolling</em> lie, not a switch.</li>" +
        "</ul>" +
        "<p><strong>exam reflex:</strong> route by user location means geolocation; lowest latency means latency policy; gradual migration means weighted; active-passive DR means failover plus health check; apex domain to an AWS resource means alias.</p>"
    }
  ]
});

/* ---------------------------------------------------------------- serverless */
window.COURSE.registerExplainer({
  id: "serverless-intuition",
  moduleId: "serverless",
  title: "Lambda: hiring a worker per envelope, not per shift",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>A traditional mailroom hires clerks by the shift. Eight hours of pay whether mail arrives or not: the night shift plays cards, the holiday rush buries everyone, and the manager's whole life is guessing headcount.</p>" +
        "<p>The Lambda mailroom has no staff at all. It has a staffing agency with one strange rule: <strong>one worker per envelope</strong>. The instant an envelope lands on the desk, a worker materializes, handles that single envelope, and leaves. A thousand envelopes arrive in the same second? A thousand workers appear, shoulder to shoulder. Zero envelopes all night? Zero payroll, to the penny.</p>" +
        "<p>Two catches. A worker summoned from scratch spends a moment finding the desk and putting on gloves before touching the envelope — the first envelope in a while is always slower. But a worker who just finished an envelope lingers by the desk, gloves on; hand them the next one and they start instantly. And no worker may spend more than <strong>fifteen minutes</strong> on a single envelope — this agency does not do all-day jobs.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>Translated:</p>" +
        "<ul>" +
        "<li><strong>Envelope</strong> = an event: an API Gateway request, an S3 object landing, an SQS message, a schedule tick.</li>" +
        "<li><strong>Worker</strong> = an execution environment running your function code. <strong>The agency</strong> = the Lambda service, which owns hiring, scaling, and cleanup.</li>" +
        "<li><strong>Finding the desk and gloving up</strong> = a <em>cold start</em>: provisioning the sandbox, loading your code, initializing the runtime. <strong>The lingering worker</strong> = a <em>warm</em> environment reused for the next invocation.</li>" +
        "<li><strong>Workers in the room at once</strong> = concurrency. <strong>Provisioned concurrency</strong> = paying to keep N workers standing at the desk pre-gloved, so latency-sensitive envelopes never wait. <strong>Reserved concurrency</strong> = a headcount cap for one job so it can neither starve others nor stampede a downstream database.</li>" +
        "<li><strong>Worker strength</strong> = the memory setting, which also scales CPU and network proportionally — the main performance dial you get.</li>" +
        "</ul>" +
        "<p>Billing follows the metaphor exactly: you pay per envelope handled and per worker-second of effort (GB-seconds), never for idle shifts.</p>"
    },
    {
      name: "How it actually works",
      html:
        "<p>Each execution environment is a <strong>Firecracker microVM</strong> — a stripped-down virtual machine giving VM-grade isolation at container-like startup speed. An invocation has two phases: <em>init</em> (fetch code, start the runtime, run everything outside your handler — connection setup, SDK clients, config loads) and <em>invoke</em> (run the handler). Init runs once per environment; subsequent invocations on a warm environment skip it. Hence the core optimization: do expensive setup in global scope so reuse amortizes it, and keep packages small so init stays quick.</p>" +
        "<p>Environments are reused but never shared concurrently — one envelope per worker at a time. Reuse means global variables, open connections, and files in <code>/tmp</code> (up to 10 GB) survive between invocations on the same environment.</p>" +
        "<p>Scaling: each function can add on the order of 1,000 new environments every 10 seconds, within an account-level concurrency pool (default 1,000, raisable). Invocation modes matter: <em>synchronous</em> (API Gateway — caller waits, errors return to caller), <em>asynchronous</em> (S3, SNS — Lambda queues the event, retries twice, then dead-letters), and <em>poll-based</em> (SQS, Kinesis, DynamoDB Streams — an event source mapping polls and hands batches to your function).</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<ul>" +
        "<li><strong>The 15-minute ceiling is absolute.</strong> Longer work means Step Functions orchestrating chunks, or a container on Fargate. Any exam scenario over 15 minutes disqualifies Lambda outright.</li>" +
        "<li><strong>Cold starts hurt unevenly:</strong> heavy runtimes (Java, .NET) and large packages pay the most; provisioned concurrency or SnapStart is the fix when p99 latency matters.</li>" +
        "<li><strong>Environment reuse is a double-edged sword.</strong> The analogy lies here: workers are <em>not</em> fresh per envelope. Leftover globals, temp files, and stale connections leak between invocations — a performance trick and a bug factory. Write handlers to tolerate reuse.</li>" +
        "<li><strong>Connection storms:</strong> a thousand workers each opening a database connection will flatten RDS. The canonical fix is <strong>RDS Proxy</strong> pooling connections in front of the database.</li>" +
        "<li><strong>Throttling:</strong> exceeding concurrency returns 429s (sync) or triggers retries (async). One runaway function can consume the whole account pool — reserved concurrency is the fence.</li>" +
        "<li><strong>Hard limits to memorize:</strong> 10 GB memory max, 10 GB container images, 250 MB unzipped deployment, 6 MB synchronous payload.</li>" +
        "</ul>" +
        "<p><strong>exam reflex:</strong> spiky or unpredictable traffic, pay-only-when-running, under 15 minutes means Lambda; longer-running or steady heavy workloads mean Fargate or ECS.</p>"
    }
  ]
});

/* ---------------------------------------------------------------- messaging */
window.COURSE.registerExplainer({
  id: "messaging-intuition",
  moduleId: "messaging",
  title: "Queues vs topics vs streams: mailbox, megaphone, ledger",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>A town hall needs to move information around, and it owns three very different pieces of furniture.</p>" +
        "<p><strong>The mailbox.</strong> Drop a letter in; exactly one clerk will eventually take it out and deal with it, at whatever pace the clerks can manage. Once handled, the letter is gone. If a clerk faints mid-task, the letter quietly reappears in the box for another clerk. Nobody else ever sees it. Perfect for work that must get done once, by someone, eventually.</p>" +
        "<p><strong>The megaphone.</strong> Step onto the balcony and announce once; everyone subscribed below hears it at the same moment, and each reacts in their own way. But sound is not stored — if you were not listening, you missed it forever.</p>" +
        "<p><strong>The ledger.</strong> A scribe writes every event into an append-only book at the courthouse, in order, page after page. Any number of readers work through the book at their own pace, each keeping a personal bookmark. The pages stay for days, so a new reader can start from last Tuesday and catch up — or reread history after a mistake.</p>"
    },
    {
      name: "The simple model",
      html:
        "<ul>" +
        "<li><strong>Mailbox = SQS.</strong> A queue that decouples producer from consumer and absorbs bursts. The <em>visibility timeout</em> hides a letter while a clerk holds it; if the clerk fails to delete it in time, it reappears. Letters nobody can handle after N attempts fall into a <em>dead-letter queue</em> for inspection. FIFO queues add strict ordering and exactly-once processing for a throughput price.</li>" +
        "<li><strong>Megaphone = SNS.</strong> A topic fans one message out to many subscribers simultaneously — Lambda functions, email, HTTP endpoints, and crucially, SQS queues. The canonical pattern is megaphone-into-mailboxes: <strong>SNS fanning out to multiple SQS queues</strong>, so every department gets its own durable, independently-paced copy of each announcement.</li>" +
        "<li><strong>Ledger = Kinesis Data Streams.</strong> Volumes of the book are <em>shards</em>; each record lands on a shard chosen by its partition key and stays in order there. Consumers keep <em>checkpoints</em> (bookmarks) and can replay anything within the retention window — 24 hours by default, extendable to a year.</li>" +
        "</ul>" +
        "<p>The decision is really about what happens to a message after delivery: consumed once (mailbox), broadcast now (megaphone), or retained for replay by many (ledger).</p>"
    },
    {
      name: "How it actually works",
      html:
        "<p><strong>SQS</strong> is pull-based: consumers poll (use long polling to cut empty responses and cost). Standard queues offer at-least-once delivery and best-effort ordering with effectively unlimited throughput — duplicates and reordering are possible by design, so consumers must be idempotent. FIFO queues guarantee order <em>within a message group ID</em> (parallel ordered lanes) and deduplicate within a 5-minute window, at bounded throughput (300 TPS, 3,000 with batching). Messages persist up to 14 days; maximum size 256 KB.</p>" +
        "<p><strong>SNS</strong> pushes, with per-subscriber retry policies and DLQs, and <em>filter policies</em> so each subscriber receives only matching messages — one topic, many selective audiences.</p>" +
        "<p><strong>Kinesis</strong> capacity is per shard: 1 MB/s or 1,000 records/s in, 2 MB/s out shared by all consumers — or 2 MB/s <em>per consumer</em> with enhanced fan-out. The partition key hashes to a shard, and ordering exists only within a shard, so key choice is load-balancing (same celebrity-mailbox hot-shard risk as DynamoDB). The KCL coordinates consumer fleets and stores checkpoints in DynamoDB. On-demand mode manages shard counts for you.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<ul>" +
        "<li><strong>Wrong furniture, classic failures:</strong> need replay or multiple independent readers? SQS is wrong — a consumed message is deleted. Need buffering and backpressure? SNS is wrong — it stores nothing; a slow subscriber just loses. Both at once means SNS-to-SQS fan-out or Kinesis.</li>" +
        "<li><strong>Visibility timeout shorter than processing time</strong> silently produces duplicates: the letter reappears while the first clerk still holds it. Set the timeout comfortably above worst-case processing, and always make handlers idempotent — standard SQS can duplicate anyway.</li>" +
        "<li><strong>FIFO nuance:</strong> ordering is per message group, and one poison message blocks its whole group behind it — DLQ policy matters doubly.</li>" +
        "<li><strong>Kinesis hot shards</strong> come from low-cardinality partition keys; total read throughput is capped per shard, not per stream.</li>" +
        "<li>Where the analogy lies: the megaphone actually retries per listener (SNS has delivery policies and DLQs), and mailbox letters can arrive twice — the furniture is leakier than the metaphor. Also SQS does not push; clerks must keep checking the box (polling).</li>" +
        "</ul>" +
        "<p><strong>exam reflex:</strong> decouple and buffer means SQS; fan one event out to many means SNS (usually into SQS queues); real-time ordered stream with replay and multiple consumers means Kinesis.</p>"
    }
  ]
});

/* ---------------------------------------------------------------- containers */
window.COURSE.registerExplainer({
  id: "containers-intuition",
  moduleId: "containers",
  title: "The scheduler as a restaurant host seating tasks",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>Picture the host at a busy restaurant's front desk. Parties keep arriving, each with a reservation slip: party of two, party of six, one needs a high chair, one refuses to sit near the kitchen. The dining room holds tables of various sizes, some half-occupied.</p>" +
        "<p>The host's craft is <strong>seating</strong>: find a table with enough free seats and elbow room, honor the special requests, and pack the room efficiently so you are not lighting and cleaning a half-empty second floor. When a party storms out mid-meal, the host notices and seats a fresh party so the room stays as full as the manager promised. The host never cooks and never waits tables — <em>placement is the whole job</em>.</p>" +
        "<p>Down the street is a stranger establishment: no dining room at all. When your party arrives, a table of <em>exactly</em> the right size materializes from nowhere, and vanishes when you leave. You never buy, clean, or repair furniture — you simply pay per seat, per hour, at a premium. That establishment is called <strong>Fargate</strong>.</p>"
    },
    {
      name: "The simple model",
      html:
        "<ul>" +
        "<li><strong>Parties</strong> = tasks (ECS) or pods (EKS) — running copies of your container. <strong>Reservation slip</strong> = the task definition: image, CPU and memory required, environment variables, IAM role, ports.</li>" +
        "<li><strong>Tables</strong> = the EC2 instances in your cluster. <strong>The host</strong> = the scheduler, matching each task's requirements against each instance's free capacity.</li>" +
        "<li><strong>Keeping the room full</strong> = an ECS <em>service</em>: declare a desired count of tasks and the scheduler replaces any that die and spreads them per your strategy.</li>" +
        "<li><strong>Seating strategy</strong> = placement: <em>binpack</em> (fill tables completely to close floors and save money), <em>spread</em> (across AZs and instances so one disaster takes few parties), plus constraints (only certain tables, one party of this type per table).</li>" +
        "<li><strong>Ordering more tables</strong> = capacity providers driving an Auto Scaling group when the room is full.</li>" +
        "<li><strong>Fargate</strong> = the table-per-party restaurant: serverless containers, sized exactly to the task, no instances to patch — at a higher unit price.</li>" +
        "</ul>"
    },
    {
      name: "How it actually works",
      html:
        "<p>Task definitions are versioned as revisions; a service pins a revision and its deployment settings (rolling updates with minimum/maximum healthy percentages, or blue/green via CodeDeploy). The scheduler runs a filter-then-choose loop: eliminate instances lacking CPU, memory, ports, or matching constraints; then apply the placement strategy to pick among survivors — precisely the host scanning for viable tables, then choosing per house policy. EKS works the same way with kube-scheduler's filtering and scoring, plus a critical extra concept: pods declare <em>requests</em> (used for scheduling) and <em>limits</em> (enforced at runtime) — book for four, allowed to sprawl to six until the table pushes back.</p>" +
        "<p>Networking: <strong>awsvpc mode</strong> gives every task its own ENI and private IP — every party gets its own street address, so security groups apply per task. An ALB integrates via dynamic port mapping and target groups, health-checking tasks and routing to them wherever they were seated.</p>" +
        "<p>Identity: the <strong>task role</strong> grants each task its own least-privilege IAM permissions, distinct from the instance role the table itself uses. <strong>Fargate</strong> runs each task in its own isolated micro-VM — there is genuinely no shared table underneath, which is why daemon-style and privileged workloads do not fit there.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<ul>" +
        "<li><strong>Fargate economics:</strong> per-vCPU-hour it costs more than well-binpacked EC2. Steady heavy fleets are often cheaper self-hosted; spiky, ops-light workloads favor Fargate. Fargate also rules out GPUs, privileged containers, and daemonsets.</li>" +
        "<li><strong>ENI density:</strong> in awsvpc mode each task consumes an ENI, and instances have ENI limits — you can run out of street addresses before you run out of CPU, capping task density per instance.</li>" +
        "<li><strong>Binpack vs spread is a real tension:</strong> binpack minimizes cost and maximizes blast radius; spread does the reverse. Exam answers about resilience want spread across AZs.</li>" +
        "<li><strong>The scheduler cannot fix bad sizing.</strong> Overstated requests strand capacity (half-empty tables you still pay for); understated limits invite OOM kills mid-meal.</li>" +
        "<li>Where the analogy lies: a real host reshuffles seated guests; ECS will not — placement happens at launch, and a fleet drifts unbalanced until tasks churn. And there is no single host: the control plane is a distributed system seating many parties concurrently.</li>" +
        "</ul>" +
        "<p><strong>exam reflex:</strong> containers with no server management means Fargate; cheapest at steady scale or needing GPUs and host control means ECS on EC2; Kubernetes portability means EKS; per-task permissions means task role.</p>"
    }
  ]
});

/* ---------------------------------------------------------------- analytics */
window.COURSE.registerExplainer({
  id: "analytics-intuition",
  moduleId: "analytics",
  title: "The data lake: a library with a card catalog, billed per page read",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>A company dumps every document it has ever produced into one colossal warehouse-library: boxes of reports, receipts, logs — no filing required, shelving is nearly free, nothing is ever thrown away. That is the data lake. And on its own it is useless: a billion pages nobody can find.</p>" +
        "<p>Two hires change everything. A <strong>librarian</strong> walks the aisles, peeks into boxes, and builds a card catalog — not copying any documents, just recording what exists, what its columns look like, and which shelf it sits on. And a <strong>researcher</strong> who will answer any question about the collection, without you building her a private reading room, with one billing rule: <strong>she charges by the page she has to read</strong>, not by the question.</p>" +
        "<p>Suddenly the whole game is filing strategy. Shelve documents by year and month, and &quot;March 2024&quot; means one aisle, not the whole building. Bind reports so each column of numbers is its own thin volume, and &quot;just the totals&quot; means one slim binder instead of every full report. Same questions, a fiftieth of the pages, a fiftieth of the bill.</p>"
    },
    {
      name: "The simple model",
      html:
        "<ul>" +
        "<li><strong>Warehouse shelves</strong> = S3. <strong>Card catalog</strong> = the Glue Data Catalog: databases and tables describing schemas and locations, without holding any data itself.</li>" +
        "<li><strong>The librarian</strong> = a Glue crawler: scans S3 prefixes, infers schemas, writes catalog entries, notices new aisles on a schedule.</li>" +
        "<li><strong>The researcher</strong> = Athena: serverless SQL directly against S3, priced per terabyte scanned. No clusters, no capacity planning — you pay only when you ask.</li>" +
        "<li><strong>Shelving by aisle</strong> = partitioning: key prefixes like year=2024/month=03 let a WHERE clause skip entire aisles unread.</li>" +
        "<li><strong>Column-binders</strong> = columnar formats (Parquet, ORC), plus compression. <strong>Re-filing clerks</strong> = Glue ETL jobs converting raw CSV/JSON into partitioned Parquet.</li>" +
        "<li><strong>The private reading room</strong> = Redshift: a provisioned warehouse for teams querying constantly, all day. <strong>Redshift Spectrum</strong> lets that room's staff also fetch from the lake's shelves. <strong>QuickSight</strong> draws the charts; <strong>Lake Formation</strong> decides who may read which shelf.</li>" +
        "</ul>"
    },
    {
      name: "How it actually works",
      html:
        "<p>Athena runs a distributed Presto/Trino engine on capacity you never see. A query goes: consult the Glue catalog for the table's schema and location; prune partitions using the WHERE clause so only matching S3 prefixes are touched; then, for Parquet or ORC, read each file's footer — which indexes column chunks and stores min/max statistics — and fetch <em>only the byte ranges of the columns requested</em>, skipping chunks whose statistics cannot match the predicate. This is why format changes cut costs 90%+: a 1 TB CSV scan can become a 30 GB scan as compressed, pruned, columnar reads. Conversion is a Glue job or a one-line Athena CTAS statement.</p>" +
        "<p>This is <strong>schema-on-read</strong>: the catalog's schema is applied at query time; the lake accepts anything, and disagreements surface as query errors, not ingest failures — the opposite of a warehouse's schema-on-write.</p>" +
        "<p>Operationally: crawlers use classifiers to infer formats and register partitions; for high-cardinality date-based layouts, <strong>partition projection</strong> computes partition locations from a rule instead of storing millions of catalog entries. Kinesis Data Firehose commonly lands streaming data into the lake already batched, compressed, converted to Parquet, and dynamically partitioned.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<ul>" +
        "<li><strong>Millions of tiny files strangle the researcher:</strong> each file is a separate S3 fetch with overhead. Compact small objects into fewer, larger files (128 MB+ is the usual guidance) — Firehose buffering and Glue compaction exist for this.</li>" +
        "<li><strong>SELECT star scans everything</strong> — columnar savings apply only to the columns you name. And LIMIT does not proportionally cut the bill; savings come from partitions and predicates, not from asking politely for fewer rows.</li>" +
        "<li><strong>Over-partitioning backfires:</strong> a partition per minute yields millions of catalog entries and query planning that takes longer than the query. Partition to match query patterns; use partition projection at high cardinality.</li>" +
        "<li><strong>Schema-on-read defers pain:</strong> garbage lands silently and detonates at query time. The librarian catalogs what is there; she does not validate it.</li>" +
        "<li><strong>Athena is not a BI warehouse.</strong> Constant dashboards, heavy joins, and strict SLAs belong in Redshift; Athena shines for ad-hoc, intermittent questions. EMR is the answer when you need to control the Spark cluster itself.</li>" +
        "<li>Where the analogy lies: the researcher is secretly thousands of parallel readers — latency is not proportional to pages read; only the <em>bill</em> is.</li>" +
        "</ul>" +
        "<p><strong>exam reflex:</strong> serverless ad-hoc SQL on S3 means Athena; catalog and ETL mean Glue; reduce Athena cost means partition, convert to Parquet, and compress.</p>"
    }
  ]
});

/* ---------------------------------------------------------------- migration */
window.COURSE.registerExplainer({
  id: "migration-intuition",
  moduleId: "migration",
  title: "Moving house: seven choices per item, and truck versus pipe",
  levels: [
    {
      name: "The analogy",
      html:
        "<p>You are moving house across the country, and every single possession forces one of seven decisions. Put it in the truck exactly as it is (<em>rehost</em>). Swap its plug so it works with the new country's outlets, but keep the appliance (<em>replatform</em>). Rebuild it from scratch for the new home, because the old design never really fit (<em>refactor</em>). Throw it out and subscribe to a furniture service instead of owning at all (<em>repurchase</em>). Admit you have not used it in years and junk it (<em>retire</em>). Leave it in the old house for now, because moving it today is not worth it (<em>retain</em>). Or move your entire storage unit, intact and unopened, to a facility near the new house (<em>relocate</em>).</p>" +
        "<p>Then comes pure logistics: <strong>truck or pipe?</strong> For one box, driving a truck across the country is absurd — send it through the mail. For a warehouse of belongings, even the fastest pipe would pump for months; the truck with a padlock wins. The crossover point is just arithmetic.</p>"
    },
    {
      name: "The simple model",
      html:
        "<p>The seven Rs with their AWS instruments:</p>" +
        "<ul>" +
        "<li><strong>Rehost</strong> (lift-and-shift) = AWS Application Migration Service (MGN) replicating servers block-by-block into EC2. Fastest exit from the data center; carries old problems along.</li>" +
        "<li><strong>Replatform</strong> (lift-tinker-and-shift) = same app, managed foundations: self-run MySQL becomes RDS.</li>" +
        "<li><strong>Refactor</strong> = rearchitect for cloud (serverless, microservices). Highest payoff, highest effort.</li>" +
        "<li><strong>Repurchase</strong> = move to SaaS. <strong>Retire</strong> = decommission. <strong>Retain</strong> = leave on-prem for now. <strong>Relocate</strong> = VMware environments moved wholesale.</li>" +
        "</ul>" +
        "<p>The specialist movers: <strong>DMS</strong> keeps your filing cabinet usable during the move — it copies the database, then streams every new change (CDC) until cutover, so downtime shrinks to minutes. <strong>SCT</strong> converts the cabinet's drawer layout when the engines differ (Oracle to Aurora). <strong>DataSync</strong> is a smart pump for file shares into S3, EFS, or FSx. And the trucks: <strong>Snowball Edge</strong>, a rugged ~80 TB appliance AWS ships to you, you fill, and ship back for import into S3.</p>"
    },
    {
      name: "How it actually works",
      html:
        "<p><strong>Truck-versus-pipe is arithmetic first.</strong> Transfer time equals data over effective bandwidth: 100 TB over a 1 Gbps line is about 10 days at perfect utilization — and real links share traffic, so plan on a fraction of line rate. The working rule: if the pipe would take more than a week or two, or bandwidth is precious, order trucks. Snowball's own round trip (ship, fill, return, ingest) costs one to two weeks regardless of size — which is exactly why it loses for small loads and wins overwhelmingly for large ones. Multiple devices run in parallel; for ongoing hybrid transfer instead, Direct Connect plus DataSync is the pipe done properly.</p>" +
        "<p><strong>DMS mechanics:</strong> a replication instance performs a full load of existing data, then switches to change data capture — reading the source's transaction log and applying every insert, update, and delete to the target continuously. The source stays live the entire time; cutover is a DNS or connection-string flip once lag reaches zero. Homogeneous moves (MySQL to RDS MySQL) need only DMS; heterogeneous moves (Oracle to Aurora PostgreSQL) need SCT first to translate schema, types, and as much procedural code as it can, flagging the remainder for humans.</p>" +
        "<p><strong>MGN</strong> does continuous block-level replication of whole servers, letting you launch test instances before the real cutover.</p>"
    },
    {
      name: "The sharp edges",
      html:
        "<ul>" +
        "<li><strong>DMS moves data, not databases.</strong> Stored procedures, triggers, secondary indexes, and users are not fully carried; SCT and manual work cover the gap. Exam-wise: heterogeneous migration always pairs <em>SCT + DMS</em>.</li>" +
        "<li><strong>Snowball is a batch truck, not a sync tool.</strong> Its 1&ndash;2 week loop disqualifies it for continuous replication or tight-RPO needs; it answers &quot;huge one-time transfer, limited bandwidth&quot; questions only.</li>" +
        "<li><strong>Bandwidth math traps:</strong> answers that look feasible at theoretical line rate fail at realistic utilization; when a question gives you a deadline, do the division before trusting the network option.</li>" +
        "<li><strong>Rehost moves your mess.</strong> Fastest option, zero modernization — right when the data-center lease expires, wrong as a permanent strategy. Refactor is the opposite trade.</li>" +
        "<li>Where the analogy lies twice: furniture sits still, but data <em>changes during the move</em> — that is the entire reason CDC exists. And you never actually empty the old house: you <em>copy</em>, run both in parallel, and cut over — the old house keeps serving until the day you stop paying for it.</li>" +
        "</ul>" +
        "<p><strong>exam reflex:</strong> petabytes plus weak network plus one-time transfer means the Snowball family; live database with near-zero downtime means DMS with CDC (plus SCT if the engine changes).</p>"
    }
  ]
});
