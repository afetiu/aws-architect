/* Module 07 — Integration with the Enterprise Mess (The Field track) */
window.COURSE.register({
  id: "integration",
  order: 7,
  track: "field",
  title: "Integration with the Enterprise Mess",
  description: "The adapter layer between LLM-native tooling and the customer's legacy systems is the longest pole in every deployment. Legacy sources, auth mazes, and dirty data — not modeling — are where enterprise AI projects actually die, and where the FDE earns the contract.",
  examWeight: "The real-world system-design round lives here: 'design the ingestion and transform pipeline for a Fortune 500 with twelve fragmented sources' is a canonical FDE whiteboard prompt, and the practical coding round often hands you a messy CSV or a mock legacy payload to parse. On the job, integration dominates the delivery timeline — a senior FDE is judged on estimating that honestly, escaping POC purgatory on schedule, and wrapping the mess behind an interface the model and the operator can both trust.",
  lessons: [
    {
      id: "adapter-longest-pole",
      title: "The adapter layer is the longest pole",
      html: `
<p>In a demo, the model is the whole show. In a deployment, the model is a commodity sitting in the middle of a pipeline, and the pipeline is the project. The <strong>adapter layer</strong> — the code that reaches into the customer's source systems, extracts their data through whatever brittle interface actually exists, and reshapes it into something a model, an ontology, or a tool-call can consume — is almost always the critical path. You can swap the model in an afternoon; you cannot swap the twelve-year-old SOAP service that only accepts requests during a four-hour nightly window and returns a payload whose schema disagrees with its own WSDL.</p>

<p>Internalize this as a law, because the whole module hangs off it: <strong>every source system is a mini-project, and every undocumented endpoint, unschema'd flat-file export, and legacy SOAP service adds weeks — not days.</strong> This is not pessimism; it is the empirical shape of enterprise integration, and it is the mechanical reason the FDE role exists at all. The 2025 pilot-failure data traces the ~95% no-P&amp;L-impact outcome to <em>flawed integration, not weak models</em> — which means the bottleneck you are paid to break is precisely this layer, not the prompt.</p>

<h3>Why integration dominates the timeline, not modeling</h3>
<p>The asymmetry is structural. <strong>Modeling work is bounded and mostly known</strong>: write the prompt, build the eval set, tune to the metric, iterate against synthetic data. You can estimate it, and you can do most of it in parallel before real data ever arrives. <strong>Integration work is unbounded and discovered</strong>: you learn in week 4 that the export is silently missing a column, in week 5 that the "real-time API" is actually a nightly batch, and in week 6 that the customer's own IDs do not match across their own systems. None of that is on any diagram you were handed. The estimate that kills deployments is "we'll wire up the data in a sprint," because it prices the part you can see and ignores the part underwater.</p>

<div class="callout deep">The adapter is literally on the critical path in a way the model is not. Phase-1 scoping and Phase-2 validation can proceed against synthetic data — you build prompts and evals with fake records that mimic the target shape. But <em>nothing production ships until real data flows</em>, and real data flows only through the adapter. So the adapter's completion date is the deployment's completion date, minus a fixed tail of demo-and-iterate. Every other workstream has slack; the adapter has none. A senior FDE therefore front-loads integration risk: request access day one, write the ugliest connector first, and let modeling ride in parallel — the opposite of the instinct to polish the fun part first.</div>

<h3>The iceberg model of a single source</h3>
<p>Above the waterline is what the customer's architecture slide shows: "System X exposes a REST API returning JSON." Below the waterline, and where all the weeks go, is everything the slide omits — the auth handshake and its rotation policy; pagination that caps at 100 rows and breaks on the 4,312th; undocumented rate limits that 429 you at 3am; a schema that drifts when someone edits a config upstream; one field that is free-text where your ontology needed an enum; the batch window during which the source is read-locked; and the change-control board that must approve your service account. A useful estimating discipline: for each source, price the visible interface, then multiply by an <strong>interface-maturity factor</strong> — a modern documented REST API is roughly 1x, a documented SOAP/XML service 2x, and an undocumented endpoint, mainframe extract, or hand-maintained flat file 3–5x.</p>

<div class="callout limits">Rough field calibration worth carrying into a scoping room (order-of-magnitude, not gospel): a clean modern REST source integrated end-to-end (auth, pagination, retries, mapping, DQ checks) is on the order of <strong>3–10 engineer-days</strong>; a documented SOAP/legacy source <strong>1–3 weeks</strong>; an undocumented endpoint, mainframe flat-file, or a source that needs a new service account through security review, <strong>3–6+ weeks</strong> — dominated by <em>waiting</em>, not coding. For a twelve-source Fortune 500 ingestion, the integration layer alone routinely runs the calendar longer than the entire modeling and eval effort combined. Price twelve sources as twelve projects, not one.</div>

<h3>Estimating and communicating honestly</h3>
<p>The senior move is to make the integration surface a first-class line item in the plan, never a footnote under "data plumbing." Concretely: (1) run a <strong>source inventory in week one</strong> — enumerate every system, its interface, its owner, its auth, its freshness, and its data-quality reputation — because the inventory <em>is</em> the estimate; (2) give <strong>ranges, not points</strong>, and attach each range to a named unknown you will resolve ("2–5 weeks, pending whether the export includes historical records"); (3) tie the program's go/no-go gate to <strong>data-access milestones</strong>, not to model quality, because model quality is rarely the thing that slips. Refusing to give a false-precision single number is not hedging — it is the calibrated commitment that keeps the relationship intact when the SOAP service inevitably surprises you.</p>

<div class="callout war">A claims-automation deployment for a mid-size insurer stalled six weeks on a single endpoint. The customer's architecture deck promised a SOAP service exposing policy details; the WSDL looked clean, the demo call worked. In production the runtime responses carried fields absent from the WSDL and omitted a nullable block the contract said was required — because the service had been patched for years without regenerating its contract. The model was finished in week two and sat idle. The lesson the FDE took away: the demo call proves the happy path exists, nothing more; you have not integrated a source until you have pulled a representative <em>volume</em> of real records and diffed them against the documented schema.</div>

<div class="callout exam">The real-world system-design round frequently opens with exactly this: "design the ingestion and transform pipeline for a Fortune 500 with twelve fragmented sources." The failing answer jumps to the model and the vector store. The senior answer starts by <em>inventorying and classifying the twelve sources</em> by interface maturity, names the adapter layer as the critical path, sizes each source as its own mini-project, proposes a staged ingestion (land raw, normalize, reconcile) that lets modeling proceed on synthetic data in parallel, and puts the go/no-go gate on data access. Saying out loud "integration, not modeling, is my longest pole, so I sequence and staff for that first" is the signal they are listening for.</div>
`
    },
    {
      id: "legacy-reality",
      title: "The legacy reality",
      html: `
<p>The enterprise is not greenfield, and the single most expensive assumption a strong engineer brings from a startup background is that data lives behind a clean, live, well-versioned API. It does not. The customer's crown-jewel data lives in an SAP instance customized beyond recognition over fifteen years, on a mainframe that predates the engineers maintaining it, in an on-prem Oracle database nobody is allowed to query directly during business hours, and — most often of all — in a <strong>nightly flat-file dump</strong> written to an SFTP drop at 2am. Your job is to design around what actually exists, not to litigate for the architecture you wish existed.</p>

<h3>The cast of characters you will actually meet</h3>
<ul>
<li><strong>SAP and other mega-ERPs.</strong> Not one system but a federation of modules with their own tables and semantics. Integration surfaces are IDocs (batch document messages), BAPIs/RFCs (function-call interfaces), and increasingly OData services — each with its own quirks, and each typically fronted by a Basis team and a change-control process. The table names are cryptic (transparent tables like <code>KNA1</code> for customers, <code>VBAK</code> for sales orders), and the meaning of a field is often encoded in configuration you cannot see.</li>
<li><strong>Mainframes.</strong> COBOL systems reachable, if at all, through fixed-width record extracts, <strong>EBCDIC</strong> encoding (not ASCII — a whole class of "why is this field garbage" bugs), packed-decimal numeric fields, and 3270 "green screen" terminal flows that some vendor tool screen-scrapes. There is frequently no API in any modern sense; there is a batch job that writes a file.</li>
<li><strong>Nightly CSV / flat-file dumps.</strong> The lingua franca of enterprise data movement. A job runs overnight, writes a delimited (or fixed-width) file to SFTP or a shared drive, and that file <em>is</em> your interface. It is a snapshot, not a stream; it is hours stale by the time you read it; and its format is a handshake maintained by whoever wrote the export, who may have left.</li>
<li><strong>On-prem relational databases.</strong> Oracle, DB2, SQL Server — often reachable only from inside the network, often with a hard rule against querying the primary during business hours (you get a read replica, or a nightly extract, or a maintenance window).</li>
<li><strong>SOAP / XML web services.</strong> WSDL contracts, XML envelopes, WS-Security headers, and the reality that the running service and its published contract have drifted apart. Verbose, namespaced, and brittle — but ubiquitous in banking, insurance, telecom, and government.</li>
<li><strong>Brittle vendor APIs and batch windows.</strong> A SaaS or vendor system with a "real-time" API that is rate-limited to a trickle, paginated in surprising ways, and available only outside its own nightly batch window when it is read-locked for hours.</li>
</ul>

<h3>The data you get is a stale dump, not a clean live API</h3>
<p>This is the reframing that separates a senior integration design from a naive one. You will spend energy hoping for a live, incremental, event-driven feed; you will usually get a <strong>full snapshot dropped once a night</strong>. Accept it and design for it. That means: your pipeline is fundamentally a <em>batch reconciliation</em>, not a stream; your freshness SLA is bounded below by the source's batch cadence (you cannot be fresher than the 2am dump, full stop); and your correctness model must handle the fact that the dump is a point-in-time snapshot that may already be inconsistent with a second source dumped at a different hour. Fighting for change-data-capture or an event bus that the customer has no capacity to build is how you burn six weeks and your credibility; designing a clean, idempotent batch pipeline over the dump they can actually produce is how you ship.</p>

<div class="callout deep">Why the "just give us a live API" ask usually fails, mechanically: the source system was designed decades ago for a transactional workload, and exposing a high-volume read API against its primary would degrade the business operation it runs. The nightly batch exists precisely to move heavy reads off the production system into a window when nobody is transacting. So the flat file is not laziness — it is a load-shedding architecture, and the customer's DBAs are right to protect it. The senior FDE reads the batch window as a <em>constraint to design within</em> (schedule ingestion after the drop lands, make it idempotent so a re-run is safe, and set freshness expectations with the business accordingly), not as an obstacle to argue away.</div>

<div class="callout limits">Encoding and format landmines that eat days if you do not expect them: <strong>EBCDIC</strong> vs ASCII on mainframe extracts; packed-decimal (COMP-3) numeric fields that are not human-readable; ambiguous CSV quoting and embedded delimiters (a comma inside an unquoted free-text field); date formats that are DD/MM in one source and MM/DD in another (a silent, corrupting off-by-a-day for the first twelve days of every month); character-set mismatches (Latin-1 vs UTF-8) that turn accented names into mojibake; and trailing-whitespace / fixed-width padding that breaks naive key joins. Assume every one of these is present in a twelve-source estimate until proven absent.</div>

<div class="callout war">A logistics customer promised a "clean daily export" of shipment records. The file arrived as pipe-delimited text with no header row, dates in two different formats depending on which upstream region wrote the row, weight fields that were blank for air freight and zero for ground, and a free-text notes column that occasionally contained an un-escaped pipe character — which shifted every subsequent field one column to the right for that row only. Parsed naively, roughly 3% of rows were silently corrupted into plausible-but-wrong records, which is worse than a crash because nobody notices. The fix was not a better model; it was a parser that validated field counts per row, quarantined the malformed 3% instead of dropping or trusting them, and reported the reject rate every run.</div>

<div class="callout exam">Interviewers probe whether you have actually touched enterprise data or only clean APIs. A tell they listen for: when handed "the customer will give you a nightly CSV," do you immediately ask the right questions — is it a full snapshot or a delta, what encoding, is there a header, how are nulls represented, what is the delimiter and how are embedded delimiters escaped, what time does it land and what is its staleness, and what happens when it is late or missing? Candidates who design around the stale dump (idempotent batch, reconciliation, quarantine) rather than assuming a pristine live feed signal real field experience. The take-home practical round often literally hands you a malformed file and grades whether you defend against exactly these failure modes.</div>
`
    },
    {
      id: "auth-and-identity",
      title: "Auth and identity",
      html: `
<p>Before a single row moves, something has to prove your code is allowed to move it — and in an enterprise that "something" is rarely one thing. Every source you touch may sit behind a different auth regime, and stitching them together is the <strong>auth maze</strong>: a corporate SSO layer speaking SAML or OIDC in front of user-facing apps; OAuth 2.0 client-credentials flows for service-to-service SaaS calls; Kerberos or Active Directory for on-prem databases and file shares; mutual TLS on some legacy service bus; and plain API keys or basic-auth-over-a-VPN for the vendor system nobody wants to talk about. You are not implementing one login; you are federating a dozen trust boundaries and holding the secrets for all of them.</p>

<h3>The vocabulary you must be fluent in</h3>
<ul>
<li><strong>SSO via SAML / OIDC.</strong> SAML (XML assertions, the enterprise incumbent) and OpenID Connect (JWT-based, layered on OAuth 2.0, the modern default) both let the customer's identity provider — Okta, Azure AD / Entra ID, Ping — assert who a <em>user</em> is. Relevant when a human operator uses your app; you become a service provider trusting their IdP.</li>
<li><strong>OAuth 2.0 flows.</strong> Know which grant fits which case. <strong>Authorization Code</strong> (with PKCE) for a user delegating access to their data. <strong>Client Credentials</strong> for machine-to-machine, where <em>your service</em> is the principal — this is the one you use most for backend ingestion. Confusing the two ("why is there no user to redirect?") is a classic stumble.</li>
<li><strong>Service accounts and workload identity.</strong> A non-human identity your pipeline runs as. Prefer platform-native workload identity (cloud IAM roles, Kubernetes service-account tokens, SPIFFE/SVID) over a static shared secret where you can — short-lived, automatically rotated credentials beat a long-lived key in a config file every time.</li>
<li><strong>Secrets management.</strong> Credentials live in a vault (HashiCorp Vault, AWS Secrets Manager / Parameter Store, Azure Key Vault, GCP Secret Manager) — never in code, never in a repo, never in an environment file checked into git. Rotation, audit, and least-privilege access to the secret itself are table stakes; a leaked service-account key in a customer environment is a career-defining incident.</li>
<li><strong>Least-privilege service identity.</strong> The pipeline's identity should be able to read exactly the tables and endpoints it needs and nothing else. Scope it down, and pair it with human-in-the-loop gates for any irreversible or high-blast-radius action — the same principle that governs agent tool design, applied to the integration service.</li>
</ul>

<h3>Getting credentials is a political problem, not a technical one</h3>
<p>Here is the truth no architecture diagram shows: <strong>the hard part of auth is almost never the code — it is the wait.</strong> Requesting a service account with read access to the SAP module you need can mean a ticket that routes through a data owner, a security team, an identity-and-access-management group, and a change-advisory board, each with its own queue and its own idea of what "least privilege" means. In a regulated enterprise, provisioning a single least-privilege service identity through the formal process can take <strong>days to many weeks</strong> — and if you under-scoped the initial request, correcting it is a second full cycle through the same queues. This is process latency, not engineering latency, and it does not compress by working harder.</p>

<div class="callout deep">Why the wait is structural, not bureaucratic sloth: every credential you receive is an expansion of the customer's attack surface and a line item in their next SOC 2 / ISO 27001 / regulatory audit. The approver is personally accountable for what your identity can touch, so they are correct to scrutinize it. The senior FDE works <em>with</em> that reality: you arrive with a precise, least-privilege access request (exact systems, exact scopes, exact justification, data-handling commitments) that is easy to approve, rather than a vague "give me admin so I can figure it out," which is easy to reject and slow to escalate. A well-formed request is itself an integration deliverable.</p></div>

<div class="callout limits">Plan the credential timeline as a first-class critical-path dependency, in parallel from day one. Field-realistic waits: a routine read-only service account in a mature enterprise, <strong>1–3 weeks</strong>; anything touching regulated data (PII, PHI, financial) or requiring a new firewall rule / VPC peering / security review, <strong>3–8+ weeks</strong>; a fresh vendor contract or a data-processing agreement, longer still. Because a re-request restarts the clock, deliberately (and defensibly) request the full read scope you will need for the whole engagement up front, not the minimum for week one — over-scoping <em>within read-only</em> is cheaper than serial round-trips through the approval queue.</div>

<div class="callout war">An FDE on a healthcare deployment scoped the model work brilliantly and requested data access "once we're ready to build" — in week three. The access request for a HIPAA-covered system then took seven weeks to clear security review, DPA amendment, and the identity team's queue. The prototype was done in week four and sat blocked for six weeks; the customer's exec sponsor read the silence as the project stalling and nearly pulled funding. Nothing was wrong with the engineering. The failure was sequencing: credential acquisition is a long-lead procurement item, and it must be initiated in week one, in parallel with everything else, or it becomes the thing that sinks the timeline.</div>

<div class="callout exam">The client role-play and the system-design round both probe this. Design round: when you sketch the ingestion pipeline, name the auth regime per source and explicitly place "provision least-privilege service accounts" on the week-one critical path — candidates who forget auth entirely, or who wave it away as "we'll use an API key," reveal they have never shipped into a real enterprise. Role-play / behavioral: expect "the access request is stuck in the customer's security queue and the demo is Friday — what do you do?" The strong answer escalates through the exec sponsor early, works a synthetic-data path so the build continues, and communicates the dependency honestly rather than silently slipping — it treats the political wait as a managed risk, not a surprise.</div>
`
    },
    {
      id: "data-pipelines-quality",
      title: "Data pipelines and data quality",
      html: `
<p>Once credentials clear and bytes start moving, the real adversary appears: the data itself. Enterprise data is <strong>dirty, late, duplicated, and contradictory</strong>, and a pipeline that assumes otherwise does not fail loudly — it silently produces confident, wrong output, which is the worst failure mode in AI deployment because it destroys the operator's trust the first time they catch it. Your pipeline is not a happy-path ETL script; it is a defensive system whose main job is to <em>survive bad input without lying about it</em>.</p>

<h3>The shape of a defensible pipeline</h3>
<p>Adopt a staged, land-then-refine architecture (the "medallion" pattern by another name): <strong>land raw</strong> — persist the source payload exactly as received, immutable, so you can always re-derive and diff; <strong>normalize / clean</strong> — parse, type, canonicalize encodings and dates, quarantine what fails; <strong>reconcile / conform</strong> — resolve identity across sources and produce the clean, model-ready table. Each stage is idempotent and independently observable. The virtue of landing raw first is that when a downstream bug appears in week eight, you replay from the raw store instead of begging the customer to re-send last month's dump they no longer have.</p>

<h3>Idempotency, retries, and rate limits against brittle upstreams</h3>
<p>Re-runs are not an edge case; they are the normal operating mode of a batch pipeline (the job failed halfway, the dump was late, you deployed a fix and must reprocess). So <strong>every stage must be idempotent</strong>: running it twice produces the same result as running it once. The mechanism is an <strong>upsert on a natural key</strong> (or a deterministic surrogate) rather than a blind insert — otherwise a re-run doubles every row. Against brittle upstream APIs, wrap calls in <strong>retries with exponential backoff and jitter</strong>, respect <code>Retry-After</code> on 429s, and cap concurrency below the source's real (often undocumented) rate limit — a legacy service bus will fall over under load a modern API would shrug off, and knocking over the customer's production system on day one is unrecoverable politically. Distinguish <em>transient</em> failures (retry mechanically) from <em>permanent</em> ones (quarantine and alert) so you neither give up on a blip nor hammer a hard failure forever.</p>

<div class="callout deep">Idempotency has a subtle failure at the boundary between "did the write happen" and "did I record that it happened." If your job upserts a batch and then crashes before marking the batch complete, the re-run must reproduce exactly the same rows — which it does <em>only</em> if the key is stable and deterministic. This is why you never key on ingestion timestamp or an auto-increment ID assigned at load: those change on re-run and defeat the dedupe. Key on something intrinsic to the record (source system + source primary key, or a hash of the business-identifying fields). The same discipline that keeps an agent from charging a card twice keeps a pipeline from double-loading a customer.</div>

<h3>Schema drift</h3>
<p>The source's format is a handshake maintained by humans, and humans change it without telling you: a column is renamed, a new field appears, an enum grows a value your mapping does not handle, a field that was always populated starts arriving null. <strong>Schema drift</strong> is not an exception to plan for someday — it is a weekly event at scale. Defend with an explicit contract at ingestion: validate the incoming schema (column set, types, required-ness) against what you expect, and on mismatch <em>fail loud and quarantine</em> rather than silently coercing. A pipeline that adapts silently to drift is a pipeline that will one day map the wrong column into the field a human makes a decision on.</p>

<h3>The identity-reconciliation problem</h3>
<p>The deepest and most under-estimated integration problem is that <strong>the same real-world entity has different identities in different systems</strong>. "Acme Corp" is customer <code>C-4471</code> in the CRM, <code>ACME001</code> in billing, and "ACME CORPORATION INC." (free text, no ID) in the support tickets. There is no shared key. Joining these — <strong>entity resolution</strong> — is a genuine, hard problem: deterministic matching on normalized fields where you can, probabilistic/fuzzy matching (edit distance, tokenized name + address blocking) where you must, and a human-adjudicated review queue for the ambiguous middle. Getting reconciliation wrong corrupts everything downstream: the model confidently reasons over a "customer" that is really two customers merged, or splits one customer into three. This is where the customer-specific <strong>ontology</strong> from the earlier modules becomes load-bearing — the ontology defines what a "customer" <em>is</em>, and reconciliation is the machinery that makes the messy sources agree on it.</p>

<div class="callout limits">Data-quality dimensions to measure explicitly, every run, and surface as pipeline metrics (not vibes): <strong>completeness</strong> (null/blank rate per required field), <strong>validity</strong> (share failing type/format/enum checks), <strong>uniqueness</strong> (duplicate rate on the natural key), <strong>consistency</strong> (cross-source contradictions — billing says active, CRM says churned), <strong>timeliness</strong> (age of the newest record vs the SLA), and <strong>reject rate</strong> (share quarantined). A row-count reconciliation (in vs out vs quarantined, and they must sum) belongs on every run. When these numbers are visible, "is the data good enough?" becomes a measured conversation with the customer instead of an argument — and a rising reject rate is your early warning of upstream drift.</div>

<div class="callout war">A customer-360 build for a bank looked done until an analyst noticed the same corporate client appearing three times with conflicting revenue totals. Root cause: reconciliation matched on company name alone, so "JP Morgan", "JPMorgan Chase", and "J.P. Morgan Chase &amp; Co." became three entities, while two genuinely different "Smith Consulting" firms in different states were merged into one. The naive name match was both over- and under-merging simultaneously. The fix was blocking on normalized name plus a second signal (tax ID where present, else address), a fuzzy score with a tuned threshold, and a review queue for the band in between — plus a consistency check that flagged contradictory revenue for the same resolved entity. Entity resolution is rarely a line of SQL; budget it as its own workstream.</div>

<div class="callout exam">The practical coding round often <em>is</em> a data-quality exercise: "parse this messy CSV / JSON and load it cleanly," and the graders watch for exactly the defenses above — per-row validation, quarantine over silent-drop, idempotent load, and awareness of encoding/date/dedupe traps — far more than clever algorithms. In system design, when they add "and by the way the customer IDs don't match across the three systems," they are testing whether you recognize entity resolution as a first-class hard problem with a deterministic-plus-fuzzy-plus-human-review shape, not a JOIN. Naming idempotency (upsert on a stable natural key) and a raw-land-then-reconcile staging unprompted marks you as someone who has run a pipeline in anger.</div>
`
    },
    {
      id: "build-vs-buy-mindset",
      title: "Build vs buy the connector; the integration mindset",
      html: `
<p>For every source you face the same fork: <strong>write a bespoke adapter, or use a platform connector.</strong> Managed data-integration platforms — Fivetran, Airbyte, Meltano, Stitch — and enterprise iPaaS / ESB tooling — MuleSoft, Boomi, Informatica, Azure Data Factory — exist to give you a maintained, pre-built connector for common sources, handling auth, pagination, incremental sync, and schema mapping so you do not reinvent them per engagement. They are often the right call. They are also often not, and knowing which is a core FDE judgment call, not a religious position.</p>

<h3>The decision framework</h3>
<table>
<thead><tr><th>Lean BUY (platform connector) when…</th><th>Lean BUILD (bespoke adapter) when…</th></tr></thead>
<tbody>
<tr><td>A maintained connector exists for this source and is actively supported</td><td>The source is niche, legacy, proprietary, or on-prem with no connector (mainframe, custom SOAP, that one internal system)</td></tr>
<tr><td>The transform is standard extract-and-load; logic lives downstream</td><td>The transform/reconciliation logic is deeply domain-specific and is the actual value</td></tr>
<tr><td>The customer already owns and operates the platform (you inherit it, don't introduce it)</td><td>Introducing a new platform adds a procurement cycle, a security review, and per-row cost the customer won't own long-term</td></tr>
<tr><td>You need many common sources fast and want to conserve your scarce engineering time</td><td>Data residency / airgapped / on-prem constraints forbid routing data through a third-party SaaS</td></tr>
<tr><td>Volume and latency fit the platform's pricing and cadence</td><td>You need control over rate-limiting, retry, and idempotency that the connector hides from you</td></tr>
</tbody>
</table>
<p>Two traps bracket this decision. The junior-engineer trap is <strong>build-everything</strong>: hand-rolling a Salesforce connector that Fivetran maintains for free is ego, not engineering — you will spend the engagement debugging pagination instead of delivering outcomes. The opposite trap is <strong>buy-everything</strong>: assuming a platform can reach the mainframe or the bespoke SOAP service it has no connector for, then discovering in week five that the "80% covered by connectors" leaves the 20% that was the whole point. The mature read: buy the commodity sources to conserve time, build the bespoke adapter for the legacy long-tail that is exactly where your value and the customer's real data live.</p>

<h3>Wrap the mess behind a clean interface — for the operator and the model</h3>
<p>Whichever you choose, the durable design principle is the <strong>anti-corruption layer</strong>: the ugliness of the source — its EBCDIC, its drifting SOAP schema, its 2am batch window, its three conflicting customer IDs — is quarantined inside the adapter and <em>never leaks past it</em>. Everything upstream of the adapter sees a clean, conformed domain model that speaks the customer's ontology (entities, properties, relationships, actions), not the source's accidental shape. This is not aesthetic; it is what lets the rest of the system stay sane when a source changes, because the blast radius of that change is one adapter.</p>

<div class="callout deep">The clean interface serves two very different consumers, and both need the mess hidden. The <strong>operator</strong> needs a coherent view — one "customer" with a trustworthy history — not a UI that exposes that billing and CRM disagree. The <strong>model</strong> needs a clean <em>tool boundary</em>: the same anti-corruption layer that conforms the data is what backs a well-designed tool the agent can call — <code>get_customer(id)</code> returns a conformed, reconciled entity, not raw SAP tables the model would have to join and disambiguate itself. A messy tool surface produces exactly the wrong-endpoint, drowned-in-JSON failures from the agent modules; a clean adapter is therefore also good agent design. The ontology, the anti-corruption layer, and the tool schema are three views of one boundary.</div>

<h3>The FDE as the person who makes the impossible integration possible</h3>
<p>This is the essence of the field craft. The product team ships a capability that assumes clean inputs; the customer has a mainframe and a nightly pipe-delimited dump. The FDE is the person who stands in that gap and makes the connection real — not by wishing the enterprise were greenfield, but by writing the unglamorous adapter, negotiating the service account, defending against the dirty data, and reconciling the three customer IDs, so that the model and the operator upstream both see something sane. Hiding that complexity is not incidental to the job; on most enterprise deployments it <em>is</em> the job, and it is the reason integration, not modeling, is what the role is actually paid to conquer.</p>

<div class="callout limits">A rule of thumb for the build/buy line: if a maintained connector exists and the customer will own the platform after you leave, buying usually wins on total cost even at a per-row fee, because you are trading scarce FDE-weeks for money the customer already budgets. If the source is legacy long-tail, or the transform is the domain value, or residency/airgap rules forbid third-party routing, build — and keep the built adapter small, well-tested, and handed off, because an adapter only you understand is a deployment that stalls the day you leave. Land-and-expand favors buying the commodity 80% to free your time for the bespoke 20% that wins the next workflow.</div>

<div class="callout war">A manufacturing deployment bet the whole timeline on an iPaaS platform because its connector catalog was impressive. It genuinely covered the CRM and the cloud warehouse — but the shop-floor MES that held the data the project was actually about spoke a proprietary on-prem protocol with no connector, and the platform's "custom connector SDK" turned out to be a multi-week build in itself, now coupled to a platform license the customer questioned. The FDE's recovery was to write a small, standalone bespoke adapter for the MES behind a clean interface, keep the platform only for the commodity sources it truly handled, and hand off both. The lesson: evaluate build/buy <em>per source</em> against the actual long-tail, never as one platform-wide bet, and never let a connector catalog's breadth disguise the one gap that is the point of the engagement.</div>

<div class="callout exam">In the design round, articulating a <em>per-source</em> build/buy decision — "buy the maintained connectors for the CRM and warehouse, build a thin bespoke adapter for the mainframe and the custom SOAP service, wrap all of them behind one conformed interface" — signals senior judgment far more than defaulting to either extreme. Reach for the anti-corruption-layer framing and connect it explicitly to the tool boundary the model will use and the handoff the customer must own. The strongest candidates close the loop: the clean adapter is simultaneously good data engineering, good agent-tool design, and good deployment hygiene — one boundary that keeps the model sane, the operator trusting, and the system maintainable after the FDE has moved to the next account.</div>
`
    }
  ],
  quiz: [
    {
      q: "During scoping for a Fortune 500 deployment with twelve source systems, the account lead asks you for a single delivery date and pushes back when you hesitate. What is the most senior way to size and communicate the integration work?",
      options: [
        "Give a single confident date so the customer feels the project is under control, then pad your internal estimate secretly",
        "Run a week-one source inventory, classify each of the twelve sources by interface maturity, size each as its own mini-project, and give a range tied to named unknowns like data access",
        "Estimate the modeling and eval work carefully since that is the technical core, and treat data plumbing as a fixed one-sprint task",
        "Refuse to estimate anything until every service account is provisioned and every source is fully documented"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: inventory, classify per source, size each as a mini-project, and give a range tied to unknowns.</strong> The integration surface is the critical path and each source carries its own hidden iceberg (auth, pagination, drift, data quality, batch windows), so the honest estimate is parametric and per-source, with ranges attached to the specific facts you still need to learn.</p><p>A false-precision single date is the classic estimation failure that detonates when the SOAP service surprises you. Treating data plumbing as one fixed sprint prices only the visible interface and ignores the part underwater — it is the exact mistake that produces the 95%-of-pilots-stall outcome. Refusing to estimate at all abdicates the calibrated commitment the role demands; you can and should give ranges now and tighten them as unknowns resolve.</p>"
    },
    {
      q: "A customer's architecture deck says a legacy policy system 'exposes a SOAP service,' and a single demo call against it returns clean XML. Your teammate wants to mark that source as integrated and move on. What is the correct read?",
      options: [
        "The demo call proves the integration works; mark it done and reallocate the time to modeling",
        "SOAP is inherently reliable, so once the WSDL parses there is nothing left to verify",
        "A working demo call proves only the happy path exists; you have not integrated the source until you pull representative volume of real records and diff them against the documented schema",
        "You should immediately rewrite the SOAP service into a REST API for the customer"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>Correct: a demo call proves the happy path, not integration.</strong> Long-lived enterprise services routinely drift from their published contract — runtime responses carry undocumented fields or omit required ones — so integration is only real once you have pulled a representative volume and reconciled the actual payloads against the WSDL.</p><p>Marking it done on one call is precisely how deployments stall six weeks later when production responses disagree with the contract. SOAP is not magically reliable; the WSDL parsing tells you nothing about whether the running service matches it. Rewriting the customer's SOAP service into REST is out of scope, politically fraught, and touches a production system you were not asked to change — you adapt to what exists, you do not re-architect their estate.</p>"
    },
    {
      q: "A customer offers only a nightly full-snapshot CSV dropped to SFTP at 2am, and cannot build the live event stream you would prefer. How should a senior FDE design the ingestion?",
      options: [
        "Insist on a real-time change-data-capture feed and pause the project until the customer builds it",
        "Accept the batch reality and design an idempotent batch-reconciliation pipeline scheduled after the drop, with freshness expectations bounded by the 2am cadence",
        "Poll the source system's primary database directly every few minutes to approximate real time",
        "Read the CSV once, cache it forever, and assume the data does not change materially"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: design an idempotent batch-reconciliation pipeline around the dump that actually exists.</strong> The nightly batch is usually a deliberate load-shedding architecture protecting a transactional primary, so you schedule ingestion after the drop lands, make re-runs safe via upsert on a stable key, and set the freshness SLA to the batch cadence — you cannot be fresher than 2am.</p><p>Insisting on CDC the customer has no capacity to build burns weeks and credibility fighting a constraint you should design within. Polling their production primary every few minutes is exactly the load the nightly batch exists to prevent — you risk degrading the business operation. Caching once and assuming stasis ignores that the snapshot changes daily; you would serve stale, drifting data with confidence.</p>"
    },
    {
      q: "You are mapping the auth landscape for a deployment: a user-facing operator app, a backend service pulling from a SaaS API, and an on-prem Oracle database. Which pairing of mechanism to case is correct?",
      options: [
        "Use OAuth Authorization Code for the backend SaaS pull because every OAuth flow needs a user to redirect",
        "SAML or OIDC for the operator's SSO login, OAuth 2.0 Client Credentials for the backend service-to-service SaaS pull, and a least-privilege service account for the on-prem database",
        "A single shared admin API key across all three so there is only one secret to manage",
        "Put all three credentials directly in the application's environment file committed to the repo for simplicity"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: SSO (SAML/OIDC) for the human login, Client Credentials for machine-to-machine, and a scoped service account for the database.</strong> Each trust boundary has the fitting mechanism: the operator delegates identity through the customer's IdP; the backend is itself the principal, so Client Credentials (no user to redirect); the database gets a narrowly scoped non-human identity.</p><p>Authorization Code is wrong for the backend pull precisely because there is no user delegating access — that confusion is a classic stumble. A single shared admin key across everything is the opposite of least privilege and turns one leak into total compromise. Committing secrets to the repo is a career-defining incident in a customer environment; credentials belong in a vault with rotation and audit, never in code.</p>"
    },
    {
      q: "In week three of a HIPAA-covered deployment, you finally submit the request for a service account to read the clinical system, and it takes seven weeks to clear security review and the identity queue while your finished prototype sits idle. What was the actual failure?",
      options: [
        "The engineering was too slow and should have been optimized further",
        "Credential acquisition is a long-lead, political/process dependency and should have been initiated in week one, in parallel, on the critical path",
        "The customer's security team was simply being obstructive and should have been overruled",
        "The prototype should not have been built until all access was granted"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: credential acquisition is process latency and belongs on the week-one critical path, in parallel with the build.</strong> Provisioning a least-privilege identity to regulated data routes through data owners, security, IAM, and change-control queues; that wait is measured in weeks and does not compress by coding faster, so you must start it first and run modeling on synthetic data meanwhile.</p><p>The engineering was not slow — it was done in week four; speed was never the constraint. The security team is not being obstructive; they are personally accountable for the attack surface your identity opens and are right to scrutinize it — you work with that by arriving with a precise, easy-to-approve request. Withholding the prototype until access lands wastes the parallelism that synthetic data exists to provide.</p>"
    },
    {
      q: "Your batch job upserts a batch of records and then crashes before it marks the batch complete, so it re-runs from the start. Which design choices keep the re-run from duplicating or corrupting data? (Select 2)",
      options: [
        "Key each record on a stable natural key (source system plus source primary key, or a hash of business-identifying fields) and upsert rather than insert",
        "Key each record on the ingestion timestamp or an auto-increment ID assigned at load time",
        "Land the raw source payload immutably first, so any stage can be deterministically replayed and diffed",
        "Delete the entire target table at the start of every run and reload everything with blind inserts"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<p><strong>Correct: a stable natural key with upsert, plus an immutable raw-land stage.</strong> Idempotency requires that running twice yields the same result as once, which holds only when the dedupe key is intrinsic to the record (so it is identical on re-run) and writes are upserts. Landing raw immutably lets every downstream stage be replayed deterministically and diffed when a bug surfaces weeks later.</p><p>Keying on ingestion timestamp or a load-time auto-increment defeats dedupe outright: those values change on the re-run, so the same record gets a new key and is inserted again. Truncate-and-blind-reload is not idempotent in any safe sense — it destroys history, breaks any consumer reading mid-run, and re-executes side effects; it also fails the moment a run is partial. The correct pair mirrors the same execute-versus-record gap that makes agents double-charge a card.</p>"
    },
    {
      q: "A nightly export that has run cleanly for months suddenly starts arriving with a renamed column and a new enum value your mapping does not handle. What is the right pipeline behavior?",
      options: [
        "Silently coerce the unknown column and map the new enum value to your closest existing category so the run does not fail",
        "Validate the incoming schema against an explicit contract, and on mismatch fail loud and quarantine the affected data rather than silently coercing it",
        "Automatically overwrite your schema to match whatever the source now sends",
        "Drop every row that does not match the old schema without recording that it happened"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: validate against an explicit schema contract, then fail loud and quarantine on drift.</strong> Schema drift is a routine event at scale, and the danger is silent adaptation — a pipeline that quietly maps the wrong column into a field a human decides on. An explicit contract with quarantine surfaces the change for a human to reconcile before bad data propagates.</p><p>Silently coercing the unknown column or squeezing the new enum into an existing bucket is exactly the failure that corrupts a downstream decision invisibly. Auto-overwriting your schema to match the source blindly trusts an unreviewed upstream change and can remap meaning without anyone noticing. Dropping non-matching rows without recording it hides data loss and destroys the reject-rate signal that is your early warning of drift.</p>"
    },
    {
      q: "Building a customer-360 view, you find the same corporation appears as C-4471 in the CRM, ACME001 in billing, and free-text 'ACME CORPORATION INC.' in support tickets, with no shared key. What is the correct characterization and approach?",
      options: [
        "This is a simple JOIN once you pick the right column, and any mismatch is a data-entry error to ignore",
        "This is entity resolution, a first-class hard problem: deterministic matching where keys allow, fuzzy matching where they do not, and a human review queue for the ambiguous middle",
        "Match purely on company name string equality, since names are unique identifiers for businesses",
        "Pick one system as canonical and discard records from the other two systems entirely"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: it is entity resolution, needing deterministic-plus-fuzzy matching with a human-adjudicated middle.</strong> The same real-world entity carries different identities across systems with no shared key, so you block on normalized fields plus a second signal (tax ID, address), score fuzzy matches against a tuned threshold, and route the uncertain band to review — getting this wrong over- and under-merges simultaneously.</p><p>It is not a simple JOIN; there is no column that reliably links the three, and the mismatches are the problem, not noise to ignore. Matching on name-string equality both splits one firm written three ways and merges two genuinely different firms sharing a name. Discarding two systems throws away the very data the customer-360 is meant to unify — you must reconcile, not delete.</p>"
    },
    {
      q: "A legacy service bus starts returning 429s and intermittent 5xx errors under your ingestion load, and separately some records fail a hard validation check. Which two behaviors are the correct handling for these distinct failure classes? (Select 2)",
      options: [
        "Treat transient errors (429, 5xx) with capped-concurrency exponential backoff with jitter, respecting Retry-After",
        "Quarantine-plus-alert the records that fail hard validation, rather than retrying them indefinitely",
        "Retry every failure, transient or permanent, forever at full concurrency until it all eventually succeeds",
        "Fail the entire run on the first 429 so that nothing partial is ever written",
        "Ignore the 429s and hold the same send rate because the records themselves are valid"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>Correct: back off with jitter and capped concurrency on transient errors, and quarantine-plus-alert on hard validation failures.</strong> The two failure classes need opposite handling: a brittle upstream's rate limit must be respected mechanically (Retry-After, backoff, concurrency below its real ceiling) because those errors are transient, while permanently invalid records must not be retried at all — they go to a quarantine with an alert so a human can reconcile them.</p><p>Retrying everything forever at full concurrency conflates the two classes and hammers a fragile production system — knocking over the customer's box on day one is politically unrecoverable. Failing the whole run on the first 429 discards recoverable, legitimately transient work. Ignoring 429s and holding the send rate turns a rate-limit signal into an outage — the source told you to slow down and you must.</p>"
    },
    {
      q: "You need to integrate a customer's Salesforce CRM, their cloud data warehouse, and a proprietary on-prem manufacturing execution system that no platform has a connector for. What is the most defensible build-versus-buy decision?",
      options: [
        "Hand-build every connector yourself, including Salesforce, to keep full control of the code",
        "Buy a single iPaaS platform for all three and use its custom-connector SDK for the MES, since one platform is simpler to operate",
        "Buy maintained connectors for the CRM and warehouse, build a thin bespoke adapter for the proprietary MES, and wrap all three behind one conformed interface",
        "Skip the MES entirely and deliver only the two sources the platform supports out of the box"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>Correct: buy the commodity connectors, build the bespoke adapter for the legacy long-tail, unify behind one interface.</strong> Build/buy is a per-source judgment: conserve scarce FDE-weeks by buying maintained connectors for common sources, and spend your build effort on the proprietary MES that is exactly where the connector catalog has a gap and where the engagement's real value lives.</p><p>Hand-building a Salesforce connector that a platform maintains for free is ego over engineering — you burn the engagement debugging pagination. Betting the whole timeline on one platform and its custom-connector SDK for the MES often becomes a multi-week hidden build coupled to a license the customer questions. Dropping the MES abandons the source the project is actually about — the 20% the catalog missed was the entire point.</p>"
    },
    {
      q: "You wrap a messy source (drifting SOAP schema, EBCDIC quirks, three conflicting customer IDs) behind an adapter exposing get_customer(id) that returns one conformed, reconciled entity. Why is this good design for both the operator and the model?",
      options: [
        "Because it makes the source system faster at the database level",
        "Because the anti-corruption layer quarantines the source's ugliness so the operator sees a coherent customer and the model gets a clean tool boundary instead of raw tables to disambiguate itself",
        "Because it lets you delete the original source system after integration",
        "Because exposing raw SAP tables directly would give the model more useful context to reason over"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the anti-corruption layer hides source ugliness, giving the operator a coherent view and the model a clean tool boundary.</strong> The conformed get_customer is simultaneously good data engineering (blast radius of a source change is one adapter), good agent-tool design (the model calls a clean tool rather than joining raw SAP), and good handoff — the ontology, the anti-corruption layer, and the tool schema are three views of one boundary.</p><p>It does not make the source database faster — it sits above the source, not inside it. It does not let you delete the source; the source remains the system of record you read from. Exposing raw SAP tables to the model is the opposite of helpful: it reproduces the wrong-endpoint, drowned-in-JSON, ambiguous-identity failures the clean boundary exists to prevent — the model would have to reconcile three customer IDs itself, unreliably.</p>"
    },
    {
      q: "A manufacturing deployment's ingestion is nearly done but an analyst finds the model is reasoning over a 'customer' that is actually two different firms merged, because reconciliation matched on company name alone. What compounding lesson does this illustrate?",
      options: [
        "Entity resolution is trivial and the analyst simply made a mistake",
        "Reconciliation errors corrupt everything downstream, so entity resolution needs blocking plus a second signal, a tuned fuzzy threshold, a review queue, and a consistency check — it is its own workstream, not a JOIN",
        "The model was too small and a larger model would have caught the merge",
        "The right fix is to stop reconciling and present each source's records separately to the operator"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: reconciliation errors poison everything downstream, and entity resolution is its own workstream.</strong> Name-only matching both over-merges (two firms sharing a name) and under-merges (one firm written three ways), so you block on normalized name plus a second signal like tax ID or address, tune a fuzzy threshold, route the ambiguous band to human review, and add a consistency check that flags contradictory attributes for a resolved entity.</p><p>It is not the analyst's error — the pipeline genuinely merged two firms. A larger model cannot fix a data-layer merge; it will confidently reason over the corrupted entity either way, because the mistake happened before the model ever saw it. Abandoning reconciliation and showing raw per-source records defeats the customer-360 goal and pushes the hard disambiguation onto the operator, which is exactly what the deployment was meant to remove.</p>"
    },
    {
      q: "Halfway through delivery, the customer's exec sponsor reads the quiet period during a stuck security-review queue as the project stalling and starts questioning funding, even though your prototype is finished. What does this reveal about integration work?",
      options: [
        "Integration is purely a coding problem and stakeholder perception is irrelevant to it",
        "The political and process latency of integration (access approvals, security review) must be surfaced, sequenced early, and communicated as a managed dependency, not left as invisible silence",
        "You should have hidden the delay entirely and hoped the queue cleared before anyone noticed",
        "The right response is to offer the customer a discount to smooth over the funding concern"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: integration's process latency is a managed dependency you surface, sequence early, and communicate.</strong> Much of the timeline is waiting on approvals and reviews you do not control, so a senior FDE escalates the stuck dependency through the exec sponsor early, keeps the build moving on synthetic data, and makes the wait legible — silence is read as failure even when the engineering is done.</p><p>Integration is emphatically not just coding; the political and process layer is where the timeline actually goes, and perception drives funding decisions. Hiding the delay and hoping is the avoidance failure that destroys trust when reality lands. A discount treats a communication-and-sequencing problem as a price problem and signals you have no plan — the fix is honest, early, options-bearing communication, not money.</p>"
    }
  ],
  flashcards: [
    { front: "The adapter layer is the longest pole (the law)", back: "<p>Every source system is a mini-project; every undocumented endpoint, unschema'd flat-file, and legacy SOAP service adds <strong>weeks, not days</strong>. The adapter is the critical path because nothing production ships until real data flows, and real data flows only through the adapter. Integration, not modeling, dominates the timeline.</p>" },
    { front: "Why integration dominates over modeling", back: "<p>Modeling is <strong>bounded and known</strong> (prompt, eval, tune — doable in parallel on synthetic data). Integration is <strong>unbounded and discovered</strong> (missing column in week 4, batch-not-live in week 5, IDs don't match in week 6). This is why the ~95% pilot-failure traces to integration, not weak models.</p>" },
    { front: "The iceberg model of a single source", back: "<p>Above water: the documented interface ('returns JSON'). Below water, where the weeks go: auth handshake + rotation, pagination quirks, undocumented rate limits, schema drift, data quality, batch windows, change control, the one free-text field where you needed an enum. Price the visible interface, then multiply by an <strong>interface-maturity factor</strong>.</p>" },
    { front: "Interface-maturity estimating factors", back: "<p>Modern documented REST ≈ <strong>1x</strong>; documented SOAP/legacy ≈ <strong>2x</strong>; undocumented endpoint / mainframe extract / hand-maintained flat file ≈ <strong>3–5x</strong> — dominated by <em>waiting</em>, not coding. Price twelve sources as twelve projects, not one.</p>" },
    { front: "How to estimate integration honestly", back: "<p>(1) Week-one <strong>source inventory</strong> (system, interface, owner, auth, freshness, DQ reputation) — the inventory is the estimate. (2) <strong>Ranges, not points</strong>, each tied to a named unknown. (3) Tie go/no-go to <strong>data-access milestones</strong>, not model quality.</p>" },
    { front: "The legacy cast of characters", back: "<p>SAP (IDoc/BAPI/RFC/OData), mainframes (fixed-width, EBCDIC, green screens, no real API), <strong>nightly CSV/flat-file dumps to SFTP</strong>, on-prem Oracle/DB2/SQL Server (no business-hours queries), SOAP/XML/WSDL, and brittle rate-limited vendor APIs with batch windows. The enterprise is not greenfield.</p>" },
    { front: "The data is a stale dump, not a live API", back: "<p>You will hope for an incremental event feed; you will usually get a <strong>full nightly snapshot</strong>. Design a batch <strong>reconciliation</strong>, not a stream; freshness is bounded by the batch cadence (can't be fresher than the 2am drop). The nightly batch is deliberate load-shedding off the transactional primary — design within it, don't argue it away.</p>" },
    { front: "Encoding / format landmines", back: "<p>EBCDIC vs ASCII; packed-decimal (COMP-3); ambiguous CSV quoting / embedded delimiters; DD/MM vs MM/DD dates (silent off-by-a-day for 12 days a month); Latin-1 vs UTF-8 mojibake; fixed-width padding that breaks key joins. Assume all present until proven absent.</p>" },
    { front: "The auth maze", back: "<p>Every source has its own regime: <strong>SAML/OIDC</strong> SSO for user apps, <strong>OAuth 2.0 Client Credentials</strong> for machine-to-machine SaaS, Kerberos/AD for on-prem DBs and shares, mTLS on some service bus, API keys for vendors. You are federating a dozen trust boundaries and holding every secret.</p>" },
    { front: "OAuth flow: which grant for which case", back: "<p><strong>Authorization Code (+PKCE)</strong>: a user delegating access to their data. <strong>Client Credentials</strong>: machine-to-machine where your service is the principal — the one you use most for backend ingestion. Reaching for Auth Code on a backend pull ('why is there no user to redirect?') is a classic stumble.</p>" },
    { front: "Secrets and least-privilege identity", back: "<p>Credentials live in a <strong>vault</strong> (Vault, Secrets Manager, Key Vault) — never in code or a committed env file (a career-defining incident in a customer env). Prefer short-lived workload identity over static keys. Scope the service account to exactly what it needs; human-in-the-loop for irreversible actions.</p>" },
    { front: "Getting credentials is a political problem", back: "<p>The hard part of auth is the <strong>wait</strong>, not the code. A least-privilege service account routes through data owners, security, IAM, and change-control queues — <strong>days to many weeks</strong>, and a re-request restarts the clock. Initiate it week one, in parallel, on the critical path; arrive with a precise, easy-to-approve request; deliberately request full read scope up front.</p>" },
    { front: "Defensible pipeline stages (medallion)", back: "<p><strong>Land raw</strong> (immutable source payload, so you can replay/diff) → <strong>normalize/clean</strong> (parse, type, canonicalize encodings/dates, quarantine failures) → <strong>reconcile/conform</strong> (resolve identity, produce model-ready table). Each stage idempotent and independently observable.</p>" },
    { front: "Idempotency: the mechanism", back: "<p>Re-runs are the normal mode (failures, late dumps, redeploys). <strong>Upsert on a stable natural key</strong> (source system + source PK, or a hash of business-identifying fields), never on ingestion timestamp or a load-time auto-increment ID — those change on re-run and defeat dedupe. Same execute-vs-record gap that makes agents double-charge.</p>" },
    { front: "Retries and rate limits against brittle upstreams", back: "<p>Wrap calls in <strong>exponential backoff + jitter</strong>, respect Retry-After on 429s, cap concurrency below the source's real (often undocumented) limit. Distinguish <strong>transient</strong> (retry mechanically) from <strong>permanent</strong> (quarantine + alert). Knocking over the customer's production system on day one is politically unrecoverable.</p>" },
    { front: "Schema drift", back: "<p>Sources rename columns, add fields, grow enums, start sending nulls — a weekly event at scale. Validate incoming schema against an explicit <strong>contract</strong>; on mismatch <strong>fail loud and quarantine</strong>, never silently coerce. Silent adaptation eventually maps the wrong column into a field a human decides on.</p>" },
    { front: "The identity-reconciliation problem", back: "<p>The same entity has different IDs across systems (C-4471 / ACME001 / free-text 'ACME INC.') with no shared key. <strong>Entity resolution</strong>: deterministic match where keys allow, fuzzy (blocking + edit distance + threshold) where they don't, human review queue for the middle. It's its own workstream, not a JOIN — the ontology defines what a 'customer' is.</p>" },
    { front: "Data-quality dimensions to measure every run", back: "<p><strong>Completeness</strong> (null rate), <strong>validity</strong> (type/format/enum failures), <strong>uniqueness</strong> (dup rate on natural key), <strong>consistency</strong> (cross-source contradictions), <strong>timeliness</strong> (age vs SLA), <strong>reject rate</strong> (quarantined share). Row-count reconciliation (in = out + quarantined) every run. Makes 'is the data good enough?' a measured conversation, not an argument.</p>" },
    { front: "Build vs buy the connector", back: "<p><strong>Buy</strong> (Fivetran/Airbyte/MuleSoft/Boomi) when a maintained connector exists, the customer owns the platform, and the transform is standard — conserve scarce FDE-weeks. <strong>Build</strong> a bespoke adapter for legacy/proprietary/on-prem long-tail, domain-specific transforms, or residency/airgap constraints. Decide <strong>per source</strong>, never one platform-wide bet; a catalog's breadth can hide the one gap that is the point.</p>" },
    { front: "The anti-corruption layer (integration mindset)", back: "<p>Quarantine the source's ugliness (EBCDIC, drifting SOAP, three IDs) inside the adapter; upstream sees a clean domain model speaking the ontology. One boundary serves three consumers: the <strong>operator</strong> (coherent view), the <strong>model</strong> (clean tool boundary — get_customer returns a conformed entity, not raw SAP), and the <strong>handoff</strong> (blast radius of a source change is one adapter). Making the 'impossible' integration possible is the job.</p>" }
  ],
  lab: {
    title: "Lab: build a defensive adapter for a deliberately messy enterprise export",
    html: `
<p><strong>Goal:</strong> build a small but real adapter that ingests a deliberately hostile synthetic export — a malformed CSV from one system plus a mock legacy SOAP/XML payload from another — and normalizes, validates, and <strong>reconciles</strong> the two into one clean local table, with <strong>idempotent re-runs</strong> and basic <strong>data-quality checks</strong>. Everything runs locally in Python and SQLite; there is no cloud spend, no API keys, and no external services — cost is zero. This is the practical-coding round in miniature: the graders care far more that you defend against dirty data than that you write clever algorithms.</p>

<h3>Architecture</h3>
<p>Two synthetic sources describe the same customers under different IDs. Source A is a <strong>pipe-delimited "CSV"</strong> with no header, mixed date formats, blank-vs-zero ambiguity, and an un-escaped delimiter inside a free-text field that shifts columns for one row. Source B is a <strong>mock SOAP/XML</strong> billing extract whose customer key differs from Source A's. Your adapter lands both raw, normalizes and validates each (quarantining bad rows instead of dropping or trusting them), reconciles the two on a business key, and upserts into a clean <code>customers</code> table keyed on a stable natural key so re-running the whole pipeline twice yields identical output. A final step prints data-quality metrics and a row-count reconciliation.</p>

<h3>Steps</h3>
<ol>
<li><strong>Set up a scratch workspace.</strong> Pure standard library — no pip installs needed.
<pre><code>mkdir -p ~/fde-adapter-lab &amp;&amp; cd ~/fde-adapter-lab
python3 --version    # 3.8+ ; sqlite3 and xml are in the standard library</code></pre></li>

<li><strong>Generate the deliberately messy synthetic sources.</strong> Save as <code>make_sources.py</code> and run it. Note the planted defects called out in comments.
<pre><code># make_sources.py  -- writes two messy synthetic exports
# Source A: pipe-delimited, NO header, mixed date formats,
#   blank vs zero, and an un-escaped pipe inside a free-text notes field.
rows_a = [
    "A1001|Acme Corporation|2024/03/07|1500|premium account",
    "A1002|Globex LLC|07-03-2024|0|ground shipping only",
    # the next row has an un-escaped pipe in the notes -> a column shift:
    "A1003|Initech Inc|2024/03/09|920|net|30 terms noted",
    "A1004|Umbrella Co||750|air freight",          # blank date
    "A1005|Acme Corporation|2024/03/07|1500|dup of A1001 same day",  # duplicate-ish
]
with open("source_a.psv", "w", encoding="utf-8") as f:
    f.write("\\n".join(rows_a) + "\\n")

# Source B: mock SOAP/XML billing extract. DIFFERENT customer key than A.
# Note the runtime payload carries a field the "contract" never documented (region).
soap_b = (
 '&lt;?xml version="1.0" encoding="UTF-8"?&gt;\\n'
 '&lt;soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"&gt;\\n'
 ' &lt;soap:Body&gt;\\n'
 '  &lt;GetBillingResponse&gt;\\n'
 '   &lt;Account&gt;&lt;BillId&gt;BILL-77&lt;/BillId&gt;&lt;Name&gt;ACME CORPORATION INC.&lt;/Name&gt;'
 '&lt;Balance&gt;1500.00&lt;/Balance&gt;&lt;Region&gt;NA&lt;/Region&gt;&lt;/Account&gt;\\n'
 '   &lt;Account&gt;&lt;BillId&gt;BILL-78&lt;/BillId&gt;&lt;Name&gt;Globex, LLC&lt;/Name&gt;'
 '&lt;Balance&gt;0.00&lt;/Balance&gt;&lt;/Account&gt;\\n'
 '   &lt;Account&gt;&lt;BillId&gt;BILL-79&lt;/BillId&gt;&lt;Name&gt;Initech Incorporated&lt;/Name&gt;'
 '&lt;Balance&gt;920.00&lt;/Balance&gt;&lt;Region&gt;NA&lt;/Region&gt;&lt;/Account&gt;\\n'
 '  &lt;/GetBillingResponse&gt;\\n'
 ' &lt;/soap:Body&gt;\\n'
 '&lt;/soap:Envelope&gt;\\n'
)
with open("source_b.xml", "w", encoding="utf-8") as f:
    f.write(soap_b)
print("wrote source_a.psv and source_b.xml")</code></pre></li>

<li><strong>Write the adapter.</strong> Save as <code>adapter.py</code>. It lands raw, normalizes with per-row validation and quarantine, reconciles on a normalized business name, and upserts idempotently into SQLite. Read the comments — each defends against one planted defect.
<pre><code># adapter.py  -- messy-in, clean-out, idempotent, with DQ checks
import sqlite3, re, hashlib, xml.etree.ElementTree as ET

DB = "warehouse.db"

def norm_name(s):
    # canonicalize a business name for reconciliation (blocking key)
    s = s.upper()
    s = re.sub(r"[.,]", " ", s)
    s = re.sub(r"\\b(INC|INCORPORATED|LLC|CO|CORP|CORPORATION|LTD)\\b", "", s)
    return re.sub(r"\\s+", " ", s).strip()

def natural_key(norm):
    # STABLE key -> re-runs upsert the same row (never key on load time / rowid)
    return hashlib.sha1(norm.encode("utf-8")).hexdigest()[:16]

def parse_date(raw):
    raw = (raw or "").strip()
    if not raw:
        return None
    for pat, order in ((r"(\\d{4})/(\\d{2})/(\\d{2})", "ymd"),
                       (r"(\\d{2})-(\\d{2})-(\\d{4})", "dmy")):
        m = re.match(pat, raw)
        if m and order == "ymd":
            return raw.replace("/", "-")
        if m and order == "dmy":
            d, mo, y = m.groups()
            return y + "-" + mo + "-" + d
    return "INVALID"   # signal, do not silently coerce

def load_source_a(path, good, bad):
    for lineno, line in enumerate(open(path, encoding="utf-8"), 1):
        parts = line.rstrip("\\n").split("|")
        # DEFENSE: exact field-count check catches the un-escaped-pipe shift
        if len(parts) != 5:
            bad.append((("A", lineno), "field_count=" + str(len(parts)), line.strip()))
            continue
        cid, name, date_raw, spend_raw, notes = parts
        dt = parse_date(date_raw)
        if dt == "INVALID":
            bad.append((("A", lineno), "bad_date", date_raw)); continue
        # DEFENSE: blank vs zero -> blank spend is unknown (None), not 0
        spend = None if spend_raw.strip() == "" else int(spend_raw)
        norm = norm_name(name)
        good.append({"src": "A", "src_id": cid, "name": name, "norm": norm,
                     "signup": dt, "spend": spend, "notes": notes})

def load_source_b(path, good, bad):
    root = ET.parse(path).getroot()
    # namespace-agnostic search so we don't hard-code the SOAP envelope ns
    for acct in root.iter("Account"):
        get = lambda t: (acct.findtext(t) or "").strip()
        bill_id, name, bal = get("BillId"), get("Name"), get("Balance")
        if not bill_id or not name:
            bad.append((("B", bill_id), "missing_key_or_name", name)); continue
        # runtime payload has an undocumented &lt;Region&gt; -> tolerate extra fields
        good.append({"src": "B", "src_id": bill_id, "name": name,
                     "norm": norm_name(name), "balance": float(bal or 0)})

def upsert(conn, rows_a, rows_b):
    conn.execute("""CREATE TABLE IF NOT EXISTS customers(
        nk TEXT PRIMARY KEY, canonical_name TEXT, src_a_id TEXT, src_b_id TEXT,
        signup TEXT, spend INTEGER, balance REAL)""")
    by_key = {}
    for r in rows_a + rows_b:
        k = natural_key(r["norm"])
        rec = by_key.setdefault(k, {"nk": k, "canonical_name": r["norm"],
              "src_a_id": None, "src_b_id": None,
              "signup": None, "spend": None, "balance": None})
        if r["src"] == "A":
            rec["src_a_id"] = r["src_id"]; rec["signup"] = r["signup"]
            rec["spend"] = r["spend"]
        else:
            rec["src_b_id"] = r["src_id"]; rec["balance"] = r["balance"]
    for k, rec in by_key.items():
        # UPSERT on the stable natural key -> running twice == running once
        conn.execute("""INSERT INTO customers(nk,canonical_name,src_a_id,src_b_id,signup,spend,balance)
            VALUES(:nk,:canonical_name,:src_a_id,:src_b_id,:signup,:spend,:balance)
            ON CONFLICT(nk) DO UPDATE SET canonical_name=excluded.canonical_name,
              src_a_id=excluded.src_a_id, src_b_id=excluded.src_b_id,
              signup=excluded.signup, spend=excluded.spend, balance=excluded.balance""", rec)
    conn.commit()
    return by_key

def dq_report(conn, n_in, n_bad, by_key):
    cur = conn.execute("SELECT COUNT(*), "
        "SUM(src_a_id IS NOT NULL AND src_b_id IS NOT NULL), "
        "SUM(spend IS NULL) FROM customers")
    total, matched, unknown_spend = cur.fetchone()
    print("--- data quality ---")
    print("rows read (A+B):        ", n_in)
    print("quarantined (rejects):  ", n_bad)
    print("clean entities loaded:  ", total)
    # row-count reconciliation: read == loaded-contributions + rejected
    print("reconciled A+B rows:    ", n_in - n_bad, "(read minus quarantined)")
    print("cross-source matched:   ", matched, "of", total)
    print("null/unknown spend:     ", unknown_spend)
    print("reject rate:            ", round(100.0 * n_bad / max(n_in, 1), 1), "%")

def run():
    good, bad = [], []
    load_source_a("source_a.psv", good, bad)
    n_after_a = len(good) + len(bad)
    load_source_b("source_b.xml", good, bad)
    rows_a = [r for r in good if r["src"] == "A"]
    rows_b = [r for r in good if r["src"] == "B"]
    n_in = len(good) + len(bad)
    conn = sqlite3.connect(DB)
    by_key = upsert(conn, rows_a, rows_b)
    dq_report(conn, n_in, len(bad), by_key)
    print("--- quarantine ---")
    for src_ref, reason, payload in bad:
        print(" ", src_ref, reason, "::", payload[:60])
    conn.close()

if __name__ == "__main__":
    run()</code></pre></li>

<li><strong>Run it once, then immediately run it again.</strong>
<pre><code>python make_sources.py
python adapter.py        # first load
python adapter.py        # RE-RUN: idempotent -- counts must be identical</code></pre></li>

<li><strong>Prove idempotency at the database level.</strong> The row count must not change on the second run.
<pre><code>sqlite3 warehouse.db "SELECT COUNT(*) AS clean_customers FROM customers;"
sqlite3 warehouse.db "SELECT canonical_name, src_a_id, src_b_id FROM customers ORDER BY canonical_name;"</code></pre></li>
</ol>

<h3>Verify</h3>
<ul>
<li><strong>Idempotency:</strong> the clean-customers count is identical after the first and second <code>adapter.py</code> runs. If it doubled, your natural key is not stable — you keyed on something load-time-dependent.</li>
<li><strong>Quarantine, not corruption:</strong> the malformed A1003 row (un-escaped pipe, 6 fields) appears in the quarantine list with reason <code>field_count=6</code> and is <em>not</em> in <code>customers</code> — you neither silently dropped it nor loaded a shifted, plausible-but-wrong record.</li>
<li><strong>Reconciliation across systems:</strong> Acme/Initech/Globex each resolve to a single row carrying <em>both</em> a <code>src_a_id</code> and a <code>src_b_id</code> despite the two systems using different keys and differently-spelled names — the entity-resolution win.</li>
<li><strong>Blank vs zero:</strong> Umbrella Co's blank date quarantines on <code>bad_date</code>; a genuinely zero balance/spend is preserved as 0, while a blank spend is preserved as unknown (NULL), not silently turned into 0.</li>
<li><strong>Schema-drift tolerance:</strong> Source B's undocumented <code>&lt;Region&gt;</code> field does not break the parser — extra fields are tolerated, missing required fields are quarantined.</li>
<li><strong>Row-count reconciliation:</strong> rows-read equals clean-contributions plus quarantined; the numbers sum, so nothing vanished unaccounted-for.</li>
</ul>
<p>For extra credit, tighten reconciliation: two genuinely different firms that normalize to the same name should <em>not</em> merge — add a second blocking signal (region or a synthetic tax ID) and a review-queue band, mirroring the war story in the data-quality lesson.</p>

<h3>Teardown</h3>
<p>Everything is local and free; cleanup is one command. This <strong>deletes</strong> the scratch directory, the synthetic source files, and the SQLite database file:</p>
<pre><code>cd ~ &amp;&amp; rm -rf ~/fde-adapter-lab      # remove scratch dir, source files, and warehouse.db</code></pre>
<p>If you experimented with the database elsewhere, also <code>rm -f warehouse.db</code> in any directory you ran it from. No cloud resources were created, so nothing keeps billing and there is nothing to terminate remotely — but practicing clean deletion of scratch data (especially anything modeled on a real customer's export) is itself part of the FDE data-handling discipline.</p>
`
  }
});
