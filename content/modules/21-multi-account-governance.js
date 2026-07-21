window.COURSE.register({
  id: "multi-account",
  order: 21,
  track: "sap",
  title: "Multi-Account Strategy & Governance (Pro)",
  description: "How to design and operate an AWS Organization at enterprise scale: OU topology, SCP/RCP guardrail engineering, Control Tower, Identity Center, RAM sharing, centralized security and logging, and the operational lifecycle of accounts. This is core SAP-C02 territory.",
  examWeight: "Heavily tested on SAP-C02 across Domain 1 (Design Solutions for Organizational Complexity, ~26%) and Domain 4 (Accelerate Workload Migration and Modernization). Expect several questions per exam on SCP evaluation, delegated administration, Control Tower, and centralized logging/security patterns.",
  lessons: [
    {
      id: "why-multi-account",
      title: "Why multi-account: the account as the only real boundary",
      html: `
<p>The mental model that unlocks everything else in this module: <strong>the AWS account is the only hard isolation boundary AWS gives you.</strong> Everything inside an account — IAM policies, VPCs, resource policies, tags — is soft, mutable configuration that a sufficiently privileged principal (or a sufficiently bad automation bug) can change. The account boundary is different: nothing crosses it unless <em>both sides</em> explicitly agree, via a resource policy on one side and an identity policy (or an assumed role) on the other. If you think of a Linux box, IAM inside one account is like file permissions; separate accounts are like separate machines.</p>

<p>From that single fact, four architectural properties fall out, and the exam tests all four.</p>

<h3>1. Blast radius</h3>
<p>An account is the unit of damage containment. A leaked access key, a runaway script that deletes S3 buckets, a bad IaC apply, a compromised CI runner — all of these are bounded by the account they occur in. This is why the reference architectures put <em>every production workload in its own account</em>: the compromise of the marketing site's account cannot touch the payments ledger. Control-plane events are also scoped per account: API throttling caused by one team hammering <code>DescribeInstances</code> does not starve another team's automation in a different account.</p>

<h3>2. Quota isolation</h3>
<p>Almost every service quota is <strong>per account, per region</strong>: Lambda concurrent executions, EC2 vCPU limits, EIP counts, KMS request rates, CloudFormation stack counts. In a single shared account, teams are noisy neighbors to each other inside your own company — one team's load test consumes the Lambda concurrency pool and takes down another team's API. Splitting accounts gives each workload its own quota namespace. This is a recurring exam trigger: "one workload's scaling exhausts limits affecting another workload" maps to separate accounts, not to a quota increase.</p>

<h3>3. Billing boundaries</h3>
<p>Cost allocation by tags requires perfect tag hygiene forever; cost allocation by account requires nothing — every line item in Cost Explorer and CUR is already stamped with the account ID. Consolidated billing under an Organization gives you one invoice, volume-tier aggregation (e.g. S3 storage tiers computed across the org), and <strong>Reserved Instance / Savings Plan sharing</strong> across accounts (which you can disable per account when a business unit must not subsidize another). Chargeback and showback become a group-by on account ID.</p>

<h3>4. Security and compliance boundaries</h3>
<p>Auditors love accounts. "PCI scope is these six accounts" is a defensible statement in a way that "PCI scope is these tagged resources" never is. Separate accounts also let you apply different preventive controls per environment: an SCP that denies everything outside eu-west-1 on the regulated OU, while sandbox accounts roam free. Finally, the account is the natural seam for a <strong>data perimeter</strong>: with condition keys like <code>aws:PrincipalOrgID</code> and <code>aws:ResourceOrgID</code> you can express "my identities only touch my resources, my resources only trust my identities."</p>

<div class="callout exam">Trigger phrases that map to "multi-account with AWS Organizations" on SAP-C02: "limit the blast radius", "workloads must not affect each other's service quotas", "separate billing per business unit", "different compliance requirements per environment", "prevent developers from affecting production". If a question offers "use IAM policies and tags in one account" against "separate accounts in an Organization", the single-account answer is almost always the distractor.</div>

<h3>What multi-account costs you</h3>
<p>Be honest about the trade-offs, because the exam sometimes tests the reverse direction:</p>
<ul>
<li><strong>Cross-account friction.</strong> Every integration crossing the boundary needs explicit trust: role assumption, resource policies, RAM shares, VPC peering or Transit Gateway. Latency of development goes up if you don't invest in paved-road automation.</li>
<li><strong>Fixed per-account overhead.</strong> Baseline tooling (CloudTrail, Config recorders, GuardDuty, VPC interface endpoints) multiplies per account. Config and interface endpoints in particular have real per-account costs — which is exactly why centralized patterns (later lessons) exist.</li>
<li><strong>Identity sprawl.</strong> Humans need a way to reach dozens or hundreds of accounts without dozens of credentials — that is what IAM Identity Center solves.</li>
<li><strong>Account lifecycle is now a product.</strong> Vending, baselining, and decommissioning accounts must be automated (Account Factory, AFT) or your org rots.</li>
</ul>
<p>The correct response to this overhead is never "use fewer accounts" — it is "automate the account lifecycle." A senior architect treats accounts like cattle: cheap to create, uniformly configured, disposable.</p>

<div class="callout war">The most common real-world failure is the "shared dev account" that grows for five years until it hosts 40 teams, hits EIP and VPC quotas monthly, and nobody can tell which of the 9,000 security groups are load-bearing. Migrating workloads OUT of a shared account later is an order of magnitude more work than starting them in their own account. The second most common failure: running actual workloads in the management account, where SCPs cannot constrain anything (next lessons explain why).</div>

<h3>How granular? The per-workload-per-environment pattern</h3>
<p>AWS's prescriptive guidance has converged on: <strong>one account per workload per environment</strong> — <em>payments-prod</em>, <em>payments-staging</em>, <em>payments-dev</em>. Small orgs sometimes start with per-team-per-env; that is acceptable, but the per-workload grain is what lets you decommission a workload by closing an account, scope incident response to one account, and read a workload's exact cost off the invoice. Sandbox accounts (per engineer or per team, with spend alarms and aggressive SCPs) round out the picture. AWS Organizations supports thousands of accounts; the default quota is 10 accounts and is raised on request — plan for hundreds.</p>

<div class="callout deep">Why is the account boundary "hard"? Because cross-account access is evaluated differently: for a request to succeed across accounts, the identity-based policy in the calling account AND the resource-based policy in the target account must BOTH allow it (an explicit allow on only one side is not enough, unlike same-account access where either suffices for many services). SCPs, permission boundaries, and session policies then further intersect. This two-party consent model is what makes an account a genuine trust boundary rather than a naming convention.</div>
`
    },
    {
      id: "ou-topology",
      title: "Reference OU topology: OUs are policy attachment points, not org charts",
      html: `
<p>The first mistake enterprises make with Organizations is mirroring the company org chart into OUs. OUs exist for exactly one purpose: <strong>attaching policies (SCPs, RCPs, tag policies, backup policies) to groups of accounts that need the same guardrails.</strong> Reorgs happen yearly; security requirements do not. Group accounts by <em>how they must be governed</em>, not by who owns them — ownership is a tag, not an OU.</p>

<h3>The reference topology</h3>
<p>AWS's multi-account guidance (and what Control Tower builds a subset of) looks like this:</p>
<ul>
<li><strong>Root</strong> — never attach workload policies directly here except universal guardrails (e.g. deny leaving the org). The management account sits at Root and is <em>not inside any OU you govern</em>.</li>
<li><strong>Security OU</strong> — two accounts, both foundational:
  <ul>
  <li><strong>Log Archive</strong>: the write-once destination for org CloudTrail, Config history, VPC Flow Logs. Almost nobody has read access; nobody has delete access. Object Lock where compliance demands it.</li>
  <li><strong>Security Tooling</strong> (Control Tower calls it "Audit"): delegated administrator for GuardDuty, Security Hub, Detective, Inspector, Macie. Your security team's operational home; it can see into every account, but workloads cannot see into it.</li>
  </ul></li>
<li><strong>Infrastructure OU</strong>:
  <ul>
  <li><strong>Network account</strong>: owns Transit Gateways, shared VPCs, Direct Connect gateways, Route 53 Resolver rules, centralized egress and interface endpoints. Shares them out via RAM.</li>
  <li><strong>Shared Services account</strong>: directory services, golden AMI pipelines, internal package repos, CI/CD tooling (some orgs split a dedicated Deployments/Tooling account).</li>
  </ul></li>
<li><strong>Workloads OU</strong> — usually split into <strong>Prod</strong> and <strong>NonProd</strong> (or SDLC) child OUs, because prod and non-prod get different guardrails. Under those, one account per workload per environment.</li>
<li><strong>Sandbox OU</strong> — disconnected-from-corp-network experiment accounts with budget alarms and the loosest (but still real) SCPs. No path to production data.</li>
<li><strong>Suspended OU</strong> — a quarantine parking lot with a deny-almost-everything SCP. Accounts being decommissioned or compromised move here first.</li>
<li>Optional but recommended: <strong>Policy Staging OU</strong> (test SCP changes on canary accounts before promoting), <strong>Exceptions OU</strong> (the one workload that genuinely needs a carve-out — better an explicit OU than a snowflake SCP on one account), <strong>Transitional OU</strong> (accounts migrated in from acquisitions, before they meet baseline).</li>
</ul>

<div class="callout exam">SAP-C02 loves this topology. Know cold: log-archive and security-tooling live in the Security OU; the network account lives in Infrastructure and shares subnets/TGW via RAM; prod and non-prod are separate OUs so they can carry different SCPs; suspended/quarantine OU carries a deny-all-style SCP. A question describing "apply stricter controls to production accounts than development accounts" is answered by OU structure + SCP attachment, not by per-account policies.</div>

<h3>The management account is special — keep it empty</h3>
<p>The management (formerly "master") account: pays the bill, owns the Organization, creates accounts, and is the default home of org-level trails and StackSet administration. Two properties make it dangerous:</p>
<ul>
<li><strong>SCPs do not apply to the management account.</strong> Ever. No guardrail you write can constrain a principal in it.</li>
<li>It cannot be meaningfully quarantined or closed.</li>
</ul>
<p>Therefore: no workloads, no data, no humans working in it day-to-day. Delegate every service that supports delegated administration (a later lesson) out to member accounts, lock the root user with hardware MFA (or move to centrally-managed root access to remove member-account root credentials entirely), and alarm on any management-account console login.</p>

<div class="callout war">Acquisitions are where topology theory meets reality. An acquired company arrives with its own org, its own Identity Center, duplicate CIDR ranges, and workloads in their management account. The playbook: stand up a Transitional OU, migrate accounts in one by one (invite-based), apply a minimal compatibility SCP first (deny-region and deny-leave-org only), and only tighten to full baseline after their workloads prove clean. Trying to force the full guardrail set on day one breaks their production and burns political capital.</div>

<h3>Mechanics and numbers</h3>
<ul>
<li>OUs nest up to <strong>five levels deep</strong> below Root. In practice, if you need more than three you are probably encoding an org chart.</li>
<li>An account lives in exactly <strong>one</strong> OU (a tree, not a graph). Policies attach to Root, OUs, or individual accounts.</li>
<li>Moving an account between OUs is instantaneous and changes its effective policy set immediately — this is both the power (quarantine = move to Suspended OU) and the risk (a mis-drag in the console can strip prod guardrails; alarm on <code>MoveAccount</code> CloudTrail events).</li>
<li>Default maximum accounts per org is small (10) and raised by support request; large enterprises run thousands.</li>
</ul>

<div class="callout limits">Memorize: 5 levels of OU nesting; an account is in exactly one OU; 5 SCPs attached per target (Root, OU, or account); SCP document max 5,120 characters. These exact numbers appear in SAP answer options.</div>

<div class="callout deep">Why not one OU per team? Because policy inheritance composes down the tree, and teams do not share governance requirements — environments and data classifications do. The clean test for an OU boundary: "would I ever attach a policy to this OU that applies to every account in it and to no account outside it?" If the answer is no, it is not an OU, it is a tag. Cost reporting, ownership, and contact routing all work fine off account tags and alternate contacts.</div>
`
    },
    {
      id: "scp-engineering",
      title: "SCP engineering: deny-lists, allow-lists, and Resource Control Policies",
      html: `
<p>Service Control Policies are the preventive-control backbone of an Organization, and the single most-tested Organizations topic on SAP-C02. Start from the rule that resolves 80% of exam questions: <strong>SCPs never grant permissions.</strong> An SCP defines the <em>maximum</em> available permissions — a filter, not a source of authority. The effective permission of any principal in a member account is the <strong>intersection</strong> of: its identity policies, any permission boundary, any session policy, resource policies, and the SCPs in effect. If the SCP does not allow an action, no IAM policy in the account can make it work; if the SCP allows it, the principal still needs an IAM policy that grants it.</p>

<h3>Inheritance is intersection, not merging</h3>
<p>SCP evaluation down the tree is subtler than people assume. It is <strong>not</strong> "concatenate all statements from Root to account." Instead, at <em>each level</em> (Root, each OU on the path, the account), the attached SCPs are unioned, and an action survives only if it is allowed at <strong>every</strong> level. Consequences that the exam probes:</p>
<ul>
<li>An <code>Allow</code> in an OU-level SCP does nothing if a parent level does not also allow the action. You cannot "re-allow" lower down what Root filtered out.</li>
<li>A <code>Deny</code> anywhere on the path wins everywhere below it — explicit deny is unbeatable.</li>
<li>Detaching the default <code>FullAWSAccess</code> policy from a level means only what you explicitly allow at that level survives — a common footgun that instantly bricks an OU.</li>
</ul>

<h3>Deny-list vs allow-list strategy</h3>
<table>
<thead><tr><th></th><th>Deny-list (default)</th><th>Allow-list</th></tr></thead>
<tbody>
<tr><td>Setup</td><td>Keep <code>FullAWSAccess</code> attached everywhere; add targeted Deny statements</td><td>Detach <code>FullAWSAccess</code>; attach explicit Allow policies at every level of the path</td></tr>
<tr><td>New AWS services</td><td>Allowed by default (must remember to deny)</td><td>Blocked by default</td></tr>
<tr><td>Maintenance</td><td>Low — a handful of guardrail policies</td><td>High — every new service/action needs a change at every level</td></tr>
<tr><td>Condition support</td><td>Deny statements support conditions, NotAction, and resource ARNs — full expressiveness</td><td>Allow statements in SCPs do NOT support conditions or specific resource ARNs (only "*")</td></tr>
<tr><td>Who uses it</td><td>Almost everyone, incl. Control Tower</td><td>Highly regulated orgs with a small frozen service list</td></tr>
</tbody>
</table>
<p>That condition-support asymmetry is decisive: all the interesting guardrails are condition-based denies, so the deny-list strategy is the default recommendation and what Control Tower implements.</p>

<h3>The canonical guardrails</h3>
<p>Three condition-based SCPs appear constantly in real orgs and on the exam:</p>
<p><strong>1. Region deny</strong> — pin the org to approved regions, exempting global services whose control planes live in us-east-1:</p>
<pre><code>{
  "Sid": "DenyOutsideApprovedRegions",
  "Effect": "Deny",
  "NotAction": [
    "iam:*", "organizations:*", "route53:*", "cloudfront:*",
    "sts:*", "support:*", "budgets:*", "waf:*", "health:*"
  ],
  "Resource": "*",
  "Condition": {
    "StringNotEquals": { "aws:RequestedRegion": ["eu-west-1", "eu-central-1"] }
  }
}</code></pre>
<p>Forget the <code>NotAction</code> carve-out and you break IAM, Route 53, and CloudFront org-wide — a classic exam distractor is the region-deny SCP without the global-service exemption.</p>
<p><strong>2. Prevent leaving the org</strong> — deny <code>organizations:LeaveOrganization</code> so a compromised admin cannot detach an account from all guardrails.</p>
<p><strong>3. Protect security tooling</strong> — deny <code>guardduty:Delete*</code>, <code>guardduty:Disassociate*</code>, <code>cloudtrail:StopLogging</code>, <code>cloudtrail:DeleteTrail</code>, <code>config:StopConfigurationRecorder</code>, etc., with an <code>ArnNotLike</code> condition on <code>aws:PrincipalARN</code> exempting the break-glass or pipeline role. Attackers disable telemetry first; this SCP makes that impossible from inside a member account.</p>

<div class="callout limits">SCP hard numbers: max document size <strong>5,120 characters</strong> (whitespace counts — minify production SCPs); max <strong>5 SCPs attached per target</strong>; targets are Root, OUs, accounts. SCPs affect all IAM users and roles in member accounts including the root user, but do NOT affect: the management account (at all), service-linked roles, or resource-based policy evaluation for principals outside the org.</div>

<h3>Resource Control Policies (RCPs)</h3>
<p>SCPs constrain your <em>principals</em>; they say nothing about your <em>resources</em> being accessed by outsiders. If an external account's principal reads your S3 bucket via a permissive bucket policy, no SCP is even evaluated — the caller is not in your org. <strong>Resource Control Policies</strong> close that gap: org-managed policies that apply to <em>resources</em> in member accounts, setting the maximum for what any principal (internal or external) can do to them. RCPs are the org-native way to build a data perimeter, replacing per-bucket policy sprawl. The default <code>RCPFullAWSAccess</code> mirrors the SCP model, and the canonical RCP is "deny access to our resources unless <code>aws:PrincipalOrgID</code> is our org" (with carve-outs for trusted service principals). RCPs launched supporting a focused set of services — S3, STS, KMS, SQS, Secrets Manager — with the list growing.</p>

<div class="callout exam">Keyword mapping: "prevent principals in member accounts from doing X" = SCP. "Prevent ANYONE, including external accounts, from accessing our resources / enforce a data perimeter on resources org-wide" = RCP. "SCPs do not apply to the management account / to service-linked roles" is a repeated answer-eliminator. And any option implying an SCP grants access is automatically wrong.</div>

<div class="callout war">Roll out every new SCP the way you roll out code: attach to a Policy Staging OU containing canary accounts, soak, then promote OU by OU. A deny-based SCP typo at Root has taken down entire enterprises' CI/CD in one click, and there is no dry-run mode — the closest tools are IAM Access Analyzer policy validation and CloudTrail-based "who would this have blocked" analysis. Also: because Allow-with-conditions is unsupported, people write elaborate Deny/NotAction lattices that interact badly; keep each SCP single-purpose and named for its intent.</div>
`
    },
    {
      id: "control-tower",
      title: "Control Tower and delegated administration",
      html: `
<p><strong>AWS Control Tower is an opinionated orchestrator on top of Organizations</strong> — it does not replace Organizations, it drives it, along with CloudTrail, Config, Identity Center, and Service Catalog, to build what AWS calls a <em>landing zone</em>: a pre-baked, governed multi-account environment. The SAP-C02 question is rarely "what is Control Tower" and usually "Control Tower or roll-your-own Organizations, given these constraints."</p>

<h3>What setting up a landing zone actually creates</h3>
<ul>
<li>The <strong>Security OU</strong> with the <strong>Log Archive</strong> and <strong>Audit</strong> (security tooling) accounts, pre-wired.</li>
<li>An <strong>organization-wide CloudTrail</strong> and Config recorders in every enrolled account, delivering to Log Archive.</li>
<li><strong>IAM Identity Center</strong> enabled with default permission sets and groups.</li>
<li>A <strong>home region</strong> and an optional region deny control governing where enrolled accounts can operate.</li>
<li><strong>Account Factory</strong>: a Service Catalog product that vends new, pre-baselined accounts into a chosen OU.</li>
</ul>

<h3>Controls: the three-by-three grid</h3>
<p>Control Tower's guardrails ("controls") come in three <strong>behaviors</strong> and three <strong>guidance levels</strong>:</p>
<table>
<thead><tr><th>Behavior</th><th>Implemented as</th><th>Effect</th></tr></thead>
<tbody>
<tr><td>Preventive</td><td>SCPs</td><td>Blocks the action entirely</td></tr>
<tr><td>Detective</td><td>AWS Config rules</td><td>Flags non-compliance after the fact</td></tr>
<tr><td>Proactive</td><td>CloudFormation hooks</td><td>Blocks non-compliant resources at provisioning time (before create)</td></tr>
</tbody>
</table>
<ul>
<li><strong>Mandatory</strong> controls are always on and cannot be disabled — e.g. disallow changes to the Log Archive bucket policy, disallow deleting the landing-zone CloudTrail.</li>
<li><strong>Strongly recommended</strong> — best practice, optional: e.g. disallow public read on S3, require EBS encryption.</li>
<li><strong>Elective</strong> — opt-in, often compliance-framework-driven; enable per OU.</li>
</ul>
<p>Controls attach at the <strong>OU level</strong> (not per account), which is why your OU topology must encode governance boundaries.</p>

<h3>Account Factory and AFT</h3>
<p>Account Factory vends accounts through Service Catalog: a user (or automation) fills in email, OU, and network parameters, and receives an enrolled, baselined account. For real enterprises, the interesting layer is <strong>Account Factory for Terraform (AFT)</strong>: a Terraform-based pipeline where an account <em>request</em> is a Terraform file in a repo; merging it triggers vending, then applies three customization layers — global customizations (every account), OU/scope customizations, and account-specific customizations. AFT is the exam's answer to "GitOps-style account vending with per-account customization." A CloudFormation-native alternative is Account Factory Customization (AFC) with Service Catalog blueprints.</p>

<h3>Drift, enrollment, and the escape hatches</h3>
<ul>
<li><strong>Drift</strong>: Control Tower continuously compares reality against its known-good state — an SCP modified out-of-band, an account moved between OUs, a trail reconfigured. Drift is surfaced in the dashboard; you resolve it by re-registering the OU or repairing the landing zone (which re-applies the baseline). Lesson: never hand-edit resources Control Tower owns.</li>
<li><strong>Enrolling existing accounts</strong>: you can enroll pre-existing accounts (and extend governance to existing OUs). Classic blockers: the account already has a Config recorder/delivery channel in the home region (must be removed first — Control Tower needs to create its own), missing the <code>AWSControlTowerExecution</code> role, or conflicting CloudTrail configuration. Expect an exam scenario about "existing accounts fail to enroll" whose answer involves the pre-existing Config recorder.</li>
<li>Control Tower can be deployed into an <strong>existing</strong> Organization, and coexists with (does not manage) unenrolled accounts.</li>
</ul>

<h3>Control Tower vs DIY Organizations</h3>
<table>
<thead><tr><th></th><th>Control Tower</th><th>DIY Organizations (+ your own IaC)</th></tr></thead>
<tbody>
<tr><td>Time to governed baseline</td><td>Hours</td><td>Weeks to months</td></tr>
<tr><td>Flexibility</td><td>Opinionated; mandatory controls non-negotiable; owns its resources</td><td>Total — you own every SCP, trail, and baseline</td></tr>
<tr><td>Ongoing ops</td><td>Managed control catalog, drift detection, dashboard</td><td>You build drift detection and compliance reporting</td></tr>
<tr><td>Escape valve</td><td>Landing Zone Accelerator (LZA) or custom IaC layered on top</td><td>n/a</td></tr>
</tbody>
</table>
<p>Exam heuristic: greenfield or "fastest path to a governed multi-account environment with minimal operational overhead" = Control Tower. "Highly customized landing zone with requirements Control Tower cannot express" = Organizations directly (often with the Landing Zone Accelerator). Answers proposing to hand-build what Control Tower gives for free, when the question stresses low overhead, are distractors.</p>

<h3>Delegated administration</h3>
<p>Nearly every org-integrated service lets you register a <strong>member account as delegated administrator</strong>, so the management account stays empty: GuardDuty, Security Hub, Macie, Inspector, Detective, IAM Access Analyzer, Config, CloudTrail (org trails), CloudFormation StackSets, Firewall Manager, IPAM, and — importantly — <strong>Organizations itself</strong>: a delegated admin for Organizations can manage policies (SCPs, tag policies) via a resource-based delegation policy, without any access to the billing or account-creation powers of the management account. Control Tower likewise supports designating a security/audit account as delegated admin for the security services it configures.</p>

<div class="callout exam">"Security team must manage GuardDuty/Security Hub across all accounts WITHOUT using the management account" = register the security-tooling account as delegated administrator. "Minimize use of the management account" is a strong hint that the correct option contains delegated admin. Also remember: most services allow only ONE delegated admin account (Security Hub and a few others now allow more, but the safe exam assumption is one per service).</div>

<div class="callout war">Control Tower's mandatory controls protect its own plumbing, which surprises platform teams: you cannot quietly repurpose the Log Archive bucket or edit its policy, and manual changes to Control-Tower-managed SCPs flag drift org-wide. Teams that fight the opinions end up in the worst spot — half-managed. Either adopt its model and layer customizations through AFT/LZA, or skip it entirely; do not straddle.</div>
`
    },
    {
      id: "identity-center",
      title: "IAM Identity Center at scale: permission sets, ABAC, external IdPs",
      html: `
<p>Once you have fifty accounts, IAM users are dead and even hand-rolled SAML federation per account collapses under its own weight. <strong>IAM Identity Center</strong> (the artist formerly known as AWS SSO) is the org-native answer: one place where workforce identities, from whatever source, are mapped to roles across every account. The mental model that matters: <strong>Identity Center is a role-deployment machine.</strong> A <em>permission set</em> is a template; when you assign it to a principal for an account, Identity Center stamps out an IAM role in that account (named <code>AWSReservedSSO_&lt;name&gt;_&lt;hash&gt;</code>) with the template's policies and a SAML trust back to Identity Center. Users never have long-lived credentials; every session is an STS role session with a configured duration (1 to 12 hours).</p>

<h3>Permission sets</h3>
<ul>
<li>Contain: AWS managed policies, customer managed policy <em>references</em> (matched by name in each target account — the policy must already exist there, typically deployed by StackSets), an inline policy, and optionally a <strong>permissions boundary</strong>.</li>
<li>Assignment = (principal, permission set, account). Assign to <strong>groups</strong>, not users — group assignments are the only sane model at scale.</li>
<li>Updating a permission set re-provisions the role in every assigned account — centralized change control over what "Developer" means everywhere, which is precisely what per-account IAM never gives you.</li>
<li>One Identity Center instance per Organization, in a single home region. It supports a <strong>delegated administrator</strong> account — with the notable carve-out that the delegated admin cannot manage assignments <em>in the management account itself</em> (deliberate privilege firebreak).</li>
</ul>

<h3>Identity sources</h3>
<p>Three options: the built-in directory (fine for tiny orgs), AWS Managed Microsoft AD / AD Connector (lift from on-prem AD), or — the enterprise default — an <strong>external IdP via SAML 2.0 with SCIM provisioning</strong> (Okta, Entra ID, Ping). SAML handles authentication; <strong>SCIM keeps users and groups synchronized automatically</strong>, so joiner/mover/leaver flows in the IdP propagate to AWS without manual work. The exam pattern: "workforce already managed in Azure AD/Okta, needs access to 200 accounts with automatic deprovisioning" = Identity Center + external IdP + SCIM. Answers that create IAM users, or that wire SAML federation account-by-account, are distractors.</p>

<h3>ABAC: stop minting a permission set per team</h3>
<p>RBAC-only at scale produces the permission-set explosion: Developer-TeamA-Prod, Developer-TeamB-Prod... The fix is <strong>attribute-based access control</strong>. Enable "attributes for access control" in Identity Center, map IdP attributes (department, team, cost-center) to session tags, and write ONE permission set whose inline policy conditions on them:</p>
<pre><code>{
  "Effect": "Allow",
  "Action": ["ec2:StartInstances", "ec2:StopInstances"],
  "Resource": "*",
  "Condition": {
    "StringEquals": { "aws:ResourceTag/team": "aws:PrincipalTag/team" }
  }
}</code></pre>
<p>One "Developer" permission set now serves every team: each user can only touch resources whose <code>team</code> tag matches the team attribute asserted by the IdP. New team onboarding requires zero IAM changes — just correct attributes in the IdP and correct tags on resources. This pairs with <strong>tag policies</strong> (later lesson) to keep the resource-side tags trustworthy, and with an SCP denying <code>ec2:CreateTags</code>/<code>DeleteTags</code> on the governing tag key to prevent tag-tampering privilege escalation.</p>

<div class="callout exam">Keyword mapping: "reduce the number of permission sets / policies as teams grow" = ABAC with session attributes. "Automatically remove access when employees leave" = SCIM provisioning from the external IdP. "Developers need CLI access to many accounts without long-lived keys" = Identity Center (aws sso login, short-lived credentials). If an option says "create IAM users in each account", it is wrong on a Pro exam essentially always.</div>

<h3>Operational notes and limits</h3>
<ul>
<li>CLI/SDK support is first-class: <code>aws configure sso</code> writes profiles; credentials auto-refresh against the OIDC device flow.</li>
<li>Applications, not just accounts: Identity Center also fronts SAML applications and is the identity layer for Amazon Q, Redshift, and trusted identity propagation into analytics services (S3 Access Grants, Lake Formation) — a growing exam area: end-user identity flows through to data-layer authorization instead of everyone sharing one role.</li>
<li>Quotas are defaults-and-raisable: permission sets per instance (default in the hundreds), permission sets per account, inline policy size (~10 KB, larger than an SCP). The architectural point: ABAC keeps you far from these limits; RBAC sprawl runs into them.</li>
<li>Session duration is per permission set (up to 12h); revocation is not instantaneous — deleting an assignment does not kill live sessions, so pair with SCP-based break-glass denies for true emergency lockout.</li>
</ul>

<div class="callout war">Two production gotchas. First: customer-managed-policy references fail silently at provisioning if the named policy is missing in a target account — deploy the policies via StackSets BEFORE assigning the permission set, and monitor provisioning status. Second: because permission-set roles are recreated/updated by Identity Center, do not reference their ARNs (with the random hash suffix) in resource policies or trust policies; use <code>aws:PrincipalArn</code> with a wildcard over the AWSReservedSSO prefix, or better, condition on principal tags. Hard-coded role ARNs break on re-provisioning.</div>

<div class="callout deep">Under the hood, Identity Center runs a SAML IdP + an OIDC token service in front of STS. The portal exchanges your authenticated session for role credentials via sso:GetRoleCredentials against the deployed AWSReservedSSO role. This is why trust policies on those roles reference the Identity Center SAML provider, and why the roles appear/disappear as assignments change: they are managed artifacts, reconciled by the service, not hand-authored IAM.</div>
`
    },
    {
      id: "ram-shared-network",
      title: "RAM and the centralized network: shared subnets and centralized endpoints",
      html: `
<p><strong>AWS Resource Access Manager (RAM)</strong> is the control-plane mechanism that makes the Infrastructure OU pattern work: an owner account shares a resource, and principals in other accounts can use it <em>in place</em> — no replication, no data copies, no cross-account role assumption for the data path. The owner keeps full control and can stop sharing at any time. RAM itself is free; you pay only for the shared resources as usual.</p>

<h3>The org-sharing switch</h3>
<p>The detail the exam tests every time: by default, sharing to another account creates an <strong>invitation</strong> the recipient must accept. Enable <strong>sharing with AWS Organizations</strong> (one-time, from the management account: <code>ram:EnableSharingWithAwsOrganization</code>), and shares targeted at the org or at OUs are accepted <strong>automatically — no invitations</strong>. This is also what lets you target a whole OU ("share the TGW with the entire Workloads OU") so that newly vended accounts inherit shares with zero touch. Some resource types can <em>only</em> be shared inside an org — VPC subnets are the flagship example — while others (Transit Gateway, prefix lists) can also be shared with arbitrary external accounts via invitation.</p>

<h3>What is shareable (the exam list)</h3>
<ul>
<li><strong>VPC subnets</strong> (VPC sharing) — org-only.</li>
<li><strong>Transit Gateways</strong> — attach VPCs from other accounts.</li>
<li><strong>Route 53 Resolver rules</strong> (and endpoints via rules) — hybrid DNS defined once, used everywhere.</li>
<li><strong>License Manager configurations</strong> — enforce licensing org-wide.</li>
<li>Also: managed prefix lists, IPAM pools, Capacity Reservations and DDBs of the network world (Network Firewall policies, VPC Lattice service networks), Outposts, Service Catalog... the list keeps growing; the four above are the ones SAP names.</li>
</ul>

<h3>Pattern 1: Shared VPC (shared subnets)</h3>
<p>The network account owns the VPC — CIDR, subnets, route tables, NAT, IGW, TGW attachment — and shares selected <strong>subnets</strong> to workload accounts. Participants launch resources (EC2, RDS, Lambda ENIs, ALBs) <em>into the shared subnets</em>; the resources belong to and are billed to the participant, but the network topology is owned centrally. Participants cannot modify route tables, NACLs, or the VPC itself — they see the subnets read-only. Each participant manages its own security groups (participants cannot reference each other's SGs by ID across the share in all cases; plan on prefix lists or CIDR rules).</p>
<p>Why do this: one CIDR plan, no per-account VPC sprawl, no peering mesh, IP space actually utilized, and network guardrails enforced structurally (workload teams <em>cannot</em> create an IGW — they do not own the VPC). Trade-offs: a large shared blast radius at L3, per-AZ subnet sizing becomes a capacity-planning function, and cost attribution for shared NAT/endpoints needs deliberate handling.</p>

<h3>Pattern 2: Centralized interface endpoints</h3>
<p>Interface endpoints cost per-endpoint-per-AZ-per-hour plus data. Fifty accounts each running endpoints for ten services is real money and operational sprawl. The centralized pattern: the network account hosts ONE set of interface endpoints in a hub VPC; spoke VPCs reach them over Transit Gateway. The trick is DNS: disable the endpoint's default private DNS, create a private hosted zone per service (e.g. an alias for the SQS regional name pointing at the endpoint ENIs), and <strong>associate that PHZ with every spoke VPC</strong> (cross-account PHZ association, or Resolver rules shared via RAM). Spokes resolve the service name to the hub endpoint IPs and traffic rides the TGW. Same architecture centralizes egress (hub NAT/inspection VPC) and hybrid DNS (Resolver inbound/outbound endpoints in the network account, rules shared everywhere).</p>

<div class="callout exam">Triggers: "reduce the cost of VPC interface endpoints across many accounts" = centralize endpoints in a shared-services/network VPC behind TGW with PHZ tricks. "Allow application accounts to launch into centrally managed networking without managing VPCs" = VPC sharing via RAM. "Share Transit Gateway with all current AND FUTURE accounts without accepting invitations" = enable RAM org sharing and share to the OU. Distractors: VPC peering meshes (unmanageable at N accounts), copying resources per account, or PrivateLink where simple subnet sharing suffices.</div>

<div class="callout war">Shared-VPC surprises from production: (1) participants can consume ALL the IPs in a shared subnet — one team's autoscaling event can exhaust the subnet for everyone; carve per-team subnets or monitor free-IP CloudWatch metrics. (2) Some services behave differently in shared subnets or need the owner to pre-create service-linked resources; test each new service. (3) Deleting a RAM share while participants still have ENIs in the subnets does not delete the ENIs, but new launches fail immediately — an accidental "unshare" is an instant partial outage. Treat RAM shares as production infrastructure with change control.</div>

<div class="callout deep">RAM is pure control plane: it edits the authorization model, not the network. A shared subnet means EC2's control plane in the participant account is authorized to place ENIs on the owner's subnet — the packets always flowed in the owner's VPC. This is why there is no performance cost, no data-path hop, and why the owner's route tables and NACLs govern everything: RAM shares never move data, they extend permission to attach to existing infrastructure. Availability Zone names are randomized per account (use-only AZ IDs like use1-az1 to coordinate), and RAM shares expose the consistent AZ ID mapping.</div>

<div class="callout limits">Worth memorizing: subnets are shareable only within an Organization; the org-sharing enablement is a one-time management-account action; RAM sharing to an OU covers accounts added to that OU later automatically. TGW attachments from participant accounts appear in the owner account for acceptance unless auto-accept is enabled.</div>
`
    },
    {
      id: "centralized-security-logging",
      title: "Centralized logging, security services, and StackSets",
      html: `
<p>Centralization is where governance becomes operational. Three planes to centralize: <strong>audit logs</strong> (CloudTrail, Config), <strong>security findings</strong> (GuardDuty, Security Hub), and <strong>baseline deployment</strong> (StackSets). All three follow the same shape: managed from a delegated-admin account, delivered to or aggregated in a purpose-built account, protected by cross-account resource policies.</p>

<h3>The organization trail</h3>
<p>One <strong>org CloudTrail</strong>, created from the management account or a delegated administrator, logs every account — including accounts created later, automatically — into a single S3 bucket in Log Archive. Member accounts can see "their" trail but cannot modify or stop it. This kills the classic failure mode of per-account trails someone disables mid-incident. Best practice adds: log file validation on, KMS encryption with a customer-managed key, and an SCP protecting the trail anyway (defense in depth).</p>
<p>The plumbing SAP-C02 actually tests is the <strong>bucket and key policies</strong>. The S3 bucket policy must allow the CloudTrail service principal <code>s3:GetBucketAcl</code> on the bucket and <code>s3:PutObject</code> on the delivery prefixes, conditioned to your trail and org (<code>aws:SourceArn</code> of the trail; object keys land under AWSLogs/&lt;org-id&gt;/...). The KMS key policy must allow the CloudTrail principal <code>kms:GenerateDataKey*</code> (encryption at delivery) and your analysts <code>kms:Decrypt</code> (reading). The most common broken-delivery causes, in exam questions and in life: missing service-principal statements in the bucket policy, or a key policy that never granted CloudTrail GenerateDataKey. Same pattern for centralized Config delivery and VPC Flow Logs to a central bucket: <em>service principal + bucket policy + key policy, all three or nothing works</em>.</p>

<h3>Security services: delegated admin + auto-enable + aggregation</h3>
<p>GuardDuty, Security Hub, Macie, Inspector, and Detective all follow one model:</p>
<ol>
<li>Management account <strong>registers the security-tooling account as delegated administrator</strong>.</li>
<li>The delegated admin enables the service org-wide with <strong>auto-enable for new accounts</strong> — every vended account is covered from minute one, no invitations.</li>
<li>Findings flow to the delegated admin. For Security Hub, add a <strong>cross-region aggregator</strong> so findings from every region concentrate into one home region — one pane for everything.</li>
</ol>
<p>Security Hub additionally runs standards (FSBP, CIS, PCI) as Config-rule-backed checks, aggregates other services' findings in ASFF format, and — via central configuration — pushes consistent standard/control settings to the whole org from the delegated admin. GuardDuty needs no agents or log configuration: it taps CloudTrail, VPC Flow Logs, and DNS logs internally, which is why "enable org-wide threat detection with no per-account setup" maps to GuardDuty with delegated admin.</p>
<p>Add an org-wide <strong>Config aggregator</strong> in the security account for resource-inventory and compliance queries across all accounts and regions (aggregation needs no per-account authorization when org-integrated).</p>

<div class="callout exam">Mappings that repeat: "single view of security findings across all accounts and regions" = Security Hub delegated admin + cross-region aggregation. "Ensure GuardDuty is enabled in every current and future account" = delegated admin + auto-enable (NOT StackSets, NOT per-account scripts — those are the distractors). "Trail that member accounts cannot tamper with" = organization trail. "Query compliance state of all accounts" = org Config aggregator.</div>

<h3>CloudFormation StackSets: deploying the baseline everywhere</h3>
<p>StackSets deploy one template as stack <em>instances</em> across many accounts and regions from a single administration point. The pivotal distinction:</p>
<table>
<thead><tr><th></th><th>Self-managed permissions</th><th>Service-managed permissions</th></tr></thead>
<tbody>
<tr><td>Auth model</td><td>You create AWSCloudFormationStackSetAdministrationRole (admin acct) + ...ExecutionRole (every target) yourself</td><td>Organizations trusted access; CFN creates service-linked roles automatically</td></tr>
<tr><td>Targets</td><td>Explicit account ID lists</td><td>The org or OUs</td></tr>
<tr><td>Auto-deployment</td><td>No</td><td>Yes — accounts joining a target OU get the stack automatically; leaving can remove it</td></tr>
<tr><td>Delegated admin</td><td>n/a</td><td>Supported — run StackSets from the tooling account, not management</td></tr>
<tr><td>Management account as target</td><td>Yes</td><td>Not by default (it is outside the service-managed umbrella)</td></tr>
</tbody>
</table>
<p>"Every new account must automatically receive baseline IAM roles / Config rules / the customer-managed policies Identity Center references" = <strong>service-managed StackSet targeting the OU with auto-deployment on</strong>. Operational knobs that matter at scale: region deployment order, <strong>failure tolerance</strong> (how many account-region failures before abort) and <strong>max concurrency</strong> — a canary-style rollout (tolerance 0, concurrency 1, then widen) is the grown-up way to push org-wide changes.</p>

<div class="callout war">StackSets failure modes seen in the wild: an execution-role trust broken in one account quietly turns every operation into partial failure; instances stuck in OUTDATED after a failed update keep old templates running in some accounts (always reconcile instance status, not just the operation result); and auto-deployment removal on OU exit can DELETE baseline resources from an account you merely re-parented — pair OU moves with a change process. Also note stack instances are independent stacks: a local admin can delete one out from under the StackSet unless SCPs prevent it.</div>

<div class="callout deep">Why aggregation instead of shipping raw logs everywhere: CloudTrail delivery is push (S3 objects, near-real-time-ish, batched), while Security Hub/GuardDuty aggregation is finding-level replication with the delegated admin's copy as the working set. Design consequence: alerting and auto-remediation (EventBridge rules on findings) belong in the delegated-admin account in the aggregation region; forensic raw-log queries (Athena over the CloudTrail bucket) belong in Log Archive. Two different accounts, two different jobs — do not merge them, because the humans who need findings access should not have raw-log access, and vice versa.</div>
`
    },
    {
      id: "org-operations",
      title: "Org operations: quotas at scale, tag/backup policies, account decommissioning",
      html: `
<p>The unglamorous last mile of multi-account governance is lifecycle operations: keeping quotas ahead of growth, keeping metadata (tags) trustworthy, keeping backups provably applied, and getting accounts OUT of the org as cleanly as they came in. SAP-C02 tests each of these with "how do you do X across hundreds of accounts without per-account toil" scenarios.</p>

<h3>Service quotas at organization scale</h3>
<p>Quotas are per-account-per-region, which multi-account strategy exploits — but it also means a freshly vended account starts at <em>default</em> quotas, which are often far below what a production workload needs (Lambda concurrency, EC2 vCPUs, SES sending). Mechanisms that matter:</p>
<ul>
<li><strong>Quota request templates</strong> in Service Quotas: define the increases every new account should request, associate the template with the org, and each newly created account automatically files those requests in the chosen regions at creation time. This is the exam answer to "new accounts repeatedly hit default limits."</li>
<li><strong>Monitoring</strong>: many quotas publish a usage metric in CloudWatch (namespace AWS/Usage); alarm at 80% and automate the increase request (Service Quotas API supports programmatic requests). Deploy the alarms org-wide via StackSets.</li>
<li>Know the categories: adjustable vs non-adjustable quotas (some are hard architectural limits), and account-level vs resource-level. Quota increases are region-scoped and are not instant — capacity-affecting ones can take days, so bake them into the vending pipeline, not the launch-day runbook.</li>
</ul>

<h3>Tag policies</h3>
<p>Tag policies are an Organizations policy type (like SCPs, attached to Root/OU/account, inherited with merge semantics) that define your tagging <em>standard</em>: for a tag key, the correct capitalization, the allowed values, and which resource types the rule covers. Two operating modes, and the difference is a favorite exam nuance:</p>
<ul>
<li><strong>Report-only (default)</strong>: non-compliant tags are flagged in the org-wide compliance view (Resource Groups Tagging API / console); nothing is blocked.</li>
<li><strong>Enforcement</strong> (the <code>enforced_for</code> option): for the specified resource types, non-compliant <em>tagging operations</em> are rejected. Critically, this prevents wrong tags being applied; it does <strong>not</strong> require that a tag be present. To mandate "every instance MUST have a cost-center tag", you need an SCP with a <code>aws:RequestTag</code>/<code>Null</code> condition denying creation without the tag (or a proactive control/CFN hook). Tag policy = correctness of tags; SCP = existence of tags. Questions that conflate the two are testing exactly this line.</li>
</ul>
<p>Trustworthy tags are load-bearing: ABAC authorization, cost allocation, backup selection all key off tags — which is why tag governance is a Pro-level topic at all.</p>

<h3>Backup policies</h3>
<p>Backup policies (another Organizations policy type) push <strong>AWS Backup plans</strong> org-wide: schedules, retention, target vault, and resource selection (typically by tag) defined once at the OU level, materialized as backup plans in every member account. Inheritance supports parent-child merging with operators to control what children may override. Combine three pieces for the full compliance story: backup policies (enforce plans exist), AWS Backup Vault Lock (WORM retention — even root cannot shorten it in compliance mode), and cross-account/cross-region copy into a vault in an isolated account (ransomware-resistant tertiary copy). "Prove every RDS/EBS resource org-wide is backed up per policy, and backups cannot be deleted even by account admins" = backup policies + Vault Lock + AWS Backup Audit Manager reports.</p>

<h3>Other org policy types, briefly</h3>
<ul>
<li><strong>AI services opt-out policies</strong>: org-wide opt-out of AWS AI services using your content for model improvement — the compliance checkbox enterprises ask about.</li>
<li><strong>Declarative policies</strong>: enforce service-level baseline configuration (e.g. EC2 image/AMI settings, S3 account-level Block Public Access posture) declaratively at the org level — newer, but appearing in updated exam pools.</li>
<li><strong>Chatbot policies</strong>: constrain chat-client access org-wide.</li>
</ul>

<h3>Account closure and decommissioning</h3>
<p>Accounts die, and doing it wrong either leaks money or destroys data you were legally required to keep. The mechanics:</p>
<ul>
<li>Close member accounts <strong>from the management account</strong> via the Organizations console or <code>organizations:CloseAccount</code> API — no logging into each account, no per-account root credential dance.</li>
<li>A closed account enters a <strong>SUSPENDED state for 90 days</strong> ("post-closure period"). During it, the account still appears in the org, and you can reopen it via AWS Support. After 90 days it is permanently deleted — resources gone, and the account is <em>still visible</em> in your org list for a while but unrecoverable.</li>
<li><strong>Closure quota</strong>: you can close only 10% of member accounts (by count) within a rolling 30-day window — mass-decommissioning after a divestiture must be scheduled across months.</li>
<li>The root email of a closed account cannot be reused for a new account immediately; email hygiene (plus-addressing on a controlled domain, e.g. aws+workload-prod at yourcorp) is part of the vending standard for this reason.</li>
</ul>
<p>The mature decommissioning runbook: (1) verify no live dependencies (RAM shares consumed by others, cross-account roles, DNS delegations, TGW attachments); (2) final data archival to Log Archive / backup vault, and legal-hold check; (3) move the account to the <strong>Suspended OU</strong> whose SCP denies everything except break-glass read — the "scream test"; (4) soak for the org's chosen quarantine period; (5) close; (6) after the 90-day window, remove references (allow-lists, budgets, CMDB). Billing note: charges stop at closure, but a reopened account resumes with its resources — the quarantine SCP is what guarantees nothing was still mutating state before you pulled the trigger.</p>

<div class="callout exam">Repeating patterns: "new accounts keep hitting default service limits" = org-associated quota request template. "Ensure consistent tag VALUES org-wide" = tag policy with enforcement; "require tags to EXIST at creation" = SCP with aws:RequestTag condition. "Backups that account administrators cannot delete" = AWS Backup Vault Lock + org backup policies. "Decommission an account safely" = quarantine OU with restrictive SCP, then CloseAccount from management, remembering the 90-day suspension and the 10% closure quota.</div>

<div class="callout war">The scream test is not optional. Real orgs have closed "abandoned" accounts that turned out to own the Route 53 hosted zone delegated from prod, or the KMS key encrypting another account's shared snapshots (KMS grants cross-account die with the key). Ninety days of SUSPENDED is your undo window for compute, but discovering the dependency AFTER permanent deletion is unrecoverable. Quarantine-then-wait converts unknown dependencies into support tickets instead of outages.</div>

<div class="callout limits">Numbers to hold: 90-day post-closure suspension; 10% of member accounts closeable per rolling 30 days; tag policies and backup policies inherit with merge semantics (unlike SCPs' intersection semantics); quota request templates apply only to accounts created AFTER association and in the regions you configured.</div>
`
    }
  ],
  quiz: [
    {
      q: "A financial services company runs 40 production workloads in a single AWS account. During a load test, one team consumed the account's Lambda concurrent execution quota, throttling three unrelated customer-facing APIs. Leadership also wants per-workload cost reporting without depending on tagging discipline. Which approach addresses both problems with the least ongoing operational effort?",
      options: [
        "Request a Lambda concurrency quota increase and enforce a mandatory cost-allocation tagging standard with tag policies",
        "Migrate each workload into its own account under AWS Organizations, grouped into OUs, using consolidated billing for cost visibility",
        "Use Lambda reserved concurrency per function and AWS Cost Categories to divide the single account's bill",
        "Create separate VPCs per workload in the same account and enable Cost Explorer resource-level granularity"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> Service quotas are per-account-per-region, so separate accounts give each workload an isolated quota namespace — no team can starve another. Cost falls out for free: every billing line item carries the account ID, so per-workload cost needs no tag hygiene. This is the canonical blast-radius/quota-isolation/billing-boundary argument for multi-account.</p><p><strong>A</strong> raises the shared ceiling but keeps it shared — the next bigger load test recreates the incident — and tag policies govern tag correctness, not billing isolation. <strong>C</strong> is a real mitigation for concurrency (reserved concurrency partitions the pool) but is per-function toil across 40 workloads, does nothing for the dozens of other shared quotas (vCPUs, EIPs, API throttles), and Cost Categories still depend on accurate resource-to-workload mapping. <strong>D</strong> is a pure distractor: VPCs are a network boundary, not a quota or billing boundary — quotas and bills remain account-scoped.</p>"
    },
    {
      q: "An organization applies an SCP to the Workloads OU that explicitly allows ec2:* and s3:*, and has detached FullAWSAccess from that OU. FullAWSAccess remains attached at the Root. A developer role in a member account under Workloads has an IAM policy granting dynamodb:PutItem, but all DynamoDB calls fail with AccessDenied. The platform team attaches a new SCP allowing dynamodb:* directly to the member account. Calls still fail. Why?",
      options: [
        "SCPs never grant permissions, so the account-level SCP has no effect until an IAM policy is also updated",
        "The action must be allowed at every level of the hierarchy; the Workloads OU level does not allow DynamoDB, so the account-level allow cannot restore it",
        "SCPs attached directly to accounts are evaluated only after a 24-hour propagation delay",
        "The FullAWSAccess policy at Root overrides more specific SCPs attached lower in the hierarchy"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> SCP evaluation is an intersection computed per level: an action is available to the account only if it is allowed at the Root level, at EVERY intervening OU, and at the account. Root allows everything (FullAWSAccess), but the Workloads OU — now operating allow-list style — permits only ec2:* and s3:*. DynamoDB dies at that level, and nothing attached lower can resurrect it. The fix is to add DynamoDB to the OU-level allow (or reattach FullAWSAccess there and use deny-list guardrails).</p><p><strong>A</strong> states a true principle (SCPs never grant) but misdiagnoses: the IAM policy already grants dynamodb:PutItem; the block is the OU-level filter. <strong>C</strong> is fiction — SCP changes propagate in minutes, not a fixed 24 hours. <strong>D</strong> inverts the model: a permissive policy at Root does not override lower levels; each level filters independently and the most restrictive intersection wins.</p>"
    },
    {
      q: "A security team must guarantee that no principal in any of 300 member accounts can disable GuardDuty or stop the organization CloudTrail, while a designated break-glass role must remain able to perform these actions during approved maintenance. The management account must remain unaffected. What should they implement?",
      options: [
        "An SCP at the Root denying guardduty and cloudtrail write actions, with a Condition using ArnNotLike on aws:PrincipalARN to exempt the break-glass role",
        "An IAM permissions boundary attached to all roles in all accounts denying the actions, deployed via StackSets",
        "A resource control policy denying cloudtrail:StopLogging for all principals except the break-glass role",
        "A Config rule with an automatic remediation that re-enables GuardDuty and restarts logging when disabled"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct.</strong> This is the classic protect-security-tooling guardrail: a deny-list SCP (deny statements support conditions, unlike SCP allows) attached at Root, with an ArnNotLike condition on aws:PrincipalARN carving out the break-glass role. It is preventive, org-wide, covers new accounts automatically — and note the question's management-account requirement is satisfied by definition, since SCPs never apply to the management account.</p><p><strong>B</strong> could technically express the deny, but permissions boundaries must be attached to every principal in every account forever — a role created without the boundary escapes it. That is detective-grade assurance at preventive-grade cost, and the exam treats it as the over-engineered distractor. <strong>C</strong> misuses RCPs: RCPs govern access to resources (S3, KMS, STS, etc.), not management-plane service actions like stopping a trail — this isn't in their supported scope. <strong>D</strong> is detective/corrective, not preventive: there is a window where logging is off, which fails the 'guarantee' requirement.</p>"
    },
    {
      q: "A company must restrict all activity in its Workloads OU to eu-west-1 and eu-central-1 for data residency. After attaching an SCP that denies all actions when aws:RequestedRegion is not one of those two regions, teams report they can no longer manage IAM roles, Route 53 records, or CloudFront distributions. What is the correct fix?",
      options: [
        "Add eu-west-2 to the allowed region list, since IAM is homed there for European organizations",
        "Rewrite the SCP using NotAction to exempt global services such as iam, route53, cloudfront, organizations, and sts from the region condition",
        "Replace the SCP with a resource control policy, since RCPs handle global services automatically",
        "Move the affected accounts to the management account's OU, where SCPs do not apply"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> Global services (IAM, Route 53, CloudFront, Organizations, STS global endpoint, Support, and friends) present their API calls through us-east-1, so a naive region-deny blocks them org-wide. The standard pattern is a Deny with NotAction listing the global service namespaces, plus the region condition — deny everything outside approved regions EXCEPT these global control planes.</p><p><strong>A</strong> is wrong on facts: IAM is global, not homed in eu-west-2, and adding regions dilutes the residency control without fixing the mechanism. <strong>C</strong> misapplies RCPs — they constrain access to resources for a handful of services and have nothing to do with region-scoping principal actions. <strong>D</strong> is both wrong and dangerous: there is no OU containing the management account, and 'move accounts out of SCP scope' abandons the control instead of fixing it.</p>"
    },
    {
      q: "An enterprise needs a data perimeter guaranteeing that S3 buckets and KMS keys in any member account can never be accessed by principals outside the organization, even if a developer writes a bucket policy granting public or cross-account access. The control must apply automatically to all current and future accounts. Which mechanism achieves this?",
      options: [
        "A service control policy at Root denying s3:PutBucketPolicy and kms:PutKeyPolicy to all principals",
        "A resource control policy at Root denying access unless aws:PrincipalOrgID matches the organization, with exceptions for trusted AWS service principals",
        "S3 Block Public Access enabled at the account level in every account via StackSets, plus KMS key policies reviewed by Access Analyzer",
        "An SCP denying s3:* and kms:* when aws:PrincipalOrgID does not match the organization ID"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> This is precisely the RCP use case: RCPs attach to the org tree and constrain what ANY principal — including external ones — can do to resources in member accounts, regardless of how permissive an individual bucket or key policy is. An org-ID condition RCP is the canonical resource-side data perimeter, and inheritance covers future accounts automatically.</p><p><strong>A</strong> tries to freeze policies rather than constrain access: it blocks legitimate policy management, does nothing about already-permissive policies, and misses non-policy paths (ACLs, access points, pre-existing grants). <strong>C</strong> is defense-in-depth worth having, but Block Public Access addresses public access, not targeted cross-account grants, and Access Analyzer is detective — it reports external access, it does not prevent it. <strong>D</strong> fails structurally: SCPs are only evaluated for principals INSIDE your organization. An external principal calling your bucket never passes through your SCPs, so the condition never fires for exactly the attackers you care about.</p>"
    },
    {
      q: "A company is bootstrapping a multi-account environment. Requirements: governed account vending where each new account is defined as code in a Git repository, with global customizations applied to every account and additional Terraform-based customizations per account, all with minimal undifferentiated platform engineering. Which approach fits best?",
      options: [
        "AWS Control Tower with Account Factory for Terraform (AFT), defining account requests and customizations in version-controlled repositories",
        "AWS Organizations with a custom Step Functions workflow calling organizations:CreateAccount and applying Terraform via CodeBuild",
        "Control Tower Account Factory used manually through the Service Catalog console for each account request",
        "CloudFormation StackSets with service-managed permissions to create accounts and baseline them across OUs"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct.</strong> AFT is purpose-built for exactly this: an account request is a Terraform file; merging it triggers the vending pipeline; and AFT's customization stages (global, then account-level) apply Terraform to every account and per-account specifics. Control Tower supplies the governed landing zone underneath, so the platform team writes almost none of the machinery.</p><p><strong>B</strong> works — people ran this before AFT existed — but it is precisely the undifferentiated heavy lifting the question excludes: you own the state machine, error handling, enrollment into governance, and drift story. <strong>C</strong> loses the as-code requirement: console-driven vending is not Git-defined and has no per-account Terraform customization stage. <strong>D</strong> misunderstands StackSets: they deploy CloudFormation stacks INTO existing accounts; they cannot create accounts, and they are CloudFormation-only where the requirement says Terraform.</p>"
    },
    {
      q: "During enrollment of 15 pre-existing accounts into AWS Control Tower, several accounts fail to enroll while others succeed. The failing accounts were previously managed by a home-grown compliance framework. What is the most likely cause?",
      options: [
        "The failing accounts already have AWS Config recorders and delivery channels configured in the Control Tower home region",
        "Control Tower cannot enroll accounts that existed before the landing zone was created",
        "The accounts exceed the maximum number of SCPs that can be attached to a single account",
        "The failing accounts have IAM Identity Center already enabled, which conflicts with the landing zone"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct.</strong> Control Tower must create and manage its own Config recorder and delivery channel in each enrolled account, and an account can have only one recorder per region. Pre-existing recorders/delivery channels — exactly what a home-grown compliance framework would have installed — are the number-one enrollment blocker; they must be removed (or migrated) before enrollment succeeds. The other classic blocker is a missing AWSControlTowerExecution role.</p><p><strong>B</strong> is false — enrolling existing accounts is a supported, documented flow; that is the whole point of extending governance. <strong>C</strong> is misdirected: the 5-SCP-per-target limit exists but has nothing to do with enrollment failures, and Control Tower attaches its controls at the OU level anyway. <strong>D</strong> is backwards: Identity Center is part of the landing zone and enabled org-wide once; member accounts do not run their own conflicting instances.</p>"
    },
    {
      q: "A security operations team of 12 engineers must administer GuardDuty, Security Hub, and Amazon Macie across 250 accounts and 6 regions. Corporate policy forbids day-to-day use of the management account. Findings from all accounts and regions must appear in one console view in eu-west-1. Which combination meets the requirements? (Select TWO.)",
      options: [
        "Register the security-tooling account as delegated administrator for GuardDuty, Security Hub, and Macie, with auto-enable for new accounts",
        "Deploy GuardDuty detectors to all accounts using a service-managed StackSet and forward findings with per-account EventBridge rules",
        "Configure a Security Hub cross-region finding aggregator with eu-west-1 as the aggregation region",
        "Create an organization CloudTrail in eu-west-1 so all security findings are centralized in the Log Archive bucket",
        "Grant the security team an Identity Center permission set with read access to every member account and have them review findings per account"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<p><strong>A and C are correct.</strong> Delegated administration (A) moves org-wide management of the security services into the security-tooling member account — satisfying the no-management-account rule — and auto-enable covers current and future accounts with findings flowing to the delegated admin. Cross-region aggregation (C) is the Security Hub feature that collapses all regions into the eu-west-1 view, completing the single-pane requirement.</p><p><strong>B</strong> reinvents what the service does natively: delegated admin with auto-enable IS the mechanism for org-wide GuardDuty; StackSets-plus-EventBridge plumbing is the toil-heavy distractor and still would not give one console view. <strong>D</strong> confuses planes: CloudTrail centralizes audit LOGS, not security FINDINGS — GuardDuty/Security Hub findings do not live in the trail bucket. <strong>E</strong> is the anti-pattern the question is designed to exclude: 250 accounts times 6 regions of manual console-hopping.</p>"
    },
    {
      q: "A platform team must ensure every account that is ever added to the Workloads OU automatically receives a baseline CloudFormation stack containing IAM roles and Config rules, without the team maintaining lists of account IDs or creating IAM roles for the deployment machinery. The deployments must be runnable from a central tooling account rather than the management account. Which StackSets configuration is required?",
      options: [
        "A self-managed StackSet in the management account targeting an explicit account list, refreshed by a Lambda function on a schedule",
        "A service-managed StackSet with automatic deployment enabled, targeting the Workloads OU, administered from a delegated administrator account",
        "A service-managed StackSet targeting the organization root, with stack instances manually created for each new account",
        "A self-managed StackSet administered from the tooling account, with the execution role deployed to new accounts by Account Factory"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct</strong> and each clause maps to a requirement: service-managed permissions mean Organizations trusted access creates the roles (no hand-built admin/execution roles); targeting the OU with auto-deployment means accounts joining the OU get the stack with no account-ID bookkeeping; and registering the tooling account as a delegated administrator for CloudFormation StackSets satisfies the no-management-account constraint.</p><p><strong>A</strong> is the legacy pattern the question rules out twice over: explicit account lists plus self-managed roles, held together by scheduled Lambda glue. <strong>C</strong> is self-contradictory — the point of targeting an OU with auto-deployment is that instances are NOT manually created; manual instance creation reintroduces the bookkeeping. <strong>D</strong> gets central administration but self-managed mode has no auto-deployment: nothing triggers the deployment when an account joins the OU, so the core requirement fails.</p>"
    },
    {
      q: "A network team owns a Transit Gateway and a set of Route 53 Resolver rules in a dedicated network account. They must make these usable by all 80 existing workload accounts and by any account created in the future, with no per-account invitation handling. The org uses AWS Organizations with all features enabled. What should they do?",
      options: [
        "Enable resource sharing with AWS Organizations in RAM from the management account, then create resource shares targeting the Workloads OU",
        "Create a RAM resource share listing all 80 account IDs and add new account IDs through the account vending pipeline",
        "Share the Transit Gateway using a cross-account IAM role that workload accounts assume to create attachments",
        "Recreate the Resolver rules in each workload account with CloudFormation StackSets and peer each VPC to the network account"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct.</strong> The one-time org-sharing enablement (a management-account action) changes RAM's behavior in two decisive ways: shares to org targets are auto-accepted (no invitations), and shares can target OUs — so any account later placed in the Workloads OU inherits the TGW and Resolver-rule shares automatically. This is the textbook future-proof sharing answer.</p><p><strong>B</strong> functions but fails the spirit and letter of the requirement: enumerating 80 account IDs is exactly the bookkeeping OU-targeting eliminates, and without org sharing enabled each share still generates an invitation to accept. <strong>C</strong> confuses mechanisms: TGW attachments from other accounts require the TGW to be SHARED via RAM; a cross-account role creating attachments in the owner account inverts ownership and breaks the per-account attachment model. <strong>D</strong> is doubly wrong: Resolver rules are shareable precisely so you do not recreate them per account, and a VPC peering mesh to 80 accounts is the scaling anti-pattern TGW exists to replace.</p>"
    },
    {
      q: "A company wants application teams in 30 accounts to launch EC2 instances and RDS databases into centrally managed networking. Constraints: teams must never be able to create internet gateways or modify route tables, the org must use one contiguous, centrally planned CIDR space, and no VPC infrastructure should exist in the application accounts. Which architecture satisfies this?",
      options: [
        "A VPC in each application account deployed by StackSets from a standard template, with SCPs denying route table modifications",
        "A shared VPC: the network account owns the VPC and shares private subnets to each application account via RAM; teams launch resources into the shared subnets",
        "A central VPC in the network account with VPC peering to a small VPC in each application account for resource placement",
        "AWS PrivateLink endpoints in each application account pointing to services hosted in the network account VPC"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct.</strong> VPC sharing is built for exactly this division of labor: the network account owns the VPC, CIDR plan, route tables, and gateways; participant accounts launch and own their compute in the shared subnets but structurally CANNOT create IGWs or touch routing — they do not own the VPC, so no SCP gymnastics are needed. One VPC also means one coherent CIDR allocation and zero VPC infrastructure in the app accounts.</p><p><strong>A</strong> violates the no-VPC-in-app-accounts constraint, fragments the CIDR plan into 30 allocations, and leans on SCP deny-lists to simulate what ownership boundaries give for free. <strong>C</strong> still requires a VPC (and CIDR chunk) per application account and peering does not stop the account owner from adding an IGW to their own VPC. <strong>D</strong> misreads the requirement: PrivateLink exposes specific services as endpoints; it cannot host a team's EC2 instances or RDS databases in the central network.</p>"
    },
    {
      q: "An organization runs interface VPC endpoints for 12 AWS services in each of 60 spoke accounts and wants to cut the endpoint cost and management burden. All spoke VPCs are attached to a Transit Gateway hub. Which design achieves centralization while keeping AWS service calls on private IPs?",
      options: [
        "Create the interface endpoints once in the network account hub VPC, disable their default private DNS, and associate service-specific private hosted zones (aliasing the endpoint DNS) with every spoke VPC so traffic resolves to the hub endpoints over the Transit Gateway",
        "Create the interface endpoints in the network account and share the endpoint ENIs to spoke accounts with AWS RAM",
        "Replace interface endpoints with gateway endpoints in each spoke VPC, since gateway endpoints are free",
        "Enable private DNS on hub endpoints and add Transit Gateway routes so spokes resolve service names via the default AWS DNS"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A is correct</strong> and every clause is load-bearing. Centralizing the endpoints collapses 60 copies to 1. Default private DNS must be DISABLED on the hub endpoints because it only affects the hub VPC; instead you build private hosted zones for each service name aliased to the endpoint, and associate those PHZs with every spoke VPC (cross-account association or shared Resolver rules), so spokes resolve the public service names to the hub endpoint IPs and packets ride the TGW.</p><p><strong>B</strong> is not a thing: endpoint ENIs are not a RAM-shareable resource type — you share subnets or Resolver rules, not ENIs. <strong>C</strong> only exists for S3 and DynamoDB, and gateway endpoints cannot be used across VPC/TGW boundaries at all — they are route-table constructs local to one VPC. <strong>D</strong> fails on DNS mechanics: private DNS on an endpoint influences resolution only within the endpoint's own VPC; spokes would keep resolving public IPs no matter what TGW routes exist.</p>"
    },
    {
      q: "A company federates its workforce from Okta into IAM Identity Center across 150 accounts. Security requires: engineers may only manage EC2 resources tagged with their own team, teams change frequently, and the number of permission sets must not grow with the number of teams. What should the architect implement?",
      options: [
        "One permission set per team per environment, each with an inline policy scoped to that team's resource tags, assigned to the matching Okta group",
        "Enable attributes for access control, pass the team attribute from Okta as a session tag, and use a single permission set whose policy conditions aws:ResourceTag/team against aws:PrincipalTag/team",
        "One permission set with full EC2 access, relying on tag policies to keep team tags accurate",
        "Separate Identity Center instances per team, each scoped to that team's accounts"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct</strong> — this is the ABAC pattern Identity Center was given attributes-for-access-control for. The IdP asserts the team attribute, Identity Center maps it to a principal tag on the session, and one policy comparing aws:ResourceTag/team to aws:PrincipalTag/team serves every team, present and future. Team churn becomes an IdP-attribute change with zero AWS-side policy work, satisfying the no-growth requirement.</p><p><strong>A</strong> is functional RBAC but is precisely the permission-set explosion the question forbids: sets scale as teams times environments, and every team change is an AWS change. <strong>C</strong> misunderstands tag policies twice: they validate tag correctness on resources, they do not scope any principal's access, and full EC2 access with no principal-side condition means every engineer touches every team's instances. <strong>D</strong> is impossible: an Organization has one Identity Center instance; per-team instances is not a supported topology.</p>"
    },
    {
      q: "After a divestiture, a company must decommission 35 of its 120 member accounts. Compliance requires proof that no workload activity occurs in these accounts for 60 days before termination, and audit logs must remain queryable for 7 years. Which sequence is correct?",
      options: [
        "Close all 35 accounts immediately with organizations:CloseAccount; CloudTrail logs already delivered to the Log Archive account remain available",
        "Move the accounts to a Suspended OU carrying a highly restrictive SCP, monitor for 60 days, then close them in batches respecting the closure quota of 10 percent of member accounts per rolling 30 days; org trail logs persist in Log Archive",
        "Remove the accounts from the organization so they stop incurring charges, then let the account owners close them individually",
        "Delete all resources in each account with a StackSets-deployed cleanup template, then leave the empty accounts in place indefinitely"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B is correct</strong> and sequences every constraint: the Suspended-OU quarantine SCP preventively guarantees the 60-day no-activity window (a scream test with teeth); the org CloudTrail already delivered every account's history to the Log Archive bucket, which outlives the accounts, covering the 7-year retention; and 35 closures out of 120 accounts (about 29%) exceeds the 10%-per-rolling-30-days closure quota, so batching over roughly three months is mandatory, not optional.</p><p><strong>A</strong> fails twice: closing immediately skips the required 60-day proof-of-quiescence, and 35 at once violates the closure quota. <strong>C</strong> is the worst option: removing accounts from the org strips every guardrail, ends org-trail logging going forward, transfers billing to standalone accounts (charges continue), and hands control to owners you no longer govern. <strong>D</strong> leaves live, credentialed accounts in existence forever — a standing attack surface — and satisfies neither the quiescence proof nor actual decommissioning.</p>"
    }
  ],
  flashcards: [
    { front: "Do SCPs grant permissions?", back: "Never. SCPs define the <strong>maximum</strong> available permissions — effective access is the intersection of SCPs, IAM policies, permission boundaries, and resource policies. A principal still needs an IAM allow." },
    { front: "Which principals are NOT affected by SCPs?", back: "The <strong>management account</strong> (entirely exempt), <strong>service-linked roles</strong>, and any principal outside the org. SCPs DO apply to member-account root users." },
    { front: "SCP hard limits worth memorizing", back: "Max <strong>5,120 characters</strong> per SCP (whitespace counts — minify); max <strong>5 SCPs per target</strong> (Root, OU, or account); OUs nest up to <strong>5 levels</strong> deep." },
    { front: "How does SCP inheritance actually evaluate?", back: "Intersection per level, not statement merging: an action must be allowed at Root, at every OU on the path, AND at the account. An allow lower down cannot restore what a parent level filtered out; a deny anywhere wins." },
    { front: "Why do allow-list SCP strategies hurt?", back: "SCP <strong>Allow</strong> statements support no conditions and no resource ARNs (only *), you must maintain allows at every level, and new AWS services are blocked by default. Deny-list with FullAWSAccess retained is the default strategy (and what Control Tower uses)." },
    { front: "Region-deny SCP: the mandatory carve-out", back: "Use Deny + <code>NotAction</code> exempting global services (iam, organizations, route53, cloudfront, sts, support, budgets...) with condition <code>aws:RequestedRegion</code> not in the approved list — otherwise you break IAM and DNS org-wide." },
    { front: "SCP vs RCP: when do you need an RCP?", back: "SCPs only constrain principals INSIDE your org. To stop <strong>external</strong> principals accessing your resources (data perimeter), use a <strong>Resource Control Policy</strong> — e.g. deny unless <code>aws:PrincipalOrgID</code> equals your org. RCPs cover S3, STS, KMS, SQS, Secrets Manager (growing list)." },
    { front: "Reference OU topology: which accounts sit in the Security OU?", back: "<strong>Log Archive</strong> (immutable org-wide log destination) and <strong>Security Tooling / Audit</strong> (delegated admin for GuardDuty, Security Hub, Macie, etc.). Network and Shared Services accounts live in the Infrastructure OU." },
    { front: "What should run in the management account?", back: "Nothing. No workloads, no data, minimal humans. SCPs cannot constrain it and it cannot be quarantined — delegate every service (GuardDuty, Security Hub, StackSets, CloudTrail, even Organizations policy management) to member accounts." },
    { front: "Control Tower control behaviors and how each is implemented", back: "<strong>Preventive</strong> = SCPs (block), <strong>Detective</strong> = Config rules (flag), <strong>Proactive</strong> = CloudFormation hooks (block at provisioning). Guidance levels: mandatory (always on), strongly recommended, elective." },
    { front: "Most common blocker enrolling an existing account into Control Tower", back: "A pre-existing <strong>AWS Config recorder/delivery channel</strong> in the home region (Control Tower must create its own), or a missing AWSControlTowerExecution role." },
    { front: "What is AFT?", back: "<strong>Account Factory for Terraform</strong>: GitOps account vending on Control Tower — an account request is a Terraform file; pipeline vends and enrolls the account, then applies global and per-account Terraform customizations." },
    { front: "What is an Identity Center permission set, really?", back: "A role template. Assignment (principal, permission set, account) makes Identity Center provision an <code>AWSReservedSSO_*</code> IAM role in that account with SAML trust. Updating the set re-provisions the role everywhere it is assigned." },
    { front: "Identity Center ABAC: the one-policy pattern", back: "Map IdP attributes (team, cost-center) to session tags via attributes-for-access-control; write one permission set conditioning <code>aws:ResourceTag/X</code> equals <code>aws:PrincipalTag/X</code>. Permission-set count stops scaling with team count." },
    { front: "What does SCIM add on top of SAML for Identity Center?", back: "SAML authenticates; <strong>SCIM synchronizes users/groups automatically</strong> from the external IdP — joiner/mover/leaver in Okta/Entra propagates to AWS, giving automatic deprovisioning." },
    { front: "RAM: what does enabling sharing with AWS Organizations change?", back: "Shares to org/OU targets are <strong>auto-accepted (no invitations)</strong> and can target OUs, so future accounts in the OU inherit shares automatically. One-time management-account action. VPC subnets are shareable ONLY within an org." },
    { front: "Shared VPC (RAM subnet sharing): who owns what?", back: "Owner (network account): VPC, CIDR, subnets, route tables, gateways. Participants: their own resources/ENIs launched into shared subnets, their own security groups, their own bills. Participants cannot modify VPC topology at all." },
    { front: "Centralized interface endpoints: the DNS trick", back: "Disable private DNS on hub endpoints; create private hosted zones aliasing each service name to the hub endpoint; associate the PHZs with every spoke VPC; traffic reaches the hub over TGW. Gateway endpoints (S3/DynamoDB) can NOT be centralized — they are route-table-local." },
    { front: "Org CloudTrail delivery keeps failing to the central bucket — first three things to check", back: "Bucket policy allows the cloudtrail.amazonaws.com principal (GetBucketAcl + PutObject on the org prefix); KMS key policy grants CloudTrail <code>kms:GenerateDataKey*</code>; correct aws:SourceArn condition. Service principal + bucket policy + key policy — all three or nothing." },
    { front: "StackSets: service-managed vs self-managed in one line each", back: "<strong>Service-managed</strong>: Organizations trusted access, target OUs, auto-deployment to new accounts, delegated admin support. <strong>Self-managed</strong>: you build admin/execution roles, explicit account lists, no auto-deployment." },
    { front: "Tag policy vs SCP for tagging: who does what?", back: "Tag policy (with enforced_for) = tags that ARE applied must have correct case/values. It cannot require a tag to exist — that needs an SCP denying create actions when <code>aws:RequestTag</code> is null (or a proactive control)." },
    { front: "Backup governance triad for 'admins cannot delete backups'", back: "Org <strong>backup policies</strong> (push AWS Backup plans org-wide) + <strong>Vault Lock</strong> in compliance mode (WORM — even root cannot shorten retention) + cross-account copy to an isolated vault account." },
    { front: "Account closure mechanics", back: "Close from the management account (<code>organizations:CloseAccount</code>). Account is <strong>SUSPENDED for 90 days</strong> (recoverable via Support), then permanently deleted. Quota: only <strong>10% of member accounts per rolling 30 days</strong>. Quarantine in a Suspended OU with a deny SCP first." },
    { front: "New accounts keep hitting default service limits — org-scale fix?", back: "Service Quotas <strong>quota request template</strong> associated with the org: newly created accounts automatically file the predefined increase requests in configured regions at creation time." }
  ],
  lab: {
    title: "Lab: build a governed mini-org — OU, region-deny SCP, vended account, verified guardrail",
    html: `
<h3>Goal</h3>
<p>From an Organizations management account, create an OU, author and attach a region-deny SCP with the global-services carve-out, vend a member account into the OU, prove the SCP blocks out-of-region calls from inside the member account, then tear everything down including account closure. Total cost: effectively zero (Organizations, SCPs, and STS are free; you create no billable resources).</p>

<div class="callout war">Use a personal or dedicated test organization. Do NOT run this in a production org: attaching SCPs and closing accounts are org-level mutations. You need management-account admin credentials and a unique email address for the new account (plus-addressing works: you+scplab at yourdomain).</div>

<h3>Architecture</h3>
<p>Management account at Root; a LabGoverned OU under Root carrying one custom SCP (deny everything outside eu-west-1 except global services); one vended member account inside the OU, reached via the auto-created OrganizationAccountAccessRole. You will observe the SCP denying an in-IAM-policy-allowed action — the intersection model in action.</p>

<h3>Steps</h3>
<ol>
<li><p>Confirm the org and capture the Root ID (create the org first with <code>aws organizations create-organization --feature-set ALL</code> if this account is standalone):</p>
<pre><code>aws organizations describe-organization
ROOT_ID=$(aws organizations list-roots --query 'Roots[0].Id' --output text)
echo $ROOT_ID</code></pre></li>

<li><p>Create the OU:</p>
<pre><code>OU_ID=$(aws organizations create-organizational-unit \
  --parent-id $ROOT_ID --name LabGoverned \
  --query 'OrganizationalUnit.Id' --output text)
echo $OU_ID</code></pre></li>

<li><p>Author the region-deny SCP (note the NotAction carve-out — remove it later and watch IAM calls die too, if you want the full lesson):</p>
<pre><code>cat &gt; /tmp/scp-region-deny.json &lt;&lt;'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyOutsideEuWest1",
    "Effect": "Deny",
    "NotAction": [
      "iam:*", "organizations:*", "sts:*", "cloudfront:*",
      "route53:*", "support:*", "budgets:*", "health:*"
    ],
    "Resource": "*",
    "Condition": {
      "StringNotEquals": { "aws:RequestedRegion": ["eu-west-1"] }
    }
  }]
}
EOF</code></pre></li>

<li><p>Create and attach the policy (FullAWSAccess stays attached — this is deny-list strategy):</p>
<pre><code>POLICY_ID=$(aws organizations create-policy \
  --name LabDenyOutsideEuWest1 \
  --description "Lab: pin OU to eu-west-1" \
  --type SERVICE_CONTROL_POLICY \
  --content file:///tmp/scp-region-deny.json \
  --query 'Policy.PolicySummary.Id' --output text)

aws organizations attach-policy --policy-id $POLICY_ID --target-id $OU_ID
aws organizations list-policies-for-target \
  --target-id $OU_ID --filter SERVICE_CONTROL_POLICY</code></pre></li>

<li><p>Vend a member account (use an email you control; creation is async):</p>
<pre><code>REQ_ID=$(aws organizations create-account \
  --email you+scplab@yourdomain.com \
  --account-name scp-lab-account \
  --query 'CreateAccountStatus.Id' --output text)

aws organizations describe-create-account-status \
  --create-account-request-id $REQ_ID</code></pre>
<p>Repeat the describe call until State is SUCCEEDED, then capture the new account ID from the output into ACCT_ID.</p></li>

<li><p>Move the account from Root into the governed OU (this is the moment the SCP starts applying):</p>
<pre><code>aws organizations move-account --account-id $ACCT_ID \
  --source-parent-id $ROOT_ID --destination-parent-id $OU_ID</code></pre></li>

<li><p>Assume the auto-created admin role in the member account:</p>
<pre><code>CREDS=$(aws sts assume-role \
  --role-arn arn:aws:iam::$ACCT_ID:role/OrganizationAccountAccessRole \
  --role-session-name scp-lab --output json)
export AWS_ACCESS_KEY_ID=$(echo $CREDS | python3 -c 'import sys,json;print(json.load(sys.stdin)["Credentials"]["AccessKeyId"])')
export AWS_SECRET_ACCESS_KEY=$(echo $CREDS | python3 -c 'import sys,json;print(json.load(sys.stdin)["Credentials"]["SecretAccessKey"])')
export AWS_SESSION_TOKEN=$(echo $CREDS | python3 -c 'import sys,json;print(json.load(sys.stdin)["Credentials"]["SessionToken"])')</code></pre></li>

<li><p>Verify the guardrail. The role you assumed has AdministratorAccess — full IAM allow — yet the SCP intersection wins:</p>
<pre><code># Allowed region: succeeds (empty list is fine)
aws ec2 describe-instances --region eu-west-1

# Denied region: fails with an explicit-deny error citing the SCP
aws ec2 describe-instances --region us-east-1

# Global service: still works despite the region condition (NotAction carve-out)
aws iam list-roles --max-items 1</code></pre></li>
</ol>

<h3>Verify</h3>
<p>You should have seen: (1) eu-west-1 calls succeed; (2) us-east-1 calls fail with AccessDenied stating an explicit deny in a service control policy — from a role whose IAM policy allows everything, proving SCPs filter rather than grant; (3) IAM (global) unaffected. Optionally check CloudTrail in the management account for your MoveAccount and AttachPolicy events — these are the events a production org should alarm on.</p>

<h3>Teardown</h3>
<p>Order matters: detach and delete policy artifacts, empty the OU, close the account, delete the OU. Drop the assumed-role env vars first.</p>
<ol>
<li><p>Return to management-account credentials:</p>
<pre><code>unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN</code></pre></li>
<li><p>Detach and delete the SCP:</p>
<pre><code>aws organizations detach-policy --policy-id $POLICY_ID --target-id $OU_ID
aws organizations delete-policy --policy-id $POLICY_ID
rm /tmp/scp-region-deny.json</code></pre></li>
<li><p>Move the member account back to Root, then close it:</p>
<pre><code>aws organizations move-account --account-id $ACCT_ID \
  --source-parent-id $OU_ID --destination-parent-id $ROOT_ID
aws organizations close-account --account-id $ACCT_ID
aws organizations describe-account --account-id $ACCT_ID \
  --query 'Account.Status'</code></pre>
<p>Status becomes SUSPENDED: the account remains visible for the 90-day post-closure period, then is permanently deleted. It created no resources, so it accrues no charges while suspended. The email cannot be reused for a new account in the meantime — expected behavior, and exactly why vending standards use plus-addressed emails.</p></li>
<li><p>Delete the now-empty OU:</p>
<pre><code>aws organizations delete-organizational-unit --organizational-unit-id $OU_ID</code></pre></li>
<li><p>If you created the organization solely for this lab and want it gone: after the suspended account is fully removed (or immediately, if you accept it remaining listed), you can delete the org with <code>aws organizations delete-organization</code> — allowed only when no member accounts remain active.</p></li>
</ol>
`
  }
});
