# Security Headers Recipe

## Overview

This recipe demonstrates how to implement secure HTTP headers in the application to enhance security against common web vulnerabilities.

## Implementation

### 1. Basic Security Headers

```typescript
// middleware/security.ts
import { Request, Response, NextFunction } from "express";

export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.setHeader("X-Frame-Options", "DENY");
    
    // Enable XSS protection
    res.setHeader("X-XSS-Protection", "1; mode=block");
    
    // Prevent MIME type sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");
    
    // Strict Transport Security
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
    
    // Content Security Policy
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https://api.github.com;"
    );
    
    // Referrer Policy
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    
    // Permissions Policy
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=()"
    );

    next();
  };
}
```

### 2. Usage in Express App

```typescript
// app.ts
import express from "express";
import { securityHeaders } from "./middleware/security";

const app = express();

// Apply security headers
app.use(securityHeaders());
```

## Security Headers Explained

### 1. X-Frame-Options
Prevents clickjacking attacks by controlling how the page can be embedded in iframes.

```typescript
res.setHeader("X-Frame-Options", "DENY");
// Options: DENY, SAMEORIGIN, ALLOW-FROM uri
```

### 2. X-XSS-Protection
Enables browser's built-in XSS filtering.

```typescript
res.setHeader("X-XSS-Protection", "1; mode=block");
// Options: 0 (disable), 1 (enable), 1; mode=block
```

### 3. Content Security Policy (CSP)
Controls which resources can be loaded and from where.

```typescript
const cspDirectives = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "https:"],
  "connect-src": ["'self'", "https://api.github.com"]
};

const csp = Object.entries(cspDirectives)
  .map(([key, values]) => `${key} ${values.join(" ")}`)
  .join("; ");

res.setHeader("Content-Security-Policy", csp);
```

## Testing Security Headers

### 1. Unit Tests

```typescript
// __tests__/security-headers.test.ts
import request from "supertest";
import app from "../app";

describe("Security Headers", () => {
  it("should set all required security headers", async () => {
    const response = await request(app).get("/");
    
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["x-xss-protection"]).toBe("1; mode=block");
    expect(response.headers["strict-transport-security"])
      .toContain("max-age=31536000");
  });

  it("should have correct CSP directives", async () => {
    const response = await request(app).get("/");
    const csp = response.headers["content-security-policy"];
    
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
  });
});
```

### 2. Security Scanning

```bash
# Install security testing tools
npm install -D helmet-csp snyk

# Run security scan
npx snyk test

# Analyze CSP configuration
npx helmet-csp analyze
```

## Best Practices

### 1. Regular Updates
```typescript
// Version your security configuration
export const SECURITY_CONFIG_VERSION = "1.0.0";

// Log changes for auditing
logger.info("Applying security headers", {
  version: SECURITY_CONFIG_VERSION,
  timestamp: new Date().toISOString()
});
```

### 2. Environment-Specific Settings
```typescript
// config/security.ts
export const securityConfig = {
  development: {
    csp: {
      "script-src": ["'self'", "'unsafe-eval'"],
      // More relaxed for development
    }
  },
  production: {
    csp: {
      "script-src": ["'self'"],
      // Stricter for production
    }
  }
};
```

### 3. Monitoring and Reporting

```typescript
// Add CSP reporting
const cspReportOnly = {
  ...cspDirectives,
  "report-uri": ["/csp-report"]
};

app.post("/csp-report", (req, res) => {
  logger.warn("CSP Violation", req.body);
  res.status(204).end();
});
```

## Troubleshooting

### Common Issues

1. **Mixed Content Warnings**
```typescript
// Force HTTPS
app.use((req, res, next) => {
  if (!req.secure) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});
```

2. **Third-Party Resources**
```typescript
// Allow specific third-party resources
const allowedDomains = [
  "https://api.github.com",
  "https://cdn.jsdelivr.net"
];

const csp = {
  ...cspDirectives,
  "connect-src": ["'self'", ...allowedDomains]
};
```

3. **Legacy Browser Support**
```typescript
// Add fallback headers
res.setHeader("X-Content-Security-Policy", csp); // Firefox
res.setHeader("X-WebKit-CSP", csp); // WebKit
```

## Security Considerations

1. **Regular Auditing**
   - Monitor CSP reports
   - Review allowed sources
   - Update deprecated headers
   - Test with security tools

2. **Header Combinations**
   - Ensure headers don't conflict
   - Test in all target browsers
   - Validate security requirements

3. **Documentation**
   - Keep policy changelog
   - Document exceptions
   - Maintain testing procedures 