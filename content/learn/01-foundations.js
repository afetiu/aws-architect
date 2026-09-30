/* Learning layer — Module 1: Cloud Architecture Foundations */
window.COURSE.registerLearn({
  moduleId: "foundations",
  bigPicture: "This module is the map before the journey: where AWS physically runs (regions, Availability Zones, edge), how accounts and ARNs name and fence off everything, and the handful of ideas every exam question leans on. The big three to carry forward: <strong>multi-AZ is the default answer for availability</strong>, <strong>data planes keep working when control planes break</strong>, and <strong>you always own your configuration</strong>. It ends with how SAA-C03 is scored and how to read its questions.",
  cheatsheet: [
    { k: "Survive the loss of a datacenter or AZ", v: "<strong>Multi-AZ</strong> — the default, cheapest resilient answer" },
    { k: "Survive a whole-region outage, or data must be in two geographies", v: "<strong>Multi-region</strong> — only when the question says so" },
    { k: "Single-digit ms latency to users in one city, with EC2", v: "<strong>Local Zones</strong> — a mini-AZ in a metro area" },
    { k: "Apps for 5G mobile devices", v: "<strong>Wavelength Zones</strong> — compute inside the carrier network" },
    { k: "Must run on premises but wants AWS APIs", v: "<strong>Outposts</strong> — an AWS rack in your datacenter" },
    { k: "Two accounts must land in the same physical AZ", v: "Compare <strong>AZ IDs</strong> (use1-az1), not names like us-east-1a" },
    { k: "Isolate teams or environments, one bill", v: "<strong>AWS Organizations, multiple accounts</strong> — accounts are the strongest wall" },
    { k: "Stop even the root user from disabling CloudTrail", v: "<strong>SCP</strong> from the organization — in-account IAM cannot bind root" },
    { k: "S3 policy works for objects but ListBucket fails", v: "Need both <code>arn:aws:s3:::bucket</code> and <code>bucket/*</code>" },
    { k: "Survive an AZ loss with zero API calls during the event", v: "<strong>Pre-provision</strong> so N-1 AZs carry full load (static stability)" },
    { k: "DR failover must be automatic", v: "<strong>Route 53 failover routing + health checks</strong>, not a script that edits DNS" },
    { k: "MOST operationally efficient / LEAST overhead", v: "The <strong>most managed</strong> option, least custom code" },
    { k: "Review workloads against best practices, no extra cost", v: "<strong>Well-Architected Tool</strong> — free self-review" },
    { k: "Who patches the guest OS on EC2?", v: "<strong>Customer</strong> — AWS stops at the hypervisor" },
    { k: "Who patches the database engine on RDS?", v: "<strong>AWS</strong> — you only pick the maintenance window" },
    { k: "Who configures security groups, IAM, bucket policies?", v: "<strong>Customer</strong>, on every service, always" },
    { k: "Need AWS compliance reports (SOC, PCI, ISO)", v: "<strong>AWS Artifact</strong> — covers AWS's side of the line only" },
    { k: "Traffic between AZs on a cost question", v: "Costs about <strong>1 cent/GB each way</strong>; same-AZ private traffic is free" }
  ],
  lessons: {
    "global-infrastructure": {
      minutes: 5,
      tldr: [
        "A <strong>region</strong> is a separate, full copy of AWS in one geography. Almost every service is regional.",
        "An <strong>Availability Zone</strong> is one or more datacenters with their own power and cooling, a few km to ~100 km from its siblings.",
        "AZs are linked by fast fiber (under ~2 ms), so <strong>synchronous</strong> replication across AZs is practical. Between regions it is always <strong>asynchronous</strong>.",
        "Edge extras: <strong>Local Zones</strong> (metro), <strong>Wavelength</strong> (5G), <strong>Outposts</strong> (your datacenter), <strong>edge locations</strong> (CloudFront, no EC2).",
        "AZ names like us-east-1a are <strong>shuffled per account</strong>; the <strong>AZ ID</strong> (use1-az1) is the real, stable identity."
      ],
      analogy: "Think of a region as a city and its AZs as separate neighbourhoods on different power grids, joined by a private highway. A blackout in one neighbourhood does not reach the others, but they are close enough to talk instantly. Two cities are far apart: you can mail copies between them, but never in lockstep.",
      examTip: "\"Survive a datacenter/AZ failure\" means <strong>multi-AZ</strong>. Only pick <strong>multi-region</strong> when the question explicitly mentions a region-wide outage or geographic/regulatory separation.",
      terms: [
        { t: "Region", d: "An isolated geographic AWS deployment with its own full service stack, usually 3+ AZs." },
        { t: "Availability Zone (AZ)", d: "One or more datacenters with independent power, cooling and security inside a region." },
        { t: "AZ ID", d: "The stable, cross-account name of a physical AZ, e.g. <code>use1-az1</code>." },
        { t: "Local Zone", d: "A small AWS extension in a metro area for very low latency to nearby users." },
        { t: "Partition", d: "A hard AWS boundary: <code>aws</code>, <code>aws-cn</code> (China), <code>aws-us-gov</code> (GovCloud)." },
        { t: "Edge location", d: "A point of presence for CloudFront, Route 53 and Global Accelerator. You cannot run EC2 there." }
      ],
      check: [
        {
          q: "A web app must keep running if one datacenter floods. Nothing is said about regions or regulation. What is the simplest correct design?",
          options: ["Deploy across two regions with Route 53 failover", "Deploy across multiple AZs in one region", "Deploy to a Local Zone", "Put the app behind CloudFront"],
          answer: 1,
          why: "A flooded datacenter is an AZ-level failure, and <strong>multi-AZ</strong> covers it. Multi-region also works but adds cost and complexity nobody asked for."
        },
        {
          q: "Two partner companies both run instances in us-east-1b and want to know if they share the same physical AZ. What should they compare?",
          options: ["The AZ names", "The AZ IDs", "Their account IDs", "Their VPC CIDR ranges"],
          answer: 1,
          why: "AZ names are randomly mapped per account, so two us-east-1b's are often different buildings. The <strong>AZ ID</strong> is the same for everyone."
        }
      ]
    },
    "arns-accounts": {
      minutes: 4,
      tldr: [
        "The <strong>AWS account</strong> is the strongest isolation wall: permissions, quotas and billing all stop at its edge.",
        "Real setups use <strong>many accounts</strong> in an <strong>Organization</strong> to limit blast radius; the management account runs no workloads.",
        "ARN format: <code>arn:partition:service:region:account:resource</code>. Empty fields mean something.",
        "S3 ARNs have no region or account; IAM ARNs have no region (IAM is global).",
        "<code>bucket/*</code> matches objects but <strong>not the bucket itself</strong> — S3 policies often need both lines."
      ],
      analogy: "Accounts are separate flats in a building, each with its own lock and electricity meter. A fire or burglary in one flat stays there. The ARN is the full postal address of a thing inside a flat.",
      examTip: "\"Isolate teams/environments with consolidated billing\" or \"limit blast radius\" means <strong>more accounts in AWS Organizations</strong>, not more IAM policies in one account.",
      terms: [
        { t: "ARN", d: "Amazon Resource Name — the unique address of any AWS resource, used in policies." },
        { t: "Account ID", d: "A 12-digit identifier. Not a secret, and never proof of identity." },
        { t: "Management account", d: "The Organization's payer account. SCPs do not apply to it, so keep it empty and locked down." },
        { t: "Blast radius", d: "How much gets damaged when something goes wrong. Separate accounts keep it small." },
        { t: "SigV4", d: "How AWS requests are signed. Tied to region and time; clock drift over 5 minutes breaks it." }
      ],
      check: [
        {
          q: "A bucket policy allows s3:ListBucket on arn:aws:s3:::reports/* but listing fails. Why?",
          options: ["ListBucket needs the bucket ARN without /*", "S3 ARNs need a region", "The account ID is missing from the ARN", "ListBucket cannot be granted in a bucket policy"],
          answer: 0,
          why: "<code>reports/*</code> matches only objects. ListBucket acts on the bucket, so it needs <code>arn:aws:s3:::reports</code>. S3 ARNs correctly omit region and account."
        },
        {
          q: "Why is the AWS account considered the strongest isolation boundary?",
          options: ["Each account gets its own physical datacenter", "Permissions, quotas and billing stop at the account edge unless both sides allow crossing", "Accounts cannot share any network traffic"],
          answer: 1,
          why: "Nothing crosses an account boundary unless <strong>both</strong> sides allow it, and quotas and bills are per account. Accounts do share physical infrastructure and can be networked together."
        }
      ]
    },
    "control-vs-data-plane": {
      minutes: 4,
      tldr: [
        "<strong>Control plane</strong> = APIs that create, change or delete things. <strong>Data plane</strong> = the running thing doing its job.",
        "Data planes are built to be <strong>far more available</strong>. Most big outages hit control planes while running workloads kept serving.",
        "<strong>Static stability</strong>: the system survives a failure without needing to change anything or call any API.",
        "So <strong>pre-provision</strong> spare capacity so N-1 AZs carry full load; do not rely on Auto Scaling during an AZ outage.",
        "Failover should use data-plane features like <strong>Route 53 health checks</strong>, not scripts that edit DNS mid-outage."
      ],
      analogy: "The data plane is the trains already running; the control plane is the office that prints new timetables. If the office closes, the trains keep running on today's timetable. A good plan never needs the office open during an emergency.",
      examTip: "When two answers both work, prefer the one that shifts traffic <strong>automatically with no API calls during the failure</strong>: Route 53 failover routing beats \"a Lambda updates DNS when an alarm fires\"; pre-provisioned capacity beats \"Auto Scaling will replace it\".",
      terms: [
        { t: "Control plane", d: "The management APIs: launch, configure, delete (e.g. RunInstances, ChangeResourceRecordSets)." },
        { t: "Data plane", d: "The part that does the work: running instances, DNS answers, S3 GET/PUT." },
        { t: "Static stability", d: "Keeps working through a failure with no changes, API calls or humans needed." },
        { t: "N-1 sizing", d: "Enough capacity that losing any one AZ still leaves 100% of what you need." }
      ],
      check: [
        {
          q: "You need 12 instances at peak across 3 AZs and must survive losing one AZ with no scaling actions. How many instances do you run?",
          options: ["12 (4 per AZ)", "15 (5 per AZ)", "18 (6 per AZ)", "24 (8 per AZ)"],
          answer: 2,
          why: "Losing one AZ leaves two. Two AZs must hold 12, so 6 per AZ, 18 total. 12 relies on Auto Scaling mid-outage; 24 overpays."
        },
        {
          q: "Which DR design is most statically stable?",
          options: ["A Lambda edits the Route 53 record when a CloudWatch alarm fires", "Route 53 failover routing with health checks", "An on-call engineer updates DNS from a runbook"],
          answer: 1,
          why: "Health checks and DNS answers are <strong>data plane</strong> and flip traffic on their own. The other two need the Route 53 control-plane API during the outage."
        }
      ]
    },
    "well-architected": {
      minutes: 4,
      tldr: [
        "Six pillars: <strong>Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, Sustainability</strong>.",
        "Four of them map onto the four SAA-C03 domains: Security, Resilience, Performance, Cost.",
        "Reliability owns <strong>RTO</strong> (how long to recover) and <strong>RPO</strong> (how much data you may lose).",
        "Operational Excellence = infrastructure as code, small reversible changes, automation over wiki runbooks.",
        "Pillars pull against each other on purpose; architecture is choosing the trade-off."
      ],
      analogy: "The pillars are like the checklist a building inspector uses: fire safety, structure, plumbing, energy bill. A house can pass one and fail another, and making it cheaper can make it less safe. You balance them.",
      examTip: "\"MOST operationally efficient\" or \"LEAST operational overhead\" means pick the <strong>managed service with the least custom code</strong>. \"Assess against best practices at no cost\" means the <strong>Well-Architected Tool</strong>.",
      terms: [
        { t: "RTO", d: "Recovery Time Objective — how long the system may be down." },
        { t: "RPO", d: "Recovery Point Objective — how much recent data you can afford to lose, measured in time." },
        { t: "Infrastructure as code", d: "Defining infrastructure in files (CloudFormation, CDK, Terraform) so it is reproducible." },
        { t: "Well-Architected Tool", d: "Free console tool that reviews a workload against the pillar questions." },
        { t: "Lens", d: "A pillar review tailored to a workload type, e.g. Serverless or SaaS." }
      ],
      check: [
        {
          q: "Two solutions meet all requirements. One uses a managed AWS service; the other uses cron jobs on EC2. The question asks for LEAST operational overhead. Which wins?",
          options: ["The cron jobs, because they are cheaper", "The managed service", "Either, they are equal"],
          answer: 1,
          why: "Operational overhead means work for your team. A <strong>managed service</strong> removes patching and babysitting; cron on EC2 adds both."
        },
        {
          q: "A business says it can lose at most 5 minutes of data. Which metric is that?",
          options: ["RTO", "RPO", "SLA"],
          answer: 1,
          why: "Data you can afford to lose is <strong>RPO</strong>. RTO is how long you can be down."
        }
      ]
    },
    "shared-responsibility": {
      minutes: 4,
      tldr: [
        "AWS secures <strong>of</strong> the cloud (buildings, hardware, hypervisor); you secure what you put <strong>in</strong> it.",
        "The line moves per service: on <strong>EC2</strong> you patch the OS; on <strong>RDS</strong> AWS patches OS and engine; on <strong>Lambda</strong> AWS patches the runtime.",
        "Always yours on every service: <strong>data, IAM, network rules, encryption choices</strong>.",
        "Managed services shrink your work into <strong>configuration</strong> — and misconfiguration causes most real breaches.",
        "AWS compliance reports (via <strong>Artifact</strong>) only cover AWS's side; you still prove your own."
      ],
      analogy: "Renting a flat: the landlord keeps the walls, roof and wiring safe. Locking your door, choosing who gets a key, and not leaving valuables on the balcony are on you. A fully furnished serviced flat moves more work to the landlord, but the keys are still yours.",
      examTip: "If an option makes AWS responsible for anything <strong>inside your OS or your IAM/security groups</strong>, eliminate it. Guest OS on EC2 = customer. DB engine on RDS = AWS.",
      terms: [
        { t: "Security of the cloud", d: "AWS's job: facilities, hardware, hypervisor, global network, managed service software." },
        { t: "Security in the cloud", d: "Your job: data, IAM, security groups, OS (on EC2), encryption settings." },
        { t: "Shared controls", d: "Work both sides do at their own layer, e.g. patching and staff training." },
        { t: "AWS Artifact", d: "Where you download AWS's compliance reports like SOC 2 and PCI attestations." }
      ],
      check: [
        {
          q: "Who is responsible for patching the PostgreSQL engine on an Amazon RDS instance?",
          options: ["The customer", "AWS, during a maintenance window the customer chooses", "Nobody, RDS engines are never patched"],
          answer: 1,
          why: "On RDS, <strong>AWS patches the OS and engine</strong>; you control when via the maintenance window. On EC2 with self-installed Postgres it would be you."
        },
        {
          q: "A company says its app is PCI compliant simply because it runs on AWS. What is wrong?",
          options: ["AWS is not PCI certified", "AWS's certification only covers its own side; the company must evidence its own controls", "PCI does not apply in the cloud"],
          answer: 1,
          why: "You <strong>inherit</strong> AWS's infrastructure controls but must still prove everything above the line: your config, access and data handling."
        }
      ]
    },
    "saa-exam-strategy": {
      minutes: 4,
      tldr: [
        "65 questions in 130 minutes; <strong>50 scored, 15 hidden unscored</strong>. Pass = <strong>720/1000</strong>, overall not per domain.",
        "Domains: Secure <strong>30%</strong>, Resilient <strong>26%</strong>, High-Performing <strong>24%</strong>, Cost-Optimized <strong>20%</strong>.",
        "No penalty for wrong answers — never leave a blank. Multi-response has no partial credit.",
        "Read the <strong>last sentence first</strong>: the superlative (MOST cost-effective, LEAST overhead) decides between two working answers.",
        "Eliminate category errors and constraint violations; cheapest-but-misses-a-requirement is always wrong."
      ],
      analogy: "Each question is a customer order with one special request buried in it, like \"no nuts\". Two dishes on the menu would feed them; only one respects the special request. Find that sentence first.",
      examTip: "The classic cost trap: the cheapest option that <strong>fails a stated requirement</strong>. \"MOST cost-effective\" means cheapest among options that still fully work.",
      terms: [
        { t: "Scaled score", d: "Results reported on 100-1000; you need 720 overall." },
        { t: "Unscored items", d: "15 experimental questions you cannot identify, so treat all as real." },
        { t: "Superlative", d: "The deciding phrase: MOST resilient, LEAST overhead, MOST cost-effective." },
        { t: "Category error", d: "A distractor naming a service that simply cannot do the job (WAF does not encrypt)." }
      ],
      check: [
        {
          q: "You narrowed a question to two answers that both meet the requirements. The stem asks for LEAST operational overhead. How do you choose?",
          options: ["Pick the cheaper one", "Pick the more managed one", "Pick the one with more services for redundancy"],
          answer: 1,
          why: "Operational overhead is about your team's effort, so the <strong>more managed</strong> option wins. Price only decides when the question asks about cost."
        },
        {
          q: "Which statement about SAA-C03 scoring is true?",
          options: ["You must pass each domain separately", "Wrong answers cost points", "You need 720 overall, so strong domains can carry a weak one"],
          answer: 2,
          why: "Scoring is <strong>compensatory</strong>: 720 overall. There is no per-domain pass and no penalty for guessing."
        }
      ]
    }
  }
});
