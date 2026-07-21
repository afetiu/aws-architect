window.COURSE.register({
  id: "route53",
  order: 11,
  track: "saa",
  title: "Route 53 & DNS Architecture",
  description: "Route 53 is an authoritative DNS service with a routing-policy engine bolted onto record selection, a global health-checking fleet, and a resolver that bridges VPC and on-prem namespaces. This module covers the ALIAS/CNAME distinction, every routing policy with its use case, health check and failover mechanics, split-horizon private zones, hybrid resolution, DNSSEC, and Application Recovery Controller.",
  examWeight: "Reliable SAA-C03 material: expect ALIAS-at-the-apex, routing-policy selection scenarios, failover with health checks, and hybrid Resolver endpoint questions. SAP-C02 goes deeper on hybrid DNS and ARC.",
  lessons: [
    {
      id: "zones-delegation",
      title: "Hosted Zones, Delegation, and Registrar vs DNS Host",
      html: `
<p>You know how DNS delegation works: NS records at the parent hand authority to child nameservers, resolvers walk the tree, TTLs govern cache behavior. Route 53 adds nothing exotic to the protocol — its value is where the authoritative servers live (a global anycast fleet across AWS edge locations, backed by a 100% availability SLA on the authoritative service) and what it lets you compute at answer time (routing policies, health-aware responses, alias resolution).</p>

<h3>Hosted zones</h3>
<p>A <strong>hosted zone</strong> is an authoritative zone file plus the four assigned nameservers that serve it. Two kinds:</p>
<ul>
<li><strong>Public hosted zone:</strong> answers queries from the internet. Creating one assigns four NS across four distinct TLDs (a .com, .net, .org, .co.uk spread) — deliberate registry-level failure isolation. The zone does nothing until the parent (registrar/parent zone) delegates to those exact four servers.</li>
<li><strong>Private hosted zone (PHZ):</strong> answers only queries arriving via Route 53 Resolver from <strong>VPCs you have associated</strong> with the zone. Not reachable from the internet; not even reachable from a VPC that is not associated, regardless of peering. Requires enableDnsSupport and enableDnsHostnames on each associated VPC.</li>
</ul>
<p>Zones are flat record collections with computed answers, not zone files you AXFR. There is no zone transfer in or out — migration means exporting/importing records via API, and secondary-DNS setups with other providers are done by duplicating records, not by AXFR/IXFR. If a design question requires standard zone transfer to an external secondary, Route 53 is the wrong tool — worth knowing as a rare when-not-to-use.</p>

<h3>Registrar and DNS host are different businesses</h3>
<p>Route 53 bundles two separable functions, and the exam checks that you can separate them:</p>
<ul>
<li><strong>Domain registration</strong> (Route 53 Domains): the commercial/ICANN relationship — you own example.com, pay yearly, manage contacts and locks. Registration is a <strong>global</strong> service surfaced in us-east-1.</li>
<li><strong>DNS hosting</strong> (hosted zones): serving authoritative answers. Priced at 0.50 USD/month per zone plus per-query fees (except alias queries to AWS targets — next lesson).</li>
</ul>
<p>All four combinations are valid: register with Route 53 and host elsewhere (point the registration's NS records at the other provider), register elsewhere and host on Route 53 (update NS at the external registrar to the four assigned servers — the standard migration-to-AWS scenario), or both, or neither. When you register through Route 53 it auto-creates a hosted zone for convenience; deleting that zone does not affect the registration, and vice versa.</p>

<div class="callout exam">Classic scenarios: "domain registered with a third-party registrar, wants Route 53 to manage DNS" → create a public hosted zone, copy/create records, then <strong>update the NS records at the registrar</strong> to the zone's four nameservers. The distractor is updating the SOA or creating NS records inside Route 53 — delegation is controlled at the parent, as you know from DNS fundamentals, and the exam checks you remember it under pressure.</div>

<h3>Migration mechanics and TTL strategy</h3>
<p>Moving a live domain onto Route 53 without an outage is a TTL exercise: lower TTLs at the incumbent provider ahead of time (respecting the old TTL as the propagation window), replicate all records into the new zone <em>before</em> switching NS at the registrar, keep the old zone alive until the parent NS TTL (often 48h at TLD level, commonly two days of straggler resolvers) has fully expired. Route 53-side changes propagate to its authoritative fleet in ~60 seconds — the change API is synchronous-ish with an INSYNC status you can poll — but caching resolvers worldwide obey your TTLs, not Amazon's propagation.</p>

<div class="callout war">The most common self-inflicted migration wound: switching registrar NS before the new zone has all records (mail dies first — nobody remembers MX and the DKIM/SPF TXT records), or deleting the old provider's zone while long-TTL NS entries still point stragglers at it, producing days of intermittent NXDOMAIN that no amount of Route 53 debugging can explain because the failing queries never reach Route 53.</div>

<h3>What a zone can contain</h3>
<p>Standard types: A/AAAA, CNAME, MX, TXT, SRV, NS, SOA, CAA, PTR, NAPTR, SPF (deprecated type — use TXT), DS (for DNSSEC delegation to child zones). Plus the Route 53-specific <strong>alias</strong> attribute, which is not a record type on the wire — the next lesson's whole subject. Each record (name + type) can hold multiple values (standard round-robin) or be split into multiple <em>policy records</em> distinguished by a set identifier (weighted, latency, etc.), which is how one name gets a routing policy attached.</p>

<div class="callout limits">Numbers worth holding: 10,000 records per hosted zone (soft, raisable with cost implications), 500 hosted zones per account (soft), zone cost 0.50 USD/month (first 25), queries ~0.40 USD/million standard, ~0.60-0.70 USD/million for latency/geo policies — and 0.00 for alias queries to AWS resources. Record change propagation to Route 53's own fleet: ~60 s, status via GetChange (PENDING to INSYNC). The 100% availability SLA applies to the authoritative DNS answering service — a marketing-meaningful but architecturally real statement about the anycast fleet's redundancy.</div>

<p>Mental model to carry forward: a hosted zone is a <em>function</em> from (query name, type, resolver location, health state, policy) to an answer — not a static file. Everything in the next lessons parameterizes that function.</p>
`
    },
    {
      id: "alias-cname",
      title: "ALIAS vs CNAME: The Zone Apex Problem and AWS-Aware Answers",
      html: `
<p>You know the RFC 1034 constraint: a CNAME cannot coexist with other data at the same name, and since the zone apex necessarily holds SOA and NS records, <strong>you cannot CNAME the apex</strong>. example.com cannot be a CNAME to an ALB's DNS name. Every DNS provider has some workaround (ANAME, CNAME flattening); Route 53's is the <strong>alias record</strong>, and it is deeply integrated rather than a resolution hack.</p>

<h3>What an alias actually is</h3>
<p>An alias is a Route 53-internal pointer, invisible on the wire. You create an A (or AAAA) record with the alias attribute targeting an AWS resource; when a query arrives, Route 53 resolves the target <em>at answer time, server-side</em>, and returns real A/AAAA records with the target's current IPs. The resolver sees a plain A answer with a short TTL (which Route 53 controls — typically 60 s, matching the volatility of the underlying resource's IPs; you cannot set an alias TTL yourself). Because it is synthesized authoritative data, it is legal at the apex.</p>

<h3>Alias vs CNAME, the decision table</h3>
<table>
<thead><tr><th></th><th>Alias</th><th>CNAME</th></tr></thead>
<tbody>
<tr><td>At zone apex</td><td>Yes</td><td>Never (RFC constraint)</td></tr>
<tr><td>Valid targets</td><td>Specific AWS resources + records in the same zone</td><td>Any DNS name anywhere</td></tr>
<tr><td>Query cost</td><td>Free when targeting AWS resources</td><td>Billed per query</td></tr>
<tr><td>Health awareness</td><td>Can evaluate target health (AWS targets)</td><td>None — blind pointer</td></tr>
<tr><td>TTL</td><td>Controlled by Route 53</td><td>You set it</td></tr>
<tr><td>On the wire</td><td>Looks like A/AAAA</td><td>CNAME chain, extra lookups</td></tr>
</tbody>
</table>
<p>Valid alias targets — memorize the list, and note what is absent: ALB/NLB/CLB, CloudFront distributions, API Gateway custom domains, S3 static-website endpoints (the website endpoint, not the REST endpoint), Elastic Beanstalk environments, VPC interface endpoints, Global Accelerator, AppSync, and <strong>another record in the same hosted zone</strong>. Conspicuously not on the list: <strong>an EC2 instance's public DNS name, an RDS endpoint, or any arbitrary external name</strong>. For those you use A records or CNAMEs respectively.</p>

<div class="callout exam">Highest-frequency Route 53 question in existence: "point example.com (the apex/root/naked domain) at an ALB/CloudFront" → alias A record. CNAME is always among the options and always wrong at the apex. Second pattern: "reduce DNS query charges for records pointing at AWS resources" → convert CNAMEs to aliases (alias queries to AWS targets are free). Third: "route to an RDS instance from the apex" — impossible directly; RDS is not an alias target, so the answer restructures (use a subdomain CNAME, or front with an NLB which IS an alias target).</div>

<h3>Evaluate target health</h3>
<p>Aliases targeting AWS resources can set <strong>EvaluateTargetHealth</strong>. For an ALB target, Route 53 then omits the alias from answers when the load balancer has no healthy targets in a zone / fails its own health semantics — <em>without you configuring any Route 53 health check</em>. This composes with routing policies: a failover or weighted record set of aliases with EvaluateTargetHealth gives DNS-level failover driven by the load balancers' own health, no health-check fees, no duplicate health definitions. It is the cleanest multi-region active-passive building block and the exam rewards knowing that it substitutes for explicit health checks when the target is an AWS resource.</p>

<div class="callout deep">Why can aliases be free and health-aware? Because resolution happens inside Route 53's answer path: the service subscribes to the target resource's state (the ALB's current node IPs, health) through internal control planes, so answering costs Amazon nothing marginal and can consult state a public resolver could never see. A CNAME, by contrast, makes the world's resolvers do a second full resolution — visible latency (one extra round trip per uncached chain link) and a second billable query if the target is also in Route 53.</div>

<h3>Practical record-type guidance</h3>
<ul>
<li><strong>www and other subdomains to AWS resources:</strong> alias anyway — free queries and no CNAME chain latency. CNAME works but is strictly worse for AWS targets.</li>
<li><strong>Third-party targets</strong> (SaaS-verified domains, external CDNs): CNAME — aliases cannot point outside AWS/same-zone.</li>
<li><strong>Apex to a third-party target:</strong> the genuinely hard case; Route 53 cannot alias to external names. Options: alias to a same-zone record that is itself managed, front the third party with CloudFront, or accept static A records with the vendor's IPs (fragile). Know this as a limitation, not a puzzle with a clean answer.</li>
<li><strong>S3 static site at the apex:</strong> alias to the S3 <em>website</em> endpoint, and the bucket name must equal the domain name — an S3 quirk the exam still occasionally touches.</li>
<li><strong>CAA records:</strong> constrain which CAs may issue certs for the domain — relevant when ACM issuance mysteriously fails because an old CAA record only lists another CA.</li>
</ul>

<div class="callout war">Alias-to-ALB with EvaluateTargetHealth true, cross-zone load balancing off, and one empty AZ has produced real outages: the alias answer withdraws IPs per the LB's zonal health, and clients pile onto remaining zones unevenly. Also beware chaining: alias to a record that is a CNAME to something external re-introduces the chain you thought you removed. Keep alias chains flat and terminate them on AWS resources.</div>

<div class="callout limits">Aliases only target resources in the same account cleanly for some types (historically) — with cross-account targets you paste names rather than pick from a dropdown; behavior is fine, tooling is worse. Alias TTL: fixed by Route 53 (typically 60 s for ELB targets). CNAME-at-apex: forbidden by protocol, not by AWS policy — no support ticket fixes it.</div>
`
    },
    {
      id: "routing-policies",
      title: "Routing Policies: The Full Catalog and When Each Wins",
      html: `
<p>Routing policies decide <em>which records</em> come back for a name, computed per query. Combined with health checks they are a global traffic-management layer that costs almost nothing and fails safe (cached answers persist). Know all eight; the exam is a matching game between scenario phrasing and policy.</p>

<h3>Simple</h3>
<p>One record, one or more static values, returned as-is (multiple values shuffle client-side — naive round robin). No health checks. Use when there is one destination or you genuinely want dumb DNS.</p>

<h3>Weighted</h3>
<p>Multiple records for the same name, each with a weight 0-255; Route 53 answers proportionally (weight / sum of weights). Uses: <strong>canary and blue-green rollouts</strong> (95/5, dial gradually), coarse load splitting across regions or stacks, A/B at the DNS layer. <strong>Weight 0 stops sending traffic</strong> to a record while keeping it configured — the standard instant-ish kill switch, bounded by TTL. Health checks per record supported: an unhealthy record is excluded and remaining weights renormalize. Trap: if ALL weighted records are unhealthy, Route 53 answers as if all were healthy — it will not return an empty answer.</p>

<h3>Latency-based</h3>
<p>Records tagged with an AWS region; Route 53 answers with the record whose region has the lowest <em>measured network latency</em> from the resolver's vantage. Not geography — latency, from AWS's continuously updated measurements. A user in London can be routed to us-east-1 if transatlantic latency beats a congested path to eu-central-1. Use for multi-region active-active where the goal is "fastest experience". Requires nothing from you but the region tag; combine with health checks for region failover.</p>

<h3>Failover</h3>
<p>Exactly two roles: PRIMARY and SECONDARY. Route 53 answers with the primary while its health check (or EvaluateTargetHealth) passes; otherwise the secondary. The canonical <strong>active-passive DR</strong> policy — secondary is often a static S3/CloudFront error or maintenance page, or a pilot-light region. Note the failback is automatic when the primary recovers, which is not always what you operationally want (flapping) — ARC exists partly because of this.</p>

<h3>Geolocation</h3>
<p>Answers based on <em>where the user is</em> (continent, country, or US state), resolved from the source of the query (EDNS Client Subnet when present, else resolver IP). Use when the answer must depend on jurisdiction, not speed: <strong>content localization, licensing/regulatory restrictions, GDPR data-locality routing</strong>. Always define a <strong>default record</strong> for unmatched locations — without it, unmatched users get NXDOMAIN-ish no-answer, a favorite exam gotcha. Most-specific match wins: state beats country beats continent beats default.</p>

<h3>Geoproximity</h3>
<p>Routing by <em>distance between the user and your resources' coordinates</em>, with a per-resource <strong>bias</strong> (-99 to +99) that shrinks or expands each resource's catchment area. AWS regions get coordinates automatically; on-prem endpoints take lat/long. Requires Traffic Flow (the visual policy editor / versioned policy documents). Use when you want geographic routing you can <em>tune</em>: gradually shift load toward a new region by increasing its bias, drain a region for maintenance by biasing negative. Geolocation = political boundaries; geoproximity = adjustable distance math. Bias questions on the exam are usually "shift more traffic to region X without moving resources" → increase X's bias.</p>

<h3>Multivalue answer</h3>
<p>Returns up to <strong>8 healthy records</strong> (randomly selected if more exist), each individually health-checkable. It is "simple with health checks and multiple values" — client-side load distribution with dead-target pruning. Explicitly <strong>not a load balancer replacement</strong>: no weighting precision, no connection awareness, TTL-bound convergence. Use for stateless fleets of a few nodes where an ELB is overkill, or as cheap resilience in front of regional endpoints. Exam phrasing: "return multiple IP addresses, excluding unhealthy ones, without a load balancer" → multivalue.</p>

<h3>IP-based</h3>
<p>You upload CIDR collections (your knowledge of client address space) and map blocks to records. Use when <em>you</em> know better than latency measurements: route a specific ISP/partner/enterprise's egress ranges to a dedicated stack, honor peering economics, send your own offices to internal-adjacent endpoints. Newest and narrowest policy; recognize it by "route specific known client CIDR ranges differently".</p>

<table>
<thead><tr><th>Scenario phrase</th><th>Policy</th></tr></thead>
<tbody>
<tr><td>"gradually shift 10% of traffic to the new version"</td><td>Weighted</td></tr>
<tr><td>"lowest latency for global users, multi-region"</td><td>Latency</td></tr>
<tr><td>"active-passive DR to a static page"</td><td>Failover</td></tr>
<tr><td>"users in Germany must get the EU stack (compliance)"</td><td>Geolocation</td></tr>
<tr><td>"shift more traffic toward the new region, tunable"</td><td>Geoproximity + bias</td></tr>
<tr><td>"up to 8 healthy IPs, no load balancer"</td><td>Multivalue</td></tr>
<tr><td>"partner's known CIDR ranges to a dedicated endpoint"</td><td>IP-based</td></tr>
</tbody>
</table>

<div class="callout deep">All policies ultimately manipulate one thing: the RRset returned to a resolver, cached for TTL seconds. That means convergence is never faster than TTL (plus resolver misbehavior — some ISPs clamp minimums or ignore low TTLs), answers are per-<em>resolver</em> not per-user (a corporate resolver in Frankfurt makes all its users "German"), and EDNS Client Subnet only partially fixes it. DNS traffic management is eventually consistent traffic management; anything needing deterministic instant shifts belongs in Global Accelerator or an LB layer, not DNS.</div>

<div class="callout war">Weighted-canary rollbacks are TTL-bound: with a 300 s TTL, "set weight to 0" still leaves up to five minutes of stragglers, longer with TTL-ignoring resolvers. Run canary records at 60 s TTLs before you need them — TTL changes themselves take old-TTL time to propagate, so you cannot shorten your way out of an incident retroactively. Plan TTLs as an availability parameter, not a caching optimization.</div>

<div class="callout exam">Two policies get confused deliberately: geolocation (WHERE THE USER IS, jurisdiction/compliance flavor) vs geoproximity (DISTANCE TO RESOURCES with adjustable bias, traffic-engineering flavor). And latency vs geolocation: latency questions say "performance/fastest"; geolocation questions say "must/compliance/local content". Match the verb.</div>
`
    },
    {
      id: "health-checks",
      title: "Health Checks and Failover Mechanics",
      html: `
<p>Route 53 health checks are the sensory system behind failover, multivalue, weighted-with-pruning, and everything DR-shaped. Internals matter here, because the exam tests the mechanics and production tests your assumptions.</p>

<h3>The three health check types</h3>
<ul>
<li><strong>Endpoint checks:</strong> a global fleet of checkers (15+ locations) probes your endpoint by IP or domain name over HTTP, HTTPS, or TCP. HTTP(S) checks pass on 2xx/3xx; optional <strong>string matching</strong> searches the first 5120 bytes of the body. Intervals: standard <strong>30 s</strong> or fast <strong>10 s</strong> (extra cost). Failure threshold default 3 consecutive failures. The endpoint is considered healthy if more than <strong>18% of checkers</strong> report healthy — a quorum defending against a single checker region's network weather. Checkers do not follow redirects meaningfully for health semantics (3xx counts as success unless string matching), and HTTPS checks <strong>do not validate the certificate</strong> — expired certs still pass, a documented surprise.</li>
<li><strong>Calculated checks:</strong> a parent check aggregating up to <strong>255 child checks</strong> with a threshold (healthy if at least N of M children healthy) or boolean logic (AND/OR/NOT via the CloudWatch-style combination). Use to express "the region is healthy if 2 of 3 critical services are" — health as an expression over subsystems.</li>
<li><strong>CloudWatch alarm checks:</strong> health follows a CloudWatch alarm's state. This is <em>the</em> answer for <strong>private resources</strong>: the public checker fleet cannot reach into your VPC, so you alarm on an instance/app metric and bind the health check to the alarm. Also the hook for arbitrary custom logic — anything you can express as a metric becomes routable health. Nuance: INSUFFICIENT_DATA state maps to a configurable status (healthy by default — decide deliberately).</li>
</ul>

<div class="callout exam">"Health check a web server that has no public IP / is in a private subnet" → CloudWatch alarm-based health check. The distractor is "allow the Route 53 checker CIDRs through the firewall", which only works for public-but-firewalled endpoints (a legitimate different scenario: the checker IP ranges are published and must be allowed through SGs/WAF for public endpoint checks — know both patterns and which question is being asked).</div>

<h3>Failover mechanics, precisely</h3>
<p>When a health check fails, nothing is "switched" anywhere — Route 53 simply stops including the unhealthy record in answers. Consequences a senior engineer should reason through:</p>
<ul>
<li><strong>Detection time:</strong> interval × threshold (30 s × 3 = ~90 s standard; 10 s × 3 = ~30 s fast) plus internal propagation. Then <strong>client convergence adds TTL</strong>: caches holding the dead answer serve it until expiry. Real RTO at the DNS layer = detection + TTL + resolver sloppiness. This is why failover records want 60 s TTLs.</li>
<li><strong>Fail-safe behavior:</strong> if <em>all</em> records in a policy set are unhealthy, Route 53 answers as if all were healthy ("fail open") — the reasoning being a possibly-working answer beats NXDOMAIN. Do not design assuming an empty answer signals total failure.</li>
<li><strong>Failover policy specifics:</strong> the secondary needs no health check (it is the answer of last resort), though it can have one. If the primary record is an alias with EvaluateTargetHealth, that substitutes for an explicit check. Failback is automatic on primary recovery — see ARC (lesson 7) for when automatic failback is the bug, not the feature.</li>
<li><strong>What checkers measure is reachability from the internet</strong>, not user experience: a check passing while your database is down happens unless the checked path exercises dependencies. Best practice: point checks at a <strong>deep health endpoint</strong> that validates critical dependencies (with cheap caching to survive checker request volume — 15+ locations × fast interval is nontrivial QPS), and string-match a body token so a load balancer's default 200 page cannot masquerade as health.</li>
</ul>

<div class="callout deep">The checker fleet is intentionally dumb and distributed: many vantage points doing cheap probes, aggregated by quorum (the 18% rule), because the alternative — one smart checker — makes the checker's network position part of your availability math. This is the same reasoning as BGP anycast health: measure from many places, believe the majority, tolerate any single vantage lying. Corollary: brief regional internet weather between checkers and your endpoint can flap health without any change in your infrastructure; thresholds and intervals are your damping constants.</div>

<div class="callout war">Production incidents to learn from vicariously: (1) A team health-checked the ALB DNS name over HTTP without string matching; the app died but the ALB kept serving 503s from its static response — 5xx does fail checks, but a later "maintenance mode" 200 page kept the check green while users saw a maintenance page for six hours. String-match a token from the real app. (2) Fast health checks against an endpoint doing uncached deep checks DDoSed their own database — 15 checkers × 10 s × dependency fan-out. Cache the deep check for a second or two. (3) Nobody allowed the published checker CIDRs through a new WAF rule; both regions were marked unhealthy simultaneously and fail-open masked it until the next real failure.</div>

<div class="callout limits">Memorize: 30 s standard / 10 s fast intervals; default failure threshold 3; string matching searches the first 5120 bytes; calculated checks aggregate up to 255 children; healthy quorum is more than 18% of checkers; HTTPS checks skip certificate validation; health checkers are a public fleet with published IP ranges. Health checks bill ~0.50 USD/month each (AWS endpoints) to ~0.75 USD (non-AWS), extra for fast interval and string matching — trivial cost, but the exam likes "EvaluateTargetHealth avoids health-check charges for AWS targets".</div>

<p>Design doctrine: health checks are sensors, TTL is your actuator latency, and fail-open is the system's bias. Size detection (interval × threshold) against your flap tolerance, keep failover-record TTLs at 60 s, check deep-but-cached endpoints, and rehearse the failover by breaking the primary on purpose — a DR path never exercised is a DR path that fails novelly.</p>
`
    },
    {
      id: "private-split-horizon",
      title: "Private Hosted Zones and Split-Horizon DNS",
      html: `
<p>A <strong>private hosted zone</strong> is authoritative DNS that exists only for resolvers inside VPCs you associate — the classic enterprise internal-DNS use case (corp.example.com for service discovery, internal endpoints, environment-specific names) minus the BIND servers, views, and 2 a.m. zone-file syntax errors.</p>

<h3>Mechanics</h3>
<ul>
<li>Queries reach a PHZ only via <strong>Route 53 Resolver</strong> (the VPC +2 resolver or Resolver endpoints). Internet resolvers never see it; there are no public NS to leak. Association — not peering, not routing — controls visibility: a VPC resolves the zone iff it is associated with it.</li>
<li>Associated VPCs need <strong>enableDnsSupport and enableDnsHostnames both true</strong> (the recurring prerequisite; API-created VPCs default hostnames to false).</li>
<li><strong>Cross-account association</strong> is fully supported but CLI/API-only, via a handshake: the zone owner runs create-vpc-association-authorization for the target VPC; the VPC owner runs associate-vpc-with-hosted-zone; the authorization is then best deleted (it is a standing invitation otherwise). No console support — an exam-worthy operational detail and the building block for centralized DNS accounts (the Pro module scales this pattern).</li>
<li>Routing policies and health checks work in PHZs with caveats: health checks against private IPs need the CloudWatch-alarm flavor (public checkers cannot reach in). Weighted/failover inside a PHZ is a legitimate internal-services DR pattern.</li>
</ul>

<h3>Split-horizon (split-view) DNS</h3>
<p>Create a private zone with the <strong>same name</strong> as a public zone — example.com both publicly hosted and privately hosted — and associated VPCs get different answers than the internet. Route 53 Resolver prefers the most specific matching <em>private</em> zone for queries from associated VPCs; only names it cannot answer from the PHZ fall through to public resolution. Uses:</p>
<ul>
<li>Internal clients hit internal load balancers / private IPs for the same hostnames external users hit through CloudFront — no hairpinning through the public edge, no NAT traversal, lower latency, no data-processing charges for internal east-west traffic.</li>
<li>Hiding internal-only services (admin.example.com exists privately, is NXDOMAIN publicly).</li>
<li>Environment overrides: a staging VPC's PHZ overrides api.example.com to point at staging backends without touching application config.</li>
</ul>

<div class="callout war">Split-horizon's classic foot-gun: the private zone <strong>shadows the entire name</strong>, not just the records you define. If public example.com has 40 records and your PHZ example.com defines 3, associated VPCs get NXDOMAIN for the other 37 — the resolver does not fall through to public for names within a matched private zone. Symptoms: "the app works everywhere except inside the VPC" for some hostname nobody copied into the PHZ. Either replicate every needed record into the private zone or scope the PHZ to a subdomain (internal.example.com) to avoid shadowing. This exact failure mode appears on the exam phrased as 'after creating a private hosted zone, some public hostnames stopped resolving from the VPC'.</div>

<div class="callout deep">Precedence rules worth knowing exactly: for a query from an associated VPC, Route 53 Resolver picks the <strong>most specific</strong> private zone that matches the query name (a PHZ for a.example.com beats a PHZ for example.com for queries under a.example.com); within that zone, normal DNS matching applies including NXDOMAIN for missing names. Resolver forwarding rules (next lesson) are consulted with similar most-specific-wins logic, and a rule for a domain takes precedence over public resolution but interacts with PHZs by specificity. When debugging, think like the resolver: which single most-specific thing — PHZ, rule, public — owns this name from this VPC?</div>

<h3>PHZ vs alternatives</h3>
<table>
<thead><tr><th>Need</th><th>Right tool</th></tr></thead>
<tbody>
<tr><td>Internal names resolvable across many VPCs/accounts</td><td>PHZ + cross-account VPC associations (or shared via central DNS pattern)</td></tr>
<tr><td>Same name, different internal vs external answers</td><td>Split-horizon: public zone + same-name PHZ</td></tr>
<tr><td>Service discovery with health/instance registration (ECS etc.)</td><td>Cloud Map (which manages PHZ records for you)</td></tr>
<tr><td>Resolve on-prem domains from VPCs</td><td>Resolver outbound endpoint + forwarding rules (not a PHZ)</td></tr>
<tr><td>On-prem resolving VPC names</td><td>Resolver inbound endpoint (next lesson)</td></tr>
</tbody>
</table>

<div class="callout exam">Trigger phrases: "resolve internal domain names within VPCs without exposing them to the internet" → private hosted zone. "Different responses for internal and external users of the same domain" → split-horizon with identically named public and private zones. "Private hosted zone not resolving" → check the two VPC DNS attributes, then check the VPC is actually associated. "Associate a VPC in another account" → create-vpc-association-authorization then associate — the two-step CLI handshake.</div>

<div class="callout limits">Private zones: same 0.50 USD/month pricing; up to 1000 VPC associations per zone (soft); association is per-VPC, region-agnostic (a PHZ can serve VPCs in any region — PHZs are not regional). PHZs do not support DNSSEC signing (DNSSEC is for public zones — trust inside the VPC comes from the resolver path itself). No NS delegation records take effect inside PHZs in the way public delegation works — subdomain PHZs are separate zones matched by specificity, not delegated children.</div>

<p>Architecture takeaway: prefer subdomain-scoped PHZs (internal.example.com) over same-name shadowing unless split-horizon is the explicit goal; centralize PHZs in a shared account early (retrofitting cross-account associations across 50 team-owned zones is misery); and remember association is the security boundary — there is no additional auth on PHZ queries, so an associated VPC sees everything in the zone.</p>
`
    },
    {
      id: "resolver-hybrid",
      title: "Route 53 Resolver: Endpoints, Rules, and Hybrid DNS",
      html: `
<p>Route 53 Resolver is the recursive resolver every VPC already uses (the +2 address). Hybrid DNS is the problem of stitching its namespace view together with on-prem DNS (AD, Infoblox, BIND) so each side resolves the other's names. The solution is two endpoint types plus forwarding rules — a design that maps exactly onto conditional forwarding, which you already know from every enterprise DNS system.</p>

<h3>Inbound endpoints: on-prem resolves AWS names</h3>
<p>An <strong>inbound endpoint</strong> puts ENIs with fixed private IPs (2+ across AZs) in your VPC that accept DNS queries on 53/udp+tcp from anywhere routable — on-prem via DX/VPN, peered VPCs, wherever. Queries arriving there are answered with the full VPC-context view: private hosted zones associated with the endpoint's VPC, VPC internal names, interface-endpoint private DNS names, and public recursion. On the on-prem side you configure plain <strong>conditional forwarders</strong>: aws.example.internal (and any PHZ domains, plus amazonaws.com if you want on-prem to reach interface endpoints' private answers) forwarding to the two inbound endpoint IPs. That is the whole trick — the inbound endpoint makes the VPC resolver addressable by standards-compliant forwarders.</p>

<h3>Outbound endpoints and rules: AWS resolves on-prem names</h3>
<p>An <strong>outbound endpoint</strong> is the reverse: ENIs from which Route 53 Resolver <em>originates</em> queries toward targets you specify. You never point instances at it — instances keep using +2. Instead you create <strong>forwarding rules</strong>:</p>
<ul>
<li><strong>Forward rules:</strong> "for corp.example.internal, forward to 10.200.0.10 and 10.200.0.11 via outbound endpoint X". Most-specific domain match wins.</li>
<li><strong>System rules:</strong> exceptions that restore default Resolver behavior for a subdomain beneath a forwarded domain (forward example.internal on-prem, but resolve cloud.example.internal normally in a PHZ).</li>
</ul>
<p>Rules are attached by <strong>associating them with VPCs</strong> — and critically, rules are <strong>shareable across accounts via AWS RAM</strong>. This enables the canonical multi-account pattern: one networking account owns the endpoints and rules; every other account associates the shared rules with its VPCs; zero per-account DNS infrastructure. (The Pro module builds the full central-DNS architecture on exactly this.)</p>

<div class="callout exam">Direction is the entire question. "On-premises servers must resolve names in a private hosted zone" → <strong>inbound</strong> endpoint (+ on-prem conditional forwarder). "EC2 instances must resolve records held on on-premises DNS servers" → <strong>outbound</strong> endpoint + forwarding rule. Bidirectional → both. Distractors include pointing DHCP option sets at on-prem DNS (works but forfeits PHZs, endpoint private DNS, and VPC names — wrong unless the question explicitly retires AWS DNS) and running BIND forwarders on EC2 (the pre-Resolver legacy answer; wrong on 'managed/least operational overhead' phrasing).</div>

<h3>Failure modes and internals</h3>
<div class="callout deep">Each endpoint ENI handles up to about <strong>10,000 queries per second</strong> (protocol-mix dependent), and an endpoint needs at least two ENIs in distinct AZs — capacity plans multiply ENIs, not endpoints. The +2 per-ENI limit of 1024 pps still applies on the instance side; outbound-rule resolution consumes it like any other query, so heavy on-prem-name traffic from a single chatty instance hits the instance-side limit before the endpoint side. Also note DNS over the endpoints is plain 53 (DoH support exists for endpoints now, but assume classic UDP/TCP fallback semantics: truncation over UDP triggering TCP retry through your SGs — allow BOTH protocols in the endpoint security groups, a real-world silent breaker of large responses like DNSSEC-signed answers and fat TXT records).</div>

<div class="callout war">Hybrid DNS outages are almost never Resolver failures; they are path failures dressed as DNS: DX down and the forwarding rule's on-prem targets unreachable (queries time out after retries — latency spikes app-wide because everything resolves slowly before failing), SGs on endpoint ENIs missing TCP/53, or on-prem forwarders configured against ONE inbound IP instead of both AZs' IPs. Also: forwarding ALL traffic (a dot rule for everything) to on-prem makes on-prem a hard dependency of every AWS lookup — resist central-IT pressure to do this; forward only the domains on-prem actually owns.</div>

<h3>Resolver DNS Firewall and query logging</h3>
<p>Adjacent features that share the Resolver dataplane: <strong>Resolver Query Logging</strong> captures every query from VPC workloads (to S3/CW/Firehose) — remember VPC Flow Logs explicitly exclude resolver traffic, so this is the only way to see DNS activity; and <strong>DNS Firewall</strong> filters queries against domain lists (managed threat lists or custom allow/deny) — the DNS-exfiltration control, since Flow Logs cannot see and NACLs cannot express domain-level policy. Exam phrasing: "log all DNS queries from the VPC" → Resolver query logging; "block resolution of known-malicious domains / prevent DNS exfiltration" → Resolver DNS Firewall.</p>

<div class="callout limits">Numbers: 2-6 ENIs typical per endpoint (max 6), ~10k QPS per ENI, endpoints bill ~0.125 USD/ENI-hour (~90 USD/month for a 2-ENI endpoint — why you centralize rather than per-VPC endpoints) plus per-query charges beyond the free tier. Rules per account: 1000 (soft). Rule associations per VPC: 500 (soft). Inbound endpoint IPs are static for the endpoint's life — safe to hardcode in on-prem forwarder config.</div>

<p>Decision summary: inbound = others query us; outbound = we query others; rules = which domains go where, shared org-wide via RAM; DHCP-option replacement = almost never. Keep the +2 resolver as every instance's resolver and do all redirection server-side in Resolver — that composition (PHZ + rules + public recursion behind one resolver) is the entire reason the design works.</p>
`
    },
    {
      id: "dnssec-arc",
      title: "DNSSEC and Application Recovery Controller",
      html: `
<p>Two advanced-reliability topics close the module: cryptographic integrity for public DNS answers, and a control plane for deliberate, safe regional failover when automatic DNS failover is not trustworthy enough.</p>

<h3>DNSSEC on Route 53</h3>
<p>You know the model: zones sign RRsets (RRSIG) with a zone-signing key (ZSK), the ZSK is vouched for by a key-signing key (KSK), the parent zone publishes a <strong>DS record</strong> hashing your KSK, and the chain of trust runs from the root down. Validating resolvers reject forged answers — DNSSEC provides <em>integrity and authenticated denial</em>, not confidentiality (answers are still plaintext; that is DoH/DoT territory).</p>
<p>Route 53 specifics:</p>
<ul>
<li><strong>Signing is per public hosted zone</strong> (PHZs cannot be signed — no meaningful trust chain inside a VPC). Enable signing, and Route 53 manages the ZSK and online signing transparently.</li>
<li><strong>The KSK is yours, in KMS:</strong> an asymmetric customer-managed key (ECC P-256) in us-east-1. You own its lifecycle — rotation is a deliberate operation (add new KSK, publish, update DS at parent, retire old), not automatic.</li>
<li><strong>The chain of trust requires the DS record at the parent.</strong> If Route 53 is also your registrar, you can push the DS from the console; with a third-party registrar you paste DS material there. No DS at the parent = signed zone that validators treat as insecure (unsigned) — signing without delegation completes nothing.</li>
<li>On the resolver side, <strong>Route 53 Resolver can enable DNSSEC validation</strong> per VPC — it validates answers for your workloads' outbound lookups. Signing (authoritative) and validation (recursive) are independent switches; the exam occasionally checks that you know which side a requirement lives on.</li>
</ul>

<div class="callout war">DNSSEC's operational failure mode is self-inflicted unavailability: break the chain (expired signatures, botched KSK rotation, stale DS after migrating providers) and validating resolvers hard-fail your domain — SERVFAIL for a large share of the internet while non-validating resolvers work, the most confusing partial outage pattern in DNS. Before enabling: lower the zone's TTLs; before any KSK/DS change: follow the documented add-then-remove sequence and wait out TTLs. Also mind response size: signed answers are larger, UDP truncation and TCP fallback become common — another reason endpoint SGs and on-prem firewalls must pass TCP/53.</div>

<div class="callout exam">DNSSEC phrasing is reliably shallow on SAA: "protect against DNS spoofing / cache poisoning for a public domain" → enable DNSSEC signing (and know the DS-at-registrar step). Distractors offer TLS certificates (wrong layer) or Shield (DDoS, unrelated). SAP can add the KMS detail: KSK uses an asymmetric KMS key in us-east-1.</div>

<h3>Route 53 Application Recovery Controller (ARC)</h3>
<p>Standard health-check failover has structural weaknesses for serious multi-region DR: it is <em>automatic</em> (flaps, fails back on its own schedule), <em>reactive</em> (measures reachability, not readiness), and its decision inputs live partly in the control plane you might be failing away from. ARC is the deliberate alternative — three components:</p>
<ul>
<li><strong>Readiness checks:</strong> continuously audit that your standby region is actually able to take traffic — capacity quotas match, ASG/table/throughput configurations are symmetric, versions align. This answers "if we fail over right now, does the standby hold?" before you need it, catching the classic DR rot where the standby drifted.</li>
<li><strong>Routing controls:</strong> the core primitive — simple on/off switches, hosted in a <strong>dedicated, highly available data plane spread across five regions</strong>, that Route 53 health checks bind to. Flip the control, the bound health check flips, DNS failover executes. The point: failover becomes an <em>operator decision executed through an extremely available API</em> that does not depend on the health of any single region — including the one that is on fire, and including the Route 53 control plane itself (routing-control changes are a data-plane operation by design; this control-plane/data-plane distinction is exactly what AWS's own DR guidance preaches).</li>
<li><strong>Safety rules:</strong> guardrails on control changes — assertion rules ("at least one region must be active") and gating rules ("no change unless the gate control approves") — preventing the panicked 3 a.m. operator from turning everything off at once.</li>
</ul>

<div class="callout deep">Why a five-region data plane for what is functionally a boolean? Because failover machinery must be strictly more available than the things failing over. Any DR trigger that lives in one region, or depends on a normal control plane, can be unavailable precisely during the event that requires it — the classic circular dependency in DR design. ARC's cluster gives you a quorum-backed switch whose availability is independent of your application regions. The same reasoning explains why AWS recommends against DR runbooks that require, e.g., creating resources (control-plane calls) during a regional event: prefer data-plane-only failover paths, pre-provisioned.</div>

<div class="callout exam">ARC phrasing: "manually control / deliberately initiate failover between regions with guardrails", "ensure the standby region remains ready to receive traffic", "failover mechanism that does not depend on the affected region" → Application Recovery Controller (readiness checks for the standby-drift requirement, routing controls for the deliberate switch, safety rules for guardrails). Plain health-check failover remains correct when the question wants automatic, hands-off DNS failover. ARC is also genuinely expensive (~2.5 USD/hour per cluster) — real architectures reserve it for tier-0 systems, and cost can be the discriminator in a question.</div>

<p>Module synthesis: Route 53 gives you three escalating reliability tiers — TTL-bound automatic failover (health checks + failover/alias records), readiness-verified manual failover (ARC), and, below both, the integrity of the answers themselves (DNSSEC). Match the tier to the blast radius of being wrong, and always remember the physics no product removes: resolvers cache, TTLs gate convergence, and DNS eventually — never instantly — tells the truth.</p>
`
    }
  ],
  quiz: [
    {
      q: "A company hosts its website behind an ALB and wants example.com (the zone apex) and www.example.com to resolve to it, minimizing DNS query charges. Which record configuration is correct?",
      options: [
        "CNAME records for both example.com and www.example.com pointing to the ALB DNS name",
        "Alias A records for both example.com and www.example.com targeting the ALB",
        "An alias A record for example.com and a CNAME for www.example.com",
        "A static A record for example.com using the ALB's current IP addresses and a CNAME for www"
      ],
      answer: [1],
      multi: false,
      explanation: "Aliases are required at the apex (CNAME is protocol-forbidden there) and are the better choice for www too: alias queries to AWS resources are free and avoid the CNAME chain's extra lookup. <strong>A</strong> is invalid — a CNAME cannot exist at the apex alongside SOA/NS. <strong>C</strong> works but pays per-query for the CNAME and adds resolution latency, failing the 'minimize charges' requirement. <strong>D</strong> is a time bomb — ALB IPs rotate; static A records will break silently, which is exactly why alias records exist."
    },
    {
      q: "A domain is registered with a third-party registrar. The operations team created a Route 53 public hosted zone and its records, but the site still resolves via the old provider. What is the missing step?",
      options: [
        "Update the NS records at the registrar to the four nameservers assigned to the Route 53 hosted zone",
        "Create NS records in the Route 53 zone pointing at the registrar's servers",
        "Transfer the domain registration into Route 53 Domains",
        "Lower the SOA TTL in the Route 53 hosted zone to force propagation"
      ],
      answer: [0],
      multi: false,
      explanation: "Delegation is controlled by the parent: until the registrar publishes the hosted zone's four assigned nameservers as the domain's NS, the world keeps resolving via the incumbent provider. <strong>B</strong> inverts delegation — NS records inside your own zone do not tell parents anything. <strong>C</strong> conflates registration with hosting; transferring the registration is never required to host DNS on Route 53. <strong>D</strong> is cargo-cult: SOA TTL tuning in a zone nobody is delegated to accomplishes nothing."
    },
    {
      q: "A team is rolling out a new application stack and wants to send 5% of production traffic to it, increasing gradually, with the ability to instantly stop sending traffic to the new stack if errors spike. Which routing policy and mechanism fit, and what limits the speed of the emergency stop?",
      options: [
        "Weighted routing with weights 95 and 5; setting the new record's weight to 0 stops traffic, bounded by the record TTL on caching resolvers",
        "Failover routing with the new stack as secondary; deleting the health check stops traffic immediately",
        "Latency routing with the new stack in a closer region; removing the record stops traffic immediately",
        "Multivalue answer routing; unhealthy marking stops traffic within the health check interval"
      ],
      answer: [0],
      multi: false,
      explanation: "Weighted routing is the canary policy — proportional answers by weight, and weight 0 is the documented kill switch — but resolvers cache answers, so full convergence takes up to the TTL (hence low TTLs on canary records). <strong>B</strong> misuses failover, which is active-passive by health, not proportional splitting. <strong>C</strong> misunderstands latency routing — it follows measured latency, not rollout intent, and no DNS change is 'immediate' given caches. <strong>D</strong> returns up to 8 healthy records with no proportional control; 5% is inexpressible."
    },
    {
      q: "A global application runs in eu-west-1 and ap-southeast-2. Regulatory requirements state that users located in Australia MUST be served from the Australian stack, regardless of network performance. Which routing policy is required?",
      options: [
        "Latency-based routing with records tagged for both regions",
        "Geolocation routing with a country rule for Australia and a default record",
        "Geoproximity routing with increased bias on ap-southeast-2",
        "Weighted routing favoring ap-southeast-2 for Australian resolvers"
      ],
      answer: [1],
      multi: false,
      explanation: "The word MUST plus jurisdiction makes this geolocation: routing determined by where the user is, with a default record for everyone unmatched. <strong>A</strong> is the trap — latency routing usually sends Australians to Sydney, but 'usually' fails compliance; a routing anomaly could legally misroute them. <strong>C</strong> is distance-with-tuning, a traffic-engineering tool with no guarantee tied to political boundaries. <strong>D</strong> cannot see user location at all — weights are global proportions."
    },
    {
      q: "After launching a third region, an architect wants to gradually shift a larger share of nearby users toward it without moving any infrastructure, tuning the share over several weeks. Which mechanism does this?",
      options: [
        "Increase the new region's bias in a geoproximity routing policy",
        "Add the new region to a latency-based policy and wait for measurements to adjust",
        "Create geolocation records for each country near the new region",
        "Enable multivalue answers including the new region's endpoints"
      ],
      answer: [0],
      multi: false,
      explanation: "Bias is geoproximity's defining knob: expanding a resource's catchment area (-99 to +99) shifts the geographic boundary between regions gradually and reversibly — exactly 'tune the share over weeks'. <strong>B</strong> gives you no knob at all; latency routing follows measurements you do not control. <strong>C</strong> is step-function reassignment by country — coarse, manual, and not tunable in shares. <strong>D</strong> just adds IPs to answers with no geographic weighting whatsoever."
    },
    {
      q: "A web application's primary region should serve all traffic, with automatic DNS failover to a static maintenance page in S3/CloudFront when the primary fails. The primary is fronted by an ALB. What is the LEAST-cost correct configuration?",
      options: [
        "Failover policy: primary alias record to the ALB with EvaluateTargetHealth enabled, secondary alias record to the CloudFront distribution",
        "Failover policy: primary alias to the ALB with an HTTPS endpoint health check, secondary alias to CloudFront, plus a health check on CloudFront",
        "Weighted policy with weights 255 and 0, flipped by a Lambda when CloudWatch alarms fire",
        "Latency policy between the ALB and CloudFront endpoints"
      ],
      answer: [0],
      multi: false,
      explanation: "EvaluateTargetHealth on an alias to an AWS resource substitutes for a paid health check — Route 53 consults the ALB's own health state — and the secondary in a failover pair needs no check of its own. That makes <strong>A</strong> both correct and the cheapest. <strong>B</strong> works but pays for two health checks the design does not need, failing 'least cost'. <strong>C</strong> reinvents failover with custom automation, adding latency (alarm evaluation plus Lambda plus API call) and failure modes. <strong>D</strong> is nonsense — latency routing between a primary and its maintenance page would serve the maintenance page to whoever is 'closer' to it."
    },
    {
      q: "A health check must reflect the health of a web application running on instances in private subnets with no public IPs. How should the health check be configured?",
      options: [
        "An HTTPS endpoint health check against the instances' private IPs, allowing the Route 53 checker CIDR ranges in the security group",
        "A CloudWatch alarm on an application health metric, with a Route 53 health check bound to the alarm state",
        "A TCP health check against the NAT gateway's Elastic IP",
        "A calculated health check with the private instances as children"
      ],
      answer: [1],
      multi: false,
      explanation: "The Route 53 checker fleet lives on the public internet and cannot reach private IPs no matter what the security group allows — routing, not filtering, is the barrier — so private-resource health must flow through CloudWatch: metric, alarm, alarm-backed health check. <strong>A</strong> fails because allowing checker CIDRs is only meaningful for publicly routable endpoints. <strong>C</strong> checks the NAT gateway, which says nothing about the application (and NAT is egress-only — inbound TCP to its EIP does not reach instances). <strong>D</strong> misunderstands calculated checks: they aggregate other health checks, and endpoint checks against private IPs cannot exist as children in the first place."
    },
    {
      q: "During a partial outage, every record in a weighted set backed by health checks became unhealthy simultaneously. What does Route 53 return for queries to that name?",
      options: [
        "An empty answer (NODATA), causing clients to fail fast",
        "Answers as if all records were healthy, since Route 53 fails open when no record is healthy",
        "Only the record with the highest weight",
        "SERVFAIL until at least one health check recovers"
      ],
      answer: [1],
      multi: false,
      explanation: "Route 53's documented fail-open behavior: when all records in a set are unhealthy, it answers as if all were healthy, on the theory that a possibly-working answer beats a guaranteed-dead one. Designs must not assume DNS goes silent on total failure. <strong>A</strong> and <strong>D</strong> describe fail-closed behaviors Route 53 deliberately avoids. <strong>C</strong> invents a tiebreak rule that does not exist — normal weighted proportions resume across all records."
    },
    {
      q: "A company created a private hosted zone for example.com, containing three records, in the account owning its VPCs. The public example.com zone has dozens of records. Users report that from inside the VPCs, several public example.com hostnames now fail to resolve, while working fine externally. Why?",
      options: [
        "The private zone shadows the entire example.com namespace for associated VPCs, and undefined names return no answer rather than falling through to public DNS",
        "The VPCs' DHCP option sets still point at the public resolvers",
        "Private hosted zones require all records to be aliases",
        "enableDnsHostnames is disabled on the VPCs, blocking public resolution"
      ],
      answer: [0],
      multi: false,
      explanation: "For associated VPCs the most specific matching private zone owns the whole name — Route 53 Resolver does not fall through to the public zone for names missing from a matched PHZ, so the 37 uncopied records effectively vanish inside the VPC. Fixes: replicate needed records into the PHZ or scope the PHZ to a subdomain. <strong>B</strong> would break PHZ resolution entirely, not selectively. <strong>C</strong> is fictional. <strong>D</strong> would prevent the PHZ from working at all — the observed behavior (PHZ records resolving, public ones missing) proves the attributes are fine."
    },
    {
      q: "On-premises Active Directory servers must resolve records in a Route 53 private hosted zone over an existing Direct Connect link, and EC2 instances must resolve corp.internal names held on the AD servers. Which combination is required?",
      options: [
        "A Resolver inbound endpoint with AD conditional forwarders pointing to it, plus a Resolver outbound endpoint with a forwarding rule for corp.internal targeting the AD servers",
        "A Resolver outbound endpoint for both directions, with rules for each domain",
        "Associate the on-premises network with the private hosted zone and add the AD servers to the VPC DHCP options",
        "Two inbound endpoints, one per direction of resolution"
      ],
      answer: [0],
      multi: false,
      explanation: "Direction determines endpoint type: on-prem querying AWS names needs an inbound endpoint (addressable ENI IPs the AD forwarders can target); AWS querying on-prem names needs an outbound endpoint plus a rule mapping corp.internal to the AD IPs. Bidirectional means both. <strong>B</strong> is half a solution — outbound endpoints only originate queries; they give on-prem nothing to query. <strong>C</strong> is doubly wrong: PHZs associate with VPCs, not networks, and swapping DHCP options to AD forfeits PHZ and endpoint DNS for the instances. <strong>D</strong> misreads the endpoint model — inbound endpoints cannot forward outward."
    },
    {
      q: "An organization runs 60 VPCs across 30 accounts and needs all of them to resolve on-premises domains through a single pair of Resolver outbound endpoints in a networking account, with minimal per-account setup. What enables this?",
      options: [
        "Sharing the Resolver forwarding rules to the organization via AWS RAM and associating them with each account's VPCs",
        "Creating outbound endpoints in every VPC and copying the rules",
        "Peering every VPC to the networking VPC so DNS queries route to its resolver",
        "Publishing the on-premises zone as a public hosted zone"
      ],
      answer: [0],
      multi: false,
      explanation: "Resolver rules are RAM-shareable: the networking account owns the endpoints and rules; other accounts merely associate the shared rules with their VPCs, and their queries egress through the central endpoints — the standard hub pattern, ~90 USD/month once instead of per VPC. <strong>B</strong> works but multiplies cost (an endpoint pair per VPC) and management 60-fold — the question says minimal setup. <strong>C</strong> misunderstands the resolver: each VPC's +2 resolver is local; peering does not redirect DNS resolution to another VPC's resolver. <strong>D</strong> publishes internal names to the internet — a security regression, not a solution."
    },
    {
      q: "After enabling DNSSEC signing on a Route 53 public hosted zone for a domain registered with a third-party registrar, validating resolvers still treat the domain as insecure. What completes the chain of trust?",
      options: [
        "Provide the DS record material to the registrar so it is published in the parent zone",
        "Enable DNSSEC validation on Route 53 Resolver",
        "Rotate the zone-signing key to force revalidation",
        "Move the KMS key for the KSK into the same region as the hosted zone"
      ],
      answer: [0],
      multi: false,
      explanation: "The chain of trust runs from the parent down: without a DS record in the TLD zone hashing your KSK, validators have no path to your keys and treat the zone as unsigned. With a third-party registrar you supply the DS material to them. <strong>B</strong> is the resolver-side (validation) switch — it affects lookups your VPC workloads make, not whether the world can validate your zone. <strong>C</strong> touches the wrong key and solves nothing absent delegation. <strong>D</strong> is a distractor — the KSK's KMS key is required to be in us-east-1; hosted zones are global and have no region to match."
    },
    {
      q: "A tier-0 payment platform runs active-passive across two regions. Requirements: failover must be a deliberate operator action with guardrails preventing both regions being disabled, must work even if the primary region and its control planes are impaired, and the standby's capacity and configuration must be continuously verified. Which service meets all three?",
      options: [
        "Route 53 failover routing with fast health checks",
        "Route 53 Application Recovery Controller: routing controls for deliberate failover, safety rules as guardrails, readiness checks for standby verification",
        "CloudWatch cross-region alarms triggering a Lambda that updates Route 53 records",
        "Global Accelerator with endpoint weights set manually during an incident"
      ],
      answer: [1],
      multi: false,
      explanation: "The three requirements map one-to-one onto ARC's three components: routing controls are operator-flipped switches in a five-region data plane independent of the failing region; safety rules assert invariants like 'at least one region active'; readiness checks continuously audit standby capacity/config symmetry. <strong>A</strong> is automatic (not deliberate), has no guardrails, and verifies reachability, not readiness. <strong>C</strong> depends on control-plane API calls during an event and a hand-built Lambda — precisely the circular dependency ARC exists to remove — and has no readiness auditing. <strong>D</strong> lacks guardrails and readiness checks, and manual console changes during an impaired-region event are the anti-pattern."
    },
    {
      q: "A DNS migration to Route 53 is planned for a high-traffic domain currently hosted elsewhere. Which sequence minimizes resolution risk?",
      options: [
        "Lower TTLs at the current provider in advance, replicate all records into the new hosted zone, update NS at the registrar, keep the old zone serving until parent NS TTLs expire",
        "Update NS at the registrar first, then copy records into Route 53 as queries arrive",
        "Delete the old zone to prevent split answers, then create the Route 53 zone and update NS",
        "Create the Route 53 zone, enable DNSSEC to force resolvers to refresh, then update NS"
      ],
      answer: [0],
      multi: false,
      explanation: "The safe order is entirely TTL-driven: shrink caches in advance, have the complete record set live at the new host BEFORE delegation changes, and run both zones in parallel until straggler resolvers (bounded by parent NS TTLs, often up to ~48 h) have converged. <strong>B</strong> guarantees an outage window — resolvers hitting Route 53 before records exist get NXDOMAIN. <strong>C</strong> creates a hard gap with no authoritative zone serving stragglers. <strong>D</strong> misuses DNSSEC, which does not force cache refresh and, enabled mid-migration, adds the riskiest possible variable (chain-of-trust breakage) at the worst time."
    }
  ],
  flashcards: [
    { front: "Why can't a CNAME exist at the zone apex?", back: "RFC 1034: CNAME cannot coexist with other data at a name, and the apex must hold SOA + NS. Route 53's answer: the <strong>alias</strong> record — synthesized A/AAAA answers, legal at the apex." },
    { front: "Three advantages of alias records over CNAMEs for AWS targets", back: "1) Legal at the zone apex. 2) <strong>Free queries</strong> to AWS resources. 3) Health-aware via <strong>EvaluateTargetHealth</strong> (no separate health check needed). Bonus: no CNAME-chain extra lookup." },
    { front: "Name five valid alias targets — and two invalid ones", back: "Valid: ALB/NLB, CloudFront, API Gateway, S3 <em>website</em> endpoint, Global Accelerator, Beanstalk, interface endpoints, same-zone records. Invalid: <strong>EC2 public DNS names, RDS endpoints</strong>, arbitrary external names." },
    { front: "Who controls DNS delegation to a Route 53 hosted zone?", back: "The <strong>parent</strong> — NS records at the registrar (or parent zone) must list the zone's four assigned nameservers. NS records inside your own zone change nothing." },
    { front: "Weighted routing: how do you stop traffic to one record instantly?", back: "Set its <strong>weight to 0</strong> — Route 53 stops returning it. But convergence is bounded by the record's <strong>TTL</strong> on caching resolvers; run canaries at 60 s TTLs." },
    { front: "Latency vs geolocation routing — the discriminator", back: "Latency = <strong>measured network latency</strong> to AWS regions, 'fastest experience'. Geolocation = <strong>where the user is</strong> (continent/country/state), for compliance and localization — 'users in X MUST get Y'. Geolocation needs a default record." },
    { front: "Geoproximity bias — what does it do?", back: "Bias (-99 to +99) expands or shrinks a resource's geographic catchment. 'Gradually shift more traffic to region X without moving anything' = increase X's bias. Requires Traffic Flow." },
    { front: "Multivalue answer routing in one sentence", back: "Returns up to <strong>8 healthy records</strong> (each health-checkable) for client-side selection — cheap dead-target pruning, NOT a load balancer (no weights, no connection awareness)." },
    { front: "IP-based routing — when?", back: "When YOU know the client address space better than latency measurements: map uploaded <strong>CIDR collections</strong> (partner ranges, ISPs, your offices) to specific records." },
    { front: "Route 53 health check: intervals, threshold, quorum", back: "Standard <strong>30 s</strong> / fast <strong>10 s</strong>; default failure threshold 3; endpoint healthy if <strong>more than 18%</strong> of the global checker fleet agrees. String match: first <strong>5120 bytes</strong>. HTTPS checks do NOT validate certificates." },
    { front: "How do you health-check a private (no public IP) resource?", back: "<strong>CloudWatch alarm-based health check</strong> — public checkers can't route into a VPC. Alarm on an app metric, bind the health check to the alarm state." },
    { front: "What happens when ALL records in a set are unhealthy?", back: "Route 53 <strong>fails open</strong> — answers as if all were healthy. It never returns an empty answer due to health; don't design assuming DNS goes silent on total failure." },
    { front: "Calculated health checks — capacity and use", back: "One parent aggregates up to <strong>255 child checks</strong> with threshold or AND/OR/NOT logic — express 'region healthy if 2 of 3 subsystems are'." },
    { front: "EvaluateTargetHealth — what and why it saves money", back: "Alias attribute: Route 53 consults the AWS target's own health (e.g., ALB) when answering — failover semantics with <strong>no health-check charges</strong> and no duplicate health config." },
    { front: "Private hosted zone: what controls which VPCs can resolve it?", back: "<strong>Association</strong> — nothing else. Peering/routing don't matter. Each VPC needs enableDnsSupport + enableDnsHostnames true. Cross-account: create-vpc-association-authorization, then associate (CLI/API only)." },
    { front: "Split-horizon shadowing trap", back: "A PHZ named example.com <strong>shadows the whole namespace</strong> for associated VPCs — names not copied into it return no answer; the resolver never falls through to the public zone. Fix: replicate records or scope the PHZ to a subdomain." },
    { front: "Resolver inbound vs outbound endpoint", back: "<strong>Inbound:</strong> ENI IPs that accept queries — on-prem resolves AWS/PHZ names via conditional forwarders. <strong>Outbound:</strong> Resolver originates queries to targets in forwarding rules — AWS resolves on-prem names. Bidirectional = both." },
    { front: "How do 30 accounts share one set of Resolver forwarding rules?", back: "Share the rules via <strong>AWS RAM</strong> from a central networking account; each account associates the shared rules with its VPCs. One endpoint pair (~90 USD/mo) serves the org." },
    { front: "Resolver endpoint throughput and the instance-side DNS limit", back: "~<strong>10,000 QPS per endpoint ENI</strong> (add ENIs to scale, max 6). Separately: <strong>1024 packets/sec per instance ENI</strong> to the +2 resolver — cache DNS locally on busy nodes. Allow UDP AND TCP 53 in endpoint SGs." },
    { front: "How do you log DNS queries from a VPC? (Flow Logs won't.)", back: "<strong>Resolver Query Logging</strong> (to S3/CW/Firehose) — VPC Flow Logs explicitly exclude resolver traffic. Domain-level blocking/exfiltration control = <strong>Resolver DNS Firewall</strong>." },
    { front: "Route 53 DNSSEC: where does each key live?", back: "ZSK: managed by Route 53, signs records online. KSK: <strong>your asymmetric KMS key (ECC P-256) in us-east-1</strong>. Chain of trust completes only when the <strong>DS record is published at the parent/registrar</strong>. Public zones only." },
    { front: "DNSSEC's classic operational failure", back: "Broken chain (expired RRSIGs, botched KSK/DS rotation) = <strong>SERVFAIL from validating resolvers only</strong> — a maddening partial outage. Signed answers are bigger: expect TCP/53 fallback; firewalls must allow it." },
    { front: "ARC's three components and their jobs", back: "<strong>Readiness checks:</strong> continuously verify the standby's capacity/config symmetry. <strong>Routing controls:</strong> operator-flipped switches in a 5-region data plane, bound to health checks. <strong>Safety rules:</strong> guardrails (e.g., 'at least one region on')." },
    { front: "Why does ARC use a dedicated five-region cluster?", back: "Failover machinery must be more available than what it fails over — a switch living in one region (or a normal control plane) can be down during the exact event requiring it. Data-plane-only failover, no circular dependency." },
    { front: "Registrar vs DNS host — the four combinations", back: "Registration (ICANN relationship) and hosting (authoritative zones) are independent: either can be Route 53 or third-party. Migrating hosting = new zone + records, then update NS at the registrar. Deleting the auto-created zone never cancels a registration." }
  ],
  lab: {
    title: "Lab: Routing policies and failover, observed from the resolver's chair",
    html: `
<h3>Goal</h3>
<p>Create a public hosted zone (no domain purchase, no delegation needed), build weighted and failover record sets with a real health check, and watch Route 53's answering behavior directly with the test-dns-answer API and dig against the zone's assigned nameservers. You will observe weight-proportional answers, health-based withdrawal, and fail-open behavior. Cost: the hosted zone bills 0.50 USD (monthly rate, charged even for a short-lived zone) and the health check pennies — total well under 1 USD.</p>

<h3>Architecture</h3>
<p>A hosted zone for a name you do not own (lab-example-witness.com — never delegated, so nothing resolves publicly; we query Route 53's authoritative servers directly, which answer regardless of delegation). Weighted A records simulate a canary; a failover pair backed by an HTTP health check against a public endpoint you can break at will (we use a health check with string matching against an httpbin-style endpoint to flip health states without deploying anything).</p>

<h3>Steps</h3>
<ol>
<li><p>Create the zone and capture its ID and nameservers:</p>
<pre><code>ZONE_ID=$(aws route53 create-hosted-zone \
  --name lab-example-witness.com \
  --caller-reference lab-$(date +%s) \
  --query HostedZone.Id --output text)
aws route53 get-hosted-zone --id $ZONE_ID \
  --query DelegationSet.NameServers</code></pre>
<p>Note the four nameservers span four TLDs — the registry-diversity design from the lesson.</p></li>

<li><p>Create a weighted pair: 90/10 across two fake stack IPs. Two records, same name, distinguished by SetIdentifier:</p>
<pre><code>cat &gt; /tmp/weighted.json &lt;&lt;'EOF'
{"Changes":[
 {"Action":"UPSERT","ResourceRecordSet":{
   "Name":"app.lab-example-witness.com","Type":"A",
   "SetIdentifier":"stable","Weight":90,"TTL":60,
   "ResourceRecords":[{"Value":"198.51.100.10"}]}},
 {"Action":"UPSERT","ResourceRecordSet":{
   "Name":"app.lab-example-witness.com","Type":"A",
   "SetIdentifier":"canary","Weight":10,"TTL":60,
   "ResourceRecords":[{"Value":"198.51.100.20"}]}}
]}
EOF
CHANGE_ID=$(aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID --change-batch file:///tmp/weighted.json \
  --query ChangeInfo.Id --output text)
aws route53 wait resource-record-sets-changed --id $CHANGE_ID</code></pre>
<p>The wait polls GetChange until INSYNC — the ~60 s propagation to the authoritative fleet from the lesson.</p></li>

<li><p>Sample the weighted answers. test-dns-answer asks the zone authoritatively, bypassing all caching:</p>
<pre><code>for i in $(seq 1 20); do
  aws route53 test-dns-answer --hosted-zone-id $ZONE_ID \
    --record-name app.lab-example-witness.com --record-type A \
    --query 'RecordData[0]' --output text
done | sort | uniq -c</code></pre>
<p>Expect roughly 18:2 — weight/sum in action. Run it again with the canary weight set to 0 (edit the JSON, re-apply) and watch the canary vanish from answers: the kill switch, minus the TTL delay real resolvers would add.</p></li>

<li><p>Create a health check that passes: HTTPS against a stable public endpoint with string matching:</p>
<pre><code>HC_ID=$(aws route53 create-health-check \
  --caller-reference hc-$(date +%s) \
  --health-check-config '{"Type":"HTTPS","FullyQualifiedDomainName":"www.amazon.com","Port":443,"ResourcePath":"/","RequestInterval":30,"FailureThreshold":2}' \
  --query HealthCheck.Id --output text)
sleep 90
aws route53 get-health-check-status --health-check-id $HC_ID \
  --query 'HealthCheckObservations[].Report.Status' | head -5</code></pre>
<p>Note the observations come from many checker regions — the quorum fleet from the lesson.</p></li>

<li><p>Create a failover pair for web.lab-example-witness.com: PRIMARY bound to the health check, SECONDARY as the answer of last resort:</p>
<pre><code>cat &gt; /tmp/failover.json &lt;&lt;EOF
{"Changes":[
 {"Action":"UPSERT","ResourceRecordSet":{
   "Name":"web.lab-example-witness.com","Type":"A",
   "SetIdentifier":"primary","Failover":"PRIMARY","TTL":60,
   "HealthCheckId":"$HC_ID",
   "ResourceRecords":[{"Value":"198.51.100.10"}]}},
 {"Action":"UPSERT","ResourceRecordSet":{
   "Name":"web.lab-example-witness.com","Type":"A",
   "SetIdentifier":"secondary","Failover":"SECONDARY","TTL":60,
   "ResourceRecords":[{"Value":"203.0.113.99"}]}}
]}
EOF
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID --change-batch file:///tmp/failover.json</code></pre></li>

<li><p>Break the health check on purpose — invert it (a supported flag that saves us deploying a breakable endpoint):</p>
<pre><code>aws route53 test-dns-answer --hosted-zone-id $ZONE_ID \
  --record-name web.lab-example-witness.com --record-type A
# shows 198.51.100.10 (primary healthy)

aws route53 update-health-check --health-check-id $HC_ID --inverted
sleep 120   # detection = interval x threshold, plus propagation</code></pre></li>
</ol>

<h3>Verify</h3>
<ol>
<li><p>Confirm failover happened:</p>
<pre><code>aws route53 test-dns-answer --hosted-zone-id $ZONE_ID \
  --record-name web.lab-example-witness.com --record-type A \
  --query 'RecordData'</code></pre>
<p>Answer should now be 203.0.113.99 — the primary was withdrawn, not 'switched'. Also query the zone's real nameservers end-to-end with dig (substitute one NS name from step 1): <code>dig @ns-xxxx.awsdns-xx.org web.lab-example-witness.com A +short</code> — same answer, proving the authoritative fleet converged. Note the ~90-120 s you waited is interval times threshold; with a real client population you would add TTL on top — the RTO arithmetic from the lesson.</p></li>
<li><p>Un-invert (<code>aws route53 update-health-check --health-check-id $HC_ID --no-inverted</code>), wait ~2 minutes, and confirm automatic failback to 198.51.100.10 — the behavior that ARC exists to make deliberate instead of automatic.</p></li>
</ol>

<h3>Teardown</h3>
<p>Records must go before the zone; the health check is independent. Order matters because a zone with non-default records refuses deletion.</p>
<ol>
<li><p>Delete all four lab records by re-applying both change batches with "Action":"DELETE" in place of "UPSERT" (edit /tmp/weighted.json and /tmp/failover.json, then re-run both change-resource-record-sets commands). A DELETE must match the existing record exactly, including TTL, weights, and health check ID.</p></li>
<li><pre><code>aws route53 delete-health-check --health-check-id $HC_ID
aws route53 delete-hosted-zone --id $ZONE_ID</code></pre></li>
<li><p>Verify: <code>aws route53 list-hosted-zones --query 'HostedZones[?contains(Name, WITNESS)]'</code> using a lowercase filter for the lab name should return an empty list, and <code>aws route53 list-health-checks</code> should no longer show $HC_ID. The only residual charge is the single 0.50 USD zone-month.</p></li>
</ol>
`
  }
});
