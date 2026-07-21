/* Module 16 — Observability: CloudWatch, CloudTrail, X-Ray & Config (SAA track) */
window.COURSE.register({
  id: "observability",
  order: 16,
  track: "saa",
  title: "Observability: CloudWatch, CloudTrail, X-Ray & Config",
  description: "CloudWatch's metric and alarm model down to dimension identity and missing-data semantics, Logs routing, the CloudTrail/CloudWatch/Config exam triangle, X-Ray tracing, and the operational-automation patterns that tie them together — plus what all this telemetry actually costs.",
  examWeight: "Steady presence across SAA-C03, concentrated in monitoring/audit scenarios: which-service-sees-what (the CloudTrail vs CloudWatch vs Config triangle), the EC2 memory-metric trap, metric vs subscription filters, and Config auto-remediation.",
  lessons: [
    {
      id: "cw-metrics-model",
      title: "The CloudWatch metrics model: identity, resolution, and EMF",
      html: `
<p>CloudWatch is a time-series database with an opinionated data model, and half the confusion people have with it dissolves once you internalize one rule: <strong>a metric's identity is its namespace + metric name + the complete set of dimensions</strong>. Dimensions are not tags you can filter by after the fact — they are part of the primary key.</p>

<h3>Namespaces and dimensions</h3>
<p>A <strong>namespace</strong> is a container (AWS/EC2, AWS/Lambda, or your own like MyApp/Payments — custom metrics cannot write into AWS/* namespaces). A <strong>dimension</strong> is a name/value pair, up to <strong>30 per metric</strong>. Because dimensions are identity, CPUUtilization with dimension InstanceId=i-abc and CPUUtilization with dimensions InstanceId=i-abc, AutoScalingGroupName=my-asg are <em>two different time series</em> — publishing to one does not make the other queryable. In Prometheus terms: every unique label set is its own series, and there is no ad-hoc re-aggregation across label sets at query time unless the publisher emitted the aggregate series too (AWS services do — that is why AWS/EC2 has both per-instance and per-ASG series). This is also why high-cardinality dimensions (request ID, user ID) are a billing disaster: each unique combination is a new billable custom metric.</p>

<div class="callout deep">CloudWatch does not store raw datapoints forever at full resolution; it ages data into coarser periods: sub-minute data lives 3 hours, 1-minute data 15 days, 5-minute data 63 days, 1-hour data 15 months. You cannot retrieve 1-second granularity from last month — design dashboards and incident forensics around that decay schedule, and export to your own store if you need better.</div>

<h3>Resolution: standard, detailed, high-resolution</h3>
<ul>
<li><strong>Standard monitoring</strong>: AWS services emit at <strong>5-minute</strong> granularity (EC2's default), free.</li>
<li><strong>Detailed monitoring</strong>: the same service metrics at <strong>1-minute</strong> granularity — opt-in, paid, per instance/resource. For Auto Scaling responsiveness, 1-minute data is effectively mandatory: a 5-minute signal means your scale-out decision is up to 5 minutes stale.</li>
<li><strong>High-resolution custom metrics</strong>: your own metrics published with StorageResolution=1 can carry <strong>1-second</strong> granularity, and high-resolution alarms can evaluate at 10s/30s periods. Only custom metrics can be high-resolution; AWS service metrics cannot.</li>
</ul>

<h3>What EC2 does NOT emit — the classic exam question</h3>
<p>The hypervisor can only see what the hypervisor can see: CPU utilization, disk and network I/O counters, and status checks. It cannot see inside the guest, so <strong>EC2 emits no memory utilization, no disk space used, no swap, and no per-process anything</strong>. Those require the <strong>CloudWatch agent</strong> (or your own PutMetricData) running in the instance, publishing to a custom namespace (the agent defaults to CWAgent). The same applies to disk-used-percent on EBS volumes: the AWS/EBS namespace has I/O metrics, not filesystem fullness — filesystems are a guest concept. Exam phrasing is invariably "alarm on memory utilization of EC2 instances" → install and configure the CloudWatch agent; any option implying memory arrives by enabling detailed monitoring is the trap (detailed monitoring changes <em>frequency</em>, not the metric set).</p>

<h3>Percentiles and statistics</h3>
<p>CloudWatch computes statistics server-side from the datapoints in each period: Average, Sum, Min, Max, SampleCount, and <strong>percentiles (p50…p99.9)</strong> — plus trimmed means (TM99) for the outlier-hostile. The senior habit transfers directly: never alarm a latency SLO on Average; a p99 alarm on ALB TargetResponseTime catches the tail that Average launders away. Caveat: percentile statistics need the raw value distribution, so if a publisher pre-aggregates (sends only Sum/SampleCount via statistic sets), percentiles are unavailable for that series.</p>

<h3>EMF: metrics from logs</h3>
<p>The <strong>Embedded Metric Format</strong> flips the ingestion path: instead of calling PutMetricData (an API call per batch, with throttling and latency on your hot path), you write a structured JSON log line containing an _aws metadata block declaring namespace, dimensions, and metric values. CloudWatch Logs ingests the line and <em>asynchronously extracts</em> the metrics — you get the metric, plus the full-fidelity log event for later Logs Insights queries, in one write. For Lambda this is the recommended pattern (stdout is already wired to Logs; zero added latency, no API quota consumed). The trade: metrics appear with ingestion delay, and you pay Logs ingestion for the events. A related trick in the same spirit: <strong>metric filters</strong> extract metrics from logs you already have (next lessons) — EMF is the deliberate, structured version of that.</p>

<div class="callout limits">Numbers worth holding: dimensions per metric <strong>30</strong>; high-resolution granularity <strong>1 s</strong> (custom only); detailed monitoring <strong>1-min</strong>; EC2 default <strong>5-min</strong>; retention ladder 3 h / 15 d / 63 d / 15 months as resolution coarsens; custom metrics priced <em>per metric per month</em> (~0.30 USD first tier) plus PutMetricData API calls.</div>

<div class="callout war">The cardinality bill: a team adds a CustomerId dimension to four metrics in a service with 20,000 customers — that is 80,000 billable metric series, roughly 24,000 USD/month at list price, for data nobody graphs per customer. Dimensions are for dashboard-shaped slices (service, endpoint, AZ); anything user-shaped belongs in logs, queried with Logs Insights when needed.</div>
`
    },
    {
      id: "cw-alarms",
      title: "Alarms: states, missing data, composites, and anomaly detection",
      html: `
<p>A CloudWatch alarm is a small state machine evaluated against one metric (or one metric-math expression) over a sliding window. Its three states: <strong>OK</strong>, <strong>ALARM</strong>, and <strong>INSUFFICIENT_DATA</strong>. The third is not an error — it means the alarm does not have enough datapoints in the evaluation window to decide: a brand-new alarm, a stopped instance, a metric that only exists when events occur. Actions can be attached to transitions <em>into any of the three states</em>, and each action fires on the transition, not continuously while in the state.</p>

<h3>Evaluation mechanics</h3>
<p>You configure: the <strong>period</strong> (granularity of each datapoint bucket), <strong>evaluation periods</strong> (how many recent buckets to look at), and <strong>datapoints to alarm</strong> (how many of those must breach — the "M out of N" setting). M-of-N is the flap damper: 3 out of 3 requires sustained breach; 3 out of 5 tolerates gaps. Alarm actions: SNS topics (the routing hub — pager integrations subscribe there), EC2 actions (stop/terminate/reboot/recover — the StatusCheckFailed_System + recover pairing is the canonical self-healing pattern for host failures), Auto Scaling policies, and Systems Manager incident/OpsItem creation. Note EventBridge also sees every alarm state change, which is how you route alarms to anything SNS cannot reach.</p>

<h3>Missing-data treatment — the setting everyone discovers during an outage</h3>
<p>When a period has no datapoints, the alarm consults its <strong>TreatMissingData</strong> policy:</p>
<ul>
<li><strong>missing</strong> (default): gaps don't count; if the whole window is empty, the alarm goes INSUFFICIENT_DATA.</li>
<li><strong>notBreaching</strong>: gaps count as healthy — right for sparse metrics like error counts, where "no errors reported" genuinely means fine.</li>
<li><strong>breaching</strong>: gaps count as unhealthy — right when silence itself is the failure signal (a heartbeat metric: if the cron stopped publishing, that <em>is</em> the incident).</li>
<li><strong>ignore</strong>: keep the previous state until data returns.</li>
</ul>
<p>The trap scenario: a host dies, so it stops publishing the very metric that should have alarmed — with default settings the alarm sits in INSUFFICIENT_DATA and nobody is paged. Liveness-shaped alarms must use <strong>breaching</strong> (or alarm on the absence via a SampleCount expression). Conversely, an error-rate alarm with breaching treatment pages you every quiet night. This exact reasoning — pick the treatment matching the metric's semantics — is exam material.</p>

<h3>Composite alarms: cutting noise</h3>
<p>A <strong>composite alarm</strong> takes a boolean expression over other alarms' states — ALARM(cpu-high) AND ALARM(latency-high) — and only its own transitions trigger actions. Two jobs: <strong>noise reduction</strong> (page only when the user-facing symptom and a cause co-fire, instead of five pages for one incident) and <strong>suppression</strong> (a maintenance-mode alarm ANDed with NOT semantics, or using the suppressor-alarm feature to mute dependents while an upstream outage is already being handled). Composites take only notification/SSM actions — no EC2 or scaling actions — and they are the standard answer to "the on-call team receives dozens of related alarms during a single event."</p>

<h3>Anomaly detection: alarms without thresholds</h3>
<p><strong>Anomaly detection</strong> fits a model to a metric's history (trend plus daily/weekly seasonality) and draws a confidence band; the alarm fires when the metric leaves the band (above, below, or either). Use it where static thresholds are unanswerable: request volume with strong diurnal shape — a fixed "alert under 1,000 rpm" is wrong at 3 a.m. and useless at noon, while "below the expected band" catches a 40% traffic drop at any hour. Knobs: the band width multiplier (wider = fewer alerts), and exclusion windows so known anomalies (deploys, sales) don't pollute training. Limits of the approach a senior should say out loud: it needs history (new metrics train poorly), it will learn your slow degradations as normal, and step changes after launches produce a noisy re-training week. It complements — never replaces — SLO-derived static alarms.</p>

<div class="callout exam">Mappings: "instance fails system status check, recover automatically" → alarm on StatusCheckFailed_System with the EC2 recover action. "Reduce alert fatigue from many related alarms" → composite alarm. "Metric has predictable daily cycles, static threshold causes false alarms" → anomaly detection alarm. "Alarm never fired because the instance stopped sending data" → TreatMissingData=breaching. "Why is my new alarm INSUFFICIENT_DATA" → not enough datapoints yet; it is a state, not an error.</div>

<div class="callout war">Two production notes. First: alarm actions fire on <em>transition</em> — an alarm that went ALARM before the subscription/pager was wired will not re-fire until it leaves and re-enters ALARM; during incident response people stare at a red alarm wondering why no page came. Second: the EC2 recover action restores the instance onto healthy hardware with the same instance ID, private IP, and EBS volumes — but instance-store data is gone and it only covers <em>system</em> check failures (host-level); an OS wedge fails the instance check and needs reboot, not recover.</div>

<div class="callout limits">Alarm evaluation: up to M-of-N with N ≤ evaluation window limits; high-resolution alarms evaluate 10 s / 30 s periods at a higher price. Composite alarms: expressions over up to ~100 underlying alarms, notification/SSM actions only. Standard alarms ~0.10 USD/month each; anomaly-detection alarms cost roughly triple (they bill for the band computation).</div>
`
    },
    {
      id: "cw-logs",
      title: "CloudWatch Logs: routing, filters, Insights, and cross-account views",
      html: `
<p>CloudWatch Logs organizes everything as <strong>log groups</strong> (the unit of retention, encryption, and access policy) containing <strong>log streams</strong> (one ordered sequence per source — per Lambda environment, per container, per instance/agent path). Retention is set per group: <strong>default is Never Expire</strong>, configurable from 1 day to 10 years. That default is a slow-motion bill: ingested logs kept forever at ~0.03 USD/GB-month compounds quietly. Setting retention (or exporting to S3 and letting the group expire data) is the first thing a cost review finds.</p>

<h3>Getting logs in</h3>
<p>Lambda and many services are wired natively (Lambda needs only the logs:* permissions in its execution role — no agent). EC2 and on-prem hosts run the <strong>CloudWatch agent</strong>, configured by a JSON document (commonly stored in SSM Parameter Store and fetched at start) that declares which files to tail and which guest metrics (memory, disk) to publish — one agent, both jobs; its predecessor logs-only agent is deprecated. VPC Flow Logs, Route 53 query logs, RDS/redis engine logs, ECS awslogs driver, EKS control-plane logs all land in groups too. Everything is encrypted at rest by default; bring a KMS key per group when compliance asks.</p>

<h3>Metric filters vs subscription filters — the pair the exam loves to swap</h3>
<ul>
<li><strong>Metric filters</strong> turn matching log events into <em>CloudWatch metrics</em>: a filter pattern (term match, JSON field predicates like { $.level = "ERROR" }, or space-delimited patterns) increments a metric value on each match. Alarm on the resulting metric — the standard "page when ERROR appears more than N times in 5 minutes" build. Crucial property: metric filters apply <strong>from creation time onward only</strong> — they do not backfill over historical logs.</li>
<li><strong>Subscription filters</strong> stream matching log events <em>out</em> of the group in near-real time to exactly these destinations: <strong>Kinesis Data Streams, Amazon Data Firehose, or Lambda</strong> (and cross-account, to a Kinesis/Firehose destination in another account). This is the export/processing path: Firehose → S3 for the data lake, Lambda for real-time reaction, Kinesis for fan-in from thousands of groups into one processing pipeline. Up to two subscription filters per log group.</li>
</ul>
<p>Rule of thumb: want a <em>number</em> (to alarm or graph) → metric filter. Want the <em>events themselves</em> somewhere else → subscription filter. For bulk, non-real-time archival there is also <strong>export to S3</strong> (CreateExportTask) — batch, up to 12 h latency, fine for compliance dumps, wrong for pipelines.</p>

<h3>Logs Insights</h3>
<p><strong>Logs Insights</strong> is the interactive query engine: a purpose-built language (fields, filter, stats, parse, sort, limit) run over one or many log groups for a time range, billed <strong>per GB scanned</strong>. It discovers JSON fields automatically, so structured logging pays off directly. It is the right tool for investigation ("top 10 IPs by 5xx in the last hour across all ALB log groups"), and the wrong tool as a polling-based alerting mechanism — that is what metric filters are for, without the per-query scan charges. Saved queries and dashboard widgets make the good ones reusable.</p>

<h3>Cross-account and cross-region</h3>
<p>Modern setup: <strong>CloudWatch cross-account observability</strong> designates a <em>monitoring account</em> linked to source accounts (via OAM — observability access manager links); the monitoring account then natively queries metrics, log groups, and traces across all linked accounts — one pane, no data duplication. Dashboards have long supported cross-account/cross-region widgets, and CloudWatch metric streams can push metrics continuously (via Firehose) to a third-party or central store. For log <em>data</em> centralization (as opposed to query federation), the pattern remains subscription filters into a central account's Kinesis/Firehose. Exam tell: "single dashboard across 50 accounts without copying data" → cross-account observability with a monitoring account.</p>

<div class="callout exam">Discriminators: "create an alarm when a specific string appears in logs" → metric filter + alarm. "Stream logs to Amazon OpenSearch / S3 / a SIEM in near-real time" → subscription filter (to Firehose or Lambda). "Ad-hoc analysis of last week's logs" → Logs Insights. "EC2 memory metrics and application log files into CloudWatch" → the unified CloudWatch agent, config in SSM Parameter Store. "Logs must be retained 7 years at lowest cost" → set group retention short and export/stream to S3 (Glacier tiers), not Never Expire in Logs.</div>

<div class="callout war">The recursive-logging incident is real: a Lambda subscribed to a log group that its own invocations write to (directly, or via a chain) loops — each invocation produces logs, which trigger the subscription, which invokes the Lambda. CloudWatch now blocks the obvious self-subscription, but multi-hop cycles still happen; the symptom is a smooth exponential invocation graph and a five-figure daily bill. Filter patterns and reserved concurrency are your circuit breakers.</div>

<div class="callout limits">Ingestion ~0.50 USD/GB (the expensive part), storage ~0.03 USD/GB-month, Insights ~0.005 USD/GB scanned. Retention: 1 day–10 years or Never Expire (default). Two subscription filters per group. PutLogEvents batch max 1 MB; agent handles batching for you. Export-to-S3 tasks: one concurrent task per account, latency up to 12 h.</div>
`
    },
    {
      id: "cloudtrail",
      title: "CloudTrail: the audit log — events, trails, integrity, and Lake",
      html: `
<p>CloudTrail answers exactly one question: <strong>who called which API, on what, from where, when</strong>. Every control-plane call in AWS — console clicks included, since the console is an API client — produces a CloudTrail event containing the caller identity (down to the assumed-role session), source IP, user agent, request parameters, and response elements. Hold onto the triangle that organizes this whole module: <strong>CloudTrail = who did what (API audit), CloudWatch = what is happening (performance/behavior), Config = what changed state (resource configuration timeline)</strong>. A large fraction of observability questions are just asking which vertex owns the scenario.</p>

<h3>Event history vs trails</h3>
<p>Out of the box, every account gets <strong>90 days of management events</strong> queryable in the console/API as Event history — free, always on, per region. Anything beyond 90 days, or any automation, requires a <strong>trail</strong>: continuous delivery of events as compressed JSON to an S3 bucket (typically 5-15 minutes behind), optionally teed to a CloudWatch Logs group for metric-filter alerting ("alarm on ConsoleLogin without MFA," "alarm on DeleteTrail"). A trail can be single-region or all-region (<strong>always choose all-region</strong>: attackers use the regions you forgot), and an <strong>organization trail</strong> created in the management account automatically logs every member account into one bucket — members can see but not modify it. That is the audit backbone of a multi-account org, usually landing in a dedicated, locked-down log-archive account.</p>

<h3>Management vs data events — the cost split</h3>
<ul>
<li><strong>Management events</strong>: control-plane operations (RunInstances, PutBucketPolicy, CreateUser). On by default in every trail; the first copy is free.</li>
<li><strong>Data events</strong>: high-volume data-plane operations — <strong>S3 object-level</strong> calls (GetObject, PutObject, DeleteObject), <strong>Lambda Invoke</strong>, DynamoDB item-level operations, and more. <strong>Off by default</strong>, because volume and price are orders of magnitude higher (billed ~0.10 USD per 100k events). You enable them per trail with selectors — advanced event selectors can scope to specific buckets/prefixes or functions, which is how you afford them. The exam trap runs both directions: "we need a record of who read objects in this bucket" → enable S3 data events (a plain trail will NOT show GetObject); and "trail costs exploded" → someone enabled data events on a busy bucket without scoping.</li>
<li><strong>Insights events</strong>: optional anomaly detection on management-event rates (a spike in TerminateInstances calls) — useful, paid, occasionally an exam distractor.</li>
</ul>

<h3>Integrity and immutability</h3>
<p><strong>Log file integrity validation</strong> makes CloudTrail deliver hourly digest files: SHA-256 hashes of each log file, chained hash-to-hash and signed with a CloudTrail-controlled private key. The CLI (validate-logs) walks the chain and proves no delivered file was modified or deleted since delivery — the tamper-<em>evidence</em> story auditors ask for. Tamper-<em>resistance</em> is your bucket design: S3 Object Lock, a separate log-archive account, SCPs denying cloudtrail:StopLogging and DeleteTrail, and an alarm on both. Know the difference: validation detects tampering; the surrounding controls prevent it.</p>

<h3>CloudTrail Lake</h3>
<p><strong>CloudTrail Lake</strong> is the managed query path: an immutable event data store with <em>SQL</em> over years of events (retention configurable up to 3,653 days), ingesting CloudTrail events and optionally Config items and non-AWS sources. It replaces the classic self-managed pattern of trail → S3 → Athena table maintenance. Trade-off: Lake bills for ingestion plus per-TB scanned queries and costs more than raw S3 storage — the S3+Athena pattern is still the cost answer, Lake the convenience/immutability answer. For the SAA exam, recognize both as valid "query historical API activity" designs.</p>

<div class="callout exam">Keyword→vertex mapping drills: "who deleted the security group" / "which credentials made this call" → CloudTrail. "CPU is high / requests are slow" → CloudWatch. "was this bucket ever public, and when did it change" → Config. Combined patterns: "alert within minutes when a specific API call occurs" → CloudTrail to CloudWatch Logs + metric filter + alarm, or the EventBridge pattern (EventBridge receives management events directly — lower latency, no trail-to-logs wiring). "Retain audit logs 7 years, tamper-evident" → org trail to S3 with Object Lock + log file validation.</div>

<div class="callout war">Two lived gotchas. CloudTrail is <em>eventually</em> delivered: 5-15 minutes to S3 — build detection latency expectations accordingly, and use EventBridge for the near-real-time reactions. And read events carefully during forensics: the userIdentity of an assumed role shows the role session, not automatically the human — you correlate the AssumeRole event (with its source identity / MFA context) to name a person. Turning on sts:SourceIdentity enforcement earns its keep the first time you do this at 2 a.m.</div>

<div class="callout limits">Event history: 90 days, management events only, free. Trails: first copy of management events free; data events ~0.10 USD/100k, off by default; delivery latency typically ≤15 min. Org trails cover all member accounts, present and future. Lake retention up to 10 years; digest files hourly for integrity validation.</div>
`
    },
    {
      id: "aws-config",
      title: "AWS Config: the state timeline, rules, and auto-remediation",
      html: `
<p>AWS Config is a <strong>configuration version-control system for your resources</strong>: the recorder observes supported resource types and, on every change, writes a new <strong>configuration item</strong> — the resource's full state, its relationships (this ENI attaches to that instance in that subnet), and the CloudTrail event that caused the change. The result is a queryable timeline: what did this security group look like on March 3rd, when did it change, and who changed it (via the linked CloudTrail event). CloudTrail records the <em>call</em>; Config records the resulting <em>state</em> — the triangle's third vertex.</p>

<h3>The recorder</h3>
<p>Per region you enable a recorder, choosing all resource types (with automatic inclusion of new types) or a list, and a delivery channel to S3 (history/snapshots) plus optional SNS. Global resource types — IAM chiefly — should be recorded in exactly <em>one</em> region or you pay for duplicate configuration items in every region. Config is priced <strong>per configuration item recorded</strong> (~0.003 USD each) plus per rule evaluation — cheap for stable estates, real money for churny ones (autoscaling fleets cycling instances generate items on every launch/terminate; continuous-delivery churn multiplies it). Periodic recording (daily instead of on-change) exists now precisely to cap that cost for noisy types.</p>

<h3>Rules: compliance as code</h3>
<p>A <strong>Config rule</strong> evaluates resources and marks each COMPLIANT or NONCOMPLIANT. Triggers: <em>configuration change</em> (evaluate the changed resource immediately) and/or <em>periodic</em> (every 1-24 h). Two kinds:</p>
<ul>
<li><strong>Managed rules</strong> — hundreds prebuilt: s3-bucket-public-read-prohibited, encrypted-volumes, restricted-ssh, required-tags, rds-storage-encrypted… parameterizable, zero code.</li>
<li><strong>Custom rules</strong> — your logic, as a Lambda function receiving the configuration item, or as <strong>Guard</strong> policies (a declarative DSL, no Lambda to run).</li>
</ul>
<p>Understand what a rule is <em>not</em>: it is detective, not preventive. A noncompliant resource already exists; Config flags it after the fact. Prevention is IAM/SCP/permission-boundary territory. The exam distinguishes these sharply: "prevent anyone from creating public buckets" → SCP or S3 Block Public Access; "detect and report public buckets" → Config rule; "detect <em>and fix</em>" → the next paragraph.</p>

<h3>Auto-remediation via SSM</h3>
<p>Each rule can attach a <strong>remediation action</strong>: an <strong>SSM Automation document</strong> (runbook) executed against noncompliant resources — AWS-provided documents (AWS-DisablePublicAccessForSecurityGroup, AWSConfigRemediation-RemoveVPCDefaultSecurityGroupRules, documents to stop instances, enable bucket encryption, release EIPs…) or your own, running under an IAM role you supply, automatically or after manual approval, with retry settings. This is the closed loop: <em>record → evaluate → remediate</em>, and it is the exam's favorite Config pattern — "automatically revoke security group rules that allow 0.0.0.0/0 on port 22" → Config managed rule restricted-ssh + SSM remediation document. For anything richer (ticketing, chat notification, custom logic), Config compliance-change events flow through EventBridge to whatever you like.</p>

<h3>Conformance packs and aggregators</h3>
<p><strong>Conformance packs</strong> bundle rules plus remediations into a versioned YAML unit deployed as one — AWS ships packs mapped to frameworks (CIS, PCI DSS, NIST, HIPAA-eligible services), and org-level deployment pushes a pack to every member account. <strong>Aggregators</strong> solve the reading side: an aggregator in a central account collects configuration and compliance data from source accounts/regions (or the whole organization) into one queryable view — including <strong>advanced queries</strong>, a SQL-ish language over the aggregated inventory ("all EBS volumes unencrypted, org-wide"). Aggregators are read-only collection: rules still run in the source accounts; the aggregator just gathers results. Multi-account compliance dashboard → aggregator; multi-account rule <em>deployment</em> → org conformance packs (or CloudFormation StackSets).</p>

<div class="callout exam">Trigger phrases: "track configuration changes over time / point-in-time state of a resource" → Config. "Notified when a resource becomes noncompliant" → Config rule + SNS/EventBridge. "Automatically remediate" → Config + SSM Automation. "Compliance status across the entire organization in one dashboard" → Config aggregator. "Deploy a standard set of compliance rules to all accounts" → conformance packs. If the scenario says <em>prevent</em>, Config is the distractor — reach for SCPs.</div>

<div class="callout war">Config's failure mode is quiet coverage gaps: the recorder enabled in three regions of five, IAM recorded twice (double billing) or zero times, new resource types unticked in a hand-curated list. Enable via the org-level, all-types, IaC-managed path or expect the audit to find the hole before you do. Also watch remediation blast radius: an over-eager auto-remediation that strips security-group rules can take down a service faster than the misconfiguration would have — stage remediations as manual-approval first, automate after the runbook has scar tissue.</div>

<div class="callout limits">Pricing dimensions: per configuration item (~0.003 USD), per rule evaluation (~0.001 USD, tiered), conformance-pack evaluations billed separately. Rules per region: soft cap (historically 150, raisable). Periodic rule frequency: 1-24 h. Remediation: SSM Automation documents, auto or manual, with rate/retry controls.</div>
`
    },
    {
      id: "xray",
      title: "X-Ray: distributed tracing — segments, sampling, and the service map",
      html: `
<p>X-Ray is AWS's distributed tracing backend: the third pillar after metrics and logs, answering "where inside this request's journey did the time go, and which hop threw the error." If you know OpenTelemetry vocabulary, translate: an X-Ray <strong>trace</strong> is the end-to-end request; a <strong>segment</strong> is one service's span; <strong>subsegments</strong> are child spans (a DynamoDB call, an external HTTP call); the <strong>trace header</strong> (X-Amzn-Trace-Id) is the propagation context carrying the trace ID and the sampling decision. AWS's current strategic direction is OpenTelemetry (via the AWS Distro, ADOT) feeding X-Ray as a backend — instrument with OTel, store and view in X-Ray.</p>

<h3>How data gets there</h3>
<p>Application code instruments via the X-Ray SDK (auto-patching AWS SDK clients and HTTP libraries) and emits segment documents over UDP to a local <strong>X-Ray daemon</strong> (sidecar/agent), which batches and uploads — the UDP hop keeps tracing off your request's critical path; losing trace packets under pressure is by design preferable to slowing requests. Where the daemon lives: on EC2, a process you install; on <strong>ECS</strong>, a sidecar container (or built into Fargate platform tooling); on <strong>Lambda</strong>, nothing to install — enable Active Tracing on the function and the runtime ships segments for you (the IAM role needs the X-Ray write policy). <strong>API Gateway</strong> and <strong>ALB</strong> participate asymmetrically, and this nuance is exam-adjacent: ALB <em>propagates</em> the trace header but does not send segments to X-Ray; API Gateway (REST) supports active tracing and does emit segments. So a trace often begins at API Gateway, but never at an ALB.</p>

<h3>Sampling: why your bill and your traces are both sane</h3>
<p>Tracing everything at volume is pointless and expensive; X-Ray's default sampling rule is <strong>1 request per second per host, plus 5% of the excess</strong>. Sampling rules are centrally configurable (per service name, URL path, method) and pushed to daemons, so you can trace 100% of a rarely-hit payments path while sampling the health checks at ~0. The decision is made at the entry point and propagated in the trace header, so a request is either traced across all hops or not at all — consistent traces, no half-visible requests. Design consequence: X-Ray is a <em>statistical</em> debugging tool. For "find the one specific failed request from customer X," you correlate from logs (log the trace ID) rather than hoping the sampler caught it.</p>

<h3>Reading the output</h3>
<p>The <strong>service map</strong> renders the observed call graph — nodes per service, edges with latency histograms, error (4xx) and fault (5xx) rates — the fastest possible answer to "which dependency is on fire." Trace details show the waterfall per request. <strong>Groups</strong> (filter expressions over traces, e.g., service("checkout") AND fault) create scoped maps and emit CloudWatch metrics per group — bridging traces back into the alarming world. <strong>ServiceLens</strong> is the console unification of all three pillars: the service map annotated with metrics and one-click pivots to the exact logs and traces behind a spike. (Console branding shifts — ServiceLens features now largely live under Application Signals — but the exam-level concept is stable: the unified traces+metrics+logs view.) Annotations (indexed key-value pairs you add to segments, searchable in filter expressions) versus metadata (stored, not indexed) is worth knowing: put customer tier or order type in annotations to slice traces by business dimension.</p>

<div class="callout exam">Mappings: "identify which microservice in a chain causes latency" → X-Ray service map. "Trace requests end-to-end through API Gateway → Lambda → DynamoDB" → enable active tracing (API Gateway stage setting + Lambda function setting). "Trace only a subset to control cost" → sampling rules. "Debug a specific customer's failed request" → X-Ray alone is the wrong tool (sampling!) — pair logs with trace IDs. Options claiming ALB emits X-Ray segments are lies; it only forwards the header.</div>

<div class="callout war">The classic broken-trace bug: a service in the middle of the chain strips or regenerates the X-Amzn-Trace-Id header (hand-rolled HTTP clients, proxies with header allowlists), and the map splits into disconnected islands — each half looks healthy, the cross-island latency is invisible. When the service map shows two components you know call each other with no edge between them, go find who is eating the header. Second note: the daemon uploads in batches; a Fargate task that exits immediately after handling a request can drop its final segments — give sidecars a drain period.</div>

<div class="callout limits">Default sampling: 1 rps per host + 5% of excess, per-rule configurable. Segment document max 64 KB; trace ID propagation via X-Amzn-Trace-Id. Retention: 30 days of traces. Free tier ~100k traces recorded/month; beyond that per-million recorded/retrieved pricing. Lambda active tracing: per-invocation trace charges apply at scale.</div>
`
    },
    {
      id: "ops-automation-cost",
      title: "Operational automation, Trusted Advisor, Health — and what observability costs",
      html: `
<p>The last piece is wiring: turning all this telemetry into action, plus the two account-level services the exam sprinkles into monitoring questions — and the bill, because observability is routinely a top-five line item and the exam has started asking about it too.</p>

<h3>EventBridge as the automation backbone</h3>
<p>Nearly every service in this module emits state changes onto the default event bus, which makes EventBridge the glue for operational automation patterns worth recognizing on sight:</p>
<ul>
<li><strong>CloudWatch alarm state change → EventBridge rule → Lambda/SSM runbook</strong>: self-healing beyond the built-in EC2 actions — restart a service via SSM RunCommand, cycle a container, scale a queue consumer.</li>
<li><strong>CloudTrail-sourced API events → rule → response</strong>: "when anyone calls AuthorizeSecurityGroupIngress with 0.0.0.0/0, invoke a Lambda that revokes it and posts to Slack." Management events reach EventBridge with far lower latency than trail-to-S3 delivery — this is the near-real-time security reflex arc.</li>
<li><strong>Config compliance change → rule → ticket/notification</strong>: the notification half of compliance, complementing SSM auto-remediation.</li>
<li><strong>GuardDuty finding / Health event / EC2 state change → rule → automation</strong>: same shape, different sources.</li>
</ul>
<p>The pattern to name in answers: <em>detect (source service) → route (EventBridge rule) → act (Lambda or SSM Automation) → notify (SNS)</em>. When an option hand-rolls polling ("a Lambda on a 5-minute schedule scans for X"), the event-driven option beats it on latency, cost, and marks.</p>

<h3>Trusted Advisor</h3>
<p>Trusted Advisor is AWS inspecting your account against best-practice checks in five classic categories — <strong>cost optimization, performance, security, fault tolerance, service limits</strong> (the console now presents an operational-excellence pillar too). Core mechanics for the exam: a handful of checks (security basics like open security groups on specific ports, MFA on root, public S3 snapshots, plus service-limit checks) are free for everyone; the <strong>full suite requires Business or Enterprise Support</strong>. Checks refresh periodically or on demand; results integrate with EventBridge for automation. Classic exam discriminations: "warn as we approach service quotas" → Trusted Advisor service-limits check (or the newer Service Quotas + CloudWatch usage-metric alarms); "identify idle RDS instances / underutilized EBS volumes for cost savings" → Trusted Advisor cost checks (with Compute Optimizer as the rightsizing sibling for EC2/Lambda). Trusted Advisor advises on <em>your usage</em>; it does not monitor application health.</p>

<h3>Health Dashboard</h3>
<p>Two distinct things share the Health name. The public <strong>Service Health Dashboard</strong> is status-page-for-everyone. <strong>AWS Health / your Personal Health Dashboard</strong> is account-specific: events affecting <em>your</em> resources — an EC2 host scheduled for retirement, an EBS volume degraded, a maintenance window for your RDS instance, a service issue in a region you actually use. The operational pattern: <strong>Health events → EventBridge rule → automation or paging</strong> — e.g., instance-retirement notices auto-open a ticket or trigger a graceful drain-and-replace. Organization view (with Business/Enterprise support) aggregates Health across all accounts. Exam tell: "be notified when AWS schedules maintenance affecting your instances, and automate the response" → AWS Health + EventBridge, not polling a status page.</p>

<h3>The cost of observability — the surprises</h3>
<p>Where monitoring bills actually come from, in rough order of "surprise at review time":</p>
<table>
<thead><tr><th>Line item</th><th>Pricing shape</th><th>The surprise</th></tr></thead>
<tbody>
<tr><td>CloudWatch Logs ingestion</td><td>~0.50 USD/GB ingested</td><td>Debug logging at scale; a chatty fleet ingesting 10 TB/month is ~5,000 USD before storing a byte</td></tr>
<tr><td>Custom metrics</td><td>~0.30 USD/metric/month, tiered</td><td>Cardinality: every unique dimension combo is a metric; per-customer dimensions explode it</td></tr>
<tr><td>Logs storage</td><td>~0.03 USD/GB-month</td><td>Never Expire default retention compounding for years</td></tr>
<tr><td>Logs Insights</td><td>~0.005 USD/GB scanned</td><td>Dashboards refreshing broad queries every minute scan the same GBs all day</td></tr>
<tr><td>CloudTrail data events</td><td>~0.10 USD/100k events</td><td>Enabled unscoped on a hot S3 bucket or busy Lambda</td></tr>
<tr><td>Config items</td><td>~0.003 USD/item</td><td>Autoscaling churn: every instance launch/terminate writes items</td></tr>
<tr><td>Alarms, dashboards, synthetics</td><td>per alarm/dashboard/run</td><td>Thousands of per-resource alarms created by automation nobody prunes</td></tr>
</tbody>
</table>
<p>Levers, in the order to pull them: set log retention everywhere (or stream to S3 and expire in Logs); log structured and sample debug levels; audit metric cardinality; scope CloudTrail data-event selectors; use metric filters instead of scheduled Insights queries for anything alarm-shaped; and put a cost-allocation tag on observability resources so the bill has names attached.</p>

<div class="callout exam">Composite scenario mappings: "react automatically within minutes to a specific API call" → EventBridge rule on the management event → Lambda/SSM. "Approaching EC2 service limits, want proactive warning" → Trusted Advisor (Business/Enterprise for the full checks). "Automate response to scheduled hardware maintenance" → Health + EventBridge. "Reduce a large CloudWatch bill" → retention policies, metric cardinality, and data-event scoping — the answer that names a specific pricing dimension usually wins.</div>

<div class="callout war">The meta-lesson from real bills: observability costs fail silently in the direction of more. Nobody gets paged when log ingestion doubles; the platform happily absorbs it. Treat telemetry budgets like error budgets — an alarm on the CloudWatch bill itself (Billing metrics + a cost anomaly monitor) is the observability system watching the observability system, and it has paid for itself in every org I have seen adopt it.</div>
`
    }
  ],
  quiz: [
    {
      q: "An operations team must trigger an Auto Scaling action when average memory utilization across an EC2 fleet exceeds 80%. They enabled detailed monitoring but the memory metric does not appear in CloudWatch. Why, and what is the fix?",
      options: [
        "Detailed monitoring only applies to Auto Scaling groups, not individual instances; enable group metrics instead",
        "Memory is a guest-OS metric invisible to the hypervisor; install and configure the CloudWatch agent to publish memory utilization as a custom metric, then alarm on it",
        "Memory metrics require high-resolution custom metrics; re-enable detailed monitoring with a 1-second period",
        "The instances lack an IAM role permitting cloudwatch:GetMetricData; attach the role and the metric will appear"
      ],
      answer: [1],
      multi: false,
      explanation: "EC2's native metrics come from the hypervisor, which cannot see inside the guest: CPU, disk I/O, and network are visible; memory, disk space, and swap are not. The CloudWatch agent (or PutMetricData) inside the instance is the only way to get memory metrics — published to a custom namespace, usable in alarms and scaling policies. <strong>A</strong> misstates detailed monitoring: it raises native-metric frequency to 1 minute for instances; it never adds new metrics. <strong>C</strong> mixes concepts — resolution has nothing to do with which metrics exist. <strong>D</strong> names the wrong permission and direction: publishing needs cloudwatch:PutMetricData from the agent, and no role change conjures a metric the hypervisor never emits."
    },
    {
      q: "A nightly batch job publishes a heartbeat metric each time it completes. The team wants to be paged if the job fails to run. They created an alarm on the heartbeat metric with default settings, but when the scheduler broke for three days, no alarm fired. What went wrong?",
      options: [
        "The alarm's TreatMissingData setting defaulted to missing, so absent datapoints left it in INSUFFICIENT_DATA; it should be set to breaching so silence triggers the alarm",
        "The metric expired because CloudWatch deletes unused metrics after 24 hours",
        "Alarms cannot monitor custom metrics; the heartbeat must be an AWS service metric",
        "The alarm was in the wrong region"
      ],
      answer: [0],
      multi: false,
      explanation: "A dead publisher produces no datapoints, and with the default TreatMissingData=missing, empty periods do not count as breaches — the alarm drifts to INSUFFICIENT_DATA and no ALARM transition ever occurs. For liveness/heartbeat semantics, missing data IS the failure: set TreatMissingData=breaching (or alarm on a SampleCount-based expression). <strong>B</strong> is false — metrics linger (they stop receiving data but history remains per the retention ladder); nothing deletes them in 24 h. <strong>C</strong> is false — alarms work identically on custom metrics. <strong>D</strong> is a non-explanation the scenario gives no evidence for; the described behavior is precisely the missing-data default."
    },
    {
      q: "During incidents, the on-call engineer receives 15-20 separate CloudWatch alarm notifications generated by one underlying failure, causing pages to be ignored. Which approach best reduces this noise while preserving detection?",
      options: [
        "Increase every alarm's threshold by 50%",
        "Create composite alarms that combine related alarms with boolean logic, paging only on the composite's transition, and use suppressor relationships during known outages",
        "Change all alarms' TreatMissingData to ignore",
        "Route all alarms into a single SNS topic so only one email arrives"
      ],
      answer: [1],
      multi: false,
      explanation: "Composite alarms exist for exactly this: express 'page when the user-facing symptom AND a cause alarm co-fire' (or OR-groups per subsystem), attach notification actions only to the composite, and let member alarms remain visible-but-silent detail. Suppressor alarms mute dependents while an acknowledged upstream outage is in progress. <strong>A</strong> reduces noise by reducing detection — you will miss real incidents. <strong>C</strong> misuses a missing-data setting to solve a correlation problem; it changes nothing about 20 alarms firing together. <strong>D</strong> merges delivery, not signal: one topic still emits 20 notifications, and consolidating emails does not deduplicate pages in any real paging tool."
    },
    {
      q: "A security team requires: (1) an alert within a few minutes whenever an IAM policy is changed, and (2) all API activity retained for 5 years in a tamper-evident form. Which combination satisfies both? (Select TWO.)",
      options: [
        "An EventBridge rule matching the IAM management events, targeting SNS for notification",
        "CloudTrail Event history, which retains events indefinitely by default",
        "An organization trail delivering to an S3 bucket with Object Lock and log file integrity validation enabled",
        "A CloudWatch Logs subscription filter on VPC Flow Logs",
        "AWS Config with a conformance pack for IAM"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<strong>A</strong> covers the alerting: IAM changes are management events that reach EventBridge in near-real time — a rule on the event pattern (eventSource iam.amazonaws.com, PutRolePolicy etc.) to SNS beats waiting on trail delivery to S3. (The trail + CW Logs + metric filter route also works but is slower and more wiring.) <strong>C</strong> covers retention: a trail to S3 gives indefinite storage; Object Lock provides tamper-resistance and digest-based integrity validation provides tamper-evidence — the 5-year audit answer. <strong>B</strong> fails: Event history keeps only 90 days. <strong>D</strong> monitors network flows, not API calls. <strong>E</strong> tracks configuration compliance state — useful, but it neither alerts on the API call within minutes as directly nor archives all API activity."
    },
    {
      q: "Auditors ask which principals downloaded objects from a sensitive S3 bucket over the past quarter. The account has an all-region CloudTrail trail with default settings and 1 year of S3 retention. The GetObject calls do not appear anywhere. Why?",
      options: [
        "GetObject calls are data events, which are off by default; the trail needed data-event logging scoped to that bucket enabled in advance",
        "The trail is single-region and the bucket is in another region",
        "CloudTrail cannot log S3 activity; S3 server access logs are the only option",
        "The events exist but only in CloudTrail Lake"
      ],
      answer: [0],
      multi: false,
      explanation: "Object-level S3 operations (GetObject, PutObject, DeleteObject) are <strong>data events</strong> — excluded from every trail by default because of their volume and cost. They must be enabled explicitly (ideally scoped via advanced event selectors to the sensitive bucket to control cost), and only from that moment forward: there is no retroactive capture, which is exactly the audit lesson here. <strong>B</strong> contradicts the stated all-region trail. <strong>C</strong> is false — CloudTrail data events do cover S3 object activity (server access logs are an alternative with different fidelity/latency, not the only option). <strong>D</strong> is false — Lake is an optional query store; nothing lands there or anywhere else unless data-event ingestion was configured."
    },
    {
      q: "A company must detect security groups that allow inbound 0.0.0.0/0 on port 22 across all accounts in its organization, automatically remove the offending rules, and see org-wide compliance in one dashboard. Which combination is correct?",
      options: [
        "AWS Config managed rule restricted-ssh in each account with an SSM Automation remediation document, plus an organization-wide Config aggregator in a central account",
        "A CloudWatch alarm on the VPC Flow Logs metric for port 22, invoking a Lambda function",
        "An SCP in the management account denying port 22 ingress rules, with CloudTrail Lake for the dashboard",
        "Trusted Advisor security checks with EventBridge forwarding to each account"
      ],
      answer: [0],
      multi: false,
      explanation: "Three requirements, three Config features: detection → the managed restricted-ssh rule evaluating on configuration change; automatic fix → an SSM Automation remediation action (e.g., the AWS-provided disable-public-SG-access document) attached to the rule; org-wide visibility → an aggregator collecting compliance results from all accounts into one view (deploy the rules everywhere via org conformance packs or StackSets). <strong>B</strong> watches traffic, not configuration — a rule with no traffic is still noncompliant, and Flow Logs produce no such metric natively. <strong>C</strong> misunderstands SCPs: they cannot express 'deny rules containing 0.0.0.0/0 on 22' (no condition keys inspect rule contents that way), and prevention was not what was asked — remediation of existing rules was. <strong>D</strong>: Trusted Advisor has a related check but offers no auto-remediation and is not the org compliance dashboard."
    },
    {
      q: "An application emits log lines like ERROR PaymentDeclined orderId=123. The team wants (1) a page when more than 50 such errors occur in 5 minutes, and (2) every matching event delivered in near-real time to an existing security data lake in S3. Which pair of mechanisms fits?",
      options: [
        "A metric filter creating a metric for the pattern with a CloudWatch alarm; and a subscription filter streaming matching events through Amazon Data Firehose to S3",
        "Two subscription filters, one to CloudWatch and one to S3",
        "A Logs Insights scheduled query for the alarm, and S3 export tasks every minute for delivery",
        "An EventBridge rule matching the log line content, targeting SNS and S3"
      ],
      answer: [0],
      multi: false,
      explanation: "This is the metric-filter vs subscription-filter discrimination in one scenario: want a <em>number to alarm on</em> → metric filter (pattern-matched events increment a metric; alarm at &gt;50 per 5 min); want the <em>events themselves</em> elsewhere in near-real time → subscription filter, whose valid destinations are Kinesis Data Streams, Firehose, or Lambda — Firehose to S3 being the standard lake delivery. <strong>B</strong> is malformed: subscription filters cannot target CloudWatch metrics or S3 directly, and groups allow limited filters — the metric side needs a metric filter. <strong>C</strong> abuses Insights (per-GB-scanned polling for alerting) and export tasks (batch, up to 12 h latency, one concurrent task) for a real-time job. <strong>D</strong>: EventBridge does not match on CloudWatch Logs content and has no native S3 log-delivery target."
    },
    {
      q: "A microservices application spans API Gateway, several Lambda functions, and DynamoDB. Users report intermittent slow requests. The team needs to identify which component contributes the latency, per request, with minimal code changes. What should they do?",
      options: [
        "Enable X-Ray active tracing on the API Gateway stage and the Lambda functions, and inspect the service map and trace waterfalls",
        "Enable VPC Flow Logs on all subnets and analyze inter-service latency",
        "Add high-resolution custom metrics timing each handler section",
        "Enable CloudTrail data events for Lambda and query the durations in Athena"
      ],
      answer: [0],
      multi: false,
      explanation: "This is X-Ray's core use case: active tracing on the API Gateway stage plus a checkbox on each Lambda (no code changes; the SDK auto-captures the DynamoDB subsegments if the AWS SDK is instrumented, and Lambda's built-in tracing covers the invoke) produces per-request waterfalls and a service map with latency distributions per node — the 'which hop is slow' answer by design. <strong>B</strong> sees packets between ENIs; API Gateway and Lambda internals never appear, and there is no per-request application view. <strong>C</strong> can work but is exactly the code-change effort the question excludes, and metrics aggregate away the per-request story. <strong>D</strong>: CloudTrail records that Invoke was called (who/when), not execution latency breakdowns — wrong triangle vertex."
    },
    {
      q: "A fintech runs 40 AWS accounts. The platform team wants engineers in a central account to query CloudWatch metrics and Logs Insights across all accounts from one console without duplicating or forwarding the underlying data. What is the recommended setup?",
      options: [
        "Subscription filters in every account streaming all logs to the central account",
        "CloudWatch cross-account observability: designate the central account as a monitoring account and link the 39 source accounts via OAM",
        "An IAM role in each account that engineers assume one at a time",
        "CloudTrail organization trail delivering to the central account"
      ],
      answer: [1],
      multi: false,
      explanation: "Cross-account observability is purpose-built: source accounts create OAM links sharing metrics, logs, and traces with a designated monitoring account, whose console and APIs then query across all of them natively — federation, not duplication. <strong>A</strong> copies every log event (paying ingestion again and standing up Kinesis/Firehose plumbing) when the requirement explicitly excludes duplicating data — subscription filters are the right tool for <em>processing pipelines</em>, not console federation. <strong>C</strong> 'works' at the cost of 39 role-hops and no unified dashboards or cross-account queries — the workflow the feature exists to kill. <strong>D</strong> centralizes API audit logs; it has nothing to do with CloudWatch metrics or Logs Insights."
    },
    {
      q: "The finance team flags that the CloudWatch bill tripled this quarter. Investigation shows: log groups with Never Expire retention ingesting debug logs, a dashboard running broad Logs Insights queries on 1-minute auto-refresh, and application metrics published with a per-customer dimension. Which THREE changes most directly cut the bill? (Select THREE.)",
      options: [
        "Set retention policies on log groups and reduce debug-level ingestion",
        "Replace the auto-refreshing Insights dashboard widgets with metric filters feeding standard metric widgets",
        "Remove the per-customer dimension, moving customer-level detail into structured logs queried on demand",
        "Enable detailed monitoring on all EC2 instances",
        "Convert all standard alarms to high-resolution alarms",
        "Enable CloudTrail Insights events"
      ],
      answer: [0, 1, 2],
      multi: true,
      explanation: "The three findings map to the three big pricing dimensions. <strong>A</strong>: ingestion (~0.50 USD/GB) and storage (~0.03/GB-mo) both fall — retention caps the compounding and less debug logging cuts the dominant ingestion line. <strong>B</strong>: Insights bills per GB scanned; a 1-minute auto-refresh rescans the same data hundreds of times daily — a metric filter computes the number once at ingestion, free to graph thereafter. <strong>C</strong>: each unique dimension combination is a billable custom metric, so per-customer dimensions multiply metric count by customer count; logs + on-demand queries are the cardinality-safe home for that detail. <strong>D</strong>, <strong>E</strong>, and <strong>F</strong> all <em>increase</em> spend — detailed monitoring, high-resolution alarms, and Insights events are paid upgrades irrelevant to the findings."
    },
    {
      q: "An EC2 instance's underlying host is scheduled for retirement by AWS. The operations team wants automatic advance notification tied to the specific instance and an automated runbook to drain and replace it. Which service combination provides this?",
      options: [
        "AWS Health events routed through an EventBridge rule to an SSM Automation runbook and SNS notification",
        "The public Service Health Dashboard checked by a scheduled Lambda",
        "CloudWatch StatusCheckFailed alarms with the recover action",
        "Trusted Advisor fault-tolerance checks with weekly email"
      ],
      answer: [0],
      multi: false,
      explanation: "Scheduled host retirements are exactly what AWS Health (the account-specific Personal Health Dashboard data) emits: events naming your affected instance, in advance. Routing Health events through EventBridge to SSM Automation (drain, deregister, replace) plus SNS is the canonical proactive-maintenance pattern. <strong>B</strong> watches the public status page — region/service level, never your specific instance, and polling loses to events. <strong>C</strong> is reactive: status-check alarms fire when the host has already failed; the recover action is the right tool for unexpected failure, not scheduled retirement. <strong>D</strong> surfaces best-practice findings on a cadence — not instance-specific maintenance schedules, and weekly email is not automation."
    },
    {
      q: "A team needs request tracing for a high-volume API (20,000 requests/second) but is concerned about tracing cost. They also must guarantee that every request to the low-volume /payments path is traced. How should X-Ray be configured?",
      options: [
        "Rely on the default sampling rule for everything",
        "Create a sampling rule matching the /payments path with a 100% fixed rate, and keep a low reservoir-plus-percentage rule for all other paths",
        "Disable sampling so every request is traced, and cap costs with a budget alarm",
        "Trace only in the development environment and extrapolate to production"
      ],
      answer: [1],
      multi: false,
      explanation: "X-Ray's centrally managed sampling rules match on service, path, and method with priorities: a /payments rule at 100% guarantees full coverage of the critical low-volume path, while the catch-all rule (reservoir of N per second plus a small percentage) keeps the 20k rps firehose statistically sampled and affordable. This split-rule design is precisely why rules are configurable per path. <strong>A</strong> fails the guarantee: the default (1 rps + 5%) will miss many payment requests. <strong>C</strong> traces 1.7 billion requests a day — the budget alarm reports the fire, it does not prevent it. <strong>D</strong> is not observability; production behavior (real latencies, real dependencies, real failures) is the thing being traced."
    },
    {
      q: "Compliance requires proof that CloudTrail log files delivered to S3 have not been modified or deleted since delivery. Which feature provides this, and how does it work?",
      options: [
        "S3 Versioning, which preserves prior copies of modified log files",
        "CloudTrail log file integrity validation, which delivers hourly digest files containing SHA-256 hashes of each log file, chained and signed, verifiable via the CLI",
        "SSE-KMS encryption on the bucket, which prevents modification",
        "MFA Delete on the bucket"
      ],
      answer: [1],
      multi: false,
      explanation: "Integrity validation is the tamper-<em>evidence</em> mechanism: each hour CloudTrail writes a digest file with the SHA-256 hash of every delivered log file, hash-chains it to the previous digest, and signs it with a CloudTrail-held private key; validate-logs walks the chain and flags any modified, deleted, or missing file. <strong>A</strong> preserves versions but proves nothing — an actor with access can delete versions, and versioning offers no cryptographic attestation. <strong>C</strong> protects confidentiality at rest; anyone with write permission can still overwrite objects — encryption is not integrity. <strong>D</strong> raises the bar for deletions only, silently does nothing about modification, and again provides no proof. (Pair validation with Object Lock and a separate account for tamper-<em>resistance</em>.)"
    },
    {
      q: "A resource was modified last Tuesday, breaking connectivity. The team needs to see exactly how the security group's rules differed before and after the change, and which API call caused it. Which service provides this view directly?",
      options: [
        "AWS Config, via the resource timeline showing each configuration item diff with the related CloudTrail event linked",
        "CloudWatch Logs Insights over VPC Flow Logs",
        "AWS Systems Manager Inventory",
        "CloudTrail Event history alone"
      ],
      answer: [0],
      multi: false,
      explanation: "This is the Config vertex of the triangle: the recorder wrote a configuration item at each change, so the resource timeline shows the before/after rule sets as a diff, with the causing CloudTrail event ID linked — state history plus attribution in one view. <strong>B</strong> shows traffic effects (accepted/rejected flows), never configuration contents. <strong>C</strong> inventories software and OS data on managed instances — unrelated to security group rules. <strong>D</strong> is the tempting near-miss: CloudTrail shows the AuthorizeSecurityGroupIngress/Revoke call and its parameters, but reconstructing full before/after state means replaying every historical call yourself — Config exists precisely to materialize that state timeline."
    },
    {
      q: "Which tasks are Trusted Advisor checks suited for? (Select TWO.)",
      options: [
        "Flagging that an account is approaching its service quota for running EC2 instances",
        "Identifying idle load balancers and underutilized EBS volumes to reduce spend",
        "Tracing a request across microservices to find latency",
        "Recording configuration changes of IAM roles over time",
        "Alerting when application error logs exceed a threshold"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<strong>A</strong> is the service-limits category — one of Trusted Advisor's five classic check families, and the standard answer for proactive quota warnings (alongside Service Quotas usage alarms). <strong>B</strong> is the cost-optimization category: idle/underutilized resource checks (full suite requires Business or Enterprise support). <strong>C</strong> is X-Ray's job — Trusted Advisor never looks at requests. <strong>D</strong> is AWS Config's job — the configuration timeline. <strong>E</strong> is CloudWatch's job — metric filters and alarms. The wrong options are the other vertices of the observability toolbox, which is exactly how the exam frames Trusted Advisor questions: know what it advises on (account best practices) versus what monitors workloads."
    }
  ],
  flashcards: [
    { front: "What constitutes a CloudWatch metric's identity?", back: "Namespace + metric name + the <strong>complete set of dimensions</strong>. Different dimension sets = different time series; you cannot re-aggregate across them at query time unless the aggregate series was also published. Every unique combination is a separately billed custom metric." },
    { front: "EC2 default vs detailed monitoring vs high-resolution metrics", back: "Default: 5-minute, free. Detailed: same metrics at <strong>1-minute</strong>, paid — frequency only, no new metrics. High-resolution: <strong>custom metrics only</strong>, down to 1-second, alarm periods of 10/30 s." },
    { front: "Which EC2 metrics are missing by default, and why?", back: "<strong>Memory utilization, disk space, swap</strong> — the hypervisor cannot see inside the guest OS. Requires the CloudWatch agent (custom namespace, e.g., CWAgent). Classic exam trap: detailed monitoring does NOT add them." },
    { front: "What is Embedded Metric Format (EMF)?", back: "Write metrics as structured JSON log lines (with an _aws block); CloudWatch Logs extracts them into metrics asynchronously. One write yields metric + queryable log event; no PutMetricData on the hot path. Recommended for Lambda." },
    { front: "CloudWatch metric retention ladder", back: "Sub-minute: 3 hours → 1-minute: 15 days → 5-minute: 63 days → 1-hour: <strong>15 months</strong>. Data ages into coarser resolution; you cannot get last month at 1-second granularity." },
    { front: "The three CloudWatch alarm states", back: "OK, ALARM, and <strong>INSUFFICIENT_DATA</strong> — the last means not enough datapoints to decide (new alarm, stopped source), not an error. Actions fire on state <em>transitions</em>, not continuously." },
    { front: "TreatMissingData options and when each is right", back: "<strong>missing</strong> (default; gaps ignored), <strong>notBreaching</strong> (sparse metrics like error counts), <strong>breaching</strong> (heartbeats — silence IS failure), <strong>ignore</strong> (hold state). Liveness alarms must use breaching or they sit INSUFFICIENT_DATA when the source dies." },
    { front: "What are composite alarms for, and their key limitation?", back: "Boolean expressions over other alarms (AND/OR/NOT) to page once per incident and suppress dependents — the alert-fatigue answer. Limitation: notification/SSM actions only — no EC2 or Auto Scaling actions." },
    { front: "When to use CloudWatch anomaly detection alarms?", back: "Metrics with predictable trend/seasonality (diurnal traffic) where static thresholds are wrong at some hour. Model draws a confidence band; alarm on leaving it. Needs history to train; complements, never replaces, SLO thresholds." },
    { front: "Metric filter vs subscription filter", back: "<strong>Metric filter</strong>: log pattern → CloudWatch metric (to graph/alarm); applies from creation onward, no backfill. <strong>Subscription filter</strong>: streams matching events near-real-time to <strong>Kinesis, Firehose, or Lambda</strong> (cross-account supported); max two per group." },
    { front: "Default CloudWatch Logs retention — and the catch", back: "<strong>Never Expire.</strong> Ingestion (~0.50 USD/GB) plus storage compounding forever is a classic silent cost. Set per-group retention (1 day–10 years) or stream to S3 and expire in Logs." },
    { front: "CloudTrail vs CloudWatch vs Config — the exam triangle", back: "<strong>CloudTrail</strong>: who did what (API audit). <strong>CloudWatch</strong>: what is happening (metrics/logs/alarms). <strong>Config</strong>: what changed state (configuration timeline with diffs, linked to the causing CloudTrail event)." },
    { front: "CloudTrail Event history — scope and retention?", back: "<strong>90 days</strong>, management events only, always on, free, per region. Anything longer or automated requires a trail delivering to S3 (optionally to CloudWatch Logs)." },
    { front: "CloudTrail management vs data events", back: "Management (control plane: RunInstances, PutBucketPolicy): on by default, first trail copy free. Data events (S3 object-level, Lambda Invoke, DynamoDB items): <strong>off by default</strong>, high volume, ~0.10 USD/100k — enable with scoped advanced event selectors." },
    { front: "How does CloudTrail log file integrity validation work?", back: "Hourly <strong>digest files</strong>: SHA-256 hashes of each delivered log file, hash-chained and signed by CloudTrail's private key; verify with the CLI. Tamper-<em>evidence</em>. Pair with Object Lock/separate account/SCPs for tamper-<em>resistance</em>." },
    { front: "What is an organization trail?", back: "A trail created in the management account that automatically logs <strong>all member accounts</strong> (current and future) to one S3 bucket; members can view but not alter it. The multi-account audit backbone, usually landing in a log-archive account." },
    { front: "What is CloudTrail Lake?", back: "Managed immutable event data store with <strong>SQL queries</strong> over up to ~10 years of events (plus Config items and external sources). Replaces DIY trail→S3→Athena; costs more — S3+Athena remains the budget option." },
    { front: "AWS Config rules: what they can and cannot do", back: "Detective compliance: evaluate resources COMPLIANT/NONCOMPLIANT on change or periodically (managed rules or custom Lambda/Guard). They do NOT prevent anything — prevention is SCP/IAM. Fixing = attached SSM Automation remediation." },
    { front: "Config auto-remediation — the mechanism?", back: "A rule's remediation action runs an <strong>SSM Automation document</strong> (AWS-provided or custom) against noncompliant resources, under a role you supply, automatic or manual-approval, with retries. Record → evaluate → remediate." },
    { front: "Config conformance packs vs aggregators", back: "<strong>Conformance packs</strong>: deployable YAML bundles of rules+remediations (CIS/PCI/NIST templates), org-deployable — the <em>write</em> side. <strong>Aggregators</strong>: central read-only collection of config+compliance data across accounts/regions with advanced (SQL-ish) queries — the <em>read</em> side." },
    { front: "X-Ray vocabulary mapped to OpenTelemetry", back: "Trace = end-to-end request; segment = a service's span; subsegment = child span (DB/HTTP call); X-Amzn-Trace-Id header = propagated context carrying the sampling decision. ADOT (OTel distro) can feed X-Ray as backend." },
    { front: "X-Ray default sampling rule", back: "<strong>1 request/second per host (reservoir) + 5% of the excess.</strong> Centrally configurable per service/path/method — e.g., 100% on a critical low-volume path. Decision made at entry, propagated: traces are all-or-nothing across hops." },
    { front: "X-Ray and load balancers / API Gateway — who emits segments?", back: "<strong>API Gateway (REST)</strong>: supports active tracing, emits segments. <strong>ALB</strong>: only <em>propagates</em> the trace header — it never sends segments to X-Ray. Lambda: enable active tracing per function, no agent needed." },
    { front: "Trusted Advisor: categories and the support-tier catch", back: "Cost optimization, performance, security, fault tolerance, <strong>service limits</strong>. Core security + limits checks free; the full suite needs <strong>Business or Enterprise Support</strong>. Advises on account best practices — does not monitor workloads." },
    { front: "AWS Health vs the public status page — and the automation pattern", back: "AWS Health (Personal Health Dashboard) is account-specific: events for <em>your</em> resources (host retirement, degraded volume, maintenance). Pattern: Health event → EventBridge rule → SSM/Lambda runbook + SNS. Public dashboard = everyone's status page." },
    { front: "Top observability cost surprises (name three)", back: "Logs <strong>ingestion</strong> (~0.50 USD/GB — debug logging at scale), custom-metric <strong>cardinality</strong> (every dimension combo bills), Never Expire retention, Insights dashboards rescanning per refresh, unscoped CloudTrail data events, Config item churn from autoscaling." }
  ],
  lab: {
    title: "Lab: logs-to-alarm pipeline — metric filter, heartbeat alarm, and missing-data semantics",
    html: `
<h3>Goal</h3>
<p>Build the two alarm patterns this module drills: (1) an error-rate alarm fed by a metric filter over a log group, and (2) a heartbeat alarm that fires on <em>silence</em> using TreatMissingData=breaching. You will publish log events and custom metrics from the CLI — no instances needed — and watch both alarms transition. Cost: fractions of a cent (two alarms for under an hour, a few KB of logs). Region assumed us-east-1.</p>

<h3>Architecture</h3>
<p>A log group <code>lab-app-logs</code> receives JSON app logs via the CLI. A metric filter extracts ERROR events into a custom metric LabApp/Errors, with an alarm at &gt;=3 errors per minute. Separately, a heartbeat metric LabApp/Heartbeat is published each minute; its alarm treats missing data as breaching, so stopping the publisher triggers it.</p>

<h3>Steps</h3>
<ol>
<li><p>Create the log group (with retention, because we practice what we preach) and a stream:</p>
<pre><code>aws logs create-log-group --log-group-name lab-app-logs
aws logs put-retention-policy --log-group-name lab-app-logs --retention-in-days 1
aws logs create-log-stream --log-group-name lab-app-logs --log-stream-name host-1</code></pre></li>

<li><p>Create the metric filter: match JSON events whose level field is ERROR:</p>
<pre><code>aws logs put-metric-filter --log-group-name lab-app-logs \
  --filter-name error-count \
  --filter-pattern '{ $.level = "ERROR" }' \
  --metric-transformations \
  metricName=ErrorCount,metricNamespace=LabApp,metricValue=1,defaultValue=0</code></pre></li>

<li><p>Create the error alarm — 3+ errors within one 60 s period. Note notBreaching for missing data: quiet minutes are healthy for an error metric:</p>
<pre><code>aws cloudwatch put-metric-alarm --alarm-name lab-error-rate \
  --namespace LabApp --metric-name ErrorCount \
  --statistic Sum --period 60 --evaluation-periods 1 \
  --threshold 3 --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching</code></pre></li>

<li><p>Create the heartbeat alarm — SampleCount of the heartbeat metric below 1 means the publisher died. Missing data is <em>breaching</em>, because silence is the failure:</p>
<pre><code>aws cloudwatch put-metric-alarm --alarm-name lab-heartbeat \
  --namespace LabApp --metric-name Heartbeat \
  --statistic SampleCount --period 60 --evaluation-periods 2 \
  --threshold 1 --comparison-operator LessThanThreshold \
  --treat-missing-data breaching</code></pre></li>

<li><p>Feed the heartbeat a few times (in production this is your job's success hook):</p>
<pre><code>for i in 1 2 3; do
  aws cloudwatch put-metric-data --namespace LabApp \
    --metric-name Heartbeat --value 1
  sleep 55
done</code></pre>
<p>While that runs (or from a second terminal), check states — heartbeat should reach OK, error alarm shows INSUFFICIENT_DATA or OK:</p>
<pre><code>aws cloudwatch describe-alarms --alarm-names lab-error-rate lab-heartbeat \
  --query 'MetricAlarms[].{name:AlarmName,state:StateValue,reason:StateReason}'</code></pre></li>

<li><p>Now inject errors into the log group. Timestamps are epoch milliseconds; send four ERROR events in one batch:</p>
<pre><code>NOW=$(date +%s%3N)
aws logs put-log-events --log-group-name lab-app-logs \
  --log-stream-name host-1 --log-events \
  timestamp=$NOW,message='{"level":"ERROR","msg":"payment declined","order":1}' \
  timestamp=$NOW,message='{"level":"ERROR","msg":"payment declined","order":2}' \
  timestamp=$NOW,message='{"level":"INFO","msg":"heartbeat ok"}' \
  timestamp=$NOW,message='{"level":"ERROR","msg":"timeout","order":3}' \
  timestamp=$NOW,message='{"level":"ERROR","msg":"timeout","order":4}'</code></pre></li>

<li><p>Within ~2 minutes the filter extracts 4 ERROR datapoints into one period and lab-error-rate transitions to ALARM. Meanwhile, you stopped publishing heartbeats in step 5 — after two empty 60 s periods, lab-heartbeat also goes to ALARM, purely from <em>missing data</em>:</p>
<pre><code>sleep 150
aws cloudwatch describe-alarms --alarm-names lab-error-rate lab-heartbeat \
  --query 'MetricAlarms[].{name:AlarmName,state:StateValue,reason:StateReason}'</code></pre></li>

<li><p>Inspect the pipeline end to end — the metric the filter produced, and the alarm history showing each transition with its reason:</p>
<pre><code>aws cloudwatch get-metric-statistics --namespace LabApp --metric-name ErrorCount \
  --statistics Sum --period 60 \
  --start-time $(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)
aws cloudwatch describe-alarm-history --alarm-name lab-heartbeat \
  --history-item-type StateUpdate --max-records 5 \
  --query 'AlarmHistoryItems[].HistorySummary'</code></pre></li>
</ol>

<h3>Verify</h3>
<ul>
<li>lab-error-rate: INSUFFICIENT_DATA (new alarm) → OK/quiet → ALARM after the ERROR batch — driven by a metric that exists only because a filter watched the logs.</li>
<li>lab-heartbeat: OK while you published → ALARM two minutes after you stopped — the breaching treatment converting silence into a page. Re-run one put-metric-data and watch it return to OK.</li>
<li>Optional: query the logs like an investigator — <code>aws logs start-query</code> with a Logs Insights query string filtering on level = ERROR, then <code>aws logs get-query-results</code>. Note this bills per GB scanned (here, KBs — nothing).</li>
</ul>

<h3>Teardown</h3>
<p>Ordered: alarms first (they reference the metrics), then the filter, then the log group. Custom metric series expire on their own and cost nothing once idle.</p>
<ol>
<li><pre><code>aws cloudwatch delete-alarms --alarm-names lab-error-rate lab-heartbeat</code></pre></li>
<li><pre><code>aws logs delete-metric-filter --log-group-name lab-app-logs \
  --filter-name error-count</code></pre></li>
<li><pre><code>aws logs delete-log-group --log-group-name lab-app-logs</code></pre></li>
<li><p>Confirm clean:</p>
<pre><code>aws cloudwatch describe-alarms --alarm-name-prefix lab-
aws logs describe-log-groups --log-group-name-prefix lab-app-logs</code></pre></li>
</ol>
<p>Cost check: two standard alarms are ~0.20 USD/month prorated — for the hour this lab ran, effectively nothing; log volume was kilobytes. Nothing remains billing after teardown.</p>
`
  }
});
