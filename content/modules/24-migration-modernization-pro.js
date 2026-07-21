window.COURSE.register({
  id: "migration-pro",
  order: 24,
  track: "sap",
  title: "Large-Scale Migration & Modernization (Pro)",
  description: "Org-scale migration: building the business case, landing-zone prerequisites, migration factories with MGN and DMS, licensing exit economics, mainframe paths, modernization sequencing, hybrid placement, and PB-scale data movement. Pitched at SAP-C02 depth.",
  examWeight: "Accelerate Workload Migration and Modernization is a full SAP-C02 domain (~20% of the exam). Expect multi-constraint scenarios: thousands of servers, license deadlines, datacenter exits, and compliance boundaries.",
  lessons: [
    {
      id: "portfolio-business-case",
      title: "Portfolio assessment and the business case",
      html: `
<p>Enterprise migrations fail in the first ninety days, before a single packet moves — they fail when the CFO asks "what does this cost and what do we get" and the answer is a spreadsheet someone built from a CMDB that was last accurate in 2019. The Professional exam tests whether you know AWS's opinionated sequence: <strong>assess, mobilize, migrate</strong> — and which tool produces which artifact at each stage.</p>

<h3>Discovery: you cannot prioritize what you cannot see</h3>
<p>Two collection modes, and the exam distinguishes them sharply:</p>
<ul>
<li><strong>Application Discovery Service (ADS) agentless collector</strong> — an OVA deployed into vCenter. It reads VM inventory, CPU/RAM/disk utilization, and network throughput from the hypervisor. No credentials on guests, no per-server install. It cannot see inside the OS: no process lists, no TCP connection maps.</li>
<li><strong>ADS agent</strong> — installed per server (Windows/Linux, physical or virtual). Adds running processes and network connections, which is what you need to build a <em>dependency map</em> — the thing that decides wave composition.</li>
</ul>
<p>Both feed <strong>Migration Hub</strong>, which is the aggregation plane: you pick a <em>home region</em>, and discovery data plus migration status from MGN and DMS roll up there regardless of where workloads land.</p>

<div class="callout exam">Keyword mapping: "cannot install software on servers" or "security team forbids agents" → agentless collector. "Need to map dependencies between applications before planning waves" → ADS agent (or Migration Hub network visualization fed by agent data). "Single view of migration progress across tools and regions" → Migration Hub with a home region.</div>

<h3>Migration Evaluator: the directional business case</h3>
<p><strong>Migration Evaluator</strong> (the former TSO Logic) exists for one purpose: produce a defensible TCO comparison <em>before</em> anyone commits budget. It ingests utilization data (its own agentless collector, ADS exports, or third-party CMDB/monitoring exports), then models right-sized AWS targets — including Windows and SQL Server licensing permutations (BYOL vs license-included, dedicated hosts where required) — and outputs a business case with projected run-rate. The critical nuance: it right-sizes on <em>observed utilization</em>, not provisioned capacity. On-prem estates are typically 10–20% utilized; a like-for-like sizing doubles or triples the honest number, and the exam's wrong answers often embed that mistake.</p>

<div class="callout war">TCO framing that survives finance review includes what on-prem numbers hide: datacenter real estate and power, hardware refresh cycles you now avoid, license true-up exposure, and the people cost of undifferentiated ops. It also includes what AWS adds: egress, inter-AZ traffic, and the migration bubble — the months you pay for both environments. A business case that omits the double-running bubble gets shredded in the first steering committee.</div>

<h3>Migration Readiness Assessment</h3>
<p>The <strong>MRA</strong> is a structured workshop scored against the Cloud Adoption Framework's six perspectives (business, people, governance, platform, security, operations). Its output is not a number — it is a gap list: no landing zone, no cloud operating model, no tagging standard, no trained operators. On the exam, when an organization "wants to migrate 2,000 servers but has no cloud experience," the first step is an MRA and a mobilize phase, not picking a replication tool.</p>

<h3>The 7 Rs and application prioritization</h3>
<p>Every portfolio application gets a disposition:</p>
<table>
<thead><tr><th>R</th><th>What it means</th><th>When</th></tr></thead>
<tbody>
<tr><td>Retire</td><td>Turn it off</td><td>10–20% of most estates; find these first — cheapest migration is none</td></tr>
<tr><td>Retain</td><td>Leave it (for now)</td><td>Decommission scheduled, latency/compliance pins it, or appliance you cannot move</td></tr>
<tr><td>Rehost</td><td>Lift-and-shift (MGN)</td><td>Speed matters: datacenter exit, lease expiry</td></tr>
<tr><td>Relocate</td><td>VMware/HCX or account-to-account moves without OS-level change</td><td>vSphere estates moving wholesale</td></tr>
<tr><td>Repurchase</td><td>Drop it for SaaS</td><td>CRM, HR, email — commodity capability</td></tr>
<tr><td>Replatform</td><td>Lift-tinker-shift: swap self-managed DB for RDS, app to containers, no code redesign</td><td>Cheap wins in ops burden</td></tr>
<tr><td>Refactor</td><td>Re-architect for cloud-native</td><td>Highest cost, highest payoff — reserve for apps where business value justifies it</td></tr>
</tbody>
</table>

<h3>Wave construction: quick wins vs complex</h3>
<p>Waves are sequenced on two axes: <strong>business criticality</strong> and <strong>technical complexity</strong> (dependency count, data gravity, compliance load). The canonical sequencing:</p>
<ol>
<li><strong>Wave 0 / pilot:</strong> low-risk, low-dependency, non-critical apps — dev/test tools, internal wikis. The goal is not the apps; it is exercising the factory: runbooks, cutover process, rollback drill, team confidence.</li>
<li><strong>Early waves:</strong> quick wins — self-contained apps with modest data, standardized OS builds. These build velocity metrics leadership can see.</li>
<li><strong>Middle waves:</strong> clustered dependency groups. Apps that share a database or chatty east-west traffic move <em>together</em>; splitting a tight dependency group across a wave boundary puts a WAN hop in the middle of a synchronous call path.</li>
<li><strong>Late waves:</strong> the complex core — ERP, mainframe adjacencies, anything with regulatory sign-off cycles. By now the factory has throughput and scar tissue.</li>
</ol>

<div class="callout exam">Trap pattern: an answer that migrates the most business-critical application first "to prove value." Professional-level answers pilot on low-risk apps, keep dependency groups intact within a wave, and schedule complex/critical apps late. Another trap: skipping the retire/retain sweep — any plan that rehosts 100% of a discovered estate is leaving free money on the table.</div>

<div class="callout limits">Numbers worth holding: ADS agentless needs vCenter (it is VMware-only); Migration Hub home region is set once per account/org and all tracking data lives there; Migration Evaluator wants at least 2 weeks (ideally 4+) of utilization data to right-size honestly — a snapshot of provisioned specs is not a sizing basis.</div>

<p>The output of this phase, and the entry criteria for everything that follows: a rationalized portfolio with a disposition per app, a dependency-informed wave plan, a directional TCO the CFO has signed, and an MRA gap list that becomes the mobilize-phase backlog. The single biggest item on that backlog is almost always the landing zone — next lesson.</p>
`
    },
    {
      id: "landing-zone-readiness",
      title: "Landing-zone readiness as a migration prerequisite",
      html: `
<p>The most expensive migration mistake is moving fast into an account structure you will spend the next three years unwinding. The Professional exam encodes this as a rule: <strong>the landing zone is a prerequisite, not a parallel workstream you finish later</strong>. If a scenario says "the company wants to begin migrating immediately" and one option says "establish a multi-account landing zone with centralized networking and guardrails first," that option is nearly always in the correct answer.</p>

<h3>What "ready" means, concretely</h3>
<p>A migration-ready landing zone has five things in place before wave 1:</p>
<ol>
<li><strong>Account structure.</strong> AWS Organizations with an OU design that separates security, infrastructure (shared network), sandbox, and workload OUs — commonly split further into prod and non-prod. Accounts are the blast-radius boundary AWS actually enforces; VPCs and IAM boundaries inside one account are softer. <strong>Control Tower</strong> is the managed way to get this: it provisions the org, a log-archive account, an audit account, baseline detective/preventive controls, and Account Factory so new workload accounts arrive pre-baselined instead of hand-built.</li>
<li><strong>Identity.</strong> IAM Identity Center federated to the existing IdP (Entra ID, Okta, on-prem AD via AD Connector). Migrating teams get permission sets, not IAM users. If the estate is Windows-heavy, extend or trust AD early — domain-joined EC2 instances and RDS for SQL Server with Windows auth both need directory reachability on day one of cutover, not week six.</li>
<li><strong>Network.</strong> Hybrid connectivity sized for replication <em>plus</em> steady-state: Direct Connect (with VPN backup, or a second DX for real SLAs), a Transit Gateway hub, an IP address plan (IPAM) that does not collide with on-prem ranges, and centralized DNS — Route 53 Resolver inbound/outbound endpoints with forwarding rules so migrated servers resolve on-prem names and vice versa. DNS is the classic day-one cutover failure.</li>
<li><strong>Security baseline.</strong> Org-wide CloudTrail, GuardDuty and Security Hub with delegated admin, a break-glass process, and an initial SCP set (deny root access keys, deny leaving the org, region restrictions). Guardrails must exist <em>before</em> workloads arrive; retrofitting SCPs onto running production is a change-management project of its own.</li>
<li><strong>Operations.</strong> Tagging standard enforced at provisioning time (tag policies + IaC), centralized logging destinations, patching via SSM, backup policies via AWS Backup org policies, and cost visibility (CUR configured, cost allocation tags activated). If tags are not mandatory in wave 1, they will never be complete.</li>
</ol>

<h3>Why sequencing matters: the rework tax</h3>
<p>Skipping the landing zone shows up later as: workloads piled into one account hitting service quotas and IAM policy-size walls; overlapping CIDRs that force NAT contortions when you finally build the TGW; logs scattered across accounts with no org trail during the first security incident; and a re-migration project to move workloads into a proper account structure — which is a full migration's worth of cutover risk, paid twice.</p>

<div class="callout war">Sizing the pipe is a real gotcha. MGN block-level replication for a wave of a few hundred servers can saturate a 1 Gbps DX and starve production traffic sharing the link. Factories throttle replication bandwidth per server, schedule initial syncs off-hours, or land a dedicated DX/VPN for replication. Discover this in wave 0, not wave 4.</div>

<h3>Control Tower vs bespoke</h3>
<table>
<thead><tr><th></th><th>Control Tower</th><th>Bespoke (Organizations + IaC)</th></tr></thead>
<tbody>
<tr><td>Speed to baseline</td><td>Days</td><td>Weeks–months</td></tr>
<tr><td>Opinionation</td><td>High — fixed core accounts, managed controls</td><td>Whatever you build</td></tr>
<tr><td>Customization</td><td>Account Factory Customizations, CfCT hooks</td><td>Unlimited, but you own drift</td></tr>
<tr><td>Existing org adoption</td><td>Can enroll existing accounts/OUs with care</td><td>N/A</td></tr>
<tr><td>Exam signal</td><td>"Fastest way to establish a governed multi-account environment"</td><td>"Highly specific regulatory framework CT cannot express"</td></tr>
</tbody>
</table>
<p>On SAP-C02, Control Tower is the default answer for standing up a governed landing zone quickly; hand-rolled Organizations appears when the scenario stresses an existing sophisticated setup or requirements Control Tower cannot model.</p>

<div class="callout exam">Watch for the ordering question: "Which steps should be performed FIRST before migrating workloads?" Correct combinations pair landing zone / connectivity / identity. Distractors offer per-workload work (rightsizing instances, building AMIs, refactoring to containers) — real tasks, wrong phase. Also know Account Factory's role: "consistent, compliant new accounts for each application team" → Control Tower Account Factory, not a wiki page of manual steps.</div>

<div class="callout limits">Quotas that bite migrations: default VPCs per region per account (5), TGW attachments (5,000 per TGW, but 50 route tables default), DX 1/10/100 Gbps port choices with LAG up to 4 ports, Site-to-Site VPN ~1.25 Gbps per tunnel (ECMP across tunnels to scale). SCPs: 5 attached per level, 5,120-character limit each — design guardrail policies before you have 40 of them.</div>

<p>The mobilize phase ends when a pilot wave has landed in the new structure, cutover and rollback runbooks have been exercised for real, and the factory can state its throughput (servers per week) with evidence. That number — not optimism — is what the wave plan gets rebuilt around.</p>
`
    },
    {
      id: "migration-factory",
      title: "Migration factory: waves, MGN at scale, cutover and rollback",
      html: `
<p>A migration factory is an assembly line: standardized intake, replication, test, cutover, and validation stages, run by a dedicated team, measured in servers per week. The alternative — artisanal per-app migrations — does not survive contact with a 2,000-server estate and a datacenter lease that ends in 14 months. The exam expects you to know both the machinery (MGN, Migration Hub) and the process discipline (runbooks, rollback).</p>

<h3>MGN mechanics: what is actually happening</h3>
<p><strong>Application Migration Service (MGN)</strong> is the rehost engine. The mental model: a lightweight agent on each source server performs <strong>block-level, continuous, asynchronous replication</strong> of its volumes to a <em>staging area</em> in your target account — minimal EC2 instances (replication servers) fronting EBS volumes that mirror the source disks. Key properties:</p>
<ul>
<li>Replication is continuous CDC at the block layer — after initial sync, only changed blocks move, so the source stays live and lag is typically seconds to minutes.</li>
<li><strong>Test launches</strong> spin up an instance from the current replicated state without touching the source or interrupting replication. You can test repeatedly, tear down, and replication keeps running.</li>
<li><strong>Cutover launch</strong> is the same operation with intent: final sync, boot the target with the real launch template (right-sized instance type, target subnet/SGs), then decommission the source.</li>
<li>Launch conversion handles the boring-but-fatal parts: injecting AWS drivers, adjusting bootloaders, licensing (Windows), so the replica actually boots as an EC2 instance.</li>
<li>Pricing: free for 90 days per source server from agent install — an incentive to actually finish waves, and an exam-visible fact.</li>
</ul>

<div class="callout deep">The staging area is deliberately cheap: small shared replication servers and low-cost EBS. Compute is only paid at test/cutover launch. This is why MGN scales to waves economically where "keep a warm full-size copy of everything" would not. It is also why the first boot of a test instance can be slow — EBS volumes hydrate and the OS meets new virtual hardware.</div>

<h3>Running MGN at scale</h3>
<ul>
<li><strong>Wave = MGN "application"/"wave" groupings</strong> plus launch templates standardized per OS build. Do not hand-edit 300 launch templates; drive them from automation (the MGN API/CloudFormation) keyed off discovery data.</li>
<li><strong>Bandwidth management:</strong> initial sync for a wave is the bulk of traffic; throttle per-server replication and stagger agent installs so you do not flatten the DX.</li>
<li><strong>Quotas and sharding:</strong> concurrently replicating source servers per account is a soft limit in the low hundreds by default (raiseable) — factories shard waves across workload accounts anyway, which also matches the landing-zone account model.</li>
<li><strong>Tracking:</strong> Migration Hub aggregates per-server status (discovery through cutover) across MGN, DMS, and partner tools into the home region. Leadership dashboards come from here, not from fifteen spreadsheets.</li>
</ul>

<h3>Cutover runbooks: the part that is actually hard</h3>
<p>Replication is a solved problem; cutover is where migrations break. A factory-grade cutover runbook per application includes:</p>
<ol>
<li><strong>Entry criteria:</strong> successful test launch signed off by the app owner; replication lag below threshold; change-freeze window approved.</li>
<li><strong>Pre-cutover:</strong> drop DNS TTLs to 60s <em>days in advance</em> (TTL changes only help after the old TTL expires everywhere); quiesce writers or stop app services for a clean final sync where consistency demands it.</li>
<li><strong>Cutover:</strong> final sync, launch cutover instances, smoke tests from a checklist (auth works, DB connects, upstream/downstream integrations respond), flip DNS/load-balancer targets.</li>
<li><strong>Validation window:</strong> defined observation period with named owners watching dashboards, and an explicit <strong>go/no-go decision point</strong>.</li>
<li><strong>Rollback plan:</strong> the source servers are <em>not</em> decommissioned at cutover — they are stopped or fenced. Rollback = flip DNS back and restart the source. This only works if nothing wrote meaningful state exclusively to the new side; for stateful apps the runbook defines either a reverse-replication path or an acceptable data-loss statement someone senior signed. Decommission happens days later, as a separate, boring step.</li>
</ol>

<div class="callout war">The classic self-inflicted outage: cutover Friday night, decommission the source Saturday morning to "avoid double billing," discover a payroll integration failure Monday. With the source gone, rollback is a restore-from-backup event measured in days. Factories put a mandatory soak period (one business cycle — often a week, or month-end for finance apps) between cutover and decommission. Storage for a stopped server is pennies against that risk.</div>

<div class="callout exam">Keyword mapping: "migrate thousands of servers with minimal changes and minimal cutover downtime" → MGN (continuous block replication, test launches, short cutover). "Track status across accounts, regions, and tools in one place" → Migration Hub. "Ability to quickly revert if issues are found after cutover" → keep sources intact + low DNS TTL + defined rollback runbook; the trap options either decommission at cutover or hand-wave "restore from AMI backups" (slow, stale). VM Import/Export as an option for a large live estate is a distractor — it is offline, slow, and per-image; MGN replaced both it and SMS for rehosting.</div>

<div class="callout limits">Facts to memorize: MGN free window is 90 days per server; replication is block-level and asynchronous (crash-consistent, not application-consistent — quiesce databases for clean cutovers, or better, move databases with DMS or native replication instead of block-copying them); DNS TTL only takes effect after the previous TTL drains, so lower it well before cutover night.</div>

<p>A factory that has run three waves has something priceless: a measured cycle time per server class and a rollback drill that has actually been executed. When the steering committee asks whether the lease-end date is achievable, the answer is arithmetic, not hope.</p>
`
    },
    {
      id: "database-escape",
      title: "Heterogeneous database escapes at scale",
      html: `
<p>Databases carry the two heaviest chains in any portfolio: data gravity and commercial licensing. The Professional exam leans hard on the second — Oracle and SQL Server exit economics — because it is where architecture and money collide. The toolchain is SCT for the schema, DMS for the data, and licensing math for the business case.</p>

<h3>SCT: the assessment is the point</h3>
<p><strong>Schema Conversion Tool (SCT)</strong> does two jobs. The famous one is converting schema objects (tables, views, procedures, functions) from a source engine to a target engine, flagging what it cannot convert automatically. The exam-critical one is the <strong>assessment report</strong>: run it across the estate <em>before</em> committing to targets, and it tells you, per database, what percentage converts automatically and itemizes the manual work (proprietary PL/SQL constructs, engine-specific features) with effort estimates. That report is how you triage: a database that is 98% auto-convertible is a quick-win Aurora candidate; one full of Oracle-specific packages, RAC dependencies, or third-party app certification constraints goes to a later wave — or stays on Oracle via RDS/EC2 (replatform, not refactor).</p>

<h3>DMS: full load plus CDC</h3>
<p><strong>Database Migration Service</strong> runs on a replication instance (or DMS Serverless) executing tasks with three modes: full load, CDC only, or <strong>full load + CDC</strong> — the migration workhorse. Mechanics that matter:</p>
<ul>
<li>Full load copies tables in parallel while CDC captures ongoing changes from the source's transaction log (Oracle redo via LogMiner or Binary Reader, SQL Server transaction log, MySQL binlog, Postgres logical replication). Changes accumulated during full load are applied afterward, then the task tails the log continuously.</li>
<li>Cutover pattern: run full load + CDC until replication latency is near zero, stop application writes briefly, let CDC drain, repoint connection strings. Downtime is minutes, independent of database size.</li>
<li><strong>What DMS does not do:</strong> it migrates data, not the full engine surface. Secondary indexes, foreign keys, triggers, users, and procedures are SCT/native-tool territory; FKs and triggers are typically disabled on target during full load and enabled at cutover.</li>
<li><strong>Validation:</strong> DMS data validation compares source and target row-by-row and can run continuously during CDC — the audit-friendly answer to "prove nothing was lost."</li>
<li>LOB handling is the classic performance trap: full LOB mode is safe and slow; limited LOB mode is fast but truncates anything above the size cap. Know your max LOB size before choosing.</li>
</ul>

<div class="callout war">DMS CDC against Oracle is where war stories live: redo generation rate can outrun LogMiner, archived logs get purged before DMS reads them (RMAN retention must respect the replication lag), and supplemental logging must be enabled or updates arrive unusable. Budget a real test cycle with production-shaped write volume — a CDC pipeline that keeps up with a quiet dev database proves nothing.</div>

<h3>Licensing exit economics</h3>
<p>This is the business case underneath every "migrate off Oracle/SQL Server" scenario:</p>
<table>
<thead><tr><th>Option</th><th>Licensing</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>RDS Oracle SE2</td><td>License-included or BYOL</td><td>LI bundles the license into the hourly rate — the only way to pay Oracle by the hour</td></tr>
<tr><td>RDS Oracle EE</td><td>BYOL only</td><td>No LI for Enterprise Edition; you keep the Oracle relationship</td></tr>
<tr><td>RDS SQL Server</td><td>License-included only</td><td>BYOL SQL Server means EC2, and needs Software Assurance License Mobility for default tenancy</td></tr>
<tr><td>EC2 + BYOL</td><td>Your licenses</td><td>Oracle counts vCPUs (2 vCPUs = 1 processor license with hyperthreading, per their cloud policy); SQL Server per-core</td></tr>
<tr><td>Aurora / open-source RDS</td><td>None</td><td>The actual exit — license line item goes to zero</td></tr>
</tbody>
</table>
<p>Two levers the exam loves:</p>
<ul>
<li><strong>Optimize CPUs:</strong> on EC2 you can reduce active vCPU count and disable hyperthreading on a large-memory instance — buy the RAM the database needs without paying per-core license tax on cores it does not. Directly cuts Oracle/SQL Server license counts.</li>
<li><strong>Dedicated Hosts for BYOL:</strong> licenses bound to physical sockets/cores (Windows Server, SQL Server without Software Assurance, some Oracle agreements) require visibility and control of the physical host. Dedicated Hosts provide host affinity and socket/core counts, and <strong>License Manager</strong> tracks consumption and can hard-block launches that would exceed entitlements. Windows Server BYOL specifically requires Dedicated Hosts (or bare metal) — it is not eligible on default or even dedicated-instance tenancy.</li>
</ul>

<div class="callout exam">Decision rules: "eliminate database license costs, willing to modify application" → SCT + DMS to Aurora (PostgreSQL for Oracle sources, MySQL/PostgreSQL for SQL Server). "Minimize changes, reduce operational burden, keep engine" → RDS same-engine (replatform; homogeneous moves use native tooling or DMS without SCT). "Per-socket licenses without Software Assurance" or "Windows Server BYOL" → Dedicated Hosts + License Manager. "Near-zero downtime for a 5 TB cutover" → DMS full load + CDC, drain, repoint. Distractors: snapshot/restore or export/import for near-zero-downtime asks (downtime scales with size), and DMS alone converting schemas (it does not — SCT does).</div>

<div class="callout limits">Numbers: DMS replication instances scale to r-family sizes — the instance (CPU for parallel load, memory for CDC buffering) is a real bottleneck at scale; SCT assessment can run estate-wide in batch (multiserver assessment) to produce a portfolio-level report; Babelfish for Aurora PostgreSQL speaks the SQL Server wire protocol (TDS) to cut app-side rewrite for SQL Server exits — know it exists as the "reduce application changes" middle path.</div>

<p>Sequencing at portfolio scale mirrors app waves: run estate-wide SCT assessment early, exit the easy 98%-convertible databases first to bank license savings that fund the program, and leave the PL/SQL swamps for dedicated refactor teams — or accept RDS Oracle BYOL as a deliberate, priced retain-on-better-terms.</p>
`
    },
    {
      id: "mainframe-legacy",
      title: "Mainframe and legacy paths — including when retain wins",
      html: `
<p>Mainframes are the final boss of migration programs: decades of COBOL/PL-I, JCL batch chains, VSAM and Db2 data, 3270 screens, and a retirement wave carrying the tribal knowledge out the door. SAP-C02 does not expect z/OS expertise; it expects you to choose among <strong>replatform, refactor, augment, and retain</strong> with honest reasoning about risk, timeline, and team reality.</p>

<h3>AWS Mainframe Modernization: two engines, two philosophies</h3>
<p>The managed service offers two distinct runtimes, and the exam distinguishes them:</p>
<table>
<thead><tr><th></th><th>Replatform (Micro Focus / Rocket runtime)</th><th>Automated refactor (AWS Blu Age)</th></tr></thead>
<tbody>
<tr><td>What happens to code</td><td>COBOL/PL-I recompiled largely as-is; runs on a managed emulation-compatible runtime on AWS</td><td>Automated transformation of COBOL/JCL into Java (Angular for screens), running as modern services</td></tr>
<tr><td>Language after</td><td>Still COBOL — existing developers stay productive</td><td>Java — hireable skills, but the generated code becomes the codebase your team must own</td></tr>
<tr><td>Data</td><td>VSAM/files mapped to the runtime's stores; Db2 typically to a relational target</td><td>Data model converted to relational (Aurora/PostgreSQL commonly)</td></tr>
<tr><td>Risk profile</td><td>Lower per-step; business logic untouched</td><td>Higher transformation risk; heavy automated + human test burden</td></tr>
<tr><td>Timeline</td><td>Faster to first workload off the mainframe</td><td>Longer, but lands you off COBOL entirely</td></tr>
<tr><td>Exam keywords</td><td>"minimal code changes", "retain existing COBOL skills", "exit the mainframe quickly"</td><td>"eliminate COBOL", "no remaining mainframe skills", "cloud-native target state"</td></tr>
</tbody>
</table>
<p>Both run under a managed environment handling deploys, scaling, and monitoring — the point of the service versus hand-rolling an emulator on EC2.</p>

<h3>The paths that are not migration</h3>
<ul>
<li><strong>Augment / data liberation:</strong> keep the mainframe as system of record but replicate its data outward — CDC from Db2/VSAM (partner tools like Precisely or tcVISION, targeting Kinesis/MSK/S3) — so analytics, APIs, and new digital channels read from AWS instead of buying MIPS. Often the highest-ROI <em>first</em> move: it reduces peak MIPS charges (interactive/analytic load is expensive) and de-risks the eventual exit by proving the data model outside the box.</li>
<li><strong>Repurchase:</strong> the mainframe app is often just old ERP/core banking — sometimes the honest answer is a SaaS/COTS replacement, not a code transformation.</li>
<li><strong>Retire:</strong> batch jobs nobody has read the output of since 2011. Mainframe estates hide plenty.</li>
</ul>

<h3>When retain is the right answer</h3>
<p>Professional-level maturity is recognizing when <em>not</em> to migrate. Retain is correct when:</p>
<ul>
<li><strong>Decommission is already scheduled.</strong> The system is being replaced by an ERP program landing in 18 months — migrating it first is pure waste. Retain, freeze change, redirect effort.</li>
<li><strong>Risk-adjusted ROI is negative.</strong> A stable, fully-depreciated system with modest run cost and catastrophic failure modes (core settlement) can rationally wait until the factory has matured on everything else.</li>
<li><strong>A hard dependency pins it:</strong> a vendor package certified only on z/OS, a regulator mid-review, a hardware appliance adjacency. Retain-with-a-trigger: document what unblocks the move.</li>
</ul>

<div class="callout war">The failure mode that kills mainframe projects is not the code — it is <strong>batch and test</strong>. Thousands of interlocked JCL jobs with implicit timing dependencies, and no complete regression suite because the mainframe <em>was</em> the spec. Serious programs invest first in automated comparison testing: run old and new in parallel on production inputs and diff outputs (files, reports, DB state) for full business cycles — including month-end and year-end — before any cutover. If a plan has no parallel-run phase, it is not a plan.</div>

<div class="callout exam">Trap dissection: for "40 years of COBOL, developers retiring, wants to eliminate mainframe skills dependency" the answer is automated refactor (Blu Age), not replatform — replatform preserves the COBOL skills problem. Reverse the constraint ("keep existing developers productive, minimize code change, exit datacenter fast") and replatform wins. "Reduce mainframe costs quickly without migrating core workloads" → offload data via CDC to AWS for analytics/APIs (augmentation). And options that rehost a mainframe with MGN are nonsense — MGN replicates x86 block devices; there is no lift-and-shift for z/OS.</div>

<div class="callout deep">Why the emulation-style replatform works at all: the runtime provides mainframe-compatible transaction (CICS-like) and batch semantics, file access methods, and EBCDIC handling on x86. What it does not replicate is the operational envelope — a z13 doing sustained 90% utilization with hardware-assisted I/O is replaced by horizontally scaled instances, so batch windows must be re-proven with production data volumes, not extrapolated. Performance testing the batch window is a first-class workstream.</div>

<p>Program shape that works: liberate data first (fund the program with MIPS savings), carve off self-contained applications via replatform or refactor per the skills constraint, run old-vs-new in parallel for full business cycles, and hold a retain list with explicit triggers rather than a vague "phase 3." The exam rewards exactly this: incremental, testable, reversible — and comfortable saying "leave it" when the numbers say so.</p>
`
    },
    {
      id: "modernization-patterns",
      title: "Modernization patterns: strangler fig and decomposition sequencing",
      html: `
<p>Modernization questions at the Professional level are sequencing questions. Everyone knows the target state — services, events, managed databases. The exam tests whether you can get there <em>while the monolith keeps taking orders</em>, and whether you know when a fashionable pattern is wrong.</p>

<h3>Strangler fig: the routing layer is the pattern</h3>
<p>The strangler fig works because of one architectural move: put a <strong>routing facade you control</strong> in front of the monolith, then peel capabilities out behind it, one at a time, until the monolith withers. On AWS the facade is:</p>
<ul>
<li><strong>ALB with path/host rules</strong> — the workhorse. <code>/checkout</code> and <code>/cart</code> route to new services (targets: ECS/EKS, Lambda via target groups, or IPs on-prem over DX); everything else falls through to the monolith target group. Weighted target groups give you canary migration per route (send 5% of /checkout to the new service, watch, ramp).</li>
<li><strong>API Gateway</strong> — when you also need per-client auth, throttling, keys, or request transformation at the seam; commonly API GW in front, ALB behind for internal routing.</li>
<li><strong>CloudFront/Route 53</strong> for coarse-grained splits (whole subdomains) — blunt, but fine for first cuts.</li>
</ul>
<p>Rules that make it survivable: extract by <strong>business capability</strong> (checkout, pricing), not by technical layer ("move the DAO tier"); each extraction must be independently deployable and independently <em>revertible</em> — reverting is a routing-rule change, not a redeploy; and the monolith is never "finished," it is starved.</p>

<h3>Event interception</h3>
<p>Synchronous routing peels the request path; <strong>event interception</strong> peels the side effects. Instead of asking the monolith to publish events (invasive), you tap changes at the edges you control:</p>
<ul>
<li><strong>CDC on the monolith database</strong> — DMS (or Debezium on MSK) streams row changes to Kinesis/EventBridge/MSK. New services consume events without a single line changed in the monolith. This is the standard on-ramp to event-driven architecture from a legacy core.</li>
<li><strong>Facade-level interception</strong> — the routing layer (or a thin wrapper service) emits domain events as requests pass through.</li>
</ul>
<p>CDC events are <em>data-shaped</em>, not <em>intent-shaped</em> ("row updated" vs "order placed") — acceptable as scaffolding, but the target state translates them into domain events, and eventually services own their events natively (transactional outbox: write the event to an outbox table in the same DB transaction as the state change, and a relay publishes it — solving the dual-write problem).</p>

<h3>Decomposition sequencing</h3>
<ol>
<li><strong>First extraction: low coupling, real value, tolerable blast radius.</strong> Classic candidates: notifications, search, reporting reads. Not auth (everything depends on it), not the order core (blast radius).</li>
<li><strong>Data comes last per capability.</strong> Extract the service while it still reads the shared schema (a known, temporary sin), then split its tables out behind it, then cut the foreign keys. Big-bang database splits are how programs die.</li>
<li><strong>Reads before writes.</strong> Stand up the new read path against replicated data (CDC-fed), verify with shadow traffic, then take over writes.</li>
</ol>

<h3>Containerize-first vs refactor-first</h3>
<table>
<thead><tr><th></th><th>Containerize-first (replatform)</th><th>Refactor-first</th></tr></thead>
<tbody>
<tr><td>What</td><td>Monolith into a container on ECS/EKS (App2Container automates this for Java/.NET), same shape</td><td>Decompose before/while moving</td></tr>
<tr><td>Wins</td><td>Deployment consistency, CI/CD, autoscaling the whole monolith, datacenter exit on schedule</td><td>Straight to target state, no intermediate</td></tr>
<tr><td>Costs</td><td>Still a monolith — release coupling and scaling granularity unchanged</td><td>Slow, expensive, risky under deadline; refactoring on-prem forgoes cloud tooling meanwhile</td></tr>
<tr><td>Pick when</td><td>Deadline-driven exit, unfamiliar team, monolith is stable</td><td>No deadline pressure, capability teams exist, business case demands it</td></tr>
</tbody>
</table>
<p>The pragmatic — and usually correct — exam answer under time pressure: containerize/rehost first, modernize incrementally in the cloud afterward, where CDC, managed streams, and the routing toolbox make strangling cheaper.</p>

<h3>Serverless refactors — and when they are wrong</h3>
<p>Lambda-per-capability is the right refactor target for spiky, event-shaped, short-duration work: order events, image/file processing, glue, APIs with idle troughs. It is the <em>wrong</em> answer when the scenario features: steady high-throughput compute (always-busy Lambda costs more than provisioned containers), long-running or stateful processes (15-minute hard cap; step through Step Functions or keep it on containers), latency floors sensitive to cold starts (Provisioned Concurrency exists but erodes the cost story), a team porting a heavyweight framework monolith function-by-function (you get a distributed monolith with cold starts), or dependencies like shared-filesystem semantics and long-lived connection pools (RDS Proxy mitigates, not erases).</p>

<div class="callout exam">Keyword mapping: "gradually migrate functionality with the ability to shift traffic incrementally and roll back" → strangler fig with ALB/API GW weighted routing. "New microservices must react to changes in the legacy database without modifying the legacy application" → CDC (DMS/Debezium) to a stream — this exact phrasing recurs. "Fastest path to exit the datacenter for a monolith, modernize later" → containerize/rehost first. Trap options: big-bang rewrite ("rebuild as microservices, then switch over") — always wrong at Pro level; and "convert each servlet to a Lambda function" for a high-throughput steady workload — wrong cost/architecture shape.</div>

<div class="callout war">The dual-write bug ships in month two of every event-driven migration: service writes the DB, then publishes to the bus, crashes in between — state and events diverge silently. The fixes are the transactional outbox or driving events from CDC. If a design doc says "write to DynamoDB and then publish to EventBridge" as two steps with no outbox/stream, that is the review comment to make — and the exam distractor to eliminate.</div>

<div class="callout limits">Numbers: Lambda 15-min max, burst and account concurrency quotas are regional (default 1,000 concurrent, raiseable); ALB weighted target groups 0–999 weights; App2Container supports Java (Tomcat/JBoss/generic) and ASP.NET; API Gateway 29-second integration timeout default (raiseable now, but historically the number to know) — long synchronous seams belong behind ALB, not API GW.</div>
`
    },
    {
      id: "hybrid-placement",
      title: "Hybrid placement: Outposts, Local Zones, Wavelength",
      html: `
<p>Some workloads cannot come to the region — latency physics, data residency law, or factory-floor survivability pins them. AWS's answer is a spectrum of "the region comes to you" options, and SAP-C02 tests the decision matrix plus the caveats each option carries.</p>

<h3>The three options, one mental model</h3>
<p>All three are <strong>extensions of a parent region</strong>: control plane stays in the region, a subset of data-plane services runs at the edge, and you operate them as extra subnets of your VPC. What differs is <em>whose building the hardware sits in</em> and <em>who the audience is</em>.</p>
<table>
<thead><tr><th></th><th>Outposts (racks / servers)</th><th>Local Zones</th><th>Wavelength</th></tr></thead>
<tbody>
<tr><td>Location</td><td>Your datacenter/site</td><td>AWS-managed facility in a metro</td><td>Inside a telco's 5G network</td></tr>
<tr><td>Audience</td><td>Data residency on your premises; sub-ms to on-prem systems</td><td>Metro-latency (single-digit ms) for users/sites in that city</td><td>Mobile/5G devices; traffic stays on carrier network</td></tr>
<tr><td>Services</td><td>EC2, EBS, ECS/EKS, RDS (subset), S3 on Outposts, ALB (racks)</td><td>EC2, EBS, ECS/EKS, ALB; varies per zone</td><td>EC2, EBS, ECS/EKS carrier-gateway networking</td></tr>
<tr><td>Capacity</td><td>Exactly what you bought — finite, ordered ahead</td><td>AWS-managed pools (smaller than region)</td><td>Small footprints</td></tr>
<tr><td>Pricing shape</td><td>Committed 3-year term per rack/server config</td><td>On-demand premium over parent region</td><td>On-demand premium</td></tr>
</tbody>
</table>
<p><strong>Outposts form factors:</strong> full 42U racks (scale by adding racks) versus 1U/2U <strong>Outposts servers</strong> for branch/retail/factory sites — servers run EC2/ECS but no EBS volumes beyond instance storage and a much thinner service list. Racks for "mini-region in my DC," servers for "a couple of instances in 200 stores."</p>

<h3>The decision matrix the exam actually tests</h3>
<ul>
<li><strong>"Data must remain on premises / in our facility" (residency, sovereignty, or sub-ms adjacency to plant equipment)</strong> → Outposts. Nothing else puts AWS APIs inside your building.</li>
<li><strong>"Single-digit-millisecond latency for end users in a specific metro," no on-prem requirement</strong> → Local Zone. Renders, real-time gaming, media production, trading front-ends near an exchange metro.</li>
<li><strong>"Ultra-low latency for 5G mobile devices," traffic must not leave the carrier network</strong> → Wavelength. AR/VR, connected vehicles, live mobile video.</li>
<li><strong>"In-country processing where no region exists," users nationwide, not one metro</strong> → check for an in-country Local Zone; if hardware must be on your premises or under your physical control, Outposts. (Dedicated Local Zones exist for whole-jurisdiction/regulated-community cases — know the concept.)</li>
</ul>

<h3>Caveats: shared responsibility and capacity</h3>
<p>This is where Pro-level questions separate from Associate:</p>
<ul>
<li><strong>Outposts shifts physical responsibility to you:</strong> you provide space, power, cooling, and — critically — <strong>network connectivity back to the parent region</strong> (via DX or VPN, through your service link). AWS owns the hardware and patches the infrastructure remotely, but if your building loses power or WAN, that is your outage. The compliance story changes too: the physical-security controls auditors normally inherit from AWS are now partly yours.</li>
<li><strong>Disconnected behavior:</strong> Outposts tolerates temporary WAN loss — running instances and local traffic continue — but the control plane is in the region: no new launches, limited mutating operations, and metrics/logs buffer. It is <em>not</em> a disconnected-edge product; for long or planned disconnection, that is Snowball Edge / Snowcone territory.</li>
<li><strong>Capacity is not elastic at the edge.</strong> An Outpost has exactly the instances you ordered; "scale out" past that means a hardware order with lead time. Local Zones and Wavelength have finite pools and narrower instance families — design N+1 spare capacity locally and burst/failover paths to the parent region.</li>
<li><strong>HA semantics:</strong> a Local Zone or Outpost is effectively one zone. Multi-AZ services and their SLAs do not apply as in-region; resilience means a second Outpost, a second site, or failover to the region — architected explicitly.</li>
</ul>

<div class="callout war">Real deployments trip on the service link: teams size DX for application traffic and forget that EBS snapshots, S3 on Outposts sync, logs, and control-plane chatter share the pipe. And on day two, someone tries to launch an instance type that was not in the original rack order and discovers "elastic" stops at the loading dock. Capacity planning for Outposts is procurement, not autoscaling.</div>

<div class="callout exam">Trap dissection: "manufacturing plant needs sub-millisecond latency to factory equipment and data must not leave the facility" — Local Zone is the planted wrong answer (AWS facility, not yours; single-digit ms, not sub-ms adjacency); Outposts is correct. "Users in one city need single-digit ms" — Outposts is the overkill distractor; Local Zone wins on cost and ops. Any option granting Wavelength to non-mobile office users is wrong — Wavelength serves devices on the carrier's 5G network. And watch for the option that quietly assumes unlimited Outposts capacity or multi-AZ RDS on a single Outpost.</div>

<div class="callout limits">Anchors: Outposts requires a parent-region association and continuous(ish) connectivity for control plane; rack term is 3 years (payment all/partial/no upfront); Local Zones are opt-in and priced above the parent region; Wavelength has no public internet ingress path except via the carrier gateway pattern. Latency tiers to recite: region tens of ms; Local Zone single-digit ms in metro; Outposts LAN-adjacent; Wavelength single-digit ms on the mobile RAN.</div>

<p>Placement questions reduce to three axes — <em>where is the latency measured to, who must own the building, and how elastic must capacity be</em>. Answer those from the scenario text and the option eliminates itself.</p>
`
    },
    {
      id: "data-scale-org",
      title: "PB-scale data movement and the organizational layer",
      html: `
<p>Two closing pieces of the migration domain: moving petabytes without lying to yourself about bandwidth, and the organizational scaffolding — CCoE and team design — that the exam sprinkles into "what should the company do FIRST" questions.</p>

<h3>Start with arithmetic, not products</h3>
<p>Transfer time = data / effective throughput. Effective throughput is the <em>minimum</em> of link rate, what you can actually saturate (protocol, distance, parallelism), and what production traffic leaves you. Anchors worth memorizing:</p>
<ul>
<li>1 Gbps saturated ≈ <strong>~10 TB/day</strong>. 10 Gbps ≈ ~100 TB/day.</li>
<li>1 PB over 1 Gbps ≈ 100+ days of perfect saturation — i.e., never, in practice.</li>
<li>Rule of thumb: if network transfer takes more than a week or two of realistic throughput, or would starve production traffic, ship devices.</li>
</ul>

<h3>The online toolset</h3>
<ul>
<li><strong>DataSync</strong> — the managed mover for NFS/SMB/HDFS/object → S3/EFS/FSx (and S3↔S3 cross-account/region). Agents deployed on-prem parallelize, checksum end-to-end, preserve metadata, do incremental re-syncs, and honor bandwidth throttles and schedules. A single agent/task drives up to ~10 Gbps; scale by sharding the namespace across tasks/agents. DataSync is the answer for <em>ongoing</em> or <em>incremental</em> sync and for "verify data integrity" language — rsync-over-DX hand-rolling is the distractor it replaces.</li>
<li><strong>DX + S3 (multipart, parallel)</strong> — with a fat DX (10/100 Gbps) and parallelism, raw S3 uploads scale excellently; Transfer Acceleration is for internet paths with distance, not DX.</li>
<li><strong>Storage Gateway</strong> is a <em>hybrid access</em> product (File/Volume/Tape) — a cache window into S3, not a bulk migration engine; on the exam it answers "keep on-prem apps working against cloud storage," not "move 800 TB by June."</li>
<li><strong>S3 Batch Operations</strong> — once data is <em>in</em> S3: copy billions of objects (cross-bucket/region), restore from Glacier, re-tag, re-encrypt, or invoke Lambda per object, driven by an inventory manifest with retries and completion reports. "Perform an operation across billions of existing objects" → Batch Ops.</li>
</ul>

<h3>The offline fleet</h3>
<ul>
<li><strong>Snowball Edge</strong> — ~80 TB usable (storage-optimized) per device, tamper-evident, encrypted (KMS), with on-board compute variants. Order in <strong>fleets</strong>: 1 PB ≈ 13–15 devices, potentially in parallel across sites. End-to-end cycle per device (ship, load, return, ingest) is typically 1–3 weeks — parallelism, not per-device speed, is how fleets beat the network.</li>
<li><strong>Snowcone</strong> — 8–14 TB, ruggedized, edge/tactical; also runs DataSync agent for trickle-back.</li>
<li>(Snowmobile, the truck, is effectively retired — fleets of Snowballs are the exam-era answer for multi-PB.)</li>
</ul>

<div class="callout exam">The recurring question gives you: data size, link speed, deadline, and sometimes "link is heavily utilized by production." Do the division. 900 TB, 500 Mbps, 3 weeks → 500 Mbps ≈ 5 TB/day ≈ 105 TB in 21 days → impossible online → Snowball Edge fleet. Same data with an existing lightly-used 10 Gbps DX and "ongoing incremental changes until cutover" → DataSync over DX (devices cannot do continuous incremental sync; DataSync re-syncs deltas). Mixed answer patterns are legitimate: bulk via Snowball, deltas via DataSync afterwards.</div>

<div class="callout war">Fleet migrations fail on ingest-side assumptions: 15 devices arriving in one week can outrun the team's ability to rack, load, and QA them; source-side read throughput (a tired NAS) is often the real bottleneck, not the device; and nobody budgets the re-verification pass. Also: Snowball import lands in S3 — if the destination is EFS/FSx, plan the second hop. Always run a one-device pilot to measure actual load rate before committing the deadline.</div>

<h3>CCoE: the migration's operating system</h3>
<p>A <strong>Cloud Center of Excellence</strong> is a small cross-functional team (architecture, security, ops, finance) that owns the paved road: landing-zone standards, IaC modules and account vending, guardrail policy, cost governance (tagging, budgets, showback), and training/enablement. The operative word is <em>enable</em> — a CCoE that becomes a ticket-driven approval bottleneck recreates the datacenter ops model with better fonts. Mature CCoEs publish self-service golden paths and review by exception; platform-engineering teams are the CCoE's paved road made product.</p>

<h3>Two-pizza teams, briefly</h3>
<p>Small teams (single-digit headcount) owning a service end-to-end — build, deploy, operate, on-call ("you build it, you run it"). Architecture consequence (Conway's law, weaponized deliberately): service boundaries follow team boundaries, so decomposition sequencing from the modernization lesson should map extractions to teams that will own them. An exam scenario about "development velocity slowed by a central operations team approving all releases" is pointing at this: autonomous service teams on a CCoE-paved platform, CI/CD per team, guardrails instead of gates.</p>

<div class="callout exam">Organizational keyword mapping: "establish standards, governance, and best practices for cloud adoption across the enterprise" → create a CCoE (frequently paired with "as a first step" alongside the landing zone). "Central team is a bottleneck for all deployments" → decentralize to product teams with guardrails (SCPs, IAM permission boundaries, CI/CD pipelines with policy checks), not a bigger central team. Distractors add process (a change advisory board, more approval stages) where the Pro-level answer removes it safely with automation.</div>

<div class="callout limits">Memorize: Snowball Edge storage-optimized ≈ 80 TB usable, 210 TB variant exists (know 80 as the classic number); DataSync ~10 Gbps per task, bandwidth-throttlable, checksummed; 1 Gbps ≈ 10 TB/day; S3 multipart upload max object 5 TB; Batch Operations works from S3 Inventory manifests and reports per-object outcomes.</div>

<p>That closes the migration toolbox. The connective tissue across all eight lessons: assess honestly, build the landing zone first, industrialize the repeatable 80%, spend your scarce refactor capacity only where the business case demands it, and let arithmetic — TCO, license counts, bandwidth math — make the decisions.</p>
`
    }
  ],
  quiz: [
    {
      q: "A company with 3,000 on-premises VMs wants a defensible cost projection for migrating to AWS before requesting budget approval. Security policy prohibits installing agents on servers. The environment runs entirely on VMware vSphere. What should the migration team do?",
      options: [
        "Deploy the Application Discovery Service agent to every VM and export utilization data to a spreadsheet-based TCO model",
        "Use Migration Evaluator with agentless collection to gather utilization data and produce a right-sized business case",
        "Run AWS Compute Optimizer against the on-premises estate to generate rightsizing recommendations",
        "Migrate a representative sample of VMs with MGN and extrapolate the observed AWS costs to the full estate"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: Migration Evaluator exists precisely to produce a pre-migration TCO business case, its agentless collector satisfies the no-agent policy, and it right-sizes on observed utilization rather than provisioned capacity. <strong>A</strong> violates the stated security policy (agents) and hand-built spreadsheet TCO models are the anti-pattern the service replaces. <strong>C</strong> is wrong because Compute Optimizer analyzes resources already running in AWS (or with the CloudWatch agent publishing to AWS) — it is not a pre-migration portfolio assessment tool. <strong>D</strong> is slow, costly, and statistically weak — a sample migration measures a handful of workloads, not the licensing and utilization spread of 3,000 VMs, and no CFO signs budget based on it."
    },
    {
      q: "A migration team is building the first wave for a 1,200-server migration. Which applications should be selected for the initial wave?",
      options: [
        "The mission-critical ERP system, to prove the migration approach can handle the most important workload",
        "Applications with the largest number of dependencies, since they will take longest and should start earliest",
        "Low-risk, low-dependency applications such as internal tools, to exercise the cutover process and build team capability",
        "All databases first, so that application servers migrated later have their data already in AWS"
      ],
      answer: [2],
      multi: false,
      explanation: "<strong>C</strong> is correct: pilot waves use low-risk, self-contained applications because the goal of wave 1 is to exercise the factory — runbooks, cutover, rollback, team confidence — where failure is cheap. <strong>A</strong> inverts risk management: the most critical app goes late, after the factory has measured throughput and scar tissue. <strong>B</strong> confuses lead time with sequencing — high-dependency apps are migrated as intact dependency groups in later waves once the process is proven, not first. <strong>D</strong> splits every app from its database across a WAN for months, inserting latency into every synchronous call path — dependency groups (app + its data) move together within a wave."
    },
    {
      q: "An enterprise wants to begin migrating 800 servers next month. It has one AWS account created by a developer, no Direct Connect, and no federation with its corporate directory. Which action should the architect recommend FIRST?",
      options: [
        "Install MGN agents on the first wave of servers to begin replication into the existing account",
        "Establish a multi-account landing zone with AWS Control Tower, hybrid connectivity, and identity federation before migrating workloads",
        "Create golden AMIs for each operating system build to standardize the migrated fleet",
        "Purchase a Savings Plan commitment to reduce the cost of the migrated servers"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: landing-zone readiness — account structure, guardrails, network, identity — is a prerequisite for migration at scale; migrating into a single unstructured account creates a re-migration project later. <strong>A</strong> starts replication into an environment with no network path sized for it, no account boundaries, and no guardrails — speed now, rework tax later. <strong>C</strong> is workload-phase work and largely unnecessary for MGN rehosting, which replicates existing servers rather than launching from golden AMIs. <strong>D</strong> is premature: committing spend before any workload runs (and before right-sizing data exists) locks in guesses; commitments come after usage stabilizes."
    },
    {
      q: "A company is cutting over a business-critical application migrated with MGN on Saturday night. Which combination of actions provides the fastest rollback capability if problems are discovered on Monday? (Select TWO.)",
      options: [
        "Reduce the DNS TTL for the application several days before the cutover window",
        "Decommission the source servers immediately after cutover to avoid paying for both environments",
        "Keep the source servers stopped but intact for a defined soak period after cutover",
        "Take an AMI backup of the migrated instances and rely on restoring it if issues occur",
        "Delete the MGN staging area resources as soon as the cutover instances launch"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<strong>A</strong> and <strong>C</strong> are correct: a low DNS TTL (lowered in advance, because the change only helps after the old TTL drains) makes traffic re-pointing fast in both directions, and intact source servers mean rollback is restart-plus-DNS-flip in minutes. <strong>B</strong> is the classic self-inflicted disaster — with sources gone, rollback becomes a multi-day restore. <strong>D</strong> misunderstands the failure mode: an AMI of the <em>new</em> environment does not restore the <em>old</em> environment; if the migrated app is broken, its own backup is equally broken. <strong>E</strong> destroys the replication baseline while confidence is still unproven; staging resources are cheap and are cleaned up after the soak period."
    },
    {
      q: "A company runs a 4 TB Oracle Enterprise Edition database on-premises. It wants to eliminate Oracle license costs and is willing to modify application code. Downtime for the final cutover must be under 30 minutes. Which approach meets the requirements?",
      options: [
        "Use AWS DMS to convert the schema to Aurora PostgreSQL and perform a full-load migration during a weekend outage",
        "Use the Schema Conversion Tool to convert the schema to Aurora PostgreSQL, then use DMS with full load plus CDC and cut over after replication lag reaches near zero",
        "Migrate the database to RDS for Oracle with the license-included model to remove the license line item",
        "Export the database with Data Pump to S3 and import it into Aurora PostgreSQL during a maintenance window"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: heterogeneous migration = SCT for schema/code conversion + DMS full load with CDC, which keeps the source live and shrinks cutover to a drain-and-repoint measured in minutes regardless of database size. <strong>A</strong> is doubly wrong: DMS does not convert schemas (SCT does), and a pure full load of 4 TB cannot fit a 30-minute window. <strong>C</strong> does not eliminate Oracle costs — and RDS license-included is not offered for Enterprise Edition at all (LI covers SE2; EE is BYOL). <strong>D</strong> is an offline export/import whose downtime scales with data size — hours for 4 TB, not 30 minutes — and Data Pump targets Oracle-compatible engines, adding conversion pain toward PostgreSQL."
    },
    {
      q: "An enterprise owns perpetual Windows Server licenses purchased without Software Assurance and wants to reuse them on AWS to reduce migration costs. Which EC2 configuration allows this?",
      options: [
        "Default tenancy instances with the license-included Windows AMI replaced by a custom BYOL image",
        "Dedicated Instances, since the hypervisor is not shared with other customers",
        "Dedicated Hosts, with AWS License Manager tracking license consumption against physical cores and sockets",
        "Spot Instances in a dedicated capacity reservation to isolate the workloads"
      ],
      answer: [2],
      multi: false,
      explanation: "<strong>C</strong> is correct: Windows Server BYOL (and other licenses bound to physical sockets/cores, including SQL Server without Software Assurance) requires visibility and control of the physical host — only Dedicated Hosts (or bare metal) provide host affinity plus socket/core counts, and License Manager enforces entitlement limits. <strong>A</strong> is not permitted: Windows Server BYOL is not eligible on default (shared) tenancy. <strong>B</strong> is the well-crafted trap — Dedicated Instances isolate at the instance level but do not give the host visibility, affinity, and core counting that per-socket licensing requires; the distinction between Dedicated Instances and Dedicated Hosts is exactly what is being tested. <strong>D</strong> is incoherent — Spot has nothing to do with licensing eligibility and interruptible capacity is orthogonal to the question."
    },
    {
      q: "A migration program must move 250 databases from SQL Server and Oracle to AWS within 18 months. Program leadership needs to decide which databases can move to open-source engines and which should stay on their current engine. What is the MOST efficient way to make this determination?",
      options: [
        "Run AWS SCT multiserver assessment across the estate and triage databases by automatic conversion percentage and itemized manual effort",
        "Migrate each database to Aurora in a test account and count the application errors generated",
        "Classify databases by size, sending databases under 1 TB to Aurora and larger ones to RDS on their current engine",
        "Interview each application team and let them choose their preferred target engine"
      ],
      answer: [0],
      multi: false,
      explanation: "<strong>A</strong> is correct: SCT's assessment report exists for exactly this — run estate-wide, it quantifies per-database automatic-conversion percentage and itemizes remaining manual work, letting the program triage quick-win Aurora candidates from PL/SQL-heavy stay-on-engine cases. <strong>B</strong> is a 250-database science experiment: enormously expensive, and runtime errors are a lagging, incomplete signal compared to static assessment. <strong>C</strong> uses an irrelevant axis — size predicts transfer time, not conversion complexity; a 200 GB database full of proprietary packages is harder than a clean 5 TB one. <strong>D</strong> gathers preference, not feasibility, and produces an unprioritized wish list with no effort data."
    },
    {
      q: "A bank runs core batch processing on a mainframe in COBOL. The COBOL team is largely retiring within three years, and the bank's stated goal is to eliminate its dependency on mainframe skills entirely while moving to AWS. Which approach best fits?",
      options: [
        "Replatform to the managed Micro Focus-compatible runtime in AWS Mainframe Modernization, keeping the COBOL codebase intact",
        "Rehost the mainframe images to EC2 using Application Migration Service",
        "Use the AWS Blu Age automated refactoring path to transform the COBOL and JCL into Java services, with an extended parallel-run test phase",
        "Retain the mainframe and hire contractors to maintain the COBOL applications indefinitely"
      ],
      answer: [2],
      multi: false,
      explanation: "<strong>C</strong> is correct: the binding constraint is eliminating the COBOL/mainframe skills dependency, which replatforming cannot do — automated refactor (Blu Age) transforms COBOL/JCL to Java, and the parallel-run phase addresses the transformation risk honestly. <strong>A</strong> exits the mainframe hardware but preserves exactly the skills problem the scenario says must be eliminated — it is the right answer to a different question ('keep developers productive, minimal code change'). <strong>B</strong> is impossible: MGN replicates x86 block devices; there is no lift-and-shift path for z/OS workloads. <strong>D</strong> ignores the stated goal and converts a strategic risk into a permanent staffing dependency with worsening economics."
    },
    {
      q: "A retailer wants to decompose a monolithic e-commerce application. New microservices must react to order changes in the monolith's MySQL database, but the monolith's code is owned by a vendor and cannot be modified. Which pattern satisfies this?",
      options: [
        "Modify the monolith to publish events to Amazon EventBridge whenever an order changes",
        "Use change data capture from the MySQL binlog, streaming row changes for the new services to consume",
        "Have each microservice poll the MySQL database on a schedule and compare snapshots to detect changes",
        "Place an SQS queue between the monolith and its database so writes can be intercepted"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: event interception via CDC (DMS or Debezium reading the binlog into Kinesis/MSK/EventBridge) surfaces database changes as a stream with zero modification to the vendor application — the standard on-ramp from a legacy core to event-driven architecture. <strong>A</strong> directly violates the stated constraint that the monolith cannot be modified. <strong>C</strong> works at toy scale but is the anti-pattern distractor: polling load on the production database, missed intermediate states between polls, and latency proportional to the polling interval. <strong>D</strong> is architecturally incoherent — a queue cannot be transparently inserted between an application and its relational database; SQL connections are not interceptable messages."
    },
    {
      q: "A company must exit its datacenter in 10 months. Its main workload is a stable Java monolith the team eventually wants to rebuild as microservices, but the team has no container or AWS experience yet. What should the architect recommend?",
      options: [
        "Refactor the monolith into microservices on-premises first, then migrate the finished services to AWS",
        "Containerize the monolith largely as-is, using a tool such as App2Container, migrate it to ECS, and decompose incrementally after the datacenter exit",
        "Rewrite the application as Lambda functions to arrive directly at the serverless target state",
        "Delay the datacenter exit until the microservices redesign is complete"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: under a hard deadline, containerize/replatform-first meets the exit date with low risk (the monolith is stable), and modernization continues afterward in the cloud where CDC, streaming, and routing tools make strangler-fig decomposition cheaper. <strong>A</strong> spends the scarce resource (time) on the risky activity (refactoring) before the deadline-driven one, and does the refactor without cloud tooling — the exact inversion of the correct sequencing. <strong>C</strong> is a big-bang rewrite by an inexperienced team under deadline, aimed at a compute model (Lambda) that fits spiky event-shaped work, not necessarily a steady monolith — maximal risk on every axis. <strong>D</strong> is usually not an available lever (lease end, cost commitments) and the scenario presents the date as fixed."
    },
    {
      q: "A manufacturing company requires single-digit-millisecond processing latency between a new AWS-hosted MES application and robotic equipment on the factory floor. Regulations require production data to remain physically within the plant. The nearest AWS Region is 400 km away. Which option meets the requirements?",
      options: [
        "Deploy the application in an AWS Local Zone in the nearest metropolitan area",
        "Deploy the application on an AWS Outposts rack installed in the plant, connected to the parent Region",
        "Deploy the application in the nearest Region and connect the plant with AWS Direct Connect",
        "Deploy the application on AWS Wavelength through a 5G carrier serving the plant"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: Outposts is the only option that places AWS compute physically inside the customer's facility — satisfying both LAN-adjacent latency to the robots and the data-residency-on-premises requirement. <strong>A</strong> is the planted trap: a Local Zone is an AWS-managed facility in a metro — data leaves the plant, and metro round trips are single-digit milliseconds at best, not LAN-adjacent. <strong>C</strong> fails both requirements: 400 km adds several ms each way at minimum and data leaves the site. <strong>D</strong> puts compute in the carrier's network, not the plant — residency fails, and Wavelength targets mobile-device traffic, not factory-floor wired equipment."
    },
    {
      q: "A media company must migrate 900 TB of archive footage to Amazon S3 within four weeks. The site has a 500 Mbps internet connection that is 60 percent utilized by production traffic during business hours. After the bulk migration, about 2 TB of new footage per week must continue flowing to S3 until final cutover. Which combination is MOST appropriate?",
      options: [
        "Use S3 Transfer Acceleration for the full 900 TB and the weekly increments",
        "Order a fleet of Snowball Edge devices for the 900 TB bulk transfer, then use DataSync over the existing connection for the weekly increments",
        "Use DataSync with bandwidth throttling for the full 900 TB and the weekly increments",
        "Order a single Snowball Edge device and reuse it in rotation until all 900 TB and subsequent increments are transferred"
      ],
      answer: [1],
      multi: false,
      explanation: "Do the arithmetic: ~200 Mbps of headroom moves roughly 2 TB/day — 900 TB would take well over a year online, so the bulk must ship on devices, while 2 TB/week of increments fits easily online. <strong>B</strong> combines both correctly: a Snowball Edge fleet (about 12 devices at ~80 TB usable each, loadable in parallel) for bulk, DataSync for ongoing incremental sync with checksums and throttling. <strong>A</strong> and <strong>C</strong> fail the same arithmetic — Transfer Acceleration and DataSync optimize the path but cannot manufacture bandwidth; 900 TB does not fit through 200 Mbps in four weeks. <strong>D</strong> misses the deadline serially: each device round trip is 1–3 weeks, so one device in rotation moves ~80 TB per cycle — months of cycles; fleets work by parallelism."
    },
    {
      q: "A migration program spans 40 AWS accounts and three regions, using MGN for servers and DMS for databases, plus a partner tool for a VMware estate. Leadership wants a single view of per-application migration status. What should the team implement?",
      options: [
        "Build a QuickSight dashboard fed by custom scripts calling each tool's API in every account",
        "Designate an AWS Migration Hub home region and track migration status from MGN, DMS, and integrated partner tools there, grouped by application",
        "Enable AWS Config aggregation across all accounts to report on migrated resources",
        "Use AWS Systems Manager Explorer to aggregate instance inventory across the organization"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: aggregating migration status across MGN, DMS, and integrated partner tools into one place, grouped into applications and waves, is literally Migration Hub's job — after designating a home region where the tracking data lives. <strong>A</strong> rebuilds Migration Hub by hand: possible, expensive, and the distractor for teams that reach for custom dashboards before checking for the managed capability. <strong>C</strong> reports resource configuration compliance for resources that exist in AWS — it has no concept of migration lifecycle status or on-prem sources. <strong>D</strong> aggregates operational inventory of managed instances, not migration progress; it can tell you what is running, not what stage of cutover an application is in."
    },
    {
      q: "Which TWO actions most directly reduce the licensing cost of a SQL Server Enterprise workload being migrated to EC2? (Select TWO.)",
      options: [
        "Use the Optimize CPUs feature to disable hyperthreading and reduce the active vCPU count on memory-optimized instances",
        "Enable Multi-AZ deployment for the database instances",
        "Migrate eligible databases to Aurora PostgreSQL using SCT and DMS, assisted by Babelfish to reduce application changes",
        "Move the instances to a placement group to improve network locality",
        "Purchase Compute Savings Plans for the EC2 instances"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<strong>A</strong> is correct: SQL Server is licensed per core, and Optimize CPUs lets you buy a large-memory instance while activating fewer vCPUs (and disabling hyperthreading), directly cutting the licensed core count. <strong>C</strong> is correct: the ultimate license reduction is engine exit — SCT+DMS to Aurora PostgreSQL eliminates the SQL Server license entirely, and Babelfish's TDS/T-SQL compatibility lowers the application-rewrite barrier that usually blocks it. <strong>B</strong> increases licensing exposure if anything (passive nodes have their own licensing rules) and addresses availability, not cost. <strong>D</strong> is pure networking placement — irrelevant to licensing. <strong>E</strong> reduces the <em>infrastructure</em> bill, not the licensing bill — Savings Plans discount compute usage; the SQL Server license cost is a separate dimension untouched by them."
    },
    {
      q: "An enterprise beginning a three-year cloud adoption program finds that individual teams are provisioning AWS accounts with inconsistent security settings, no tagging, and no cost visibility. Which action addresses the root cause?",
      options: [
        "Require all teams to submit provisioning requests to a central operations queue for manual review",
        "Establish a Cloud Center of Excellence that publishes standards and provides governed self-service account vending through Control Tower Account Factory",
        "Consolidate all workloads into a single shared AWS account managed by the platform team",
        "Purchase a third-party CMP tool and mandate its use for all deployments"
      ],
      answer: [1],
      multi: false,
      explanation: "<strong>B</strong> is correct: the root cause is the absence of a paved road — a CCoE defines the standards (tagging, security baseline, cost governance) and Account Factory delivers them as governed self-service, preserving team velocity while making the compliant path the easy path. <strong>A</strong> treats the symptom with a bottleneck: manual central review recreates datacenter-era ticket ops, slows every team, and scales with headcount instead of automation. <strong>C</strong> destroys the blast-radius and cost-isolation benefits of multi-account architecture and collides with service quotas and IAM sprawl — the opposite of current guidance. <strong>D</strong> buys a tool before defining the standards the tool would enforce; governance is an operating-model problem first, a tooling problem second."
    }
  ],
  flashcards: [
    { front: "The 7 Rs of migration disposition", back: "Retire, Retain, Rehost (MGN), Relocate (VMware/account moves), Repurchase (SaaS), Replatform (lift-tinker-shift), Refactor (re-architect). Sweep for retire/retain first — the cheapest migration is none." },
    { front: "Migration Evaluator — what it produces and how it sizes", back: "A pre-migration TCO business case (agentless collection or imported data). Right-sizes on <strong>observed utilization</strong>, not provisioned capacity, and models Windows/SQL licensing permutations." },
    { front: "ADS agentless collector vs ADS agent", back: "Agentless = OVA in vCenter, VM inventory + utilization, no guest visibility. Agent = per-server install, adds processes and network connections — required for dependency mapping." },
    { front: "Migration Readiness Assessment (MRA)", back: "CAF-based workshop scoring readiness across business, people, governance, platform, security, operations. Output is a gap list that becomes the mobilize-phase backlog." },
    { front: "How does MGN replicate servers?", back: "Agent performs continuous, asynchronous, <strong>block-level</strong> replication to a low-cost staging area (small replication servers + EBS). Test launches any time without touching the source; cutover = final sync + launch from template. Free for 90 days per server." },
    { front: "Why keep source servers after MGN cutover?", back: "Rollback = DNS flip + restart source, minutes not days. Decommission only after a soak period (one business cycle). Pair with DNS TTL lowered days in advance." },
    { front: "Migration Hub home region", back: "Single designated region where discovery data and migration status (MGN, DMS, partner tools) aggregate, grouped by application/wave — the program's single pane of glass." },
    { front: "SCT vs DMS — division of labor", back: "SCT converts schema/code and produces the <strong>assessment report</strong> (auto-conversion % + manual effort). DMS moves data: full load + CDC for near-zero-downtime cutover. DMS never converts schemas." },
    { front: "DMS near-zero-downtime cutover pattern", back: "Full load + CDC from transaction logs; run until lag ~0, briefly stop writes, drain CDC, repoint connection strings. Downtime independent of database size. Enable DMS validation for row-level proof." },
    { front: "RDS Oracle licensing options", back: "SE2: license-included or BYOL. Enterprise Edition: <strong>BYOL only</strong> — no license-included EE. RDS SQL Server is license-included only (BYOL SQL Server means EC2)." },
    { front: "When are Dedicated Hosts required for BYOL?", back: "Licenses bound to physical sockets/cores: Windows Server BYOL always; SQL Server without Software Assurance/License Mobility. Dedicated <em>Instances</em> are NOT sufficient — no host visibility/affinity. Track with License Manager." },
    { front: "Optimize CPUs — why it saves license money", back: "On EC2, reduce active vCPUs and disable hyperthreading on a big-memory instance: the database keeps its RAM while the per-core license count (Oracle, SQL Server) drops." },
    { front: "Babelfish for Aurora PostgreSQL", back: "Speaks the SQL Server wire protocol (TDS) and understands T-SQL, so apps can move from SQL Server to Aurora PostgreSQL with far fewer code changes — the middle path in license exits." },
    { front: "AWS Mainframe Modernization: replatform vs automated refactor", back: "Replatform (Micro Focus/Rocket runtime): COBOL recompiled as-is, keeps existing skills, faster/lower risk. Automated refactor (Blu Age): COBOL/JCL transformed to Java — choose when the goal is eliminating mainframe skills dependency." },
    { front: "When is RETAIN the right migration answer?", back: "Decommission already scheduled (replacement landing soon), negative risk-adjusted ROI, or a hard pin (vendor certification, regulator, appliance adjacency). Retain with a documented trigger, not by default." },
    { front: "Strangler fig on AWS — the key component", back: "A routing facade you control: ALB path/host rules (weighted target groups for canary %), or API Gateway when the seam needs auth/throttling. Extract by business capability; revert = routing change." },
    { front: "Event interception without touching the legacy app", back: "CDC from the monolith's database (DMS/Debezium into Kinesis/MSK/EventBridge). New services consume changes with zero legacy code modification. Target state upgrades data-shaped events to domain events via transactional outbox." },
    { front: "The dual-write problem and its fixes", back: "Writing the DB then publishing an event as two steps can diverge on crash. Fixes: transactional outbox (event row committed atomically with state, relay publishes) or derive events from CDC." },
    { front: "Containerize-first vs refactor-first", back: "Hard deadline / datacenter exit / inexperienced team → containerize (App2Container) and decompose later in the cloud. Refactor-first only without deadline pressure and with capability teams ready to own services." },
    { front: "When is a serverless refactor the WRONG answer?", back: "Steady high-throughput compute (always-busy Lambda costs more than containers), long-running/stateful work (15-min cap), tight latency floors (cold starts), or porting a framework monolith function-by-function." },
    { front: "Outposts vs Local Zones vs Wavelength — one-line matrix", back: "Outposts: AWS in <strong>your</strong> building (residency, LAN-adjacent latency; you supply power/space/WAN; capacity = what you ordered, 3-yr term). Local Zone: AWS metro facility, single-digit ms for that city. Wavelength: inside a 5G carrier network for mobile devices." },
    { front: "Outposts disconnected behavior", back: "Control plane lives in the parent region: on WAN loss, running instances and local traffic continue but no new launches; logs/metrics buffer. Not a long-term disconnected-edge product — that is Snow family territory." },
    { front: "Bandwidth arithmetic anchors for data migration", back: "1 Gbps saturated ≈ 10 TB/day; 10 Gbps ≈ 100 TB/day; 1 PB over 1 Gbps ≈ 100+ days. If realistic transfer exceeds ~1–2 weeks or starves production, ship Snowball devices; deltas continue via DataSync." },
    { front: "DataSync vs Storage Gateway vs S3 Batch Operations", back: "DataSync: managed bulk/incremental transfer (NFS/SMB/HDFS/object → S3/EFS/FSx), checksums, throttling, ~10 Gbps per task. Storage Gateway: ongoing hybrid <em>access</em> (cache window), not bulk migration. Batch Ops: act on billions of objects already in S3 via inventory manifest." },
    { front: "CCoE vs two-pizza teams — roles in a migration", back: "CCoE: small cross-functional team owning the paved road (standards, account vending, guardrails, cost governance) — enable, don't gatekeep. Two-pizza teams: small teams owning services end-to-end; align service decomposition to team boundaries (Conway, on purpose)." }
  ],
  lab: {
    title: "Lab: mini heterogeneous-style DMS migration — RDS MySQL to S3 with full load",
    html: `
<h3>Goal</h3>
<p>Stand up the smallest possible DMS pipeline end to end: an RDS MySQL source with sample data, a DMS replication instance, source and target endpoints, and a full-load task landing CSV output in S3. You will read a task's table statistics the way a migration factory does, then tear everything down. Cost: an hour of db.t3.micro + dms.t3.micro (both free-tier eligible in most accounts; otherwise well under a dollar for the session). Do the teardown — the replication instance bills hourly while it exists.</p>

<h3>Architecture</h3>
<p>RDS MySQL (source endpoint) → DMS replication instance → S3 bucket (target endpoint, CSV objects per table). Everything lives in your default VPC; the S3 target is reached via an IAM role that DMS assumes. This is the same task/endpoint/instance anatomy you would use for an Oracle-to-Aurora CDC migration — just with the cheapest possible pieces.</p>

<h3>Steps</h3>
<ol>
<li><p>Set your region and create the artifacts bucket (bucket names are global — change the suffix):</p>
<pre><code>export AWS_DEFAULT_REGION=us-east-1
aws s3 mb s3://dms-lab-target-CHANGE-ME-12345</code></pre></li>

<li><p>Create the source database (default VPC, publicly inaccessible is fine since DMS runs in the same VPC):</p>
<pre><code>aws rds create-db-instance \
  --db-instance-identifier dms-lab-source \
  --engine mysql --db-instance-class db.t3.micro \
  --allocated-storage 20 \
  --master-username admin --master-user-password 'LabPassw0rd!' \
  --db-name labdb --no-publicly-accessible
aws rds wait db-instance-available --db-instance-identifier dms-lab-source</code></pre></li>

<li><p>Load sample data. Launch a t3.micro (or use CloudShell if it can reach the DB security group) with the mysql client, then:</p>
<pre><code>mysql -h &lt;rds-endpoint&gt; -u admin -p'LabPassw0rd!' labdb &lt;&lt;'SQL'
CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT,
  customer VARCHAR(64), amount DECIMAL(10,2), created_at TIMESTAMP);
INSERT INTO orders (customer, amount, created_at) VALUES
 ('acme', 120.50, NOW()), ('globex', 99.99, NOW()), ('initech', 42.00, NOW());
SQL</code></pre>
<p>Make sure the RDS security group allows port 3306 from your client instance's security group and from the DMS replication instance (same VPC default SG is simplest for a lab).</p></li>

<li><p>Create the IAM role DMS uses to write to S3 (trust policy for dms.amazonaws.com, S3 write on the bucket):</p>
<pre><code>aws iam create-role --role-name dms-lab-s3-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"dms.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam put-role-policy --role-name dms-lab-s3-role --policy-name s3-write \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:PutObject","s3:DeleteObject","s3:ListBucket"],"Resource":["arn:aws:s3:::dms-lab-target-CHANGE-ME-12345","arn:aws:s3:::dms-lab-target-CHANGE-ME-12345/*"]}]}'</code></pre>
<p>Note: if this account has never used DMS in a VPC, also create the standard <code>dms-vpc-role</code> service role per the DMS documentation before the next step.</p></li>

<li><p>Create the replication instance (the compute that does the work — in real migrations, sizing this is a first-class decision):</p>
<pre><code>aws dms create-replication-instance \
  --replication-instance-identifier dms-lab-ri \
  --replication-instance-class dms.t3.micro \
  --allocated-storage 20 --no-publicly-accessible
aws dms wait replication-instance-available \
  --filters Name=replication-instance-id,Values=dms-lab-ri</code></pre></li>

<li><p>Create both endpoints, then test them (never skip the connection test — it is the step that catches security-group mistakes):</p>
<pre><code>aws dms create-endpoint --endpoint-identifier dms-lab-src \
  --endpoint-type source --engine-name mysql \
  --server-name &lt;rds-endpoint&gt; --port 3306 \
  --username admin --password 'LabPassw0rd!'
aws dms create-endpoint --endpoint-identifier dms-lab-tgt \
  --endpoint-type target --engine-name s3 \
  --s3-settings '{"ServiceAccessRoleArn":"arn:aws:iam::&lt;account-id&gt;:role/dms-lab-s3-role","BucketName":"dms-lab-target-CHANGE-ME-12345","AddColumnName":true}'
aws dms test-connection --replication-instance-arn &lt;ri-arn&gt; --endpoint-arn &lt;src-endpoint-arn&gt;
aws dms test-connection --replication-instance-arn &lt;ri-arn&gt; --endpoint-arn &lt;tgt-endpoint-arn&gt;</code></pre></li>

<li><p>Create and start a full-load task for the orders table:</p>
<pre><code>aws dms create-replication-task \
  --replication-task-identifier dms-lab-task \
  --source-endpoint-arn &lt;src-endpoint-arn&gt; \
  --target-endpoint-arn &lt;tgt-endpoint-arn&gt; \
  --replication-instance-arn &lt;ri-arn&gt; \
  --migration-type full-load \
  --table-mappings '{"rules":[{"rule-type":"selection","rule-id":"1","rule-name":"1","object-locator":{"schema-name":"labdb","table-name":"orders"},"rule-action":"include"}]}'
aws dms start-replication-task --replication-task-arn &lt;task-arn&gt; \
  --start-replication-task-type start-replication</code></pre></li>
</ol>

<h3>Verify</h3>
<ol>
<li><p>Watch the task reach <code>stopped</code> with stop reason <code>FULL_LOAD_ONLY_FINISHED</code>, and read the per-table stats — the same numbers (loaded rows, errors) a factory dashboard aggregates:</p>
<pre><code>aws dms describe-replication-tasks \
  --filters Name=replication-task-id,Values=dms-lab-task \
  --query 'ReplicationTasks[0].[Status,StopReason]'
aws dms describe-table-statistics --replication-task-arn &lt;task-arn&gt;</code></pre></li>
<li><p>Confirm the CSV landed and inspect it:</p>
<pre><code>aws s3 ls s3://dms-lab-target-CHANGE-ME-12345/labdb/orders/ --recursive
aws s3 cp s3://dms-lab-target-CHANGE-ME-12345/labdb/orders/LOAD00000001.csv - | head</code></pre>
<p>You should see your three rows with column headers (from AddColumnName). In a real migration this task would be <code>full-load-and-cdc</code> and would keep tailing the binlog — the cutover would happen when CDC latency reached near zero.</p></li>
</ol>

<h3>Teardown</h3>
<p>Ordered so nothing blocks: task → endpoints → replication instance → RDS → S3 → IAM. The replication instance and RDS instance bill hourly — do not skip this.</p>
<ol>
<li><pre><code>aws dms delete-replication-task --replication-task-arn &lt;task-arn&gt;</code></pre> (wait for it to delete)</li>
<li><pre><code>aws dms delete-endpoint --endpoint-arn &lt;src-endpoint-arn&gt;
aws dms delete-endpoint --endpoint-arn &lt;tgt-endpoint-arn&gt;</code></pre></li>
<li><pre><code>aws dms delete-replication-instance --replication-instance-arn &lt;ri-arn&gt;</code></pre></li>
<li><pre><code>aws rds delete-db-instance --db-instance-identifier dms-lab-source \
  --skip-final-snapshot --delete-automated-backups</code></pre></li>
<li><pre><code>aws s3 rb s3://dms-lab-target-CHANGE-ME-12345 --force</code></pre></li>
<li><pre><code>aws iam delete-role-policy --role-name dms-lab-s3-role --policy-name s3-write
aws iam delete-role --role-name dms-lab-s3-role</code></pre></li>
<li>Terminate the client EC2 instance if you launched one, and remove any security-group rules you added.</li>
</ol>
`
  }
});
