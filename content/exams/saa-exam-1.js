/* SAA-C03 Practice Exam 1 — 65 questions
 * Domain distribution:
 *   Design Secure Architectures        — 20
 *   Design Resilient Architectures     — 17
 *   Design High-Performing Architectures — 16
 *   Design Cost-Optimized Architectures  — 12
 */
window.COURSE.registerExam({
  id: "saa-1",
  track: "saa",
  title: "SAA-C03 Practice Exam 1",
  timeMinutes: 130,
  questions: [

    /* ================= Design Secure Architectures (20) ================= */

    {
      q: "A company stores confidential documents in an Amazon S3 bucket. Compliance rules state that the documents must be accessible only from EC2 instances inside one specific VPC, and requests must never traverse the public internet. The VPC already has a gateway VPC endpoint for S3. What should a solutions architect do to enforce this requirement?",
      options: [
        "Attach a network ACL to the VPC subnets that allows outbound traffic only to the S3 public IP ranges",
        "Enable S3 Transfer Acceleration and require signed URLs generated inside the VPC",
        "Add a bucket policy that denies all requests unless the aws:SourceVpce condition matches the VPC endpoint ID",
        "Configure an S3 access control list that grants read access to the VPC CIDR range"
      ],
      answer: [2],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>C</strong> is correct. A bucket policy with a Deny statement conditioned on <code>aws:SourceVpce</code> rejects every request that does not arrive through the specific gateway endpoint, so access is possible only from inside that VPC and the traffic stays on the AWS network. This is the standard pattern for locking a bucket to a VPC endpoint.</p><p><strong>A</strong> controls what the subnets can reach, not who can access the bucket — any other principal on the internet could still call the bucket, and NACLs cannot express S3-level authorization. <strong>B</strong> misuses Transfer Acceleration, which is a performance feature that actually routes through public edge endpoints; signed URLs also work from anywhere, not just the VPC. <strong>D</strong> is impossible: S3 ACLs grant access to AWS accounts or predefined groups, not to CIDR ranges, and ACLs are a legacy mechanism that should be disabled in favor of policies.</p>`
    },

    {
      q: "An application running on Amazon EC2 instances must read from and write to a DynamoDB table. A security review found long-term IAM user access keys stored in the application's configuration files. What is the MOST secure way to provide the application with credentials?",
      options: [
        "Move the access keys to an encrypted Amazon S3 bucket and download them when the instance boots",
        "Create an IAM role with DynamoDB permissions and attach it to the instances through an instance profile",
        "Store the access keys in AWS Secrets Manager and rotate them automatically every 30 days",
        "Encrypt the configuration files with an AWS KMS key and decrypt them when the application starts"
      ],
      answer: [1],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>B</strong> is correct. An IAM role delivered via an instance profile gives the application automatically rotated, short-lived credentials through the instance metadata service. No long-term secret exists anywhere — there is nothing to leak, store, or rotate, which is exactly what the review is asking for.</p><p><strong>A</strong> merely relocates the long-term keys; anyone who can read the bucket or the instance disk still obtains permanent credentials. <strong>C</strong> is the best answer for third-party secrets like database passwords, but for AWS API access it still keeps long-term IAM keys alive and adds rotation machinery that roles make unnecessary. <strong>D</strong> protects the file at rest but the plaintext keys still exist in memory and remain valid long-term credentials — encryption does not address the fundamental problem that static keys should not exist at all for EC2-hosted workloads.</p>`
    },

    {
      q: "A web application on EC2 connects to an RDS for MySQL database with a password that security policy says must be rotated every 60 days. The operations team wants rotation to happen automatically with the LEAST operational overhead. Which solution meets these requirements?",
      options: [
        "Store the credentials in AWS Secrets Manager and enable managed automatic rotation on a 60-day schedule",
        "Store the credentials in AWS Systems Manager Parameter Store as a SecureString and rotate them with a custom Lambda function on an EventBridge schedule",
        "Encrypt the credentials with an AWS KMS customer managed key and store the ciphertext in a DynamoDB table",
        "Keep the credentials in an encrypted configuration file and redeploy the application whenever they change"
      ],
      answer: [0],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>A</strong> is correct. Secrets Manager has native, managed rotation for RDS: it provisions the rotation Lambda for you, updates the database password and the stored secret in one step, and applications always fetch the current value at connect time. That is rotation with essentially zero ongoing work.</p><p><strong>B</strong> can be made to work, but Parameter Store has no built-in rotation — you must write, secure, and maintain the rotation Lambda and its scheduling yourself, which is precisely the operational overhead the question excludes. <strong>C</strong> provides encrypted storage but no rotation mechanism at all; you would still build the entire rotation workflow. <strong>D</strong> is the worst option: manual rotation coupled to application redeployments guarantees drift, outages during password changes, and human involvement every 60 days.</p>`
    },

    {
      q: "Account A owns an S3 bucket whose objects are encrypted with a customer managed AWS KMS key that also resides in Account A. An application role in Account B must download and decrypt these objects. Which TWO steps are required to enable this access? (Select TWO.)",
      options: [
        "Update the KMS key policy in Account A to allow the Account B role to call kms:Decrypt",
        "Enable automatic annual rotation on the KMS key",
        "Re-encrypt the objects with an AWS managed key so they can be shared across accounts",
        "Add a bucket policy in Account A that grants the Account B role s3:GetObject on the bucket",
        "Turn off S3 Block Public Access on the bucket in Account A"
      ],
      answer: [0, 3],
      multi: true,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>A</strong> and <strong>D</strong> are correct. Cross-account access to SSE-KMS objects requires authorization on both resources involved: the bucket policy must grant the external principal <code>s3:GetObject</code>, and the KMS key policy must allow that principal to decrypt with the key (the role in Account B also needs matching IAM permissions). Missing either side produces an access-denied error even though the other grant exists.</p><p><strong>B</strong> is irrelevant — rotation changes backing key material on a schedule but has nothing to do with authorization. <strong>C</strong> goes backwards: AWS managed keys (aws/s3) can never be used cross-account, because you cannot edit their key policies; customer managed keys are exactly what makes this scenario possible. <strong>E</strong> is unnecessary and harmful — Block Public Access does not block authenticated cross-account principals granted by policy, and disabling it broadly weakens the bucket's posture.</p>`
    },

    {
      q: "A company serves a static website from an S3 bucket through an Amazon CloudFront distribution. A security audit found that users can bypass CloudFront and fetch objects directly from the S3 bucket URL. The bucket must remain private and serve content only through CloudFront. What should a solutions architect do?",
      options: [
        "Enable S3 Transfer Acceleration so requests resolve only to CloudFront edge locations",
        "Configure a bucket policy that allows requests only from CloudFront's published IP address ranges",
        "Require CloudFront signed URLs for all objects in the distribution",
        "Create an origin access control (OAC) for the distribution and add a bucket policy that allows access only from that specific distribution"
      ],
      answer: [3],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>D</strong> is correct. Origin access control makes CloudFront sign its origin requests with SigV4; the bucket policy then grants <code>s3:GetObject</code> only to the CloudFront service principal, with a condition limiting it to the distribution's ARN. Direct bucket requests fail because no other principal is allowed, and the bucket stays fully private. OAC is the successor to origin access identity (OAI) and is the current recommended pattern.</p><p><strong>A</strong> is a transfer performance feature; it does nothing to restrict access and the regular bucket endpoint remains reachable. <strong>B</strong> is fragile and wrong in principle: CloudFront IP ranges are shared by every CloudFront customer, so any other distribution could read the bucket, and the ranges change over time. <strong>C</strong> controls who can request objects through CloudFront (viewer-side), but does not stop anyone from hitting the S3 URL directly, which is the actual finding.</p>`
    },

    {
      q: "A web application behind an Application Load Balancer is being probed with SQL injection and cross-site scripting attempts. The company wants to block these common web exploits before they reach the application, with the LEAST operational overhead. Which solution meets these requirements?",
      options: [
        "Enable Amazon GuardDuty and configure automatic remediation with Lambda functions",
        "Associate an AWS WAF web ACL with the ALB and enable the relevant AWS managed rule groups",
        "Subscribe the ALB to AWS Shield Advanced",
        "Deploy AWS Network Firewall in front of the ALB with custom Suricata rules"
      ],
      answer: [1],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>B</strong> is correct. AWS WAF operates at layer 7 and attaches directly to the ALB; the AWS managed rule groups (Core rule set, SQL database, known bad inputs) block SQLi and XSS patterns out of the box and are maintained by AWS — minimal setup, no rule authoring, no infrastructure.</p><p><strong>A</strong> misapplies GuardDuty: it is a threat-detection service that analyzes logs after the fact; it does not sit inline and cannot block an HTTP request. <strong>C</strong> targets the wrong threat class — Shield Advanced is for DDoS mitigation, not request-content inspection; SQLi passes straight through it. <strong>D</strong> could technically inspect traffic, but Network Firewall is a VPC-level engine where you would write and maintain your own Suricata rules and rearchitect traffic flow — far more operational overhead than attaching managed WAF rules, so it fails the qualifier.</p>`
    },

    {
      q: "A three-tier application runs on EC2. The database tier listens on port 3306 and must accept connections only from the application tier, which scales in and out throughout the day, so instance IP addresses change frequently. How should a solutions architect configure network access to the database tier?",
      options: [
        "Create a network ACL rule that allows port 3306 from the application subnet CIDR ranges",
        "Maintain the application instances' private IP addresses in the database security group with a scheduled Lambda function",
        "Create a security group for the database tier that allows inbound port 3306 only from the application tier's security group",
        "Place the database instances in a dedicated VPC and create a peering connection from the application VPC"
      ],
      answer: [2],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>C</strong> is correct. Security groups can reference other security groups as the traffic source. Every instance launched by the Auto Scaling group carries the app-tier security group, so database access follows membership automatically no matter how often instances churn or what IPs they receive. This is the canonical tier-to-tier pattern.</p><p><strong>A</strong> is coarser and weaker: a subnet CIDR rule admits anything placed in those subnets, not just app-tier instances, and NACLs are stateless, forcing you to manage ephemeral-port return rules. <strong>B</strong> reinvents what security group references already do, adds a Lambda to build and operate, and leaves windows where scaling events outpace the sync schedule. <strong>D</strong> changes network topology without solving authorization — after peering you would still need source controls, and cross-VPC security group references are limited, so this adds complexity for no security gain.</p>`
    },

    {
      q: "A company must give an external auditing firm read-only access to specific resources in its AWS account for an annual review. The auditors operate from their own AWS account. Security policy prohibits creating IAM users for third parties. Which TWO actions should a solutions architect take? (Select TWO.)",
      options: [
        "Create IAM users for the auditors and attach the ReadOnlyAccess managed policy",
        "Create an IAM role with a read-only permissions policy and a trust policy that allows the auditor account to assume it",
        "Generate long-term access keys scoped to read-only actions and deliver them to the auditors over an encrypted channel",
        "Enable AWS IAM Identity Center and add the auditors as workforce users in the company directory",
        "Require an external ID condition in the role's trust policy to protect against the confused deputy problem"
      ],
      answer: [1, 4],
      multi: true,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>B</strong> and <strong>E</strong> are correct. Cross-account access for a third party is done with an IAM role: the trust policy names the auditor account as the principal, the permissions policy limits actions to read-only on the resources in scope, and the auditors receive short-lived STS credentials when they assume it. Because the auditors serve many clients, the trust policy should also require a unique external ID, which prevents a confused-deputy attack where another customer tricks the firm into assuming your role.</p><p><strong>A</strong> and <strong>C</strong> both violate the stated policy and best practice — they create long-term credentials for people outside the organization, which cannot be centrally revoked by the auditors' own security controls. <strong>D</strong> misuses Identity Center: it manages your workforce identities; adding external auditors to the corporate directory blurs the trust boundary rather than establishing a scoped cross-account one.</p>`
    },

    {
      q: "A security team wants continuous, intelligent threat detection across its AWS accounts, including detection of compromised EC2 instances, anomalous API activity, and connections to known malicious IP addresses. The team does not want to deploy or manage any agents or infrastructure. Which service should they enable?",
      options: [
        "Amazon GuardDuty",
        "Amazon Inspector",
        "AWS Config",
        "Amazon Detective"
      ],
      answer: [0],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>A</strong> is correct. GuardDuty is exactly this: an agentless, continuously running threat-detection service that consumes CloudTrail management and data events, VPC Flow Logs, and DNS query logs, applies threat intelligence and ML models, and raises findings for things like credential exfiltration, cryptocurrency mining, and communication with known-bad IPs. You enable it per account or organization-wide and there is nothing to operate.</p><p><strong>B</strong> is a vulnerability management service — it scans EC2 instances, container images, and Lambda functions for CVEs and unintended network exposure; it does not detect active threats or anomalous API calls. <strong>C</strong> records resource configuration state and evaluates compliance rules; it is a configuration audit tool, not a threat detector. <strong>D</strong> is for investigating findings after detection — Detective builds behavior graphs to help analyze incidents, and it actually relies on GuardDuty findings as an input rather than replacing it.</p>`
    },

    {
      q: "A company suspects that objects spread across hundreds of its S3 buckets contain unencrypted personally identifiable information such as names and credit card numbers. The security team needs an automated, scalable way to discover, classify, and report this sensitive data. Which solution meets these requirements?",
      options: [
        "Run Amazon Inspector assessments against the S3 buckets",
        "Enable Amazon GuardDuty S3 protection to classify the objects",
        "Use AWS Glue crawlers to catalog the data and query for sensitive fields with Athena",
        "Enable Amazon Macie and run sensitive data discovery jobs across the buckets"
      ],
      answer: [3],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>D</strong> is correct. Macie is purpose-built for this: it uses managed data identifiers (and custom ones) to find PII, financial data, and credentials inside S3 objects at scale, evaluates bucket-level security posture such as public access and encryption, and produces findings you can route to Security Hub or EventBridge. Discovery jobs can sweep hundreds of buckets automatically.</p><p><strong>A</strong> is wrong because Inspector assesses software vulnerabilities and network reachability on compute resources — it does not read S3 object contents. <strong>B</strong> misstates GuardDuty's S3 protection, which detects suspicious access patterns (e.g., unusual GetObject activity) from CloudTrail data events; it never inspects or classifies object contents. <strong>C</strong> could be built, but Glue and Athena have no notion of PII detection — you would hand-write classification logic, pay to scan everything repeatedly, and maintain the pipeline, which is not an automated discovery solution.</p>`
    },

    {
      q: "EC2 instances in private subnets with no internet connectivity must send messages to an Amazon SQS queue. Company policy requires that this traffic never leave the AWS network and that no NAT devices be introduced. What should a solutions architect do?",
      options: [
        "Create a gateway VPC endpoint for SQS and update the private subnet route tables",
        "Create an interface VPC endpoint for SQS in the VPC and allow HTTPS from the instances' security group",
        "Deploy a NAT gateway in a public subnet and route SQS traffic through it",
        "Establish VPC peering between the private subnets and the SQS service endpoint"
      ],
      answer: [1],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>B</strong> is correct. SQS is reached privately through an interface VPC endpoint (AWS PrivateLink), which places elastic network interfaces with private IPs in your subnets. The instances resolve the SQS endpoint to those private IPs and traffic stays entirely on the AWS network, with a security group on the endpoint controlling access.</p><p><strong>A</strong> is a trap on the endpoint types: gateway endpoints exist only for S3 and DynamoDB — there is no gateway endpoint for SQS. <strong>C</strong> works technically but violates both stated constraints: it introduces a NAT device, and traffic egresses to the public SQS endpoint over the internet. <strong>D</strong> is not possible — SQS is a regional service, not a customer VPC, so there is nothing to peer with; peering only connects two VPCs.</p>`
    },

    {
      q: "A financial services company must retain transaction records in Amazon S3 for seven years in a write-once-read-many (WORM) model. Regulators require assurance that no user, including account administrators and the root user, can delete or overwrite the records during the retention period. Which solution meets these requirements?",
      options: [
        "Enable S3 Object Lock in compliance mode with a seven-year retention period on a new versioned bucket",
        "Enable S3 Object Lock in governance mode and remove the s3:BypassGovernanceRetention permission from administrators",
        "Enable S3 Versioning and attach a bucket policy that denies s3:DeleteObject for seven years",
        "Enable MFA Delete on the bucket and hold the MFA device with the compliance team"
      ],
      answer: [0],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>A</strong> is correct. Object Lock compliance mode is the only S3 mechanism that makes retention truly immutable: protected object versions cannot be overwritten or deleted by anyone — not administrators, not the root user — and the retention period itself cannot be shortened. That matches a regulator-grade WORM requirement exactly (Object Lock requires versioning, hence the new versioned bucket).</p><p><strong>B</strong> fails the 'no user' test: governance mode is bypassable by any principal granted <code>s3:BypassGovernanceRetention</code>, and an administrator can simply grant that permission back to themselves — the control is advisory against a privileged insider. <strong>C</strong> is even weaker: whoever can edit the bucket policy can remove the deny, so it protects nothing against admins. <strong>D</strong> only guards version deletions behind an MFA prompt for the root user; it is deprecated in practice, cumbersome, and not a WORM control.</p>`
    },

    {
      q: "A company uses AWS Organizations with all features enabled. Security policy states that workloads may run only in eu-west-1 and eu-central-1, and this restriction must be enforced in every member account, including against account administrators. What is the MOST effective way to implement this control?",
      options: [
        "Attach an IAM policy that denies other Regions to every IAM role in each member account",
        "Create an AWS Config rule in each account that flags resources created outside the approved Regions",
        "Attach a service control policy to the organization root that denies actions outside eu-west-1 and eu-central-1, with exemptions for global services",
        "Set a permissions boundary limiting actions to the approved Regions on all IAM principals"
      ],
      answer: [2],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>C</strong> is correct. A service control policy is the only preventive guardrail that applies to every principal in a member account — including the account's administrators and root user — and cannot be removed from inside the account. The standard region-restriction SCP denies requests where <code>aws:RequestedRegion</code> is outside the allowed list, carving out global services like IAM, CloudFront, and Route 53 whose control planes live elsewhere.</p><p><strong>A</strong> fails against administrators: anyone with IAM permissions in the account can detach or edit the policy, and keeping it attached to every role forever is unmanageable. <strong>B</strong> is detective, not preventive — Config flags a violation after the resource already exists, which does not satisfy 'enforced'. <strong>D</strong> has the same self-defeating property as A: permissions boundaries are set per-principal by account admins, so the very people the control must bind can lift it.</p>`
    },

    {
      q: "During an audit, a solutions architect discovers that a production EC2 instance uses an unencrypted EBS volume containing sensitive data. Company policy requires all EBS volumes to be encrypted at rest with AWS KMS. How can the architect bring this volume into compliance?",
      options: [
        "Enable EBS encryption by default for the account so the existing volume becomes encrypted automatically",
        "Modify the volume's properties and select the encryption option while the instance is stopped",
        "Attach the volume to a new instance that was launched from an encrypted AMI",
        "Create a snapshot of the volume, copy the snapshot with encryption enabled, create a new volume from the encrypted copy, and swap it onto the instance"
      ],
      answer: [3],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>D</strong> is correct. There is no in-place encryption for an existing EBS volume. The supported path is: snapshot the unencrypted volume, copy the snapshot with encryption enabled (choosing the KMS key), create a new volume from the encrypted snapshot in the instance's AZ, detach the old volume, and attach the new one.</p><p><strong>A</strong> is a common trap: encryption by default applies only to volumes and snapshot copies created after the setting is enabled — it never retroactively encrypts existing volumes. <strong>B</strong> describes a capability that does not exist; <code>ModifyVolume</code> can change size, type, and IOPS, but the encryption state of a volume is immutable after creation. <strong>C</strong> changes nothing about the volume itself — encryption is a property of the volume, not of the instance it is attached to, so the data remains unencrypted at rest.</p>`
    },

    {
      q: "An operations team connects to Linux EC2 instances in private subnets through a bastion host using shared SSH keys. The security team wants to eliminate the bastion host and SSH key management, control access with IAM policies, and record all interactive sessions. Which solution meets these requirements with the LEAST operational overhead?",
      options: [
        "Replace the bastion host with an EC2 Instance Connect endpoint and rotate the SSH keys with Secrets Manager",
        "Use AWS Systems Manager Session Manager with session logging to S3 or CloudWatch Logs, and remove inbound SSH access entirely",
        "Deploy an AWS Client VPN endpoint and require certificate-based mutual authentication before SSH",
        "Run a hardened bastion host in an Auto Scaling group and ship its session logs with the CloudWatch agent"
      ],
      answer: [1],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>B</strong> is correct. Session Manager checks every requirement natively: access is granted and scoped by IAM policies, sessions run through the SSM agent over an outbound channel so instances need no inbound ports, no bastion, and no SSH keys at all, and full session transcripts can be written to S3 or CloudWatch Logs for audit. It is a managed feature — nothing extra to run.</p><p><strong>A</strong> removes the bastion but keeps SSH and key material in play (Instance Connect still pushes short-lived SSH keys), and it does not provide session content recording. <strong>C</strong> preserves both SSH and key/certificate management, adds a VPN to operate and pay for, and still lacks session logging. <strong>D</strong> is the status quo with extra automation: keys, a bastion fleet, and log shipping all remain yours to maintain — the opposite of least operational overhead.</p>`
    },

    {
      q: "An internal web application runs behind an Application Load Balancer. The company wants employees to authenticate against its corporate OpenID Connect (OIDC) identity provider before any request reaches the application servers, without modifying application code. What should a solutions architect do?",
      options: [
        "Configure an authenticate action on the ALB listener rules that federates with the corporate OIDC identity provider",
        "Create IAM users for each employee and require requests to be signed with Signature Version 4",
        "Integrate the Amazon Cognito SDK into the application and validate tokens in the request handlers",
        "Restrict the ALB security group to the IP address range of the corporate VPN"
      ],
      answer: [0],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>A</strong> is correct. The ALB supports built-in authentication: a listener rule with an authenticate-oidc action redirects unauthenticated users to the corporate IdP, completes the OIDC flow, manages the session cookie, and only forwards authenticated requests to targets (passing identity claims in headers). The application code is untouched, which is the stated constraint.</p><p><strong>B</strong> confuses workforce web authentication with AWS API authentication — SigV4 signing is for AWS service calls, browsers cannot do it for ordinary page loads, and per-employee IAM users are an anti-pattern. <strong>C</strong> achieves authentication but directly violates the requirement, since it requires embedding an SDK and token validation logic in the application. <strong>D</strong> is network filtering, not authentication: anyone on the VPN reaches the app anonymously, there is no user identity, and the IdP requirement is simply unmet.</p>`
    },

    {
      q: "A company's public gaming platform, fronted by CloudFront and Route 53, has suffered repeated large-scale DDoS attacks that caused outages and unexpected scaling charges. The company wants enhanced DDoS mitigation, near-real-time attack visibility, access to a specialized AWS response team during attacks, and financial protection against attack-driven usage spikes. Which offering meets these requirements?",
      options: [
        "AWS WAF with rate-based rules on the CloudFront distribution",
        "AWS Shield Standard",
        "AWS Shield Advanced",
        "Amazon GuardDuty with an EventBridge-triggered response runbook"
      ],
      answer: [2],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>C</strong> is correct. Shield Advanced is the only offering that covers all four asks: tailored detection and mitigation for protected resources (CloudFront, Route 53, ALB, EIP, Global Accelerator), near-real-time attack diagnostics and CloudWatch metrics, 24x7 access to the Shield Response Team, and cost protection credits for scaling charges caused by a DDoS attack. It also bundles WAF usage for protected resources at no extra charge.</p><p><strong>A</strong> helps throttle abusive request floods at layer 7 but offers no response team, no attack-cost protection, and limited visibility into volumetric layer 3/4 events. <strong>B</strong> is automatic and free but provides only baseline network-layer protection — no SRT access, no diagnostics, no financial safeguards, which is why the company is still suffering. <strong>D</strong> is detection-after-the-fact tooling; GuardDuty does not mitigate volumetric attacks against edge services and provides none of the contractual protections requested.</p>`
    },

    {
      q: "A healthcare company stores patient records in an S3 bucket. Compliance requires that every object be encrypted at rest with a customer managed KMS key and that any request made over unencrypted HTTP be rejected. Which TWO actions should a solutions architect take? (Select TWO.)",
      options: [
        "Configure default bucket encryption using SSE-KMS with the customer managed key",
        "Configure default bucket encryption using SSE-S3 managed keys",
        "Add a bucket policy that denies all requests where the aws:SecureTransport condition is false",
        "Enable S3 Transfer Acceleration to force TLS on all requests",
        "Distribute the KMS key material to applications and require client-side encryption"
      ],
      answer: [0, 2],
      multi: true,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>A</strong> and <strong>C</strong> are correct. Default bucket encryption with SSE-KMS and the specified customer managed key guarantees every new object is encrypted at rest under a key the company controls and can audit through CloudTrail. Encryption in transit is enforced with a bucket policy Deny where <code>aws:SecureTransport</code> is <code>false</code>, which rejects any plain-HTTP request outright — the standard control for this requirement.</p><p><strong>B</strong> encrypts at rest but with S3-managed keys, failing the explicit customer-managed-key requirement (no key policy control, no independent audit trail of key usage). <strong>D</strong> is a performance feature; it does not force TLS, and the regular endpoints still accept HTTP unless a policy denies it. <strong>E</strong> is both insecure and impossible as described — KMS never releases customer managed key material for distribution, and pushing key handling into every client multiplies risk instead of centralizing it.</p>`
    },

    {
      q: "A developer is building a service that must encrypt files up to 500 MB using keys managed in AWS KMS before storing the files in an on-premises archive. Test calls to the KMS Encrypt API fail for these files. What is the correct approach?",
      options: [
        "Split each file into 4 KB chunks and encrypt each chunk with a separate KMS Encrypt call",
        "Request a KMS quota increase through Service Quotas so larger payloads are accepted",
        "Switch to an asymmetric KMS key, which supports larger encryption payloads",
        "Call GenerateDataKey to obtain a data key, encrypt the file locally with it, and store the encrypted data key alongside the file"
      ],
      answer: [3],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>D</strong> is correct — this is envelope encryption, the pattern KMS is designed around. <code>GenerateDataKey</code> returns a plaintext data key plus the same key encrypted under the KMS key. The service encrypts the file locally with the data key (fast, any size), discards the plaintext key, and stores the encrypted data key with the file. Decryption later calls <code>kms:Decrypt</code> on the small encrypted data key only. The KMS key never leaves KMS and access remains auditable.</p><p><strong>A</strong> technically fits under the 4 KB Encrypt limit but is absurd at scale: roughly 128,000 API calls per file, with throttling, cost, and reassembly complexity. <strong>B</strong> misunderstands the limit — 4 KB is a hard API constraint on payload size, not an adjustable quota. <strong>C</strong> is backwards: asymmetric KMS keys support even smaller payloads (bounded by the RSA key size and padding), and they exist for signing and small-secret exchange, not bulk data.</p>`
    },

    {
      q: "A company with 40 AWS accounts in AWS Organizations wants employees to sign in once with their existing Microsoft Entra ID credentials and receive short-lived credentials for the accounts they are permitted to access. The company wants permissions managed centrally with the LEAST operational overhead. Which solution meets these requirements?",
      options: [
        "Enable AWS IAM Identity Center, federate it with Entra ID over SAML, and assign permission sets to users and accounts",
        "Create IAM users in each account and synchronize their passwords with Entra ID",
        "Deploy Amazon Cognito user pools federated with Entra ID and exchange tokens for IAM credentials in each account",
        "Configure SAML federation directly with IAM in each of the 40 accounts and manage roles per account"
      ],
      answer: [0],
      multi: false,
      domain: "Design Secure Architectures",
      explanation: `<p><strong>A</strong> is correct. IAM Identity Center is the purpose-built workforce SSO layer for Organizations: one SAML (plus SCIM provisioning) integration with Entra ID, centrally defined permission sets that Identity Center materializes as roles in every assigned account, a single access portal, and automatic short-lived credentials. Adding an account or changing a permission set is one central operation.</p><p><strong>B</strong> is the anti-pattern the question targets — 40 sets of long-term IAM users, no true single sign-on, and password sync machinery to maintain. <strong>C</strong> misuses Cognito, which provides identity for customer-facing applications; wiring it to vend workforce IAM credentials across 40 accounts means building and operating a custom broker. <strong>D</strong> works but multiplies effort by 40: every account needs its own identity provider configuration, role definitions, and relying-party setup in Entra ID, and there is no central view — far more overhead than Identity Center.</p>`
    },

    /* ================= Design Resilient Architectures (17) ================= */

    {
      q: "A company runs its order database on a single Amazon RDS for PostgreSQL instance. A recent Availability Zone disruption made the database unavailable for several hours. The company needs automatic failover with minimal downtime and no application changes beyond reconnecting to the same endpoint. Which solution meets these requirements?",
      options: [
        "Create a cross-Region read replica and promote it manually if the primary fails",
        "Convert the instance to a Multi-AZ deployment with a synchronous standby in another Availability Zone",
        "Schedule hourly snapshots and restore to a new instance in another Availability Zone during failures",
        "Add a read replica in another Availability Zone and update the application to write to it during outages"
      ],
      answer: [1],
      multi: false,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>B</strong> is correct. RDS Multi-AZ maintains a synchronously replicated standby in a different AZ and fails over automatically, typically within about a minute or two, by repointing the same DNS endpoint at the standby. The application only needs to reconnect — exactly the stated constraints, with no data loss because replication is synchronous.</p><p><strong>A</strong> is a disaster recovery construct for Regional failure: replication is asynchronous (possible data loss), promotion is a manual or scripted decision, and the endpoint changes — none of which delivers automatic minimal-downtime AZ failover. <strong>C</strong> means up to an hour of data loss and a lengthy manual restore; hours of downtime is what the company is trying to escape. <strong>D</strong> does not work as written: PostgreSQL read replicas are read-only until explicitly promoted, so the application cannot simply write to one, and promotion is manual and one-way.</p>`
    },

    {
      q: "A stateless web application runs on six EC2 instances in a single Availability Zone behind an Application Load Balancer. A solutions architect must redesign the deployment so the application stays available and automatically replaces failed instances if any single Availability Zone becomes unavailable. What should the architect recommend?",
      options: [
        "Move the instances into a cluster placement group that spans multiple Availability Zones",
        "Pre-provision six standby instances in a second Availability Zone and switch traffic with Route 53 failover records",
        "Enable EC2 automatic recovery to restart the instances in a healthy Availability Zone",
        "Create an Auto Scaling group spanning at least two Availability Zones behind the ALB, with ELB health checks enabled"
      ],
      answer: [3],
      multi: false,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>D</strong> is correct. An Auto Scaling group with subnets in two or more AZs distributes capacity across zones and, with ELB health checks, terminates and replaces instances that fail health checks — including relaunching capacity in surviving AZs during a zonal outage. The ALB (itself multi-AZ) stops routing to the failed zone automatically. This is the canonical self-healing web tier.</p><p><strong>A</strong> is impossible and backwards: cluster placement groups exist within a single AZ and are a low-latency feature, not an availability one. <strong>B</strong> doubles cost with idle capacity and still lacks automatic instance replacement; DNS failover also adds TTL-dependent delay for a problem the ALB plus ASG solve natively. <strong>C</strong> misapplies EC2 auto recovery, which recovers an instance onto healthy hardware in the same AZ — it cannot move instances to another AZ and does not help when the whole zone is impaired.</p>`
    },

    {
      q: "An e-commerce site writes each order synchronously to a downstream fulfillment service. During flash sales the fulfillment service is overwhelmed, returns errors, and orders are lost. The company wants to stop losing orders and allow the fulfillment tier to process work at its own pace. What should a solutions architect recommend?",
      options: [
        "Publish orders to an SQS queue and have the fulfillment service poll and process messages at its own rate",
        "Publish orders to an SNS topic with the fulfillment service subscribed as an HTTPS endpoint",
        "Scale the fulfillment service vertically to the largest available instance size",
        "Stream orders through Amazon Kinesis Data Firehose directly into the fulfillment database"
      ],
      answer: [0],
      multi: false,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>A</strong> is correct. An SQS queue decouples producers from consumers: orders are durably persisted (redundantly across AZs) the moment they are sent, the web tier gets an immediate acknowledgment, and the fulfillment tier pulls messages at whatever rate it can sustain. Backlogs simply grow during spikes instead of turning into errors, and a dead-letter queue can catch poison messages.</p><p><strong>B</strong> keeps the push model that is failing: SNS delivers as fast as messages arrive, and although it retries HTTPS endpoints, messages are eventually dropped if the subscriber stays saturated — it buffers nothing at the consumer's pace. <strong>C</strong> raises the ceiling but keeps the tight coupling; a large enough sale still overwhelms it, and it fails without any buffer. <strong>D</strong> misuses Firehose, which delivers to destinations like S3, Redshift, and OpenSearch — not to an arbitrary application database — and near-real-time batch delivery is not an application decoupling mechanism.</p>`
    },

    {
      q: "A company hosts its marketing website on EC2 instances behind an ALB in one Region. Management wants visitors automatically redirected to a static maintenance page if the site becomes unhealthy, with no manual DNS changes during an outage. Which solution meets this requirement?",
      options: [
        "Configure a Route 53 weighted routing policy that sends 90 percent of traffic to the ALB and 10 percent to a backup page",
        "Put CloudFront in front of the ALB and increase the origin response timeout",
        "Create a Route 53 failover record with a health check on the primary ALB and a secondary record pointing to a static site in S3 served through CloudFront",
        "Allocate an Elastic IP address and remap it to a backup web server when a CloudWatch alarm fires"
      ],
      answer: [2],
      multi: false,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>C</strong> is correct. Route 53 failover routing does exactly this: a health check continuously probes the primary ALB, and when it fails, Route 53 automatically answers queries with the secondary record — a static S3 website fronted by CloudFront (which also allows HTTPS on a custom domain). Recovery is equally automatic when the primary passes health checks again.</p><p><strong>A</strong> misuses weighted routing: it splits traffic all the time, sending one in ten healthy-period visitors to the maintenance page and continuing to send 90 percent of users to a dead site during an outage. <strong>B</strong> does not create a failover path at all — a longer origin timeout just makes clients wait before erroring; CloudFront custom error pages could help but that is not what is described. <strong>D</strong> is manual-with-scripting, single-instance, and incompatible with an ALB (which has no Elastic IP); it reinvents failover DNS poorly.</p>`
    },

    {
      q: "A payments company runs its transactional database on Amazon Aurora MySQL in us-east-1. The business requires cross-Region disaster recovery with a recovery point objective (RPO) of about one second and a recovery time objective (RTO) of under one minute. Which solution meets these requirements?",
      options: [
        "Enable automated backups and copy snapshots to a second Region every hour",
        "Create an Aurora global database with a secondary cluster in another Region and promote it during a Regional outage",
        "Create a cross-Region Aurora MySQL read replica using binlog replication and promote it during an outage",
        "Use AWS DMS continuous replication into an RDS for MySQL instance in a second Region"
      ],
      answer: [1],
      multi: false,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>B</strong> is correct. Aurora Global Database replicates at the storage layer with typical cross-Region lag under one second, and a secondary cluster can be promoted to full read-write in well under a minute (managed failover is designed for an RTO on the order of a minute). It is the only option engineered to hit both a roughly one-second RPO and a sub-minute RTO.</p><p><strong>A</strong> gives an RPO of up to an hour and an RTO of however long a full snapshot restore takes — usually tens of minutes to hours; it misses both targets by orders of magnitude. <strong>C</strong> uses logical binlog replication, whose lag commonly stretches to seconds or minutes under write load, and replica promotion plus DNS changes typically exceed a one-minute RTO. <strong>D</strong> adds a DMS replication instance to operate, inherits logical-replication lag, and targets a non-Aurora engine — more moving parts with weaker guarantees.</p>`
    },

    {
      q: "A mobile application stores user profile data in a DynamoDB table in us-east-1. The company is expanding to Europe and needs users on both continents to read and write their profiles with single-digit millisecond latency, and the application must keep working even if an entire Region becomes unavailable. Which solution meets these requirements with the LEAST operational overhead?",
      options: [
        "Deploy a second DynamoDB table in Europe and replicate changes between the tables with a custom Lambda function reading DynamoDB Streams",
        "Add a DAX cluster in the European Region to cache reads from the existing table",
        "Create a second table in Europe and keep the tables synchronized with AWS DMS ongoing replication",
        "Convert the table to a DynamoDB global table with replicas in both Regions"
      ],
      answer: [3],
      multi: false,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>D</strong> is correct. Global tables are DynamoDB's managed multi-Region, multi-active replication: each Region has a full read-write replica with local single-digit millisecond latency, changes replicate automatically (typically within a second), and if a Region fails the application simply uses the surviving replica. Enabling it is a configuration change — no replication code to run.</p><p><strong>A</strong> is a hand-built version of the same thing: you own conflict resolution, retries, ordering, and monitoring of the replication Lambda forever — maximum operational overhead for an inferior result. <strong>B</strong> only accelerates reads; every write from Europe still crosses the Atlantic to us-east-1, and if that Region fails, writes stop entirely. <strong>C</strong> misapplies DMS — it is a migration and replication tool with its own replication instances to size and operate, it is not designed as a permanent bidirectional multi-active topology for DynamoDB, and failback becomes your problem.</p>`
    },

    {
      q: "A company must design disaster recovery into a second AWS Region for a business-critical application. The requirements are an RTO of 5 minutes and an RPO of under 1 minute. The budget is limited, and the business will not pay for a full-capacity duplicate environment. Which strategy should a solutions architect recommend?",
      options: [
        "Warm standby: run a scaled-down but fully functional copy of the stack in the second Region with continuous data replication, and scale it up during failover",
        "Backup and restore: replicate backups to the second Region and rebuild the infrastructure with CloudFormation when a disaster is declared",
        "Multi-site active-active: run full production capacity in both Regions simultaneously behind global traffic management",
        "Pilot light: replicate data continuously to the second Region but keep all compute stopped until a disaster is declared"
      ],
      answer: [0],
      multi: false,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>A</strong> is correct. Warm standby keeps a minimal but working copy of the entire stack running in the DR Region with continuous (near-real-time) data replication, so the RPO of under a minute is met, and failover is only a scale-up plus traffic shift — comfortably inside a 5-minute RTO. Because standby capacity is a fraction of production, it respects the cost constraint.</p><p><strong>B</strong> is the cheapest strategy but its RTO is hours (provision infrastructure, restore data) and RPO depends on backup frequency — both targets are missed badly. <strong>C</strong> beats the RTO/RPO easily but is explicitly excluded: full duplicate capacity is exactly what the business refused to fund, so it fails the qualifier rather than the requirement. <strong>D</strong> meets the RPO (data replicates continuously) but starting, patching, and scaling compute from zero typically takes tens of minutes, which busts a 5-minute RTO.</p>`
    },

    {
      q: "A content management system runs on EC2 instances in an Auto Scaling group across three Availability Zones. Editors upload media files that every instance must be able to read and write concurrently through a shared POSIX-compliant file system. Which storage solution meets these requirements?",
      options: [
        "An EBS gp3 volume with Multi-Attach enabled, shared across the instances",
        "An S3 bucket mounted on each instance through a FUSE-based file system adapter",
        "An Amazon EFS file system with mount targets in each Availability Zone, mounted on all instances",
        "An FSx for Lustre scratch file system linked to an S3 bucket"
      ],
      answer: [2],
      multi: false,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>C</strong> is correct. EFS is a managed NFS file system built for exactly this: hundreds of concurrent readers and writers, POSIX semantics, elastic capacity, and mount targets in every AZ so each instance mounts over a low-latency, zone-local path. Regional EFS storage is redundant across AZs, matching the multi-AZ ASG.</p><p><strong>A</strong> fails twice: Multi-Attach exists only for io1/io2 (not gp3), and attached instances must be in the same AZ as the volume — impossible across three AZs; it also requires a cluster-aware file system to avoid corruption. <strong>B</strong> puts an object store behind a POSIX facade: no true POSIX locking or atomic renames, surprising consistency and performance behavior, and an adapter to maintain on every host. <strong>D</strong> is built for short-lived HPC throughput; a scratch deployment has no replication and can lose data on failure — wrong durability profile for a CMS media store.</p>`
    },

    {
      q: "A company must automatically keep a copy of every new object from a critical S3 bucket in a second Region to meet disaster recovery requirements. The source bucket currently has versioning disabled. Which TWO steps are required to implement this? (Select TWO.)",
      options: [
        "Enable S3 Transfer Acceleration on the source bucket",
        "Enable versioning on both the source and destination buckets",
        "Create an S3 Batch Operations job on a daily schedule to copy new objects",
        "Create a Cross-Region Replication rule on the source bucket targeting a bucket in the second Region",
        "Configure an S3 Multi-Region Access Point so uploads are duplicated to both buckets"
      ],
      answer: [1, 3],
      multi: true,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>B</strong> and <strong>D</strong> are correct. Cross-Region Replication automatically and asynchronously copies each new object (with its metadata and tags) to a bucket in another Region — but it is built on object versions, so S3 requires versioning on both the source and destination buckets before a replication rule can be created.</p><p><strong>A</strong> accelerates client uploads over long distances; it has nothing to do with bucket-to-bucket copying. <strong>C</strong> is a batch mechanism: a daily job means up to 24 hours of exposure and something to schedule and monitor, when CRR replicates continuously within minutes for free of that effort (Batch Replication is only needed for pre-existing objects). <strong>E</strong> misdescribes Multi-Region Access Points — they provide a global endpoint that routes each request to one bucket; they rely on replication rules underneath rather than duplicating uploads themselves.</p>`
    },

    {
      q: "An AWS Lambda function is invoked asynchronously by S3 event notifications to process uploaded images. Occasionally the function exhausts its automatic retries and those events are lost. The team must capture failed events durably so they can be analyzed and reprocessed later. What should a solutions architect do?",
      options: [
        "Increase the function's timeout and memory so retries always succeed",
        "Enable provisioned concurrency on the function to prevent throttling",
        "Log failed events to CloudWatch Logs and create a metric filter to detect them",
        "Configure an on-failure destination or dead-letter queue in SQS for the function's asynchronous invocations"
      ],
      answer: [3],
      multi: false,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>D</strong> is correct. For asynchronous invocations, Lambda can route events that fail all retries to an on-failure destination (SQS, SNS, EventBridge, or another function) or a dead-letter queue. Sending them to SQS persists the full event payload durably, where the team can inspect messages and redrive them through the function once the defect is fixed — precisely the capture-and-reprocess requirement.</p><p><strong>A</strong> is wishful tuning: it may reduce some failures but cannot eliminate them (bad input, downstream outages), and any event that still exhausts retries is lost exactly as before. <strong>B</strong> addresses cold starts and throttling only; failures from errors are untouched, and lost events remain lost. <strong>C</strong> gives detection, not recovery — log lines are truncated, unstructured, and awkward to replay, and if the failure happens before logging, nothing is captured. Alerting on failures is complementary, not a substitute for durable capture.</p>`
    },

    {
      q: "A VPC spans three Availability Zones, each containing private subnets that reach the internet through a single NAT gateway in one public subnet. During an outage of the Availability Zone containing the NAT gateway, every private subnet lost outbound connectivity. Which TWO changes should a solutions architect make to eliminate this single point of failure? (Select TWO.)",
      options: [
        "Deploy a NAT gateway in a public subnet of each Availability Zone",
        "Replace the NAT gateway with a NAT instance managed by an Auto Scaling group",
        "Move all private subnets into the Availability Zone that contains the NAT gateway",
        "Attach an additional internet gateway to each Availability Zone",
        "Update each private subnet's route table to target the NAT gateway in its own Availability Zone"
      ],
      answer: [0, 4],
      multi: true,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>A</strong> and <strong>E</strong> are correct, and they only work together. NAT gateways are zonal resources, so resilience requires one per AZ — and each private subnet must have its own route table entry pointing at the NAT gateway in the same AZ. That gives zone-independent egress: an AZ failure takes out only that zone's path, and it also avoids cross-AZ data charges during normal operation. Deploying the gateways without fixing the routes (or vice versa) leaves subnets still dependent on a single zone.</p><p><strong>B</strong> swaps a managed, highly available (within its AZ) service for a self-managed instance and is still zonal — availability gets worse, not better. <strong>C</strong> concentrates the entire workload into one AZ, destroying the multi-AZ design to fix an egress problem. <strong>D</strong> is not a real construct: a VPC has exactly one internet gateway, which is already a horizontally scaled, VPC-wide logical component, not a zonal device.</p>`
    },

    {
      q: "A web application stores user sessions in a single-node ElastiCache for Redis deployment. When the node failed, all users were logged out and the application was degraded until the cache was rebuilt. The company wants the session store to survive a node or Availability Zone failure with automatic failover. What should a solutions architect recommend?",
      options: [
        "Switch to a Memcached cluster with nodes spread across multiple Availability Zones",
        "Use a Redis replication group with replicas in other Availability Zones and Multi-AZ automatic failover enabled",
        "Schedule Redis backups every five minutes and restore automatically when a failure is detected",
        "Enable cluster mode on the existing node to distribute the data across shards"
      ],
      answer: [1],
      multi: false,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>B</strong> is correct. A Redis replication group adds read replicas in other AZs; with Multi-AZ and automatic failover enabled, ElastiCache promotes a replica within a short window when the primary or its AZ fails, and the primary endpoint follows the new node. Sessions survive because the replicas hold a copy of the data — no rebuild, minimal disruption.</p><p><strong>A</strong> is a classic trap: Memcached has no replication, no persistence, and no failover — spreading nodes across AZs only means each failure silently loses that node's partition of the sessions. <strong>C</strong> still loses up to five minutes of sessions, and restore time means an outage while it happens; backup/restore is for durability, not high availability. <strong>D</strong> confuses sharding with redundancy — cluster mode partitions the keyspace for scale; without replicas per shard a node failure still loses that shard's data outright.</p>`
    },

    {
      q: "A company runs workloads across multiple AWS accounts using EC2, EBS, RDS, DynamoDB, and EFS. Auditors require centrally managed backups with defined retention policies, copies stored in a second Region, and compliance reporting covering all of these services. Which solution meets these requirements with the LEAST operational overhead?",
      options: [
        "Write Lambda functions for each service that create snapshots on an EventBridge schedule",
        "Enable each service's native automated snapshots and copy them across Regions with custom scripts",
        "Use AWS Backup with organization-wide backup policies, backup vaults, and cross-Region copy rules",
        "Use AWS DataSync to copy all data nightly to a central S3 bucket in a second Region"
      ],
      answer: [2],
      multi: false,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>C</strong> is correct. AWS Backup is the single managed control plane for exactly this list of services: backup plans define schedules and retention centrally, organization-level backup policies push those plans to every account, vaults (optionally locked) hold the recovery points, copy rules automate cross-Region copies, and built-in compliance features (Backup Audit Manager, per-resource job reporting) satisfy the auditors — all without custom code.</p><p><strong>A</strong> means writing, testing, and maintaining a fleet of snapshot Lambdas across accounts, plus building your own retention enforcement, cross-Region copying, and reporting — the definition of operational overhead. <strong>B</strong> is fragmented: five different native mechanisms with different retention semantics, glued together by scripts nobody audits, and no central compliance view. <strong>D</strong> misuses DataSync, which transfers file and object data (NFS, SMB, S3, EFS, FSx); it cannot back up EC2, EBS, RDS, or DynamoDB at all, and a nightly copy is not a managed backup program.</p>`
    },

    {
      q: "A company runs an RDS for MySQL database in eu-west-1. For disaster recovery it needs a continuously updated copy in a second Region with an RPO of a few seconds, plus the ability to quickly promote that copy to a writable database during a Regional outage. The company wants to remain on RDS for MySQL. Which solution meets these requirements?",
      options: [
        "Create a cross-Region read replica of the database and promote it to a standalone instance during a disaster",
        "Convert the database to a Multi-AZ deployment with the standby placed in the second Region",
        "Copy automated snapshots to the second Region every night and restore from the latest copy during a disaster",
        "Migrate the database to Aurora MySQL and add a secondary Region with Aurora Global Database"
      ],
      answer: [0],
      multi: false,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>A</strong> is correct. RDS for MySQL supports cross-Region read replicas fed by continuous asynchronous replication, keeping lag to seconds under normal load — meeting the few-seconds RPO. During a Regional outage the replica is promoted to a standalone, writable instance in minutes, and it can also serve reads in the second Region in the meantime.</p><p><strong>B</strong> is a scope error the exam loves: Multi-AZ places the standby in another Availability Zone of the same Region — RDS offers no cross-Region Multi-AZ standby for MySQL, so it provides zero protection against Regional failure. <strong>C</strong> has an RPO of up to 24 hours plus a long restore-based RTO; it fails the requirement outright. <strong>D</strong> would meet the technical targets but violates the explicit constraint to stay on RDS for MySQL, adding an engine migration project the company did not ask for.</p>`
    },

    {
      q: "A two-tier application consists of web servers on EC2 instances in one Availability Zone and an RDS database deployed in a single Availability Zone. A solutions architect must make the entire stack highly available so it can withstand the loss of any one Availability Zone. Which TWO actions should the architect take? (Select TWO.)",
      options: [
        "Purchase Reserved Instances to guarantee capacity in the current Availability Zone",
        "Enable EBS fast snapshot restore for the web servers in a second Availability Zone",
        "Deploy the web tier in an Auto Scaling group that spans multiple Availability Zones behind an elastic load balancer",
        "Modify the RDS instance to a Multi-AZ deployment",
        "Create an RDS read replica in the same Availability Zone for failover"
      ],
      answer: [2, 3],
      multi: true,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>C</strong> and <strong>D</strong> are correct, because every tier must be zone-redundant. Spreading the web tier across AZs in an Auto Scaling group behind a load balancer keeps serving traffic when one zone fails and automatically replaces lost instances; converting RDS to Multi-AZ adds a synchronous standby in another AZ with automatic failover, so the data tier survives the same event. Together the stack has no single-AZ dependency.</p><p><strong>A</strong> is a billing construct — a zonal RI reserves capacity in the very AZ whose failure we are defending against, and it adds no redundancy anywhere. <strong>B</strong> speeds up volume creation from snapshots but nothing automatically launches replacement web servers or fails over the database; it is a restore-time optimization, not high availability. <strong>E</strong> puts the 'failover' copy in the same blast radius as the primary — an AZ outage takes both — and read replica promotion is manual, unlike Multi-AZ failover.</p>`
    },

    {
      q: "A licensed legacy application runs on a single EC2 instance. The vendor's license is bound to the instance ID and private IP address, so the application cannot be redeployed onto a new instance. The company needs the instance to recover automatically from underlying hardware failures while keeping its instance ID and IP addresses. Which solution meets these requirements?",
      options: [
        "Place the instance in an Auto Scaling group with minimum, maximum, and desired capacity of 1",
        "Create an AMI of the instance and use a launch template to relaunch it when a failure is detected",
        "Enable termination protection and detailed monitoring on the instance",
        "Configure a CloudWatch alarm on the StatusCheckFailed_System metric with an EC2 recover action for the instance"
      ],
      answer: [3],
      multi: false,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>D</strong> is correct. EC2 instance recovery migrates the instance to healthy underlying hardware while preserving everything the license depends on: the instance ID, private IP, Elastic IP, placement, and attached EBS volumes (in-memory state is lost, as with a reboot). Triggering it from a CloudWatch alarm on system status-check failures makes recovery automatic; newer instance types even enable simplified automatic recovery by default.</p><p><strong>A</strong> heals by replacement: the ASG terminates the failed instance and launches a brand-new one with a new instance ID and IP — exactly what the license prohibits. <strong>B</strong> has the same flaw with more manual machinery; a relaunched AMI is a different instance identity. <strong>C</strong> protects against accidental termination and improves metric granularity but contains no recovery mechanism at all — the instance stays down on hardware failure.</p>`
    },

    {
      q: "A company is moving a Windows-based application to AWS. The application requires a shared SMB file system that is joined to the company's Active Directory, and the file share must remain available through the failure of an Availability Zone. Which storage service should a solutions architect recommend?",
      options: [
        "Amazon EFS with mount targets in two Availability Zones",
        "Amazon FSx for Windows File Server deployed in Multi-AZ mode",
        "Amazon FSx for Lustre with a persistent deployment type",
        "A Windows file share on an EC2 instance with EBS snapshots copied to another Availability Zone"
      ],
      answer: [1],
      multi: false,
      domain: "Design Resilient Architectures",
      explanation: `<p><strong>B</strong> is correct. FSx for Windows File Server is the managed SMB service: it integrates natively with Active Directory (managed or self-hosted), supports NTFS ACLs and DFS namespaces, and in Multi-AZ mode maintains a synchronously replicated standby file server in a second AZ with automatic, transparent failover of the share endpoint — meeting both the protocol and availability requirements.</p><p><strong>A</strong> is the Linux answer to a Windows question: EFS speaks NFS, not SMB, and has no Active Directory integration, so Windows clients expecting an AD-joined SMB share cannot use it. <strong>C</strong> is a high-throughput POSIX file system for HPC and analytics workloads — again no SMB and no AD join. <strong>D</strong> is self-managed and not highly available: the single instance is a single point of failure in one AZ, and restoring from snapshots elsewhere is a manual recovery measured in hours, not a failover.</p>`
    },

    /* ============= Design High-Performing Architectures (16) ============= */

    {
      q: "A media company serves images, video segments, and dynamic API responses from an origin in us-east-1. Users in Asia and Europe report slow page loads. The company wants to reduce latency for global users and offload traffic from the origin with minimal application changes. Which solution meets these requirements?",
      options: [
        "Create a CloudFront distribution with the existing origin and separate cache behaviors for static and dynamic content",
        "Deploy the full application stack in three additional Regions behind Route 53 geolocation routing",
        "Enable S3 Transfer Acceleration for the media files",
        "Migrate the origin to larger EC2 instances with enhanced networking enabled"
      ],
      answer: [0],
      multi: false,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>A</strong> is correct. CloudFront caches the static media at hundreds of edge locations, eliminating trans-oceanic round trips for the bulk of the traffic, and even the non-cacheable API responses benefit because CloudFront carries them over the AWS backbone with persistent connections and TLS termination at the edge. Pointing DNS at the distribution requires essentially no application changes and directly offloads the origin.</p><p><strong>B</strong> would reduce latency but is a multi-Region replatforming project — data replication, deployment pipelines, consistency — which flatly violates 'minimal application changes'. <strong>C</strong> is an upload accelerator for S3 PUTs from distant clients; it does nothing for content delivery to end users. <strong>D</strong> makes the origin faster at serving requests but does nothing about the geographic latency, which is dominated by distance, not server capacity.</p>`
    },

    {
      q: "A multiplayer game uses a custom UDP protocol served by Network Load Balancers in two Regions. Players worldwide experience inconsistent latency and packet loss on the public internet, and the company also needs two static anycast IP addresses that game launchers can hard-code. Which service should a solutions architect use?",
      options: [
        "Amazon CloudFront with the Network Load Balancers configured as custom origins",
        "Route 53 latency-based routing with health checks on both load balancers",
        "AWS Global Accelerator with the two Network Load Balancers as endpoints",
        "Application Load Balancers with HTTP/3 enabled in each Region"
      ],
      answer: [2],
      multi: false,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>C</strong> is correct. Global Accelerator is built for exactly this profile: it advertises two static anycast IPv4 addresses from AWS edge locations worldwide, ingests player traffic at the nearest edge, and carries it over the congestion-managed AWS backbone to the closest healthy Regional endpoint — supporting TCP and UDP with fast cross-Region failover. Static IPs plus better, more consistent latency for a custom UDP protocol map one-to-one to its feature set.</p><p><strong>A</strong> fails on protocol: CloudFront is an HTTP/HTTPS content delivery network and cannot proxy a custom UDP game protocol. <strong>B</strong> picks the better Region at DNS resolution time but the traffic still crosses the public internet end-to-end — packet loss is untouched — and NLB addresses are not two globally static IPs. <strong>D</strong> is HTTP-only as well; QUIC support does not make an ALB a transport for arbitrary UDP traffic.</p>`
    },

    {
      q: "A retail application reads product details from a DynamoDB table at very high rates during promotions. The table is adequately provisioned, but the business now requires microsecond-scale read latency for these heavily repeated reads. The team wants minimal changes to its existing DynamoDB API calls. Which solution meets these requirements?",
      options: [
        "Add a global secondary index tuned for the product-detail queries",
        "Deploy a DynamoDB Accelerator (DAX) cluster and point the application's DynamoDB client at it",
        "Deploy an ElastiCache for Redis cluster and implement cache-aside logic in the application",
        "Enable DynamoDB auto scaling to raise read capacity during promotions"
      ],
      answer: [1],
      multi: false,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>B</strong> is correct. DAX is a write-through, read-through cache that is API-compatible with DynamoDB: the application swaps its client endpoint for the DAX cluster and unchanged GetItem and Query calls are served from memory in microseconds on cache hits. It is purpose-built for read-heavy, repeated-read workloads like a product catalog during promotions.</p><p><strong>A</strong> changes the access path but not the physics — a GSI is still disk-backed DynamoDB storage with single-digit millisecond latency, and it duplicates storage cost without reaching microseconds. <strong>C</strong> can achieve similar latency but violates the constraint: cache-aside means new code for cache reads, population, invalidation, and TTL policy — a significant application change compared with DAX's drop-in client. <strong>D</strong> addresses throughput (avoiding throttling), not latency; the table is already adequately provisioned, so more capacity units leave read latency exactly where it is.</p>`
    },

    {
      q: "A news website backed by RDS for MySQL struggles during traffic spikes. Monitoring shows more than 90 percent of database load comes from repeated, identical read queries for trending articles. Which TWO actions should a solutions architect take to improve database read performance? (Select TWO.)",
      options: [
        "Add an ElastiCache cluster in front of the database to cache the results of frequent queries",
        "Convert the database to a Multi-AZ deployment",
        "Create RDS read replicas and direct read traffic to them",
        "Enable RDS storage autoscaling on the instance",
        "Deploy a DynamoDB Accelerator (DAX) cluster in front of the database"
      ],
      answer: [0, 2],
      multi: true,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>A</strong> and <strong>C</strong> are correct and complementary. Caching hot query results in ElastiCache serves the repeated identical reads from memory at sub-millisecond latency, removing the bulk of load from MySQL entirely; read replicas then scale out whatever read traffic remains (and cache misses) across additional instances, keeping the primary free for writes. Together they attack both the repetition and the volume.</p><p><strong>B</strong> is the availability distractor: the Multi-AZ standby is invisible to the application and serves no read traffic (for classic RDS Multi-AZ), so performance is unchanged. <strong>D</strong> grows storage capacity when the volume fills — it has no effect on query throughput or latency. <strong>E</strong> is a service mismatch: DAX only fronts DynamoDB; it cannot cache for a MySQL database, however tempting the word 'accelerator' looks.</p>`
    },

    {
      q: "Field teams on several continents upload multi-gigabyte video files to a single S3 bucket in us-west-2. Uploads from distant locations are slow and unreliable over the public internet. Which solution speeds up these long-distance uploads with the LEAST change to the existing workflow?",
      options: [
        "Create regional S3 buckets on each continent and replicate the uploads to the central bucket",
        "Ship the files weekly to AWS on Snowball Edge devices",
        "Provision AWS Direct Connect circuits for each field location",
        "Enable S3 Transfer Acceleration on the bucket and upload through the acceleration endpoint"
      ],
      answer: [3],
      multi: false,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>D</strong> is correct. Transfer Acceleration routes uploads to the nearest CloudFront edge location, then carries them to the bucket's Region over the optimized AWS backbone, typically improving long-distance transfer speed substantially (often 50 to 500 percent for distant clients). The only workflow change is swapping the endpoint hostname — same bucket, same keys, same tooling — and combining it with multipart upload handles the multi-gigabyte sizes and flaky links.</p><p><strong>A</strong> works but restructures the workflow: multiple buckets to manage, replication rules, and eventual-consistency delays before objects reach the central bucket. <strong>B</strong> introduces a week of latency for data that today arrives in hours — appropriate for bulk migrations, not routine uploads. <strong>C</strong> is wildly disproportionate: dedicated circuits take weeks to months to provision per site, carry fixed monthly cost, and make no sense for mobile field teams.</p>`
    },

    {
      q: "An IoT platform ingests telemetry from 50,000 devices. Events from each device must be processed in the order they were produced, several independent applications must consume the same stream in near real time, and analysts need the ability to replay the previous 24 hours of data. Which service meets these requirements?",
      options: [
        "Amazon Kinesis Data Streams with the device ID as the partition key",
        "Amazon SQS standard queues, one queue per consuming application",
        "Amazon SNS fanning out to an SQS FIFO queue per consuming application",
        "Amazon Kinesis Data Firehose delivering the events to Amazon S3"
      ],
      answer: [0],
      multi: false,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>A</strong> is correct. Kinesis Data Streams checks all three boxes natively: records with the same partition key (device ID) land on the same shard and preserve strict per-device ordering; multiple consumers — with enhanced fan-out each getting dedicated 2 MBps throughput — read the same stream independently; and the stream retains data for 24 hours by default (extensible to 365 days), so analysts can rewind and replay.</p><p><strong>B</strong> fails on every axis: standard queues offer only best-effort ordering, a message consumed is gone (no multi-consumer reads of one queue, hence the queue-per-app workaround where producers must write everywhere), and there is no replay of consumed data. <strong>C</strong> gets fan-out and ordering, but neither SNS nor SQS supports replaying already-processed history — consumed messages are deleted. <strong>D</strong> is a delivery pipeline: near-real-time batches to S3, no per-device ordering guarantee for consumers, and no streaming consumer model at all.</p>`
    },

    {
      q: "A serverless voting application writes results to a DynamoDB table that uses the contest date as its partition key. During a single-day televised event, writes are heavily throttled even though the table's provisioned write capacity far exceeds the aggregate write rate. What is the MOST likely way to resolve the throttling?",
      options: [
        "Enable auto scaling on the table's write capacity",
        "Switch the table to on-demand capacity mode",
        "Redesign the partition key to include a high-cardinality attribute so writes spread across many partitions",
        "Add a global secondary index to absorb the additional writes"
      ],
      answer: [2],
      multi: false,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>C</strong> is correct. With the contest date as the partition key, every vote during the one-day event carries the identical key and hammers a single partition — a textbook hot partition. A partition's throughput is bounded (roughly 1,000 WCU) regardless of how much capacity the table has, because provisioned capacity is spread across partitions. Re-keying with a high-cardinality component (user ID, or a write-sharded suffix aggregated at read time) distributes writes and eliminates the throttling.</p><p><strong>A</strong> and <strong>B</strong> both miss the diagnosis: capacity is already more than sufficient in aggregate, and neither auto scaling nor on-demand mode can push a single partition past its per-partition ceiling — adaptive capacity helps but cannot rescue one key receiving the entire workload. <strong>D</strong> makes things worse: a GSI adds a second write for every item and its own partitions can hot-spot identically; indexes are for query patterns, not write absorption.</p>`
    },

    {
      q: "A database running on an EC2 instance built on the Nitro system requires a single EBS volume that can deliver a consistent 64,000 IOPS with sub-millisecond latency and 99.999 percent durability. Which volume type meets these requirements?",
      options: [
        "General Purpose SSD (gp3) provisioned to its maximum IOPS",
        "Provisioned IOPS SSD (io2 Block Express) with 64,000 IOPS provisioned",
        "Throughput Optimized HDD (st1) volumes striped together with RAID 0",
        "Two gp3 volumes mirrored with RAID 1"
      ],
      answer: [1],
      multi: false,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>B</strong> is correct. io2 Block Express is the only EBS offering that combines all three requirements: it scales to 256,000 provisioned IOPS on a single volume with sub-millisecond average latency on Nitro instances, and the io2 family is the only volume class rated at 99.999 percent durability (five nines). Provisioned IOPS also means the performance is consistent, not burst- or allocation-dependent.</p><p><strong>A</strong> tops out at 16,000 IOPS per gp3 volume — a factor of four short — and gp3 durability is 99.8 to 99.9 percent. <strong>C</strong> is the wrong media entirely: st1 is spinning disk optimized for large sequential throughput, with IOPS in the hundreds and no sub-millisecond latency, RAID or not. <strong>D</strong> misuses RAID 1, which mirrors for redundancy without adding IOPS; two gp3 volumes mirrored still deliver at most 16,000 IOPS and still lack five-nines durability.</p>`
    },

    {
      q: "A genomics research team runs an HPC cluster on EC2 that must process petabytes of data stored in Amazon S3. The workload requires a POSIX-compliant file system that can deliver hundreds of gigabytes per second of aggregate throughput at sub-millisecond latencies, with results written back to S3 when jobs complete. Which storage solution meets these requirements?",
      options: [
        "Amazon EFS in Max I/O performance mode mounted on all cluster nodes",
        "S3 gateway endpoints with the AWS CLI copying data to local instance store on each node",
        "Amazon FSx for Windows File Server with SSD storage",
        "Amazon FSx for Lustre with a data repository association linked to the S3 bucket"
      ],
      answer: [3],
      multi: false,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>D</strong> is correct. FSx for Lustre is the purpose-built HPC file system: parallel POSIX access with sub-millisecond latencies and aggregate throughput that scales to hundreds of GBps across the cluster. Its defining feature here is the S3 data repository association — the file system lazy-loads objects from the linked bucket on first access, presents them as files, and exports results back to S3, exactly matching the process-from-S3, write-back-to-S3 workflow.</p><p><strong>A</strong> is general-purpose NFS; even Max I/O mode is designed for high aggregate parallelism at higher per-operation latencies and cannot approach hundreds of GBps for an HPC cluster. <strong>B</strong> is a hand-rolled staging scheme: an ad-hoc copy step per node, no shared namespace across the cluster, and orchestration you must build and babysit. <strong>C</strong> is an SMB file service for Windows workloads — the wrong protocol, wrong performance envelope, and no S3 integration.</p>`
    },

    {
      q: "A banking application decouples its transaction-submission tier from its processing tier with a queue. Each customer's transactions must be processed exactly once and strictly in the order submitted. Total volume is about 200 messages per second. Which solution meets these requirements?",
      options: [
        "An SQS FIFO queue using the customer ID as the message group ID, with deduplication enabled",
        "An SQS standard queue with a consumer Lambda function that reorders messages by timestamp",
        "An SNS FIFO topic delivering directly to the processing application over HTTPS",
        "An SQS standard queue with long polling and a 15-minute visibility timeout"
      ],
      answer: [0],
      multi: false,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>A</strong> is correct. SQS FIFO queues guarantee strict ordering within a message group and exactly-once processing semantics via deduplication (content-based or explicit deduplication IDs). Using the customer ID as the message group ID gives per-customer ordering while different customers' groups process in parallel — and 200 messages per second sits comfortably within FIFO throughput, especially with high-throughput mode.</p><p><strong>B</strong> cannot be made correct: standard queues deliver at-least-once and out of order, and a consumer that 'reorders by timestamp' must buffer indefinitely because it can never know whether an earlier message is still in flight; duplicates also remain unhandled. <strong>C</strong> fails on delivery semantics — SNS FIFO topics preserve ordering only into SQS FIFO subscriptions; HTTP endpoints are not supported for FIFO delivery. <strong>D</strong> tunes polling economics and redelivery timing on a queue that is still fundamentally unordered and at-least-once.</p>`
    },

    {
      q: "An analytics team runs complex SQL joins and aggregations over roughly 500 TB of structured sales data, powering dashboards that hundreds of analysts refresh throughout the business day. Query performance on the current RDS for PostgreSQL instance is inadequate. Which service should a solutions architect recommend for this workload?",
      options: [
        "RDS for PostgreSQL on the largest available instance size with io2 storage",
        "Amazon Athena querying the data after export to Amazon S3",
        "Amazon Redshift with a cluster sized for the workload",
        "Amazon DynamoDB with a global secondary index per dashboard query"
      ],
      answer: [2],
      multi: false,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>C</strong> is correct. This is a classic OLAP data-warehouse profile: hundreds of terabytes of structured data, complex joins and aggregations, high query concurrency all day. Redshift's columnar storage, compression, zone maps, massively parallel execution, result caching, and concurrency scaling are designed precisely for repeated analytical dashboards at this scale.</p><p><strong>A</strong> is vertical scaling of a row-oriented OLTP engine — a single-node PostgreSQL simply cannot parallelize 500 TB scans the way an MPP columnar warehouse can, no matter how fast the storage. <strong>B</strong> is strong for ad-hoc, intermittent queries, but for hundreds of analysts refreshing dashboards continuously, per-query scan pricing gets expensive and performance is less predictable than a provisioned warehouse with result caching serving repeated queries. <strong>D</strong> is a key-value store: it has no joins or ad-hoc aggregations, and modeling every dashboard as a GSI is unworkable and enormously expensive at 500 TB.</p>`
    },

    {
      q: "A data lake application makes tens of thousands of GET and PUT requests per second against a single S3 bucket and is receiving HTTP 503 Slow Down responses. Objects average 200 MB. Which TWO changes should a solutions architect make to improve request performance? (Select TWO.)",
      options: [
        "Open an AWS Support case to raise the bucket's request-rate limit",
        "Distribute objects across multiple key name prefixes so requests parallelize across S3 partitions",
        "Enable S3 Versioning so the load spreads across object versions",
        "Move the bucket to the S3 One Zone-IA storage class for lower latency",
        "Use multipart uploads for PUTs and byte-range fetches for GETs to parallelize large-object transfers"
      ],
      answer: [1, 4],
      multi: true,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>B</strong> and <strong>E</strong> are correct. S3 request rates scale per prefix — at least 3,500 PUTs and 5,500 GETs per second each — by partitioning the keyspace. Spreading keys across many prefixes fans the workload out across partitions instead of saturating one, which is what produces 503 Slow Down responses. For 200 MB objects, multipart uploads and parallel byte-range GETs split each transfer into concurrent parts, raising throughput and improving retry behavior on failures.</p><p><strong>A</strong> misunderstands the model: there is no adjustable bucket request-rate quota to raise — scaling comes from key design (though Support can help diagnose partition heat). <strong>C</strong> does the opposite of helping; versions of an object share its key and partition, and versioning adds storage overhead. <strong>D</strong> confuses storage classes with performance: One Zone-IA has the same first-byte latency profile, is designed for infrequent access, and adds retrieval fees and lower resilience.</p>`
    },

    {
      q: "A latency-sensitive REST API built on API Gateway and Lambda shows p99 latency spikes of several seconds after idle periods and during sudden traffic bursts, while median latency is 40 ms. The team must make tail latency predictable. What should a solutions architect do?",
      options: [
        "Increase the function's timeout and configure higher reserved concurrency",
        "Configure provisioned concurrency for the function, scheduled to match traffic patterns",
        "Increase the function's memory allocation to speed up execution",
        "Enable API Gateway response caching for all endpoints"
      ],
      answer: [1],
      multi: false,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>B</strong> is correct. The symptom — good median latency but multi-second p99 after idle periods and during bursts — is the signature of cold starts. Provisioned concurrency keeps a specified number of execution environments initialized and ready, so requests land on warm sandboxes and tail latency collapses to near the median; scheduling it (or scaling it with Application Auto Scaling) matches capacity to the traffic pattern while controlling cost.</p><p><strong>A</strong> confuses the knobs: timeout caps how long an invocation may run, and reserved concurrency is an upper bound that prevents the function from scaling beyond a limit — neither pre-warms anything, and a tight reserve can add throttling. <strong>C</strong> speeds up execution and can shave cold-start init somewhat, but the multi-second initialization penalty remains and bursts still hit cold sandboxes. <strong>D</strong> only helps repeated identical GETs; dynamic or unique requests bypass the cache and still suffer cold starts.</p>`
    },

    {
      q: "A video transcoding service on EC2 writes large intermediate files to disk during processing. This scratch data demands extremely high random IOPS and very low latency, but it has no value after each job completes. Which storage option delivers the HIGHEST performance for this scratch data?",
      options: [
        "An io2 volume with the maximum provisioned IOPS",
        "A gp3 volume provisioned for maximum throughput",
        "An Amazon EFS file system in Max I/O performance mode",
        "NVMe instance store volumes on a storage-optimized instance family"
      ],
      answer: [3],
      multi: false,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>D</strong> is correct. Instance store is NVMe flash physically attached to the host, so I/O never crosses the network: storage-optimized families (such as i3en or i4i) deliver millions of random IOPS and microsecond-class latency — beyond anything network-attached storage offers. Its defining weakness, data loss when the instance stops or fails, is explicitly acceptable because the scratch data is worthless after each job, and it comes bundled with the instance at no separate storage charge.</p><p><strong>A</strong> is the best network-attached option but still tops out at 256,000 IOPS with network-hop latency, and you pay a premium for provisioned IOPS and durability this workload does not need. <strong>B</strong> caps at 16,000 IOPS — orders of magnitude short for high random I/O. <strong>C</strong> is the slowest choice here: a shared NFS file system adds per-operation network latency, and nothing about the workload needs multi-instance shared access.</p>`
    },

    {
      q: "A company deploys identical stacks of its web application behind Application Load Balancers in us-east-1, eu-west-1, and ap-southeast-1. Users should automatically connect to whichever Region responds fastest for them, and any Region that becomes unhealthy must be taken out of DNS rotation. Which Route 53 configuration meets these requirements?",
      options: [
        "Geolocation routing with records mapping each continent to its nearest Region",
        "Weighted routing with equal weights across the three ALBs and health checks",
        "Latency-based routing records for each ALB, each with an associated health check",
        "A multivalue answer record returning all three ALB addresses"
      ],
      answer: [2],
      multi: false,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>C</strong> is correct. Latency-based routing answers each DNS query with the Region that has the lowest measured network latency from the resolver's location — which is the actual requirement, 'fastest for the user' — and attaching health checks removes an unhealthy Region's record from consideration automatically, failing users over to the next-best Region.</p><p><strong>A</strong> is the tempting near-miss: geolocation maps users by administrative geography, not measured latency, and the two disagree often (a user in the Middle East may be 'in Asia' but closer, in network terms, to eu-west-1); geolocation is the right tool for content localization or compliance, not performance. <strong>B</strong> ignores the user's location entirely — a third of Asian users would be routed to us-east-1. <strong>D</strong> returns up to all healthy records and lets the client pick randomly; it is a lightweight availability aid, with no latency awareness at all.</p>`
    },

    {
      q: "A computational fluid dynamics workload runs on hundreds of EC2 instances that exchange large volumes of data over MPI. Inter-node network latency is the current bottleneck. Which TWO actions should a solutions architect take to maximize network performance between the nodes? (Select TWO.)",
      options: [
        "Launch the instances into a cluster placement group in a single Availability Zone",
        "Spread the instances across multiple Availability Zones to increase aggregate bandwidth",
        "Attach multiple elastic network interfaces to each instance to multiply its throughput",
        "Use instance types that support the Elastic Fabric Adapter and enable EFA on the instances",
        "Enable jumbo frames across an inter-Region VPC peering connection"
      ],
      answer: [0, 3],
      multi: true,
      domain: "Design High-Performing Architectures",
      explanation: `<p><strong>A</strong> and <strong>D</strong> are correct. A cluster placement group packs the instances onto physically proximate hardware inside one AZ, minimizing hop count and giving the lowest possible inter-node latency with high per-flow bandwidth. The Elastic Fabric Adapter adds an OS-bypass transport that MPI libraries use directly, cutting latency to the microsecond range and scaling tightly coupled collectives far better than standard TCP over ENA. Together they are AWS's canonical HPC networking prescription.</p><p><strong>B</strong> is exactly backwards for a latency-bound workload: inter-AZ links add roughly a millisecond and inter-AZ data charges — spreading helps availability, not MPI. <strong>C</strong> is a common myth; multiple ENIs do not increase an instance's bandwidth or reduce latency, since limits are per instance, not per interface. <strong>E</strong> is nonsensical here — inter-Region peering has tens of milliseconds of latency, and jumbo frames cannot rescue that (nor do they apply across Regions).</p>`
    },

    /* ============= Design Cost-Optimized Architectures (12) ============= */

    {
      q: "A research portal stores millions of documents in Amazon S3. Some documents are downloaded heavily for weeks after upload, while others are rarely touched but can suddenly become popular again without warning. Every retrieval must be immediate. The company wants to cut storage costs without building lifecycle rules based on guesses about access patterns. Which storage class should a solutions architect choose?",
      options: [
        "S3 Standard-Infrequent Access",
        "S3 Glacier Instant Retrieval",
        "S3 Intelligent-Tiering",
        "S3 One Zone-Infrequent Access"
      ],
      answer: [2],
      multi: false,
      domain: "Design Cost-Optimized Architectures",
      explanation: `<p><strong>C</strong> is correct. Intelligent-Tiering is built for unknown or changing access patterns: it monitors each object and automatically moves it between frequent-access and infrequent-access tiers (and optional archive tiers), always with millisecond retrieval from the default tiers and — critically — no retrieval fees when a cold object suddenly turns hot again. The small monitoring charge replaces all guess-based lifecycle management.</p><p><strong>A</strong> would penalize this workload: Standard-IA charges a per-GB retrieval fee and has a 30-day minimum storage duration, so the heavily downloaded documents and the rarely-touched-then-popular ones both rack up retrieval costs. <strong>B</strong> is for genuinely archival data accessed about once a quarter — its retrieval fees are higher still, with a 90-day minimum duration. <strong>D</strong> shares Standard-IA's fee structure while also storing data in a single AZ, trading durability posture for a discount this scenario never asked for.</p>`
    },

    {
      q: "A hospital must retain medical imaging archives for 10 years to satisfy regulations. Images are almost never accessed after their first 30 days; when auditors do request one, a retrieval time of up to 48 hours is acceptable. The company wants the LOWEST possible storage cost after day 30. Which lifecycle transition should a solutions architect configure?",
      options: [
        "Transition the objects to S3 Glacier Deep Archive 30 days after creation",
        "Transition the objects to S3 Glacier Flexible Retrieval 30 days after creation",
        "Transition the objects to S3 Standard-IA 30 days after creation",
        "Transition the objects to S3 Intelligent-Tiering 30 days after creation"
      ],
      answer: [0],
      multi: false,
      domain: "Design Cost-Optimized Architectures",
      explanation: `<p><strong>A</strong> is correct. Glacier Deep Archive is S3's cheapest storage class — roughly a quarter of the price of Glacier Flexible Retrieval and about 1/23rd of S3 Standard — and its standard retrieval completes within 12 hours (bulk within 48), comfortably inside the stated 48-hour tolerance. For a decade of nearly-never-accessed compliance data, it minimizes cost by design; the 180-day minimum storage duration is irrelevant for a 10-year retention.</p><p><strong>B</strong> retrieves faster (minutes to hours) than anyone requires here and charges several times more per GB for that unneeded speed. <strong>C</strong> keeps millisecond access at an order of magnitude higher storage price — paying for immediacy the scenario explicitly waives. <strong>D</strong> optimizes for unpredictable access patterns, but this pattern is perfectly predictable (cold after day 30); its monitoring fee and slower descent through tiers make it strictly more expensive than going straight to Deep Archive.</p>`
    },

    {
      q: "A rendering farm processes independent animation frames on EC2. Jobs checkpoint their progress every minute, can be interrupted and retried at any time, and have flexible completion deadlines. The EC2 compute bill is the company's largest cloud cost. Which purchasing option will reduce compute costs the MOST?",
      options: [
        "Zonal Reserved Instances covering the rendering fleet",
        "On-Demand Instances covered by a Compute Savings Plan",
        "Dedicated Hosts with partial upfront payment",
        "Spot Instances diversified across multiple instance types and Availability Zones"
      ],
      answer: [3],
      multi: false,
      domain: "Design Cost-Optimized Architectures",
      explanation: `<p><strong>D</strong> is correct. This workload is the ideal Spot profile: stateless-enough frames, minute-level checkpoints, tolerance for the two-minute interruption notice, and no hard deadline. Spot pricing runs up to 90 percent below On-Demand — far deeper than any commitment discount — and diversifying across instance types and AZs (for example with EC2 Fleet or an ASG using an allocation strategy such as price-capacity-optimized) keeps capacity available when individual pools are reclaimed.</p><p><strong>A</strong> and <strong>B</strong> both cap out near 66 to 72 percent savings and require 1-to-3-year commitments; they are the right tools for steady, uninterruptible baselines, not interruption-tolerant batch — so they save less on the workload best suited to Spot. <strong>C</strong> is the most expensive option in the list; Dedicated Hosts exist for BYOL licensing and compliance isolation, not cost reduction.</p>`
    },

    {
      q: "A company runs a steady baseline of containerized workloads on EC2 that it expects to migrate to AWS Fargate within the year, and it may also move some services between instance families and Regions. It wants to commit to one or three years of usage for the deepest discount that still covers all of these changes. Which option should a solutions architect recommend?",
      options: [
        "Standard Reserved Instances for the current instance family",
        "A Compute Savings Plan",
        "An EC2 Instance Savings Plan for the current family and Region",
        "Convertible Reserved Instances, exchanged after the migration"
      ],
      answer: [1],
      multi: false,
      domain: "Design Cost-Optimized Architectures",
      explanation: `<p><strong>B</strong> is correct. A Compute Savings Plan commits to a dollar-per-hour spend rather than to specific infrastructure, and it automatically applies across instance families, sizes, Regions, operating systems — and, decisively for this scenario, to Fargate and Lambda usage. The planned EC2-to-Fargate migration and possible family or Region moves are all covered without any exchange or modification process, at discounts up to about 66 percent.</p><p><strong>A</strong> breaks on nearly every stated change: Standard RIs are locked to a family (and Region), cannot be exchanged, and provide zero benefit once workloads land on Fargate. <strong>C</strong> offers a deeper percentage discount than a Compute plan but is scoped to one instance family in one Region and never applies to Fargate — the commitment would be stranded mid-migration. <strong>D</strong> allows exchanges but only within EC2; Convertible RIs also cannot cover Fargate, so the discount still evaporates after the migration.</p>`
    },

    {
      q: "An application delivers about 2 TB of log objects daily into an S3 bucket. Analysts query logs from the most recent 30 days regularly. Logs between 30 days and 1 year old are needed only for occasional investigations that can wait several hours. Logs older than 1 year must be deleted. Which TWO lifecycle rule actions meet these requirements MOST cost-effectively? (Select TWO.)",
      options: [
        "Transition objects to S3 One Zone-IA 30 days after creation",
        "Transition objects to S3 Glacier Flexible Retrieval 30 days after creation",
        "Configure an expiration action that deletes objects 365 days after creation",
        "Enable versioning and expire only noncurrent versions after 365 days",
        "Replicate objects older than 30 days to a bucket in a lower-cost Region"
      ],
      answer: [1, 2],
      multi: true,
      domain: "Design Cost-Optimized Architectures",
      explanation: `<p><strong>B</strong> and <strong>C</strong> are correct. After day 30 the logs are touched only for rare investigations that tolerate hours of delay — precisely Glacier Flexible Retrieval's profile (standard retrievals in 3 to 5 hours, bulk cheaper still) at a fraction of the cost of any instant-access class. A lifecycle expiration action then deletes each object at 365 days automatically, enforcing the retention limit and stopping storage charges — at 2 TB per day, roughly 730 TB is at stake in a year.</p><p><strong>A</strong> costs about three times more per GB than Glacier Flexible Retrieval while offering instant access nobody needs, and it lowers resilience to a single AZ. <strong>D</strong> misfires: these logs are written once, so expiring only noncurrent versions would delete essentially nothing, and versioning adds cost. <strong>E</strong> doubles storage and adds transfer charges — replication is for DR or locality, never a cost-reduction tool.</p>`
    },

    {
      q: "EC2 instances in private subnets transfer several terabytes per day to and from Amazon S3 in the same Region through a NAT gateway. The monthly bill shows large NAT gateway data processing charges attributable to this S3 traffic. How can a solutions architect eliminate these charges MOST cost-effectively?",
      options: [
        "Create a gateway VPC endpoint for S3 and add it to the private subnets' route tables",
        "Create an interface VPC endpoint for S3 in each Availability Zone",
        "Move the instances to public subnets and assign them Elastic IP addresses",
        "Enable S3 Transfer Acceleration so traffic bypasses the NAT gateway"
      ],
      answer: [0],
      multi: false,
      domain: "Design Cost-Optimized Architectures",
      explanation: `<p><strong>A</strong> is correct. A gateway endpoint for S3 inserts a route so the instances reach S3 directly over the AWS network, bypassing the NAT gateway entirely — and gateway endpoints are free: no hourly charge, no per-GB fee, no same-Region transfer cost. The NAT data processing charges disappear at zero new cost, and the traffic leaves the internet path.</p><p><strong>B</strong> also removes the NAT charges but replaces them with PrivateLink pricing — an hourly fee per endpoint ENI per AZ plus roughly a cent per GB processed — making it strictly more expensive than the free gateway endpoint; interface endpoints for S3 exist mainly for on-premises or cross-VPC access. <strong>C</strong> works but tears down the private-subnet security posture and still routes via the internet gateway. <strong>D</strong> is an accelerated public endpoint: traffic still needs NAT and now adds per-GB acceleration fees on top.</p>`
    },

    {
      q: "A company must migrate 600 TB of archived data from its on-premises data center to Amazon S3 within one month. The site's internet connection is 100 Mbps and is heavily used by business applications during the day. Which migration approach meets the deadline MOST cost-effectively?",
      options: [
        "Upload the data at night over the existing connection using S3 multipart uploads",
        "Order an AWS Direct Connect circuit and transfer the data over it",
        "Order multiple AWS Snowball Edge devices, load the data locally, and ship them back to AWS",
        "Use AWS DataSync over the internet with bandwidth throttling enabled"
      ],
      answer: [2],
      multi: false,
      domain: "Design Cost-Optimized Architectures",
      explanation: `<p><strong>C</strong> is correct. Do the arithmetic first: 100 Mbps at full, uncontended utilization moves about 1 TB per day, so 600 TB would need roughly 20 months — the link disqualifies every network option. Snowball Edge devices hold about 80 TB of usable storage each; ordering several in parallel, loading them locally at LAN speeds, and shipping them back lands the data in S3 within weeks, at a modest per-device fee with no charge for data transferred in. This is the standard offline-transfer answer whenever dataset size divided by bandwidth exceeds the deadline.</p><p><strong>A</strong> and <strong>D</strong> fail identically on physics — multipart uploads and DataSync improve efficiency and management but cannot conjure bandwidth, and night-only or throttled transfers make the math worse. <strong>B</strong> typically takes weeks to months just to provision the circuit and adds significant ongoing port cost for a one-time migration.</p>`
    },

    {
      q: "A development team runs 20 Aurora MySQL dev and test clusters that sit idle overnight and on weekends but see unpredictable bursts of activity during working hours. The databases must respond quickly whenever developers connect. Which change will reduce database costs the MOST while meeting this requirement?",
      options: [
        "Purchase reserved instances for all of the dev and test clusters",
        "Consolidate every schema onto one large provisioned Aurora cluster",
        "Snapshot the clusters each evening, delete them, and restore them every morning",
        "Migrate the clusters to Aurora Serverless v2 so capacity scales down automatically during idle periods"
      ],
      answer: [3],
      multi: false,
      domain: "Design Cost-Optimized Architectures",
      explanation: `<p><strong>D</strong> is correct. Aurora Serverless v2 bills per ACU-hour and scales capacity continuously and near-instantly with load: during idle nights and weekends each cluster shrinks to its minimum ACU floor, and it scales up in seconds when a developer connects — preserving responsiveness while eliminating charges for provisioned capacity that sits unused most of the week. For spiky, mostly idle dev/test fleets this is the textbook fit.</p><p><strong>A</strong> optimizes in the wrong direction: reservations discount an instance that keeps running 24x7 — committing one to three years of payment for capacity idle two-thirds of the time. <strong>B</strong> saves some money but creates noisy-neighbor contention, shared blast radius, and permission entanglement across 20 teams' databases — and the big cluster still runs all night. <strong>C</strong> cuts idle cost but breaks the requirement: morning restores take tens of minutes, and the delete/restore machinery is operational overhead with real failure modes.</p>`
    },

    {
      q: "A startup's finance lead wants an email notification before monthly AWS spending exceeds the agreed budget, including an early warning when forecasted charges are projected to cross the limit. Which tool provides this with the LEAST configuration effort?",
      options: [
        "AWS Cost Explorer with saved reports reviewed weekly",
        "AWS Budgets with alerts on both actual and forecasted costs",
        "AWS Cost and Usage Reports queried nightly by Athena with SNS notifications",
        "AWS Trusted Advisor cost optimization checks"
      ],
      answer: [1],
      multi: false,
      domain: "Design Cost-Optimized Architectures",
      explanation: `<p><strong>B</strong> is correct. AWS Budgets does precisely this out of the box: define a monthly cost budget, add alert thresholds, and choose whether each threshold evaluates actual or forecasted spend — the forecasted alert is the requested early warning, emailed (or sent via SNS) automatically. Setup is a few minutes in the console with nothing to operate afterward.</p><p><strong>A</strong> is an analysis tool: Cost Explorer visualizes and forecasts spend but sends no proactive notifications — someone has to remember to look, which is exactly what the finance lead wants to avoid. <strong>C</strong> would work and offers the richest data, but standing up CUR delivery, an Athena table, scheduled queries, and SNS wiring is a small engineering project — maximal configuration effort for a solved problem. <strong>D</strong> surfaces optimization recommendations like idle resources and rightsizing; it has no concept of a monthly budget threshold or forecast-based alerting.</p>`
    },

    {
      q: "A t3.large EC2 instance runs 24 hours a day solely to execute a data-validation script that is triggered a few dozen times per day; each run finishes in under 30 seconds and uses little memory. Which change reduces the cost of this workload the MOST while preserving its functionality?",
      options: [
        "Rewrite the task as a Lambda function invoked by the existing triggers and terminate the instance",
        "Move the script to a t3.micro instance running 24 hours a day",
        "Purchase a Standard Reserved Instance for the t3.large",
        "Run the script on an ECS cluster of two smaller instances for high availability"
      ],
      answer: [0],
      multi: false,
      domain: "Design Cost-Optimized Architectures",
      explanation: `<p><strong>A</strong> is correct. The instance does useful work for at most a few dozen 30-second runs — well under 30 minutes of compute per day — yet bills for 24 hours. Lambda inverts that: you pay per request and per millisecond of execution only while the script runs, which for this volume lands in the range of pennies per month (likely within the free tier), versus tens of dollars for any always-on instance. The event triggers map naturally to Lambda invocations, so functionality is preserved.</p><p><strong>B</strong> shrinks the waste but keeps the fundamental flaw — paying around the clock for seconds of daily work. <strong>C</strong> discounts the wrong baseline: roughly 40 percent off an instance that is about 99.9 percent idle is still overwhelmingly wasted spend, with a 1-to-3-year commitment attached. <strong>D</strong> doubles the always-on footprint in the name of availability nobody asked for — the most expensive option offered.</p>`
    },

    {
      q: "A ticketing service uses a DynamoDB table with provisioned capacity sized for peak on-sale events. Traffic is near zero for weeks at a time and then spikes unpredictably within minutes when ticket sales open, sometimes causing throttling despite the high provisioned settings. Which change is MOST cost-effective while preventing the throttling?",
      options: [
        "Raise the provisioned capacity further and add auto scaling with a low target utilization",
        "Add a DynamoDB Accelerator (DAX) cluster in front of the table to absorb the spikes",
        "Switch the table to on-demand capacity mode",
        "Enable DynamoDB Streams to buffer the excess write traffic"
      ],
      answer: [2],
      multi: false,
      domain: "Design Cost-Optimized Architectures",
      explanation: `<p><strong>C</strong> is correct. On-demand mode is designed for exactly this shape: no baseline charges during the weeks of near-zero traffic (you pay per request), and instant accommodation of sharp spikes — it immediately absorbs up to double the previous peak and scales beyond as sustained load grows. The company stops paying for weeks of idle provisioned capacity and stops throttling at on-sale moments; per-request pricing is higher, but for a mostly idle table the total is far lower.</p><p><strong>A</strong> compounds the waste — even more idle capacity between events — and auto scaling reacts on CloudWatch metrics over minutes, too slow for a spike that materializes in seconds. <strong>B</strong> only caches reads; on-sale spikes are dominated by writes (reservations and purchases), which pass straight through DAX to the throttled table. <strong>D</strong> misreads Streams entirely: it is a change-data-capture feed of already-committed writes, not an ingest buffer.</p>`
    },

    {
      q: "A company's nonproduction AWS environments run around the clock, although developers use them only on weekdays from 8 AM to 6 PM. The instance types were chosen by copying production sizes. Which TWO actions will reduce nonproduction compute costs? (Select TWO.)",
      options: [
        "Use AWS Instance Scheduler or equivalent automation to stop the instances outside business hours",
        "Purchase three-year all-upfront Reserved Instances for the nonproduction instances",
        "Migrate the nonproduction workloads onto Dedicated Hosts",
        "Right-size the instances based on AWS Compute Optimizer recommendations",
        "Enable detailed monitoring on the instances to reduce billing granularity"
      ],
      answer: [0, 3],
      multi: true,
      domain: "Design Cost-Optimized Architectures",
      explanation: `<p><strong>A</strong> and <strong>D</strong> are correct, and they compound. Developers use the environments 50 hours out of a 168-hour week, so scheduling instances to stop outside business hours cuts roughly 70 percent of instance-hours on its own (EBS storage still bills, compute does not). Independently, sizes copied from production are almost certainly oversized for dev/test; Compute Optimizer analyzes actual CloudWatch utilization and recommends smaller or different-family instances, shrinking the cost of the hours that remain.</p><p><strong>B</strong> is a trap given A: a three-year all-upfront commitment pays for 24x7 capacity on instances about to run 30 percent of the time — reservations only make sense for steady always-on baselines. <strong>C</strong> increases cost substantially; Dedicated Hosts serve licensing and isolation needs, not savings. <strong>E</strong> is backwards on both counts — detailed monitoring is an additional paid CloudWatch feature and has no effect on how compute is billed.</p>`
    }

  ]
});
