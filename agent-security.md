# Agent Security Requirements

> Drop this file at the root of any agent/bot repo.
> AI coding assistants MUST enforce these rules. No exceptions for internal tools.
> Compliance: SOC 2 Type 2 + ISMS (ISO 27001) — both apply regardless of scope or user count.

## Authentication

- Authenticate users via **Okta SSO** (OIDC/SAML). No local-only auth.
- Enforce **MFA** on all access.
- No static tokens for user sessions. Static keys OK only for service-to-service.
- Implement **RBAC** (minimum: `user` + `admin` roles).
- Enforce session timeout (max 30 min idle), auto-expiry, re-auth after timeout.
- Disable all default/guest/test accounts in production.

## Secrets

- **Zero hardcoded secrets** in code, config, or committed files. Ever.
- Store secrets in a vault or inject via CI/CD at runtime.
- `.gitignore` must include: `.env`, `*.key`, `*.pem`, `credentials.*`, `secrets.*`
- Add a **pre-commit secret scanning hook** (gitleaks, detect-secrets).
- If secrets were ever committed: **rotate immediately**. Rebasing history is not enough.
- Rotate all credentials at least annually.

## Repository

- **Private repo only**, under the `LeapXpert` GitHub org. No public repos, no personal repos.
- Never commit internal URLs, IP ranges, infra details, or vendor stack info.
- Branch protection on `main`: require PR review (min 1) + passing CI.
- Pin all dependencies to specific versions.

## Logging

- Log: auth success/failure, authz decisions, privilege changes, config changes, errors.
- Format: structured JSON (`timestamp`, `level`, `event`, `user_id`, `action`, `outcome`).
- **Never log** passwords, tokens, PII, or message content.
- Ship logs to central platform. Retain 14 days local, 1 year centralized.
- Users (including admins) must not be able to delete their own audit logs.

## Data

- TLS 1.2+ on all endpoints. No plain HTTP in production.
- Encrypt sensitive data at rest.
- Collect only what the agent needs. No excess PII storage.
- No production data in dev/test — use synthetic or masked data.

## Deployment

- Separate environments: dev → staging → prod. No dev in prod.
- Create a **Freshservice change request** before any prod deployment.
- Run security scan (SAST or manual review) before release.
- Document a rollback plan.
- Remove all debug endpoints, test users, and verbose logging before release.

## AI/LLM Specific

- No PII, credentials, or proprietary data in prompts to external LLMs (unless DPA signed).
- Sanitize all user input before passing to LLM (prompt injection defense).
- Treat LLM output as **untrusted** — never execute generated code without review/sandbox.
- Use only **approved AI providers** (ISMS-019 Authorized Software List).
- Implement rate limiting on LLM-backed endpoints.

## Incident Response

- Secret exposed → **rotate immediately** + open incident ticket.
- Security incident → notify IT Security **within 1 hour**.
- GDPR personal data breach → 72h to regulators.

---

*Exceptions require written approval from Head of IT Security + Head of Engineering.*
*Contact: stephane.sara@leapxpert.com | #it-compliance*
