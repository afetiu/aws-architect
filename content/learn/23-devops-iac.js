window.COURSE.registerLearn({
  moduleId: "devops-iac",
  bigPicture: "At scale nobody clicks around the console. Infrastructure is code (<strong>CloudFormation</strong>, <strong>CDK</strong>), changes go through pipelines, deployments shift traffic gradually so they can be undone in seconds, and operations are scripted with <strong>Systems Manager</strong>. This module covers the safety tools at each step: previewing changes, protecting databases, rolling back on alarms, deploying across accounts, and running fleets without SSH. On SAP-C02 the right answer is usually the managed, automated option with the fastest rollback.",
  cheatsheet: [
    { k: "See exactly what will change (especially replacements) before a prod update", v: "<strong>CloudFormation change set</strong>" },
    { k: "Stop a stack update from replacing or deleting the database", v: "<strong>Stack policy</strong> denying Update:Replace/Delete + <strong>UpdateReplacePolicy: Retain</strong>" },
    { k: "Detect manual console changes to stack resources", v: "<strong>Drift detection</strong> — only checks properties set in the template" },
    { k: "Roll back a stack update automatically if an alarm fires", v: "<strong>Rollback triggers</strong>: CloudWatch alarms + monitoring period" },
    { k: "Stack stuck in UPDATE_ROLLBACK_FAILED", v: "Fix the cause, then <strong>ContinueUpdateRollback</strong> (optionally skip resources)" },
    { k: "Stack stuck deleting a Lambda-backed custom resource", v: "Handler deleted first / no response sent — <strong>DependsOn</strong>, idempotent delete, or post the response by hand" },
    { k: "Block non-compliant resources in any CFN deploy, before creation", v: "<strong>CloudFormation Hooks</strong> (proactive), not Config (detective)" },
    { k: "Can't delete a stack because another stack imports its output", v: "By design — <strong>export lock</strong>. Move importers first or use SSM parameters" },
    { k: "Infrastructure in a real programming language, reusable components", v: "<strong>AWS CDK</strong>" },
    { k: "Enforce standards on every construct in CDK apps", v: "<strong>CDK Aspects</strong> (e.g. cdk-nag)" },
    { k: "Shift 10% of Lambda traffic for 5 minutes, roll back on alarm", v: "CodeDeploy <strong>Canary10Percent5Minutes</strong> on an alias with alarms" },
    { k: "Test new ECS version on a separate port before prod traffic", v: "CodeDeploy <strong>blue/green with a test listener</strong> + AfterAllowTestTraffic hook" },
    { k: "Turn off a bad feature instantly without redeploying", v: "<strong>Feature flag</strong> in AWS AppConfig" },
    { k: "Cross-account CodePipeline fails with access denied", v: "Artifact bucket needs a <strong>customer-managed KMS key</strong> shared with target accounts" },
    { k: "Human sign-off before production with an audit record", v: "<strong>Manual approval action</strong> (up to 7 days)" },
    { k: "No bastions, no inbound SSH, audited shell access", v: "<strong>SSM Session Manager</strong> (+ VPC endpoints for private subnets)" },
    { k: "Run one procedure across 100 accounts without logging in", v: "Multi-account <strong>SSM Automation</strong> runbook" },
    { k: "Different patch schedules for prod and dev", v: "<strong>Patch groups + maintenance windows</strong> (Patch Manager)" },
    { k: "Automate building, testing and sharing hardened AMIs org-wide", v: "<strong>EC2 Image Builder</strong> pipeline + distribution config" },
    { k: "Devs launch approved stacks without permissions on the services", v: "<strong>Service Catalog launch constraint</strong>" }
  ],
  lessons: {
    "cfn-advanced": {
      minutes: 5,
      tldr: [
        "<strong>Change sets</strong> preview an update. Watch the <strong>Replacement</strong> column — replacing a database means losing its data.",
        "<strong>Stack policies</strong> block chosen updates (like replacing the DB). They don't stop stack deletion or console edits.",
        "<strong>Drift detection</strong> finds manual changes, but only to properties you set in the template, and only when you run it.",
        "<strong>Rollback triggers</strong> watch up to 5 CloudWatch alarms and undo the update if one fires.",
        "Set <strong>DeletionPolicy</strong> and <strong>UpdateReplacePolicy</strong> to Retain/Snapshot on anything holding data."
      ],
      analogy: "A change set is the “review your order” page before you pay: nothing happens until you confirm. A stack policy is a “do not demolish” sign on one building — it stops the renovation crew, but not someone who sells the whole plot (DeleteStack).",
      examTip: "“Review what will change before a prod update” = <strong>change set</strong>. “Prevent accidental replacement of the database during updates” = <strong>stack policy</strong>. “Roll back automatically when an alarm fires” = <strong>rollback triggers</strong>, not a custom Lambda.",
      terms: [
        { t: "Change set", d: "A preview of what an update will add, modify or replace. Nothing changes until you run it." },
        { t: "Stack policy", d: "JSON on a stack that blocks update actions on chosen resources." },
        { t: "Drift", d: "When live resources no longer match what the stack deployed, usually from manual edits." },
        { t: "UpdateReplacePolicy", d: "What happens to the OLD resource when an update replaces it: Delete, Retain or Snapshot." },
        { t: "ContinueUpdateRollback", d: "The way out of UPDATE_ROLLBACK_FAILED, optionally skipping stuck resources." }
      ],
      check: [
        {
          q: "DeletionPolicy is Retain on the database, but a template change forced a replacement and the old DB was deleted. What was missing?",
          options: ["A stack policy on DeleteStack", "UpdateReplacePolicy: Retain", "Drift detection"],
          answer: 1,
          why: "DeletionPolicy covers deleting the stack; UpdateReplacePolicy covers the old resource during a replacement. Set both on data stores."
        },
        {
          q: "Someone changed a property by hand that the template never set. Drift detection shows IN_SYNC. Why?",
          options: ["Drift detection only compares properties set in the template", "Drift detection runs continuously and hasn't caught up", "The stack policy hid the change"],
          answer: 0,
          why: "Only explicitly declared properties are compared. A property left at its default and later changed by hand won't show as drift."
        }
      ]
    },
    "cfn-extensibility": {
      minutes: 5,
      tldr: [
        "<strong>Custom resources</strong> call your Lambda, which must send back a response. No response = a stack stuck for an hour or more.",
        "Classic stuck DELETE: the handler Lambda was deleted first. Fix with <strong>DependsOn</strong> and a delete handler that always succeeds.",
        "<strong>Macros</strong> rewrite templates (SAM is one). <strong>Hooks</strong> check resources before they're created and can block them.",
        "<strong>Nested stacks</strong> = one unit that rolls back together. <strong>Exports</strong> = loose links, but an export in use is locked.",
        "Limits: <strong>500 resources</strong> per stack; nested stacks get around it."
      ],
      analogy: "A custom resource is asking a contractor to do a job and phone back when done. If the contractor never calls — or you fired them before the job — you're left waiting by the phone. Hooks are the building inspector who checks the plans before anything is built.",
      examTip: "“Stack stuck in DELETE_IN_PROGRESS with a Lambda custom resource” = handler gone or no response sent. “Block non-compliant IaC before creation” = <strong>CloudFormation Hooks</strong>. “Can't delete: output is imported” = the export lock, working as designed.",
      terms: [
        { t: "Custom resource", d: "A resource whose create/update/delete is handled by your own Lambda or SNS topic." },
        { t: "ResponseURL", d: "Pre-signed S3 URL your handler must send SUCCESS or FAILED to." },
        { t: "Macro / transform", d: "A Lambda that rewrites the template before deployment, e.g. AWS::Serverless." },
        { t: "Hook", d: "Check that runs before a resource is created, updated or deleted; can warn or fail." },
        { t: "Fn::ImportValue", d: "Reads another stack's export. While used, the export can't change or be deleted." }
      ],
      check: [
        {
          q: "Security wants to block any CloudFormation deployment that would create an unencrypted S3 bucket, before the bucket exists. What fits?",
          options: ["An AWS Config rule", "A CloudFormation Hook", "A CloudFormation macro"],
          answer: 1,
          why: "Hooks run before provisioning and can fail the operation. Config only detects after the bucket already exists."
        },
        {
          q: "A network stack exports its VPC ID, which 20 app stacks import. You try to delete the network stack. What happens?",
          options: ["It deletes, and the app stacks break", "It fails until no stack imports the export", "The export is copied into each app stack"],
          answer: 1,
          why: "An export in use is locked. Remove the imports first, or use SSM parameters if you want a looser link."
        }
      ]
    },
    "cdk-for-architects": {
      minutes: 5,
      tldr: [
        "<strong>CDK</strong> is code (TypeScript, Python…) that compiles into a CloudFormation template. CFN rules still apply.",
        "Construct levels: <strong>L1</strong> = raw CFN resource, <strong>L2</strong> = sensible defaults + grant methods, <strong>L3</strong> = whole patterns.",
        "<strong>Aspects</strong> visit every construct and can enforce rules (e.g. cdk-nag).",
        "<strong>Escape hatches</strong> let you set any raw CFN property an L2 doesn't expose.",
        "<strong>CDK Pipelines</strong> updates itself; <strong>cdk bootstrap</strong> prepares each target account."
      ],
      analogy: "CDK is like writing a recipe in a real programming language that prints out the exact shopping list (the CloudFormation template). L1 is buying single ingredients, L2 is a meal kit with sensible portions, L3 is a ready-made dinner.",
      examTip: "“Developers want infrastructure in a familiar programming language with reusable components” = <strong>CDK</strong>. “Property not supported by the high-level construct” = <strong>escape hatch</strong> to L1, not a custom resource. Terraform is only right when the question says multi-cloud or existing Terraform.",
      terms: [
        { t: "Construct", d: "A building block in CDK: from one resource (L1) to a whole architecture (L3)." },
        { t: "cdk synth", d: "Runs your code and outputs the CloudFormation template plus assets." },
        { t: "Aspect", d: "Code that walks every construct in the app to check or change it." },
        { t: "Escape hatch", d: "Reaching the underlying L1 resource to set raw CloudFormation properties." },
        { t: "cdk bootstrap", d: "Creates the asset bucket, ECR repo and deploy roles CDK needs in an account/region." }
      ],
      check: [
        {
          q: "A team refactors CDK code, moving a database construct under a new parent. The deploy wants to replace the database. Why?",
          options: ["CDK always replaces databases on update", "The logical ID came from the construct path, which changed", "The bootstrap stack is outdated"],
          answer: 1,
          why: "Logical IDs come from the construct tree. Moving it changes the ID, and CloudFormation treats that as delete-and-create."
        },
        {
          q: "Which construct level gives you bucket.grantRead(fn) that writes a scoped IAM policy for you?",
          options: ["L1", "L2", "L3"],
          answer: 1,
          why: "L2 constructs add defaults and grant helpers. L1 is a bare mirror of the CloudFormation resource."
        }
      ]
    },
    "deployment-strategies": {
      minutes: 5,
      tldr: [
        "Every strategy trades <strong>extra capacity</strong> vs <strong>rollback speed</strong> vs <strong>how many users see a bad version</strong>.",
        "<strong>Rolling</strong>: no extra capacity, mixed versions. <strong>Blue/green</strong>: double capacity, rollback in seconds.",
        "<strong>Canary/linear</strong>: blue/green with traffic shifted gradually, e.g. 10% for 5 minutes, then all.",
        "CodeDeploy: EC2 (instances), <strong>Lambda</strong> (alias weights), <strong>ECS</strong> (two target groups + test listener).",
        "<strong>Feature flags</strong> (AppConfig) turn code paths on/off without any deployment."
      ],
      analogy: "Blue/green is opening a new restaurant next door and moving diners over — if the food's bad, send them back. Canary is letting one table try the new menu first. A feature flag is the chef quietly taking one dish off the menu without rebuilding the kitchen.",
      examTip: "“Fastest rollback” always points to a <strong>traffic switch</strong> (blue/green, canary), never a redeploy. “Mixed versions unacceptable” rules out rolling. “Disable a feature instantly without redeploying” = <strong>AppConfig feature flag</strong>.",
      terms: [
        { t: "Blue/green", d: "Run old and new environments side by side, then switch traffic." },
        { t: "Canary", d: "Send a small slice of traffic to the new version first, then the rest." },
        { t: "Immutable deployment", d: "Launch fresh instances with the new version instead of changing running ones." },
        { t: "Lambda alias", d: "A named pointer to a version; can split traffic between two versions." },
        { t: "AppConfig", d: "AWS service for feature flags and config, with gradual rollout and alarm rollback." }
      ],
      check: [
        {
          q: "An EC2 app must keep full capacity during deployment and allow near-instant rollback. Which strategy?",
          options: ["Rolling, one batch at a time", "Blue/green with a replacement Auto Scaling group", "In-place all at once"],
          answer: 1,
          why: "Blue/green keeps the old fleet running, so rollback is just switching traffic back. Rolling lowers capacity; in-place means downtime."
        },
        {
          q: "Why is a Lambda canary deployment almost free while EC2 blue/green doubles cost?",
          options: ["Lambda versions cost nothing extra when idle; EC2 needs a second always-on fleet", "Lambda doesn't support blue/green", "CodeDeploy is free only for Lambda"],
          answer: 0,
          why: "Two Lambda versions scale to zero and the alias just routes. EC2 must pre-provision a full second fleet."
        }
      ]
    },
    "pipeline-architecture": {
      minutes: 5,
      tldr: [
        "Pipelines live in a central <strong>tooling account</strong>; each workload account only holds a deployment role.",
        "Cross-account CodePipeline needs a <strong>customer-managed KMS key</strong> on the artifact bucket. The AWS-managed key can't be shared.",
        "Also needed: bucket policy, a role in each target account, and the pipeline set to use them.",
        "<strong>Build once, promote the same artifact</strong> through every environment.",
        "Use <strong>manual approval</strong> (up to 7 days) for sign-off and <strong>EventBridge</strong> to chain pipelines across accounts."
      ],
      analogy: "The tooling account is a central bakery. It bakes each cake once and delivers the same cake to every shop (account) in a locked box (KMS key). Each shop gives the driver a key to its back door (a role), and can change the lock anytime.",
      examTip: "Cross-account CodePipeline access denied = the artifact bucket must use a <strong>customer-managed KMS key</strong> with a key policy for the target accounts. An answer that keeps the AWS-managed key is wrong, full stop.",
      terms: [
        { t: "Tooling account", d: "Central, locked-down account that owns CI/CD pipelines." },
        { t: "Artifact bucket", d: "S3 bucket where CodePipeline passes build outputs between stages." },
        { t: "CloudFormation service role", d: "Role CFN uses to create resources; defines what a deployment may touch." },
        { t: "Manual approval action", d: "Pipeline step that waits for a human yes/no, up to 7 days." },
        { t: "Build once", d: "Deploy the exact same tested artifact to every environment; never rebuild per stage." }
      ],
      check: [
        {
          q: "A pipeline in the tooling account fails at the prod deploy stage with access denied. The artifact bucket uses the default aws/s3 key. Fix?",
          options: ["Add a bucket policy for the prod role", "Switch to a customer-managed KMS key and grant the prod role in its key policy", "Make the bucket public-read"],
          answer: 1,
          why: "AWS-managed keys can't be granted to other accounts. A bucket policy alone doesn't help if the role can't decrypt."
        },
        {
          q: "What should limit what a pipeline deployment can create in the prod account?",
          options: ["The CodeBuild role", "A tightly scoped CloudFormation service role in prod", "The manual approval step"],
          answer: 1,
          why: "The CFN service role does the real work, so it's the blast-radius control. Giving it AdministratorAccess turns the pipeline into an escalation path."
        }
      ]
    },
    "ssm-ops-backbone": {
      minutes: 5,
      tldr: [
        "The <strong>SSM Agent</strong> connects outbound on 443 — no inbound ports. Needs an instance profile with the SSM core policy.",
        "<strong>Session Manager</strong>: shell access with IAM, no SSH keys, no bastions, full logging.",
        "<strong>Run Command</strong> for one-off commands at scale; <strong>Automation</strong> runbooks for multi-step, approval-gated, multi-account jobs.",
        "<strong>Patch Manager</strong> + patch groups + <strong>maintenance windows</strong> patch prod and dev on different schedules.",
        "<strong>Parameter Store</strong> is free config (4 KB); <strong>Secrets Manager</strong> adds automatic rotation."
      ],
      analogy: "The SSM Agent is a worker who phones head office every few minutes asking “any jobs for me?”. Because the worker always calls out, head office never needs a door into the building — no SSH, no bastion.",
      examTip: "“Eliminate bastion hosts / no inbound SSH / audit all interactive access” = <strong>Session Manager</strong>. Private subnet with no NAT? Add interface endpoints for <strong>ssm, ssmmessages, ec2messages</strong>. “Automatic rotation” = Secrets Manager.",
      terms: [
        { t: "Session Manager", d: "Browser/CLI shell to instances via SSM, controlled by IAM and logged." },
        { t: "Run Command", d: "Run a document across many instances with concurrency and error limits." },
        { t: "Automation runbook", d: "Multi-step operational workflow, can pause for approval and run cross-account." },
        { t: "Patch baseline", d: "Rules for which patches are approved, e.g. critical patches after 7 days." },
        { t: "Maintenance window", d: "A scheduled time slot when patching or other tasks may run." }
      ],
      check: [
        {
          q: "Instances in a private subnet with no NAT show as online in SSM, but Session Manager sessions hang. Likely cause?",
          options: ["Missing the ssmmessages VPC endpoint", "Port 22 is closed", "The instance needs a public IP"],
          answer: 0,
          why: "Sessions use the ssmmessages channel. The ssm endpoint alone lets the agent register but not open sessions."
        },
        {
          q: "Ops must run the same multi-step fix across 100 accounts, with a human approval step. Best tool?",
          options: ["A StackSet", "An SSM Automation runbook run across accounts with aws:approve", "SSH scripts from a bastion"],
          answer: 1,
          why: "Automation runbooks support approval steps and run natively across accounts and regions from a central account."
        }
      ]
    },
    "golden-ami-service-catalog": {
      minutes: 5,
      tldr: [
        "<strong>EC2 Image Builder</strong> builds, tests and shares hardened “golden” AMIs on a schedule — no custom scripts.",
        "Its <strong>distribution config</strong> copies AMIs to regions and shares them with accounts, OUs or the whole org.",
        "Publish the latest AMI ID to an <strong>SSM parameter</strong> so launch templates always pick up the current image.",
        "<strong>Service Catalog</strong> turns approved CloudFormation templates into a self-service menu.",
        "A <strong>launch constraint</strong> runs the template with a product role, so users need no rights on EC2, RDS, etc."
      ],
      analogy: "Service Catalog is a company vending machine: staff press a button and get an approved laptop setup. They don't need the warehouse keys — the machine (launch constraint role) has them, and it only dispenses what's on the menu.",
      examTip: "“Developers must provision approved architectures without permissions on the underlying services” = <strong>Service Catalog launch constraint</strong>, every time. “Automate hardened AMIs across accounts with minimal custom tooling” = <strong>Image Builder</strong>.",
      terms: [
        { t: "Golden AMI", d: "A standard, hardened machine image with agents and patches baked in." },
        { t: "Image recipe", d: "Base image plus build and test components that Image Builder applies." },
        { t: "Portfolio", d: "A group of Service Catalog products shared with users, accounts or OUs." },
        { t: "Launch constraint", d: "IAM role Service Catalog uses to launch a product instead of the user's permissions." },
        { t: "Template constraint", d: "Limits product parameters, e.g. only certain instance types." }
      ],
      check: [
        {
          q: "Developers get Service Catalog access to an RDS product with a launch constraint. What permissions do they need on RDS?",
          options: ["Full RDS permissions", "None — the launch role creates the resources", "Read-only RDS permissions"],
          answer: 1,
          why: "The launch constraint's role runs CloudFormation, so users only need Service Catalog permissions."
        },
        {
          q: "How should ASGs always launch the newest approved golden AMI without anyone editing templates?",
          options: ["Hard-code the AMI ID and update it monthly", "Reference an SSM parameter that Image Builder updates", "Copy the AMI into each account by Lambda"],
          answer: 1,
          why: "Image Builder can write the new AMI ID to an SSM parameter; launch templates resolve it at launch."
        }
      ]
    },
    "opex-patterns": {
      minutes: 5,
      tldr: [
        "<strong>Runbook</strong> = known steps to reach a known outcome; automate it (SSM Automation).",
        "<strong>Playbook</strong> = steps to investigate an unknown problem; it branches on what you find.",
        "<strong>ADR</strong> (architecture decision record) = short, permanent note of one decision and why. Superseded, never edited.",
        "<strong>Game day</strong> = practising a real failure with real people and runbooks. <strong>FIS</strong> injects the faults safely.",
        "The theme: <strong>operations as code</strong> — procedures that run, versioned and reviewed like software."
      ],
      analogy: "A runbook is a recipe: follow the steps, get the cake. A playbook is a doctor's diagnosis checklist: the next question depends on the last answer. A game day is a fire drill — you only know the exits work if people actually walk through them.",
      examTip: "“Documented procedure for a well-understood event” = <strong>runbook</strong>; “process to investigate an unknown failure” = <strong>playbook</strong>. “Controlled fault injection that stops when alarms fire” = <strong>AWS FIS with stop conditions</strong>.",
      terms: [
        { t: "Runbook", d: "Step-by-step procedure for a specific, known task; ideal for automation." },
        { t: "Playbook", d: "Investigation guide for unknown issues; branches based on findings." },
        { t: "ADR", d: "Architecture decision record: context, decision, consequences, status." },
        { t: "Game day", d: "A planned rehearsal of a failure scenario to test systems and people." },
        { t: "Stop condition", d: "CloudWatch alarm that automatically halts an FIS experiment." }
      ],
      check: [
        {
          q: "Latency spikes with no obvious cause. The on-call follows a guide that checks deployments, then dependencies, then logs. What is that guide?",
          options: ["A runbook", "A playbook", "An ADR"],
          answer: 1,
          why: "Investigating an unknown issue with branching steps is a playbook. A runbook is for a known task with a known end state."
        },
        {
          q: "The team wants to prove its DR plan meets the RTO. What's the best evidence?",
          options: ["A yearly document review", "A game day that runs the DR runbook against a real environment", "More CloudWatch alarms"],
          answer: 1,
          why: "Only rehearsing the failure shows the real recovery time. A paper review is still a guess."
        }
      ]
    }
  }
});
