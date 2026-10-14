# Publication and deployment checks

The working source excludes `.env` files, customer JSON stores, uploads, dependency folders, old ZIP artifacts, and local tool settings. Environment examples contain empty credential fields. Existing Git history must be reviewed separately because deleting a file from the current tree does not remove old copies.

The API restricts company team operations, rejects disabled sessions for password changes and uploads, rate limits login attempts, validates upload types and sizes, and hides internal errors from responses. Production requires a configured session secret. The development Telegram diagnostic is disabled unless explicitly enabled and never runs in production.

The frontend still stores Bearer tokens in localStorage and uses inline event handlers in the demo. Its CSP therefore retains inline script allowance on those demo pages. Cookie-based sessions, token revocation on password change, distributed rate limiting, and a shared production datastore remain future deployment work.

Run `npm run check`, `npm test`, the frontend build, and `npm audit --prefix backend` after dependency changes. These checks do not replace a full security review or live-service testing.
