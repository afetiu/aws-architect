/* Ops & incident-response missions — deploy-the-bug-then-debug scenarios.
 * Schema: see content/AUTHORING.md. One registerMission call per mission. */

/* ============================================================ */
/* Mission 1: broken-vpc                                        */
/* ============================================================ */

window.COURSE.registerMission({
  id: "broken-vpc",
  level: 2,
  title: "The app can't reach anything",
  time: "60-90 min",
  cost: "About $0.06/hour while the stack is up (NAT gateway + t3.micro + public IPv4 dominate). Under $1 if you tear down the same session; roughly $1.60 if you forget it overnight. Reachability Analyzer costs $0.10 per analysis run.",
  services: ["VPC", "EC2", "Reachability Analyzer", "VPC Flow Logs", "CloudFormation", "Systems Manager"],
  brief: `
<p>PagerDuty fires at 02:14. A newly migrated batch worker in the <em>payments</em> VPC has been silent for four hours: no package updates applied, no telemetry, and the fleet-management agent shows the box as <strong>offline</strong> even though EC2 says it is <strong>running</strong>. The engineer who built the VPC left last month; the change ticket just says "standard private-subnet pattern with NAT". You have the template they used. Deploy it into your own account and treat it as inherited infrastructure: <strong>do not study the template for bugs first</strong> — deploy it, then diagnose from the outside like you would in a real incident, where the template is buried in someone else's repo.</p>
<p>Save this as <code>broken-vpc.yaml</code> and deploy with <code>aws cloudformation deploy --template-file broken-vpc.yaml --stack-name mission-broken-vpc --capabilities CAPABILITY_IAM</code>:</p>
<pre><code>AWSTemplateFormatVersion: '2010-09-09'
Description: payments VPC - private worker behind NAT (inherited)
Parameters:
  LatestAmi:
    Type: AWS::SSM::Parameter::Value&lt;AWS::EC2::Image::Id&gt;
    Default: /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64
Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.66.0.0/16
      EnableDnsSupport: true
      EnableDnsHostnames: true
      Tags: [{Key: Name, Value: mission-broken-vpc}]
  IGW:
    Type: AWS::EC2::InternetGateway
  IGWAttach:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties: {VpcId: !Ref VPC, InternetGatewayId: !Ref IGW}
  PublicSubnet:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.66.0.0/24
      MapPublicIpOnLaunch: true
      Tags: [{Key: Name, Value: mission-public}]
  PrivateSubnet:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.66.1.0/24
      Tags: [{Key: Name, Value: mission-private}]
  PublicRT:
    Type: AWS::EC2::RouteTable
    Properties: {VpcId: !Ref VPC}
  PublicDefaultRoute:
    Type: AWS::EC2::Route
    DependsOn: IGWAttach
    Properties:
      RouteTableId: !Ref PublicRT
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref IGW
  PublicRTAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties: {SubnetId: !Ref PublicSubnet, RouteTableId: !Ref PublicRT}
  NatEip:
    Type: AWS::EC2::EIP
    Properties: {Domain: vpc}
  NatGw:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt NatEip.AllocationId
      SubnetId: !Ref PublicSubnet
  PrivateRT:
    Type: AWS::EC2::RouteTable
    Properties: {VpcId: !Ref VPC}
  PrivateRTAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties: {SubnetId: !Ref PrivateSubnet, RouteTableId: !Ref PrivateRT}
  PrivateNacl:
    Type: AWS::EC2::NetworkAcl
    Properties: {VpcId: !Ref VPC}
  NaclIn90:
    Type: AWS::EC2::NetworkAclEntry
    Properties:
      NetworkAclId: !Ref PrivateNacl
      RuleNumber: 90
      Protocol: 6
      RuleAction: deny
      CidrBlock: 0.0.0.0/0
      PortRange: {From: 1024, To: 65535}
  NaclIn100:
    Type: AWS::EC2::NetworkAclEntry
    Properties:
      NetworkAclId: !Ref PrivateNacl
      RuleNumber: 100
      Protocol: -1
      RuleAction: allow
      CidrBlock: 0.0.0.0/0
  NaclOut100:
    Type: AWS::EC2::NetworkAclEntry
    Properties:
      NetworkAclId: !Ref PrivateNacl
      RuleNumber: 100
      Protocol: -1
      RuleAction: allow
      Egress: true
      CidrBlock: 0.0.0.0/0
  NaclAssoc:
    Type: AWS::EC2::SubnetNetworkAclAssociation
    Properties: {SubnetId: !Ref PrivateSubnet, NetworkAclId: !Ref PrivateNacl}
  AppSg:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: payments worker sg
      VpcId: !Ref VPC
      SecurityGroupEgress:
        - IpProtocol: icmp
          FromPort: 8
          ToPort: -1
          CidrIp: 127.0.0.1/32
  InstanceRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal: {Service: ec2.amazonaws.com}
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
  InstanceProfile:
    Type: AWS::IAM::InstanceProfile
    Properties: {Roles: [!Ref InstanceRole]}
  App:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: !Ref LatestAmi
      InstanceType: t3.micro
      SubnetId: !Ref PrivateSubnet
      IamInstanceProfile: !Ref InstanceProfile
      SecurityGroupIds: [!Ref AppSg]
      Tags: [{Key: Name, Value: mission-broken-app}]
Outputs:
  InstanceId: {Value: !Ref App}
  VpcId: {Value: !Ref VPC}
</code></pre>
<p>The instance has an SSM role, so once the network works, Session Manager will connect and <code>dnf upgrade</code> (or <code>yum update</code>) will succeed. Right now neither does. There are <strong>three independent faults</strong> between the instance and the internet. Find all three, name each one with evidence <em>before</em> you fix it, then repair the path.</p>
`,
  tasks: [
    `<p><strong>Deploy the broken stack</strong> and confirm the failure mode from the outside: <code>aws cloudformation deploy --template-file broken-vpc.yaml --stack-name mission-broken-vpc --capabilities CAPABILITY_IAM</code>, then show that the instance is <em>running</em> per <code>aws ec2 describe-instances</code> but absent from <code>aws ssm describe-instance-information</code> even 10+ minutes after launch. That mismatch is your incident symptom.</p>`,
    `<p><strong>Keep a written fault log.</strong> Acceptance for this mission is that each fault appears in your log with (a) the layer it lives at (route table / NACL / security group), (b) the exact resource ID, and (c) the piece of evidence that revealed it — <em>logged before you applied the fix</em>. Fixing something you have not named does not count.</p>`,
    `<p><strong>Find fault #1 by route inspection.</strong> Dump the private subnet's route table with <code>aws ec2 describe-route-tables --filters Name=association.subnet-id,Values=SUBNET_ID</code> and state precisely what is missing compared to the "standard private-subnet pattern with NAT" the ticket promised. Fix it with <code>aws ec2 create-route</code> and record the fix command in the log.</p>`,
    `<p><strong>Find fault #2 with Reachability Analyzer.</strong> Create a network insights path from the instance to the NAT gateway on TCP 443 (<code>aws ec2 create-network-insights-path</code> then <code>start-network-insights-analysis</code>), run the analysis, and capture the explanation code it returns. The finding must name the blocking resource. Fix it via <code>aws ec2 authorize-security-group-egress</code> and re-run the analysis to show the path is now reachable.</p>`,
    `<p><strong>Find fault #3 with VPC Flow Logs.</strong> Enable flow logs on the private subnet (or the instance ENI) to a CloudWatch Logs group, generate traffic (reboot the instance or wait for the SSM agent's retry), and produce at least one <code>REJECT</code> record showing return traffic to an ephemeral port being dropped. Name the exact NACL rule number responsible, then remove or fix that entry with <code>aws ec2 delete-network-acl-entry</code>.</p>`,
    `<p><strong>Prove end-to-end recovery.</strong> <code>aws ssm describe-instance-information</code> now lists the instance as Online; open a session with <code>aws ssm start-session --target INSTANCE_ID</code> and run <code>sudo dnf upgrade -y --releasever=latest</code> (or <code>sudo yum update -y</code>) successfully. Paste the first few lines of repo metadata download as proof of internet egress.</p>`,
    `<p><strong>Write the two-line postmortem</strong> for each fault: what a correct change-review checklist item would have caught it (e.g. "every private route table must have a 0.0.0.0/0 target reviewed against design"). Three faults, three checklist items.</p>`
  ],
  hints: `
<p>Work the OSI stack from the routing layer up, and let each tool tell you about the layer it owns:</p>
<ul>
<li>A running instance that never registers with SSM almost always means the agent cannot reach the SSM endpoints — that is a <em>network egress</em> problem, not an SSM problem. Start at routing.</li>
<li>Compare the private route table against what "private subnet with NAT" must contain. Two routes minimum. Count yours.</li>
<li>Reachability Analyzer evaluates route tables, security groups, and NACLs statically — but it analyzes the <em>forward</em> path you give it. It is excellent at catching security-group misses; think about which direction of SG rules matter for an outbound connection.</li>
<li>Security groups are stateful, NACLs are not. If the outbound SYN leaves but the connection still hangs, ask: on which port does the <em>reply</em> come back, and what evaluates that reply statelessly? Flow logs will show you the verdict per packet — filter the log events for the word REJECT and look at the destination port and the direction.</li>
<li>NACL rules evaluate in ascending rule-number order and the first match wins. A deny at 90 beats an allow at 100 every time.</li>
</ul>
`,
  walkthrough: `
<h3>Root cause</h3>
<p>Three planted faults, one per network control layer: (1) the private route table <code>PrivateRT</code> has only the implicit local route — no <code>0.0.0.0/0</code> via the NAT gateway; (2) the instance security group <code>AppSg</code> has its default allow-all egress replaced by a useless ICMP-to-loopback rule, so no outbound TCP is permitted; (3) the private subnet's NACL has an inbound <strong>deny</strong> at rule 90 for TCP 1024-65535, which kills all return traffic to ephemeral ports even though rule 100 allows everything — first match wins.</p>
<h3>Diagnosis path</h3>
<p>Symptom confirmation — running but unmanaged:</p>
<pre><code>aws ec2 describe-instances --filters Name=tag:Name,Values=mission-broken-app \
  --query 'Reservations[0].Instances[0].[InstanceId,State.Name,SubnetId]'
aws ssm describe-instance-information   # instance absent
</code></pre>
<p><strong>Fault 1 — route table.</strong></p>
<pre><code>aws ec2 describe-route-tables \
  --filters Name=association.subnet-id,Values=SUBNET_ID \
  --query 'RouteTables[0].Routes'
# Only the 10.66.0.0/16 local route. No default route at all.
aws ec2 create-route --route-table-id rtb-XXXX \
  --destination-cidr-block 0.0.0.0/0 --nat-gateway-id nat-XXXX
</code></pre>
<p><strong>Fault 2 — security group egress, via Reachability Analyzer.</strong></p>
<pre><code>aws ec2 create-network-insights-path --source i-XXXX \
  --destination nat-XXXX --protocol tcp --destination-port 443
aws ec2 start-network-insights-analysis --network-insights-path-id nip-XXXX
aws ec2 describe-network-insights-analyses --network-insights-analysis-ids nia-XXXX \
  --query 'NetworkInsightsAnalyses[0].[NetworkPathFound,Explanations[0].ExplanationCode]'
# =&gt; false, "ENI_SG_RULES_MISMATCH" pointing at AppSg: no egress rule matches tcp/443
aws ec2 authorize-security-group-egress --group-id sg-XXXX \
  --ip-permissions IpProtocol=-1,IpRanges=[{CidrIp=0.0.0.0/0}]
</code></pre>
<p>Re-running the analysis now returns <code>NetworkPathFound: true</code> — but the analyzer modeled the forward path to the NAT gateway; the instance still cannot complete a TCP handshake.</p>
<p><strong>Fault 3 — NACL, via flow logs.</strong> Stateless NACLs must explicitly allow inbound return traffic on ephemeral ports (1024-65535). Rule 90 denies exactly that range, and it evaluates before the allow at 100.</p>
<pre><code>aws logs create-log-group --log-group-name /mission/broken-vpc-flow
aws ec2 create-flow-logs --resource-type Subnet --resource-ids SUBNET_ID \
  --traffic-type REJECT --log-group-name /mission/broken-vpc-flow \
  --deliver-logs-permission-arn arn:aws:iam::ACCOUNT:role/FLOW_LOG_ROLE
# wait a few minutes for the SSM agent to retry, then:
aws logs filter-log-events --log-group-name /mission/broken-vpc-flow \
  --filter-pattern REJECT
# records show srcport 443 dstport 4xxxx ... REJECT: replies to ephemeral ports dropped
aws ec2 delete-network-acl-entry --network-acl-id acl-XXXX \
  --rule-number 90 --ingress
</code></pre>
<p><strong>Verify.</strong> Within a couple of minutes the agent registers:</p>
<pre><code>aws ssm describe-instance-information \
  --query 'InstanceInformationList[0].[InstanceId,PingStatus]'
aws ssm start-session --target i-XXXX
sudo dnf upgrade -y     # metadata downloads =&gt; egress works end to end
</code></pre>
<h3>The generalized lesson</h3>
<p>Outbound connectivity from a private subnet traverses three independently-administered control layers, and each has a distinct failure signature and a distinct best tool: <strong>route tables</strong> fail silently (packets never leave — inspect routes directly), <strong>security groups</strong> fail statefully in the direction of the rule (Reachability Analyzer models this perfectly without sending a packet), and <strong>NACLs</strong> fail statelessly on the return path (only observable in flow logs, because the forward path looks fine). "The instance is running but unreachable/unmanaged" is nearly always network, not compute. And the SSM-agent-as-canary trick generalizes: any agent that phones home gives you a free, continuous connectivity probe from inside the instance without needing SSH.</p>
`,
  teardown: `
<p>Order matters — flow logs and the manually added route/SG rules live outside the stack:</p>
<ol>
<li>Delete the flow log and its log group: <code>aws ec2 delete-flow-logs --flow-log-ids fl-XXXX</code> then <code>aws logs delete-log-group --log-group-name /mission/broken-vpc-flow</code>. Log groups are the classic forgettable here.</li>
<li>Delete the Reachability Analyzer artifacts: <code>aws ec2 delete-network-insights-analysis --network-insights-analysis-id nia-XXXX</code> and <code>aws ec2 delete-network-insights-path --network-insights-path-id nip-XXXX</code>.</li>
<li>Delete the stack: <code>aws cloudformation delete-stack --stack-name mission-broken-vpc</code> and wait: <code>aws cloudformation wait stack-delete-complete --stack-name mission-broken-vpc</code>. This removes the instance, NAT gateway, EIP, subnets, NACL, SG, and IAM role. Your manual <code>create-route</code> and SG egress rule die with their parents.</li>
<li>If the delete hangs on the VPC, look for a leftover ENI: <code>aws ec2 describe-network-interfaces --filters Name=vpc-id,Values=vpc-XXXX</code> — NAT gateway ENIs can linger a few minutes; re-run the stack delete after they disappear.</li>
<li>Confirm the EIP is gone: <code>aws ec2 describe-addresses</code> must not list the NAT EIP (an orphaned EIP bills ~$3.60/month).</li>
<li>Remove the local template file if you like, and check <code>aws ssm describe-instance-information</code> shows the instance gone (managed-instance entries age out on their own).</li>
<li><strong>Next day:</strong> open Cost Explorer, filter to yesterday and today, group by Service. EC2-Other (NAT gateway hours, EIP) and CloudWatch must show only the hours the stack actually lived. Any continuing charge means something above was missed.</li>
</ol>
`
});

