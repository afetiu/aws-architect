/* Build missions — realistic project briefs executed in the learner's real AWS account. */

/* ============================== MISSION 1: static-site ============================== */

window.COURSE.registerMission({
  id: "static-site",
  level: 1,
  title: "Ship a production static site",
  time: "60-90 min",
  cost: "&lt; $1 if torn down same day (CloudFront + S3 pennies; first 1,000 invalidation paths free)",
  services: ["S3", "CloudFront", "ACM", "Route 53"],
  brief: `
<p><strong>From:</strong> Priya (Head of Eng, Corvid Analytics) &mdash; <strong>Priority:</strong> this week</p>
<p>Our marketing site currently runs on a lone t2.small with nginx that Dave set up in 2019. Dave left. The Let's Encrypt renewal cron is broken and the cert dies Friday. I want the whole thing off EC2: S3 plus CloudFront, nothing to patch, nothing to renew by hand.</p>
<p>Two hard requirements from the security review: <strong>the bucket must never be public</strong> &mdash; CloudFront should reach it through Origin Access Control only, and if anyone hits the S3 URL directly they get an error &mdash; and the site must ship a baseline of security headers (HSTS, nosniff, frame denial). Marketing also pushes copy changes several times a day, so I need a deploy story where a new version goes live in under a minute, not "wait 24 hours for caches".</p>
<p>If you own a domain, put it on the site with an ACM cert and a Route 53 alias. If you don't, the default CloudFront domain with its built-in cert is an acceptable v1 &mdash; do everything else identically. Budget is effectively zero; this stack should cost cents. Ship it, prove each requirement with a command, then tear it down.</p>`,
  tasks: [
    `<p>A private S3 bucket exists holding <code>index.html</code> (and at least one CSS or second page so it feels real). All four Block Public Access flags are on. Verify: <code>aws s3api get-public-access-block --bucket YOUR_BUCKET</code> shows all four <code>true</code>, and <code>curl -s -o /dev/null -w "%{http_code}\\n" https://YOUR_BUCKET.s3.amazonaws.com/index.html</code> returns <code>403</code>.</p>`,
    `<p>A CloudFront distribution serves the site using <strong>Origin Access Control</strong> (not the legacy OAI). Verify: <code>curl -s -o /dev/null -w "%{http_code}\\n" https://DIST_DOMAIN/</code> returns <code>200</code>, and <code>aws cloudfront get-distribution-config --id DIST_ID</code> shows a non-empty <code>OriginAccessControlId</code> on the S3 origin.</p>`,
    `<p>The bucket policy grants <code>s3:GetObject</code> to the <code>cloudfront.amazonaws.com</code> service principal <strong>conditioned on your exact distribution ARN</strong> &mdash; and contains no other Allow statements. Verify: <code>aws s3api get-bucket-policy --bucket YOUR_BUCKET --query Policy --output text</code> and read it.</p>`,
    `<p>Plain HTTP is redirected: <code>curl -sI http://DIST_DOMAIN/</code> returns <code>301</code> with a <code>location:</code> header pointing at <code>https://</code>. (Viewer protocol policy, not an nginx rule you have to maintain.)</p>`,
    `<p>Security headers arrive via a CloudFront <strong>response headers policy</strong>: <code>curl -sI https://DIST_DOMAIN/</code> shows <code>strict-transport-security</code>, <code>x-content-type-options: nosniff</code>, and <code>x-frame-options</code>. The headers must come from CloudFront config, not be baked into the objects.</p>`,
    `<p>Versioned deploy works: change <code>index.html</code>, upload, create an invalidation for <code>/*</code>, and prove the new content is live in under a minute. Verify: <code>aws cloudfront get-invalidation --distribution-id DIST_ID --id INV_ID</code> shows <code>Completed</code> and <code>curl -s https://DIST_DOMAIN/ | grep v2</code> matches.</p>`,
    `<p><strong>Domain path (only if you own one):</strong> an ACM certificate in <strong>us-east-1</strong> is <code>ISSUED</code> via DNS validation, the distribution lists your domain as an alternate name, and a Route 53 alias record resolves. Verify: <code>dig +short yourdomain.example</code> returns CloudFront IPs and <code>curl -s -o /dev/null -w "%{http_code}\\n" https://yourdomain.example/</code> returns <code>200</code>. <em>No-domain path:</em> confirm the default <code>*.cloudfront.net</code> cert serves TLS 1.2+ (<code>curl -sIv https://DIST_DOMAIN/ 2&gt;&amp;1 | grep TLS</code>) and skip this task.</p>`
  ],
  hints: `
<p><strong>Nudges, not answers:</strong></p>
<ul>
<li>Your first-choice bucket name is probably taken &mdash; the namespace is global. Suffix it with your account ID and move on; do not burn 20 minutes on clever names.</li>
<li>OAC is created with <code>aws cloudfront create-origin-access-control</code>, then referenced from the origin config <em>and</em> trusted by the bucket policy. Three pieces; forgetting one gives 403s from CloudFront that look identical to a caching problem.</li>
<li>The certificate for CloudFront must live in <strong>us-east-1</strong> no matter where anything else is. <code>aws acm request-certificate --region us-east-1 ...</code>. This is the single most common wrong turn.</li>
<li>Distribution create/update takes 5&ndash;15 minutes to reach <code>Deployed</code>. Script your checks; don't stare.</li>
<li>There is a managed response headers policy named <code>Managed-SecurityHeadersPolicy</code> &mdash; look up its ID with <code>aws cloudfront list-response-headers-policies --type managed</code> before hand-rolling one.</li>
<li>If direct-to-S3 curl returns <code>AccessDenied</code> but CloudFront also 403s, check whether your default root object is set &mdash; hitting <code>/</code> without it is a 403, not a 404, because S3 denies the implicit list.</li>
<li>Invalidate <code>/*</code> during the exercise; in real life you'd version asset filenames and never invalidate. Know why both are true.</li>
</ul>`,
  walkthrough: `
<h3>1. Bucket, locked down</h3>
<pre><code>ACCT=$(aws sts get-caller-identity --query Account --output text)
BUCKET=corvid-site-$ACCT
aws s3api create-bucket --bucket $BUCKET --create-bucket-configuration LocationConstraint=eu-west-1 --region eu-west-1
aws s3api put-public-access-block --bucket $BUCKET \\
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true</code></pre>
<p>Why the account-ID suffix: bucket names are a global namespace and collisions are guaranteed for anything readable. Note the region wrinkle: outside us-east-1 you must pass <code>--create-bucket-configuration</code>. Upload content:</p>
<pre><code>printf '&lt;html&gt;&lt;body&gt;&lt;h1&gt;Corvid v1&lt;/h1&gt;&lt;/body&gt;&lt;/html&gt;' &gt; index.html
aws s3 cp index.html s3://$BUCKET/ --content-type text/html</code></pre>
<p>Set <code>--content-type</code> explicitly; the CLI guesses from extension but a wrong guess means browsers download the page instead of rendering it.</p>
<h3>2. OAC + distribution</h3>
<pre><code>aws cloudfront create-origin-access-control --origin-access-control-config \\
  Name=corvid-oac,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3</code></pre>
<p>Save the returned <code>Id</code>. Build a distribution config JSON (easiest: <code>aws cloudfront create-distribution --generate-cli-skeleton</code>, then fill in). The decisions that matter: origin domain is the <strong>REST endpoint</strong> <code>$BUCKET.s3.eu-west-1.amazonaws.com</code> (never the website endpoint &mdash; OAC does not work with it), <code>OriginAccessControlId</code> set, <code>DefaultRootObject=index.html</code>, <code>ViewerProtocolPolicy=redirect-to-https</code>, the managed cache policy <code>CachingOptimized</code> (<code>658327ea-f89d-4fab-a63d-7e88639e58f6</code>), and the managed response headers policy <code>Managed-SecurityHeadersPolicy</code> (<code>67f7725c-6f97-4210-82d7-5512b31e9d03</code> &mdash; confirm via <code>list-response-headers-policies</code>). Then:</p>
<pre><code>aws cloudfront create-distribution --distribution-config file://dist.json
aws cloudfront wait distribution-deployed --id DIST_ID</code></pre>
<h3>3. Bucket policy trusting only your distribution</h3>
<pre><code>cat &gt; policy.json &lt;&lt;'EOF'
{ "Version": "2012-10-17", "Statement": [ {
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::BUCKET_NAME/*",
    "Condition": { "StringEquals": { "AWS:SourceArn": "arn:aws:cloudfront::ACCT_ID:distribution/DIST_ID" } }
} ] }
EOF
sed -i -e "s/BUCKET_NAME/$BUCKET/" -e "s/ACCT_ID/$ACCT/" -e "s/DIST_ID/EDFDVBD6EXAMPLE/" policy.json
aws s3api put-bucket-policy --bucket $BUCKET --policy file://policy.json</code></pre>
<p>The <code>AWS:SourceArn</code> condition is the whole point: without it, <em>any</em> distribution in <em>any</em> account could front your bucket (confused deputy). Now run the acceptance curls &mdash; direct S3 403, CloudFront 200, headers present.</p>
<h3>4. Certificate and domain (optional path)</h3>
<pre><code>aws acm request-certificate --region us-east-1 \\
  --domain-name www.yourdomain.example --validation-method DNS</code></pre>
<p>us-east-1 is mandatory: CloudFront is a global service whose control plane only reads certs from that region. Fetch the validation CNAME from <code>describe-certificate</code>, create it in your zone (<code>aws route53 change-resource-record-sets</code>), wait for <code>ISSUED</code> (minutes if DNS is in Route 53). Update the distribution: add the domain to <code>Aliases</code>, set <code>ViewerCertificate</code> to the ACM ARN with <code>SSLSupportMethod=sni-only</code>. Finally an alias A record: <code>Type=A, AliasTarget HostedZoneId=Z2FDTNDATAQYW2</code> (that zone ID is a fixed constant for all CloudFront distributions) pointing at the distribution domain.</p>
<h3>5. Versioned deploy</h3>
<pre><code>printf '&lt;html&gt;&lt;body&gt;&lt;h1&gt;Corvid v2&lt;/h1&gt;&lt;/body&gt;&lt;/html&gt;' &gt; index.html
aws s3 cp index.html s3://$BUCKET/ --content-type text/html
aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/*"</code></pre>
<p>Why invalidation here: <code>index.html</code> must keep a stable name, so it cannot be cache-busted by filename. In production you'd give <code>index.html</code> a short TTL (or <code>CachingDisabled</code> on just that path) and version every other asset (<code>app.3f9c1d.js</code>) so you never invalidate at all &mdash; invalidations beyond 1,000 paths/month cost money and take about a minute to propagate. Confirm with the acceptance curl.</p>`,
  teardown: `
<ol>
<li><strong>Disable, then delete, the distribution</strong> (you cannot delete an enabled one): <code>aws cloudfront get-distribution-config --id DIST_ID</code>, set <code>"Enabled": false</code> in the config, <code>aws cloudfront update-distribution --id DIST_ID --if-match ETAG --distribution-config file://disabled.json</code>, then <code>aws cloudfront wait distribution-deployed --id DIST_ID</code> and <code>aws cloudfront delete-distribution --id DIST_ID --if-match NEW_ETAG</code>. Note the ETag changes after the update &mdash; re-fetch it.</li>
<li>Delete the OAC: <code>aws cloudfront delete-origin-access-control --id OAC_ID --if-match ETAG</code>. Orphaned OACs are free but clutter forever.</li>
<li>If you created a <em>custom</em> response headers policy (not the managed one), delete it: <code>aws cloudfront delete-response-headers-policy --id ID --if-match ETAG</code>.</li>
<li>Route 53: delete the alias A record and the ACM validation CNAME with <code>change-resource-record-sets</code> (Action DELETE, exact same record body). The hosted zone itself is $0.50/month &mdash; keep it only if you keep the domain.</li>
<li>Delete the certificate (only possible once no distribution references it): <code>aws acm delete-certificate --region us-east-1 --certificate-arn ARN</code>.</li>
<li>Empty and remove the bucket: <code>aws s3 rm s3://YOUR_BUCKET --recursive</code> then <code>aws s3api delete-bucket --bucket YOUR_BUCKET</code>. If you enabled bucket versioning at any point, <code>s3 rm</code> leaves delete markers and old versions billing &mdash; purge them by iterating <code>aws s3api list-object-versions</code> and calling <code>delete-objects</code> with both Versions and DeleteMarkers, then delete the bucket.</li>
<li><strong>Confirm $0:</strong> tomorrow, run <code>aws ce get-cost-and-usage --time-period Start=YESTERDAY,End=TODAY --granularity DAILY --metrics UnblendedCost --group-by Type=DIMENSION,Key=SERVICE</code> and check the CloudFront and S3 lines are cents-or-zero, and that no line keeps growing the day after.</li>
</ol>`
});

