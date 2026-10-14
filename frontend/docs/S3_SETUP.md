# Upload integration

S3 credentials belong on the backend. The browser must never receive an AWS secret key. The upload endpoint is `POST /api/uploads`, with a multipart field named `file` and a Bearer session token for authenticated use.

The current demo upload screen saves sample metadata locally and does not send file bytes to that endpoint. Its preview and download controls are explicitly labeled as demonstrations. See [backend storage notes](../../backend/docs/S3_SETUP.md) before wiring real uploads into the interface.
