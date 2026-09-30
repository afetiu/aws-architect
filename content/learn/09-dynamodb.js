/* Learning layer — Module 09 DynamoDB (see content/LEARN.md) */
window.COURSE.registerLearn({
  moduleId: "dynamodb",
  bigPicture: "DynamoDB is AWS's serverless key-value database: you look items up by key and get single-digit-millisecond answers at any scale. The catch is that <strong>you design the keys around your questions up front</strong> — pick them well and it is cheap and fast forever, pick them badly and you get throttling that no setting can fix. On SAA-C03 it shows up constantly: capacity math, GSI vs LSI, DAX, Streams + Lambda, Global Tables, and spotting when DynamoDB is the wrong tool.",
  cheatsheet: [
    { k: "Some requests throttled while the table is mostly idle", v: "<strong>Hot partition key</strong> — fix the key design or shard writes, not the capacity dials" },
    { k: "One popular key (counter, big tenant) gets too many writes", v: "<strong>Write sharding</strong> — add a suffix so writes spread over N keys" },
    { k: "Need to query by a different attribute", v: "<strong>GSI</strong> — any partition key, add any time, eventually consistent" },
    { k: "Strongly consistent reads on an alternate sort order", v: "<strong>LSI</strong> — only at table creation, same partition key" },
    { k: "Base table writes throttled though table capacity is fine", v: "<strong>GSI is out of write capacity</strong> — it pushes back on the base table" },
    { k: "Find the small fraction of items in a special state", v: "<strong>Sparse GSI</strong> — index an attribute only those items have" },
    { k: "Spiky, unpredictable or new workload", v: "<strong>On-demand</strong> — pay per request, no capacity planning" },
    { k: "Steady, predictable, high-volume load, lowest cost", v: "<strong>Provisioned + reserved capacity</strong> (auto scaling for daily curves)" },
    { k: "All-or-nothing update across several items or tables", v: "<strong>TransactWriteItems</strong> — up to 100 items, costs 2x" },
    { k: "Stop two writers overwriting each other on one item", v: "<strong>ConditionExpression</strong> (optimistic locking) — no transaction needed" },
    { k: "Delete old items automatically at no cost", v: "<strong>TTL</strong> — free, but lazy (typically within a few days)" },
    { k: "React to every change in the table (trigger code)", v: "<strong>DynamoDB Streams + Lambda</strong> — 24 h retention, per-item order" },
    { k: "Microsecond reads, minimal code change", v: "<strong>DAX</strong> — drop-in cache for DynamoDB (not for strong reads)" },
    { k: "Multi-Region active-active with local writes", v: "<strong>Global Tables</strong> — conflicts resolved by last writer wins" },
    { k: "Restore to any second in the past month", v: "<strong>PITR</strong> — up to 35 days, always restores to a new table" },
    { k: "Run SQL analytics without hurting the live table", v: "<strong>Export to S3 + Athena</strong> — uses no table capacity" },
    { k: "Items bigger than 400 KB (images, documents)", v: "<strong>Store the object in S3</strong>, keep a pointer in DynamoDB" },
    { k: "Ad-hoc queries on any attribute chosen at query time", v: "<strong>Not DynamoDB</strong> — use RDS/Aurora, OpenSearch, or Athena" }
  ],
  lessons: {
    "partitions-internals": {
      minutes: 4,
      tldr: [
        "A table is split into <strong>partitions</strong>. The <strong>partition key</strong> is hashed to decide which partition an item lives on.",
        "Each partition has hard ceilings: about <strong>3,000 RCU, 1,000 WCU and 10 GB</strong>. One key can never go above these.",
        "<strong>Adaptive capacity</strong> lets a busy partition borrow unused capacity from the rest of the table — but never past one partition's ceiling.",
        "Throttled requests while the table looks idle means a <strong>hot key</strong>. The fix is key design, not more capacity."
      ],
      analogy: "Think of a supermarket with many checkout lanes, where your surname decides which lane you must use. Opening more lanes helps everyone in general, but if half the town is called Smith, the Smith lane still has a queue — each lane can only scan so fast.",
      examTip: "&ldquo;Requests throttled although consumed capacity is far below provisioned&rdquo; = <strong>hot partition</strong>. The answer is a better key or write sharding. Switching to on-demand or raising capacity is the trap.",
      terms: [
        { t: "Partition", d: "A slice of the table stored on three copies across three AZs, with its own throughput limits." },
        { t: "Partition key", d: "The attribute that is hashed to pick an item's partition. Decides spread and scale." },
        { t: "Item collection", d: "All items sharing one partition key, stored together and sorted by the sort key." },
        { t: "Adaptive capacity", d: "Automatic borrowing of spare table throughput by a hot partition, plus splitting hot keys apart." },
        { t: "Burst capacity", d: "Up to 5 minutes of unused throughput saved up to absorb short spikes (best effort)." }
      ],
      check: [
        {
          q: "A table has plenty of unused provisioned capacity, but writes for one very busy customer ID keep getting throttled. What is the cause?",
          options: ["The table needs more provisioned WCU", "One partition key is hitting its per-partition write ceiling", "Burst capacity has been disabled", "The items are larger than 400 KB"],
          answer: 1,
          why: "One key lives on one partition, capped at about 1,000 WCU. More table capacity does not raise that per-key ceiling, so the fix is key design or write sharding."
        },
        {
          q: "What is the maximum write rate a single partition key can sustain, no matter how the table is configured?",
          options: ["About 1,000 WCU", "About 3,000 WCU", "Unlimited with on-demand mode"],
          answer: 0,
          why: "Per-partition limits are about 3,000 RCU and 1,000 WCU. On-demand is a billing mode — it does not change these physical limits."
        }
      ]
    },
    "key-design": {
      minutes: 4,
      tldr: [
        "Design DynamoDB backwards: <strong>list your access patterns first</strong>, then choose keys that answer each one directly.",
        "A good partition key has <strong>many distinct values</strong> and <strong>even traffic</strong> (user ID yes; status or date no).",
        "<strong>Write sharding</strong> adds a suffix (e.g. 0-9) to a hot key so writes spread out; reads must then query every shard.",
        "A structured sort key like <code>ORDER#2026-07-21</code> lets one Query fetch ranges with <code>begins_with</code> or <code>between</code>.",
        "Single-table design stores related entities together so one Query fetches them all — useful, not mandatory."
      ],
      analogy: "A filing cabinet where you must decide the drawer labels before storing anything. Label drawers by customer and one pull gives you everything about that customer. Label them by 'status' and one drawer overflows while the others sit empty.",
      examTip: "&ldquo;Writes to one popular partition key are throttled&rdquo; → <strong>write sharding</strong> (add a random or calculated suffix). Low-cardinality keys like status, date or country are always the wrong partition key.",
      terms: [
        { t: "Access pattern", d: "A specific question the app asks, like 'orders for user X in July'. Keys are built to answer these." },
        { t: "Cardinality", d: "How many distinct values an attribute has. Partition keys need high cardinality." },
        { t: "Write sharding", d: "Appending a suffix to a hot key so its writes spread over several partitions." },
        { t: "Composite sort key", d: "A sort key built from parts, e.g. ORDER#date#id, so range queries work on a prefix." },
        { t: "Single-table design", d: "Storing several related entity types in one table so one Query returns them together." }
      ],
      check: [
        {
          q: "Which attribute is the best partition key for an orders table with millions of customers?",
          options: ["orderStatus (PENDING, SHIPPED, DELIVERED)", "orderDate", "customerId", "country"],
          answer: 2,
          why: "customerId has many values and spreads traffic evenly. Status, date and country have few values, so all of today's traffic piles onto a handful of partitions."
        },
        {
          q: "You shard a hot key into 10 suffixed keys. What is the main cost of doing this?",
          options: ["Writes become eventually consistent", "Reads must query all 10 shards and merge the results", "Each item must be under 1 KB"],
          answer: 1,
          why: "Sharding multiplies write capacity by 10, but a read of 'everything for that key' now fans out over 10 Queries. Keep the shard count as small as your write rate allows."
        }
      ]
    },
    "capacity-modes": {
      minutes: 4,
      tldr: [
        "<strong>1 WCU</strong> = one write per second of up to <strong>1 KB</strong>. <strong>1 RCU</strong> = one strongly consistent read per second of up to <strong>4 KB</strong>.",
        "Always <strong>round the item size up first</strong>. Eventually consistent reads cost <strong>half</strong>; transactions cost <strong>double</strong>.",
        "<strong>Provisioned</strong> (with auto scaling or reserved capacity) is cheapest for steady load; auto scaling reacts in minutes, not seconds.",
        "<strong>On-demand</strong> suits spiky or unknown traffic. It instantly handles up to <strong>2x your previous peak</strong>; bigger jumps can throttle.",
        "In provisioned mode every <strong>GSI has its own capacity</strong> — forget to scale it and the whole table throttles."
      ],
      analogy: "Provisioned is a phone contract: a fixed monthly allowance, cheap if you use most of it. On-demand is pay-as-you-go: pricier per call, but perfect when some months you barely call and others you call all day.",
      examTip: "Do the math slowly: round up (1 KB for writes, 4 KB for reads), multiply by rate, halve for eventual reads, double for transactions. Example: 10 writes/s of 2.5 KB = 10 x 3 = <strong>30 WCU</strong>.",
      terms: [
        { t: "WCU", d: "Write capacity unit: one write per second of an item up to 1 KB." },
        { t: "RCU", d: "Read capacity unit: one strong read (or two eventual reads) per second, up to 4 KB." },
        { t: "Provisioned mode", d: "You set RCU/WCU and pay per hour for them, used or not. Cheapest when steady." },
        { t: "On-demand mode", d: "Pay per request with no capacity planning. Best for spiky or unpredictable traffic." },
        { t: "Warm throughput", d: "A setting that pre-scales a table to a stated rate before a known big event." }
      ],
      check: [
        {
          q: "An app does 20 eventually consistent reads per second of 6 KB items. How many RCU are needed?",
          options: ["20 RCU", "30 RCU", "40 RCU", "15 RCU"],
          answer: 0,
          why: "6 KB rounds up to 8 KB = 2 read units. 20 reads x 2 = 40, halved for eventual consistency = 20 RCU. 40 forgets the halving."
        },
        {
          q: "A new app has unpredictable traffic that is idle most of the day with sudden bursts. Which capacity mode fits best?",
          options: ["Provisioned with reserved capacity", "On-demand", "Provisioned with a fixed high setting"],
          answer: 1,
          why: "On-demand charges only for requests made and needs no forecasting. Reserved or fixed provisioned capacity would be paid for all day while mostly idle."
        }
      ]
    },
    "gsi-vs-lsi": {
      minutes: 4,
      tldr: [
        "A <strong>GSI</strong> is like a second copy of the table with a <strong>different partition key</strong>. Add it any time; up to 20 per table.",
        "GSI reads are <strong>eventually consistent only</strong>, and a GSI short on write capacity <strong>throttles the base table</strong>.",
        "An <strong>LSI</strong> keeps the same partition key with a <strong>different sort key</strong>. Only at table creation; supports strong reads.",
        "Any LSI caps each item collection at <strong>10 GB</strong>. Default to GSIs unless you truly need strong reads on another sort order.",
        "A <strong>sparse GSI</strong> indexes an attribute only some items have, giving you a tiny index of just those items."
      ],
      analogy: "A GSI is a separate phone book the library keeps sorted by street instead of surname — useful, but updated a moment after the main book. An LSI is a second tab inside each surname's section, sorted differently, always perfectly in sync but only possible if you planned it when printing.",
      examTip: "&ldquo;Add an index to an existing table&rdquo; or &ldquo;query by a different key&rdquo; → <strong>GSI</strong>. &ldquo;Strongly consistent reads on an alternate sort key&rdquo; → <strong>LSI</strong>. GSI + strong consistency, or LSI + add later, are always wrong.",
      terms: [
        { t: "GSI (Global Secondary Index)", d: "Index with its own partition and sort key, kept in sync asynchronously. Eventually consistent." },
        { t: "LSI (Local Secondary Index)", d: "Same partition key, different sort key. Creation time only, strong reads allowed." },
        { t: "Projection", d: "Which attributes are copied into the index: keys only, a chosen list, or all." },
        { t: "Sparse index", d: "A GSI on an attribute present on only a few items, so only those items appear in it." },
        { t: "Backpressure", d: "When a GSI runs out of write capacity, DynamoDB throttles writes to the base table." }
      ],
      check: [
        {
          q: "A production table has run for a year. The team now needs to query items by email address. What should they use?",
          options: ["Add an LSI on email", "Add a GSI with email as partition key", "Scan the table with a filter on email"],
          answer: 1,
          why: "Only GSIs can be added to an existing table, and they allow a new partition key. LSIs are creation-time only, and a Scan reads (and bills) the whole table."
        },
        {
          q: "Which requirement can only be met with an LSI, not a GSI?",
          options: ["Querying by a completely different partition key", "Strongly consistent reads on an alternate sort key", "Adding the index after the table exists", "Having separate capacity for the index"],
          answer: 1,
          why: "GSIs are always eventually consistent. LSIs live next to the base data and support strong reads — the one thing a GSI can never offer."
        }
      ]
    },
    "consistency-transactions": {
      minutes: 3,
      tldr: [
        "Reads are <strong>eventually consistent by default</strong> (half price). <strong>Strongly consistent</strong> reads cost full price and don't work on GSIs.",
        "Every write is durable and each single-item write is atomic, even with eventual reads.",
        "A <strong>ConditionExpression</strong> makes a single-item write conditional — perfect for create-if-absent and optimistic locking.",
        "<strong>TransactWriteItems</strong>: up to <strong>100 items, 4 MB</strong>, all-or-nothing across tables, at <strong>2x cost</strong>, in one Region.",
        "A <strong>ClientRequestToken</strong> makes a transaction idempotent for <strong>10 minutes</strong>, so retries don't apply it twice."
      ],
      analogy: "A condition expression is like 'only change this seat booking if it's still free'. A transaction is a bank transfer: money leaves one account and arrives in the other, or nothing happens at all.",
      examTip: "&ldquo;All-or-nothing across multiple items or tables&rdquo; → <strong>TransactWriteItems</strong>. &ldquo;Prevent overwriting / optimistic locking on one item&rdquo; → <strong>ConditionExpression</strong>. &ldquo;Retry must not double-charge&rdquo; → transaction with a ClientRequestToken.",
      terms: [
        { t: "Eventually consistent read", d: "Default read. May briefly return old data right after a write. Costs half." },
        { t: "Strongly consistent read", d: "Always returns the latest committed write in that Region. Full price, not on GSIs." },
        { t: "ConditionExpression", d: "A rule a write must satisfy (e.g. item doesn't exist yet) or it is rejected." },
        { t: "TransactWriteItems", d: "Groups up to 100 writes across tables into one all-or-nothing operation." },
        { t: "ClientRequestToken", d: "Idempotency token: a retried transaction with the same token within 10 minutes isn't re-applied." }
      ],
      check: [
        {
          q: "Two users may edit the same profile at once. The second save must fail if the item changed since it was read. What do you use?",
          options: ["TransactWriteItems", "A ConditionExpression on a version number", "Strongly consistent reads", "BatchWriteItem"],
          answer: 1,
          why: "Optimistic locking on one item is exactly what a conditional write on a version attribute does, at normal cost. A transaction is for multiple items and costs double."
        },
        {
          q: "Checkout must decrement stock, create an order and add a ledger row across three tables, all or nothing. What do you use?",
          options: ["BatchWriteItem with the three writes", "TransactWriteItems with the three actions", "Three separate UpdateItem calls with retries"],
          answer: 1,
          why: "Transactions give atomicity across tables. BatchWriteItem is not atomic (some writes can succeed while others fail), and separate calls can leave half-done state."
        }
      ]
    },
    "ttl-streams-dax": {
      minutes: 4,
      tldr: [
        "<strong>TTL</strong> deletes items after an epoch-<strong>seconds</strong> timestamp, for free — but lazily, <strong>typically within a few days</strong>. Filter expired items yourself.",
        "<strong>Streams</strong> is the table's change log: every write becomes a record, kept <strong>24 hours</strong>, ordered per item.",
        "Streams + <strong>Lambda</strong> is the standard way to react to changes. Lambda may see a record twice, so handlers must be idempotent.",
        "Need longer retention or many consumers? Send changes to <strong>Kinesis Data Streams</strong> instead (up to a year).",
        "<strong>DAX</strong> is a drop-in cache giving <strong>microsecond</strong> reads with almost no code change — but strong reads skip it."
      ],
      analogy: "TTL is a 'best before' sticker that the cleaner eventually acts on, not the second it expires. Streams is a security camera log of every change to the shelves. DAX is a small shelf by the till holding the most-bought items, so people don't walk to the back.",
      examTip: "&ldquo;Read-heavy, microsecond latency, minimal code change&rdquo; → <strong>DAX</strong>. But if the app needs strongly consistent reads, DAX is the planted wrong answer. &ldquo;Run code when an item changes&rdquo; → <strong>Streams + Lambda</strong>.",
      terms: [
        { t: "TTL (Time to Live)", d: "An attribute holding an expiry time; DynamoDB deletes the item later, free of charge." },
        { t: "DynamoDB Streams", d: "Ordered log of item changes, kept 24 hours, usually consumed by Lambda." },
        { t: "Idempotent handler", d: "Code that gives the same result if the same event is processed twice." },
        { t: "DAX", d: "DynamoDB Accelerator: an in-memory write-through cache cluster in your VPC, same API as DynamoDB." },
        { t: "Kinesis Data Streams destination", d: "Alternative change feed with up to 1-year retention and many consumers, but no strict ordering." }
      ],
      check: [
        {
          q: "Items whose TTL expired 10 hours ago still appear in query results. What is the right conclusion?",
          options: ["TTL is broken; open a support case", "This is normal; TTL deletes lazily, so filter expired items in queries", "TTL is using up the write capacity"],
          answer: 1,
          why: "TTL deletion is a free background job that typically completes within a few days. If your app must hide expired items, add a filter on the TTL attribute."
        },
        {
          q: "A catalog app on DynamoDB needs faster reads with minimal code change, but some flows need strongly consistent reads. What is true about DAX?",
          options: ["DAX serves strong reads from cache", "Strongly consistent reads bypass DAX and go to the table", "DAX makes all reads strongly consistent"],
          answer: 1,
          why: "DAX only caches eventually consistent reads. Strong reads pass straight through to DynamoDB, so they get no speed-up."
        }
      ]
    },
    "global-tables-ops": {
      minutes: 5,
      tldr: [
        "<strong>Global Tables</strong> copy a table to several Regions, and <strong>every Region can write</strong>. Replication is usually under a second.",
        "Conflicts are settled by <strong>last writer wins</strong>: an earlier concurrent update can vanish silently. Give each item one home Region for writes.",
        "Transactions and strong reads are regional by default. (Since 2025, an MRSC mode with 3 Regions adds cross-Region strong reads.)",
        "<strong>PITR</strong> restores to any second in the last <strong>35 days</strong>, always into a <strong>new table</strong>. <strong>Export to S3</strong> uses no table capacity.",
        "A <strong>Scan</strong> bills for everything it reads — filters don't cut cost. Don't use DynamoDB for ad-hoc queries or items over 400 KB."
      ],
      analogy: "Global Tables are like a shared online document open in two countries: both can type, and if both edit the same sentence at the same instant, the last save wins and the other edit is gone. The fix is agreeing who edits which paragraphs.",
      examTip: "&ldquo;Multi-Region, active-active, low-latency local reads and writes&rdquo; → <strong>Global Tables</strong>; conflict resolution = <strong>last writer wins</strong>. Compare with Aurora Global Database: one writer Region, failover by promotion.",
      terms: [
        { t: "Global Tables", d: "A DynamoDB table replicated across Regions, with every replica accepting writes." },
        { t: "Last writer wins (LWW)", d: "Conflict rule: when two Regions update the same item, the later timestamp is kept." },
        { t: "PITR", d: "Point-in-time recovery: continuous backups, restore to any second within up to 35 days." },
        { t: "Export to S3", d: "Dump a point-in-time copy of the table to S3 for Athena/Glue, without using table capacity." },
        { t: "Scan", d: "Reads the entire table page by page; you pay for every item read, even ones filtered out." }
      ],
      check: [
        {
          q: "A company needs users in the US and Europe to read and write locally to the same DynamoDB data with low latency. What do you choose?",
          options: ["DynamoDB Global Tables", "A DAX cluster in each Region", "Cross-Region read replicas", "Aurora Global Database"],
          answer: 0,
          why: "Global Tables are multi-active: every Region accepts writes. Aurora Global Database has only one writer Region, and DynamoDB has no 'read replicas' feature."
        },
        {
          q: "Analysts want to run SQL over last month's table data without affecting the production table. What is the best approach?",
          options: ["Run a nightly Scan into another table", "Export to S3 from PITR and query with Athena", "Read the table's Stream history"],
          answer: 1,
          why: "Export to S3 consumes no table capacity and Athena queries it with SQL. A Scan burns production capacity, and Streams only keeps 24 hours."
        }
      ]
    }
  }
});
