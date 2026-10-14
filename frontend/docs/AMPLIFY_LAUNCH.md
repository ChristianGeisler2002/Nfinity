# Static frontend deployment

Use the `frontend` directory as the Amplify app root. Install with `npm ci`, then run `npm run build`. The existing `amplify.yml` publishes `dist` only.

Set `NFINITY_API_BASE_URL` to the backend HTTPS origin before building. Do not include a path, query, credentials, or fragment. Set the backend's `ALLOWED_ORIGINS` to the exact frontend origin.

Verify the homepage, guest demo, login failure feedback, real-account login, and team permissions from the deployed frontend. Check both `/public/login.html` and `/apps/demo/`; all root assets and nested assets must load. The runtime configuration contains only the public API origin.

The local static preview is available through `npm run preview`. It is a development server, not a deployment target. A live Amplify deployment has not been verified as part of the local build checks.
