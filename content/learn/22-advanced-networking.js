window.COURSE.registerLearn({
  moduleId: "adv-networking",
  bigPicture: "This module is about wiring hundreds of VPCs and an on-premises data centre into one network that is fast, private and safe. The main tools are <strong>Transit Gateway</strong> (the central hub), <strong>Direct Connect</strong> and <strong>VPN</strong> (the links to your office or data centre), <strong>PrivateLink</strong> (share one service without joining networks), and central DNS and firewalls. SAP-C02 tests it with numbers and constraints: bandwidth maths, uptime SLAs, overlapping IP ranges. The right answer is whichever design satisfies every constraint in the question.",
  cheatsheet: [
    { k: "Prod and dev VPCs must not talk, but both reach shared services", v: "<strong>Separate TGW route tables</strong> (association/propagation) — isolation by missing routes" },
    { k: "Stateful firewalls drop cross-AZ return traffic", v: "Turn on <strong>appliance mode</strong> on the inspection VPC's TGW attachment" },
    { k: "SD-WAN appliance, dynamic routing, more than VPN bandwidth", v: "<strong>TGW Connect</strong> (GRE + BGP, 5 Gbps per tunnel)" },
    { k: "Routes missing between TGWs in two regions", v: "<strong>TGW peering is static-only</strong> — add static routes (or use Cloud WAN)" },
    { k: "On-prem to many VPCs across regions over DX", v: "<strong>Transit VIF → DX Gateway → Transit Gateways</strong>" },
    { k: "Reach S3/DynamoDB public endpoints over DX", v: "<strong>Public VIF</strong>" },
    { k: "Encrypt DX at 10/100 Gbps line rate", v: "<strong>MACsec</strong> on a dedicated connection (hop-by-hop)" },
    { k: "Encrypt DX end to end, any connection type", v: "<strong>IPsec VPN over a public VIF</strong>" },
    { k: "99.99% DX SLA", v: "<strong>Maximum resiliency</strong>: 2 connections at each of 2 locations" },
    { k: "99.9% DX SLA", v: "<strong>High resiliency</strong>: 1 connection at each of 2 locations" },
    { k: "More VPN bandwidth than one tunnel (1.25 Gbps)", v: "<strong>TGW + BGP VPN + ECMP</strong> across many tunnels — never static, never VGW" },
    { k: "Branch VPN latency/jitter varies over the internet", v: "<strong>Accelerated Site-to-Site VPN</strong> (needs a Transit Gateway)" },
    { k: "DX primary, VPN backup, deterministically", v: "Advertise the <strong>same prefixes</strong> on both — DX wins; never more-specifics on VPN" },
    { k: "Hundreds of accounts must resolve on-prem names", v: "Central <strong>outbound Resolver endpoint</strong> + rules shared by <strong>RAM</strong>" },
    { k: "On-prem must resolve private hosted zones in many accounts", v: "Associate all PHZs with the <strong>DNS VPC</strong> hosting the inbound endpoint" },
    { k: "Overlapping CIDRs, or expose only one service", v: "<strong>PrivateLink</strong> (NLB + endpoint service)" },
    { k: "Inspect traffic between VPCs with third-party appliances, scale out", v: "<strong>Gateway Load Balancer</strong> + GWLB endpoints in an inspection VPC on the TGW" },
    { k: "Prevent overlapping CIDRs across hundreds of accounts", v: "<strong>VPC IPAM</strong> with org-wide pools" },
    { k: "Global network, many regions, segments, minimal routing admin", v: "<strong>AWS Cloud WAN</strong>" }
  ],
  lessons: {
    "tgw-deep": {
      minutes: 5,
      tldr: [
        "<strong>Association</strong>: each attachment uses exactly one TGW route table to decide where its traffic goes.",
        "<strong>Propagation</strong>: an attachment's routes are copied into one or more tables — deciding who can reach it.",
        "Segmentation = leaving routes out. Prod and dev tables both see shared services, never each other.",
        "<strong>Appliance mode</strong> keeps both directions of a flow on the same firewall. <strong>Peering</strong> between TGWs is static-only.",
        "Routing has two layers: VPC route tables send traffic to the TGW, TGW tables decide what happens next."
      ],
      analogy: "A Transit Gateway is a big airport. Each airline (attachment) checks in at one terminal (association) that decides where its passengers can fly. Propagation is putting the airline's destinations on other terminals' departure boards. Leave a destination off a board and nobody from that terminal can go there.",
      examTip: "“Prod and dev must not communicate but both reach shared services” = <strong>TGW route-table design</strong>, not security groups. “Stateful appliances see asymmetric traffic” = <strong>appliance mode</strong>. “Routes not appearing across regions” = peering doesn't propagate.",
      terms: [
        { t: "Association", d: "Which single TGW route table an attachment uses for its outgoing traffic." },
        { t: "Propagation", d: "Automatically installing an attachment's routes into TGW route tables." },
        { t: "Blackhole route", d: "A TGW route that deliberately drops matching traffic." },
        { t: "Appliance mode", d: "Attachment setting that keeps a flow's two directions in the same AZ, on the same appliance." },
        { t: "TGW Connect", d: "GRE tunnels with BGP for SD-WAN appliances: 5 Gbps per tunnel, 4 peers per attachment." }
      ],
      check: [
        {
          q: "Two TGWs in different regions are peered. A new VPC in region B can't be reached from region A. Why?",
          options: ["Peering needs Direct Connect", "Routes don't propagate across TGW peering; add a static route", "Region B's route table is full"],
          answer: 1,
          why: "Peering attachments are static-only. Each remote prefix needs a manual static entry — the pain Cloud WAN removes."
        },
        {
          q: "Firewalls in an inspection VPC work in testing but drop about half the connections in production. What's the likely fix?",
          options: ["Add more firewalls", "Enable appliance mode on the inspection VPC attachment", "Use VPC peering instead"],
          answer: 1,
          why: "Without appliance mode, return traffic can come back through another AZ and hit a firewall with no record of the flow."
        }
      ]
    },
    "dx-foundations": {
      minutes: 5,
      tldr: [
        "<strong>Direct Connect (DX)</strong> is a private physical cable into AWS: no internet, BGP routing, weeks to set up.",
        "<strong>Dedicated</strong> = your own port (1/10/100/400 Gbps, 50 VIFs). <strong>Hosted</strong> = a partner's slice, just <strong>1 VIF</strong>.",
        "Three VIFs: <strong>private</strong> (VPCs), <strong>public</strong> (AWS public endpoints like S3), <strong>transit</strong> (Transit Gateways).",
        "<strong>DX Gateway</strong> is global and lets one link reach VPCs/TGWs in many regions — but it never routes between them.",
        "<strong>LAG</strong> bundles links at one site for bandwidth, not resilience. <strong>MACsec</strong> encrypts the link at line rate."
      ],
      analogy: "DX is a private road from your building to AWS's. The VIFs are lanes painted on that road: one lane to your private VPC estate, one to AWS's public shops, one to the big interchange (Transit Gateway). The DX Gateway is a roundabout at the end that reaches any region — but cars can't use it to drive from one VPC to another.",
      examTip: "Match the VIF to the destination: VPC private IPs = <strong>private VIF</strong>, S3/public endpoints = <strong>public VIF</strong>, many VPCs via TGW = <strong>transit VIF + DXGW</strong>. “Need multiple VIFs” rules out a hosted connection.",
      terms: [
        { t: "VIF", d: "Virtual interface: a VLAN plus BGP session on a DX connection." },
        { t: "DX Gateway (DXGW)", d: "Free, global object linking DX to VGWs or TGWs in any region." },
        { t: "LAG", d: "Link Aggregation Group: up to 4 same-speed links at one location bundled as one." },
        { t: "MACsec", d: "Layer-2 encryption on dedicated DX links, line-rate, only on the last hop." },
        { t: "Prefix limit", d: "Advertise too many routes to AWS on a VIF (100 by default) and the BGP session goes down." }
      ],
      check: [
        {
          q: "On-prem servers must reach S3 over Direct Connect instead of the internet. Which VIF?",
          options: ["Private VIF", "Public VIF", "Transit VIF"],
          answer: 1,
          why: "S3's public endpoints are AWS public IPs, reached with a public VIF. Private VIFs only reach VPC private addresses."
        },
        {
          q: "Two VPCs are associated with the same DX Gateway. Can they talk to each other through it?",
          options: ["Yes, DXGW routes between associations", "No, DXGW only connects on-prem to AWS", "Only if they're in the same region"],
          answer: 1,
          why: "A DX Gateway is not a router between its associations. VPC-to-VPC traffic still needs TGW or peering."
        }
      ]
    },
    "dx-resiliency": {
      minutes: 5,
      tldr: [
        "The SLA follows the design: <strong>99.99%</strong> = 2 connections at each of 2 locations; <strong>99.9%</strong> = 1 at each of 2 locations.",
        "Steer traffic with BGP: <strong>local-preference communities</strong> 7224:7100 (low) to 7224:7300 (high) for active/passive.",
        "Same prefix length: <strong>DX beats VPN</strong>. But a more specific prefix always wins, whatever the path.",
        "A VPN tunnel carries about <strong>1.25 Gbps</strong>; to back up a big DX you need many tunnels with ECMP on a TGW.",
        "Real failovers fail on slow BGP timers (use <strong>BFD</strong>) and MTU mismatches."
      ],
      analogy: "One DX connection is a single bridge into town. Two bridges from the same riverbank (one location) survive a broken bridge but not a flood on that bank. Two bridges from two different banks survive the flood too — and that's what the higher SLA pays for.",
      examTip: "SLA questions: <strong>99.99% → maximum resiliency (2×2)</strong>, <strong>99.9% → high resiliency (2 locations × 1)</strong>. A LAG never upgrades resiliency. “Static routing” or “VGW” in a VPN-backup question kills any ECMP answer.",
      terms: [
        { t: "Maximum resiliency", d: "Four DX connections across two locations; the 99.99% SLA design." },
        { t: "Local preference community", d: "BGP tag (7224:7100/7200/7300) telling AWS which DX path to prefer." },
        { t: "Scope community", d: "7224:9100/9200/9300 tags limiting public VIF routes to region, continent or global." },
        { t: "ECMP", d: "Equal-cost multi-path: spreading traffic over several equal routes, e.g. VPN tunnels." },
        { t: "BFD", d: "Fast link-failure detection for BGP, so failover takes under a second instead of 90." }
      ],
      check: [
        {
          q: "A company needs a 99.99% Direct Connect SLA. What topology?",
          options: ["A 4-link LAG at one location", "One connection at each of two locations", "Two connections at each of two locations"],
          answer: 2,
          why: "99.99% requires maximum resiliency: two locations, two devices each. A LAG is one location, so one flood takes it out."
        },
        {
          q: "DX is primary and VPN is backup. The team advertises /24s over VPN and a /16 over DX. What happens?",
          options: ["DX carries traffic because DX is preferred", "The VPN carries traffic because longer prefixes win", "Traffic is split evenly"],
          answer: 1,
          why: "Longest prefix match beats path preference. Advertise identical prefixes on both paths so DX wins while healthy."
        }
      ]
    },
    "s2s-vpn": {
      minutes: 5,
      tldr: [
        "A VPN connection = <strong>two IPsec tunnels</strong> to two AWS endpoints in different AZs. Minutes to set up, runs over the internet.",
        "Use <strong>BGP (dynamic)</strong> whenever the device supports it: real failover, route propagation, ECMP. Static = no ECMP, ever.",
        "Terminate on a <strong>Transit Gateway</strong> for ECMP and acceleration; a VGW serves one VPC and caps at one tunnel's speed.",
        "<strong>Accelerated VPN</strong> enters AWS at the nearest edge via Global Accelerator: fixes jitter, not bandwidth. TGW only.",
        "VPN over a <strong>public VIF</strong> = encrypted traffic on the private DX path."
      ],
      analogy: "A standard VPN is driving to AWS on public roads in an armoured car. Accelerated VPN drives you to the nearest AWS on-ramp, then you ride AWS's private motorway the rest of the way — smoother, but the car is no bigger.",
      examTip: "“Office VPN performance varies by time of day” = <strong>Accelerated VPN</strong> (and it needs a TGW). “Need more than 1.25 Gbps over VPN” = <strong>TGW + BGP + ECMP</strong>. Newer: TGW/Cloud WAN VPNs can use <strong>5 Gbps large-bandwidth tunnels</strong>, but classic exam questions assume 1.25.",
      terms: [
        { t: "Customer gateway (CGW)", d: "The AWS object representing your on-prem VPN device." },
        { t: "Virtual private gateway (VGW)", d: "VPN endpoint attached to a single VPC. No ECMP, no acceleration." },
        { t: "Dynamic (BGP) VPN", d: "Routes are exchanged automatically; required for ECMP and clean failover." },
        { t: "Accelerated VPN", d: "Tunnels terminate on Global Accelerator anycast IPs for a steadier path." },
        { t: "MSS clamping", d: "Shrinking TCP segment size on the edge so VPN packets don't get too big and stall." }
      ],
      check: [
        {
          q: "A VPN on a VGW uses static routing. The team wants 4 Gbps by adding tunnels. Will it work?",
          options: ["Yes, add four connections", "No: ECMP needs BGP and a Transit Gateway", "Yes, if acceleration is on"],
          answer: 1,
          why: "Static routing and VGWs both rule out ECMP. You need dynamic VPNs on a TGW to add tunnel bandwidth together."
        },
        {
          q: "Small requests over the VPN work, but large file transfers hang. Most likely cause?",
          options: ["MTU/MSS mismatch — packets too big for the tunnel", "Tunnel bandwidth limit", "BGP route limit exceeded"],
          answer: 0,
          why: "IPsec overhead shrinks the usable packet size. Without MSS clamping, full-size segments get dropped and bulk transfers stall."
        }
      ]
    },
    "hybrid-dns-scale": {
      minutes: 5,
      tldr: [
        "Don't put Resolver endpoints in every VPC. Put <strong>one inbound + one outbound endpoint</strong> in a central DNS VPC.",
        "<strong>Outbound</strong>: forwarding rules for on-prem domains are shared via <strong>RAM</strong>; every VPC just associates them.",
        "<strong>Inbound</strong>: on-prem forwards to the inbound endpoint, which answers for every <strong>PHZ associated with the DNS VPC</strong>.",
        "Never forward everything (“.”) to on-prem — it makes all AWS DNS depend on your data centre.",
        "Resolver endpoints and rules are regional; repeat the pattern per major region."
      ],
      analogy: "The central DNS VPC is a company switchboard. Outgoing calls to head office go through one operator (outbound endpoint) using a shared phone book (RAM-shared rules). Incoming calls from head office land at one reception desk (inbound endpoint), which can only put you through to departments listed in its directory (PHZs associated with its VPC).",
      examTip: "“Hundreds of accounts must resolve on-prem names with minimal infrastructure” = <strong>central outbound endpoint + RAM-shared rules</strong>. On-prem can't query the VPC's .2 resolver directly — it needs the <strong>inbound endpoint</strong>.",
      terms: [
        { t: "Inbound endpoint", d: "Resolver IPs in your VPC that on-prem DNS can forward queries to." },
        { t: "Outbound endpoint", d: "Resolver IPs that send AWS queries out to on-prem DNS servers." },
        { t: "Forwarding rule", d: "“Send queries for this domain to these DNS servers.” Shareable via RAM." },
        { t: "System rule", d: "An exception that keeps a subdomain resolving inside AWS." },
        { t: "Private hosted zone", d: "Private DNS zone; only VPCs associated with it can resolve its names." }
      ],
      check: [
        {
          q: "A new team's private hosted zone resolves fine inside AWS but not from on-prem. What's missing?",
          options: ["A new inbound endpoint for that team", "The PHZ isn't associated with the central DNS VPC", "An outbound rule for the zone"],
          answer: 1,
          why: "The inbound endpoint answers with whatever its own VPC can see. Associate the PHZ with the DNS VPC."
        },
        {
          q: "Why is a catch-all “.” forwarding rule to on-prem a bad idea?",
          options: ["It costs more per query", "Every AWS DNS lookup then depends on on-prem DNS and the hybrid link", "RAM can't share it"],
          answer: 1,
          why: "If DX or on-prem DNS is down, all resolution breaks — even for S3. Only forward domains on-prem actually owns."
        }
      ]
    },
    "privatelink-scale": {
      minutes: 5,
      tldr: [
        "<strong>PrivateLink</strong> puts one service into another VPC as a local IP. It doesn't join the networks.",
        "Provider side: <strong>NLB</strong> + endpoint service, with allow-lists and optional manual acceptance.",
        "Overlapping CIDRs don't matter, and consumers can reach only that one service. It is <strong>one-way</strong>.",
        "Match AZs by <strong>AZ ID</strong>: consumers can only place endpoints where the provider's NLB lives.",
        "Pick: peering for two chatty VPCs, TGW for many-to-many, PrivateLink for a single service or overlap."
      ],
      analogy: "Peering or TGW is knocking down the wall between two offices. PrivateLink is installing a service hatch in the wall: the other side can order through it, but can't walk into your office, and it doesn't matter that both offices use the same room numbers.",
      examTip: "<strong>Overlapping CIDRs</strong> anywhere in the question → PrivateLink; every routed option is a trap. “Provider must call back to the consumer” rules PrivateLink out, because it's one-way.",
      terms: [
        { t: "Endpoint service", d: "The provider's PrivateLink service, fronted by an NLB (or GWLB)." },
        { t: "Interface endpoint", d: "Consumer-side ENI with a local IP that reaches the provider's service." },
        { t: "Proxy protocol v2", d: "Lets the provider see which consumer endpoint a connection came from." },
        { t: "Endpoint policy", d: "Policy on an endpoint limiting what it can be used for — your anti-exfiltration control." },
        { t: "AZ ID", d: "Physical zone ID (use1-az1) that matches across accounts, unlike AZ names." }
      ],
      check: [
        {
          q: "After an acquisition, both companies use 10.0.0.0/16. One company's API must be consumed by the other. Best option?",
          options: ["VPC peering with specific routes", "Transit Gateway with separate route tables", "PrivateLink endpoint service behind an NLB"],
          answer: 2,
          why: "PrivateLink gives the consumer a local IP, so overlap is irrelevant. Peering refuses overlapping CIDRs outright."
        },
        {
          q: "An app requires the server to open connections back to the client. Why is PrivateLink a poor fit?",
          options: ["It only supports HTTP", "Only the consumer can start connections", "It can't cross accounts"],
          answer: 1,
          why: "PrivateLink is one-way: consumer to provider. Server-initiated callbacks need routed connectivity like TGW or peering."
        }
      ]
    },
    "central-inspection": {
      minutes: 5,
      tldr: [
        "<strong>Gateway Load Balancer (GWLB)</strong> spreads traffic across firewall appliances, wrapping packets in GENEVE (UDP 6081).",
        "<strong>GWLB endpoints</strong> are route targets, so adding inspection is just a routing change.",
        "East-west/egress: spokes route to an inspection VPC on the TGW; use two TGW tables and <strong>appliance mode ON</strong>.",
        "<strong>Centralised egress</strong>: one NAT hub for all spokes. Cheaper for small spokes; costly for data-heavy ones (TGW + NAT fees).",
        "Inspect inbound before the load balancer with <strong>IGW ingress routing</strong> to a GWLB endpoint."
      ],
      analogy: "GWLB is an airport security line with many scanners. Each traveller (flow) is sent to one scanner and must come back through that same scanner, so the bag check stays consistent. You can add scanners without changing the terminal layout.",
      examTip: "“Inspect all traffic between VPCs with third-party appliances, scale horizontally” = <strong>GWLB + GWLBe in a central inspection VPC via TGW, appliance mode on</strong>. AWS Network Firewall questions use the same routing shapes.",
      terms: [
        { t: "Gateway Load Balancer", d: "Layer-3 load balancer that sends packets through inline appliances transparently." },
        { t: "GENEVE", d: "Tunnel format GWLB uses to carry original packets to appliances (UDP 6081)." },
        { t: "GWLB endpoint (GWLBe)", d: "An endpoint you point routes at to send traffic through the appliance fleet." },
        { t: "Centralised egress", d: "All spokes reach the internet through one shared NAT/firewall VPC." },
        { t: "Ingress routing", d: "Route table on the IGW that steers inbound traffic to an appliance first." }
      ],
      check: [
        {
          q: "Spoke VPCs send heavy data to the internet through a central egress VPC. The bill jumps. Why?",
          options: ["GWLB charges per rule", "Every byte pays TGW processing plus NAT processing", "Egress VPCs can't use NAT gateways"],
          answer: 1,
          why: "Centralised egress stacks the TGW per-GB fee on top of the NAT per-GB fee. For data-heavy spokes, local NAT can be cheaper."
        },
        {
          q: "Traffic must go through a firewall BEFORE reaching the internet-facing load balancer. How?",
          options: ["Security groups on the ALB", "IGW ingress routing to a GWLB endpoint", "A NAT gateway in front of the ALB"],
          answer: 1,
          why: "An edge route table on the IGW can steer inbound traffic to a GWLBe, so the firewall sees it first."
        }
      ]
    },
    "ipam-cloudwan": {
      minutes: 5,
      tldr: [
        "<strong>VPC IPAM</strong> hands out CIDRs from nested pools, detects overlaps org-wide, and tracks IP usage.",
        "Preventing overlap at allocation is cheap; fixing it later means renumbering.",
        "<strong>IPv6</strong> fixes IPv4 scarcity: typically /56 per VPC, /64 per subnet, one summarised prefix per region.",
        "<strong>Cloud WAN</strong> = a global network from a declared policy: global segments, routes shared between regions automatically.",
        "TGW stays the default for one or a few regions; Cloud WAN for many regions and segments. They can interoperate."
      ],
      analogy: "IPAM is a land registry: every new plot (VPC) gets its address from the registry, so no two plots end up with the same street number. Cloud WAN is ordering a nationwide road network by describing it (“these zones connect, those don't”), instead of building each junction by hand.",
      examTip: "“Prevent overlapping CIDRs / automate CIDR assignment across hundreds of accounts” = <strong>IPAM</strong>. “Global network across many regions, segment prod/dev worldwide, minimise routing admin” = <strong>Cloud WAN</strong>.",
      terms: [
        { t: "IPAM pool", d: "A block of addresses that VPCs allocate from; pools nest by region and environment." },
        { t: "Cloud WAN segment", d: "A global isolated routing domain (like a VRF), e.g. prod or dev across all regions." },
        { t: "Core network policy", d: "The JSON document that declares Cloud WAN's segments, regions and rules." },
        { t: "NAT64/DNS64", d: "Lets IPv6-only workloads reach IPv4-only destinations." },
        { t: "Egress-only IGW", d: "IPv6 outbound-only internet gateway; blocks unsolicited inbound connections." }
      ],
      check: [
        {
          q: "Teams keep creating VPCs with 10.0.0.0/16, causing overlaps. What prevents this at creation time?",
          options: ["An AWS Config rule that flags overlaps", "IPAM pools that VPCs must allocate from", "A shared spreadsheet"],
          answer: 1,
          why: "IPAM allocates non-overlapping CIDRs automatically. A Config rule only detects after the VPC already exists."
        },
        {
          q: "What does Cloud WAN fix compared with peered Transit Gateways across five regions?",
          options: ["Higher bandwidth per attachment", "Routes shared between regions automatically, from one declared policy", "Appliance mode support"],
          answer: 1,
          why: "TGW peering is static-only, so each region needs manual routes. Cloud WAN propagates across its core and declares segments once."
        }
      ]
    }
  }
});
