/* Learning layer — Module 4: EC2 & Compute Fundamentals */
window.COURSE.registerLearn({
  moduleId: "ec2",
  bigPicture: "EC2 is renting virtual servers, and the exam cares about four choices you make each time: <strong>what hardware</strong> (instance family and size), <strong>where</strong> (AZ and placement group), <strong>which price contract</strong> (On-Demand, Savings Plans, Reserved, Spot, capacity reservation) and <strong>how long data lives</strong> (EBS vs instance store, stop vs terminate). Underneath sits Nitro, AWS's own hardware that explains most of EC2's rules. Cost questions about purchase options and security questions about IMDSv2 appear on almost every exam.",
  cheatsheet: [
    { k: "Steady 24/7 workload, maximum flexibility across families, regions, Fargate, Lambda", v: "<strong>Compute Savings Plan</strong> (up to ~66%)" },
    { k: "Steady workload, one known family and region, deepest discount", v: "<strong>EC2 Instance Savings Plan</strong> or <strong>Standard RI</strong> (up to ~72%)" },
    { k: "Committed but project cancelled, want money back", v: "<strong>Standard RI</strong> resold on the RI Marketplace" },
    { k: "Fault-tolerant, stateless, batch or containers, lowest cost", v: "<strong>Spot</strong> (up to 90% off, 2-minute warning)" },
    { k: "Fewer Spot interruptions", v: "<strong>price-capacity-optimized</strong> allocation + many instance types and AZs" },
    { k: "React to a Spot interruption", v: "2-minute notice via <strong>EventBridge</strong> or <strong>IMDS</strong> instance-action" },
    { k: "Guaranteed capacity in one AZ, no long commitment", v: "<strong>On-Demand Capacity Reservation</strong> + Savings Plan for the discount" },
    { k: "Lowest latency between nodes, HPC or tightly coupled", v: "<strong>Cluster placement group</strong> (one AZ) + <strong>EFA</strong>" },
    { k: "A few critical instances must not share hardware", v: "<strong>Spread placement group</strong> — max 7 per AZ" },
    { k: "Kafka, HDFS, Cassandra need rack-level isolation", v: "<strong>Partition placement group</strong>" },
    { k: "Cheaper compute for Linux JVM or Node service, little code change", v: "<strong>Graviton</strong> (g suffix, Arm)" },
    { k: "Millions of IOPS, app replicates its own data", v: "<strong>Instance store</strong> on i-family" },
    { k: "Data vanished after stop/start", v: "It was on <strong>instance store</strong> — ephemeral" },
    { k: "Use an AMI in another region", v: "<strong>copy-image</strong> — AMIs are regional" },
    { k: "Share an encrypted AMI with another account", v: "Use a <strong>customer managed KMS key</strong>, not the default key" },
    { k: "Protect instance credentials from SSRF", v: "<strong>IMDSv2 required</strong> (HttpTokens=required)" },
    { k: "Secrets needed at boot", v: "<strong>Secrets Manager / Parameter Store</strong> via instance role, never user data" },
    { k: "Keep RAM state for fast resume", v: "<strong>Hibernate</strong> — needs encrypted EBS root" },
    { k: "Per-socket or per-core BYOL licences (Windows, SQL Server, Oracle)", v: "<strong>Dedicated Host</strong>" }
  ],
  lessons: {
    "instance-anatomy": {
      minutes: 5,
      tldr: [
        "Read names left to right: <code>c7g.2xlarge</code> = family <strong>c</strong>, generation <strong>7</strong>, suffix <strong>g</strong> (Graviton), size <strong>2xlarge</strong>.",
        "Families: <strong>m</strong> general, <strong>c</strong> compute, <strong>r/x/u</strong> memory, <strong>i/d</strong> local storage, <strong>p/g/inf/trn</strong> accelerated, <strong>t</strong> burstable.",
        "Each size step doubles CPU and memory. Newer generations are usually cheaper per unit of work.",
        "<strong>Graviton</strong> (Arm) is roughly 10-20% cheaper with better price-performance for most Linux workloads.",
        "<strong>t</strong> instances run on CPU credits: fine for spiky, bad for sustained load."
      ],
      analogy: "Instance names are like car model codes: the letter says the body type (van, sports car, truck), the number says the model year, the suffix says the engine, and the size says how many seats. Once you know the code, you can guess the car without looking it up.",
      examTip: "\"SAP HANA / terabytes of RAM\" = <strong>X or High Memory</strong>. \"Lower cost, Arm-compatible, minimal change\" = <strong>Graviton</strong>. \"ML training\" = <strong>p-family</strong>.",
      terms: [
        { t: "Instance family", d: "The letter(s) that say what the instance is tuned for, e.g. c for compute." },
        { t: "Graviton", d: "AWS-designed Arm processor, marked by a g suffix; cheaper per unit of work." },
        { t: "Burstable (t family)", d: "Low baseline CPU plus credits for bursts; unlimited mode bills overage." },
        { t: "vCPU", d: "A virtual CPU. On Graviton it is a full core; on x86 usually a hyperthread." },
        { t: ".metal", d: "A size with no hypervisor, giving you the whole physical server." }
      ],
      check: [
        {
          q: "A Linux Java service needs lower compute cost with minimal code change and no interruption risk. Best choice?",
          options: ["Move to Spot instances", "Move to Graviton instances", "Move to t-family burstable instances"],
          answer: 1,
          why: "Java runs on Arm unchanged, so <strong>Graviton</strong> cuts cost with no interruption risk. Spot can be interrupted; t-family chokes under steady load."
        },
        {
          q: "What does the d in m6id mean?",
          options: ["Dedicated tenancy", "Local NVMe instance store included", "Double memory"],
          answer: 1,
          why: "The <strong>d</strong> suffix adds local NVMe instance store to the family's normal CPU and memory ratio."
        }
      ]
    },
    "nitro": {
      minutes: 5,
      tldr: [
        "<strong>Nitro</strong> moves networking, storage and security off the main server onto dedicated cards, leaving a very thin hypervisor.",
        "Result: near bare-metal performance, and almost all of the host is usable by customers.",
        "<strong>No operator access</strong>: there is no shell or API for AWS staff to read your instance memory.",
        "Security groups are enforced on the Nitro card, outside your OS, so a hacked instance cannot switch them off.",
        "<strong>Nitro Enclaves</strong>: isolated compute with no network, no storage, no admin access; KMS can release keys only to attested code."
      ],
      analogy: "Nitro is like a restaurant where the chef only cooks, and separate specialist staff handle deliveries, storage and security at the doors. The kitchen is faster, and the door staff don't have keys to the diners' private rooms.",
      examTip: "\"Process highly sensitive data (keys, card numbers) in an isolated environment with no persistent storage, no interactive access and no external network\" = <strong>Nitro Enclaves</strong>.",
      terms: [
        { t: "Nitro system", d: "AWS's hardware and thin hypervisor platform behind all modern EC2 instances." },
        { t: "Nitro card", d: "Dedicated hardware that handles VPC networking, EBS and instance storage." },
        { t: "Nitro Enclave", d: "Isolated VM carved from an instance, reachable only via a local socket." },
        { t: "Attestation", d: "Signed proof of exactly which code an enclave booted; KMS can require it." },
        { t: "ENA", d: "Elastic Network Adapter, the fast virtual network card Nitro gives instances." }
      ],
      check: [
        {
          q: "A payments team must decrypt card numbers so that not even root on the parent instance can see the key. What should they use?",
          options: ["Dedicated Hosts", "Nitro Enclaves with KMS attestation", "An encrypted EBS volume"],
          answer: 1,
          why: "<strong>Enclaves</strong> isolate the processing from the parent instance, and KMS releases the key only to the attested enclave code. Dedicated Hosts are about licensing."
        },
        {
          q: "An attacker gets root on an EC2 instance. Can they disable its security group from inside?",
          options: ["Yes, with iptables", "No, security groups are enforced on the Nitro card outside the guest", "Yes, by stopping the network service"],
          answer: 1,
          why: "Security groups run on the <strong>Nitro card</strong>, not in the instance's OS, so nothing inside the guest can change them."
        }
      ]
    },
    "purchase-options": {
      minutes: 4,
      tldr: [
        "<strong>On-Demand</strong>: pay per second, no commitment, but no capacity promise either.",
        "<strong>Reserved Instances</strong>: 1 or 3 years for up to ~72% off. <strong>Standard</strong> = deepest, resellable; <strong>Convertible</strong> = exchangeable, ~66%.",
        "<strong>Savings Plans</strong>: commit to dollars per hour. <strong>Compute SP</strong> covers any EC2, Fargate and Lambda; <strong>EC2 Instance SP</strong> is one family in one region.",
        "Only <strong>zonal RIs</strong> reserve capacity. Regional RIs and Savings Plans are discounts only.",
        "Commit to your always-on <strong>floor</strong>, not your average: unused commitment is lost each hour."
      ],
      analogy: "On-Demand is paying for a taxi each ride. A Savings Plan is a monthly transport budget that discounts whatever rides you take. A Standard RI is leasing one specific car model: cheaper, but you're stuck with it — though you can sell the lease on.",
      examTip: "\"Will change instance families or move to Graviton/Fargate\" = <strong>Compute Savings Plan</strong>. \"Recover money from an unused reservation\" = <strong>Standard RI on the Marketplace</strong> (Convertibles cannot be sold).",
      terms: [
        { t: "Standard RI", d: "Reservation with the biggest discount; can be modified and resold, not exchanged." },
        { t: "Convertible RI", d: "Reservation you can exchange for other families or OS; smaller discount." },
        { t: "Compute Savings Plan", d: "Hourly spend commitment covering any EC2, Fargate and Lambda usage." },
        { t: "EC2 Instance Savings Plan", d: "Hourly commitment tied to one instance family in one region; deeper discount." },
        { t: "Zonal vs regional RI", d: "Zonal also reserves capacity in one AZ; regional only discounts, but flexes across AZs and sizes." }
      ],
      check: [
        {
          q: "A company runs steady EC2 today but plans to move parts to Fargate and Lambda next year. Which commitment fits?",
          options: ["Standard Reserved Instances", "EC2 Instance Savings Plan", "Compute Savings Plan"],
          answer: 2,
          why: "Only the <strong>Compute Savings Plan</strong> follows usage into Fargate and Lambda. The other two are tied to EC2 instances."
        },
        {
          q: "Which option guarantees capacity in a specific AZ?",
          options: ["A regional Reserved Instance", "A Compute Savings Plan", "A zonal Reserved Instance"],
          answer: 2,
          why: "Only a <strong>zonal RI</strong> (or a capacity reservation) holds capacity. Regional RIs and Savings Plans are just discounts."
        }
      ]
    },
    "spot": {
      minutes: 4,
      tldr: [
        "<strong>Spot</strong> = spare AWS capacity at up to <strong>90% off</strong>. AWS can take it back with a <strong>2-minute warning</strong>.",
        "The warning arrives via <strong>EventBridge</strong> and the <strong>IMDS</strong> <code>spot/instance-action</code> path; a softer rebalance signal may come earlier.",
        "Interruptions happen per <strong>pool</strong> (one type in one AZ), so spread across many types and AZs.",
        "Use the <strong>price-capacity-optimized</strong> allocation strategy; lowest-price causes the most interruptions.",
        "Blend with On-Demand in an Auto Scaling group <strong>mixed instances policy</strong>."
      ],
      analogy: "Spot is flying standby: very cheap seats, but you can be bumped with a short warning. If you're flexible about which flight and which airline, you almost always get somewhere; insist on one exact flight and you'll often be left at the gate.",
      examTip: "\"Fault-tolerant / batch / stateless, minimize cost\" = <strong>Spot</strong>. Anything stateful with no way to checkpoint, or a strict SLA, is a red flag for Spot.",
      terms: [
        { t: "Spot interruption notice", d: "Two-minute warning before AWS reclaims a Spot instance." },
        { t: "Rebalance recommendation", d: "Early hint that a pool is at higher risk; no guaranteed lead time." },
        { t: "Capacity pool", d: "One instance type in one AZ; the unit that gets interrupted." },
        { t: "price-capacity-optimized", d: "Allocation strategy picking deep pools first, then the cheapest of them. Recommended default." },
        { t: "Mixed instances policy", d: "ASG setting mixing On-Demand base capacity with Spot above it across many types." }
      ],
      check: [
        {
          q: "A Spot batch fleet using the lowest-price strategy on one instance type gets interrupted often. Best fix?",
          options: ["Switch to price-capacity-optimized across several types and AZs", "Bid a higher Spot price", "Use a bigger instance size"],
          answer: 0,
          why: "Diversifying and choosing deep pools with <strong>price-capacity-optimized</strong> cuts interruptions. Bidding wars no longer exist; price is not the lever."
        },
        {
          q: "How much warning does a Spot instance get before AWS reclaims it?",
          options: ["30 seconds", "2 minutes", "15 minutes"],
          answer: 1,
          why: "The <strong>interruption notice is 2 minutes</strong>. Design so draining and checkpointing fit inside it."
        }
      ]
    },
    "placement-networking": {
      minutes: 5,
      tldr: [
        "<strong>Cluster</strong>: instances packed close in <strong>one AZ</strong> for the lowest latency and highest throughput.",
        "<strong>Spread</strong>: each instance on separate hardware, <strong>max 7 per AZ</strong>, for a few critical nodes.",
        "<strong>Partition</strong>: groups of racks (up to 7 per AZ) for big distributed systems like Kafka, HDFS, Cassandra.",
        "<strong>ENA</strong> is standard enhanced networking (up to 100 Gbps). <strong>EFA</strong> adds OS-bypass for HPC/ML, same subnet only.",
        "Placement groups are free. Launch cluster groups all at once to avoid capacity errors."
      ],
      analogy: "Cluster is seating a team at one table so they can talk fast — but one spilled drink hits everyone. Spread is seating each VIP in a different room. Partition is splitting a big group into separate rooms, with each group sharing its own room.",
      examTip: "\"Lowest latency between nodes / tightly coupled HPC\" = <strong>cluster + EFA</strong>. \"Critical instances must not share hardware\" = <strong>spread</strong>, but watch for more than 7 per AZ — that is the trap.",
      terms: [
        { t: "Cluster placement group", d: "Packs instances close together in one AZ for low latency." },
        { t: "Spread placement group", d: "Puts each instance on distinct hardware; max 7 running per AZ." },
        { t: "Partition placement group", d: "Splits instances into isolated rack groups; partition number visible to the app." },
        { t: "EFA", d: "Elastic Fabric Adapter: network card with OS-bypass for MPI and ML training." },
        { t: "Insufficient Capacity Error (ICE)", d: "AWS cannot place the instances you asked for, common in cluster groups." }
      ],
      check: [
        {
          q: "A team wants 10 critical instances in one AZ, each guaranteed on separate hardware. What is the problem?",
          options: ["Spread groups allow at most 7 running instances per AZ", "Spread groups only work across regions", "Nothing, spread groups have no limit"],
          answer: 0,
          why: "A <strong>spread group is capped at 7 per AZ</strong>. Spread across more AZs or use a partition group."
        },
        {
          q: "A tightly coupled MPI simulation needs the lowest possible inter-node latency. Which setup?",
          options: ["Spread placement group across 3 AZs", "Cluster placement group with EFA", "Partition placement group with ENA"],
          answer: 1,
          why: "<strong>Cluster + EFA</strong> gives the shortest network paths and kernel-bypass messaging. Spread and multi-AZ add distance."
        }
      ]
    },
    "amis-storage": {
      minutes: 5,
      tldr: [
        "An <strong>AMI</strong> is a launch template for disks: snapshots, settings and who may use it. AMIs are <strong>regional</strong>.",
        "<strong>Instance store</strong> is a disk inside the host: extremely fast, but data is <strong>lost on stop, terminate or host failure</strong>.",
        "<strong>EBS</strong> is network storage: persists independently, snapshots to S3, can reattach in the same AZ.",
        "Other region: <strong>copy-image</strong>. Other account, encrypted: share with a <strong>customer managed KMS key</strong>.",
        "Deregistering an AMI leaves its <strong>snapshots billing</strong> until you delete them."
      ],
      analogy: "Instance store is a whiteboard in a hotel room: fast to use, wiped when you check out. EBS is your own notebook: slower to grab, but it goes with you and you can photocopy it (snapshot).",
      examTip: "\"Data disappeared after stop/start\" = <strong>instance store</strong>. \"Deleted the AMI but still charged\" = <strong>orphaned snapshots</strong>. \"Share encrypted AMI\" = <strong>customer managed key</strong>, never the default aws/ebs key.",
      terms: [
        { t: "AMI", d: "Amazon Machine Image: snapshots plus launch settings used to start instances." },
        { t: "Instance store", d: "Temporary local disk on the host; free with the instance, not durable." },
        { t: "EBS volume", d: "Durable network block storage in one AZ; survives instance stop." },
        { t: "DeleteOnTermination", d: "Flag deciding if a volume is deleted with the instance; root defaults to true." },
        { t: "Fast Snapshot Restore", d: "Pre-warms a snapshot so restored volumes are fast on first read; costs extra." }
      ],
      check: [
        {
          q: "Cassandra needs millions of IOPS and replicates data across nodes itself. Which storage fits?",
          options: ["EBS gp3", "Instance store on an i-family instance", "Amazon EFS"],
          answer: 1,
          why: "Local NVMe <strong>instance store</strong> gives the highest IOPS, and Cassandra's own replication covers node loss. EBS is slower; EFS is shared file storage."
        },
        {
          q: "Your ASG in the DR region fails to launch using your golden AMI ID. Why?",
          options: ["AMIs are regional; copy it and use the new ID", "The AMI must be made public", "ASGs cannot use custom AMIs"],
          answer: 0,
          why: "AMIs live in one region. <strong>copy-image</strong> creates a new AMI with a new ID in the target region."
        }
      ]
    },
    "userdata-imds": {
      minutes: 5,
      tldr: [
        "<strong>User data</strong>: a script (max 16 KB) that runs <strong>once, as root, at first boot</strong> by default.",
        "User data is readable by anyone with EC2 read access — <strong>never put secrets in it</strong>.",
        "<strong>IMDS</strong> at <code>169.254.169.254</code> tells an instance about itself and hands out its <strong>role credentials</strong>.",
        "IMDSv1 answers a plain GET, so an SSRF bug can steal credentials. <strong>IMDSv2</strong> needs a PUT token first, blocking that.",
        "Enforce <code>HttpTokens=required</code>; containers may need hop limit 2."
      ],
      analogy: "IMDS is a key cabinet inside the instance that opens for anyone standing in the room. IMDSv1 opens on a simple knock, so a trick that makes your app knock for an attacker hands over the keys. IMDSv2 needs a code you first request in person, which those tricks can't do.",
      examTip: "\"Prevent SSRF from stealing instance credentials\" = <strong>require IMDSv2</strong>. \"User data didn't run after reboot\" = it runs <strong>only at first boot</strong> by design.",
      terms: [
        { t: "User data", d: "Boot script or cloud-init config passed to an instance at launch." },
        { t: "IMDS", d: "Instance Metadata Service at 169.254.169.254: identity, config and role credentials." },
        { t: "SSRF", d: "Server-side request forgery: tricking an app into fetching a URL for the attacker." },
        { t: "IMDSv2", d: "Session-token version of IMDS; token requires a PUT with a special header." },
        { t: "Hop limit", d: "How many network hops the IMDS token may travel; default 1." }
      ],
      check: [
        {
          q: "A web app that fetches user-supplied URLs could leak instance role credentials. Best preventive control?",
          options: ["Encrypt the EBS volume", "Require IMDSv2 on the instance", "Move secrets into user data"],
          answer: 1,
          why: "<strong>IMDSv2</strong> needs a PUT with a custom header that SSRF tricks cannot make. Encryption doesn't help; user data is not secret."
        },
        {
          q: "An engineer changed the user data script and rebooted, but the new script did not run. Why?",
          options: ["User data runs only once at first boot by default", "Reboots clear user data", "User data needs IMDSv1"],
          answer: 0,
          why: "cloud-init runs user data <strong>once, at first boot</strong>, unless configured to run every boot."
        }
      ]
    },
    "lifecycle-capacity": {
      minutes: 5,
      tldr: [
        "<strong>Stop</strong>: RAM lost, EBS kept, no instance charge, moves to a new host on start, public IP changes.",
        "<strong>Hibernate</strong>: RAM saved to an <strong>encrypted EBS root</strong>, fast resume, max 60 days. <strong>Terminate</strong>: gone.",
        "Reboot keeps the same host and data; stop/start does not (instance store is wiped).",
        "<strong>On-Demand Capacity Reservation</strong>: guaranteed capacity in one AZ, no term, no discount — pair with Savings Plans.",
        "<strong>Dedicated Host</strong> = whole server with socket/core visibility for BYOL licences. <strong>Dedicated Instance</strong> = no sharing, no visibility."
      ],
      analogy: "Stop is parking the car in a public car park: next time you may get a different space. Hibernate is parking with the engine state saved, so you drive off instantly. A capacity reservation is paying for a reserved parking space even when your car isn't in it.",
      examTip: "Keep three apart: <strong>zonal RI</strong> = discount + capacity; <strong>Savings Plan / regional RI</strong> = discount only; <strong>ODCR</strong> = capacity only. \"Guarantee capacity, already have Savings Plans\" = add an <strong>ODCR</strong>.",
      terms: [
        { t: "Hibernate", d: "Saves RAM to the encrypted EBS root so apps resume where they left off." },
        { t: "ODCR", d: "On-Demand Capacity Reservation: holds capacity in an AZ; billed whether used or not." },
        { t: "Capacity Blocks for ML", d: "Reserve GPU instances for a set future window of days or weeks." },
        { t: "Dedicated Host", d: "A whole physical server for you, with socket and core counts for licensing." },
        { t: "Termination protection", d: "Blocks API terminate, but not ASG scale-in or OS shutdown-to-terminate." }
      ],
      check: [
        {
          q: "A company must bring its per-core SQL Server licences to EC2 and prove physical core counts. Which option?",
          options: ["Dedicated Instances", "Dedicated Hosts", "Default tenancy with a Savings Plan"],
          answer: 1,
          why: "<strong>Dedicated Hosts</strong> expose sockets and cores and keep instances on the same host. Dedicated Instances give isolation but nothing countable."
        },
        {
          q: "DR needs guaranteed capacity in one AZ, and the company already has a Compute Savings Plan. What do you add?",
          options: ["A regional Reserved Instance", "An On-Demand Capacity Reservation", "Nothing, Savings Plans reserve capacity"],
          answer: 1,
          why: "Savings Plans are discounts only. An <strong>ODCR</strong> holds the capacity, and the Savings Plan discounts its cost."
        }
      ]
    }
  }
});
