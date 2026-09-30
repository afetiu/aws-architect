window.COURSE.registerLearn({
  moduleId: "migration-pro",
  bigPicture: "This module is about moving a <strong>whole company</strong> to AWS, not one app: thousands of servers, expensive database licenses, a mainframe, and a datacenter lease that ends on a fixed date. The order is always the same: <em>assess</em> what you have, <em>mobilize</em> (build the landing zone and the team), then <em>migrate</em> in waves and modernize along the way. On SAP-C02 this is about 20% of the exam, and most questions are really asking “what comes first?” or “which tool fits these constraints?”",
  cheatsheet: [
    { k: "Need a cost case before budget approval, no agents allowed", v: "<strong>Migration Evaluator</strong> (agentless) — right-sizes on real utilization" },
    { k: "Need to map app-to-app dependencies to plan waves", v: "<strong>ADS agent</strong> on servers — sees processes and connections" },
    { k: "Security forbids installing software on servers (VMware)", v: "<strong>ADS agentless collector</strong> in vCenter — no guest access" },
    { k: "One view of migration progress across tools and Regions", v: "<strong>Migration Hub</strong> with a home Region (AWS Transform for new customers)" },
    { k: "Company has no cloud experience, wants to move 2,000 servers", v: "<strong>Migration Readiness Assessment</strong> + mobilize phase first" },
    { k: "What to do FIRST before migrating workloads", v: "<strong>Landing zone</strong> (Control Tower), connectivity, identity — not per-app work" },
    { k: "Rehost thousands of servers with minimal downtime", v: "<strong>MGN</strong> — continuous block replication, test then cutover" },
    { k: "Be able to roll back quickly after cutover", v: "Keep source servers stopped, not deleted; low DNS TTL; rollback runbook" },
    { k: "Get rid of Oracle/SQL Server license costs", v: "<strong>SCT + DMS</strong> to Aurora PostgreSQL/MySQL" },
    { k: "Near-zero downtime move of a large database", v: "<strong>DMS full load + CDC</strong>, drain, repoint connections" },
    { k: "Windows Server BYOL or per-socket licenses without SA", v: "<strong>Dedicated Hosts + License Manager</strong>" },
    { k: "Mainframe: eliminate COBOL, developers are retiring", v: "<strong>Automated refactor</strong> (Blu Age / AWS Transform) to Java" },
    { k: "Mainframe: keep COBOL devs productive, exit fast", v: "<strong>Replatform</strong> onto a compatible runtime" },
    { k: "New services must react to legacy DB changes without touching the legacy app", v: "<strong>CDC</strong> (DMS or Debezium) into a stream" },
    { k: "Move a monolith gradually with incremental traffic shift", v: "<strong>Strangler fig</strong> — ALB/API Gateway weighted routing" },
    { k: "Data must stay in our building, sub-ms to local equipment", v: "<strong>Outposts</strong> — AWS hardware in your facility" },
    { k: "Single-digit ms for users in one city", v: "<strong>Local Zone</strong> — cheaper and simpler than Outposts" },
    { k: "Ultra-low latency for 5G mobile devices", v: "<strong>Wavelength</strong> — runs inside the carrier network" },
    { k: "Hundreds of TB, slow or busy link, tight deadline", v: "<strong>Snowball Edge fleet</strong> (then DataSync for the deltas)" },
    { k: "Central ops team is a bottleneck for every release", v: "Autonomous teams + <strong>guardrails and automation</strong>, not more approvals" }
  ],
  lessons: {
    "portfolio-business-case": {
      minutes: 5,
      tldr: [
        "Big migrations follow <strong>assess, mobilize, migrate</strong>. The first job is to see what you have and what it will cost.",
        "Discovery: <strong>agentless collector</strong> (VMware, no install, no dependencies) vs <strong>agent</strong> (per server, sees processes and connections for dependency maps).",
        "<strong>Migration Evaluator</strong> builds the TCO business case, sized on <em>actual usage</em>, not on what was provisioned.",
        "Every app gets one of the <strong>7 Rs</strong>; find the Retire and Retain ones first — the cheapest migration is none.",
        "Waves: pilot on low-risk apps, keep dependent apps together, save the critical core for last."
      ],
      analogy: "It is like moving house. First you walk through every room and decide what to throw away, what to keep, and what to replace. You price the move on what you actually use, not on the size of every cupboard. Then you move the garage first to practise, and the fragile heirlooms last.",
      examTip: "“No agents allowed” means the <strong>agentless collector</strong>; “map dependencies” means the <strong>agent</strong>. Any plan that moves the most critical app first, or rehosts 100% of servers without a retire/retain sweep, is a trap.",
      terms: [
        { t: "Application Discovery Service (ADS)", d: "Collects server inventory and usage, with an agentless VMware collector or per-server agents. Closed to new customers since Nov 2025." },
        { t: "Migration Hub", d: "One dashboard for migration status across tools, stored in a single <em>home Region</em>." },
        { t: "Migration Evaluator", d: "Free tool that produces a right-sized AWS cost case, including license options, before you commit." },
        { t: "MRA", d: "Migration Readiness Assessment: a workshop that lists gaps (skills, landing zone, governance) before migrating." },
        { t: "7 Rs", d: "Retire, Retain, Rehost, Relocate, Repurchase, Replatform, Refactor — the options for each app." },
        { t: "Migration wave", d: "A group of apps that move together, usually because they depend on each other." }
      ],
      check: [
        {
          q: "A VMware shop forbids installing any software on servers but needs usage data for a cost projection. What do you use?",
          options: ["ADS agent on every VM", "Agentless collector feeding Migration Evaluator", "AWS Compute Optimizer", "Migrate a sample with MGN and extrapolate"],
          answer: 1,
          why: "The agentless collector reads usage from vCenter without touching guests, and Migration Evaluator turns it into a right-sized business case. Compute Optimizer only analyzes resources already in AWS."
        },
        {
          q: "Which app should go in the pilot wave?",
          options: ["The ERP system, to prove value fast", "An internal wiki with few dependencies", "The core payments database"],
          answer: 1,
          why: "The pilot exists to test the process (runbooks, cutover, rollback), so it should be low-risk and simple. Critical, complex apps go in late waves once the team is experienced."
        }
      ]
    },

    "landing-zone-readiness": {
      minutes: 4,
      tldr: [
        "The <strong>landing zone is a prerequisite</strong>, not something you tidy up later. Moving into a messy account setup means migrating twice.",
        "Ready means five things: <strong>accounts</strong> (Organizations/OUs), <strong>identity</strong> (IAM Identity Center + your IdP), <strong>network</strong> (DX, TGW, IP plan, DNS), <strong>security baseline</strong>, <strong>operations</strong> (tags, logs, backup, cost).",
        "<strong>Control Tower</strong> is the fastest way to a governed multi-account setup; <strong>Account Factory</strong> hands out pre-baselined accounts.",
        "Size the network for replication traffic too — MGN syncs can flood a shared Direct Connect link."
      ],
      analogy: "Before tenants move into a new office building, you need the floors, keys, wiring and fire alarms in place. Letting them move in first and building the walls around them later is slow, expensive and dangerous.",
      examTip: "For “what should be done FIRST before migrating,” pick landing zone + connectivity + identity. Per-app tasks (rightsizing, building AMIs, containerizing) are real work but the wrong phase.",
      terms: [
        { t: "Landing zone", d: "A pre-built, secure multi-account AWS environment ready to receive workloads." },
        { t: "Control Tower", d: "Managed service that sets up Organizations, log and audit accounts, and guardrails in days." },
        { t: "Account Factory", d: "Control Tower feature that creates new accounts that are already compliant." },
        { t: "SCP", d: "Service control policy: an org-level rule setting the maximum permissions an account can ever have." },
        { t: "Route 53 Resolver endpoints", d: "Let AWS and on-prem resolve each other’s DNS names — a classic cutover-day failure point." }
      ],
      check: [
        {
          q: "A company wants to start migrating 500 servers next month and has only one AWS account. What should come first?",
          options: ["Rightsize every server for EC2", "Set up a multi-account landing zone with Control Tower, networking and identity", "Containerize the apps", "Buy Reserved Instances"],
          answer: 1,
          why: "The foundation must exist before workloads arrive, or you pay for a second migration into proper accounts. Rightsizing and containerizing are per-workload tasks for later."
        },
        {
          q: "Each application team needs consistent, compliant new AWS accounts. What is the best fit?",
          options: ["A wiki page of manual setup steps", "Control Tower Account Factory", "IAM users in a shared account"],
          answer: 1,
          why: "Account Factory creates accounts with the baseline and guardrails already applied. Manual steps drift, and a shared account removes the blast-radius boundary."
        }
      ]
    },

    "migration-factory": {
      minutes: 4,
      tldr: [
        "A <strong>migration factory</strong> is an assembly line for servers: standard steps, a dedicated team, measured in servers per week.",
        "<strong>MGN</strong> copies disks block-by-block, continuously, to a cheap staging area. You can <em>test launch</em> as often as you like, then do a short <em>cutover</em>.",
        "MGN is free for <strong>90 days per server</strong>. Its copies are crash-consistent, so move databases with DMS or native replication instead.",
        "Cutover is the hard part: lower DNS TTLs <em>days</em> ahead, smoke test, have a go/no-go point.",
        "Never delete the source at cutover. Stop it, soak for a business cycle, then decommission."
      ],
      analogy: "MGN is like a live mirror of each server’s disks kept in AWS. You can take the mirror out for a test drive any time without disturbing the original. On moving day you do one final sync and switch over, but you keep the old car in the garage until you are sure the new one works.",
      examTip: "“Thousands of servers, minimal changes, minimal downtime” means <strong>MGN</strong>. “Quick rollback” means keep the sources intact with low DNS TTL; options that decommission at cutover or rely on restoring AMI backups are traps. VM Import/Export is a distractor for large live estates.",
      terms: [
        { t: "MGN", d: "AWS Application Migration Service: continuous block-level replication for lift-and-shift to EC2." },
        { t: "Staging area", d: "Small replication servers and cheap EBS volumes in your account that hold the live copy." },
        { t: "Test launch", d: "Boots a copy from the replicated state without stopping the source or replication." },
        { t: "Cutover", d: "The final switch: last sync, launch the real instances, repoint DNS." },
        { t: "DNS TTL", d: "How long resolvers cache a record. Lower it days before cutover so switching back is fast." }
      ],
      check: [
        {
          q: "An app was cut over to AWS on Friday. The team wants to delete the source servers Saturday to save money. What is the risk?",
          options: ["None, MGN keeps a backup", "Rollback becomes a slow restore if a problem appears Monday", "DNS will stop working"],
          answer: 1,
          why: "Keeping the stopped source is what makes rollback quick. Once it is gone, reverting means restoring from backups, which takes days and loses recent data."
        },
        {
          q: "Why should DNS TTLs be lowered days before cutover rather than on the night?",
          options: ["AWS requires it for MGN", "The new, shorter TTL only applies after the old TTL has expired in caches", "Lower TTLs make replication faster"],
          answer: 1,
          why: "Resolvers keep the old record for the old TTL. Lowering it early means everyone is on the short TTL by cutover night, so DNS flips (and rollbacks) take effect quickly."
        }
      ]
    },

    "database-escape": {
      minutes: 4,
      tldr: [
        "<strong>SCT</strong> converts the schema and, more importantly, produces an <strong>assessment report</strong> of how much converts automatically.",
        "<strong>DMS</strong> moves the data: <strong>full load + CDC</strong> copies everything, then streams ongoing changes, so cutover downtime is minutes no matter the size.",
        "DMS moves data, not code: procedures, triggers and users are SCT/native-tool work. SCT does schemas, DMS does rows.",
        "License exit: Aurora/open-source RDS takes the license cost to zero. RDS Oracle EE is BYOL only; RDS SQL Server is license-included only.",
        "Cut licenses with <strong>Optimize CPUs</strong>; Windows Server BYOL needs <strong>Dedicated Hosts</strong>."
      ],
      analogy: "Changing database engines is like translating a book and moving a library at the same time. SCT is the translator who first tells you which chapters translate easily and which need a human. DMS is the moving van that keeps delivering new pages while the old library stays open until closing time.",
      examTip: "“Eliminate license costs, willing to change the app” means <strong>SCT + DMS to Aurora</strong>. “Near-zero downtime” means <strong>full load + CDC</strong>, not snapshot/restore. A classic trap claims DMS converts schemas — it does not.",
      terms: [
        { t: "SCT", d: "Schema Conversion Tool: converts schema between engines and reports what needs manual work." },
        { t: "DMS", d: "Database Migration Service: copies data between databases, with ongoing replication." },
        { t: "CDC", d: "Change data capture: reading the database’s transaction log to stream every change." },
        { t: "BYOL", d: "Bring your own license: you use licenses you already own instead of paying AWS per hour." },
        { t: "Babelfish", d: "Lets Aurora PostgreSQL understand SQL Server’s protocol, reducing app changes on a SQL Server exit." },
        { t: "Optimize CPUs", d: "Turn off cores or hyperthreading on EC2 to cut per-core license counts but keep the RAM." }
      ],
      check: [
        {
          q: "A 5 TB Oracle database must move to Aurora PostgreSQL with only minutes of downtime. What is the approach?",
          options: ["Export/import over a weekend", "SCT for the schema, DMS full load + CDC, then repoint", "DMS alone converts schema and data", "RDS snapshot restore into Aurora"],
          answer: 1,
          why: "SCT converts the schema and DMS copies data then keeps it in sync, so cutover is a short drain. Export/import downtime grows with size, and DMS does not convert schemas."
        },
        {
          q: "You want SQL Server on AWS using your own licenses. Where can it run?",
          options: ["RDS for SQL Server with BYOL", "EC2 (with License Mobility, or Dedicated Hosts)", "Aurora"],
          answer: 1,
          why: "Standard RDS for SQL Server is license-included only, so BYOL means EC2. Without Software Assurance License Mobility you need Dedicated Hosts."
        }
      ]
    },

    "mainframe-legacy": {
      minutes: 4,
      tldr: [
        "Mainframe choices: <strong>replatform</strong> (keep COBOL, run it on a compatible runtime) or <strong>automated refactor</strong> (convert COBOL to Java).",
        "Replatform = lower risk, faster, keeps existing COBOL skills. Refactor = off COBOL for good, but more testing and you own the generated code.",
        "<strong>Augment</strong> first: stream mainframe data to AWS with CDC so analytics and APIs stop using expensive mainframe capacity.",
        "<strong>Retain</strong> is sometimes right: replacement already planned, negative ROI, or a hard dependency. Write down what would unblock it.",
        "The real risk is batch jobs and testing: run old and new side by side through month-end before cutover."
      ],
      analogy: "Replatforming is moving an old family recipe book into a new kitchen that has the same kind of oven — the cooks keep working as before. Refactoring rewrites every recipe for a modern kitchen: better long term, but you must taste-test every dish against the original.",
      examTip: "“Developers retiring, eliminate COBOL” means <strong>automated refactor</strong>. “Keep existing devs productive, minimal change, exit fast” means <strong>replatform</strong>. “Cut mainframe cost without moving core apps” means <strong>offload data via CDC</strong>. MGN for a mainframe is nonsense — it only copies x86 disks.",
      terms: [
        { t: "Replatform (mainframe)", d: "Recompile COBOL with few changes and run it on a mainframe-compatible runtime on AWS." },
        { t: "Automated refactor", d: "Tools (Blu Age, now AWS Transform for mainframe) convert COBOL/JCL into Java services." },
        { t: "MIPS", d: "Mainframe capacity unit that drives the bill — offloading reads lowers it." },
        { t: "Data liberation", d: "Copying mainframe data to AWS via CDC while the mainframe stays the system of record." },
        { t: "Parallel run", d: "Running old and new systems on the same inputs and comparing outputs before switching." }
      ],
      check: [
        {
          q: "A bank’s COBOL developers are retiring, and it wants to remove its dependency on COBOL skills. Which path fits?",
          options: ["Replatform onto a COBOL-compatible runtime", "Automated refactor to Java", "Rehost the mainframe with MGN"],
          answer: 1,
          why: "Only refactor removes COBOL. Replatforming keeps the COBOL code and the same skills problem. MGN cannot copy a mainframe at all."
        },
        {
          q: "A company wants to lower mainframe costs quickly without migrating core transactions. What should it do first?",
          options: ["Replicate mainframe data to AWS with CDC for analytics and APIs", "Big-bang rewrite of the core", "Buy more MIPS on a bigger contract", "Retire the mainframe next month"],
          answer: 0,
          why: "Moving read-heavy analytics and API traffic off the mainframe cuts expensive capacity usage and proves the data model outside it, without touching core logic."
        }
      ]
    },

    "modernization-patterns": {
      minutes: 5,
      tldr: [
        "<strong>Strangler fig</strong>: put a routing layer (ALB or API Gateway) in front of the monolith and move features out one at a time.",
        "Rolling back a feature is just changing a routing rule. Weighted target groups let you shift traffic gradually.",
        "<strong>CDC</strong> on the old database lets new services react to changes without touching legacy code. Use a <strong>transactional outbox</strong> to avoid dual-write bugs.",
        "Extract by business capability, reads before writes, and split the data last.",
        "Under a deadline, <strong>containerize or rehost first</strong>, modernize later. Lambda suits spiky, short work — not steady heavy loads."
      ],
      analogy: "A strangler fig vine grows around an old tree until the tree is no longer needed. You do the same with software: a front door you control sends more and more visitors to new rooms, until the old building is empty.",
      examTip: "“Gradually migrate with incremental traffic shift and rollback” means <strong>strangler fig with weighted routing</strong>. “React to legacy database changes without modifying the legacy app” means <strong>CDC to a stream</strong>. A big-bang rewrite is always wrong at Pro level.",
      terms: [
        { t: "Strangler fig", d: "Replace a legacy system piece by piece behind a routing layer until it can be switched off." },
        { t: "Weighted target groups", d: "ALB feature that splits traffic by percentage between old and new versions." },
        { t: "Dual-write problem", d: "Writing to a database and a message bus separately; a crash in between leaves them out of sync." },
        { t: "Transactional outbox", d: "Save the event in the same DB transaction as the data; a relay publishes it afterwards." },
        { t: "Distributed monolith", d: "Many services that still must change and deploy together — all the cost, none of the benefit." }
      ],
      check: [
        {
          q: "New microservices must react to order changes in a legacy database, and the legacy app cannot be modified. What works?",
          options: ["Add publish calls to the legacy code", "Stream database changes with CDC (DMS or Debezium) to a bus", "Poll the database every hour from each service"],
          answer: 1,
          why: "CDC reads the transaction log, so nothing in the legacy app changes. Editing legacy code breaks the constraint, and hourly polling is slow and loads the database."
        },
        {
          q: "A team must leave its datacenter in 6 months with a stable Java monolith. What is the pragmatic plan?",
          options: ["Rewrite as microservices, then switch over", "Containerize or rehost now, then strangle incrementally in AWS", "Convert every servlet to a Lambda function"],
          answer: 1,
          why: "Under a deadline, move first and modernize in the cloud. A big-bang rewrite is too risky, and function-by-function Lambda conversion creates a distributed monolith."
        }
      ]
    },

    "hybrid-placement": {
      minutes: 4,
      tldr: [
        "All three extend a parent Region: control plane stays in the Region, some services run closer to you, as extra subnets of your VPC.",
        "<strong>Outposts</strong>: AWS racks or servers in <em>your</em> building — for data residency or sub-ms to local systems.",
        "<strong>Local Zones</strong>: AWS facility in a city — single-digit ms for users there. <strong>Wavelength</strong>: inside a 5G carrier network for mobile devices.",
        "With Outposts you own power, cooling and the network link. Capacity is only what you bought — no elastic scaling.",
        "An Outpost or Local Zone is basically one zone: plan your own HA, or fail over to the Region."
      ],
      analogy: "Think of the AWS Region as the head office. A Local Zone is a branch office in your city, Wavelength is a desk inside the phone company, and an Outpost is an AWS-owned cabinet installed in your own basement — you keep the lights on for it.",
      examTip: "“Data must not leave our facility” or “sub-ms to factory equipment” means <strong>Outposts</strong> (Local Zone is the planted wrong answer). “Single-digit ms for users in one city” means <strong>Local Zone</strong>. <strong>Wavelength</strong> is only for 5G mobile devices.",
      terms: [
        { t: "Outposts", d: "AWS-managed hardware (42U racks or 1U/2U servers) installed on your premises." },
        { t: "Local Zone", d: "Small AWS location in a metro area for low-latency access, priced above the parent Region." },
        { t: "Wavelength", d: "AWS compute inside a telecom 5G network so mobile traffic stays on the carrier." },
        { t: "Service link", d: "The network connection from an Outpost back to its parent Region." },
        { t: "Dedicated Local Zone", d: "A Local Zone built for one customer or community with strict sovereignty needs." }
      ],
      check: [
        {
          q: "A factory needs sub-millisecond latency to its machines, and data must stay on site. What fits?",
          options: ["Local Zone in the nearest city", "AWS Outposts", "Wavelength", "A Region with Direct Connect"],
          answer: 1,
          why: "Only Outposts puts AWS inside your own building. A Local Zone is an AWS facility, so data leaves the site and latency is ms, not sub-ms."
        },
        {
          q: "An Outpost rack is fully used and demand spikes. What happens if you try to launch more instances?",
          options: ["It scales automatically like a Region", "Launches fail; more capacity means a hardware order", "Instances spill into a Local Zone automatically"],
          answer: 1,
          why: "Outposts has only the capacity you ordered. Plan spare capacity locally or design failover to the parent Region."
        }
      ]
    },

    "data-scale-org": {
      minutes: 5,
      tldr: [
        "Do the maths first: <strong>1 Gbps ≈ 10 TB/day</strong>. 1 PB over 1 Gbps takes 100+ days.",
        "<strong>DataSync</strong>: online, verified, incremental copies to S3/EFS/FSx. <strong>Storage Gateway</strong> is hybrid access, not a bulk mover.",
        "<strong>Snowball Edge fleets</strong> beat slow links for hundreds of TB; combine bulk-by-device with DataSync for later changes. (New customers can no longer order Snow devices.)",
        "<strong>S3 Batch Operations</strong> acts on billions of objects already in S3.",
        "A <strong>CCoE</strong> sets standards and paved roads; a bottleneck central team is fixed with autonomous teams plus guardrails."
      ],
      analogy: "If you need to move a warehouse of books across the country, you do not post them one envelope at a time — you hire trucks (Snowball). Once the library is open, you just mail over the new books each week (DataSync).",
      examTip: "Divide data by bandwidth. If it does not fit the deadline, or the link is busy with production, pick <strong>Snowball Edge</strong>. If there is a fat link and ongoing changes until cutover, pick <strong>DataSync</strong>. For “central team slows every release,” pick automation and guardrails, not more approval steps.",
      terms: [
        { t: "DataSync", d: "Managed online transfer with checksums, schedules, throttling and incremental re-sync." },
        { t: "Snowball Edge", d: "Rugged, encrypted storage device shipped to you, loaded, and shipped back into S3." },
        { t: "S3 Batch Operations", d: "Runs one action (copy, tag, restore, Lambda) across huge lists of S3 objects." },
        { t: "CCoE", d: "Cloud Center of Excellence: small team that builds the standards and self-service paths." },
        { t: "Two-pizza team", d: "Small team that builds and runs its own service end to end." }
      ],
      check: [
        {
          q: "900 TB must move in 3 weeks over a 500 Mbps link. What do you choose?",
          options: ["DataSync over the link", "Snowball Edge devices in parallel", "Storage Gateway File Gateway", "S3 Transfer Acceleration"],
          answer: 1,
          why: "500 Mbps is about 5 TB/day, roughly 105 TB in 3 weeks — far short. Devices in parallel beat the link. Storage Gateway and Transfer Acceleration do not fix the bandwidth maths."
        },
        {
          q: "Every release waits for a central ops team’s approval, and velocity is falling. What is the Pro-level fix?",
          options: ["Add a change advisory board", "Hire a bigger central team", "Give product teams CI/CD pipelines with automated guardrails"],
          answer: 2,
          why: "Guardrails (SCPs, permission boundaries, policy checks in pipelines) keep safety while removing the manual gate. Adding process or headcount keeps the bottleneck."
        }
      ]
    }
  }
});
