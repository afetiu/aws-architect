/* Learning layer — Module 12 Serverless (see content/LEARN.md) */
window.COURSE.registerLearn({
  moduleId: "serverless",
  bigPicture: "Serverless means you hand AWS your code and it runs it on demand, scaling from zero to thousands of copies, and you pay only while it runs. <strong>Lambda</strong> runs the code, <strong>API Gateway</strong> puts an HTTP front door on it, and <strong>Step Functions</strong> strings steps together into reliable workflows. The exam checks you know the limits (15 minutes, concurrency), how retries work on each invocation path, which API Gateway flavour to pick, and when serverless is the wrong tool.",
  cheatsheet: [
    { k: "Eliminate cold starts for a critical API", v: "<strong>Provisioned concurrency</strong> (paid while allocated)" },
    { k: "Slow Java cold starts, spiky traffic, low standing cost", v: "<strong>SnapStart</strong> — resume from a snapshot" },
    { k: "Stop one function starving the others of concurrency", v: "<strong>Reserved concurrency</strong> on the critical function" },
    { k: "Emergency stop a runaway function without deleting it", v: "<strong>Reserved concurrency = 0</strong>" },
    { k: "CPU-bound function too slow", v: "<strong>Increase memory</strong> — CPU scales with it; no CPU setting" },
    { k: "Job runs longer than 15 minutes", v: "Not Lambda: <strong>Step Functions</strong>, Fargate, or Batch" },
    { k: "Capture failed async events with error details", v: "<strong>On-failure destination</strong> (DLQ keeps only the event)" },
    { k: "One bad SQS message makes the whole batch reprocess", v: "<strong>ReportBatchItemFailures</strong> (partial batch response)" },
    { k: "VPC Lambda can't reach the internet", v: "<strong>NAT gateway</strong>; for S3/DynamoDB use a gateway endpoint" },
    { k: "Thousands of Lambdas exhausting database connections", v: "<strong>RDS Proxy</strong>" },
    { k: "Cheapest API for Lambda with JWT/OIDC auth", v: "<strong>HTTP API</strong> (~70% cheaper than REST)" },
    { k: "API keys, per-client quotas, caching, WAF, private API", v: "<strong>REST API</strong>" },
    { k: "API reachable only from inside VPCs", v: "<strong>Private REST API</strong> + interface VPC endpoint" },
    { k: "Callers are AWS services or roles", v: "<strong>IAM (SigV4) authorization</strong>" },
    { k: "Custom or third-party token scheme", v: "<strong>Lambda authorizer</strong> (+ result caching)" },
    { k: "Request takes longer than 29 s behind API Gateway", v: "Go <strong>async</strong>: return 202, process via SQS or Step Functions" },
    { k: "Long workflow, human approval, never run a step twice", v: "<strong>Step Functions Standard</strong> + .waitForTaskToken" },
    { k: "Millions of short, cost-sensitive executions", v: "<strong>Step Functions Express</strong>" },
    { k: "Process millions of S3 objects in parallel, serverless", v: "<strong>Step Functions Distributed Map</strong>" },
    { k: "GraphQL or real-time subscriptions", v: "<strong>AppSync</strong>" }
  ],
  lessons: {
    "lambda-execution-model": {
      minutes: 5,
      tldr: [
        "Each Lambda copy runs in its own tiny VM. One copy handles <strong>exactly one request at a time</strong>; more requests = more copies.",
        "A <strong>cold start</strong> is the setup (download code, start runtime, run init code) happening while a user waits.",
        "Concurrency = requests per second x seconds per request. Default pool: <strong>1,000 per Region</strong>, shared by all functions.",
        "<strong>Reserved</strong> concurrency = a guaranteed slice and a cap (0 = off switch). <strong>Provisioned</strong> = pre-warmed copies, no cold starts, paid.",
        "Each function scales by up to <strong>1,000 new copies every 10 seconds</strong>. Max run time is <strong>15 minutes</strong>."
      ],
      analogy: "Lambda is a taxi rank: each taxi carries one passenger at a time, and new taxis are called when the queue grows. A cold start is waiting for a taxi to arrive and warm up. Provisioned concurrency is paying some taxis to wait at the rank with the engine running.",
      examTip: "&ldquo;Eliminate cold-start latency&rdquo; → <strong>provisioned concurrency</strong>. &ldquo;Guarantee capacity / stop one function eating all concurrency&rdquo; → <strong>reserved concurrency</strong>. &ldquo;Immediately stop a function&rdquo; → reserved concurrency of 0.",
      terms: [
        { t: "Execution environment", d: "One isolated micro-VM running one copy of your function, one request at a time." },
        { t: "Cold start", d: "Delay while a new environment starts and runs your init code before handling a request." },
        { t: "Concurrency", d: "How many requests your function is handling at the same moment." },
        { t: "Reserved concurrency", d: "A fixed share of the account pool for one function; also its maximum." },
        { t: "Provisioned concurrency", d: "Environments kept initialized and warm in advance, billed while allocated." }
      ],
      check: [
        {
          q: "An async batch function scales up and uses almost all account concurrency, so the checkout function gets throttled. What protects checkout?",
          options: ["Provisioned concurrency on the batch function", "Reserved concurrency on the checkout function", "More memory for checkout"],
          answer: 1,
          why: "Reserved concurrency sets aside capacity only checkout can use, so others can't starve it. Provisioned concurrency is about cold starts, not sharing."
        },
        {
          q: "A function averages 200 ms per request and receives 500 requests per second. Roughly what concurrency does it need?",
          options: ["100", "500", "2,500"],
          answer: 0,
          why: "Concurrency = rate x duration = 500 x 0.2 s = 100 environments in flight at once."
        }
      ]
    },
    "lambda-invocation": {
      minutes: 4,
      tldr: [
        "<strong>Synchronous</strong> (API Gateway, ALB, direct Invoke): caller waits; Lambda does <strong>no retries</strong>. Errors go back to the caller.",
        "<strong>Asynchronous</strong> (S3, SNS, EventBridge): Lambda queues the event and retries <strong>twice</strong> on errors. Use <strong>destinations</strong> for results.",
        "<strong>Event source mappings</strong> (SQS, Kinesis, DynamoDB Streams): Lambda polls the source and invokes your function with batches.",
        "Turn on <strong>ReportBatchItemFailures</strong> so only failed messages are retried, not the whole batch.",
        "Events can arrive more than once on async and polling paths, so make handlers <strong>idempotent</strong>."
      ],
      analogy: "Synchronous is a phone call: you wait on the line for the answer. Asynchronous is leaving a voicemail: Lambda promises to call back and tries a few times. An event source mapping is Lambda checking your mailbox itself and taking out letters in bundles.",
      examTip: "&ldquo;Capture failed async events <em>with the error details</em>&rdquo; → <strong>on-failure destination</strong> (a DLQ only keeps the original event). &ldquo;Reduce duplicate processing of SQS batches&rdquo; → <strong>partial batch response</strong>.",
      terms: [
        { t: "Synchronous invocation", d: "Caller waits for the result; Lambda itself doesn't retry." },
        { t: "Asynchronous invocation", d: "Lambda accepts the event, queues it internally, and retries on failure." },
        { t: "Destination", d: "Where Lambda sends the result of an async invoke on success or failure (SQS, SNS, EventBridge, Lambda)." },
        { t: "Event source mapping", d: "Lambda-managed poller reading SQS, Kinesis or DynamoDB Streams and invoking in batches." },
        { t: "Partial batch response", d: "Function reports which records failed so only those are retried." }
      ],
      check: [
        {
          q: "S3 triggers a Lambda that sometimes fails after all retries. Ops needs the failed event plus the error message to reprocess it. What should they configure?",
          options: ["A dead-letter queue on the function", "An on-failure destination", "Reserved concurrency"],
          answer: 1,
          why: "Destinations get the full invocation record, including the error. A DLQ receives only the original event, without the error context."
        },
        {
          q: "An SQS-triggered Lambda processes batches of 10. One bad message causes all 10 to be retried. Which setting fixes this most directly?",
          options: ["Enable ReportBatchItemFailures and return the failed IDs", "Reduce the batch size to 1", "Increase the function timeout"],
          answer: 0,
          why: "Partial batch response deletes the successful messages and retries only the failed one. Batch size 1 works but gives up batching efficiency."
        }
      ]
    },
    "lambda-tuning": {
      minutes: 4,
      tldr: [
        "Memory (128 MB to 10 GB) is the <strong>only performance knob</strong>. CPU grows with it: about <strong>1 vCPU at 1,769 MB</strong>.",
        "More memory can be <strong>faster and cheaper</strong> for CPU-heavy code. Test with Lambda Power Tuning instead of guessing.",
        "Timeout max <strong>15 minutes</strong>. <strong>/tmp</strong> is 512 MB free, up to 10 GB, and disappears with the environment.",
        "<strong>Layers</strong> share libraries (max 5, counted in the 250 MB unzipped limit). They help packaging, not speed.",
        "<strong>Versions</strong> are frozen snapshots; <strong>aliases</strong> point to them and can split traffic between two versions for canaries."
      ],
      analogy: "Lambda memory is like choosing a car size where engine power comes with the size: a bigger car finishes the trip sooner, so the total fuel bill can actually be lower.",
      examTip: "&ldquo;CPU-bound function is slow or timing out&rdquo; → <strong>increase memory</strong>. Any option offering a separate CPU setting is fake. Canary rollout of a new version → <strong>alias weighted routing</strong> (with CodeDeploy).",
      terms: [
        { t: "Memory setting", d: "Sets RAM and, in proportion, CPU and network for a function." },
        { t: "/tmp storage", d: "Local scratch disk per environment, 512 MB to 10 GB, not shared, not permanent." },
        { t: "Layer", d: "Extra zip of libraries or tools mounted at /opt, shared across functions." },
        { t: "Version", d: "An immutable snapshot of a function's code and settings." },
        { t: "Alias", d: "A named pointer (like prod) to a version; can split traffic between two versions." }
      ],
      check: [
        {
          q: "A CPU-heavy image function at 512 MB is slow. How do you give it more CPU?",
          options: ["Set a higher vCPU count in the configuration", "Increase the memory setting", "Add a layer with faster libraries"],
          answer: 1,
          why: "Lambda has no separate CPU setting; CPU is allocated in proportion to memory. More memory often makes CPU-bound work cheaper too."
        },
        {
          q: "You want 10% of traffic on a new function version, with automatic rollback on errors, without changing the API integration. What do you use?",
          options: ["Two separate functions behind Route 53 weighted records", "An alias with weighted routing between versions, driven by CodeDeploy", "Publishing to $LATEST"],
          answer: 1,
          why: "The integration points at an alias; the alias splits traffic between two versions, and CodeDeploy shifts it and rolls back on alarms."
        }
      ]
    },
    "lambda-vpc-snapstart": {
      minutes: 4,
      tldr: [
        "Attach Lambda to your VPC to reach private resources like RDS or ElastiCache. Shared <strong>Hyperplane ENIs</strong> mean no big cold-start penalty anymore.",
        "A VPC-attached Lambda <strong>loses internet access</strong>. Add a <strong>NAT gateway</strong>, or gateway endpoints for S3 and DynamoDB.",
        "Many Lambdas can overwhelm a relational database with connections. <strong>RDS Proxy</strong> pools them.",
        "<strong>SnapStart</strong> snapshots an initialized function and resumes from it, cutting Java cold starts to a few hundred ms (also Python and .NET).",
        "SnapStart needs published versions and can't be combined with provisioned concurrency."
      ],
      analogy: "SnapStart is like saving a video game after the long loading screen: every new player starts from the save point instead of loading from scratch. RDS Proxy is a switchboard that lets hundreds of callers share a few phone lines into the database.",
      examTip: "&ldquo;VPC Lambda can't reach an external API&rdquo; → <strong>NAT gateway</strong> (if the target is S3 or DynamoDB, a <strong>gateway endpoint</strong> is the cheaper answer). &ldquo;Too many database connections from Lambda&rdquo; → <strong>RDS Proxy</strong>.",
      terms: [
        { t: "VPC-attached Lambda", d: "A function given subnets and security groups so it can reach private resources." },
        { t: "Hyperplane ENI", d: "Shared network interface Lambda creates per subnet and security group, set up at deploy time." },
        { t: "NAT gateway", d: "Lets resources in private subnets reach the internet; billed per hour and per GB." },
        { t: "RDS Proxy", d: "Managed connection pool between many Lambda copies and a relational database." },
        { t: "SnapStart", d: "Starts new environments from a saved snapshot of an already-initialized function." }
      ],
      check: [
        {
          q: "After attaching a Lambda to private subnets to reach RDS, its calls to a third-party HTTPS API time out. What fixes this?",
          options: ["Move the Lambda to a public subnet", "Route the private subnets through a NAT gateway", "Increase the function timeout"],
          answer: 1,
          why: "VPC Lambdas get no public IP, so a public subnet doesn't help. Private subnets need a NAT gateway to reach the internet."
        },
        {
          q: "A Java Lambda with spiky, unpredictable traffic has 5-second cold starts. The team wants low latency without paying for idle warm capacity. What fits?",
          options: ["Provisioned concurrency", "SnapStart", "A bigger deployment package"],
          answer: 1,
          why: "SnapStart cuts cold starts at any concurrency with no standing cost for Java. Provisioned concurrency is billed all the time, even when idle."
        }
      ]
    },
    "api-gateway-types": {
      minutes: 4,
      tldr: [
        "<strong>HTTP API</strong>: cheaper (~70%) and faster, with built-in JWT auth. The default choice for simple Lambda APIs.",
        "<strong>REST API</strong>: needed for API keys and usage plans, caching, request transformation, WAF, or a <strong>private</strong> endpoint.",
        "<strong>WebSocket API</strong>: two-way live connections; store connection IDs (usually in DynamoDB) to push messages.",
        "REST endpoint types: <strong>edge-optimized</strong> (global clients), <strong>Regional</strong>, <strong>private</strong> (VPC only, via an interface endpoint).",
        "Integrations time out at <strong>29 seconds</strong> by default. For long work, reply 202 and process asynchronously."
      ],
      analogy: "HTTP API is the budget airline: gets you there cheaply and quickly with the essentials. REST API is the full-service airline with lounges, luggage rules and loyalty tiers — you pay more for the extras like caching and API keys.",
      examTip: "&ldquo;Most cost-effective&rdquo; with simple Lambda + JWT → <strong>HTTP API</strong>. Any REST-only need (API keys/usage plans, caching, mapping templates, private, WAF) → <strong>REST API</strong>. &ldquo;Not reachable from the internet&rdquo; → <strong>private endpoint</strong>.",
      terms: [
        { t: "HTTP API", d: "Lean, cheaper API Gateway type with native JWT authorizers; Regional only." },
        { t: "REST API", d: "Full-featured API Gateway type: usage plans, caching, VTL transforms, private endpoints." },
        { t: "Edge-optimized endpoint", d: "REST API fronted by an AWS-managed CloudFront network for global clients." },
        { t: "Private endpoint", d: "REST API reachable only through an interface VPC endpoint." },
        { t: "Service integration", d: "API Gateway calling an AWS service like SQS directly, with no Lambda in between." }
      ],
      check: [
        {
          q: "A simple Lambda-backed API needs JWT auth with Okta and the lowest per-request cost. No caching or API keys. Which type?",
          options: ["REST API, edge-optimized", "HTTP API with a JWT authorizer", "WebSocket API"],
          answer: 1,
          why: "HTTP APIs are much cheaper and have a built-in JWT authorizer for any OIDC provider. REST's extra features aren't needed here."
        },
        {
          q: "A report endpoint's Lambda takes 45 seconds, and API Gateway returns 504 errors. What is the best design fix?",
          options: ["Raise the Lambda timeout to 15 minutes", "Return 202 immediately and generate the report asynchronously", "Switch to an HTTP API"],
          answer: 1,
          why: "API Gateway's integration timeout (29 s by default) is the limit, not Lambda's. Long work should run in the background and the client fetches the result later."
        }
      ]
    },
    "api-gateway-auth-throttling": {
      minutes: 4,
      tldr: [
        "<strong>IAM auth</strong>: for callers inside AWS (services, roles). <strong>Cognito / JWT</strong> authorizers: for app users signed in with a user pool or OIDC.",
        "<strong>Lambda authorizer</strong>: your own code for custom tokens. Cache its result (up to 1 hour) to save cost and latency.",
        "Throttling uses layered limits: account default <strong>10,000 requests/s, burst 5,000</strong>. Over the limit → <strong>429</strong>.",
        "<strong>Usage plans + API keys</strong> (REST only) give each client its own rate limit and quota. API keys are for metering, <strong>not security</strong>.",
        "REST <strong>stage caching</strong> (0.5-237 GB) is billed per hour; include every varying parameter in the cache key."
      ],
      analogy: "API keys are like a gym membership card that counts your visits; it proves which plan you're on but isn't proof of identity. Authorizers are the security guard who checks your ID at the door.",
      examTip: "Internal AWS callers → <strong>IAM</strong>. Web/mobile users → <strong>Cognito</strong> (or JWT on HTTP API). Custom tokens → <strong>Lambda authorizer</strong>. Per-client rate limits for third parties → <strong>usage plans + API keys</strong>. API keys alone are never the authentication answer.",
      terms: [
        { t: "IAM authorization", d: "Callers sign requests with AWS credentials; IAM policies decide access." },
        { t: "Cognito authorizer", d: "API Gateway checks a JWT issued by a Cognito user pool before calling the backend." },
        { t: "Lambda authorizer", d: "Your function checks a token or request and returns an allow/deny policy." },
        { t: "Usage plan", d: "Per-client throttle and quota, tied to API keys (REST APIs only)." },
        { t: "429 Too Many Requests", d: "Response when a throttle limit is exceeded; clients should back off and retry." }
      ],
      check: [
        {
          q: "Partners must each get their own request rate limit and monthly quota on your API. What do you use?",
          options: ["HTTP API with a JWT authorizer", "REST API usage plans with API keys", "A Lambda authorizer with caching"],
          answer: 1,
          why: "Usage plans attach per-client throttles and quotas to API keys — a REST API feature. Authentication should still use a real authorizer."
        },
        {
          q: "Backend services running on EC2 with IAM roles need to call an internal API. Which authorization is simplest and strongest?",
          options: ["API keys", "IAM (SigV4) authorization", "A Cognito user pool"],
          answer: 1,
          why: "Callers already have IAM roles, so SigV4 signing needs no extra infrastructure. Cognito is for end users, and API keys aren't security."
        }
      ]
    },
    "step-functions-core": {
      minutes: 4,
      tldr: [
        "<strong>Step Functions</strong> runs workflows defined as state machines, with built-in retries, error handling and a full history.",
        "<strong>Standard</strong>: up to <strong>1 year</strong>, each step runs <strong>exactly once</strong>, priced per state transition. For long, auditable workflows.",
        "<strong>Express</strong>: up to <strong>5 minutes</strong>, at-least-once, priced by requests and duration. For huge volumes of short jobs.",
        "States: Task, Choice, Parallel, Map, Wait (free pause up to a year), Pass, Succeed, Fail.",
        "Data between states is capped at <strong>256 KB</strong> — pass S3 links, not big files. Use Retry and Catch instead of retry code."
      ],
      analogy: "Step Functions is a project manager with a checklist: it hands each task to the right worker, waits, retries if something fails, takes a different path if needed, and keeps a written record of every step.",
      examTip: "&ldquo;Coordinate several Lambdas with retries and error handling, no orchestration code&rdquo; → <strong>Step Functions</strong>. &ldquo;Runs days, audit trail, never repeat a step&rdquo; → <strong>Standard</strong>. &ldquo;Millions of short runs, duplicates OK, cost-sensitive&rdquo; → <strong>Express</strong>.",
      terms: [
        { t: "State machine", d: "A workflow definition of states and transitions, written in Amazon States Language (JSON)." },
        { t: "Standard workflow", d: "Long-running (up to 1 year), exactly-once, full history, billed per transition." },
        { t: "Express workflow", d: "Short (up to 5 minutes), high-volume, at-least-once, billed per request and duration." },
        { t: "Retry / Catch", d: "Declared rules for retrying errors with backoff, then routing to a fallback state." },
        { t: "Wait state", d: "Pauses a workflow for a time or until a date, at no compute cost." }
      ],
      check: [
        {
          q: "An insurance claim workflow can take two weeks waiting for a human, must never pay twice, and needs a full audit history. Which option fits?",
          options: ["Step Functions Express", "Step Functions Standard", "A Lambda function with a long timeout"],
          answer: 1,
          why: "Standard runs up to a year with exactly-once steps and full history. Express stops at 5 minutes, and Lambda stops at 15."
        },
        {
          q: "A pipeline runs a 4-step, 20-second workflow 80 million times a month. Duplicates are fine and cost matters most. Which type?",
          options: ["Standard", "Express", "Either — the price is the same"],
          answer: 1,
          why: "Express is priced by requests and duration, far cheaper at this volume than Standard's per-transition pricing, and duplicates are acceptable."
        }
      ]
    },
    "step-functions-patterns": {
      minutes: 4,
      tldr: [
        "<strong>Request-response</strong>: start something and move on. <strong>.sync</strong>: start a job (e.g. Fargate, Batch) and <strong>wait until it finishes</strong>.",
        "<strong>.waitForTaskToken</strong>: pause until someone sends the token back — human approvals and external systems.",
        "<strong>Distributed Map</strong> reads items from S3 and runs up to <strong>10,000</strong> child workflows in parallel — serverless processing of millions of objects.",
        "<strong>Saga pattern</strong>: each step has an 'undo' step, run on failure (refund, release stock).",
        "Serverless is the wrong fit for steady heavy load, jobs over 15 minutes, stateful servers, or strict latency floors."
      ],
      analogy: "A task token is a claim ticket: the workflow hands it to someone (a manager, another system), goes quiet at no cost, and only continues when that ticket comes back stamped 'approved' or 'rejected'.",
      examTip: "&ldquo;Pause until a manager approves&rdquo; → <strong>.waitForTaskToken</strong>. &ldquo;Run a container job and continue when done&rdquo; → <strong>.sync</strong>. &ldquo;Process millions of S3 objects in parallel, serverless&rdquo; → <strong>Distributed Map</strong>. &ldquo;GraphQL / real-time subscriptions&rdquo; → <strong>AppSync</strong>.",
      terms: [
        { t: ".sync integration", d: "Step Functions starts a job and waits for it to complete before moving on." },
        { t: "Task token", d: "A unique token the workflow waits on until SendTaskSuccess or SendTaskFailure is called." },
        { t: "Distributed Map", d: "Map state that reads a large dataset from S3 and runs items as parallel child workflows." },
        { t: "Saga pattern", d: "Multi-step transaction where each step has a compensating action to undo it on failure." },
        { t: "AppSync", d: "Managed GraphQL API service with built-in real-time subscriptions." }
      ],
      check: [
        {
          q: "A purchase-approval workflow must stop and wait until a manager clicks Approve in an email, which may take days. Which pattern fits?",
          options: ["A Lambda polling a database every minute", "A Task state using .waitForTaskToken", "An Express workflow with a Wait state"],
          answer: 1,
          why: "The callback pattern pauses the workflow for free until the token is returned. Express can't run for days, and polling wastes money."
        },
        {
          q: "A nightly job must transform 4 million objects under an S3 prefix, serverless and highly parallel. What should the team use?",
          options: ["Inline Map state", "Distributed Map state", "One Lambda looping over all objects"],
          answer: 1,
          why: "Distributed Map reads the S3 listing directly and runs up to 10,000 child executions at once. Inline Map is bound by the 256 KB payload, and one Lambda hits 15 minutes."
        }
      ]
    }
  }
});
