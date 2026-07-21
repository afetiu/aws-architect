/* Module 5 — Load Balancing & Auto Scaling (SAA track) */
window.COURSE.register({
  id: "elb-asg",
  order: 5,
  track: "saa",
  title: "Load Balancing & Auto Scaling",
  description: "The ELB family (ALB, NLB, GWLB, legacy CLB) from the packet level up, target group mechanics that actually decide your failure modes, and Auto Scaling Groups in depth: scaling policies, lifecycle hooks, warm pools, instance refresh, and the termination-order machinery.",
  examWeight: "Heavily tested on SAA-C03 across Resilient Architectures and High-Performing Architectures. Expect 6-10 questions that hinge on picking the right ELB type from keywords, health check and grace period behavior, and choosing the correct scaling policy or lifecycle mechanism.",
  lessons: [

/* ------------------------------------------------------------------ */
/* Lesson 1                                                            */
/* ------------------------------------------------------------------ */
    {
      id: "elb-family",
      title: "The ELB family: mental models and the decision table",
      html: `
<p>Elastic Load Balancing is not one product. It is four products with different positions in the network stack, different failure semantics, and different pricing shapes, sold under one console page. Getting the mental model right for each one answers most exam questions before you read the options.</p>

<h3>Four load balancers, three mental models</h3>
<p>An <strong>Application Load Balancer (ALB)</strong> is a managed fleet of L7 reverse proxies — think nginx or envoy run for you. It <em>terminates</em> the client TCP and TLS connection, parses the HTTP request, evaluates listener rules, then <em>re-originates</em> a brand-new connection to the target. Two independent TCP connections, two TLS sessions if you encrypt to targets, request-level routing, request-level metrics. The client's connection and the target's connection have nothing in common except the bytes of the HTTP message the ALB copies between them.</p>

<p>A <strong>Network Load Balancer (NLB)</strong> is closer to LVS/IPVS: an L4 flow-hash forwarder. It does not parse HTTP at all (it cannot — it may never see plaintext). It picks a target per flow using a hash over the 5-tuple and then rewrites/forwards packets. One logical connection end-to-end; the target's kernel completes the TCP handshake, not the NLB. That is why NLB can preserve the client source IP natively, offer static IPs, handle UDP, and add on the order of tens to hundreds of microseconds instead of milliseconds.</p>

<p>A <strong>Gateway Load Balancer (GWLB)</strong> is a different animal entirely: a transparent <em>bump-in-the-wire</em> for inserting third-party inline appliances (firewalls, IDS/IPS, DPI). It operates at L3, encapsulates the original packets in <strong>GENEVE on UDP port 6081</strong>, and sprays flows across an appliance fleet. Traffic enters via <strong>GWLB endpoints</strong>, which are PrivateLink-powered interface endpoints you put in your route tables. Nobody load balances "an application" with GWLB; you load balance <em>middleboxes</em>.</p>

<p>The <strong>Classic Load Balancer (CLB)</strong> is legacy: a pre-2016 hybrid that does both L4 and basic L7, lacks target groups, host/path routing, and modern features. On the exam it is almost always a distractor — the only legitimate answers involving CLB are "migrate off it" or the rare EC2-Classic reference.</p>

<div class="callout deep">Every ELB is itself a horizontally scaled fleet of nodes, at least one per enabled AZ, fronted by DNS. The DNS name resolves to the current set of node IPs with low TTLs. ALB nodes scale out (and their IPs change) under load — which is exactly why an ALB can never give you a static IP, and why clients that cache DNS beyond the TTL (old JVMs with networkaddress.cache.ttl=-1) will eventually talk to dead nodes. NLB sidesteps this: one stable IP per AZ, optionally an EIP you own.</div>

<h3>The decision table</h3>
<table>
<thead><tr><th></th><th>ALB</th><th>NLB</th><th>GWLB</th><th>CLB (legacy)</th></tr></thead>
<tbody>
<tr><td>OSI layer</td><td>7 (HTTP/HTTPS, gRPC)</td><td>4 (TCP/UDP/TLS)</td><td>3/4 (IP via GENEVE)</td><td>4 + basic 7</td></tr>
<tr><td>Connection model</td><td>Terminate and re-originate</td><td>Flow-hash pass-through</td><td>Encapsulate and forward</td><td>Terminate</td></tr>
<tr><td>Static IP / EIP</td><td>No</td><td>Yes, per AZ</td><td>N/A (endpoint-based)</td><td>No</td></tr>
<tr><td>Routing intelligence</td><td>Host, path, header, query, method, source IP</td><td>None (flow hash)</td><td>None</td><td>Port only</td></tr>
<tr><td>Protocols</td><td>HTTP/1.1, HTTP/2, gRPC, WebSockets</td><td>TCP, UDP, TLS</td><td>All IP traffic</td><td>TCP, SSL, HTTP(S)</td></tr>
<tr><td>Target types</td><td>instance, ip, lambda</td><td>instance, ip, alb</td><td>instance, ip (appliances)</td><td>instances only</td></tr>
<tr><td>Cross-zone default</td><td>On (free)</td><td>Off (billed if on)</td><td>Off (billed if on)</td><td>On via console</td></tr>
<tr><td>Typical added latency</td><td>Milliseconds</td><td>~100 microseconds</td><td>Sub-millisecond + appliance</td><td>Milliseconds</td></tr>
</tbody>
</table>

<div class="callout exam">Keyword-to-answer mappings you should be able to recite: "route by URL path / hostname / HTTP header" &rarr; ALB. "Static IP" or "Elastic IP" or "IP allowlisting by partners" &rarr; NLB. "Millions of requests per second, ultra-low latency" &rarr; NLB. "UDP" (syslog, DNS, game servers, IoT) &rarr; NLB. "Authenticate users before they reach the app" &rarr; ALB with OIDC/Cognito. "Inline third-party firewall / IDS / deep packet inspection at scale" &rarr; GWLB. "Lambda target" &rarr; ALB. "gRPC" &rarr; ALB. Anything praising CLB &rarr; wrong.</div>

<h3>Pricing shape</h3>
<p>You pay per hour per load balancer plus a usage dimension: <strong>LCUs</strong> for ALB (max of new connections/s, active connections, processed bytes, rule evaluations), <strong>NLCUs</strong> for NLB (similar, minus rules), <strong>GLCUs</strong> for GWLB. The practical consequences: an ALB with thousands of rules and tiny requests can be rule-evaluation-bound; an NLB pushing long-lived high-throughput flows is bytes-bound; idle load balancers still cost the hourly floor. For internal microservice meshes with hundreds of services, one ALB with host-based rules is dramatically cheaper than one ALB per service.</p>

<div class="callout war">The most common real-world architecture mistake in this family: putting an ALB where the client needs a fixed address. Teams hardcode the resolved ALB IPs in a partner's firewall, it works for weeks, then the ALB scales out or AWS rotates nodes and traffic half-blackholes. The fixes are NLB (with EIPs) in front, or AWS Global Accelerator, which gives you two static anycast IPs in front of an ALB. If a question mixes "static IP" with "L7 routing", the answer is Global Accelerator + ALB, or an NLB with an ALB-type target group behind it.</div>

<div class="callout limits">Numbers worth memorizing: 50 listeners per load balancer. Default 100 rules per ALB (raisable). ALB target group limits: 1000 targets per target group by default. NLB scales to millions of requests per second without pre-warming; ALBs historically needed pre-warm requests for sudden spikes (largely historical now, but the exam still rewards NLB for "sudden extreme spike" phrasing). GENEVE is always UDP 6081 — memorize the port.</div>

<h3>When NOT to use each</h3>
<ul>
<li><strong>ALB:</strong> non-HTTP protocols, source-IP-sensitive protocols where you cannot use X-Forwarded-For, extreme latency budgets, or when you need a fixed IP.</li>
<li><strong>NLB:</strong> anything needing content-based routing, per-request auth, or request-level observability. Also a poor choice when clients are few and connections are long-lived and unbalanced — flow hashing cannot rebalance an existing flow.</li>
<li><strong>GWLB:</strong> anything that is not inline appliance insertion. It is not an application load balancer and has no health-aware request routing semantics for your app.</li>
<li><strong>CLB:</strong> everything. It exists for un-migrated legacy stacks.</li>
</ul>
`
    },

/* ------------------------------------------------------------------ */
/* Lesson 2                                                            */
/* ------------------------------------------------------------------ */
    {
      id: "alb-deep",
      title: "ALB internals: listeners, rules, target types, and edge auth",
      html: `
<p>Treat the ALB as a managed envoy fleet with a rules engine. Everything it does maps to concepts you already run: listeners are server blocks, rules are route matchers, target groups are upstream clusters, actions are filters. The differences are in the managed-service constraints and the exam-relevant defaults.</p>

<h3>Listeners and the rules engine</h3>
<p>A listener is a port/protocol pair (HTTP:80, HTTPS:443). Each listener has an ordered list of <strong>rules</strong>; each rule has one or more <strong>conditions</strong> ANDed together and a list of <strong>actions</strong>. Conditions can match:</p>
<ul>
<li><strong>host-header</strong> — including wildcards (api.example.com, *.example.com)</li>
<li><strong>path-pattern</strong> — /api/*, /images/*</li>
<li><strong>http-header</strong> — arbitrary header name and value patterns</li>
<li><strong>query-string</strong> — key/value pairs</li>
<li><strong>http-request-method</strong> — GET, POST, etc.</li>
<li><strong>source-ip</strong> — CIDR match on the client IP (the real client IP, not an intermediate proxy, unless something upstream already NATed it)</li>
</ul>
<p>Rules evaluate in <strong>priority order</strong> (lowest number first); the first matching rule wins and evaluation stops — the same first-match-wins semantics as iptables or nginx location ordering with explicit priorities. Every listener has a non-deletable <strong>default rule</strong> evaluated last, the catch-all. A classic operational bug: adding a specific rule at a higher (numerically larger) priority than an existing broad rule, so it never fires.</p>

<h3>Actions: more than forward</h3>
<ul>
<li><strong>forward</strong> — to one target group, or to multiple with <strong>weights</strong>. Weighted target groups are the primitive for canary and blue/green at the ALB layer: 95% to blue, 5% to green, shift gradually. You can enable target-group-level stickiness on the weighted set so a given client stays on the same color across requests.</li>
<li><strong>redirect</strong> — issue 301/302, e.g. the ubiquitous HTTP&rarr;HTTPS redirect, with URI component rewriting (host, path, port, protocol, query).</li>
<li><strong>fixed-response</strong> — return a static status/body straight from the ALB. Useful for maintenance pages, health endpoints, and blocking paths without touching targets.</li>
<li><strong>authenticate-oidc / authenticate-cognito</strong> — run an OpenID Connect code flow <em>before</em> the forward action. The ALB redirects unauthenticated users to the IdP, handles the code exchange, sets its own session cookie (AWSELBAuthSessionCookie), and forwards authenticated requests with signed JWT claims in <code>x-amzn-oidc-data</code> (plus <code>x-amzn-oidc-identity</code> and the access token). Your app validates the JWT signature against the ALB's regional public key and never implements a login flow.</li>
</ul>

<div class="callout exam">"Add authentication to an existing application with minimal code changes" &rarr; ALB authenticate action with Cognito or any OIDC IdP. Distractors will offer API Gateway authorizers (wrong service for plain web apps behind an ALB), rewriting the app, or Cognito Identity Pools (that is AWS-credential federation, not user sign-in at a load balancer).</div>

<div class="callout deep">Because the ALB terminates and re-originates, protocol versions decouple: clients can speak HTTP/2 to the ALB while the ALB speaks HTTP/1.1 to targets — the default. For <strong>gRPC</strong> you set the target group protocol version to gRPC so HTTP/2 is maintained to the target, and the ALB understands gRPC status codes for health checks and routing. <strong>WebSockets</strong> work on both ALB and NLB; on the ALB the Upgrade handshake pins the connection, which then behaves like a long-lived TCP tunnel — after upgrade there is no more L7 routing on that connection. Idle timeout (default 60s, configurable up to 4000s) applies; long-lived idle WebSockets need keepalive pings or a raised timeout, or they get RST at the timeout.</div>

<h3>Target types</h3>
<ul>
<li><strong>instance</strong> — targets registered by EC2 instance ID; traffic goes to the primary ENI's primary private IP. Required for ASG attachment convenience and for source-IP-based routing decisions on the instance.</li>
<li><strong>ip</strong> — targets are raw private IPs from RFC1918 space (and specific ranges). This is how you target ECS tasks in awsvpc mode, EKS pods (via the AWS Load Balancer Controller), on-premises servers over Direct Connect/VPN, and cross-VPC targets over peering. You cannot register public IPs.</li>
<li><strong>lambda</strong> — the ALB synchronously invokes a Lambda function, translating the HTTP request into a JSON event and the JSON response back to HTTP. One function per target group; payload limit 1 MB request/response; multi-value headers are an opt-in flag.</li>
</ul>

<div class="callout war">With ip targets and containers, the deregistration race is the classic production burn: the orchestrator kills a task, the ALB is still mid-drain, and clients see 502s. The 502-vs-504 distinction matters for debugging: a <strong>502</strong> usually means the target closed the connection on the ALB (app crashed, keep-alive timeout on the target shorter than the ALB's idle timeout — always set the app's keep-alive timeout <em>longer</em> than the ALB's); a <strong>504</strong> means the target did not answer within the timeout; a <strong>503</strong> means no registered/healthy capacity taking traffic. Memorize that triage table; it also shows up in exam troubleshooting questions.</div>

<h3>What the target sees</h3>
<p>Because the ALB re-originates, the target's peer address is an ALB node IP. Client identity arrives in <code>X-Forwarded-For</code> (append semantics — trust only the last hop you control), <code>X-Forwarded-Proto</code>, and <code>X-Forwarded-Port</code>. If your security model depends on true source IP at the instance (network ACLs on client IPs, fail2ban-style logic), an ALB breaks it — that is NLB territory, or you parse XFF carefully.</p>

<div class="callout limits">ALB numbers: default rule limits around 100 per load balancer (soft), 5 condition values per rule, 5 weighted target groups per forward action, request timeout to targets is governed by the idle timeout, 1 MB Lambda payload cap, and headers over 16 K total get rejected with a 431-class failure. HTTP/2 is on by default on HTTPS listeners; gRPC requires HTTPS listeners end to end.</div>

<h3>Operational observability</h3>
<p>ALB access logs (to S3, best-effort delivery) include per-request target processing time, response processing time, and the chosen target — indispensable for tail-latency forensics. CloudWatch gives you TargetResponseTime percentiles, HTTPCode_Target_5XX vs HTTPCode_ELB_5XX (the split tells you whose fault the error is: target vs load balancer/no-capacity), RequestCountPerTarget (the target-tracking metric of choice for request-bound fleets), and RejectedConnectionCount when you exhaust the ALB's own connection capacity. Knowing which side emits which metric is both an exam item and the first question in any incident review.</p>
`
    },

/* ------------------------------------------------------------------ */
/* Lesson 3                                                            */
/* ------------------------------------------------------------------ */
    {
      id: "nlb-deep",
      title: "NLB: flow-hash pass-through, static IPs, TLS, and UDP",
      html: `
<p>The NLB's job is to get out of the way. It makes a per-flow decision — which healthy target gets this 5-tuple — then forwards packets with address rewriting, at line rate, in the millions of flows. If the ALB is envoy, the NLB is LVS/IPVS with a managed control plane. Almost every NLB exam question tests whether you know what a pass-through L4 device <em>cannot</em> do, and the handful of stateful quirks AWS layered on top.</p>

<h3>Flow hashing and connection semantics</h3>
<p>For TCP, the NLB hashes protocol, source IP, source port, destination IP, destination port (plus TCP sequence for initial selection) and pins the <strong>flow</strong> to one target for its lifetime. There is no rebalancing of live flows: if you add ten targets, existing long-lived connections stay where they are; only new flows spread out. For UDP, the hash uses only the 4-tuple, so all datagrams from one source ip:port land on one target — which is what stateful UDP protocols (DTLS, QUIC-adjacent things, game sessions) need.</p>

<div class="callout deep">The target, not the NLB, terminates TCP. SYN goes through to the target's kernel; the handshake, congestion control, and retransmits are end-to-end between client and target. Consequences: the NLB adds no buffering, cannot do request pipelining tricks, and the target's SYN backlog and kernel tuning matter directly for connection-storm survival. It also means an idle timeout still exists (350 seconds for TCP) — the NLB tracks flow state, and an idle flow's state expires; the next packet on that dead flow gets an RST. Long-lived database or message-bus connections through an NLB need TCP keepalives under 350s.</div>

<h3>Static IPs and source IP preservation</h3>
<p>Per enabled AZ, an NLB gets one stable node address, and you may supply your own <strong>Elastic IP</strong> per AZ. This is the only ELB with fixed addresses — the reason NLB is the answer for partner allowlisting, legacy clients with hardcoded IPs, and NAT-averse network designs.</p>
<p>Client IP preservation is where people get burned:</p>
<ul>
<li><strong>Target type instance:</strong> client source IP is preserved by default for TCP/UDP. The target sees the real client address; return traffic routes back via the VPC (the NLB is in the return path logically, but the target answers toward the client IP and the VPC routes it — DSR-like semantics). Security groups on the target must therefore allow the <em>client</em> CIDRs, not just the NLB.</li>
<li><strong>Target type ip:</strong> historically source IP was NOT preserved (targets saw the NLB's private IP); client IP preservation is now a toggle, but it cannot be enabled for targets outside the VPC (on-prem IPs) and is off in several combinations. When preservation is off and you still need the client address for TCP, enable <strong>Proxy Protocol v2</strong>, which prepends a binary header with the original 4-tuple — and the target software must be configured to parse it or every connection breaks with garbage-first-bytes errors.</li>
</ul>

<div class="callout war">Two production traps here. First: with client IP preservation on, a client connecting to an NLB that routes to a target <em>in the same instance</em> (or hairpinning to itself) can fail due to loopback source/dest confusion — the documented "hairpinning/loopback not supported with preservation" limitation. Second: enabling Proxy Protocol v2 while any target app is not expecting it is an instant full outage; the header is unconditional per target group.</div>

<h3>TLS listeners: termination without L7</h3>
<p>An NLB can terminate TLS (listener protocol TLS) using ACM certs, offloading handshakes from your fleet while still doing only flow-level routing — it decrypts, then forwards the plaintext (or re-encrypts to TLS targets) with <em>no HTTP parsing whatsoever</em>. No host/path routing, no headers, no XFF injection (source IP handling is as above). It supports SNI for multiple certificates and <strong>ALPN</strong> policies, which enable HTTP/2-capable TLS termination for gRPC pass-through patterns without an ALB. Use TLS-on-NLB when you want centralized cert management and cheap termination for non-HTTP or performance-critical TCP protocols; use ALB the moment you need to look at the request.</p>

<h3>UDP and other NLB-only tricks</h3>
<p>UDP listeners (and dual TCP_UDP listeners on the same port — think DNS on 53) exist only on NLB. Health checks for UDP target groups still use TCP/HTTP(S) probes against a port your service must answer on, because you cannot health-check bare UDP — a design detail the exam likes. NLB is also the required front end for <strong>PrivateLink</strong>: a VPC endpoint service must (classically) sit behind an NLB. And an NLB can use an <strong>ALB as a target</strong>, giving you static IPs plus L7 routing in one chain.</p>

<div class="callout exam">Mappings: "expose a service to other VPCs via PrivateLink" &rarr; NLB. "static IP + path-based routing" &rarr; NLB with ALB target (or Global Accelerator + ALB). "syslog/DNS/game UDP traffic" &rarr; NLB. "TLS termination but only TCP routing needed, extreme throughput" &rarr; NLB TLS listener. "sudden spike of millions of connections, no pre-warming" &rarr; NLB.</div>

<h3>Health check quirks</h3>
<p>NLB health checks historically allowed less tuning than ALB (intervals and thresholds were fixed for a long time; they are configurable now, but with coarser options — HTTP, HTTPS, or TCP probes). Health probes originate from the NLB nodes' addresses within the VPC, so security groups must admit them (modern NLBs have their own security groups; older ones required allowing the VPC CIDR or the NLB's private IPs). With cross-zone load balancing off — the default — each NLB node only routes to targets in its own AZ, so an AZ whose targets are all unhealthy fails independently, and DNS drops that node's IP; with cross-zone on, health and routing become global but you pay inter-AZ data charges. And like the ALB, the NLB <strong>fails open</strong>: if every target in scope is unhealthy, it routes to all of them anyway, on the theory that guessing beats guaranteed blackholing.</p>

<div class="callout limits">Memorize: TCP idle timeout 350 s (not configurable); UDP flow timeout 120 s; one EIP per AZ; PrivateLink requires NLB; Proxy Protocol v2 only (no v1); target groups of type instance preserve client IP by default, type ip historically did not. NLB supports TCP, UDP, TCP_UDP, and TLS listeners — never HTTP.</div>

<p><strong>When not to use NLB:</strong> any content-aware requirement, per-request authentication, request-level canarying, or fleets where a few clients open a few giant long-lived connections — flow hashing gives you per-flow balance, not per-byte balance, and one hot flow can pin one target at 100% CPU while its peers idle. For that shape, either terminate at an ALB (per-request spread) or redesign the client to open multiple connections.</p>
`
    },

/* ------------------------------------------------------------------ */
/* Lesson 4                                                            */
/* ------------------------------------------------------------------ */
    {
      id: "gwlb",
      title: "Gateway Load Balancer: GENEVE, appliance insertion, and endpoints",
      html: `
<p>GWLB solves one problem: inserting a horizontally scaled fleet of inline network appliances — third-party firewalls, IDS/IPS, DLP, custom packet processors — into traffic paths <em>transparently</em>, without the appliances being routable next hops you manage, and without every packet path being hand-built from route tables and SNAT hacks. If you have ever run a pair of firewalls behind a VRRP VIP and suffered the failover and scaling ceilings, GWLB is the managed replacement for that whole pattern.</p>

<h3>The mechanics: GENEVE bump-in-the-wire</h3>
<p>GWLB is deployed in a dedicated "appliance" or security VPC alongside the appliance fleet. Traffic from workload VPCs reaches it through a <strong>Gateway Load Balancer Endpoint (GWLBE)</strong> — a PrivateLink-powered interface endpoint that you insert into route tables as a next hop, exactly like you would a NAT gateway. The flow:</p>
<ol>
<li>A route table sends traffic (e.g. 0.0.0.0/0 from an ingress edge, or east-west subnet routes) to the GWLBE.</li>
<li>The endpoint delivers packets over PrivateLink to the GWLB in the security VPC.</li>
<li>The GWLB encapsulates the <em>original IP packet, unmodified,</em> inside <strong>GENEVE (UDP port 6081)</strong> and forwards it to an appliance target. GENEVE's TLV metadata carries flow identifiers so the appliance knows which endpoint/flow the packet belongs to.</li>
<li>The appliance decapsulates, inspects (it sees the original source and destination — full transparency, no NAT), and returns the verdict packets over the same GENEVE tunnel.</li>
<li>The GWLB decapsulates and sends traffic onward; return-path routing through the same endpoint keeps the path symmetric.</li>
</ol>

<div class="callout deep">Because the payload is the untouched original packet, the appliance is a true transparent middlebox: it can drop, allow, or rewrite without either side knowing it exists. This is the "bump in the wire" property. Your appliance software must speak GENEVE — vendors ship AMIs that do (Palo Alto, Fortinet, Check Point, Suricata-based stacks), or you implement decap/encap yourself on UDP 6081.</div>

<h3>Flow stickiness and appliance mode</h3>
<p>Stateful inspection dies if the two directions of a flow hit different appliances. GWLB therefore maintains <strong>flow stickiness</strong>: by default it hashes the 5-tuple and pins a flow — both directions — to one appliance for the flow's life. You can loosen the hash to 3-tuple or 2-tuple for appliances that want all traffic between two hosts on one box. Related but distinct: <strong>appliance mode</strong> on a Transit Gateway attachment, which forces both directions of a cross-AZ flow through the <em>same AZ</em> of the appliance stack, preventing asymmetric AZ paths when GWLB sits behind a TGW in a centralized inspection architecture. Exam questions about "asymmetric routing breaks stateful firewall inspection through Transit Gateway" are pointing at appliance mode.</p>

<h3>Failure modes</h3>
<p>What happens when appliances die is a first-class design question, because a security chokepoint that fails closed takes the whole environment down. GWLB health-checks appliances like any target group; unhealthy appliances stop receiving <em>new</em> flows, and existing flows on a failed appliance are rehashed. If <em>all</em> appliances in scope fail, GWLB's documented default behavior for existing target failure scenarios has evolved — you can now configure the target failover behavior (rebalance vs no_rebalance for existing flows). Architecturally, decide explicitly: fail-open (traffic bypasses inspection — availability over security) versus fail-closed (blackhole — security over availability), and know that route tables pointing at a GWLBE have no automatic bypass; if the inspection path is down and you did not build a fallback, traffic stops.</p>

<div class="callout war">Cost surprise: every byte through a GWLBE pays PrivateLink endpoint processing charges <em>plus</em> GWLB GLCU charges, and centralized inspection architectures push all inter-VPC and egress traffic through it. Teams have shipped centralized egress inspection and discovered the data processing line item rivaled their NAT gateway bill. Model the per-GB math before committing the whole org's traffic.</div>

<div class="callout exam">GWLB trigger phrases: "third-party firewall appliances", "intrusion detection/prevention inline", "inspect all traffic entering multiple VPCs with a scalable fleet", "transparent network appliance insertion", "GENEVE". The answer skeleton is always: appliances in a security VPC behind a GWLB, GWLB endpoints in spoke VPCs (or a TGW-attached inspection VPC), route tables steering traffic through the endpoints. Distractors: NAT gateway (no inspection), NLB with appliances (breaks transparency, needs NAT contortions), VPC peering with static routes to an instance (single-instance bottleneck, no health-managed scaling).</div>

<h3>CLB, and reading legacy questions</h3>
<p>Rounding out the family: the Classic Load Balancer supports TCP and HTTP(S), one port mapping per listener, no target groups, no SNI (one cert per CLB), stickiness via its own cookie mechanisms, and both EC2-Classic and VPC. Its continued exam presence is as a migration source: "an application on a Classic Load Balancer needs host-based routing" &rarr; migrate to ALB; "needs static IP" &rarr; migrate to NLB. There is no scenario where a new design correctly chooses CLB.</p>

<div class="callout limits">GWLB numbers: GENEVE on UDP 6081 (memorize); MTU handling matters — encapsulation overhead means appliance-path MTU is lower than VPC jumbo MTU, and GWLB does not fragment; flows idle-timeout like NLB flows (TCP 350 s class behavior); GWLBE throughput scales like other PrivateLink endpoints (tens of Gbps per endpoint, scale horizontally with more endpoints/AZs). Cross-zone load balancing is off by default, and turning it on bills inter-AZ — same as NLB.</div>

<p><strong>When not to use GWLB:</strong> if the requirement is just "filter traffic", security groups, network ACLs, AWS Network Firewall, or a WAF on the ALB are simpler and cheaper. GWLB earns its complexity only when you specifically need <em>your chosen third-party or custom inline appliance</em> in the path at scale. If the question says "managed firewall service, no appliances to run", that is AWS Network Firewall (which itself rides on GWLB technology under the hood — a nice trivia hook that has appeared in explanations).</p>
`
    },

/* ------------------------------------------------------------------ */
/* Lesson 5                                                            */
/* ------------------------------------------------------------------ */
    {
      id: "target-groups",
      title: "Target group mechanics: health checks, draining, and slow start",
      html: `
<p>The target group is where the actual reliability engineering lives. Load balancer choice gets the architecture diagram right; health check tuning, deregistration semantics, and slow start decide whether deploys are invisible or page you at 2 a.m.</p>

<h3>Health check machinery</h3>
<p>Each target group defines: protocol (HTTP/HTTPS/TCP; gRPC for gRPC target groups), port (traffic port or an override), path (for HTTP-family), <strong>interval</strong> (5-300 s), <strong>timeout</strong>, <strong>healthy threshold</strong> (consecutive successes to go healthy), <strong>unhealthy threshold</strong> (consecutive failures to go unhealthy), and success codes (matcher, e.g. 200-299, or gRPC status codes). Every load balancer <em>node</em> probes every in-scope target independently — a target is not globally "healthy"; it is healthy <em>as seen by each node</em>, and nodes can disagree during partial network failures.</p>

<p>State transitions: a new target starts in <code>initial</code> while it passes enough checks to reach healthy; then <code>healthy</code> / <code>unhealthy</code> as thresholds are crossed; <code>draining</code> during deregistration; <code>unused</code> if no listener routes to the group. The detection latency math matters: worst-case time to eject a dead target is roughly interval &times; unhealthy-threshold (+ timeout), so a 30 s interval with threshold 3 means up to ~90 s of errors routed to a dead box. Tighten interval/thresholds for fast-failing fleets; loosen for apps with expensive health endpoints.</p>

<div class="callout war">Make health checks mean something. A health endpoint that returns 200 unconditionally hides dead dependencies; one that checks the database converts a database blip into "all targets unhealthy" and a full-fleet ejection. The mature pattern: shallow liveness for the LB check (process up, can serve), deep dependency health only in monitoring. A fleet-wide dependency outage plus deep health checks is the classic self-inflicted total outage — and it interacts with fail-open in ways teams do not expect (see below).</div>

<h3>Fail-open: when ALL targets are unhealthy</h3>
<p>If every target in an AZ (cross-zone off) or in the whole group (cross-zone on) is unhealthy, ELB <strong>fails open</strong>: it routes requests to all registered targets anyway. Rationale: when health checks say "everything is down", the checks themselves are the most likely liar (bad deploy of the health endpoint, dependency blip), and sending traffic gives partial service instead of guaranteed zero. Corollaries: you cannot use health checks as a traffic on/off switch for the whole fleet, and during a real full outage your targets still receive (and log) traffic. For NLB with cross-zone off, DNS also stops advertising an AZ whose targets are all unhealthy — fail-open happens within the still-advertised scope.</p>

<div class="callout exam">Exam phrasing: "all targets are marked unhealthy but the application still receives traffic — why?" &rarr; fail-open behavior when no healthy targets exist. Also tested inverted: "how to ensure requests only reach healthy targets during a partial failure" &rarr; keep at least one target healthy per scope, fix thresholds — not fail-open, which only triggers at total failure.</div>

<h3>Deregistration delay (connection draining)</h3>
<p>When a target deregisters (scale-in, deploy, ECS task stop), it enters <code>draining</code> for the <strong>deregistration delay</strong> (default 300 s, 0-3600). The load balancer stops sending <em>new</em> connections/requests immediately but lets in-flight work finish. Semantics differ by type: ALB stops new requests and waits for in-flight requests; NLB stops new <em>flows</em> but established flows can keep flowing until they close or the delay expires (and the delay expiring does not RST NLB flows immediately — long-lived connections may persist; plan client-side reconnect logic). Tune it to your request duration: a 300 s drain for a 50 ms API is pure deploy slowness; a 30 s drain under 5-minute uploads truncates uploads. Set deregistration delay a little above your true p99 request duration.</p>

<h3>Slow start</h3>
<p>Slow start (ALB, 30-900 s, off by default; not for NLB) ramps a newly healthy target's share of requests linearly instead of instantly giving it a full slice of round-robin. Use it for JIT-warmed runtimes (JVMs), cold local caches, and connection-pool warmup — anywhere a cold instance at full load produces a latency spike or falls over and flaps. Caveats: it does not combine with least-outstanding-requests routing, and a target exiting and re-entering healthy resets its ramp.</p>

<div class="callout deep">Routing algorithms interact with all of this: ALB target groups support round robin (default), <strong>least outstanding requests</strong> (best for heterogeneous request costs or mixed instance generations — it naturally sends less work to slow or warming targets, which is why it conflicts with slow start), and weighted random with <strong>Automatic Target Weights</strong> (anomaly detection that de-weights misbehaving targets before health checks fail them). NLB has no choice: flow hash is the algorithm.</div>

<h3>Grace notes on health check scope</h3>
<p>Two more mechanics that surface in troubleshooting questions. First, the health check port: checking the traffic port validates the actual serving path; checking an override port (a sidecar admin port) can report healthy while the app port is wedged. Second, security groups: ALB probes come from the ALB's security group — targets must allow it; NLB probes come from NLB node IPs (or the NLB's security group on current NLBs). "Targets registered but stuck unhealthy, app works when hit directly" is almost always a security group not admitting health checks, a wrong path returning 3xx when the matcher only accepts 200, or the target's host-based routing rejecting the probe's Host header.</p>

<div class="callout limits">Defaults worth memorizing: interval 30 s, healthy threshold 5 (ALB HTTP), unhealthy threshold 2, deregistration delay 300 s, slow start off (30-900 s when on), success matcher 200. Ranges: interval 5-300 s, thresholds 2-10, dereg delay 0-3600 s. Detection latency ~= interval &times; unhealthy threshold. These exact numbers appear in exam answers.</div>
`
    },

/* ------------------------------------------------------------------ */
/* Lesson 6                                                            */
/* ------------------------------------------------------------------ */
    {
      id: "crosszone-sticky-tls",
      title: "Cross-zone, stickiness, and TLS/SNI across the family",
      html: `
<p>Three cross-cutting behaviors — cross-zone load balancing, session stickiness, and TLS termination — differ by load balancer type in ways the exam mines relentlessly and production incidents rediscover quarterly.</p>

<h3>Cross-zone load balancing</h3>
<p>Each load balancer node lives in one AZ. The question is whether a node in AZ-a may route to targets in AZ-b. With cross-zone <strong>off</strong>, each node distributes only to its own AZ's targets; with it <strong>on</strong>, every node distributes across all targets everywhere.</p>
<table>
<thead><tr><th></th><th>Default</th><th>Inter-AZ data charge when on</th></tr></thead>
<tbody>
<tr><td>ALB</td><td>On</td><td>No (free)</td></tr>
<tr><td>NLB</td><td>Off</td><td>Yes</td></tr>
<tr><td>GWLB</td><td>Off</td><td>Yes</td></tr>
<tr><td>CLB</td><td>Console on / API off</td><td>No</td></tr>
</tbody>
</table>
<p>The pathology with cross-zone off: DNS spreads clients roughly evenly across <em>AZ nodes</em>, but if AZ-a has 8 targets and AZ-b has 2, the AZ-b node still gets ~50% of traffic funneled into 2 targets — each AZ-b target runs at 4x the load of an AZ-a target. Imbalanced AZs plus cross-zone off equals hot spots that look like app bugs. Worse: an AZ whose targets all die (cross-zone off) is removed from DNS, but clients with stale DNS keep hitting it. With cross-zone on you get smooth global distribution and pay (on NLB/GWLB) inter-AZ transfer; keeping it off and keeping AZ target counts equal is the cost-optimized posture, which ASG AZ balancing conveniently maintains.</p>

<div class="callout exam">"Targets in one AZ receive significantly more traffic per instance" &rarr; cross-zone off with unequal AZ capacity; fix by enabling cross-zone or rebalancing counts. "Minimize inter-AZ data transfer costs for an NLB" &rarr; leave cross-zone disabled and keep AZs balanced. Remember the asymmetric defaults: ALB on+free, NLB/GWLB off+billed.</div>

<h3>Sticky sessions</h3>
<p>Stickiness pins a client to a target — a crutch for state that lives in process memory. ALB offers two flavors: <strong>duration-based</strong> stickiness, where the ALB mints an <code>AWSALB</code> cookie (target group scoped, rotating encrypted contents) with a configurable expiry of 1 second to 7 days; and <strong>application-based</strong> stickiness, where <em>your app</em> sets a cookie of a name you configure, the ALB mirrors it with <code>AWSALBAPP</code>, and stickiness lasts while your cookie does — giving the application control of session lifetime. CLB's equivalents were AWSELB and app cookies. NLB has no cookies; its stickiness is <strong>flow-level by nature</strong> (a connection never moves), plus optional source-IP stickiness on the target group so <em>new</em> connections from the same client IP rejoin the same target — with the obvious CGNAT/proxy caveat that one "client IP" may be thousands of humans.</p>

<div class="callout war">Stickiness fights everything else you do. It defeats least-outstanding-requests balancing, concentrates load unevenly (one hot enterprise proxy IP = one melting target), and interacts miserably with auto scaling: scale-out does not help pinned users (they stay on their old target), and scale-in disconnects a stuck cohort at once. Every stickiness deployment is technical debt against externalizing session state to ElastiCache/DynamoDB. The exam agrees: "sessions lost when instances scale in — best fix?" wants <strong>ElastiCache/DynamoDB session store</strong>, with sticky sessions as the explicitly-second-best distractor unless the question says "no application changes".</div>

<h3>TLS termination, SNI, and ACM</h3>
<p>ALB HTTPS listeners and NLB TLS listeners terminate TLS with certificates from <strong>ACM</strong> (free public certs, auto-renewing) or IAM (legacy). One listener holds a default certificate plus up to 25 additional certificates, selected per-connection via <strong>SNI</strong> — so one ALB serves many domains with distinct certs, each chosen by the hostname in the ClientHello. (CLB cannot do SNI: one cert per CLB, which is the migration trigger in exam questions about "hosting multiple TLS domains on one load balancer".) The listener's <strong>security policy</strong> pins the TLS versions and cipher suites — you select a named policy (e.g. TLS 1.2/1.3-only policies for compliance) rather than hand-rolling cipher strings.</p>

<p><strong>End-to-end encryption patterns:</strong></p>
<ul>
<li><strong>Terminate at ALB, HTTP to targets:</strong> simplest; plaintext exists inside the VPC. Fails strict compliance regimes.</li>
<li><strong>Terminate and re-encrypt (HTTPS to targets):</strong> ALB re-originates TLS to targets. Critically, the ALB does <em>not</em> validate the target's certificate chain or hostname — any cert, including self-signed, satisfies it. That makes ops easy (no cert distribution problem) and means ALB-to-target TLS is encryption-in-transit, not target authentication.</li>
<li><strong>True end-to-end (no LB decryption):</strong> NLB with a TCP (not TLS) listener passing 443 through; targets hold the certs and terminate. Required when compliance forbids any intermediary decryption or when you need client-certificate <strong>mutual TLS</strong> terminated at the app. (ALB now offers mTLS modes at the listener — passthrough of client certs in headers or full verification against a trust store — worth knowing exists.)</li>
</ul>

<div class="callout deep">Where do private keys live? ACM never gives you the private key for ACM-issued certs; the ELB data plane gets keys via ACM's integration with KMS-backed storage, and this is precisely why ACM public certs cannot be exported to run on your EC2 targets. If targets must terminate TLS (the NLB-passthrough pattern), you bring your own certs (or use ACM Private CA, which can export). This asymmetry — ACM certs on the LB, self-managed or Private CA certs on targets — is an exam-favorite implementation detail.</div>

<div class="callout limits">25 SNI certificates per listener plus the default; ACM public certs are free and auto-renew (DNS validation = zero-touch renewals); security policies are named presets; ALB idle timeout default 60 s; stickiness duration 1 s-7 days. HTTP-to-HTTPS redirect is a listener rule redirect action — one line, no target changes.</div>

<p>Putting the three together: the boring-but-correct enterprise default is ALB, cross-zone on (free), no stickiness (session state externalized), ACM cert with SNI for extra domains, TLS 1.2+ security policy, re-encrypt to targets where compliance asks. Every deviation from that default should be traceable to a named requirement: static IP (NLB), no-decrypt compliance (NLB passthrough), appliance inspection (GWLB), in-memory session state you cannot fix this quarter (stickiness).</p>
`
    },

/* ------------------------------------------------------------------ */
/* Lesson 7                                                            */
/* ------------------------------------------------------------------ */
    {
      id: "asg-core",
      title: "ASG core: launch templates, capacity mechanics, and scaling policies",
      html: `
<p>An Auto Scaling Group is a reconciliation loop: desired capacity is the setpoint, the running instance set is the observed state, and the ASG continuously converges the two — launching, terminating, rebalancing across AZs, and replacing what fails. Every ASG feature is a knob on that loop.</p>

<h3>Launch templates (and the death of launch configurations)</h3>
<p>A <strong>launch template</strong> is the versioned instance blueprint: AMI, instance type(s), key pair, security groups, user data, IAM instance profile, block devices, metadata options (enforce IMDSv2 here), purchase options. <strong>Launch configurations are deprecated</strong> — immutable, unversioned, no Spot+On-Demand mixing, no newer instance features; you cannot create new ones anymore. Exam-wise, any answer that says "create a new launch configuration" for a modern requirement is wrong on principle; the pattern is "new launch template version, then update the ASG (and roll with instance refresh)".</p>
<p>Templates unlock the <strong>mixed instances policy</strong>: multiple instance types (or attribute-based instance type selection — specify vCPU/memory ranges and let AWS pick), a split between On-Demand and Spot (e.g. base of 2 On-Demand, 70% Spot above that), and Spot allocation strategies. Use <strong>price-capacity-optimized</strong> (or capacity-optimized) for Spot to minimize interruptions; the old lowest-price strategy chases the cheapest, most-reclaimed pools. Diversify across many instance types and AZs — Spot capacity is per-pool, and diversity is your interruption insurance.</p>

<div class="callout exam">"Fault-tolerant/stateless workload, reduce compute cost up to 90%, keep a reliable baseline" &rarr; mixed instances policy: On-Demand base + Spot percentage, multiple instance types, capacity-optimized allocation. "Must not be interrupted" kills Spot regardless of savings.</div>

<h3>Min / max / desired, and AZ balancing</h3>
<p><strong>Desired</strong> is the setpoint scaling policies move; <strong>min/max</strong> clamp it. Manual changes to desired get overwritten by the next policy evaluation — a perennial on-call surprise. The ASG spreads capacity evenly across its subnets' AZs, and <strong>AZRebalance</strong> actively fixes drift (after an AZ outage heals, it launches in the recovered AZ then terminates elsewhere — launch-before-terminate, temporarily exceeding desired by up to 10%). If launches in one AZ keep failing (capacity errors), the ASG retries other AZs, which can silently unbalance you until rebalancing recovers.</p>

<h3>Scaling policies, in order of preference</h3>
<ul>
<li><strong>Target tracking</strong> — the right default. You declare a target for a metric (predefined: ASGAverageCPUUtilization, ASGAverageNetworkIn/Out, ALBRequestCountPerTarget; or any custom CloudWatch metric) and Auto Scaling synthesizes and manages the CloudWatch alarms itself (you will see two auto-created alarms; do not edit or delete them — deleting them silently breaks scaling). It behaves like a proportional controller: scales out aggressively, scales in conservatively. Pick a metric that actually varies inversely with capacity added — request count per target is often more faithful than CPU for IO-bound services.</li>
<li><strong>Step scaling</strong> — you own the alarm; breach magnitude maps to step adjustments (+1 at 70% CPU, +3 at 85%). Use when you need asymmetric or magnitude-aware responses target tracking cannot express.</li>
<li><strong>Simple scaling</strong> — legacy: one alarm, one adjustment, then a hard <strong>cooldown</strong> (default 300 s) during which all further simple-scaling activity blocks, even if the metric keeps burning. Its lockout behavior is why step scaling replaced it. On the exam, "simple scaling waits for cooldown; step scaling continues responding" is a tested contrast.</li>
<li><strong>Scheduled actions</strong> — set min/max/desired at cron times. For known calendars: market open, batch windows, weekday/weekend shape. Combine with target tracking (schedule moves the floor; tracking handles surprise).</li>
<li><strong>Predictive scaling</strong> — ML forecast on at least 24 h (up to 14 days) of history, producing a capacity schedule ahead of predictable cycles, launching pre-emptively so instances are warm <em>before</em> the daily ramp. Best for cyclical, slow-booting fleets; run in forecast-only mode first to inspect its plan. It complements — not replaces — a reactive target-tracking policy for the unforecastable spikes.</li>
</ul>
<p>When multiple policies fire simultaneously, the ASG takes the one demanding the most capacity for scale-out (and the most conservative for scale-in). Multiple target-tracking policies are fine as long as they only conflict in the safe direction.</p>

<div class="callout deep">Cooldown vs <strong>instance warmup</strong> — different mechanisms, constantly confused. Cooldown (simple scaling, and default 300 s for some activities) blocks subsequent <em>scaling actions</em>. Warmup tells target tracking and step scaling how long a new instance takes before its metrics count and before it is considered contributing capacity — preventing over-scaling while booted-but-not-ready instances drag the average down (a just-launched instance at near-zero CPU makes average CPU look better than reality; warmup excludes it). Set <strong>default instance warmup</strong> at the ASG level to your true boot-to-serving time; it also becomes the pacing default for instance refresh.</div>

<div class="callout war">The metric-inversion trap: scale on a metric that added capacity does not reduce, and you get runaway scaling. Example: scaling on queue depth directly — 10 new workers do not instantly shrink a 100k backlog, so the policy keeps launching to max. The correct custom metric is <strong>backlog per instance</strong> (queue depth divided by instance count) targeting a value derived from per-instance throughput times acceptable latency. This exact pattern — SQS backlog-per-instance target tracking — is an AWS-documented design and a recurring exam scenario.</div>

<div class="callout limits">Defaults: simple-scaling cooldown 300 s; target tracking creates and owns its alarms; predictive scaling needs &gt;= 24 h of metric history and forecasts 48 h ahead, refreshed regularly; AZRebalance can temporarily exceed desired capacity by 10%; max is a hard clamp — target tracking will not breach it even mid-breach. Scaling is per-ASG; quotas on ASGs and launch templates per region are soft limits.</div>

<p><strong>When not to autoscale:</strong> stateful singletons, license-bound software, workloads whose boot time exceeds their burst duration (by the time capacity arrives, the spike is gone — pre-provision or go serverless instead), and databases (use the engine's own scaling story). An ASG of size min=max=1 is still worth having for its self-healing replace-on-failure loop alone.</p>
`
    },

/* ------------------------------------------------------------------ */
/* Lesson 8                                                            */
/* ------------------------------------------------------------------ */
    {
      id: "asg-lifecycle",
      title: "ASG lifecycle: hooks, warm pools, refresh, termination order, and protection",
      html: `
<p>The second half of ASG mastery is the instance lifecycle machinery: what happens between "launch requested" and "in service", between "terminate decided" and "gone", and how you bend both. This is where the exam's trickiest ASG questions live.</p>

<h3>Lifecycle hooks</h3>
<p>Hooks pause the state machine at two points: <strong>Pending:Wait</strong> (after launch, before InService) and <strong>Terminating:Wait</strong> (after terminate decision, before shutdown). While paused, the instance waits up to the hook's <strong>heartbeat timeout</strong> (default 3600 s, max 48 h; extendable by sending heartbeats) until something calls <code>complete-lifecycle-action</code> with CONTINUE or ABANDON. Notifications flow via EventBridge, SNS, or SQS to whatever automation does the work.</p>
<ul>
<li><strong>Launch hooks:</strong> pull config/secrets, register with service discovery, warm caches, run smoke tests before the instance takes traffic. ABANDON on a launch hook terminates the instance — a built-in "fail the deploy of this one box" primitive.</li>
<li><strong>Termination hooks:</strong> drain long-lived connections beyond ELB deregistration delay, upload logs/metrics spool, deregister from external systems, checkpoint work. ABANDON vs CONTINUE both proceed to termination here; the hook buys <em>time</em>, not a veto.</li>
</ul>

<div class="callout exam">"Instances must upload logs / finish in-flight jobs before scale-in terminates them" &rarr; Terminating:Wait lifecycle hook (often paired with a CloudWatch agent or a script triggered by EventBridge). Distractors: termination protection (that is EC2-level and does not stop ASG scale-in decisions the way people hope), longer deregistration delay (only covers LB-tracked connections, not background work), and Spot interruption notices (different mechanism, 2-minute fixed warning).</div>

<h3>Warm pools</h3>
<p>A warm pool pre-initializes instances through their (slow) boot and launch hooks, then parks them <strong>Stopped</strong> (default — you pay only EBS/EIP), <strong>Running</strong> (fastest, full price), or <strong>Hibernated</strong> (RAM state on disk, mid path). Scale-out then pulls from the pool: a stopped pre-baked instance enters service in tens of seconds instead of many minutes of boot + bootstrap. Use warm pools when application initialization is long (big JVMs, model loading, huge AMI + config) <em>and</em> scale-outs are frequent enough to justify the parked EBS cost. Instances can also be configured to return to the pool on scale-in instead of terminating.</p>

<h3>Instance refresh</h3>
<p><strong>Instance refresh</strong> performs a rolling replacement of the fleet — the deployment primitive for "new launch template version" or "new AMI". Key parameters: <strong>minimum healthy percentage</strong> (how much capacity must stay in service; with max healthy percentage you can do launch-before-terminate surges), instance warmup pacing, <strong>checkpoints</strong> (pause at 20%, 50% for verification before continuing), <strong>skip matching</strong> (do not replace instances already on the target config), and auto-rollback on failure or on CloudWatch alarm breach. Exam trigger: "roll out a new AMI to an ASG gradually with the ability to halt" &rarr; instance refresh with checkpoints, not "terminate instances manually" and not CloudFormation UpdatePolicy unless the stack angle is explicit.</p>

<h3>Termination policies</h3>
<p>Scale-in must pick a victim. The <strong>default policy</strong>: (1) choose the AZ with the most instances (rebalance first); (2) within it, prefer instances using the <em>oldest launch template or launch configuration</em> (config-hygiene: kill the stale ones); (3) then the instance <strong>closest to the next billing hour</strong> (a per-second-billing-era vestige that persists in the algorithm and on the exam); (4) then random. Alternatives you can stack in order: OldestInstance, NewestInstance, OldestLaunchTemplate, OldestLaunchConfiguration, ClosestToNextInstanceHour, AllocationStrategy, and a Lambda-backed custom termination policy for full control. AZ balance is evaluated before your policy list — the ASG will violate OldestInstance to fix an AZ imbalance.</p>

<h3>Health checks: EC2 vs ELB, and the grace period</h3>
<p>ASG health checking defaults to <strong>EC2 status checks</strong> only: hardware/hypervisor/network reachability. A wedged application on a healthy VM is "healthy" to EC2 checks. Enabling the <strong>ELB health check type</strong> makes the ASG also treat the load balancer's target health as authoritative: target fails LB health checks &rarr; ASG terminates and replaces it. That closes the loop — and arms the classic footgun: the <strong>health check grace period</strong> (default 300 s) suppresses health evaluation after launch. If your app takes 4 minutes to boot and grace is 60 s, every new instance is judged unhealthy mid-boot, terminated, and replaced — a flapping loop where the ASG churns instances forever, burning money while serving nothing. "ASG keeps terminating and relaunching instances before they finish starting" &rarr; grace period too short (or health check path wrong). Grace period must exceed worst-case boot-to-healthy time.</p>

<div class="callout war">Related churn trap: deep LB health checks (checking a dependency) + ELB health check type on the ASG. The dependency blips, every target fails LB checks, the ASG mass-terminates the entire fleet, and the replacement instances also fail (dependency still down) — an infinite replacement storm on top of an outage. Shallow LB checks, or suspending ReplaceUnhealthy during dependency incidents, is the mitigation.</div>

<h3>Suspended processes</h3>
<p>You can suspend individual ASG processes: <strong>Launch</strong>, <strong>Terminate</strong>, <strong>HealthCheck</strong>, <strong>ReplaceUnhealthy</strong>, <strong>AZRebalance</strong>, AlarmNotification, ScheduledActions, AddToLoadBalancer, InstanceRefresh. Uses: suspend HealthCheck/ReplaceUnhealthy while debugging a live sick instance (so the ASG does not yank your patient off the table); suspend Terminate during an incident freeze; suspend AZRebalance during a known AZ event to stop churn. Suspending Launch or Terminate pauses most other activity that depends on them. Standby state (below) is usually cleaner for single-instance surgery.</p>

<h3>Scale-in protection, standby, and detach</h3>
<ul>
<li><strong>Instance scale-in protection</strong> — per-instance (or ASG-default-for-new-instances) flag: scale-in skips protected instances. It does NOT protect against ASG health replacement, ELB-failure replacement, manual termination, or Spot reclamation — scale-in only. The canonical pattern: queue workers set protection when they pick up a long job (via <code>set-instance-protection</code> from the instance itself) and clear it when idle, so scale-in only ever culls idle workers.</li>
<li><strong>Standby</strong> — temporarily remove an instance from service (LB deregistered, no health replacement) while it still counts as part of the group; do surgery; return it to InService. The right way to debug one box.</li>
<li><strong>Detach</strong> — permanently remove an instance from the ASG (optionally decrementing desired), leaving it running as a free-standing EC2 instance: forensics snapshots, promoting a canary to a pet (usually a smell), or migrating an instance to another group.</li>
</ul>

<div class="callout limits">Numbers: lifecycle hook heartbeat default 3600 s, hard cap 48 h per hook; health check grace period default 300 s; instance refresh min healthy percentage default 90%; scale-in protection is scale-in-only; warm pool stopped instances bill EBS only; default termination policy order = AZ balance &rarr; oldest launch template/config &rarr; closest to billing hour &rarr; random.</div>
`
    }
  ],

/* ------------------------------------------------------------------ */
/* Quiz                                                                */
/* ------------------------------------------------------------------ */
  quiz: [
    {
      q: "A fintech company exposes a TCP-based FIX trading gateway to partner banks. Partners require fixed IP addresses to allowlist in their firewalls, and the connection path must add minimal latency. Which architecture meets the requirements?",
      options: [
        "An Application Load Balancer with AAAA records and client IP preservation enabled",
        "A Network Load Balancer with one Elastic IP per enabled Availability Zone",
        "A Classic Load Balancer with sticky sessions and a Route 53 alias record",
        "An Application Load Balancer behind a NAT gateway to provide a stable public IP",
        "A Gateway Load Balancer endpoint in each partner VPC"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> NLB is the only ELB that supports static addressing — one node IP per AZ, and you can bring your own Elastic IPs. As an L4 flow-hash pass-through it adds on the order of tens to hundreds of microseconds, ideal for latency-sensitive TCP like FIX.</p><p><strong>A:</strong> ALB node IPs change as the fleet scales; no static IP is possible, and ALB is L7 HTTP — wrong for a raw TCP protocol. <strong>C:</strong> CLB also has no static IPs and is legacy; stickiness is irrelevant to allowlisting. <strong>D:</strong> NAT gateways provide stable IPs for <em>outbound</em> traffic from your VPC, not inbound to a load balancer — this architecture does not work. <strong>E:</strong> GWLB endpoints are for transparent appliance insertion, not for exposing an application service to partners.</p>"
    },
    {
      q: "A company runs api.example.com and portal.example.com on the same EC2 fleet. Requests to /admin/* must additionally be authenticated against the corporate OIDC identity provider before reaching the application, with no application code changes. Which solution requires the least effort?",
      options: [
        "An ALB with host-based and path-based listener rules, adding an authenticate-oidc action before the forward action on the /admin/* rule",
        "An NLB with TLS listeners and a Lambda authorizer for the /admin path",
        "Amazon API Gateway with a Cognito authorizer in front of the fleet for all traffic",
        "CloudFront with signed URLs for the /admin path and an ALB origin",
        "An ALB forwarding all traffic to the fleet, with authentication middleware added to the application"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct.</strong> ALB listener rules match host and path conditions, and the authenticate-oidc action runs the OIDC code flow at the load balancer before forwarding — the app receives signed identity claims in x-amzn-oidc-* headers with zero code changes for login.</p><p><strong>B:</strong> NLB is L4 — it cannot see paths and has no authentication actions; Lambda authorizers are an API Gateway concept. <strong>C:</strong> API Gateway would work for APIs but is a significant re-architecture, authenticates everything rather than just /admin, and has payload/timeout constraints — far from least effort. <strong>D:</strong> Signed URLs protect content distribution; they are not an interactive OIDC login and require issuing URLs from somewhere, which means code. <strong>E:</strong> Explicitly violates the no-code-changes requirement.</p>"
    },
    {
      q: "A security team must route all traffic between spoke VPCs and the internet through a fleet of third-party firewall appliances for deep packet inspection. The appliances must scale horizontally and see original source and destination IPs unchanged. Which service should the architect use?",
      options: [
        "Network Load Balancer with the firewall instances as IP targets",
        "Gateway Load Balancer with GENEVE-capable firewall appliances and GWLB endpoints in the spoke routing paths",
        "AWS WAF attached to an ALB in each spoke VPC",
        "NAT gateways in a centralized egress VPC with route table entries from each spoke",
        "Transit Gateway with static routes pointing to the largest firewall instance's ENI"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> This is the textbook GWLB scenario: appliances behind a GWLB receive original packets encapsulated in GENEVE (UDP 6081), preserving source/destination transparently; GWLB endpoints are inserted as route table next hops; the fleet scales horizontally with flow stickiness for stateful inspection.</p><p><strong>A:</strong> An NLB rewrites flows toward targets and would require the appliances to NAT and manage routing symmetry themselves — it is not transparent and is not designed for bump-in-the-wire insertion. <strong>C:</strong> WAF inspects HTTP for web exploits only; it is not a third-party firewall path and sees only ALB traffic. <strong>D:</strong> NAT gateways provide address translation, not inspection. <strong>E:</strong> A static route to one ENI is a single-instance bottleneck with manual failover — exactly the pattern GWLB replaces.</p>"
    },
    {
      q: "An ALB target group shows all targets as unhealthy after a deployment, yet the application still responds to some user requests. What explains this behavior?",
      options: [
        "The ALB caches responses and serves them while targets are down",
        "When no targets are healthy, the load balancer fails open and routes requests to all registered targets anyway",
        "Route 53 health checks are overriding the target group health status",
        "The deregistration delay keeps serving new requests to draining targets",
        "Cross-zone load balancing rerouted traffic to a hidden standby target group"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> ELB fail-open: when every target in scope is unhealthy, the load balancer routes to all of them on the theory that the health checks are the most likely component to be wrong, so partial service beats a guaranteed blackhole.</p><p><strong>A:</strong> ALBs do not cache responses — that is CloudFront's job. <strong>C:</strong> Route 53 health checks affect DNS answers, not target group routing decisions inside an ALB. <strong>D:</strong> Draining targets receive no <em>new</em> requests; the delay only lets in-flight work finish, and it does not apply to targets marked unhealthy. <strong>E:</strong> There is no hidden standby target group; cross-zone only changes which AZs' registered targets a node may use.</p>"
    },
    {
      q: "A company runs an NLB with cross-zone load balancing disabled. AZ-a contains 8 targets and AZ-b contains 2 targets. Users report that some requests are much slower. Monitoring shows the AZ-b instances at sustained 95% CPU while AZ-a instances idle around 25%. What is the cause?",
      options: [
        "The NLB flow hash algorithm favors targets in AZ-b",
        "DNS distributes clients roughly evenly across AZ nodes, and each node only routes to its own AZ's targets, so AZ-b's 2 targets absorb about half of all traffic",
        "AZ-b instances are a smaller instance type due to a mixed instances policy",
        "Sticky sessions have pinned the busiest clients to AZ-b",
        "The deregistration delay in AZ-a is diverting connections to AZ-b"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> With cross-zone off, each NLB node distributes only within its AZ. DNS spreads client connections roughly evenly across the per-AZ node IPs, so ~50% of traffic funnels into AZ-b's 2 targets — each running at roughly 4x the per-instance load of AZ-a. Fix: enable cross-zone (accepting inter-AZ data charges) or equalize AZ capacity.</p><p><strong>A:</strong> Flow hashing is uniform over targets in scope; it has no AZ preference. <strong>C:</strong> Nothing in the scenario indicates mixed types, and that would not produce this AZ-correlated 50/50 split. <strong>D:</strong> NLB has no cookie stickiness, and source-IP stickiness would not create an AZ-shaped imbalance. <strong>E:</strong> Deregistration delay affects draining targets, none of which are mentioned, and it never diverts traffic across AZs with cross-zone off.</p>"
    },
    {
      q: "An application behind an ALB keeps user session state in instance memory. During scale-in events users are logged out. The business wants the most scalable long-term fix. What should the architect recommend?",
      options: [
        "Enable duration-based sticky sessions on the target group with a 7-day cookie",
        "Enable scale-in protection on all instances so the group never scales in",
        "Externalize session state to ElastiCache or DynamoDB so any instance can serve any user",
        "Increase the deregistration delay to 3600 seconds",
        "Switch to an NLB so flows are never rebalanced"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>C is correct.</strong> Externalizing session state (ElastiCache for Redis or a DynamoDB session table) makes instances stateless, so scale-in, deploys, and failures no longer destroy sessions — the architecturally scalable answer the exam consistently prefers.</p><p><strong>A:</strong> Stickiness reduces the symptom but every scale-in or instance failure still destroys that instance's sessions, and stickiness concentrates load and fights auto scaling — it is the second-best distractor. <strong>B:</strong> Permanently protecting every instance disables scale-in entirely, defeating elasticity and cost goals. <strong>D:</strong> Draining lets in-flight requests finish; it does not preserve in-memory session state after the instance terminates. <strong>E:</strong> NLB flow pinning ends when the connection or instance ends — sessions still die at scale-in, and you lose L7 features.</p>"
    },
    {
      q: "An Auto Scaling group with the ELB health check type terminates and replaces every new instance about 90 seconds after launch, and the fleet never stabilizes. The application takes about 4 minutes to initialize before passing health checks. What should be changed?",
      options: [
        "Increase the health check grace period beyond the application's initialization time",
        "Suspend the Launch process until the application team fixes startup time",
        "Switch the ASG health check type to EC2 so the load balancer checks are ignored permanently",
        "Reduce the target group's healthy threshold to 2 so instances pass sooner",
        "Enable slow start on the target group"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct.</strong> The health check grace period (default 300 s, evidently set lower here) suppresses ASG health evaluation after launch. When grace is shorter than boot-to-healthy time, every instance is judged unhealthy mid-boot and replaced — the classic flapping-replacement loop. Grace must exceed worst-case initialization.</p><p><strong>B:</strong> Suspending Launch stops all scale-out and replacement launches — it halts the churn by halting the group; not a fix. <strong>C:</strong> Dropping to EC2-only checks hides genuine application failures forever; it trades a config bug for permanently weaker health semantics. <strong>D:</strong> The healthy threshold cannot make a still-initializing app pass checks; probes fail regardless of threshold until the app is up. <strong>E:</strong> Slow start ramps request volume to already-healthy targets; it has no effect on health evaluation during boot.</p>"
    },
    {
      q: "A batch-processing fleet in an Auto Scaling group pulls jobs from SQS. Jobs run 30-60 minutes. During scale-in, instances are terminated mid-job and work is lost. Which combination prevents losing in-progress work while still allowing the group to scale in? (Select TWO.)",
      options: [
        "Have each worker enable instance scale-in protection while processing a job and disable it when idle",
        "Add a Terminating:Wait lifecycle hook so a terminating instance can finish or checkpoint its current job before shutdown",
        "Enable EC2 termination protection on all instances in the group",
        "Set the target group deregistration delay to its 3600-second maximum",
        "Suspend the Terminate process on the ASG permanently"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>A and B are correct.</strong> Scale-in protection set from the instance while a job is running makes the scale-in victim selector skip busy workers and cull only idle ones. A Terminating:Wait lifecycle hook covers the remaining cases (and the race where termination is already decided): the instance gets up to the heartbeat timeout to finish or checkpoint before shutdown proceeds.</p><p><strong>C:</strong> EC2 termination protection (DisableApiTermination) does not stop Auto Scaling scale-in; it blocks manual API termination and causes stuck scaling activity — wrong tool. <strong>D:</strong> Deregistration delay only protects load-balancer-tracked connections; SQS workers' background jobs are invisible to it. <strong>E:</strong> Permanently suspending Terminate prevents all scale-in and health replacement — it abandons elasticity rather than solving the problem.</p>"
    },
    {
      q: "A web fleet's traffic follows a strong daily cycle, and instances take 12 minutes to become productive after launch. Reactive scaling always lags the morning ramp, causing 30 minutes of elevated latency each day. Which scaling approach best eliminates the morning lag?",
      options: [
        "Enable predictive scaling so capacity is launched ahead of the forecasted daily ramp, keeping target tracking for unexpected load",
        "Lower the target tracking CPU target from 60% to 50%",
        "Replace target tracking with simple scaling and a 60-second cooldown",
        "Configure step scaling with larger step adjustments at higher CPU breach levels",
        "Enable AZ rebalancing to distribute the morning load faster"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct.</strong> Predictive scaling trains on historical load (24 h minimum, up to 14 days) and schedules capacity ahead of the recurring ramp, so slow-booting instances are in service before demand arrives; target tracking remains for the non-cyclical residual. This is precisely the cyclical-load, slow-warmup use case.</p><p><strong>B:</strong> A lower CPU target over-provisions all day and still reacts only after load rises — it shrinks the lag at permanent cost rather than eliminating it. <strong>C:</strong> Simple scaling is the least responsive option (one adjustment per alarm, then cooldown lockout) — strictly worse. <strong>D:</strong> Bigger steps still fire only after breach, then wait 12 minutes for boot; the lag remains. <strong>E:</strong> AZRebalance equalizes instance counts across AZs; it adds no capacity and is unrelated to ramp lag.</p>"
    },
    {
      q: "An Auto Scaling group must be scaled based on an SQS queue so that messages are processed within 10 minutes. Directly targeting total queue depth caused runaway scale-out to the group maximum. Which metric design fixes this?",
      options: [
        "Target tracking on a custom backlog-per-instance metric: queue depth divided by in-service instance count, targeting a value derived from per-instance throughput and the latency goal",
        "Step scaling on the ApproximateAgeOfOldestMessage metric with a single large step",
        "Target tracking on ASGAverageCPUUtilization at 40%",
        "A scheduled action that sets desired capacity to maximum during business hours",
        "Simple scaling adding one instance whenever any message is visible in the queue"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct.</strong> Raw queue depth does not fall the moment instances launch, so a depth-targeting policy keeps adding capacity to max. Backlog per instance is inversely proportional to capacity, giving target tracking a controllable signal; the target value is (per-instance messages-per-second times acceptable seconds of latency). This is the AWS-documented SQS scaling pattern.</p><p><strong>B:</strong> Oldest-message age is a lagging indicator and a single large step either overshoots or undershoots; it also suffers the same added-capacity-does-not-immediately-move-the-metric problem. <strong>C:</strong> CPU is a poor proxy for queue backlog, especially for IO-bound consumers — the queue can grow while CPU stays modest. <strong>D:</strong> Scheduled max capacity ignores actual backlog and burns money off-peak. <strong>E:</strong> One instance per evaluation with cooldown lockout is far too slow, and any-message-visible is not a capacity signal.</p>"
    },
    {
      q: "A company needs to roll out a new AMI to a 60-instance Auto Scaling group with no more than 10% capacity reduction at any time, a pause for validation partway through, and automatic rollback if error alarms fire. What should the architect use?",
      options: [
        "An instance refresh with minimum healthy percentage of 90%, checkpoints, and CloudWatch alarm-based rollback",
        "Manually terminate 6 instances at a time and let the ASG relaunch them from the new launch template version",
        "A second Auto Scaling group and a Route 53 weighted failover between the two",
        "Suspend the HealthCheck process, replace all instances at once, then resume it",
        "Update the launch template and wait for the default termination policy to cycle old instances out"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct.</strong> Instance refresh is purpose-built rolling replacement: minimum healthy percentage 90% caps the capacity dip, checkpoints pause at defined progress percentages for validation, and rollback can trigger automatically on CloudWatch alarms.</p><p><strong>B:</strong> Manual terminate-and-relaunch approximates a refresh with no checkpointing, no rollback, and human error at every step. <strong>C:</strong> Blue/green with a second ASG works but doubles capacity cost and adds DNS cutover complexity — far more than required, and weighted+failover is a confused Route 53 configuration. <strong>D:</strong> Suspending health checks and replacing everything at once violates the 10% constraint outright. <strong>E:</strong> The termination policy only picks victims when scale-in happens; a steady-state group never cycles old instances — the fleet would run the old AMI indefinitely.</p>"
    },
    {
      q: "Which TWO statements about cross-zone load balancing in the ELB family are accurate? (Select TWO.)",
      options: [
        "It is enabled by default on Application Load Balancers with no inter-AZ data transfer charge",
        "It is enabled by default on Network Load Balancers with no inter-AZ data transfer charge",
        "It is disabled by default on Network Load Balancers, and enabling it incurs inter-AZ data transfer charges",
        "It is required for an ALB to serve targets in more than one Availability Zone",
        "Disabling it on an ALB removes the load balancer nodes from all but one AZ"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<p><strong>A and C are correct.</strong> The asymmetric defaults are a deliberate exam target: ALB ships with cross-zone on and AWS does not bill its inter-AZ traffic; NLB (and GWLB) ship with it off, and turning it on bills standard inter-AZ data transfer.</p><p><strong>B:</strong> Wrong on both counts for NLB — off by default, billed when on. <strong>D:</strong> An ALB serves multi-AZ targets regardless; without cross-zone each node simply serves only its own AZ's targets. Multi-AZ operation comes from enabling subnets in multiple AZs, not from this flag. <strong>E:</strong> Node placement is determined by the subnets you attach, never by the cross-zone setting.</p>"
    },
    {
      q: "A compliance mandate states that TLS must not be decrypted by any intermediary between the client and the application servers, which must also validate client certificates (mutual TLS terminated by the application). Which load balancer configuration satisfies this?",
      options: [
        "ALB HTTPS listener with a TLS 1.3 security policy and HTTPS to targets",
        "NLB TLS listener with an ACM certificate and TCP to targets",
        "NLB TCP listener passing port 443 through to targets that hold the certificates and terminate TLS",
        "ALB HTTPS listener with client certificate passthrough headers enabled",
        "CloudFront with origin SSL protocols restricted to TLS 1.3"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>C is correct.</strong> A TCP listener on an NLB is pure L4 pass-through: the TLS session is negotiated end-to-end between client and target, no intermediary ever holds keys or plaintext, and the application can terminate mutual TLS itself with full client-certificate control.</p><p><strong>A:</strong> The ALB decrypts at the listener and re-encrypts — an intermediary decrypts, violating the mandate; ALB-to-target TLS also skips certificate validation. <strong>B:</strong> A TLS listener on the NLB means the NLB terminates (decrypts) TLS — same violation. <strong>D:</strong> ALB mTLS modes still involve the ALB terminating the TLS session; the mandate requires application-terminated TLS. <strong>E:</strong> CloudFront terminates TLS at the edge by design — the strongest violation of all.</p>"
    },
    {
      q: "During an incident, an engineer needs to investigate a misbehaving instance in an Auto Scaling group without the group replacing it mid-investigation, while a replacement carries its share of traffic. What is the recommended approach?",
      options: [
        "Move the instance to Standby state, which detaches it from the load balancer and pauses health-based replacement while it remains in the group",
        "Enable instance scale-in protection on the instance",
        "Detach the instance from the group and decrement desired capacity",
        "Suspend the AZRebalance process for the whole group",
        "Stop the instance from the EC2 console and start it after the investigation"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct.</strong> Standby is built for exactly this: the instance is deregistered from the target group, exempt from health-check replacement, still owned by the group, and by default the ASG launches a replacement for its capacity — then you return it to InService when done.</p><p><strong>B:</strong> Scale-in protection only shields against scale-in victim selection; the ASG will still replace the instance if it fails health checks, and it keeps taking traffic. <strong>C:</strong> Detaching with a decremented desired removes the capacity (no replacement) and permanently orphans the instance from the group — heavier-handed than needed. <strong>D:</strong> AZRebalance suspension stops AZ evening-out churn; it does not stop unhealthy-instance replacement or remove the instance from traffic. <strong>E:</strong> A stopped instance fails EC2 status/health evaluation, and the ASG will terminate and replace it — the opposite of the goal.</p>"
    },
    {
      q: "Which THREE capabilities require choosing a Network Load Balancer rather than an Application Load Balancer? (Select THREE.)",
      options: [
        "Serving UDP-based syslog traffic on port 514",
        "Acting as the required load balancer behind a PrivateLink VPC endpoint service",
        "Routing requests to different target groups based on the URL path",
        "Providing customer-owned Elastic IP addresses for the load balancer",
        "Invoking a Lambda function as a target",
        "Returning a fixed maintenance-page response without contacting any target"
      ],
      answer: [0, 1, 3],
      multi: true,
      explanation: "<p><strong>A, B, and D are correct.</strong> UDP listeners exist only on NLB. A PrivateLink endpoint service classically requires an NLB fronting the service. Elastic IPs (one per AZ) are exclusive to NLB — ALB addresses are dynamic.</p><p><strong>C:</strong> Path-based routing is an ALB (L7) capability — the reverse of the question. <strong>E:</strong> Lambda targets are ALB-only; the NLB forwards packets and cannot synthesize Lambda invocations. <strong>F:</strong> Fixed-response actions are ALB listener-rule features; an NLB has no concept of generating an HTTP response itself.</p>"
    }
  ],

/* ------------------------------------------------------------------ */
/* Flashcards                                                          */
/* ------------------------------------------------------------------ */
  flashcards: [
    { front: "ALB vs NLB: connection handling model in one sentence each", back: "<strong>ALB:</strong> terminates client TCP/TLS and re-originates a new connection to the target (nginx/envoy model). <strong>NLB:</strong> L4 flow-hash pass-through — the target's kernel completes the client's handshake (LVS/IPVS model)." },
    { front: "Which ELB types support static IPs or Elastic IPs?", back: "Only <strong>NLB</strong>: one stable IP per AZ, optionally your own EIP per AZ. For static IP + L7 routing: NLB with an ALB target group, or Global Accelerator in front of an ALB." },
    { front: "GWLB: encapsulation protocol and port", back: "<strong>GENEVE on UDP 6081.</strong> The original IP packet is carried unmodified inside GENEVE to the appliance — the transparency that makes bump-in-the-wire inspection possible." },
    { front: "What are GWLB endpoints and what technology powers them?", back: "Interface endpoints powered by <strong>PrivateLink</strong> that you insert as route-table next hops, steering traffic from workload VPCs into the GWLB in the security VPC." },
    { front: "Cross-zone load balancing defaults for ALB, NLB, GWLB — and billing", back: "<strong>ALB:</strong> on by default, inter-AZ traffic free. <strong>NLB/GWLB:</strong> off by default; enabling it bills standard inter-AZ data transfer." },
    { front: "What happens when ALL targets in a target group are unhealthy?", back: "<strong>Fail-open:</strong> the load balancer routes to all registered targets anyway — health checks are assumed to be the lying component. Partial service beats guaranteed blackhole." },
    { front: "Deregistration delay: what it does and its default", back: "On deregistration the target enters <em>draining</em>: no new requests/flows, in-flight work allowed to finish. Default <strong>300 s</strong>, range 0-3600 s. NLB long-lived flows may persist past it." },
    { front: "Slow start mode on an ALB target group", back: "Linearly ramps a newly healthy target's request share over 30-900 s (off by default). For cold JVMs/caches. Incompatible with least-outstanding-requests routing; ramp resets if the target flaps." },
    { front: "ALB sticky session cookie types", back: "<strong>Duration-based:</strong> ALB-generated <code>AWSALB</code> cookie, 1 s to 7 days. <strong>Application-based:</strong> your app's named cookie mirrored by <code>AWSALBAPP</code> — the app controls session lifetime." },
    { front: "How does an application behind an ALB learn the client's real IP?", back: "<code>X-Forwarded-For</code> header (plus X-Forwarded-Proto/Port) — the TCP peer is an ALB node. NLB with instance targets preserves the true source IP at L3 instead." },
    { front: "ALB target types (three)", back: "<strong>instance</strong> (EC2 instance ID), <strong>ip</strong> (private IPs — ECS awsvpc tasks, EKS pods, on-prem over DX/VPN; no public IPs), <strong>lambda</strong> (synchronous invoke, 1 MB payload cap)." },
    { front: "How many TLS certificates can one ALB listener serve, and how are they selected?", back: "A default certificate plus up to <strong>25</strong> more, selected per connection via <strong>SNI</strong> from the ClientHello hostname. CLB cannot do SNI — one cert per CLB." },
    { front: "Does an ALB validate the target's TLS certificate when re-encrypting to targets?", back: "<strong>No.</strong> Any certificate, including self-signed, is accepted. ALB-to-target HTTPS provides encryption in transit, not target authentication." },
    { front: "End-to-end TLS with no intermediary decryption: which configuration?", back: "<strong>NLB with a TCP listener</strong> passing 443 through; targets hold certificates and terminate TLS (including mTLS) themselves. An NLB TLS listener would decrypt — wrong for this mandate." },
    { front: "NLB TCP idle timeout and its operational consequence", back: "<strong>350 seconds, not configurable.</strong> Idle flow state expires and the next packet gets an RST — long-lived connections (databases, message buses) need TCP keepalives under 350 s." },
    { front: "Launch template vs launch configuration", back: "Launch templates are <strong>versioned</strong>, support mixed instances (Spot+On-Demand, multiple types), and all new features. Launch configurations are deprecated, immutable, single-type. New designs: templates, always." },
    { front: "Target tracking scaling: who manages the CloudWatch alarms?", back: "<strong>Auto Scaling creates and manages them</strong> (a pair per policy). Editing or deleting them silently breaks scaling. Predefined metrics include ASGAverageCPUUtilization and ALBRequestCountPerTarget." },
    { front: "Cooldown vs instance warmup", back: "<strong>Cooldown</strong> (simple scaling, default 300 s) blocks subsequent scaling actions. <strong>Warmup</strong> tells target tracking/step scaling how long a new instance takes before its metrics count as contributing capacity — prevents over-scaling during boot." },
    { front: "Predictive scaling: data requirement and best-fit workload", back: "Needs at least <strong>24 hours</strong> of history (uses up to 14 days); forecasts and schedules capacity ahead of recurring cycles. Best for cyclical load + slow-booting instances. Run forecast-only mode first; keep a reactive policy alongside." },
    { front: "ASG lifecycle hook states and default heartbeat timeout", back: "<strong>Pending:Wait</strong> (before InService: config pull, warmup, smoke test) and <strong>Terminating:Wait</strong> (before shutdown: drain, log upload, checkpoint). Heartbeat default <strong>3600 s</strong>, max 48 h with heartbeats." },
    { front: "Warm pool instance states and the cost trade-off", back: "<strong>Stopped</strong> (default — pay EBS only, seconds-fast entry), <strong>Running</strong> (full price, fastest), <strong>Hibernated</strong> (RAM to disk, middle path). Buys fast scale-out for slow-initializing apps." },
    { front: "Default ASG termination policy order", back: "1) AZ with most instances (balance), 2) oldest launch template/configuration, 3) closest to the next billing hour, 4) random. AZ balance is evaluated before any custom policy list." },
    { front: "ASG health check types and the grace period failure mode", back: "<strong>EC2</strong> (status checks only — a wedged app looks healthy) vs <strong>ELB</strong> (target health drives replacement). Grace period (default 300 s) shorter than boot time = endless terminate-relaunch flapping of every new instance." },
    { front: "What does instance scale-in protection NOT protect against?", back: "Only scale-in victim selection is blocked. It does <strong>not</strong> stop health-check replacement, manual termination, Spot reclamation, or instance refresh. Workers toggle it around long jobs." },
    { front: "Standby vs detach for an ASG instance", back: "<strong>Standby:</strong> temporarily out of service (LB-deregistered, no health replacement), still in the group — for debugging, then return to InService. <strong>Detach:</strong> permanent removal; instance lives on outside the group." }
  ],

/* ------------------------------------------------------------------ */
/* Lab                                                                 */
/* ------------------------------------------------------------------ */
  lab: {
    title: "Lab: ALB + Auto Scaling group with target tracking, watch a scale event",
    html: `
<h3>Goal</h3>
<p>Build the canonical elastic web tier entirely from the CLI: a launch template, an Auto Scaling group spread across two AZs, an ALB with a target group, a target tracking policy on CPU — then force a scale-out, watch the ASG converge, and tear it all down.</p>

<h3>Architecture</h3>
<p>An internet-facing ALB in two public subnets forwards HTTP:80 to a target group. An ASG (min 1, max 3, desired 1) of t3.micro instances registers into that target group with the ELB health check type. A target tracking policy holds average CPU at 30%; a stress tool pushes CPU past the target, target tracking's auto-created alarm fires, and the group scales out. Cost note: t3.micro is free-tier eligible, but the <strong>ALB bills roughly 2-3 cents per hour plus LCUs from the moment it is created</strong> — finish the Teardown in the same sitting and the total is pennies.</p>

<h3>Steps</h3>
<ol>
<li><p>Set up environment variables using your default VPC and two of its subnets (different AZs):</p>
<pre><code>export AWS_DEFAULT_REGION=us-east-1
VPC_ID=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true \
  --query 'Vpcs[0].VpcId' --output text)
read -r SUBNET1 SUBNET2 &lt;&lt;&lt; $(aws ec2 describe-subnets \
  --filters Name=vpc-id,Values=$VPC_ID \
  --query 'Subnets[0:2].SubnetId' --output text)
echo "$VPC_ID $SUBNET1 $SUBNET2"</code></pre></li>

<li><p>Create two security groups: one for the ALB (HTTP from anywhere), one for instances (HTTP only from the ALB's SG — the correct least-privilege chain, and it also admits health checks):</p>
<pre><code>ALB_SG=$(aws ec2 create-security-group --group-name lab5-alb-sg \
  --description "lab5 alb" --vpc-id $VPC_ID \
  --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $ALB_SG \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

EC2_SG=$(aws ec2 create-security-group --group-name lab5-ec2-sg \
  --description "lab5 ec2" --vpc-id $VPC_ID \
  --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $EC2_SG \
  --protocol tcp --port 80 --source-group $ALB_SG</code></pre></li>

<li><p>Write user data that serves the instance ID and installs a stress tool, then create the launch template (Amazon Linux 2023, IMDSv2 enforced):</p>
<pre><code>cat &gt; /tmp/lab5-userdata.sh &lt;&lt;'EOF'
#!/bin/bash
dnf install -y httpd stress-ng
TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
IID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id)
echo "lab5 on $IID" &gt; /var/www/html/index.html
systemctl enable --now httpd
EOF
UD=$(base64 -w0 /tmp/lab5-userdata.sh)
AMI=$(aws ssm get-parameter \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query Parameter.Value --output text)
aws ec2 create-launch-template --launch-template-name lab5-lt \
  --launch-template-data "{\"ImageId\":\"$AMI\",\"InstanceType\":\"t3.micro\",\"SecurityGroupIds\":[\"$EC2_SG\"],\"UserData\":\"$UD\",\"MetadataOptions\":{\"HttpTokens\":\"required\"}}"</code></pre></li>

<li><p>Create the target group (note the health check knobs — interval 10, thresholds 2 — so state transitions are fast enough to watch) and the ALB, then wire the listener:</p>
<pre><code>TG_ARN=$(aws elbv2 create-target-group --name lab5-tg \
  --protocol HTTP --port 80 --vpc-id $VPC_ID \
  --health-check-path / --health-check-interval-seconds 10 \
  --healthy-threshold-count 2 --unhealthy-threshold-count 2 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)
ALB_ARN=$(aws elbv2 create-load-balancer --name lab5-alb \
  --type application --security-groups $ALB_SG \
  --subnets $SUBNET1 $SUBNET2 \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)
aws elbv2 create-listener --load-balancer-arn $ALB_ARN \
  --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN
aws elbv2 wait load-balancer-available --load-balancer-arns $ALB_ARN</code></pre></li>

<li><p>Create the ASG attached to the target group, using the ELB health check type and a 120-second grace period (longer than AL2023 boot + dnf install — remember the flapping trap from the lesson):</p>
<pre><code>aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name lab5-asg \
  --launch-template LaunchTemplateName=lab5-lt,Version='$Latest' \
  --min-size 1 --max-size 3 --desired-capacity 1 \
  --vpc-zone-identifier "$SUBNET1,$SUBNET2" \
  --target-group-arns $TG_ARN \
  --health-check-type ELB --health-check-grace-period 120 \
  --default-instance-warmup 60</code></pre></li>

<li><p>Attach a target tracking policy holding average CPU at 30% (deliberately low so a single stress run trips it). Then look at the two alarms target tracking created for you — do not touch them:</p>
<pre><code>aws autoscaling put-scaling-policy \
  --auto-scaling-group-name lab5-asg --policy-name lab5-cpu30 \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration \
  '{"PredefinedMetricSpecification":{"PredefinedMetricType":"ASGAverageCPUUtilization"},"TargetValue":30.0}'
aws cloudwatch describe-alarms --alarm-name-prefix TargetTracking \
  --query 'MetricAlarms[].AlarmName'</code></pre></li>

<li><p>Wait for the first instance to go healthy, then hit the ALB:</p>
<pre><code>DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' --output text)
aws elbv2 describe-target-health --target-group-arn $TG_ARN \
  --query 'TargetHealthDescriptions[].[Target.Id,TargetHealth.State]'
curl -s http://$DNS/</code></pre></li>

<li><p>Force the scale event. Burn CPU on the instance for 10 minutes via SSM (or SSH if you prefer; if SSM is not set up, add an instance profile with AmazonSSMManagedInstanceCore to the launch template, or just run stress-ng from an SSH session):</p>
<pre><code>IID=$(aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names lab5-asg \
  --query 'AutoScalingGroups[0].Instances[0].InstanceId' --output text)
aws ssm send-command --instance-ids $IID \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["stress-ng --cpu 2 --timeout 600 &amp;"]'</code></pre></li>
</ol>

<h3>Verify</h3>
<p>Within roughly 3-5 minutes (three 1-minute datapoints above target for the auto-created alarm, plus launch time), the group scales out. Watch it happen from three angles:</p>
<pre><code>watch -n 15 "aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names lab5-asg \
  --query 'AutoScalingGroups[0].[DesiredCapacity,length(Instances)]'"

aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name lab5-asg --max-items 5 \
  --query 'Activities[].[StatusCode,Cause]'</code></pre>
<p>The activity Cause string names the target tracking alarm that fired — read it; it is the paper trail you will use in production incidents. Then loop curl against the ALB DNS and watch responses alternate between instance IDs as the new target goes healthy. After stress-ng exits, average CPU falls below 30% and (after the conservative scale-in wait, ~15 minutes) the group scales back to 1 — scale-in being slower than scale-out is target tracking working as designed. Optionally re-read the termination policy lesson and predict which instance dies before it happens.</p>

<h3>Teardown</h3>
<p>Order matters: scaling policies and instances first, load balancer before its security group (or the SG delete fails with a dependency error), template last. Everything here bills until deleted — the ALB hourly charge is the one that will actually cost you if forgotten.</p>
<ol>
<li><p>Delete the ASG (force-delete terminates its instances and removes the policy with it):</p>
<pre><code>aws autoscaling delete-auto-scaling-group \
  --auto-scaling-group-name lab5-asg --force-delete
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names lab5-asg \
  --query 'AutoScalingGroups[0].Status'</code></pre></li>
<li><p>Delete the load balancer and target group:</p>
<pre><code>aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN
aws elbv2 wait load-balancers-deleted --load-balancer-arns $ALB_ARN
aws elbv2 delete-target-group --target-group-arn $TG_ARN</code></pre></li>
<li><p>Delete the launch template:</p>
<pre><code>aws ec2 delete-launch-template --launch-template-name lab5-lt</code></pre></li>
<li><p>Delete the security groups (instance SG first — it references the ALB SG; wait a minute after LB deletion if you get DependencyViolation while ENIs release):</p>
<pre><code>aws ec2 delete-security-group --group-id $EC2_SG
aws ec2 delete-security-group --group-id $ALB_SG</code></pre></li>
<li><p>Confirm nothing is left billing:</p>
<pre><code>aws elbv2 describe-load-balancers \
  --query "LoadBalancers[?contains(LoadBalancerName,'lab5')].LoadBalancerName"
aws ec2 describe-instances \
  --filters Name=tag:aws:autoscaling:groupName,Values=lab5-asg \
  Name=instance-state-name,Values=running,pending \
  --query 'Reservations[].Instances[].InstanceId'</code></pre>
<p>Both should come back empty. If anything lingers, re-run the corresponding delete — the ALB and any running instances are the only items here with a meaningful hourly cost.</p></li>
</ol>
`
  }
});
