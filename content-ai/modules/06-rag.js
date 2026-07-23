/* Module 06 — RAG: Retrieval-Augmented Generation (applied track) */
window.COURSE.register({
  id: "rag",
  order: 6,
  track: "applied",
  title: "RAG: Retrieval-Augmented Generation",
  description: "RAG as a systems problem: the full pipeline and the specific place each stage silently degrades, the retrieval-quality toolbox (query rewriting, HyDE, parent-document retrieval, metadata filters), generation-side grounding and graceful refusal, evaluation that actually catches regressions (recall@k, MRR, faithfulness evals) — and an honest decision framework for when long-context stuffing, fine-tuning, or agentic search beats RAG outright.",
  examWeight: "RAG system design is the single most common AI-engineering interview exercise as of early 2026: expect to design the pipeline on a whiteboard, be pushed on evaluation ('how do you know retrieval is good?'), debug a described failure, and defend RAG against 'why not just use the 1M-token context window?'. Hiring loops specifically reward candidates who talk about evals and failure modes unprompted.",
  lessons: [
    {
      id: "pipeline",
      title: "The RAG pipeline end-to-end — and where it silently degrades",
      html: `
<p>RAG is not a model technique; it is a <strong>distributed data pipeline with an LLM at the end</strong>, and it fails the way pipelines fail: silently, at stage boundaries, in ways no single component's logs reveal. The senior move is to see it as roughly ten stages, each with a known degradation mode, and to instrument the seams. The demo works because demos exercise the happy path of every stage simultaneously; production traffic explores the failure modes one user at a time.</p>

<h3>The stages, ingest side</h3>
<ol>
<li><strong>Acquire and parse.</strong> PDFs, HTML, wikis, tickets. Degradation: PDF text extraction scrambles multi-column layouts and tables; OCR noise; headers/footers/nav boilerplate pollute every page; scanned docs silently yield empty text. This stage causes more RAG failures than any model decision, and almost nobody reads its output.</li>
<li><strong>Chunk.</strong> Degradation: boundaries split facts from their subjects, tables from captions, code from context (covered in depth in the embeddings module — the lessons compound here).</li>
<li><strong>Enrich and embed.</strong> Metadata (title, section, date, ACLs) attached; chunks embedded. Degradation: missing metadata forecloses filtering later; embedding-model version drift makes eras of the index mutually incoherent.</li>
<li><strong>Index.</strong> Degradation: staleness. The corpus changed; the index did not. Deleted docs linger (worst case: permission-revoked docs — a security bug, not a quality bug); updated docs exist in two versions; the sync pipeline from source-of-truth to index quietly stops and nobody has an alert on index lag.</li>
</ol>

<h3>The stages, query side</h3>
<ol>
<li><strong>Query understanding.</strong> The user's raw words are embedded as-is. Degradation: conversational queries ('what about the second one?') embed to garbage without context resolution; typos and jargon mismatch the corpus register.</li>
<li><strong>Retrieve.</strong> Dense, hybrid, filtered. Degradation: everything in the previous module — plus the quiet catastrophe of retrieving <em>plausible but wrong</em> chunks, which downstream stages cannot detect.</li>
<li><strong>Rerank and select.</strong> Degradation: candidate starvation (reranking 10 mediocre candidates); near-duplicate chunks crowding out coverage.</li>
<li><strong>Assemble context.</strong> Chunks plus instructions plus history into one prompt. Degradation: silent truncation when the budget overflows (often cutting the <em>most</em> relevant chunk, depending on assembly order); duplicated parents; no provenance markers, making citation impossible later.</li>
<li><strong>Generate.</strong> Degradation: the model answers from parametric memory instead of the provided context; blends two contradictory retrieved versions; or fabricates around a gap. Retrieval was fine — generation went off-context anyway.</li>
<li><strong>Post-process and cite.</strong> Degradation: citations that point at chunks the answer did not actually use; answers stripped of the hedges the model correctly included.</li>
</ol>

<div class="callout war">A composite of real postmortems: answer quality 'degraded gradually over a quarter'. Cause chain: an upstream CMS migration changed HTML structure; the parser started dropping table bodies; new chunks embedded as fragments; index lag alarms did not exist; eval set was built from old documents, so offline metrics stayed green; user thumbs-down rate crept up 2 percent a week until support noticed. Five stages each 'worked'; the pipeline failed. Moral: end-to-end evals on <em>fresh</em> documents, plus per-stage canaries (parse yield, chunk length distributions, index lag, retrieval hit rate against a labeled set), are not optional extras — they are the product.</div>

<h3>Latency and cost shape</h3>
<p>Know where the milliseconds and dollars sit. Typical interactive RAG query, early-2026 numbers: query embedding 10–50 ms (local) to ~100 ms (API); ANN retrieval 5–50 ms; rerank 50–300 ms; generation dominates everything — a few hundred ms to first token, then seconds of streaming for a long answer with a frontier model. Cost per query is similarly lopsided: embedding a query costs micro-cents; the generation call with 5–20 chunks of context costs from a fraction of a cent (Gemini Flash / GPT mini-class / Claude Haiku) to several cents (frontier models with fat contexts). Practical consequences: optimizing retrieval latency below ~100 ms is invisible next to generation; and context size discipline (fewer, better chunks) is simultaneously a quality lever, a latency lever, and the main cost lever.</p>

<div class="callout deep">Why more retrieved context is not monotonically better: attention over long contexts exhibits position bias — models attend most reliably to the beginning and end of the context (the 'lost in the middle' result, which still measurably applies to long-context models as of early 2026, though much less severely than in 2023). Stuffing 40 chunks means the marginal chunk lands mid-context where recall-by-the-model is weakest, while diluting the signal-to-noise of the whole prompt and multiplying cost. Empirically most systems peak somewhere between 5 and 20 well-chosen chunks; past the peak, quality degrades while spend rises — the worst quadrant.</div>

<div class="callout exam">The whiteboard prompt is usually 'design a RAG system for our internal docs'. Interviewers grade the seams, not the boxes: do you mention parsing as a failure source, index staleness and ACL sync, silent truncation at assembly, and how you would <em>know</em> each stage works (per-stage metrics)? Candidates who draw embed-retrieve-generate and spend their time on vector DB choice fail this question in a way they never find out about.</div>
`
    },
    {
      id: "retrieval-quality",
      title: "Retrieval quality: query rewriting, HyDE, parent-document retrieval, filters",
      html: `
<p>The single highest-leverage insight in applied RAG: <strong>the user's query is almost never the best retrieval key</strong>. Users write conversational fragments, underspecified questions, and vocabulary that does not match the corpus. Everything in this lesson is a technique for transforming either the query or the indexed representation so they meet in the middle.</p>

<h3>Query rewriting</h3>
<ul>
<li><strong>Conversational resolution (mandatory for chat).</strong> 'Does it support SSO?' after a discussion of some specific product must become 'Does Acme Deploy Enterprise support SSO single sign-on?' before embedding. A cheap-model LLM call rewrites the query given the conversation history; without it, multi-turn RAG retrieves against pronouns. This is the most consequential 30 lines of code in any chat-based RAG system.</li>
<li><strong>Multi-query expansion.</strong> Generate 3–5 paraphrases/subqueries, retrieve for each, union and fuse (RRF again). Buys recall on vocabulary-mismatch failures for one cheap LLM call and parallel retrievals; costs latency and can dilute precision — cap the union and rerank it.</li>
<li><strong>Decomposition.</strong> 'Compare our refund policy for EU vs US customers' retrieves poorly as one query — the embedding is a blur of both. Split into per-facet subqueries, retrieve each, assemble labeled evidence. This is the boundary where RAG starts shading into agentic behavior.</li>
</ul>

<h3>HyDE — and its honest status</h3>
<p><strong>Hypothetical Document Embeddings:</strong> ask an LLM to hallucinate a plausible <em>answer</em> to the query, embed that fake document, and retrieve with its vector. Rationale: a hypothetical answer is shaped like the passages you want (dense with the right entities and register), so answer-to-passage similarity beats question-to-passage similarity, especially for terse questions against verbose corpora. The honest early-2026 assessment: HyDE was a clever fix for weaker embedding models and zero-shot domains; modern retrieval-tuned embedders trained on question-passage pairs have absorbed much of its advantage, and it adds a full LLM call of latency plus a failure mode (the hallucinated answer drags retrieval toward plausible-but-wrong neighborhoods when the model guesses badly). Know it, cite it, benchmark it on your corpus — but reach for multi-query and rerankers first.</p>

<h3>Fixing the indexed side instead</h3>
<ul>
<li><strong>Parent-document (small-to-big) retrieval:</strong> match on small precise chunks, hand the LLM the enclosing section (mechanics in the embeddings module). In RAG specifically it also repairs decomposed and multi-hop questions, because the parent carries neighboring facts the small chunk lacks.</li>
<li><strong>Contextual chunk enrichment:</strong> prepend LLM-generated situating context per chunk at index time — attacks vocabulary mismatch from the document side, with zero query-time latency, which is why index-time fixes should generally be exhausted before query-time ones.</li>
<li><strong>Question-form indexing:</strong> generate the questions each chunk answers, embed those alongside the chunk. Question-to-question similarity is the easiest matching problem of all. Storage grows; works notably well for FAQ-shaped corpora.</li>
</ul>

<h3>Metadata filtering: the underrated workhorse</h3>
<p>Semantic similarity cannot express 'from the 2025 handbook, not the 2019 one', 'status: current', 'region: EU', or 'documents this user may read'. Those are predicates, and belong in structured filters that constrain retrieval <em>before</em> similarity ranks what remains. Three rules seniors apply:</p>
<ul>
<li><strong>Filter beats rank for hard constraints.</strong> Version, product, date range, tenant, language: if a wrong-version chunk must never appear, no similarity score should be allowed to overrule the predicate. Extracting filterable intent from the query ('for v3...' becomes version=3) is itself a cheap LLM or rules task — self-query retrieval.</li>
<li><strong>Recency needs a policy.</strong> Embeddings are date-blind; a 2019 policy doc and its 2025 replacement are near-identical vectors. Options: filter to current versions at ingest (best), boost recency at ranking, or let contradictory eras reach the LLM and hallucinate a blend (the default, and the worst).</li>
<li><strong>ACLs are filters, never prompt instructions.</strong> Permission enforcement must happen in retrieval — 'only cite documents the user can access' in the system prompt is a security incident with extra steps, because the forbidden content is already in the context and prompt injection or simple model error can exfiltrate it.</li>
</ul>

<div class="callout war">Real incident class, seen at multiple enterprises: HR/legal RAG assistant answers from a superseded policy revision, confidently and with citations — to the old document. Every component 'worked': retrieval found highly similar content; generation was faithful to what it was given. The system had no concept of document currency. Version-aware ingest (index only current, or stamp validity metadata and filter) is unglamorous data engineering, and it is the difference between a demo and a system a general counsel will tolerate.</div>

<div class="callout deep">Why answer-shaped queries retrieve better (the mechanism under both HyDE and question-form indexing): retrieval embedders are trained on (query, passage) pairs, but the geometry still concentrates by register and entity density. Short interrogative text and long declarative text sit in measurably different regions; transforming either side to match the other's register shortens the distance the model must bridge. Both techniques are the same trick applied to opposite ends of the pipe — which is also why applying both rarely stacks gains.</div>

<div class="callout exam">Interview probe: 'multi-turn chat retrieval returns garbage after the first question — why?' (unresolved anaphora; fix with history-aware query rewriting). Follow-up: 'user asks for the current parental-leave policy; index contains five revisions — walk me through it' (metadata/versioning, filter-then-rank, never similarity alone). Bonus signal: knowing HyDE by name <em>and</em> being appropriately lukewarm about it in 2026 reads as current practitioner; treating it as state-of-the-art reads as someone who stopped reading in 2023.</div>
`
    },
    {
      id: "generation-grounding",
      title: "Generation-side: grounding, citations, and refusing gracefully",
      html: `
<p>Perfect retrieval can still yield a wrong answer, because the generation stage has its own physics: the model arrives with parametric knowledge that may contradict the retrieved context, a training-bred instinct to be maximally helpful, and no native concept of 'I was only supposed to use those passages'. Generation-side engineering is the discipline of constraining a fluent improviser to behave like a careful analyst quoting sources.</p>

<h3>Grounding: making the context authoritative</h3>
<ul>
<li><strong>Structure the prompt for attribution.</strong> Wrap each chunk in delimited blocks with stable IDs and metadata (source, title, date). Instruct: answer only from the provided sources; when sources conflict, say so and prefer the newer; when sources are insufficient, say what is missing. Concrete instructions with an escape hatch beat 'do not hallucinate', which is as effective as telling a compiler 'do not miscompile'.</li>
<li><strong>Know the two conflict modes.</strong> Context-vs-parametric-memory: the model 'knows' an answer from training that the retrieved (and correct, or newer) context contradicts — models as of early 2026 mostly prefer context, but adherence drops when context is awkwardly phrased or the parametric fact is heavily reinforced. Context-vs-context: two retrieved chunks disagree (version skew, differing sources) and the model silently synthesizes a blend. The second is more dangerous because each half of the blend is individually citable.</li>
<li><strong>Temperature and length discipline.</strong> Grounded QA wants low temperature and no reward for padding. Verbosity is a hallucination surface: the model exhausts the sourced facts in two sentences, then keeps writing.</li>
</ul>

<h3>Citations that mean something</h3>
<p>Citations serve two masters: user trust (a link to check) and <em>your own evaluation</em> (a machine-checkable claim-evidence mapping). The engineering ladder, cheap to rigorous:</p>
<ol>
<li><strong>Chunk-level markers:</strong> the model emits source IDs per claim, post-processor maps IDs to links. Cheap; the model can decorate rather than attribute — a claim can carry a citation that does not support it.</li>
<li><strong>Span-level / quote-first:</strong> require the model to first extract verbatim quotes per source, then compose the answer from the quotes. Quotes are string-verifiable against the chunks — fabricated evidence becomes mechanically detectable. Anthropic's Citations API mode does span-anchored attribution natively; the pattern is model-agnostic.</li>
<li><strong>Post-hoc verification:</strong> a second (cheap) model checks each sentence for entailment by its cited chunk; unsupported sentences get flagged, softened, or dropped. This is the same machinery as faithfulness evals — built once, used both offline and inline.</li>
</ol>

<h3>Refusing gracefully: the empty-retrieval problem</h3>
<p>Retrieval always returns <em>something</em> — top-k is top-k even when the corpus contains nothing relevant, and cosine scores are too uncalibrated to carry a universal 'nothing found' threshold (the embeddings module explains why). So 'no answer available' must be an engineered outcome, not a hoped-for model behavior:</p>
<ul>
<li><strong>Gate on reranker scores, not cosine.</strong> Cross-encoder scores are substantially more discriminative; a tuned per-deployment threshold on the top reranked score is the most reliable cheap signal that retrieval came back empty-handed.</li>
<li><strong>Give the model a sanctioned exit.</strong> An explicit instruction — if the sources do not answer the question, state that plainly and name the closest related information found — converts refusal from a failure the model resists into a task it completes. Models refuse far more reliably when refusal is framed as a correct answer.</li>
<li><strong>Design the refusal UX.</strong> 'I could not find this in the knowledge base — here is what I found adjacent, and here is the search link' preserves trust; a bare 'I don't know' burns it; a confident fabrication torches it. The refusal path deserves the same design attention as the answer path, and its rate belongs on your dashboard: refusal rate too low means hallucinating on gaps; spiking refusal rate is often your earliest index-outage alarm.</li>
</ul>

<h3>Faithfulness vs helpfulness: the real trade-off</h3>
<p>Strict faithfulness (only what the sources entail) and maximal helpfulness (use everything the model knows) are ends of a dial, and the right setting is a <strong>product decision that varies by domain</strong>: a medical or legal assistant should refuse anything unsourced; an internal engineering assistant probably should answer general programming questions from parametric knowledge and reserve strict grounding for company-specific claims. The professional failure is not choosing either end — it is never making the choice explicitly, shipping whatever the default prompt happened to do, and discovering the implicit policy in an incident review. A workable middle: answer from sources; clearly typographically separate any model-knowledge additions ('outside your docs, generally...'); never let unsourced content carry a citation.</p>

<div class="callout war">The dangerous failure is not the missing answer — it is the <strong>plausible blend</strong>: retrieval returns an adjacent-but-wrong passage (pricing for the similarly-named product, policy for the neighboring region), and the model, doing exactly its job, writes a fluent, cited, wrong answer. Users verify citations at a rate close to zero; a citation's mere presence raises trust. This is why span-verification and 'adjacent but not answering' eval cases matter more than the embarrassing-but-obvious total hallucinations that demos worry about.</div>

<div class="callout exam">Interviewers push here with 'retrieval returns nothing relevant — what should the system do?' Weak: 'prompt it not to hallucinate.' Strong: gate on reranker score with a tuned threshold, sanctioned-refusal instruction with a designed UX, refusal-rate monitoring, and a named faithfulness-vs-helpfulness policy per domain. The phrase 'refusal is a feature with its own UX and metrics' is worth a level on the rubric.</div>
`
    },
    {
      id: "rag-evaluation",
      title: "Evaluating RAG: retrieval metrics and end-to-end evals",
      html: `
<p>RAG systems are modified by people who cannot see what they are breaking: a chunk-size tweak shifts thousands of retrievals; a prompt edit changes refusal behavior three intersections downstream. Evaluation is what converts 'it seems better' into an engineering discipline — and the architecture insight is to evaluate in <strong>two layers</strong>, because retrieval and generation fail independently and their fixes are disjoint. An end-to-end score alone tells you something broke; it cannot tell you whether to fix the index or the prompt.</p>

<h3>Layer 1: retrieval metrics</h3>
<p>Build a labeled set — queries mapped to the chunk(s)/document(s) that answer them. 50–200 real queries (mined from logs, labeled by domain folks, plus known-hard cases and should-refuse cases) beat thousands of synthetic ones. Then:</p>
<ul>
<li><strong>recall@k</strong> — fraction of queries where a relevant chunk appears in the top k. The single most important RAG retrieval metric, evaluated at the k you actually pass to the LLM: the generator cannot cite what retrieval never fetched, so recall@k is a hard ceiling on end-to-end quality.</li>
<li><strong>MRR (mean reciprocal rank)</strong> — average of 1/rank of the first relevant result (rank 1 = 1.0, rank 4 = 0.25). Measures whether relevant material sits at the <em>top</em>, which matters because of position bias in generation and because rerankers/context budgets act on order. High recall@20 with low MRR says: retrieval finds it, ranking buries it — fix ranking, not the index.</li>
<li><strong>nDCG@k</strong> — handles graded relevance (perfect vs partial). Worth adopting once labels are graded; most teams sensibly start binary.</li>
</ul>
<p>These are cheap (no LLM calls), deterministic, and belong in CI: every change to chunking, embedding model, filters, or fusion runs the retrieval suite in seconds. This layer is where you catch the 'chunk-size change dropped recall 12 points' regression before users do.</p>

<h3>Layer 2: end-to-end answer evals</h3>
<p>Given (question, retrieved context, answer), score with an LLM judge on separated dimensions — separated, because a single 1–10 'quality' score hides exactly the distinction you need:</p>
<ul>
<li><strong>Faithfulness / groundedness:</strong> decompose the answer into atomic claims; check each for support by the retrieved context (entailment, not string match). Unsupported claims = hallucination <em>relative to context</em> — deliberately ignoring whether the claim is true in the world, which keeps the metric checkable without omniscient labels.</li>
<li><strong>Answer relevance:</strong> does it address what was asked (a faithful answer to a different question is still a failure)?</li>
<li><strong>Context relevance:</strong> how much of the retrieved context was useful — a retrieval-precision proxy computed from the end-to-end artifacts.</li>
<li><strong>Refusal correctness:</strong> on should-refuse cases, did it refuse; on answerable cases, did it answer? Both directions — a system can 'fix' hallucination by refusing everything.</li>
</ul>
<p>This decomposition (popularized by RAGAS and now table stakes in eval tooling — Braintrust, LangSmith, Arize, homegrown) gives you the diagnostic split: low faithfulness with high retrieval recall means a generation problem; low context relevance means a retrieval problem wearing an end-to-end costume.</p>

<div class="callout deep">LLM-as-judge is load-bearing, so know its failure modes: position bias in pairwise comparisons (mitigate: judge both orders), verbosity bias (longer answers score higher — control length or instruct against it), self-preference (a model rates its own family's style higher — use a different-family judge or several), and score compression (most 1–10 judges emit 6–8 — prefer binary/ternary rubrics per dimension, which also agree better with humans). And calibrate the judge itself: label 50 examples by hand, measure judge-human agreement, and re-check when you change judge model or rubric. An uncalibrated judge is a random number generator with gravitas.</div>

<h3>Synthetic data, and operating the loop</h3>
<p>LLM-generated eval questions bootstrap coverage cheaply, with a known bias: models generate questions <em>from</em> a chunk, producing vocabulary-aligned queries that flatter retrieval scores. Real user queries are worse-behaved and more valuable. Mitigations: persona-conditioned generation ('frustrated user, on mobile, vague'), paraphrase passes, and above all continuous harvest of real production queries — especially thumbs-down cases — into the labeled set. Then wire the loop: retrieval suite on every PR in CI; end-to-end suite (LLM-judged, costs real money — sample if needed) nightly and pre-release; online, thumbs plus refusal rate plus judge-scored samples of production traffic on a dashboard. Offline evals catch regressions; online metrics catch the drift your eval set has not learned about yet.</p>

<div class="callout war">Two recurring eval pathologies. First, the stale set: built once from the corpus of eighteen months ago, all green while users complain — because the corpus, query mix, and product moved. Eval sets are living assets; staff their upkeep or watch them rot into false confidence. Second, metric gaming by prompt: a prompt change that instructs more hedging raises judged 'faithfulness' while making answers uselessly noncommittal — which is why refusal correctness and answer relevance must be reported <em>alongside</em> faithfulness, never allowing one dimension to be optimized in isolation.</div>

<div class="callout exam">'How would you evaluate your RAG system?' is asked in nearly every loop, and the rubric is roughly: names recall@k and MRR and knows recall@k ceilings end-to-end quality (junior bar); separates retrieval evals from generation evals and can diagnose from the split (mid); discusses judge bias and calibration, should-refuse cases, synthetic-data bias, CI wiring, and eval-set maintenance as an ongoing cost (senior). The single highest-signal sentence you can say: 'first I would build the labeled retrieval set, because without it every other number is vibes.'</div>
`
    },
    {
      id: "when-not-rag",
      title: "When RAG is the wrong tool: long context, fine-tuning, agentic search",
      html: `
<p>RAG earned its default status when contexts were 4k–32k tokens and the only way to give a model your data was to smuggle in the relevant fraction. As of early 2026, frontier context windows are 200k–1M+ tokens (Claude Sonnet 4.5 at 200k standard with a 1M option, Gemini 2.5 Pro at 1M, GPT-4.1-class at 1M; several open models at 128k–10M claimed), prompt caching cuts the cost of re-sent context by roughly 10x, and models can drive search tools in a loop. RAG is now one option among four, and 'when would you NOT build RAG' is both an interview staple and a real architectural decision.</p>

<h3>Option 1: long-context stuffing</h3>
<p>If the corpus fits, skip retrieval and put it all in the prompt. No pipeline, no chunking bugs, no recall ceiling — the model sees everything, which also helps cross-document synthesis that top-k retrieval structurally misses. The costs, concretely: 500k tokens into a frontier model is on the order of <strong>USD 1–2 per query at list price</strong> (e.g. ~USD 3 per million input tokens); prompt caching drops repeated-corpus queries to roughly a tenth of that, but cache reads still cost, caches expire (minutes-scale TTLs unless refreshed), and time-to-first-token on a cold 500k-token prompt is many seconds. Also, effective recall degrades over very long contexts — needle-in-haystack benchmarks are near-perfect, but realistic multi-fact tasks show measurable middle-of-context weakness. The honest framing: <strong>below ~100–200k tokens of corpus (a few hundred pages), stuffing plus caching frequently beats RAG on quality and total engineering cost</strong>; a surprising fraction of 'we need RAG' projects are actually in this bucket. Above ~1M tokens, stuffing is not on the menu; between, it is a cost/latency/quality negotiation.</p>

<h3>Option 2: fine-tuning</h3>
<p>The durable rule: <strong>fine-tuning is for behavior, not knowledge</strong>. LoRA/SFT reliably teaches format, style, tone, domain register, tool-use patterns, and task shape; it is a poor and unreliable mechanism for injecting facts — knowledge editing via gradient descent is approximate, hard to update (retraining per doc change vs re-indexing in seconds), impossible to cite, and catastrophic-forgetting-prone. Fine-tuning also cannot do per-user access control: the knowledge is baked into weights available to every caller. Where it wins: high-volume narrow tasks where a fine-tuned small model (Llama/Mistral/Qwen class, or a hosted fine-tune) replaces a frontier model at 10–100x lower serving cost, and consistent output shape matters more than fresh facts. Fine-tuning and RAG compose: tune the model to <em>be a better RAG generator</em> (citation discipline, refusal behavior), retrieve the facts.</p>

<h3>Option 3: agentic search</h3>
<p>Give the model search tools (keyword/grep, the vector index itself, a file browser, SQL) and let it iterate: search, read, refine, search again. This dominates single-shot RAG when questions are <strong>multi-hop</strong> ('which customers are affected by the bug fixed in 4.2?'), when the right first query is unknowable, or when the corpus is navigable structure (codebases — where agentic grep-and-read has largely displaced embedding RAG as of 2025–26, because code questions are about precise symbols and structure, not fuzzy similarity). The price: 3–10x tokens and multiples of latency per question, plus agent-loop failure modes (giving up early, rabbit-holing). Note the quiet convergence: production 'RAG' increasingly means an agent whose best tool is a hybrid retrieval endpoint — retrieval became a tool call rather than a pipeline stage.</p>

<h3>The decision framework</h3>
<table>
<thead><tr><th>Signal</th><th>Reach for</th><th>Why</th></tr></thead>
<tbody>
<tr><td>Corpus under ~200k tokens, stable</td><td>Long context + prompt caching</td><td>Zero pipeline; whole-corpus reasoning; caching tames cost</td></tr>
<tr><td>Large/fresh/permissioned corpus, cited answers, interactive latency</td><td>RAG (hybrid + rerank)</td><td>Scales past context; per-query ACL filtering; second-scale updates; citations</td></tr>
<tr><td>Style, format, tool-use, task shape; cost-crush a narrow task</td><td>Fine-tuning (often small model)</td><td>Behavior lives in weights; 10–100x serving savings at volume</td></tr>
<tr><td>Multi-hop questions, exploratory research, codebases</td><td>Agentic search (retrieval as a tool)</td><td>Iterative refinement beats any single-shot top-k</td></tr>
</tbody>
</table>
<p>Most production systems are hybrids along these seams: cached long-context for the product manual plus RAG for the ticket archive; a fine-tuned generator inside a RAG loop; an agent holding a retrieval tool. The architecture question is not 'which paradigm' but 'which mechanism serves each corpus and query class'.</p>

<div class="callout limits">Numbers for the whiteboard, early 2026 (all will drift — re-check before quoting): frontier input prices roughly USD 0.1–3 per 1M tokens (Gemini Flash / GPT-mini / Haiku class at the low end, Sonnet/GPT/Pro class mid, premium long-context tiers above); prompt-cache reads ~10x cheaper than fresh input; 200k–1M token frontier windows; embedding ~USD 0.02–0.13 per 1M tokens. Worked comparison at 100k-token corpus, 10k queries/month: stuffing uncached ~USD 3,000/mo, with caching ~USD 300–400/mo, RAG with 5k-token contexts ~USD 150/mo plus pipeline engineering. The pipeline you do not build is worth real money — and so is the one you do not need.</div>

<div class="callout war">Failure mode on both edges. Team A built a full RAG stack — vector DB, sync pipelines, eval harness — over a 40-page manual that fit in 30k tokens; two engineer-months to under-perform a cached system prompt. Team B stuffed 800k tokens into a 1M window because 'context is huge now': USD 1+ per question, 20-second first tokens, and middling multi-fact accuracy that a hybrid-retrieval system beat easily. Same root cause: paradigm chosen by fashion, not by counting tokens, queries, and dollars. The fix is embarrassingly simple — do the arithmetic first.</div>

<div class="callout exam">'Why not just put everything in the context window?' is now a standard curveball, testing whether your RAG advocacy is reasoned or reflexive. The strong answer concedes the small-corpus case explicitly ('under a couple hundred k tokens, stuffing with caching probably wins'), then names what retrieval still uniquely buys: unbounded corpus size, per-user ACL filtering at query time, freshness in seconds, citations, and per-query cost control. Bonus signal: mentioning that codebase assistants moved to agentic grep-and-read, and why fuzzy similarity fits prose better than code — it shows you track where practice actually went, not just where 2023 blog posts left off.</div>
`
    }
  ],
  quiz: [
    {
      q: "A RAG system's answer quality degrades slowly over three months. Offline eval metrics, built from documents indexed a year ago, remain green. User thumbs-down rates climb steadily. Which explanation best fits this pattern?",
      options: [
        "The LLM provider silently degraded the generation model",
        "An upstream change broke ingest for newly added documents, and the stale eval set only exercises old documents, so the regression is invisible offline",
        "Users have become more demanding over time",
        "The vector index has exceeded its maximum capacity"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: ingest regression plus stale eval set.</strong> The signature is the give-away: offline green while online degrades slowly means the eval set no longer represents production traffic. New documents (broken by a parser/CMS change) are exactly what old eval queries never touch, and their share of user queries grows over time — producing the gradual decay. This is the canonical argument for evaluating on fresh documents and continuously harvesting real queries.</p><p><strong>Why the others are wrong:</strong> a provider model change would degrade answers on the <em>eval set too</em> if it were run against the live model — and would look like a step change, not a three-month slope. 'Users more demanding' does not track a steady weekly climb and is unfalsifiable hand-waving. Vector indexes do not have a hard capacity that silently degrades quality; growth affects recall gradually but would also show in offline retrieval metrics if the eval set were current.</p>"
    },
    {
      q: "In a multi-turn chat RAG assistant, first-turn answers are good but follow-up questions like 'what about for enterprise plans?' retrieve irrelevant chunks. What is the root cause and standard fix?",
      options: [
        "The embedding model is too small for follow-up questions; upgrade to a larger model",
        "The raw follow-up is embedded without conversational context, so referents are unresolved; fix with an LLM query-rewriting step that produces a standalone query from the history",
        "The vector index needs re-embedding after each conversation turn",
        "Follow-up questions require a larger top-k than first questions"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: unresolved anaphora.</strong> 'What about for enterprise plans?' contains none of the subject matter of the conversation — embedded as-is, it is a near-meaningless vector. The standard fix is history-aware query rewriting: a cheap LLM call converts the fragment into a standalone query ('Does Acme support SSO on enterprise plans?') before embedding. It is arguably the most consequential small component in chat RAG.</p><p><strong>Why the others are wrong:</strong> no embedding model of any size can encode context that is not in its input — the information is missing, not compressed poorly. Re-embedding the <em>index</em> per turn confuses the two sides of retrieval; the index is fine. Larger top-k retrieves more of the same wrong neighborhood — recall of irrelevant material scales badly.</p>"
    },
    {
      q: "Your team wants to try HyDE to improve retrieval. Which statement best reflects an accurate, current (early 2026) assessment of the technique?",
      options: [
        "HyDE is state-of-the-art and should be the first optimization applied to any RAG system",
        "HyDE embeds a hallucinated answer to bridge the question-passage register gap; modern retrieval-tuned embedders have absorbed much of its benefit, and it adds an LLM call of latency plus a wrong-neighborhood risk, so benchmark it after cheaper wins like multi-query and reranking",
        "HyDE eliminates hallucination in the generation stage",
        "HyDE requires fine-tuning the embedding model on hypothetical documents"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the lukewarm-but-precise assessment.</strong> HyDE generates a plausible fake answer and retrieves with its embedding, exploiting answer-to-passage similarity. It shone with weaker, non-retrieval-tuned embedders and zero-shot domains; models trained on question-passage pairs closed much of the gap. Its costs are a full LLM call on the query path and retrieval dragged toward plausible-but-wrong neighborhoods when the hypothesis is bad. Competent teams benchmark it; few keep it ahead of multi-query expansion and rerankers.</p><p><strong>Why the others are wrong:</strong> 'first optimization' inverts the cost/benefit ordering — index-time and reranking fixes come first. HyDE is purely a <em>retrieval</em> technique; it does nothing about generation hallucination (its own hallucination is a controlled intermediate, not an output). No fine-tuning is involved — that confusion mixes it up with adapter-based query encoders.</p>"
    },
    {
      q: "An HR assistant retrieves from a corpus containing all revisions of every policy document. It answers a parental-leave question from a superseded 2019 revision, with a correct citation to that old document. Which fixes address the actual failure? (Select 2)",
      options: [
        "Add version/currency metadata at ingest and filter retrieval to current revisions",
        "Instruct the LLM to prefer newer documents when sources conflict",
        "Increase the reranker candidate pool from 50 to 200",
        "Only index current revisions, treating superseded documents as deleted",
        "Switch from cosine similarity to dot product"
      ],
      answer: [0, 3],
      multi: true,
      explanation: "<p><strong>Correct: currency metadata with filtering, or index only current versions.</strong> The failure is that the system has no concept of document currency — a 2019 policy and its 2025 replacement are near-identical vectors, and similarity alone cannot distinguish them. Hard constraints belong in structured filters applied before ranking (or better, at ingest: superseded content simply should not be retrievable for current-policy questions).</p><p><strong>Why the others are wrong:</strong> the prompt instruction only helps when both revisions happen to be retrieved <em>together</em> — when only the old one surfaces (the described case), the model has nothing to prefer; it is a mitigation, not a fix, and relies on the model noticing dates. A bigger reranker pool reorders candidates but rerankers score topical relevance, not organizational currency — the 2019 doc is genuinely relevant text. Cosine vs dot product on normalized vectors is ranking-equivalent and wholly unrelated.</p>"
    },
    {
      q: "You must prevent a RAG assistant from ever revealing documents a user lacks permission to read. Where must this control live, and why?",
      options: [
        "In the system prompt: instruct the model to only cite documents the user may access",
        "In retrieval: apply the user's ACLs as a hard filter so forbidden chunks never enter the context; prompt instructions are not a security boundary since in-context content can be extracted via injection or model error",
        "In post-processing: scan generated answers and redact forbidden content",
        "In the embedding model: embed permissions into the vectors"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: ACLs as retrieval-time filters.</strong> Security properties must hold at a boundary the attacker cannot cross. If forbidden content enters the prompt, it is available to the generation process — prompt injection, summarization drift, or simple instruction-following failure can surface it. Filtering at retrieval means the content never exists in the request; the model cannot leak what it never saw. (Corollary: if vectors live in an external store, ACL sync to that store is production-critical security code.)</p><p><strong>Why the others are wrong:</strong> prompt instructions are advisory to a stochastic process — 'a security incident with extra steps'. Post-hoc redaction requires reliably detecting arbitrary paraphrases of forbidden content — a harder problem than the original, and the content already crossed the trust boundary. 'Embedding permissions into vectors' is not a mechanism — geometry cannot enforce predicates; permissions are metadata for the filter engine.</p>"
    },
    {
      q: "A RAG system produces fluent answers with citations, but spot checks find claims whose cited chunks do not actually support them. Which intervention makes fabricated evidence mechanically detectable rather than relying on model honesty?",
      options: [
        "Raise the generation temperature so the model explores more phrasings",
        "Require the model to first extract verbatim quotes from each source and compose the answer from them, string-verifying quotes against the chunks; optionally add a post-hoc entailment check per cited sentence",
        "Add a stronger instruction that citations must be accurate",
        "Increase top-k so the model has more sources to choose from"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: quote-first generation with verification.</strong> Verbatim quotes are checkable by string matching against retrieved chunks — a fabricated quote fails the check deterministically, no model judgment required. Layering a post-hoc entailment check (cheap model verifying each claim against its cited chunk) catches the subtler case of real quotes assembled into unsupported conclusions. This turns citation integrity from a hoped-for behavior into a verifiable property, and the same machinery powers faithfulness evals offline.</p><p><strong>Why the others are wrong:</strong> higher temperature increases variance — strictly counterproductive for grounding. Stronger instructions are the same non-mechanism that already failed: the model can decorate claims with citations regardless of what prompts say. More sources gives the model more to draw on but does nothing to verify the mapping between claims and evidence — if anything, a fatter context makes decorative citation easier.</p>"
    },
    {
      q: "Retrieval for a query returns nothing relevant (the corpus genuinely lacks the answer), but the system must not hallucinate. Cosine similarity thresholds have proven unreliable for detecting this. Which combination is the standard engineering approach? (Select 2)",
      options: [
        "Gate on the cross-encoder reranker's top score with a per-deployment tuned threshold, since reranker scores are far more discriminative than cosine",
        "Instruct the model that stating the sources do not answer the question is a correct and expected response, and design a refusal UX that offers adjacent findings",
        "Lower top-k to 1 so only the best match is used",
        "Use a universal cosine threshold of 0.7 across all deployments",
        "Retry retrieval with higher ef_search until something relevant appears"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>Correct: reranker-score gating plus sanctioned refusal.</strong> Cross-encoder scores, trained on relevance judgments, separate 'answers the question' from 'topically nearby' far better than uncalibrated cosine bands; a threshold tuned per deployment on labeled data is the reliable cheap signal. On the generation side, models refuse far more consistently when refusal is framed as a completable task with an escape hatch — and the refusal path needs UX and monitoring (refusal rate is an early index-outage alarm).</p><p><strong>Why the others are wrong:</strong> top-k=1 does not detect emptiness — the single best match of an irrelevant set is still irrelevant, now with zero corroborating context. A universal 0.7 cosine threshold is exactly what the question stipulates fails: score distributions shift per model and corpus. Raising ef_search improves ANN <em>recall of what exists</em> — it cannot conjure relevant documents into a corpus that lacks them; the loop never terminates well.</p>"
    },
    {
      q: "Your labeled retrieval eval shows recall@20 is 0.94 but MRR is 0.31. The generator receives the top 8 chunks. What does this metric split tell you to fix?",
      options: [
        "The index is missing documents; re-ingest the corpus",
        "Relevant chunks are being found but ranked deep in the list, so they often fall outside the top 8 passed to the LLM; fix ranking (reranker, fusion weights), not indexing",
        "The eval set is too small to be meaningful",
        "The generator's prompt needs stronger grounding instructions"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: a ranking problem, precisely diagnosed.</strong> High recall@20 says the relevant chunk is almost always <em>somewhere</em> in the top 20 — indexing and matching work. MRR of 0.31 means the first relevant result sits around rank 3–4 on average, with a long tail deeper; since only the top 8 reach the generator, deep-ranked hits are silently dropped. The fix lives in the ranking stage: add or improve a cross-encoder reranker, tune fusion, then re-measure MRR and recall@8. This diagnostic split is exactly why both metrics are tracked.</p><p><strong>Why the others are wrong:</strong> missing documents would depress recall@20 — the metric that is healthy. Eval set size affects confidence intervals, not the qualitative story of a 0.94/0.31 split. Prompt changes cannot help with chunks that never enter the prompt — the failure is upstream of generation entirely.</p>"
    },
    {
      q: "You use an LLM judge to score RAG answer faithfulness on a 1-to-10 scale, and notice nearly all scores fall between 6 and 8, with longer answers scoring consistently higher. Which judge-design changes address these known biases? (Select 2)",
      options: [
        "Replace the 1-to-10 scale with binary or ternary per-dimension rubrics, which decompress scores and agree better with human labels",
        "Control for verbosity: instruct the judge to ignore length, or decompose answers into atomic claims and score support per claim",
        "Use the same model family for judge and generator to ensure consistency",
        "Average the 1-to-10 scores over more samples",
        "Raise the judge's temperature for more score diversity"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>Correct: rubric redesign and verbosity control.</strong> Score compression (everything lands 6–8) is a documented LLM-judge pathology; binary/ternary judgments per dimension are more discriminative and track human agreement better. Length bias is equally well documented; claim-level decomposition (score each atomic claim for support) removes the length confound structurally, and doubles as the faithfulness metric itself.</p><p><strong>Why the others are wrong:</strong> same-family judge and generator triggers self-preference bias — the judge rates its own family's style higher; you want a different family or a panel. Averaging more samples narrows the confidence interval around a <em>biased</em> mean — precision about the wrong number. Higher temperature adds noise, not signal; score diversity from randomness is not discrimination.</p>"
    },
    {
      q: "A team generates its entire RAG eval set by asking an LLM to write questions from randomly sampled chunks. Retrieval metrics look excellent, but production users report poor search. What is the most likely explanation?",
      options: [
        "The LLM generated questions in a different language than users write",
        "Synthetic questions inherit the chunk's vocabulary, making them artificially easy for retrieval; real user queries are vaguer, use different terms, and include cases the corpus cannot answer",
        "The eval set is too large, causing overfitting",
        "Retrieval metrics cannot be computed on synthetic questions"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the vocabulary-alignment bias of synthetic evals.</strong> A question generated <em>from</em> a chunk shares that chunk's exact terms and register — retrieval by lexical or dense similarity then looks stellar because the eval bakes in the match. Real users write vague, differently-worded, sometimes unanswerable queries — precisely the hard cases the synthetic set never samples. Mitigations: persona-conditioned generation, paraphrase passes, adding should-refuse cases, and above all harvesting real production queries (especially thumbs-down ones) into the labeled set.</p><p><strong>Why the others are wrong:</strong> language mismatch would be obvious on inspection and produce near-zero synthetic-vs-production overlap in behavior, not 'excellent offline, poor online'. 'Too large causes overfitting' misapplies a training concept — an eval set is not trained on; size improves confidence. Retrieval metrics compute identically on any labeled (query, relevant-chunk) pairs — synthetic origin does not break the arithmetic, it biases the difficulty.</p>"
    },
    {
      q: "A product team wants a Q-and-A assistant over a stable 60-page product manual (about 45k tokens), expecting a few hundred queries per day. An engineer proposes the full RAG stack: vector DB, chunking pipeline, hybrid retrieval, reranker. What is the strongest alternative recommendation?",
      options: [
        "Fine-tune a small model on the manual so no retrieval is needed",
        "Put the entire manual in the prompt with prompt caching: at 45k tokens it fits comfortably in a 200k window, caching makes repeated-context queries roughly 10x cheaper, the model sees the whole document, and there is no pipeline to build or break",
        "Use agentic search over the manual with a grep tool",
        "Reject the project: 45k tokens is too large for current models"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: long-context stuffing with caching.</strong> This is squarely the small-stable-corpus case: 45k tokens fits in every frontier window with room for conversation; caching amortizes the corpus cost to roughly a tenth on repeat queries; whole-document visibility helps cross-section questions that top-k retrieval structurally misses; and the engineering cost is near zero — no chunking bugs, no index staleness, no recall ceiling. At a few hundred queries/day the token spend is modest even uncached.</p><p><strong>Why the others are wrong:</strong> fine-tuning injects knowledge unreliably, cannot cite, and turns every manual revision into a training run — the classic behavior-vs-knowledge misuse. Agentic grep over 60 pages adds latency and loop complexity to a problem the model can solve by reading everything at once; agentic search earns its cost on large or navigable-structure corpora. 'Too large' is off by an order of magnitude versus 200k–1M windows — and betrays not knowing the numbers.</p>"
    },
    {
      q: "Which scenarios genuinely favor fine-tuning over RAG or long context? (Select 2)",
      options: [
        "A high-volume classification/extraction task where a tuned 8B open model must replace a frontier model at a fraction of the serving cost, with strict output format requirements",
        "Keeping an assistant's answers current with policy documents that change weekly",
        "Teaching a RAG generator consistent citation discipline and refusal behavior across millions of queries",
        "Giving different users access to different subsets of company knowledge",
        "Answering questions that require citing specific source documents"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<p><strong>Correct: cost-crushing a narrow high-volume task, and shaping generator behavior.</strong> Both are <em>behavior</em>, the thing gradient descent reliably teaches: output format, task shape, register, citation and refusal habits. A tuned small model at 10–100x lower serving cost than a frontier model is the canonical fine-tuning economic win; tuning the generator to be a better RAG citizen composes with retrieval rather than competing with it.</p><p><strong>Why the others are wrong:</strong> weekly-changing knowledge is fine-tuning's worst case — retraining per change versus re-indexing in seconds; knowledge in weights also cannot be cited. Per-user knowledge access is structurally impossible in weights — a model's parameters are available to every caller; access control requires retrieval-time ACL filtering. Citation requires an explicit source in context — parametric knowledge has no addressable provenance to cite.</p>"
    },
    {
      q: "For a coding assistant answering questions about a large private codebase, embedding-based RAG has been underperforming. Why has the industry largely shifted to agentic search (grep, file navigation, iterative reading) for this workload?",
      options: [
        "Codebases are too large to embed within API rate limits",
        "Code questions hinge on exact symbols, references, and structure that fuzzy semantic similarity handles poorly, while multi-hop navigation (find definition, then callers, then config) requires iterative search that single-shot top-k cannot express",
        "Embedding models cannot process programming languages at all",
        "Agentic search is cheaper per query than vector retrieval"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the workload mismatch.</strong> 'Where is parse_config called?' is an exact-symbol, structural question — grep answers it perfectly and embeddings answer it approximately at best (identifiers tokenize into fragments; similar-looking code is not relevantly related). And real code questions are multi-hop by nature: read the definition, chase callers, check the config — an iterative loop that a single retrieval round structurally cannot perform. Hence agentic grep-and-read became the dominant pattern for code assistants by 2025–26, with embeddings at most one tool among several.</p><p><strong>Why the others are wrong:</strong> rate limits are an operational nuisance, not the driver — codebases embed fine in batch. Embedding models process code (many are trained on it); they are just mediocre at exact-reference questions. Agentic search is typically <em>more</em> expensive per query (3–10x tokens across loop iterations) — it wins on capability, not cost.</p>"
    }
  ],
  flashcards: [
    { front: "Name the major RAG pipeline stages from document to answer.", back: "<p>Parse → chunk → enrich/embed → index; then query rewrite → retrieve (hybrid) → rerank/select → assemble context → generate → cite/post-process. Each seam has a silent failure mode; instrument the seams.</p>" },
    { front: "Which RAG pipeline stage causes the most failures while getting the least attention?", back: "<p>Parsing/extraction: scrambled PDF tables and columns, dropped headings, boilerplate pollution, empty OCR output. First debugging step for any RAG problem: read 20 random chunks.</p>" },
    { front: "Why is more retrieved context not monotonically better for generation?", back: "<p>Position bias ('lost in the middle'): models attend best to context start/end. Marginal chunks land mid-context, dilute signal-to-noise, and add cost. Most systems peak around 5–20 well-chosen chunks.</p>" },
    { front: "What is the most consequential small component in multi-turn chat RAG?", back: "<p>History-aware query rewriting: an LLM call converting conversational fragments ('what about the second one?') into standalone queries before embedding. Without it, retrieval runs on unresolved pronouns.</p>" },
    { front: "HyDE: mechanism and honest 2026 status?", back: "<p>Embed an LLM-hallucinated hypothetical answer and retrieve with it (answer-to-passage similarity beats question-to-passage). Largely absorbed by modern retrieval-tuned embedders; adds query-path latency and wrong-neighborhood risk. Benchmark after multi-query and reranking.</p>" },
    { front: "State the rule for hard constraints (version, tenant, date, permissions) in retrieval.", back: "<p>Filter beats rank: hard constraints go in metadata filters applied before similarity ranking. Similarity is date-blind and version-blind — a 2019 policy and its 2025 replacement are near-identical vectors.</p>" },
    { front: "Where must document-level access control live in a RAG system, and why not in the prompt?", back: "<p>As ACL filters at retrieval time, so forbidden content never enters the context. Prompt instructions are not a security boundary: injected or in-context content can always be extracted. If vectors live in an external store, ACL sync is security-critical code.</p>" },
    { front: "What are the two context-conflict modes in grounded generation?", back: "<p>(1) Context vs parametric memory — model 'knows' something contradicting retrieved text. (2) Context vs context — retrieved chunks disagree (version skew) and the model silently blends them. The blend is worse: each half is individually citable.</p>" },
    { front: "How do you make citations mechanically verifiable instead of decorative?", back: "<p>Quote-first generation: extract verbatim quotes per source (string-checkable against chunks), compose from quotes; optionally post-hoc entailment-check each cited claim with a cheap model. Same machinery powers offline faithfulness evals.</p>" },
    { front: "How should a RAG system detect that retrieval found nothing relevant?", back: "<p>Not with cosine thresholds (uncalibrated). Gate on the cross-encoder reranker top score with a per-deployment tuned threshold; give the model a sanctioned refusal framing; monitor refusal rate (it doubles as an index-outage alarm).</p>" },
    { front: "Define recall@k and MRR, and what a high-recall/low-MRR split means.", back: "<p>recall@k: fraction of queries with a relevant chunk in top k — the ceiling on end-to-end quality. MRR: mean of 1/rank of first relevant result. High recall@20 + low MRR = found but buried: fix ranking (reranker/fusion), not indexing.</p>" },
    { front: "What are the four standard end-to-end RAG eval dimensions?", back: "<p>Faithfulness (claims supported by context), answer relevance (addresses the question), context relevance (retrieved material was useful), refusal correctness (refuses on should-refuse, answers on answerable). Report together — each is gameable alone.</p>" },
    { front: "Name four documented LLM-as-judge biases and one mitigation each.", back: "<p>Position bias (judge both orders); verbosity bias (claim-level scoring or length instructions); self-preference (different-family judge or panel); score compression on 1–10 scales (binary/ternary rubrics). Calibrate against ~50 human labels.</p>" },
    { front: "What is the known bias of synthetic (LLM-generated) eval questions?", back: "<p>Generated from chunks, they inherit the chunk's vocabulary — artificially easy retrieval, inflated metrics. Real user queries are vaguer and include unanswerable cases. Mitigate: personas, paraphrase passes, should-refuse cases, harvest real production queries.</p>" },
    { front: "How do retrieval evals and end-to-end evals divide the diagnostic work?", back: "<p>Retrieval metrics (cheap, deterministic, CI on every PR) localize index/chunking/ranking regressions. End-to-end LLM-judged evals (costly, nightly/pre-release) catch generation and assembly issues. Low faithfulness + healthy recall = generation problem.</p>" },
    { front: "When does long-context stuffing beat RAG, and what makes it affordable?", back: "<p>Stable corpus under roughly 100–200k tokens: whole-corpus visibility, zero pipeline, no recall ceiling. Prompt caching makes repeat-context queries ~10x cheaper (early 2026). Above ~1M tokens it is off the menu; between is a cost/latency negotiation.</p>" },
    { front: "State the fine-tuning rule for RAG-adjacent decisions.", back: "<p>Fine-tuning is for behavior (format, style, tool use, citation/refusal discipline, cost-crushing narrow tasks on small models), not knowledge (unreliable injection, no citations, retrain-per-update, no per-user access control). It composes with RAG: tune the generator, retrieve the facts.</p>" },
    { front: "Why did codebase assistants move from embedding RAG to agentic search?", back: "<p>Code questions hinge on exact symbols and structure (grep territory, where fuzzy similarity is weak) and are multi-hop (definition → callers → config), requiring iterative search that single-shot top-k cannot express. Cost is higher (3–10x tokens); capability wins.</p>" },
    { front: "What does RAG still uniquely provide versus long context, fine-tuning, and agentic search?", back: "<p>Unbounded corpus size, per-user ACL filtering at query time, freshness in seconds (re-index vs retrain), addressable citations, and per-query cost control. Modern systems hybridize: retrieval increasingly serves as a tool inside an agent loop.</p>" }
  ],
  lab: {
    title: "Lab: build a retrieval eval harness and catch a chunking regression",
    html: `
<p><strong>Goal:</strong> build the eval asset every RAG team needs first — a labeled retrieval set with recall@k and MRR — then use it to measure, not guess, the effect of a chunking change. Fully local and free; the only download is a ~90 MB embedding model.</p>

<h3>Architecture</h3>
<p>A corpus of a few dozen markdown documents, chunked two ways (fixed 150-word windows vs paragraph-aware). A hand-labeled set of ~15 queries mapped to the source document that answers each. One script embeds both chunkings with all-MiniLM-L6-v2, runs every query against each index via brute-force dot product (exact, no ANN variables), and prints recall@5 and MRR side by side.</p>

<h3>Steps</h3>
<ol>
<li><strong>Environment.</strong>
<pre><code>mkdir -p ~/rag-eval-lab/docs &amp;&amp; cd ~/rag-eval-lab
python3 -m venv .venv &amp;&amp; . .venv/bin/activate
pip install sentence-transformers numpy</code></pre></li>
<li><strong>Corpus.</strong> Drop 20–40 real markdown/text files into <code>docs/</code> — a project's documentation, a wiki export, or man pages converted to text (<code>man -k . | head -40</code> for inspiration). Real documents matter: synthetic corpora hide parsing and boundary problems.</li>
<li><strong>Label a golden set.</strong> Create <code>golden.tsv</code>: one query per line, a tab, then the filename that answers it. Write the queries the way a user would (vague, paraphrased — do not copy sentences from the docs; that is the synthetic-eval bias from the lesson). Include 2–3 queries whose answer is genuinely absent and mark them <code>NONE</code> — you will watch what retrieval does with them.</li>
<li><strong>The harness.</strong> Save as <code>evalrag.py</code>:
<pre><code>import glob, re, numpy as np
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("all-MiniLM-L6-v2")

def fixed_chunks(text, n=150):
    w = text.split()
    return [" ".join(w[i:i+n]) for i in range(0, len(w), n)]

def para_chunks(text, target=150):
    paras, cur, out = re.split(r"\n\s*\n", text), [], []
    for p in paras:
        cur.append(p)
        if sum(len(c.split()) for c in cur) &gt;= target:
            out.append("\n\n".join(cur)); cur = []
    if cur: out.append("\n\n".join(cur))
    return out

def build(chunker):
    chunks, owners = [], []
    for f in sorted(glob.glob("docs/*")):
        for c in chunker(open(f, errors="ignore").read()):
            if c.strip(): chunks.append(c); owners.append(f.split("/")[-1])
    emb = model.encode(chunks, normalize_embeddings=True)
    return np.array(emb, dtype="float32"), owners

golden = [l.rstrip("\n").split("\t") for l in open("golden.tsv") if "\t" in l]
for name, chunker in (("fixed-150w", fixed_chunks), ("paragraph", para_chunks)):
    emb, owners = build(chunker)
    hits, rr = 0, 0.0
    for q, want in golden:
        if want == "NONE": continue
        qv = model.encode([q], normalize_embeddings=True)[0]
        top = np.argsort(-(emb @ qv))[:5]
        docs = [owners[i] for i in top]
        if want in docs:
            hits += 1; rr += 1.0 / (docs.index(want) + 1)
    n = sum(1 for _, w in golden if w != "NONE")
    print("%-12s chunks=%-5d recall@5=%.2f  MRR=%.2f"
          % (name, len(owners), hits / n, rr / n))</code></pre></li>
<li><strong>Run and read.</strong> <code>python3 evalrag.py</code> — paragraph-aware chunking usually wins on both metrics; on your corpus, verify rather than assume. For each miss, print the top-5 chunks and read them — classify the failure (boundary split? vocabulary mismatch? wrong-but-plausible neighbor?). For the NONE queries, look at what came back top-1 and note that nothing in the scores announces 'no answer exists' — the empty-retrieval lesson, observed firsthand.</li>
<li><strong>Extend (optional).</strong> Prepend each file's first heading to every chunk and re-run — a one-line contextual-enrichment approximation that typically moves MRR visibly. Or simulate a regression: change fixed chunking to 400 words, watch the metrics catch it, and imagine this wired as a CI gate.</li>
</ol>

<h3>Teardown</h3>
<p>All artifacts are local; teardown is removing the lab directory and cached model:</p>
<pre><code>deactivate
rm -rf ~/rag-eval-lab
rm -rf ~/.cache/huggingface/hub/models--sentence-transformers--all-MiniLM-L6-v2</code></pre>
<p>No cloud resources were created; nothing continues to bill.</p>
`
  }
});
