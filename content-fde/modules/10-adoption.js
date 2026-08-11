/* Module 10 — Adoption, Handoff & Expansion (The Field track) */
window.COURSE.register({
  id: "adoption",
  order: 10,
  track: "field",
  title: "Adoption, Handoff & Expansion",
  description: "The real finish line is not a system that works — it is a system people actually use, that keeps running after you leave, and that becomes the beachhead you expand from. This module covers driving adoption without authority, enabling the customer's team, handing off cleanly, and proving P&amp;L impact that renews and grows the account.",
  examWeight: "Behavioral rounds probe two things this module is built for: driving adoption through an organization where you have no authority, and knowing when a project is actually done. On the job, adoption and expansion are the whole difference between a renewed, growing account and a churned pilot — the FDE who ships working software but never gets it used has failed exactly as completely as the one whose code never ran.",
  lessons: [
    {
      id: "pilot-nobody-uses",
      title: "The pilot nobody uses",
      html: `
<p>There are two finish lines in a deployment, and juniors sprint to the wrong one. The first is <strong>it works</strong>: the software runs, the evals are green, the demo lands, the statement of work is technically satisfied. The second is <strong>it is used</strong>: an operator who used to make a decision by hand now makes it with your system, every day, and would complain loudly if you took it away. The gap between those two lines is called <strong>adoption</strong>, and it is where most enterprise AI pilots actually die — not in the model, not in the integration, but in the last mile of getting humans to change how they work.</p>

<p>Re-read the 95% statistic through this lens. The 2025 MIT finding that roughly 95% of enterprise GenAI pilots showed no measurable P&amp;L impact is usually told as an integration story, and it is one — but a large share of those failed pilots contained software that <em>ran correctly</em>. It produced good outputs that nobody acted on. It was shelfware with a great demo. A technically perfect system with zero usage is not a partial success; it is a complete failure that happens to compile. The customer paid for an outcome, the outcome requires a human to change behavior, and the behavior did not change.</p>

<h3>Why the last mile is the hardest mile</h3>
<p>Everything before adoption is a systems problem, and senior engineers are good at systems problems. Adoption is a <strong>behavior-change problem</strong>, and it obeys different physics. You are asking a claims adjuster who has triaged files the same way for fifteen years, whose expertise <em>is</em> that workflow, to trust a machine's ranking over her own judgment — and to do it while carrying her normal caseload, with no slack, under the reasonable suspicion that the tool is there to eventually replace her. No amount of model quality dissolves that. The tool can be right 98% of the time and still go unused, because the barrier is not accuracy, it is <strong>trust, habit, incentive, and friction</strong>.</p>

<div class="callout deep">Adoption follows the classic diffusion-of-innovations curve, and it matters which end you start at. A tiny group of <strong>innovators and early adopters</strong> will try anything new; the large <strong>early and late majority</strong> adopt only after they see peers succeed and feel social proof; <strong>laggards</strong> never move without a mandate. The senior mistake is to measure success by the enthusiasts in week two — they were always going to use it — and mistake their usage for adoption. Real adoption is when a skeptical member of the majority, who had no reason to love you, reaches for the tool by default. Design the rollout to manufacture peer proof for the majority, not to delight the innovators who need no convincing.</div>

<h3>Trust is the currency, and it is earned or spent one output at a time</h3>
<p>An operator will not act on output she does not trust, and trust in an AI system is asymmetric: it is built slowly by many correct outputs and destroyed instantly by one confident, visible, consequential error. This is why the evals from your validation phase are not just an engineering artifact — they are the substrate of adoption. When the tool is wrong, the operator needs to have been told, in advance and honestly, <em>where</em> it tends to be wrong and how to catch it, or the first bad output convinces her the whole thing is untrustworthy and she quietly routes around it forever. A calibrated user who knows the tool's failure modes keeps using it through an error; a user sold "it's basically always right" abandons it the first time it isn't.</p>

<div class="callout war">A logistics customer deployed a shipment-exception triage assistant that was, by every offline metric, excellent — top-ranked exceptions were genuinely the urgent ones about 92% of the time. Six weeks post-launch, usage was near zero. The dashboards were beautiful; nobody opened them. The autopsy found nothing wrong with the model. The problem: the tool lived in a new browser tab, while the dispatchers ran their entire day inside a legacy terminal they never left. Using the tool meant alt-tabbing out of their workflow, and under load nobody did. The fix was not a better model — it was pushing the ranked exceptions <em>into</em> the terminal the dispatchers already lived in. Usage went from near-zero to daily. The lesson: adoption is lost in the seams of a workflow, not in the accuracy of a model, and you cannot see those seams from your laptop.</div>

<h3>Adoption is a design input, not a launch phase</h3>
<p>The junior treats adoption as something that happens <em>after</em> the build: ship it, then "drive adoption." The senior treats adoption as a constraint that shapes what you build from day one. That changes concrete decisions: you pick a first workflow where the pain is acute and the user is motivated (a volunteer, not a conscript); you put the tool on the path the operator already walks instead of asking them to detour; you make the first slice narrow enough to be trusted rather than broad enough to be impressive; and you instrument usage from launch so you can see adoption stall while there is still time to fix it. "Will anyone use this?" is a question you answer during scoping, not a surprise you discover at renewal.</p>

<div class="callout limits">The numbers that should scare you: roughly 95% of enterprise GenAI pilots show no measurable P&amp;L impact; on the order of 30% of pilots are abandoned after the POC and a majority never reach production at all. A large fraction of that mortality is adoption, not capability. Internalize the ratio: the model is almost never the reason you fail, and "we built something that works" moves you past maybe a third of the risk. The other two-thirds is integration and adoption — the parts that do not show up in a benchmark and do show up in whether the contract renews.</div>

<div class="callout exam">Behavioral rounds probe this with "tell me about a time you built something good that didn't get used — what happened?" There is no right project, only a right diagnosis: weak candidates blame the users ("they were resistant to change") or the org ("leadership didn't mandate it"); strong candidates own it as a design failure they could have prevented — wrong first workflow, tool off the critical path, trust never established, no baseline to prove value, adoption treated as a post-launch phase. The signal they want is that you consider a system unused-by-humans to be as broken as a system that throws exceptions, and that you design against that from the start rather than discovering it at the renewal meeting.</div>
`
    },
    {
      id: "change-management",
      title: "Change management and org politics",
      html: `
<p>You are not deploying software. You are asking an organization to change how it works, and you are doing it as an outsider with a laptop and no authority over anyone in the building. That is a <strong>political act before it is a technical one</strong>, and the FDEs who are great at it treat the org chart, the incentives, and the personalities as first-class parts of the system they are deploying into — as real as the data schema and considerably harder to refactor.</p>

<h3>Find the champion; identify the skeptic</h3>
<p>Every successful deployment has a <strong>champion</strong>: a person inside the customer whose day gets materially better because of your tool and who has enough credibility with peers that their endorsement is social proof. Your job is to find that person early, make them a visible hero of the rollout, and arm them — because a peer saying "this saved me two hours yesterday" moves the majority in a way that you, the vendor, never can. Champions are not the executive sponsor (who signed the contract but does not do the work); they are usually a respected line operator or a first-line manager who feels the pain daily.</p>

<p>Every deployment also has a <strong>skeptic</strong>, and the dangerous skeptic is specific: the domain expert whose expertise the tool appears to threaten. The fifteen-year adjuster, the senior analyst, the lead dispatcher — the person whose value to the organization <em>is</em> the judgment you are automating. Their resistance is not irrational; from where they sit, your success is their obsolescence, and they often have the informal authority to kill adoption by simply telling their team the tool is unreliable. You cannot steamroll them; you can convert them. The reframe that works: the tool handles the boring, high-volume 80% so that <em>their</em> scarce expert judgment goes to the hard 20% that actually needs it — you are not replacing the expert, you are deleting the drudgery that buries the expert. When it lands, the threatened expert becomes your most powerful champion, because their endorsement carries the credibility of exactly the person everyone expected to object.</p>

<div class="callout war">A claims team's most senior adjuster torpedoed a triage pilot for a month — not by arguing against it in meetings, but by telling his team, quietly, that it "missed the subtle ones." Adoption stalled at the innovators. The FDE stopped fighting it in the abstract and spent two days sitting beside him, working real files together. It turned out the tool genuinely mishandled a category he cared about (complex multi-party liability), and he was right. They fixed it <em>with</em> him, credited him for the catch, and put a note in the release. He flipped from the deployment's most effective opponent to its most effective advocate, because now it was partly his. The move was not persuasion; it was co-ownership. The most dangerous skeptic is usually right about something, and the fastest path through them is to find what and fix it in public.</div>

<h3>Redesign the workflow around the tool — do not bolt the tool onto the workflow</h3>
<p>The single most common adoption-killer among technically strong teams is the <strong>bolt-on</strong>: they build a great tool and then hand it to users who are expected to fit it into their existing process by hand — copy the case number out of System A, paste it into your tool, read the output, retype the decision back into System B. Every one of those manual seams is friction, and friction under load is where adoption dies. The output can be perfect and still lose to the path of least resistance, which is to keep doing it the old way.</p>

<p>The senior move is to <strong>re-engineer the process so the tool is on the critical path and the old steps are removed</strong>, not added to. That means the tool reads from System A directly and writes to System B directly; it means the operator's day is redesigned so the tool is the default route and the manual fallback is the exception; it sometimes means deleting a step, a form, or a handoff that existed only because the work used to be manual. This is why the FDE has to own the whole data-to-decision loop and has to have real influence with the process owner — you cannot redesign a workflow you are only allowed to append to. A tool inserted into an unchanged workflow adds work; a workflow rebuilt around the tool removes it, and only the second one gets adopted.</p>

<h3>Physical presence is an adoption technology</h3>
<p>There is a reason the role is onsite-heavy and it is not nostalgia. Sitting next to operators while they work — the "deploy days" pattern — does three things no remote rollout does. It <strong>surfaces the real friction</strong> (you watch someone alt-tab away from your tool and finally understand why usage is low). It <strong>closes the trust loop in real time</strong> (a confused user gets unstuck in ten seconds instead of silently giving up). And it <strong>signals commitment</strong>: an engineer who flew in and is sitting at the operator's desk is telling the whole floor that this matters and is not going away. Presence is how you find the seams the dashboards hide, and it is disproportionately effective in the first weeks when habits are still forming.</p>

<div class="callout deep">Beware the mandate. A frustrated executive sponsor will offer to "just make everyone use it," and it is tempting to accept — usage graphs spike overnight. But a top-down mandate without earned trust produces <strong>malicious compliance</strong>: people open the tool to satisfy the audit, click through it, and make the real decision the old way. Now your usage metric is a lie, your true adoption is still zero, and you have burned goodwill you will need later. A mandate can be a useful floor for laggards <em>after</em> the majority already adopted willingly — it is a terrible substitute for that adoption. Pull adoption through value and proof; use authority only to remove obstacles (access, integration approvals, time to train), not to force clicks.</div>

<h3>Measure adoption honestly</h3>
<p>The whole discipline collapses if you let yourself be fooled by vanity metrics. Logins are not adoption. Accounts provisioned is not adoption. "The tool processed 10,000 requests" is not adoption if 9,000 were you testing. Measure the thing that actually indicates the behavior changed: <strong>the fraction of the target workflow that now flows through the tool</strong> versus around it, tracked as weekly active <em>doers</em> (not viewers) against the total population who should be using it, and watched for the tell-tale <strong>post-launch cliff</strong> where usage spikes on curiosity and then craters as novelty fades. An honest adoption metric is uncomfortable because it is usually lower than you want — which is exactly why it is the one worth reporting, to yourself first and the customer second.</p>

<div class="callout exam">The classic behavioral prompt: "You built something the team should use, but they're resisting. Walk me through what you do." Losing answers reach for authority ("get the sponsor to mandate it") or blame ("some people just resist change"). Winning answers reach for the org as a system: identify the champion and arm them, find the threatened expert and convert them through co-ownership, get onsite and watch for the real friction, redesign the workflow so the tool is on the critical path instead of bolted on, and measure real workflow-share rather than logins. The meta-signal is that you drive change <em>through influence and design</em>, not through borrowed authority you do not have — which is the entire condition of the FDE job.</div>
`
    },
    {
      id: "training-enablement",
      title: "Training and enabling the customer's team",
      html: `
<p>Here is the sentence that should govern every choice in this lesson: <strong>your goal is the customer's independence, not your own indispensability.</strong> It sounds obvious and it cuts against a real instinct, because being the only person who understands the system feels like job security. It is the opposite. An FDE whose deployments only run while they are physically present cannot leave, cannot take a vacation, cannot start the next account, and cannot scale — they have built themselves a prison and called it a moat. The mature FDE deliberately trains themselves out of the loop, because the ability to walk away from a running system is what lets you go do it again somewhere else.</p>

<h3>Three capabilities you must transfer: run, trust, extend</h3>
<p>Enabling the customer's team is not one skill; it is three distinct capabilities, and teams that transfer only the first fail slowly.</p>
<ul>
<li><strong>Run it.</strong> The operational team can start, stop, monitor, and troubleshoot the system: read the dashboards, interpret an alert, follow the runbook when a data feed goes stale, restart a stuck job, know who to call. This is table stakes and the one most teams remember.</li>
<li><strong>Trust it.</strong> The <em>users</em> understand the system's competence surface — what it is reliably good at, where it is weak, how to spot a bad output, when to override it. This is trust <em>calibration</em>, and it is the difference between a team that keeps using the tool through an occasional error and a team that abandons it at the first mistake. Teach the failure modes as explicitly as the features.</li>
<li><strong>Extend it.</strong> A designated technical owner on the customer side can make the system evolve without you: add an entity or relationship to the ontology when the business changes, tweak a prompt, add a tool, update the eval set when a new failure class appears. Without this, the system is frozen the day you leave and rots as the business moves on around it. Transferring extensibility is what turns a deployment into a living system the customer owns.</li>
</ul>

<div class="callout deep">Trust calibration has two opposite failure modes and you must teach against both. <strong>Automation bias</strong> is over-trust: the operator rubber-stamps whatever the tool says, so the human-in-the-loop review that justified the deployment to the risk team becomes theater, and the tool's errors flow straight through unchecked. <strong>Algorithm aversion</strong> is under-trust: after seeing the tool err once, the operator discounts it entirely and goes back to doing everything manually, so you get the cost of the system with none of the benefit. Good enablement puts the user in the narrow band between — trusting the tool where it is strong, checking it where it is weak, and knowing which is which. That band is a training deliverable, not something users find on their own; left alone, individuals drift to one pole or the other.</div>

<h3>Documentation and runbooks that survive you</h3>
<p>Documentation written for yourself is worthless for a handoff, because you are documenting around everything you already carry in your head. The test of a runbook is brutal and simple: <strong>could a competent operator who has never met you resolve a 2 a.m. incident using only this document?</strong> That standard forces out the tribal knowledge — the undocumented restart trick, the "oh you also have to clear the cache," the credential only you know. Runbooks should be <strong>task-oriented and failure-oriented</strong>: not "here is the architecture" but "when the ingestion job fails, here is how you tell why, here is how you fix each cause, here is when to escalate and to whom." Keep them next to the system, versioned with it, and — the part everyone skips — <strong>validate them by having a customer engineer execute the runbook while you watch and stay silent</strong>. Every time you have to jump in, you have found an undocumented step. Fix it and repeat until they can do it without you.</p>

<div class="callout war">An FDE at a healthcare customer wrote thorough documentation and felt good about the handoff. Three weeks after they rotated off, a nightly eval job started failing and the customer's team was dead in the water — the runbook described the system's design beautifully but never said what to actually <em>do</em> when that job failed, because when it had failed during the build the FDE had just fixed it reflexively without writing down how. The customer escalated, the FDE got pulled back mid-onboarding at their next account, and the "handoff" quietly became a permanent support tail. The documentation was long and it was useless, because it was written from the author's knowledge instead of tested against a stranger's ignorance. Docs you did not watch someone else successfully use are docs you have not written yet.</p></div>

<h3>The anti-pattern: hoarding knowledge for job security</h3>
<p>Some engineers, consciously or not, keep the system slightly mysterious — skip the documentation, keep a key detail in their head, stay the single point of contact — because being irreplaceable feels safe. In the FDE role this instinct is not just unethical, it is <strong>career-limiting and self-defeating</strong>. It caps you at exactly one deployment forever; it makes you the bottleneck that makes the account fragile; and it is precisely the "bespoke agency of one" failure mode that the best FDE orgs screen for and punish, because it does not scale and it does not survive your vacation. The engineers who compound their value do the opposite: they make themselves replaceable on this account as fast as possible so they can go be scarce on the next one. Your leverage comes from the number of independent, running systems you have created, not from how many of them still need you.</p>

<div class="callout exam">Interviewers surface this through questions about handoff and mentoring: "How do you make sure a deployment keeps working after you leave?" The tell they listen for is whether independence is your explicit goal or an afterthought. Strong answers name the three capabilities (run, trust, extend), describe runbooks validated by having the customer execute them, and — crucially — frame indispensability as a failure rather than a win. If you say something like "I make myself unnecessary as fast as I can, because that's what lets me take the next account," you have signaled that you understand the economics of the role: the org is paying for systems that outlast your presence, not for a permanent dependency wearing an engineer's badge.</div>
`
    },
    {
      id: "the-handoff",
      title: "The handoff: software that survives you",
      html: `
<p>The handoff is not the moment you stop showing up; it is a designed process with artifacts, criteria, and a transition period, and it is the single clearest test of whether you built a <strong>system</strong> or a <strong>dependency</strong>. Recall the failure mode from the very first module: the FDE who becomes a "bespoke agency of one," whose deployments stall the instant they take vacation, who never converts one-off work into something that survives them. The handoff is where you find out which one you are — and if you engineer it from the beginning, you get to choose.</p>

<h3>The handoff artifacts: what you actually leave behind</h3>
<p>A clean handoff is a defined bundle, not a vibe. The customer's team should receive, and demonstrably be able to use, all of the following:</p>
<table>
<thead><tr><th>Artifact</th><th>What it is</th><th>Why it must survive you</th></tr></thead>
<tbody>
<tr><td><strong>Runbooks</strong></td><td>Task- and failure-oriented operational docs, validated by the customer executing them</td><td>The team runs and troubleshoots the system without you at 2 a.m.</td></tr>
<tr><td><strong>The eval suite</strong></td><td>The golden sets, acceptance criteria, and regression gates from validation — owned and runnable by the customer</td><td>It is the currency of trust; without it the customer cannot tell if a change or model update broke quality, so they freeze the system</td></tr>
<tr><td><strong>The ontology</strong></td><td>The customer-specific domain model — entities, properties, relationships, actions — that grounds the whole application</td><td>When the business changes, someone must be able to evolve the domain model or the system slowly diverges from reality</td></tr>
<tr><td><strong>Dashboards / observability</strong></td><td>Usage, adoption, quality, cost, and health metrics the team watches</td><td>You cannot manage what you cannot see; the team needs to notice adoption slipping or quality drifting on their own</td></tr>
<tr><td><strong>The on-call / escalation plan</strong></td><td>Who gets paged, what they do first, when and how they escalate, what the support SLA is</td><td>Incidents happen after you leave; an undefined escalation path routes every incident back to you forever</td></tr>
</tbody>
</table>

<p>Notice that the eval suite and the ontology are on this list. Juniors think of the handoff as documentation plus credentials; seniors know the load-bearing artifacts are the ones that let the customer <strong>keep the system trustworthy and current</strong> as the world changes. A customer who owns the evals can accept a model upgrade with confidence instead of fear; a customer who owns the ontology can extend the system as their business evolves; a customer who has neither is stuck with a frozen artifact that decays the moment reality moves.</p>

<div class="callout deep">The eval suite deserves special emphasis because it is what converts "trust me" into "run the tests." Throughout the engagement, evals were how you and the customer agreed the system was good enough — acceptance criteria as contract, golden sets as ground truth, regression gates so a change cannot silently degrade quality. At handoff, that same machinery becomes the customer's <strong>independence mechanism</strong>: it is how they will safely change a prompt, adopt a new model version, or extend a tool without you in the loop. Handing over a system without its evals is like handing over a codebase with the test suite deleted — technically it runs, but nobody can touch it without fear, so nobody does, and it rots. The evals are not a deliverable you produce for the handoff; they are the deliverable that makes the handoff real.</div>

<h3>Deciding when to leave: self-sufficiency criteria</h3>
<p>"When is it done?" is a genuinely hard judgment, and both errors are expensive. Leave too early and the system collapses, the account churns, and you get pulled back mid-onboarding at your next customer — a worse outcome than staying. Leave too late and you are the bespoke agency of one, burning a scarce senior engineer on a system that no longer needs them while the next account waits. The discipline is to define <strong>self-sufficiency criteria in advance</strong> and leave when they are met, not when the calendar says or when the relationship feels comfortable. Concrete criteria worth adopting:</p>
<ul>
<li>The customer's team has <strong>resolved a real incident without you</strong> — not a drill, an actual production issue, using the runbook.</li>
<li>The customer's technical owner has <strong>shipped a change without you</strong> — a prompt tweak, a new eval case, an ontology addition — and the regression gates caught nothing broken.</li>
<li>The <strong>adoption metric is stable above threshold</strong> and no longer depends on your presence to hold it up (it did not crater the last time you were offsite for a week).</li>
<li>The <strong>evals are green, owned, and run on a schedule the customer controls</strong>, and someone on their side can read a regression and know what to do.</li>
<li>The <strong>on-call rotation is theirs</strong>, the escalation path is documented, and the support SLA after your departure is agreed in writing.</li>
</ul>
<p>The clean version is a <strong>graduated handoff</strong>, not a cliff: you move from driver (you do it, they watch) to navigator (they do it, you watch and coach) to backstop (they do it, you are reachable for real escalations only) to gone (a defined, bounded support agreement). Each stage is a chance to discover the thing they cannot yet do without you and fix it before it becomes an incident.</p>

<div class="callout war">Two failure modes, same root. One FDE, eager to hit an internal "time-to-handoff" target, rotated off a fraud-detection deployment the week it hit its accuracy goal — before the customer's team had ever operated it under real load. The first weekend spike overwhelmed them, they had no validated runbook for the queue backing up, quality complaints reached the sponsor, and the FDE got yanked back off their new account to firefight for a month. The opposite FDE, at a different customer, stayed eighteen months on a system the team could have run at month six, "just to be safe" — until a manager gently asked why they were still paying a senior engineer to watch a system that had not had an incident in a quarter. One left before the self-sufficiency criteria were met; the other never defined them and so never noticed they had been met long ago. Define the criteria up front and the leave decision stops being a feeling and becomes an observation.</div>

<div class="callout exam">This is the "how do you know when a project is done?" question, and it is a genuine discriminator. The junior answer is time- or feature-based ("when the SOW is delivered," "when the roadmap is shipped"). The senior answer is <strong>self-sufficiency-based</strong>: the project is done when the customer can run, trust, extend, and recover the system without me — and I know that because they have demonstrably done each of those without me, against criteria we agreed on in advance. Bonus signal: naming the symmetric danger — that staying too long makes you the bespoke agency of one from module one, and that a scarce senior engineer sitting on a self-sufficient system is a real cost, not a safe default. Interviewers are checking whether you can let go on evidence, which is a maturity most engineers lack.</div>
`
    },
    {
      id: "impact-and-expand",
      title: "Measuring impact and land-and-expand",
      html: `
<p>Adoption gets people using the system. <strong>Impact</strong> proves it was worth building, and impact is measured in the customer's P&amp;L, not in your usage dashboard. This is the distinction that separates a renewed, expanding account from a pilot that was popular and still got cut: at renewal, "people really liked it and used it a lot" loses to a spreadsheet, and the FDE who cannot produce the spreadsheet loses the account no matter how good the software was.</p>

<h3>P&amp;L impact versus usage vanity metrics</h3>
<p>Usage is necessary but not sufficient. High adoption with no measurable business outcome is a very expensive hobby, and CFOs cut hobbies in the first budget review. The move is to tie the system to a <strong>number the business already cares about</strong> and would have cared about with or without you:</p>
<ul>
<li><strong>Labor: hours saved times fully-loaded cost.</strong> The invoice-coding team spent 4 minutes per invoice and now spends 90 seconds; at their volume and loaded hourly cost, that is a specific dollar figure of capacity freed — reallocated to higher-value work or to absorbing growth without new headcount.</li>
<li><strong>Cycle time.</strong> Claims that took 6 days to first decision now take 2; the P&amp;L link is faster settlement, lower leakage, better customer retention — quantified, not asserted.</li>
<li><strong>Quality / error / rework rate.</strong> Coding-error rate dropped from 8% to 2%, so downstream rework and correction costs (and their loaded labor) fell by a measurable amount.</li>
<li><strong>Revenue or cost avoided.</strong> Faster response won deals that were timing out; better exception triage avoided a category of penalty or write-off with a known historical cost.</li>
</ul>
<p>Every one of these is a P&amp;L statement. "10,000 queries per week," "95% user satisfaction," and "high daily active usage" are not — they are inputs to impact, not impact, and presenting them <em>as</em> impact is the tell of an FDE who never connected the system to the business. Usage metrics answer "is it adopted?"; only outcome metrics answer "did it matter?", and the renewal turns on the second question.</p>

<div class="callout deep">You cannot prove impact you did not baseline. The before/after comparison is only credible if you captured the <strong>before</strong> — and you have to capture it during scoping, because once the tool is live the old baseline is gone forever and you are reduced to arguing from anecdote. This is why "what is the current cost/time/error rate of this workflow, measured, today?" is a scoping-phase question, not a victory-lap-phase question. The senior FDE instruments the baseline before writing a line of the solution, precisely so that at renewal the impact is a measured delta the customer's own analysts can reproduce, not a vendor claim. A great result with no baseline is unprovable, and unprovable results do not renew contracts. Baseline first; it is the cheapest, highest-leverage thing you will do all engagement.</div>

<h3>Land-and-expand: the beachhead is the point</h3>
<p>Here is where the economics of the whole role live. The first deployment is a <strong>beachhead</strong> — one workflow, deliberately narrow, chosen because it was winnable and its value was provable. A working, measured beachhead does something no sales deck can: it earns you the credibility and the internal proof to land the <em>next</em> five workflows. That is the <strong>land-and-expand</strong> motion, and expansion is where enterprise value actually compounds, because the second workflow costs a fraction of the first to land (you already have the data access, the security approval, the ontology, the relationships, the trust) while carrying comparable value. Net revenue retention above 100% — existing customers spending more each year — is the metric that makes enterprise software lucrative, and it is manufactured in the field by FDEs turning one proven beachhead into an expanding footprint.</p>

<div class="callout limits">The margin story is why the labs pay staff-level comp for this. Services-led software businesses (ServiceNow, Workday) IPO'd around 54–63% gross margin — heavy on the human implementation cost of landing each customer — and expanded to roughly 75–79% as they entrenched and expansion revenue arrived at a fraction of the landing cost. That expansion delta is "margin for moat": the deep, customer-owned integration that is expensive to build the first time is exactly what competitors cannot cheaply dislodge, and every expansion workflow rides on infrastructure already paid for. A single productive FDE is associated with roughly $3–15M in annual revenue contribution largely <em>because</em> of expansion — the land is the cost, the expand is the profit, and an FDE who only ever lands is running the business at its worst margin.</div>

<h3>Feeding field learning back into the product: closing the flywheel</h3>
<p>The dual mandate from module one comes due here. You served this one customer; now you owe the product the generalizable signal. Every painful adapter you wrote, every ontology pattern that recurred, every failure mode you hit is either a one-off you should leave behind or a <strong>product gap you should push upstream</strong> — and telling them apart is the judgment that separates a bespoke agency of one from an engine of leverage. When you route real field pain into the roadmap, the next deployment gets faster, because the thing you hand-built here ships as a product capability there. That is the <strong>flywheel</strong>: deploy, learn what actually breaks against reality, improve the product, deploy faster and cheaper next time, expand the margin. Each turn lowers the cost to land and raises the margin to expand — which is the entire "services as software" thesis made concrete. An FDE who absorbs every lesson personally and pushes nothing back is spending the company's most valuable product-feedback channel on their own indispensability, which is the same failure as hoarding knowledge, one level up.</p>

<div class="callout war">A claims customer's beachhead — a single triage workflow — hit its numbers: 40% faster first decisions, a hard dollar figure of adjuster capacity freed, all baselined and provable. The FDE did three things with that win and each mattered. They packaged the P&amp;L result into a one-page the sponsor could forward to <em>their</em> boss, which turned the sponsor into an internal salesperson and opened the budget for the next workflow. They used the proven data access and ontology to land subrogation and fraud-flagging at a fraction of the original cost, tripling the account's value in a year. And they wrote up the recurring ontology-and-adapter pattern for the product team, who turned it into a reusable connector that cut weeks off the <em>next</em> customer's timeline. One beachhead, measured and then leveraged three ways — expansion, referral, and product — is what a renewed, growing account looks like, and it started with having baselined the before.</div>

<div class="callout exam">Two threads converge in interviews. First, "how did you measure the impact of your work?" — and the disqualifying answer is a usage metric offered as if it were a business outcome. Strong answers name a P&amp;L metric, a captured baseline, and a measured delta the customer could reproduce, and they mention that they instrumented the baseline before building precisely so the result would be provable. Second, the commercial-awareness signal: that you understand the beachhead exists to be expanded from, that expansion is where the margin and the enterprise value are, and that feeding field learning back into the product is what closes the flywheel and makes the next deployment cheaper. An FDE who thinks in P&amp;L and expansion, not features and usage, is telling the interviewer they understand the economics of their own role — the strongest senior signal there is.</div>
`
    }
  ],
  quiz: [
    {
      q: "Six weeks after launch, a shipment-exception triage tool has excellent offline metrics (top-ranked exceptions are the urgent ones about 92% of the time) but almost zero real usage. Dispatchers run their whole day inside a legacy terminal. What is the most likely root cause and fix?",
      options: [
        "The model accuracy is too low to trust; retrain it to raise precision before expecting usage",
        "The tool lives outside the workflow dispatchers actually use; push the ranked exceptions into the terminal they already live in so using it stops requiring a detour",
        "The dispatchers are resistant to change; ask the sponsor to mandate daily use of the new tool",
        "The dashboards are not compelling enough; redesign the UI to be more visually engaging"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: adoption dies in the seams of a workflow, not in model accuracy.</strong> A tool in a separate tab that forces operators to leave the system they live in will lose to the path of least resistance under load, no matter how good the ranking is. Putting the output on the path the operator already walks removes the friction, and usage follows.</p><p>92% precision is not the problem — the tool is accurate and still unused, which is the whole point. A mandate produces malicious compliance (people open it and decide the old way) and hides the real friction instead of removing it. Prettier dashboards do not help a user who never opens the tab; the fix is workflow placement, not visual polish.</p>"
    },
    {
      q: "A deployment's most credible domain expert — a fifteen-year adjuster — is quietly telling his team the new triage tool 'misses the subtle ones,' and adoption has stalled. What is the strongest FDE response?",
      options: [
        "Escalate to the executive sponsor to have the expert overruled and the tool mandated",
        "Sit with the expert on real files, find the category he is genuinely right about, fix it with him, and credit the catch publicly so he co-owns the result",
        "Route around him by training the junior staff first and hoping momentum builds",
        "Present the offline accuracy metrics to the team to prove the expert is wrong"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the threatened expert is usually right about something, and co-ownership converts them.</strong> The dangerous skeptic is the person whose expertise the tool seems to threaten; their informal authority can kill adoption. Working real cases with them surfaces the genuine gap, fixing it together earns credibility, and public credit flips them from the deployment's most effective opponent to its most effective advocate.</p><p>Overruling him via the sponsor makes an enemy with informal power and produces compliance theater, not adoption. Routing around him leaves the credibility problem intact and he keeps poisoning the well. Waving metrics to prove him wrong is a status fight you lose even if the numbers are right — and here he is partly right, so the metrics-versus-expert framing is exactly backwards.</p>"
    },
    {
      q: "An FDE inserts a strong new tool into an existing process: operators copy a case number from System A, paste it into the tool, read the output, and retype the decision into System B. Adoption is weak. What is the underlying mistake?",
      options: [
        "The tool needs more features so operators find it worth the effort",
        "It is a bolt-on: the tool was added to an unchanged workflow instead of the workflow being redesigned so the tool is on the critical path with the manual seams removed",
        "The operators need more training on copy-paste efficiency",
        "The tool should be slower and more deliberate so operators trust it more"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: bolting a tool onto an unchanged workflow adds work; redesigning the workflow around the tool removes it.</strong> Every manual seam (copy from A, paste, retype into B) is friction, and friction under load is where adoption dies. The senior move is to have the tool read from A and write to B directly and to re-engineer the process so the tool is the default path and the old steps are deleted.</p><p>More features add surface area, not less friction — the problem is the seams, not the capability. Training people to copy-paste faster optimizes the thing you should be eliminating. Making the tool slower does nothing for trust and worsens the friction; trust comes from calibration and correctness, not from artificial deliberation.</p>"
    },
    {
      q: "A frustrated executive sponsor offers to 'just mandate' the new tool for the whole department to fix slow adoption. How should a senior FDE treat this offer?",
      options: [
        "Accept it immediately; a top-down mandate is the fastest and most reliable route to real adoption",
        "Decline all use of authority; adoption must be purely voluntary or it is not real",
        "Be wary: a mandate without earned trust produces malicious compliance and a false usage metric; use authority to remove obstacles, and reserve a mandate as a floor for laggards only after the majority has adopted willingly",
        "Accept it only if the sponsor also increases the project budget"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>Correct: a mandate without earned trust produces malicious compliance.</strong> People open the tool to satisfy the audit and make the real decision the old way, so your usage metric becomes a lie while true adoption stays at zero — and you burn goodwill. Authority is best spent removing obstacles (access, integration approvals, time to train); a mandate is a reasonable floor for laggards only after the majority already adopted willingly.</p><p>Accepting immediately buys a vanity spike and hides the real friction. Refusing all authority is dogmatic — authority is genuinely useful for clearing obstacles, just not for forcing clicks. Tying acceptance to more budget confuses a trust problem with a funding problem.</p>"
    },
    {
      q: "An FDE reports adoption success using: total accounts provisioned, cumulative requests processed, and number of logins in the first week. Why is this reporting misleading?",
      options: [
        "These are fine metrics; they directly demonstrate that behavior changed",
        "They are vanity metrics; real adoption is the fraction of the target workflow now flowing through the tool, tracked as weekly active doers against the eligible population and watched for the post-launch usage cliff",
        "The metrics are misleading only because the first week is too short a window",
        "Logins are the single best adoption metric and the others should be dropped"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: logins, provisioned accounts, and cumulative requests are vanity metrics.</strong> None of them shows that the target behavior changed — a login is not a decision made through the tool, and cumulative requests may be mostly your own testing. Honest adoption measures workflow-share (how much of the real work now flows through the tool versus around it), as weekly active doers over the eligible population, and it watches for the curiosity spike that craters as novelty fades.</p><p>They are not fine metrics — they systematically overstate adoption. The window length is a minor issue next to the fact that the metrics measure the wrong thing entirely. And logins are among the worst adoption proxies, not the best; they count that someone opened a door, not that they walked through and did the work.</p>"
    },
    {
      q: "Enabling a customer's team to be independent requires transferring three distinct capabilities. Which set best captures them? (Select 3)",
      options: [
        "Run it: start, stop, monitor, and troubleshoot the system using validated runbooks",
        "Trust it: users understand where the system is reliably good, where it is weak, and how to catch a bad output",
        "Extend it: a customer-side owner can evolve prompts, tools, evals, and the ontology as the business changes",
        "Sell it: the customer's team can pitch the tool to other departments to drive expansion",
        "Rebuild it: the customer's team can re-implement the system from scratch without the original code"
      ],
      answer: [0, 1, 2],
      multi: true,
      explanation: "<p><strong>Correct: run, trust, extend.</strong> Teams that transfer only 'run' fail slowly. Users who cannot calibrate trust either rubber-stamp the tool (automation bias) or abandon it after one error (algorithm aversion); a system nobody can extend freezes the day you leave and rots as the business moves on. Independence requires all three.</p><p>'Sell it' is a nice-to-have expansion booster, not a requirement for the system to survive your absence — a team can be fully self-sufficient without evangelizing. 'Rebuild it from scratch' is a wildly higher bar than independence requires and is not the goal; you want them to operate, calibrate, and evolve the system you built, not reproduce it blind.</p>"
    },
    {
      q: "An FDE wrote long, thorough documentation, but three weeks after rotating off, the customer was stuck when a nightly job failed — the docs described the architecture beautifully but never said what to do when that job broke. What discipline was missing?",
      options: [
        "The documentation simply needed to be longer and more detailed about the architecture",
        "Runbooks must be task- and failure-oriented and validated by having a customer engineer execute them while the FDE watches silently, so undocumented steps are found and fixed before departure",
        "The customer should have hired more experienced operators",
        "The FDE should have stayed permanently to handle such failures personally"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: docs must be failure-oriented and validated against a stranger's ignorance.</strong> The test of a runbook is whether a competent operator who never met you can resolve a 2 a.m. incident using only the document. Architecture prose fails that test; 'when this job fails, here is how to diagnose each cause and fix it' passes it. Watching a customer engineer execute the runbook in silence surfaces exactly the reflexive, undocumented fixes the author carries in their head.</p><p>More architecture detail makes the document longer and no more useful for an incident. Blaming the operators or the customer's hiring dodges the author's failure. Staying permanently is the bespoke-agency-of-one trap — the opposite of the goal, which is a system that survives your absence.</p>"
    },
    {
      q: "An engineer keeps a key operational detail in their head and stays the sole point of contact, reasoning that being irreplaceable on the account is good job security. Why is this the wrong instinct for an FDE specifically?",
      options: [
        "It is correct; indispensability is exactly how an FDE maximizes long-term value",
        "It caps the FDE at one deployment forever, makes the account fragile, and is the bespoke-agency-of-one failure mode; leverage comes from the number of independent running systems created, not from how many still need you",
        "It is wrong only because it violates the employment contract",
        "It is fine as long as the documentation is eventually written after the engineer leaves"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: indispensability is a prison, not a moat.</strong> An FDE whose deployments only run while they are present cannot leave, cannot start the next account, and cannot scale — that is the bespoke-agency-of-one failure the best orgs screen against. Value compounds with the number of independent systems you have created and walked away from, so making yourself replaceable here is what lets you be scarce on the next account.</p><p>It is not correct — it is career-limiting and makes the account brittle. Framing it merely as a contract violation misses the strategic and economic reasons it fails. And 'document it later, after leaving' is a contradiction: the knowledge leaves with the person, which is the entire problem.</p>"
    },
    {
      q: "During handoff, an FDE transfers runbooks, dashboards, credentials, and an on-call plan, but keeps the eval suite and the ontology as internal artifacts. Why is this handoff incomplete in a way that matters most?",
      options: [
        "It is complete; evals and the ontology are build-time artifacts the customer does not need",
        "Without the evals the customer cannot safely change a prompt or adopt a model update, and without the ontology they cannot evolve the domain model, so the system freezes and rots as reality moves — these are the artifacts that keep the system trustworthy and current",
        "The only real gap is the credentials, which should not have been shared",
        "The handoff is fine but should have included a longer support contract to compensate"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the eval suite and ontology are the load-bearing handoff artifacts.</strong> The evals are the customer's independence mechanism — how they safely change a prompt, accept a model upgrade, or extend a tool without fear of silent regressions. The ontology is how they keep the domain model current as the business changes. Withhold them and the customer is stuck with a frozen system they dare not touch, which decays the moment the world moves.</p><p>They are emphatically not build-time-only artifacts — they are precisely what makes the handoff real. Credentials are necessary but not the deepest gap here. And a longer support contract papers over the dependency instead of removing it — the goal is customer independence, which withholding the evals directly prevents.</p>"
    },
    {
      q: "An FDE wants to decide, on evidence rather than feeling, whether a deployment is self-sufficient enough to leave. Which signals best justify departure? (Select 3)",
      options: [
        "The customer's team has resolved a real production incident without the FDE, using the runbook",
        "The customer's technical owner has shipped a change (prompt, eval case, or ontology edit) and the regression gates caught nothing broken",
        "The adoption metric held stable above threshold the last time the FDE was offsite for a week",
        "The contract's calendar end date has arrived regardless of the system's state",
        "The FDE personally feels the relationship is warm and comfortable"
      ],
      answer: [0, 1, 2],
      multi: true,
      explanation: "<p><strong>Correct: self-sufficiency is demonstrated, not assumed.</strong> The three right signals are evidence the customer can run, extend, and sustain adoption of the system without the FDE: they recovered from a real incident alone, they shipped a change safely behind the regression gates, and adoption did not crater during an absence. Leaving when these are met avoids both premature departure (collapse and churn) and overstaying (bespoke agency of one).</p><p>A calendar date proves nothing about whether the system survives your absence — leaving on the date regardless of state is exactly the premature-departure failure. And 'the relationship feels comfortable' is a feeling, not evidence; comfort often correlates with overstaying, since the account that no longer needs you is the one it is emotionally hardest to leave. Define the criteria up front so the decision becomes an observation.</p>"
    },
    {
      q: "At renewal, an FDE presents: 10,000 queries per week, 95% user satisfaction, and high daily active usage. The CFO asks what the tool did for the business, and the FDE has no answer. What was the core mistake?",
      options: [
        "The satisfaction score was too low; it needed to be above 98% to justify renewal",
        "They reported usage vanity metrics instead of P&amp;L impact, and — the deeper error — likely never captured a baseline during scoping, so a measured before/after business delta was impossible to produce",
        "They should have presented even more usage metrics to make the case airtight",
        "The tool simply was not used enough; the numbers should have been higher"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: usage is not impact, and impact requires a baseline captured up front.</strong> Queries, satisfaction, and active usage answer 'is it adopted?', never 'did it matter?' — and the renewal turns on the second question. The deeper failure is that impact must be a measured delta against a before-state, and the before-state has to be instrumented during scoping because once the tool is live the old baseline is gone. No baseline, no provable P&amp;L story, no defensible renewal.</p><p>A higher satisfaction score is still a usage metric — more of the wrong thing. Piling on more usage numbers does not convert them into business outcomes. And the tool here was heavily used; the problem was never volume, it was that nobody connected the volume to a dollar the CFO cares about.</p>"
    },
    {
      q: "A beachhead workflow hits its numbers with a baselined, provable result. Why is this the moment where enterprise value actually compounds, and what should the FDE do?",
      options: [
        "Consider the engagement finished; a single proven workflow is the natural endpoint of a deployment",
        "Use the proven data access, ontology, security approvals, and trust to land the next workflows at a fraction of the original cost — the land-and-expand motion where expansion carries comparable value at far lower landing cost, driving net revenue retention above 100%",
        "Immediately raise the price of the existing workflow to capture more margin from it",
        "Move to an entirely unrelated new customer to prove the tool works elsewhere first"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the beachhead exists to be expanded from.</strong> The first workflow is deliberately narrow and winnable; a measured win earns the credibility and internal proof to land the next five. Expansion compounds value because the second workflow rides on data access, ontology, approvals, and relationships already paid for — comparable value at a fraction of the landing cost — which is what pushes net revenue retention above 100% and makes enterprise software lucrative.</p><p>Treating one workflow as the endpoint leaves the entire expansion opportunity — where the margin lives — on the table. Simply hiking the price of the existing workflow is not expansion and risks the relationship. Abandoning a warm, proven account to start cold elsewhere throws away the exact advantage (trust and installed infrastructure) that makes the next workflow cheap.</p>"
    },
    {
      q: "After a successful beachhead, the FDE writes up a recurring ontology-and-adapter pattern for the product team, who ship it as a reusable connector. In flywheel terms, what did this accomplish and why does it matter?",
      options: [
        "Nothing important; documenting internal patterns is administrative overhead that slows delivery",
        "It closed the deploy-learn-improve-deploy-faster flywheel: field pain became a product capability, so the next customer's timeline shrinks, landing cost falls, and margin expands — the services-as-software thesis made concrete",
        "It risked the account by giving away the customer's proprietary advantage to competitors",
        "It was only worthwhile if the FDE personally builds every future deployment that uses the connector"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: routing field pain into the product closes the flywheel.</strong> The dual mandate says you serve the one customer and feed generalizable signal back to the product. Turning a recurring pattern into a reusable connector means the next deployment ships what you hand-built here, cutting weeks off the timeline, lowering landing cost, and expanding margin — deploy, learn what breaks, improve the product, deploy faster. That is exactly the services-as-software / margin-for-moat mechanism.</p><p>It is the opposite of overhead — it is the company's highest-bandwidth product feedback channel. It does not leak the customer's advantage: a generalized ontology-and-adapter pattern is infrastructure, not the customer's proprietary data or model. And its value does not depend on the original FDE building future deployments — the whole point is that it makes <em>any</em> future deployment faster, which is leverage, not indispensability.</p>"
    }
  ],
  flashcards: [
    { front: "The two finish lines of a deployment", back: "<p><strong>It works</strong> (software runs, evals green, SOW satisfied) vs <strong>it is used</strong> (an operator now makes a real decision with it, daily, and would complain if you removed it). The gap between them is <strong>adoption</strong> — where most pilots actually die. Zero usage is not partial success; it is a complete failure that happens to compile.</p>" },
    { front: "Why the last mile is the hardest mile", back: "<p>Everything before adoption is a <strong>systems problem</strong> (engineers are good at these); adoption is a <strong>behavior-change problem</strong> obeying different physics — trust, habit, incentive, friction. A 98%-accurate tool can still go unused, because the barrier is not accuracy.</p>" },
    { front: "Diffusion of innovations — the adoption-curve trap", back: "<p>Innovators/early adopters try anything; the majority adopts only on peer proof; laggards need a mandate. The trap: measuring success by week-two enthusiasts who were always going to use it. Real adoption is a skeptical majority member reaching for the tool by default.</p>" },
    { front: "Trust as the currency of adoption", back: "<p>Built slowly by many correct outputs, destroyed instantly by one confident visible error. This is why <strong>evals are the substrate of adoption</strong>: a calibrated user who knows the failure modes keeps using the tool through an error; a user sold 'it's always right' abandons it at the first mistake.</p>" },
    { front: "Champion vs skeptic", back: "<p><strong>Champion:</strong> a credible line operator whose day gets better — arm them; peer proof moves the majority. <strong>Skeptic:</strong> often the domain expert whose expertise the tool seems to threaten — convert via co-ownership, not steamrolling. The reframe: tool takes the boring 80%, their scarce judgment goes to the hard 20%.</p>" },
    { front: "Bolt-on vs workflow redesign", back: "<p><strong>Bolt-on</strong> (the killer): tool added to an unchanged process; operators bridge manual seams (copy from A, paste, retype into B) — friction under load kills adoption. <strong>Redesign:</strong> tool on the critical path, reads A and writes B directly, old steps deleted. Only the second gets adopted.</p>" },
    { front: "Physical presence as an adoption technology", back: "<p>Onsite 'deploy days' do three things remote cannot: surface the real friction (watch someone alt-tab away), close the trust loop in real time (unstick a user in 10s), and signal commitment. Disproportionately effective in the first weeks while habits form.</p>" },
    { front: "The mandate trap", back: "<p>A top-down 'just make everyone use it' spikes usage overnight but produces <strong>malicious compliance</strong> — people click through and decide the old way, so the metric lies and real adoption stays zero. Use authority to remove obstacles; reserve a mandate as a laggard floor after the majority already adopted.</p>" },
    { front: "Measuring adoption honestly", back: "<p>Logins, provisioned accounts, and cumulative requests are <strong>vanity metrics</strong>. Real adoption = fraction of the target workflow flowing through the tool vs around it, as weekly active <em>doers</em> over the eligible population, watched for the post-launch cliff (curiosity spike then crater).</p>" },
    { front: "The goal: independence, not indispensability", back: "<p>Being the only one who understands the system feels like job security; it is a prison — caps you at one deployment, makes the account fragile, blocks the next account. Leverage = number of independent running systems you created and walked away from.</p>" },
    { front: "Three capabilities to transfer: run, trust, extend", back: "<p><strong>Run:</strong> start/stop/monitor/troubleshoot via runbooks. <strong>Trust:</strong> users know where it is strong/weak and how to catch a bad output. <strong>Extend:</strong> a customer owner evolves prompts, tools, evals, ontology as the business changes. Transfer only 'run' and the system freezes and rots.</p>" },
    { front: "Trust calibration: two opposite failure modes", back: "<p><strong>Automation bias</strong> (over-trust): rubber-stamping makes human-in-the-loop review theater. <strong>Algorithm aversion</strong> (under-trust): one error and the user abandons the tool entirely. Enablement puts users in the narrow band between — trust where strong, check where weak; that band is a training deliverable.</p>" },
    { front: "The test of a runbook", back: "<p>Could a competent operator who never met you resolve a 2 a.m. incident using only this document? Make runbooks <strong>task- and failure-oriented</strong> ('when X fails, diagnose and fix each cause'), and validate by having a customer engineer execute them while you watch silently — every intervention reveals an undocumented step.</p>" },
    { front: "The five handoff artifacts", back: "<p><strong>Runbooks</strong>, the <strong>eval suite</strong>, the <strong>ontology</strong>, <strong>dashboards/observability</strong>, and the <strong>on-call/escalation plan</strong>. The load-bearing ones are evals and ontology — they keep the system trustworthy and current after you leave; without them it is a frozen artifact that decays.</p>" },
    { front: "Why the eval suite is the independence mechanism", back: "<p>Evals convert 'trust me' into 'run the tests.' At handoff they are how the customer safely changes a prompt, adopts a new model, or extends a tool without fear of silent regression. Handing over a system without its evals is like shipping a codebase with the tests deleted — it runs, but nobody dares touch it, so it rots.</p>" },
    { front: "Self-sufficiency criteria for leaving, and the graduated handoff", back: "<p>Leave on evidence, not calendar or comfort: the team resolved a real incident without you; the tech owner shipped a change behind green regression gates; the adoption metric held during your absence; evals are owned and scheduled. Do it in stages, not a cliff: driver (you do it, they watch) → navigator (they do it, you coach) → backstop (real escalations only) → gone (a bounded support agreement).</p>" },
    { front: "P&L impact vs usage vanity metrics", back: "<p>Usage answers 'is it adopted?'; only outcome answers 'did it matter?' — and renewal turns on the second. Tie to a business number: hours saved times loaded cost, cycle-time reduction, error/rework rate, revenue or cost avoided. '10k queries/week' and '95% satisfaction' are inputs to impact, not impact.</p>" },
    { front: "Baseline before/after — and why it is a scoping task", back: "<p>You cannot prove impact you did not baseline. Capture the before (cost/time/error rate, measured) <strong>during scoping</strong> — once the tool is live the old baseline is gone forever. A great result with no baseline is unprovable, and unprovable results do not renew contracts.</p>" },
    { front: "Land-and-expand and the margin story", back: "<p>The beachhead is one narrow, winnable workflow; a measured win earns the next five at a fraction of the landing cost (data access, ontology, approvals, trust already paid for). Expansion drives NRR above 100%. Services-led firms IPO'd at ~54-63% margin and expanded to ~75-79% once entrenched — 'margin for moat.'</p>" },
    { front: "Closing the flywheel", back: "<p>Deploy → learn what breaks against reality → improve the product (route recurring field pain upstream, not one-offs) → deploy faster and cheaper → expand margin. The dual mandate come due: an FDE who absorbs every lesson personally and pushes nothing back spends the company's best product-feedback channel on their own indispensability.</p>" }
  ],
  lab: {
    title: "Lab: produce a complete handoff and adoption package for a deployment",
    html: `
<p><strong>Goal:</strong> author the full paper trail that turns a working prototype into a renewed, self-sufficient, expanding account. You will produce four artifacts for one hypothetical deployment — an adoption plan, a runbook, a handoff checklist, and an impact-measurement plan tied to a P&amp;L metric with a before/after baseline. This is a pure writing-and-judgment exercise: there is no cloud spend and no API cost — the only tools are a terminal and a text editor, and the entire footprint is a handful of local Markdown files you delete at the end.</p>

<h3>The scenario (hypothetical, generic)</h3>
<p>A mid-market logistics company runs an <strong>accounts-payable invoice-coding</strong> workflow: 12 AP clerks manually read incoming vendor invoices and assign each line to the correct general-ledger (GL) account and cost center before payment. You have built and validated an <strong>invoice-coding assistant</strong> that reads an invoice and proposes GL codings with a confidence score; a clerk reviews and confirms. Offline evals are green. It is not yet adopted, not yet handed off, and its impact is not yet proven. Your job is the package that fixes all three.</p>

<h3>Architecture</h3>
<p>Four Markdown files in a throwaway local folder. Each is a real deliverable you could hand a customer, not a toy — the exercise is the thinking, and the rubric at the end is how you grade yourself. Baseline numbers are invented but must be internally consistent and tied to a P&amp;L statement.</p>

<h3>Steps</h3>
<ol>
<li><strong>Set up a scratch workspace.</strong>
<pre><code>mkdir -p ~/handoff-lab &amp;&amp; cd ~/handoff-lab
touch adoption-plan.md runbook.md handoff-checklist.md impact-plan.md</code></pre></li>

<li><strong>Write the adoption plan</strong> in <code>adoption-plan.md</code>. It must contain, concretely (name invented people and numbers):
<ul>
<li><strong>Champion:</strong> who (e.g. a respected senior AP clerk or the AP team lead), why they are credible, and how you will arm them and make them visible.</li>
<li><strong>Skeptic:</strong> who is threatened (e.g. the most experienced clerk whose coding expertise the tool automates) and your co-ownership plan to convert them — including finding the category they are genuinely right about.</li>
<li><strong>Workflow redesign:</strong> describe the current bolt-on risk (clerk copies invoice data between systems by hand) and the redesigned critical-path version (the assistant reads from the invoice intake and writes the proposed coding directly into the AP system for one-click confirm). Name at least one manual step you will delete.</li>
<li><strong>Training sessions:</strong> a concrete schedule — kickoff, hands-on onboarding, onsite deploy days, office hours — and what each covers, explicitly including trust calibration (where the tool is weak, how to catch a bad coding).</li>
<li><strong>The adoption metric:</strong> one honest metric with a target and a review cadence — e.g. weekly active clerks confirming codings through the tool as a fraction of all 12 clerks, target sustained at a stated level, watched for the post-launch cliff. Explicitly reject a vanity metric and say why.</li>
</ul></li>

<li><strong>Write the runbook</strong> in <code>runbook.md</code>. Make it <strong>failure-oriented</strong>, not architecture prose. Include at least: how to tell the system is healthy (which dashboard, what 'good' looks like); a 'when X fails' table covering at least three failures (invoice intake feed stale, confidence scores all low / model degraded, write-back to the AP system failing) each with symptom, diagnosis, fix, and escalation; who is on call and the escalation path; and the support SLA. Apply the test: could a stranger resolve a 2 a.m. incident from this alone?</li>

<li><strong>Write the handoff checklist</strong> in <code>handoff-checklist.md</code>. Two sections:
<ul>
<li><strong>Artifacts transferred</strong> (checkbox list): runbook, eval suite (owned and runnable by the customer), ontology/domain model (GL codes, cost centers, vendor entities and their relationships), dashboards, on-call plan, credentials rotated to customer-owned accounts. Note for the eval suite and ontology <em>why</em> each is load-bearing.</li>
<li><strong>Self-sufficiency criteria</strong> (must all be true before you leave): customer resolved a real incident without you; their tech owner shipped a change behind green regression gates; adoption metric held during a week you were offsite; evals owned and scheduled. Add the graduated-handoff stages (driver → navigator → backstop → gone).</li>
</ul></li>

<li><strong>Write the impact plan</strong> in <code>impact-plan.md</code> tied to a P&amp;L metric with a before/after baseline. It must include:
<ul>
<li><strong>The P&amp;L metric:</strong> pick one and make the money explicit — e.g. clerk minutes per invoice times fully-loaded hourly cost times monthly invoice volume, expressed as capacity freed in dollars; or coding-error/rework rate times cost per correction.</li>
<li><strong>The baseline (before):</strong> the measured pre-tool numbers (invented but consistent) — e.g. 4.0 minutes per invoice, 8% coding-error rate, at a stated monthly volume — and a one-line note that this had to be captured during scoping because it vanishes once the tool is live.</li>
<li><strong>The target (after)</strong> and the measurement method and cadence, using the customer's own reporting so the result is reproducible by their analysts, not a vendor claim.</li>
<li><strong>The expansion hook:</strong> one sentence on the next workflow this beachhead earns (e.g. purchase-order matching or duplicate-invoice detection) and one sentence on a recurring pattern worth pushing back to the product team.</li>
</ul></li>

<li><strong>Self-grade against the rubric.</strong> Re-read all four files and score each item below yes/no. Every 'no' is a real gap you would have shipped to a customer.</li>
</ol>

<h3>Verify (self-grading rubric)</h3>
<ul>
<li>The adoption plan names a specific champion AND a specific threatened skeptic with a conversion plan — not a generic 'drive adoption' paragraph.</li>
<li>The workflow section describes a redesign that deletes a manual step, not a bolt-on that adds copy-paste.</li>
<li>The adoption metric is a workflow-share / active-doer metric with a target and cadence, and you explicitly rejected a named vanity metric.</li>
<li>The runbook is failure-oriented with at least three 'when X fails' entries, and a stranger could act on it at 2 a.m.</li>
<li>The handoff checklist lists the eval suite and ontology and explains why each is load-bearing, and the self-sufficiency criteria are evidence-based (demonstrated), not calendar-based.</li>
<li>The impact plan states a P&amp;L metric in dollars, a measured before-baseline, an after-target, a reproducible measurement method, and an expansion hook.</li>
</ul>

<h3>Teardown</h3>
<p>Everything is local Markdown; there is nothing billing. If you want to keep the package as a template, move it somewhere permanent first; otherwise remove the scratch workspace so a stale, invented baseline never gets mistaken for a real one later:</p>
<pre><code>cd ~ &amp;&amp; rm -rf ~/handoff-lab      # delete the scratch folder and all four Markdown files</code></pre>
<p>(If you pasted any real customer numbers into these drafts while adapting the template, delete those copies too — clean handling of a customer's operational and financial data is itself part of the handoff discipline you are practicing here.)</p>
`
  }
});
