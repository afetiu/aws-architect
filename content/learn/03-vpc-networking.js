/* Learning layer — Module 3: VPC & Core Networking */
window.COURSE.registerLearn({
  moduleId: "vpc",
  bigPicture: "A VPC is your own private network inside AWS. You pick its address range, split it into subnets per AZ, and decide with <strong>route tables</strong> where traffic may go: out to the internet, through a NAT, to another VPC, or privately to AWS services. Two firewalls guard it (security groups and NACLs). Networking shows up in every exam domain, and a handful of rules — NAT per AZ, SG vs NACL, peering is not transitive, gateway endpoints for S3 — win many points.",
  cheatsheet: [
    { k: "How many usable IPs in a /28 subnet (or /24)?", v: "<strong>11</strong> (or 251) — AWS reserves <strong>5 per subnet</strong>" },
    { k: "Valid VPC CIDR sizes", v: "<strong>/16 to /28</strong>; you can add secondary CIDRs later" },
    { k: "Instance in a public subnet cannot be reached from the internet", v: "Check IGW route, <strong>public IP</strong>, SG and NACL — usually the missing public IP" },
    { k: "Private instances need outbound internet (IPv4)", v: "<strong>NAT gateway in a public subnet</strong>, one per AZ for HA" },
    { k: "Private instances need outbound-only IPv6", v: "<strong>Egress-only internet gateway</strong> — not a NAT gateway" },
    { k: "Cut NAT costs for S3 or DynamoDB traffic", v: "<strong>Gateway endpoint</strong> — free, route-table based" },
    { k: "Private AWS API access from on-prem or another VPC", v: "<strong>Interface endpoint (PrivateLink)</strong> — gateway endpoints cannot do this" },
    { k: "Block one malicious IP range", v: "<strong>NACL deny rule</strong> — security groups cannot deny" },
    { k: "Requests arrive but responses vanish after adding a NACL", v: "Allow <strong>ephemeral ports</strong> outbound — NACLs are stateless" },
    { k: "App tier accepts traffic only from auto-scaling web tier", v: "SG rule that <strong>references the web tier's SG</strong>" },
    { k: "A peers B, B peers C; A cannot reach C", v: "Peering is <strong>not transitive</strong>: peer A-C directly or use Transit Gateway" },
    { k: "Many VPCs plus on-prem, simplify management", v: "<strong>Transit Gateway</strong> hub-and-spoke" },
    { k: "Two VPCs have overlapping CIDRs", v: "No peering; use <strong>PrivateLink</strong> or a private NAT gateway" },
    { k: "See which traffic SGs or NACLs rejected", v: "<strong>VPC Flow Logs</strong> (metadata only, minutes delay)" },
    { k: "Need full packet contents for inspection", v: "<strong>Traffic Mirroring</strong>, not Flow Logs" },
    { k: "Private hosted zone or endpoint private DNS not resolving", v: "Turn on <strong>enableDnsSupport + enableDnsHostnames</strong>" },
    { k: "Admin access to private instances, no open ports, full audit", v: "<strong>SSM Session Manager</strong> (no bastion)" },
    { k: "Session Manager in subnets with no internet", v: "Interface endpoints <strong>ssm, ssmmessages, ec2messages</strong>" },
    { k: "Public IP must survive stop/start", v: "<strong>Elastic IP</strong> (all public IPv4 now bills hourly)" }
  ],
  lessons: {
    "cidr-design": {
      minutes: 4,
      tldr: [
        "A VPC gets an IPv4 range between <strong>/16 and /28</strong>. Subnets are carved from it, <strong>one AZ each</strong>.",
        "AWS reserves <strong>5 IPs per subnet</strong>: network, router (.1), DNS (.2), future (.3), broadcast (last).",
        "You cannot resize a subnet. Leave gaps and add <strong>secondary CIDRs</strong> when you run out.",
        "Plan ranges centrally so VPCs never <strong>overlap</strong> — overlap blocks peering and complicates VPN forever.",
        "VPCs and subnets are free; you pay for NAT, interface endpoints, traffic and every public IPv4 address."
      ],
      analogy: "A CIDR block is a street with numbered house plots. Subnets are blocks of plots on that street, each in one neighbourhood (AZ). Five plots on every block are taken by the council for the road, post office and signpost. You cannot move boundaries later, only buy a new street.",
      examTip: "Memorise: a <strong>/28 has 11 usable IPs</strong>, and <strong>.2 is the DNS resolver</strong>. A /15 or /29 VPC is always a wrong answer.",
      terms: [
        { t: "CIDR", d: "Address range notation like 10.0.0.0/16; smaller suffix = more addresses." },
        { t: "Subnet", d: "A slice of the VPC range that lives in exactly one AZ." },
        { t: "RFC 1918", d: "Private address ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16." },
        { t: "Secondary CIDR", d: "Extra address range added to an existing VPC to get more room." },
        { t: "VPC IPAM", d: "AWS tool for planning and allocating IP ranges across accounts without overlap." }
      ],
      check: [
        {
          q: "How many usable IP addresses does a /28 subnet give you in AWS?",
          options: ["16", "14", "11", "8"],
          answer: 2,
          why: "A /28 has 16 addresses; AWS reserves <strong>5</strong> in every subnet, leaving 11. 14 is the non-AWS answer (only network and broadcast reserved)."
        },
        {
          q: "An EKS cluster's private subnets are running out of IPs. What is the least disruptive fix?",
          options: ["Resize the existing subnets", "Add a secondary CIDR and create new subnets in it", "Delete and recreate the VPC with a bigger range"],
          answer: 1,
          why: "Subnets cannot be resized, but you can <strong>add a secondary CIDR</strong> (100.64.0.0/10 is a common choice for pods) and new subnets."
        }
      ]
    },
    "routing-igw": {
      minutes: 4,
      tldr: [
        "Every VPC has an invisible router you control only through <strong>route tables</strong>. Most specific route wins.",
        "A <strong>public subnet</strong> is just one whose route table sends 0.0.0.0/0 to an <strong>internet gateway</strong>.",
        "The instance never sees its public IP; the IGW translates private to public 1:1 as traffic passes.",
        "Internet reachability needs all four: IGW attached, route to it, a <strong>public IP</strong>, and SG/NACL allowing.",
        "For IPv6, an <strong>egress-only IGW</strong> lets traffic out but blocks connections coming in."
      ],
      analogy: "A route table is the signpost at each junction: \"internet this way, other VPC that way\". The internet gateway is the town's main gate. A house only gets mail from outside if the gate exists, the signpost points to it, and the house has a public address on file.",
      examTip: "\"Instance in a public subnet cannot be reached\" and the route and SG look fine? The answer is almost always <strong>no public IP or Elastic IP assigned</strong>.",
      terms: [
        { t: "Route table", d: "List of destination to target rules applied to one or more subnets." },
        { t: "Main route table", d: "Default table for subnets without their own; keep it private-only." },
        { t: "Internet gateway (IGW)", d: "Managed, unlimited gateway to the internet; one per VPC." },
        { t: "Longest-prefix match", d: "When routes overlap, the most specific (e.g. /24 over /16) wins." },
        { t: "Egress-only IGW", d: "IPv6-only gateway allowing outbound connections and replies, nothing inbound." }
      ],
      check: [
        {
          q: "What makes a subnet \"public\" in AWS?",
          options: ["A subnet setting called Public", "Its route table has a default route to an internet gateway", "It has a NAT gateway inside it"],
          answer: 1,
          why: "There is no public flag. A subnet is public purely because of its <strong>route to an IGW</strong>."
        },
        {
          q: "You run ip addr on an EC2 instance that has a public IP. What do you see?",
          options: ["Only the private IP", "Only the public IP", "Both IPs"],
          answer: 0,
          why: "The OS only knows the <strong>private IP</strong>. The internet gateway does the 1:1 translation to the public IP outside the instance."
        }
      ]
    },
    "nat": {
      minutes: 4,
      tldr: [
        "A <strong>NAT gateway</strong> lets private instances reach out to the internet while nothing can connect in.",
        "It lives in <strong>one AZ</strong>. For HA, run <strong>one per AZ</strong> and route each private subnet to its own AZ's NAT.",
        "It scales to 100 Gbps by itself, has <strong>no security group</strong>, and charges per hour <em>and</em> per GB.",
        "Around <strong>55,000 connections per destination</strong>; add more IPs or gateways if you hit port exhaustion.",
        "Sending S3/DynamoDB traffic through NAT wastes money — use a free <strong>gateway endpoint</strong>."
      ],
      analogy: "A NAT gateway is a company switchboard. Employees can call out, and callers can reply on that call, but nobody outside can dial an employee directly. One switchboard per building (AZ) means one building's power cut does not cut everyone's phones.",
      examTip: "\"Highly available NAT\" = <strong>one NAT gateway per AZ</strong>. \"Reduce NAT data charges for S3\" = <strong>gateway endpoint</strong>. \"Needs a security group or bastion use\" = only a <strong>NAT instance</strong> can.",
      terms: [
        { t: "NAT gateway", d: "Managed outbound-only IPv4 translation for private subnets; zonal." },
        { t: "NAT instance", d: "DIY EC2 doing NAT; needs source/dest check disabled; supports SGs." },
        { t: "Port exhaustion", d: "Running out of source ports to one destination; shows as ErrorPortAllocation." },
        { t: "Source/dest check", d: "EC2 setting that drops traffic not addressed to the instance; disable for NAT." },
        { t: "Private NAT gateway", d: "NAT without a public IP, for translating between private networks." }
      ],
      check: [
        {
          q: "One NAT gateway in AZ-a serves private subnets in three AZs. What are the problems?",
          options: ["None, NAT gateways are regional", "AZ-a failure cuts egress for all AZs, plus cross-AZ data charges", "It will run out of bandwidth at 5 Gbps"],
          answer: 1,
          why: "NAT gateways are <strong>zonal</strong>. Lose AZ-a and every subnet loses egress, and the other AZs pay cross-AZ charges. Bandwidth scales to 100 Gbps."
        },
        {
          q: "Private instances upload terabytes to S3 through a NAT gateway and the bill is huge. Cheapest fix?",
          options: ["Switch to a NAT instance", "Add an S3 gateway endpoint", "Add an S3 interface endpoint in every AZ"],
          answer: 1,
          why: "A <strong>gateway endpoint</strong> is free and removes NAT per-GB charges. An interface endpoint works but costs hourly plus per GB."
        }
      ]
    },
    "sg-nacl": {
      minutes: 4,
      tldr: [
        "<strong>Security group</strong>: on each network interface, <strong>stateful</strong>, allow rules only, all rules checked.",
        "<strong>NACL</strong>: on the subnet edge, <strong>stateless</strong>, allow and deny, numbered rules, first match wins.",
        "Stateless means return traffic needs its own rule: allow <strong>ephemeral ports</strong> (1024-65535).",
        "SGs can reference other SGs (\"allow from the web tier\"); NACLs use IP ranges only.",
        "Do most work in SGs; use NACLs for coarse blocks like denying a bad IP range."
      ],
      analogy: "A security group is a bouncer who remembers faces: once you're let in, you can walk back out. A NACL is a turnstile with a printed rulebook at the street entrance — it checks every person both ways and remembers nobody, so the way out needs its own rule.",
      examTip: "\"Block a specific IP\" = <strong>NACL deny</strong> (SGs cannot deny). \"Responses never arrive after adding a NACL\" = missing <strong>outbound ephemeral ports</strong>.",
      terms: [
        { t: "Stateful", d: "Remembers connections, so replies are allowed automatically." },
        { t: "Stateless", d: "Judges every packet alone; replies need explicit rules." },
        { t: "Ephemeral ports", d: "Temporary high ports clients use for replies, roughly 1024-65535." },
        { t: "SG reference", d: "Rule source set to another security group, so members are allowed dynamically." },
        { t: "Default NACL vs custom NACL", d: "Default allows everything; a new custom NACL denies everything until you add rules." }
      ],
      check: [
        {
          q: "Security wants to block traffic from 203.0.113.0/24 to a subnet. What should they use?",
          options: ["A security group deny rule", "A NACL deny rule", "A route table blackhole to the IGW"],
          answer: 1,
          why: "Only <strong>NACLs support deny</strong>. Security groups have allow rules only."
        },
        {
          q: "The app tier must accept port 8080 only from web servers that scale in and out. Best rule?",
          options: ["Allow 8080 from the web subnet CIDRs", "Allow 8080 from the web tier's security group", "Allow 8080 from 0.0.0.0/0 and rely on the NACL"],
          answer: 1,
          why: "Referencing the <strong>web tier's SG</strong> follows instances automatically as they come and go. CIDR rules are broader and brittle."
        }
      ]
    },
    "peering-endpoints": {
      minutes: 4,
      tldr: [
        "<strong>VPC peering</strong> links exactly two VPCs privately. Both sides add routes. CIDRs must <strong>not overlap</strong>.",
        "Peering is <strong>not transitive</strong>: A-B and B-C does not give A-C. Nor can a peer use your IGW, NAT or endpoints.",
        "<strong>Gateway endpoints</strong>: S3 and DynamoDB only, route-table based, <strong>free</strong>, same VPC and region only.",
        "<strong>Interface endpoints</strong> (PrivateLink): a private IP in your subnet per AZ, most services, have SGs, reachable from on-prem and peers.",
        "Lock data in with an endpoint policy plus a bucket policy on <code>aws:SourceVpce</code>."
      ],
      analogy: "Peering is a private footbridge between two neighbouring houses — it does not let the neighbour walk through your house to the third one. A gateway endpoint is a free private tunnel to the S3 warehouse from your garden only; an interface endpoint is a paid service desk installed inside your house that visitors can also use.",
      examTip: "Three or more VPCs needing to talk \"through\" one = non-transitive peering trap; answer is direct peering or <strong>Transit Gateway</strong>. On-prem needs private S3 access = <strong>interface endpoint</strong>, not gateway.",
      terms: [
        { t: "VPC peering", d: "Private one-to-one routing between two VPCs, any account or region." },
        { t: "Transitive routing", d: "Passing traffic through a middle network to a third; peering forbids it." },
        { t: "Gateway endpoint", d: "Free route-table target for S3 or DynamoDB inside one VPC." },
        { t: "Interface endpoint", d: "PrivateLink network interface with a private IP that fronts an AWS or partner service." },
        { t: "Endpoint policy", d: "Resource policy on an endpoint limiting what can be reached through it." }
      ],
      check: [
        {
          q: "An on-premises server over Direct Connect must reach S3 privately. Which endpoint type works?",
          options: ["S3 gateway endpoint", "S3 interface endpoint", "Either one"],
          answer: 1,
          why: "Gateway endpoints only serve traffic from the VPC's own route tables. An <strong>interface endpoint</strong> has a private IP reachable over DX, VPN or peering."
        },
        {
          q: "VPC A peers with B, and B peers with C. A needs to reach C. What works?",
          options: ["Add a route in A pointing C's CIDR at the A-B peering", "Create an A-C peering or use a Transit Gateway", "Enable DNS resolution on the peerings"],
          answer: 1,
          why: "Peering is <strong>never transitive</strong>; traffic through B is dropped. You need a direct peering or a hub like Transit Gateway."
        }
      ]
    },
    "tgw-flowlogs": {
      minutes: 4,
      tldr: [
        "<strong>Transit Gateway</strong> is a regional hub router: attach VPCs, VPNs and Direct Connect, and routing becomes <strong>transitive</strong>.",
        "It costs per attachment-hour plus per GB; for two or three VPCs, peering is cheaper.",
        "<strong>Flow Logs</strong> record connection metadata (who, where, port, bytes, ACCEPT/REJECT), not packet contents.",
        "Flow Logs arrive minutes late and skip some traffic, e.g. DNS to the .2 resolver, metadata service, DHCP.",
        "Send big flow logs to <strong>S3 + Athena</strong>; for payloads use <strong>Traffic Mirroring</strong>."
      ],
      analogy: "Transit Gateway is an airport hub: every city flies to the hub and can then reach any other city, instead of needing a direct flight between each pair. Flow Logs are the airport's passenger manifest — who flew where and when — not a recording of what was said on board.",
      examTip: "Many VPCs + on-prem + \"simplify\" or \"least operational overhead\" = <strong>Transit Gateway</strong>. \"Capture packet payloads\" = <strong>Traffic Mirroring</strong>, never Flow Logs.",
      terms: [
        { t: "Transit Gateway (TGW)", d: "Managed regional hub that routes between attached VPCs and on-prem links." },
        { t: "Attachment", d: "A connection of a VPC, VPN or DX gateway to the TGW; billed hourly." },
        { t: "VPC Flow Logs", d: "Metadata records of IP flows at VPC, subnet or interface level." },
        { t: "Traffic Mirroring", d: "Copies actual packets from an interface to an analysis appliance." },
        { t: "REJECT record", d: "Flow log entry showing a security group or NACL dropped the traffic." }
      ],
      check: [
        {
          q: "Security needs to inspect the full contents of suspicious traffic from certain instances. What do you enable?",
          options: ["VPC Flow Logs", "Traffic Mirroring", "Route 53 Resolver query logs"],
          answer: 1,
          why: "<strong>Traffic Mirroring</strong> copies real packets. Flow Logs hold only metadata like addresses, ports and byte counts."
        },
        {
          q: "A company has 40 VPCs and a VPN to its office and wants simple any-to-any routing. What fits best?",
          options: ["A full mesh of VPC peerings", "A Transit Gateway", "One VPC with 40 subnets"],
          answer: 1,
          why: "40 VPCs in a mesh is 780 peerings. <strong>Transit Gateway</strong> gives hub-and-spoke transitive routing with far less to manage."
        }
      ]
    },
    "dns-ipv6": {
      minutes: 4,
      tldr: [
        "Every VPC has a built-in DNS resolver at the <strong>VPC base +2</strong> (and 169.254.169.253).",
        "Private hosted zones and endpoint private DNS need <strong>enableDnsSupport and enableDnsHostnames</strong> both on.",
        "The resolver handles about <strong>1024 packets/sec per network interface</strong>; cache DNS on busy hosts.",
        "Keep AmazonProvidedDNS and use <strong>Resolver forwarding rules</strong> for on-prem domains, rather than swapping DNS servers.",
        "IPv6: VPC gets a /56, subnets a /64, all <strong>public addresses</strong>. Private IPv6 subnets use an <strong>egress-only IGW</strong>."
      ],
      analogy: "The VPC resolver is the building's reception phone book: it knows internal extensions first, then private company listings, then calls directory enquiries for everything else. Turn off the phone book switch and nobody can find the internal numbers.",
      examTip: "\"Private hosted zone not resolving\" = turn on <strong>both DNS attributes</strong>. \"Outbound-only IPv6\" = <strong>egress-only IGW</strong> — a NAT gateway is the IPv4 trap answer.",
      terms: [
        { t: "AmazonProvidedDNS", d: "The VPC's built-in resolver at base+2, part of Route 53 Resolver." },
        { t: "enableDnsHostnames", d: "VPC setting; off by default for VPCs you create via API or Terraform." },
        { t: "Private hosted zone", d: "Route 53 DNS zone visible only to associated VPCs." },
        { t: "DHCP option set", d: "Tells instances which DNS server and domain to use; immutable, swap to change." },
        { t: "Resolver forwarding rule", d: "Sends queries for chosen domains (e.g. corp.local) to other DNS servers." }
      ],
      check: [
        {
          q: "A VPC created with the CLI has a private hosted zone attached, but names do not resolve. Most likely cause?",
          options: ["Private zones need a NAT gateway", "enableDnsHostnames is false", "The zone must be public"],
          answer: 1,
          why: "API-created VPCs default <strong>enableDnsHostnames to false</strong>, and private zones need both DNS attributes on."
        },
        {
          q: "Dual-stack instances must start IPv6 connections outbound but never accept inbound ones. What do you add?",
          options: ["NAT gateway", "Egress-only internet gateway", "A second internet gateway"],
          answer: 1,
          why: "IPv6 addresses are public, so privacy comes from routing to an <strong>egress-only IGW</strong>. NAT gateways are the IPv4 answer."
        }
      ]
    },
    "eni-eip-ssm": {
      minutes: 4,
      tldr: [
        "An <strong>ENI</strong> (network interface) carries private IPs, a MAC and security groups. Almost everything in a VPC has one.",
        "Secondary ENIs can move to another instance <strong>in the same AZ</strong>, taking their IP and MAC along.",
        "A normal public IP <strong>changes on stop/start</strong>; an <strong>Elastic IP</strong> stays. All public IPv4 costs about 0.005 USD/hour.",
        "<strong>SSM Session Manager</strong> replaces bastion hosts: agent connects out, zero inbound ports, IAM-controlled, fully logged.",
        "Needs the SSM agent, an instance role with <code>AmazonSSMManagedInstanceCore</code>, and a path to SSM (NAT or endpoints)."
      ],
      analogy: "Session Manager is like the instance calling the help desk and keeping the line open, instead of leaving its front door unlocked for visitors. You reach it through that open call, and the help desk records every word.",
      examTip: "\"Access private instances with no open inbound ports, no bastion, full auditing\" = <strong>Session Manager</strong>. In subnets without internet, add interface endpoints <strong>ssm, ssmmessages, ec2messages</strong>.",
      terms: [
        { t: "ENI", d: "Elastic network interface: the virtual network card holding IPs and security groups." },
        { t: "Elastic IP (EIP)", d: "Static public IPv4 you own and can remap between interfaces." },
        { t: "Bastion host", d: "Public jump server for SSH into private instances; legacy pattern." },
        { t: "Session Manager", d: "Systems Manager feature for shell and port-forwarding sessions over an outbound connection." },
        { t: "Instance profile", d: "Attaches the IAM role the SSM agent uses to register." }
      ],
      check: [
        {
          q: "An instance's public IP changed after stop and start, breaking a partner's allow-list. What prevents this?",
          options: ["Reboot instead of stop", "Attach an Elastic IP", "Use a bigger instance type"],
          answer: 1,
          why: "Auto-assigned public IPs are released on stop. An <strong>Elastic IP</strong> stays fixed until you release it."
        },
        {
          q: "Instances in private subnets with no NAT show up in Systems Manager, but sessions hang. What is likely missing?",
          options: ["A bastion host", "The ssmmessages interface endpoint", "Port 22 open in the security group"],
          answer: 1,
          why: "The session traffic itself goes through <strong>ssmmessages</strong>. Port 22 and bastions are exactly what Session Manager avoids."
        }
      ]
    }
  }
});
