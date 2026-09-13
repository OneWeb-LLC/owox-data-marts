---
'@owox/idp-better-auth': patch
owox: patch
'@owox/idp-owox-better-auth': patch
---

# Fix login 404 on magic-link confirmation

Email/password login on the OWeb satellite (and the same confirm page in OWOX Better Auth) redirected into `/auth/magic-link?token=...`. That route only accepted GET, so a POST-preserving redirect returned Nest's `Cannot POST /auth/magic-link` JSON. Login now 303-redirects to Better Auth's verify URL to establish the session, and the confirm page also accepts POST so a leftover POST no longer 404s.
