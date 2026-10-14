# Backend deployment

Deploy the integrated Node application with `backend` and `frontend` as sibling directories. Start it with `npm start` from the repository root, or `node backend/server.js`. Install backend dependencies with `npm ci --prefix backend`. The backend serves assets from the sibling frontend directory; a backend-only ZIP no longer contains the full application.

Set `NODE_ENV=production`, a random `JWT_SECRET` of at least 32 characters, public frontend URLs, and a strict `ALLOWED_ORIGINS` list. Production binds to `0.0.0.0` by default and trusts one proxy hop, matching the existing load-balancer setup. Keep direct access to that listener controlled by the deployment network.

Use `/healthz` for the load-balancer health check. The existing `.ebextensions` file contains that path when deploying from the backend application root; ensure it is included at the actual bundle root if you package the monorepo yourself.

Accounts, lead records, reset tokens, audit logs, and file metadata still use JSON storage. Set their file paths to a backed-up persistent disk. Use a single writer process and one instance until shared storage replaces those files. Redeploying onto an ephemeral filesystem will lose local account data. S3 stores production file bytes, not the account database.

No deployment was performed or verified. Test HTTPS, CORS, real account flows, service notifications, and storage recovery in a separate environment before using customer data.