/* ============================== MISSION 2: three-tier-vpc ============================== */

window.COURSE.registerMission({
  id: "three-tier-vpc",
  level: 2,
  title: "Build the classic VPC from scratch — CLI only",
  time: "2-3 hours",
  cost: "~$0.15/hour while up (NAT gateway ~$0.045/hr + 2x t3.micro + ALB); &lt; $2 if torn down same session",
  services: ["VPC", "EC2", "ALB", "Systems Manager", "S3"],
  brief: `
<p><strong>Ticket INFRA-2214 &mdash; Relayworks GmbH</strong></p>
<p>Our production VPC was built by hand in the console three years ago by someone who no longer works here. Last month we needed to stand up an identical environment in a second region and discovered nobody can say what the security group chain actually is, or why there are five route tables. The platform lead's verdict: nobody touches a wizard again until the team can build the reference network <strong>from a blank region, CLI only</strong>, and explain every resource in it.</p>
<p>That's this ticket. Build the canonical two-AZ web tier: public subnets holding only the load balancer and NAT, private subnets holding two web instances, an ALB in front. Security constraints from the last audit are non-negotiable: <strong>no SSH key pairs, no bastion host, no port 22 anywhere</strong> &mdash; shell access is Session Manager or nothing &mdash; and the instance security group must accept traffic only from the ALB's security group, never from a CIDR. Since the app talks to S3 constantly, add a gateway endpoint so that traffic stops transiting the NAT (we pay NAT data processing today for no reason).</p>
<p>Prove it survives failure: kill one instance and show the ALB routes around the corpse without a single 5xx reaching a synthetic client. Then tear it all down &mdash; the NAT gateway alone is ~$32/month if you forget it.</p>`,
  tasks: [
    `<p>A VPC (<code>10.0.0.0/16</code>) with two public and two private subnets across two AZs. Verify: <code>aws ec2 describe-route-tables --filters Name=vpc-id,Values=VPC_ID</code> shows the public route table with <code>0.0.0.0/0 &rarr; igw-...</code> and the private route table with <code>0.0.0.0/0 &rarr; nat-...</code>.</p>`,
    `<p>Two web instances in the <strong>private</strong> subnets (one per AZ), launched with user-data that serves a page identifying the instance ID and AZ. Verify: <code>aws ec2 describe-instances --query "Reservations[].Instances[].[InstanceId,PublicIpAddress,KeyName]"</code> shows <strong>no public IP and no key pair</strong> on either.</p>`,
    `<p>Shell access works with zero open inbound ports: <code>aws ssm start-session --target i-INSTANCE_ID</code> drops you into a shell. Explain to yourself which of NAT-egress or VPC interface endpoints made the SSM agent reachable.</p>`,
    `<p>The security group chain is reference-based: ALB SG allows 80 from <code>0.0.0.0/0</code>; instance SG allows 80 <strong>only from the ALB SG's group ID</strong> and has no CIDR-based ingress at all. Verify: <code>aws ec2 describe-security-groups --group-ids INSTANCE_SG --query "SecurityGroups[].IpPermissions"</code> shows a <code>UserIdGroupPairs</code> entry and an empty <code>IpRanges</code>.</p>`,
    `<p>The ALB answers: <code>curl -s http://ALB_DNS/</code> returns 200, and running it 10 times shows responses from <strong>both</strong> instance IDs (round robin across AZs).</p>`,
    `<p>An S3 <strong>gateway endpoint</strong> is attached to both private route tables. Verify: <code>describe-route-tables</code> shows a route whose destination is a <code>pl-</code> prefix list, and from inside an instance (via SSM) <code>aws s3 ls s3://SOME_BUCKET</code> succeeds. Bonus proof: it still succeeds after you (temporarily) blackhole the NAT route.</p>`,
    `<p><strong>Failure drill:</strong> stop one instance. Within ~90 seconds <code>aws elbv2 describe-target-health --target-group-arn TG_ARN</code> shows it <code>unhealthy</code>/<code>unused</code>, and a curl loop against the ALB (<code>while true; do curl -s -o /dev/null -w "%{http_code} "; sleep 1; done</code> style) shows uninterrupted 200s served by the survivor. Start it again and watch it return to <code>healthy</code>.</p>`
  ],
  hints: `
<ul>
<li>Order of operations matters and the CLI won't hold your hand: VPC &rarr; subnets &rarr; IGW (create <em>and attach</em>) &rarr; allocate EIP &rarr; NAT gateway (in a <em>public</em> subnet &mdash; a NAT in a private subnet is the classic silent failure) &rarr; route tables &rarr; associations.</li>
<li>Subnets don't get a route table until you explicitly associate one; unassociated subnets fall back to the main route table, which is how "it worked by accident" networks are born.</li>
<li>For SSM without public IPs you need the agent to reach the SSM endpoints: either NAT egress (you have it here) or three interface endpoints (<code>ssm</code>, <code>ssmmessages</code>, <code>ec2messages</code>). Know both; this mission only needs the NAT. The instance also needs the <code>AmazonSSMManagedInstanceCore</code> policy on an instance profile &mdash; role, profile, and add-role-to-profile are three separate CLI calls.</li>
<li>Recent Amazon Linux 2023 AMIs ship the SSM agent; find the AMI with the SSM parameter <code>/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64</code> instead of hardcoding.</li>
<li>ALB needs two subnets in different AZs &mdash; it will refuse otherwise. Target group health check path must match what your user-data actually serves.</li>
<li>Gateway endpoints modify route tables; there is nothing to "call". If <code>aws s3 ls</code> hangs from the instance, your endpoint policy or the region in the CLI call is the suspect.</li>
<li>The failure drill: <em>stop</em>, don't terminate, so you can bring the same instance back for the recovery half of the proof.</li>
</ul>`,
  walkthrough: `
<h3>1. Network skeleton</h3>
<pre><code>VPC=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 --query Vpc.VpcId --output text)
PUB_A=$(aws ec2 create-subnet --vpc-id $VPC --cidr-block 10.0.0.0/24  --availability-zone eu-west-1a --query Subnet.SubnetId --output text)
PUB_B=$(aws ec2 create-subnet --vpc-id $VPC --cidr-block 10.0.1.0/24  --availability-zone eu-west-1b --query Subnet.SubnetId --output text)
PRI_A=$(aws ec2 create-subnet --vpc-id $VPC --cidr-block 10.0.10.0/24 --availability-zone eu-west-1a --query Subnet.SubnetId --output text)
PRI_B=$(aws ec2 create-subnet --vpc-id $VPC --cidr-block 10.0.11.0/24 --availability-zone eu-west-1b --query Subnet.SubnetId --output text)
IGW=$(aws ec2 create-internet-gateway --query InternetGateway.InternetGatewayId --output text)
aws ec2 attach-internet-gateway --internet-gateway-id $IGW --vpc-id $VPC</code></pre>
<p>NAT goes in a <strong>public</strong> subnet &mdash; it needs the IGW route itself to work:</p>
<pre><code>EIP=$(aws ec2 allocate-address --query AllocationId --output text)
NAT=$(aws ec2 create-nat-gateway --subnet-id $PUB_A --allocation-id $EIP --query NatGateway.NatGatewayId --output text)
aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT</code></pre>
<p>Route tables &mdash; one public, one private (single NAT for cost; in production you'd run one NAT per AZ so an AZ loss doesn't sever egress for the survivors):</p>
<pre><code>RT_PUB=$(aws ec2 create-route-table --vpc-id $VPC --query RouteTable.RouteTableId --output text)
aws ec2 create-route --route-table-id $RT_PUB --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW
aws ec2 associate-route-table --route-table-id $RT_PUB --subnet-id $PUB_A
aws ec2 associate-route-table --route-table-id $RT_PUB --subnet-id $PUB_B
RT_PRI=$(aws ec2 create-route-table --vpc-id $VPC --query RouteTable.RouteTableId --output text)
aws ec2 create-route --route-table-id $RT_PRI --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $NAT
aws ec2 associate-route-table --route-table-id $RT_PRI --subnet-id $PRI_A
aws ec2 associate-route-table --route-table-id $RT_PRI --subnet-id $PRI_B</code></pre>
<h3>2. Security group chain</h3>
<pre><code>SG_ALB=$(aws ec2 create-security-group --group-name alb-sg --description "ALB" --vpc-id $VPC --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $SG_ALB --protocol tcp --port 80 --cidr 0.0.0.0/0
SG_WEB=$(aws ec2 create-security-group --group-name web-sg --description "web" --vpc-id $VPC --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $SG_WEB --protocol tcp --port 80 --source-group $SG_ALB</code></pre>
<p><code>--source-group</code> is the load-bearing decision: the rule follows the ALB wherever its IPs move, and it makes the trust chain readable in an audit.</p>
<h3>3. IAM for SSM, then instances</h3>
<pre><code>aws iam create-role --role-name web-ssm-role --assume-role-policy-document file://ec2-trust.json
aws iam attach-role-policy --role-name web-ssm-role --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam create-instance-profile --instance-profile-name web-ssm-profile
aws iam add-instance-profile-to-role ... # add-role-to-instance-profile --instance-profile-name web-ssm-profile --role-name web-ssm-role
AMI=$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 --query Parameter.Value --output text)</code></pre>
<p>User-data (save as <code>ud.sh</code>): install httpd, then write an index page from instance metadata &mdash; remember IMDSv2 needs a token:</p>
<pre><code>#!/bin/bash
dnf install -y httpd
TOK=$(curl -sX PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOK" http://169.254.169.254/latest/meta-data/instance-id)
AZ=$(curl -s -H "X-aws-ec2-metadata-token: $TOK" http://169.254.169.254/latest/meta-data/placement/availability-zone)
echo "hello from $ID in $AZ" &gt; /var/www/html/index.html
systemctl enable --now httpd</code></pre>
<pre><code>aws ec2 run-instances --image-id $AMI --instance-type t3.micro --subnet-id $PRI_A \\
  --security-group-ids $SG_WEB --iam-instance-profile Name=web-ssm-profile \\
  --user-data file://ud.sh --no-associate-public-ip-address
# repeat with --subnet-id $PRI_B</code></pre>
<p>No <code>--key-name</code>, ever. Wait a few minutes, then <code>aws ssm describe-instance-information</code> should list both &mdash; that's the SSM agent registering out through the NAT. <code>aws ssm start-session --target i-...</code> proves shell access with zero inbound rules.</p>
<h3>4. ALB and target group</h3>
<pre><code>TG=$(aws elbv2 create-target-group --name web-tg --protocol HTTP --port 80 --vpc-id $VPC \\
  --health-check-path / --healthy-threshold-count 2 --interval-seconds 10 --query "TargetGroups[0].TargetGroupArn" --output text)
aws elbv2 register-targets --target-group-arn $TG --targets Id=i-AAA Id=i-BBB
ALB=$(aws elbv2 create-load-balancer --name web-alb --subnets $PUB_A $PUB_B --security-groups $SG_ALB \\
  --query "LoadBalancers[0].LoadBalancerArn" --output text)
aws elbv2 create-listener --load-balancer-arn $ALB --protocol HTTP --port 80 \\
  --default-actions Type=forward,TargetGroupArn=$TG</code></pre>
<p>The tightened health check (10s interval, threshold 2) makes the failure drill snappy. Curl the ALB DNS name until both instance IDs appear.</p>
<h3>5. S3 gateway endpoint</h3>
<pre><code>aws ec2 create-vpc-endpoint --vpc-id $VPC --service-name com.amazonaws.eu-west-1.s3 \\
  --vpc-endpoint-type Gateway --route-table-ids $RT_PRI</code></pre>
<p>Gateway endpoints are free and are pure routing: a managed prefix list route appears in <code>$RT_PRI</code>. S3 traffic from the private subnets now bypasses the NAT &mdash; which matters because NAT data processing is $0.045/GB on top of the hourly.</p>
<h3>6. Failure drill</h3>
<p>Start a curl loop against the ALB in one terminal. In another: <code>aws ec2 stop-instances --instance-ids i-AAA</code>. Watch <code>describe-target-health</code> flip to unhealthy within ~20&ndash;30s (2 failed checks at 10s); the loop should show only 200s, all from the survivor &mdash; the ALB fails open to healthy targets. <code>start-instances</code> and watch it rejoin. The lesson: the ALB <em>routes around</em> failure but nothing <em>replaces</em> capacity &mdash; that's the Auto Scaling group you'd add next in production.</p>`,
  teardown: `
<p>Order matters; several resources refuse to delete while dependents exist. ENIs are the usual invisible blocker.</p>
<ol>
<li>Terminate instances: <code>aws ec2 terminate-instances --instance-ids i-AAA i-BBB</code>; wait for <code>terminated</code>.</li>
<li>Delete the listener, load balancer, target group: <code>aws elbv2 delete-load-balancer --load-balancer-arn ALB_ARN</code>, wait ~2 min for its ENIs to detach, then <code>aws elbv2 delete-target-group --target-group-arn TG_ARN</code>.</li>
<li><strong>NAT gateway &mdash; the expensive one:</strong> <code>aws ec2 delete-nat-gateway --nat-gateway-id NAT_ID</code>, wait for state <code>deleted</code>, then <strong>release the Elastic IP</strong>: <code>aws ec2 release-address --allocation-id EIP_ALLOC</code>. An unattached EIP bills hourly forever.</li>
<li>Delete the VPC endpoint: <code>aws ec2 delete-vpc-endpoints --vpc-endpoint-ids vpce-...</code>.</li>
<li>Check for leftover ENIs before touching subnets: <code>aws ec2 describe-network-interfaces --filters Name=vpc-id,Values=VPC_ID</code>. Anything still <code>in-use</code> (ALB or NAT remnants) blocks subnet deletion &mdash; wait or detach.</li>
<li>Delete security groups (<code>web-sg</code> first, since <code>alb-sg</code> is referenced by it... actually the reverse: the SG containing the reference must be deleted or have the rule revoked first), then subnets, route tables (disassociate first if needed), detach and delete the IGW, and finally <code>aws ec2 delete-vpc --vpc-id VPC_ID</code>.</li>
<li>IAM cleanup: remove the role from the instance profile, delete the profile, detach the policy, delete the role.</li>
<li><strong>Confirm $0:</strong> next day, Cost Explorer grouped by service &mdash; the "EC2-Other" line is where NAT gateway and EIP charges hide; it must be flat at zero. Also check <code>aws ec2 describe-nat-gateways</code> and <code>describe-addresses</code> return nothing in the region.</li>
</ol>`
});

