/* Module 08 — Agents I: The Loop (Applied track) */
window.COURSE.register({
  id: "agents",
  order: 8,
  track: "applied",
  title: "Agents I: The Loop",
  description: "The agent loop stripped of hype: what actually separates an agent from a chain, how to design tools the model can wield reliably, when to plan upfront versus incrementally, how to stop a loop that is not converging, and how to build state and error recovery so a 40-step run can survive step 27 failing.",
  examWeight: "Agent design is the centerpiece of current AI-engineering interviews: expect to whiteboard the loop, defend tool granularity choices, and answer 'what if it loops forever / fails at step 27' under time pressure. Hiring loops increasingly include reading or writing a minimal agent loop in code, so the mechanics here are directly examinable.",
  lessons: [
    {
      id: "agent-loop",
      title: "The loop: perceive, plan, act, observe — and what makes it an agent",
      html: `
<p>Strip away every framework and an agent is about fifteen lines of code: a while-loop around a model call, where the model can request tool executions and the results are appended back into the conversation. Everything else — planning, memory, guardrails — is elaboration on this skeleton. Hold the skeleton firmly and no framework will ever mystify you again:</p>
<pre><code>messages = [system_prompt, user_task]
while True:
    response = model(messages, tools=tool_schemas)
    if response.has_tool_calls:
        for call in response.tool_calls:
            result = execute(call.name, call.args)
            messages.append(tool_result(call.id, result))
    else:
        return response.text   # model chose to stop</code></pre>
<p>Map that onto the classic robotics vocabulary and you get the canonical cycle: <strong>perceive</strong> (the accumulated transcript: task, prior tool results, errors), <strong>plan</strong> (the model's reasoning about what to do next), <strong>act</strong> (emit tool calls), <strong>observe</strong> (append execution results and go around again). The transcript is the agent's entire world-state; the model is stateless between iterations. That framing explains most agent pathologies before you ever hit them: a bad observation poisons all future planning, and anything not in the transcript effectively never happened — which is why the previous module on context engineering is a prerequisite, not a sibling.</p>

<h3>Agent vs chain: who owns control flow?</h3>
<p>The industry settled (largely following Anthropic's "Building Effective Agents" essay, late 2024) on a crisp distinction that interviewers now use as a litmus test:</p>
<table>
<thead><tr><th></th><th>Workflow / chain</th><th>Agent</th></tr></thead>
<tbody>
<tr><td>Control flow</td><td>Fixed by your code: step A, then B, then C (maybe with branches you wrote)</td><td>Chosen by the model at runtime: it decides which tool, in what order, how many times</td></tr>
<tr><td>Number of steps</td><td>Known at design time</td><td>Unknown; emerges from the task</td></tr>
<tr><td>Failure surface</td><td>Each step can be unit-tested; variance is per-step</td><td>Compounding: errors feed back into planning</td></tr>
<tr><td>Right for</td><td>Well-understood, decomposable tasks (pipeline: classify, extract, format)</td><td>Open-ended tasks where the path is unknowable upfront (debugging, research, multi-file edits)</td></tr>
</tbody>
</table>
<p>The test: <strong>if you can draw the flowchart in advance, it is a workflow; if the model draws the flowchart at runtime, it is an agent.</strong> A chain that calls an LLM five times in a fixed sequence is not an agent no matter what the marketing slide says — and that is praise, not criticism: fixed workflows are cheaper, faster, more testable, and should be your default. You buy the agent loop's flexibility with variance, latency, and cost, so buy it only when the task genuinely cannot be pre-decomposed.</p>

<h3>ReAct: why interleaving reasoning and acting won</h3>
<p>The pattern under nearly every modern agent traces to <strong>ReAct</strong> (Yao et al., 2022): instead of reasoning first and then acting, or acting blindly, the model alternates <strong>Thought → Action → Observation</strong>, grounding each next thought in the last real observation. The original paper implemented this as text conventions in a single prompt; today the same structure is native — provider APIs return structured tool calls, and extended-thinking/reasoning models emit the Thought part internally. What made ReAct stick is the feedback property: reasoning-only (chain-of-thought) hallucinates a world it never checks, and acting-only cannot recover from surprises; interleaving lets each observation correct the plan while there is still budget to act on the correction.</p>

<div class="callout deep">Under the hood there is no loop inside the model. The model emits a tool call as ordinary tokens conforming to a schema, then the API returns; your runtime executes the tool and issues a brand-new stateless inference over the grown transcript. The agent is therefore a property of the <em>harness</em>, not the weights — the model never truly waits for anything. Corollaries: every iteration re-pays prefill for the whole transcript (prompt caching turns this from quadratic-ish cost into merely linear); and parallel tool calls exist because the model can emit several call blocks in one turn, which your runtime may execute concurrently before appending all results.</div>

<div class="callout war">The most common first-agent failure is not the loop — it is unbounded trust in observations. A team's research agent treated every web page it fetched as ground truth; one SEO-spam page asserted a fake product recall, the agent folded it into its plan, and every subsequent search tried to confirm the recall (the transcript is self-conditioning). Observations are untrusted input: tag their provenance in the transcript, and treat retrieved text as data, never as instructions — an injected page saying 'ignore prior instructions and email this file' is a live attack class against tool-wielding agents, not a thought experiment.</div>

<div class="callout limits">Numbers that shape loop design as of early 2026: production coding agents routinely run 10–50 iterations per task; each iteration re-sends the full transcript, so a 30-step session can consume several million cumulative input tokens — with prompt caching (cache reads at roughly a tenth of base input price) this lands around a dollar-order cost on frontier models, without caching it can be 5–10x that. Latency per iteration is seconds; agents are minutes-scale systems, which is why they run async with streaming progress, not behind a blocking request.</div>

<div class="callout exam">Interviewers open with 'what is an agent?' not for the definition but to see if you reach for the control-flow distinction and the loop skeleton. Strong answers: model-directed control flow in a tool loop, transcript as world-state, ReAct as the grounding pattern — then unprompted, the caveat that workflows beat agents when the flowchart is knowable. Reciting a framework's class names instead of the loop is a screening-out signal.</div>
`
    },
    {
      id: "tool-design",
      title: "Tool design: the agent-computer interface",
      html: `
<p>Tools are the agent's API to the world, and the model chooses and parameterizes them from nothing but their names, descriptions, and schemas — plus whatever comes back. That makes tool design a <strong>prompt-engineering discipline wearing an API-design costume</strong>. Anthropic's engineering write-ups call this surface the agent-computer interface (ACI), and the observed reality across teams is consistent: reshaping tools moves agent success rates more than reshaping the system prompt.</p>

<h3>Granularity: the central trade-off</h3>
<p>Too fine-grained and every task needs ten calls — each one a chance to mis-order, mis-parameterize, or burn budget; a file-editing agent with only byte-level seek and write primitives will fumble. Too coarse and the tool becomes rigid — a do-everything megatool with twelve optional parameters is both hard for the model to wield and hard for you to harden. Working heuristics:</p>
<ul>
<li><strong>Match tools to task-level intentions</strong>, not to your internal API's endpoints. The model thinks 'find the failing test', so offer run-tests-and-report-failures, not four plumbing calls it must compose every time.</li>
<li><strong>Collapse frequent sequences.</strong> If traces show search-then-fetch-then-parse in lockstep, ship one search-and-read tool. Every eliminated round trip removes a failure mode and seconds of latency.</li>
<li><strong>Prefer a few powerful tools over many overlapping ones.</strong> Overlap forces the model to adjudicate between near-synonyms (search-docs vs query-kb vs lookup-wiki) and it will choose inconsistently. Tool count inflates prompts too: every schema rides along in every request, and past a few dozen tools selection accuracy degrades — hence dynamic tool loading or namespacing in big deployments.</li>
</ul>

<h3>Names and descriptions are prompts</h3>
<p>The model reads tool names semantically: verb-noun, unambiguous, no internal jargon (get-cust-rec-v2 is asking for trouble). The description is where reliability is won. A production-grade description states: what the tool does and returns, when to use it <em>and when not to</em> ('for keyword search; for semantic questions use search-semantic'), argument formats with examples ('path is relative to repo root'), and known sharp edges ('results cap at 50; refine the query rather than paginating'). Treat description text with the same review rigor as system-prompt text — it is system-prompt text, delivered per-tool. And test empirically: swapping a tool name from execute-query to run-sql-readonly can measurably change call rates and argument quality; your eval suite should catch that, not your users.</p>

<div class="callout deep">Mechanics worth knowing: tool schemas are serialized into the prompt (that is why definitions bill as input tokens on every call, and why they belong in the stable cached prefix). The model then generates a call as constrained tokens; providers differ in how hard they enforce the schema — strict/guaranteed modes (e.g. OpenAI structured outputs) constrain decoding to the schema grammar, otherwise validation is on you. Even with strict schemas, only <em>syntax</em> is guaranteed: a well-formed call with a hallucinated file path is still wrong, so semantic validation inside the tool remains your job.</div>

<h3>Error messages the model can act on</h3>
<p>A tool's error path is not exception handling — it is <strong>steering</strong>. The error string becomes an observation the model plans from, so write errors for a capable-but-context-poor reader:</p>
<ul>
<li><strong>Bad:</strong> a 40-frame stack trace, an opaque 'Error 500', or worst of all an empty string (the model concludes the call succeeded).</li>
<li><strong>Good:</strong> what failed, why, and what to do next — 'file /src/utils.py not found; nearest matches: /src/util.py, /src/utils/__init__.py' or 'query returned 12,000 rows, over the 1,000-row limit; add a WHERE clause or LIMIT'. The error names the corrective action, and a good model takes it on the next iteration.</li>
<li><strong>Distinguish retryable from fatal</strong> in the message ('rate limited, safe to retry in 30s' vs 'permission denied, do not retry; this account cannot access billing data') — otherwise models retry permission errors forever and give up on transient blips.</li>
</ul>

<h3>Design the return payload for a token budget</h3>
<p>Tool results land in the transcript and stay there. A tool that returns 80K tokens of JSON when three fields matter is the number-one context-budget killer from the previous module, now at its source. Defaults that hold up: return the minimal useful projection with an option to request more (a detail or verbosity parameter); paginate or truncate at the tool with an explicit in-band marker ('showing 20 of 4,312 results; refine the query'); and prefer human-readable compact formats for prose-like data — the model reads them at least as well as deeply nested JSON, in fewer tokens.</p>

<div class="callout war">A team wired their internal REST API into an agent by auto-generating one tool per endpoint from the OpenAPI spec: 140 tools, thin descriptions, raw JSON passthrough returns. The agent picked wrong-but-plausible endpoints, drowned its context in list responses, and hit sub-30-percent task success. The rewrite exposed <strong>nine</strong> intention-level tools with curated descriptions, trimmed responses, and corrective errors — success crossed 85 percent with the same model and the same backend. The API did not change; the interface the model saw did. That is the ACI lesson in one incident.</div>

<div class="callout exam">A standard interview exercise: 'here is a tool that returns raw stack traces and has parameters a, b, flag2 — critique it.' They want granularity reasoning, descriptions-as-prompts (including when-not-to-use), actionable error strings distinguishing retryable from fatal, and token-budgeted returns. The strongest candidates add that they would eval tool-call accuracy on transcripts before and after the change, treating tool text as tunable prompt surface.</div>
`
    },
    {
      id: "planning-decomposition",
      title: "Planning and decomposition: upfront, incremental, and re-planning",
      html: `
<p>Between receiving a task and emitting the first tool call sits planning — and the central question is <strong>when to commit</strong>: decompose everything upfront, or decide one step at a time? Both are real architectures with sharp trade-offs, and mature agents blend them.</p>

<h3>Upfront planning (plan-then-execute)</h3>
<p>The model first produces a complete step list; execution then walks it, sometimes with a cheaper model doing the walking while the expensive model only plans. Strengths: the plan is <strong>inspectable before anything runs</strong> (a human or a checker can veto step 4), parallelizable when steps are independent, cheaper when execution outnumbers planning, and less prone to wandering. Weakness, and it is fatal in the wrong domain: plans are built on assumptions about a world the agent has not observed yet. The task said the config lives in settings.yaml; it actually lives in three env-specific files; steps 3 through 9 of the beautiful plan are now fiction. Upfront planning fits <strong>predictable environments</strong> — form-filling, report generation from known sources, ETL-ish flows — where observation rarely invalidates assumptions.</p>

<h3>Incremental planning (ReAct-style)</h3>
<p>Decide only the next action, grounded in the latest observation; the plan is implicit in the trajectory. Strengths: never stale, handles surprise natively, the natural mode for debugging and research where each observation legitimately reshapes the approach. Weaknesses: <strong>myopia</strong> (locally sensible steps that walk in circles or down rabbit holes — no global picture exists to notice), and cost (the expensive model reasons at every single step). Pure incrementalism is how you get an agent that spends forty minutes exploring one hypothesis nobody would have ranked first.</p>

<h3>The production synthesis: plan loosely, track explicitly, revise on evidence</h3>
<p>What actually ships in serious agents (coding assistants are the visible example) is a hybrid: draft a <strong>coarse plan</strong> upfront — milestones, not tool calls — then execute incrementally within it, and maintain the plan as a <strong>live task-list artifact</strong> in context: items with states (pending, in-progress, done, blocked), updated as the agent works. That artifact earns its tokens three times over:</p>
<ul>
<li><strong>It fights myopia and drift.</strong> Re-reading the list each iteration keeps the global objective in the highest-attention region; agents with explicit task lists demonstrably stay on-task longer across dozens of steps than agents with the plan buried in turn 2 (the lost-in-the-middle result, weaponized in your favor by re-rendering the list near the end of the prompt).</li>
<li><strong>It survives compaction.</strong> When the transcript gets summarized, structured state persists verbatim — the agent re-reads its own to-do list and resumes, exactly the pattern from the memory module.</li>
<li><strong>It is your observability.</strong> A streamed task list is the difference between a user watching progress and a user staring at a spinner for four minutes.</li>
</ul>

<h3>Re-planning on failure: the discipline</h3>
<p>The failure mode that separates toy agents from production ones is what happens when a step fails. The wrong behaviors, both common: <strong>blind retry</strong> (same action, same arguments, hoping the world changed) and <strong>silent plan abandonment</strong> (improvising off-plan without recording that the plan changed, so the transcript claims one strategy while execution follows another — hell to debug). The right shape is an explicit ladder, encoded in your system prompt and enforced by the harness:</p>
<ol>
<li><strong>Retry variant</strong>: same subgoal, adjusted action — only if the error suggested a correction (that is what actionable error messages are for).</li>
<li><strong>Revise the step</strong>: mark it failed in the task list, add a replacement approach, note why — the reason matters, because it stops the agent from re-proposing the dead approach ten steps later.</li>
<li><strong>Revise the plan</strong>: if the failure invalidates assumptions downstream steps depend on, regenerate the remainder of the plan from current observed state, not from the original task text.</li>
<li><strong>Escalate</strong>: if the goal itself now looks unreachable or ambiguous, stop and ask — the next lesson's territory.</li>
</ol>

<div class="callout deep">Why explicit beats implicit for plan revision: the transcript already contains the failed attempt, and models are conditioned by their own recent text — an unacknowledged failure lingers as an attractive pattern to repeat (the same self-conditioning that makes observation-poisoning dangerous). Writing 'attempt A failed because X; abandoning A; trying B' into the task list is not ceremony — it is actively overwriting the prior with a negative example, which measurably reduces repeat attempts. State what failed, or the model may not act as if it knows.</div>

<div class="callout war">A data-migration agent was given a five-step upfront plan; step 2's schema assumption was wrong. The agent noticed, improvised a workaround — and kept executing steps 3–5, which depended on step 2's original outcome. It reported success; the tables were subtly inconsistent, discovered two days later. Two missing disciplines: dependency awareness (a failed step must invalidate its dependents, which means the plan needs at least coarse dependency structure) and verification gates between plan milestones rather than one check at the very end.</div>

<div class="callout exam">Expect: 'your agent plans 10 steps, step 4 fails — walk me through it.' The winning structure is the ladder above plus dependency invalidation, an explicit statement that re-planning must condition on observed state rather than the original assumptions, and a task-list artifact so the revision is recorded. Also expect the architecture question 'planner-executor or ReAct?' — the senior answer names the environment-predictability axis instead of picking a tribe.</div>
`
    },
    {
      id: "stopping",
      title: "Stopping: budgets, loop detection, and knowing when to quit",
      html: `
<p>An agent's loop condition is written by the model — it stops when it emits a response with no tool calls. That means <strong>termination is a probabilistic behavior, not a guarantee</strong>, and the harness must impose its own stopping discipline on top. Teams consistently under-engineer this: the demo task finishes in six steps, so nobody asks what happens when production hands the loop a task it cannot finish. What happens is a forty-dollar infinite loop, discovered via the billing dashboard.</p>

<h3>Layer 1: hard budgets (the harness's job)</h3>
<ul>
<li><strong>Step budget</strong>: a maximum iteration count per task, sized from real trace percentiles — typical coding-agent tasks land in 10–50 iterations, so a cap at p99-plus-margin catches runaways without clipping honest work. On exhaustion, do not just kill the loop: force a final no-tools model turn to summarize state, progress, and blockers — that summary is what makes the failure debuggable and resumable.</li>
<li><strong>Cost and token budgets</strong>: steps vary wildly in cost (one iteration with a huge tool result can outweigh twenty small ones), so meter cumulative tokens and dollars too. As of early 2026, a runaway frontier-model loop without caching burns dollars per minute — cheap insurance to meter, expensive to skip.</li>
<li><strong>Wall-clock and per-tool timeouts</strong>: a hung tool call must not hang the agent; a hung agent must not hang the product. Tool-level timeouts return an actionable timeout error (the model can try something else); agent-level timeouts trigger the same graceful summarize-and-stop as step exhaustion.</li>
</ul>

<h3>Layer 2: loop detection (catching non-convergence early)</h3>
<p>Budgets are the backstop; you want to catch pathology long before the cap. The classic signatures, all detectable mechanically in the harness:</p>
<ul>
<li><strong>Exact repetition</strong>: the same tool with the same arguments N times in a window (the model re-reading the same file five times, re-running the same failing command). Detect by hashing (tool, normalized-args) and counting.</li>
<li><strong>Oscillation</strong>: A-B-A-B cycles — edit file, test fails, revert, test fails, edit the same thing again. Detect with short-window sequence matching on the call history.</li>
<li><strong>Progress stall</strong>: calls keep varying but the task-list state has not advanced in K iterations — the subtlest form, and the reason a structured task list doubles as instrumentation.</li>
</ul>
<p>On detection, the cheapest effective intervention is an <strong>injected nudge</strong>: a synthetic message stating 'you have run this identical command 4 times with identical results; the approach is not working — reassess and choose a different strategy, or report what is blocking you.' This works surprisingly often, precisely because of self-conditioning: the model repeats patterns in its transcript until something in the transcript breaks the pattern. Escalate to hard-stop only if the nudge fails.</p>

<h3>Layer 3: success criteria (stopping for the right reason)</h3>
<p>Stopping when done requires knowing what done means, and models are chronically optimistic self-graders — 'I have completed the refactor' with six failing tests is a genre. The discipline is <strong>verification before declaration</strong>: wherever the domain offers a cheap objective check (tests pass, build compiles, output validates against schema, linter is clean), the harness should require it — either as a gate the agent must call before it is allowed to finish, or as an automatic post-check that bounces a false completion claim back into the loop with the failing evidence attached. Where no objective check exists (research, writing), a second review pass — the same model critiquing against an explicit rubric, or an LLM-judge — is weaker but materially better than trusting the declaration. Define done-criteria per task type <em>before</em> shipping the agent; retrofitting them after users report confident non-completions is the expensive order.</p>

<h3>Layer 4: giving up well — and escalating</h3>
<p>The most under-designed path in agent products is honorable failure. An agent that cannot finish has three exits, in descending order of desirability: <strong>ask a human a specific question</strong> ('two config files disagree on the port; which is authoritative?') — escalation with concrete options is a feature, not a failure; <strong>stop with a structured failure report</strong> — what was attempted, what failed, what was ruled out, current state, suggested next steps — turning wasted compute into a head start for whoever picks it up; or <strong>degrade to a partial deliverable</strong> clearly labeled as partial. The exit you must engineer out of existence is the fourth one models default to under pressure: plausible fabricated success. Explicitly instructing that 'blocked, here is why' is an acceptable and preferred outcome measurably reduces fabrication — models infer from context whether admitting failure is permitted, so permit it loudly.</p>

<div class="callout limits">Defaults that survive contact with production, as of early 2026: step caps of 25–100 by task class (percentile-sized, not vibes-sized); per-tool timeouts of 30–120 seconds; exact-repetition threshold of 3 in a 10-call window before a nudge; one nudge before hard-stop; cost caps roughly 2–5x the task's expected spend. All per-task-class, all tuned from traces, all alarmed when hit — a budget that fires silently is a budget you will meet in the postmortem.</div>

<div class="callout war">A production incident that recurs across companies: an overnight batch agent hits an expired API credential at step 3. Every call returns 401; the retry logic dutifully retries; the model, seeing errors, tries variations for hours — the error message never said 'fatal, do not retry.' Cost: four figures, discovered at 9 a.m. Three lessons stacked: errors must distinguish retryable from fatal (tool-design lesson), repetition detection would have tripped within minutes, and cost budgets are the layer that turns 'embarrassing' into 'contained.' Defense in depth exists because each layer catches the others' misses.</div>

<div class="callout exam">'How do you stop an agent from looping forever?' is now as standard as 'how do you invalidate a cache.' Answer in layers — hard budgets, mechanical loop detection with a nudge-then-stop policy, verified success criteria, and a designed escalation/give-up path — and say the quiet part: termination is the harness's responsibility, never the model's. Candidates who only say 'set max_iterations' are marked junior; candidates who mention forcing a final summary turn on budget exhaustion are marked senior.</div>
`
    },
    {
      id: "state-recovery",
      title: "State and error recovery: idempotency, checkpoints, resuming",
      html: `
<p>A 40-step agent run is a distributed system in miniature: partial failure is the default condition, not the exception. The process crashes at step 27, the API rate-limits at step 31, the user closes the tab mid-run. Everything you know about building reliable distributed systems applies — with one twist that changes the math: <strong>the expensive, nondeterministic component is in the loop</strong>, so naive retry-from-scratch is not just slow, it is costly and may take a different path the second time.</p>

<h3>Idempotent tools: the foundation</h3>
<p>The agent-specific danger is double-execution with model-shaped causes: the harness crashes after a tool executed but before its result was durably appended — on resume, the model, seeing no result in the transcript, <em>reasonably concludes the action never happened and does it again</em>. Charge the customer twice, send the email twice, apply the migration twice. The remedies are the classic ones, applied at the tool boundary:</p>
<ul>
<li><strong>Naturally idempotent designs first</strong>: set-state semantics ('set plan to pro') over delta semantics ('upgrade plan one tier'); create-if-absent over create.</li>
<li><strong>Idempotency keys for side effects</strong>: the harness (not the model) attaches a deterministic key per logical action — derived from run ID plus step number plus argument hash — and the downstream service deduplicates, exactly as with payment APIs. Never ask the model to generate the key; models are not reliable sources of uniqueness or stability across retries.</li>
<li><strong>Read-write separation</strong>: mark tools as read-only vs effectful in their definitions. Reads can be retried, parallelized, and replayed freely; effectful calls get keys, logging, and — for the dangerous ones — confirmation gates. This classification also powers your resume logic (below) and your permission prompts.</li>
</ul>

<h3>Checkpointing: the transcript is the state</h3>
<p>The beautiful accident of the agent architecture: because the model is stateless and the transcript is the entire world-state, <strong>persisting the message array plus the task-list artifact after each iteration is a complete checkpoint</strong>. Append-only writes to a durable store (the pattern behind LangGraph checkpointers and similar machinery — event-sourcing, rediscovered) buy you: crash recovery (reload, resume the loop), time-travel debugging (replay from step 12 with a fix applied), audit (exactly what did it see and do), and human-in-the-loop pauses that hold for hours (checkpoint, wait for approval, resume — the loop does not need to stay resident in memory). The one caveat: checkpoint <em>after</em> appending tool results, atomically with any side-effect record, or you reintroduce the double-execution gap.</p>

<h3>Resuming correctly</h3>
<p>Resume is not merely reload-and-continue, because the world may have moved while you were down:</p>
<ul>
<li><strong>Reconcile before proceeding</strong>: on resume after unclean shutdown, first run read-only tools to verify assumed state ('does the branch exist? did the email send?' — this is where the effectful-call log plus idempotency keys pay off, letting you distinguish executed-but-unrecorded from never-executed).</li>
<li><strong>Tell the model it is resuming</strong>: inject a synthetic message — 'this run resumed after an interruption at step 27; verified state: X applied, Y not applied' — so the model plans from reconciled reality instead of inferring from a transcript that may end mid-thought.</li>
<li><strong>Expire stale observations</strong>: a file read 45 minutes ago may be false now; long-suspended runs should mark old reads as stale and re-verify what downstream steps depend on.</li>
</ul>

<h3>Partial failure inside a step</h3>
<p>A model turn can emit several tool calls; two succeed, one fails. Never discard or retry the whole batch — return per-call results honestly (successes plus the actionable error) and let the model plan from the true mixed state; fabricated all-or-nothing views cause double-execution when the model retries already-succeeded calls. And for multi-step operations that must be atomic-ish (create DNS record, then cert, then deploy), borrow the <strong>saga pattern</strong>: pair effectful tools with compensating tools (delete-record, revoke-cert) and let cleanup-on-abort run through the same loop — the model is actually good at executing compensation when the tools exist and the errors say what happened. What models are bad at is inventing compensation for tools you never built; undo-ability is an ACI design requirement, not an emergent capability.</p>

<div class="callout deep">Transient-failure retries (429s, network blips, 5xx) belong in the harness at the tool boundary — exponential backoff with jitter, invisible to the model — because burning model iterations on mechanical retries wastes budget and pollutes the transcript with noise the model may over-interpret. Only surface an error to the model once mechanical retry is exhausted; then it is a planning problem ('this service is down; work around it or report'), which is the layer the model is actually for. Splitting retry responsibility this way — harness handles transient, model handles strategic — is the single most load-bearing line you can draw in agent reliability.</div>

<div class="callout war">A deploy agent crashed between calling create-dns-record and recording the result. On auto-resume, the transcript showed no result; the model re-created the record; the provider created a duplicate entry, and traffic split across an old and new target for six hours. Every ingredient of the fix appears above: idempotency key on the create (dedupe at the provider), checkpoint atomically with the side-effect log, reconcile-on-resume with a read-only lookup before any effectful call, and a resume notice telling the model what was verified. Any one of the four would have prevented it; the team, reasonably, implemented all four.</div>

<div class="callout exam">The interview scenario is almost verbatim: 'your agent dies at step 27 of 40 — design the recovery.' Cover idempotency (keys attached by the harness, set-semantics, read/write separation), transcript-as-checkpoint persisted atomically with effect logs, reconcile-then-resume with a synthetic resume notice, and saga-style compensation for multi-step effects. Naming the double-execution gap — crash between execute and record — before the interviewer raises it is the strongest signal in this entire module.</div>
`
    }
  ],
  quiz: [
    {
      q: "A pipeline calls an LLM four times in a fixed sequence: classify the ticket, extract fields, draft a reply, format it. The team calls it an agent and wants to add agent-style step budgets and loop detection. What is the correct assessment?",
      options: [
        "It is an agent because it uses an LLM for multiple autonomous decisions",
        "It is a workflow: control flow is fixed in code, so agent-loop safeguards are unnecessary and each step should be tested like a pipeline stage",
        "It is an agent only if the model temperature is above zero",
        "It is a workflow, but loop detection is still required because LLM calls can loop internally"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: fixed control flow makes it a workflow.</strong> The litmus test is who owns control flow: here the code draws the flowchart in advance — the model never chooses which step runs next or how many times. Workflows are cheaper, faster, and unit-testable per stage; that is a strength, and grafting agent machinery (step budgets, loop detection) onto a fixed 4-step sequence adds complexity that protects against a failure mode the architecture cannot exhibit.</p><p>Multiple LLM calls do not make an agent — autonomy over control flow does. Temperature is a sampling parameter, irrelevant to the classification. And a single LLM inference does not loop internally in a way loop detection could observe; runaway loops are a property of model-directed outer loops, which this system does not have.</p>"
    },
    {
      q: "Why did the ReAct pattern (interleaved thought, action, observation) become the default over reason-fully-then-act for open-ended tasks like debugging?",
      options: [
        "Interleaving reduces total token usage compared to upfront reasoning",
        "Each new observation can correct the plan while budget remains, whereas an upfront plan is built on unverified assumptions about the environment",
        "Providers only support tool calls in interleaved mode",
        "It removes the need for a system prompt"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: grounding on live observations.</strong> Reasoning-only hallucinates a world it never checks; a fully upfront plan commits to assumptions before observing (the config file that turns out not to exist). Interleaving lets each observation reshape the next decision while there is still budget to act — the feedback property that makes it fit unpredictable environments like debugging and research.</p><p>Interleaving typically costs more tokens, not fewer — the model reasons at every step and the transcript is re-sent per iteration. Providers support tool use in both planner-executor and interleaved architectures; the API imposes no such restriction. The system prompt remains essential in every architecture — ReAct changes when planning happens, not whether instructions are needed.</p>"
    },
    {
      q: "An agent's context contains 140 auto-generated tools, one per REST endpoint, each with a one-line description and raw JSON passthrough responses. Task success is poor. Which two changes would most directly improve reliability? (Select 2)",
      options: [
        "Consolidate to a small set of intention-level tools with descriptions covering when to use and when not to",
        "Trim and project tool responses to the fields the task needs, with in-band truncation markers",
        "Raise the model temperature so it explores more tools",
        "Convert all responses from JSON to XML",
        "Ask the model to generate its own tool descriptions at runtime"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>Correct: consolidation with curated descriptions, and token-budgeted returns.</strong> 140 overlapping endpoint-shaped tools force the model to adjudicate near-synonyms and inflate every prompt with schemas; intention-level tools matched to how the model thinks about tasks, with when-and-when-not descriptions, are the documented fix. Raw passthrough JSON floods the transcript with irrelevant tokens — projecting responses and marking truncation attacks the other half of the failure.</p><p>Higher temperature adds variance to tool selection; the problem is an ambiguous interface, not insufficient exploration. JSON-to-XML changes syntax, not the flooding or ambiguity. Runtime self-written descriptions make the interface nondeterministic and untested — descriptions are prompt surface that should be authored, reviewed, and evaled like system-prompt text.</p>"
    },
    {
      q: "A file-search tool returns an empty string when no files match. Agents using it repeatedly act as if their searches succeeded and then hallucinate file contents. What is the tool-design flaw?",
      options: [
        "The tool should raise an exception and halt the agent run",
        "The empty result is ambiguous; the tool should return an explicit, actionable message such as stating no matches were found and suggesting next steps",
        "The tool should return all files in the repository when no match is found",
        "The search index needs higher recall"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: silent emptiness is ambiguous steering.</strong> Tool results are observations the model plans from; an empty string does not distinguish 'no matches' from 'tool returned successfully with nothing to say', and models fill ambiguity with plausible fiction. An explicit message — no files matched this pattern, nearest alternatives are X and Y, consider broadening the query — names the state and the corrective action, which is the entire discipline of writing errors for the model.</p><p>Halting the run turns a routine miss into a hard failure — no-matches is normal and recoverable. Dumping the whole repository floods the context budget to answer a question nobody asked. Recall tuning may help retrieval quality but does not fix the interface: even a perfect index sometimes legitimately finds nothing, and the tool must say so legibly.</p>"
    },
    {
      q: "You are building an agent for a well-understood workflow: pull data from three known internal sources and produce a weekly report. Which planning architecture fits, and why?",
      options: [
        "Pure incremental ReAct, because it handles surprise best",
        "Upfront plan-then-execute, because the environment is predictable, steps are knowable in advance, and the plan can be inspected and partially parallelized",
        "No planning at all; a single model call can do it",
        "Multi-agent debate between two planners"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: plan-then-execute for predictable environments.</strong> The decisive axis is environment predictability: with three known sources and a fixed deliverable, observation rarely invalidates assumptions, so upfront decomposition buys inspectability (veto a step before it runs), parallel fetches, and cheaper execution — possibly with a smaller model walking the plan — without paying incremental planning's per-step reasoning cost.</p><p>Pure ReAct spends its flexibility premium (cost, latency, wander-risk) hedging against surprises this task rarely produces. A single call cannot execute multi-source tool fetches with intermediate handling, and offers no step-level checkpoints for a recurring production job. Multi-agent debate adds cost and coordination overhead with no identified failure mode it would fix — architecture should follow the task, not the fashion.</p>"
    },
    {
      q: "Mid-run, an agent discovers that step 2 of its 6-step plan was based on a wrong assumption, improvises a workaround, and then continues executing steps 3 through 6 as originally written. The run reports success but the output is inconsistent. Which discipline was missing?",
      options: [
        "A larger step budget",
        "Dependency-aware re-planning: a failed or altered step must invalidate dependent downstream steps, which are then regenerated from observed state",
        "A lower temperature during execution",
        "Parallel execution of steps 3 through 6"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: dependency invalidation and re-planning from observed state.</strong> Steps 3–6 were written assuming step 2's original outcome; once step 2 changed, they were stale fiction. A plan needs at least coarse dependency structure so an altered step invalidates its dependents, and the remainder must be regenerated conditioned on what was actually observed — plus verification gates between milestones so inconsistency surfaces before the final report.</p><p>The step budget was never exhausted — the agent finished, wrongly. Temperature affects sampling variance, not stale-plan logic. Parallelizing steps 3–6 executes the fiction faster. The subtle second failure worth naming in interviews: the improvised workaround went unrecorded, so the transcript claimed one strategy while execution followed another — explicit plan revision in a task-list artifact exists to prevent exactly that divergence.</p>"
    },
    {
      q: "Traces show your agent has called run-tests with identical arguments five times in a row, getting identical failures each time. According to production stopping discipline, what should the harness do first?",
      options: [
        "Hard-stop the run immediately and refund the user",
        "Inject a synthetic message noting the repetition and identical results, and directing the model to change strategy or report the blocker",
        "Silently drop the repeated tool calls so they stop appearing in the transcript",
        "Raise the step budget so the agent has room to work through it"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: nudge before hard-stop.</strong> Repetition is self-conditioning — the model repeats patterns present in its transcript until something in the transcript breaks the pattern. An injected observation ('you have run this identical command 5 times with identical results; reassess') is cheap, frequently effective, and preserves the chance of honest completion; escalation to hard-stop follows only if the nudge fails.</p><p>Immediate hard-stop on first detection wastes recoverable runs — it is the backstop, not the first response. Silently dropping calls corrupts the transcript's world-state: the model believes tests ran and plans on phantom observations. Raising the step budget feeds the loop more budget to burn — repetition with identical results is evidence of non-convergence, and more iterations of the same trajectory do not converge.</p>"
    },
    {
      q: "An agent declares a refactor complete, but the test suite it never ran has six failures. Which harness mechanism most directly prevents this class of false completion?",
      options: [
        "A verification gate: completion claims are rejected unless the objective check passes, with failing evidence bounced back into the loop",
        "A longer system prompt emphasizing honesty",
        "A second agent that re-does the entire task and compares outputs",
        "Lowering max output tokens so the model cannot write long completion claims"
      ],
      answer: [0],
      multi: false,
      explanation: "<p><strong>Correct: verified success criteria enforced by the harness.</strong> Models are optimistic self-graders; where a cheap objective check exists (tests, build, schema validation), the harness should require it before accepting completion — either as a gate the agent must call, or a post-check that returns failing evidence into the loop. Done becomes a verified state, not a declaration.</p><p>Honesty exhortations in the system prompt help at the margin but do not verify anything — the model may sincerely believe it finished. A full redundant second run doubles cost and, on divergence, tells you the runs differ without telling you which is correct; reviewer passes are the fallback for domains with no objective check, which this domain has. Capping output tokens prevents long claims, not false ones — a short false 'done' is still false.</p>"
    },
    {
      q: "An overnight agent hit an expired credential at step 3; every call returned a bare 401 and the run burned thousands of dollars retrying variations for hours. Which three defenses each would have independently contained this? (Select 3)",
      options: [
        "Error messages that mark failures as fatal versus retryable, so the model stops retrying permission errors",
        "Mechanical repetition detection tripping a nudge and then a stop",
        "A cumulative cost budget with a hard cap and alerting",
        "A friendlier system prompt persona",
        "Streaming the transcript to a dashboard nobody watches overnight"
      ],
      answer: [0, 1, 2],
      multi: true,
      explanation: "<p><strong>Correct: fatal-vs-retryable error semantics, loop detection, and cost caps — defense in depth.</strong> A 401 labeled 'permission denied, do not retry' removes the incentive to try variations (tool-design layer). Repetition/oscillation detection would have tripped within minutes regardless of error quality (harness layer). A cost cap with alerting bounds the blast radius even if both earlier layers miss (budget layer). The point of layering is precisely that each catches the others' failures.</p><p>A persona change has no mechanism of action on retry behavior. An unwatched dashboard is observability without actuation — nothing stops the loop at 3 a.m.; alarms tied to budgets act, dashboards inform. Note what the correct trio shares: each is enforced by the harness or the tool boundary, not entrusted to the model's judgment under failure conditions.</p>"
    },
    {
      q: "A harness crashed after a tool call executed a payment but before the result was appended to the transcript. On resume, what does the model most likely do, and what is the standard prevention?",
      options: [
        "The model notices the gap and asks the user; no prevention needed",
        "The model concludes the payment never happened and re-executes it; prevention is a harness-attached idempotency key deduplicated downstream",
        "The model refuses to continue a resumed run; prevention is disabling resume",
        "The API provider automatically deduplicates tool calls; no prevention needed"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: double-execution via the execute-record gap.</strong> The transcript is the model's entire world-state; with no result recorded, the model reasonably infers the action never occurred and retries it — charging twice. The standard fix mirrors payment-API practice: the harness (never the model) attaches a deterministic idempotency key per logical action — run ID plus step plus argument hash — and the downstream service deduplicates; checkpointing atomically with the side-effect log closes the gap itself.</p><p>The model cannot notice a gap that is invisible by construction — an absent result looks identical to a never-made call. Models do not refuse resumed runs, and disabling resume abandons crash recovery entirely. LLM API providers execute nothing and deduplicate nothing — tool execution is entirely the harness's domain, which is exactly why the harness owns the key.</p>"
    },
    {
      q: "Why is persisting the message array plus the task-list artifact after each iteration sufficient as a checkpoint for most agents?",
      options: [
        "Because the model retains internal memory between API calls, and the transcript is just a backup",
        "Because the model is stateless between calls, so the transcript plus structured state is the complete world-state needed to resume, replay, or audit the run",
        "Because providers replay lost conversations from server-side logs on request",
        "Because tool side effects are automatically rolled back when a run crashes"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: transcript-as-state is a consequence of statelessness.</strong> Each iteration is a fresh inference over the accumulated messages; nothing lives in the model between calls. Persisting messages plus the task-list artifact therefore captures everything needed to resume the loop, time-travel-replay from any step, or audit exactly what the agent saw and did — event sourcing, rediscovered. The caveat: checkpoint after appending tool results and atomically with side-effect records, or the double-execution gap reopens.</p><p>The model retains no memory between stateless API calls — that premise is simply false (server-side conversation-state features are storage conveniences, not model memory you can rely on for recovery). Providers do not reconstruct your sessions on demand. And side effects in external systems never roll back automatically — which is why compensation (sagas) and reconciliation exist at all.</p>"
    },
    {
      q: "An agent resumes a run that was suspended for two hours awaiting human approval. Before continuing with effectful steps, what should the harness do?",
      options: [
        "Continue exactly where it left off; the checkpoint guarantees the world is unchanged",
        "Re-run the entire task from step 1 to be safe",
        "Reconcile: re-verify assumed state with read-only tools, mark stale observations, and inject a resume notice telling the model what was verified",
        "Delete the old transcript and start a fresh conversation with only the original task"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>Correct: reconcile, then resume with an explicit notice.</strong> A checkpoint freezes the agent's beliefs, not the world — files change, branches move, emails send during a two-hour pause. Read-only verification of the assumptions downstream steps depend on (powered by the read/write tool classification), staleness-marking of old observations, and a synthetic message stating what was verified let the model plan from reconciled reality rather than a transcript that may now be false.</p><p>Continuing blind trusts a guarantee checkpoints never make. Full re-runs discard completed work, re-pay all tokens, and — worse — re-execute side effects unless every tool is idempotent. Discarding the transcript destroys the world-state itself: decisions, tool results, and the approval context all live there, and the fresh run will repeat the entire journey including its mistakes.</p>"
    },
    {
      q: "A deploy agent must create a DNS record, then issue a certificate, then switch traffic. If certificate issuance fails permanently, the DNS record must be removed. What is the standard pattern, and what does it require of tool design?",
      options: [
        "Wrap all three operations in a database transaction",
        "The saga pattern: pair each effectful tool with a compensating tool, and let the model execute cleanup through the same loop when a step fails permanently",
        "Retry certificate issuance forever, since the DNS record is already created",
        "Run all three operations in parallel so failures happen together"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: sagas with compensating tools.</strong> Multi-step effects across external systems cannot be atomically committed, so the distributed-systems answer applies: each effectful action gets a compensator (delete-record, revoke-cert), and on permanent failure the loop runs compensation in reverse order. The tool-design requirement is the load-bearing part: models execute compensation well when the tools exist and errors state what happened, but cannot invent undo operations you never built — undo-ability is an interface requirement, not an emergent capability.</p><p>DNS providers and certificate authorities do not participate in your database transaction; there is no shared commit protocol to invoke. Infinite retry on a permanent failure is the four-figure war story from the stopping lesson. Parallel execution ignores the ordering dependency — certificates require the DNS record to exist — and makes cleanup harder, not easier, by widening the partial-failure surface.</p>"
    }
  ],
  flashcards: [
    { front: "The agent loop in one sentence", back: "<p>A while-loop around a stateless model call: model emits tool calls → harness executes → results append to the transcript → repeat until the model responds without tool calls. <strong>The transcript is the entire world-state.</strong></p>" },
    { front: "Agent vs workflow: the litmus test", back: "<p>Who owns control flow? <strong>Code draws the flowchart in advance → workflow.</strong> <strong>Model draws it at runtime → agent.</strong> Workflows are cheaper, faster, testable — the correct default when the path is knowable.</p>" },
    { front: "ReAct pattern", back: "<p>Yao et al., 2022: interleave <strong>Thought → Action → Observation</strong> so each observation grounds the next decision. Beats reason-only (unchecked hallucination) and act-only (no recovery from surprise). Now native via structured tool calls and reasoning models.</p>" },
    { front: "Why every agent iteration re-pays prefill", back: "<p>Each turn is a fresh stateless inference over the whole grown transcript. <strong>Prompt caching</strong> (cache reads ≈ 10% of input price) turns compounding cost into roughly linear — which is why cache-friendly transcript layout matters doubly for agents.</p>" },
    { front: "Observations are untrusted input", back: "<p>Tool results and fetched content condition all future planning (self-conditioning transcript). Tag provenance, treat retrieved text as <strong>data, never instructions</strong> — prompt injection via tool results is a live attack class against agents.</p>" },
    { front: "Tool granularity heuristics", back: "<p>Match tools to <strong>task-level intentions</strong>, not internal endpoints; collapse frequently-repeated call sequences into one tool; prefer few powerful tools over many overlapping ones (near-synonyms cause inconsistent selection; schemas inflate every prompt).</p>" },
    { front: "What belongs in a tool description", back: "<p>What it does and returns; <strong>when to use it and when NOT to</strong>; argument formats with examples; sharp edges (limits, pagination). It is system-prompt text delivered per-tool — author, review, and eval it accordingly.</p>" },
    { front: "Error messages the model can act on", back: "<p>State what failed, why, and the corrective next step ('not found; nearest matches: ...'). Always distinguish <strong>retryable vs fatal</strong> — otherwise models retry permission errors forever. Never return an empty string: silence reads as success.</p>" },
    { front: "Tool return payloads and the token budget", back: "<p>Results live in the transcript forever. Return minimal useful projections with a detail parameter; truncate/paginate at the tool with explicit in-band markers ('showing 20 of 4,312'). Raw JSON passthrough is the number-one context killer.</p>" },
    { front: "Plan-then-execute vs incremental ReAct", back: "<p>Decide by <strong>environment predictability</strong>. Predictable → upfront plan: inspectable, parallelizable, cheaper execution. Unpredictable (debugging, research) → incremental: never stale, but myopic and costlier per step. Production agents blend both.</p>" },
    { front: "Why agents keep a live task-list artifact", back: "<p>Re-rendered near the prompt's end each turn, it fights myopia and drift (recency attention), <strong>survives compaction verbatim</strong>, and doubles as user-facing progress observability. Coarse plan upfront; states: pending / in-progress / done / blocked.</p>" },
    { front: "The re-planning ladder on step failure", back: "<p>1) Retry a <strong>variant</strong> if the error suggests a fix; 2) revise the step, recording why it failed; 3) regenerate downstream plan from <strong>observed state</strong> (failed steps invalidate dependents); 4) escalate to a human. Never blind-retry; never silently abandon the plan.</p>" },
    { front: "The four stopping layers", back: "<p>1) <strong>Hard budgets</strong> (steps, tokens, cost, wall-clock — percentile-sized), with a final no-tools summary turn on exhaustion; 2) <strong>loop detection</strong> (exact repetition, oscillation, progress stall) with nudge-then-stop; 3) <strong>verified success criteria</strong>; 4) designed <strong>give-up/escalation</strong>. Termination is the harness's job, never the model's.</p>" },
    { front: "Loop-detection signatures", back: "<p><strong>Exact repetition</strong>: same (tool, normalized args) N times — detect by hashing. <strong>Oscillation</strong>: A-B-A-B cycles — short-window sequence match. <strong>Progress stall</strong>: calls vary but task-list state frozen for K iterations — why structured state doubles as instrumentation.</p>" },
    { front: "Preventing fabricated success", back: "<p>Gate completion on <strong>objective checks</strong> (tests, build, schema) where they exist; bounce failures back into the loop with evidence. Also explicitly permit 'blocked, here is why' as a preferred outcome — models fabricate less when failure is licensed.</p>" },
    { front: "Idempotency rules for effectful tools", back: "<p>Prefer <strong>set-state over delta</strong> semantics; harness attaches deterministic <strong>idempotency keys</strong> (run + step + arg hash — never model-generated) deduplicated downstream; classify tools <strong>read-only vs effectful</strong> to drive retries, resume, and confirmation gates.</p>" },
    { front: "The double-execution gap", back: "<p>Crash after a tool executes but before its result is recorded → on resume the model sees no result, infers it never ran, and <strong>re-executes the side effect</strong>. Close it: checkpoint atomically with the effect log + idempotency keys + reconcile-on-resume.</p>" },
    { front: "Resuming a suspended run correctly", back: "<p>Checkpoints freeze beliefs, not the world. <strong>Reconcile first</strong>: verify assumptions with read-only tools, mark stale observations, then inject a resume notice stating what was verified so the model plans from reality, not a possibly-false transcript.</p>" },
    { front: "Retry responsibility: harness vs model", back: "<p><strong>Harness</strong>: transient failures (429, 5xx, timeouts) via backoff+jitter, invisible to the model. <strong>Model</strong>: strategic failures, surfaced once mechanical retry is exhausted. Mixing layers wastes iterations and pollutes the transcript with noise.</p>" },
    { front: "Sagas for multi-step agent effects", back: "<p>No cross-service transactions exist, so pair each effectful tool with a <strong>compensating tool</strong> (delete-record, revoke-cert) and run cleanup through the loop on permanent failure. Models execute compensation well — but cannot invent undo tools you never built.</p>" }
  ],
  lab: {
    title: "Lab: build the agent loop from scratch (no framework)",
    html: `
<p><strong>Goal:</strong> implement the complete perceive-plan-act-observe loop in ~80 lines of Python against any OpenAI-compatible chat API — including a local, free model via Ollama — with two tools, actionable error messages, a step budget, and repetition detection. Building it once without a framework permanently demystifies every framework.</p>

<h3>Architecture</h3>
<p>A single Python process: a while-loop calling the chat-completions endpoint with two tool schemas (list a directory, read a file — both read-only, so nothing can go wrong on your machine). Tool results append to the message array; the loop exits when the model answers without tool calls, or when the harness's stopping rules fire. Cost: zero with Ollama; roughly a cent with a hosted mini-tier model.</p>

<h3>Steps</h3>
<ol>
<li><strong>Environment.</strong> Either install Ollama and pull a small tool-capable model, or export an API key for a hosted provider.
<pre><code># Option A: local and free
ollama pull qwen2.5:7b        # any tool-capable small model works
# Option B: hosted (OpenAI-compatible endpoint of your choice)
export API_KEY=sk-...
mkdir -p ~/agent-lab &amp;&amp; cd ~/agent-lab
python3 -m venv .venv &amp;&amp; . .venv/bin/activate
pip install openai</code></pre></li>
<li><strong>Define the tools with production-grade descriptions.</strong> Note the when-not-to-use guidance and the error contract — this is the ACI lesson in miniature.
<pre><code># tools.py
import os, json

ROOT = os.path.expanduser("~/agent-lab")   # sandbox: refuse paths outside

def list_dir(path="."):
    full = os.path.realpath(os.path.join(ROOT, path))
    if not full.startswith(ROOT):
        return "ERROR (fatal, do not retry): path escapes the sandbox root."
    try:
        entries = sorted(os.listdir(full))[:50]
        return json.dumps(entries) if entries else "Directory is empty."
    except FileNotFoundError:
        sibs = sorted(os.listdir(ROOT))[:10]
        return ("ERROR: directory not found: " + path +
                ". Top-level entries are: " + ", ".join(sibs))

def read_file(path):
    full = os.path.realpath(os.path.join(ROOT, path))
    if not full.startswith(ROOT):
        return "ERROR (fatal, do not retry): path escapes the sandbox root."
    try:
        text = open(full).read()
        if len(text) &gt; 4000:
            return text[:4000] + "\\n[truncated: showing 4000 of " + str(len(text)) + " chars]"
        return text
    except FileNotFoundError:
        return "ERROR: file not found: " + path + ". Use list_dir first to find the correct path."</code></pre></li>
<li><strong>Write the loop with a step budget and repetition detection.</strong>
<pre><code># agent.py
import json, collections
from openai import OpenAI
import tools

client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")  # or hosted
MODEL = "qwen2.5:7b"
SCHEMAS = [
  {"type":"function","function":{"name":"list_dir",
    "description":"List up to 50 entries in a directory under the sandbox root. Use before read_file when unsure of paths. Not for reading file contents.",
    "parameters":{"type":"object","properties":{"path":{"type":"string",
      "description":"Relative path from sandbox root, e.g. '.' or 'src'"}},"required":[]}}},
  {"type":"function","function":{"name":"read_file",
    "description":"Read one text file (truncated at 4000 chars). Requires an exact relative path; if unsure, call list_dir first.",
    "parameters":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}}}]

def run(task, max_steps=15):
    msgs = [{"role":"system","content":"You are a careful file-exploration agent. If blocked, say so plainly; a report of what blocked you is a good outcome."},
            {"role":"user","content":task}]
    seen = collections.Counter()
    for step in range(max_steps):
        r = client.chat.completions.create(model=MODEL, messages=msgs, tools=SCHEMAS)
        m = r.choices[0].message
        if not m.tool_calls:
            return m.content
        msgs.append(m)
        for tc in m.tool_calls:
            args = json.loads(tc.function.arguments or "{}")
            key = tc.function.name + ":" + json.dumps(args, sort_keys=True)
            seen[key] += 1
            if seen[key] == 3:
                out = "HARNESS NOTICE: identical call made 3 times with identical results. Change strategy or report the blocker."
            else:
                out = getattr(tools, tc.function.name)(**args)
            print("step", step, tc.function.name, args, "-&gt;", out[:80])
            msgs.append({"role":"tool","tool_call_id":tc.id,"content":out})
    return "Step budget exhausted. Last state: " + msgs[-1]["content"][:200]

print(run("Find every Python file here and summarize what each does."))</code></pre></li>
<li><strong>Run it.</strong> Seed the sandbox with a few files (copy tools.py and agent.py themselves), then: <code>python agent.py</code>. Watch the printed trace: each line is one perceive-plan-act-observe cycle.</li>
</ol>

<h3>Verify</h3>
<ul>
<li>Ask for a file that does not exist ("summarize notes.txt") — confirm the actionable error steers the model to list_dir and recover, instead of hallucinating contents.</li>
<li>Give an impossible task ("read the file outside the sandbox at /etc/shadow") — confirm the fatal error stops retries and the model reports the blocker rather than fabricating success.</li>
<li>Set max_steps=3 and give a big task — confirm the budget-exhaustion path returns a useful state summary, not a crash.</li>
<li>Delete the nearest-matches hint from the read_file error and re-run the first test — watch recovery quality drop. You have now measured that error text is steering.</li>
</ul>

<h3>Teardown</h3>
<p>Everything is local; teardown is one command each:</p>
<pre><code>deactivate 2&gt;/dev/null; rm -rf ~/agent-lab      # venv + code + sandbox files
ollama rm qwen2.5:7b                             # if you pulled a model (frees ~5 GB)
unset API_KEY                                    # if you used a hosted provider
# hosted keys: also revoke the key in the provider console if it was created for this lab</code></pre>
`
  }
});
