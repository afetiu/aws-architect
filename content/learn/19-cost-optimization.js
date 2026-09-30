/* Learning layer — Module 19: Cost Optimization & Billing */
window.COURSE.registerLearn({
  moduleId: "cost",
  bigPicture: "You can't memorise AWS prices, but you can learn <strong>what each service charges for</strong>: time it's running, requests, bytes stored, and bytes moved. Once you see those four, 'MOST cost-effective' questions become simple: remove a charge entirely if you can, discount it if you can't, and never pay for things sitting idle. Cost is about 20% of SAA-C03, and data transfer and commitments come up almost every time.",
  cheatsheet: [
    { k: "Private subnet reaching S3 or DynamoDB through a NAT Gateway", v: "<strong>Gateway VPC endpoint</strong> — free, kills NAT per-GB charges" },
    { k: "Is data transfer free?", v: "In from internet: <strong>free</strong>. Out to internet, across AZs (both ways), across regions: <strong>paid</strong>" },
    { k: "Cut internet egress for content delivery", v: "<strong>CloudFront</strong> — cheaper egress, origin fetch from AWS free" },
    { k: "Steady EC2 for years, maximum discount", v: "<strong>Standard RI or EC2 Instance Savings Plan</strong> (~72%)" },
    { k: "Might change instance family, region, or move to Fargate/Lambda", v: "<strong>Compute Savings Plan</strong> (~66%, most flexible)" },
    { k: "Guarantee capacity in a specific AZ", v: "<strong>On-Demand Capacity Reservation</strong> or zonal RI — not a regional RI or SP" },
    { k: "RDS database running 24/7 for years", v: "<strong>RDS Reserved Instance</strong> — Compute SPs don't cover RDS" },
    { k: "Batch, fault-tolerant, can be interrupted", v: "<strong>Spot</strong> — up to 90% off, 2-minute warning" },
    { k: "Critical, stateful, can't be interrupted", v: "<strong>Never Spot</strong>; On-Demand + commitments" },
    { k: "Order of cost-saving steps", v: "<strong>Measure → rightsize → schedule off-hours → Spot → commit</strong>" },
    { k: "Unknown or changing S3 access patterns", v: "<strong>S3 Intelligent-Tiering</strong> — no retrieval fees or minimums" },
    { k: "Archive, retrieval within 12 hours, lowest cost", v: "<strong>S3 Glacier Deep Archive</strong> (180-day minimum)" },
    { k: "Mystery S3 storage growth", v: "Lifecycle: <strong>abort incomplete multipart uploads</strong>, expire old versions" },
    { k: "Cheaper EBS with the same performance", v: "<strong>gp2 → gp3</strong>, about 20% cheaper" },
    { k: "Aurora I/O charges large or spiky (over ~25% of bill)", v: "<strong>Aurora I/O-Optimized</strong>" },
    { k: "Reduce API Gateway cost, no REST-only features used", v: "<strong>Switch REST API to HTTP API</strong> (~3.5x cheaper)" },
    { k: "Alert before overspend / auto-stop when budget breached", v: "<strong>Budgets</strong> forecasted alert / <strong>Budget Actions</strong>" },
    { k: "Detect unusual spend without setting thresholds", v: "<strong>Cost Anomaly Detection</strong> (free, ML-based)" },
    { k: "Most granular cost data, query with SQL", v: "<strong>CUR 2.0 to S3 + Athena</strong>" },
    { k: "Costs by team or project", v: "<strong>Cost allocation tags</strong> — must be <em>activated</em> — plus Cost Categories" }
  ],
  lessons: {
    "pricing-dimensions": {
      minutes: 3,
      tldr: [
        "Every AWS service charges on 2-4 <strong>dimensions</strong>: time running, requests, bytes stored, bytes moved.",
        "Each punishes a habit: <strong>idle</strong> resources, <strong>chatty</strong> calls, <strong>hoarding</strong> data, bad <strong>network paths</strong>.",
        "Two services doing the same job often charge on different dimensions, so the cheaper one depends on your traffic shape.",
        "Best move: <strong>eliminate a dimension</strong> (e.g. gateway endpoint instead of NAT). Next best: discount it. Worst: pay for it idle.",
        "Think in <strong>unit costs</strong> (cost per customer or request), not just the total bill."
      ],
      analogy: "A taxi fare has a flag-drop, a per-kilometre rate and a waiting-time rate. You don't need the exact prices to know that leaving the meter running outside a shop is waste. AWS services work the same way.",
      examTip: "For 'MOST cost-effective', ask which option <strong>removes a charge completely</strong>: gateway endpoint removes NAT processing, Intelligent-Tiering removes paying hot rates for cold data, Spot removes the on-demand premium.",
      terms: [
        { t: "Pricing dimension", d: "The thing a service bills on: hours, requests, GB stored, or GB transferred." },
        { t: "Time x capacity", d: "Billed while provisioned, used or not: EC2 hours, NAT hours, RDS nodes." },
        { t: "LCU", d: "Load Balancer Capacity Unit: ALB/NLB usage charge on top of the hourly fee." },
        { t: "Usage type", d: "Line-item label in billing data (e.g. NatGateway-Bytes) that reveals the dimension." },
        { t: "Unit economics", d: "Cost per customer, request or GB, used to judge whether spend growth is healthy." }
      ],
      check: [
        {
          q: "An ALB serves almost no traffic for a month. What does it cost?",
          options: ["Nothing, it's pay per request", "Its hourly charge, plus minimal LCUs", "Only data transfer"],
          answer: 1,
          why: "Load balancers bill per hour just for existing, plus LCUs for usage. Idle provisioned resources still cost money."
        },
        {
          q: "Which option usually saves the most: discounting a charge, or removing that charge completely?",
          options: ["Discounting with a 3-year commitment", "Removing the charge, e.g. a gateway endpoint instead of NAT", "They are always equal"],
          answer: 1,
          why: "A removed dimension costs zero; a discounted one still costs something. That's why the exam prefers architectural fixes."
        }
      ]
    },
    "data-transfer": {
      minutes: 4,
      tldr: [
        "Into AWS from the internet: <strong>free</strong>. Out to the internet: ~9 cents/GB (first 100 GB/month free).",
        "Between AZs: ~1 cent/GB <strong>in each direction</strong>. Between regions: ~2 cents/GB, charged once. Same AZ on private IPs: free.",
        "NAT Gateway charges <strong>per hour and per GB processed</strong>. Sending S3 traffic through NAT is the classic waste.",
        "Cost order to reach S3/DynamoDB privately: <strong>gateway endpoint (free) &lt; interface endpoint &lt; NAT</strong>.",
        "Transit Gateway adds a per-GB fee; VPC peering doesn't. CloudFront egress is cheaper than direct egress."
      ],
      analogy: "Data transfer is a toll road system: driving into the city is free, leaving costs money, crossing between districts (AZs) is tolled both ways, and a NAT Gateway is a private toll booth you didn't need because the S3 gateway endpoint is a free side road.",
      examTip: "'Reduce NAT Gateway charges for S3 access' → <strong>gateway VPC endpoint</strong>. Only <strong>S3 and DynamoDB</strong> have the free gateway type — memorise that pair. 'Reduce internet egress' → <strong>CloudFront</strong>.",
      terms: [
        { t: "Egress", d: "Data leaving AWS to the internet; the main data-transfer charge." },
        { t: "Inter-AZ transfer", d: "Traffic between Availability Zones; billed on both the sending and receiving side." },
        { t: "Gateway endpoint", d: "Free route table entry giving private access to S3 or DynamoDB only." },
        { t: "Interface endpoint", d: "PrivateLink network interface for other services; hourly per AZ plus per GB." },
        { t: "NAT Gateway processing", d: "Per-GB fee on every byte passing through the NAT, on top of hourly." }
      ],
      check: [
        {
          q: "EC2 in private subnets downloads 10 TB a day from S3 through a NAT Gateway. Cheapest fix?",
          options: ["Interface VPC endpoint for S3", "Gateway VPC endpoint for S3", "Move the instances to a public subnet"],
          answer: 1,
          why: "A gateway endpoint for S3 has no hourly or per-GB charge. An interface endpoint works but still bills; public subnets change your security posture."
        },
        {
          q: "Two microservices in different AZs exchange lots of data. How is that transfer billed?",
          options: ["Free, it's the same region", "Charged in both directions", "Charged only on the sender side"],
          answer: 1,
          why: "Inter-AZ traffic is charged on both sides, about 1 cent/GB each way. 'Same region' doesn't mean free. Sender-only is the inter-region rule."
        }
      ]
    },
    "commitments": {
      minutes: 4,
      tldr: [
        "Commit to 1 or 3 years for 30-72% off. Match the commitment's <strong>flexibility</strong> to how certain your usage is.",
        "<strong>Compute Savings Plan</strong> (~66%): any EC2 family or region, plus Fargate and Lambda. <strong>EC2 Instance SP / Standard RI</strong> (~72%): one family, one region.",
        "<strong>Convertible RI</strong> can be exchanged for other families. Only <strong>zonal RIs</strong> or <strong>Capacity Reservations</strong> guarantee capacity.",
        "Databases use their own RIs (RDS, ElastiCache, Redshift, OpenSearch). Compute SPs don't cover them.",
        "Commit to your usage <strong>floor</strong>, not the average, and only after rightsizing. Discounts are shared across an Organization."
      ],
      analogy: "On-demand is paying per ride; a Savings Plan is a monthly transit pass. A Compute SP is a pass valid on any bus line in any city; an EC2 Instance SP is cheaper but only valid on one line.",
      examTip: "'Might change family/region/move to Fargate' → <strong>Compute SP</strong>. 'Guarantee capacity' → <strong>zonal RI or ODCR</strong> (regional RIs and SPs reserve nothing). 'RDS 24/7 for years' → <strong>RDS RI</strong>. Discount order: Spot ~90% &gt; 3-yr RI ~72% &gt; Compute SP ~66%.",
      terms: [
        { t: "Standard RI", d: "Biggest RI discount, locked to a family/region; resellable on the RI Marketplace." },
        { t: "Convertible RI", d: "Slightly smaller discount but exchangeable for other families, OS, or tenancy." },
        { t: "Compute Savings Plan", d: "Commit dollars per hour; applies to any EC2, Fargate or Lambda usage." },
        { t: "ODCR", d: "On-Demand Capacity Reservation: guarantees capacity in an AZ, no discount by itself." },
        { t: "Coverage vs utilization", d: "Coverage = usage that got a discount; utilization = commitment actually used." }
      ],
      check: [
        {
          q: "A company runs EC2 today but plans to move much of it to Fargate and Lambda next year. Which commitment?",
          options: ["3-year Standard RI", "Compute Savings Plan", "EC2 Instance Savings Plan"],
          answer: 1,
          why: "Only Compute SPs also cover Fargate and Lambda, so the discount follows the migration. Standard RIs and EC2 Instance SPs stay tied to one EC2 family."
        },
        {
          q: "A DR plan needs guaranteed EC2 capacity in one specific AZ during a failover. What provides that?",
          options: ["Regional Reserved Instance", "Compute Savings Plan", "On-Demand Capacity Reservation"],
          answer: 2,
          why: "Capacity Reservations (or zonal RIs) reserve real capacity in an AZ. Regional RIs and Savings Plans give discounts only, not capacity."
        }
      ]
    },
    "spot-rightsizing": {
      minutes: 4,
      tldr: [
        "<strong>Spot</strong> = spare capacity, up to <strong>90% off</strong>, with a <strong>2-minute warning</strong> before AWS takes it back. No bidding wars any more.",
        "Spread across many instance types and AZs; use the <strong>price-capacity-optimized</strong> allocation strategy.",
        "Good for batch, CI, rendering, EMR task nodes. Mix an On-Demand base (covered by a Savings Plan) with Spot on top.",
        "<strong>Rightsizing</strong> first: <strong>Compute Optimizer</strong> for sizes (incl. Graviton), stop dev/test at night, delete abandoned resources.",
        "Order: <strong>measure → rightsize → schedule → Spot → commit</strong>. Commitments go last because they're hardest to undo."
      ],
      analogy: "Spot is flying standby: very cheap, but you might get bumped with short notice. Great for flexible trips, terrible for a wedding you can't miss.",
      examTip: "'Fault-tolerant, batch, can be interrupted' → <strong>Spot</strong>. 'Critical, stateful, can't be interrupted' → never Spot, however big the discount shown. Tested literals: <strong>2-minute warning, up to 90%</strong>.",
      terms: [
        { t: "Spot interruption notice", d: "2-minute warning via EventBridge and instance metadata before reclaim." },
        { t: "Spot pool", d: "One instance type in one AZ; interruptions hit pools independently." },
        { t: "Price-capacity-optimized", d: "Allocation strategy choosing pools with spare capacity and low price." },
        { t: "Compute Optimizer", d: "Recommends right sizes for EC2, ASG, EBS, Lambda and Fargate from metrics." },
        { t: "Instance scheduler", d: "Automation that stops non-production resources outside working hours." }
      ],
      check: [
        {
          q: "A nightly video-render batch can restart failed frames and must finish by morning. Cheapest reliable design?",
          options: ["One Spot instance type in one AZ", "Spot across many types and AZs with On-Demand fallback", "3-year Reserved Instances"],
          answer: 1,
          why: "Diversified Spot gives the discount while avoiding one pool being reclaimed at once; fallback ensures completion. RIs pay 24/7 for a nightly job."
        },
        {
          q: "Why should you rightsize before buying Reserved Instances?",
          options: ["RIs can't be bought for oversized instances", "Otherwise you lock in waste and may leave the commitment unused", "Rightsizing is required by AWS first"],
          answer: 1,
          why: "If you commit to big instances and later shrink them, the commitment goes unused, but you still pay for it."
        }
      ]
    },
    "storage-costs": {
      minutes: 4,
      tldr: [
        "Cheaper S3 classes add <strong>retrieval fees</strong> and <strong>minimum durations</strong>: IA 30 days, Glacier Instant/Flexible 90, Deep Archive 180.",
        "IA classes bill at least <strong>128 KB per object</strong>, so tiny objects can cost more there than in Standard.",
        "<strong>Intelligent-Tiering</strong> moves objects automatically with no retrieval fees or minimums: the answer for unknown access.",
        "Hidden costs: <strong>incomplete multipart uploads</strong> and old versions. Add lifecycle rules to clean them up.",
        "EBS: move <strong>gp2 → gp3</strong> (~20% cheaper), delete unattached volumes, archive old snapshots."
      ],
      analogy: "S3 classes are like storage units: the cheap ones far out of town charge you to fetch a box and make you rent for a minimum term. Intelligent-Tiering is a service that moves boxes for you based on how often you visit, with no fetching fee.",
      examTip: "'Unpredictable access' → <strong>Intelligent-Tiering</strong>. 'Archive, 12-hour retrieval OK, cheapest' → <strong>Deep Archive</strong>. 'Rare but millisecond access' → <strong>Standard-IA or Glacier Instant Retrieval</strong>. Options putting tiny or short-lived objects into IA/Glacier are traps.",
      terms: [
        { t: "Minimum storage duration", d: "You pay for at least this many days even if you delete earlier." },
        { t: "S3 Intelligent-Tiering", d: "Class that auto-moves objects between tiers based on access; small monitoring fee." },
        { t: "Lifecycle rule", d: "Automatic transition or deletion of objects by age or version state." },
        { t: "Incomplete multipart upload", d: "Leftover parts of failed uploads: billed, invisible, until aborted." },
        { t: "EBS Snapshot Archive", d: "~75% cheaper snapshot tier; 90-day minimum and 24-72 hour restore." }
      ],
      check: [
        {
          q: "A bucket holds millions of 4 KB objects deleted after 10 days. Is moving them to Standard-IA a good idea?",
          options: ["Yes, IA is always cheaper", "No, 128 KB minimum size and 30-day minimum make it cost more", "Yes, if lifecycle moves them on day 1"],
          answer: 1,
          why: "Each object bills as 128 KB for at least 30 days in IA, so tiny short-lived objects cost more than in Standard."
        },
        {
          q: "Data access patterns are unknown and the team wants no retrieval fees or manual tuning. Which class?",
          options: ["S3 Standard-IA", "S3 Intelligent-Tiering", "S3 Glacier Flexible Retrieval"],
          answer: 1,
          why: "Intelligent-Tiering adapts automatically with no retrieval fees or minimum durations on its automatic tiers. IA and Glacier both charge to retrieve."
        }
      ]
    },
    "db-serverless-costs": {
      minutes: 4,
      tldr: [
        "DynamoDB <strong>on-demand</strong> costs about 3-4x more per request than fully used <strong>provisioned</strong>. Steady traffic → provisioned; spiky or unknown → on-demand.",
        "<strong>Aurora I/O-Optimized</strong> removes per-I/O charges; worth it when I/O is over ~25% of the Aurora bill.",
        "<strong>Aurora Serverless v2</strong> suits spiky or idle databases. RDS can be stopped for up to 7 days; storage still bills.",
        "Lambda bills <strong>memory × duration</strong> plus requests; more memory also means more CPU, so it can cost the same and run faster.",
        "<strong>HTTP APIs</strong> are ~3.5x cheaper than REST APIs. CloudWatch Logs cost is mostly <strong>ingestion</strong>: log less, set retention."
      ],
      analogy: "On-demand versus provisioned is a hotel versus renting a flat. For a few nights the hotel wins; if you're there most of the year, the flat is cheaper even with empty nights.",
      examTip: "'New app, unpredictable traffic, no capacity planning' → <strong>DynamoDB on-demand / Aurora Serverless v2</strong>. 'Aurora I/O charges high or spiky' → <strong>I/O-Optimized</strong>. 'Cut API Gateway cost, no REST-only features' → <strong>HTTP API</strong>.",
      terms: [
        { t: "On-demand capacity", d: "DynamoDB mode billed per request; no capacity planning." },
        { t: "Provisioned capacity", d: "DynamoDB mode billed per capacity-unit-hour; cheaper when well used." },
        { t: "Aurora I/O-Optimized", d: "Aurora config with no I/O charges but ~30% higher instance and storage rates." },
        { t: "GB-second", d: "Lambda billing unit: memory size multiplied by run time." },
        { t: "Log ingestion", d: "CloudWatch Logs charge per GB sent in (~0.50 USD/GB); the main logging cost." }
      ],
      check: [
        {
          q: "An Aurora cluster's bill is 46% I/O charges, and they spike unpredictably. Best move?",
          options: ["Buy RDS Reserved Instances", "Switch to Aurora I/O-Optimized", "Enable storage auto-scaling"],
          answer: 1,
          why: "Above ~25% I/O, I/O-Optimized is cheaper and removes the spikes. RIs discount only instance hours, not the I/O."
        },
        {
          q: "An API on API Gateway REST uses no API keys, caching, or request validation. How can you cut its cost?",
          options: ["Move it to an HTTP API", "Enable API caching", "Increase the Lambda memory"],
          answer: 0,
          why: "HTTP APIs cost about a third per request and cover plain Lambda proxy use. Caching adds an hourly charge."
        }
      ]
    },
    "cost-tooling": {
      minutes: 4,
      tldr: [
        "<strong>Cost Explorer</strong>: charts and forecasts of past spend. <strong>CUR 2.0</strong>: every line item to S3, queried with <strong>Athena</strong>.",
        "<strong>Budgets</strong> alert on actual or <strong>forecasted</strong> spend; <strong>Budget Actions</strong> can apply policies or stop instances automatically.",
        "<strong>Cost Anomaly Detection</strong> is free and ML-based: it catches surprises you didn't set thresholds for.",
        "<strong>Compute Optimizer</strong> = sizing advice; <strong>Trusted Advisor</strong> = checklist of idle and wasted resources.",
        "<strong>Cost allocation tags</strong> must be activated in Billing. Separate accounts are the cleanest way to split costs."
      ],
      analogy: "Cost Explorer is your bank statement, CUR is the full receipt pile, Budgets is a spending limit on your card, and Anomaly Detection is the bank texting you about a weird purchase.",
      examTip: "Each tool has one phrase: 'alert before exceeding' → <strong>Budgets (forecasted)</strong>; 'auto-stop on breach' → <strong>Budget Actions</strong>; 'unusual spend, no thresholds' → <strong>Anomaly Detection</strong>; 'most granular, SQL' → <strong>CUR + Athena</strong>; 'costs by department' → <strong>activated tags + Cost Categories</strong>.",
      terms: [
        { t: "Cost Explorer", d: "Console and API for exploring, grouping and forecasting spend." },
        { t: "CUR 2.0", d: "Cost and Usage Report via Data Exports: hourly, resource-level line items in S3." },
        { t: "Budget Actions", d: "Automatic responses to a budget breach: apply IAM/SCP policy or stop EC2/RDS." },
        { t: "Cost allocation tag", d: "A tag activated in Billing so it appears as a column in cost reports." },
        { t: "Consolidated billing", d: "One payer for an Organization; pools volume discounts and shares RIs/SPs." }
      ],
      check: [
        {
          q: "Finance tagged all resources with 'project', but Cost Explorer shows no project breakdown. Why?",
          options: ["Tags take 30 days to appear", "The tag was never activated as a cost allocation tag", "Cost Explorer can't group by tag"],
          answer: 1,
          why: "Tags only show in billing tools after activation in the Billing console, and appear within about 24 hours."
        },
        {
          q: "Sandbox accounts must automatically stop spending when they hit 500 USD. Which feature?",
          options: ["Cost Anomaly Detection", "AWS Budgets with Budget Actions", "Trusted Advisor"],
          answer: 1,
          why: "Budget Actions can apply a restrictive policy or stop instances on breach. Anomaly Detection and Trusted Advisor only alert or advise."
        }
      ]
    }
  }
});