/* ============================== MISSION 3: serverless-api ============================== */

window.COURSE.registerMission({
  id: "serverless-api",
  level: 2,
  title: "Serverless CRUD API with a canary release",
  time: "2-3 hours",
  cost: "&lt; $0.50 total — 10k requests is pennies on Lambda/HTTP API/DynamoDB on-demand; most of it lands in free tier",
  services: ["API Gateway", "Lambda", "DynamoDB", "IAM", "CloudWatch"],
  brief: `
<p><strong>Ticket FK-88 &mdash; Fieldkit (seed-stage IoT startup)</strong></p>
<p>We just signed a pilot with an agricultural co-op: their handheld units will sync readings to us over HTTP. Traffic is spiky &mdash; nothing all night, then 400 devices sync within two minutes at dawn. We have no ops team, so the CTO has ruled out anything with servers to patch: HTTP API Gateway, Lambda, DynamoDB on-demand.</p>
<p>Two scars from the last startup drive the hard requirements. One: an over-broad Lambda role turned a code bug into a table-wipe there, so this function's policy must be <strong>least privilege &mdash; no wildcard actions, no wildcard resources</strong>; name the four DynamoDB actions you need and scope them to the one table ARN. Two: a bad deploy once took their API down for an hour, so v2 of this function must ship as a <strong>canary on a Lambda alias</strong> &mdash; 10% of live traffic first, verified, then promoted &mdash; with the API never pointing at <code>$LATEST</code>.</p>
<p>Logs must be structured JSON (we'll ship them to a query tool later, not grep). Before the pilot we also need proof, not vibes, on two questions: does it hold 10,000 requests without throttling, and what does that actually cost? Run the load test, read the metrics, then pull the real number from the bill.</p>`,
  tasks: [
    `<p>A DynamoDB table (on-demand billing) and one Lambda function behind an HTTP API with routes <code>POST /items</code>, <code>GET /items/{id}</code>, <code>PUT /items/{id}</code>, <code>DELETE /items/{id}</code>. Verify the round trip with curl: create returns 201 with an id, get returns the item, put changes it, delete returns 204 and a subsequent get returns 404.</p>`,
    `<p>The function role is least-privilege: exactly the DynamoDB actions the code calls (<code>PutItem</code>, <code>GetItem</code>, <code>UpdateItem</code>, <code>DeleteItem</code>), scoped to the single table ARN. Verify: <code>aws iam get-role-policy --role-name ROLE --policy-name POLICY</code> output contains no <code>*</code> in any Action or Resource (the CloudWatch Logs statement may target the function's own log group only, also no wildcard-all).</p>`,
    `<p>Logs are structured: every invocation writes one JSON line containing at least <code>level</code>, <code>route</code>, <code>itemId</code>, and the Lambda <code>requestId</code>. Verify: <code>aws logs filter-log-events --log-group-name /aws/lambda/FN --filter-pattern "{ $.route = * }"</code> returns events, proving the JSON is parseable by metric filters.</p>`,
    `<p>The API integration targets a <strong>Lambda alias</strong> (e.g. <code>live</code>), not <code>$LATEST</code> and not a bare version. Verify: <code>aws apigatewayv2 get-integrations --api-id API_ID</code> shows an integration URI ending in <code>:live/invocations</code>.</p>`,
    `<p>Canary deploy proven: publish v2 (response body includes a <code>version</code> field), set the alias to route 10% to v2 via <code>routing-config</code>, and show a 100-request curl loop returns a roughly 90/10 mix of versions. Then promote (<code>update-alias</code> to v2, no routing config) and show 100% v2. Verify: <code>aws lambda get-alias --function-name FN --name live</code> before and after.</p>`,
    `<p>Load test survives: drive ~10,000 requests (e.g. <code>hey -n 10000 -c 50</code>) with a 0% non-2xx rate. Verify with metrics, not the tool alone: <code>aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Throttles ... --statistics Sum</code> is 0, and <code>ConcurrentExecutions</code> Max shows Lambda actually fanned out (&gt;10).</p>`,
    `<p>Cost is known, not guessed: the day after the load test, pull the bill for the three services and record the number. Verify: <code>aws ce get-cost-and-usage</code> grouped by SERVICE shows the run cost measured in cents (expect roughly: 10k HTTP API requests &asymp; $0.01, 10k Lambda invocations at 128MB/&lt;100ms &asymp; free tier or &lt; $0.01, DynamoDB on-demand writes &asymp; $0.01&ndash;0.02).</p>`
  ],
  hints: `
<ul>
<li>Use a single "router" function keyed on <code>event.routeKey</code> &mdash; four functions means four roles and four canaries; you don't need that pain here.</li>
<li>HTTP API (apigatewayv2) payload format 2.0: the path parameter is <code>event.pathParameters.id</code> and the route key looks like <code>"GET /items/{id}"</code>.</li>
<li>The order that trips people on the canary: write code &rarr; <code>update-function-code</code> &rarr; <strong><code>publish-version</code></strong> (versions are immutable snapshots) &rarr; alias points at versions. If your API integration ends in just the function name, you are on $LATEST and the canary does nothing.</li>
<li>Each alias needs its own <code>lambda add-permission</code> for API Gateway &mdash; permissions are per-qualifier, and a missing one manifests as a mysterious 500 (not 403) from the HTTP API.</li>
<li>Wildcard check is stricter than it looks: <code>dynamodb:*Item</code> counts as a wildcard. Spell out all four actions.</li>
<li>For structured logs, print one <code>json.dumps</code> line per request; the <code>filter-log-events</code> JSON pattern syntax (<code>{ $.route = * }</code>) only matches events that are valid JSON, which is exactly the proof you want.</li>
<li>No <code>hey</code>? <code>ab -n 10000 -c 50</code> or a GNU parallel curl loop works; anything that holds ~50 concurrent connections will force Lambda to scale.</li>
</ul>`,
  walkthrough: `
<h3>1. Table and role</h3>
<pre><code>aws dynamodb create-table --table-name fieldkit-items \\
  --attribute-definitions AttributeName=pk,AttributeType=S \\
  --key-schema AttributeName=pk,KeyType=HASH \\
  --billing-mode PAY_PER_REQUEST</code></pre>
<p>On-demand because the dawn-spike traffic shape is exactly what provisioned capacity is bad at. The role: trust policy for <code>lambda.amazonaws.com</code>, then an inline policy with two statements &mdash; the four item actions on <code>arn:aws:dynamodb:REGION:ACCT:table/fieldkit-items</code>, and <code>logs:CreateLogStream</code> + <code>logs:PutLogEvents</code> on <code>arn:aws:logs:REGION:ACCT:log-group:/aws/lambda/fieldkit-api:*</code>. Create the log group yourself (<code>aws logs create-log-group</code>) so the role does not need <code>CreateLogGroup</code> &mdash; that is the statement people can never scope tightly.</p>
<h3>2. The function</h3>
<p>Python handler: parse <code>event.routeKey</code>, switch on the four routes, return dicts with <code>statusCode</code>/<code>body</code>. Include <code>"version": "v1"</code> in every body and log one structured line:</p>
<pre><code>print(json.dumps({"level": "info", "route": event["routeKey"],
                  "itemId": item_id, "requestId": context.aws_request_id}))</code></pre>
<pre><code>zip fn.zip app.py
aws lambda create-function --function-name fieldkit-api --runtime python3.12 \\
  --handler app.handler --zip-file fileb://fn.zip --role ROLE_ARN --memory-size 128
V1=$(aws lambda publish-version --function-name fieldkit-api --query Version --output text)
aws lambda create-alias --function-name fieldkit-api --name live --function-version $V1</code></pre>
<p>Publishing immediately and aliasing is the discipline: the alias is the only name infrastructure is allowed to know.</p>
<h3>3. HTTP API wired to the alias</h3>
<pre><code>API=$(aws apigatewayv2 create-api --name fieldkit --protocol-type HTTP \\
  --target arn:aws:lambda:REGION:ACCT:function:fieldkit-api:live --query ApiId --output text)</code></pre>
<p>The quick-create gives a $default route; replace it with the four explicit routes (<code>create-route</code> per route key, all pointing at the one integration). Grant invoke to the alias qualifier:</p>
<pre><code>aws lambda add-permission --function-name fieldkit-api:live --qualifier live \\
  --statement-id apigw --action lambda:InvokeFunction --principal apigateway.amazonaws.com \\
  --source-arn "arn:aws:execute-api:REGION:ACCT:API_ID/*"</code></pre>
<p>Run the CRUD curls against <code>https://API_ID.execute-api.REGION.amazonaws.com/items</code>. 404-on-deleted proves you're actually reading the table, not echoing.</p>
<h3>4. Canary</h3>
<p>Edit the code so <code>version</code> is <code>v2</code> (and any real change), then:</p>
<pre><code>aws lambda update-function-code --function-name fieldkit-api --zip-file fileb://fn.zip
V2=$(aws lambda publish-version --function-name fieldkit-api --query Version --output text)
aws lambda update-alias --function-name fieldkit-api --name live \\
  --routing-config AdditionalVersionWeights={"$V2"=0.1}</code></pre>
<p>(Weight syntax: the additional version gets the fraction; the alias's primary version keeps the rest.) A 100-iteration curl loop piped through <code>grep -c v2</code> should land near 10. This is a <em>real</em> canary: same API, same alias, live traffic split at the Lambda layer with no API Gateway redeploy. Watch <code>aws cloudwatch get-metric-statistics --namespace AWS/Lambda --dimensions Name=FunctionName,Value=fieldkit-api Name=ExecutedVersion,Value=$V2 --metric-name Errors</code> for the canary's error rate specifically &mdash; that per-version dimension is the whole reason aliases beat DIY weighted routing. Promote:</p>
<pre><code>aws lambda update-alias --function-name fieldkit-api --name live --function-version $V2 --routing-config AdditionalVersionWeights={}</code></pre>
<h3>5. Load test and evidence</h3>
<pre><code>hey -n 10000 -c 50 -m POST -d '{"reading": 42}' https://API_ID.execute-api.REGION.amazonaws.com/items</code></pre>
<p>Expect the summary to show all 2xx. Then interrogate CloudWatch: <code>Throttles</code> Sum = 0 (default account concurrency of 1,000 is nowhere near stressed by ~50 concurrent), <code>ConcurrentExecutions</code> Max &asymp; your <code>-c</code> value, and Duration p95 in the tens of ms. If you see throttles, your account has a lowered concurrency limit &mdash; check <code>aws lambda get-account-settings</code>.</p>
<h3>6. Read the bill</h3>
<p>Next morning: <code>aws ce get-cost-and-usage --time-period Start=RUN_DAY,End=NEXT_DAY --granularity DAILY --metrics UnblendedCost --group-by Type=DIMENSION,Key=SERVICE</code>. The point of the exercise: 10k requests cost about two cents, and the same math says 10 <em>million</em> requests is ~$25 &mdash; you now have the pilot's unit economics from measurement, not a pricing page.</p>`,
  teardown: `
<ol>
<li>Delete the HTTP API: <code>aws apigatewayv2 delete-api --api-id API_ID</code> (this removes routes, integrations, and stages with it).</li>
<li>Delete the Lambda alias, then the function (versions go with it): <code>aws lambda delete-alias --function-name fieldkit-api --name live</code>; <code>aws lambda delete-function --function-name fieldkit-api</code>.</li>
<li><strong>The log group does not delete itself</strong> and stored logs bill forever: <code>aws logs delete-log-group --log-group-name /aws/lambda/fieldkit-api</code>. If quick-create made an API Gateway access-log group, delete that too (<code>aws logs describe-log-groups --log-group-name-prefix /aws</code> and sweep).</li>
<li>Delete the table: <code>aws dynamodb delete-table --table-name fieldkit-items</code>. No backups/PITR were enabled, so nothing lingers; if you turned PITR on while exploring, it stops billing when the table dies, but check for on-demand backups: <code>aws dynamodb list-backups</code>.</li>
<li>IAM: <code>aws iam delete-role-policy</code> for the inline policy, then <code>aws iam delete-role --role-name ROLE</code>.</li>
<li><strong>Confirm $0:</strong> next day, <code>aws ce get-cost-and-usage</code> by SERVICE &mdash; Lambda, API Gateway, and DynamoDB lines should show only the load-test day's cents and zero after. DynamoDB on-demand with a deleted table cannot bill; if API Gateway still shows cost, you have another API somewhere: <code>aws apigatewayv2 get-apis</code>.</li>
</ol>`
});

