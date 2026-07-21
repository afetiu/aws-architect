window.COURSE.register({
  id: "adv-networking",
  order: 22,
  track: "sap",
  title: "Advanced & Hybrid Networking (Pro)",
  description: "SAP-C02 networking is architecture under constraints: Transit Gateway route-table segmentation, Direct Connect resiliency models and BGP traffic engineering, VPN's bandwidth physics, org-scale hybrid DNS, PrivateLink service meshes, centralized inspection with GWLB, and IPAM/Cloud WAN governance. This module assumes the SAA networking material cold and builds the multi-account, multi-region patterns the Pro exam actually tests.",
  examWeight: "One of the heaviest SAP-C02 themes. Expect multi-constraint scenarios: bandwidth math (VPN tunnel caps, ECMP), DX resiliency SLA mapping, TGW vs PrivateLink vs peering decisions, and centralized egress/inspection cost-and-symmetry reasoning.",
  lessons: [
    {
      id: "tgw-deep",
      title: "Transit Gateway Internals: Route Tables, Segmentation, and the Limits",
      html: `
<p>At SAA level, TGW is 'the hub that makes routing transitive'. At Pro level, TGW is a <strong>policy-capable route reflector with multiple FIBs</strong>, and the design surface is which attachment consults which FIB. Get the two verbs straight and every segmentation diagram becomes readable:</p>
<ul>
<li><strong>Association:</strong> an attachment is associated with exactly <strong>one</strong> TGW route table — the FIB consulted for traffic <em>arriving from</em> that attachment. Association answers 'where can this attachment send traffic'.</li>
<li><strong>Propagation:</strong> an attachment's routes (VPC CIDRs, BGP-learned prefixes from VPN/DX/Connect) are installed <em>into</em> one or more route tables. Propagation answers 'who can see the way back to this attachment'. An attachment can propagate into many tables while being associated with only one.</li>
</ul>
<p>Segmentation is just asymmetric association/propagation. The canonical three-table enterprise design: a <strong>prod</strong> table, a <strong>dev</strong> table, and a <strong>shared-services</strong> table. Prod and dev VPC attachments associate with their own tables; both propagate into the shared-services table; the shared-services VPC (and hybrid attachments) propagate into both prod and dev tables. Result: prod and dev each reach shared services and on-prem, but there is <strong>no route</strong> between prod and dev — isolation by absence of routes, not by ACL. Add <strong>blackhole routes</strong> for belt-and-braces explicit denial (a blackhole entry drops matching traffic even if a covering route exists elsewhere in the table).</p>

<div class="callout deep">Default behavior hides all of this: a new TGW has one default route table with default association AND default propagation enabled — every attachment talks to everything, which is why quick POCs 'just work' and why real deployments disable both defaults at TGW creation and manage tables explicitly. Also internalize the two-layer routing reality: the spoke VPC's subnet route tables decide what goes <em>to</em> the TGW (they are static — VPC route tables never learn TGW routes dynamically; you point 10.0.0.0/8 or 0.0.0.0/0 at the TGW attachment), and the TGW tables decide what happens next. Half of all TGW troubleshooting is a missing route on the OTHER layer than the one being stared at.</div>

<h3>Appliance mode</h3>
<p>A TGW VPC attachment normally keeps traffic in the AZ where it entered (AZ affinity, to minimize cross-AZ charges). For a stateful middlebox VPC (firewalls behind a GWLB), that is fatal: the forward flow can enter via AZ-a's attachment ENI and the return via AZ-b's, landing on a different appliance with no session state. <strong>Appliance mode</strong> on the attachment changes the hash: flows are stickily assigned to a single AZ's ENI in <em>both</em> directions (4-tuple + AZ affinity replaced by symmetric flow hashing), guaranteeing the same appliance sees both directions. Enable it on the inspection VPC attachment only — it costs you deliberate cross-AZ traffic, which is exactly the price of symmetry.</p>

<h3>Inter-region peering and TGW Connect</h3>
<ul>
<li><strong>TGW peering</strong> connects TGWs across regions (and across accounts) over the AWS backbone, encrypted. The critical constraint: <strong>peering attachments carry static routes only — no propagation across a peering</strong>. Every prefix reachable via the peer must be a static entry in your TGW route tables, which at multi-region scale is why summarizable CIDR plans (one /14 per region) and eventually Cloud WAN (lesson 8) exist.</li>
<li><strong>TGW Connect</strong> attachments give SD-WAN/virtual-router appliances a high-bandwidth, BGP-speaking on-ramp: GRE tunnels riding an existing VPC (or DX) attachment, each Connect peer running BGP with the TGW. GRE gets you past VPN's per-tunnel throughput ceiling: <strong>5 Gbps per GRE tunnel, up to 4 Connect peers per Connect attachment = 20 Gbps</strong> with ECMP, versus 1.25 Gbps per IPsec tunnel. Connect is the answer whenever the scenario says 'SD-WAN appliance', 'GRE', or 'higher bandwidth than VPN with dynamic routing into the TGW'.</li>
</ul>

<div class="callout limits">The numbers that decide architectures: 5,000 attachments per TGW; 10,000 routes per TGW route table (static+propagated); 20 route tables per TGW (default, raisable); up to 100 Gbps per VPC attachment; VPN attachment throughput 1.25 Gbps per tunnel (ECMP across tunnels/connections with BGP scales this); Connect: 5 Gbps per GRE tunnel, 4 peers per Connect attachment; 1,000 dynamic routes advertised per VPN/Connect BGP session to the TGW (excess routes are dropped, silently from the app's perspective — filter and summarize on the appliance side); TGW is regional; peering is static-only. Pricing: ~0.05 USD/attachment-hour plus ~0.02 USD/GB processed — data processing is charged per GB <em>through</em> the TGW, which is why hub-everything designs have a real toll and why VPC peering still wins for two chatty VPCs.</div>

<div class="callout war">Three production traps. (1) AZ mismatch: the TGW attachment only has ENIs in the subnets/AZs you selected — workloads in an AZ without an attachment ENI reach the TGW via another AZ (cross-AZ charge) or, if routes are AZ-scoped wrong, not at all; always attach every AZ the VPC uses. (2) The 10,000-route table sounds huge until on-prem advertises unsummarized /24s from a legacy WAN and three regions' worth of propagations pile in — summarize at the edge or drown. (3) Appliance mode off on an inspection VPC 'works' in testing (same-AZ test flows are accidentally symmetric) and drops ~half of all connections in production when cross-AZ flows appear. Test failover paths cross-AZ, always.</div>

<div class="callout exam">SAP question fingerprints: 'prevent prod and dev VPCs from communicating while both reach shared services' → TGW route-table association/propagation design (never SGs/NACLs at that scale — the isolation is routing). 'Stateful appliances see asymmetric traffic' → enable appliance mode. 'Connect an SD-WAN router with dynamic routing at more than VPN bandwidth' → TGW Connect/GRE. 'Multi-region TGWs, routes not appearing across regions' → peering does not propagate; add static routes.</div>
`
    },
    {
      id: "dx-foundations",
      title: "Direct Connect: Connections, VIF Taxonomy, DX Gateway, LAGs, MACsec",
      html: `
<p>Direct Connect is a physical cross-connect into an AWS router at a colocation facility — 802.1Q trunking and BGP, no tunnels, no internet. Everything architectural about DX follows from it being <em>circuits plus BGP</em>: provisioning takes weeks not minutes, resilience is bought per-circuit, and traffic engineering is done with BGP attributes, exactly like any carrier relationship you have managed.</p>

<h3>Dedicated vs hosted</h3>
<ul>
<li><strong>Dedicated connection:</strong> you get the whole port on the AWS device — 1, 10, 100 (and now 400) Gbps. Ordered from AWS, cross-connect provisioned via the colo (the LOA-CFA letter authorizes the patch). You can carve up to 50 private/public VIFs on it (and transit VIF capability — see limits).</li>
<li><strong>Hosted connection:</strong> a DX Partner sells you a slice of <em>their</em> dedicated port — 50 Mbps up to 10 Gbps (some partners 25 Gbps). Faster to provision, but <strong>one VIF per hosted connection</strong>, and the partner's port is a shared fate domain. 'Need multiple VIFs' or 'burst beyond the slice' scenarios eliminate hosted.</li>
</ul>

<h3>The three VIF types — the taxonomy the exam lives on</h3>
<table>
<thead><tr><th>VIF</th><th>BGP peers with</th><th>Reaches</th><th>Use</th></tr></thead>
<tbody>
<tr><td><strong>Private VIF</strong></td><td>VGW or DX Gateway</td><td>VPC private IPs</td><td>On-prem to VPC workloads</td></tr>
<tr><td><strong>Public VIF</strong></td><td>AWS public routing domain</td><td>All AWS public IPs, all regions (S3, DynamoDB public endpoints, EIPs)</td><td>Private-path access to public AWS endpoints; also the substrate for VPN-over-DX</td></tr>
<tr><td><strong>Transit VIF</strong></td><td>DX Gateway → Transit Gateways</td><td>Everything behind the TGWs</td><td>Hybrid at multi-VPC scale</td></tr>
</tbody>
</table>
<p>Public VIF subtleties that Pro tests: AWS advertises its full public prefix set (all regions — scope it with BGP communities, next lesson), and <em>you</em> must advertise publicly-owned prefixes of yours; AWS filters what it accepts. A public VIF is also how you run an IPsec VPN <em>over</em> DX to get encryption on the private path (terminate the VPN on public AWS endpoints reached via the public VIF) — the standard answer to 'encrypt DX traffic' before MACsec, and still the answer on shared/hosted links.</p>

<h3>DX Gateway</h3>
<p>A <strong>DX Gateway (DXGW)</strong> is a global, free routing object that decouples the physical connection's region from the VPCs it reaches: one private VIF to a DXGW can attach VGWs (up to <strong>10</strong>) in any regions; one transit VIF to a DXGW can attach TGWs (default quota <strong>3</strong>) across regions. Without a DXGW, a private VIF binds to a single VGW in the connection's home region. The hard rule: <strong>a DXGW is not a router between its associations</strong> — VPCs/TGWs associated with the same DXGW cannot reach each other through it; it is strictly on-prem-to-AWS plumbing. East-west between those VPCs still needs TGW/peering.</p>

<h3>LAGs</h3>
<p>A Link Aggregation Group bonds up to <strong>4 connections of identical speed at the same location</strong> into one LACP bundle, one logical connection, one set of VIFs. LAG is a bandwidth and link-level convenience, <strong>not a resiliency strategy</strong>: all members terminate on the same AWS device pair at the same facility, so a location event takes the whole LAG. The minimum-links attribute lets you declare the LAG down below N members, forcing failover to a second location rather than limping. Exam discriminator: bandwidth at one site → LAG; survive a site loss → second location (next lesson).</p>

<h3>MACsec</h3>
<p><strong>MACsec (802.1AE)</strong> encrypts the DX link at layer 2, line-rate, hop-by-hop between your device and the AWS device — available on dedicated 10/100/400 Gbps connections at MACsec-capable locations, keyed via a CKN/CAK pair you provision. Contrast with VPN-over-DX: MACsec is line-rate with no tunnel overhead and no 1.25 Gbps ceilings, but it only covers the last-mile cross-connect (hop-by-hop, not end-to-end) and constrains you to supported locations/speeds. 'Encrypt 100 Gbps of DX traffic without performance loss' → MACsec. 'Encrypt end-to-end over any DX' → IPsec over public VIF (or app-layer TLS and move on).</p>

<div class="callout limits">Per dedicated connection: 50 private+public VIFs, transit VIF support (historically 1 per connection — plan one transit VIF carrying all TGW traffic; 100G+ ports now allow more, but design and answer as if scarce). Hosted connection: exactly 1 VIF. DXGW: 10 VGW associations, 3 TGW associations (default), and up to 20 prefixes advertised from on-prem per BGP session toward AWS (the allowed-prefixes list on TGW associations similarly caps what AWS advertises — exceeding the 20-prefix limit takes the BGP session DOWN, not partially filtered: summarize!). DX provides no SLA on a single connection — SLAs attach to the resiliency architectures in the next lesson.</div>

<div class="callout war">The 20-prefix limit is the classic DX outage-by-config: a route-leak from on-prem (someone redistributes the full IGP into the DX BGP session) advertises prefix #21 and the session drops — total DX loss from one redistribution mistake. Prefix-list filters on your edge routers toward AWS are not optional hygiene; they are availability controls. Second war story: hosted-connection buyers discovering at scale-out that the second VIF they need cannot exist — re-procurement, weeks of lead time. Read the VIF math before signing.</div>
`
    },
    {
      id: "dx-resiliency",
      title: "DX Resiliency Models, BGP Traffic Engineering, and VPN Failover Math",
      html: `
<p>A single DX connection is a single circuit through a single device in a single building. AWS publishes four reference resiliency postures, and the SLA follows the architecture — memorize the mapping because SAP asks it almost verbatim:</p>
<table>
<thead><tr><th>Model</th><th>Topology</th><th>Survives</th><th>SLA</th></tr></thead>
<tbody>
<tr><td>Development/test</td><td>1 connection, 1 location (optionally + VPN backup)</td><td>Nothing physical</td><td>None</td></tr>
<tr><td>Dev/test resilient</td><td>2 connections, 1 location (separate devices)</td><td>Device failure</td><td>None meaningful</td></tr>
<tr><td><strong>High resiliency</strong></td><td>1 connection at each of <strong>2 locations</strong></td><td>Device or entire location</td><td><strong>99.9%</strong></td></tr>
<tr><td><strong>Maximum resiliency</strong></td><td><strong>2 connections at each of 2 locations</strong> (4 total)</td><td>Device + concurrent location failure</td><td><strong>99.99%</strong></td></tr>
</tbody>
</table>
<p>Corollaries the exam probes: a LAG never upgrades your model (same location, same fate); the SLA requires the reference architecture <em>and</em> per-location redundancy done right (separate devices, diverse paths); and 'two connections' at one metro can still share a fiber duct you cannot see — genuinely paranoid designs ask carriers for diversity attestations.</p>

<h3>BGP traffic engineering on DX</h3>
<p>It is all standard BGP; AWS just tells you which knobs it honors:</p>
<ul>
<li><strong>Outbound from on-prem (choosing which DX link AWS traffic returns on):</strong> AS-path prepending works but is coarse; the precise tool is AWS's <strong>local-preference communities on private/transit VIFs</strong>: tag your advertisements with 7224:7100 (low), 7224:7200 (medium), or 7224:7300 (high) and AWS sets local-pref accordingly — deterministic active/passive between two DX paths advertising the same prefix. Equal everything = ECMP across paths (active/active).</li>
<li><strong>Inbound scope on public VIFs:</strong> AWS tags its advertised prefixes with scope communities — <strong>7224:9100 (local region), 7224:9200 (continent), 7224:9300 (global)</strong> — filter on these to accept only, say, home-region prefixes instead of the entire AWS public internet estate. Conversely, communities you attach to your own advertisements control how far AWS propagates them.</li>
<li><strong>Failover ordering (DX primary, VPN backup):</strong> route selection at the VGW/TGW prefers DX over VPN for equal prefixes by design (DX routes win over VPN routes at the same prefix length). But do not rely on implicit preference alone — advertise identical prefixes on both paths and let the deterministic preference work; the classic failure is advertising a summarized /16 over VPN and specific /24s over DX, then losing DX means... nothing breaks, which sounds fine until the reverse (specifics over VPN) silently pins traffic to the VPN. <strong>Longest prefix match beats path preference, always.</strong></li>
</ul>

<h3>The VPN failover math nobody does until it hurts</h3>
<p>Site-to-Site VPN as DX backup is the standard cost-conscious design, and it has a load-bearing number: <strong>~1.25 Gbps per IPsec tunnel</strong>, a per-tunnel processing ceiling (and ~140k packets/sec — small-packet workloads hit the PPS wall first, at well below 1.25 Gbps of throughput). A 10 Gbps DX failing over to one VPN connection does not degrade gracefully — it falls off a cliff to an eighth of capacity. Your options:</p>
<ul>
<li><strong>ECMP across multiple VPN tunnels/connections on a TGW</strong> — requires <strong>dynamic (BGP) VPN</strong>, equal-length advertisements, and TGW (VGW does not ECMP VPN). Eight tunnels ≈ 10 Gbps aggregate, per-flow hashed — note <em>per-flow</em>: one elephant flow still caps at one tunnel's share.</li>
<li>Accept degraded mode and pre-decide what traffic drops (QoS on your edge; AWS will not prioritize for you).</li>
<li>Buy the second DX location instead — the honest answer once the business quantifies an outage day.</li>
</ul>

<div class="callout exam">Bandwidth-math questions are pure arithmetic dressed as architecture: '4 Gbps sustained hybrid traffic, DX fails, VPN backup must carry it' → one tunnel (1.25) fails; the answer is TGW + BGP VPN + ECMP across 4+ tunnels, or a second DX. Watch for the giveaways 'static routing' (kills ECMP — static VPN cannot ECMP) and 'VGW' (no ECMP — needs TGW). SLA questions: 99.99% → maximum resiliency (2×2); 99.9% → high resiliency (2 locations × 1). 'Prefer DX, VPN only as backup, deterministically' → same prefixes both paths (DX wins), never longer prefixes on the VPN side.</div>

<div class="callout war">Real DX failovers fail for BGP reasons, not physics: hold timers left at 90 s (tune BFD — DX supports BFD with ~sub-second detection; without it, 'seamless failover' means 90 seconds of blackhole); asymmetric MTU (DX supports jumbo 9001, VPN does not — flows that fail over mid-life with 9001-byte segments and DF set die silently; clamp MSS at the edge); and the specifics-over-summary mistake above. Failover you have not packet-tested during a maintenance window is failover you do not have.</div>

<div class="callout deep">Why 1.25 Gbps? Single-tunnel IPsec is bound to one flow-processing context on the headend — encryption is serialized per SA, so the ceiling is per-tunnel compute, not link speed. The same physics is why TGW Connect uses GRE (5 Gbps — no crypto) and why MACsec (line-rate ASIC crypto at L2) exists for the 100 Gbps class. Any time a scenario mixes 'encryption' with double-digit Gbps, the answer space is MACsec or many-tunnel ECMP — never one big IPsec pipe.</div>
`
    },
    {
      id: "s2s-vpn",
      title: "Site-to-Site VPN: BGP vs Static, Acceleration, and Termination Choices",
      html: `
<p>AWS Site-to-Site VPN is two IPsec tunnels per VPN connection, terminating on two AWS endpoints in different AZs, pointed at one customer gateway (CGW). It is the default hybrid on-ramp (minutes to provision, internet transport) and the default DX backup. The architecture decisions are: routing type, termination target, and transport path.</p>

<h3>BGP (dynamic) vs static — more consequential than it looks</h3>
<ul>
<li><strong>Dynamic (BGP):</strong> the tunnels run eBGP; prefixes are exchanged and withdrawn automatically. Buys you: real failover between the two tunnels (withdrawal on failure rather than AWS's health-based best-effort), <strong>ECMP eligibility on TGW</strong>, propagation into VGW/TGW route tables, and sane multi-site topologies. Any CGW that can speak BGP should.</li>
<li><strong>Static:</strong> you enumerate remote CIDRs on the VPN connection and rely on tunnel liveness detection for failover. No ECMP, ever. No automatic reconvergence beyond the tunnel pair. Acceptable only for trivially small, single-site setups with BGP-incapable devices — and it is the silent disqualifier planted in exam scenarios ('the VPN uses static routing' invalidates every ECMP/auto-failover option downstream).</li>
</ul>
<p>Tunnel behavior details that matter: both tunnels are up-capable but AWS historically prefers you treat them active/passive per connection (asymmetric return-path surprises when both advertise equally into a VGW); on TGW with ECMP you deliberately go active/active. DPD (dead peer detection) timing plus BGP hold timers define your failover clock — tune both; defaults give you tens of seconds of brownout.</p>

<h3>Termination target: VGW vs TGW</h3>
<table>
<thead><tr><th></th><th>VGW</th><th>Transit Gateway</th></tr></thead>
<tbody>
<tr><td>Scope</td><td>One VPC</td><td>All attached VPCs</td></tr>
<tr><td>ECMP across tunnels</td><td>No</td><td>Yes (BGP only)</td></tr>
<tr><td>Max realistic bandwidth</td><td>1.25 Gbps</td><td>Nx1.25 via ECMP (50 Gbps class achievable)</td></tr>
<tr><td>Accelerated VPN</td><td>No</td><td>Yes</td></tr>
<tr><td>Route propagation</td><td>Into VPC route tables (enable per table)</td><td>Into TGW route tables</td></tr>
</tbody>
</table>
<p>VGW route propagation is worth one precise sentence: enabling propagation on a VPC route table auto-installs BGP-learned on-prem prefixes as routes, and static routes you configure <strong>beat propagated routes of the same prefix</strong> — the tiebreak that decides several exam scenarios about overriding learned paths.</p>

<h3>Accelerated Site-to-Site VPN</h3>
<p>Standard VPN rides the public internet to a regional AWS endpoint — transatlantic jitter and ISP weather included. <strong>Accelerated VPN</strong> terminates the tunnels on <strong>Global Accelerator anycast IPs</strong> instead: the CGW's packets enter the AWS backbone at the nearest edge POP and ride AWS's network to the region. Requirements and caveats: <strong>TGW attachment only</strong> (not VGW), extra GA hourly + data-transfer-premium cost, and NAT-traversal must be enabled (GA fronting requires UDP 4500 encapsulation). Use when the scenario pairs VPN with 'inconsistent latency/jitter over the internet from distant offices' — it is jitter medicine, not a bandwidth increase (the 1.25 Gbps per-tunnel cap is unchanged; the physics from last lesson still rules).</p>

<h3>VPN over DX</h3>
<p>For 'encrypted AND private path' without MACsec-class hardware: run the IPsec tunnels <em>over a public VIF</em> — the VPN endpoints are AWS public IPs, reachable via DX, so the tunnels traverse the cross-connect instead of the internet. You pay the IPsec bandwidth tax (1.25 Gbps/tunnel) on a link that could do line-rate, which is exactly the trade the previous lesson's deep-dive explains — hence MACsec for the big pipes.</p>

<div class="callout exam">Mappings: 'BGP-capable customer device' → dynamic VPN, always. 'Need more than 1.25 Gbps over VPN' → TGW + BGP + ECMP (and check nothing in the scenario says static/VGW). 'Office VPN performance varies wildly by time of day' → Accelerated VPN (TGW required — a detail the right answer includes). 'Encrypt traffic over Direct Connect' → IPsec over public VIF (or MACsec if dedicated 10G+ and the question stresses line rate). 'Static routing configured' → eliminate ECMP and auto-failover options immediately.</div>

<div class="callout war">Two chronic VPN production ailments. First, MTU: IPsec+GRE overhead drops effective MTU to ~1436 or lower while VPC-side instances speak 9001 among themselves — without MSS clamping on the CGW, hybrid TCP sessions stall on the first full-size segment, presenting as 'small requests work, bulk transfers hang', the single most misdiagnosed hybrid symptom. Second, tunnel flap from aggressive DPD plus an ISP with micro-outages: each flap withdraws and re-propagates BGP routes org-wide via TGW; damp at your edge before your NOC learns to ignore the alerts — ignored flap alerts are how the real outage gets missed.</div>

<div class="callout limits">Per VPN connection: 2 tunnels, 1.25 Gbps and ~140k PPS per tunnel. Static: 50 routes per VPN connection (raisable). BGP: 100 routes advertised from AWS per session soft-capped, 1,000 inbound toward TGW (drop on excess — summarize). VPN connections per TGW: soft-quota'd into the hundreds — the aggregate-bandwidth pattern (many connections × ECMP) is quota-realistic. Accelerated VPN: TGW only. IPv6 supported for the inner tunnels (transport is IPv4 to CGW in most deployments).</div>
`
    },
    {
      id: "hybrid-dns-scale",
      title: "Hybrid DNS at Org Scale: Central Resolver Architecture",
      html: `
<p>The SAA-level Resolver story (inbound endpoint = others query us; outbound endpoint = we query out via rules) becomes, at Pro scale, a question of <em>multiplicity</em>: 200 accounts, 500 VPCs, four regions, one on-prem AD forest. Naive replication — endpoints in every VPC — costs ~90 USD/month per endpoint pair per VPC and gives on-prem 500 forwarder targets. The Pro pattern is <strong>centralize the endpoints, share the rules, associate the zones</strong>.</p>

<h3>The central DNS VPC pattern</h3>
<p>One networking-account VPC ('DNS VPC') hosts exactly one inbound and one outbound Resolver endpoint (2+ ENIs each, spread across AZs). Then:</p>
<ol>
<li><strong>Outbound direction (AWS resolves on-prem):</strong> forwarding rules for on-prem domains (corp.example.internal → AD server IPs, via the central outbound endpoint) are created once in the networking account and <strong>shared to the whole org via AWS RAM</strong>. Every account associates the shared rules with its VPCs (automatable via an association pipeline or infrastructure module). Result: any workload VPC's +2 resolver forwards matching queries through the central outbound ENIs — the spoke VPCs need no endpoints at all, only rule associations. Traffic path note: the actual DNS query egresses from the central VPC's ENIs, so only the DNS VPC needs network reachability (TGW/DX routes, SG allowances) to the on-prem DNS servers — a nicely contained security surface.</li>
<li><strong>Inbound direction (on-prem resolves AWS):</strong> on-prem conditional forwarders point at the two-plus inbound endpoint IPs in the DNS VPC. For the inbound endpoint to answer for <em>every account's</em> private zones, each account's PHZ must be <strong>associated with the DNS VPC</strong> (the cross-account authorize-then-associate handshake, or better: PHZs centrally owned in the networking account and associated outward to workload VPCs). The inbound endpoint answers with the union of all PHZs associated to its host VPC — that association set IS your on-prem-visible namespace.</li>
<li><strong>Multi-region:</strong> Resolver endpoints and rules are regional. Repeat the pattern per major region and give on-prem forwarders regional targets (with ordering/failover), or accept cross-region resolution latency through one region and its availability coupling. PHZs themselves are global objects — associate each with the DNS VPCs in every region for locality.</li>
</ol>

<div class="callout deep">Why associate PHZs to the DNS VPC rather than replicate records? Because Resolver answers queries with the zone view of the VPC <em>hosting the endpoint that received the query</em>. The inbound endpoint is just ENIs in the DNS VPC; whatever that VPC can resolve, on-prem can resolve. This composition rule — endpoint inherits its VPC's resolution context (PHZ associations + rule associations + public recursion) — is the single fact from which the entire central architecture derives. It also yields the gotcha: associate a new team's PHZ with their own VPCs but forget the DNS VPC, and cloud resolution works everywhere while on-prem resolution of that zone fails — mysterious, until you remember whose view the inbound endpoint serves.</div>

<h3>Rule design details</h3>
<ul>
<li>Most-specific-domain rule wins; use <strong>system rules</strong> to carve exceptions (forward example.internal on-prem, except cloud.example.internal which stays on a PHZ).</li>
<li>Never create a catch-all '.' forward-everything rule to on-prem: it makes on-prem DNS a hard dependency of ALL resolution — S3 endpoints, service discovery, everything — and couples every AWS workload to a DX/VPN path and an AD ops team's change windows. Forward only domains on-prem authoritatively owns.</li>
<li>Rules are invisible to workloads (server-side at the +2 resolver): no DHCP option games, no resolv.conf drift, works identically for Lambda/Fargate/anything that cannot run a forwarder.</li>
<li>Reverse DNS: create rules for the relevant in-addr.arpa subtrees toward on-prem for on-prem ranges; AWS-side reverse zones can be PHZ-hosted if appliances insist on PTRs.</li>
</ul>

<div class="callout limits">Capacity/limits to design against: ~10,000 QPS per endpoint ENI (scale by adding ENIs, up to 6 per endpoint); 1024 pps per <em>instance</em> ENI to the +2 resolver remains the client-side wall — org-scale DNS problems are usually client-cache problems, not endpoint problems; 1,000 rules per account (soft); PHZ associations per zone: 1,000 (soft); RAM-shared rules count against the owner's quota. Endpoint pricing ~0.125 USD/ENI-hour makes the central pattern ~180 USD/month org-wide versus 90 USD × N-VPCs for the naive one.</div>

<div class="callout exam">SAP phrasings: 'hundreds of accounts must resolve on-premises names with minimal infrastructure' → central outbound endpoint + RAM-shared rules (the distractors deploy per-VPC endpoints or fiddle with DHCP option sets). 'On-premises must resolve records in private hosted zones across many accounts' → PHZ associations to the central inbound endpoint's VPC (distractor: pointing on-prem at the .2 address, which is unreachable — link-local scope — and wrong). 'One domain must resolve on-prem except a cloud subdomain' → forwarding rule + system rule pair. Anything proposing conditional forwarders per workload VPC or EC2-based BIND fleets is the legacy anti-answer unless the question demands features Resolver lacks (views, RPZ beyond DNS Firewall, etc.).</div>

<div class="callout war">Failure modes seen in the field: an org sharded rules across two 'networking' accounts during a migration, and half the VPCs resolved corp.internal through decommissioned endpoints — RAM shares outlive intentions; audit rule associations like routes. And the big one: DX maintenance + a catch-all rule someone added 'temporarily' = every DNS lookup in 300 VPCs timing out against unreachable on-prem servers, a total-platform outage caused by DNS architecture, not DNS servers. Scope rules narrowly; test resolution behavior with the hybrid path DOWN as part of DR drills.</div>
`
    },
    {
      id: "privatelink-scale",
      title: "PrivateLink at Scale: Provider/Consumer Patterns and the Connectivity Decision",
      html: `
<p>PrivateLink inverts the connectivity model: instead of routing <em>networks</em> together, you project <em>one service</em> into consumer VPCs as local ENIs. At Pro level you must reason about both sides of the wire and about when PrivateLink beats routed connectivity entirely.</p>

<h3>Provider side (endpoint service)</h3>
<ul>
<li>You front the service with an <strong>NLB</strong> (or, newer, a GWLB for appliance services; ALB can sit behind the NLB as a target for L7 features). Create an <strong>endpoint service</strong> on it; consumers create interface endpoints against your service name.</li>
<li><strong>Acceptance and allow-listing:</strong> the provider allow-lists consumer principals (accounts, OUs, or org ARNs) and optionally requires manual acceptance per connection — your commercial/security gate. Optionally verify a <strong>private DNS name</strong> (TXT-record domain validation) so consumers can enable service-branded private DNS.</li>
<li><strong>AZ symmetry by zone ID:</strong> a consumer can only place endpoint ENIs in AZs where the provider's NLB has presence, matched by <strong>AZ ID</strong> (use1-az1...) not AZ name — names are shuffled per account; IDs are physical. Providers serving many consumers deploy the NLB in every AZ of the region, or consumers in unlucky AZs pay cross-AZ latency or cannot connect. (Endpoints can now optionally spray cross-AZ, but design for symmetry.)</li>
<li><strong>Source IP:</strong> traffic arrives at provider targets from the NLB with the consumer's addressing hidden (unless proxy protocol v2 is enabled to recover consumer endpoint identity). PrivateLink is strictly <strong>unidirectional</strong> — consumer initiates; the provider cannot originate connections back. That property is a security feature, and also the disqualifier for any protocol requiring server-initiated callbacks.</li>
</ul>

<h3>Why PrivateLink instead of routing: the decision table</h3>
<table>
<thead><tr><th></th><th>VPC peering</th><th>Transit Gateway</th><th>PrivateLink</th></tr></thead>
<tbody>
<tr><td>Shape</td><td>Network-to-network, pairwise</td><td>Network-to-network, hub</td><td>Service-to-consumers, one-way</td></tr>
<tr><td>Overlapping CIDRs</td><td>Fatal</td><td>Fatal (without NAT tricks)</td><td><strong>Irrelevant</strong> — endpoint has a local IP</td></tr>
<tr><td>Exposure</td><td>Whole CIDR reachable</td><td>Whole route-table view reachable</td><td>One service, one port set</td></tr>
<tr><td>Scale of consumers</td><td>125 peers/VPC</td><td>5,000 attachments</td><td>Thousands of endpoints per service</td></tr>
<tr><td>Cost shape</td><td>Free + data</td><td>Per-attachment-hour + per-GB</td><td>Per-endpoint-AZ-hour + per-GB</td></tr>
<tr><td>Direction</td><td>Bidirectional</td><td>Bidirectional</td><td>Consumer-to-provider only</td></tr>
</tbody>
</table>
<p>Decision heuristics that resolve nearly every SAP scenario: <strong>overlapping CIDRs anywhere in the problem → PrivateLink</strong> (routing cannot be fixed; projection sidesteps it). <strong>'Expose only this API/service, nothing else' / SaaS-vendor-to-many-customers → PrivateLink</strong> (least-privilege at the network layer; peering/TGW expose networks). <strong>Many-to-many app communication, shared services, hybrid routes → TGW.</strong> <strong>Two VPCs, high volume, latency- and cost-sensitive → peering</strong> (no per-GB TGW processing toll, no hourly). Combinations are normal: TGW for the org fabric, PrivateLink for cross-org SaaS edges and for CIDR-collision islands (acquisitions!).</p>

<div class="callout exam">Fingerprints: 'company acquired another company; both use 10.0.0.0/16; service X must be consumed' → PrivateLink, and every routed option is a trap. 'SaaS provider offering private connectivity to hundreds of customer VPCs' → endpoint service with acceptance/allow-listing (customers as consumers; NLB required on provider side). 'Consumers must not be able to reach anything except the service' → PrivateLink over peering/TGW on exposure grounds. 'Application requires the provider to call back to consumers' → PrivateLink disqualified (unidirectional); pick routed connectivity.</div>

<div class="callout deep">What an interface endpoint actually is: a Hyperplane-managed ENI whose flows are NATed into the provider's NLB across an internal fabric — no route tables involved on either side, which is precisely why CIDR overlap cannot matter and why the blast radius is a single (IP, port) surface. The corollary limit: because it is flow-NAT, each endpoint has connection-scaling characteristics (per-ENI Gbps-class throughput ~10 Gbps sustained, ~100 Gbps burst across an endpoint's ENIs) rather than 'line rate routing'. Bulk-replication workloads between VPCs belong on peering/TGW; PrivateLink is a service edge, not a data pipe.</div>

<div class="callout war">Operational lessons: (1) Cross-AZ blindness — provider adds an AZ, consumers do not, or vice versa; everything works until an AZ evacuation concentrates traffic through surviving endpoint ENIs with no provider presence — map AZ IDs explicitly in runbooks. (2) Endpoint policies default to allow-all; a fintech learned in audit that its 'private' S3 endpoint permitted PutObject to arbitrary external buckets — the endpoint policy is your exfiltration control, write it. (3) Providers rotating NLB target fleets behind long-lived consumer connections discover consumers pin flows for hours — drain patiently; PrivateLink consumers cannot see your deregistration events.</div>

<div class="callout limits">Numbers: endpoints per VPC 50 (soft, commonly raised); an endpoint service supports thousands of consumer endpoints; provider NLB required (GWLB variant for appliances); proxy protocol v2 for consumer attribution; private DNS requires domain verification; per-AZ-hour ~0.01 USD + ~0.01 USD/GB on the consumer side. PrivateLink is same-region at the endpoint level — cross-region consumption composes an endpoint with inter-region TGW/peering into the consumer's region (or the newer cross-region endpoint capability where available; design answers on the exam assume same-region + composition).</div>
`
    },
    {
      id: "central-inspection",
      title: "Centralized Inspection: GWLB, Appliance Mode, and Egress/Ingress Hubs",
      html: `
<p>Enterprises consolidate traffic inspection — IDS/IPS, next-gen firewalls, egress filtering — into a shared VPC rather than per-VPC appliance sprawl. Three architectures dominate: centralized east-west/egress inspection through a firewall VPC on the TGW, centralized internet egress through a NAT hub, and centralized ingress. All three hinge on two primitives you must know cold: <strong>Gateway Load Balancer</strong> and <strong>TGW appliance mode</strong>.</p>

<h3>Gateway Load Balancer mechanics</h3>
<p>GWLB is a bump-in-the-wire L3/L4 balancer for fleets of inline appliances: it receives raw packets, wraps them in <strong>GENEVE (UDP 6081)</strong>, and tunnels them to appliance targets, which inspect and return them over the same GENEVE session; GWLB then forwards the original packet onward. Properties that follow: appliances are <strong>transparent</strong> (original 5-tuple preserved inside GENEVE — no NAT at the appliance tier), <strong>flow-sticky</strong> (5-tuple hashing pins a flow to one appliance, preserving state), and horizontally scalable with health checks (failed appliance → flows rehash, stateful sessions on it die — appliances should share state if the vendor supports it). Traffic enters the GWLB via <strong>GWLB endpoints (GWLBe)</strong> — a PrivateLink flavor — which appear as route-table targets in consumer VPCs/edge route tables. That is the magic: <em>inspection insertion becomes a routing decision</em>.</p>

<h3>Architecture 1: East-west and egress inspection via TGW</h3>
<p>Spoke VPCs' TGW route tables send everything (0.0.0.0/0 and/or east-west prefixes) to the <strong>inspection VPC attachment</strong>. Inside the inspection VPC: TGW-attachment subnets route to GWLBe subnets; GWLBe hands packets through the firewall fleet; post-inspection route tables send traffic back to the TGW (a separate return route table), which forwards to the true destination per the <strong>post-inspection TGW route table</strong>. Two TGW route tables (pre- and post-inspection) prevent loops: spokes associate with a table whose only route is 'to inspection'; the inspection attachment associates with the full table. And the non-negotiable: <strong>appliance mode ON for the inspection VPC attachment</strong> — without it, return flows can enter a different AZ than forward flows and reach a different (stateless-about-this-flow) firewall, dropping ~half of cross-AZ connections. This exact misconfiguration is both a Pro exam answer and a rite-of-passage outage.</p>

<h3>Architecture 2: Centralized egress (NAT hub)</h3>
<p>Spokes have no IGWs and no NAT gateways; their TGW route tables default-route to an <strong>egress VPC</strong> containing NAT gateways (per AZ) and an IGW, optionally with the firewall/GWLBe layer inline before NAT. Trade-offs to reason about explicitly: you centralize security policy, logging, and public-IP surface (auditors love it), but you pay <strong>TGW data processing (~0.02 USD/GB) on top of NAT processing (~0.045 USD/GB)</strong> for every egress byte, and the egress VPC becomes a org-wide blast radius (mitigated per-AZ). For a handful of low-traffic spokes, centralized egress is cheaper than N×NAT-gateway floors (~33 USD/month each); for data-heavy spokes, decentralized NAT wins on per-GB math. SAP asks this cost comparison in both directions — do the arithmetic in the question, not from dogma.</p>

<h3>Architecture 3: Centralized ingress</h3>
<p>Internet-facing entry consolidates in an <strong>ingress VPC</strong>: internet → (optional WAF/CloudFront) → ALB/NLB in the ingress VPC → targets in spoke VPCs by IP over the TGW, or → PrivateLink endpoints projecting spoke services. Inspection variant: <strong>ingress routing</strong> (the IGW edge route table from the SAA module) steers inbound traffic to a GWLBe before it ever reaches the load balancer — firewall-then-LB. Choosing ALB-to-IP-over-TGW vs PrivateLink-per-service is the peering/TGW/PrivateLink decision again: shared fabric vs per-service projection with overlap immunity.</p>

<div class="callout deep">Why GENEVE and not just routing next-hops at appliances? Because encapsulation preserves the original packet exactly (including L2-adjacent metadata in TLVs — GWLB stamps flow cookies and endpoint identity into GENEVE options), lets appliances live in any subnet/AZ without being routing participants, and makes the appliance fleet horizontally elastic behind a stable routing target (the GWLBe). It is the same architectural move as PrivateLink generally: replace 'be on the path' (routing) with 'be projected onto the path' (endpoint), so the path's routing never changes as the fleet scales.</div>

<div class="callout war">Inspection-hub war stories: (1) Appliance-mode-off asymmetry (see above) — the symptom is maddeningly statistical: intra-AZ flows fine, ~half of cross-AZ flows reset. (2) Firewall fleet sized for average throughput melts during a spoke's S3 backup window because someone routed the S3 gateway-endpoint prefix through inspection too — exclude high-trust bulk AWS prefixes from the inspection default route deliberately or size for them. (3) The egress VPC's NAT hit port-exhaustion (55k per destination) org-wide because every spoke's traffic to one SaaS API now shares one NAT source — the SAA limit returns at 10x scale; multiple EIPs/NATs per AZ in the hub is standing doctrine.</div>

<div class="callout exam">Fingerprints: 'inspect all traffic between VPCs with third-party appliances, scale horizontally' → GWLB + GWLBe in a central inspection VPC via TGW, appliance mode on. 'Stateful appliances dropping cross-AZ return traffic' → enable appliance mode (the answer is that phrase). 'All outbound internet via one audited point' → centralized egress VPC + TGW default routes (weigh the double per-GB toll if cost appears). 'Inspect inbound before the load balancer' → IGW ingress routing to a GWLBe. AWS Network Firewall scenarios are the same architectures with the managed firewall substituted for the appliance fleet — the routing shapes are identical, which is exactly why the exam tests the shape, not the vendor.</div>
`
    },
    {
      id: "ipam-cloudwan",
      title: "IPAM, Org-Scale IPv6 Strategy, and Cloud WAN vs TGW",
      html: `
<p>The last mile of Pro networking is governance: who allocates address space, how IPv6 changes the plan, and whether the global network itself should be hand-built (TGW + peering) or policy-driven (Cloud WAN).</p>

<h3>Amazon VPC IPAM</h3>
<p>IPAM productizes the spreadsheet every network team secretly runs: hierarchical <strong>pools</strong> (top-level 10.0.0.0/8 → regional pools → per-environment/BU pools) from which VPCs allocate CIDRs automatically at creation. Integrated with Organizations, it discovers all VPC CIDRs across accounts, flags <strong>overlaps and noncompliant allocations</strong>, tracks utilization (subnet-level, with alerting before exhaustion), and keeps an audit trail of who allocated what when. Two features with outsized architectural value: <strong>automatic allocation</strong> (a developer's IaC requests 'a /20 from the eu-west-1 nonprod pool' instead of inventing 10.0.0.0/16 for the fifth time — overlap prevention at provisioning time, the only time it is cheap), and <strong>BYOIP management</strong> (your public IPv4/IPv6 blocks onboarded once at the org level and sub-allocated through the same pools). Pricing is per active IP managed (~0.00027 USD/hour ≈ 0.20 USD/month), which is real money at 100k IPs — the free tier of basic discovery exists, but allocation features are the paid tier. Exam trigger: 'prevent overlapping CIDRs across hundreds of accounts / automate CIDR assignment / audit IP usage org-wide' → IPAM, versus the distractor of config rules and spreadsheets.</p>

<h3>IPv6 strategy at org scale</h3>
<p>IPv4 scarcity is the root cause of half this course: overlapping 10/8 estates, NAT layers, PrivateLink-as-overlap-workaround, CGNAT space for pods. The v6 plan that fixes it structurally:</p>
<ul>
<li>Allocate a large contiguous GUA block via IPAM (Amazon-provided /52s per region into pools, or BYOIPv6) so <strong>regions and OUs summarize cleanly</strong> — one prefix per region toward on-prem, finally.</li>
<li>VPCs take /56, subnets /64, non-negotiable sizes — planning is purely about the hierarchy above /56.</li>
<li>Dual-stack everywhere as transitional posture; <strong>IPv6-only subnets</strong> where the workload allows (EKS pods, internal services) to end IPv4 consumption; NAT64+DNS64 for reaching the v4-only internet from v6-only subnets; egress-only IGW as the privacy boundary.</li>
<li>Remaining v4 pressure points: many AWS services and most of the internet still require v4 somewhere — the strategy is v4 as a scarce edge resource (load balancers, NAT64) and v6 as the interior fabric. Also the per-public-IPv4 hourly charge makes this financially self-reinforcing.</li>
</ul>

<h3>Cloud WAN vs Transit Gateway</h3>
<p><strong>AWS Cloud WAN</strong> is the policy-compiled global network: you declare a <strong>core network policy</strong> (JSON — segments, edge locations/regions, attachment-admission rules, segment-sharing rules), and Cloud WAN materializes the mesh — core network edges per region, inter-region connectivity managed for you, attachments (VPC, VPN, Connect, DX via TGW-interop or native DX attachment where available) mapped to <strong>segments</strong> by tag-based policy. Segments are global VRFs: 'prod', 'dev', 'shared' spanning all regions, with isolation and sharing declared, not built route-by-route.</p>
<table>
<thead><tr><th></th><th>Transit Gateway (+peering)</th><th>Cloud WAN</th></tr></thead>
<tbody>
<tr><td>Scope</td><td>Regional device; you build the inter-region mesh</td><td>Global network object; mesh managed</td></tr>
<tr><td>Inter-region routes</td><td><strong>Static only</strong> across peerings</td><td>Propagated across the core automatically</td></tr>
<tr><td>Segmentation</td><td>Route tables you engineer per region</td><td>Segments declared once, global</td></tr>
<tr><td>Change model</td><td>Imperative (routes, associations)</td><td>Declarative policy versions with review/rollback</td></tr>
<tr><td>Maturity/features</td><td>Deeper (appliance mode, every attachment type, battle-tested)</td><td>Newer; TGW interop via peering for gaps</td></tr>
</tbody>
</table>
<p>Decision: multi-region, many-segment, policy-governed global WAN where per-region TGW route-table engineering (and its static peering routes) is the pain → Cloud WAN. Single-region or few-region hub-and-spoke, inspection-heavy designs leaning on appliance mode and mature integrations → TGW, still the default. They interoperate (TGW peering into the core network), so migration is incremental, and mixed answers are legitimate on the exam.</p>

<div class="callout exam">Trigger mapping: 'global network across 5 regions, segment prod/dev worldwide, minimize routing administration' → Cloud WAN. 'Automated CIDR allocation with overlap prevention across the org' → IPAM. 'Ran out of IPv4, EKS pod density' → IPv6-only/dual-stack with NAT64/DNS64 (or CGNAT secondary CIDR as the v4 stopgap). 'Advertise one summarized prefix per region to on-prem' → hierarchical IPAM pools (v4) / contiguous GUA plan (v6).</div>

<div class="callout limits">IPAM: pools nest ~10 deep; org-wide discovery needs delegated-admin setup; per-active-IP pricing. Cloud WAN: per core-network-edge-hour + attachment-hour + data processing — meaningfully pricier than a single-region TGW; its value is multi-region operations, not unit cost. IPv6: /56 per VPC, /64 per subnet fixed; Amazon-provided blocks are non-portable (BYOIPv6 for portability); egress-only IGW and NAT64 remain the only middleboxes — there is no IPv6 NAT gateway masquerading, by design and by ideology.</div>

<div class="callout war">Governance failures are slow-motion: an org adopted IPAM but grandfathered existing VPCs 'temporarily' — two years later the overlap report is a wall of red nobody budgets to fix; onboard brownfield estates into IPAM as read-only compliance FIRST, and gate NEW allocations immediately — prevention is cheap, remediation is renumbering. On Cloud WAN: policy changes apply globally — a bad segment-sharing rule is a global bad day; use the policy versioning/change-set review it provides, and keep the blast-radius instinct you had for TGW route tables.</div>
`
    }
  ],
  quiz: [
    {
      q: "An organization attaches 40 production VPCs, 25 development VPCs, a shared-services VPC, and a Direct Connect gateway to a Transit Gateway. Production and development VPCs must never communicate with each other, but all VPCs need the shared-services VPC and on-premises. What is the correct TGW design?",
      options: [
        "Three TGW route tables: prod and dev attachments associated with their own tables, shared-services and DX attachments propagated into both, prod and dev propagated only into the shared-services table",
        "One default route table with blackhole routes between every prod and dev VPC pair",
        "Security groups referencing prod and dev SG IDs with deny rules between them",
        "Two Transit Gateways, one for prod and one for dev, both peered to a third TGW for shared services"
      ],
      answer: [0],
      multi: false,
      explanation: "Segmentation is asymmetric association/propagation: prod and dev tables contain only shared-services and hybrid routes (no routes to each other = isolation by omission), while the shared table sees everyone. <strong>B</strong> collapses at scale — 40×25 pairwise blackholes is unmanageable and default propagation keeps re-adding reachability; blackholes are a supplement, not the design. <strong>C</strong> is doubly wrong: SGs cannot deny, and SG references do not traverse TGW. <strong>D</strong> can be made to work but triples cost and adds static-route-only peering complexity to solve something one TGW's route tables solve natively — a fails-on-'most-operationally-efficient' answer."
    },
    {
      q: "A centralized inspection VPC contains stateful firewalls behind a Gateway Load Balancer, attached to a Transit Gateway. Intra-AZ traffic inspects correctly, but roughly half of cross-AZ connections between spokes are dropped with resets. What fixes this?",
      options: [
        "Enable appliance mode on the inspection VPC's TGW attachment so both directions of a flow hash to the same AZ",
        "Enable cross-zone load balancing on the GWLB",
        "Add static return routes for each spoke CIDR in the inspection VPC route tables",
        "Increase the firewall fleet size to handle the connection load"
      ],
      answer: [0],
      multi: false,
      explanation: "Default TGW AZ-affinity sends the return flow into the inspection VPC via the destination-side AZ, which can differ from the forward path's AZ — a different firewall with no session state resets the flow; appliance mode replaces AZ affinity with symmetric flow hashing so both directions traverse the same AZ (and thus the same GWLB flow pinning). The statistical half-failure signature is the tell. <strong>B</strong> operates below the problem — the flow reaches the wrong AZ before the GWLB can balance anything, and GWLB flow stickiness is per-AZ path. <strong>C</strong> misdiagnoses: routes exist (traffic arrives and is reset), symmetry doesn't come from routes. <strong>D</strong> is capacity medicine for a correctness disease."
    },
    {
      q: "Two Transit Gateways in different regions are peered. VPCs attached in region A cannot reach newly added VPCs in region B, although region B's local routing works. What is the cause?",
      options: [
        "TGW peering attachments do not propagate routes; static routes for the new VPC CIDRs must be added to region A's TGW route tables",
        "Inter-region peering requires a Direct Connect gateway to carry routes",
        "The new VPCs' subnets lack routes to their local TGW",
        "TGW peering only supports IPv6 traffic between regions"
      ],
      answer: [0],
      multi: false,
      explanation: "The defining constraint of TGW inter-region peering: no dynamic propagation across the peering — every remote prefix is a static entry, so new VPCs in region B are invisible to region A until someone adds routes (the operational pain Cloud WAN's auto-propagating core exists to remove). <strong>B</strong> invents a dependency; peering rides the AWS backbone with no DX involvement. <strong>C</strong> contradicts the given — region B's local routing works. <strong>D</strong> is fabricated."
    },
    {
      q: "A company needs 15 Gbps of dynamically-routed connectivity from its SD-WAN virtual appliances into a Transit Gateway. IPsec VPN attachments were tested and abandoned due to throughput. Which mechanism meets the requirement?",
      options: [
        "TGW Connect attachment with four GRE-based Connect peers running BGP, ECMP across the tunnels",
        "Eight Site-to-Site VPN connections with static routing and ECMP",
        "A single VPN connection with jumbo frames enabled on both tunnels",
        "VPC peering from the SD-WAN appliance VPC with propagated BGP routes"
      ],
      answer: [0],
      multi: false,
      explanation: "TGW Connect is purpose-built for this: GRE tunnels at 5 Gbps each (no IPsec crypto ceiling), up to 4 Connect peers per attachment (20 Gbps aggregate), BGP-dynamic, ECMP-capable — 15 Gbps fits. <strong>B</strong> fails twice: static routing cannot ECMP (ECMP requires BGP-equal routes), and the requirement says dynamic routing. <strong>C</strong> cannot escape the ~1.25 Gbps per-tunnel IPsec processing bound — jumbo frames are not supported over VPN and would not change crypto throughput anyway. <strong>D</strong> is incoherent: VPC peering carries no BGP and does not attach appliances to a TGW."
    },
    {
      q: "A financial firm requires hybrid connectivity with a 99.99% SLA target per AWS's Direct Connect resiliency guidance. Which topology matches?",
      options: [
        "Two dedicated connections at each of two Direct Connect locations, with dual customer routers per site",
        "One 100 Gbps dedicated connection with a 4-link LAG at a single location",
        "One connection at each of two locations with a Site-to-Site VPN backup",
        "Two hosted connections from different partners at the same location"
      ],
      answer: [0],
      multi: false,
      explanation: "The maximum resiliency model — 2 locations × 2 connections (4 circuits, separate devices) — is the published 99.99% architecture; it survives a device failure concurrent with a full location failure. <strong>B</strong> is the LAG trap: four links share one location and one device pair — bandwidth, not resiliency; a facility event drops everything. <strong>C</strong> is the high-resiliency model (99.9%) — the VPN backup adds recovery capability but not the DX SLA tier, and drops you to VPN bandwidth during failover. <strong>D</strong> shares a facility (single fate domain) and hosted connections carry partner shared-port risk — no SLA tier."
    },
    {
      q: "On-premises routers connect to AWS via two Direct Connect connections at different locations. The company wants connection A active and connection B passive for the same prefixes, deterministically, controlling the decision from their side. What is the recommended method?",
      options: [
        "Advertise the prefixes on both connections, tagging A's advertisements with community 7224:7300 and B's with 7224:7100",
        "Advertise more-specific prefixes over connection B",
        "Configure a higher MED on connection A",
        "Advertise the prefixes only on connection A, adding B's advertisement manually during failover"
      ],
      answer: [0],
      multi: false,
      explanation: "AWS honors local-preference communities on private/transit VIFs: 7224:7300 (high) vs 7224:7100 (low) sets AWS-side local preference, deterministically preferring A while B remains a hot-standby BGP path that takes over on withdrawal — the documented active/passive method. <strong>B</strong> is backwards — more-specifics on B would attract traffic TO the passive link (longest-prefix beats preference). <strong>C</strong> relies on MED comparison behavior that local-pref communities supersede and is not AWS's recommended control. <strong>D</strong> is a manual runbook masquerading as failover — human-latency recovery and guaranteed to be executed wrong at 3 a.m."
    },
    {
      q: "A company runs 6 Gbps of steady traffic over a 10 Gbps Direct Connect connection. They need a backup path that maintains at least 5 Gbps if Direct Connect fails, at the lowest cost. What should they implement?",
      options: [
        "A second Direct Connect connection at a different location",
        "Four or more BGP-based Site-to-Site VPN connections attached to a Transit Gateway with ECMP enabled, advertising the same prefixes as DX",
        "A single accelerated Site-to-Site VPN connection to the Transit Gateway",
        "A Site-to-Site VPN with both tunnels active on a virtual private gateway"
      ],
      answer: [1],
      multi: false,
      explanation: "Each IPsec tunnel caps near 1.25 Gbps, so 5 Gbps needs at least four tunnels ECMP'd — which requires BGP (equal-cost routes) and a TGW (VGW never ECMPs VPN). Same-prefix advertisement lets DX win while healthy (DX preferred over VPN at equal prefix length) and VPN absorb on failure. <strong>A</strong> meets bandwidth but is the expensive answer — the question says lowest cost with a 5 Gbps floor, which VPN ECMP satisfies. <strong>C</strong>: acceleration improves path consistency, not the per-tunnel crypto ceiling — still ~1.25 Gbps. <strong>D</strong>: a VGW gives at most one tunnel's effective throughput (no ECMP) — 1.25 Gbps, far under the floor."
    },
    {
      q: "Branch offices in Southeast Asia connect via Site-to-Site VPN to eu-west-1 and report highly variable latency and packet loss during peak hours. Bandwidth requirements are modest. What is the targeted fix?",
      options: [
        "Enable accelerated Site-to-Site VPN so tunnels terminate on Global Accelerator edge locations and traverse the AWS backbone",
        "Add more VPN tunnels with ECMP to increase bandwidth",
        "Move the tunnels to a virtual private gateway for lower latency",
        "Enable jumbo frames on the VPN connection"
      ],
      answer: [0],
      multi: false,
      explanation: "The pathology is internet-path quality over distance, not bandwidth: accelerated VPN ingests the tunnel at the nearest edge POP via anycast and rides the AWS backbone to the region, removing most of the variable public-internet path — precisely the jitter/loss medicine described (note it requires a TGW attachment). <strong>B</strong> adds capacity to a path whose problem is quality; ECMP does not fix loss or jitter. <strong>C</strong> is backwards — VGW termination forecloses acceleration (TGW-only) and changes nothing about the internet path. <strong>D</strong>: VPN does not support jumbo frames, and MTU is unrelated to peak-hour congestion."
    },
    {
      q: "A 200-account organization must let every VPC resolve on-premises DNS names, and let on-premises resolve records in private hosted zones owned by many accounts — with minimal infrastructure. Which THREE elements does the standard architecture include? (Select THREE.)",
      options: [
        "A single outbound Resolver endpoint in a central networking VPC, with forwarding rules for on-prem domains shared to all accounts via AWS RAM",
        "A single inbound Resolver endpoint in the central VPC, targeted by on-premises conditional forwarders",
        "Association of each account's private hosted zones with the central DNS VPC",
        "Outbound Resolver endpoints deployed in every VPC",
        "DHCP option sets in every VPC pointing at the on-premises DNS servers",
        "A public hosted zone mirroring the on-premises namespace"
      ],
      answer: [0, 1, 2],
      multi: true,
      explanation: "The central pattern: outbound endpoint + RAM-shared rules covers AWS-to-on-prem for every associated VPC with one endpoint pair (<strong>A</strong>); the inbound endpoint gives on-prem forwarders a target (<strong>B</strong>); and because an inbound endpoint answers with its host VPC's resolution view, every PHZ must be associated with that central VPC to be on-prem-visible (<strong>C</strong>) — the composition rule the whole design rests on. <strong>D</strong> is the anti-pattern the question's 'minimal infrastructure' excludes (~90 USD/month × 200+). <strong>E</strong> forfeits PHZs, endpoint private DNS, and VPC names — wholesale resolver replacement instead of conditional forwarding. <strong>F</strong> would publish internal names to the internet."
    },
    {
      q: "Company A acquired Company B; both use 10.0.0.0/16 extensively and renumbering is off the table. Company B's teams must consume a set of internal APIs hosted in Company A within weeks. What connectivity should be used?",
      options: [
        "AWS PrivateLink: Company A exposes the APIs as endpoint services behind NLBs; Company B creates interface endpoints in its VPCs",
        "VPC peering between the main VPCs with careful route table scoping",
        "A Transit Gateway with both companies' VPCs attached and non-overlapping route tables",
        "Site-to-Site VPN between the two AWS environments"
      ],
      answer: [0],
      multi: false,
      explanation: "Overlapping CIDRs make all routed connectivity unusable, and PrivateLink is immune by construction: the consumer reaches a local ENI IP in its own space, flows are NATed to the provider's NLB, no route ever references the overlapping ranges — and it exposes only the APIs, appropriate for an acquisition trust boundary. <strong>B</strong> fails at creation: peering rejects overlapping CIDRs outright — no route scoping rescues it. <strong>C</strong>: TGW route tables cannot disambiguate identical prefixes from different attachments in any usable way for this (absent private-NAT contortions the option doesn't describe). <strong>D</strong> is still routing — the overlapping prefixes are unroutable over VPN too."
    },
    {
      q: "A SaaS provider offers its data-plane API to hundreds of enterprise customers' VPCs via PrivateLink. Which TWO operational practices are specifically required or strongly advised on the provider side? (Select TWO.)",
      options: [
        "Deploy the fronting NLB in every Availability Zone of the region, reasoning about AZ IDs rather than AZ names",
        "Use the endpoint service's principal allow-list (and optionally manual acceptance) to gate which customer accounts can connect",
        "Peer with each customer VPC as a fallback path",
        "Require customers to disable private DNS on their endpoints",
        "Advertise the service prefixes to customers over BGP"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "Consumers can only place endpoints in AZs where the provider's NLB exists, matched by physical AZ ID (names are per-account shuffled) — full-AZ presence maximizes connectability and failover symmetry (<strong>A</strong>). The allow-list/acceptance workflow is the provider's security and commercial gate (<strong>B</strong>). <strong>C</strong> defeats PrivateLink's purpose and collides with customer CIDRs at scale. <strong>D</strong> is backwards — verified private DNS names improve the consumer experience. <strong>E</strong> confuses PrivateLink with routed connectivity; no BGP is involved anywhere in it."
    },
    {
      q: "An organization routes all spoke-VPC internet egress through a central egress VPC (NAT gateways + IGW) via Transit Gateway. Finance flags the design after a data-heavy analytics spoke starts pushing 200 TB/month to external endpoints. What is the accurate cost analysis?",
      options: [
        "Each egress gigabyte from the spoke pays both TGW data processing and NAT gateway data processing; for data-heavy spokes, a local NAT gateway in that VPC avoids the TGW toll and is likely cheaper",
        "Centralized egress is always cheaper because NAT gateway hourly costs are shared",
        "TGW data processing applies only to inter-region traffic, so the design is cost-neutral",
        "Moving the NAT gateways to the spoke's AZs inside the egress VPC eliminates the TGW charges"
      ],
      answer: [0],
      multi: false,
      explanation: "Centralized egress stacks two per-GB tolls: ~0.02 USD/GB TGW processing plus ~0.045 USD/GB NAT processing — at 200 TB/month the TGW component alone is ~4,000 USD that a spoke-local NAT gateway (33 USD/month floor) would eliminate; the correct architecture is hybrid — centralize low-volume spokes, localize data-heavy ones (or better, endpoint/exclude AWS-bound bulk traffic entirely). <strong>B</strong> is the dogma the numbers refute — hourly sharing saves tens of dollars while per-GB tolls cost thousands. <strong>C</strong> is false; TGW processing is charged on traffic through the TGW regardless of region. <strong>D</strong> misunderstands the billing dimension — the charge follows the TGW hop, not NAT placement."
    },
    {
      q: "A security team must guarantee that no two of the organization's 300 VPCs are ever created with overlapping CIDRs, that CIDR assignment is automated in IaC pipelines, and that utilization is auditable — with minimal custom tooling. What should be implemented?",
      options: [
        "Amazon VPC IPAM with org-wide delegated administration, hierarchical pools per region and environment, and IaC allocating VPC CIDRs from the pools",
        "An AWS Config rule that deletes VPCs with overlapping CIDRs after creation",
        "A DynamoDB table of allocated ranges checked by a custom Lambda in each pipeline",
        "Reliance on Transit Gateway route tables to reject overlapping propagations"
      ],
      answer: [0],
      multi: false,
      explanation: "This is IPAM's product definition: Organizations-integrated discovery, nested pools, allocation-time overlap prevention (the only cheap time to prevent overlap), utilization metrics and audit history — and IaC requests CIDRs from pools instead of hardcoding them. <strong>B</strong> is detection-then-destruction after the fact — deleting a provisioned VPC is not a governance strategy. <strong>C</strong> is exactly the custom tooling the question excludes, minus discovery, minus compliance reporting, plus a new consistency problem. <strong>D</strong> confuses symptoms with prevention: TGW does not reject overlaps usefully (it longest-prefix-routes among them, silently misdelivering) and says nothing about VPCs not yet attached."
    },
    {
      q: "A global enterprise operates in five regions and wants prod, dev, and shared-services segmentation enforced worldwide, automatic route distribution between regions, and network changes reviewed as declarative policy versions. Today they run per-region Transit Gateways with static peering routes. What should they adopt?",
      options: [
        "AWS Cloud WAN with a core network policy defining the three segments and per-region edges, migrating incrementally via TGW peering into the core network",
        "More Transit Gateway peering connections with a Lambda that syncs static routes between regions",
        "Route 53 Application Recovery Controller to manage inter-region routing",
        "A full mesh of inter-region VPC peering connections grouped by environment"
      ],
      answer: [0],
      multi: false,
      explanation: "The three requirements are Cloud WAN's feature list: segments as global policy objects, automatic route propagation across the managed inter-region core (removing the static-peering-routes pain named in the question), and versioned, reviewable declarative policy — with TGW interop enabling incremental migration. <strong>B</strong> is homemade Cloud WAN: a route-sync Lambda is the operational liability the managed service replaces. <strong>C</strong> is a different product entirely — ARC flips DNS-level failover switches, it does not route networks. <strong>D</strong> collapses under peering's non-transitivity and pair-count math across five regions, and 'grouped by environment' has no enforcement mechanism in peering."
    }
  ],
  flashcards: [
    { front: "TGW association vs propagation", back: "<strong>Association</strong> (1 per attachment): which route table is consulted for traffic FROM the attachment. <strong>Propagation</strong> (many): which tables receive the attachment's routes. Segmentation = asymmetric association/propagation; isolation = absence of routes." },
    { front: "Standard 3-table TGW segmentation design", back: "Prod table, dev table, shared table. Prod/dev associate to own tables and propagate only into shared; shared-services + hybrid attachments propagate into prod AND dev. Prod and dev never see each other's routes." },
    { front: "What does TGW appliance mode do and when is it mandatory?", back: "Replaces AZ-affinity with symmetric flow hashing so both directions of a flow use the same AZ (same stateful appliance). Mandatory on inspection-VPC attachments (GWLB/firewalls). Symptom without it: ~half of cross-AZ flows reset." },
    { front: "TGW inter-region peering routing caveat", back: "<strong>Static routes only — no propagation across a peering.</strong> New remote prefixes are invisible until manually added. Cloud WAN's managed core removes exactly this pain." },
    { front: "TGW Connect: what, why, numbers", back: "GRE tunnels + BGP over an existing VPC/DX attachment for SD-WAN appliances. <strong>5 Gbps per GRE tunnel, 4 Connect peers per attachment = 20 Gbps</strong> with ECMP — beats VPN's 1.25 Gbps crypto ceiling because GRE isn't encrypted." },
    { front: "Key TGW quotas and pricing shape", back: "5,000 attachments; 10,000 routes/table; up to 100 Gbps per VPC attachment; 1,000 BGP routes accepted per VPN/Connect peer (excess dropped — summarize). ~0.05 USD/attachment-hr + ~0.02 USD/GB processed." },
    { front: "Dedicated vs hosted Direct Connect", back: "Dedicated: whole port (1/10/100/400G), up to 50 private/public VIFs. Hosted: partner-sold slice (50 Mbps-10 Gbps), <strong>exactly 1 VIF</strong>, shared partner port. Multiple VIFs needed → dedicated." },
    { front: "The three DX VIF types", back: "<strong>Private VIF</strong> → VGW/DXGW → VPC private space. <strong>Public VIF</strong> → all AWS public IPs, all regions (S3, EIPs; also the substrate for VPN-over-DX). <strong>Transit VIF</strong> → DXGW → Transit Gateways." },
    { front: "DX Gateway: capabilities and the hard rule", back: "Global, free; one private VIF → up to <strong>10 VGWs</strong>, one transit VIF → <strong>3 TGWs</strong> (default), any regions. Hard rule: DXGW is NOT a router between its associations — no VPC-to-VPC or TGW-to-TGW transit through it." },
    { front: "Why doesn't a LAG improve DX resiliency?", back: "Up to 4 same-speed links, but all at ONE location on the same AWS device pair — one facility event kills the LAG. LAG = bandwidth; resiliency = second location. Use minimum-links to force clean failover." },
    { front: "DX resiliency models and SLAs", back: "<strong>99.99%:</strong> 2 connections × 2 locations (maximum). <strong>99.9%:</strong> 1 connection × 2 locations (high). Dev/test: 2 conns 1 location, or single connection — no SLA." },
    { front: "AWS BGP communities on DX — both families", back: "Local-pref (you tag, private/transit VIF): <strong>7224:7100 low / 7200 med / 7300 high</strong> — active/passive control. Scope (AWS tags, public VIF): <strong>7224:9100 region / 9200 continent / 9300 global</strong> — filter AWS's advertisements." },
    { front: "The DX 20-prefix rule", back: "Advertise more than ~20 prefixes on a VIF BGP session (or exceed allowed-prefixes on a DXGW association) and the session goes <strong>DOWN</strong> — not filtered, down. Summarize and prefix-filter at your edge; it's an availability control." },
    { front: "MACsec vs IPsec-over-public-VIF for encrypting DX", back: "<strong>MACsec:</strong> line-rate L2 crypto, dedicated 10/100/400G at supported locations, hop-by-hop (last mile only). <strong>IPsec over public VIF:</strong> works on any DX, end-to-end, but caps at ~1.25 Gbps/tunnel. Double-digit Gbps + encryption → MACsec." },
    { front: "Why does one IPsec tunnel cap at ~1.25 Gbps?", back: "Per-tunnel/SA serialized crypto processing — a compute bound, not link speed (also ~140k PPS; small packets hit the PPS wall first). Scale with ECMP across tunnels: requires <strong>BGP + Transit Gateway</strong> (VGW never ECMPs; static routing never ECMPs)." },
    { front: "Accelerated Site-to-Site VPN", back: "Tunnels terminate on <strong>Global Accelerator anycast IPs</strong> — enter AWS backbone at the nearest POP. Fixes internet jitter/loss for distant sites; does NOT raise the 1.25 Gbps tunnel cap. <strong>TGW attachments only.</strong>" },
    { front: "DX vs VPN route preference — and its exception", back: "For the SAME prefix, DX-learned routes beat VPN-learned at the VGW/TGW. But <strong>longest prefix match beats path preference</strong> — a more-specific advertised over VPN steals traffic from DX. Advertise identical prefixes on both paths." },
    { front: "Central hybrid-DNS pattern in one breath", back: "One networking VPC: outbound endpoint + rules <strong>shared org-wide via RAM</strong> (AWS→on-prem); inbound endpoint targeted by on-prem forwarders, answering with the union of <strong>PHZs associated to that VPC</strong> (on-prem→AWS). Spokes need rule associations only." },
    { front: "Why must every PHZ be associated with the central DNS VPC?", back: "An inbound endpoint answers with the <strong>resolution view of its host VPC</strong> — PHZ associations + rules + public recursion. Unassociated zones are invisible to on-prem even though cloud workloads resolve them fine." },
    { front: "The catch-all forwarding rule anti-pattern", back: "A '.' rule forwarding ALL queries on-prem makes on-prem DNS + the DX/VPN path a hard dependency of every AWS lookup — one link maintenance = org-wide resolution outage. Forward only domains on-prem authoritatively owns." },
    { front: "PrivateLink vs peering vs TGW — three-line decision", back: "<strong>Overlapping CIDRs or expose-one-service-only → PrivateLink.</strong> <strong>Many-to-many networks, hybrid, shared services → TGW.</strong> <strong>Two VPCs, chatty, cost-sensitive → peering</strong> (no hourly, no TGW per-GB toll)." },
    { front: "PrivateLink provider-side essentials", back: "NLB-fronted endpoint service; principal <strong>allow-list + optional acceptance</strong> as the gate; deploy NLB in every AZ and reason in <strong>AZ IDs</strong> (names shuffle per account); proxy protocol v2 for consumer identity; strictly consumer-initiated (unidirectional)." },
    { front: "GWLB in three properties", back: "<strong>GENEVE (UDP 6081)</strong> encapsulation to appliance targets — transparent (original packet preserved), <strong>flow-sticky</strong> (5-tuple hash pins flows to one appliance), inserted via <strong>GWLB endpoints as route-table targets</strong> — inspection becomes a routing decision." },
    { front: "Centralized egress cost equation", back: "Every egress GB pays TGW processing (~0.02) + NAT processing (~0.045). Low-volume spokes: centralize (share NAT hourly floors). Data-heavy spokes: local NAT wins — the TGW toll alone is ~20 USD/TB. Hybrid designs are the norm." },
    { front: "Cloud WAN vs Transit Gateway", back: "Cloud WAN: global core network, <strong>declarative policy</strong> (segments = global VRFs), automatic inter-region propagation, versioned changes. TGW: regional, imperative, static inter-region peering routes, deeper features (appliance mode). Interoperate via peering; multi-region + segmentation-heavy → Cloud WAN." },
    { front: "IPAM's two highest-value functions", back: "<strong>Allocation-time overlap prevention</strong> (IaC requests CIDRs from hierarchical org pools — prevention at the only cheap moment) and org-wide <strong>discovery/audit/utilization alerting</strong>. Also manages BYOIP/BYOIPv6. Priced per active IP managed." }
  ],
  lab: {
    title: "Lab: Transit Gateway segmentation — build isolation you can measure",
    html: `
<h3>Goal</h3>
<p>Build a TGW with two spoke VPCs and prove segmentation mechanics end to end: with default route tables the spokes reach each other; after moving to explicit association/propagation tables, isolation appears without touching a single security group. You will read the TGW route tables at each step so the association/propagation model becomes muscle memory. Cost: TGW ~0.05 USD/hr + 2 attachments ~0.10 USD/hr + two t3.micro instances — under 0.50 USD for a one-hour run. Everything is torn down at the end.</p>

<h3>Architecture</h3>
<p>VPC A (10.101.0.0/16) and VPC B (10.102.0.0/16), one public subnet each so instances get SSM connectivity over the internet (keeping the lab small — no endpoints needed), one t3.micro in each. A TGW connects them; test traffic (ICMP) flows privately over the TGW while management rides SSM. Phase 1 uses the TGW default table (full reachability); phase 2 disables defaults' effect by moving both attachments to isolated custom tables.</p>

<h3>Steps</h3>
<ol>
<li><p>Create both VPCs, subnets, IGWs, and routes (loop for brevity; capture IDs):</p>
<pre><code>export AWS_REGION=us-east-1
for i in 101 102; do
  VPC=$(aws ec2 create-vpc --cidr-block 10.$i.0.0/16 \
    --query Vpc.VpcId --output text)
  aws ec2 modify-vpc-attribute --vpc-id $VPC --enable-dns-hostnames
  SUB=$(aws ec2 create-subnet --vpc-id $VPC --cidr-block 10.$i.1.0/24 \
    --availability-zone "$AWS_REGION"a --query Subnet.SubnetId --output text)
  IGW=$(aws ec2 create-internet-gateway \
    --query InternetGateway.InternetGatewayId --output text)
  aws ec2 attach-internet-gateway --internet-gateway-id $IGW --vpc-id $VPC
  RTB=$(aws ec2 create-route-table --vpc-id $VPC \
    --query RouteTable.RouteTableId --output text)
  aws ec2 create-route --route-table-id $RTB \
    --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW
  aws ec2 associate-route-table --route-table-id $RTB --subnet-id $SUB
  echo "VPC$i: vpc=$VPC subnet=$SUB rtb=$RTB"
done</code></pre>
<p>Record the printed IDs as VPCA/SUBA/RTBA and VPCB/SUBB/RTBB.</p></li>

<li><p>Create the TGW with defaults ON (phase 1 shows why real deployments turn them off):</p>
<pre><code>TGW=$(aws ec2 create-transit-gateway \
  --options DefaultRouteTableAssociation=enable,DefaultRouteTablePropagation=enable \
  --query TransitGateway.TransitGatewayId --output text)
aws ec2 wait transit-gateway-available --transit-gateway-ids $TGW 2>/dev/null || sleep 120</code></pre></li>

<li><p>Attach both VPCs and add VPC-layer routes toward the TGW (remember: two routing layers — this is the VPC layer):</p>
<pre><code>ATTA=$(aws ec2 create-transit-gateway-vpc-attachment --transit-gateway-id $TGW \
  --vpc-id $VPCA --subnet-ids $SUBA \
  --query TransitGatewayVpcAttachment.TransitGatewayAttachmentId --output text)
ATTB=$(aws ec2 create-transit-gateway-vpc-attachment --transit-gateway-id $TGW \
  --vpc-id $VPCB --subnet-ids $SUBB \
  --query TransitGatewayVpcAttachment.TransitGatewayAttachmentId --output text)
sleep 90   # attachments -> available
aws ec2 create-route --route-table-id $RTBA \
  --destination-cidr-block 10.102.0.0/16 --transit-gateway-id $TGW
aws ec2 create-route --route-table-id $RTBB \
  --destination-cidr-block 10.101.0.0/16 --transit-gateway-id $TGW</code></pre></li>

<li><p>Launch one instance per VPC (SSM role from the module-3 lab pattern; ICMP allowed from the other VPC's CIDR):</p>
<pre><code>AMI=$(aws ssm get-parameter \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query Parameter.Value --output text)
# create sg per vpc allowing ICMP from 10.0.0.0/8
SGA=$(aws ec2 create-security-group --group-name tgw-lab-a --description icmp \
  --vpc-id $VPCA --query GroupId --output text)
SGB=$(aws ec2 create-security-group --group-name tgw-lab-b --description icmp \
  --vpc-id $VPCB --query GroupId --output text)
for SG in $SGA $SGB; do aws ec2 authorize-security-group-ingress \
  --group-id $SG --protocol icmp --port -1 --cidr 10.0.0.0/8; done
IA=$(aws ec2 run-instances --image-id $AMI --instance-type t3.micro \
  --subnet-id $SUBA --associate-public-ip-address --security-group-ids $SGA \
  --iam-instance-profile Name=ssm-lab-profile \
  --query 'Instances[0].InstanceId' --output text)
IB=$(aws ec2 run-instances --image-id $AMI --instance-type t3.micro \
  --subnet-id $SUBB --associate-public-ip-address --security-group-ids $SGB \
  --iam-instance-profile Name=ssm-lab-profile \
  --query 'Instances[0].InstanceId' --output text)</code></pre>
<p>(Recreate the ssm-lab-profile from the VPC module lab if you tore it down.)</p></li>

<li><p><strong>Phase 1 — observe default full connectivity.</strong> Get B's private IP, open a session to A, and ping across the TGW:</p>
<pre><code>IPB=$(aws ec2 describe-instances --instance-ids $IB \
  --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text)
aws ssm start-session --target $IA
# in-session:
ping -c 3 &lt;IPB&gt;     # succeeds: default table associated+propagated both attachments</code></pre>
<p>Inspect why it works — read the default TGW route table and see BOTH VPC CIDRs propagated:</p>
<pre><code>DEFRT=$(aws ec2 describe-transit-gateways --transit-gateway-ids $TGW \
  --query 'TransitGateways[0].Options.AssociationDefaultRouteTableId' --output text)
aws ec2 search-transit-gateway-routes --transit-gateway-route-table-id $DEFRT \
  --filters Name=state,Values=active</code></pre></li>

<li><p><strong>Phase 2 — segment.</strong> Create two isolated route tables; associate each attachment with its own, propagating NOTHING into either (full isolation — in a real design shared-services would propagate here):</p>
<pre><code>RTA=$(aws ec2 create-transit-gateway-route-table --transit-gateway-id $TGW \
  --query TransitGatewayRouteTable.TransitGatewayRouteTableId --output text)
RTB2=$(aws ec2 create-transit-gateway-route-table --transit-gateway-id $TGW \
  --query TransitGatewayRouteTable.TransitGatewayRouteTableId --output text)
aws ec2 disassociate-transit-gateway-route-table \
  --transit-gateway-route-table-id $DEFRT --transit-gateway-attachment-id $ATTA
aws ec2 disassociate-transit-gateway-route-table \
  --transit-gateway-route-table-id $DEFRT --transit-gateway-attachment-id $ATTB
sleep 30
aws ec2 associate-transit-gateway-route-table \
  --transit-gateway-route-table-id $RTA --transit-gateway-attachment-id $ATTA
aws ec2 associate-transit-gateway-route-table \
  --transit-gateway-route-table-id $RTB2 --transit-gateway-attachment-id $ATTB</code></pre></li>
</ol>

<h3>Verify</h3>
<ol>
<li><p>Repeat the ping from A to B's private IP: it now <strong>times out</strong>. Nothing changed in either VPC — no SG edits, no NACLs, no VPC route changes. The TGW table consulted for A's traffic simply contains no route to 10.102.0.0/16. Isolation by absence of routes.</p></li>
<li><p>Prove it with the API — A's new table is empty:</p>
<pre><code>aws ec2 search-transit-gateway-routes --transit-gateway-route-table-id $RTA \
  --filters Name=state,Values=active</code></pre></li>
<li><p>Optional: restore reachability the explicit way — propagate B's attachment into A's table and vice versa (<code>aws ec2 enable-transit-gateway-route-table-propagation --transit-gateway-route-table-id $RTA --transit-gateway-attachment-id $ATTB</code>, and mirrored), re-ping, then run <code>search-transit-gateway-routes</code> again and watch the propagated route appear. You have now performed, by hand, exactly what the three-table enterprise design automates.</p></li>
</ol>

<h3>Teardown</h3>
<p>Strictly ordered — attachments block TGW deletion; ENIs block subnet deletion. The TGW and attachments are the meaningful billers: do not skip this.</p>
<ol>
<li><pre><code>aws ec2 terminate-instances --instance-ids $IA $IB
aws ec2 wait instance-terminated --instance-ids $IA $IB</code></pre></li>
<li><pre><code>aws ec2 delete-transit-gateway-vpc-attachment --transit-gateway-attachment-id $ATTA
aws ec2 delete-transit-gateway-vpc-attachment --transit-gateway-attachment-id $ATTB
sleep 90   # attachments must reach 'deleted'
aws ec2 delete-transit-gateway-route-table --transit-gateway-route-table-id $RTA
aws ec2 delete-transit-gateway-route-table --transit-gateway-route-table-id $RTB2
aws ec2 delete-transit-gateway --transit-gateway-id $TGW</code></pre></li>
<li><p>Per VPC (A then B): delete security group, detach and delete the IGW, delete subnet, route table, and VPC:</p>
<pre><code>aws ec2 delete-security-group --group-id $SGA
aws ec2 detach-internet-gateway --internet-gateway-id $IGWA --vpc-id $VPCA
aws ec2 delete-internet-gateway --internet-gateway-id $IGWA
aws ec2 delete-subnet --subnet-id $SUBA
aws ec2 delete-route-table --route-table-id $RTBA
aws ec2 delete-vpc --vpc-id $VPCA
# repeat with the B-side IDs</code></pre></li>
<li><p>Confirm the billing surfaces are gone: <code>aws ec2 describe-transit-gateways --query 'TransitGateways[?State!=deleted].TransitGatewayId'</code> using a backslash-quoted <code>deleted</code> string per your shell, and <code>aws ec2 describe-instances --filters Name=instance-state-name,Values=running</code> should show neither lab instance. If you recreated ssm-lab-profile for this lab, remove it as in the VPC module teardown.</p></li>
</ol>
`
  }
});
