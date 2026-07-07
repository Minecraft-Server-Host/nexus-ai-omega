# Security Policy — Nexus AI Omega

## Supported Versions

| Version | Supported |
|---|---|
| 3.3.x | ✅ Active |
| 3.2.x | ⚠️ Security fixes only |
| < 3.2 | ❌ End of life |

## Reporting a Vulnerability

**DO NOT open a public GitHub issue for security vulnerabilities.**

Please report security issues responsibly:

1. **Email:** security@nexus.ai
2. **Discord:** Contact `👑 Nexus Owner` via DM in the Control Guild
3. **Encrypted:** PGP key available on request

### What to include
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- (Optional) Suggested fix

### Response Timeline
- **Acknowledgement:** within 24 hours
- **Initial assessment:** within 72 hours
- **Fix & disclosure:** within 14 days for critical, 30 days for high

## Security Practices

- All secrets via environment variables — never hardcoded
- Zero-Trust architecture — every interaction verified
- Rate limiting on all endpoints
- Input sanitization and Zod validation
- JWT authentication for API routes
- CORS restricted to allowed origins in production
- Helmet.js security headers
- Regular `npm audit` — zero high/critical tolerance

## Hall of Fame

Responsible disclosures will be credited here (with permission).
