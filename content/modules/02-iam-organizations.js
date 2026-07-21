/* Module 2 — IAM, STS & Organizations (SAA track) */
window.COURSE.register({
  id: "iam",
  order: 2,
  track: "saa",
  title: "IAM, STS & Organizations",
  description: "The policy language and its evaluation order, STS role mechanics from AssumeRole to IRSA, cross-account patterns and the confused deputy, and the org-level guardrails: SCPs, permission boundaries, Identity Center, and Access Analyzer.",
  examWeight: "The core of Domain 1 (Design Secure Architectures, 30%). Expect 8-12 questions that turn on policy evaluation, role trust, cross-account access, or SCP behavior. This is the highest-yield module in the course.",
  lessons: [
    {
      id: "policy-language",
      title: "Principals and the policy language: every element that matters",
      html: `
<p>Mental model first: IAM is a <strong>default-deny authorization engine</strong> evaluated on every single API request. Each request arrives with a signed identity (the principal), an action (service:Operation), a resource, and a bag of request context keys. Policies are JSON documents that match against that tuple. Nothing is reachable until something allows it, and any matching explicit deny is final. Everything else in this module is elaboration of that sentence.</p>

<h3>Principals</h3>
<p>Four kinds matter: the <strong>root user</strong> (the account identity itself — cannot be restricted by IAM policies, only by SCPs), <strong>IAM users</strong> (long-lived credentials; legacy posture, minimize them), <strong>IAM roles</strong> (identities with no credentials of their own — assumed via STS to mint temporary ones; the modern default for humans and workloads alike), and <strong>federated identities</strong> (external users mapped onto roles). Services themselves also act as principals (<code>"Service": "lambda.amazonaws.com"</code>) when they assume roles on your behalf.</p>

<h3>Statement anatomy</h3>
<pre><code>{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowReadFromOneBucket",
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:ListBucket"],
    "Resource": ["arn:aws:s3:::app-data", "arn:aws:s3:::app-data/*"],
    "Condition": {
      "StringEquals": { "aws:PrincipalTag/team": "payments" },
      "IpAddress":    { "aws:SourceIp": "203.0.113.0/24" }
    }
  }]
}</code></pre>
<ul>
<li><strong>Version</strong>: always <code>2012-10-17</code>. Omitting it silently disables policy variables — a real bug class, not pedantry.</li>
<li><strong>Effect</strong>: Allow or Deny. There is no ordering between statements; deny always wins regardless of position.</li>
<li><strong>Action</strong>: service-prefixed operation names, wildcardable (<code>s3:Get*</code>). The action namespace is not identical to the API namespace everywhere (S3's ListBucket authorizes ListObjectsV2).</li>
<li><strong>Resource</strong>: ARNs, wildcardable. Some actions are not resource-scopeable and require <code>"Resource": "*"</code> — the docs mark which.</li>
<li><strong>Principal</strong>: appears only in <em>resource-based</em> and trust policies, naming who the statement applies to. Identity-based policies have an implicit principal — the identity they are attached to — and must not contain the element.</li>
<li><strong>Condition</strong>: the precision instrument, below.</li>
</ul>

<h3>NotAction and NotResource</h3>
<p><code>NotAction</code> means "every action except these" — it is <strong>not a deny</strong>. <code>"Effect": "Allow", "NotAction": "iam:*"</code> grants everything outside IAM, which is far broader than most authors intend and silently includes every service launched next year. The legitimate uses are narrow: deny-statements shaped like "deny everything except a safe list" (for example, deny all actions when the request is outside an approved region, <em>except</em> the global services that must be exempt), and break-glass policies. <code>NotResource</code> mirrors this for ARNs. Rule of thumb: Not-forms belong in Deny statements; a Not-form in an Allow statement is a finding.</p>

<h3>Condition operators</h3>
<p>The operator families: <code>StringEquals</code> / <code>StringNotEquals</code> / <code>StringLike</code> (with * and ? wildcards), numeric and date comparisons, <code>Bool</code>, <code>IpAddress</code> / <code>NotIpAddress</code> (CIDR-aware), <code>ArnLike</code> / <code>ArnEquals</code>. Three modifiers seniors must know cold:</p>
<ul>
<li><strong>...IfExists</strong> (for example <code>StringEqualsIfExists</code>): the condition passes when the key is absent from the request. Without it, a condition on a sometimes-absent key (like <code>aws:RequestedRegion</code> quirks or optional tags) fails closed in Allow statements and fails open in ways you did not intend in Deny statements.</li>
<li><strong>ForAllValues / ForAnyValue</strong>: required when the context key is multivalued (like <code>aws:TagKeys</code>). <code>ForAllValues:StringEquals</code> means every value in the request must be in your list — and, notoriously, it evaluates to <em>true when the key is entirely absent</em>, so pair it with a <code>Null</code> check in Deny logic or you have a bypass.</li>
<li><strong>Null</strong>: tests key presence itself — <code>"Null": {"aws:TokenIssueTime": "true"}</code> matches requests made with long-term credentials (no session token), the standard way to force temporary-credential-only access.</li>
</ul>
<p>Multiple condition <em>operators</em> in one block are ANDed; multiple <em>values</em> for one key are ORed. Getting that inverted produces policies that are simultaneously too strict and too loose.</p>

<h3>Policy variables</h3>
<p>Policies can interpolate request context into strings using the dollar-sign-and-curly-brace substitution syntax around a context key (this course writes the key name only — the surrounding syntax is the standard shell-style interpolation form). The classic self-service pattern grants each user their own S3 prefix by using the <code>aws:username</code> variable in the Resource ARN:</p>
<pre><code>"Resource": "arn:aws:s3:::home-bucket/home/USERNAME_VAR/*"
   where USERNAME_VAR is the aws:username variable in interpolation syntax</code></pre>
<p>One policy serves a thousand users. Other high-value variables: <code>aws:PrincipalTag/key</code> (attribute-based access control — grant by tag match instead of enumerating resources), <code>aws:SourceIp</code>, <code>aws:PrincipalArn</code>. ABAC via principal and resource tags is AWS's answer to policy sprawl and appears on the exam as the scalable alternative to per-team policies.</p>

<div class="callout exam">Trap patterns: an option using NotAction in an Allow to "restrict" access — it does the opposite. An option putting a Principal element in an identity policy — invalid. "Ensure users can only access their own folder" — policy variable with aws:username. "Grant access based on project tags without editing policies per project" — ABAC with aws:PrincipalTag and ResourceTag conditions.</div>

<div class="callout limits">Numbers worth memorizing: managed policy document max 6,144 characters; 10 managed policies attachable per user/role/group by default; inline policies per role capped by an aggregate 10,240-character quota; 1 permissions boundary and up to 10 SCP attachments per level; role session policies passed at AssumeRole time are capped at 2,048 characters plus a packed-size limit. Policy size limits are why large deployments move to ABAC.</div>

<div class="callout war">The most common production policy bug is wildcard overreach discovered years later: <code>s3:*</code> on <code>Resource: "*"</code> granted in 2019 "temporarily." The second most common is the inverse — a Deny with a condition intended to scope it that actually broadens it because the key was absent and the operator lacked IfExists/Null handling. Lint policies with IAM Access Analyzer policy validation (it catches both classes) before they ship.</div>
`
    },
    {
      id: "evaluation-order",
      title: "Policy evaluation: the full decision tree, including the cross-account twist",
      html: `
<p>When a request arrives, IAM does not "check the policy" — it evaluates up to six policy types in a fixed logical order. Memorize the decision tree; a third of exam security questions are this tree wearing a costume.</p>

<h3>The order</h3>
<ol>
<li><strong>Explicit deny, anywhere.</strong> Every applicable policy of every type is scanned for a matching Deny first. One match ends evaluation: denied. Nothing overrides an explicit deny — not admin rights, not resource policies, not being root.</li>
<li><strong>Organizations SCPs.</strong> If the account is a member of an organization, the effective SCP set (the intersection along the path from root through OUs to the account) must allow the action. SCPs grant nothing; they are a ceiling. No SCP allow means implicit deny, evaluation ends.</li>
<li><strong>Resource-based policy.</strong> If the target resource has one (S3 bucket policy, KMS key policy, SQS queue policy, Lambda resource policy, role trust policy) and it allows the requesting principal, this can be sufficient by itself — see the same-account shortcut below.</li>
<li><strong>Identity-based policy.</strong> The union of managed and inline policies attached to the user/role. This is where most allows live.</li>
<li><strong>Permissions boundary.</strong> If the principal has one, the effective identity permission is the <em>intersection</em> of boundary and identity policy. The boundary grants nothing; it caps.</li>
<li><strong>Session policy.</strong> If the session was created with a session policy at AssumeRole/GetFederationToken time, the final permission intersects with it too. Again a ceiling, not a grant.</li>
</ol>
<p>Compressed: <strong>final access = (explicit deny wins always) AND SCP-allows AND (resource-policy-allows OR identity-policy-allows) AND boundary-allows-if-present AND session-policy-allows-if-present.</strong></p>

<h3>The same-account shortcut and the cross-account twist</h3>
<p>Within one account, resource policy and identity policy are evaluated as a <strong>union</strong>: either one allowing is enough (absent denies, SCPs, boundaries). A bucket policy that allows a role's ARN grants access even if the role's identity policy says nothing about S3. This surprises people constantly.</p>
<p><strong>Cross-account, the union becomes an intersection: both sides must allow.</strong> For a principal in account A to touch a resource in account B, account A must allow it via the principal's identity policy AND account B must allow it via the resource policy (or via a role in B that A's principal assumes — in which case it is the trust policy playing the resource-policy part). One-sided permission fails. This two-key property is what makes the account boundary real, and it is the single most-tested fact in this module.</p>

<div class="callout deep">Two subtleties inside the tree. First, boundaries and SCPs do not constrain <em>resource-policy-based</em> access to a principal from a different account in some combinations — but SCPs do bind every principal <em>in</em> the member account for requests they make. Second, an explicit deny in a resource policy blocks even principals whose identity policies allow, including the account root using that resource — the classic self-lockout is an S3 bucket policy with a bad Deny, which requires root to delete via the special delete-bucket-policy path. Test denies in staging.</div>

<div class="callout exam">Recognition patterns. "User has AdministratorAccess but receives AccessDenied on one bucket" — look for an explicit deny in the bucket policy or an SCP; identity allows cannot beat either. "Role in account A cannot read a bucket in account B although the bucket policy allows the role" — the role's identity policy in A must also allow s3:GetObject; cross-account needs both sides. "Developer created a user with more privileges than their own boundary permits" — boundaries constrain the principal's own actions, and the fix for delegated user-creation is requiring boundaries on created users via condition (next lessons). Any option claiming a resource policy or admin policy overrides an explicit deny is automatically wrong.</div>

<div class="callout war">Production debugging order when you hit an unexplained AccessDenied: (1) read the error — modern SDK errors often name the policy type that denied; (2) check for SCPs — they are invisible from inside the member account console policy simulator's default view and regularly ambush teams after an org migration; (3) check the resource policy; (4) only then read the identity policies. Teams that start at step 4 burn hours. CloudTrail's errorCode and the IAM policy simulator (which can include SCPs and boundaries) shortcut this.</div>

<div class="callout limits">Evaluation facts with numbers: up to 5 SCPs attach at each level of the org tree, and the effective set is the intersection of every level from root to account. A permissions boundary is exactly one managed policy per principal. Session policies: one inline document (2,048 chars) plus up to 10 managed policy ARNs per AssumeRole call. None of these types can ever <em>add</em> permission beyond the identity/resource allows.</div>

<p>Internalize the asymmetry that organizes the whole system: exactly two policy types grant (identity-based and resource-based); everything else — SCP, boundary, session policy, deny statements — only subtracts. When reasoning about any scenario, first find the grant, then hunt for subtractions in the fixed order. That procedure answers every evaluation question the exam can construct.</p>
`
    },
    {
      id: "sts-roles",
      title: "Roles and STS mechanics: AssumeRole, chaining, sessions, instance profiles",
      html: `
<p>A role is an identity with permissions but <strong>no credentials</strong>. To use one, a principal calls STS and receives temporary credentials: an access key ID (starting <code>ASIA</code> rather than a user's <code>AKIA</code>), a secret key, and a <strong>session token</strong> that must accompany every request. Everything security-mature on AWS runs on this machinery, because temporary credentials expire by construction — leaked ones have a shelf life measured in minutes to hours, not years.</p>

<h3>AssumeRole, step by step</h3>
<ol>
<li>The caller invokes <code>sts:AssumeRole</code> on the role's ARN, optionally passing a session name (audit trail), a session policy (a further cap), tags, and duration.</li>
<li>Two authorizations must pass: the caller's own policies must allow <code>sts:AssumeRole</code> on that role ARN, and the role's <strong>trust policy</strong> — a resource-based policy on the role whose Principal element names who may assume it — must allow this caller. Same two-key logic as any cross-account access; the trust policy <em>is</em> the role's resource policy.</li>
<li>STS mints credentials valid for the requested duration, and the caller's subsequent requests are evaluated as the role — with the caller's original permissions entirely replaced, not merged.</li>
</ol>

<h3>Session duration and role chaining</h3>
<p>Each role has a <strong>MaxSessionDuration</strong> setting between 1 and 12 hours (default 1 hour); AssumeRole may request up to that cap. But when a <em>role</em> assumes another role — <strong>role chaining</strong> — the new session is hard-capped at <strong>1 hour</strong> regardless of MaxSessionDuration, and this cap is not raisable. Long-running pipelines built on chained roles must re-assume before expiry; SDKs with credential providers handle the refresh, hand-rolled signing code does not. Note what does not count as chaining: federation into the first role, EC2 instance profiles, and service-linked assumption all support full-length sessions; only role-assumes-role triggers the 1-hour ceiling.</p>

<h3>Instance profiles and the metadata path</h3>
<p>EC2 cannot call AssumeRole with nothing, so AWS does it for you: an <strong>instance profile</strong> is the container binding exactly one role to an instance. The EC2 service assumes the role and exposes rotating temporary credentials through the instance metadata service at <code>169.254.169.254</code>. SDKs pick them up automatically via the credential chain. The security history here matters: IMDSv1 answered any plain GET, which made every SSRF vulnerability in every app on EC2 a potential credential theft (the 2019 Capital One breach was exactly this). <strong>IMDSv2</strong> requires a session-token handshake via a PUT with a TTL-limited token — SSRF payloads that can only issue GETs are neutralized, and the default TTL hop limit of 1 stops containers from reaching the host's credentials unless you allow it. Enforce IMDSv2 (HttpTokens=required) fleet-wide; it is a launch-template flag and an SCP-conditionable property.</p>

<h3>The rest of the STS API surface</h3>
<ul>
<li><code>AssumeRoleWithSAML</code> and <code>AssumeRoleWithWebIdentity</code>: federation entry points — next lesson.</li>
<li><code>GetSessionToken</code>: temporary credentials for an IAM user, mainly to attach MFA context to CLI work.</li>
<li><code>GetCallerIdentity</code>: who am I; requires no permissions and cannot be denied by IAM policy — handy for debugging, and a known reconnaissance primitive for attackers holding found keys.</li>
</ul>

<h3>Revocation</h3>
<p>You cannot delete an issued session token; it is a signed bearer artifact. To cut off a compromised role session you either (a) attach a deny-all policy to the role with a condition on <code>aws:TokenIssueTime</code> older than now — the console's "revoke active sessions" button does exactly this — or (b) delete the role. Understand (a): the credentials still exist; every request they make now hits an explicit deny. This is deny-always-wins used as a kill switch.</p>

<div class="callout deep">What a session physically is: STS returns AccessKeyId/SecretAccessKey/SessionToken where the token is an encrypted, signed blob encoding the role, expiry, tags, and any session policy. Services validate it on each request — there is no central session table to revoke from, which is exactly why revocation must be expressed as a policy condition rather than a deletion. It also explains why session policies cap but cannot extend: the ceiling travels inside the token itself.</div>

<div class="callout exam">Mappings: "application on EC2 needs S3 access" — instance profile role, never keys in config files or user data; any option embedding access keys on an instance is wrong on sight. "Session expires after an hour even though MaxSessionDuration is 12" — role chaining cap. "Immediately prevent use of possibly-leaked role credentials without deleting the role" — deny with aws:TokenIssueTime condition. "Protect against SSRF stealing instance credentials" — require IMDSv2.</div>

<div class="callout war">The classic incident: someone commits long-lived IAM user keys to a public repo; scanners find them in under five minutes; a cryptomining fleet appears in every enabled region. The structural fix is having nothing to leak — humans federate through Identity Center, workloads use roles (instance profiles, IRSA, task roles), CI uses OIDC federation. Accounts with zero IAM user access keys have removed the entire category. Audit with the credential report; alert on any new access key creation.</div>

<div class="callout limits">STS numbers: default session 1 hour; AssumeRole max 12 hours (per-role MaxSessionDuration); role chaining hard cap 1 hour; federation via SAML/OIDC honors MaxSessionDuration up to 12 hours; GetSessionToken up to 36 hours for IAM users. Instance profiles: exactly one role per instance profile, one profile per instance (replaceable live). STS is a global service but regional endpoints exist and are the recommended default for latency and availability isolation.</div>
`
    },
    {
      id: "cross-account-confused-deputy",
      title: "Cross-account patterns, ExternalId, and the confused deputy",
      html: `
<p>There are exactly two mechanisms for cross-account access, and choosing between them is a recurring design decision: <strong>resource-based policies</strong> (grant a foreign principal direct access to one resource) and <strong>cross-account role assumption</strong> (the foreign principal becomes a local identity). Everything else — Resource Access Manager shares, S3 Access Points, VPC endpoint policies — is plumbing built from these primitives.</p>

<h3>Pattern 1: resource policy</h3>
<p>Account B attaches a policy to its bucket/queue/key/function naming account A's principal. A's principal keeps its own identity while reaching across: it retains all its home-account permissions during the same request flow, its CloudTrail identity is unchanged, and the access is scoped to exactly the resources with policies. Both sides must allow (the cross-account intersection rule from the evaluation lesson). Limitation: only services with resource policies support it, and fan-out across many resources means many policies to maintain.</p>

<h3>Pattern 2: assume a role in the target account</h3>
<p>Account B creates a role with the needed permissions and a trust policy naming account A (or a specific principal in A). A's principal calls AssumeRole and <em>becomes</em> a B-account identity for the session — its A-account permissions vanish for that session, which is a feature: the blast radius is exactly the role's policy. This works for every service (no resource-policy support required), centralizes the grant in one role, and gives B unilateral revocation (edit the trust policy). It is the standard pattern for human cross-account operations, CI deployment into workload accounts, and vendor access. Cost: an extra hop, sessions to manage, and per-session credentials that complicate long-lived streaming operations.</p>
<p>Decision rule: <strong>one principal touching a few specific resources — resource policy. Broad or multi-service access, auditable identity switch, or third parties — role.</strong></p>

<h3>The confused deputy problem</h3>
<p>Now the famous failure mode. A <em>deputy</em> is a service that acts on your behalf with its own privileges. Suppose Monitoring-SaaS Inc. asks every customer to create a role trusting Monitoring-SaaS's AWS account, and you do. An attacker who also signs up for Monitoring-SaaS then tells it "my role ARN is arn:aws:iam::YOUR-ACCOUNT:role/MonitoringRole" — <em>your</em> role, whose ARN is guessable or leaked (ARNs are not secrets, per module 1). The SaaS, acting as a deputy with its legitimate ability to assume customer roles, assumes <em>your</em> role on the <em>attacker's</em> instruction. The deputy is confused about which customer authorized what.</p>
<p>The fix is <strong>ExternalId</strong>: the SaaS generates a unique opaque value per customer and passes it on every AssumeRole call; your trust policy requires it:</p>
<pre><code>{
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::999988887777:root" },
  "Action": "sts:AssumeRole",
  "Condition": { "StringEquals": { "sts:ExternalId": "cust-7f3a91c2" } }
}</code></pre>
<p>The attacker cannot make the SaaS present <em>your</em> ExternalId because the SaaS binds each ExternalId to the customer tenant that owns it. Note what ExternalId is not: it is not a password (it travels in API calls, appears in CloudTrail, and is known to the vendor) and it adds nothing when <em>you</em> assume your own roles. It exists solely to bind a deputy's action to the tenant that requested it. Vendors who let customers choose their own ExternalId have reintroduced the vulnerability — the deputy must generate and enforce uniqueness.</p>

<h3>The same disease elsewhere</h3>
<p>Service-to-service permissions have the identical shape: an S3 bucket notification invoking your Lambda, SNS publishing to your SQS queue, CloudWatch Logs writing to your destination. The service (deputy) holds broad powers; the resource policy that lets "sns.amazonaws.com" send to your queue would let <em>anyone's</em> SNS topic do so unless you pin the source. Hence the condition keys <code>aws:SourceArn</code> and <code>aws:SourceAccount</code> on every service-principal grant:</p>
<pre><code>"Condition": {
  "ArnEquals": { "aws:SourceArn": "arn:aws:sns:us-east-1:111122223333:orders" }
}</code></pre>
<p>Every resource policy whose Principal is a service and whose Condition lacks SourceArn/SourceAccount is a cross-account confused-deputy hole. Access Analyzer flags these.</p>

<div class="callout exam">Keyword reflexes: "third party / vendor / SaaS needs access to our account" — cross-account role WITH ExternalId; any answer offering to create an IAM user and email keys to the vendor is wrong instantly. "Prevent another AWS customer from configuring service X to target our resource" — aws:SourceArn / aws:SourceAccount condition. "Auditor needs read access to 50 accounts" — one role per account trusting the auditor's account, not 50 IAM users.</div>

<div class="callout war">Real incidents in this family are common enough that AWS renamed patterns around them: several security vendors shipped confused-deputy-vulnerable onboarding (customer-chosen ExternalIds, or none) and had to rotate every customer integration. Audit your own third-party trust policies quarterly: list roles whose trust Principal is a foreign account, verify each has an ExternalId your vendor generated, and delete trusts for vendors you no longer use — stale vendor trusts are standing invitations.</div>

<div class="callout deep">Why ARNs-are-not-secrets makes ExternalId necessary: authorization must never rest on an identifier being unguessable, because ARNs leak through logs, error messages, CloudFormation outputs, and support tickets. ExternalId works not because it is secret but because the deputy enforces the binding between tenant and value — the security property lives in the deputy's bookkeeping plus your trust-policy condition, not in obscurity.</div>
`
    },
    {
      id: "federation-identity-center",
      title: "Federation: SAML, OIDC, IRSA, and IAM Identity Center",
      html: `
<p>Federation is the answer to a simple question: how do identities that live outside AWS (your workforce directory, a Kubernetes cluster, a GitHub Actions runner, a mobile app's users) get AWS credentials without anyone minting IAM users? The mechanism is always the same shape: <strong>an external identity provider issues a signed assertion, STS verifies it against a registered trust, and exchanges it for role credentials.</strong> No stored AWS secrets anywhere in the flow — the external IdP's signature is the credential.</p>

<h3>SAML 2.0 federation</h3>
<p>Enterprise directories (AD FS, Okta, Ping) speak SAML. You register the IdP's metadata (its signing certificate) as an IAM identity provider; the role's trust policy allows <code>sts:AssumeRoleWithSAML</code> for that provider; users authenticate to the IdP, receive a signed assertion listing which roles they may take, and STS validates the signature and issues credentials. Attributes in the assertion can flow into session tags for ABAC. SAML is browser-redirect-centric and XML-heavy — the workforce legacy standard, still everywhere.</p>

<h3>OIDC / web identity federation</h3>
<p>The modern JSON equivalent: any OpenID Connect provider (Google, GitHub, EKS, Cognito) issues a JWT; <code>sts:AssumeRoleWithWebIdentity</code> exchanges it. The trust policy conditions on the token's claims — audience (<code>aud</code>) and subject (<code>sub</code>) — which is where the security actually lives. The canonical modern example is <strong>CI/CD without stored keys</strong>: GitHub Actions' OIDC provider is registered in your account, and a deploy role trusts tokens whose <code>sub</code> claim matches <code>repo:my-org/my-repo:ref:refs/heads/main</code>. A pipeline run gets 15-minute credentials scoped to that repo and branch; there is no long-lived secret to rotate or leak. Condition sloppiness here is the failure mode: trusting <code>sub</code> with a wildcard across the whole org lets any repo in the org deploy to prod.</p>

<h3>IRSA: IAM Roles for Service Accounts</h3>
<p>IRSA is OIDC federation applied inside EKS. The cluster runs an OIDC issuer; each pod's Kubernetes service account gets a projected, signed JWT; the AWS SDK inside the pod exchanges it via AssumeRoleWithWebIdentity for a role whose trust policy pins <code>sub</code> to <code>system:serviceaccount:namespace:name</code>. The payoff: <strong>per-pod IAM identity</strong> instead of every pod inheriting the node instance profile — least privilege at the workload level, and node credential theft no longer yields the union of all workloads' permissions. (Its successor, EKS Pod Identity, simplifies the wiring but the exam-relevant concept is IRSA's per-service-account role mapping.) The same trick under other names: ECS task roles, Lambda execution roles — every modern compute layer binds a role to the workload unit, not the host.</p>

<h3>IAM Identity Center (ex AWS SSO)</h3>
<p>Identity Center is the managed workforce answer, and the exam's default for "employees access many accounts." It sits at the organization level, connects to one identity source (its own directory, Active Directory, or any external SAML/SCIM IdP like Okta — SCIM handles user/group provisioning), and you define <strong>permission sets</strong> — role templates that Identity Center materializes as roles in every assigned account. Users get a portal listing their account/role combinations; CLI v2 supports it natively (<code>aws sso login</code>) with short-lived credentials throughout. What it replaces: per-account IAM users, hand-built SAML role plumbing per account, and the cross-account role-switching spreadsheet. What it does not do: customer-facing identity — that is Cognito (module 15), a distinction the exam probes.</p>

<table>
<thead><tr><th>Population</th><th>Mechanism</th></tr></thead>
<tbody>
<tr><td>Workforce, multi-account</td><td>IAM Identity Center (SCIM from your IdP)</td></tr>
<tr><td>Enterprise app, single account, legacy</td><td>SAML federation to IAM roles</td></tr>
<tr><td>CI/CD pipelines</td><td>OIDC federation (no stored keys)</td></tr>
<tr><td>EKS pods</td><td>IRSA / Pod Identity</td></tr>
<tr><td>EC2 / ECS / Lambda workloads</td><td>Instance profile / task role / execution role</td></tr>
<tr><td>App end-users (customers)</td><td>Cognito user pools + identity pools</td></tr>
</tbody>
</table>

<div class="callout exam">Mappings: "workforce access to multiple AWS accounts with existing Active Directory" — IAM Identity Center with AD as identity source. "GitHub Actions deploys without long-lived credentials" — OIDC federation. "Different pods need different AWS permissions" — IRSA, never node instance profiles. "Mobile app users sign in with Google and upload to S3" — Cognito (web identity), not IAM users. Any answer that provisions IAM users for a federated population is wrong.</div>

<div class="callout war">The OIDC trust-policy audience/subject conditions are the entire security boundary, and they fail quietly. Real breach class: a GitHub OIDC trust policy conditioning only on aud (which every GitHub token shares) and not on sub — any repository on GitHub, including an attacker's, could assume the role. Lint every AssumeRoleWithWebIdentity trust policy for a sub condition pinned to your org/repo/branch. The equivalent IRSA mistake is a wildcard service-account sub.</div>

<div class="callout deep">How STS verifies without a shared secret: the IdP publishes its JWKS (public signing keys) at a well-known URL; registering the provider records that issuer. At exchange time STS fetches/caches the keys, verifies the JWT signature, checks expiry, then matches claims against your trust conditions. Trust is anchored in the issuer's key material and TLS identity — rotate/compromise the IdP's signing keys and every dependent role trust is affected, which is why IdP key management is on your side of the shared responsibility line.</div>

<div class="callout limits">Federated session durations follow the role's MaxSessionDuration (1-12 h); Identity Center permission-set sessions are configurable 1-12 h. One OIDC provider registration per issuer URL per account. Identity Center: one instance per organization, one identity source at a time; switching sources is disruptive, so choose deliberately. SCIM sync is one-way, IdP to AWS.</div>
`
    },
    {
      id: "organizations-scps",
      title: "AWS Organizations and SCPs: guardrails, not grants",
      html: `
<p>AWS Organizations turns a pile of accounts into a governed tree: a management account at the root, organizational units (OUs) nesting up to five levels deep, member accounts as leaves. It provides consolidated billing (one payer, volume discounts and RI/Savings-Plan sharing pooled across members), centralized services (CloudTrail org trails, Config aggregators, delegated administration), account factory via Control Tower — and, most importantly for this exam, <strong>service control policies</strong>.</p>

<h3>What an SCP is and is not</h3>
<p>An SCP is a policy document attached to the root, an OU, or an account, that defines the <strong>maximum available permissions</strong> for principals in affected accounts. Three properties to hold onto:</p>
<ul>
<li><strong>SCPs never grant.</strong> A principal still needs an identity or resource policy allow. The SCP is a ceiling — the effective permission is the intersection of the SCP set and whatever IAM grants.</li>
<li><strong>SCPs bind every principal in member accounts, including root users.</strong> This is the only mechanism with that property, and the reason SCPs answer every "prevent anyone, even administrators, from X" question.</li>
<li><strong>SCPs do not bind the management account.</strong> Also exempt: service-linked roles, and (mechanically) principals from <em>other</em> accounts accessing member resources via resource policies are evaluated against the member's SCPs in the resource-owner context — but the headline exemption to remember is the management account, which is why it must stay empty of workloads.</li>
</ul>
<p>Inheritance is <strong>intersection along the path</strong>: for an action to be available to an account, every level from root through each OU down to the account must allow it. A deny anywhere on the path is final; an allow at the account level cannot resurrect something an OU-level SCP denied. Attaching a full-allow SCP at a child does not "override" a parent deny — there is no override, only intersection.</p>

<h3>Deny-list vs allow-list strategy</h3>
<table>
<thead><tr><th></th><th>Deny-list (default)</th><th>Allow-list</th></tr></thead>
<tbody>
<tr><td>Baseline</td><td>FullAWSAccess attached everywhere; add targeted Deny SCPs</td><td>Remove FullAWSAccess; attach SCPs enumerating permitted services</td></tr>
<tr><td>New AWS services</td><td>Available by default</td><td>Blocked until explicitly added</td></tr>
<tr><td>Operational cost</td><td>Low; guardrails are small and readable</td><td>High; every new service need is a change request</td></tr>
<tr><td>Fit</td><td>Most organizations</td><td>Regulated environments, sandbox OUs with tight budgets</td></tr>
</tbody>
</table>
<p>Deny-list is the practical default: keep the implicit FullAWSAccess, then layer denies such as: deny leaving the organization, deny root-user actions (via <code>aws:PrincipalArn</code> condition on the root pattern), deny disabling CloudTrail/Config/GuardDuty, deny actions outside approved regions (with a NotAction carve-out for the global services — the canonical legitimate NotAction-in-Deny), deny creating IAM users with access keys. Allow-list mode is intersection-brutal: forget to include a service at any level and it is dead org-wide, and remember an allow-list SCP cannot use Condition/Resource refinements as freely as denies (allow statements in SCPs historically supported only Action with wildcard, no conditions — denies carry the conditions).</p>

<h3>Common guardrail SCP shape</h3>
<pre><code>{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyOutsideApprovedRegions",
    "Effect": "Deny",
    "NotAction": ["iam:*", "sts:*", "cloudfront:*", "route53:*",
                  "support:*", "organizations:*"],
    "Resource": "*",
    "Condition": {
      "StringNotEquals": { "aws:RequestedRegion": ["eu-west-1", "eu-central-1"] }
    }
  }]
}</code></pre>
<p>Read it with the lesson-1 rules: a Deny of everything <em>except</em> the listed global services, conditioned on the region not being approved. Global services must be exempted or you deny IAM itself from every region and brick the org's administration.</p>

<div class="callout exam">Reliable mappings: "prevent member accounts, including root, from doing X" — SCP. "Developers in the sandbox OU may only use approved services" — allow-list SCP on that OU. "Why does an admin with AdministratorAccess get AccessDenied in a member account" — an SCP above them. "SCP attached but users still cannot access the service" — SCPs do not grant; they still need IAM allows. And its inverse: "we allowed it in the SCP, why is it denied" — same answer.</div>

<div class="callout war">Two org-scale foot-guns. First, testing SCPs on the root: a bad region-deny without the global-service carve-out locks every member account's IAM simultaneously — roll SCPs to a test OU containing one sacrificial account first, always. Second, the management-account exemption cuts both ways: your guardrails do not protect the one account that can change the guardrails. Compensate with hardware-MFA root, no workloads, minimal humans, and alarms on management-account API activity — CloudTrail is your only control there.</div>

<div class="callout limits">Quotas: 5 SCPs per attachment point (root, each OU, each account); SCP document max 5,120 characters; OU nesting max 5 levels deep; the management account cannot be constrained; FullAWSAccess is attached by default everywhere and removing it flips that subtree to allow-list semantics. Newer sibling policy types exist (resource control policies, declarative policies) but SCPs remain the exam's center of mass.</div>
`
    },
    {
      id: "boundaries-analyzer-hygiene",
      title: "Permission boundaries, Access Analyzer, and credential hygiene",
      html: `
<p>Three closing instruments: boundaries solve delegated administration, Access Analyzer solves verification, and hygiene closes the boring holes that cause most actual breaches.</p>

<h3>Permission boundaries: safe delegation</h3>
<p>A permissions boundary is a managed policy attached to a user or role that sets that principal's <strong>maximum</strong> permissions: effective access = identity policies INTERSECT boundary (minus denies, under SCPs as always). Like SCPs, boundaries never grant. Unlike SCPs, they are per-principal and work without an organization.</p>
<p>The problem they exist to solve is <strong>privilege escalation through delegated IAM administration</strong>. You want platform teams to create their own roles for their apps without a central-IAM bottleneck — but anyone who can create a role and attach policies can create an admin role and assume it. The boundary pattern closes the loop: give delegated admins <code>iam:CreateRole</code> and <code>iam:AttachRolePolicy</code> <em>only when</em> the new principal carries a specified boundary, and deny them the ability to modify or detach that boundary:</p>
<pre><code>{
  "Effect": "Allow",
  "Action": ["iam:CreateRole", "iam:AttachRolePolicy"],
  "Resource": "arn:aws:iam::111122223333:role/app-*",
  "Condition": {
    "StringEquals": {
      "iam:PermissionsBoundary": "arn:aws:iam::111122223333:policy/DevBoundary"
    }
  }
}</code></pre>
<p>Now every role they mint is capped by DevBoundary no matter what identity policies they attach. Boundary vs SCP in one line: SCP caps <em>accounts</em> from the org; boundary caps <em>individual principals</em> from within the account — and the delegation condition trick is the boundary's signature use case, tested nearly verbatim.</p>

<h3>IAM Access Analyzer: verification as a service</h3>
<p>Access Analyzer answers three questions continuously, using automated policy reasoning (formal analysis of the policy semantics, not log sampling):</p>
<ul>
<li><strong>External access findings</strong>: which resources (S3 buckets, KMS keys, roles' trust policies, SQS, Lambda, secrets...) are reachable from outside your zone of trust (account or organization)? Every finding is a resource policy granting outside access — intended (your vendor role) or not (the public bucket). This is the "find out what is shared externally" answer on the exam.</li>
<li><strong>Unused access findings</strong>: roles, keys, and permissions unused over a lookback window — least-privilege cleanup fuel.</li>
<li><strong>Policy validation and generation</strong>: lints policies for errors and over-breadth at authoring time, and can <em>generate</em> a least-privilege policy from CloudTrail activity — record what the workload actually did, emit a policy allowing exactly that. This closes the loop from wildcard-everything to evidence-based least privilege.</li>
</ul>

<h3>Credential hygiene: the checklist that prevents most breaches</h3>
<ul>
<li><strong>Root user</strong>: hardware MFA, no access keys ever, email alias owned by the org not a person, used only for the short list of root-only tasks (closing the account, some billing/tax operations). Alarm on any root API activity via CloudTrail.</li>
<li><strong>Eliminate IAM users where possible</strong>: humans through Identity Center, workloads through roles, CI through OIDC. Every remaining IAM user access key is technical debt with a blast radius.</li>
<li><strong>Where keys must exist</strong>: rotate on a schedule (two keys per user exist precisely to enable zero-downtime rotation: create second, cut over, delete first), and monitor age.</li>
<li><strong>Credential report</strong> (<code>aws iam generate-credential-report</code>): one CSV per account listing every user, key ages, last-used timestamps, MFA status — the audit primitive. <strong>Access advisor</strong> (last-accessed data per service per principal) shows what a principal actually uses; prune the rest.</li>
<li><strong>MFA enforcement</strong>: the standard identity-policy pattern denies everything except MFA-management actions when <code>aws:MultiFactorAuthPresent</code> is false — noting the trap from lesson 1: test it with BoolIfExists, because the key is absent (not false) on some credential types, and a bare Bool check creates gaps.</li>
</ul>

<div class="callout exam">Discriminations the exam draws: "identify resources shared outside the account/organization" — Access Analyzer external findings (not GuardDuty, which finds threats; not Inspector, which finds vulnerabilities — module 15 expands this family). "Generate least-privilege policy from actual usage" — Access Analyzer policy generation from CloudTrail. "Allow developers to create roles without privilege escalation" — permission boundary with the iam:PermissionsBoundary condition. "Audit key age and MFA across all users" — credential report.</div>

<div class="callout war">Boundary deployments fail in practice when the boundary policy is treated as a grant template: teams attach the boundary and no identity policies, then file tickets that "the boundary is not working." It caps; it does not grant — same misreading as SCPs, one level down. The other real-world gap: boundaries do not apply to the delegated admin's <em>own</em> existing principals unless attached, and nothing stops role creation paths you forgot to condition (CloudFormation service roles are the classic bypass). Enumerate every path that can mint principals.</div>

<div class="callout deep">Access Analyzer's external-access engine is worth respecting: it is built on Zelkova-style automated reasoning — the policy language is translated into logic (SMT) and the analyzer proves whether any request from outside the trust zone can be allowed, rather than testing sample requests. That is why it can assert "not public" with confidence instead of "we did not observe public access." Provable statements about policy semantics are strictly stronger evidence than log absence, and the exam's phrase "provable security" points here.</div>

<div class="callout limits">Boundary: exactly one per principal, must be a managed policy. Credential report: regenerated at most every 4 hours. Access advisor granularity: service level (action-level for some services). Access Analyzer: one analyzer per zone-of-trust type per region; external-access analysis is free, unused-access analysis is priced per principal analyzed. Two access keys max per IAM user — the pair exists for rotation, not for sharing.</div>
`
    }
  ],
  quiz: [
    {
      q: "An administrator attaches the AWS managed AdministratorAccess policy to a developer, yet the developer receives AccessDenied when calling PutObject on one specific bucket in the same account. Which TWO could explain this? (Select TWO.)",
      options: [
        "The bucket policy contains an explicit deny matching the developer's principal",
        "The developer's identity policy lacks an explicit allow for that bucket",
        "A service control policy above the account denies s3:PutObject",
        "AdministratorAccess does not include S3 write actions",
        "The bucket is in a different region from the developer's IAM user"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "Only subtractive mechanisms can beat an identity allow: an explicit deny in any applicable policy (<strong>A</strong>) or a missing allow in the SCP ceiling (<strong>C</strong>). <strong>B</strong> is wrong because AdministratorAccess allows all actions on all resources — the allow exists. <strong>D</strong> is factually wrong for the same reason. <strong>E</strong> is a non-factor: IAM users are global and S3 authorization does not depend on principal region."
    },
    {
      q: "A role in account A must read objects from a bucket in account B. The bucket policy in account B allows the role's ARN to call s3:GetObject. The role's identity policy in account A contains no S3 permissions. What happens when the role attempts GetObject, and why?",
      options: [
        "Access is granted, because a resource policy allow is sufficient on its own",
        "Access is denied, because cross-account access requires an allow from both the identity policy and the resource policy",
        "Access is granted only if account B is in the same organization",
        "Access is denied, because roles cannot be named in bucket policies"
      ],
      answer: [1],
      multi: false,
      explanation: "Cross-account evaluation is an intersection: account A must permit its principal to make the call (identity policy) AND account B must permit the principal on the resource (bucket policy). With no S3 allow in A, the request dies on A's side. <strong>A</strong> describes the same-account shortcut, where resource-policy-or-identity-policy is a union — it does not apply across accounts. <strong>C</strong> invents an organization exception; org membership does not change two-sided evaluation. <strong>D</strong> is false — role ARNs are standard bucket-policy principals."
    },
    {
      q: "A security engineer writes an identity policy with Effect Allow and NotAction set to iam:* intending to block IAM access while permitting everything else. What is the actual result, and what is the correct approach to also restrict future risk?",
      options: [
        "IAM is explicitly denied; the policy is correct as written",
        "The policy grants every non-IAM action, including all actions of services launched in the future; an explicit Deny on iam:* alongside scoped allows would be safer",
        "The policy grants nothing until an SCP also allows it",
        "The policy is syntactically invalid because NotAction cannot appear with Effect Allow"
      ],
      answer: [1],
      multi: false,
      explanation: "Allow with NotAction is a grant of everything outside the listed actions — it never denies anything, and its scope silently grows as AWS launches services. The robust pattern is explicit allows for what is needed plus an explicit Deny for iam:* if IAM must be blocked. <strong>A</strong> misreads NotAction as a deny — the central misconception this element breeds. <strong>C</strong> confuses SCP mechanics with identity policy grants; in an unorganized account this policy is immediately effective. <strong>D</strong> is wrong — the combination is legal, which is exactly why it is dangerous."
    },
    {
      q: "A team needs each IAM user to access only their own prefix in a shared S3 bucket, without maintaining a separate policy per user. Which approach achieves this?",
      options: [
        "One policy per user generated nightly by a Lambda function",
        "A single policy using the aws:username policy variable in the Resource ARN so each user matches only their own prefix",
        "A bucket ACL granting each user their prefix",
        "S3 Access Points with one access point per user and no policy changes"
      ],
      answer: [1],
      multi: false,
      explanation: "Policy variables interpolate request context into the Resource: one policy whose resource path embeds the aws:username variable scopes every user to their own prefix. <strong>A</strong> works mechanically but is exactly the operational sprawl variables exist to eliminate, and nightly generation lags user churn. <strong>C</strong> is wrong because ACLs are legacy, cannot express prefixes as a general grant per IAM user, and AWS steers all new designs to policies. <strong>D</strong> misuses access points: they help partition access patterns but still require per-access-point policies — with hundreds of users it recreates the sprawl with more moving parts."
    },
    {
      q: "A long-running data pipeline assumes role A via IAM user credentials, and role A then assumes role B in another account to write results. The team sets MaxSessionDuration to 12 hours on both roles, yet the role B session still expires after 1 hour. Why?",
      options: [
        "STS caps all cross-account sessions at 1 hour",
        "Role chaining (a role assuming another role) is hard-capped at 1 hour regardless of MaxSessionDuration",
        "The session policy passed during AssumeRole reduced the duration",
        "MaxSessionDuration only applies to console sessions, not API sessions"
      ],
      answer: [1],
      multi: false,
      explanation: "When the caller of AssumeRole is itself operating as a role, the resulting session cannot exceed 1 hour — a fixed STS rule that MaxSessionDuration cannot override. The fix is architectural: refresh via re-assumption (SDK credential providers do this), or have the original user/federated identity assume role B directly. <strong>A</strong> is too broad — cross-account assumption from a user or federated identity honors MaxSessionDuration up to 12 hours. <strong>C</strong> is wrong because session policies restrict permissions, not duration. <strong>D</strong> is fiction; MaxSessionDuration governs API-requested durations."
    },
    {
      q: "During an incident, a security team believes temporary credentials for a production role have been exfiltrated. They must immediately block use of the stolen credentials without deleting the role or interrupting the ability of workloads to obtain fresh sessions. What should they do?",
      options: [
        "Rotate the role's access keys in the IAM console",
        "Attach a policy to the role that denies all actions when aws:TokenIssueTime is earlier than the current time, forcing all existing sessions to explicit-deny while new sessions work",
        "Delete and recreate the role with the same name",
        "Remove the role from its instance profile until the tokens expire"
      ],
      answer: [1],
      multi: false,
      explanation: "Issued session tokens are bearer artifacts that cannot be recalled, so revocation is expressed as policy: a deny conditioned on token issue time before now invalidates every outstanding session (the console's revoke-sessions button generates exactly this), while sessions minted after the cutoff carry a later issue time and pass. <strong>A</strong> is a category error — roles have no access keys to rotate. <strong>C</strong> works but violates the constraint: deletion interrupts every legitimate consumer and breaks trust references. <strong>D</strong> stops new credential issuance on EC2 but does nothing about the already-stolen tokens, which remain valid from anywhere, and it interrupts workloads — the inverse of what was asked."
    },
    {
      q: "A monitoring SaaS vendor requires customers to create a cross-account role its AWS account can assume. A security review asks how to prevent another customer of the same vendor from tricking the vendor into assuming this company's role. What is the correct control?",
      options: [
        "Keep the role ARN confidential so other customers cannot reference it",
        "Require a vendor-generated ExternalId in the role's trust policy condition, which the vendor presents on every AssumeRole call for this customer",
        "Add an IP address condition allowing only the vendor's published CIDR ranges",
        "Require the vendor to use an IAM user with MFA instead of role assumption"
      ],
      answer: [1],
      multi: false,
      explanation: "This is the confused deputy: the vendor legitimately assumes many customers' roles, and an attacker-customer supplies someone else's role ARN. ExternalId binds each assumption to the tenant that owns it — the vendor generates a unique value per customer and your trust policy demands it. <strong>A</strong> fails because ARNs are identifiers, not secrets; they leak via logs and are guessable. <strong>C</strong> does not discriminate between tenants — the malicious request also originates from the vendor's IPs, since the vendor is the confused party. <strong>D</strong> is an anti-pattern (long-lived keys shared with a third party) and still does not bind requests to tenants."
    },
    {
      q: "An SQS queue policy allows the principal sns.amazonaws.com to send messages so an SNS topic can fan out to it. A reviewer flags that any AWS customer could exploit this. What is the flaw and the fix?",
      options: [
        "Service principals cannot appear in queue policies; switch to an IAM role for SNS",
        "Any SNS topic in any account could deliver to the queue; add an aws:SourceArn condition pinning the specific topic ARN",
        "The queue policy is missing an ExternalId condition",
        "SNS requires the queue to be encrypted before cross-service delivery is safe"
      ],
      answer: [1],
      multi: false,
      explanation: "A bare service-principal grant authorizes the SNS service acting for anyone — a confused-deputy variant. Conditioning on aws:SourceArn (or aws:SourceAccount) restricts delivery to your topic. <strong>A</strong> is backwards: service principals are the standard mechanism here; SNS cannot assume arbitrary roles to deliver. <strong>C</strong> misapplies ExternalId, which belongs to sts:AssumeRole flows with third-party deputies, not service-to-service resource policies — SourceArn is that pattern's equivalent. <strong>D</strong> conflates encryption with authorization; SSE on the queue changes nothing about who may send."
    },
    {
      q: "A platform team wants application developers to create IAM roles for their own microservices without being able to escalate privileges. Central security will not review each role. Which mechanism enforces this?",
      options: [
        "An SCP denying iam:CreateRole for all developers",
        "Allow iam:CreateRole and iam:AttachRolePolicy only when the request includes a specific permissions boundary, via the iam:PermissionsBoundary condition key, and deny boundary modification",
        "A Lambda function that scans new roles nightly and deletes non-compliant ones",
        "Require developers to create roles only through the console, which enforces least privilege automatically"
      ],
      answer: [1],
      multi: false,
      explanation: "The permission-boundary delegation pattern: role creation is permitted only when the new role carries the mandated boundary, so anything developers mint is capped by it regardless of attached policies; denying boundary changes closes the loop. <strong>A</strong> prevents escalation by preventing the delegation itself — it fails the requirement that developers create roles. <strong>C</strong> is detective, not preventive, and leaves a window in which an escalated role exists and can act. <strong>D</strong> is fiction — the console enforces no such thing."
    },
    {
      q: "An organization uses a deny-list SCP strategy. The security team attaches an SCP to the Workloads OU denying dynamodb:DeleteTable. Later, an account administrator in that OU attaches an SCP directly to their account explicitly allowing dynamodb:DeleteTable and also grants themselves an identity policy allowing it. Can they delete tables?",
      options: [
        "Yes, because the account-level SCP is more specific and overrides the OU-level deny",
        "No, because SCP evaluation intersects every level from root to account, and a deny at the OU level is final regardless of lower-level allows",
        "Yes, because SCPs do not apply to account administrators",
        "No, unless they also attach a resource policy to each table"
      ],
      answer: [1],
      multi: false,
      explanation: "SCP inheritance has no specificity or override semantics — the effective ceiling is the intersection along the whole path, and an explicit deny at any level ends the matter. <strong>A</strong> imports firewall-style most-specific-wins reasoning that SCPs do not have. <strong>C</strong> is exactly backwards: SCPs bind every principal in member accounts including administrators and root (only the management account escapes). <strong>D</strong> is irrelevant — resource policies cannot resurrect an SCP-denied action either; nothing can."
    },
    {
      q: "A company needs its GitHub Actions pipelines to deploy to AWS. Security mandates no long-lived AWS credentials stored anywhere in GitHub. Which design satisfies this, and what is the critical configuration detail?",
      options: [
        "Store an IAM user's access keys as GitHub encrypted secrets and rotate them weekly",
        "Register GitHub's OIDC provider in IAM and create a deploy role whose trust policy conditions the token's sub claim to the specific repository and branch",
        "Have a scheduled Lambda push fresh access keys into GitHub secrets daily",
        "Create a cross-account role with an ExternalId that GitHub presents at run time"
      ],
      answer: [1],
      multi: false,
      explanation: "OIDC federation eliminates stored credentials entirely: each workflow run presents a short-lived, GitHub-signed JWT that STS exchanges via AssumeRoleWithWebIdentity. The load-bearing detail is the sub-claim condition pinning org/repo/branch — without it, any GitHub repository could assume the role, a real observed breach class. <strong>A</strong> violates the mandate outright: encrypted secrets are still long-lived stored credentials. <strong>C</strong> shortens the lifetime but still stores credentials in GitHub and adds custom machinery — strictly worse than native federation. <strong>D</strong> misapplies the ExternalId pattern: GitHub is not an AWS-account deputy performing AssumeRole with an ExternalId; the OIDC integration is the supported mechanism."
    },
    {
      q: "On EKS, two microservices run as pods on the same node group. One needs read access to a DynamoDB table; the other needs to publish to an SNS topic. Security requires that neither workload can use the other's permissions. What is the recommended design?",
      options: [
        "Attach both permissions to the node instance role, since pods share nodes anyway",
        "Use IAM Roles for Service Accounts to map each pod's Kubernetes service account to its own IAM role via the cluster's OIDC provider",
        "Embed separate access keys for each service in Kubernetes secrets",
        "Run the services on separate node groups, each with its own instance role"
      ],
      answer: [1],
      multi: false,
      explanation: "IRSA gives per-workload identity: each service account's projected JWT is exchanged for a dedicated role whose trust policy pins that namespace and service-account name, so permissions follow the pod, not the node. <strong>A</strong> is the anti-pattern being fixed — every pod on the node inherits the union of permissions. <strong>C</strong> reintroduces long-lived static credentials with rotation burden and theft risk. <strong>D</strong> technically isolates but at severe cost: node-level scheduling constraints, wasted capacity, and it degenerates as services multiply — the exam grades it below IRSA on both security granularity and operational overhead."
    },
    {
      q: "A company with 40 AWS accounts and an existing Okta directory wants employees to sign in once and access assigned roles across all accounts, with short-lived credentials in both console and CLI. Which solution requires the LEAST operational overhead?",
      options: [
        "Create IAM users in each account and enforce a strong password policy",
        "Configure IAM Identity Center at the organization level with Okta as the external identity source via SAML and SCIM, and assign permission sets to accounts",
        "Register Okta as a SAML provider separately in each of the 40 accounts and maintain per-account role trust policies",
        "Create one shared IAM user per team with MFA and cross-account roles"
      ],
      answer: [1],
      multi: false,
      explanation: "Identity Center is purpose-built for this: one org-level integration, SCIM keeps users and groups synced, permission sets materialize as roles in every assigned account, and CLI v2 supports it natively with temporary credentials. <strong>A</strong> means 40 sets of long-lived credentials per person — the posture everything in this module argues against. <strong>C</strong> works (it was the pre-Identity-Center pattern) but multiplies configuration by account count, which is precisely the overhead the question asks to minimize. <strong>D</strong> is a compliance failure on arrival: shared credentials destroy attribution and violate least privilege."
    },
    {
      q: "A security audit must identify every resource in an organization that is accessible from outside the organization, with provable rather than sampled results. Which service provides this?",
      options: [
        "Amazon GuardDuty, using its threat intelligence feeds",
        "IAM Access Analyzer with the organization as the zone of trust, which uses automated policy reasoning to find externally accessible resources",
        "AWS CloudTrail Lake queries for external principal ARNs",
        "Amazon Inspector's network reachability findings"
      ],
      answer: [1],
      multi: false,
      explanation: "Access Analyzer formally analyzes resource policies (provable, not observational) and reports every resource reachable from outside the configured zone of trust. <strong>A</strong> detects active threats from telemetry — it says nothing about what policies permit. <strong>C</strong> only shows external access that actually occurred and was logged; an unexploited public bucket never appears — sampled evidence, exactly what the audit excludes. <strong>D</strong> assesses network paths and workload vulnerabilities, not IAM/resource-policy exposure."
    },
    {
      q: "Which TWO statements about permission boundaries are correct? (Select TWO.)",
      options: [
        "A boundary grants its listed permissions to the principal it is attached to",
        "Effective permissions are the intersection of the boundary and the principal's identity policies, subject to explicit denies and SCPs",
        "Boundaries can be attached to the root user of an account to constrain it",
        "A boundary does not affect access granted to the principal by resource-based policies in some cross-account evaluation paths",
        "Multiple boundaries can be layered on one principal for defense in depth"
      ],
      answer: [1, 3],
      multi: true,
      explanation: "Boundaries cap rather than grant, so effective access is the boundary-identity intersection (<strong>B</strong>), and boundary evaluation has known gaps around resource-based-policy paths where the resource policy directly names the principal (<strong>D</strong>) — a subtlety AWS documents. <strong>A</strong> is the canonical misreading: attach a boundary with no identity policies and the principal can do nothing. <strong>C</strong> is impossible — nothing in IAM binds root; only SCPs do, and only in member accounts. <strong>E</strong> is wrong: exactly one boundary per principal."
    }
  ],
  flashcards: [
    { front: "The two policy types that can GRANT permissions", back: "Identity-based policies and resource-based policies. Everything else — SCPs, permission boundaries, session policies, and every Deny — only restricts. Find the grant first, then hunt for subtractions." },
    { front: "Full policy evaluation order", back: "1. Explicit deny anywhere (final). 2. SCP must allow. 3. Resource policy OR 4. identity policy allows (union same-account). 5. Intersect permissions boundary. 6. Intersect session policy. Cross-account: resource policy AND identity policy must both allow." },
    { front: "Same-account vs cross-account resource policy evaluation", back: "Same account: resource policy OR identity policy allowing is sufficient (union). Cross-account: BOTH sides must allow (intersection) — the caller's account via identity policy and the owner's account via resource policy." },
    { front: "What does Allow + NotAction actually do?", back: "Grants every action EXCEPT those listed — including all future services. It is not a deny. Legitimate mainly inside Deny statements (e.g., region-deny SCPs exempting global services). A NotAction inside an Allow is usually a security finding." },
    { front: "Condition modifiers: IfExists, ForAllValues, Null", back: "<strong>IfExists</strong>: condition passes if the key is absent. <strong>ForAllValues</strong>: every value in a multivalued key must match — and it is TRUE when the key is absent (pair with Null). <strong>Null</strong>: tests key presence, e.g. Null on aws:TokenIssueTime = true detects long-term credentials." },
    { front: "AND/OR semantics inside a Condition block", back: "Multiple operators and multiple keys are ANDed; multiple values for a single key are ORed." },
    { front: "Policy variable for per-user S3 prefixes", back: "Use the <code>aws:username</code> context key in the Resource ARN with the standard dollar-brace interpolation syntax — one policy scopes every user to their own prefix. ABAC generalizes this with aws:PrincipalTag." },
    { front: "What is a role's trust policy, formally?", back: "The role's resource-based policy: its Principal element defines who may call sts:AssumeRole on it. Assumption requires the trust policy AND (cross-account or same-account non-admin paths) the caller's identity policy allowing sts:AssumeRole." },
    { front: "Role chaining session limit", back: "When a role assumes another role, the new session is capped at <strong>1 hour</strong>, regardless of MaxSessionDuration (which otherwise allows up to 12 h). Federation and instance profiles are not chaining." },
    { front: "Temporary vs long-term access key prefixes", back: "ASIA = temporary (STS, with session token). AKIA = long-term IAM user key. Seeing AKIA in a modern architecture is a hygiene finding." },
    { front: "Why enforce IMDSv2 on EC2?", back: "IMDSv1 answers any plain GET, so any SSRF in an app can steal instance-role credentials (the Capital One vector). IMDSv2 requires a token from a PUT handshake with a TTL, neutralizing GET-only SSRF; hop limit 1 also blocks containers from the host path." },
    { front: "How do you revoke stolen temporary credentials?", back: "You cannot recall the token. Attach a deny-all policy conditioned on aws:TokenIssueTime older than now — existing sessions hit explicit deny, new sessions pass. This is what the console's revoke-sessions button generates." },
    { front: "Confused deputy problem + its fix", back: "A privileged intermediary (SaaS that assumes customer roles) is tricked by one customer into acting against another's resources, since role ARNs are guessable. Fix: vendor-generated <strong>ExternalId</strong> required by the trust policy condition, binding each assumption to its tenant." },
    { front: "aws:SourceArn / aws:SourceAccount — when required?", back: "On every resource policy whose Principal is a service (sns.amazonaws.com etc.). Without them, ANY customer's use of that service can target your resource — the service-to-service confused deputy." },
    { front: "IRSA in one sentence", back: "EKS pods exchange a projected, cluster-OIDC-signed service-account JWT via AssumeRoleWithWebIdentity for a role whose trust policy pins sub to system:serviceaccount:namespace:name — per-pod IAM identity instead of shared node credentials." },
    { front: "The critical condition in a GitHub Actions OIDC trust policy", back: "Pin the <code>sub</code> claim to org/repo/branch (and aud to sts.amazonaws.com). Trusting only the audience lets ANY GitHub repository assume the role — an observed real-world breach class." },
    { front: "IAM Identity Center vs Cognito", back: "Identity Center: workforce single sign-on to AWS accounts via permission sets, org-level, SCIM-synced from your IdP. Cognito: customer-facing application identity (user pools authenticate app users; identity pools exchange tokens for AWS credentials). Employees = Identity Center; app users = Cognito." },
    { front: "Three defining properties of SCPs", back: "1) Never grant — they cap maximum available permissions. 2) Bind every principal in member accounts, including root. 3) Do not apply to the management account (or service-linked roles). Effective set = intersection root-to-account; a deny at any level is final." },
    { front: "SCP deny-list vs allow-list strategy", back: "Deny-list: keep FullAWSAccess, add targeted Deny guardrails — default, low maintenance, new services available. Allow-list: remove FullAWSAccess, enumerate permitted services — regulated/sandbox use, high maintenance, new services blocked by default." },
    { front: "Permission boundary vs SCP", back: "Both are ceilings that never grant. SCP: org mechanism, caps whole member accounts (incl. root). Boundary: per-principal managed policy inside one account; signature use is safe delegation — allow iam:CreateRole only when the iam:PermissionsBoundary condition mandates the boundary." },
    { front: "IAM Access Analyzer's three capabilities", back: "1) External access findings — provable (automated reasoning) list of resources accessible outside the account/org zone of trust. 2) Unused access findings. 3) Policy validation + least-privilege policy <em>generation</em> from CloudTrail activity." },
    { front: "Root user hygiene checklist", back: "Hardware MFA; zero access keys; org-owned email alias; used only for root-only tasks; CloudTrail alarm on any root activity. IAM policies cannot bind root — only SCPs can, and only in member accounts." },
    { front: "Why do IAM users support two access keys?", back: "Zero-downtime rotation: create the second key, migrate consumers, verify via last-used, delete the first. Not for sharing between systems." },
    { front: "MFA-enforcement policy trap", back: "Deny-unless-MFA policies must use <strong>BoolIfExists</strong> on aws:MultiFactorAuthPresent — the key is absent (not false) for some credential types, and a bare Bool test creates enforcement gaps." }
  ],
  lab: {
    title: "Lab: build a confused-deputy-proof role and watch policy evaluation live",
    html: `
<h3>Goal</h3>
<p>Create a role protected by an ExternalId condition, prove assumption fails without the ID and succeeds with it, cap a session with a session policy, then revoke active sessions with a TokenIssueTime deny. Everything is IAM/STS — zero cost. About 30 minutes. Run as an admin principal; the commands simulate the vendor flow from your own identity.</p>

<h3>Architecture</h3>
<p>One role (VendorAuditRole) with read-only S3 permissions, trusting your own account root but requiring ExternalId cust-1234. You play both deputy and customer, which makes every evaluation step visible in one terminal.</p>

<h3>Steps</h3>
<ol>
<li><p><strong>Capture identifiers and write the trust policy.</strong></p>
<pre><code>ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
cat &gt; /tmp/trust.json &lt;&lt;'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "ACCOUNT_PLACEHOLDER" },
    "Action": "sts:AssumeRole",
    "Condition": { "StringEquals": { "sts:ExternalId": "cust-1234" } }
  }]
}
EOF
sed -i "s/ACCOUNT_PLACEHOLDER/arn:aws:iam::$ACCOUNT_ID:root/" /tmp/trust.json</code></pre></li>

<li><p><strong>Create the role and attach a scoped policy.</strong></p>
<pre><code>aws iam create-role --role-name VendorAuditRole \
  --assume-role-policy-document file:///tmp/trust.json \
  --max-session-duration 3600
aws iam attach-role-policy --role-name VendorAuditRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess</code></pre></li>

<li><p><strong>Attempt assumption WITHOUT the ExternalId — expect AccessDenied.</strong> This is the confused deputy being refused: right principal, missing tenant binding.</p>
<pre><code>aws sts assume-role \
  --role-arn arn:aws:iam::$ACCOUNT_ID:role/VendorAuditRole \
  --role-session-name no-external-id-test</code></pre>
<p>Read the error carefully — the trust policy's condition failed, so the resource-policy side of the two-key evaluation never allowed.</p></li>

<li><p><strong>Assume WITH the ExternalId and use the session.</strong></p>
<pre><code>aws sts assume-role \
  --role-arn arn:aws:iam::$ACCOUNT_ID:role/VendorAuditRole \
  --role-session-name audit-session \
  --external-id cust-1234 &gt; /tmp/creds.json
export AWS_ACCESS_KEY_ID=$(python3 -c "import json;print(json.load(open('/tmp/creds.json'))['Credentials']['AccessKeyId'])")
export AWS_SECRET_ACCESS_KEY=$(python3 -c "import json;print(json.load(open('/tmp/creds.json'))['Credentials']['SecretAccessKey'])")
export AWS_SESSION_TOKEN=$(python3 -c "import json;print(json.load(open('/tmp/creds.json'))['Credentials']['SessionToken'])")
aws sts get-caller-identity
aws s3 ls
aws ec2 describe-instances --max-items 1</code></pre>
<p>Note three things: the access key starts with ASIA (temporary); s3 ls succeeds; the EC2 call fails — the role's identity policy has no EC2 allow, and default-deny does the rest.</p></li>

<li><p><strong>Cap a session below the role's permissions with a session policy.</strong> Unset the session env vars first (run <code>unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN</code>), then:</p>
<pre><code>cat &gt; /tmp/session-policy.json &lt;&lt;'EOF'
{ "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow",
    "Action": "s3:ListAllMyBuckets", "Resource": "*" }] }
EOF
aws sts assume-role \
  --role-arn arn:aws:iam::$ACCOUNT_ID:role/VendorAuditRole \
  --role-session-name capped-session \
  --external-id cust-1234 \
  --policy file:///tmp/session-policy.json &gt; /tmp/capped.json</code></pre>
<p>Export the capped credentials the same way as step 4 and verify: <code>aws s3 ls</code> (bucket listing) works, but <code>aws s3 ls s3://any-bucket-name</code> (object listing) fails — the session policy intersected away everything but ListAllMyBuckets even though the role allows full S3 read. Ceiling, not grant, demonstrated.</p></li>

<li><p><strong>Revoke all active sessions.</strong> Unset the session env vars again, then attach the TokenIssueTime kill switch (use the current UTC timestamp):</p>
<pre><code>NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat &gt; /tmp/revoke.json &lt;&lt;EOF
{ "Version": "2012-10-17",
  "Statement": [{ "Effect": "Deny", "Action": "*", "Resource": "*",
    "Condition": { "DateLessThan": { "aws:TokenIssueTime": "$NOW" } } }] }
EOF
aws iam put-role-policy --role-name VendorAuditRole \
  --policy-name RevokeOldSessions --policy-document file:///tmp/revoke.json</code></pre>
<p>Re-export the step-4 credentials from /tmp/creds.json and retry <code>aws s3 ls</code> — explicit deny. Assume the role freshly (with the ExternalId) and the new session works, because its issue time postdates the cutoff. You have reproduced the console's revoke-sessions mechanism by hand.</p></li>
</ol>

<h3>Verify</h3>
<ul>
<li>Assumption without ExternalId: denied. With: allowed.</li>
<li>Session-policy session could list buckets but not objects.</li>
<li>Pre-revocation credentials explicit-deny; post-revocation sessions work.</li>
</ul>

<h3>Teardown</h3>
<p>IAM resources are free but leaving a vendor-trust role around is bad hygiene. Order: inline policy, managed attachment, role, temp files.</p>
<ol>
<li><pre><code>unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
aws iam delete-role-policy --role-name VendorAuditRole --policy-name RevokeOldSessions
aws iam detach-role-policy --role-name VendorAuditRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
aws iam delete-role --role-name VendorAuditRole</code></pre></li>
<li><pre><code>rm -f /tmp/trust.json /tmp/creds.json /tmp/capped.json /tmp/session-policy.json /tmp/revoke.json
aws iam get-role --role-name VendorAuditRole 2&gt;&amp;1 || echo 'role gone'</code></pre></li>
</ol>
`
  }
});
