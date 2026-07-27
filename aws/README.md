# FilmScript on AWS

This folder deploys the current FilmScript backend as one ECS Fargate task:

```text
Vercel static UI -> HTTPS ALB -> ECS Fargate
                                  |-- private S3 media
                                  `-- encrypted EFS data/SQLite
Secrets Manager -> ECS environment
CloudWatch <- container logs
```

The S3 bucket is private, encrypted, versioned, and accessible only through the
ECS task role. FilmScript never gives browser code AWS credentials. Canvas and
Shot List assets continue to be served through authenticated FilmScript API
routes.

## Why this first AWS version uses EFS

The existing data module is synchronous SQLite. A direct RDS PostgreSQL switch
would require an asynchronous storage migration across the backend. This stack
keeps the app working now with durable EFS storage while that migration is
performed deliberately.

The service is therefore fixed at **one task**. Its rolling deployment settings
stop the old task before starting the new one, avoiding two writers on the same
SQLite database. Do not increase `DesiredCount` until the database has moved to
RDS PostgreSQL.

## Prerequisites

1. An AWS account with two public subnets in different Availability Zones.
2. A public API hostname such as `api.filmscript.app`.
3. An ACM certificate for that hostname in the deployment Region.
4. An ECR repository containing the FilmScript image.
5. One Secrets Manager secret whose value is this JSON shape:

```json
{
  "OPENROUTER_API_KEY": "...",
  "GOOGLE_CLIENT_ID": "...apps.googleusercontent.com",
  "GOOGLE_CLIENT_SECRET": "...",
  "RECURRENTE_SECRET_KEY": "...",
  "RECURRENTE_WEBHOOK_SECRET": "...",
  "RECURRENTE_LUMIERE_PRODUCT_ID": "..."
}
```

Empty optional values must still be present as JSON keys because ECS resolves
each key while starting the task. Never commit the real JSON or paste it into a
browser-side Vercel variable.

## Build and push the image

After authenticating AWS CLI with IAM Identity Center or another approved
short-lived login:

```bash
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPOSITORY=filmscript

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
docker build --platform linux/amd64 -t "$REPOSITORY:production" .
docker tag "$REPOSITORY:production" "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPOSITORY:production"
docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPOSITORY:production"
```

Use the resulting ECR image URI for the `ContainerImage` stack parameter. For
repeatable releases, pin an image digest instead of reusing a mutable tag.

## Deploy the stack

Upload `filmscript-backend.yml` in CloudFormation or deploy it through the CLI:

```bash
aws cloudformation deploy \
  --template-file aws/filmscript-backend.yml \
  --stack-name filmscript-production \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    EnvironmentName=production \
    VpcId=vpc_xxx \
    PublicSubnetA=subnet_xxx \
    PublicSubnetB=subnet_yyy \
    ContainerImage=ACCOUNT.dkr.ecr.REGION.amazonaws.com/filmscript@sha256:DIGEST \
    CertificateArn=arn:aws:acm:REGION:ACCOUNT:certificate/ID \
    SecretsArn=arn:aws:secretsmanager:REGION:ACCOUNT:secret:filmscript-production-XXXXXX \
    FrontendUrl=https://YOUR-VERCEL-DOMAIN \
    ApiUrl=https://api.YOUR-DOMAIN \
    SessionCookieSameSite=Lax
```

Create a DNS Alias or CNAME for the API hostname to the
`LoadBalancerDnsName` stack output. The certificate hostname, `ApiUrl`, and DNS
record must agree.

## Connect Google, Recurrente, and Vercel

- Google OAuth redirect URI: `https://api.YOUR-DOMAIN/auth/google/callback`
- Vercel build variable: `API_URL=https://api.YOUR-DOMAIN`
- Recurrente webhook: `https://api.YOUR-DOMAIN/api/webhooks/recurrente`

Use sibling custom domains such as `app.example.com` on Vercel and
`api.example.com` on AWS; then keep `SessionCookieSameSite=Lax`. This avoids
depending on third-party cookies. For a short test with unrelated domains,
`None` is available and HTTPS remains mandatory, but browser privacy settings
may still block that cross-site cookie.

After deployment, verify:

```bash
curl https://api.YOUR-DOMAIN/api/health
```

Then rebuild/redeploy Vercel so `runtime-config.js` contains the AWS API URL.

## RDS phase

Before adding a second backend task:

1. Add a PostgreSQL implementation of the `database.js` contract.
2. Migrate users, scripts, sessions, billing, chats, and production JSON.
3. Point the task at a private RDS PostgreSQL endpoint through Secrets Manager.
4. Test subscription and OAuth session continuity.
5. Increase ECS desired count only after removing the SQLite/EFS dependency.
