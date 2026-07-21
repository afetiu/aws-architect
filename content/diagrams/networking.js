/* Interactive diagrams: networking modules (vpc, route53, adv-networking). */

window.COURSE.registerDiagram({
  id: "vpc-anatomy",
  moduleId: "vpc",
  title: "Anatomy of a VPC",
  sub: "The standard two-tier VPC. Click components, then step through the three packet flows every architect must know cold.",
  w: 760, h: 450,
  nodes: [
    { id: "vpc", x: 20, y: 60, w: 500, h: 370, zone: true, label: "VPC 10.0.0.0/16" },
    { id: "pub", x: 55, y: 130, w: 320, h: 120, zone: true, label: "Public subnet 10.0.1.0/24" },
    { id: "priv", x: 55, y: 290, w: 320, h: 120, zone: true, label: "Private subnet 10.0.2.0/24" },
    { id: "internet", x: 190, y: 8, w: 160, h: 34, color: "blue", label: "Internet",
      info: "Everything out here is untrusted. The only doors into the VPC are the gateways you attach." },
    { id: "igw", x: 190, y: 78, w: 160, h: 34, color: "orange", label: "Internet Gateway",
      info: "A horizontally-scaled, highly available 1:1 NAT between public IPs and instance private IPs. It has no bandwidth limit and no cost — it only works for subnets whose route table points 0.0.0.0/0 at it (that route is what makes a subnet 'public')." },
    { id: "alb", x: 80, y: 165, w: 130, h: 44, color: "orange", label: "ALB", sub: "L7, SG-attached",
      info: "Terminates TLS, evaluates listener rules, opens a NEW connection to targets. Lives in at least two subnets/AZs. Its security group is your first policy gate for inbound traffic." },
    { id: "nat", x: 240, y: 165, w: 120, h: 44, color: "yellow", label: "NAT Gateway", sub: "per-AZ, $/GB",
      info: "Managed source-NAT for private subnets. One per AZ for HA (cross-AZ NAT = cross-AZ data charges + blast radius). Bills ~$0.045/GB processed — the classic surprise line-item. ~55k concurrent connections to a single destination per NAT." },
    { id: "ec2", x: 80, y: 325, w: 130, h: 44, color: "green", label: "EC2 app tier", sub: "no public IP",
      info: "Private-subnet instances have no route from the internet — reachable only through the ALB (inbound) and reaching out only via NAT or endpoints. Admin access: SSM Session Manager, not a bastion with port 22 open." },
    { id: "rds", x: 240, y: 325, w: 120, h: 44, color: "blue", label: "RDS", sub: "SG-to-SG rule",
      info: "Database subnet group across AZs. Its security group allows port 5432 FROM the app tier's security group — referencing SGs, not CIDRs, is the pattern that survives autoscaling." },
    { id: "vpce", x: 560, y: 200, w: 150, h: 44, color: "green", label: "S3 Gateway endpoint", sub: "a route, not an ENI",
      info: "A prefix-list route target in the route table — not a device, no ENI, no cost, no bandwidth cap. S3/DynamoDB only. Interface endpoints (PrivateLink) are the ENI-based, per-hour-billed cousins for everything else." },
    { id: "s3", x: 560, y: 300, w: 150, h: 44, color: "blue", label: "S3",
      info: "Regional service, lives outside your VPC. Reached over the public endpoint (via IGW/NAT) or privately via the gateway endpoint — same bucket, wildly different data-path cost." }
  ],
  edges: [
    { from: "internet", to: "igw", label: "HTTPS 443" },
    { from: "igw", to: "alb" },
    { from: "alb", to: "ec2", label: "new conn" },
    { from: "ec2", to: "rds", label: "5432" },
    { from: "ec2", to: "nat", label: "egress" },
    { from: "nat", to: "igw" },
    { from: "ec2", to: "vpce", dashed: true },
    { from: "vpce", to: "s3", dashed: true }
  ],
  flows: [
    { title: "Inbound user request", steps: [
      { lit: ["internet", "internet->igw"], text: "A client resolves your domain (Route 53 alias → ALB) and sends HTTPS to the ALB's public IPs. The IGW maps those public IPs to the ALB's ENIs in the public subnets." },
      { lit: ["igw", "igw->alb"], text: "First policy gate: the ALB's security group must allow 443 from 0.0.0.0/0. NACLs on the public subnet are evaluated too (stateless — both directions)." },
      { lit: ["alb"], text: "The ALB terminates TLS, evaluates listener rules (host/path), picks a healthy target, and opens a brand-new TCP connection — the client's IP now only exists in X-Forwarded-For." },
      { lit: ["alb->ec2", "ec2"], text: "Second gate: the app SG allows the app port FROM the ALB's SG. The instance never sees the internet directly — it has no public IP and no IGW route." },
      { lit: ["ec2->rds", "rds"], text: "App queries the DB. Third gate: RDS's SG allows 5432 from the app SG. Three nested SG gates = defense in depth without managing a single CIDR." }
    ]},
    { title: "Private subnet → internet (via NAT)", steps: [
      { lit: ["ec2"], text: "The app needs to call an external API. Its subnet's route table: 10.0.0.0/16 → local, 0.0.0.0/0 → nat-… — no IGW route exists here, which is precisely what makes it 'private'." },
      { lit: ["ec2->nat", "nat"], text: "The NAT Gateway rewrites the source IP to its own Elastic IP and tracks the connection. This hop bills per-GB — chatty egress from private subnets is a budget line." },
      { lit: ["nat->igw", "igw", "internet->igw"], text: "NAT forwards through the IGW to the internet. Replies flow back through the NAT's connection table. Inbound connections can NEVER originate this way — NAT is one-way by design." }
    ]},
    { title: "S3 via gateway endpoint ($0)", steps: [
      { lit: ["ec2", "ec2->vpce"], text: "Same instance, same bucket — but now the route table has the S3 prefix list → vpce-…. Traffic to S3's IP ranges takes this route instead of 0.0.0.0/0." },
      { lit: ["vpce", "vpce->s3", "s3"], text: "Traffic rides the AWS backbone, never touches IGW or NAT, costs $0 in processing, and the endpoint policy can pin access to specific buckets — a security AND cost win." },
      { lit: ["nat"], text: "Compare: without the endpoint, this exact traffic would flow through the NAT at ~$0.045/GB. 'S3 traffic through NAT' is the single most common wasted spend the exam tests." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "hybrid-connectivity",
  moduleId: "adv-networking",
  title: "Hybrid connectivity: DX + VPN + Transit Gateway",
  sub: "The enterprise hub-and-spoke: Direct Connect as primary, VPN as failover, TGW route tables as the segmentation brain.",
  w: 780, h: 420,
  nodes: [
    { id: "onprem", x: 20, y: 60, w: 190, h: 320, zone: true, label: "On-premises DC" },
    { id: "aws", x: 290, y: 40, w: 470, h: 360, zone: true, label: "AWS" },
    { id: "router", x: 45, y: 190, w: 140, h: 46, color: "blue", label: "Corporate router", sub: "BGP speaker",
      info: "Advertises on-prem prefixes over BGP on both paths. Path preference is engineered with BGP attributes: DX preferred (shorter AS path / local pref), VPN as standby." },
    { id: "dx", x: 315, y: 110, w: 130, h: 46, color: "orange", label: "Direct Connect", sub: "private VIF, 10 Gbps",
      info: "Dedicated fiber at a DX location: consistent latency, no internet, cheaper per-GB egress than internet rates. Not encrypted by default (MACsec optional). A single DX connection is a single point of failure — resiliency models (dev/test → maximum) define how many connections at how many locations." },
    { id: "vpn", x: 315, y: 270, w: 130, h: 46, color: "yellow", label: "Site-to-Site VPN", sub: "2 tunnels, IPsec",
      info: "Runs over the public internet: minutes to provision, encrypted, but ~1.25 Gbps per tunnel and variable latency. Two tunnels to different AWS endpoints per connection. The standard DX backup — same prefixes, worse BGP preference." },
    { id: "tgw", x: 480, y: 190, w: 140, h: 50, color: "orange", label: "Transit Gateway", sub: "the routing hub",
      info: "Regional router connecting VPCs, DX (via transit VIF + DX Gateway), and VPNs at scale. Each attachment associates with ONE TGW route table and propagates into any number — that association/propagation matrix IS your segmentation policy." },
    { id: "vpca", x: 650, y: 90, w: 100, h: 44, color: "green", label: "Prod VPC",
      info: "Attachment associated with the 'prod' TGW route table: routes to on-prem and shared, but no route to dev — segmentation by omission of routes, not by firewalls." },
    { id: "vpcb", x: 650, y: 190, w: 100, h: 44, color: "green", label: "Shared svcs",
      info: "Reachable from everything: central DNS resolvers, endpoints, tooling. Its TGW route table propagates from all attachments." },
    { id: "vpcc", x: 650, y: 290, w: 100, h: 44, color: "green", label: "Dev VPC",
      info: "Dev's route table has on-prem and shared routes only. Prod's CIDR simply doesn't exist here — a packet to prod has no route and dies at the TGW." }
  ],
  edges: [
    { from: "router", to: "dx", label: "fiber" },
    { from: "router", to: "vpn", label: "internet", dashed: true },
    { from: "dx", to: "tgw", label: "transit VIF" },
    { from: "vpn", to: "tgw", dashed: true },
    { from: "tgw", to: "vpca" },
    { from: "tgw", to: "vpcb" },
    { from: "tgw", to: "vpcc" }
  ],
  flows: [
    { title: "Normal path: over Direct Connect", steps: [
      { lit: ["router", "router->dx"], text: "On-prem app calls a prod service. The corporate router prefers the DX path — BGP local-preference makes DX win while its session is up." },
      { lit: ["dx", "dx->tgw"], text: "Across the dedicated cross-connect through the DX location, over a transit VIF to a DX Gateway bound to the TGW. Consistent single-digit-ms latency, no internet exposure." },
      { lit: ["tgw", "tgw->vpca", "vpca"], text: "The TGW looks up the destination in the route table ASSOCIATED with the DX attachment — on-prem is allowed to reach prod, so a route exists and the packet is delivered." }
    ]},
    { title: "DX fails: BGP failover to VPN", steps: [
      { lit: ["dx"], text: "Fiber cut at the DX location. The BGP session over DX drops; its advertised routes are withdrawn within seconds (tune BFD/BGP timers — default hold can be 90s of black hole)." },
      { lit: ["router", "router->vpn", "vpn"], text: "The same prefixes are still advertised over the VPN tunnels, previously less-preferred. They instantly become best path. No human touched anything — this failover is routing protocol, not runbook." },
      { lit: ["vpn->tgw", "tgw", "tgw->vpca", "vpca"], text: "Traffic continues via IPsec over the internet: capped near 1.25 Gbps/tunnel (ECMP across tunnels helps), higher jitter. Capacity planning question the SAP exam loves: can the VPN actually carry your DX load?" }
    ]},
    { title: "Why dev can't reach prod", steps: [
      { lit: ["vpcc"], text: "An instance in Dev tries prod's CIDR. The packet reaches Dev's TGW attachment." },
      { lit: ["tgw"], text: "The TGW consults the route table associated with the DEV attachment. Prod's CIDR was never propagated into it. No route → dropped at the hub. No NACLs, no firewall rules — segmentation is the shape of the routing tables." },
      { lit: ["tgw->vpcb", "vpcb"], text: "Shared services, though, IS in dev's route table — so DNS, CI, and tooling work. This association/propagation matrix replaces hundreds of VPC peerings (which would each be non-transitive and unmanageable at this scale)." }
    ]}
  ]
});
