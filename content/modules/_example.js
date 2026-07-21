/* EXAMPLE ONLY — not loaded by the app (files starting with _ are ignored).
 * Shows the exact shape and voice every real module must follow. Real modules
 * have 5-8 full-length lessons, 12-15 quiz questions, 15-25 flashcards. */
window.COURSE.register({
  id: "example",
  order: 99,
  track: "saa",
  title: "Example Module",
  description: "Demonstrates schema and voice. See <code>content/AUTHORING.md</code> for the full spec.",
  examWeight: "Not on any exam — this is a template.",
  lessons: [
    {
      id: "nlb-vs-alb",
      title: "Example lesson: ALB vs NLB mental model",
      html: `
<p>You already run L4 and L7 proxies; AWS just gives them different failure and pricing
semantics. An <strong>ALB</strong> terminates the TCP/TLS connection and re-originates a new one to the
target — think nginx/envoy as a managed fleet. An <strong>NLB</strong> is closer to LVS/IPVS in DSR-ish
mode: it forwards flows at L4, can preserve the client source IP, and gives you a
<em>static IP per AZ</em>, which an ALB never does.</p>

<h3>What actually differs</h3>
<table>
<thead><tr><th></th><th>ALB (L7)</th><th>NLB (L4)</th></tr></thead>
<tbody>
<tr><td>Routing</td><td>Host/path/header/query rules</td><td>Flow hash only</td></tr>
<tr><td>Static IP / EIP</td><td>No (use NLB in front or Global Accelerator)</td><td>Yes, one per AZ</td></tr>
<tr><td>Latency</td><td>ms-level, adds hop semantics</td><td>~100µs-level pass-through</td></tr>
</tbody>
</table>

<div class="callout exam">Keywords map to answers: "static IP for the load balancer" or
"millions of requests, ultra-low latency" → NLB. "Route by URL path/hostname" → ALB.
"UDP" → NLB, full stop.</div>

<div class="callout war">NLB health checks come from the NLB nodes, and with
cross-zone off, a target seen unhealthy only in its own AZ can blackhole that AZ's
flows. Turn on cross-zone deliberately and know that it bills inter-AZ bytes.</div>

<pre><code>aws elbv2 create-load-balancer \
  --name demo-nlb --type network \
  --subnets subnet-aaa subnet-bbb</code></pre>

<p>(A real lesson continues to 700-1400 words: failure modes, limits, pricing shape,
when NOT to use it.)</p>
`
    }
  ],
  quiz: [
    {
      q: "A trading platform needs a load balancer with a fixed IP that partners can allowlist, handling TCP with minimal added latency. Which option fits?",
      options: [
        "Application Load Balancer with an Elastic IP attached",
        "Network Load Balancer with one Elastic IP per AZ",
        "Classic Load Balancer in EC2-Classic mode",
        "CloudFront distribution in front of an ALB"
      ],
      answer: [1],
      multi: false,
      explanation: "NLB supports Elastic IPs (one per AZ) and forwards at L4 with microsecond-scale overhead — exactly the allowlisting + latency requirement. <strong>A</strong> is impossible: ALBs never take EIPs; their IPs change. <strong>C</strong> is deprecated tech and a distractor. <strong>D</strong> adds latency and still has no fixed IP."
    },
    {
      q: "Which TWO capabilities are exclusive to the Application Load Balancer compared to the Network Load Balancer? (Select TWO.)",
      options: [
        "Routing based on HTTP host and path",
        "Preserving the client source IP to targets",
        "Authenticating users via OIDC before forwarding",
        "Handling UDP traffic",
        "Static IP addresses per AZ"
      ],
      answer: [0, 2],
      multi: true,
      explanation: "L7 rule-based routing (<strong>A</strong>) and built-in OIDC/Cognito auth (<strong>C</strong>) are ALB-only. <strong>B</strong> is available on both (NLB natively, ALB via X-Forwarded-For). <strong>D</strong> and <strong>E</strong> are NLB features."
    }
  ],
  flashcards: [
    { front: "Which ELB type supports Elastic IPs?", back: "NLB only — one EIP per AZ. ALB IPs are dynamic; put an NLB or Global Accelerator in front if you need static IPs." },
    { front: "ALB vs NLB: which preserves client source IP by default?", back: "NLB (for TCP targets by instance ID). ALB terminates the connection — clients appear via <code>X-Forwarded-For</code>." }
  ],
  lab: {
    title: "Lab: stand up an NLB with a static IP",
    html: `
<h3>Goal</h3><p>Create an NLB with an Elastic IP, verify the IP never changes across target churn.</p>
<h3>Steps</h3>
<ol><li><p>Allocate an EIP and create the NLB:</p>
<pre><code>aws ec2 allocate-address --query AllocationId --output text</code></pre></li>
<li><p>(...real labs continue with full numbered steps and a Verify section...)</p></li></ol>
<h3>Teardown</h3>
<ol><li><pre><code>aws elbv2 delete-load-balancer --load-balancer-arn ...
aws ec2 release-address --allocation-id ...</code></pre></li></ol>
`
  }
});
