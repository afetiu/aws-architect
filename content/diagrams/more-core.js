/* Interactive diagrams: iam, caching, route53, migration modules. */

window.COURSE.registerDiagram({
  id: "iam-funnel",
  moduleId: "iam",
  title: "The IAM evaluation funnel",
  sub: "Every request falls through these gates in order. One explicit deny anywhere kills it; otherwise something must allow it before the bottom.",
  w: 760, h: 460,
  nodes: [
    { id: "request", x: 300, y: 12, w: 160, h: 36, color: "blue", label: "Request", sub: "principal + action",
      info: "Every API call arrives as a SigV4-signed request carrying a principal, an action, a resource, and condition context (source IP, MFA, tags). Evaluation is not first-match: AWS collects ALL applicable policies first, then walks this funnel in strict order. The default answer is implicit deny — silence loses." },
    { id: "deny", x: 300, y: 78, w: 160, h: 36, color: "red", label: "Explicit deny?", sub: "any policy, any layer",
      info: "An explicit Deny in ANY policy — identity, resource, SCP, permission boundary, session policy — ends evaluation instantly and cannot be overridden by any allow. This is why guardrails are written as denies with conditions (deny unless aws:RequestedRegion is eu-west-1), not as carefully-scoped allows." },
    { id: "scp", x: 300, y: 144, w: 160, h: 36, color: "orange", label: "SCP gate", sub: "org ceiling, no grants",
      info: "Service control policies come from AWS Organizations and apply to every principal in the account — including the root user. They never grant anything; they only define the maximum the account can do. An action outside the SCP ceiling is dead here no matter what the identity policy says." },
    { id: "respol", x: 300, y: 210, w: 160, h: 36, color: "yellow", label: "Resource policy", sub: "bucket / key / queue",
      info: "Bucket policies, KMS key policies, SQS queue policies — attached to the resource, naming principals. Same-account: an allow from EITHER the resource policy OR the identity policy is sufficient. Cross-account: this becomes one of the two ends that must BOTH allow (see the side note)." },
    { id: "boundary", x: 300, y: 276, w: 160, h: 36, color: "orange", label: "Perm boundary", sub: "cap by intersection",
      info: "A permission boundary is a ceiling attached to a user or role: effective permissions = boundary INTERSECT identity policy. It grants nothing by itself. The pattern it exists for is delegated IAM — let developers create roles freely, knowing nothing they create can out-grant the boundary." },
    { id: "idpol", x: 300, y: 342, w: 160, h: 36, color: "green", label: "Identity policy", sub: "user / group / role",
      info: "The managed and inline policies attached to the principal. In the common case this is where the allow actually comes from — but note it is the LAST gate, not the only one. AdministratorAccess here means nothing if an SCP or boundary above already capped the action." },
    { id: "allow", x: 300, y: 408, w: 160, h: 36, color: "green", label: "ALLOW",
      info: "Reached only when no layer said deny AND at least one applicable policy said allow. There is no neutral outcome: anything that falls through without an allow lands on the implicit deny. When debugging AccessDenied, walk the funnel top-down — the error message rarely tells you which gate ate the request." },
    { id: "xacct", x: 540, y: 190, w: 170, h: 46, color: "blue", label: "Cross-account", sub: "BOTH ends must allow",
      info: "When the principal and the resource live in different accounts, the either/or shortcut disappears: the resource policy in the trusting account AND the identity policy in the calling account must BOTH allow the action. One end alone is AccessDenied — the single most common cross-account debugging session." }
  ],
  edges: [
    { from: "request", to: "deny" },
    { from: "deny", to: "scp", label: "no deny" },
    { from: "scp", to: "respol", label: "within ceiling" },
    { from: "respol", to: "boundary" },
    { from: "boundary", to: "idpol", label: "within cap" },
    { from: "idpol", to: "allow", label: "allowed" },
    { from: "respol", to: "xacct", dashed: true }
  ],
  flows: [
    { title: "Same-account happy path", steps: [
      { lit: ["request", "request->deny"], text: "A role in the app account calls s3:GetObject on a bucket in the same account. All applicable policies are gathered; first check is for explicit denies — there are none." },
      { lit: ["deny->scp", "scp"], text: "The org's SCP on this OU allows S3 (it's within the ceiling). Remember the SCP contributed <strong>nothing</strong> to the allow — it merely declined to kill the request." },
      { lit: ["scp->respol", "respol"], text: "The bucket policy is silent about this principal. Same account, so that's fine: either side allowing is enough, and we still have the identity policy to come." },
      { lit: ["respol->boundary", "boundary"], text: "No permission boundary is attached to this role, so there is no intersection to compute — the gate is a no-op. If one were attached, s3:GetObject would need to appear in it too." },
      { lit: ["idpol", "idpol->allow", "allow"], text: "The role's identity policy allows s3:GetObject on this bucket ARN. One allow, zero denies, all ceilings respected — <strong>ALLOW</strong>. This is the shape of 95% of production requests." }
    ]},
    { title: "Killed by SCP (admin in a sandbox)", steps: [
      { lit: ["request", "idpol"], text: "A developer in the sandbox account has AdministratorAccess attached — full allow on everything. They try to launch a p4d.24xlarge. Surely an admin can?" },
      { lit: ["scp"], text: "The sandbox OU carries an SCP denying expensive instance families and any region outside eu-west-1. The request dies at the SCP gate — evaluation never even reaches the identity policy." },
      { lit: ["idpol", "allow"], text: "AdministratorAccess never got a vote. This is the whole point of the funnel order: <strong>account-local admins cannot out-rank org guardrails</strong>. The fix is a conversation with the platform team, not a bigger policy." }
    ]},
    { title: "Cross-account needs both ends", steps: [
      { lit: ["request"], text: "A role in account A calls s3:PutObject on a bucket owned by account B. The either/or convenience of same-account evaluation no longer applies." },
      { lit: ["respol", "xacct"], text: "End one: account B's <strong>bucket policy</strong> must explicitly allow account A's principal (or the whole account A root, delegating the fine-graining to A). Without this, B has never consented." },
      { lit: ["idpol", "xacct"], text: "End two: the caller's <strong>identity policy</strong> in account A must also allow s3:PutObject on B's bucket ARN. Owning an allow on 'arn:aws:s3:::*' in your own account does not conjure rights in someone else's." },
      { lit: ["allow"], text: "Both ends allow, no denies, SCPs on both orgs silent — the write succeeds. When it doesn't, check both ends before anything else: one-sided grants are the classic cross-account failure." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "cdn-path",
  moduleId: "caching",
  title: "A request through CloudFront",
  sub: "From viewer to origin and back: where the caches sit, who gets to skip the trip, and why versioned URLs beat invalidations.",
  w: 780, h: 400,
  nodes: [
    { id: "viewer", x: 20, y: 175, w: 110, h: 44, color: "blue", label: "Viewer", sub: "nearest PoP via DNS",
      info: "The browser resolves your CloudFront domain and DNS steers it to the nearest of 600+ edge locations by latency. TLS terminates at the edge, so even a full cache miss already saved the long TLS handshake to your origin. HTTP/3 and TLS 1.3 to the viewer regardless of what the origin speaks." },
    { id: "edge", x: 170, y: 175, w: 140, h: 46, color: "orange", label: "Edge location", sub: "cache check here",
      info: "The first cache lookup. The cache key — built from the cache policy's chosen headers, cookies, and query strings — decides hit or miss; everything NOT in the key is stripped before going upstream, which is why an over-broad key silently destroys your hit ratio. A hit is served in single-digit milliseconds with zero origin involvement." },
    { id: "recache", x: 350, y: 175, w: 150, h: 46, color: "orange", label: "Regional cache", sub: "regional edge cache",
      info: "A larger, longer-lived cache layer that a dozen edge locations share. It absorbs misses from individual edges, so an object evicted at one PoP is often still here — the origin sees one fetch instead of one per edge. You don't configure it; it's simply in the path for most cache misses." },
    { id: "shield", x: 350, y: 60, w: 150, h: 44, color: "yellow", label: "Origin Shield", sub: "opt-in, per-request $",
      info: "An optional extra collapsing layer you pin to one region in front of the origin: all regional caches funnel through it, so worldwide misses become a single origin fetch. Worth it for expensive origins (transcoding, on-the-fly image resize) or origins that fall over under thundering herds. It bills per request — do the math first." },
    { id: "alb", x: 590, y: 110, w: 130, h: 44, color: "green", label: "ALB origin", sub: "dynamic /api/*",
      info: "A custom origin for dynamic content, matched by a cache behavior on the path pattern. Even with TTL 0, CloudFront still helps: persistent backbone connections, TLS offload, and collapsed concurrent requests. Lock it down so only CloudFront can reach it — VPC origins or a custom header the ALB rule requires." },
    { id: "s3", x: 590, y: 240, w: 130, h: 44, color: "green", label: "S3 origin", sub: "static /assets/*",
      info: "The static half of the classic split: S3 serves the bytes, CloudFront serves the world. The bucket stays fully private — no website hosting, no public access — because CloudFront authenticates to it with OAC. Cache-Control metadata set at upload time is what drives downstream TTLs." },
    { id: "oac", x: 590, y: 330, w: 130, h: 40, color: "yellow", label: "OAC", sub: "signed origin fetches",
      info: "Origin Access Control: CloudFront signs its S3 fetches with SigV4, and the bucket policy allows only the CloudFront service principal scoped to your distribution ARN. Result: the ONLY road to the bucket runs through your distribution. It replaced legacy OAI — supports SSE-KMS and all regions." }
  ],
  edges: [
    { from: "viewer", to: "edge", label: "GET /assets/app.js" },
    { from: "edge", to: "recache", label: "on miss" },
    { from: "recache", to: "alb", label: "/api/*" },
    { from: "recache", to: "s3", label: "/assets/*" },
    { from: "shield", to: "recache", dashed: true, label: "optional hop" },
    { from: "oac", to: "s3", dashed: true, label: "signs fetch" }
  ],
  flows: [
    { title: "Cache hit at the edge", steps: [
      { lit: ["viewer", "viewer->edge"], text: "The viewer requests /assets/app.js. DNS already routed them to the closest edge; TLS terminates right there." },
      { lit: ["edge"], text: "The edge builds the cache key from the cache policy — path plus whatever headers/query strings you opted in — and finds a fresh copy. <strong>Hit.</strong>" },
      { lit: ["viewer"], text: "Response served in ~1-10 ms from memory at the PoP. The origin was never contacted: <strong>zero origin load, zero origin data-transfer cost</strong>. A high hit ratio is simultaneously a latency, availability, and cost win — one metric, three benefits." }
    ]},
    { title: "Miss: through the layers to origin", steps: [
      { lit: ["viewer->edge", "edge"], text: "Same request, but this edge has never seen the object (or its TTL expired). Instead of going straight to your origin, the miss escalates inward." },
      { lit: ["edge->recache", "recache"], text: "The regional edge cache — shared by many edges, bigger and longer-lived — gets checked next. Frequently the object is here from another edge's earlier miss, and the origin is spared again." },
      { lit: ["recache->s3", "s3", "oac"], text: "True miss: CloudFront fetches from S3 over the AWS backbone, the request signed via OAC so the private bucket accepts it. If Origin Shield were enabled, one more collapsing layer would sit in this path." },
      { lit: ["recache", "edge", "viewer"], text: "The response is cached on the way back per <strong>Cache-Control</strong> from the origin, bounded by the cache policy's min/default/max TTL. Get the origin to state its own freshness — origin-driven TTLs beat console-set defaults you'll forget about." }
    ]},
    { title: "Invalidation vs versioned URLs", steps: [
      { lit: ["edge", "recache"], text: "You shipped a new app.js but edges worldwide hold the old one for another 24h of TTL. Two ways out of this." },
      { lit: ["edge"], text: "Option A: invalidation. A control-plane request that walks every edge marking /assets/* stale. It takes minutes to propagate, costs money past the first 1,000 paths/month, and becomes a deploy-time dependency — a step that can fail." },
      { lit: ["viewer", "viewer->edge"], text: "Option B: ship /assets/v2/app.js (or a content-hash filename) and reference it from your HTML. A new URL is a new cache key — <strong>the old object doesn't need purging; it simply stops being asked for</strong>." },
      { lit: ["s3"], text: "Versioned URLs cost nothing, take effect atomically with the HTML that references them, and make rollback trivial (point back at v1, still cached). Invalidations are for mistakes and legal takedowns — not for routine deploys." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "r53-policies",
  moduleId: "route53",
  title: "Routing policies at a glance",
  sub: "One DNS question, five different answers. Route 53 decides per-query — click each policy for when it earns its keep.",
  w: 760, h: 420,
  nodes: [
    { id: "user", x: 20, y: 190, w: 130, h: 44, color: "blue", label: "Resolver", sub: "user's DNS query",
      info: "The user's recursive resolver asks for app.example.com. Everything Route 53 does is per-QUERY, not per-user — and answers get cached downstream for the record's TTL. Low TTLs (30-60s) are the price of fast traffic shifts; remember some resolvers ignore your TTL anyway." },
    { id: "r53", x: 200, y: 187, w: 140, h: 50, color: "orange", label: "Route 53", sub: "auth. DNS, 100% SLA",
      info: "The authoritative nameservers evaluate the routing policy on the record set and return an answer. Policies can nest via alias records into each other — failover inside latency inside weighted — building decision trees. Crucially the answering path is the data plane: globally distributed, designed to keep answering even when control planes are down." },
    { id: "weighted", x: 590, y: 20, w: 150, h: 40, color: "green", label: "Weighted", sub: "traffic dial 0-255",
      info: "Multiple records for the same name, each with a weight; answers are dealt out proportionally. The canary primitive: 90/10, watch errors, turn the dial. Weight 0 is a valid setting — it's how you park a record ready for instant reactivation." },
    { id: "latency", x: 590, y: 95, w: 150, h: 40, color: "green", label: "Latency-based", sub: "fastest region wins",
      info: "Route 53 answers with the region that has the lowest measured network latency from the resolver's vantage point — measured, not geographic distance. The default choice for active-active multi-region APIs. Pair every record with a health check so a sick region drops out of the draw." },
    { id: "primary", x: 590, y: 170, w: 150, h: 40, color: "green", label: "Failover primary", sub: "serves while healthy",
      info: "Active-passive: this record is the only answer given while its associated health check passes. The moment the check fails, Route 53 stops returning it. Total failover time = health check detection (~30-90s) plus the record TTL still cached downstream — budget both." },
    { id: "secondary", x: 590, y: 245, w: 150, h: 40, color: "yellow", label: "Failover second.", sub: "DR site / static page",
      info: "Answered only when the primary's health check fails. Often an alias to a pre-staged DR stack in another region — or, at minimum, an S3-hosted static 'we know, we're on it' page, which is vastly better than a connection timeout. It should exist and be tested BEFORE the bad day." },
    { id: "geo", x: 590, y: 320, w: 150, h: 40, color: "green", label: "Geolocation", sub: "pin by user country",
      info: "Answers based on where the query comes FROM — country, continent, or US state — regardless of what's fastest. This is a compliance and content-rights tool: EU users to EU infrastructure, full stop. Always define a default record for locations you didn't map, or they get NXDOMAIN." },
    { id: "hc", x: 390, y: 265, w: 140, h: 40, color: "red", label: "Health check", sub: "data plane verdict",
      info: "A fleet of checkers across regions probes your endpoint; the aggregate healthy/unhealthy verdict feeds the routing decision. Evaluation happens inside the DNS data plane — no API call, no Lambda, no human required at failover time. Check a real dependency-touching path like /health, not just TCP 443." }
  ],
  edges: [
    { from: "user", to: "r53", label: "app.example.com?" },
    { from: "r53", to: "weighted", label: "90 / 10" },
    { from: "r53", to: "latency" },
    { from: "r53", to: "primary", label: "healthy" },
    { from: "r53", to: "secondary", dashed: true, label: "on failure" },
    { from: "r53", to: "geo" },
    { from: "hc", to: "primary", dashed: true, label: "monitors" }
  ],
  flows: [
    { title: "Weighted 90/10 canary", steps: [
      { lit: ["user", "user->r53"], text: "You're shipping v2 behind the same hostname. Two weighted records point at the old and new stacks, weights 90 and 10." },
      { lit: ["r53", "r53->weighted", "weighted"], text: "Per query, Route 53 deals answers proportionally — roughly one resolver in ten is told the v2 address. Note the unit is <strong>resolvers, not users</strong>: one busy corporate resolver caching the answer drags thousands of users with it, so the split is approximate." },
      { lit: ["weighted"], text: "Error rates stay flat, so you walk the dial: 25/75, 50/50, 100/0. Rollback is setting the v2 weight to 0 — no deploy, no infra change, effective within a TTL. This is why canary records carry 60-second TTLs." }
    ]},
    { title: "Failover: promoted by the data plane", steps: [
      { lit: ["hc", "hc->primary", "primary"], text: "The primary region's /health starts failing dependency checks. Checkers in multiple regions agree, and after the configured failure threshold the health check flips to unhealthy." },
      { lit: ["r53", "r53->secondary", "secondary"], text: "Route 53 simply stops answering with the primary and starts answering with the secondary. <strong>No API call, no runbook, no console access needed</strong> — the decision is data-plane, which matters precisely because regional outages love to take control planes down with them." },
      { lit: ["user", "secondary"], text: "New queries land on the DR stack. Users holding cached answers keep hitting the dead primary until TTL expiry — the reason failover records run low TTLs. End-to-end budget: detection interval + threshold + TTL, typically 1-3 minutes." },
      { lit: ["primary"], text: "When the primary's check passes again, traffic returns automatically. Decide deliberately whether you WANT auto-failback — a flapping health check can whipsaw users between stacks. Sometimes the right move is a manual weight change after the incident review." }
    ]},
    { title: "Latency vs geolocation", steps: [
      { lit: ["r53", "r53->latency", "latency"], text: "Latency-based answers whatever is <strong>fastest from the resolver's network position</strong>. A user in Vienna might get us-east-1 if that path genuinely measures quicker. Right answer for performance-first, regulation-free workloads." },
      { lit: ["r53->geo", "geo"], text: "Geolocation answers based on <strong>where the user is</strong>, full stop. The Vienna user gets eu-central-1 even if it's momentarily slower, because GDPR data-residency was the requirement — this is compliance pinning, not an optimization." },
      { lit: ["latency", "geo"], text: "Exam tell: 'lowest latency for global users' means latency-based; 'EU users must be served from EU' or country-specific content means geolocation. Needing both? Geolocation at the top level, latency-nested aliases inside each region group." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "dms-cdc",
  moduleId: "migration",
  title: "Minimal-downtime database migration",
  sub: "Oracle on-prem to Aurora PostgreSQL with SCT + DMS: convert the schema, bulk-load, let CDC chase the delta, cut over in minutes.",
  w: 780, h: 440,
  nodes: [
    { id: "onprem", x: 20, y: 40, w: 220, h: 250, zone: true, label: "On-premises DC" },
    { id: "oracle", x: 45, y: 95, w: 170, h: 46, color: "blue", label: "Oracle (source)", sub: "redo logs = CDC feed",
      info: "The production database, still fully live during migration. DMS reads changes from the redo logs (Oracle LogMiner or Binary Reader), so supplemental logging must be enabled and the logs retained long enough to cover any replication lag. Full-load reads add real I/O — schedule the bulk phase off-peak." },
    { id: "app", x: 45, y: 205, w: 170, h: 44, color: "green", label: "App (still writes)", sub: "zero changes yet",
      info: "The application keeps reading and writing Oracle throughout schema conversion, full load, and CDC catch-up — that's the entire point of this architecture. Its only change comes at cutover: a connection string (ideally an internal DNS name so the flip is a record update, not a redeploy)." },
    { id: "sct", x: 300, y: 50, w: 130, h: 44, color: "yellow", label: "AWS SCT", sub: "schema converter",
      info: "Schema Conversion Tool: converts Oracle DDL — tables, types, indexes, constraints — to PostgreSQL and applies it to the target. Its assessment report is the honest scoping document: it marks every object it can convert automatically and every one it can't. Run it FIRST; the report sizes the whole project." },
    { id: "dms", x: 300, y: 150, w: 140, h: 50, color: "orange", label: "DMS instance", sub: "replication engine",
      info: "The replication instance runs the migration task: full load, CDC, or full-load-plus-CDC (the minimal-downtime mode). Size it for the bulk phase — undersized instances silently stretch full load from hours into days. It moves data only; schema objects beyond basic tables are SCT's job." },
    { id: "fullload", x: 500, y: 100, w: 130, h: 40, color: "green", label: "Full load", sub: "parallel table copy",
      info: "Bulk copy of existing rows, tables in parallel. Changes committed on the source DURING the load are captured and buffered, then applied afterward — the source is never frozen for this phase. Drop or defer target-side secondary indexes and FKs until the load finishes; row-by-row index maintenance murders throughput." },
    { id: "cdc", x: 500, y: 190, w: 130, h: 40, color: "green", label: "CDC stream", sub: "ongoing replication",
      info: "Change data capture tails the source redo logs and replays committed transactions onto the target, continuously. The metric that runs the project is CDC latency — source-to-target lag — which must trend to near-zero before anyone says the word cutover. It runs for days or weeks; nobody is rushed." },
    { id: "aurora", x: 640, y: 145, w: 130, h: 50, color: "blue", label: "Aurora Postgres", sub: "the target",
      info: "The target cluster, receiving the SCT-converted schema, then the full load, then the CDC stream. Until cutover it's effectively a warm replica — which makes it the perfect place to run load tests and integration tests against real, current data without touching production." },
    { id: "validate", x: 470, y: 330, w: 140, h: 44, color: "yellow", label: "Validation", sub: "row-level compare",
      info: "DMS data validation compares source and target row-by-row, continuously, and reports mismatches per table. LOB truncation, character-set drift, and type-mapping edge cases hide here. Green validation plus near-zero CDC lag are the two numbers that gate the go/no-go call — gut feeling is not a migration control." },
    { id: "cutover", x: 640, y: 330, w: 130, h: 44, color: "red", label: "Cutover / DNS", sub: "the 5-minute window",
      info: "The only downtime in the whole project: freeze writes, let CDC drain to zero lag, flip the app's DB endpoint (a DNS record update if you planned ahead), verify, unfreeze. Minutes, not hours — and it's rehearsable, because until the flip nothing about production has changed." }
  ],
  edges: [
    { from: "oracle", to: "sct", label: "DDL" },
    { from: "sct", to: "aurora", label: "converted schema" },
    { from: "oracle", to: "dms", label: "reads + redo logs" },
    { from: "dms", to: "fullload" },
    { from: "dms", to: "cdc" },
    { from: "fullload", to: "aurora" },
    { from: "cdc", to: "aurora" },
    { from: "dms", to: "validate", dashed: true, label: "compare" },
    { from: "cutover", to: "aurora", dashed: true, label: "flip endpoint" }
  ],
  flows: [
    { title: "Schema conversion with SCT", steps: [
      { lit: ["oracle", "oracle->sct", "sct"], text: "SCT connects to Oracle, reads the full DDL, and produces an assessment report before converting anything. That report — percent auto-convertible, per-object complexity — is what you take into the planning meeting." },
      { lit: ["sct", "sct->aurora", "aurora"], text: "Tables, types, indexes, and constraints convert cleanly and are applied to Aurora. What does NOT auto-convert: <strong>PL/SQL edge cases</strong> — packages, autonomous transactions, CONNECT BY hierarchies, Oracle-specific built-ins. Each is flagged for a human." },
      { lit: ["sct"], text: "Those flagged items are the real cost of a heterogeneous migration: hand-porting to PL/pgSQL, or better, pulling the logic out of the database into the app. Budget engineering weeks by the report's complexity ratings — the data copy is the easy half of this project." }
    ]},
    { title: "Full load + CDC chase the delta", steps: [
      { lit: ["oracle", "oracle->dms", "dms"], text: "The DMS task starts in full-load-plus-CDC mode. From the very first second it is also capturing ongoing changes from the redo logs — nothing that happens during the bulk copy will be lost." },
      { lit: ["dms->fullload", "fullload", "fullload->aurora"], text: "Existing rows bulk-copy to Aurora, tables in parallel, while the app writes to Oracle undisturbed. Changes committed mid-copy are buffered on the replication instance for later replay." },
      { lit: ["dms->cdc", "cdc", "cdc->aurora"], text: "Full load done, CDC applies the buffered backlog and then streams live changes continuously. Watch <strong>CDC latency</strong> trend toward zero — seconds of lag means the target is breathing in sync with production." },
      { lit: ["dms->validate", "validate", "aurora"], text: "With the target current, validation runs row-level compares and the team points test suites and load tests at Aurora. It can hold this state for weeks — <strong>there is no countdown clock</strong>, which is exactly what makes the eventual cutover boring." }
    ]},
    { title: "Cutover — and the rollback parachute", steps: [
      { lit: ["app", "oracle"], text: "The window opens: the app enters a brief write freeze (maintenance mode or connection drain). Reads can continue; the freeze exists only so no new change can miss the boat." },
      { lit: ["cdc", "cdc->aurora"], text: "With writes stopped, CDC drains the last in-flight transactions and lag hits exactly zero. Validation confirms the final row counts match. Oracle and Aurora are now byte-for-byte peers." },
      { lit: ["cutover", "cutover->aurora", "app"], text: "Flip the app's database endpoint — the DNS record you set up for precisely this moment — and unfreeze. Total downtime: the minutes it took to drain and verify, not the days the data actually took to move." },
      { lit: ["aurora", "oracle"], text: "Keep the parachute: a second DMS task now replicates <strong>Aurora back to Oracle</strong>. If a showstopper surfaces on day two, you flip back without losing the writes made since cutover. Decommission Oracle only after the new stack has survived real load — a week, minimum." }
    ]}
  ]
});
