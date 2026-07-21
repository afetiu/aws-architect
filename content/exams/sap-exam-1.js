/* SAP-C02 Practice Exam 1 — 50 questions.
 * Domain distribution:
 *   Design Solutions for Organizational Complexity  — 13
 *   Design for New Solutions                        — 15
 *   Continuous Improvement for Existing Solutions   — 12
 *   Accelerate Workload Migration and Modernization — 10
 */
window.COURSE.registerExam({
  id: "sap-1",
  track: "sap",
  title: "SAP-C02 Practice Exam 1",
  timeMinutes: 120,
  questions: [

    /* ============================================================
     * Domain 1: Design Solutions for Organizational Complexity (13)
     * ============================================================ */

    {
      q: "A financial services company runs 60 AWS accounts in an organization managed with AWS Organizations. A new compliance mandate requires that all workloads run only in eu-central-1 and eu-west-1, although teams must still use global services such as IAM, CloudFront, and Route 53. Several account administrators hold AdministratorAccess in their own accounts, and the security team has already found EC2 instances running in us-east-1. The security team must enforce the regional restriction across all existing and future accounts with the LEAST ongoing administrative effort. Which solution meets these requirements?",
      options: [
        "Create an SCP that grants permissions for services in eu-central-1 and eu-west-1 only and attach it to the organization root so that member accounts automatically receive the required regional permissions.",
        "Create an SCP with a Deny statement that uses the aws:RequestedRegion condition key to block all regions except eu-central-1 and eu-west-1, exclude global service actions from the statement, and attach the SCP to the organization root.",
        "Attach an IAM permissions boundary that restricts the allowed regions to every IAM role and user in each member account, and require account administrators to apply the boundary to any new principals they create.",
        "Deploy an AWS Config rule with an automatic remediation action to every account that detects resources created outside the approved regions and terminates them within 15 minutes."
      ],
      answer: [1],
      multi: false,
      domain: "Design Solutions for Organizational Complexity",
      explanation: `<p><strong>B</strong> is correct. A deny-based SCP using <code>aws:RequestedRegion</code> attached at the root applies to every existing and future account, cannot be overridden by account administrators (SCPs bound even principals with AdministratorAccess), and requires no per-account maintenance. Exempting global services such as IAM, CloudFront, Route 53, and STS is essential because their API calls resolve to us-east-1 and would otherwise be blocked.</p><p><strong>A</strong> fails on a fundamental point: SCPs never grant permissions. They only filter the maximum available permissions; an "allow" SCP without a corresponding deny does not stop the other regions unless it replaces the default FullAWSAccess policy, and the option describes granting, which SCPs cannot do.</p><p><strong>C</strong> does not scale and is not enforceable: account administrators can create principals without the boundary or detach it, so it relies on the very people it must constrain.</p><p><strong>D</strong> is detective, not preventive. Resources run (and incur compliance exposure) before remediation fires, which violates the intent of the mandate.</p>`
    },

    {
      q: "A company has 40 spoke VPCs attached to an AWS Transit Gateway. All outbound internet traffic must pass through a fleet of third-party firewall appliances that perform deep packet inspection. The appliances run in multiple Availability Zones behind a Gateway Load Balancer in a dedicated inspection VPC that is attached to the Transit Gateway. Users report intermittent connection resets, and packet captures show that return traffic sometimes arrives at a different firewall appliance than the one that processed the outbound packet, causing the stateful appliances to drop the flow. Which change resolves the issue?",
      options: [
        "Enable equal-cost multipath routing on the Transit Gateway route tables so that flows are hashed consistently across the inspection VPC attachments.",
        "Replace the Gateway Load Balancer with a Network Load Balancer configured with sticky sessions so that flows return to the same appliance.",
        "Enable appliance mode on the Transit Gateway attachment for the inspection VPC so that both directions of a flow are routed through the same Availability Zone for the life of the flow.",
        "Enable cross-zone load balancing on the Gateway Load Balancer and deploy at least one firewall appliance in every Availability Zone used by the spoke VPCs."
      ],
      answer: [2],
      multi: false,
      domain: "Design Solutions for Organizational Complexity",
      explanation: `<p><strong>C</strong> is correct. By default, a Transit Gateway keeps traffic in the same Availability Zone in which it arrived, which means the forward and return legs of a flow between two spokes (or to the internet) can enter the inspection VPC in different AZs and reach different stateful appliances. Enabling appliance mode on the inspection VPC attachment makes the Transit Gateway use a flow hash to pin both directions of a flow to the same AZ, preserving symmetry for stateful inspection.</p><p><strong>A</strong> is a near-miss: ECMP applies to VPN and Connect attachments for bandwidth aggregation and does nothing to guarantee bidirectional AZ symmetry through a VPC attachment.</p><p><strong>B</strong> misunderstands GWLB: it operates at layer 3 with GENEVE encapsulation and already maintains flow stickiness to an appliance; the asymmetry is introduced by the Transit Gateway before traffic reaches the load balancer, so swapping the load balancer type does not help and breaks the appliance integration.</p><p><strong>D</strong> adds capacity and cost but does not change the AZ-asymmetric routing behavior that causes the resets.</p>`
    },

    {
      q: "A payments processor connects two on-premises data centers to AWS to reach workloads in a shared services VPC. The connectivity carries settlement traffic that is subject to a 99.99 percent availability requirement, and the architecture must tolerate the failure of an entire Direct Connect location as well as the failure of any single device. The company also wants the design to qualify for the corresponding AWS Direct Connect SLA tier. Which connectivity design meets these requirements?",
      options: [
        "Provision two Direct Connect connections at each of two different Direct Connect locations, terminating on separate devices in each location, and advertise routes over BGP across all four connections.",
        "Provision two Direct Connect connections at a single Direct Connect location, terminating on separate devices, and add a Site-to-Site VPN as a backup path.",
        "Provision one Direct Connect connection and configure a Site-to-Site VPN over the internet as a failover path with BGP prepending to prefer the Direct Connect path.",
        "Provision one Direct Connect connection at each of two different Direct Connect locations and rely on BGP failover between the two connections."
      ],
      answer: [0],
      multi: false,
      domain: "Design Solutions for Organizational Complexity",
      explanation: `<p><strong>A</strong> is correct. This is the AWS maximum resiliency model for Direct Connect: two locations protect against a facility-level failure, and two connections on separate devices within each location protect against device and cable failure. Four connections across two locations is the architecture AWS requires for the 99.99 percent Direct Connect SLA tier.</p><p><strong>B</strong> survives device failure but not the loss of the entire location; a VPN backup changes the bandwidth and latency characteristics and does not qualify the design for the 99.99 percent Direct Connect SLA.</p><p><strong>C</strong> is the development/test resiliency pattern. A single connection with internet VPN failover cannot meet a 99.99 percent commitment for dedicated connectivity, and VPN throughput per tunnel is limited (roughly 1.25 Gbps), which risks congestion for settlement traffic.</p><p><strong>D</strong> is the high resiliency model, which targets 99.9 percent: it tolerates a location failure but a single device failure in the surviving location during a maintenance or fault window leaves no redundancy, so it misses the stated requirement.</p>`
    },

    {
      q: "A company uses a multi-account architecture with a central networking account. Spoke VPCs in 30 accounts connect through a Transit Gateway, and a Direct Connect link reaches the on-premises data center, where Active Directory DNS servers are authoritative for corp.example.com. Workloads in every spoke VPC must resolve corp.example.com hostnames, and on-premises servers must resolve records in the private hosted zones associated with the spoke VPCs. The solution must avoid deploying DNS infrastructure into each spoke account. Which approach meets these requirements?",
      options: [
        "Configure the on-premises DNS servers with conditional forwarders that target the VPC-provided resolver address (the VPC CIDR plus two) in the networking account over Direct Connect, and set spoke VPC DHCP option sets to the on-premises DNS servers.",
        "Create Route 53 Resolver inbound and outbound endpoints in every spoke VPC, and configure forwarding rules in each account for corp.example.com.",
        "Create a Route 53 public hosted zone for corp.example.com, import the on-premises records, and let both environments resolve it over the internet.",
        "Deploy Route 53 Resolver inbound and outbound endpoints in the networking account VPC, create a resolver rule that forwards corp.example.com to the on-premises DNS servers, share the rule with all accounts by using AWS RAM, associate it with the spoke VPCs, and point on-premises conditional forwarders at the inbound endpoint IP addresses."
      ],
      answer: [3],
      multi: false,
      domain: "Design Solutions for Organizational Complexity",
      explanation: `<p><strong>D</strong> is the canonical hub-and-spoke hybrid DNS design. Outbound endpoints plus a shared resolver rule let every spoke VPC forward corp.example.com queries through the central VPC to on-premises DNS; RAM sharing means the rule is created once and merely associated in each spoke. The inbound endpoint gives on-premises servers routable IP targets that resolve any private hosted zone associated with the resolver's VPC (associate the spoke zones or centralize them), satisfying both directions with DNS infrastructure only in the networking account.</p><p><strong>A</strong> contains the classic trap: the VPC-provided resolver at CIDR plus two is not reachable from outside the VPC, so on-premises forwarders cannot target it over Direct Connect; an inbound endpoint exists precisely to solve this.</p><p><strong>B</strong> works but violates the requirement to avoid per-spoke DNS infrastructure and multiplies endpoint cost by 30 accounts.</p><p><strong>C</strong> exposes internal names publicly, breaks split-horizon behavior, and is unacceptable for a corporate zone.</p>`
    },

    {
      q: "An enterprise with 40 AWS accounts in AWS Organizations currently manages workforce access with individual IAM users in each account. The identity team already operates an external SAML 2.0 identity provider with SCIM support and enforces MFA and joiner-mover-leaver processes there. Auditors require that all human access to AWS be tied to the corporate identity lifecycle, that permissions be assigned consistently by job function across accounts, and that engineers get short-lived credentials for CLI access. Which solution meets these requirements with the LEAST operational overhead?",
      options: [
        "Standardize IAM users in every account with a strong password policy, access key rotation enforced by AWS Config, and MFA required through an IAM policy condition.",
        "Enable AWS IAM Identity Center for the organization, connect it to the external identity provider by using SAML with SCIM-based automatic provisioning, and assign job-function permission sets to groups across the member accounts.",
        "Configure a separate SAML identity provider trust and matching IAM roles in each of the 40 accounts, and have users federate directly into each account.",
        "Create an identity broker account with cross-account IAM roles into all other accounts, create IAM users only in the broker account, and have engineers run scripts that assume roles to obtain temporary credentials."
      ],
      answer: [1],
      multi: false,
      domain: "Design Solutions for Organizational Complexity",
      explanation: `<p><strong>B</strong> is correct. IAM Identity Center is the organization-wide federation layer: one SAML connection to the existing IdP, SCIM keeps users and groups synchronized with the corporate lifecycle automatically (leavers lose access when deprovisioned upstream), permission sets provide consistent job-function roles that Identity Center materializes into every targeted account, and the AWS CLI integration issues short-lived credentials natively.</p><p><strong>A</strong> fails the audit requirement outright: IAM users are long-lived credentials disconnected from the corporate identity lifecycle, and 40 accounts of user management is maximal overhead.</p><p><strong>C</strong> is functionally viable but is exactly what Identity Center abstracts away: 40 IdP trusts, 40 sets of roles, and 40 places to update when a job function changes. It is the high-overhead near-miss.</p><p><strong>D</strong> still anchors identity in IAM users, so lifecycle events require separate offboarding in AWS, custom scripts become critical security infrastructure, and auditors again find credentials outside the IdP.</p>`
    },

    {
      q: "A company's central network team must control IP allocation, route tables, internet gateways, and firewall placement for all application environments, while 25 application teams in separate accounts need to launch EC2 instances, load balancers, and RDS databases themselves without waiting on the network team. The company wants to prevent application teams from creating or modifying any networking constructs, and wants to avoid managing dozens of interconnected VPCs. Which approach satisfies these requirements?",
      options: [
        "Create centrally designed VPCs in the network account and use AWS Resource Access Manager to share the application subnets with the application accounts' OUs, so teams deploy resources into shared subnets while the network account retains ownership of route tables, gateways, and NACLs.",
        "Let each application team create its own VPC from an approved CloudFormation template and connect all VPCs with VPC peering managed by the network team.",
        "Create one VPC per application account with AWS Transit Gateway attachments, and use SCPs to deny route table modifications in the application accounts.",
        "Provision all application resources centrally in the network account and grant application teams cross-account IAM roles with permissions scoped to their own resources by tags."
      ],
      answer: [0],
      multi: false,
      domain: "Design Solutions for Organizational Complexity",
      explanation: `<p><strong>A</strong> is the VPC sharing pattern built for exactly this split of responsibilities. RAM-shared subnets let participant accounts launch EC2, ELB, and RDS resources inside subnets they do not own, while route tables, IGWs, NAT gateways, and NACLs remain exclusively controllable by the owning network account. Sharing with OUs means new application accounts inherit access automatically, and the total VPC count stays small.</p><p><strong>B</strong> leaves each team owning a full VPC (so they can modify routing within it), and peering at 25-plus VPCs produces a mesh the question explicitly wants to avoid.</p><p><strong>C</strong> still creates a VPC per account and relies on SCPs to deny networking actions; deny lists for every networking API are brittle, and teams still own the constructs, which violates the control requirement.</p><p><strong>D</strong> inverts the operating model: the network account would host all workloads, concentrating blast radius and quota pressure in one account, and tag-scoped cross-account administration of compute is significantly more overhead than subnet sharing.</p>`
    },

    {
      q: "A regulated healthcare company must retain API audit logs from all 75 accounts in its organization for 7 years. Logs must be tamper-proof even against a compromised member-account administrator or an accidental deletion by the logging team, and any account created in the future must be covered automatically without additional configuration. The compliance team wants the MOST operationally efficient design. Which solution should the architect recommend?",
      options: [
        "Use CloudFormation StackSets to deploy an individual CloudTrail trail in every account that delivers to a central S3 bucket, and rerun the StackSet whenever new accounts join.",
        "Create a CloudTrail trail in each account that delivers to CloudWatch Logs with a 7-year retention policy on the log groups.",
        "Create an organization trail in the management account (or a delegated administrator account) that delivers to a central S3 bucket configured with S3 Object Lock in compliance mode and a 7-year retention period, with lifecycle transitions to Glacier storage classes.",
        "Create an organization trail that delivers to a central S3 bucket with versioning and MFA delete enabled, and restrict deletion through a bucket policy."
      ],
      answer: [2],
      multi: false,
      domain: "Design Solutions for Organizational Complexity",
      explanation: `<p><strong>C</strong> combines the two required properties. An organization trail automatically logs every existing and future member account with a single resource to manage, and member-account administrators cannot modify or stop it. S3 Object Lock in compliance mode is the only listed control that makes objects undeletable and unmodifiable by any identity, including the root user of the bucket-owning account, until retention expires, which is the correct interpretation of tamper-proof for a 7-year regulatory mandate. Lifecycle tiering to Glacier keeps 7 years of storage economical.</p><p><strong>A</strong> covers the accounts but is the operational anti-pattern the question screens for: 75 trails to monitor, StackSet reruns for new accounts (or auto-deployment configuration to maintain), and per-account trail tampering surface.</p><p><strong>B</strong> leaves each trail under member-account control and CloudWatch Logs retention is a deletable setting, not an immutability control, and is costly at 7-year scale.</p><p><strong>D</strong> is the near-miss: versioning plus MFA delete deters but does not prevent deletion; a privileged principal in the bucket account can still remove versions or the bucket policy. Only compliance-mode Object Lock guarantees immutability.</p>`
    },

    {
      q: "A media company's organization has 55 accounts under consolidated billing. Engineering workloads run a stable baseline of compute that shifts among EC2 instance families, Fargate tasks, and Lambda as teams modernize. Finance wants to maximize the discount on the stable baseline, keep the commitment management centralized in one place, and ensure that unused commitment from one business unit's account automatically benefits others. Which purchasing strategy meets these goals?",
      options: [
        "Have each member account purchase Compute Savings Plans sized to its own baseline so that commitments follow the workloads.",
        "Purchase EC2 Instance Savings Plans in the management account for the instance families currently in use across the organization.",
        "Purchase zonal Reserved Instances in the management account for capacity assurance and discounts across member accounts.",
        "Purchase a Compute Savings Plan in the management account with discount sharing enabled, sized to the organization-wide stable baseline of compute spend."
      ],
      answer: [3],
      multi: false,
      domain: "Design Solutions for Organizational Complexity",
      explanation: `<p><strong>D</strong> is correct. A Compute Savings Plan applies to EC2 usage regardless of family, size, region, OS, or tenancy, and also to Fargate and Lambda, which matches a baseline that migrates between those services. Purchasing in the management account with discount sharing enabled means the commitment first applies to the owning account and then floats automatically to eligible usage in any member account, satisfying centralized management and cross-account benefit in one instrument.</p><p><strong>A</strong> fragments the commitment: per-account plans still share under consolidated billing, but sizing and renewing 55 separate plans maximizes administrative burden and stranded commitment risk, the opposite of the stated goal.</p><p><strong>B</strong> offers a deeper discount rate but locks each plan to one instance family in one region, so the discount evaporates as teams shift families or move work to Fargate and Lambda.</p><p><strong>C</strong> is a near-miss on mechanics: zonal RIs provide capacity reservation but no size flexibility, and their discount applies only within a specific AZ, making them the wrong tool for a flexible, org-wide baseline.</p>`
    },

    {
      q: "An enterprise already operates an AWS organization with 80 accounts grouped into OUs by business unit, along with hand-built SCPs and IAM baselines of varying quality. Leadership wants a governed landing zone with preventive and detective controls, standardized network and logging baselines, drift detection, and a self-service mechanism for provisioning new accounts that are compliant on day one. The team must avoid recreating existing accounts. What is the MOST efficient way to achieve this?",
      options: [
        "Build a custom landing zone with CloudFormation StackSets, AWS Config conformance packs, and hand-authored SCPs, and write a Step Functions workflow for account vending.",
        "Enable AWS Control Tower in the existing organization's management account, register the existing OUs to bring current accounts under governance, enable the desired preventive and detective controls, and use Account Factory for new account provisioning.",
        "Create a new organization with AWS Control Tower, then migrate all 80 accounts by removing them from the old organization and inviting them into the new one.",
        "Deploy AWS Config conformance packs and Security Hub standards to all accounts, and continue creating accounts manually with a documented checklist."
      ],
      answer: [1],
      multi: false,
      domain: "Design Solutions for Organizational Complexity",
      explanation: `<p><strong>B</strong> is correct. Control Tower can be enabled in an existing organization, and registering existing OUs enrolls their accounts under governance without recreating anything: enrollment deploys the baseline (CloudTrail, Config, IAM roles) and applies the controls. Preventive controls are implemented as SCPs, detective controls as Config rules, drift detection is built in, and Account Factory delivers compliant self-service account vending. This replaces the inconsistent hand-built baselines with managed ones at minimal effort.</p><p><strong>A</strong> is building Control Tower yourself: months of engineering to reach feature parity on vending, drift detection, and control management, which fails the efficiency test.</p><p><strong>C</strong> is the trap for candidates who believe Control Tower requires a fresh organization; migrating 80 accounts breaks consolidated billing history, RI and Savings Plan sharing, SCP inheritance, and every account's trust relationships for no benefit.</p><p><strong>D</strong> provides only detective coverage, no preventive guardrails, no standardized vending, and keeps the manual account process the question is trying to eliminate.</p>`
    },

    {
      q: "A security account owns an S3 bucket that stores shared compliance artifacts, encrypted with a customer managed KMS key in the same account. Application roles in 20 member accounts of the same organization must upload and download objects. The bucket policy already grants the required S3 actions to the member account roles, but all GetObject and PutObject calls fail with KMS access denied errors. What must the architect change so that access works, following least privilege?",
      options: [
        "Update the KMS key policy in the security account to allow the member account application roles to use the key for the required cryptographic operations, and ensure each application role's IAM policy also allows those KMS actions on that key's ARN.",
        "Attach IAM policies to the application roles in each member account granting kms:Decrypt and kms:GenerateDataKey on the key ARN; no change to the key policy is needed because the accounts are in the same organization.",
        "Re-encrypt the bucket with the AWS managed key for S3 (aws/s3), which automatically allows cross-account use through the bucket policy.",
        "Create a copy of the KMS key in every member account and configure S3 replication to re-encrypt objects for each consuming account."
      ],
      answer: [0],
      multi: false,
      domain: "Design Solutions for Organizational Complexity",
      explanation: `<p><strong>A</strong> is correct. Cross-account access to a KMS key requires permission on both sides: the key policy in the owning account must allow the external principals (or their account, delegating to IAM), and the calling principals' IAM policies must allow the KMS actions on the key ARN. With SSE-KMS, S3 permissions alone are never sufficient, hence the KMS access denied errors despite a correct bucket policy. Scoping the key policy to the specific application roles and the required operations (Decrypt, GenerateDataKey) satisfies least privilege.</p><p><strong>B</strong> is the classic half-answer: IAM policies in the member accounts cannot grant access to another account's key. Organization membership does not create implicit KMS trust; without the key policy change the calls still fail.</p><p><strong>C</strong> is impossible by design: AWS managed keys have unmodifiable key policies and cannot be used by principals outside the key's own account, so this breaks cross-account access entirely.</p><p><strong>D</strong> abandons the requirement, multiplies key management 20-fold, and S3 replication is for buckets, not a mechanism for per-consumer re-encryption of a shared bucket.</p>`
    },

    {
      q: "A network team runs a shared services VPC connected to 30 spoke VPCs in other accounts through a Transit Gateway. To cut the cost of deploying VPC interface endpoints in every spoke, the team wants to centralize interface endpoints for services such as SQS, Secrets Manager, and ECR in the shared services VPC. Workloads in the spokes must keep using the default AWS service DNS names with no application changes. Which combination of steps will accomplish this? (Select TWO.)",
      options: [
        "Enable private DNS on each interface endpoint in the shared services VPC so that all connected spoke VPCs automatically resolve the service names to the endpoint.",
        "Create the interface endpoints in the shared services VPC with the private DNS option disabled.",
        "Share the interface endpoints with the spoke accounts by using AWS Resource Access Manager.",
        "For each service, create a private hosted zone named after the service's regional DNS name containing an alias record that targets the interface endpoint, and associate that private hosted zone with every spoke VPC.",
        "Create interface endpoints in each spoke VPC and configure Transit Gateway routes so that endpoint traffic transits the shared services VPC."
      ],
      answer: [1, 3],
      multi: true,
      domain: "Design Solutions for Organizational Complexity",
      explanation: `<p><strong>B</strong> and <strong>D</strong> together form the centralized endpoint pattern. Private DNS must be disabled on the endpoints (<strong>B</strong>) because the AWS-managed private DNS only creates records in the endpoint's own VPC and conflicts with the manually managed zone. You then recreate the service's default DNS name yourself (<strong>D</strong>): a private hosted zone per service (for example, sqs.eu-west-1.amazonaws.com) with an alias to the endpoint ENIs, associated with every spoke VPC, so unmodified applications resolve the standard name to the central endpoint and reach it over the Transit Gateway.</p><p><strong>A</strong> is the trap: enabling private DNS resolves the name only inside the shared services VPC; spokes are unaffected, and it also blocks creating the identically named private hosted zone.</p><p><strong>C</strong> is not possible; interface endpoints are not a RAM-shareable resource type.</p><p><strong>E</strong> defeats the purpose entirely by paying for endpoints in all 30 spokes, which is the cost problem the design is meant to remove.</p>`
    },

    {
      q: "A company's security operations team works from a dedicated security tooling account. The CISO requires that Amazon GuardDuty and AWS Security Hub be active in every existing account and every account that will ever be added to the organization, with all findings visible to the security team in one place, and with no per-account manual enablement work going forward. Which combination of actions meets these requirements? (Select TWO.)",
      options: [
        "From the organization's management account, designate the security tooling account as the delegated administrator for GuardDuty and for Security Hub.",
        "In the delegated administrator account, configure GuardDuty and Security Hub to automatically enable for all existing member accounts and for new accounts that join the organization.",
        "Enable GuardDuty and Security Hub individually in every member account and configure cross-account IAM roles so the security team can sign in to each account to review findings.",
        "Configure every member account to export findings to an S3 bucket and build a Lambda pipeline that aggregates the objects into the security tooling account.",
        "Use the organization's management account as the GuardDuty and Security Hub administrator account to avoid the delegation step."
      ],
      answer: [0, 1],
      multi: true,
      domain: "Design Solutions for Organizational Complexity",
      explanation: `<p><strong>A</strong> and <strong>B</strong> are the two required steps. Delegated administration (<strong>A</strong>) is performed once from the management account and makes the security tooling account the org-wide administrator for each service, aggregating all findings there. Auto-enablement (<strong>B</strong>) is the setting that turns both services on across current members and, critically, for any account that joins later, which is what eliminates per-account work permanently.</p><p><strong>C</strong> technically produces coverage but is the manual anti-pattern: per-account enablement, no automatic coverage of new accounts, and role-switching into dozens of accounts instead of a single aggregated view.</p><p><strong>D</strong> rebuilds native aggregation with custom plumbing that must be deployed to every account, adding failure modes and still not enabling the services anywhere.</p><p><strong>E</strong> works mechanically but violates the well-architected guidance the exam tests: the management account should be kept minimal-use, and day-to-day security operations belong in a delegated member account.</p>`
    },

    {
      q: "During an incident review, a company discovered that an administrator in a workload account had stopped the organization's CloudTrail logging in that account by deleting a member-account trail, and another team had modified the incident-response IAM roles that the security team deploys to every account under the path /security/. The security team must ensure that no principal in any workload account, including full administrators, can disable audit logging or modify the security team's roles, while day-to-day administration remains otherwise unaffected. What should the architect implement?",
      options: [
        "Attach an IAM deny policy to every administrator user and role in the workload accounts that blocks CloudTrail write actions and modifications to the /security/ roles.",
        "Apply permissions boundaries to all IAM roles in the workload accounts that exclude CloudTrail write actions and IAM write actions on the /security/ path.",
        "Attach an SCP to the workload OUs that denies cloudtrail:StopLogging, cloudtrail:DeleteTrail, and cloudtrail:UpdateTrail, and denies IAM write actions on resources matching the /security/ role path unless the request is made by the security team's automation role.",
        "Create an AWS Config rule with an automatic remediation runbook that re-enables CloudTrail logging and restores the security roles from a template whenever a change is detected."
      ],
      answer: [2],
      multi: false,
      domain: "Design Solutions for Organizational Complexity",
      explanation: `<p><strong>C</strong> is correct. SCPs are the only guardrail in the list that binds every principal in a member account, including administrators and any new roles they create, and that cannot be removed from inside the account. A deny on the specific CloudTrail write actions and on IAM writes to the /security/ path (with a condition exempting the security automation role, typically via aws:PrincipalArn) surgically protects the controls while leaving all other administration untouched.</p><p><strong>A</strong> fails because administrators can detach or edit IAM policies applied to themselves, and the policy must be attached to every current and future principal, which is unenforceable.</p><p><strong>B</strong> has the same flaw one level up: permissions boundaries only constrain principals they are attached to, and nothing stops an administrator from creating a role without the boundary or removing it, unless an SCP enforces boundary usage, which circles back to needing an SCP.</p><p><strong>D</strong> is detective with a remediation window; logging is down between the change and the remediation, which is precisely the gap attackers exploit and the requirement forbids.</p>`
    },

    /* ============================================================
     * Domain 2: Design for New Solutions (15)
     * ============================================================ */

    {
      q: "A company is building a new payment authorization service that will run in us-east-1 with disaster recovery in us-west-2. The business requires an RTO of 15 minutes and an RPO of less than 1 minute, and the CFO has rejected running two full-capacity production environments. The application tier is stateless behind an Application Load Balancer, and the data tier will be a relational database. Which architecture is the MOST cost-effective option that meets the recovery objectives?",
      options: [
        "Take automated database snapshots every hour, copy them to us-west-2, and use CloudFormation to build the full stack in us-west-2 when a disaster is declared.",
        "Run a full-capacity active-active deployment in both regions with the data tier converted to DynamoDB global tables and Route 53 latency-based routing.",
        "Deploy a warm standby in us-west-2 with the application tier running at reduced capacity behind its own load balancer, use an Aurora global database with a secondary cluster in us-west-2, and use Route 53 failover routing with health checks; during failover, promote the secondary cluster and scale out the standby Auto Scaling group.",
        "Enable RDS cross-region automated backup replication to us-west-2 and pre-create AMIs there, restoring the database and launching instances from a runbook during a disaster."
      ],
      answer: [2],
      multi: false,
      domain: "Design for New Solutions",
      explanation: `<p><strong>C</strong> is correct. Aurora Global Database replicates with typical sub-second lag, satisfying the sub-minute RPO, and secondary cluster promotion completes in well under 15 minutes. A warm standby keeps a scaled-down but functional copy of the stateless tier running, so failover is a DNS shift plus scale-out, comfortably inside the RTO, at a fraction of active-active cost, which addresses the CFO's constraint.</p><p><strong>A</strong> is backup-and-restore: hourly snapshots give an RPO of up to an hour, and provisioning an entire stack from scratch typically exceeds a 15-minute RTO. It is the cheapest option but fails both objectives.</p><p><strong>B</strong> meets the objectives easily but is explicitly over-engineered for the requirement: double full-capacity cost was rejected, and swapping the relational data model for DynamoDB is an unrequested rearchitecture.</p><p><strong>D</strong> improves backup durability, not recovery speed: restoring a database from replicated backups plus launching from AMIs via a runbook puts RTO in the hours range and RPO well beyond one minute.</p>`
    },

    {
      q: "A company runs its order database on an Aurora PostgreSQL global database with the primary cluster in eu-west-1 and a secondary cluster in eu-central-1. Regulators require a full regional failover exercise every quarter with zero data loss, and after each exercise the database must end up protected by cross-region replication again without rebuilding clusters. Which failover approach should the architect choose for these exercises?",
      options: [
        "Detach the secondary cluster from the global database, promote it to a standalone cluster, run the exercise, then create a new global database and add the former primary region back as a secondary.",
        "Use the Aurora global database managed switchover, which waits for the secondary to catch up before promoting it with an RPO of zero and automatically reverses the replication direction so the former primary becomes the new secondary.",
        "Restore the latest automated snapshot into eu-central-1 before each exercise and point the application at the restored cluster.",
        "Replace the global database with an RDS for PostgreSQL cross-region read replica and promote the replica during each exercise."
      ],
      answer: [1],
      multi: false,
      domain: "Design for New Solutions",
      explanation: `<p><strong>B</strong> is correct. Managed switchover (previously called managed planned failover) is purpose-built for DR drills on a healthy global database: it blocks writes briefly, waits for the secondary to fully synchronize (guaranteeing RPO zero), promotes it, and automatically re-establishes replication in the opposite direction. The topology heals itself, so no clusters are rebuilt, exactly matching the quarterly requirement.</p><p><strong>A</strong> is the near-miss the exam loves: detach-and-promote is the mechanism for an actual regional outage, but it severs the global database, and returning to a protected state requires manually recreating the global topology after every exercise, which the requirement explicitly rules out.</p><p><strong>C</strong> does not exercise failover at all; a snapshot restore tests backups, has a nonzero RPO relative to live writes, and produces an orphaned cluster.</p><p><strong>D</strong> is a downgrade: promoting a cross-region read replica is asynchronous (nonzero RPO), one-directional, and the replica relationship must be rebuilt from scratch after every promotion.</p>`
    },

    {
      q: "A startup is designing a new session and profile service for a consumer app with users concentrated in North America, Europe, and Asia. Requirements state that reads and writes must complete with single-digit millisecond latency from the user's nearest region, the service must continue accepting writes in the surviving regions if an entire region becomes unavailable, and the team of four engineers cannot operate database infrastructure. Which design meets these requirements?",
      options: [
        "Use an Amazon DynamoDB global table replicated across the three regions, deploy the stateless API in all three regions, and use Route 53 latency-based routing with health checks to direct users to the nearest healthy region.",
        "Deploy DynamoDB in us-east-1 with DAX clusters in all three regions to cache reads close to users.",
        "Use an Aurora MySQL global database with write forwarding enabled so that all three regions can accept writes through their local endpoints.",
        "Replicate a regional DynamoDB table to the other regions with DynamoDB Streams and Lambda functions that apply changes to the peer tables."
      ],
      answer: [0],
      multi: false,
      domain: "Design for New Solutions",
      explanation: `<p><strong>A</strong> is correct. Global tables provide fully managed multi-active replication: every replica accepts local writes with single-digit millisecond latency, and if a region fails, the other replicas keep serving reads and writes; latency-based routing with health checks moves users automatically. The team operates no database infrastructure. The known trade-off, worth noting, is last-writer-wins conflict resolution, acceptable for session and profile data.</p><p><strong>B</strong> fails the write requirement twice: DAX accelerates reads only, and all writes still traverse to us-east-1, so far users see high write latency and a us-east-1 outage stops writes globally.</p><p><strong>C</strong> is the subtle distractor: write forwarding gives regions a local write endpoint, but forwarded writes still commit on the single primary region, so write latency is not single-digit milliseconds from remote regions, and loss of the primary region blocks all writes until a promotion occurs. It is not multi-active.</p><p><strong>D</strong> hand-builds global tables with custom Lambda replication: conflict handling, ordering, retries, and monitoring all become the four-person team's problem, violating the operations constraint.</p>`
    },

    {
      q: "An architect is designing the failover mechanism for a new tier-1 application deployed in two regions behind Route 53 DNS records. A previous company incident showed that during a large-scale regional event, automation running in the affected region failed, and calls to service control planes were throttled or unavailable. The failover mechanism itself must remain operable during a full regional outage and must not depend on the health of either application region. What should the architect implement?",
      options: [
        "A Lambda function in the primary region, triggered by a CloudWatch alarm, that calls the Route 53 API to repoint the application DNS records at the standby region.",
        "An SSM Automation runbook in the primary region that operators invoke to update the Route 53 record sets during an incident.",
        "CloudWatch composite alarms in both regions that invoke a cross-region SNS topic, with a subscriber that edits the DNS records automatically.",
        "Amazon Route 53 Application Recovery Controller routing controls hosted on its dedicated multi-region cluster, associated with the failover DNS records, with readiness checks on both regions, so operators or automation flip traffic through the cluster's highly available data plane endpoints."
      ],
      answer: [3],
      multi: false,
      domain: "Design for New Solutions",
      explanation: `<p><strong>D</strong> is correct. Route 53 ARC routing controls exist precisely for this failure mode: the controls are hosted on a cluster spanning five regions, exposed through regional data plane endpoints with an extreme availability design, and flipping a control changes the DNS answer via Route 53 health checks without touching the Route 53 control plane during the emergency. Readiness checks verify the standby can take traffic. Nothing in the failover path depends on either application region.</p><p><strong>A</strong> embeds the failover trigger in the very region whose failure it must survive, the exact anti-pattern the previous incident exposed.</p><p><strong>B</strong> has the same regional dependency plus a human in the loop, and SSM in the impaired region may be degraded.</p><p><strong>C</strong> still terminates in a call to the Route 53 control plane API (ChangeResourceRecordSets); during large-scale events, control planes are the components most likely to be throttled or degraded, which is why static stability guidance says recovery paths must rely on data planes only.</p>`
    },

    {
      q: "A company is finalizing the disaster recovery design for a new trading platform with an active-passive two-region architecture. Risk management mandates that a regional failover must succeed even during a large-scale AWS event in which EC2 launch APIs in the standby region may be throttled, delayed, or failing, and the platform must absorb 100 percent of production load within minutes of the traffic shift. The stateless compute tier runs on EC2 Auto Scaling groups. How should the standby region's compute be designed?",
      options: [
        "Keep the standby Auto Scaling group at zero instances with a high maximum, and trigger a scale-out to production capacity as the first step of the failover automation.",
        "Run the standby Auto Scaling group pre-scaled to full production capacity, backed by On-Demand Capacity Reservations, so that failover consists only of shifting traffic and requires no instance launches or control plane calls.",
        "Configure the standby Auto Scaling group to use Spot Instances at full capacity to keep the pre-provisioned footprint affordable.",
        "Use scheduled scaling to pre-warm the standby region during trading hours and scale it to zero overnight."
      ],
      answer: [1],
      multi: false,
      domain: "Design for New Solutions",
      explanation: `<p><strong>B</strong> is correct and is the definition of static stability: the standby region already holds every resource needed to serve full load, so failover exercises only data planes (traffic shifting), not control planes (instance launches). Capacity Reservations remove the residual risk of an InsufficientInstanceCapacity error if instances ever must be replaced during the event. The cost of idle capacity is the explicit price of the risk mandate.</p><p><strong>A</strong> is the pattern the mandate forbids: scaling from zero at failover time depends on the EC2 launch control plane exactly when the scenario says it may be throttled or failing, and on spare regional capacity that a mass-failover event makes scarce.</p><p><strong>C</strong> undermines the guarantee differently: Spot capacity can be reclaimed with two minutes of notice and is the first capacity to disappear during a capacity crunch, which is precisely the failover moment.</p><p><strong>D</strong> leaves the platform unprotected outside the schedule and still depends on launch APIs at the daily scale-up, so it fails the any-time failover requirement.</p>`
    },

    {
      q: "A software vendor is launching a new API that several hundred enterprise customers will consume from their own AWS accounts. Customers require that traffic never traverses the public internet, many customer VPCs use CIDR ranges that overlap with the vendor's and with each other, and the vendor must approve each customer connection individually and must not manage any routing relationship with customer networks. Which architecture should the vendor build?",
      options: [
        "Establish a VPC peering connection to each customer VPC and publish the API on a private IP address.",
        "Attach customer VPCs to a vendor-managed Transit Gateway shared through AWS Resource Access Manager.",
        "Run the API behind a Network Load Balancer and create a VPC endpoint service (AWS PrivateLink) with acceptance required, allowlisting customer AWS principals; customers create interface endpoints to consume it.",
        "Expose the API through a public Network Load Balancer restricted by security groups referencing each customer's NAT gateway IP addresses."
      ],
      answer: [2],
      multi: false,
      domain: "Design for New Solutions",
      explanation: `<p><strong>C</strong> is correct. PrivateLink is the only option engineered for exactly this trust and addressing model: traffic stays on the AWS network, overlapping CIDRs are irrelevant because the connection is a unidirectional ENI-based service exposure rather than a routed relationship, the allowlist of principals plus acceptance-required gives per-customer approval, and the vendor manages no routes, peering, or attachments at any scale.</p><p><strong>A</strong> is impossible with overlapping CIDRs (peering rejects overlap) and would otherwise mean hundreds of individually managed peering relationships with full bidirectional routing exposure.</p><p><strong>B</strong> has the same fatal flaw: Transit Gateway route tables cannot accommodate overlapping customer CIDRs, and attaching external accounts creates a routed network between vendor and customers, which the requirements forbid.</p><p><strong>D</strong> traverses the public internet by definition of a public endpoint, breaking the primary requirement regardless of security group filtering, and NAT IP allowlists are brittle as customers change egress designs.</p>`
    },

    {
      q: "A retailer is designing a new order pipeline. Order events must be delivered to three independent consumer services (billing, fulfillment, and analytics). Events for the same order must be processed in the exact sequence they occurred by every consumer, duplicate submissions from the checkout retry logic must not create duplicate orders, and each consumer must be able to fail and retry independently without affecting the others. Which messaging design meets these requirements?",
      options: [
        "Publish to a standard SNS topic subscribed by one standard SQS queue per consumer, embedding a sequence number in each message for consumers to reorder.",
        "Publish to an Amazon EventBridge event bus with one rule per consumer service targeting each service directly.",
        "Publish to a Kinesis data stream using a random UUID as the partition key, with each consumer service reading through its own enhanced fan-out consumer.",
        "Publish to an SNS FIFO topic with the order ID as the message group ID and content-based deduplication enabled, subscribed by one SQS FIFO queue per consumer service."
      ],
      answer: [3],
      multi: false,
      domain: "Design for New Solutions",
      explanation: `<p><strong>D</strong> satisfies every constraint natively. SNS FIFO to SQS FIFO fan-out preserves strict ordering per message group, and using the order ID as the group ID orders each order's events while allowing parallelism across orders. Content-based deduplication absorbs checkout retries within the deduplication window. Each consumer owns its queue, so a failing consumer's backlog and retries are isolated.</p><p><strong>A</strong> pushes ordering into application code: standard SNS and SQS can deliver out of order and more than once, so every consumer must implement resequencing buffers and idempotency stores, which is the complexity the managed FIFO pairing eliminates.</p><p><strong>B</strong> offers no ordering guarantee and no deduplication, and direct rule-to-service delivery without queues means a slow consumer relies solely on EventBridge retry policy rather than an isolated, replayable backlog.</p><p><strong>C</strong> is the near-miss: Kinesis does preserve order, but only within a shard, and a random partition key scatters one order's events across shards, destroying relative ordering. An order-ID partition key would have been the workable variant.</p>`
    },

    {
      q: "A company is launching a real-time augmented reality mobile application. The compute tier that performs pose estimation must respond to devices over carrier 5G networks with end-to-end latency under 20 milliseconds in major metropolitan areas. Traffic from device to compute must stay within the mobile carrier's network rather than traversing the public internet to a distant region. The team wants to keep using standard EC2 APIs, AMIs, and Auto Scaling. Where should the latency-critical tier run?",
      options: [
        "In AWS Wavelength Zones embedded in the participating telecommunication carriers' 5G networks, with the application's backend control plane remaining in the parent region.",
        "In AWS Local Zones in each metropolitan area, with devices connecting over their carriers' internet gateways.",
        "On CloudFront edge locations by using Lambda@Edge functions for the pose estimation code.",
        "On AWS Outposts racks installed in colocation facilities in each target city."
      ],
      answer: [0],
      multi: false,
      domain: "Design for New Solutions",
      explanation: `<p><strong>A</strong> is correct. Wavelength embeds AWS compute inside the carrier's 5G network at the mobile edge, so device traffic reaches EC2 instances without leaving the carrier network or traversing the internet, which is the stated requirement and the only way to reliably hit sub-20 ms for mobile users. Wavelength Zones are used with standard EC2, EBS, AMIs, and Auto Scaling as an extension of the parent region's VPC.</p><p><strong>B</strong> is the near-miss: Local Zones put compute in the metro and can achieve single-digit millisecond latency for wired ISPs, but mobile traffic exits the carrier network to the internet before reaching a Local Zone, adding variable hops that break both the latency budget and the stay-on-carrier-network requirement.</p><p><strong>C</strong> misfits the workload: Lambda@Edge is for lightweight request manipulation with tight size and duration limits, not sustained GPU-class inference, and edge functions cannot host stateful low-latency game-loop style compute.</p><p><strong>D</strong> could deliver low latency to fixed sites but requires procuring and operating racks per city, and mobile traffic still traverses carrier-to-colo internet paths, failing the carrier-network requirement.</p>`
    },

    {
      q: "A manufacturing company must deploy a new production-control system for a factory in a country that has no AWS Region and a strict data residency law: all production data must be processed and stored inside the country. The plant requires single-digit millisecond latency from machines to the application, the system uses EC2, EBS, and RDS, and the operations team wants to manage everything with its existing AWS tooling and APIs. Reliable network connectivity from the factory back to the nearest AWS Region exists. What should the architect propose?",
      options: [
        "Deploy the workload in the geographically nearest AWS Region and encrypt all data with customer managed KMS keys to satisfy the residency law.",
        "Deploy a cluster of AWS Snowball Edge Compute Optimized devices in the factory and run the application on them long-term.",
        "Install an AWS Outposts rack in the factory data center, run EC2, EBS, and RDS on the Outpost anchored to the nearest region, and keep all data stored locally on the Outpost.",
        "Use an AWS Local Zone in the country to host the workload close to the factory."
      ],
      answer: [2],
      multi: false,
      domain: "Design for New Solutions",
      explanation: `<p><strong>C</strong> is correct. Outposts is the service designed for this exact combination: AWS-managed infrastructure physically inside the customer's facility, so data is processed and stored in-country, latency to factory machines is LAN-level, and the team uses the same EC2, EBS, RDS APIs and tooling because the Outpost is an extension of the anchor region's VPC. The control plane dependency on the parent region uses the existing connectivity without moving production data out.</p><p><strong>A</strong> misreads the law: encryption does not change where data physically resides, so processing and storing it in a foreign region violates residency outright, and cross-border latency will not be single-digit milliseconds.</p><p><strong>B</strong> is for edge, disconnected, or short-term use: Snowball Edge offers a limited EC2-compatible feature set, no managed RDS, constrained capacity, and running a permanent factory system on it sacrifices the standard tooling requirement.</p><p><strong>D</strong> fails on availability: Local Zones exist only in locations AWS selects, the scenario's country has none, and customers cannot commission one.</p>`
    },

    {
      q: "A new document management platform encrypts every object with envelope encryption before storing it in Amazon S3, with data keys generated by AWS KMS. The DR plan replicates the encrypted objects to a second region. During a regional failover, the application in the DR region must decrypt existing ciphertexts using KMS in its own region, with no API dependency on the primary region and without decrypting and re-encrypting objects during replication. How should the KMS layer be designed?",
      options: [
        "Export the key material from the primary region's KMS key and import the same material into a standard KMS key in the DR region.",
        "Create a KMS multi-Region primary key in the primary region and replicate it to the DR region, so both related keys share the same key ID and key material and either region can decrypt the ciphertexts locally.",
        "Keep a single-region KMS key in the primary region and have the DR application call the primary region's KMS endpoint for decryption during a failover.",
        "Create independent KMS keys in each region and add a re-encryption step to the replication pipeline that decrypts each object and re-encrypts it with the DR region's key."
      ],
      answer: [1],
      multi: false,
      domain: "Design for New Solutions",
      explanation: `<p><strong>B</strong> is correct. Multi-Region keys were introduced for exactly this pattern: the primary and replica keys are cryptographically identical (same key ID and material), so a ciphertext produced in one region decrypts in the other with a purely local KMS call. Replicated objects need no transformation, and a primary-region outage does not affect DR decryption.</p><p><strong>A</strong> is impossible for KMS-generated material, which is never exportable. Even with externally imported material in both keys, the keys would have different key IDs, and KMS binds ciphertext metadata to the specific key, so cross-key decryption still fails; it also silently downgrades durability guarantees for imported material.</p><p><strong>C</strong> re-creates the dependency the requirement forbids: every decryption during a failover would rely on the availability of the impaired primary region's KMS endpoint, making the DR region not actually independent.</p><p><strong>D</strong> works but violates the no-re-encryption constraint, adds a custom pipeline that must handle every object, and doubles KMS request costs while widening the window in which plaintext exists in the pipeline.</p>`
    },

    {
      q: "A gaming analytics team is designing ingestion for clickstream events that peak at unpredictable levels several times per day. Requirements: multiple independent real-time consumer applications each reading the full stream with subsecond delivery, the ability to reprocess the last 7 days of events after consumer bugs, ordered processing per player session, and a two-person platform team that cannot manage broker clusters or partition capacity planning. Which streaming design fits?",
      options: [
        "Amazon MSK provisioned clusters sized for peak throughput, with consumer groups for each application.",
        "Amazon SQS standard queues with one queue per consumer and an S3 archive written by a Lambda function for reprocessing.",
        "Amazon Data Firehose delivering events to S3, with consumer applications reading the delivered objects.",
        "Amazon Kinesis Data Streams in on-demand capacity mode with retention extended to 7 days, the player session ID as the partition key, and each application registered as an enhanced fan-out consumer."
      ],
      answer: [3],
      multi: false,
      domain: "Design for New Solutions",
      explanation: `<p><strong>D</strong> meets every constraint. On-demand mode removes shard capacity planning and absorbs unpredictable peaks; extended retention supports 7-day replay by re-reading from a timestamp; partitioning by session ID preserves per-session ordering within a shard; and enhanced fan-out gives each consumer its own dedicated 2 MB per second per shard pipe with push delivery around 70 milliseconds, so consumers neither contend nor affect each other.</p><p><strong>A</strong> satisfies the functional requirements but fails the operational constraint: provisioned MSK means broker sizing, storage scaling, version upgrades, and partition planning, which a two-person team was explicitly said not to take on, and peak-sized clusters waste cost between spikes.</p><p><strong>B</strong> cannot do replay natively (a message consumed is gone), standard queues do not preserve order, and a homemade S3 archive plus backfill path is a second system to operate.</p><p><strong>C</strong> is delivery, not streaming consumption: Firehose buffers to S3 on the order of tens of seconds at best, has no per-consumer real-time fan-out, and offers no ordering semantics, so subsecond multi-consumer processing is unachievable.</p>`
    },

    {
      q: "A game studio is launching a multiplayer title whose custom binary protocol runs over TCP and UDP to game servers in four AWS Regions. Publishers require two static IP addresses that will never change for console platform allowlists, client connections must be routed to the nearest healthy region with failover in seconds when a region degrades, and the solution must improve last-mile performance by moving player traffic onto the AWS backbone as early as possible. What should the architect use?",
      options: [
        "AWS Global Accelerator with TCP and UDP listeners on its two static anycast IP addresses, endpoint groups in each of the four regions with health checks, and traffic dials for regional control.",
        "Amazon CloudFront with origin groups configured for automatic failover between the regional game server fleets.",
        "Route 53 latency-based routing to regional Network Load Balancers, with health checks and a low TTL on the records.",
        "Network Load Balancers with Elastic IP addresses in each region, published to clients as a list of per-region static IPs with client-side failover logic."
      ],
      answer: [0],
      multi: false,
      domain: "Design for New Solutions",
      explanation: `<p><strong>A</strong> is purpose-built for this. Global Accelerator provides exactly two static anycast IPs valid for the life of the accelerator (the allowlist requirement), supports raw TCP and UDP listeners (custom protocol), ingests traffic at the nearest edge location onto the AWS backbone (last-mile requirement), and continuously health-checks regional endpoints, rerouting in seconds without any DNS propagation dependency.</p><p><strong>B</strong> cannot carry the workload: CloudFront proxies HTTP, HTTPS, and WebSocket traffic only, so a custom binary protocol over raw TCP and UDP is unsupported regardless of origin failover configuration.</p><p><strong>C</strong> is the classic DNS near-miss: latency-based routing selects a nearby region, but failover speed is hostage to resolver and client TTL caching (consoles and home routers routinely ignore low TTLs), there are no fixed IPs to allowlist since record answers change, and traffic rides the public internet until it reaches the region.</p><p><strong>D</strong> gives static IPs but eight of them across regions, pushes health detection and failover into every client, and provides no backbone ingestion or nearest-region steering.</p>`
    },

    {
      q: "A company is preparing to launch a public REST API built on Amazon API Gateway and Lambda with an Amazon RDS for PostgreSQL backend. Commercial partners will integrate before launch, and contracts specify different request-rate tiers per partner. Load tests show that marketing events cause 20-fold traffic spikes that exhaust the database's connection slots as Lambda concurrency rises, causing cascading failures. Which combination of actions addresses the per-partner rate control and the database connection exhaustion? (Select TWO.)",
      options: [
        "Create API Gateway usage plans with API keys for each partner tier, configuring per-key throttling rates and quotas that match the contracted limits.",
        "Enable API Gateway caching with a long TTL on the POST integration responses to absorb traffic spikes.",
        "Place Amazon RDS Proxy between the Lambda functions and the database so connections are pooled and multiplexed across the fluctuating Lambda concurrency.",
        "Increase the max_connections parameter in a custom DB parameter group to match the maximum expected Lambda concurrency.",
        "Convert the API to an edge-optimized endpoint type to increase the throughput available to the backend."
      ],
      answer: [0, 2],
      multi: true,
      domain: "Design for New Solutions",
      explanation: `<p><strong>A</strong> and <strong>C</strong> are correct. Usage plans with API keys are the native API Gateway mechanism for contractual, per-client rate tiers: each partner's key carries its own steady-state rate, burst, and quota (<strong>A</strong>). RDS Proxy solves the Lambda-to-RDS impedance mismatch: thousands of short-lived Lambda environments share a warm, pooled set of database connections, and the proxy queues or multiplexes requests instead of letting connection storms hit PostgreSQL (<strong>C</strong>).</p><p><strong>B</strong> is invalid: API Gateway caching applies to GET-style responses; caching POST mutations with a long TTL would serve stale or incorrect results and does nothing for write-path spikes.</p><p><strong>D</strong> treats the symptom and creates a new failure: each PostgreSQL connection consumes server memory, so raising max_connections toward peak Lambda concurrency risks memory exhaustion and degrades the database for all tenants.</p><p><strong>E</strong> misunderstands endpoint types: edge-optimized routes client traffic through CloudFront for latency, and has no effect on backend throughput, throttling, or connection management.</p>`
    },

    {
      q: "A solutions architect is designing a two-region architecture for a new e-commerce web application on EC2 Auto Scaling groups behind Application Load Balancers with an Aurora MySQL database. The requirements are an RTO of 5 minutes, an RPO under 1 minute, and failover that completes without an operator manually editing DNS or restoring data. Which TWO components must be part of the design to meet these requirements? (Select TWO.)",
      options: [
        "Copy automated Aurora snapshots to the second region every six hours and restore the latest snapshot during a failover.",
        "Route 53 failover routing with health checks monitoring the primary region's Application Load Balancer, and the standby region's Application Load Balancer configured as the secondary record.",
        "A CloudFront origin group with the two regional load balancers so that write requests automatically fail over at the CDN layer.",
        "An Aurora global database with a secondary cluster in the standby region, with promotion of the secondary automated as part of the failover workflow.",
        "AMIs of all application instances copied to the standby region, launched by an operator runbook during a disaster."
      ],
      answer: [1, 3],
      multi: true,
      domain: "Design for New Solutions",
      explanation: `<p><strong>B</strong> and <strong>D</strong> are the load-bearing pieces. Route 53 failover records with health checks (<strong>B</strong>) shift traffic automatically when the primary ALB stops passing checks, removing the manual DNS edit. An Aurora global database (<strong>D</strong>) replicates with typically sub-second lag, meeting the sub-minute RPO, and scripted promotion of the secondary completes within the 5-minute RTO without any data restore.</p><p><strong>A</strong> violates both objectives: a six-hour snapshot cadence means up to six hours of data loss, and cross-region restore of a large cluster takes far longer than five minutes.</p><p><strong>C</strong> is the subtle distractor: CloudFront origin failover retries only idempotent methods such as GET and HEAD against the second origin, so POST checkout traffic does not fail over there, and it does nothing for the database tier that dominates RTO and RPO.</p><p><strong>E</strong> is pilot light with a human in the loop: operator-driven launches cannot be reconciled with a 5-minute automated RTO.</p>`
    },

    {
      q: "A platform engineering team is preparing 20 AWS accounts for a high-profile product launch. In past launches, individual accounts hit the EC2 vCPU on-demand quota during scale-out and Lambda concurrent execution limits during traffic bursts, causing outages while emergency support cases were resolved. The team must prevent quota-related failures for this launch and for accounts created in the future, with visibility before limits are reached. Which combination of actions should the team take? (Select TWO.)",
      options: [
        "Implement exponential backoff with jitter in all SDK clients so that quota-related errors retry until capacity becomes available.",
        "Configure a Service Quotas request template for the organization so that the required quota increases are requested automatically in every newly created account.",
        "Shift workloads into additional regions at runtime whenever a quota is exhausted in the primary region.",
        "Create CloudWatch alarms on Service Quotas usage metrics at 80 percent of each launch-critical quota in the existing accounts, and submit the needed quota increase requests well before the launch date.",
        "Instruct the on-call engineer to open an AWS Support case for an emergency increase at the first throttling error during the launch."
      ],
      answer: [1, 3],
      multi: true,
      domain: "Design for New Solutions",
      explanation: `<p><strong>B</strong> and <strong>D</strong> pair proactive capacity with proactive visibility. The organization-level quota request template (<strong>B</strong>) is the mechanism that fixes the future-accounts requirement: every vended account automatically files the standard increase requests at creation. CloudWatch integration with Service Quotas (<strong>D</strong>) alarms at 80 percent utilization so the team sees pressure building, and submitting increases ahead of the launch removes the emergency-case failure mode the scenario describes.</p><p><strong>A</strong> helps only with transient API throttling; a hard resource quota such as vCPU count or account concurrency does not free up on retry, so backoff turns an outage into a slower outage.</p><p><strong>C</strong> is an architectural change disguised as quota management: spilling into other regions mid-incident adds data locality, latency, and deployment problems and cannot be improvised during a launch.</p><p><strong>E</strong> is precisely the reactive process that failed in previous launches; support-case turnaround is not a launch-day control.</p>`
    },

    /* ============================================================
     * Domain 3: Continuous Improvement for Existing Solutions (12)
     * ============================================================ */

    {
      q: "A cloud platform team maintains a security baseline consisting of IAM roles, AWS Config rules, and CloudWatch alarms defined in a CloudFormation template. Today the baseline is deployed inconsistently: some of the organization's 90 accounts have outdated versions and newly created accounts receive nothing until someone notices. The team wants every account in specific OUs, including accounts added in the future, to receive and stay current with the baseline automatically, with the LEAST operational effort. What should the team do?",
      options: [
        "Use self-managed CloudFormation StackSets, manually creating the administration and execution roles in every account, and rerun the deployment whenever accounts are added.",
        "Enable trusted access between CloudFormation StackSets and AWS Organizations, convert the baseline to a service-managed StackSet targeting the OUs, and enable automatic deployment so that accounts joining an OU receive the stacks and removals are cleaned up.",
        "Publish the template as a Service Catalog product and require application teams to launch and update it in their own accounts.",
        "Create a CodePipeline in each account that redeploys the baseline template whenever the source repository changes."
      ],
      answer: [1],
      multi: false,
      domain: "Continuous Improvement for Existing Solutions",
      explanation: `<p><strong>B</strong> is correct. Service-managed StackSets with trusted access remove both pain points at once: Organizations handles the cross-account IAM automatically (no per-account role creation), and automatic deployment means an account moved into or created within a target OU receives the current baseline with no human action, while updates to the StackSet propagate everywhere. This is the minimal-operations answer for exactly this fleet-baseline use case.</p><p><strong>A</strong> is the near-miss: self-managed StackSets work, but they demand execution role bootstrapping in all 90 accounts and offer no automatic coverage of new accounts, which recreates the drift problem the team is trying to eliminate.</p><p><strong>C</strong> inverts responsibility: the baseline's consistency would depend on every application team choosing to launch and upgrade the product, guaranteeing the same inconsistency at higher process cost.</p><p><strong>D</strong> multiplies infrastructure: 90 pipelines to maintain, credentials to manage, and still nothing that automatically covers a new account before its pipeline exists.</p>`
    },

    {
      q: "A team runs a revenue-critical API on AWS Lambda behind API Gateway. A recent bad deployment sent 100 percent of traffic to a defective version, causing a 40-minute outage. The team now requires deployments that expose only a small fraction of production traffic to new code, verify error and latency metrics automatically before full release, and roll back without human intervention if metrics degrade. Which deployment approach satisfies these requirements?",
      options: [
        "Publish each release as a new Lambda version behind an alias and use AWS CodeDeploy with a canary configuration such as Canary10Percent5Minutes, with CloudWatch alarms on errors and duration wired to automatic rollback.",
        "Continue deploying all-at-once but keep the previous version deployed so an operator can shift the alias back manually within minutes.",
        "Deploy the new version to a second Lambda function and shift traffic gradually by updating weighted Route 53 records that front the two function URLs.",
        "Enable Lambda versioning and ask API consumers to pin to version-qualified ARNs, migrating to new versions on their own schedule."
      ],
      answer: [0],
      multi: false,
      domain: "Continuous Improvement for Existing Solutions",
      explanation: `<p><strong>A</strong> is the managed implementation of every stated requirement. CodeDeploy shifts alias weight so that only 10 percent of invocations hit the new version for the bake period, CloudWatch alarms on error rate and duration act as automated verification, and an alarm breach makes CodeDeploy shift the alias back to the previous version with no human involved. Pre- and post-traffic hooks add validation if needed.</p><p><strong>B</strong> fails the core requirement twice: all-at-once still exposes 100 percent of traffic to the defect, and rollback depends on a human noticing and acting, which is what produced the 40-minute outage.</p><p><strong>C</strong> hand-builds canarying at the wrong layer: DNS weighting is approximate (resolver caching skews percentages), health evaluation and rollback would be custom automation, and duplicate function identities complicate permissions and monitoring compared with the native alias mechanism.</p><p><strong>D</strong> is not a deployment strategy at all; it delegates risk management to consumers and leaves no metric-driven gate or rollback in the provider's control.</p>`
    },

    {
      q: "After analyzing the Cost and Usage Report with Athena, a FinOps team finds that NAT gateway data processing charges are one of the largest line items across 25 VPCs. Flow log analysis shows that more than 80 percent of the NAT traffic is from private subnets to Amazon S3 and DynamoDB in the same region. The team wants to eliminate as much of this cost as possible without affecting the applications. What should the team do?",
      options: [
        "Replace the NAT gateways with NAT instances on Graviton-based EC2 instances to lower the per-hour and per-GB costs.",
        "Consolidate all outbound traffic through a single centralized NAT gateway in a shared egress VPC behind the Transit Gateway.",
        "Create gateway VPC endpoints for S3 and DynamoDB in each VPC and add the endpoints to the private subnets' route tables so that this traffic bypasses the NAT gateways entirely.",
        "Create interface VPC endpoints for S3 and DynamoDB in each VPC so that the traffic uses PrivateLink instead of the NAT gateways."
      ],
      answer: [2],
      multi: false,
      domain: "Continuous Improvement for Existing Solutions",
      explanation: `<p><strong>C</strong> is correct. Gateway endpoints for S3 and DynamoDB carry traffic over the AWS network via route table prefix-list entries and have no hourly charge and no per-GB processing charge, so the 80 percent of NAT volume going to these two services becomes free of data processing cost, with no application changes because the services' public DNS names continue to work.</p><p><strong>A</strong> trades a managed service for self-operated instances and still bills instance-hours and bandwidth; availability, patching, and scaling become the team's problem for at best a modest saving.</p><p><strong>B</strong> centralizes but does not reduce: every GB still pays NAT processing, now with Transit Gateway per-GB data processing added on top, so this frequently costs more than the status quo.</p><p><strong>D</strong> is the deliberate near-miss: interface endpoints for these services work, but they bill per-AZ-hour and per-GB processed, so at this traffic volume they merely replace NAT charges with PrivateLink charges. Gateway endpoints exist for S3 and DynamoDB precisely because they are free.</p>`
    },

    {
      q: "An organization's annual cost review shows a stable 24-7 baseline of compute spend spread across EC2 instances of frequently changing families and sizes, ECS services on Fargate, and Lambda functions. Engineering leadership refuses any purchase that would restrict future instance family changes or the ongoing migration from EC2 to Fargate. The FinOps team wants the largest discount on the stable baseline consistent with that flexibility, managed as a single commitment. What should the team purchase?",
      options: [
        "Standard Reserved Instances matching the currently deployed instance families and sizes in each account.",
        "EC2 Instance Savings Plans covering the baseline in the regions with the most usage.",
        "A commitment-free strategy of Spot Instances for the stable baseline workloads.",
        "A Compute Savings Plan sized to the stable baseline hourly spend, purchased centrally."
      ],
      answer: [3],
      multi: false,
      domain: "Continuous Improvement for Existing Solutions",
      explanation: `<p><strong>D</strong> is correct. A Compute Savings Plan is a dollars-per-hour commitment that automatically applies across EC2 regardless of instance family, size, OS, tenancy, or region, and also covers Fargate and Lambda usage. It is therefore the only instrument whose discount survives both the frequent family changes and the EC2-to-Fargate migration, and it is managed as one central commitment as requested.</p><p><strong>A</strong> conflicts with the flexibility mandate: Standard RIs lock attributes (family changes require the exchange-limited Convertible variant), do not apply to Fargate or Lambda at all, and per-account purchases fragment management.</p><p><strong>B</strong> offers the deepest EC2 discount rate but is the trap: EC2 Instance Savings Plans are locked to a specific instance family in a specific region and never cover Fargate or Lambda, so the migration would progressively strand the commitment.</p><p><strong>C</strong> misapplies Spot: interruptible capacity is unsuited to a 24-7 baseline of production services, and Spot provides no committed discount, merely variable market pricing with reclaim risk.</p>`
    },

    {
      q: "A serverless application uses hundreds of concurrent Lambda functions that connect to an Amazon RDS for PostgreSQL Multi-AZ instance. During traffic bursts, the database reaches its connection limit, new invocations fail with connection errors, and recovery after each burst is slow because thousands of idle connections linger. The team must fix the connection behavior without rearchitecting the application. Which change directly addresses the problem?",
      options: [
        "Scale the RDS instance to a memory-optimized class two sizes larger so it can accept more simultaneous connections.",
        "Deploy Amazon RDS Proxy in front of the database, route the Lambda functions through the proxy endpoint, and use IAM authentication from the functions to the proxy.",
        "Increase the max_connections value in a custom parameter group to a value above the peak Lambda concurrency.",
        "Add two read replicas and configure the functions to distribute all queries across the replica endpoints."
      ],
      answer: [1],
      multi: false,
      domain: "Continuous Improvement for Existing Solutions",
      explanation: `<p><strong>B</strong> is correct. The failure mode is the canonical Lambda-to-relational-database mismatch: each concurrent execution environment opens its own connection, and bursts create connection storms that exhaust slots and leave idle connections behind. RDS Proxy terminates function connections at a warm, shared pool, multiplexes many client connections onto few database connections, queues excess requests briefly instead of erroring, and improves failover behavior, all without application rearchitecture beyond an endpoint change.</p><p><strong>A</strong> buys headroom, not a fix: a larger instance raises the ceiling that the next bigger burst will again hit, at a permanent cost increase, while idle-connection churn remains.</p><p><strong>C</strong> is the subtle trap: max_connections is bounded by instance memory, and each PostgreSQL connection is a process consuming several megabytes, so pushing the parameter toward peak Lambda concurrency invites memory pressure and instability rather than solving pooling.</p><p><strong>D</strong> misdiagnoses the workload: replicas serve reads only, writes still storm the primary, and each function still opens its own connections, now against three endpoints instead of one.</p>`
    },

    {
      q: "A business-critical three-tier application runs entirely in a single Availability Zone: EC2 web and app instances in one Auto Scaling group with subnets in one AZ behind an existing Application Load Balancer, and a single-AZ RDS for MySQL instance. After an AZ disruption caused a full outage, the operations team must make the application survive the loss of any single Availability Zone. The improvement must involve the LEAST amount of change to the existing architecture. What should the team do?",
      options: [
        "Add subnets in two additional Availability Zones to the Auto Scaling group and the load balancer's configuration, and modify the RDS instance to a Multi-AZ deployment.",
        "Re-platform the database to an Aurora global database and deploy the application stack into a second region behind Route 53 failover records.",
        "Create a pilot-light environment in another region with database snapshots copied hourly and minimal core infrastructure kept running.",
        "Automate frequent EBS and RDS snapshots with AWS Backup and write a runbook that restores the stack into a healthy Availability Zone after a failure."
      ],
      answer: [0],
      multi: false,
      domain: "Continuous Improvement for Existing Solutions",
      explanation: `<p><strong>A</strong> is correct and is deliberately boring: spreading the Auto Scaling group and load balancer across three AZs makes the stateless tiers immune to a single-AZ loss (the ALB already health-checks and routes around dead targets, and the ASG replaces capacity in surviving AZs), and converting RDS to Multi-AZ adds a synchronous standby with automatic failover in one modification call. Every change is an in-place adjustment to existing resources, matching the least-change constraint.</p><p><strong>B</strong> answers a question that was not asked: multi-region protects against regional failure at far higher cost and operational change; the requirement is AZ-level survival with minimal change.</p><p><strong>C</strong> likewise solves regional DR, and worse, pilot light still requires failover work during an event and hourly snapshots imply data loss that Multi-AZ synchronous replication avoids.</p><p><strong>D</strong> is recovery, not availability: restore-from-snapshot means an outage measured in hours and data loss back to the last snapshot, which repeats the incident the team just experienced.</p>`
    },

    {
      q: "A central SRE team must monitor 60 workload accounts. Engineers currently switch roles into individual accounts to view CloudWatch metrics, search logs, and inspect X-Ray traces, which slows incident response. The team wants engineers to query and visualize metrics, logs, and traces from all accounts in a single monitoring account's console, including in existing dashboards and alarms, with accounts connected automatically as the organization grows. Which solution should the team implement?",
      options: [
        "Stream every account's logs and metrics through Kinesis Data Firehose into a central S3 bucket and query the data with Athena during incidents.",
        "Create a read-only cross-account role in each workload account and document a role-switching procedure for the SRE team.",
        "Enable CloudWatch cross-account observability by creating a sink in the monitoring account and linking the workload accounts through the organization, so metrics, logs, and traces from source accounts are searchable and dashboardable in the monitoring account.",
        "Deploy a third-party observability agent to all workloads and consolidate telemetry in a SaaS platform."
      ],
      answer: [2],
      multi: false,
      domain: "Continuous Improvement for Existing Solutions",
      explanation: `<p><strong>C</strong> is correct. CloudWatch cross-account observability is the native answer to exactly this workflow: a sink in the monitoring account plus organization-based linking lets source accounts share metrics, log groups, and traces, which then appear in the monitoring account's console as first-class data usable in dashboards, alarms, Logs Insights queries, and the X-Ray trace map. Organization-level linking onboards new accounts automatically.</p><p><strong>A</strong> builds a data lake, not an observability console: real-time alarming and trace analysis do not work over exported objects in S3, latency is high, and the pipeline itself becomes infrastructure to operate.</p><p><strong>B</strong> is the status quo with better documentation; engineers still context-switch per account and nothing aggregates, so incident response speed does not improve.</p><p><strong>D</strong> can work but replaces a configuration change with an agent rollout across 60 accounts, ongoing licensing cost, and a parallel toolchain, which is disproportionate when the requirement is met natively by CloudWatch.</p>`
    },

    {
      q: "A media archive stores 900 TB in S3 Standard. Access analysis shows unpredictable behavior: most objects are untouched for months, but editorial events cause sudden bursts of reads against arbitrary old objects, and the business requires that any object be readable immediately at all times. The team wants to reduce storage cost with no retrieval delays, no retrieval fees on access-pattern changes, and no ongoing lifecycle tuning. Which storage change achieves this?",
      options: [
        "Use a lifecycle rule to transition objects to S3 Glacier Flexible Retrieval after 30 days.",
        "Move all objects to S3 One Zone-Infrequent Access to obtain the lowest per-GB price.",
        "Move all objects to S3 Glacier Instant Retrieval.",
        "Transition the objects to S3 Intelligent-Tiering with the default access tiers, letting objects move automatically among the frequent, infrequent, and archive instant access tiers based on observed access."
      ],
      answer: [3],
      multi: false,
      domain: "Continuous Improvement for Existing Solutions",
      explanation: `<p><strong>D</strong> is correct. Intelligent-Tiering is built for unpredictable access: objects idle for 30 days drop to the infrequent tier and after 90 days to the archive instant access tier, cutting cost substantially, while every tier returns data with normal millisecond S3 latency. Crucially, Intelligent-Tiering charges no retrieval fees; when an editorial burst touches a cold object, it is simply promoted back to the frequent tier. The only cost is a small per-object monitoring charge, and no lifecycle tuning is ever needed.</p><p><strong>A</strong> violates the immediacy requirement: Glacier Flexible Retrieval requires a restore operation taking minutes to hours before an object is readable.</p><p><strong>B</strong> trades durability posture for price: One Zone-IA stores data in a single AZ (inappropriate for an archive of record) and charges per-GB retrieval fees on exactly the bursty access the scenario describes.</p><p><strong>C</strong> keeps millisecond access but bills a retrieval fee per GB on every read and expects long-lived cold data; unpredictable read bursts make those fees and its minimum storage duration a poor fit compared with fee-free automatic tiering.</p>`
    },

    {
      q: "A database fleet uses forty 2 TiB gp2 EBS volumes attached to production EC2 instances. Performance analysis shows each volume needs a consistent 6,000 IOPS and 300 MiB/s of throughput, and finance wants EBS spend reduced. The volumes cannot be detached and the applications cannot tolerate downtime. What is the MOST cost-effective way to meet the performance target?",
      options: [
        "Take snapshots of each volume and restore them onto new io2 volumes provisioned with 6,000 IOPS, swapping the volumes during a maintenance window.",
        "Use Elastic Volumes to modify each volume in place from gp2 to gp3, provisioning 6,000 IOPS and 300 MiB/s of throughput, with the instances remaining attached and online.",
        "Increase each gp2 volume's size until its baseline IOPS reaches the required level.",
        "Migrate the data to instance store NVMe volumes on storage-optimized instances to obtain higher IOPS at no additional EBS cost."
      ],
      answer: [1],
      multi: false,
      domain: "Continuous Improvement for Existing Solutions",
      explanation: `<p><strong>B</strong> is correct on all three constraints. Elastic Volumes changes the volume type live, with no detach and no downtime. gp3 decouples performance from size: 6,000 IOPS and 300 MiB/s are provisioned directly (3,000 IOPS and 125 MiB/s are free baseline, the rest a small add-on), and gp3's per-GiB price is about 20 percent lower than gp2, so the fleet gets guaranteed performance and a lower bill simultaneously.</p><p><strong>A</strong> meets performance but fails both other requirements: snapshot-and-swap is downtime, and io2 with provisioned IOPS is dramatically more expensive than gp3 for a target well within gp3's range.</p><p><strong>C</strong> is the legacy gp2 trick: at 3 IOPS per GiB, reaching 6,000 IOPS means growing each volume to 2 TiB, which these already are; gp2 at 2 TiB provides 6,000 IOPS burst-free but throughput caps at 250 MiB/s, missing the 300 MiB/s target, and costs more than gp3.</p><p><strong>D</strong> sacrifices durability: instance store is ephemeral, lost on stop or hardware failure, and unusable for production database volumes, besides requiring disruptive instance migration.</p>`
    },

    {
      q: "A security review of a five-year-old AWS environment found hundreds of IAM roles with broad managed policies such as PowerUserAccess, many of which have not been used for months, and application roles whose policies allow far more actions than the applications invoke. The security team must systematically identify unused roles and unused permissions across all organization accounts and produce right-sized policies based on what each role actually does, with evidence for auditors. Which approach accomplishes this?",
      options: [
        "Enforce MFA for all IAM principals and enable a strict password policy in every account.",
        "Attach an SCP that denies all actions organization-wide, then re-allow specific services as application teams file exception requests.",
        "Enable IAM Access Analyzer unused access findings at the organization level to surface unused roles, access keys, and unused permissions, and use policy generation based on CloudTrail activity to produce policies scoped to each role's observed API usage.",
        "Export IAM credential reports quarterly, rotate all access keys, and delete users flagged as inactive."
      ],
      answer: [2],
      multi: false,
      domain: "Continuous Improvement for Existing Solutions",
      explanation: `<p><strong>C</strong> is correct because it maps one-to-one onto the requirements. Unused access analysis, delegated org-wide, continuously reports roles, keys, and passwords unused beyond a tracking window and, at permission granularity, services and actions granted but never exercised, giving auditors dated findings as evidence. Access Analyzer policy generation then reads the role's CloudTrail history and drafts a policy containing what the workload actually called, which is precisely right-sizing based on observed behavior.</p><p><strong>A</strong> strengthens authentication and does nothing about authorization: over-broad permissions remain fully intact behind the MFA prompt.</p><p><strong>B</strong> is an outage generator: a blanket deny SCP breaks every workload simultaneously and rebuilding permissions by ticket queue is an unmeasured, months-long disruption, not an analysis method; SCPs also cannot express per-role right-sizing.</p><p><strong>D</strong> covers only users and credentials hygiene; the problem is roles and permission breadth, which credential reports do not measure and rotation does not reduce.</p>`
    },

    {
      q: "A company runs a microservices platform on EKS across three Availability Zones, with services in several VPCs connected by a Transit Gateway. The monthly bill shows large charges for cross-AZ data transfer between chatty services and for Transit Gateway data processing between two VPCs that exchange tens of terabytes daily. Availability requirements prohibit consolidating into a single AZ. Which combination of changes reduces these costs while preserving multi-AZ resilience? (Select TWO.)",
      options: [
        "Migrate all workloads into one Availability Zone to eliminate cross-AZ charges.",
        "Enable topology-aware routing so that requests between services are served by pods in the caller's own Availability Zone when healthy endpoints exist there, and disable cross-zone load balancing on the internal load balancing tier where per-AZ capacity is balanced.",
        "Replace the Transit Gateway path between the two highest-volume VPCs with a direct VPC peering connection, which has no per-GB data processing charge for the traffic.",
        "Enable gzip compression at the CloudFront distribution serving the public website to shrink the transferred data.",
        "Move the chatty services to larger instances so that fewer network flows are required between them."
      ],
      answer: [1, 2],
      multi: true,
      domain: "Continuous Improvement for Existing Solutions",
      explanation: `<p><strong>B</strong> and <strong>C</strong> attack the two billed dimensions directly. Topology-aware routing keeps service-to-service calls inside the caller's AZ whenever local endpoints are healthy, and disabling cross-zone distribution on balanced internal tiers stops the load balancer from deliberately spraying traffic across AZ boundaries; multi-AZ redundancy is preserved because other zones still hold replicas for failure cases (<strong>B</strong>). For the two VPCs exchanging tens of terabytes, VPC peering carries the same traffic without the Transit Gateway's per-GB processing charge, a pure cost removal for a high-volume pair while the rest of the topology stays on the TGW (<strong>C</strong>).</p><p><strong>A</strong> is explicitly prohibited: single-AZ operation trades away the resilience requirement.</p><p><strong>D</strong> is aimed at the wrong traffic: CloudFront compression affects viewer-facing egress, not east-west inter-AZ or inter-VPC flows.</p><p><strong>E</strong> misunderstands billing: charges are per GB transferred, not per flow or per instance, so instance sizing does not change the transferred volume.</p>`
    },

    {
      q: "A platform team uses a service-managed CloudFormation StackSet to deploy a shared baseline to 120 accounts across three regions. A recent template update contained an error that was deployed everywhere before anyone noticed, breaking IAM roles in all accounts simultaneously. The team must change its StackSet release process so that a bad update affects the smallest possible footprint and stops automatically before spreading. Which combination of changes should the team make? (Select TWO.)",
      options: [
        "Configure StackSet operation preferences with a low maximum concurrent account count, a region deployment order, and a failure tolerance of zero so the operation halts at the first failed stack instance.",
        "Deploy each update first to a dedicated test OU containing canary accounts, verify the result, and only then run the operation against the production OUs.",
        "Increase the maximum concurrency to all accounts in parallel so that updates complete before problems can compound.",
        "Delete the stack instances with retain-stacks enabled before every update and recreate them from the new template.",
        "Run drift detection on the StackSet after each deployment completes to identify accounts where the update failed."
      ],
      answer: [0, 1],
      multi: true,
      domain: "Continuous Improvement for Existing Solutions",
      explanation: `<p><strong>A</strong> and <strong>B</strong> together produce a staged, self-arresting rollout. Operation preferences (<strong>A</strong>) are StackSets' native blast-radius controls: low concurrency means few accounts are in flight at once, ordered regions create sequential waves, and failure tolerance zero stops the entire operation on the first failed instance instead of continuing across the fleet. A canary OU (<strong>B</strong>) ensures a defective template is exercised end-to-end in expendable accounts before any production account sees it, catching errors that succeed technically but break behavior, which tolerance settings alone cannot catch.</p><p><strong>C</strong> maximizes the blast radius; it is the precise opposite of the requirement, converting every future bad update into an instant fleet-wide incident.</p><p><strong>D</strong> abuses a decommissioning feature: delete-and-recreate churns every account on every release, orphans resources with retain-stacks, and provides no safety gate whatsoever.</p><p><strong>E</strong> is detection after the damage: drift detection reports divergence post-deployment and would not have stopped or shrunk the incident.</p>`
    },

    /* ============================================================
     * Domain 4: Accelerate Workload Migration and Modernization (10)
     * ============================================================ */

    {
      q: "A company must exit its data center in nine months, migrating 400 VMware virtual machines running mixed Windows and Linux workloads to AWS. Leadership has mandated rehosting with no application changes, cutover downtime of minutes per application, the ability to test each migrated server in AWS without affecting production, and migration in planned waves grouped by application. Which migration approach meets these requirements MOST efficiently?",
      options: [
        "Install the AWS Application Migration Service (MGN) replication agent on the source servers, replicate continuously at the block level into a staging area, run non-disruptive test launches for each wave, and perform cutovers per wave with minutes of downtime.",
        "Export each VM to OVA files, upload them to S3, convert them with VM Import/Export, and launch AMIs in dependency order during a cutover weekend.",
        "Use AWS Database Migration Service with ongoing replication to move each server's disks to AWS and switch DNS at cutover.",
        "Copy VM images onto AWS Snowball Edge devices, ship them to AWS, import them as AMIs, and launch the fleet during the final month."
      ],
      answer: [0],
      multi: false,
      domain: "Accelerate Workload Migration and Modernization",
      explanation: `<p><strong>A</strong> is correct. MGN is AWS's primary rehost service and matches every stated requirement by design: agent-based continuous block-level replication keeps AWS copies current while production runs, test launches spin up instances from the replicated data without interrupting the source or the replication, waves are the standard operating model (often coordinated through Migration Hub), and cutover is a final sync plus launch, yielding minutes of downtime.</p><p><strong>B</strong> is the legacy path: OVA export requires the VM to be quiesced or accept crash-consistent staleness, conversion cycles take hours per server, there is no continuous sync, so data written after export is lost or requires re-export, making per-application minutes of downtime unachievable across 400 VMs.</p><p><strong>C</strong> misapplies the tool: DMS replicates databases at the schema and row level; it does not migrate operating systems, applications, or server disks.</p><p><strong>D</strong> ships static point-in-time images: everything written after the copy is lost, cutover requires a long freeze, and there is no test-launch capability, so downtime and risk targets fail.</p>`
    },

    {
      q: "A company runs a 12 TB Oracle database with extensive PL/SQL packages on premises and wants to migrate it to Amazon Aurora PostgreSQL to eliminate license costs. The business allows a cutover window of only 30 minutes, and the application will be repointed at cutover. The team needs to understand up front how much stored code requires manual rework. Which migration approach should the team take?",
      options: [
        "Use Oracle Data Pump to export the database and import it into Aurora PostgreSQL during an extended weekend outage.",
        "Run AWS DMS with full load plus change data capture directly, since DMS converts the Oracle schema and PL/SQL code to PostgreSQL automatically during migration.",
        "Run the AWS Schema Conversion Tool to assess and convert the schema and stored code, remediate the items SCT flags for manual work, then use AWS DMS full load with ongoing change data capture and cut over once replication lag is near zero.",
        "Take a snapshot of the Oracle database with RDS tooling and restore the snapshot as an Aurora PostgreSQL cluster."
      ],
      answer: [2],
      multi: false,
      domain: "Accelerate Workload Migration and Modernization",
      explanation: `<p><strong>C</strong> is the standard heterogeneous migration pattern. SCT's assessment report quantifies exactly what the team asked for: the percentage of schema objects and PL/SQL that converts automatically versus needing manual rework. After conversion and remediation, DMS full load copies the 12 TB while the source stays live, CDC applies ongoing changes, and cutover happens when lag approaches zero, comfortably inside a 30-minute window.</p><p><strong>A</strong> fails twice: Data Pump output is Oracle-format and does not import into PostgreSQL without conversion, and an extended outage contradicts the 30-minute window.</p><p><strong>B</strong> contains the factual trap: DMS migrates data and basic table structures; it does not convert PL/SQL packages, procedures, triggers, or most schema objects. Without SCT the stored-code question is unanswered and the migration stalls at cutover.</p><p><strong>D</strong> is impossible: snapshots are engine-specific, and there is no snapshot-restore path from Oracle to Aurora PostgreSQL, let alone one that converts stored code.</p>`
    },

    {
      q: "A genomics research company must move 600 TB of sequencing data from an on-premises NAS to Amazon S3 within three weeks, after which the source storage lease ends. The site's internet connection is a 100 Mbps line that is also used for business traffic, and no Direct Connect exists. The data must be encrypted in transit and at rest. Which transfer method can realistically meet the deadline?",
      options: [
        "Deploy AWS DataSync on premises and run transfers at full line rate overnight and on weekends until the migration completes.",
        "Order multiple AWS Snowball Edge Storage Optimized devices in parallel, copy the data locally with the device's encryption, and ship them back to AWS for import into S3.",
        "Enable S3 Transfer Acceleration on the destination bucket and upload with multipart uploads over the existing line.",
        "Order a 10 Gbps AWS Direct Connect connection and transfer the data over it when it is activated."
      ],
      answer: [1],
      multi: false,
      domain: "Accelerate Workload Migration and Modernization",
      explanation: `<p><strong>B</strong> is correct, and the arithmetic decides it. At 100 Mbps fully saturated, throughput is roughly 1 TB per day, so 600 TB needs around 600 days, before allowing for business traffic sharing the line. Only offline transfer fits three weeks: Snowball Edge Storage Optimized devices hold large double-digit TB usable capacity each, multiple devices are loaded in parallel on the local network at LAN speeds, contents are encrypted with KMS-managed keys, and S3 import completes within days of receipt.</p><p><strong>A</strong> and <strong>C</strong> fail the same physics: DataSync and Transfer Acceleration optimize protocol efficiency and routing but cannot exceed the 100 Mbps physical line, so both miss the deadline by an order of magnitude or more.</p><p><strong>D</strong> fails on lead time: provisioning a new dedicated Direct Connect port and circuit through a provider typically takes weeks to months, so the connection would likely activate after the lease ends, and ordering it for a one-time bulk move is also poor economics.</p>`
    },

    {
      q: "During a phased data center migration, an on-premises NFS file share receives new laboratory instrument files all day and must remain the primary system for another year. A copy of the share's contents must land in Amazon S3 every night for cloud-side analytics, preserving file metadata and verifying data integrity end to end. The nightly copy must not saturate the shared 1 Gbps internet link during business hours, and only changed files should transfer. Which solution fits these requirements?",
      options: [
        "Run rsync on a cron schedule to an EC2 instance's EBS volume, then use the AWS CLI to upload the synchronized tree to S3.",
        "Deploy an Amazon S3 File Gateway on premises and have the laboratory systems write their files to the gateway share instead.",
        "Use the AWS CLI s3 sync command from a data center server, scheduled nightly by cron.",
        "Deploy an AWS DataSync agent on premises with a task from the NFS share to the S3 bucket, scheduled nightly, with bandwidth throttling configured and task verification enabled."
      ],
      answer: [3],
      multi: false,
      domain: "Accelerate Workload Migration and Modernization",
      explanation: `<p><strong>D</strong> maps feature-for-feature onto the requirements. DataSync tasks perform incremental transfers (only changed files), preserve POSIX metadata into S3 object metadata, compute checksums for end-to-end verification as a built-in task setting, support schedules natively, and enforce configurable bandwidth limits so the shared link stays usable; the source share remains untouched as the primary system.</p><p><strong>A</strong> is a two-hop homemade pipeline: it doubles the data movement, keeps an EC2 instance and EBS capacity running as staging, offers no integrated verification of the final S3 objects against the source, and bandwidth control and monitoring are all self-built.</p><p><strong>B</strong> changes the primary system, which the scenario forbids for another year: File Gateway is an access mechanism where S3 becomes the authoritative store behind a cache, not a one-way nightly replication tool for an existing authoritative NAS.</p><p><strong>C</strong> lacks the operational requirements: s3 sync has no bandwidth throttling, no metadata preservation guarantees for NFS attributes, and no end-to-end integrity verification report, and at millions of lab files its listing-based comparison becomes slow and fragile.</p>`
    },

    {
      q: "A manufacturing plant runs a quality-inspection application that reads and writes image files on a local Windows file server over SMB. The company is migrating storage to AWS but the application must stay on premises for two more years and requires LAN-speed access to the most recently written files. The company wants all files stored durably in Amazon S3 as the authoritative copy, accessible to cloud analytics immediately, while the plant keeps working over the existing SMB path with minimal change. Which solution meets these requirements?",
      options: [
        "Use AWS DataSync to migrate all files to S3 and modify the application to read and write through the S3 API.",
        "Deploy an Amazon S3 File Gateway appliance on premises, expose the same SMB share to the application, cache frequently and recently accessed files locally, and store every file durably as S3 objects available to analytics.",
        "Mount an Amazon EFS file system from the plant's servers across a VPN connection and move the files to EFS.",
        "Provision Amazon FSx for Windows File Server in the region and repoint the application's share path to it over the VPN."
      ],
      answer: [1],
      multi: false,
      domain: "Accelerate Workload Migration and Modernization",
      explanation: `<p><strong>B</strong> is the textbook fit. S3 File Gateway presents an SMB share locally, so the application keeps its protocol and nearly its path with minimal change; the local cache serves recently written images at LAN speed, satisfying the two-year on-premises constraint; and every file is uploaded as a native S3 object, making S3 the durable authoritative store that cloud analytics can read directly and immediately.</p><p><strong>A</strong> violates the minimal-change constraint head-on: rewriting a legacy plant application from SMB file semantics to S3 API calls is a modernization project the scenario defers, and it removes the required LAN-speed local access.</p><p><strong>C</strong> is doubly wrong: EFS speaks NFS, not SMB, so the Windows application cannot use it natively, and every read would traverse the VPN at WAN latency, failing the LAN-speed requirement.</p><p><strong>D</strong> keeps SMB but moves all I/O across the VPN, so latency-sensitive inspection reads no longer perform, and files in FSx are not native S3 objects, so the analytics-in-S3 requirement is unmet without an additional pipeline.</p>`
    },

    {
      q: "A company runs a monolithic Java e-commerce application on EC2 behind an Application Load Balancer, deployed as one artifact. Deployments are risky, and the roadmap calls for gradually converting the application to microservices. The business requires that the public hostname and client-facing API paths stay unchanged, that the monolith keeps serving everything that has not yet been extracted, and that each extracted capability can be released and rolled back independently without a rewrite freeze. Which modernization approach satisfies these requirements?",
      options: [
        "Apply the strangler fig pattern: keep the existing load balancer as the facade, extract one capability at a time into a new independently deployed service, and add listener rules that route only that capability's paths to the new service while the default rule continues to forward all remaining traffic to the monolith.",
        "Freeze feature development, rewrite the entire application as microservices over several quarters, and switch DNS to the new platform when the rewrite reaches feature parity.",
        "Containerize the monolith unchanged as a single large ECS service to modernize the platform first, and defer any decomposition until after the migration.",
        "Split the database into per-domain schemas first, then refactor the application code around the new data boundaries in a subsequent phase."
      ],
      answer: [0],
      multi: false,
      domain: "Accelerate Workload Migration and Modernization",
      explanation: `<p><strong>A</strong> is the strangler fig pattern implemented at the routing layer, and it satisfies each constraint mechanically: the hostname and paths never change because the ALB facade is constant; path-based listener rules peel off exactly the extracted capability, so the monolith serves everything else by default; each new service deploys and rolls back independently (removing a rule instantly reverts a capability to the monolith); and extraction proceeds incrementally with no freeze.</p><p><strong>B</strong> is the big-bang rewrite the pattern exists to avoid: a multi-quarter freeze violates the no-freeze requirement, and the single DNS cutover concentrates all risk into one event with no incremental rollback.</p><p><strong>C</strong> is a legitimate replatforming step but does not answer the question asked: a containerized monolith is still one deployable artifact, so nothing becomes independently releasable and the decomposition requirement is simply postponed.</p><p><strong>D</strong> inverts sensible sequencing: splitting a live monolith's database before service boundaries are proven in code is the highest-risk first move, breaking transactions and queries across the whole application at once.</p>`
    },

    {
      q: "A company is containerizing 12 internal web applications as part of a data center exit. The platform team is two engineers who also carry other duties. Requirements: no EC2 hosts or Kubernetes control planes to patch or upgrade, per-service load balancing and autoscaling, per-task IAM roles for least privilege, and predictable per-application isolation. The team has no existing Kubernetes expertise or investment. Which target platform is the MOST operationally efficient choice?",
      options: [
        "Amazon EKS with self-managed node groups and the Cluster Autoscaler.",
        "Docker Compose on a fleet of EC2 instances managed with Systems Manager.",
        "Amazon EKS with Fargate profiles for all workloads.",
        "Amazon ECS with the Fargate launch type, one service per application behind an Application Load Balancer, with service auto scaling and task IAM roles."
      ],
      answer: [3],
      multi: false,
      domain: "Accelerate Workload Migration and Modernization",
      explanation: `<p><strong>D</strong> is correct. ECS on Fargate eliminates every operational layer the team ruled out: no instances, no AMIs, no cluster capacity management, and ECS itself has no control plane the customer maintains or pays for. Services map one-to-one to applications with ALB integration, target-tracking auto scaling, task-level IAM roles, and VM-level isolation per task. For a two-person team with no Kubernetes investment, this is the minimum-operations target that meets all requirements.</p><p><strong>A</strong> is the maximum-operations option: node AMI patching, upgrades of both control plane version and node groups, and autoscaler care, plus the Kubernetes learning curve the team does not have.</p><p><strong>B</strong> is not a container platform: no orchestration, scheduling, service discovery, per-task IAM, or managed scaling; the team would hand-build all of it on hosts they must patch.</p><p><strong>C</strong> is the plausible near-miss: EKS on Fargate removes nodes but keeps Kubernetes itself, meaning cluster version upgrades on a fixed cadence, add-on management, and paying for and operating a control plane, all cost without benefit given zero existing Kubernetes investment.</p>`
    },

    {
      q: "A legacy integration between two systems works by a fleet of EC2 instances polling every 15 minutes: the job lists new order files in an S3 bucket, queries a database for matching records, and then runs a multi-step validation and enrichment sequence with retry logic implemented in shell scripts. The business wants orders processed within seconds of file arrival, wants the polling fleet retired, and wants each step's retries, error handling, and state visible and auditable. How should the architect modernize this integration?",
      options: [
        "Keep the polling architecture but reduce the interval to 1 minute and double the fleet size to handle the additional polling load.",
        "Have the upstream system write order events to a Kinesis data stream instead of S3, and rebuild the consumers to read from the stream.",
        "Enable Amazon S3 Event Notifications through Amazon EventBridge for the bucket and trigger an AWS Step Functions state machine for each arriving object, implementing the validation and enrichment steps as state machine tasks with built-in retries, catch handlers, and execution history.",
        "Containerize the existing polling scripts and run them as a scheduled Fargate task every 5 minutes to reduce EC2 management."
      ],
      answer: [2],
      multi: false,
      domain: "Accelerate Workload Migration and Modernization",
      explanation: `<p><strong>C</strong> is the event-driven refactor the scenario describes. S3-to-EventBridge notification fires within seconds of object creation, eliminating polling and its fleet entirely; EventBridge routing starts a Step Functions execution per object; and Step Functions natively provides exactly what the shell scripts fake today: declarative per-step retry with backoff, catch paths for errors, and a persisted, inspectable execution history that satisfies the auditability requirement.</p><p><strong>A</strong> keeps every liability and adds cost: latency is still up to a minute plus processing, the fleet grows instead of retiring, and retries remain buried in scripts.</p><p><strong>B</strong> modernizes by breaking a constraint that was not offered: it requires changing the upstream producer, which the scenario does not permit or mention, while the S3 arrival event already exists for free; it also still leaves orchestration and retry logic to be rebuilt in consumers.</p><p><strong>D</strong> is replatforming cosmetics: Fargate removes instance patching but the design remains a 5-minute poller, failing the seconds-level latency and the visibility requirements alike.</p>`
    },

    {
      q: "A company plans to migrate 1,200 on-premises servers hosting roughly 150 business applications to AWS. Before committing to a schedule, the migration lead must map which servers communicate with each other so that interdependent servers move in the same wave, measure actual utilization for right-sizing, and produce a defensible cost projection for the CFO. Almost no reliable documentation exists. Which combination of actions should the team take FIRST? (Select TWO.)",
      options: [
        "Deploy AWS Application Discovery Service agents to the servers to collect utilization metrics and network connection data into AWS Migration Hub.",
        "Begin AWS Application Migration Service replication for all 1,200 servers immediately so replication data reveals the dependencies.",
        "Use Migration Evaluator and the discovery data in Migration Hub to build the business case cost projection and group servers into dependency-based migration waves.",
        "Import the existing CMDB spreadsheet into a project tracker and derive the wave plan from its application-to-server mappings.",
        "Run AWS Trusted Advisor against the on-premises environment to identify inter-server dependencies and utilization."
      ],
      answer: [0, 2],
      multi: true,
      domain: "Accelerate Workload Migration and Modernization",
      explanation: `<p><strong>A</strong> and <strong>C</strong> are the assess-phase pair. Discovery Service agents (<strong>A</strong>) capture exactly the two missing datasets: time-series utilization for right-sizing and per-process network connections for dependency mapping, feeding Migration Hub as the single inventory. Migration Evaluator plus Migration Hub (<strong>C</strong>) turns that data into the two deliverables: a directional, CFO-ready cost projection grounded in measured utilization, and wave groupings that keep servers with observed communication paths together.</p><p><strong>B</strong> sequences the migration backwards: MGN replicates disk blocks, which reveals nothing about network dependencies, and standing up replication for 1,200 servers before planning wastes staging cost and bandwidth on servers whose wave, sizing, and disposition are unknown.</p><p><strong>D</strong> was ruled out by the scenario itself: the documentation is unreliable, and a stale CMDB is precisely how interdependent servers end up split across waves and breaking.</p><p><strong>E</strong> is a scope error: Trusted Advisor inspects AWS accounts and resources; it has no visibility into on-premises servers at all.</p>`
    },

    {
      q: "A company is migrating a 40 TB on-premises Windows file server to AWS. The file shares use SMB, permissions are enforced with fine-grained NTFS ACLs tied to the company's self-managed Active Directory, and thousands of users and applications reference the shares daily. The migration must preserve the existing permissions exactly, avoid rebuilding ACLs by hand, and present shares that Windows clients can use with their current AD identities. Which combination of steps meets these requirements? (Select TWO.)",
      options: [
        "Migrate the shares to Amazon EFS and mount the file system from the Windows clients.",
        "Provision Amazon FSx for Windows File Server joined to the company's existing self-managed Active Directory so that current users, groups, and NTFS permissions resolve unchanged.",
        "Copy the data to an S3 bucket with the AWS CLI and present it to users through an S3 File Gateway.",
        "Use AWS DataSync over SMB to copy the files, folders, and NTFS ACL metadata from the on-premises server to the FSx for Windows File Server file system.",
        "Copy the data with robocopy over a VPN without ACL options and recreate the permissions manually on the new file system."
      ],
      answer: [1, 3],
      multi: true,
      domain: "Accelerate Workload Migration and Modernization",
      explanation: `<p><strong>B</strong> and <strong>D</strong> are the matched destination and transfer method. FSx for Windows File Server (<strong>B</strong>) is the only fully managed AWS file service with native SMB and true NTFS ACL enforcement, and joining it to the existing self-managed AD means every SID in the copied ACLs continues to resolve to the same users and groups, so clients keep working with current identities. DataSync over SMB (<strong>D</strong>) is the transfer path that copies not just file data but NTFS ACLs, ownership, and timestamps to FSx, with scheduling, incremental passes for the final cutover delta, and integrity verification, eliminating manual ACL rebuilding for 40 TB.</p><p><strong>A</strong> is a protocol mismatch: EFS is NFS with POSIX permissions, so NTFS ACLs cannot be preserved and Windows clients lack native access.</p><p><strong>C</strong> flattens the security model: objects in S3 do not carry NTFS ACLs, and the CLI copy discards them, so permissions would need reconstruction in a different model.</p><p><strong>E</strong> concedes the requirement: without ACL copying, thousands of permission entries would be rebuilt by hand, the exact outcome the migration must avoid.</p>`
    }

  ]
});
