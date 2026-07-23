/* Module 05 — Embeddings & Vector Search (core track) */
window.COURSE.register({
  id: "embeddings-search",
  order: 5,
  track: "core",
  title: "Embeddings & Vector Search",
  description: "Embeddings from the geometry up: what cosine similarity actually measures, why chunking decisions dominate retrieval quality more than model choice, how HNSW trades recall for latency, why hybrid BM25+dense with reciprocal rank fusion beats either alone, and the honest capacity/cost math behind pgvector vs dedicated vector DBs vs a numpy array.",
  examWeight: "Interview loops for AI engineering roles almost always include a retrieval design question — expect to whiteboard a search pipeline, defend a chunk size, explain HNSW recall trade-offs, and do the memory math for N vectors at dimension d. Weak answers on 'when is brute force fine' and 'why hybrid search' are common rejection reasons.",
  lessons: [
    {
      id: "embeddings-similarity",
      title: "Embeddings and what 'similar' actually means",
      html: `
<p>An embedding model is a learned function from text (or images, or code) to a point in R^d, trained so that a specific, task-defined notion of relatedness becomes geometric proximity. The three ideas a senior engineer must internalize: the geometry is <strong>learned, not intrinsic</strong> — 'similar' means whatever the training objective made it mean; the space is only meaningful <strong>within one model</strong> — vectors from different models (or even different versions of the same model) are mutually meaningless; and similarity scores are <strong>ordinal, not calibrated</strong> — 0.83 vs 0.79 says 'ranked higher', not '4 percent more relevant'.</p>

<h3>Cosine vs dot product vs Euclidean</h3>
<ul>
<li><strong>Cosine similarity</strong> compares direction only: the angle between vectors, ignoring magnitude. Range [-1, 1] in principle; in practice, modern embedding spaces are anisotropic (vectors bunch in a cone), so real-world scores for text pairs often live in a narrow band like 0.2–0.9. This is why absolute thresholds ('only keep results above 0.7') transfer badly between models and even between corpora.</li>
<li><strong>Dot product</strong> is cosine times both magnitudes. If vectors are unnormalized, magnitude carries signal — some models deliberately encode salience or frequency in vector length. If vectors are L2-normalized, dot product and cosine are <em>identical</em>, and Euclidean distance is a monotonic transform of both (squared L2 distance = 2 - 2·cosine for unit vectors). So for normalized vectors the three metrics produce the same ranking.</li>
<li><strong>Practical rule:</strong> check the model card. Most APIs (OpenAI text-embedding-3 family, Cohere, Voyage) return unit-normalized vectors, so use dot product — it is the cheapest to compute (one fused multiply-add loop, SIMD-friendly, no square roots). Some open-source models trained with unnormalized dot-product objectives (certain recommendation towers) genuinely need dot product on raw vectors.</li>
</ul>

<div class="callout deep">Why the metric must match training: contrastive objectives like InfoNCE optimize a temperature-scaled cosine or dot product between positive pairs against in-batch negatives. The model learns to place things exactly as far apart as the loss demanded — under that metric. Score with a different metric and you are reading a map with the wrong projection. This is also why symmetric vs asymmetric training matters: retrieval models (E5, BGE, GTE families) are trained with query-passage pairs, often with instruction prefixes like 'query:' and 'passage:'. Forget the prefix at inference and recall silently drops several points — one of the most common silent bugs in open-source embedding deployments.</div>

<h3>Dimensionality</h3>
<p>Dimensions are capacity, not quality. As of early 2026 the common sizes: 384 (all-MiniLM-L6-v2), 768 (nomic-embed-text, gte-base), 1024 (Cohere embed-v4 default, BGE-M3, voyage-3), 1536 (OpenAI text-embedding-3-small), 3072 (text-embedding-3-large), 4096 (Qwen3-Embedding-8B). More dimensions buy headroom for fine distinctions in large heterogeneous corpora, but cost is linear in d everywhere: storage, memory bandwidth, distance computation, index build. A 3072-d index is literally 8x the bytes of a 384-d one for the same corpus.</p>
<p><strong>Matryoshka representation learning (MRL)</strong> changed this trade-off: models trained with MRL (OpenAI text-embedding-3, nomic-embed, many recent open models) pack the most important information into the leading dimensions, so you can truncate a 3072-d vector to 1024 or 256 dims, re-normalize, and keep most of the retrieval quality. OpenAI's own numbers: text-embedding-3-large truncated to 256 dims still out-scores the full 1536-d ada-002 on MTEB. Truncation is the cheapest capacity lever you have — use it before reaching for quantization.</p>

<h3>Choosing a model</h3>
<table>
<thead><tr><th>Option (early 2026)</th><th>Shape</th><th>Why pick it</th></tr></thead>
<tbody>
<tr><td>OpenAI text-embedding-3-small</td><td>1536d, about USD 0.02 per 1M tokens</td><td>Cheap API default; MRL truncation</td></tr>
<tr><td>OpenAI text-embedding-3-large</td><td>3072d, about USD 0.13 per 1M tokens</td><td>Higher ceiling; still cheap vs rerankers</td></tr>
<tr><td>Cohere embed-v4 / Voyage voyage-3-large</td><td>1024d-ish, similar price band</td><td>Strong retrieval focus; multimodal (v4); Matryoshka and int8 options</td></tr>
<tr><td>Google gemini-embedding</td><td>3072d, MRL</td><td>Strong MTEB scores; GCP-native shops</td></tr>
<tr><td>Open source: BGE-M3, gte-Qwen2, Qwen3-Embedding, nomic-embed, E5</td><td>384–4096d, free weights</td><td>Data cannot leave; cost at scale; fine-tunable on your domain</td></tr>
</tbody>
</table>
<p>Selection heuristics that outlive any leaderboard: (1) <strong>MTEB rank is a weak signal</strong> past the top tier — scores are within noise of each other and increasingly contaminated by training on the benchmark; evaluate on your own queries against your own corpus (50 labeled queries beats any leaderboard). (2) <strong>Latency and locality</strong>: a 20 ms local MiniLM beats a 200 ms API round trip for interactive search, and embedding queries at request time is on your critical path. (3) <strong>Version pinning is non-negotiable</strong>: embeddings are only comparable within one model version, so a model upgrade means re-embedding the entire corpus. Store the model name and version next to every vector.</p>

<div class="callout war">The classic production incident: a team upgrades their embedding model (or a provider silently revs a default), new documents get embedded with the new model into the same index, and retrieval quality craters only for cross-era query/document pairs — which no smoke test catches because same-era pairs still work. Symptoms look like random relevance decay. Prevention: model version in index metadata, hard-fail on mismatch, and blue/green re-embedding for upgrades.</div>

<div class="callout exam">Interviewers probe this with 'your similarity scores all look like 0.75–0.85 — what do you do?' The senior answer: scores are uncalibrated and anisotropy compresses the range; never use absolute thresholds across models; compare rankings, evaluate with recall@k on labeled data, and if you need a cutoff, tune it per-model on a validation set — or better, use a reranker score which is trained to be more discriminative.</div>

<div class="callout limits">Numbers worth carrying: embedding API costs are 100–1000x cheaper than generation (USD 0.02–0.13 per 1M tokens vs dollars per 1M for frontier LLMs) — embedding cost is almost never your problem; query-time latency and re-embedding operational cost are. Max input lengths: commonly 512 tokens (many open models), 8k (OpenAI), up to 32k (some long-context embedders). Anything longer must be chunked — which is the next lesson, and where retrieval quality is actually won or lost.</div>
`
    },
    {
      id: "chunking",
      title: "Chunking: the unglamorous decision that dominates quality",
      html: `
<p>Chunking is where retrieval pipelines are won or lost, and it gets a fraction of the attention that model choice gets. The core tension: an embedding is a <strong>fixed-size summary of variable-size text</strong>. Embed a 5,000-token document into one 1024-d vector and every specific fact is diluted into a vague topical average — a query about one detail will not land. Embed 50-token fragments and each vector is sharp but contextless — 'it increased by 12 percent' embeds to noise when 'it' lives in the previous paragraph. Chunking is the art of picking the unit of retrieval so that each vector is both specific and self-contained.</p>

<h3>Why chunking dominates</h3>
<p>Empirically, moving from a bad chunking scheme to a good one routinely swings recall@10 by 15–30 points on real corpora — more than the gap between a mid-tier and top-tier embedding model (usually low single digits on the same corpus). The mechanism: the embedding model can only encode what is in the chunk. If the chunk boundary splits a fact from its subject, or merges three unrelated topics, no model recovers that. Model choice moves you along a curve; chunking picks which curve you are on.</p>

<h3>The strategies</h3>
<ul>
<li><strong>Fixed-size token windows</strong> (e.g. 512 tokens, 15 percent overlap): the dumb baseline. Ignores structure, splits sentences and tables mid-thought. Still surprisingly competitive on homogeneous prose, and trivially predictable for capacity planning.</li>
<li><strong>Recursive structure-aware splitting</strong>: split on the largest structural boundary that fits the budget — headings, then paragraphs, then sentences. The default choice for most corpora; respects the author's own information boundaries.</li>
<li><strong>Semantic chunking</strong>: embed sentences, split where consecutive-sentence similarity drops below a threshold. Sounds principled; in practice buys a few points on messy transcripts and unstructured text, costs an embedding pass over every sentence, and adds a tuning knob. Try it after structural splitting, not before.</li>
<li><strong>Format-native chunking</strong>: Markdown by heading hierarchy (prepend the heading path to the chunk text — this materially improves recall because the section title carries the topic); code by function/class using an AST or tree-sitter, never by lines; tables kept whole with their caption, or serialized row-wise with the header repeated per row.</li>
</ul>

<h3>Sizes and overlap</h3>
<ul>
<li>Working band as of early 2026: <strong>200–800 tokens</strong> per chunk for prose. Below ~150, context starvation; above ~1000, dilution. 400–512 with 10–20 percent overlap is the boring, defensible default.</li>
<li><strong>Overlap</strong> exists to stop boundary-straddling facts from being unfindable in both neighbors. 10–20 percent is enough; beyond that you pay storage and near-duplicate retrieval (two overlapping chunks of the same passage crowd out a genuinely different second result in top-k — deduplicate by parent or by span at query time).</li>
<li>Optimal size depends on query style: short factoid queries favor smaller chunks; 'summarize the policy on X' favors larger ones. If you cannot decide, that tension itself is the argument for parent-document retrieval.</li>
</ul>

<h3>Decoupling the match unit from the generation unit</h3>
<p>The most important architectural idea in this lesson: <strong>what you embed and what you feed the LLM do not have to be the same text</strong>.</p>
<ul>
<li><strong>Parent-document (small-to-big) retrieval</strong>: embed small, precise chunks (say 200 tokens); at query time, return the parent section (say 1,500 tokens) that contains the matched chunk. You get small-chunk precision for matching and large-chunk context for generation. Costs: parent pointers in metadata, and dedup when multiple children hit the same parent.</li>
<li><strong>Contextual retrieval</strong> (popularized by Anthropic in 2024): before embedding each chunk, prepend a 1–2 sentence LLM-generated summary situating it — document title, section, what 'it' refers to. Anthropic reported roughly a one-third reduction in retrieval failure rate, more when combined with BM25 and reranking. Cost: one cheap-model LLM call per chunk at index time (prompt caching makes this pennies per thousand chunks); pure index-time spend, zero query-time latency.</li>
<li><strong>Late chunking</strong>: run a long-context embedding model over the whole document, then pool token embeddings per chunk afterward — each chunk's vector has soaked in full-document context through attention. Elegant, requires a model that exposes token-level output; as of early 2026 mostly a Jina/open-source technique worth knowing, not yet the default.</li>
</ul>

<div class="callout war">Real failure story, seen repeatedly: a support-KB RAG system scores fine on the eval set, but users report the bot 'cannot find' well-documented answers. Root cause: the HTML-to-text extractor flattened tables into word soup and dropped heading hierarchy, so pricing and compatibility matrices — the most-queried content — embedded as noise. The retrieval stack (good model, HNSW, hybrid, reranker) was fine. Nobody had ever read the extracted chunks. First debugging step for any retrieval problem: dump 20 random chunks and read them. It is astonishing how often the bug is visible to the naked eye.</div>

<div class="callout deep">Why long chunks dilute: transformer embedders mean-pool (or CLS-pool) token representations into one vector. Pooling is averaging; averaging is lossy compression biased toward the dominant topic. A 1,000-token chunk that is 90 percent boilerplate and 10 percent the critical fact yields a vector that is mostly boilerplate. This also explains why prepending heading paths works — you are shifting the average toward the topic signal — and why boilerplate-stripping at parse time is one of the highest-ROI cleanups.</div>

<div class="callout exam">A favorite interview prompt: 'retrieval quality is poor — walk me through debugging.' Strong candidates go to the data first: read the chunks, check the parser, check chunk boundaries against real failed queries, check that headings/metadata survive — before touching the model or index. Naming parent-document retrieval and contextual retrieval as remedies, with their costs, reads as practitioner-level. Jumping straight to 'switch to a better embedding model' is the junior tell.</div>
`
    },
    {
      id: "ann-hnsw",
      title: "ANN indexes: HNSW, recall/latency, and when brute force is fine",
      html: `
<p>Exact nearest-neighbor search is a linear scan: N dot products of dimension d. The entire point of approximate nearest neighbor (ANN) indexes is to avoid that scan — by accepting that you will sometimes miss a true neighbor. That miss rate has a name, <strong>recall</strong> (fraction of true top-k found), and every ANN index is a machine for trading recall against latency, memory, and build time. There is no free lunch; there are only good exchange rates.</p>

<h3>First: when brute force is fine</h3>
<p>Do the arithmetic before adopting an index. One million 1024-d float32 vectors is 4 GB — fits in RAM on a laptop. A brute-force scan is a perfectly-vectorized memory-bandwidth-bound pass: numpy or FAISS IndexFlat does 1M x 1024d in roughly 10–50 ms on modern server CPUs; on a GPU, low single-digit ms. Brute force has <strong>recall of exactly 1.0, zero build time, zero tuning, trivial deletes, and no filtered-search pathologies</strong>. Under ~1M vectors with moderate QPS, an ANN index is usually premature optimization. Many production 'vector databases' are, and should be, a numpy array with a dot product. The index earns its complexity somewhere between 1M and 10M vectors, or at high QPS where the 20 ms scan becomes your throughput ceiling.</p>

<h3>HNSW: the mental model</h3>
<p>HNSW (Hierarchical Navigable Small World) is the default ANN index everywhere — pgvector, Qdrant, Weaviate, Milvus, Lucene/Elasticsearch, FAISS. Two ideas fused:</p>
<ul>
<li><strong>Navigable small-world graph:</strong> every vector is a node linked to ~M neighbors, chosen so the graph mixes short-range links (precision) with a heuristic that preserves long-range connectivity. Search is greedy graph walk: start somewhere, repeatedly hop to the neighbor closest to the query, maintaining a beam of candidates.</li>
<li><strong>Hierarchy (the skip-list trick):</strong> stack sparse layers on top — each node appears in higher layers with geometrically decreasing probability. Search starts at the sparsest top layer to cross the space in a few long hops, then descends layer by layer, using each layer's result as the entry point to the next. Like a skip list over geometry: coarse navigation up top, fine search at the bottom. Result: O(log N)-ish hop counts in practice.</li>
</ul>

<h3>The three knobs</h3>
<ul>
<li><strong>M</strong> (links per node, typical 16–32): graph density. Higher M = better recall ceiling and robustness on hard (high-dimensional, clustered) data, linearly more memory and slower builds.</li>
<li><strong>ef_construction</strong> (build-time beam width, typical 100–400): how carefully neighbors are chosen at insert. Higher = better graph = pay once at build time.</li>
<li><strong>ef_search</strong> (query-time beam width): <em>the</em> recall/latency dial, tunable per query. ef_search = k gives fast, sloppy results; raising it toward a few hundred pushes recall from ~0.9 to 0.99+ with roughly linear latency growth. The recall-vs-ef curve saturates — measure yours and sit at the knee. Typical numbers: single-digit millisecond queries at 0.95–0.99 recall on tens of millions of vectors, single node.</li>
</ul>

<div class="callout limits">Memory math you should do in your head: raw vectors = N x d x 4 bytes (fp32). HNSW graph overhead is roughly M x 2 x 4 bytes per node plus bookkeeping — at M=16 about 130 bytes/node, small next to a 4 KB fp32 1024-d vector. 10M x 1024d fp32 = 40 GB raw. Levers: MRL truncation to 512d = 20 GB; int8 scalar quantization = 10 GB; binary quantization = 1.25 GB at ~0.95 of original quality when combined with fp32 re-scoring of a candidate set (rescoring is the trick that makes aggressive quantization safe). Product quantization goes further but with real recall cost. HNSW must be RAM-resident to be fast — graph traversal from disk destroys latency; disk-native designs (DiskANN/Vamana) exist for the tail beyond RAM budgets.</div>

<h3>Operational sharp edges</h3>
<ul>
<li><strong>Deletes are soft.</strong> HNSW cannot cheaply unlink a node; deletes tombstone. Heavy churn degrades the graph and wastes memory until a rebuild/compaction — check what your store does (pgvector relies on vacuum; dedicated DBs run background segment merges).</li>
<li><strong>Filtered search is the classic trap.</strong> 'Top 10 where tenant_id = X' composes badly with a graph index: post-filtering top-k can return fewer than 10 (or zero) results when the filter is selective; the graph walk itself can strand in regions where everything is filtered out. Engines handle it differently (pgvector: iterative scan re-descent; Qdrant/Weaviate: filter-aware traversal against payload indexes; some: fall back to brute force under selective filters — often the right answer). Ask this question of any vector store you evaluate; it separates real engines from demos.</li>
<li><strong>IVF as the alternative:</strong> cluster into nlist cells (k-means), search the nprobe nearest cells. Simpler, cheaper to build, memory-lean, pairs naturally with PQ compression at billion scale (IVF-PQ) — but recall is brittle for queries near cell boundaries and the clustering degrades as data drifts (periodic retrain). Rough rule: HNSW for quality and latency in RAM; IVF(+PQ) when memory or build cost dominates at very large N.</li>
</ul>

<div class="callout war">Recurring incident pattern: recall silently decays over months. The index was built when the corpus had 1M vectors; it now has 8M, plus 30 percent tombstoned deletes, and nobody re-tuned ef_search or rebuilt. ANN recall is not a set-and-forget property — it drifts with N, distribution, and churn. Ship a nightly canary: run a fixed query set against brute force on a sample, alert when measured recall drops below target. Teams that do not measure recall invariably believe it is higher than it is.</div>

<div class="callout exam">Interviewers love 'explain HNSW like I am a systems engineer' — the skip-list-over-a-proximity-graph framing lands well. Follow-ups to expect: what happens to tail latency as ef_search rises (linear-ish growth, you are widening a beam search); why filtered search is hard; and 'we have 200k vectors, which vector DB should we use' — where the strong answer is that 200k x 1024d is 800 MB and a flat scan at exact recall is likely fine, so the honest recommendation is no index at all until the numbers say otherwise.</div>
`
    },
    {
      id: "hybrid-search",
      title: "Hybrid search: BM25 + dense, RRF, and rerankers",
      html: `
<p>Dense retrieval has a systematic blind spot: it matches meaning, not tokens. Query for 'ERR_CONN_RESET_1042', a part number, a person's name, a version string, or rare domain jargon, and the embedding model — which has compressed everything into topical geometry — retrieves things that are <em>about</em> the same kind of thing rather than containing the exact string. Lexical search has the mirror-image blind spot: 'how do I get my money back' will not match a document that only says 'refund policy'. Hybrid search is the acknowledgment that these failure modes are complementary, which is exactly what makes the combination work.</p>

<h3>BM25: the lexical half, properly understood</h3>
<p>BM25 is a 30-year-old scoring function that remains brutally hard to beat on exact-match queries. Its shape: for each query term, score contribution rises with term frequency in the document but <strong>saturates</strong> (controlled by k1, typically 1.2–2.0 — the tenth occurrence of a word adds almost nothing, which is what kills keyword-stuffing), is weighted by <strong>inverse document frequency</strong> (rare terms dominate; 'the' contributes ~0), and is normalized by <strong>document length</strong> (parameter b, typically 0.75, so long documents do not win by volume). It is cheap (inverted index lookups), interpretable (you can see which term matched), needs no training, and handles out-of-vocabulary strings — the exact place dense retrieval faceplants. Every serious engine ships it: Elasticsearch/OpenSearch and Lucene natively, Postgres via full-text search, Qdrant/Weaviate/Milvus via built-in sparse/BM25 support, or the Anthropic contextual-retrieval reference stack pairing embeddings with a BM25 index side by side.</p>

<h3>Fusing two ranked lists: RRF</h3>
<p>The naive fusion — normalize both scores to [0,1] and take a weighted sum — is fragile, because BM25 scores are unbounded and corpus-dependent while cosine scores live in a compressed uncalibrated band; the weighting that works on one corpus breaks on the next. <strong>Reciprocal rank fusion (RRF)</strong> sidesteps score incompatibility by using only ranks: each document's fused score is the sum over lists of 1 / (k + rank), with k = 60 by convention. Properties worth stating in an interview: it is scale-free (never looks at raw scores), the constant k damps the influence of top ranks so one list cannot dominate, documents ranked moderately by <em>both</em> systems beat documents ranked #1 by one and absent from the other — and it is embarrassingly simple, ~5 lines of code, no tuning. RRF is the robust default; weighted score fusion can beat it, but only after per-corpus tuning that most teams never maintain.</p>

<h3>Rerankers: the precision stage</h3>
<p>Retrieval with embeddings is a <strong>bi-encoder</strong>: query and document encoded independently, meeting only at a dot product. Cheap (documents pre-computed) but weak — no token-level interaction between query and document. A <strong>cross-encoder reranker</strong> feeds the concatenated (query, document) pair through a transformer jointly, letting every query token attend to every document token, and outputs a relevance score. Far more accurate; far too expensive to run over a corpus. Hence the canonical funnel:</p>
<pre><code>hybrid retrieve top 100–200 (cheap, high recall)
  --&gt; cross-encoder rerank those candidates (expensive, high precision)
  --&gt; take top 5–20 into the LLM context</code></pre>
<ul>
<li><strong>Options as of early 2026:</strong> Cohere Rerank 3.5 (about USD 2 per 1,000 searches), Voyage rerank-2, Jina reranker; open-weights BGE-reranker family and Qwen3-Reranker self-hosted. Latency: tens to a few hundred ms for ~100 candidates, depending on model size and batching.</li>
<li><strong>The cost shape matters:</strong> reranking cost scales with candidates-per-query at query time, not corpus size — the opposite of embedding cost. High-QPS applications feel reranker latency and spend directly on every request; low-QPS/high-stakes applications (internal knowledge, legal, support) get the accuracy nearly free in relative terms.</li>
<li><strong>ColBERT / late interaction</strong> sits between the two: token-level document vectors pre-computed offline, cheap MaxSim interaction at query time. Near-cross-encoder quality at near-bi-encoder latency, paid for in storage (an order of magnitude more vectors). Worth knowing as the third point on the quality/cost curve.</li>
</ul>

<div class="callout deep">Why cross-encoders are so much better: the bi-encoder must compress a document into one vector before ever seeing the query — it has to guess what will be asked. The cross-encoder sees the question first and can perform query-conditioned reading: attention heads literally align query tokens with the evidence spans. It answers 'is this passage relevant to this question' rather than 'are these two texts about the same topic'. That distinction — topical similarity vs answer-bearing relevance — is why a reranker fixes the 'retrieved results are on-topic but useless' failure mode that plagues pure dense pipelines.</div>

<div class="callout war">Production gotcha seen at multiple companies: hybrid search shipped, metrics flat or worse. Root cause: candidate starvation — retrieving top-10 from each system before fusing. If the dense top-10 and the BM25 top-10 barely overlap and both are mediocre, fusion cannot create relevance that was never in the candidate set. Fusion and reranking are filters, not generators: they need a wide, high-recall funnel (top 100+ per retriever) to select from. The pipeline mantra: recall early, precision late. A reranker atop a bad retriever polishes garbage.</div>

<div class="callout exam">Interview probes: 'when would you add BM25 to a working dense pipeline' (answer with the failure taxonomy: IDs, SKUs, error codes, names, jargon, negation-sensitive exact phrases); 'why RRF over weighted score fusion' (scale-free, no tuning, robust to incomparable score distributions); and the budget question — 'you have 50 ms and 100k searches/day' vs '2 s and 500 searches/day' should produce different architectures, and interviewers specifically check that your reranker decision changes with the numbers rather than being an always/never reflex.</div>
`
    },
    {
      id: "vector-store-landscape",
      title: "The vector store landscape: pgvector, dedicated DBs, and doing the math",
      html: `
<p>The vector database market of 2023–2026 produced more marketing than most infrastructure categories in memory, so anchor on physics: a vector store is (1) an array of vectors, (2) maybe an ANN graph over them, (3) a metadata filter engine, and (4) replication/ops around all three. Every product is a packaging of those four things. The decision is rarely about ANN algorithm quality — nearly everyone runs HNSW variants — it is about <strong>where the vectors live relative to your source-of-truth data</strong>, and what the capacity math says.</p>

<h3>Do the capacity math first</h3>
<p>Rule of thumb: <strong>bytes = N x d x 4 (fp32) + ~130 bytes/vector HNSW overhead (M=16) + metadata</strong>. Concretely:</p>
<table>
<thead><tr><th>Corpus</th><th>Vectors (at ~500-token chunks)</th><th>fp32 @ 1024d</th><th>int8</th><th>Verdict</th></tr></thead>
<tbody>
<tr><td>Internal wiki, 30k pages</td><td>~150k</td><td>0.6 GB</td><td>0.15 GB</td><td>Anything works; brute force works</td></tr>
<tr><td>Product docs + tickets, 2M chunks</td><td>2M</td><td>8 GB</td><td>2 GB</td><td>One Postgres box or one small node</td></tr>
<tr><td>Multi-tenant SaaS corpus</td><td>50M</td><td>200 GB</td><td>50 GB</td><td>Real engineering: quantize, shard, or dedicated DB</td></tr>
<tr><td>Web-scale</td><td>1B+</td><td>4+ TB</td><td>1+ TB</td><td>IVF-PQ / DiskANN / object-storage-native territory</td></tr>
</tbody>
</table>
<p>Most teams are in the first two rows and dramatically over-provision. The embedding bill is similarly small: 2M chunks x ~500 tokens = 1B tokens; at text-embedding-3-small prices that is about <strong>USD 20 to embed the entire corpus</strong> (large: ~USD 130). As of early 2026, vectors are cheap; the recurring costs are RAM to serve them and engineer-time to operate the system.</p>

<h3>The three tiers</h3>
<ul>
<li><strong>In-process libraries</strong> — FAISS, hnswlib, sqlite-vec, LanceDB, Chroma in embedded mode. Zero infrastructure, ideal below a few million vectors, for batch/offline work, and for prototypes that quietly become production (fine!). You own persistence, rebuilds, and concurrency.</li>
<li><strong>pgvector (and the relational siblings)</strong> — vectors as a column type in Postgres, HNSW and IVFFlat indexes, halfvec (fp16) and binary types, iterative-scan filtered search. The killer feature is not the index — it is <strong>one database</strong>: vectors live in the same transactional store as the rows they describe, so inserts are atomic with source data (no sync pipeline to drift), filters are SQL WHERE clauses against real columns, joins work, and your existing backup/replication/access-control story applies. Honest limits: index builds are slow and memory-hungry on big tables (maintenance_work_mem matters), heavy vector churn stresses vacuum, and a busy OLTP primary sharing buffer cache with a 30 GB HNSW graph is a noisy-neighbor problem — at which point you split off a replica or a dedicated vector Postgres. Serviceable well into the tens of millions of vectors if you tune it.</li>
<li><strong>Dedicated vector DBs</strong> — Qdrant, Weaviate, Milvus (open-source, self-host or cloud), Pinecone and Turbopuffer (managed, closed). What you actually buy: purpose-built filtered-search execution, built-in quantization with rescoring, hybrid/sparse support in-engine, horizontal sharding beyond one node, and (managed tier) zero ops. What you pay: <strong>a second stateful system</strong> — a sync pipeline from your source of truth, dual-write or CDC drift risk, separate access control that must mirror your application's permissions, another thing on the on-call rota. Order-of-magnitude managed cost as of early 2026: serverless/object-storage-backed offerings (Pinecone serverless, Turbopuffer) bill roughly per-GB stored (order of USD 0.3 per GB-month) plus per-query read units — a 10M x 1024d corpus lands around USD 100–500/month depending on QPS; pod/node-based pricing for latency-critical loads runs higher.</li>
</ul>

<div class="callout war">The most common architectural failure is not slow search — it is <strong>drift between the vector store and the source of truth</strong>. A document is deleted or its permissions change in Postgres; the copy in the external vector DB lingers; retrieval resurfaces deleted content, or worse, leaks a confidential doc to a user whose access was revoked. RAG over a permissioned corpus makes the vector store part of your authorization surface. This is the strongest genuine argument for pgvector-style colocation (delete the row, the vector goes with it, in the same transaction) — and if you do run a dedicated store, you must treat the sync pipeline and ACL-mirroring as production-critical code with reconciliation jobs, not a cron script.</div>

<div class="callout limits">Numbers for the napkin: fp32 vector = 4 bytes x d (1024d = 4 KB; 3072d = 12 KB). 1M x 1024d = 4 GB; 10M = 40 GB; int8 quarters it; binary is 32x smaller (rescore to recover quality). HNSW build on 10M vectors: tens of minutes to hours, CPU-parallel. Embedding 1B tokens: about USD 20–130 by model (early-2026 API prices). Managed vector storage: order USD 0.3/GB-month serverless. A single modern server (64 GB RAM) comfortably serves 10M 1024d fp32 vectors with HNSW at thousands of QPS — most companies never outgrow one box.</div>

<div class="callout exam">The design-interview version of this lesson is a sizing question: 'we have 5M documents, design the retrieval stack.' Strong answers compute bytes before naming products, default to the simplest tier that fits (often pgvector next to existing Postgres), name the drift/ACL risk of a second store unprompted, and give the scaling escape hatch (quantization, then read replicas, then a dedicated engine). Reflexively answering 'Pinecone' without the arithmetic is the most reliable junior tell in this entire topic area.</div>
`
    }
  ],
  quiz: [
    {
      q: "Your team uses an open-source embedding model that returns L2-normalized vectors. A teammate wants to switch the index distance metric from cosine similarity to dot product to save compute. What is the correct assessment?",
      options: [
        "Rankings will change significantly because dot product is sensitive to vector magnitude",
        "The switch is safe: for unit-normalized vectors, cosine and dot product produce identical rankings, and dot product is cheaper to compute",
        "Dot product should never be used for text embeddings; it is only for recommendation systems",
        "The switch requires re-embedding the corpus with a dot-product-trained model"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the switch is safe.</strong> For unit vectors, cosine similarity IS the dot product (cosine = dot / (|a||b|), and the magnitudes are 1), and squared Euclidean distance is a monotonic transform of both — all three rank identically. Dot product skips the normalization arithmetic, so it is the cheapest.</p><p><strong>Why the others are wrong:</strong> magnitude sensitivity only matters for <em>unnormalized</em> vectors — the premise says they are normalized. Dot product is used constantly for text embeddings (most APIs return normalized vectors precisely so users can dot-product them). Re-embedding is unnecessary — no model change is happening, only an equivalent metric computation.</p>"
    },
    {
      q: "A production RAG system starts returning subtly worse results, but only for older documents. Recently added documents retrieve fine. What is the most likely cause?",
      options: [
        "The HNSW index has accumulated too many tombstoned deletes",
        "Newer documents were embedded with a different or updated embedding model than the older ones, making cross-era vectors incomparable",
        "The chunk size was tuned for newer document formats",
        "BM25 term frequencies have drifted as the corpus grew"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: mixed embedding model versions.</strong> Embedding spaces are only meaningful within one model version. If new content is embedded with a revved model into the same index, queries (embedded with the new model) match new documents fine but land arbitrarily relative to old vectors — exactly the 'old documents degraded' signature. Prevention: pin and store the model version per vector, hard-fail on mismatch, re-embed on upgrade.</p><p><strong>Why the others are wrong:</strong> tombstone accumulation degrades recall broadly, not selectively by document age relative to a model change. Chunk-size tuning would affect the documents whose format changed, and would have been a deliberate, visible change. BM25 IDF drift causes mild ranking shifts, not a systematic old-vs-new cliff — and the scenario describes a dense-retrieval symptom.</p>"
    },
    {
      q: "You are building search over 300,000 support-ticket chunks embedded at 1024 dimensions, serving about 2 queries per second. An engineer proposes deploying a dedicated vector database cluster with HNSW. What is the strongest counterargument?",
      options: [
        "HNSW recall is too low for support tickets; IVF-PQ should be used instead",
        "300k x 1024d fp32 is about 1.2 GB; a brute-force scan over an in-memory array gives exact recall in milliseconds at this scale and QPS, so an ANN index and a new stateful service are premature",
        "Dedicated vector databases cannot do metadata filtering",
        "The corpus should first be reduced to 256 dimensions, after which the cluster will be cheaper"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: do the arithmetic.</strong> 300k x 1024 x 4 bytes is roughly 1.2 GB — laptop-RAM scale. A vectorized flat scan at this size runs in single-digit-to-tens of milliseconds with recall exactly 1.0, no tuning, trivial deletes, no sync pipeline, no new on-call surface. The complexity of an ANN index and a second stateful system buys nothing at 2 QPS and 300k vectors.</p><p><strong>Why the others are wrong:</strong> HNSW recall is excellent (typically 0.95+ tuned) — the objection is unfounded, and IVF-PQ trades recall for memory, the wrong direction here. Dedicated DBs do metadata filtering — often better than alternatives; that claim is simply false. Dimension truncation is a real lever but optimizing the cost of an unnecessary cluster misses the point: the cluster itself is the mistake.</p>"
    },
    {
      q: "Retrieval quality is poor for a knowledge-base RAG system. You dump 20 random chunks from the index and find that HTML tables were flattened into unreadable word streams and section headings were dropped. Which fixes directly address what you found? (Select 2)",
      options: [
        "Switch to a higher-ranked embedding model on the MTEB leaderboard",
        "Fix the HTML extraction to preserve table structure, and keep tables whole with captions or serialize rows with repeated headers",
        "Prepend the document title and heading path to each chunk before embedding",
        "Increase ef_search on the HNSW index",
        "Raise top-k from 5 to 20"
      ],
      answer: [1, 2],
      multi: true,
      explanation: "<p><strong>Correct: fix extraction, and prepend heading context.</strong> The diagnosis is a data problem: the embedding model can only encode what is in the chunk, and the chunks are garbage. Preserving table structure makes the most-queried content embeddable; prepending title/heading paths restores the topical context that was stripped, which measurably improves recall.</p><p><strong>Why the others are wrong:</strong> a better embedding model cannot recover structure that was destroyed before it ever saw the text — garbage in, slightly-better-embedded garbage out. ef_search tunes ANN recall — the approximate index faithfully returns the nearest <em>garbage</em>; the true neighbors are also garbage. Raising top-k feeds more of the same broken chunks to the LLM and inflates cost without fixing relevance.</p>"
    },
    {
      q: "A colleague proposes embedding entire documents (3,000 to 8,000 tokens each) as single vectors to keep the pipeline simple, since the embedding model accepts 8k tokens of input. What is the core technical problem with this plan?",
      options: [
        "Most vector databases reject vectors generated from inputs longer than 2,000 tokens",
        "Pooling compresses the whole document into one fixed-size vector, diluting specific facts into a topical average, so queries about details will fail to match",
        "Long inputs make embedding API costs prohibitive relative to chunked embedding",
        "Documents longer than the chunk size cannot be cited in generated answers"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: dilution through pooling.</strong> Embedders mean-pool (or CLS-pool) token representations into one fixed-size vector — lossy compression biased toward the dominant topic. An 8,000-token document averaged into 1024 floats retains the gist and loses the specifics; a query targeting one clause matches on-topic documents rather than answer-bearing passages. Model input limits define what is <em>accepted</em>, not what embeds <em>well</em>.</p><p><strong>Why the others are wrong:</strong> vector DBs see only the output vector — they neither know nor care about input length. Cost is roughly linear in tokens either way; chunking with overlap actually embeds slightly <em>more</em> tokens. Citation granularity is a real downstream concern but is a design choice, not the core retrieval failure — the retrieval itself breaks first.</p>"
    },
    {
      q: "You adopt parent-document (small-to-big) retrieval: embed 200-token chunks, but return the enclosing 1,500-token section to the LLM. What problem is this designed to solve, and what new issue must you handle?",
      options: [
        "It solves slow index builds; you must handle increased embedding costs",
        "It solves the precision-vs-context tension: small chunks match precisely but lack context for generation; you must deduplicate when multiple matched chunks share the same parent",
        "It solves embedding model version drift; you must handle re-embedding parents",
        "It solves hallucination by grounding; you must handle citation formatting"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: it decouples the match unit from the generation unit.</strong> Small chunks give sharp, specific vectors (good matching); large sections give the LLM enough surrounding context to actually use the match. The classic new issue: several top-k chunks often belong to the same parent, so naive assembly duplicates the section in the prompt — you deduplicate by parent ID and re-rank parents.</p><p><strong>Why the others are wrong:</strong> index build speed is unaffected (you embed the small chunks either way), and embedding cost barely changes. Model version drift is orthogonal — parent retrieval neither causes nor cures it. Grounding/citations happen at generation time regardless of retrieval unit; parent retrieval can even make span-level citation slightly harder, not easier.</p>"
    },
    {
      q: "Your HNSW-backed search runs at ef_search=40 with measured recall@10 of 0.88. Product wants recall above 0.97 and can tolerate 3x current query latency. Which change achieves this most directly, without rebuilding the index?",
      options: [
        "Increase M from 16 to 64",
        "Increase ef_construction from 200 to 400",
        "Increase ef_search until measured recall crosses 0.97, accepting roughly linear latency growth",
        "Switch the distance metric from cosine to Euclidean"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>Correct: ef_search is the query-time recall/latency dial.</strong> It widens the beam of the graph search, is tunable per query without touching the index, and the recall-vs-ef curve typically saturates well above 0.97 within a few-x latency budget. This is exactly the knob for 'more recall, latency budget available, no rebuild'.</p><p><strong>Why the others are wrong:</strong> M and ef_construction are <em>build-time</em> parameters — changing them means rebuilding the index, which the question excludes; they raise the recall ceiling but do nothing for an existing graph. Changing the metric on normalized vectors changes nothing (equivalent rankings) and on unnormalized vectors changes the <em>meaning</em> of the results, not the recall against the intended metric — it is a correctness hazard, not a tuning knob.</p>"
    },
    {
      q: "Users of a multi-tenant search product report that queries with a tenant filter sometimes return only 2 or 3 results even though the tenant has thousands of matching documents. The stack is HNSW with post-filtering. What is happening?",
      options: [
        "The tenant's vectors were never indexed",
        "Top-k results are retrieved from the global graph first and then filtered, so when the filter is selective, most of the top-k belongs to other tenants and is discarded",
        "HNSW cannot store metadata alongside vectors",
        "The tenant's documents are too similar to each other, causing the graph to collapse them"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the post-filtering starvation problem.</strong> The graph walk finds the global top-k nearest neighbors, then the filter throws away everything not belonging to the tenant. With a selective filter (one tenant among many), most or all of the top-k dies in filtering. Fixes: filter-aware graph traversal (Qdrant/Weaviate-style), pgvector's iterative re-descent, over-fetching with iteration, partitioning per tenant, or brute force within the filtered subset — often the cleanest answer for selective filters.</p><p><strong>Why the others are wrong:</strong> 'never indexed' would return zero results always, not 2–3 sometimes. HNSW implementations routinely store payloads/metadata — the limitation is in how filtering composes with traversal, not storage. Similar vectors do not 'collapse' in the graph; near-duplicates may crowd ranking but would still belong to the right tenant and pass the filter.</p>"
    },
    {
      q: "Which query types would you expect dense (embedding-only) retrieval to handle poorly compared to BM25? (Select 3)",
      options: [
        "A query containing an exact error code like a hex fault identifier",
        "A paraphrased question using none of the document's vocabulary",
        "A search for a specific part number in a catalog",
        "A query for a person's uncommon surname",
        "A conceptual question about the theme of a document"
      ],
      answer: [0, 2, 3],
      multi: true,
      explanation: "<p><strong>Correct: error codes, part numbers, rare names.</strong> These are exact-token matches where the string itself is the signal. Embedding models compress text into topical geometry; rare identifiers are often out-of-distribution, tokenized into meaningless fragments, and land nowhere useful in the space. BM25's inverse-document-frequency weighting makes rare exact terms dominate the score — precisely the right behavior.</p><p><strong>Why the others are wrong:</strong> paraphrase with zero vocabulary overlap is dense retrieval's <em>best</em> case and BM25's worst — no shared terms means BM25 scores near zero while embeddings match the meaning. Conceptual/thematic questions are likewise semantic matches where dense shines. These two options describe why hybrid needs the dense half; the three correct options describe why it needs the lexical half.</p>"
    },
    {
      q: "You fuse dense and BM25 result lists. A teammate proposes min-max normalizing each system's scores to the 0-to-1 range and averaging. You propose reciprocal rank fusion. What is the strongest argument for RRF?",
      options: [
        "RRF uses the raw scores, which are more informative than ranks",
        "RRF is scale-free: it ignores raw scores entirely, so it is robust to BM25's unbounded corpus-dependent scores and cosine's compressed band, and needs no per-corpus weight tuning",
        "RRF guarantees strictly higher recall than any score-based fusion",
        "Min-max normalization is impossible for cosine similarity scores"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: scale-freedom and robustness.</strong> BM25 scores are unbounded and shift with corpus statistics; cosine scores sit in a narrow uncalibrated band that varies by model. Min-max normalization is hostage to outliers in each result list and the 'right' weighting drifts per corpus and per query mix. RRF (sum of 1/(k+rank), k around 60) reads only ranks — stable across systems, roughly 5 lines of code, no tuning to maintain.</p><p><strong>Why the others are wrong:</strong> RRF deliberately does NOT use raw scores — that is its feature, and the first option states the opposite of how it works. No fusion method <em>guarantees</em> higher recall universally; tuned weighted fusion can beat RRF on a specific corpus — RRF's claim is robustness, not dominance. Min-max normalization of cosine scores is trivially possible; it is fragile, not impossible.</p>"
    },
    {
      q: "A search pipeline retrieves top-10 candidates from a dense index and top-10 from BM25, fuses with RRF, then applies a cross-encoder reranker, keeping top-5. Quality is disappointing. What is the most likely structural flaw?",
      options: [
        "The reranker should run before fusion, not after",
        "The candidate funnel is too narrow: fusion and reranking only reorder what is retrieved, so each retriever should contribute on the order of 100+ candidates for the precision stages to select from",
        "RRF cannot be combined with a cross-encoder in one pipeline",
        "Top-5 is too few results to pass to the LLM"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: candidate starvation.</strong> Rerankers and fusion are filters, not generators — they cannot surface a document that no retriever fetched. With only 10 candidates per system, the true best answer frequently is not in the pool at all, and the expensive cross-encoder polishes a mediocre set. The canonical funnel is recall-early, precision-late: 100–200 candidates per retriever, fuse, rerank, then cut to the final handful.</p><p><strong>Why the others are wrong:</strong> running the cross-encoder <em>before</em> fusion would mean running it over the whole corpus or each raw list — strictly more cost for no benefit; the funnel exists to protect the expensive stage. RRF then reranking is the standard, fully compatible pattern (Anthropic's contextual-retrieval reference stack does exactly this). Top-5 into the LLM may even be right — the flaw is upstream: what those 5 are chosen <em>from</em>.</p>"
    },
    {
      q: "Your corpus is 10 million chunks embedded at 1024 dimensions in fp32 with an HNSW index at M=16. Roughly how much RAM do the raw vectors require, and what is the cheapest first lever if that exceeds your budget?",
      options: [
        "About 4 GB; shard across three nodes",
        "About 40 GB; if the model supports Matryoshka truncation, halving dimensions to 512 halves memory with modest quality loss, before considering int8 or binary quantization",
        "About 400 GB; product quantization is mandatory at this scale",
        "About 10 GB; move the index to disk since HNSW performs equally well from SSD"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: 10M x 1024 x 4 bytes = ~40 GB</strong> (plus roughly 130 bytes/vector of graph overhead at M=16 — small next to 4 KB vectors). The lever ladder: MRL truncation (512d = 20 GB, near-free quality-wise for MRL-trained models), then int8 scalar quantization (10 GB), then binary with fp32 rescoring (1.25 GB, surprisingly good with rescore). PQ is for a further order of magnitude beyond that.</p><p><strong>Why the others are wrong:</strong> 4 GB is the 1M-vector number — off by 10x, and sharding is an operational sledgehammer applied before cheap math levers. 400 GB is off by 10x the other way; PQ is not mandatory at 40 GB — that fits one commodity server. HNSW from disk is explicitly bad — graph traversal is random access, and SSD random reads destroy the latency that justifies HNSW; disk-native ANN needs different algorithms (DiskANN/Vamana).</p>"
    },
    {
      q: "You must decide between adding pgvector to the existing Postgres cluster or deploying a managed dedicated vector database for a permissioned internal-documents corpus of 3 million chunks. Which considerations genuinely favor pgvector here? (Select 2)",
      options: [
        "Vectors are deleted and permission changes take effect in the same transaction as the source-of-truth row, eliminating sync-pipeline drift and stale-ACL leakage",
        "pgvector's HNSW implementation has fundamentally higher recall than dedicated engines",
        "3M x 1024d is roughly 12 GB — comfortably one-node scale, so a dedicated system's horizontal sharding buys nothing",
        "pgvector avoids the need to choose a chunk size",
        "Dedicated vector databases cannot store document metadata"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<p><strong>Correct: transactional colocation, and the size math.</strong> For a <em>permissioned</em> corpus, the killer pgvector argument is that the vector row lives with the source row: deletes and ACL changes are atomic, so there is no CDC pipeline to drift and resurface deleted or forbidden content — the worst vector-store failure mode. And 3M x 1024d x 4B is ~12 GB: single-node territory where sharding, the dedicated DBs' structural advantage, is irrelevant.</p><p><strong>Why the others are wrong:</strong> recall is an algorithm-and-tuning property — everyone runs HNSW variants; pgvector holds no fundamental recall advantage (if anything, dedicated engines have fancier filtered-search execution). Chunking is upstream of storage entirely — every store needs that decision. Dedicated DBs store rich metadata/payloads and filter on them well; that claim is false.</p>"
    },
    {
      q: "A team is evaluating embedding models by MTEB leaderboard rank alone and plans to pick the number one open model. What are the two most important critiques of this process? (Select 2)",
      options: [
        "MTEB scores among top models are close together and increasingly affected by benchmark contamination, so rank differences may not transfer to any specific corpus",
        "A small labeled evaluation set of real user queries against your own corpus is a far more decisive signal than leaderboard position",
        "MTEB only evaluates models with fewer than 1 billion parameters",
        "Open-weight models cannot be used commercially",
        "Leaderboard rank determines vector database compatibility"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>Correct: contamination/noise, and evaluate-on-your-own-data.</strong> Top-tier MTEB scores are separated by margins within noise, and training-on-the-benchmark (direct or via distillation) inflates ranks in ways that do not transfer. Fifty labeled real queries with recall@k against your corpus will reorder the leaderboard for your use case surprisingly often — and it also captures your latency, prefix-handling, and input-length realities.</p><p><strong>Why the others are wrong:</strong> MTEB includes models of all sizes, including 7B+ embedders — no such parameter cap exists. Many open-weight models are Apache/MIT licensed and commercially usable (some have restrictive licenses — a real check, but not a blanket truth). Vector DBs consume float arrays; they are entirely agnostic to which model produced them — 'compatibility' by rank is not a thing.</p>"
    }
  ],
  flashcards: [
    { front: "For L2-normalized vectors, what is the relationship between cosine similarity, dot product, and Euclidean distance?", back: "<p>They rank identically: cosine = dot product for unit vectors, and squared L2 = 2 - 2·cosine. Use dot product — it is cheapest.</p>" },
    { front: "Why are embedding similarity scores not comparable across models, and what operational rule follows?", back: "<p>Each model learns its own geometry; scores are ordinal and uncalibrated within it, meaningless across models. Rule: store model name+version with every vector; a model upgrade means re-embedding the whole corpus.</p>" },
    { front: "What is Matryoshka representation learning (MRL) and why does it matter operationally?", back: "<p>Training that front-loads information into leading dimensions, so vectors can be truncated (e.g. 3072 to 512) and re-normalized with modest quality loss. Cheapest memory/cost lever — use before quantization.</p>" },
    { front: "What silent bug affects open-source retrieval embedders like E5/BGE at inference time?", back: "<p>Omitting the required instruction prefixes (like 'query:' / 'passage:') they were trained with. Recall drops several points with no error thrown.</p>" },
    { front: "Why does chunking typically matter more than embedding model choice?", back: "<p>The model can only encode what is in the chunk. Bad boundaries (split facts, merged topics, destroyed tables) lose information unrecoverably — swinging recall by 15–30 points, vs low single digits between decent models.</p>" },
    { front: "Default chunking parameters for prose, as of early 2026?", back: "<p>Structure-aware recursive splitting, ~400–512 tokens per chunk, 10–20 percent overlap, heading path prepended to each chunk. Working band 200–800 tokens.</p>" },
    { front: "What is parent-document (small-to-big) retrieval?", back: "<p>Embed small precise chunks for matching; return the larger enclosing section for generation. Decouples match unit from generation unit. Requires parent pointers and dedup when siblings match.</p>" },
    { front: "What is contextual retrieval and what does it cost?", back: "<p>Prepend an LLM-generated 1–2 sentence context (doc title, section, referents) to each chunk before embedding/indexing. Anthropic reported ~1/3 fewer retrieval failures. Cost is index-time only: one cheap LLM call per chunk.</p>" },
    { front: "HNSW in one mental model?", back: "<p>A skip list over a proximity graph: sparse upper layers for long hops across the space, dense bottom layer for precise greedy beam search. O(log N)-ish hops, RAM-resident.</p>" },
    { front: "What do HNSW's M, ef_construction, and ef_search control?", back: "<p><strong>M</strong>: links per node — recall ceiling and memory (build-time). <strong>ef_construction</strong>: build beam width — graph quality (build-time). <strong>ef_search</strong>: query beam width — THE runtime recall/latency dial, tunable per query.</p>" },
    { front: "When is brute-force vector search the right answer?", back: "<p>Under ~1M vectors at moderate QPS: e.g. 1M x 1024d = 4 GB, flat scan in ~10–50 ms on CPU, recall exactly 1.0, zero tuning/build/delete problems. Index earns its keep past ~1–10M vectors or high QPS.</p>" },
    { front: "Memory formula for a vector index, and the 10M x 1024d fp32 number?", back: "<p>N x d x 4 bytes (fp32) + ~130 B/vector HNSW overhead at M=16. 10M x 1024d = ~40 GB. int8 = 10 GB; binary+rescore = 1.25 GB; MRL truncation halves per halving of d.</p>" },
    { front: "Why is filtered vector search (WHERE clause + top-k) hard for graph indexes, and what are the fixes?", back: "<p>Post-filtering a global top-k starves results under selective filters; the graph walk can strand in filtered-out regions. Fixes: filter-aware traversal, iterative re-descent (pgvector), over-fetch, per-tenant partitions, or brute force within the filtered subset.</p>" },
    { front: "What retrieval failure modes does BM25 cover that dense retrieval misses?", back: "<p>Exact rare tokens: error codes, part numbers, IDs, uncommon names, version strings, domain jargon. IDF makes rare exact terms dominate — precisely where embeddings, which encode topical meaning, faceplant.</p>" },
    { front: "Reciprocal rank fusion: formula and why it beats score normalization?", back: "<p>Fused score = sum over lists of 1/(k + rank), k typically 60. Uses ranks only — immune to BM25's unbounded scores and cosine's compressed band; no per-corpus weight tuning; ~5 lines of code.</p>" },
    { front: "Bi-encoder vs cross-encoder: the one-sentence distinction and the resulting architecture?", back: "<p>Bi-encoder embeds query and doc independently (cheap, precomputable, weaker); cross-encoder attends over the pair jointly (accurate, expensive). Architecture: hybrid-retrieve 100–200 cheaply, cross-encoder rerank, keep top 5–20.</p>" },
    { front: "Order-of-magnitude costs: embedding a 1B-token corpus, and reranking, as of early 2026?", back: "<p>Embedding: ~USD 20 (text-embedding-3-small at 0.02/1M tok) to ~130 (large). Reranking: ~USD 2 per 1,000 searches (Cohere Rerank class), scaling with query volume, not corpus size — the opposite cost shape.</p>" },
    { front: "The strongest genuine argument for pgvector over a dedicated vector DB?", back: "<p>Transactional colocation with the source of truth: deletes and ACL changes apply atomically to the vector row — no sync pipeline to drift, no resurfacing deleted or permission-revoked content. One backup/replication/access story.</p>" },
    { front: "What recurring operational check should every ANN deployment have?", back: "<p>A recall canary: fixed query set scored against brute-force ground truth on a sample, alerting on drift. ANN recall decays silently with corpus growth, distribution shift, and tombstoned deletes.</p>" }
  ],
  lab: {
    title: "Lab: brute force vs HNSW — measure the recall/latency trade-off yourself",
    html: `
<p><strong>Goal:</strong> build the same search corpus twice — once as a flat numpy brute-force scan, once as an HNSW index — and measure recall@10 and latency as you turn the ef_search dial. Everything runs locally and free; the only download is a ~90 MB open embedding model.</p>

<h3>Architecture</h3>
<p>One Python script family: embed ~5,000 text chunks with all-MiniLM-L6-v2 (384d, normalized output), hold them as a numpy matrix (ground truth via exact dot-product scan), build an hnswlib index over the same vectors, then sweep ef_search and report recall@10 against the exact results plus per-query latency for both paths.</p>

<h3>Steps</h3>
<ol>
<li><strong>Environment.</strong>
<pre><code>mkdir -p ~/ann-lab &amp;&amp; cd ~/ann-lab
python3 -m venv .venv &amp;&amp; . .venv/bin/activate
pip install sentence-transformers hnswlib numpy datasets</code></pre></li>
<li><strong>Get a corpus.</strong> Any ~5k short texts work. Quick option using the AG News dataset:
<pre><code>python3 - &lt;&lt;'EOF'
from datasets import load_dataset
ds = load_dataset("ag_news", split="train[:5000]")
open("corpus.txt","w").write("\n".join(t.replace("\n"," ") for t in ds["text"]))
EOF</code></pre></li>
<li><strong>Embed.</strong>
<pre><code>python3 - &lt;&lt;'EOF'
from sentence_transformers import SentenceTransformer
import numpy as np
texts = open("corpus.txt").read().splitlines()
model = SentenceTransformer("all-MiniLM-L6-v2")
emb = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)
np.save("emb.npy", emb.astype("float32"))
EOF</code></pre></li>
<li><strong>Ground truth + HNSW sweep.</strong> Save as <code>sweep.py</code> and run it:
<pre><code>import numpy as np, hnswlib, time
emb = np.load("emb.npy"); n, d = emb.shape
rng = np.random.default_rng(0)
qidx = rng.choice(n, 200, replace=False)
Q = emb[qidx]

t0 = time.perf_counter()
scores = Q @ emb.T                      # exact: one matmul
truth = np.argsort(-scores, axis=1)[:, :11]
bf_ms = (time.perf_counter() - t0) * 1000 / len(Q)
truth = [set(row[row != qi][:10]) for row, qi in zip(truth, qidx)]

idx = hnswlib.Index(space="ip", dim=d)
idx.init_index(max_elements=n, M=16, ef_construction=200)
idx.add_items(emb, np.arange(n))

print("brute force: %.3f ms/query, recall 1.000" % bf_ms)
for ef in (10, 20, 40, 80, 160, 320):
    idx.set_ef(ef)
    t0 = time.perf_counter()
    labels, _ = idx.knn_query(Q, k=11)
    ms = (time.perf_counter() - t0) * 1000 / len(Q)
    rec = np.mean([len(set(l[l != qi][:10]) &amp; t) / 10
                   for l, qi, t in zip(labels, qidx, truth)])
    print("ef=%4d  %.3f ms/query  recall@10=%.3f" % (ef, ms, rec))</code></pre></li>
<li><strong>Verify.</strong> You should see recall climb from roughly 0.8–0.9 at ef=10 toward 0.99+ by ef=160–320, with latency growing roughly linearly in ef — and note how the brute-force number at n=5,000 is so fast that HNSW only 'wins' in your head. Re-run mentally at n=10M: that is the whole lesson.</li>
<li><strong>Extend (optional).</strong> Re-embed with <code>normalize_embeddings=False</code> and watch inner-product rankings shift; or truncate vectors to 192 dims, re-normalize, and measure the recall cost of Matryoshka-style truncation on a non-MRL model.</li>
</ol>

<h3>Teardown</h3>
<p>Everything is local; teardown is deleting the working directory and the cached model:</p>
<pre><code>deactivate
rm -rf ~/ann-lab
rm -rf ~/.cache/huggingface/hub/models--sentence-transformers--all-MiniLM-L6-v2</code></pre>
<p>Nothing was created in any cloud account and nothing continues to bill.</p>
`
  }
});
