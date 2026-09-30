/* Learning layer — Module 17: Analytics & Data Lakes */
window.COURSE.registerLearn({
  moduleId: "analytics",
  bigPicture: "On AWS, analytics is built around one idea: <strong>put all the data in S3 as files, describe it once in the Glue catalog, then point whichever engine fits at it</strong>. Athena, Redshift, EMR and Flink are just different ways to read the same files. Most exam questions here are pure 'pick the service' puzzles, so the win is learning the one clue word that selects each service.",
  cheatsheet: [
    { k: "Ad-hoc SQL on data already in S3, serverless, pay per query", v: "<strong>Athena</strong> — about 5 dollars per TB scanned" },
    { k: "Cut Athena cost or speed it up", v: "<strong>Parquet + compression + partition by date + select only needed columns</strong>" },
    { k: "Convert CSV/JSON to Parquet with no servers", v: "<strong>Glue ETL job</strong> (or Athena CTAS if plain SQL is enough)" },
    { k: "One shared schema registry for Athena, EMR, Spectrum", v: "<strong>Glue Data Catalog</strong> — metadata only, data stays in S3" },
    { k: "New data landed in S3 but Athena doesn't see it", v: "Partition not registered — <strong>partition projection</strong>, crawler, or ADD PARTITION" },
    { k: "Only process new files on each scheduled run", v: "<strong>Glue job bookmarks</strong>" },
    { k: "Petabyte warehouse, thousands of dashboard users, complex joins", v: "<strong>Redshift</strong> — owns its data layout, built for concurrency" },
    { k: "Join warehouse tables with S3 data without loading it", v: "<strong>Redshift Spectrum</strong>" },
    { k: "Warehouse queries queue at Monday-morning peak", v: "<strong>Concurrency scaling</strong> (extra clusters on demand)" },
    { k: "Full-text search, fuzzy match, autocomplete, relevance", v: "<strong>OpenSearch</strong> — nothing else ranks text" },
    { k: "Keep months of logs searchable, cheaply", v: "<strong>OpenSearch UltraWarm</strong> + ISM lifecycle policies" },
    { k: "Stream into S3/Redshift/OpenSearch with least management, ~1 min OK", v: "<strong>Firehose</strong> — a delivery pipe, no code" },
    { k: "Real-time, custom consumers, replay, ordering, several readers", v: "<strong>Kinesis Data Streams</strong> — a log you consume" },
    { k: "Rolling window, sessionize, real-time aggregation on a stream", v: "<strong>Managed Service for Apache Flink</strong>" },
    { k: "The word Kafka appears", v: "<strong>Amazon MSK</strong>" },
    { k: "Spark/Hadoop with specific versions, HBase, full control", v: "<strong>EMR</strong>; cheapest = <strong>Spot task nodes</strong>" },
    { k: "Dashboards for business users, embed analytics in our app", v: "<strong>QuickSight</strong>; slow/expensive source → <strong>SPICE</strong>" },
    { k: "Column- or row-level permissions on the data lake", v: "<strong>Lake Formation</strong>; at scale → <strong>LF-tags</strong>" }
  ],
  lessons: {
    "data-lake-pattern": {
      minutes: 4,
      tldr: [
        "A data lake is <strong>S3 as the storage</strong>, with separate engines reading the same files. Layout decides cost and speed for all of them.",
        "Two zones: <strong>raw</strong> (exactly as received, never edited, for replay) and <strong>curated</strong> (cleaned, columnar, partitioned — what people query).",
        "S3 has no indexes, so the <strong>folder path is the index</strong>: <code>year=2026/month=07/day=21/</code> lets engines skip whole days.",
        "<strong>Parquet</strong> stores data column by column and compressed; querying 3 of 40 columns reads only those 3. Often 30-100x cheaper than JSON.",
        "Avoid millions of tiny files; aim for 128 MB to 1 GB. For row-level updates and ACID on the lake, use <strong>Apache Iceberg</strong> tables."
      ],
      analogy: "A JSON lake is a library where every book is shelved in random order and you must read each one cover to cover. Partitioning puts books on shelves by date; Parquet lets you read just the chapter you need.",
      examTip: "'Reduce Athena cost / improve performance' is always some mix of <strong>convert to Parquet/ORC, compress, partition by date, query fewer columns</strong>. 'Buy more Athena capacity' or 'use CSV' is a distractor.",
      terms: [
        { t: "Raw zone", d: "Untouched copy of incoming data; lets you rebuild everything if a transform was wrong." },
        { t: "Curated zone", d: "Cleaned, columnar, partitioned data that analysts and engines actually query." },
        { t: "Partition", d: "A folder-like path segment (e.g. <code>day=21</code>) that lets engines skip data not matching the WHERE clause." },
        { t: "Parquet", d: "Columnar, compressed file format; engines read only the columns and row groups they need." },
        { t: "Small-files problem", d: "Millions of tiny objects make queries slow because per-file overhead dwarfs the data read." },
        { t: "Apache Iceberg", d: "Table format over Parquet adding ACID, row updates/deletes, and time travel on S3." }
      ],
      check: [
        {
          q: "Analysts query one day of logs, reading 3 of 40 fields, from JSON files in S3 with Athena. What cuts cost the most?",
          options: ["Move the logs to S3 Intelligent-Tiering", "Convert to Parquet and partition by date", "Increase the Athena query timeout", "Split the JSON into smaller files"],
          answer: 1,
          why: "Athena bills per byte scanned. Parquet reads only the needed columns and date partitions skip other days. Storage class does not change bytes scanned, and smaller files make things worse."
        },
        {
          q: "A data lake must support updating and deleting individual records with transactional guarantees. What fits best?",
          options: ["Migrate the lake to RDS", "Use Apache Iceberg tables on S3", "Re-run a Glue crawler after each change"],
          answer: 1,
          why: "Iceberg adds ACID, row-level updates/deletes and time travel on top of Parquet in S3. Moving to a database is unnecessary; crawlers only describe schema, they do not update rows."
        }
      ]
    },
    "glue": {
      minutes: 3,
      tldr: [
        "Glue is two things: the <strong>Data Catalog</strong> (a shared list of tables and schemas) and <strong>Glue ETL</strong> (serverless Spark jobs).",
        "The catalog holds <strong>only metadata</strong>; data stays in S3. Athena, Redshift Spectrum, EMR and Lake Formation all read the same catalog.",
        "<strong>Crawlers</strong> scan S3 and guess the schema and partitions. New partitions are invisible to queries until registered.",
        "Glue jobs bill per <strong>DPU-hour</strong> (1 DPU = 4 vCPU, 16 GB). <strong>Job bookmarks</strong> make each run process only new data.",
        "Pick Glue for low-ops batch ETL, EMR for full framework control, Lambda for small per-event transforms."
      ],
      analogy: "The Glue catalog is a library's card index: it tells every reader where each book is and what's inside, but the books themselves stay on the S3 shelves.",
      examTip: "'Serverless ETL to convert CSV to Parquet' → <strong>Glue job</strong>. 'Central metadata / Hive metastore replacement' → <strong>Glue Data Catalog</strong>. 'Process only new data each run' → <strong>job bookmarks</strong>. 'Least operational overhead' picks Glue over EMR.",
      terms: [
        { t: "Glue Data Catalog", d: "Serverless schema registry (databases, tables, partitions) shared by the AWS analytics engines." },
        { t: "Crawler", d: "Scans a data source, infers schema and partitions, and creates or updates catalog tables." },
        { t: "DPU", d: "Glue's billing unit: 4 vCPU and 16 GB of memory, charged per second." },
        { t: "Job bookmark", d: "Glue checkpoint that remembers what was already processed so reruns only handle new data." },
        { t: "DynamicFrame", d: "Glue's flexible version of a Spark DataFrame that tolerates messy, changing schemas." }
      ],
      check: [
        {
          q: "Files land in a new S3 date folder every day, but Athena queries don't return the new rows. Most likely cause?",
          options: ["Athena caches old results for 24 hours", "The new partition is not registered in the catalog", "S3 is eventually consistent for new objects"],
          answer: 1,
          why: "Queries only see partitions the catalog knows about. Register it via crawler, ADD PARTITION or partition projection. S3 is strongly consistent, so that is not the cause."
        },
        {
          q: "A team needs a nightly job converting CSV to Parquet with the least operational overhead. Which service?",
          options: ["Amazon EMR cluster", "AWS Glue ETL job", "EC2 instance running a cron script", "Lambda with 15-minute runs"],
          answer: 1,
          why: "Glue is serverless Spark: no cluster to manage. EMR works but adds cluster ops; Lambda's 15-minute and memory limits make it a poor fit for big batch jobs."
        }
      ]
    },
    "athena": {
      minutes: 3,
      tldr: [
        "Athena is <strong>serverless SQL over S3</strong> using the Glue catalog. No clusters. About <strong>5 dollars per TB scanned</strong>.",
        "Because you pay per byte scanned, every speed trick is also a cost trick: <strong>scan less</strong>.",
        "<strong>Partition projection</strong> computes partitions from a pattern (like dates), so no crawler is needed and planning stays fast.",
        "<strong>CTAS</strong> writes query results back to S3 as partitioned Parquet: a cheap SQL-only transform.",
        "<strong>Workgroups</strong> separate teams and can cap bytes scanned per query to stop runaway costs."
      ],
      analogy: "Athena is a taxi meter that runs on distance, where distance is bytes read. You can't buy a faster taxi; you can only take a shorter route by organising the data well.",
      examTip: "Athena = <strong>data already in S3 + SQL + ad-hoc + serverless</strong>. It loses to Redshift for high-concurrency dashboards and complex modeled joins. 'Limit what each team can scan' → <strong>workgroups</strong>.",
      terms: [
        { t: "Bytes scanned", d: "What Athena bills on; about 5 dollars per TB, 10 MB minimum per query." },
        { t: "Partition projection", d: "Table setting that calculates partition locations from a pattern instead of storing them in the catalog." },
        { t: "CTAS", d: "CREATE TABLE AS SELECT: run a query and save the result as a new table in S3, e.g. Parquet." },
        { t: "Workgroup", d: "Athena's unit for separating teams, result locations, and data-scanned limits." },
        { t: "Federated query", d: "Athena reaching into DynamoDB, RDS and others via Lambda connectors; fine for occasional joins." }
      ],
      check: [
        {
          q: "Analysts sometimes run huge accidental queries that scan 50 TB. How do you stop this in Athena?",
          options: ["Set per-query data-scanned limits on a workgroup", "Buy reserved Athena capacity", "Move data to S3 Glacier"],
          answer: 0,
          why: "Workgroup data usage controls cancel queries that exceed a byte limit. Reserved capacity changes pricing, not runaway scans; Glacier would make data unqueryable."
        },
        {
          q: "A table has 200,000 date partitions. Queries plan slowly and new days appear late. Best fix?",
          options: ["Run the crawler every 5 minutes", "Enable partition projection", "Switch the files to CSV"],
          answer: 1,
          why: "Projection computes partitions from the date pattern: no catalog lookups, no waiting for crawlers. Crawling more often adds cost and still lags."
        }
      ]
    },
    "redshift": {
      minutes: 4,
      tldr: [
        "Redshift is a <strong>columnar data warehouse</strong> spread across many nodes. It controls how data is stored, so joins and concurrency are fast.",
        "<strong>RA3</strong> nodes separate compute from storage (data kept in S3-backed managed storage). <strong>Serverless</strong> fits intermittent use.",
        "<strong>Distribution style</strong> (KEY, EVEN, ALL, AUTO) decides which node holds which rows; <strong>sort keys</strong> let it skip blocks, like partitions.",
        "<strong>Spectrum</strong> queries S3 without loading. <strong>Concurrency scaling</strong> absorbs peaks. <strong>Materialized views</strong> precompute repeated aggregations.",
        "Load with <strong>COPY from S3</strong>, never millions of single INSERTs."
      ],
      analogy: "Athena rents a kitchen per meal and cooks whatever is in your fridge. Redshift is a restaurant with its own pantry, organised in advance so every dish comes out fast even when the room is full.",
      examTip: "'Petabyte warehouse / complex joins / many concurrent BI users' → <strong>Redshift</strong>. 'Queries queue at peak' → <strong>concurrency scaling</strong>. 'Query S3 from the warehouse without loading' → <strong>Spectrum</strong>. 'Used a few hours a day' → <strong>Redshift Serverless</strong>.",
      terms: [
        { t: "MPP", d: "Massively parallel processing: every node works on its slice of data at the same time." },
        { t: "DISTSTYLE KEY / ALL", d: "KEY co-locates rows by join column; ALL copies small tables to every node." },
        { t: "Sort key", d: "Physical row order; lets Redshift skip blocks for range filters like dates." },
        { t: "Redshift Spectrum", d: "Lets Redshift SQL read S3 data through the Glue catalog; billed per TB scanned." },
        { t: "Concurrency scaling", d: "Temporary extra clusters that absorb query bursts, billed per second." },
        { t: "Materialized view", d: "Stored, refreshable query result; Redshift can auto-rewrite matching queries to use it." }
      ],
      check: [
        {
          q: "Hundreds of analysts hit the same expensive dashboard aggregation every few minutes in Redshift. Best fix?",
          options: ["Add a materialized view for the aggregation", "Move the data to Athena", "Switch every table to DISTSTYLE ALL"],
          answer: 0,
          why: "A materialized view precomputes the result and Redshift can rewrite matching queries to it. Athena would be slower and costlier for high-concurrency dashboards; ALL is only for small tables."
        },
        {
          q: "A warehouse is used only a few hours per week and the team wants minimal admin. Which option?",
          options: ["Provisioned RA3 cluster with reserved nodes", "Redshift Serverless", "EMR with Hive"],
          answer: 1,
          why: "Serverless auto-scales and pauses, billing only while queries run. Reserved provisioned capacity suits steady 24/7 load, not a few hours a week."
        }
      ]
    },
    "opensearch": {
      minutes: 3,
      tldr: [
        "OpenSearch is for two jobs: <strong>full-text search</strong> (typo tolerance, relevance, autocomplete) and <strong>interactive log analytics</strong> with dashboards.",
        "You run a <strong>domain</strong> of nodes with shards and replicas across AZs; use <strong>three</strong> dedicated master nodes. A Serverless option exists.",
        "Storage ladder: <strong>hot</strong> (fast, recent) → <strong>UltraWarm</strong> (S3-backed, read-only, ~1/10 cost) → <strong>cold</strong> (archive).",
        "Common feeds: <strong>Firehose → OpenSearch</strong> for logs; <strong>DynamoDB → OpenSearch</strong> to add search to an app.",
        "It is a search index, not the system of record: keep the source of truth elsewhere."
      ],
      analogy: "OpenSearch is the index at the back of a book: it points you instantly to every page mentioning a word, even a misspelled one. The book itself (your database) is still the real content.",
      examTip: "'Full-text / fuzzy / relevance search' → <strong>OpenSearch</strong>. 'Months of searchable logs cheaper' → <strong>UltraWarm + ISM</strong>. Trap: Athena also queries logs, but it's ad-hoc SQL in seconds; 'interactive dashboard, near real time' picks OpenSearch.",
      terms: [
        { t: "Domain", d: "An OpenSearch Service cluster: data nodes, master nodes and settings." },
        { t: "Shard", d: "A slice of an index; replicas of shards give availability and read throughput." },
        { t: "UltraWarm", d: "S3-backed read-only tier for older indices at roughly a tenth of hot cost." },
        { t: "ISM", d: "Index State Management: policies that move indices hot → warm → cold → delete by age." },
        { t: "OpenSearch Dashboards", d: "Built-in visualization UI (the Kibana descendant)." }
      ],
      check: [
        {
          q: "A shop on DynamoDB wants search with typo tolerance and relevance ranking. What do you add?",
          options: ["A DynamoDB GSI on product name", "Replicate to OpenSearch via Streams or zero-ETL", "Athena over a DynamoDB export"],
          answer: 1,
          why: "Only OpenSearch does relevance-ranked, fuzzy text search. A GSI only matches exact keys or prefixes; Athena is slow ad-hoc SQL, not search."
        },
        {
          q: "Logs must stay searchable for 90 days at lowest cost, but most queries touch the last week. Design?",
          options: ["90 days on hot nodes", "7 days hot, then UltraWarm via ISM", "Delete after 7 days and use CloudTrail"],
          answer: 1,
          why: "Hot for recent data, then ISM moves older indices to cheap S3-backed UltraWarm that is still queryable. All-hot pays top price for rarely read data."
        }
      ]
    },
    "streaming": {
      minutes: 4,
      tldr: [
        "<strong>Kinesis Data Streams</strong> is a log you read yourself: ordered per shard, replayable (24 h up to 365 days), many consumers.",
        "One shard = <strong>1 MB/s or 1,000 records/s in, 2 MB/s out</strong>. Enhanced fan-out gives each consumer its own 2 MB/s.",
        "<strong>Firehose</strong> (now Amazon Data Firehose) is a pipe that <strong>delivers</strong> to S3, Redshift, OpenSearch, Splunk, HTTP. Buffers, so ~1 minute, no replay.",
        "<strong>Managed Flink</strong> does stateful maths over moving windows: rolling averages, sessions, pattern detection.",
        "<strong>MSK</strong> is managed Apache Kafka. Pick it when the question says Kafka."
      ],
      analogy: "Kinesis Data Streams is a recorded TV channel: many people can watch, rewind and replay. Firehose is a conveyor belt that drops boxes at one warehouse door every minute. Flink is the worker keeping a running tally as boxes pass.",
      examTip: "The sharpest split on the exam: 'load streaming data into S3/Redshift/OpenSearch with least management' → <strong>Firehose</strong>; 'custom real-time processing, replay, multiple consumers, ordering' → <strong>Kinesis Data Streams</strong>.",
      terms: [
        { t: "Shard", d: "Kinesis capacity unit: 1 MB/s in, 2 MB/s out, ordered records." },
        { t: "Partition key", d: "Decides which shard a record goes to; a hot key throttles one shard." },
        { t: "Enhanced fan-out", d: "Each registered consumer gets its own 2 MB/s per shard, pushed with low latency." },
        { t: "Buffering (Firehose)", d: "Firehose collects by size and time and flushes on whichever limit hits first." },
        { t: "Windowed aggregation", d: "Computing over a sliding or fixed time window, e.g. a 5-minute rolling average." }
      ],
      check: [
        {
          q: "Clickstream events must be computed into a rolling 5-minute count per page in real time. Which service does the computing?",
          options: ["Firehose with a Lambda transform", "Managed Service for Apache Flink", "Athena on the S3 output"],
          answer: 1,
          why: "Rolling windows need state across records, which is Flink's job. Firehose's Lambda sees one batch at a time with no memory; Athena is batch SQL, not real time."
        },
        {
          q: "Three separate apps must each read the same real-time stream and be able to replay the last day. Choose:",
          options: ["Amazon Data Firehose", "Kinesis Data Streams", "SQS standard queue"],
          answer: 1,
          why: "KDS keeps records for replay and lets multiple consumers read independently. Firehose has no replay or second reader; SQS deletes messages once consumed."
        }
      ]
    },
    "emr-quicksight-lakeformation": {
      minutes: 3,
      tldr: [
        "<strong>EMR</strong> runs real Spark/Hadoop/HBase/Presto clusters you control. Modern habit: data in S3, cluster spun up per job then deleted.",
        "Cheapest EMR: primary and core nodes On-Demand, <strong>task nodes on Spot</strong> (they hold no HDFS data, so losing them is safe).",
        "<strong>QuickSight</strong> is serverless BI dashboards. <strong>SPICE</strong> caches data in memory so dashboards are fast and don't rescan the source.",
        "<strong>Lake Formation</strong> gives database, table, <strong>column and row-level</strong> permissions over the lake. <strong>LF-tags</strong> scale this to thousands of tables."
      ],
      analogy: "Lake Formation is a building's front desk that hands each visitor a keycard opening only the rooms, and even the drawers, they're allowed into — instead of fitting a separate lock on every door.",
      examTip: "'Minimize EMR cost, interruption OK' → <strong>Spot task nodes</strong>. 'Dashboard slow or Athena bill exploding from viewers' → <strong>SPICE</strong>. 'Column/row-level access on the lake' → <strong>Lake Formation</strong>. S3 bucket policies can't see columns, so any per-column bucket-policy option is wrong.",
      terms: [
        { t: "Core vs task node", d: "Core nodes store HDFS data and compute; task nodes only compute, so they're safe on Spot." },
        { t: "EMRFS", d: "Lets EMR read and write S3 directly so clusters can be short-lived." },
        { t: "SPICE", d: "QuickSight's in-memory engine; imported data serves dashboards without hitting the source." },
        { t: "Embedded analytics", d: "QuickSight dashboards placed inside your own app, with per-user row-level security." },
        { t: "LF-tags", d: "Tags on lake resources; grant access by tag so new tables inherit permissions automatically." }
      ],
      check: [
        {
          q: "Analysts must see a customer table but not its SSN column, across Athena and EMR. What do you use?",
          options: ["S3 bucket policy per column", "Lake Formation column-level permissions", "Separate IAM users per engine"],
          answer: 1,
          why: "Lake Formation grants column and row-level access enforced inside integrated engines. S3 policies only see objects, not columns inside files."
        },
        {
          q: "A large EMR Spark job can tolerate lost workers. How do you cut cost most safely?",
          options: ["Run core nodes on Spot", "Run task nodes on Spot", "Run the primary node on Spot"],
          answer: 1,
          why: "Task nodes hold no HDFS data, so Spark just retries their work. Losing core nodes loses HDFS data; losing the primary kills the whole cluster."
        }
      ]
    },
    "decision-table": {
      minutes: 3,
      tldr: [
        "Most analytics questions are 'pick the service'. Pull out three things: <strong>how fast</strong>, <strong>what kind of query</strong>, and <strong>how little ops</strong>.",
        "Latency ladder: sub-second → OpenSearch / KDS / Flink; ~1 minute → Firehose; seconds-to-minutes ad-hoc → Athena; batch → Glue / EMR.",
        "The services chain: <strong>KDS → Flink → Firehose → S3 → Glue catalog → Athena / Redshift → QuickSight</strong>, with Lake Formation governing reads.",
        "'Least operational overhead' picks the serverless option. Intermittent use → pay-per-query; steady heavy use → provisioned or reserved.",
        "If data is already in S3, query it in place. Don't migrate it into a database."
      ],
      analogy: "Think of a kitchen line: one station receives deliveries (Kinesis/Firehose), one stores them (S3), one labels shelves (Glue), and several cooks (Athena, Redshift, EMR) use the same pantry. A wrong answer asks one station to do another's job.",
      examTip: "When two answers both work, use the tie-breakers: the <strong>ops clause</strong> picks serverless, the <strong>latency number</strong> picks the tier, the <strong>cost clause</strong> picks per-query vs reserved. 'Firehose doing stateful processing' or 'Athena serving sub-second dashboards' are distractors.",
      terms: [
        { t: "Latency class", d: "Real-time, near-real-time, interactive, or batch: the first filter for choosing a service." },
        { t: "Operational-overhead clause", d: "Phrases like 'least management' that push the answer toward serverless services." },
        { t: "Reference pipeline", d: "The standard chain: stream in, land in S3, catalog it, query it, visualise it." },
        { t: "Query in place", d: "Analyse data where it sits in S3 instead of copying it into a database first." }
      ],
      check: [
        {
          q: "Monthly compliance reports over 7 years of logs in S3, rare ad-hoc questions, lowest cost. Choose:",
          options: ["Redshift provisioned cluster", "Athena over partitioned Parquet", "OpenSearch with all data hot"],
          answer: 1,
          why: "Rare queries on data already in S3 fit pay-per-query Athena. Redshift and OpenSearch would sit idle and billing between monthly reports."
        },
        {
          q: "An on-prem Kafka pipeline moves to AWS unchanged, then needs rolling 10-minute fraud aggregations. Which pair?",
          options: ["Kinesis Data Streams + Firehose", "MSK + Managed Flink", "MSK + Firehose Lambda transform"],
          answer: 1,
          why: "The word Kafka picks MSK; rolling windows need stateful Flink. Firehose cannot keep state across records, and Kinesis breaks the unchanged-Kafka clause."
        }
      ]
    }
  }
});
