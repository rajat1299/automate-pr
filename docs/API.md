# API Documentation

## Overview

This document describes the API endpoints and interfaces used in the Automate PR system. The API is organized around REST principles and uses standard HTTP response codes, authentication, and verbs.

## Authentication

### Device Flow Authentication

```typescript
interface DeviceFlowResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
}
```

#### 1. Initialize Device Flow
```http
POST https://github.com/login/device/code
Content-Type: application/json

{
  "client_id": "your-client-id",
  "scope": "repo,workflow,write:packages"
}
```

#### 2. Poll for Token
```http
POST https://github.com/login/oauth/access_token
Content-Type: application/json

{
  "client_id": "your-client-id",
  "device_code": "device-code-from-step-1",
  "grant_type": "urn:ietf:params:oauth:grant-type:device_code"
}
```

## Security Scanning

### Scan Repository

```typescript
interface ScanOptions {
  repository: string;
  branch?: string;
  paths?: string[];
  scanners: ('gitguardian' | 'custom')[];
}

interface ScanResult {
  id: string;
  status: 'success' | 'failure' | 'in_progress';
  findings: Finding[];
  timestamp: string;
}

interface Finding {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: {
    file: string;
    line: number;
  };
  description: string;
  suggestedFix?: string;
}
```

#### Start Scan
```http
POST /api/v1/scans
Authorization: Bearer <token>
Content-Type: application/json

{
  "repository": "owner/repo",
  "branch": "main",
  "scanners": ["gitguardian"]
}
```

#### Get Scan Results
```http
GET /api/v1/scans/{scanId}
Authorization: Bearer <token>
```

## Pull Request Management

### Create PR

```typescript
interface PullRequestOptions {
  title: string;
  branch: string;
  base: string;
  body: string;
  draft?: boolean;
  labels?: string[];
  assignees?: string[];
}

interface PullRequestResponse {
  id: number;
  number: number;
  url: string;
  state: 'open' | 'closed' | 'merged';
  title: string;
  body: string;
}
```

#### Create Pull Request
```http
POST /api/v1/repos/{owner}/{repo}/pulls
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Fix security vulnerabilities",
  "branch": "fix/security-issues",
  "base": "main",
  "body": "Automated security fixes"
}
```

## Rate Limiting

### Rate Limit Structure
```typescript
interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  used: number;
}
```

#### Check Rate Limits
```http
GET /api/v1/rate-limit
Authorization: Bearer <token>
```

## Error Handling

### Error Response Format
```typescript
interface ErrorResponse {
  error: {
    type: string;
    message: string;
    code: number;
    details?: Record<string, any>;
  };
  requestId: string;
  timestamp: string;
}
```

### Common Error Codes

| Code | Type | Description |
|------|------|-------------|
| 400 | ValidationError | Invalid request parameters |
| 401 | AuthenticationError | Invalid or missing token |
| 403 | AuthorizationError | Insufficient permissions |
| 404 | NotFoundError | Resource not found |
| 429 | RateLimitError | Rate limit exceeded |
| 500 | ServerError | Internal server error |

## Webhooks

### Webhook Events

```typescript
interface WebhookPayload {
  event: string;
  delivery: string;
  repository: string;
  data: Record<string, any>;
  signature: string;
}
```

#### Available Events
- `scan.completed`: Security scan completed
- `scan.finding`: New security finding detected
- `pr.created`: Pull request created
- `pr.updated`: Pull request updated
- `pr.merged`: Pull request merged

#### Webhook Configuration
```http
POST /api/v1/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://your-server.com/webhook",
  "events": ["scan.completed", "pr.created"],
  "secret": "webhook-secret"
}
```

## Examples

### 1. Complete Authentication Flow

```typescript
// 1. Initialize device flow
const deviceFlow = await fetch("https://github.com/login/device/code", {
  method: "POST",
  headers: {
    "Accept": "application/json",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    client_id: CLIENT_ID,
    scope: "repo,workflow"
  })
});

const { device_code, user_code, verification_uri } = await deviceFlow.json();

// 2. Poll for token
while (true) {
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      device_code: device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code"
    })
  });

  const { access_token, error } = await tokenResponse.json();
  if (access_token) break;
  if (error !== "authorization_pending") throw new Error(error);
  
  await new Promise(resolve => setTimeout(resolve, 5000));
}
```

### 2. Start Security Scan

```typescript
const scan = await fetch("/api/v1/scans", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    repository: "owner/repo",
    branch: "main",
    scanners: ["gitguardian"],
    paths: ["src/", "packages/"]
  })
});

const { id: scanId } = await scan.json();

// Poll for results
const results = await fetch(`/api/v1/scans/${scanId}`, {
  headers: {
    "Authorization": `Bearer ${token}`
  }
});

const findings = await results.json();
```

### 3. Create Pull Request

```typescript
const pr = await fetch("/api/v1/repos/owner/repo/pulls", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    title: "Fix security vulnerabilities",
    branch: "fix/security-issues",
    base: "main",
    body: "Automated security fixes",
    draft: true,
    labels: ["security", "automated"]
  })
});

const { number: prNumber } = await pr.json();
```

## Best Practices

1. **Rate Limiting**
   - Implement exponential backoff
   - Cache responses when possible
   - Monitor rate limit headers

2. **Error Handling**
   - Always check error responses
   - Implement retry logic
   - Log detailed error information

3. **Authentication**
   - Rotate tokens regularly
   - Use minimum required scopes
   - Implement token refresh logic

4. **Security**
   - Validate webhook signatures
   - Use HTTPS for all requests
   - Sanitize request inputs 