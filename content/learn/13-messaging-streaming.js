window.COURSE.registerLearn({
  moduleId: "messaging",
  bigPicture: "Messaging services let the parts of a system talk without waiting on each other. A <strong>queue</strong> (SQS) holds jobs until a worker is ready. A <strong>topic or bus</strong> (SNS, EventBridge) shouts one event to many listeners. A <strong>stream</strong> (Kinesis, MSK) keeps an ordered history that many readers can replay. Almost every exam scenario that says <em>decouple</em>, <em>fan out</em>, <em>real time</em> or <em>replay</em> is really asking which of these three shapes you need.",
  cheatsheet: [
    { k: "Decouple tiers, absorb traffic spikes, protect the database", v: "<strong>SQS</strong> — workers pull at their own pace; the backlog is the buffer" },
    { k: "Process in order, no duplicates from producer retries", v: "<strong>SQS FIFO</strong> — message group = ordered lane, 5-min dedup window" },
    { k: "FIFO throughput numbers", v: "<strong>300 msg/s</strong>, or <strong>3,000 msg/s with batching</strong> (high-throughput mode goes higher)" },
    { k: "Messages processed twice because work takes longer than expected", v: "Raise the <strong>visibility timeout</strong> above processing time (Lambda: 6x function timeout)" },
    { k: "Some messages always fail and need to be set aside", v: "<strong>Dead-letter queue</strong> + maxReceiveCount; redrive after the fix" },
    { k: "Lots of empty receives, high SQS request cost", v: "<strong>Long polling</strong> (WaitTimeSeconds up to 20 s)" },
    { k: "Payload bigger than the message size limit", v: "<strong>Claim-check</strong>: store in S3, send a pointer (Extended Client Library)" },
    { k: "One event, several services must each process it reliably", v: "<strong>SNS to SQS fanout</strong> — one queue per consumer" },
    { k: "Consumers only care about some messages", v: "<strong>SNS filter policy</strong> on each subscription" },
    { k: "Same alert by email, SMS and mobile push", v: "<strong>SNS</strong> — the only multi-protocol notifier" },
    { k: "Route events to targets by content, cross-account, or from SaaS", v: "<strong>EventBridge</strong> rules, custom bus, partner event source" },
    { k: "Replay events after fixing a bug in a consumer", v: "<strong>EventBridge archive + replay</strong> (or Kinesis if it is a stream)" },
    { k: "Millions of one-time or timezone-aware schedules", v: "<strong>EventBridge Scheduler</strong>" },
    { k: "Clickstream, IoT telemetry, real-time analytics, many readers", v: "<strong>Kinesis Data Streams</strong> — ordered log, per-consumer cursor" },
    { k: "Kinesis shard capacity", v: "Write <strong>1 MB/s or 1,000 records/s</strong>, read 2 MB/s per shard" },
    { k: "Load streaming data into S3/Redshift/OpenSearch/Splunk, no code", v: "<strong>Amazon Data Firehose</strong> — buffered, near real time" },
    { k: "Existing Kafka applications", v: "<strong>Amazon MSK</strong> — real Kafka, no client rewrite" },
    { k: "Legacy app uses JMS, AMQP, MQTT or STOMP, minimal code change", v: "<strong>Amazon MQ</strong> (ActiveMQ/RabbitMQ)" }
  ],
  lessons: {
    "sqs-semantics": {
      minutes: 4,
      tldr: [
        "<strong>Standard queues</strong>: nearly unlimited throughput, but a message can arrive <em>more than once</em> and roughly out of order.",
        "So every standard-queue consumer must be <strong>idempotent</strong>: doing the same job twice must be harmless.",
        "<strong>FIFO queues</strong> (name ends in <code>.fifo</code>) add strict ordering and a 5-minute deduplication window.",
        "Order is kept per <strong>message group ID</strong>; different groups run in parallel. One group for everything = one worker at a time.",
        "FIFO limits: <strong>300 msg/s</strong>, or <strong>3,000 with batching</strong>. Retention 1 min to 14 days (default 4 days)."
      ],
      analogy: "A standard queue is a busy post office with many sorting rooms: letters arrive fast but sometimes out of order, and occasionally a copy turns up twice. A FIFO queue is a bank with one line per customer: each customer is served strictly in order, but many customers are served at once at different windows.",
      examTip: "\"Exactly once, in order\" means <strong>FIFO</strong>. \"Maximum throughput, order does not matter\" means <strong>standard</strong>. The trap: FIFO dedup only blocks <em>producer</em> retries within 5 minutes; it does not stop a crashed consumer from getting the message again.",
      terms: [
        { t: "At-least-once delivery", d: "Every message arrives, but sometimes more than once. The standard queue guarantee." },
        { t: "Idempotent consumer", d: "A worker where processing the same message twice gives the same result as once." },
        { t: "Deduplication ID", d: "FIFO tag; a repeat with the same ID within 5 minutes is silently dropped." },
        { t: "Message group ID", d: "FIFO lane key. Order is guaranteed inside a group; groups are processed in parallel." }
      ],
      check: [
        {
          q: "An order system must process each customer's orders in sequence, but thousands of customers should be handled in parallel. What do you use?",
          options: ["Standard queue with long polling", "FIFO queue with one message group ID for all messages", "FIFO queue with the customer ID as the message group ID", "Standard queue with a delay queue"],
          answer: 2,
          why: "Per-customer group IDs give ordered lanes per customer while different customers run in parallel. A single group ID for everything would force the whole queue through one lane."
        },
        {
          q: "A consumer crashes after charging a card but before deleting the message from a FIFO queue. What happens?",
          options: ["Nothing, FIFO guarantees exactly-once so the message is gone", "The message becomes visible again and may be processed a second time", "The message moves straight to the dead-letter queue"],
          answer: 1,
          why: "FIFO dedup only covers producer-side duplicates. An undeleted message always comes back after the visibility timeout, so the consumer still needs to be idempotent."
        }
      ]
    },
    "sqs-mechanics": {
      minutes: 4,
      tldr: [
        "Receiving a message does not remove it; it hides it for the <strong>visibility timeout</strong> (default 30 s, max <strong>12 h</strong>). You must delete it when done.",
        "Timeout too short = duplicate processing. With Lambda, set it to at least <strong>6x the function timeout</strong>.",
        "A <strong>dead-letter queue</strong> catches messages that fail more than <code>maxReceiveCount</code> times. Alarm on it; redrive after the fix.",
        "<strong>Long polling</strong> (up to 20 s wait) cuts empty responses and cost. <strong>Delay queues</strong> hide new messages for up to 15 min.",
        "Message size: 256 KB classic exam number (1 MiB since 2025). Bigger payloads go to S3 with a pointer in the message."
      ],
      analogy: "Taking a message is like borrowing a library book with a due date. If you do not return it (delete it) before the due date, the library assumes you lost it and lends it to someone else.",
      examTip: "\"Messages processed twice, processing takes longer than expected\" means <strong>raise the visibility timeout</strong>. \"Some messages keep failing and must be investigated\" means a <strong>DLQ</strong>. \"Too many empty receives / reduce cost\" means <strong>long polling</strong>.",
      terms: [
        { t: "Visibility timeout", d: "How long a received message stays hidden from other consumers. Default 30 s, max 12 h." },
        { t: "Dead-letter queue (DLQ)", d: "A separate queue where messages go after failing maxReceiveCount times." },
        { t: "Redrive", d: "Moving messages from the DLQ back to the source queue once the bug is fixed." },
        { t: "Long polling", d: "Receive call waits up to 20 s for a message instead of returning empty at once." },
        { t: "Claim-check pattern", d: "Store the large payload in S3 and put only a pointer in the message." }
      ],
      check: [
        {
          q: "Workers take about 3 minutes per message, yet many messages are processed twice. The queue uses defaults. What is the fix?",
          options: ["Enable long polling", "Increase the visibility timeout above 3 minutes", "Switch to a FIFO queue", "Add a delay queue"],
          answer: 1,
          why: "The default 30 s timeout expires while work is still running, so another worker picks the message up. FIFO would not help: redelivery after a lease expires happens on both queue types."
        },
        {
          q: "A malformed message crashes every consumer and keeps coming back forever. What stops the loop?",
          options: ["A redrive policy sending it to a dead-letter queue after N receives", "Short polling", "A longer retention period"],
          answer: 0,
          why: "The redrive policy counts receives and moves the message to the DLQ after maxReceiveCount, so it stops blocking work and can be inspected."
        }
      ]
    },
    "sns-fanout": {
      minutes: 4,
      tldr: [
        "SNS is <strong>push</strong>: a topic immediately delivers each message to all subscribers. It stores nothing and cannot replay.",
        "Best practice fanout: <strong>SNS topic to one SQS queue per consumer</strong>. Each queue buffers, so one slow or broken consumer loses nothing.",
        "<strong>Filter policies</strong> on a subscription deliver only matching messages, so consumers stop paying for messages they discard.",
        "<strong>SNS FIFO + SQS FIFO</strong> keeps order and dedup through the fanout.",
        "SNS speaks many protocols: SQS, Lambda, HTTP/S, email, SMS, mobile push, Firehose."
      ],
      analogy: "SNS is a radio broadcast: everyone tuned in hears it live, and if your radio was off, you missed it. Putting an SQS queue in front of each listener is like giving each one a recorder that captures the show until they have time to listen.",
      examTip: "\"One event, several systems must each process it independently and reliably\" means <strong>SNS fanout to SQS queues</strong>. An option that subscribes Lambda or HTTP directly to SNS usually loses when the question stresses durability.",
      terms: [
        { t: "Topic", d: "The SNS channel producers publish to; every subscription gets a copy." },
        { t: "Fanout", d: "One message copied to many independent consumers." },
        { t: "Filter policy", d: "Rule on a subscription so it only receives messages whose attributes (or body) match." },
        { t: "Raw message delivery", d: "Send the bare payload to SQS/HTTP instead of wrapping it in SNS's JSON envelope." },
        { t: "Subscription DLQ", d: "SQS queue that catches messages SNS failed to deliver after retries." }
      ],
      check: [
        {
          q: "An order-placed event must reach inventory, billing and analytics. Billing is sometimes down for an hour and must not lose events. Best design?",
          options: ["SNS topic with each service subscribed over HTTPS", "SNS topic fanning out to one SQS queue per service", "One SQS queue that all three services poll", "Direct Lambda subscriptions to the SNS topic"],
          answer: 1,
          why: "Each queue holds messages for up to 14 days, so billing catches up when it recovers. A single shared queue would split messages between services instead of copying them."
        },
        {
          q: "An analytics consumer receives every message but only needs EU orders. How do you cut its cost with the least code?",
          options: ["Add an SNS subscription filter policy on region", "Filter inside the consumer and delete the rest", "Create a second SQS queue with a delay"],
          answer: 0,
          why: "A filter policy stops non-matching messages at SNS, so no delivery, queue request or compute is spent on them."
        }
      ]
    },
    "eventbridge": {
      minutes: 4,
      tldr: [
        "EventBridge is an <strong>event router</strong>: events land on a <strong>bus</strong>, <strong>rules</strong> match their content, matches go to targets.",
        "Three bus types: <strong>default</strong> (AWS service events), <strong>custom</strong> (your apps, cross-account), <strong>partner</strong> (SaaS like Zendesk).",
        "Rules match on the full event body and can reshape it per target. Up to <strong>5 targets per rule</strong>.",
        "<strong>Archive and replay</strong> re-sends past events. <strong>Scheduler</strong> runs millions of one-time or timezone-aware schedules.",
        "<strong>Pipes</strong> connect one source to one target with optional filter and enrichment, no glue Lambda."
      ],
      analogy: "EventBridge is a mailroom clerk who reads every envelope and sends it to the right desks based on what is written inside. SNS is more like a mailing list: everyone on the list gets the same letter.",
      examTip: "Keywords: \"route by event content\", \"events from a SaaS partner\", \"replay events\", \"cross-account event bus\" all point to <strong>EventBridge</strong>. Mass fanout to email/SMS or millions of subscribers stays with <strong>SNS</strong>.",
      terms: [
        { t: "Event bus", d: "The pipe events are put onto. Every account has a default bus per region." },
        { t: "Rule / event pattern", d: "JSON pattern that decides which events go to which targets." },
        { t: "Partner event source", d: "A SaaS vendor sending its events straight into your account." },
        { t: "Archive and replay", d: "Keep copies of past events and re-send them to the bus later." },
        { t: "EventBridge Scheduler", d: "Managed scheduler: one-time or recurring, timezone-aware, can call almost any AWS API." },
        { t: "EventBridge Pipes", d: "One source to one target, with built-in filtering and enrichment." }
      ],
      check: [
        {
          q: "A company wants support tickets from its SaaS helpdesk to trigger AWS workflows without running webhook servers. What fits?",
          options: ["SNS HTTPS subscription", "EventBridge partner event source", "SQS queue with long polling", "Kinesis Data Streams"],
          answer: 1,
          why: "Partner event sources let supported SaaS vendors push events directly onto a bus in your account, with no ingestion code to run."
        },
        {
          q: "A consumer bug dropped a day of events. The team wants to reprocess them after fixing it. They use SNS today. What should they use instead?",
          options: ["SNS with a DLQ", "EventBridge with an archive, then replay", "SQS standard queue"],
          answer: 1,
          why: "EventBridge archives can replay past events onto the bus. SNS keeps nothing, and a DLQ only holds messages that failed delivery, not ones that were delivered and mishandled."
        }
      ]
    },
    "kinesis-streams": {
      minutes: 4,
      tldr: [
        "Kinesis Data Streams is an <strong>ordered log</strong>: records stay for the retention window (24 h default, up to <strong>365 days</strong>) and reading does not delete them.",
        "A stream is made of <strong>shards</strong>. The <strong>partition key</strong> picks the shard; order is kept per key, not across the whole stream.",
        "Per shard: write <strong>1 MB/s or 1,000 records/s</strong>, read 2 MB/s shared. Need 8 MB/s in? At least 8 shards.",
        "Many consumers? Use <strong>enhanced fan-out</strong>: each gets its own 2 MB/s per shard, pushed with low latency.",
        "<strong>On-demand</strong> mode scales for you; <strong>provisioned</strong> is cheaper for steady traffic. Alarm on <code>IteratorAgeMilliseconds</code>."
      ],
      analogy: "SQS is a to-do pile: take a card, do it, throw it away. Kinesis is a video recording: many people can watch it, each at their own position, and anyone can rewind.",
      examTip: "Clues for Kinesis: \"real-time analytics\", \"clickstream\", \"IoT telemetry\", \"multiple applications read the same data\", \"reprocess historical data\". Shard math (1 MB/s in per shard) is a favourite calculation.",
      terms: [
        { t: "Shard", d: "One ordered lane of a stream with fixed write and read capacity." },
        { t: "Partition key", d: "Value hashed to choose a shard; same key always lands on the same shard, in order." },
        { t: "Enhanced fan-out", d: "Each registered consumer gets its own 2 MB/s per shard, pushed to it." },
        { t: "KCL", d: "Kinesis Client Library: spreads shards across workers and checkpoints progress in DynamoDB." },
        { t: "Iterator age", d: "How far behind a consumer is. Rising age means records may expire unread." }
      ],
      check: [
        {
          q: "Three separate teams must each read the same clickstream, and one wants to reprocess last week's data. Which service?",
          options: ["SQS standard queue", "SNS topic", "Kinesis Data Streams", "Amazon MQ"],
          answer: 2,
          why: "Kinesis keeps records for the retention window and each consumer tracks its own position, so many readers and replay both work. SQS deletes a message once one consumer handles it."
        },
        {
          q: "A provisioned stream must ingest 6 MB/s of data. What is the minimum number of shards?",
          options: ["3", "6", "12"],
          answer: 1,
          why: "Each shard accepts 1 MB/s of writes, so 6 MB/s needs at least 6 shards. The 2 MB/s figure is the read limit, not the write limit."
        }
      ]
    },
    "firehose-msk-mq": {
      minutes: 4,
      tldr: [
        "<strong>Amazon Data Firehose</strong> buffers streaming data and delivers it to S3, Redshift, OpenSearch, Splunk or HTTP tools. Serverless, <strong>near real time</strong>.",
        "Firehose has no storage, no replay and no consumers. It can transform with Lambda and convert JSON to <strong>Parquet/ORC</strong>.",
        "<strong>Amazon MSK</strong> is managed Apache Kafka. Pick it when the scenario says Kafka or migrating existing Kafka apps.",
        "<strong>Amazon MQ</strong> is managed ActiveMQ/RabbitMQ for apps that speak <strong>JMS, AMQP, MQTT, STOMP</strong> and cannot be rewritten.",
        "Amazon MQ runs on broker instances: not serverless and does not scale like SQS."
      ],
      analogy: "Firehose is a delivery van that waits until it is full (or a timer rings) and then drops the load at one warehouse. Kinesis Data Streams is a conveyor belt that people can watch and pick from in real time.",
      examTip: "\"Load streaming data into S3/Redshift/Splunk with minimal administration\" or \"near real time\" means <strong>Firehose</strong>. The word <strong>Kafka</strong> means MSK. Protocol names like JMS or AMQP plus \"minimal code changes\" mean <strong>Amazon MQ</strong>.",
      terms: [
        { t: "Buffer size / interval", d: "Firehose waits for a size (up to 128 MB) or a time (up to 900 s), whichever comes first." },
        { t: "Format conversion", d: "Firehose turns incoming JSON into Parquet or ORC for cheaper analytics." },
        { t: "MSK", d: "Amazon Managed Streaming for Apache Kafka: real Kafka brokers run for you." },
        { t: "Amazon MQ", d: "Managed ActiveMQ or RabbitMQ broker using open messaging protocols." },
        { t: "JMS / AMQP / MQTT", d: "Standard messaging protocols that SQS and SNS do not speak." }
      ],
      check: [
        {
          q: "Web logs must land in S3 as Parquet, partitioned by hour, with the least operational work. A delay of a minute is fine. Which service?",
          options: ["Kinesis Data Streams with a custom consumer", "Amazon Data Firehose with format conversion", "Amazon MQ", "SQS with a Lambda writer"],
          answer: 1,
          why: "Firehose is built for buffered delivery to S3 and converts to Parquet natively. Streams would need consumer code you have to build and run."
        },
        {
          q: "An on-premises order system uses JMS with ActiveMQ. It must move to AWS with minimal code changes. What do you choose?",
          options: ["Amazon SQS FIFO", "Amazon MQ", "Amazon MSK"],
          answer: 1,
          why: "Amazon MQ speaks JMS and runs ActiveMQ, so only the connection string changes. SQS would need the messaging code rewritten to its own API."
        }
      ]
    },
    "choosing-messaging": {
      minutes: 4,
      tldr: [
        "Ask first: is the message a <strong>task</strong> (done once, then gone) or a <strong>fact</strong> (many may watch, maybe later)? Tasks use SQS.",
        "Many consumers: SNS to SQS (push), EventBridge (route by content), Kinesis (replayable log).",
        "Need <strong>replay</strong>? Kinesis/MSK, or EventBridge archive. SQS and SNS forget once consumed.",
        "Need to <strong>protect a slow backend</strong> from spikes? SQS: the backlog is the buffer.",
        "Common chains: EventBridge to SQS to Lambda; Kinesis to Lambda plus Firehose to S3; API Gateway straight into SQS."
      ],
      analogy: "Think of who holds the bookmark. In SQS the service tracks every message until it is deleted. In SNS and EventBridge nobody does: they deliver and forget. In Kinesis each reader keeps its own bookmark in a book that stays on the shelf.",
      examTip: "Elimination rules: \"multiple consumers need the same messages\" rules out bare SQS; \"replay\" rules out SQS and SNS; \"global order across all messages\" is a trap, pick per-entity ordering.",
      terms: [
        { t: "Task vs fact", d: "A task is work done once; a fact is an event others may observe." },
        { t: "Backpressure", d: "Letting a slow consumer set the pace instead of being overwhelmed." },
        { t: "Composition", d: "Chaining services, like EventBridge for routing plus SQS for buffering." },
        { t: "Cursor ownership", d: "Who tracks read position: SQS itself, nobody (SNS/EventBridge), or the consumer (Kinesis)." }
      ],
      check: [
        {
          q: "A web tier sends image jobs that a small worker fleet must process at its own pace during traffic bursts. Which service?",
          options: ["SNS", "SQS", "Kinesis Data Streams", "EventBridge"],
          answer: 1,
          why: "Each job is a task done once, and the queue absorbs bursts. SNS and EventBridge push immediately and would pass the spike straight to the workers."
        },
        {
          q: "A team picked Kinesis for simple work distribution and now fights hot shards and shard bills. What should they have used?",
          options: ["SQS", "Amazon MQ", "Firehose"],
          answer: 0,
          why: "Work distribution with no replay or multi-reader need is exactly what SQS does, scaling automatically with no shards to manage."
        }
      ]
    }
  }
});
