window.COURSE.registerLearn({
  moduleId: "containers",
  bigPicture: "Containers package an app with everything it needs so it runs the same everywhere. AWS gives you a place to <strong>store images</strong> (ECR), two <strong>orchestrators</strong> that keep containers running (ECS, simple and AWS-native; EKS, real Kubernetes), and a choice of <strong>where they run</strong>: your own EC2 instances, or Fargate where AWS hides the servers. The exam mostly asks you to pick the option with the least operational work that still meets a hard requirement like GPUs, Kubernetes, or cost.",
  cheatsheet: [
    { k: "Run containers with the least operational overhead", v: "<strong>ECS on Fargate</strong> — no servers, no cluster upgrades" },
    { k: "Kubernetes required, portability, existing Helm charts", v: "<strong>EKS</strong>" },
    { k: "GPU, privileged containers, or a daemon on every host", v: "<strong>ECS or EKS on EC2</strong> — Fargate cannot do these" },
    { k: "Task cannot pull image: CannotPullContainerError or secrets error", v: "Fix the <strong>task execution role</strong> (ECR pull, logs, secrets)" },
    { k: "App gets AccessDenied calling S3/DynamoDB at runtime", v: "Fix the <strong>task role</strong> (app permissions)" },
    { k: "Private subnet, no NAT, image pulls fail", v: "Endpoints for <strong>ecr.api + ecr.dkr + S3 gateway</strong>" },
    { k: "Docker Hub rate limits break builds", v: "<strong>ECR pull-through cache</strong>" },
    { k: "Continuously rescan stored images for new CVEs", v: "<strong>ECR enhanced scanning</strong> (Amazon Inspector)" },
    { k: "Same image tag must never be overwritten", v: "<strong>Tag immutability</strong> on the repository" },
    { k: "Always-on baseline plus cheap interruptible burst on ECS", v: "Capacity provider: <strong>FARGATE base + FARGATE_SPOT weight</strong>" },
    { k: "Bad deploy should roll back automatically, minimal setup", v: "Rolling update + <strong>deployment circuit breaker</strong> with rollback" },
    { k: "Test new version on a separate port, then shift 10% of traffic", v: "<strong>Blue/green</strong> with test listener + canary" },
    { k: "Each ECS task needs its own security group", v: "<strong>awsvpc</strong> network mode" },
    { k: "ECS services need retries and per-service metrics, no code change", v: "<strong>ECS Service Connect</strong>" },
    { k: "EKS pods need least-privilege AWS access", v: "<strong>IRSA</strong> or <strong>EKS Pod Identity</strong>, never the node role" },
    { k: "EKS nodes should scale fast across many instance types, cheaply", v: "<strong>Karpenter</strong>" },
    { k: "EKS pods stuck: failed to assign an IP address", v: "VPC CNI <strong>prefix delegation</strong> or a secondary CIDR" },
    { k: "Existing container image, simplest HTTPS web deployment", v: "<strong>App Runner</strong>" },
    { k: "Thousands of queued, retryable jobs on Spot, scale to zero", v: "<strong>AWS Batch</strong>" }
  ],
  lessons: {
    "ecr": {
      minutes: 5,
      tldr: [
        "<strong>ECR</strong> is AWS's private container image registry, per account and per region, secured with IAM.",
        "Docker logs in with a token that lasts <strong>12 hours</strong> (<code>aws ecr get-login-password</code>). ECS and EKS fetch it for you.",
        "ECR never deletes images on its own: use <strong>lifecycle policies</strong> to expire old or untagged ones.",
        "<strong>Replication</strong> copies images to other regions/accounts; <strong>pull-through cache</strong> mirrors Docker Hub and others.",
        "Private subnet with no NAT needs <strong>three endpoints</strong>: ecr.api, ecr.dkr, and an <strong>S3 gateway</strong> (image layers live in S3)."
      ],
      analogy: "ECR is a warehouse for app packages. The front desk (ECR API) checks your badge and tells you which shelf, but the boxes themselves sit in a back warehouse (S3). If you only build a road to the front desk, you get the paperwork but never the boxes.",
      examTip: "\"Tasks in a private subnet fail with CannotPullContainerError, interface endpoints for ECR exist\" means the <strong>S3 gateway endpoint</strong> is missing. \"Docker Hub throttling\" means <strong>pull-through cache</strong>.",
      terms: [
        { t: "Lifecycle policy", d: "Rules that automatically delete old or untagged images to control storage cost." },
        { t: "Pull-through cache", d: "ECR fetches an image from an upstream registry once, then serves it locally." },
        { t: "Enhanced scanning", d: "Amazon Inspector continuously rescans images, including language packages, as new CVEs appear." },
        { t: "Tag immutability", d: "Once a tag like v1.2.3 exists, it cannot be overwritten." },
        { t: "Repository policy", d: "Resource policy on a repo, used for cross-account pulls." }
      ],
      check: [
        {
          q: "Fargate tasks in private subnets with no NAT authenticate to ECR but fail downloading layers. Interface endpoints for ecr.api and ecr.dkr exist. What is missing?",
          options: ["An S3 gateway endpoint", "A NAT gateway in each AZ", "A repository policy", "Tag immutability"],
          answer: 0,
          why: "Image layers are served from S3, so the S3 gateway endpoint completes the path. A NAT would also work but is not needed and costs more."
        },
        {
          q: "Security wants images already in ECR re-checked whenever a new vulnerability is published. What do you enable?",
          options: ["Basic scan on push", "Enhanced scanning with Amazon Inspector", "Tag immutability"],
          answer: 1,
          why: "Enhanced scanning keeps rescanning as new CVEs appear. Basic scanning only checks at push or on demand."
        }
      ]
    },
    "ecs-model": {
      minutes: 5,
      tldr: [
        "A <strong>task definition</strong> is a versioned recipe: images, CPU/memory, ports, secrets, logs. A running copy is a <strong>task</strong>.",
        "A <strong>service</strong> keeps N tasks running, replaces failures and registers them with a load balancer.",
        "<strong>EC2 launch type</strong>: you manage instances but get GPUs and control. <strong>Fargate</strong>: AWS runs the servers.",
        "<strong>Capacity providers</strong> decide where tasks run and scale the EC2 fleet for you.",
        "Cost pattern: <strong>FARGATE base 2</strong> for the always-on floor, <strong>FARGATE_SPOT</strong> weight for cheap burst."
      ],
      analogy: "A task definition is a recipe card. A task is one dish cooked from it. A service is the restaurant manager who makes sure there are always, say, four dishes ready and replaces any that get dropped.",
      examTip: "\"Baseline must always run, burst should be cheapest, interruptions of burst are fine\" means a capacity provider strategy with <strong>FARGATE base + FARGATE_SPOT weight</strong>. Daemon services (one per host) only exist on EC2.",
      terms: [
        { t: "Task definition", d: "Immutable, numbered blueprint for one or more containers. Roll back by redeploying an older revision." },
        { t: "Service", d: "Keeps a desired number of tasks running and handles deployments." },
        { t: "Launch type", d: "EC2 (your instances) or Fargate (AWS-managed compute)." },
        { t: "Capacity provider", d: "Modern way to choose compute; can auto-scale an EC2 Auto Scaling group for tasks." },
        { t: "Essential container", d: "If it stops, the whole task stops. Mark sidecars non-essential." }
      ],
      check: [
        {
          q: "An ECS service needs 2 tasks always on and wants extra load handled as cheaply as possible. Interruptions of the extra tasks are fine. What do you configure?",
          options: ["All tasks on FARGATE_SPOT", "FARGATE with base 2, plus FARGATE_SPOT with a higher weight", "EC2 launch type with On-Demand instances only"],
          answer: 1,
          why: "The base keeps a safe floor on regular Fargate, and the weight sends most extra tasks to Spot. All-Spot could lose every task in one interruption wave."
        },
        {
          q: "You need a monitoring agent running exactly once on every container host. What must you use?",
          options: ["Fargate with a daemon service", "EC2 launch type with the daemon scheduling strategy", "A replica service with 10 tasks"],
          answer: 1,
          why: "Daemon services place one task per EC2 instance. Fargate has no hosts you can see, so a per-host agent is impossible there."
        }
      ]
    },
    "ecs-networking": {
      minutes: 5,
      tldr: [
        "<strong>awsvpc</strong> mode gives each task its own network card (ENI), IP and <strong>security group</strong>. Required on Fargate, best default.",
        "Each awsvpc task uses one subnet IP: plan bigger subnets. On EC2, <strong>ENI trunking</strong> fits many more tasks per instance.",
        "<strong>Cloud Map service discovery</strong>: tasks get DNS names. Simple, but DNS caching can point to dead tasks.",
        "<strong>Service Connect</strong>: ECS adds a managed proxy for retries, fast updates and per-service metrics, no code changes.",
        "Load balancer targets: awsvpc/Fargate tasks register by <strong>IP</strong>; bridge-mode tasks by instance and dynamic port."
      ],
      analogy: "awsvpc is giving every tenant in a building their own front door and lock, instead of one shared building entrance. You can set a different lock for each door, but you need more door numbers (IP addresses).",
      examTip: "\"Tasks on the same instance need different security groups\" means <strong>awsvpc</strong>. \"Few awsvpc tasks per instance despite free CPU\" means <strong>ENI trunking</strong>. \"Retries and metrics between services without code changes\" means <strong>Service Connect</strong>.",
      terms: [
        { t: "awsvpc mode", d: "Each task gets its own ENI, private IP and security groups." },
        { t: "Bridge mode", d: "Older Docker networking; tasks share the instance's network and use mapped ports." },
        { t: "ENI trunking", d: "Lets an EC2 instance host many more awsvpc tasks than its normal ENI limit." },
        { t: "AWS Cloud Map", d: "Service registry that gives tasks DNS names in a private namespace." },
        { t: "Service Connect", d: "ECS-managed proxy sidecar adding retries, load balancing and metrics between services." }
      ],
      check: [
        {
          q: "Payments and marketing tasks share EC2 hosts, but payments must have stricter network rules. Which setting enables this?",
          options: ["Host network mode", "awsvpc network mode with separate security groups", "Bridge mode with dynamic ports"],
          answer: 1,
          why: "awsvpc attaches security groups to each task's own ENI. In bridge or host mode all tasks share the instance's security group."
        },
        {
          q: "Microservices on ECS need automatic retries and per-service latency metrics without changing application code. What fits best?",
          options: ["Cloud Map DNS service discovery", "ECS Service Connect", "A Network Load Balancer per service", "Bridge mode"],
          answer: 1,
          why: "Service Connect injects a managed proxy that adds retries, outlier ejection and metrics. Plain DNS discovery offers none of those."
        }
      ]
    },
    "ecs-deploy": {
      minutes: 5,
      tldr: [
        "Rolling updates use two knobs: <strong>minimumHealthyPercent</strong> (floor, default 100) and <strong>maximumPercent</strong> (ceiling, default 200).",
        "Turn on the <strong>deployment circuit breaker</strong> with rollback: failed deploys revert automatically.",
        "<strong>Blue/green</strong> (CodeDeploy, or ECS-native since 2025) adds a test listener, canary/linear shifts and instant rollback.",
        "Service auto scaling uses target tracking on CPU, memory or <strong>requests per target</strong>. Placement strategies apply only to EC2.",
        "Two roles: <strong>task execution role</strong> lets ECS pull images, write logs and read secrets. <strong>Task role</strong> is what your app code uses."
      ],
      analogy: "The execution role is the moving company's key to your building: it lets them bring the furniture in. The task role is your own key to the office once you have moved in. A failed move and a locked office are different problems.",
      examTip: "The most tested fact: <strong>task won't start</strong> (image pull or secret errors) means the <strong>execution role</strong>; <strong>app gets AccessDenied</strong> while running means the <strong>task role</strong>. Never grant app permissions on the EC2 instance role.",
      terms: [
        { t: "minimumHealthyPercent", d: "Lowest share of desired tasks that must stay running during a deploy." },
        { t: "maximumPercent", d: "Highest share of desired tasks allowed during a deploy (room to start new ones first)." },
        { t: "Circuit breaker", d: "Detects a failing deployment and can roll back to the last working version." },
        { t: "Task execution role", d: "Used by ECS itself: pull images from ECR, send logs, fetch secrets." },
        { t: "Task role", d: "IAM role your application code uses to call AWS services." }
      ],
      check: [
        {
          q: "A new ECS task starts fine, but the app logs AccessDenied when writing to DynamoDB. What do you change?",
          options: ["The task execution role", "The task role", "The EC2 instance role", "The ECR repository policy"],
          answer: 1,
          why: "Your code's AWS calls use the task role. The execution role only covers ECS's own startup work like pulling images and fetching secrets."
        },
        {
          q: "The team wants failed deployments rolled back automatically with the least setup. What do they enable?",
          options: ["Blue/green with CodeDeploy", "Deployment circuit breaker with rollback on rolling updates", "Scheduled scaling"],
          answer: 1,
          why: "The circuit breaker is a single setting on rolling updates that detects crash loops and reverts. Blue/green works too but needs more setup."
        }
      ]
    },
    "fargate": {
      minutes: 4,
      tldr: [
        "Each Fargate task runs in its <strong>own small VM</strong>, so tasks never share a kernel with anyone else.",
        "You pick CPU and memory from a fixed menu: <strong>0.25 to 16 vCPU</strong>, up to <strong>120 GB</strong>. Billed per second.",
        "Fargate <strong>cannot</strong> do GPUs, privileged containers or per-host daemons. Disk: 20 GiB free, max 200 GiB, not persistent (use EFS).",
        "<strong>Fargate Spot</strong>: about 70% cheaper, 2-minute warning, <strong>ECS only</strong>.",
        "Always spread services over subnets in several AZs."
      ],
      analogy: "Fargate is renting a furnished hotel room instead of owning a house: no repairs or maintenance, but you choose from the room sizes on offer and cannot knock down walls or bring heavy machinery.",
      examTip: "\"Minimize operational overhead for containers\" with no special needs means <strong>Fargate</strong>. \"Needs a GPU\", \"privileged mode\" or \"per-host agent\" rules Fargate out: pick EC2.",
      terms: [
        { t: "Micro-VM", d: "Tiny virtual machine per task, giving strong isolation from other workloads." },
        { t: "Task size", d: "The vCPU and memory pair you choose from Fargate's menu; it sets the price." },
        { t: "Ephemeral storage", d: "Scratch disk per task: 20 GiB included, up to 200 GiB, lost when the task stops." },
        { t: "Fargate Spot", d: "Spare capacity at a big discount; can be stopped with 2 minutes' notice." },
        { t: "Platform version", d: "Fargate runtime version; 1.4+ adds EFS support and routes pulls through the task ENI." }
      ],
      check: [
        {
          q: "An ML inference container needs a GPU and the team wants minimal ops. Which compute works?",
          options: ["ECS on Fargate", "ECS on EC2 with GPU instances", "Fargate Spot"],
          answer: 1,
          why: "Fargate has no GPU support, so GPU containers need EC2 capacity (ECS or EKS). Fargate Spot is still Fargate."
        },
        {
          q: "A task needs 500 GB of scratch disk. What is true?",
          options: ["Fargate can provide it as ephemeral storage", "It exceeds Fargate's 200 GiB limit, so use EC2 storage or EFS", "Fargate Spot raises the limit"],
          answer: 1,
          why: "Fargate ephemeral storage tops out at 200 GiB. Larger or persistent storage means EFS or EC2 with instance store or EBS."
        }
      ]
    },
    "eks-core": {
      minutes: 4,
      tldr: [
        "<strong>EKS</strong> is real Kubernetes; AWS runs the control plane for about <strong>$0.10 per cluster-hour</strong> (~$73/month).",
        "Worker options: <strong>managed node groups</strong> (default), self-managed nodes, <strong>Fargate profiles</strong>, or <strong>EKS Auto Mode</strong>.",
        "Pods get AWS permissions via <strong>IRSA</strong> (OIDC-based) or <strong>EKS Pod Identity</strong> (simpler). Never via the node role.",
        "Fargate pods: one pod per VM, no daemonsets, no GPUs, and only IRSA for pod IAM.",
        "Kubernetes versions expire: standard support ~14 months, then paid extended support. Upgrades never stop."
      ],
      analogy: "EKS is leasing a car where the dealer maintains the engine (control plane), but you still choose and service the tyres (nodes), and you must bring it in for a new model year every so often.",
      examTip: "\"Pods need least-privilege access to S3 without using the node role\" means <strong>IRSA or Pod Identity</strong>. Attaching the policy to the node instance role is always the trap.",
      terms: [
        { t: "Control plane", d: "Kubernetes API servers and etcd, run by AWS across AZs." },
        { t: "Managed node group", d: "EC2 workers where AWS handles the Auto Scaling group and safe upgrades." },
        { t: "Fargate profile", d: "Rule that sends matching pods (by namespace/labels) to Fargate." },
        { t: "IRSA", d: "IAM Roles for Service Accounts: pods swap a signed token for role credentials via OIDC." },
        { t: "EKS Pod Identity", d: "Newer pod IAM: an agent hands out role credentials; no OIDC setup." },
        { t: "EKS Auto Mode", d: "AWS also manages nodes, scaling and core add-ons on EC2 in your account." }
      ],
      check: [
        {
          q: "A pod on EKS must read one S3 bucket. What is the least-privilege approach?",
          options: ["Add S3 permissions to the node instance role", "Map the pod's service account to an IAM role with IRSA or Pod Identity", "Store access keys in a Kubernetes secret"],
          answer: 1,
          why: "IRSA and Pod Identity give that one service account its own role. The node role would give every pod on the node the same access."
        },
        {
          q: "Pods run on EKS Fargate and need an IAM role. Which mechanism works?",
          options: ["EKS Pod Identity", "IRSA", "The node instance role"],
          answer: 1,
          why: "Pod Identity relies on an agent running on each EC2 node, which Fargate pods do not have, so IRSA is the answer there."
        }
      ]
    },
    "eks-ops": {
      minutes: 5,
      tldr: [
        "The <strong>AWS Load Balancer Controller</strong> turns an Ingress into an <strong>ALB</strong> and a LoadBalancer Service into an <strong>NLB</strong>.",
        "<strong>IP target mode</strong> sends traffic straight to pod IPs; it is the only mode for Fargate pods.",
        "The <strong>VPC CNI</strong> gives each pod a real VPC IP. Upside: native networking. Downside: subnets run out of IPs.",
        "IP exhaustion fixes: <strong>prefix delegation</strong> (~16x more IPs per node) or a <strong>secondary CIDR</strong> for pods.",
        "<strong>Karpenter</strong> launches the best-fitting instance in seconds and consolidates to save money; Cluster Autoscaler scales fixed node groups."
      ],
      analogy: "Cluster Autoscaler orders more of the same pre-set van from a fixed catalogue. Karpenter looks at the parcels waiting and picks whatever vehicle fits them best right now, then swaps to smaller vans when loads shrink.",
      examTip: "\"Pods stuck, failed to assign an IP address\" means <strong>prefix delegation or secondary CIDR</strong>, not a bigger instance. \"Scale nodes fast, many instance types, lowest cost\" means <strong>Karpenter</strong>.",
      terms: [
        { t: "AWS Load Balancer Controller", d: "Creates ALBs/NLBs from Kubernetes Ingress and Service objects." },
        { t: "VPC CNI", d: "EKS networking plugin giving each pod an IP from your VPC subnet." },
        { t: "Prefix delegation", d: "Assigns /28 blocks of IPs per slot instead of single IPs, for far more pods per node." },
        { t: "Karpenter", d: "Node autoscaler that picks instance types on demand and consolidates underused nodes." },
        { t: "Cluster Autoscaler", d: "Classic autoscaler that resizes existing Auto Scaling groups." }
      ],
      check: [
        {
          q: "EKS pods stay in ContainerCreating with 'failed to assign an IP address'. Nodes have spare CPU. Best fix?",
          options: ["Use larger instance types", "Enable VPC CNI prefix delegation or add a secondary CIDR for pods", "Switch to Cluster Autoscaler"],
          answer: 1,
          why: "The subnet is out of IPs, not compute. Bigger instances still draw IPs from the same exhausted subnet."
        },
        {
          q: "Workloads vary widely in shape; the team wants nodes in seconds and automatic cost consolidation. Which tool?",
          options: ["Cluster Autoscaler with many node groups", "Karpenter", "Manual scaling of managed node groups"],
          answer: 1,
          why: "Karpenter chooses from many instance types per request and continuously consolidates. Cluster Autoscaler is tied to predefined node groups."
        }
      ]
    },
    "decision": {
      minutes: 4,
      tldr: [
        "<strong>App Runner</strong>: give it an image or repo, get an HTTPS URL with scaling built in. Web apps only.",
        "<strong>AWS Batch</strong>: job queues, <strong>array jobs</strong> (up to 10,000 children), dependencies, Spot, scale to zero.",
        "Short event-driven work under 15 minutes: <strong>Lambda</strong>. Simple containers with least ops: <strong>ECS on Fargate</strong>.",
        "Kubernetes or portability required: <strong>EKS</strong>. GPU, privileged or per-host daemon: <strong>EC2</strong>-backed ECS/EKS.",
        "Decide by hard constraints first: duration, GPU, protocol, portability, team size."
      ],
      analogy: "Picking compute is like picking transport: a taxi (Lambda) for short trips, a car-share with driver (App Runner) for simple routes, your own fleet (ECS/EKS on EC2) when you need special vehicles, and a freight scheduler (Batch) for thousands of shipments.",
      examTip: "Keywords decide it: \"job queue\" or \"array of simulations\" means <strong>Batch</strong>; \"simplest way to deploy a container web app\" means <strong>App Runner</strong>; \"least overhead container orchestration\" means <strong>ECS on Fargate</strong>.",
      terms: [
        { t: "App Runner", d: "Fully managed service turning a container or repo into a scaled HTTPS web service." },
        { t: "AWS Batch", d: "Managed scheduler that runs queued container jobs on EC2, Spot or Fargate." },
        { t: "Array job", d: "One Batch submission that fans out into many indexed child jobs." },
        { t: "Compute environment", d: "The pool of capacity Batch scales up and down for a job queue." }
      ],
      check: [
        {
          q: "A research team must run 5,000 independent simulations nightly on Spot, with retries, paying nothing when idle. Which service?",
          options: ["Lambda", "AWS Batch with an array job", "App Runner", "EKS with Cluster Autoscaler"],
          answer: 1,
          why: "Batch array jobs fan out thousands of tasks, retry failures and scale the Spot pool to zero afterwards. Lambda's 15-minute limit and missing queueing make it a poor fit."
        },
        {
          q: "A two-person team has a container image for a web API and wants the simplest path to an HTTPS URL. Best choice?",
          options: ["EKS", "ECS on EC2", "App Runner"],
          answer: 2,
          why: "App Runner handles build, load balancing, TLS and scaling for web services with almost no setup. EKS brings cluster upkeep a tiny team does not need."
        }
      ]
    }
  }
});