/* ============================== MISSION 4: event-pipeline ============================== */

window.COURSE.registerMission({
  id: "event-pipeline",
  level: 2,
  title: "Event-driven file pipeline with a tested DLQ",
  time: "2-3 hours",
  cost: "&lt; $0.50 — S3/SQS/Lambda/DynamoDB at this volume round to zero; no idle-billing components",
  services: ["S3", "SQS", "Lambda", "DynamoDB", "CloudWatch"],
  brief: `
<p><strong>Ticket DS-301 &mdash; Docsnap (expense-report SaaS)</strong></p>
<p>Customers upload receipt files to us; today a cron on a pet server polls the upload bucket every five minutes and "usually" processes them. Last Tuesday it choked on one corrupt file and silently stopped &mdash; 4,000 receipts piled up before anyone noticed. We're replacing it with an event-driven pipeline before the next billing close.</p>
<p>Design as agreed in the arch review: upload bucket fires a notification into an <strong>SQS queue</strong> (the queue is the point &mdash; it absorbs the burst when a customer bulk-uploads 10k files and gives us retry semantics), a Lambda worker consumes it, writes a processing record to DynamoDB, and drops a derived artifact (checksum + metadata sidecar &mdash; stand-in for the real thumbnailer) into a <em>second</em> bucket. Never write derived output back into the source bucket; the recursive-trigger incident at your last job is exactly how that ends.</p>
<p>Two things must be <em>demonstrated</em>, not asserted, before this ships. First, the poison-file story: upload a file the worker cannot process and show it land in a <strong>dead-letter queue after exactly the configured retries</strong>, with the pipeline still flowing around it. Second, S3 events and SQS are both at-least-once &mdash; prove the worker is <strong>idempotent</strong> by forcing a duplicate delivery and showing exactly one record and one artifact. The 4,000-receipt incident happened because nobody ever tested the failure path. Test the failure path.</p>`,
  tasks: [
    `<p>Two buckets (uploads, derived), a work queue, and a DLQ wired via redrive policy with <code>maxReceiveCount=3</code>. Verify: <code>aws sqs get-queue-attributes --queue-url WORK_Q --attribute-names RedrivePolicy</code> shows the DLQ ARN and count 3.</p>`,
    `<p>S3 event notifications (<code>s3:ObjectCreated:*</code>, optionally prefix-scoped to <code>incoming/</code>) deliver to the work queue, and the queue policy admits only your bucket. Verify: upload a file, then within seconds <code>aws sqs get-queue-attributes --attribute-names ApproximateNumberOfMessages</code> ticks up (pause the Lambda mapping to observe it), and <code>aws sqs get-queue-attributes --attribute-names Policy</code> shows a <code>SourceArn</code> condition for the bucket.</p>`,
    `<p>The Lambda worker consumes via an event source mapping and, per uploaded object, writes one DynamoDB item (key = object key, storing size, SHA-256, timestamp) and one <code>KEY.meta.json</code> object to the derived bucket. Verify after a clean upload: <code>aws dynamodb get-item</code> returns the record and <code>aws s3 ls s3://DERIVED/</code> shows the sidecar.</p>`,
    `<p><strong>Idempotency proven:</strong> force a duplicate (upload the identical object again, or re-send the same S3 event with <code>aws sqs send-message</code> copied from a captured body). Result: still exactly <strong>one</strong> DynamoDB item for that key (a conditional write or content-hash check, not luck) and no duplicate/corrupted sidecar. Verify: <code>aws dynamodb scan --table-name TBL --select COUNT</code> unchanged, and your log line shows the duplicate detected and skipped.</p>`,
    `<p><strong>Poison file proven:</strong> upload a file your worker rejects (e.g. zero-byte, or key prefix <code>poison-</code>). The worker raises; SQS redelivers; after the 3rd receive the message moves to the DLQ. Verify: <code>aws sqs receive-message --queue-url DLQ_URL</code> returns the S3 event for the poison key, the work queue drains to 0, and DynamoDB has <strong>no</strong> item for the poison key.</p>`,
    `<p>The pipeline kept flowing around the poison: upload 3 good files interleaved with the poison file; all 3 process normally while the poison retries. Verify: 3 records, 3 sidecars, DLQ has exactly 1 message.</p>`,
    `<p>Failures are observable: the worker logs a structured JSON error (key, bucket, receive count if available, error class) and a CloudWatch alarm exists on the DLQ's <code>ApproximateNumberOfMessagesVisible</code> &gt; 0. Verify: <code>aws cloudwatch describe-alarms</code> shows it <code>ALARM</code> after the poison test.</p>`
  ],
  hints: `
<ul>
<li>Wiring order matters: the queue policy allowing <code>s3.amazonaws.com</code> (with <code>aws:SourceArn</code> = bucket ARN) must exist <em>before</em> <code>put-bucket-notification-configuration</code>, or S3 rejects the config with "Unable to validate the destination".</li>
<li>S3 sometimes drops an <code>s3:TestEvent</code> message into the queue when you attach the notification. If your worker assumes every message is an object event, that <em>is</em> your first poison message. Handle or ignore it deliberately.</li>
<li>One SQS message can carry multiple S3 records, and one Lambda invoke can carry multiple SQS messages (batch size). A single bad record failing the whole batch re-drives the good ones too &mdash; either set batch size 1 (fine here) or look up <code>ReportBatchItemFailures</code>.</li>
<li>Visibility timeout on the work queue must exceed the Lambda timeout (AWS recommends 6x); if it's shorter, in-flight messages get redelivered mid-processing, and your "idempotency test" starts running itself.</li>
<li>Idempotency mechanics: <code>put-item</code> with <code>attribute_not_exists(pk)</code> as a condition expression, catch <code>ConditionalCheckFailedException</code>, log and skip. Deciding what "same object re-uploaded with different content" means (compare ETag) is the interesting design question &mdash; pick a rule and state it.</li>
<li>To watch messages accumulate or count receives, temporarily disable the event source mapping (<code>aws lambda update-event-source-mapping --enabled false</code>) &mdash; much saner than fighting a live consumer.</li>
<li>The DLQ message's <code>ApproximateReceiveCount</code> attribute is your proof it was tried exactly 3 times &mdash; request it with <code>--attribute-names All</code>.</li>
</ul>`,
  walkthrough: `
<h3>1. Buckets, queues, table</h3>
<pre><code>ACCT=$(aws sts get-caller-identity --query Account --output text)
aws s3 mb s3://docsnap-uploads-$ACCT
aws s3 mb s3://docsnap-derived-$ACCT
DLQ=$(aws sqs create-queue --queue-name docsnap-dlq --query QueueUrl --output text)
DLQ_ARN=$(aws sqs get-queue-attributes --queue-url $DLQ --attribute-names QueueArn --query Attributes.QueueArn --output text)
WORK=$(aws sqs create-queue --queue-name docsnap-work --attributes \\
  '{"VisibilityTimeout":"120","RedrivePolicy":"{\\"deadLetterTargetArn\\":\\"DLQ_ARN_HERE\\",\\"maxReceiveCount\\":\\"3\\"}"}' \\
  --query QueueUrl --output text)
aws dynamodb create-table --table-name docsnap-files \\
  --attribute-definitions AttributeName=objectKey,AttributeType=S \\
  --key-schema AttributeName=objectKey,KeyType=HASH --billing-mode PAY_PER_REQUEST</code></pre>
<p>Visibility timeout 120s against a 30s Lambda timeout: redeliveries happen because processing <em>failed</em>, never because it was merely slow &mdash; conflating those two is how phantom duplicates are born.</p>
<h3>2. Queue policy, then notification</h3>
<p>Attach a queue policy allowing <code>sqs:SendMessage</code> to principal <code>s3.amazonaws.com</code> with condition <code>aws:SourceArn = arn:aws:s3:::docsnap-uploads-ACCT</code> (and <code>aws:SourceAccount</code> for belt-and-braces). Then:</p>
<pre><code>aws s3api put-bucket-notification-configuration --bucket docsnap-uploads-$ACCT \\
  --notification-configuration '{"QueueConfigurations":[{"QueueArn":"WORK_ARN",
    "Events":["s3:ObjectCreated:*"],
    "Filter":{"Key":{"FilterRules":[{"Name":"prefix","Value":"incoming/"}]}}}]}'</code></pre>
<p>The prefix filter is cheap insurance against ever notifying on your own writes if someone later points derived output at the same bucket. Expect the <code>s3:TestEvent</code> in the queue now &mdash; purge it or make the worker skip non-object events.</p>
<h3>3. The worker</h3>
<p>Python sketch of the decisions that matter:</p>
<pre><code>for record in event["Records"]:              # SQS records
    body = json.loads(record["body"])        # S3 event inside
    if body.get("Event") == "s3:TestEvent":  # deliberate skip
        continue
    for s3rec in body["Records"]:
        key = urllib.parse.unquote_plus(s3rec["s3"]["object"]["key"])
        if key.split("/")[-1].startswith("poison-"):
            raise RuntimeError("unprocessable: " + key)   # let SQS retry -&gt; DLQ
        data = s3.get_object(...)["Body"].read()
        digest = hashlib.sha256(data).hexdigest()
        try:
            table.put_item(Item={"objectKey": key, "sha256": digest, ...},
                ConditionExpression="attribute_not_exists(objectKey)")
        except ClientError as e:   # ConditionalCheckFailedException
            log({"level":"warn","msg":"duplicate, skipping","key":key}); continue
        s3.put_object(Bucket=DERIVED, Key=key + ".meta.json", Body=...)</code></pre>
<p>Two load-bearing details: <code>unquote_plus</code> (S3 event keys are URL-encoded &mdash; spaces arrive as <code>+</code> and this bug ships to prod constantly), and the conditional put <em>before</em> the derived write, so a duplicate delivery never overwrites the sidecar. The worker role needs: read on uploads bucket, write on derived bucket, <code>PutItem</code> on the table, SQS consume on the work queue, logs &mdash; all resource-scoped.</p>
<pre><code>aws lambda create-event-source-mapping --function-name docsnap-worker \\
  --event-source-arn WORK_ARN --batch-size 1</code></pre>
<p>Batch size 1 keeps the DLQ math exact: one message, three tries, done. (At real volume you'd batch and use ReportBatchItemFailures.)</p>
<h3>4. Prove the happy path, then idempotency</h3>
<pre><code>aws s3 cp receipt1.pdf s3://docsnap-uploads-$ACCT/incoming/receipt1.pdf
# ... item appears in DynamoDB, sidecar in derived bucket
aws s3 cp receipt1.pdf s3://docsnap-uploads-$ACCT/incoming/receipt1.pdf   # duplicate
aws dynamodb scan --table-name docsnap-files --select COUNT               # still 1</code></pre>
<p>The second upload genuinely re-fires the notification (S3 notifies on every PUT, not on change), the worker hits the condition failure, logs "duplicate, skipping". That log line is your at-least-once evidence.</p>
<h3>5. Prove the poison path</h3>
<pre><code>aws s3 cp empty.bin s3://docsnap-uploads-$ACCT/incoming/poison-empty.bin
# watch: aws logs tail /aws/lambda/docsnap-worker --follow</code></pre>
<p>You'll see three failing invocations spaced by the visibility timeout, then silence. Confirm: <code>receive-message</code> on the DLQ (with <code>--attribute-names All</code> &mdash; <code>ApproximateReceiveCount</code> reads 3... it reads the count <em>at last receive</em>, so expect 3), work queue at zero, no DynamoDB item, and your interleaved good files all processed during the retries. Finally the alarm: <code>put-metric-alarm</code> on the DLQ's <code>ApproximateNumberOfMessagesVisible</code>, threshold 0, comparison GreaterThanThreshold &mdash; it flips to ALARM within a few minutes. That alarm is the difference between this design and the cron: failure is now a page, not a 4,000-file surprise.</p>`,
  teardown: `
<ol>
<li>Delete the event source mapping first (its UUID is in <code>aws lambda list-event-source-mappings --function-name docsnap-worker</code>): <code>aws lambda delete-event-source-mapping --uuid UUID</code>.</li>
<li>Remove the bucket notification so S3 stops sending: <code>aws s3api put-bucket-notification-configuration --bucket docsnap-uploads-ACCT --notification-configuration '{}'</code>.</li>
<li>Delete the Lambda and <strong>its log group</strong>: <code>aws lambda delete-function --function-name docsnap-worker</code>; <code>aws logs delete-log-group --log-group-name /aws/lambda/docsnap-worker</code>.</li>
<li>Delete both queues (a queue with messages deletes fine; nothing to drain): <code>aws sqs delete-queue --queue-url WORK_URL</code>; <code>aws sqs delete-queue --queue-url DLQ_URL</code>.</li>
<li>Delete the alarm: <code>aws cloudwatch delete-alarms --alarm-names docsnap-dlq-alarm</code>.</li>
<li>Empty and delete both buckets: <code>aws s3 rb s3://docsnap-uploads-ACCT --force</code> and the same for derived. If versioning was ever enabled, purge versions and delete markers via <code>list-object-versions</code> + <code>delete-objects</code> before <code>delete-bucket</code>.</li>
<li>Delete the table (<code>aws dynamodb delete-table --table-name docsnap-files</code>) and the worker's IAM role (detach/delete policies first).</li>
<li><strong>Confirm $0:</strong> nothing in this stack idles-for-money, but verify tomorrow with Cost Explorer by SERVICE &mdash; S3, SQS, Lambda, DynamoDB, CloudWatch all at $0.00; the one recurring suspect is a forgotten log group, so also run <code>aws logs describe-log-groups --query "logGroups[].logGroupName"</code> and check nothing docsnap-related remains.</li>
</ol>`
});

