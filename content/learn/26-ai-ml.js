window.COURSE.registerLearn({
  moduleId: "ai-ml",
  bigPicture: "AWS offers AI at three levels. <strong>Ready-made AI APIs</strong> (Rekognition, Textract, Comprehend…) do one job each with no ML skills needed — this is what SAA-C03 tests, as simple “keyword to service” matching. <strong>SageMaker</strong> is the workshop for teams that build their own models. <strong>Bedrock</strong> is one API to many foundation models for generative AI, plus RAG, guardrails and agents. The exam barely touches Bedrock yet, but it is everyday work for an architect in 2026 — and it reuses everything you already know about IAM, VPCs, queues and logging.",
  cheatsheet: [
    { k: "Extract key-value pairs and tables from scanned forms", v: "<strong>Textract</strong> — documents with structure, not just OCR" },
    { k: "Detect objects, faces or unsafe content in images/video", v: "<strong>Rekognition</strong>" },
    { k: "Sentiment, entities or PII in text", v: "<strong>Comprehend</strong>" },
    { k: "Speech to text, call transcripts, redact PII from audio", v: "<strong>Transcribe</strong> (ears)" },
    { k: "Text to lifelike speech", v: "<strong>Polly</strong> (mouth)" },
    { k: "Chatbot with intents and slots", v: "<strong>Lex</strong>" },
    { k: "Natural-language enterprise search, respects document permissions", v: "<strong>Kendra</strong>" },
    { k: "Personalized recommendations from click data", v: "<strong>Personalize</strong>" },
    { k: "“No ML expertise”, “least operational overhead”", v: "A <strong>managed AI API</strong>, never SageMaker" },
    { k: "SageMaker: intermittent traffic, tolerate cold starts", v: "<strong>Serverless inference</strong>" },
    { k: "SageMaker: score a whole dataset nightly, no endpoint", v: "<strong>Batch transform</strong>" },
    { k: "SageMaker: huge payloads or minutes-long inference", v: "<strong>Asynchronous inference</strong>" },
    { k: "Cheap interruptible model training", v: "<strong>Managed Spot training</strong> with checkpoints" },
    { k: "Generative AI via API, no infrastructure", v: "<strong>Amazon Bedrock</strong>" },
    { k: "Answers grounded in changing internal docs, with citations", v: "<strong>Bedrock Knowledge Bases</strong> (RAG), not fine-tuning" },
    { k: "Block PII and off-topic content across many models", v: "<strong>Bedrock Guardrails</strong>" },
    { k: "Audit the actual prompts and completions", v: "<strong>Model invocation logging</strong> — CloudTrail has no payloads" },
    { k: "Call Bedrock from private subnets with no internet", v: "<strong>Interface VPC endpoint</strong> (PrivateLink)" },
    { k: "Discover PII sitting in S3 buckets", v: "<strong>Macie</strong>" },
    { k: "Agent tool can read other users’ data", v: "Scope the tool’s IAM to the <strong>calling user</strong> (confused deputy)" }
  ],
  lessons: {
    "managed-ai-services": {
      minutes: 5,
      tldr: [
        "Managed AI services are <strong>pre-trained APIs</strong>: send data, get an answer, pay per unit. No models, no GPUs.",
        "The exam is pure keyword matching: Textract = documents, Rekognition = images/video, Comprehend = text meaning, Transcribe = speech to text, Polly = text to speech.",
        "Also: Translate, Lex (chatbots), Kendra (enterprise search), Personalize (recommendations). Forecast and Fraud Detector are closed to new customers but still exam keywords.",
        "“Least operational overhead” with a generic task means a managed API, not SageMaker.",
        "Set the Organizations <strong>AI services opt-out policy</strong> so AWS does not use your content to improve these services."
      ],
      analogy: "These services are like hiring specialists by the hour: a translator, a stenographer, a document clerk. You hand them the work and pay per job — you never train them or give them a desk.",
      examTip: "Learn the confusable pairs: <strong>Textract vs Rekognition</strong> (documents vs photos), <strong>Transcribe vs Polly</strong> (direction), <strong>Comprehend vs Translate</strong> (understand vs convert), <strong>Personalize vs Forecast</strong> (per-user recommendations vs time series).",
      terms: [
        { t: "Textract", d: "Reads scanned documents and returns structure: forms as key-value pairs and tables as cells." },
        { t: "Rekognition", d: "Analyzes images and video: labels, faces, text in photos, unsafe content." },
        { t: "Comprehend", d: "Natural-language processing: entities, sentiment, classification, PII detection in text." },
        { t: "Kendra", d: "Managed natural-language search across company sources, respecting each user’s permissions." },
        { t: "AI services opt-out policy", d: "Organizations policy that stops AWS using your content to improve AI services." }
      ],
      check: [
        {
          q: "A company needs to pull invoice totals and line-item tables from scanned PDFs with the least effort. Which service?",
          options: ["Rekognition", "Textract", "Comprehend", "SageMaker with a custom model"],
          answer: 1,
          why: "Textract returns document structure (key-value pairs, tables). Rekognition reads text in photos without structure, and Comprehend needs text as input, not images."
        },
        {
          q: "A call center wants recordings turned into text with customer card numbers removed. Which service?",
          options: ["Polly", "Transcribe with PII redaction", "Translate"],
          answer: 1,
          why: "Transcribe converts speech to text and can redact PII. Polly goes the other way (text to speech)."
        }
      ]
    },

    "sagemaker": {
      minutes: 5,
      tldr: [
        "SageMaker (now called <strong>SageMaker AI</strong>) is the ML platform for teams that <strong>build their own models</strong>: notebooks, training jobs, registry, pipelines, feature store.",
        "Four inference modes: <strong>real-time</strong> (always on), <strong>serverless</strong> (scales to zero), <strong>asynchronous</strong> (big or slow requests), <strong>batch transform</strong> (whole dataset, no endpoint).",
        "Real-time endpoints bill <strong>every hour they exist</strong>, used or not — the classic bill surprise.",
        "<strong>Managed Spot training</strong> with checkpoints cuts training cost sharply.",
        "Pick managed AI API for generic tasks, Bedrock for generative tasks, SageMaker for your own predictive models."
      ],
      analogy: "If the managed AI APIs are buying bread, SageMaker is renting a fully equipped bakery. You can bake anything, but you pay for the ovens while they are switched on — even if nobody buys a loaf.",
      examTip: "“Intermittent traffic, pay only when used” means <strong>serverless inference</strong>; “score everything nightly” means <strong>batch transform</strong>; “large payloads, minutes of processing” means <strong>async inference</strong>. If the question says “no ML expertise,” SageMaker is wrong.",
      terms: [
        { t: "Real-time endpoint", d: "Always-on HTTPS endpoint on instances you pay for per hour." },
        { t: "Serverless inference", d: "Endpoint that scales to zero and bills per request, with cold starts." },
        { t: "Batch transform", d: "A temporary job that scores a whole S3 dataset, then shuts down." },
        { t: "JumpStart", d: "Catalog of pre-trained and foundation models you deploy into your own account." },
        { t: "Multi-model endpoint", d: "Many models share one endpoint fleet, loaded from S3 on demand — cheap for per-tenant models." }
      ],
      check: [
        {
          q: "A model must score 50 million rows every night and nothing else. Which SageMaker option is cheapest?",
          options: ["Real-time endpoint with auto scaling", "Batch transform", "Serverless inference", "Asynchronous inference"],
          answer: 1,
          why: "Batch transform runs only for the job and leaves no endpoint behind. A real-time endpoint bills all day for a once-a-night job."
        },
        {
          q: "A demo endpoint got zero requests last month but cost over $1,000. Why?",
          options: ["Serverless cold starts", "Real-time endpoints bill per instance-hour while deployed", "Spot training was interrupted"],
          answer: 1,
          why: "Classic real-time endpoints do not scale to zero, so they bill every hour. Use serverless or async modes for idle-heavy traffic, and sweep unused endpoints."
        }
      ]
    },

    "bedrock-core": {
      minutes: 5,
      tldr: [
        "Bedrock is <strong>one serverless API for many foundation models</strong> (Claude, Nova, Llama, Mistral…) with IAM, CloudTrail, KMS and PrivateLink built in.",
        "Use the <strong>Converse API</strong> so you can swap models easily. IAM can allow or deny specific models by ARN.",
        "Since late 2025 models are <strong>enabled automatically</strong>; control access with IAM and SCPs (Anthropic still needs a one-time use-case form).",
        "Pricing: <strong>on-demand</strong> per token, <strong>provisioned throughput</strong> for reserved capacity, <strong>batch</strong> at about half price; plus Priority/Flex tiers.",
        "<strong>Invocation logging</strong> is off by default and is the only way to capture prompt contents."
      ],
      analogy: "Bedrock is to AI models what RDS is to databases: you stop running the engine yourself and just use it through an AWS API, with the same locks and logs as any other AWS service.",
      examTip: "SAA-C03 knows Bedrock only as “managed generative AI through an API.” The real-world trap: <strong>CloudTrail shows who called which model, but not the prompt</strong> — for that you need model invocation logging.",
      terms: [
        { t: "Foundation model", d: "A large pre-trained model (text, image, embeddings) you use as-is or adapt." },
        { t: "Converse API", d: "One chat and tool-use format that works across Bedrock models." },
        { t: "Token", d: "A chunk of text (roughly ¾ of a word) — the unit Bedrock charges for, input and output." },
        { t: "Provisioned throughput", d: "Reserved model capacity billed hourly; needed to serve most fine-tuned models." },
        { t: "Cross-region inference profile", d: "A model ID (e.g. us. or eu.) that lets Bedrock serve you from any Region in that geography." },
        { t: "Model invocation logging", d: "Opt-in logging of full prompts and responses to S3 or CloudWatch Logs." }
      ],
      check: [
        {
          q: "Security must see the exact prompts sent to Bedrock. CloudTrail is on. What else is needed?",
          options: ["Nothing, CloudTrail logs prompts", "Enable model invocation logging", "Enable GuardDuty", "Turn on VPC Flow Logs"],
          answer: 1,
          why: "CloudTrail records the API call, not the payload. Invocation logging delivers the prompt and response bodies. GuardDuty and Flow Logs never see prompt text."
        },
        {
          q: "A team must be blocked from using an expensive model on Bedrock. How is that done today?",
          options: ["Leave it disabled on the model access page", "Deny that model’s ARN in IAM or an SCP", "Delete the model from the account"],
          answer: 1,
          why: "Models are now enabled by default and the model access page is retired, so control is an IAM or SCP deny on the model or inference-profile ARN."
        }
      ]
    },

    "bedrock-rag-agents": {
      minutes: 5,
      tldr: [
        "<strong>Knowledge Bases</strong> = managed RAG: chunk your documents, embed them, store vectors, then retrieve relevant passages and answer with citations.",
        "Vector store choices: OpenSearch Serverless (default, has a minimum monthly cost), Aurora pgvector, S3 Vectors (cheap, large), Kendra, partners.",
        "<strong>Guardrails</strong> = one reusable safety policy: content filters, denied topics, PII masking, grounding checks against hallucination.",
        "<strong>Agents</strong> run the plan-act-observe loop with Lambda tools; <strong>AgentCore</strong> hosts agents built with your own framework.",
        "Rule: <strong>knowledge → RAG, behaviour → fine-tune</strong>, and try prompt engineering before either."
      ],
      analogy: "RAG is an open-book exam: the model looks up the right pages before answering, so you just update the book when facts change. Fine-tuning is sending the model to a training course — good for changing how it writes, useless for keeping facts current.",
      examTip: "“Answers from frequently changing internal documents, with citations, least effort” means <strong>Knowledge Bases (RAG)</strong>, not fine-tuning. “Block PII and off-topic answers across several models” means <strong>Guardrails</strong>.",
      terms: [
        { t: "RAG", d: "Retrieval-augmented generation: fetch relevant text first, then let the model answer from it." },
        { t: "Embedding", d: "A list of numbers representing meaning; similar texts get nearby vectors." },
        { t: "Chunking", d: "Splitting documents into passages before embedding — the main quality knob for RAG." },
        { t: "Contextual grounding check", d: "Guardrail that blocks answers not supported by the retrieved sources." },
        { t: "Fine-tuning", d: "Further training a model on labeled examples to change its style or behaviour." }
      ],
      check: [
        {
          q: "An HR chatbot must answer from policy documents that change monthly, with citations. What should you build?",
          options: ["Fine-tune a model every month", "A Bedrock Knowledge Base over the documents in S3", "Put all documents in the system prompt", "Train a SageMaker model"],
          answer: 1,
          why: "RAG picks up document changes with a re-sync and gives citations. Monthly fine-tuning is costly, slow, and does not reliably teach facts."
        },
        {
          q: "A company wants the same rules (no investment advice, mask PII) for every app and model. What fits?",
          options: ["Copy the rules into every system prompt", "Bedrock Guardrails attached to the invocations", "Use a bigger model"],
          answer: 1,
          why: "Guardrails are one versioned policy applied uniformly. Prompt copies drift between teams and are easy to bypass."
        }
      ]
    },

    "genai-patterns": {
      minutes: 5,
      tldr: [
        "RAG has a write path (parse, chunk, embed, store) and a read path (embed question with the <strong>same model</strong>, search, filter by permissions, generate).",
        "<strong>Authorization belongs in retrieval</strong>, not in the prompt: filter results by what the caller may see.",
        "Answers are slow: <strong>stream</strong> tokens (Lambda function URL streaming, ALB with SSE, AppSync, or API Gateway REST in STREAM mode) or go <strong>async</strong> with SQS.",
        "Cost levers: <strong>route easy questions to small models</strong>, prompt caching, response caching, max-token caps.",
        "Ship prompts like code: versioned, evaluated against a test set, canaried."
      ],
      analogy: "A GenAI app is like a restaurant with a brilliant but slow and expensive chef. You send simple orders to the junior cook, reuse dishes you have already made, serve courses as they are ready, and never let the chef keep cooking without a limit.",
      examTip: "Mostly real-world, not exam. Two ideas the exam does reward: a <strong>queue (SQS) in front of a rate-limited service</strong> turns throttling into backpressure, and <strong>DynamoDB alone is not a vector database</strong>.",
      terms: [
        { t: "Vector store", d: "A database that finds the nearest vectors to a query — the search engine behind RAG." },
        { t: "ANN / HNSW", d: "Approximate nearest-neighbour search: fast, slightly imperfect matching over many vectors." },
        { t: "Prompt caching", d: "Reusing a repeated prompt prefix so those input tokens cost much less." },
        { t: "Model tiering", d: "Sending each request to the cheapest model that can handle it." },
        { t: "Eval set", d: "Saved real prompts with expected answers used to test prompt or model changes." }
      ],
      check: [
        {
          q: "A summarize-this-PDF feature often takes minutes and gets throttled at peaks. What pattern fits?",
          options: ["Synchronous call through API Gateway", "SQS queue with workers calling Bedrock, result stored and user notified", "Bigger Lambda memory"],
          answer: 1,
          why: "Async with a queue absorbs bursts and turns throttling into backpressure. Long synchronous calls hit timeouts and fail under load."
        },
        {
          q: "Which store cannot do vector search on its own?",
          options: ["OpenSearch", "Aurora PostgreSQL with pgvector", "DynamoDB", "S3 Vectors"],
          answer: 2,
          why: "DynamoDB can store chunks and metadata but has no native similarity search; it must be paired with a real vector index."
        }
      ]
    },

    "data-foundations": {
      minutes: 4,
      tldr: [
        "GenAI quality is mostly a <strong>data problem</strong>: duplicates, stale drafts and junk formatting poison retrieval.",
        "Event-driven embedding: <strong>S3 event → SQS → Lambda/Step Functions → embed → upsert</strong>, with idempotent IDs and deletes handled too.",
        "A vector index is a derived copy: plan freshness, reconcile it with the source, and rebuild it if you change the embedding model.",
        "PII in layers: <strong>Macie</strong> finds it in S3, <strong>Comprehend</strong> redacts before indexing, <strong>Guardrails</strong> mask at answer time, retrieval filters by user."
      ],
      analogy: "A vector index is like a library catalogue. If books are removed but their cards stay, or a secret HR file is catalogued by mistake, the librarian will cheerfully point people to the wrong — or private — shelf.",
      examTip: "The exam tests the building blocks: “discover PII in S3” means <strong>Macie</strong>; “detect or redact PII in text” means <strong>Comprehend</strong>; “process new S3 objects reliably” means S3 events → SQS (with DLQ) → Lambda.",
      terms: [
        { t: "Embedding pipeline", d: "Automated flow that turns new or changed documents into vectors in the index." },
        { t: "Idempotent upsert", d: "Writing with a fixed ID so repeating it does not create duplicates." },
        { t: "Macie", d: "Scans S3 to discover sensitive data such as PII." },
        { t: "Reconciliation", d: "Regularly comparing the source documents with the index to catch missed updates or deletes." }
      ],
      check: [
        {
          q: "A document was deleted from S3 for being wrong, but the chatbot still quotes it. What was missed?",
          options: ["Handling ObjectRemoved events to delete its vectors", "A larger embedding model", "More chunk overlap"],
          answer: 0,
          why: "The index is a derived copy; deletes must flow through too. Periodic reconciliation would also catch it."
        },
        {
          q: "Which control stops PII from ever entering the vector index?",
          options: ["Guardrails on the model output", "Comprehend PII redaction during ingestion", "CloudTrail logging"],
          answer: 1,
          why: "Redacting before embedding means the data is never indexed, so it cannot leak. Guardrails are the later safety net, and CloudTrail only records API calls."
        }
      ]
    },

    "ai-security": {
      minutes: 5,
      tldr: [
        "LLM security is the <strong>confused deputy</strong> problem: untrusted text can talk the model into misusing its permissions.",
        "<strong>Indirect prompt injection</strong> hides instructions in documents, web pages or emails the model reads. There is no perfect filter.",
        "So design it out: tools run with the <strong>calling user’s</strong> permissions, narrow IAM per tool, human approval for risky actions, treat model output as untrusted.",
        "Bedrock does not use your prompts to train models or share them with providers. Cross-region inference widens where data is processed.",
        "Audit: CloudTrail (who and when), invocation logging (what was said), Guardrail hits and cost anomalies as warning signs."
      ],
      analogy: "An AI agent is like a helpful new assistant with the office master key. If a stranger slips a note into a file saying “also open the safe,” the assistant might do it. The fix is not a smarter assistant — it is only giving them the keys the person asking already has.",
      examTip: "SAA-C03 will not ask about prompt injection, but it tests the same principles: <strong>least privilege</strong>, confused deputy (external ID), <strong>CloudTrail vs data-plane logs</strong>, KMS and PrivateLink. GuardDuty does not inspect prompts.",
      terms: [
        { t: "Prompt injection", d: "Text crafted to make a model ignore its instructions or misuse its tools." },
        { t: "Indirect prompt injection", d: "Malicious instructions hidden in content the model reads, not typed by the user." },
        { t: "Confused deputy", d: "A trusted component tricked into using its authority for someone who lacks it." },
        { t: "Blast radius", d: "How much damage one compromised component can do — keep tool permissions small." }
      ],
      check: [
        {
          q: "An agent tool can read the whole customer table, and a ticket tricks it into listing other customers’ emails. What is the core fix?",
          options: ["Lower the model temperature", "Scope the tool’s access to the requesting user or tenant", "Switch to a bigger model", "Enable GuardDuty"],
          answer: 1,
          why: "The model will sometimes obey injected text, so the tool must only be able to fetch what the caller may see. Temperature and model size do not enforce authorization."
        },
        {
          q: "Which log shows the actual prompt text sent to a Bedrock model?",
          options: ["CloudTrail", "Model invocation logging", "GuardDuty findings"],
          answer: 1,
          why: "CloudTrail shows who invoked which model and when, not the content. Only invocation logging captures prompts and responses."
        }
      ]
    }
  }
});
