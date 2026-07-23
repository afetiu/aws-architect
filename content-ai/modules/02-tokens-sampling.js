/* Module 02 — Tokens & Sampling (AI Engineer, core track) */
window.COURSE.register({
  id: "tokens-sampling",
  order: 2,
  track: "core",
  title: "Tokens & Sampling",
  description: "The two interfaces you actually program against: the tokenizer and the sampler. BPE and the bizarre failures it manufactures (counting, spelling, numbers, non-English text); token math for cost and context budgeting with real early-2026 prices; what temperature, top-p, and top-k really do to the distribution; why temperature 0 is not deterministic; and the decoding controls — stop sequences, max tokens, and grammar-constrained output — that turn a text generator into a dependable component.",
  examWeight: "Interviewers use this module as a competence litmus test: 'why can't the model count the Rs in strawberry', 'estimate the monthly cost of this feature', and 'why did temperature 0 give me two different answers' are stock questions. Real hiring loops also probe whether you reach for structured outputs instead of regex-parsing prose.",
  lessons: [
    {
      id: "bpe-tokenization",
      title: "BPE tokenization and the weird failures it causes",
      html: `
<p>Models never see characters or words. They see <strong>token IDs</strong> — integers indexing a fixed vocabulary learned before training ever started. Every input you send is chopped into these units by a deterministic tokenizer, and a whole family of famous LLM failures — miscounting letters, botching arithmetic, degrading on non-English text — are not intelligence failures at all. They are artifacts of this preprocessing step. If you can diagnose "that's a tokenizer problem" on sight, you will save your team days of prompt-tweaking on unfixable ground.</p>

<h3>How BPE builds a vocabulary</h3>
<p><strong>Byte-pair encoding</strong> starts from raw bytes (256 base tokens — so any input, any language, any binary garbage is representable with zero out-of-vocabulary failures) and greedily merges the most frequent adjacent pair into a new token, repeating until the vocabulary hits a target size. Frequent strings become single tokens; rare strings stay fragmented. Modern vocabularies: OpenAI's <strong>cl100k</strong> (~100k, GPT-4 era) and <strong>o200k</strong> (~200k, GPT-4o onward), Llama 3 at <strong>128k</strong>, Gemma at <strong>256k</strong>. Rule of thumb for English prose: <strong>1 token is roughly 4 characters, or about 0.75 words</strong> — 100 tokens per 75 words.</p>
<p>The critical property: merges are frequency-driven, so tokenization mirrors the training corpus's statistics, not any linguistic structure. " the" is one token; "the" mid-word is a different token; "The" at a sentence start is yet another. Leading spaces belong to tokens — which is why a prompt ending in a trailing space can wreck completion quality: the model expects " word" as one unit, and your dangling space forces it down a rare tokenization path.</p>

<div class="callout deep">Why not characters or words? Words fail on morphology-rich languages and unbounded vocabulary (every typo would be out-of-vocabulary); characters make sequences 4x longer, and attention cost grows quadratically with length while long-range dependencies get harder to learn. BPE is a compression compromise: common things cheap, everything representable. Tokenizer choice is frozen before pretraining and cannot be changed afterward without retraining — the vocabulary is load-bearing for every weight in the model.</div>

<h3>The failure gallery — and why each one happens</h3>
<ul>
<li><strong>Counting and spelling:</strong> "how many Rs in strawberry" became a meme because the model sees something like [st][raw][berry] — the letter R is not an object in its input; it is smeared invisibly across token identities. Character-level tasks (count letters, reverse a string, acrostics) require the model to have memorized each token's spelling, which is learned incidentally and unreliably. Fix: don't ask; have the model write code that counts, or split the input character by character yourself.</li>
<li><strong>Numbers and arithmetic:</strong> tokenizers split numbers inconsistently — 1234567 might become [123][4567] while 1234568 becomes [12][345][68]. Digit-aligned reasoning (carrying, place value) must operate over misaligned chunks. Modern tokenizers mitigate by forcing digits into groups of at most three (Llama 3, o200k do this), which measurably improved arithmetic — direct evidence the failures were tokenizer-caused. Still: never trust an LLM as a calculator; give it a code tool.</li>
<li><strong>Non-English text:</strong> vocabularies are trained on English-heavy corpora, so other scripts fragment badly. English averages ~4 chars/token; Thai, Khmer, or Amharic text can burn <strong>3x–10x more tokens for the same content</strong>. Consequences compound: higher cost per request, less effective context window, worse quality (the model reasons over shrapnel), and slower generation. A multilingual product has materially different unit economics per language — measure it.</li>
<li><strong>Whitespace and code:</strong> indentation is tokens. Runs of spaces tokenize into dedicated whitespace tokens (cl100k has tokens for common indent widths); tabs vs. spaces changes the sequence entirely. This is one reason code models are sensitive to formatting conventions, and why minified JSON is cheaper to emit than pretty-printed.</li>
<li><strong>The unstable-boundary trap:</strong> string concatenation does not commute with tokenization — tokenize(A + B) is often not tokenize(A) + tokenize(B). If you assemble prompts by splicing token arrays (some caching and fine-tuning pipelines do), you can produce sequences the model never saw in training.</li>
</ul>

<div class="callout war">A team fine-tuned a classifier that keyed on a label vocabulary like "REFUND_ELIGIBLE". In training data the label always followed a colon and space; in production a template change put it at line start — different leading-whitespace context, different tokenization, accuracy fell off a cliff for no visible reason. The diff was literally invisible in logs until someone printed token IDs. Rule: when model behavior changes and the text 'looks identical', diff the tokens, not the strings.</div>

<div class="callout exam">The strawberry question is a stock interview opener, and the pass bar is mechanism, not trivia: 'the model receives token IDs, characters are not present in its input, spelling knowledge is memorized incidentally, so route character-level tasks to code'. Follow-ups probe whether you know digit-grouping exists and why non-English costs more. Answering 'the model is just bad at math' is a fail.</div>

<h3>Practical tokenizer hygiene</h3>
<ul>
<li>Count tokens with the <em>model's own</em> tokenizer — <code>tiktoken</code> for OpenAI models, provider count-tokens endpoints for Claude and Gemini (their tokenizers differ; cross-model estimates can be 15–30 percent off).</li>
<li>Budget per-language, not per-character, for multilingual products.</li>
<li>Never end prompts with trailing whitespace; prefer letting the model produce the leading space.</li>
<li>For structured IDs (SKUs, hashes, UUIDs), expect fragmentation — exact reproduction of long random strings is error-prone, so verify copied identifiers downstream.</li>
</ul>
`
    },
    {
      id: "token-economics",
      title: "Tokens as the billing and capacity unit: real token math",
      html: `
<p>Tokens are the metered unit of the entire LLM economy: you pay per token, you are rate-limited per token, your context window is a token budget, and your latency scales with token counts. An AI engineer who cannot do token arithmetic on a whiteboard cannot estimate whether a feature is a $300/month feature or a $30,000/month feature — and interviewers know it.</p>

<h3>The price sheet shape</h3>
<p>Every provider prices the same way: dollars per million tokens, <strong>input and output priced separately, with output typically 3x–5x input</strong>. Order-of-magnitude anchors as of early 2026 (these drift quarterly; the ratios and reasoning are the durable part):</p>
<table>
<thead><tr><th>Tier</th><th>Examples</th><th>Input / M tokens</th><th>Output / M tokens</th></tr></thead>
<tbody>
<tr><td>Budget</td><td>Gemini Flash-class, GPT mini-class, Claude Haiku-class</td><td>~$0.10–$1</td><td>~$0.40–$5</td></tr>
<tr><td>Mid / flagship</td><td>Claude Sonnet-class, GPT-4o/5-class</td><td>~$2–$3</td><td>~$10–$15</td></tr>
<tr><td>Premium / reasoning-heavy</td><td>Opus-class, o-series pro tiers</td><td>~$5–$15</td><td>~$25–$75</td></tr>
<tr><td>Self-hosted open (Llama, Qwen, Mistral)</td><td>via vLLM on rented GPUs</td><td colspan="2">Your GPU-hours divided by your throughput — cheap only at high utilization</td></tr>
</tbody>
</table>
<p>Two standard discounts change the math materially: <strong>prompt caching</strong> (cached input roughly 10x cheaper on Anthropic/Google, ~2x on OpenAI) and <strong>batch APIs</strong> (~50 percent off for asynchronous, hours-latency processing). Reasoning models add a third dimension: <strong>thinking tokens bill as output</strong>, so an answer that 'costs' 200 visible tokens may bill 5,000.</p>

<h3>Worked example 1: the support assistant</h3>
<p>RAG chatbot, mid-tier model at $3 input / $15 output per million. Per query: system prompt 1,500 tokens + retrieved context 4,000 + history 1,500 + question 200 = <strong>7,200 input</strong>; answer ~400 output. Cost per query: 7,200 × $3/1M + 400 × $15/1M = $0.0216 + $0.006 = <strong>~2.8 cents</strong>. At 100k queries/month: <strong>~$2,760/month</strong>. Now cache the static 1,500-token system prompt (90 percent off): saves ~$0.004/query, ~$400/month. Move to a budget model at $0.30/$1.50 for the easy 70 percent of queries via a router: the blend drops under $1,100/month. This three-line analysis — itemize the prompt, price both directions, then attack the biggest line item — is the whole discipline.</p>

<h3>Worked example 2: the batch classification job</h3>
<p>Classify 5M product reviews (avg 150 tokens) into 20 categories, one-token-ish label out (~10 tokens with schema overhead). Prompt overhead 300 tokens of instructions per call. Input: 5M × 450 = 2.25B tokens; output: 5M × 10 = 50M. On the mid-tier model: 2.25B × $3/1M + 50M × $15/1M = $6,750 + $750 = <strong>$7,500</strong>. On a budget model at $0.10/$0.40: <strong>$245</strong>. Via its batch API: <strong>~$122</strong>. A 60x spread for a task where the cheap model likely matches accuracy — this is why model routing is the highest-leverage cost decision, ahead of any prompt golf.</p>

<div class="callout limits">Capacity numbers to keep loaded (early 2026): context windows — Claude 200k (1M in beta tiers), GPT-4.1-class 1M, Gemini 1M–2M, most open models 128k–256k. Max <em>output</em> is a separate, much smaller limit (typically 4k–64k, reasoning modes higher). Rate limits are quoted in TPM (tokens/minute) and RPM — production tiers range from ~30k TPM (new accounts) to tens of millions (negotiated). A single 200k-token request can eat an entire minute of a small TPM quota: long context and high QPS compete for the same budget.</div>

<h3>Context is a budget, not a feature</h3>
<p>The context window bounds input + output + thinking combined. Practical accounting for an agent: system prompt (2k) + tool definitions (3k) + conversation so far (grows every turn) + retrieved docs (5–50k) + the model's output. Three engineering consequences:</p>
<ul>
<li><strong>Conversation history compounds:</strong> a chat resends the full transcript every turn, so turn N costs O(N) input tokens and a long conversation's cumulative cost is quadratic in turns. Mitigations: summarize old turns, truncate, or lean on prompt caching so the shared prefix is cheap.</li>
<li><strong>Filling the window is not free even when it fits:</strong> prefill latency scales with input length, recall degrades mid-context (lost in the middle), and a 500k-token prompt at $3/M is $1.50 <em>per call</em> before any output.</li>
<li><strong>Retrieval exists because of this budget:</strong> RAG is fundamentally a cost/precision play — send the relevant 5k tokens, not the whole 5M-token corpus, per query.</li>
</ul>

<div class="callout war">The classic bill shock: a team shipped an agent that appended every tool result to history and never pruned. Tool outputs averaged 8k tokens; after 15 turns each request carried 120k+ tokens of stale JSON, and a single user session cost $4. Monthly bill went up 40x in a week with zero traffic growth. Alerting on <strong>tokens per request</strong> (not just requests) and pruning/summarizing tool results are table stakes — treat token telemetry like you treat p99 latency.</div>

<div class="callout exam">Cost-estimation questions are deliberately underspecified in interviews: 'roughly what would it cost to run summarization over our 10M-document archive?' The interviewer wants to watch you ask for the missing parameters (doc length distribution, output length, model tier, batch vs. online), state the arithmetic out loud, and sanity-check the answer against cheaper designs (smaller model, batch API, caching, dedup). Precision matters less than the shape of the reasoning.</div>
`
    },
    {
      id: "sampling",
      title: "Sampling: temperature, top-p, top-k, and the actual shape of the distribution",
      html: `
<p>The model hands you a probability distribution over ~100k+ tokens; <strong>sampling policy</strong> decides what to do with it. These three or four knobs are the only runtime control you have over the generator's behavior, and most engineers set them by folklore. This lesson gives you the real mechanics.</p>

<h3>What the distribution looks like</h3>
<p>After a typical prompt, the distribution is <strong>extremely peaked with a long, thin tail</strong>: often 60–99 percent of the mass sits on the top handful of tokens, followed by thousands of tokens with tiny-but-nonzero probability. Both regions matter. The head carries the model's actual judgment. The tail is where degenerate output comes from — sample long enough and a 0.01 percent token <em>will</em> eventually be drawn, and one bizarre token can derail everything after it (autoregressive commitment again). Every sampling scheme is a policy for harvesting the head while suppressing the tail.</p>

<h3>Temperature: reshaping the distribution</h3>
<p>Temperature divides the logits before softmax: <code>probs = softmax(logits / T)</code>.</p>
<ul>
<li><strong>T → 0:</strong> the distribution collapses toward the argmax — effectively greedy decoding.</li>
<li><strong>T = 1:</strong> the model's learned distribution, untouched.</li>
<li><strong>T above 1:</strong> flattens the distribution, pumping mass into the tail. Useful for brainstorming diversity; past ~1.5 output degrades into word salad because tail tokens get real probability.</li>
</ul>
<p>Key mental model: temperature does not add "creativity" — it <strong>redistributes probability between the head and the tail</strong>. At T=0.7 the model still overwhelmingly picks head tokens; at T=1.3 it visits the tail often enough to surprise you, for better and worse.</p>

<h3>Top-k and top-p: truncating the tail</h3>
<ul>
<li><strong>Top-k:</strong> keep only the k highest-probability tokens, renormalize, sample. Blunt: k=50 is far too many candidates when the model is certain (99 percent on one token) and can be too few when the distribution is genuinely flat (creative openings, many valid continuations).</li>
<li><strong>Top-p (nucleus):</strong> keep the smallest set of tokens whose cumulative probability reaches p (e.g. 0.9), renormalize, sample. <strong>Adaptive</strong> where top-k is static: when the model is confident the nucleus is 1–2 tokens; when uncertain it might be 500. This is why top-p won and is the default truncation everywhere.</li>
<li><strong>min-p</strong> (newer, common in open-source stacks like llama.cpp and vLLM): keep tokens whose probability is at least min_p × the top token's probability. Scales the cutoff to the model's confidence and behaves better than top-p at high temperatures.</li>
</ul>
<p>Order of operations in most stacks: truncate (top-k, then top-p), then apply temperature within the survivors, then sample. Providers differ subtly — one more reason identical settings don't transfer across APIs. Anthropic exposes temperature and top-p/top-k (advising you set temperature <em>or</em> top-p, not both); OpenAI exposes temperature and top-p; Gemini exposes all three.</p>

<div class="callout deep">Why greedy decoding isn't simply 'best': locally optimal tokens produce globally repetitive, degenerate text — the classic failure is loops ('the best of the best of the best'). The 2019 nucleus-sampling paper showed human text consistently contains lower-probability tokens than greedy search produces; natural language <em>is</em> mildly surprising, and pure likelihood-maximization is detectably unnatural. Beam search, standard in machine translation, is worse still for open-ended generation. Repetition penalties (frequency/presence penalties in OpenAI's API, repetition_penalty in open-source servers) exist to patch the loop failure at low temperature.</div>

<h3>Settings by task — with reasons, not folklore</h3>
<table>
<thead><tr><th>Task</th><th>Setting shape</th><th>Why</th></tr></thead>
<tbody>
<tr><td>Extraction, classification, structured output</td><td>T=0 (or 0.1–0.2)</td><td>You want the model's argmax judgment; diversity is pure noise here</td></tr>
<tr><td>Code generation</td><td>T=0–0.4</td><td>Mostly-deterministic; slight warmth avoids repetition loops in comments/naming</td></tr>
<tr><td>Chat / drafting</td><td>T=0.7–1.0, top-p 0.9–0.95</td><td>Natural-sounding variation without tail garbage</td></tr>
<tr><td>Brainstorming, many candidates</td><td>T=1.0–1.3 with min-p or top-p 0.95, n samples</td><td>Deliberately harvest distribution diversity; generate many, select best</td></tr>
<tr><td>Reasoning-model thinking</td><td>Provider-fixed (often T=1 internally)</td><td>Exploration in the scratchpad is a feature; several providers ignore or forbid temperature on reasoning modes</td></tr>
</tbody>
</table>

<div class="callout war">A team A/B-tested prompts for a legal-summarization feature at T=0.9 and drew conclusions from single runs per prompt — their 'winning' prompt was sampling noise. Reran at 20 samples per prompt, the ranking inverted. Rule: at nonzero temperature, any evaluation needs multiple samples per input, and any comparison needs enough runs to beat the variance you deliberately injected. Conversely: don't eval at T=0 if production runs at T=0.8 — you're measuring a different system.</div>

<div class="callout exam">Stock question: 'temperature 0 versus top-p 0.1 — same thing?' No: T→0 collapses <em>selection</em> to argmax regardless of shape; top-p 0.1 truncates to the smallest head with 10 percent cumulative mass but still samples within it at full temperature. On a peaked distribution they coincide; on a flat one they diverge sharply. Explaining that distinction with the head/tail picture is a strong-signal answer.</div>
`
    },
    {
      id: "logprobs-determinism",
      title: "Logprobs, determinism myths, and why temperature 0 still varies",
      html: `
<p>Two practical topics that separate engineers who have shipped LLM systems from those who have read about them: what the API's <strong>logprobs</strong> give you, and why the near-universal belief that "temperature 0 means deterministic" is false in production.</p>

<h3>Logprobs: the confidence signal you already paid for</h3>
<p>Most APIs can return, per emitted token, its log-probability and the top-N alternatives (OpenAI: <code>logprobs</code> with up to 20 alternatives; open-source servers like vLLM expose the same; Anthropic does not expose logprobs on its public API as of early 2026 — a real vendor-selection consideration for some architectures). What they're for:</p>
<ul>
<li><strong>Classification confidence:</strong> when the output schema is a single label token, its probability is a direct, cheap confidence score. exp(-0.02) ≈ 0.98 means near-certainty; exp(-1.2) ≈ 0.30 with a close runner-up means 'route to human review'. This turns a classifier into a <em>calibratable</em> classifier with thresholds — no second model call.</li>
<li><strong>Hallucination smoke detection:</strong> fabricated spans often (not always) ride on lower token probabilities than grounded spans. Perplexity-over-answer is a weak but nearly free signal to flag outputs for verification. It is not a truth detector — models can be confidently wrong (module 1) — treat it as a prior, not a verdict.</li>
<li><strong>Eval scoring:</strong> scoring multiple-choice answers by comparing the logprob of each option is far more sample-efficient than generating and parsing text — this is how most academic benchmarks (MMLU-style) are actually scored against base models.</li>
<li><strong>Debugging prompts:</strong> watching where probability collapses inside a generation shows you exactly which token the model 'struggled' on — often pinpointing the ambiguous instruction.</li>
</ul>

<div class="callout deep">Caveat on calibration: RLHF-tuned chat models are systematically <em>overconfident</em> relative to base models — preference tuning sharpens distributions toward rater-pleasing certainty. Published analyses (including OpenAI's GPT-4 report) showed calibration measurably degrading through post-training. Logprob thresholds must be calibrated per model version against your own labeled data, and recalibrated on version bumps.</div>

<h3>The determinism myth</h3>
<p>Set temperature to 0 and run the same prompt 500 times against a production API: you will get multiple distinct outputs. Engineers file this as a bug; it is a stack of real causes worth knowing individually:</p>
<ol>
<li><strong>Floating-point non-associativity + parallelism:</strong> (a+b)+c ≠ a+(b+c) in floating point. GPU kernels sum in whatever order the parallel reduction schedules, which varies with batch composition, kernel selection, and hardware. Tiny logit differences usually don't matter — until two top tokens are nearly tied, and the argmax flips. One flipped token, then autoregressive divergence does the rest.</li>
<li><strong>Batching effects:</strong> your request is dynamically batched with strangers' traffic; batch size changes which kernels run and how reductions order. Same prompt, different co-tenants, occasionally different token. (Recent inference-engine work — e.g. batch-invariant kernels, an active topic in 2025 — targets exactly this; vLLM has modes reducing it. It costs throughput, so public APIs generally don't promise it.)</li>
<li><strong>MoE routing:</strong> in mixture-of-experts models, expert routing decisions can interact with batching and capacity limits, adding another nondeterminism source at the architecture level.</li>
<li><strong>Fleet heterogeneity and silent updates:</strong> different GPU generations produce different numerics; providers also re-quantize, patch kernels, or shift traffic between deployments without notice. 'Same model string' does not mean 'same numerical function'.</li>
<li><strong>Ties and seeds:</strong> even where a seed parameter exists (OpenAI offers one plus a system_fingerprint), it is documented as best-effort, and fingerprint changes void comparability.</li>
</ol>
<p>Self-hosting gets you further: fixed hardware, fixed batch size of 1, greedy decoding, pinned weights and kernels can achieve practical determinism — at real throughput cost. Across a provider API, <strong>assume statistical stability, never bitwise reproducibility</strong>.</p>

<div class="callout war">A team built regression tests asserting byte-exact model outputs at T=0. Green for two weeks, then 3 a.m. flakes — no deploy on their side; the provider had shifted traffic across hardware. They burned days bisecting their own code. The durable fix: semantic assertions (parse the JSON and check fields; embed and compare; grade with a judge model) with tolerance, not string equality. Byte-exact snapshot testing of a remote LLM is a category error.</div>

<div class="callout exam">'Why did temperature 0 give two different answers?' is a favorite because folklore says it can't happen. The strong answer names at least: floating-point non-associativity under variable batching, near-tied logits flipping argmax, then autoregressive divergence amplifying one token into a different completion — plus the operational conclusion (semantic, tolerance-based testing; pin versions; log fingerprints). Bonus: mention that greedy-decoding determinism is achievable self-hosted with batch-invariant kernels, showing you know where the boundary actually is.</div>

<h3>Engineering with nondeterminism</h3>
<ul>
<li>Evals: report pass rates over multiple runs, not single-run pass/fail; treat sub-percent metric moves as noise until proven otherwise.</li>
<li>Caching: if identical requests must give identical answers (support macros, legal text), cache your own outputs keyed on the prompt — determinism by memoization is the only guaranteed kind.</li>
<li>Debugging: capture full request payloads and system fingerprints with every logged output, or reproduction is hopeless.</li>
</ul>
`
    },
    {
      id: "decoding-control",
      title: "Practical decoding control: stop sequences, max tokens, and structured output",
      html: `
<p>Everything so far described the generator; this lesson is about <strong>ending it and constraining it</strong> — the unglamorous controls that decide whether an LLM is a dependable software component or a flaky text hose. Three tools: stop conditions, token limits, and grammar-constrained decoding.</p>

<h3>Stop sequences: cheap, underused</h3>
<p>A stop sequence is a string that halts generation the moment it appears (and is excluded from, or trimmed after, the output depending on provider). Providers allow a handful (OpenAI: up to 4; Anthropic: stop_sequences list). Uses that matter:</p>
<ul>
<li><strong>Ending list/item generation:</strong> generating one item of a delimited format? Stop on the delimiter. The model never gets the chance to ramble.</li>
<li><strong>Agent frameworks:</strong> classic ReAct loops stop on "Observation:" so the model cannot hallucinate a tool result — the framework injects the real one. Forgetting this stop is a canonical agent bug: the model happily fabricates the observation and keeps going, and everything downstream is fiction.</li>
<li><strong>Cost control:</strong> a stop hit ends billing immediately; a model that would have added three paragraphs of caveats doesn't.</li>
</ul>
<p>Also know why generation ends without your stops: the model emits a special <strong>end-of-turn token</strong> (learned in SFT — e.g. Llama 3's end-of-turn marker), hits max_tokens, or hits a provider limit. Check the finish reason on every response: "stop" (natural or stop sequence) vs. "length" (truncated) is a signal your code must branch on.</p>

<h3>max_tokens: a guillotine, not a target</h3>
<p>max_tokens caps <em>output</em>; it does not tell the model to be brief. The model has no awareness of the limit — it plans nothing around it; generation is simply cut mid-token-stream when the budget exhausts. Consequences:</p>
<ul>
<li><strong>Truncated JSON:</strong> the number-one structured-output failure in production is not model error — it is max_tokens guillotining the closing braces. Always check finish reason before parsing; treat "length" as a retryable error with a raised cap.</li>
<li><strong>Brevity belongs in the prompt</strong> (or in post-training): 'answer in under 50 words' shapes the distribution; max_tokens just amputates.</li>
<li><strong>Reasoning models complicate budgeting:</strong> thinking tokens spend from the same output budget on several APIs — a tight max_tokens can starve the model mid-thought and yield an empty or truncated visible answer. Anthropic's extended thinking and OpenAI's reasoning effort settings expose separate budget controls; as of early 2026 you must budget visible + thinking output explicitly.</li>
<li><strong>Latency planning:</strong> output tokens arrive serially at roughly 30–200 tokens/second depending on model and load, so max_tokens is also your worst-case latency bound: a 4k cap at 60 tok/s means a possible 65-second stream. Set caps from product latency budgets, not superstition.</li>
</ul>

<h3>Structured output: from 'please return JSON' to grammar enforcement</h3>
<p>The eras, in increasing reliability:</p>
<ol>
<li><strong>Prompt-and-pray:</strong> 'Respond with valid JSON.' Works ~95–99 percent of the time, which at 1M requests/month is 10k–50k parse failures. Markdown fences around the JSON, apologetic preambles, and trailing commentary are the classic contaminants.</li>
<li><strong>JSON mode:</strong> provider flag guaranteeing syntactically valid JSON — but not <em>your schema</em>: fields can be missing, renamed, or mistyped.</li>
<li><strong>Constrained decoding / structured outputs:</strong> the schema is compiled into a grammar; at every step the engine <strong>masks all tokens that would violate it</strong>, renormalizes over the legal set, and samples. Invalid output becomes impossible by construction, not unlikely. OpenAI Structured Outputs (strict JSON Schema), Gemini responseSchema, and open-source engines (vLLM structured output, Outlines, llama.cpp GBNF grammars — which generalize beyond JSON to any context-free grammar: SQL dialects, DSLs) all work this way. Anthropic long favored the tool-use path — schema-validated tool input — adding first-class structured-output support later; tool-input schemas remain a portable pattern across all vendors.</li>
</ol>

<div class="callout deep">How constraint interacts with sampling: masking is applied to the logits <em>before</em> sampling, so temperature and top-p operate over only the grammar-legal tokens. Subtlety worth knowing: forcing the model down low-probability grammatical paths can hurt content quality — the model 'wanted' to phrase something its way and the grammar forbade it; token-boundary misalignment between the grammar and BPE merges is a real implementation headache (the classic greedy-masking pitfall where a legal string is unreachable because its first token was masked). Well-designed schemas that match natural output shapes (and field descriptions in the schema, which act as embedded prompts) mitigate this. Also: schema does not equal truth — the JSON will be valid; the values can still be wrong.</div>

<div class="callout war">A production extraction pipeline enforced an enum field of 20 categories via strict schema. Quality team later found a cluster of nonsense classifications: inputs that fit no category. The grammar made 'none of the above' <em>unrepresentable</em>, so the sampler was forced to pick some enum value — constrained decoding turned an abstention problem into silent misclassification. Fix: add an explicit OTHER/UNKNOWN variant to every enum and a confidence field. Schemas encode your abstention policy whether you meant them to or not.</div>

<div class="callout exam">Design-round staple: 'your service must return schema-valid JSON at 99.99 percent — walk me through it.' The strong answer stacks layers: strict structured outputs / grammar-constrained decoding as the base; finish-reason check for length truncation with a retry-at-higher-cap policy; server-side schema validation as a tripwire (belt and suspenders — provider bugs happen); explicit UNKNOWN variants so abstention is representable; and semantic validation of values downstream because syntactic validity is not correctness. Naming the enum-forcing failure mode is the differentiator that reads as scar tissue rather than documentation.</div>

<h3>The composed picture</h3>
<p>A production request is all five lessons at once: a tokenizer turns your carefully budgeted prompt into IDs (lesson 1) whose count you priced (lesson 2); the sampler harvests the distribution's head under your temperature/top-p policy (lesson 3), with variance you've planned for (lesson 4), inside a grammar mask, until a stop condition or token budget ends it (this lesson). Master these interfaces and the model becomes what it should be in your architecture: a component with known units, known variance, and enforceable contracts.</p>
`
    }
  ],
  quiz: [
    {
      q: "A user asks your assistant how many times the letter R appears in the word strawberry, and it confidently answers two. What is the root cause, and what is the robust fix for character-level tasks?",
      options: [
        "The model's training data contained misspellings; fine-tune on a spelling corpus",
        "The model receives token IDs, not characters, so letters are not present in its input; route such tasks to code execution or pre-split the characters",
        "The temperature was too high, causing the count to vary randomly",
        "The context window truncated the word before the model saw it"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: characters are not in the input.</strong> BPE hands the model something like [st][raw][berry] — the letter R exists only implicitly inside token identities, and per-token spelling knowledge is memorized incidentally and unreliably. The robust fix changes the representation: have the model write and run counting code, or split the string into characters (each becoming a visible token) before asking.</p><p><strong>Fine-tuning on spelling</strong> attacks the wrong layer — the input representation still hides characters, so gains are brittle memorization. <strong>Temperature</strong> affects sampling variance, not the systematic representational blindness; the error persists at T=0. <strong>Context truncation</strong> is irrelevant for a 10-character word.</p>"
    },
    {
      q: "Your multilingual product launches in Thailand and support costs per conversation triple versus the English deployment, with identical conversation lengths in characters. What explains this?",
      options: [
        "Thai users write longer messages on average",
        "The provider charges a per-language surcharge for non-Latin scripts",
        "English-heavy BPE vocabularies fragment Thai text into 3x or more tokens per character, raising cost, shrinking effective context, and slowing generation",
        "Thai requires a larger model tier to process"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>Correct: tokenizer fragmentation.</strong> BPE merges are learned from a mostly-English corpus, so English averages roughly 4 characters per token while under-represented scripts like Thai shatter into small fragments — commonly 3x–10x more tokens for the same content. Billing is per token, so identical character counts produce multiplied costs, plus reduced effective context and slower output.</p><p><strong>Longer messages</strong> is excluded by the premise (identical character lengths). <strong>Per-language surcharges</strong> don't exist — pricing is per token, which is precisely the mechanism, just not a surcharge. <strong>Larger model tier</strong> is wrong — the same model processes Thai; nothing forces an upgrade, it just meters more units.</p>"
    },
    {
      q: "You must classify 2 million short documents (400 input tokens each including instructions, 10 output tokens) with no urgency. Mid-tier model: $3 per million input, $15 per million output. Budget model: $0.10 and $0.40, with a batch API at half price. Roughly what does each approach cost?",
      options: [
        "Mid-tier about $2,700; budget batch about $42",
        "Mid-tier about $270; budget batch about $4",
        "Mid-tier about $27,000; budget batch about $420",
        "Both cost about the same because output dominates"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>Correct: ~$2,700 vs ~$42.</strong> Input: 2M × 400 = 800M tokens. Output: 2M × 10 = 20M tokens. Mid-tier: 800M × $3/1M = $2,400 plus 20M × $15/1M = $300, totaling $2,700. Budget: 800M × $0.10/1M = $80 plus 20M × $0.40/1M = $8, totaling $88; batch halves it to ~$44 — call it ~$42–44. A roughly 60x spread on a task a budget model likely handles equally well, which is why routing beats prompt-golf for cost control.</p><p>The <strong>$270/$4</strong> and <strong>$27,000/$420</strong> options are order-of-magnitude slips — the classic per-million arithmetic error. <strong>Output dominating</strong> is backwards here: output is 10 tokens vs 400 input, so input dominates despite its lower unit price.</p>"
    },
    {
      q: "A chat product resends full conversation history each turn. Users average 30-turn sessions, and finance flags that cost per session is growing far faster than turns. What is the mechanism, and which two mitigations directly address it? (Select 2)",
      options: [
        "Cost per turn is constant; finance is misreading the bill",
        "Turn N resends all prior turns, so cumulative session cost grows roughly quadratically; summarize or truncate old history",
        "Enable prompt caching so the shared conversation prefix bills at the cached-input discount",
        "Raise max_tokens so the model finishes conversations in fewer turns",
        "Switch to greedy decoding to reduce token usage"
      ],
      answer: [1, 2],
      multi: true,
      explanation: "<p><strong>Correct: quadratic history growth, mitigated by pruning/summarizing and by prompt caching.</strong> Each turn's request includes the whole transcript, so input tokens at turn N scale with N and session cost scales with N squared. Summarizing or truncating old turns caps the resent payload; prompt caching makes the ever-growing shared prefix bill at roughly 10x less (Anthropic/Google) since it's identical across turns.</p><p><strong>Constant cost per turn</strong> is exactly what resending history violates. <strong>Raising max_tokens</strong> caps output length and does nothing about resent input — if anything it permits more output spend. <strong>Greedy decoding</strong> changes token selection, not token count billed; sampling strategy is cost-neutral.</p>"
    },
    {
      q: "For a compliance-report generator you need natural-sounding prose but absolutely no bizarre token choices, and the model is often highly confident. A colleague proposes top-k with k fixed at 40. What is the strongest argument for top-p (nucleus) sampling instead?",
      options: [
        "Top-p is faster to compute than top-k at inference time",
        "Top-p adapts the candidate set to the distribution: 1-2 tokens when the model is confident, wider when it is genuinely uncertain, while k=40 keeps 38 junk candidates on peaked distributions",
        "Top-k is deprecated in all major APIs",
        "Top-p guarantees deterministic output at any temperature"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: adaptivity.</strong> LLM next-token distributions swing between extremely peaked (99 percent on one token) and genuinely flat (many valid continuations). A fixed k=40 keeps dozens of tail tokens alive precisely when the model is most certain — the worst time to admit junk — and may be too narrow at flat moments. Nucleus sampling sizes the candidate set by cumulative mass, matching the model's own confidence.</p><p><strong>Speed</strong> is a non-issue — both are trivial operations on sorted logits. <strong>Deprecated</strong> is false; Gemini and most open-source servers expose top-k today. <strong>Determinism</strong> is false — top-p still samples within the nucleus; only argmax selection (T→0) approaches determinism, and even that has caveats.</p>"
    },
    {
      q: "You run the same prompt at temperature 0 against a provider API 500 times and get three distinct completions. Which explanation chain is accurate?",
      options: [
        "Temperature 0 still samples from the top 5 tokens by design",
        "Floating-point reductions vary with dynamic batching and hardware, occasionally flipping near-tied argmax choices, after which autoregressive conditioning diverges the rest of the completion",
        "The provider intentionally injects randomness to prevent output copyright claims",
        "The tokenizer is nondeterministic, producing different input IDs each time"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: numerics + batching + tie-flips + divergence.</strong> Floating-point addition is non-associative; GPU kernel reduction order shifts with batch composition, kernel selection, and hardware generation, perturbing logits by tiny amounts. Usually irrelevant — but when the top two tokens are nearly tied, argmax flips. One different token then conditions everything after it, so a single flip becomes a visibly different completion. MoE routing and silent fleet changes add further sources.</p><p><strong>Sampling top-5 at T=0</strong> is false — T→0 is argmax selection. <strong>Intentional randomness for copyright</strong> is folklore with no basis. <strong>Nondeterministic tokenization</strong> is false — BPE encoding of identical text is deterministic; the variance arises in the forward pass, not preprocessing.</p>"
    },
    {
      q: "You want cheap per-prediction confidence scores for an LLM ticket classifier that outputs one label token. Which approach uses the API most effectively?",
      options: [
        "Ask the model to append a confidence percentage to its answer and parse it",
        "Request logprobs and use the emitted label token's probability, calibrating thresholds against your own labeled data per model version",
        "Run the classification five times and count agreement, since logprobs are never exposed by any provider",
        "Use temperature as the confidence score, since higher temperature means lower confidence"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: logprob of the label token, calibrated on your data.</strong> When output is a single label, its token probability is a direct confidence signal at zero extra cost — exp of the logprob gives a score you can threshold for human-review routing. Because RLHF models are systematically overconfident and calibration shifts across versions, thresholds must be fit to your labeled data and refit on model bumps.</p><p><strong>Self-reported confidence</strong> is generated text, poorly calibrated, and pure token cost. <strong>Five-run agreement</strong> works as a fallback (and is needed on providers that don't expose logprobs, like Anthropic's public API as of early 2026) but costs 5x — and the stated premise 'never exposed by any provider' is false (OpenAI, vLLM expose them). <strong>Temperature as confidence</strong> confuses a knob you set with a quantity the model reports — it carries zero information about this input.</p>"
    },
    {
      q: "Your ReAct-style agent occasionally reports tool results for tools that were never actually called, and acts on them. Which decoding control most directly prevents this class of bug?",
      options: [
        "Lower the temperature so the model is less creative about tool results",
        "Add a stop sequence on the observation marker so generation halts before the model can write a tool result, letting the framework inject the real one",
        "Raise max_tokens so the model has room to call the tool properly",
        "Use JSON mode so tool results are well-formed"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: stop on the observation marker.</strong> In a ReAct loop the model writes thought and action, and the framework must execute the tool and inject the observation. If generation is allowed to continue, the statistically natural next text after an action is an observation — so the model fabricates one, and the loop proceeds on fiction. Stopping at the marker makes fabrication structurally impossible: the model never gets to write that span.</p><p><strong>Lower temperature</strong> reduces variance but a fabricated observation can be the argmax continuation — it persists at T=0. <strong>More max_tokens</strong> gives more room to fabricate, not less. <strong>JSON mode</strong> makes fabricated results syntactically valid — arguably worse, since well-formed fiction parses cleanly and flows downstream.</p>"
    },
    {
      q: "Production alert: 0.7 percent of your structured-extraction responses fail JSON parsing, and failures correlate with long input documents. The most likely culprit and first fix is which of these?",
      options: [
        "The model forgets JSON syntax on long inputs; switch to XML",
        "max_tokens is truncating output mid-JSON; check for a length finish reason before parsing and retry those with a raised cap",
        "Temperature is too low for long documents; raise it to 1.0",
        "The tokenizer corrupts JSON braces in long sequences"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: length truncation.</strong> Long inputs produce long extractions; when output hits max_tokens the stream is guillotined mid-structure — unclosed braces, cut strings — and parsing fails. The correlation with document length is the tell. The fix is procedural: branch on the finish reason (stop vs length) before parsing, treat length as retryable with a higher cap or chunked extraction. Grammar-constrained decoding cannot save you here — truncation happens at the budget layer above the grammar.</p><p><strong>Forgetting syntax / switch to XML</strong> misreads the failure; XML truncates just as fatally. <strong>Raising temperature</strong> adds variance and if anything more tokens of chatter. <strong>Tokenizer corruption</strong> is not a real phenomenon — encoding is deterministic and lossless over text.</p>"
    },
    {
      q: "You enforce a strict 20-value enum via constrained decoding for document categorization. Weeks later, audits find inputs that fit no category have been silently assigned plausible-looking labels. What happened, and what is the fix?",
      options: [
        "The model was undertrained on rare categories; fine-tune with more examples",
        "The grammar made abstention unrepresentable, so the sampler was forced to emit some legal enum value; add an explicit UNKNOWN variant and a confidence field",
        "Constrained decoding is buggy; fall back to prompt-and-pray JSON",
        "The enum exceeded the maximum schema size, causing overflow into wrong labels"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the schema encoded a no-abstention policy.</strong> Constrained decoding masks every token that would violate the grammar and renormalizes over the survivors — so when no category fits, 'none of the above' has zero legal encoding and the model must pick one of the 20. Probability that would have gone to 'this doesn't fit' is redistributed over wrong-but-legal answers. Fix: make abstention representable (OTHER/UNKNOWN variant) and expose a confidence field so downstream can route low-confidence cases to review.</p><p><strong>More fine-tuning</strong> can't help — no amount of training makes an unrepresentable output emittable under the mask. <strong>Falling back to unconstrained JSON</strong> trades a bounded failure for parse failures and schema drift. <strong>Schema size overflow</strong> is fictional — 20-value enums are trivially small.</p>"
    },
    {
      q: "Which two statements about tokenizer behavior are true and have direct production consequences? (Select 2)",
      options: [
        "Tokenizing the concatenation of two strings can differ from concatenating their separate tokenizations, so splicing token arrays can create sequences the model never saw in training",
        "A prompt ending with a trailing space can degrade completion quality because the space that would begin the next token has been consumed by the prompt",
        "Tokenizers normalize all whitespace, so indentation never affects code generation",
        "All major providers share one universal tokenizer, so token counts transfer exactly across vendors",
        "BPE produces out-of-vocabulary errors on emoji and rare Unicode"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>Correct: non-compositional tokenization and the trailing-space trap.</strong> BPE greedily merges across the text it is given, so tokenize(A + B) frequently differs from tokenize(A) + tokenize(B) — pipelines that splice cached token arrays can construct off-distribution sequences. And because leading spaces belong to word tokens (' word' is one token), a prompt ending in a space forces the continuation into rare tokenization territory, measurably degrading quality.</p><p><strong>Whitespace normalization</strong> is false — indentation tokenizes distinctly (dedicated indent-run tokens exist) and materially affects code models. <strong>Universal tokenizer</strong> is false — cl100k/o200k, Llama's 128k, and Gemma's 256k vocabularies differ; cross-vendor count estimates can be off 15–30 percent. <strong>OOV errors</strong> are impossible in byte-level BPE — the 256 byte tokens represent anything, just inefficiently.</p>"
    },
    {
      q: "Your eval suite compares two prompts by running each once per test case at temperature 0.9 and picking the higher scorer. Why is this methodology broken, and what fixes it?",
      options: [
        "Nothing is broken; temperature 0.9 is the recommended eval setting",
        "Single samples at high temperature measure sampling noise as much as prompt quality; run multiple samples per case and compare distributions, at the temperature production actually uses",
        "Temperature must always be 0 for evals, even if production runs at 0.9",
        "Prompts cannot be compared quantitatively; only human review is valid"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: you injected variance, then measured once.</strong> At T=0.9 each run draws from a deliberately widened distribution; a single sample per case makes the comparison substantially a coin flip, and rankings routinely invert on rerun. Sound methodology: multiple samples per test case, compare pass-rate distributions with enough runs to beat the injected variance — and evaluate at the production temperature, because that is the system you are shipping.</p><p><strong>Nothing broken</strong> ignores basic variance. <strong>Always eval at T=0</strong> fixes the noise by measuring a different system than production — argmax behavior can differ meaningfully from sampled behavior. <strong>Only human review</strong> is a false dichotomy; quantitative comparison is fine once sample sizes respect the variance.</p>"
    },
    {
      q: "A teammate sets max_tokens to 100 to force the model to write concise summaries. What misunderstanding does this reveal, and what is the correct approach?",
      options: [
        "None; max_tokens is the standard way to control style and length",
        "The model has no awareness of max_tokens and plans nothing around it — the output is simply amputated at 100 tokens; request brevity in the prompt and keep max_tokens as a safety cap above the expected length",
        "max_tokens only applies to input, so the setting does nothing",
        "The correct value is 100 words, not 100 tokens, so the limit should be about 75"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: a guillotine, not a target.</strong> max_tokens is invisible to the model — the distribution over continuations is unchanged, and generation is cut mid-sentence when the budget exhausts, yielding truncated output with a length finish reason. Brevity is a property of the text distribution and belongs in the prompt ('summarize in 2-3 sentences'), with max_tokens set comfortably above the expected length as a cost/latency backstop.</p><p><strong>Standard way to control style</strong> is exactly the misunderstanding. <strong>Input-only</strong> is false — max_tokens governs output; context limits govern input+output. <strong>Words vs tokens conversion</strong> misses the point — converting the wrong mechanism's units still amputates rather than instructs (though yes, ~75 words is ~100 tokens).</p>"
    }
  ],
  flashcards: [
    { front: "How does byte-level BPE guarantee zero out-of-vocabulary failures?", back: "<p>It starts from <strong>256 byte tokens</strong> — any text, emoji, or binary is representable — then greedily merges frequent adjacent pairs into larger tokens up to the vocab size. Rare strings just fragment inefficiently.</p>" },
    { front: "Rule-of-thumb token math for English prose", back: "<p><strong>1 token ≈ 4 characters ≈ 0.75 words</strong> — 100 tokens per ~75 words. Only valid for English; other scripts fragment far worse.</p>" },
    { front: "Why can't LLMs reliably count letters in a word?", back: "<p>They receive <strong>token IDs, not characters</strong> — 'strawberry' arrives as ~3 opaque chunks. Spelling of each token is memorized incidentally. Fix: route character tasks to code, or pre-split into characters.</p>" },
    { front: "Why do modern tokenizers force digits into groups of at most 3?", back: "<p>Uncontrolled BPE splits numbers inconsistently ([123][4567] vs [12][345][68]), breaking digit alignment for arithmetic. Llama 3 and o200k group digits, which <strong>measurably improved arithmetic</strong> — proof the failure was tokenizer-caused.</p>" },
    { front: "Cost impact of tokenization on non-English languages", back: "<p>English-heavy vocabularies fragment other scripts: Thai/Khmer/Amharic can cost <strong>3x-10x more tokens per character</strong> — higher bills, smaller effective context, slower generation. Budget per-language.</p>" },
    { front: "The trailing-space prompt bug", back: "<p>Leading spaces belong to word tokens (' word' is one token). A prompt ending in a space consumes the continuation's leading space, forcing a <strong>rare tokenization path</strong> and degrading completion quality.</p>" },
    { front: "Typical input/output price ratio, and two standard discounts", back: "<p>Output tokens cost <strong>3x-5x input</strong>. Discounts: <strong>prompt caching</strong> (~10x cheaper cached input on Anthropic/Google, ~2x OpenAI) and <strong>batch APIs</strong> (~50% off for async processing).</p>" },
    { front: "Why does chat conversation cost grow quadratically with turns?", back: "<p>Each turn resends the full transcript, so turn N carries O(N) input tokens and the session total is O(N squared). Mitigate: summarize/truncate history, lean on prompt caching for the shared prefix.</p>" },
    { front: "Context window vs. max output tokens", back: "<p>Context window bounds <strong>input + output + thinking combined</strong> (200k-2M on frontier models, early 2026); max output is a separate, much smaller cap (typically 4k-64k). Thinking tokens spend from the output budget on several APIs.</p>" },
    { front: "What does temperature actually do to the distribution?", back: "<p>Divides logits before softmax: T→0 collapses to argmax; T=1 is the learned distribution; T above 1 flattens it, moving mass into the tail. It <strong>redistributes head-vs-tail probability</strong> — it does not add 'creativity'.</p>" },
    { front: "Top-p vs. top-k in one sentence each", back: "<p><strong>Top-k:</strong> keep a fixed k candidates — static, keeps junk when the model is confident. <strong>Top-p:</strong> keep the smallest set reaching cumulative probability p — <strong>adapts</strong> from 1-2 tokens (confident) to hundreds (uncertain), which is why it won.</p>" },
    { front: "Why is pure greedy decoding bad for open-ended text?", back: "<p>Locally-optimal tokens yield globally degenerate, repetitive text (loops). Human text consistently contains lower-probability tokens than greedy search produces — natural language is mildly surprising. Repetition penalties patch the loop failure.</p>" },
    { front: "Four real causes of nondeterminism at temperature 0 on provider APIs", back: "<p>1) Floating-point non-associativity under varying <strong>batch composition</strong>. 2) Near-tied logits flipping argmax, then autoregressive divergence. 3) <strong>MoE routing</strong> interactions. 4) Fleet heterogeneity and silent provider updates. Assume statistical stability, never bitwise reproducibility.</p>" },
    { front: "Three production uses of logprobs", back: "<p>1) <strong>Label-token probability as confidence</strong> for routing to human review. 2) Low-probability spans as a cheap hallucination smoke signal. 3) Multiple-choice eval scoring by comparing option logprobs. Caveat: RLHF models are overconfident — calibrate per version. (Anthropic's public API doesn't expose logprobs as of early 2026.)</p>" },
    { front: "Why do agent frameworks set a stop sequence on the observation marker?", back: "<p>Without it, the model <strong>fabricates the tool result</strong> — an observation is the natural next text after an action — and the loop proceeds on fiction. Stopping there lets the framework inject the real result. Persists even at T=0.</p>" },
    { front: "What finish reasons must production code branch on?", back: "<p><strong>stop</strong> (natural end-of-turn token or stop sequence) vs. <strong>length</strong> (max_tokens guillotine). Parsing JSON without checking for length truncation is the #1 structured-output failure. Treat length as retryable with a raised cap.</p>" },
    { front: "How does grammar-constrained decoding guarantee valid output?", back: "<p>The schema compiles to a grammar; at each step <strong>all grammar-violating tokens are masked</strong>, the rest renormalized, then sampled. Invalid syntax becomes impossible by construction. Valid syntax still does not mean correct values.</p>" },
    { front: "The enum-forcing failure of strict schemas", back: "<p>A strict enum with no escape makes abstention <strong>unrepresentable</strong> — inputs fitting no category get silently forced into a plausible wrong label. Always include an OTHER/UNKNOWN variant and a confidence field.</p>" },
    { front: "JSON mode vs. structured outputs", back: "<p><strong>JSON mode:</strong> guarantees syntactically valid JSON only — fields can be missing or mistyped. <strong>Structured outputs / constrained decoding:</strong> enforces <em>your schema</em> token-by-token (OpenAI strict mode, Gemini responseSchema, vLLM/Outlines/GBNF).</p>" },
    { front: "Why must evals run multiple samples at production temperature?", back: "<p>Nonzero temperature deliberately injects variance — single-run comparisons measure noise, and rankings invert on rerun. Eval at T=0 while shipping T=0.8 measures <strong>a different system</strong>. Sample enough to beat the variance you injected.</p>" }
  ],
  lab: {
    title: "Lab: tokens and sampling, measured not believed",
    html: `
<p><strong>Goal:</strong> verify this module's claims with your own eyes — token counts across languages and formats, the head/tail shape of a real next-token distribution, and temperature-0 behavior. All local and free.</p>

<h3>Setup</h3>
<pre><code>python3 -m venv tok-lab &amp;&amp; . tok-lab/bin/activate
pip install tiktoken torch transformers --index-url https://download.pytorch.org/whl/cpu
pip install tiktoken transformers</code></pre>

<h3>Step 1 — tokenizer forensics with tiktoken</h3>
<pre><code>import tiktoken
enc = tiktoken.get_encoding("o200k_base")

samples = {
  "english":  "The quarterly report shows revenue growth of twelve percent.",
  "thai":     "รายงานรายไตรมาสแสดงการเติบโต",
  "number":   "1234567 + 7654321 = 8888888",
  "json_min": '{"a":1,"b":[2,3]}',
  "json_pp":  '{\\n    "a": 1,\\n    "b": [2, 3]\\n}',
  "uuid":     "550e8400-e29b-41d4-a716-446655440000",
}
for name, s in samples.items():
    ids = enc.encode(s)
    print(name, len(s), "chars ->", len(ids), "tokens:", [enc.decode([i]) for i in ids][:12])</code></pre>
<p><strong>Observe:</strong> chars-per-token ratio for English (~4) vs Thai (often near 1); digits arriving in groups of at most 3; pretty-printed JSON costing more than minified; the UUID shattering into fragments. Then verify the concatenation trap: compare <code>enc.encode("hel" ) + enc.encode("lo world")</code> against <code>enc.encode("hello world")</code> — different IDs for identical text.</p>

<h3>Step 2 — price a feature</h3>
<p>Take a real prompt from your work (or invent a RAG prompt: instructions + a pasted doc + a question). Count its tokens, assume a 400-token answer, and compute monthly cost at 100k requests for a $3/$15-per-million model and a $0.10/$0.40 model. Write the two numbers down — the point is feeling the spread, not the spreadsheet.</p>

<h3>Step 3 — see the head and the tail</h3>
<pre><code>import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
name = "Qwen/Qwen2.5-0.5B"
tok = AutoTokenizer.from_pretrained(name)
model = AutoModelForCausalLM.from_pretrained(name)

ids = tok("The capital of France is", return_tensors="pt").input_ids
with torch.no_grad():
    probs = torch.softmax(model(ids).logits[0, -1], dim=-1)
sorted_p = torch.sort(probs, descending=True).values
print("top-1 mass:", round(sorted_p[0].item(), 4))
print("top-10 cumulative:", round(sorted_p[:10].sum().item(), 4))
print("tokens needed for 90% mass:", int((torch.cumsum(sorted_p, 0) &lt; 0.9).sum()) + 1)
print("tokens needed for 99% mass:", int((torch.cumsum(sorted_p, 0) &lt; 0.99).sum()) + 1)</code></pre>
<p><strong>Observe:</strong> the nucleus for 90 percent might be a handful of tokens here. Now repeat with the prompt "Once upon a time," — a genuinely open continuation — and watch the 90 percent nucleus balloon. This is exactly why adaptive top-p beats fixed top-k. Then rescale with temperature: recompute with <code>logits / 1.5</code> and <code>logits / 0.5</code> before softmax and watch mass migrate between head and tail.</p>

<h3>Step 4 — greedy sampling and repetition</h3>
<p>Generate 120 tokens greedily (<code>do_sample=False</code>) from "The best thing about living in a city is" and look for repetition or loops; then sample the same prompt 5 times with <code>do_sample=True, temperature=0.8, top_p=0.9</code> and compare variety. Note: locally, with fixed batch and hardware, greedy runs ARE reproducible — rerun to confirm — which demonstrates that provider-side T=0 variance comes from serving infrastructure (batching, fleet numerics), not from the algorithm itself.</p>

<h3>Verify</h3>
<ul>
<li>You measured at least a 2x chars-per-token difference between English and a non-Latin script.</li>
<li>You found a prompt whose 90 percent nucleus is under 5 tokens and one where it exceeds 100.</li>
<li>You can state from your Step 2 numbers whether input or output dominates your feature's cost.</li>
</ul>

<h3>Teardown</h3>
<p>All local; teardown reclaims the ~2 GB of cached model weights and the venv.</p>
<pre><code>deactivate
rm -rf tok-lab
rm -rf ~/.cache/huggingface/hub/models--Qwen*</code></pre>
`
  }
});
