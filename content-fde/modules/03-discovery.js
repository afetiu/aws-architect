/* Module 03 — Discovery: Diagnosing the Real Problem (The Craft track) */
window.COURSE.register({
  id: "discovery",
  order: 3,
  track: "craft",
  title: "Discovery: Diagnosing the Real Problem",
  description: "Discovery is core engineering work, not a meeting you sit through before the real job starts. This module is about surfacing three things before you build anything: the real problem hiding behind the stated one, the true shape of the customer's data and systems, and the success metric that decides whether you won — and the interviews, stakeholder maps, and shadowing that produce them.",
  examWeight: "Discovery is the single most tested competency in the FDE loop. The make-or-break ambiguous case study (~30% of the weighting, ~40% pass rate) is graded almost entirely on whether you clarify before solving, decompose a vague problem, and surface the real requirement instead of pattern-matching to an architecture; the client role-play rewards diagnostic questions and penalizes order-taking. On the job it is roughly 30–40% of your week, every week — the conversational, investigative work that determines whether the code you write later solves anything at all.",
  lessons: [
    {
      id: "discovery-as-engineering",
      title: "Discovery as engineering, not a sales handoff",
      html: `
<p>Here is the fact that surprises engineers who take the role: roughly <strong>30–40% of an FDE's week is conversational discovery</strong> — sitting with operators, asking questions, watching people work, arguing about what "done" means — and none of it looks like coding. The reflex is to file this under overhead, the tax you pay before the real work. That reflex is the first thing the role has to beat out of you, because discovery is not the thing before the engineering; <strong>it is the engineering</strong>. It is requirements analysis for a system whose requirements are unknowable in advance and systematically misdescribed by the people who have them.</p>

<p>The mental model to hold: discovery produces three artifacts, and all three are engineering inputs that determine whether the code you write in week three matters at all.</p>
<ul>
<li><strong>The real problem</strong> — the specific decision or action that is slow, wrong, expensive, or inconsistent today (not the solution the customer named).</li>
<li><strong>The data-and-system reality</strong> — where the data actually lives, its true quality and freshness, which systems you must integrate, and how brittle each one is.</li>
<li><strong>The success metric</strong> — the pre-agreed, measurable definition of "this worked," owned by someone who can sign off on it.</li>
</ul>
<p>Miss any one and you can write flawless software that solves the wrong problem, chokes on the real data, or ships without anyone able to say whether it succeeded. Those are not coding failures; they are discovery failures, and they account for the overwhelming majority of enterprise-AI pilots that die.</p>

<h3>Why the sales handoff is a hypothesis, not a spec</h3>
<p>By the time you arrive, a sale has closed. Somewhere upstream a solutions or sales engineer built a demo, a slide said "AI-powered claims triage," and a statement of work committed to an outcome. It is tempting to treat that package as your spec. It is not. It is a <strong>hypothesis generated to close a deal</strong>, assembled from conversations with the people who buy software — executives — rather than the people who use it. The buyer's mental model of their own operation is a floor above where the work actually happens, and it is smoothed, idealized, and often several years out of date. Colin Jarvis's one-line description of why FDEs exist is exactly this gap: FDEs "work in a ton of ambiguity, and often what the customer describes in scoping doesn't match the data and system reality on the ground." The scoping deck is the map; discovery is walking the territory and redrawing it.</p>

<div class="callout deep">What actually gets lost in the sales-to-delivery handoff is fidelity at every layer. The AE talked to a VP who described the process as they believe it runs; the SE compressed that into a demo optimized for a signature; the SOW abstracted the demo into outcome language a lawyer could countersign. Each step is a lossy compression toward what sells, away from what is true. By the time it reaches you, the "problem statement" has been through three encoders tuned for persuasion, not accuracy. Your job in discovery is decompression: reconstruct the real operation from primary sources — the operators, the data, the systems — rather than trusting the artifact. Treating the SOW as ground truth is the equivalent of trusting a single unverified web page because it was confidently written.</div>

<h3>Discovery is continuous, not a phase</h3>
<p>Classic enterprise delivery front-loads a discovery phase: weeks of interviews, a fat requirements document, sign-off, freeze, then build. The FDE model rejects the freeze. Because "ship on day one" puts working software in front of the customer in week one — against synthetic data, before you have real access — the prototype itself becomes a discovery instrument. You learn more about the real problem from watching a VP's face when they click your first thin slice than from a month of interviews, because a running artifact forces the customer to react to something concrete instead of describing an abstraction. Discovery and delivery interleave: you scope, ship a slice, watch it be wrong in an instructive way, re-scope. The 30–40% is not a phase that ends; it is a permanent share of every week because the real problem keeps clarifying as reality pushes back on your build.</p>

<div class="callout war">A team took a signed SOW at face value: "build a search assistant over the policy library so agents stop escalating." They spent four weeks building excellent retrieval-augmented search. Adoption was near zero. Two hours of discovery they never did would have surfaced the truth: agents did not escalate because they could not find policies — they escalated because they were not authorized to make the exception the policy allowed, and they wanted cover. The real problem was an authority-and-accountability gap, not a search problem. No amount of retrieval quality could touch it. The engineering was immaculate; the discovery was skipped; the pilot was dead on arrival.</div>

<div class="callout limits">Numbers worth internalizing. Discovery is ~30–40% of the FDE week, sustained, not front-loaded. The three-phase deployment shape allots <em>days onsite</em> to initial scoping (mapping processes, prototyping on synthetic data before real data access), then multi-week validation, then recurring delivery. Escaping POC purgatory hinges on forcing a go/no-go decision by roughly <strong>week 6</strong> against a pre-agreed success metric — which means the metric, an output of discovery, must exist by then or the pilot has no exit criteria and drifts. Enterprise pilots that skip rigorous discovery track with the ~95% no-measurable-impact failure rate; the failure is integration and problem-framing, not model quality.</div>

<div class="callout exam">The ambiguous case study exists to test exactly this instinct, and it carries roughly 30% of the loop weighting with a ~40% pass rate. You are handed a deliberately vague enterprise problem. The candidates who fail reach for an architecture in the first two minutes. The candidates who pass treat the prompt as a sales handoff to be interrogated: they ask who the user is, what decision is being made today and how, what "good" would mean and who decides, and where the data lives — before proposing anything. Say it out loud that the stated problem is a hypothesis you need to validate, and you have already separated yourself from the pattern-matchers. Interviewers are listening for "let me clarify before I solve," not for a slick diagram.</div>
`
    },
    {
      id: "stated-vs-real-problem",
      title: "The stated problem vs the real problem",
      html: `
<p>The core cognitive move of the FDE — the thing the interview loop is engineered to detect and the job rewards daily — is diagnosing the <strong>real problem behind the stated one</strong>. Customers almost never hand you a problem. They hand you a <em>solution</em> ("we want a chatbot," "build us a dashboard," "we need an agent that reads emails") or a <em>symptom</em> ("the team is drowning," "turnaround is too slow"). Both are downstream of a real problem they have not articulated, usually because they have already pre-solved it in their heads and skipped straight to the answer.</p>

<p>The reframing that unlocks nearly every enterprise engagement: <strong>the real problem is almost always a specific decision or action, made slowly or badly, by a specific person.</strong> Not a capability gap in the abstract — a concrete human, at a concrete moment, doing a concrete thing worse than they should. "We want a chatbot for our support docs" decompresses to "a support agent spends eight minutes per ticket hunting across four wikis for a policy, gives inconsistent answers, and escalates when they give up." Now you have something an engineer can attack, and a chatbot is merely one candidate instrument — maybe the right one, maybe not.</p>

<table>
<thead><tr><th>What the customer says (solution/symptom)</th><th>The real problem, once diagnosed (decision, actor, failure mode)</th></tr></thead>
<tbody>
<tr><td>"We want an AI chatbot for our docs"</td><td>A support agent takes 8 minutes to find a policy and answers inconsistently — the decision is "what is the correct answer for this customer," made slowly and unreliably</td></tr>
<tr><td>"Build us an executive dashboard"</td><td>A regional manager reallocates inventory weekly from a stale spreadsheet and is usually a week behind reality — the decision is "where to move stock," made on bad data</td></tr>
<tr><td>"We need to automate our email inbox"</td><td>A claims clerk manually routes 400 emails a day to the right team, mis-routes 15%, and each mis-route costs two days — the decision is "who handles this," made at volume with errors</td></tr>
<tr><td>"Our analysts are overwhelmed"</td><td>An analyst rebuilds the same three data pulls every morning before they can start real work — the problem is 90 minutes of daily toil, not headcount</td></tr>
</tbody>
</table>

<h3>Why customers speak in solutions</h3>
<p>This is not stupidity, and treating it as such is the fastest way to lose the room. Buyers speak in solutions for rational reasons: they have lived with the pain long enough to have theories about the fix; procurement forced them to write the need as a specification of a thing to buy; a competitor deployed "a chatbot" and the board asked why they have not; and a named solution is politically safer to champion than an admission that a process is broken. The senior FDE hears the stated solution as <em>data about how the customer thinks</em> — valuable — but never as the requirement itself.</p>

<h3>The "why" ladder, tuned for the enterprise</h3>
<p>The consulting instinct is the Five Whys: keep asking why until you hit root cause. It transfers, but naively applied in an enterprise it walks off a cliff, so tune it three ways. First, <strong>expect the chain to fork by stakeholder</strong> — the VP's "why" bottoms out at a revenue number, the operator's at a broken tool, and both are true; you are reconstructing a graph, not a single chain. Second, <strong>ladder toward the decision, not toward blame</strong> — "why is this slow" can decay into "because Dave's team is lazy," which is political poison and usually false; steer every "why" back to the decision and the constraint, not the culprit. Third, <strong>stop at the level you can actually change</strong> — root-causing to "the company's data culture is broken" is true and useless; the actionable altitude is the specific decision you can instrument and improve inside the contract.</p>

<div class="callout deep">A reliable tell that you have reached the real problem: you can state it as a measurable delta on a named person's day. "Reduce the claims clerk's per-email routing time from 90 to 10 seconds and cut mis-routes below 3%" is a real problem — it names the actor, the decision, the current state, and an implied metric. "Improve operational efficiency with AI" is not a problem, it is a wish, and it cannot be built against or measured. If your problem statement does not contain a person and a number, you have not finished diagnosing; you are still holding a symptom.</div>

<div class="callout war">A logistics customer asked for "a GenAI assistant that answers questions about our shipments." An order-taking team built a competent RAG assistant over the tracking database. Usage cratered after week one. Discovery, done too late, found the real problem: dispatchers did not lack answers about shipments — they lacked a fast way to <em>decide which of forty delayed shipments to expedite first</em> when a port backed up. They needed a ranked triage list with reasons, not a question box. Same underlying data, same models, completely different product. The stated solution ("assistant that answers questions") had quietly smuggled in the wrong interaction model, and nobody had diagnosed the decision underneath it.</div>

<div class="callout limits">Jumping to a solution before scoping is the number-one rejection reason in the ambiguous case study, full stop. Interviewers have a name for the failure — "solutioning" — and they watch for the minute mark at which you commit to an architecture. The counter-discipline is cheap and learnable: for the first several minutes, ban yourself from proposing anything. Ask who, what decision, how today, what would "good" look like, who decides. A candidate who reframes "build a chatbot" into "which specific decision is being made slowly, by whom, and how would we measure improvement" has demonstrated the exact instinct the role is hired for.</div>

<div class="callout exam">A subtle trap the strongest interviewers set: sometimes the customer's stated solution <em>is</em> the right one. If you reflexively contradict every customer to look diagnostic, you fail differently — as a contrarian who does not listen. The move is not "the customer is always wrong about the solution." It is "I validate the problem behind the solution before I commit to building it." Occasionally validation confirms the chatbot really was right; more often it reframes; either way you built on a diagnosed problem, not an inherited assumption. Articulating that nuance — diagnose to verify, not to contradict — is a senior signal in the role-play.</div>
`
    },
    {
      id: "stakeholder-mapping",
      title: "Stakeholder mapping and org politics",
      html: `
<p>You can diagnose the real problem perfectly and still fail, because in an enterprise the problem is embedded in a political system and the solution has to survive it. The org chart tells you reporting lines; it does not tell you who has the pain, who controls the money, who can quietly kill your project, and who will actually use the thing. Those four are usually four different people, and mapping them is not soft-skills garnish — it is a hard prerequisite for the deployment surviving to production. The FDE who ignores politics ships beautiful software into a veto.</p>

<h3>The roles you must locate</h3>
<table>
<thead><tr><th>Role</th><th>What they control</th><th>What they fear</th></tr></thead>
<tbody>
<tr><td><strong>Economic sponsor</strong></td><td>The budget and the mandate; wants a visible win</td><td>A public failure that reflects on their bet</td></tr>
<tr><td><strong>Champion</strong></td><td>Nothing formally — but influence, context, and hallway access; your inside guide</td><td>Championing something that flops and costs them credibility</td></tr>
<tr><td><strong>End user / operator</strong></td><td>Whether the thing is actually adopted; holds the real pain and the real workflow</td><td>Being automated out, or handed a tool that makes their day worse</td></tr>
<tr><td><strong>IT / platform</strong></td><td>Access, infrastructure, integration, service accounts, deployment</td><td>An ungoverned system on their infra that they must support at 3 a.m.</td></tr>
<tr><td><strong>Security / compliance</strong></td><td>Data access, deployment model, a hard veto on the whole engagement</td><td>A breach, a PII leak, an audit finding with their name on it</td></tr>
<tr><td><strong>Finance / procurement</strong></td><td>Renewal, ROI framing, the contract itself</td><td>Paying for shelfware they cannot justify at renewal</td></tr>
</tbody>
</table>

<h3>Three questions the org chart cannot answer</h3>
<p><strong>Who has the pain?</strong> Pain is the fuel of every deployment; the person who feels it daily is your source of truth for the real problem and your best early adopter. But they frequently have no budget and no authority — pain and power are usually decoupled, which is why you must map both. <strong>Who holds the budget?</strong> The economic sponsor decides whether this renews and expands, and they experience the project through outcomes and optics, not features. <strong>Who can veto?</strong> This is the one engineers systematically under-map. A security officer who was not at kickoff can, in a single email in week five, forbid the deployment model your entire architecture assumed. A middle manager whose team the tool "helps" can read it as a threat to their headcount and quietly starve it of the cooperation you need. Vetoes are cheap to exercise and catastrophic to discover late.</p>

<h3>Find the real decision-maker and the champion</h3>
<p>The nominal decision-maker on the org chart is often not the real one. The real decision-maker is whoever the sponsor actually trusts on this question — sometimes a respected staff engineer, sometimes a veteran operator whose thumbs-down ends things regardless of title. You find them by watching deference in the room: when a hard question lands, whose way do the eyes turn? The <strong>champion</strong> is a distinct and precious asset — your inside advocate who explains the politics, gets you the meeting, and sells the work when you are not in the building. You cannot deploy without one. Part of discovery is identifying a potential champion, then deliberately making them look good, because their credibility is the vehicle your software rides to production.</p>

<div class="callout deep">RACI charts and formal stakeholder lists capture <em>authority</em> and miss <em>influence</em>, which is the variable that actually moves enterprise deployments. The more useful instrument is a power-versus-interest read: high-power/high-interest people you manage closely (sponsor, key veto-holders); high-power/low-interest people you keep satisfied and un-surprised (an exec who can kill it on a whim but is not paying attention — surprise them and they veto reflexively); low-power/high-interest people you enlist as champions and pilot users (the operators with the pain). The failure mode is spending all your relationship capital on the friendly high-interest operators — who cannot say yes — while neglecting the bored high-power exec who can say no. Map influence, not just the reporting tree.</div>

<div class="callout war">A claims-automation pilot had an enthusiastic sponsor, delighted operators, and a working prototype by week two. It died in week six. The team never mapped the compliance officer, who surfaced at a steering review and pointed out that the deployment sent claim data to an external endpoint in violation of the firm's data-residency policy. The fix — a VPC deployment with the model in-region — was architecturally fine but should have been a scoping constraint from day one; retrofitting it blew the timeline past the sponsor's patience and the go/no-go slipped to abandonment. The lesson the team wrote down: <strong>identify every veto-holder in week one and treat their constraints as inputs, not surprises.</strong> Security and compliance are not a late gate to clear; they are a stakeholder to discover early.</div>

<div class="callout limits">This is why the role is genuinely, physically onsite. You do not sort out a political map over email — you sort it out by being in the building: who sits near whom, who gets deferred to in a meeting, who is conspicuously not invited, who walks you to lunch and tells you how things really work. Palantir's model has historically expected meaningful onsite presence for exactly this reason; some deployment-heavy startups run up to 50%. Informal pilot governance also collapses at scale — the handshake that worked with five friendly users needs a named decision-maker and a real sign-off process before it can expand to five hundred. Getting that governance identified is a discovery deliverable, and it is why the go/no-go by ~week 6 requires knowing precisely whose call it is.</div>

<div class="callout exam">The case study and the role-play both probe this directly. A common prompt: "you have this problem — who do you talk to first, and why?" A weak answer names "the stakeholders" generically. A strong answer distinguishes the person with the pain (for ground truth on the workflow), the person with the budget (for the success metric and the mandate), and the people who can veto (security, compliance, IT, a threatened manager) — and says you would surface the veto-holders' constraints in week one specifically so they become design inputs rather than week-five landmines. Naming the champion as an asset you actively cultivate, and reading power versus authority, marks you as someone who has actually deployed rather than someone who has only built.</div>
`
    },
    {
      id: "data-and-system-reality",
      title: "Reading the data and system reality on the ground",
      html: `
<p>Beneath the org chart and the process documentation sits a second, harder ground truth: the actual data and the actual systems. This is the layer where enterprise-AI projects go to die, because the model is fine and the demo worked on clean synthetic data — but the customer's real data is scattered, dirty, stale, half-owned, and locked inside a dozen systems that do not want to talk to you. The FDE's job is to discover that reality early, while it is still a scoping input, rather than late, when it is a broken promise. The adapter layer between LLM-native tooling and legacy data is consistently the <strong>longest pole in the timeline</strong>, and every undocumented endpoint, flat-file export, and legacy SOAP service adds weeks.</p>

<h3>The documented process is not the real process</h3>
<p>Every enterprise has an official process diagram, and it is a work of fiction — not a lie, but an aspiration frozen at the moment someone last had time to draw it. The real process runs on <strong>shadow infrastructure</strong>: the spreadsheet that actually schedules the shifts, the Slack channel where the real approvals happen, the one veteran everybody calls when the system does something weird, the email folder that is the true system of record. The gap between documented and actual is where your requirements really live. You cannot find it by reading the wiki or asking the manager, who sincerely believes the diagram. You find it by <strong>shadowing the operators</strong> — sitting beside the person who does the work and watching them do it, including every undocumented copy-paste, every workaround, every "oh, and then I just fix this by hand."</p>

<h3>What to interrogate about the data</h3>
<ul>
<li><strong>Location and fragmentation.</strong> Where does the data actually live? The honest answer is usually "across a dozen systems" — an ERP like SAP, a CRM, three departmental databases, a lake nobody trusts, CSV exports on a shared drive, and a business-critical spreadsheet on someone's laptop. Each source is a separate integration with its own auth, format, and brittleness.</li>
<li><strong>Quality.</strong> Ask for a real sample export and inspect it yourself. Count the nulls. The field the customer swears is "always populated" is frequently 60–80% empty, or populated with a free-text convention that drifted three reorgs ago. Data that looks structured is often structured-ish.</li>
<li><strong>Freshness and latency.</strong> Is the "real-time" feed actually a nightly batch? Is the authoritative record updated when the work happens, or reconstructed weekly by a human? A decision support tool built on data that is a week stale makes week-stale decisions.</li>
<li><strong>Ownership and provenance.</strong> Who owns each field, who is allowed to grant access, who updates it and when? Ownership questions are where the integration timeline actually goes — a service account can take longer to provision than the pipeline takes to build.</li>
</ul>

<div class="callout deep">Concrete moves that turn vague "we have the data" into an inventory you can plan against: (1) Ask for a sample export of every source in week one — the request itself surfaces reality, because "we'll have to check who can pull that" tells you access is not solved. (2) Profile the sample: row counts, null rates per field, distinct-value counts, min and max timestamps to see real freshness. (3) Trace one record end to end — pick a single claim or shipment and follow it across every system it touches; the seams you cross are your integration surface. (4) Ask "when this field is wrong, how do you find out?" — the answer reveals whether anyone actually trusts the data. None of this needs real production access; a redacted sample and a whiteboard get you 80% of the map, which is exactly why the scoping phase can prototype on synthetic data while these questions run in parallel.</div>

<div class="callout war">A healthcare-adjacent deployment scoped a document-understanding pipeline against a schema the customer provided: clean fields for diagnosis, date, and provider. The real exports were scanned PDFs of faxes — the "structured" system was a human retyping faxes into a form when they got around to it, days later, with a 20% backlog. The documented data reality and the ground truth were different universes. Because the FDE pulled a real sample in week one instead of trusting the schema, the OCR-and-extraction problem — the actual longest pole — got scoped into the timeline instead of detonating in week five. The teams that skip the sample export are the teams whose demo works and whose production launch slips two quarters.</div>

<div class="callout limits">Integration reality, in numbers to carry into a system-design interview: the adapter layer is the longest timeline item, and each additional legacy source (undocumented REST, SOAP, flat-file, on-prem DB behind a jump host, SSO and service-account provisioning) adds weeks, not days. This is why the three-phase model withholds real data access until the delivery phase and prototypes on synthetic data first: you can validate the problem and the interaction model without waiting on the six-week security review to grant a read-only credential. Assume real data access is a multi-week procurement item and scope around it; teams that assume "we'll get the data next week" build their whole plan on the single most unpredictable dependency in the engagement.</div>

<div class="callout exam">The real-world system-design round tests this head-on: "design an ingestion pipeline for a Fortune 500" or "a VPC-deployed RAG system for a HIPAA healthcare customer with 50 million documents." The junior move is to draw boxes and arrows. The senior move is to open with the discovery questions: what systems hold the documents, what formats, what is the real quality and freshness, how do we get access and how long does that take, what are the residency and compliance constraints, and what does the data look like when it is wrong? Interviewers are explicitly checking whether you know that the model is the easy part and the data-and-integration reality is where the project is won or lost. Leading with "tell me about your data before I draw anything" is the tell of someone who has been onsite.</div>
`
    },
    {
      id: "discovery-interview",
      title: "The discovery interview: questions that surface truth",
      html: `
<p>The interview is your primary instrument, and like any instrument it is only as good as your technique. Most engineers conduct discovery interviews badly by default: they ask leading questions, accept idealized answers, write down a feature list, and leave with a tidy set of requirements that describe a workflow nobody actually runs. This lesson is the technique that surfaces truth instead — the questions with the highest yield, the listening discipline that makes them work, and the anti-patterns that quietly wreck the whole exercise.</p>

<h3>The highest-yield questions</h3>
<ul>
<li><strong>"Walk me through the last time you did X."</strong> The single most powerful discovery question. It replaces idealized generality ("how does the process work?") with a concrete, recent, real episode. People narrate a specific instance accurately and describe a general process aspirationally — the last time includes the workaround, the phone call, the thing they fixed by hand, all of which the abstract description sands off.</li>
<li><strong>"What happens when it goes wrong?"</strong> The happy path is 20% of the value and 5% of the difficulty. The edge cases — the malformed input, the exception, the escalation, the 2 a.m. failure — are where the real work and the real requirements live. Ask for the failure modes explicitly, because nobody volunteers them.</li>
<li><strong>"Show me, don't tell me."</strong> Whenever possible, get them to do the task in front of you with real (or realistic) data. What people do and what they say they do diverge constantly, and never maliciously; the hands know things the narration omits.</li>
<li><strong>"Who else touches this?"</strong> Surfaces the hidden stakeholders and the handoffs, which are where errors and delays concentrate.</li>
<li><strong>"What is the workaround you are a little embarrassed by?"</strong> Names the shadow process directly, with a bit of permission-giving humor. The embarrassing workaround is usually the real system of record.</li>
<li><strong>"How would you know this got better?"</strong> Drives straight at the success metric while the person who feels the pain is in front of you.</li>
</ul>

<h3>Open versus leading, and the discipline of listening</h3>
<p>A leading question smuggles your hypothesis into the answer and gets it confirmed regardless of truth: "wouldn't it help if the AI just drafted the reply for you?" earns a polite yes that tells you nothing. The open version — "what do you do after you read the email?" — lets the real workflow emerge, including the possibility that drafting the reply is not the bottleneck at all. Ask <em>how they do it today</em> before you ever float <em>how it could work</em>. Then actually listen: leave silence after the answer (people fill it with the truer, less-rehearsed version), reflect back what you heard to confirm and to invite correction, follow the emotional energy (frustration marks real pain), and notice what they skip — the step described in three fast words is often the messy one they would rather not open. You are capturing the current workflow <strong>as-is</strong>, not the workflow as they wish it ran; the as-is map, with its warts, is the actual requirement.</p>

<div class="callout deep">Why "walk me through the last time" outperforms "how does this usually work" is a fact about memory. The general question queries semantic memory — a compressed, normalized schema of the process that has had every exception averaged out. The specific-episode question queries episodic memory — an actual event, retrieved with its concrete mess intact. The generalized account is where the workarounds go to disappear; the episode is where they resurface. This is also why "show me" beats both: enactment recruits procedural memory, which encodes steps the person cannot even verbalize because they have automated them. Stack the three — recent episode, then show me, then what-happens-when-it-breaks — and you reconstruct the real process instead of the sanitized one.</div>

<h3>The anti-patterns that ruin discovery</h3>
<ul>
<li><strong>Order-taking.</strong> Transcribing the customer's feature list and calling it requirements. You are a diagnostician, not a waiter; a list of requested features is a set of symptoms to interrogate, not a spec to implement.</li>
<li><strong>Solution-first.</strong> Arriving with the architecture in your head and running the interview to confirm it. You will hear only what fits, and miss the reframing that mattered.</li>
<li><strong>Happy-path assumption.</strong> Scoping only the normal case because that is what gets described first, then discovering in production that the exceptions are 30% of volume and 90% of the difficulty.</li>
<li><strong>Interviewing managers, not doers.</strong> The single most common and most damaging error. Managers describe the process as they designed it and believe it runs; the operators run the real one. If you only talk to people who do not do the work, you will faithfully capture a fiction. Get to the people whose hands are on the task.</li>
</ul>

<div class="callout war">An FDE ran a crisp week of interviews with the director of operations and two team leads, produced a clean as-is workflow diagram, and built to it. In UAT the frontline clerks looked at the tool and said "that's not how any of us actually do this." The director had described the process from the 2019 training manual; the real workflow had mutated through three system migrations and now hinged on a shared spreadsheet the director did not know existed. Two hours shadowing a clerk in week one would have caught it. The tool was rebuilt; the trust took longer to rebuild. <strong>Interview the people with their hands on the work, or you are documenting a myth.</strong></div>

<div class="callout exam">The client role-play round is, in part, a live test of your discovery technique: the interviewer plays a customer and watches whether you diagnose or order-take. Winning behaviors are concrete and practiced — open with "walk me through the last time this happened," ask "what happens when it goes wrong," reflect back what you heard before proposing, and resist the urge to solve out loud until you have the real problem. In the ambiguous case study, verbalize the same questions you would ask the customer if they were in the room ("I'd want to know who runs this today and where it breaks") — it shows the interviewer your discovery instinct even when there is no live customer to interview. Order-taking, leading questions, and happy-path-only scoping are exactly the failures the round is built to expose.</div>
`
    }
  ],
  quiz: [
    {
      q: "You inherit a signed statement of work from the sales team that specifies 'build an AI chatbot over the policy library so support agents stop escalating.' It is your first week onsite. What is the right first move?",
      options: [
        "Treat the SOW as the spec and start building the chatbot immediately to ship on day one",
        "Run discovery to find the real decision agents are making slowly or badly, treating the SOW as a hypothesis to validate before committing to the chatbot",
        "Ask the sales engineer for a more detailed requirements document before doing anything",
        "Build a more capable version than the SOW describes to exceed expectations"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the SOW is a hypothesis generated to close a deal, not a spec.</strong> It was assembled from conversations with buyers a floor above the real work and compressed toward what sells. Discovery decompresses it: find the specific decision (finding the right answer, or getting authority to make an exception) that is actually slow or broken, and validate whether a chatbot even addresses it before building.</p><p>Treating the SOW as gospel is the exact order-taking failure that produces beautiful software nobody adopts — 'ship on day one' means ship a thin discovery instrument, not commit to the inherited solution. Asking sales for more detail just requests a more elaborate version of the same lossy artifact. Building something more capable scales the risk of solving the wrong problem well.</p>"
    },
    {
      q: "A customer says 'we want an executive dashboard for our inventory.' Which reframing best reflects the FDE's diagnostic instinct?",
      options: [
        "Identify which charts and KPIs the executives want to see on the dashboard",
        "Identify the specific decision being made slowly or badly by a specific person — e.g., a regional manager reallocating stock weekly from a stale spreadsheet — and the metric that would show improvement",
        "Benchmark competitor dashboards to match their feature set",
        "Propose a real-time dashboard because real-time is strictly better than batch"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the real problem is a specific decision, made slowly or badly, by a specific person.</strong> 'Dashboard' is a stated solution; the diagnostic move is to find the decision underneath it (where to move inventory), the actor (the regional manager), the current failure (acting on week-stale data), and the metric that would prove improvement. That reframing might still land on a dashboard, or on something else entirely — a ranked reallocation recommendation, for instance.</p><p>Cataloguing the desired charts is pure order-taking. Benchmarking competitors imports someone else's solution to a problem you have not diagnosed. Assuming real-time is better prematurely commits to an architecture and cost profile before you know whether staleness is even the bottleneck.</p>"
    },
    {
      q: "New FDEs are often surprised that roughly 30-40% of the week is conversational discovery rather than coding. How should this time be understood?",
      options: [
        "It is unavoidable overhead that reduces time for the real engineering work",
        "It is core engineering: it produces the real problem, the data-and-system reality, and the success metric, which are the inputs that determine whether the code solves anything",
        "It is a sales function that should be handed back to the account executive",
        "It is only needed in week one and disappears once building begins"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: discovery is engineering, and its outputs are engineering inputs.</strong> The three artifacts it produces (real problem, true data shape, success metric) determine whether your code matters. Miss any one and you can write flawless software that solves the wrong problem, chokes on the real data, or ships with no way to tell if it worked.</p><p>Framing it as overhead is precisely the mindset that produces technically excellent solutions to the wrong problem. It is not a sales handoff — the diagnosis and the engineering are inseparable, which is why the FDE owns it. And it is continuous, not a first-week phase: the real problem keeps clarifying as your shipped slices push against reality.</p>"
    },
    {
      q: "You are running a discovery interview with a claims-processing team to understand their real workflow. Which two questions are highest-yield for surfacing the truth? (Select 2)",
      options: [
        "Walk me through the last time you processed a claim that gave you trouble",
        "What happens when a claim comes in that does not fit the normal process?",
        "Wouldn't it be great if an AI just handled the routing for you?",
        "Is your documented process well maintained and up to date?",
        "On a scale of one to ten, how satisfied are you with the current tools?"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>Correct: the recent-specific-episode question and the failure-mode question.</strong> 'Walk me through the last time' queries episodic memory and drags the workarounds and phone calls into view that a generalized description sands off. 'What happens when it goes wrong' surfaces the edge cases where the real difficulty and the real requirements live — the happy path is a fraction of the work.</p><p>The 'wouldn't it be great if' question is leading: it smuggles your hypothesis in and earns a polite yes that confirms nothing. Asking whether the documentation is up to date invites a self-flattering answer and, worse, presumes the doc is where truth lives — it is not; the operators' hands are. A satisfaction score is a symptom number with no diagnostic content about the actual workflow.</p>"
    },
    {
      q: "In week five of a claims-automation pilot, a compliance officer who was never part of discovery surfaces at a steering review and forbids the deployment model because it sends data to an external endpoint, violating data-residency policy. What does this failure most directly illustrate?",
      options: [
        "Compliance teams are obstructionist and should be routed around",
        "The org chart is not the power map: veto-holders like security and compliance must be identified in week one and their constraints treated as design inputs, not late surprises",
        "The architecture was fundamentally flawed and should have used a different model",
        "The sponsor failed to do their job of clearing internal approvals"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: unmapped veto-holders are the classic late-stage killer.</strong> Security and compliance hold a hard veto on the whole engagement, and a residency constraint discovered in week five is a scoping input that arrived too late — a VPC or in-region deployment would have been fine as a day-one constraint but is a timeline-blower as a retrofit. The discipline is to enumerate every veto-holder in week one and treat their constraints as inputs.</p><p>Routing around compliance is how you get shut down harder — they are a stakeholder to discover, not an obstacle to evade. The model choice was not the problem; the deployment topology was, and that is a discovery miss. Blaming the sponsor abdicates the FDE's own responsibility to map the political and regulatory terrain.</p>"
    },
    {
      q: "The customer's documented process diagram says claims are entered into a structured intake system. Shadowing an operator, you watch them actually track everything in a shared spreadsheet and only enter records into the official system days later when they have time. What should you do?",
      options: [
        "Build to the documented process since it is the official system of record",
        "Model the real workflow you observed — the spreadsheet is the true system of record and the days-late entry is a critical fact — because ground truth is the requirement, not the diagram",
        "Report the operators for not following the official process",
        "Ignore the discrepancy since it does not affect the AI model's accuracy"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the real process is the requirement; the documented one is aspirational fiction.</strong> The gap between the diagram and the shadow workflow is exactly where your requirements live. The spreadsheet is the true system of record and the multi-day lag is a data-freshness fact that will break any tool built on the assumption that the official system is current.</p><p>Building to the documented process ships a tool for a workflow nobody runs — the number-one adoption failure. Reporting the operators poisons your relationship with the people who hold the real ground truth and will use (or reject) your tool. The discrepancy absolutely affects the system: stale, out-of-band data is a core integration and freshness problem, not a cosmetic detail.</p>"
    },
    {
      q: "In an ambiguous case-study interview, a candidate hears the vague problem prompt and within two minutes sketches a full RAG-plus-agent architecture on the whiteboard. Why does this typically fail the round?",
      options: [
        "The architecture was technically incorrect for the problem",
        "It is solutioning — jumping to a solution before scoping, which is the number-one rejection reason; the round rewards clarifying who, what decision, and what success means before proposing anything",
        "The candidate should have proposed a fine-tuned model instead of RAG",
        "Whiteboard diagrams are not allowed in the case-study round"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: solutioning before scoping is the signature case-study failure.</strong> The round deliberately hands you a vague problem to see whether you clarify before you solve. Interviewers watch for the minute mark at which you commit to an architecture; the winning discipline is to ban yourself from proposing for the first several minutes and instead ask who the user is, what decision is made today and how, what 'good' means, and where the data lives.</p><p>The failure is not that the specific architecture was wrong — it is that any architecture proposed before diagnosis is a guess. RAG-versus-fine-tuning is a downstream detail that only matters once the problem is scoped. And whiteboards are fine; committing to a design on one before understanding the problem is what sinks you.</p>"
    },
    {
      q: "You are three weeks into a deployment and realize you have only interviewed the director of operations and two team leads. Which two are the strongest reasons to go shadow the frontline operators before continuing? (Select 2)",
      options: [
        "Managers describe the process as designed and believe it runs that way, while operators run the real, mutated workflow",
        "Operators often depend on undocumented shadow tools (a shared spreadsheet, a Slack channel) that are the true system of record",
        "Operators have the authority to approve the project budget",
        "Managers are usually deliberately lying about how the process works",
        "Interviewing more people always improves a project regardless of who they are"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>Correct: managers describe a fiction sincerely, and operators run on shadow infrastructure.</strong> The most common damaging discovery error is interviewing only the people who do not do the work. Managers describe the process from the training manual they believe in; the operators' real workflow has mutated through reorgs and system migrations and now hinges on undocumented tools the manager may not even know exist. Both are reasons the frontline is your ground truth.</p><p>Operators typically do not hold the budget — pain and power are decoupled, which is a reason to map both, not a reason to shadow. Managers are not lying; they sincerely believe the documented process, which is exactly what makes the error so easy to make. And more interviews are not indiscriminately better — talking to the right people (the doers) is what matters, not raw volume.</p>"
    },
    {
      q: "During data discovery, the customer assures you a key field is 'always populated.' What is the most reliable way to establish the truth?",
      options: [
        "Trust the customer, since they know their own data best",
        "Request a real sample export in week one and profile it yourself — count nulls, distinct values, and timestamp ranges to see actual quality and freshness",
        "Wait until production data access is granted in the delivery phase and check then",
        "Assume the field is usable and add a validation step later if problems appear"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: pull a real sample and profile it yourself.</strong> The field the customer swears is always populated is frequently 60-80% null or filled with a drifted free-text convention. Requesting the sample in week one does double duty: it reveals the real quality and, if they cannot easily produce it, it reveals that data access is not actually solved. Profiling (null rates, distinct values, timestamp ranges) turns 'we have the data' into an inventory you can plan against.</p><p>Trusting the customer's description is how the schema-versus-scanned-fax surprise detonates in week five. Waiting for production access wastes the entire scoping window during which you could have caught it — and a redacted sample needs no production access. Assuming usability and patching later means discovering the longest-pole integration problem at the worst possible time.</p>"
    },
    {
      q: "A pilot is built and championed by a single enthusiastic sponsor. Midway through the deployment, that sponsor leaves the company. What risk does this expose, and what should discovery have done to reduce it?",
      options: [
        "No real risk; the software works regardless of who sponsored it",
        "Single-threaded sponsorship is fragile; discovery should have mapped a broader coalition of stakeholders and cultivated more than one champion so the project survives a departure",
        "The correct response is to immediately pause all work until a new sponsor is assigned",
        "The FDE should take over the sponsor's role personally"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: a project threaded through one person dies when that person leaves.</strong> Champions and sponsors are assets you cultivate deliberately, and relying on exactly one is a mapped, avoidable risk. Discovery should have identified the full stakeholder set — other people with the pain, other budget-influencers, potential backup champions — so the coalition survives a departure and the go/no-go decision still has an owner.</p><p>'The software works regardless' ignores that adoption and renewal are political, not just technical — an unsponsored pilot becomes shelfware. Pausing all work cedes momentum and signals fragility. The FDE cannot self-appoint as sponsor; you are a guest without budget authority, and your job is to rebuild the coalition, not to impersonate it.</p>"
    },
    {
      q: "In a discovery interview, an engineer asks the operator: 'Wouldn't it save you a lot of time if the system auto-filled the form for you?' Why is this a discovery anti-pattern?",
      options: [
        "It is too informal for a professional setting",
        "It is a leading question that smuggles the interviewer's hypothesis into the answer and earns a polite yes that confirms nothing about the real workflow or bottleneck",
        "It reveals confidential product plans to the customer prematurely",
        "Auto-filling forms is never a useful feature"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: it is a leading question.</strong> It presupposes both the bottleneck (form-filling) and the solution (auto-fill) and invites agreement, so you get a yes regardless of truth. The open alternative ('what do you do after the form comes in?') lets the real workflow emerge, including the strong possibility that form-filling is not the bottleneck at all. Ask how they do it today before floating how it could work.</p><p>Informality is irrelevant; a warm, casual register is often good. Nothing confidential is being disclosed. And auto-fill may well be useful — the flaw is not the feature, it is proving its value by asking a question engineered to confirm it rather than discovering whether it addresses the real pain.</p>"
    },
    {
      q: "You have finished diagnosing a customer's problem. Which statement of it indicates you have actually reached the real problem rather than a symptom or a wish?",
      options: [
        "Improve operational efficiency across the claims department using AI",
        "Reduce the claims clerk's per-email routing time from 90 seconds to under 10 and cut mis-routes below 3 percent",
        "Deploy a state-of-the-art large language model to modernize the workflow",
        "Increase customer satisfaction with the claims process"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: a real problem names a person, a decision, a current state, and an implied metric.</strong> 'Reduce the clerk's routing time from 90 to 10 seconds and cut mis-routes below 3%' identifies the actor (the clerk), the decision (who handles this email), the current failure, and a measurable target. You can build against it and, crucially, tell whether you won — which is what makes it a success metric, not a slogan.</p><p>'Improve operational efficiency with AI' is a wish with no actor and no number; it cannot be built or measured. 'Deploy a state-of-the-art LLM' is a solution masquerading as a goal. 'Increase customer satisfaction' is a lagging symptom several steps removed from any specific decision you could instrument — none of the three survives the 'name a person and a number' test.</p>"
    },
    {
      q: "You are asked in a system-design round to 'design a RAG system over 50 million documents for a HIPAA healthcare customer.' What is the strongest way to open your answer?",
      options: [
        "Immediately draw the retrieval architecture: chunker, embedding model, vector store, reranker, and generator",
        "Open with discovery questions: what systems hold the documents, in what formats and real quality, how and how quickly can we get access, what are the residency and compliance constraints, and what does the data look like when it is wrong",
        "Recommend the largest available context window so no retrieval is needed",
        "State that 50 million documents is infeasible and propose reducing the scope"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: lead with the data-and-integration reality, because that is where the project is won or lost.</strong> The model is the easy part; the adapter layer and data access are the longest poles. Opening with what systems hold the documents, their real formats and quality, the access and provisioning timeline, and the HIPAA residency and compliance constraints signals you have been onsite and know the failure surface. It also shapes the architecture that follows.</p><p>Jumping straight to chunker-and-vector-store is the junior box-drawing move that ignores the constraints that will actually determine feasibility. A giant context window does not solve access, residency, quality, or cost at 50M documents. Declaring it infeasible without discovery is a guess — the scale is routine if the data and integration realities cooperate, which is exactly what your questions establish.</p>"
    }
  ],
  flashcards: [
    { front: "The three outputs of discovery", back: "<p>Discovery produces three engineering inputs: <strong>the real problem</strong> (the specific slow/broken decision), <strong>the data-and-system reality</strong> (where data lives, its true quality and freshness, the integration surface), and <strong>the success metric</strong> (the pre-agreed, measurable, owned definition of 'this worked'). Miss any one and the code solves the wrong thing, chokes on real data, or ships unmeasurable.</p>" },
    { front: "Why the SOW is not your spec", back: "<p>The signed statement of work is a <strong>hypothesis generated to close a deal</strong>, built from conversations with buyers a floor above the real work and compressed through three encoders (AE, SE, lawyer) tuned for persuasion, not accuracy. Discovery is decompression: reconstruct the real operation from primary sources — operators, data, systems — instead of trusting the artifact.</p>" },
    { front: "How much of the FDE week is discovery, and is it a phase?", back: "<p>Roughly <strong>30-40%</strong>, sustained across every week — not a front-loaded phase. Because 'ship on day one' makes each prototype a discovery instrument, discovery and delivery interleave: scope, ship a slice, watch it be instructively wrong, re-scope. The real problem keeps clarifying as reality pushes back.</p>" },
    { front: "The core reframe: stated problem to real problem", back: "<p>The real problem is almost always <strong>a specific decision or action, made slowly or badly, by a specific person.</strong> Customers hand you a solution ('we want a chatbot') or a symptom ('the team is drowning'); diagnose the concrete human, moment, and failure underneath before building.</p>" },
    { front: "Why customers speak in solutions", back: "<p>Not stupidity — rational reasons: they have pre-solved the pain, procurement forced a spec, a competitor shipped 'a chatbot,' and a named solution is politically safer to champion than admitting a broken process. Hear the stated solution as data about how they think, never as the requirement.</p>" },
    { front: "The enterprise 'why' ladder, tuned", back: "<p>The Five Whys transfers but needs three fixes: <strong>expect the chain to fork by stakeholder</strong> (VP bottoms out at revenue, operator at a broken tool — build the graph); <strong>ladder toward the decision, not toward blame</strong>; and <strong>stop at the altitude you can actually change</strong> inside the contract.</p>" },
    { front: "Test that you have found the real problem", back: "<p>You can state it as a <strong>measurable delta on a named person's day</strong>: 'cut the clerk's routing time from 90s to under 10s and mis-routes below 3%.' If your problem statement has no person and no number, you are still holding a symptom or a wish.</p>" },
    { front: "The #1 case-study rejection reason", back: "<p><strong>Solutioning</strong> — jumping to a solution before scoping. Interviewers watch the minute mark at which you commit to an architecture. Counter-discipline: for the first several minutes, ban yourself from proposing; ask who, what decision, how today, what 'good' means, who decides.</p>" },
    { front: "Diagnose to verify, not to contradict", back: "<p>Sometimes the customer's stated solution is right. Reflexively contradicting every customer fails as 'contrarian who does not listen.' The move is: <strong>validate the problem behind the solution before committing to build it</strong> — validation sometimes confirms, more often reframes.</p>" },
    { front: "Pain versus power are decoupled", back: "<p>The person who feels the pain daily (your ground-truth source and best early adopter) usually has <strong>no budget and no authority</strong>. Map both: who has the pain, who holds the budget, and who can veto — they are typically three different people.</p>" },
    { front: "The veto-holders engineers under-map", back: "<p><strong>Security, compliance, IT, and threatened middle managers.</strong> A security officer absent from kickoff can forbid your deployment model in one week-five email; a manager who reads the tool as a headcount threat can quietly starve it. Vetoes are cheap to exercise and catastrophic to discover late — enumerate them in week one and treat their constraints as design inputs.</p>" },
    { front: "The champion", back: "<p>Your inside advocate — no formal authority but influence, context, and hallway access. Explains the politics, gets you the meeting, sells the work when you are absent. You cannot deploy without one; part of discovery is finding a potential champion and deliberately making them look good, because their credibility carries your software to production.</p>" },
    { front: "Power/interest over RACI", back: "<p>RACI captures authority and misses <strong>influence</strong>, which moves deployments. Manage high-power/high-interest closely; keep high-power/low-interest satisfied and un-surprised (surprise a bored exec and they veto reflexively); enlist low-power/high-interest operators as champions and pilot users. Failure mode: spending all capital on friendly operators who cannot say yes.</p>" },
    { front: "Documented process versus real process", back: "<p>The official diagram is aspirational fiction frozen at last-drawing. The real process runs on <strong>shadow infrastructure</strong>: the spreadsheet that actually schedules shifts, the Slack channel where approvals happen, the veteran everyone calls. The gap is where your requirements live — find it by shadowing operators, not reading the wiki.</p>" },
    { front: "What to interrogate about the data", back: "<p><strong>Location/fragmentation</strong> (usually a dozen systems — ERP, CRM, CSVs, a laptop spreadsheet), <strong>quality</strong> (pull a sample, count the nulls — 'always populated' is often 60-80% empty), <strong>freshness/latency</strong> ('real-time' is often nightly batch), and <strong>ownership/provenance</strong> (who owns each field, who grants access — provisioning can outlast the build).</p>" },
    { front: "The adapter layer is the longest pole", back: "<p>Integration between LLM-native tooling and legacy data is the longest timeline item. Each additional source (undocumented REST, SOAP, flat-file, on-prem DB behind a jump host, SSO and service-account provisioning) adds <strong>weeks, not days</strong>. Assume real data access is a multi-week procurement item and scope around it — never assume 'we'll get the data next week.'</p>" },
    { front: "Why prototype on synthetic data first", back: "<p>The three-phase shape withholds real data access until delivery and prototypes on <strong>synthetic data</strong> in scoping — because you can validate the problem and interaction model without waiting on a six-week security review to grant a read-only credential. A redacted sample plus a whiteboard gets you ~80% of the data map.</p>" },
    { front: "The single highest-yield discovery question", back: "<p><strong>'Walk me through the last time you did X.'</strong> It queries episodic memory (an actual event, mess intact) instead of semantic memory (a normalized schema with exceptions averaged out). The generalized account is where workarounds disappear; the specific episode is where they resurface. 'Show me' beats even that by recruiting procedural memory.</p>" },
    { front: "'What happens when it goes wrong?'", back: "<p>The happy path is ~20% of the value and ~5% of the difficulty; the edge cases — malformed input, the exception, the 2 a.m. failure — are where the real work and requirements live. Nobody volunteers failure modes, so ask for them explicitly, and capture the workflow <strong>as-is</strong>, warts included, not as the customer wishes it ran.</p>" },
    { front: "The four discovery interview anti-patterns", back: "<p><strong>Order-taking</strong> (transcribing a feature list as if it were requirements), <strong>solution-first</strong> (running the interview to confirm the architecture in your head), <strong>happy-path assumption</strong> (scoping only the normal case), and <strong>interviewing managers not doers</strong> (faithfully capturing a fiction because you never watched the people whose hands are on the work).</p>" }
  ],
  lab: {
    title: "Lab: run a structured mock discovery and produce the four artifacts",
    html: `
<p><strong>Goal:</strong> practice the full discovery motion end to end and produce the four artifacts a real engagement demands — a stakeholder map, an as-is current-workflow document, a diagnosed real-problem statement, and a data-reality inventory — for one chosen domain. Discovery is a muscle you build by reps, and this rep forces every discipline from the module: reframing a stated solution, mapping power versus authority, separating documented process from ground truth, and asking questions that surface the truth. Zero cost, no cloud, no API keys — a scratch folder, a text editor, and a willingness to role-play both sides honestly.</p>

<h3>Architecture</h3>
<p>You will pick a domain and a deliberately solution-shaped stated ask, then run a self-directed discovery pass against it, writing four short artifacts into a throwaway local folder. Where you would normally interview a real operator, you role-play the customer as realistically as you can (or, better, recruit a friend who knows the domain to answer as the operator). The point is not fictional polish; it is exercising the diagnostic sequence so it is automatic when a real customer is in front of you.</p>

<h3>Steps</h3>
<ol>
<li><strong>Set up a scratch workspace and pick a domain.</strong> Choose a domain you can reason about concretely (support ticketing, insurance claims, logistics dispatch, loan underwriting, clinical intake). Write down a stated ask phrased as a solution, exactly how a customer would say it.
<pre><code>mkdir -p ~/fde-discovery &amp;&amp; cd ~/fde-discovery
touch stakeholders.md workflow.md problem.md data-inventory.md
echo "STATED ASK: 'We want an AI chatbot so our support agents stop escalating.'" &gt; problem.md</code></pre></li>
<li><strong>Draft the stakeholder map</strong> in <code>stakeholders.md</code>. List, for the domain, who has the pain, who holds the budget, and who can veto — as distinct people. For each, capture role, what they control, what they fear, and their power-versus-interest quadrant. Explicitly name at least one veto-holder (security, compliance, IT, or a threatened manager) and one potential champion.
<pre><code># stakeholders.md
| Person / role        | Controls              | Fears                     | Power/Interest | Notes            |
|----------------------|-----------------------|---------------------------|----------------|------------------|
| VP Support (sponsor) | budget, mandate       | a visible public failure  | high / medium  | economic sponsor |
| Senior agent (doer)  | real workflow, adoption| being automated away      | low / high     | champion candidate|
| InfoSec officer      | deployment model, veto| a PII leak on their record| high / low     | MAP IN WEEK 1    |</code></pre></li>
<li><strong>Capture the current workflow as-is</strong> in <code>workflow.md</code>. Role-play the operator and narrate the answer to "walk me through the last time you did this," including the messy parts. Then explicitly write the failure path: "what happens when it goes wrong?" Mark every step that relies on a shadow tool (a spreadsheet, a Slack channel, a phone call) — those are the requirements the documented process hides.</li>
<li><strong>Run the "why" ladder to a real-problem statement</strong> in <code>problem.md</code>. Starting from the stated ask, ask "why" toward the decision (not toward blame) until you can name the specific decision, the specific person, the current failure, and an implied metric. Write the final statement so it passes the test: it must contain a person and a number.
<pre><code># problem.md (target shape)
STATED ASK: "We want an AI chatbot..."
REAL PROBLEM: "A support agent spends ~8 min/ticket hunting across 4 wikis
for the right policy and answers inconsistently; the decision 'what is the
correct answer for this customer' is made slowly and unreliably."
SUCCESS METRIC: "median time-to-correct-answer under 90s; answer-consistency
audited at >95% agreement; owned by VP Support, checked at week-6 go/no-go."</code></pre></li>
<li><strong>Build the data-reality inventory</strong> in <code>data-inventory.md</code>. For each data source the solution would need, record: where it lives, format, realistic quality (estimate null rates and drift), freshness/latency (real-time or batch), owner, and how you would get access and how long that likely takes. Flag the longest-pole integration and note which sources you would ask for a sample export of in week one.</li>
<li><strong>Self-critique against the anti-patterns.</strong> Re-read all four artifacts and check honestly: did you order-take (a feature list instead of a diagnosis)? Did you assume the happy path? Did you only "interview" a manager-level view instead of the doer's? Did any interview question you imagined lead the witness? Fix at least one instance of each you find.</li>
</ol>

<h3>Verify</h3>
<ul>
<li>Your real-problem statement names a specific person, a specific decision, a current failure, and a number — and it is visibly different from the stated ask you started with.</li>
<li>Your stakeholder map distinguishes pain, budget, and veto as separate people, and names at least one veto-holder and one champion candidate.</li>
<li>Your workflow doc includes at least one shadow tool and an explicit failure path, not just the happy path.</li>
<li>Your data inventory identifies the longest-pole integration and states an access timeline in weeks, not "next week."</li>
</ul>

<h3>Teardown</h3>
<p>This exercise has no cloud footprint and costs nothing, but keep clean-handling habits sharp. If a friend role-played a real operator or you sketched a real employer's process, treat those notes as you would customer-confidential material. Remove the scratch workspace when done so stale, half-fictional notes do not later mislead you:</p>
<pre><code>cd ~ &amp;&amp; rm -rf ~/fde-discovery      # delete the scratch folder and all four artifacts</code></pre>
<p>If you want to keep a polished artifact as a portfolio sample, move only the finished real-problem statement somewhere permanent first, then delete the rest. If any notes captured a real person's account of their real workflow, remove those specifically — practicing disciplined disposal of other people's information is itself part of the FDE craft.</p>
`
  }
});
