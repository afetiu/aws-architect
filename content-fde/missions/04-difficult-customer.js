/* Field Mission 04 — The Difficult Customer (Level 2) */
window.COURSE.registerMission({
  id: "difficult-customer",
  level: 2,
  title: "The Difficult Customer",
  time: "2-3 hours",
  cost: "$0 (communication drills, no code)",
  services: ["Markdown for scripting the conversations", "An optional role-play partner", "An optional voice recorder to review yourself"],
  brief: `
<p>Technical skill gets you into the room; diplomacy keeps you there. This mission is the client-simulation round of the FDE loop and the hardest part of the real job — three difficult conversations, back to back, on the same account. There is no code. The deliverable is your judgment and your language under pressure.</p>
<p><strong>The situation.</strong> You are the FDE on a strategic account. Three things land on you in one week:</p>
<ol>
<li><strong>The slip.</strong> The deployment you promised for Friday will slip three weeks — the legacy integration was worse than anyone estimated. The customer's CTO, who championed this internally and staked credibility on the date, is on the line and unhappy.</li>
<li><strong>The governance-violating ask.</strong> A senior manager wants you to add a feature that would copy customer PII into an unapproved third-party service to make a demo flashier. It would violate the data-governance terms compliance signed off on.</li>
<li><strong>The impossible guarantee.</strong> A non-technical VP will not approve rollout until you "guarantee 100% accuracy" from the AI system.</li>
</ol>
<p>Each conversation can strengthen or destroy the relationship depending on how you handle it. The through-line the interviewer (and the customer) is scoring: do you own outcomes in the first person, deliver hard truths early, acknowledge the other side's legitimate concern before you push back, and offer options with honest trade-offs — without either caving or being brittle?</p>
`,
  tasks: [
    `<strong>Script the slip conversation.</strong> Write what you actually say to the CTO. Own it in the first person, deliver the bad news early and plainly, explain the real cause without blame-shifting, and present a concrete revised plan with dates and any de-risking steps. Mark the sentences doing the trust work.`,
    `<strong>Script the governance pushback.</strong> Write how you decline the PII request while keeping the manager as an ally: acknowledge their goal (a compelling demo), name the specific governance risk plainly, and offer a compliant alternative that still achieves the underlying aim.`,
    `<strong>Script the accuracy-guarantee response.</strong> Write how you reframe "100% accuracy" for the VP: surface the real need (bounded, trustworthy risk), explain the trade-off in plain language, and propose a concrete posture — measured error bounds plus human review on low-confidence cases — that they can approve.`,
    `<strong>Annotate the diplomatic moves.</strong> Across all three scripts, label each instance of ownership language, calibrated commitment, acknowledge-before-pushback, and options-with-trade-offs. If any script contains an overpromise, a blame-shift, or a blunt refusal with no alternative, rewrite it.`,
    `<strong>Say at least one aloud.</strong> Deliver one script to a partner or a recorder, then critique your own delivery: were you early and direct, or did you bury the bad news? Did you sound like an owner or a messenger?`
  ],
  hints: `
<p><strong>Bad news travels best early and in the first person.</strong> "I misjudged the integration complexity and the date will slip three weeks; here is my recovery plan" preserves credibility. Hiding it until Friday, or saying "the team is behind," destroys it.</p>
<p><strong>Acknowledge before you push back.</strong> Every difficult ask contains a legitimate need. Validate it out loud ("I understand you want a demo that lands") before you decline the method — it turns a confrontation into joint problem-solving.</p>
<p><strong>Never overpromise to end an uncomfortable moment.</strong> Agreeing to a 100% guarantee or a three-week miracle to calm the room just relocates the blow-up to later, when it will be worse and clearly your fault.</p>
<p><strong>Offer options with trade-offs, not a single verdict.</strong> "We can hit the original date if we cut scope to X, or keep full scope and move to the 24th — here's what each costs you" gives the customer agency and shows you are on their side of the table.</p>
<p><strong>Hold the governance line without making an enemy.</strong> The compliant alternative is what separates a trusted engineer from an obstacle. Say no to the method, yes to the goal.</p>
`,
  walkthrough: `
<p>Model scripts. The exact words matter less than the structure; study why each move works.</p>

<h3>1. The slip (to the CTO)</h3>
<p><em>"Thanks for taking the call. I want to be straight with you up front: the deployment is going to slip three weeks, to the 24th. [bad news first, owned, specific] The cause is on our side of the estimate — the integration into your legacy claims system had far more undocumented edge cases than we scoped, and I underestimated it. [honest cause, first-person ownership, no blaming their IT] Here's what I'm doing about it: I've pulled in a second engineer on the adapter, I'm de-risking by shipping the read-only slice next week so your team can start validating while we finish the write path, and I'll send you a written recovery plan today with a milestone you can check against on the 17th. [concrete plan, a visible checkpoint before the new date] I also want to help you manage this internally — if it's useful, I'll join your next stakeholder review and own the timeline explanation myself so it doesn't land on you."</em> [protecting the champion's credibility — the move that turns a bad moment into deepened trust]</p>
<p>Why it works: the CTO's real fear is being blindsided and looking bad to their own leadership. Early, owned, specific bad news plus a checkpoint before the new date plus an offer to carry the internal explanation addresses the fear, not just the schedule.</p>

<h3>2. The governance-violating ask (to the manager)</h3>
<p><em>"I get what you're going for — you want the demo to really land with the exec team, and a live view on real customer records would be dramatic. [acknowledge the legitimate goal] Here's my problem with doing it that way: copying real PII into [third-party service] isn't covered by the data-governance terms your compliance team approved, and if it surfaced in the security review it could jeopardize the whole rollout — a big risk for a demo. [name the specific risk plainly, tie it to their interest] What I'd suggest instead: I'll build the demo on realistic synthetic records that look and behave exactly like the real thing, so it's just as compelling and there's zero governance exposure. If the exec team specifically wants to see real data, we take that to compliance as its own decision with lead time, not slip it in through a demo. [compliant alternative that achieves the underlying aim, plus the proper path for the real request]"</em></p>
<p>Why it works: you refuse the method, not the goal, and you make compliance-safe the path of least resistance by doing the work (synthetic data) yourself.</p>

<h3>3. The impossible guarantee (to the VP)</h3>
<p><em>"I want to make sure you can approve this confidently, so let me be honest about what I can and can't promise. [reframe toward their real need] No AI system — and honestly no human adjuster either — is right 100% of the time, and any vendor who guarantees that is setting you up. [plain truth, with a relatable comparison] What I can give you is something more useful: measured accuracy on a test set your own experts signed off on — currently it's correct on [N]% of cases — and, more importantly, the system flags its low-confidence answers for human review instead of guessing, so the cases most likely to be wrong never go out unchecked. [bounded, legible risk posture] So the real question for approval isn't 'is it perfect,' it's 'is it more accurate and better-controlled than today's process' — and on the evidence, it is. I'll put the numbers and the review workflow in writing so you have something concrete to stand behind."</em></p>
<p>Why it works: the VP does not actually want 100% — they want to not get burned. You replace an impossible absolute with a measured, human-checked risk posture they can defend to their own boss.</p>

<h3>The pattern across all three</h3>
<p>Every script: (1) leads with the hard truth or acknowledges the real need, early; (2) owns outcomes in the first person; (3) validates the other side's legitimate concern before pushing back; (4) ends with concrete options or a compliant alternative and a written follow-up. None caves, none is brittle, none overpromises. That is the engineer-diplomat under pressure — and it is exactly what the client-simulation round is built to detect.</p>
`,
  teardown: `
<p>No infrastructure — but treat the drill materials cleanly:</p>
<ul>
<li><strong>Delete</strong> any recording you made once you have reviewed it, unless your role-play partner agreed to keep it: <code>rm -f ~/fde-roleplay/*.m4a</code>.</li>
<li>Keep the annotated scripts as a personal reference if useful; otherwise <strong>remove</strong> the scratch folder: <code>rm -rf ~/fde-roleplay</code>.</li>
<li>If any scenario used a real company or person's name, scrub it from your notes — practicing discretion is part of the craft.</li>
</ul>
`
});