/* ============================================================ */
/* Mission 2: runaway-bill                                      */
/* ============================================================ */

window.COURSE.registerMission({
  id: "runaway-bill",
  level: 1,
  title: "Finance escalation: the bill tripled",
  time: "45-60 min active, spread over 2 days (billing data lags ~24h)",
  cost: "The deliberately leaked resources run about $2.40/day (NAT gateway ~$1.08, ALB ~$0.54, idle EIP ~$0.12, 200 GB gp2 ~$0.66, snapshot ~$0.16 in us-east-1). Worst case for the 48-hour mission window: about $5. Cost Explorer API calls are $0.01 each — budget ~$0.50 for the investigation.",
  services: ["Cost Explorer", "Budgets", "Cost Anomaly Detection", "EC2", "EBS", "ELB", "VPC"],
  brief: `
<p>Email from the VP of Engineering, subject "?????": Finance flagged that the AWS bill for your team's sandbox account went from ~$40/month to ~$130/month over two months. Nobody owns it. Your job this quarter's ops rotation: find every leak, kill it correctly, and make sure nobody has to do this by hand again.</p>
<p>To make it real, you first play the careless team. Run the block below <strong>once, today</strong>, in your default region — then close the terminal and do not look at it again. Tomorrow you investigate using billing tools only.</p>
<pre><code># Day 0: create the mess (default VPC assumed). Run once, then walk away.
SUBNET=$(aws ec2 describe-subnets --filters Name=default-for-az,Values=true \
  --query 'Subnets[0].SubnetId' --output text)
SUBNET2=$(aws ec2 describe-subnets --filters Name=default-for-az,Values=true \
  --query 'Subnets[1].SubnetId' --output text)
AZ=$(aws ec2 describe-subnets --subnet-ids $SUBNET \
  --query 'Subnets[0].AvailabilityZone' --output text)
ALLOC=$(aws ec2 allocate-address --query AllocationId --output text)
aws ec2 create-nat-gateway --subnet-id $SUBNET --allocation-id $ALLOC
aws ec2 allocate-address                              # a second, never-attached EIP
VOL=$(aws ec2 create-volume --availability-zone $AZ --size 200 \
  --volume-type gp2 --query VolumeId --output text)
sleep 30
aws ec2 create-snapshot --volume-id $VOL --description "pre-migration backup 2024"
aws elbv2 create-load-balancer --name forgotten-alb --type application \
  --subnets $SUBNET $SUBNET2
</code></pre>
<p><strong>Wait 24 hours</strong> (Cost Explorer needs a day of usage data). Then investigate cold: the acceptance criteria below require you to produce a per-resource leak list with a monthly dollar figure for each — derived from Cost Explorer, usage types, and resource APIs, <em>not</em> from remembering what the script did. Pretend a departed colleague ran it. Then remediate each leak the right way (not just "delete everything"), and install guardrails: a budget alert and an anomaly monitor.</p>
`,
  tasks: [
    `<p><strong>Produce the leak list from billing data alone.</strong> Deliverable: a table of at least five wasteful resources, each with resource type, resource ID, region, and estimated monthly cost at current run-rate. Your evidence trail must start from <code>aws ce get-cost-and-usage</code> grouped by <code>USAGE_TYPE</code> (e.g. NatGateway-Hours, ElasticIP:IdleAddress, EBS:VolumeUsage, LoadBalancerUsage) and only then drill into resource APIs to get IDs. Fetching the CloudTrail of your own Day-0 session is cheating.</p>`,
    `<p><strong>Verify each dollar figure against pricing.</strong> For each leak show the arithmetic (e.g. NAT gateway: 730 h x $0.045 = $32.85/mo before data processing). Numbers within 20% of the real run-rate pass.</p>`,
    `<p><strong>Fix the NAT gateway the right way.</strong> Delete it (<code>aws ec2 delete-nat-gateway</code>) and release its EIP, and — because the "right way" is architectural — write two sentences on when a <strong>gateway VPC endpoint</strong> for S3/DynamoDB removes the need for NAT entirely, and add the S3 gateway endpoint to the default VPC with <code>aws ec2 create-vpc-endpoint</code> to prove you know the mechanics (it is free).</p>`,
    `<p><strong>Fix the storage leaks the right way.</strong> Migrate the 200 GB gp2 volume to gp3 in place with <code>aws ec2 modify-volume --volume-type gp3</code> (capture before/after $/month: $0.10 vs $0.08 per GB-month), then — since it is unattached and unneeded — snapshot-or-delete with justification. Delete the stale snapshot after checking nothing references it (<code>aws ec2 describe-images --filters Name=block-device-mapping.snapshot-id,...</code>).</p>`,
    `<p><strong>Release the idle EIP and delete the idle ALB</strong>, after demonstrating the ALB has no listeners/targets (<code>aws elbv2 describe-listeners</code>, <code>describe-target-groups</code>) — i.e., show the evidence you would need before deleting a load balancer in a real account.</p>`,
    `<p><strong>Install the guardrails.</strong> Create a monthly cost budget at your normal spend + 20% with an email alert at 80% actual and 100% forecast (<code>aws budgets create-budget</code> + <code>create-notification</code>), and a Cost Anomaly Detection monitor over all services with a daily alert subscription (<code>aws ce create-anomaly-monitor</code> + <code>create-anomaly-subscription</code>). Show both exist via the CLI.</p>`,
    `<p><strong>Close the loop:</strong> the day after remediation, re-run your Day-1 Cost Explorer query and show the leaked usage types trending to zero. Attach the two daily totals (leaky day vs clean day).</p>`
  ],
  hints: `
<ul>
<li>Group by <code>USAGE_TYPE</code>, not by service. "EC2-Other" as a service bucket hides everything interesting; usage types like <code>NatGateway-Hours</code>, <code>ElasticIP:IdleAddress</code> (or the newer <code>PublicIPv4:InUseAddress</code>), <code>EBS:VolumeUsage</code> vs <code>EBS:VolumeUsage.gp3</code>, <code>EBS:SnapshotUsage</code>, and <code>LoadBalancerUsage</code> name the culprit class directly.</li>
<li>Cost Explorer tells you <em>what kind</em> of thing is bleeding; the service APIs tell you <em>which one</em>: <code>describe-nat-gateways</code>, <code>describe-addresses</code> (an address with no <code>AssociationId</code> is idle), <code>describe-volumes --filters Name=status,Values=available</code>, <code>describe-snapshots --owner-ids self</code>, <code>describe-load-balancers</code>.</li>
<li>Hourly-granularity or resource-level Cost Explorer data costs extra / needs enabling — daily granularity with usage-type grouping is enough for everything here.</li>
<li>Budgets: the <code>--notifications-with-subscribers</code> shape is fiddly; write the JSON to files and pass with <code>file://</code>.</li>
<li>Anomaly Detection needs about ten days of history to get smart — creating it today is still the right move; it is free.</li>
</ul>
`,
  walkthrough: `
<h3>Root cause</h3>
<p>Five classic idle-resource leaks: a NAT gateway with zero traffic ($32.85/mo), its EIP plus a second never-associated EIP ($3.65/mo each under public-IPv4 pricing), a 200 GB unattached gp2 volume ($20/mo), a 200 GB snapshot ($10/mo), and an ALB with no listeners ($16.43/mo + minimal LCU). Total ~$90/month — matching Finance's delta.</p>
<h3>Diagnosis path</h3>
<p>Day 1, start wide with usage types:</p>
<pre><code>aws ce get-cost-and-usage --time-period Start=2026-07-21,End=2026-07-23 \
  --granularity DAILY --metrics UnblendedCost UsageQuantity \
  --group-by Type=DIMENSION,Key=USAGE_TYPE \
  --query 'ResultsByTime[].Groups[?Metrics.UnblendedCost.Amount&gt;\'0.001\']'
</code></pre>
<p>The non-zero usage types are the map: <code>NatGateway-Hours</code>, <code>PublicIPv4:InUseAddress</code> / <code>ElasticIP:IdleAddress</code>, <code>EBS:VolumeUsage</code>, <code>EBS:SnapshotUsage</code>, <code>LoadBalancerUsage</code>. Drill each into a resource ID:</p>
<pre><code>aws ec2 describe-nat-gateways --filter Name=state,Values=available
aws ec2 describe-addresses --query 'Addresses[?AssociationId==null]'
aws ec2 describe-volumes --filters Name=status,Values=available \
  --query 'Volumes[].[VolumeId,Size,VolumeType]'
aws ec2 describe-snapshots --owner-ids self \
  --query 'Snapshots[].[SnapshotId,VolumeSize,StartTime,Description]'
aws elbv2 describe-load-balancers --query 'LoadBalancers[].[LoadBalancerArn,LoadBalancerName]'
aws elbv2 describe-listeners --load-balancer-arn ALB_ARN   # =&gt; empty: truly idle
</code></pre>
<p>Arithmetic (us-east-1): NAT 730 x 0.045 = <strong>$32.85</strong>; each public IPv4 730 x 0.005 = <strong>$3.65</strong>; gp2 200 x 0.10 = <strong>$20.00</strong>; snapshot ~200 x 0.05 = <strong>$10.00</strong> (less if blocks compress); ALB 730 x 0.0225 = <strong>$16.43</strong>.</p>
<h3>The fixes, the right way</h3>
<pre><code>aws ec2 delete-nat-gateway --nat-gateway-id nat-XXXX     # wait for state: deleted
aws ec2 release-address --allocation-id eipalloc-AAAA    # NAT's EIP, after deletion
aws ec2 release-address --allocation-id eipalloc-BBBB    # the idle one
VPC=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true \
  --query 'Vpcs[0].VpcId' --output text)
RTB=$(aws ec2 describe-route-tables --filters Name=vpc-id,Values=$VPC \
  --query 'RouteTables[0].RouteTableId' --output text)
aws ec2 create-vpc-endpoint --vpc-id $VPC --service-name com.amazonaws.us-east-1.s3 \
  --vpc-endpoint-type Gateway --route-table-ids $RTB      # free; kills S3-via-NAT cost
aws ec2 modify-volume --volume-id vol-XXXX --volume-type gp3   # 20% cheaper, same perf floor
aws ec2 delete-volume --volume-id vol-XXXX               # unattached and unowned =&gt; delete
aws ec2 delete-snapshot --snapshot-id snap-XXXX          # after checking no AMI references it
aws elbv2 delete-load-balancer --load-balancer-arn ALB_ARN
</code></pre>
<p>Guardrails (JSON payloads in files):</p>
<pre><code>aws budgets create-budget --account-id ACCOUNT_ID \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
aws ce create-anomaly-monitor --anomaly-monitor \
  '{"MonitorName":"all-services","MonitorType":"DIMENSIONAL","MonitorDimension":"SERVICE"}'
aws ce create-anomaly-subscription --anomaly-subscription \
  '{"SubscriptionName":"daily-alerts","MonitorArnList":["MONITOR_ARN"],"Subscribers":[{"Type":"EMAIL","Address":"you@example.com"}],"Frequency":"DAILY","ThresholdExpression":{"Dimensions":{"Key":"ANOMALY_TOTAL_IMPACT_ABSOLUTE","MatchOptions":["GREATER_THAN_OR_EQUAL"],"Values":["5"]}}}'
</code></pre>
<h3>The generalized lesson</h3>
<p>Cost investigations have a fixed shape: <strong>usage type → resource class → resource ID → owner → decision</strong>. Grouping by service is how people conclude "EC2 is expensive" and stop; grouping by usage type is how you find that EC2-Other is really a NAT gateway nobody uses. Second lesson: every fix here had a "right way" that is not just deletion — gateway endpoints remove the need for NAT for S3/DynamoDB traffic, gp3 is a strict cost win over gp2 at equal baseline performance, and an ALB should be proven idle (no listeners, no target health) before it dies. Third: detection must be automated. Humans notice a tripled bill after two months; a forecast-based budget alert and an anomaly monitor notice in days. The $90/month you found is exactly the kind of spend the AWS Well-Architected cost pillar calls "unused resources" — the cheapest workload optimization that exists.</p>
`,
  teardown: `
<p>Remediation <em>was</em> most of the teardown. Verify nothing survived:</p>
<ol>
<li><code>aws ec2 describe-nat-gateways --filter Name=state,Values=available,pending</code> — must be empty; a deleted NAT gateway lingers in state deleted harmlessly.</li>
<li><code>aws ec2 describe-addresses</code> — must list zero allocations. Un-released EIPs are the most common leftover.</li>
<li><code>aws ec2 describe-volumes --filters Name=status,Values=available</code> and <code>aws ec2 describe-snapshots --owner-ids self</code> — both empty.</li>
<li><code>aws elbv2 describe-load-balancers</code> — empty. Also delete any target groups that were auto-created if you experimented: <code>aws elbv2 delete-target-group</code>.</li>
<li>Decide the guardrails' fate: the budget and anomaly monitor are free and genuinely useful — recommended to <strong>keep</strong>. To remove instead: <code>aws budgets delete-budget --account-id ACCOUNT_ID --budget-name NAME</code>, <code>aws ce delete-anomaly-subscription</code>, <code>aws ce delete-anomaly-monitor</code>.</li>
<li>The S3 gateway endpoint is free; keep it, or remove with <code>aws ec2 delete-vpc-endpoints --vpc-endpoint-ids vpce-XXXX</code>.</li>
<li><strong>Next day:</strong> Cost Explorer, daily granularity, group by USAGE_TYPE, filtered to the last 3 days: NatGateway-Hours, LoadBalancerUsage, EBS:VolumeUsage, and idle-address lines must all read $0.00 for the final day. If any usage type still bills, chase its resource with the Day-1 drill-down commands.</li>
</ol>
`
});

