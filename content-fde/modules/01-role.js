/* Module 01 — The Role: Engineer-Diplomat (The Craft track) */
window.COURSE.register({
  id: "role",
  order: 1,
  track: "craft",
  title: "The Role: Engineer-Diplomat",
  description: "What a Forward Deployed Engineer actually is, where the role came from, and why it became the hottest job in AI. The taxonomy that separates an FDE from a sales engineer, a solutions engineer, a consultant, and a plain SWE — the mindset that makes one work, and the career it opens.",
  examWeight: "Every FDE loop opens with 'why FDE, not SWE?' — a question that screens out anyone who thinks it is 'consulting but technical' or 'sales engineering with more code.' This module gives you the crisp taxonomy, the origin story, and the mindset vocabulary that interviewers listen for, plus the market context that tells you which companies are hiring and why.",
  lessons: [
    {
      id: "what-is-an-fde",
      title: "What a Forward Deployed Engineer actually is",
      html: `
<p>A Forward Deployed Engineer is a production software engineer who embeds inside a customer's environment and is personally accountable for turning a signed contract into working software that delivers the outcome the customer was promised. Strip away the mystique and two words carry the whole definition: <strong>embedded</strong> (you work on the customer's site, their data, their infrastructure, their politics — not from your own HQ building an offline MVP) and <strong>accountable</strong> (you own whether it actually works in their live operation, not whether you shipped a deliverable that matches a statement of work). Everything else — the travel, the diplomacy, the AI stack — is a consequence of those two words.</p>

<p>The role was invented at <strong>Palantir</strong> in the mid-2000s, where the early embedded engineers were internally called <strong>"Deltas."</strong> Until roughly 2016 Palantir employed more Deltas than it did conventional "Devs," and the distinction they drew is still the sharpest one-line articulation of the job:</p>

<table>
<thead><tr><th></th><th>Dev (product engineer)</th><th>Delta / FDE</th></tr></thead>
<tbody>
<tr><td>Focus</td><td><strong>One capability, many customers</strong></td><td><strong>One customer, many capabilities</strong></td></tr>
<tr><td>Optimizes for</td><td>Generalization — the feature that works for everyone</td><td>Specific outcome — this customer's problem, solved</td></tr>
<tr><td>Success looks like</td><td>A capability shipped to the platform</td><td>A workflow running in the customer's production</td></tr>
<tr><td>Lives</td><td>In the codebase</td><td>In the customer's operation, feeding the codebase</td></tr>
</tbody>
</table>

<p>A product engineer builds the loom; the FDE weaves one customer's specific cloth on it, and reports back which threads keep snapping. That feedback loop — FDE as the highest-bandwidth product-management input the company has — is not a side effect of the role, it is half its economic justification, and we return to it repeatedly.</p>

<h3>Ship on day one</h3>
<p>The cultural core of the role, and the phrase you will hear in every FDE org that copied Palantir, is <strong>"ship on day one."</strong> A management consultant runs a 90-day discovery and hands you a deck. A traditional solutions engineer gives a demo and hands you off to support. An FDE writes production software in the first week of the engagement — a working data transform, a live dashboard, a grounded prototype the customer can click — before anyone has written a requirements document. The deliverable is running code, not an implementation roadmap. This is not machismo; it is a deliberate strategy to collapse the feedback loop, because the fastest way to discover that the customer's description of their problem is wrong is to put working software in front of them and watch their face.</p>

<div class="callout deep">Why "ship on day one" is mechanically possible now in a way it was not for classic enterprise software: the modern FDE stack (LLM APIs, managed vector stores, cloud data warehouses, notebook-to-app tooling) has a near-zero cold-start. You can stand up a grounded prototype against synthetic data in an afternoon. The scarce resource is no longer engineering time to build the first version — it is the judgment to build the <em>right</em> thin slice, and access to the customer's real data and stakeholders. That inversion is exactly why the role's value shifted from "can you build it" to "can you figure out what to build while embedded in someone else's mess."</div>

<h3>Own the whole data-to-decision loop</h3>
<p>An FDE is typically involved across the entire lifecycle: requirements analysis, design, implementation, systems integration, deployment, and adoption. There is no throwing it over a wall — no separate architect who designed it, integration team who wired it, and support team who runs it. The reason this end-to-end ownership is the job rather than an inefficiency is that in enterprise AI the failure almost never lives in one box; it lives in the seams between the customer's twelve source systems, the model's behavior on their specific data, and the operator who has to trust the output enough to act on it. Only someone who owns all the seams can close them.</p>

<div class="callout limits">Onsite expectation varies but is real: Palantir has historically expected roughly 25% onsite; some deployment-heavy startups run up to 50%. FDEs work in genuinely unconventional environments — factory floors, assembly lines, airgapped facilities, secure government sites — not just conference rooms. The role is not remote-first, and candidates who need fully-remote should know that going in.</div>

<div class="callout war">The single most common misunderstanding, held even by strong engineers considering the role: that an FDE is a fancy consultant who happens to code. The tell is the deliverable. A consultant is done when the recommendation is accepted; an FDE is done when the software is running in production and someone is using it to make a decision they previously made by hand. If your instinct when handed an ambiguous enterprise problem is to schedule three weeks of interviews and produce a findings document, you will fail as an FDE — and you will fail the interview, which is engineered specifically to detect that instinct.</div>

<div class="callout exam">"Why FDE and not a normal SWE role?" is the opening question of nearly every loop, and it is a filter. Weak answers: "I like variety," "it pays well," "consulting but I get to code." Strong answers reach for the substance of the role: you want to own outcomes end-to-end in the real world rather than ship a feature and never learn whether it mattered; you are energized by ambiguity and direct customer contact; you want the shortest possible loop between building something and seeing it change how someone works. If you can articulate the "one customer, many capabilities" framing and the ship-on-day-one philosophy unprompted, you have signaled that you actually understand the job.</div>
`
    },
    {
      id: "role-taxonomy",
      title: "The taxonomy: FDE vs sales engineer, solutions engineer, consultant, SWE",
      html: `
<p>The FDE title is new enough that it collides with five adjacent roles, and interviewers probe the boundaries deliberately because confusing them signals you do not understand what you are applying for. The cleanest mnemonic in circulation: <strong>a sales engineer helps you sign the contract; a solutions engineer helps you design what you signed; a forward deployed engineer makes it work in production.</strong> Hold that spine and add the detail.</p>

<table>
<thead><tr><th>Role</th><th>Where in the lifecycle</th><th>Primary deliverable</th><th>Code intensity</th></tr></thead>
<tbody>
<tr><td><strong>Sales / pre-sales engineer</strong></td><td>Pre-sale, inside the sales motion</td><td>A closed deal; technical objections removed</td><td>Low — demos, throwaway POCs</td></tr>
<tr><td><strong>Solutions engineer / architect</strong></td><td>Late pre-sale into early onboarding</td><td>A design, an integration plan, a first-use config</td><td>Medium — offline MVPs, rarely on customer infra</td></tr>
<tr><td><strong>Forward deployed engineer</strong></td><td>Post-sale, through production and adoption</td><td>Production software running in the customer's operation</td><td>High — majority of the week writing shipped code</td></tr>
<tr><td><strong>Management / tech consultant</strong></td><td>Any; engagement-scoped</td><td>Recommendations, a findings deck, staff-augmentation hours</td><td>Variable, often low; one-off</td></tr>
<tr><td><strong>Product SWE</strong></td><td>Continuous, internal</td><td>A platform capability for all customers</td><td>High — but "one capability, many customers"</td></tr>
</tbody>
</table>

<h3>The two boundaries interviewers actually test</h3>
<p><strong>FDE vs solutions engineer</strong> is the boundary people blur most. The SE spans late pre-sale into early onboarding: they scope technical fit, design the integration, and build proofs of concept — often offline, on their own laptop, to prove the deal is viable. As OpenAI frames its own split: SEs "rarely write code on customers' infrastructure" and typically build offline MVPs, whereas FDEs "write code directly on customer infrastructure and use customer tooling." The FDE <em>picks up where the SE left off</em> and builds the production-grade thing inside the account. If the artifact lives on your laptop to win the deal, that is SE work; if it lives in the customer's VPC serving their operators, that is FDE work.</p>

<p><strong>FDE vs consultant</strong> is the boundary that protects the business model. Consultants make one-off recommendations and bill hours; the durable, dangerous version — what Palantir, Anthropic, and OpenAI all explicitly <em>refuse</em> to become — is "Accenture with better software": a staff-augmentation body shop selling undifferentiated hours. The FDE org sells customer-owned <strong>applications</strong> and outcomes, not warm bodies. This is why FDE compensation is typically aligned with the account team's success rather than an individual utilization or quota number, and why "we don't do pure staff-aug" is a value these orgs will state out loud.</p>

<div class="callout deep">Coding intensity is the most reliable quantitative discriminator across job postings. Analyses of large FDE-posting corpora find the "builder profile" dominates: descriptions consistently expect the majority of the work-week spent writing and shipping production code. When you read a posting titled "Forward Deployed Engineer" that on inspection is 80% demos, discovery calls, and no production code ownership, it is a sales-engineering or solutions-engineering role wearing the hot title to attract applicants — a real and common bait-and-switch worth catching before you interview.</div>

<h3>Why the distinctions are load-bearing, not pedantic</h3>
<p>The taxonomy matters for three concrete decisions. First, <strong>which role to target</strong>: if you love code and outcomes but hate quota pressure, FDE over SE; if you love the deal and the room but tolerate shallow builds, SE over FDE. Second, <strong>how to read a posting</strong>: the title lies often enough that you must verify code intensity, onsite expectation, and whether you own production or hand off. Third, <strong>how to interview</strong>: the FDE loop weights an ambiguous case study and a client role-play precisely because those test the post-sale, production-ownership, diplomacy-under-fire dimensions that distinguish the role — study the wrong role and you prepare for the wrong loop.</p>

<div class="callout war">A senior backend engineer took an "FDE" offer at a startup that turned out to be pre-sales in disguise: the real job was two demos a day and a POC that a "real" engineering team would later rebuild. Six months of no code ownership and no production accountability later, they left. The failure was upstream, at role-reading: the posting said "forward deployed" but the interview loop had no case study, no take-home build, and no production-design round — three tells that the org had not actually adopted the FDE model, only its recruiting keyword.</div>

<div class="callout exam">Expect a direct discriminator question: "How is this different from a solutions engineer / sales engineer / consultant?" A crisp answer walks the lifecycle (sign → design → make-it-work-in-production), names code intensity and production ownership as the FDE markers, and adds the business-model point that a serious FDE org refuses to be a staff-aug body shop. Bonus signal: note that titles are unreliable and that you would verify the real role by asking what fraction of the week is production code and whether the FDE owns the deployment or hands it off.</div>
`
    },
    {
      id: "why-now-ai",
      title: "Why now: the AI incarnation and the 95% problem",
      html: `
<p>The role is fifteen years old, but job postings for it jumped more than <strong>800% between January and September 2025</strong>, and the reason is specific rather than general hype. Frontier AI has a deployment problem so severe that the labs concluded they cannot solve it with product alone — they have to send engineers into the field. The stat that organizes the entire modern FDE thesis comes from a 2025 MIT report: roughly <strong>95% of enterprise generative-AI pilots showed no measurable P&amp;L impact</strong>, and the researchers traced the failure not to weak models but to <strong>flawed integration</strong> — the models were fine; the connection to the business was not.</p>

<p>Read that carefully, because it is the whole business case for your role. The bottleneck in enterprise AI is not model capability; a frontier model out of the box is superhuman at the language task. The bottleneck is everything around the model: getting it access to the customer's real data through their brittle legacy systems, grounding it in their specific domain so it stops giving generic answers, proving to a risk-averse operator that it is trustworthy enough to act on, satisfying security and compliance, and getting humans to actually change their workflow to use it. Every one of those is field integration work, and every one is an FDE's job.</p>

<h3>How the labs organize it</h3>
<p>The pattern is remarkably consistent across companies, which is unsurprising given they all copied Palantir. OpenAI's head of FDE, Colin Jarvis, has described a three-phase deployment shape:</p>
<ul>
<li><strong>Phase 1 — Early scoping (days onsite):</strong> map the customer's processes, find where the value is, prototype against synthetic data. No real data access yet.</li>
<li><strong>Phase 2 — Validation (multi-week):</strong> build evals (the objective quality checks for an LLM application), scale up labeling, and optimize the model's behavior against the metrics you defined.</li>
<li><strong>Phase 3 — Delivery (recurring onsite weeks):</strong> get access to real customer data, build the real solution inside their environment, demo and iterate to production.</li>
</ul>
<p>Anthropic runs the same shape under a different name — the <strong>Applied AI Engineer</strong> embeds with customers for multi-week sprints, designs prompts and evals, ships agents into production, and runs the customer-discovery interviews that surface what enterprise buyers actually need. Both labs mandate a Claude- or GPT-grounded prototype in the <em>first</em> customer week; both treat conversational customer discovery as roughly 30–40% of the FDE's week and as core engineering work, not a separate sales function; both front-load domain modeling in week one; and both explicitly refuse the systems-integrator role.</p>

<div class="callout limits">Scale of the bet, as of early 2026: in May 2026 OpenAI stood up a dedicated "Deployment Company" with more than $4 billion in committed capital and a planned acquisition of a deployment-services firm; weeks earlier, Anthropic partnered with Blackstone, Hellman &amp; Friedman, and Goldman Sachs to build an AI-native enterprise-services firm around embedded engineering teams. When frontier labs commit billions to <em>services</em>, they are betting that deployment — not the next model checkpoint — is the binding constraint on revenue.</div>

<h3>Services as software</h3>
<p>The framing that ties it together is <strong>"services as software."</strong> The old software model sold a tool and left implementation to the customer or a systems integrator. The AI model is different because, in the strong version of the thesis, "software is no longer aiding the worker — software <em>is</em> the worker": you are not selling a spreadsheet, you are selling an agent that does a job, and an agent that does a job needs the same onboarding, context, and supervision a new hire would. That onboarding is FDE work, and it does not commoditize, because "much of the product differentiation comes from how the same underlying technology is implemented and applied differently across customer sets." The implementation <em>is</em> the product differentiation — which is exactly why the labs will pay staff-engineer compensation to do it in the field rather than outsource it.</p>

<div class="callout war">A concrete instance of the 95% problem, inverted into a win: OpenAI FDEs worked with John Deere to scale "personalized farmer interventions" — automating insights that had previously required manual phone calls to individual farmers. The team went to Iowa, worked directly with farmers to understand the real workflow, and delivered inside a single growing season's window. Notice what made it succeed: not a better model, but engineers physically present, understanding a domain (agriculture) they did not start in, and building against the operational reality (the growing-season deadline, the farmers' actual decision process) rather than a whiteboard abstraction.</div>

<div class="callout exam">Interviewers want to know you understand <em>why the role exists right now</em>, because it predicts whether you will focus on the right things once hired. If asked "why are AI companies hiring FDEs?", the answer is the 95% integration-failure gap, not "AI is exciting." Name the mechanism: models are capable, integration is the bottleneck, and the bottleneck can only be closed by embedded engineers who own data access, grounding, evals, security, and adoption. Candidates who cite the MIT-style pilot-failure framing and the services-as-software thesis signal that they have thought about the economics of their own job — a strong senior signal.</div>
`
    },
    {
      id: "engineer-diplomat",
      title: "The engineer-diplomat mindset",
      html: `
<p>Palantir's internal shorthand for the hire is the <strong>"engineer-diplomat,"</strong> and the hyphen is doing real work: the role fails if you are strong on only one side. The engineering side is table stakes — you need production-grade software skill, because the deliverable is production software. The diplomacy side is what most strong engineers underweight and what the interview loop is disproportionately built to test. Four traits define the mindset, and each has a specific field consequence and a specific interview tell.</p>

<h3>1. Agency over ambiguity</h3>
<p>The defining condition of the job is that you walk into a customer site with no statement of work, an ambiguous problem, contradictory stakeholders, and data that does not match anyone's description of it — and you produce value anyway. Colin Jarvis's framing of why FDEs are the right hire is exactly this: they "work in a ton of ambiguity, and often what the customer describes in scoping doesn't match the data/system reality on the ground." Agency means you treat the absence of a spec as normal and self-direct toward value, rather than freezing until someone tells you what to build. In the field this looks like shipping a thin slice in week one against synthetic data instead of waiting for data access. In the interview it looks like the ambiguous case study, where sitting silently or demanding the "right answer" is disqualifying and reasoning out loud toward a scoped plan is the whole point.</p>

<h3>2. The diagnostic instinct: the real problem behind the stated one</h3>
<p>Customers describe solutions and symptoms; the FDE's core cognitive move is to diagnose the underlying problem before building anything. "The customer wants a chatbot" is almost never the real requirement — the real requirement is usually a specific decision being made slowly or badly by a specific person, and a chatbot may or may not be the right instrument. The senior FDE sits with the customer, asks diagnostic questions, and often reframes the problem entirely before proposing a build. This is the single most transferable skill from great consulting, and it is why "jumps to a solution before scoping" is the most common case-study rejection reason.</p>

<h3>3. Ownership language and calibrated commitment</h3>
<p>Diplomacy is not about being agreeable; it is about being trustworthy under pressure. Two verbal habits mark the trait. <strong>Ownership language:</strong> "I'll have this to you by Friday," not "the team is working on it" — you personally own the outcome, and you say so. <strong>Calibrated commitment:</strong> you never overpromise, because the fastest way to destroy a deployment is to promise 100% accuracy to a VP and then miss it. The senior move when a customer asks for a guarantee you cannot give is to acknowledge the concern, explain the real shape of the trade-off, and offer options — not to say yes and pray. Interviewers test this directly in the client role-play ("explain to a non-technical VP why your RAG system can't guarantee 100% accuracy") and score whether you can hold the line honestly without either caving or being brittle.</p>

<h3>4. Curiosity, domain immersion, and conversational range</h3>
<p>You will parachute into domains you know nothing about — crop science, claims adjudication, semiconductor yield, special-operations logistics — and you have weeks to learn enough to model them credibly. The trait is genuine curiosity plus the humility to be taught by the customer's operators, who know their domain far better than you do. Coupled to it is <strong>conversational range</strong>: the same week you may need to extract requirements from a Navy warrant officer, debug a pipeline with a data engineer, and explain a trade-off to a Fortune 100 CEO — and adjust register for each without condescension or jargon-fog.</p>

<div class="callout deep">The dual mandate — serve this one customer while feeding generalizable signal back to the product — is a genuine, permanent tension, not a slogan. Every hour you spend hard-coding a one-off hack for Customer A is an hour not spent on a capability that would help A, B, and C. The mature FDE constantly asks "is this specific-to-this-customer, or is this a product gap I should push upstream?" and routes the work accordingly. Orgs that get this right treat FDE-surfaced product gaps as first-class roadmap input; FDEs who get it right resist the urge to become a bespoke agency of one and instead convert field pain into product leverage.</div>

<div class="callout war">A research agent built by a strong-but-junior FDE treated every web page it fetched as ground truth; one spam page asserted a fake product recall and the agent folded it into every subsequent plan. The engineering was fine; the missing trait was the diplomat's instinct that <em>sources have provenance and trust levels</em> — the same instinct that stops you from taking a single stakeholder's account of "the problem" as gospel. The mindset failures and the engineering failures rhyme: unearned trust in a single unverified input, whether it is a web page or a VP's problem statement, is the recurring root cause.</div>

<div class="callout exam">The behavioral and role-play rounds exist to test the diplomat half, and they are graded on verbal habits you can practice. Watch your language: use "I" ownership statements, ask diagnostic questions before proposing anything, acknowledge the customer's concern as valid <em>before</em> you push back, and offer options with explicit trade-offs rather than a single take-it-or-leave-it answer. Prepare 6–8 STAR stories that each foreground customer ownership, production accountability, and effectiveness in an unfamiliar environment — and rehearse them to 60–90 seconds spoken, because rambling is itself a negative signal in a role defined by communication.</div>
`
    },
    {
      id: "the-career",
      title: "The career: compensation, leveling, who thrives, and exits",
      html: `
<p>The FDE role is compensated like the scarce, high-leverage position it is, and understanding the economics of your own career helps you target the right companies and negotiate from knowledge rather than hope. As of early 2026, total compensation clusters high: OpenAI FDEs are reported around <strong>$350K–$550K</strong> total comp at mid-to-senior levels; Anthropic's range spans roughly <strong>$300K to $1.2M</strong> depending on level; the median fully-loaded annual cost of an FDE to the employer sits between roughly <strong>$220K and $400K</strong>, with top packages exceeding $900K. These numbers rival or exceed staff-level product-engineering compensation at the same companies — which is the point: the labs are signaling that field deployment is as valuable as core engineering, and they price it accordingly.</p>

<h3>Why they can pay it: the value you generate</h3>
<p>An FDE is not a cost center dressed up as engineering. At frontier labs, a productive FDE is associated with a revenue contribution on the order of <strong>$3–15M annually</strong> when serving large enterprise contracts — a multiple of several times the fully-loaded cost. The value comes from three compounding sources: <strong>time-to-value</strong> (you turn a stalled pilot into production revenue that would otherwise have churned), <strong>expansion</strong> (a working beachhead deployment lands the next five workflows — the land-and-expand motion that makes enterprise software lucrative), and <strong>product feedback</strong> (the field signal you route back improves the platform for every other customer). You are simultaneously a delivery engine, a growth engine, and a product sensor, which is why the comp math works.</p>

<div class="callout limits">Leveling maps roughly onto how much ambiguity and how many stakeholders you can absorb. Junior FDEs execute a scoped slice of a deployment under guidance. Senior FDEs own a full account end-to-end — discovery through adoption — and are trusted to say no to the customer. Staff/principal FDEs run multiple accounts or a domain, set deployment patterns others follow, and convert field learning into product and org changes. The axis is not raw coding skill (which saturates early) but judgment under ambiguity and diplomatic weight — the ability to be the trusted technical voice in a CTO's office.</div>

<h3>Who thrives, and who should not apply</h3>
<p>The archetype the best FDE orgs hire is the <strong>"curious hustler" with high agency</strong> — explicitly not necessarily a PhD, and explicitly not the pure-specialist who wants to go deep on one system in isolation. Thrivers share a profile: they have shipped things end-to-end and can point to outcomes, not just contributions; they are energized rather than paralyzed by undefined problems; they like people and direct customer contact; and they are comfortable being a generalist who goes deep on demand. People who should think twice: those who need a crisp spec to start, who find customer contact draining rather than energizing, who want to specialize narrowly, or who need fully-remote work — the role is genuinely travel-heavy and genuinely social, and no amount of technical brilliance compensates for hating those two facts.</p>

<div class="callout war">Burnout in the role is real and has a specific shape: the always-on customer relationship plus travel plus the dual mandate can grind you down if you never say no. The Palantir FDEs who lasted talk about ruthless prioritization as a survival skill — one described limiting meetings by constantly asking "does this discussion have to be a meeting, and do I have to be there?" The failure mode is becoming a bespoke agency of one who cannot scale, cannot take a vacation without the deployment stalling, and never converts one-off work into leverage. Longevity comes from building things that survive your absence (the adoption and handoff discipline) and from routing repeated pain into product rather than absorbing it personally.</div>

<h3>Exit paths and why the role is a career accelerant</h3>
<p>The role builds an unusually broad and valuable skill stack — production engineering, customer and executive communication, domain-hopping, business judgment, and deployment craft — which is why its exits are strong. Common paths: <strong>founder</strong> (you have seen dozens of real enterprise problems up close and know which are worth building a company around — FDE-to-founder is a well-worn track), <strong>product management or product leadership</strong> (you have been the highest-bandwidth product sensor in the company), <strong>sales-engineering or deployment leadership</strong> (you scale the motion you practiced), and <strong>staff/principal SWE</strong> (you return to the core with hard-won knowledge of how the product actually fails in the wild). The relationship and reputational capital compounds too: the CTOs you made successful remember you.</p>

<div class="callout deep">The most underrated long-term asset the role builds is <strong>pattern library across customers</strong>. A product engineer sees one system deeply; an FDE sees the same class of problem solved (and failed) across a dozen different enterprises, which is precisely the vantage point that produces good founders and good product leaders. This is the career-level version of the "one customer, many capabilities" framing: over years, you accumulate "many customers, one deep pattern-sense," and that pattern-sense is the thing markets pay the most for.</p></div>

<div class="callout exam">Comp and career questions surface in the recruiter screen and the closing conversation. Do not lead with money in early rounds — it reads as the wrong motivation for a mission-and-ownership role — but do know the ranges so you negotiate from data. When asked about your long-term goals, connecting the FDE role to a genuine trajectory (founder, product, deployment leadership) signals you understand what the role builds and are not treating it as a way station; that self-awareness is itself a positive signal, provided it is framed as "this role builds exactly the muscles I want," not "I'll do this until something better comes along."</div>
`
    }
  ],
  quiz: [
    {
      q: "A candidate is asked in a screen 'why forward deployed engineering rather than a standard software role?' Which answer best signals genuine understanding of the role?",
      options: [
        "It pays better than a normal SWE role and has more variety day to day",
        "I want to own outcomes end to end in a customer's real environment and get the shortest possible loop between building and seeing it change how someone works",
        "It is essentially consulting but I still get to write code, which suits me",
        "I want to specialize deeply in one system and become the expert on it"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: end-to-end outcome ownership plus the tight build-to-impact loop</strong> is the substance of the role and the reason it exists. It reaches for what distinguishes an FDE — production accountability in the customer's real world, not a feature shipped into a void.</p><p>Pay-and-variety is the classic weak answer that screens candidates out — it describes a job's perks, not its purpose. 'Consulting but with code' is the specific misconception interviewers listen for; the FDE deliverable is running production software, not a recommendation. And wanting to specialize narrowly is nearly the opposite of the generalist-who-goes-deep-on-demand profile the role requires.</p>"
    },
    {
      q: "Palantir distinguished its product engineers ('Devs') from its forward deployed engineers ('Deltas') with a memorable framing. What is it?",
      options: [
        "Devs write backend code and Deltas write frontend code",
        "Devs focus on one capability across many customers; Deltas focus on one customer across many capabilities",
        "Devs are senior and Deltas are junior versions of the same job",
        "Devs work remotely and Deltas work onsite, but the work is identical"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: 'one capability, many customers' vs 'one customer, many capabilities.'</strong> This is the sharpest one-line articulation of the FDE role: the product engineer generalizes a single capability for everyone, while the FDE solves everything for one specific customer and feeds the learning back.</p><p>The split is not frontend/backend, not seniority, and not merely location. Onsite presence is a consequence of the Delta focus, but the defining difference is the axis of optimization — generalization versus a specific customer's outcome — which drives everything else about how the two roles work.</p>"
    },
    {
      q: "An engineer evaluating two job offers wants to tell a real FDE role from a sales-engineering role wearing the FDE title. Which single signal is most diagnostic?",
      options: [
        "Whether the title on the offer letter literally says 'Forward Deployed Engineer'",
        "What fraction of the work-week is spent writing and owning production code on customer infrastructure versus running demos and throwaway POCs",
        "Whether the company is an AI company or a traditional enterprise",
        "The size of the equity grant relative to base salary"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: production-code intensity and ownership</strong> is the reliable discriminator. The builder profile — majority of the week shipping production code the FDE owns — separates the real role from pre-sales work; a role that is mostly demos and disposable POCs is sales or solutions engineering regardless of its title.</p><p>The title itself is unreliable and frequently used as recruiting bait. Whether the company is an AI startup or a bank does not determine the role's shape — both hire real FDEs and mislabeled SEs. Equity mix is a compensation-structure detail, not a signal of whether you will own production deployments.</p>"
    },
    {
      q: "A 2025 MIT report is frequently cited as the core justification for the FDE hiring surge. What did it find, and why does it matter for the role?",
      options: [
        "Frontier models were not yet capable enough for enterprise tasks, so more model research was needed",
        "About 95% of enterprise generative-AI pilots showed no measurable P&L impact, and the failure traced to flawed integration rather than weak models",
        "Enterprises were spending too much on AI and should cut budgets",
        "Open-source models had closed the gap with frontier models, commoditizing the market"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: ~95% of pilots showed no P&amp;L impact, and integration — not model quality — was the culprit.</strong> This is the entire business case for the FDE: the model works out of the box, but connecting it to the customer's data, domain, security, and workflow is where value is won or lost, and that work requires embedded engineers.</p><p>The finding was explicitly <em>not</em> that models were too weak — that would argue for more research, not more field engineers. It was not a story about overspending or about open-source commoditization. The precise claim (capability is fine, integration is the bottleneck) is what makes 'send engineers into the field' the rational response.</p>"
    },
    {
      q: "In the OpenAI/Anthropic deployment shape, roughly 30-40% of an FDE's week is spent on conversational customer discovery. How should this be understood?",
      options: [
        "It is overhead that reduces the time available for the real engineering work",
        "It is core engineering work — surfacing the real problem, data reality, and success criteria that determine whether anything you build will matter",
        "It is a sales activity that should be handed off to account executives",
        "It is only necessary in the first week and disappears once building starts"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: discovery is core FDE engineering, not overhead.</strong> What the customer says in scoping routinely fails to match the data and system reality on the ground; the conversations are how you find the real problem, the true data shape, and the success metric — inputs without which the code is likely to solve the wrong thing well.</p><p>Treating discovery as a tax on 'real' work is the mindset that produces technically excellent solutions to the wrong problem. It is not a sales handoff — the FDE org treats discovery as its own responsibility precisely because the engineering and the diagnosis are inseparable. And it is continuous, not a first-week phase; the real problem keeps clarifying as you ship.</p>"
    },
    {
      q: "A non-technical VP asks an FDE to 'guarantee 100% accuracy' from a RAG system before rollout. Which response best reflects the engineer-diplomat mindset?",
      options: [
        "Agree to the guarantee to keep the relationship positive, then hope the system performs",
        "Flatly refuse and explain that no ML system is ever 100% accurate, then move on",
        "Acknowledge the underlying concern about trust, explain the real shape of the accuracy/error trade-off in plain terms, and offer options such as human review on low-confidence cases with measured error bounds",
        "Escalate the request to your manager and wait for direction before responding"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>Correct: acknowledge the concern, explain the trade-off honestly, offer options with trade-offs.</strong> The VP's real need is trust and bounded risk, not a literal 100%. The diplomat move validates that need, replaces the impossible guarantee with a legible risk posture (measured error bounds, human-in-the-loop on low-confidence outputs), and preserves both honesty and the relationship.</p><p>Agreeing is the overpromise that destroys deployments when the miss inevitably arrives. Flatly refusing is technically correct but brittle — it wins the argument and loses the room by dismissing a legitimate concern. Punting to your manager abdicates the ownership that defines the role; the FDE is supposed to be the trusted technical voice in that conversation.</p>"
    },
    {
      q: "Why are FDE compensation packages at frontier labs (often $300K-$1.2M) justified from the employer's perspective?",
      options: [
        "FDEs are paid for prestige; the compensation is not tied to measurable value",
        "A productive FDE is associated with several times their fully-loaded cost in revenue contribution through time-to-value, expansion, and product feedback",
        "The pay is a temporary bubble unrelated to the value the role creates",
        "FDEs are paid more because the work requires less skill and must be incentivized"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the comp reflects a multiple of fully-loaded cost in revenue contribution.</strong> FDEs turn stalled pilots into production revenue (time-to-value), land the next workflows from a working beachhead (expansion), and feed the highest-bandwidth product signal in the company back to the platform — a productive one is associated with $3-15M in annual contribution against a fully-loaded cost typically well under half that.</p><p>It is not prestige pay or a bubble — the value chain is concrete and measurable. And it is emphatically not because the work is easy; the role demands both production engineering and diplomatic judgment under ambiguity, which is exactly why the labs price it like staff engineering.</p>"
    },
    {
      q: "An FDE keeps hard-coding customer-specific hacks to close each new gap, and after a year is a 'bespoke agency of one' whose deployments stall the moment they take vacation. Which discipline was missing?",
      options: [
        "Faster coding to keep up with the volume of requests",
        "Managing the dual mandate: routing recurring pain into product improvements and building deployments that survive the FDE's absence through adoption and handoff",
        "Refusing to do any customer-specific work at all",
        "Working longer hours to reduce the backlog"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the dual mandate and handoff discipline.</strong> The mature FDE constantly distinguishes 'this is specific to this customer' from 'this is a product gap I should push upstream,' converting repeated field pain into leverage rather than absorbing it as endless one-off work — and builds deployments that run without them via adoption and handoff.</p><p>Coding faster or working longer just scales the trap — more hacks, more personal dependency, faster burnout. Refusing all customer-specific work is the opposite failure; some specificity is the job. The skill is judgment about which work generalizes and disciplined handoff, not speed or absolutism.</p>"
    },
    {
      q: "Which candidate profile best matches what the strongest FDE organizations actually hire for?",
      options: [
        "A narrow specialist with a PhD who wants to go deep on a single system in isolation",
        "A curious high-agency generalist who has shipped things end to end, is energized by ambiguity and customer contact, and goes deep on demand",
        "A pure salesperson with light technical knowledge who is great in the room",
        "A back-office engineer who strongly prefers fully-remote work and minimal meetings"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the curious, high-agency generalist who ships end to end.</strong> FDE orgs explicitly hire 'curious hustlers' with high agency — not necessarily PhDs — who can operate without a spec, enjoy direct customer contact, and dive deep when a specific problem demands it.</p><p>The isolated narrow specialist is nearly the anti-profile: the role is generalist-first. A light-technical salesperson fails the production-code bar that defines the FDE. And someone who needs fully-remote, low-contact work is mismatched with a travel-heavy, deeply social role — technical strength does not compensate for disliking the two central conditions of the job.</p>"
    },
    {
      q: "What does the 'ship on day one' philosophy actually prescribe, and what is its underlying rationale?",
      options: [
        "Deliver a polished, fully production-hardened system on the first day of the engagement",
        "Put working software (a transform, a dashboard, a grounded prototype) in front of the customer in the first week to collapse the feedback loop and discover fast where their problem description is wrong",
        "Skip discovery entirely and start coding immediately without understanding the problem",
        "Write a thorough requirements document on day one before any code"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: get working software in front of the customer early to collapse the feedback loop.</strong> The fastest way to learn that a customer's description of their problem is wrong is to show them running code and watch their reaction. Ship-on-day-one is a deliberate strategy for surfacing reality quickly, not a demand for a finished product.</p><p>It is not about day-one production hardening — the first slice is thin and often throwaway. It is not skipping discovery — the prototype <em>is</em> a discovery instrument, tightly coupled to the conversations. And it is the explicit antithesis of requirements-doc theater, which is the consultant pattern FDEs are built to replace.</p>"
    },
    {
      q: "A serious FDE organization (Palantir, Anthropic, OpenAI) explicitly refuses to become 'Accenture with better software.' What does this mean and why does it matter?",
      options: [
        "They refuse to hire from consulting firms under any circumstances",
        "They sell customer-owned applications and outcomes rather than undifferentiated staff-augmentation hours, which protects the differentiation and the business model",
        "They never work onsite at customer facilities",
        "They only build fully generic products with no customization"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: outcomes and customer-owned applications, not staff-aug hours.</strong> The durable, dangerous version of the role is a body shop selling undifferentiated labor; serious FDE orgs refuse that because the differentiation lives in how the technology is implemented and applied, and a staff-aug motion commoditizes exactly that. This is why FDE comp aligns with account success rather than utilization or a personal quota.</p><p>It does not mean refusing to hire ex-consultants (diagnostic skill transfers well). It does not mean never working onsite — embedding is central. And it does not mean building only generic products — customization is core; the point is that the customization produces an owned application and an outcome, not billable hours.</p>"
    },
    {
      q: "In the client role-play round, an interviewer plays a frustrated customer whose deployment just slipped three weeks. Which response pattern scores best?",
      options: [
        "Reassure them everything is fine and avoid mentioning the slip unless they raise it",
        "Deliver the bad news directly and early, own it in the first person, explain the cause plainly, and present a concrete revised plan with options",
        "Blame the customer's data quality and internal approval delays for the slip",
        "Offer a large discount immediately to smooth over the relationship"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: bad news early, first-person ownership, honest cause, concrete revised plan with options.</strong> The role-play tests exactly this: trustworthiness under pressure. Owning the slip ('I misjudged the integration complexity; here is the recovery plan') preserves credibility, while surfacing it early respects the customer's need to plan.</p><p>Hiding or minimizing the slip is the overpromise/avoidance failure that destroys trust when reality lands. Blaming the customer — even where partly true — reads as deflection and poisons the relationship. Reaching for a discount treats a trust problem as a price problem and signals you lack a real recovery plan; it is a tell that you could not diagnose or fix the actual issue.</p>"
    },
    {
      q: "Why is an experienced FDE often described as the highest-bandwidth product-management input a company has?",
      options: [
        "Because FDEs formally own the product roadmap and write all the specs",
        "Because, embedded in real customer operations across many deployments, they see precisely where the product breaks against reality and can route that pattern back to engineering",
        "Because FDEs run the largest customer surveys in the company",
        "Because FDEs are the only people allowed to talk to customers"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: embedded field presence across customers surfaces real product gaps.</strong> An FDE watches the product fail against actual data, actual workflows, and actual operators — and, seeing the same class of failure across multiple accounts, can distinguish a one-off from a genuine product gap and push it upstream. That is signal no survey or internal meeting produces.</p><p>FDEs typically do not formally own the roadmap — they are an input to it, often a decisive one. The value is not survey volume; it is depth and authenticity of the observation. And FDEs are certainly not the only customer-facing people — but their combination of production-code depth and embedded presence gives their feedback unusual fidelity.</p>"
    }
  ],
  flashcards: [
    { front: "Forward Deployed Engineer, in one sentence", back: "<p>A production software engineer <strong>embedded</strong> in a customer's environment who is personally <strong>accountable</strong> for turning a signed contract into working software that delivers the promised outcome — not a recommendation, but running code in their operation.</p>" },
    { front: "Palantir 'Dev' vs 'Delta' framing", back: "<p><strong>Dev:</strong> one capability, many customers (generalize a feature). <strong>Delta / FDE:</strong> one customer, many capabilities (solve everything for one account, feed learning back). The sharpest one-line articulation of the role.</p>" },
    { front: "'Ship on day one' — what and why", back: "<p>Put working software in front of the customer in the <strong>first week</strong> (transform, dashboard, grounded prototype), not a requirements doc. Rationale: the fastest way to learn the customer's problem description is wrong is to show them running code and watch their reaction.</p>" },
    { front: "The role-taxonomy mnemonic", back: "<p><strong>Sales engineer</strong> helps you sign the contract; <strong>solutions engineer</strong> helps you design what you signed; <strong>forward deployed engineer</strong> makes it work in production. Spine of every 'how is this different?' answer.</p>" },
    { front: "FDE vs Solutions Engineer — the boundary", back: "<p>SE builds offline MVPs on their own laptop to win/scope the deal and rarely touches customer infra. FDE <strong>picks up post-sale</strong> and builds production code <em>on customer infrastructure</em>. Artifact on your laptop = SE; artifact in their VPC serving operators = FDE.</p>" },
    { front: "Most diagnostic signal of a real FDE role", back: "<p>Fraction of the work-week spent <strong>writing and owning production code on customer infrastructure</strong> vs demos and throwaway POCs. Titles are unreliable bait; code intensity + production ownership is the tell.</p>" },
    { front: "The 95% problem (2025 MIT report)", back: "<p>~95% of enterprise GenAI pilots showed <strong>no measurable P&amp;L impact</strong>, traced to <strong>flawed integration, not weak models</strong>. This is the entire business case for the FDE: capability is fine; integration is the bottleneck, and only embedded engineers close it.</p>" },
    { front: "The three-phase deployment shape (OpenAI/Anthropic)", back: "<p><strong>1. Scoping</strong> (days onsite): map processes, prototype on synthetic data. <strong>2. Validation</strong> (multi-week): build evals, scale labeling, optimize to metrics. <strong>3. Delivery</strong> (recurring onsite): real data, build in their environment, demo and iterate to production.</p>" },
    { front: "'Services as software' thesis", back: "<p>Software is becoming the worker, not just the worker's tool, so an agent needs onboarding/context/supervision like a new hire — that's FDE work. Differentiation lives in <strong>how the same tech is implemented per customer</strong>, so it doesn't commoditize.</p>" },
    { front: "'Engineer-diplomat' — why the hyphen matters", back: "<p>The role fails if you're strong on only one side. Engineering (production-grade skill) is table stakes; <strong>diplomacy</strong> (agency, diagnosis, ownership language, conversational range) is what strong engineers underweight and what the interview loop is built to test.</p>" },
    { front: "The diagnostic instinct", back: "<p>Customers describe solutions/symptoms; the FDE diagnoses the <strong>real problem behind the stated one</strong> before building. 'We want a chatbot' is usually really 'a specific decision is made slowly by a specific person.' Jumping to a solution before scoping is the #1 case-study rejection.</p>" },
    { front: "Ownership language + calibrated commitment", back: "<p><strong>Ownership:</strong> 'I'll have this to you Friday,' not 'the team is working on it.' <strong>Calibrated:</strong> never overpromise — the fastest way to kill a deployment is guaranteeing 100% to a VP and missing. When asked for an impossible guarantee: acknowledge, explain the trade-off, offer options.</p>" },
    { front: "Conversational range", back: "<p>In one week, extract requirements from a warrant officer, debug a pipeline with a data engineer, and explain a trade-off to a Fortune 100 CEO — adjusting register for each without condescension or jargon-fog. A core, testable FDE trait.</p>" },
    { front: "The dual mandate (permanent tension)", back: "<p>Serve this one customer <em>and</em> feed generalizable signal back to the product. Constantly ask: 'specific to this customer, or a product gap I should push upstream?' Route accordingly — resist becoming a bespoke agency of one.</p>" },
    { front: "Why AI labs pay FDEs $300K-$1.2M", back: "<p>A productive FDE is associated with <strong>$3-15M annual revenue contribution</strong> (several times fully-loaded cost) via time-to-value, expansion (land-and-expand), and product feedback. They price field deployment like staff engineering because it's the binding revenue constraint.</p>" },
    { front: "FDE leveling axis", back: "<p>Not raw coding skill (saturates early) but <strong>judgment under ambiguity + diplomatic weight</strong>. Junior: execute a scoped slice. Senior: own a full account, trusted to say no. Staff/principal: run multiple accounts/a domain, set patterns, convert field learning into product.</p>" },
    { front: "Who thrives as an FDE", back: "<p>Curious high-agency generalist who has shipped end-to-end, is energized (not paralyzed) by ambiguity and customer contact, goes deep on demand. <strong>Not</strong> necessarily a PhD; not the isolated narrow specialist; not someone who needs fully-remote, low-contact work.</p>" },
    { front: "The burnout failure mode", back: "<p>Always-on relationship + travel + dual mandate grinds you down if you never say no. Survival = ruthless prioritization ('does this need a meeting, and me?') and building deployments that <strong>survive your absence</strong> via adoption/handoff. Route repeated pain into product.</p>" },
    { front: "FDE exit paths", back: "<p><strong>Founder</strong> (you've seen dozens of real enterprise problems), <strong>product/PM leadership</strong> (highest-bandwidth product sensor), <strong>deployment/SE leadership</strong> (scale the motion), <strong>staff SWE</strong> (return to core with field knowledge). The role builds an unusually broad, valuable stack.</p>" },
    { front: "Refusing 'Accenture with better software'", back: "<p>Serious FDE orgs sell <strong>customer-owned applications and outcomes</strong>, not undifferentiated staff-aug hours — because differentiation lives in the implementation, which a body-shop motion commoditizes. This is why FDE comp aligns with account success, not personal utilization/quota.</p>" }
  ],
  lab: {
    title: "Lab: reverse-engineer the FDE market and build your target list",
    html: `
<p><strong>Goal:</strong> turn the abstractions in this module into a concrete, personal map of the FDE market — which companies run a real FDE motion versus a mislabeled sales role, what each actually expects, and where your gaps are. This is the highest-leverage two hours you can spend before starting an FDE job search, and it doubles as reconnaissance you will reuse in every recruiter screen. No AWS or cloud spend; the only tools are a browser, a scratch folder, and a spreadsheet or markdown table.</p>

<h3>Architecture</h3>
<p>You will collect ten real, currently-open FDE (or "Applied AI Engineer," "Deployment Engineer," "Forward Deployed Software Engineer") postings, score each against the taxonomy from this module, and produce two artifacts: a ranked target list and a personal gap analysis. Everything lives in a throwaway local folder.</p>

<h3>Steps</h3>
<ol>
<li><strong>Set up a scratch workspace.</strong>
<pre><code>mkdir -p ~/fde-recon &amp;&amp; cd ~/fde-recon
touch postings.md targets.md gaps.md</code></pre></li>
<li><strong>Collect ten postings.</strong> Pull from a mix: at least two frontier labs (OpenAI FDE, Anthropic Applied AI Engineer), two enterprise-AI startups, and two companies where you suspect the title is bait. Paste the raw text of each into <code>postings.md</code> with its source URL.</li>
<li><strong>Score each posting on the taxonomy.</strong> For every posting, record four judgments: (a) estimated fraction of the week that is <em>production code on customer infra</em> vs demos/POCs; (b) does the FDE <em>own production deployment</em> or hand off; (c) onsite/travel expectation; (d) is comp aligned to account success or to a personal quota (a quota is a strong tell it is really a sales role). Mark each posting <strong>Real FDE</strong>, <strong>Hybrid</strong>, or <strong>Sales-in-disguise</strong>.
<pre><code># Example row in targets.md
| Company | Code% | Owns prod? | Onsite | Quota? | Verdict |
|---------|-------|-----------|--------|--------|---------|
| Lab A   | ~70%  | Yes       | 25%    | No     | Real FDE |
| Startup B | ~30% | Hands off | 0%     | Yes    | Sales-in-disguise |</code></pre></li>
<li><strong>Extract the recurring requirements.</strong> Across the ten, tally which skills appear repeatedly: Python, SQL, an API-integration example, RAG/agents/evals, cloud/VPC deployment, a named domain (fintech, healthcare, gov). This tally <em>is</em> the syllabus for the rest of this course.</li>
<li><strong>Write your gap analysis.</strong> In <code>gaps.md</code>, list the top five recurring requirements, rate yourself 1–5 on each, and name the single module or mission in this course that most directly closes each gap. Be honest about the diplomacy gaps (discovery, client communication), not just the technical ones — those are what the loop over-weights.</li>
<li><strong>Draft your 'why FDE' answer.</strong> Using the substance from lesson 1 and 4 (outcome ownership, tight build-to-impact loop, energized by ambiguity and customer contact), write a 60–90-second spoken answer and say it aloud once. If it contains the words "variety," "pays well," or "consulting," rewrite it.</li>
</ol>

<h3>Verify</h3>
<ul>
<li>You can name, from your own list, at least two companies running a real FDE motion and one running a sales role in disguise — and articulate the specific signals that separated them.</li>
<li>Your gap analysis points each weakness to a concrete next step in this course rather than a vague "get better at X."</li>
<li>Your spoken "why FDE" answer survives the three-forbidden-words test and reaches for outcome ownership, not perks.</li>
</ul>

<h3>Teardown</h3>
<p>This is a research exercise with no cloud footprint — but keep your habits clean. If you want to preserve the target list, move it somewhere permanent; otherwise remove the scratch workspace so stale postings do not mislead you later:</p>
<pre><code>cd ~ &amp;&amp; rm -rf ~/fde-recon      # delete the scratch folder and its files</code></pre>
<p>(If you copied any company-confidential text from a posting into a personal notes tool, delete that too — practicing clean handling of other people's information is itself part of the FDE discipline.)</p>
`
  }
});
