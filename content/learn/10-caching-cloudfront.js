/* Learning layer — Module 10 Caching and CloudFront (see content/LEARN.md) */
window.COURSE.registerLearn({
  moduleId: "caching",
  bigPicture: "A cache keeps a copy of data closer to whoever needs it, so answers come back faster and your database or origin does less work — at the price of sometimes serving slightly old data. This module covers the cache you run next to your app (<strong>ElastiCache</strong> Redis/Valkey or Memcached), the one built for DynamoDB (<strong>DAX</strong>), where to keep user sessions, and the global cache in front of your whole site (<strong>CloudFront</strong>), plus its non-caching cousin <strong>Global Accelerator</strong>. The exam loves these as keyword questions: learn the clue words and most answers pick themselves.",
  cheatsheet: [
    { k: "Data can be a bit stale; cut database reads", v: "<strong>Lazy loading (cache-aside) + TTL</strong> — cache fills on first read" },
    { k: "Cache must never be stale after an update", v: "<strong>Write-through</strong> — update cache and DB together" },
    { k: "Simplest cache, multithreaded, no persistence needed", v: "<strong>ElastiCache Memcached</strong>" },
    { k: "Leaderboards, sorted sets, pub/sub, failover, backups", v: "<strong>ElastiCache Redis/Valkey</strong>" },
    { k: "Redis dataset or writes bigger than one node", v: "<strong>Cluster mode enabled</strong> — shards, configuration endpoint" },
    { k: "Cache with no capacity planning, spiky traffic", v: "<strong>ElastiCache Serverless</strong> — pay per GB-hour + ECPU" },
    { k: "Microsecond DynamoDB reads, minimal code change", v: "<strong>DAX</strong> — swap the SDK client (strong reads skip it)" },
    { k: "Users logged out when Auto Scaling scales in", v: "<strong>Move sessions to ElastiCache or DynamoDB</strong>, drop sticky sessions" },
    { k: "Private S3 bucket readable only through CloudFront", v: "<strong>Origin Access Control (OAC)</strong> + bucket policy (not OAI)" },
    { k: "ALB origin must only accept CloudFront traffic", v: "<strong>VPC origin</strong> (private ALB), or secret header + CloudFront prefix list" },
    { k: "Protect one downloadable file", v: "<strong>CloudFront signed URL</strong>" },
    { k: "Protect many files (video segments, members area)", v: "<strong>CloudFront signed cookies</strong>" },
    { k: "Hit ratio collapsed after adding cookies/headers to the key", v: "Move them to the <strong>origin request policy</strong> — forward, don't key" },
    { k: "Updated files must show up without purges", v: "<strong>Versioned file names</strong>; invalidation only for emergencies" },
    { k: "Simple header rewrite or redirect at the edge, sub-ms", v: "<strong>CloudFront Functions</strong> (viewer triggers only)" },
    { k: "Edge logic that calls a database or picks the origin", v: "<strong>Lambda@Edge</strong> — network access, origin triggers" },
    { k: "Static IPs, UDP, gaming, fast Regional failover", v: "<strong>Global Accelerator</strong> — Layer 4, no caching" },
    { k: "Cache web content globally, reduce origin load", v: "<strong>CloudFront</strong>" }
  ],
  lessons: {
    "strategy": {
      minutes: 5,
      tldr: [
        "<strong>Lazy loading (cache-aside)</strong>: read the cache; on a miss, read the DB and store the result. Simple, but data can be stale.",
        "<strong>Write-through</strong>: every write updates DB and cache together, so reads are fresh. Cost: you cache data nobody reads.",
        "<strong>Write-behind</strong> (cache first, DB later) risks losing data — the exam treats it as a durability bug.",
        "Add <strong>random jitter to TTLs</strong> so thousands of keys don't expire in the same second and flood the database.",
        "A <strong>stampede</strong> is many readers rebuilding one expired hot key at once. Fix: let only one request rebuild it."
      ],
      analogy: "A cache is the notepad by your phone with frequently-called numbers. Lazy loading means you write a number down the first time you look it up. Write-through means whenever a number changes, you update the phone book and the notepad at the same time.",
      examTip: "&ldquo;Slightly stale is fine, minimize DB load&rdquo; → <strong>lazy loading with TTL</strong>. &ldquo;Must never serve stale data after an update&rdquo; → <strong>write-through</strong>. A cache is never the only copy of important data.",
      terms: [
        { t: "Cache-aside (lazy loading)", d: "App checks the cache first and only fills it after a miss." },
        { t: "Write-through", d: "Writes go to both the database and the cache at the same time." },
        { t: "TTL", d: "Time to live: how long a cached copy is kept before it expires." },
        { t: "Jitter", d: "A small random amount added to TTLs so expiries are spread out." },
        { t: "Cache stampede", d: "Many requests miss the same expired key at once and all hit the database." }
      ],
      check: [
        {
          q: "A product page can show prices up to 5 minutes old. The goal is to cut database reads. Which pattern fits best?",
          options: ["Write-behind caching", "Lazy loading with a 5-minute TTL", "No cache; add a read replica only"],
          answer: 1,
          why: "Lazy loading only caches what is actually read, and the TTL caps staleness at 5 minutes. Write-behind risks data loss and isn't about reads."
        },
        {
          q: "Every day at 10:00 the database spikes because many cache keys, all set at 09:00 with a 1-hour TTL, expire together. What is the simplest fix?",
          options: ["Add random jitter to each key's TTL", "Remove TTLs completely", "Double the database size"],
          answer: 0,
          why: "Jitter spreads expiries over time so they don't all miss at once. Removing TTLs means data never refreshes; a bigger DB treats the symptom."
        }
      ]
    },
    "redis": {
      minutes: 4,
      tldr: [
        "ElastiCache runs <strong>Redis OSS or Valkey</strong> (the open-source fork, same protocol, cheaper). Exams often still just say Redis.",
        "<strong>Cluster mode disabled</strong>: one shard, up to 5 replicas, one primary endpoint. Writes scale only with a bigger node.",
        "<strong>Cluster mode enabled</strong>: data split across shards (16,384 slots), up to 500 nodes, one configuration endpoint — scales writes.",
        "Replication is <strong>asynchronous</strong>: a failover can lose the last writes. Redis is a cache, never the only copy of orders.",
        "<strong>Global Datastore</strong> copies to up to 2 other Regions (read-only, ~1 s lag); failover is manual."
      ],
      analogy: "Cluster mode disabled is one very fast cashier with helpers who can only answer questions. Cluster mode enabled opens several tills, each owning part of the alphabet — more tills means more sales per minute.",
      examTip: "&ldquo;Dataset larger than the biggest node&rdquo; or &ldquo;scale writes&rdquo; → <strong>cluster mode enabled</strong>. &ldquo;Orders stored only in ElastiCache were lost in failover&rdquo; → move the source of truth to DynamoDB or RDS.",
      terms: [
        { t: "Shard", d: "One primary node plus its replicas, holding part of the data." },
        { t: "Cluster mode enabled", d: "Data spread across many shards so writes and size can grow horizontally." },
        { t: "Multi-AZ failover", d: "If the primary fails, a replica in another AZ is promoted, usually in under a minute." },
        { t: "Global Datastore", d: "Cross-Region Redis/Valkey copy: one writable Region, up to two read-only ones." },
        { t: "Valkey", d: "Open-source Redis fork AWS now favours; same commands, lower price." }
      ],
      check: [
        {
          q: "A Redis leaderboard now needs more write throughput and memory than the largest node offers. What should you do?",
          options: ["Add more read replicas", "Enable cluster mode and shard the data", "Switch to Memcached"],
          answer: 1,
          why: "Only cluster mode enabled splits data and writes across several primaries. Replicas are read-only, and Memcached has no sorted sets for leaderboards."
        },
        {
          q: "Why should important orders not be stored only in ElastiCache, even with snapshots turned on?",
          options: ["ElastiCache cannot store more than 1 GB", "Replication is asynchronous, so a failover can lose recent writes", "ElastiCache has no encryption"],
          answer: 1,
          why: "Snapshots and AOF help recovery but don't guarantee every acknowledged write survives. Keep orders in a durable database with Redis in front."
        }
      ]
    },
    "memcached-serverless": {
      minutes: 4,
      tldr: [
        "<strong>Memcached</strong>: simple, <strong>multithreaded</strong>, no replication, no persistence, no data structures. Lose a node, lose that part of the cache.",
        "<strong>Redis/Valkey</strong>: data structures, replicas, failover, backups, pub/sub. Any of these words means Redis.",
        "<strong>ElastiCache Serverless</strong>: no nodes to size, one endpoint, scales in seconds, Multi-AZ by default.",
        "Serverless bills per <strong>GB-hour stored + ECPU</strong> (request units). Cheaper for spiky loads; steady high loads are cheaper on reserved nodes.",
        "Set a <strong>maximum usage cap</strong> on Serverless so a bug can't run up an unlimited bill."
      ],
      analogy: "Memcached is a whiteboard: fast, anyone can write, and if it gets wiped you just rewrite it from the files. Redis is a proper notebook with sections, lists and a backup copy.",
      examTip: "Memcached keywords: &ldquo;<strong>simplest</strong>&rdquo;, &ldquo;<strong>multithreaded</strong>&rdquo;, &ldquo;can be repopulated after node loss&rdquo;. Anything about sorted sets, persistence, failover or backup → Redis. &ldquo;No capacity planning, minimal ops&rdquo; → Serverless.",
      terms: [
        { t: "Memcached", d: "Plain in-memory key-value cache: multithreaded, no replication or persistence." },
        { t: "Auto-discovery", d: "Lets Memcached clients learn the list of nodes from one endpoint." },
        { t: "ElastiCache Serverless", d: "Cache with no nodes to manage; scales automatically and bills per use." },
        { t: "ECPU", d: "ElastiCache Processing Unit: the per-request billing unit of Serverless (about one simple 1 KB request)." }
      ],
      check: [
        {
          q: "A team wants the simplest multithreaded cache for HTML fragments. Losing a node is fine because data can be rebuilt. Which do they pick?",
          options: ["ElastiCache for Redis, cluster mode enabled", "ElastiCache for Memcached", "DAX"],
          answer: 1,
          why: "Simple, multithreaded, disposable cache are the classic Memcached keywords. DAX only caches DynamoDB, and Redis adds features they don't need."
        },
        {
          q: "A new app has unpredictable traffic and the team doesn't want to size cache nodes or manage failover. What fits?",
          options: ["ElastiCache Serverless", "Node-based Redis with reserved nodes", "Memcached on the largest node type"],
          answer: 0,
          why: "Serverless removes node sizing and is Multi-AZ by default. Reserved nodes are cheaper only for steady, well-understood load."
        }
      ]
    },
    "dax": {
      minutes: 4,
      tldr: [
        "<strong>DAX</strong> is a cache built only for DynamoDB. Swap in the DAX client and reads drop from milliseconds to <strong>microseconds</strong>.",
        "It has an <strong>item cache</strong> (GetItem) and a <strong>query cache</strong> (Query/Scan), each with a default 5-minute TTL.",
        "It is <strong>write-through</strong> and only speeds up reads. <strong>Strongly consistent reads skip DAX</strong> completely.",
        "Up to 11 nodes in your VPC. Adding nodes adds read throughput, not cache size — the hot data must fit in one node.",
        "Use <strong>ElastiCache</strong> instead when caching computed results, data from several sources, or sessions."
      ],
      analogy: "DAX is like fitting a turbo that bolts straight onto one specific engine, DynamoDB: no redesign needed. ElastiCache is a general-purpose storeroom you can fill with anything, but you have to organise it yourself.",
      examTip: "&ldquo;Microsecond latency for DynamoDB, minimal code change&rdquo; → <strong>DAX</strong>. If the path uses <code>ConsistentRead=true</code> or the problem is slow writes, DAX is the planted wrong answer.",
      terms: [
        { t: "DAX", d: "DynamoDB Accelerator: managed in-memory cache with the same API as DynamoDB." },
        { t: "Item cache", d: "DAX cache for GetItem/BatchGetItem results, keyed by primary key." },
        { t: "Query cache", d: "DAX cache for Query/Scan results; writes do not refresh it until TTL." },
        { t: "Write-through", d: "DAX writes to DynamoDB first, then updates its item cache." }
      ],
      check: [
        {
          q: "After adding DAX, most reads became microseconds, but one path with ConsistentRead set to true didn't improve. Why?",
          options: ["Its query cache TTL is too short", "Strongly consistent reads bypass DAX", "DAX only speeds up writes"],
          answer: 1,
          why: "DAX only serves eventually consistent reads from cache. Strong reads go straight to DynamoDB, so they see no change."
        },
        {
          q: "An app must cache the combined result of queries across three DynamoDB tables and an external API. What is the better choice?",
          options: ["DAX", "ElastiCache (Redis/Valkey)", "A GSI on each table"],
          answer: 1,
          why: "DAX caches individual DynamoDB calls only. Computed results from several sources need a general cache like ElastiCache."
        }
      ]
    },
    "sessions": {
      minutes: 4,
      tldr: [
        "<strong>Sticky sessions</strong> pin a user to one server. When that server is scaled in or fails, the user is logged out.",
        "The exam's preferred answer: make the web tier <strong>stateless</strong> by storing sessions outside the servers.",
        "<strong>ElastiCache Redis</strong> for sessions: sub-millisecond, built-in expiry. Best when lowest latency matters.",
        "<strong>DynamoDB + TTL</strong> for sessions: serverless, durable, pay per request. Check expiry yourself, as TTL deletes lazily."
      ],
      analogy: "Sticky sessions are like a restaurant where only your original waiter knows your order; if they go home, your order is gone. A shared session store is the order written on a ticket in the kitchen, so any waiter can serve you.",
      examTip: "&ldquo;Users logged out when the Auto Scaling group scales in&rdquo; → <strong>store sessions in ElastiCache or DynamoDB</strong>. Sticky sessions are almost always the tempting wrong answer.",
      terms: [
        { t: "Sticky sessions", d: "ALB session affinity: a cookie keeps sending a user to the same target." },
        { t: "Stateless tier", d: "Servers keep no user data, so any server can handle any request." },
        { t: "Session store", d: "A shared fast database (Redis or DynamoDB) that holds login sessions." },
        { t: "Duration-based cookie", d: "ALB-generated stickiness cookie, lasting 1 second to 7 days." }
      ],
      check: [
        {
          q: "Users behind an ALB are logged out whenever instances are terminated during scale-in. What is the best fix?",
          options: ["Make the stickiness cookie last 7 days", "Store session state in ElastiCache or DynamoDB", "Enable cross-zone load balancing"],
          answer: 1,
          why: "External session storage lets any instance serve any user. A longer sticky cookie still loses the session when its instance dies."
        },
        {
          q: "A team wants a serverless, durable session store with no cluster to manage. Which fits best?",
          options: ["DynamoDB with a TTL attribute", "EFS shared file system", "ElastiCache node-based Redis"],
          answer: 0,
          why: "DynamoDB is serverless and durable, and TTL cleans up old sessions. EFS is slow for this, and node-based Redis is a cluster to run."
        }
      ]
    },
    "cloudfront-core": {
      minutes: 5,
      tldr: [
        "<strong>CloudFront</strong> is AWS's CDN: hundreds of edge locations cache your content near users; misses go to regional caches, then your origin.",
        "<strong>Cache behaviors</strong> route by path (<code>/api/*</code>, <code>*.jpg</code>), first match wins, each with its own caching rules.",
        "The <strong>cache policy</strong> sets the cache key and TTLs. Anything in the key splits the cache — keep it minimal.",
        "Need the origin to see a header without splitting the cache? Put it in the <strong>origin request policy</strong>.",
        "Prefer <strong>versioned file names</strong> over invalidations (first 1,000 paths/month free). Transfer from AWS origins to CloudFront is free."
      ],
      analogy: "CloudFront is a chain of corner shops stocking copies of your products. The cache key is the product label: if you label each box with the customer's name, no two customers can share a box and every shop orders from the factory again.",
      examTip: "&ldquo;Hit ratio dropped after adding cookies/headers to the cache key&rdquo; → move them to the <strong>origin request policy</strong>. Origin groups fail over <strong>GET/HEAD/OPTIONS only</strong>, never writes.",
      terms: [
        { t: "Edge location", d: "A CloudFront site near users that stores cached copies of content." },
        { t: "Cache behavior", d: "A path-pattern rule deciding how requests for matching paths are cached and routed." },
        { t: "Cache key", d: "What makes two requests count as the same object: URL plus chosen headers, cookies, query strings." },
        { t: "Origin request policy", d: "Extra values forwarded to the origin without becoming part of the cache key." },
        { t: "Origin group", d: "A primary and secondary origin; CloudFront switches to the secondary on errors, reads only." },
        { t: "Invalidation", d: "A request to remove paths from every edge cache before their TTL ends." }
      ],
      check: [
        {
          q: "After a release, CloudFront's cache hit ratio drops from 90% to 15%. The new cache policy includes all cookies in the cache key. What is the fix?",
          options: ["Raise the default TTL", "Remove cookies from the cache key and forward them with an origin request policy", "Change to PriceClass_All"],
          answer: 1,
          why: "Keying on all cookies makes almost every request unique. Forwarding them without keying lets the origin see them while users share cached copies."
        },
        {
          q: "An origin sends max-age of one week, but CloudFront refetches objects every 24 hours. What is the likely cause?",
          options: ["The cache policy's maximum TTL is set to one day", "CloudFront ignores Cache-Control headers", "Edge locations clear themselves daily"],
          answer: 0,
          why: "CloudFront uses the origin's value but clamps it between the policy's min and max TTL. A max TTL of 86,400 seconds cuts a week down to a day."
        }
      ]
    },
    "cloudfront-security": {
      minutes: 4,
      tldr: [
        "<strong>Origin Access Control (OAC)</strong> keeps an S3 bucket private so only your distribution can read it. It replaced OAI and supports SSE-KMS.",
        "For ALB/EC2 origins, <strong>VPC origins</strong> keep them in private subnets; otherwise use a <strong>secret header</strong> plus the CloudFront <strong>prefix list</strong>.",
        "<strong>Signed URL</strong> = access to one file. <strong>Signed cookies</strong> = access to many files without changing URLs.",
        "Sign with keys in <strong>trusted key groups</strong>. The old root-account key pairs are the legacy wrong answer.",
        "A <strong>CloudFront signed URL</strong> goes through the CDN; an <strong>S3 presigned URL</strong> goes straight to S3, bypassing CloudFront."
      ],
      analogy: "OAC is a staff-only back door: the warehouse (S3) only opens for your delivery van (your distribution), never for walk-ins. A signed URL is a single-use ticket for one show; signed cookies are a festival wristband for every stage.",
      examTip: "&ldquo;S3 bucket accessible only through CloudFront&rdquo; → <strong>OAC</strong> + bucket policy with the distribution ARN. SSE-KMS objects failing with OAI → migrate to OAC. Many files, unchanged URLs → <strong>signed cookies</strong>.",
      terms: [
        { t: "OAC (Origin Access Control)", d: "Lets CloudFront sign requests to a private S3 bucket; the modern replacement for OAI." },
        { t: "VPC origin", d: "Lets CloudFront reach an ALB, NLB or EC2 instance sitting in a private subnet." },
        { t: "Managed prefix list", d: "AWS-maintained list of CloudFront IP ranges to allow in a security group." },
        { t: "Signed URL", d: "A URL with an expiry and signature granting access to one object." },
        { t: "Signed cookies", d: "Cookies granting access to many objects under a path, without changing URLs." },
        { t: "Trusted key group", d: "Set of public keys CloudFront uses to verify signed URLs and cookies." }
      ],
      check: [
        {
          q: "A private S3 bucket with SSE-KMS objects must be readable only through CloudFront. What should you use?",
          options: ["Origin Access Identity (OAI)", "Origin Access Control (OAC) with a bucket policy on the distribution ARN", "Make the bucket public but block direct links"],
          answer: 1,
          why: "OAC is the current method and supports SSE-KMS. OAI is legacy and cannot read KMS-encrypted objects; a public bucket defeats the goal."
        },
        {
          q: "A video site serves hundreds of segment files per video to paying users. The player can't change each URL. What fits?",
          options: ["A signed URL per segment", "Signed cookies on the video path", "Field-level encryption"],
          answer: 1,
          why: "Signed cookies cover many files under one path without rewriting URLs. Field-level encryption protects form fields, not access."
        }
      ]
    },
    "edge-ga": {
      minutes: 4,
      tldr: [
        "<strong>CloudFront Functions</strong>: tiny JavaScript on viewer requests/responses only. Sub-millisecond, cheap, no network access.",
        "<strong>Lambda@Edge</strong>: real Lambda (Node.js/Python), can call databases and use origin triggers. Authored in <strong>us-east-1</strong>.",
        "<strong>Global Accelerator</strong>: <strong>2 static anycast IPs</strong>, carries TCP/UDP over the AWS backbone, fast Regional failover. No caching.",
        "CloudFront = HTTP + caching. Global Accelerator = static IPs, UDP, non-HTTP, quick deterministic failover."
      ],
      analogy: "CloudFront is a network of local shops holding stock near customers. Global Accelerator is a private motorway entrance near every customer: it stores nothing, but gets their traffic to your building faster and reroutes instantly if a building closes.",
      examTip: "&ldquo;Static IP / allowlist&rdquo;, &ldquo;UDP&rdquo;, &ldquo;gaming/VoIP&rdquo;, &ldquo;failover in seconds across Regions&rdquo; → <strong>Global Accelerator</strong>. &ldquo;Cache&rdquo;, &ldquo;static and dynamic web content&rdquo; → <strong>CloudFront</strong>. Edge code that calls a database → <strong>Lambda@Edge</strong>.",
      terms: [
        { t: "CloudFront Functions", d: "Lightweight JS at every edge, viewer triggers only, for rewrites, redirects and headers." },
        { t: "Lambda@Edge", d: "Lambda functions run by CloudFront, with network access and origin-side triggers." },
        { t: "Viewer vs origin trigger", d: "Viewer runs on every request; origin runs only on cache misses, before or after the origin." },
        { t: "Global Accelerator", d: "Layer 4 service giving two fixed anycast IPs that route users over AWS's network." },
        { t: "Anycast IP", d: "One IP address announced from many locations; users reach the nearest one." }
      ],
      check: [
        {
          q: "A UDP multiplayer game needs two fixed IP addresses for allowlisting and failover between Regions within seconds. What do you use?",
          options: ["CloudFront with an origin group", "Route 53 latency routing", "AWS Global Accelerator"],
          answer: 2,
          why: "Global Accelerator gives static anycast IPs, supports UDP, and fails over without waiting on DNS. CloudFront is HTTP only and has no static IPs."
        },
        {
          q: "Edge logic must look up authorization data in DynamoDB before forwarding a request. Which option works?",
          options: ["CloudFront Functions", "Lambda@Edge", "A response headers policy"],
          answer: 1,
          why: "CloudFront Functions have no network access, so an external lookup needs Lambda@Edge."
        }
      ]
    }
  }
});
