window.COURSE.register({
  id: "devops-iac",
  order: 23,
  track: "sap",
  title: "IaC, Deployment & Operations at Scale (Pro)",
  description: "CloudFormation beyond the basics (change sets, custom resources, hooks, drift), CDK for architects, deployment strategies mapped to CodeDeploy across EC2/ECS/Lambda, cross-account pipeline architecture, Systems Manager as the operations backbone, golden AMI pipelines, and governed self-service with Service Catalog.",
  examWeight: "Core SAP-C02 material for Domain 2 (Design for New Solutions) and Domain 3 (Continuous Improvement for Existing Solutions, ~25%). Expect questions on change sets, StackSets-era CFN mechanics, CodeDeploy traffic shifting, cross-account pipelines with KMS, and SSM-based operations.",
  lessons: [
    {
      id: "cfn-advanced",
      title: "CloudFormation beyond basics: change sets, stack policies, drift, rollback",
      html: `
<p>You know CloudFormation as a declarative reconciler: template in, diff computed, resources mutated to match. At Pro level the exam stops asking what a stack is and starts asking how you keep a 300-resource production stack from destroying itself. That is a discipline problem, and CFN gives you four tools: change sets, stack policies, drift detection, and rollback configuration.</p>

<h3>Change sets: never raw-update production</h3>
<p>A change set is a computed, reviewable execution plan — Terraform's plan, materialized as an AWS resource. The property that makes it non-negotiable for production is the <strong>Replacement</strong> column: CFN mutates resources three ways — update with no interruption, update with some interruption, and <em>replacement</em> (new resource created, old one deleted, <strong>physical ID changes</strong>). Innocent-looking property edits force replacement: changing an RDS DB instance identifier, most EC2 property changes, renaming almost anything. A replacement of a database is a data-loss event wearing an update's clothes. Change-set review is where you catch Replacement: True before it executes. Two more facts the exam checks: change sets do not consider out-of-band drift (they diff template versus last-known template state, not reality), and Replacement may show as Conditional when it depends on runtime values CFN cannot resolve until execution.</p>

<h3>Stack policies: protecting resources from updates</h3>
<p>A stack policy is a JSON document on the <em>stack</em> that gates which logical resources <em>update operations</em> may touch. Default once a policy exists: everything not explicitly allowed is denied. The canonical use: deny <code>Update:Replace</code> and <code>Update:Delete</code> on the production database while allowing everything else:</p>
<pre><code>{
  "Statement": [
    { "Effect": "Allow", "Action": "Update:*", "Principal": "*", "Resource": "*" },
    { "Effect": "Deny", "Action": ["Update:Replace", "Update:Delete"],
      "Principal": "*", "Resource": "LogicalResourceId/ProdDatabase" }
  ]
}</code></pre>
<p>Scope matters and is a repeated trap: a stack policy constrains <strong>stack update operations only</strong>. It does not stop <code>DeleteStack</code> (that is IAM's job), does not stop out-of-band console edits (that is drift), and is not IAM (no principals, no conditions beyond resource matching). You can override it for a single update by supplying a temporary policy — which is the sanctioned way to do the one deliberate replacement a year.</p>

<h3>Drift detection and its blind spots</h3>
<p>Drift detection compares a stack's <em>recorded</em> resource state to live configuration and reports IN_SYNC, MODIFIED, DELETED. The limits are what SAP tests:</p>
<ul>
<li><strong>Coverage is partial</strong>: only resource types that support drift detection are checked; others are silently skipped.</li>
<li><strong>Only properties you explicitly set in the template are compared.</strong> A property you left to default, later changed by hand, reports no drift. Drift detection tells you where reality diverged from your declared intent — not from the template's full effect.</li>
<li>It is on-demand, not continuous. Continuous detection = schedule it (SSM Automation runbook AWS-DetectCfnDrift or an EventBridge-scheduled Lambda), or use the AWS Config managed rule <code>cloudformation-stack-drift-detection-check</code> for org-wide compliance visibility.</li>
<li>Remediation is manual: either revert the live change, or update the template to match and perform a no-op-ify update. There is no apply-my-template-over-drift button; worse, updating a drifted stack can behave unexpectedly because CFN diffs against its records, not reality.</li>
</ul>

<h3>Rollback: behavior and monitoring triggers</h3>
<p>Default failure behavior: a failed create rolls back to nothing (ROLLBACK_COMPLETE; the stack must be deleted before retry); a failed update rolls back to the previous state (UPDATE_ROLLBACK_COMPLETE). Knobs a Pro should know:</p>
<ul>
<li><strong>Rollback triggers</strong> (<code>--rollback-configuration</code>): attach up to five CloudWatch alarms plus a monitoring period (0 to 180 minutes). CFN watches the alarms during and after deployment; if any fires, the update rolls back automatically. This is CFN-native canary-by-alarm — "roll back the stack update automatically if error rate rises" maps here, not to a Lambda watching events.</li>
<li><strong>UPDATE_ROLLBACK_FAILED</strong>: the dreaded double failure. Fix the underlying cause and use <code>ContinueUpdateRollback</code>, optionally skipping wedged resources (they then report drift). Deleting a production stack because rollback wedged is the distractor answer.</li>
<li><code>--disable-rollback</code> (and its modern form, preserve-successfully-provisioned-resources) keeps partial state for debugging — dev-tier convenience, production anti-pattern.</li>
</ul>

<h3>DeletionPolicy, UpdateReplacePolicy, and resource import</h3>
<p>Three attributes govern the life of the underlying resource independent of the stack: <strong>DeletionPolicy</strong> (Delete / Retain / RetainExceptOnCreate / Snapshot where supported — RDS, EBS, ElastiCache, Redshift, Neptune) controls stack-deletion behavior; <strong>UpdateReplacePolicy</strong> controls what happens to the OLD resource during a replacement — without it, a forced replacement quietly deletes the old database even though your DeletionPolicy said Retain, because DeletionPolicy does not cover replacement. Set both on stateful resources, always. <strong>Resource import</strong> ("import resources into stack") brings existing, hand-built resources under CFN management: each imported resource needs an identifier and a template definition with a DeletionPolicy set; import operations cannot mix with other changes in the same operation. Import is also the escape path for the classic incident "someone deleted a resource from the stack by hand": import it back, then reconcile.</p>

<div class="callout exam">Mappings: "review exactly what will change, especially replacements, before production updates" = change sets. "Prevent accidental replacement of the database during updates" = stack policy (plus UpdateReplacePolicy: Retain as the seatbelt). "Detect manual console changes" = drift detection, remembering its only-explicit-properties limit. "Automatically roll back a deployment when a CloudWatch alarm fires" = rollback triggers with a monitoring period. "Bring an unmanaged resource under CloudFormation" = resource import with DeletionPolicy.</div>

<div class="callout war">The nastiest production CFN incident class: a template refactor renames a logical ID. CFN has no rename — it sees delete-old-plus-create-new, and your retained-in-your-head database is replaced. Change-set review catches it; so does the newer stack refactoring capability for moving resources between stacks. Treat logical IDs as permanent public API. Second nastiest: UPDATE_ROLLBACK_FAILED at 2 a.m. because rollback needs a Lambda that the same update deleted — know ContinueUpdateRollback and its skip-resources escape hatch before you need them.</div>
`
    },
    {
      id: "cfn-extensibility",
      title: "CFN extensibility: custom resources, macros, hooks, and stack composition",
      html: `
<p>CloudFormation's extension points are where the sharpest exam questions and the sharpest production pain both live. Rank them by blast radius: custom resources (you own a lifecycle contract), macros/transforms (you rewrite templates), hooks (you veto operations), and stack composition choices (you decide your coupling model).</p>

<h3>Custom resources and the stuck-DELETE trap</h3>
<p>A custom resource delegates CRUD for one logical resource to your code: CFN sends a Create/Update/Delete event to a Lambda (or an SNS topic), then <strong>waits for your code to PUT a response to a pre-signed S3 URL</strong> in the event. That callback contract is the whole failure story:</p>
<ul>
<li>If your handler crashes, times out, or never sends the response, CFN <strong>waits for hours</strong> before declaring failure. The stack sits in CREATE_IN_PROGRESS or, far worse, DELETE_IN_PROGRESS, unkillable.</li>
<li>The canonical stuck-DELETE: stack deletion removes the handler Lambda (or its role, or its VPC ENIs) <em>before</em> the custom resource is processed, so the Delete event has no live handler and the response never comes. Cause: a missing DependsOn — the custom resource must depend on its handler so deletion is ordered handler-last.</li>
<li>Unsticking a wedged stack: send the response document yourself. Pull the ResponseURL from the handler's request payload (CloudWatch logs) and curl a SUCCESS JSON to it — CFN cannot tell you from the Lambda. Then fix the ordering.</li>
<li>Write handlers so that <strong>Delete always returns SUCCESS unless there is genuinely something to fail about</strong> — including when the Create it corresponds to never succeeded (CFN sends Delete during rollback of a failed Create) and when the underlying thing is already gone (idempotent delete). Also honor Update-with-changed-physical-ID semantics: returning a new PhysicalResourceId on update makes CFN send a Delete for the old one — a feature (blue/green for custom resources) and a foot-gun.</li>
</ul>
<p>Modern alternative: the <strong>CloudFormation registry</strong> with typed resource providers, or CDK's custom-resource provider framework, both of which wrap the contract with retries and timeouts. Exam-adjacent sibling: <code>AWS::CloudFormation::WaitCondition</code> and cfn-signal for "pause the stack until instances report ready" (CreationPolicy is the cleaner form).</p>

<h3>Macros and transforms</h3>
<p>A macro is a Lambda that rewrites template fragments at processing time — <code>AWS::Serverless</code> (SAM) and <code>AWS::Include</code> are AWS-hosted transforms of the same machinery. Power tool, real costs: templates using macros must be deployed via change sets (or with CAPABILITY_AUTO_EXPAND), the macro Lambda becomes a deployment-time dependency in every consuming account, and debugging happens on the <em>expanded</em> template. Prefer modules (registry-published reusable fragments, expanded client-side-ish without runtime Lambdas) or CDK constructs for reuse; reach for macros only for genuine language extension.</p>

<h3>Hooks: proactive policy enforcement</h3>
<p>CloudFormation Hooks run <em>your validation logic</em> against resource configuration <strong>before provisioning</strong> — pre-create/pre-update/pre-delete — and can WARN or FAIL the operation. This is proactive control territory (the same mechanism behind Control Tower's proactive controls): "block any CFN deployment org-wide that creates an unencrypted S3 bucket, before the bucket ever exists" = a hook, activated per account/region (deploy the activation via StackSets). Contrast the three enforcement layers: SCP (blocks the API call for everyone, IaC or not), hook (blocks non-compliant IaC at provisioning), Config rule (detects after the fact). A well-run org uses all three at different tiers of confidence.</p>

<h3>Nested stacks vs cross-stack exports: choose your coupling</h3>
<table>
<thead><tr><th></th><th>Nested stacks</th><th>Exports / Fn::ImportValue</th></tr></thead>
<tbody>
<tr><td>Relationship</td><td>Parent owns children; one atomic tree, one change set (with nested change sets), one rollback domain</td><td>Independent stacks, loose contract via named exports</td></tr>
<tr><td>Coupling cost</td><td>Child updates flow through parent; a failed child rolls back the tree</td><td>An export in use CANNOT be modified or deleted, and the exporting stack cannot be deleted, until every importer stops importing</td></tr>
<tr><td>Limits pressure</td><td>Escapes the 500-resources-per-stack limit while keeping atomicity</td><td>Export names unique per region per account; values are strings only</td></tr>
<tr><td>Suits</td><td>One system deployed as a unit (network + compute + monitoring of a workload)</td><td>Platform-to-team contracts (shared VPC ID consumed by many app stacks)</td></tr>
</tbody>
</table>
<p>The export lock is the exam's favorite: "cannot delete stack because another stack imports its output" is by design — the fix is migrating importers first (or switching the contract to SSM Parameter Store references, which are deliberately <em>loose</em>: a dynamic reference resolves at deploy time with no lock, trading safety for flexibility). Nested-stack war story: the parent-child tree shares fate — a bad child template wedges the whole tree in UPDATE_ROLLBACK_FAILED, and you fix from the parent, never by touching children directly.</p>

<div class="callout exam">Triggers: "stack stuck in DELETE_IN_PROGRESS with a Lambda-backed custom resource" = handler gone before Delete processed / response never sent; answers involve DependsOn ordering, idempotent-success delete handlers, or manually posting the response. "Enforce that no IaC can provision non-compliant resources, before creation" = CFN hooks (proactive), not Config (detective). "Cannot update or delete an exported value" = importers hold a lock; decouple via SSM parameters if you want looseness.</div>

<div class="callout deep">Why the callback design? CFN's engine is a workflow orchestrator that treats every resource as an async state machine: issue mutation, poll or await signal, proceed. Custom resources simply expose that inner contract to you raw — no retries, no supervision, one shot at the response. Every custom-resource pathology is a distributed-systems classic: lost ack (stuck stack), non-idempotent delete (rollback failure), dependency inversion (handler deleted first). The registry provider framework is AWS adding the supervision layer that the raw contract never had.</div>

<div class="callout limits">Numbers: 500 resources per stack, 200 parameters, 100 outputs; template body via S3 up to 1 MB; export names unique per account-region; custom-resource response timeout is effectively about an hour per attempt (plan for a multi-hour wedge if you get it wrong); hooks evaluate only resource types they target and add seconds to provisioning.</div>
`
    },
    {
      id: "cdk-for-architects",
      title: "CDK for architects: construct levels, aspects, pipelines, escape hatches",
      html: `
<p>CDK is not a competitor to CloudFormation — it is a compiler that targets it. You write TypeScript/Python/Java/Go/C#; <code>cdk synth</code> executes your program to produce a CloudFormation template plus assets; <code>cdk deploy</code> ships them through CFN. Everything from the previous two lessons — change sets, rollback, drift, the export lock — still applies to what CDK emits. What CDK adds is a <em>software</em> layer over templates: types, composition, packages, tests.</p>

<h3>The construct ladder: L1, L2, L3</h3>
<ul>
<li><strong>L1 (Cfn*)</strong>: generated one-to-one mirrors of CloudFormation resource types (<code>CfnBucket</code>). Zero opinion, full surface, available the moment the resource type exists. You drop to L1 when L2 lags the service.</li>
<li><strong>L2</strong>: curated classes with sane defaults, helper methods, and — the killer feature — <strong>intent-level grants</strong>: <code>bucket.grantRead(fn)</code> emits a correctly scoped IAM policy; <code>queue.grantConsumeMessages(service)</code> likewise. L2s encode the security best practice a reviewer would demand, in one line.</li>
<li><strong>L3 (patterns)</strong>: whole architectures as one construct — <code>ApplicationLoadBalancedFargateService</code> stands up ALB, service, task definition, roles, and logging. Your platform team's job at scale is publishing <em>internal L3s</em>: "our compliant microservice" as an importable package with encryption, logging, and tagging baked in. That, not wiki pages, is how architecture standards actually propagate.</li>
</ul>

<h3>Aspects: policy as a tree visitor</h3>
<p>Constructs form a tree; an <strong>Aspect</strong> visits every node post-construction and can inspect or mutate it. This is CDK-native governance: an aspect that walks the tree and throws if any S3 bucket lacks encryption, or that force-enables termination protection, applied once at the app root, covers every construct anyone adds later. cdk-nag ships rule packs (AWS Solutions, HIPAA, PCI) as aspects. Layering note for the exam: aspects enforce at <em>synthesis</em> in the developer/pipeline loop; CFN hooks enforce at provisioning; SCPs at the API. Aspects are the cheapest, earliest gate — but only bind teams that use your CDK setup, which is why they complement rather than replace hooks.</p>

<h3>Escape hatches</h3>
<p>When an L2 does not expose a property, you do not fork the construct — you reach through it: get the underlying L1 (<code>node.defaultChild</code> cast to the Cfn type) and set raw CFN properties, or use <code>addPropertyOverride</code> for arbitrary paths. There is also the reverse direction (wrapping an L1 in L2 interfaces via from-attributes importers). The existence of escape hatches is an architectural fact worth internalizing: adopting CDK never caps you below raw CloudFormation's capability surface — the abstraction is skippable per-property.</p>

<h3>CDK Pipelines and the bootstrap model</h3>
<p><strong>CDK Pipelines</strong> is an L3 that synthesizes a CodePipeline which deploys your CDK app across accounts and regions — and it is <strong>self-mutating</strong>: the pipeline's own definition lives in the repo, and the first pipeline stage updates the pipeline itself before deploying app stages. Adding a new prod region is a pull request, not a console session. Underneath sits <code>cdk bootstrap</code>: each target account/region gets a bootstrap stack (asset bucket, ECR repo, and a set of IAM roles — deploy, file-publishing, lookup) that the pipeline assumes cross-account. Bootstrap with <code>--trust</code> pointing at the pipeline account is the CDK-native version of the cross-account role plumbing you would otherwise hand-build (next lessons build it by hand — know both).</p>

<h3>CDK vs raw CFN vs Terraform</h3>
<table>
<thead><tr><th></th><th>CDK</th><th>Raw CFN (YAML)</th><th>Terraform</th></tr></thead>
<tbody>
<tr><td>State</td><td>CFN-managed</td><td>CFN-managed</td><td>Self-managed state file (S3 + locking) — your problem, and your power</td></tr>
<tr><td>Scope</td><td>AWS-first (CDKTF exists)</td><td>AWS only</td><td>Any provider — the multi-cloud/SaaS answer</td></tr>
<tr><td>Abstraction</td><td>Real language: loops, types, tests, packages</td><td>Templating (sub, conditions) only</td><td>HCL + modules; less expressive than a GPL, more than YAML</td></tr>
<tr><td>Drift/import</td><td>Via CFN (weaker)</td><td>Via CFN (weaker)</td><td>First-class plan-against-reality refresh and import</td></tr>
<tr><td>Failure mode</td><td>Auto-rollback</td><td>Auto-rollback</td><td>Partial apply halts; you re-plan (no auto-rollback)</td></tr>
<tr><td>Team fit</td><td>Software engineers owning infra</td><td>Small/stable footprints, org baselines, StackSets targets</td><td>Multi-cloud shops, existing TF estates, AFT</td></tr>
</tbody>
</table>
<p>Exam positioning: SAP-C02 is AWS-native — "existing Terraform investment" or "multi-cloud" are the only cues that make Terraform the keyed answer. "Developers should define infrastructure in a familiar programming language with reusable components" = CDK. "Organization-wide baseline templates deployed by StackSets" = plain CFN (StackSets consume templates, and note CDK can synth them for this).</p>

<div class="callout war">Two CDK production traps. First, <strong>logical-ID stability</strong>: IDs are derived from the construct path, so refactoring the tree (renaming a parent construct, moving a resource into a new nested construct) changes logical IDs — which CFN executes as replacement. Diff the synthesized template on refactors; pin IDs with overrideLogicalId when migrating. Second, <strong>context lookups</strong> (VPC lookups, AMI lookups) cache into cdk.context.json — commit it, or synth becomes environment-dependent and your pipeline deploys something different from your laptop.</div>

<div class="callout exam">Keyword map: "enforce standards across all constructs in every CDK app" = Aspects (with cdk-nag as the named tool). "Property not supported by the higher-level construct" = escape hatch to the L1, not a custom resource. "Pipeline that updates itself when its definition changes" = CDK Pipelines self-mutation. "One-to-one mapping to a CloudFormation resource" = L1; "opinionated defaults and grant methods" = L2; "complete common architecture in one construct" = L3.</div>
`
    },
    {
      id: "deployment-strategies",
      title: "Deployment strategies mapped to services: rolling, blue/green, canary",
      html: `
<p>Strategy names are cheap; what SAP-C02 actually tests is which AWS mechanism implements which strategy for which compute target, and what each costs in capacity, speed, and rollback time. Anchor on the trade-off triangle: <strong>capacity overhead vs rollback speed vs exposure of users to a bad version</strong>.</p>

<h3>The strategy ladder</h3>
<table>
<thead><tr><th>Strategy</th><th>Mechanics</th><th>Extra capacity</th><th>Rollback</th><th>Exposure</th></tr></thead>
<tbody>
<tr><td>In-place / all-at-once</td><td>Mutate every instance now</td><td>None</td><td>Redeploy (slow, downtime)</td><td>Total</td></tr>
<tr><td>Rolling</td><td>Mutate in batches</td><td>None (reduced capacity mid-deploy)</td><td>Roll forward/back batch-wise</td><td>Partial, mixed versions</td></tr>
<tr><td>Rolling with extra batch</td><td>Add a batch, then roll</td><td>One batch</td><td>Same, without capacity dip</td><td>Partial</td></tr>
<tr><td>Immutable</td><td>Fresh instances/ASG, full replacement, no mutation of running hosts</td><td>Up to 100% temporarily</td><td>Terminate new fleet</td><td>Partial during cutover</td></tr>
<tr><td>Blue/green</td><td>Second full environment, switch traffic (DNS/listener/alias)</td><td>100%</td><td>Switch back — seconds</td><td>Near zero until cutover</td></tr>
<tr><td>Canary / linear</td><td>Blue/green plus weighted, gradual traffic shift</td><td>Depends (100% for fleets, ~0 for Lambda)</td><td>Shift back — seconds</td><td>Tunable (1%, 10%...)</td></tr>
</tbody>
</table>
<p>Terminology nuance the exam rewards: immutable replaces infrastructure but cuts over as it scales; blue/green keeps <em>two complete environments</em> and moves <em>traffic</em>; canary is a traffic-shaping policy on top of blue/green. "Fastest rollback" always points at a traffic-switch strategy, because rollback is a routing change, not a redeploy.</p>

<h3>CodeDeploy: one service, three very different compute platforms</h3>
<p><strong>EC2/on-premises</strong>: the agent runs the appspec lifecycle hooks (BeforeInstall, AfterInstall, ApplicationStart, ValidateService) on each instance. Deployment configs: OneAtATime, HalfAtATime, AllAtOnce, or custom minimum-healthy-hosts — these are <em>rolling</em> knobs. Blue/green on EC2 = CodeDeploy provisions/uses a replacement ASG behind the same load balancer, reroutes, then terminates or keeps the old fleet.</p>
<p><strong>Lambda</strong>: no instances, so the unit of deployment is the <strong>alias</strong>, and traffic shifting is <strong>alias weight</strong> between two versions. Configs are named literally: Canary10Percent5Minutes (10% for 5 minutes, then all), Linear10PercentEvery1Minute (steps), AllAtOnce. Wire CloudWatch <strong>alarms</strong> to the deployment group for auto-rollback, and use the <strong>PreTrafficHook / PostTrafficHook</strong> Lambda hooks for synthetic validation before and after shifting. SAM's AutoPublishAlias + DeploymentPreference generates all of this. Note the mechanism's limit: alias routing splits between exactly two versions.</p>
<p><strong>ECS</strong>: blue/green rides the ALB. CodeDeploy stands up a <em>green task set</em>, registers it with a second target group, and — the exam's favorite detail — can route a <strong>test listener</strong> (say port 8443) to green while production traffic (443) still hits blue. Your AfterAllowTestTraffic hook runs integration tests against the test listener; only on success does production traffic shift (all-at-once, canary, or linear configs), with bake time before blue is torn down. ECS also natively offers rolling updates (minimumHealthyPercent / maximumPercent) without CodeDeploy — know that blue/green specifically means the CodeDeploy (or now ECS built-in blue/green) machinery. App Runner, Elastic Beanstalk (all-at-once, rolling, rolling-with-additional-batch, immutable, plus swap-URL blue/green), and API Gateway canary stage deployments round out the per-service map.</p>

<h3>Feature flags are not deployment strategies</h3>
<p>Deploy strategies control <em>which artifact</em> serves traffic; feature flags control <em>which code path</em> executes inside an artifact. Flags decouple release from deploy: ship dark, enable per-cohort, kill-switch in milliseconds without any deployment. AWS AppConfig is the managed home for this — configuration/flag profiles with <em>their own</em> deployment strategies (gradual percentage rollout over time), validators, and alarm-based rollback; the AppConfig Agent/extension caches config locally so flag checks are not API calls. The exam contrast: "instantly disable a misbehaving feature without redeploying" = feature flag via AppConfig; "gradually shift traffic to a new version with automatic rollback on alarms" = CodeDeploy canary. Mature orgs use both: canary the artifact, flag the feature.</p>

<div class="callout exam">Rapid-fire mappings: "shift 10% of Lambda traffic for 5 minutes then all, roll back on alarm" = CodeDeploy Canary10Percent5Minutes on an alias with alarms. "Test the new ECS version through a separate port before any production traffic" = blue/green with a test listener + AfterAllowTestTraffic hook. "No reduction in capacity during EC2 deployment and instant rollback" = blue/green with ASG replacement (rolling reduces capacity; in-place cannot roll back fast). "Mixed versions unacceptable" = blue/green or immutable, never rolling. "Cheapest, downtime acceptable" = in-place all-at-once.</div>

<div class="callout war">Canary math bites: a 5-minute 10% canary is statistically blind to a bug that fires on 0.1% of requests — you will pass the gate and ship the bug to 100%. Size canary duration to the traffic volume needed for your error budget to show significance, and gate on the RIGHT alarms (p99 latency and downstream error rates, not just 5xx). Second trap: schema changes. Traffic-switch rollbacks are instant for stateless code, but a deploy that migrated the database schema cannot be rolled back by moving traffic — expand/contract (backward-compatible) migrations are the prerequisite for every fast-rollback story you tell.</div>

<div class="callout deep">Why is Lambda canary nearly free while EC2 blue/green doubles cost? Because the isolation boundary differs: Lambda versions are just immutable code references — both versions scale to zero, and the alias is a router entry, so running two versions costs nothing extra. EC2 blue/green must pre-provision a second fleet of always-on capacity. ECS sits between: the green task set is real capacity, but containers make it cheap and fast to stand up. The more granular and elastic the compute unit, the cheaper sophisticated deployment strategies become — one of the quiet operational arguments for serverless.</div>
`
    },
    {
      id: "pipeline-architecture",
      title: "Pipeline architecture: cross-account CodePipeline and the tooling-account pattern",
      html: `
<p>The org-scale reference: a central <strong>tooling (deployments) account</strong> owns the pipelines; workload accounts (dev, staging, prod) own nothing but a deployment role. Rationale mirrors the governance module — the pipeline is a high-privilege system (it can deploy anything), so it lives in a locked-down account with change control; workload teams cannot modify the path to production, and production accounts hold no CI/CD attack surface, just one assumable role.</p>

<h3>The cross-account plumbing (the exam's favorite CI/CD question)</h3>
<p>CodePipeline moves artifacts through an S3 artifact bucket. Cross-account, four pieces must all be in place — miss one and you get the classic opaque access-denied at the deploy stage:</p>
<ol>
<li><strong>A customer-managed KMS key</strong> for the artifact bucket, in the tooling account. This is the non-negotiable: the default AWS-managed S3 key <em>cannot</em> be granted to other accounts, so cross-account pipelines require a CMK whose key policy grants usage to the target accounts' roles.</li>
<li><strong>Artifact bucket policy</strong> granting the target-account deployment roles read (and the pipeline write).</li>
<li><strong>A cross-account role in each target account</strong> trusted by the tooling account: CodePipeline assumes it to run the action (CloudFormation deploy, CodeDeploy, ECS). For CloudFormation actions there are two roles at play — the action role the pipeline assumes, and the CloudFormation service role that performs the resource mutations (this is also your privilege boundary: the CFN role defines what deployments may touch).</li>
<li><strong>Pipeline configuration</strong> referencing the CMK and, per action, the target-account role ARN.</li>
</ol>
<p>CodeBuild does the build/test/package work; it runs in the tooling account with a role scoped to the artifact bucket, the CMK, and whatever it builds against. Give it a VPC configuration only when it must reach private resources.</p>

<h3>Event-driven promotion and approvals</h3>
<p>CodePipeline is EventBridge-native in both directions. Inbound: source changes trigger via events (CodeConnections for GitHub/GitLab). Between stages and pipelines: emit and subscribe — the multi-pipeline promotion pattern has the dev pipeline finish, publish an event (or drop a versioned artifact), and an EventBridge rule start the staging pipeline; cross-account event buses extend this across the org (put-permission on the bus, rule in the receiver). Outbound: pipeline/action state changes drive notifications and metrics. <strong>Manual approval actions</strong> gate stages — pause up to seven days, notify via SNS, record who approved (audit trail); an approval that expires fails the stage. Compliance scenario mapping: "human sign-off before production, with an audit record" = manual approval action; "start the downstream pipeline only after the upstream succeeds, across accounts" = EventBridge cross-account rule, not polling.</p>

<h3>Structuring pipelines at org scale</h3>
<ul>
<li><strong>One pipeline per deployable unit per path-to-production</strong>, not one mega-pipeline: pipelines are cattle, generated from a template (CDK Pipelines, or a Service Catalog product that vends a standard pipeline).</li>
<li><strong>Stage order encodes trust</strong>: build once, promote the <em>same artifact</em> (same hash) through environments — rebuilding per environment invalidates everything you tested. The artifact bucket + CMK pattern exists precisely to move one immutable artifact across account boundaries.</li>
<li><strong>Gates are alarms, tests, and approvals</strong> — wire the CodeDeploy alarms from the previous lesson into the deploy actions so a failed canary fails the pipeline, not just the deployment.</li>
<li>Governance hooks: pipeline definitions themselves deploy via IaC from a protected repo; an SCP can deny CloudFormation/CodeDeploy mutations in prod accounts to everyone <em>except</em> the pipeline deployment role — making the pipeline literally the only path to production.</li>
</ul>

<div class="callout exam">The KMS fact is tested constantly: cross-account CodePipeline artifact access REQUIRES a customer-managed key — an answer that keeps the AWS-managed key while adding bucket policies is wrong, full stop. Also know: the deploy action assumes a role IN the target account (resources are created there, by that account's roles, not by the tooling account reaching in); manual approvals live up to 7 days; EventBridge is the cross-pipeline/cross-account promotion glue.</div>

<div class="callout war">Production pipeline incidents cluster in three places. (1) Key policy vs grant drift: someone rotates or re-creates the artifact CMK and forgets a target account — deploys fail only for that account, days later. Manage the key policy in IaC alongside the pipeline. (2) The build-once rule silently broken: a pip/npm install at deploy time pulls a different dependency into prod than staging tested. Lock and bake dependencies into the artifact. (3) Over-privileged CFN service roles: the deployment role with AdministratorAccess turns your pipeline into the org's best privilege-escalation path — a compromised repo becomes a compromised prod. Scope the CFN role to the workload's services; that role, not the pipeline role, is your real blast-radius control.</div>

<div class="callout deep">Why route deployments through role assumption instead of pushing from tooling with its own credentials? Because it inverts ownership at the trust boundary: the TARGET account's trust policy is the source of truth for who may deploy into it — the prod account can unilaterally revoke the tooling account, list every deployment principal it trusts, and CloudTrail in prod records the assumed-role sessions locally. Central push with tooling-owned credentials gives the center unilateral, unauditable-from-the-edge power. Same two-party consent model as the governance module, applied to CI/CD.</div>
`
    },
    {
      id: "ssm-ops-backbone",
      title: "Systems Manager: the operations backbone",
      html: `
<p>Systems Manager is fifteen-plus capabilities under one brand; the connective tissue is the <strong>SSM Agent</strong>: preinstalled on Amazon Linux/Ubuntu/Windows AMIs, it polls the SSM control plane outbound over 443 — no inbound ports, no bastion, works via VPC endpoints for isolated subnets, and covers on-prem/other-cloud machines through hybrid activations (managed instances get an mi- prefix). An instance needs the agent plus an instance profile with the SSM core policy; from there the whole toolbox applies. For SAP, group the capabilities by the operational question they answer.</p>

<h3>Access: Session Manager</h3>
<p>Interactive shell (and SSH-over-SSM tunneling, and port forwarding) with <strong>no open inbound ports, no SSH keys, no bastion hosts</strong>. AuthN/AuthZ is pure IAM — sessions can be restricted by resource tags, so "developers may open sessions only to instances tagged with their team" is one condition key. Every session start is CloudTrail; full keystroke/output logging goes to S3 or CloudWatch Logs, KMS-encrypted. Any exam scenario containing "eliminate bastion hosts", "no inbound SSH", or "audit all interactive access" is Session Manager. It is also the standard private-subnet access path: agent reaches SSM via interface endpoints (ssm, ssmmessages, ec2messages), so a subnet with no IGW, no NAT still gets shell access.</p>

<h3>Act: Run Command and Automation</h3>
<p><strong>Run Command</strong> executes a document (AWS-RunShellScript, AWS-RunPatchBaseline...) across targets selected by IDs, tags, or resource groups, with the fleet-safety knobs that matter at scale: <strong>concurrency</strong> (velocity) and <strong>error threshold</strong> (abort when N or N% fail), plus rate-controlled output to S3/CloudWatch. It replaces the SSH-in-a-for-loop entirely — auditable, throttled, no credentials.</p>
<p><strong>Automation runbooks</strong> are the step-function-shaped big sibling: multi-step workflows (aws:executeAwsApi, aws:runCommand, aws:approve, aws:executeScript...) for infrastructure operations — restart-with-snapshot, rotate AMIs in an ASG, remediate a Config finding. Three Pro-level properties: runbooks can include <strong>approval steps</strong> (pause for a human), they are the standard <em>target of automated remediation</em> (Config rules and EventBridge rules invoke them), and they run <strong>cross-account and cross-region natively</strong>: execute from a central ops account against target accounts/OUs (management or delegated-admin driven, with AWS-SystemsManager-AutomationExecutionRole in targets, AutomationAdministrationRole centrally). "Run the same operational procedure across 100 accounts without logging into any of them" = multi-account Automation, not a StackSet, not SSH.</p>

<h3>Maintain: Patch Manager, Maintenance Windows, State Manager</h3>
<ul>
<li><strong>Patch Manager</strong>: patch baselines (which patches are approved — severity/classification auto-approval rules, approval delays like "7 days after release", explicit approve/reject lists), patch groups (tag-based targeting so prod and dev get different baselines), and scan-vs-install mode: <em>scan</em> reports compliance without changing anything; <em>install</em> remediates. Compliance rolls up in SSM Compliance/Explorer org-wide.</li>
<li><strong>Maintenance Windows</strong>: cron-scheduled windows with registered targets and tasks (Run Command, Automation, Lambda, Step Functions), concurrency and error controls per task. The canonical pairing: AWS-RunPatchBaseline in install mode inside a maintenance window per patch group — "patch prod only Sunday 02:00-04:00, dev on Tuesdays" is patch groups + two windows.</li>
<li><strong>State Manager</strong>: desired-state associations — reapply a document on a schedule or on drift ("this agent config always present", "CloudWatch agent always running"). Think of it as continuous Run Command with reconciliation semantics.</li>
</ul>

<h3>Know and store: Inventory, Parameter Store</h3>
<p><strong>Inventory</strong> collects software/patch/network metadata fleet-wide (resync on schedule, aggregate to S3 + Athena for org-wide queries — "which instances run OpenSSL version X anywhere in the org"). <strong>Parameter Store</strong>: hierarchical config/secret storage. <em>Standard</em> tier: free, 4 KB values, 10k parameters per account/region; <em>Advanced</em>: paid, 8 KB, 100k+, parameter policies (expiration, no-change notification); throughput is a per-account switch (default 40 TPS, raisable to 10k for a fee). SecureString uses KMS; contrast with Secrets Manager, which costs per secret but adds native rotation Lambdas and cross-account resource policies — "automatic rotation" = Secrets Manager, "free config/secret storage referenced from CFN/CodeBuild/ECS" = Parameter Store.</p>

<h3>Respond: Incident Manager and OpsCenter</h3>
<p><strong>Incident Manager</strong> closes the loop: response plans (who to engage, escalation channels with contact schedules/rotations, which runbooks to auto-launch), incidents opened automatically from CloudWatch alarms or EventBridge, chat-channel integration, and post-incident analysis with timeline capture. <strong>OpsCenter</strong> aggregates operational work items (OpsItems) from Config/CloudWatch/Security Hub with linked runbooks. Exam cue: "automatically engage on-call and execute a runbook when the alarm fires, then track the post-incident review" = Incident Manager.</p>

<div class="callout exam">Mappings: no-bastion/no-SSH/audited shell = Session Manager (+ S3/CW logging, + VPC endpoints for private subnets). Command across thousands of instances with failure-rate abort = Run Command rate controls. Approved multi-step ops procedure with a human approval gate = Automation runbook with aws:approve. Different patch schedules per environment = patch groups + maintenance windows. Fleet software audit = Inventory + Athena. Free tier config with 4 KB limit vs rotation-included secrets = Parameter Store vs Secrets Manager.</div>

<div class="callout war">The classic SSM outage-of-your-own-making: locked-down private subnets where someone creates the ssm endpoint but forgets ssmmessages (session channel) or ec2messages — agent shows online, sessions hang. All three interface endpoints, plus a KMS endpoint if sessions are KMS-encrypted, plus S3 gateway endpoint if logging to S3. Second: Patch Manager compliance shows green while reboots are pending — a patched-but-not-rebooted kernel is still the old kernel; decide and configure reboot behavior explicitly in the baseline operation.</div>

<div class="callout limits">Numbers worth holding: Parameter Store standard 4 KB / advanced 8 KB, 10,000 standard parameters per account-region, default 40 TPS throughput (raisable, billed); Run Command/Automation concurrency and error thresholds are percentages or absolute counts; maintenance window tasks honor per-task concurrency; hybrid activations bring on-prem servers in as mi-* managed instances at a per-instance-per-day advanced-tier price above the free standard tier.</div>
`
    },
    {
      id: "golden-ami-service-catalog",
      title: "Golden AMIs with Image Builder and governed self-service with Service Catalog",
      html: `
<p>Two halves of the paved-road story: Image Builder standardizes <em>what machines run</em>; Service Catalog standardizes <em>what people can provision</em>. Both exist to let a platform team encode standards once and let hundreds of teams consume them safely — the org-scale alternative to tickets and wiki compliance.</p>

<h3>EC2 Image Builder: the golden AMI pipeline</h3>
<p>The golden-image argument at Pro level is immutable-infrastructure logistics: if instances never mutate after launch (previous lessons), then all OS-level change — hardening, agents, patches — must land in the image, on a cadence, with tests, org-wide. Image Builder's pieces:</p>
<ul>
<li><strong>Components</strong>: build steps (install CloudWatch agent, apply CIS hardening) and <strong>test</strong> steps, as versioned YAML documents; AWS ships a managed library (including STIG hardening).</li>
<li><strong>Image recipe</strong>: base image + components (container recipes exist too, producing ECR images).</li>
<li><strong>Infrastructure configuration</strong>: the build environment — instance type, subnet, security group, instance profile, SNS for notifications. Builds are just SSM-driven EC2 under the hood.</li>
<li><strong>Distribution configuration</strong>: the org-scale part — copy the output AMI to multiple <strong>regions</strong>, share to <strong>accounts, OUs, or the whole org</strong>, encrypt per destination, attach license configurations, and update SSM parameters or launch templates with the new AMI ID so ASGs pick it up on next refresh.</li>
<li><strong>Pipeline</strong>: schedule (cron, or build-when-dependencies-update) tying it together; failed tests stop distribution.</li>
</ul>
<p>The reference pattern: Image Builder runs in the shared-services account; a monthly pipeline builds hardened AMIs from the latest base, runs tests, distributes org-wide via the OU-sharing distribution config, publishes the AMI ID to a well-known SSM parameter; workload launch templates resolve the parameter, and instance-refresh rolls fleets. Combine with a governance detective control ("instances must run approved AMIs" via Config) and you have enforceable image compliance. Exam cue: "automate creation, testing, and multi-account distribution of hardened AMIs with minimal custom tooling" = Image Builder — the DIY Packer + Lambda + share-scripts pipeline is the legacy distractor.</p>

<h3>Service Catalog: governed self-service</h3>
<p>Service Catalog wraps CloudFormation templates as <strong>products</strong>, groups them into <strong>portfolios</strong>, and grants portfolio access to IAM principals (Identity Center groups, roles). Consumers get a curated launch menu; governance rides along as <strong>constraints</strong>:</p>
<ul>
<li><strong>Launch constraints — the least-privilege trick, and the most-tested fact.</strong> A launch constraint attaches an IAM role to the product; when a user launches it, <em>CloudFormation runs as that role, not as the user</em>. The user therefore needs only Service Catalog permissions (plus read-ish essentials) — NOT permissions on EC2, RDS, IAM, or anything the template creates. Users provision full architectures they could never build by hand, and cannot deviate from the template, because the template is the only thing the powerful role will execute. "Developers must provision approved architectures without holding permissions on the underlying services" = launch constraint, every time.</li>
<li><strong>Template constraints</strong> narrow parameters (instance types from an allowed list, only certain subnets); <strong>notification constraints</strong> wire stack events to SNS.</li>
<li><strong>Provisioned product</strong> lifecycle: users can update to new product <em>versions</em> (provisioning artifacts) the admin publishes, and admins can restrict actions on the running stack; TagOptions force standardized tags onto everything provisioned.</li>
<li><strong>Org-scale distribution</strong>: share portfolios to accounts or OUs via Organizations integration (RAM under the hood) — the hub-and-spoke catalog: platform team curates in shared-services, every workload account consumes. Account Factory (governance module) is literally a Service Catalog product; AFC blueprints likewise.</li>
</ul>

<h3>AWS Proton, briefly</h3>
<p>Proton is Service Catalog's philosophy specialized for platform-team-to-developer contracts on containers/serverless: platform engineers publish versioned <strong>environment templates</strong> (the shared substrate — VPC, cluster, mesh) and <strong>service templates</strong> (the deployable unit — pipeline included); developers instantiate services against environments, and — the differentiator — Proton <em>tracks which instances run which template version</em> and drives upgrades across the fleet when the platform team publishes v2. Choose Service Catalog for general governed provisioning of arbitrary stacks; Proton when the ask is "platform team owns standardized environment/service templates with managed, versioned upgrades across many microservice teams." Both are exam answers to different phrasings of self-service; version-fleet-upgrade language is the Proton tell.</p>

<div class="callout exam">Three high-frequency patterns: (1) Launch constraint = users launch with the product's role, so they need no permissions on underlying services — any answer granting developers broad IAM to use Service Catalog is wrong. (2) Image Builder distribution configs share AMIs cross-region AND cross-account/OU natively — no Lambda copy scripts. (3) Publish the current golden AMI ID as an SSM parameter and reference it from launch templates/CFN (ssm resolve), so consumers always launch the latest approved image without hardcoding.</div>

<div class="callout war">Service Catalog failure modes from the field: the launch-constraint role must be maintained like the pipeline CFN role it is — too broad and the catalog is a privilege-escalation vending machine; too narrow and product launches half-fail into stuck stacks that users cannot delete (they lack permissions — admin cleanup required; the constraint role also needs permissions to DELETE everything it creates, which teams forget). On golden AMIs: bake-time coupling is real — teams that bake application code into the AMI rediscover hour-long deploys; keep the golden image at the platform layer (OS, agents, hardening) and deploy apps on top via your actual deployment mechanism.</div>
`
    },
    {
      id: "opex-patterns",
      title: "Operational excellence: runbooks, playbooks, ADRs, game days",
      html: `
<p>SAP-C02's operational-excellence questions look soft but key on precise definitions and on one meta-principle: <strong>operations as code</strong>. Every practice in this lesson exists to convert tribal knowledge into executable, reviewable, versioned artifacts — the same trajectory infrastructure took with IaC.</p>

<h3>Runbooks vs playbooks: the definitional pair</h3>
<p>AWS's Well-Architected vocabulary, which the exam uses precisely:</p>
<ul>
<li>A <strong>runbook</strong> is a procedure to <em>achieve a specific outcome</em> — known task, enumerated steps, deterministic end state. Patch the fleet, rotate the certificate, fail over the database. Because steps are known, runbooks are automatable, and the AWS-native executable form is the <strong>SSM Automation runbook</strong> (previous lesson) — versioned, IAM-controlled, approval-gated, cross-account.</li>
<li>A <strong>playbook</strong> is a process to <em>investigate an issue</em> — the steps gather information and branch on findings. Symptom in, diagnosis out, usually ending by invoking some runbook. Playbooks resist full automation (the branching is the human judgment) but their data-gathering steps automate well: a playbook that says "pull the last hour of ALB 5xx by target group, check recent deployments, check upstream dependency dashboards" can pre-execute all three and present results.</li>
</ul>
<p>Exam discrimination: "documented procedure to respond to a well-understood event" = runbook; "documented process to investigate an unknown failure" = playbook. The maturity ladder for both: markdown, then markdown with scripts, then fully executable (SSM documents), with the doc <em>generated from</em> the code so it cannot rot separately.</p>

<h3>ADRs: architecture decision records</h3>
<p>An ADR captures one significant decision as a short immutable document: context (forces in play), decision, consequences (including the negative ones you accepted), and status — proposed, accepted, deprecated, <em>superseded by ADR-nnn</em>. The discipline points that matter at senior level: ADRs are append-only (you supersede, never edit history — the record of <em>why</em> is the value), they live in the repo next to the code they govern, and they are cheap — a page, not a design doc. Their org-scale payoff is exactly the multi-account governance story: when 40 teams each decide "which database, which deployment strategy, which auth pattern", ADRs plus a searchable index are how the 41st team learns from the first 40, and how reorgs stop erasing institutional memory. Well-Architected reviews go from archaeology to reading.</p>

<h3>Game days: rehearsing failure</h3>
<p>A game day exercises a failure scenario against a real (ideally production-grade) environment to test the <em>system plus the humans plus the runbooks</em> together. Well-Architected treats them as the validation step for your resilience claims: an untested DR plan is a hypothesis; RTO/RPO numbers without a game day behind them are fiction. Structure: define the scenario and blast-radius guardrails, brief (or deliberately do not brief) the on-call, inject the failure — AZ loss, dependency brownout, credential expiry, region failover — observe MTTD/MTTR and runbook fidelity, then run the same post-incident analysis a real incident would get. Tooling: <strong>AWS Fault Injection Service</strong> is the managed chaos-engineering arm — experiment templates with fault actions (instance/AZ disruption via network ACL manipulation, API throttling/errors, EKS/ECS/RDS faults) and, critically, <strong>stop conditions</strong>: CloudWatch alarms that abort the experiment when real damage exceeds the plan. Exam cues: "regularly validate operational readiness for failure scenarios" = game days; "controlled fault injection with automatic rollback when alarms trigger" = FIS with stop conditions; "validate the DR runbook actually meets RTO" = game day executing the DR runbook, not another document review.</p>

<h3>The operational flywheel</h3>
<p>Assembled from the whole module, the steady state the exam calls operational excellence: telemetry raises an alarm; the alarm opens an Incident Manager incident that engages on-call and auto-launches the diagnostic playbook's data-gathering; a human branches, invokes the remediation runbook (approval-gated where risky); the post-incident analysis produces action items — a new alarm, a runbook fix, an ADR, a game-day scenario; StackSets or the pipeline distribute the fixes org-wide; the next game day validates the loop. Each artifact is code: reviewed, versioned, deployed. Anti-patterns the exam punishes: manual undocumented response, heroics as process, DR plans validated annually on paper, and post-incident reviews that assign blame instead of producing system changes.</p>

<div class="callout exam">Definitions are the points: runbook = specific outcome, known steps, automatable; playbook = investigation, branching; ADR = immutable decision record, superseded not edited; game day = rehearsal of failure with the real people and real runbooks; FIS = managed fault injection with stop-condition alarms as the safety net. "Operations as code" is the phrase Well-Architected wants — documented procedures that execute, not documents about procedures.</div>

<div class="callout war">Two field truths. Runbooks rot at the speed of your architecture: the failover runbook written for the old DNS setup is worse than no runbook — it confidently does the wrong thing at 3 a.m. Every architecture change that touches a runbook's assumptions must update the runbook in the same change set, which only happens when runbooks live in the repo and appear in code review. And game days find organizational failures more often than technical ones: the secret nobody could access, the approver asleep in another timezone, the escalation phone number from two reorgs ago. That is precisely their value — those failures are invisible to every technical test you run.</div>

<div class="callout deep">Why the exam cares about paperwork: at organizational scale, the constraint on reliability is rarely a missing AWS feature — it is variance in human response. Runbooks compress MTTR variance; playbooks compress MTTD variance; ADRs compress decision variance across teams; game days measure all three and feed corrections back. It is statistical process control applied to operations, and it is why Domain 3 of SAP-C02 (Continuous Improvement) reads like a manufacturing-quality syllabus wearing cloud terminology.</div>
`
    }
  ],
  quiz: [
    {
      q: "A team maintains a production CloudFormation stack containing an RDS instance, an ASG, and networking. A proposed template change modifies several resources. The lead must guarantee, before execution, that no change will cause the database to be replaced, and must block replacement even if the review misses it. Which combination provides this? (Select TWO.)",
      options: [
        "Create a change set and inspect the Replacement attribute for the RDS resource before executing",
        "Enable drift detection on the stack and remediate any drift before updating",
        "Apply a stack policy that denies Update:Replace and Update:Delete on the RDS logical resource",
        "Set DeletionPolicy Retain on the RDS resource so replacement cannot occur",
        "Use --disable-rollback so a failed update leaves the database intact"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<p><strong>A and C are correct.</strong> The change set is the preview: its Replacement column (True/False/Conditional) reveals a pending database replacement before anything executes. The stack policy is the enforcement backstop: with Update:Replace and Update:Delete denied for the RDS logical ID, an update that attempts replacement fails even if a reviewer approves it by mistake — preview plus preventive control, which is exactly what 'guarantee before execution AND block even if missed' asks for.</p><p><strong>B</strong> solves a different problem: drift is out-of-band change; it says nothing about what the proposed template will do. <strong>D</strong> is the subtle distractor: DeletionPolicy governs stack deletion, not replacement — during replacement the OLD resource's fate is controlled by UpdateReplacePolicy, and neither attribute PREVENTS the replacement; they only decide whether the old resource survives it. <strong>E</strong> changes failure handling, not replacement behavior, and disabling rollback on a production stack is itself an anti-pattern.</p>"
    },
    {
      q: "A production stack has been stuck in DELETE_IN_PROGRESS for two hours. The stack contains a Lambda-backed custom resource that configured a third-party SaaS integration. CloudWatch logs show the handler function no longer exists. What happened, and what is the fastest safe way to unblock the deletion?",
      options: [
        "CloudFormation throttled the deletion; wait for the service to retry the custom resource automatically",
        "The handler Lambda was deleted before the custom resource's Delete event was processed, so no response was sent; retrieve the ResponseURL from the handler's earlier logs or the event, and manually send a SUCCESS response document to it, then fix resource ordering with DependsOn",
        "The custom resource requires a DeletionPolicy of Retain; cancel the deletion, add the policy, and delete again",
        "Contact AWS Support to force-delete the stack, since custom resources cannot be unblocked by customers"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> This is the canonical stuck-DELETE: CloudFormation delegates the Delete to your handler and waits for a response PUT to the pre-signed S3 ResponseURL. With the handler already deleted (deletion order was not constrained), no response can ever arrive, and CFN waits on the order of hours. The unblock is to impersonate the handler — POST/PUT a well-formed SUCCESS response to the ResponseURL yourself — after which CFN proceeds. The durable fix is a DependsOn from the custom resource to its handler (and role), so deletion processes the custom resource while the handler still exists, plus delete handlers that return SUCCESS idempotently.</p><p><strong>A</strong> is wishful: CFN does not retry custom-resource callbacks; the wait ends in DELETE_FAILED after the timeout, not success. <strong>C</strong> misapplies DeletionPolicy — Retain would skip cleanup entirely (leaving the SaaS side configured) and cannot be added to a stack mid-deletion anyway. <strong>D</strong> is unnecessary: the manual-response technique is the documented customer-side remedy; Support is the slow path for a problem you can fix in minutes.</p>"
    },
    {
      q: "An organization requires that no CloudFormation deployment in any of its 200 accounts can create an S3 bucket without encryption or an RDS instance without Multi-AZ — and the violation must be blocked before the resource is created, not flagged afterward. Developers deploy with CFN, CDK, and SAM. What should the platform team implement?",
      options: [
        "AWS Config rules with automatic remediation deployed to all accounts via StackSets",
        "CloudFormation hooks that evaluate the target resource types pre-provisioning and fail non-compliant operations, activated in all accounts via StackSets",
        "CDK Aspects added to the shared construct library that throw on non-compliant resources at synthesis",
        "An SCP denying s3:CreateBucket and rds:CreateDBInstance unless requests originate from an approved pipeline role"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> Hooks are the proactive control point inside CloudFormation itself: they inspect resource properties pre-create/pre-update and can FAIL the operation, so the bucket or DB never exists non-compliantly. Because CDK and SAM both synthesize to CloudFormation, one hook covers all three toolchains, and StackSets handles the 200-account activation.</p><p><strong>A</strong> is detective: Config evaluates AFTER the resource exists — remediation shrinks the window but the requirement says blocked before creation. <strong>C</strong> only binds teams using the shared CDK library; plain CFN and SAM users (explicitly in scope) bypass it entirely — aspects are a valuable early gate but cannot be the org guarantee. <strong>D</strong> cannot express the requirement: SCPs see the API call, and while some request conditions exist, evaluating arbitrary resource configuration like 'Multi-AZ enabled' is not what SCP condition keys do — and gating creation to pipeline roles restricts WHO, not WHAT configuration.</p>"
    },
    {
      q: "A platform team shares a network stack whose outputs (VPC ID, subnet IDs) are consumed by 30 application stacks via Fn::ImportValue. The team must now replace the VPC, but every attempt to update or delete the network stack fails. Separately, they want future consumers to be insulated from this class of problem. Which pair of statements is accurate?",
      options: [
        "The failures occur because exports that are imported by other stacks cannot be changed or removed; migrating consumers to resolve values from SSM Parameter Store at deploy time removes the hard lock",
        "The failures occur because nested stacks cannot be updated independently of their parent; converting the consumers to nested stacks of the network stack fixes both problems",
        "The failures occur because the stack policy on the network stack denies updates; removing the stack policy allows the replacement and consumers are unaffected",
        "The failures occur because drift on the consumer stacks blocks the exporting stack; running drift remediation on all 30 stacks unblocks the update"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct.</strong> Cross-stack exports create a hard referential lock: while any stack imports an export, the export's value cannot change and the exporting stack cannot be deleted — by design, to protect importers from dangling references. The escape is to loosen the contract: consumers read the VPC/subnet IDs from SSM parameters (dynamic references or resolve at deploy), which carry no lock; the platform team then coordinates changes by versioning parameters instead of being structurally frozen. The trade is real — looseness means importers can deploy against a changed value — and that trade is the architectural decision.</p><p><strong>B</strong> misdiagnoses and prescribes tighter coupling: nothing here involves nested stacks, and converting 30 independent app stacks into children of the network stack creates a single rollback domain — the opposite of insulation. <strong>C</strong> is unfounded: stack policies gate update operations on the stack that has the policy; the described symptom (cannot delete/modify because of importers) is the export lock, and consumers would very much be affected by a VPC replacement. <strong>D</strong> invents a mechanism: drift on one stack has no blocking effect on another stack's updates.</p>"
    },
    {
      q: "A company adopting CDK wants every one of its 60 development teams to inherit mandatory controls: all S3 buckets encrypted with KMS, all resources tagged with cost-center, and termination protection on production stacks — enforced without asking teams to remember anything, and verified again before provisioning for teams that bypass the standard tooling. Which layered approach is correct?",
      options: [
        "Publish an internal L3 construct library with compliant defaults, apply CDK Aspects at the app root to validate and mutate the construct tree at synthesis, and enforce at provisioning time with CloudFormation hooks for non-CDK deployments",
        "Use cdk destroy protection and stack policies on all stacks, with a Lambda that scans templates in S3 after deployment",
        "Require all teams to use L1 constructs only, since they map directly to CloudFormation and are easier to audit",
        "Enforce the standards with a CodeBuild lint stage that greps synthesized templates for encryption properties"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct</strong> and demonstrates the enforcement ladder: internal L3 constructs make the compliant path the easy path (defaults baked in); Aspects visit every node in the construct tree at synthesis, catching or fixing anything teams hand-roll outside the L3s; and CloudFormation hooks provide the provisioning-time guarantee that binds even teams deploying raw CFN or SAM outside the CDK toolchain — the 'bypass' clause in the requirement is what makes the hooks layer mandatory.</p><p><strong>B</strong> is post-hoc: scanning templates after deployment is detective, stack policies do not validate resource configuration, and destroy protection addresses one narrow item. <strong>C</strong> is backwards: L1s REMOVE the curated defaults that deliver compliance-by-default, maximizing per-team burden — auditability of raw resources is not a control. <strong>D</strong> is a brittle partial: text-matching synthesized templates catches simple cases but has no model of resource semantics, misses non-CDK deployments only if they happen to flow through the same build, and mutates nothing.</p>"
    },
    {
      q: "During a CDK refactor, an engineer moves an Aurora cluster construct into a new parent construct for better code organization and renames the enclosing construct. cdk diff shows the cluster will be destroyed and recreated, though no properties changed. Why, and what is the correct prevention?",
      options: [
        "CDK randomizes logical IDs on every synthesis; pin the CDK version to prevent it",
        "CloudFormation logical IDs derive from the construct path, so moving or renaming ancestors changes the ID, which CloudFormation treats as delete-plus-create; preserve the original logical ID (overrideLogicalId) or avoid repathing stateful resources",
        "Aurora clusters always require replacement on stack updates; set UpdateReplacePolicy to Snapshot and proceed",
        "The construct moved between stacks, and cross-stack moves always destroy resources; use cdk import instead"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> CDK computes each resource's CloudFormation logical ID from its construct tree path (with a hash). Renaming or re-parenting a construct changes the path, hence the logical ID — and CloudFormation has no concept of rename: it sees a new resource to create and an old one to delete. For a database that is a destroy-and-recreate data-loss event. Prevention: treat construct paths of stateful resources as frozen API, and when a refactor is unavoidable, pin the previous ID via overrideLogicalId (or use refactoring tooling) so the template stays stable.</p><p><strong>A</strong> is false — synthesis is deterministic for a given tree; nothing is randomized and version pinning is irrelevant. <strong>C</strong> is false as a rule (property changes determine replacement) and its mitigation accepts the destruction with a snapshot instead of preventing it. <strong>D</strong> describes a different operation — the scenario is a same-stack code move; cdk import is for adopting existing unmanaged resources, not for refactors.</p>"
    },
    {
      q: "A payments API runs on Lambda behind API Gateway. Requirements for releases: new versions must initially receive exactly 10 percent of production traffic for a bake period, automatically revert on elevated errors without human action, and run a synthetic transaction test before any production traffic arrives. Which implementation meets all three?",
      options: [
        "CodeDeploy with a Lambda deployment group using Canary10Percent15Minutes, CloudWatch alarms attached for automatic rollback, and a PreTrafficHook Lambda executing the synthetic test",
        "An API Gateway canary release stage shifting 10 percent of traffic, with a CloudWatch dashboard for the operations team to watch",
        "Publish a new Lambda version and configure the alias with a 10 percent weight, reverting manually if the error alarm fires",
        "Deploy the new version to a second Lambda function and use Route 53 weighted records to send it 10 percent of traffic"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct</strong> — each requirement maps to a named feature: Canary10Percent15Minutes gives exactly 10% then full shift after the bake; deployment-group CloudWatch alarms give automatic rollback (CodeDeploy shifts the alias weight back on alarm, no human involved); and the PreTrafficHook runs your synthetic-transaction Lambda against the new version BEFORE any weight moves, failing the deployment if it fails.</p><p><strong>B</strong> covers the 10% but fails automation twice: a dashboard is not automatic rollback, and API Gateway canaries have no pre-traffic validation hook for the Lambda version. <strong>C</strong> is the DIY version of A: alias weights alone give the split, but 'reverting manually' explicitly fails the no-human-action requirement, and there is no pre-traffic test stage. <strong>D</strong> abandons the platform: two separate functions with DNS weighting adds client-DNS-caching imprecision to the 10% split, has no alarm-driven rollback integration, and API Gateway integrations do not route via Route 53 weights anyway.</p>"
    },
    {
      q: "An ECS service on Fargate behind an ALB must deploy so that the release engineer can run integration tests against the new task set through a dedicated port before any customer traffic reaches it, then shift customers gradually, with several hours of instant-rollback capability after full cutover. Which setup delivers this?",
      options: [
        "ECS rolling update with minimumHealthyPercent 100 and maximumPercent 200, testing against the service DNS during the rollout",
        "CodeDeploy ECS blue/green: a green task set registered to a second target group, a test listener routing to green for the AfterAllowTestTraffic hook tests, a linear traffic-shifting config for customers, and an extended bake time before terminating blue",
        "Two ECS services behind separate ALBs with Route 53 failover routing between them",
        "CodeDeploy in-place deployment with ValidateService hooks running the integration tests on each task"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct</strong> — this is the CodeDeploy ECS blue/green feature set item by item: the green task set attaches to its own target group; the TEST listener (a second ALB listener on a non-production port) routes only to green, which is where AfterAllowTestTraffic hook tests run against real infrastructure with zero customer exposure; linear configs shift production traffic gradually; and because blue keeps running through the configured bake/termination wait, rollback for hours after cutover is a listener flip back to blue.</p><p><strong>A</strong> has no pre-traffic test isolation: during a rolling update the service DNS mixes old and new tasks, so tests hit both, and customers hit new tasks immediately — and rollback is a full redeploy. <strong>C</strong> rebuilds a crude blue/green out of DNS: failover routing is for health-based DR, not gradual shifting; DNS TTLs make 'instant' rollback approximate; and the requirement's test-listener workflow does not exist. <strong>D</strong> is invalid for this platform pattern: in-place semantics with per-task validation does not apply to the ECS blue/green model and offers no isolated test path or instant rollback — the old tasks are being replaced as you go.</p>"
    },
    {
      q: "A company's central tooling account runs CodePipeline to deploy CloudFormation stacks into dev, staging, and prod accounts. The pipeline works for dev (same account) but the cross-account deploy stages fail with access denied errors when the target accounts' roles read the artifact bucket. The bucket policy already grants the target roles s3:GetObject. What is the most likely missing piece?",
      options: [
        "The artifact bucket uses the AWS managed S3 KMS key, which cannot be shared cross-account; the pipeline must use a customer-managed KMS key whose key policy grants decrypt to the target account roles",
        "The target accounts need an S3 gateway VPC endpoint to reach the artifact bucket",
        "CodePipeline requires artifact buckets in every target account, replicated with S3 Cross-Region Replication",
        "The pipeline's service role lacks sts:AssumeRole permission on the target account roles"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct</strong> and is one of the most reliably tested CI/CD facts: pipeline artifacts are KMS-encrypted, and the default AWS managed key (aws/s3) cannot appear in another account's grants — its key policy is immutable and account-local. The symptom is exactly as described: bucket policy grants S3 access, same-account stages work, cross-account reads die (on the implicit kms:Decrypt) with an S3/KMS access-denied. The fix: create a CMK in the tooling account, reference it in the pipeline's artifact store, grant the target-account deployment roles decrypt in the key policy, and grant them use in their own IAM policies.</p><p><strong>B</strong> is a networking red herring: the deploying roles call S3 over public service endpoints from AWS's side; no VPC endpoint is involved in CodePipeline artifact access. <strong>C</strong> describes cross-REGION pipeline topology (artifact stores per region), not cross-account, and CRR is not part of either. <strong>D</strong> would fail earlier and differently — the action could not assume the role at all, producing an assume-role error, not an artifact-read denial by the target role.</p>"
    },
    {
      q: "Security policy requires that production infrastructure can only be modified through the deployment pipeline, that a release manager approves every production deployment with an audit record, and that the staging-to-production promotion starts automatically when staging tests pass in a different account. Which mechanisms implement these three requirements? (Select TWO.)",
      options: [
        "A CodePipeline manual approval action before the production deploy stage, backed by SNS notification and recorded approval identity",
        "An SCP or IAM strategy denying CloudFormation and deployment mutations in the prod account to all principals except the pipeline's deployment role, with an EventBridge cross-account rule starting the prod pipeline on the staging pipeline's success event",
        "A CloudWatch alarm on staging test metrics that triggers a Lambda which calls codepipeline StartPipelineExecution with the release manager's credentials",
        "A stack policy on production stacks denying all updates except during maintenance windows",
        "S3 event notifications on the staging artifact bucket that trigger the production deployment directly through CodeBuild"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>A and B are correct.</strong> A delivers the human gate: the manual approval action pauses the stage (up to 7 days), notifies via SNS, and permanently records who approved — the audit requirement verbatim. B delivers the other two: denying deploy mutations in prod to everything except the pipeline role makes the pipeline literally the only path to production (preventive, not procedural), and the EventBridge cross-account event from the staging account's pipeline-succeeded event is the sanctioned automatic promotion trigger across accounts.</p><p><strong>C</strong> is an anti-pattern twice over: automation running under a human's credentials destroys the audit trail it is supposed to create, and it reinvents what EventBridge pipeline events do natively. <strong>D</strong> misuses stack policies — they gate which RESOURCES an update may touch, have no time-window semantics, and would also block the legitimate pipeline. <strong>E</strong> bypasses the pipeline entirely: artifact-bucket triggers firing CodeBuild directly circumvents the approval gate the policy demands, violating requirement two while implementing requirement three.</p>"
    },
    {
      q: "An enterprise must eliminate SSH bastion hosts for 3,000 EC2 instances across 40 accounts, many in private subnets with no internet access. All interactive access must be authorized by IAM, restricted by team tags, and every session fully logged to a central S3 bucket. Which solution meets the requirements?",
      options: [
        "SSM Session Manager with instance profiles for the SSM agent, interface VPC endpoints for ssm, ssmmessages, and ec2messages in the private VPCs, IAM policies conditioned on instance tags, and session logging configured to the central S3 bucket",
        "A hardened bastion per VPC with SSH key rotation via Secrets Manager and CloudWatch agent shipping auth logs centrally",
        "EC2 Instance Connect with security groups allowing port 22 from the corporate CIDR and VPC Flow Logs for session auditing",
        "AWS Client VPN into each VPC with certificate authentication, plus OS-level auditd shipped to CloudWatch"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct</strong> and each element answers a stated constraint: Session Manager removes bastions and inbound ports entirely; the three interface endpoints (ssm, ssmmessages, ec2messages) are what make it work in no-internet private subnets; IAM condition keys on resource tags implement per-team instance restrictions; and Session Manager's native logging captures full session content to S3 (KMS-encrypted, centralizable cross-account). This is the canonical mapping for 'no SSH, no bastion, IAM-authorized, audited'.</p><p><strong>B</strong> keeps the thing the requirement eliminates: bastions remain inbound attack surface and shared-infrastructure toil; auth logs record logins, not session content. <strong>C</strong> still opens port 22 (violating no-inbound), requires network reachability the private subnets lack, and VPC Flow Logs record packet metadata — not what happened in the session. <strong>D</strong> provides network access, not access CONTROL of the required kind: users still need SSH daemons and keys, port 22 open on instances, and auditd is instance-managed logging, not centrally enforced session capture tied to the access path.</p>"
    },
    {
      q: "Operations must apply OS patches to 800 production instances only during Sunday 02:00-04:00, and to 1,200 development instances any weeknight — with different patch approval rules for each group (prod waits 14 days after release, dev auto-approves after 2 days), compliance visible org-wide, and no patching activity outside the windows. What is the correct Systems Manager design?",
      options: [
        "Two patch baselines with the respective auto-approval delays, instances assigned to prod and dev patch groups via tags, two maintenance windows on the required schedules each running AWS-RunPatchBaseline in install mode against its patch group, and compliance aggregated with SSM Explorer",
        "State Manager associations running AWS-RunPatchBaseline in install mode every hour, with the baseline deciding when patches apply",
        "A single default patch baseline with a 2-day approval delay, and EventBridge rules that stop patching outside the windows",
        "Run Command executed by operators each Sunday using AWS-RunShellScript with yum update, throttled to 10 percent concurrency"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct</strong> — it is the intended composition of the four Patch Manager primitives: baselines carry the differing approval-delay rules (14 vs 2 days); patch groups (tag-driven) bind each instance population to its baseline; maintenance windows provide the hard scheduling boundary (tasks simply do not run outside them), one per population; and Explorer/Compliance gives the org-wide rollup. Every requirement lands on the feature built for it.</p><p><strong>B</strong> destroys the scheduling requirement: hourly associations mean install-mode patching can occur at any hour — baselines control WHAT is approved, never WHEN installation runs. <strong>C</strong> fails both populations with one approval rule and inverts the control model: there is no meaningful 'EventBridge stops patching' primitive — windows exist precisely so you do not build one. <strong>D</strong> is the anti-pattern the module warns about: manual, operator-driven, bypasses baselines entirely (yum update applies everything regardless of approval rules), produces no compliance data, and depends on humans showing up at 02:00.</p>"
    },
    {
      q: "A platform team must let 200 developers self-provision a standardized three-tier stack (VPC resources, ALB, ECS service, Aurora) in their team accounts. Security mandates that developers hold no IAM permissions on EC2, ELB, ECS, RDS, or IAM, yet provisioning must succeed, and all provisioned stacks must carry mandatory cost tags. How should this be built?",
      options: [
        "A Service Catalog portfolio shared to the team accounts, containing the stack as a product with a launch constraint role that has the provisioning permissions, plus TagOptions for the mandatory tags; developers receive only Service Catalog end-user permissions",
        "A CodePipeline in each team account that developers trigger, with the pipeline role holding the provisioning permissions",
        "An IAM permissions boundary allowing the required services only when requests include the cost tags, attached to all developer roles",
        "CloudFormation StackSets administered centrally, with developers submitting stack parameter files through a Git repository"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct</strong> — this is the launch-constraint pattern verbatim: the constraint role, owned by the platform team, is what CloudFormation runs as during provisioning, so developers need only Service Catalog end-user access and zero permissions on the underlying services; the product template fixes the architecture so they cannot deviate; TagOptions force the cost tags onto provisioned resources; and Organizations-integrated portfolio sharing distributes it to all team accounts.</p><p><strong>B</strong> can be made to work but answers the wrong question: it hands each team a pipeline to maintain, provides no catalog/versioning/portfolio governance, and 'developers trigger a pipeline' with parameters is weaker product control than Service Catalog's constrained provisioning — the question describes governed self-service, which is the product's exact purpose. <strong>C</strong> contradicts the mandate: a permissions boundary that ALLOWS the services means developers hold permissions on them — precisely what security forbade — and boundaries cannot express 'only via the approved template'. <strong>D</strong> removes self-service: StackSets deploy centrally-initiated stacks; a Git-and-parameters workflow makes the platform team the operator for 200 developers' provisioning requests.</p>"
    },
    {
      q: "A company distinguishes its operational documents. Document X guides an engineer through diagnosing elevated API latency: check recent deployments, examine dependency dashboards, branch based on findings. Document Y executes a database failover: fixed steps, deterministic outcome, currently performed manually. Per AWS operational-excellence terminology and best practice, what are X and Y, and what should happen to Y?",
      options: [
        "X is a playbook and Y is a runbook; Y should be converted to an executable SSM Automation runbook, version-controlled, with an approval step if the operation is high risk",
        "X is a runbook and Y is a playbook; both should remain as wiki documents reviewed quarterly",
        "X and Y are both runbooks; X should be automated first since diagnosis happens more often than failover",
        "X is a playbook and Y is a runbook; Y should remain manual because failovers are too risky to automate"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct.</strong> The Well-Architected definitions: a playbook is an investigative process that branches on findings (X — diagnosis of an anomaly); a runbook achieves a specific outcome through known steps (Y — failover). Best practice for well-understood, deterministic procedures is operations-as-code: encode Y as an SSM Automation runbook, keep it in version control so it evolves with the architecture, and gate the risky step behind an aws:approve approval — automation with a human decision point, not automation versus humans.</p><p><strong>B</strong> swaps the definitions — the branching-investigation document is the playbook, not the runbook — and 'wiki reviewed quarterly' is exactly the rot-prone anti-pattern the framework pushes against. <strong>C</strong> collapses the distinction the exam is testing, and the automation-priority logic is backwards anyway: deterministic procedures (Y) automate cleanly; branching investigations automate only partially. <strong>D</strong> gets the vocabulary right and the practice wrong: high-risk manual procedures executed rarely under pressure are precisely where manual execution fails worst — the fix for risk is tested automation with approval gates and game-day rehearsal, not permanent manual toil.</p>"
    }
  ],
  flashcards: [
    { front: "What are the three ways CloudFormation can apply a property change, and which one changes the physical ID?", back: "Update with no interruption, update with some interruption, and <strong>replacement</strong> — new resource created, old deleted, <strong>physical ID changes</strong>. Change sets surface this as Replacement: True/False/Conditional." },
    { front: "What does a CloudFormation stack policy control — and what does it NOT control?", back: "It gates which logical resources <strong>stack update operations</strong> may touch (e.g. deny Update:Replace on the DB). It does NOT block DeleteStack (IAM's job), out-of-band edits (drift's job), and it is not IAM. Override per-update with a temporary policy." },
    { front: "Two structural blind spots of CFN drift detection", back: "(1) Only resource types that support drift detection are checked; (2) only properties <strong>explicitly set in the template</strong> are compared — a hand-edited defaulted property shows no drift. On-demand only; schedule it or use the Config managed rule." },
    { front: "DeletionPolicy vs UpdateReplacePolicy", back: "DeletionPolicy governs stack <strong>deletion</strong>; UpdateReplacePolicy governs the OLD resource during a <strong>replacement</strong>. Retain-on-delete does not protect you during replacement — set BOTH on stateful resources. Snapshot option exists for RDS/EBS/ElastiCache/Redshift/Neptune." },
    { front: "How do CloudFormation rollback triggers work?", back: "Attach up to 5 CloudWatch alarms + a monitoring period (0-180 min) via rollback configuration. If any alarm fires during deploy or the monitoring window, CFN automatically rolls back the operation." },
    { front: "Stack stuck in UPDATE_ROLLBACK_FAILED — the way out?", back: "Fix the underlying cause, then <code>ContinueUpdateRollback</code>, optionally listing resources to skip (they become drift). Deleting the production stack is the distractor, not the answer." },
    { front: "Custom resource stuck-DELETE: cause and immediate fix", back: "Handler Lambda (or its role) was deleted before the custom resource's Delete event — no response ever reaches the pre-signed ResponseURL, and CFN waits hours. Fix now: manually PUT a SUCCESS response to the ResponseURL. Fix forever: DependsOn from custom resource to handler + idempotent always-succeed delete handlers." },
    { front: "CloudFormation hooks vs Config rules vs SCPs — the three enforcement layers", back: "<strong>Hook</strong>: blocks non-compliant IaC at provisioning (proactive). <strong>Config rule</strong>: detects after creation (detective). <strong>SCP</strong>: blocks the API call itself for principals (preventive, IaC or not). Mature orgs layer all three." },
    { front: "The cross-stack export lock", back: "While any stack imports an export, the export cannot change and the exporting stack cannot be deleted. Migrate importers first — or use SSM Parameter Store references for a deliberately loose contract with no lock." },
    { front: "Nested stacks vs exports: coupling in one line each", back: "Nested = one atomic tree, one rollback domain — a failing child rolls back the whole tree; suits a single system. Exports = independent stacks with a hard referential lock; suits platform-to-team contracts." },
    { front: "CDK construct levels L1/L2/L3", back: "<strong>L1</strong> (Cfn*): raw 1:1 CloudFormation mirrors. <strong>L2</strong>: curated defaults + grant methods (bucket.grantRead). <strong>L3</strong>: whole patterns (ApplicationLoadBalancedFargateService). Platform teams publish internal L3s as the paved road." },
    { front: "What is a CDK Aspect?", back: "A visitor applied to the construct tree after construction — inspect or mutate every node (e.g. fail synth if any bucket is unencrypted). Governance at <strong>synthesis time</strong>; cdk-nag ships compliance rule packs as aspects. Complements (does not replace) CFN hooks." },
    { front: "CDK escape hatch", back: "Reach through an L2 to its underlying L1 (<code>node.defaultChild</code>) and set raw CFN properties or addPropertyOverride. CDK never caps you below raw CloudFormation capability." },
    { front: "Why do CDK refactors sometimes replace resources?", back: "Logical IDs derive from the <strong>construct path</strong>; renaming/moving ancestor constructs changes the ID, and CFN executes rename as delete + create. Freeze paths for stateful resources or pin with overrideLogicalId; always cdk diff refactors." },
    { front: "What makes CDK Pipelines self-mutating?", back: "The pipeline definition lives in the repo; the pipeline's first stage updates the pipeline itself before deploying app stages. Cross-account deploys use cdk bootstrap roles (with --trust to the pipeline account)." },
    { front: "Blue/green vs immutable vs canary — one-line distinctions", back: "Immutable: replace infrastructure with a fresh fleet, no mutation. Blue/green: two complete environments, rollback = traffic switch in seconds. Canary/linear: blue/green + gradual weighted shifting. Rolling: mutate in batches, mixed versions, slow rollback." },
    { front: "CodeDeploy Lambda traffic shifting: mechanism and config names", back: "Alias weight between exactly two versions. Configs: Canary10Percent5Minutes (10% then all), Linear10PercentEvery1Minute (steps), AllAtOnce. Alarms give auto-rollback; PreTrafficHook/PostTrafficHook run validation Lambdas." },
    { front: "ECS blue/green test listener — what is it for?", back: "A second ALB listener (e.g. port 8443) routing to the green task set so AfterAllowTestTraffic hook tests run against real infrastructure BEFORE any production traffic shifts. Blue stays running through bake time = instant rollback." },
    { front: "Feature flags vs deployment strategies", back: "Deploy strategy = which <strong>artifact</strong> gets traffic; feature flag = which <strong>code path</strong> runs inside it. Flags (AWS AppConfig: gradual rollout, validators, alarm rollback) give instant kill-switch without redeploy. Canary the artifact, flag the feature." },
    { front: "The #1 cross-account CodePipeline gotcha", back: "The artifact bucket MUST use a <strong>customer-managed KMS key</strong> — the AWS-managed S3 key cannot be granted cross-account. CMK key policy + bucket policy grant the target roles; deploy actions assume a role IN each target account." },
    { front: "Cross-account pipeline promotion trigger", back: "EventBridge: staging pipeline emits a state-change (SUCCEEDED) event, forwarded to the prod account's event bus (resource policy + rule) which starts the prod pipeline. Manual approval actions pause up to 7 days and record approver identity." },
    { front: "Session Manager in a no-internet private subnet — required endpoints", back: "Interface endpoints for <strong>ssm, ssmmessages, ec2messages</strong> (all three — forgetting ssmmessages makes sessions hang), plus KMS endpoint if sessions are KMS-encrypted and S3 gateway endpoint for S3 logging." },
    { front: "Patch Manager: which primitive controls WHAT vs WHEN?", back: "<strong>Baseline</strong> = what is approved (auto-approval delays, allow/reject lists). <strong>Patch group</strong> (tag) = which instances use which baseline. <strong>Maintenance window</strong> = when install runs. Scan mode reports; install mode remediates." },
    { front: "Parameter Store tiers and the Secrets Manager line", back: "Standard: free, 4 KB, 10k params/account-region. Advanced: paid, 8 KB, parameter policies (expiration). Throughput default 40 TPS (raisable, billed). Need automatic rotation or cross-account secret sharing = Secrets Manager." },
    { front: "SSM Automation cross-account: what makes it work?", back: "Execute from a central account against target accounts/OUs: AutomationAdministrationRole centrally, AWS-SystemsManager-AutomationExecutionRole in each target. The answer to 'run one ops procedure across 100 accounts' — includes aws:approve steps for human gates." },
    { front: "Service Catalog launch constraint — why is it the least-privilege trick?", back: "The product provisions using the <strong>constraint role</strong>, not the user's permissions — end users need only Service Catalog access, zero IAM on the underlying services, and cannot deviate from the template. Remember the role also needs permissions to delete/update what it creates." },
    { front: "Image Builder distribution configuration capabilities", back: "Copy output AMIs to multiple regions, share to accounts/OUs/entire org, per-destination encryption, license config attachment, and publish the new AMI ID to SSM parameters / launch templates. Failed test components block distribution." },
    { front: "Runbook vs playbook (Well-Architected definitions)", back: "<strong>Runbook</strong>: achieve a specific outcome, known deterministic steps — automatable (SSM Automation). <strong>Playbook</strong>: investigate an issue, steps branch on findings — automate the data-gathering, humans do the branching." },
    { front: "What distinguishes AWS Proton from Service Catalog?", back: "Proton = platform-team contracts for containers/serverless: versioned environment + service templates WITH fleet version tracking and managed upgrades across instances. Service Catalog = general governed provisioning of arbitrary CFN products. 'Upgrade all services to template v2' language = Proton." },
    { front: "FIS stop conditions", back: "CloudWatch alarms attached to a Fault Injection Service experiment that automatically halt it when impact exceeds plan — the safety net that makes production game days defensible." }
  ],
  lab: {
    title: "Lab: change-set discipline, stack policies, and drift — the production CFN workflow on a free stack",
    html: `
<h3>Goal</h3>
<p>Run the full production-grade CloudFormation workflow against a zero-cost stack: deploy with a protected resource, watch a stack policy block a forbidden update, review a change set that reveals a replacement, execute a safe change, create out-of-band drift and detect it, then tear down — including the deliberately retained resource, so you feel the operational cost of DeletionPolicy: Retain. Uses only SNS and SQS: no charges at this scale.</p>

<h3>Architecture</h3>
<p>One stack: an SNS topic (the disposable resource we will mutate and drift) and an SQS queue marked DeletionPolicy: Retain with a stack policy denying replace/delete updates — standing in for your production database.</p>

<h3>Steps</h3>
<ol>
<li><p>Write the template:</p>
<pre><code>cat &gt; /tmp/lab-stack.yaml &lt;&lt;'EOF'
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  AppTopic:
    Type: AWS::SNS::Topic
    Properties:
      DisplayName: lab-v1
  CriticalQueue:
    Type: AWS::SQS::Queue
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      QueueName: cfn-lab-critical-queue
      MessageRetentionPeriod: 86400
Outputs:
  QueueUrl:
    Value: !Ref CriticalQueue
EOF</code></pre></li>

<li><p>Write the stack policy (allow everything, deny replace/delete on the queue):</p>
<pre><code>cat &gt; /tmp/stack-policy.json &lt;&lt;'EOF'
{
  "Statement": [
    { "Effect": "Allow", "Action": "Update:*",
      "Principal": "*", "Resource": "*" },
    { "Effect": "Deny",
      "Action": ["Update:Replace", "Update:Delete"],
      "Principal": "*",
      "Resource": "LogicalResourceId/CriticalQueue" }
  ]
}
EOF</code></pre></li>

<li><p>Create the stack with the policy attached, and wait:</p>
<pre><code>aws cloudformation create-stack \
  --stack-name cfn-discipline-lab \
  --template-body file:///tmp/lab-stack.yaml \
  --stack-policy-body file:///tmp/stack-policy.json

aws cloudformation wait stack-create-complete \
  --stack-name cfn-discipline-lab</code></pre></li>

<li><p>Attempt a forbidden change. QueueName is immutable, so renaming forces <strong>replacement</strong> — edit the template copy to change QueueName to cfn-lab-critical-queue-v2, then create a change set and inspect it BEFORE executing:</p>
<pre><code>sed 's/cfn-lab-critical-queue/cfn-lab-critical-queue-v2/' \
  /tmp/lab-stack.yaml &gt; /tmp/lab-stack-rename.yaml

aws cloudformation create-change-set \
  --stack-name cfn-discipline-lab \
  --change-set-name rename-queue \
  --template-body file:///tmp/lab-stack-rename.yaml

aws cloudformation describe-change-set \
  --stack-name cfn-discipline-lab --change-set-name rename-queue \
  --query 'Changes[].ResourceChange.[LogicalResourceId,Action,Replacement]'</code></pre>
<p>The output shows CriticalQueue with Action Modify and <strong>Replacement True</strong> — the data-loss event, visible before execution. Now execute it anyway to watch the second line of defense:</p>
<pre><code>aws cloudformation execute-change-set \
  --stack-name cfn-discipline-lab --change-set-name rename-queue</code></pre>
<p>The update fails and rolls back: describe stack events and find the message that the action is denied by the stack policy:</p>
<pre><code>aws cloudformation describe-stack-events \
  --stack-name cfn-discipline-lab --max-items 10 \
  --query 'StackEvents[].[ResourceStatus,ResourceStatusReason]'</code></pre></li>

<li><p>Make a safe change instead. Edit only the topic DisplayName to lab-v2 in the original template, run a new change set, confirm Replacement is False for AppTopic (SNS DisplayName is updatable in place), and execute:</p>
<pre><code>sed 's/lab-v1/lab-v2/' /tmp/lab-stack.yaml &gt; /tmp/lab-stack-v2.yaml

aws cloudformation create-change-set \
  --stack-name cfn-discipline-lab \
  --change-set-name safe-display-name \
  --template-body file:///tmp/lab-stack-v2.yaml

aws cloudformation describe-change-set \
  --stack-name cfn-discipline-lab --change-set-name safe-display-name \
  --query 'Changes[].ResourceChange.[LogicalResourceId,Action,Replacement]'

aws cloudformation execute-change-set \
  --stack-name cfn-discipline-lab --change-set-name safe-display-name
aws cloudformation wait stack-update-complete --stack-name cfn-discipline-lab</code></pre></li>

<li><p>Create drift out-of-band, exactly like a console cowboy would, then detect it:</p>
<pre><code>TOPIC_ARN=$(aws cloudformation describe-stack-resource \
  --stack-name cfn-discipline-lab --logical-resource-id AppTopic \
  --query 'StackResourceDetail.PhysicalResourceId' --output text)

aws sns set-topic-attributes --topic-arn $TOPIC_ARN \
  --attribute-name DisplayName --attribute-value drifted-by-hand

DRIFT_ID=$(aws cloudformation detect-stack-drift \
  --stack-name cfn-discipline-lab --query 'StackDriftDetectionId' --output text)

aws cloudformation describe-stack-drift-detection-status \
  --stack-drift-detection-id $DRIFT_ID

aws cloudformation describe-stack-resource-drifts \
  --stack-name cfn-discipline-lab \
  --stack-resource-drift-status-filters MODIFIED \
  --query 'StackResourceDrifts[].[LogicalResourceId,StackResourceDriftStatus]'</code></pre>
<p>AppTopic reports MODIFIED with the property difference. Note what does NOT appear: properties you never set in the template would not be compared at all — the blind spot from the lesson.</p></li>
</ol>

<h3>Verify</h3>
<p>You demonstrated: (1) a change set exposing Replacement: True before execution; (2) the stack policy converting an approved-but-wrong update into a failed, rolled-back operation; (3) a safe in-place update flowing through change-set review; (4) drift detection catching an out-of-band edit. That is the entire production CFN discipline in miniature.</p>

<h3>Teardown</h3>
<p>Ordered, and it teaches the Retain cost: the queue survives stack deletion and must be removed by hand.</p>
<ol>
<li><p>Delete any leftover change sets, then the stack:</p>
<pre><code>aws cloudformation delete-change-set \
  --stack-name cfn-discipline-lab --change-set-name rename-queue 2&gt;/dev/null

aws cloudformation delete-stack --stack-name cfn-discipline-lab
aws cloudformation wait stack-delete-complete --stack-name cfn-discipline-lab</code></pre></li>
<li><p>The retained queue is now unmanaged — verify it survived, then delete it explicitly:</p>
<pre><code>QUEUE_URL=$(aws sqs get-queue-url \
  --queue-name cfn-lab-critical-queue --query 'QueueUrl' --output text)
aws sqs delete-queue --queue-url $QUEUE_URL</code></pre></li>
<li><p>Confirm nothing remains and remove local files:</p>
<pre><code>aws sqs list-queues --queue-name-prefix cfn-lab
aws sns list-topics --output text | grep cfn-discipline || echo "no lab topics remain"
rm -f /tmp/lab-stack.yaml /tmp/lab-stack-rename.yaml \
      /tmp/lab-stack-v2.yaml /tmp/stack-policy.json</code></pre>
<p>(The SNS topic was stack-owned with the default Delete policy, so it was removed with the stack; the list commands should return nothing. If the rename change set had somehow executed, also check for a -v2 queue.)</p></li>
</ol>
`
  }
});