/* ============================================================ */
/* Mission 3: dr-drill                                          */
/* ============================================================ */

window.COURSE.registerMission({
  id: "dr-drill",
  level: 3,
  title: "Prove the RTO",
  time: "90-120 min (two drill runs)",
  cost: "Pennies. DynamoDB on-demand + global table replication for a handful of items, two small S3 buckets with versioning/replication, Lambda invocations, and CloudTrail-free API calls — realistically under $1 even with both regions running for a day. No NAT, no EC2.",
  services: ["DynamoDB Global Tables", "S3 Cross-Region Replication", "Lambda", "IAM", "CloudWatch"],
  brief: `
<p>Your company's DR plan says: "Tier-2 services: RTO 30 minutes, RPO 5 minutes, warm standby in us-west-2." An auditor asked the obvious question — <em>"when did you last test that?"</em> — and the room went quiet. You have been volunteered to run the first real game-day. The rule that makes this a level-3 mission: <strong>a DR plan you have not executed under a stopwatch is a hypothesis, not a plan.</strong></p>
<p>You will build a deliberately tiny but architecturally honest service in region A (us-east-1): a DynamoDB table holding application state, an S3 bucket holding a JSON config object, and a Lambda function behind a function URL that reads both and returns them. Then you wire continuous replication: the table becomes a Global Table with a replica in us-west-2, and the bucket gets Cross-Region Replication to a us-west-2 bucket. A tiny heartbeat writer stamps a timestamped item into the table every 30 seconds — that heartbeat is how you will <em>measure</em> RPO instead of guessing it.</p>
<p>Then, at a moment you choose (write it on a sticky note, do not pre-stage anything), you simulate the loss of us-east-1 by deleting the region-A Lambda and its function URL and treating the region-A table and bucket as unreachable. Start the stopwatch. Recover in us-west-2: deploy the same function against the replica table and replica bucket, mint a new function URL, and stop the clock when a curl returns correct data. Record RTO (stopwatch) and RPO (now minus the newest replicated heartbeat). Then do the whole failover <strong>again</strong>, scripted, and beat your first time. The delta between run 1 and run 2 is the entire argument for runbooks.</p>
`,
  tasks: [
    `<p><strong>Build region A.</strong> In us-east-1: DynamoDB table <code>dr-state</code> (on-demand, partition key <code>pk</code>), versioned S3 bucket with a <code>config.json</code> object, and a Python Lambda with a function URL (auth type NONE is acceptable for this drill) that returns the config plus the latest heartbeat item. Acceptance: <code>curl</code> of the function URL returns JSON containing both.</p>`,
    `<p><strong>Wire replication.</strong> Convert the table to a Global Table (<code>aws dynamodb update-table --replica-updates</code> creating a us-west-2 replica) and configure S3 CRR from bucket A to a versioned bucket B in us-west-2 with an IAM replication role. Acceptance: an item written in us-east-1 is readable from the us-west-2 replica within seconds (<code>aws dynamodb get-item --region us-west-2</code>), and a re-uploaded <code>config.json</code> shows <code>REPLICA</code> status in bucket B.</p>`,
    `<p><strong>Start the heartbeat and let it run at least 10 minutes:</strong> a loop writing item <code>pk=heartbeat</code> with an ISO-8601 timestamp attribute every 30 s to the us-east-1 endpoint. This is your RPO instrument — no measurement, no mission.</p>`,
    `<p><strong>Run drill #1 cold.</strong> At your chosen moment: kill the heartbeat, delete the region-A function URL and Lambda (<code>aws lambda delete-function-url-config</code>, <code>delete-function</code>), start a timer, and recover in us-west-2 by hand (create execution role if needed, create function from the same zip with region-B env vars, add function URL, curl until correct JSON returns). Acceptance: a written record — failure declared at T0, service restored at T1, <strong>RTO = T1 - T0</strong>, and <strong>RPO = T1_data</strong> (age of newest heartbeat visible in the us-west-2 replica at restore time, which should be under a minute thanks to global tables).</p>`,
    `<p><strong>Write the runbook</strong> from what you just did: exact ordered commands, parameterized by region, in a shell script <code>failover.sh</code>. Every command you had to look up during drill #1 must appear in it.</p>`,
    `<p><strong>Run drill #2 with the runbook and beat drill #1.</strong> Restore region A first (redeploy the Lambda there), restart the heartbeat, then fail over again executing only <code>failover.sh</code>. Acceptance: measured RTO #2 strictly less than RTO #1, both numbers written down, plus one sentence on the biggest time sink you eliminated.</p>`,
    `<p><strong>Report like an auditor would want:</strong> a short table — declared RTO/RPO targets (30 min / 5 min), drill 1 measured, drill 2 measured, pass/fail per target — and two follow-up actions (e.g. pre-created region-B execution role, Route 53 failover record or CloudFront origin failover instead of a changed URL).</p>`
  ],
  hints: `
<ul>
<li>Global table conversion requires the table to have streams enabled (<code>NEW_AND_OLD_IMAGES</code>); <code>update-table</code> can enable them in the same call or do it first.</li>
<li>S3 CRR checklist that eats people's time: versioning ON on <em>both</em> buckets, a replication role trusting <code>s3.amazonaws.com</code> with source-read + destination-replicate permissions, and remember CRR only replicates objects written <em>after</em> the rule exists — re-upload config.json to prove it. Check <code>aws s3api head-object</code> for <code>ReplicationStatus</code>.</li>
<li>Decide before the drill what "restored" means: first 200 from curl with <em>correct</em> data. Write the success criterion down first — drills where the finish line is decided during the run always look better than they were.</li>
<li>Where does drill-1 time actually go? Usually: IAM role propagation (~10 s but feels eternal), rebuilding the zip, and looking up CLI syntax. Notice these — they are what the runbook and pre-staging remove in drill 2.</li>
<li>RPO measurement: the newest heartbeat in the <em>replica</em> at restore time vs the last heartbeat written before you pulled the plug. With global tables typical lag is around a second — your RPO will be dominated by heartbeat period, which is itself a lesson.</li>
<li>Function URLs are per-region and change on recreation — clients need the new URL. That pain is the setup for the follow-up action item about DNS-level failover.</li>
</ul>
`,
  walkthrough: `
<h3>What "good" looks like</h3>
<p>Region A build (us-east-1), condensed:</p>
<pre><code>aws dynamodb create-table --region us-east-1 --table-name dr-state \
  --attribute-definitions AttributeName=pk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES
aws s3api create-bucket --bucket dr-cfg-a-YOURSUFFIX --region us-east-1
aws s3api put-bucket-versioning --bucket dr-cfg-a-YOURSUFFIX \
  --versioning-configuration Status=Enabled
aws s3 cp config.json s3://dr-cfg-a-YOURSUFFIX/config.json
aws lambda create-function --region us-east-1 --function-name dr-reader \
  --runtime python3.12 --handler app.handler --zip-file fileb://app.zip \
  --role arn:aws:iam::ACCOUNT:role/dr-reader-role \
  --environment 'Variables={TABLE=dr-state,BUCKET=dr-cfg-a-YOURSUFFIX}'
aws lambda create-function-url-config --region us-east-1 \
  --function-name dr-reader --auth-type NONE
aws lambda add-permission --region us-east-1 --function-name dr-reader \
  --action lambda:InvokeFunctionUrl --principal '*' \
  --function-url-auth-type NONE --statement-id public
</code></pre>
<p>Replication:</p>
<pre><code>aws dynamodb update-table --region us-east-1 --table-name dr-state \
  --replica-updates '[{"Create":{"RegionName":"us-west-2"}}]'
aws s3api create-bucket --bucket dr-cfg-b-YOURSUFFIX --region us-west-2 \
  --create-bucket-configuration LocationConstraint=us-west-2
aws s3api put-bucket-versioning --bucket dr-cfg-b-YOURSUFFIX \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-replication --bucket dr-cfg-a-YOURSUFFIX \
  --replication-configuration file://crr.json     # role + rule to bucket B
aws s3 cp config.json s3://dr-cfg-a-YOURSUFFIX/config.json   # rewrite so CRR picks it up
aws s3api head-object --bucket dr-cfg-a-YOURSUFFIX --key config.json \
  --query ReplicationStatus       # =&gt; COMPLETED (eventually)
</code></pre>
<p>Heartbeat (any shell): a while-true loop calling <code>aws dynamodb put-item</code> with <code>pk=heartbeat</code> and <code>ts</code> = current UTC ISO timestamp, sleeping 30.</p>
<h3>The drill and the numbers</h3>
<p>Declare failure, stamp T0, destroy region A compute:</p>
<pre><code>date -u +%Y-%m-%dT%H:%M:%SZ                      # T0 - write it down
aws lambda delete-function-url-config --region us-east-1 --function-name dr-reader
aws lambda delete-function --region us-east-1 --function-name dr-reader
</code></pre>
<p>Recover in us-west-2: same zip, env vars pointing at <code>dr-state</code> (the replica is the same table name in the other region) and bucket B; create function URL; curl until the JSON is correct; stamp T1. Then read the newest heartbeat from the replica:</p>
<pre><code>aws dynamodb get-item --region us-west-2 --table-name dr-state \
  --key '{"pk":{"S":"heartbeat"}}' --consistent-read
</code></pre>
<p><strong>RTO = T1 - T0.</strong> Typical cold first run: 12-25 minutes, dominated by fumbling for role ARNs, zip rebuilds, and CLI syntax. <strong>RPO</strong> = (last pre-failure heartbeat) - (newest replicated heartbeat) — with global tables' ~1 s replication lag this is effectively 0-30 s, bounded by your heartbeat period, not by AWS. Both numbers beat the declared 30 min / 5 min targets — record pass.</p>
<p>Drill #2 with <code>failover.sh</code> (pre-created region-B role, pre-staged zip in region B or an S3 copy, parameterized commands) typically lands at 2-5 minutes. The delta is the lesson: <em>the runbook is the DR plan; everything else is intention.</em></p>
<h3>The generalized lesson</h3>
<p>Three durable ideas. First, <strong>RTO is a property of your practiced procedure, not of your architecture</strong> — the same architecture produced a 20-minute and a 3-minute recovery depending only on preparation. Second, <strong>RPO must be measured by an instrument</strong> (the heartbeat), because replication lag claims are unverifiable otherwise; global tables and CRR are asynchronous, so RPO is nonzero by construction and you should know its real value. Third, the residual pain — clients must learn the new function URL — is exactly why real designs put Route 53 failover records, CloudFront origin failover, or API Gateway custom domains in front, so that recovery changes routing, not identity. Promote that from "follow-up action" to instinct.</p>
`,
  teardown: `
<p>Two regions to sweep — do B, then A:</p>
<ol>
<li>Stop the heartbeat loop if it is still running.</li>
<li>us-west-2: <code>aws lambda delete-function-url-config --region us-west-2 --function-name dr-reader</code> then <code>aws lambda delete-function --region us-west-2 --function-name dr-reader</code>. Delete the drill's CloudWatch log groups in <strong>both</strong> regions: <code>aws logs delete-log-group --log-group-name /aws/lambda/dr-reader --region us-west-2</code> (and us-east-1) — log groups outlive their functions and are the #1 forgettable.</li>
<li>Remove the us-west-2 table replica first: <code>aws dynamodb update-table --region us-east-1 --table-name dr-state --replica-updates '[{"Delete":{"RegionName":"us-west-2"}}]'</code>, wait for it to disappear, then <code>aws dynamodb delete-table --region us-east-1 --table-name dr-state</code>.</li>
<li>S3: remove the replication config (<code>aws s3api delete-bucket-replication --bucket dr-cfg-a-YOURSUFFIX</code>), then empty both buckets <em>including all versions and delete markers</em> — versioned buckets will not delete otherwise: use <code>aws s3api list-object-versions</code> and delete each version, or the console's "Empty" with versions. Then <code>aws s3api delete-bucket</code> for both.</li>
<li>Delete the drill IAM roles (Lambda execution roles in both regions if separate, the S3 replication role): <code>aws iam delete-role-policy</code> / <code>detach-role-policy</code> then <code>aws iam delete-role</code>.</li>
<li>Remove local artifacts: app.zip, crr.json, failover.sh (or keep failover.sh — it is the actual deliverable).</li>
<li><strong>Next day:</strong> Cost Explorer, group by Service, filter to both regions: DynamoDB, S3, and Lambda lines should show only fractions of a cent and then zero. Any recurring S3 storage cost means a versioned bucket was not fully emptied.</li>
</ol>
`
});

