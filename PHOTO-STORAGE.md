# Private photo storage

The app supports a private Cloudflare R2 bucket through the official AWS S3 client. Configure the server environment before enabling uploads. Existing demo photo objects require a separate migration.

## Configuration

Configure these server-only environment variables locally and, when ready to deploy, in the Railway app service:

```text
R2_ACCOUNT_ID=<Cloudflare account ID>
R2_BUCKET_NAME=<private bucket name>
R2_ACCESS_KEY_ID=<bucket-scoped S3 access key>
R2_SECRET_ACCESS_KEY=<S3 secret access key>
SESSION_SECRET=<existing application session secret, at least 32 characters>
```

Use an R2 credential limited to object read/write for the selected bucket. Keep public bucket access off. Uploads pass through the authenticated app, so browser CORS configuration is unnecessary. Never put credentials in client variables, source control, or chat. Do not rotate the existing session secret merely to configure R2 if it already meets the length requirement.

## Behavior

- JPEG, PNG and WEBP only, maximum 10 MiB. The server checks byte signatures, declared content type and exact size.
- Upload authorizations expire in five minutes and belong to the authenticated staff member. Conditional object writes reject overwrite/replay.
- The browser stores `/car-photos/r2/<uuid>` in ticket records. Object metadata allows attaching that user's successfully uploaded image for 30 minutes, including across app restarts.
- Saved photo reads and backup downloads check the associated ticket's organization/location scope. Unattached previews are restricted to the uploader. Responses are private and not cached.
- Ticket creation fails visibly when a selected image cannot upload, rather than silently losing the image.
- Missing storage configuration produces a clear 503 response. No automatic bucket creation, database migration, object deletion, or Replit fallback occurs.

## Legacy demo images

The retained Neon demo data contains 51 car-photo references and 59 plate-photo references. Reference equality does not prove image objects exist. Existing simple `/car-photos/<id>` paths can be preserved by copying objects to `car-photos/<id>` in R2 with the correct image Content-Type. Inventory exact reference shapes and verify source objects before copying. Do not rewrite or clear the existing references without a deliberate migration step.

## Validation and remaining work

Run `npm run test:photos`, `npm run test:security`, `npm run test:release`, and `npm run build`. The focused photo tests use an isolated in-memory object store and local HTTP server; they do not substitute for a real R2 test. The production branch has existing TypeScript errors in edit-file-tree.tsx, ContentProvider.tsx, landing.tsx and the security-audit severity sorting in routes.ts; the photo change adds no diagnostics.

Live storage validation on 2026-09-28 passed upload, exact-byte readback, owner metadata, wrong-owner attachment denial, replay prevention and ownership across service recreation. Bucket `valet-s-photos` is private. Deployment and browser-workflow evidence is recorded separately in the migration status. Legacy demo image transfer and mobile-device checks remain separate work.

References: [Cloudflare AWS SDK example](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) and [R2 S3 compatibility, including conditional PutObject](https://developers.cloudflare.com/r2/api/s3/api/).

## Ticket location

Accounts without a default location select one in the ticket wizard. The list is filtered to the dashboard organization when selected, and the server still validates organization and user location scope. Missing location blocks submission before any photo upload.
