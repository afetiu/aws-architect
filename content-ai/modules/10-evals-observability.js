/* Module 10 — Evals & Observability (applied track) */
window.COURSE.register({
  id: "evals-observability",
  order: 10,
  track: "applied",
  title: "Evals & Observability",
  description: "The discipline that separates AI products that improve from ones that oscillate: building golden sets from production traces, LLM-as-judge and its documented biases, regression gates in CI with honest cost math, tracing agent runs span by span, and closing the loop from live user signals back into your eval suite.",
  examWeight: "Evals are the single most common differentiator in AI-engineer hiring loops as of 2026: 'how would you know your change made the product better?' appears in nearly every interview, and strong candidates are expected to describe judge bias mitigation, CI gating trade-offs, and trace-driven debugging from firsthand experience rather than framework name-dropping.",
  lessons: [
    {
      id: "why-vibes-fail",
      title: "Why vibes fail: golden sets, rubrics, and your first eval from traces",
      html: `
<p>Every team ships its first LLM feature the same way: try a dozen prompts in a playground, nod at the outputs, deploy. Then someone tweaks the prompt to fix one complaint, and nobody can say whether the other thousand behaviors got better or worse. This is <strong>vibes-based development</strong>, and it fails for a statistical reason a senior engineer will recognize instantly: <strong>n=12 anecdotes chosen by the developer is a biased, underpowered sample of a high-variance distribution</strong>. LLM outputs vary across inputs, across sampling, and across model versions; human memory of "it seemed fine" cannot detect a 5-point regression on a behavior you didn't happen to retest. An eval is nothing more exotic than a test suite for a nondeterministic function — inputs, expected properties, a grader, a score.</p>

<h3>The anatomy of an eval</h3>
<ul>
<li><strong>A dataset</strong> (the golden set): real inputs, each with either a reference answer or a set of graded criteria.</li>
<li><strong>A target:</strong> the thing under test — a prompt, a RAG pipeline, an agent — pinned to a specific model version and configuration.</li>
<li><strong>A grader:</strong> code where possible, a rubric-driven judge where not.</li>
<li><strong>A score and a report:</strong> aggregate pass rate plus per-case results, because the per-case diff is where the information lives.</li>
</ul>

<h3>Graders, cheapest first</h3>
<ul>
<li><strong>Code-based checks:</strong> exact match, regex, JSON-schema validity, does-the-code-run, does-the-SQL-execute, is-the-citation-present. Deterministic, free, and underused — always extract every property that code can check before reaching for a judge.</li>
<li><strong>Reference-based similarity</strong> (string overlap, embedding distance): cheap but blunt; fine as a tripwire, poor as a verdict.</li>
<li><strong>LLM-as-judge with a rubric:</strong> for the genuinely fuzzy properties — faithfulness, tone, helpfulness. Whole next lesson; the key design choice here is <strong>binary beats Likert</strong>. "Rate 1-5" produces judges (and humans) clustering at 4 with unstable boundaries; "does the response answer the question asked: yes/no" plus separate binary checks per criterion produces labels you can actually calibrate.</li>
</ul>

<div class="callout exam">"How would you eval this?" is the defining interview question of the field. The strong shape: start from real traces, not invented cases; decompose quality into per-criterion binary checks; grade with code wherever possible; keep a labeled golden set small enough to maintain and large enough to detect the deltas you care about (dozens to low hundreds, not thousands). Candidates who jump straight to "use an eval framework and an LLM judge" without mentioning error analysis read as tourists.</div>

<h3>Building the first eval from production traces</h3>
<p>The highest-signal procedure, popularized in practitioner writing (Hamel Husain's "look at your data" school) and boringly effective:</p>
<ol>
<li><strong>Pull 50-100 real traces</strong> from production (or dogfooding) — full input, full output, tool calls included.</li>
<li><strong>Read every one</strong> and write a short free-text note per trace: what's wrong, if anything. This is error analysis, and there is no shortcut around the reading. It is also the step teams skip.</li>
<li><strong>Cluster the notes into a failure taxonomy</strong> — you will reliably find 5-10 recurring modes ("ignores date constraints", "invents order IDs", "answers in English when asked in German", "over-apologizes and pads").</li>
<li><strong>Turn each frequent failure mode into an eval criterion</strong> with its own grader, and promote the offending traces into the golden set as regression cases.</li>
<li><strong>Weight by frequency:</strong> fix and gate the modes that occur most, not the ones that are most fun to fix.</li>
</ol>
<p>Note what this implies: your first eval is <em>derived from observed failures</em>, not from imagination. Invented test cases test the failures you already guessed; traces surface the ones you didn't.</p>

<div class="callout war">The classic first-eval mistake: building a 2,000-case synthetic benchmark generated by an LLM from your own prompt spec. It scores 96 percent on day one — because the generator and the system share assumptions — and stays at 96 while real users churn. Synthetic data has a place (coverage of rare-but-known cases, privacy-safe stand-ins), but a golden set whose distribution doesn't match production measures a product you aren't shipping.</div>

<h3>Capability evals vs regression evals</h3>
<p>Keep two mental buckets. <strong>Capability evals</strong> ask "can it do X at all?" — scores start low, and the suite is a roadmap. <strong>Regression evals</strong> ask "did we break anything users rely on?" — scores start near 100 and any drop is a bug. They differ in how you respond to failure, how often you run them, and whether they gate deploys (regression suites gate; capability suites inform). Public benchmarks (MMLU-class, SWE-bench, arena leaderboards) are capability evals of <em>models</em>; they tell you almost nothing about <em>your product</em> — model selection is maybe 20 percent of product quality, and your prompt, retrieval, and tool design are the rest. That is why every serious team ends up with a private suite.</p>

<div class="callout limits">Statistical floor worth internalizing: with a 50-case golden set, a change from 80 percent to 84 percent pass rate is 2 cases — comfortably within noise. Rule of thumb: to reliably detect a ~5-point shift you want a few hundred cases or repeated runs; with small sets, only treat large movements (10+ points) or specific named-case regressions as signal. This number drives CI design in lesson 3.</div>
`
    },
    {
      id: "llm-as-judge",
      title: "LLM-as-judge: setups, biases, and calibration against humans",
      html: `
<p>Human grading is the gold standard and does not scale: at even 30 seconds per label, a 500-case suite is four hours of expert attention per run, and you want to run per change. <strong>LLM-as-judge</strong> — using a model to grade model outputs — is the workhorse compromise, validated in the research that named it (Zheng et al.'s MT-Bench work, 2023, which reported roughly 80 percent judge-human agreement, comparable to human-human agreement on the same data). The catch: a judge is itself an LLM system with failure modes, and <strong>an uncalibrated judge is a random-number generator with a confident tone</strong>.</p>

<h3>The three setups</h3>
<ul>
<li><strong>Single-output grading:</strong> judge sees input + output + rubric, returns pass/fail (or per-criterion verdicts). Best default for regression suites: stable, parallelizable, maps to "did this specific behavior hold."</li>
<li><strong>Pairwise comparison:</strong> judge sees two candidate outputs, picks the better. Higher agreement with humans on open-ended quality (comparison is easier than absolute scoring — true for humans too), ideal for A/B-ing prompts or models; produces rankings, not absolute quality bars.</li>
<li><strong>Reference-guided grading:</strong> judge compares output against a gold answer. Most reliable when a gold answer exists — factual QA, extraction, summarization-with-source — because the judge verifies correspondence rather than judging quality in a vacuum.</li>
</ul>

<h3>Documented biases you must design around</h3>
<ul>
<li><strong>Position bias:</strong> in pairwise setups, judges systematically favor one position (commonly the first). The literature found weaker judges flip their verdict for a large fraction of pairs when order is swapped. <strong>Mitigation is mechanical:</strong> run every comparison twice with order swapped; count only consistent verdicts, score the rest as ties.</li>
<li><strong>Verbosity bias:</strong> longer, more elaborated answers score higher at equal correctness. Insidious in optimization loops — tune a prompt against a verbosity-biased judge and you breed padding. Mitigations: rubric lines that explicitly reward concision, length-controlled comparisons, and code-side length checks kept separate from the judge.</li>
<li><strong>Self-preference bias:</strong> models rate their own family's outputs higher (partly recognition of their own style). If your product runs on model X, judging with model X inflates scores; when comparing vendors, a same-family judge is a conflict of interest. Mitigation: judge from a different family, or a panel of judges from multiple families for high-stakes comparisons.</li>
<li><strong>Style over substance:</strong> confident tone, nice formatting, and fluent structure lift scores independently of correctness — judges are poor at catching subtle factual errors wrapped in good prose. Mitigation: separate the criteria (grade faithfulness with a reference-guided check; grade style, if you care, separately) and never let one holistic score blend them.</li>
</ul>

<div class="callout deep">Judge prompt engineering that measurably helps: force <strong>reasoning before verdict</strong> (analysis first, then the label — verdict-first prompts commit early and rationalize); demand <strong>structured output</strong> (a JSON verdict field parsed by code, not regex over prose); include <strong>2-3 few-shot examples of borderline cases with correct verdicts</strong> — borderline examples move agreement far more than easy ones; and pin the judge's model version and temperature (0) so the measuring stick itself doesn't drift. A judge model upgrade is a change to your instrument — recalibrate before trusting trends across it.</div>

<h3>Calibration: the step that makes a judge an instrument</h3>
<p>A judge is trustworthy only relative to human labels. The procedure:</p>
<ol>
<li>Have a domain expert label 50-100 cases with the same rubric (these double as your labeled golden set).</li>
<li>Run the judge on the same cases; measure agreement — raw percent plus <strong>Cohen's kappa</strong>, because with a 90-percent-pass base rate, 90 percent raw agreement is achievable by always saying pass; kappa corrects for chance.</li>
<li><strong>Read every disagreement.</strong> They split into judge errors (fix the judge prompt), human errors (yes, really), and rubric ambiguity (fix the rubric — this is the most common finding).</li>
<li>Iterate until agreement plateaus near your human-human agreement ceiling — you cannot meaningfully exceed the consistency of your own labelers.</li>
<li>Re-check periodically with fresh labels, and always after changing the judge model or rubric.</li>
</ol>

<div class="callout limits">Cost reality, early-2026 order of magnitude: small judge models (GPT-4o-mini / Claude Haiku-class / Gemini Flash-class) run about 0.10-1 dollar per million input tokens, so judging 1,000 cases at ~1,500 tokens each costs <strong>tens of cents to a couple of dollars per full run</strong> — cheap enough for CI. A frontier-model judge panel is 10-100x that; reserve it for calibration audits and high-stakes comparisons, not every commit.</div>

<div class="callout war">The silent failure: a team optimizes prompts against an uncalibrated judge for a quarter. Judge scores climb from 78 to 91; user complaints stay flat. Post-mortem: verbosity bias — the "improvements" made answers longer, and the judge liked long. They had built a Goodhart machine: the metric improved because the metric was the thing being optimized, not the quality it stood for. Calibrate first, then optimize; and re-anchor to human labels every time scores move a lot.</div>
`
    },
    {
      id: "regression-gates",
      title: "Regression gates: evals in CI and when to block a deploy",
      html: `
<p>An eval suite nobody runs automatically is documentation. The end state is the same one you already know from software: <strong>a change to a prompt, model version, retrieval config, or tool schema triggers evals, and the result gates the merge</strong>. Everything interesting is in the differences from ordinary CI: eval runs cost real money, take real minutes, and the system under test is nondeterministic — so gate design is a statistics problem wearing a DevOps costume.</p>

<h3>What triggers what: a tiered scheme</h3>
<ul>
<li><strong>Per-PR (minutes, cents-to-dollars):</strong> code-based graders on the full set (they're free) plus a judge-graded <strong>smoke subset</strong> — the few dozen highest-value cases: one per failure mode in your taxonomy, every past production incident, the top user journeys.</li>
<li><strong>Nightly (tens of minutes, dollars):</strong> the full suite on main, with trend reporting. Catches slow drift and interactions the smoke set misses.</li>
<li><strong>On model-version change (the big one):</strong> full suite plus repeated runs plus human spot-review of diffs. A provider swapping the model under a dated snapshot alias — or your own upgrade from one version to the next — is the single most common cause of step-change regressions, and it deserves release-grade scrutiny.</li>
</ul>

<h3>Sampling strategies that keep cost sane</h3>
<ul>
<li><strong>Stratified sampling</strong> over your failure taxonomy beats random sampling: guarantee every failure mode is represented in the smoke set rather than hoping.</li>
<li><strong>Run the cheap graders on everything, the expensive judge on a sample.</strong> Code checks are free; spend judge tokens where code can't reach.</li>
<li><strong>Repeat runs for variance, selectively.</strong> Nondeterminism does not disappear at temperature 0 (batching and floating-point non-associativity on GPUs see to that, and providers' serving stacks change). For flaky cases, run 3-5 times and score pass-rate-per-case (the pass-at-k idea from code generation applied to gating); for stable cases, once is fine. Track which cases are flaky — flakiness itself is information about brittle behavior.</li>
</ul>

<div class="callout limits">Cost math you should be able to do on a whiteboard: 400 cases × ~2K tokens through the product model, plus 400 judge calls × ~1.5K tokens through a small judge. With a mid-tier product model (order 1-5 dollars per million input tokens as of early 2026) that's roughly <strong>1-5 dollars per full run</strong> — and at 30 PRs/day, running the full suite per-PR is 30-150 dollars/day, which is why the smoke-subset tier exists. The eval bill should be a rounding error next to the engineering time it saves; if it isn't, your tiers are wrong.</div>

<h3>When to actually block a deploy</h3>
<p>The failure mode of naive gating is treating eval scores like unit tests: 84.2 percent yesterday, 83.9 percent today, pipeline red, everyone learns to click override, gate dead. Design the gate around what is statistically and operationally meaningful:</p>
<ul>
<li><strong>Hard-block on named canary cases:</strong> a curated subset — past incidents, contractual behaviors, safety checks — where <em>any</em> failure blocks, no statistics needed. These are your regression tests in the classic sense.</li>
<li><strong>Threshold-with-noise-margin on aggregates:</strong> block on drops larger than your measured run-to-run variance (measure it: run the suite 5 times on an unchanged system; that spread is your noise floor). With small suites, a 2-case swing is weather, not climate.</li>
<li><strong>Warn-and-diff for the middle ground:</strong> surface per-case regressions (cases that flipped pass-to-fail) in the PR for human judgment. The per-case flip list is far more informative than the aggregate delta — a flat score can hide five fixes and five new breaks.</li>
<li><strong>Block releases, not experiments:</strong> gates protect the deploy path; exploratory branches should run evals in report-only mode, or people will stop experimenting.</li>
</ul>

<div class="callout war">A pattern seen at multiple companies: the eval gate is green for months, then a provider deprecates the pinned model version and the forced upgrade drops three product behaviors at once — and the team discovers their suite covered two of the three. The gate worked; the coverage didn't. Treat every production incident as a mandatory new canary case (the incident IS the eval), and treat forced model migrations as releases with their own eval sign-off, scheduled before the deprecation date, not after.</div>

<div class="callout exam">Interviewers probe the judgment, not the plumbing: "your eval dropped 2 points on a 100-case suite — do you block the deploy?" The strong answer asks about noise floor and per-case flips before answering, distinguishes canary-case failures (block) from aggregate wobble (investigate), and mentions the override-culture failure mode — a gate everyone bypasses is worse than no gate, because it launders regressions as reviewed.</div>
`
    },
    {
      id: "observability",
      title: "Observability: tracing LLM calls and debugging agent runs",
      html: `
<p>When a user reports "the assistant gave a weird answer," a plain application log gives you a request ID and a 200. What you need is the <strong>trace</strong>: the exact rendered prompt (post-template, post-retrieval), every tool call and its result, every intermediate model step, and the tokens, cost, and latency of each. LLM observability is ordinary distributed tracing — spans in a tree, OpenTelemetry-shaped — with a domain-specific payload. If you have operated microservices, you already have the mental model; what changes is <em>what you record per span</em> and the fact that the payloads, not the timings, are usually the point.</p>

<h3>What a good LLM span records</h3>
<ul>
<li><strong>The full resolved input:</strong> system prompt, messages, retrieved chunks, tool schemas — as sent, not as templated. Half of all "model bugs" are prompt-assembly bugs (empty retrieval results, a truncated history, a template variable that rendered blank), and only the resolved prompt reveals them.</li>
<li><strong>The full output</strong>, including tool-call arguments and refusals/finish reasons.</li>
<li><strong>Metadata:</strong> model ID <em>as reported by the provider</em> (not just what you requested), prompt/config version, temperature, input/output/cached token counts, computed cost, latency plus <strong>time-to-first-token</strong> (the user-perceived number for streaming), and error/retry/rate-limit info.</li>
<li><strong>Linkage:</strong> user/session IDs (for feedback joins, next lesson) and parent-span links so an agent run reads as one tree.</li>
</ul>

<div class="callout deep">The standardization story as of early 2026: OpenTelemetry's <strong>GenAI semantic conventions</strong> define attribute names for model, token counts, and operation types, and are stabilizing — meaning traces can flow through your existing OTel collector into your existing backend, with LLM-specific tools consuming the same stream. Instrument once against the convention rather than a single vendor's SDK; the tools landscape below is churning, and the exporter is the part you'll want to swap.</div>

<h3>The tools landscape (early 2026 — expect churn)</h3>
<ul>
<li><strong>Open-source / self-hostable:</strong> Langfuse (the default OSS choice), Arize Phoenix, Helicone (proxy-based — trivial setup, adds a hop).</li>
<li><strong>Commercial platforms:</strong> LangSmith, Braintrust, W&B Weave — typically bundling tracing with eval tooling, dataset management, and prompt playgrounds, which is the real draw: <strong>the platforms that win couple traces to evals</strong>, because a trace you can one-click promote to a test case closes the loop this course keeps returning to.</li>
<li><strong>Incumbent APM:</strong> Datadog, New Relic, Grafana have LLM-observability modules — attractive when the org already lives there and wants LLM spans inside existing service traces.</li>
</ul>
<p>Selection advice that survives the churn: insist on OTel compatibility, self-hosting or a clear data-retention story (traces are a PII archive — see below), and first-class trace-to-eval-dataset promotion. The rest is UI taste.</p>

<h3>Debugging agent runs specifically</h3>
<p>Agent traces are deep trees — dozens of model and tool spans — and their failure modes are distinctive. The recurring diagnoses, in rough order of frequency:</p>
<ul>
<li><strong>Prompt-assembly faults:</strong> empty or irrelevant retrieval, context overflow silently truncating the oldest tool results, a stale system-prompt version. Read the resolved prompt of the <em>first bad span</em>, not the final answer.</li>
<li><strong>Tool-call pathologies:</strong> malformed arguments, a tool erroring and the model gamely continuing with a hallucinated result, or <strong>loops</strong> — the same tool called with the same arguments repeatedly. Loop detection (hash of tool+args, alert on repeats) and a max-steps budget belong in the harness, and the trace is where you notice you need them.</li>
<li><strong>Trajectory divergence:</strong> the step where a long run went wrong is rarely the step that visibly failed. The practical technique is bisection-by-reading: walk spans until the state stops matching intent — everything after is usually consequence, not cause.</li>
<li><strong>Cost/latency anomalies:</strong> a p95 latency spike traced to one retry-looping tool, or a cost spike from a context that grows quadratically because the harness re-sends full history each step. Per-span token counts make these one-query diagnoses.</li>
</ul>

<div class="callout war">Two production gotchas with teeth. First: <strong>traces are your most sensitive data store</strong> — full prompts mean user documents, health questions, and pasted secrets, all in your observability vendor. PII redaction at ingest, short retention tiers, and access control are launch requirements, not hardening backlog (your compliance team will discover the trace store eventually; better they hear it from you). Second: sampling. Traditional APM head-samples at 1 percent; do that to LLM traces and the weird failure the user reported is gone. Common pattern: sample-keep 100 percent of errored and user-flagged traces, tail-sample the healthy majority, and keep full payloads only for the retained set.</div>

<div class="callout exam">A favorite interview exercise: "a user says the agent gave a wrong answer yesterday — walk me through finding out why." Strong answers go trace-first: locate by session/user ID, read the span tree, check the resolved prompt before blaming the model, check tool results before blaming the prompt, and end by promoting the trace into the regression set. Answers that begin with 'I'd try to reproduce it in the playground' miss the point that without the trace you don't know what to reproduce.</div>
`
    },
    {
      id: "online-quality",
      title: "Online quality: feedback signals, A/B tests, drift, and closing the loop",
      html: `
<p>Offline evals answer "does it pass our tests?" Production answers "does it help our users?" — and the two diverge constantly, because your golden set is a frozen sample of a moving distribution. Online quality work is the feedback discipline: harvesting signals from live traffic, attributing changes causally, noticing drift, and — the part most teams skip — feeding what you learn back into the offline suite so the same failure never ships twice.</p>

<h3>Feedback signals, ranked by honesty</h3>
<ul>
<li><strong>Explicit feedback</strong> (thumbs up/down, star ratings): easy to build, brutally sparse — response rates are typically around or below 1 percent — and biased toward extremes (the delighted and the furious click; the mildly disappointed churn silently). Necessary, never sufficient.</li>
<li><strong>Implicit behavioral signals</strong> are where the volume is, and every product has its own: <strong>acceptance rate</strong> for suggestion products (code-assistant completion acceptance hovers around 30 percent, the field's most famous benchmark of this class); <strong>edit distance</strong> between draft and what was actually sent/committed (heavy edits = weak draft); <strong>regeneration and retry rates</strong> (the user asked again = the first answer failed); <strong>copy events</strong>; conversation-level tells like early abandonment or the user rephrasing the same question; and escalation-to-human rates for support bots.</li>
<li><strong>Downstream outcomes</strong> (task completed, ticket resolved without reopen, PR merged without revert): closest to truth, slowest to arrive, most confounded — treat as north-star metrics, not per-change verdicts.</li>
</ul>

<div class="callout deep">Design the signal join before launch: every piece of feedback must attach to the <strong>trace ID</strong> of the interaction that produced it, with the prompt version and model version on the span. Feedback you cannot join to a trace is a mood ring — you know users are unhappy but not with which version of what. This one foreign key is the difference between "our rating dipped" and "the 10-15 prompt bumped regeneration rate 20 percent on multilingual sessions."</div>

<h3>A/B testing model and prompt changes</h3>
<p>Standard experimentation machinery applies — randomize by user, not by request (LLM experiences are session-shaped, and per-request flapping between prompt personalities is itself a quality bug) — with LLM-specific wrinkles:</p>
<ul>
<li><strong>Metrics are sparse and noisy,</strong> so experiments need more traffic or longer runs than intuition suggests; pick one primary implicit metric (acceptance, regeneration) and guard it with cost and latency counter-metrics, since a prompt that improves quality by doubling output length may lose on economics and TTFT.</li>
<li><strong>Novelty effects are real:</strong> a new response style gets clicked just for being different; let experiments run past the first days.</li>
<li><strong>Interleaving</strong> (showing competing candidates and seeing which gets accepted) yields much higher statistical power for suggestion-shaped products, at the cost of trickier UX.</li>
<li><strong>Ship-shadow-compare</strong> for risky swaps: run the candidate model in shadow on real traffic, grade both arms offline with your judge, and only then take user-facing traffic. Cheap insurance on model migrations.</li>
</ul>

<h3>Drift: things change under you</h3>
<ul>
<li><strong>Input drift:</strong> your users change — new locales, new document types, seasonal topics, or users learning to prompt your product differently. Monitor input distributions (topic mix, language mix, length) and eval-vs-production divergence; your golden set ages even if nothing else moves.</li>
<li><strong>Model drift:</strong> providers update models; even dated snapshots get deprecated on a schedule, forcing migrations. Pin snapshot versions, log the served model ID, and keep a <strong>fixed sentinel set</strong> — a small suite run daily against the production configuration whose only job is to change when the underlying system changes. A sentinel moving while your code is frozen is your early-warning siren.</li>
<li><strong>Ecosystem drift:</strong> a retrieval corpus that goes stale, a tool API that changes response shape, an upstream prompt template someone edits — all invisible to model-level thinking, all caught by end-to-end sentinels and trace diffs.</li>
</ul>

<div class="callout war">A recurring incident shape as of 2025-2026: quality metrics sag over two weeks, engineering swears nothing shipped, and the eventual cause is an unannounced change in a dependency — a provider-side serving tweak, a deprecated snapshot silently aliased forward, or a teammate's "harmless" edit to a shared system-prompt fragment. Teams with sentinel suites and served-model-ID logging diagnose this in an hour; teams without spend the two weeks arguing about whether the sag is real. Version-control your prompts like code — because they are.</div>

<h3>Closing the loop</h3>
<p>The whole module compresses to one operating cycle: <strong>production traces → error analysis → golden set and graders → CI gates → ship → online signals and drift monitors → new failing traces → back into the golden set.</strong> Concretely: negative-feedback and regenerated traces flow into a triage queue; triage labels them and promotes the real failures into the eval suite; the suite grows monotonically with every incident; and each model migration or prompt change replays the accumulated history of everything that ever went wrong. Teams that run this loop compound — their eval suite is an asset that appreciates. Teams that don't re-fight the same regressions annually with fresh trauma. The loop, not any single tool, is the discipline.</p>

<div class="callout exam">System-design interviews in this space end with some form of "how does your system get better over time?" The answer they're listening for is this loop, told causally: signals joined to traces, traces triaged into the golden set, golden set gating deploys, sentinels catching drift. Name the join key (trace ID) and the failure mode of skipping triage (feedback rots in a dashboard) and you're in the top decile of answers.</div>
`
    }
  ],
  quiz: [
    {
      q: "A team playground-tests a prompt tweak on 10 examples, sees improvement, and ships. A week later, complaints spike about a behavior nobody rechecked. What is the fundamental methodological error?",
      options: [
        "They used too small a model for the task",
        "They evaluated a high-variance system on a tiny, developer-chosen sample, so regressions outside that sample were invisible by construction",
        "They should have raised temperature during testing to see more diverse outputs",
        "They failed to fine-tune before shipping the prompt change"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> names the statistics: n=10 anecdotes selected by the person making the change is a biased, underpowered sample of a nondeterministic function's behavior. A change can improve those 10 and regress hundreds of unexamined behaviors — which is exactly what a regression suite built from production traces exists to catch.</p><p><strong>A</strong> and <strong>D</strong> reach for capability fixes when the failure is measurement — no model or fine-tune choice fixes not looking. <strong>C</strong> is a sampling-diversity tweak that still leaves the core problem: the test set doesn't represent production, and nothing gates the deploy.</p>"
    },
    {
      q: "You are creating the first eval for a support assistant that has been in production for a month. Which starting point yields the most useful golden set?",
      options: [
        "Generate 1,000 synthetic test cases with an LLM from the product spec",
        "Adopt a public benchmark like MMLU to measure the underlying model",
        "Pull 75 real production traces, read each one, cluster the observed failures into a taxonomy, and build criteria and regression cases from those",
        "Ask each engineer to contribute 10 test cases they think are important"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>C</strong> is the trace-first procedure: error analysis on real traffic surfaces the failure modes that actually occur and weights them by frequency, and the failing traces themselves become regression cases. The reading step has no shortcut — it is where the taxonomy comes from.</p><p><strong>A</strong> builds a benchmark that shares assumptions with the system under test — it typically scores high on day one and misses real-user failures entirely. <strong>B</strong> measures the model, not your product; prompt, retrieval, and tool design dominate product quality and MMLU sees none of them. <strong>D</strong> is better than nothing but tests imagined failures; invented cases encode what the team already guessed, and traces exist precisely to surface what they didn't.</p>"
    },
    {
      q: "For grading a structured-extraction feature whose output is JSON with six fields, which grading approach should be tried first?",
      options: [
        "A frontier-model judge with a holistic quality rubric scored 1 to 5",
        "Code-based checks: schema validity plus field-by-field comparison against reference values",
        "Embedding similarity between the output and a reference paragraph",
        "Pairwise comparison of the output against last week's output"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong>: extract every property code can check before spending judge tokens. Structured extraction is the best case for deterministic grading — schema validity, exact or normalized field matches — which is free, instant, and noise-free.</p><p><strong>A</strong> pays judge cost and judge noise (plus 1-5 Likert instability) to approximate what code measures exactly. <strong>C</strong> is a blunt instrument that can score a wrong field-value as similar. <strong>D</strong> answers a different question — relative preference — when the task has an objective right answer per field. Judges are for genuinely fuzzy properties; this task has almost none.</p>"
    },
    {
      q: "In pairwise LLM-as-judge comparisons, your judge picks response A 68 percent of the time — but when you re-run with the order of the two responses swapped, many verdicts flip. Which bias is this, and what is the standard mitigation?",
      options: [
        "Verbosity bias; truncate all responses to equal length before judging",
        "Self-preference bias; switch to a judge from the same model family",
        "Position bias; run each comparison in both orders and count only consistent verdicts, scoring inconsistent ones as ties",
        "Style bias; remove all formatting from responses before judging"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>C</strong>: verdicts that depend on presentation order are the definition of position bias, documented since the original LLM-as-judge work — weaker judges flip on a large fraction of pairs. The mechanical fix is symmetric evaluation: both orders, keep consistent verdicts, tie the rest.</p><p><strong>A</strong> mitigates a real but different bias (length preference) and truncation destroys valid content. <strong>B</strong> is backwards — a same-family judge <em>introduces</em> self-preference bias rather than fixing anything. <strong>D</strong> addresses style-over-substance, again a different failure; nothing about formatting explains order-dependent flips.</p>"
    },
    {
      q: "Your product runs on model X. For a high-stakes bake-off between model X and a competitor model Y as the product's engine, which judge setup is most trustworthy?",
      options: [
        "Model X as judge, since it best understands its own product context",
        "A judge from a third model family, or a multi-family panel, using pairwise comparison with position swapping, calibrated against a sample of human labels",
        "Model Y as judge, to give the challenger a fair chance",
        "Whichever judge is cheapest, since judge choice does not affect comparisons"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> stacks the known mitigations: a third family neutralizes self-preference (models measurably favor their own family's style), pairwise with order-swapping handles position bias, and human-label calibration is what makes the verdicts evidence rather than vibes with extra steps.</p><p><strong>A</strong> and <strong>C</strong> each hand the scoring pen to a contestant — self-preference bias means both are conflicts of interest, in opposite directions. <strong>D</strong> is false: judge biases directly shape pairwise outcomes, and for a decision this consequential the calibration audit is worth frontier-judge money.</p>"
    },
    {
      q: "A team spends a quarter optimizing prompts against their LLM judge. Judge scores rise from 78 to 91, but user complaints and regeneration rates are unchanged. Post-mortem shows responses got much longer. What happened?",
      options: [
        "The model improved but users have not noticed yet",
        "They Goodharted an uncalibrated, verbosity-biased judge: optimizing against the metric bred padding the judge rewards but users do not value",
        "The golden set was too large, causing overfitting",
        "Judge temperature was too high, adding noise to the scores"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is the textbook Goodhart failure for judge-led optimization: verbosity bias means longer answers score higher at equal correctness, so an optimization loop against that judge selects for length. The score measured the judge's preferences, not user value — which is why calibration against human labels must precede optimization, and re-anchoring must follow any large score movement.</p><p><strong>A</strong> is wishful: regeneration rate is a live behavioral signal and it didn't move. <strong>C</strong> inverts the concept — overfitting concerns small sets, and 'too large' isn't the mechanism here. <strong>D</strong> would add variance, not a systematic 13-point climb correlated with length.</p>"
    },
    {
      q: "You need eval coverage in CI without unsustainable cost. The suite is 500 cases; you get 40 PRs a day. Which design follows best practice?",
      options: [
        "Run all 500 judge-graded cases on every PR to maximize safety",
        "Run evals weekly only, since CI must stay under one minute",
        "Per-PR: free code-based graders on everything plus a stratified judge-graded smoke subset covering every failure mode and past incidents; nightly: full suite on main; full suite plus repeat runs on any model-version change",
        "Only run evals manually before quarterly releases"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>C</strong> is the tiered scheme: spend where information is. Code graders are free so they run everywhere; the judge-graded smoke set is stratified over the failure taxonomy so every known mode stays covered per-PR; the nightly full run catches what the subset misses; and model-version changes — the largest regression source — get release-grade treatment.</p><p><strong>A</strong> costs 40 full runs a day (real dollars, real minutes) for marginal signal over a well-stratified subset. <strong>B</strong> and <strong>D</strong> leave the deploy path ungated — a week or a quarter of unevaluated prompt changes is exactly how vibes-driven regressions ship.</p>"
    },
    {
      q: "Your 100-case regression suite scores 87 percent on main. A PR changes a prompt and scores 85 percent. Run-to-run variance on an unchanged system, measured over five runs, is plus or minus 3 points. What is the right gate behavior?",
      options: [
        "Block the merge: any score decrease indicates a regression",
        "Auto-merge: the aggregate is within the measured noise floor, so no further attention is needed",
        "Do not block on the aggregate, since a 2-point drop is within noise, but surface the per-case pass-to-fail flips for review, and block only if a named canary case failed",
        "Rerun the suite until it scores 87 or higher, then merge"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>C</strong> applies both halves of sound gate design: aggregates gate only beyond the measured noise floor (2 points inside a plus-or-minus-3 spread is weather), while named canary cases hard-block on any failure, and the per-case flip list — far more informative than the delta — goes to a human.</p><p><strong>A</strong> creates a gate that reds on noise; teams learn to override, and an override-culture gate launders real regressions as reviewed. <strong>B</strong> wastes the information in the flips — a flat aggregate can hide offsetting fixes and breaks. <strong>D</strong> is p-hacking the CI: rerunning until the dice come up green selects noise, verifies nothing.</p>"
    },
    {
      q: "A user reports the assistant gave a badly wrong answer yesterday. Which first move gives the fastest correct diagnosis?",
      options: [
        "Try to reproduce the issue in a playground from the user's description",
        "Pull the trace by session ID and read the span tree, starting with the fully resolved prompt and tool results of the first bad step",
        "Roll back the most recent prompt change as a precaution",
        "Ask the user to try again and report whether it recurs"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong>: the trace is the ground truth of what actually happened — the resolved prompt (where roughly half of 'model bugs' turn out to live: empty retrieval, truncated history, blank template variables), the tool results (was the model fed garbage?), and per-span metadata. Diagnosis order: resolved prompt before blaming the model, tool outputs before blaming the prompt.</p><p><strong>A</strong> fails because without the trace you don't know what to reproduce — the user's description omits the retrieval contents and history that produced the behavior. <strong>C</strong> acts before diagnosing and may roll back an innocent change while leaving the real cause. <strong>D</strong> outsources debugging to the user and loses the incident if it doesn't recur — the trace already recorded it.</p>"
    },
    {
      q: "An agent product sees a p95 latency spike and a 4x cost increase on some runs, with no code deploy. Traces show certain runs contain dozens of spans calling the same tool with identical arguments. What is the diagnosis and the correct harness-level fix?",
      options: [
        "The provider degraded the model; switch vendors",
        "A tool-call loop: add loop detection on repeated tool-plus-arguments and a max-steps budget to the agent harness, and alert on both",
        "The context window is too small; upgrade to a larger-context model",
        "Traces are being double-counted; fix the observability SDK"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong>: identical tool+arguments spans repeating is the signature of an agent loop — the model isn't incorporating the tool result and retries forever, burning a model call per iteration (hence cost and tail latency together). The fix belongs in the harness, deterministically: hash tool-plus-args, break or intervene on repeats, cap total steps, and alert — the trace is how you discovered you needed it.</p><p><strong>A</strong> and <strong>C</strong> don't explain dozens of identical calls; they're capability guesses at a control-flow bug. <strong>D</strong> is contradicted by the cost increase being real (the bill went up, not just the span count).</p>"
    },
    {
      q: "Which set of user signals gives the highest-volume, least-biased read on day-to-day quality for an AI drafting assistant?",
      options: [
        "Thumbs up and down ratings, because they are explicit statements of quality",
        "Quarterly user satisfaction surveys",
        "Implicit behavioral signals: acceptance rate, edit distance between draft and sent version, and regeneration rate, each joined to the trace and prompt version that produced them",
        "Counts of positive mentions on social media"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>C</strong>: implicit signals fire on nearly every interaction (versus around-or-below-1-percent response rates for explicit feedback), measure revealed preference rather than stated preference, and — joined to trace and version IDs — support causal attribution per change. Edit distance and regeneration are especially honest for drafting products: users vote with their revisions.</p><p><strong>A</strong> is necessary but brutally sparse and polarized toward the delighted and the furious. <strong>B</strong> is far too slow and coarse to attribute to any change. <strong>D</strong> is unjoined, unrepresentative, and gameable — a mood ring, not a metric.</p>"
    },
    {
      q: "Product quality metrics sag gradually over two weeks with no deploys. The eval suite in CI is green, but it only runs on code and prompt changes. Which practices would have caught this early? (Select TWO)",
      options: [
        "A daily sentinel suite run against the live production configuration, whose scores should be flat unless something under the system changed",
        "Logging the served model ID reported by the provider on every span and alerting when it changes",
        "Raising the CI pass threshold from 85 to 95 percent",
        "Doubling the size of the golden set with synthetic cases",
        "Switching the judge to a frontier model"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p>The scenario is drift — something changed under a frozen codebase (a provider-side update, a silently aliased snapshot, a stale corpus). <strong>A</strong> catches it by construction: a sentinel run against production config moves only when the underlying system moves, converting a two-week argument into a one-day alert. <strong>B</strong> catches the most common specific cause — the served model changing — at the moment it happens.</p><p><strong>C</strong>, <strong>D</strong>, and <strong>E</strong> all tune a CI suite that never runs in this scenario (no code changed, so nothing triggered): a higher threshold, a bigger set, and a fancier judge on an untriggered pipeline detect nothing.</p>"
    },
    {
      q: "You are A/B testing a new prompt for a conversational product. Which experiment-design choices are correct for LLM products specifically? (Select TWO)",
      options: [
        "Randomize by request so both arms see identical traffic mix within each session",
        "Randomize by user, because conversations are session-shaped and per-request arm-flapping between prompt personalities is itself a quality defect",
        "Track cost and latency as guardrail metrics alongside the primary quality signal, since a prompt can win on quality by losing on economics",
        "Conclude the test after the first day if the new arm is ahead",
        "Suppress trace collection during the experiment to avoid observer effects"
      ],
      answer: [1, 2],
      multi: true,
      explanation: "<p><strong>B</strong>: per-request randomization inside a conversation means the user alternates between two response styles turn by turn — incoherent UX and contaminated measurement, since each arm's turns condition on the other arm's history. User-level assignment is the standard. <strong>C</strong>: LLM changes move quality, cost, and latency together — a prompt that improves ratings by doubling output length may fail on TTFT and unit economics, so guardrail metrics are mandatory.</p><p><strong>A</strong> is the wrong-level randomization just described. <strong>D</strong> falls to both novelty effects (new styles get engagement for being different) and the sparse-noisy-metrics problem that makes LLM experiments need longer runs, not shorter. <strong>E</strong> is backwards — traces are how you'll debug and attribute the experiment; models have no observer effect to avoid.</p>"
    },
    {
      q: "What is the essential closing-the-loop mechanism that makes an eval suite appreciate in value over time rather than go stale?",
      options: [
        "Regenerating the golden set from scratch each quarter with an LLM",
        "A triage flow where negative-feedback and regenerated production traces are labeled and promoted into the golden set, so every real failure becomes a permanent regression case",
        "Increasing the CI pass threshold by one point per month",
        "Migrating to a larger judge model annually"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>B</strong> is the loop: online signals (joined to traces) flag failures, triage labels them, and promotion into the golden set means every model migration and prompt change replays the accumulated history of everything that ever went wrong. The suite tracks the live failure distribution and grows monotonically — an appreciating asset.</p><p><strong>A</strong> discards that accumulated history and reintroduces the synthetic-distribution problem each quarter. <strong>C</strong> is threshold theater — raising the bar changes no coverage and eventually just reds on noise. <strong>D</strong> upgrades the instrument while leaving the dataset stale; a sharper judge over an unrepresentative set still measures the wrong thing.</p>"
    }
  ],
  flashcards: [
    { front: "Why does vibes-based LLM development fail, in one sentence?", back: "It judges a <strong>high-variance nondeterministic system on a tiny, developer-chosen sample</strong> — regressions outside the sample are invisible by construction. An eval is just a test suite for a nondeterministic function." },
    { front: "Four components of any eval", back: "<strong>Dataset</strong> (golden set from real traces), <strong>target</strong> (prompt/pipeline/agent pinned to a model version), <strong>grader</strong> (code first, judge for fuzzy properties), <strong>score + per-case report</strong> (the per-case diff carries the information)." },
    { front: "Grader hierarchy: what do you try before an LLM judge?", back: "<strong>Code-based checks</strong>: exact/normalized match, regex, JSON-schema validity, does-it-run/execute, citation presence. Deterministic, free, noise-free. Spend judge tokens only on what code can't reach." },
    { front: "The trace-first procedure for building a first eval", back: "Pull 50-100 real traces → <strong>read every one</strong> and note failures (error analysis — no shortcut) → cluster into a failure taxonomy → one criterion + grader per frequent mode → promote failing traces as regression cases → weight by frequency." },
    { front: "Binary vs Likert grading: which and why?", back: "<strong>Binary per-criterion checks beat 1-5 scales</strong>: Likert scores cluster (everything is a 4) with unstable boundaries; yes/no per criterion gives labels you can calibrate against humans and aggregate meaningfully." },
    { front: "Capability evals vs regression evals", back: "<strong>Capability:</strong> 'can it do X at all?' — scores start low, suite is a roadmap, informs. <strong>Regression:</strong> 'did we break what users rely on?' — scores start near 100, any named-case drop is a bug, gates deploys." },
    { front: "Why public benchmarks don't measure your product", back: "They evaluate the <strong>model</strong>; your product's quality is dominated by prompt, retrieval, and tool design, which benchmarks never see. Model choice is a minority of product quality — hence every serious team keeps a private suite." },
    { front: "Three LLM-as-judge setups and when each fits", back: "<strong>Single-output + rubric:</strong> regression suites (stable, parallel). <strong>Pairwise:</strong> comparing prompts/models — higher human agreement, yields rankings. <strong>Reference-guided:</strong> when a gold answer exists — judge verifies correspondence, most reliable." },
    { front: "The four documented judge biases", back: "<strong>Position</strong> (order changes pairwise verdicts), <strong>verbosity</strong> (longer scores higher at equal correctness), <strong>self-preference</strong> (favors own model family), <strong>style over substance</strong> (fluent confident prose masks factual errors)." },
    { front: "Mitigating position bias mechanically", back: "Run every pairwise comparison <strong>twice with order swapped</strong>; count only consistent verdicts, score inconsistent pairs as ties. Weaker judges flip a large fraction of verdicts on order alone." },
    { front: "Judge calibration procedure", back: "Expert-label 50-100 cases with the same rubric → run judge → measure agreement with <strong>Cohen's kappa</strong> (raw agreement is inflated by base rates) → <strong>read every disagreement</strong> (most reveal rubric ambiguity) → iterate to the human-human ceiling → re-check after any judge or rubric change." },
    { front: "Order-of-magnitude cost of a judge-graded eval run (early 2026)", back: "Small judges (4o-mini / Haiku / Flash class, ~0.10-1 dollar per M input tokens): 1,000 cases × ~1.5K tokens ≈ <strong>tens of cents to a couple dollars per run</strong>. Frontier judge panels are 10-100x — reserve for calibration audits and high-stakes bake-offs." },
    { front: "The three-tier CI eval scheme", back: "<strong>Per-PR:</strong> free code graders on everything + stratified judge-graded smoke subset (every failure mode, every past incident). <strong>Nightly:</strong> full suite on main, trended. <strong>Model-version change:</strong> full suite + repeat runs + human diff review — the largest regression source gets release-grade treatment." },
    { front: "When should an eval gate hard-block a deploy?", back: "On <strong>any named canary-case failure</strong> (past incidents, contractual/safety behaviors) — no statistics needed; and on aggregate drops <strong>beyond the measured noise floor</strong> (run the suite ~5x unchanged to measure it). Surface per-case flips for human review; never red on noise, or overrides kill the gate." },
    { front: "Why isn't temperature 0 deterministic, and what does CI do about it?", back: "GPU floating-point non-associativity, batching effects, and provider serving changes keep outputs nondeterministic at temp 0. CI response: measure run-to-run variance, use repeat runs / pass-rate-per-case for flaky cases, and treat persistent flakiness as a signal of brittle behavior." },
    { front: "What must an LLM span record beyond ordinary tracing?", back: "The <strong>fully resolved prompt</strong> (post-template, post-retrieval — where half of 'model bugs' live), full output incl. tool-call args and finish reason, model ID <strong>as served</strong>, prompt/config version, token counts and cost, latency + TTFT, and user/session linkage for feedback joins." },
    { front: "LLM observability tools landscape, early 2026", back: "OSS/self-host: <strong>Langfuse</strong>, Arize Phoenix, Helicone (proxy). Commercial: LangSmith, Braintrust, W&B Weave (tracing + evals coupled). APM incumbents: Datadog, New Relic, Grafana modules. Durable selection criteria: <strong>OTel GenAI-convention compatibility</strong>, data-retention/PII story, one-click trace-to-eval promotion." },
    { front: "Two production gotchas of trace stores", back: "<strong>Traces are a PII archive</strong> (full prompts = user documents and pasted secrets): redact at ingest, short retention, access control — at launch. And <strong>don't head-sample like APM</strong>: keep 100 percent of errored/user-flagged traces, tail-sample the healthy majority." },
    { front: "Explicit vs implicit feedback: the honest ranking", back: "Explicit (thumbs, ratings): ~1 percent response rate, polarized. <strong>Implicit behavioral signals carry the volume:</strong> acceptance rate (~30 percent is the famous code-assistant number), draft-to-sent edit distance, regeneration/retry rate, copy events, escalation rate. Downstream outcomes: truest, slowest, most confounded." },
    { front: "Drift: the three kinds and the early-warning tool", back: "<strong>Input drift</strong> (users/topics/locales shift), <strong>model drift</strong> (provider updates, snapshot deprecations — log the served model ID), <strong>ecosystem drift</strong> (stale corpus, changed tool APIs, edited shared prompts). Early warning: a <strong>daily sentinel suite</strong> against production config — it moves only when the underlying system does." }
  ],
  lab: {
    title: "Lab: build a regression eval with a CI gate from scratch",
    html: `
<p><strong>Goal:</strong> build the whole eval loop in ~80 lines of Python with no framework: a golden set in JSONL, code-based graders, an LLM judge for one fuzzy criterion, a per-case diff report, and an exit code that a CI system can gate on. Understanding what frameworks automate is the point; you can adopt one afterward with open eyes.</p>
<p><strong>Architecture:</strong> a runner script reads golden cases, calls any OpenAI-compatible chat endpoint (works with OpenAI, a local Ollama server, or most gateways — set two environment variables), grades each case with code first and a small judge model second, and exits non-zero if a canary fails or the pass rate drops below threshold. Cost: run against a small model and the whole lab is a few cents; against a local model, free.</p>

<h3>Steps</h3>
<ol>
<li><strong>Set up an isolated workspace.</strong>
<pre><code>mkdir -p ~/eval-lab &amp;&amp; cd ~/eval-lab
python3 -m venv .venv &amp;&amp; . .venv/bin/activate
pip install requests
export EVAL_BASE_URL="https://api.openai.com/v1"   # or http://localhost:11434/v1 for Ollama
export EVAL_API_KEY="sk-..."                        # any string for local servers
export EVAL_MODEL="gpt-4o-mini"                     # or a local model name</code></pre></li>
<li><strong>Create a golden set</strong> — 8 cases standing in for triaged production traces. Save as <code>golden.jsonl</code>; each line has an id, an input, a grader type, and grading data:
<pre><code>{"id": "date-format-1", "canary": true, "input": "Extract the ISO date: 'shipped March 5, 2026'", "grader": "contains", "expect": "2026-03-05"}
{"id": "json-valid-1", "canary": true, "input": "Return ONLY a JSON object with keys city and country for: Paris", "grader": "json_keys", "expect": "city,country"}
{"id": "refusal-1", "canary": false, "input": "What is the capital of France? Answer in one word.", "grader": "contains", "expect": "Paris"}
{"id": "concise-1", "canary": false, "input": "In one sentence, why do eval suites use golden sets?", "grader": "judge", "expect": "Answers in a single sentence and mentions catching regressions or measuring quality on fixed cases"}</code></pre>
Add four more cases in the same shapes so pass-rate math is meaningful.</li>
<li><strong>Write the runner</strong> as <code>run_eval.py</code>: for each case, POST to <code>/chat/completions</code>; grade with <code>contains</code> (normalized substring) or <code>json_keys</code> (parse, check keys) in code; for <code>grader: "judge"</code>, make a second call to the same endpoint with a judge prompt — "Criterion: ... Respond with JSON: verdict pass or fail, then reason" — at temperature 0, and parse the verdict field with <code>json.loads</code>, not regex. Print a per-case table (id, grader, pass/fail, latency, tokens), then exit 1 if any <code>canary: true</code> case failed, or if overall pass rate is below 0.85; else exit 0.</li>
<li><strong>Run it, then cause a regression.</strong>
<pre><code>python run_eval.py; echo "exit=$?"</code></pre>
Now simulate a bad prompt change: prepend a system message like "Always answer in flowery, elaborate prose of at least three sentences" in the runner and rerun. Watch <code>concise-1</code> and the JSON case flip to fail and the exit code go to 1 — a regression gate catching a realistic 'harmless' prompt tweak.</li>
<li><strong>Measure your noise floor</strong> — the step almost everyone skips:
<pre><code>for i in 1 2 3 4 5; do python run_eval.py | tail -1; done</code></pre>
The spread across five unchanged runs is your run-to-run variance; any CI threshold tighter than this will red on noise. With 8 cases, one flaky case is 12.5 points — exactly why real suites need dozens-to-hundreds of cases and canary/aggregate separation.</li>
<li><strong>Wire the gate</strong> (conceptually): in CI, the job is just <code>python run_eval.py</code> — a non-zero exit blocks the merge. Your smoke subset would be the canary-tagged cases; the full set runs nightly.</li>
</ol>

<h3>Verify</h3>
<p>You have seen: code graders catching structure failures for free, a judge grading a fuzzy criterion with a parseable verdict, a canary hard-block, a threshold with a measured noise floor, and a deliberate regression caught before 'deploy'. That is the entire discipline in miniature.</p>

<h3>Teardown</h3>
<p>Complete teardown — nothing bills while idle, but keys should not linger in shells:</p>
<pre><code>deactivate
unset EVAL_API_KEY EVAL_BASE_URL EVAL_MODEL
rm -rf ~/eval-lab</code></pre>
<p>If you created a fresh API key for this lab, revoke it in your provider's console. Total spend: a few cents against a hosted small model; zero against a local one.</p>
`
  }
});
