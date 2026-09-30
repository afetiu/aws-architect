window.COURSE.registerLearn({
  moduleId: "observability",
  bigPicture: "Observability is how you know what your system is doing and who changed it. Remember the triangle: <strong>CloudWatch</strong> tells you <em>what is happening</em> (metrics, logs, alarms), <strong>CloudTrail</strong> tells you <em>who did what</em> (every API call), and <strong>AWS Config</strong> tells you <em>what changed</em> (resource settings over time). <strong>X-Ray</strong> follows one request across services, and <strong>EventBridge</strong> turns any of these signals into automatic action. Many exam questions are just asking which corner of the triangle owns the scenario.",
  cheatsheet: [
    { k: "Alarm on EC2 memory or disk space used", v: "Install the <strong>CloudWatch agent</strong>; EC2 does not report these" },
    { k: "Faster EC2 metrics for Auto Scaling", v: "<strong>Detailed monitoring</strong> (1-minute instead of 5-minute)" },
    { k: "Metrics at 1-second resolution", v: "<strong>High-resolution custom metrics</strong> (custom only)" },
    { k: "Publish metrics from Lambda with no extra API calls", v: "<strong>Embedded Metric Format</strong> (EMF) log lines" },
    { k: "Instance fails system status check, recover automatically", v: "Alarm on <strong>StatusCheckFailed_System</strong> + EC2 recover action" },
    { k: "Too many related alarms during one incident", v: "<strong>Composite alarm</strong>" },
    { k: "Metric has daily cycles, fixed thresholds misfire", v: "<strong>Anomaly detection</strong> alarm" },
    { k: "Alarm never fired because the source stopped sending data", v: "Set missing data to <strong>breaching</strong>" },
    { k: "Page when a specific error string appears in logs", v: "<strong>Metric filter</strong> + alarm" },
    { k: "Stream logs to OpenSearch, S3 or a SIEM in near real time", v: "<strong>Subscription filter</strong> to Firehose, Kinesis or Lambda" },
    { k: "Ad-hoc search of last week's logs", v: "<strong>CloudWatch Logs Insights</strong>" },
    { k: "One dashboard across many accounts without copying data", v: "<strong>Cross-account observability</strong> with a monitoring account" },
    { k: "Who deleted this resource? Which credentials made the call?", v: "<strong>CloudTrail</strong>" },
    { k: "Record who read objects in an S3 bucket", v: "Enable CloudTrail <strong>S3 data events</strong>" },
    { k: "Prove audit logs were not tampered with", v: "CloudTrail <strong>log file integrity validation</strong> + S3 Object Lock" },
    { k: "What did this resource look like last month? Detect non-compliance", v: "<strong>AWS Config</strong> and Config rules" },
    { k: "Automatically fix non-compliant resources", v: "Config rule + <strong>SSM Automation</strong> remediation" },
    { k: "Which microservice in the chain is slow?", v: "<strong>X-Ray</strong> service map" },
    { k: "React within minutes to a specific API call", v: "<strong>EventBridge</strong> rule on the CloudTrail event, then Lambda/SSM" },
    { k: "Warned before hitting service limits; spot idle resources", v: "<strong>Trusted Advisor</strong>; scheduled AWS maintenance = <strong>AWS Health</strong>" }
  ],
  lessons: {
    "cw-metrics-model": {
      minutes: 4,
      tldr: [
        "A metric is identified by <strong>namespace + name + all its dimensions</strong>. Change one dimension and it is a different metric.",
        "EC2 sends CPU, disk I/O, network and status checks. It does <strong>not</strong> send memory or disk space used: install the <strong>CloudWatch agent</strong>.",
        "<strong>Standard</strong> = 5-minute data, free. <strong>Detailed</strong> = 1-minute, paid. <strong>High-resolution</strong> = down to 1 second, custom metrics only.",
        "Alarm on <strong>percentiles</strong> like p99 for latency, not on the average.",
        "<strong>EMF</strong> lets you write metrics as structured log lines; watch out, each unique dimension value is a billed metric."
      ],
      analogy: "The hypervisor is like a landlord who can see your electricity and water meters from the street but cannot see how full your fridge is. For what is inside (memory, disk space), you need a sensor inside the flat: the CloudWatch agent.",
      examTip: "\"Monitor EC2 memory utilization\" means <strong>install the CloudWatch agent</strong>. Enabling detailed monitoring is the trap: it changes how often metrics arrive, not which metrics exist.",
      terms: [
        { t: "Namespace", d: "Container for metrics, like AWS/EC2 or your own MyApp." },
        { t: "Dimension", d: "Name/value pair that is part of a metric's identity, like InstanceId." },
        { t: "Detailed monitoring", d: "Paid 1-minute metrics for AWS services instead of 5-minute." },
        { t: "CloudWatch agent", d: "Software on the instance that sends memory, disk and log data." },
        { t: "Embedded Metric Format", d: "JSON log format that CloudWatch turns into metrics automatically." }
      ],
      check: [
        {
          q: "Operations wants an alarm when EC2 memory use exceeds 85%. What must they do?",
          options: ["Enable detailed monitoring", "Install and configure the CloudWatch agent", "Read the AWS/EC2 MemoryUtilization metric"],
          answer: 1,
          why: "EC2 cannot see inside the guest OS, so there is no built-in memory metric. The agent publishes it as a custom metric you can alarm on."
        },
        {
          q: "A team adds a CustomerId dimension to metrics for 20,000 customers and the bill jumps. Why?",
          options: ["Dimensions are free but PutMetricData calls are expensive", "Each unique dimension combination is a separate billed metric", "Detailed monitoring was enabled automatically"],
          answer: 1,
          why: "Dimensions define metric identity, so 20,000 customers create thousands of new custom metrics. Per-customer detail belongs in logs."
        }
      ]
    },
    "cw-alarms": {
      minutes: 4,
      tldr: [
        "An alarm has three states: <strong>OK</strong>, <strong>ALARM</strong> and <strong>INSUFFICIENT_DATA</strong> (not enough data yet, not an error).",
        "\"M out of N\" datapoints must breach before it fires, which stops flapping. Actions fire on state <em>changes</em>.",
        "Actions: SNS, Lambda, EC2 stop/reboot/<strong>recover</strong>, Auto Scaling, Systems Manager.",
        "<strong>Missing data</strong>: use <em>breaching</em> when silence means trouble (heartbeats), <em>notBreaching</em> for sparse error counts.",
        "<strong>Composite alarms</strong> reduce noise; <strong>anomaly detection</strong> handles metrics with daily or weekly patterns."
      ],
      analogy: "A smoke detector that only checks for smoke will stay silent if its battery dies. Treating missing data as breaching is the \"low battery\" chirp: no signal is itself a warning.",
      examTip: "\"Recover automatically from host failure\" means alarm on <strong>StatusCheckFailed_System</strong> with the <strong>recover</strong> action. \"Too many related alerts\" means <strong>composite alarm</strong>.",
      terms: [
        { t: "INSUFFICIENT_DATA", d: "Alarm state meaning there are not enough datapoints to decide." },
        { t: "Evaluation periods / datapoints to alarm", d: "The M-out-of-N setting deciding how many recent periods must breach." },
        { t: "TreatMissingData", d: "How gaps count: missing, notBreaching, breaching or ignore." },
        { t: "Composite alarm", d: "Alarm built from other alarms with AND/OR/NOT logic." },
        { t: "Anomaly detection", d: "Learns a metric's normal pattern and alarms when it leaves the expected band." }
      ],
      check: [
        {
          q: "Request volume is high by day and low at night. A fixed low-traffic threshold fires every night. What is the best fix?",
          options: ["Raise the threshold", "Use an anomaly detection alarm", "Set missing data to notBreaching"],
          answer: 1,
          why: "Anomaly detection learns the daily pattern and alarms only when traffic leaves its expected band, at any hour."
        },
        {
          q: "A heartbeat metric stops when a cron job dies, but the alarm never fires. What setting fixes this?",
          options: ["TreatMissingData = breaching", "TreatMissingData = notBreaching", "A longer evaluation period"],
          answer: 0,
          why: "When the job dies no data arrives. Treating missing data as breaching turns that silence into an alarm."
        }
      ]
    },
    "cw-logs": {
      minutes: 4,
      tldr: [
        "Logs live in <strong>log groups</strong> (retention, encryption, access) made of log streams. Default retention is <strong>never expire</strong>: set it.",
        "<strong>Metric filter</strong>: count matching log lines into a metric so you can alarm. Works only on new logs, no backfill.",
        "<strong>Subscription filter</strong>: stream log events in near real time to <strong>Kinesis, Firehose or Lambda</strong>. Max 2 per group.",
        "<strong>Logs Insights</strong> is for interactive queries; you pay per GB scanned.",
        "<strong>Cross-account observability</strong> gives one monitoring account a view across many accounts without copying data."
      ],
      analogy: "A metric filter is a tally counter clicking every time a word appears. A subscription filter is a copy machine sending each matching page somewhere else. Logs Insights is searching the archive when you have a question.",
      examTip: "Want a <strong>number to alarm on</strong> from logs? Metric filter. Want the <strong>log events delivered elsewhere</strong> (S3, OpenSearch, SIEM)? Subscription filter. The exam loves swapping these two.",
      terms: [
        { t: "Log group", d: "Collection of log streams sharing retention and access settings." },
        { t: "Metric filter", d: "Turns matching log events into a CloudWatch metric." },
        { t: "Subscription filter", d: "Streams matching log events to Kinesis, Firehose or Lambda." },
        { t: "Logs Insights", d: "Query language for searching and aggregating logs; billed per GB scanned." },
        { t: "Retention setting", d: "How long a log group keeps data: 1 day to 10 years, or forever by default." }
      ],
      check: [
        {
          q: "Security needs application logs delivered to Amazon OpenSearch in near real time. What do you configure?",
          options: ["A metric filter", "A subscription filter to Firehose", "A daily export task to S3"],
          answer: 1,
          why: "Subscription filters stream the events themselves; Firehose delivers them to OpenSearch. Export tasks are batch, up to 12 hours late."
        },
        {
          q: "The team wants to be paged when 'PaymentFailed' appears more than 10 times in 5 minutes. What is the simplest build?",
          options: ["Logs Insights query on a schedule", "Metric filter plus a CloudWatch alarm", "Subscription filter to Lambda"],
          answer: 1,
          why: "A metric filter counts matches and an alarm fires on the count. Scheduled Insights queries cost per scan and add delay."
        }
      ]
    },
    "cloudtrail": {
      minutes: 4,
      tldr: [
        "<strong>CloudTrail</strong> records <strong>who called which API, when and from where</strong>, including console clicks.",
        "<strong>Event history</strong> keeps 90 days of management events for free. For longer or automation, create a <strong>trail</strong> to S3.",
        "Use an <strong>all-region</strong> trail, or an <strong>organization trail</strong> covering every account.",
        "<strong>Data events</strong> (S3 GetObject, Lambda Invoke) are off by default and cost extra. Enable them to see who read an object.",
        "<strong>Log file integrity validation</strong> proves logs were not changed; Object Lock and SCPs prevent tampering."
      ],
      analogy: "CloudTrail is the building's visitor log: every entry says who came in, which door they used and what they asked for. It does not tell you the room temperature (CloudWatch) or how the furniture was arranged (Config).",
      examTip: "\"Who deleted the security group\" means <strong>CloudTrail</strong>. \"Who read objects in this bucket\" needs <strong>S3 data events</strong>, which a default trail does not record.",
      terms: [
        { t: "Management events", d: "Control-plane API calls like CreateUser or RunInstances. Logged by default." },
        { t: "Data events", d: "High-volume data-plane calls like S3 GetObject. Off by default, paid." },
        { t: "Trail", d: "Configuration that delivers CloudTrail events continuously to S3 (and optionally CloudWatch Logs)." },
        { t: "Organization trail", d: "One trail logging every account in an AWS Organization." },
        { t: "Log file integrity validation", d: "Signed hourly digest files that prove log files were not modified or deleted." },
        { t: "CloudTrail Lake", d: "Managed store for querying years of events with SQL." }
      ],
      check: [
        {
          q: "Auditors ask who downloaded files from a confidential S3 bucket last month. A standard trail exists. What was needed?",
          options: ["Nothing, management events include GetObject", "S3 data events enabled on the trail", "AWS Config"],
          answer: 1,
          why: "GetObject is a data event, which trails do not record unless you enable it. Config tracks settings, not who read objects."
        },
        {
          q: "Audit logs must be kept 7 years with proof they were not altered. Which combination fits?",
          options: ["Event history", "Organization trail to S3 with Object Lock and log file integrity validation", "CloudWatch Logs with never-expire retention"],
          answer: 1,
          why: "Integrity validation detects tampering and Object Lock prevents it. Event history only keeps 90 days."
        }
      ]
    },
    "aws-config": {
      minutes: 4,
      tldr: [
        "<strong>AWS Config</strong> records every resource's settings over time, like version history for your infrastructure.",
        "<strong>Config rules</strong> mark resources COMPLIANT or NONCOMPLIANT. Hundreds of managed rules, or write your own.",
        "Config <strong>detects</strong>; it does not prevent. Prevention is SCPs, IAM or S3 Block Public Access.",
        "Add <strong>auto-remediation</strong> with SSM Automation documents to fix problems automatically.",
        "<strong>Conformance packs</strong> deploy rule sets; <strong>aggregators</strong> show compliance across accounts and regions."
      ],
      analogy: "Config is a security camera plus a checklist for your infrastructure: it records how every room looked at every moment and flags any room that breaks the rules. It cannot lock the door; that is the job of SCPs and IAM.",
      examTip: "\"Detect and automatically fix\" means <strong>Config rule + SSM remediation</strong>. If the question says <strong>prevent</strong>, Config is the distractor: pick an SCP or a preventive control.",
      terms: [
        { t: "Configuration item", d: "Snapshot of a resource's settings and relationships at a point in time." },
        { t: "Config rule", d: "Check that evaluates resources as compliant or non-compliant." },
        { t: "Remediation action", d: "SSM Automation document that fixes a non-compliant resource." },
        { t: "Conformance pack", d: "Bundle of rules and remediations deployed together, e.g. for CIS or PCI." },
        { t: "Aggregator", d: "Central, read-only view of Config data from many accounts and regions." }
      ],
      check: [
        {
          q: "Security groups allowing SSH from 0.0.0.0/0 must be found and fixed automatically. What do you use?",
          options: ["CloudTrail with Athena", "Config rule restricted-ssh with SSM auto-remediation", "An SCP"],
          answer: 1,
          why: "The Config rule detects the open rule and SSM Automation removes it. An SCP could block creation, but it cannot fix existing groups."
        },
        {
          q: "The team needs one view of compliance status across all 40 accounts. What do they set up?",
          options: ["A Config aggregator", "A conformance pack", "CloudWatch dashboards in each account"],
          answer: 0,
          why: "An aggregator collects configuration and compliance data from many accounts into one view. Conformance packs deploy rules but do not aggregate results."
        }
      ]
    },
    "xray": {
      minutes: 4,
      tldr: [
        "<strong>X-Ray</strong> follows a single request across services and shows where time was spent and where errors happened.",
        "A <strong>trace</strong> is the whole journey; <strong>segments</strong> are each service's part; the trace ID travels in the <code>X-Amzn-Trace-Id</code> header.",
        "The <strong>service map</strong> shows every service, its latency and error rates: the fastest way to find the slow hop.",
        "Only a <strong>sample</strong> of requests is traced (default 1 per second plus 5%). Use logs with trace IDs to find one specific request.",
        "Lambda and API Gateway: switch on <strong>active tracing</strong>. The ALB passes the header along but does not create segments."
      ],
      analogy: "X-Ray is a parcel tracking number. Each depot scans the parcel as it passes, so you can see exactly which depot held it up.",
      examTip: "\"Find which microservice in the chain causes latency\" means <strong>X-Ray service map</strong>. Options claiming an ALB sends X-Ray segments are wrong; it only forwards the trace header.",
      terms: [
        { t: "Trace", d: "The full path of one request through all services." },
        { t: "Segment / subsegment", d: "The part of a trace done by one service, and smaller steps inside it." },
        { t: "Sampling rule", d: "Decides what share of requests get traced, to control cost." },
        { t: "Service map", d: "Visual graph of services with latency and error rates between them." },
        { t: "Annotation", d: "Indexed key-value label on a segment that you can search traces by." }
      ],
      check: [
        {
          q: "A request passes API Gateway, three Lambda functions and DynamoDB, and is slow. How do you find the slow step fastest?",
          options: ["CloudTrail event history", "Enable active tracing and read the X-Ray service map", "Detailed monitoring on Lambda"],
          answer: 1,
          why: "X-Ray shows time spent per hop across the whole chain. CloudTrail logs API calls for audit, not per-request latency."
        },
        {
          q: "Support must investigate one particular customer's failed request, but X-Ray shows no trace for it. Why?",
          options: ["X-Ray only keeps traces for 1 hour", "Sampling means not every request is traced", "ALBs block X-Ray"],
          answer: 1,
          why: "X-Ray traces a sample by design. Log the trace ID with each request so you can find specific ones in logs."
        }
      ]
    },
    "ops-automation-cost": {
      minutes: 4,
      tldr: [
        "The automation pattern: <strong>detect</strong> (alarm, CloudTrail, Config, GuardDuty) then <strong>route</strong> (EventBridge) then <strong>act</strong> (Lambda/SSM) then <strong>notify</strong> (SNS).",
        "Event-driven reactions beat \"a Lambda that polls every 5 minutes\" on speed and cost.",
        "<strong>Trusted Advisor</strong> checks cost, security, fault tolerance, performance and service limits. Full checks need Business or Enterprise Support.",
        "<strong>AWS Health</strong> tells you about events hitting <em>your</em> resources, like instance retirement. Pair it with EventBridge.",
        "Big observability costs: log <strong>ingestion</strong>, never-expire retention, metric cardinality, unscoped CloudTrail data events."
      ],
      analogy: "EventBridge is the building's nervous system: sensors (alarms, audit logs) send signals, and reflexes (Lambda, SSM runbooks) respond before anyone has to think about it.",
      examTip: "\"React automatically when a specific API call happens\" means an <strong>EventBridge rule</strong> on the CloudTrail event triggering Lambda or SSM. \"Notified of scheduled maintenance on my instances\" means <strong>AWS Health + EventBridge</strong>.",
      terms: [
        { t: "EventBridge rule", d: "Matches events from AWS services and sends them to targets like Lambda or SSM." },
        { t: "SSM Automation", d: "Systems Manager runbooks that perform fixes automatically." },
        { t: "Trusted Advisor", d: "Account checks for cost, security, fault tolerance, performance and limits." },
        { t: "AWS Health", d: "Account-specific notices of AWS events and maintenance affecting your resources." },
        { t: "Log ingestion", d: "Cost of sending logs into CloudWatch; often the biggest monitoring bill line." }
      ],
      check: [
        {
          q: "Anyone opening a security group to 0.0.0.0/0 must have the rule revoked within minutes. What is the best design?",
          options: ["A scheduled Lambda that scans security groups hourly", "An EventBridge rule on the API call triggering a Lambda that revokes it", "A Trusted Advisor check"],
          answer: 1,
          why: "The EventBridge rule reacts as soon as the API call happens. Hourly polling is slower and Trusted Advisor only reports, it does not fix."
        },
        {
          q: "The CloudWatch bill doubled. Log groups use default settings. What is the first lever to pull?",
          options: ["Turn off CloudTrail", "Set retention on log groups and cut noisy debug logging", "Switch to detailed monitoring"],
          answer: 1,
          why: "Default retention keeps logs forever and ingestion is the priciest part. Turning off CloudTrail would remove your audit trail, not fix the real cost."
        }
      ]
    }
  }
});
