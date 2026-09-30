window.COURSE.registerLearn({
  moduleId: "pro-scenarios",
  bigPicture: "This module is exam technique. Almost every SAP-C02 question is a short version of one of six stories: going <strong>multi-Region</strong>, fixing a <strong>hybrid network</strong> after a merger, handling a <strong>security incident</strong>, cutting a <strong>cost blowout</strong>, <strong>modernizing a monolith</strong>, or building <strong>tiered DR</strong>. Each lesson shows the method: pull out the requirements, compare the options honestly, pick the cheapest one that meets every constraint, and learn the traps the exam hides in the wrong answers.",
  cheatsheet: [
    { k: "Lowest failover time, partners allowlist static IPs", v: "<strong>Global Accelerator</strong> — anycast static IPs, no DNS caching delay" },
    { k: "Local reads everywhere, strongly consistent relational writes", v: "<strong>Aurora Global Database</strong> (single writer, write forwarding)" },
    { k: "Stop duplicate payments when clients retry", v: "<strong>Idempotency keys</strong> + conditional writes, not SQS FIFO" },
    { k: "EU PII must stay in the EU in a global app", v: "<strong>Partition</strong> EU data in an EU cell; replicate only non-PII" },
    { k: "Overlapping CIDRs, consume one service across companies", v: "<strong>PrivateLink</strong> — overlap does not matter" },
    { k: "Inspect all inter-VPC and egress traffic", v: "<strong>Inspection VPC</strong> + TGW routing + appliance mode" },
    { k: "Resilient hybrid connectivity", v: "Two DX at <strong>different locations</strong> + VPN backup" },
    { k: "Compromised EC2, preserve evidence", v: "<strong>Isolate SG + snapshot</strong>, deactivate keys — never terminate first" },
    { k: "Auto-remediate GuardDuty findings in every account", v: "Delegated admin + <strong>EventBridge</strong> + Lambda/Step Functions" },
    { k: "No one, not even admins, may disable CloudTrail", v: "<strong>SCP</strong> — only SCPs bind every principal in member accounts" },
    { k: "Roll out restrictions without breaking workloads", v: "Analyze usage, then <strong>canary OU</strong>, then OU by OU" },
    { k: "High NAT gateway charges for S3/DynamoDB traffic", v: "<strong>Gateway VPC endpoints</strong> — free" },
    { k: "Cost program: what to do FIRST", v: "<strong>Visibility</strong>: CUR, tags, accounts per team — before optimizing" },
    { k: "Uncertain mix of EC2, Fargate, Lambda; may move to Graviton", v: "<strong>Compute Savings Plans</strong> — flexibility over depth" },
    { k: "Shift % of traffic to a new service, roll back instantly", v: "<strong>ALB weighted target groups</strong>, not Route 53 weights" },
    { k: "Publish events exactly when state commits", v: "<strong>Transactional outbox</strong>" },
    { k: "RTO minutes, RPO near zero, cannot re-architect", v: "<strong>Elastic Disaster Recovery (DRS)</strong>" },
    { k: "RTO hours, RPO 1 h, cheapest", v: "<strong>Pilot light</strong> — data live, compute off" },
    { k: "One DR strategy applied to 120 apps", v: "Wrong — <strong>tier</strong> by business impact" }
  ],
  lessons: {
    "scenario-active-active": {
      minutes: 4,
      tldr: [
        "Money data (orders, payments) needs <strong>one writer</strong>: Aurora Global Database with local reads and write forwarding.",
        "Lossy, idempotent data (sessions, carts) can use <strong>DynamoDB Global Tables</strong> with local writes everywhere.",
        "<strong>Global Accelerator</strong> fails over faster than Route 53 and gives static IPs.",
        "<strong>Idempotency keys</strong> stop double charges when a client retries during failover.",
        "Residency rules mean <em>partition</em> the data (EU cell), not replicate it everywhere."
      ],
      analogy: "A global shop can have reading rooms in every city, but only one cashier’s ledger. Everyone can look at the catalogue locally; every sale is written in the single ledger, so nobody is ever charged twice.",
      examTip: "“Strongly consistent writes with local reads” means <strong>Aurora Global Database</strong>. “Static IPs + fastest regional failover” means <strong>Global Accelerator</strong>. Eliminate RDS Multi-AZ offered as a multi-<em>Region</em> answer, and anything replicating EU PII worldwide.",
      terms: [
        { t: "Active-active", d: "Two or more Regions serve live traffic at the same time." },
        { t: "Aurora Global Database", d: "One write Region plus read-only copies in other Regions, about 1 s behind." },
        { t: "Write forwarding", d: "A secondary Aurora Region passes writes to the primary so app code stays simple." },
        { t: "Last-writer-wins", d: "Default Global Tables conflict rule: the latest write silently overwrites the other." },
        { t: "Idempotency key", d: "A unique ID per request, so repeating it has no extra effect." }
      ],
      check: [
        {
          q: "A global app needs local reads in three Regions and strongly consistent writes for orders, with little app change. Which database design fits?",
          options: ["DynamoDB Global Tables in default mode", "Aurora Global Database with write forwarding", "RDS Multi-AZ", "Aurora multi-master across Regions"],
          answer: 1,
          why: "Aurora Global keeps a single writer, so writes are consistent, while reads are local. Default Global Tables use last-writer-wins, and Multi-AZ only covers one Region."
        },
        {
          q: "How do you prevent a customer being charged twice if their payment call is retried during failover?",
          options: ["Put payments on an SQS FIFO queue", "Store a client-generated idempotency key with a conditional write", "Lower the Route 53 TTL"],
          answer: 1,
          why: "The conditional write rejects the second attempt with the same key. SQS FIFO only dedupes for 5 minutes and does not fit a synchronous payment call."
        }
      ]
    },

    "scenario-hybrid-network": {
      minutes: 4,
      tldr: [
        "After a merger, IP ranges overlap. <strong>VPC peering and TGW cannot route overlapping ranges.</strong>",
        "<strong>PrivateLink</strong> solves it for service-shaped traffic: the consumer uses a local endpoint, so overlap is irrelevant.",
        "For awkward legacy flows, use <strong>private NAT gateways</strong> in a bridging VPC to translate addresses.",
        "Central <strong>inspection VPC</strong> (Network Firewall/GWLB) with TGW routing and <strong>appliance mode</strong> for symmetric flows.",
        "Re-numbering is the long-term destination, not the 90-day plan."
      ],
      analogy: "Two companies both have an office at “10 Main Street” in different towns, so a letter addressed there is ambiguous. PrivateLink is like giving each team a private mailbox in their own lobby that delivers straight to the other company — nobody needs the street address at all.",
      examTip: "“Overlapping CIDRs + consume a service with least overhead” means <strong>PrivateLink</strong>. Peering is rejected with overlaps, TGW cannot propagate them, and “renumber” breaks the stated constraint. Two DX circuits in the <em>same</em> location is a trap.",
      terms: [
        { t: "CIDR overlap", d: "Two networks use the same IP range, so routers cannot tell them apart." },
        { t: "PrivateLink", d: "Exposes a service behind an NLB as an endpoint inside the consumer’s VPC." },
        { t: "Private NAT gateway", d: "Translates private IPs to another private range, used to bridge overlaps." },
        { t: "Appliance mode", d: "TGW setting that keeps both directions of a flow on the same firewall." },
        { t: "Inspection VPC", d: "A central VPC with firewalls that all inter-network traffic is routed through." }
      ],
      check: [
        {
          q: "Company A must call an API in Company B. Their VPCs use the same CIDR. What has the least overhead?",
          options: ["VPC peering", "Attach both to one Transit Gateway", "Expose the API with PrivateLink", "Renumber Company B"],
          answer: 2,
          why: "PrivateLink does not need a routed path between VPCs, so overlap is fine. Peering and TGW both fail with overlapping routes, and renumbering is heavy."
        },
        {
          q: "Traffic through a stateful firewall behind a TGW gets random resets. What is the likely fix?",
          options: ["Enable appliance mode on the inspection VPC attachment", "Add more NAT gateways", "Switch to VPC peering"],
          answer: 0,
          why: "Without appliance mode, return traffic can hit a different firewall that never saw the connection. Appliance mode keeps flows symmetric."
        }
      ]
    },

    "scenario-incident-hardening": {
      minutes: 4,
      tldr: [
        "Order: <strong>contain credentials</strong> (deactivate key, deny-all, revoke sessions, hunt for persistence), then <strong>contain instances</strong>, then rebuild.",
        "<strong>Isolate and snapshot, never terminate first</strong> — termination destroys evidence. Do not delete the IAM user either.",
        "Detect and respond org-wide: GuardDuty + Security Hub + org CloudTrail, with <strong>EventBridge → Lambda/Step Functions</strong> auto-containment.",
        "Roll out SCPs <strong>carefully</strong>: no dry-run exists, so check usage in CloudTrail, try a canary OU, expand OU by OU.",
        "Replace long-lived keys: SSO for people, OIDC for CI/CD, roles for workloads."
      ],
      analogy: "When a burglar is found in a building, you change the locks, lock the room they are in and photograph everything — you do not bulldoze the room, because that destroys the evidence of how they got in.",
      examTip: "“Preserve evidence” means <strong>isolation security group + EBS snapshot</strong>; “terminate immediately” is the trap. “Stop anyone, including admins, disabling logging” means an <strong>SCP</strong>. Remember: SCPs never grant, do not apply to the management account, and exempt service-linked roles.",
      terms: [
        { t: "Isolation security group", d: "A security group with no rules, cutting all traffic while the instance keeps running." },
        { t: "Delegated administrator", d: "A member account (e.g. security) allowed to manage a service for the whole org." },
        { t: "Revoke sessions", d: "Denies all temporary credentials issued before now for a role." },
        { t: "Canary OU", d: "A low-risk OU where a new SCP is applied first to see what breaks." },
        { t: "OIDC federation", d: "CI/CD systems get short-lived AWS credentials without stored access keys." }
      ],
      check: [
        {
          q: "GuardDuty flags crypto mining on an EC2 instance. What should happen first to that instance?",
          options: ["Terminate it", "Apply an isolation security group and snapshot its volumes", "Reboot it", "Delete its IAM role"],
          answer: 1,
          why: "Isolation stops the damage while keeping disk (and memory) evidence. Terminating destroys evidence; deleting the role breaks attribution."
        },
        {
          q: "A new region-restriction SCP must roll out across 60 accounts without breaking production. What is the right approach?",
          options: ["Attach it at the org root on a quiet Friday", "Use IAM permission boundaries instead", "Check CloudTrail for affected actions, apply to a canary OU, then expand"],
          answer: 2,
          why: "SCPs have no audit mode and affect every principal, so you pre-check usage and stage the rollout. Boundaries only bind roles you manage, not whole accounts."
        }
      ]
    },

    "scenario-cost-program": {
      minutes: 4,
      tldr: [
        "Order: <strong>visibility → waste and architecture fixes → commitments</strong>. Committing first locks in waste.",
        "Visibility: CUR (Data Exports) + Athena, tag policies, account per team, Cost Anomaly Detection (free).",
        "Usual suspects: NAT data processing (use <strong>gateway endpoints</strong> for S3/DynamoDB), cross-AZ traffic, oversized instances, debug logs, S3 without lifecycle.",
        "Then discount: <strong>Compute Savings Plans</strong> for the steady floor, RIs for databases, <strong>Spot</strong> for batch and CI."
      ],
      analogy: "Before you negotiate a cheaper phone contract, first stop the kids streaming video on mobile data at home. Fix the usage, then lock in the price — otherwise you commit to paying for waste.",
      examTip: "“High NAT charges for S3 access” means <strong>gateway VPC endpoints</strong> (free). “What first in a cost program” means <strong>visibility and tagging</strong>. Numbers: NAT 4.5c/GB, inter-AZ 1c/GB each way, CloudWatch logs 50c/GB, Spot up to ~90%, SPs/RIs up to ~72%.",
      terms: [
        { t: "CUR", d: "Cost and Usage Report: the most detailed billing data, now delivered through Data Exports." },
        { t: "Gateway VPC endpoint", d: "Free private route to S3 or DynamoDB that bypasses the NAT gateway." },
        { t: "Compute Savings Plans", d: "Commit to a $/hour spend; discount applies across EC2, Fargate and Lambda, any family or Region." },
        { t: "Cost Anomaly Detection", d: "Free ML alerting when spend jumps unexpectedly." },
        { t: "Showback", d: "Showing each team its own costs so they own them." }
      ],
      check: [
        {
          q: "Private subnets send terabytes to S3 through a NAT gateway and the bill is huge. What is the cheapest fix?",
          options: ["A larger NAT gateway", "An S3 interface endpoint", "An S3 gateway VPC endpoint", "Move the instances to public subnets"],
          answer: 2,
          why: "Gateway endpoints for S3 are free and take S3 traffic off the NAT. Interface endpoints work but charge per GB and hour; NAT gateways have no bigger size."
        },
        {
          q: "A company has no commitments and plans heavy rightsizing plus a Graviton move. When should it buy Savings Plans?",
          options: ["Immediately, 3-year, to lock in savings", "After cleanup, sized on the new steady floor", "Never, Spot is always cheaper"],
          answer: 1,
          why: "Commitments sized on today’s wasteful fleet get stranded by the cleanup. Fix usage first, then commit to the real floor with flexible Compute Savings Plans."
        }
      ]
    },

    "scenario-strangler-migration": {
      minutes: 4,
      tldr: [
        "Two deadlines: ship quoting weekly in 6 months, leave the datacenter in 20. Only a <strong>strangler fig</strong> meets both.",
        "Step 1 is an <strong>ALB facade</strong> in front of the monolith — no behaviour change, full routing control.",
        "Extract quoting to ECS Fargate, fed by <strong>DMS CDC</strong> from Oracle; ramp with weighted target groups.",
        "Use a <strong>transactional outbox</strong> for events, and set up <strong>reverse CDC</strong> before any write cutover so rollback is real.",
        "Rehost the rest for the exit date; touch the regulated billing system last."
      ],
      analogy: "It is like renovating a restaurant while it stays open. You first put a host at the door who decides which room each guest goes to. Then you open one new room at a time, and if a room has a problem, the host just sends guests back to the old one.",
      examTip: "“Shift a percentage and roll back instantly” means <strong>ALB weighted target groups</strong> (Route 53 weights are slowed by DNS caching). “Previous rewrite failed” or “no big-bang” means eliminate every parallel-rewrite option. A Java-strong, cloud-new team points to <strong>containers</strong>, not a Lambda rewrite.",
      terms: [
        { t: "Routing facade", d: "A layer you control (ALB/API Gateway) in front of the old app that decides where requests go." },
        { t: "Shadow traffic", d: "Copying real requests to the new service and comparing answers, without users seeing it." },
        { t: "Reverse CDC", d: "Replicating new-service writes back to the old database so you can fall back." },
        { t: "Bounded context", d: "A clear business area (quoting, billing) that can own its own data and service." }
      ],
      check: [
        {
          q: "A new service needs monolith data, and the monolith cannot be changed. What is the best option?",
          options: ["Share the monolith database forever", "Have the app write to both databases", "Replicate with DMS CDC into the service’s own database"],
          answer: 2,
          why: "CDC keeps the new database current with no monolith code change. A shared DB couples deployments, and dual writes cause silent inconsistencies."
        },
        {
          q: "Why configure reverse CDC before moving write ownership to the new service?",
          options: ["It speeds up the new service", "So a rollback does not lose the writes made after cutover", "DMS requires it"],
          answer: 1,
          why: "If the old database never received the new writes, falling back would lose data, so the rollback option would not really exist."
        }
      ]
    },

    "scenario-tiered-dr": {
      minutes: 4,
      tldr: [
        "Do a <strong>business-impact analysis</strong>, then tier apps. Publishing each tier’s price stops everyone claiming Tier 1.",
        "Tiers map to strategies: <strong>backup and restore</strong> (days), <strong>pilot light</strong> (hours), <strong>warm standby</strong> (about an hour), <strong>active-active</strong> (minutes).",
        "Pilot light = data live, compute off. Warm standby = small but running full stack.",
        "<strong>Elastic Disaster Recovery</strong> gives low RTO/RPO for apps you cannot re-architect.",
        "Only tested DR counts: restore tests, game-days, and scorecards are the audit evidence."
      ],
      analogy: "You insure your house, car and bike differently. It would be silly to pay the same premium for the bike as for the house. DR tiers do the same: the money paths get expensive cover, internal tools get cheap cover.",
      examTip: "The exam grades on <strong>the cheapest option that meets the RTO/RPO</strong>. RTO 4 h / RPO 1 h with lowest cost means pilot light, not warm standby. “Low RTO/RPO, cannot re-architect” means <strong>DRS</strong>. One strategy for the whole portfolio is always wrong.",
      terms: [
        { t: "RTO", d: "Recovery time objective: how long you can be down." },
        { t: "RPO", d: "Recovery point objective: how much recent data you can afford to lose." },
        { t: "Pilot light", d: "Data replicates continuously; compute is templates at zero until needed." },
        { t: "Warm standby", d: "A scaled-down but running copy of the full stack in another Region." },
        { t: "Elastic Disaster Recovery (DRS)", d: "Continuous block replication to AWS for fast recovery without redesigning the app." }
      ],
      check: [
        {
          q: "An app needs RTO 4 hours and RPO 1 hour at the lowest cost. Which strategy?",
          options: ["Active-active", "Warm standby", "Pilot light", "Backup and restore with weekly backups"],
          answer: 2,
          why: "Pilot light meets hours-level RTO with live data at low cost. Warm standby also works but costs more; weekly backups miss the 1-hour RPO."
        },
        {
          q: "An auditor asks for proof that DR works. What do you provide?",
          options: ["A documented runbook in the wiki", "Results from scheduled failover game-days and automated restore tests", "The AWS SLA"],
          answer: 1,
          why: "Only executed tests with measured RTO/RPO prove capability. An untested runbook is often out of date and proves nothing."
        }
      ]
    }
  }
});
