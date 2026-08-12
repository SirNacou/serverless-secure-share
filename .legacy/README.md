# serverless-secure-share

A full-stack serverless file-sharing application on AWS. Upload files, share them via secure links, and track downloads — all with zero servers to manage.

## Features

- **Google SSO** — Authenticate via Cognito User Pool with Google as the identity provider
- **Pre-signed URL uploads** — Files go directly from browser to S3, never through the app server
- **Share-by-link** — Each upload generates a unique share link with an optional friendly name
- **Visibility controls** — Mark shares as `public` (anyone with the link can download) or `private` (owner only)
- **Download counter** — Track how many times each share has been consumed
- **Audit trail** — Every share create and download is logged to an append-only audit table
- **Auto-expiry** — Files and metadata are automatically deleted after 30 days

## Architecture

The application is composed of several AWS resources provisioned with Pulumi:

```
User → CloudFront → S3 (frontend) ← TanStack Start app
                      ↓
              API Gateway (HTTP v2) → Lambda handlers → DynamoDB + S3
                      ↓
           SQS queue → Audit Logger Lambda → DynamoDB audit table
                      
         S3 upload event + DynamoDB stream → S3 Sync Lambda
```

- **Frontend** is served from S3 via CloudFront with a custom domain and ACM certificate
- **API Gateway** routes requests to individual Lambda functions, with JWT authorization for protected routes
- **Upload Lambda** generates a pre-signed S3 `PUT` URL so the client can upload directly to S3
- **Download Lambda** creates a pre-signed `GET` URL on demand and increments a download counter
- **S3 Sync Worker** (triggered on `uploads/` object creation and DynamoDB TTL streams) syncs metadata and cleans up S3 when shares expire
- **Audit Logger** (SQS-triggered) writes share-created and download events to a separate audit table

## Tech Stack

| Category | Technology |
|----------|------------|
| Infrastructure as Code | Pulumi (TypeScript) |
| Cloud Provider | AWS (S3, DynamoDB, Lambda, API Gateway HTTPv2, Cognito, SQS, CloudFront, ACM, IAM) |
| Frontend | TanStack Start (React), TanStack Router, Tailwind CSS v4, Radix UI, AWS Amplify UI |
| Package Manager | Bun |
| CI/CD | GitHub Actions (OIDC to AWS) |
| DNS | Cloudflare |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/upload` | JWT | Generate a pre-signed S3 upload URL and create a share record |
| `POST` | `/api/share/{shareId}/consume` | Public | Return file metadata + pre-signed download URL; increments counter |
| `GET` | `/api/share/{shareId}/info` | Optional | Return share metadata (public info if share is public) |
| `GET` | `/api/list` | JWT | List all shares owned by the authenticated user |
| `GET` | `/api/explore` | Public | Browse recently created public shares |
| `GET` | `/api/activity` | JWT | View the audit trail for the authenticated user's shares |

## Prerequisites

- [Bun](https://bun.sh/) >= 1.x
- [Pulumi CLI](https://www.pulumi.com/docs/install/) >= 3.x
- AWS account with credentials configured
- A Google OAuth 2.0 application (for Cognito IdP)
- A Cloudflare zone (if using the custom domain setup)

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/<your-org>/serverless-secure-share.git
   cd serverless-secure-share
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Create a new Pulumi stack:

   ```bash
   pulumi stack init dev
   ```

4. Configure required secrets:

   ```bash
   pulumi config set aws:region <your-region>
   pulumi config set google:clientId <your-google-client-id> --secret
   pulumi config set google:clientSecret <your-google-client-secret> --secret
   pulumi config set cloudflare:apiToken <your-cloudflare-api-token> --secret
   ```

5. Deploy the infrastructure:

   ```bash
   pulumi up
   ```

6. Run the frontend development server:

   ```bash
   cd src/frontend
   bun install
   cat > .env <<EOF
   VITE_API_ENDPOINT=$(pulumi --cwd ../.. stack output publicApiEndpoint --stack dev)
   VITE_COGNITO_DOMAIN=$(pulumi --cwd ../.. stack output cognitoDomain --stack dev)
   VITE_COGNITO_USER_POOL_ID=$(pulumi --cwd ../.. stack output cognitoPoolId --stack dev)
   VITE_COGNITO_CLIENT_ID=$(pulumi --cwd ../.. stack output cognitoClientId --stack dev)
   EOF
   bun run dev
   ```

   Open http://localhost:3000 in your browser.

## Project Structure

```
├── index.ts                      # Pulumi entry point — wires all infrastructure together
├── infra/
│   ├── auth.ts                   # Cognito User Pool, Google IdP, OAuth client
│   ├── ci.ts                     # GitHub Actions OIDC provider and IAM role
│   ├── database.ts               # DynamoDB metadata + audit tables
│   ├── frontend.ts               # S3 bucket + CloudFront distribution + ACM cert + Cloudflare DNS
│   ├── messaging.ts              # SQS audit queue + dead-letter queue
│   ├── storage.ts                # S3 vault bucket (CORS, lifecycle, public access block)
│   └── compute/
│       ├── audit.ts              # Audit Logger Lambda (SQS-triggered)
│       ├── workers.ts            # S3 Sync Lambda (S3 event + DynamoDB stream)
│       └── api/
│           ├── gateway.ts        # API Gateway HTTPv2 + JWT authorizer
│           ├── upload.ts         # Upload route Lambda + integration
│           ├── download.ts       # Download route Lambda + integration
│           ├── list.ts           # List route Lambda + integration
│           ├── share-info.ts     # Share info route Lambda + integration
│           ├── explore.ts        # Public explore route Lambda + integration
│           └── activity.ts       # Activity/audit route Lambda + integration
├── src/
│   ├── api/                      # Lambda handler source code (.mjs)
│   ├── workers/                  # Background worker Lambda source code (.mjs)
│   └── frontend/                 # TanStack Start React application
│       ├── src/
│       │   ├── routes/           # File-based routes (TanStack Router)
│       │   ├── components/       # Reusable UI components
│       │   ├── hooks/            # Custom React hooks
│       │   ├── lib/              # Utility functions & API client
│       │   ├── config/           # App configuration
│       │   ├── types/            # TypeScript type definitions
│       │   └── styles.css        # Global styles (Tailwind)
│       └── public/               # Static assets
├── Pulumi.yaml                   # Pulumi project metadata
├── Pulumi.<stack>.yaml           # Per-stack configuration (encrypted secrets)
└── .github/workflows/deploy.yml  # CI/CD pipeline
```

## Deployment

Push to the `main` branch to trigger the CI/CD pipeline via GitHub Actions:

1. **Infrastructure** — `pulumi up --stack dev` provisions/updates all AWS resources
2. **Frontend** — Vite builds the TanStack app with live stack outputs as env vars
3. **Upload** — Built assets are synced to the frontend S3 bucket
4. **Cache invalidation** — CloudFront distribution is flushed

The pipeline assumes an IAM role via OIDC (`AWS_ROLE_ARN` secret); the role itself is managed by the `infra/ci.ts` Pulumi module.

## Configuration

| Key | Description | Required |
|-----|-------------|----------|
| `aws:region` | AWS region | Yes |
| `google:clientId` | Google OAuth client ID | Yes (secret) |
| `google:clientSecret` | Google OAuth client secret | Yes (secret) |
| `cloudflare:apiToken` | Cloudflare API token | Yes (secret) |