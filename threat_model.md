# Threat Model

## Project Overview

This project is a multi-tenant valet management SaaS for hotel and venue staff. It uses a React/Vite frontend, a Node/Express backend, PostgreSQL via Drizzle, Replit Auth plus local username/password login, server-side sessions, and a WebSocket channel for live ticket updates.

The main production security concerns are tenant isolation between organizational units and locations, protection of guest and vehicle data, safe handling of low-entropy customer ticket identifiers, and preventing staff users from seeing or changing data outside their assigned scope.

## Assets

- **Guest and vehicle records** — guest names, room numbers, ticket numbers, vehicle details, parking locations, photos, and trip history. Exposure affects guest privacy and hotel operations.
- **User accounts and sessions** — local passwords, password hashes, Replit Auth sessions, and session cookies. Compromise allows staff or admin impersonation.
- **Tenant boundaries** — OU and location assignments for users and tickets. Breaking this boundary lets one customer organization access another organization's data.
- **Operational state** — ticket statuses, retrieval schedules, live queue state, and audit-relevant timing fields. Tampering disrupts valet operations and customer service.
- **Application secrets and integrations** — database credentials, session secret, Google Vision API key, SMTP credentials, and object-storage signing capability.

## Trust Boundaries

- **Browser to API** — all client input is untrusted, including public ticket lookups and authenticated staff actions.
- **Public customer to staff/admin boundary** — customer-facing ticket endpoints are intentionally unauthenticated, while staff/admin APIs must enforce stronger checks.
- **Authenticated user to tenant boundary** — every read and write must be limited to the caller's OU and, where applicable, assigned locations.
- **HTTP session to WebSocket boundary** — the WebSocket channel must authenticate clients and avoid sending cross-tenant data to connected staff.
- **Server to PostgreSQL** — the backend has broad database access, so route-layer authorization failures can become full record exposure or tampering.
- **Server to external services** — Google Vision, object storage, OIDC, and SMTP calls cross out of the application trust boundary and must not expose secrets or excessive user data.

## Scan Anchors

- **Production entry points**: `server/index.ts`, `server/routes.ts`, `server/replitAuth.ts`
- **Highest-risk code areas**: public ticket routes in `server/routes.ts`, staff/admin mutation routes in `server/routes.ts`, scoped data access in `server/storage.ts`, WebSocket broadcast logic in `server/routes.ts`, user schemas in `shared/schema.ts`
- **Public surfaces**: `/api/tickets/:ticketNumber`, `/api/faqs`, public photo route `/car-photos/:photoPath(*)`
- **Authenticated/admin surfaces**: `/api/staff/*`, `/api/admin/*`, `/api/users*`, `/api/locations*`, `/ws`, `/api/backup/*`, `/api/ocr/plate`
- **Usually dev-only and low priority unless reachability changes**: `server/vite.ts`, build tooling, scripts, and local development helpers

## Threat Categories

### Spoofing

The application relies on Replit OIDC and local session-based authentication. Protected endpoints MUST require a valid server-side session, and local-login sessions MUST not be easier to forge or reuse than OIDC-backed sessions. Role strings and user provisioning MUST stay consistent so authorization checks apply as intended.

### Tampering

Public customers can trigger ticket actions using only a short ticket number, while staff can update ticket state and metadata. The system MUST treat ticket numbers as low-trust identifiers, validate every state-changing request server-side, and enforce OU/location ownership checks before any read or write. Customer-controlled values like retrieval schedules and OCR uploads MUST be bounded to prevent abuse.

### Information Disclosure

The system stores guest identity, room numbers, vehicle details, car photos, and staff account data. Public APIs, authenticated APIs, logs, and WebSocket messages MUST expose only the minimum fields needed for that caller. Password hashes, private photo paths, and one tenant's live ticket data MUST never be disclosed to another tenant or to unauthenticated users.

### Denial of Service

Public endpoints accept repeated ticket lookups and retrieval requests, and the server accepts large JSON bodies and OCR payloads. Production-facing unauthenticated or broadly reachable endpoints SHOULD have practical abuse controls such as rate limiting, request size constraints appropriate to the endpoint, and safeguards against mass queue manipulation.

### Elevation of Privilege

This is a multi-tenant admin system, so broken object-level authorization is a primary risk. Staff and admins MUST only be able to act on users, tickets, trips, photos, and exports within their authorized OU and location scope. Real-time channels and backup/export features MUST preserve the same tenant boundaries as the REST APIs.
