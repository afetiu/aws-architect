/* Module 08 — Evals & the Currency of Trust (The Field track) */
window.COURSE.register({
  id: "evals-field",
  order: 8,
  track: "field",
  title: "Evals & the Currency of Trust",
  description: "Evals are how you know an AI system is working and how you prove it to a customer who has to stake their job on the answer. This module treats evals not as a metrics exercise but as a field and trust discipline: co-created with the customer, agreed as a contract before you build, run as a gate on every change, and handed off so trust survives after you leave.",
  examWeight: "'How do you know your AI system is actually working?' is a signature FDE interview question, engineered to detect the candidate who answers with vibes instead of a measurement methodology. On the job the eval suite is the single artifact that converts a skeptical, risk-averse buyer into a sponsor — and the thing you hand off so the deployment outlives your presence. Expect the case study and client role-play to probe whether you make evals the first thing you build with the customer, not the last thing you bolt on.",
  lessons: [
    {
      id: "how-do-you-know",
      title: "How do you know it's working?",
      html: `
<p>Ask a junior engineer how they know their AI system works and you will hear some version of "I tried a bunch of inputs and the outputs looked good." Ask a senior FDE the same question and you will get a <strong>methodology</strong>: here is the task, here is the set of cases the customer's expert labeled, here is the metric that maps to their business outcome, here is the current score with its error bounds, here is the trend across the last ten changes, and here is the failure set we have not yet closed. That gap — vibes versus a measurement you can hand someone — is the sharpest senior/junior discriminator in the entire role, and it is the same gap the interview and the field both exist to expose.</p>

<p>The mental model to hold: in enterprise AI deployment your deliverable is not a model, and it is not even working software — it is <strong>trust</strong>. The customer already assumes the model is capable; the frontier model out of the box is superhuman at the language task. What they do not have, and what you are actually being paid to manufacture, is a defensible reason to <em>act</em> on the model's output. The eval suite is the instrument that manufactures that reason. It is the currency of trust: the thing you can spend to move a risk-averse buyer from "interesting demo" to "I will put this in front of my regulator."</p>

<h3>Why a risk-averse buyer cannot act on your confidence</h3>
<p>Your confidence is non-transferable. The VP who greenlights your system is personally staking their credibility on it: when it produces a wrong output in front of a customer, an auditor, or their own CEO, <em>they</em> own that failure, not you — you will have rotated to the next account. A rational risk-averse buyer therefore cannot accept "trust me, it's good." They need evidence that is (a) legible to a non-builder, (b) tied to the outcome they are accountable for, and (c) re-runnable without you in the room. Anecdote fails all three. An eval suite passes all three — which is precisely why the question "how do you know it's working?" is not hostile skepticism but the buyer doing their job. The senior FDE hears it as the opening for the most important conversation of the engagement, not as an attack to be deflected with another cherry-picked demo.</p>

<div class="callout deep">The question is a proxy the interviewer uses to measure engineering maturity in one shot, because the honest answer forces you to reveal your whole mental model at once: whether you think in distributions or anecdotes, whether you have a definition of "correct" you did not invent yourself, whether you know the difference between average-case and worst-case behavior, and whether you treat quality as a measured, moving quantity or a one-time impression. There is nowhere to hide. A candidate who reaches for "I'd build an eval set with the customer's domain expert, pick a metric tied to their P&amp;L outcome, set an acceptance bar before building, and gate every change on it" has, in two sentences, demonstrated more than any amount of framework name-dropping.</div>

<h3>The cost of shipping without evals</h3>
<p>Shipping an AI deployment with no evals is not "moving fast" — it is flying an instrument approach with the instruments unplugged. Concretely, five things break:</p>
<ul>
<li><strong>You cannot iterate.</strong> Prompt and pipeline work without a score is guessing dressed as engineering. You "fix" case A, feel good, and silently break B through F — with no way to know until the customer finds out.</li>
<li><strong>You cannot defend.</strong> The first time a stakeholder cherry-picks a bad output in a steering meeting, you have nothing to answer with except your own reassurance, which is exactly the currency you have already spent.</li>
<li><strong>Regression is invisible.</strong> LLM systems fail silently — no stack trace, just subtly worse answers. Without a suite, quality decays under you and the first alarm is a churn conversation.</li>
<li><strong>You are trapped in POC purgatory.</strong> With no pre-agreed bar, "is it working?" is an argument that never resolves, the goalposts drift, and the pilot neither dies cleanly nor reaches production.</li>
<li><strong>You can never leave.</strong> Trust that lives only in your head cannot be handed off; the deployment depends on you personally, which is the bespoke-agency-of-one trap that ends FDE careers.</li>
</ul>

<div class="callout limits">The numbers that make this existential: the 2025 MIT-style finding that roughly <strong>95%</strong> of enterprise GenAI pilots showed no measurable P&amp;L impact; separately, on the order of <strong>62%</strong> of pilots never reach production and around <strong>30%</strong> are abandoned after the POC. The failures cluster not on model capability but on integration and trust — and the eval suite is the single cheapest instrument that attacks the trust half directly. The escape hatch from purgatory is a go/no-go decision forced by roughly <strong>week 6</strong> against success metrics agreed up front, and those metrics <em>are</em> your evals.</div>

<div class="callout war">A logistics customer ran a promising routing-assistant pilot for four months on the strength of great demos and zero evals. Every steering meeting was a vibes debate. Then in a board-adjacent review a skeptical operator pulled up three real cases where the assistant had confidently recommended illegal detours; with no measured baseline to say "those are the known 4% and here is how we catch them," the team had no answer, and the pilot died that afternoon. The model was fine. What killed it was that quality had never been made into an artifact anyone but the builders could see. The rebuild started, correctly, with the eval set — and the second time the same operator was in the room, the honest 96% with a documented failure-handling story was what turned him from blocker into sponsor.</div>

<div class="callout exam">Expect "how do you know your AI system is actually working?" verbatim, and expect follow-ups engineered to catch hand-waving: "what's your metric and why that one?", "who decided what counts as correct?", "what happens when the model provider updates?". The senior signal is to make evals the <em>first</em> thing you talk about building, co-owned with the customer, with an acceptance bar set before code — not a QA step you mention last. Answering with "I'd test it thoroughly and monitor it" is a screen-out; it is the vibes answer wearing a lab coat.</div>
`
    },
    {
      id: "evals-with-the-customer",
      title: "Building evals WITH the customer",
      html: `
<p>The single most common eval failure among strong engineers is building the eval set alone. It feels efficient and it is fatal: you will measure, with beautiful rigor, a definition of "correct" that you invented — and the customer's expert will demolish it at the first review. The governing principle of field evals is that <strong>you do not own the definition of correct; the customer's domain expert does.</strong> Your job is not to decide the right answer. It is to extract the expert's tacit judgment and encode it into an explicit, executable rubric and a labeled set of cases. You are a translator, not the oracle.</p>

<h3>The expert is the ground-truth oracle</h3>
<p>Every enterprise task you deploy into has a human who is the authority on correctness: the claims adjudicator, the underwriter, the radiologist, the support-ops lead, the compliance officer. They carry years of judgment they have never had to write down, because they have never needed to — they just <em>know</em> that this claim is fraudulent and that one is a keying error. Your deployment lives or dies on whether you can transfer that judgment into the system, and the eval set is where the transfer happens first. Co-creating it is therefore not a QA formality; it is the highest-bandwidth domain-immersion tool you have. Sitting with the expert while they label thirty real cases teaches you more about the actual task than a month of requirements documents.</p>

<h3>Co-creating the golden set</h3>
<p>The mechanics are humble and specific. Pull real cases (or, before you have data access, synthetic-but-realistic ones the expert vouches for). Put each in front of the expert. Have <em>them</em> assign the correct output — the label. Then ask the question that does all the work: <strong>"why?"</strong> The answer to "why is this one a refund and that one a replacement?" is the rubric. You are converting tacit expertise into explicit rules one case at a time. Capture the "why" in writing next to every label, because a golden set without its reasoning is a lookup table that teaches nobody and cannot be extended when a new edge case arrives.</p>

<div class="callout deep">The gold is in the disagreements. Have two experts label the same cases and you will find they disagree on a meaningful fraction — and a single expert will disagree with their own past self on re-labeling. This <strong>inter-annotator disagreement</strong> is not noise to be averaged away; it is a precise map of where the task itself is under-specified. Every case two experts split on is a case your system was always going to fail arbitrarily, because "correct" was never defined there. Surfacing that early, and forcing the customer to <em>adjudicate</em> it ("okay, when the receipt is missing but the defect is photographed, the policy is replacement") is one of the most valuable things you do on the whole engagement — the adjudication is the specification, and you got the customer to write it. Measuring inter-annotator agreement (even informally) also sets a ceiling: if two humans only agree 80% of the time, an eval that demands 95% model-vs-single-human match is measuring the wrong thing.</div>

<h3>The edge cases are the point</h3>
<p>Juniors fill a golden set with easy, representative cases and get a reassuring, meaningless score. The senior move is to deliberately over-weight the <strong>boundary</strong>: the "it depends" cases, the ambiguous ones, the ones the expert had to think about. Those define the decision surface, and they are where the business actually gets hurt. A golden set that is 90% easy cases will report 94% and tell you nothing about the 10% of hard cases that generate 100% of the incidents.</p>

<h3>Acceptance criteria as a contract</h3>
<p>Before you build, you and the customer agree — in writing — on what score, on what set, constitutes success. "The system reaches 92% field-level accuracy on the 300-case golden set, with recall on the fraud class at or above 85%, evaluated by the metric we defined, is a go for production." This is not bureaucracy; it is the instrument that escapes POC purgatory. An acceptance bar agreed up front converts the endless "is it good enough?" argument into a binary check against a number both sides signed off on, and it forces the week-6 go/no-go that keeps a pilot from drifting for a year. Set it after building and it is worthless — the number will be reverse-engineered from whatever you happened to hit, and everyone in the room will know it.</p>

<div class="callout war">A claims team's UAT blew up on day one because the FDE had labeled the golden set himself using his own reading of the policy manual. He hit 93% against his own labels and walked in confident; the adjudicators disagreed with his labels on a fifth of the cases, and the whole "93%" evaporated into an argument about what the policy even meant. The rebuild was slower and better: the adjudication lead labeled a fresh set, the disagreements between two adjudicators were escalated to the policy owner and resolved in writing, and that written adjudication became both the eval rubric and, incidentally, the first clean articulation of the policy the company had ever produced. The lesson the FDE took away: if the customer's expert has not touched your golden set, you do not have a golden set — you have your own opinion, scored.</div>

<h3>Who owns the labels</h3>
<p>The customer's domain team must own the golden set and the labeling process; you facilitate and scale it, but you never own the definition of correct. Two hard reasons. First, <strong>trust</strong>: if you own the labels, you graded your own homework, and a risk-averse buyer knows it — the score means nothing to the person who has to defend it upward. Second, <strong>survival</strong>: labels you own leave with you, and a deployment whose ground truth walked out the door is a deployment that cannot be maintained. You may absolutely help scale labeling (tooling, guidelines, active-learning selection of the most informative cases to label next), but ownership of "what is correct" stays with the people who are accountable for it. This is the same discipline as the whole role: build the thing so it survives your absence.</p>

<div class="callout exam">The case study loves this: "the customer says they want 99% accuracy — go." The junior starts estimating feasibility. The senior first asks "accuracy of what, measured how, and who decides the right answer?" — and proposes co-authoring a labeled set with their expert plus a written acceptance bar before writing a line of system code. Interviewers are listening for you to locate the definition of correct <em>outside yourself</em>, to treat expert disagreement as signal, and to make acceptance criteria a pre-build contract. Saying "I'd get a domain expert to define correctness and own the labels" unprompted is a strong senior tell.</div>
`
    },
    {
      id: "vibes-to-metrics",
      title: "From vibes to metrics in the field",
      html: `
<p>Once the customer's expert has defined correct, you have to choose <strong>what to measure</strong> — and this is a business-modeling act, not a statistics act. The failure mode here is reaching for a familiar academic proxy because it is easy to compute, and optimizing it beautifully while the outcome the customer is judged on does not move. The whole point of the FDE is to close the 95% integration-and-trust gap; picking a metric that is legible to a paper reviewer but disconnected from the customer's P&amp;L reproduces the gap with a dashboard on top.</p>

<h3>The metric maps to the customer's outcome, not to convenience</h3>
<p>Reject surface-overlap metrics like BLEU and ROUGE for anything you are staking a deployment on. They measure n-gram overlap with a reference string; a summary can score well and be confidently wrong about the one fact the operator needed, and score poorly while being exactly right in different words. The question is never "does the output resemble a reference?" It is <strong>"is the decision the operator makes on this output the right one?"</strong> Anchor the metric to the thing the operator is personally accountable for:</p>
<ul>
<li><strong>Classification / triage</strong> (is this claim fraud? which queue does this ticket go to?): precision and recall <em>per class</em>, with the error weighting the business sets — never bare accuracy, which hides the costly errors inside a reassuring average.</li>
<li><strong>Extraction</strong> (pull the invoice total, the policy number, the diagnosis code): field-level exact or normalized match, then a business-weighted aggregate so the total field and the footnote are not treated as equally important.</li>
<li><strong>Generation</strong> (draft the response, summarize the case): rubric-scored against the expert's criteria, graded by a calibrated LLM-judge or a human — surface-overlap scores are actively misleading here.</li>
<li><strong>Retrieval / RAG</strong>: recall@k, but validated against downstream answer correctness, because retrieving the right document is worthless if the system then answers wrong from it.</li>
</ul>

<h3>Asymmetric error cost is set by the business, not by you</h3>
<p>The most senior instinct in metric selection is refusing to treat all errors as equal. In fraud triage, a false negative (missing a fraudulent claim) and a false positive (flagging a legitimate one) have wildly different costs, and only the customer can tell you the exchange rate — maybe a missed fraud costs 40x a false alarm, maybe the reverse if false alarms poison customer relationships. You encode that ratio into the metric: track recall on the expensive class as a first-class number with its own acceptance bar, or compute an explicit cost-weighted error in the customer's units. Translating "one point of recall" into dollars, hours saved, SLA breaches avoided, or compliance incidents prevented is what makes the metric legible to the VP — and legibility to the VP is the entire game.</p>

<div class="callout deep">Golden set and regression set are different instruments with different jobs. The <strong>golden set</strong> is the curated, expert-labeled, deliberately-hard, relatively stable set that defines the acceptance bar — you change it carefully and deliberately, because moving it moves the meaning of "passing." The <strong>regression set</strong> grows monotonically: every production failure, every incident, every "it did the wrong thing on this real case" becomes a permanent test case the moment it is diagnosed, so the system can never silently re-break something it once handled. Golden answers "are we good enough to ship?"; regression answers "did this change break something we already got right?" Conflating them — freezing the regression set or letting incidents fail to become tests — is how the same bug ships twice.</div>

<h3>LLM-as-judge, briefly, and its field caveats</h3>
<p>You already know the mechanics of LLM-as-judge from the AI Engineering track, so the field lens is what matters here: an LLM-judge is a cheap way to scale subjective grading, and it carries known biases you must actively defend against — <strong>position bias</strong> (favoring the first option in a pairwise comparison; mitigate by swapping order and averaging), <strong>length/verbosity bias</strong> (mistaking longer for better), and <strong>self-preference</strong> (a model rating outputs in its own style or from its own family more highly). The field-specific discipline is this: <strong>never present an LLM-judge score to a risk-averse customer without first showing it correlates with their expert's judgment.</strong> Calibrate the judge against a human-labeled sample; report the agreement rate. If judge-vs-human agreement is low on this task, the judge is not trustworthy here and the number is just vibes with a decimal point — worse than no number, because it launders a guess as a measurement.</p>

<h3>When human review is required instead</h3>
<p>Automated grading has a boundary, and crossing it in a regulated enterprise is how you lose the account. Require human evaluation — at least on a sampled anchor — when the decision is high-stakes or irreversible, when it is something the customer will be audited on, and when judge-vs-human agreement is poor. The mature pattern is a hybrid: humans label the anchor sample and adjudicate the hard boundary, the calibrated judge scales grading across the bulk, and you continuously check the judge against fresh human labels so drift in the grader itself is caught. The operator is judged on real outcomes; your metric has to track those outcomes, not a convenient stand-in for them.</p>

<div class="callout war">A support-automation deployment optimized aggressively for a ROUGE-style similarity to "gold" reply templates and hit an impressive number. Deflection rate — the thing the support VP was actually measured on — did not move, and CSAT dipped. The system had learned to produce replies that <em>looked like</em> the templates while missing the customer's real question. The fix was to throw out the overlap metric and score against the expert's rubric ("did this resolve the stated issue without escalation?"), graded by a judge calibrated to the support leads' own ratings. Same model, same data; the deployment started working the week the metric started measuring the outcome instead of the surface.</div>

<div class="callout exam">A favorite drill: "you're extracting fields from invoices — what's your metric?" The junior says "accuracy." The senior asks which fields matter to the business, notes that a wrong total and a wrong memo line are not equal errors, proposes field-level normalized match with business weighting, and adds that they'd set the error tolerance with the finance team because the cost of a false extraction is theirs to price. Bonus signal: naming that you would calibrate any LLM-judge against human labels before trusting it, and reaching for a human anchor on anything audited.</div>
`
    },
    {
      id: "regression-gates",
      title: "Regression gates and continuous evals",
      html: `
<p>A golden set that sits in a notebook and gets run when someone remembers is a report, not a safeguard. The trust-preserving version is a <strong>gate</strong>: the eval suite runs automatically on every change and blocks anything that regresses from shipping. And because the ground under an AI deployment moves even when you touch nothing — the model provider updates the weights, the production data drifts — you also need <strong>continuous</strong> evals that fire on a schedule against live reality. Static, on-demand evaluation is how quality decays silently between the last time you looked and the day the customer complains.</p>

<h3>Every change runs the suite before it ships</h3>
<p>Prompt engineering, model swaps, tool changes, retrieval tweaks, temperature changes — each of these is a code change to a system whose behavior you cannot predict by reading the diff. A one-word prompt edit that fixes the complaint of the day routinely breaks five cases nobody was looking at, and there is no compiler to catch it. So the rule is mechanical and non-negotiable: <strong>no change to anything that touches model behavior ships without a green run of the full suite.</strong> Wire it into CI exactly like a test suite — the eval run computes the score on the golden and regression sets, compares against the acceptance thresholds, and <em>exits non-zero</em> if it regresses, which blocks the deploy. This is what converts "we think this prompt is better" into "we measured that this prompt is better and broke nothing," which is the only honest basis for shipping.</p>

<div class="callout deep">The silent-breakage property is what makes this different from ordinary testing. A traditional bug throws; an LLM regression just gets subtly worse — the refund classifier that quietly starts sending 3% more edge cases to the wrong queue produces no error, no exception, no alert, just slowly accumulating wrong decisions and eroding trust. The regression set is the antibody: every real failure, once diagnosed, becomes a permanent case, so the system is structurally prevented from re-breaking what it once handled. Without it, teams fix the same class of bug repeatedly and the customer watches the same failure recur, which reads — correctly — as "these people do not have control of their own system."</div>

<h3>Provider model drift and version pinning</h3>
<p>The trap that catches teams who did everything else right: pinning to a floating model alias. The model behind a convenience alias is not a fixed artifact — the provider improves it, and "improve" means "changes the behavior distribution." A model update can raise average quality across everyone's use cases while <em>regressing your specific task</em>, and you will only ever know that through your own evals on your own set. Two disciplines follow. First, <strong>pin explicit, versioned model identifiers</strong> in production, never a floating "latest"-style alias, so behavior does not change under you unannounced. Second, treat any provider version change — a new snapshot, a deprecation forcing migration — as a change that must run the full suite <em>before</em> you migrate, comparing the new version against the pinned one on your golden and regression sets. Migrating because the provider deprecated the old snapshot, without re-evaluating, is shipping an untested behavior change to a customer who trusts you specifically not to do that.</p>

<div class="callout limits">Practical cadence worth internalizing: pin exact model versions in prod; re-run the full suite on every prompt/model/tool change as a blocking CI gate; run scheduled evals against a fresh sample of live traffic on a regular interval (nightly or weekly depending on volume and stakes); and re-evaluate before every forced provider migration. The golden set is deliberately stable; the regression set only grows; the live-traffic eval set is refreshed continuously. Thresholds are the acceptance bars you agreed with the customer — a regression below the bar fails the build, and a drift on live traffic fires an alarm, not a silent log line.</div>

<h3>Scheduled evals on live traffic</h3>
<p>The golden set is a fixed yardstick, and fixed yardsticks go stale, because the production distribution drifts away from the cases you curated months ago. New customer segments, new document formats, seasonal patterns, and adversarial users all shift the input distribution, and a system that aces the frozen golden set can be quietly failing on what real users are actually sending today. The defense is an <strong>online</strong> layer: sample real production traffic on a schedule, have a human (or a calibrated judge with periodic human spot-checks) label a slice, and run evals against that fresh, real data. This catches distribution shift and emergent failure modes that a static set structurally cannot see — and the newly discovered failures graduate into the regression set, closing the loop.</p>

<h3>The suite is a gate the customer's team can run</h3>
<p>Here is the part that separates a field eval discipline from an internal engineering one: <strong>the customer's own team must be able to run the suite.</strong> The eval harness is a first-class deliverable, not your private tooling. It lives in their environment or CI, uses their credentials, is documented well enough that their engineer can run it, and gates <em>their</em> changes as much as yours. This is what lets them tweak a prompt after you are gone and know within minutes whether they broke something — which is the difference between a deployment they own and a deployment that silently rots the moment your engagement ends. A regression gate only they can run through you is not a handoff; it is a dependency, and dependency on a departed FDE is exactly the failure the whole role is built to avoid.</p>

<div class="callout war">A financial-services customer's extraction pipeline had been green and stable for months, then accuracy on a specific document type quietly fell and their ops team started noticing errors before the deployment team did — a trust-damaging inversion, the customer catching the failure first. Root cause: the system had been pinned to a floating alias, the provider had rolled the underlying model to a new snapshot, and the new snapshot happened to regress on that one document layout. Two cheap disciplines would each have prevented it independently: an explicit version pin so nothing changed unannounced, and a scheduled live-traffic eval that would have caught the drift within a day instead of weeks. The remediation that actually rebuilt trust was handing the ops team a suite they could run themselves, so the next time anything drifted, <em>they</em> would be the first to know.</div>

<div class="callout exam">Expect "you improve a prompt and the customer's complaint is fixed — how do you ship it?" The senior answer is "run the full eval suite as a blocking gate first; a fix I can't measure against regressions is a guess." And expect the drift question: "you changed nothing and it got worse — how is that possible and how would you have caught it?" Naming floating-alias model drift, explicit version pinning, and scheduled live-traffic evals — plus the point that the suite must be runnable by the customer's team — is the full-marks answer. "I'd monitor it" without a gate and without pinning is a junior tell.</div>
`
    },
    {
      id: "honest-demo-handoff",
      title: "Demoing quality honestly and handing off trust",
      html: `
<p>The demo is where trust is won or lost, and the counterintuitive truth of it is that the <strong>honest</strong> demo — the one that shows the failure cases — builds more durable trust than the flawless one. A cherry-picked demo is a loan taken out against future trust, and the repayment comes due at the worst possible moment: in production, on a real case, in front of the customer's boss. A risk-averse buyer, who lives in the world of things that go wrong, is more convinced by a team that can say exactly where their system fails and precisely how they contain it than by a team that implies it never fails. The second team is either naive or lying, and the buyer whose job is on the line can tell.</p>

<h3>Never cherry-pick; show the failure set</h3>
<p>Walk the customer through the confusion matrix, not a highlight reel. Show the failure taxonomy: here are the classes of case we get wrong, here is how often, here is why, and here is the mitigation for each — human-in-the-loop review on low-confidence outputs, a guardrail on the irreversible actions, a fallback path. This is the same "why 100% accuracy is impossible" conversation from the engineer-diplomat discipline, except now it is backed by numbers instead of asserted, which is what makes it land as competence rather than excuse-making. Acknowledging the customer's real concern — bounded, understood risk — and answering it with a measured error profile plus a containment plan is the diplomatic move that converts a skeptic into a sponsor.</p>

<h3>Calibrate expectations with real error bounds</h3>
<p>Give the customer the actual number with its uncertainty, not a point estimate stated as if it were destiny. "92% field accuracy" from a 15-case pilot set is noise wearing a suit; the honest statement is "92%, but on 15 cases the confidence interval runs from roughly the mid-70s to the high-90s, so we cannot yet distinguish this from 85% — here is the larger set we need to tighten it." Reporting a bare point estimate off a tiny sample is one of the most common ways FDEs accidentally lie: the number is technically true and practically misleading, and when reality lands outside the implied precision, the trust you spent does not come back. Confidence intervals are not statistical pedantry in this setting; they are the honest shape of what you actually know, and stating them is a credibility signal to any buyer sophisticated enough to matter.</p>

<div class="callout deep">Small golden sets cannot support the precision people instinctively read into a percentage. With around 15 examples, the sampling error on a proportion is enormous — a 90% and an 80% are often statistically indistinguishable, so treating a jump from 80% to 87% across a prompt change as "improvement" on that set is reading signal into noise. This is why the acceptance-bar set has to be large enough to resolve the differences the decision depends on, and why you report intervals, not points, when it is not. The senior habit: before celebrating a delta, ask whether the set is big enough for the delta to be real — and say so out loud to the customer, because a team that distinguishes signal from noise in front of you is a team you can trust with the ambiguous cases too.</div>

<h3>The eval suite is the durable handoff artifact</h3>
<p>When you rotate off the account, almost everything you carried in your head leaves with you — except what you encoded. The running eval suite is the artifact that makes trust survive your absence: it holds the customer-owned definition of correct (the labels and rubric), the acceptance bar, the regression history of every failure ever closed, and a gate the customer's team runs on their own changes. Handing it off — the labels, the rubric, the runner, the CI integration, and explicit ownership — is what lets the deployment keep shipping safely after you are gone, and it is the concrete antidote to the bespoke-agency-of-one trap. A deployment you can leave without it decaying is the definition of a successful FDE engagement; the eval suite is the mechanism that makes leaving possible.</p>

<h3>The ethics and the self-interest are the same</h3>
<p>Honest measurement is usually framed as an ethical stance, and it is one — but the durable argument is that it is also the self-interested one, which is why you can hold the line under pressure without feeling like a martyr. Overselling quality buys a signature today and costs you a churned account, a burned reference, and a 3am incident tomorrow. The reference customer who trusts your numbers because your numbers were always honest is the land-and-expand engine that makes the account lucrative and your reputation portable. Honesty compounds; a shaded eval is a short position on your own credibility that gets called exactly when you can least afford it. There is a second beneficiary too: your own product org, which relies on you as its highest-bandwidth signal — an eval you fudged to look good in a demo is a false signal fed back into the roadmap. Honest measurement serves the customer, your reputation, and the product simultaneously, which is a rare alignment worth recognizing when the pressure to round up is highest.</p>

<div class="callout war">Two FDEs, two demos of similar systems. The first showed only clean successes, promised "it just works," and won the room that day; six weeks into production the system hit its known failure mode in front of the customer's regulator, and because nobody had been warned or given a containment plan, the account churned and the reference was lost. The second opened with the failure cases — "here is the 7% we get wrong, here is why, here is the human-review step that catches the dangerous subset, here is the error bound" — and got a harder first meeting and a smaller initial scope. But when production behaved exactly as advertised, including the failures, the customer expanded twice in a year and became the reference that closed three more deals. Same technology; opposite trust trajectories. The honest demo lost the day and won the account.</div>

<div class="callout exam">The client role-play tests this directly: "demo your system to a skeptical VP" or "the customer wants a 100% guarantee." Full marks: show the failure cases unprompted, give a real error bound with its uncertainty rather than a flattering point estimate, present the mitigation for each failure class, and frame the eval suite as the artifact you will hand off so their team owns quality after you leave. The disqualifying moves are cherry-picking, quoting a precise-sounding percentage off a tiny sample, and promising perfection. Interviewers are explicitly checking whether you understand that honesty here is the trust-maximizing strategy, not a compliance tax.</div>
`
    }
  ],
  quiz: [
    {
      q: "In an FDE interview, the hiring manager asks 'how do you know your AI system is actually working?' Which answer best signals senior judgment?",
      options: [
        "I ran a wide range of inputs during development and the outputs consistently looked correct to me",
        "I co-author a labeled eval set with the customer's domain expert, pick a metric tied to their P&L outcome, agree an acceptance bar before building, and gate every change on the suite",
        "I rely on the model's published benchmark scores, since a frontier model is already superhuman at the task",
        "I add thorough logging and monitoring so I can investigate any issue a user reports after launch"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: a measurement methodology co-owned with the customer.</strong> The question is a proxy for engineering maturity; the senior answer reveals a whole mental model at once — correctness defined by the customer's expert (not by you), a metric mapped to the business outcome, an acceptance bar set before building, and a gate on every change.</p><p>'Outputs looked correct to me' is the vibes answer the question is designed to catch — non-transferable, distribution-blind, and anecdotal. Published benchmarks measure a generic task, not the customer's specific one, and prove nothing about integration or trust. Logging and post-hoc monitoring is reactive QA; it tells you a user complained, not whether the system meets an agreed bar before you ship — it is the vibes answer wearing a lab coat.</p>"
    },
    {
      q: "An FDE builds the golden eval set alone by reading the customer's policy manual, hits 93% against his own labels, and walks into UAT confident. The customer's adjudicators disagree with a fifth of his labels. What is the root failure?",
      options: [
        "The golden set was too small to be statistically meaningful",
        "He owned the definition of correct, which belongs to the customer's domain expert; he measured his own opinion, not the business's",
        "He should have used an LLM-as-judge to label the cases instead of doing it by hand",
        "The acceptance bar of 93% was set too low for a claims use case"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: he located the definition of correct inside himself instead of in the customer's expert.</strong> In the field you translate the expert's tacit judgment into a rubric and labels; you never invent correctness. His 93% was a precise measurement of his own reading of the policy, which the actual adjudicators — the ground-truth oracle — did not share.</p><p>Set size is not the issue; even a large set labeled by the wrong person measures the wrong thing. An LLM-judge would have scaled his mistaken definition, not fixed it — the judge needs the expert's labels to calibrate against. And the acceptance bar's height is irrelevant when the labels underneath it are contested; the number was meaningless before you could argue about whether it was high enough.</p>"
    },
    {
      q: "For a deployment to survive after the FDE rotates off the account, who should own the golden set and the labeling process?",
      options: [
        "The FDE, because they have the deepest understanding of the eval tooling and can keep labels highest-quality",
        "The customer's domain team, with the FDE facilitating and helping scale labeling but never owning the definition of correct",
        "The model provider, since they are the authority on what the model can do",
        "Whoever has the most spare time on the account, since labeling is low-skill work"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the customer's domain team owns it; you facilitate and scale.</strong> Two reasons, both load-bearing. Trust: a score on labels you own is grading your own homework, worthless to the buyer who must defend it upward. Survival: labels that leave with you leave the deployment with no ground truth to maintain against.</p><p>FDE ownership fails on both counts even if your tooling is excellent — quality of tooling does not fix 'graded your own homework' or the handoff gap. The provider is an authority on the model, not on what counts as a correct business decision. And labeling is emphatically not low-skill filler — it is where tacit expert judgment becomes the specification; assigning it to whoever is idle throws away the whole point.</p>"
    },
    {
      q: "A support-automation system is optimized to a ROUGE-style similarity against gold reply templates and scores well, but the support VP's deflection rate does not move and CSAT dips. What went wrong?",
      options: [
        "ROUGE was computed incorrectly; a corrected implementation would fix the outcome",
        "The metric measured surface overlap with reference text instead of the decision the operators are accountable for, so the system learned to look right while being unhelpful",
        "The golden set was labeled by the wrong people",
        "The model is not capable enough and needs to be swapped for a larger one"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the metric was a surface-overlap proxy disconnected from the P&L outcome.</strong> ROUGE rewards resembling a reference string; a reply can resemble the template while missing the customer's actual question. Optimizing it produces outputs that look right and do not resolve issues — reproducing the integration gap with a dashboard on top. The fix is scoring against the expert's rubric ('did this resolve the stated issue?') tied to deflection.</p><p>A corrected ROUGE is still ROUGE — the problem is the choice of metric, not its arithmetic. The labels are not implicated here; the metric definition is. And model capability is not the constraint — the same model works once the metric measures the outcome; swapping to a bigger model just optimizes the wrong target more expensively.</p>"
    },
    {
      q: "A fraud-triage deployment must choose an evaluation metric. A missed fraudulent claim costs roughly 40 times a false alarm. What is the senior approach?",
      options: [
        "Report overall accuracy, since it summarizes performance in a single number the VP can understand",
        "Encode the business's error costs into the metric — track recall on the fraud class as a first-class number with its own bar, or a cost-weighted error in the customer's units",
        "Use F1 with default equal weighting, because it balances precision and recall",
        "Optimize AUC alone, since it is threshold-independent and captures overall ranking quality"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: encode the asymmetric error cost the business sets.</strong> A 40:1 cost ratio means all-errors-equal metrics hide the errors that actually hurt. You track recall on the expensive class with its own acceptance bar, or compute an explicit cost-weighted error in dollars — and you get the ratio from the customer, because only they can price it.</p><p>Overall accuracy is precisely the trap: a reassuring average that buries the costly false negatives. Default-weighted F1 asserts precision and recall matter equally, which contradicts the 40:1 reality. AUC alone measures ranking across all thresholds and never commits to the operating point where the asymmetric cost actually bites; the business decision lives at a specific threshold, and the metric has to price errors there.</p>"
    },
    {
      q: "You plan to scale subjective grading of generated case summaries with an LLM-as-judge before showing scores to a risk-averse customer. Which of these are real judge biases or disciplines you must account for? (Select 3)",
      options: [
        "Position bias — favoring the first option in a pairwise comparison; mitigate by swapping order",
        "Length/verbosity bias — rating longer outputs higher regardless of quality",
        "Self-preference — rating outputs in its own family or style more highly",
        "Calibrating the judge against a human-labeled sample and reporting the agreement rate before trusting it",
        "Judges are unbiased once temperature is set to zero, so no calibration is needed"
      ],
      answer: [0, 1, 2, 3],
      multi: true,
      explanation: "<p><strong>Correct: position bias, length/verbosity bias, self-preference, and human calibration are all real and required.</strong> An LLM-judge favors the first-presented option (swap order and average), mistakes length for quality, and over-rates outputs resembling its own style or family. And in the field you never present a judge score to a risk-averse customer without first showing it agrees with their expert on a human-labeled sample — an uncalibrated judge is vibes with a decimal point.</p><p>The temperature claim is false and dangerous: temperature controls sampling randomness, not systematic bias, and setting it to zero does nothing about position, length, or self-preference. It also skips calibration entirely, which is the one discipline that tells you whether the judge is trustworthy for this task at all.</p>"
    },
    {
      q: "A deployment automates a decision the customer will be audited on by a regulator, and your LLM-judge shows low agreement with the customer's experts on that task. What is the right evaluation posture?",
      options: [
        "Trust the judge to scale grading across everything, since human review is too slow for production",
        "Require human evaluation on the audited decisions and anywhere judge-human agreement is poor; use the judge only where it demonstrably correlates with the experts",
        "Drop evals for this decision because regulated tasks cannot be measured objectively anyway",
        "Raise the judge model to the largest available and assume the agreement problem resolves itself"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: human review on the high-stakes, audited, low-agreement cases; judge only where it correlates.</strong> Automated grading has a boundary, and audited or irreversible decisions with poor judge-human agreement are past it. The mature pattern is hybrid — humans anchor and adjudicate the hard cases, the calibrated judge scales the rest, and you keep checking the judge against fresh human labels.</p><p>Trusting a low-agreement judge on audited decisions is how you lose the account when the regulator disagrees. Dropping evals abandons the one artifact that makes the deployment defensible — exactly backwards for a regulated task. Upsizing the judge is a hope, not a method; you would still have to measure agreement to know if it helped, and if you are measuring agreement you have the human anchor the correct answer already prescribes.</p>"
    },
    {
      q: "Ten weeks into a pilot, the FDE and the customer are still arguing about whether the system is 'good enough,' with the target shifting each meeting. Which discipline was missing from the start?",
      options: [
        "A larger engineering team to build features faster and settle the debate",
        "Acceptance criteria agreed in writing before building — a specific score on a specific set that constitutes go/no-go — forcing a decision by around week six",
        "A more capable model, which would have removed all doubt about quality",
        "More frequent demos to keep the customer engaged and reassured"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: a pre-build acceptance contract.</strong> An acceptance bar agreed up front converts the endless 'is it good enough?' argument into a binary check against a number both sides signed, and forces the week-6 go/no-go that escapes POC purgatory. Set after building, the number is reverse-engineered from whatever you hit and everyone knows it.</p><p>More engineers build the wrong-target thing faster; the debate is about the definition of success, not throughput. A better model does not resolve a debate about what 'good enough' even means — you can be superhuman and still argue endlessly with no bar. And more demos without a bar is more vibes, which is what created the drifting-goalposts problem in the first place.</p>"
    },
    {
      q: "An engineer tweaks a prompt to fix one customer complaint, ships it after eyeballing that one case, and three other case types silently start failing. What practice would have prevented this?",
      options: [
        "Manually re-testing the single fixed case more carefully before shipping",
        "A regression gate: the full eval suite runs on every change and blocks the deploy if any case regresses",
        "Reverting the prompt whenever any complaint arrives, as a safe default",
        "Asking the model to confirm that its own new behavior is correct"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: a blocking regression gate on every change.</strong> LLM systems fail silently — no exception, just subtly worse outputs — so a prompt edit that fixes case A routinely breaks B through F invisibly. Running the full suite as a CI gate that exits non-zero on any regression is the only mechanical defense; it turns 'we think this is better' into 'we measured it and broke nothing.'</p><p>Re-testing only the fixed case is exactly the blind spot — the regressions were elsewhere. Blanket reverting on any complaint makes the system unimprovable and still ships unmeasured changes when you do edit. Asking the model to self-certify trusts an optimistic self-grader over a measurement; models declare success with failing cases behind them, which is the whole reason objective gates exist.</p>"
    },
    {
      q: "A stable extraction pipeline's accuracy on one document type quietly drops, and the customer's ops team notices the errors before the deployment team does. The code was never changed. What is the most likely cause and the fix?",
      options: [
        "A bug was introduced in the last deploy; roll back the code",
        "The system was pinned to a floating model alias and the provider updated the underlying model, regressing that document type; fix with explicit version pinning plus scheduled live-traffic evals",
        "The customer's documents changed format, which is not something evals can catch",
        "The eval suite itself is broken and reporting false greens"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: provider model drift under a floating alias.</strong> A floating alias is not a fixed artifact — the provider improves the model, which changes its behavior distribution, and an update can lift average quality while regressing your specific task. You only learn this through your own evals. The fix is pinning explicit versions so nothing changes unannounced, plus scheduled evals on live traffic so drift is caught in a day, not weeks.</p><p>No code shipped, so a rollback has nothing to roll back. Format drift is real but is exactly what live-traffic evals <em>do</em> catch — the claim that evals cannot catch it is false and is the reason to run them continuously. A broken suite reporting false greens is possible but would not explain the ops team seeing real errors the suite implies do not exist; the described symptom is drift the static suite never sampled.</p>"
    },
    {
      q: "Your golden set stays green for months, yet production quality complaints steadily rise. What is happening and what closes the gap?",
      options: [
        "Nothing is wrong; a green golden set proves the system is healthy and the complaints are user error",
        "Distribution drift — real inputs have moved away from the curated golden set; sample and label live traffic on a schedule, run evals against it, and graduate new failures into the regression set",
        "The golden set needs to be frozen harder so its score stops fluctuating",
        "The acceptance bar should be lowered to match the observed production quality"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: distribution drift, caught by continuous live-traffic evals.</strong> A fixed golden set is a fixed yardstick, and production drifts away from it — new segments, new formats, seasonal patterns. A system can ace the frozen set while failing what users actually send today. Sampling and labeling real traffic on a schedule catches the emergent failures a static set structurally cannot see, and those failures then join the regression set.</p><p>A green golden set proves health only on the golden distribution, not on drifted production — dismissing complaints as user error is how you lose the account. Freezing the set harder makes it more stale, not more truthful. Lowering the bar to match reality is surrendering the definition of success to hide the drift — the opposite of the discipline.</p>"
    },
    {
      q: "You are about to demo an extraction system to a skeptical, risk-averse VP whose reputation rides on the rollout. What demo strategy best builds durable trust?",
      options: [
        "Show only clean successes and assure the VP that the system 'just works' to build maximum confidence",
        "Walk through the failure taxonomy with real rates, give the error bound with its uncertainty, present the mitigation for each failure class, and frame the eval suite as the artifact you will hand off",
        "Quote a single impressive accuracy percentage from the pilot and move quickly past questions about edge cases",
        "Promise the VP you will reach 100% accuracy before go-live so the concern is removed"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the honest demo — failures, error bounds, mitigations, and a handoff artifact.</strong> A risk-averse buyer lives in the world of things that go wrong and is more convinced by a team that can name exactly where it fails and how they contain it. Showing the confusion matrix, a real error bound, and the human-in-the-loop mitigation converts a skeptic into a sponsor; it is the numbers-backed version of the 'why not 100%?' conversation.</p><p>Cherry-picking clean successes is a loan against future trust that comes due in production in front of the VP's boss. A lone impressive percentage that dodges edge cases is the same cherry-pick with a number. Promising 100% is the overpromise that destroys deployments — no ML system guarantees it, and the VP sophisticated enough to matter knows you are either naive or lying.</p>"
    },
    {
      q: "The FDE engagement is ending. Which elements make trust and quality survive after you leave? (Select 3)",
      options: [
        "A runnable eval suite living in the customer's environment or CI that their team can execute themselves",
        "Customer-owned labels and rubric encoding the definition of correct, handed off with explicit ownership",
        "A regression set that grows with every incident, so previously-fixed failures cannot silently return",
        "A retainer keeping the FDE personally on call indefinitely so only they can run the evals",
        "A polished slide deck of the final demo results archived for reference"
      ],
      answer: [0, 1, 2],
      multi: true,
      explanation: "<p><strong>Correct: a self-runnable suite, customer-owned labels and rubric, and a growing regression set.</strong> Together these are the durable handoff artifact — the customer's team can gate their own changes, the definition of correct stays with the people accountable for it, and the system is structurally prevented from re-breaking closed failures. This is the concrete antidote to the bespoke-agency-of-one trap; a deployment you can leave without it decaying is a successful engagement.</p><p>A retainer that keeps the evals runnable only through you is the exact opposite — it manufactures the dependency the handoff is supposed to eliminate. A static slide deck of past results is a snapshot, not a living gate; it cannot catch tomorrow's regression, and trust that cannot be re-verified after you leave is trust that decays the moment you do.</p>"
    }
  ],
  flashcards: [
    { front: "The signature FDE eval question", back: "<p>'How do you know your AI system is actually working?' It separates senior from junior in the interview and the field. The junior answers with vibes ('the outputs looked good'); the senior answers with a <strong>methodology</strong> — expert-labeled set, P&amp;L-tied metric, pre-agreed acceptance bar, gate on every change.</p>" },
    { front: "Evals = the currency of trust", back: "<p>In enterprise AI the deliverable is not a model or even working software — it is <strong>trust</strong>, a defensible reason to act on the output. The eval suite is the instrument that manufactures it: legible to a non-builder, tied to the outcome they own, and re-runnable without you in the room. Vibes fail all three.</p>" },
    { front: "Why a risk-averse buyer can't act on your confidence", back: "<p>Your confidence is non-transferable. The VP personally owns the failure when the system is wrong in front of a regulator — you will have rotated off. They need transferable evidence, not 'trust me.' 'How do you know it's working?' is the buyer doing their job, not hostility.</p>" },
    { front: "The cost of shipping without evals", back: "<p>You can't iterate (fixing A silently breaks B–F), can't defend a cherry-picked failure in a steering meeting, can't see silent regression, get stuck in POC purgatory with drifting goalposts, and can never hand off. Ties to the 95% pilot-failure / trust gap.</p>" },
    { front: "Who defines 'correct'", back: "<p>Not you — the <strong>customer's domain expert</strong> (adjudicator, underwriter, radiologist, ops lead) is the ground-truth oracle. Your job is to translate their tacit judgment into an explicit rubric and labels. Build the set alone and you measure your own opinion, perfectly.</p>" },
    { front: "Co-creating the golden set", back: "<p>Put real (or vouched synthetic) cases in front of the expert; have <em>them</em> label the correct output; then ask <strong>'why?'</strong> — the answer is the rubric. Capture the reasoning next to every label. It doubles as the highest-bandwidth domain-immersion tool you have.</p>" },
    { front: "Capturing the 'why' = the rubric", back: "<p>Converting <strong>tacit expert judgment into explicit rules</strong>, one labeled case at a time. A golden set without its reasoning is a lookup table that teaches nobody and can't be extended when a new edge case arrives.</p>" },
    { front: "Inter-annotator disagreement is signal", back: "<p>Two experts split on a fraction of cases (and one expert disagrees with their past self). Not noise to average away — it is a precise map of where the task is <strong>under-specified</strong>. Forcing the customer to adjudicate those cases writes the spec. It also caps meaningful accuracy: if humans agree 80%, demanding 95% model-vs-human is measuring the wrong thing.</p>" },
    { front: "Acceptance criteria as a contract", back: "<p>Agree in writing, <strong>before building</strong>, what score on what set is a go/no-go (e.g. '92% field accuracy, fraud recall &ge; 85%, on the 300-case set'). Escapes POC purgatory and forces the ~week-6 decision. Set after building, the number is reverse-engineered and worthless.</p>" },
    { front: "Who owns the labels", back: "<p>The <strong>customer's domain team</strong> owns the golden set and labeling; you facilitate and scale. Trust: labels you own = grading your own homework. Survival: labels that leave with you leave the deployment with no ground truth. Ownership of 'correct' stays with the accountable people.</p>" },
    { front: "Reject proxy metrics (BLEU/ROUGE)", back: "<p>Surface-overlap metrics measure resemblance to a reference string, not the decision the operator is accountable for — a summary can score high and be confidently wrong. Anchor the metric to the customer's <strong>P&amp;L outcome</strong>, not to what's convenient to compute.</p>" },
    { front: "Asymmetric error cost", back: "<p>A false negative and a false positive rarely cost the same, and only the <strong>business</strong> sets the exchange rate (e.g. a missed fraud costs 40x a false alarm). Encode it: track recall on the expensive class with its own bar, or a cost-weighted error in the customer's units. Bare accuracy hides the costly errors.</p>" },
    { front: "Golden set vs regression set", back: "<p><strong>Golden:</strong> curated, expert-labeled, deliberately hard, relatively stable — defines the acceptance bar ('are we good enough to ship?'). <strong>Regression:</strong> grows monotonically — every diagnosed production failure becomes a permanent case ('did this change re-break something?'). Conflating them ships the same bug twice.</p>" },
    { front: "LLM-as-judge biases (field lens)", back: "<p>Mechanics are covered in the AI track; in the field guard against <strong>position bias</strong> (swap order, average), <strong>length/verbosity bias</strong>, and <strong>self-preference</strong> (favoring its own family/style). Never show a judge score to a risk-averse customer without proving it correlates with their expert.</p>" },
    { front: "Calibrate the judge against humans", back: "<p>Check judge-vs-human agreement on a labeled sample and report it. Low agreement on this task = the judge is untrustworthy here, and its number is <strong>vibes with a decimal point</strong> — worse than none, because it launders a guess as a measurement.</p>" },
    { front: "When human review is required", back: "<p>High-stakes/irreversible decisions, anything the customer is <strong>audited</strong> on, and tasks with poor judge-human agreement. Hybrid pattern: humans anchor and adjudicate the hard cases, calibrated judge scales the rest, and you keep re-checking the judge against fresh human labels.</p>" },
    { front: "Regression gate on every change", back: "<p>No change to anything touching model behavior (prompt, model, tool, retrieval, temperature) ships without a green run of the full suite. Wire it into CI: compute score, compare to thresholds, <strong>exit non-zero on regression</strong> to block the deploy. Turns 'we think it's better' into 'we measured it and broke nothing.'</p>" },
    { front: "Version pinning / provider drift", back: "<p>A floating model alias is not a fixed artifact — the provider updates it, and an update can lift average quality while <strong>regressing your specific task</strong>. Pin explicit versions in prod; re-run the full suite before any forced migration. You only ever learn task-specific drift through your own evals.</p>" },
    { front: "Continuous / live-traffic evals", back: "<p>The golden set is a fixed yardstick that goes stale as production <strong>drifts</strong>. Sample real traffic on a schedule, label a slice (human or spot-checked judge), run evals against it to catch distribution shift and emergent failures — which then graduate into the regression set. Static evaluation lets quality decay silently.</p>" },
    { front: "Honest demo + durable handoff artifact", back: "<p>Never cherry-pick — show the failure taxonomy, real rates, mitigations, and error <strong>bounds with uncertainty</strong> (a 92% off 15 cases is noise, not a promise). The honest demo loses the day and wins the account. The running eval suite — customer-owned labels, rubric, acceptance bar, growing regression set, self-runnable gate — is what makes trust survive after you leave.</p>" }
  ],
  lab: {
    title: "Lab: build a co-authored eval harness with a build-failing regression gate",
    html: `
<p><strong>Goal:</strong> stand up a small but real eval harness for a support-triage task — a ~15-case golden set co-authored with an imagined domain expert, a scoring function tied to the business outcome, and a regression run that <em>fails the build</em> (exits non-zero) when quality drops. You will run it against a mocked local system at zero cost, with an optional swap to a cheap real model. This is the artifact that answers 'how do you know it's working?' in code, and the thing you would hand off to the customer's team.</p>

<h3>Architecture</h3>
<p>One scratch folder, three files: a labeled golden set (the customer's expert's judgment, encoded), a system-under-test (a mocked rule-based classifier you can perturb to simulate a regression, swappable for a real model), and a runner that scores the system against the set, checks per-class recall against acceptance thresholds, and exits non-zero on a regression so CI would block the deploy. The task: classify a support message as <code>refund</code>, <code>replacement</code>, or <code>none</code> — a decision a support-ops team is judged on. Cost: zero mocked; about a cent if you wire in a hosted mini-tier model.</p>

<h3>Steps</h3>
<ol>
<li><strong>Set up a scratch workspace.</strong>
<pre><code>mkdir -p ~/eval-lab &amp;&amp; cd ~/eval-lab
python3 -m venv .venv &amp;&amp; . .venv/bin/activate</code></pre></li>

<li><strong>Co-author the golden set with your "domain expert."</strong> Imagine Dana, the support-ops lead. Each case carries the label <em>and the reason</em> (the rubric, captured as you go). Note the deliberate edge cases — missing receipt, defect photographed, out-of-window — because the boundary is where the business gets hurt. Write <code>golden.jsonl</code>:
<pre><code>{"id":1,"text":"The blender arrived cracked, I want my money back","label":"refund","why":"damaged on arrival + explicit money-back request"}
{"id":2,"text":"Wrong color sent, please send the right one","label":"replacement","why":"fulfillment error, customer wants the item not money"}
{"id":3,"text":"How do I descale this kettle?","label":"none","why":"support question, no refund/replacement"}
{"id":4,"text":"It stopped working after 3 days, send a new one","label":"replacement","why":"defect in window, wants item"}
{"id":5,"text":"Changed my mind, returning it for a refund","label":"refund","why":"buyer-remorse return, money-back"}
{"id":6,"text":"Package never showed up, want a refund","label":"refund","why":"non-delivery + money-back request"}
{"id":7,"text":"Missing a part, can you ship the part?","label":"replacement","why":"partial fulfillment, item-level fix"}
{"id":8,"text":"Defect photographed but I lost the receipt","label":"replacement","why":"EDGE: policy = replacement when defect proven, receipt not required"}
{"id":9,"text":"Bought it 14 months ago, now broken, refund?","label":"none","why":"EDGE: out of warranty window, neither owed"}
{"id":10,"text":"Love it! Just leaving feedback","label":"none","why":"positive feedback, no action"}
{"id":11,"text":"Item fine but late; compensate me","label":"none","why":"EDGE: goodwill/credit path, not refund or replacement of item"}
{"id":12,"text":"Two arrived, charged twice, refund the extra","label":"refund","why":"double-charge, money-back on duplicate"}
{"id":13,"text":"Screen flickers intermittently, unsure if defect","label":"replacement","why":"EDGE: probable defect in window, replace and inspect"}
{"id":14,"text":"Want to return unopened, well within 30 days","label":"refund","why":"clean in-window return, money-back"}
{"id":15,"text":"Can I get a refund AND keep the item?","label":"none","why":"EDGE: not a valid outcome; route to human, neither auto-action"}</code></pre>
<p>Note that cases 8, 9, 11, 13, 15 are the ones Dana had to think about — they define the decision surface, and they are where a naive system quietly fails.</p></li>

<li><strong>Write the system-under-test (mocked, perturbable).</strong> A rule-based classifier stands in for the LLM pipeline so the lab is free and deterministic. An environment flag injects a realistic regression (an over-broad refund rule that swallows replacement cases) so you can watch the gate catch it. Write <code>system.py</code>:
<pre><code>import os

def classify(text):
    t = text.lower()
    # A regression: an over-broad refund rule (set BREAK=1 to simulate a bad change)
    if os.environ.get("BREAK") == "1" and "refund" in t:
        return "refund"
    if "keep the item" in t or "feedback" in t or "descale" in t:
        return "none"
    if "months ago" in t or "compensate" in t:
        return "none"
    if "money back" in t or "my money" in t or "return" in t or "refund" in t \\
       or "charged twice" in t or "never showed" in t:
        return "refund"
    if "new one" in t or "right one" in t or "ship the part" in t \\
       or "lost the receipt" in t or "flickers" in t or "stopped working" in t:
        return "replacement"
    return "none"

# Optional real-model swap (costs ~a cent): implement classify() to call a
# hosted mini-tier model with the rubric in the system prompt, returning one
# of refund | replacement | none. Keep the same signature and the harness is unchanged.</code></pre></li>

<li><strong>Write the runner: score, threshold, and fail the build on a regression.</strong> It reports overall accuracy plus <em>per-class recall</em> (because the business cares more about some errors than others), checks against the acceptance bar Dana agreed <em>before</em> you built, and exits non-zero on a regression so CI would block the deploy. Write <code>evals.py</code>:
<pre><code>import json, sys, collections
from system import classify

# Acceptance bar agreed with Dana BEFORE building (the contract):
THRESHOLDS = {"overall": 0.85, "refund": 0.80, "replacement": 0.80, "none": 0.80}

def load(path):
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]

def evaluate(cases):
    correct = 0
    per_class = collections.defaultdict(lambda: [0, 0])  # class -&gt; [right, total]
    failures = []
    for c in cases:
        pred = classify(c["text"])
        gold = c["label"]
        per_class[gold][1] += 1
        if pred == gold:
            correct += 1
            per_class[gold][0] += 1
        else:
            failures.append((c["id"], c["text"], gold, pred, c["why"]))
    overall = correct / len(cases)
    recalls = {k: (v[0] / v[1] if v[1] else 1.0) for k, v in per_class.items()}
    return overall, recalls, failures

def main():
    cases = load("golden.jsonl")
    overall, recalls, failures = evaluate(cases)
    print("overall accuracy: " + format(overall, ".2f") +
          "  (bar " + str(THRESHOLDS["overall"]) + ")")
    for cls in ("refund", "replacement", "none"):
        r = recalls.get(cls, 1.0)
        print("recall[" + cls + "]: " + format(r, ".2f") +
              "  (bar " + str(THRESHOLDS[cls]) + ")")
    if failures:
        print("\\n-- failing cases (each becomes a regression case) --")
        for fid, text, gold, pred, why in failures:
            print("  #" + str(fid) + " gold=" + gold + " pred=" + pred +
                  " :: " + text + "  [rubric: " + why + "]")
    # Gate: any metric under its bar fails the build.
    breached = overall &lt; THRESHOLDS["overall"] or any(
        recalls.get(cls, 1.0) &lt; THRESHOLDS[cls] for cls in ("refund", "replacement", "none"))
    if breached:
        print("\\nEVAL GATE: FAIL — regression below the agreed bar. Blocking deploy.")
        sys.exit(1)
    print("\\nEVAL GATE: PASS")
    sys.exit(0)

if __name__ == "__main__":
    main()</code></pre></li>

<li><strong>Run the baseline (build passes).</strong>
<pre><code>cd ~/eval-lab &amp;&amp; python evals.py ; echo "exit=$?"</code></pre>
The mocked system should clear every bar; exit code 0. This is the green gate CI would allow to ship.</li>

<li><strong>Trigger the regression (build fails).</strong> Simulate a bad change — the over-broad refund rule — and confirm the gate blocks it:
<pre><code>BREAK=1 python evals.py ; echo "exit=$?"</code></pre>
Replacement recall drops as refund-labeled text swallows replacement cases, the gate prints FAIL, and the exit code is 1 — exactly what stops the deploy in CI. The failing cases are printed with their rubric, ready to be promoted into a permanent regression set.</li>
</ol>

<h3>Verify</h3>
<ul>
<li>Baseline run exits 0 and prints PASS; the BREAK=1 run exits 1 and prints FAIL — you have a working build-failing regression gate, not just a report.</li>
<li>The failure output names the case, the expected vs predicted label, <em>and the expert's rubric reason</em> — so a customer engineer, not just you, could act on it.</li>
<li>Lower a threshold in <code>THRESHOLDS</code> and re-run BREAK=1 to see the gate pass — proving the acceptance bar is a deliberate, negotiated contract, not a magic constant. (Then put it back.)</li>
<li>Add one of the edge cases twice with conflicting labels to feel inter-annotator disagreement: the set becomes unwinnable until you adjudicate which label is correct — the adjudication is the spec.</li>
</ul>

<h3>Teardown</h3>
<p>Everything is local and near-zero cost, but leave it clean:</p>
<pre><code>deactivate 2&gt;/dev/null
rm -rf ~/eval-lab            # delete the scratch dir: venv, golden set, code
unset BREAK                  # remove the regression-simulation flag from the shell
unset API_KEY               # remove any hosted-model key if you used the real-model swap</code></pre>
<p>If you created a temporary API key for the optional real-model swap, also revoke/delete it in the provider console — a scratch key that outlives the scratch folder is exactly the kind of loose credential an FDE is trusted not to leave behind on a customer's infrastructure.</p>
`
  }
});