/* ============================== MISSION 5: bedrock-rag ============================== */

window.COURSE.registerMission({
  id: "bedrock-rag",
  level: 3,
  title: "RAG over your own docs with Bedrock Knowledge Bases",
  time: "3-4 hours, ONE sitting",
  cost: "PRICIEST MISSION — OpenSearch Serverless bills a 2-OCU minimum (~$0.48/hr, ~$11.50/day, ~$345/month) from the moment the collection exists. Done in one sitting and torn down same day: $2-4 total. Forgotten for a month: real money.",
  services: ["Bedrock", "OpenSearch Serverless", "S3", "IAM"],
  brief: `
<p><strong>Ticket ML-12 &mdash; Halvard Marine (industrial equipment)</strong></p>
<p>Support engineers waste hours grepping 900 pages of internal service manuals for our tidal turbine controllers. The CTO wants a pilot: ask a question in English, get an answer <strong>grounded in our manuals with citations</strong> back to the exact source doc &mdash; because an ungrounded hallucination about torque limits is a safety incident, not a UX bug. Legal adds a second requirement after last month's press incident: the service must <strong>refuse to give competitor comparisons or pricing advice</strong>, enforced in the platform (a Guardrail), not in a system prompt someone can talk their way past.</p>
<p>Build the pilot on Bedrock Knowledge Bases: a handful of fake-but-plausible service docs in S3, embeddings in an OpenSearch Serverless vector index, retrieval-augmented answers via the runtime API, and a Guardrail you can demonstrate blocking a forbidden prompt. Prove the grounding both ways: a fact that exists <em>only</em> in your docs comes back cited, and a question your docs don't answer gets a refusal rather than confident fiction.</p>
<p><strong>Read the cost box above before you start.</strong> The vector store bills by the hour whether you query it or not &mdash; this is a one-sitting mission, and the teardown is part of the acceptance. Schedule the block, build it, demo it, destroy it.</p>`,
  tasks: [
    `<p>Model access is enabled in your region for an embeddings model (e.g. <code>amazon.titan-embed-text-v2:0</code>) and a text model (e.g. a Claude model). Verify: <code>aws bedrock list-foundation-models --query "modelSummaries[?modelLifecycle.status=='ACTIVE'].modelId"</code> lists them, and a direct <code>aws bedrock-runtime converse</code> call to the text model returns a completion.</p>`,
    `<p>An S3 docs bucket holds 4-6 short invented service manuals (markdown or text) containing at least one <strong>verifiable planted fact</strong> that no public model could know (e.g. "the HM-440 controller's overtemp cutoff is 87.5 C, error code E-4471"). Verify: <code>aws s3 ls</code> shows them; keep the planted fact written down.</p>`,
    `<p>A Knowledge Base exists with the docs bucket as data source and an OpenSearch Serverless vector index as store, and the ingestion job finished: <code>aws bedrock-agent get-ingestion-job ... --query "ingestionJob.{status:status,stats:statistics}"</code> shows <code>COMPLETE</code> with your document count indexed.</p>`,
    `<p>Grounded Q&amp;A works with citations: <code>aws bedrock-agent-runtime retrieve-and-generate</code> asking about the planted fact returns the right number <strong>and</strong> a <code>citations</code> array whose <code>retrievedReferences</code> point at the correct <code>s3://</code> URI. Verify by reading the JSON output.</p>`,
    `<p>Negative grounding proven: a plausible question your docs do not cover (e.g. a model number you never wrote about) yields "I could not find this in the knowledge base"-style output, not invented specs. Paste both Q&amp;A transcripts side by side as your evidence.</p>`,
    `<p>A Guardrail with a denied topic ("competitor comparisons and purchasing advice") is created, <strong>versioned</strong>, and demonstrated: <code>aws bedrock-runtime apply-guardrail</code> (or a guarded <code>retrieve-and-generate</code>) on a prompt like "Which competitor's controller should I buy instead?" returns <code>action: GUARDRAIL_INTERVENED</code> with your configured blocked message, while a normal service question passes through untouched.</p>`,
    `<p><strong>Teardown is acceptance:</strong> same day, the OpenSearch Serverless collection is deleted. Verify: <code>aws opensearchserverless list-collections</code> returns empty, and next-day Cost Explorer shows the OpenSearch line stopped at a few dollars and is $0 the day after.</p>`
  ],
  hints: `
<ul>
<li>Model access is a per-region, sometimes per-model enablement (Bedrock console &rarr; Model access). <code>AccessDeniedException</code> on invoke with correct IAM almost always means model access, not IAM.</li>
<li>Everything must be in <strong>one region</strong> that supports Knowledge Bases (us-east-1 and us-west-2 are safest): bucket, collection, KB, models.</li>
<li>The console's KB creation wizard creates the OpenSearch collection, its encryption/network/data-access policies, the vector index, and the KB service role in one flow. Doing all of that by CLI means hand-writing three aoss policy documents and creating the index via the OpenSearch data API with signed requests &mdash; legitimate work, but budget an extra hour and remember the OCU meter is running. Console for the create, CLI for everything else, is a defensible senior choice here.</li>
<li>Ingestion is not automatic on upload: you must start (and re-run after doc changes) the ingestion job, <code>aws bedrock-agent start-ingestion-job</code>.</li>
<li><code>retrieve-and-generate</code> wants the <em>model ARN</em>, not the bare model ID &mdash; and in many regions newer models require an inference-profile ARN instead. If you get a ValidationException naming on-demand throughput, that's this.</li>
<li>Guardrails must be <strong>versioned</strong> (<code>create-guardrail-version</code>) before most call paths accept them; DRAFT works only in limited places. <code>apply-guardrail</code> is the fastest way to demo a block because it tests the guardrail in isolation.</li>
<li>Cost sanity: 2 OCUs is the <em>dev</em> minimum (redundancy disabled); default redundant config is 4 OCUs &mdash; double everything in the cost box. Check which one the wizard gave you.</li>
</ul>`,
  walkthrough: `
<h3>0. Preconditions (clock starts later)</h3>
<p>Enable model access for Titan Embed v2 and a Claude text model in us-east-1 via console (one-time, free). Sanity-check with <code>aws bedrock-runtime converse --model-id MODEL --messages ...</code>. Do all of this <em>before</em> creating any OpenSearch resources &mdash; nothing above bills while idle.</p>
<h3>1. Docs with a planted fact</h3>
<pre><code>ACCT=$(aws sts get-caller-identity --query Account --output text)
aws s3 mb s3://halvard-docs-$ACCT --region us-east-1</code></pre>
<p>Write 4-6 short markdown manuals (200-500 words each) for invented products: HM-440 controller, HM-220 pump, etc. Plant the fact: "overtemp cutoff 87.5 C, error E-4471, service part HM-P-9913". Upload with <code>aws s3 cp docs/ s3://halvard-docs-$ACCT/ --recursive</code>. The planted fact is your ground truth &mdash; a public model cannot know it, so a correct cited answer can only have come from retrieval.</p>
<h3>2. Knowledge Base (OCU meter starts HERE)</h3>
<p>Console: Bedrock &rarr; Knowledge Bases &rarr; Create. Pick the S3 data source, Titan Embed Text v2 for embeddings, "Quick create" OpenSearch Serverless vector store &mdash; and note whether it provisions 2 or 4 OCUs. The wizard is doing real work you should be able to name: an <code>aoss</code> collection of type VECTORSEARCH, an encryption policy, a network policy, a data access policy granting the KB service role index rights, the vector index itself (with the embedding dimension matching Titan v2's 1024), and an IAM service role that can read your bucket and call the embeddings model. Then ingest and watch it:</p>
<pre><code>aws bedrock-agent start-ingestion-job --knowledge-base-id KB_ID --data-source-id DS_ID
aws bedrock-agent get-ingestion-job --knowledge-base-id KB_ID --data-source-id DS_ID \\
  --ingestion-job-id JOB_ID --query "ingestionJob.{s:status,stats:statistics}"</code></pre>
<p>COMPLETE with numberOfDocumentsScanned = your doc count means chunk &rarr; embed &rarr; index all worked.</p>
<h3>3. Query with citations</h3>
<pre><code>aws bedrock-agent-runtime retrieve-and-generate --input '{"text":"What is the overtemp cutoff for the HM-440 and what error code does it raise?"}' \\
  --retrieve-and-generate-configuration '{"type":"KNOWLEDGE_BASE","knowledgeBaseConfiguration":{
    "knowledgeBaseId":"KB_ID",
    "modelArn":"arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"}}'</code></pre>
<p>(Swap in whatever text model you enabled; if you hit the on-demand-throughput ValidationException, use the inference profile ARN from <code>aws bedrock list-inference-profiles</code>.) Read the output properly: <code>output.text</code> should say 87.5 C / E-4471, and <code>citations[].retrievedReferences[].location.s3Location.uri</code> must point at the manual that contains it. That URI is the difference between an answer and an auditable answer. Now the negative case &mdash; ask about the nonexistent "HM-990": the KB retrieves nothing relevant and the response says it cannot find the information. If it instead invents specs, your chunks are too big or your docs too samey &mdash; look at the <code>retrieve</code> API output alone to see what the vector search actually returned.</p>
<h3>4. Guardrail</h3>
<pre><code>aws bedrock create-guardrail --name halvard-legal \\
  --topic-policy-config '{"topicsConfig":[{"name":"CompetitorAdvice",
    "definition":"Comparisons with competitor products or advice on purchasing competitor equipment",
    "examples":["Which competitor controller should I buy?"],"type":"DENY"}]}' \\
  --blocked-input-messaging "This assistant cannot discuss competitor products." \\
  --blocked-outputs-messaging "This assistant cannot discuss competitor products."
aws bedrock create-guardrail-version --guardrail-identifier GR_ID</code></pre>
<p>Demo the block in isolation with <code>apply-guardrail</code>:</p>
<pre><code>aws bedrock-runtime apply-guardrail --guardrail-identifier GR_ID --guardrail-version 1 \\
  --source INPUT --content '[{"text":{"text":"Which competitor turbine controller should I buy instead of the HM-440?"}}]'</code></pre>
<p>Expect <code>"action": "GUARDRAIL_INTERVENED"</code> and your blocked message; re-run with a legitimate service question and expect <code>NONE</code>. For end-to-end, pass the guardrail in <code>retrieve-and-generate</code>'s <code>generationConfiguration.guardrailConfiguration</code> and show the same pair. The point for Legal: this fires <em>before</em> the model, is versioned config in the platform, and no prompt-injection in the chat layer can switch it off.</p>
<h3>5. Tear it down NOW</h3>
<p>You built it, you demoed it, the meter is running. Go straight to teardown &mdash; it is task 7 for a reason.</p>`,
  teardown: `
<p><strong>Do this the same day. The collection bills ~$0.48-0.96/hr while it exists, queries or not.</strong></p>
<ol>
<li>Delete the Knowledge Base (also detaches its data source): <code>aws bedrock-agent delete-knowledge-base --knowledge-base-id KB_ID</code>. Confirm gone with <code>list-knowledge-bases</code>.</li>
<li><strong>Delete the OpenSearch Serverless collection &mdash; the KB delete does NOT do this for you:</strong> <code>aws opensearchserverless batch-get-collection --names YOUR_COLLECTION</code> to get the ID, then <code>aws opensearchserverless delete-collection --id COLL_ID</code>. Verify <code>list-collections</code> returns empty. This single step is the whole cost story.</li>
<li>Delete the aoss policies the wizard created (they're free but will collide with a future run by name): <code>aws opensearchserverless list-security-policies --type encryption</code> (and <code>network</code>), <code>delete-security-policy</code> for each; <code>aws opensearchserverless list-access-policies --type data</code>, <code>delete-access-policy</code>.</li>
<li>Delete the Guardrail: <code>aws bedrock delete-guardrail --guardrail-identifier GR_ID</code>.</li>
<li>Empty and delete the docs bucket: <code>aws s3 rb s3://halvard-docs-ACCT --force</code>.</li>
<li>Delete the KB service role the wizard created (name starts with <code>AmazonBedrockExecutionRoleForKnowledgeBase</code>): detach policies, delete role. Also sweep <code>aws logs describe-log-groups</code> for anything Bedrock-related if you enabled invocation logging.</li>
<li>Model access can stay enabled &mdash; it costs nothing without invocations.</li>
<li><strong>Confirm the money stopped:</strong> next day, <code>aws ce get-cost-and-usage --time-period Start=BUILD_DAY,End=DAY_AFTER --granularity DAILY --metrics UnblendedCost --group-by Type=DIMENSION,Key=SERVICE</code>. Expect: OpenSearch Serverless a few dollars on build day and <strong>$0.00 the day after</strong> &mdash; if it is not zero, a collection still exists somewhere (<code>list-collections</code> in every region you touched). Bedrock line: cents for embeddings + queries, then zero.</li>
</ol>`
});
