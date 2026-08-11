/* Module 04 — Scoping & Decomposition Under Ambiguity (The Craft track) */
window.COURSE.register({
  id: "scoping",
  order: 4,
  track: "craft",
  title: "Scoping & Decomposition Under Ambiguity",
  description: "How to turn a vague, contradictory enterprise problem into a sequenced, de-risked plan you can start shipping against in week one. The single highest-weighted skill in the FDE interview and the thing you do every single day on the job: clarify before solving, decompose by risk and value, and build the thinnest end-to-end slice that proves the idea.",
  examWeight: "This is the make-or-break round: the ambiguous case study, roughly 30% of the loop's weight and the lowest pass rate of any stage (~40%). You are handed a deliberately underspecified enterprise problem and graded not on the answer but on how you attack an unfamiliar one — whether you clarify before solving, surface assumptions and failure modes, sequence by risk, and reach for a walking-skeleton MVP while thinking out loud. On the job it is the daily discipline: every deployment starts as a fog of contradictory stakeholders and mislabeled data, and your first job is always to scope it into something shippable.",
  lessons: [
    {
      id: "make-or-break-skill",
      title: "The make-or-break skill",
      html: `
<p>Every FDE interview loop has one round that decides the outcome, and it is not the coding exercise or the system-design whiteboard. It is the <strong>ambiguous case study</strong>: an interviewer hands you a deliberately vague enterprise problem — "a hospital network wants to reduce readmissions," "a logistics company is losing money on failed deliveries," "a bank wants to speed up loan decisions" — gives you no requirements document, no data dictionary, and no success metric, and watches what you do with the next forty-five minutes. It carries roughly <strong>30% of the loop's total weight</strong> and has the <strong>lowest pass rate of any stage, around 40%</strong>. If you fail here you do not get the offer, no matter how clean your rate-limiter was.</p>

<p>The reason this round dominates is that it is the most faithful proxy the interview has for the actual job. Strip an FDE deployment down to its first two weeks and it is exactly this: you walk into a customer site with a signed contract, a one-paragraph description of what they think they want, twelve source systems nobody has fully documented, and a set of stakeholders who disagree with each other about what the problem even is. There is no spec. Your entire value in that moment is the ability to take that fog and produce a sequenced, de-risked plan you can start shipping against on day one. The case study compresses that skill into an hour and grades it directly.</p>

<div class="callout limits">The numbers worth carrying into prep: the case study is ~30% of the loop weight, ~40% pass rate (the round that fails the most otherwise-strong candidates), and typically 45–60 minutes live. The single most common rejection reason across FDE loops is the same one word: the candidate <em>jumped to a solution before scoping the problem</em>. The second most common is going silent — thinking hard but not out loud — because the interviewer cannot grade reasoning they cannot hear.</div>

<h3>They are scoring your approach, not your answer</h3>
<p>The deepest misunderstanding senior engineers bring to this round is that it has a right answer they are supposed to find. It does not. The problem is under-specified <em>on purpose</em>; there is no clean solution hiding behind the ambiguity, because the ambiguity <em>is</em> the subject. The interviewer is not evaluating whether you arrive at the architecture they had in mind. They are evaluating the <strong>quality of your approach to a problem you have never seen before</strong> — because that is the only thing that transfers to a customer whose domain you will also have never seen before.</p>

<p>Concretely, a strong performance demonstrates a repeatable method: you clarify the real goal before proposing anything, you identify who the stakeholders are and what metric you will be judged on, you map what data actually exists and in what shape, you break the problem into subproblems and sequence them by risk, and you propose a thin end-to-end slice you could build first. A weak performance grabs the most technically interesting sub-piece — "I'd fine-tune a model on their historical data" — and starts designing it before establishing that it is the right thing to build, or whether the data to build it even exists.</p>

<div class="callout war">A staff-level backend engineer with a spotless coding round failed a frontier-lab loop on the case study. Handed "a retailer wants to reduce customer-service costs," he spent forty minutes designing an elegant RAG architecture — embeddings, reranking, a fallback chain — without once asking what fraction of tickets were even automatable, who would be blamed when the bot was wrong, or whether "cost" meant headcount, handle time, or escalation rate. His solution was excellent engineering for a problem nobody had established existed. The debrief note was one line: "Strong builder, but jumped straight to building. Would design the wrong thing well at a customer." That sentence is the whole failure mode of the round.</div>

<h3>Why this is the daily job, not just an interview hoop</h3>
<p>It would be tempting to treat the case study as an artificial gate — a puzzle you cram for and then forget. It is the opposite. The scoping muscle it tests is the single most-exercised skill of the working FDE, because every engagement re-enters the fog at the start. The MIT finding that ~95% of enterprise GenAI pilots produce no measurable P&amp;L impact is, read carefully, a <em>scoping</em> failure as much as an integration one: teams built something the model could do rather than something the business needed, because nobody decomposed the vague ask into the real, de-risked problem before spending the quarter. The FDE role exists to close that gap, and scoping is the first and most decisive move in closing it.</p>

<div class="callout deep">Why senior engineers specifically struggle here more than juniors sometimes do: a decade of experience trains you to pattern-match a problem to a known solution fast, which is exactly the reflex that gets you rejected. In a well-specified environment that speed is a superpower. In a deliberately ambiguous one it is a trap, because the pattern you matched is to the <em>stated</em> problem, and the stated problem is almost never the real one. The FDE case study rewards a slower, more deliberate opening move — diagnosis before prescription — and the hardest thing for a strong engineer to do is resist the pull to start solving something.</div>

<div class="callout exam">The interview probe is the setup itself: an intentionally vague prompt and silence, waiting to see whether you fill it with clarifying questions or with a premature architecture. What scores: narrating a method out loud, clarifying the goal, naming stakeholders and a success metric, mapping data reality, decomposing and sequencing, and landing on a thin first slice — while explicitly flagging assumptions and failure modes as you go. What fails: silence, or grabbing the shiniest sub-problem and designing it. On the job the same signal shows up in your first customer week: the FDE who opens with "what decision are you trying to make faster, and how will we know it worked?" versus the one who opens with "we'll build you a chatbot."</div>
`
    },
    {
      id: "decomposition-framework",
      title: "The decomposition framework",
      html: `
<p>Because the case study grades your method, you need one — a repeatable sequence you can run on any vague problem, in the interview room or the customer's conference room, that reliably converts fog into a plan. The following five steps are that method. They are not a rigid script to recite; they are the moves a strong FDE makes, roughly in this order, looping back as new information arrives. The single most important rule that spans all five: <strong>narrate continuously</strong>. Say what step you are on and why. Silence reads as stuck even when you are thinking brilliantly, and the interviewer is grading the reasoning, which means the reasoning has to be audible.</p>

<h3>Step 1 — Clarify the problem and confirm the real goal</h3>
<p>Start by refusing to accept the problem as stated. Customers and interviewers describe <em>solutions</em> and <em>symptoms</em>, almost never the underlying problem. "We want a dashboard" is a solution; the real goal might be "a regional manager makes a stocking decision every Monday and currently guesses." Ask diagnostic questions until you can state the goal as <strong>a specific decision or outcome that someone needs to be better, faster, or cheaper</strong>. Good opening questions: What decision does this inform? Who makes it today and how? What happens if we do nothing? What does "better" mean here — faster, cheaper, more accurate, more consistent? Do not move on until you can say the goal back in one sentence and the customer nods.</p>

<h3>Step 2 — Identify stakeholders and success metrics</h3>
<p>Name the people. Who is the economic buyer (signed the contract, cares about P&amp;L)? Who is the end user (has to actually use the thing and can quietly kill it by not adopting)? Who is the blocker (security, compliance, a threatened middle manager)? These often disagree, and surfacing the disagreement early is doing the customer a favor. Then, critically, pin the <strong>success metric</strong>: the single number you will be judged on. "Reduce average handle time by 20%," "cut false-positive fraud flags in half without missing more fraud," "get loan pre-approvals from three days to one hour." If you cannot name the metric, you cannot know when you are done, and you will build forever. This step is where you convert a vibe into a contract.</p>

<h3>Step 3 — Map available inputs: data shape, ownership, freshness</h3>
<p>Now confront reality. The gap between what the customer <em>says</em> they have and what actually exists is where deployments die. For each input you would need, establish three things: <strong>shape</strong> (what format — a clean warehouse table, a nightly CSV dump, a legacy SOAP endpoint, PDFs in a shared drive?), <strong>ownership</strong> (who controls access, and how long does a service account take to provision?), and <strong>freshness</strong> (real-time, daily batch, or updated whenever someone remembers?). In the interview you cannot query their warehouse, so you ask: "What data do you have on this, what form is it in, how current is it, and who owns access?" The answers reshape everything downstream — a plan that assumes real-time data collapses if the feed is a 24-hour batch.</p>

<div class="callout deep">Steps 1–3 are diagnosis; steps 4–5 are prescription. The discipline is to finish diagnosis before starting prescription, but not to treat them as strictly sequential — real scoping loops. A data-reality answer in step 3 ("the outcome labels don't exist; nobody records why a delivery failed") frequently sends you back to step 2 to renegotiate the metric, or even step 1 to reframe the goal. That looping is not indecision; it is the process working. What is <em>not</em> allowed is skipping diagnosis entirely and opening in step 4 with an architecture, which is the junior move the round is built to catch.</div>

<h3>Step 4 — Decompose into subproblems, sequenced by risk and value</h3>
<p>With the goal, metric, and data reality established, break the problem into solvable pieces — and immediately order them. The ordering axis is not "logical build order" or "easiest first." It is <strong>risk and value</strong>: which subproblem, if your assumption about it is wrong, kills the whole project? That one goes first, because you want to learn it is impossible in week two, not month four. "Can we even extract the failure reason from these free-text notes?" is riskier than "can we build a nice UI," so you attack extraction first. Sequencing is its own lesson (lesson 4); for now, the move is to make the decomposition <em>and</em> the ordering explicit and to justify the order out loud.</p>

<h3>Step 5 — Propose a walking-skeleton MVP, then iterate</h3>
<p>Finally, collapse the highest-risk slice into the thinnest thing that runs end to end and prove it. Not a component — a full, skinny path from input to output that touches every layer, built on synthetic or sampled data if the real data is not accessible yet. "In week one I'd take fifty of their historical cases, run the extraction, produce a single ranked output, and put it in front of one operator to see if it matches their judgment." That is a walking skeleton (lesson 3). It de-risks the scariest assumption, produces something the customer can react to, and gives you a real feedback loop instead of a hypothetical plan. Then you iterate: widen, harden, integrate.</p>

<div class="callout war">An FDE scoping a claims-automation deployment ran the five steps and hit a wall at step 3: the customer's "structured claims database" was in fact a decade of adjuster notes in free text, and the ground-truth labels for "was this claim fraudulent" were never recorded — they lived only in adjusters' heads. A team that had skipped straight to step 4 would have spent six weeks building a classifier with no labels to train or evaluate it against. Because the FDE mapped data reality first, the plan pivoted in the scoping room: the real first subproblem became "build a labeling workflow with three senior adjusters," and the metric shifted from "detect fraud" to "agree with the senior adjuster panel 90% of the time." Same problem, a completely different — and actually buildable — first slice, because diagnosis preceded prescription.</div>

<div class="callout exam">In the room, run the framework out loud and signpost it: "Let me first make sure I understand the real goal... okay, now who are the stakeholders and what's the metric?... now what data actually exists?... given that, here's how I'd break it up and what I'd tackle first... and here's the thinnest thing I'd build in week one." Interviewers are explicitly listening for the diagnostic questions before any solution, and for you to narrate the transitions. A candidate who asks "what does 'better' mean to you here, and how would you measure it?" in the first two minutes has already separated themselves from the majority who open by proposing a model.</div>
`
    },
    {
      id: "walking-skeleton",
      title: "The walking skeleton / thin vertical slice",
      html: `
<p>The deliverable of good scoping is not a plan document — it is the identification of the right first thing to build. That first thing has a name borrowed from software architecture: the <strong>walking skeleton</strong>. A walking skeleton is the thinnest possible implementation that runs end to end and exercises every layer of the eventual system, even though each layer is trivial. It "walks" (it runs, input to output) and it is a "skeleton" (almost no flesh — no accuracy tuning, no scale, no polish). For an FDE this is the concrete form of "ship on day one": in the first customer week you stand up a skinny path from their real input to a usable output, and everything after is adding muscle to bones that already move.</p>

<h3>Vertical, not horizontal</h3>
<p>The central discipline is that the first slice must be <strong>vertical</strong>, not horizontal. A vertical slice takes <em>one</em> workflow and builds it fully, thinly, all the way through — ingestion, transform, model call, output, and the operator seeing it. A horizontal slice builds one <em>layer</em> across all workflows — "first we'll build the whole data-ingestion platform, then next quarter the modeling layer, then the UI." Horizontal is the classic enterprise death march: you spend months building foundations and have <em>nothing that works end to end</em> to show anyone, no feedback, and enormous risk that the whole edifice is aimed at the wrong target. Vertical gives you a running system on day five that a real user can react to, which is the entire point.</p>

<table>
<thead><tr><th></th><th>Vertical slice (walking skeleton)</th><th>Horizontal slice (layer-by-layer)</th></tr></thead>
<tbody>
<tr><td>What you build first</td><td>One workflow, fully, end to end, thin</td><td>One layer (e.g. all ingestion), across everything</td></tr>
<tr><td>First demo-able result</td><td>Day 5 — a real user reacts to real output</td><td>Month 3 — foundations, nothing runs yet</td></tr>
<tr><td>Feedback loop</td><td>Immediate; corrects direction cheaply</td><td>Deferred; direction errors surface late and expensive</td></tr>
<tr><td>Risk profile</td><td>Riskiest assumption tested first</td><td>Riskiest assumption (does it solve the problem?) tested last</td></tr>
</tbody>
</table>

<h3>De-risk the riskiest assumption first</h3>
<p>A walking skeleton is not just "the easy part first." It is deliberately routed through the <strong>riskiest assumption</strong> — the belief that, if false, makes the whole project pointless. If the scary question is "can the model even extract a usable failure-reason from these messy notes?", then the skeleton must include that extraction on real (or realistic) notes, even though the UI is a printed list and the "integration" is a hand-copied CSV. Building the safe parts first — the login page, the admin panel, the data model — feels productive and defers the moment of truth, which is exactly wrong. You want to reach the moment of truth in week one, while pivoting is cheap and nobody has sunk a quarter into a doomed direction.</p>

<div class="callout deep">The walking skeleton works because of an asymmetry in what ambiguity makes expensive. Under a clear spec, big-design-upfront is defensible: you know the target, so planning the whole structure before building reduces rework. Under ambiguity, the dominant cost is not rework — it is <strong>building the wrong thing correctly</strong>, and no amount of upfront design detects that, because the design is derived from the same unverified assumptions. The only thing that detects a wrong target is contact with reality: real data, a real user reacting to real output. The walking skeleton is a machine for buying that contact as early and as cheaply as possible. It converts an unanswerable planning question ("is this the right system?") into an answerable empirical one ("did the operator find this output useful?").</p></div>

<h3>Why MVP-first beats big-design-upfront under ambiguity</h3>
<p>The MVP-first instinct is often caricatured as "move fast and skip planning." That is not it. The argument is specifically about <em>where the risk lives</em>. Big-design-upfront assumes the hard part is construction and the target is known; it front-loads architecture. Under enterprise ambiguity the hard part is knowing the target, and the target is discovered only by shipping something and watching the reaction. So you invert: build the smallest real thing, learn, then design the next increment against what you learned rather than against a guess. This is also why the FDE prototypes on <strong>synthetic data</strong> in the scoping phase — you do not need real data access to test whether the <em>shape</em> of the solution is right, and waiting for data provisioning to start learning is a month wasted.</p>

<div class="callout war">A logistics customer asked for "a complete route-optimization platform." The FDE's first instinct-check was to resist building the platform and instead ship a walking skeleton: for one depot, one day of historical orders, produce a single re-ordered delivery sequence and hand it to one veteran driver to sanity-check. The driver immediately said the "optimal" route was useless because it ignored a loading-dock constraint no data field captured. That one reaction, available in week one for the cost of a thin script, would have surfaced in month four of a horizontal "platform" build — after the ingestion layer, the optimization engine, and the fleet UI were all built around an objective that was wrong. The skeleton did not just save time; it found the real constraint that defined the actual problem.</div>

<div class="callout exam">When you reach the "what would you build first?" moment in the case study, the senior answer is always a thin vertical slice through the riskiest assumption, explicitly on synthetic or sampled data, with a named user who will react to it. Say the words: "I'd build a walking skeleton — one workflow, end to end, thin — routed through the scariest assumption, so we learn in week one whether this is even the right shape." Contrast that out loud with the horizontal trap ("I would not spend the first month building the whole ingestion platform, because then we learn nothing until it's expensive to change"). Interviewers reward candidates who can name the vertical-vs-horizontal distinction and who tie the slice to de-risking, not to ease.</div>
`
    },
    {
      id: "sequencing-and-metrics",
      title: "Sequencing by risk and value; success metrics as contract",
      html: `
<p>Decomposition gives you a set of subproblems. Sequencing decides the order you attack them in, and it is where junior and senior scoping diverge most visibly. The junior orders by dependency or by ease ("we need the data pipeline before the model, and the UI is easy, so..."). The senior orders by a single ruthless question: <strong>what, if we are wrong about it, kills the project?</strong> That subproblem goes first — always — because the entire economic value of scoping is compressing the time-to-learn on project-ending risks. You would rather discover in week two that the core idea is impossible than in month four after building everything around it.</p>

<h3>Order by what kills the project if it's wrong</h3>
<p>Every deployment rests on a small number of load-bearing assumptions. "The failure reasons are recoverable from the notes." "Operators will trust and act on a model's ranking." "The warehouse data is fresh enough to drive a same-day decision." "The 20% improvement the buyer wants is achievable at all." Rank these by <em>project-lethality</em> — how dead is the project if this one is false — and sequence your work to test the most lethal ones first, cheaply, with the walking skeleton. This is deliberately the opposite of building foundations first. Foundations are low-risk (you know you can build a database); the risk lives in the assumptions about the customer's reality, and those are what you front-load.</p>

<div class="callout deep">There are two axes, risk and value, and they usually point the same way but not always. Risk asks "how likely is this to kill the project?"; value asks "how much of the promised outcome does this deliver?". The ideal first slice is high on both: the riskiest assumption that also delivers visible value. When they conflict — a high-risk piece that delivers little on its own — risk usually still wins for the <em>first</em> slice, because a de-risking result changes what is worth doing at all, whereas a value result on a shaky foundation may evaporate. The mature move is to say this trade-off out loud: "I'm sequencing extraction first even though it's not the flashy part, because if it doesn't work, nothing downstream matters."</div>

<h3>Define "done" up front: acceptance criteria as contract</h3>
<p>You cannot sequence toward a finish line you have not drawn. Before building, define <strong>acceptance criteria</strong> — the concrete, checkable conditions that mean this subproblem is done and the outcome is achieved. Not "the model is good," but "on a held-out set of 200 historical claims, the model agrees with the senior-adjuster label at least 90% of the time, and no more than 2% of fraudulent claims are marked clean." Acceptance criteria are the currency of trust with the customer and the antidote to the endless pilot: they turn "is it working?" from an argument into a measurement. In the FDE world these criteria are effectively the contract, and the discipline of agreeing them before building is what lets you force a go/no-go decision instead of drifting in POC purgatory.</p>

<h3>The single metric you'll be judged on</h3>
<p>Among the acceptance criteria, one metric usually dominates — the number the economic buyer actually cares about. <strong>Agree on that single metric before you build anything.</strong> If the buyer says "reduce costs" and you optimize handle time while they meant headcount, you can hit your metric and still fail the engagement. Worse, if there is no agreed metric, every stakeholder silently judges you against their own, and you cannot win. The senior move is to force the definition early and get assent: "So the one number we'll both look at in six weeks is average time-to-decision, dropping from three days to under one — is that the thing that makes this a success for you?" Getting that "yes" is worth more than a week of building.</p>

<h3>Surface assumptions explicitly — and label them</h3>
<p>The final sequencing discipline is to make your assumptions visible and tagged, not buried. Every plan rests on beliefs about the customer's reality that you have not yet verified; the failure mode is leaving them implicit, so that when one breaks, the whole plan silently becomes fiction (the same dependency-invalidation problem that wrecks agent plans). State them as conditionals the customer can react to: "This plan assumes the warehouse feed is no more than 24 hours stale — if it's actually a weekly batch, the same-day-decision framing is dead and we should talk." "This assumes operators will act on a ranking rather than demanding a full explanation — if not, we need an explainability layer and the timeline grows." Labeling assumptions this way does three things: it invites the customer to correct the ones you got wrong (they often can, on the spot), it protects you when one breaks (you flagged it), and it signals exactly the calibrated, non-overpromising judgment the role demands.</p>

<div class="callout war">A pilot for a lending team looked successful for five weeks and then blew up in the readout, because two stakeholders had been judging it against different metrics the whole time. The FDE had optimized for approval-decision speed (the metric the VP stated); the risk officer had silently been watching the false-approval rate, which had crept up as a side effect of the speed gains. Nobody had written down a single agreed metric with bounds, so the "success" was real on one axis and a failure on another, and it surfaced only at the executive readout — the worst possible moment. The fix in the post-mortem was one sentence added to the scoping phase of every future engagement: name the primary metric, name the guardrail metrics that must not degrade, and get every stakeholder to assent in writing before building. Metrics-as-contract is not bureaucracy; it is the thing that prevents this exact, common, relationship-damaging failure.</div>

<div class="callout exam">The interview tell here is whether you unprompted (a) sequence by risk with an out-loud justification and (b) define a success metric and acceptance criteria before designing. Say "before I build anything, what's the one number we'll be judged on, and what would 'done' look like on a held-out set?" — and flag your assumptions as labeled conditionals as you go ("I'm assuming the data is daily-fresh; if it's weekly, here's what changes"). Interviewers specifically probe this by feeding you an assumption-breaking fact mid-case ("actually, the labels don't exist") to see if you notice which part of your plan just died. A candidate whose plan has explicit, labeled assumptions catches it instantly and re-sequences; a candidate with implicit assumptions keeps walking a plan that is now fiction.</div>
`
    },
    {
      id: "scope-discipline",
      title: "Scope discipline: saying no and cutting",
      html: `
<p>Scoping is not only about deciding what to build first — it is equally about deciding what <em>not</em> to build, and holding that line under pressure. Every enterprise engagement generates a wishlist: the buyer wants the flagship feature, three end users each want their pet workflow, a VP wants a dashboard for the board, and the security team wants an audit log for everything. Say yes to all of it and you deliver none of it well, blow the timeline, and end up the "bespoke agency of one" whose deployment never ships. Scope discipline — the ability to distinguish the wishlist from the real goal and to say no while keeping the relationship — is what separates FDEs who deliver from FDEs who drown.</p>

<h3>The wishlist versus the real goal</h3>
<p>The first discipline is diagnostic: most wishlist items are not the goal, they are stakeholders' <em>solutions</em> to their local problems. The regional manager asking for a specific chart does not need that chart; they need to make Monday's stocking call with confidence, and the chart is one guess at how. When you keep the real goal (from step 1) front and center, most of the wishlist reveals itself as either (a) a different path to the same goal, which you can defer or substitute, or (b) a different goal entirely, which is a separate engagement. The tool is to route every request back through the agreed success metric: "Does this move the one number we said we'd be judged on? If not, it's out of the first slice — let's park it." That reframing turns "no" from a personal rejection into a shared prioritization decision.</p>

<h3>Saying no while preserving the relationship</h3>
<p>How you say no matters as much as saying it, because you are a guest on their infrastructure and in their politics, and a brittle "no" wins the argument and loses the account. The reliable pattern is three moves: <strong>acknowledge, explain the trade-off, offer options</strong>.</p>
<ul>
<li><strong>Acknowledge</strong> the request as legitimate first — "That real-time alerting piece is genuinely valuable, I can see why you want it." You are validating the person before you constrain the scope, which keeps them on your side.</li>
<li><strong>Explain the trade-off</strong> honestly in terms of the shared goal — "If we add it to the first release, it pushes the go-live past your seasonal window, because it needs a streaming pipeline we don't have. The cost isn't the feature, it's the two weeks it takes from the launch date."</li>
<li><strong>Offer options</strong> rather than a flat refusal — "So: we can ship the core decision tool by the window and add alerting in the next increment, or we can move the date, or we can cut something else. Which trade do you want to make?" You have handed the choice back to them, framed by real constraints, which is respectful and keeps you the trusted advisor rather than the obstacle.</li>
</ul>
<p>Notice this is the same acknowledge-trade-off-options structure the role-play round tests for the "guarantee 100% accuracy" question. It is the general FDE move for holding a hard line diplomatically, and scope is where you use it most.</p>

<h3>Cutting scope to hit a hard deadline</h3>
<p>Sometimes the constraint is immovable: a retailer's system has to work before Black Friday, a farming tool has to ship inside the growing season, a tax product has to be live before filing season opens. When the deadline is a hard external window, scope is the only variable you can move — you cannot move the date, you should not move quality below the trust threshold, and adding people to a late deployment makes it later. The senior move is to cut scope <em>deliberately and early</em> to protect the core outcome, not to discover the overrun in the final week. Return to your risk-and-value sequencing: keep the slices that deliver the agreed metric, cut or defer everything else, and communicate the cut as a considered decision ("to protect your seasonal window, v1 does the core stocking decision and defers the nice-to-haves; here's the increment plan for the rest"). A working core delivered on time beats a complete system delivered after the window closed — which, for a seasonal deadline, is worth zero.</p>

<div class="callout limits">Sequencing/scoping numbers worth internalizing: force a go/no-go decision against pre-agreed success metrics by roughly <strong>week 6</strong> — informal pilots that drift past this are how ~62% of POCs never reach production and ~30% get abandoned after the pilot. The adapter/integration layer is almost always the <strong>longest pole</strong> in the timeline, so it is the first thing to protect when cutting scope and the last thing to add speculative features around. When a hard seasonal window exists, treat the date as fixed and scope as the sole free variable.</div>

<h3>The danger of over-committing</h3>
<p>The mirror image of scope creep is the FDE's own eagerness to please. Under the pressure of a customer relationship, it is tempting to say yes to everything — to promise the full wishlist, the aggressive date, and the 95% accuracy — because saying yes feels good in the room. It is the single fastest way to destroy a deployment. Overcommitted scope you cannot deliver curdles into missed dates, and missed dates destroy the trust that is your only real asset with the customer. Calibrated commitment — promising what you can deliver and no more, then delivering it — beats generous promises every time. The junior instinct is that saying yes builds the relationship; the senior knowledge is that <em>reliably delivering a smaller yes</em> builds it far more durably, and that a well-explained no today prevents a broken promise next month.</p>

<div class="callout war">An FDE under pressure to win an expansion committed to a customer's full feature wishlist on a date the buyer named, without re-sequencing or checking the integration timeline. The core decision engine was buildable; the three wishlist features each depended on an undocumented legacy endpoint that took five weeks just to get access to. The team shipped late, having spread its effort across all four workstreams instead of nailing the core, and the customer — who would have been thrilled with the core alone, on time — instead remembered the missed date. The post-mortem lesson was not "work harder," it was "scope harder": a deliberate early cut to the core outcome, an honest conversation about the legacy-endpoint risk, and a phased plan would have delivered a delighted customer instead of a disappointed one. Over-committing did not build the relationship it was meant to protect; it damaged it.</div>

<div class="callout exam">Scope discipline shows up in two interview rounds. In the case study, strong candidates volunteer what they would <em>cut</em> and defer, not just what they'd build — "for the first slice I'd explicitly leave out X, Y, Z and here's why" — which signals they understand delivery under constraint. In the client role-play, they test the acknowledge-trade-off-options pattern directly by having a "customer" pile on requests or demand an impossible date; the winning response validates the ask, frames the trade-off against the shared goal and timeline, and offers concrete options rather than either caving or refusing flatly. The disqualifying answers are the two extremes: saying yes to everything (over-committing) or saying a brittle no that ignores the relationship.</div>
`
    }
  ],
  quiz: [
    {
      q: "An interviewer hands you a deliberately vague case: 'a hospital network wants to reduce readmissions.' There is no data dictionary and no stated metric. What is the strongest opening move in the first few minutes?",
      options: [
        "Sketch a machine-learning architecture that predicts readmission risk from patient history, since that is clearly the technical core",
        "Ask diagnostic questions to confirm the real goal, the decision it informs, who makes it today, and what 'reduce' would be measured as before proposing anything",
        "State that the problem is too underspecified to answer and ask them to provide a requirements document",
        "Pick the sub-problem you find most technically interesting and start designing it in depth to show your engineering skill"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: clarify the real goal and the metric before proposing a solution.</strong> The round grades your approach to an unfamiliar problem, and the single most common rejection is jumping to a solution before scoping. Diagnostic questions — what decision, made by whom, measured how — establish the real problem behind the stated one, which is the whole job.</p><p>Sketching an architecture immediately is exactly the 'designs the wrong thing well' failure the round is built to catch. Declaring it too vague and demanding a spec misreads the exercise: the ambiguity is the subject, not a defect to be waived away — real customers never hand you a spec either. Grabbing the most interesting sub-problem is the same premature-solution error dressed up as enthusiasm.</p>"
    },
    {
      q: "Why does the ambiguous case study carry roughly 30% of the FDE loop weight and have the lowest pass rate of any round?",
      options: [
        "Because it is the hardest coding problem in the loop and filters for algorithmic skill",
        "Because it is the most faithful proxy for the daily job: turning a vague, unspecified enterprise problem into a de-risked, sequenced plan",
        "Because it tests memorization of the company's deployment methodology and product features",
        "Because interviewers use it to check whether candidates have prior experience in the specific customer's industry"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: it is the closest proxy the interview has for the actual work.</strong> Every deployment starts as fog — no spec, contradictory stakeholders, mislabeled data — and the FDE's first job is always to scope it into something shippable. The case study compresses that into an hour and grades it directly, which is why it dominates the weighting.</p><p>It is not primarily a coding filter; the coding round exists separately and tests different things. It is deliberately not about reciting a methodology — there is no right answer to recite. And it explicitly does not require domain experience: the point is testing how you approach a domain you have never seen, because you will constantly parachute into unfamiliar ones.</p>"
    },
    {
      q: "A team must build a customer-service automation for a retailer. Which two choices reflect building a proper walking skeleton (thin vertical slice) rather than a horizontal, layer-by-layer build? (Select 2)",
      options: [
        "Take fifty real historical tickets, run one end-to-end path from ticket to drafted response, and put it in front of one support agent to react to in week one",
        "First build the complete data-ingestion and normalization platform for all ticket sources, then move to modeling next quarter",
        "Route the first slice through the riskiest assumption — that these tickets are automatable at acceptable quality at all — even if the UI is just a printed list",
        "Build a polished admin console and authentication system first because they are low-risk and clearly needed",
        "Design the full multi-model fallback architecture in a document before writing any code, to reduce later rework"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "<p><strong>Correct: a real end-to-end slice on real tickets with a user reacting, routed through the riskiest assumption.</strong> A walking skeleton is vertical (one workflow, fully, thinly) and deliberately passes through the assumption that would kill the project if false, so you learn in week one while pivoting is cheap. Both chosen options do exactly that.</p><p>Building the whole ingestion platform first is the horizontal death march — months of foundations with nothing that runs end to end and no feedback. Building the admin console and auth first is 'easy and safe first,' which defers the moment of truth instead of reaching it early. Designing the full architecture in a document before any contact with reality is big-design-upfront, which cannot detect a wrong target because it is derived from the same unverified assumptions.</p>"
    },
    {
      q: "You have decomposed a fraud-detection deployment into subproblems: build the data pipeline, extract features from free-text notes, train a classifier, and build an operator UI. In what order should you attack them and on what principle?",
      options: [
        "In dependency order, starting with the data pipeline because everything else needs it",
        "Easiest first (the UI), to show early visible progress and build momentum",
        "By project-lethality: test the riskiest assumption first, so if the core idea is impossible you learn it in week two, not month four",
        "All in parallel, assigning one workstream to each engineer to maximize throughput"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>Correct: sequence by risk — attack the assumption that kills the project if it's wrong, first.</strong> If the scary open question is 'can we even extract usable signal from these messy notes and get labels to judge it?', that goes first, cheaply, via the walking skeleton. The economic value of scoping is compressing the time-to-learn on project-ending risks.</p><p>Dependency order front-loads low-risk foundations (you already know you can build a database) and defers the real risk — does this even solve the problem — to the end, which is backwards. Easiest-first optimizes for the feeling of progress, not for learning what could kill the project. Parallelizing everything before you have de-risked the core assumption just means four workstreams built around a target that might be wrong.</p>"
    },
    {
      q: "During scoping, the customer describes a clean 'structured claims database,' but on inspection it is a decade of adjuster notes in free text with no recorded fraud labels. Which step of the framework caught this, and what should happen next?",
      options: [
        "Step 4 (decompose); proceed with the classifier plan since the notes can be parsed later",
        "Step 3 (map available inputs); loop back to renegotiate the metric and reframe the first subproblem around building a labeling workflow",
        "Step 5 (walking skeleton); ignore the labels problem and build the UI first to show progress",
        "Step 1 (clarify goal); conclude the project is impossible and recommend cancelling"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: mapping data reality (step 3) surfaced the gap, and it should loop back to steps 1 and 2.</strong> The absence of labels means 'detect fraud' is not yet buildable or measurable; the honest move is to reframe the first subproblem as building a labeling workflow with senior adjusters and to shift the metric to 'agree with the senior-adjuster panel 90% of the time.' Scoping loops; a data-reality finding routinely reshapes the goal and metric.</p><p>Proceeding with the classifier plan ignores that there is nothing to train or evaluate against — the exact expensive mistake diagnosis-first prevents. Building the UI first while the core is unbuildable is the 'easy and safe first' trap. Declaring the project impossible overreacts: the constraint changes the first slice, it does not doom the engagement.</p>"
    },
    {
      q: "A customer keeps adding requests to the first release: real-time alerting, a board dashboard, and three teams' pet workflows. What is the most effective way to hold scope while preserving the relationship?",
      options: [
        "Agree to everything to keep the customer happy, then quietly deprioritize the extras during the build",
        "Refuse the additions flatly, explaining that the scope was already agreed and cannot change",
        "Route each request through the agreed success metric, acknowledge the ask, explain the trade-off against the timeline, and offer options for phasing",
        "Escalate every new request to your manager and pause work until they decide"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>Correct: acknowledge, explain the trade-off against the shared goal, and offer options.</strong> Routing requests through the one agreed metric turns 'no' from a personal rejection into a shared prioritization decision, and the acknowledge-trade-off-options pattern lets you hold the line while keeping the customer on your side and yourself as the trusted advisor.</p><p>Agreeing and quietly deprioritizing is covert over-committing — it destroys trust when the extras don't materialize. A flat refusal wins the argument and loses the account; you are a guest in their politics. Escalating every request abdicates the ownership the role demands — the FDE is supposed to be the person who can have this conversation directly.</p>"
    },
    {
      q: "A retailer's tool must be live before Black Friday — an immovable date — and the full scope will not fit. What is the senior response?",
      options: [
        "Add more engineers to the project to hit both the date and the full scope",
        "Cut scope deliberately and early to protect the core outcome, keeping the slices that deliver the agreed metric and deferring the rest with a phased plan",
        "Slip the date past Black Friday to deliver the complete system",
        "Lower the quality bar across all features so everything ships by the date"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: cut scope deliberately and early to protect the core.</strong> When the deadline is a hard external window, scope is the only safe variable: you can't move the date, adding people to a late project makes it later, and dropping below the trust threshold on quality poisons adoption. A working core on time beats a complete system after the window — which, for a seasonal deadline, is worth zero.</p><p>Adding engineers to a late deployment is the classic Brooks's-law mistake. Slipping past Black Friday misses the entire point of the deadline; the value is gone once the window closes. Lowering quality everywhere trades the one thing (trust in the output) that determines whether anyone uses the tool at all.</p>"
    },
    {
      q: "Why should an FDE agree on the single success metric with the economic buyer before building anything?",
      options: [
        "Because the metric is needed for the final invoice and billing reconciliation",
        "Because without one agreed metric, stakeholders silently judge the work against different numbers, so you can hit your target and still fail the engagement",
        "Because the metric determines which programming language and framework to use",
        "Because regulators require a documented metric for all enterprise AI deployments"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: an unagreed metric means everyone judges you against their own.</strong> If the VP means headcount and you optimize handle time, you can succeed on your number and fail theirs; if no metric is named, every stakeholder applies a private one and you cannot win. Forcing the definition and getting explicit assent early converts a vibe into a contract and is worth more than a week of building.</p><p>Billing is not the point — the metric is about defining success and 'done,' not invoicing. The metric does not dictate the tech stack. And while some regulated settings do require documentation, that is not why you agree a metric — you do it because it is the only way to know when you are done and to avoid the different-metrics failure that blows up at the executive readout.</p>"
    },
    {
      q: "A candidate presents a scoping plan that assumes the customer's warehouse feed is refreshed hourly. The interviewer then says: 'Actually, that feed is a weekly batch.' What does a strong candidate do, and what made it possible?",
      options: [
        "Continue with the original plan, since the pipeline can be optimized later",
        "Immediately recognize that the same-day-decision framing just died, and re-sequence — made possible by having stated the freshness assumption as an explicit, labeled conditional",
        "Ask to restart the case study from the beginning with the correct information",
        "Argue that a weekly batch is close enough and does not change the design"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: catch that a load-bearing assumption broke and re-sequence, enabled by explicit labeled assumptions.</strong> Interviewers deliberately feed an assumption-breaking fact to see if you notice which part of your plan just became fiction. A plan whose assumptions were stated as conditionals ('this assumes the feed is at most 24 hours stale; if it's weekly, the same-day framing is dead') lets you spot the impact instantly and adapt.</p><p>Continuing unchanged walks a plan that is now fiction — the exact dependency-invalidation failure explicit assumptions prevent. Restarting the case overreacts and signals you can't adapt in place, which is the real test. Hand-waving that weekly is 'close enough' ignores that it invalidates the entire same-day-decision premise the plan was built on.</p>"
    },
    {
      q: "In a scoping room, an FDE says: 'Let me first make sure I understand the real goal... now who are the stakeholders and what's the metric... now what data actually exists and how fresh is it... given that, here's what I'd tackle first and the thinnest thing I'd build in week one.' What is the FDE doing, and why say it out loud?",
      options: [
        "Stalling for time while thinking of the real architecture privately",
        "Running the decomposition framework and narrating it, because the interviewer grades the audible reasoning and silence reads as being stuck",
        "Reciting a memorized script that guarantees a passing score regardless of the answers",
        "Delaying commitment so responsibility for the plan falls on the customer"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: running the framework and narrating the transitions.</strong> The five-step method (clarify goal, stakeholders and metric, map data, decompose and sequence, walking-skeleton MVP) is only gradable if it is audible — the interviewer is scoring the reasoning, so silence, however brilliant, reads as stuck. Signposting each step is the discipline the round rewards.</p><p>It is the opposite of stalling — it is the substance being evaluated. It is not a magic script; the answers to the diagnostic questions genuinely reshape the plan, and a candidate who signposts but ignores the answers still fails. And it does not shift responsibility to the customer — it demonstrates the FDE owning the diagnosis, which is precisely the trait being tested.</p>"
    },
    {
      q: "An FDE is tempted, to win an expansion, to commit to the customer's full feature wishlist on a date the buyer named, without re-checking the integration timeline. Why is this dangerous?",
      options: [
        "Because saying yes to a customer is always inappropriate in enterprise engagements",
        "Because over-committed scope you cannot deliver turns into missed dates, and missed dates destroy the trust that is your only real asset with the customer",
        "Because the customer will expect the same fast delivery on all future projects",
        "Because it violates the company's standard contract templates"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: over-committing curdles into missed dates, which destroy trust.</strong> Calibrated commitment — promising what you can deliver and no more, then delivering it — beats generous promises, because a reliably delivered smaller yes builds the relationship far more durably than an over-ambitious yes that slips. Especially when wishlist features hide long-pole legacy-integration risk, the eager yes is the fastest way to damage the very relationship it was meant to protect.</p><p>Saying yes is not always wrong — calibrated, deliverable yeses are the job; the problem is committing beyond what you can deliver. The risk isn't about setting a fast-delivery precedent, and it isn't about contract templates — it is specifically that broken promises erode trust, the FDE's core currency.</p>"
    },
    {
      q: "Why does MVP-first (a thin vertical slice) beat big-design-upfront specifically under enterprise ambiguity, when upfront design is defensible under a clear spec?",
      options: [
        "Because planning is always wasteful and code should be written immediately",
        "Because under ambiguity the dominant cost is building the wrong thing correctly, which only contact with real data and a real user's reaction can detect — upfront design is derived from the same unverified assumptions",
        "Because MVPs are cheaper to build and cost is the only consideration",
        "Because customers cannot understand design documents and prefer demos"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: under ambiguity the hard part is knowing the target, and only shipping something reveals it.</strong> Big-design-upfront assumes construction is the hard part and the target is known; under enterprise ambiguity the target is unknown, and a design derived from unverified assumptions cannot detect that it is aimed wrong. The walking skeleton buys the earliest, cheapest contact with reality that can correct the target.</p><p>Planning is not always wasteful — under a clear spec, upfront design genuinely reduces rework; the claim is specifically about the ambiguous case. Cost is a factor but not the argument — the argument is about which risk dominates (wrong target vs construction). And while demos do help communication, the core reason is empirical target-discovery, not customers' document-reading ability.</p>"
    },
    {
      q: "You are scoping under a hard week-6 go/no-go milestone. Which combination of disciplines best protects against ending up in POC purgatory? (Select 2)",
      options: [
        "Agree the primary success metric and acceptance criteria up front so the go/no-go is a measurement, not an argument",
        "Front-load the riskiest, project-lethal assumptions so you learn whether the core idea works well before week 6",
        "Defer all difficult integration work until after the go/no-go so the pilot looks clean at the decision point",
        "Avoid naming a metric so the pilot has flexibility to be judged favorably at the milestone",
        "Expand scope continuously through the pilot to demonstrate maximum value by week 6"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>Correct: pre-agreed metrics/acceptance criteria plus front-loading the lethal assumptions.</strong> A go/no-go only works if 'go' is defined in advance as a checkable measurement, and it only produces a real decision if the project-ending risks were tested first — so by week 6 you actually know whether the core is viable. Together these force the honest decision that escapes the endless pilot.</p><p>Deferring integration (the longest pole) until after the decision makes the milestone a mirage — the hardest, most schedule-threatening work is unproven exactly when you commit. Refusing to name a metric guarantees drift and the different-metrics blowup; 'flexibility' here means 'no way to know if it worked.' Continuously expanding scope is the creep that prevents ever converging on a shippable core — the opposite of the discipline that escapes purgatory.</p>"
    }
  ],
  flashcards: [
    { front: "The ambiguous case study: weight and pass rate", back: "<p>Roughly <strong>30% of the FDE loop weight</strong> and the <strong>lowest pass rate of any round (~40%)</strong>, usually 45–60 minutes. It is the make-or-break stage because it is the most faithful proxy for the daily job: turning fog into a de-risked, sequenced plan.</p>" },
    { front: "What the case study actually scores", back: "<p>Your <strong>approach to an unfamiliar problem</strong>, not the answer. The problem is under-specified on purpose; the ambiguity is the subject. They grade whether you clarify before solving, surface assumptions and failure modes, sequence by risk, and reach for a thin MVP — while thinking out loud.</p>" },
    { front: "The #1 case-study rejection reason", back: "<p><strong>Jumped to a solution before scoping the problem.</strong> Designing an architecture for the stated problem before establishing the real goal, stakeholders, metric, and data reality is 'designs the wrong thing well.' The #2 reason: going silent instead of narrating.</p>" },
    { front: "The 5-step decomposition framework", back: "<p>(1) Clarify the problem and confirm the real goal. (2) Identify stakeholders and success metrics. (3) Map available inputs — data shape, ownership, freshness. (4) Decompose into subproblems sequenced by risk and value. (5) Propose a walking-skeleton MVP, then iterate. Loop back as reality intrudes.</p>" },
    { front: "Step 1: clarify the real goal", back: "<p>Customers describe solutions and symptoms, not the real problem. Ask: what decision does this inform, who makes it today, what happens if we do nothing, what does 'better' mean? Restate the goal as one sentence and get a nod before proposing anything.</p>" },
    { front: "Step 2: stakeholders and metrics", back: "<p>Name the <strong>economic buyer</strong> (cares about P&amp;L), the <strong>end user</strong> (adopts or quietly kills it), and the <strong>blocker</strong> (security, compliance, threatened manager). Then pin the single number you'll be judged on. If you can't name the metric, you can't know when you're done.</p>" },
    { front: "Step 3: map data reality", back: "<p>For each needed input establish <strong>shape</strong> (warehouse table vs CSV dump vs legacy SOAP vs PDFs), <strong>ownership</strong> (who grants access, how long to provision), and <strong>freshness</strong> (real-time vs daily batch vs whenever). The gap between what they say they have and what exists is where deployments die.</p>" },
    { front: "Narrate continuously — why", back: "<p>The interviewer grades the reasoning, so the reasoning must be <strong>audible</strong>. Silence reads as stuck even when you're thinking brilliantly. Signpost each framework step out loud: 'now let me check what data actually exists...' Silence is the #2 case-study failure.</p>" },
    { front: "Walking skeleton, defined", back: "<p>The <strong>thinnest implementation that runs end to end</strong> and exercises every layer, with almost no flesh (no accuracy tuning, scale, or polish). It 'walks' (runs, input to output) and is a 'skeleton' (trivial layers). The concrete form of 'ship on day one.'</p>" },
    { front: "Vertical vs horizontal slice", back: "<p><strong>Vertical:</strong> one workflow built fully, thinly, end to end — a running system a user reacts to in week one. <strong>Horizontal:</strong> one layer built across all workflows — months of foundations with nothing that runs and no feedback. Always go vertical under ambiguity.</p>" },
    { front: "De-risk the riskiest assumption first", back: "<p>Route the walking skeleton through the belief that, if false, makes the project pointless — not through the easy or safe parts. You want to reach the moment of truth in week one, while pivoting is cheap, not after a quarter is sunk into a doomed direction.</p>" },
    { front: "Why MVP-first beats big-design-upfront under ambiguity", back: "<p>Under a clear spec, upfront design reduces rework. Under ambiguity the dominant cost is <strong>building the wrong thing correctly</strong>, which upfront design can't detect (it's derived from the same unverified assumptions). Only contact with real data and a real user's reaction reveals a wrong target.</p>" },
    { front: "Sequencing principle: what kills the project?", back: "<p>Order subproblems by <strong>project-lethality</strong>: which assumption, if wrong, kills everything? That goes first, cheaply, via the skeleton — so you learn it's impossible in week two, not month four. This is the opposite of building low-risk foundations first.</p>" },
    { front: "Risk vs value axes in sequencing", back: "<p><strong>Risk:</strong> how likely is this to kill the project? <strong>Value:</strong> how much of the promised outcome does it deliver? Ideal first slice is high on both. When they conflict, risk usually wins for the first slice — a de-risking result changes what's worth doing at all.</p>" },
    { front: "Acceptance criteria as contract", back: "<p>Define concrete, checkable 'done' conditions before building — not 'the model is good' but 'agrees with the senior-adjuster label at least 90% on 200 held-out claims, misses no more than 2% of fraud.' Turns 'is it working?' from an argument into a measurement; the antidote to endless pilots.</p>" },
    { front: "The single metric, agreed up front", back: "<p>Agree the one number the economic buyer cares about <strong>before building</strong>. Without it, stakeholders silently judge you against different numbers and you can hit your target yet fail the engagement. Force the definition and get explicit assent — worth more than a week of building.</p>" },
    { front: "Label your assumptions as conditionals", back: "<p>State assumptions explicitly so a broken one doesn't silently turn the plan to fiction: 'This assumes the feed is at most 24 hours stale; if it's a weekly batch, the same-day framing is dead.' Invites correction, protects you when one breaks, signals calibrated judgment.</p>" },
    { front: "Wishlist vs real goal", back: "<p>Most wishlist items are stakeholders' <em>solutions</em> to local problems, not the goal. Route every request through the agreed metric: 'Does this move the one number we're judged on? If not, it's out of the first slice.' Turns 'no' into a shared prioritization decision.</p>" },
    { front: "Saying no: acknowledge, trade-off, options", back: "<p>(1) <strong>Acknowledge</strong> the request as legitimate. (2) <strong>Explain the trade-off</strong> against the shared goal/timeline ('it pushes go-live past your seasonal window'). (3) <strong>Offer options</strong>, not a flat refusal. Same pattern as the '100% accuracy' role-play — the general FDE move for holding a line diplomatically.</p>" },
    { front: "Cutting scope for a hard deadline", back: "<p>When the date is an immovable external window (Black Friday, growing season, filing season), <strong>scope is the only safe variable</strong> — can't move the date, adding people makes it later, cutting quality poisons trust. Cut deliberately and early to protect the core; a working core on time beats a full system after the window (worth zero).</p>" }
  ],
  lab: {
    title: "Lab: scope an ambiguous case in 60 minutes (911 response times)",
    html: `
<p><strong>Goal:</strong> rehearse the make-or-break skill under realistic time pressure by producing a written scoping decomposition for a deliberately vague enterprise problem, following the five-step framework end to end. This is the single highest-leverage rep you can do to prepare for the FDE case-study round, and it is exactly the artifact you would sketch in a real customer's conference room in week one. Zero cost: the only tools are a timer, a text editor, and your own judgment. No cloud spend, no API calls, no data.</p>

<h3>The case (read once, then start the timer)</h3>
<p>A mid-sized city's emergency-services department wants to <strong>cut 911 response times</strong>. That is the entire brief they gave you — no target number, no definition of "response time," no named owner. In a scoping call they mention they have three data sources: <strong>911 call records</strong> (timestamps, caller location, call type, free-text dispatcher notes), <strong>city traffic data</strong> (sensor and signal data of unknown freshness), and <strong>ambulance GPS traces</strong> (vehicle locations over time). Everything else is unknown and you must decide what to ask. You have <strong>60 minutes</strong>. Treat the interviewer/customer as reachable: write down the clarifying questions you would ask and make an explicit assumption for each, so you can keep moving without real answers (mirroring a live case where you narrate and assume out loud).</p>

<h3>Setup</h3>
<pre><code>mkdir -p ~/scoping-lab &amp;&amp; cd ~/scoping-lab
touch 01-goal.md 02-stakeholders-metric.md 03-data.md 04-decomposition.md 05-skeleton.md assumptions.md
# set a real 60-minute timer before you write a single word</code></pre>

<h3>Steps (time-boxed — the constraint is the point)</h3>
<ol>
<li><strong>Clarify the real goal (10 min) -&gt; 01-goal.md.</strong> Do not accept "cut response times" as the goal. Write the clarifying questions first: what does "response time" mean — call-to-dispatch, dispatch-to-on-scene, or call-to-hospital? Which call types (all, or life-threatening only)? What decision or process would change? What happens today? Then commit to a one-sentence real goal, e.g. "reduce median dispatch-to-on-scene time for life-threatening calls, by improving which unit is sent and how it's routed." Note the decision it informs (dispatcher's unit-selection and routing choice).</li>
<li><strong>Stakeholders and success metric (10 min) -&gt; 02-stakeholders-metric.md.</strong> Name the economic buyer (city/department head, cares about outcomes and budget), the end users (dispatchers and paramedics who must trust and act on it), and the blockers (data governance for health/location data, union rules, existing CAD-system vendor). Pin ONE primary metric with a target and a guardrail: e.g. primary = median dispatch-to-on-scene minutes for priority-1 calls; guardrail = do not increase response time for lower-priority calls, and no degradation in dispatch accuracy. Write why this is the number the buyer actually cares about.</li>
<li><strong>Map data reality (10 min) -&gt; 03-data.md.</strong> For each of the three sources, record shape, ownership, and freshness — and mark what you are ASSUMING versus what you would verify. Call records: shape (structured fields plus free-text notes), freshness (real-time? or exported nightly?), ownership (dispatch/CAD system). Traffic data: freshness is the killer unknown — real-time signals enable live routing; a daily batch does not. GPS traces: sampling interval and latency. Explicitly flag the labels/outcome question: is on-scene arrival time reliably recorded, so you can even measure the metric? If not, that reshapes everything.</li>
<li><strong>Decompose and sequence by risk (12 min) -&gt; 04-decomposition.md.</strong> Break the problem into subproblems (e.g. measure current baseline reliably; predict/select the optimal unit; route it given live conditions; surface the recommendation to the dispatcher in their existing tool; drive adoption). Then ORDER them by project-lethality and justify each in one line. Likely riskiest-first: "can we even measure dispatch-to-on-scene reliably from this data?" (if not, nothing is measurable), then "does traffic data have the freshness to improve routing at all?" (if it's a daily batch, the routing idea is dead), then unit-selection, then integration into the CAD workflow (the longest pole), then adoption.</li>
<li><strong>Walking-skeleton MVP (8 min) -&gt; 05-skeleton.md.</strong> Describe the thinnest vertical slice you would build in week one, on sampled/synthetic historical data, routed through the riskiest assumption. Example: "Take 100 historical priority-1 calls; from call, GPS, and traffic snapshots, compute the baseline dispatch-to-on-scene time AND what an alternative unit-selection would have predicted; put the side-by-side in front of one veteran dispatcher and ask whether the alternative would plausibly have been faster and safe." Name who reacts to it and what a go/no-go result looks like. Note what you deliberately CUT from v1 (real-time integration, the full UI, all non-priority call types).</li>
<li><strong>Consolidate assumptions (last, ongoing) -&gt; assumptions.md.</strong> Throughout, every time you assumed something, write it as a labeled conditional: "ASSUME traffic data is at least near-real-time; IF it's a daily batch, the live-routing subproblem is dead and we descope to unit-selection only." Aim for at least six labeled assumptions with their consequences. This file is your protection and your calibrated-judgment signal.</li>
</ol>

<h3>Verify (score yourself honestly)</h3>
<ul>
<li>You spent the first 20 minutes on goal, stakeholders, metric, and data BEFORE proposing any solution. If you started designing a routing algorithm in minute 5, you failed the round — restart the habit, not just the file.</li>
<li>You have exactly ONE primary metric with a target and at least one guardrail, and you can say why the buyer cares about it.</li>
<li>Your subproblems are ordered by what kills the project if it's wrong, with a one-line justification each — not by dependency or ease.</li>
<li>Your MVP is a thin VERTICAL slice through the riskiest assumption, on sampled/synthetic data, with a named human who reacts and a defined go/no-go — plus an explicit list of what you cut from v1.</li>
<li>assumptions.md has 6+ labeled conditionals, each with the consequence if it breaks. Bonus: have a friend hand you an assumption-breaking fact ("traffic data is a weekly batch") and confirm you can name which subproblem just died and re-sequence in under two minutes.</li>
</ul>

<h3>Teardown</h3>
<p>This is a paper exercise with zero cloud footprint, but keep the habit of clean cleanup. If you want to keep the decomposition as a study artifact, move it somewhere permanent; otherwise delete the scratch workspace so stale drafts do not clutter later reps:</p>
<pre><code>cd ~ &amp;&amp; rm -rf ~/scoping-lab      # delete the scratch files and the whole lab folder</code></pre>
<p>Then re-run the entire lab cold on a different vague case ("a university wants to reduce student dropout; they have enrollment, LMS-activity, and financial-aid data — 60 minutes") without looking at your notes. The skill is the repeatable method under time pressure, not any single answer — remove the safety net and prove you own the framework.</p>
`
  }
});
