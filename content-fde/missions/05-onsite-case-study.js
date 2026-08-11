/* Field Mission 05 — The Onsite Case Study (Level 3, capstone) */
window.COURSE.registerMission({
  id: "onsite-case-study",
  level: 3,
  title: "The Onsite Case Study (Capstone)",
  time: "3-5 hours (or a timed 90-minute run)",
  cost: "$0-$2 in API credits if you build the optional slice",
  services: ["A timer", "Markdown or a whiteboard", "Python (optional thin slice)", "An LLM API (optional)"],
  brief: `
<p>The capstone. This mission reproduces the make-or-break sequence of a real FDE onsite: the <strong>ambiguous case study</strong> (the round with roughly a 40% pass rate and the highest weight in the whole loop), followed by a <strong>system-design</strong> deep-dive and a <strong>client role-play</strong> curveball — the same three pressures a real deployment throws at you, compressed into one sitting. Run it timed if you want the honest signal.</p>
<p><strong>The prompt (you have 60 minutes for the decomposition):</strong> "A logistics firm wants an AI agent that automatically reroutes shipments when something goes wrong — weather, a closed facility, a delayed carrier. They have shipment data in SAP, real-time weather APIs, and 500 warehouse managers working across a patchwork of different regional systems. How would you build it?"</p>
<p>There is no single correct answer, and that is the point. The interviewer is not grading your solution — they are watching how you approach a large, underspecified problem you have never seen: whether you clarify before solving, decompose by risk and value, surface what is missing, propose a thin slice first, and name the failure modes. This is the exact cognitive motion of the job, which is why the loop weights it so heavily. Work it end to end, then score yourself against the rubric in the walkthrough.</p>
`,
  tasks: [
    `<strong>Run the 5-step decomposition (timed, 60 min).</strong> Produce, out loud or in writing: (1) clarifying questions and the confirmed real goal; (2) stakeholders and the success metric you would be judged on; (3) the available inputs mapped by shape, ownership, and freshness; (4) the problem broken into subproblems sequenced by risk and value with explicit rationale; (5) a walking-skeleton MVP and the iteration path. Narrate continuously — do not go silent.`,
    `<strong>Surface assumptions and failure modes explicitly.</strong> List the assumptions you are making and label them as assumptions, and name the concrete ways this breaks in production ("this reroutes wrongly if the weather feed lags the storm," "SAP is a nightly batch so 'real-time' rerouting is a lie until we fix ingestion").`,
    `<strong>Design the integration and deployment architecture.</strong> Sketch the data flow across SAP, weather, and the 500-manager patchwork; the trust boundaries and auth; where the agent's actions are human-approved vs automatic; and the failure/rollback story. Treat security and the batch-vs-real-time gap as first-class, not afterthoughts.`,
    `<strong>Handle the curveball role-play.</strong> Midway, the "CTO" changes a constraint: "Actually, legal says the agent can never reroute automatically — a human must approve every change." Respond in the moment: acknowledge, absorb the constraint, and re-scope the design and MVP around human-in-the-loop without losing the thread.`,
    `<strong>Self-score against the rubric.</strong> Using the interviewer rubric in the walkthrough, rate yourself honestly on clarify-before-solving, decomposition, surfacing gaps, MVP-first, failure-mode awareness, and communication. Identify the one dimension you were weakest on and note how you would fix it.`
  ],
  hints: `
<p><strong>Spend the first five minutes not solving.</strong> Clarify the goal ("when you say reroute, does the agent execute the change or recommend it?"), the metric ("are we optimizing cost, on-time delivery, or manager workload?"), and the constraints. Jumping straight to architecture is the single most common way candidates fail this round.</p>
<p><strong>Sequence by what kills the project.</strong> The riskiest assumption here is not the model — it is whether "real-time rerouting" is even possible given SAP is probably a nightly batch, and whether 500 managers on different systems can receive an action at all. De-risk those first; they can invalidate everything downstream.</p>
<p><strong>Say the walking skeleton out loud.</strong> One shipment type, one region, weather-triggered reroute recommendation (not auto-execution), one manager's system — end to end. Then iterate. Interviewers reward the thin vertical slice over a grand horizontal design.</p>
<p><strong>Name failure modes before they ask.</strong> "This breaks if the manager data is more than 24 hours stale" is the sentence that signals seniority. Volunteer the ways it goes wrong.</p>
<p><strong>Treat the curveball as a feature.</strong> A changed constraint is not a gotcha — it is the environment shifting, exactly like a real engagement. Absorb it gracefully and re-scope; how you handle the change is scored more than the original plan.</p>
<p><strong>Silence reads as stuck.</strong> Think out loud continuously. The interviewer can only score reasoning they can hear.</p>
`,
  walkthrough: `
<p>A strong run. Again, the shape and the reasoning quality matter, not matching these specifics.</p>

<h3>Step 1 — Clarify and confirm the real goal</h3>
<p>Open with questions, not answers: Does "reroute" mean the agent <em>executes</em> the change or <em>recommends</em> it to a human? What are we optimizing — landed cost, on-time rate, or reducing the manual firefighting the 500 managers do today? How often do disruptions actually happen, and what does a manager do about one now? The likely real goal after clarifying: <strong>"reduce the manual effort and delay when a disruption requires a reroute, by surfacing a recommended reroute to the responsible manager fast and accurately"</strong> — recommendation, not autonomous action, at least to start. That reframing already de-risks the whole thing.</p>

<h3>Step 2 — Stakeholders and success metric</h3>
<p>Stakeholders: the warehouse managers (the doers whose adoption decides it — and who are on 500 different-system islands); logistics ops leadership (sponsor); IT/SAP owners (gatekeepers); legal/compliance (can veto autonomy — foreshadowing the curveball). Metric: something like "reduction in average delay on disrupted shipments" and "manager-hours saved per disruption," both P&L-linked — not "reroutes suggested."</p>

<h3>Step 3 — Map the inputs by shape, ownership, freshness</h3>
<ul>
<li><strong>SAP shipment data:</strong> almost certainly a nightly batch extract, owned by IT, access is a weeks-long political process. The "real-time" requirement collides with this immediately — a top risk.</li>
<li><strong>Weather APIs:</strong> genuinely real-time, external, easy — but the value depends on correlating them to shipment routes, which requires the SAP data to be fresh.</li>
<li><strong>500 managers on regional systems:</strong> the delivery channel is fragmented; "send the manager a recommendation" is itself an integration project across many systems, not a given.</li>
</ul>

<h3>Step 4 — Decompose, sequenced by risk and value</h3>
<ol>
<li><strong>Can we even get fresh-enough shipment state?</strong> (Highest risk — if SAP is nightly, "real-time reroute" is a fiction until ingestion is solved. De-risk first: find out the true freshness, negotiate an incremental feed or event hook.)</li>
<li><strong>Can we reach a manager with an actionable recommendation at all?</strong> (Second risk — the 500-system patchwork. Prove it for one system/region before assuming 500.)</li>
<li><strong>Is the reroute recommendation any good?</strong> (The model/ontology problem — grounding in routes, carriers, constraints; evaluable against expert judgment.)</li>
<li><strong>Trust and control</strong> (confidence, human approval, audit).</li>
</ol>
<p>Note the order: the model quality (what a junior would start with) is third, because the integration and delivery risks can kill the project before model quality matters.</p>

<h3>Step 5 — Walking-skeleton MVP</h3>
<p>One region, one shipment type, weather-triggered. When the weather feed indicates a disruption on a route, the agent correlates it to affected shipments (from whatever SAP freshness we actually have), generates a recommended reroute with a rationale and confidence, and surfaces it to <em>one</em> pilot manager in their actual system for approval. Measure delay reduction and manager time saved on that slice. Then expand regions and disruption types. This proves the two riskiest assumptions (fresh-enough data, reachable manager) on the cheapest possible footprint.</p>

<h3>Assumptions and failure modes (volunteered)</h3>
<p>Assumptions: SAP can yield near-real-time state (verify early); managers will act on a recommendation (adoption risk); weather is the dominant disruption type (may be wrong). Failure modes: stale SAP data causes reroutes based on a shipment's yesterday-position; weather feed lags the actual storm; a manager's system silently drops the recommendation; the agent recommends a reroute that violates a carrier contract it doesn't know about (ontology gap).</p>

<h3>Handling the curveball</h3>
<p>When "legal says a human must approve every reroute" lands: <em>"That actually simplifies the risk story and I'd lean into it. The MVP already surfaces a recommendation for approval rather than auto-executing, so the core design holds — I'll make human approval a hard architectural invariant, not a setting: the agent can never write a reroute directly, only propose one to the responsible manager, and every decision is logged for audit. What changes is I'd invest more in the recommendation's explanation and confidence, since a human approver needs to trust and verify it quickly, and I'd measure approval rate and time-to-approve as adoption signals."</em> The move: absorb the constraint, show the existing design mostly accommodates it, and re-scope the emphasis rather than starting over.</p>

<h3>The interviewer rubric (score yourself 1-5 each)</h3>
<ul>
<li><strong>Clarify before solving:</strong> did you spend the opening minutes on goal/metric/constraints, or jump to architecture?</li>
<li><strong>Decomposition:</strong> did you break it into subproblems sequenced by risk and value, with rationale?</li>
<li><strong>Surfacing gaps:</strong> did you explicitly name missing data, stakeholders, and unknowns rather than assuming them away?</li>
<li><strong>MVP-first:</strong> did you propose a thin vertical slice before a grand design?</li>
<li><strong>Failure-mode awareness:</strong> did you volunteer how it breaks in production?</li>
<li><strong>Communication:</strong> did you narrate continuously and adjust gracefully to the curveball?</li>
</ul>
<p>A pass is strong across clarify, decomposition, and MVP-first, with real failure-mode awareness. If you jumped to a model choice in the first five minutes, or went silent, or treated the curveball as a derailment — that is precisely the ~60% failure pattern, and now you know which dimension to drill.</p>
`,
  teardown: `
<p>Mostly a thinking exercise; clean up whatever footprint you created:</p>
<pre><code>rm -rf ~/fde-capstone            # delete written decomposition, notes, and any optional slice
deactivate 2>/dev/null; unset API_KEY</code></pre>
<ul>
<li>If you built the optional thin slice, <strong>remove</strong> the venv and scratch files and <strong>revoke</strong> any temporary API key.</li>
<li>Keep only your self-scoring notes if they are useful for tracking improvement across repeated runs; <strong>delete</strong> the rest.</li>
</ul>
`
});
