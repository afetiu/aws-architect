window.COURSE.registerLearn({
  moduleId: "multi-account",
  bigPicture: "Big companies don't run everything in one AWS account. They run <strong>hundreds</strong>, one per workload per environment, because the account is the only wall AWS won't let anything climb over by accident. This module is about running that fleet: grouping accounts into OUs, fencing them with SCPs, giving people one login for all of them, sharing the network, and centralising logs and security. It is one of the heaviest topics on SAP-C02, and the answer is almost always “automate it org-wide, don't touch each account by hand”.",
  cheatsheet: [
    { k: "Limit blast radius, stop one team eating another's quotas", v: "<strong>Separate accounts</strong> in AWS Organizations — not IAM + tags in one account" },
    { k: "Stricter rules for prod than dev", v: "<strong>Prod and NonProd OUs</strong> with different SCPs attached to each" },
    { k: "Block an action for everyone in member accounts", v: "<strong>SCP</strong> — a ceiling on permissions, it never grants anything" },
    { k: "Stop anyone, even outside accounts, touching our resources", v: "<strong>RCP</strong> (Resource Control Policy) with aws:PrincipalOrgID — the data perimeter" },
    { k: "Only allow approved regions", v: "Region-deny SCP on <code>aws:RequestedRegion</code>, with a <code>NotAction</code> carve-out for global services (IAM, Route 53, CloudFront…)" },
    { k: "SCP doesn't seem to stop the management account", v: "Correct — <strong>SCPs never apply to the management account</strong>. Keep it empty" },
    { k: "Fastest governed multi-account setup, low overhead", v: "<strong>AWS Control Tower</strong> landing zone" },
    { k: "Account vending as code, per-account customisation", v: "<strong>Account Factory for Terraform (AFT)</strong>" },
    { k: "Existing account fails to enroll in Control Tower", v: "Remove its <strong>existing AWS Config recorder</strong>/delivery channel (or add the execution role)" },
    { k: "Security team runs GuardDuty/Security Hub without the management account", v: "Register the security account as <strong>delegated administrator</strong>" },
    { k: "Workforce in Okta/Entra, access to 200 accounts, auto-deprovisioning", v: "<strong>IAM Identity Center</strong> + external IdP (SAML) + <strong>SCIM</strong>" },
    { k: "Too many permission sets as teams grow", v: "<strong>ABAC</strong>: IdP attributes become session tags, one permission set" },
    { k: "App accounts use central networking without owning VPCs", v: "<strong>VPC sharing</strong> (subnets) via RAM — org-only" },
    { k: "Share TGW with current AND future accounts, no invitations", v: "Enable <strong>RAM sharing with Organizations</strong>, share to the OU" },
    { k: "Interface endpoints cost too much across many accounts", v: "<strong>Centralise endpoints</strong> in a hub VPC behind TGW + private hosted zones" },
    { k: "Trail member accounts can't tamper with", v: "<strong>Organization CloudTrail</strong> into the Log Archive account" },
    { k: "GuardDuty on in every current and future account", v: "Delegated admin + <strong>auto-enable</strong> (not StackSets, not scripts)" },
    { k: "Every new account gets baseline roles/rules automatically", v: "<strong>Service-managed StackSet</strong> targeting the OU with auto-deployment" },
    { k: "New accounts keep hitting default service limits", v: "Service Quotas <strong>quota request template</strong> associated with the org" },
    { k: "Tag VALUES must be consistent vs tags must EXIST", v: "Values = <strong>tag policy</strong> (enforced). Existence = <strong>SCP</strong> with aws:RequestTag condition" }
  ],
  lessons: {
    "why-multi-account": {
      minutes: 5,
      tldr: [
        "The <strong>AWS account is the only hard wall</strong>. Everything inside it (IAM, VPCs, tags) is settings someone can change.",
        "Accounts give you four things: small <strong>blast radius</strong>, separate <strong>quotas</strong>, clean <strong>billing</strong>, clear <strong>compliance</strong> scope.",
        "Standard grain: <strong>one account per workload per environment</strong> (payments-prod, payments-dev).",
        "The overhead is real, but the fix is <em>automating</em> account creation, never using fewer accounts.",
        "Cross-account access needs <strong>both sides</strong> to agree: the caller's identity policy AND the target's resource policy."
      ],
      analogy: "IAM inside one account is like locks on the rooms of one house — someone with the master key opens them all. Separate accounts are separate houses: a fire in one doesn't spread, each has its own electricity meter, and nobody walks in unless the owner lets them.",
      examTip: "“Limit blast radius”, “one workload exhausts another's limits”, “separate billing per business unit” all point to <strong>separate accounts in AWS Organizations</strong>. The “IAM policies and tags in one account” option is the distractor.",
      terms: [
        { t: "Blast radius", d: "How much can break when one thing goes wrong. An account caps it." },
        { t: "Service quota", d: "A per-account, per-region limit (e.g. Lambda concurrency). Separate accounts = separate quotas." },
        { t: "Consolidated billing", d: "One bill for the whole org, with volume discounts and RI/Savings Plan sharing across accounts." },
        { t: "Management account", d: "The account that owns the org and pays the bill. Never run workloads in it." }
      ],
      check: [
        {
          q: "A team's load test uses up all Lambda concurrency and takes down another team's API in the same account. What's the architectural fix?",
          options: ["Request a higher Lambda concurrency quota", "Put each workload in its own account", "Add reserved concurrency tags", "Use IAM policies to limit the test team"],
          answer: 1,
          why: "Quotas are per account per region, so separate accounts give each workload its own pool. A quota increase just delays the next collision."
        },
        {
          q: "An app in account A wants to read an S3 bucket in account B. What must be true?",
          options: ["Only A's IAM policy must allow it", "Only B's bucket policy must allow it", "Both A's identity policy and B's bucket policy must allow it"],
          answer: 2,
          why: "Crossing accounts needs consent on both sides. That two-party rule is what makes the account a real boundary."
        }
      ]
    },
    "ou-topology": {
      minutes: 5,
      tldr: [
        "OUs (organizational units) are <strong>places to attach policies</strong>, not a copy of the org chart.",
        "Reference layout: <strong>Security OU</strong> (Log Archive + Security Tooling), <strong>Infrastructure OU</strong> (Network, Shared Services), <strong>Workloads OU</strong> (Prod / NonProd), Sandbox, Suspended.",
        "The <strong>management account</strong> is ignored by SCPs, so keep it empty of workloads and people.",
        "Numbers: OUs nest <strong>5 levels</strong> deep; an account sits in exactly <strong>one</strong> OU; max <strong>10 SCPs</strong> per target (raised from 5 in May 2026; older exam material says 5).",
        "Moving an account between OUs changes its rules instantly — useful for quarantine, dangerous if done by mistake."
      ],
      analogy: "Think of OUs as folders on a shared drive where the sharing rules are set on the folder. You group files by who's allowed to see them, not by who wrote them — the author's name is just a label (a tag).",
      examTip: "“Apply stricter controls to production than development” = separate Prod and NonProd <strong>OUs</strong> with different SCPs, not per-account policies. Log Archive and Security Tooling always live in the <strong>Security OU</strong>.",
      terms: [
        { t: "OU", d: "Organizational unit: a group of accounts that share the same policies." },
        { t: "Log Archive account", d: "Write-once home for org-wide logs. Almost nobody can read it, nobody can delete." },
        { t: "Security Tooling (Audit) account", d: "Where the security team runs GuardDuty, Security Hub etc. for the whole org." },
        { t: "Suspended OU", d: "Quarantine folder with a deny-almost-everything SCP, for dying or compromised accounts." },
        { t: "Network account", d: "Owns Transit Gateway, shared VPCs, DNS rules; shares them out with RAM." }
      ],
      check: [
        {
          q: "A company creates one OU per department so it matches the HR chart. What's the main problem with that?",
          options: ["OUs can't hold more than 10 accounts", "Governance needs follow environment and data sensitivity, not departments", "Departments can't be tagged"],
          answer: 1,
          why: "OUs exist to attach policies. Prod vs dev, regulated vs not — those share rules. Ownership belongs in a tag, and reorgs would force constant moves."
        },
        {
          q: "Why should nobody run workloads in the management account?",
          options: ["It has lower service quotas", "SCPs cannot restrict anything in it", "It can't use VPCs"],
          answer: 1,
          why: "SCPs never apply to the management account, so no guardrail can contain a mistake or attacker there."
        }
      ]
    },
    "scp-engineering": {
      minutes: 5,
      tldr: [
        "An <strong>SCP never grants</strong> permissions. It sets the ceiling; IAM still has to allow the action.",
        "Down the tree it's an <strong>intersection</strong>: an action must be allowed at Root, every OU on the path, and the account. A Deny anywhere wins.",
        "<strong>Deny-list</strong> (keep FullAWSAccess, add targeted denies) is the default. Allow-lists block new services and cost lots of upkeep.",
        "Classic SCPs: <strong>region deny</strong> (with global-service carve-out), <strong>deny leaving the org</strong>, <strong>protect security tooling</strong>.",
        "<strong>RCPs</strong> fence your <em>resources</em> against anyone, including outside accounts — the data perimeter."
      ],
      analogy: "An SCP is the speed limiter on a company car. It can stop you going above 120, but it can't make the car move — you still need the key (an IAM allow). And the limiter at head office beats any looser one at the branch.",
      examTip: "Any answer that says an SCP <em>grants</em> access is wrong. “Prevent member-account principals doing X” = <strong>SCP</strong>; “prevent anyone, even external accounts, touching our resources” = <strong>RCP</strong>. A region-deny SCP missing the global-services <code>NotAction</code> is a classic trap.",
      terms: [
        { t: "SCP", d: "Service Control Policy: the maximum permissions for principals in member accounts." },
        { t: "FullAWSAccess", d: "The default SCP that allows everything. Detach it and only explicit allows survive." },
        { t: "RCP", d: "Resource Control Policy: the maximum anyone can do to resources in your org's accounts." },
        { t: "aws:RequestedRegion", d: "Condition key used to deny API calls outside approved regions." },
        { t: "aws:PrincipalOrgID", d: "Condition key: “the caller belongs to my organization”." }
      ],
      check: [
        {
          q: "Root has FullAWSAccess. The Workloads OU has an SCP allowing only EC2 and S3. A child OU allows DynamoDB. Can accounts in the child OU use DynamoDB?",
          options: ["Yes, the child OU allows it", "No, the Workloads OU level filtered it out", "Yes, because Root allows everything"],
          answer: 1,
          why: "SCPs intersect down the path. The parent OU didn't allow DynamoDB, so nothing lower can bring it back."
        },
        {
          q: "You must stop outside AWS accounts reading any S3 bucket in the org, even if a bucket policy is too open. What fits best?",
          options: ["An SCP denying s3:GetObject", "An RCP denying access unless aws:PrincipalOrgID matches", "A tag policy on buckets", "GuardDuty S3 protection"],
          answer: 1,
          why: "SCPs only restrict your own principals; outsiders aren't evaluated. RCPs restrict what any caller can do to your resources."
        }
      ]
    },
    "control-tower": {
      minutes: 5,
      tldr: [
        "<strong>Control Tower</strong> builds a governed multi-account setup (a <strong>landing zone</strong>) on top of Organizations in hours.",
        "Controls come in three kinds: <strong>preventive</strong> (SCPs), <strong>detective</strong> (Config rules), <strong>proactive</strong> (CloudFormation hooks).",
        "<strong>Account Factory</strong> vends ready-made accounts; <strong>AFT</strong> does it GitOps-style with Terraform.",
        "Don't hand-edit what Control Tower owns — it shows up as <strong>drift</strong>.",
        "<strong>Delegated administrator</strong> lets a member account run a service org-wide, so the management account stays empty."
      ],
      analogy: "Control Tower is a pre-built housing estate with the roads, fences and alarms already in. You can move in fast, but you can't knock down the estate's fences. Building every house yourself (DIY Organizations) gives total freedom and takes months.",
      examTip: "“Fastest governed multi-account environment with least operational overhead” = <strong>Control Tower</strong>. “Existing accounts fail to enroll” = remove the pre-existing <strong>AWS Config recorder</strong>. “Minimise use of the management account” = <strong>delegated admin</strong>.",
      terms: [
        { t: "Landing zone", d: "A ready, governed multi-account environment with logging, security and identity wired up." },
        { t: "Control (guardrail)", d: "A rule Control Tower applies per OU: mandatory, strongly recommended, or elective." },
        { t: "Proactive control", d: "A CloudFormation hook that blocks a non-compliant resource before it's created." },
        { t: "AFT", d: "Account Factory for Terraform: account requests are Terraform files merged in a repo." },
        { t: "Drift", d: "When reality no longer matches Control Tower's known-good setup, e.g. an SCP edited by hand." }
      ],
      check: [
        {
          q: "Which Control Tower control type stops a non-compliant resource from being created by CloudFormation in the first place?",
          options: ["Detective", "Preventive", "Proactive"],
          answer: 2,
          why: "Proactive controls are CloudFormation hooks that check at provisioning time. Detective controls (Config) only flag it afterwards."
        },
        {
          q: "The security team wants to manage Security Hub for all accounts but must not use the management account. What do you do?",
          options: ["Give them an IAM role in the management account", "Register the security account as delegated administrator", "Deploy Security Hub with a StackSet"],
          answer: 1,
          why: "Delegated admin moves the org-wide administration into a member account, which is exactly the point."
        }
      ]
    },
    "identity-center": {
      minutes: 5,
      tldr: [
        "<strong>IAM Identity Center</strong> (ex-AWS SSO) gives people one login for every account, with short-lived credentials only.",
        "A <strong>permission set</strong> is a template; assigning it to a group for an account creates an IAM role there.",
        "Enterprise default: external IdP (Okta, Entra ID) over <strong>SAML</strong> for login + <strong>SCIM</strong> to sync users and groups.",
        "<strong>ABAC</strong>: pass IdP attributes (like team) as session tags, so one permission set works for every team.",
        "Sessions last 1–12 hours; removing an assignment doesn't kill live sessions."
      ],
      analogy: "Identity Center is a hotel key-card desk. The permission set is the card type (“guest”, “cleaner”), assigning it programs the card for certain floors, and the cards expire at checkout. ABAC is a card that opens only rooms whose door label matches your team name.",
      examTip: "“Users in Okta/Azure AD need access to many accounts, removed automatically when they leave” = <strong>Identity Center + SAML + SCIM</strong>. Creating IAM users per account is always wrong on the Pro exam.",
      terms: [
        { t: "Permission set", d: "Policy template that Identity Center turns into a role in each assigned account." },
        { t: "SCIM", d: "Protocol that keeps users and groups in sync from your IdP to AWS automatically." },
        { t: "SAML 2.0", d: "The standard that handles the login (authentication) from an external IdP." },
        { t: "ABAC", d: "Attribute-based access control: allow when the user's tag matches the resource's tag." },
        { t: "AWSReservedSSO_ role", d: "The role Identity Center creates. Its name has a random suffix — don't hard-code it." }
      ],
      check: [
        {
          q: "You keep creating permission sets like Dev-TeamA, Dev-TeamB, Dev-TeamC. What reduces this?",
          options: ["More IAM groups per account", "ABAC with team as a session tag and one Developer permission set", "A separate Identity Center per team"],
          answer: 1,
          why: "ABAC compares the user's team tag with the resource's team tag, so one permission set serves every team. There's only one Identity Center per org anyway."
        },
        {
          q: "An employee leaves and is disabled in Okta. What makes their AWS access disappear without manual work?",
          options: ["SCIM provisioning from Okta", "SAML session expiry alone", "An SCP on the account"],
          answer: 0,
          why: "SCIM syncs the removal into Identity Center. SAML only handles login and doesn't delete the user."
        }
      ]
    },
    "ram-shared-network": {
      minutes: 5,
      tldr: [
        "<strong>RAM</strong> (Resource Access Manager) lets one account share a resource so others use it in place — no copies.",
        "Turn on <strong>sharing with Organizations</strong> once, then share to an OU: no invitations, and <strong>future accounts</strong> get it too.",
        "<strong>VPC sharing</strong>: the network account owns the VPC and shares subnets; app accounts just launch into them. Subnets are org-only.",
        "<strong>Centralised interface endpoints</strong>: one set in a hub VPC, reached via Transit Gateway, with private hosted zones for DNS.",
        "The four SAP names: <strong>subnets, Transit Gateway, Route 53 Resolver rules, License Manager configs</strong>."
      ],
      analogy: "VPC sharing is like renting desks in a shared office. The building owner controls the walls, doors and wiring; tenants bring their own laptops (instances) and pay for them, but can't move the walls.",
      examTip: "“Share the Transit Gateway with all current and future accounts without accepting invitations” = enable RAM org sharing and <strong>share to the OU</strong>. “App teams use central networking without managing VPCs” = <strong>VPC sharing</strong>, not a peering mesh.",
      terms: [
        { t: "RAM", d: "Resource Access Manager: shares resources across accounts. Free; you pay for the resources." },
        { t: "Shared VPC", d: "A VPC owned by one account whose subnets other accounts launch into." },
        { t: "Participant", d: "An account using a shared subnet. It owns its instances and security groups, not the network." },
        { t: "Private hosted zone (PHZ)", d: "Private DNS zone attached to VPCs; used to point service names at central endpoints." },
        { t: "AZ ID", d: "Real zone ID like use1-az1. AZ names are shuffled per account, IDs are not." }
      ],
      check: [
        {
          q: "In a shared VPC, what can a participant account change?",
          options: ["The route tables", "Its own security groups and instances", "The subnet NACLs"],
          answer: 1,
          why: "The owner controls routes, NACLs and the VPC itself. Participants only manage what they launch and their own security groups."
        },
        {
          q: "Fifty accounts each pay for the same interface endpoints. What's the usual cost fix?",
          options: ["One set of endpoints in a hub VPC, reached over Transit Gateway with private hosted zones", "VPC peering between all fifty VPCs", "Public endpoints with IAM policies"],
          answer: 0,
          why: "Central endpoints plus DNS tricks let every spoke reuse one set. A peering mesh of fifty VPCs is unmanageable."
        }
      ]
    },
    "centralized-security-logging": {
      minutes: 5,
      tldr: [
        "One <strong>organization trail</strong> logs every account (even future ones) into the Log Archive bucket; members can't stop it.",
        "Broken delivery is almost always the <strong>bucket policy</strong> or <strong>KMS key policy</strong> missing the CloudTrail service principal.",
        "Security services pattern: <strong>delegated admin + auto-enable + aggregation</strong> (Security Hub cross-region aggregator).",
        "<strong>StackSets, service-managed</strong>: target OUs, and new accounts get the stack automatically.",
        "Roll out StackSets like a canary: low concurrency, zero failure tolerance, then widen."
      ],
      analogy: "An organization trail is a CCTV system wired into every shop in a mall, recording to a locked room at head office. Shop managers can see their camera exists, but they can't switch it off or wipe the tapes.",
      examTip: "“GuardDuty in every current and future account” = delegated admin + <strong>auto-enable</strong>, not StackSets or scripts. “Every new account gets baseline roles automatically” = <strong>service-managed StackSet with auto-deployment</strong>.",
      terms: [
        { t: "Organization trail", d: "One CloudTrail that covers all accounts in the org, managed centrally." },
        { t: "Auto-enable", d: "Security service setting that turns the service on in every new account." },
        { t: "Security Hub aggregator", d: "Pulls findings from all regions into one home region." },
        { t: "StackSet", d: "Deploys one CloudFormation template to many accounts and regions." },
        { t: "Service-managed permissions", d: "StackSet mode using Organizations; targets OUs and auto-deploys to new accounts." }
      ],
      check: [
        {
          q: "An org trail uses a customer-managed KMS key and logs stop arriving. Most likely cause?",
          options: ["The key policy doesn't let CloudTrail call GenerateDataKey", "Member accounts disabled the trail", "S3 versioning is off"],
          answer: 0,
          why: "Encrypted delivery needs the key policy to allow CloudTrail's service principal. Members can't disable an org trail."
        },
        {
          q: "Which StackSet setup automatically deploys to accounts that join an OU later?",
          options: ["Self-managed permissions with an account list", "Service-managed permissions targeting the OU with auto-deployment", "A StackSet in each member account"],
          answer: 1,
          why: "Only service-managed StackSets can target OUs and auto-deploy. Self-managed ones use fixed account lists."
        }
      ]
    },
    "org-operations": {
      minutes: 6,
      tldr: [
        "New accounts start at default quotas; a <strong>quota request template</strong> files increases automatically when accounts are created.",
        "<strong>Tag policies</strong> make tag <em>values</em> correct; an <strong>SCP</strong> with aws:RequestTag makes tags <em>exist</em>.",
        "<strong>Backup policies</strong> push AWS Backup plans org-wide; add <strong>Vault Lock</strong> so nobody can delete backups.",
        "Close accounts from the management account; they stay <strong>SUSPENDED 90 days</strong> and can be reopened in that window.",
        "You can close only <strong>10% of member accounts per rolling 30 days</strong>. Quarantine first (the “scream test”)."
      ],
      analogy: "Decommissioning is like moving out of a flat: first you stop using it and see who complains (quarantine), then you hand back the keys (close), and the landlord keeps it empty 90 days in case you left something important.",
      examTip: "The classic split: “consistent tag values” = <strong>tag policy with enforcement</strong>; “tag must exist at creation” = <strong>SCP</strong>. “Backups admins can't delete” = <strong>Backup Vault Lock</strong> + backup policies.",
      terms: [
        { t: "Quota request template", d: "Preset quota increases that new org accounts request automatically at creation." },
        { t: "Tag policy", d: "Org policy defining allowed tag keys, capitalisation and values." },
        { t: "Backup policy", d: "Org policy that creates AWS Backup plans in member accounts." },
        { t: "Vault Lock", d: "WORM lock on a backup vault; in compliance mode even root can't shorten retention." },
        { t: "Post-closure period", d: "The 90 days a closed account stays SUSPENDED and can still be reopened." }
      ],
      check: [
        {
          q: "Every EC2 instance must have a cost-center tag at launch. What enforces that the tag exists?",
          options: ["A tag policy in enforcement mode", "An SCP denying RunInstances when aws:RequestTag/cost-center is null", "A Config rule"],
          answer: 1,
          why: "Tag policies only reject wrong values; they don't require presence. The SCP blocks creation without the tag. A Config rule only detects afterwards."
        },
        {
          q: "After a divestiture you must close 300 of your 1,000 accounts. What limits how fast?",
          options: ["Only 10% of member accounts can be closed per rolling 30 days", "Each account needs its root password", "Accounts must be empty first"],
          answer: 0,
          why: "The closure quota is 10% per 30 days, so plan it over months. Closing is done centrally, no root logins needed."
        }
      ]
    }
  }
});
