/* Learning layer — Module 6: S3 Deep Dive */
window.COURSE.registerLearn({
  moduleId: "s3",
  bigPicture: "S3 is AWS's giant, cheap, near-indestructible storage for <strong>files as whole objects</strong>: you put a file in under a name (a key), you get the same file back. It is not a disk and not a folder tree — you can't edit part of a file or rename it in place. It is the most tested single service on SAA-C03: picking the cheapest storage class, locking data down, encrypting it, copying it to another Region, and sharing it safely.",
  cheatsheet: [
    { k: "Access pattern unknown or changing", v: "<strong>Intelligent-Tiering</strong> — auto-moves objects, no retrieval fees." },
    { k: "Rarely read, but must come back in milliseconds", v: "<strong>Glacier Instant Retrieval</strong> (or Standard-IA if read ~monthly)." },
    { k: "Archive for years, hours to restore is fine", v: "<strong>Glacier Deep Archive</strong> — cheapest, 12-48 h restores." },
    { k: "Easily re-created data, cheapest instant access", v: "<strong>One Zone-IA</strong> — one AZ, so only for copies you can rebuild." },
    { k: "Storage bill grows although objects were deleted", v: "Noncurrent versions or unfinished multipart uploads — add <strong>lifecycle rules</strong>." },
    { k: "Copy objects to another Region for DR", v: "<strong>CRR</strong> (versioning on both buckets); <strong>RTC</strong> if it must be within 15 min." },
    { k: "Replicate objects that already existed", v: "<strong>S3 Batch Replication</strong> — rules only copy new writes." },
    { k: "Audit every use of the encryption key / control rotation", v: "<strong>SSE-KMS with a customer managed key</strong>." },
    { k: "KMS throttling or high KMS cost on a busy bucket", v: "Enable <strong>S3 Bucket Keys</strong> — up to ~99% fewer KMS calls." },
    { k: "Data must be encrypted before it leaves our servers", v: "<strong>Client-side encryption</strong>." },
    { k: "Give an app user temporary upload/download without AWS credentials", v: "<strong>Presigned URL</strong> from the backend (max 7 days)." },
    { k: "Make sure no bucket in the company can ever be public", v: "<strong>Account-level Block Public Access</strong> + an SCP." },
    { k: "Many teams share one bucket, policy is a mess", v: "<strong>S3 Access Points</strong>, one per team." },
    { k: "Nobody, not even root, may delete for 7 years", v: "<strong>Object Lock, compliance mode</strong>." },
    { k: "Keep until a lawsuit ends (no end date)", v: "<strong>Object Lock legal hold</strong>." },
    { k: "Static website with HTTPS and a private bucket", v: "<strong>CloudFront + Origin Access Control</strong> in front of S3." },
    { k: "Faster large uploads from users far away", v: "<strong>Transfer Acceleration</strong> (+ multipart upload)." },
    { k: "503 Slow Down errors under heavy load", v: "Spread keys over more <strong>prefixes</strong>, retry with backoff." },
    { k: "Process every uploaded file reliably, with retries", v: "<strong>S3 event &rarr; SQS &rarr; Lambda</strong>; EventBridge for many consumers." },
    { k: "EC2 in a VPC reads lots of S3 data via a NAT gateway", v: "Add a <strong>gateway VPC endpoint</strong> — free, removes NAT charges." }
  ],
  lessons: {
    "object-model": {
      minutes: 4,
      tldr: [
        "S3 stores <strong>whole objects</strong> under a key. You can't edit part of one — any change uploads a full new object.",
        "There are no real folders or renames. 'Folders' are just key prefixes; a 'move' is copy plus delete.",
        "Bucket names are <strong>globally unique</strong>; a bucket lives in one Region. Objects go up to 50 TB (5 TB before late 2025).",
        "<strong>11 nines durability</strong>: data is copied across at least 3 AZs. Availability is a separate, lower promise (99.99%).",
        "Real data loss comes from deletes and overwrites, not hardware — hence versioning, replication and Object Lock."
      ],
      analogy: "S3 is a coat check with infinite hooks. You hand over a coat, you get a ticket (the key), and you get the exact same coat back. You can't sew a new button on while it hangs there — you'd have to take it back and hand in a new coat.",
      examTip: "If the scenario needs to <em>edit parts of a file</em>, rename directories atomically or use per-folder file permissions, S3 is the wrong answer (use EBS/EFS/FSx). 'Unlimited scale, very durable, pay per GB, static content or backups' &rarr; S3.",
      terms: [
        { t: "Object", d: "One file plus its metadata, stored whole and never changed in place." },
        { t: "Key", d: "The object's full name, e.g. logs/2026/07/app.gz. Slashes are just characters." },
        { t: "Prefix", d: "The start of a key, used like a folder path for listing and rules." },
        { t: "Durability", d: "Chance your data isn't lost. S3 Standard: 99.999999999% (11 nines)." },
        { t: "Multipart upload", d: "Uploading a big object in parts, in parallel. Required above 5 GB per single PUT." }
      ],
      check: [
        {
          q: "An app changes a few bytes in the middle of a 2 GB file hundreds of times per minute. Is S3 a good fit?",
          options: ["Yes, S3 supports in-place partial writes", "No, each change would rewrite the whole object; use EBS or EFS", "Yes, if versioning is enabled"],
          answer: 1,
          why: "S3 objects are immutable, so every edit is a full re-upload. Block or file storage (EBS/EFS) supports small in-place writes."
        },
        {
          q: "What does S3's 11 nines of durability protect you against?",
          options: ["An engineer deleting objects by mistake", "Losing data to disk or AZ hardware failures", "Ransomware overwriting objects"],
          answer: 1,
          why: "Durability means S3 won't lose the bytes it stores. It happily deletes or overwrites what you tell it to — that's what versioning and Object Lock are for."
        }
      ]
    },

    "consistency": {
      minutes: 4,
      tldr: [
        "Since 2020 S3 is <strong>strongly consistent</strong>: right after a write or delete, every read and list sees the change.",
        "No 'wait and retry until visible' tricks are needed any more.",
        "But there are <strong>no locks and no multi-object transactions</strong>. Two writers to the same key: the last one wins, silently.",
        "<strong>Conditional writes</strong> (<code>If-None-Match</code>, <code>If-Match</code>) let you say 'only write if nobody changed it'.",
        "Strong consistency is within a Region. Cross-Region replicas are always a bit behind."
      ],
      analogy: "S3 is like a shared whiteboard: the moment someone writes, everyone sees it. But if two people erase and rewrite the same box at once, the last marker wins and nobody gets a warning.",
      examTip: "'App reads an object immediately after writing it' &rarr; nothing special needed, S3 is strongly consistent. 'Several writers update the same object and changes get lost' &rarr; S3 has no locking; use conditional writes, one writer via a queue, or DynamoDB.",
      terms: [
        { t: "Strong read-after-write consistency", d: "Any read after a successful write returns the new data." },
        { t: "Last writer wins", d: "Concurrent writes to one key don't fail; the later one simply replaces the other." },
        { t: "Conditional write", d: "A PUT that only succeeds if the key is absent or unchanged; otherwise error 412." },
        { t: "Manifest object", d: "One small file written last that points to a set of data files, making a batch look atomic." }
      ],
      check: [
        {
          q: "A pipeline writes an object and a second service reads it one second later. What is required to guarantee it sees the new data?",
          options: ["Poll with retries until it appears", "Nothing, S3 is strongly consistent", "Track writes in a DynamoDB table"],
          answer: 1,
          why: "Since December 2020 every S3 read sees the latest successful write. The polling and DynamoDB workarounds belong to the old eventually consistent days."
        },
        {
          q: "Two deploy jobs read config.json, edit it, and write it back at the same time. One team's change disappears. Why?",
          options: ["S3 is eventually consistent", "S3 has no locking, so the last write replaced the other", "Versioning was turned off, which causes errors"],
          answer: 1,
          why: "Both writes succeed and the later one wins. Fix it with an If-Match conditional write, a single writer, or moving the record to DynamoDB."
        }
      ]
    },

    "storage-classes": {
      minutes: 4,
      tldr: [
        "Classes differ on three prices: <strong>storage per GB</strong>, <strong>fee to read</strong>, and a <strong>minimum days you pay for</strong>.",
        "Minimums: IA classes <strong>30 days</strong>, Glacier Instant and Flexible <strong>90</strong>, Deep Archive <strong>180</strong>.",
        "Glacier Flexible and Deep Archive need a <strong>restore</strong> first (minutes to 48 h). Glacier Instant reads in milliseconds.",
        "<strong>Intelligent-Tiering</strong> moves objects for you and never charges retrieval fees — best when access is unpredictable.",
        "Traps: small files (IA bills at least 128 KB each) and data read often (retrieval fees beat the savings)."
      ],
      analogy: "It's like where you keep things at home. The kitchen counter (Standard) is quick but pricey space; the attic (IA/Glacier) is cheap but you pay effort to fetch things; the off-site storage unit (Deep Archive) is cheapest but takes a day to get to, and has a minimum rental period.",
      examTip: "Map the words: <em>unpredictable</em> &rarr; Intelligent-Tiering; <em>rarely accessed but milliseconds</em> &rarr; Glacier Instant Retrieval; <em>retained for years, hours OK</em> &rarr; Deep Archive; <em>re-creatable</em> &rarr; One Zone-IA.",
      terms: [
        { t: "Standard-IA", d: "Infrequent Access: cheaper storage, per-GB read fee, 30-day minimum, 3+ AZs." },
        { t: "One Zone-IA", d: "Like Standard-IA but in one AZ only — lose the AZ, lose the data." },
        { t: "Glacier Instant Retrieval", d: "Archive pricing with millisecond reads; 90-day minimum, higher read fee." },
        { t: "Restore", d: "Request that makes a temporary readable copy of a Glacier Flexible or Deep Archive object." },
        { t: "Minimum storage duration", d: "Days you pay for even if you delete the object earlier." }
      ],
      check: [
        {
          q: "Medical images are rarely viewed, but when a doctor opens one it must load instantly. Cheapest fit?",
          options: ["Glacier Deep Archive", "Glacier Instant Retrieval", "S3 Standard", "Glacier Flexible Retrieval"],
          answer: 1,
          why: "Glacier Instant Retrieval gives archive prices with millisecond access. Deep Archive and Flexible need a restore that takes minutes to hours."
        },
        {
          q: "A team moves millions of 4 KB objects to Standard-IA to save money. What happens to the bill?",
          options: ["It drops by about half", "It goes up, because each object is billed as at least 128 KB", "No change"],
          answer: 1,
          why: "IA classes bill a minimum object size of 128 KB, so tiny objects cost far more than their real size. Keep small objects in Standard or bundle them."
        }
      ]
    },

    "lifecycle-versioning": {
      minutes: 5,
      tldr: [
        "<strong>Versioning</strong> keeps every old version. Once on, it can only be suspended, never fully turned off.",
        "A normal delete on a versioned bucket only adds a <strong>delete marker</strong>; old versions stay (and keep costing).",
        "<strong>Lifecycle rules</strong> move objects to cheaper classes and delete them on a schedule, once a day.",
        "Every versioned bucket needs <strong>noncurrent version expiration</strong>; every bucket needs <strong>abort incomplete multipart upload</strong>.",
        "Objects must sit 30 days in Standard before a lifecycle rule can move them to IA."
      ],
      analogy: "Versioning is a document with full edit history: 'deleting' just adds a page saying 'deleted', the old pages are still in the binder. Lifecycle rules are the office cleaner who, on a schedule, moves old binders to the basement and shreds the ones past their date.",
      examTip: "'Storage costs keep growing though we delete objects' &rarr; noncurrent versions or incomplete multipart uploads; add the matching lifecycle rule. 'Recover an accidentally deleted object' &rarr; versioning (remove the delete marker).",
      terms: [
        { t: "Versioning", d: "Keeps every version of an object, each with its own version ID." },
        { t: "Delete marker", d: "An empty placeholder that hides an object; delete the marker to undelete." },
        { t: "Noncurrent version", d: "An older version that has been replaced by a newer one. Still billed." },
        { t: "Lifecycle rule", d: "Automatic transition or expiration of objects after N days, filtered by prefix, tag or size." },
        { t: "MFA Delete", d: "Requires an MFA code to permanently delete versions or change versioning. Root only, via CLI." }
      ],
      check: [
        {
          q: "A user deletes a file in a versioned bucket by mistake. How do you get it back?",
          options: ["It's gone for good", "Delete the delete marker so the previous version becomes current", "Suspend versioning"],
          answer: 1,
          why: "The delete only added a marker on top. Removing the marker brings back the last version. Suspending versioning doesn't restore anything."
        },
        {
          q: "Which lifecycle action is NOT allowed?",
          options: ["Standard to Standard-IA after 30 days", "Standard to Standard-IA after 7 days", "Standard to Glacier Deep Archive after 1 day"],
          answer: 1,
          why: "Lifecycle can't move objects to Standard-IA or One Zone-IA before 30 days. Transitions straight to Glacier classes have no such floor."
        }
      ]
    },

    "replication": {
      minutes: 4,
      tldr: [
        "Replication copies new objects <strong>asynchronously</strong> to another bucket: <strong>CRR</strong> (other Region) or <strong>SRR</strong> (same Region).",
        "<strong>Versioning must be on in both buckets</strong>, and S3 uses an IAM role to do the copy.",
        "Only <strong>new</strong> writes replicate. Existing objects need <strong>S3 Batch Replication</strong>.",
        "Deletes of specific versions never replicate; delete markers only if you opt in. Replicas don't chain A&rarr;B&rarr;C.",
        "<strong>Replication Time Control (RTC)</strong>: 99.99% of objects within 15 minutes, with metrics."
      ],
      analogy: "Replication is a mail-forwarding service: from the day you sign up, every new letter is also sent to your second address. Letters you received before signing up are not forwarded unless you ask for a one-off batch.",
      examTip: "'Existing objects must also be copied' &rarr; Batch Replication. 'Must arrive within 15 minutes' &rarr; RTC. 'Protect the copy if the main account is compromised' &rarr; cross-account replication with owner override (plus Object Lock).",
      terms: [
        { t: "CRR", d: "Cross-Region Replication — for disaster recovery, compliance, or lower latency elsewhere." },
        { t: "SRR", d: "Same-Region Replication — e.g. collect logs into one bucket or copy prod data to another account." },
        { t: "Batch Replication", d: "One-off job that replicates existing objects or retries failed ones." },
        { t: "RTC", d: "Replication Time Control: SLA of 15 minutes for 99.99% of objects, extra cost." },
        { t: "Owner override", d: "Makes the destination account own the replicas, so the source can't delete them." }
      ],
      check: [
        {
          q: "You enable CRR on a bucket holding 10 TB of existing data. What happens to those 10 TB?",
          options: ["Copied automatically within 15 minutes", "Not copied until you run S3 Batch Replication", "Copied only if RTC is on"],
          answer: 1,
          why: "Replication rules only apply to objects written after the rule exists. Batch Replication handles the backlog. RTC only speeds up new writes."
        },
        {
          q: "Someone permanently deletes a specific object version in the source bucket. What happens in the replica?",
          options: ["The version is deleted there too", "The replica keeps it", "Replication stops"],
          answer: 1,
          why: "Deletes of specific version IDs are never replicated, on purpose, so a bad or malicious delete can't wipe out the copy."
        }
      ]
    },

    "encryption": {
      minutes: 5,
      tldr: [
        "All new objects are encrypted with <strong>SSE-S3</strong> by default. The real question is who controls the keys.",
        "<strong>SSE-KMS</strong>: keys in KMS, every use logged in CloudTrail, readers need <code>kms:Decrypt</code> too.",
        "Each SSE-KMS read/write calls KMS, which can hit KMS limits. <strong>Bucket Keys</strong> cut those calls by ~99%.",
        "<strong>SSE-C</strong>: you send your own key with every request (now off by default on new buckets). <strong>Client-side</strong>: you encrypt before upload.",
        "Changing default encryption doesn't touch existing objects — you must re-copy them."
      ],
      analogy: "SSE-S3 is a hotel safe where the hotel keeps the master key. SSE-KMS is a safe whose key is kept at a bank that writes down every time it's used. SSE-C is bringing your own padlock each visit. Client-side is locking the box at home before you even leave.",
      examTip: "'Audit key usage' or 'control and rotate our own keys' &rarr; SSE-KMS with a customer managed key. 'KMS throttling / high KMS cost' &rarr; S3 Bucket Keys. 'Two layers of encryption' &rarr; DSSE-KMS. 'Encrypt before sending to AWS' &rarr; client-side.",
      terms: [
        { t: "SSE-S3", d: "Server-side encryption with keys fully managed by S3. Free, the default." },
        { t: "SSE-KMS", d: "Server-side encryption with a KMS key; auditable, and the key policy is a second lock." },
        { t: "S3 Bucket Key", d: "Bucket-level data key that avoids calling KMS for every object." },
        { t: "SSE-C", d: "S3 encrypts with a key you supply on each request; S3 never stores it." },
        { t: "DSSE-KMS", d: "Dual-layer server-side encryption with KMS, for strict compliance rules." }
      ],
      check: [
        {
          q: "A partner account has s3:GetObject on your SSE-KMS bucket but still gets Access Denied. Most likely cause?",
          options: ["Block Public Access", "It lacks kms:Decrypt on the KMS key", "Bucket Keys are enabled", "The objects use SSE-S3"],
          answer: 1,
          why: "SSE-KMS needs two permissions: the S3 action and kms:Decrypt on the key. Cross-account 403s are very often the missing KMS half."
        },
        {
          q: "You switch a bucket's default encryption from SSE-S3 to SSE-KMS. What happens to the objects already in it?",
          options: ["They're re-encrypted automatically", "They stay as they were until you copy them", "They become unreadable"],
          answer: 1,
          why: "Encryption is stamped on each object at write time. To re-encrypt old objects you copy them over themselves, e.g. with S3 Batch Operations."
        }
      ]
    },

    "access-control": {
      minutes: 5,
      tldr: [
        "Access is allowed only if <strong>no explicit Deny</strong> exists and <strong>some policy Allows</strong> it. Cross-account needs both sides to allow.",
        "<strong>Bucket policies</strong> can enforce rules on everyone: require HTTPS, a VPC endpoint, or encryption.",
        "<strong>ACLs are disabled by default</strong> (Bucket owner enforced); <strong>Block Public Access</strong> is on by default.",
        "<strong>Access points</strong> give each team its own endpoint and policy onto one shared bucket.",
        "<strong>Presigned URLs</strong> grant temporary access as the signer; max 7 days, less if signed with a role."
      ],
      analogy: "A presigned URL is like a signed permission slip: whoever holds it can do exactly one thing (download this file) until the date on the slip — and only as long as the person who signed it still has that right themselves.",
      examTip: "'Temporary access for a user without AWS credentials' &rarr; presigned URL. Watch the trap: presigned URLs max out at <strong>7 days</strong>, so '30 days' points to regenerating or CloudFront signed URLs. 'Enforce HTTPS' &rarr; bucket policy denying <code>aws:SecureTransport = false</code>.",
      terms: [
        { t: "Bucket policy", d: "JSON resource policy on the bucket; the only way to allow public or other-account access." },
        { t: "Block Public Access", d: "Account and bucket switches that override any policy trying to make data public." },
        { t: "Object Ownership", d: "Bucket owner enforced = ACLs off, bucket owner owns every object. Default since 2023." },
        { t: "Access point", d: "Named endpoint to a bucket with its own policy, optionally limited to one VPC." },
        { t: "Presigned URL", d: "A URL carrying a signature that lets anyone perform one S3 action for a limited time." }
      ],
      check: [
        {
          q: "A Lambda function generates presigned URLs with a 7-day expiry, but they stop working after a few hours. Why?",
          options: ["S3 caps presigned URLs at 1 hour", "The URL can't outlive the Lambda role's temporary credentials", "Block Public Access expires them"],
          answer: 1,
          why: "A presigned URL acts as the signer; when the role session behind it expires, so does the URL. Only long-lived IAM user keys reach the full 7 days."
        },
        {
          q: "Forty teams need different permissions on one data-lake bucket, and the bucket policy is near its size limit. Best fix?",
          options: ["One IAM user per team", "S3 Access Points with a policy per team", "Enable ACLs"],
          answer: 1,
          why: "Access points split one huge bucket policy into small per-team policies. ACLs are legacy and disabled by default."
        }
      ]
    },

    "performance-events": {
      minutes: 5,
      tldr: [
        "Each <strong>prefix</strong> handles at least <strong>3,500 writes and 5,500 reads per second</strong>; more prefixes = more throughput.",
        "Sudden spikes can return <strong>503 Slow Down</strong> while S3 scales; retry with backoff and spread keys.",
        "<strong>Multipart upload</strong>: parallel parts, retry one part at a time. Recommended above 100 MB, required above 5 GB.",
        "<strong>Transfer Acceleration</strong> speeds long-distance uploads through CloudFront edge locations.",
        "Events go to SQS, SNS, Lambda or <strong>EventBridge</strong>; delivery is at-least-once and unordered."
      ],
      analogy: "Prefixes are like checkout lanes: each lane serves a fixed number of shoppers per minute, so opening more lanes (more prefixes) lets more people through. Multipart upload is moving house with ten vans at once instead of one truck.",
      examTip: "'Global users upload large files slowly' &rarr; Transfer Acceleration (for downloads, CloudFront). 'Large uploads fail on bad networks' &rarr; multipart upload. 'Many apps react to the same uploads with filtering' &rarr; EventBridge.",
      terms: [
        { t: "Request rate per prefix", d: "3,500 PUT/COPY/POST/DELETE and 5,500 GET/HEAD per second, per prefix." },
        { t: "Byte-range GET", d: "Download only part of an object; many in parallel speed up big downloads." },
        { t: "Transfer Acceleration", d: "Upload to the nearest edge location, then ride AWS's network to the bucket." },
        { t: "Event notification", d: "Message S3 sends when objects are created, deleted, restored, etc." },
        { t: "503 SlowDown", d: "S3 asking you to back off while it adds capacity for a hot key range." }
      ],
      check: [
        {
          q: "An app needs 20,000 GET requests per second on one bucket. What design helps most?",
          options: ["Use one prefix and bigger EC2 instances", "Spread objects across several prefixes", "Enable Transfer Acceleration"],
          answer: 1,
          why: "Read limits apply per prefix, so four or more prefixes give 22,000+ reads per second. Acceleration helps distant uploads, not request rate."
        },
        {
          q: "Each uploaded image must be processed once, with retries and a dead-letter queue for failures. Best trigger chain?",
          options: ["S3 event directly to Lambda", "S3 event to SQS, then Lambda", "Poll the bucket every minute with cron"],
          answer: 1,
          why: "SQS in the middle buffers bursts, retries, and holds failures in a DLQ. Direct S3-to-Lambda has no buffer for a sudden flood of uploads."
        }
      ]
    },

    "protection-hosting-cost": {
      minutes: 5,
      tldr: [
        "<strong>Object Lock</strong> = write once, read many. <strong>Compliance mode</strong>: nobody can delete, not even root. <strong>Governance mode</strong>: special admins can.",
        "<strong>Legal hold</strong> blocks deletion with no end date until someone removes it.",
        "Static sites: <strong>CloudFront + Origin Access Control</strong> over a private bucket, not the public HTTP-only website endpoint.",
        "<strong>Requester Pays</strong> makes the downloader pay transfer and requests; <strong>Storage Lens</strong> shows usage across all accounts.",
        "Hidden costs: NAT gateway traffic to S3 (use a free gateway endpoint), old versions, unfinished multipart uploads."
      ],
      analogy: "Compliance-mode Object Lock is a time-locked bank vault: once the timer is set, not even the bank manager can open it early. Governance mode is a vault the head of security can override with a special key.",
      examTip: "'Cannot be deleted by anyone, including administrators, for N years' &rarr; Object Lock <strong>compliance</strong> mode. 'Only authorized admins may remove protection' &rarr; <strong>governance</strong>. 'Secure static website with HTTPS' &rarr; CloudFront + OAC, bucket stays private.",
      terms: [
        { t: "Object Lock", d: "WORM protection per object version for a retention period. Needs versioning." },
        { t: "Compliance mode", d: "Retention nobody can shorten or remove, including the root user." },
        { t: "Legal hold", d: "An on/off lock with no expiry date, used for litigation." },
        { t: "Origin Access Control (OAC)", d: "Lets only your CloudFront distribution read a private bucket. Replaces the older OAI." },
        { t: "Requester Pays", d: "Bucket setting where the caller pays request and download costs." },
        { t: "S3 Storage Lens", d: "Organization-wide dashboard of storage usage, activity and cost-saving tips." }
      ],
      check: [
        {
          q: "A regulator requires trade records to be undeletable by anyone, including the root user, for 7 years. What do you use?",
          options: ["MFA Delete", "Object Lock in governance mode", "Object Lock in compliance mode", "A bucket policy that denies DeleteObject"],
          answer: 2,
          why: "Only compliance mode stops everyone, root included. Governance can be bypassed with a permission, and an admin can simply edit a bucket policy."
        },
        {
          q: "You want an S3-hosted website with HTTPS on your own domain and no public bucket. What do you build?",
          options: ["S3 static website endpoint with a public bucket policy", "CloudFront with Origin Access Control in front of the private bucket", "An ALB in front of S3"],
          answer: 1,
          why: "The S3 website endpoint is HTTP-only and needs a public bucket. CloudFront adds HTTPS and caching, and OAC keeps the bucket private."
        }
      ]
    }
  }
});
