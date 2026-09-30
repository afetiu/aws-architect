/* Learning layer — Module 18: Migration & Data Transfer */
window.COURSE.registerLearn({
  moduleId: "migration",
  bigPicture: "Migration questions ask two things: <strong>what should happen to each app</strong> (the 7 Rs: move it as-is, tweak it, rewrite it, replace it, or switch it off) and <strong>how do the bytes physically get there</strong>. The second is mostly arithmetic: data size, link speed, deadline. Do the maths and the right tool (Snowball, DataSync, Transfer Family, DMS, MGN) usually picks itself.",
  cheatsheet: [
    { k: "Data center closing soon, move servers quickly with minimal changes", v: "<strong>Rehost with MGN</strong> — block-level replication, minutes of downtime" },
    { k: "Reduce database admin work during the move", v: "<strong>Replatform</strong> to RDS/Aurora" },
    { k: "Escape Oracle or SQL Server licensing", v: "<strong>SCT + DMS</strong> to Aurora PostgreSQL/MySQL" },
    { k: "Same database engine, just move it", v: "<strong>DMS only</strong> (or native tools) — no SCT" },
    { k: "Database migration with minimal downtime", v: "DMS <strong>full load + CDC</strong>, then a short cutover" },
    { k: "Move VMware VMs without converting anything", v: "<strong>VMware Cloud on AWS</strong> (relocate)" },
    { k: "Rule of thumb for transfer time", v: "<strong>1 TB over 100 Mbps ≈ 1 day</strong>; 1 Gbps ≈ 2-3 hours" },
    { k: "Hundreds of TB, slow link, deadline in weeks", v: "<strong>Several Snowball Edge devices</strong> in parallel" },
    { k: "No network, remote or harsh site, run compute at the edge", v: "<strong>Snowball Edge Compute Optimized</strong>" },
    { k: "Recurring or scheduled transfers, throttling, verification", v: "<strong>DataSync</strong> — Snow is the trap for ongoing jobs" },
    { k: "Migrate an NFS/SMB share to EFS, FSx or S3", v: "<strong>DataSync</strong> (agent next to the source)" },
    { k: "Copy a bucket to another account or region, managed and verified", v: "<strong>DataSync agentless</strong>" },
    { k: "Keep on-prem apps using NFS/SMB after migration, backed by S3", v: "<strong>Storage Gateway File Gateway</strong>, not DataSync" },
    { k: "Far-away users uploading to one S3 bucket", v: "<strong>S3 Transfer Acceleration</strong> (edge + AWS backbone)" },
    { k: "Partners must keep sending files over SFTP/FTPS/AS2 into S3", v: "<strong>AWS Transfer Family</strong>" },
    { k: "Partners need to allowlist a static IP for SFTP", v: "Transfer Family <strong>VPC endpoint with Elastic IPs</strong>" },
    { k: "Which servers talk to which before migrating", v: "<strong>Application Discovery Service agents</strong> → Migration Hub" },
    { k: "Import a static VM image (OVA/VMDK) as an AMI", v: "<strong>VM Import/Export</strong> — no ongoing sync" }
  ],
  lessons: {
    "seven-rs": {
      minutes: 4,
      tldr: [
        "The 7 Rs: <strong>Rehost, Replatform, Repurchase, Refactor, Relocate, Retain, Retire</strong>. You choose one <em>per app</em>, not per company.",
        "<strong>Rehost</strong> = copy as-is (fastest, keeps inefficiency). <strong>Replatform</strong> = small swaps like self-run MySQL to RDS.",
        "<strong>Refactor</strong> = rewrite cloud-native: most expensive, only for apps that really matter.",
        "<strong>Retire</strong> (switch off unused apps) is the cheapest win; <strong>Retain</strong> means leave it for now.",
        "Run discovery first. Rehost now and refactor later is a normal two-step plan."
      ],
      analogy: "Moving house: some furniture goes on the truck as-is (rehost), some gets new legs first (replatform), some you replace at IKEA (repurchase), some you rebuild (refactor), and the broken chair goes to the tip (retire).",
      examTip: "The exam describes the constraint, not the R. 'Quickly, minimal changes' → <strong>rehost (MGN)</strong>. 'Less DB admin' → <strong>replatform to RDS</strong>. 'Off commercial DB licensing' → <strong>refactor with SCT + DMS</strong>. 'VMware unchanged' → <strong>relocate</strong>.",
      terms: [
        { t: "Rehost", d: "Lift-and-shift: move the server unchanged, usually with MGN." },
        { t: "Replatform", d: "Keep the app but swap a component for a managed service, e.g. database to RDS." },
        { t: "Repurchase", d: "Replace the app with a SaaS product." },
        { t: "Refactor", d: "Re-architect or rewrite the app to be cloud-native." },
        { t: "Relocate", d: "Move at the hypervisor level, e.g. VMware Cloud on AWS, no conversion." },
        { t: "Retain / Retire", d: "Retain = leave on-prem for now. Retire = turn it off for good." }
      ],
      check: [
        {
          q: "A company must leave its data center in 4 months and has 300 servers with no budget for app changes. Which strategy?",
          options: ["Refactor each app to serverless", "Rehost with Application Migration Service", "Repurchase SaaS for every app"],
          answer: 1,
          why: "A hard deadline and no per-app budget point to lift-and-shift with MGN. Refactoring 300 apps in 4 months is unrealistic."
        },
        {
          q: "The goal is to remove the team's database patching and backup work, with minimal code change. Which R?",
          options: ["Retain", "Replatform", "Relocate"],
          answer: 1,
          why: "Replatforming the database to RDS removes patching and backups while the app barely changes. Relocate keeps the same VMs, so the admin work stays."
        }
      ]
    },
    "bandwidth-math": {
      minutes: 4,
      tldr: [
        "Transfer time = <strong>data size ÷ (link speed × utilization)</strong>. Real links run at maybe 50-80% for a migration, less if shared.",
        "Memorise: <strong>1 TB over 100 Mbps ≈ 1 day</strong>. 1 Gbps is 10x faster, 10 Gbps 100x faster.",
        "If the maths misses the deadline, <strong>ship devices</strong> (Snowball). If it fits but is slow, use <strong>DataSync</strong> on your link.",
        "Direct Connect takes weeks to months to set up, so it can't rescue a short deadline.",
        "Data <strong>into</strong> AWS is free on all these paths; you pay service fees, not bandwidth."
      ],
      analogy: "Never underestimate the bandwidth of a truck full of hard drives. When the pipe is a garden hose and you need to move a swimming pool, you send a tanker instead.",
      examTip: "Always do the maths: (size, link, deadline). 500 TB on 100 Mbps is ~500 days → <strong>Snowball</strong>. But if the stem says 'ongoing' or 'no extra hardware', Snowball is wrong — use <strong>DataSync</strong>.",
      terms: [
        { t: "Utilization", d: "The share of a link you can really use for the migration; rarely 100%." },
        { t: "Direct Connect", d: "A private, dedicated network link to AWS; slow to provision." },
        { t: "S3 Transfer Acceleration", d: "Uploads enter the nearest edge location and ride AWS's backbone to the bucket." },
        { t: "Seed-then-sync", d: "Ship the bulk on a device, then copy the changes made meanwhile over the network." }
      ],
      check: [
        {
          q: "About how long does 10 TB take over a fully used 1 Gbps link?",
          options: ["About 2 hours", "About 1 day", "About 10 days"],
          answer: 1,
          why: "1 TB over 1 Gbps is about 2.2 hours, so 10 TB is about 22 hours. 10 days is the 100 Mbps figure."
        },
        {
          q: "Users worldwide upload large files to one S3 bucket in us-east-1 and uploads are slow. Cheapest fix with no new hardware?",
          options: ["Order Snowball devices", "Enable S3 Transfer Acceleration", "Provision Direct Connect"],
          answer: 1,
          why: "Transfer Acceleration shortens the slow long-distance hop by entering AWS at a nearby edge. Snowball and Direct Connect don't fit many scattered users."
        }
      ]
    },
    "snow-family": {
      minutes: 4,
      tldr: [
        "Snow devices are rugged, encrypted boxes AWS ships to you: load data at LAN speed, ship back, AWS imports it to S3.",
        "<strong>Snowball Edge Storage Optimized</strong> is the bulk-migration device (exams quote ~80 TB; current model 210 TB). Order several in parallel.",
        "<strong>Snowball Edge Compute Optimized</strong> runs EC2 and Lambda on-site, fully offline: ships, mines, factories.",
        "Snowcone (8 or 14 TB, backpack-sized) and the Snowmobile truck were both discontinued in 2024; older questions may still mention them.",
        "Keys stay in KMS, never on the device. Roughly <strong>a week</strong> door to door per device."
      ],
      analogy: "A Snowball is a locked armoured van for data: you fill it in your own car park at full speed, and the courier carries it to AWS without it ever touching the internet.",
      examTip: "'No connectivity / remote / harsh site' → <strong>Snow family</strong>. 'Tens to hundreds of TB, one-time' → <strong>Snowball Edge Storage Optimized</strong>. 'ML at the edge, offline' → <strong>Compute Optimized</strong>. 'Recurring transfers over a decent link' → Snow is the trap; pick DataSync.",
      terms: [
        { t: "Snowball Edge Storage Optimized", d: "Bulk data-migration device with S3-compatible and NFS endpoints." },
        { t: "Snowball Edge Compute Optimized", d: "Device with lots of CPU/RAM (optional GPU) to run EC2 instances offline." },
        { t: "OpsHub", d: "Desktop app to unlock and manage Snow devices." },
        { t: "Manifest and unlock code", d: "Two credentials sent separately from the device; both are needed to unlock it." },
        { t: "Import / export job", d: "Import loads data into S3 (no transfer fee); export copies S3 data out (billed per GB)." }
      ],
      check: [
        {
          q: "An oil rig with no network needs to run ML inference on sensor video locally. Which device?",
          options: ["Snowball Edge Storage Optimized", "Snowball Edge Compute Optimized", "DataSync agent on a local VM"],
          answer: 1,
          why: "Compute Optimized runs EC2 AMIs, optionally with GPU, fully disconnected. DataSync needs a network; Storage Optimized is built for capacity, not heavy compute."
        },
        {
          q: "A site uploads 2 TB of new data every night over a solid 1 Gbps link. Which tool?",
          options: ["Snowball Edge monthly", "DataSync scheduled task", "Snowmobile"],
          answer: 1,
          why: "2 TB fits in a few hours on 1 Gbps, and the job is recurring: DataSync. Snow is for one-off bulk moves, and Snowmobile no longer exists."
        }
      ]
    },
    "datasync": {
      minutes: 4,
      tldr: [
        "DataSync is a managed, fast, parallel 'rsync' with scheduling, retries, throttling, verification and logs. Paid <strong>per GB</strong> copied.",
        "<strong>Agent</strong> (a VM next to your source) for on-prem NFS, SMB, HDFS, object storage. <strong>Agentless</strong> between AWS services, incl. cross-account S3.",
        "Re-runs copy <strong>only new or changed files</strong>, so it suits seed-then-sync and scheduled syncs (min every hour).",
        "It is not continuous replication and not a backup tool.",
        "DataSync <em>moves</em> data; <strong>File Gateway</strong> <em>serves</em> S3 to on-prem apps as NFS/SMB afterwards."
      ],
      analogy: "DataSync is a professional moving company for files: they pack in parallel, check every box arrived intact, and next week only move what's new. Your old rsync script is you and a friend with a hatchback.",
      examTip: "'Migrate NFS/SMB to EFS/FSx/S3', 'scheduled', 'throttle bandwidth', 'verify data' → <strong>DataSync</strong>. Classic confusion: migration = DataSync; ongoing on-prem file access to S3 = <strong>File Gateway</strong>.",
      terms: [
        { t: "DataSync agent", d: "VM deployed near the source storage that reads locally and sends data to AWS." },
        { t: "Location", d: "A configured source or destination: NFS share, SMB share, S3 bucket, EFS, FSx." },
        { t: "Task", d: "A source-to-destination copy job with options like filters, schedule and verification." },
        { t: "Bandwidth throttling", d: "Cap on how much of the link a task uses, adjustable mid-run." },
        { t: "File Gateway", d: "Storage Gateway mode exposing S3 as an NFS/SMB share with a local cache." }
      ],
      check: [
        {
          q: "Migrate a 40 TB on-prem SMB share to FSx for Windows over a decent link, keeping permissions and verifying data. Choose:",
          options: ["DataSync with an agent near the share", "S3 Transfer Acceleration", "VM Import/Export"],
          answer: 0,
          why: "DataSync supports SMB to FSx, preserves ACLs and verifies files. Transfer Acceleration only speeds S3 uploads; VM Import converts VM images."
        },
        {
          q: "After migrating files to S3, on-prem apps must keep reading them via NFS with low latency. What do you add?",
          options: ["Another DataSync task every hour", "Storage Gateway File Gateway", "AWS Transfer Family"],
          answer: 1,
          why: "File Gateway presents S3 as an NFS/SMB share with a local cache for ongoing access. DataSync moves data; it doesn't serve it."
        }
      ]
    },
    "transfer-family": {
      minutes: 4,
      tldr: [
        "Transfer Family is a <strong>managed SFTP/FTPS/FTP/AS2 server</strong> that saves files straight into <strong>S3 or EFS</strong>.",
        "Partners keep their old SFTP habits; you get S3 objects that can trigger processing via EventBridge and Lambda.",
        "Plain FTP only inside a VPC. For partners who allowlist IPs, use a <strong>VPC endpoint with Elastic IPs</strong>.",
        "Each user maps to an IAM role and a home folder; scope each partner to their own prefix.",
        "Billed <strong>per protocol per hour</strong> (about 0.30 dollars, ~216 dollars a month) plus per GB. It never scales to zero."
      ],
      analogy: "Transfer Family is a post office counter bolted onto S3: partners hand letters over the same old counter they always used, and behind it everything drops straight into your S3 mailroom.",
      examTip: "'Partners must use SFTP/FTPS/AS2 and can't change' + 'store in S3' → <strong>Transfer Family</strong>. Wrong options: EC2 running OpenSSH (heavy lifting), presigned URLs (partner must change), DataSync (for migrations you drive).",
      terms: [
        { t: "SFTP", d: "File transfer over SSH; the main protocol, available on public endpoints." },
        { t: "AS2", d: "B2B EDI protocol with signed receipts; the keyword points to Transfer Family." },
        { t: "Custom identity provider", d: "Lambda or API Gateway hook to log users in against your own system, e.g. Okta." },
        { t: "Logical home directory", d: "Makes a partner's own S3 prefix look like the root folder, hiding everything else." },
        { t: "Managed workflow", d: "Built-in post-upload steps: copy, tag, PGP decrypt, call Lambda." }
      ],
      check: [
        {
          q: "Fifty partners send CSVs by SFTP to an old EC2 server. You want no servers and files in S3. Best option?",
          options: ["S3 presigned URLs for each partner", "AWS Transfer Family SFTP endpoint", "DataSync from each partner site"],
          answer: 1,
          why: "Transfer Family keeps SFTP for partners and writes directly to S3. Presigned URLs would force partners to change tools; DataSync isn't for partner-driven drops."
        },
        {
          q: "After moving partners to Transfer Family, their SFTP clients warn of a possible man-in-the-middle. What was missed?",
          options: ["Importing the old server's SSH host key", "Enabling S3 versioning", "Adding a NAT gateway"],
          answer: 0,
          why: "Clients remember the server's host key. Importing the old key into Transfer Family keeps it the same so clients trust the new endpoint."
        }
      ]
    },
    "dms-sct": {
      minutes: 4,
      tldr: [
        "<strong>SCT</strong> converts the database <em>structure</em> (tables, procedures) between engines. <strong>DMS</strong> moves the <em>data</em> and keeps it in sync.",
        "<strong>Different engines</strong> (Oracle → Aurora PostgreSQL) = SCT then DMS. <strong>Same engine</strong> = DMS alone.",
        "<strong>Full load + CDC</strong> copies everything while capturing live changes, so cutover downtime is minutes.",
        "Licence escape story: SCT assessment → convert schema → DMS full load + CDC → cut over to <strong>Aurora</strong>.",
        "DMS can also be a permanent pipe, e.g. database → S3 data lake. <strong>DMS Serverless</strong> sizes itself."
      ],
      analogy: "Moving a library to a country with a different language: SCT translates the catalogue and signs, DMS carries the books, and CDC keeps delivering new books that arrive during the move so the new library opens complete.",
      examTip: "'Different database engines' → <strong>SCT + DMS</strong>. 'Minimal downtime' → <strong>full load + CDC</strong>. Trap: if the goal is to cut licence cost, 'RDS for Oracle' fails the goal; if it's 'keep Oracle features, minimal change', RDS for Oracle is right.",
      terms: [
        { t: "SCT", d: "Schema Conversion Tool: converts schema and code between engines, with an assessment report." },
        { t: "CDC", d: "Change data capture: reading the source's transaction log to stream ongoing changes." },
        { t: "Replication instance", d: "The compute DMS uses to run tasks; or use DMS Serverless instead." },
        { t: "Homogeneous vs heterogeneous", d: "Same engine on both sides vs different engines (needs SCT)." },
        { t: "Babelfish", d: "Aurora PostgreSQL feature that understands SQL Server's T-SQL, easing that migration." }
      ],
      check: [
        {
          q: "Move an Oracle database to Aurora PostgreSQL with minimal downtime. What's the right sequence?",
          options: ["DMS full load only, then switch", "SCT to convert schema, then DMS full load + CDC", "Export a dump and import it on a weekend"],
          answer: 1,
          why: "Different engines need SCT for the schema, and full load + CDC keeps the target current until a short cutover. A full load alone misses changes made during the copy."
        },
        {
          q: "A MySQL database moves to Aurora MySQL. Do you need SCT?",
          options: ["Yes, always", "No, same engine family, DMS or native tools suffice", "Only if the database is over 1 TB"],
          answer: 1,
          why: "Homogeneous migrations keep the schema as-is, so SCT isn't needed. Size doesn't change that."
        }
      ]
    },
    "mgn-discovery": {
      minutes: 4,
      tldr: [
        "<strong>MGN</strong> (Application Migration Service) is the rehost tool: an agent copies disks <strong>block by block, continuously</strong> into a cheap staging area.",
        "<strong>Test launches</strong> prove the server boots in AWS without touching the source. <strong>Cutover</strong> takes minutes.",
        "MGN is free for <strong>90 days per server</strong>, then hourly. SMS is retired, so it's always a distractor.",
        "<strong>Application Discovery Service</strong>: agentless for inventory; <strong>agents</strong> to map network dependencies. Results go to <strong>Migration Hub</strong>.",
        "<strong>VM Import/Export</strong> turns a static VM image into an AMI: no ongoing sync."
      ],
      analogy: "MGN is like live-mirroring your phone to a new one: it keeps copying changes in the background, you test the new phone whenever you like, and on switch day there's only a minute of catching up.",
      examTip: "'Lift-and-shift with minimal downtime' / 'block-level replication' → <strong>MGN</strong>. Static VM image → <strong>VM Import/Export</strong>. Same replication tech but for DR → <strong>Elastic Disaster Recovery</strong>. 'What depends on what' → <strong>Discovery agents</strong>.",
      terms: [
        { t: "Replication agent", d: "Software on the source server that streams disk blocks to AWS." },
        { t: "Staging area", d: "Small EC2 instances and cheap EBS volumes holding replicated data until launch." },
        { t: "Test launch", d: "Boot a copy in AWS to check it works, while replication continues." },
        { t: "Migration Hub", d: "Central place to group servers into apps and track migration progress." },
        { t: "Agent-based discovery", d: "Collects processes and network connections so you can map dependencies." }
      ],
      check: [
        {
          q: "Before planning waves, you need to know which servers call which others. What do you use?",
          options: ["Agentless discovery collector", "Discovery Service agents on the servers", "VM Import/Export"],
          answer: 1,
          why: "Only the agents capture network connections and processes for a dependency map. The agentless collector gives inventory and utilization, not dependencies."
        },
        {
          q: "Migrate 200 live servers with changing data and minutes of downtime. Which service?",
          options: ["VM Import/Export", "Application Migration Service (MGN)", "Server Migration Service (SMS)"],
          answer: 1,
          why: "MGN replicates continuously so cutover is quick. VM Import is a one-time image with no sync; SMS is retired."
        }
      ]
    }
  }
});
