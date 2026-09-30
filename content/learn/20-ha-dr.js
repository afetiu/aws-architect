/* Learning layer — Module 20: High Availability & Disaster Recovery */
window.COURSE.registerLearn({
  moduleId: "ha-dr",
  bigPicture: "<strong>High availability</strong> means surviving everyday failures (a server, an Availability Zone) without users noticing. <strong>Disaster recovery</strong> means getting back after something bigger, like losing a whole region. Both come down to two numbers: <strong>RTO</strong> (how long you can be down) and <strong>RPO</strong> (how much data you can lose). This is the biggest SAA-C03 domain (~26%), and most questions give you those numbers and ask you to pick the matching design.",
  cheatsheet: [
    { k: "Chain of services, each must be up", v: "Multiply: two 99.9% in a row = <strong>99.8%</strong>. Every hop lowers availability" },
    { k: "Redundant copies, either one is enough", v: "<strong>1 - (1-a)^n</strong>: two 99% = 99.99%, only if failures are independent" },
    { k: "Survive losing an AZ with no action needed", v: "<strong>Static stability</strong>: 3 AZs at ≤66% or 2 AZs at ≤50%" },
    { k: "Failover must not depend on the control plane", v: "Pre-create everything; use health checks or <strong>ARC routing controls</strong>" },
    { k: "RTO/RPO in hours, lowest cost", v: "<strong>Backup &amp; restore</strong>" },
    { k: "RPO seconds-minutes, RTO tens of minutes, cost-conscious", v: "<strong>Pilot light</strong> — data live, compute off" },
    { k: "RTO of minutes", v: "<strong>Warm standby</strong> — small full stack always running" },
    { k: "RTO and RPO near zero, cost no object", v: "<strong>Multi-site active-active</strong>" },
    { k: "Centralised backups across accounts and services", v: "<strong>AWS Backup</strong> with tag-based plans" },
    { k: "Backups nobody can delete, not even root", v: "<strong>AWS Backup Vault Lock, compliance mode</strong>" },
    { k: "On-prem servers DR to AWS, RPO seconds, low ongoing cost", v: "<strong>Elastic Disaster Recovery (DRS)</strong>" },
    { k: "Relational DB, RPO ~1 s, RTO ~1 min across regions", v: "<strong>Aurora Global Database</strong>" },
    { k: "Zero data loss in a planned region switch", v: "Aurora Global <strong>managed switchover</strong>" },
    { k: "Multi-region active-active writes, NoSQL", v: "<strong>DynamoDB global tables</strong> (last-writer-wins by default)" },
    { k: "Cheapest cross-region relational DR, minutes of RPO OK", v: "<strong>RDS cross-region read replica</strong>, promote on disaster" },
    { k: "Objects must replicate within a set time, with proof", v: "<strong>S3 CRR + Replication Time Control</strong> (15 min)" },
    { k: "Clients cache DNS or need static IPs for failover", v: "<strong>Global Accelerator</strong>" },
    { k: "Stop traffic to a degraded AZ", v: "<strong>ARC zonal shift</strong>" },
    { k: "Controlled chaos testing with automatic stop", v: "<strong>AWS Fault Injection Service</strong> + stop conditions" },
    { k: "Failover hit instance limit errors in DR region", v: "<strong>Pre-raise service quotas</strong> / capacity reservations" }
  ],
  lessons: {
    "availability-math": {
      minutes: 3,
      tldr: [
        "Components in a <strong>chain</strong> multiply: five 99.99% dependencies give about 99.95%. Every extra hop costs availability.",
        "<strong>Redundant</strong> copies multiply the chance of failure: two 99% parts = 99.99%, but only if they fail independently.",
        "Know the time: 99.9% ≈ 8.8 h/year, 99.99% ≈ 53 min/year. At four nines, failover must be <strong>automatic</strong>.",
        "An <strong>SLA</strong> is a refund promise, not a guarantee things won't break.",
        "Faster recovery (lower <strong>MTTR</strong>) is often the cheapest way to add nines."
      ],
      analogy: "A chain of Christmas lights wired in series goes dark if any bulb fails, so more bulbs means more risk. Wire two strings in parallel and the room stays lit unless both fail — unless they share the same plug.",
      examTip: "Serial = multiply (two 99.9% = 99.8%). Parallel = 1 - (1-a)^n. 'App now calls an external service — availability?' It <strong>drops</strong>, unless the call is made optional or non-blocking.",
      terms: [
        { t: "Serial composition", d: "Every component must work; availabilities multiply, so the total is lower." },
        { t: "Parallel redundancy", d: "Any one of several copies is enough; total availability rises sharply." },
        { t: "Correlated failure", d: "Redundant parts that fail together (same AZ, same bad deploy), wiping out the benefit." },
        { t: "SLA", d: "Contract that refunds service credits if AWS misses a target; doesn't cover your losses." },
        { t: "MTTR", d: "Mean time to recovery: detect, decide, fix. Cutting it raises availability." }
      ],
      check: [
        {
          q: "A request passes through two services, each 99.9% available. What's the overall availability?",
          options: ["99.9%", "About 99.8%", "About 99.99%"],
          answer: 1,
          why: "In a chain, multiply: 0.999 × 0.999 ≈ 0.998. 99.99% would be the result of two redundant copies, not a chain."
        },
        {
          q: "Two web servers sit behind one load balancer, but both get every deployment at once. What weakens their redundancy?",
          options: ["They are in the same VPC", "A bad deploy breaks both at the same time", "The load balancer adds latency"],
          answer: 1,
          why: "Redundancy only multiplies nines if failures are independent. A shared deployment pipeline is a correlated failure."
        }
      ]
    },
    "failure-domains": {
      minutes: 4,
      tldr: [
        "Things fail in layers: instance, <strong>Availability Zone</strong>, region. Decide which you must survive.",
        "The <strong>data plane</strong> (running things) is more reliable than the <strong>control plane</strong> (APIs that create or change things).",
        "<strong>Static stability</strong>: keep working through a failure <em>without making any changes</em>. No launches, no API calls, no humans.",
        "So pre-provision: 3 AZs at ≤66% each can lose one AZ with no scaling needed.",
        "Create the DR region's networks, roles and templates <strong>before</strong> the disaster, not during it."
      ],
      analogy: "A statically stable restaurant keeps spare staff on every shift, so if one cook goes home sick nothing changes. The unstable one plans to phone a temp agency, which is exactly when every other restaurant is phoning too.",
      examTip: "Any answer that must <strong>launch or create</strong> something during the failure is weaker than one where capacity already exists. 'ASG will replace instances' loses to 'over-provision across 3 AZs'. Updating DNS by hand loses to pre-configured health-check failover.",
      terms: [
        { t: "Failure domain", d: "A group of things that fail together: a host, an AZ, a region." },
        { t: "Data plane", d: "The part doing live work: running instances, answering DNS, routing traffic." },
        { t: "Control plane", d: "Management APIs that create or change resources; less available during incidents." },
        { t: "Static stability", d: "Surviving a failure with no changes, because enough capacity and config already exist." },
        { t: "Zonal shift", d: "ARC feature that moves load-balancer traffic away from an impaired AZ." }
      ],
      check: [
        {
          q: "An app runs in 2 AZs at 80% load each and relies on Auto Scaling after an AZ fails. What's the risk?",
          options: ["None, Auto Scaling is instant", "Recovery depends on launching instances when capacity and APIs are strained", "The ALB can't route to two AZs"],
          answer: 1,
          why: "Launching needs the EC2 control plane and spare capacity at the worst moment. Static stability means 3 AZs at ≤66% (or 2 at ≤50%) so no launch is needed."
        },
        {
          q: "Which action is a data-plane operation that keeps working during a regional incident?",
          options: ["Creating a new Route 53 record via API", "Route 53 health checks switching between existing records", "Launching new EC2 instances"],
          answer: 1,
          why: "Answering DNS and acting on health checks is data plane. Changing records and launching instances are control-plane calls that may fail during incidents."
        }
      ]
    },
    "dr-strategies": {
      minutes: 4,
      tldr: [
        "Four strategies, from cheapest and slowest to most expensive and fastest: <strong>backup &amp; restore → pilot light → warm standby → active-active</strong>.",
        "<strong>Backup &amp; restore</strong>: nothing runs in DR; RTO/RPO hours. <strong>Pilot light</strong>: data replicates live, compute is off.",
        "<strong>Warm standby</strong>: a small but working copy of the whole stack runs all the time; RTO minutes.",
        "<strong>Active-active</strong>: both regions serve real traffic; near-zero RTO/RPO, about double the cost.",
        "Traffic: <strong>Route 53 failover</strong> (DNS, minutes due to caching) or <strong>Global Accelerator</strong> (static IPs, seconds)."
      ],
      analogy: "Backup &amp; restore is the spare key at a friend's house. Pilot light is a gas heater with just the small flame lit. Warm standby is a second office with a skeleton crew. Active-active is two full offices both open for business.",
      examTip: "Map the numbers: 'RPO/RTO hours, minimize cost' → <strong>backup &amp; restore</strong>. 'RPO seconds, RTO under an hour, cost-conscious' → <strong>pilot light</strong>. 'RTO minutes' → <strong>warm standby</strong>. 'Near zero' → <strong>active-active</strong>. Pilot light vs warm: is the app tier <em>running and able to serve</em>?",
      terms: [
        { t: "Backup & restore", d: "Only backups and templates in the DR region; rebuild everything when disaster hits." },
        { t: "Pilot light", d: "Data layer replicating live; app servers exist but stopped or scaled to zero." },
        { t: "Warm standby", d: "Scaled-down but fully working stack always running in the DR region." },
        { t: "Active-active", d: "Two or more regions serving production traffic at the same time." },
        { t: "Global Accelerator", d: "Static anycast IPs that shift traffic between regions in seconds, no DNS caching." }
      ],
      check: [
        {
          q: "Required: RPO of a few seconds, RTO under an hour, lowest cost. Which strategy?",
          options: ["Backup & restore", "Pilot light", "Active-active"],
          answer: 1,
          why: "Pilot light replicates data live (seconds RPO) but keeps compute off to save money. Backup & restore can't give seconds of RPO; active-active is far pricier than needed."
        },
        {
          q: "A DR region runs a small copy of the full application that serves a trickle of traffic. What is this?",
          options: ["Pilot light", "Warm standby", "Backup & restore"],
          answer: 1,
          why: "A running, serving, scaled-down stack is warm standby. In pilot light the app servers are stopped."
        }
      ]
    },
    "rto-rpo-backup": {
      minutes: 4,
      tldr: [
        "<strong>RTO</strong> = how long you can be down. <strong>RPO</strong> = how much data you can lose, measured in time.",
        "RPO follows how data moves: nightly backup → 24 h; continuous async replication → seconds; synchronous Multi-AZ → ~0.",
        "<strong>AWS Backup</strong>: central, tag-based backup plans across services and accounts, with cross-region and cross-account copies.",
        "<strong>Vault Lock compliance mode</strong> makes backups undeletable by anyone, even root, once the cooling-off period ends.",
        "<strong>Elastic Disaster Recovery (DRS)</strong>: continuous block replication of servers into a cheap staging area; launch full servers only when needed."
      ],
      analogy: "RPO is how far back your last save point is in a video game; RTO is how long the game takes to reload. Vault Lock is putting the save file in a safe that even you can't open until the date on the timer.",
      examTip: "'RPO 5 minutes' instantly rules out nightly backups. 'Backups safe even from compromised admins/root' → <strong>Vault Lock compliance mode</strong>. 'On-prem DR to AWS, RPO seconds, low ongoing cost' → <strong>DRS</strong>. MGN = migrate once; DRS = protect continuously.",
      terms: [
        { t: "RTO", d: "Recovery Time Objective: maximum acceptable downtime." },
        { t: "RPO", d: "Recovery Point Objective: maximum acceptable data loss, as time." },
        { t: "Backup plan", d: "AWS Backup schedule, retention and copy rules, applied by resource tags." },
        { t: "Vault Lock", d: "WORM protection for a backup vault; compliance mode can't be undone." },
        { t: "DRS", d: "Elastic Disaster Recovery: continuous server replication with point-in-time recovery and drills." }
      ],
      check: [
        {
          q: "Ransomware may steal admin credentials. Backups must not be deletable by anyone. What do you use?",
          options: ["S3 versioning on the backup bucket", "AWS Backup Vault Lock in compliance mode", "Daily EBS snapshots in the same account"],
          answer: 1,
          why: "Compliance-mode Vault Lock can't be removed even by root once locked. Versioning and same-account snapshots can be deleted with admin credentials."
        },
        {
          q: "On-prem servers need DR in AWS with RPO in seconds and minimal cost until a disaster. Which service?",
          options: ["Application Migration Service (MGN)", "Elastic Disaster Recovery (DRS)", "A full warm standby fleet"],
          answer: 1,
          why: "DRS replicates continuously into cheap staging and launches full servers only on failover. MGN is for one-time migration; a running fleet costs much more."
        }
      ]
    },
    "database-dr": {
      minutes: 4,
      tldr: [
        "<strong>RDS cross-region read replica</strong>: cheapest; you promote it by hand on disaster. RPO = replication lag, RTO tens of minutes.",
        "<strong>Aurora Global Database</strong>: storage-level replication, lag under 1 s. Targets <strong>RPO ~1 s, RTO ~1 min</strong>. Planned switchover loses nothing.",
        "<strong>DynamoDB global tables</strong>: every region accepts writes; conflicts resolve <strong>last-writer-wins</strong> by default.",
        "<strong>S3 CRR</strong> has no time guarantee; add <strong>Replication Time Control</strong> for 99.99% within 15 minutes.",
        "Failover is more than the database: replicate KMS keys, secrets and queues too, and stop the old primary taking writes."
      ],
      analogy: "An RDS replica is a backup singer you must promote to lead mid-concert. Aurora Global is an understudy already in costume a second behind. DynamoDB global tables are several bands playing the same song in different cities: if two change a lyric at once, the last one heard wins.",
      examTip: "'Relational, RPO ~1 s / RTO ~1 min' → <strong>Aurora Global</strong>. 'Zero data loss, planned switch' → <strong>managed switchover</strong>. 'Multi-region active-active writes' → <strong>DynamoDB global tables</strong>; beware 'strongly consistent across regions' (not in the default mode). 'Replicate within a deadline, with proof' → <strong>S3 RTC</strong>.",
      terms: [
        { t: "Promotion", d: "Turning a read replica into a standalone writable database; a control-plane step." },
        { t: "Aurora Global Database", d: "One primary region plus up to several read-only secondary regions with sub-second lag." },
        { t: "Managed switchover", d: "Planned Aurora Global role swap that waits for replication, so RPO is zero." },
        { t: "Last-writer-wins", d: "DynamoDB global tables' default conflict rule: the latest timestamp overwrites the other." },
        { t: "S3 Replication Time Control", d: "CRR option with an SLA: 99.99% of objects replicated within 15 minutes." }
      ],
      check: [
        {
          q: "A payments database on Aurora MySQL needs cross-region DR with about 1 second RPO and 1 minute RTO. Choose:",
          options: ["RDS cross-region read replica", "Aurora Global Database", "Nightly snapshots copied to another region"],
          answer: 1,
          why: "Aurora Global is built for ~1 s RPO and ~1 min RTO. Read replicas need manual promotion and lag more; nightly snapshots mean up to 24 h of loss."
        },
        {
          q: "Two regions update the same DynamoDB global table item at the same moment. What happens by default?",
          options: ["Both changes are merged", "The latest write wins and the other is lost", "Writes are blocked until an operator decides"],
          answer: 1,
          why: "Default global tables use last-writer-wins, silently discarding the earlier write. Designs avoid this with idempotent writes or a home region per record."
        }
      ]
    },
    "arc-testing": {
      minutes: 4,
      tldr: [
        "<strong>Route 53 ARC routing controls</strong> are on/off traffic switches kept in a super-resilient cluster across five regions, flippable even when a region is down.",
        "<strong>Readiness checks</strong> keep checking the standby matches production: capacity, quotas, config.",
        "<strong>Safety rules</strong> stop mistakes like switching off every region at once. <strong>Zonal shift</strong> moves traffic off a sick AZ.",
        "An untested DR plan is just a document: run restore tests and <strong>game days</strong>.",
        "<strong>Fault Injection Service (FIS)</strong> breaks things on purpose, with <strong>stop conditions</strong> that halt the test if alarms fire."
      ],
      analogy: "ARC routing controls are a big red railway switch in a bunker built to survive the storm, so you can redirect trains even when the main station is flooded. Game days are fire drills: better to find the blocked exit on a Tuesday afternoon than during a real fire.",
      examTip: "'Fail over even if the primary region's control plane is down' → <strong>ARC routing controls</strong>. 'Verify DR stays ready' → <strong>readiness checks</strong>. 'Prevent turning off both regions' → <strong>safety rules</strong>. Simple automatic failover is still plain <strong>Route 53 failover routing</strong>.",
      terms: [
        { t: "Routing control", d: "ARC on/off switch that steers traffic via Route 53 health checks." },
        { t: "Readiness check", d: "Continuous ARC audit that standby resources match the primary." },
        { t: "Safety rule", d: "ARC guardrail, e.g. at least one region must stay on." },
        { t: "Game day", d: "Planned exercise running a realistic failure end to end using the real runbooks." },
        { t: "FIS stop condition", d: "CloudWatch alarm that automatically halts a fault-injection experiment." }
      ],
      check: [
        {
          q: "Operators need a manual failover switch that works even when the primary region and Route 53's change API are impaired. What?",
          options: ["A Lambda that edits DNS records", "Route 53 ARC routing controls", "A failover flag in a DynamoDB table"],
          answer: 1,
          why: "ARC routing controls live in a dedicated five-region data plane built for exactly this. A Lambda editing records uses the control plane; a homemade flag shares fate with one region."
        },
        {
          q: "You want to simulate an AZ outage in production but stop automatically if error rates spike. Which service?",
          options: ["AWS Fault Injection Service with stop conditions", "AWS Backup restore testing", "Trusted Advisor"],
          answer: 0,
          why: "FIS injects faults like AZ power loss and halts when a CloudWatch alarm fires. Backup testing checks restores, not live resilience."
        }
      ]
    },
    "recovery-failure-modes": {
      minutes: 5,
      tldr: [
        "Recovery itself can cause outages. When a service comes back, every client retrying at once can knock it over again: a <strong>retry storm</strong>.",
        "Defences: <strong>exponential backoff with jitter</strong>, retry limits and circuit breakers, <strong>load shedding</strong>, gradual traffic ramp-up.",
        "<strong>Cells</strong> split a service into independent copies so one bad customer or deploy hits only a slice. <strong>Shuffle sharding</strong> goes further.",
        "Quotas are <strong>per account per region</strong>. An unused DR region has low defaults: raise them <strong>before</strong> you need them.",
        "A raised quota isn't reserved hardware; <strong>capacity reservations</strong> give certainty for strict RTOs."
      ],
      analogy: "After a power cut, if every fridge and air conditioner on the street switches back on at the same instant, the fuse blows again. Jitter is everyone waiting a random few seconds before switching back on.",
      examTip: "'Dependency recovered, then collapsed again under load' → <strong>backoff with jitter, retry budgets, load shedding</strong>. 'One customer's bad requests hurt everyone' → <strong>cells / shuffle sharding</strong>. 'DR failover hit launch limits' → <strong>pre-raise quotas / capacity reservations</strong>. Bigger instances or more AZs are distractors.",
      terms: [
        { t: "Retry storm", d: "Masses of clients retrying at once, overloading a service that just recovered." },
        { t: "Jitter", d: "Random delay added to retries so clients don't retry in sync." },
        { t: "Load shedding", d: "Rejecting some requests early so the rest are served well." },
        { t: "Cell-based architecture", d: "Service split into self-contained copies, each serving a fixed set of customers." },
        { t: "Shuffle sharding", d: "Each customer gets a random mix of workers, so few customers share all of them." },
        { t: "Service quota", d: "Per-account, per-region limit, e.g. vCPUs or Elastic IPs (default 5)." }
      ],
      check: [
        {
          q: "During a DR test, launching instances in the backup region fails with limit errors even though capacity exists. Fix?",
          options: ["Use larger instance types", "Raise service quotas in the DR region in advance", "Add a third Availability Zone"],
          answer: 1,
          why: "Quotas are per region, and an unused region keeps low defaults. Raise them ahead of time; bigger instances or more AZs don't lift the quota."
        },
        {
          q: "After an outage, a service recovers, then fails again as all clients retry at fixed 1-second intervals. What helps most?",
          options: ["Exponential backoff with jitter on clients", "More retries per client", "A longer DNS TTL"],
          answer: 0,
          why: "Jitter spreads retries out and backoff reduces their volume, letting the service recover. More retries make the storm worse."
        }
      ]
    }
  }
});
