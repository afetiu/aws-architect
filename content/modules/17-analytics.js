/* Module 17 — Analytics & Data Lakes (SAA track) */
window.COURSE.register({
  id: "analytics",
  order: 17,
  track: "saa",
  title: "Analytics & Data Lakes",
  description: "The S3 data-lake pattern and the constellation around it: Glue as the shared metastore, Athena's pay-per-byte-scanned economics, Redshift's MPP internals, OpenSearch, Kinesis/Firehose/Flink streaming, EMR, QuickSight, and Lake Formation — capped by the service-selection decision table that decides a large fraction of exam questions.",
  examWeight: "One of the highest-yield SAA-C03 areas. Most questions are pure service selection: match the workload's latency, query pattern, and ops-burden requirements to Athena vs Redshift vs OpenSearch vs EMR, and pick the right Kinesis flavor.",
  lessons: [
    {
      id: "data-lake-pattern",
      title: "The S3 data lake: zones, partitions, and columnar economics",
      html: `
<p>The AWS analytics stack is a decomposed data warehouse: S3 is the storage engine, Glue is the system catalog, and Athena/Redshift/EMR/Flink are interchangeable query and compute engines over the same files. Once you see it that way, most service choices become "which execution engine", not "which database". The foundation determines everything: how data is laid out in S3 decides cost and performance for every engine downstream.</p>

<h3>Zones: raw → curated</h3>
<p>The standard lake is layered, typically as separate prefixes or buckets:</p>
<ul>
<li><strong>Raw (landing/bronze):</strong> data exactly as received — original format, append-only, immutable. This is your replay and audit substrate; when a transform is wrong, you rebuild curated from raw rather than re-ingesting from sources.</li>
<li><strong>Curated (processed/silver → gold):</strong> cleaned, deduplicated, schema-enforced, converted to columnar, partitioned for the query patterns. Consumers (Athena, Redshift Spectrum, QuickSight, ML) read here, never from raw.</li>
</ul>
<p>Lifecycle policies differ per zone: raw ages to Glacier tiers; curated stays on S3 Standard or Intelligent-Tiering because engines query it. Access control differs too — raw is producer-and-pipeline only; curated is where Lake Formation grants live.</p>

<h3>Partitioning: the coarse index</h3>
<p>S3 has no indexes, so <strong>the prefix structure is the index</strong>. Engines prune partitions by matching WHERE predicates against path segments in Hive-style layout:</p>
<pre><code>s3://lake-curated/events/year=2026/month=07/day=21/part-0001.parquet</code></pre>
<ul>
<li>Partition on columns that appear in almost every query's WHERE clause — nearly always date/time, often plus a coarse dimension (region, tenant tier).</li>
<li><strong>Cardinality discipline:</strong> partitioning by high-cardinality keys (user_id) creates millions of tiny objects and partitions — metadata operations dominate, small files kill throughput. Aim for partitions holding tens of MBs to GBs, and files of <strong>128 MB–1 GB</strong>; compact small files (Firehose buffering, Glue/Spark compaction jobs) as a standing chore.</li>
<li>A query without a predicate on the partition columns scans everything — partitioning only helps queries that can prune.</li>
</ul>

<h3>Columnar formats: the cost math</h3>
<p><strong>Parquet</strong> (and ORC) are columnar, compressed, and self-describing, with min/max statistics per row group enabling predicate pushdown. Since Athena bills per byte scanned, format choice is directly a bill:</p>
<table>
<thead><tr><th></th><th>1 TB raw as CSV/JSON</th><th>Same data as partitioned Parquet</th></tr></thead>
<tbody>
<tr><td>Size on S3</td><td>~1 TB</td><td>~130–250 GB (columnar compression)</td></tr>
<tr><td>Scanned for a 3-column query</td><td>Whole objects (row formats read everything)</td><td>Only those columns' chunks, only matching partitions</td></tr>
<tr><td>Typical Athena cost</td><td>~5 dollars/query at 5 dollars per TB</td><td>Cents — 30–100x cheaper is routine</td></tr>
</tbody>
</table>
<p>The compounding is the point: compression (~4x) × column pruning (read 3 of 40 columns) × partition pruning (1 day of 365) multiplies. Converting a lake from JSON to partitioned Parquet is the single highest-ROI act in AWS analytics, and the exam knows it.</p>

<div class="callout exam">"Reduce Athena query costs / improve performance" → the answer set is always some combination of: <strong>convert to Parquet/ORC, compress, partition by date, and query only needed columns</strong>. Any option that says "use CSV for faster parsing" or "increase Athena capacity" is a distractor (Athena has no capacity dial to buy in that sense).</div>

<div class="callout deep">Why columnar wins mechanically: a Parquet file groups rows into row groups (~128 MB), stores each column's values contiguously and compressed within the group, and records per-column min/max stats. A query for three columns with a date predicate reads footer metadata, prunes row groups via stats, then reads only three column chunks — the engine never touches the other 37 columns. Row formats physically interleave every column, so any read is a full read.</div>

<div class="callout war">The small-files problem is the lake killer in practice: streaming ingestion writing a file per record produces millions of KB-sized objects; every query then pays per-object overhead (S3 GET latency, footer parsing) that dwarfs data reading. Symptoms: Athena queries slow despite tiny data volumes. Fixes: Firehose buffering (size/time thresholds), periodic compaction jobs, or table formats (Iceberg) with built-in compaction. Design ingestion for file size from day one.</div>

<h3>Table formats: the modern layer</h3>
<p>Plain Hive-style layouts cannot update or delete rows without rewriting files, and schema evolution is fragile. <strong>Apache Iceberg</strong> (first-class in Glue/Athena/EMR/Redshift) adds a metadata layer over Parquet giving ACID transactions, row-level updates/deletes/merges, snapshots and time travel, and hidden partitioning. For SAA depth: know that "data lake with record-level updates and ACID" → Iceberg-backed tables on S3, not a database migration.</p>
`
    },
    {
      id: "glue",
      title: "Glue: the shared metastore, crawlers, and serverless ETL",
      html: `
<p>Glue is two products sharing a name, and separating them clarifies every exam question: the <strong>Data Catalog</strong> (a serverless, Hive-metastore-compatible schema registry that the whole analytics stack shares) and <strong>Glue ETL</strong> (serverless Spark jobs). The catalog is the strategically important half.</p>

<h3>The Data Catalog</h3>
<p>The catalog stores <strong>databases → tables → partitions</strong>: schema (columns/types), format/SerDe, S3 location, and partition entries. Crucially, it holds <strong>metadata only — the data never leaves S3</strong>. Athena, Redshift Spectrum, EMR (as its Hive metastore), Glue jobs, and Lake Formation all read the same catalog, which is what makes "define schema once, query from five engines" work. One catalog per account per region; cross-account access via resource policies or Lake Formation grants.</p>

<h3>Crawlers</h3>
<p>Crawlers walk an S3 prefix (or JDBC source), infer schema and format via classifiers, detect Hive-style partition directories, and create/update catalog tables. Run them on schedule or on demand. Senior-grade caveats:</p>
<ul>
<li>Inference is heuristic: inconsistent JSON, mixed types, or malformed rows yield wrong or fragmented schemas (a crawler creating hundreds of tables from one dataset usually means inconsistent prefix structure). Production lakes with stable schemas often skip crawlers entirely — declare tables via DDL/IaC, add partitions explicitly or via <strong>partition projection</strong> (next lesson).</li>
<li>New partitions are NOT visible to queries until registered in the catalog: crawler re-run, ALTER TABLE ADD PARTITION, or projection. "New data does not appear in Athena" is almost always an unregistered-partition question.</li>
</ul>

<h3>Glue ETL jobs</h3>
<p>Glue jobs are <strong>managed Spark</strong> (or lightweight Python shell) — you supply a script (PySpark/Scala, optionally generated by Glue Studio's visual editor), Glue provisions the cluster invisibly, bills per <strong>DPU-hour</strong> (1 DPU = 4 vCPU + 16 GB) with per-second billing, and tears it down. Features that matter:</p>
<ul>
<li><strong>DynamicFrames</strong> — Glue's schema-flexible extension of DataFrames that tolerates messy, semi-structured data (choice types resolved late), convertible to/from Spark DataFrames.</li>
<li><strong>Job bookmarks</strong> — checkpointing that tracks processed files/rows so scheduled runs process only new data. The "how do I process only incremental arrivals" answer.</li>
<li><strong>Workflows and triggers</strong> orchestrate crawler → job → crawler chains; Step Functions for anything complex.</li>
<li>Streaming ETL jobs consume Kinesis/Kafka micro-batches for the mid-latency zone between Firehose-and-done and full Flink.</li>
</ul>

<h3>Glue vs EMR vs Lambda for transforms</h3>
<table>
<thead><tr><th></th><th>Glue ETL</th><th>EMR</th><th>Lambda</th></tr></thead>
<tbody>
<tr><td>Mental model</td><td>Serverless Spark job</td><td>Your Hadoop/Spark cluster</td><td>Event-driven function</td></tr>
<tr><td>Ops burden</td><td>None (job-level)</td><td>Cluster config, scaling, tuning</td><td>None</td></tr>
<tr><td>Control</td><td>Spark version/params, limited</td><td>Full: any framework, custom AMIs, bootstrap</td><td>Code only, 15 min / 10 GB caps</td></tr>
<tr><td>Sweet spot</td><td>Scheduled/serverless ETL into the lake</td><td>Long-running or exotic big data, Spot economics at scale</td><td>Small per-event transforms (Firehose records)</td></tr>
</tbody>
</table>
<p>Selection logic: per-record, small, event-shaped → Lambda. Batch/distributed transforms with minimal ops → Glue. Need specific framework versions, HBase/Presto/Flink-on-cluster, custom tuning, or massive Spot fleets → EMR.</p>

<div class="callout exam">Keyword mappings: "central metadata repository for Athena/EMR/Spectrum" or "Hive metastore replacement" → <strong>Glue Data Catalog</strong>. "Automatically discover schemas of new datasets" → <strong>crawler</strong>. "Serverless ETL to convert CSV to Parquet" → <strong>Glue job</strong> (this exact sentence is practically a recurring question). "Process only new data each run" → <strong>job bookmarks</strong>. Glue chosen over EMR whenever the stem stresses "least operational overhead".</div>

<div class="callout limits">Glue numbers: 1 DPU = <strong>4 vCPU / 16 GB</strong>; Spark jobs have a 2-DPU minimum, billed per second (1-minute minimum). Catalog: first million objects and requests monthly are free — catalog cost is rarely the issue; DPU-hours are the bill to watch. Crawler billing is also DPU-time.</div>

<div class="callout war">Two production lessons. Crawlers on a schedule against an actively-written prefix can catch half-written multipart files or transient schema drift and corrupt the table definition mid-day — prefer explicit partition registration for critical tables. And Glue job cold starts (cluster spin-up ~30–60 s) make it wrong for latency-sensitive paths; it is a batch tool, not an API backend.</div>
`
    },
    {
      id: "athena",
      title: "Athena: pay-per-byte SQL and the art of scanning less",
      html: `
<p>Athena is <strong>managed Trino (Presto)</strong> pointed at S3 through the Glue catalog: fully serverless, standard SQL, zero infrastructure, and a brutally simple pricing model — <strong>about 5 dollars per TB of data scanned</strong>, 10 MB minimum per query. That price model IS the performance model: every optimization is a form of "scan less", which makes Athena tuning unusually honest.</p>

<h3>Execution model</h3>
<p>Each query gets ephemeral, AWS-managed Trino capacity: the coordinator plans against catalog metadata, prunes partitions from the WHERE clause, fans out splits to workers that read S3 objects directly, and writes results to a <strong>query result location in S3</strong> (always — even SELECTs materialize results there). No clusters, no warm pools to manage, per-query concurrency quotas instead of capacity planning. Latency floor is seconds — Athena is interactive-analytics fast, not OLTP fast, and it is not for dashboards needing sub-second response (that is pre-aggregation or Redshift/OpenSearch territory).</p>

<h3>The scan-less toolbox</h3>
<ul>
<li><strong>Columnar + compression + partitioning</strong> — the big three from the lake lesson; they do 90 percent of the work.</li>
<li><strong>Partition projection:</strong> instead of storing partition entries in the catalog (and crawling to add them), you declare partition <em>patterns</em> as table properties — date ranges, integer ranges, enums — and Athena computes which partitions exist at plan time. Kills both the "crawler hasn't run" staleness problem and planning slowness on tables with hundreds of thousands of partitions. For predictable layouts (anything date-based), projection is strictly better than crawled partitions.</li>
<li><strong>CTAS (CREATE TABLE AS SELECT):</strong> Athena as a transformation engine — query raw CSV/JSON, write the results back to S3 as partitioned Parquet, registered in the catalog in one statement. The lightweight alternative to a Glue job for SQL-expressible transforms. INSERT INTO appends incrementally. (CTAS writes are capped at 100 partitions per statement — chunk bigger backfills.)</li>
<li><strong>Query hygiene:</strong> SELECT only needed columns (SELECT star defeats columnar pruning); use LIMIT with ORDER BY awareness (LIMIT alone does not reduce scan for sorted output); approximate aggregations (approx_distinct) where exactness is not required.</li>
</ul>

<h3>Workgroups</h3>
<p>Workgroups are Athena's governance unit: separate teams/workloads with distinct result locations, enforced settings, CloudWatch metrics, and — the exam-relevant part — <strong>per-query and per-workgroup byte-scanned limits</strong> that cut off runaway queries. "Prevent analysts from accidentally scanning 50 TB" → workgroup data-usage controls. Workgroups also toggle engine versions and can enforce encryption settings for results.</p>

<h3>Federated queries and edges</h3>
<p>Athena federated query uses Lambda-based connectors to reach DynamoDB, RDS, CloudWatch Logs, and others — convenient for occasional joins, not a replacement for landing data in the lake (per-query connector invocations are slow and costly at volume). Athena also reads CloudTrail, ALB/VPC flow logs in place — the standard "ad-hoc investigation of logs already in S3" answer.</p>

<div class="callout exam">Athena is the answer when the stem combines: <strong>data already in S3 + SQL + ad-hoc/occasional + serverless/no infrastructure</strong>. It loses to Redshift when the stem says high-concurrency BI dashboards, complex joins across a modeled warehouse, or predictable heavy daily workloads. Cost questions: 5 dollars/TB scanned — then apply Parquet/partition math. "Queries slow and new data missing on a heavily partitioned table" → partition projection. "Convert query results into partitioned Parquet using only SQL" → CTAS. "Control per-team query spend" → workgroups.</div>

<div class="callout limits">Numbers: ~<strong>5 dollars per TB scanned</strong> (10 MB minimum per query); default DML query timeout 30 minutes; CTAS max <strong>100 partitions</strong> per statement; result sets land in S3 (that bucket needs lifecycle rules — it grows forever otherwise). Per-account default concurrency quotas are soft but real — burst dashboard traffic can queue.</div>

<div class="callout war">Athena failure modes in production: the forgotten result bucket accumulating TBs; dashboards pointed straight at Athena hammering the same 2-billion-row aggregation every 30 seconds (pre-aggregate via CTAS/scheduled queries instead); tables with millions of catalog partitions taking longer to plan than to execute (projection); and JOINs spilling because one side is a giant unpartitioned JSON table. None of these are Athena's fault; all of them are layout's fault.</div>
`
    },
    {
      id: "redshift",
      title: "Redshift: MPP internals, distribution, and when it beats Athena",
      html: `
<p>Redshift is a true MPP columnar warehouse — PostgreSQL-descended SQL on a shared-nothing cluster. Where Athena is stateless compute renting your S3 layout, Redshift <em>owns</em> its data layout: it controls distribution, sort order, compression, and statistics, which is exactly why it wins on complex joins and high concurrency — and why it costs you data modeling effort.</p>

<h3>Architecture</h3>
<ul>
<li><strong>Leader node:</strong> accepts connections (JDBC/ODBC, Data API), parses/plans, compiles query segments to code, distributes to compute nodes, aggregates results. Not billed separately on provisioned clusters.</li>
<li><strong>Compute nodes:</strong> hold data slices; each node is split into <strong>slices</strong> (one per vCPU-ish), the unit of parallelism. Every slice processes its own data portion for every query step.</li>
<li><strong>RA3 nodes + managed storage:</strong> the modern node family separates compute from storage — hot data cached on local NVMe, full dataset in Redshift Managed Storage backed by S3, billed independently. Compute scales without re-sharding all data; this is also what enables <strong>data sharing</strong> (multiple clusters/workgroups querying one dataset without copies) and effectively unbounded storage.</li>
<li><strong>Redshift Serverless:</strong> capacity in RPUs, auto-scaled and auto-paused; pay per-second while queries run. Right for intermittent or unpredictable warehousing; provisioned RA3 with reserved pricing wins for steady 24/7 load.</li>
</ul>

<h3>Distribution styles: where rows physically live</h3>
<p>Shared-nothing joins are fast only when co-located; DISTSTYLE decides the shuffle:</p>
<table>
<thead><tr><th>Style</th><th>Placement</th><th>Use</th></tr></thead>
<tbody>
<tr><td><strong>KEY</strong></td><td>Hash of a column picks the slice</td><td>Distribute fact and its biggest-join dimension on the join key → co-located, shuffle-free joins</td></tr>
<tr><td><strong>EVEN</strong></td><td>Round-robin</td><td>No dominant join key; large tables joined many ways</td></tr>
<tr><td><strong>ALL</strong></td><td>Full copy on every node</td><td>Small, slow-changing dimensions (joins never shuffle them)</td></tr>
<tr><td><strong>AUTO</strong></td><td>Redshift adapts (ALL→EVEN/KEY as tables grow)</td><td>Default; fine until profiling says otherwise</td></tr>
</tbody>
</table>
<p>A skewed KEY column (one customer = 30 percent of rows) concentrates data and work on one slice — the hot-partition problem wearing a warehouse costume. <strong>Sort keys</strong> are the other physical lever: rows stored sorted let zone maps (per-block min/max) skip blocks for range predicates — a compound sort key on the dominant filter column (almost always the date column) is the Redshift analog of partitioning.</p>

<div class="callout deep">Query execution: the leader compiles each query into C++ segments shipped to slices (first-run compilation latency is why a brand-new query is slower than its second run). Columnar blocks are 1 MB with per-block zone maps; a date-sorted fact table answers last-week queries reading a sliver of blocks. VACUUM (re-sort/reclaim) and ANALYZE (stats) are the maintenance verbs — largely automated now, but skew and stale stats remain the first suspects for a suddenly-slow query.</div>

<h3>The surrounding machinery</h3>
<ul>
<li><strong>Spectrum:</strong> external tables over S3 via the Glue catalog — the cluster's slices dispatch scans to a shared Spectrum fleet, letting one SQL statement join hot warehouse tables with cold exabyte-scale lake data. Billed per TB scanned, like Athena. Pattern: hot 13 months in Redshift, full history in S3, one UNION ALL view over both.</li>
<li><strong>Concurrency scaling:</strong> when queues back up, Redshift attaches transient clusters to absorb read (and some write) bursts — billed per-second with a free daily credit accrual. The answer to "dashboard queries queue during Monday 9 a.m. peaks".</li>
<li><strong>Materialized views:</strong> precomputed joins/aggregations with incremental REFRESH, plus <strong>automatic query rewriting</strong> — queries matching an MV's shape get silently redirected. The standard fix for expensive repeated dashboard aggregations. Streaming ingestion (from Kinesis/MSK) can land directly into MVs for near-real-time warehousing.</li>
<li><strong>Loading:</strong> COPY from S3 is the sanctioned bulk path — parallel per-slice loads (split input into multiples of the slice count, compressed). Singleton INSERTs are an anti-pattern; zero-ETL integrations (from Aurora/RDS/DynamoDB) remove pipelines the exam used to require DMS for.</li>
</ul>

<h3>Redshift vs Athena: the decision</h3>
<table>
<thead><tr><th>Choose Athena</th><th>Choose Redshift</th></tr></thead>
<tbody>
<tr><td>Ad-hoc, intermittent, unpredictable</td><td>Sustained daily BI load, high concurrency</td></tr>
<tr><td>Data lives in S3, many engines share it</td><td>Complex multi-join star schemas needing modeled layout</td></tr>
<tr><td>Zero infrastructure, per-query cost</td><td>Predictable latency SLAs; sub-second dashboards via MVs</td></tr>
<tr><td>Cost scales with bytes scanned</td><td>Cost is capacity-shaped (or RPU-seconds serverless)</td></tr>
</tbody>
</table>

<div class="callout exam">"Petabyte-scale data warehouse / BI with thousands of concurrent dashboard users / complex joins" → Redshift. "Query S3 data in place from the warehouse without loading" → Spectrum. "Queries queue at peak" → concurrency scaling. "Same expensive aggregation repeatedly" → materialized views. "Warehouse used a few hours a day, minimize admin" → Redshift Serverless. Fact/dimension co-location stems → DISTKEY on the join column, DISTSTYLE ALL for small dimensions, sort key on the date filter.</div>

<div class="callout war">Classic Redshift self-inflicted wounds: loading via millions of single INSERTs (use COPY); DISTKEY on a skewed column (one slice at 100 percent, cluster "slow"); no sort key so every query full-scans; forgetting that Spectrum bills per TB scanned just like Athena — an unpartitioned lake is expensive from either engine. The physical design freedom that makes Redshift fast is a foot-gun for teams that skip the modeling.</div>
`
    },
    {
      id: "opensearch",
      title: "OpenSearch Service: search, log analytics, and its cost ladder",
      html: `
<p>Amazon OpenSearch Service is managed OpenSearch (the Elasticsearch fork) — an inverted-index document store for the two workloads nothing else on this exam does well: <strong>full-text search</strong> (relevance ranking, fuzzy matching, faceting, autocomplete) and <strong>interactive log/trace analytics</strong> (OpenSearch Dashboards, the Kibana descendant). If the stem says "search" with any sophistication — typo tolerance, relevance, faceted navigation — the answer is OpenSearch; neither Athena, Redshift, nor DynamoDB does relevance-ranked text retrieval.</p>

<h3>Mental model and operations</h3>
<p>You run a <strong>domain</strong>: data nodes holding index shards (primaries + replicas), ideally three <strong>dedicated master nodes</strong> for cluster-state quorum (three, not two — quorum math), spread across AZs with replica shards providing both HA and read throughput. It is the most "database-like" managed service in this module: you size nodes, plan shards (aim for shards in the 10–50 GB range; thousands of tiny shards melt the masters), manage index lifecycle, and watch JVM heap pressure. A <strong>Serverless</strong> option exists (separate compute for indexing vs search, OCU-billed) for teams that want none of that, with collection types for search, time-series, and vectors.</p>

<h3>The storage-tier ladder</h3>
<p>Log retention economics drive the tiering, and the exam tests the ladder:</p>
<table>
<thead><tr><th>Tier</th><th>Backing</th><th>Query latency</th><th>Use</th></tr></thead>
<tbody>
<tr><td>Hot</td><td>Instance storage / EBS on data nodes</td><td>Fastest, writable</td><td>Live indexing + recent data (days)</td></tr>
<tr><td><strong>UltraWarm</strong></td><td>S3-backed, cached by warm nodes</td><td>Slower, read-only</td><td>Weeks-to-months of queryable history at ~1/10th hot cost</td></tr>
<tr><td>Cold</td><td>S3, detached from compute</td><td>Must reattach to query</td><td>Archive/compliance, rarely queried</td></tr>
</tbody>
</table>
<p>Index State Management (ISM) policies automate hot → warm → cold → delete transitions by index age — the standard "90 days searchable, cheap" architecture: 7 days hot, 83 days UltraWarm, then delete or cold.</p>

<h3>Ingestion patterns</h3>
<ul>
<li><strong>Kinesis Data Firehose → OpenSearch</strong> — the canonical near-real-time log pipeline (with S3 backup of failed/all records).</li>
<li>CloudWatch Logs subscription filters → (Lambda/Firehose) → OpenSearch for centralizing AWS-native logs.</li>
<li>DynamoDB zero-ETL / Streams → OpenSearch: the standard "add full-text search to a DynamoDB-backed app" answer — DynamoDB stays the source of truth, OpenSearch is the search index.</li>
<li>Amazon OpenSearch Ingestion (managed Data Prepper) as the newer managed pipeline option.</li>
</ul>

<h3>OpenSearch vs CloudWatch Logs Insights</h3>
<p>Both query logs; the decision is ops-versus-capability:</p>
<table>
<thead><tr><th></th><th>CloudWatch Logs Insights</th><th>OpenSearch</th></tr></thead>
<tbody>
<tr><td>Setup</td><td>None — logs are already there</td><td>Pipeline + domain (or serverless) to run</td></tr>
<tr><td>Query model</td><td>Purpose-built query language, ad-hoc</td><td>Full DSL/SQL/PPL, aggregations, relevance</td></tr>
<tr><td>Dashboards</td><td>Basic (CloudWatch dashboards)</td><td>Rich, interactive, alerting, anomaly detection</td></tr>
<tr><td>Cost shape</td><td>Per GB ingested/scanned, zero standing cost</td><td>Standing cluster (or OCU) cost, cheap at high query volume</td></tr>
</tbody>
</table>
<p>Rule of thumb: occasional troubleshooting queries over AWS-native logs → stay in CloudWatch. Sustained interactive analysis, long searchable retention, complex dashboards shared across teams, or full-text search → OpenSearch.</p>

<div class="callout exam">Mappings: "full-text search with fuzzy matching / relevance" → OpenSearch. "Near-real-time log analytics dashboard" → Firehose → OpenSearch → Dashboards. "Reduce cost of retaining months of searchable logs" → <strong>UltraWarm</strong> (+ ISM). "Search capability for a DynamoDB application" → replicate via Streams/zero-ETL to OpenSearch. Distractor watch: Athena also "queries logs" — Athena is ad-hoc SQL over S3 at seconds latency and per-scan cost; OpenSearch is interactive, indexed, sub-second. The stem's words "interactive dashboard" or "near real time" pick OpenSearch; "occasionally analyze historical logs already in S3" picks Athena.</div>

<div class="callout war">OpenSearch domains are the analytics stack's highest-touch component: shard-count mistakes are near-permanent (reindex to fix), JVM heap ceilings cap usable node memory, and an un-lifecycle-managed log domain grows until the cluster reds out. Every OpenSearch deployment needs ISM policies and index templates on day one — retrofitting under a red cluster status is misery. Also: it is a search index, not a system of record — treat it as rebuildable from the source of truth.</div>
`
    },
    {
      id: "streaming",
      title: "Streaming: Kinesis, Firehose, Flink, and MSK",
      html: `
<p>AWS streaming questions reduce to one distinction: <strong>Kinesis Data Streams is a log you consume; Firehose is a delivery pipe that lands data somewhere</strong>. Layer Flink on top for real computation, and swap in MSK when the requirement literally says Kafka. Get those four roles straight and the questions answer themselves.</p>

<h3>Kinesis Data Streams (KDS)</h3>
<p>A partitioned, ordered, replayable record log — same species as Kafka. Records hash by partition key into <strong>shards</strong>; each shard sustains 1 MB/s or 1,000 records/s in, 2 MB/s out (shared across consumers), with strict ordering per shard. Retention 24 hours default, extendable to <strong>365 days</strong>; consumers replay from any point. <strong>Enhanced fan-out</strong> gives each registered consumer its own 2 MB/s per shard pushed over HTTP/2 (~70 ms) instead of sharing polled throughput. Capacity: provisioned shards (you do the math and reshard) or on-demand (autoscaling, per-GB pricing). Producers face per-shard hot-key limits — the same partition-key discipline as DynamoDB. Choose KDS when you need <strong>custom real-time consumers, ordering, replay, or multiple independent readers</strong> — sub-second processing latency via Lambda/KCL/Flink consumers.</p>

<h3>Kinesis Data Firehose</h3>
<p>Fully managed <strong>delivery</strong>: ingest (directly, or from a KDS/MSK source) and land into <strong>S3, Redshift, OpenSearch, Splunk, and HTTP endpoints</strong>. No shards, no consumers, no code, automatic scaling. The defining mechanic is <strong>buffering</strong>: Firehose accumulates by size (MBs) and time (seconds to minutes) and flushes on whichever threshold hits first — so it is <strong>near-real-time (roughly 1 minute floor at traditional buffering; a zero-buffering option narrows this), not real-time</strong>. In-flight niceties: <strong>Lambda transformation</strong> per batch (the standard place to normalize/enrich/filter), <strong>format conversion to Parquet/ORC</strong> using a Glue schema (the ingestion-side fix for the small-files/columnar problem), dynamic partitioning into Hive-style prefixes, compression, and failed-record backup to S3. There is no replay and no second consumer — it is a pipe, not a log.</p>

<div class="callout exam">The sharpest discriminator on the whole exam page: <strong>"ingest streaming data into S3/Redshift/OpenSearch with least management" → Firehose. "Custom real-time processing / multiple consumers / replay / strict ordering" → Kinesis Data Streams.</strong> If the stem tolerates ~60 seconds latency and names a Firehose destination, Firehose wins; if it demands sub-second or consumer logic, KDS (+ Lambda/Flink). Also: KDS → Firehose → S3 is a normal chain (process AND archive).</div>

<h3>Managed Service for Apache Flink</h3>
<p>Formerly Kinesis Data Analytics: managed Flink clusters (billed in KPUs) running stateful stream processing — <strong>windowed aggregations (tumbling/sliding/session), event-time semantics with watermarks, streaming joins, exactly-once state via checkpoints</strong>, in SQL/Java/Scala/Python. It reads KDS or MSK and writes anywhere Flink can. This is the answer whenever the stem needs <em>computation over a moving window</em> — "rolling 5-minute average", "detect anomaly patterns across events", "sessionize clickstreams in real time". Firehose transforms one batch at a time with no cross-record state; Lambda consumers can aggregate but you hand-roll state, windows, and exactly-once. Flink is the purpose-built tool.</p>

<h3>MSK vs Kinesis</h3>
<table>
<thead><tr><th></th><th>Kinesis Data Streams</th><th>Amazon MSK</th></tr></thead>
<tbody>
<tr><td>API</td><td>AWS-proprietary</td><td>Apache Kafka — existing clients/ecosystem work</td></tr>
<tr><td>Ops model</td><td>Serverless-ish (shards or on-demand)</td><td>Broker clusters you size/patch-window (Serverless option exists)</td></tr>
<tr><td>Fit</td><td>AWS-native pipelines, tight Lambda/Firehose integration, minimal ops</td><td>Kafka compatibility required: migrations, Kafka Connect/Streams ecosystem, fine-grained control (partitions, compacted topics, exact configs)</td></tr>
</tbody>
</table>
<p>Exam logic is blunt: the words "Apache Kafka", "existing Kafka producers/consumers", or "migrate an on-prem Kafka cluster" select MSK; otherwise Kinesis is the default streaming substrate.</p>

<div class="callout limits">Numbers: KDS shard = <strong>1 MB/s or 1,000 rec/s in, 2 MB/s out</strong> (enhanced fan-out: 2 MB/s per consumer per shard); record max 1 MB; retention 24 h → 365 days. Firehose buffering: size/time thresholds, flush on first hit — treat ~60 s as the traditional latency floor. Flink bills per KPU-hour plus state storage.</div>

<div class="callout war">Streaming failure modes: hot partition keys throttling one shard while the stream idles (choose keys like you learned in DynamoDB); Lambda-from-KDS poison records blocking a shard until max-age (configure bisect/DLQ); Firehose small-file spray into S3 when buffers are set too small (tune size up, use Parquet conversion); and MSK chosen "because we know Kafka" then under-operated — MSK manages brokers, not your topic design, partition counts, or consumer lag.</div>
`
    },
    {
      id: "emr-quicksight-lakeformation",
      title: "EMR, QuickSight, and Lake Formation",
      html: `
<p>Three supporting players with sharply defined exam roles: EMR when you need the actual big-data frameworks with control, QuickSight for BI dashboards, Lake Formation for centralized lake permissions. Each is mostly tested as a recognition problem — know exactly what each is for and the giveaway keywords.</p>

<h3>EMR: when you actually need the cluster</h3>
<p>EMR provisions and manages <strong>Hadoop-ecosystem clusters</strong> — Spark, Hive, Presto/Trino, HBase, Flink, Hudi/Iceberg — on EC2 you control. Architecture: a <strong>primary node</strong> (cluster coordination), <strong>core nodes</strong> (HDFS + compute), and <strong>task nodes</strong> (compute only, no HDFS — the safely ephemeral ones). The modern pattern treats clusters as disposable: data lives in S3 via <strong>EMRFS</strong>, the Glue Catalog serves as the metastore, so clusters are transient — spin up, run the job flow, terminate. Long-running clusters are for interactive/notebook workloads and HBase.</p>
<ul>
<li><strong>Instance fleets + Spot:</strong> fleets mix instance types and purchase options with allocation strategies. The canonical cost design: primary and core on on-demand (losing core nodes loses HDFS), <strong>task nodes on Spot</strong> — compute-only nodes tolerate interruption, and Spark retries lost tasks. This is the exam's favorite EMR question.</li>
<li><strong>EMR Serverless</strong> runs Spark/Hive jobs with no cluster at all — when even Glue's constraints chafe (framework versions) but you want no instance management.</li>
<li>Choose EMR over Glue when you need: specific/latest framework versions, frameworks Glue lacks (HBase, Presto, custom), long-running interactive clusters, bootstrap actions/custom AMIs, or maximum cost control via Spot fleets at large scale. Otherwise Glue's zero-ops usually wins the "least operational overhead" clause.</li>
</ul>

<h3>QuickSight: the BI layer</h3>
<p>Serverless BI: dashboards over Athena, Redshift, S3, RDS, and SaaS sources, priced <strong>per user session/author</strong> rather than per server — no BI fleet to run. The two exam-relevant internals:</p>
<ul>
<li><strong>SPICE</strong> — the in-memory columnar engine. Importing a dataset into SPICE serves dashboards from QuickSight's engine instead of hammering the source per viewer: sub-second interactions, no per-view Athena scan charges, works when the source is slow or rate-limited. Scheduled/incremental refreshes keep it current. "Dashboard is slow / Athena costs exploding from dashboard traffic" → import to SPICE.</li>
<li><strong>Embedding</strong> — dashboards and even authoring embedded into your own applications with row-level security per user, including for anonymous/registered external users. "Provide analytics to customers inside our SaaS app without building charting" → embedded QuickSight.</li>
</ul>

<h3>Lake Formation: permissions over the catalog</h3>
<p>Raw S3-plus-IAM lake security means bucket policies per prefix per team — combinatorially miserable and column-blind. Lake Formation centralizes it: it sits over the Glue Data Catalog and S3 locations and grants <strong>database/table/column/row-level permissions</strong> with GRANT/REVOKE semantics. Integrated engines (Athena, Redshift Spectrum, EMR, Glue, QuickSight) enforce them by obtaining <strong>temporary, scoped S3 credentials from Lake Formation</strong> at query time — users never need direct S3 permissions to lake data, and column/row filters apply inside the engines.</p>
<ul>
<li><strong>LF-tags (tag-based access control):</strong> instead of granting on thousands of individual tables, assign tags (domain=finance, sensitivity=pii) to databases/tables/columns and grant on tag expressions — new tables inherit access by being tagged, and policy count stops scaling with table count. The scalable-governance answer.</li>
<li>Cross-account sharing of catalog resources (with RAM under the hood) makes it the backbone for data-mesh-style multi-account lakes.</li>
</ul>

<div class="callout exam">Keyword table: "Spark/Hadoop with specific versions or full control" → EMR; "minimize EMR cost, interruption-tolerant" → <strong>Spot task nodes via instance fleets</strong>. "BI dashboards, pay-per-session, no servers" → QuickSight; "dashboards slow or expensive against source" → <strong>SPICE</strong>; "analytics inside our app for customers" → embedding. "Centralized fine-grained (column-level / row-level) access control for the data lake" → <strong>Lake Formation</strong>; "manage permissions at scale across many tables/accounts" → <strong>LF-tags</strong>. An option offering per-column S3 bucket policies is always wrong — S3 policies cannot see columns.</div>

<div class="callout war">Lake Formation adoption is a migration, not a toggle: existing lakes run in a hybrid mode where legacy IAM-based access ("IAMAllowedPrincipals") coexists with LF grants, and half-migrated lakes produce baffling AccessDenied-or-wide-open behavior. Plan the cutover per-database, and register S3 locations deliberately. On EMR: the story is Spot on task nodes — putting core nodes on Spot and losing HDFS mid-job is a rite of passage nobody needs to repeat.</div>
`
    },
    {
      id: "decision-table",
      title: "The master decision table: which analytics service",
      html: `
<p>A large share of SAA analytics questions are pure selection: a workload description with four services as options. The engineering answer and the exam answer align if you extract three variables from the stem: <strong>latency class</strong> (real-time, near-real-time, interactive, batch), <strong>query pattern</strong> (SQL ad-hoc, modeled BI, full-text search, stream computation, framework code), and the ever-present <strong>operational-overhead clause</strong> ("least management" biases serverless: Athena, Firehose, Glue, QuickSight, serverless flavors).</p>

<h3>The table</h3>
<table>
<thead><tr><th>Requirement in the stem</th><th>Service</th><th>Discriminating signal</th></tr></thead>
<tbody>
<tr><td>Ad-hoc SQL on data already in S3, pay per query</td><td><strong>Athena</strong></td><td>"serverless", "occasional", "already in S3"</td></tr>
<tr><td>Enterprise warehouse, high-concurrency BI, complex joins</td><td><strong>Redshift</strong></td><td>"petabyte warehouse", "thousands of dashboard users"</td></tr>
<tr><td>Warehouse SQL joining S3 data without loading it</td><td><strong>Redshift Spectrum</strong></td><td>"exabyte in S3", "without loading into the cluster"</td></tr>
<tr><td>Full-text search, relevance, fuzzy matching</td><td><strong>OpenSearch</strong></td><td>"search", "autocomplete", "faceted"</td></tr>
<tr><td>Interactive near-real-time log dashboards</td><td><strong>OpenSearch (+ Firehose)</strong></td><td>"log analytics", "visualize in near real time"</td></tr>
<tr><td>Deliver streams to S3/Redshift/OpenSearch, no code</td><td><strong>Firehose</strong></td><td>"least management", "buffer", ~minute latency OK</td></tr>
<tr><td>Real-time stream, custom consumers, replay, ordering</td><td><strong>Kinesis Data Streams</strong></td><td>"sub-second", "multiple applications consume"</td></tr>
<tr><td>Stateful windowed computation on streams</td><td><strong>Managed Flink</strong></td><td>"rolling window", "sessionize", "real-time aggregation"</td></tr>
<tr><td>Kafka API compatibility</td><td><strong>MSK</strong></td><td>the word "Kafka"</td></tr>
<tr><td>Serverless ETL, format conversion, catalog + crawlers</td><td><strong>Glue</strong></td><td>"CSV to Parquet", "metadata catalog", "no infrastructure"</td></tr>
<tr><td>Spark/Hadoop with framework control or Spot economics</td><td><strong>EMR</strong></td><td>"specific Spark version", "HBase", "minimize cost with Spot"</td></tr>
<tr><td>Dashboards for humans, per-session pricing, embedding</td><td><strong>QuickSight</strong></td><td>"business users", "embed in our application"</td></tr>
<tr><td>Column/row-level lake permissions, tag-based at scale</td><td><strong>Lake Formation</strong></td><td>"fine-grained access", "central governance", "LF-tags"</td></tr>
</tbody>
</table>

<h3>Worked eliminations</h3>
<p><strong>"Clickstream data must be queryable by analysts within seconds of arrival, with dashboards, minimal ops."</strong> Latency: near-real-time; pattern: interactive dashboards. Firehose → OpenSearch → Dashboards. Athena loses on freshness-plus-interactivity; Redshift is heavier ops than the stem wants; KDS alone delivers nothing to query.</p>
<p><strong>"Monthly compliance reports over 7 years of logs in S3, occasional ad-hoc questions, lowest cost."</strong> Latency: batch; frequency: rare. Athena over partitioned Parquet (convert once via Glue/CTAS). Redshift idles expensively between reports; OpenSearch would hold 7 years hot for monthly queries — absurd; EMR is ops for nothing.</p>
<p><strong>"Existing on-prem Kafka pipeline moving to AWS unchanged, then rolling 10-minute fraud aggregations."</strong> Kafka word → MSK; stateful windows → Managed Flink reading MSK. Kinesis options fail the compatibility clause; Firehose cannot do windowed state.</p>
<p><strong>"Thousands of concurrent internal users on curated sales dashboards, sub-second, joins across a modeled schema."</strong> Concurrency + modeled BI → Redshift (+ materialized views, concurrency scaling), QuickSight on top with SPICE. Athena's concurrency quotas and seconds-latency lose despite being "cheaper".</p>

<h3>Composability: the standard reference pipeline</h3>
<p>These services are stages, not competitors. The canonical lake pipeline the exam assembles repeatedly:</p>
<pre><code>producers → Kinesis Data Streams → (Flink: enrich/window)
        → Firehose (Parquet conversion, dynamic partitioning) → S3 raw/curated
        → Glue Catalog (schema) → Athena (ad-hoc) / Spectrum+Redshift (BI)
        → QuickSight (SPICE dashboards)     [Lake Formation governing all reads]</code></pre>
<p>Multi-select questions often want two or three stages of exactly this chain. If a proposed answer makes one service do another's job (Firehose "processing" with state, Athena serving sub-second dashboards, OpenSearch as a data warehouse), it is the distractor.</p>

<div class="callout exam">Final tie-breakers when two options both "work": (1) the <strong>operational-overhead clause</strong> picks the serverless one; (2) the <strong>latency number</strong> — sub-second: OpenSearch/KDS/Flink; ~1 minute: Firehose; seconds-to-minutes ad-hoc: Athena; batch: Glue/EMR; (3) the <strong>cost clause</strong> — intermittent → per-query/per-second services; sustained → provisioned/reserved capacity. And "which analytics service" answers should never introduce a database migration when the data already sits in S3 — query it where it lies.</div>

<div class="callout war">In production the table has one more column the exam omits: team skills. An Athena-shaped problem still fails if nobody owns partitioning hygiene; an MSK migration succeeds technically and dies of unstaffed Kafka operations. The second-best service that the team can operate beats the best one they cannot — the exam will never test this, but your architecture reviews will.</div>
`
    }
  ],
  quiz: [
    {
      q: "A company stores 2 TB of JSON application logs per month in S3 and uses Athena for occasional investigations. Queries typically filter on a date range and read three fields, but each query scans hundreds of gigabytes and costs several dollars. Which combination of changes will most reduce cost? (Select TWO.)",
      options: [
        "Convert the logs to Apache Parquet with compression during ingestion",
        "Partition the data by year, month, and day in Hive-style S3 prefixes",
        "Migrate the logs to a provisioned Redshift cluster and query there",
        "Increase the Athena query timeout so queries complete more reliably",
        "Store the JSON in S3 Intelligent-Tiering to lower scan charges"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>A</strong> and <strong>B</strong> are the canonical pair: Parquet lets Athena read only the three referenced columns from compressed columnar chunks, and date partitioning lets it prune to the queried range — together routinely cutting scanned bytes (the entire Athena bill) by 30–100x.</p><p><strong>C</strong> replaces per-query cents with a standing cluster for 'occasional' work — the cost-direction is backwards for the usage pattern.</p><p><strong>D</strong> affects reliability of long queries, not bytes scanned; cost is unchanged.</p><p><strong>E</strong> — storage class changes storage cost; Athena's scan charge is per byte read regardless of tier (and archive tiers are not directly queryable anyway).</p>"
    },
    {
      q: "Analysts complain that new hourly data files landing in S3 do not appear in Athena queries until the next morning, when a scheduled Glue crawler runs. The S3 layout is a predictable dt=YYYY-MM-DD-HH partition scheme. What is the most efficient fix?",
      options: [
        "Schedule the crawler to run every five minutes",
        "Configure partition projection on the table so Athena derives partitions from the predictable key pattern without catalog updates",
        "Have analysts run MSCK REPAIR TABLE before every query",
        "Switch the table to an unpartitioned layout so all data is always visible"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: partition projection declares the partition pattern (a date range template here) as table properties, so Athena computes partition locations at query-planning time — new hours are queryable the moment objects land, with zero crawler runs and faster planning on large partition counts.</p><p><strong>A</strong> works but burns crawler DPU-time constantly and still leaves up to five minutes of lag — brute force where configuration suffices.</p><p><strong>C</strong> pushes an expensive full-listing repair onto every analyst before every query — slow, costly, and error-prone process-by-convention.</p><p><strong>D</strong> makes every query scan the full dataset forever — it trades a freshness annoyance for a permanent cost and performance disaster.</p>"
    },
    {
      q: "A data engineering team needs to convert 500 GB of daily CSV drops into partitioned Parquet in a curated S3 zone, on a schedule, processing only files that arrived since the last run, with the least infrastructure to manage. Which solution fits?",
      options: [
        "A Glue ETL job with job bookmarks enabled, scheduled by a Glue trigger",
        "A long-running EMR cluster with a cron-driven Spark job",
        "A Lambda function triggered by S3 events performing the conversion",
        "An Athena CTAS statement run manually each morning"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A</strong> is correct: Glue is serverless Spark — no cluster to manage — and job bookmarks checkpoint processed input so each scheduled run handles only new files; scheduled triggers complete the requirement.</p><p><strong>B</strong> does the job but keeps a cluster (and its patching/sizing) alive for a daily batch — maximal infrastructure for the same outcome, failing the 'least management' clause.</p><p><strong>C</strong> — 500 GB daily aggregate transforms exceed Lambda's 15-minute/10 GB envelope for anything but tiny per-file work, and per-file conversion of large CSVs into well-sized Parquet (with compaction) is exactly what Lambda is bad at.</p><p><strong>D</strong> is SQL-capable of the transform but 'run manually' fails the schedule requirement, CTAS caps at 100 partitions per statement, and incremental-only processing must be hand-managed.</p>"
    },
    {
      q: "A Redshift star schema has a 2-billion-row orders fact table joined on customer_key to a 40-million-row customers dimension, and a 200-row regions dimension joined to almost every query. Queries shuffle heavily. Which physical design is best?",
      options: [
        "DISTSTYLE EVEN on all three tables with no sort keys",
        "DISTKEY customer_key on both orders and customers, DISTSTYLE ALL on regions, sort key on the orders date column",
        "DISTSTYLE ALL on orders so every node has a full copy, DISTKEY on regions",
        "DISTKEY on the orders date column and DISTSTYLE KEY on regions by region name"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: distributing both join sides on customer_key co-locates matching rows on the same slices (shuffle-free join); the tiny regions table replicated via ALL joins locally everywhere; a date sort key on the fact table lets zone maps skip blocks for time-range predicates — the standard Redshift physical design.</p><p><strong>A</strong> guarantees every join redistributes one side across the network — it is the shuffle-heavy status quo.</p><p><strong>C</strong> replicates a 2-billion-row fact table onto every node — storage explosion and slow loads; ALL is for small dimensions.</p><p><strong>D</strong> distributes by a column nobody joins on (dates make skewed, join-useless DISTKEYs — recent dates concentrate load) and pointlessly hash-distributes 200 rows.</p>"
    },
    {
      q: "A retailer keeps the last 12 months of sales in Redshift and 8 more years in partitioned Parquet on S3. Finance occasionally runs year-over-year comparisons spanning both, and refuses to maintain two query tools. What should the architect implement?",
      options: [
        "COPY the historical data into the cluster before each comparison and truncate afterward",
        "Define the S3 data as external tables via Redshift Spectrum and query hot and historical data in a single SQL statement",
        "Export the last 12 months to S3 nightly and point Athena at the combined dataset",
        "Load all 9 years into Redshift permanently on RA3 nodes"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: Spectrum external tables (schema from the Glue catalog) let one Redshift SQL statement — often a UNION ALL view — join cluster-resident hot data with S3-resident history, billed per TB scanned only when the occasional query runs. This is precisely Spectrum's design case.</p><p><strong>A</strong> is a slow, manual bulk load and delete cycle for every occasional query — operationally silly.</p><p><strong>C</strong> inverts the architecture: it moves the fresh warehouse data out nightly, adds a second tool (Athena) — the exact thing finance refused — and loses Redshift's modeled performance for the hot data.</p><p><strong>D</strong> works (RA3 managed storage could hold it) but pays warehouse storage for 8 rarely-touched years — worst cost for stated 'occasional' access.</p>"
    },
    {
      q: "An operations team must centralize application logs and give engineers interactive near-real-time dashboards with full-text search over the last 7 days, keep logs searchable for 90 days at minimal cost, and delete them afterward. Which architecture fits?",
      options: [
        "Kinesis Data Firehose to OpenSearch with hot storage for recent indices, UltraWarm for older indices, and ISM policies transitioning and deleting by age",
        "CloudWatch Logs with Logs Insights queries and a 90-day retention policy",
        "Firehose to S3 with Athena queries and a 90-day lifecycle expiration",
        "Kinesis Data Streams into Redshift with a materialized view per dashboard"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A</strong> is correct end to end: Firehose is the no-code delivery path into OpenSearch; Dashboards provides the interactive near-real-time search UI; UltraWarm holds the 8–90 day tail on S3-backed storage at roughly a tenth of hot cost; ISM automates hot → warm → delete at 90 days.</p><p><strong>B</strong> meets retention but Logs Insights is ad-hoc querying, not rich interactive dashboards with full-text relevance — capability shortfall on the stated requirement.</p><p><strong>C</strong> gives batch-style SQL at seconds latency with no full-text search or live dashboards — wrong latency class and query model.</p><p><strong>D</strong> — Redshift is a warehouse, not a log-search engine: no relevance-ranked text search, and streaming logs into MVs for this is cost and complexity without the search capability.</p>"
    },
    {
      q: "Clickstream events must feed two independent systems: a real-time fraud detector that computes rolling 10-minute aggregates per user with sub-second input latency, and a data lake archive in Parquet. Which pipeline is correct?",
      options: [
        "Kinesis Data Firehose as the single ingestion point, with a transformation Lambda doing fraud aggregation and delivery to S3",
        "Kinesis Data Streams ingesting events, consumed by Managed Service for Apache Flink for windowed fraud aggregation, and separately by Firehose converting to Parquet into S3",
        "Two Firehose streams, one to OpenSearch for fraud and one to S3",
        "SQS as the ingestion buffer with Lambda consumers writing to both destinations"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: KDS provides the durable, replayable stream that supports <em>multiple independent consumers</em>; Flink is the purpose-built engine for stateful windowed aggregation (rolling 10-minute per-user state, event-time semantics); Firehose as a second consumer handles Parquet conversion and S3 delivery with zero code.</p><p><strong>A</strong> fails twice: Firehose supports effectively one delivery destination per stream, and its transformation Lambda is stateless per batch — it cannot maintain 10-minute rolling windows; buffering also violates sub-second latency.</p><p><strong>C</strong> — OpenSearch is search/analytics storage, not a stream-computation engine; nothing computes the aggregates, and dual Firehoses still buffer away the latency requirement.</p><p><strong>D</strong> — SQS is a work queue: no ordered replay, no fan-out to independent consumers without SNS gymnastics, and hand-rolled window state in Lambda; wrong substrate for streaming analytics.</p>"
    },
    {
      q: "A company is migrating an on-premises pipeline built on Apache Kafka with dozens of custom producer and consumer applications and Kafka Connect integrations. They want to move to AWS with minimal application changes. Which service should host the streaming layer?",
      options: [
        "Kinesis Data Streams with the Kinesis Producer Library replacing Kafka clients",
        "Amazon MSK",
        "Kinesis Data Firehose with HTTP endpoint delivery",
        "Amazon MQ with ActiveMQ brokers"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: MSK is managed Apache Kafka — existing producers, consumers, and Kafka Connect connectors work against it unchanged, which is the entire selection criterion when the stem says 'Kafka' plus 'minimal application changes'.</p><p><strong>A</strong> means rewriting dozens of applications from Kafka clients to Kinesis SDKs and abandoning Kafka Connect — the opposite of minimal change.</p><p><strong>C</strong> — Firehose is a delivery pipe, not a pub/sub streaming platform; consumers cannot read from it at all.</p><p><strong>D</strong> — Amazon MQ speaks JMS/AMQP-style broker protocols (ActiveMQ/RabbitMQ) for traditional message-oriented middleware, not the Kafka protocol or its log semantics.</p>"
    },
    {
      q: "A nightly EMR Spark job processes 5 TB from S3 using EMRFS and writes results back to S3. The finance team demands significant cost reduction; brief job delays from instance interruption are acceptable, but job failure and data loss are not. What should the architect do?",
      options: [
        "Run primary and core nodes on On-Demand instances and move all task nodes to Spot using instance fleets with multiple instance types",
        "Move the entire cluster, including primary and core nodes, to Spot instances",
        "Replace EMR with a larger single EC2 instance running Spark in local mode",
        "Keep the cluster running 24/7 to amortize its cost across the day"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A</strong> is correct: task nodes carry no HDFS, so Spot interruption merely re-runs their Spark tasks — delay, not data loss; instance fleets across multiple types/pools minimize interruption clustering. Primary and core (which hold HDFS and cluster state) stay On-Demand for stability. With data on S3/EMRFS, this is the canonical EMR cost pattern.</p><p><strong>B</strong> risks losing the primary (cluster death) or core nodes (HDFS data loss mid-job) — violating the no-failure requirement.</p><p><strong>C</strong> — 5 TB nightly on one instance abandons distributed processing; even the largest instance makes this slow, fragile, and not obviously cheaper.</p><p><strong>D</strong> increases cost precisely — paying 24 hours for a nightly batch; transient clusters exist to avoid this.</p>"
    },
    {
      q: "A SaaS provider wants to show each customer an analytics dashboard inside its web application. Requirements: no BI servers to manage, per-user row-level security so customers see only their data, and no per-dashboard-view load on the underlying Athena tables. Which approach fits?",
      options: [
        "Embed QuickSight dashboards with row-level security, backed by datasets imported into SPICE with scheduled refreshes",
        "Grant customers IAM access to run Athena queries in a dedicated workgroup",
        "Build dashboards in OpenSearch Dashboards and reverse-proxy them into the application",
        "Generate static charts nightly with a Lambda function and serve them from S3"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A</strong> hits every clause: QuickSight embedding places dashboards in the app; row-level security filters per authenticated user; SPICE serves views from QuickSight's in-memory engine, so dashboard traffic generates zero Athena scans — refreshes hit the source on schedule only.</p><p><strong>B</strong> hands customers query infrastructure instead of dashboards, scans Athena per query (violating the load clause), and IAM-per-customer is an operational hazard.</p><p><strong>C</strong> — OpenSearch Dashboards is an ops-facing tool, poorly suited to multi-tenant customer embedding, and requires running and securing a domain plus the proxy — the 'no servers' clause fails.</p><p><strong>D</strong> loses interactivity entirely (static images), reinvents BI, and per-tenant nightly generation scales badly.</p>"
    },
    {
      q: "A data platform team must give dozens of analyst teams access to specific columns of specific tables in a shared S3 data lake queried via Athena, hide PII columns from most users, and keep the permission model manageable as hundreds of new tables arrive monthly. What should they use?",
      options: [
        "S3 bucket policies granting each team access to the prefixes containing their permitted columns",
        "Lake Formation with LF-tag-based access control, tagging tables and columns by domain and sensitivity, granting on tag expressions",
        "One IAM role per team with inline policies listing permitted Glue tables, updated by a monthly script",
        "Separate copies of each table per team with the PII columns removed"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is correct: Lake Formation enforces database/table/column (and row) permissions inside Athena via scoped temporary credentials, and LF-tags make it scale — tag columns sensitivity=pii, grant analysts on expressions excluding it, and new tables inherit correct access at tagging time rather than requiring policy edits.</p><p><strong>A</strong> is structurally impossible for the core requirement: S3 objects are whole files; bucket policies cannot see columns inside a Parquet object.</p><p><strong>C</strong> — column-level control is not expressible in plain IAM-on-Glue, and a monthly script over hundreds of new tables is the unmanageability the stem forbids.</p><p><strong>D</strong> 'works' by data duplication: N-teams × M-tables copies, storage cost, and consistency drift — the anti-pattern Lake Formation exists to remove.</p>"
    },
    {
      q: "Which scenario is the strongest case for choosing Athena over Redshift?",
      options: [
        "A 24/7 BI platform where two thousand concurrent users run dashboards over a modeled star schema with strict sub-second SLAs",
        "A compliance team running a handful of SQL investigations per month over years of partitioned Parquet already stored in S3",
        "Sub-minute-latency ingestion of streaming facts with continuous materialized-view maintenance",
        "A nightly ELT pipeline with heavy multi-table joins feeding downstream marts on a fixed schedule"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is Athena's home ground: data already in S3, rare and unpredictable usage, zero standing infrastructure, pay only for bytes each investigation scans. A warehouse would idle expensively between queries.</p><p><strong>A</strong> is the Redshift profile — concurrency scaling, materialized views, and modeled distribution/sort design deliver the SLA; Athena's per-query concurrency and seconds-floor latency do not.</p><p><strong>C</strong> describes Redshift streaming ingestion into MVs; Athena has no continuous ingestion or MV-maintenance machinery of that kind.</p><p><strong>D</strong> — sustained heavy scheduled joins benefit from Redshift's owned layout and predictable capacity; per-TB-scanned pricing on nightly full transforms is the expensive way to buy compute.</p>"
    },
    {
      q: "A Firehose delivery stream writes JSON clickstream records to S3. Analysts report Athena queries over the delivered data are slow and expensive, and S3 shows millions of small JSON objects in flat prefixes. Which Firehose-level changes address this at the source? (Select TWO.)",
      options: [
        "Enable record format conversion to Parquet using a schema from the Glue Data Catalog",
        "Increase buffering size and interval so fewer, larger objects are delivered, and enable dynamic partitioning into date-based prefixes",
        "Reduce the buffering interval to one second for fresher data",
        "Enable Firehose server-side encryption with KMS",
        "Switch the delivery destination to OpenSearch"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>A</strong> and <strong>B</strong> fix the two root causes where they originate: Parquet conversion makes every downstream byte columnar and compressed (Athena scans collapse), while larger buffers plus dynamic partitioning produce well-sized objects in Hive-style date prefixes that Athena can prune — solving the small-files and no-partitioning problems without any post-processing job.</p><p><strong>C</strong> goes the wrong direction: smaller buffers mean even more, smaller files — it worsens the reported problem for a freshness gain nobody asked for.</p><p><strong>D</strong> is orthogonal security hygiene; encryption changes no performance or cost property here.</p><p><strong>E</strong> abandons the data-lake requirement entirely rather than fixing delivery — the analysts query in Athena over S3.</p>"
    },
    {
      q: "An analytics lead wants guardrails so that no ad-hoc Athena user can accidentally scan more than 100 GB in a single query, with separate cost tracking for the data-science and finance teams. What is the right mechanism?",
      options: [
        "Create separate Athena workgroups per team with per-query data-scanned limits and workgroup-level metrics",
        "Apply an S3 bucket policy limiting each team's GetObject calls to 100 GB per day",
        "Set a Service Quotas limit on Athena bytes scanned per account",
        "Require all queries to include a LIMIT clause via SQL linting in code review"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>A</strong> is exactly what workgroups are for: per-workgroup enforced settings include per-query and aggregate data-usage controls (a query exceeding the byte limit is cancelled), and each workgroup publishes its own metrics and cost attribution — teams separated cleanly.</p><p><strong>B</strong> — S3 bucket policies have no cumulative-bytes-per-day condition semantics, and blocking mid-query GETs would just break queries unpredictably.</p><p><strong>C</strong> — no such Service Quotas dimension exists for Athena scan volume.</p><p><strong>D</strong> — LIMIT truncates returned rows, not bytes scanned (the scan happens regardless, especially with ORDER BY); and convention-by-review is not a guardrail.</p>"
    }
  ],
  flashcards: [
    { front: "Data lake zones: what belongs in raw vs curated?", back: "<strong>Raw</strong>: data exactly as received, immutable, append-only — the replay/audit substrate; lifecycle to Glacier. <strong>Curated</strong>: cleaned, schema-enforced, columnar (Parquet), partitioned; all consumers read here. Rebuild curated from raw when transforms change." },
    { front: "Why does Parquet cut Athena costs 30-100x vs JSON/CSV?", back: "Three multiplying effects: columnar <strong>compression</strong> (~4x smaller), <strong>column pruning</strong> (read only referenced columns' chunks), and row-group <strong>min/max stats</strong> enabling predicate pushdown — on top of partition pruning. Athena bills per byte scanned, so all of it is direct cost." },
    { front: "Target file and partition sizes in an S3 lake, and why?", back: "Files <strong>~128 MB–1 GB</strong>; partitions tens of MB to GBs. Millions of tiny files make per-object overhead (GETs, footer parsing) dominate — the 'small files problem'. Fix via Firehose buffering, compaction jobs, or Iceberg auto-compaction." },
    { front: "Glue Data Catalog — what is it, and what does it store?", back: "The shared, Hive-metastore-compatible schema registry for the whole stack (Athena, Spectrum, EMR, Glue jobs, Lake Formation). Stores <strong>metadata only</strong>: schemas, formats/SerDes, S3 locations, partition entries. One per account-region; data itself never leaves S3." },
    { front: "Why can new S3 data be invisible to Athena, and the three fixes?", back: "Partitions are not registered in the catalog. Fixes: re-run the <strong>crawler</strong>, <strong>ALTER TABLE ADD PARTITION</strong>, or best for predictable layouts — <strong>partition projection</strong> (patterns computed at query time; no catalog updates ever)." },
    { front: "Glue job bookmarks — what problem do they solve?", back: "Incremental processing: bookmarks checkpoint which files/rows a job has processed, so scheduled runs handle <strong>only new arrivals</strong>. The answer to 'process only data added since the last run' without hand-rolled state." },
    { front: "Glue vs EMR vs Lambda for transforms — the selection rule?", back: "<strong>Lambda</strong>: small per-event transforms (15 min/10 GB caps). <strong>Glue</strong>: serverless Spark batch/streaming ETL, least ops. <strong>EMR</strong>: full framework control (versions, HBase/Trino, custom AMIs), long-running clusters, Spot fleets at scale. 'Least operational overhead' → Glue." },
    { front: "Athena pricing model and the three levers that cut it?", back: "~<strong>5 dollars per TB scanned</strong> (10 MB min/query). Levers: columnar formats + compression, partitioning (+ projection), selecting only needed columns. There is no 'bigger Athena' to buy — you optimize by scanning less." },
    { front: "Athena CTAS — what is it for, and its partition limit?", back: "CREATE TABLE AS SELECT: transform query results into a new S3 dataset (e.g. partitioned Parquet) + catalog table in one SQL statement — lightweight ETL. Writes max <strong>100 partitions</strong> per statement; use INSERT INTO for increments." },
    { front: "Athena workgroups — what do they control?", back: "Governance: per-team query separation with enforced result locations, settings, metrics, and <strong>data-usage limits</strong> (cancel queries exceeding per-query bytes; aggregate caps). The 'stop analysts scanning 50 TB by accident' feature." },
    { front: "Redshift leader vs compute nodes vs slices?", back: "<strong>Leader</strong>: connections, planning, code-gen, result aggregation. <strong>Compute nodes</strong>: hold data, execute segments; divided into <strong>slices</strong> (the parallelism unit — split COPY inputs to a multiple of slice count). RA3 separates compute from Managed Storage (S3-backed)." },
    { front: "Redshift DISTSTYLE KEY / EVEN / ALL — when for each?", back: "<strong>KEY</strong>: hash-distribute fact + big dimension on the join column → co-located joins (beware skew). <strong>EVEN</strong>: round-robin when no dominant join key. <strong>ALL</strong>: replicate small slow-changing dimensions to every node. AUTO adapts as tables grow." },
    { front: "Redshift sort keys — mechanism and the usual choice?", back: "Rows stored sorted; 1 MB blocks carry <strong>zone maps</strong> (min/max) so range predicates skip blocks. Sort on the dominant filter column — almost always the <strong>date/timestamp</strong> — the warehouse analog of lake partitioning." },
    { front: "Redshift Spectrum — what it does and its cost model?", back: "External tables (Glue catalog) over S3, queried from Redshift SQL and joinable with local tables — 'hot data in cluster, full history in S3, one UNION ALL view'. Billed <strong>per TB scanned</strong>, so lake layout discipline (Parquet, partitions) applies." },
    { front: "Redshift answers for concurrency spikes and repeated aggregations?", back: "<strong>Concurrency scaling</strong>: transient clusters absorb queued read bursts (free daily credits, then per-second). <strong>Materialized views</strong>: incremental refresh + automatic query rewriting for repeated dashboard aggregations; also the landing target for streaming ingestion." },
    { front: "OpenSearch UltraWarm and Index State Management?", back: "<strong>UltraWarm</strong>: S3-backed, read-only warm tier at roughly a tenth of hot cost — months of searchable logs. <strong>ISM</strong> policies automate hot → warm → cold → delete by index age. The 'retain 90 days searchable, cheaply' answer." },
    { front: "OpenSearch vs CloudWatch Logs Insights?", back: "<strong>Logs Insights</strong>: zero setup, ad-hoc query language over logs already in CloudWatch, pay per scan. <strong>OpenSearch</strong>: full-text relevance search, rich interactive dashboards, alerting, long cheap retention (UltraWarm) — at the price of running a pipeline + domain. Sustained interactive analysis → OpenSearch." },
    { front: "Kinesis Data Streams: per-shard limits and retention?", back: "<strong>1 MB/s or 1,000 records/s in; 2 MB/s out shared</strong> (enhanced fan-out: 2 MB/s per registered consumer, push, ~70 ms). Ordering per shard. Retention 24 h default → <strong>365 days</strong>; replayable by multiple independent consumers." },
    { front: "Firehose vs Kinesis Data Streams — the one-line discriminator?", back: "<strong>Firehose</strong>: no-code managed <em>delivery</em> to S3/Redshift/OpenSearch/Splunk/HTTP with buffering (~minute-level, near-real-time), Lambda transform, Parquet conversion; no replay, no custom consumers. <strong>KDS</strong>: durable ordered log for custom real-time consumers, fan-out, replay." },
    { front: "When is Managed Service for Apache Flink the required answer?", back: "Stateful stream computation: <strong>windowed aggregations</strong> (tumbling/sliding/session), event-time + watermarks, streaming joins, exactly-once state. Keywords: 'rolling N-minute metric', 'sessionize', 'real-time anomaly aggregation'. Firehose Lambda transforms are stateless and cannot do this." },
    { front: "MSK vs Kinesis — selection logic?", back: "The word <strong>'Kafka'</strong> (existing clients, Kafka Connect, on-prem migration, compacted topics/fine control) → <strong>MSK</strong>. Otherwise default to Kinesis for AWS-native integration and lower ops. MSK manages brokers — topic design, partitions, and consumer lag remain your job." },
    { front: "EMR node types and the Spot placement rule?", back: "<strong>Primary</strong> (coordination), <strong>core</strong> (HDFS + compute), <strong>task</strong> (compute only). Spot belongs on <strong>task nodes</strong> — interruptions just re-run tasks; core on Spot risks HDFS data loss. Instance fleets diversify Spot pools. Data on S3 via EMRFS → transient clusters." },
    { front: "QuickSight SPICE — what and why?", back: "QuickSight's in-memory columnar engine: datasets imported into SPICE serve dashboards from QuickSight itself — sub-second interaction, <strong>zero per-view load/cost on the source</strong> (no Athena scans per viewer), scheduled/incremental refresh. Also: per-session pricing, embedding with row-level security." },
    { front: "Lake Formation — enforcement mechanism and LF-tags?", back: "Sits over the Glue catalog; integrated engines obtain <strong>temporary scoped S3 credentials</strong> at query time, enforcing DB/table/<strong>column/row</strong>-level grants (users need no direct S3 access). <strong>LF-tags</strong>: grant on tag expressions (domain, sensitivity) so policies scale with tags, not table count; cross-account sharing built in." },
    { front: "The three stem variables that pick the analytics service?", back: "1) <strong>Latency class</strong>: sub-second (OpenSearch/KDS/Flink) → ~minute (Firehose) → interactive seconds (Athena/Redshift) → batch (Glue/EMR). 2) <strong>Query pattern</strong>: ad-hoc SQL / modeled BI / full-text / windowed streams / framework code. 3) <strong>Ops clause</strong>: 'least management' → the serverless option." }
  ],
  lab: {
    title: "Lab: build a mini data lake — Glue catalog, Athena, CTAS to Parquet, and the scan-cost receipt",
    html: `
<h3>Goal</h3>
<p>Stand up the core lake loop end to end: land CSV in S3, catalog it, query with Athena, convert to partitioned Parquet with CTAS, and read the bytes-scanned numbers that prove the columnar cost math. Total cost: fractions of a cent (a few KB scanned at 5 dollars/TB, S3 pennies).</p>

<h3>Architecture</h3>
<p>Two S3 prefixes (raw CSV, curated Parquet) in one bucket, a Glue database with a manually-declared table (no crawler needed — the schema is known, which is the production-grade habit anyway), and an Athena workgroup with its own result location.</p>

<h3>Steps</h3>
<ol>
<li><p>Create the bucket and generate sample sales data (two days of CSV):</p>
<pre><code>ACCT=$(aws sts get-caller-identity --query Account --output text)
BUCKET=lab-lake-$ACCT
aws s3 mb s3://$BUCKET

python3 - &lt;&lt;'EOF'
import csv, random
for day in ("2026-07-20","2026-07-21"):
    with open(f_name := "sales-" + day + ".csv", "w", newline="") as f:
        w = csv.writer(f)
        for i in range(1000):
            w.writerow([day, "o-%05d" % i, random.choice(["EU","US","APAC"]),
                        random.choice(["book","game","tool"]), round(random.uniform(5,500),2)])
EOF

aws s3 cp sales-2026-07-20.csv s3://$BUCKET/raw/sales/dt=2026-07-20/
aws s3 cp sales-2026-07-21.csv s3://$BUCKET/raw/sales/dt=2026-07-21/</code></pre></li>

<li><p>Create the Glue database and an Athena workgroup with a result location:</p>
<pre><code>aws glue create-database --database-input Name=lab_lake

aws athena create-work-group --name lab-wg \
  --configuration "ResultConfiguration={OutputLocation=s3://$BUCKET/athena-results/},EnforceWorkGroupConfiguration=true"</code></pre></li>

<li><p>Declare the raw table with DDL (a helper for running Athena queries from the CLI):</p>
<pre><code>runq () {
  QID=$(aws athena start-query-execution --work-group lab-wg \
    --query-string "$1" --query QueryExecutionId --output text)
  until [ "$(aws athena get-query-execution --query-execution-id $QID \
      --query QueryExecution.Status.State --output text)" != "RUNNING" ]; do sleep 2; done
  aws athena get-query-execution --query-execution-id $QID \
    --query "QueryExecution.[Status.State,Statistics.DataScannedInBytes]"
  echo $QID
}

runq "CREATE EXTERNAL TABLE lab_lake.sales_raw (
  sale_date string, order_id string, region string, product string, amount double)
PARTITIONED BY (dt string)
ROW FORMAT DELIMITED FIELDS TERMINATED BY ','
LOCATION 's3://$BUCKET/raw/sales/'"

runq "MSCK REPAIR TABLE lab_lake.sales_raw"</code></pre></li>

<li><p>Query the raw CSV and note DataScannedInBytes — the whole partition's CSV is read even though you selected one column:</p>
<pre><code>runq "SELECT region, sum(amount) FROM lab_lake.sales_raw
WHERE dt='2026-07-21' GROUP BY region"</code></pre></li>

<li><p>Convert to partitioned Parquet with CTAS — Athena as the ETL engine:</p>
<pre><code>runq "CREATE TABLE lab_lake.sales_parquet
WITH (format='PARQUET', parquet_compression='SNAPPY',
      external_location='s3://$BUCKET/curated/sales/',
      partitioned_by=ARRAY['dt'])
AS SELECT sale_date, order_id, region, product, amount, dt
FROM lab_lake.sales_raw"</code></pre></li>

<li><p>Re-run the same aggregation against the Parquet table and compare DataScannedInBytes:</p>
<pre><code>runq "SELECT region, sum(amount) FROM lab_lake.sales_parquet
WHERE dt='2026-07-21' GROUP BY region"</code></pre>
<p>Expect a large drop: one partition pruned by dt, and only the region and amount column chunks read from a compressed Parquet file. This delta, scaled to terabytes, is the entire economic argument of this module.</p></li>
</ol>

<h3>Verify</h3>
<pre><code>aws s3 ls s3://$BUCKET/curated/sales/ --recursive
aws glue get-tables --database-name lab_lake --query "TableList[].Name"</code></pre>
<p>Expect Parquet objects under dt= prefixes and both tables (sales_raw, sales_parquet) in the catalog. Compare the two recorded DataScannedInBytes values — write the ratio down; it is the number you will quote in design reviews.</p>

<h3>Teardown</h3>
<p>Order matters only in that the workgroup must be emptied of named queries implicitly; everything else is independent. Nothing here has standing cost except S3 objects, so the bucket purge is the critical step.</p>
<ol>
<li><p>Drop the catalog objects:</p>
<pre><code>aws glue delete-table --database-name lab_lake --name sales_raw
aws glue delete-table --database-name lab_lake --name sales_parquet
aws glue delete-database --name lab_lake</code></pre></li>
<li><p>Delete the workgroup:</p>
<pre><code>aws athena delete-work-group --work-group lab-wg --recursive-delete-option</code></pre></li>
<li><p>Empty and remove the bucket (raw, curated, and Athena results):</p>
<pre><code>aws s3 rm s3://$BUCKET --recursive
aws s3 rb s3://$BUCKET</code></pre></li>
<li><p>Remove local scratch files and confirm nothing remains:</p>
<pre><code>rm -f sales-2026-07-20.csv sales-2026-07-21.csv
aws s3 ls | grep lab-lake || echo "bucket gone"
aws glue get-databases --query "DatabaseList[].Name"</code></pre></li>
</ol>
`
  }
});
