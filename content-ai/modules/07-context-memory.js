/* Module 07 — Context Engineering & Memory (Applied track) */
window.COURSE.register({
  id: "context-memory",
  order: 7,
  track: "applied",
  title: "Context Engineering & Memory",
  description: "The context window as a scarce, priced, and lossy resource: what advertised context sizes actually buy you, how to budget tokens across system prompt, history, retrieval, and output, how conversation and long-term memory really work, and why debugging an LLM system almost always means reading the final assembled prompt.",
  examWeight: "Interview loops for AI engineering roles probe this constantly: expect system-design questions about token budgets and memory architecture for a long-running assistant, and debugging exercises where the fix is inspecting the assembled prompt rather than changing the model. Candidates who talk about effective versus nominal context, compaction strategies, and prompt-cache-aware ordering stand out immediately.",
  lessons: [
    {
      id: "context-windows",
      title: "Context windows: what the advertised number really buys you",
      html: `
<p>Every model ships with a headline context number — 128K, 200K, 1M, even 10M tokens. A senior engineer should treat that number the way you treat a network link's line rate: it is the size of the pipe, not the throughput you will actually get, and definitely not a claim that all positions in the pipe are equal. The single most important mental model in this module: <strong>the context window is a lossy, position-sensitive, priced input buffer — not RAM</strong>.</p>

<h3>The landscape, as of early 2026</h3>
<table>
<thead><tr><th>Model family</th><th>Advertised context</th><th>Typical max output</th></tr></thead>
<tbody>
<tr><td>OpenAI GPT-4.1 / GPT-5-class</td><td>~1M input</td><td>32K–128K</td></tr>
<tr><td>OpenAI o-series reasoning models</td><td>~200K</td><td>100K (includes reasoning tokens)</td></tr>
<tr><td>Anthropic Claude (Sonnet/Opus 4.x)</td><td>200K standard, 1M in beta tiers</td><td>32K–64K</td></tr>
<tr><td>Google Gemini 2.5 Pro / Flash</td><td>1M (2M announced on some 1.5-era models)</td><td>~64K</td></tr>
<tr><td>Llama 3.x / 4 (open weights)</td><td>128K; Llama 4 Scout advertises 10M</td><td>varies by host</td></tr>
<tr><td>Mistral Large / Qwen 2.5–3 series</td><td>128K; Qwen has 1M variants</td><td>varies by host</td></tr>
</tbody>
</table>
<p>Two things to internalize about this table. First, it churns every quarter — memorize the shape, not the cells. Second, <strong>input and output windows are different resources</strong>: a model that reads 1M tokens may still only emit 32K, and on reasoning models the hidden chain-of-thought bills and budgets as output. A rough token-to-text conversion that survives model churn: one token is about 3–4 characters of English, so 128K tokens is roughly a 300-page book, and 1M tokens is roughly a small codebase — before you get excited, keep reading.</p>

<h3>Lost in the middle</h3>
<p>The canonical result (Liu et al., 2023, "Lost in the Middle") showed that when the answer to a question sits in the middle of a long context, accuracy craters — performance as a function of answer position traces a <strong>U-shape</strong>: strong at the beginning (primacy), strong at the end (recency), weakest in the middle. Later models flattened the U considerably, but the effect has never fully disappeared, and it compounds: retrieval systems that stuff 40 chunks into a prompt are betting the model reads chunk 23 as carefully as chunk 1. It does not. Practical corollaries you will use weekly:</p>
<ul>
<li>Put instructions and the most load-bearing material at the <strong>start and end</strong> of the prompt; the middle is where supporting detail goes to be skimmed.</li>
<li>Repeat critical constraints near the end when the prompt is long — redundancy is cheap, silent constraint loss is not.</li>
<li>When re-ranking retrieved documents, position is part of the ranking: best documents belong at the edges, not just "sorted by score, top to bottom."</li>
</ul>

<div class="callout deep">Why the middle sags: attention is trained on data where nearby tokens matter most, and positional-encoding schemes (RoPE and its extensions like YaRN and position-interpolation scaling) are extrapolated or interpolated to reach long contexts the model saw comparatively little of in training. Long-context ability is largely a fine-tuning artifact layered on a mid-length-trained base, so the far interior of a huge window is the least-trained regime. Meanwhile the KV cache grows linearly with context and attention compute superlinearly — vendors have real incentives to approximate (sliding-window layers, sparse attention), and approximations hit middle-distance recall first.</div>

<h3>Effective vs nominal context</h3>
<p>The number on the pricing page is <strong>nominal</strong> context. What you care about is <strong>effective</strong> context: the length at which the model still performs your task at acceptable quality. Vendors demonstrate long context with needle-in-a-haystack (NIAH) tests — hide a sentence in a huge document, ask for it back — and modern frontier models ace NIAH at full window length. But NIAH is exact-match retrieval, the easiest possible long-context task. Harder benchmarks tell a different story: <strong>RULER</strong> (multi-needle, aggregation, variable tracking) and <strong>NoLiMa</strong> (retrieval without literal keyword overlap, forcing semantic hops) show most models degrading well before nominal length — it is common to see a model with 128K nominal context hold quality to only 32–64K on RULER-style tasks, and NoLiMa shows sharp drops as early as 8–16K for associative reasoning. A defensible engineering default as of early 2026: <strong>assume effective context for reasoning-heavy work is a quarter to a half of nominal</strong>, and measure on your own task before assuming more.</p>

<div class="callout limits">Numbers worth carrying: frontier nominal contexts are 200K–1M as of early 2026; long-context often costs extra (Google and Anthropic both price tokens beyond 200K at roughly 2x); typical output caps are 32K–64K; mid-tier input pricing is order-of-magnitude 1–3 dollars per million tokens, frontier output 10–15 dollars per million. A 500K-token prompt at frontier prices costs on the order of a dollar per call, and you pay it on every turn unless caching applies — long context is a recurring cost, not a one-time load.</div>

<h3>Latency and the quadratic tax</h3>
<p>Long prompts are slow twice. Time-to-first-token grows with prompt length because prefill must attend over everything (roughly linearly in practice on modern serving stacks, worse at the extremes), and per-turn cost grows because chat is stateless: <strong>the entire conversation is re-sent and re-processed every turn</strong> unless prompt caching short-circuits the prefill. A 400K-token context can add tens of seconds of prefill on some stacks. Users experience context length as lag.</p>

<div class="callout war">A team ships a "chat with your codebase" feature by concatenating the whole repository into a 600K-token prompt on a 1M-context model. Demos look great. In production: 30-second first-token latencies, a per-query cost north of a dollar, and a bug where the model confidently cites a function that was deleted — it sat mid-prompt in a stale file next to its replacement, and the model blended them. The fix was retrieval plus a 60K budget, which was faster, cheaper, and more accurate. Huge windows are a capability, not an architecture.</div>

<div class="callout exam">A favorite interview probe: "The model has a 200K window, our docs are 150K tokens, why not just include everything?" Strong answers hit all four costs — money per call, latency, lost-in-the-middle accuracy, and distraction/confusion from irrelevant content — then propose retrieval with a budget and measurement of effective context on the actual task. Answering "context is big enough now, RAG is dead" is a screening-out signal.</div>
`
    },
    {
      id: "context-budgeting",
      title: "Context budgeting: allocating a scarce resource",
      html: `
<p>Once you accept that context is scarce (by quality and price long before the hard limit), every prompt becomes a <strong>budgeting problem</strong>. A production prompt is an assembly of components competing for the same token pool, and mature systems make the allocation explicit instead of concatenating strings until something breaks.</p>

<h3>What is in the budget</h3>
<ul>
<li><strong>System prompt</strong>: instructions, persona, policies. Typically 500–5,000 tokens; agent products (coding assistants) run 10–20K+ once behavioral rules accumulate.</li>
<li><strong>Tool definitions</strong>: schemas count as input tokens on every call. Twenty verbose tools can quietly cost 5–10K tokens per turn.</li>
<li><strong>Conversation history</strong>: grows without bound; the subject of the next lesson.</li>
<li><strong>Retrieved context</strong>: RAG chunks, file contents, search results — usually the biggest and most variable line item.</li>
<li><strong>Output reserve</strong>: the response must fit in the window too, and on reasoning models, thinking tokens come out of the same budget. If you want up to 8K of output, that is 8K of input you cannot use.</li>
</ul>
<p>Write it down as an actual equation per request: input budget = window − output reserve − safety margin, then split input across components with explicit numbers. A reasonable starting split for a RAG chat on a 200K model, deliberately using far less than the window: 3K system, 5K tools, 20K history, 30K retrieval, 8K output reserve — about 66K total, chosen for cost and accuracy, not because the window forced it.</p>

<h3>Allocation strategies</h3>
<ul>
<li><strong>Fixed quotas</strong>: each component gets a hard cap. Simple, predictable, testable; wastes budget when one component is underfull. Start here.</li>
<li><strong>Priority-based (waterfall)</strong>: rank components (system, then current user message, then top retrieval hits, then history, then marginal retrieval), fill in order until the budget is spent. Handles variable inputs gracefully; the model of choice for agent frameworks.</li>
<li><strong>Dynamic/adaptive</strong>: budget varies by query type — a "summarize this document" request shifts almost everything to the document; a follow-up question shifts to history. Requires a classification step but pays off in quality.</li>
</ul>

<h3>Truncation policies — where the bodies are buried</h3>
<p>When a component exceeds its quota, something must be dropped, and <strong>how</strong> you drop matters more than most teams realize:</p>
<ul>
<li><strong>Drop whole documents, not partial ones.</strong> A chunk cut mid-sentence or a JSON blob cut mid-object is worse than absent: the model may complete the truncated text from imagination. Truncate at document or section boundaries.</li>
<li><strong>History trims from the middle, not the head.</strong> The system prompt and first turns often establish task framing; the last turns carry the live thread. Evict the middle (or summarize it) and keep both ends — the lost-in-the-middle result, applied in reverse.</li>
<li><strong>Tool results are the fattest target.</strong> A 50K-token API response where the model needed three fields is the most common budget blowout in agent systems. Truncate tool output aggressively at the source, or post-process it before it enters context.</li>
<li><strong>Announce truncation in-band.</strong> Insert an explicit marker like "[... 34 earlier messages summarized or omitted ...]" so the model knows information is missing and can say so, instead of hallucinating continuity.</li>
</ul>

<div class="callout war">The classic silent failure: a chat product trims history with a naive "keep the last N messages" policy. One day the system prompt itself gets evicted — it was implemented as message zero — and the bot spends a weekend ignoring every safety and formatting rule while all dashboards stay green. Truncation bugs do not throw; they degrade. Log the assembled token counts per component on every request and alarm on anomalies, exactly as you would on cache hit rate.</div>

<h3>Prompt caching changes the ordering rules</h3>
<p>All major providers now discount tokens that prefix-match a recent request — Anthropic cache reads cost about 10 percent of base input price (with a small write surcharge), OpenAI automatic caching charges roughly 25–50 percent for cached prefixes, Gemini has both implicit and explicit caching. The mechanism is prefix-based: <strong>the cache hits only on an identical leading byte sequence</strong>. This imposes an ordering discipline on your assembly:</p>
<ul>
<li>Stable content first: system prompt, tool definitions, long reference documents.</li>
<li>Volatile content last: retrieval results, the current user message, timestamps.</li>
<li>Never interpolate anything volatile (a date, a request ID, a random greeting) into the stable prefix — one changed byte at position 100 invalidates everything after it.</li>
<li>Conversation history is naturally append-only, which is cache-friendly — until compaction rewrites it and takes a full cache miss. Budget for that spike.</li>
</ul>

<div class="callout deep">Why prefix-only: the server is caching the transformer's KV cache — the attention keys and values computed during prefill. Attention is causal, so the KV entries for token N depend on every token before it; a change at any position invalidates all downstream state. That is also why you cannot cache a shared middle section between two different prefixes. Understanding this makes the pricing and the ordering rules obvious rather than arbitrary.</div>

<h3>Counting tokens honestly</h3>
<p>Budgets need measurement, and tokenizers differ per model family (OpenAI's tiktoken vocabularies, Anthropic's tokenizer behind a count-tokens endpoint, SentencePiece variants across open models). Rules that keep you out of trouble: count with the target model's tokenizer or endpoint, not a heuristic, when near a limit; remember that JSON, code, and non-English text tokenize 1.5–3x denser than English prose; and keep a 5–10 percent safety margin because chat-template scaffolding and tool schemas add tokens your string-level count misses.</p>

<div class="callout exam">Interviewers love the design prompt "your prompt is over budget — what do you cut?" The strong answer is a priority argument, not a single trick: reserve output first, protect the system prompt and current query absolutely, then trade history against retrieval based on the query type, trim tool results at the source, and preserve the cache prefix while doing it. Mentioning that you log per-component token counts in production usually ends the line of questioning favorably.</div>
`
    },
    {
      id: "conversation-memory",
      title: "Conversation memory: summarization, sliding windows, compaction",
      html: `
<p>Chat APIs are stateless: the "conversation" is a client-side array you re-send every turn. Left alone, that array grows monotonically until it blows the budget or the window. Conversation memory is the discipline of keeping the transcript useful while keeping it small — and every serious assistant product (ChatGPT, Claude, Copilot, Cursor) runs some version of the same three mechanisms.</p>

<h3>Mechanism 1: the sliding window</h3>
<p>Keep the last N turns (or last T tokens), drop the rest. Trivial to implement, zero added latency, and completely amnesiac: the user's name, stated constraints, and decisions from 40 turns ago vanish without notice. Acceptable for short transactional sessions; a correctness bug for anything long-lived. If you use one, keep the system prompt out of the evictable region (see previous lesson's war story) and evict on token counts, not message counts — message sizes vary by two orders of magnitude once tool results are involved.</p>

<h3>Mechanism 2: summarization / compaction</h3>
<p>When the transcript crosses a threshold, replace the older portion with a model-written summary and keep recent turns verbatim. This is what coding agents call <strong>compaction</strong> (Claude Code's auto-compact fires as the window fills; most agent frameworks expose the same knob). The standard production shape is a <strong>hybrid</strong>:</p>
<pre><code>[system prompt]                      (pinned, never evicted)
[running summary of turns 1..k]      (regenerated at each compaction)
[verbatim turns k+1..now]            (the recency window)
[current user message]</code></pre>
<ul>
<li><strong>Trigger</strong> compaction at a fraction of budget (commonly 70–85 percent), not at the hard limit — you need headroom for the summarization call itself and for the next user turn.</li>
<li><strong>Summarize with a structured prompt</strong>, not "summarize this." Enumerate what must survive: user goals, decisions made, constraints stated, artifacts produced (file names, IDs, URLs), open questions, and things explicitly ruled out. Prose summaries written free-form reliably drop exactly the constraint that mattered.</li>
<li><strong>Keep identifiers verbatim.</strong> Paraphrased order IDs, file paths, and API parameters are corrupted data. A good compaction prompt says: copy exact identifiers, never paraphrase them.</li>
<li><strong>Prune tool results before summarizing turns.</strong> An agent transcript is usually 80 percent tool output by tokens. First replace stale tool results with one-line stubs ("read /src/app.py — 400 lines, content omitted; re-read if needed"); often that alone recovers the budget without touching the dialogue. The model can always re-fetch — a key asymmetry: <strong>tool results are reproducible, user statements are not</strong>.</li>
</ul>

<div class="callout war">Summary drift is the compaction failure mode that reaches customers: each compaction summarizes a text that already contains the previous summary, and small paraphrases compound like photocopies of photocopies. Twenty compactions in, the summary asserts the user wanted X when they explicitly ruled X out at turn 3. Mitigations: always summarize from as much original material as possible rather than summary-of-summary when budget allows; pin non-negotiable constraints into a separate never-summarized block; and eval your compaction prompt like any other prompt — feed it transcripts with known critical facts and assert the facts survive.</div>

<div class="callout deep">Compaction interacts badly with prompt caching: rewriting the transcript's front invalidates the entire cached prefix, so the turn after a compaction pays full input price and full prefill latency — often the slowest, most expensive turn in a session. This is why providers and frameworks compact as late and as rarely as budget allows, and why some schedule compaction during idle moments rather than mid-request.</div>

<h3>Mechanism 3: structured state outside the transcript</h3>
<p>The strongest form of conversation memory is not in the message array at all. Maintain an explicit state object — task list, decisions log, user constraints — updated as the conversation proceeds, and render it into the prompt each turn. This is how agents keep coherence across hours of work: the transcript can be compacted brutally because the ground truth lives in structured state that never gets paraphrased. If you have ever watched a coding agent re-read its own to-do file after compaction, you have seen this pattern working as designed. The transcript becomes an ephemeral working buffer; state is the durable record — the same separation you already apply between logs and databases.</p>

<h3>What to persist, and when</h3>
<table>
<thead><tr><th>Information</th><th>Policy</th></tr></thead>
<tbody>
<tr><td>User goal and hard constraints</td><td>Pin verbatim; never summarize away</td></tr>
<tr><td>Decisions and their rationale</td><td>Summarize; keep the decision exact, compress the rationale</td></tr>
<tr><td>Identifiers (paths, IDs, URLs, versions)</td><td>Copy exactly or drop entirely — never paraphrase</td></tr>
<tr><td>Large tool results</td><td>Stub aggressively; they are re-fetchable</td></tr>
<tr><td>Chit-chat and dead ends</td><td>Drop; note dead ends only if retrying them would be costly</td></tr>
</tbody>
</table>

<div class="callout limits">Order-of-magnitude numbers for sizing: a typical dense chat turn is 50–300 tokens; a coding-agent turn with tool output is 1K–20K. A 100-turn agent session easily exceeds 500K raw tokens — compaction is not optional there at any window size. Summarization calls themselves cost real money at scale: compacting 100K tokens through a frontier model is tens of cents, which is why frameworks often compact with a cheaper model than the one doing the main task.</div>

<div class="callout exam">A common interview scenario: "Your support bot forgets what the customer said 30 messages ago — walk me through fixing it." The expected architecture is exactly the hybrid: pinned system prompt, structured facts store or pinned constraints, running summary with a structured summarization prompt, verbatim recency window, token-based compaction trigger with headroom. Bonus points for mentioning summary drift and the cache-invalidation cost of compaction; red flag for answering "increase the context window" alone.</div>
`
    },
    {
      id: "long-term-memory",
      title: "Long-term memory: profiles, episodic vs semantic stores, retrieval-backed memory",
      html: `
<p>Conversation memory ends when the session ends. Long-term memory is the cross-session layer — the difference between a tool and something that appears to know you. Strip away vendor branding (ChatGPT memory, Claude's memory features, Gemini's saved info) and open-source frameworks (Letta née MemGPT, mem0, Zep, LangGraph memory stores), and you find three complementary patterns plus a write policy.</p>

<h3>Pattern 1: the user profile (working memory made durable)</h3>
<p>A small, structured, always-loaded record: name, role, preferences, standing constraints ("prefers Python", "never suggest regex golf", "timezone UTC+2"). Slot-based or free-text-list based; either way it is <strong>bounded</strong> (hundreds of tokens, not thousands) and injected into every session's system prompt. Because it is always in context, it is the highest-leverage and highest-risk store: one wrong entry poisons every future conversation. Profiles therefore need <strong>update semantics</strong>, not just append: new facts must be able to overwrite old ones ("moved from Berlin to Lisbon"), which means detecting that two memories address the same slot — entity resolution, the hard part of every memory system.</p>

<h3>Pattern 2: episodic vs semantic stores</h3>
<p>Borrowed from cognitive science and worth keeping precise, because the two need different storage and retrieval:</p>
<ul>
<li><strong>Episodic memory</strong>: records of specific events — "on 2026-07-14 the user reported the deploy failing with a TLS error; we traced it to a stale CA bundle." Time-stamped, immutable, append-only. Useful verbatim ("what did we decide last week?") and as raw material for reflection.</li>
<li><strong>Semantic memory</strong>: distilled, timeless facts — "the user's staging environment sits behind a corporate proxy." Produced by a background <strong>reflection/consolidation</strong> step that reads recent episodes and extracts durable facts, deduplicating and reconciling against what is already stored. This mirrors the generative-agents research pattern (observations, then periodic reflection into higher-level memories) that most production memory systems quietly reimplement.</li>
</ul>
<p>Keeping them separate solves real problems: episodes give you provenance and an audit trail ("why does the bot believe this?"), semantic facts give you compact, retrieval-friendly knowledge. Systems that store only raw transcripts drown in tokens; systems that store only distilled facts cannot answer "when did I tell you that?" or recover from a bad distillation.</p>

<h3>Pattern 3: retrieval-backed memory</h3>
<p>The scalable store: embed memories (episodes, facts, past conversation summaries) into a vector index — usually alongside keyword search, i.e. hybrid retrieval — and at session start or per turn, retrieve the top-k relevant memories into context. This is RAG pointed at the user's own history instead of a corpus, and it inherits every RAG failure mode: retrieval misses, stale entries ranking above their corrections, and irrelevant memories distracting the model. Two memory-specific twists deserve attention: <strong>recency and importance should join similarity in the ranking function</strong> (the generative-agents scoring — relevance + recency + importance — remains the sane default), and <strong>retrieved memories need timestamps rendered into the prompt</strong> so the model can prefer newer information when entries conflict.</p>

<h3>The write policy: who decides what is remembered?</h3>
<ul>
<li><strong>Explicit tool-based writes</strong>: the model is given remember/update/forget tools and decides in-band when to call them (the MemGPT/Letta approach — the model pages its own memory like an OS). Transparent and auditable; misses facts the model did not deem memorable.</li>
<li><strong>Background extraction</strong>: an offline job reads transcripts and writes memories without the model or user asking (the ChatGPT-memory-style approach, also mem0's default). Catches more; risks storing things the user considered ephemeral — which is a product and privacy decision, not just an engineering one.</li>
<li><strong>User-curated</strong>: the user views, edits, and deletes memories. Whatever else you build, build this: silent memory is where trust goes to die, and deletion is a regulatory requirement in most markets, which means your vector index needs real deletes, not tombstones that still rank.</li>
</ul>

<div class="callout war">The memory-poisoning incident every team eventually has: the assistant summarizes a sarcastic or hypothetical user message into a confident false fact ("user is the CTO"), semantic consolidation copies it forward, and retrieval faithfully injects it into every future session — self-reinforcing, because the model's outputs conditioned on the bad fact generate new episodes that corroborate it. Defenses: store provenance links from every semantic fact back to source episodes, timestamp everything, let corrections hard-overwrite rather than coexist, and expose memory to the user for deletion. Treat the memory store as user-generated content with write access to your system prompt — because that is literally what it is, including as a prompt-injection channel.</div>

<div class="callout deep">Forgetting is a feature, not a failure. Biological memory decays for a reason: unbounded stores rot. Production systems apply TTLs to episodes, decay scores on unretrieved memories, cap per-user memory budgets (both storage and how many tokens of memory may enter a prompt), and periodically re-consolidate — merging duplicates and dropping superseded facts. Without garbage collection, retrieval quality degrades as the index fills with near-duplicate stale entries, which manifests as the assistant getting subtly dumber for your oldest, most loyal users. As of early 2026 the open frameworks (Letta, mem0, Zep) differ mostly in how opinionated their consolidation and forgetting machinery is — evaluate that, not the marketing.</div>

<div class="callout exam">"Design memory for a personal assistant" is now a canonical AI system-design interview. A complete answer names the layers (bounded always-loaded profile; append-only episodic store; consolidated semantic facts; retrieval-backed injection with relevance + recency + importance ranking), the write policy trade-off (model-driven vs background extraction vs user-curated), and at least two failure modes (poisoning, stale-fact conflicts, retrieval misses). Interviewers specifically listen for update/conflict semantics — anyone can append; overwriting correctly is the discriminator.</div>
`
    },
    {
      id: "context-as-product",
      title: "Context is the product: debugging the assembled prompt",
      html: `
<p>Here is the thesis this module has been building toward: in a production LLM system, <strong>the model is a commodity and the context is your product</strong>. You do not control the weights; you control every byte that goes in. So when quality drops, the prior should be overwhelming: it is a context problem — wrong, missing, stale, contradictory, or badly arranged input — long before it is a model problem. Teams that internalize this debug in hours; teams that do not spend weeks swapping models and fiddling with temperature.</p>

<h3>A failure taxonomy worth memorizing</h3>
<p>Four distinct ways context goes wrong (popularized in 2025 as context poisoning, distraction, confusion, and clash — the labels vary, the categories are durable):</p>
<ul>
<li><strong>Missing context</strong>: the fact needed for a correct answer never made it into the prompt — retrieval missed, truncation dropped it, compaction summarized it away. The model then does what models do with gaps: fills them plausibly. <em>Most hallucination tickets in RAG systems are actually retrieval misses.</em></li>
<li><strong>Poisoned context</strong>: something false is in the prompt and gets treated as ground truth — a stale document, a bad memory entry, an earlier model hallucination that persisted into history, or injected instructions from retrieved content. Errors compound turn over turn because the transcript is self-conditioning.</li>
<li><strong>Distracting context</strong>: everything present is true but mostly irrelevant, and the signal drowns. Long contexts amplify this; models increasingly latch onto salient-but-wrong passages as prompts grow. This is the failure mode "just add more context" creates.</li>
<li><strong>Clashing context</strong>: two parts of the prompt disagree — system prompt vs retrieved doc, old memory vs new statement, two versions of the same file. The model resolves conflicts silently and arbitrarily; you see nondeterministic quality, the worst kind.</li>
</ul>
<p>Related and real: <strong>context rot</strong> — quality degrading over a long session even without any single bad injection, as accumulated tool stubs, summaries-of-summaries, and dead-end reasoning accrete. The fix is hygiene (aggressive pruning, structured state) rather than any one repair.</p>

<h3>The debugging discipline: read the final assembled prompt</h3>
<p>The single highest-value habit in applied LLM work: when behavior is wrong, <strong>obtain the exact, final, post-assembly prompt</strong> — after templating, truncation, compaction, memory injection, retrieval, and tool-schema attachment — and read it. Not the template. Not the components in your code. The actual byte sequence sent to the API. Every context bug above is <em>visible to the naked eye</em> in that artifact: the missing chunk is visibly absent, the clash sits in plain sight, the truncation marker (or its guilty absence) is right there. Concretely:</p>
<ul>
<li><strong>Log the assembled request</strong> (messages array, tool schemas, sampling params) with a request ID on every call, subject to your data-retention rules. This is table stakes, the access log of LLM systems.</li>
<li><strong>Log per-component token counts</strong> — system, tools, history, retrieval, memory — so dashboards show you the budget drifting before users do.</li>
<li><strong>Make any prompt replayable</strong>: one command that re-sends a logged request verbatim. Now quality bugs become diffable experiments — edit the assembled prompt by hand, replay, bisect which component change flips the behavior. This is git-bisect for prompts, and it turns arguments into evidence.</li>
<li><strong>Trace multi-step systems</strong> end to end, tools like LangSmith, Langfuse, Braintrust, or OpenTelemetry GenAI conventions all work; the tool matters less than having every intermediate prompt and response inspectable per step of an agent loop.</li>
</ul>

<div class="callout war">A real week-long incident, reconstructable in many companies: answer quality "randomly" degraded for some users. The team A/B-tested models, rewrote the system prompt twice, tuned retrieval — nothing. Someone finally diffed two assembled prompts, one good session and one bad. The bad ones contained a memory entry asserting an outdated plan tier, injected above the fresh account data it contradicted — a textbook clash, resolved arbitrarily per request. Total fix: one deletion and an overwrite rule in memory consolidation. Time from "read the assembled prompt" to root cause: about 20 minutes. The lesson is not that the team was careless; it is that nothing in their stack made the assembled prompt visible.</div>

<div class="callout deep">Why arrangement matters as much as content: decoder attention is position-sensitive (primacy/recency from lesson 1), instruction-tuned models weight system-role text and prompt-final text differently, and conflicting spans are resolved by learned salience, not recency of truth. The same set of facts, reordered, measurably changes answers. This is why "we included the right document" does not close the investigation — where it sat, what surrounded it, and what contradicted it are part of the input, and assembly order is a real engineering surface, not string concatenation trivia.</div>

<h3>Prevention: treat assembly as software</h3>
<p>Everything upstream of the API call — retrieval filters, truncation policies, compaction prompts, memory consolidation, component ordering — is code, so hold it to code standards: version prompts and assembly logic together (a truncation-policy change is a behavior change and gets a changelog entry); write <strong>assembly unit tests</strong> (build the prompt for a fixture conversation, assert constraints survive compaction, budgets hold, orderings are stable); and run offline evals whose failure analysis starts from assembled prompts, so every regression is attributable to a component. When you can answer "what exactly did the model see, and which line of code put it there?" in one minute, most LLM debugging stops being mysterious.</p>

<div class="callout exam">Interview debugging exercises in this area are increasingly literal: here is a transcript where the bot answers wrongly — find the bug. The winning move is asking to see the final assembled prompt and walking the taxonomy: is the needed fact present? Is anything false present? Anything contradictory? Where do the key spans sit? Interviewers report that most candidates instead propose changing models or prompt wording immediately — reading the actual input first is the senior signal, exactly like reading the actual query plan before tuning a database.</div>
`
    }
  ],
  quiz: [
    {
      q: "A team builds a document QA feature on a model advertising a 1M-token context. They concatenate all 700K tokens of company docs into every prompt. Answers about topics covered early and late in the doc set are good; answers about mid-corpus topics are unreliable. Costs are high. What is the most likely primary cause of the accuracy pattern?",
      options: [
        "The model's output token limit is being exhausted, truncating answers",
        "Position-sensitive attention: recall degrades for content in the middle of very long contexts",
        "The tokenizer compresses mid-document text more aggressively, losing information",
        "Prompt caching is serving stale versions of the middle documents"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the lost-in-the-middle effect.</strong> Long-context models show U-shaped recall: strong at the beginning and end of the prompt, weakest in the interior. Stuffing 700K tokens guarantees most content sits in the weak middle region, matching the observed pattern exactly. The fix is retrieval with a budget and edge-placement of the most relevant material.</p><p>Output limits would truncate long responses, not selectively degrade mid-corpus topics. Tokenizers compress by vocabulary statistics, not by position — the same text tokenizes identically anywhere in the prompt. Prompt caching returns cached attention state for an identical prefix; it never substitutes stale document content — if the bytes changed, the cache misses.</p>"
    },
    {
      q: "A vendor demo shows a model retrieving a hidden sentence perfectly from 900K tokens of filler (needle-in-a-haystack). Your task requires aggregating figures scattered across a 300K-token filing. Why is the demo weak evidence that the model will handle your task at 300K?",
      options: [
        "NIAH tests exact-match retrieval of one span, which is far easier than multi-fact aggregation and reasoning at length",
        "NIAH results only apply to the first 100K tokens of any context window",
        "The demo model was fine-tuned specifically on the filler text",
        "Aggregation tasks are limited by output tokens, and NIAH does not measure output limits"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>Correct: NIAH is the easiest long-context task.</strong> Retrieving one verbatim span rewards a single attention hit. Harder benchmarks (RULER's multi-needle and aggregation tasks, NoLiMa's no-literal-overlap retrieval) show models degrading well before nominal length — effective context for reasoning-heavy work is commonly a quarter to half of nominal. You must measure on a task shaped like yours.</p><p>NIAH results are not scoped to the first 100K tokens — vendors specifically demonstrate full-window retrieval. Fine-tuning on filler is not how these demos work and would be irrelevant anyway. Output limits are a real but separate constraint; the accuracy risk here is input-side aggregation, which NIAH genuinely does not measure — but the core reason the demo is weak evidence is task difficulty, not output caps.</p>"
    },
    {
      q: "You are assembling prompts for a RAG chat on a 200K-context model. Components: 3K system prompt, 6K tool schemas, variable history, variable retrieval, and you want up to 8K output. Which budgeting mistake is most likely to cause intermittent hard API failures (rejected requests) rather than gradual quality loss?",
      options: [
        "Placing retrieval results before conversation history in the prompt",
        "Failing to reserve output tokens, so input plus max output sometimes exceeds the window",
        "Using fixed quotas instead of priority-based allocation",
        "Counting tokens with the wrong tokenizer, underestimating by 5 percent with no safety margin"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: no output reserve.</strong> The response must fit in the same window as the input. If assembly fills the window with input and you request 8K max output, requests near the boundary get rejected or truncated — an intermittent hard failure that appears only on long sessions. Budget input as window minus output reserve minus margin.</p><p>Component ordering affects quality and cache hit rate, not request validity. Fixed quotas waste budget but keep you under limits — they cause quality loss, not rejections. A 5 percent tokenizer undercount with no margin can also cause boundary failures, which is why the margin rule exists — but it is a second-order version of the same problem, and the systematic, guaranteed-to-bite mistake is omitting the output reserve entirely, which errs by the full 8K.</p>"
    },
    {
      q: "Your prompt assembly puts a timestamp string like 'Current time: 2026-07-23T10:14:02Z' at the top of the system prompt, before 15K tokens of stable instructions and tool schemas. Prompt cache hit rates are near zero. Why?",
      options: [
        "Provider caches expire after 60 seconds regardless of content",
        "Tool schemas are never cacheable, so the prefix cannot be cached",
        "Caching is prefix-based, and the per-request timestamp changes the first bytes, invalidating everything after it",
        "System-role messages are excluded from prompt caching by all providers"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>Correct: a volatile byte at the front kills the prefix cache.</strong> Prompt caching stores the KV state of a leading token sequence; a hit requires identical leading bytes. A timestamp that changes every request means no two requests share a prefix beyond it. Move volatile values to the end of the prompt (or into the user turn) and keep the stable 15K first, and hit rates recover.</p><p>Cache TTLs (commonly minutes) would still allow hits between rapid consecutive turns, and are not the mechanism here. Tool schemas are cacheable — they are part of the tokenized prefix. System-role content is cacheable too; there is no such exclusion. The root cause is byte-level prefix sensitivity, which follows directly from causal attention: KV entries for token N depend on all earlier tokens.</p>"
    },
    {
      q: "A support bot keeps the last 30 messages of history. Users report that after long conversations the bot suddenly ignores its formatting and safety rules. Dashboards show no errors. What is the most likely bug?",
      options: [
        "The model provider silently downgraded the model tier mid-conversation",
        "The system prompt was stored as the first message and eventually got evicted by the sliding window",
        "The temperature setting increases automatically with conversation length",
        "Users are exceeding a rate limit, causing degraded responses"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the pinned content was evictable.</strong> Implementing the system prompt as message zero and then applying keep-last-N eviction eventually drops it, and behavior degrades silently — truncation bugs do not throw. The fix is structural: pin the system prompt outside the evictable region and evict by token count with the pinned region excluded, plus logging per-component token counts to catch this class of bug from dashboards.</p><p>Providers do not silently swap model tiers mid-conversation as a degradation mechanism. Temperature does not change with length. Rate limiting produces errors or throttling, not selectively forgotten formatting rules. The signature — rule-following disappearing exactly after conversations reach a certain length — points squarely at eviction of the instructions themselves.</p>"
    },
    {
      q: "During compaction, your summarizer turns 'user confirmed order #A-88213 should ship to the Lisbon address' into 'user confirmed shipping details for their order'. Later the agent asks the user to repeat the order number. Which two compaction rules were violated? (Select 2)",
      options: [
        "Identifiers must be copied verbatim or dropped, never paraphrased",
        "Compaction should use a structured summary prompt enumerating what must survive",
        "Compaction must always run on the full transcript including the system prompt",
        "Summaries must be written by a larger model than the main task model",
        "Tool results should be summarized before dialogue turns"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>Correct: verbatim identifiers, and structured summarization prompts.</strong> A paraphrased order ID is corrupted data — 'shipping details' is unrecoverable, forcing the agent to re-ask. A structured compaction prompt (preserve goals, decisions, constraints, and exact identifiers such as IDs, paths, URLs) exists precisely to prevent free-form prose from dropping load-bearing specifics.</p><p>The system prompt should be pinned and excluded from compaction, not included in it. Summarizer model size is an economics choice — frameworks often compact with a cheaper model, and a small model with a good structured prompt beats a large model with 'summarize this'. Pruning tool results first is a good practice for reclaiming budget, but it is orthogonal to this failure: the lost fact was in dialogue, not tool output.</p>"
    },
    {
      q: "An agent framework compacts the conversation whenever usage hits 95 percent of the context window. Sessions intermittently fail exactly at compaction time. What is the most likely mechanism?",
      options: [
        "Compaction at 95 percent leaves too little headroom for the summarization call and the next turn, overflowing the window",
        "The provider blocks summarization requests near the window limit",
        "Compaction invalidates the prompt cache, which raises an API error",
        "Summaries longer than 5 percent of the window are rejected by the API"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>Correct: no headroom.</strong> Compaction itself needs window room — the summarization request contains the transcript being summarized — and the turn in flight still needs input plus output space. Triggering at 95 percent means the compaction call or the next turn can overflow. Production systems trigger at 70–85 percent to leave room for the compaction call, its output, and the ongoing turn.</p><p>Providers have no special block on summarization near limits — it is just another request subject to the same token math. Cache invalidation after compaction is real but costs money and latency; it never raises an error. There is no API rule about summary length as a percentage of window. The failure is arithmetic, not policy: requests whose input plus max output exceeds the window fail, and a 95 percent trigger manufactures exactly those requests.</p>"
    },
    {
      q: "In a long coding-agent session, 80 percent of context tokens are old tool results (file reads, test output). Budget pressure is forcing aggressive summarization of the dialogue. What is the better first move, and why?",
      options: [
        "Summarize the dialogue harder, since tool output is needed verbatim for correctness",
        "Replace stale tool results with one-line stubs, because tool output is re-fetchable while user statements are not",
        "Increase the context window by switching to a larger model",
        "Move tool results to the top of the prompt where attention is strongest"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: stub the tool results first.</strong> The key asymmetry: tool results are reproducible — the agent can re-read a file or re-run a test — while user statements and decisions are unrecoverable once summarized away. Stubbing stale tool output ('read /src/app.py — content omitted; re-read if needed') typically reclaims most of the budget with near-zero information risk.</p><p>Summarizing dialogue harder destroys the irreplaceable data while keeping the replaceable bulk. A bigger window defers the problem at higher cost and latency and does nothing about lost-in-the-middle degradation on a bloated transcript. Moving tool results to the top optimizes attention for exactly the content you care least about, and reordering history also breaks prompt-cache prefixes.</p>"
    },
    {
      q: "You are designing long-term memory for an assistant. Requirements: answer 'what did we decide last Tuesday', keep a compact set of durable user facts, and audit why the assistant believes something. Which architecture fits best?",
      options: [
        "A single vector store of raw conversation transcripts, retrieved by similarity",
        "An always-loaded free-text scratchpad the model edits every turn",
        "Append-only time-stamped episodic store, plus a consolidated semantic fact store with provenance links back to episodes",
        "A relational table of user attributes updated by regex extraction from messages"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>Correct: episodic plus semantic with provenance.</strong> Time-stamped episodes answer 'what happened last Tuesday' verbatim; consolidation distills compact durable facts for cheap injection; provenance links from each fact to its source episodes provide the audit trail — each requirement maps to one component.</p><p>Raw-transcript vector search drowns in tokens, has no distillation, and cannot explain beliefs beyond dumping matches. An always-loaded scratchpad is bounded working memory — it cannot hold history at scale and offers no time-indexed recall or audit trail. Regex extraction into a relational table fails on paraphrase and negation, and captures none of the episodic record. The episodic/semantic split exists precisely because verbatim recall and compact knowledge are different workloads.</p>"
    },
    {
      q: "Weeks ago, a background memory extractor stored 'user is on the Enterprise plan' from a hypothetical question ('if I were on Enterprise, would...'). Retrieval now injects this into every billing conversation and errors compound. Which two defenses most directly address this failure class? (Select 2)",
      options: [
        "Store provenance and timestamps so facts can be traced and superseded, with corrections overwriting rather than coexisting",
        "Expose memories to the user for review and deletion",
        "Increase the vector index's top-k so more memories are retrieved for balance",
        "Switch memory extraction to a larger model so mistakes never happen",
        "Lower the model's temperature during billing conversations"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>Correct: provenance with overwrite semantics, and user-visible curation.</strong> Memory poisoning is self-reinforcing — outputs conditioned on the bad fact generate corroborating episodes — so you need the ability to trace a fact to its source, supersede it hard (overwrite, not append a contradiction that loses the ranking lottery), and let the user delete it. These two mechanisms are the direct remediation and prevention paths.</p><p>Raising top-k injects more memories including the poisoned one — it worsens distraction and does not remove the falsehood. A larger extraction model reduces but cannot eliminate misreadings of sarcasm and hypotheticals; without overwrite and deletion machinery, rare mistakes still persist forever. Temperature affects sampling variance, not the truth value of injected context — the model is answering faithfully from poisoned input.</p>"
    },
    {
      q: "A RAG assistant confidently describes a refund policy that does not exist. Logs show the retrieval step returned zero chunks for the query, and the prompt contained only the system prompt and the question. Which failure class is this, and what does it imply about where to fix it?",
      options: [
        "Poisoned context — clean the document corpus",
        "Missing context — fix retrieval and make the prompt instruct the model to say when information is absent",
        "Clashing context — deduplicate conflicting policy versions",
        "Model hallucination unrelated to context — switch to a larger model"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: missing context.</strong> The needed fact never entered the prompt (retrieval returned nothing), and the model filled the gap plausibly — most 'hallucination' tickets in RAG systems are retrieval misses wearing a costume. Fixes live in the pipeline: better retrieval (hybrid search, query rewriting), and an explicit instruction plus in-band signal that no documents were found so the model declines instead of inventing.</p><p>Poisoning requires something false present in the prompt; the prompt here contained nothing false — it contained nothing at all. Clash requires two contradictory spans; there was only one span. Swapping models treats the symptom: a larger model with an empty evidence section is still guessing, just more fluently. The assembled-prompt log is what made this diagnosis take one minute — which is the lesson.</p>"
    },
    {
      q: "Two logged sessions ask the same question; one gets the right answer, one wrong. Diffing the assembled prompts shows the wrong session includes an old memory entry stating the user's previous plan tier above fresh account data stating the new tier. What failure class is this, and why is behavior nondeterministic across sessions?",
      options: [
        "Distraction; the model runs out of attention budget on long prompts",
        "Clash; two contradictory spans are present and the model resolves the conflict by learned salience, not by recency of truth",
        "Missing context; the new tier was truncated away",
        "Context rot; the session was too long and accumulated noise"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: clashing context.</strong> Both the stale memory and the fresh data are in the prompt; the model has no principled way to know which is authoritative and resolves the contradiction by learned salience and position — which varies with surrounding content, hence apparently random outcomes across sessions. The durable fix is upstream: overwrite semantics in memory consolidation so superseded facts are removed, plus timestamps rendered in-prompt so the model can prefer newer data when conflicts do slip through.</p><p>Distraction involves irrelevant-but-true content drowning signal — here the problem span is directly relevant and false-by-staleness. Missing context is ruled out because the correct fact was present. Context rot describes gradual within-session accumulation; this is a cross-session injection bug, visible in a single prompt diff.</p>"
    },
    {
      q: "Your team spends two weeks on a quality regression: swapping models, rewriting the system prompt, tuning retrieval parameters. Nothing works. According to the debugging discipline for context problems, what should have been step one?",
      options: [
        "Run a larger offline eval suite to quantify the regression",
        "Retrieve and read the exact final assembled prompts from failing requests, and diff them against passing ones",
        "A/B test three different model providers to isolate model effects",
        "Increase retrieval top-k and re-rank with a cross-encoder"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: read the assembled prompt.</strong> Every context failure class — missing, poisoned, distracting, clashing — is visible to the naked eye in the final post-assembly byte sequence, and diffing a failing prompt against a passing one localizes the guilty component in minutes. This requires the logging infrastructure (assembled requests with IDs, per-component token counts, replayability) that mature teams treat as table stakes.</p><p>Offline evals quantify regressions but do not localize causes, and their failure analysis should itself start from assembled prompts. A/B testing providers assumes a model problem before establishing an input problem — backwards, given that context is the part you control. Raising top-k is a blind retrieval tweak that can worsen distraction; without reading prompts you cannot even know retrieval was the guilty component.</p>"
    }
  ],
  flashcards: [
    { front: "Nominal vs effective context", back: "<p><strong>Nominal</strong>: the advertised window size. <strong>Effective</strong>: the length at which your task still meets quality. For reasoning-heavy work, assume roughly a quarter to a half of nominal until measured.</p>" },
    { front: "Lost in the middle", back: "<p>Recall vs answer position is <strong>U-shaped</strong>: strong at prompt start (primacy) and end (recency), weakest mid-context. Place instructions and key documents at the edges; repeat critical constraints near the end of long prompts.</p>" },
    { front: "Why NIAH benchmarks overstate long-context ability", back: "<p>Needle-in-a-haystack is exact-match retrieval of one span — the easiest task. <strong>RULER</strong> (multi-needle, aggregation) and <strong>NoLiMa</strong> (no literal keyword overlap) show degradation well before nominal length.</p>" },
    { front: "Rough token conversions to keep in your head", back: "<p>1 token ≈ 3–4 English characters. 128K tokens ≈ a 300-page book. Code, JSON, and non-English text run <strong>1.5–3x denser</strong> in tokens than English prose.</p>" },
    { front: "The context budget equation", back: "<p>Input budget = window − <strong>output reserve</strong> − safety margin, then split explicitly across system prompt, tool schemas, history, and retrieval. Output (including reasoning tokens) shares the window with input.</p>" },
    { front: "Three context allocation strategies", back: "<p><strong>Fixed quotas</strong> (simple, predictable, can waste budget), <strong>priority waterfall</strong> (fill by rank until spent — the agent-framework default), <strong>dynamic</strong> (budget shifts by query type; needs classification).</p>" },
    { front: "Truncation policy rules of thumb", back: "<p>Drop <strong>whole documents</strong>, never mid-sentence. Trim history from the <strong>middle</strong>, keep both ends. Attack <strong>tool results first</strong> — they are re-fetchable. Always insert an in-band marker announcing what was omitted.</p>" },
    { front: "Why prompt caching is prefix-only", back: "<p>The provider caches the transformer's <strong>KV cache</strong> from prefill; causal attention makes token N's entries depend on all earlier tokens, so one changed byte invalidates everything after it. Hence: stable content first, volatile content last.</p>" },
    { front: "Prompt cache pricing shape (early 2026)", back: "<p>Anthropic cache reads ≈ <strong>10%</strong> of base input price (small write surcharge); OpenAI cached prefixes ≈ <strong>25–50%</strong>; Gemini has implicit + explicit modes. Long-context tokens beyond 200K often price at ≈ <strong>2x</strong>.</p>" },
    { front: "Sliding-window memory: main risk", back: "<p>Amnesia by eviction — including the classic bug of storing the system prompt as message zero and losing it. Pin non-evictable content structurally and evict by <strong>token count</strong>, not message count.</p>" },
    { front: "Standard hybrid conversation-memory layout", back: "<p>Pinned system prompt → <strong>running summary</strong> of old turns → <strong>verbatim recent turns</strong> → current message. Compact at 70–85% of budget to leave headroom for the summarization call and the next turn.</p>" },
    { front: "Summary drift", back: "<p>Compaction that summarizes previous summaries compounds paraphrase errors like photocopies of photocopies. Mitigate: structured summary prompts, verbatim identifiers, pinned constraints outside the summary, evals asserting known facts survive.</p>" },
    { front: "Tool results vs user statements in compaction", back: "<p>The key asymmetry: <strong>tool results are reproducible</strong> (re-read the file, re-run the test) — stub them aggressively. <strong>User statements and decisions are not</strong> — preserve them. Agent transcripts are typically ~80% tool output by tokens.</p>" },
    { front: "Episodic vs semantic memory stores", back: "<p><strong>Episodic</strong>: time-stamped, append-only event records — verbatim recall and provenance. <strong>Semantic</strong>: distilled durable facts produced by background <strong>consolidation/reflection</strong>. Keep both; link facts to source episodes.</p>" },
    { front: "Memory write policies", back: "<p><strong>Model-driven tools</strong> (remember/update/forget — MemGPT/Letta style, auditable), <strong>background extraction</strong> (catches more, privacy risk), <strong>user-curated</strong> (always build: review, edit, real deletion).</p>" },
    { front: "Memory retrieval ranking", back: "<p>Similarity alone is insufficient: rank by <strong>relevance + recency + importance</strong> (the generative-agents scoring), and render timestamps into the prompt so the model can prefer newer facts on conflict.</p>" },
    { front: "Memory poisoning", back: "<p>A false extracted fact gets consolidated and re-injected every session, and becomes <strong>self-reinforcing</strong> as outputs conditioned on it generate corroborating episodes. Defenses: provenance, timestamps, hard overwrite on correction, user deletion.</p>" },
    { front: "The four context failure classes", back: "<p><strong>Missing</strong> (fact never entered — most RAG 'hallucinations'), <strong>poisoned</strong> (false content treated as truth), <strong>distracting</strong> (true but irrelevant bulk drowns signal), <strong>clashing</strong> (contradictory spans resolved arbitrarily → nondeterministic quality).</p>" },
    { front: "First debugging move for any LLM quality problem", back: "<p>Obtain and read the <strong>final assembled prompt</strong> — post-templating, post-truncation, post-memory-injection — and diff failing vs passing requests. Requires logging assembled requests, per-component token counts, and one-command replay.</p>" },
    { front: "Context rot", back: "<p>Gradual within-session quality decay as stubs, summaries-of-summaries, and dead-end reasoning accumulate — no single bad injection to point at. Fix with hygiene: aggressive pruning, structured state outside the transcript, periodic re-consolidation.</p>" }
  ],
  lab: null
});
