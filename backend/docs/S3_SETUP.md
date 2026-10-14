# Production upload storage

The existing storage service uses `AWS_REGION` and `S3_BUCKET_NAME`, with credentials resolved through the AWS SDK provider chain. Prefer a deployment role restricted to the bucket and application prefix rather than credentials in source.

Production stores file bytes in S3 and metadata in the configured JSON file. Development stores bytes in `UPLOAD_DIR` and uses the same metadata shape. Keep both metadata and production account stores on persistent, backed-up storage.

`S3_PUBLIC_BASE_URL` is optional. Set it only when exposing those objects is intentional. Customer documents should remain private; this version has no authenticated download endpoint or presigned download flow. Do not make a bucket public to work around that missing feature.

The API accepts a multipart `file` field, validates its configured size limit and MIME/extension allowlists, and records the authenticated company and uploader. S3 delivery has not been tested with live credentials in the local verification run.
