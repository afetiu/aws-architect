/* Learning layer — Module 7: EBS, EFS, FSx & Storage Gateway */
window.COURSE.registerLearn({
  moduleId: "block-file",
  bigPicture: "Not all storage is S3. <strong>EBS</strong> is a hard drive for one EC2 instance, living in one AZ. <strong>EFS</strong> is a shared network folder many Linux machines can use at once. <strong>FSx</strong> is four ready-made specialist file servers (Windows, HPC, NetApp, ZFS). <strong>Storage Gateway</strong> connects your office or datacenter to all of this. The exam gives you a workload and asks which one fits — usually decided by one keyword.",
  cheatsheet: [
    { k: "General-purpose or boot volume, lowest cost", v: "<strong>gp3</strong> — 3,000 IOPS baseline at any size." },
    { k: "Very high IOPS, sub-millisecond, big Oracle / SAP HANA", v: "<strong>io2 Block Express</strong> — up to 256,000 IOPS." },
    { k: "Big sequential reads (logs, big data), cheap", v: "<strong>st1</strong> (throughput HDD). Coldest and cheapest: <strong>sc1</strong>." },
    { k: "gp2 slows down after ~30 min of heavy load", v: "Burst credits ran out — <strong>modify to gp3</strong>, live." },
    { k: "Fastest possible disk, data can be rebuilt", v: "<strong>Instance store</strong> — lost on stop or terminate." },
    { k: "Move an EBS volume to another AZ or Region", v: "<strong>Snapshot</strong> &rarr; (copy) &rarr; new volume there." },
    { k: "Encrypt an existing unencrypted volume", v: "Snapshot &rarr; <strong>copy with encryption</strong> &rarr; new volume &rarr; swap." },
    { k: "All new EBS volumes must be encrypted automatically", v: "<strong>EBS encryption by default</strong> (per Region)." },
    { k: "Restored volume must be fast from the first read", v: "<strong>Fast Snapshot Restore</strong> (pricey, per AZ-hour)." },
    { k: "Protect snapshots from accidental deletion", v: "<strong>Recycle Bin</strong> retention rule." },
    { k: "Central backups across EBS, RDS, EFS with immutability", v: "<strong>AWS Backup</strong> + Vault Lock." },
    { k: "Shared POSIX file system for many Linux instances, auto-grows", v: "<strong>EFS</strong> (NFS, multi-AZ)." },
    { k: "Cut EFS cost for rarely used files", v: "EFS <strong>lifecycle policy</strong> to IA / Archive." },
    { k: "Windows, SMB, Active Directory, NTFS", v: "<strong>FSx for Windows File Server</strong>." },
    { k: "HPC, ML training, process S3 data at huge throughput", v: "<strong>FSx for Lustre</strong> (linked to S3)." },
    { k: "NetApp, SnapMirror, iSCSI, NFS + SMB on the same data", v: "<strong>FSx for NetApp ONTAP</strong>." },
    { k: "On-prem apps save files over NFS/SMB into S3", v: "<strong>S3 File Gateway</strong>." },
    { k: "On-prem iSCSI, keep little data locally", v: "<strong>Volume Gateway, cached</strong> (all data local: <em>stored</em>)." },
    { k: "Existing backup software writes to tape; drop physical tapes", v: "<strong>Tape Gateway</strong> (tapes archive to Glacier)." },
    { k: "Move file data to AWS once, as fast as possible", v: "<strong>DataSync</strong>, not Storage Gateway." }
  ],
  lessons: {
    "ebs-volume-types": {
      minutes: 5,
      tldr: [
        "EBS is a <strong>network drive</strong> for one instance. It survives the instance being stopped or terminated (if you keep it).",
        "<strong>gp3</strong>: 3,000 IOPS and 125 MB/s at any size; buy more separately. The default choice.",
        "<strong>gp2</strong> (old): speed grows with size, small volumes run on burst credits that can run out.",
        "<strong>io2 Block Express</strong>: guaranteed very high IOPS, sub-ms latency, 99.999% durability. <strong>st1/sc1</strong>: cheap spinning disks for sequential data, not bootable.",
        "<strong>Instance store</strong> is a true local disk: fastest, but its data vanishes on stop."
      ],
      analogy: "gp2 is a phone plan where you only get more data by buying a bigger phone. gp3 lets you keep the small phone and just buy more data. io2 is a business line with a guaranteed speed contract.",
      examTip: "'Lowest cost general-purpose' &rarr; gp3. 'Highest IOPS, sub-millisecond' &rarr; io2 Block Express. 'Big sequential throughput, cheap' &rarr; st1. 'Slows after ~30 minutes of load' &rarr; gp2 burst credits exhausted, switch to gp3. Note: gp3 max was raised in 2025 (80,000 IOPS), older questions say 16,000.",
      terms: [
        { t: "IOPS", d: "Input/output operations per second — how many small reads/writes a disk handles. Matters for databases." },
        { t: "Throughput", d: "MB per second for large sequential transfers. Matters for logs, big data, video." },
        { t: "Burst credits", d: "gp2's saved-up allowance to run above baseline; when empty, speed drops sharply." },
        { t: "Provisioned IOPS (io1/io2)", d: "Volumes where you pay for a guaranteed IOPS number." },
        { t: "Instance store", d: "Disk physically attached to the host. Very fast; data lost on stop, terminate or host failure." }
      ],
      check: [
        {
          q: "A 200 GB database volume needs a steady 10,000 IOPS without paying for extra space. Cheapest choice?",
          options: ["gp2 enlarged to 3,400 GB", "gp3 with 10,000 provisioned IOPS", "io2 with 10,000 IOPS", "st1"],
          answer: 1,
          why: "gp3 sells IOPS separately from size, so a small volume can get 10,000 IOPS cheaply. gp2 works only by buying lots of unneeded space; io2 costs more for guarantees you didn't ask for."
        },
        {
          q: "Which volume can NOT be used as a boot volume?",
          options: ["gp3", "io2", "st1"],
          answer: 2,
          why: "st1 and sc1 are HDD throughput volumes and can't boot an instance. SSD types (gp2, gp3, io1, io2) can."
        }
      ]
    },

    "ebs-availability": {
      minutes: 5,
      tldr: [
        "An EBS volume lives in <strong>one AZ</strong>. It is copied inside that AZ, but if the AZ fails, the volume is unavailable.",
        "A volume can only attach to an instance in the <strong>same AZ</strong>.",
        "To move data to another AZ or Region: <strong>snapshot</strong>, (copy), create a new volume. Snapshots are regional.",
        "<strong>Elastic Volumes</strong>: grow size or change type/IOPS while in use. You can never shrink.",
        "After growing, you still extend the partition and file system inside the OS."
      ],
      analogy: "An EBS volume is a filing cabinet bolted to the floor of one building. The cabinet has a spare drawer set inside, but if the building burns, the cabinet goes with it. Snapshots are photocopies stored in a separate warehouse that any building can use.",
      examTip: "Any option that assumes an EBS volume survives an AZ outage, or attaches it to an instance in another AZ, is wrong. The fix is snapshots restored in another AZ, or a service that is multi-AZ by design (EFS, RDS Multi-AZ).",
      terms: [
        { t: "Availability Zone lock", d: "EBS volumes and the instances using them must be in the same AZ." },
        { t: "Snapshot", d: "Point-in-time backup of a volume, stored in S3 behind the scenes and usable anywhere in the Region." },
        { t: "Elastic Volumes", d: "Change size, type, IOPS or throughput of a live volume without detaching it." },
        { t: "Annual failure rate", d: "About 0.1-0.2% per year for most EBS types, 0.001% for io2." }
      ],
      check: [
        {
          q: "Your instance moves to us-east-1b. How do you bring its EBS data volume from us-east-1a?",
          options: ["Detach and attach it to the new instance", "Snapshot it, then create a new volume from the snapshot in us-east-1b", "Enable Multi-Attach"],
          answer: 1,
          why: "Volumes can't attach across AZs. Snapshots are regional, so you restore a copy in the target AZ. Multi-Attach also only works within one AZ."
        },
        {
          q: "A 500 GB volume only holds 50 GB of data. Can you shrink it to 100 GB with Elastic Volumes?",
          options: ["Yes, live", "No, volumes can only grow; copy data to a new smaller volume", "Yes, but only for gp3"],
          answer: 1,
          why: "Elastic Volumes can grow and change type but never shrink. Shrinking means creating a smaller volume and copying the files over."
        }
      ]
    },

    "ebs-snapshots": {
      minutes: 5,
      tldr: [
        "Snapshots are <strong>incremental</strong>: the first copies used blocks, later ones only changed blocks.",
        "Deleting any snapshot <strong>never breaks</strong> the others; each can still restore a full volume.",
        "Restored volumes load data <strong>lazily</strong> on first read, so they start slow. <strong>Fast Snapshot Restore</strong> fixes this, at a high hourly price.",
        "Copy snapshots to other Regions for DR; copying is also where you add or change encryption.",
        "Automate with <strong>DLM</strong> (EBS only) or <strong>AWS Backup</strong> (many services, Vault Lock); undo deletes with <strong>Recycle Bin</strong>."
      ],
      analogy: "Snapshots work like a photo album that only stores what changed in each new photo, while remembering where the unchanged parts are. Tearing out an old page never ruins the newer ones — the album keeps any bits the later pages still need.",
      examTip: "'Restored volumes must deliver full performance immediately' &rarr; Fast Snapshot Restore. 'Cheap long-term storage for rarely restored snapshots' &rarr; snapshot archive tier (24-72 h restore). 'Centralized, compliant backups' &rarr; AWS Backup.",
      terms: [
        { t: "Incremental snapshot", d: "Saves only blocks changed since the previous snapshot." },
        { t: "Lazy loading", d: "A restored volume fetches each block from S3 the first time it's read." },
        { t: "Fast Snapshot Restore (FSR)", d: "Makes volumes from a snapshot fully fast at creation; billed per snapshot per AZ per hour." },
        { t: "Data Lifecycle Manager", d: "Free scheduler that creates and deletes EBS snapshots and AMIs by tag." },
        { t: "Recycle Bin", d: "Keeps deleted snapshots/AMIs recoverable for a set period." },
        { t: "Snapshot archive tier", d: "~75% cheaper full-copy storage; 24-72 h to restore, 90-day minimum." }
      ],
      check: [
        {
          q: "You have daily snapshots 1 to 5 of a volume and delete snapshot 2. Can snapshot 4 still restore the full volume?",
          options: ["No, the chain is broken", "Yes, AWS keeps any blocks later snapshots still need", "Only if snapshot 1 is kept"],
          answer: 1,
          why: "EBS only removes blocks no other snapshot needs. Every remaining snapshot stays complete on its own."
        },
        {
          q: "A database restored from a snapshot is very slow for its first hours. What's happening?",
          options: ["The volume type was changed", "Blocks are loaded from S3 on first access", "KMS is throttling"],
          answer: 1,
          why: "Restores are lazy: each block comes from S3 the first time it's read. Pre-read all blocks or enable Fast Snapshot Restore."
        }
      ]
    },

    "ebs-encryption-multiattach": {
      minutes: 5,
      tldr: [
        "EBS encryption (KMS) covers data at rest, data moving to the instance, and all snapshots. No real speed cost.",
        "You <strong>can't encrypt an existing volume in place</strong>: snapshot &rarr; copy with encryption &rarr; new volume.",
        "<strong>Encryption by default</strong> is a per-Region account switch for all new volumes.",
        "To share an encrypted snapshot with another account, use a <strong>customer managed KMS key</strong>, not the default aws/ebs key.",
        "<strong>Multi-Attach</strong> (io1/io2 only): up to 16 instances in one AZ — needs a cluster-aware file system, or data gets corrupted."
      ],
      analogy: "Multi-Attach is like giving 16 people the same notebook with no rules about who writes when. Unless they agree a system (a cluster file system), they'll scribble over each other's pages.",
      examTip: "'Encrypt an existing volume' &rarr; snapshot, encrypted copy, restore — any 'enable encryption in place' option is wrong. 'Share encrypted snapshot cross-account' &rarr; re-encrypt with a customer managed key, share snapshot and grant key access. 'Many instances share files' &rarr; EFS, not Multi-Attach.",
      terms: [
        { t: "Encryption by default", d: "Regional setting that forces every new EBS volume and snapshot copy to be encrypted." },
        { t: "Customer managed key", d: "A KMS key you create and control; it can be shared with other accounts." },
        { t: "aws/ebs key", d: "The AWS managed default EBS key. Can't be shared across accounts." },
        { t: "Multi-Attach", d: "One io1/io2 volume attached to up to 16 Nitro instances in the same AZ." },
        { t: "Cluster file system", d: "File system like GFS2 that coordinates writes between machines sharing one disk." }
      ],
      check: [
        {
          q: "Compliance says every future EBS volume in the account must be encrypted, with no pipeline changes. What do you do?",
          options: ["Add an encrypt flag to every launch template", "Enable EBS encryption by default in each Region used", "Encrypt the AMIs only"],
          answer: 1,
          why: "Encryption by default applies automatically to all new volumes in that Region. Remember it is per Region and does nothing for existing volumes."
        },
        {
          q: "Two EC2 instances Multi-Attach one io2 volume formatted with ext4. What happens?",
          options: ["It works like a shared drive", "The file system gets corrupted", "AWS blocks the second attach"],
          answer: 1,
          why: "ext4 assumes it's the only writer, so two hosts overwrite each other's metadata. Use a cluster file system, or EFS for shared files."
        }
      ]
    },

    "efs": {
      minutes: 5,
      tldr: [
        "EFS is a <strong>managed NFS</strong> shared file system for Linux. Many instances, containers and Lambdas can mount it at once.",
        "It <strong>grows and shrinks automatically</strong>; you pay for what you store. Regional EFS spans multiple AZs.",
        "Mount through a <strong>mount target</strong> per AZ; its security group must allow <strong>TCP 2049</strong>.",
        "Use <strong>Elastic throughput</strong> (default). Old Bursting mode can stall small file systems.",
        "Save money with <strong>lifecycle to IA / Archive</strong>; <strong>access points</strong> lock each app to its own folder and user ID."
      ],
      analogy: "EFS is a shared office drive: everyone on the team sees the same folders at once, and it never runs out of space because it quietly grows. Access points are like giving each department a key that only opens its own folder.",
      examTip: "'Shared file storage for many Linux instances, grows automatically, multi-AZ' &rarr; EFS. EFS is <strong>NFS only</strong> — any Windows/SMB requirement rules it out (use FSx for Windows). Cost cut &rarr; lifecycle to IA.",
      terms: [
        { t: "NFS", d: "Network File System — the Linux file-sharing protocol EFS speaks, on port 2049." },
        { t: "Mount target", d: "A network interface in a subnet in each AZ that clients connect to." },
        { t: "Elastic throughput", d: "Speed scales automatically with demand; you pay per GB transferred." },
        { t: "EFS Infrequent Access", d: "Much cheaper storage class for files not opened recently; small fee to read." },
        { t: "EFS access point", d: "Entry point that forces a root folder and a POSIX user for an app. Used by Lambda and ECS." }
      ],
      check: [
        {
          q: "EC2 instances hang when mounting a new EFS file system. What's the most likely cause?",
          options: ["The file system is full", "The mount target's security group doesn't allow TCP 2049", "EFS needs an Elastic IP"],
          answer: 1,
          why: "NFS uses TCP 2049; if the mount target's security group blocks it, mounts hang. EFS never fills up because it grows automatically."
        },
        {
          q: "A Windows application needs a shared network drive. Is EFS a fit?",
          options: ["Yes, EFS supports SMB", "No, EFS is NFS for Linux; use FSx for Windows File Server", "Yes, with an access point"],
          answer: 1,
          why: "EFS speaks only NFS. Windows file sharing (SMB) with Active Directory is FSx for Windows File Server's job."
        }
      ]
    },

    "fsx-family": {
      minutes: 5,
      tldr: [
        "<strong>FSx for Windows File Server</strong>: SMB, NTFS permissions, <strong>Active Directory</strong>, Multi-AZ option.",
        "<strong>FSx for Lustre</strong>: HPC and ML speed (hundreds of GB/s), <strong>linked to S3</strong>. Scratch = temporary, Persistent = longer-lived.",
        "<strong>FSx for NetApp ONTAP</strong>: NFS + SMB + iSCSI from one system, SnapMirror, instant clones, dedupe.",
        "<strong>FSx for OpenZFS</strong>: fast Linux NFS with ZFS snapshots and clones.",
        "FSx bills <strong>provisioned</strong> capacity and throughput, unlike EFS's pay-per-use."
      ],
      analogy: "FSx is a rental shop for four famous brands of file server. You don't pick by features lists, you pick by the brand name the customer asks for: Windows, Lustre, NetApp or ZFS.",
      examTip: "Ten-second routing: <em>SMB / Active Directory</em> &rarr; Windows File Server. <em>HPC, ML training, S3 data at high speed</em> &rarr; Lustre. <em>NetApp, SnapMirror, iSCSI, NFS+SMB</em> &rarr; ONTAP. <em>ZFS</em> &rarr; OpenZFS. No keyword and Linux sharing &rarr; plain EFS.",
      terms: [
        { t: "SMB", d: "Windows file-sharing protocol. Only FSx for Windows and ONTAP offer it among AWS file services." },
        { t: "Active Directory", d: "Microsoft's user directory; FSx for Windows uses it for logins and permissions." },
        { t: "Lustre", d: "Parallel file system for supercomputing; stripes files across many servers." },
        { t: "Scratch vs Persistent", d: "Lustre deployment types: scratch is cheap and not replicated; persistent is replicated within one AZ." },
        { t: "SnapMirror", d: "NetApp replication, used to migrate or mirror on-prem NetApp data into ONTAP on AWS." }
      ],
      check: [
        {
          q: "An ML team trains on 200 TB in S3 and needs a file system that reads it at hundreds of GB/s for a two-week job. Best fit?",
          options: ["EFS with Elastic throughput", "FSx for Lustre linked to the S3 bucket", "FSx for Windows File Server", "EBS io2"],
          answer: 1,
          why: "Lustre links to S3, loads objects on demand as files, and delivers massive parallel throughput. EFS can't reach that speed; Windows FS is for SMB shares."
        },
        {
          q: "A company runs NetApp on-premises and wants to replicate volumes to AWS with SnapMirror. Which service?",
          options: ["FSx for NetApp ONTAP", "FSx for OpenZFS", "Storage Gateway Volume Gateway"],
          answer: 0,
          why: "SnapMirror is NetApp's own replication; only FSx for ONTAP runs real ONTAP and accepts it."
        }
      ]
    },

    "storage-gateway-decision": {
      minutes: 5,
      tldr: [
        "Storage Gateway is a VM in your datacenter that speaks <strong>NFS, SMB, iSCSI or tape</strong> locally and stores data in AWS, with a local cache.",
        "<strong>S3 File Gateway</strong>: files over NFS/SMB become S3 objects.",
        "<strong>Volume Gateway</strong>: iSCSI disks. <em>Cached</em> keeps most data in AWS; <em>stored</em> keeps everything local and backs up to AWS.",
        "<strong>Tape Gateway</strong>: virtual tapes for existing backup software, archived to Glacier.",
        "Master rule: <strong>block</strong> for one server's disk, <strong>file</strong> for sharing, <strong>object</strong> for whole files at huge scale."
      ],
      analogy: "Storage Gateway is a local branch of a bank: you walk into the familiar building and use the counter as always (NFS, SMB, tapes), but the money is actually kept in the central vault (AWS). The branch keeps a little cash on hand (the cache) for speed.",
      examTip: "Keywords: <em>files into S3</em> &rarr; S3 File Gateway; <em>iSCSI, minimize on-prem storage</em> &rarr; Volume Gateway cached; <em>iSCSI, all data on-prem with cloud backup</em> &rarr; stored; <em>backup software and tapes</em> &rarr; Tape Gateway. A <em>one-time</em> move &rarr; DataSync.",
      terms: [
        { t: "S3 File Gateway", d: "NFS/SMB share whose files are stored as S3 objects, one file per object." },
        { t: "Volume Gateway (cached)", d: "iSCSI volumes stored in AWS, with only hot data cached on-prem." },
        { t: "Volume Gateway (stored)", d: "iSCSI volumes kept fully on-prem, backed up to AWS as EBS snapshots." },
        { t: "Tape Gateway", d: "Virtual tape library for backup apps; old tapes go to Glacier or Deep Archive." },
        { t: "DataSync", d: "Service for fast one-time or scheduled bulk transfers into AWS storage." }
      ],
      check: [
        {
          q: "On-prem servers need iSCSI storage, the company wants to keep very little storage on-site, and data should live in AWS. Which option?",
          options: ["Volume Gateway stored volumes", "Volume Gateway cached volumes", "S3 File Gateway", "Tape Gateway"],
          answer: 1,
          why: "Cached volumes keep the full data in AWS and only a small hot cache locally. Stored volumes do the opposite: everything local, backups to AWS."
        },
        {
          q: "A backup team uses Veeam with physical tapes shipped off-site and wants to stop handling tapes without changing software. What fits?",
          options: ["S3 File Gateway", "Tape Gateway", "DataSync"],
          answer: 1,
          why: "Tape Gateway looks like a tape library to the backup software and stores tapes in S3 and Glacier. The backup process doesn't change."
        }
      ]
    }
  }
});
