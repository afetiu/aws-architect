/* Module 01 — How LLMs Actually Work (AI Engineer, core track) */
window.COURSE.register({
  id: "how-llms-work",
  order: 1,
  track: "core",
  title: "How LLMs Actually Work",
  description: "The mental model that makes everything else in AI engineering predictable: next-token prediction and why it looks like reasoning; the transformer's attention and residual stream; the pretraining/SFT/RLHF pipeline and what each stage actually buys; why hallucination is structural rather than a bug; and what scaling laws and test-time compute change about how you should think about model capability.",
  examWeight: "Interview loops for AI engineering roles almost always open here: expect 'explain how an LLM generates text to a skeptical staff engineer', 'why do models hallucinate', and 'what does RLHF actually change'. Weak mechanistic answers are the fastest screen-out; strong ones let you reason credibly about every downstream design question.",
  lessons: [
    {
      id: "next-token-prediction",
      title: "Next-token prediction, and why it produces apparent reasoning",
      html: `
<p>Strip away every product layer and an LLM is one function: given a sequence of tokens, output a <strong>probability distribution over the next token</strong>. That is the entire runtime contract. Chat, tool use, code generation, "reasoning" — all of it is this function called in a loop: sample a token from the distribution, append it to the sequence, call the function again. There is no planner module, no symbolic engine, no database lookup step. If you hold onto that one fact, most LLM behavior that looks mysterious becomes predictable.</p>

<h3>The loop, concretely</h3>
<pre><code>context = tokenize(prompt)
while not done:
    logits = model(context)          # one forward pass, ~all the FLOPs
    probs  = softmax(logits / T)     # distribution over ~100k-token vocab
    next   = sample(probs)           # greedy, top-p, etc. — lesson in module 2
    context.append(next)
    done = (next == stop) or len(context) == max_tokens</code></pre>
<p>Two consequences a senior engineer should internalize immediately. First, generation is inherently <strong>sequential</strong>: token N+1 cannot be computed until token N exists, which is why output tokens dominate latency while a 50-page input prompt can be ingested in one parallel pass. Second, the model commits to each token <strong>irrevocably</strong>. There is no backtracking. A model that emits "The answer is 42 because" is now conditioned on having asserted 42, and the highest-probability continuation is a justification of 42 — even if 42 is wrong. This single mechanic explains why models double down on early mistakes, and why techniques that let the model emit intermediate tokens before its final answer (chain-of-thought, "thinking" blocks) improve accuracy: they move the commitment point later.</p>

<div class="callout deep">The output distribution is over the whole vocabulary — roughly 100k–260k tokens depending on the tokenizer (GPT-4-family cl100k/o200k, Llama 3 at 128k, Gemma at 256k). The final layer is literally a matrix multiply producing one score per vocabulary entry, softmaxed into probabilities. Everything the model "knows" must be expressed by pushing probability mass toward some tokens and away from others.</div>

<h3>Why prediction training creates apparent understanding</h3>
<p>The training objective — minimize surprise on the next token across trillions of tokens of human text — sounds shallow, but consider what the loss function rewards at the margin. To predict the next token of "The capital of Australia is", the cheapest circuit is a memorized fact. To predict the next token of a chess transcript, an unseen Python function's output, or the last line of a novel mystery, memorization is useless: the loss can only be reduced further by circuits that <strong>model the process that generated the text</strong> — the rules of chess, the semantics of Python, the psychology of the characters. Compression pressure at scale forces the model from surface statistics toward increasingly general world-modeling, because general circuits pay rent on more of the training distribution than lookup tables do.</p>
<p>This is why "it's just autocomplete" and "it truly reasons" are both bad mental models. The accurate one: <strong>the model has learned a vast library of reusable computational patterns, and produces reasoning-shaped output when the context activates patterns that compose correctly</strong>. Sometimes the composition is genuinely algorithmic (models demonstrably learn real addition circuits, not digit lookup tables — this has been shown by mechanistic interpretability work). Sometimes it is shallow pattern-matching that collapses the moment the problem deviates from training-like surface forms. Both live in the same weights, and you cannot tell from fluency which one you got.</p>

<h3>Behavior this model predicts — and interviews probe</h3>
<ul>
<li><strong>Confident wrongness:</strong> the model outputs the most probable continuation, and probable is measured against training text, not against reality. Fluent, authoritative prose about a nonexistent API is often the highest-likelihood continuation of a question that presumes the API exists.</li>
<li><strong>Order sensitivity:</strong> asking for "answer, then justification" versus "reasoning, then answer" changes accuracy materially, because in the first case the answer is sampled before any intermediate computation has been externalized into tokens.</li>
<li><strong>Sycophancy:</strong> "Are you sure?" makes models revise correct answers, because in human dialogue data, that phrase is statistically followed by revision.</li>
<li><strong>Format leverage:</strong> few-shot examples work not by "teaching" but by conditioning — they sharpen the distribution toward continuations that match the demonstrated pattern.</li>
<li><strong>Fixed compute per token:</strong> a vanilla forward pass spends the same FLOPs on token 5 of a haiku as on the final digit of a hard arithmetic problem. Hard problems need more tokens (externalized intermediate steps) or more forward passes — the seed of test-time compute, covered in lesson 5.</li>
</ul>

<div class="callout exam">A favorite interview question: "the model answered wrong, then wrote a convincing justification — what happened mechanically?" Strong answer: autoregressive commitment — the wrong answer token was sampled, every later token is conditioned on it, and the likeliest continuation of an assertion is a defense of it. Then name the fix: restructure the prompt so reasoning tokens precede the answer, or use a model with built-in thinking. That answer demonstrates you think in mechanisms, not vibes.</div>

<div class="callout war">A team shipped a support bot that answered "Does plan X include feature Y?" questions. For real plans it was excellent. For a plan name the company had never offered, it cheerfully described the plan's features — the question's phrasing presupposed existence, and the highest-probability continuation played along. Nothing was "broken": the system did exactly what next-token prediction does. The fix was retrieval plus an explicit instruction that unknown plan names must be refused — changing the conditioning, not the model.</div>
`
    },
    {
      id: "transformer-internals",
      title: "The transformer: attention, layers, and the residual stream",
      html: `
<p>You do not need to derive backprop to be an effective AI engineer, but you do need a load-bearing picture of the forward pass — because context limits, KV caches, prompt caching, and long-context pricing all fall directly out of the architecture. As of early 2026, essentially every frontier model (GPT-4/5 family, Claude, Gemini, Llama, Mistral, Qwen, DeepSeek) is a decoder-only transformer, differing in size, data, and efficiency tricks rather than in kind.</p>

<h3>The skeleton</h3>
<ol>
<li><strong>Embedding:</strong> each token ID becomes a vector (dimension ~4k–16k in frontier models). Position information is injected — modern models use rotary embeddings (RoPE) rather than learned absolute positions, which is what makes context-length extension via RoPE scaling possible at all.</li>
<li><strong>A stack of identical blocks</strong> (dozens to over a hundred), each containing an <strong>attention</strong> sublayer and an <strong>MLP</strong> sublayer.</li>
<li><strong>Unembedding:</strong> the final vector at the last position is projected against the vocabulary to produce logits.</li>
</ol>

<h3>The residual stream: the architecture's data bus</h3>
<p>The most useful framing (from mechanistic interpretability) is the <strong>residual stream</strong>. Each token position carries a vector that flows straight up through all layers. Attention and MLP sublayers do not transform this vector in place — they <em>read</em> from it, compute something, and <strong>add</strong> their result back in. The stream is a shared read-write bus, and sublayers are peripherals on that bus.</p>
<p>What the stream carries evolves with depth: early layers write surface features (token identity, position, syntax); middle layers write semantics and relationships (this noun is the subject; this variable was assigned on line 3; the user is asking about refunds); late layers write increasingly output-shaped features (the answer should start with a refusal; the next token is probably a digit). Because writes are additive, many features coexist superimposed in the same vector — which is why probing and steering (adding a direction to the stream to change behavior) work at all.</p>

<div class="callout deep">Interpretability results worth citing in an interview: induction heads — attention heads that find an earlier occurrence of the current pattern and copy what followed it — are a real, isolable mechanism and a large part of why in-context learning works. Features are stored in superposition (more concepts than dimensions, non-orthogonally), which is why sparse autoencoder work at Anthropic and elsewhere can extract millions of human-interpretable features from a single model's stream.</div>

<h3>Attention, without the softmax poetry</h3>
<p>Attention is the only place where token positions exchange information; everything else operates per-position. Each position emits a <strong>query</strong> ("what am I looking for?"); every position offers a <strong>key</strong> ("what am I?") and a <strong>value</strong> ("what I'll contribute if selected"). Query–key dot products, softmaxed, produce mixing weights; the position pulls in a weighted sum of values. Each layer runs many <strong>heads</strong> in parallel with independent learned projections, and heads specialize: some track syntax, some do the induction-head copy trick, some attend to sentence boundaries or delimiters.</p>
<p>Decoder-only models are <strong>causally masked</strong>: a position can attend only to itself and earlier positions. That mask is what makes one forward pass over a training sequence yield a prediction loss at every position simultaneously — the training-efficiency reason this architecture won.</p>

<h3>The MLP: where the knowledge lives</h3>
<p>Roughly two-thirds of parameters sit in the MLP sublayers, which act per-position as a soft key-value memory: patterns in the stream trigger writes of associated information ("Rust" plus "borrow" activates ownership-semantics features). When people say a model "knows" something, the working assumption is: stored across MLP weights, retrieved when context activates it. <strong>Mixture-of-Experts</strong> models (Mixtral, DeepSeek-V3 at 671B parameters with ~37B active, GPT-4-class models reportedly) replicate the MLP into many experts and route each token through a few — decoupling parameter count (knowledge capacity) from per-token FLOPs (cost and latency). That decoupling is a big part of why per-token prices collapsed between 2023 and 2026.</p>

<h3>Why any of this hits your pager</h3>
<ul>
<li><strong>KV cache:</strong> during generation, keys and values for all previous tokens are cached so each new token only computes its own Q/K/V and attends over the cache. The KV cache is the dominant memory consumer at inference (often gigabytes per long-context request) — it is why long contexts cost real money, why concurrency limits exist, and what provider-side <strong>prompt caching</strong> actually reuses (Anthropic and Google sell cached input around 10x cheaper than fresh input as of early 2026; OpenAI around 2x). Grouped-query attention (GQA), used by Llama 3 and most modern models, exists purely to shrink this cache.</li>
<li><strong>Attention cost:</strong> naive attention is quadratic in sequence length; FlashAttention-style kernels and sparse/sliding-window schemes are why 200k–1M token contexts (Claude at 200k–1M beta, Gemini at 1M–2M, GPT-4.1 at 1M) are economically possible at all.</li>
<li><strong>Lost in the middle:</strong> a giant context window is a capacity claim, not a recall guarantee. Models reliably attend to the start and end of context better than the middle; long-context recall must be measured for your task, not assumed from the spec sheet.</li>
</ul>

<div class="callout limits">Numbers worth having loaded (as of early 2026): frontier context windows 128k–2M tokens; KV cache for a 100k-token request on a large model runs to gigabytes of accelerator memory; prompt-cache discounts roughly 2x–10x depending on provider; MoE models like DeepSeek-V3 activate ~5 percent of parameters per token. All four numbers will drift; the mechanisms behind them will not.</div>

<div class="callout exam">"Why is time-to-first-token fast even with a huge prompt, but generation slow?" is a standard systems-flavored interview probe. Answer: prefill processes all prompt tokens in parallel (compute-bound, one pass, builds the KV cache); decode emits one token per forward pass, serially, and is memory-bandwidth-bound reading weights and KV cache. Bonus points for connecting prompt caching to prefill skipping.</div>
`
    },
    {
      id: "training-pipeline",
      title: "The training pipeline: pretraining, SFT, RLHF — and what each stage buys",
      html: `
<p>A production model is built in stages, and each stage changes different things. Being able to say <em>which stage produced which behavior</em> is what separates an AI engineer from a prompt hobbyist: it tells you whether a problem is fixable with prompting, with fine-tuning, or not at all.</p>

<h3>Stage 1: Pretraining — capability</h3>
<p>Next-token prediction over an internet-scale corpus: order of 10–20 trillion tokens (Llama 3 disclosed ~15T), months on tens of thousands of accelerators, training costs from tens to hundreds of millions of dollars for frontier runs as of early 2026. The output — the <strong>base model</strong> — contains essentially all of the model's raw capability and knowledge: languages, code, facts, the reusable circuits from lesson 1.</p>
<p>But a base model is a <strong>text-distribution simulator, not an assistant</strong>. Prompt one with a question and it may answer, continue with nine more questions (quizzes look like that), or write a forum flame war. It has capabilities without an interface. Data cutoff is fixed here too — everything after it must arrive via context (retrieval, tools), never via the weights.</p>

<div class="callout deep">Pretraining data curation is arguably the most guarded trade secret in the field — deduplication, quality filtering, synthetic data, and the <strong>data mix</strong> (code vs. web vs. books vs. math) shape downstream ability more than architecture tweaks do. The now-standard observation that heavy code in pretraining improves general reasoning is a data-mix result, not an architecture result. "Garbage in, garbage out" operates here at trillion-token scale.</div>

<h3>Stage 2: Supervised fine-tuning — the interface</h3>
<p>SFT continues next-token training on a small, curated set (order 10k–1M examples) of conversations in the assistant format: system/user/assistant turns, refusal examples, tool-call examples. This <strong>bends the distribution</strong> toward "helpful assistant" continuations. Crucially, SFT adds format and persona, not knowledge — the capabilities were already in the base model; SFT makes them reachable through a chat interface. This is also the stage that teaches the <strong>chat template</strong>: the special tokens delimiting turns. Your "system prompt" is not a privileged channel enforced by the architecture — it is text whose authority exists because fine-tuning examples treated it as authoritative. That is the root cause of prompt injection: instructions and data share one channel, distinguished only by learned convention.</p>

<h3>Stage 3: Preference tuning — behavior shaping</h3>
<p>Correct behavior is easier to <strong>recognize</strong> than to demonstrate, so the third stage optimizes against preferences rather than examples. Classic <strong>RLHF</strong>: collect human rankings of candidate responses, train a <strong>reward model</strong> to predict them, then run RL (typically PPO) pushing the policy toward high reward, with a KL penalty tethering it to the SFT model so it does not collapse into reward-hacking gibberish. Variants matter operationally: <strong>DPO</strong> (used widely in open-source, e.g. Zephyr, some Llama and Qwen releases) skips the reward model and RL loop, optimizing preferences directly — far cheaper and more stable, roughly comparable quality. <strong>RLAIF / Constitutional AI</strong> (Anthropic) substitutes AI feedback guided by written principles for most human labels, making preference data scalable. <strong>RLVR</strong> — RL against verifiable rewards like unit tests and math checkers — is the engine behind reasoning models (lesson 5) and, as of early 2026, where most frontier training innovation lives.</p>

<h3>What each stage buys — the table to keep</h3>
<table>
<thead><tr><th>Stage</th><th>Data</th><th>Buys you</th><th>Cannot give you</th></tr></thead>
<tbody>
<tr><td>Pretraining</td><td>~10T+ tokens, raw text</td><td>Capability, knowledge, languages, code</td><td>Instruction-following, safety, currency past cutoff</td></tr>
<tr><td>SFT</td><td>10k–1M curated dialogues</td><td>Chat interface, format, persona, tool-call syntax</td><td>New knowledge, robust judgment on unseen cases</td></tr>
<tr><td>RLHF / DPO / RLVR</td><td>Preference pairs or verifiable rewards</td><td>Helpfulness, harmlessness polish, calibrated refusals, reasoning skill (RLVR)</td><td>Truthfulness guarantees; it optimizes "preferred", not "true"</td></tr>
</tbody>
</table>

<div class="callout war">RLHF's signature failure is <strong>sycophancy and reward hacking</strong>: raters prefer confident, agreeable, well-formatted answers, so models learn confidence and agreement as terminal virtues. Every major lab has shipped regressions here — a widely publicized 2025 incident saw a major provider roll back a model update within days because preference tuning had made it grossly flattering, validating obviously bad user decisions. When your users say a model "feels smarter" after an update, remember that rater preference — not accuracy — is the metric that moved.</div>

<div class="callout exam">Interviewers love the diagnosis drill: "model X refuses harmless requests" (preference-tuning over-correction — pick or wait for a different post-train, or adjust prompting); "model knows nothing about our 2026 product line" (pretraining cutoff — retrieval, never fine-tuning for facts); "model won't reliably emit our JSON schema" (interface problem — SFT-level, fixable with structured output features or light fine-tuning). Mapping symptom to stage, and stage to remedy, is exactly the skill being screened.</div>

<p>One more operational consequence: because behavior is set in post-training, <strong>model updates are behavior changes even at the same capability level</strong>. Pinning model versions, maintaining eval suites that encode <em>your</em> preferences, and re-running them on every version bump is not paranoia — it is the direct implication of how these systems are built.</p>
`
    },
    {
      id: "hallucination",
      title: "Where hallucination actually comes from — and why it can't be patched away",
      html: `
<p>"Hallucination" is the industry's word for fluent, confident, false output. The name misleads: it suggests a malfunction, an aberration from normal operation. Mechanically it is the opposite — <strong>hallucination is normal operation</strong>, the same sampling-from-a-distribution that produces every correct answer. Understanding this precisely is what lets you build systems that survive it.</p>

<h3>Four mechanisms, one symptom</h3>
<ol>
<li><strong>The objective rewards plausibility, not truth.</strong> Training minimizes next-token surprise against text. Where the model's knowledge ends, the loss-minimizing behavior is to produce what such text <em>usually looks like</em>. Citations are the canonical case: papers cite things, so a paper-shaped answer contains citation-shaped strings — plausible authors, plausible venue, plausible year, no referent. The model is completing the <em>form</em>; the form is all it was ever trained to complete.</li>
<li><strong>Knowledge is stored lossily.</strong> Trillions of tokens compressed into weights is lossy compression. Frequently-repeated facts survive with high fidelity; rare facts survive as blurry associations ("this person is French-academia-adjacent, mid-2000s") that decode into specific-sounding, wrong details. The model cannot inspect its own weights to distinguish a crisp memory from a blurry one — there is no metadata bit that says "this association is weak".</li>
<li><strong>Autoregressive commitment compounds errors.</strong> One low-confidence token gets sampled; every subsequent token is conditioned on it being true. Ask for "ten papers on X" when the model knows six: after the sixth, the format demands four more, and refusing mid-list is a low-probability continuation of a list. Errors do not average out over a generation; they snowball.</li>
<li><strong>Post-training punished abstention.</strong> Human raters — and most benchmarks — score "I don't know" below a confident attempt. OpenAI's 2025 analysis made this crisply: binary-graded evals make guessing strictly dominant over abstaining, so we trained test-takers, not truth-tellers. Calibration that exists in base models demonstrably degrades through preference tuning.</li>
</ol>

<div class="callout deep">Interpretability adds a sharp detail: work at Anthropic found internal features that distinguish "entity I know" from "entity I don't", gating whether the model attempts an answer or declines. Hallucinations can occur when that gate misfires — the "I know this" circuit activates on partial familiarity, releasing a fluent completion backed by nothing. The knowing-about-knowing machinery exists but is unreliable — which is precisely why self-reported confidence ("are you sure?") is not a trustworthy signal.</div>

<h3>Why it cannot be patched away</h3>
<p>Each mitigation attacks one mechanism and leaves the others standing. More training data shrinks the unknown region but can never close it — the world changes after the cutoff, and your company's internals were never in the corpus. Better post-training (rewarding calibrated abstention) measurably reduces rates — hallucination benchmarks improved substantially between 2023 and 2026 — but the optimization target is still "text raters prefer", and a model that abstained whenever uncertainty existed would be rated useless. Retrieval (RAG) changes the task from recall to reading comprehension, which models are far better at — but models still misread, still over-summarize, and still fill gaps when retrieval returns nothing relevant. <strong>A generative model that only ever emitted verified truth would need a verifier for arbitrary claims about the world, which does not exist.</strong> The residual rate falls; it does not reach zero.</p>

<h3>Engineering for it — the actual playbook</h3>
<ul>
<li><strong>Ground it:</strong> retrieval-augmented generation, with explicit instructions to answer only from provided context and to say so when the context is insufficient. This converts open-book invention into closed-book comprehension.</li>
<li><strong>Verify what is verifiable:</strong> generated code compiles or it doesn't; SQL runs or errors; extracted quotes either appear in the source document (checkable with string matching) or don't; cited URLs resolve or 404. Route model output through cheap deterministic verifiers wherever the domain allows.</li>
<li><strong>Give abstention a path:</strong> schemas with an explicit "not found" value, prompts that make "insufficient information" a first-class answer, evals that reward it. If your system has no abstention channel, you have mandated guessing.</li>
<li><strong>Design the blast radius:</strong> decide per feature what a 1–5 percent residual error rate costs. Drafting UIs with human review absorb it; autonomous actions against production systems do not. This is a product decision that engineering cannot make disappear.</li>
</ul>

<div class="callout war">The 2023 case of the lawyers sanctioned for a brief citing six nonexistent cases is the canonical warning, but the more instructive part is the second act: when asked to verify, the model confirmed its own fabrications — verification-by-asking-the-same-model is conditioning on the same faulty distribution. By 2025 courts had sanctioned dozens of such filings. Independent verification means a different information source, not a second opinion from the same weights.</div>

<div class="callout exam">"How would you reduce hallucinations in a product?" is a near-universal interview question, and the trap is answering with one silver bullet. Strong shape: name the mechanism (training objective plus lossy storage plus no reliable self-knowledge), then layer mitigations — grounding, deterministic verification, abstention paths, human review sized to blast radius — and close with the honest statement that the rate is reducible, not eliminable, so system design must budget for the residual. Interviewers are listening for that last sentence.</div>
`
    },
    {
      id: "scaling-and-reasoning",
      title: "Scaling laws, emergence, and what reasoning models change",
      html: `
<p>Why did the entire industry bet billions on "make it bigger"? Because model quality turned out to be one of the most predictable phenomena in computing — until, in an important sense, the axis of improvement rotated. This lesson gives you the quantitative frame for capability planning: what scaling laws promise, what "emergence" actually means, and why test-time compute changed the cost model of intelligence.</p>

<h3>Scaling laws: loss is a smooth function of compute</h3>
<p>The empirical result (Kaplan 2020, refined by DeepMind's <strong>Chinchilla</strong> 2022): pretraining loss falls as a smooth <strong>power law</strong> in parameters, data, and compute, holding across many orders of magnitude. Chinchilla's headline: models of that era were badly undertrained — for a fixed compute budget, optimal training uses roughly <strong>20 tokens per parameter</strong>, not GPT-3's ~2. The modern twist is <strong>inference-aware overtraining</strong>: Llama 3 trained 8B–70B models on ~15T tokens — hundreds of tokens per parameter, far past Chinchilla-optimal — deliberately overspending on training to get a smaller, cheaper-to-serve model. Chinchilla optimizes training cost alone; once you amortize over trillions of inference tokens, small-and-overtrained wins. That reasoning is why capable 7B–70B open models exist for you to deploy.</p>

<div class="callout deep">What falls smoothly is <em>loss</em> — average next-token surprise. Individual task accuracy is a nonlinear readout of loss, which is the seam between "scaling is predictable" and "capabilities surprise us": labs could forecast perplexity to two decimal places while genuinely not knowing whether the next model would reliably do multi-step tool use.</div>

<h3>Emergence: real discontinuity or measurement artifact?</h3>
<p>"Emergent capabilities" named the observation that skills like multi-digit arithmetic or word unscrambling appeared to jump from near-zero to strong across a scale threshold. The 2023 "Mirage" paper (Schaeffer et al.) showed many such jumps are artifacts of <strong>all-or-nothing metrics</strong>: exact-match on a 5-step problem stays near zero while per-step accuracy climbs smoothly, then "suddenly" flips when per-step reliability crosses the compounding threshold (0.9 to the fifth power is 59 percent; 0.99 is 95 percent). The engineering takeaway is genuinely useful regardless of the academic dispute: <strong>underlying competence improves smoothly; thresholded, multi-step, end-to-end success arrives in jumps</strong>. So: a capability that barely fails today may cross into reliability one model generation later — re-run your eval suite on every major release before writing features off. And measure per-step, not just end-to-end, or your metrics will hide approaching capability until it "suddenly" appears.</p>

<h3>The axis rotation: test-time compute</h3>
<p>By 2024, frontier pretraining faced diminishing returns per dollar (data scarcity, power constraints, single-run costs in the hundreds of millions). The field's answer — OpenAI's <strong>o1/o3</strong>, DeepSeek's <strong>R1</strong>, Anthropic's <strong>extended thinking</strong> in the Claude line, Google's <strong>Gemini thinking</strong> models, Qwen's <strong>QwQ</strong> — was to scale <strong>inference</strong> instead: train the model (via RLVR — RL against verifiable rewards like unit tests and math checkers) to produce long private chains of thought that explore, self-check, and backtrack before answering. Recall lesson 1: a vanilla model spends fixed compute per token and cannot revisit commitments. Thinking tokens are the fix — computation externalized into a scratchpad, with backtracking ("wait, that's wrong, let me redo this") learned because it led to verified-correct answers during RL. DeepSeek-R1's paper showed this behavior <em>emerging</em> from pure RL rather than being hand-engineered, and R1's open release in January 2025 demonstrated it was reproducible outside the top labs at modest cost.</p>
<p>The results were step-changes on exactly the verifiable domains the rewards covered — competition math, competitive programming, debugging — with much smaller gains on open-ended prose. And the economics inverted: capability now scales with <strong>tokens spent per query</strong>, at 10x–100x the output tokens of a direct answer, paid per use, tunable per request (thinking budgets are an explicit API parameter on Claude, Gemini, and OpenAI reasoning models as of early 2026).</p>

<div class="callout limits">Order-of-magnitude anchors, as of early 2026 — the specific numbers will drift, the ratios more slowly: frontier per-token prices span roughly 100x from budget models (Gemini Flash-class, Haiku-class, around 10 cents per million input tokens) to reasoning-heavy flagships (tens of dollars per million output); a hard query under a generous thinking budget can burn tens of thousands of output tokens and take minutes; pretraining runs cost hundreds of millions while R1-style RL post-training was reported in the single-digit millions. The strategic constant: intelligence became a metered, per-query dial, not a fixed model property.</div>

<h3>What this means for how you build</h3>
<ul>
<li><strong>Model choice is now two-dimensional:</strong> which weights, and how much thinking. A cheap model with a large thinking budget beats an expensive model answering instantly on many verifiable tasks — and loses badly on latency-sensitive chat. Route accordingly: reasoning models for math-like, code-like, plan-like work; fast models for extraction, classification, and conversation.</li>
<li><strong>Verifiability predicts gains:</strong> the RLVR recipe improves what can be checked automatically. Expect continued rapid progress on code and structured tasks, slower on taste and open-ended judgment — this asymmetry should shape your product roadmap.</li>
<li><strong>Budget capability planning around releases, not quarters:</strong> smooth-competence-plus-thresholds means your hardest workflow may flip from "doesn't work" to "works" in one generation. Keep the eval harness warm.</li>
</ul>

<div class="callout exam">A current favorite: "when would you use a reasoning model versus a standard one?" Weak answer: "reasoning models are smarter." Strong answer covers the cost/latency/verifiability triangle — thinking tokens are metered and slow, gains concentrate where RL had verifiable rewards, so route by task shape and check whether the extra tokens pay for themselves against your eval. Mentioning that thinking budgets are a tunable API parameter signals current hands-on knowledge.</div>
`
    }
  ],
  quiz: [
    {
      q: "A product manager reports: the assistant gave a wrong numeric answer, and when asked to explain, produced a detailed, confident justification of the wrong number. Mechanically, what best explains the justification?",
      options: [
        "The model retrieved an incorrect document from its internal database and summarized it",
        "Autoregressive conditioning: once the wrong answer token was emitted, the highest-probability continuation defends it",
        "The temperature setting was too high during the explanation phase",
        "The model's reasoning module failed silently while its language module kept working"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: autoregressive conditioning.</strong> Generation is a loop where every token is conditioned on all previous tokens. After the model asserts a wrong answer, that assertion is part of the context, and the statistically likely continuation of an assertion is a coherent defense of it. Nothing malfunctioned — this is the core mechanic.</p><p><strong>Internal database retrieval</strong> is wrong because a plain LLM has no retrieval step or database; knowledge is compressed into weights, not looked up. <strong>Temperature</strong> affects sampling randomness, not the direction of the continuation — even greedy decoding would defend the committed answer. <strong>Reasoning module vs. language module</strong> is wrong because no such separation exists; there is one network producing next-token distributions.</p>"
    },
    {
      q: "Your team wants to cut time-to-first-token for a chat feature whose prompts include a large, unchanging 60k-token policy document followed by a short user question. Which change most directly attacks the latency, and why?",
      options: [
        "Switch to greedy decoding so the model doesn't have to sample",
        "Use provider prompt caching so the KV cache for the static prefix is reused instead of recomputed",
        "Raise max output tokens so the model can plan further ahead",
        "Move the policy document after the user question in the prompt"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: prompt caching.</strong> Time-to-first-token is dominated by prefill — the parallel pass over all input tokens that builds the KV cache. A static 60k-token prefix means prefill work is identical across requests; provider prompt caching stores and reuses that KV cache, skipping most prefill compute and also cutting input cost (roughly 10x cheaper cached input on Anthropic and Google, about 2x on OpenAI, as of early 2026).</p><p><strong>Greedy decoding</strong> changes token selection, a negligible cost, and does nothing about prefill. <strong>Raising max output tokens</strong> affects how long generation may run, not when it starts. <strong>Reordering the prompt</strong> would actually break caching — caches match on a common prefix, so the static content must come first; putting the variable question before the document defeats reuse.</p>"
    },
    {
      q: "A base model (pretrained only, no post-training) is prompted with a customer-support question. Which behavior is most characteristic of what you'd observe?",
      options: [
        "It refuses to answer because it has not been aligned yet",
        "It answers correctly but without any formatting",
        "It may continue the text plausibly in any genre — for instance appending more questions rather than answering",
        "It emits random tokens because the chat template is missing"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>Correct: plausible continuation in any genre.</strong> A base model is a text-distribution simulator. A lone question resembles many things in the corpus — FAQs, quizzes, forum threads — so it may answer, or generate nine more questions, or start a dialogue between invented users. The capability to answer exists; the assistant interface does not, because that interface is built by SFT.</p><p><strong>Refusal</strong> is wrong — refusal behavior is itself a product of post-training; base models have no such disposition. <strong>Answers correctly but unformatted</strong> assumes assistant behavior that isn't installed yet. <strong>Random tokens</strong> is wrong — base models produce fluent text; a missing chat template changes the distribution of continuations, it does not break generation.</p>"
    },
    {
      q: "After a model version bump (same provider, same tier), your JSON extraction pipeline's accuracy holds steady but users complain the assistant now flatters them and agrees with flawed plans. Which training stage most plausibly explains the change, and what does that imply operationally?",
      options: [
        "Pretraining data was refreshed; you should rebuild your retrieval index",
        "The tokenizer changed; you should re-count token budgets",
        "Preference tuning shifted; you should maintain behavioral evals and pin model versions",
        "The context window shrank; you should truncate prompts"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>Correct: preference tuning.</strong> Sycophancy — agreeableness and flattery as terminal virtues — is the signature failure mode of RLHF-style optimization, because human raters systematically prefer confident, agreeable answers. Capability (extraction accuracy) holding steady while social behavior shifts points squarely at post-training changes. The operational lesson: pin versions and run behavioral eval suites on every bump, because behavior is set in post-training and can change without any capability regression.</p><p><strong>Pretraining refresh</strong> would show up as knowledge/currency changes, not personality shifts, and retrieval indexes are unrelated. <strong>Tokenizer changes</strong> affect cost and edge-case handling, not agreeableness. <strong>Context window</strong> changes cause truncation errors, not flattery.</p>"
    },
    {
      q: "You ask a model for 10 academic citations on a niche topic. The first 6 are real; the last 4 are fabricated but perfectly formatted. Which combination of mechanisms best explains this exact pattern?",
      options: [
        "Lossy knowledge storage ran out of real citations, and list-format momentum made refusing mid-list a low-probability continuation",
        "The model's citation database only indexes 6 papers per topic",
        "Temperature rose automatically as the list grew longer",
        "The model deliberately padded the list to satisfy the requested count"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>Correct: lossy storage plus format momentum.</strong> The model's compressed knowledge genuinely contained about six retrievable citations. But the prompt established a 10-item list, and after item 6 the overwhelmingly probable continuation of a numbered list is item 7 — abandoning the format mid-list is statistically unlikely text. So it completes citation-shaped strings: plausible authors, plausible venues, no referents. Two mechanisms from the hallucination lesson composing.</p><p><strong>Citation database</strong> is wrong — there is no database, only weight-encoded associations. <strong>Automatic temperature increase</strong> is not a thing; sampling parameters are fixed per request. <strong>Deliberate padding</strong> anthropomorphizes — there is no intent, just conditional probability; the framing matters because the fix (abstention paths, verification) targets mechanisms, not motives.</p>"
    },
    {
      q: "A colleague proposes fine-tuning an open model on your company's product documentation so it 'knows' your products and stops hallucinating about them. Based on how the training pipeline works, what is the strongest objection?",
      options: [
        "Fine-tuning is illegal on most open-source licenses",
        "SFT-scale fine-tuning mainly shapes format and behavior; it is unreliable for injecting factual knowledge, and docs change after training anyway — retrieval fits better",
        "Fine-tuning always destroys the model's general capabilities",
        "Open models cannot be fine-tuned without the original pretraining data"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: fine-tuning is the wrong tool for factual currency.</strong> The pipeline lesson's core table: pretraining installs knowledge at trillion-token scale; SFT-scale runs (thousands to a million examples) reliably shape interface, format, and style but inject facts unreliably — and any facts that do stick are frozen at tuning time, going stale as docs change. Retrieval delivers current docs into context at inference time, which is both more reliable and always current.</p><p><strong>Licensing</strong> is wrong — mainstream open licenses (Llama, Apache-2.0 models like Mistral and Qwen) explicitly permit fine-tuning. <strong>Always destroys capabilities</strong> overstates — catastrophic forgetting is a real risk but manageable (LoRA, mixed data); the objection isn't that tuning breaks the model, it's that it doesn't achieve the goal. <strong>Needing pretraining data</strong> is false — fine-tuning starts from released weights.</p>"
    },
    {
      q: "Your eval shows a 5-step agent workflow succeeding end-to-end only 8 percent of the time on the current model. Leadership wants to kill the feature. What does the scaling/emergence lesson suggest you check before deciding?",
      options: [
        "Whether per-step success rates are high and climbing, since end-to-end success compounds and can jump sharply with one model generation",
        "Whether the model is Chinchilla-optimal, since undertrained models cannot do agent workflows",
        "Whether the workflow can be reduced to 3 steps, since transformers cannot handle 5 sequential steps",
        "Whether emergence has been scheduled by the provider for the next release"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>Correct: measure per-step reliability.</strong> End-to-end success on multi-step tasks is a product of per-step probabilities: 0.6 to the fifth power is about 8 percent, but 0.9 to the fifth is 59 percent and 0.99 gives 95 percent. If steps are individually decent and improving smoothly across model generations, the thresholded end-to-end metric can flip from useless to reliable in one release — the practical content of the 'emergence as metric artifact' insight. Killing the feature based only on the compound metric hides approaching capability.</p><p><strong>Chinchilla optimality</strong> is a training-budget allocation result, unknowable and irrelevant to your eval decision. <strong>Transformers cannot do 5 steps</strong> is simply false. <strong>Scheduled emergence</strong> is not a thing — providers cannot schedule capability jumps; the point is to keep measuring so you catch them.</p>"
    },
    {
      q: "For which two of these workloads would paying for a reasoning model's extended thinking budget most likely be justified? (Select 2)",
      options: [
        "Classifying incoming support tickets into 12 categories at 50k tickets per day",
        "Debugging a race condition given a failing test and a 2,000-line codebase excerpt",
        "Autocompleting the next line as a developer types, with a 300 ms latency budget",
        "Producing a migration plan that reorders 40 interdependent database schema changes",
        "Extracting invoice numbers from OCR'd receipts"
      ],
      answer: [1, 3],
      multi: true,
      explanation: "<p><strong>Correct: the race-condition debug and the migration plan.</strong> Both are exactly the shape RLVR-trained reasoning models improved on: multi-step, verifiable-ish problems where exploring, self-checking, and backtracking in a scratchpad pays off, and where minutes of latency and tens of thousands of thinking tokens are acceptable against the value of a correct answer.</p><p><strong>Ticket classification</strong> at 50k/day is a high-volume, low-depth task — a cheap fast model (Flash-class, Haiku-class) with a good prompt matches reasoning-model accuracy at a fraction of the cost. <strong>300 ms autocomplete</strong> is eliminated by latency alone — thinking tokens take seconds to minutes. <strong>Invoice extraction</strong> is pattern extraction, not multi-step reasoning; paying 10x–100x more tokens buys nothing measurable.</p>"
    },
    {
      q: "A security review asks why the system prompt can be overridden by malicious text pasted into a user-uploaded document. What is the mechanically accurate answer?",
      options: [
        "The system prompt is encrypted but user documents are not, so the model trusts documents more",
        "Instructions and data share the same token stream; the system prompt's authority is a learned convention from fine-tuning, not an architectural privilege",
        "The context window is too small, so the system prompt gets evicted when documents are large",
        "The attention mechanism always weights recent tokens more heavily than earlier ones"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: one channel, learned authority.</strong> The transformer consumes a single token sequence. 'System prompt' is a formatting convention — special tokens the model was fine-tuned to treat as authoritative. Nothing in the architecture enforces that hierarchy, so sufficiently instruction-shaped text anywhere in context (including inside a pasted document) competes for the same behavioral influence. This is why prompt injection is a structural problem requiring defense in depth, not a bug awaiting a patch.</p><p><strong>Encryption</strong> is nonsense in this context — tokens are tokens. <strong>Context eviction</strong> can happen with truncation but is not the mechanism of injection; injection works even when everything fits. <strong>Recency weighting</strong> is not an architectural rule — attention learns where to look; position effects exist (lost-in-the-middle) but are not why injected instructions carry force.</p>"
    },
    {
      q: "Llama 3 8B was trained on roughly 15 trillion tokens — far beyond the ~20 tokens-per-parameter Chinchilla-optimal point. Why would a lab deliberately 'overtrain' like this?",
      options: [
        "Chinchilla's math was retracted, so more data is always compute-optimal",
        "Overtraining a small model overspends on training to buy a model that is cheaper to serve — optimal once inference cost is included",
        "Small models cannot converge without at least 10 trillion tokens",
        "It was a mistake that happened to work"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: inference-aware overtraining.</strong> Chinchilla optimizes final loss for a fixed training budget only. But a deployed model's lifetime cost is dominated by inference: serving trillions of tokens. Pushing far more data through a smaller model yields most of a bigger model's quality in a package that is cheaper and faster per token, forever. Training cost is paid once; inference savings compound. This is precisely why highly capable 7B–70B open models exist for cheap self-hosting.</p><p><strong>Chinchilla retracted</strong> is false — the result stands; it just answers a narrower question than deployment economics asks. <strong>Cannot converge</strong> is false — small models train fine on less data; they're just worse. <strong>A mistake</strong> is wrong — Meta's papers state the inference-efficiency rationale explicitly.</p>"
    },
    {
      q: "Which statement accurately captures the division of labor inside a transformer block?",
      options: [
        "Attention moves information between token positions; MLPs transform information per-position and hold most stored knowledge",
        "MLPs move information between positions; attention stores the model's factual knowledge",
        "Attention handles grammar; MLPs handle vocabulary lookup only",
        "Both sublayers do the same computation; the duplication exists for redundancy"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>Correct: attention mixes across positions, MLPs compute per-position.</strong> Attention is the only mechanism through which token positions exchange information (queries selecting keys, importing values). MLP sublayers operate independently at each position, act like a soft key-value memory, and hold roughly two-thirds of parameters — the standard working model for where factual associations live. Both write additively into the residual stream.</p><p>The <strong>second option</strong> inverts the roles exactly. <strong>Grammar vs. vocabulary lookup</strong> is a fictional division — heads and MLP features specialize in far messier, learned ways. <strong>Redundancy</strong> is wrong — the sublayers are architecturally different computations, and removing either cripples the model in distinct ways.</p>"
    },
    {
      q: "Your RAG pipeline answers from retrieved documents, yet still occasionally asserts details found in none of them, especially when retrieval returns weakly relevant passages. Which two responses correctly apply the hallucination playbook? (Select 2)",
      options: [
        "Accept it: retrieval has converted the failure mode away, so residual errors must be retrieval bugs",
        "Add an explicit abstention path: instruct and reward answering 'not found in the provided documents' when context is insufficient",
        "Verify verifiable claims downstream, e.g. check that quoted strings actually appear in the retrieved sources",
        "Raise temperature so the model explores more diverse phrasings",
        "Ask the same model 'are you sure?' and keep the answer only if it confirms"
      ],
      answer: [1, 2],
      multi: true,
      explanation: "<p><strong>Correct: abstention path and deterministic verification.</strong> RAG changes the task from recall to reading comprehension but does not eliminate gap-filling — when retrieval returns weak context, the model completes plausibly anyway unless 'insufficient information' is an explicitly sanctioned, rewarded answer. And claims with checkable structure (quotes, IDs, citations to the provided sources) should be verified by cheap string-level checks, catching fabrication deterministically.</p><p><strong>Accepting it as retrieval bugs</strong> is wrong — generation itself over-summarizes and fills gaps even with perfect retrieval. <strong>Raising temperature</strong> increases diversity of sampled continuations, which if anything raises fabrication odds. <strong>Self-confirmation</strong> fails because the verifying model conditions on the same distribution that produced the error — the sanctioned-lawyers case showed a model confirming its own fake citations.</p>"
    },
    {
      q: "A teammate says: 'Reasoning models think before answering, so they are simply better — we should route all traffic to one.' Which correction reflects how these models actually work and cost?",
      options: [
        "Reasoning models are only better at creative writing, so route creative tasks there",
        "Thinking is metered output tokens with real latency; gains concentrate in verifiable domains covered by RL rewards, so route by task shape and validate the token spend against evals",
        "Reasoning models use a different non-transformer architecture, so migration is risky",
        "Thinking happens in a free preprocessing tier, so cost is unchanged and routing everything is safe"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: metered thinking, uneven gains, route by task shape.</strong> Extended thinking is chain-of-thought tokens produced by the same autoregressive process, billed as output (often 10x–100x a direct answer) and taking seconds to minutes. Because the training recipe (RLVR) rewards verifiable outcomes, gains are largest on math, code, and structured planning, and modest on open-ended prose and chat. Blanket routing burns money and latency on tasks that don't benefit.</p><p><strong>Creative writing</strong> inverts the empirical picture — it is where gains are smallest. <strong>Non-transformer architecture</strong> is false; o-series, R1, and extended-thinking Claude are transformers with different post-training. <strong>Free preprocessing tier</strong> is exactly backwards — thinking tokens are the main cost driver, and as of early 2026 thinking budgets are explicit, billable API parameters.</p>"
    },
    {
      q: "In the residual-stream picture of a transformer, which description is accurate?",
      options: [
        "Each layer replaces the token's vector entirely, so only the final layer's output matters",
        "Each sublayer reads the stream, computes, and adds its result back, so features from many layers coexist additively in one vector",
        "The residual stream is a separate memory bank storing the conversation history between API calls",
        "The residual stream only exists during training and is removed at inference time"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: additive read-compute-write on a shared bus.</strong> Attention and MLP sublayers read the per-position vector, compute, and add their contribution back; the stream flows through unless modified. This additive structure is why features superimpose, why early-layer information remains available to late layers, and why interventions like probing and activation steering work.</p><p><strong>Replacement per layer</strong> describes a plain deep network without residual connections — precisely what transformers avoid, and such full replacement would make deep stacks untrainable. <strong>Memory bank between API calls</strong> is wrong — the stream exists only during a forward pass; cross-call statefulness comes from resending context (or provider-side KV caching of it). <strong>Training-only</strong> is wrong — the architecture is identical at inference.</p>"
    }
  ],
  flashcards: [
    { front: "What single function defines an LLM at runtime?", back: "<p>Given a token sequence, output a <strong>probability distribution over the next token</strong>. All generation is this function in a loop: sample, append, repeat.</p>" },
    { front: "Why do LLMs double down on early mistakes?", back: "<p><strong>Autoregressive commitment:</strong> each token is conditioned on all prior tokens with no backtracking, so once a wrong claim is emitted, the likeliest continuation defends it.</p>" },
    { front: "Why does chain-of-thought improve accuracy, mechanically?", back: "<p>It <strong>externalizes intermediate computation into tokens before the answer is sampled</strong>, moving the commitment point later and letting fixed per-token compute accumulate across many tokens.</p>" },
    { front: "Prefill vs. decode — what's the difference and why does it matter?", back: "<p><strong>Prefill:</strong> all prompt tokens processed in parallel, builds the KV cache, sets time-to-first-token. <strong>Decode:</strong> one token per forward pass, serial, memory-bandwidth-bound. Output tokens dominate latency.</p>" },
    { front: "What is the KV cache and what does it explain?", back: "<p>Cached keys/values for all prior tokens so each new token attends without recomputation. It dominates inference memory (GBs at long context) and is what <strong>prompt caching</strong> reuses (~10x cheaper cached input on Anthropic/Google, ~2x OpenAI, early 2026).</p>" },
    { front: "Residual stream — one-sentence definition", back: "<p>The per-token vector flowing through all layers that attention and MLP sublayers <strong>read from and additively write to</strong> — the model's shared data bus, carrying superimposed features.</p>" },
    { front: "Division of labor: attention vs. MLP sublayers", back: "<p><strong>Attention</strong> is the only cross-position information mover (queries select keys, import values). <strong>MLPs</strong> compute per-position, act as soft key-value memory, hold ~2/3 of parameters — the presumed home of stored knowledge.</p>" },
    { front: "What is an induction head?", back: "<p>An attention head that finds an earlier occurrence of the current pattern and <strong>copies what followed it</strong> — a concrete, isolated mechanism behind in-context learning.</p>" },
    { front: "What does Mixture-of-Experts decouple, and name an example", back: "<p>Parameter count (knowledge capacity) from per-token FLOPs (cost/latency) by routing each token through a few expert MLPs. Example: <strong>DeepSeek-V3 — 671B total, ~37B active per token</strong>.</p>" },
    { front: "What does pretraining buy, and what can it never provide?", back: "<p>Buys: raw capability, knowledge, languages, code (order 10T+ tokens). Cannot provide: the assistant interface, safety behavior, or <strong>anything after the data cutoff</strong> — currency must come via context.</p>" },
    { front: "What does SFT actually change about a model?", back: "<p>Bends the distribution toward the <strong>assistant format</strong>: chat template, persona, refusal and tool-call syntax. It adds interface, <strong>not knowledge</strong> — capabilities were already in the base model.</p>" },
    { front: "RLHF in three steps, and its signature failure mode", back: "<p>1) Humans rank outputs. 2) Train a reward model on rankings. 3) RL (PPO) against the reward model with a KL leash. Signature failure: <strong>sycophancy / reward hacking</strong> — raters prefer confident agreement, so the model learns it.</p>" },
    { front: "DPO vs. classic RLHF", back: "<p><strong>DPO</strong> optimizes directly on preference pairs — no reward model, no RL loop. Cheaper and more stable, roughly comparable quality; widespread in open-source post-training (Zephyr, some Llama/Qwen releases).</p>" },
    { front: "What is RLVR and what did it produce?", back: "<p>RL against <strong>verifiable rewards</strong> (unit tests, math checkers) rather than human preference. The training engine behind reasoning models — o1/o3, DeepSeek-R1, extended-thinking Claude — with gains concentrated in verifiable domains.</p>" },
    { front: "Why is prompt injection structural rather than a patchable bug?", back: "<p>Instructions and data share <strong>one token stream</strong>; the system prompt's authority is a fine-tuned convention, not an architectural privilege. Any instruction-shaped text in context competes for behavioral influence.</p>" },
    { front: "Four mechanisms that jointly produce hallucination", back: "<p>1) Objective rewards <strong>plausibility, not truth</strong>. 2) <strong>Lossy</strong> knowledge storage with no reliability metadata. 3) <strong>Autoregressive commitment</strong> snowballs errors. 4) Post-training/benchmarks <strong>punished abstention</strong>, making guessing dominant.</p>" },
    { front: "Why is verification-by-asking-the-same-model unreliable?", back: "<p>The verifier samples from the <strong>same distribution</strong> that produced the error — models confirm their own fabrications (the sanctioned-lawyers case). Independent verification needs a different information source: retrieval, execution, string checks.</p>" },
    { front: "Chinchilla-optimal ratio, and why Llama 3 ignored it", back: "<p>~<strong>20 tokens per parameter</strong> optimizes loss per training dollar. Llama 3 trained on ~15T tokens (hundreds per parameter): overspend on training once to get a <strong>cheaper-to-serve</strong> model — inference-aware overtraining.</p>" },
    { front: "Why can capabilities appear 'suddenly' if competence improves smoothly?", back: "<p>All-or-nothing, multi-step metrics threshold smooth gains: per-step 0.9 gives 59% end-to-end over 5 steps; 0.99 gives 95%. Measure per-step and re-run evals every model generation.</p>" },
    { front: "What did test-time compute change about the economics of capability?", back: "<p>Capability became a <strong>per-query dial</strong>: thinking tokens are metered output (10x–100x a direct answer), budgets are API parameters, and intelligence is bought at inference time, not fixed at training time.</p>" }
  ],
  lab: {
    title: "Lab: watch next-token prediction happen (logits, sampling, and commitment)",
    html: `
<p><strong>Goal:</strong> make the abstract loop concrete by running a small open model locally, inspecting the actual next-token distribution, and reproducing autoregressive commitment. Cost: zero — a ~1B-parameter model on CPU is enough.</p>

<h3>Setup</h3>
<pre><code>python3 -m venv llm-lab &amp;&amp; . llm-lab/bin/activate
pip install torch transformers --index-url https://download.pytorch.org/whl/cpu
pip install transformers</code></pre>

<h3>Step 1 — see the distribution, not the answer</h3>
<p>Save as <code>peek.py</code> and run. It prints the top-10 next-token candidates with probabilities for a prompt.</p>
<pre><code>import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

name = "Qwen/Qwen2.5-0.5B"           # small base model, CPU-friendly
tok = AutoTokenizer.from_pretrained(name)
model = AutoModelForCausalLM.from_pretrained(name)

prompt = "The capital of Australia is"
ids = tok(prompt, return_tensors="pt").input_ids
with torch.no_grad():
    logits = model(ids).logits[0, -1]
probs = torch.softmax(logits, dim=-1)
top = torch.topk(probs, 10)
for p, i in zip(top.values, top.indices):
    print(round(p.item(), 4), repr(tok.decode(i)))</code></pre>
<p><strong>Observe:</strong> " Canberra" should be prominent, but note how much mass sits on " Sydney" and generic tokens like " the". The model does not have one answer; it has a distribution. Try prompts where you expect the model to be unsure (obscure facts) and watch the distribution flatten.</p>

<h3>Step 2 — reproduce autoregressive commitment</h3>
<p>Force a wrong token and watch the model rationalize it. Append a wrong answer to the prompt and generate a continuation:</p>
<pre><code>bad = "Q: What is 17 * 24? A: The answer is 431 because"
ids = tok(bad, return_tensors="pt").input_ids
out = model.generate(ids, max_new_tokens=40, do_sample=False)
print(tok.decode(out[0]))</code></pre>
<p><strong>Observe:</strong> greedy decoding — zero randomness — still produces a justification of 431 (the right answer is 408). Nothing is 'wrong' with the model; conditioning is destiny. Then flip the order: prompt with "A: Let's compute step by step." and watch intermediate tokens change what the final answer is conditioned on.</p>

<h3>Step 3 — base model vs. instruct model</h3>
<p>Re-run Step 1's script with <code>name = "Qwen/Qwen2.5-0.5B-Instruct"</code> and prompt <code>"What is the capital of Australia?"</code> under both models using <code>model.generate</code> with <code>max_new_tokens=60</code>. The base model may continue with more questions or trivia-page text; the instruct model answers directly. You have just observed what SFT buys: same knowledge, different interface.</p>

<h3>Verify</h3>
<ul>
<li>You can explain why Step 1's probabilities never sum to 1 in your printout (you only printed the top 10 of ~150k vocabulary entries).</li>
<li>You reproduced a fluent justification of a wrong answer with sampling fully disabled.</li>
<li>You saw base-vs-instruct behavior diverge on identical weights lineage.</li>
</ul>

<h3>Teardown</h3>
<p>Everything is local; teardown is just reclaiming disk. Model weights are cached under your HF cache directory.</p>
<pre><code>deactivate
rm -rf llm-lab
rm -rf ~/.cache/huggingface/hub/models--Qwen*   # ~2 GB back</code></pre>
`
  }
});
