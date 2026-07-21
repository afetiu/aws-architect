window.COURSE.register({
  id: "vpc",
  order: 3,
  track: "saa",
  title: "VPC & Core Networking",
  description: "The VPC is a software-defined L3 domain with opinionated defaults: an implicit distributed router, stateful firewalling at the ENI, and NAT semantics you pay for. This module builds the mental model — CIDR design, routing, NAT, SG/NACL, peering, endpoints, DNS — and the failure modes and quotas the exam and production both punish you for ignoring.",
  examWeight: "Heavily weighted on SAA-C03 — networking underpins questions in every domain. Expect direct questions on SG vs NACL statefulness, NAT Gateway HA and cost, gateway vs interface endpoints, and peering's non-transitivity.",
  lessons: [
    {
      id: "cidr-design",
      title: "CIDR Design: Carving Address Space You Won't Regret",
      html: `
<p>A VPC is a regional, software-defined L3 domain. You assign it an IPv4 CIDR between <strong>/16 and /28</strong>, and every subnet you carve from it is a broadcast-domain-shaped fiction: there is no actual L2 broadcast, no ARP flooding across a wire — the mapping service resolves next-hops, and the "router" is a distributed function, not a box. But the addressing math is real, and getting it wrong is the single most expensive-to-fix mistake in AWS networking, because <strong>you cannot resize or renumber a subnet in place</strong>. You can only add space, never shrink or change what exists.</p>

<h3>RFC 1918 and what AWS actually enforces</h3>
<p>Convention says use RFC 1918 space (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16). AWS will technically let you use publicly routable ranges as a VPC CIDR — traffic to them just stays inside the VPC and you lose the ability to reach the real owners of that space. The exam treats non-RFC1918 primary CIDRs as a wrong answer unless the question is explicitly about BYOIP. The real-world rule: treat your org's 10.0.0.0/8 like a scarce resource with a central allocation plan (this is exactly what Amazon VPC IPAM productizes), because <strong>overlapping CIDRs kill peering and complicate VPN/DX routing forever</strong>.</p>

<h3>The five reserved IPs per subnet</h3>
<p>In every subnet, AWS reserves five addresses. For 10.0.0.0/24:</p>
<table>
<thead><tr><th>Address</th><th>Reserved for</th></tr></thead>
<tbody>
<tr><td>10.0.0.0</td><td>Network address</td></tr>
<tr><td>10.0.0.1</td><td>Implicit VPC router (default gateway you never configure)</td></tr>
<tr><td>10.0.0.2</td><td>AmazonProvidedDNS (base of the VPC CIDR +2, mirrored in every subnet)</td></tr>
<tr><td>10.0.0.3</td><td>Reserved by AWS for future use</td></tr>
<tr><td>10.0.0.255</td><td>Network broadcast address (reserved even though broadcast is unsupported)</td></tr>
</tbody>
</table>
<p>So a /28 subnet — the minimum — yields 16 minus 5 = <strong>11 usable addresses</strong>, and a /24 yields 251. This matters more than it looks: EKS pods consuming ENI secondary IPs, Lambda-in-VPC ENIs, interface endpoints, and ALB nodes (which need at least 8 free IPs per subnet to scale) all eat addresses from your subnets. IP exhaustion in a "plenty big" /24 is a classic production incident.</p>

<div class="callout exam">Memorize the five reserved addresses and their roles. The exam loves ".2 is the DNS resolver" and "a /28 has 11 usable IPs". Also: VPC CIDR range is /16 to /28 — a /15 or /29 is an instant wrong answer.</div>

<h3>Secondary CIDRs: the escape hatch, with strings attached</h3>
<p>You can attach up to <strong>5 IPv4 CIDR blocks</strong> to a VPC by default (soft quota). This is how you survive exhaustion: bolt on a secondary range and create new subnets in it. Constraints worth knowing:</p>
<ul>
<li>The secondary block cannot overlap the primary or any peered/connected network (routing still has to work).</li>
<li>There are compatibility restrictions between RFC1918 classes — e.g., if your primary is in 10.0.0.0/8 space you cannot add a 192.168.0.0/16 secondary; you can add more 10.x space or the non-RFC1918 100.64.0.0/10 (CGNAT) range.</li>
<li>The 100.64.0.0/10 trick is a legitimate pattern: use CGNAT space for address-hungry, non-routable workloads (EKS pod networking is the canonical case) so pods do not consume routable org space. On-prem will never route to it, which is the point.</li>
</ul>

<h3>Sizing strategy</h3>
<p>Think like you are designing an IGP addressing plan, because you are:</p>
<ul>
<li><strong>Allocate VPCs from a regional supernet.</strong> E.g., 10.16.0.0/12 for us-east-1, VPCs as /16s inside it. One summarizable route per region toward on-prem instead of route-table confetti.</li>
<li><strong>Subnet per AZ per tier</strong>, sized asymmetrically: private/app subnets get the big blocks (/20 is a sane default — pods, Lambdas, containers live here); public subnets can be small (/24 — they hold load balancer nodes and NAT gateways, not fleets).</li>
<li><strong>Leave gaps.</strong> Do not carve the whole /16 on day one. Unallocated space is your only resizing mechanism.</li>
<li>Subnets are AZ-scoped and CIDRs within a VPC cannot overlap. A subnet is in exactly one AZ; there is no multi-AZ subnet.</li>
</ul>

<div class="callout war">The two most common irreversible mistakes: (1) every team uses 10.0.0.0/16 as their default VPC CIDR, then years later M&amp;A or a shared-services rollout demands peering and everything overlaps; (2) /24 private subnets in an EKS cluster where every pod takes a VPC IP — the cluster stalls at scale-out with ENI allocation failures while the VPC looks mostly empty. Plan for the address consumers you cannot see yet.</div>

<div class="callout limits">VPC IPv4 CIDR: /16 to /28. CIDR blocks per VPC: 5 (soft, raisable to 50). Subnets per VPC: 200 (soft). 5 reserved IPs per subnet. VPCs per region: 5 (soft, trivially raised). None of these are billing-relevant — VPCs, subnets, route tables, SGs, and gateway endpoints are free; you pay for NAT, interface endpoints, and traffic.</div>

<p>Pricing shape for the module as a whole, since it frames every design choice: the VPC constructs themselves are free. You pay hourly + per-GB for NAT gateways, hourly per-AZ + per-GB for interface endpoints, per-GB for inter-AZ and cross-region traffic, and (since 2024) about 0.005 USD/hr for <strong>every public IPv4 address</strong>, attached or not. Good CIDR design is free; bad CIDR design makes you buy NAT gateways and TGW attachments to route around your own mistakes.</p>
`
    },
    {
      id: "routing-igw",
      title: "Route Tables, the Implicit Router, and Internet Gateways",
      html: `
<p>Every VPC has an <strong>implicit router</strong>. It is not a device you can see, size, or saturate — it is a distributed function of the Nitro/mapping-service fabric, reachable at the first usable address of every subnet (.1). You program it exclusively through <strong>route tables</strong>. There is no OSPF, no static ARP games, no router CPU to melt: if the route table says it, packets go there; if not, they are dropped with no ICMP courtesy.</p>

<h3>Route table mechanics</h3>
<ul>
<li>Every VPC has a <strong>main route table</strong>. A subnet not explicitly associated with a custom table uses the main one implicitly. Battle-tested practice: leave the main table with only the local route, so a forgotten association fails closed rather than inheriting your 0.0.0.0/0-to-IGW route.</li>
<li>Every route table contains the <strong>local route</strong> for the VPC CIDR (and each secondary CIDR). You cannot delete it. Since a few years ago you can make routes <em>more specific</em> than local pointing at certain targets (a GWLB endpoint or ENI) — the basis of intra-VPC inspection — but you cannot override local with a coarser route.</li>
<li><strong>Longest-prefix match wins</strong>, exactly as you expect from any FIB. Static routes you create beat propagated routes of the same prefix length (relevant once VGW route propagation enters the picture).</li>
<li>Route targets: IGW, egress-only IGW, NAT gateway, peering connection, VGW, TGW, ENI (an instance), gateway VPC endpoint (via prefix list), GWLB endpoint, carrier gateway.</li>
</ul>

<p>A "public subnet" is nothing but a subnet whose route table has 0.0.0.0/0 pointing at an IGW. A "private subnet" is one that does not. There is no subnet attribute called public — it is purely a routing statement plus, in practice, the auto-assign-public-IP setting.</p>

<h3>The Internet Gateway is a NAT device (surprise)</h3>
<p>The IGW is horizontally scaled, redundant, and has no bandwidth cap or availability risk you can influence — it is not a choke point and never the answer to "what fails". The under-appreciated internal: your instance <strong>never has its public IP configured on its interface</strong>. The OS only knows the private address. The IGW performs stateless 1:1 NAT between the private IP and the associated public IPv4 (auto-assigned or an EIP) as traffic crosses it. Run <code>ip addr</code> on an EC2 instance and you will only ever see 10.x — this is why binding a daemon to "the public IP" fails, and why the metadata service exists to tell you what your public IP is.</p>

<p>For an instance to be internet-reachable, all four must hold — this is the exam's favorite troubleshooting checklist:</p>
<ol>
<li>IGW attached to the VPC (exactly one per VPC).</li>
<li>Subnet route table has a default route (or specific route) to the IGW.</li>
<li>The instance has a public IPv4 or EIP mapped to it.</li>
<li>SG and NACL permit the traffic in the relevant directions.</li>
</ol>

<div class="callout exam">"Instance in a public subnet cannot be reached from the internet" questions cycle through exactly those four causes. If the question says the subnet's route table is correct and the SG allows the port, the answer is almost always "no public IP assigned". Also know: you cannot attach two IGWs to one VPC, and detaching an IGW with mapped public IPs in use is blocked.</div>

<h3>Egress-only Internet Gateway: the IPv6 story</h3>
<p>IPv6 addresses in a VPC are <strong>globally unique addresses (GUA)</strong> — publicly routable, no such thing as a private IPv6 address in the NAT sense (ULA is not supported for VPC CIDRs). So "private subnet" semantics cannot come from address translation; they must come from routing. The <strong>egress-only IGW (EIGW)</strong> is the answer: a stateful gateway that allows outbound IPv6 flows and their return traffic, but drops connections initiated from the internet. It is conceptually "NAT gateway semantics without the NAT" — connection tracking only. Point ::/0 at the EIGW for private IPv6 subnets, ::/0 at the regular IGW for public ones. EIGW is IPv6-only, free, and per-VPC; there is no IPv4 equivalent because IPv4 gets the same behavior from a NAT gateway.</p>

<div class="callout deep">Why can the IGW be stateless 1:1 NAT while the EIGW must be stateful? Because 1:1 NAT needs no connection table — the mapping is a pure bijection both directions. Egress-only filtering is inherently directional, so the EIGW must track flows to admit return packets. Same reason a stateless NACL needs ephemeral-port rules but a stateful SG does not.</div>

<h3>Gateway route tables and edge association</h3>
<p>You can associate a route table with an IGW or VGW ("edge association") to steer <em>inbound</em> traffic — e.g., send all traffic entering via the IGW destined for your app subnets through a GWLB endpoint fronting a firewall fleet. This is called <strong>ingress routing</strong>. For SAA you just need to know it exists and what it is for; the Pro module builds real architectures on it.</p>

<div class="callout war">Most-specific-route surprises bite during migrations: someone adds a 10.1.0.0/16 route to a peering connection, and months later a new secondary CIDR 10.1.128.0/17 shows up locally — the finer local route silently wins and "the peer stopped receiving traffic for half its range". Audit route tables like code; they are the FIB of your business.</div>

<div class="callout limits">Route tables per VPC: 200 (soft). Routes per route table: 50 static (soft, raisable to 1000) and 100 propagated (hard-ish — raising requires support and has performance caveats). One IGW per VPC. These numbers are why big hybrid designs summarize aggressively or move to TGW.</div>
`
    },
    {
      id: "nat",
      title: "NAT: Managed Gateways, DIY Instances, and Port Exhaustion",
      html: `
<p>Private-subnet instances with outbound-only internet needs require NAPT (many private IPs behind few public ones, multiplexed on ports). AWS gives you a managed appliance — the <strong>NAT Gateway</strong> — and the legacy DIY option of a <strong>NAT instance</strong> (an EC2 box doing iptables MASQUERADE). The exam wants you to know when each is right; production wants you to know how the managed one fails.</p>

<h3>NAT Gateway mechanics</h3>
<ul>
<li>Lives in <strong>one subnet in one AZ</strong>. It is zonal. HA across AZs is your job: one NAT gateway per AZ, and each private subnet's route table points 0.0.0.0/0 at the NAT gateway <em>in its own AZ</em>. This buys both fault isolation (an AZ failure does not strand other AZs' egress) and avoids paying inter-AZ data charges for egress traffic.</li>
<li>Public NAT gateway: sits in a public subnet, holds an EIP, egress goes on to the IGW. Private NAT gateway: no EIP, used to NAT between overlapping/hybrid address spaces toward a TGW or VGW — niche but exam-adjacent.</li>
<li>Scales automatically from 5 Gbps to <strong>100 Gbps</strong>. You do not size it.</li>
<li>It is not associated with a security group. NACLs on its subnet apply; SGs do not. (A NAT <em>instance</em> does have an SG — a classic discriminator question.)</li>
<li>Connection idle timeout: 350 seconds for TCP. Long-lived idle connections through NAT die unless the endpoints send keepalives under that threshold.</li>
</ul>

<h3>The port-exhaustion limit everyone hits eventually</h3>
<p>A NAT gateway supports about <strong>55,000 simultaneous connections to each unique destination</strong> (destination IP + port + protocol tuple). That is the ephemeral port range from one source address per destination. Exceed it and you get <code>ErrorPortAllocation</code> in CloudWatch metrics and silent connect timeouts in the app. The classic trigger: a large fleet hammering a single external API endpoint, or worse, hammering S3 through NAT instead of an endpoint. Mitigations: associate <strong>multiple EIPs</strong> with the NAT gateway (up to 8, multiplying the tuple space), split traffic across NAT gateways in more subnets, or — the right answer for AWS destinations — stop traversing NAT at all and use VPC endpoints.</p>

<div class="callout limits">Numbers to memorize: 55,000 concurrent connections per unique destination per NAT gateway (scalable toward 440k with 8 EIPs), 100 Gbps burst bandwidth, 350 s TCP idle timeout, ~10 million packets per second. NAT gateway is zonal — "highly available NAT" always means one per AZ.</div>

<h3>Cost model — the silent bill</h3>
<p>You pay roughly 0.045 USD per hour <em>and</em> 0.045 USD per GB processed (us-east-1). The per-GB charge applies to <strong>all traffic through it, both directions, including traffic to AWS services in the same region</strong>. The infamous pattern: private subnets pushing terabytes to S3 through a NAT gateway. A free <strong>gateway endpoint</strong> for S3 would carry the same traffic for zero. On the exam, "reduce NAT gateway data processing charges for S3/DynamoDB access" maps to gateway endpoints, full stop. In production, the NAT data-processing line item is routinely the biggest surprise in a new account's bill.</p>

<div class="callout exam">Trap patterns: (1) "NAT gateway in one AZ, instances in three AZs — what is the risk?" — single-AZ dependency plus cross-AZ data charges; answer deploys one per AZ. (2) "Thousands of connections failing to one SaaS endpoint" — port allocation exhaustion; add EIPs or more NAT gateways. (3) "Cut costs for heavy S3 access from private subnets" — gateway endpoint. (4) Anything that needs the NAT layer to filter with security groups or be used as a bastion — that requires a NAT instance, because gateways take no SGs.</div>

<h3>NAT instance: when the museum piece still wins</h3>
<p>A NAT instance is just EC2 with source/dest check disabled and ip_forward + MASQUERADE. Comparison:</p>
<table>
<thead><tr><th></th><th>NAT Gateway</th><th>NAT Instance</th></tr></thead>
<tbody>
<tr><td>Availability</td><td>Managed, redundant within its AZ</td><td>Your problem (ASG + script-based route failover)</td></tr>
<tr><td>Bandwidth</td><td>Up to 100 Gbps, automatic</td><td>Instance type dependent</td></tr>
<tr><td>Security groups</td><td>Not supported</td><td>Supported</td></tr>
<tr><td>Port forwarding / customization</td><td>No</td><td>Yes (iptables is yours)</td></tr>
<tr><td>Use as bastion</td><td>No</td><td>Yes</td></tr>
<tr><td>Cost at low traffic</td><td>~33 USD/mo floor + per-GB</td><td>A t4g.nano is ~3 USD/mo</td></tr>
<tr><td>Source/dest check</td><td>N/A</td><td>Must be disabled — favorite exam detail</td></tr>
</tbody>
</table>
<p>Legitimate NAT-instance use today: dev/sandbox accounts where 33 USD/month × AZs × VPCs is real money, or when you need packet-level control. Everything else: gateway.</p>

<div class="callout war">Two production war stories worth internalizing. First: an AZ event takes out the single shared NAT gateway and every private subnet in the VPC loses egress — package installs, webhook deliveries, third-party APIs — while the app instances themselves are healthy; multi-AZ NAT would have contained it. Second: a data pipeline moved from public instances to private subnets "for security" and the next month's NAT processing bill exceeded the compute bill; nobody had added the S3 gateway endpoint. Egress architecture is a cost architecture.</div>

<p>Design summary: one NAT gateway per AZ, zonal route tables, gateway endpoints for S3/DynamoDB always (they are free — there is no reason not to), interface endpoints for chatty AWS APIs, and treat remaining NAT traffic as a metered luxury. When nothing in the subnet needs the public internet at all, have no NAT and no default route — absence of routes is the cheapest and most secure firewall.</p>
`
    },
    {
      id: "sg-nacl",
      title: "Security Groups vs NACLs: Stateful, Stateless, and the Exam Traps",
      html: `
<p>Two packet filters, different layers of the abstraction, different state models. A <strong>security group</strong> is a stateful, connection-tracking firewall attached to an <strong>ENI</strong>. A <strong>network ACL</strong> is a stateless, ordered rule list attached to a <strong>subnet</strong> boundary. A senior-engineer mapping: SG ≈ conntrack-based rules (iptables with ESTABLISHED,RELATED accepted implicitly, and no REJECT/DROP rules allowed of your own); NACL ≈ a classic router ACL — dumb, ordered, evaluated per packet in each direction.</p>

<h3>Security groups</h3>
<ul>
<li><strong>Allow rules only.</strong> There is no deny. Default disposition is deny-everything-not-allowed. Inbound default: nothing. Outbound default: allow all (which most orgs never tighten, for better or worse).</li>
<li><strong>Stateful:</strong> if inbound 443 is allowed, the response packets flow regardless of outbound rules, and vice versa. Connection tracking handles it. Corollary: you never open ephemeral ports in an SG.</li>
<li><strong>All rules are evaluated</strong> — no ordering, no first-match. The union of all attached SGs' rules applies.</li>
<li><strong>SG references:</strong> a rule's source/destination can be another SG ID. "Allow 5432 from sg-app" means: from any ENI that has sg-app attached, private IPs only, membership evaluated dynamically. This is the idiomatic AWS microsegmentation primitive — tiers reference each other and nobody hardcodes CIDRs. References work across VPC peering (same region) too.</li>
<li>SGs are VPC-scoped, attach to ENIs (instances, RDS, Lambda, ALB, endpoints — everything with an ENI), and changes apply immediately to existing connections' <em>future</em> packets — new rules take effect without restart, though an already-tracked allowed flow is not retroactively cut for some rule removals (untracked vs tracked connection nuances exist; do not rely on SG changes to kill live connections).</li>
</ul>

<h3>NACLs</h3>
<ul>
<li><strong>Stateless:</strong> every packet is evaluated against inbound rules on the way in and outbound rules on the way out. Return traffic must be explicitly allowed. This means allowing the <strong>ephemeral port range</strong> (1024-65535 to be safe; clients like Linux use 32768-60999) in the opposite direction of the service port.</li>
<li><strong>Numbered rules, first match wins</strong>, evaluated ascending; an asterisk deny sits at the end. Leave gaps (100, 200, 300) like it is 1995 and you are editing a Cisco ACL, because you are.</li>
<li><strong>Supports deny.</strong> This is the one thing NACLs do that SGs cannot: block a specific CIDR or IP. "Block a malicious IP range" → NACL deny rule.</li>
<li>Subnet-scoped: applies to traffic crossing the subnet boundary. <strong>Intra-subnet traffic never touches the NACL.</strong> One NACL per subnet; a NACL can cover many subnets. The default NACL allows all; a newly created custom NACL denies all — a lovely way to blackhole a subnet by association.</li>
</ul>

<h3>The comparison table the exam is built on</h3>
<table>
<thead><tr><th></th><th>Security group</th><th>NACL</th></tr></thead>
<tbody>
<tr><td>Attaches to</td><td>ENI</td><td>Subnet</td></tr>
<tr><td>State</td><td>Stateful (conntrack)</td><td>Stateless (per-packet)</td></tr>
<tr><td>Rule types</td><td>Allow only</td><td>Allow and deny</td></tr>
<tr><td>Evaluation</td><td>All rules, union</td><td>Ordered, first match</td></tr>
<tr><td>Return traffic</td><td>Automatic</td><td>Must allow ephemeral ports</td></tr>
<tr><td>Can reference SGs</td><td>Yes</td><td>No, CIDRs only</td></tr>
<tr><td>Default (custom-created)</td><td>Deny in, allow out</td><td>Deny everything</td></tr>
</tbody>
</table>

<div class="callout exam">The traps, in descending frequency: (1) "Connections from clients succeed but responses never arrive after adding a NACL" — missing outbound ephemeral-port allow; statelessness is the answer. (2) "Block one abusive IP" — NACL deny; SGs cannot deny. (3) "App tier must accept traffic only from the web tier's instances, which autoscale" — SG referencing the web tier's SG, never CIDR rules. (4) A question showing both an SG and a NACL where one allows and the other blocks — remember evaluation order: inbound hits NACL first, then SG; outbound hits SG first, then NACL. Both must permit. (5) SGs are deny-by-default inbound: "allowed in the SG" must be explicit.</div>

<div class="callout deep">Where does the SG actually run? On the Nitro card / hypervisor dataplane at the ENI, as connection-tracked flow entries — not in your instance's kernel, which is why you cannot bypass it from inside the guest and why there is a <strong>connection-tracking allowance per instance</strong>. Instances with enormous flow counts (big proxies, DNS forwarders) can exhaust conntrack entries; symptoms are dropped new flows while established ones live. Rules that allow 0.0.0.0/0 both directions on all ports make some flows "untracked" and exempt, an obscure but real scaling valve.</div>

<div class="callout war">Real incidents: a team "hardens" outbound SG rules to specific ports and breaks path-MTU discovery and health checks that used ICMP — remember ICMP is its own protocol in SG rules, not a port. Another: someone associates subnets with a freshly created NACL (default deny-all) during a compliance push and takes down three tiers at once; SG-only shops forget that custom NACLs start hostile. Use NACLs sparingly — coarse subnet-level guardrails (deny RFC1918 leakage, block known-bad ranges) — and do fine-grained policy in SGs, or you will maintain two divergent firewall rulebases forever.</div>

<div class="callout limits">Defaults (soft unless noted): 5 SGs per ENI (max 16), 60 inbound + 60 outbound rules per SG (raisable; total rules per ENI — SGs × rules — capped at 1000 hard), 2500 SGs per VPC, NACLs: 20 rules per direction default (max 40 with performance impact). SG references count as one rule each regardless of member count — a reason they beat CIDR lists at scale.</div>

<p>Design doctrine for the exam and for life: SGs are the primary control, scoped tightly, referencing each other by tier; NACLs stay at defaults unless you need an explicit deny or a subnet-level blast-radius guardrail. Every rule you add to a NACL is a rule someone will forget exists during an outage at 3 a.m.</p>
`
    },
    {
      id: "peering-endpoints",
      title: "VPC Peering and VPC Endpoints: Private Paths Without the Internet",
      html: `
<p>Two distinct problems, often conflated: connecting <em>your VPCs to each other</em> (peering), and connecting <em>your VPCs to AWS services</em> without touching the public internet (endpoints). Both remove IGW/NAT from the path; both have sharp constraints the exam tests relentlessly.</p>

<h3>VPC peering</h3>
<p>A peering connection is a bilateral routing arrangement between exactly two VPCs — same account or cross-account, same region or cross-region. Traffic rides the AWS backbone, is encrypted in transit cross-region, never touches the internet, and has no bandwidth chokepoint (it is fabric, not a tunnel device). Mechanics: one side requests, the other accepts, then <strong>both sides must add routes</strong> to their route tables pointing the peer's CIDR at the pcx target, and SGs/NACLs must allow the traffic. You can optionally enable DNS resolution over the peering so the peer's private hostnames resolve to private IPs.</p>
<p>The two commandments:</p>
<ul>
<li><strong>No overlapping CIDRs.</strong> The peering request outright fails if any CIDR block overlaps. This is why CIDR planning (lesson 1) matters — overlap is unfixable without renumbering.</li>
<li><strong>No transitive routing.</strong> If A peers with B and B peers with C, A cannot reach C through B. Ever. Not with static routes, not with clever NACLs. The VPC dataplane drops traffic whose source is not the directly peered VPC. Similarly, "edge-to-edge" routing is forbidden: a peer cannot use your IGW, NAT gateway, VGW/DX, or gateway endpoints. Peering shares <em>reachability between two CIDRs</em>, nothing else.</li>
</ul>
<p>Consequence: full connectivity among n VPCs requires n(n-1)/2 peerings — a full mesh. At 5 VPCs that is 10 connections and manageable; at 30 it is 435 and you should have deployed a Transit Gateway long ago. The quota agrees: 125 active peerings per VPC (soft ceiling, and a design smell well before that).</p>

<div class="callout exam">Any scenario with three or more VPCs where "VPC A must reach VPC C via VPC B" is testing non-transitivity — the answer is either a direct A-C peering (small scale) or Transit Gateway (many VPCs, or the words "simplify management", "thousands of routes", "shared services"). Any scenario mentioning overlapping CIDRs eliminates peering (and TGW routing without NAT) immediately — the surviving answers are PrivateLink or private NAT gateway.</div>

<h3>Gateway endpoints: free S3/DynamoDB access</h3>
<p>A <strong>gateway endpoint</strong> exists for exactly two services: <strong>S3 and DynamoDB</strong>. It is not an ENI and has no IP. It works by injecting a route: you associate the endpoint with route tables, and AWS installs a route whose destination is a <strong>managed prefix list</strong> (the service's public CIDR set) targeting the endpoint. Traffic to S3 from an associated subnet longest-prefix-matches that route and goes over the endpoint instead of the IGW/NAT. It is <strong>free</strong>, has no throughput cap, and supports endpoint policies to constrain which buckets/actions are reachable.</p>
<p>Its limits define its exam identity: same-region service access only, and only for traffic originating in <em>this VPC's associated route tables</em> — <strong>not reachable from on-premises, over peering, or from another region</strong>. Cross-network private access to S3 requires an interface endpoint.</p>

<h3>Interface endpoints (PrivateLink): an ENI per AZ</h3>
<p>An <strong>interface endpoint</strong> is one or more <strong>ENIs with private IPs</strong> in your subnets (one per AZ you choose), fronting a service over <strong>AWS PrivateLink</strong>. Nearly every AWS API supports it (SSM, KMS, ECR, CloudWatch, STS, and hundreds more), plus third-party SaaS and your own services via NLB (covered at Pro level). Because it is just an ENI in your subnet:</p>
<ul>
<li>Security groups apply to it — you firewall access to the endpoint itself.</li>
<li>It is reachable over Direct Connect, VPN, and VPC peering — this is how on-prem gets private AWS API access.</li>
<li><strong>Private DNS</strong>: enabled, the service's public DNS name (e.g., the regional SSM hostname) resolves inside the VPC to the endpoint's private IPs, so SDKs work unchanged. This requires enableDnsSupport and enableDnsHostnames on the VPC.</li>
<li><strong>Endpoint policies</strong> (IAM-style resource policies on the endpoint) constrain what can be done through it — e.g., only allow s3 GetObject to specific buckets, blocking exfiltration to attacker-owned buckets via your own endpoint.</li>
</ul>
<p>Cost: ~0.01 USD per AZ-hour per endpoint plus ~0.01 USD/GB. Three-AZ endpoints for ten services is real money (~220 USD/month), which is why gateway endpoints remain the right answer for S3/DynamoDB bulk data even though S3 <em>also</em> offers an interface endpoint for the hybrid-access case.</p>

<table>
<thead><tr><th></th><th>Gateway endpoint</th><th>Interface endpoint</th></tr></thead>
<tbody>
<tr><td>Services</td><td>S3, DynamoDB only</td><td>Most AWS APIs, SaaS, your NLB-fronted services</td></tr>
<tr><td>Mechanism</td><td>Route via prefix list</td><td>ENI per AZ (PrivateLink)</td></tr>
<tr><td>Cost</td><td>Free</td><td>Hourly per AZ + per GB</td></tr>
<tr><td>From on-prem/peer</td><td>No</td><td>Yes</td></tr>
<tr><td>Security groups</td><td>No (policy only)</td><td>Yes</td></tr>
</tbody>
</table>

<div class="callout war">Interface endpoints with private DNS override the service hostname VPC-wide. Forget to allow 443 from your subnets in the endpoint's SG and every SDK call in the VPC starts timing out — the failure looks like "AWS is down" but is your own SG on an ENI nobody remembers creating. Also watch endpoint policies: the default is allow-all, and tightening one later is a change-managed event because everything in the VPC shares it.</div>

<div class="callout deep">Endpoints kill the "S3 needs public internet" objection in regulated environments: with a gateway endpoint plus a bucket policy containing a condition on aws:SourceVpce, you get a closed loop — the bucket only accepts requests arriving via your endpoint, and the endpoint policy only permits your buckets. Neither the IGW nor NAT ever sees the data. This pattern (endpoint policy + SourceVpce bucket policy) shows up on both SAA and SAP.</div>
`
    },
    {
      id: "tgw-flowlogs",
      title: "Transit Gateway (Introduction) and VPC Flow Logs",
      html: `
<p>Two topics that pair naturally: TGW is how you scale connectivity beyond peering meshes, and Flow Logs are how you see what any of this is actually doing.</p>

<h3>Transit Gateway: the regional hub router</h3>
<p>A <strong>Transit Gateway</strong> is a managed, regional, horizontally-scaled router you attach things to: VPCs, VPN connections, Direct Connect gateways, other TGWs (inter-region peering). Mental model: a giant route-reflector-plus-forwarding-plane in the region. Where peering is a mesh of point-to-point links, TGW is hub-and-spoke — <strong>transitive routing is the entire point</strong>. Attach 50 VPCs and your on-prem VPN to one TGW and everything can reach everything (subject to TGW route tables, which is where segmentation lives — Pro module territory).</p>
<ul>
<li>A VPC attachment places a TGW ENI in one subnet per AZ you select. Traffic from an AZ can only enter the TGW if the attachment covers that AZ — a classic misconfiguration.</li>
<li>Spoke VPC route tables need routes toward the TGW (e.g., 10.0.0.0/8 or 0.0.0.0/0 to tgw-xxx); the TGW's own route tables decide where it goes next. Two routing layers — VPC and TGW — both must agree.</li>
<li>Non-transitive exceptions still apply at the edges: spokes cannot use another spoke's IGW or gateway endpoints through the TGW. Centralized egress works via NAT in a dedicated VPC (Pro module), not by magic.</li>
<li>Cost: per attachment-hour (~0.05 USD) plus per-GB processed (~0.02 USD). Peering has no hourly cost and (same-AZ) no data charge — for two or three stable VPCs, peering is cheaper and simpler. TGW wins on operational scaling, not price.</li>
<li>Bandwidth: up to 100 Gbps per VPC attachment; VPN attachments remain bound by 1.25 Gbps per tunnel (ECMP across tunnels helps — Pro module).</li>
</ul>

<div class="callout exam">SAA-level TGW questions are decision questions: many VPCs + on-prem + "simplify" or "least operational overhead" → TGW. Two VPCs, cost-sensitive → peering. The trap answer is chaining peering connections to fake transitivity — it does not work, ever.</div>

<h3>VPC Flow Logs: metadata, not packets</h3>
<p>Flow Logs capture <strong>flow-level metadata</strong> — 5-tuple, byte/packet counts, action (ACCEPT/REJECT), timestamps, and optionally richer fields (pkt-src/dst for the true endpoints behind NAT-ish hops, TCP flags, traffic-path, AZ, subnet). They are emphatically <strong>not packet capture</strong> — no payloads, no headers beyond the tuple. For payloads you want Traffic Mirroring (VXLAN-encapsulated copies to an analysis fleet), a different and much more expensive tool.</p>
<ul>
<li>Scope: VPC, subnet, or individual ENI (also TGW attachments). Destination: CloudWatch Logs, S3, or Kinesis Data Firehose.</li>
<li>Aggregation interval: 60 s or 600 s buckets, then delivery latency on top — <strong>Flow Logs are minutes-delayed, not real-time</strong>. They are for forensics, cost analysis, and reachability debugging, not live intrusion response.</li>
<li>The REJECT action tells you a SG or NACL dropped the flow — the single fastest way to answer "is the firewall eating my packets". An ACCEPT inbound with no corresponding ACCEPT outbound on a stateless-NACL path is the NACL-ephemeral-port bug's fingerprint.</li>
</ul>
<p><strong>What Flow Logs do NOT capture</strong> — memorize this list; it is a recurring exam item and a recurring production confusion:</p>
<ul>
<li>Traffic to/from the Amazon DNS resolver (the .2 address) — your DNS queries are invisible (use Route 53 Resolver query logging instead).</li>
<li>Instance metadata service traffic (169.254.169.254) and the time-sync link-local address.</li>
<li>DHCP traffic.</li>
<li>Windows license-activation traffic to Amazon servers.</li>
<li>Traffic to the reserved VPC router address (.1).</li>
<li>Mirrored traffic itself.</li>
</ul>

<div class="callout deep">Why flows and not packets? The capture point is the same dataplane doing SG conntrack — it already maintains per-flow state, so emitting flow records is nearly free, while packet capture would require copying every frame off the fast path. This is also why the excluded traffic list is what it is: link-local and resolver traffic is handled by special paths that bypass normal flow processing.</div>

<div class="callout war">Flow Logs to CloudWatch Logs at VPC scope on a busy VPC can cost more than the NAT gateway you were debugging — CW Logs ingestion is ~0.50 USD/GB. Send high-volume flow logs to S3 (an order of magnitude cheaper) and query with Athena. Also: enabling flow logs is not retroactive; you cannot investigate last night's incident with logs you turn on this morning. Baseline them on before you need them, at least at REJECT-only granularity if volume is a concern (custom format + filter).</div>

<div class="callout limits">Flow log records are best-effort — under extreme load records can be skipped (the log status field says SKIPDATA). Do not build billing or security controls that assume 100% capture. Max aggregation before delivery: about 5-10 minutes worst case to S3. You cannot modify a flow log's config after creation (delete and recreate).</div>
`
    },
    {
      id: "dns-ipv6",
      title: "VPC DNS, Route 53 Resolver, and IPv6 in the VPC",
      html: `
<p>Every VPC ships with a resolver you did not deploy and cannot turn off per-instance: <strong>AmazonProvidedDNS</strong>, reachable at the VPC CIDR base <strong>+2</strong> (10.0.0.0/16 → 10.0.0.2) and at the link-local address 169.254.169.253. DHCP option sets hand this resolver to instances by default. Understanding what it resolves, and under what VPC attributes, unlocks half the "private DNS doesn't work" tickets you will ever see.</p>

<h3>The two attributes that break everything when off</h3>
<ul>
<li><strong>enableDnsSupport</strong> (default true): the +2 resolver responds at all. Off, and instances must use external DNS servers you provide.</li>
<li><strong>enableDnsHostnames</strong> (default true for default VPCs, <strong>false for VPCs you create</strong> via API/CLI): instances with public IPs get public DNS hostnames, and — the part people miss — <strong>both attributes must be true</strong> for private hosted zones and interface-endpoint private DNS to function in the VPC.</li>
</ul>
<p>The +2 resolver is formally the inbound face of <strong>Route 53 Resolver</strong>. It resolves, in priority order: names in private hosted zones associated with the VPC, VPC-internal names (instance private DNS), any Resolver forwarding rules that match (hybrid DNS, covered in the Route 53 module), then public DNS recursively. One resolver, split-horizon by construction: a private hosted zone for example.com shadows the public example.com for this VPC.</p>

<div class="callout limits">Route 53 Resolver enforces a hard limit of <strong>1024 packets per second per ENI</strong> to the +2 resolver. A chatty service doing an uncached DNS lookup per request (hello, default JVM DNS TTL configs and short-lived connections to load balancers) will hit it, and the symptom is intermittent SERVFAIL/timeout that looks exactly like network flakiness. Fixes: cache locally (nscd/systemd-resolved/dnsmasq per node, or NodeLocal DNSCache on EKS), or spread across ENIs. This limit is per-ENI and not raisable.</div>

<div class="callout war">The single most common "our private zone doesn't resolve" root cause: the VPC was created by Terraform with enableDnsHostnames left false (the API default), and months later someone adds an interface endpoint with private DNS or associates a private hosted zone — and nothing resolves. Check both attributes first, always.</div>

<h3>DHCP option sets</h3>
<p>The DHCP option set attached to the VPC controls what resolver and search domain instances receive. You can point instances at your own DNS (e.g., on-prem AD DCs) by replacing the option set — but the modern pattern is to keep AmazonProvidedDNS and use <strong>Resolver forwarding rules</strong> for the domains that must go elsewhere, because swapping the resolver wholesale forfeits private zones, endpoint private DNS, and the VPC's internal names. Option sets are immutable: create a new one and swap the association; instances pick it up on lease renewal.</p>

<h3>IPv6 in the VPC</h3>
<p>IPv6 support is dual-stack (or, newer, IPv6-only subnets for some workloads). The design is deliberately un-IPv4-like:</p>
<ul>
<li>You associate an IPv6 CIDR with the VPC — a <strong>/56 from Amazon's GUA pool</strong> (or BYOIPv6). Subnets each get a <strong>/64</strong>, fixed size, no choices. A /56 gives you 256 subnets' worth.</li>
<li><strong>All VPC IPv6 addresses are globally unique and publicly routable.</strong> Privacy is routing policy, not addressing: public IPv6 subnets route ::/0 to the IGW; private ones route ::/0 to an <strong>egress-only IGW</strong> (stateful outbound-only, per the routing lesson).</li>
<li><strong>There is no NAT for outbound IPv6</strong> and none needed. The related-but-different features: NAT64 + DNS64 exist so IPv6-only subnets can reach IPv4-only destinations (the resolver synthesizes 64:ff9b::/96 addresses and the NAT gateway translates). That is v6-to-v4 translation, not v6 masquerading.</li>
<li>IPv6 is free of the public-IPv4 hourly charge — one of AWS's explicit nudges toward v6 adoption, alongside IPv4 exhaustion in large EKS estates.</li>
<li>SGs and NACLs need explicit IPv6 rules (::/0 is not implied by 0.0.0.0/0). Forgetting the v6 rules after enabling dual-stack is the canonical rollout bug.</li>
</ul>

<div class="callout exam">Keyword mappings: "instances must initiate IPv6 connections outbound but must not be reachable from the internet" → egress-only internet gateway (NAT gateway is the IPv4 answer and a trap here). "Private hosted zone not resolving" → enableDnsSupport + enableDnsHostnames. "Custom DNS for a specific internal domain while keeping AWS DNS" → Resolver rules / DHCP options depending on framing. "Intermittent DNS failures under high query load" → the 1024 pps per-ENI resolver limit, fix with caching.</div>

<div class="callout deep">Why is the resolver at +2 and also at a link-local address? The link-local 169.254.169.253 works in every VPC regardless of CIDR — useful for images baked to run anywhere. The +2 address is per-VPC and is what DHCP hands out. Both terminate on the same Resolver infrastructure that also hosts your inbound/outbound Resolver endpoints — it is one system, which is why forwarding rules, private zones, and endpoint private DNS compose cleanly instead of fighting.</div>

<p>Operationally: leave both DNS attributes on, keep AmazonProvidedDNS, cache DNS on busy nodes, add explicit v6 firewall rules the day you go dual-stack, and treat DHCP option set swaps as a maintenance event (lease renewal timing means slow, staggered rollout — usually a feature, occasionally a very confusing one).</p>
`
    },
    {
      id: "eni-eip-ssm",
      title: "ENIs, EIPs, and Killing the Bastion with SSM Session Manager",
      html: `
<p>Everything in a VPC that talks IP does so through an <strong>elastic network interface</strong>. EC2 instances, RDS, Lambda-in-VPC, NAT gateways, interface endpoints, TGW attachments, EFS mount targets — all ENIs. Once you see the ENI as the universal attachment point, half of VPC behavior (SGs bind to ENIs, flow logs can scope to ENIs, IPs live on ENIs) stops being a pile of special cases.</p>

<h3>ENI mechanics worth knowing</h3>
<ul>
<li>An ENI carries: one primary private IPv4 (immutable for its life), optional secondary private IPs, optional IPv6 addresses, one public IPv4 mapping (auto-assign or EIP), a MAC address, and one or more SGs. It lives in exactly one subnet, hence one AZ.</li>
<li>Instances support multiple ENIs (count scales with instance size — a t3.micro gets 2, big instances 15). Secondary ENIs can be detached and re-attached to another instance <strong>in the same AZ</strong>, taking their private IP, MAC, and SGs with them. This is the classic building block for licensed-by-MAC software and DIY failover (float an ENI between active/standby boxes).</li>
<li>The auto-assigned public IPv4 on a default ENI is ephemeral: <strong>stop/start the instance and it changes</strong> (reboot does not). Anything that must keep its public address needs an EIP.</li>
<li>ENI-per-pod / ENI-per-function density is why your subnets exhaust (see lesson 1). Lambda now uses shared Hyperplane ENIs per subnet+SG combo rather than one per concurrent execution, which fixed the historical ENI-exhaustion pain — but EKS without prefix delegation still consumes IPs aggressively.</li>
</ul>

<h3>Elastic IPs</h3>
<ul>
<li>An EIP is a static public IPv4 from Amazon's pool (or your BYOIP range), associated with an ENI. Remapping to another ENI is an API call — sub-minute failover for the poor-man's HA pattern.</li>
<li>Quota: 5 per region by default (soft). Since February 2024 <strong>all public IPv4 addresses bill ~0.005 USD/hour</strong> whether attached or idle — the old "only idle EIPs cost money" fact is obsolete and the exam has caught up. ~3.60 USD/month per address adds up across an estate; it is a deliberate scarcity price.</li>
<li>When NOT to use one: behind any managed LB or with any DNS-based design. EIP-on-instance couples availability to a single AZ and a single box. The exam's "static IP" answers rank: NLB with EIPs per AZ, then Global Accelerator (2 anycast IPs, multi-region), then a lone EIP only for genuinely single-instance needs.</li>
</ul>

<h3>SSM Session Manager: the bastion is legacy</h3>
<p>The traditional pattern — bastion host in a public subnet, SSH keys, port 22 exposed, jump-host sprawl — exists because instances in private subnets have no inbound path. <strong>Session Manager inverts the connection direction.</strong> The SSM Agent on the instance opens an <em>outbound</em> HTTPS connection to the Systems Manager service and holds it; when you start a session, your terminal traffic is relayed over that existing outbound channel (WebSocket over 443). Consequences:</p>
<ul>
<li><strong>Zero inbound ports.</strong> SG inbound can be empty. No 22, no bastion, no public IP, nothing to scan.</li>
<li><strong>IAM is the control plane.</strong> Who can start sessions to which instances (by tag, by resource) is IAM policy, with MFA/identity-center integration — versus SSH keys, which are unauditable bearer credentials with no expiry.</li>
<li><strong>Auditability:</strong> session start/stop in CloudTrail, full keystroke/output logging to S3 or CloudWatch Logs (with KMS). Try that with SSH.</li>
<li>Port forwarding sessions tunnel arbitrary TCP (RDP, database ports) through the same channel — replacing SSH -L through bastions.</li>
</ul>
<p>Requirements — and the exam tests these as troubleshooting: the SSM Agent running (preinstalled on Amazon Linux/Ubuntu AMIs), an <strong>instance profile</strong> with the AmazonSSMManagedInstanceCore policy, and a network path to the SSM endpoints. For truly private subnets with no NAT, that path is three interface endpoints: <strong>ssm, ssmmessages, ec2messages</strong> (ssmmessages carries the actual session WebSocket). Missing ssmmessages is the classic "instance shows managed but sessions hang" bug.</p>

<div class="callout exam">"Administrative access to private instances with no open inbound ports / no bastion / full auditing" → Session Manager, every time. The distractors are bastion-with-hardened-SG (violates "no open ports"), EC2 Instance Connect (still SSH, still port 22, public subnets), and VPN (heavier, doesn't give session logging). If the subnet has no internet access, the completing detail is the three interface endpoints.</div>

<div class="callout war">Two operational notes. First: instance profiles are evaluated at agent start — attach the role to a running instance and the agent may need a restart before registration. Second: session logging to S3/CW is configured in Session Manager preferences per account/region and silently off by default; auditors care, so turn it on before they ask, and pair with an SCP or IAM condition denying ssm:StartSession without logging-capable document settings if compliance is strict.</div>

<div class="callout limits">EIPs: 5 per region default. ENIs per instance: 2-15 by instance size; secondary private IPs similarly size-dependent. ENI attach is same-AZ only. All public IPv4: ~0.005 USD/hr each. Session Manager sessions have a configurable idle timeout (default 20 min) and require agent version floors for newer features — not numbers to memorize, but know they exist.</div>

<p>Putting the module together: the modern minimal-attack-surface VPC has private-only workloads, no bastion (SSM), no NAT where endpoints suffice, gateway endpoints for S3/DynamoDB, interface endpoints for the control-plane trio plus whatever the app needs, SGs referencing SGs, NACLs at defaults, flow logs to S3, and one NAT gateway per AZ only if genuine internet egress is required. That architecture is also, not coincidentally, the cheapest one that passes a security review.</p>
`
    }
  ],
  quiz: [
    {
      q: "A company created a VPC with CIDR 10.50.0.0/16 and a subnet 10.50.8.0/24. An engineer reports that only 251 addresses are assignable in the subnet. Which addresses are unavailable, and why?",
      options: [
        "10.50.8.0, 10.50.8.1, 10.50.8.2, 10.50.8.3, and 10.50.8.255, reserved by AWS for network address, VPC router, DNS, future use, and broadcast",
        "The first ten addresses, reserved for AWS service endpoints in every subnet",
        "10.50.8.1 and 10.50.8.255 only, matching standard gateway and broadcast conventions",
        "10.50.8.0 through 10.50.8.4, reserved for the implicit router's ECMP interfaces"
      ],
      answer: [0],
      multi: false,
      explanation: "AWS reserves exactly five addresses per subnet: .0 (network), .1 (implicit router), .2 (DNS resolver mirror), .3 (future use), and the last address (broadcast, reserved despite broadcast being unsupported) — 256 minus 5 equals 251. <strong>B</strong> invents a ten-address reservation that does not exist. <strong>C</strong> describes conventional networking, but AWS reserves five, not two — this is precisely the trap the question targets. <strong>D</strong> is fiction; the implicit router is a distributed function, not a device with ECMP member interfaces consuming addresses."
    },
    {
      q: "An EKS cluster in private /24 subnets fails to scale out; nodes report ENI/IP allocation errors although the VPC's 10.0.0.0/16 is mostly unused. Which TWO actions solve the exhaustion without rebuilding the VPC? (Select TWO.)",
      options: [
        "Resize the existing subnets in place to /20",
        "Associate a secondary CIDR such as 100.64.0.0/16 with the VPC and create new larger subnets for pod networking",
        "Enable NAT gateway port remapping to reclaim addresses",
        "Create new, larger subnets from unused space in the existing 10.0.0.0/16 and migrate node groups to them",
        "Attach a second IGW to expand the address pool"
      ],
      answer: [1, 3],
      multi: true,
      explanation: "Subnets can never be resized (<strong>A</strong> is impossible — CIDR is immutable after creation), so the only paths are new subnets: either from unused primary-CIDR space (<strong>D</strong>) or from a secondary CIDR (<strong>B</strong>) — and 100.64.0.0/10 CGNAT space is the canonical choice for address-hungry, non-routable pod networks. <strong>C</strong> conflates NAT port multiplexing with IP address allocation; NAT has nothing to do with ENI IP assignment. <strong>E</strong> is doubly wrong: a VPC supports exactly one IGW, and IGWs do not provide addresses."
    },
    {
      q: "An instance in a subnet whose route table sends 0.0.0.0/0 to an internet gateway cannot be reached over the internet. Its security group allows inbound 443 from anywhere and the NACL is the default. What is the most likely cause?",
      options: [
        "The internet gateway has reached its bandwidth limit",
        "The instance has no public IPv4 address or Elastic IP associated",
        "The default NACL blocks inbound traffic until rules are added",
        "The subnet is not marked as public in its subnet settings"
      ],
      answer: [1],
      multi: false,
      explanation: "The four requirements for inbound reachability are attached IGW, route to it, a public IP mapping, and permissive SG/NACL. The question stipulates the route and firewall layers are fine, leaving the public IP — the IGW performs 1:1 NAT between a public and private address, and without an associated public IPv4 there is no inbound mapping. <strong>A</strong> is impossible; the IGW is horizontally scaled with no capacity you can exhaust. <strong>C</strong> is backwards — the default NACL allows all traffic (custom NACLs deny by default). <strong>D</strong> tests whether you know 'public subnet' is purely a routing description; no such flag exists."
    },
    {
      q: "A fleet of instances in dual-stack private subnets must initiate outbound IPv6 connections to the internet but must never accept inbound IPv6 connections. What should the architect configure?",
      options: [
        "A NAT gateway in a public subnet, with ::/0 routed to it from the private subnets",
        "An egress-only internet gateway, with ::/0 routed to it from the private subnets",
        "An internet gateway with a NACL denying inbound IPv6",
        "Private NAT gateway with IPv6 translation enabled"
      ],
      answer: [1],
      multi: false,
      explanation: "The egress-only IGW is exactly this: a stateful, outbound-only gateway for IPv6, needed because all VPC IPv6 addresses are globally routable and there is no IPv6 masquerading. <strong>A</strong> is the IPv4 answer and the intended trap — NAT gateways do not perform outbound IPv6 NAT (their only IPv6 role is NAT64 for v6-to-v4 translation). <strong>C</strong> technically restricts traffic but stateless NACL rules for ephemeral ports are error-prone and the instances would still be addressable; it is not the designed mechanism. <strong>D</strong> misdescribes private NAT gateways, which exist for overlapping IPv4 ranges, not IPv6 egress."
    },
    {
      q: "During a traffic spike, applications in private subnets report connection timeouts to a single third-party API endpoint. CloudWatch shows the NAT gateway's ErrorPortAllocation metric climbing. Which TWO remediations address the root cause? (Select TWO.)",
      options: [
        "Associate additional Elastic IPs with the NAT gateway",
        "Increase the NAT gateway's instance size",
        "Distribute the traffic across additional NAT gateways in other subnets",
        "Raise the ephemeral port range on the client instances",
        "Enable NAT gateway cross-zone load balancing"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "ErrorPortAllocation means the ~55,000 concurrent-connections-per-unique-destination limit is exhausted — the gateway has run out of source ports for that destination tuple. More source IPs (<strong>A</strong>, up to 8 EIPs multiplies the tuple space) or more NAT gateways sharing the load (<strong>C</strong>) both expand capacity. <strong>B</strong> is impossible — NAT gateways are managed and have no instance size. <strong>D</strong> changes client-side ports, which is irrelevant: the exhaustion is of the gateway's translated source ports, not the clients'. <strong>E</strong> does not exist for NAT gateways."
    },
    {
      q: "A finance workload in private subnets across three AZs uses a single NAT gateway in AZ-a. Which TWO problems does this design cause? (Select TWO.)",
      options: [
        "Loss of outbound internet access in all three AZs if AZ-a fails",
        "Inter-AZ data processing charges for egress traffic from AZ-b and AZ-c",
        "The NAT gateway cannot serve traffic originating in other AZs",
        "Security groups cannot be applied consistently across AZs",
        "Route tables cannot reference a NAT gateway in a different AZ"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "A NAT gateway is a zonal resource: if AZ-a fails, every private subnet routing through it loses egress (<strong>A</strong>), and traffic from AZ-b/AZ-c crosses AZ boundaries to reach it, incurring inter-AZ transfer charges on top of NAT processing (<strong>B</strong>). The fix is one NAT gateway per AZ with per-AZ route tables. <strong>C</strong> and <strong>E</strong> are false — cross-AZ use is fully supported (that is exactly what makes this misdesign possible rather than impossible). <strong>D</strong> is unrelated; SGs are VPC-scoped and AZ-agnostic."
    },
    {
      q: "After a NACL is added to a subnet allowing inbound TCP 443 from 0.0.0.0/0, clients can no longer complete HTTPS connections to instances in that subnet, though connections worked before. What is wrong?",
      options: [
        "The NACL lacks an outbound rule allowing ephemeral ports 1024-65535, and NACLs are stateless",
        "The security group must be updated to allow the NACL's traffic",
        "NACL rules require a lower rule number than the default deny, which sits at rule 1",
        "Inbound 443 must also be allowed on the security group's outbound side"
      ],
      answer: [0],
      multi: false,
      explanation: "A custom NACL denies everything not explicitly allowed, in each direction independently — statelessness means the SYN arrives on 443 but the SYN-ACK leaves on the client's ephemeral port and is dropped without an outbound ephemeral-range allow. This is the single most-tested NACL fact. <strong>B</strong> misstates the model — SGs and NACLs are independent layers, and the SG was already working. <strong>C</strong> is backwards: the implicit deny is the final asterisk rule, not rule 1. <strong>D</strong> confuses the layers — SGs are stateful, so return traffic never needs an SG rule."
    },
    {
      q: "A three-tier application autoscales its web tier. The database tier must accept PostgreSQL connections only from current web-tier instances, whose IPs change constantly. What is the recommended security group design?",
      options: [
        "Allow 5432 from the VPC CIDR on the database security group",
        "Allow 5432 on the database security group with the web tier's security group ID as the source",
        "Use a Lambda function to update database security group CIDR rules when the ASG scales",
        "Place both tiers in the same subnet so the NACL is bypassed"
      ],
      answer: [1],
      multi: false,
      explanation: "Security group references are the idiomatic answer: the rule's source is the web tier's SG ID, so membership tracks scaling automatically, with no IP management and least-privilege scope. <strong>A</strong> works but over-grants — every resource in the VPC could reach the database, violating least privilege. <strong>C</strong> reinvents SG references with custom automation and race conditions; a classic 'technically possible, operationally wrong' distractor. <strong>D</strong> is true about NACLs (intra-subnet traffic bypasses them) but irrelevant to SG scoping and architecturally poor — tiers share a blast radius for no benefit."
    },
    {
      q: "A security team must immediately block all traffic from a specific malicious IP range to every instance in a subnet, while continuing to allow all other existing traffic. Which mechanism accomplishes this?",
      options: [
        "Add a deny rule to the instances' security groups for the malicious range",
        "Add a numbered deny rule to the subnet's NACL, ordered before the allow rules",
        "Remove the allow rules for the range from the security groups",
        "Add a blackhole route for the range in the subnet route table"
      ],
      answer: [1],
      multi: false,
      explanation: "Only NACLs support deny rules; a deny entry with a lower rule number than the broad allows drops the range at the subnet edge, first-match evaluation guaranteeing precedence. <strong>A</strong> is impossible — security groups are allow-only, the most classic SG/NACL discriminator on the exam. <strong>C</strong> does not work because SGs almost certainly allow the traffic via broad rules (0.0.0.0/0 on a public service); there is no per-range rule to remove, and SGs cannot express 'everyone except X'. <strong>D</strong> affects outbound routing from the subnet, not inbound traffic arriving via the IGW, and blackhole routes are a TGW construct, not a subnet route table feature."
    },
    {
      q: "VPC A is peered with VPC B, and VPC B is peered with VPC C. Instances in A must reach a service in C. Routes for all CIDRs exist in every route table, pointing at the respective peering connections. Why does traffic from A to C fail, and what fixes it at this small scale?",
      options: [
        "Peering is non-transitive and the VPC dataplane drops A's traffic arriving via B; create a direct A-to-C peering connection",
        "The NACLs in VPC B block forwarded traffic; allow the CIDRs of A and C in B's NACLs",
        "B needs an EC2 router instance with source/dest check disabled; peering supports transit only through an instance",
        "The peering connections must be re-created in the same AWS account to enable transit"
      ],
      answer: [0],
      multi: false,
      explanation: "Non-transitivity is enforced in the dataplane, not merely by missing routes — even with routes configured, traffic from a non-directly-peered VPC is dropped. At two or three VPCs the fix is a direct peering; at scale it is Transit Gateway. <strong>B</strong> is a red herring: no NACL change enables forbidden transit. <strong>C</strong> describes a real (ugly) workaround pattern — proxying through an instance in B — but the claim that peering 'supports transit through an instance' misframes it; the exam answer for enabling routed transit is never a DIY router. <strong>D</strong> is false; account topology has no bearing on transitivity."
    },
    {
      q: "A company must give 40 VPCs across multiple accounts and an on-premises data center full mutual connectivity with minimal operational overhead. What should the architect propose?",
      options: [
        "A full mesh of VPC peering connections plus a VPN to one hub VPC",
        "A Transit Gateway with VPC attachments shared across accounts and a VPN attachment to on-premises",
        "Chained peering connections through a central shared-services VPC",
        "PrivateLink endpoints in every VPC pointing at every other VPC"
      ],
      answer: [1],
      multi: false,
      explanation: "Forty VPCs would need 780 peering connections for a full mesh, and peering's non-transitivity means the on-prem VPN in a hub VPC could never reach the spokes — <strong>A</strong> fails on both operations and edge-to-edge restrictions. TGW (<strong>B</strong>) is purpose-built: transitive hub-and-spoke, cross-account attachment sharing via RAM, native VPN attachment. <strong>C</strong> is architecturally impossible (non-transitive). <strong>D</strong> misuses PrivateLink, which exposes individual services unidirectionally, not full network reachability — a valid pattern for service access, wrong for 'full mutual connectivity'."
    },
    {
      q: "Private-subnet EC2 instances transfer 50 TB per month to S3 in the same region through a NAT gateway. The company wants to eliminate the associated data processing charges without exposing traffic to the internet. What should they do?",
      options: [
        "Create an S3 interface endpoint and update the application's S3 hostname",
        "Create an S3 gateway endpoint and associate it with the private subnets' route tables",
        "Move the instances to public subnets so traffic uses the IGW directly",
        "Enable S3 Transfer Acceleration to bypass the NAT gateway"
      ],
      answer: [1],
      multi: false,
      explanation: "The gateway endpoint installs a prefix-list route so same-region S3 traffic bypasses NAT entirely, is free of hourly and per-GB endpoint charges, and keeps traffic on private AWS paths — the canonical answer for this canonical question. <strong>A</strong> works but costs ~0.01 USD/GB in PrivateLink data charges (500 USD/month here) — interface endpoints for S3 exist for on-prem/cross-VPC access, not bulk same-VPC traffic. <strong>C</strong> eliminates NAT charges but sacrifices the private posture and adds public-IPv4 costs; the question says no internet exposure. <strong>D</strong> is for long-haul client uploads over the public internet — the opposite direction of relevance, and it does not bypass NAT from a private subnet."
    },
    {
      q: "A security investigation needs to determine whether a specific instance received connections from a suspicious IP last week, and whether those connections were rejected by security controls. VPC Flow Logs were enabled to S3 a month ago. Which statement is accurate?",
      options: [
        "Flow logs will show the flows with ACCEPT or REJECT actions, but will not contain packet payloads to inspect what was transmitted",
        "Flow logs will contain the full packet captures needed to reconstruct the sessions",
        "Flow logs cannot help, because they only capture traffic that security groups allow",
        "Flow logs must be replayed through Traffic Mirroring to extract the flow records"
      ],
      answer: [0],
      multi: false,
      explanation: "Flow logs record 5-tuple metadata, byte/packet counts, and the ACCEPT/REJECT action — ideal for exactly this question of who connected and whether the firewall dropped it — but never payloads. <strong>B</strong> confuses flow logs with packet capture; payload reconstruction needs Traffic Mirroring configured before the fact. <strong>C</strong> is backwards — REJECT records are captured and are the primary forensic value here. <strong>D</strong> nonsensically inverts the two features; Traffic Mirroring copies live packets and cannot be applied retroactively to logs."
    },
    {
      q: "Operations must access EC2 instances in private subnets that have no internet connectivity at all. Requirements: no inbound ports open, no bastion hosts, and full session audit logs. Which combination meets the requirements?",
      options: [
        "SSM Session Manager, with interface VPC endpoints for ssm, ssmmessages, and ec2messages, an instance profile with the SSM managed policy, and session logging to S3",
        "A hardened bastion host in a public subnet with SSH access restricted to the corporate CIDR and CloudTrail enabled",
        "EC2 Instance Connect with security groups allowing port 22 only from the EC2 Instance Connect service CIDR",
        "SSM Session Manager with a NAT gateway added so the agent can reach the service"
      ],
      answer: [0],
      multi: false,
      explanation: "Session Manager relays sessions over the agent's outbound HTTPS connection — no inbound ports, no bastion — and with no internet path the agent needs the three interface endpoints (ssm, ssmmessages for the session channel, ec2messages), plus the instance role and logging preferences for auditability. <strong>B</strong> violates 'no bastion' and 'no inbound ports', and CloudTrail logs API calls, not shell sessions. <strong>C</strong> is still SSH on port 22 with an inbound rule, and doesn't work without a path to the instance from the service. <strong>D</strong> functions but contradicts the stated constraint that the subnets have no internet connectivity and adds an unnecessary paid egress path where endpoints are the precise fit."
    },
    {
      q: "After enabling private DNS on a new interface endpoint for Systems Manager in a VPC created via infrastructure-as-code, API calls to the SSM regional hostname still resolve to public IPs from inside the VPC. What is the most likely cause?",
      options: [
        "The VPC attribute enableDnsHostnames is false, which is the default for VPCs created via the API",
        "The endpoint's security group is blocking DNS traffic on port 53",
        "Private DNS requires a Route 53 public hosted zone for the service domain",
        "The instances are using the 169.254.169.253 resolver, which bypasses private DNS"
      ],
      answer: [0],
      multi: false,
      explanation: "Interface-endpoint private DNS (and private hosted zones generally) requires both enableDnsSupport and enableDnsHostnames to be true — and enableDnsHostnames defaults to false for non-default VPCs created programmatically, making this the classic IaC-created-VPC bug. <strong>B</strong> confuses the resolution path with the data path: DNS queries go to the VPC resolver at +2, not through the endpoint's SG (an SG problem would break the HTTPS calls after correct resolution, not the resolution). <strong>C</strong> inverts reality — private DNS uses an AWS-managed private hosted zone, no public zone involvement. <strong>D</strong> is false: the link-local resolver address is the same Route 53 Resolver and honors private DNS identically."
    }
  ],
  flashcards: [
    { front: "What are the 5 reserved IPs in every VPC subnet?", back: "For 10.0.0.0/24: <strong>.0</strong> network, <strong>.1</strong> implicit router, <strong>.2</strong> Amazon DNS, <strong>.3</strong> future use, <strong>.255</strong> broadcast (last address). Usable = total minus 5." },
    { front: "Allowed VPC IPv4 CIDR size range?", back: "<strong>/16 to /28.</strong> Up to 5 CIDR blocks per VPC by default (secondary CIDRs, soft quota). Subnets are immutable once created — you can only add space, never resize." },
    { front: "Can a subnet span multiple AZs?", back: "No. A subnet lives in exactly one AZ. Multi-AZ designs need one subnet per AZ per tier." },
    { front: "What does an Internet Gateway actually do to packets?", back: "Stateless <strong>1:1 NAT</strong> between the instance's private IP and its mapped public IPv4/EIP. The OS never sees the public IP. One IGW per VPC; horizontally scaled, no bandwidth or availability risk." },
    { front: "Four requirements for an instance to be internet-reachable?", back: "1) IGW attached to VPC, 2) route to IGW in the subnet route table, 3) public IP or EIP on the instance, 4) SG and NACL allow the traffic." },
    { front: "Egress-only Internet Gateway — what and why?", back: "Stateful, outbound-only gateway for <strong>IPv6</strong>. Needed because VPC IPv6 addresses are globally routable and there is no IPv6 NAT. Route ::/0 to it from private dual-stack subnets. Free." },
    { front: "NAT Gateway concurrent connection limit per destination?", back: "~<strong>55,000 simultaneous connections per unique destination</strong> (IP+port+protocol). Exhaustion shows as ErrorPortAllocation. Fix: up to 8 EIPs on the gateway, more NAT gateways, or bypass NAT with VPC endpoints." },
    { front: "Is a NAT Gateway highly available?", back: "Only <strong>within its AZ</strong>. It is zonal. HA design = one NAT gateway per AZ with per-AZ route tables — also avoids inter-AZ data charges." },
    { front: "NAT Gateway vs NAT instance: three discriminators", back: "Gateway: managed, to 100 Gbps, <strong>no security groups</strong>, no port forwarding. Instance: SGs apply, customizable (iptables), usable as bastion, needs <strong>source/dest check disabled</strong>, HA is your problem, cheaper at tiny scale." },
    { front: "Security group vs NACL: state model", back: "SG: <strong>stateful</strong> (conntrack — return traffic automatic), allow-only, all rules evaluated, attaches to ENI. NACL: <strong>stateless</strong> (must allow ephemeral ports for returns), allow+deny, numbered first-match, attaches to subnet." },
    { front: "How do you block a specific malicious IP range at network level?", back: "<strong>NACL deny rule</strong> with a low rule number. Security groups cannot deny — allow rules only." },
    { front: "What is a security group reference?", back: "An SG rule whose source/destination is another <strong>SG ID</strong> — matches all ENIs carrying that SG, tracked dynamically. The idiomatic pattern for autoscaling tiers. Works across same-region VPC peering." },
    { front: "Evaluation order of SG and NACL for inbound traffic?", back: "Inbound: <strong>NACL first</strong> (subnet edge), then SG (ENI). Outbound: SG first, then NACL. Both must allow. Intra-subnet traffic never touches the NACL." },
    { front: "Two hard rules of VPC peering", back: "1) <strong>No overlapping CIDRs</strong> (request fails). 2) <strong>No transitive routing</strong> — enforced in the dataplane; also no edge-to-edge (peer cannot use your IGW, NAT, endpoints, VGW)." },
    { front: "Gateway endpoint: services, cost, mechanism, reachability", back: "<strong>S3 and DynamoDB only. Free.</strong> Works by prefix-list route injection into associated route tables. Same-region, same-VPC origins only — NOT reachable from on-prem, peering, or other regions." },
    { front: "Interface endpoint: mechanism and cost", back: "<strong>ENI per AZ</strong> with private IP, powered by PrivateLink. SGs apply; reachable over DX/VPN/peering; private DNS overrides the service hostname. ~0.01 USD/AZ-hour + ~0.01 USD/GB. Supports endpoint policies." },
    { front: "What traffic do VPC Flow Logs NOT capture?", back: "Amazon DNS resolver (.2) queries, instance metadata (169.254.169.254), DHCP, Windows activation, traffic to the VPC router (.1), mirrored traffic. Also: metadata only — never payloads; minutes-delayed, not real-time." },
    { front: "Where is the Amazon-provided DNS resolver?", back: "VPC CIDR base <strong>+2</strong> (e.g., 10.0.0.2) and link-local <strong>169.254.169.253</strong>. Hard limit: <strong>1024 packets/sec per ENI</strong> — cache DNS locally on chatty nodes." },
    { front: "Which two VPC attributes must be true for private hosted zones and endpoint private DNS?", back: "<strong>enableDnsSupport</strong> and <strong>enableDnsHostnames</strong>. Trap: enableDnsHostnames defaults to FALSE for VPCs created via API/CLI/IaC." },
    { front: "IPv6 VPC allocation sizes", back: "VPC gets a <strong>/56</strong> (Amazon GUA pool or BYOIPv6); each subnet gets a fixed <strong>/64</strong>. All addresses globally routable — privacy is routing (EIGW), not NAT. SG/NACL need explicit ::/0 rules." },
    { front: "What changes an instance's auto-assigned public IP?", back: "<strong>Stop/start changes it; reboot does not.</strong> Need stability? Use an EIP — but note all public IPv4 now bills ~0.005 USD/hr, attached or not. Default EIP quota: 5 per region." },
    { front: "Can you detach an ENI and move it to another instance?", back: "Secondary ENIs: yes, <strong>within the same AZ</strong>, keeping private IP, MAC, and SGs — the classic DIY-failover / licensed-MAC pattern. Primary ENI: never detachable." },
    { front: "Three interface endpoints required for SSM Session Manager without internet?", back: "<strong>ssm, ssmmessages, ec2messages.</strong> ssmmessages carries the session WebSocket — missing it = instance shows managed but sessions hang. Also needed: instance profile with AmazonSSMManagedInstanceCore." },
    { front: "Why does Session Manager need no inbound ports?", back: "The agent holds an <strong>outbound HTTPS/WebSocket connection</strong> to the SSM service; sessions are relayed over it. IAM controls access; sessions log to S3/CloudWatch — replaces bastions and SSH keys." },
    { front: "When is a NAT instance still the right answer?", back: "Cost-sensitive dev environments (NAT GW floor ~33 USD/mo each), or when you need SG filtering on the NAT layer, port forwarding, or a combined bastion — capabilities NAT Gateway lacks." }
  ],
  lab: {
    title: "Lab: Minimal-egress VPC — private instance, endpoints instead of NAT, SSM instead of a bastion",
    html: `
<h3>Goal</h3>
<p>Build a two-subnet VPC and prove three module claims by direct observation: (1) an instance with no public IP, no NAT, and no bastion is fully manageable via SSM interface endpoints; (2) an S3 gateway endpoint provides S3 access from an isolated subnet at zero cost; (3) removing the endpoint route breaks S3 while SSM keeps working. Cost: three interface endpoints (~0.03 USD/hour total) plus a t3.micro (free tier eligible). Total for a one-hour lab: pennies. Nothing here bills after teardown.</p>

<h3>Architecture</h3>
<p>One VPC (10.99.0.0/16), a public subnet you will not actually use for compute (created to show the contrast), and a private subnet with no route to any IGW or NAT. Into the private subnet: one instance with an SSM instance profile, three interface endpoints (ssm, ssmmessages, ec2messages) sharing a security group, and an S3 gateway endpoint on the private route table.</p>

<h3>Steps</h3>
<ol>
<li><p>Set variables and create the VPC with DNS attributes on (remember: enableDnsHostnames is false by default for CLI-created VPCs — this line is the lesson):</p>
<pre><code>export AWS_REGION=us-east-1
VPC_ID=$(aws ec2 create-vpc --cidr-block 10.99.0.0/16 \
  --query Vpc.VpcId --output text)
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-support
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames</code></pre></li>

<li><p>Create the private subnet and its route table (no IGW, no NAT — the route table will hold only the local route plus, later, the S3 prefix list):</p>
<pre><code>SUBNET_ID=$(aws ec2 create-subnet --vpc-id $VPC_ID \
  --cidr-block 10.99.1.0/24 --availability-zone "$AWS_REGION"a \
  --query Subnet.SubnetId --output text)
RTB_ID=$(aws ec2 create-route-table --vpc-id $VPC_ID \
  --query RouteTable.RouteTableId --output text)
aws ec2 associate-route-table --route-table-id $RTB_ID --subnet-id $SUBNET_ID</code></pre></li>

<li><p>Create the endpoint security group. The interface endpoints must accept 443 from the VPC:</p>
<pre><code>SG_ID=$(aws ec2 create-security-group --group-name vpce-lab \
  --description "endpoint access" --vpc-id $VPC_ID \
  --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $SG_ID \
  --protocol tcp --port 443 --cidr 10.99.0.0/16</code></pre></li>

<li><p>Create the three SSM interface endpoints (private DNS on — the default) and the free S3 gateway endpoint:</p>
<pre><code>for svc in ssm ssmmessages ec2messages; do
  aws ec2 create-vpc-endpoint --vpc-id $VPC_ID \
    --vpc-endpoint-type Interface \
    --service-name com.amazonaws.$AWS_REGION.$svc \
    --subnet-ids $SUBNET_ID --security-group-ids $SG_ID
done
S3EP_ID=$(aws ec2 create-vpc-endpoint --vpc-id $VPC_ID \
  --vpc-endpoint-type Gateway \
  --service-name com.amazonaws.$AWS_REGION.s3 \
  --route-table-ids $RTB_ID \
  --query VpcEndpoint.VpcEndpointId --output text)</code></pre>
<p>Inspect the route table now: <code>aws ec2 describe-route-tables --route-table-ids $RTB_ID</code> — note the new route whose destination is a prefix list (pl-...), the gateway endpoint's mechanism from the lesson.</p></li>

<li><p>Create the instance role and profile:</p>
<pre><code>aws iam create-role --role-name ssm-lab-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name ssm-lab-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam create-instance-profile --instance-profile-name ssm-lab-profile
aws iam add-role-to-instance-profile \
  --instance-profile-name ssm-lab-profile --role-name ssm-lab-role</code></pre></li>

<li><p>Launch the instance — no key pair, no public IP, default (empty-inbound) VPC security group:</p>
<pre><code>AMI_ID=$(aws ssm get-parameter \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query Parameter.Value --output text)
INSTANCE_ID=$(aws ec2 run-instances --image-id $AMI_ID \
  --instance-type t3.micro --subnet-id $SUBNET_ID \
  --no-associate-public-ip-address \
  --iam-instance-profile Name=ssm-lab-profile \
  --query 'Instances[0].InstanceId' --output text)</code></pre></li>

<li><p>Wait for SSM registration (2-4 minutes; interface endpoint DNS also needs a minute to settle), then connect:</p>
<pre><code>aws ssm describe-instance-information \
  --query 'InstanceInformationList[].PingStatus'
aws ssm start-session --target $INSTANCE_ID</code></pre>
<p>You now have a shell on a machine with no public IP, no open inbound ports, no NAT, and no bastion. Take a second to appreciate what is NOT in this architecture.</p></li>
</ol>

<h3>Verify</h3>
<ol>
<li><p>Inside the session, prove the instance is isolated from the internet but not from S3:</p>
<pre><code>curl -m 5 https://example.com || echo "NO INTERNET - as designed"
nslookup s3.us-east-1.amazonaws.com   # resolves to PUBLIC IPs - gateway endpoints
                                      # intercept by ROUTE (prefix list), not DNS
nslookup ssm.us-east-1.amazonaws.com  # resolves to 10.99.1.x - interface endpoint
                                      # private DNS rewrote the answer
curl -s -m 5 https://s3.us-east-1.amazonaws.com \
  &amp;&amp; echo "S3 REACHABLE via gateway endpoint"</code></pre>
<p>The two nslookups are the punchline: gateway endpoints reroute traffic to public IPs via the prefix list; interface endpoints rewrite DNS to private ENI IPs. Same problem, two mechanisms.</p></li>
<li><p>From your workstation, break S3 on purpose — disassociate the gateway endpoint from the route table:</p>
<pre><code>aws ec2 modify-vpc-endpoint --vpc-endpoint-id $S3EP_ID \
  --remove-route-table-ids $RTB_ID</code></pre>
<p>In the session, any S3-bound call (e.g., <code>curl -m 5 https://s3.us-east-1.amazonaws.com</code>) now hangs — no route — while the SSM session itself stays alive, because it rides the interface endpoints. Re-add with <code>--add-route-table-ids $RTB_ID</code>.</p></li>
</ol>

<h3>Teardown</h3>
<p>Ordered so nothing blocks deletion; the endpoints and instance are the only billing items.</p>
<ol>
<li><pre><code>aws ec2 terminate-instances --instance-ids $INSTANCE_ID
aws ec2 wait instance-terminated --instance-ids $INSTANCE_ID</code></pre></li>
<li><pre><code>EP_IDS=$(aws ec2 describe-vpc-endpoints \
  --filters Name=vpc-id,Values=$VPC_ID \
  --query 'VpcEndpoints[].VpcEndpointId' --output text)
aws ec2 delete-vpc-endpoints --vpc-endpoint-ids $EP_IDS</code></pre></li>
<li><pre><code>aws iam remove-role-from-instance-profile \
  --instance-profile-name ssm-lab-profile --role-name ssm-lab-role
aws iam delete-instance-profile --instance-profile-name ssm-lab-profile
aws iam detach-role-policy --role-name ssm-lab-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam delete-role --role-name ssm-lab-role</code></pre></li>
<li><p>Wait ~2 minutes for endpoint ENIs to disappear, then:</p>
<pre><code>aws ec2 delete-security-group --group-id $SG_ID
aws ec2 disassociate-route-table --association-id $(aws ec2 \
  describe-route-tables --route-table-ids $RTB_ID \
  --query 'RouteTables[0].Associations[0].RouteTableAssociationId' --output text)
aws ec2 delete-route-table --route-table-id $RTB_ID
aws ec2 delete-subnet --subnet-id $SUBNET_ID
aws ec2 delete-vpc --vpc-id $VPC_ID</code></pre></li>
<li><p>Confirm nothing remains: <code>aws ec2 describe-vpcs --vpc-ids $VPC_ID</code> should return an InvalidVpcID.NotFound error.</p></li>
</ol>
`
  }
});
