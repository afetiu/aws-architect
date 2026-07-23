/* Module 04 — Model APIs, Structured Outputs & Tool Calling (AI Engineer, core track) */
window.COURSE.register({
  id: "model-apis-tools",
  order: 4,
  track: "core",
  title: "Model APIs, Structured Outputs & Tool Calling",
  description: "The layer where LLMs meet real software: the stateless chat-completions mental model and how OpenAI, Anthropic, Gemini, and open-source servers each dialect it; SSE streaming and everything that breaks mid-stream; structured outputs via constrained decoding versus validate-and-retry; the full tool-calling round trip with its characteristic failure modes; and the production hygiene — rate limits, backoff, timeouts, idempotency, per-request cost accounting — that separates a demo from a service.",
  examWeight: "This module is the technical core of most AI-engineer screens: interviewers ask you to sketch the tool-calling loop on a whiteboard, explain what happens when a stream dies halfway, and compare constrained decoding with post-hoc validation. System-design rounds probe 429 handling, retry budgets, idempotency, and how you would attribute cost per request — fluency here is treated as the dividing line between 'has called an API' and 'has run one in production.'",
  lessons: [
    {
      id: "chat-mental-model",
      title: "The chat-completions mental model: messages, roles, and provider dialects",
      html: `
<p>Every major LLM API is the same machine wearing different clothes: a <strong>stateless function</strong> that takes a list of messages plus generation parameters and returns one assistant message with usage accounting. Internalize that shape and every provider's API becomes a dialect; miss it and you will fight phantom problems like "why doesn't the model remember the last turn" (because you didn't send it).</p>

<h3>The invariant core</h3>
<ul>
<li><strong>Stateless request/response.</strong> The server holds no conversation state between calls (caching is a billing optimization, not memory). "Memory" is your application re-sending history every turn — which means context management, truncation, and summarization are <em>your</em> code, and cost grows with conversation length because you re-pay for the whole transcript each turn (prompt caching exists precisely to blunt this).</li>
<li><strong>Messages with roles.</strong> A system/developer channel for operator instructions, alternating user and assistant turns, and a channel for tool results. Message content is not just a string — it is a list of <strong>content blocks</strong> (text, image, document, tool-call, tool-result), which matters the moment you touch multimodal or tools.</li>
<li><strong>Generation parameters:</strong> model ID, max output tokens, stop sequences, sampling controls, and increasingly a reasoning-effort knob. Note the trend: newer reasoning-model APIs (OpenAI's o-series/GPT-5 tiers, Anthropic's 4.7+ models) <em>remove</em> temperature/top_p entirely — steering moved to prompts and effort levels.</li>
<li><strong>A response envelope</strong> with content blocks, a <strong>finish/stop reason</strong> (natural end, token-limit hit, tool call requested, content-policy refusal), and <strong>usage</strong> (input/output/cached/reasoning token counts). Production code branches on stop reason and records usage on every call; demo code ignores both, and that is exactly what distinguishes them.</li>
</ul>

<div class="callout deep">Underneath, the messages array is flattened by a <strong>chat template</strong> into one token sequence with special delimiter tokens per role, and the model does next-token prediction over it — nothing else. Open-source makes this concrete: the template is Jinja in <code>tokenizer_config.json</code>, and a wrong template (a recurring bug when new models land in serving frameworks) silently degrades output while everything "works." Roles are formatting conventions the model was trained on, not API semantics enforced at runtime.</div>

<h3>Provider dialects (as of early 2026)</h3>
<ul>
<li><strong>OpenAI</strong> — Chat Completions (<code>/v1/chat/completions</code>): system/developer prompt as a message inside the array, <code>tools</code> + <code>tool_calls</code> with a dedicated <code>role: "tool"</code> result message, choices array. Its newer <strong>Responses API</strong> adds optional server-side conversation state and built-in tools — a genuine departure from statelessness, worth knowing as the exception that proves the rule. Chat Completions remains the industry's de facto wire format.</li>
<li><strong>Anthropic</strong> — Messages (<code>/v1/messages</code>): <code>system</code> is a <em>top-level parameter</em>, not a message; <code>messages</code> must start with user and alternate strictly; content is explicitly block-structured; tool results are sent as <code>tool_result</code> blocks <em>inside a user message</em> (no tool role); <code>max_tokens</code> is required. Headers: <code>x-api-key</code> plus <code>anthropic-version</code>.</li>
<li><strong>Gemini</strong> — <code>generateContent</code>: <code>contents</code> with roles <code>user</code>/<code>model</code> (not "assistant"), parts instead of blocks, <code>systemInstruction</code> top-level, tool responses as <code>functionResponse</code> parts. Also exposes an OpenAI-compatible endpoint for migration traffic.</li>
<li><strong>Open-source servers</strong> — vLLM, SGLang, llama.cpp server, Ollama, TGI all speak <strong>OpenAI-compatible</strong> Chat Completions, which is why "the OpenAI schema" became a lingua franca: point the OpenAI SDK at a different base URL and most code just runs. Caveats: feature support is uneven (strict schemas, parallel tool calls, logprobs vary by server and model), and correctness depends on the server applying the right chat template for the loaded model.</li>
</ul>

<h3>Practical consequences</h3>
<ul>
<li><strong>Abstract at the boundary, thinly.</strong> Map to a neutral internal message type at the edge of your system; don't let one vendor's wire format colonize your domain code. Resist heavyweight abstraction layers that hide stop reasons and usage — you need both.</li>
<li><strong>Token accounting is provider-specific.</strong> Different tokenizers mean the same text is a different count (and price) per provider — and per model family within a provider. Never estimate one provider's bill with another's tokenizer; use each API's usage fields or count-tokens endpoint.</li>
<li><strong>History framing differs:</strong> Anthropic's strict user/assistant alternation and required first-user message will reject transcripts OpenAI accepts; Gemini renames the roles. Cross-provider history conversion is a real function with real edge cases (merging consecutive same-role turns, relocating tool results), not a field rename.</li>
</ul>

<div class="callout exam">A favorite screen question: "Design a chat backend that can switch providers." Strong answers name the invariant core (stateless, messages, stop reasons, usage), keep a thin adapter per dialect, store history in a neutral schema, and call out the gotchas — tool-result placement differs (tool role vs user-message block vs functionResponse part), alternation rules differ, token counts differ. Weak answers say "use a framework" and stop.</div>

<div class="callout limits">Dialect facts worth having cold (early 2026): Anthropic requires <code>max_tokens</code> and strict role alternation; OpenAI fines neither. Context windows: 1M on current Claude and Gemini 2.5 Pro, 200–400K typical on OpenAI flagships, 128K standard for open-weight Llama/Qwen/Mistral (with 1M special variants). Output caps are much smaller than context — commonly 8K–128K — and long outputs require streaming to dodge HTTP timeouts. Reasoning models bill hidden thinking as output tokens: your budget math must include tokens you never see.</div>
`
    },
    {
      id: "streaming",
      title: "Streaming: SSE, chunk handling, UX patterns, and mid-stream failure",
      html: `
<p>An LLM can take tens of seconds to finish a long answer, but emits its first token in well under a second. Streaming exists to surface that difference: time-to-first-token (TTFT) is the latency users feel, and streaming converts a 20-second wait into a 400ms one plus visible progress. It is also load-bearing infrastructure — providers and SDKs effectively require streaming for large outputs, because a silent multi-minute non-streaming HTTP response is a timeout magnet at every proxy between you and the model.</p>

<h3>The transport: Server-Sent Events</h3>
<p>All major providers stream over <strong>SSE</strong>: a long-lived HTTP response with <code>Content-Type: text/event-stream</code>, delivering <code>event:</code>/<code>data:</code> line pairs separated by blank lines. Unidirectional server-to-client, plain HTTP (no WebSocket upgrade, proxy-friendly), trivially parseable. Realtime voice APIs use WebSockets/WebRTC; for text generation, SSE is the standard.</p>
<ul>
<li><strong>OpenAI dialect:</strong> a series of <code>chat.completion.chunk</code> objects where <code>choices[0].delta</code> carries incremental content or tool-call fragments, terminated by a literal <code>data: [DONE]</code> sentinel. Usage arrives in a final chunk only if requested via stream options.</li>
<li><strong>Anthropic dialect:</strong> typed, structured events — <code>message_start</code> → per-block <code>content_block_start</code> / <code>content_block_delta</code> / <code>content_block_stop</code> → <code>message_delta</code> (carrying stop reason and output usage) → <code>message_stop</code>, with occasional <code>ping</code> keepalives. Deltas are typed too: <code>text_delta</code>, <code>thinking_delta</code>, <code>input_json_delta</code> for tool arguments.</li>
<li><strong>Gemini:</strong> <code>streamGenerateContent</code> yields partial candidate objects (SSE with <code>alt=sse</code>); open-source OpenAI-compatible servers reproduce the OpenAI chunk shape.</li>
</ul>

<h3>Client-side chunk handling</h3>
<p>Your client is an <strong>accumulator state machine</strong>: append text deltas per block index; buffer tool-argument JSON fragments (they are partial strings — unparseable until the block completes); capture stop reason and usage from the tail events; on stream end, assemble the same complete message object a non-streaming call would have returned, and branch on stop reason as usual. SDK helpers (Python <code>messages.stream()</code> with <code>get_final_message()</code>, TS <code>finalMessage()</code>) exist precisely so you don't hand-roll this — use them, and keep the raw-SSE knowledge for debugging proxies.</p>

<h3>UX patterns</h3>
<ul>
<li><strong>Buffer slightly before rendering</strong> — flushing every token thrashes the DOM; batching every 30–50ms reads smoothly and cuts render cost.</li>
<li><strong>Progressive markdown rendering</strong> needs an incremental-tolerant renderer — naive re-parsing flickers on unclosed fences and tables.</li>
<li><strong>Reasoning models pause before speaking:</strong> with hidden thinking, nothing user-visible may arrive for many seconds. Stream a thinking indicator (providers emit thinking events/summaries) or users assume a hang.</li>
<li><strong>Show tool activity:</strong> during tool-call streams, render "Searching orders…" from the tool name/arguments rather than dead air.</li>
<li><strong>Fan the stream out</strong> to browsers via SSE pass-through or WebSocket; if your gateway buffers responses (some proxies and serverless platforms do), streaming silently degrades to batch — disable buffering on the route, and beware response-compression middleware that holds chunks.</li>
</ul>

<h3>What goes wrong mid-stream</h3>
<p>Streaming moves failures from before-first-byte to <em>after you have already shown the user half an answer</em> — a categorically worse place. Design for these:</p>
<ul>
<li><strong>Connection drops:</strong> LB idle timeouts, mobile network changes, redeploys. You hold a partial transcript; the request is not resumable on the provider side. Decide policy per surface: show partial + retry affordance, or auto-retry from scratch (dedupe concerns → lesson 5) — and note partial output already streamed is still billed.</li>
<li><strong>Mid-stream error events:</strong> providers can emit an <code>error</code> event (e.g. <code>overloaded</code>) after content has flowed — a 200 status followed by failure. Anything that only checks the HTTP status will log success for a failed generation; your accumulator must treat error events as terminal failures.</li>
<li><strong>Truncation:</strong> the stream ends "successfully" with stop reason max-tokens — a complete-looking, incomplete answer. Surface it (continue button, auto-continue) rather than silently presenting a cut-off response as done.</li>
<li><strong>Stalls:</strong> bytes stop arriving without a close. Standard HTTP read timeouts often reset per chunk, so a trickling or wedged stream can hang forever — enforce an <em>inter-chunk</em> timeout and a wall-clock budget at the application level; use provider keepalive pings to distinguish thinking from dead.</li>
<li><strong>Malformed frames:</strong> an SSE event split across TCP reads, or a data payload spanning multiple lines, breaks naive line parsers. Use a real SSE parser; this bug ships constantly in hand-rolled clients and appears only under production packet boundaries.</li>
</ul>

<div class="callout war">A team fronted their model calls with a serverless HTTP gateway that buffered responses. Streaming worked in local dev, but in production users saw nothing for 20 seconds and then the whole answer at once — and the platform's 30-second response cap killed long generations entirely, which surfaced as "the model stops mid-sentence for big questions." Nothing was wrong with the model: two infrastructure layers were eating the stream. Verify end-to-end streaming through your real edge, not just against the provider.</div>

<div class="callout exam">"What can go wrong mid-stream?" is a deliberately open interview question. Cover the taxonomy — disconnects with partials (and that partials bill), post-200 error events, max-token truncation masquerading as success, stalls needing inter-chunk timeouts, proxy buffering — and the accumulator-state-machine framing. Bonus points for TTFT vs total-latency as distinct SLOs and for knowing tool-call arguments stream as unparseable JSON fragments.</div>

<div class="callout limits">Latency anchors (early 2026, order of magnitude): TTFT ~200–800ms on hosted frontier models with warm cache (multi-second on cold 100K-token prompts — cache hits largely skip prefill); decode throughput commonly ~30–150 tokens/sec per request (Haiku/Flash-class faster; premium "fast modes" push further). A 1,500-token answer is therefore 10–50 seconds of streaming — set client wall-clock budgets in minutes, not seconds, and idle timeouts above the longest expected inter-token gap (reasoning pauses included).</div>
`
    },
    {
      id: "structured-outputs",
      title: "Structured outputs: schema modes, constrained decoding vs post-hoc validation, retries",
      html: `
<p>The moment model output feeds a program instead of a person, "usually valid JSON" is a bug budget you pay daily. There are two fundamentally different ways to get schema-conformant output — <strong>constrain generation itself</strong>, or <strong>validate after and retry</strong> — and choosing between them (usually: both, layered) is a core production design decision.</p>

<h3>The mode ladder</h3>
<ul>
<li><strong>Prompted format</strong> ("respond in JSON with fields…"): no guarantee; drift-prone (lesson 5 of the prompting module). Fine for human-read output only.</li>
<li><strong>JSON mode:</strong> guarantees <em>syntactically valid JSON</em>, says nothing about shape — you get valid JSON with the wrong keys. Mostly superseded.</li>
<li><strong>Schema-enforced mode:</strong> you pass a JSON Schema and the provider guarantees conformance. OpenAI: <code>response_format</code> with <code>json_schema</code> and <code>strict: true</code>. Anthropic: <code>output_config.format</code> with a schema, plus <code>strict: true</code> on tool definitions for tool-argument conformance. Gemini: <code>responseSchema</code>. SDKs layer typed bindings on top (Pydantic / Zod in the parse helpers) so the schema and your types are one artifact.</li>
</ul>

<h3>How constrained decoding works</h3>
<p>At every step the model emits logits over the whole vocabulary; the runtime compiles your schema into a grammar/automaton and <strong>masks every token that cannot extend a valid document</strong>, sampling only from the legal set. After <code>{"age":</code> a quote token is simply unsamplable if <code>age</code> is an integer. Engines: llama.cpp GBNF grammars, Outlines (regex/FSM-based), xgrammar, vLLM and SGLang guided decoding — the same technique hosted providers run behind the flag. Two operational notes: the first request with a new schema pays a <strong>grammar-compilation cost</strong> (providers cache compiled schemas, typically ~24h); and schema support is a <em>subset</em> of JSON Schema — recursion, numeric ranges, string length bounds, and open-ended <code>additionalProperties</code> are commonly unsupported, so those constraints still need post-hoc checks.</p>

<div class="callout deep">Constraint guarantees syntax, not truth — and it can even shift semantics: forcing tokens the model wouldn't naturally choose (masking away its preferred continuation) occasionally yields conformant-but-worse content, e.g. a required field the model has no information for gets confidently hallucinated because <code>null</code> wasn't in your schema. Design schemas to give the model honest outs: nullable/optional fields, an explicit "unknown" enum member, and a free-text notes field for what didn't fit. The schema is an interface design problem, not a serialization detail.</div>

<h3>Post-hoc validation and repair</h3>
<p>Where constrained decoding is unavailable (some open-source stacks, complex schema features, non-JSON targets like SQL or DSLs) — or as defense-in-depth behind it — run the classic loop:</p>
<ol>
<li>Generate; extract candidate (strip code fences, tolerate leading prose).</li>
<li>Parse and validate against the schema (Pydantic/Zod/jsonschema).</li>
<li>On failure, <strong>re-prompt with the error</strong>: original output + the specific validation message ("age must be an integer, got 'thirty-two'") + instruction to return corrected JSON only. One repair round fixes the large majority of failures; error-specific feedback dramatically beats blind regeneration.</li>
<li>Bounded attempts (2–3), then a dead-letter path: log the sample, degrade gracefully. An unbounded retry loop on a systematically-failing input is a spend incident.</li>
</ol>
<p>Validate <em>semantics</em> in this layer even when syntax is constrained: cross-field consistency, referential checks (does this product ID exist?), business ranges. The provider guarantees shape; correctness remains yours.</p>

<h3>Failure modes that pierce the guarantee</h3>
<ul>
<li><strong>Truncation:</strong> hitting max tokens mid-document yields invalid JSON <em>even in schema mode</em> — check stop reason before parsing, always. Size output budgets to worst-case payloads, and prefer arrays of small objects over one giant object where feasible.</li>
<li><strong>Refusals:</strong> a safety refusal returns non-conformant output or a refusal stop reason/flag — handle as a distinct branch, not a parse error to retry (retrying a refusal is a policy loop, not a bug fix).</li>
<li><strong>Schema rejection/compile errors:</strong> unsupported features fail at request time — lint schemas against provider limits in CI, not in prod.</li>
<li><strong>Over-constrained schemas</strong> forcing hallucinated field values — the interface-design issue above; the fix is schema shape, not retries.</li>
</ul>

<h3>Choosing</h3>
<p>Default posture for extraction/routing/API-shaped outputs: <strong>schema-enforced decoding + semantic validation behind it + one error-feedback repair + dead-letter</strong>. Use pure validate-and-retry when the target isn't expressible as a supported schema, when you're on a stack without guided decoding, or when you're deliberately measuring how often the model fails unconstrained (a useful eval signal that constraint would otherwise hide).</p>

<div class="callout war">A pipeline extracted invoices with a required <code>total: number</code> field and strict schema — and for scanned invoices where the total was illegible, the model dutifully emitted a plausible number, because the schema offered no way to say "unknown." Constrained decoding turned "model unsure" into "confident wrong data in the ERP," which took an audit to find. The fix was one line of schema: <code>total</code> became nullable with a <code>confidence</code> enum beside it — and a rule: every required field is a claim the model must always be able to make honestly.</div>

<div class="callout exam">Interviewers reliably ask "constrained decoding or validate-and-retry?" The senior answer: they solve different layers (syntax vs semantics), you usually run both; constrained decoding = logit masking from a compiled grammar (know the mechanism); its guarantee has holes (truncation, refusals, schema subset); and schema design — nullable outs, unknown enums — is where extraction quality is actually won. Naming open-source engines (Outlines, xgrammar, GBNF, vLLM guided decoding) lands well.</div>
`
    },
    {
      id: "tool-calling",
      title: "Tool calling: schemas, parallel calls, the full round trip, failure modes",
      html: `
<p>Tool calling is the API pattern underneath every agent: the model doesn't execute anything — it emits a <strong>structured request to call a function you declared</strong>, your code executes it, and you feed the result back. The model proposes; your runtime disposes. Getting the loop, the contracts, and the failure modes right is the difference between an agent and an infinite loop with an invoice.</p>

<h3>Declaring tools</h3>
<p>A tool = name + description + JSON Schema for arguments. The <strong>description is prompt engineering with a return type</strong>: it is how the model decides when to call, so state trigger conditions ("Call when the user asks about order status; requires an order ID — ask for one if missing"), units, and constraints — not just what the function does. Providers now support <strong>strict schemas for tool arguments</strong> (constrained decoding applied to the call), which eliminates malformed-argument failures; use it wherever offered. Keep the tool set focused: beyond a couple dozen tools, selection accuracy degrades and schema tokens bloat every request — deferred loading/tool-search patterns exist for large catalogs.</p>

<h3>The full round trip</h3>
<ol>
<li><strong>Request:</strong> messages + <code>tools</code> (+ optional <code>tool_choice</code>: auto / required / forced-specific / none).</li>
<li><strong>Model returns a tool-call turn:</strong> stop reason indicates tool use; the assistant message contains one or more call blocks, each with a <strong>unique call ID</strong>, name, and JSON arguments (OpenAI: <code>tool_calls</code> array; Anthropic: <code>tool_use</code> content blocks, possibly interleaved with text like "Let me check that…").</li>
<li><strong>You execute</strong> — after validating arguments and authorization. The model's request is untrusted input to your function, exactly like a user-supplied HTTP body.</li>
<li><strong>Return results keyed by call ID:</strong> OpenAI as <code>role: "tool"</code> messages; Anthropic as <code>tool_result</code> blocks inside a single user message; Gemini as <code>functionResponse</code> parts. <em>Every</em> call ID must receive a result — including failures, returned as an error-flagged result so the model can adapt — or the API rejects the next request.</li>
<li><strong>Loop:</strong> send the updated transcript back; the model may answer, or call more tools. Repeat until a natural end — <strong>with a max-iteration cap and a spend budget</strong>, because "until done" is a promise the model does not always keep.</li>
</ol>
<p>The transcript invariant behind step 4: the assistant turn containing the calls must be appended to history <em>verbatim</em>, followed by the results. Dropping or reordering call blocks (a common bug when "cleaning" history) breaks ID pairing and 400s.</p>

<h3>Parallel tool calls</h3>
<p>Models emit multiple independent calls in one turn (three weather lookups; read five files). Execute them <strong>concurrently</strong> and return <strong>all results in one message</strong>, matched by ID. Two subtleties: results may complete out of order — order the response by the model's call order or rely strictly on IDs; and consistently answering parallel calls one-per-message effectively trains the model (within the conversation) to stop parallelizing. Parallel-unsafe tools (writes, sends) should either be declared serial (providers offer a disable-parallel option) or serialized by your executor — the model does not know your side-effect semantics.</p>

<h3>Failure modes — the canonical list</h3>
<ul>
<li><strong>Hallucinated tools or arguments:</strong> calling a tool you never declared, or inventing argument values (an order ID it was never given). Validate name against the registry, arguments against schema <em>and</em> against conversation-grounded reality; return a corrective error result ("no such tool; available: …") — models usually recover.</li>
<li><strong>Malformed argument JSON:</strong> largely cured by strict schemas; still alive on open-source stacks without guided decoding. Treat as a parse-validate-repair problem (previous lesson).</li>
<li><strong>Wrong tool selection / over-calling:</strong> searching the web for something in context, or reflexively calling a tool on every turn. Fix in the descriptions (trigger conditions, "don't use when…"), not with post-hoc heuristics.</li>
<li><strong>Under-calling:</strong> the model answers from stale parametric knowledge instead of calling the tool that would know. Sharpen trigger language ("you MUST call lookup_price for any price question — never answer prices from memory"); newer models are more conservative tool users, so migrations shift this behavior in both directions — re-eval on model bumps.</li>
<li><strong>Result-format failures:</strong> dumping 80K tokens of raw JSON into a result (context blowout — truncate/summarize/paginate at the executor), or returning silent nulls that the model interprets creatively. Make results terse, informative, and explicit about errors and emptiness ("0 orders found matching…").</li>
<li><strong>Loops:</strong> the model re-calls the same tool with the same failing arguments, or ping-pongs between two tools. Cap iterations, detect repeated identical calls, and inject a steering nudge or bail to a human/fallback path.</li>
<li><strong>Security:</strong> tool-calling agents are where prompt injection becomes remote code execution — a hostile document telling the model to call <code>send_email</code> with exfiltrated data. Authorization lives in the executor (per-user scopes, allowlists, human confirmation for destructive actions), never in the model's judgment.</li>
</ul>

<div class="callout war">A retail assistant had a refund tool whose executor trusted the model-supplied order ID. A user pasted a support forum thread (injected instructions inside) and the model called the refund tool with an order ID mined from that pasted text — refunding a stranger's order. The postmortem line every reviewer now quotes: <em>the model is a caller, not a principal</em>. The executor was rewritten to resolve order ownership from the authenticated session, ignoring model-supplied identity entirely — the model now picks <em>which of the user's own orders</em>, nothing more.</div>

<div class="callout deep">Under the hood, tool calls are just structured output: declared schemas are rendered into the prompt (special tool tokens in the chat template — visible in open-source models like Llama and Qwen's tool formats), and the "call" is a generated block, often under grammar constraint, terminated by a tool-call stop token. That is why description quality behaves exactly like prompt quality, why strict argument mode is literally constrained decoding, and why tool schemas count against input tokens on every request — and participate in prompt caching (keep the tool list byte-stable and ordered).</div>

<div class="callout exam">The whiteboard staple: "walk me through one tool-calling turn." Interviewers check that you (1) keep the loop in your code, (2) pair every call ID with a result including errors, (3) return parallel results in one message, (4) cap iterations and budget spend, (5) validate and authorize in the executor because model input is untrusted. Follow-up is usually a failure-mode safari — have the canonical list ready with a mitigation per item.</div>
`
    },
    {
      id: "api-hygiene",
      title: "Production API hygiene: rate limits, retries, timeouts, idempotency, cost per request",
      html: `
<p>Everything before this lesson was about correct requests; this one is about staying up and solvent while making millions of them. LLM APIs are expensive, slow, capacity-constrained dependencies — treat them with the same operational rigor as a database, plus a few quirks all their own.</p>

<h3>Rate limits</h3>
<p>Providers enforce several simultaneous ceilings: <strong>requests per minute (RPM)</strong>, <strong>input/output tokens per minute (TPM)</strong> — the one long-context workloads hit first, since one 200K-token request can be a whole minute of quota — and sometimes daily caps and concurrency limits. Limits scale with spend tier and are per-model or model-family. Practicals: read the <code>x-ratelimit-*</code> response headers and export them as metrics (capacity planning from data, not incident); a handful of huge-context requests can starve everything else on shared TPM, so consider isolating heavy workloads onto separate keys/workspaces; and for throughput work that isn't latency-sensitive, use the <strong>batch APIs</strong> — roughly 50% off with hours-scale SLAs and separate quota — instead of burning interactive limits.</p>

<h3>Retries and backoff</h3>
<ul>
<li><strong>Retry:</strong> 429 (rate limit), 5xx, 529-style overload, connection errors, timeouts. <strong>Don't retry:</strong> 400 (your request is malformed — retrying re-fails), 401/403 (auth), 404 (bad model ID), and content-policy refusals (that's a product branch, not a transient).</li>
<li><strong>Exponential backoff with full jitter</strong>, honoring <code>retry-after</code> when present. Jitter matters at fleet scale: synchronized deterministic backoff turns one 429 burst into coordinated retry waves that re-saturate the limiter.</li>
<li><strong>Budget retries:</strong> cap attempts (SDK default ~2 is sane), cap total wall-clock, and wrap the dependency in a <strong>circuit breaker</strong> — during a provider incident, uncapped retries multiply your traffic exactly when capacity is scarcest, and a queue of 60-second-latency retries can take your own service down sympathetically.</li>
<li><strong>Degrade deliberately:</strong> fallback chains (primary model → cheaper same-provider model → second provider) need eval coverage <em>per fallback target</em> — a fallback that silently produces worse answers is an unmonitored quality incident. Multi-provider failover also implies maintaining prompt variants and losing cache warmth; it is a real feature, not a config flag.</li>
</ul>

<h3>Timeouts</h3>
<p>Generation time is minutes-scale, so timeout design is layered: a <strong>connect timeout</strong> (seconds), a <strong>TTFT budget</strong> (if no first token in ~30–60s, something is wrong — retry may be appropriate), an <strong>inter-chunk idle timeout</strong> for streams (library "read timeouts" often reset per chunk and never fire on a trickle — enforce your own), and a <strong>wall-clock cap</strong> per request matched to max-token math: at ~50 tokens/sec, a 16K-token answer is five minutes — legitimate, and longer than most default HTTP client timeouts, which is exactly why SDKs push streaming for large outputs. Remember a timed-out request may have fully completed server-side: you paid for it, and if it had side effects via tools, they happened.</p>

<h3>Idempotency</h3>
<p>LLM calls are <strong>non-idempotent by nature</strong> (sampling differs per attempt) and <strong>billable per attempt</strong> — a retry is a second spend and possibly a second side effect. The failure shape: timeout fires → client retries → both requests complete → user gets charged twice the tokens, or the agent sends two emails. Mitigations: generate a <strong>request key per logical operation</strong> and dedupe at your boundary (cache the first completed result keyed by it; batch APIs support custom IDs for exactly this); make <em>tool executors</em> idempotent (the classic pattern — the model may legitimately re-call a payment tool after a lost result, so the payment API needs an idempotency key derived from the operation, not the attempt); and for expensive generations, checkpoint results before any dependent side effect so a crash doesn't force regeneration.</p>

<h3>Cost tracking per request</h3>
<p>Token spend is a first-class production metric with more dimensions than people expect. Record on <em>every</em> response: input tokens, output tokens, <strong>cached-read tokens</strong> (billed ~0.1x — a cost model that ignores cache overstates spend and hides cache regressions), and <strong>reasoning tokens</strong> (billed as output even though invisible — at high effort they can dominate). Multiply by a versioned per-model price table (prices change; bill reconciliation needs history). Then:</p>
<ul>
<li><strong>Attribute:</strong> tag every request with feature, tenant, prompt version, and model — "cost per conversation per feature" is the number product decisions need, and per-tenant metering is how you catch the one customer scripting your free tier.</li>
<li><strong>Alert on derivatives:</strong> spend-per-request and cache-hit-ratio changing is the early warning for cache invalidation (prompting module) and for agent loops gone runaway; absolute daily spend alarms catch what per-request misses.</li>
<li><strong>Budget at the edge:</strong> per-user and per-session token ceilings, max-iteration caps on agent loops, and effort/model routing (cheap model for routine requests, expensive for hard ones) are product features, not finance afterthoughts.</li>
</ul>

<div class="callout war">A nightly enrichment job hit a provider incident window: every request timed out at the client's 60s default, the framework retried 3x with no jitter and no budget, and the job runner itself retried failed batches. Effective amplification: 12x traffic against a degraded API — sustained self-inflicted 429s for hours, several hundred dollars of <em>successful-but-abandoned</em> generations (timeouts that completed server-side), and duplicate rows downstream because the writes weren't keyed. Every fix is in this lesson: jittered budgeted backoff, circuit breaker, idempotent writes keyed per logical item, and TPM headroom monitoring.</div>

<div class="callout limits">Numbers to anchor on (early 2026, order of magnitude): entry API tiers start around 50–500 RPM and tens of thousands of TPM, scaling to millions of TPM at high spend tiers; batch APIs run ~50% of interactive price with up-to-24h completion; retry-after headers on 429s are authoritative — honor them over your own schedule. Price spread across a single provider's lineup is ~10–25x (Haiku/Flash-class ~1 dollar per MTok input vs frontier ~5–15), which is why model routing is usually the biggest single cost lever, ahead of caching.</div>

<div class="callout exam">System-design rounds compress this lesson into one prompt: "Your LLM feature is getting 429s and the bill doubled — go." Interviewers listen for: which errors are retryable, jittered backoff with budgets and retry-after, circuit breaking, TPM-vs-RPM awareness, batch offload, idempotency keys for the double-side-effect problem, and cost attribution with cached/reasoning tokens broken out. Mentioning that a timed-out request still bills — and may have already sent the email — is the kind of detail that ends the question early.</div>
`
    }
  ],
  quiz: [
    {
      q: "A chat product built on the Anthropic Messages API sends only the newest user message each turn to save cost, and users complain the assistant forgets everything. A teammate proposes asking the provider to enable server-side memory. What is the correct diagnosis?",
      options: [
        "The provider's memory feature is disabled; support can enable session persistence",
        "The API is stateless by design: the application must resend (and manage) conversation history each turn, using prompt caching to blunt the recurring cost",
        "The context window is too small to hold memories; upgrade to a larger model",
        "Temperature is too high, causing the model to discard information between calls"
      ],
      answer: [1],
      multi: false,
      explanation: "<p>Correct: the chat-completions model is a <strong>stateless function over the messages you send</strong>. 'Memory' is your application resending history; managing growth (truncation, summarization) is your code, and prompt caching exists to make the resent prefix cheap (~0.1x reads on Anthropic). </p><p>Why the others fail: there is no toggle-able server-side session memory on the Messages API (OpenAI's Responses API offers optional server-side state, but that is a different product and still not a support ticket). Context-window size is irrelevant when history is never sent at all. Temperature affects sampling variance within one response — it cannot cause cross-request forgetting, because nothing persists across requests to be forgotten.</p>"
    },
    {
      q: "You port a working OpenAI Chat Completions integration to Anthropic's Messages API by renaming fields. Requests now fail with validation errors. Which real differences must the adapter handle? (Select all that apply.)",
      options: [
        "The system prompt is a top-level parameter, not a message in the array",
        "Messages must begin with a user turn and alternate user/assistant strictly",
        "Tool results are sent as tool_result blocks inside a user message, not as a dedicated tool role",
        "max_tokens is required on every request",
        "Anthropic requires XML request bodies instead of JSON"
      ],
      answer: [0, 1, 2, 3],
      multi: true,
      explanation: "<p>The first four are the genuine dialect differences: Anthropic hoists <code>system</code> out of the messages array; enforces first-message-is-user and strict alternation (transcripts with consecutive same-role turns must be merged); has no <code>role: \"tool\"</code> — results are <code>tool_result</code> content blocks in a user message paired by <code>tool_use_id</code>; and <code>max_tokens</code> is mandatory where OpenAI defaults it. Each one produces exactly the 'field-rename port fails validation' symptom described.</p><p>The XML option is the distractor: both APIs are JSON over HTTPS — the only XML association with Anthropic is the (optional) convention of XML-style tags <em>inside prompt text</em>, which is content, not wire format.</p>"
    },
    {
      q: "Your streamed responses work locally, but in production users see nothing for 20 seconds and then the full answer appears at once; very long answers get cut off entirely. The model provider's status page is green. What is the most likely cause?",
      options: [
        "The model has variable latency; switch to a faster model tier",
        "An intermediary (buffering proxy, serverless gateway, or compression middleware) is buffering the SSE stream and enforcing its own response deadline",
        "SSE requires WebSockets in production environments, and the upgrade is failing",
        "The client's JSON parser is too slow to keep up with chunk arrival"
      ],
      answer: [1],
      multi: false,
      explanation: "<p>Correct: all-at-once delivery after a long silence is the signature of <strong>response buffering between you and the user</strong> — serverless HTTP gateways, reverse proxies with buffering enabled, or compression middleware holding chunks. The long-answer cutoff is the same intermediary's response-time cap killing generations that exceed it. Fix: disable buffering on the streaming route, exempt it from compression, and verify streaming end-to-end through the production edge.</p><p>Why the others fail: model-tier latency would also appear locally and wouldn't convert a stream into a single batch. SSE is plain HTTP by design — no WebSocket upgrade exists to fail; that's precisely why SSE is used. Client parse speed is orders of magnitude faster than token arrival (~30–150 tok/s) and couldn't produce a 20-second buffer-then-dump pattern.</p>"
    },
    {
      q: "While consuming an Anthropic SSE stream, your accumulator has received several content_block_delta events, then receives an error event of type overloaded_error before message_stop. The HTTP status was 200. How must production code treat this generation?",
      options: [
        "As successful, since the HTTP status was 200 and content was received",
        "As a failed generation: mid-stream error events are terminal, the partial content is incomplete, and retry/partial-display policy applies despite the 200 status",
        "As successful if the accumulated text ends with terminal punctuation",
        "As a client bug, since a 200 response cannot contain an error"
      ],
      answer: [1],
      multi: false,
      explanation: "<p>Correct: with streaming, the status line is committed when the stream <em>opens</em> — failures after first byte arrive as in-band <strong>error events</strong>. The accumulator must treat them as terminal failure: mark the generation failed, decide per product whether to show the partial with a retry affordance or retry silently, and note the streamed partial is still billed. Monitoring keyed on HTTP status will count these as successes and hide a real error rate.</p><p>Why the others fail: '200 means success' is precisely the trap this event model creates. Terminal punctuation is a heuristic with no contract behind it — truncation and mid-stream failure regularly end on complete sentences. And a 200-with-error is not a client bug but the documented streaming failure shape across providers; well-formed clients are required to handle it.</p>"
    },
    {
      q: "A schema-enforced (strict structured output) extraction call returns output that fails to parse as JSON. Your teammate says that is impossible with constrained decoding. Which explanations are actually plausible? (Select all that apply.)",
      options: [
        "The response hit the max output token limit and was truncated mid-document",
        "The model issued a safety refusal instead of schema-conformant content",
        "Constrained decoding only guarantees valid syntax per step; truncation and refusal paths bypass the guarantee",
        "The provider randomly disables schema enforcement under load to save capacity"
      ],
      answer: [0, 1, 2],
      multi: true,
      explanation: "<p>Correct set: constrained decoding masks illegal tokens <em>during generation</em>, but it cannot conjure the closing braces if generation halts at the <strong>max-token limit</strong> — a truncated prefix of a valid document is invalid JSON; always check stop reason before parsing. <strong>Refusals</strong> are a separate path: safety handling returns refusal content or a refusal stop reason rather than schema output, and must be branched on, not retried as a parse failure. The third option is the correct generalization of both.</p><p>The load-shedding option is false: providers do not silently disable a correctness guarantee as a capacity valve — degraded service shows up as 429s/529s/latency, not as covert schema abandonment. Believing it would also lead you to 'retry until lucky' instead of fixing the two real branches (raise the token budget / handle refusals).</p>"
    },
    {
      q: "An invoice-extraction pipeline uses a strict schema where total is a required number. For illegible scans, the model outputs plausible but wrong totals. What is the root cause and best fix?",
      options: [
        "The model is too weak; upgrade to the frontier tier and keep the schema",
        "The schema gives the model no honest way to express uncertainty, so constraint forces confident fabrication; make total nullable and add an explicit confidence or unknown signal, plus semantic validation downstream",
        "Strict mode is broken for numbers; switch to prompted JSON and a regex parser",
        "Raise temperature so the model varies its guesses enough to flag uncertainty"
      ],
      answer: [1],
      multi: false,
      explanation: "<p>Correct: this is the <strong>over-constrained-schema</strong> failure — when a required field must be emitted and the information doesn't exist, constrained decoding converts 'model unsure' into 'conformant fabrication.' Schema design is interface design: nullable fields, an unknown/low-confidence enum, and a notes escape hatch give the model honest outs, and downstream semantic validation routes low-confidence rows to review instead of the ERP.</p><p>Why the others fail: a stronger model still cannot read an illegible scan — the constraint, not capability, forces the guess. Abandoning strict mode trades a semantic problem for a syntactic one and keeps the fabrication (a regex can't detect a plausible wrong number). Temperature tweaks change <em>which</em> wrong number appears; variance is not an uncertainty signal any consumer can use.</p>"
    },
    {
      q: "The model returns one assistant turn containing three tool_use blocks (IDs a, b, c). Call b fails with an exception in your executor. What must the next request you send contain?",
      options: [
        "Results for a and c only; omit b so the model does not see the failure",
        "The assistant tool-call turn appended verbatim, then one message containing results for all three IDs, with b returned as an error-flagged tool result",
        "Only b retried by itself; a and c results can be sent later in separate turns",
        "A fresh conversation, since a failed tool call invalidates the transcript"
      ],
      answer: [1],
      multi: false,
      explanation: "<p>Correct: the contract is <strong>every call ID gets exactly one result, delivered together, after the verbatim assistant turn</strong>. Failures are results too — an error-flagged tool result ('b failed: timeout contacting inventory service') lets the model adapt (retry, work around, tell the user). This is both the API's validation requirement and the behavior contract.</p><p>Why the others fail: omitting b's result makes the next request invalid (unpaired tool_use ID → 400) and hides information the model needs. Sending results split across separate messages also breaks pairing expectations and — done consistently — teaches the model within the conversation to stop issuing parallel calls. Starting a fresh conversation throws away the entire transcript over a routine, recoverable event; tool errors are normal control flow, not corruption.</p>"
    },
    {
      q: "An agent gets stuck calling search_orders with the same failing arguments over and over until the request budget is exhausted. Which combination of defenses addresses this loop pattern?",
      options: [
        "A max-iteration cap, detection of repeated identical calls with a corrective nudge injected, and informative error results that tell the model why the call failed",
        "A larger context window so the model can remember more of its attempts",
        "Higher temperature so the model eventually tries different arguments by chance",
        "Removing the tool from the request after the first failure so the loop cannot continue"
      ],
      answer: [0],
      multi: false,
      explanation: "<p>Correct: loop defense is layered. The <strong>iteration cap</strong> bounds worst-case spend; <strong>repeat detection</strong> (same tool + same arguments hash) catches the loop signature early and injects steering ('this exact call failed twice; try different parameters or tell the user'); and <strong>informative error results</strong> attack the cause — models loop most on vague failures ('error') and adapt well to specific ones ('date must be YYYY-MM-DD').</p><p>Why the others fail: context size isn't the issue — the failed attempts are already in context; the model persists anyway. Temperature-as-escape is gambling with spend and correctness. Removing the tool mid-conversation can invalidate transcript expectations, breaks the (possibly legitimate) task, and — since tool definitions sit in the cached prefix — also invalidates your prompt cache; it is a last-resort circuit breaker, not the design.</p>"
    },
    {
      q: "During a tool-calling turn, a user pastes text from an external webpage that contains hidden instructions telling the assistant to call transfer_funds with an attacker's account. What is the correct architectural defense?",
      options: [
        "Add a system prompt rule instructing the model to ignore instructions found in pasted content",
        "Enforce authorization in the tool executor — resolve identity and permissions from the authenticated session, gate destructive actions on confirmation — treating model-emitted calls as untrusted input",
        "Fine-tune the model on examples of refusing injected instructions",
        "Scan pasted text for the word 'transfer' and block those requests"
      ],
      answer: [1],
      multi: false,
      explanation: "<p>Correct: prompt injection against a tool-calling agent is an <strong>authorization problem</strong>, and authorization must live where it can be enforced — the executor. Resolve the acting principal from the authenticated session (never from model-supplied arguments), scope each tool to the user's own resources, and require human confirmation for irreversible actions. Then a successfully-injected model can only request things the real user was allowed to do anyway.</p><p>Why the others fail: prompt rules and fine-tuning both <em>reduce</em> injection success probabilistically — worth doing as defense-in-depth — but neither is an enforcement boundary, and a security control that fails stochastically is not a control. Keyword scanning is trivially bypassed (synonyms, encodings, other languages) and false-positives on legitimate use. The durable principle: the model is a caller, not a principal.</p>"
    },
    {
      q: "Your service starts receiving 429s from the model API during a traffic spike. Current client behavior: retry immediately, up to 10 times, no jitter, no budget. Why is this harmful, and what should replace it?",
      options: [
        "It is fine: 429 means retry, and 10 attempts maximizes success probability",
        "Immediate synchronized retries amplify load against an already-throttled limiter; replace with exponential backoff plus full jitter, honoring retry-after, with capped attempts and a circuit breaker for sustained failure",
        "429s indicate an invalid API key, so retrying is pointless; rotate credentials instead",
        "The fix is to switch all traffic to a second provider whenever any 429 is seen"
      ],
      answer: [1],
      multi: false,
      explanation: "<p>Correct: immediate zero-jitter retries from a fleet are a <strong>retry storm</strong> — every throttled client re-fires in lockstep, multiplying offered load exactly when quota is exhausted, extending the throttling for everyone. The replacement is the standard resilience stack: exponential backoff with <em>full jitter</em> to decorrelate the fleet, the provider's <code>retry-after</code> header as authoritative, bounded attempts and wall-clock budget, and a circuit breaker so a sustained incident sheds load instead of queueing it.</p><p>Why the others fail: '10 immediate retries maximizes success' optimizes one request's odds while degrading the system — the fallacy jitter exists to fix. 429 is rate limiting, not auth (that's 401/403); rotating keys does nothing. Reflexive full failover on any single 429 turns routine throttling into constant provider flapping, with unevaluated quality differences and cold caches on the other side — failover is for sustained failure through a breaker, not per-error.</p>"
    },
    {
      q: "A generation request times out client-side after 60 seconds and is retried; the user later appears to be double-billed for tokens, and an email tool fired twice. What underlying property of LLM API calls explains this, and what is the mitigation?",
      options: [
        "Provider billing bugs; file a support ticket for a refund and add no code changes",
        "A timed-out request may still complete server-side — it bills, and its side effects happen; mitigate with per-operation request keys deduplicated at your boundary and idempotent tool executors keyed on the logical operation",
        "Timeouts under 5 minutes are unsupported; raising the client timeout to 10 minutes prevents the duplication",
        "Retries must always be disabled for LLM calls because they cannot be made safe"
      ],
      answer: [1],
      multi: false,
      explanation: "<p>Correct: a client timeout ends the client's wait, not the provider's generation — the original request often <strong>completes anyway</strong>, so it bills and any tool side effects execute. The retry is then a genuine second operation. Mitigation is classic distributed-systems hygiene applied here: a request key per <em>logical operation</em> with dedupe/result-caching at your boundary, and idempotency pushed into tool executors (the email/payment call carries an idempotency key derived from the operation, so both the timeout-retry case and the model's legitimate re-call-after-lost-result case collapse to one send).</p><p>Why the others fail: this isn't a billing bug — both requests really ran. Raising the timeout reduces the frequency but not the property; a network partition at minute 9 recreates it, and slow requests still need bounding. Disabling retries trades a solvable duplication problem for unhandled transient failure — retries are fine once operations are keyed.</p>"
    },
    {
      q: "Finance reports your per-request cost dashboard says spend should be flat, but the actual invoice doubled. The dashboard computes cost as input tokens plus output tokens times list price. Which omissions in the cost model are most likely responsible? (Select all that apply.)",
      options: [
        "Cached input tokens billed at a discounted rate were ignored, so a cache-hit-rate regression was invisible to the dashboard",
        "Hidden reasoning or thinking tokens, billed as output, were not counted",
        "Retried and abandoned (timed-out but completed) requests were never recorded",
        "The provider bills by characters rather than tokens, so token math is always wrong"
      ],
      answer: [0, 1, 2],
      multi: true,
      explanation: "<p>Correct trio — the three standard holes in naive cost models. (1) If the dashboard prices all input at list rate, it was <em>overstating</em> baseline cost and — worse — a cache regression (invalidated prefix, hit rate to zero) changes the real bill dramatically while the dashboard, which never modeled the discount, shows nothing changed. (2) Reasoning models bill internal thinking as output tokens you never see in content; at high effort this can dominate short answers, and a model/effort change doubles real spend invisibly. (3) Requests that timed out client-side but completed server-side, plus retries, bill without appearing in a dashboard that only records successful application-level responses — usage must be recorded from every response and reconciled against invoices.</p><p>The character-billing option is false: major providers bill per token (that is precisely why usage fields report tokens); the dashboard's unit is right and its coverage is what's wrong.</p>"
    },
    {
      q: "You are choosing between the interactive API and the provider's batch API for a nightly job that classifies 2 million documents with no latency requirement. What is the strongest reason to use the batch API?",
      options: [
        "Batch APIs guarantee higher accuracy because requests are processed with more compute",
        "Batch pricing is roughly half of interactive pricing and runs under separate quota with an hours-scale SLA, so the job neither pays interactive rates nor competes with production traffic for RPM and TPM",
        "Batch APIs are the only way to send more than 10,000 requests per day",
        "Batch APIs stream results faster because they bypass the rate limiter"
      ],
      answer: [1],
      multi: false,
      explanation: "<p>Correct: batch endpoints exist exactly for this shape of work — as of early 2026, major providers price batch at ~50% of interactive rates, complete within an hours-scale window (commonly up to 24h), and draw on separate quota. A 2M-document job on interactive limits would either starve your production feature's shared TPM or take days throttled; on batch it is cheaper and isolated. Results are keyed by your custom IDs and can arrive in any order — which doubles as a natural idempotency handle for the writes.</p><p>Why the others fail: batch runs the same models — there is no accuracy bonus. There is no 10K/day cap forcing batch; interactive limits are RPM/TPM-based and tier-dependent. And batch is the opposite of fast streaming — it trades latency for price and throughput; results come as a completed job, not a faster stream.</p>"
    }
  ],
  flashcards: [
    { front: "The invariant core shared by all chat-completion APIs", back: "A <strong>stateless</strong> function: messages (roles + content blocks) + generation params in → one assistant message + <strong>stop reason</strong> + <strong>usage</strong> out. Memory, truncation, and cost control are the caller's job." },
    { front: "Anthropic Messages API: four dialect differences vs OpenAI", back: "(1) <code>system</code> is a top-level param, not a message; (2) strict user/assistant alternation, first message user; (3) tool results are <code>tool_result</code> blocks in a <em>user</em> message (no tool role); (4) <code>max_tokens</code> required." },
    { front: "Gemini API dialect in one line", back: "<code>generateContent</code> with <code>contents</code> → roles <code>user</code>/<code>model</code>, <code>parts</code> not blocks, <code>systemInstruction</code> top-level, tool replies as <code>functionResponse</code> parts; OpenAI-compatible endpoint offered for migration." },
    { front: "Why do open-source servers speak the OpenAI schema?", back: "vLLM, SGLang, llama.cpp, Ollama, TGI expose OpenAI-compatible Chat Completions so existing SDKs work via base-URL swap. Caveats: uneven feature support (strict schemas, parallel tools, logprobs) and correctness depends on the right <strong>chat template</strong> per model." },
    { front: "What is a chat template?", back: "A per-model (Jinja) template that flattens the messages array into one token stream with role delimiter tokens. Roles are <strong>training conventions</strong>, not runtime-enforced semantics; a wrong template silently degrades output." },
    { front: "SSE streaming: Anthropic event sequence", back: "<code>message_start</code> → <code>content_block_start</code> / <code>content_block_delta</code> (text_delta, thinking_delta, input_json_delta) / <code>content_block_stop</code> per block → <code>message_delta</code> (stop reason + usage) → <code>message_stop</code>; <code>ping</code> keepalives. OpenAI instead: <code>chat.completion.chunk</code> deltas + <code>data: [DONE]</code>." },
    { front: "Five mid-stream failure modes to design for", back: "(1) Disconnects leaving billed partials; (2) in-band <strong>error events after HTTP 200</strong>; (3) max-token truncation that looks like success; (4) stalls — need <em>inter-chunk</em> + wall-clock timeouts; (5) malformed frames — use a real SSE parser. Plus infrastructure: buffering proxies eat streams." },
    { front: "TTFT vs total latency", back: "<strong>Time-to-first-token</strong> is the perceived latency streaming optimizes (~200–800ms warm; cache hits skip prefill). Total time = TTFT + tokens/decode-rate (~30–150 tok/s) — a 1,500-token answer is 10–50s. Track them as separate SLOs." },
    { front: "How does constrained decoding enforce a schema?", back: "The schema compiles to a grammar/FSM; at each step, <strong>logits for tokens that cannot extend a valid document are masked</strong> before sampling. Engines: llama.cpp GBNF, Outlines, xgrammar, vLLM/SGLang guided decoding. First use of a schema pays a compile cost (then cached)." },
    { front: "Two ways schema-enforced output can still fail to parse", back: "<strong>Truncation</strong> — max-token cutoff mid-document (check stop reason before parsing); <strong>refusals</strong> — safety path returns non-conformant content (branch, don't retry). Also: providers support only a JSON Schema subset — no recursion, numeric ranges, length bounds." },
    { front: "The validate-and-repair retry loop", back: "Parse → validate (Pydantic/Zod) → on failure re-prompt with the <strong>specific validation error</strong> + bad output → bounded 2–3 attempts → dead-letter. Error-feedback repair beats blind regeneration; semantic checks stay here even with constrained syntax." },
    { front: "Over-constrained schema failure and its fix", back: "A required field the model can't honestly fill forces <strong>confident fabrication</strong> (constraint removes the honest out). Fix in schema design: nullable/optional fields, an explicit unknown/confidence signal, free-text notes — every required field must always be honestly answerable." },
    { front: "Tool-calling round trip, in order", back: "Declare tools (schema + trigger-condition description) → model returns tool-call turn (stop reason + call blocks with <strong>unique IDs</strong>) → validate + authorize + execute → return one result per ID (errors as error-flagged results), all in one message after the verbatim assistant turn → loop with an iteration cap." },
    { front: "Parallel tool call handling rules", back: "Execute concurrently; return <strong>all results in a single message</strong> matched by call ID. Splitting results across messages breaks pairing and trains the model out of parallelism. Parallel-unsafe (side-effecting) tools: disable parallel or serialize in the executor." },
    { front: "Canonical tool-calling failure modes", back: "Hallucinated tools/arguments; malformed argument JSON (cure: strict schemas); over-/under-calling (cure: trigger conditions in descriptions); oversized or vague results (truncate; explicit errors and empties); identical-call loops (cap + repeat detection); injection-driven calls (authorize in executor)." },
    { front: "Why is 'the model is a caller, not a principal' the tool-security rule?", back: "Prompt injection can make the model request anything, so identity and permissions must come from the <strong>authenticated session</strong>, enforced in the executor: per-user scoping, allowlists, confirmation for destructive actions. Prompt rules and fine-tuning only lower the hit rate." },
    { front: "Which HTTP errors to retry vs not", back: "<strong>Retry</strong> (with backoff): 429, 5xx, overload (529-style), timeouts, connection errors — honor <code>retry-after</code>. <strong>Don't retry</strong>: 400 (malformed), 401/403 (auth), 404 (bad model ID), safety refusals (product branch, not transient)." },
    { front: "Why full jitter in exponential backoff?", back: "A fleet that backs off deterministically retries in <strong>synchronized waves</strong>, re-saturating the rate limiter. Full jitter (random 0..cap) decorrelates clients. Pair with attempt + wall-clock budgets and a circuit breaker so incidents shed load instead of queueing it." },
    { front: "Timeout layering for LLM calls", back: "Connect timeout (seconds) → <strong>TTFT budget</strong> (~30–60s) → <strong>inter-chunk idle timeout</strong> (library read timeouts reset per chunk — enforce your own) → wall-clock cap sized to max_tokens ÷ decode rate. A timed-out request may still complete, bill, and fire side effects server-side." },
    { front: "What belongs in per-request cost telemetry?", back: "Input, output, <strong>cached-read</strong> (~0.1x), and <strong>reasoning</strong> tokens (billed as output, invisible in content) × a <em>versioned</em> price table; tagged by feature, tenant, model, prompt version. Alert on spend-per-request and cache-hit ratio; budget at the edge (per-user caps, loop iteration limits, model routing)." }
  ],
  lab: {
    title: "Lab: raw wire protocol — chat, SSE streaming, and a tool round trip with curl",
    html: `
<p><strong>Goal:</strong> touch the actual wire format the SDKs hide: one non-streaming completion, one SSE stream watched frame by frame, and one full tool-calling round trip — driven entirely with curl and jq. Runs free against a local Ollama model; an optional hosted-API variant costs a few cents.</p>

<h3>Prerequisites</h3>
<p>curl and jq installed. For the free path: <a href="https://ollama.com">Ollama</a> with a small tool-capable model (about a 2 GB download):</p>
<pre><code>ollama pull llama3.1:8b
# Ollama serves an OpenAI-compatible API on localhost:11434
BASE=http://localhost:11434/v1
MODEL=llama3.1:8b</code></pre>
<p>Hosted variant: set BASE/MODEL and an auth header for any OpenAI-compatible endpoint instead.</p>

<h3>Steps</h3>
<ol>
<li><strong>A plain completion — inspect the envelope.</strong>
<pre><code>curl -s "$BASE/chat/completions" -H 'Content-Type: application/json' -d '{
  "model": "'$MODEL'",
  "messages": [
    {"role": "system", "content": "You are terse."},
    {"role": "user", "content": "Why is the sky blue? One sentence."}
  ]
}' | tee resp.json | jq '{content: .choices[0].message.content,
       finish: .choices[0].finish_reason, usage: .usage}'</code></pre>
Note the three things production code always reads: content, <strong>finish reason</strong>, <strong>usage</strong>.</li>
<li><strong>Prove statelessness.</strong> Ask a follow-up ("Shorter.") <em>without</em> resending history — observe the model has no idea what you mean. Re-run with the full three-message transcript (system, first user, assistant answer, new user turn) and watch it work. You have just implemented chat memory.</li>
<li><strong>Watch a raw SSE stream.</strong>
<pre><code>curl -sN "$BASE/chat/completions" -H 'Content-Type: application/json' -d '{
  "model": "'$MODEL'", "stream": true,
  "messages": [{"role": "user", "content": "Count from 1 to 15 slowly, one number per line."}]
}'</code></pre>
Read the frames: <code>data:</code> lines each carrying a <code>chat.completion.chunk</code> with a tiny <code>delta</code>, ending in <code>data: [DONE]</code>. This is what your accumulator state machine consumes. Try piping through <code>grep --line-buffered "data:"</code> to see frame boundaries clearly.</li>
<li><strong>Simulate truncation.</strong> Re-run step 1 with <code>"max_tokens": 8</code> and inspect <code>finish_reason</code> — this is the 'complete-looking but truncated' case your parser must branch on before trusting output.</li>
<li><strong>Tool round trip, leg one.</strong> Declare a tool and elicit a call:
<pre><code>curl -s "$BASE/chat/completions" -H 'Content-Type: application/json' -d '{
  "model": "'$MODEL'",
  "messages": [{"role": "user", "content": "What is the weather in Lisbon right now?"}],
  "tools": [{"type": "function", "function": {
    "name": "get_weather",
    "description": "Get current weather. Call for any question about current conditions in a city.",
    "parameters": {"type": "object",
      "properties": {"city": {"type": "string"}},
      "required": ["city"]}}}]
}' | tee call.json | jq '.choices[0].message.tool_calls'</code></pre>
Note the call <strong>id</strong>, the name, and that <code>arguments</code> is a JSON <em>string</em> you must parse (and validate).</li>
<li><strong>Leg two: return the result keyed by ID and get the final answer.</strong> Build the follow-up transcript: original user message, then the assistant message from <code>call.json</code> verbatim, then:
<pre><code>{"role": "tool", "tool_call_id": "&lt;id from call.json&gt;",
 "content": "{\\"city\\": \\"Lisbon\\", \\"temp_c\\": 24, \\"conditions\\": \\"sunny\\"}"}</code></pre>
Send it with the same <code>tools</code> array and confirm the model folds your data into a natural-language answer. Then repeat, returning an error result instead ('{"error": "weather service timeout"}') and observe how the model adapts — errors are results too.</li>
<li><strong>Verify.</strong> You can narrate every hop of the loop from memory: request → tool-call turn with IDs → execute → results by ID → final answer; and you know where finish reasons, usage, and the arguments-are-a-string trap live on the wire.</li>
</ol>

<h3>Teardown</h3>
<p>Complete teardown — the local path holds no billable resources, only disk:</p>
<pre><code>rm -f resp.json call.json
ollama rm llama3.1:8b        # frees the model blob (~2 GB)
# stop the server if you started it manually: pkill ollama
unset BASE MODEL OPENAI_API_KEY ANTHROPIC_API_KEY</code></pre>
<p>If you used a hosted endpoint, check the provider console's usage page to confirm the lab's few-cent spend and that no keys were left in shell history you care about (<code>history -d</code> or rotate the key).</p>
`
  }
});
