/* Field Mission 02 — Ship on Day One (Level 2) */
window.COURSE.registerMission({
  id: "ship-day-one",
  level: 2,
  title: "Ship on Day One",
  time: "3-5 hours",
  cost: "$0-$2 in API credits (or $0 with a local model)",
  services: ["Python", "An LLM API (OpenAI/Anthropic) or a local model via Ollama", "Synthetic data", "A tiny eval script"],
  brief: `
<p>Continuing the Meridian Mutual engagement from the discovery mission: you have the real problem (a trustworthy triage summary for claims), a skeptical senior adjuster whose trust decides everything, and <strong>no real data access</strong> — IT has not provisioned the service account and compliance has not signed off on PII leaving the claims system. A consultant would wait. You are an FDE: you ship on day one.</p>
<p>Your goal is a thin <strong>vertical</strong> slice — one workflow, fully, end to end — running against synthetic claim data by the end of the week, good enough to demo to the senior adjuster and watch their face. Not a horizontal half-build of every feature; one claim in, one grounded triage summary out, with a confidence signal and a handful of evals. The demo is the deliverable. Its real purpose is to collapse the feedback loop: the fastest way to learn that your understanding of "a triage summary they'd trust" is wrong is to put a running one in front of them.</p>
<p>You will build the whole thing on fabricated data you generate yourself. That is a feature, not a limitation: it forces you to encode what real claims look like (the shapes, the edge cases, the messiness), and it de-risks the eventual real-data cutover because your pipeline already handles the hard cases you imagined.</p>
`,
  tasks: [
    `<strong>Generate synthetic claim data</strong> (at least 12 claims) that captures real shape and edge cases: a clearly simple claim, a clearly complex one, one with a fraud signal, one with missing fields, one with OCR-style noise, one where policy and claim disagree. Keep it in plain files you control.`,
    `<strong>Define a minimal ontology</strong> in code: Claim, Policy, and Adjuster with a few properties each, and one action — triage(claim) returning a category (fast-track / standard / SIU) plus a confidence score and a short rationale.`,
    `<strong>Build the grounded prototype</strong>: an LLM call (structured output or a tool/function schema) that ingests one synthetic claim, extracts the key facts, and produces the triage recommendation, confidence, and rationale. Ground it in your ontology's fields, not free text.`,
    `<strong>Add a tiny eval</strong>: a golden set of 8-10 synthetic claims you have hand-labeled with the correct triage category, and a script that scores the prototype and prints accuracy plus every miss. This is the seed of the trust artifact.`,
    `<strong>Demo it and capture what the demo reveals.</strong> Run it end to end, narrate it as if to the senior adjuster, and write down the three things the running prototype taught you that your discovery notes did not.`
  ],
  hints: `
<p><strong>Vertical, not horizontal.</strong> Resist adding a UI, a second workflow, or batch processing. One claim, one good triage output, evaluated. Depth on one slice beats breadth across ten.</p>
<p><strong>Make the synthetic data adversarial.</strong> The easy claims prove nothing. The claim with a missing policy number, or the simple-looking one with a hidden fraud flag, is where trust is won or lost — build those first.</p>
<p><strong>Ground the output in the ontology.</strong> A free-text summary is hard to evaluate and hard to trust. Structured fields (category, confidence, cited facts) are checkable, which is exactly what makes a skeptical adjuster and your eval both able to judge it.</p>
<p><strong>Confidence is the trust lever.</strong> A system that says "standard, 0.55 confidence, please review" earns more trust than one that confidently mislabels. Design the low-confidence path deliberately.</p>
<p><strong>The demo is discovery.</strong> Watch for the moment the adjuster says "but you'd never fast-track that" — that is the real requirement arriving, on schedule, because you shipped.</p>
`,
  walkthrough: `
<p>A strong solution is small, honest, and vertical. Structure it like this.</p>

<h3>Synthetic data</h3>
<p>Write a <code>claims.jsonl</code> with a dozen records. Each claim: an id, a policy id, a free-text description (the "PDF"), a claim amount, and a hidden ground-truth label you assign. Deliberately include: a fender-bender under a clearly-active policy (fast-track); a large fire loss with prior claims (standard/SIU); a claim whose description mentions a detail that contradicts the policy (SIU); one with a null policy id (should route to a "cannot triage, missing data" path, not a guess); one written in ALL CAPS with typos (OCR noise). The edge cases are the point — they are what the real data will throw at you.</p>

<h3>Ontology in code</h3>
<pre><code>from dataclasses import dataclass

@dataclass
class Claim:
    id: str
    policy_id: str | None
    description: str
    amount: float

# triage is the one action; it returns a structured decision, not prose.
# category in {fast-track, standard, SIU, cannot-triage}
</code></pre>
<p>Keeping Claim, Policy, and the triage action explicit in code is the seed of the ontology from Module 6 — it is the shared vocabulary you and the adjuster will argue about, and it is what makes the output evaluable.</p>

<h3>The grounded call</h3>
<p>Use structured output (or a function schema) so the model must return the exact fields. The system prompt states the adjuster's real decision rule (as you learned it in discovery), instructs the model to cite the specific claim facts driving its recommendation, and to return category "cannot-triage" with low confidence when required data is missing rather than guessing. Grounding in named fields plus mandatory citation is what turns an impressive-but-unauditable demo into something a skeptic can check.</p>
<pre><code>schema = {
  "category": "fast-track | standard | SIU | cannot-triage",
  "confidence": "0.0 to 1.0",
  "cited_facts": ["short quotes from the claim text"],
  "rationale": "one sentence"
}
</code></pre>

<h3>The eval</h3>
<p>Hand-label 8-10 of the synthetic claims with the correct category. Score the prototype: overall accuracy, plus a printed list of every miss with the model's rationale next to the truth. Crucially, count "confidently wrong on a claim that should have been cannot-triage" as the worst error class — that is the failure that destroys adjuster trust. This eval is intentionally tiny, but it is the same artifact that will grow into the acceptance-criteria contract in Module 8.</p>

<h3>What the demo teaches</h3>
<p>Expect at least one of these to surface only once it is running: the model fast-tracks a claim the adjuster would investigate because your prompt encoded the rule slightly wrong (real requirement, arriving on time); the "cannot-triage" path is needed more than you thought because synthetic-realistic data is missing fields constantly (integration foreshadowing); confidence is poorly calibrated and needs thresholds set with the adjuster (evals get co-owned). Each of these is a week-four surprise you converted into a week-one learning by shipping. Write them down — they re-scope the engagement.</p>

<p><strong>Why this passes:</strong> it is a running, grounded, evaluated vertical slice built with zero real data, designed around the trust problem rather than a generic summarizer, and it uses the demo as an instrument for discovery. That is ship-on-day-one done correctly.</p>
`,
  teardown: `
<p>Everything here is local and cheap. Clean it up:</p>
<pre><code>deactivate 2>/dev/null; rm -rf ~/meridian-slice   # delete the venv, code, and synthetic data
ollama rm the-model-you-pulled                     # if you used a local model, remove it
unset API_KEY                                       # if you used a hosted key</code></pre>
<ul>
<li>If you created a temporary API key for this mission, <strong>revoke</strong> it in the provider console.</li>
<li>Confirm no real customer data was ever used — this mission is synthetic-only by design; <strong>delete</strong> anything that is not clearly fabricated.</li>
</ul>
`
});
