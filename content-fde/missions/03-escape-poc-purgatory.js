/* Field Mission 03 — Escape POC Purgatory (Level 2) */
window.COURSE.registerMission({
  id: "escape-poc-purgatory",
  level: 2,
  title: "Escape POC Purgatory",
  time: "3-4 hours",
  cost: "$0-$2 in API credits",
  services: ["Python", "An eval harness", "A spreadsheet or Markdown for the decision memo"],
  brief: `
<p>A different account this time. NorthPort Logistics ran an 8-week pilot of an LLM assistant that answers dispatchers' questions about shipments. It demos well. It has been "almost ready" for a month. Nobody agreed what "ready" means, the champion is nervous about staking their reputation on it, and the sponsor has just asked the uncomfortable question: <strong>are we rolling this out or not?</strong></p>
<p>This is POC purgatory, the state where roughly 62% of enterprise AI pilots quietly die — not from a dramatic failure but from the absence of a decision. Extending "just one more sprint" to tweak outputs is the slow death. Your job as the FDE who inherited this is to <strong>force a defensible go/no-go</strong> against real, business-linked criteria, and to produce the eval evidence that makes the decision honest — even if the honest answer is "no."</p>
<p>You have a working prototype and a sponsor who will accept a clear recommendation with evidence. What you do not have is agreed success criteria or a golden set. Build them, run the numbers, and write the memo. An honest kill delivered in week 8 is a far better outcome for everyone — including your company's reputation — than a confident rollout that fails in production, or another month of purgatory.</p>
`,
  tasks: [
    `<strong>Define the success metric with the business, not the model.</strong> Write the one or two acceptance criteria that tie to NorthPort's real outcome (e.g. "answers dispatcher shipment-status questions correctly at least 90% of the time, and never invents a delivery date" — a correctness bar plus a safety bar), and the P&L logic behind them.`,
    `<strong>Build a golden set and scoring.</strong> Assemble 15-25 representative dispatcher questions with correct answers a NorthPort expert would endorse, including the hard cases (ambiguous shipment IDs, stale data, questions the system should refuse). Write a scoring script that reports the metrics you defined, with every failure visible.`,
    `<strong>Run the eval and produce honest numbers.</strong> Score the current prototype. Report overall performance and, separately, the rate of the unsafe failure (fabricated facts) — because a high average with a dangerous tail can still be a no-go.`,
    `<strong>Write the go/no-go recommendation memo.</strong> One page: the criteria, the measured results, the recommendation (go, no-go, or a bounded go with human-in-the-loop on low-confidence cases), and the specific reasons. Make it defensible to a skeptical sponsor.`,
    `<strong>Plan the next step for whichever way it goes.</strong> If go: the path to production (integration, monitoring, adoption). If no-go: the honest kill or the one concrete change that would change the verdict, with a hard re-decision date — not an open-ended extension.`
  ],
  hints: `
<p><strong>The metric must map to money or risk, not vibes.</strong> "The answers seem good" is why this pilot is stuck. "Correct on 90% of status questions with zero fabricated dates" is a bar a sponsor can act on.</p>
<p><strong>Separate the average from the tail.</strong> Enterprise buyers fear the catastrophic single failure more than they value the average. Measure the unsafe-failure rate as its own number and let it veto a rollout.</p>
<p><strong>A bounded go is often the right answer.</strong> "Roll out with human review on anything under 0.8 confidence" ships value while containing the tail — more honest than both "it's perfect" and "kill it."</p>
<p><strong>Force the decision date.</strong> The single most valuable thing you can add to a stuck pilot is a calendar date for the go/no-go, agreed with the sponsor, against criteria fixed in advance so they cannot be moved to manufacture a pass.</p>
<p><strong>An honest no protects your company.</strong> Shipping a doomed pilot to avoid an awkward conversation is how a vendor loses an account for good. The FDE who kills a bad pilot cleanly is trusted with the next one.</p>
`,
  walkthrough: `
<p>A strong resolution turns an ambiguous "is it ready?" into a decision backed by evidence. Here is the shape.</p>

<h3>The criteria (agreed before scoring)</h3>
<p>Two bars, both tied to the business: <strong>(1) Correctness</strong> — the assistant answers a dispatcher's shipment-status question correctly at least 90% of the time, because below that dispatchers will not trust it and will revert to phoning the warehouse, erasing the value. <strong>(2) Safety</strong> — it never fabricates a fact it cannot ground (a delivery date, a location), because a single invented delivery promise to a customer is a business incident, not a rounding error. Note the safety bar is absolute; a 95% correctness score with a 3% fabrication rate is still a no-go.</p>

<h3>The golden set</h3>
<p>20 real-shaped questions endorsed by a NorthPort dispatcher: straightforward status lookups; a question about a shipment with an ambiguous ID (should ask for clarification); a question whose answer depends on data known to be stale (should hedge or refuse); a question outside scope (should decline, not improvise). Include the correct answer and the acceptable behavior for each. The refusals and clarifications matter as much as the lookups — they are where the safety bar is tested.</p>

<h3>Scoring, honestly</h3>
<pre><code>results = run_eval(golden_set)
print("correctness:", results.correct / results.total)        # e.g. 0.86
print("fabrication rate:", results.fabricated / results.total) # e.g. 0.08
print("appropriate refusals:", results.refused_ok, "/", results.should_refuse)
for m in results.misses:
    print(m.question, "| model:", m.answer, "| truth:", m.truth)
</code></pre>
<p>Suppose the numbers come back: correctness 0.86 (below the 0.90 bar) and fabrication 0.08 (the safety bar is absolute, so any nonzero fabrication is disqualifying as-is). The average looks close to fine; the tail is the story.</p>

<h3>The recommendation</h3>
<p><strong>Verdict: bounded go, not full rollout.</strong> The reasoning, written for the sponsor: the assistant is genuinely useful on the common case but misses the correctness bar and, more importantly, fabricates facts 8% of the time — unacceptable for customer-facing delivery promises. Recommend a <strong>bounded deployment</strong>: enable it only for internal status lookups (not customer promises), require it to cite the source record for every factual claim, and route any answer it cannot ground to "I don't have reliable data — check the system," which converts most fabrications into safe refusals. Re-run this exact eval after the grounding-and-citation change; if correctness clears 0.90 and fabrication reaches zero on the golden set, expand scope. Set the re-decision for a fixed date two weeks out.</p>
<p>If instead the numbers had been correctness 0.72 and fabrication 0.15 with no cheap fix in sight, the honest recommendation is <strong>no-go</strong>: name the gap, decline to roll out, and either propose the one architectural change that could change the verdict (with a hard re-decision date) or recommend stopping. Delivering that clearly is a feature of a trustworthy FDE, not a failure.</p>

<h3>Why this escapes purgatory</h3>
<p>The pilot was stuck because "ready" was undefined, so every result was arguable and the safe move was always "one more sprint." Fixing criteria in advance, measuring the tail separately, offering a bounded-go path, and attaching a decision date removes the ambiguity that kept it alive without letting it live. The eval you built is also the artifact NorthPort keeps — the thing that lets them re-decide honestly after you are gone.</p>
`,
  teardown: `
<p>Local and cheap; clean up:</p>
<pre><code>deactivate 2>/dev/null; rm -rf ~/northport-eval   # delete the harness, golden set, and scratch memo
unset API_KEY</code></pre>
<ul>
<li><strong>Revoke</strong> any temporary API key created for the eval run.</li>
<li>If your golden set contains anything derived from real customer data, <strong>delete</strong> it; keep only fabricated examples for reuse.</li>
</ul>
`
});
