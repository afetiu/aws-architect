/* Learning layer — Module 2: IAM, STS & Organizations */
window.COURSE.registerLearn({
  moduleId: "iam",
  bigPicture: "IAM decides, for every single AWS API call, <strong>who</strong> may do <strong>what</strong> to <strong>which resource</strong>. The rules are few: everything starts denied, an explicit deny always wins, and only two policy types ever grant access — everything else (SCPs, boundaries, session policies) only takes away. On top of that sit roles and temporary credentials, cross-account access, federation for people and pipelines, and Organizations guardrails. This is the most tested module in Domain 1 (30% of the exam).",
  cheatsheet: [
    { k: "Prevent anyone in member accounts, even root, from doing X", v: "<strong>SCP</strong> — the only thing that binds member-account root" },
    { k: "Admin gets AccessDenied on one bucket", v: "An <strong>explicit deny</strong> in the bucket policy or an <strong>SCP</strong> above" },
    { k: "Role in account A cannot read bucket in account B, bucket policy allows it", v: "A's <strong>identity policy</strong> must also allow — cross-account needs both sides" },
    { k: "SCP allows the service but users still get denied", v: "SCPs <strong>never grant</strong>; users still need an IAM allow" },
    { k: "App on EC2 needs S3 access", v: "<strong>Instance profile role</strong> — never access keys on the box" },
    { k: "Third-party SaaS needs access to our account", v: "<strong>Cross-account role + ExternalId</strong>, never IAM users with keys" },
    { k: "Stop other AWS customers pointing a service at our queue/bucket", v: "<code>aws:SourceArn</code> / <code>aws:SourceAccount</code> condition" },
    { k: "Employees need access to many accounts, existing AD or Okta", v: "<strong>IAM Identity Center</strong> with permission sets" },
    { k: "CI/CD (e.g. GitHub Actions) deploys without stored keys", v: "<strong>OIDC federation</strong>, pin the <code>sub</code> claim to repo/branch" },
    { k: "Different EKS pods need different permissions", v: "<strong>IRSA / EKS Pod Identity</strong>, not the node role" },
    { k: "Mobile or web app end-users need AWS access", v: "<strong>Cognito</strong>, not Identity Center, not IAM users" },
    { k: "Let developers create roles without privilege escalation", v: "<strong>Permissions boundary</strong> required via <code>iam:PermissionsBoundary</code> condition" },
    { k: "Find resources shared outside the account or org", v: "<strong>IAM Access Analyzer</strong> external access findings" },
    { k: "Generate least-privilege policy from real usage", v: "<strong>Access Analyzer policy generation</strong> from CloudTrail" },
    { k: "Session ends after 1 hour though MaxSessionDuration is 12 h", v: "<strong>Role chaining</strong> — hard 1-hour cap" },
    { k: "Kill possibly leaked role credentials now, keep the role", v: "Deny-all with <code>aws:TokenIssueTime</code> condition (revoke sessions)" },
    { k: "Protect instance credentials from SSRF", v: "Require <strong>IMDSv2</strong> (HttpTokens=required)" },
    { k: "Each user may only touch their own S3 folder", v: "<strong>Policy variable</strong> <code>aws:username</code> in the Resource" },
    { k: "Grant by project without editing policies per project", v: "<strong>ABAC</strong>: match principal tags to resource tags" },
    { k: "Audit key age and MFA across all IAM users", v: "<strong>Credential report</strong>" }
  ],
  lessons: {
    "policy-language": {
      minutes: 5,
      tldr: [
        "IAM is <strong>default deny</strong>. Nothing works until something allows it; an explicit Deny is final.",
        "A statement = <strong>Effect</strong> + <strong>Action</strong> + <strong>Resource</strong> (+ optional <strong>Condition</strong>). Order of statements does not matter.",
        "<strong>Principal</strong> appears only in resource policies and trust policies, never in identity policies.",
        "<code>NotAction</code> in an Allow grants <em>everything else</em> — it is not a deny. Use Not-forms inside Deny statements.",
        "Scale with <strong>policy variables</strong> (<code>aws:username</code>) and <strong>ABAC</strong> (tag matching) instead of one policy per team."
      ],
      analogy: "A building's keycard system: every door is locked unless your card is programmed for it. Rules can say which doors, at what times, from which entrance. A \"banned\" flag on your card beats any door permission.",
      examTip: "An option that \"restricts\" access with <code>Allow + NotAction</code> actually opens nearly everything. \"Users only reach their own folder\" means the <code>aws:username</code> policy variable.",
      terms: [
        { t: "Principal", d: "Who makes the request: root, IAM user, role, federated user, or an AWS service." },
        { t: "Identity-based policy", d: "Attached to a user, group or role; says what that identity may do." },
        { t: "Resource-based policy", d: "Attached to a resource (bucket, queue, key); names who may use it." },
        { t: "Condition", d: "Extra rules on a statement, e.g. source IP, tags, MFA present." },
        { t: "ABAC", d: "Attribute-based access control: allow when the user's tags match the resource's tags." },
        { t: "IfExists / Null", d: "Condition helpers for keys that may be missing; forgetting them causes holes." }
      ],
      check: [
        {
          q: "A policy says Effect Allow, NotAction iam:*, Resource *. What does it grant?",
          options: ["Nothing, it is a deny", "Everything except IAM actions", "Only IAM actions"],
          answer: 1,
          why: "<code>NotAction</code> means \"all actions except these\", so with Allow it grants <strong>every non-IAM action</strong>, including future services. It never denies."
        },
        {
          q: "You want one policy that gives each of 500 users access only to their own home folder in a bucket. What do you use?",
          options: ["500 separate policies", "A policy variable with aws:username in the Resource ARN", "A bucket ACL per folder", "An SCP"],
          answer: 1,
          why: "The <strong>policy variable</strong> is filled in with the caller's name at request time, so one policy serves everyone. ACLs and SCPs cannot do per-user folders cleanly."
        }
      ]
    },
    "evaluation-order": {
      minutes: 4,
      tldr: [
        "Step one: any matching <strong>explicit Deny</strong> anywhere ends it. Nothing beats it.",
        "Then the <strong>SCP</strong> must allow, then a <strong>resource or identity policy</strong> must allow, then any <strong>boundary</strong> and <strong>session policy</strong> must allow.",
        "Only <strong>identity</strong> and <strong>resource</strong> policies grant. SCPs, boundaries and session policies only cap.",
        "Same account: identity OR resource policy allowing is enough.",
        "<strong>Cross-account: both sides must allow</strong> — the caller's identity policy AND the resource's policy (or role trust)."
      ],
      analogy: "Getting into a concert: a ban list at the gate beats everything. Then the venue must be open that night (SCP), you need a ticket (identity or resource allow), and your ticket's zone limits where you can go (boundary). Visiting another venue? You need their ticket and your own boss's permission.",
      examTip: "Any answer claiming admin rights or a resource policy can override an <strong>explicit deny</strong> is wrong. For cross-account failures, check that <strong>both</strong> sides allow.",
      terms: [
        { t: "Explicit deny", d: "A Deny statement that matches. Always wins over any allow." },
        { t: "Implicit deny", d: "The default when nothing allows the request." },
        { t: "Permissions boundary", d: "A cap on one user or role; effective access = identity policy AND boundary." },
        { t: "Session policy", d: "An optional cap passed when assuming a role; limits that session only." },
        { t: "IAM policy simulator", d: "Tool to test whether a request would be allowed, including SCPs and boundaries." }
      ],
      check: [
        {
          q: "A bucket in account B allows a role from account A to GetObject. The role's own policy has no S3 permissions. Can it read?",
          options: ["Yes, the bucket policy is enough", "No, cross-account needs the role's identity policy to allow too", "Only if an SCP allows it"],
          answer: 1,
          why: "Across accounts, access is an <strong>intersection</strong>: both A (identity) and B (resource) must allow. The bucket policy alone would be enough only within the same account."
        },
        {
          q: "Which of these can actually grant permissions?",
          options: ["SCPs and permissions boundaries", "Identity-based and resource-based policies", "Session policies and SCPs"],
          answer: 1,
          why: "Only <strong>identity and resource policies</strong> grant. SCPs, boundaries and session policies are ceilings that can only remove access."
        }
      ]
    },
    "sts-roles": {
      minutes: 5,
      tldr: [
        "A <strong>role</strong> has permissions but no password or keys. You <strong>assume</strong> it via STS and get temporary credentials.",
        "Two checks: the caller must be allowed <code>sts:AssumeRole</code>, and the role's <strong>trust policy</strong> must name the caller.",
        "Sessions last 1-12 h (default 1 h). <strong>Role chaining</strong> (role assumes role) is hard-capped at <strong>1 hour</strong>.",
        "EC2 gets role credentials through an <strong>instance profile</strong> and the metadata service; enforce <strong>IMDSv2</strong> against SSRF.",
        "You cannot delete an issued token; revoke by denying sessions issued before now (<code>aws:TokenIssueTime</code>)."
      ],
      analogy: "A role is a visitor badge at the front desk. You show who you are, the desk checks you are on the list, and gives you a badge that expires tonight. While wearing it, you only have the badge's access, not your own.",
      examTip: "Anything that puts <strong>access keys on an EC2 instance</strong> (config file, user data) is wrong on sight — use an instance profile role. \"Session dies after one hour despite a 12 h max\" = role chaining.",
      terms: [
        { t: "STS", d: "Security Token Service — issues short-lived credentials for roles and federation." },
        { t: "Trust policy", d: "The role's resource policy: who is allowed to assume it." },
        { t: "Instance profile", d: "Container that attaches one IAM role to an EC2 instance." },
        { t: "Role chaining", d: "Using a role's credentials to assume another role; max 1-hour session." },
        { t: "IMDSv2", d: "Token-based metadata service that blocks simple SSRF credential theft." }
      ],
      check: [
        {
          q: "A pipeline assumes role A, then from A assumes role B with MaxSessionDuration of 12 hours. It fails after 60 minutes. Why?",
          options: ["The trust policy expired", "Role chaining caps sessions at 1 hour", "STS only issues 1-hour tokens"],
          answer: 1,
          why: "Role-to-role assumption is <strong>role chaining</strong>, hard-capped at 1 hour. A direct AssumeRole can go up to the role's 12-hour max."
        },
        {
          q: "An EC2 app needs to read from DynamoDB. What is the right way to give it credentials?",
          options: ["Store an IAM user's keys in environment variables", "Attach an IAM role via an instance profile", "Pass keys in user data at launch"],
          answer: 1,
          why: "An <strong>instance profile role</strong> gives rotating temporary credentials with nothing to leak. Stored keys are long-lived and get stolen."
        }
      ]
    },
    "cross-account-confused-deputy": {
      minutes: 4,
      tldr: [
        "Two ways across accounts: a <strong>resource policy</strong> naming the other account, or <strong>assuming a role</strong> in the target account.",
        "Resource policy: caller keeps its own identity; good for a few specific resources.",
        "Role: caller becomes a local identity; works for every service; best for broad access, humans, CI and vendors.",
        "<strong>Confused deputy</strong>: a trusted service is tricked into acting on your resources for someone else. Fix vendor roles with <strong>ExternalId</strong>.",
        "For AWS services writing to your resources, pin <code>aws:SourceArn</code> / <code>aws:SourceAccount</code>."
      ],
      analogy: "A courier company has keys to many clients' offices. A crook tells the courier \"go into office 42\" — which isn't his. The ExternalId is a code only the real owner of office 42 has given the courier, so the courier can check the request belongs to that client.",
      examTip: "\"A vendor or SaaS needs access to our account\" = <strong>cross-account role with ExternalId</strong>. Creating an IAM user and sending the vendor keys is always wrong.",
      terms: [
        { t: "Confused deputy", d: "A service with legitimate power misused on behalf of the wrong party." },
        { t: "ExternalId", d: "Unique per-customer value the vendor must pass when assuming your role. Not a password." },
        { t: "aws:SourceArn", d: "Condition key limiting which specific resource (e.g. SNS topic) a service acts for." },
        { t: "Resource Access Manager (RAM)", d: "Shares resources like subnets across accounts; built on these same primitives." }
      ],
      check: [
        {
          q: "Your SQS queue policy lets sns.amazonaws.com send messages, with no conditions. What is the risk?",
          options: ["None, only AWS can use that principal", "Any AWS customer's SNS topic could publish to your queue", "SNS cannot deliver without a role"],
          answer: 1,
          why: "The service principal acts for everyone. Without <code>aws:SourceArn</code> or <code>aws:SourceAccount</code>, <strong>anyone's topic</strong> can target your queue."
        },
        {
          q: "Who should generate the ExternalId in a vendor cross-account role setup?",
          options: ["The customer, any value they like", "The vendor, unique per customer", "AWS, automatically"],
          answer: 1,
          why: "The <strong>vendor</strong> must generate and enforce a unique value per tenant. Customer-chosen IDs let an attacker pick yours and recreate the confused deputy."
        }
      ]
    },
    "federation-identity-center": {
      minutes: 5,
      tldr: [
        "Federation: an outside identity provider vouches for a user, STS swaps that proof for <strong>temporary role credentials</strong>. No IAM users.",
        "<strong>SAML 2.0</strong> for classic corporate directories; <strong>OIDC</strong> for modern tokens (GitHub, Google, EKS).",
        "OIDC trust must pin the <code>sub</code> claim (repo/branch or service account), or strangers can assume the role.",
        "<strong>IRSA / EKS Pod Identity</strong> give each pod its own role instead of sharing the node's.",
        "<strong>IAM Identity Center</strong> = workforce access to many accounts via permission sets. Customers use <strong>Cognito</strong>."
      ],
      analogy: "Federation is a hotel accepting your passport instead of issuing its own ID card. The passport office (your identity provider) vouches for you; the hotel just checks the stamp and hands you a room key that expires at checkout.",
      examTip: "Workforce + many accounts + existing AD/Okta = <strong>IAM Identity Center</strong>. App end-users signing in with Google = <strong>Cognito</strong>. Any answer that creates IAM users for a federated population is wrong.",
      terms: [
        { t: "Identity provider (IdP)", d: "The external system that authenticates users, e.g. Okta, Entra ID, GitHub." },
        { t: "SAML 2.0", d: "XML-based federation standard used by enterprise directories." },
        { t: "OIDC", d: "OpenID Connect: JSON token (JWT) federation used by GitHub, Google, EKS." },
        { t: "Permission set", d: "Identity Center role template deployed as a role into each assigned account." },
        { t: "SCIM", d: "Protocol that syncs users and groups from your IdP into Identity Center." },
        { t: "IRSA", d: "IAM Roles for Service Accounts: per-pod AWS roles in EKS via OIDC." }
      ],
      check: [
        {
          q: "A GitHub OIDC deploy role's trust policy checks only the aud claim. What is the danger?",
          options: ["None, aud is unique to your org", "Any GitHub repository, including an attacker's, could assume the role", "Tokens will never be accepted"],
          answer: 1,
          why: "Every GitHub token shares the same <code>aud</code>. Without a <code>sub</code> condition pinned to your repo and branch, <strong>any repo</strong> can get in."
        },
        {
          q: "200 employees need single sign-on to 30 AWS accounts using the company's Okta. What fits best?",
          options: ["IAM users in each account", "Amazon Cognito user pools", "IAM Identity Center with Okta as identity source"],
          answer: 2,
          why: "<strong>Identity Center</strong> is built for workforce multi-account access, synced from Okta via SCIM. Cognito is for customers of your app."
        }
      ]
    },
    "organizations-scps": {
      minutes: 4,
      tldr: [
        "Organizations groups accounts into a tree: management account, <strong>OUs</strong> (up to 5 deep), member accounts. One consolidated bill.",
        "An <strong>SCP</strong> sets the <strong>maximum</strong> permissions for member accounts. It never grants anything.",
        "SCPs bind <strong>everyone in member accounts, including root</strong> — but <strong>not the management account</strong>.",
        "Inheritance is an intersection: every level from root to account must allow. A deny anywhere wins.",
        "Default strategy is a <strong>deny-list</strong>: keep FullAWSAccess, add targeted denies (regions, CloudTrail, leaving the org)."
      ],
      analogy: "An SCP is the building's fire code. It says what no tenant may ever do, even the owner of a flat. It does not hand anyone a key; each flat still decides who gets in. And the fire code office itself (management account) is not covered by its own code.",
      examTip: "\"Prevent member accounts, even root, from X\" = <strong>SCP</strong>. \"We allowed it in the SCP but it is still denied\" = the user still needs an <strong>IAM allow</strong>.",
      terms: [
        { t: "Organizational unit (OU)", d: "A folder of accounts in the org tree; policies attached there apply to everything under it." },
        { t: "SCP", d: "Service control policy: an org-level ceiling on what member-account principals can do." },
        { t: "FullAWSAccess", d: "The default SCP attached everywhere; remove it to switch to allow-list mode." },
        { t: "Deny-list vs allow-list", d: "Block specific things (common) vs permit only listed services (strict, high effort)." },
        { t: "Consolidated billing", d: "One payer for all accounts, with pooled volume discounts and Savings Plans." }
      ],
      check: [
        {
          q: "An OU-level SCP denies ec2:*, and the account below it has an SCP allowing ec2:*. Can users in that account launch EC2?",
          options: ["Yes, the account-level SCP overrides", "No, a deny anywhere on the path wins", "Only the root user can"],
          answer: 1,
          why: "SCPs <strong>intersect</strong> down the tree; there is no override. A deny at any level blocks it, including for root."
        },
        {
          q: "Where should you never run workloads, because SCPs cannot protect it?",
          options: ["The log archive account", "The management account", "A sandbox OU account"],
          answer: 1,
          why: "SCPs <strong>do not apply to the management account</strong>, so keep it empty, locked down and watched."
        }
      ]
    },
    "boundaries-analyzer-hygiene": {
      minutes: 5,
      tldr: [
        "A <strong>permissions boundary</strong> caps one user or role. Signature use: let teams create roles safely, each forced to carry the boundary.",
        "SCP caps whole accounts from the org; boundary caps individual identities inside an account. Neither grants.",
        "<strong>IAM Access Analyzer</strong> proves which resources are reachable from outside, finds unused access, and generates least-privilege policies.",
        "Root: hardware MFA, no access keys, alarms on use. Prefer roles and federation over IAM users.",
        "<strong>Credential report</strong> lists every user's key age and MFA; <strong>access advisor</strong> shows which services each identity actually uses."
      ],
      analogy: "A boundary is a spending limit on a company card. Managers can issue cards to their team, but every card they issue must carry that limit, so nobody can hand themselves a black card.",
      examTip: "\"Let developers create roles without privilege escalation\" = <strong>permissions boundary</strong> enforced with the <code>iam:PermissionsBoundary</code> condition. \"Find resources shared outside the org\" = <strong>Access Analyzer</strong>, not GuardDuty or Inspector.",
      terms: [
        { t: "Privilege escalation", d: "Gaining more rights than intended, e.g. creating yourself an admin role." },
        { t: "IAM Access Analyzer", d: "Uses automated reasoning to find external access, unused access, and to write policies." },
        { t: "Credential report", d: "Account-wide CSV of users, key ages, last use and MFA status." },
        { t: "Access advisor", d: "Shows when each service was last used by an identity, to prune unused permissions." },
        { t: "Centralized root access", d: "Org feature to remove root credentials from member accounts entirely." }
      ],
      check: [
        {
          q: "A role has a permissions boundary allowing S3 and DynamoDB, but no identity policies. What can it do?",
          options: ["S3 and DynamoDB", "Nothing", "Everything except S3 and DynamoDB"],
          answer: 1,
          why: "Boundaries <strong>only cap</strong>. With no identity policy granting anything, the intersection is <strong>empty</strong>."
        },
        {
          q: "Security wants to list every S3 bucket and KMS key reachable from outside the organization. Which service?",
          options: ["Amazon GuardDuty", "IAM Access Analyzer", "Amazon Inspector"],
          answer: 1,
          why: "<strong>Access Analyzer</strong> external access findings answer exactly that. GuardDuty detects threats; Inspector scans for vulnerabilities."
        }
      ]
    }
  }
});
