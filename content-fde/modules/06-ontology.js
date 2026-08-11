/* Module 06 — Domain Modeling & the Ontology (The Field track) */
window.COURSE.register({
  id: "ontology",
  order: 6,
  track: "field",
  title: "Domain Modeling & the Ontology",
  description: "Grounding a frontier model in a customer-specific ontology — the entities, links, and actions that turn generic model output into operational value. Why a fluent generalist gives generic answers until you teach it this customer's specific nouns and verbs, and how the Palantir Foundry ontology pattern maps directly onto Claude tool-calling and OpenAI function-calling.",
  examWeight: "Grounding is a load-bearing topic in the system-design and case-study rounds: expect 'how do you stop it giving generic answers?', 'walk me through modeling this customer's domain', and 'why not just RAG everything?'. On the job it is week-one work at Palantir, Anthropic, and OpenAI — the ontology is the first artifact you build with the customer, the thing you argue about together, and the contract every later tool, eval, and integration is written against.",
  lessons: [
    {
      id: "why-generic-answers",
      title: "Why generic models give generic answers",
      html: `
<p>A frontier model arrives at the customer knowing <strong>English, not their business</strong>. It has read a substantial fraction of the public internet, so it can define an insurance claim, write a plausible-sounding subrogation memo, and reason fluently about the abstract concept of a policy. What it has never seen is <em>this</em> customer's Claim — the one with 47 typed fields, six lifecycle states, a business rule that a claim over a certain reserve amount requires a senior adjuster's sign-off, and an operational reality that half the "closed" claims in the CRM are actually reopened matters nobody re-flagged. The gap between those two things — the general concept and the specific operational object — is exactly where enterprise AI value is won or lost, and closing it is the whole reason this module exists.</p>

<p>Put the untuned model in front of an operator and the failure is quiet and predictable. Ask it "what should we do about claim 4471?" and it cannot know what a claim <em>is</em> in this system, which fields exist, what states are legal, or what actions a human is actually allowed to take on one. So it does the only thing a fluent generalist can: it produces confident, well-structured, <strong>generic</strong> advice — "review the documentation, contact the claimant, assess coverage" — that is not wrong, not useful, and not grounded in a single real record. The operator reads it, recognizes boilerplate, and never opens the tool again. That is the 95%-of-pilots-fail pattern at the sentence level.</p>

<div class="callout deep">Mechanically, the model is a distribution over language, not a database of your world. Pretraining gives it a strong prior over how the <em>word</em> "claim" is used across millions of documents; it has no prior at all over the primary key <code>claim_id=4471</code> or your <code>reserve_amount</code> column, because those never appeared in its training data and could not have. "Grounding" is the engineering discipline of getting the customer's specific instances and their specific rules into the model's context and reach — as retrieved facts it can read, and as typed, permissioned operations it can invoke — so that the next-token distribution is conditioned on <em>this</em> Claim rather than the average of all claims ever written about.</div>

<h3>Three layers of knowledge, and only one comes for free</h3>
<p>It helps to separate what the model brings from what you must supply:</p>
<ul>
<li><strong>General knowledge (free, from pretraining):</strong> what a claim, a policy, an adjuster generically are; how to write English; how to reason.</li>
<li><strong>Specific knowledge (you supply, via context/retrieval):</strong> that this customer calls it a "matter", that a Policy has these exact coverages, that "in review" and "under investigation" are different states with different rules.</li>
<li><strong>Operational capability (you supply, via grounded tools):</strong> the ability to actually look up claim 4471, list the adjuster's open matters, and escalate one — safely, with validation and permissions.</li>
</ul>
<p>The junior instinct is to fix a generic answer by improving the prompt — "you are an expert claims adjuster, be specific." That raises the fluency of the boilerplate without adding a single fact about the customer. The senior move is to recognize that no prompt can inject knowledge the model doesn't have; the lever is <strong>grounding</strong> — giving the model the customer's specific nouns (entities and their properties), verbs (the actions it may take), and relationships (the links between them), plus access to real instances.</p>

<h3>The two assistants</h3>
<p>Concretely, picture two assistants dropped into the same claims team. The first is a raw frontier model behind a chat box. Asked to triage the morning's new claims, it explains what triage means. The second has been grounded: it knows the customer's <strong>Claim</strong>, <strong>Policy</strong>, and <strong>Adjuster</strong> objects, their properties and legal states, and the <strong>links</strong> between them (a Claim is filed against a Policy; a Policy belongs to a Customer; a Claim is assigned to an Adjuster). Asked the same question, it can enumerate the real unassigned high-reserve claims, name the adjusters with capacity, and — because escalation is exposed as a governed action — propose specific assignments a human can approve. Same model, same weights. The difference is entirely the domain model you built.</p>

<div class="callout war">A logistics customer bought a chat assistant for their dispatch team; it demoed beautifully on the vendor's synthetic data and died on contact with production. The reason was not the model — it was that "shipment", in their world, spanned four source systems with three different IDs and a status field whose values ("staged", "manifested", "in transit", "exception") carried operational meaning nobody had encoded. The assistant, ungrounded, answered every question in generic supply-chain English. The FDE who rescued it wrote almost no new prompt text; they spent week one building the shipment ontology — the nouns, their real states, and the links — and the same model went from useless to trusted, because now it was reasoning about <em>their</em> shipments, not the idea of a shipment.</div>

<div class="callout exam">"How do you stop it giving generic answers?" is a near-guaranteed prompt in the system-design and case-study rounds, and the weak answer is "better prompting" or "fine-tuning". The strong answer names the mechanism: the model knows the language, not the customer's specific domain, so you <strong>ground</strong> it in a customer-specific ontology — the entities, properties, links, and actions of their world — and expose real instances through retrieval and grounded tool-calls. Bonus signal: distinguish general knowledge (free), specific knowledge (retrieval), and operational capability (grounded actions), and note that grounding is week-one work, not a prompt you tweak at the end.</div>
`
    },
    {
      id: "the-ontology",
      title: "The ontology: entities, properties, links, actions",
      html: `
<p>An <strong>ontology</strong> is a formal model of a customer's operational world: the things that exist, what is known about them, how they relate, and what may be done to them. The cleanest reference is <strong>Palantir Foundry's ontology</strong>, which decomposes into four primitives, and holding these four straight is the backbone of everything else in this module:</p>

<table>
<thead><tr><th>Primitive</th><th>What it is</th><th>Claims-domain example</th></tr></thead>
<tbody>
<tr><td><strong>Object type / entity</strong></td><td>The nouns — the kinds of thing that exist in the customer's world</td><td>Customer, Policy, Claim, Adjuster, Payment</td></tr>
<tr><td><strong>Property</strong></td><td>Typed attributes of an entity, including its legal states</td><td>Claim.reserve_amount (money), Claim.status (enum: filed, in_review, approved, denied, closed)</td></tr>
<tr><td><strong>Link type</strong></td><td>First-class, named relationships between entities</td><td>Claim filed_against Policy; Policy held_by Customer; Claim assigned_to Adjuster</td></tr>
<tr><td><strong>Action</strong></td><td>Governed operations that change state, with validation, permissions, and side effects</td><td>assign_adjuster, request_document, approve_payment, escalate_claim</td></tr>
</tbody>
</table>

<p>The first three describe the world as it <em>is</em> — a semantic layer over the customer's data. The fourth is the one senior engineers underweight and interviewers probe hardest: <strong>actions are the verbs</strong>, and an action is not a database UPDATE. It is a permissioned, validated, audited operation that encodes a business rule. <code>approve_payment</code> is not "set status to approved"; it is "if the claim is in <code>approved</code> state and the amount is within the actor's authority and coverage is confirmed, then create a Payment, transition the Claim, and write an audit record." The ontology is where that logic lives, once, rather than being re-implemented in every tool, prompt, and integration that touches a claim.</p>

<div class="callout deep">How this differs from a bare database schema is the whole point. An ER model gives you tables, columns, and foreign keys — structure without meaning. The ontology adds three things a schema lacks: <strong>semantics</strong> (this column is the claim's <em>legal state</em>, and these five values are the only legal ones, and only certain transitions between them are allowed), <strong>relationships as first-class objects</strong> (a link you can traverse and reason over, not a join you rediscover each query), and <strong>actions as governed verbs</strong> (state changes with rules attached, not raw writes). It is closer to a domain model in Domain-Driven Design, or a knowledge graph with behavior bolted on, than to a set of tables. The tables are the substrate; the ontology is the meaning layer the customer's operators and the model both reason in.</div>

<h3>The ontology as shared language</h3>
<p>The reason the ontology comes first in a deployment is not technical elegance — it is that the ontology is the <strong>shared language between you and the customer's domain experts</strong>. You do not know their domain; they do not know how to make a model useful. The ontology is the artifact where those two ignorances cancel. When you sit with the senior adjuster and ask "what is a Claim, exactly — what states can it be in, what does 'closed' really mean, when is a matter actually done?", you are simultaneously extracting requirements and building the model. Every disagreement they have with your draft — "no, a subrogation matter isn't a Claim, it's a different object" — is signal you could not have gotten any other way, and it is far cheaper to surface it in a whiteboard ontology in week one than in production in month three.</p>

<p>This is also why the ontology is worth writing down explicitly rather than leaving implicit in code. It becomes the thing everyone points at: the operators validate it against their reality, the model is grounded in it, the tools are generated from it, and the evals are written against it. Get the ontology right and the rest of the deployment has a spine; get it wrong or leave it implicit and every downstream artifact inherits the confusion.</p>

<div class="callout war">An FDE modeling a claims domain drew Claim and Policy as separate entities and called it done. In the customer's actual operation, a single filing could implicate multiple policies (primary and excess coverage), and the payout logic depended entirely on that many-to-many link. Because the FDE had modeled it as one-to-one, every grounded answer about coverage was subtly wrong, and the error was invisible until a real multi-policy claim surfaced. The fix was a fifteen-minute conversation with the domain expert about how coverage actually stacks — a conversation that should have happened during ontology design, not during a production incident. The lesson: the <strong>links</strong> carry as much domain truth as the entities, and their cardinality is a business fact you elicit, not a default you assume.</div>

<div class="callout exam">Expect "model this customer's domain on the whiteboard" as a live exercise. Reach for the four primitives explicitly — entities, properties (with real types and legal states), link types (with cardinality), and actions (with the rule each one enforces) — and narrate that actions are governed state changes, not raw writes. The tell that separates senior from junior: junior candidates model nouns and stop; senior candidates model the <strong>verbs</strong> and the <strong>links</strong>, ask the domain expert what "done" and "closed" actually mean, and treat the ontology as the shared contract they will build <em>with</em> the customer, not hand <em>to</em> them.</div>
`
    },
    {
      id: "mapping-messy-systems",
      title: "Mapping messy source systems into a domain model",
      html: `
<p>The clean ontology on the whiteboard meets an ugly reality: the customer does not have <em>a</em> Claim record. They have a claims database that thinks it owns the claim, a CRM that also thinks it owns the customer, a billing system with its own idea of a policy, three spreadsheets a regional office maintains by hand, and a legacy SOAP service that is the real source of truth for payouts and that nobody fully understands. The judgment-heavy work of an FDE — the part that does not commoditize and cannot be prompted away — is <strong>reconciling a dozen source systems into one coherent domain model</strong>. This is where deployments actually spend their time, and where the modeling decisions that matter get made.</p>

<h3>Identity resolution: the same customer in three systems</h3>
<p>The first wall you hit is that the same real-world entity appears in multiple systems under different identities. "Acme Corp" is <code>cust_00417</code> in the CRM, <code>ACME-INC</code> in billing, and "Acme Corporation" (free text, occasionally misspelled) in the regional spreadsheet. Deciding that these are one Customer — and building the logic that says so — is <strong>identity resolution</strong> (also called entity resolution or record linkage), and it is one of the deepest sources of both value and risk in a deployment. Resolve too aggressively and you merge two genuinely different customers, corrupting every downstream answer; resolve too timidly and the model sees three fragments of one relationship and can never reason about the whole.</p>

<div class="callout deep">Identity resolution runs on a spectrum. <strong>Deterministic matching</strong> keys on a shared stable identifier (a tax ID, a policy number) and is safe when one exists. <strong>Probabilistic matching</strong> scores fuzzy signals — name similarity, shared address, overlapping contacts — and merges above a threshold; it is powerful and dangerous, because the threshold is a business decision about the cost of a false merge versus a false split. Real deployments layer both: deterministic where a clean key exists, probabilistic for the long tail, and a <strong>survivorship</strong> policy that decides, when two records disagree on a field, which system wins (often billing for financials, the CRM for contacts). The ontology is where you declare the canonical Customer and its canonical ID; every source then maps <em>into</em> that identity rather than each pretending to own it.</div>

<h3>The ontology as the integration contract</h3>
<p>Once the ontology exists, it becomes the <strong>integration contract</strong>: the single agreed definition that every source system maps onto. Instead of N systems each with their own model and N-squared point-to-point translations, you have N adapters, each answering one question — "how does <em>this</em> system's rows become the canonical Claim / Policy / Customer?" The claims DB populates the Claim entity; billing populates Payment and the financial properties of Policy; the CRM owns Customer contacts; the spreadsheet contributes a regional flag. The ontology is the hub; the sources are spokes. This is what makes the domain model worth the up-front cost — it is not documentation, it is the interface every integration is written against, and it is why the adapter layer (covered in the integration module) is the longest pole in the deployment but a <em>tractable</em> one once the contract is fixed.</p>

<h3>Where the modeling judgment actually lives</h3>
<p>The hard calls are not mechanical, and they are yours to make with the domain expert:</p>
<ul>
<li><strong>Entity vs. property.</strong> Is "coverage" a property of a Policy or its own entity? If coverages have their own lifecycle, links, and actions, they are an entity; if they are just typed attributes, they are properties. Guessing wrong makes half your later questions unanswerable.</li>
<li><strong>Conflicting definitions.</strong> Billing says a policy is "active" if premiums are current; underwriting says "active" if it is in-force regardless of payment. These are two different predicates wearing one word. The ontology must pick canonical semantics and name the difference, not paper over it.</li>
<li><strong>Granularity and the deliberate abstraction.</strong> The naive move is to model the union of every field in every source — a bloated ontology that mirrors the mess. The senior move is to model the <strong>operational reality</strong>: the entities, properties, and actions the actual decisions depend on, and nothing else. The ontology is a deliberate abstraction over the source chaos, not a dump of it.</li>
</ul>

<div class="callout war">A claims team's two systems both had a <code>status</code> field. In the claims DB, "closed" meant the matter was adjudicated and paid. In the CRM, "closed" meant the customer-service ticket about the claim was resolved — which often happened while the claim itself was still open. An FDE who mapped both <code>status</code> fields onto one Claim.status property produced a model that reported claims as closed while payouts were still pending. The reconciliation was a semantics problem, not a plumbing problem: two identically-named fields meant different things, and only a conversation with the operators surfaced it. Identically-named fields across systems are a trap, not a convenience — audit what each one actually means before you merge them.</div>

<div class="callout exam">The Fortune-500 ingestion-pipeline system-design round is really an ontology-and-identity-resolution round in disguise. Interviewers want to hear you say: define the canonical entities first, treat the ontology as the integration contract each source maps into, and call out identity resolution (deterministic where a key exists, probabilistic for the tail, with an explicit survivorship rule) as a first-class risk with a false-merge-versus-false-split trade-off. Candidates who jump straight to Kafka and schemas without naming the semantic reconciliation — which fields mean what, and what is one entity versus many — have missed where the actual difficulty and the actual judgment live.</div>
`
    },
    {
      id: "grounding-tool-calls",
      title: "Grounding LLM tool-calls in the ontology",
      html: `
<p>The ontology is only operational once the model can <em>reach</em> it. The mechanism is tool-calling (Claude) or function-calling (OpenAI): you expose the ontology's entities and actions as callable tools, each with a name, a description, and a typed input schema, and the model chooses which to invoke against real instances. The striking thing — and the point interviewers want you to connect — is that the <strong>Foundry-ontology pattern maps almost one-to-one onto modern LLM tool-calling</strong>. The same four primitives that organized the domain model organize the tool surface.</p>

<table>
<thead><tr><th>Ontology primitive</th><th>Projects onto the tool surface as</th></tr></thead>
<tbody>
<tr><td>Entity type</td><td>Lookup / list tools: <code>get_claim(claim_id)</code>, <code>list_open_claims_for_adjuster(adjuster_id)</code></td></tr>
<tr><td>Property</td><td>Typed parameters and enum values in each tool's input schema (status is an enum of exactly the legal states)</td></tr>
<tr><td>Link type</td><td>Traversal tools: <code>get_policy_for_claim(claim_id)</code>, <code>list_claims_for_customer(customer_id)</code></td></tr>
<tr><td>Action</td><td>Effectful tools that enforce the rule: <code>escalate_claim(claim_id, reason)</code>, <code>approve_payment(claim_id, amount)</code></td></tr>
</tbody>
</table>

<p>An action becomes a function schema whose parameters are the properties involved, whose <code>enum</code> constraints come straight from the ontology's legal values, and whose <em>server-side implementation</em> re-checks the business rule the ontology defines. The model proposes the call; the tool implementation validates and executes it. Crucially, the model never gets to write a raw database mutation — it can only invoke governed actions, so the ontology's rules bound what any answer can actually <em>do</em>.</p>

<h3>Why an operational ontology beats raw RAG for taking action</h3>
<p>The reflexive enterprise-AI answer is "put the documents in a vector store and RAG it." Retrieval-augmented generation is excellent for one thing: answering questions from unstructured knowledge. It is the wrong primitive for <strong>action-taking</strong>, and understanding why is a senior distinction worth stating crisply:</p>
<ul>
<li><strong>RAG retrieves text; it cannot safely act.</strong> A retrieved chunk that says "claims over the reserve threshold require escalation" can <em>inform</em> a sentence, but it gives the model no typed, validated, permissioned way to actually escalate claim 4471. There is no schema, no state check, no audit record — just prose the model may or may not follow.</li>
<li><strong>RAG has no notion of state or legality.</strong> The ontology knows claim 4471 is currently <code>in_review</code> and that escalation is legal from that state; a pile of retrieved documents knows none of this. Grounding an action in the ontology means the illegal move is <em>structurally impossible</em>, not merely discouraged by a prompt.</li>
<li><strong>RAG answers can drift; actions must be exact.</strong> "Approximately the right amount" is fine for a summary and catastrophic for a payment. Actions demand typed parameters and server-side validation — precisely what a function schema over the ontology provides and free-text retrieval does not.</li>
</ul>

<div class="callout deep">The clean division of labor: <strong>RAG is the read side over unstructured knowledge; the ontology is the act side over structured operations.</strong> The two compose. A production claims assistant uses RAG to pull the relevant policy-manual passage or prior-case notes into context (unstructured knowledge the ontology does not model), and uses ontology-grounded tools to look up the real claim, traverse to its policy, and — with a human in the loop — escalate it. Asking "RAG or ontology?" is a false binary; the senior answer is "RAG for the knowledge the model reads, ontology-grounded tools for the operations the model performs," and knowing which half of the problem each one solves.</div>

<h3>Least privilege and the human in the loop</h3>
<p>Because actions can change the customer's real state, the tool surface is a security surface. Two disciplines carry over directly from the agents and security modules. <strong>Least privilege:</strong> expose read/lookup/traversal tools broadly, but gate effectful actions to the minimum the workflow needs — an assistant that only triages does not get <code>approve_payment</code>. <strong>Human-in-the-loop for irreversible actions:</strong> the model may <em>propose</em> an escalation or a payment, but a person confirms before it commits. The ontology makes this clean, because actions are already first-class, governed objects — you attach the confirmation gate and the permission check to the action definition, once, and every tool-call that invokes it inherits them.</p>

<div class="callout war">A team wired their internal claims REST API straight into the model by auto-generating one tool per endpoint — 140 thin tools returning raw JSON, no ontology in between. The model picked plausible-but-wrong endpoints, and worse, several write endpoints let it set a claim to any status string, including illegal ones, because nothing enforced the state machine. The rewrite exposed a dozen <em>ontology actions</em> instead of 140 endpoints — each with the legal states as enums and the business rule enforced server-side — and task success climbed while the class of "model set an impossible status" bugs disappeared entirely. The backend did not change; the ontology-shaped interface the model saw did. Grounding actions in the ontology is not just accuracy, it is a safety property.</div>

<div class="callout exam">"Why not just RAG everything?" and "how would you let the model actually <em>do</em> something, not just answer?" are standard probes. The senior answer: RAG is retrieval over unstructured knowledge — great for reading, unable to safely act; ontology-grounded tool-calls expose typed, validated, permissioned actions over real instances — the only sound way to take operational action. Name the Foundry-to-tool-calling mapping (entities become lookup tools, actions become effectful function schemas with legal states as enums), and the two safety disciplines: least privilege on effectful tools and human-in-the-loop for irreversible ones. Candidates who treat RAG as the answer to everything mark themselves as not having deployed an action-taking system.</div>
`
    },
    {
      id: "ontology-drives-evals",
      title: "The ontology drives evals and tool design",
      html: `
<p>The payoff for front-loading the ontology is that it becomes the organizing artifact for everything downstream. Two payoffs matter most for the interview and the job: a good domain model makes <strong>evals writable</strong> and <strong>tools designable</strong>, and it becomes a <strong>durable handoff artifact</strong> that outlives your presence on the account. Evals are the currency of trust — "how do you know it's working?" is the senior question every deployment must answer — and you cannot write a precise eval against a domain you have not modeled.</p>

<h3>A good ontology makes evals writable</h3>
<p>Without an ontology, your acceptance criteria collapse into "is the answer good?" — unmeasurable, unarguable, and a guaranteed source of a stalled pilot. With an ontology, evals become <strong>assertions about entities and actions</strong>, which are concrete and gradeable:</p>
<ul>
<li><em>Given a Claim in state <code>in_review</code> with reserve above the threshold, the assistant should offer the <code>escalate_claim</code> action.</em></li>
<li><em>Given a Claim in state <code>closed</code>, the assistant must <strong>not</strong> offer <code>approve_payment</code>.</em></li>
<li><em>Given a Customer with three policies, "how many active policies?" must return exactly the count of Policy entities linked to that Customer with active status.</em></li>
</ul>
<p>Each of these is a golden test with a right answer, because the ontology defines what the entities are, what states are legal, and what actions apply. The vague "is this a good response?" becomes a checkable claim about the customer's actual world. This is the mechanism by which the ontology turns "we think it works" into "here is the regression suite that proves it," and it is why the ontology and the eval harness are built together, not sequentially.</p>

<h3>A good ontology makes tools designable</h3>
<p>The ontology also tells you <em>which tools to build</em> — you are not guessing at a tool surface, you are projecting the domain model onto one. One lookup tool per entity, one traversal tool per link you need to walk, one action tool per governed verb. Tool granularity (a first-order concern from the agents module) is answered by the ontology's granularity: if actions are modeled at the right level of the customer's real operations, the tools land at the right level too. Ontology-first is why a well-designed deployment has a dozen intention-level tools rather than 140 endpoint-shaped ones.</p>

<div class="callout deep">Versioning the ontology is not optional, because your understanding of the domain deepens as the deployment proceeds. Your week-one Claim is wrong in specific, discoverable ways — a missing state, a link with the wrong cardinality, an action whose rule you misunderstood. Treat the ontology as a versioned artifact: change it deliberately, migrate the tools and evals that depend on it, and record why each change happened. The discipline mirrors database schema migration — additive changes are cheap, semantic changes (redefining what "closed" means) ripple through every downstream tool and eval, so you make them consciously. An ontology that silently drifts is as dangerous as a schema that silently drifts.</div>

<h3>The ontology as the thing you argue about — and hand off</h3>
<p>Because it is written down and shared, the ontology is <strong>the thing you and the customer argue about and agree on</strong>. Acceptance criteria get expressed in its terms: "the system is accepted when it correctly handles these Claim states and offers these actions under these rules." That agreement is your contract — it converts a fuzzy "make AI work for us" into a bounded, checkable deliverable, which is exactly how you escape POC purgatory and force a real go/no-go decision.</p>

<p>And it is a <strong>durable handoff artifact</strong>. The deepest failure mode in forward deployment is building something that only runs while you are in the room — a bespoke system whose logic lives in your head. The ontology is the antidote: it is documentation, contract, and shared mental model in one, written in the customer's own domain language. When you leave, the customer's team maintains the ontology, extends the tools from it, and writes new evals against it, because they understand it — they helped build it. A deployment that survives your absence is one where the ontology, not you, is the source of truth. That is the connection to the adoption and handoff discipline: the ontology is the single most important thing you leave behind.</p>

<div class="callout war">An FDE built an assistant that worked well and left the account. Six weeks later the customer's team needed to add a new action — a "reopen matter" verb the business had introduced. Because the original engineer had encoded the state machine implicitly across prompts and tool code rather than in an explicit, versioned ontology, no one on the customer's side could safely add the state and its transitions; they filed a support ticket and waited. Contrast the account where the ontology was the explicit, shared artifact: the customer's own engineer added the new action, wrote two evals asserting its legal states, and shipped it in an afternoon. The difference in longevity was entirely the difference between an implicit and an explicit domain model.</div>

<div class="callout exam">"How do you know it's working?" is the eval question, and the strongest answer routes through the ontology: precise, gradeable evals are only writable against a defined domain model, so the ontology and the eval harness are built together, with acceptance criteria expressed in ontology terms as the contract. Expect follow-ups on versioning (understanding deepens; migrate tools and evals deliberately) and on handoff (the ontology is the durable artifact the customer's team maintains after you leave — build it <em>with</em> them so it survives you). Tie it back to escaping POC purgatory: an ontology-anchored acceptance criterion is what forces a real go/no-go instead of an endless "is it good yet?" loop.</div>
`
    }
  ],
  quiz: [
    {
      q: "A claims team pilots a raw frontier model behind a chat box. Operators complain that every answer is well-written but useless boilerplate. An engineer proposes fixing it by adding 'You are an expert claims adjuster, be specific and detailed' to the system prompt. What is the best assessment?",
      options: [
        "Correct approach: a stronger persona prompt is how you make a model domain-specific",
        "Wrong lever: the model lacks the customer's specific entities, states, and instances; no prompt injects knowledge it doesn't have, so the fix is grounding in a customer-specific ontology plus access to real records",
        "The right fix is to fine-tune the model on the customer's chat logs",
        "The model is simply too small; upgrading to a larger model will make answers specific"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the persona prompt raises fluency without adding a single customer fact.</strong> Generic answers come from the model knowing the language but not this customer's Claim, Policy, Adjuster — their specific properties, legal states, and real instances. The lever is grounding: a customer-specific ontology (entities, properties, links, actions) plus retrieval/tool access to actual records.</p><p>A persona prompt is exactly the junior instinct the module warns against — it improves the boilerplate, not the grounding. Fine-tuning on chat logs teaches tone, not the current state of claim 4471, and is expensive and slow relative to grounding. Model size does not help: a larger model gives more fluent generic answers, because the missing thing is customer-specific knowledge, not raw capability.</p>"
    },
    {
      q: "During a whiteboard modeling exercise for an insurance customer, a candidate lists Customer, Policy, Claim, and Adjuster as objects with their properties and stops there. What is the most important thing missing from this domain model?",
      options: [
        "Nothing — enumerating the entities and their properties is a complete ontology",
        "The link types between entities and the actions (governed state-change verbs like escalate_claim, approve_payment) with the business rules they enforce",
        "A choice of vector database for storing the entities",
        "The exact SQL DDL for each table"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the model has nouns but no verbs and no links.</strong> An ontology is four primitives — entities, properties, <em>link types</em> (named relationships with cardinality), and <em>actions</em> (governed state changes with validation and permissions). Modeling only entities and properties is the classic junior stopping point; the links carry domain truth (does a claim implicate one policy or many?) and the actions encode the business rules the whole system exists to enforce.</p><p>Declaring it complete is the trap the question sets. A vector database is an implementation detail unrelated to whether the domain is modeled. SQL DDL is the substrate the ontology sits above — the schema gives structure without the semantics, links-as-first-class-objects, and governed verbs that make it an ontology.</p>"
    },
    {
      q: "An FDE reconciling a customer's systems finds that 'Acme Corp' appears as cust_00417 in the CRM, ACME-INC in billing, and 'Acme Corporation' (free text) in a regional spreadsheet. What is this problem called, and what is the key risk in solving it?",
      options: [
        "Schema migration; the risk is downtime during the cutover",
        "Identity resolution; the risk is the false-merge-versus-false-split trade-off — merge too aggressively and you corrupt two real customers into one, resolve too timidly and the model sees fragments of one relationship",
        "Prompt injection; the risk is a malicious record altering model behavior",
        "Rate limiting; the risk is exceeding the source system's API quota"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: this is identity resolution (entity resolution / record linkage), and the core risk is false-merge versus false-split.</strong> Deciding these three records are one canonical Customer — deterministically where a clean key exists, probabilistically for the tail, with a survivorship rule for conflicts — is deep, valuable, and dangerous: over-merge and every downstream answer about 'Acme' is corrupted; under-merge and the model can never reason about the whole relationship.</p><p>Schema migration is about evolving a data model over time, not matching records across systems. Prompt injection is an adversarial-input attack, unrelated. Rate limiting is an operational quota concern. Only identity resolution names the actual problem and its characteristic trade-off.</p>"
    },
    {
      q: "Two source systems each have a 'status' field on what looks like the same claim. In the claims DB, 'closed' means the matter is adjudicated and paid; in the CRM, 'closed' means the related service ticket is resolved (often while the claim is still open). What should the FDE do when mapping these into the ontology?",
      options: [
        "Map both status fields onto a single Claim.status property since they share a name",
        "Recognize that identically-named fields carry different semantics, pick canonical meaning for Claim.status (adjudicated/paid), and model the CRM's ticket status separately rather than merging them",
        "Drop the claims DB status and trust the CRM, since the CRM is the customer-facing system",
        "Average the two statuses to produce a blended state"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: identically-named fields are a semantics trap, not a convenience.</strong> Two 'closed' values mean different things — one is claim adjudication, the other is ticket resolution. Merging them produces a model that reports claims closed while payouts are pending. The ontology must pick canonical semantics for Claim.status and model the ticket's lifecycle as a separate concern, surfacing the difference rather than papering over it.</p><p>Blindly merging on the shared name is the exact error the war story describes. Arbitrarily trusting the CRM discards the system that actually owns claim adjudication. 'Averaging' two categorical statuses is meaningless. The senior move is to audit what each field actually means with the operators before mapping.</p>"
    },
    {
      q: "A team wants the model to actually escalate a specific claim and record a payment, not just answer questions about claims. They currently have a vector store of all claim-handling documents and are getting good Q&A. Why is RAG alone insufficient for the action-taking requirement?",
      options: [
        "RAG is slow; a faster retrieval index would let it take actions",
        "RAG retrieves unstructured text and has no typed, validated, permissioned way to act on a specific instance; taking action requires ontology-grounded tools/function-calls with state checks, typed parameters, and audit — retrieved prose can inform a sentence but cannot safely escalate claim 4471",
        "RAG works fine for actions; you just need to retrieve the escalation instructions and let the model follow them",
        "RAG cannot be used at all in an action-taking system and must be removed"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: RAG is the read side; actions require the ontology act side.</strong> Retrieved text can inform an answer but offers no schema, no state/legality check, no permission gate, and no audit record — so it cannot safely change the customer's real state. Ontology-grounded tools expose typed, validated, permissioned actions over real instances, making illegal moves structurally impossible rather than merely discouraged by prose.</p><p>Faster retrieval does not add the ability to act — the missing thing is structured operations, not speed. 'Retrieve the instructions and let the model follow them' is exactly the unsafe pattern: prose is not a validated action. And RAG is not removed — it composes: RAG for the unstructured knowledge the model reads, ontology tools for the operations it performs.</p>"
    },
    {
      q: "A team auto-generated 140 tools, one per internal REST endpoint, wired straight into the model with raw JSON returns and no ontology. Besides poor tool selection, several write endpoints let the model set a claim to any status string, including illegal ones. Which two changes most directly address the problems? (Select 2)",
      options: [
        "Replace the 140 endpoint tools with a small set of ontology-grounded actions whose input schemas constrain status to the legal enum values and whose server-side implementation enforces the state machine",
        "Consolidate reads into intention-level lookup and traversal tools projected from the ontology's entities and links",
        "Raise the model temperature so it explores more of the 140 endpoints",
        "Convert all tool responses from JSON to XML",
        "Ask the model to validate the state machine itself in its reasoning before each write"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>Correct: ground actions in the ontology (legal states as enums, rule enforced server-side) and consolidate reads into intention-level tools.</strong> Modeling actions as governed ontology verbs makes 'set an impossible status' structurally impossible — the enum bounds the parameter and the server re-checks the rule. Projecting lookups and traversals from entities and links replaces 140 endpoint-shaped tools with a dozen intention-level ones, fixing selection.</p><p>Higher temperature worsens selection over an already-ambiguous surface. JSON-to-XML changes syntax, not the missing validation or the tool sprawl. Asking the model to police the state machine in its own reasoning is exactly what fails — enforcement must live in the tool implementation (the ontology's rule), not in the model's discretion, which is unreliable under adversarial or edge inputs.</p>"
    },
    {
      q: "A team has front-loaded a solid ontology for a claims assistant and is now deciding what it buys them downstream, versus continuing to grade responses on 'is the answer good and helpful?'. Which TWO capabilities does a good ontology most directly enable? (Select 2)",
      options: [
        "Gradeable evals as assertions about entities and actions — e.g. a closed Claim must not offer approve_payment; a Customer with three active Policies must return a count of three",
        "A designable tool surface projected from the domain model — one lookup per entity, one traversal per needed link, one action per governed verb — instead of guessing at 140 endpoint-shaped tools",
        "A guarantee that the model will never hallucinate on any question, ontology-related or not",
        "Elimination of the need for any human-in-the-loop confirmation on irreversible actions",
        "A way to make 'is the answer good and helpful?' a rigorous, ground-truth acceptance criterion on its own"
      ],
      answer: [0, 1],
      multi: true,
      explanation: "<p><strong>Correct: a good ontology makes evals writable and tools designable.</strong> Because it defines entities, legal states, and applicable actions, you can write concrete golden tests (offer escalate_claim only from legal states, never approve_payment on a closed claim, return the exact linked-Policy count). And it tells you which tools to build — lookups per entity, traversals per link, actions per governed verb — so tool granularity follows the ontology's granularity rather than being guessed.</p><p>It does not guarantee no hallucination anywhere — it grounds the modeled domain, not every possible question. It does not remove human-in-the-loop gates; irreversible actions still need confirmation, and the ontology is where you attach that gate. And 'is it good and helpful?' remains unmeasurable on its own — the ontology's value is precisely that it replaces that vague criterion with checkable assertions in the customer's own domain terms.</p>"
    },
    {
      q: "Six weeks after an FDE leaves an account, the customer needs to add a 'reopen matter' action with new legal states. On one account the customer's own engineer ships it in an afternoon; on another they file a support ticket and wait. What most likely explains the difference?",
      options: [
        "The first account had a bigger model that could self-modify",
        "On the first account the ontology was an explicit, versioned, shared artifact the customer helped build and understands; on the second the state machine was encoded implicitly across prompts and tool code, so no one could safely extend it",
        "The second account had a more expensive support contract",
        "The first account happened to have fewer claims in its database"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: the difference is an explicit, shared ontology versus an implicit one.</strong> The durable handoff artifact is a written, versioned domain model in the customer's own language that they helped build. Adding a state and transitions is safe and local when the ontology is explicit and understood; it is impossible from the outside when the state machine lives implicitly in prompts and code inside the departed engineer's head.</p><p>Model size is irrelevant to whether a human can extend the domain model. A support contract does not give the customer the understanding to change the system safely. Database size has nothing to do with maintainability. The whole point is that the ontology, not the FDE, must be the source of truth so the deployment survives the FDE's absence.</p>"
    },
    {
      q: "In the Palantir Foundry ontology, what distinguishes an 'action' from an ordinary database UPDATE, and why does this matter when you expose it as a tool-call?",
      options: [
        "Nothing — an action is just a renamed UPDATE statement",
        "An action is a governed operation with validation, permissions, side effects, and an encoded business rule; as a tool it becomes a function schema whose server-side implementation re-enforces that rule, so the model can only take legal, audited state changes",
        "An action is faster than an UPDATE because it bypasses the transaction log",
        "An action can only read data, never change it"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: an action encodes a rule; a raw UPDATE encodes nothing.</strong> approve_payment is not 'set status to approved' — it is 'if the claim is in approved state and the amount is within the actor's authority and coverage is confirmed, then create a Payment, transition the Claim, and write an audit record.' Exposed as a tool, its schema constrains parameters and its implementation re-checks the rule, so the model's proposed calls are bounded to legal, permissioned, audited operations.</p><p>Calling it a renamed UPDATE misses the validation, permissions, and audit that define it. Bypassing the transaction log is fabricated and would be a reliability disaster. Actions absolutely can change state — that is their whole purpose; the point is that they change it under governance.</p>"
    },
    {
      q: "An FDE modeling a claims domain assumes each Claim is filed against exactly one Policy (one-to-one). In production, a single filing implicates a primary and an excess policy, and payout logic depends on that. What does this failure illustrate about ontology design?",
      options: [
        "That entities matter but links do not",
        "That link cardinality is a business fact you must elicit from domain experts, not a default you assume; getting the many-to-many wrong made every coverage answer subtly and invisibly incorrect",
        "That the model was hallucinating and needed a stricter prompt",
        "That the ontology should have been skipped in favor of direct database queries"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: links carry domain truth, and their cardinality is a business fact to elicit.</strong> The one-to-one assumption silently broke all coverage reasoning until a real multi-policy claim surfaced. The fix was a short conversation with the domain expert about how coverage stacks — a conversation that belonged in ontology design, not a production incident.</p><p>The failure shows the opposite of 'links don't matter' — the link and its cardinality were the whole problem. The model was not hallucinating; it faithfully reasoned over a wrong model. And skipping the ontology for direct queries would not help: the same many-to-many reality has to be understood to write correct queries — the modeling judgment is unavoidable, only its location changes.</p>"
    },
    {
      q: "A production claims assistant needs both to answer 'what does our policy manual say about subrogation?' and to actually escalate a specific overdue claim. What architecture correctly divides these responsibilities?",
      options: [
        "Use RAG for both, since retrieval can handle any request",
        "Use ontology-grounded tools for both, since actions can also answer questions",
        "RAG over the unstructured manual and case notes for the knowledge-reading question; ontology-grounded tool-calls (lookup, traversal, and the escalate action) for the operational action — RAG is the read side, the ontology is the act side, and they compose",
        "Fine-tune one model that memorizes both the manual and the claims database"
      ],
      answer: [2],
      multi: false,
      explanation: "<p><strong>Correct: RAG for unstructured knowledge, ontology tools for structured operations, composed.</strong> The manual and case notes are unstructured knowledge the ontology does not model — a textbook RAG job. Escalating claim 4471 is a governed, typed, permissioned state change — an ontology action invoked via tool-call, with a human in the loop. A real assistant uses both: retrieve the relevant passage into context, then act through grounded tools.</p><p>RAG-for-both cannot safely take the escalation action (no schema, state check, or audit). Ontology-tools-for-both is awkward and wasteful for free-text manual questions the ontology never modeled. Fine-tuning to memorize a live claims database is expensive, stale the moment data changes, and gives no validated way to act — the false-binary answers all miss which primitive each half of the problem needs.</p>"
    },
    {
      q: "Three weeks into a deployment, the FDE realizes their week-one ontology defined Claim.status with five states but the business actually distinguishes 'under investigation' from 'in review' as separate states with different rules. What is the disciplined way to handle this?",
      options: [
        "Leave the ontology as-is and patch the distinction into each tool's prompt to avoid disruption",
        "Treat the ontology as a versioned artifact: make the semantic change deliberately, migrate the tools and evals that depend on the status states, and record why the change was made",
        "Delete the ontology and start over from scratch",
        "Add the new state silently in the tool code without touching the ontology, evals, or documentation"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: version the ontology and migrate its dependents deliberately.</strong> Your understanding of the domain deepens as you go; the week-one model is wrong in discoverable ways. A semantic change like splitting a state ripples through every tool schema and eval that references those states, so you make it consciously, migrate the dependents, and record the rationale — the same discipline as a database schema migration.</p><p>Patching the distinction into prompts scatters the state machine implicitly and defeats the ontology as the single source of truth. Starting over throws away validated work and history. Adding a state silently in tool code is the exact drift that produces an unmaintainable, un-handoff-able system — an ontology that silently drifts is as dangerous as a schema that silently drifts.</p>"
    },
    {
      q: "An FDE is told 'just point the model at the data warehouse and let it write SQL — you don't need an ontology.' For an action-taking enterprise assistant, what is the strongest objection?",
      options: [
        "None — direct SQL generation is always the best approach and the ontology is overhead",
        "Raw SQL over source tables exposes the model to ungoverned mutations and the unreconciled mess (identity fragmentation, conflicting 'status' semantics, unmodeled links), with no legal-state enforcement, permissions, audit, or shared contract; the ontology is the semantic and safety layer the tools and evals are built against",
        "SQL is too slow; a NoSQL store would remove the need for an ontology",
        "The model cannot write SQL, so the plan is technically impossible"
      ],
      answer: [1],
      multi: false,
      explanation: "<p><strong>Correct: raw SQL over source tables inherits every problem the ontology exists to solve.</strong> The warehouse holds the unreconciled mess — the same customer fragmented across systems, 'closed' meaning different things, links with cardinality nobody has pinned down — and free-form SQL lets the model issue ungoverned writes with no legal-state check, no permission gate, and no audit. The ontology is the semantic reconciliation, the governed-action layer, and the shared contract that tools and evals are written against.</p><p>Calling the ontology pure overhead ignores that it is where the modeling judgment and the safety properties live. The database engine (SQL vs NoSQL) is irrelevant to whether the domain is modeled and actions are governed. And frontier models can write SQL competently — the objection is not capability, it is governance and semantics.</p>"
    }
  ],
  flashcards: [
    { front: "Why generic models give generic answers, in one line", back: "<p>The model knows <strong>English, not the customer's business</strong> — it has never seen this customer's specific Claim, Policy, or Adjuster, their real fields, legal states, or instances. Grounding in a customer-specific ontology (nouns, verbs, links) plus access to real records is what closes the gap.</p>" },
    { front: "The three layers of knowledge in a deployment", back: "<p><strong>General</strong> (free, from pretraining): what a claim/policy generically is. <strong>Specific</strong> (you supply via retrieval): this customer's exact entities, states, terms. <strong>Operational capability</strong> (you supply via grounded tools): the ability to actually look up and act on real instances.</p>" },
    { front: "The four ontology primitives (Foundry model)", back: "<p><strong>Entities</strong> (nouns: Customer, Claim), <strong>properties</strong> (typed attributes + legal states), <strong>link types</strong> (named relationships with cardinality), <strong>actions</strong> (governed state-change verbs with validation, permissions, side effects). Junior models nouns; senior models the verbs and links too.</p>" },
    { front: "Action vs. database UPDATE", back: "<p>An action is a <strong>governed operation encoding a business rule</strong> — validation, permissions, audit, side effects — not a raw write. approve_payment = 'if approved-state AND within authority AND coverage confirmed, then create Payment + transition + audit,' not 'set status = approved.'</p>" },
    { front: "Ontology vs. bare database schema", back: "<p>A schema gives tables/columns/FKs — structure without meaning. The ontology adds <strong>semantics</strong> (this is the legal state, these are the only legal values/transitions), <strong>links as first-class objects</strong> (traversable, not rediscovered joins), and <strong>actions as governed verbs</strong>. Closer to a DDD domain model / knowledge graph with behavior.</p>" },
    { front: "The ontology as shared language", back: "<p>It is where your ignorance of the domain and the customer's ignorance of AI cancel. You build it <strong>with</strong> the domain experts; every disagreement ('a subrogation matter isn't a Claim') is requirements signal you can't get otherwise. Cheaper to surface on a whiteboard in week one than in production in month three.</p>" },
    { front: "Identity resolution", back: "<p>Deciding that the same real-world entity across systems (cust_00417 / ACME-INC / 'Acme Corporation') is one canonical Customer. <strong>Deterministic</strong> on a clean key, <strong>probabilistic</strong> for the tail, with a <strong>survivorship</strong> rule for conflicts. Core risk: false-merge (corrupt two customers into one) vs. false-split (fragmented relationship).</p>" },
    { front: "The ontology as the integration contract", back: "<p>The single agreed definition every source system maps <em>into</em>. Turns N-squared point-to-point translations into N adapters ('how do this system's rows become the canonical Claim?'). Hub-and-spoke: ontology is the hub, sources are spokes. The interface every integration is written against.</p>" },
    { front: "The entity-vs-property judgment call", back: "<p>Is 'coverage' a property of Policy or its own entity? If it has its own lifecycle, links, and actions → entity. If it's just typed attributes → property. Guess wrong and half your later questions become unanswerable. This is elicited from the domain expert, not defaulted.</p>" },
    { front: "Model operational reality, not the union of source fields", back: "<p>The naive move mirrors the mess — every field from every system. The senior move models the entities, properties, and actions the <strong>actual decisions</strong> depend on. The ontology is a <em>deliberate abstraction</em> over source chaos, not a dump of it.</p>" },
    { front: "Identically-named fields are a trap", back: "<p>Two systems' <code>status = 'closed'</code> can mean different things (claim adjudicated/paid vs. service ticket resolved). Merging on the shared name produces claims reported closed while payouts pend. Audit what each field <em>means</em> with operators before mapping — semantics, not plumbing.</p>" },
    { front: "Foundry ontology → LLM tool-calling mapping", back: "<p>Entities → lookup/list tools; properties → typed params + enum constraints; links → traversal tools; <strong>actions → effectful function schemas</strong> whose server-side impl re-enforces the rule. The domain model projects almost 1:1 onto Claude tool-calling / OpenAI function-calling.</p>" },
    { front: "Why operational ontology beats raw RAG for actions", back: "<p>RAG retrieves <strong>text</strong> — no schema, no state/legality check, no permissions, no audit; it can inform a sentence but can't safely act. Ontology-grounded tools give typed, validated, permissioned actions over real instances, making illegal moves <em>structurally impossible</em>, not just discouraged by a prompt.</p>" },
    { front: "Where RAG still fits", back: "<p>RAG = the <strong>read side</strong> over unstructured knowledge (policy manuals, case notes, docs the ontology doesn't model). Ontology = the <strong>act side</strong> over structured operations. They compose: retrieve the relevant passage into context, then act through grounded tools. 'RAG or ontology?' is a false binary.</p>" },
    { front: "Least privilege + human-in-the-loop on the tool surface", back: "<p>Because actions change real state, the tool surface is a security surface. Expose reads/lookups/traversals broadly; <strong>gate effectful actions</strong> to the minimum the workflow needs. Model may <em>propose</em> irreversible actions; a human <strong>confirms</strong> before commit. Attach the gate to the action once; every call inherits it.</p>" },
    { front: "The 140-endpoints-vs-a-dozen-actions lesson", back: "<p>Auto-generating one tool per REST endpoint gives bad selection AND ungoverned writes (model sets illegal statuses). Ontology-grounded actions (legal states as enums, rule enforced server-side) fix both. The backend didn't change; the ontology-shaped interface the model saw did. Grounding is a <strong>safety property</strong>, not just accuracy.</p>" },
    { front: "A good ontology makes evals writable", back: "<p>Without it: 'is the answer good?' — unmeasurable, stalled pilot. With it: gradeable assertions about entities and actions — closed Claim must not offer approve_payment; a Customer with 3 active Policies returns 3. Ontology + eval harness are built together; acceptance criteria are expressed in ontology terms.</p>" },
    { front: "A good ontology makes tools designable", back: "<p>It tells you <em>which</em> tools to build: one lookup per entity, one traversal per needed link, one action per governed verb. Tool granularity is answered by the ontology's granularity — why a good deployment has a dozen intention-level tools, not 140 endpoint-shaped ones.</p>" },
    { front: "Versioning the ontology", back: "<p>Your week-one model is wrong in discoverable ways; understanding deepens. Treat it as a versioned artifact: additive changes cheap, <strong>semantic changes ripple</strong> through every dependent tool and eval — make them deliberately, migrate dependents, record why. An ontology that silently drifts is as dangerous as a schema that silently drifts.</p>" },
    { front: "The ontology as durable handoff artifact", back: "<p>The antidote to a system that only runs while you're in the room. It is documentation, contract, and shared mental model in the customer's own language. Built <em>with</em> them, they maintain it, extend tools from it, and write new evals against it after you leave. A deployment survives your absence when the <strong>ontology, not you</strong>, is the source of truth.</p>" }
  ],
  lab: {
    title: "Lab: model a small ontology, then ground two actions as LLM tool-calls",
    html: `
<p><strong>Goal:</strong> build the core FDE artifact end-to-end at desk scale. You will (1) model a small ontology for a chosen domain — 5 to 8 entity types with properties, link types, and 2 to 3 actions; (2) wire two of those actions as LLM tool/function schemas grounded in the ontology; and (3) run one grounded tool-call locally, watching the model choose a real action against a real instance instead of answering in generic prose. Cost is a few cents of API credits at most (one small model call), or zero if you stub the model. The whole point is to feel the difference grounding makes.</p>

<h3>Architecture</h3>
<p>Everything lives in one throwaway local folder and one Python file. You define the ontology as plain data (entities, properties with legal states, links, and actions with their rules), seed two or three synthetic instances, project two actions into tool schemas whose enums come straight from the ontology's legal states, and let the model pick a tool for a scenario. The tool implementation re-enforces the ontology's rule server-side — so an illegal action is rejected in code, not merely discouraged in a prompt. Use the claims domain below or swap in your own (logistics: Shipment/Route/Carrier/Exception; field-service: WorkOrder/Asset/Technician/Part). Synthetic data only — no real customer records.</p>

<h3>Steps</h3>
<ol>
<li><strong>Set up a scratch workspace and a temporary key.</strong> Create an isolated folder and mint a <em>dedicated</em> API key for this lab so teardown can revoke exactly it.
<pre><code>mkdir -p ~/ontology-lab &amp;&amp; cd ~/ontology-lab
python3 -m venv .venv &amp;&amp; . .venv/bin/activate
pip install anthropic
# In the Anthropic Console, create a NEW key named "ontology-lab-temp".
export ANTHROPIC_API_KEY=sk-ant-...   # the temporary lab key, not your main key</code></pre></li>

<li><strong>Model the ontology as data.</strong> Write the four primitives explicitly. Note the legal states on <code>status</code> and the rule each action encodes — this is the artifact you would build <em>with</em> a domain expert.
<pre><code># ontology.py — entities, properties (with legal states), links, actions
ONTOLOGY = {
  "entities": {
    "Customer": {"props": {"id": "str", "name": "str"}},
    "Policy":   {"props": {"id": "str", "customer_id": "str",
                            "status": ["active", "lapsed", "cancelled"]}},
    "Claim":    {"props": {"id": "str", "policy_id": "str",
                            "reserve_amount": "money",
                            "status": ["filed", "in_review", "approved",
                                       "denied", "closed"],
                            "assigned_adjuster_id": "str|null"}},
    "Adjuster": {"props": {"id": "str", "name": "str", "seniority": ["junior", "senior"]}},
    "Payment":  {"props": {"id": "str", "claim_id": "str", "amount": "money"}},
  },
  # link types are first-class: name + cardinality
  "links": [
    {"name": "filed_against", "from": "Claim",  "to": "Policy",    "card": "many-to-one"},
    {"name": "held_by",       "from": "Policy",  "to": "Customer",  "card": "many-to-one"},
    {"name": "assigned_to",   "from": "Claim",   "to": "Adjuster",  "card": "many-to-one"},
    {"name": "paid_by",       "from": "Payment", "to": "Claim",     "card": "one-to-one"},
  ],
  # actions are governed verbs, each with the rule it enforces
  "actions": {
    "escalate_claim":  "legal only from status in {filed, in_review}; reason required",
    "approve_payment": "legal only from status == approved AND amount &lt;= reserve_amount",
  },
}

# a few synthetic instances (never real customer data)
INSTANCES = {
  "CLM-4471": {"id": "CLM-4471", "policy_id": "POL-9", "reserve_amount": 25000,
               "status": "in_review", "assigned_adjuster_id": None},
  "CLM-5502": {"id": "CLM-5502", "policy_id": "POL-3", "reserve_amount": 8000,
               "status": "closed",  "assigned_adjuster_id": "ADJ-2"},
}</code></pre></li>

<li><strong>Project two actions into grounded tool schemas.</strong> The enum values come straight from the ontology's legal states — the model literally cannot propose an out-of-vocabulary status. The server-side function re-checks the rule.
<pre><code># tools.py
import ontology

CLAIM_STATES = ontology.ONTOLOGY["entities"]["Claim"]["props"]["status"]

TOOL_SCHEMAS = [
  {"name": "escalate_claim",
   "description": "Escalate a claim for senior review. Legal only when the claim "
                  "status is 'filed' or 'in_review'. Use when reserve is high or the "
                  "matter is stalled.",
   "input_schema": {"type": "object",
     "properties": {"claim_id": {"type": "string"},
                    "reason":   {"type": "string"}},
     "required": ["claim_id", "reason"]}},
  {"name": "approve_payment",
   "description": "Approve a payment on a claim. Legal only when status is 'approved' "
                  "and amount does not exceed the claim reserve.",
   "input_schema": {"type": "object",
     "properties": {"claim_id": {"type": "string"},
                    "amount":   {"type": "number"}},
     "required": ["claim_id", "amount"]}},
]

def escalate_claim(claim_id, reason):
    c = ontology.INSTANCES.get(claim_id)
    if c is None:
        return "ERROR: no such claim " + claim_id
    if c["status"] not in ("filed", "in_review"):
        return ("ERROR (rule): escalate_claim is illegal from status '"
                + c["status"] + "'. Legal states: filed, in_review.")
    c["status"] = "in_review"   # governed transition + (real system) audit write
    return "OK: escalated " + claim_id + " (reason: " + reason + ")"

def approve_payment(claim_id, amount):
    c = ontology.INSTANCES.get(claim_id)
    if c is None:
        return "ERROR: no such claim " + claim_id
    if c["status"] != "approved":
        return "ERROR (rule): approve_payment requires status 'approved', got '" + c["status"] + "'."
    if amount &gt; c["reserve_amount"]:
        return "ERROR (rule): amount exceeds reserve."
    return "OK: payment of " + str(amount) + " approved on " + claim_id</code></pre></li>

<li><strong>Run one grounded tool-call.</strong> Give the model the tools plus one claim's real state and a scenario, and watch it choose a governed action against a real instance. (Skip this step and hand-call the tool functions if you would rather spend zero credits.)
<pre><code># run.py
import json, anthropic, tools, ontology

client = anthropic.Anthropic()   # reads ANTHROPIC_API_KEY (the temp lab key)
claim = ontology.INSTANCES["CLM-4471"]
prompt = ("Claim " + claim["id"] + " is in status '" + claim["status"]
          + "' with reserve " + str(claim["reserve_amount"])
          + ". It has sat untouched for 10 days. Take the appropriate action.")

resp = client.messages.create(
    model="claude-opus-5", max_tokens=1024,
    tools=tools.TOOL_SCHEMAS,
    messages=[{"role": "user", "content": prompt}])

for block in resp.content:
    if block.type == "tool_use":
        fn = getattr(tools, block.name)          # grounded action, not free text
        result = fn(**block.input)
        print("MODEL CHOSE:", block.name, block.input, "-&gt;", result)
    elif block.type == "text":
        print("MODEL SAID:", block.text)</code></pre></li>

<li><strong>Prove grounding did the work.</strong> Run it once against <code>CLM-4471</code> (in_review) — the model should invoke <code>escalate_claim</code> and the tool returns OK. Now change the prompt to reference <code>CLM-5502</code> (closed) and ask it to escalate; the server-side rule rejects the illegal transition even if the model proposes it. Then delete the enum on <code>status</code> and delete the rule check from <code>escalate_claim</code>, re-run, and watch the assistant degrade toward generic, ungoverned behavior. You have now measured, on your own machine, that the ontology — not the prompt — is what makes the action correct and safe.</li>
</ol>

<h3>Verify</h3>
<ul>
<li>The model invokes a real, ontology-defined action against a real instance rather than answering in generic prose.</li>
<li>An illegal action (escalating a closed claim, or paying above reserve) is rejected by the <em>server-side rule</em>, not merely discouraged in the prompt.</li>
<li>You can point at each of the four primitives in your <code>ontology.py</code> — entities, properties with legal states, links with cardinality, and actions with their rules — and explain which tool each primitive projected into.</li>
<li>You can articulate, from this exercise, why RAG over documents could not have taken the action safely, and where RAG would still fit (the unstructured policy manual you did not model).</li>
</ul>

<h3>Teardown</h3>
<p>Near-zero cost, but revoke the key and remove the scratch project so no stray credential or synthetic data lingers:</p>
<pre><code>deactivate 2&gt;/dev/null; rm -rf ~/ontology-lab      # delete the venv, code, and synthetic data
unset ANTHROPIC_API_KEY                             # drop the temp key from the shell</code></pre>
<p>Then <strong>revoke the temporary key in the Anthropic Console</strong> — delete the "ontology-lab-temp" key you created in step 1, so the credential cannot be reused. Revoking the specific lab key (rather than your main key) is exactly the least-privilege, clean-handoff hygiene the security module drills: mint narrow, delete when done.</p>
`
  }
});
