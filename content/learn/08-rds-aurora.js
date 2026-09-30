/* Learning layer — Module 8: RDS & Aurora */
window.COURSE.registerLearn({
  moduleId: "rds-aurora",
  bigPicture: "<strong>RDS</strong> runs a normal database (MySQL, PostgreSQL, SQL Server, Oracle...) for you: AWS handles the server, patches, backups and failover; you handle tables and queries. <strong>Aurora</strong> is AWS's rebuilt version of MySQL/PostgreSQL with shared storage copied 6 times across 3 AZs, so it fails over faster and scales reads further. The exam's favourite question here is <strong>Multi-AZ (stay up) vs read replicas (read faster)</strong> — learn that difference first.",
  cheatsheet: [
    { k: "Automatic failover, high availability", v: "<strong>Multi-AZ</strong> — synchronous standby in another AZ." },
    { k: "Offload reporting / scale read traffic", v: "<strong>Read replicas</strong> — asynchronous, readable, up to 15." },
    { k: "HA plus readable standbys, failover under 35 s", v: "<strong>Multi-AZ DB cluster</strong> (1 writer + 2 readers)." },
    { k: "Cheap DR in another Region for plain RDS", v: "<strong>Cross-Region read replica</strong>, promote on disaster." },
    { k: "Restore the database to 10:42 this morning", v: "<strong>Point-in-time restore</strong> — creates a <em>new</em> instance." },
    { k: "Keep backups for 7 years", v: "<strong>Manual snapshots</strong> or AWS Backup — automated max 35 days." },
    { k: "Encrypt an existing unencrypted database", v: "Snapshot &rarr; <strong>copy with encryption</strong> &rarr; restore &rarr; cut over." },
    { k: "Share an encrypted snapshot with another account", v: "Re-encrypt with a <strong>customer managed KMS key</strong>, share key + snapshot." },
    { k: "Log in to the DB without a password", v: "<strong>IAM database authentication</strong> (15-minute token)." },
    { k: "Rotate the database password automatically", v: "<strong>Secrets Manager</strong> managed rotation." },
    { k: "Find which SQL query is causing high load", v: "<strong>Performance Insights</strong> (now CloudWatch Database Insights)." },
    { k: "Lambda functions exhaust DB connections", v: "<strong>RDS Proxy</strong> — pools and shares connections." },
    { k: "Need OS access or custom agents on the DB host", v: "<strong>RDS Custom</strong> (Oracle/SQL Server) or EC2." },
    { k: "Scale reads in ms-lag, failover under 30 s", v: "<strong>Aurora</strong> with replicas (any replica is a failover target)." },
    { k: "Send analytics to specific replicas only", v: "<strong>Aurora custom endpoint</strong>." },
    { k: "Unpredictable or spiky relational workload", v: "<strong>Aurora Serverless v2</strong>." },
    { k: "Cross-Region RPO ~1 s, RTO under a minute", v: "<strong>Aurora Global Database</strong>." },
    { k: "Undo a bad UPDATE on Aurora MySQL in minutes, in place", v: "<strong>Backtrack</strong> (up to 72 h)." },
    { k: "Full-size test copy of production in seconds", v: "<strong>Aurora fast cloning</strong> (copy-on-write)." },
    { k: "Move a SQL Server app to PostgreSQL with minimal code changes", v: "<strong>Babelfish for Aurora PostgreSQL</strong>." }
  ],
  lessons: {
    "managed-not-magic": {
      minutes: 4,
      tldr: [
        "RDS is a normal database engine on a server you <strong>can't log into</strong>. AWS patches, backs up and fails it over.",
        "Settings go in <strong>parameter groups</strong>; extra engine features go in <strong>option groups</strong>.",
        "Storage is EBS underneath (gp3 or io1/io2). <strong>Storage autoscaling</strong> grows it, but you can <strong>never shrink</strong> it.",
        "Patches happen in a weekly <strong>maintenance window</strong>; Multi-AZ turns that into a short failover.",
        "Need OS access or custom software on the host? That's <strong>RDS Custom</strong> or EC2, not RDS."
      ],
      analogy: "RDS is like renting a fully serviced apartment: cleaning, repairs and security are handled, and you just live there. But you can't knock down walls or rewire the electrics — for that you'd need your own house (EC2).",
      examTip: "'Reduce the effort of patching and backups' &rarr; RDS/Aurora instead of a database on EC2. 'Needs access to the operating system / install an agent' &rarr; RDS Custom or EC2, never plain RDS.",
      terms: [
        { t: "Parameter group", d: "Named set of engine settings applied to DB instances. Some changes need a reboot." },
        { t: "Option group", d: "Turns on extra engine features, e.g. Oracle TDE." },
        { t: "Storage autoscaling", d: "RDS grows storage automatically when free space runs low, up to a maximum you set." },
        { t: "Maintenance window", d: "Weekly 30-minute slot when AWS may apply patches." },
        { t: "RDS Custom", d: "RDS for Oracle/SQL Server that gives you OS access and more responsibility." }
      ],
      check: [
        {
          q: "A DBA must install a third-party monitoring agent on the database host's operating system. Which option allows it?",
          options: ["Standard RDS with a custom parameter group", "RDS Custom or a database on EC2", "Aurora Serverless v2"],
          answer: 1,
          why: "Standard RDS and Aurora give no OS access. RDS Custom (Oracle/SQL Server) or self-managed EC2 do."
        },
        {
          q: "RDS storage autoscaling grew a volume from 500 GB to 900 GB. Data was then deleted. Can storage shrink back?",
          options: ["Yes, automatically", "No, RDS storage can only grow; you'd need to migrate to a new instance", "Yes, with a static parameter change"],
          answer: 1,
          why: "RDS storage never shrinks. Getting smaller means dumping and restoring, or DMS, into a new smaller instance."
        }
      ]
    },

    "ha-vs-read-scaling": {
      minutes: 4,
      tldr: [
        "<strong>Multi-AZ</strong> = availability. A <strong>synchronous</strong> standby in another AZ that you <strong>can't read from</strong>. Auto failover in ~1-2 minutes.",
        "<strong>Read replicas</strong> = read scaling. <strong>Asynchronous</strong> copies you can query, up to 15, even in other Regions.",
        "Replicas can lag, and promoting one is <strong>manual</strong> and one-way.",
        "<strong>Multi-AZ DB cluster</strong>: 1 writer + 2 readable standbys in 3 AZs, failover usually under 35 s.",
        "Failover works by changing the DNS endpoint to the standby."
      ],
      analogy: "Multi-AZ is an understudy in a theatre: they know every line but never go on stage unless the lead collapses. Read replicas are extra ticket booths: they serve more customers, but their information can be a few seconds out of date.",
      examTip: "The classic trap: <em>Multi-AZ does not scale reads</em>, and <em>read replicas don't give automatic failover</em>. 'High availability / automatic failover' &rarr; Multi-AZ. 'Offload reporting / read-heavy' &rarr; read replicas.",
      terms: [
        { t: "Standby", d: "The Multi-AZ copy that takes over on failure. Not readable in the classic setup." },
        { t: "Synchronous replication", d: "A write only counts as done once it's saved in both places. No data loss on failover." },
        { t: "Asynchronous replication", d: "Copies happen shortly after the write, so replicas can lag behind." },
        { t: "Replica lag", d: "How far behind a read replica is, in seconds." },
        { t: "Promotion", d: "Turning a read replica into a standalone writable database. Manual and permanent." }
      ],
      check: [
        {
          q: "Reporting queries are slowing down a production RDS MySQL database. What should you add?",
          options: ["Multi-AZ deployment", "A read replica for the reports", "A bigger maintenance window"],
          answer: 1,
          why: "Read replicas take read-only traffic off the primary. The classic Multi-AZ standby can't serve any queries at all."
        },
        {
          q: "The business needs the database to fail over automatically if an AZ goes down. Which feature?",
          options: ["A read replica in another AZ", "Multi-AZ", "Daily snapshots"],
          answer: 1,
          why: "Multi-AZ fails over to the synchronous standby automatically. A read replica would need a manual promotion and could lose recent writes."
        }
      ]
    },

    "backups-pitr": {
      minutes: 4,
      tldr: [
        "<strong>Automated backups</strong>: a daily snapshot plus transaction logs every ~5 minutes; kept 1-35 days.",
        "They allow <strong>point-in-time restore (PITR)</strong> to any second, up to about 5 minutes ago.",
        "<strong>Every restore creates a new instance</strong> with a new endpoint — never in place.",
        "<strong>Manual snapshots</strong> live until you delete them; use them for long retention, sharing and copying.",
        "Snapshots with the default <code>aws/rds</code> key can't be shared across accounts."
      ],
      analogy: "Automated backups are a nightly photo of your room plus a video of everything since. To see the room at 3:17 pm, you start from last night's photo and fast-forward the video. Manual snapshots are photos you frame and keep forever.",
      examTip: "'Restore to a specific time' &rarr; PITR, and remember it creates a <em>new</em> instance. 'Keep backups for years' &rarr; manual snapshots or AWS Backup, since automated backups max out at 35 days.",
      terms: [
        { t: "Automated backup", d: "Daily snapshot plus logs, retained 1-35 days, enabling point-in-time restore." },
        { t: "Point-in-time restore", d: "Rebuild the database as it was at a chosen second, into a new instance." },
        { t: "Manual snapshot", d: "A backup you take yourself; kept until you delete it, even after the DB is gone." },
        { t: "RPO / RTO", d: "How much data you can lose / how long recovery can take." },
        { t: "Cross-Region backup replication", d: "Copies automated backups and logs to another Region for PITR there." }
      ],
      check: [
        {
          q: "Someone dropped a table at 14:05. How do you get the data back on RDS?",
          options: ["Restore the instance in place to 14:04", "Point-in-time restore to 14:04 as a new instance, then switch the app", "Promote the Multi-AZ standby"],
          answer: 1,
          why: "RDS restores always create a new instance. The Multi-AZ standby is useless here: it received the DROP synchronously too."
        },
        {
          q: "Compliance requires keeping database backups for 7 years. What do you use?",
          options: ["Automated backups set to 7 years", "Manual snapshots or AWS Backup", "A read replica"],
          answer: 1,
          why: "Automated backups max out at 35 days. Manual snapshots (or AWS Backup plans) are kept as long as you want."
        }
      ]
    },

    "security-encryption-insights": {
      minutes: 4,
      tldr: [
        "Encryption at rest (KMS) must be chosen <strong>at creation</strong>. It covers storage, backups, snapshots and replicas.",
        "To encrypt an existing DB: snapshot &rarr; <strong>copy with encryption</strong> &rarr; restore new instance &rarr; switch over.",
        "<strong>IAM database authentication</strong> replaces passwords with 15-minute tokens (MySQL, MariaDB, PostgreSQL).",
        "Keep databases in <strong>private subnets</strong>, reachable only from the app tier's security group.",
        "<strong>Performance Insights</strong> shows which queries and waits create load; 7 days free."
      ],
      analogy: "Encryption at rest is like choosing a safe when you build a house: you can't turn an ordinary wall into a safe later. You build a new house with the safe in it and move your things over.",
      examTip: "'Existing database must be encrypted at rest' &rarr; snapshot, encrypted copy, restore. 'Enable encryption on the instance' is impossible, and 'enable TLS' only covers data in transit. 'Which query causes high CPU?' &rarr; Performance Insights.",
      terms: [
        { t: "Encryption at rest", d: "Data on disk is encrypted with a KMS key; decided when the DB is created." },
        { t: "IAM DB authentication", d: "Connect with a short-lived signed token from IAM instead of a password." },
        { t: "TLS in transit", d: "Encrypts traffic between app and database; can be forced by a parameter." },
        { t: "Performance Insights", d: "Dashboard of database load by SQL, wait event, host and user. Moving into CloudWatch Database Insights." },
        { t: "Enhanced Monitoring", d: "OS-level metrics (per-process CPU, memory) from an agent on the host." }
      ],
      check: [
        {
          q: "An existing unencrypted RDS PostgreSQL database must be encrypted at rest. What's the correct approach?",
          options: ["Modify the instance and tick 'enable encryption'", "Snapshot, copy the snapshot with encryption, restore a new instance", "Force TLS connections"],
          answer: 1,
          why: "Encryption can't be switched on for an existing instance. You go through an encrypted snapshot copy. TLS only protects data moving over the network."
        },
        {
          q: "Lambda functions should connect to RDS PostgreSQL without storing any database password. Which feature?",
          options: ["IAM database authentication", "Secrets Manager rotation", "A parameter group"],
          answer: 0,
          why: "IAM auth uses short-lived tokens from the function's role, so there's no password at all. Secrets Manager still stores a password, it just rotates it."
        }
      ]
    },

    "rds-proxy": {
      minutes: 4,
      tldr: [
        "Databases struggle with thousands of short connections. <strong>RDS Proxy</strong> keeps a pool of connections and shares them.",
        "It's the fix for <strong>Lambda exhausting database connections</strong>.",
        "It makes <strong>failover faster</strong> (up to ~66%) by holding client connections and re-routing without DNS.",
        "It reads DB credentials from <strong>Secrets Manager</strong>; clients can use IAM auth. VPC-only.",
        "Sessions that set state (temp tables, SET statements) get <strong>pinned</strong>, which removes the pooling benefit."
      ],
      analogy: "RDS Proxy is a taxi rank: instead of every passenger buying their own car (a database connection), a small fleet of taxis serves everyone in turn. A passenger who insists on keeping the taxi all day (pinning) breaks the system.",
      examTip: "'Lambda functions cause too many connections' or 'connection errors during traffic spikes' &rarr; RDS Proxy. 'Increase max_connections' is the tempting wrong answer — it just burns memory.",
      terms: [
        { t: "Connection pooling", d: "Reusing a small set of open database connections for many clients." },
        { t: "Multiplexing", d: "Many client connections share fewer database connections between statements." },
        { t: "Pinning", d: "Proxy ties a client to one DB connection because its session has state; pooling stops helping." },
        { t: "Secrets Manager", d: "Stores the DB credentials the proxy uses to log in to the database." }
      ],
      check: [
        {
          q: "During traffic spikes, thousands of Lambda invocations cause 'too many connections' errors on Aurora PostgreSQL. Best fix?",
          options: ["Raise max_connections", "Put RDS Proxy between Lambda and Aurora", "Enable Multi-AZ", "Add ElastiCache"],
          answer: 1,
          why: "RDS Proxy pools and shares connections so the database sees a small, steady number. Raising max_connections only uses more memory and delays the failure."
        },
        {
          q: "An app behind RDS Proxy sets session variables on every connection. The pinned-sessions metric equals the client count. What does that mean?",
          options: ["The proxy is working perfectly", "Every session is pinned, so the proxy gives almost no pooling benefit", "The database is failing over"],
          answer: 1,
          why: "Session state forces pinning: one DB connection per client again, plus an extra hop. Move setup into proxy init queries or remove the SET calls."
        }
      ]
    },

    "aurora-architecture": {
      minutes: 4,
      tldr: [
        "Aurora keeps MySQL/PostgreSQL compatibility but replaces storage: <strong>6 copies across 3 AZs</strong>, shared by all instances.",
        "Writes need <strong>4 of 6</strong> copies; it survives losing a whole AZ plus one more copy.",
        "Storage <strong>grows automatically</strong> (128 TiB in most exam material, 256 TiB on newer versions).",
        "Up to <strong>15 replicas</strong> with millisecond lag; <strong>any replica can become the writer</strong>, usually in under 30 s.",
        "Endpoints: <strong>cluster</strong> (writer), <strong>reader</strong> (spreads over replicas), <strong>custom</strong> (a group you choose)."
      ],
      analogy: "Classic databases are like each chef having a private fridge that must be restocked by copying. Aurora is one big shared walk-in fridge that all chefs use. Adding a chef (replica) is quick, and if the head chef leaves, another steps in with the same ingredients.",
      examTip: "Memorize: <strong>6 copies, 3 AZs, 4/6 write quorum, 3/6 read quorum, 15 replicas, failover &lt; 30 s</strong>. Aurora replicas do double duty: read scaling <em>and</em> failover target. For analytics isolated from app reads, use a <strong>custom endpoint</strong>.",
      terms: [
        { t: "Cluster volume", d: "Aurora's shared storage, copied six ways across three AZs." },
        { t: "Quorum", d: "Minimum copies that must agree: 4 of 6 for writes, 3 of 6 for recovery reads." },
        { t: "Reader endpoint", d: "One DNS name that spreads connections across all Aurora replicas." },
        { t: "Custom endpoint", d: "Endpoint pointing at a subset of replicas you pick, e.g. for reporting." },
        { t: "Failover priority tier", d: "Number 0-15 per replica; the lowest tier is promoted first." }
      ],
      check: [
        {
          q: "An Aurora cluster has a writer and two replicas. The writer's AZ fails. What happens?",
          options: ["Manual restore from snapshot", "A replica is promoted to writer, usually in under 30 seconds", "The cluster is read-only until the AZ returns"],
          answer: 1,
          why: "Every Aurora replica is a failover target because storage is shared. Aurora promotes the highest-priority replica and moves the cluster endpoint."
        },
        {
          q: "Heavy analytics queries must not slow down the replicas that serve the web app. What do you use?",
          options: ["The reader endpoint", "A custom endpoint for dedicated analytics replicas", "The cluster endpoint"],
          answer: 1,
          why: "A custom endpoint targets only the replicas you choose. The reader endpoint would mix analytics into all replicas, and the cluster endpoint is the writer."
        }
      ]
    },

    "aurora-advanced": {
      minutes: 4,
      tldr: [
        "<strong>Serverless v2</strong> scales capacity up and down in small steps (ACUs) with no dropped connections. Great for spiky load.",
        "<strong>Global Database</strong>: storage copied to other Regions with ~1 s lag; promote a secondary in under a minute.",
        "<strong>Backtrack</strong> (Aurora MySQL) rewinds the same cluster up to 72 h, in minutes, without a restore.",
        "<strong>Fast cloning</strong> makes a full-size copy almost instantly; you only pay for changed pages.",
        "<strong>Babelfish</strong> lets SQL Server apps talk to Aurora PostgreSQL with few code changes."
      ],
      analogy: "Backtrack is the undo button in a document: you step back in time on the same file. Point-in-time restore is opening an old copy from the archive as a brand-new file. Cloning is 'save as' that takes no extra space until you edit.",
      examTip: "'Unpredictable / intermittent workload' &rarr; Serverless v2. 'Cross-Region RPO ~1 second, RTO under a minute' &rarr; Global Database. 'Undo a mistake quickly without restoring' &rarr; Backtrack. 'SQL Server app, minimal code changes, PostgreSQL' &rarr; Babelfish.",
      terms: [
        { t: "ACU", d: "Aurora Capacity Unit: about 2 GB of memory plus matching CPU. Serverless v2 bills per ACU-hour." },
        { t: "Global Database", d: "One primary Region plus up to 10 read-only secondary Regions (5 in older material)." },
        { t: "Write forwarding", d: "Lets apps in a secondary Region send writes, forwarded to the primary." },
        { t: "Backtrack", d: "Rewinds an Aurora MySQL cluster in place to an earlier time, up to 72 hours." },
        { t: "Fast cloning", d: "Copy-on-write copy of a cluster, created in minutes regardless of size." },
        { t: "Babelfish", d: "SQL Server wire protocol and T-SQL support on Aurora PostgreSQL." }
      ],
      check: [
        {
          q: "A global app needs its relational database readable in 3 Regions, RPO about 1 second and RTO under a minute. Which service?",
          options: ["RDS cross-Region read replicas", "Aurora Global Database", "Multi-AZ DB cluster", "Cross-Region snapshot copy"],
          answer: 1,
          why: "Aurora Global Database replicates storage with ~1 s lag and promotes in under a minute. RDS replicas lag more and need manual promotion; Multi-AZ never leaves one Region."
        },
        {
          q: "At 14:00 a developer ran an UPDATE without a WHERE clause on Aurora MySQL. What's the fastest way back?",
          options: ["Point-in-time restore to a new cluster", "Backtrack the cluster to 13:59", "Promote a replica"],
          answer: 1,
          why: "Backtrack rewinds the existing cluster in minutes. PITR builds a new cluster and takes much longer; replicas already contain the bad update."
        }
      ]
    }
  }
});
