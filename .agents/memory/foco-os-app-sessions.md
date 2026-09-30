---
name: Foco OS app sessions
description: Durable decision for browser login sessions and automation route separation.
---

Foco OS browser access uses a stateless HMAC-signed, HttpOnly, SameSite=Lax cookie with a seven-day expiry. Keep browser session checks separate from Make automation routes, which authenticate only with `x-api-key`. Do not add database-backed sessions unless the product requires revocation or per-user session management.

**Why:** Foco OS has a shared app password and does not need persisted session records; automation clients must keep working independently of browser login.

**How to apply:** Preserve the separation when changing auth behavior, cookie settings, or API route middleware. Keep the OpenAPI contract aligned with both authentication paths.