/* ============================================================ */
/* Mission 4: locked-out                                        */
/* ============================================================ */

window.COURSE.registerMission({
  id: "locked-out",
  level: 2,
  title: "The intern attached a deny policy",
  time: "60-75 min",
  cost: "Effectively $0. IAM and STS are free; CloudTrail's 90-day event history and lookup-events are free. The only conceivable cost is a few CloudWatch/S3 pennies if you already have a trail configured.",
  services: ["IAM", "STS", "CloudTrail", "AWS CLI"],
  brief: `
<p>Slack, 16:41, #platform-help: <em>"uh, is anyone else getting AccessDenied on literally everything?"</em> An intern, trying to "lock down S3 a bit", attached a hand-written policy with a broad <code>Deny</code> to the shared engineering IAM user — and because explicit deny beats every allow, the entire team's CLI just died mid-deploy. In the postmortem you will run today, <strong>you play both the intern and the responder.</strong></p>
<p><strong>Safety rails first — read all of this before touching anything.</strong> Do this in a <em>sandbox account only</em>. Never on your AWS Organizations management account, never on root, never on the only admin identity you own. The entire mission hinges on building the fire escape <em>before</em> starting the fire: a separate break-glass admin role, with a live assumed session open in a second terminal, verified working, before you attach anything. IAM role sessions survive policy changes to the identity that assumed them only until they expire — note your session's expiry time and finish the lockout phase well inside it. If you use a dedicated test IAM user (recommended) rather than your real working identity, the blast radius is a user nobody else depends on.</p>
<p>The exercise: create a test user with admin access and CLI keys, work as that user, then attach an over-broad deny policy to it — the kind an intern writes when they mean "deny public S3" but ship "deny most of AWS". Experience the real symptoms: which calls fail, which still work, what the error text actually says (it names the policy type — learn to read it). Then recover using only the break-glass session, and reconstruct the incident from CloudTrail into a written timeline: who attached what, when, and the spray of AccessDenied events that followed. The timeline is the deliverable — in a real incident, "what exactly happened and when" is worth more than the fix.</p>
`,
  tasks: [
    `<p><strong>Build the fire escape first.</strong> Create role <code>break-glass-admin</code> trusted by your own account with <code>AdministratorAccess</code>, assume it (<code>aws sts assume-role</code>), export the temporary credentials in a <em>second terminal</em>, and verify with <code>aws sts get-caller-identity</code> plus one real admin call (e.g. <code>aws iam list-users</code>). Record the session expiry. Acceptance: screenshot/paste of the working break-glass identity <strong>before</strong> any deny policy exists.</p>`,
    `<p><strong>Create the victim.</strong> IAM user <code>lockout-victim</code> with <code>AdministratorAccess</code> attached and an access key, configured as CLI profile <code>victim</code>. Verify it works: <code>aws s3 ls --profile victim</code>, <code>aws ec2 describe-instances --profile victim</code>.</p>`,
    `<p><strong>Play the intern.</strong> As the victim (that is the realistic part — people lock <em>themselves</em> out), attach an inline policy named <code>s3-lockdown-attempt</code> whose statement is <code>Effect: Deny</code> on actions <code>s3:*</code>, <code>ec2:*</code>, <code>iam:*</code>, <code>cloudwatch:*</code>, <code>logs:*</code> for resource <code>*</code>. Acceptance: the <code>put-user-policy</code> call succeeds (it is the last thing that will).</p>`,
    `<p><strong>Document the symptoms like a responder.</strong> As the victim, run at least four calls and record verbatim results: <code>aws s3 ls</code> (denied), <code>aws iam list-attached-user-policies</code> (denied — you cannot even see what hit you), <code>aws sts get-caller-identity</code> (works — STS is not denied; this is the diagnostic pivot), and one non-denied service e.g. <code>aws dynamodb list-tables</code> (works). Acceptance: a note explaining what the pattern of failures tells you about the <em>shape</em> of the deny, and the exact error phrase that reveals an explicit deny in an identity-based policy.</p>`,
    `<p><strong>Recover using only the break-glass session.</strong> From terminal 2: list the victim's inline policies, fetch the policy document (<code>aws iam get-user-policy</code>), save it as evidence, then <code>aws iam delete-user-policy</code>. Verify the victim profile works again. Acceptance: recovery performed without touching your primary identity's credentials.</p>`,
    `<p><strong>Reconstruct the timeline from CloudTrail.</strong> Using <code>aws cloudtrail lookup-events</code> (event history; allow 5-15 min delivery lag), produce a written incident timeline with at least: the <code>PutUserPolicy</code> event (time, principal, source IP), two or more <code>AccessDenied</code> events during the outage window (service, action, error message), and the <code>DeleteUserPolicy</code> recovery event with the break-glass principal visible in <code>userIdentity</code>. Acceptance: timeline in chronological order, each entry citing the CloudTrail event that proves it.</p>`,
    `<p><strong>Write the prevention paragraph:</strong> three controls that would have prevented or contained this for real (e.g. permissions boundary on all human users, SCP denying <code>iam:PutUserPolicy</code> outside a pipeline role, mandatory peer review via IAM Access Analyzer policy checks), one sentence each on the mechanism.</p>`
  ],
  hints: `
<ul>
<li>Order of operations is the whole safety story: fire escape, then fire. If you find yourself attaching the deny policy first "just to see", stop.</li>
<li>The AccessDenied message is more informative than people read: it distinguishes "no identity-based policy allows" from "with an explicit deny in an identity-based policy". The latter phrase tells you a Deny statement exists and roughly where. Read your errors verbatim.</li>
<li>Which calls still work maps the deny's shape: <code>sts:GetCallerIdentity</code> is almost never denied (and cannot be denied by IAM policy at all) — it is the responder's first move to establish <em>who am I actually running as</em>.</li>
<li>The victim cannot run <code>iam:Get*</code>/<code>List*</code> on itself — the deny covers iam:*. That is why the break-glass role, an <em>unaffected principal</em>, is non-negotiable.</li>
<li>CloudTrail: filter with <code>--lookup-attributes AttributeKey=EventName,AttributeValue=PutUserPolicy</code>, and remember denied calls are still logged, with <code>errorCode: AccessDenied</code> in the event JSON. Lag is 5-15 minutes; go get coffee, do not conclude logging is broken.</li>
<li>In the events, compare <code>userIdentity</code> between the attach event and the recovery event — proving <em>which principal did what</em> is exactly what you would owe a real postmortem.</li>
</ul>
`,
  walkthrough: `
<h3>Root cause</h3>
<p>An inline identity policy with <code>Effect: Deny</code> on <code>s3:*, ec2:*, iam:*, cloudwatch:*, logs:*</code> attached to the working user. In IAM's evaluation logic an explicit deny wins over any allow, including the attached <code>AdministratorAccess</code> — so the user kept a shiny admin policy and lost the account anyway. The self-inflicted twist: <code>iam:*</code> in the deny removes the user's ability to see or remove the policy, converting a mistake into a lockout.</p>
<h3>The build and the fire</h3>
<pre><code># Terminal 2 - fire escape FIRST
aws iam create-role --role-name break-glass-admin \
  --assume-role-policy-document file://trust.json      # trust: your account root
aws iam attach-role-policy --role-name break-glass-admin \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
aws sts assume-role --role-arn arn:aws:iam::ACCOUNT:role/break-glass-admin \
  --role-session-name fire-escape --duration-seconds 3600
# export AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN, then:
aws sts get-caller-identity     # =&gt; assumed-role/break-glass-admin/fire-escape

# Terminal 1 - the intern moment (as profile victim)
aws iam put-user-policy --user-name lockout-victim \
  --policy-name s3-lockdown-attempt --policy-document file://deny.json \
  --profile victim
</code></pre>
<h3>Symptoms and what they teach</h3>
<pre><code>aws s3 ls --profile victim
# AccessDenied ... with an explicit deny in an identity-based policy
aws iam list-attached-user-policies --user-name lockout-victim --profile victim
# AccessDenied - the deny blinds you to itself
aws sts get-caller-identity --profile victim
# WORKS - STS untouched; you can always establish identity
aws dynamodb list-tables --profile victim
# WORKS - maps the deny's boundary: it is action-scoped, not account-wide
</code></pre>
<p>The phrase <em>"with an explicit deny in an identity-based policy"</em> is the tell: not a missing allow, not an SCP, not a boundary — a Deny statement on this principal. The working/failing call pattern outlines which services the statement covers.</p>
<h3>Recovery and forensics</h3>
<pre><code># Terminal 2 (break-glass)
aws iam list-user-policies --user-name lockout-victim
aws iam get-user-policy --user-name lockout-victim \
  --policy-name s3-lockdown-attempt &gt; evidence-policy.json
aws iam delete-user-policy --user-name lockout-victim \
  --policy-name s3-lockdown-attempt
aws s3 ls --profile victim        # service restored

# Timeline reconstruction (after ~15 min lag)
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=PutUserPolicy \
  --query 'Events[].[EventTime,Username,CloudTrailEvent]'
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=lockout-victim \
  --start-time 2026-07-22T16:30:00Z --max-results 50
# grep the CloudTrailEvent JSON for errorCode AccessDenied entries
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=DeleteUserPolicy
</code></pre>
<p>A passing timeline reads like: <em>16:41:07 PutUserPolicy (lockout-victim, IP x.x.x.x) — 16:41:30-16:52 eleven AccessDenied events across s3/iam/ec2 (outage window) — 16:55:12 DeleteUserPolicy by assumed-role/break-glass-admin/fire-escape — 16:55:40 first successful s3 ListBuckets (recovery confirmed).</em> Every claim carries an event.</p>
<h3>The generalized lesson</h3>
<p>Four things transfer directly to production. (1) <strong>Explicit deny is absolute</strong> — it beats AdministratorAccess, and a deny that includes <code>iam:*</code> is self-blinding, which is why real lockdowns use conditions and NotAction carve-outs for the admin path. (2) <strong>Break-glass access is a prerequisite, not a response</strong>: an unaffected principal — separate role, separate trust path, tested regularly — is the only reason this was a 15-minute incident instead of an AWS Support case. (3) <strong>Error text is diagnostic data</strong>: AWS now tells you which policy <em>type</em> denied you; responders who read it skip an hour of guessing. (4) <strong>CloudTrail logs denied calls too</strong>, which makes the outage window itself reconstructable — your timeline is evidence-grade, and the same technique (lookup by Username, grep errorCode) is your first move in any real access incident.</p>
`,
  teardown: `
<p>Everything here is IAM — free, but leaving spare admin identities lying around is its own incident-in-waiting:</p>
<ol>
<li>Confirm the deny policy is gone: <code>aws iam list-user-policies --user-name lockout-victim</code> returns empty.</li>
<li>Delete the victim's access key: <code>aws iam list-access-keys --user-name lockout-victim</code> then <code>aws iam delete-access-key --user-name lockout-victim --access-key-id AKIA...</code>. Remove the <code>victim</code> profile from your ~/.aws/credentials.</li>
<li>Detach and delete the victim: <code>aws iam detach-user-policy --user-name lockout-victim --policy-arn arn:aws:iam::aws:policy/AdministratorAccess</code> then <code>aws iam delete-user --user-name lockout-victim</code>.</li>
<li>Decide the break-glass role's fate deliberately. Keeping a tested break-glass role is genuinely good practice <strong>if</strong> you protect it (MFA condition on the trust policy, alerting on its use). If you will not maintain that, remove it: <code>aws iam detach-role-policy --role-name break-glass-admin --policy-arn arn:aws:iam::aws:policy/AdministratorAccess</code> then <code>aws iam delete-role --role-name break-glass-admin</code>. Do not keep an unmonitored admin role.</li>
<li>Unset the temporary session env vars in terminal 2 (close the terminal); the STS session dies at expiry regardless.</li>
<li>Delete local artifacts containing policy JSON and especially any file where you pasted credentials: trust.json, deny.json, evidence-policy.json.</li>
<li><strong>Next day:</strong> Cost Explorer sanity check — this mission should contribute $0.00; while you are there, confirm no other mission left residue. Also glance at CloudTrail event history for any use of break-glass-admin you did not make.</li>
</ol>
`
});

