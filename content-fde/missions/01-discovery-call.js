/* Field Mission 01 — The Discovery Call (Level 1) */
window.COURSE.registerMission({
  id: "discovery-call",
  level: 1,
  title: "The Discovery Call",
  time: "2-3 hours",
  cost: "$0 (no code, no cloud spend)",
  services: ["Markdown or a notes doc", "A stakeholder-map diagram", "An optional role-play partner"],
  brief: `
<p><strong>The account:</strong> Meridian Mutual, a mid-size property insurer. Their VP of Claims has told your account executive, verbatim: <em>"We want to use AI to speed up claims."</em> The deal is signed on a discovery-and-prototype engagement. You are the FDE. You fly out Monday.</p>
<p>That sentence is not a requirement — it is a symptom wrapped around a solution. If you walk in and start building "an AI for claims," you will build something impressive that no adjuster uses, and Meridian will become another entry in the 95% of pilots that show no measurable impact. Your entire job this week is to <strong>diagnose the real problem</strong> before a single line of production code is written, and to leave with the four artifacts that make the rest of the engagement buildable.</p>
<p>You do not yet have data access (you never do in week one). You have people, a conference room, and the right to ask questions and shadow work. The claims org has an intake team, adjusters of three seniority tiers, an SIU (special investigations) fraud unit, an IT group that owns the 20-year-old claims system, and a compliance officer who can veto anything. Somewhere in there is a specific decision, made slowly or badly by a specific person, that is the real reason this deal exists. Find it.</p>
<p>This mission is deliberately code-free. Discovery is roughly 30-40% of a real FDE's week and it <em>is</em> engineering: its outputs are the inputs to everything you build. Treat it with the same rigor you would treat a system design.</p>
`,
  tasks: [
    `<strong>Reframe the stated problem into the real one.</strong> Produce a one-paragraph problem statement that names the specific person, the specific decision, and why it is slow or bad today — not "speed up claims" but something like "senior adjusters spend N hours re-reading full claim files to make a triage decision that a junior could make with the right summary." State the reasoning that got you there.`,
    `<strong>Build a stakeholder map.</strong> For each stakeholder (sponsor, end-user/doers, IT, SIU, compliance, finance), record: their pain, whether they hold budget, whether they can veto, and whether they are a likely champion or blocker. Mark the single person whose adoption decides success.`,
    `<strong>Document the current workflow as-is.</strong> Map the real end-to-end path a claim takes today, including the ugly parts (the spreadsheet someone maintains by hand, the step everyone skips, the rework loop). Note where the documented process and the real process diverge.`,
    `<strong>Inventory the data reality.</strong> List the source systems that hold claim data, and for each: what it contains, how fresh it is (real-time vs nightly dump), its quality, and who owns access. Flag the integration risks that will dominate the timeline later.`,
    `<strong>Propose the walking-skeleton first slice.</strong> Name the thinnest end-to-end thing you could ship next week against synthetic data that would prove or kill the core assumption — and say which assumption it tests.`
  ],
  hints: `
<p><strong>Ask questions that surface behavior, not opinions.</strong> "Walk me through the last claim you personally handled, start to finish" beats "what would help you?" People narrate real workflows accurately and theorize about solutions badly.</p>
<p><strong>Interview the doers, not just the managers.</strong> The VP describes the process as it is supposed to work; the adjuster three tiers down knows the spreadsheet, the workaround, and the real bottleneck. Shadow at least one real task.</p>
<p><strong>Watch for your own order-taking reflex.</strong> Every time you catch yourself thinking about model choice or architecture this week, you are avoiding discovery. There is no right answer to extract — there is a real problem to find.</p>
<p><strong>Follow the "why" ladder, but in the enterprise dialect.</strong> "Why is triage slow?" leads to "because seniors re-read everything" leads to "because they don't trust the intake summary" leads to the real problem: a trust and summarization gap, not a speed gap.</p>
<p><strong>Compliance and IT are stakeholders now, not later.</strong> A five-minute question about what data may leave which system can save you from designing an architecture that dies at the security review.</p>
`,
  walkthrough: `
<p>Here is a strong outcome for the Meridian engagement. Yours will differ — the point is the shape and rigor, not matching this exactly.</p>

<h3>The real problem</h3>
<p><strong>Stated:</strong> "speed up claims." <strong>Real (after discovery):</strong> "Senior adjusters are the bottleneck on straightforward claims. Every claim, trivial or complex, lands in a shared queue as a 40-page PDF plus scattered system records. Seniors spend roughly half their day re-reading files to decide which claims are simple enough to fast-track and which need investigation — a triage decision. Juniors could handle the simple ones, but nobody trusts the current one-line intake summary enough to route on it, so everything waits for a senior." The real target is not raw speed; it is a <strong>trustworthy triage summary</strong> that lets simple claims flow to juniors and frees seniors for complex work. Notice this reframing changes what you build (a grounded, evaluated summarization-and-triage aid with a confidence signal) and how you will be judged (adjuster hours reallocated, cycle time on simple claims), and it exposes the load-bearing risk: <em>trust</em>, which means evals are central from day one.</p>

<h3>The stakeholder map</h3>
<ul>
<li><strong>VP of Claims (sponsor, budget):</strong> pain is cycle time and adjuster cost; wants a visible win for their own leadership. Champion — but will disengage if the first demo underwhelms.</li>
<li><strong>Senior adjusters (the doers whose adoption decides success):</strong> pain is drowning in trivial files; but they are also the skeptics — if the summary is wrong once on a claim they cared about, they abandon it. <strong>This is the person to win.</strong></li>
<li><strong>Junior adjusters (beneficiaries):</strong> would receive fast-tracked claims; low power, high enthusiasm.</li>
<li><strong>SIU / fraud (potential blocker):</strong> fear that fast-tracking hides fraud signals; must be designed with, not around.</li>
<li><strong>IT (gatekeeper):</strong> owns the legacy claims system; controls data access; getting a service account will take weeks and is political.</li>
<li><strong>Compliance (veto):</strong> claim files contain PII and health data; dictates what may leave which boundary. Engage in week one.</li>
</ul>

<h3>The current workflow (as-is)</h3>
<p>Claim intake creates a record in the legacy system and a PDF in a document store. A shared queue orders claims by date, not complexity. A senior pulls the next claim, opens the PDF and three system screens, decides fast-track vs standard vs SIU, and hand-types a note. A junior maintains a side spreadsheet of "gotcha" patterns that never made it into the system. The documented SLA assumes triage takes 10 minutes; in reality complex-looking-but-simple claims can sit for a day because seniors batch them.</p>

<h3>The data reality</h3>
<ul>
<li><strong>Legacy claims system (on-prem, SQL):</strong> structured fields; access via a service account IT has not yet provisioned; likely a nightly extract, not a live API.</li>
<li><strong>Document store:</strong> the 40-page PDFs; OCR quality varies; some scanned handwriting.</li>
<li><strong>Policy system (separate vendor):</strong> coverage details; the same insured appears under different IDs than in claims — an identity-resolution problem.</li>
<li><strong>The junior's spreadsheet:</strong> undocumented but high-value domain knowledge; get a copy.</li>
</ul>
<p>Integration risk is high and will dominate the timeline: batch data, PII, cross-system identity, variable OCR. Name this to the VP now so the later slip is not a surprise.</p>

<h3>The walking-skeleton first slice</h3>
<p>Against <em>synthetic</em> claim files (you will not have real data for weeks), ship a prototype next week that takes one claim's text and produces a structured triage summary — key facts, a fast-track/standard/SIU recommendation, and a confidence score — with a 10-case golden set the seniors help define. It tests the one assumption everything rests on: <strong>can a grounded model produce a triage summary a skeptical senior adjuster would trust?</strong> If yes, the engagement has a spine. If no, you learned it in week two for the price of synthetic data, not in month four after building the full integration.</p>

<p><strong>Why this is a passing discovery:</strong> it converts a vague ask into a specific decision owned by a specific person, identifies the adoption-critical skeptic and the veto stakeholders, surfaces the integration risk early, ties success to a business metric, and ends with a thin, falsifiable first slice. You could hand this to any engineer and they would know what to build and why.</p>
`,
  teardown: `
<p>This mission produces notes and a diagram, not infrastructure — but practice clean handling of customer information, which is itself part of the FDE discipline:</p>
<ul>
<li>If you captured anything resembling real company or personal data during a role-play, <strong>delete</strong> it now.</li>
<li>Move the four artifacts you want to keep into your permanent notes, then <strong>remove</strong> the scratch working folder so stale drafts do not mislead you later: <code>rm -rf ~/meridian-discovery</code>.</li>
<li>If you recorded a practice role-play, delete the recording unless your partner agreed to keep it.</li>
</ul>
`
});
