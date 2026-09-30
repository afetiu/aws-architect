/* Learning layer — Module 11 Route 53 (see content/LEARN.md) */
window.COURSE.registerLearn({
  moduleId: "route53",
  bigPicture: "DNS is the internet's phone book: it turns names like example.com into IP addresses. <strong>Route 53</strong> is AWS's DNS service, but it does more than look names up — it can pick a different answer per user based on latency, location, weights or health, which makes it a cheap global traffic director and a key disaster-recovery tool. The exam tests it as matching: the scenario's wording tells you which record type or routing policy to use, and hybrid questions test which way the DNS queries flow.",
  cheatsheet: [
    { k: "Point the root domain (example.com) at an ALB or CloudFront", v: "<strong>Alias A record</strong> — CNAME is never allowed at the apex" },
    { k: "Cut DNS query costs for records pointing at AWS resources", v: "<strong>Alias records</strong> — queries to AWS targets are free" },
    { k: "Domain registered elsewhere, move DNS to Route 53", v: "Create hosted zone, then <strong>update NS records at the registrar</strong>" },
    { k: "Send 10% of traffic to a new version", v: "<strong>Weighted routing</strong> (weight 0 = stop sending)" },
    { k: "Fastest response for users of a multi-Region app", v: "<strong>Latency-based routing</strong>" },
    { k: "Active-passive DR to a standby site or static page", v: "<strong>Failover routing</strong> + health check" },
    { k: "Users in a country must get a specific stack (compliance)", v: "<strong>Geolocation routing</strong> — always add a default record" },
    { k: "Gradually shift traffic toward a Region by distance", v: "<strong>Geoproximity routing</strong> — raise that Region's bias" },
    { k: "Return several healthy IPs without a load balancer", v: "<strong>Multivalue answer</strong> — up to 8 healthy records" },
    { k: "Route known client CIDR ranges to a specific endpoint", v: "<strong>IP-based routing</strong>" },
    { k: "Health check a resource with no public IP", v: "<strong>CloudWatch alarm-based health check</strong>" },
    { k: "Failover on ALB health without paying for health checks", v: "<strong>Alias with EvaluateTargetHealth</strong>" },
    { k: "Internal DNS names visible only inside VPCs", v: "<strong>Private hosted zone</strong> associated with the VPCs" },
    { k: "Same name, different answers inside vs outside", v: "<strong>Split-horizon</strong>: public + private zone with the same name" },
    { k: "On-premises servers must resolve AWS private names", v: "<strong>Resolver inbound endpoint</strong> + on-prem conditional forwarder" },
    { k: "EC2 instances must resolve on-premises names", v: "<strong>Resolver outbound endpoint</strong> + forwarding rule" },
    { k: "Log or block DNS queries from a VPC", v: "<strong>Resolver query logging</strong> / <strong>DNS Firewall</strong>" },
    { k: "Stop DNS spoofing of a public domain", v: "<strong>DNSSEC signing</strong> + DS record at the registrar" },
    { k: "Deliberate, guarded, operator-driven Regional failover", v: "<strong>Application Recovery Controller</strong> routing controls" }
  ],
  lessons: {
    "zones-delegation": {
      minutes: 4,
      tldr: [
        "A <strong>hosted zone</strong> holds the DNS records for one domain. <strong>Public</strong> zones answer the internet; <strong>private</strong> zones answer only associated VPCs.",
        "Each public zone gets <strong>four nameservers</strong>. It only works once the parent (the registrar) points to those four via <strong>NS records</strong>.",
        "<strong>Registering</strong> a domain and <strong>hosting</strong> its DNS are separate jobs; either can be Route 53 or another company.",
        "Migrating DNS safely: lower TTLs first, copy <em>all</em> records (don't forget MX), then switch NS, and keep the old zone for a few days."
      ],
      analogy: "Registering a domain is owning the house; DNS hosting is the post office that knows where to deliver. You can own the house through one company and use a different post office — you just tell the registry which post office is in charge (the NS records).",
      examTip: "&ldquo;Domain registered with a third party, use Route 53 for DNS&rdquo; → create a public hosted zone and <strong>update the NS records at the registrar</strong>. Editing NS or SOA inside Route 53 is the distractor.",
      terms: [
        { t: "Hosted zone", d: "A container of DNS records for one domain, served by Route 53." },
        { t: "Public vs private zone", d: "Public answers anyone on the internet; private answers only VPCs linked to it." },
        { t: "NS record", d: "Says which nameservers are in charge of a domain; set at the parent to delegate." },
        { t: "Registrar", d: "The company you register and renew a domain name with." },
        { t: "TTL", d: "How long resolvers may cache an answer before asking again." }
      ],
      check: [
        {
          q: "A domain is registered with GoDaddy. The team created a Route 53 public hosted zone with all records. What final step makes Route 53 answer for the domain?",
          options: ["Edit the SOA record in Route 53", "Update the NS records at GoDaddy to the zone's four Route 53 nameservers", "Transfer the domain registration to Route 53"],
          answer: 1,
          why: "Delegation is controlled by the parent: the registrar must list Route 53's nameservers. A registration transfer isn't required — registrar and DNS host can differ."
        },
        {
          q: "After switching NS to Route 53, company email stops working. What was most likely missed?",
          options: ["The MX and mail-related TXT records were not copied into the new zone", "DNSSEC was not enabled", "The zone needed to be private"],
          answer: 0,
          why: "Mail breaks first when MX, SPF and DKIM records aren't copied before the switch. Copy every record before changing NS."
        }
      ]
    },
    "alias-cname": {
      minutes: 4,
      tldr: [
        "A <strong>CNAME</strong> points one name to another name, but it is <strong>not allowed at the zone apex</strong> (example.com itself).",
        "An <strong>alias</strong> record is Route 53's fix: it returns the target's real IPs, works at the apex, and is <strong>free</strong> for AWS targets.",
        "Alias targets: ALB/NLB, CloudFront, API Gateway, S3 website endpoints, Global Accelerator, VPC endpoints, same-zone records. <strong>Not</strong> RDS or EC2 DNS names.",
        "<strong>EvaluateTargetHealth</strong> lets an alias follow the ALB's own health — failover without buying health checks.",
        "Use CNAME for targets outside AWS; you can't set an alias record's TTL yourself."
      ],
      analogy: "A CNAME is a note saying 'ask that other person instead', which costs an extra trip. An alias is a receptionist who looks up the answer for you and just hands you the phone number — and the receptionist is allowed to work at the front desk (the apex), where notes are banned.",
      examTip: "The most common Route 53 question: &ldquo;point example.com (apex/naked domain) at an ALB or CloudFront&rdquo; → <strong>alias A record</strong>. CNAME at the apex is always wrong. RDS is not an alias target.",
      terms: [
        { t: "Zone apex", d: "The bare domain itself, like example.com, with no subdomain in front." },
        { t: "CNAME", d: "A record that says 'this name is another name'. Not allowed at the apex." },
        { t: "Alias record", d: "Route 53 pointer to an AWS resource that answers with real IPs; apex-safe and free." },
        { t: "EvaluateTargetHealth", d: "Alias option that drops the answer when the AWS target (e.g. ALB) is unhealthy." }
      ],
      check: [
        {
          q: "You need example.com (no www) to point to a CloudFront distribution. Which record do you create?",
          options: ["CNAME to the distribution domain", "Alias A record to the distribution", "A record with CloudFront's current IPs"],
          answer: 1,
          why: "Only an alias works at the apex and tracks CloudFront's changing IPs. A CNAME is illegal at the apex, and hard-coded IPs break when they change."
        },
        {
          q: "Which of these can NOT be an alias target?",
          options: ["An Application Load Balancer", "An RDS database endpoint", "An S3 static website endpoint", "An API Gateway custom domain"],
          answer: 1,
          why: "RDS endpoints are not on the alias target list. Use a CNAME on a subdomain for them instead."
        }
      ]
    },
    "routing-policies": {
      minutes: 5,
      tldr: [
        "<strong>Weighted</strong>: split traffic by percentages (canary, blue/green). <strong>Latency</strong>: send users to the fastest Region.",
        "<strong>Failover</strong>: primary while healthy, else secondary — classic active-passive DR.",
        "<strong>Geolocation</strong>: answer by the user's country or continent (compliance, language). Always add a <strong>default</strong> record.",
        "<strong>Geoproximity</strong>: by distance, tunable with <strong>bias</strong>. <strong>Multivalue</strong>: up to 8 healthy IPs. <strong>IP-based</strong>: by client CIDR.",
        "All DNS changes are limited by <strong>TTL</strong> — clients keep old answers until their cache expires."
      ],
      analogy: "Routing policies are the rules a switchboard operator follows: send 5% of callers to the new desk (weighted), connect each caller to the nearest office (latency), or route callers from Germany to the German office because the law says so (geolocation).",
      examTip: "Match the verb: &ldquo;fastest/performance&rdquo; → <strong>latency</strong>; &ldquo;must/compliance/local content&rdquo; → <strong>geolocation</strong>; &ldquo;shift more traffic toward a Region&rdquo; → <strong>geoproximity bias</strong>; &ldquo;10% to new version&rdquo; → <strong>weighted</strong>.",
      terms: [
        { t: "Weighted routing", d: "Returns records in proportion to weights you set, 0 to 255." },
        { t: "Latency routing", d: "Returns the Region with the lowest measured network latency for the user." },
        { t: "Geolocation routing", d: "Returns an answer based on the user's continent, country or US state." },
        { t: "Geoproximity bias", d: "A number from -99 to +99 that grows or shrinks a resource's catchment area." },
        { t: "Multivalue answer", d: "Returns up to 8 healthy records, each with its own health check." }
      ],
      check: [
        {
          q: "Users in France must always be served by the EU stack for legal reasons. Which routing policy fits?",
          options: ["Latency-based", "Geolocation", "Weighted", "Multivalue answer"],
          answer: 1,
          why: "Geolocation routes by where the user is — right for legal rules. Latency could send a French user elsewhere if that path happened to be faster."
        },
        {
          q: "You want to send 5% of traffic to a new version and slowly increase it. Which policy do you use?",
          options: ["Failover", "Weighted", "Geoproximity"],
          answer: 1,
          why: "Weighted routing splits traffic by the weights you set, e.g. 95 and 5, and you can dial them up gradually."
        }
      ]
    },
    "health-checks": {
      minutes: 5,
      tldr: [
        "Route 53 <strong>health checks</strong> probe endpoints from many locations every <strong>30 s</strong> (or <strong>10 s</strong> fast). Default: 3 failures = unhealthy.",
        "Three kinds: <strong>endpoint</strong> checks, <strong>calculated</strong> checks (combine up to 255 others), and <strong>CloudWatch alarm</strong> checks.",
        "Private resource with no public IP? Use a <strong>CloudWatch alarm</strong> health check — public checkers can't reach inside a VPC.",
        "If <strong>every</strong> record is unhealthy, Route 53 returns them all anyway (fails open).",
        "Real failover time = detection time + TTL. Keep failover records at about <strong>60 s TTL</strong>."
      ],
      analogy: "Health checkers are a panel of inspectors in different cities who knock on your door. If enough of them get no answer, Route 53 stops giving out your address. But people who already wrote the address down (cached DNS) keep coming until their note expires.",
      examTip: "&ldquo;Health check an instance in a private subnet&rdquo; → <strong>CloudWatch alarm-based health check</strong>. Allowing Route 53 checker IP ranges through the firewall is for public endpoints, not private ones.",
      terms: [
        { t: "Endpoint health check", d: "Probes an IP or domain over HTTP, HTTPS or TCP from many global locations." },
        { t: "Calculated health check", d: "A parent check whose status combines up to 255 child checks." },
        { t: "CloudWatch alarm health check", d: "Health follows a CloudWatch alarm's state; works for private resources." },
        { t: "String matching", d: "Check passes only if a chosen text appears in the first 5,120 bytes of the response." },
        { t: "Fail open", d: "When all records are unhealthy, Route 53 returns all of them rather than nothing." }
      ],
      check: [
        {
          q: "A web server runs in a private subnet with no public IP. How can Route 53 failover know it is unhealthy?",
          options: ["Endpoint health check on its private IP", "Health check tied to a CloudWatch alarm on its metrics", "Open the server's security group to the internet"],
          answer: 1,
          why: "Route 53's checkers live on the public internet and can't reach private IPs. A CloudWatch alarm health check reflects the resource's metrics instead."
        },
        {
          q: "A failover record has a 300-second TTL. The primary fails. Why do some users still reach the dead primary for minutes?",
          options: ["Resolvers keep the cached answer until the TTL expires", "Health checks only run once an hour", "Failover routing needs a manual switch"],
          answer: 0,
          why: "DNS failover changes the answer, but resolvers serve cached answers until TTL runs out. That's why failover records use short TTLs like 60 s."
        }
      ]
    },
    "private-split-horizon": {
      minutes: 4,
      tldr: [
        "A <strong>private hosted zone</strong> answers only VPCs <strong>associated</strong> with it. Association, not peering, decides who can see it.",
        "Associated VPCs need <strong>enableDnsSupport</strong> and <strong>enableDnsHostnames</strong> both turned on.",
        "Other-account VPCs: authorize, then associate — via <strong>CLI/API only</strong>, not the console.",
        "<strong>Split-horizon</strong>: a public and a private zone with the same name give inside and outside users different answers.",
        "Trap: the private zone hides <strong>every</strong> public record it doesn't copy — missing names fail from inside the VPC."
      ],
      analogy: "A private hosted zone is the office's internal phone list: only people inside the building can use it. Split-horizon is having an internal list and a public list with the same company name — but if the internal list forgets an entry, staff can't find it, even though outsiders can.",
      examTip: "&ldquo;Resolve internal names inside VPCs without exposing them&rdquo; → <strong>private hosted zone</strong>. &ldquo;Private zone not resolving&rdquo; → check the two VPC DNS settings and the association. &ldquo;Some public names stopped resolving inside the VPC&rdquo; → same-name private zone shadowing.",
      terms: [
        { t: "Private hosted zone", d: "DNS zone only answered for VPCs you associate with it." },
        { t: "VPC association", d: "The link that lets a VPC resolve a private zone; the only access control." },
        { t: "Split-horizon DNS", d: "Same domain gives different answers to internal and external users." },
        { t: "Shadowing", d: "A private zone hides all public records of the same name that it doesn't contain." },
        { t: "Route 53 Resolver", d: "The DNS resolver built into every VPC, at the VPC base address plus two." }
      ],
      check: [
        {
          q: "A private hosted zone doesn't resolve from a newly created VPC. What should you check first?",
          options: ["That the VPC is associated and has DNS support and DNS hostnames enabled", "That the VPC is peered with another VPC", "That DNSSEC is enabled on the zone"],
          answer: 0,
          why: "Visibility comes from association plus the two VPC DNS attributes. Peering doesn't grant access, and private zones don't support DNSSEC signing."
        },
        {
          q: "After creating a private zone called example.com, instances can no longer resolve blog.example.com, which exists publicly. Why?",
          options: ["Private zones block internet access", "The private zone shadows the public one, and blog isn't in it", "The public zone was deleted automatically"],
          answer: 1,
          why: "Inside associated VPCs, the matching private zone answers everything under that name. Copy the record in, or use a subdomain like internal.example.com."
        }
      ]
    },
    "resolver-hybrid": {
      minutes: 4,
      tldr: [
        "Hybrid DNS connects AWS and on-premises name lookups. Remember the direction of the query.",
        "<strong>Inbound endpoint</strong>: on-premises asks AWS. On-prem DNS forwards AWS domains to the endpoint's fixed IPs.",
        "<strong>Outbound endpoint + forwarding rules</strong>: AWS asks on-premises. Instances keep using the normal VPC resolver.",
        "Share forwarding rules to other accounts with <strong>AWS RAM</strong>, so one central endpoint pair serves the whole organization.",
        "<strong>Query logging</strong> records every DNS query (Flow Logs don't); <strong>DNS Firewall</strong> blocks bad domains."
      ],
      analogy: "Two offices with separate receptionists. An inbound endpoint is a phone line into the AWS receptionist so on-prem staff can ask about AWS names. An outbound endpoint plus rules is the AWS receptionist's speed-dial: 'questions about corp.local, call head office'.",
      examTip: "Direction decides it: &ldquo;on-premises must resolve AWS private names&rdquo; → <strong>inbound</strong>; &ldquo;EC2 must resolve on-premises names&rdquo; → <strong>outbound + forwarding rule</strong>; both ways → both. Self-run DNS servers on EC2 are the legacy wrong answer.",
      terms: [
        { t: "Inbound endpoint", d: "Fixed IPs in your VPC that accept DNS queries from on-premises or other networks." },
        { t: "Outbound endpoint", d: "Network interfaces from which Resolver sends queries to on-premises DNS servers." },
        { t: "Forwarding rule", d: "Says 'for this domain, ask these DNS servers', attached to VPCs." },
        { t: "Resolver query logging", d: "Logs every DNS query made from your VPCs to S3, CloudWatch or Firehose." },
        { t: "DNS Firewall", d: "Blocks or allows DNS lookups by domain list, e.g. to stop data exfiltration." }
      ],
      check: [
        {
          q: "Servers in the on-premises data center must resolve records in a Route 53 private hosted zone. What do you set up?",
          options: ["Resolver outbound endpoint and a forwarding rule", "Resolver inbound endpoint plus a conditional forwarder on-premises", "Make the zone public"],
          answer: 1,
          why: "On-prem is asking AWS, so AWS needs a door that accepts queries: the inbound endpoint. Outbound is for AWS asking on-prem."
        },
        {
          q: "Security wants a record of every domain looked up by workloads in a VPC. What provides this?",
          options: ["VPC Flow Logs", "Route 53 Resolver query logging", "CloudTrail data events"],
          answer: 1,
          why: "Flow Logs specifically exclude traffic to the VPC resolver. Resolver query logging captures each DNS query."
        }
      ]
    },
    "dnssec-arc": {
      minutes: 5,
      tldr: [
        "<strong>DNSSEC</strong> signs your public DNS answers so resolvers can detect forged ones (spoofing, cache poisoning). It doesn't encrypt.",
        "Route 53 signs the zone; your <strong>key-signing key lives in KMS in us-east-1</strong>. Add the <strong>DS record at the registrar</strong> to complete the chain.",
        "<strong>Application Recovery Controller (ARC)</strong> makes Regional failover a deliberate, guarded operator action.",
        "ARC <strong>routing controls</strong> are on/off switches on a five-Region cluster; <strong>safety rules</strong> stop mistakes like turning every Region off.",
        "Readiness checks verify the standby (closed to new customers since April 2026; <strong>Region switch</strong> is the successor)."
      ],
      analogy: "DNSSEC is a wax seal on a letter: anyone can read it, but you can tell if it was tampered with. ARC is a big red switch in a protected control room: failover happens only when a person flips it, and a safety cover stops anyone switching off both sites at once.",
      examTip: "&ldquo;Protect a public domain from DNS spoofing&rdquo; → <strong>DNSSEC</strong> (TLS and Shield are distractors). &ldquo;Deliberate operator-driven failover with guardrails, independent of the failed Region&rdquo; → <strong>ARC</strong>. Automatic hands-off failover → plain health-check failover.",
      terms: [
        { t: "DNSSEC", d: "Cryptographic signatures on DNS answers so resolvers can verify they are genuine." },
        { t: "KSK (key-signing key)", d: "Your key, stored in KMS in us-east-1, that vouches for Route 53's zone-signing key." },
        { t: "DS record", d: "Record at the parent/registrar that links the chain of trust to your zone's key." },
        { t: "Routing control", d: "ARC on/off switch that flips a health check to move traffic between Regions." },
        { t: "Safety rule", d: "ARC guardrail, e.g. 'at least one Region must stay on'." }
      ],
      check: [
        {
          q: "A company enabled DNSSEC signing in Route 53, but validating resolvers still treat the domain as unsigned. What's missing?",
          options: ["A DS record at the parent zone/registrar", "DNSSEC validation on the VPC resolver", "A TLS certificate from ACM"],
          answer: 0,
          why: "The chain of trust needs the DS record at the parent. VPC-side validation is about your own lookups, not whether the world trusts your zone."
        },
        {
          q: "A critical app needs Regional failover to be a deliberate human decision, with guardrails, that works even if the primary Region is impaired. What fits?",
          options: ["Failover routing with fast health checks", "Application Recovery Controller routing controls and safety rules", "A Lambda function that edits DNS records"],
          answer: 1,
          why: "ARC's routing controls live on a highly available multi-Region cluster and safety rules prevent mistakes. Health-check failover is automatic, and a Lambda depends on the control plane during the outage."
        }
      ]
    }
  }
});