/* ============================================================ */
/* Mission 5: throttled-api                                     */
/* ============================================================ */

window.COURSE.registerMission({
  id: "throttled-api",
  level: 2,
  title: "p99 exploded at launch",
  time: "75-90 min",
  cost: "Under $1. HTTP API at $1.00/million requests, Lambda invocations within free tier for this volume, DynamoDB provisioned at 1 RCU/1 WCU costs ~$0.02/day (the throttling is the point, not the capacity bill), a few CloudWatch API calls. Worst case with generous load testing: ~$1.",
  services: ["API Gateway (HTTP API)", "Lambda", "DynamoDB", "CloudWatch"],
  brief: `
<p>Launch day. Marketing's email went out at 09:00; at 09:04 the product channel is a wall of "the app is spinning". Your dashboard tells the story: request p50 is fine, <strong>p99 has gone from 40 ms to multiple seconds</strong>, and a growing slice of requests return 500. The stack is the classic serverless read path — HTTP API in front of a Lambda that reads one item from DynamoDB — which "cannot be overloaded", according to the design review. Except someone sized the table in provisioned mode at <strong>1 RCU / 1 WCU</strong> to save money in dev, and that setting shipped.</p>
<p>You will build exactly that undersized stack, hammer it, and watch it fail the way real serverless stacks fail: not with a clean error wall, but with a p99/p50 divergence as SDK retries mask throttles until they cannot. DynamoDB will emit <code>ThrottledRequests</code>; Lambda durations will balloon (the default boto3 retry policy burns seconds before surfacing <code>ProvisionedThroughputExceededException</code>); a fraction of requests will die as 500s. Then fix it in escalating order like an on-call engineer with a cost-conscious manager: <strong>first capacity</strong> (switch the table to on-demand — or raise RCUs — and prove recovery with numbers), <strong>then client behavior</strong> (proper exponential backoff with jitter via the SDK's adaptive retry mode, and understand what it does and does not fix), and <strong>finally, on paper, caching</strong> (where DAX or a response cache would sit, and what read pattern justifies it). Acceptance is entirely numeric: before/after p99 and throttle counts pulled from CloudWatch, not vibes.</p>
`,
  tasks: [
    `<p><strong>Deploy the undersized stack:</strong> DynamoDB table <code>launch-items</code> (provisioned, 1 RCU / 1 WCU, key <code>pk</code>) seeded with one item; Python Lambda <code>launch-api</code> doing a <code>get_item</code> on that key; HTTP API with a route proxying to it. Acceptance: a single <code>curl</code> to the invoke URL returns the item in well under 100 ms.</p>`,
    `<p><strong>Load test the failure into existence.</strong> Use <code>hey -z 60s -c 25 URL</code> (or ab, artillery, or a Python thread loop making ~50-100 req/s for 60 s). Acceptance: the run's client-side report shows a p99 at least 10x the p50, and/or non-2xx responses.</p>`,
    `<p><strong>Capture the BEFORE evidence from CloudWatch</strong> (this is the incident record): DynamoDB <code>ThrottledRequests</code> / <code>ReadThrottleEvents</code> greater than zero for the window (<code>aws cloudwatch get-metric-statistics</code>), Lambda <code>Duration</code> p99 (use <code>--extended-statistics p99</code>), API Gateway or load-tool p99 latency, and 5xx count. Write the four numbers down.</p>`,
    `<p><strong>Fix #1 — capacity.</strong> Switch the table to on-demand: <code>aws dynamodb update-table --table-name launch-items --billing-mode PAY_PER_REQUEST</code> (or justify a provisioned RCU number from observed request rate x item size). Re-run the identical load test. Acceptance: <code>ThrottledRequests</code> = 0 for the new window and p99 within ~2x of p50; record the AFTER numbers next to the BEFORE numbers.</p>`,
    `<p><strong>Fix #2 — client backoff with jitter.</strong> To prove the client-side fix on real throttles, first flip the table <em>back</em> to provisioned 1 RCU (note: billing-mode changes are limited to one per 24h in some cases — if blocked, demonstrate against provisioned 2 RCU or use a second table). Update the Lambda's boto3 client with <code>Config(retries={"mode": "adaptive", "max_attempts": 10})</code>, redeploy, re-run a gentler load (~10 req/s). Acceptance: compare against the same load on the naive client — fewer surfaced errors and a written explanation of what backoff changed (error rate) and what it cannot change (aggregate capacity; p99 for requests that must retry gets <em>worse</em>, not better — say why that trade is still correct).</p>`,
    `<p><strong>Fix #3 — caching, on paper.</strong> One paragraph: where DAX would sit, why this workload (hot single-key reads) is DAX's ideal case, what its item cache TTL implies for staleness, and one alternative (API Gateway response caching on REST APIs, or CloudFront in front). No deployment required — but the paragraph must include an estimate of the read rate at which DAX becomes cheaper than on-demand RCUs.</p>`,
    `<p><strong>Deliver the incident summary:</strong> a small before/after table — p50, p99, throttle count, 5xx count — for (a) broken, (b) capacity fix, (c) backoff on constrained capacity, plus a one-line recommendation of the permanent configuration for launch traffic.</p>`
  ],
  hints: `
<ul>
<li>1 RCU = one strongly consistent (or two eventually consistent) reads/sec for items up to 4 KB. At 50 req/s you are ~25-50x over capacity — the failure is not subtle, which is the point.</li>
<li>If p99 is bad but errors are rare, ask where the time is going: the default boto3 client already retries throttles several times with growing delays before it throws. Retries convert errors into latency. That mechanism — not slow code — is your p99.</li>
<li>Metric names matter: <code>ThrottledRequests</code> counts throttled <em>requests</em> after SDK retries at the DynamoDB API layer; <code>ReadThrottleEvents</code> counts throttle <em>events</em> including retried attempts. The ratio between them tells you how hard the SDK fought.</li>
<li><code>get-metric-statistics</code> only returns p-values via <code>--extended-statistics</code>, and DynamoDB metrics need dimensions <code>TableName=launch-items</code> (plus <code>Operation=GetItem</code> for <code>SuccessfulRequestLatency</code>).</li>
<li>Compare DynamoDB's <code>SuccessfulRequestLatency</code> (single-digit ms even during the incident) with your end-to-end p99 — the gap proves the latency lives in retry queues, not in the database.</li>
<li>On-demand mode's first ramp: fresh tables handle thousands of req/s instantly; your 50-100 req/s will not dent it. If fix #1 does not fully clear the throttles, check you actually waited for the table update to complete.</li>
<li>Adaptive retry mode adds client-side rate limiting on top of jittered backoff — watch what that does to offered load in the second test.</li>
</ul>
`,
  walkthrough: `
<h3>Root cause</h3>
<p>A provisioned-mode table at 1 RCU serving a ~50 req/s hot-key read load — roughly 50x under-provisioned. The SDK's default retries absorb the first throttles (inflating Lambda duration and API p99), then give up and surface <code>ProvisionedThroughputExceededException</code>, which the Lambda returns as 500. p50 stays healthy because unthrottled requests are genuinely fast — the signature p99/p50 divergence of a capacity cliff behind a retry layer.</p>
<h3>Build and break</h3>
<pre><code>aws dynamodb create-table --table-name launch-items \
  --attribute-definitions AttributeName=pk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=1,WriteCapacityUnits=1
aws dynamodb put-item --table-name launch-items \
  --item '{"pk":{"S":"hero"},"body":{"S":"launch payload"}}'
# Lambda handler core (python3.12): boto3 resource, get_item on pk=hero, return JSON
aws apigatewayv2 create-api --name launch-api --protocol-type HTTP \
  --target arn:aws:lambda:REGION:ACCOUNT:function:launch-api
aws lambda add-permission --function-name launch-api --statement-id apigw \
  --action lambda:InvokeFunction --principal apigateway.amazonaws.com

hey -z 60s -c 25 https://APIID.execute-api.REGION.amazonaws.com/
# typical: p50 ~40ms, p99 several seconds, some 500s
</code></pre>
<h3>Evidence</h3>
<pre><code>aws cloudwatch get-metric-statistics --namespace AWS/DynamoDB \
  --metric-name ThrottledRequests \
  --dimensions Name=TableName,Value=launch-items \
  --start-time 2026-07-22T09:00:00Z --end-time 2026-07-22T09:10:00Z \
  --period 60 --statistics Sum
aws cloudwatch get-metric-statistics --namespace AWS/Lambda \
  --metric-name Duration --dimensions Name=FunctionName,Value=launch-api \
  --start-time 2026-07-22T09:00:00Z --end-time 2026-07-22T09:10:00Z \
  --period 300 --extended-statistics p99 p50
</code></pre>
<p>Typical BEFORE: ThrottledRequests in the hundreds/min, Lambda p99 4,000-15,000 ms vs p50 ~10 ms, several percent 5xx.</p>
<h3>Fix #1 — capacity</h3>
<pre><code>aws dynamodb update-table --table-name launch-items --billing-mode PAY_PER_REQUEST
aws dynamodb wait table-exists --table-name launch-items
hey -z 60s -c 25 URL    # identical load
</code></pre>
<p>AFTER: ThrottledRequests = 0, Lambda p99 collapses to tens of ms, zero 5xx, end-to-end p99 within 2x of p50. Capacity was the incident; this is the 09:15 mitigation you ship first.</p>
<h3>Fix #2 — backoff with jitter</h3>
<p>Back on constrained capacity, change the Lambda's client:</p>
<pre><code>from botocore.config import Config
ddb = boto3.client("dynamodb", config=Config(
    retries={"mode": "adaptive", "max_attempts": 10}))
</code></pre>
<p>Re-run at ~10 req/s against the naive client, then the adaptive client. The adaptive client surfaces far fewer errors: jittered exponential backoff de-synchronizes retry storms, and adaptive mode adds a client-side token bucket that throttles <em>itself</em> to the table's observed capacity. But watch the latency: requests that retried now take longer (they waited politely instead of failing fast). Write the honest conclusion: backoff converts errors into latency and protects the dependency from retry amplification — it is correct resilience hygiene, and it is <em>not</em> a substitute for capacity.</p>
<h3>Fix #3 — caching (paper)</h3>
<p>A single hot key read thousands of times a second is DAX's textbook case: a write-through cache cluster in front of the table serves repeated <code>GetItem</code> from memory in microseconds, with item-cache TTL (default 5 min) bounding staleness. Break-even sketch: on-demand reads cost ~$0.125 per million; the smallest DAX node runs ~$0.04/hour (~$29/mo), so DAX pays for itself around a sustained 250+ million reads/month on cacheable keys — below that, on-demand plus CloudFront/API-level caching is simpler and cheaper.</p>
<h3>The generalized lesson</h3>
<p><strong>p99 divergence with a healthy p50 means queueing, not slow code</strong> — look for a throttled dependency behind a retry layer. The retry layer is double-edged: it hides the first minutes of an incident (making dashboards lie) and amplifies load against the struggling dependency unless it backs off with jitter. And the escalation order you practiced is the production playbook: capacity first (minutes, fixes the incident), client behavior second (protects every future incident), caching third (architecture, justified by read-pattern economics — not deployed at 09:15 on launch day).</p>
`,
  teardown: `
<ol>
<li>Delete the HTTP API: <code>aws apigatewayv2 get-apis</code> to find the ID, then <code>aws apigatewayv2 delete-api --api-id APIID</code>. This removes routes/stages/integrations with it.</li>
<li>Delete the Lambda: <code>aws lambda delete-function --function-name launch-api</code>, and its execution role (<code>aws iam detach-role-policy</code> then <code>aws iam delete-role --role-name launch-api-role</code>).</li>
<li>Delete the log groups — they outlive everything: <code>aws logs delete-log-group --log-group-name /aws/lambda/launch-api</code>, plus any HTTP API access-log group if you enabled one.</li>
<li>Delete the table: <code>aws dynamodb delete-table --table-name launch-items</code>. If you created a second table for the backoff test, delete that too: <code>aws dynamodb list-tables</code> to double-check.</li>
<li>If you experimented with alarms on ThrottledRequests, remove them: <code>aws cloudwatch describe-alarms</code> then <code>aws cloudwatch delete-alarms --alarm-names NAME</code>.</li>
<li>Remove local load-test artifacts and the Lambda zip.</li>
<li><strong>Next day:</strong> Cost Explorer, group by Service, yesterday+today: API Gateway, Lambda, DynamoDB, and CloudWatch should total a few cents and then flatline at zero. A persistent DynamoDB line means a table (often the second one) survived — <code>aws dynamodb list-tables</code> in every region you touched.</li>
</ol>
`
});
