/* Learning layer — Module 5: Load Balancing & Auto Scaling */
window.COURSE.registerLearn({
  moduleId: "elb-asg",
  bigPicture: "A <strong>load balancer</strong> is the front door that spreads traffic over many servers and stops sending to broken ones. An <strong>Auto Scaling Group</strong> is the manager that adds servers when it gets busy, removes them when it is quiet, and replaces any that die. Together they are how almost every AWS app stays up and affordable. On SAA-C03 you will get several questions that are really just: pick the right load balancer from one keyword, and pick the right scaling knob.",
  cheatsheet: [
    { k: "Route by URL path, hostname or HTTP header", v: "<strong>ALB</strong> — it reads the HTTP request (layer 7)." },
    { k: "Static IP / Elastic IP / partners allowlist our IP", v: "<strong>NLB</strong> — the only ELB with fixed IPs per AZ." },
    { k: "Static IP AND path-based routing", v: "<strong>NLB with an ALB target</strong>, or <strong>Global Accelerator + ALB</strong>." },
    { k: "UDP traffic (DNS, syslog, gaming, IoT)", v: "<strong>NLB</strong> — ALB only speaks HTTP(S)." },
    { k: "Millions of requests/s, ultra-low latency, sudden spike", v: "<strong>NLB</strong> — pass-through, no pre-warming." },
    { k: "Third-party firewall / IDS inline, GENEVE, port 6081", v: "<strong>Gateway Load Balancer</strong> + GWLB endpoints in route tables." },
    { k: "Log users in before they reach the app, no code changes", v: "<strong>ALB authenticate action</strong> with Cognito or any OIDC provider." },
    { k: "Expose a service to other VPCs via PrivateLink", v: "<strong>NLB</strong> in front of the endpoint service." },
    { k: "Lambda function or gRPC behind a load balancer", v: "<strong>ALB</strong> (Lambda target type; gRPC target group)." },
    { k: "Many HTTPS domains on one load balancer", v: "<strong>ALB/NLB with SNI</strong> — CLB can't do it, migrate." },
    { k: "All targets unhealthy but traffic still arrives", v: "<strong>Fail-open</strong>: with zero healthy targets, ELB sends to all." },
    { k: "Users lose sessions when instances scale in", v: "<strong>Store sessions in ElastiCache/DynamoDB</strong>; sticky sessions are second best." },
    { k: "One AZ's instances much hotter than the other's (NLB)", v: "Cross-zone is <strong>off</strong> + unequal AZ counts; enable it or rebalance." },
    { k: "Keep a metric (CPU, requests per target) at a set value", v: "<strong>Target tracking</strong> scaling — the default choice." },
    { k: "Known daily/weekly peak, slow-booting app", v: "<strong>Scheduled</strong> or <strong>predictive</strong> scaling (plus target tracking)." },
    { k: "Scale workers on an SQS queue", v: "Target tracking on <strong>backlog per instance</strong>, not raw queue depth." },
    { k: "Finish jobs / upload logs before an instance is terminated", v: "<strong>Terminating:Wait lifecycle hook</strong>." },
    { k: "ASG keeps killing new instances before they finish booting", v: "<strong>Health check grace period</strong> too short (or wrong health path)." },
    { k: "Roll out a new AMI gradually, pause to verify", v: "<strong>Instance refresh</strong> with checkpoints; new launch template version." },
    { k: "Anything praising the Classic Load Balancer", v: "Wrong — CLB is legacy; the answer is <strong>migrate to ALB/NLB</strong>." }
  ],
  lessons: {
    "elb-family": {
      minutes: 5,
      tldr: [
        "<strong>ALB</strong> = smart HTTP front door (layer 7). It reads each request and routes by path, host or header.",
        "<strong>NLB</strong> = fast pass-through for TCP/UDP (layer 4). Static IPs, tiny latency, huge scale.",
        "<strong>GWLB</strong> = puts a fleet of firewall/inspection appliances invisibly into the traffic path (GENEVE, UDP 6081).",
        "<strong>CLB</strong> = legacy. On the exam it is almost always the wrong answer.",
        "An ALB's IPs change as it scales, so it can never give you a static IP."
      ],
      analogy: "An ALB is a receptionist who opens each letter, reads it, and walks it to the right department. An NLB is a mail chute: it never opens anything, it just drops each envelope into a slot very fast. A GWLB is the security scanner every parcel must pass through before delivery.",
      examTip: "Match the keyword: <em>path/host/header</em> &rarr; ALB; <em>static IP, UDP, extreme performance</em> &rarr; NLB; <em>third-party appliances, GENEVE</em> &rarr; GWLB. If a question needs static IP <em>and</em> L7 routing, answer Global Accelerator + ALB (or NLB with an ALB target).",
      terms: [
        { t: "Layer 7 (L7)", d: "The application layer — the load balancer understands HTTP requests, URLs and headers." },
        { t: "Layer 4 (L4)", d: "The transport layer — only IPs, ports and TCP/UDP; no idea what's inside." },
        { t: "Listener", d: "A port and protocol the load balancer accepts traffic on, e.g. HTTPS:443." },
        { t: "LCU", d: "Load Balancer Capacity Unit — the usage part of the bill, on top of the hourly charge." },
        { t: "GENEVE", d: "Tunnelling protocol GWLB uses to wrap packets for appliances. Always UDP port 6081." }
      ],
      check: [
        {
          q: "Partner banks must allowlist a fixed IP address for your TCP trading service. Which load balancer?",
          options: ["Application Load Balancer", "Network Load Balancer with Elastic IPs", "Classic Load Balancer", "Gateway Load Balancer"],
          answer: 1,
          why: "Only the NLB gives a stable IP per AZ, and you can attach your own Elastic IPs. ALB node IPs change as it scales, so it can't be allowlisted."
        },
        {
          q: "You must send /api/* to one group of servers and /images/* to another. Which load balancer?",
          options: ["Network Load Balancer", "Gateway Load Balancer", "Application Load Balancer"],
          answer: 2,
          why: "Path-based routing needs a layer-7 balancer that reads the URL — the ALB. The NLB never looks inside the request."
        }
      ]
    },

    "alb-deep": {
      minutes: 5,
      tldr: [
        "Each ALB <strong>listener</strong> has <strong>rules</strong> checked in priority order; the first match wins, and a default rule catches the rest.",
        "Rules match host, path, header, query string, method or source IP, then <em>forward</em>, <em>redirect</em>, <em>fixed-response</em> or <em>authenticate</em>.",
        "<strong>Weighted forward</strong> (e.g. 95% blue / 5% green) gives you canary and blue/green deploys at the ALB.",
        "ALB can log users in via <strong>Cognito or any OIDC provider</strong> before the app ever sees the request.",
        "Targets see the ALB's IP; the real client IP is in the <code>X-Forwarded-For</code> header."
      ],
      analogy: "An ALB is like a building concierge with a rulebook: 'deliveries for floor 3 go to the lift, anyone for /admin must show ID first, everything else to reception.' The first rule that fits is the one followed.",
      examTip: "'Add login to an existing web app with minimal code changes' &rarr; ALB authenticate-oidc / authenticate-cognito action. Also know the error codes: <strong>502</strong> target broke the connection, <strong>503</strong> no healthy capacity, <strong>504</strong> target too slow.",
      terms: [
        { t: "Listener rule", d: "Condition plus action, e.g. 'if path is /api/* then forward to the API target group'." },
        { t: "Target group", d: "The pool of servers (or IPs, or a Lambda) a rule sends traffic to." },
        { t: "Target types", d: "ALB can target <strong>instance</strong>, <strong>ip</strong> (containers, on-prem) or <strong>lambda</strong>." },
        { t: "X-Forwarded-For", d: "Header the ALB adds carrying the original client IP address." },
        { t: "Weighted target groups", d: "Split traffic by percentage between groups — used for canary releases." }
      ],
      check: [
        {
          q: "An internal admin site behind an ALB must require corporate SSO login, and developers can't change the code. What do you configure?",
          options: ["An authenticate-oidc action on the ALB rule", "A Cognito Identity Pool", "An NLB with a TLS listener", "API Gateway with a Lambda authorizer"],
          answer: 0,
          why: "The ALB can run the whole OIDC login flow itself and pass signed identity headers to the app. Identity Pools hand out AWS credentials, not web sign-in at a load balancer."
        },
        {
          q: "Your app behind an ALB logs the same few private IPs for every visitor. Where is the real client IP?",
          options: ["In the X-Forwarded-For header", "It is lost and cannot be recovered", "In the TCP source address"],
          answer: 0,
          why: "The ALB opens a new connection to the target, so the source address is the ALB node. It passes the client address in X-Forwarded-For."
        }
      ]
    },

    "nlb-deep": {
      minutes: 5,
      tldr: [
        "NLB picks one target per <strong>connection (flow)</strong> and forwards packets; the target does the TCP handshake itself.",
        "It gives <strong>one static IP per AZ</strong> (bring your own Elastic IP) and handles <strong>TCP, UDP and TLS</strong> — never HTTP routing.",
        "Client IP is kept for instance targets; otherwise use the toggle or <strong>Proxy Protocol v2</strong>.",
        "NLB is required in front of a <strong>PrivateLink</strong> endpoint service, and can use an <strong>ALB as a target</strong>.",
        "Idle TCP connections are dropped after 350 s by default (configurable since 2024), so use keepalives."
      ],
      analogy: "An NLB is a railway switch operator: when a train (connection) arrives, it throws the switch once and the whole train follows that track to the end. It never looks at the cargo, which is why it is so fast.",
      examTip: "NLB triggers: <em>static IP, Elastic IP, UDP, PrivateLink, millions of requests per second, lowest latency</em>. The trap is expecting NLB to do anything that needs reading the request — path routing, auth, cookies.",
      terms: [
        { t: "Flow", d: "One connection, identified by source/destination IP, ports and protocol. It stays on one target." },
        { t: "Client IP preservation", d: "The target sees the real client address instead of the load balancer's." },
        { t: "Proxy Protocol v2", d: "A small header NLB adds with the original client address; the app must be set up to read it." },
        { t: "TLS listener", d: "NLB decrypts TLS with an ACM certificate but still routes only by connection." },
        { t: "PrivateLink", d: "Private access to a service from other VPCs; the provider side sits behind an NLB." }
      ],
      check: [
        {
          q: "A game server fleet receives UDP traffic from players. Which load balancer can front it?",
          options: ["Application Load Balancer", "Network Load Balancer", "Classic Load Balancer"],
          answer: 1,
          why: "UDP listeners exist only on the NLB. ALB speaks HTTP/HTTPS/gRPC, and CLB supports TCP and HTTP only."
        },
        {
          q: "You need static IPs for clients AND routing by URL path. What's the simplest correct design?",
          options: ["ALB with an Elastic IP", "NLB with an ALB as its target", "NLB with path-based listener rules", "Two CLBs"],
          answer: 1,
          why: "The NLB supplies the static IPs, the ALB behind it does the path routing. ALBs can't take Elastic IPs, and NLBs have no path rules."
        }
      ]
    },

    "gwlb": {
      minutes: 5,
      tldr: [
        "GWLB inserts a fleet of <strong>third-party appliances</strong> (firewalls, IDS/IPS) into traffic paths, invisibly and at scale.",
        "Packets are wrapped in <strong>GENEVE on UDP 6081</strong>; appliances see the original source and destination, no NAT.",
        "Traffic reaches it through <strong>GWLB endpoints</strong> that you put in route tables as a next hop.",
        "It keeps both directions of a flow on the same appliance, so stateful inspection works.",
        "If you just need a managed firewall with no appliances, use <strong>AWS Network Firewall</strong> instead."
      ],
      analogy: "Think of airport security lanes. Every passenger is routed through a scanner lane, the scanner sees who they really are, and the airport can open more lanes when it's busy. Passengers don't need to know the lanes exist.",
      examTip: "Keywords 'third-party virtual appliances', 'inspect all traffic', 'bump in the wire' or 'GENEVE' &rarr; GWLB with GWLB endpoints. With a Transit Gateway, 'asymmetric routing breaks the firewall' &rarr; turn on <strong>appliance mode</strong>.",
      terms: [
        { t: "Bump in the wire", d: "A device placed in the traffic path that neither side notices." },
        { t: "GWLB endpoint", d: "A PrivateLink endpoint in your VPC that route tables point to, sending traffic to the GWLB." },
        { t: "Security VPC", d: "A dedicated VPC holding the GWLB and the appliance fleet." },
        { t: "Appliance mode", d: "Transit Gateway setting that keeps both directions of a flow in the same AZ." },
        { t: "Flow stickiness", d: "GWLB sends every packet of one connection, both ways, to the same appliance." }
      ],
      check: [
        {
          q: "Security wants all internet-bound traffic from many VPCs inspected by a scalable fleet of Palo Alto firewall VMs. What should you use?",
          options: ["AWS WAF on each ALB", "Gateway Load Balancer with GWLB endpoints", "A NAT gateway per VPC", "An NLB with the firewalls as IP targets"],
          answer: 1,
          why: "GWLB is built to scale third-party inline appliances transparently. WAF only filters HTTP at an ALB/CloudFront, and NAT gateways translate addresses without inspecting."
        },
        {
          q: "Which port and protocol must your appliances handle to work behind a GWLB?",
          options: ["TCP 443", "UDP 6081 (GENEVE)", "UDP 4789 (VXLAN)"],
          answer: 1,
          why: "GWLB always uses GENEVE on UDP 6081. VXLAN on 4789 is a different tunnel used by Traffic Mirroring, a tempting look-alike."
        }
      ]
    },

    "target-groups": {
      minutes: 5,
      tldr: [
        "Health checks ping each target on an <strong>interval</strong>; enough failures in a row marks it <strong>unhealthy</strong> and traffic stops.",
        "Time to remove a dead target is roughly <strong>interval &times; unhealthy threshold</strong> (default 30 s &times; 2).",
        "If <strong>all</strong> targets are unhealthy, ELB <strong>fails open</strong> and sends traffic to all of them anyway.",
        "<strong>Deregistration delay</strong> (default 300 s) lets in-flight requests finish before a target is removed.",
        "<strong>Slow start</strong> (ALB) ramps traffic to new targets gradually so cold apps don't fall over."
      ],
      analogy: "A shift supervisor checks on each worker every 30 seconds. Miss two check-ins and you get no new customers. When your shift ends, you finish serving the people already at your counter (draining) before leaving.",
      examTip: "'All targets show unhealthy, yet the app still gets traffic' &rarr; fail-open. 'Targets registered but stuck unhealthy, app works directly' &rarr; security group blocking the health check, or wrong path/success code.",
      terms: [
        { t: "Health check", d: "A regular probe (HTTP path, TCP port) the load balancer uses to decide if a target can serve." },
        { t: "Unhealthy threshold", d: "How many failed checks in a row before a target is taken out. Default 2." },
        { t: "Fail-open", d: "If no target is healthy, send traffic to all of them rather than to nobody." },
        { t: "Deregistration delay", d: "Also called connection draining. Time allowed for in-flight work to finish. Default 300 s, max 3600 s." },
        { t: "Slow start", d: "ALB feature that gives a new target a gradually growing share of requests (30-900 s)." }
      ],
      check: [
        {
          q: "During deploys, users of a 5-minute file upload get cut off when old instances are removed. Which setting do you raise?",
          options: ["Health check interval", "Deregistration delay", "Slow start duration", "Unhealthy threshold"],
          answer: 1,
          why: "The deregistration delay is how long in-flight requests may finish before the target is removed. Slow start affects new targets, not departing ones."
        },
        {
          q: "Your health check calls the database. The database blips and every target fails the check. What does the ALB do?",
          options: ["Stops all traffic until a target recovers", "Routes to all targets anyway (fail-open)", "Fails over to another Region"],
          answer: 1,
          why: "With zero healthy targets, ELB fails open and routes to everyone. This is also why deep dependency checks are risky: one blip makes the whole fleet look dead."
        }
      ]
    },

    "crosszone-sticky-tls": {
      minutes: 5,
      tldr: [
        "<strong>Cross-zone</strong> lets a node in one AZ send to targets in other AZs. ALB: on and free. NLB/GWLB: off, and billed if you turn it on.",
        "Cross-zone off plus unequal targets per AZ = the smaller AZ's servers run hot.",
        "<strong>Sticky sessions</strong> pin a user to one server via a cookie (ALB). They're a crutch — better to store sessions in ElastiCache/DynamoDB.",
        "One HTTPS listener can hold many certificates chosen by <strong>SNI</strong> (the hostname the browser asks for). CLB can't.",
        "ACM public certificates are free and auto-renew; standard ones can't be exported to your own servers."
      ],
      analogy: "Sticky sessions are like a bank that makes you always visit the same teller because only they remember your paperwork. It works until that teller goes home. Putting the paperwork in a shared filing cabinet (ElastiCache/DynamoDB) lets any teller help you.",
      examTip: "'Users logged out when instances scale in' &rarr; external session store (ElastiCache or DynamoDB); sticky sessions only if the question says no app changes. 'Many TLS domains on one load balancer' &rarr; ALB with SNI.",
      terms: [
        { t: "Cross-zone load balancing", d: "Spreading traffic evenly over all targets in all AZs, not just the node's own AZ." },
        { t: "Sticky session", d: "Sending the same user to the same target every time, using a cookie like AWSALB." },
        { t: "SNI", d: "Server Name Indication: the client says which hostname it wants, so the right certificate is picked." },
        { t: "ACM", d: "AWS Certificate Manager — free public TLS certificates that renew themselves." },
        { t: "Security policy", d: "Named preset that sets allowed TLS versions and ciphers on a listener." }
      ],
      check: [
        {
          q: "An NLB has cross-zone off. AZ-a has 8 targets, AZ-b has 2. What happens?",
          options: ["Traffic spreads evenly per target", "AZ-b's 2 targets each get about 4x the load of AZ-a's", "AZ-b receives no traffic"],
          answer: 1,
          why: "Each AZ node gets roughly half the traffic and can only use its own AZ's targets, so AZ-b's two servers share half the load. Enable cross-zone or balance the counts."
        },
        {
          q: "Compliance forbids decrypting traffic anywhere except on the application servers. Which setup fits?",
          options: ["ALB HTTPS listener re-encrypting to targets", "NLB with a TCP listener on 443 passing traffic through", "NLB with a TLS listener", "CLB with an SSL listener"],
          answer: 1,
          why: "A TCP pass-through NLB never decrypts; the servers hold the certificates. The ALB and a TLS listener both decrypt at the load balancer, even if they re-encrypt."
        }
      ]
    },

    "asg-core": {
      minutes: 5,
      tldr: [
        "An ASG keeps the number of running instances at <strong>desired</strong>, always between <strong>min</strong> and <strong>max</strong>, spread across AZs.",
        "Use <strong>launch templates</strong> (versioned). Launch configurations are deprecated.",
        "<strong>Target tracking</strong> is the default policy: 'keep average CPU at 50%'. AWS creates and manages the alarms.",
        "<strong>Scheduled</strong> scaling for known calendars, <strong>predictive</strong> for repeating daily patterns, <strong>step</strong> for size-dependent reactions.",
        "Mixed instances: an On-Demand base plus Spot on top, many instance types, <em>price-capacity-optimized</em> allocation."
      ],
      analogy: "An ASG is a thermostat for servers. You set the temperature (target CPU), and it turns the heaters (instances) on and off to hold it, never fewer than min or more than max.",
      examTip: "Target tracking is almost always the best answer for 'keep utilization steady'. For queue workers, the metric is <strong>backlog per instance</strong>. The classic contrast: simple scaling waits out a cooldown; step scaling keeps reacting.",
      terms: [
        { t: "Desired capacity", d: "How many instances the ASG is trying to run right now." },
        { t: "Launch template", d: "Versioned blueprint for new instances: AMI, type, security groups, user data, IAM role." },
        { t: "Target tracking", d: "Scaling policy that adds or removes instances to hold a metric near a target value." },
        { t: "Instance warmup", d: "Time a new instance gets before its metrics count, so scaling doesn't overreact." },
        { t: "Cooldown", d: "Pause after a simple-scaling action before another is allowed. Default 300 s." }
      ],
      check: [
        {
          q: "Traffic reliably jumps every weekday at 9:00, and instances take 10 minutes to boot. What is the best addition to target tracking?",
          options: ["Step scaling on CPU", "Scheduled or predictive scaling", "A longer cooldown", "Larger instance types"],
          answer: 1,
          why: "Scheduled or predictive scaling launches capacity before the known ramp, so it is ready in time. Reactive policies only start after the load has already arrived."
        },
        {
          q: "Workers process jobs from an SQS queue. Which metric should target tracking use?",
          options: ["Total number of messages in the queue", "Messages in the queue divided by the number of instances", "Average CPU of the workers"],
          answer: 1,
          why: "Backlog per instance falls as you add workers, so the loop settles. Raw queue depth barely moves when you add capacity, so the ASG keeps launching up to max."
        }
      ]
    },

    "asg-lifecycle": {
      minutes: 5,
      tldr: [
        "<strong>Lifecycle hooks</strong> pause an instance at launch (Pending:Wait) or termination (Terminating:Wait) so a script can run first.",
        "<strong>Warm pools</strong> keep pre-booted instances parked (usually stopped) so scale-out takes seconds, not minutes.",
        "<strong>Instance refresh</strong> rolls a new AMI/template across the fleet gradually, with checkpoints and rollback.",
        "Turn on the <strong>ELB health check type</strong> so the ASG replaces instances whose app is broken, and set the <strong>grace period</strong> longer than boot time.",
        "<strong>Scale-in protection</strong> keeps busy instances from being picked at scale-in; <strong>Standby</strong> takes one out for debugging."
      ],
      analogy: "Lifecycle hooks are the handover between shifts: a new worker gets a briefing before starting, and a leaving worker files their notes before going home. Warm pools are staff waiting in the break room, dressed and ready.",
      examTip: "'Upload logs or finish work before scale-in terminates the instance' &rarr; Terminating:Wait lifecycle hook. 'ASG keeps terminating and relaunching new instances' &rarr; health check grace period shorter than boot time.",
      terms: [
        { t: "Lifecycle hook", d: "A pause in launch or termination (default 1 hour) until your automation signals CONTINUE or ABANDON." },
        { t: "Warm pool", d: "Pre-initialized instances kept stopped, running or hibernated, ready to join quickly." },
        { t: "Instance refresh", d: "Built-in rolling replacement of all instances, keeping a minimum healthy percentage (default 90%)." },
        { t: "Health check grace period", d: "Time after launch before health checks count. Default 300 s." },
        { t: "Default termination policy", d: "Pick the AZ with most instances, then oldest template, then closest to billing hour, then random." }
      ],
      check: [
        {
          q: "Instances must copy their logs to S3 before the ASG terminates them at scale-in. What do you use?",
          options: ["EC2 termination protection", "A longer deregistration delay", "A Terminating:Wait lifecycle hook", "Scale-in protection on all instances"],
          answer: 2,
          why: "The termination hook pauses the instance so a script can upload the logs, then termination continues. Deregistration delay only covers load balancer connections, not background work."
        },
        {
          q: "An app takes 4 minutes to start, the grace period is 60 s, and ELB health checks are on. What happens?",
          options: ["Instances are marked unhealthy mid-boot and replaced in a loop", "The ASG waits until the app is ready", "The load balancer fails open and nothing changes"],
          answer: 0,
          why: "Health checks start counting after 60 s, the app isn't up yet, so the ASG kills and relaunches forever. Set the grace period above the real boot time."
        }
      ]
    }
  }
});
