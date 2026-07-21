/* Interactive diagrams: compute & storage modules (elb-asg, s3, containers). */

window.COURSE.registerDiagram({
  id: "elb-asg-path",
  moduleId: "elb-asg",
  title: "From user to instance: ALB + Auto Scaling",
  sub: "The full request path plus the two control loops around it: target tracking scale-out and AZ-failure recovery.",
  w: 780, h: 450,
  nodes: [
    { id: "vpc", x: 180, y: 20, w: 580, h: 350, zone: true, label: "VPC 10.0.0.0/16" },
    { id: "asg", x: 380, y: 55, w: 360, h: 300, zone: true, label: "Auto Scaling group" },
    { id: "aza", x: 400, y: 95, w: 320, h: 110, zone: true, label: "AZ us-east-1a" },
    { id: "azb", x: 400, y: 230, w: 320, h: 110, zone: true, label: "AZ us-east-1b" },
    { id: "user", x: 20, y: 40, w: 130, h: 44, color: "blue", label: "User", sub: "browser / client",
      info: "Clients cache DNS answers, so Route 53 TTLs bound how fast you can shift traffic. Design assuming some clients will keep hitting stale IPs for minutes after any DNS-level failover." },
    { id: "r53", x: 20, y: 140, w: 130, h: 44, color: "orange", label: "Route 53", sub: "alias to ALB",
      info: "An alias record maps the zone apex directly to the ALB's DNS name — something a plain CNAME cannot do — and alias queries to AWS resources are free. The ALB's own DNS answer already rotates across its per-AZ nodes, so Route 53 is doing coarse routing, not load balancing." },
    { id: "alb", x: 210, y: 75, w: 140, h: 46, color: "orange", label: "ALB", sub: "multi-AZ, SG gate",
      info: "One ALB node per enabled AZ, each with its own ENI and IP; the fleet scales with load (pre-warm via support for known spikes). It terminates TLS, evaluates listener rules, then opens a NEW connection to the target — its security group is the first policy gate. Billed per hour plus LCUs (new conns, active conns, bytes, rule evals)." },
    { id: "tg", x: 210, y: 180, w: 140, h: 46, color: "green", label: "Target group", sub: "health checks",
      info: "The registry of targets plus the health-check contract: path, interval, healthy/unhealthy thresholds. Only <strong>healthy</strong> targets receive traffic; if ALL targets go unhealthy the ALB fails open and sends to every target — an exam favorite. Deregistration delay (default 300s) drains in-flight requests before a target is removed." },
    { id: "ec2a", x: 430, y: 138, w: 140, h: 44, color: "green", label: "EC2 instance", sub: "AZ-a, InService",
      info: "Its security group allows the app port FROM the ALB's security group, not from a CIDR — the rule survives scaling and IP churn. The client IP only exists in X-Forwarded-For because the ALB opened a fresh connection." },
    { id: "ec2b", x: 430, y: 273, w: 140, h: 44, color: "green", label: "EC2 instance", sub: "AZ-b, InService",
      info: "Identical, disposable capacity in a second AZ. The ASG treats ELB health as instance health when health-check type is ELB — failing the target group check gets the instance terminated and replaced, not just deregistered." },
    { id: "cw", x: 210, y: 390, w: 160, h: 46, color: "yellow", label: "CloudWatch alarm", sub: "target tracking",
      info: "Target tracking creates and manages the alarms for you: you declare 'keep average CPU at 50%' and it computes capacity like a thermostat. Scale-out is aggressive, scale-in is deliberately conservative — flapping costs more in churn than a few idle instances." },
    { id: "lt", x: 560, y: 390, w: 160, h: 46, color: "green", label: "Launch template", sub: "AMI, SG, user data",
      info: "The versioned recipe for every instance the ASG launches: AMI, instance type(s), SG, user data, IAM instance profile. Launch templates (not legacy launch configurations) unlock mixed instances policies and Spot/On-Demand blends — bake AMIs so boot time, not yum installs, dominates warmup." }
  ],
  edges: [
    { from: "user", to: "r53", label: "DNS query" },
    { from: "r53", to: "alb", label: "alias answer" },
    { from: "alb", to: "tg", label: "listener rule" },
    { from: "tg", to: "ec2a" },
    { from: "tg", to: "ec2b" },
    { from: "cw", to: "lt", label: "scaling policy" },
    { from: "lt", to: "ec2b", label: "launch", dashed: true }
  ],
  flows: [
    { title: "A request reaches an instance", steps: [
      { lit: ["user", "user->r53", "r53"], text: "The client resolves your apex domain. The Route 53 <strong>alias</strong> record returns the ALB's current IPs (one per enabled AZ) — free queries, and it tracks the ALB as its addresses change." },
      { lit: ["r53->alb", "alb"], text: "HTTPS lands on an ALB node. First gate: the ALB's security group must allow 443 from the world. The ALB terminates TLS and evaluates listener rules (host, path, header) to pick a target group." },
      { lit: ["alb->tg", "tg"], text: "The target group filters to <strong>healthy</strong> targets only — those passing 2 consecutive health checks on the configured path. The ALB round-robins (or least-outstanding-requests) across them." },
      { lit: ["tg->ec2a", "ec2a"], text: "Second gate: the instance SG allows the app port FROM the ALB's SG. The ALB opens a brand-new connection, so the app sees the ALB's IP; the real client lives in X-Forwarded-For." }
    ]},
    { title: "Scale-out: metric breach to InService", steps: [
      { lit: ["cw"], text: "Load rises and average CPU crosses the 50% target. Target tracking's CloudWatch alarm breaches after its evaluation periods — this lag (metric period x datapoints) is your minimum reaction time." },
      { lit: ["cw->lt", "lt"], text: "The policy computes the new desired capacity proportionally (thermostat, not step function) and the ASG launches from the <strong>launch template</strong>: same AMI, SG, user data, instance profile every time." },
      { lit: ["lt->ec2b", "ec2b", "azb"], text: "The ASG launches into the least-populated AZ to stay balanced. During <strong>instance warmup</strong> the new instance's metrics are excluded from the aggregate so a booting box doesn't trigger another scale-out." },
      { lit: ["tg", "tg->ec2b"], text: "The instance registers with the target group, passes its health checks, and flips to <strong>InService</strong>. Only now does it take traffic — total time from breach to serving is why you also keep headroom." }
    ]},
    { title: "An AZ fails", steps: [
      { lit: ["aza", "ec2a"], text: "AZ-a degrades: instances stop answering health checks. Nothing needs to detect 'the AZ is down' as a concept — every layer just sees its own checks failing." },
      { lit: ["tg", "tg->ec2a"], text: "The target group marks AZ-a targets unhealthy after the unhealthy threshold and stops routing to them. Route 53 alias health checks also drop the ALB's AZ-a IPs from DNS answers." },
      { lit: ["alb", "tg->ec2b", "ec2b"], text: "With <strong>cross-zone load balancing</strong> (on by default for ALB, free at L7) surviving requests spread across AZ-b targets, so AZ-b briefly absorbs double load — size for N-1, not N." },
      { lit: ["asg", "lt->ec2b", "azb"], text: "The ASG terminates the failed instances and launches replacements in healthy AZs, then <strong>rebalances</strong> across zones when AZ-a recovers. Recovery is a control loop, not a runbook." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "s3-lifecycle",
  moduleId: "s3",
  title: "An object's life in S3",
  sub: "Upload, tier down, delete, replicate. Every hop has a minimum-duration or retrieval-fee string attached — click the nodes.",
  w: 780, h: 440,
  nodes: [
    { id: "rega", x: 190, y: 20, w: 360, h: 400, zone: true, label: "Bucket, us-east-1" },
    { id: "regb", x: 590, y: 20, w: 170, h: 400, zone: true, label: "us-west-2" },
    { id: "up", x: 20, y: 60, w: 130, h: 46, color: "blue", label: "Client", sub: "multipart PUT",
      info: "Above ~100 MB use multipart upload: parallel parts (5 MB-5 GB each, 10,000 max) give throughput and retry granularity up to the 5 TB object cap. Failed uploads leave invisible, billed part fragments — every serious bucket needs an AbortIncompleteMultipartUpload lifecycle rule." },
    { id: "std", x: 220, y: 70, w: 140, h: 46, color: "green", label: "S3 Standard", sub: "ms access, no mins",
      info: "Eleven nines of durability via redundancy across 3+ AZs; availability is the weaker 99.99% SLA number. Since Dec 2020 all operations are <strong>strongly consistent</strong> — read-after-write, list-after-write, no eventual-consistency caveats. Throughput scales per prefix: 3,500 writes / 5,500 reads per second, per prefix." },
    { id: "it", x: 220, y: 165, w: 140, h: 46, color: "green", label: "Int-Tiering / IA", sub: "30d min, fee on IA",
      info: "Standard-IA: ~45% cheaper storage but a per-GB <strong>retrieval fee</strong>, 30-day minimum duration, and a 128 KB minimum billable size — small hot objects can cost MORE here. Intelligent-Tiering moves objects between access tiers automatically for a small monthly monitoring fee and charges no retrieval fee: the default answer for unknown access patterns." },
    { id: "ver", x: 385, y: 165, w: 140, h: 46, color: "yellow", label: "Delete marker", sub: "versioning on",
      info: "With versioning enabled, a plain DELETE writes a zero-byte <strong>delete marker</strong> on top of the stack — no data is destroyed and every hidden version still bills. Restore is just deleting the marker. Permanent deletion requires specifying a version ID; guard that with MFA delete or a deny policy." },
    { id: "gl", x: 220, y: 260, w: 140, h: 46, color: "blue", label: "Glacier tiers", sub: "90/180d min, restore",
      info: "Three archives: Instant Retrieval (ms access, 90-day min), Flexible (minutes-to-hours restore, 90-day min), Deep Archive (up to 12h+, 180-day min, cheapest storage on AWS). All charge retrieval fees, and deleting before the minimum duration bills the remainder anyway — the early-delete charge." },
    { id: "lc", x: 385, y: 260, w: 140, h: 46, color: "orange", label: "Lifecycle rules", sub: "async, daily eval",
      info: "Declarative rules per bucket/prefix/tag: transition after N days, expire, clean up old versions and incomplete multiparts. Evaluation is an <strong>asynchronous daily batch</strong> — transitions are not instant — and each transition bills as a request, which matters at millions of small objects (consider aggregating first)." },
    { id: "rep", x: 610, y: 70, w: 130, h: 46, color: "green", label: "Replica bucket", sub: "CRR, versioned",
      info: "Cross-Region Replication requires versioning on BOTH buckets and copies asynchronously (S3 RTC offers a 15-minute SLA for a fee). It replicates <strong>new</strong> objects only — pre-existing data needs Batch Replication — and you pay inter-region transfer per GB. Replicas can land in a different storage class and a different account for ransomware isolation." }
  ],
  edges: [
    { from: "up", to: "std", label: "PUT" },
    { from: "std", to: "it", label: "after 30d" },
    { from: "it", to: "gl", label: "after 90d" },
    { from: "lc", to: "it", label: "applies rules", dashed: true },
    { from: "std", to: "ver", label: "DELETE", dashed: true },
    { from: "std", to: "rep", label: "CRR", dashed: true }
  ],
  flows: [
    { title: "Upload + strong consistency", steps: [
      { lit: ["up"], text: "A 2 GB object goes up as parallel multipart chunks — each part retries independently, so one flaky connection doesn't restart the transfer. The object doesn't exist until CompleteMultipartUpload commits it." },
      { lit: ["up->std", "std"], text: "S3 assembles the parts into one object in Standard. Note the ETag of a multipart object is <strong>not</strong> an MD5 of the content — integrity checks should use the newer checksum options, not ETag comparison." },
      { lit: ["std"], text: "The very next GET or LIST sees the new object: S3 is strongly consistent for all operations. What used to be a classic gotcha (eventual consistency on overwrite) is now history — but old exam dumps still get this wrong." }
    ]},
    { title: "Tiering down: the fine print at each hop", steps: [
      { lit: ["lc"], text: "The lifecycle engine runs as a daily async batch, and each transition is a billed request. For millions of tiny objects the transition requests can exceed the storage savings — do the math before enabling." },
      { lit: ["std->it", "it"], text: "Day 30: down to IA. Cheaper per-GB, but now every read pays a <strong>retrieval fee</strong>, and the 30-day minimum means early deletion still bills the full month. Unknown access pattern? Intelligent-Tiering instead — no retrieval fee, small monitoring charge." },
      { lit: ["it->gl", "gl"], text: "Day 90: into Glacier. Pick the tier by restore tolerance: Instant (ms), Flexible (minutes-hours), Deep Archive (12h+, 180-day minimum). Data is now cheap to hold and expensive-plus-slow to touch." },
      { lit: ["gl"], text: "The exam trap: delete a Deep Archive object at day 200 (stored since day 90) and you're billed for the remaining ~70 days of the 180-day minimum. Lifecycle policies must respect minimum durations or you pay twice." }
    ]},
    { title: "Delete, restore, and what replicates", steps: [
      { lit: ["std->ver", "ver"], text: "A plain DELETE in this versioned bucket destroys nothing — it stacks a <strong>delete marker</strong>. The object vanishes from normal GETs and LISTs, but every prior version remains, and remains billed." },
      { lit: ["ver"], text: "Restore = delete the delete marker by its version ID; the previous version instantly becomes current again. True deletion requires a version-ID DELETE — which is exactly the operation you lock down with MFA delete or an explicit deny." },
      { lit: ["std->rep", "rep"], text: "CRR mirrors new object versions to us-west-2 and can optionally replicate delete markers — but <strong>version-ID deletes never replicate</strong>. An attacker (or fat finger) purging the source cannot purge the replica: that asymmetry is the ransomware defense." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "ecs-fargate",
  moduleId: "containers",
  title: "ECS on Fargate: service anatomy",
  sub: "No hosts to manage — but the control loop, networking, and deployment mechanics are all still yours to understand.",
  w: 800, h: 400,
  nodes: [
    { id: "vpc", x: 190, y: 20, w: 400, h: 350, zone: true, label: "VPC" },
    { id: "aza", x: 210, y: 60, w: 170, h: 140, zone: true, label: "AZ a" },
    { id: "azb", x: 400, y: 60, w: 170, h: 140, zone: true, label: "AZ b" },
    { id: "ecr", x: 20, y: 40, w: 130, h: 46, color: "blue", label: "ECR", sub: "scan on push",
      info: "Private OCI registry with IAM auth and scan-on-push CVE reports. Tags are mutable — 'latest' can silently change under you — so production task definitions should pin the <strong>image digest</strong>. Pull-through cache proxies Docker Hub and dodges its rate limits." },
    { id: "td", x: 20, y: 130, w: 130, h: 46, color: "green", label: "Task definition", sub: "revision, immutable",
      info: "The immutable pod-spec of ECS: containers, image, CPU/memory (Fargate bills exactly these, per second), IAM <strong>task role</strong> vs execution role, log config, port mappings. Every change creates a new numbered revision — deployments are 'move the service to revision N+1', and rollback is just pointing back." },
    { id: "svc", x: 20, y: 220, w: 130, h: 46, color: "orange", label: "ECS service", sub: "scheduler, desired=2",
      info: "A reconciliation loop: compare desired count to running tasks and fix the difference, forever. It spreads tasks across AZs, wires them into the target group, and runs deployments. The <strong>deployment circuit breaker</strong> auto-rolls-back when new tasks keep failing — turn it on." },
    { id: "task1", x: 230, y: 100, w: 130, h: 44, color: "green", label: "Fargate task", sub: "micro-VM, own ENI",
      info: "Each task runs in its own micro-VM — kernel-level isolation, no shared host, no host to patch or SSH into. In awsvpc mode it gets its own ENI and private IP with its own security group. You pay per vCPU-second and GB-second; Fargate Spot cuts ~70% for interruption-tolerant work." },
    { id: "task2", x: 420, y: 100, w: 130, h: 44, color: "green", label: "Fargate task", sub: "micro-VM, own ENI",
      info: "Same task definition, different AZ — the scheduler spreads for you. Debugging without a host: ECS Exec opens a shell into the container over SSM, no inbound ports, fully audited in CloudTrail." },
    { id: "tg", x: 230, y: 240, w: 150, h: 46, color: "orange", label: "ALB target group", sub: "IP targets, drain",
      info: "Fargate tasks register by <strong>IP</strong> (there is no instance ID) on the container port. Health checks gate deployments, and deregistration delay drains in-flight connections on the way out. Tune it down from the 300s default for snappier deploys on short-request services." },
    { id: "sc", x: 410, y: 240, w: 150, h: 46, color: "yellow", label: "Service Connect", sub: "envoy, DNS names",
      info: "Service-to-service discovery plus an ECS-managed Envoy sidecar: stable DNS names per service, connection-level retries, and per-route telemetry without running your own mesh. Supersedes plain Cloud Map lookups for most ECS-internal traffic; external traffic still enters via the ALB." },
    { id: "cw", x: 630, y: 100, w: 150, h: 46, color: "blue", label: "CloudWatch Logs", sub: "awslogs driver",
      info: "With no host there is no /var/log — stdout/stderr ship via the awslogs driver (or FireLens for Fluent Bit routing to S3/OpenSearch/Datadog). The <strong>execution role</strong>, not the task role, needs the log and ECR permissions; confusing the two is the classic first-deploy failure." },
    { id: "aas", x: 630, y: 220, w: 150, h: 46, color: "yellow", label: "App Auto Scaling", sub: "target tracking",
      info: "Service auto scaling adjusts the service's desired count via target tracking on CPU, memory, or ALBRequestCountPerTarget — the last one tracks real traffic and beats CPU for request-driven services. Scaling capacity is never the bottleneck on Fargate; task cold-start time is." }
  ],
  edges: [
    { from: "ecr", to: "td", label: "image digest" },
    { from: "td", to: "svc", label: "revision N" },
    { from: "svc", to: "task1", label: "run" },
    { from: "svc", to: "task2", label: "run" },
    { from: "tg", to: "task1" },
    { from: "tg", to: "task2" },
    { from: "task1", to: "sc", dashed: true },
    { from: "task2", to: "cw", label: "stdout", dashed: true },
    { from: "aas", to: "svc", label: "desired count", dashed: true }
  ],
  flows: [
    { title: "Deploy: image push to rolling replacement", steps: [
      { lit: ["ecr", "ecr->td"], text: "CI pushes the image; ECR scans it on push. The pipeline registers a new <strong>task definition revision</strong> pinned to the image digest — never a mutable tag — so what you tested is what runs." },
      { lit: ["td", "td->svc", "svc"], text: "The service is updated to revision N+1. Rolling deployment math: maximumPercent 200 / minimumHealthyPercent 100 means start all new tasks alongside the old ones, then retire the old — brief double capacity, zero dip." },
      { lit: ["svc->task2", "task2", "tg->task2", "tg"], text: "New tasks must pass <strong>ALB health checks</strong> before old tasks are stopped. If they keep failing, the deployment circuit breaker halts and rolls back to revision N automatically — no 3 a.m. manual revert." }
    ]},
    { title: "A task dies at 2 a.m.", steps: [
      { lit: ["task1"], text: "The container leaks memory and gets OOM-killed. There is no host to inspect — the task's micro-VM is simply gone. The last stdout lines are already in CloudWatch Logs; that is your black box recorder." },
      { lit: ["tg", "tg->task1"], text: "The target group fails its health checks and stops routing to the dead IP. On a <strong>planned</strong> stop, deregistration delay would drain in-flight requests first; a crash just drops them — idempotent retries are the client's job." },
      { lit: ["svc", "svc->task1"], text: "The scheduler's reconciliation loop sees running=1, desired=2 and launches a replacement — pull image, attach ENI, health-check, register. Self-healing is the default posture, not an add-on." },
      { lit: ["task1", "tg->task1"], text: "The replacement passes checks and takes traffic. Total gap is dominated by image pull plus health-check thresholds — shrink images (or use SOCI lazy loading) and this window shrinks with them." }
    ]},
    { title: "Scale on load", steps: [
      { lit: ["aas"], text: "Requests per target crosses the tracking setpoint. ALBRequestCountPerTarget scales on actual demand — it reacts before CPU does for I/O-bound services, and it scales to zero signal cleanly when traffic stops." },
      { lit: ["aas->svc", "svc"], text: "App Auto Scaling raises the service's desired count. The scheduler places new tasks spread across AZ a and AZ b — with no cluster capacity to manage, placement is purely about subnets and spread." },
      { lit: ["svc->task2", "task2", "azb"], text: "Each new task gets its own <strong>ENI and private IP</strong> (awsvpc mode). Sizing gotcha: every task consumes a subnet IP, so a /24 caps you around 250 tasks — carve container subnets generously." },
      { lit: ["tg->task2", "tg", "sc"], text: "The task registers its IP with the target group and its DNS name with Service Connect. Within a minute or two of the metric breach, capacity is serving — cold-start time, not fleet capacity, is Fargate's scaling constant." }
    ]}
  ]
});
