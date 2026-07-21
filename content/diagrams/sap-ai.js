/* Interactive diagrams: multi-account, ai-ml, devops-iac modules. */

window.COURSE.registerDiagram({
  id: "org-structure",
  moduleId: "multi-account",
  title: "A production AWS Organization",
  sub: "The reference landing-zone shape: locked management account, OUs as policy boundaries, one identity front door, one immutable audit sink.",
  w: 780, h: 400,
  nodes: [
    { id: "idc", x: 20, y: 15, w: 150, h: 44, color: "orange", label: "Identity Center", sub: "SSO, no IAM users",
      info: "The single human entry point. Federates your IdP (SAML + SCIM), then vends short-lived STS credentials via permission sets — templates that stamp an identical role into every assigned account. Long-lived IAM users and access keys are what this design exists to eliminate." },
    { id: "scp", x: 210, y: 15, w: 140, h: 44, color: "yellow", label: "SCPs", sub: "guardrails at OUs",
      info: "Service Control Policies never GRANT anything — they define the maximum an account can ever do. Effective permissions are the intersection of every SCP on the path root → OU → account, evaluated before any IAM policy. Attach them at OU level, not per-account, or you rebuild them forever." },
    { id: "mgmt", x: 390, y: 15, w: 160, h: 44, color: "red", label: "Management acct", sub: "billing only, locked",
      info: "Pays the consolidated bill, owns the org and authors SCPs — and SCPs do not apply to it, so its compromise is game over. Keep zero workloads here, near-zero permission sets, hardware MFA on root, and alarm on every login. The exam loves 'what belongs in the management account?' — answer: almost nothing." },
    { id: "workloads", x: 20, y: 110, w: 235, h: 190, zone: true, label: "Workloads OU" },
    { id: "security", x: 275, y: 110, w: 230, h: 190, zone: true, label: "Security OU" },
    { id: "infra", x: 525, y: 110, w: 235, h: 190, zone: true, label: "Infrastructure OU" },
    { id: "prod", x: 50, y: 150, w: 150, h: 44, color: "green", label: "Prod account", sub: "blast radius = acct",
      info: "The account boundary is the strongest isolation primitive AWS has: separate limits, separate billing line, separate IAM universe. A leaked credential in dev cannot touch prod because no principal spans the boundary without an explicit cross-account trust." },
    { id: "dev", x: 50, y: 220, w: 150, h: 44, color: "green", label: "Dev account", sub: "loose IAM, tight SCP",
      info: "Developers can be near-admin here precisely because the SCP ceiling caps the damage: banned regions, no leaving the org trail, no IAM user creation. Cheap experimentation with a hard perimeter beats ticket-driven least privilege in practice." },
    { id: "logarchive", x: 300, y: 150, w: 150, h: 44, color: "blue", label: "Log-archive acct", sub: "write-once S3",
      info: "One S3 bucket receiving every account's CloudTrail, Config, and VPC flow logs. Bucket policy allows only the trail service principal to write; an SCP denies delete and policy changes even to this account's own admins. Object Lock in compliance mode makes it legally immutable evidence." },
    { id: "sectool", x: 300, y: 220, w: 150, h: 44, color: "blue", label: "Security tooling", sub: "delegated admin",
      info: "Delegated administrator for GuardDuty, Security Hub, Detective, and IAM Access Analyzer — org-wide visibility without touching the management account. Security engineers work here; they read the archive but cannot alter it. Delegated admin is the pattern the exam wants over 'run it in management'." },
    { id: "network", x: 555, y: 180, w: 150, h: 44, color: "orange", label: "Network account", sub: "TGW, DX, IPAM",
      info: "Owns the Transit Gateway, Direct Connect, centralized egress, and IPAM, shared to workload accounts via RAM. Application teams consume subnets; they cannot re-plumb routing. Centralizing the network in one account is how you keep 200 accounts from becoming 200 snowflake VPCs." }
  ],
  edges: [
    { from: "mgmt", to: "scp", label: "authors" },
    { from: "scp", to: "workloads", label: "inherited", dashed: true },
    { from: "idc", to: "prod", label: "assume role" },
    { from: "prod", to: "logarchive", label: "org trail", dashed: true },
    { from: "dev", to: "logarchive", dashed: true },
    { from: "network", to: "logarchive", dashed: true }
  ],
  flows: [
    { title: "An engineer logs in (zero IAM users)", steps: [
      { lit: ["idc"], text: "The engineer hits the Identity Center start page and authenticates against the corporate IdP — MFA, conditional access, joiner/leaver lifecycle all live in ONE place. There is not a single IAM user or long-lived access key anywhere in the org." },
      { lit: ["idc"], text: "Identity Center maps their group to a <strong>permission set</strong> — say ProdReadOnly — which it has pre-provisioned as an identical IAM role inside every account it is assigned to. Change the permission set once, every account updates." },
      { lit: ["idc->prod", "prod"], text: "Picking the prod account triggers an STS AssumeRole into that stamped role: temporary credentials, 1-12h lifetime, nothing to rotate or leak from a laptop. CloudTrail records the human identity on every call via the session name." },
      { lit: ["mgmt"], text: "Note what is NOT assignable: almost nobody holds a permission set on the management account. Day-to-day work never touches it — that is a design invariant, not a convenience." }
    ]},
    { title: "How an SCP kills an action", steps: [
      { lit: ["dev"], text: "A developer with <strong>AdministratorAccess</strong> in the dev account calls ec2:RunInstances in an unapproved region. Their IAM policy says yes, unconditionally." },
      { lit: ["scp", "scp->workloads", "workloads"], text: "Before IAM is even consulted, the authorization engine intersects every SCP on the path root → Workloads OU → dev account. The region-deny statement attached at the OU is inherited by both prod and dev automatically." },
      { lit: ["dev"], text: "Explicit deny wins. AccessDenied — and no IAM policy in the account can override it, because SCPs define the ceiling that IAM operates under. This is how you make guarantees about accounts you don't operate." },
      { lit: ["mgmt"], text: "The one exemption the exam tests: <strong>SCPs never apply to the management account</strong>. You cannot guardrail it — which is exactly why it runs no workloads and has no daily users." }
    ]},
    { title: "Centralized audit trail", steps: [
      { lit: ["prod", "dev", "network"], text: "An <strong>organization trail</strong> is created once and auto-enrolls every existing and future account. Member accounts see the trail but cannot stop, modify, or delete it — logging is not opt-in." },
      { lit: ["prod->logarchive", "dev->logarchive", "network->logarchive"], text: "Every API call in every account streams to the same S3 bucket in log-archive, partitioned by account and region. One bucket to encrypt, lifecycle, and feed into Athena or your SIEM." },
      { lit: ["logarchive"], text: "The bucket only accepts writes from the CloudTrail service principal, and an SCP denies s3:DeleteObject and policy edits <strong>even to log-archive's own admins</strong>. An attacker who owns a workload account — or this one — still cannot rewrite history." },
      { lit: ["sectool"], text: "Security tooling consumes the archive: GuardDuty findings, Security Hub aggregation, Athena forensics. Detection lives beside the evidence, and neither lives where the workloads (or the attackers) are." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "rag-pipeline",
  moduleId: "ai-ml",
  title: "RAG on AWS, end to end",
  sub: "Top row: the offline ingestion pipeline. Bottom row: the per-query path. Retrieval-augmented generation is a search problem wearing an LLM costume.",
  w: 780, h: 400,
  nodes: [
    { id: "s3", x: 20, y: 50, w: 140, h: 46, color: "blue", label: "Documents in S3", sub: "source of truth",
      info: "PDFs, wikis, tickets — versioned, access-logged, lifecycle-managed. S3 event notifications drive incremental ingestion, so the index tracks the source instead of being rebuilt on a cron. Whatever governs these objects governs what the model can ever say." },
    { id: "ingest", x: 210, y: 50, w: 150, h: 46, color: "orange", label: "Ingestion", sub: "chunk + metadata",
      info: "Splits documents into chunks — typically 200-800 tokens with overlap, ideally along semantic boundaries like headings — and attaches metadata (source URI, owner, ACL tags). Chunking is the highest-leverage tuning knob in the whole system: garbage chunks, garbage answers." },
    { id: "embed", x: 410, y: 50, w: 150, h: 46, color: "orange", label: "Embedding model", sub: "Bedrock Titan v2",
      info: "Maps text to a dense vector (e.g. 1024 dims) where semantic similarity becomes geometric proximity. Serverless, priced per input token, and cheap relative to generation. The same model MUST embed both documents and queries — mixing embedding models silently breaks retrieval." },
    { id: "vectors", x: 610, y: 50, w: 150, h: 46, color: "green", label: "Vector store", sub: "OpenSearch Serverless",
      info: "Stores vectors plus chunk text and metadata; answers approximate k-NN (HNSW) in milliseconds and can combine vector similarity with keyword and metadata filters. Serverless OCUs bill even when idle — for small corpora, pgvector on an existing Postgres is the honest cost answer." },
    { id: "guard", x: 610, y: 185, w: 150, h: 44, color: "red", label: "Guardrails", sub: "in + out checks",
      info: "Bedrock Guardrails screens BOTH directions: input for denied topics and prompt-attack patterns, output for PII (mask or block) and contextual grounding — flagging claims unsupported by the retrieved chunks. Policy lives here, versioned and auditable, not scattered through prompt strings." },
    { id: "user", x: 20, y: 310, w: 140, h: 46, color: "blue", label: "User / app", sub: "authenticated caller",
      info: "Arrives with an identity (Cognito, IAM, OIDC) — and that identity must constrain retrieval, not just API access. A RAG system that searches the whole corpus for every caller is a data-exfiltration service with good UX." },
    { id: "retrieve", x: 210, y: 310, w: 150, h: 46, color: "orange", label: "Retrieval", sub: "k-NN + filters",
      info: "Embeds the question, runs k-NN against the index with metadata filters scoped to the caller, returns the top-k chunks (k of 3-10; more is not better — irrelevant context degrades answers). Hybrid vector+keyword search with a reranker is the production-grade upgrade." },
    { id: "llm", x: 410, y: 310, w: 150, h: 46, color: "green", label: "LLM", sub: "Bedrock Claude",
      info: "Generates from a prompt that embeds the retrieved chunks and instructs: answer ONLY from this context, cite sources, say 'I don't know' otherwise. Token-priced per call; context length and k drive cost. Bedrock keeps traffic on AWS's network — prompts are not used for training." },
    { id: "response", x: 610, y: 310, w: 150, h: 46, color: "green", label: "Response", sub: "with citations",
      info: "The answer plus pointers back to source chunks. Citations turn 'trust the model' into 'check the document' — the difference between a demo and something legal will sign off on. Log the question, retrieved chunk IDs, and answer for evaluation and audit." }
  ],
  edges: [
    { from: "s3", to: "ingest", label: "S3 event" },
    { from: "ingest", to: "embed", label: "chunks" },
    { from: "embed", to: "vectors", label: "upsert" },
    { from: "user", to: "retrieve", label: "question" },
    { from: "retrieve", to: "embed", label: "embed query", dashed: true },
    { from: "retrieve", to: "vectors", label: "k-NN", dashed: true },
    { from: "retrieve", to: "llm", label: "prompt + chunks" },
    { from: "llm", to: "guard", label: "output" },
    { from: "guard", to: "response" }
  ],
  flows: [
    { title: "Ingestion: documents become vectors", steps: [
      { lit: ["s3", "s3->ingest"], text: "A document lands or changes in S3; the event notification triggers ingestion for that object only. Incremental, event-driven indexing is what keeps answers fresh — the concrete advantage over fine-tuning, where new knowledge means retraining." },
      { lit: ["ingest"], text: "The document is split into overlapping chunks along semantic boundaries, each tagged with source and ACL metadata. <strong>Chunking strategy drives answer quality more than model choice</strong>: too small loses context, too large buries the relevant sentence in noise and blows the token budget." },
      { lit: ["ingest->embed", "embed"], text: "Each chunk goes through the embedding model once, at per-token prices — the cheap step. Re-embedding only happens when the chunk changes or you switch embedding models (which forces a full reindex — plan for it)." },
      { lit: ["embed->vectors", "vectors"], text: "Vectors are upserted with the chunk text and metadata, keyed so a re-ingested document replaces its old chunks instead of duplicating them. Stale-chunk hygiene is the unglamorous work that separates production RAG from notebooks." }
    ]},
    { title: "Query: retrieve, augment, generate", steps: [
      { lit: ["user", "user->retrieve"], text: "The user asks a question. Their identity rides along with it — everything downstream is scoped by who is asking, not just what they asked." },
      { lit: ["retrieve->embed", "retrieve->vectors", "retrieve"], text: "The question is embedded with the SAME model used at ingestion, then k-NN plus metadata filters pull the top-k most similar chunks. This is milliseconds of search, not model inference — the LLM has not been touched yet." },
      { lit: ["retrieve->llm", "llm"], text: "The prompt is assembled: system instructions, the retrieved chunks as context, then the question — 'answer only from the context, cite chunk IDs'. The model's job shrinks from recall to reading comprehension, which it is far better at." },
      { lit: ["guard->response", "response"], text: "The answer returns with citations. Compare fine-tuning: no citations, knowledge frozen at training time, thousands of dollars per update. RAG updates by writing to S3 — <strong>cheaper, fresher, and auditable</strong>, which is why it wins the exam scenario almost every time." }
    ]},
    { title: "Safety: guardrails and scoped retrieval", steps: [
      { lit: ["guard"], text: "Guardrails inspects the INPUT first: denied topics, prompt-attack patterns, PII in the question itself. Rejected requests never reach retrieval or the model — policy enforcement before spend." },
      { lit: ["user", "retrieve"], text: "IAM and metadata filters scope retrieval to documents the caller may read. <strong>Prompt injection is the new confused deputy</strong>: a hostile document or query tries to make the pipeline use ITS privileges on the attacker's behalf — so the pipeline must hold only the caller's privileges, never a superset." },
      { lit: ["llm->guard", "guard"], text: "The OUTPUT passes through Guardrails too: PII masking, topic policy, and contextual grounding — claims unsupported by the retrieved chunks get flagged or blocked. Injection via poisoned documents makes output checking non-optional." },
      { lit: ["guard->response", "response"], text: "Only then does the response ship. Defense in depth: identity-scoped retrieval bounds what CAN leak, guardrails bound what DOES, citations and logs prove which was which after the fact." }
    ]}
  ]
});

window.COURSE.registerDiagram({
  id: "cross-account-cicd",
  moduleId: "devops-iac",
  title: "Cross-account CI/CD",
  sub: "One tooling account builds; workload accounts deploy via assumed roles. Build once, promote the same artifact, gate prod with a human.",
  w: 780, h: 440,
  nodes: [
    { id: "git", x: 20, y: 80, w: 130, h: 46, color: "blue", label: "Dev team git", sub: "PR merge to main",
      info: "Trunk with protected branches: review required, no direct pushes, signed commits if you're serious. The pipeline trusts this repo completely — so the repo's branch protection IS a production security control, not a workflow nicety." },
    { id: "tooling", x: 180, y: 40, w: 215, h: 345, zone: true, label: "Tooling account" },
    { id: "pipeline", x: 205, y: 80, w: 160, h: 44, color: "orange", label: "CodePipeline", sub: "the orchestrator",
      info: "Owns the release process: source, build, deploy-staging, approval, deploy-prod. It holds NO deploy permissions in workload accounts itself — for cross-account stages it assumes a role over there. Centralizing pipelines in one tooling account gives one audit point for every release." },
    { id: "build", x: 205, y: 150, w: 160, h: 44, color: "orange", label: "CodeBuild", sub: "test + package",
      info: "Ephemeral container per build: compile, unit test, scan, synthesize templates, emit the artifact. Runs exactly once per release — everything downstream consumes its output. Its IAM role should write artifacts and logs, and nothing else." },
    { id: "artifact", x: 205, y: 230, w: 160, h: 44, color: "green", label: "Artifact bucket", sub: "S3, versioned",
      info: "The single source of deployable truth. The bucket policy grants read to the staging and prod deploy roles — necessary but not sufficient, because objects are also encrypted and decryption is governed by the key, not the bucket." },
    { id: "kms", x: 205, y: 310, w: 160, h: 44, color: "yellow", label: "KMS CMK", sub: "cross-acct key policy",
      info: "A customer-managed key whose key policy grants kms:Decrypt to the workload accounts' deploy roles. This is the exam's favorite plumbing detail: the default aws/s3 key CANNOT do this — its key policy is unmodifiable, so cross-account reads fail with AccessDenied no matter what the bucket policy says." },
    { id: "staging", x: 460, y: 40, w: 300, h: 115, zone: true, label: "Staging account" },
    { id: "stagerole", x: 480, y: 85, w: 125, h: 44, color: "red", label: "Deploy role", sub: "trusts tooling",
      info: "Trust policy allows sts:AssumeRole from the pipeline's role in the tooling account — ideally with an ExternalId or source-arn condition. This role is the ONLY path from tooling into staging; its permission policy is scoped to CloudFormation and artifact reads." },
    { id: "stagecfn", x: 625, y: 85, w: 120, h: 44, color: "green", label: "CloudFormation", sub: "own exec role",
      info: "Executes the change set with its OWN service role, which holds the broad resource permissions. The deploy role only needs cloudformation:* plus iam:PassRole on this execution role — humans and pipelines stay least-privilege while CFN does the heavy lifting." },
    { id: "prod", x: 460, y: 230, w: 300, h: 165, zone: true, label: "Prod account" },
    { id: "approval", x: 480, y: 268, w: 130, h: 40, color: "yellow", label: "Manual approval", sub: "IAM-gated stage",
      info: "A pipeline stage (technically executing in the tooling account) that blocks until a human with codepipeline:PutApprovalResult approves — a permission you grant to release managers, not developers. SNS notifies; the pipeline waits up to 7 days, then fails closed." },
    { id: "prodrole", x: 480, y: 330, w: 125, h: 44, color: "red", label: "Deploy role", sub: "trusts tooling",
      info: "Same pattern as staging, separate role and audit trail. CloudTrail in prod shows exactly one AssumeRole per deployment from exactly one principal — any other cross-account access attempt into prod is by definition an incident." },
    { id: "prodcfn", x: 625, y: 330, w: 120, h: 44, color: "green", label: "CloudFormation", sub: "same template",
      info: "Deploys the identical artifact staging validated, with only parameters differing per environment. Drift detection plus stack policies protect what the pipeline deployed from console cowboys afterward." }
  ],
  edges: [
    { from: "git", to: "pipeline", label: "webhook" },
    { from: "pipeline", to: "build", label: "build stage" },
    { from: "build", to: "artifact", label: "upload" },
    { from: "kms", to: "artifact", label: "SSE-KMS", dashed: true },
    { from: "pipeline", to: "stagerole", label: "sts:AssumeRole" },
    { from: "stagerole", to: "stagecfn", label: "change set" },
    { from: "artifact", to: "stagecfn", label: "fetch", dashed: true },
    { from: "pipeline", to: "approval", label: "gate", dashed: true },
    { from: "approval", to: "prodrole", label: "approved" },
    { from: "prodrole", to: "prodcfn", label: "change set" },
    { from: "artifact", to: "prodcfn", label: "same artifact", dashed: true }
  ],
  flows: [
    { title: "Commit to encrypted artifact", steps: [
      { lit: ["git", "git->pipeline"], text: "A PR merges to main; the webhook starts the pipeline. From here no human touches the release — every action below is a role, logged in CloudTrail." },
      { lit: ["pipeline->build", "build"], text: "CodeBuild compiles, tests, scans, and packages in a throwaway container. This is the ONLY build in the entire release — staging and prod will both consume its output." },
      { lit: ["build->artifact", "artifact"], text: "The artifact lands in the versioned S3 bucket. The bucket policy grants read to the staging and prod deploy roles — but a bucket policy alone is not enough, because the object is encrypted." },
      { lit: ["kms", "kms->artifact"], text: "Encryption uses a <strong>customer-managed CMK</strong> whose key policy grants kms:Decrypt to the workload deploy roles. The classic exam trap: with the default aws/s3 managed key, cross-account reads fail with AccessDenied — its key policy cannot be edited. Symptom: bucket policy looks perfect, decrypt still denied." }
    ]},
    { title: "Deploy to staging: two-hop permissions", steps: [
      { lit: ["pipeline", "pipeline->stagerole", "stagerole"], text: "Hop one: the pipeline's role calls sts:AssumeRole on the staging deploy role, whose trust policy names the tooling pipeline role specifically. The tooling account holds zero standing permissions in staging — access exists only for the seconds a deployment runs." },
      { lit: ["stagerole->stagecfn", "artifact->stagecfn", "stagecfn"], text: "Hop two: acting as the deploy role, the pipeline hands CloudFormation the template and artifact (decrypted via the CMK) and passes it an execution role. CFN creates and executes the change set <strong>with ITS role, not the deploy role's</strong>." },
      { lit: ["stagecfn"], text: "Why two hops? The deploy role stays tiny — cloudformation:* plus iam:PassRole on one execution role — while the broad create-anything permissions live in a role only CloudFormation can use. Neither the pipeline nor any human ever holds prod-shaped power directly." }
    ]},
    { title: "Promotion to prod: build once, deploy many", steps: [
      { lit: ["approval"], text: "Staging deployed and verified; the pipeline parks at the manual approval stage. Only principals with codepipeline:PutApprovalResult can approve — the release decision is itself an IAM-controlled, CloudTrail-logged event with a name attached." },
      { lit: ["artifact", "artifact->prodcfn"], text: "On approval, prod receives <strong>the exact artifact staging validated — never rebuilt</strong>. A rebuild could pull newer dependencies and produce different bytes, meaning you'd promote something you never tested. Same S3 version ID, same checksum: that equality is the audit story." },
      { lit: ["approval->prodrole", "prodrole", "prodrole->prodcfn", "prodcfn"], text: "The pipeline assumes the prod deploy role and CloudFormation applies the same template with prod parameters. When an auditor asks 'prove prod runs what you tested', the answer is one artifact hash, one approval record, one AssumeRole event — build-once-deploy-many is the audit-friendly answer." }
    ]}
  ]
});
