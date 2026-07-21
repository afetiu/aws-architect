/* Module 15 — Security Services: KMS, WAF & Friends (SAA track) */
window.COURSE.register({
  id: "security-services",
  order: 15,
  track: "saa",
  title: "Security Services: KMS, WAF & Friends",
  description: "KMS internals and envelope encryption, CloudHSM, Secrets Manager vs Parameter Store, ACM, the WAF/Shield/Network Firewall perimeter stack, the five detection services and how to tell them apart, and Cognito's two pools.",
  examWeight: "Domain 1 (30%) leans hard on this module: expect KMS key-type and key-policy questions, at least one 'which detection service' question, a WAF placement question, and a Secrets Manager vs Parameter Store discrimination on nearly every exam.",
  lessons: [
    {
      id: "kms-envelope-encryption",
      title: "KMS: key types, envelope encryption, and what the HSM boundary buys you",
      html: `
<p>Mental model: KMS is a multi-tenant HSM-backed service whose defining property is that <strong>key material never leaves the HSM boundary in plaintext</strong>. You do not download keys; you send small payloads to the API and cryptographic operations happen inside FIPS 140-2/140-3 validated hardware. Every use is an authenticated, authorized, CloudTrail-logged API call. That is the whole value proposition: keys become IAM-governed, auditable objects instead of files someone can copy.</p>

<h3>The three ownership tiers</h3>
<table>
<thead><tr><th></th><th>AWS-owned</th><th>AWS-managed (aws/service)</th><th>Customer-managed (CMK)</th></tr></thead>
<tbody>
<tr><td>Visible in your account</td><td>No</td><td>Yes (alias aws/s3, aws/ebs...)</td><td>Yes</td></tr>
<tr><td>Key policy editable</td><td>No</td><td>No (service-scoped, fixed)</td><td>Yes — full control</td></tr>
<tr><td>Cross-account use</td><td>n/a</td><td><strong>Never</strong></td><td>Yes, via key policy</td></tr>
<tr><td>Rotation</td><td>AWS-controlled</td><td>Automatic, yearly, fixed</td><td>Optional (yearly, on-demand)</td></tr>
<tr><td>Deletable / disable-able</td><td>No</td><td>No</td><td>Yes (waiting period)</td></tr>
<tr><td>Cost</td><td>Free</td><td>Free storage; per-request charges apply</td><td>1 USD/month + requests</td></tr>
</tbody>
</table>
<p>The decision collapses to one question: <strong>do you need to control the key policy — cross-account access, restricting who can decrypt, or your own deletion/rotation schedule?</strong> If yes, customer-managed. AWS-managed keys cannot be shared across accounts, which single-handedly answers every "encrypted snapshot/AMI must be shared with another account" question: it must be encrypted with a CMK, because the aws/ebs key's policy can never name a foreign principal.</p>

<h3>Symmetric vs asymmetric</h3>
<p>Default KMS keys are 256-bit symmetric (AES-GCM). Asymmetric keys (RSA, ECC, and SM2 in China regions) exist for two jobs: encrypt/decrypt where the encryptor holds only the public key, and sign/verify. The operational difference: the public key is downloadable and usable outside AWS, but the private half still never leaves the HSMs — verification can happen anywhere, signing requires an API call. Symmetric keys support the full feature set (data key generation, automatic rotation, imported material aside); asymmetric keys cannot generate data keys and do not support automatic rotation. Default to symmetric unless an external party must encrypt-to-you or verify-your-signatures without AWS credentials.</p>

<h3>Envelope encryption: the mechanics</h3>
<p>KMS refuses to encrypt more than <strong>4 KB</strong> per Encrypt call. This is not stinginess; it forces the correct architecture. Shipping gigabytes to an HSM fleet for every object would be slow, expensive, and a availability coupling nightmare. Instead:</p>
<ol>
<li>Call <code>GenerateDataKey</code> against your KMS key. You receive TWO things: a plaintext 256-bit data key and the same data key encrypted under the KMS key.</li>
<li>Encrypt your data locally (AES-GCM, in memory, at full CPU speed) with the plaintext key, then <strong>discard the plaintext key immediately</strong>.</li>
<li>Store the encrypted data key alongside the ciphertext — S3 literally stores it in object metadata.</li>
<li>To decrypt: send the encrypted data key to <code>kms:Decrypt</code>, get the plaintext key back, decrypt locally, discard again.</li>
</ol>
<p>Consequences worth internalizing: the KMS call cost is per <em>object access</em>, not per byte (which is why S3 Bucket Keys exist — they interpose a bucket-level key so millions of small-object requests do not each hit KMS, cutting KMS request costs by ~99%); revoking the KMS key's decrypt permission instantly makes ALL data keys — and therefore all data — unreadable, which is what "crypto-shredding" means; and every managed service that says "encrypted with KMS" (S3, EBS, RDS, DynamoDB...) is running exactly this dance internally. EBS does it once per volume attach: the encrypted volume key is decrypted via KMS and cached in hypervisor memory, so a running instance survives KMS unavailability but a new attach does not.</p>

<div class="callout deep">The ciphertext KMS returns is not bare AES output: it is a structure binding the ciphertext to the key ID and, optionally, to an <strong>encryption context</strong> — arbitrary key-value pairs that are cryptographically bound (AAD in AES-GCM terms) and must be presented identically at decrypt. Services use it to bind ciphertexts to resources (EBS passes the volume ID), which defeats ciphertext-swapping attacks, and the context appears in CloudTrail, giving you per-resource decrypt audit lines. Custom apps should always pass one — it is free integrity binding.</div>

<div class="callout exam">Reflexes: "share an encrypted EBS snapshot/AMI with another account" — re-encrypt with a customer-managed key and grant the account in the key policy; the default aws/ebs key can never cross accounts. "Encrypt a 50 MB file with KMS" — GenerateDataKey and envelope encryption; a bare Encrypt call fails over 4 KB. "Make data unrecoverable immediately" — deletion has a waiting period, but disabling the key or removing decrypt grants is instantaneous. "Reduce KMS costs for S3" — S3 Bucket Keys.</div>

<div class="callout war">The production outage shape: a well-meaning security engineer tightens a key policy and every service using that key starts throwing AccessDenied — but only gradually, as caches expire (EBS volumes fail on next attach, not instantly; Lambda environment decryption fails on cold start). The delayed, partial blast radius makes it hard to correlate with the change. Treat key-policy edits with the same fear as production DNS changes, and alarm on kms:Decrypt AccessDenied in CloudTrail.</div>

<div class="callout limits">Numbers: 4 KB max plaintext per Encrypt/Decrypt call. Data keys: 256-bit AES by default. CMK cost 1 USD/month; API calls ~0.03 USD per 10k requests. Request quotas: symmetric cryptographic operations share a per-account per-region rate (tens of thousands of req/s in large regions, shared across services using your CMKs) — hitting it throttles S3 reads and Lambda cold starts alike; Bucket Keys and DynamoDB's key caching exist to keep you far from it.</div>
`
    },
    {
      id: "kms-policies-lifecycle",
      title: "KMS access control and lifecycle: key policies, grants, rotation, MRKs, deletion",
      html: `
<p>KMS authorization is unusual in one load-bearing way: <strong>the key policy is the root of trust, and IAM policies alone grant nothing unless the key policy lets them.</strong> Every CMK has exactly one key policy (a resource policy, max 32 KB). The default policy contains the famous statement allowing the account root ARN full kms:* access — that statement is what "turns on" IAM for the key: it delegates authorization to the account's IAM policies. Delete or narrow it and IAM policies in the account stop working for that key; if you remove it while also not granting yourself anything, you have an unmanageable key and a support case. Contrast with S3, where an identity policy alone is sufficient same-account: KMS requires the key policy's blessing, always.</p>

<h3>Grants: programmatic, temporary delegation</h3>
<p>Key policies are static JSON with size limits; AWS services need to acquire and release permissions dynamically as resources come and go. That is what <strong>grants</strong> are: API-created permission entries on a key (CreateGrant), scoped to a grantee principal and a list of operations, optionally constrained by encryption context, revocable at any time, with no policy-document editing. When EBS attaches an encrypted volume, the service creates a grant allowing it to decrypt that volume's data key, uses it, and retires it. Humans use key policies and IAM; services use grants. Two exam-relevant behaviors: grants only allow (never deny), and a newly created grant is subject to brief eventual consistency — the token returned by CreateGrant can be used immediately to bridge the gap.</p>

<h3>Rotation</h3>
<p>Automatic rotation (opt-in, yearly, symmetric CMKs with KMS-generated material) does something subtler than people assume: KMS generates a new <em>backing key</em> but keeps all previous backing keys forever under the same key ID and ARN. New encryptions use the new material; decryption transparently uses whichever backing key produced the ciphertext. <strong>Nothing is re-encrypted, and no application changes occur</strong> — the key ID never changes. This means rotation limits the blast radius of a hypothetical backing-key compromise going forward but does not retroactively protect old ciphertexts; for that you re-encrypt data yourself or use a new key. On-demand rotation exists for compliance-triggered rotation between yearly cycles. AWS-managed keys rotate yearly, non-negotiably. Asymmetric keys and imported-material keys do not support automatic rotation — rotating those means creating a new key and re-pointing the alias, which is precisely what <strong>aliases</strong> are for: applications reference the alias, operators move it.</p>

<h3>Multi-Region keys (MRKs)</h3>
<p>Normal KMS keys are strictly regional — ciphertext from us-east-1 cannot be decrypted in eu-west-1, full stop. MRKs relax exactly this: a primary key and replica keys in other regions share the <em>same key material and same key ID</em> (the ARN differs only in region), so ciphertext moves freely between regions and each region decrypts locally. They are not one global key: each replica is an independent resource with its own key policy and its own regional API dependency — which is the point, since a us-east-1 KMS outage does not stop eu-west-1 decryption. Use cases: DynamoDB global tables with client-side encryption, cross-region DR where re-encrypting everything is impractical, active-active apps. Not a default: regional key isolation is a security feature (a compromised region's ciphertext is useless elsewhere), so replicate keys only with a reason.</p>

<h3>Imported key material and BYOK</h3>
<p>You can create a CMK with <em>no</em> AWS-generated material and import your own (wrapped under an RSA public key KMS gives you). What you gain: provable key provenance, the ability to set an expiry on the material, and the nuclear option — <strong>delete the imported material immediately</strong>, no waiting period, making everything encrypted under it unreadable now (re-importable later if you kept a copy, which is your job: AWS keeps no backup of imported material). What you lose: automatic rotation, and durability responsibility shifts to you. This is the compliance checkbox feature; most teams should not want it.</p>

<h3>Deletion: the waiting period</h3>
<p>You cannot delete a CMK synchronously. ScheduleKeyDeletion sets a waiting period of <strong>7 to 30 days</strong> (default 30) during which the key is unusable but recoverable via CancelKeyDeletion. The reason is the crypto-shredding asymmetry: deleting a key silently destroys every byte ever encrypted under it, including EBS snapshots and S3 objects nobody remembers — an irreversible, delayed-detonation mistake. During the window, alarm on the key's pending-deletion state and on any Decrypt attempts against it (CloudTrail shows who still depends on it). If you need access cut <em>now</em>, disable the key — instant and reversible — then schedule deletion.</p>

<h3>CloudHSM vs KMS</h3>
<table>
<thead><tr><th></th><th>KMS</th><th>CloudHSM</th></tr></thead>
<tbody>
<tr><td>Tenancy</td><td>Multi-tenant HSM fleet, AWS-operated</td><td>Single-tenant HSM cluster in your VPC</td></tr>
<tr><td>Who controls keys</td><td>AWS operates, you authorize via policy</td><td>Only you — AWS has zero access to key material</td></tr>
<tr><td>Validation</td><td>FIPS 140-2/3</td><td>FIPS 140-2 Level 3 hardware</td></tr>
<tr><td>Interfaces</td><td>AWS API + IAM</td><td>PKCS#11, JCE, KSP — standard crypto interfaces; no IAM/CloudTrail on key ops</td></tr>
<tr><td>Ops burden</td><td>None</td><td>Yours: users, quorum (M-of-N), backups, client software, HA (2+ HSMs across AZs)</td></tr>
<tr><td>Cost shape</td><td>1 USD/key/month + requests</td><td>~1.5-2 USD per HSM per hour, per instance — thousands/month</td></tr>
</tbody>
</table>
<p>Choose CloudHSM only for: contractual/regulatory single-tenancy or Level-3 requirements, SSL offload with standard PKCS#11 tooling, Oracle TDE, or being your own root of trust — including using CloudHSM as the key store behind KMS (custom key store), which gives KMS's API surface with your HSM's tenancy. Everyone else: KMS. The exam signals CloudHSM with the phrases "dedicated hardware," "single-tenant," "FIPS 140-2 Level 3," or "AWS must not have access to keys."</p>

<div class="callout exam">High-frequency items: key policy must allow access or IAM is powerless — "IAM admin cannot use the key" means the key policy lacks the root-delegation statement. "Grant temporary programmatic access to a key for a service" — grants. "Rotation without changing application configuration" — automatic rotation keeps the same key ID; alias re-pointing covers the rest. "Encrypt in one region, decrypt in another" — multi-Region keys. "Immediately render data unrecoverable" — delete imported key material (no wait) or disable; scheduled deletion waits 7-30 days.</div>

<div class="callout war">The unmanageable-key incident is real: automation applies a key policy from a template missing the root-delegation statement, and now no principal — including admins — can administer the key. Recovery requires AWS Support. Lint key policies for the root statement in CI. Second war story: teams schedule deletion on "unused" keys and discover 26 days later that a quarterly batch job decrypts archives under it — keep the full 30-day window unless you have positive evidence, and watch CloudTrail during it.</div>

<div class="callout limits">Key policy max 32 KB, exactly one per key. Deletion window 7-30 days (default 30); imported material deletable instantly. Automatic rotation: every 365 days, symmetric KMS-material keys only. MRK replicas: same key ID/material, independent policies, one primary at a time (primary is re-assignable). Grants per key: thousands (quota varies); CreateGrant returns a token usable immediately.</div>
`
    },
    {
      id: "secrets-parameter-store",
      title: "Secrets Manager vs SSM Parameter Store: the eternal discrimination",
      html: `
<p>Two services store small encrypted strings and hand them to applications via IAM-authorized API calls. The exam asks you to pick between them constantly, and production architects face the same choice weekly. The discrimination is clean once you see what each is actually for: <strong>Parameter Store is a configuration hierarchy that can also hold secrets; Secrets Manager is a secret-lifecycle machine.</strong></p>

<h3>The comparison that decides everything</h3>
<table>
<thead><tr><th></th><th>SSM Parameter Store</th><th>Secrets Manager</th></tr></thead>
<tbody>
<tr><td>Cost (standard tier)</td><td><strong>Free</strong> (advanced tier: 0.05 USD/param/month)</td><td>0.40 USD per secret per month + 0.05 USD per 10k API calls</td></tr>
<tr><td>Automatic rotation</td><td>None built in (roll your own with EventBridge + Lambda)</td><td><strong>Native</strong>: managed rotation for RDS/Aurora/Redshift/DocumentDB credentials; custom Lambda rotators for anything else</td></tr>
<tr><td>Cross-account access</td><td>Limited (resource sharing via RAM for advanced-tier params exists, but not the primary pattern)</td><td><strong>Yes</strong> — resource policies on secrets, the standard cross-account secret pattern</td></tr>
<tr><td>Cross-region replication</td><td>No (copy yourself)</td><td>Native secret replication to other regions</td></tr>
<tr><td>Size limits</td><td>4 KB standard / 8 KB advanced</td><td>64 KB</td></tr>
<tr><td>Encryption</td><td>SecureString type via KMS (optional — String/StringList are plaintext)</td><td>Always encrypted via KMS, no plaintext option</td></tr>
<tr><td>Random password generation</td><td>No</td><td>Yes (GetRandomPassword, used by rotation)</td></tr>
<tr><td>Hierarchy/organization</td><td>Path hierarchy (/app/prod/db/host), GetParametersByPath, IAM by path prefix</td><td>Flat names + tags</td></tr>
</tbody>
</table>

<h3>The decision rule</h3>
<p><strong>Needs rotation, is a database credential, or must be shared cross-account: Secrets Manager. Everything else — feature flags, endpoints, AMI IDs, license keys, config that happens to be sensitive: Parameter Store SecureString, for free.</strong> The exam encodes this as keyword pairs: "automatic rotation" or "rotate every 30 days" always means Secrets Manager; "most cost-effective way to store configuration/secrets" with no rotation requirement always means Parameter Store. Mixed estates are normal and correct: hundreds of free parameters, a handful of paid rotating secrets — and Parameter Store can even reference Secrets Manager secrets through its API surface, so applications can standardize on one read path.</p>

<h3>How managed rotation actually works</h3>
<p>For supported databases, Secrets Manager deploys a rotation Lambda that executes a four-step protocol: createSecret (generate new password, store as AWSPENDING), setSecret (apply it in the database), testSecret (verify login), finishSecret (promote AWSPENDING to AWSCURRENT; the old value becomes AWSPREVIOUS). Two strategies matter architecturally: <strong>single-user</strong> rotation changes the one user's password — simple, but there is an instant where in-flight connections hold a dead password; <strong>alternating-users</strong> rotation maintains two database users and flips between them, so the previous credential keeps working through the transition — zero-downtime, the right choice for busy services. Client-side, applications must re-fetch on auth failure rather than caching forever; the AWS-provided caching libraries (and the Lambda/ECS secrets extensions) do the refresh-on-failure dance for you. Rotation Lambdas need network reach to the database — in a VPC that means the Lambda lives in the VPC with a route, plus a Secrets Manager VPC endpoint or NAT for the API calls; forgetting that plumbing is the number-one rotation setup failure.</p>

<h3>What both share</h3>
<p>IAM-governed access with resource-level ARNs and condition support, KMS envelope encryption underneath (with the key-policy implications from the last lesson — cross-account secret sharing requires the CMK to be shareable too, an AWS-managed key breaks it), CloudTrail audit of every read, versioning, and VPC endpoints (private API access without internet egress). Neither is for large payloads — certificates and small JSON blobs yes, files no; that is S3 with SSE-KMS.</p>

<div class="callout exam">The cross-account trap has two keys: sharing a Secrets Manager secret across accounts requires BOTH a resource policy on the secret AND the KMS key policy of the encrypting CMK to allow the foreign principal — and therefore the secret must be encrypted with a customer-managed key, because the default aws/secretsmanager key can never cross accounts. Options that share the secret but keep the default key are the designed wrong answer. Also: "store database credentials and rotate automatically with NO custom code" — Secrets Manager managed rotation for RDS; Parameter Store options requiring a hand-built Lambda lose on operational overhead.</div>

<div class="callout war">Two production burns. First, secret sprawl in environment variables: teams fetch the secret at deploy time and bake it into env vars, so rotation breaks nothing until the process restarts weeks later with the long-dead cached password — fetch at runtime with refresh-on-failure, not at deploy. Second, cost surprise at scale: 0.40 USD per secret is nothing until a microservices platform mints one secret per service per environment per region and the bill shows four figures; consolidate related credentials into one JSON secret (it is a key-value document, use it) and put non-rotating config in Parameter Store.</div>

<div class="callout limits">Memorize: Parameter Store standard free / 4 KB / 10,000 params per account per region (advanced: 8 KB, 100k, higher throughput for a fee — and throughput itself is a settable, billable knob). Secrets Manager: 0.40 USD/secret/month, 64 KB, 30-day recovery window on deletion by default (7-30 configurable — like KMS, deletion is scheduled, not instant; force-delete-without-recovery exists and should frighten you). Rotation schedule granularity down to 4 hours via schedule expressions.</div>
`
    },
    {
      id: "acm-certificates",
      title: "ACM: managed TLS, validation, renewal, and the us-east-1 rule",
      html: `
<p>ACM's pitch is the elimination of the certificate-expiry outage class: public TLS certificates issued free, renewed automatically, deployed to AWS's terminating services without you ever handling a private key. The mental model — <strong>ACM certificates are bound to AWS services, not to you</strong>: for ACM-generated public certs the private key lives in ACM (protected by KMS) and is <em>not exportable</em>. You cannot take an ACM public cert to an EC2 nginx, an on-prem box, or a container. It attaches only to integrated services: ALB/NLB (TLS listeners), CloudFront, API Gateway, App Runner, Elastic Beanstalk's balancers, and friends. If you need the key material, you either import a cert you obtained elsewhere into ACM (you manage renewal then) or use ACM Private CA's exportable certificates.</p>

<h3>Validation: proving domain control</h3>
<ul>
<li><strong>DNS validation (use this)</strong>: ACM gives you a CNAME record; you publish it; validation completes and — the important part — <strong>renewal is automatic forever</strong>, because ACM re-checks the same CNAME. With Route 53, the console/API creates the record for you. The CNAME must stay in place for the certificate's lifetime; deleting it after issuance is the classic self-inflicted renewal failure.</li>
<li><strong>Email validation (legacy)</strong>: mails to WHOIS/admin addresses; a human clicks a link — and must do so again for every renewal. Choose it only when you cannot touch DNS, and expect the renewal-time fire drill.</li>
</ul>
<p>Certificates are valid 13 months; ACM begins renewal attempts well before expiry and surfaces failures via Config, EventBridge (expiry events, configurable days-before), and console warnings. Wildcards cover exactly one label (star.example.com does not cover a.b.example.com); certs can carry multiple SANs; and issuance for domains you cannot validate is impossible — CAA records in DNS can additionally restrict which CAs may issue for your domain (allow amazon.com or issuance fails).</p>

<h3>The regional constraint and the CloudFront rule</h3>
<p>ACM certificates are <strong>regional resources</strong>: a certificate can only be attached to resources in the region where it was requested. An ALB in eu-west-1 needs a certificate requested in eu-west-1; multi-region architectures request the same domain's cert in each region (free, so this is fine — and DNS validation records are identical, so one CNAME validates all regions). The single, heavily-tested exception: <strong>CloudFront is a global service configured from us-east-1, so certificates for CloudFront distributions MUST exist in us-east-1</strong>, regardless of where origins or viewers are. A cert in any other region simply does not appear in the distribution's certificate dropdown. Similar us-east-1 gravity applies to certificates for API Gateway edge-optimized custom domains (which are CloudFront underneath). Regional API Gateway endpoints use certs in their own region.</p>

<h3>ACM Private CA</h3>
<p>A separate, decidedly not-free product (~400 USD/month per CA) that runs a private certificate authority hierarchy for internal PKI: mTLS between microservices, internal hostnames that public CAs will not issue for, IoT device identity, and — relevant to the export limitation — private certs <em>are</em> exportable with their keys, so they can live on EC2, on-prem, anywhere. It integrates with ACM for issuance and renewal automation. The exam signal: "internal applications," "private domain names," "mutual TLS between services," or "certificates for devices" point at Private CA; the 400-dollar shape means it is never the answer to a cost-optimized public-website question.</p>

<h3>What ACM does not do</h3>
<p>No client certificates for people (Private CA territory), no code signing (that is Signer), no S3 website endpoints (S3 static sites do not terminate TLS on custom domains — put CloudFront in front, which is also how you get the cert attached), no exporting public-cert keys, and no attachment to plain EC2. Every one of these appears as a distractor.</p>

<div class="callout exam">The us-east-1 CloudFront rule is among the most-tested single facts on the exam. Pattern: "website served via CloudFront, certificate requested in eu-west-1, cannot be selected" — request it in us-east-1. Second pattern: "avoid manual renewal effort" — DNS validation, keep the CNAME. Third: "terminate TLS on EC2 with a free auto-renewing ACM cert" — impossible; the correct redesigns put an ALB/NLB (with the ACM cert) in front, or use an imported/Private CA cert on the instance.</div>

<div class="callout war">Renewal failures are quiet: ACM emails and raises events, but if the validation CNAME was deleted during a DNS migration, the first hard signal many teams get is browsers refusing connections 13 months after someone "cleaned up" DNS. Alarm on the ACM expiry EventBridge events (set the threshold at 30+ days) and treat validation CNAMEs as production infrastructure in your DNS IaC. Imported certificates are worse: ACM does not renew them at all — track their expiry yourself or feed them from your CA's automation.</div>

<div class="callout limits">Free: public certificates, unlimited-ish (default quota ~2,500 ACM certs per account, and a yearly issuance quota that batch jobs can trip). 13-month validity, auto-renewal for ACM-issued DNS-validated certs. Wildcard = one label. Private CA ~400 USD/month per CA plus per-cert fees. Regional binding with the us-east-1 CloudFront exception. Private keys of ACM public certs: never exportable.</div>
`
    },
    {
      id: "waf-shield-firewalls",
      title: "The perimeter stack: WAF, Shield, Firewall Manager, Network Firewall",
      html: `
<p>Four services, four different layers, one exam pattern: identify which layer the described threat lives at. The map: <strong>Shield</strong> is DDoS (L3/4 volumetric and state-exhaustion, plus L7 with Advanced), <strong>WAF</strong> is HTTP request inspection (L7 — SQLi, XSS, bots, rate abuse), <strong>Network Firewall</strong> is VPC-level traffic filtering (L3-L7 network flows, east-west and egress), and <strong>Firewall Manager</strong> is not a firewall at all but the org-wide policy deployer for the other three plus security groups.</p>

<h3>WAF: web ACLs and where they attach</h3>
<p>A <strong>web ACL</strong> is an ordered set of rules evaluated against each HTTP request, each rule matching conditions (patterns in URI/headers/body, IP sets, geo, size, regex) with an action: allow, block, count (observe-only — the deployment safety valve), CAPTCHA, or challenge (silent JS interrogation). Capacity is budgeted in WCUs (web ACL capacity units), which is the mechanism that keeps rule evaluation cheap enough to run inline. Attachment points — memorize the list because it defines what WAF can protect: <strong>CloudFront distributions, ALBs, API Gateway REST APIs, AppSync, Cognito user pools, App Runner, and (regionalized) a few others. Never NLBs</strong> — an NLB forwards TCP without terminating HTTP, so there is nothing for WAF to inspect; this is a standing distractor. WAF on CloudFront runs at the edge (create the web ACL in us-east-1 scope CLOUDFRONT); WAF on an ALB runs regionally.</p>
<p><strong>Managed rule groups</strong> are the practical core: AWS-maintained sets (Core rule set, Known bad inputs, SQL injection, IP reputation, Bot Control, account-takeover protection) plus Marketplace vendors. They version and update as threats evolve — accepting them is outsourcing signature maintenance, and the exam grades that as lower operational overhead than hand-writing rules. <strong>Rate-based rules</strong> track request rates per source IP over a trailing window and block IPs exceeding a threshold (minimum 10 requests per aggregation window; classic setting: a few thousand per 5 minutes) until the rate drops — the tool for scraping, credential stuffing, and blunt L7 floods. The keyword mapping is mechanical: "SQL injection / XSS" means WAF managed rules; "limit requests per client IP" means WAF rate-based rule; "block requests from specific countries" means WAF geo match.</p>

<h3>Shield Standard vs Advanced</h3>
<table>
<thead><tr><th></th><th>Standard</th><th>Advanced</th></tr></thead>
<tbody>
<tr><td>Cost</td><td>Free, automatic, everyone</td><td>3,000 USD/month, 1-year commitment, per org</td></tr>
<tr><td>Covers</td><td>Common L3/4 attacks (SYN floods, reflection) at the edge</td><td>Adds: tailored detection for EIP/ALB/CloudFront/Global Accelerator/Route 53 resources, L7 visibility, health-based detection</td></tr>
<tr><td>Response</td><td>Automatic mitigations only</td><td>24/7 Shield Response Team (SRT) engagement, proactive engagement option</td></tr>
<tr><td>Money-back</td><td>—</td><td><strong>Cost-protection refunds</strong> for scaling charges caused by attack, and WAF at no extra charge for protected resources</td></tr>
</tbody>
</table>
<p>The two Advanced discriminators the exam uses: access to the response team, and the DDoS cost-protection guarantee. A scenario mentioning either — "expert assistance during attacks" or "concerned about the bill from attack-driven autoscaling" — is Shield Advanced. Everything else DDoS-flavored is Standard doing its job invisibly, ideally with the architecture itself absorbing attacks (CloudFront + Route 53 in front, so the edge eats the flood).</p>

<h3>Network Firewall</h3>
<p>A managed, stateful network firewall deployed as endpoints in your VPCs, built on Suricata — it supports stateless and stateful rules, domain allowlisting/blocklisting for egress (FQDN filtering that security groups cannot do), IPS signatures, and TLS SNI inspection. Traffic reaches it via VPC route tables (typically an inspection VPC pattern with Transit Gateway, or per-AZ firewall endpoints in a distributed model). Choose it when requirements say: filter <em>outbound</em> traffic by domain name, deep packet inspection, intrusion prevention, or centralized inspection of VPC-to-VPC/VPC-to-internet flows. Distinguish from security groups (instance-level stateful allow lists, no deny rules, no L7), NACLs (subnet-level stateless allow/deny, no state, no domains), and WAF (HTTP only, attached to L7 services rather than routed through).</p>

<h3>Firewall Manager</h3>
<p>The org-scale control plane: define a security policy once — WAF web ACLs, Shield Advanced protections, security-group baselines and audits, Network Firewall deployments, Route 53 Resolver DNS Firewall — and Firewall Manager enforces it across every account and every matching resource in the organization, <em>including resources created next week in accounts created next month</em>. Requirements: an organization, a delegated admin account, and Config enabled. The exam trigger phrase is exactly that shape: "ensure every current AND future ALB/account has WAF rules applied automatically" — nothing else answers continuous, org-wide, auto-remediating enforcement.</p>

<div class="callout war">WAF deployments fail in two directions. Blocking too eagerly: teams enable Core rule set in block mode on day one and break their own app's legitimate POSTs (rich text triggers XSS signatures) — always run new rules in count mode against production traffic first, then flip. Blocking too little: WAF on the ALB while the ALB stays open to the internet lets attackers bypass CloudFront (and its edge WAF) by hitting the ALB directly — lock the ALB to CloudFront via the managed prefix list or origin custom headers checked by a WAF rule.</div>

<div class="callout exam">Layer-matching drill: SQLi/XSS — WAF managed rules. Per-IP request limits — WAF rate-based. SYN flood — Shield Standard (already handled). DDoS cost protection or response-team access — Shield Advanced. Filter egress by domain / IPS in the VPC — Network Firewall. Enforce WAF on all accounts' ALBs forever — Firewall Manager. And WAF never attaches to an NLB or EC2 directly.</div>

<div class="callout limits">Numbers: Shield Advanced 3,000 USD/month with 12-month commitment. WAF pricing shape: per web ACL + per rule + per million requests. Rate-based rule minimum threshold 10 (window-dependent); default evaluation window 5 minutes. Web ACL default capacity 1,500 WCU (raisable). Firewall Manager needs Organizations + Config. Network Firewall bills per endpoint-hour plus per GB processed — the per-AZ endpoint model multiplies the hourly cost by your AZ count.</div>
`
    },
    {
      id: "detection-services",
      title: "GuardDuty, Inspector, Macie, Security Hub, Detective: which detective when",
      html: `
<p>Five services with overlapping marketing and disjoint jobs. The exam asks "which service" repeatedly; production asks the same at procurement time. Fix the one-line jobs first, then the details:</p>
<table>
<thead><tr><th>Service</th><th>Question it answers</th><th>Input it consumes</th></tr></thead>
<tbody>
<tr><td><strong>GuardDuty</strong></td><td>Is something malicious happening right now?</td><td>CloudTrail, VPC Flow Logs, DNS logs (+ optional: S3 data events, EKS audit, RDS logins, Lambda network, malware scan of EBS)</td></tr>
<tr><td><strong>Inspector</strong></td><td>What is vulnerable before anyone attacks it?</td><td>EC2 (via SSM agent), ECR images, Lambda functions — CVEs and network exposure</td></tr>
<tr><td><strong>Macie</strong></td><td>Where is my sensitive data?</td><td>S3 objects only — content classification (PII, credentials, financial data) + bucket posture</td></tr>
<tr><td><strong>Security Hub</strong></td><td>What is my overall posture, in one place?</td><td>Findings from all of the above + Config-based compliance checks against standards (CIS, PCI, AWS Foundational)</td></tr>
<tr><td><strong>Detective</strong></td><td>What happened, how, and how far did it spread?</td><td>The same telemetry as GuardDuty, retained ~1 year in a graph for investigation</td></tr>
</tbody>
</table>

<h3>GuardDuty: threat detection</h3>
<p>Continuous, agentless analysis of account telemetry against threat intelligence and ML baselines: cryptomining DNS lookups, API calls from Tor exit nodes or known-bad IPs, credential exfiltration patterns (instance credentials used from outside AWS — a signature finding), unusual API patterns for a principal, S3 exfil behavior. You enable it per account/region (org-wide via delegated admin) and it starts producing severity-ranked findings; there is nothing to install and no logs you must set up — it taps the streams directly, including DNS logs you cannot otherwise access. It is detection only: response is your EventBridge-triggered automation (isolate the instance's SG, snapshot for forensics, revoke the role's sessions — module 2's TokenIssueTime deny). Keywords: "malicious activity," "compromised instance/credentials," "cryptocurrency mining," "anomalous behavior."</p>

<h3>Inspector: vulnerability management</h3>
<p>The modern Inspector (v2) continuously scans EC2 instances (through the SSM agent — unmanaged instances are invisible, the operational gotcha), ECR container images (on push and continuously as new CVEs publish), and Lambda functions/layers, producing CVE findings with an environment-aware risk score, plus <strong>network reachability</strong> findings (this port is open to the internet through this SG/route path). It is preventive-posture, not threat detection: an Inspector finding means "patchable weakness exists," a GuardDuty finding means "behavior observed." Keywords: "CVEs," "unpatched software," "vulnerability assessment," "scan container images," "unintended network exposure."</p>

<h3>Macie: sensitive data discovery</h3>
<p>Managed ML + pattern matching over S3 content: finds PII (names, credentials, card numbers, national IDs, your own custom identifiers via regex) and reports which buckets/objects hold it, alongside bucket security posture (public, unencrypted, shared outside the org). S3 only — Macie does not scan databases, EBS, or traffic. Its cost model (per GB classified) means you target it, not boil the lake. Keywords: "PII," "sensitive data in S3," "data classification," "compliance requires knowing where personal data lives."</p>

<h3>Security Hub: aggregation and posture</h3>
<p>The single pane: ingests findings from GuardDuty, Inspector, Macie, Access Analyzer, Firewall Manager, and dozens of partners, normalizes them into one format (ASFF), runs its own automated configuration checks against standards (CIS AWS Foundations, PCI DSS, AWS Foundational Security Best Practices) via Config rules, scores your posture, and routes everything through EventBridge for automated response. Org-aware with a delegated admin and cross-region aggregation. It generates almost no first-party threat findings — no GuardDuty underneath means no threat detection, a distinction the exam tests. Keywords: "centralize/aggregate findings," "compliance score," "CIS benchmark," "single view across accounts."</p>

<h3>Detective: investigation</h3>
<p>Where GuardDuty says "instance i-abc is beaconing," Detective answers the follow-ups: what did this instance/role/IP do over the last months, what else did the credential touch, when did behavior change? It builds a behavior graph from CloudTrail, VPC Flow Logs, and GuardDuty findings with about a year of retention and interactive pivoting. It is the root-cause and scope tool <em>after</em> detection. Keywords: "investigate," "root cause," "determine the scope/timeline of the compromise," "analyze relationships between entities."</p>

<div class="callout exam">The pattern is nearly mechanical — match the verb: <em>detect threats</em> = GuardDuty; <em>find vulnerabilities/CVEs</em> = Inspector; <em>find PII in S3</em> = Macie; <em>aggregate findings / check compliance standards</em> = Security Hub; <em>investigate a finding's scope</em> = Detective. Multi-service answers are normal: GuardDuty detects, EventBridge triggers, Detective investigates, Security Hub aggregates. A distractor placing Macie on EC2 or Inspector on S3 content is a category error — eliminate on sight.</div>

<div class="callout war">Enabling is the easy 10%; the silent failure is unowned findings. GuardDuty firing into a console nobody opens is theater — every deployment needs an EventBridge route to a queue humans actually work (ticketing, paging for high severity) plus auto-response for the unambiguous cases (isolate on cryptomining). Second gotcha: all of these are regional; a detector enabled in three regions of seventeen leaves fourteen dark, and attackers deliberately operate in unwatched regions — enable org-wide, all regions, via the delegated admin, and aggregate to one region.</div>

<div class="callout limits">Cost shapes (what you pay on): GuardDuty — volume of events/logs analyzed. Inspector — instances and images scanned per month. Macie — GB of S3 data classified (target it) + buckets monitored. Security Hub — checks and ingested findings (cheap). Detective — volume of data ingested into the graph. Free trials: 30 days each, org-wide — turn them all on in a burst quarter and measure real cost before committing. Detective retention ~1 year; GuardDuty findings 90 days.</div>
`
    },
    {
      id: "cognito",
      title: "Cognito: user pools vs identity pools, tokens, and where each fits",
      html: `
<p>Cognito is customer-facing identity — the answer when the humans authenticating are your <em>application's users</em>, not your workforce (that was Identity Center, module 2). It is two products under one name, coupled but independent, and the exam's favorite move is testing whether you know which does what:</p>

<h3>User pools: authentication (who are you?)</h3>
<p>A user pool is a managed user directory plus an OIDC authorization server: sign-up, sign-in, email/phone verification, password policy, MFA (SMS/TOTP), account recovery, adaptive risk-based authentication and compromised-credential blocking (advanced security tier), a hosted UI if you want it, and Lambda triggers at every lifecycle step (pre-sign-up domain allowlisting, custom auth challenges, token claim injection). Critically, it also <strong>federates</strong>: users can arrive via Google, Facebook, Apple, SAML, or any OIDC IdP, and the pool normalizes them into one directory. Successful authentication yields three JWTs: an <strong>ID token</strong> (identity claims), an <strong>access token</strong> (authorization scopes/groups), and a <strong>refresh token</strong>. These are standard OIDC artifacts — an ALB or API Gateway can validate them natively: API Gateway has a built-in Cognito authorizer for REST APIs and JWT authorizers for HTTP APIs, and an ALB can offload the whole login dance via its authenticate-cognito action. What user-pool tokens are <em>not</em>: AWS credentials. A user-pool JWT cannot sign an S3 request.</p>

<h3>Identity pools: authorization to AWS (what can you touch?)</h3>
<p>An identity pool (federated identities) exchanges an external identity proof — a user-pool JWT, a social/OIDC/SAML token, or nothing at all (<strong>unauthenticated guest identities</strong>, for freemium app tiers) — for <strong>temporary AWS credentials</strong> via STS. It maps identities to IAM roles: a default authenticated role, a guest role, and rule-based or token-claim-based mapping to finer roles; combined with policy variables keyed on the Cognito identity ID, each user can be scoped to their own S3 prefix or DynamoDB rows (the ABAC pattern from module 2, applied to consumers). The mental model: <strong>user pool = OIDC IdP; identity pool = STS broker.</strong> They compose but neither requires the other — a mobile app that only calls your API needs the user pool alone; an app whose clients hit AWS services directly (upload to S3, read DynamoDB) adds the identity pool.</p>

<h3>The decision table</h3>
<table>
<thead><tr><th>Requirement</th><th>Answer</th></tr></thead>
<tbody>
<tr><td>Sign-up/sign-in for an app; JWTs for your API</td><td>User pool</td></tr>
<tr><td>App users need direct, scoped access to S3/DynamoDB</td><td>Identity pool (usually fed by a user pool)</td></tr>
<tr><td>Social login (Google/Apple) normalized into one directory</td><td>User pool federation</td></tr>
<tr><td>Guest/anonymous access to limited AWS resources</td><td>Identity pool unauthenticated identities</td></tr>
<tr><td>Protect an API Gateway REST API with app-user identity</td><td>User pool + Cognito authorizer</td></tr>
<tr><td>Workforce SSO into AWS accounts</td><td>NOT Cognito — IAM Identity Center</td></tr>
</tbody>
</table>

<h3>Architecture and limits that matter</h3>
<p>User pools are regional with no native cross-region replication — multi-region active-active user identity is genuinely hard (export/import or dual-write patterns; plan for it early if DR demands it). Token lifetimes are configurable: access/ID tokens 5 minutes to 24 hours (default 1 hour), refresh tokens 60 minutes to 10 years (default 30 days) — long refresh tokens are a stolen-device risk; revocation exists but token validation is stateless JWT-signature checking, so already-issued access tokens live until expiry unless the validator also checks revocation. Pricing is per monthly active user with a free tier (tens of thousands of MAUs), then tiered — and the advanced-security features multiply the per-MAU price; identity pools are free (you pay for what the credentials touch). Lambda triggers make user pools deeply customizable but also make login latency depend on your Lambda cold starts — keep triggers lean.</p>

<div class="callout exam">Discriminators the exam actually uses: "authenticate users FOR the application" or "user directory / sign-up / MFA for an app" — user pool. "Provide users temporary AWS credentials to access S3/DynamoDB directly" — identity pool. "Guest users" — identity pool unauthenticated role. "Employees" anywhere in the sentence — Identity Center, never Cognito. A distractor granting app users IAM users, or claiming user-pool tokens can call AWS APIs, is wrong by category.</div>

<div class="callout war">Two recurring production wounds. First, over-scoped identity-pool roles: the authenticated role gets s3:* on the app bucket and any authenticated user can read every other user's files — always scope with the cognito-identity.amazonaws.com:sub policy variable per-identity prefix, and test with two users. Second, teams validate the ID token at their API instead of the access token, or skip verifying the token's issuer/audience claims entirely; JWT validation must check signature against the pool's JWKS, expiry, issuer, and the intended audience, or any token from any pool passes.</div>

<div class="callout deep">The identity-pool exchange under the hood is the same web-identity federation from module 2: the pool validates the incoming token, resolves an identity ID (a stable pseudonymous identifier that can link multiple logins for one user), selects a role by its mapping rules, and calls AssumeRoleWithWebIdentity with the pool as the trusted OIDC context. The trust policies of the mapped roles condition on the identity pool ID (aud) and the authenticated/unauthenticated amr claim — read one once and the whole mechanism demystifies: Cognito is packaged STS federation with a user directory bolted on the front.</div>

<div class="callout limits">Numbers: access/ID tokens default 1 h (5 min-24 h); refresh 30 days default (1 h-10 years). User pools: regional, no native cross-region replication; directory scales to tens of millions of users. Pricing per MAU with a substantial free tier; advanced security costs extra per MAU. Identity pools: free; guest support; role mapping rules cap at 25 per pool. API rate limits on user-pool sign-in are per-category token buckets — burst login storms (mass push notification) can throttle authentication, a real capacity-planning item.</div>
`
    }
  ],
  quiz: [
    {
      q: "A company must share encrypted EBS snapshots with a partner AWS account. The snapshots are currently encrypted with the default aws/ebs key. What must the company do?",
      options: [
        "Modify the aws/ebs key policy to allow the partner account to decrypt",
        "Copy the snapshots re-encrypting with a customer-managed key whose key policy grants the partner account, then share the copies",
        "Share the snapshots directly, since snapshot sharing automatically grants key access",
        "Disable encryption on a copy of the snapshot and share it unencrypted"
      ],
      answer: [1],
      multi: false,
      explanation: "AWS-managed keys have fixed, uneditable policies and can never be used cross-account, so anything encrypted under aws/ebs cannot be shared. The pattern is: copy the snapshot with a CMK, grant the partner in the CMK's key policy (kms:Decrypt and related actions), then share the snapshot copy. <strong>A</strong> is impossible — aws/ebs key policies cannot be modified. <strong>C</strong> is false: snapshot sharing and key access are independent authorizations; the partner would see the snapshot but fail to use it. <strong>D</strong> technically transfers data but violates the obvious security intent and most compliance regimes — never the exam answer."
    },
    {
      q: "An application needs to encrypt 200 MB files using a KMS customer-managed key. Direct calls to kms:Encrypt fail. What is the correct approach?",
      options: [
        "Request a KMS quota increase for the payload size limit",
        "Call GenerateDataKey, encrypt the file locally with the returned plaintext key, store the encrypted data key with the ciphertext, and discard the plaintext key",
        "Split the file into 4 KB chunks and call kms:Encrypt on each",
        "Switch to an asymmetric KMS key, which supports larger payloads"
      ],
      answer: [1],
      multi: false,
      explanation: "The 4 KB Encrypt limit is a design constraint forcing envelope encryption: bulk data is encrypted locally under a data key, and only the small data key round-trips through KMS. <strong>A</strong> is not a quota — the limit is architectural and non-negotiable. <strong>C</strong> would work arithmetically but is absurd operationally (50,000 API calls per file, cost, latency) and is exactly the anti-pattern envelope encryption replaces. <strong>D</strong> is backwards: asymmetric keys have smaller effective payload limits than symmetric and cannot generate data keys."
    },
    {
      q: "A security team enables automatic rotation on a customer-managed symmetric KMS key used by dozens of applications. What happens to existing ciphertexts and application configuration after rotation?",
      options: [
        "All existing ciphertexts must be re-encrypted within 30 days or become unreadable",
        "Nothing changes for applications: the key ID stays the same, old backing key versions are retained to decrypt old ciphertexts, and new encryptions use the new material",
        "Applications must update to a new key ARN distributed via the key alias",
        "Rotation invalidates all grants on the key, which must be recreated"
      ],
      answer: [1],
      multi: false,
      explanation: "KMS rotation swaps the backing material while preserving the key ID and retaining every prior backing key indefinitely — decryption transparently selects the right version, and no data is re-encrypted. <strong>A</strong> describes a scheme KMS deliberately avoids; nothing ever becomes unreadable from rotation. <strong>C</strong> is wrong because the ARN and key ID do not change — alias re-pointing is the manual-rotation pattern for imported/asymmetric keys. <strong>D</strong> is fiction; grants survive rotation untouched."
    },
    {
      q: "A regulated firm requires that cryptographic keys be stored in single-tenant FIPS 140-2 Level 3 hardware to which AWS operators can have no access, while applications use standard PKCS#11 interfaces. Which solution meets this?",
      options: [
        "KMS customer-managed keys with imported key material",
        "AWS CloudHSM cluster spanning two availability zones",
        "KMS multi-Region keys with a restrictive key policy",
        "Secrets Manager with a customer-managed KMS key"
      ],
      answer: [1],
      multi: false,
      explanation: "Single-tenant, Level 3, no-AWS-access, PKCS#11 is the CloudHSM signature — a dedicated cluster in your VPC where only you hold the crypto users. <strong>A</strong> gives provenance control but the material still operates inside AWS's multi-tenant HSM fleet under AWS operation. <strong>C</strong> changes nothing about tenancy; MRKs are still KMS. <strong>D</strong> is a category error — Secrets Manager stores secrets, it is not an HSM and offers no PKCS#11."
    },
    {
      q: "An administrator must ensure data encrypted under a customer-managed key becomes unrecoverable, but discovers ScheduleKeyDeletion enforces a waiting period. The security policy demands access be cut off immediately while preserving the option to restore within a week. What should they do?",
      options: [
        "Schedule deletion with the minimum 7-day window; the key is unusable during the waiting period and recoverable until it elapses",
        "Delete the key alias, which immediately blocks all use",
        "Set the waiting period to zero using the force flag",
        "Remove the key from CloudTrail logging so it cannot be used"
      ],
      answer: [0],
      multi: false,
      explanation: "During the deletion waiting period the key is unusable for all cryptographic operations, and CancelKeyDeletion restores it — scheduling with the 7-day minimum satisfies both the immediate-cutoff and one-week-restore requirements. (Disabling the key achieves the cutoff too, but does not progress toward deletion.) <strong>B</strong> is cosmetic: aliases are pointers; callers using the key ID or existing grants proceed unaffected. <strong>C</strong> does not exist — the 7-day floor is not overridable (only imported key material can be deleted instantly). <strong>D</strong> confuses audit with authorization; CloudTrail visibility has nothing to do with usability."
    },
    {
      q: "A microservices platform stores about 400 configuration values (endpoints, feature flags, tuning parameters) and 6 RDS database credentials that compliance requires rotating every 30 days without custom code. What is the MOST cost-effective compliant design?",
      options: [
        "Store everything in Secrets Manager for consistency",
        "Store configuration in SSM Parameter Store standard tier and the database credentials in Secrets Manager with managed rotation",
        "Store everything in Parameter Store advanced tier with a custom rotation Lambda",
        "Store credentials in DynamoDB encrypted with KMS and configuration in Parameter Store"
      ],
      answer: [1],
      multi: false,
      explanation: "The canonical split: Parameter Store standard tier is free and ideal for config; Secrets Manager provides zero-code managed rotation for RDS credentials at 0.40 USD each — six secrets, pennies, requirement met. <strong>A</strong> works but pays 0.40 USD per month for each of 400 values that need no rotation — the exact waste the question probes. <strong>C</strong> fails the no-custom-code requirement (Parameter Store has no native rotation) and adds Lambda maintenance. <strong>D</strong> reinvents a secrets store on DynamoDB with no rotation, no audit semantics, and more code — worst on both cost-of-ownership and compliance."
    },
    {
      q: "Account A must read a database secret owned by account B in Secrets Manager. A resource policy on the secret grants account A's role, and the role's identity policy allows secretsmanager:GetSecretValue on the secret's ARN, yet decryption fails with a KMS AccessDenied error. What is the missing piece?",
      options: [
        "The secret must be replicated into account A's region first",
        "The secret is encrypted with the default aws/secretsmanager key, which cannot be granted cross-account; it must be re-encrypted with a customer-managed key whose key policy grants account A kms:Decrypt",
        "Account A must also enable Secrets Manager in its own account",
        "Cross-account secret access requires AWS RAM resource shares"
      ],
      answer: [1],
      multi: false,
      explanation: "Cross-account secret retrieval needs three allows: the secret's resource policy, the caller's identity policy, and the KMS key policy of the encrypting key — and the default aws/secretsmanager key's policy is fixed and never grants foreign accounts. The KMS-flavored error is the tell. <strong>A</strong> confuses region with account; cross-region calls to the secret's home region work fine. <strong>C</strong> is not a real prerequisite — there is no per-account enablement gate. <strong>D</strong> is wrong: Secrets Manager cross-account sharing runs on resource policies, not RAM."
    },
    {
      q: "A team runs their website through a CloudFront distribution with an ALB origin in eu-west-1. They requested an ACM certificate in eu-west-1 but cannot select it when configuring the distribution's custom domain. Why, and what should they do?",
      options: [
        "The certificate must complete email validation before appearing; wait for approval",
        "CloudFront only uses ACM certificates from us-east-1; request the same certificate there and attach it, keeping the eu-west-1 certificate for the ALB listener",
        "CloudFront requires imported third-party certificates, not ACM-issued ones",
        "The certificate must be exported from eu-west-1 and imported into CloudFront"
      ],
      answer: [1],
      multi: false,
      explanation: "ACM certificates are regional and CloudFront, as a global service configured in us-east-1, only lists certificates from us-east-1 — the single most-tested ACM fact. The eu-west-1 cert remains correct for the ALB's own TLS listener; the distribution needs its own us-east-1 copy (free, and the same DNS validation CNAME validates both). <strong>A</strong> misdiagnoses — a pending cert would show as pending, and validation state does not cause region invisibility. <strong>C</strong> is backwards; ACM is the preferred CloudFront cert source. <strong>D</strong> is impossible: ACM public certificates are never exportable."
    },
    {
      q: "An operations team wants TLS certificates for their public API that renew with zero manual effort indefinitely. Which combination guarantees this?",
      options: [
        "ACM certificate with email validation attached to an ALB",
        "ACM certificate with DNS validation, keeping the validation CNAME permanently in Route 53, attached to the ALB",
        "An imported commercial certificate in ACM with a calendar reminder",
        "A self-signed certificate rotated by a cron job on the instances"
      ],
      answer: [1],
      multi: false,
      explanation: "DNS-validated ACM certificates renew automatically for as long as the validation CNAME resolves — publish it once, never touch it again. <strong>A</strong> renews only if a human clicks the validation email each cycle — recurring manual effort, the exact thing excluded. <strong>C</strong> is explicitly not renewed by ACM; imported certs are your renewal problem, and calendar reminders are the outage generator ACM exists to kill. <strong>D</strong> fails public-trust requirements for a public API (client warnings) regardless of its automation."
    },
    {
      q: "A public web application behind an ALB suffers credential-stuffing attacks: bursts of thousands of login POSTs per minute from rotating small sets of IP addresses. SQL injection attempts also appear in logs. Which service and configuration addresses BOTH with the least custom development?",
      options: [
        "AWS Shield Advanced on the ALB",
        "AWS WAF on the ALB with a rate-based rule for the login path plus AWS managed rule groups for SQL injection",
        "AWS Network Firewall between the internet gateway and the ALB subnets",
        "Security groups limiting source IPs plus NACL deny rules"
      ],
      answer: [1],
      multi: false,
      explanation: "Both threats are L7 request-content problems, which is WAF's layer: a rate-based rule throttles per-IP request floods on the login route, and the managed SQLi rule set handles injection signatures with no rules to write. <strong>A</strong> targets DDoS economics and volumetric events — Shield does not inspect request content for SQLi or do per-path rate limiting. <strong>C</strong> filters network flows and domains but is the wrong attachment model for HTTP-path logic in front of an ALB. <strong>D</strong> cannot work: the attacking IPs rotate and are otherwise legitimate-looking clients, security groups have no rate or content awareness, and NACL rule counts cap quickly."
    },
    {
      q: "A CFO is concerned that a large DDoS attack against the company's CloudFront-fronted application would cause a massive bill from attack-driven scaling, and the security team wants direct access to AWS DDoS experts during incidents. Which service provides BOTH?",
      options: [
        "AWS Shield Standard, which is automatically enabled",
        "AWS Shield Advanced, which includes cost-protection refunds for attack-driven scaling charges and 24/7 access to the Shield Response Team",
        "AWS WAF with rate-based rules and AWS Support Business tier",
        "AWS Firewall Manager with a DDoS policy"
      ],
      answer: [1],
      multi: false,
      explanation: "The two discriminators named — attack-cost financial protection and expert engagement — are precisely Shield Advanced's paid additions (3,000 USD/month, 12-month commitment). <strong>A</strong> mitigates common L3/4 attacks but offers no cost protection and no response team. <strong>C</strong> approximates some mitigation and some human support, but Business support is not the DDoS-specialist SRT and WAF provides no billing guarantee. <strong>D</strong> is a policy-deployment layer; it can roll out Shield Advanced protections org-wide but is not itself the source of either benefit — and without Advanced underneath provides neither."
    },
    {
      q: "An organization mandates that every ALB in every current and future member account must have a baseline WAF web ACL, applied automatically without per-account action. Which service enforces this?",
      options: [
        "AWS Config with an SNS notification to account owners",
        "AWS Firewall Manager with a WAF policy applied across the organization",
        "A CloudFormation StackSet deploying web ACLs to existing accounts",
        "Service control policies denying ALB creation without WAF"
      ],
      answer: [1],
      multi: false,
      explanation: "Continuous, organization-wide, auto-remediating enforcement over current AND future resources and accounts is Firewall Manager's exact job — it discovers new ALBs and accounts and attaches the mandated web ACL automatically. <strong>A</strong> detects and notifies; humans still act, so future resources drift. <strong>C</strong> deploys the ACLs but does not associate them with ALBs created later, and onboarding new accounts is manual. <strong>D</strong> fails mechanically: no SCP condition can express 'has a WAF association,' since association happens after creation — SCPs gate API calls, not resource end-state."
    },
    {
      q: "Match the requirement to the service: a company must (1) detect cryptocurrency-mining activity from compromised EC2 instances, (2) find unpatched CVEs in ECR container images, and (3) locate unencrypted PII stored in S3. Which set is correct?",
      options: [
        "1: Inspector, 2: Macie, 3: GuardDuty",
        "1: GuardDuty, 2: Inspector, 3: Macie",
        "1: Security Hub, 2: GuardDuty, 3: Inspector",
        "1: GuardDuty, 2: Macie, 3: Inspector",
        "1: Detective, 2: Inspector, 3: Security Hub"
      ],
      answer: [1],
      multi: false,
      explanation: "Verbs map to services: active malicious behavior (cryptomining DNS/network patterns) is GuardDuty threat detection; CVE scanning of ECR images is Inspector's vulnerability management; PII discovery in S3 content is Macie's only job. <strong>A</strong> and <strong>D</strong> scramble the categories — Inspector never watches behavior, Macie never scans images. <strong>C</strong> puts aggregation (Security Hub) and detection in the wrong seats — Security Hub generates posture checks, not threat findings. <strong>E</strong> misuses Detective, which investigates findings after detection rather than producing them."
    },
    {
      q: "After GuardDuty reports that an EC2 instance's role credentials were used from an IP address outside AWS, the security team must determine everything that credential accessed over the preceding six months and how the activity evolved. Which service is purpose-built for this investigation?",
      options: [
        "Amazon Detective, which maintains a behavior graph of CloudTrail, VPC Flow Logs, and GuardDuty findings with about a year of history",
        "AWS CloudTrail Insights",
        "Amazon Inspector's forensic scanning mode",
        "AWS Security Hub's finding aggregation"
      ],
      answer: [0],
      multi: false,
      explanation: "Scope-and-timeline investigation across entities and months is Detective's design center: pivot from the finding to the role, its API history, associated IPs, and behavioral baselines without hand-writing log queries. <strong>B</strong> flags anomalous CloudTrail management-event volumes — a detector, not an investigation workbench, and it answers nothing about scope. <strong>C</strong> does not exist; Inspector scans for vulnerabilities, not forensics. <strong>D</strong> aggregates and normalizes findings but holds no deep event history to interrogate relationships over time."
    },
    {
      q: "A mobile application requires: social sign-in with Google normalized into one user directory, MFA for high-risk logins, and the ability for authenticated users to upload files directly to an S3 prefix restricted to each user. Which architecture is correct?",
      options: [
        "A Cognito identity pool alone, with Google as a login provider",
        "A Cognito user pool (with Google federation and adaptive MFA) feeding a Cognito identity pool that issues temporary AWS credentials mapped to a role scoped per-identity to the S3 prefix",
        "A Cognito user pool alone, with the app calling S3 using the user pool's access token",
        "IAM Identity Center with Google as the identity source and S3 permission sets"
      ],
      answer: [1],
      multi: false,
      explanation: "Both halves are needed: the user pool supplies the directory, Google federation, and adaptive MFA; the identity pool exchanges the user-pool JWT for temporary AWS credentials whose role uses the identity-ID policy variable to fence each user's prefix. <strong>A</strong> loses the directory and MFA — identity pools broker credentials but hold no users and run no authentication features. <strong>C</strong> fails at the S3 boundary: user-pool JWTs are OIDC tokens, not SigV4 credentials, and S3 cannot accept them. <strong>D</strong> misassigns the population — Identity Center is workforce access to AWS accounts, not consumer app identity."
    }
  ],
  flashcards: [
    { front: "AWS-owned vs AWS-managed vs customer-managed KMS keys", back: "AWS-owned: invisible, shared fleet, free. AWS-managed (aws/service): visible, fixed uneditable policy, yearly forced rotation, <strong>never cross-account</strong>, free storage. Customer-managed: your policy, optional rotation, cross-account capable, deletable, 1 USD/month. Need key-policy control = CMK." },
    { front: "Why can't an encrypted snapshot using aws/ebs be shared cross-account?", back: "AWS-managed key policies are fixed and can never name a foreign principal. Fix: copy the snapshot re-encrypting with a customer-managed key, grant the target account in the CMK key policy, share the copy." },
    { front: "Envelope encryption in four steps", back: "1) GenerateDataKey returns a plaintext data key + the same key encrypted under the CMK. 2) Encrypt data locally (AES-GCM), discard plaintext key. 3) Store encrypted data key beside the ciphertext. 4) Decrypt: send encrypted data key to kms:Decrypt, decrypt locally, discard. KMS never sees your data." },
    { front: "KMS Encrypt API payload limit and its consequence", back: "4 KB per direct Encrypt/Decrypt call. Anything larger requires envelope encryption via GenerateDataKey — the limit exists to force that architecture." },
    { front: "What is a KMS encryption context?", back: "Optional key-value pairs cryptographically bound to the ciphertext (AAD): the identical context must be supplied at decrypt. Binds ciphertext to resources (EBS passes volume ID), defeats ciphertext swapping, and appears in CloudTrail for per-resource audit." },
    { front: "KMS key policy vs IAM policy — the special rule", back: "The key policy is the root of trust: IAM identity policies grant nothing on a key unless the key policy delegates to IAM (the default statement allowing the account root ARN). Removing that statement can orphan the key — recovery via AWS Support." },
    { front: "KMS grants — what and when", back: "API-created, revocable permission entries on a key for a grantee principal and operation list — how AWS services acquire temporary key access (EBS decrypting a volume key at attach). Allow-only, no policy editing, brief eventual consistency bridged by the grant token." },
    { front: "What does KMS automatic rotation actually change?", back: "Adds a new backing key yearly; all old backing keys are retained; key ID/ARN never change; nothing is re-encrypted; decryption transparently picks the right version. Not supported for asymmetric or imported-material keys — rotate those by creating a new key and re-pointing the alias." },
    { front: "KMS multi-Region keys", back: "Primary + replicas sharing the same key material and key ID (ARN differs by region): encrypt in one region, decrypt locally in another. Each replica has its own key policy and regional independence. Not a global key; replicate only with a reason — regional isolation is a feature." },
    { front: "KMS deletion waiting period; the instant alternatives", back: "ScheduleKeyDeletion: 7-30 days (default 30), key unusable but recoverable via CancelKeyDeletion. Instant options: disable the key (reversible) or delete <em>imported</em> key material (no waiting period; re-import possible only if you kept a copy)." },
    { front: "CloudHSM vs KMS in one line each", back: "KMS: multi-tenant managed HSM fleet, IAM + CloudTrail integration, 1 USD/key/month. CloudHSM: single-tenant FIPS 140-2 Level 3 cluster in your VPC, PKCS#11/JCE, AWS has zero key access, you run users/backups/HA, thousands per month. Keywords for CloudHSM: dedicated, single-tenant, Level 3, Oracle TDE, custom key store." },
    { front: "Secrets Manager vs Parameter Store — the decision rule", back: "Rotation needed, DB credential, or cross-account sharing: Secrets Manager (0.40 USD/secret/month, native RDS rotation, resource policies, cross-region replication, 64 KB). Everything else: Parameter Store standard tier — free, 4 KB, hierarchy, SecureString via KMS, no native rotation." },
    { front: "Secrets Manager alternating-users rotation — why?", back: "Two DB users flip on each rotation, so the previous credential stays valid through the transition: zero-downtime rotation. Single-user strategy has a window where cached connections hold a dead password. Clients must re-fetch on auth failure, not cache forever." },
    { front: "Three policies needed for cross-account secret access", back: "1) Resource policy on the secret granting the foreign principal. 2) The caller's identity policy. 3) The KMS key policy of the encrypting key — which forces a customer-managed key, since aws/secretsmanager can never grant cross-account." },
    { front: "ACM public certificates: cost, validity, renewal, export", back: "Free; 13-month validity; auto-renew only with DNS validation while the validation CNAME remains published (email validation needs a human every cycle); private keys are <strong>never exportable</strong> — attachable only to integrated services (ALB/NLB, CloudFront, API Gateway...), never plain EC2." },
    { front: "The CloudFront certificate region rule", back: "Certificates for CloudFront distributions must be requested/imported in <strong>us-east-1</strong>, regardless of origin or viewer location. Regional services (ALB, regional API Gateway) need the cert in their own region. Edge-optimized API Gateway domains follow the us-east-1 rule too." },
    { front: "When is ACM Private CA the answer?", back: "Internal PKI: mTLS between microservices, private domain names, device identity — and when certs must be exportable to EC2/on-prem. ~400 USD/month per CA, so never the answer to a cost-sensitive public-site question." },
    { front: "WAF attachment points — and the one it never attaches to", back: "CloudFront (us-east-1 scope), ALB, API Gateway REST, AppSync, Cognito user pools, App Runner. <strong>Never NLB</strong> (no HTTP termination) and never EC2 directly." },
    { front: "WAF rate-based rules", back: "Track request rate per source IP over a trailing window and block while the threshold (min 10; classically a few thousand per 5 min) is exceeded. The tool for credential stuffing, scraping, and blunt L7 floods. Deploy new rules in count mode first." },
    { front: "Shield Advanced's two exam discriminators over Standard", back: "1) 24/7 Shield Response Team access (with proactive engagement). 2) Cost-protection refunds for attack-driven scaling charges (plus bundled WAF on protected resources). 3,000 USD/month, 12-month commitment. Standard is free, automatic L3/4 protection for everyone." },
    { front: "Firewall Manager's trigger phrase", back: "Enforce security policy (WAF ACLs, Shield Advanced, SG baselines, Network Firewall, DNS Firewall) across ALL accounts and resources in an organization, including future accounts and future resources, automatically. Requires Organizations + Config + delegated admin." },
    { front: "Network Firewall vs security groups vs NACLs vs WAF", back: "Network Firewall: managed stateful VPC firewall (Suricata) — FQDN egress filtering, IPS, routed via route tables. SG: instance-level stateful allow-only. NACL: subnet-level stateless allow/deny. WAF: HTTP request inspection on L7 services. 'Filter outbound by domain' = Network Firewall." },
    { front: "GuardDuty / Inspector / Macie / Security Hub / Detective — one verb each", back: "GuardDuty: <em>detect</em> active threats (CloudTrail + Flow Logs + DNS). Inspector: <em>scan</em> for CVEs and network exposure (EC2/ECR/Lambda). Macie: <em>discover</em> sensitive data in S3. Security Hub: <em>aggregate</em> findings + score compliance standards. Detective: <em>investigate</em> scope and root cause on a ~1-year behavior graph." },
    { front: "Cognito user pool vs identity pool", back: "User pool: user directory + OIDC authentication (sign-up, MFA, social/SAML federation) issuing ID/access/refresh JWTs — which are NOT AWS credentials. Identity pool: exchanges tokens (or guest status) via STS for temporary AWS credentials mapped to IAM roles. Authenticate = user pool; access AWS services directly = identity pool." },
    { front: "Who handles workforce SSO vs app-user identity?", back: "Employees accessing AWS accounts: IAM Identity Center. Application customers: Cognito. Any answer giving app users IAM users, or employees Cognito accounts for console access, is a category error." }
  ],
  lab: {
    title: "Lab: envelope encryption by hand, then a rotating-ready secret",
    html: `
<h3>Goal</h3>
<p>Perform envelope encryption manually against a customer-managed KMS key — GenerateDataKey, local AES encryption, decrypt round-trip — then prove the 4 KB limit, watch an encryption context reject tampering, store a SecureString parameter and a Secrets Manager secret, and tear it all down including a scheduled key deletion. Cost: the CMK bills 1 USD/month prorated for the days it exists (a few cents), Secrets Manager 0.40 USD/month prorated after its free trial where applicable; everything else is free-tier API calls. About 40 minutes.</p>

<h3>Architecture</h3>
<p>One symmetric CMK with an alias, one 100 KB test file encrypted locally under a data key, one SecureString parameter and one secret both encrypted under the same CMK — so you can see the key's CloudTrail activity aggregate across services.</p>

<h3>Steps</h3>
<ol>
<li><p><strong>Create the key and alias.</strong></p>
<pre><code>KEY_ID=$(aws kms create-key --description "envelope-lab" \
  --query KeyMetadata.KeyId --output text)
aws kms create-alias --alias-name alias/envelope-lab --target-key-id $KEY_ID
aws kms describe-key --key-id alias/envelope-lab \
  --query 'KeyMetadata.[KeyId,KeySpec,KeyUsage,KeyState]' --output table</code></pre>
<p>Note KeySpec SYMMETRIC_DEFAULT and KeyUsage ENCRYPT_DECRYPT. Inspect the default key policy and find the root-delegation statement that makes IAM work for this key:</p>
<pre><code>aws kms get-key-policy --key-id $KEY_ID --policy-name default --output text</code></pre></li>

<li><p><strong>Prove the 4 KB direct-encrypt limit.</strong></p>
<pre><code>head -c 100000 /dev/urandom &gt; /tmp/big.bin
head -c 3000 /dev/urandom &gt; /tmp/small.bin
aws kms encrypt --key-id alias/envelope-lab \
  --plaintext fileb:///tmp/small.bin --query CiphertextBlob --output text &gt; /dev/null &amp;&amp; echo 'small: ok'
aws kms encrypt --key-id alias/envelope-lab \
  --plaintext fileb:///tmp/big.bin 2&gt;&amp;1 | tail -1</code></pre>
<p>The 100 KB file fails with a validation error — the limit forcing envelope encryption.</p></li>

<li><p><strong>Generate a data key with an encryption context and encrypt locally.</strong></p>
<pre><code>aws kms generate-data-key --key-id alias/envelope-lab \
  --key-spec AES_256 \
  --encryption-context purpose=lab,owner=me &gt; /tmp/dk.json
python3 -c "import json,base64; d=json.load(open('/tmp/dk.json')); open('/tmp/dk.plain','wb').write(base64.b64decode(d['Plaintext'])); open('/tmp/dk.encrypted','wb').write(base64.b64decode(d['CiphertextBlob']))"
openssl enc -aes-256-cbc -pbkdf2 -in /tmp/big.bin -out /tmp/big.enc \
  -pass file:/tmp/dk.plain
shred -u /tmp/dk.plain
echo 'plaintext data key destroyed; only the KMS-wrapped copy remains'</code></pre>
<p>You now hold exactly what S3 holds per object: locally-encrypted data plus a KMS-wrapped data key.</p></li>

<li><p><strong>Decrypt the round trip — and watch the context enforce integrity.</strong> First, the wrong context:</p>
<pre><code>aws kms decrypt --ciphertext-blob fileb:///tmp/dk.encrypted \
  --encryption-context purpose=production 2&gt;&amp;1 | tail -1</code></pre>
<p>InvalidCiphertextException — the context is bound into the ciphertext. Now correctly:</p>
<pre><code>aws kms decrypt --ciphertext-blob fileb:///tmp/dk.encrypted \
  --encryption-context purpose=lab,owner=me \
  --query Plaintext --output text | base64 -d &gt; /tmp/dk.plain
openssl enc -d -aes-256-cbc -pbkdf2 -in /tmp/big.enc -out /tmp/big.dec \
  -pass file:/tmp/dk.plain
cmp /tmp/big.bin /tmp/big.dec &amp;&amp; echo 'round trip verified'
shred -u /tmp/dk.plain</code></pre></li>

<li><p><strong>Store a SecureString parameter and a secret under the same CMK.</strong></p>
<pre><code>aws ssm put-parameter --name /lab/db/host --type String --value db.internal.example
aws ssm put-parameter --name /lab/db/password --type SecureString \
  --key-id alias/envelope-lab --value 'n0t-a-real-p4ss'
aws ssm get-parameter --name /lab/db/password --with-decryption \
  --query Parameter.Value --output text

aws secretsmanager create-secret --name lab/db-credentials \
  --kms-key-id alias/envelope-lab \
  --secret-string '{"username":"app","password":"n0t-a-real-p4ss"}'
aws secretsmanager get-secret-value --secret-id lab/db-credentials \
  --query SecretString --output text</code></pre>
<p>Note the shape difference: the parameter is one value in a path hierarchy; the secret is a JSON document with versioning stages (run <code>aws secretsmanager describe-secret --secret-id lab/db-credentials</code> and find VersionIdsToStages — AWSCURRENT is what rotation promotes).</p></li>

<li><p><strong>Optional: see the audit trail.</strong> After a few minutes, look for your kms:Decrypt events with their encryption context:</p>
<pre><code>aws cloudtrail lookup-events --lookup-attributes \
  AttributeKey=EventName,AttributeValue=Decrypt \
  --max-results 5 --query 'Events[].CloudTrailEvent' --output text | head -50</code></pre></li>
</ol>

<h3>Verify</h3>
<ul>
<li>Direct Encrypt failed at 100 KB; envelope round trip reproduced the original file (cmp silent).</li>
<li>Decrypt with the wrong encryption context threw InvalidCiphertextException.</li>
<li>Parameter and secret both decrypt via their APIs; the secret shows AWSCURRENT staging.</li>
</ul>

<h3>Teardown</h3>
<p>Ordered so nothing lingers or bills. The key cannot be deleted instantly — schedule it with the minimum window and confirm its state; the secret also uses a recovery window unless forced.</p>
<ol>
<li><p>Secrets and parameters first (the secret supports a forced immediate delete for lab hygiene):</p>
<pre><code>aws secretsmanager delete-secret --secret-id lab/db-credentials \
  --force-delete-without-recovery
aws ssm delete-parameter --name /lab/db/host
aws ssm delete-parameter --name /lab/db/password</code></pre></li>
<li><p>Alias, then schedule key deletion with the 7-day minimum:</p>
<pre><code>aws kms delete-alias --alias-name alias/envelope-lab
aws kms schedule-key-deletion --key-id $KEY_ID --pending-window-in-days 7
aws kms describe-key --key-id $KEY_ID \
  --query 'KeyMetadata.[KeyState,DeletionDate]' --output table</code></pre>
<p>KeyState is PendingDeletion: the key is unusable now, recoverable via cancel-key-deletion for 7 days, gone after. It bills nothing while pending deletion.</p></li>
<li><p>Local artifacts:</p>
<pre><code>rm -f /tmp/big.bin /tmp/big.enc /tmp/big.dec /tmp/small.bin /tmp/dk.json /tmp/dk.encrypted</code></pre></li>
</ol>
`
  }
});
