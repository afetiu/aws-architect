/* Module 14 — Containers: ECS, EKS & Fargate (SAA track) */
window.COURSE.register({
  id: "containers",
  order: 14,
  track: "saa",
  title: "Containers: ECS, EKS & Fargate",
  description: "AWS container services for someone who already runs Kubernetes: ECR internals, the ECS control-plane model, Fargate's micro-VM isolation, EKS data-plane and identity plumbing, plus App Runner and Batch. Ends with the decision framework the exam actually tests.",
  examWeight: "Heavily tested on SAA-C03 across all four domains. Expect 5-8 questions: launch-type selection, task vs execution roles, Fargate constraints, ECR private connectivity, and the ECS-vs-EKS-vs-Lambda decision matrix.",
  lessons: [
    {
      id: "ecr",
      title: "ECR: the registry you stop thinking about (until networking bites)",
      html: `
<p>ECR is a managed OCI registry with two personalities: <strong>ECR Private</strong> (per-account, per-region registries, IAM-authenticated, this is what the exam means by "ECR") and <strong>ECR Public</strong> (a global, anonymous-pull registry under <code>public.ecr.aws</code> — Amazon's answer to Docker Hub rate limits). The mental model: a private ECR registry is just an S3-backed blob store plus a Dynamo-style metadata layer, fronted by an IAM-integrated Docker Registry v2 API. Image manifests and config live in the metadata layer; the actual layer blobs are served from S3. That last detail is not trivia — it drives the VPC endpoint story below.</p>

<h3>Authentication: 12-hour tokens, not passwords</h3>
<p>Docker's auth model wants a username and password; IAM wants SigV4. The bridge is <code>ecr:GetAuthorizationToken</code>: you call it (SigV4-signed), it returns a base64 token valid for <strong>12 hours</strong>, and you feed that to <code>docker login</code> with username <code>AWS</code>. The canonical one-liner:</p>
<pre><code>aws ecr get-login-password --region eu-west-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.eu-west-1.amazonaws.com</code></pre>
<p>Two authorization layers apply to every pull: the caller's <strong>IAM identity policy</strong> and the repository's <strong>resource policy</strong>. Cross-account access is the classic use of the repo policy — grant <code>ecr:BatchGetImage</code> and <code>ecr:GetDownloadUrlForLayer</code> to the other account's principal, and the puller still needs <code>GetAuthorizationToken</code> on its own side. ECS and EKS never run <code>docker login</code>; the ECS agent / kubelet credential provider fetch tokens using the instance role or the <strong>task execution role</strong> (a distinction a later lesson beats to death).</p>

<div class="callout war">CI systems that cache the login token hit mysterious 401s at hour 13. If a long-lived runner starts failing pulls with "authorization token has expired", nobody rotated anything — the 12-hour token simply aged out. Re-run get-login-password per job, not per runner boot.</div>

<h3>Lifecycle policies: the garbage collector you must write yourself</h3>
<p>ECR never deletes anything on its own, and you pay ~0.10 USD/GB-month for storage. Every CI push of a 800 MB image adds up fast. A <strong>lifecycle policy</strong> is a JSON rule set evaluated per repository, rules ordered by priority, each rule selecting images by:</p>
<ul>
<li><strong>tagStatus</strong>: <code>tagged</code> (with tag prefix or wildcard filters), <code>untagged</code>, or <code>any</code>,</li>
<li><strong>countType</strong>: <code>imageCountMoreThan</code> (keep newest N) or <code>sinceImagePushed</code> (expire after N days).</li>
</ul>
<p>Typical production pair: expire <code>untagged</code> images after 7 days (these are the orphaned layers left when a tag gets re-pushed), and keep only the last 50 images per release-tag prefix. Lifecycle evaluation is asynchronous — expect deletions within about a day, not instantly.</p>

<h3>Replication and pull-through cache</h3>
<p><strong>Replication</strong> is registry-level configuration (not per-repo): rules that copy images on push to other regions (cross-region) or other accounts (cross-account, destination must grant permission via a registry policy). It is push-triggered and one-way — existing images do not backfill. Use it so that a us-east-1 build is pull-local in eu-west-1, cutting cross-region data transfer cost and pull latency, and removing a cross-region dependency from your deploy path (a region that cannot reach another region's ECR can still deploy).</p>
<p><strong>Pull-through cache</strong> inverts the flow: you configure an upstream (ECR Public, Docker Hub, Quay, GitHub Container Registry, Kubernetes registry...) and pull through a namespaced path in your private registry. First pull fetches from upstream and caches; later pulls are local, IAM-authenticated, and immune to Docker Hub rate limiting. For authenticated upstreams like Docker Hub you store credentials in Secrets Manager. This is the exam's answer to "builds fail intermittently due to Docker Hub throttling" and to "all images must be scanned and served from a private registry without manually mirroring".</p>

<h3>Scanning and tag immutability</h3>
<p><strong>Basic scanning</strong> uses the open-source Clair database: OS-package CVEs only, scan on push or on demand, one scan per image per 24h, free. <strong>Enhanced scanning</strong> hands the job to <strong>Amazon Inspector</strong>: continuous rescanning as new CVEs publish (not just at push time), coverage for OS packages <em>and</em> language packages (pip, npm, Maven...), findings flow to Inspector/Security Hub/EventBridge, priced per image scanned. Keyword mapping: "continuously re-evaluate images already in the registry as new CVEs are disclosed" → enhanced/Inspector.</p>
<p><strong>Tag immutability</strong> is a per-repo flag: once <code>myapp:v1.2.3</code> exists, re-pushing that tag fails with <code>ImageTagAlreadyExistsException</code>. Turn it on for anything deployable — it kills the "latest tag drifted between what CI tested and what prod pulled" class of incident and makes tags trustworthy audit artifacts. The cost: workflows that re-push <code>latest</code> break by design.</p>

<div class="callout deep">Why does pulling from ECR through PrivateLink require an <strong>S3 gateway endpoint</strong>? Because the registry API only serves manifests; the layer blobs are presigned-URL redirects into an AWS-owned S3 bucket. A pull is really: auth (ecr.api endpoint) → manifest (ecr.dkr endpoint) → layers (S3). Miss the S3 endpoint and pulls fail after auth succeeds — the most confusing failure signature in this module.</div>

<h3>Private connectivity: the three-endpoint rule</h3>
<p>For tasks in private subnets with no NAT, you need <strong>three</strong> things (plus CloudWatch Logs if you log):</p>
<ol>
<li><code>com.amazonaws.region.ecr.api</code> — interface endpoint for the ECR API (auth, DescribeImages).</li>
<li><code>com.amazonaws.region.ecr.dkr</code> — interface endpoint for the Docker Registry API (manifest operations).</li>
<li><strong>S3 gateway endpoint</strong> on the route table — for the actual layer downloads. Gateway, not interface: it is free, which matters because image layers are your bulk bytes.</li>
</ol>
<p>Fargate platform version 1.4+ pulls images and writes logs through the <em>task's own ENI</em>, so the task's subnet/security group must reach those endpoints — on older platform versions a hidden Fargate-owned ENI did the pulling, and many teams' mental models fossilized there.</p>

<div class="callout exam">Trap pattern: "tasks in private subnets fail to start with a CannotPullContainerError; the architecture uses interface endpoints for ECR" — the missing piece is almost always the S3 gateway endpoint. Second trap: interface endpoints need <strong>private DNS enabled</strong> and a security group allowing 443 from the tasks.</div>

<div class="callout limits">Numbers worth holding: auth token TTL 12 hours; default 10,000 repos per registry and 10,000 images per repo (soft); layer max 42 GB in practice via S3 multipart; storage ~0.10 USD/GB-month; basic scanning free, one scan/image/24h; enhanced scanning billed per-image via Inspector.</div>
`
    },
    {
      id: "ecs-model",
      title: "ECS core model: task definitions, services, launch types, capacity providers",
      html: `
<p>ECS is what you get if you strip Kubernetes down to "run N copies of this container group and keep them running" and replace etcd, the scheduler, and the kubelet with a proprietary AWS control plane you never see or patch. There is no API server to version-upgrade, no CNI to choose, no cluster credential to leak. The price is a smaller vocabulary: no operators, no CRDs, no admission webhooks. For a senior engineer the fastest route is a translation table:</p>
<table>
<thead><tr><th>Kubernetes</th><th>ECS</th></tr></thead>
<tbody>
<tr><td>Pod spec / Deployment template</td><td>Task definition (a revision)</td></tr>
<tr><td>Pod (running instance)</td><td>Task</td></tr>
<tr><td>Deployment + ReplicaSet</td><td>Service (replica strategy)</td></tr>
<tr><td>DaemonSet</td><td>Service with daemon strategy (EC2 only)</td></tr>
<tr><td>Node</td><td>Container instance (EC2) or nothing (Fargate)</td></tr>
<tr><td>Cluster Autoscaler</td><td>Capacity provider managed scaling</td></tr>
</tbody>
</table>

<h3>Task definitions: families, revisions, and two levels of sizing</h3>
<p>A <strong>task definition</strong> is an immutable, versioned document: a <strong>family</strong> name plus an auto-incrementing <strong>revision</strong> (<code>web:37</code>). You never edit revision 37; you register 38 and point the service at it, which is what makes rollback trivial — redeploy the old revision number. Inside it, <strong>container definitions</strong> (one or more containers that share a lifecycle and, in awsvpc mode, a network namespace — exactly a pod): image, port mappings, environment, secrets (from Secrets Manager or SSM Parameter Store, injected by the agent at start), log configuration, health checks, and dependency ordering (<code>dependsOn</code> with conditions like HEALTHY — how you sequence an Envoy sidecar before the app).</p>
<p>CPU and memory exist at <strong>two levels</strong>. Task-level <code>cpu</code>/<code>memory</code> bound the whole task and are <em>mandatory on Fargate</em> (they select the micro-VM size and the price). Container-level settings subdivide: <code>cpu</code> (shares), <code>memory</code> (hard limit — OOM-kill at the cgroup boundary), <code>memoryReservation</code> (soft, used for placement math on EC2). The <strong>essential</strong> flag decides blast radius: when an essential container exits, the whole task is stopped. Mark the app essential; mark a log-shipping sidecar non-essential so its crash does not take down the workload.</p>

<h3>Tasks vs services, replica vs daemon</h3>
<p>A bare <strong>task</strong> is run-to-completion — <code>run-task</code> for batch jobs, EventBridge Scheduler for cron. A <strong>service</strong> wraps tasks in a reconciliation loop: hold <strong>desiredCount</strong> running, replace failures, register/deregister targets with an ELB target group, orchestrate deployments. Two schedulers: <strong>replica</strong> (place N tasks wherever capacity and placement rules allow) and <strong>daemon</strong> (exactly one task per container instance — monitoring/log agents; EC2 launch type only, because on Fargate there is no "per node" to speak of).</p>

<h3>EC2 vs Fargate launch types</h3>
<p>On <strong>EC2</strong>, you own an ASG of instances running the ECS agent: you patch AMIs, right-size instances, and win the ability to use GPUs, daemon services, privileged containers, docker-socket tricks, and dense bin-packing that can undercut Fargate pricing at scale. On <strong>Fargate</strong>, AWS owns the compute: you submit a task size, get an isolated micro-VM, and pay per-second for vCPU+GB. The operational asymmetry is the whole decision: Fargate deletes the AMI-patching, capacity-planning, and agent-upgrade toil; EC2 buys back hardware control and (sometimes) unit cost.</p>

<div class="callout war">Classic EC2-launch-type incident: deployments hang in PENDING because no container instance has enough <em>unreserved</em> memory, even though htop on the boxes shows plenty free. ECS places on <em>reservations</em>, not live usage. Fix the memoryReservation values or add capacity — staring at actual utilization will mislead you.</div>

<h3>Capacity providers: the scaling contract</h3>
<p>Launch type is the legacy way to pick compute; <strong>capacity providers</strong> are the modern one, and they add auto scaling of the underlying fleet. An <strong>ASG-backed capacity provider</strong> wraps your Auto Scaling group with <strong>managed scaling</strong>: ECS publishes a CapacityProviderReservation metric (ratio of needed to available capacity) and target-tracks it against your <strong>target capacity</strong> percentage. Target 100 means run the ASG exactly as big as the task load; target 80 keeps ~20% headroom so scale-out tasks do not wait for a fresh EC2 boot. <strong>Managed termination protection</strong> stops scale-in from draining instances that still run tasks. FARGATE and FARGATE_SPOT are pre-existing providers you just attach to the cluster.</p>
<p>A <strong>capacity provider strategy</strong> splits a service across providers with <strong>base</strong> (this many tasks on this provider first) and <strong>weight</strong> (ratio for the rest). The canonical cost pattern:</p>
<pre><code>"capacityProviderStrategy": [
  { "capacityProvider": "FARGATE",      "base": 2, "weight": 1 },
  { "capacityProvider": "FARGATE_SPOT", "base": 0, "weight": 3 }
]</code></pre>
<p>Two tasks always on on-demand (your availability floor), then every additional four tasks split 1:3 on-demand:Spot — roughly 70% discount on the Spot share, and interruption (2-minute warning, task stopped with SIGTERM) only ever shrinks the burst capacity, never the floor.</p>

<div class="callout exam">"Baseline must always run, burst capacity should be as cheap as possible, occasional interruption of burst is acceptable" → FARGATE base + FARGATE_SPOT weight. "Reduce EC2 cluster over-provisioning while ensuring instances are not terminated while running tasks" → capacity provider with managed scaling + managed termination protection. Also remember: you cannot mix launch type and capacity provider strategy in the same service definition — it is one or the other.</div>

<div class="callout deep">The ECS control plane runs a per-cluster state machine over an agent-reported truth: the ECS agent (open source, on each EC2 instance) long-polls the backend, receives task placement decisions, drives Docker/containerd, and reports state transitions. There is no equivalent of kubelet-watches-apiserver; the agent channel is outbound-only, which is why container instances in private subnets need only egress (NAT or VPC endpoints for ecs, ecs-agent, ecs-telemetry) and no inbound control-plane reachability at all.</div>

<div class="callout limits">Quotas that show up: 5,000 services per cluster, desiredCount effectively bounded by tasks-per-cluster (default 5,000 across launch types, raisable), 10 containers per task definition is a practical design ceiling (hard max is higher but sidecars beyond a few is a smell), task definition max size 64 KiB. Fargate tasks per region: default 5,000 on-demand + 5,000 Spot (soft).</div>
`
    },
    {
      id: "ecs-networking",
      title: "ECS networking modes and service discovery: awsvpc, Cloud Map, Service Connect",
      html: `
<p>ECS has four networking modes, but only one matters for new designs. <strong>awsvpc</strong> gives every task its own ENI: a real VPC IP, its own security groups, its own flow logs — the task is a first-class network citizen, indistinguishable from a small EC2 instance to the rest of your VPC. This is mandatory on Fargate and the right default on EC2. The other three are legacy or niche: <strong>bridge</strong> (Docker's default docker0 NAT, ports published per-container, enables dynamic host-port mapping so multiple task copies share an instance behind an ALB), <strong>host</strong> (container binds the instance's network namespace directly — lowest overhead, one task per port per instance, the classic choice for packet-hungry daemons), and <strong>none</strong> (no external networking).</p>

<h3>Why awsvpc changes your security model</h3>
<p>With bridge mode, the security group is the <em>instance's</em>, so every task on the box shares one blast radius and you write rules against ephemeral host ports. With awsvpc, security groups attach to the <em>task ENI</em>: the payments task can have a tighter SG than the marketing task on the same instance, and SG references (allow from sg-app to sg-db) work at task granularity. Microsegmentation without a service mesh. The trade: ENIs are a finite instance resource.</p>

<div class="callout limits"><strong>ENI trunking</strong> is the density fix on EC2. Without it, a c5.large holds 3 ENIs (1 primary + 2 for tasks → 2 awsvpc tasks per instance — absurd). With <code>awsvpcTrunking</code> enabled, ECS attaches a trunk ENI and multiplexes branch interfaces: that same c5.large jumps to ~10-12 tasks, larger instances to ~100+. Exam signature: "few awsvpc tasks per instance despite free CPU/memory" → enable ENI trunking (account setting, supported instance families, instances must re-register).</div>

<div class="callout deep">Each awsvpc ENI consumes a private IP from your subnet. 200 tasks in a /24 subnet with an ALB and some endpoints is already tight (a /24 gives 251 usable after AWS reserves 5). Plan container subnets at least a size class bigger than instinct suggests — this is the same IP-exhaustion arithmetic that hits EKS with the VPC CNI, and the fix (bigger or secondary CIDR subnets) is the same.</div>

<h3>Service discovery, take one: ECS Service Discovery via Cloud Map</h3>
<p>ECS Service Discovery wires a service into <strong>AWS Cloud Map</strong>, which materializes as Route 53 records in a private hosted zone: A records per task (awsvpc mode) under <code>service.namespace</code>, e.g. <code>orders.internal.local</code>. The control plane registers/deregisters task IPs as they start and stop. It is DNS, so it inherits DNS's failure semantics: caching (keep TTLs low — deregistration is not instant, so a client can resolve a task that died a few seconds ago), no load-aware balancing (clients get all IPs, most pick the first), no retries, no telemetry, no TLS help. Fine for coarse discovery; thin for real east-west traffic.</p>

<h3>Service discovery, take two: Service Connect</h3>
<p><strong>Service Connect</strong> is ECS's opinionated answer to "we want mesh behavior without running a mesh". ECS injects and manages an <strong>Envoy sidecar</strong> in each task (you never write its config, and it does not count against your container definitions), registers services into a Cloud Map <strong>namespace</strong>, and gives each service a friendly DNS alias that resolves to the local Envoy. Every service-to-service call then flows proxy-to-proxy, which buys you:</p>
<ul>
<li><strong>Fast, correct endpoint propagation</strong> — Envoy endpoint sets update out-of-band, no DNS TTL staleness; draining tasks are removed before they die.</li>
<li><strong>Retries and outlier detection</strong> — automatic retry on connection failure, ejection of misbehaving endpoints.</li>
<li><strong>Uniform telemetry</strong> — per-route request rate, latency, and error metrics in CloudWatch with zero app changes.</li>
<li><strong>TLS</strong> — Service Connect can terminate/originate TLS with ACM-managed certs between services.</li>
</ul>
<p>Configuration is per-service: a service is a <strong>client</strong> (can call others in the namespace), a <strong>client-server</strong> (also publishes named endpoints with port aliases), or not enrolled. Compared to App Mesh (deprecated) or Istio, you give up fine-grained traffic policy (no header-based routing, no fault injection) and get in exchange a config surface small enough to actually finish reading.</p>

<div class="callout exam">Mapping: "microservices on ECS need automatic retries, connection draining awareness, and per-service latency metrics without application changes" → Service Connect. "Simple DNS name for tasks, third-party or non-ECS clients must resolve it too" → Service Discovery/Cloud Map (Service Connect aliases resolve only <em>inside</em> enrolled tasks — external clients cannot use them; that distinction is a favorite distractor). "Tasks need distinct security groups per service on shared instances" → awsvpc mode.</div>

<div class="callout war">Two production traps. First: the Envoy sidecar consumes task CPU/memory — size Fargate tasks with ~256 CPU units and 64+ MB of headroom for it or watch p99s degrade under load while the app looks idle. Second: with bridge mode behind an ALB you must use <strong>dynamic host ports</strong> (hostPort 0) and open the instance SG for the full ephemeral range 32768-65535 from the ALB SG — teams that open only port 80 get intermittent 502s that correlate, maddeningly, with deployments moving tasks to new ports.</div>

<h3>Choosing a mode: the short version</h3>
<table>
<thead><tr><th>Mode</th><th>Use when</th><th>Cost</th></tr></thead>
<tbody>
<tr><td>awsvpc</td><td>Default. Fargate always. Per-task SGs, VPC-native IPs</td><td>IP consumption, ENI density (fix: trunking)</td></tr>
<tr><td>bridge</td><td>Legacy EC2 tasks, maximum tasks-per-instance behind ALB dynamic ports</td><td>Shared instance SG, NAT hop, port sprawl</td></tr>
<tr><td>host</td><td>Network-heavy daemons, lowest latency, monitoring agents</td><td>One task per port; port conflicts are yours</td></tr>
<tr><td>none</td><td>Isolated batch work with no network</td><td>No connectivity at all</td></tr>
</tbody>
</table>
<p>Final integration note: awsvpc tasks register in ALB/NLB target groups by <strong>IP target type</strong>, bridge-mode tasks by <strong>instance</strong> target type with the dynamic port. IP target type is also what lets an ALB reach Fargate at all — there is no instance to point at. Keep that pairing in your head; it returns in the EKS lesson as the Load Balancer Controller's ip-vs-instance target mode with identical semantics.</p>
`
    },
    {
      id: "ecs-deploy",
      title: "ECS deployments, placement, auto scaling — and the two IAM roles",
      html: `
<p>Deployment behavior is where ECS services either save you at 3 a.m. or page you. ECS offers three deployment controllers; know the levers of each.</p>

<h3>Rolling update: two percentages run the show</h3>
<p>The default <strong>ECS rolling update</strong> replaces tasks in place, governed by two numbers relative to desiredCount: <strong>minimumHealthyPercent</strong> (floor during deploys — how far below desired you may dip) and <strong>maximumPercent</strong> (ceiling — how far above desired you may surge). With desired=4, min=50, max=200: ECS may kill 2 old tasks immediately and may run up to 8 total while cycling. On a memory-tight EC2 cluster, max=100 forces stop-then-start (needs no spare capacity, but momentarily reduces fleet); min=100/max=200 forces start-then-stop (zero capacity dip, but needs headroom for the surge). These two numbers are the whole story of why a deployment "hangs" (no room to surge) or why capacity cratered mid-deploy (floor set too low).</p>

<h3>Circuit breaker: rollback without a human</h3>
<p>The <strong>deployment circuit breaker</strong> (rolling updates only) watches for tasks that repeatedly fail to reach steady state — crash loops, failed health checks — trips after a threshold scaled to deployment size, marks the deployment FAILED, and with <code>rollback: true</code> automatically redeploys the last steady-state task definition revision. Before this existed, a bad image left ECS retrying failed tasks forever while the on-call watched. Turn it on everywhere; there is no good reason not to.</p>

<h3>Blue/green via CodeDeploy: validate before traffic believes you</h3>
<p>The <strong>CODE_DEPLOY</strong> controller stands up a full green task set alongside blue, registers it with a second target group, and shifts ALB/NLB traffic between them. The differentiating features:</p>
<ul>
<li><strong>Test listener</strong> — a second listener port (say 8443) routes to green before any production traffic does; hooks in the CodeDeploy lifecycle (AfterAllowTestTraffic) run Lambda-based validation against it and can veto the release.</li>
<li><strong>Shift shapes</strong> — all-at-once, <strong>canary</strong> (e.g. 10% then the rest after N minutes), or <strong>linear</strong> (10% every N minutes), with CloudWatch alarms able to trigger automatic rollback mid-shift.</li>
<li><strong>Instant rollback</strong> — blue stays warm for a configurable bake time; rollback is a listener flip, not a redeploy.</li>
</ul>

<div class="callout exam">Keyword mapping: "test new version with production-like traffic on a separate port before shifting users" → ECS blue/green with CodeDeploy test listener. "Shift 10 percent of traffic, monitor, then continue" → canary. "Automatically roll back when tasks fail to start, minimal setup" → rolling update + circuit breaker with rollback. Also: blue/green needs an ALB/NLB with <em>two</em> target groups — a service without a load balancer cannot use it.</div>

<h3>Placement strategies and constraints (EC2 only)</h3>
<p>On the EC2 launch type you influence where tasks land; on Fargate there is nothing to place onto, so none of this applies — itself a tested fact. <strong>Strategies</strong> order candidate instances: <strong>binpack</strong> (pack tasks onto the fewest instances by least remaining CPU or memory — maximizes scale-in savings), <strong>spread</strong> (across an attribute — <code>attribute:ecs.availability-zone</code> for AZ spread, <code>instanceId</code> for host spread), <strong>random</strong>. They chain: spread across AZs, then binpack within each. <strong>Constraints</strong> are hard filters: <strong>distinctInstance</strong> (never co-locate two tasks of this group) and <strong>memberOf</strong> with cluster query language (<code>attribute:ecs.instance-type =~ g4dn.*</code> to pin GPU work to GPU nodes).</p>

<div class="callout war">Binpack-everything without an AZ spread first means a single AZ failure can take out every task of a small service — they were all packed onto one cheap corner of one AZ. Production default: spread on availability-zone first, binpack second. Cost optimization and blast-radius control are both placement problems; solve them in that order.</div>

<h3>Service auto scaling</h3>
<p>ECS service scaling is <strong>Application Auto Scaling</strong> acting on desiredCount — the same engine as DynamoDB and Aurora scaling, so the vocabulary transfers. Three policy types: <strong>target tracking</strong> (declare a setpoint, AWS synthesizes the alarms — CPU %, memory %, or <strong>ALBRequestCountPerTarget</strong>, the best signal for request-bound services because it leads CPU instead of lagging it), <strong>step scaling</strong> (your alarms, banded adjustments — for asymmetric or aggressive policies), and <strong>scheduled</strong> (known daily/weekly shape). Target tracking scales out fast and in conservatively by design; do not fight it with cooldown micro-tuning. Remember the layering on EC2: service scaling adds <em>tasks</em>; the capacity provider's managed scaling then adds <em>instances</em> to fit them. Two loops, deliberately decoupled.</p>

<h3>The two IAM roles — the most-tested distinction in this module</h3>
<table>
<thead><tr><th></th><th>Task execution role</th><th>Task role</th></tr></thead>
<tbody>
<tr><td>Used by</td><td>ECS agent / Fargate plumbing, <em>before and around</em> your code</td><td>Your application code, via the SDK credential chain</td></tr>
<tr><td>Grants</td><td>ECR pull (GetAuthorizationToken, BatchGetImage...), CloudWatch Logs writes, Secrets Manager/SSM fetch for injected secrets</td><td>Whatever the app touches: S3, DynamoDB, SQS...</td></tr>
<tr><td>Failure smell</td><td>Task will not <em>start</em>: CannotPullContainerError, ResourceInitializationError on secrets</td><td>Task runs; app gets AccessDenied at runtime</td></tr>
</tbody>
</table>
<p>Mechanically, the task role works like an instance profile scoped to one task: the agent exposes a per-task credential endpoint (169.254.170.2, pointed to by <code>AWS_CONTAINER_CREDENTIALS_RELATIVE_URI</code>), the SDK chain picks it up automatically, and neighboring tasks on the same instance get different credentials. Never fall back to granting the EC2 instance role app permissions — that hands every task on the box the union of all permissions.</p>

<div class="callout deep">Deployment ordering under the hood: ECS creates the new task set, waits for container <em>and</em> load balancer health checks, begins draining old tasks (deregistration delay applies), then stops them with SIGTERM → stopTimeout (default 30s, max 120s on Fargate) → SIGKILL. Apps that ignore SIGTERM turn every deploy into a burst of severed in-flight requests; handle it and drain within the timeout.</div>

<div class="callout limits">Memorize: minimumHealthyPercent default 100, maximumPercent default 200 (replica services). stopTimeout default 30s. Circuit breaker threshold: between 3 and 200 failed tasks, computed as roughly half the desired count. Scheduled/step/target-tracking all coexist on one service; target tracking cannot scale to zero desiredCount on its own (scheduled actions can).</div>
`
    },
    {
      id: "fargate",
      title: "Fargate internals: micro-VMs, sizing, pricing, and what you give up",
      html: `
<p>The single most important fact about Fargate: <strong>each task runs in its own dedicated micro-VM</strong>, in the Firecracker lineage — the same KVM-based minimal VMM that underpins Lambda. Your containers share a kernel <em>with each other</em> inside the task, but never with another customer's task and never even with your own neighboring tasks. Isolation boundary = hardware virtualization, not namespaces/cgroups. That reframes several instincts a Kubernetes operator carries around:</p>
<ul>
<li>Container-escape vulnerabilities stop at the VM boundary; multi-tenant anxiety about co-scheduled workloads largely dissolves.</li>
<li>There is no node: no shared kernel to tune, no sysctl inherited from a neighbor, no noisy-neighbor CPU steal beyond what the hypervisor allows.</li>
<li>The task-level cpu/memory you declare is the VM's size. There is no overcommit and no bursting above it — unlike EC2 bin-packing where soft reservations let you oversubscribe.</li>
</ul>

<h3>The sizing matrix</h3>
<p>You pick a task-level vCPU value and one of its allowed memory pairings — this is a menu, not a free-form pair:</p>
<table>
<thead><tr><th>vCPU</th><th>Memory options</th></tr></thead>
<tbody>
<tr><td>0.25</td><td>0.5, 1, 2 GB</td></tr>
<tr><td>0.5</td><td>1 - 4 GB (1 GB steps)</td></tr>
<tr><td>1</td><td>2 - 8 GB</td></tr>
<tr><td>2</td><td>4 - 16 GB</td></tr>
<tr><td>4</td><td>8 - 30 GB</td></tr>
<tr><td>8</td><td>16 - 60 GB (4 GB steps)</td></tr>
<tr><td>16</td><td>32 - 120 GB (8 GB steps)</td></tr>
</tbody>
</table>
<p>Need 1 vCPU with 32 GB for a memory-fat cache? Not on the menu — you buy 4+ vCPU to reach the memory, and pay for CPU you will not use. Memory-skewed workloads are Fargate's worst unit economics; that is an EC2-launch-type (or memory-optimized-instance) signal.</p>

<h3>Pricing shape</h3>
<p><strong>Per-second billing (1-minute minimum) on two dimensions: vCPU-hours and GB-hours</strong>, from image-pull start to task stop. Rough us-east-1 anchors: ~0.04048 USD per vCPU-hour, ~0.004445 USD per GB-hour — a 0.25 vCPU / 0.5 GB task idles around 9 USD/month; a 4 vCPU / 8 GB task around 143 USD/month. <strong>Ephemeral storage</strong>: 20 GiB included free, expandable to <strong>200 GiB</strong> per task, billed per GiB-month above 20. Levers: <strong>Fargate Spot</strong> (~70% off, see below), Compute Savings Plans (apply to Fargate, up to ~50%), and ARM (Graviton) tasks at ~20% less per vCPU. The comparison to remember: Fargate list price runs maybe 20-40% above equivalent EC2 on-demand — you are paying AWS to delete node ops. At small scale that trade is obviously right; at hundreds of steady-state vCPUs, do the math again.</p>

<h3>What you give up</h3>
<ul>
<li><strong>No daemonsets / daemon services</strong> — there is no node to put a per-node agent on. Log shipping and metrics become <em>sidecars in every task</em> (FireLens/Fluent Bit pattern), multiplying their cost by task count.</li>
<li><strong>No privileged containers, no docker socket</strong> — anything that wants /var/run/docker.sock (docker-in-docker CI, some security agents) is out. Kaniko/BuildKit-style rootless builds or CodeBuild instead.</li>
<li><strong>No GPUs</strong> on Fargate — GPU inference/training means EC2 launch type (ECS GPU AMI) or EKS with GPU nodes. Long-standing, heavily tested limitation.</li>
<li><strong>Limited kernel access</strong> — only a small allowlist of Linux capabilities (SYS_PTRACE is the notable grantable one), few sysctls, no custom kernel modules, no eBPF-heavy tooling.</li>
<li><strong>Ephemeral storage ceiling</strong> — 200 GiB max, not persistent. Durable state → EFS volumes (supported on Fargate PV 1.4+) or externalize to S3/RDS.</li>
<li><strong>awsvpc only</strong> — every task an ENI, so subnet IP math from the networking lesson applies in full.</li>
</ul>

<div class="callout deep"><strong>Platform versions</strong> are Fargate's hidden runtime contract: LATEST currently resolves to 1.4.0 (Linux), which moved image pulls and log traffic onto the task ENI, switched to containerd, added EFS support and the 20 GiB encrypted ephemeral base. Pin or track deliberately: "it worked yesterday" Fargate mysteries are occasionally a platform-version revision shifting under LATEST. Windows tasks have their own platform versioning and a per-OS pricing premium.</div>

<h3>Fargate Spot</h3>
<p><strong>Fargate Spot is ECS-only</strong> — EKS pods cannot run on it (EKS Fargate has no Spot flavor; Spot on EKS means Spot EC2 node groups or Karpenter). Interruption contract: a two-minute warning delivered as a task state-change event (SIGTERM to the task, EventBridge event to you), then termination. ~70% discount. Architect for it the same way you would EC2 Spot: stateless, idempotent, drain-on-SIGTERM, and always keep an on-demand base via capacity provider strategy so an interruption wave cannot zero the service.</p>

<div class="callout war">Fargate has no capacity SLA per AZ: during regional capacity events (and routinely for Spot), RunTask can return capacity errors in one AZ. Services retry and land elsewhere <em>if you gave them multiple subnets across AZs</em>. Single-subnet Fargate services are a self-inflicted single point of failure that looks fine for months.</div>

<div class="callout exam">Trap patterns: "requires a GPU" / "requires privileged mode" / "runs a per-host monitoring daemon" → Fargate is the <em>wrong</em> answer, pick EC2 launch type. "Batch-like workload, interruption-tolerant, minimize cost, no server management" → Fargate Spot. "Needs 500 GB of scratch disk" → exceeds the 200 GiB ephemeral max: EC2 with instance store or EFS. "Minimize operational overhead for containers" with no disqualifier → Fargate wins by default on this exam.</div>

<div class="callout limits">The numbers: 0.25-16 vCPU; 0.5-120 GB memory (paired per the matrix); ephemeral 20 GiB free / 200 GiB max; per-second billing, 1-minute minimum; Spot ~70% off with 2-minute warning, ECS only; stopTimeout max 120 seconds; EFS is the only persistent volume option; platform version 1.4+ = containerd, ENI-routed pulls/logs, EFS.</div>
`
    },
    {
      id: "eks-core",
      title: "EKS: control plane economics, data-plane options, and pod IAM done right",
      html: `
<p>EKS is upstream Kubernetes where AWS operates the control plane: a multi-AZ set of API servers and an AWS-managed <strong>etcd</strong> cluster (encrypted, backed up, scaled by AWS — you never touch a member), certified conformant, exposed through an endpoint that can be public, private, or both. You pay <strong>per cluster-hour (~0.10 USD, ~73 USD/month)</strong> regardless of size, plus your data plane. The control plane lives in an AWS-owned VPC; it reaches your nodes through cross-account ENIs that AWS provisions into your subnets — that is the piece webhooks and aggregated API servers traverse, and why "control plane cannot reach webhook" incidents are usually a security-group rule on those ENIs.</p>

<div class="callout war">The endpoint-access trap: flipping the API endpoint to private-only breaks every kubectl user and CI runner outside the VPC, immediately. The common production posture is public+private with the public side CIDR-allowlisted, or private-only plus VPN/SSM tunneling — decided <em>before</em> the cluster hosts anything important, because changing it is disruptive.</div>

<h3>Three data planes</h3>
<table>
<thead><tr><th></th><th>Managed node groups</th><th>Self-managed nodes</th><th>Fargate profiles</th></tr></thead>
<tbody>
<tr><td>You manage</td><td>Instance types, AMI choice (or default), upgrade timing</td><td>Everything: ASG, AMI, bootstrap, drain logic</td><td>Nothing below the pod</td></tr>
<tr><td>AWS manages</td><td>ASG lifecycle, cordon+drain on upgrade, AMI builds</td><td>Nothing</td><td>The entire node concept</td></tr>
<tr><td>Fit</td><td>Default for 90% of clusters</td><td>Exotic AMIs, GPU drivers you patch, Bottlerocket customization beyond MNG options</td><td>Spiky/small namespaces, strong isolation, no node ops</td></tr>
</tbody>
</table>
<p><strong>Fargate profiles</strong> select pods by <strong>namespace and optional labels</strong>: any pod matching a profile's selectors is scheduled onto Fargate, <strong>one pod per micro-VM</strong> (same Firecracker-lineage isolation as ECS Fargate). Consequences you must design around: <strong>no daemonsets</strong> apply to those pods (log shipping via sidecar or Fargate's built-in Fluent Bit log router config), pods get scheduled onto capacity that did not exist a moment before (cold-start seconds), and every pod is pinned at its requested size — requests become the bill. Mixed clusters are normal: system controllers on a small managed node group, bursty app namespaces on Fargate.</p>

<h3>Pod IAM: IRSA vs EKS Pod Identity</h3>
<p>Node-instance-role-for-everything is the anti-pattern (every pod inherits the union). The two real mechanisms:</p>
<p><strong>IRSA (IAM Roles for Service Accounts)</strong> — the OIDC path. The cluster exposes an <strong>OIDC issuer</strong>; you register it with IAM as an identity provider. A Kubernetes <strong>service account</strong> gets an annotation (<code>eks.amazonaws.com/role-arn</code>); a mutating webhook injects a projected service-account token into pods using it; the SDK exchanges that JWT for role credentials via <strong>STS AssumeRoleWithWebIdentity</strong>. The role's trust policy pins the OIDC provider, and conditions pin <code>sub</code> to <code>system:serviceaccount:namespace:name</code>. Fully standard OIDC federation — auditable, but ceremony-heavy: per-cluster provider registration, trust policies that embed the cluster's issuer URL, and role reuse across clusters means multi-provider trust policies.</p>
<p><strong>EKS Pod Identity</strong> — the newer, simpler path. An EKS-run <strong>agent</strong> (add-on, runs as a daemonset) serves credentials on a link-local endpoint inside each node; you create an <strong>association</strong> (cluster + namespace + service account → role) via the EKS API — no OIDC provider, no annotation-embedded ARNs, and one role trusts a single static principal (<code>pods.eks.amazonaws.com</code>) so it reuses cleanly across any number of clusters. Constraints: EC2 nodes only (the agent is a daemonset — so <em>not</em> on Fargate pods, where IRSA remains the answer), and no support for the cross-account OIDC tricks IRSA allows.</p>

<div class="callout exam">"Pods need least-privilege access to S3/DynamoDB without granting the node role" → IRSA or Pod Identity; if the option set includes only one, that is the answer. Differentiators the exam probes: OIDC provider + service-account annotation + AssumeRoleWithWebIdentity = IRSA; agent-based, association API, simpler multi-cluster reuse = Pod Identity; pods on <strong>Fargate</strong> = IRSA only. "Attach the policy to the node instance role" is always the trap option.</div>

<div class="callout deep">Why IRSA works with zero long-lived secrets: the projected token is a JWT signed by the cluster, audience-scoped to sts.amazonaws.com, auto-rotated by kubelet (~hourly), and readable only by the pod it was projected into. STS validates the signature against the cluster's published JWKS via the registered OIDC provider. It is the same web-identity federation flow GitHub Actions uses for keyless AWS deploys — one mental model, two products.</div>

<h3>Upgrades: the treadmill is the product's price</h3>
<p>Kubernetes minors release ~3x/year; EKS supports each under <strong>standard support for ~14 months</strong>, then <strong>extended support for 12 more at a several-fold per-cluster-hour premium</strong>, then force-upgrades you. Upgrade order is fixed: control plane one minor at a time (no skipping), then nodes (managed node groups do rolling cordon+drain for you), then add-ons, with version-skew rules bounding how far kubelet may trail the API server. Budget several upgrade cycles per year forever — this recurring toil is the honest line-item difference between EKS and ECS, where the control-plane contract simply never surfaces to you.</p>

<div class="callout limits">Anchor numbers: ~0.10 USD/cluster-hour (~73 USD/month) per cluster; standard support ~14 months per minor, extended +12 months at premium pricing; control-plane upgrades are one minor at a time and irreversible (no downgrade); Fargate pods: one pod per VM, sized by requests, no daemonsets, no GPUs, IRSA-only for pod IAM.</div>
`
    },
    {
      id: "eks-ops",
      title: "EKS in operation: load balancing, VPC CNI, Karpenter vs Cluster Autoscaler",
      html: `
<p>An EKS cluster is only as good as its integrations, and three of them do the heavy lifting: the AWS Load Balancer Controller for ingress, the VPC CNI for pod networking, and an autoscaler for nodes. Each has failure modes the exam and production both care about.</p>

<h3>AWS Load Balancer Controller</h3>
<p>The in-tree cloud provider's legacy behavior (Service type LoadBalancer → Classic LB) is dead weight; the <strong>AWS Load Balancer Controller</strong> is the real integration. Two reconciliation paths:</p>
<ul>
<li><strong>Ingress → ALB</strong>: an Ingress (class <code>alb</code>) materializes an ALB with listeners/rules from your Ingress spec, plus annotations for the AWS-specific surface (scheme, certs, WAF, target-group attributes). IngressGroup annotations let many Ingresses share one ALB — the difference between paying for 1 ALB and 40.</li>
<li><strong>Service type LoadBalancer → NLB</strong>: with the right annotations the controller provisions an NLB for L4/TCP/static-EIP needs.</li>
</ul>
<p><strong>Target mode</strong> is the concept worth understanding deeply. <strong>Instance mode</strong> targets node NodePorts and lets kube-proxy bounce traffic to a pod — an extra hop, and possibly an extra node crossing. <strong>IP mode</strong> targets <em>pod IPs directly</em>, which the VPC CNI makes routable (below): fewer hops, real client-IP semantics, honest per-pod health checks — and it is the <em>only</em> mode for Fargate pods, which have no NodePort to target. Default to IP mode.</p>

<h3>VPC CNI: pods are VPC citizens — and that has a price</h3>
<p>The <strong>VPC CNI</strong> gives every pod a real VPC IP from your subnets (secondary IPs on node ENIs) — no overlay, no encapsulation. Security groups can apply per pod (pod-SG feature), flow logs see pod traffic natively, and ALB IP-mode targeting works because pod IPs are just... IPs. The cost is the war story every large EKS shop owns:</p>

<div class="callout war"><strong>IP exhaustion.</strong> An m5.4xlarge can hold dozens of pods, each burning a subnet IP; a few big node groups in /24 subnets and one morning the scheduler is happily binding pods that the CNI cannot plumb — pods stuck in ContainerCreating with "failed to assign an IP address". Fixes, in escalating order: (1) <strong>prefix delegation</strong> — the CNI attaches /28 prefixes per ENI slot instead of single IPs, multiplying density ~16x from the same ENI budget and raising max pods per node; (2) carve pod subnets from a <strong>secondary VPC CIDR</strong> (100.64.0.0/10 is the customary choice) via custom networking, keeping RFC1918 space for everything else; (3) plan /22s or larger for pod subnets from day one. Also know: the CNI keeps a warm pool of pre-attached IPs per node for pod-start latency (WARM_IP_TARGET and friends) — that warm pool <em>accelerates</em> exhaustion at fleet scale.</div>

<p>The other managed add-ons round out the baseline: <strong>CoreDNS</strong> (cluster DNS — under-replicated CoreDNS is the classic cause of cluster-wide "intermittent" resolution latency), <strong>kube-proxy</strong>, and the <strong>EBS CSI driver</strong> (required for gp3 PVCs since in-tree removal — a fresh cluster without it fails PVC binding, a rite of passage) plus <strong>EFS CSI</strong> for ReadWriteMany and Fargate-compatible persistence. Managed add-ons give you versioned, EKS-API-upgradable copies of all of these; keep them on the managed path so cluster upgrades do not strand you on stale CNI builds.</p>

<h3>Cluster Autoscaler vs Karpenter</h3>
<p><strong>Cluster Autoscaler (CA)</strong> is the classic loop: pending pods → find an ASG whose instance type would fit them → increment desired capacity → wait for the node. Its constraints are structural: it thinks in <em>node groups</em>, so each is one instance type (or a compatible set), scaling granularity is whole ASG increments, and reaction time stacks ASG latency on top of its scan interval. Heterogeneous workloads force you to pre-provision a zoo of node groups and keep their sizes right by hand.</p>
<p><strong>Karpenter</strong> deletes the ASG middleman. It watches unschedulable pods and calls EC2 Fleet <em>directly</em>, choosing from hundreds of instance types the cheapest/best-fitting shape for the actual pending pods (true bin-packing at provisioning time), launching in tens of seconds. Its config object — the <strong>NodePool</strong> (formerly Provisioner) — declares constraints (architectures, capacity types including Spot, instance families, limits) rather than fixed groups. And <strong>consolidation</strong> runs continuously: Karpenter notices that the fleet's pods would fit on fewer/cheaper nodes, then drains and replaces them — active cost optimization CA simply does not attempt. Why Karpenter wins: seconds-not-minutes scale-up, no node-group sprawl, flexible Spot diversification, and consolidation typically cutting 15-30% of node spend. What it costs you: newer operational surface, and its aggressive node churn requires your workloads to tolerate eviction properly (PodDisruptionBudgets stop being optional hygiene).</p>

<div class="callout exam">Mappings: "pods pending, scale nodes automatically, diverse instance types, minimize cost and provisioning time" → Karpenter. "ASG-based node scaling" → Cluster Autoscaler. "Expose Kubernetes app via ALB with path routing" → AWS Load Balancer Controller, Ingress, and remember Fargate pods force <strong>IP target mode</strong>. "Pods cannot get IPs / subnet exhausted" → prefix delegation or secondary CIDR — the trap option is "use a bigger instance type", which changes nothing about subnet math.</div>

<h3>When EKS over ECS</h3>
<p>Choose <strong>EKS</strong> when the requirement names Kubernetes: portability/multi-cloud or on-prem parity (EKS Anywhere/hybrid), an ecosystem dependency (Helm charts, operators, Istio/Argo/CRD-based platforms), or an org that already staffs K8s expertise. Choose <strong>ECS</strong> when the requirement is "run containers on AWS with the least operational surface": no control-plane fee, no upgrade treadmill, IAM-native, and deep-enough integration for almost any single-cloud service architecture. The honest framing for a senior audience: EKS buys optionality and ecosystem with a permanent ops tax (upgrades, add-on lifecycles, autoscaler care); ECS sells you AWS lock-in at a steep operational discount. The exam encodes exactly this: <em>"open-source orchestration / portability / existing Kubernetes"</em> → EKS; <em>"simplest / least management overhead / AWS-native"</em> → ECS on Fargate.</p>

<div class="callout limits">Retain: VPC CNI prefix delegation = /28 prefixes per ENI IP slot (~16x density); default max-pods on a m5.large without prefix delegation is 29; Karpenter node launch is typically under a minute vs several for CA+ASG; one ALB can front many Ingresses via IngressGroup; EBS CSI add-on is mandatory for EBS-backed PVCs on current EKS versions.</div>
`
    },
    {
      id: "decision",
      title: "App Runner, Batch, and the container decision framework",
      html: `
<p>Two more services complete the container portfolio, and then the real exam skill: routing any scenario to the right compute in under thirty seconds.</p>

<h3>App Runner: source-to-URL, and that is the point</h3>
<p><strong>App Runner</strong> is AWS's Heroku-shaped PaaS: give it a container image (ECR) or a source repo (GitHub, with a managed build), and it returns a TLS-terminated public HTTPS URL with load balancing, auto scaling, and deployments handled — no VPC to design, no ALB to provision, no cluster anywhere in sight. Under the covers it runs on Fargate-class infrastructure, but none of that surface is yours to manage.</p>
<p>The pricing model is its most interesting design decision: instances scale on <strong>concurrent requests</strong> (default ~100 concurrent per instance, configurable), and an idle instance drops to a <strong>provisioned</strong> state where you pay only for its <strong>memory</strong>, not CPU — an "almost scale-to-zero". Traffic arriving at a provisioned instance resumes full <strong>active</strong> (CPU+memory) billing with no Lambda-style cold start. So the cost curve sits between Lambda (true zero, per-request) and an always-on Fargate service (full price 24/7). Outbound access into your VPC is possible via a VPC connector (Hyperplane ENIs into your subnets); <em>inbound</em> is the public URL or a private endpoint.</p>
<p><strong>Fits:</strong> web apps and APIs, small teams, prototypes-to-modest-production, anything where "we do not want to know what a target group is" is a stated goal. <strong>Does not fit:</strong> non-HTTP protocols (it fronts web traffic only), long-running background workers, fine-grained networking/deployment control, sidecar patterns, very high or very cost-sensitive steady scale — all of which push you back to ECS/Fargate.</p>

<h3>AWS Batch: the scheduler you should not rebuild</h3>
<p><strong>AWS Batch</strong> is a managed batch scheduler layered <em>on top of</em> ECS (and EKS, and Fargate): you submit <strong>jobs</strong> (container + vCPU/memory + retries + timeout) to <strong>job queues</strong> (priority-ordered), and Batch drives <strong>compute environments</strong> — managed pools of EC2 on-demand, <strong>EC2 Spot</strong> (with allocation strategies like SPOT_CAPACITY_OPTIMIZED and automatic retry-on-reclaim), or Fargate — scaling them from zero to your max vCPUs and back to zero when queues drain. Three features justify it over hand-rolled ECS scheduled tasks:</p>
<ul>
<li><strong>Array jobs</strong> — one submission fans out to up to 10,000 indexed child jobs (each sees AWS_BATCH_JOB_ARRAY_INDEX) — embarrassingly parallel sweeps without your own fan-out code.</li>
<li><strong>Dependencies</strong> — jobs can depend on other jobs (or whole arrays, or same-index N-to-N chains), giving you DAG-ish pipelines.</li>
<li><strong>Queue economics</strong> — priority queues over shared Spot pools, automatic bin-packing of jobs onto instances, scale-to-zero so an empty queue costs nothing.</li>
</ul>
<p>Rule of thumb: <strong>one container on a cron</strong> → EventBridge Scheduler + ECS run-task; <strong>thousands of queued, prioritized, retryable, Spot-friendly jobs</strong> → Batch. The keywords "job queue", "array of 1,000 simulations", "nightly genomics/rendering/risk pipeline on Spot" are Batch, every time.</p>

<h3>The decision framework</h3>
<table>
<thead><tr><th></th><th>Lambda</th><th>App Runner</th><th>ECS Fargate</th><th>ECS EC2</th><th>EKS</th><th>Batch</th></tr></thead>
<tbody>
<tr><td>Unit</td><td>Function</td><td>Web service</td><td>Task</td><td>Task</td><td>Pod</td><td>Job</td></tr>
<tr><td>Max duration</td><td>15 min</td><td>Request-scoped</td><td>Unbounded</td><td>Unbounded</td><td>Unbounded</td><td>Unbounded</td></tr>
<tr><td>Scale to zero</td><td>Yes</td><td>Nearly (memory-only idle)</td><td>No (min tasks)</td><td>No</td><td>No</td><td>Yes (empty queue)</td></tr>
<tr><td>Infra you manage</td><td>None</td><td>None</td><td>Task defs, VPC</td><td>+ instances/AMIs</td><td>+ cluster lifecycle</td><td>Queue/CE config</td></tr>
<tr><td>GPUs</td><td>No</td><td>No</td><td>No</td><td>Yes</td><td>Yes (nodes)</td><td>Yes (EC2 CE)</td></tr>
<tr><td>Pricing dimension</td><td>Requests + GB-s</td><td>Active vCPU+mem, idle mem</td><td>vCPU+GB seconds</td><td>EC2 hours</td><td>Cluster fee + nodes</td><td>Underlying compute</td></tr>
</tbody>
</table>

<div class="callout exam">Keyword → answer, the compressed table to walk in with:
<ul>
<li>"Event-driven, sub-15-minute, no infrastructure management" → <strong>Lambda</strong>.</li>
<li>"Existing container image, simplest possible web deployment, small team" → <strong>App Runner</strong>.</li>
<li>"Simplest AWS-native container orchestration / least operational overhead for services" → <strong>ECS on Fargate</strong>.</li>
<li>"Kubernetes required / portability / existing Helm charts / avoid vendor lock-in" → <strong>EKS</strong>.</li>
<li>"GPU containers / privileged / per-host daemons / dense cost-optimized packing" → <strong>ECS on EC2</strong> (or EKS with GPU nodes if K8s is stipulated).</li>
<li>"Large-scale queued/array/dependent jobs, Spot, scale to zero between runs" → <strong>AWS Batch</strong>.</li>
<li>"Interruption-tolerant service burst at minimum cost on ECS" → <strong>FARGATE_SPOT in a capacity provider strategy</strong>.</li>
</ul></div>

<div class="callout war">The framework fails when teams pick on ideology instead of constraints. Two real patterns: the three-person startup that adopted EKS "for hiring optics" and spent a fifth of its engineering time on upgrade toil that ECS would have made zero; and the Lambda-everything shop that hit the 15-minute wall on a video pipeline and bolted on step-function chunking gymnastics when one Fargate task definition would have done it. Constraints first: duration, GPUs, protocol, portability mandate, team size. The service falls out.</div>

<div class="callout deep">Notice what is actually being compared: not container runtimes (it is containerd more or less everywhere) but <strong>control planes and billing shapes</strong>. Lambda bills invocation-shaped, App Runner concurrency-shaped, Fargate task-shaped, EC2/EKS capacity-shaped, Batch queue-shaped. Match the billing shape to the workload's natural shape and the architecture is usually right; mismatch it and you either pay for idle or fight the platform's grain forever.</div>

<div class="callout limits">Final numbers sweep: Lambda hard cap 15 min / 10 GB memory; App Runner default ~100 concurrent requests per instance, idle = memory-only billing; Fargate 16 vCPU / 120 GB / 200 GiB ephemeral max; EKS ~73 USD/month/cluster; Batch array jobs to 10,000 children; Fargate Spot ECS-only with 2-minute interruption warning.</div>
`
    }
  ],
  quiz: [
    {
      q: "A company runs ECS tasks on Fargate in private subnets with no NAT gateway. Interface VPC endpoints exist for ecr.api and ecr.dkr, with private DNS enabled. New tasks fail with CannotPullContainerError after authentication succeeds. What is the most likely cause?",
      options: [
        "The task execution role is missing the ecr:GetAuthorizationToken permission",
        "There is no S3 gateway endpoint, so image layer downloads from ECR's S3-backed storage fail",
        "The ECR repository has tag immutability enabled, which blocks pulls from private subnets",
        "Fargate requires a NAT gateway for all image pulls regardless of VPC endpoints",
        "The tasks must use bridge networking mode to reach interface endpoints"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> ECR stores image layer blobs in S3 and serves them via presigned redirects. The ecr.api and ecr.dkr endpoints cover auth and manifest operations, but layer downloads go to S3 — without an S3 gateway endpoint on the route table, pulls fail exactly at this stage (after auth works). <strong>A</strong> is wrong because authentication is stated to succeed; a missing GetAuthorizationToken permission fails earlier and with an auth error. <strong>C</strong> is wrong — tag immutability only blocks re-pushing an existing tag; it has no effect on pulls. <strong>D</strong> is wrong — the whole point of the three-endpoint pattern (ecr.api + ecr.dkr + S3 gateway) is pulling with no NAT or internet path. <strong>E</strong> is wrong — Fargate only supports awsvpc mode, and awsvpc tasks reach interface endpoints fine; networking mode is not the issue.</p>"
    },
    {
      q: "An ECS service on Fargate starts tasks successfully, but the application receives AccessDenied errors when writing objects to an S3 bucket. The task execution role has AmazonECSTaskExecutionRolePolicy attached. What should the architect do?",
      options: [
        "Add s3:PutObject permissions to the task execution role",
        "Add s3:PutObject permissions to a task role and set it in the task definition",
        "Attach an S3 access policy to the Fargate instance profile",
        "Enable ECS Exec on the service so tasks inherit the operator's permissions",
        "Create a VPC gateway endpoint for S3 to bypass IAM authorization"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> Application code gets AWS credentials from the <em>task role</em> via the container credential endpoint; the <em>execution role</em> is used only by ECS/Fargate plumbing (pulling the image, writing logs, fetching injected secrets) before and around your code. Runtime AccessDenied from the app means the task role is missing or under-permissioned. <strong>A</strong> is the classic trap: adding S3 permissions to the execution role does nothing for the application, because the SDK never receives execution-role credentials. <strong>C</strong> is wrong — Fargate has no instance and no instance profile you can touch. <strong>D</strong> is wrong — ECS Exec is an interactive debugging channel; it does not change task credentials. <strong>E</strong> is wrong — a gateway endpoint changes the network path, not authorization; IAM still evaluates the same (missing) permissions.</p>"
    },
    {
      q: "A CI/CD pipeline pushes hundreds of images per week to an ECR repository. Storage costs are growing, mostly from superseded images. Old release images must remain available for rollback, but only the 30 most recent per release prefix are needed, and untagged images have no value after a week. What is the most operationally efficient solution?",
      options: [
        "Create an EventBridge scheduled rule that invokes a Lambda function to list and delete old images",
        "Configure an ECR lifecycle policy with a rule expiring untagged images after 7 days and a rule keeping only the 30 most recent images per release tag prefix",
        "Enable cross-region replication so old images move to a cheaper region",
        "Enable tag immutability so superseded tags are automatically removed",
        "Migrate the repository to ECR Public, which does not bill for storage"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> This is precisely what ECR lifecycle policies exist for: JSON rules combining tagStatus (untagged vs tagged with a prefix filter) with sinceImagePushed (age) and imageCountMoreThan (retain newest N), evaluated automatically per repository with no code to run or maintain. <strong>A</strong> works but is strictly more operational burden — custom code, IAM, error handling — to reimplement a native feature; on 'most operationally efficient' questions the managed feature wins. <strong>C</strong> misunderstands replication: it copies images on push (adding cost), it does not tier or move old data. <strong>D</strong> misstates immutability: it prevents re-pushing an existing tag and deletes nothing. <strong>E</strong> is wrong on both counts — ECR Public is for public distribution, not private CI images, and moving there for cost reasons is not a real pattern.</p>"
    },
    {
      q: "An ECS service must run 4 tasks at all times for baseline availability, and scale to 20 tasks during peaks. The company wants the burst capacity at the lowest possible cost and can tolerate interruption of burst tasks with a short warning. Which configuration meets this?",
      options: [
        "Launch type FARGATE with a scheduled scaling action to 20 tasks",
        "A capacity provider strategy with FARGATE base 4 weight 0 and FARGATE_SPOT base 0 weight 1",
        "A capacity provider strategy with FARGATE_SPOT base 4 weight 1 and FARGATE base 0 weight 4",
        "Launch type EC2 with Reserved Instances for 4 instances and Spot Instances for the rest",
        "Two separate services, one on FARGATE and one on FARGATE_SPOT, behind different load balancers"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> Base 4 on FARGATE guarantees the first 4 tasks always run on on-demand capacity (the availability floor); weight 0 on FARGATE vs weight 1 on FARGATE_SPOT sends all tasks beyond the base to Spot at roughly 70% discount, with the documented 2-minute interruption warning. <strong>A</strong> ignores the cost requirement entirely — all 20 peak tasks run at on-demand pricing. <strong>C</strong> inverts the design: the guaranteed baseline would sit on interruptible Spot capacity, so an interruption wave could take the service below 4 tasks — the exact outcome the requirement forbids. <strong>D</strong> could be made to work but adds AMI patching, capacity management, and RI planning — far more moving parts than the native capacity provider strategy, and the scenario has no EC2-specific requirement (no GPU, no daemons). <strong>E</strong> doubles the operational surface (two services, two scaling policies, traffic-splitting complexity) to approximate what base/weight expresses in four lines.</p>"
    },
    {
      q: "Which TWO workload requirements would disqualify Fargate and require the ECS EC2 launch type? (Select TWO.)",
      options: [
        "The workload requires GPU acceleration for ML inference",
        "The workload needs tasks to receive their own elastic network interface",
        "A per-host monitoring agent must run as a daemon service on every host",
        "Containers must retrieve secrets from AWS Secrets Manager at startup",
        "Tasks must run in private subnets without public IP addresses"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<p><strong>A and C are correct.</strong> Fargate does not offer GPU task support — GPU container workloads need the EC2 launch type with GPU instances (or EKS GPU nodes). Daemon-strategy services require addressable hosts, and Fargate has no host concept exposed to you — per-host agents become per-task sidecars instead, so a hard 'daemon on every host' requirement forces EC2. <strong>B</strong> is the opposite of a disqualifier: Fargate tasks always use awsvpc mode and always get their own ENI. <strong>D</strong> works identically on Fargate — the execution role fetches Secrets Manager/SSM values and injects them at container start. <strong>E</strong> is fully supported on Fargate: private subnets with VPC endpoints or NAT for egress is the standard production pattern.</p>"
    },
    {
      q: "A payments team deploying on ECS behind an ALB must validate each new version against production-like traffic on a separate listener port, then shift 10 percent of user traffic, wait, and shift the remainder, with automatic rollback if CloudWatch alarms fire during the shift. Which deployment approach satisfies this?",
      options: [
        "ECS rolling update with minimumHealthyPercent 100 and maximumPercent 200",
        "ECS rolling update with the deployment circuit breaker and rollback enabled",
        "Blue/green deployment through CodeDeploy with a test listener and a canary traffic-shift configuration",
        "Two ECS services with Route 53 weighted records shifted manually",
        "An ECS scheduled task that swaps the ALB target group at a maintenance window"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>C is correct.</strong> Only the CodeDeploy blue/green controller provides all three named capabilities: a <em>test listener</em> routing to the green task set before production traffic (with lifecycle hooks that can veto), <em>canary</em> traffic shifting (10 percent, bake, then complete), and alarm-driven automatic rollback mid-shift by flipping listeners back to blue. <strong>A</strong> controls surge/floor capacity during a rolling replacement but has no traffic-shifting, no test listener, and no alarm-based rollback. <strong>B</strong> adds rollback, but only on task-launch/health failure — it cannot shift percentages of traffic or expose a validation port. <strong>D</strong> approximates canary at the DNS layer but is manual, subject to client DNS caching, and has no pre-production test listener or automated alarm rollback. <strong>E</strong> is an all-at-once cutover with downtime risk and none of the required safeguards.</p>"
    },
    {
      q: "An ECS cluster on EC2 runs many small awsvpc-mode tasks. Instances show low CPU and memory utilization, yet task placement fails with insufficient resources. What should the architect do to increase task density per instance?",
      options: [
        "Enable ENI trunking with the awsvpcTrunking account setting on supported instance types",
        "Switch the tasks to host networking mode to eliminate ENI usage",
        "Increase the memoryReservation of each container definition",
        "Add a binpack placement strategy on memory",
        "Migrate the service to Fargate where ENI limits do not apply"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct.</strong> In awsvpc mode each task consumes an ENI, and standard per-instance ENI limits are tiny (a c5.large fits only 2 tasks). ENI trunking attaches a trunk interface and multiplexes branch ENIs, raising density to tens or hundreds of tasks per instance — exactly the fix for 'plenty of CPU/memory, but placement fails'. <strong>B</strong> would remove the ENI constraint but destroys the per-task security group model and creates host port conflicts — a regression, not a fix, and the question implies keeping awsvpc semantics. <strong>C</strong> makes it worse: higher reservations reduce how many tasks fit by the scheduler's math. <strong>D</strong> changes which instance is preferred but cannot exceed the per-instance ENI ceiling that is causing the failures. <strong>E</strong> dodges the question — it may be a valid architecture change, but it abandons the EC2 cluster rather than increasing its density, and Fargate tasks still consume subnet IPs.</p>"
    },
    {
      q: "On an Amazon EKS cluster, pods in the namespace analytics must read from a specific DynamoDB table with least privilege. Some of these pods run on Fargate profiles. The security team prohibits granting DynamoDB access to node instance roles. Which solution meets the requirements?",
      options: [
        "Enable EKS Pod Identity associations mapping the analytics service account to an IAM role",
        "Create an IAM OIDC provider for the cluster and use IAM Roles for Service Accounts with an annotated service account",
        "Attach the DynamoDB policy to the Fargate pod execution role",
        "Store IAM user access keys in a Kubernetes Secret and mount them into the pods",
        "Use kube2iam to intercept the instance metadata endpoint on each node"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> IRSA works on every EKS compute type including Fargate: the cluster's OIDC issuer is registered with IAM, the service account is annotated with a role ARN, and pods exchange a projected JWT for role credentials via STS AssumeRoleWithWebIdentity — per-service-account least privilege with no node-role grants. <strong>A</strong> fails the Fargate detail: EKS Pod Identity relies on a node-level agent daemonset, which cannot run on Fargate — Fargate pods must use IRSA. <strong>C</strong> confuses roles: the Fargate pod execution role is the plumbing identity (image pull, logs), and granting it app permissions gives every pod on every matching profile that access — not least privilege. <strong>D</strong> is long-lived static credentials in cluster storage — the anti-pattern all of this machinery exists to eliminate. <strong>E</strong> is a third-party daemonset workaround from the pre-IRSA era; it also cannot run on Fargate and is not the AWS-supported answer.</p>"
    },
    {
      q: "A company runs EKS with several managed node groups, each pinned to one instance type. Scaling out takes minutes, and utilization is poor because node group sizes rarely match pod demand. The company wants faster node provisioning, automatic selection from many instance types including Spot, and continuous consolidation onto cheaper nodes. What should they adopt?",
      options: [
        "Kubernetes Cluster Autoscaler with additional node groups per instance type",
        "Karpenter with NodePools defining allowed instance families and capacity types",
        "Horizontal Pod Autoscaler with more aggressive target utilization",
        "EKS Fargate profiles for all namespaces",
        "An EventBridge rule that adjusts node group desired size on a schedule"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> Karpenter is purpose-built for every stated requirement: it bypasses ASGs and calls EC2 Fleet directly (nodes in tens of seconds), selects the best-fitting shape from hundreds of instance types per its NodePool constraints (including Spot diversification), and its consolidation loop actively drains and replaces nodes when pods would fit on fewer or cheaper ones. <strong>A</strong> is the incumbent being described in the problem statement: more node groups multiplies the management burden, and CA neither picks instance types dynamically nor consolidates for cost. <strong>C</strong> scales <em>pods</em>, not nodes — orthogonal to slow node provisioning. <strong>D</strong> removes nodes entirely but fails the requirements sideways: Fargate has no Spot for EKS, per-pod pricing is typically higher than well-packed Spot nodes, and daemonset-dependent tooling breaks. <strong>E</strong> is scheduled guessing, not demand-driven provisioning, and does nothing for instance-type selection or consolidation.</p>"
    },
    {
      q: "Pods on a large EKS cluster using the VPC CNI are stuck in ContainerCreating with errors indicating no available IP addresses, although nodes have spare CPU and memory. The VPC's subnets are /24s and cannot be resized. Which TWO actions directly address the problem? (Select TWO.)",
      options: [
        "Enable prefix delegation so ENIs receive /28 prefixes instead of individual secondary IPs",
        "Associate a secondary CIDR block with the VPC and use CNI custom networking to place pods in new larger subnets",
        "Switch the CNI to instance target mode in the AWS Load Balancer Controller",
        "Increase the node instance size so each node supports more ENIs",
        "Reduce CoreDNS replicas to free IP addresses"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>A and B are correct.</strong> Prefix delegation changes the CNI's allocation unit from single IPs to /28 prefixes per ENI slot, multiplying addressable pods per node roughly 16x from the same ENI budget — but the addresses still come from the subnets, so with exhausted /24s the companion fix matters: a secondary VPC CIDR (commonly from 100.64.0.0/10) with CNI custom networking moves pod addressing into new, large, dedicated subnets. Together they solve both density and address supply. <strong>C</strong> confuses layers — target mode is a load balancer routing concept and allocates no IPs. <strong>D</strong> is the trap: bigger instances support more ENIs and thus more pods per node, which makes the fleet consume the exhausted subnets <em>faster</em>; the constraint is subnet address space, not per-node capability. <strong>E</strong> frees a couple of IPs while degrading cluster DNS — noise against a fleet-scale shortage.</p>"
    },
    {
      q: "A research team needs to run about 5,000 independent, containerized simulation tasks nightly. Each takes 20 to 90 minutes. Runs must use Spot capacity where possible, retry interrupted work automatically, respect a priority order between projects, and cost nothing between runs. Which service best fits?",
      options: [
        "ECS scheduled tasks launched by EventBridge Scheduler on Fargate",
        "AWS Batch with a Spot compute environment, priority job queues, and array jobs",
        "AWS Lambda with reserved concurrency of 5000",
        "An EKS cluster with a CronJob and Cluster Autoscaler",
        "App Runner services scaled up on a schedule"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> Every requirement maps to a Batch primitive: array jobs fan one submission into thousands of indexed children; Spot compute environments with capacity-optimized allocation plus automatic retry handle interruption; priority-ordered job queues arbitrate between projects; and compute environments scale to zero when queues empty. <strong>A</strong> handles the cron part but nothing else — you would hand-build fan-out, retries, prioritization, and Spot management around run-task calls, reimplementing Batch. <strong>C</strong> is eliminated by duration alone: 20-90 minute tasks blow through Lambda's 15-minute maximum. <strong>D</strong> can be assembled into this (CronJob, Karpenter or CA, a queue), but it is a self-managed build with a monthly control-plane fee and upgrade toil, against a scenario stating no Kubernetes requirement — weak on both cost and operational effort. <strong>E</strong> misuses App Runner, which is a request-driven web service platform, not a batch executor; there is no job semantics at all.</p>"
    },
    {
      q: "A startup of four engineers has a containerized REST API in an ECR repository. They want a public HTTPS endpoint with automatic scaling and deployments, refuse to manage load balancers, clusters, or VPC networking, and want costs to fall close to zero during idle overnight hours while avoiding multi-second cold starts. Which service is the best fit?",
      options: [
        "ECS on Fargate behind an Application Load Balancer",
        "AWS App Runner deploying directly from the ECR image",
        "AWS Lambda with a function URL and a container image",
        "EKS with Fargate profiles and the AWS Load Balancer Controller",
        "EC2 with Docker Compose behind an Auto Scaling group"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> App Runner is precisely this product: point it at an ECR image, receive a managed HTTPS URL with load balancing, request-concurrency auto scaling, and rolling deployments — no ALB, cluster, or VPC design. Idle instances drop to provisioned state billed for memory only (near-zero overnight cost), and resume without Lambda-style cold starts. <strong>A</strong> works but violates the stated refusals: you design the VPC, provision and pay for the ALB 24/7, and manage the service/task plumbing. <strong>C</strong> gets to near-zero idle cost but reintroduces the cold-start problem the team explicitly excluded, plus the 15-minute execution model constraints for anything long-lived. <strong>D</strong> is maximal machinery for a four-person team — control-plane fee, upgrade cadence, controller management — with zero Kubernetes requirement in the scenario. <strong>E</strong> is the most operationally expensive option listed and scales to zero not at all.</p>"
    },
    {
      q: "Builds across a company intermittently fail because Docker Hub rate-limits anonymous pulls of common base images. Security also wants all images used in production to be served from a registry they control and scanned continuously as new CVEs are published. Which combination meets both needs with the least ongoing effort?",
      options: [
        "Configure an ECR pull-through cache rule for Docker Hub and enable enhanced scanning with Amazon Inspector",
        "Mirror base images manually to ECR with a nightly pipeline and enable basic scanning on push",
        "Pay for Docker Hub Pro accounts on every CI runner and scan with a third-party tool",
        "Use ECR Public as the upstream for all base images since it has no rate limits",
        "Build all base images from scratch in CodeBuild to avoid external registries"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct.</strong> A pull-through cache rule makes ECR fetch and cache upstream images on first pull (Docker Hub credentials held in Secrets Manager), so builds pull from your private, IAM-controlled registry — no rate limits, no manual mirroring. Enhanced scanning hands scanning to Amazon Inspector, which continuously re-evaluates stored images as new CVEs publish, meeting the 'scanned continuously' requirement that basic scanning cannot (it scans on push or on demand only). <strong>B</strong> is standing toil — a pipeline to maintain — and basic scanning fails the continuous requirement. <strong>C</strong> treats the symptom with recurring per-seat cost and leaves images served from a registry the company does not control. <strong>D</strong> helps only for images that exist on ECR Public and still is not the company's own registry; it also does nothing for Docker-Hub-only images. <strong>E</strong> is an enormous ongoing engineering commitment wildly disproportionate to the problem.</p>"
    },
    {
      q: "An ECS service with desiredCount 10 on a memory-constrained EC2 cluster must deploy new task definition revisions without ever exceeding current cluster capacity, accepting a temporary reduction in running tasks instead. Which deployment configuration achieves this?",
      options: [
        "minimumHealthyPercent 100 and maximumPercent 200",
        "minimumHealthyPercent 50 and maximumPercent 100",
        "minimumHealthyPercent 0 and maximumPercent 200",
        "Enable the deployment circuit breaker with rollback",
        "Use a daemon service so ECS replaces tasks one host at a time"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> maximumPercent 100 forbids surging above desiredCount, so ECS must stop old tasks before starting replacements — no extra capacity is ever needed. minimumHealthyPercent 50 permits dipping to 5 running tasks during the swap, which the scenario explicitly accepts. <strong>A</strong> is the start-then-stop pattern: it surges to up to 20 tasks, requiring spare cluster capacity the scenario says does not exist — the deployment would hang in PENDING. <strong>C</strong> also allows a 200 percent surge (the ceiling is the problem here, not the floor), and a floor of 0 needlessly permits total outage. <strong>D</strong> is orthogonal: the circuit breaker detects and rolls back failed deployments; it does not govern capacity usage during healthy ones. <strong>E</strong> misapplies daemon scheduling, which runs exactly one task per instance for host-agent workloads — it cannot express a 10-task replica service at all.</p>"
    },
    {
      q: "Microservices on ECS Fargate call each other by name. The team needs automatic retries on failed connections, immediate removal of draining tasks from the endpoint list, and per-route latency and error metrics in CloudWatch, all without changing application code. External EC2-based clients outside the cluster do not need to resolve these names. What should the architect configure?",
      options: [
        "ECS Service Discovery with Cloud Map and a 10 second DNS TTL",
        "ECS Service Connect with a shared namespace across the services",
        "An internal Application Load Balancer per microservice",
        "AWS App Mesh with Envoy sidecars managed manually in each task definition",
        "Route 53 private hosted zone records updated by a Lambda function on task state change"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> Service Connect is exactly this feature set: ECS injects and manages an Envoy sidecar per task, endpoint updates propagate out-of-band (draining tasks leave the pool before dying, no DNS TTL staleness), Envoy provides connection retries and outlier ejection, and per-route traffic metrics land in CloudWatch — all configured on the service, zero app changes. The stated non-requirement (external clients) removes Service Connect's main limitation, since its aliases resolve only inside enrolled tasks. <strong>A</strong> is plain DNS: even at a 10-second TTL, clients cache stale task IPs, and there are no retries or telemetry at all. <strong>C</strong> can provide health-checked routing and metrics but at the cost of an ALB per service — significant standing cost and configuration, and still no client-side retry semantics. <strong>D</strong> could achieve the behavior but App Mesh is deprecated for new adoption and requires hand-managing Envoy in every task definition — the opposite of 'without changes and with least effort'. <strong>E</strong> is a homemade, eventually-consistent reimplementation of option A with more failure modes.</p>"
    }
  ],
  flashcards: [
    { front: "How long is an ECR authorization token valid, and which API issues it?", back: "<strong>12 hours</strong>, from <code>ecr:GetAuthorizationToken</code>. Pipe <code>aws ecr get-login-password</code> into <code>docker login --username AWS --password-stdin</code>. Long-lived CI runners must refresh per job." },
    { front: "Which three VPC endpoints are needed to pull ECR images from private subnets with no NAT?", back: "Interface endpoints for <code>ecr.api</code> and <code>ecr.dkr</code>, plus an <strong>S3 gateway endpoint</strong> — layer blobs are served from S3. Add a CloudWatch Logs endpoint if tasks log." },
    { front: "ECR basic scanning vs enhanced scanning: key differences?", back: "Basic = Clair database, OS packages only, on-push or on-demand, free. Enhanced = <strong>Amazon Inspector</strong>: OS + language packages, <em>continuous</em> rescanning as new CVEs publish, findings to Security Hub/EventBridge, billed per image." },
    { front: "What AWS feature fixes builds failing on Docker Hub rate limits?", back: "ECR <strong>pull-through cache</strong>: a rule per upstream (Docker Hub, ECR Public, Quay, GHCR...). First pull fetches and caches into your private registry; later pulls are local and IAM-authenticated. Upstream credentials live in Secrets Manager." },
    { front: "ECS task execution role vs task role: who uses each?", back: "<strong>Execution role</strong>: ECS agent/Fargate plumbing — ECR pull, CloudWatch Logs, secret injection. Failures stop task <em>startup</em>. <strong>Task role</strong>: application code via the SDK chain (169.254.170.2 endpoint). Failures are runtime AccessDenied." },
    { front: "ECS replica vs daemon scheduling strategy?", back: "<strong>Replica</strong>: keep desiredCount tasks running anywhere placement allows. <strong>Daemon</strong>: exactly one task per container instance (monitoring/log agents) — <em>EC2 launch type only</em>; Fargate has no hosts." },
    { front: "In an ECS capacity provider strategy, what do base and weight mean?", back: "<strong>Base</strong>: how many tasks run on that provider first (only one provider may set it). <strong>Weight</strong>: the ratio for tasks beyond the base. Classic: FARGATE base 2, FARGATE_SPOT weight 3 = guaranteed floor + cheap burst." },
    { front: "What ECS networking mode does Fargate require, and what does each task get?", back: "<strong>awsvpc</strong> — every task gets its own ENI: a VPC IP, its own security groups, its own flow logs. Register with load balancers via <strong>IP target type</strong>." },
    { front: "What is ENI trunking in ECS and when do you need it?", back: "Account setting <code>awsvpcTrunking</code>: a trunk ENI multiplexes branch interfaces so awsvpc task density jumps from a handful to tens or hundreds per EC2 instance. Needed when placement fails with free CPU/memory because ENI slots ran out." },
    { front: "ECS Service Connect: what does it add over Cloud Map service discovery?", back: "ECS-managed <strong>Envoy sidecar</strong> per task: instant endpoint propagation (no DNS TTL staleness), automatic retries and outlier ejection, per-route CloudWatch telemetry, optional TLS. Limitation: aliases resolve only inside enrolled tasks." },
    { front: "Which ECS deployment settings control capacity during a rolling update?", back: "<strong>minimumHealthyPercent</strong> (floor below desiredCount; default 100) and <strong>maximumPercent</strong> (surge ceiling; default 200). max 100 = stop-then-start on tight clusters; min 100/max 200 = surge with no dip." },
    { front: "ECS blue/green via CodeDeploy: what three capabilities distinguish it?", back: "<strong>Test listener</strong> (validate green on a separate port pre-traffic), <strong>canary/linear traffic shifting</strong> between two target groups, and <strong>alarm-triggered instant rollback</strong> by flipping listeners back to blue." },
    { front: "Which ECS placement strategies exist and where do they apply?", back: "<strong>binpack</strong> (fewest instances, by CPU or memory), <strong>spread</strong> (across AZ/instance/attribute), <strong>random</strong> — chainable, EC2 launch type only. Constraints: <strong>distinctInstance</strong>, <strong>memberOf</strong> (cluster query language). None apply on Fargate." },
    { front: "What isolation does a Fargate task have from other tasks?", back: "Each task runs in its own <strong>micro-VM</strong> (Firecracker lineage): dedicated kernel, hardware virtualization boundary. Containers within one task share that kernel and namespace; tasks never share with neighbors." },
    { front: "Fargate sizing and ephemeral storage limits?", back: "0.25 to <strong>16 vCPU</strong>, 0.5 to <strong>120 GB</strong> memory in fixed pairings. Ephemeral storage: <strong>20 GiB free</strong>, expandable to <strong>200 GiB</strong> (billed above 20). Persistent volumes: EFS only." },
    { front: "Name four things Fargate cannot do.", back: "No <strong>daemon services</strong> (no hosts), no <strong>privileged containers</strong> or docker socket, no <strong>GPUs</strong>, kernel access limited (few capabilities/sysctls). Also awsvpc-only networking and the 200 GiB ephemeral cap." },
    { front: "Fargate Spot: which orchestrators support it and what is the interruption contract?", back: "<strong>ECS only</strong> — EKS Fargate has no Spot. About 70% discount; on reclaim you get a <strong>2-minute warning</strong> (SIGTERM + EventBridge task state-change event). Keep an on-demand base via capacity provider strategy." },
    { front: "What do you pay for the EKS control plane, and who runs etcd?", back: "~<strong>0.10 USD per cluster-hour</strong> (~73 USD/month) per cluster. AWS operates multi-AZ API servers and <strong>AWS-managed etcd</strong> — you never see members or backups. Data plane billed separately." },
    { front: "How does IRSA authenticate a pod to AWS?", back: "Cluster OIDC issuer registered in IAM → service account annotated with a role ARN → webhook projects a signed JWT into the pod → SDK calls <strong>STS AssumeRoleWithWebIdentity</strong>. Trust policy pins sub to system:serviceaccount:ns:name." },
    { front: "EKS Pod Identity vs IRSA: when must you still use IRSA?", back: "Pod Identity uses a node <strong>agent daemonset</strong> and an association API (no OIDC provider, easy multi-cluster role reuse) — but daemonsets cannot run on Fargate, so <strong>Fargate pods require IRSA</strong>." },
    { front: "AWS Load Balancer Controller: what do Ingress and Service type LoadBalancer create, and which target mode must Fargate use?", back: "Ingress → <strong>ALB</strong> (IngressGroup shares one ALB across many Ingresses); Service type LoadBalancer → <strong>NLB</strong>. Target modes: instance (NodePort) vs <strong>IP</strong> (pod IPs directly) — Fargate pods support IP mode only." },
    { front: "Why does Karpenter typically beat Cluster Autoscaler?", back: "Calls EC2 Fleet directly (no ASG hop): nodes in tens of seconds; picks the cheapest fitting shape from hundreds of types per <strong>NodePool</strong> constraints incl. Spot; <strong>consolidation</strong> continuously drains onto fewer/cheaper nodes. Requires eviction-tolerant workloads and PDBs." },
    { front: "What are the two fixes for VPC CNI pod IP exhaustion?", back: "<strong>Prefix delegation</strong> (/28 prefixes per ENI slot, ~16x pod density) and <strong>secondary VPC CIDR + CNI custom networking</strong> (pods addressed from new large subnets, often 100.64.0.0/10). Bigger instances alone make it worse." },
    { front: "App Runner pricing when idle: what do you pay?", back: "Idle instances drop to <strong>provisioned</strong> state: billed for <strong>memory only</strong>, no CPU — near scale-to-zero without cold starts. Active instances bill vCPU + memory; scaling is driven by concurrent requests per instance (default ~100)." },
    { front: "When AWS Batch over ECS scheduled tasks?", back: "When you need <strong>job queues with priorities</strong>, <strong>array jobs</strong> (up to 10,000 children), job dependencies/retries, Spot-managed compute environments, and scale-to-zero between runs. One container on a cron = EventBridge Scheduler + run-task." }
  ],
  lab: {
    title: "Lab: push an image to ECR and run it as a Fargate service (then tear it all down)",
    html: `
<h3>Goal</h3>
<p>Exercise the whole chapter end to end from the CLI: create a private ECR repository with immutable tags and scan-on-push, push an nginx image to it, run it as an ECS service on Fargate with awsvpc networking and a public IP, verify it serves traffic, then tear down every billable artifact in the right order.</p>

<h3>Architecture</h3>
<p>One ECR repository holds the image. An ECS cluster (a pure logical namespace on Fargate — it costs nothing empty) runs a service with desiredCount 1 using the FARGATE capacity provider. The task runs in a default-VPC public subnet with its own ENI, a dedicated security group allowing inbound 80, and a public IP so we skip NAT entirely. The task execution role pulls the image and ships logs to a CloudWatch log group; there is no task role because the app calls no AWS APIs. Cost: Fargate 0.25 vCPU / 0.5 GB is about 0.012 USD/hour — real money, only pennies, but only if you complete the Teardown; ECR storage and log ingestion are negligible at this scale.</p>

<h3>Steps</h3>
<ol>
<li><p><strong>Set shell variables.</strong> Everything below reuses these. (Note plain <code>$VAR</code> expansion throughout.)</p>
<pre><code>export AWS_REGION=eu-west-1
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export REPO=lab14-web
export ECR_URI=$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO</code></pre></li>

<li><p><strong>Create the ECR repository</strong> with tag immutability and scan-on-push (both chapter topics, both free at this scale):</p>
<pre><code>aws ecr create-repository --repository-name $REPO \
  --image-tag-mutability IMMUTABLE \
  --image-scanning-configuration scanOnPush=true \
  --region $AWS_REGION</code></pre></li>

<li><p><strong>Authenticate Docker and push an image.</strong> We pull nginx from ECR Public (no Docker Hub rate limits), retag, push. This is the 12-hour token flow from lesson 1:</p>
<pre><code>aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

docker pull public.ecr.aws/nginx/nginx:1.27-alpine
docker tag public.ecr.aws/nginx/nginx:1.27-alpine $ECR_URI:v1
docker push $ECR_URI:v1</code></pre>
<p>Optional proof of immutability: run the tag-and-push of <code>:v1</code> again — the second push fails with ImageTagAlreadyExistsException.</p></li>

<li><p><strong>Create the log group and the task execution role.</strong> The trust policy lets ECS tasks assume the role; the managed policy grants ECR pull + log writes (execution-role concerns only):</p>
<pre><code>aws logs create-log-group --log-group-name /ecs/lab14 --region $AWS_REGION

cat &gt; trust.json &lt;&lt;'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ecs-tasks.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role --role-name lab14-exec-role \
  --assume-role-policy-document file://trust.json
aws iam attach-role-policy --role-name lab14-exec-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy</code></pre></li>

<li><p><strong>Register the task definition.</strong> Task-level cpu/memory picks the smallest Fargate micro-VM (0.25 vCPU / 0.5 GB); nginx is the sole, essential container:</p>
<pre><code>cat &gt; taskdef.json &lt;&lt;EOF
{
  "family": "lab14-web",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::$ACCOUNT_ID:role/lab14-exec-role",
  "containerDefinitions": [{
    "name": "web",
    "image": "$ECR_URI:v1",
    "essential": true,
    "portMappings": [{ "containerPort": 80, "protocol": "tcp" }],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/lab14",
        "awslogs-region": "$AWS_REGION",
        "awslogs-stream-prefix": "web"
      }
    }
  }]
}
EOF

aws ecs register-task-definition --cli-input-json file://taskdef.json \
  --region $AWS_REGION</code></pre></li>

<li><p><strong>Create the cluster, security group, and service.</strong> Grab two default-VPC subnets, open port 80 to your IP only, and launch with a FARGATE capacity provider strategy:</p>
<pre><code>aws ecs create-cluster --cluster-name lab14 \
  --capacity-providers FARGATE FARGATE_SPOT --region $AWS_REGION

export VPC_ID=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true \
  --query 'Vpcs[0].VpcId' --output text --region $AWS_REGION)
export SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC_ID \
  --query 'Subnets[0:2].SubnetId' --output text --region $AWS_REGION | tr '\\t' ',')
export MYIP=$(curl -s https://checkip.amazonaws.com)

export SG_ID=$(aws ec2 create-security-group --group-name lab14-sg \
  --description "lab14 task SG" --vpc-id $VPC_ID \
  --query GroupId --output text --region $AWS_REGION)
aws ec2 authorize-security-group-ingress --group-id $SG_ID \
  --protocol tcp --port 80 --cidr $MYIP/32 --region $AWS_REGION

aws ecs create-service --cluster lab14 --service-name web \
  --task-definition lab14-web --desired-count 1 \
  --capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
  --region $AWS_REGION</code></pre>
<p>Note the security group attaches to the <em>task ENI</em>, not to any instance — there is no instance. That is awsvpc mode doing its job.</p></li>
</ol>

<h3>Verify</h3>
<ol>
<li><p>Wait for the service to reach steady state, then find the task's public IP via its ENI:</p>
<pre><code>aws ecs wait services-stable --cluster lab14 --services web --region $AWS_REGION

export TASK_ARN=$(aws ecs list-tasks --cluster lab14 --service-name web \
  --query 'taskArns[0]' --output text --region $AWS_REGION)
export ENI_ID=$(aws ecs describe-tasks --cluster lab14 --tasks $TASK_ARN \
  --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value" \
  --output text --region $AWS_REGION)
export PUB_IP=$(aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID \
  --query 'NetworkInterfaces[0].Association.PublicIp' --output text --region $AWS_REGION)

curl -s http://$PUB_IP | head -n 4</code></pre>
<p>You should see the nginx welcome-page HTML. Also confirm the scan-on-push results and the log stream:</p>
<pre><code>aws ecr describe-image-scan-findings --repository-name $REPO \
  --image-id imageTag=v1 --region $AWS_REGION \
  --query 'imageScanFindings.findingSeverityCounts'
aws logs describe-log-streams --log-group-name /ecs/lab14 \
  --query 'logStreams[].logStreamName' --region $AWS_REGION</code></pre></li>
</ol>

<h3>Teardown</h3>
<p>Order matters: drain the service before deleting it, delete the service before the cluster, and detach policies before deleting the role. Everything below stops all billing from this lab.</p>
<ol>
<li><p><strong>Scale the service to zero, then delete it</strong> (the running Fargate task is the only meaningful cost — kill it first):</p>
<pre><code>aws ecs update-service --cluster lab14 --service web --desired-count 0 \
  --region $AWS_REGION
aws ecs wait services-stable --cluster lab14 --services web --region $AWS_REGION
aws ecs delete-service --cluster lab14 --service web --force --region $AWS_REGION</code></pre></li>
<li><p><strong>Delete the cluster</strong> (must be empty of services and tasks):</p>
<pre><code>aws ecs delete-cluster --cluster lab14 --region $AWS_REGION</code></pre></li>
<li><p><strong>Deregister the task definition revision</strong> (deregistered revisions cost nothing but this keeps the account tidy):</p>
<pre><code>aws ecs deregister-task-definition --task-definition lab14-web:1 \
  --region $AWS_REGION</code></pre></li>
<li><p><strong>Delete the security group</strong> (wait a minute after the task stops — the ENI must detach first, otherwise you get DependencyViolation):</p>
<pre><code>aws ec2 delete-security-group --group-id $SG_ID --region $AWS_REGION</code></pre></li>
<li><p><strong>Delete the log group</strong> (stored log bytes bill monthly forever otherwise):</p>
<pre><code>aws logs delete-log-group --log-group-name /ecs/lab14 --region $AWS_REGION</code></pre></li>
<li><p><strong>Delete the ECR repository</strong> — <code>--force</code> removes the images too (storage is the billing dimension):</p>
<pre><code>aws ecr delete-repository --repository-name $REPO --force --region $AWS_REGION</code></pre></li>
<li><p><strong>Detach and delete the execution role:</strong></p>
<pre><code>aws iam detach-role-policy --role-name lab14-exec-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
aws iam delete-role --role-name lab14-exec-role</code></pre></li>
<li><p><strong>Confirm nothing is left:</strong> the three commands below should return empty lists or not-found errors:</p>
<pre><code>aws ecs list-clusters --region $AWS_REGION
aws ecr describe-repositories --repository-names $REPO --region $AWS_REGION
aws logs describe-log-groups --log-group-name-prefix /ecs/lab14 --region $AWS_REGION</code></pre></li>
</ol>
`
  }
});
