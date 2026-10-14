# Runtime configuration

The supported configuration is listed in [`.env.example`](../.env.example) and the [main README](../../README.md). Keep real environment files outside Git.

Production requires a strong session secret. Email requires Resend configuration. Lead alerts can also use Telegram. File bytes use S3 in production and local disk in development. The account and metadata stores remain local JSON files; `DATABASE_URL` does not enable PostgreSQL in this version.

Use frontend page URLs for `APP_URL` and `APP_BASE_URL`. For the integrated local server, include `/public` so invite and reset links resolve correctly. For a static frontend that exposes those pages at its root, use its root origin.

Before onboarding a real company, verify storage persistence, backup restoration, role isolation, disabled-account behavior, invitation delivery, reset delivery, and upload permissions. Live service delivery and cloud infrastructure were not tested during local source verification.
