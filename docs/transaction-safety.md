# Phase 3 order and inventory transactions

Implements the future-mutation repairs identified as INV-01–INV-04 in [Phase 2 PR #1](https://github.com/diretrix-git/inventory-management/pull/1). The private portfolio review packet was consulted read-only. This branch starts from master; it does not change the Phase 2 documentation branch.

## Behavior and API contract

- The tax-inclusive NPR 15,000 boundary is unchanged: lower totals are confirmed and deducted at creation; totals at or above it remain pending without reserving stock. Pending creation still validates availability, but later approval must check it again.
- Authenticated staff/admin may create. Confirmation and cancellation retain the existing admin guard. Valid transitions remain pending → confirmed/cancelled and confirmed → cancelled. Repeated/invalid transitions return 409 without stock or audit side effects.
- POST `/api/orders` now requires `Idempotency-Key`: 16–128 ASCII letters, digits, `_` or `-` (UUID recommended). Reuse the key for retries of the same logical request. The key is scoped to the authenticated creator; the canonical customer/items/notes payload must match. First success returns 201; replay returns 200 with `replayed: true`; conflicting payloads return 409. Missing/invalid keys or duplicate product lines return 400. Other API clients must adopt the header.
- The browser uses native `crypto.randomUUID()` on HTTPS/localhost when available. On ordinary non-secure HTTP it generates RFC 4122 UUIDv4 values from 16 `crypto.getRandomValues()` bytes, setting the version/variant bits explicitly. There is no `Math.random` fallback. Key generation runs inside submit error handling; missing/failing secure entropy prevents the request and displays an error.
- The browser retains the key across failed requests while the form payload is unchanged, and clears it after success. This is component-lifetime retry protection, not persistent recovery across reloads or devices. Different keys intentionally represent different orders.
- Product/settings reads, guarded decrements, order creation and invoice creation share a snapshot transaction with majority commit. Each decrement requires `quantity >= requested`. Approval/cancellation claim the prior order status and perform stock effects in the same transaction. A missing restoration product aborts cancellation instead of silently losing stock.
- The driver retries transient transaction conflicts. Callback operations are sequential. No email, notification or audit action runs inside a retryable callback. Existing audit action names and best-effort post-commit behavior are preserved; crashes can still lose those side effects. There is no durable outbox or exactly-once delivery claim.
- ORD/INV identifiers retain UTC dates and at least four sequence digits. Independent atomic counters initialize above the largest existing numeric suffix. Deleted documents do not cause reuse. Failed/replayed attempts may consume numbers; gaps are expected. Counters must not be deleted/reset.
- Cancellation retains the existing invoice behavior (invoice snapshots are not voided by this change).

## Client migration and compatibility

The required header is an intentional breaking change from master, not an optional optimization. Headerless requests from old browser bundles and external clients receive HTTP 400 without creating an order/invoice or deducting stock. There is no unkeyed compatibility bypass and no automatic downgrade on errors.

Before enabling the patched server, inventory all POST clients and update them to generate a key per logical order, persist it until the outcome is known, and resend the same key with the same payload after a timeout/lost response. A retry must not generate a fresh key. Handle both 201 (created) and 200 (replayed) as success; treat 409 with a changed payload as a conflict rather than silently switching keys. Header names are case-insensitive; the key value is case-sensitive.

Refresh or close all already-open old order forms during cutover; updating server code does not update JavaScript in existing tabs. The new browser retains keys only during the component lifetime. After a reload or changed payload following an ambiguous response, inspect saved orders before starting a new logical submission. Plan client rollout separately from draining old backend writers: master ignores the extra header but supplies no deduplication guarantee, and mixed backend versions remain unsafe.

The migration regression maps a missing header to the same empty value used by the API route, proves missing/malformed keys fail with status 400 and no writes, then proves an upgraded request and same-key retry create exactly one order/invoice and one stock deduction. A changed payload with that key still fails with 409. This is service-contract coverage, not a live HTTP authentication test.

## Database deployment prerequisites

MongoDB transactions require a replica set or supported sharded cluster; standalone MongoDB is unsupported. There is no nontransaction fallback. Ensure snapshot/majority operations and normal transaction privileges are supported by the target topology.

Before switching writers, stop/drain **all old application instances**. Mixed-version writes are unsafe because the old count-based allocator and unguarded transition code do not participate in this protocol. Back up the database and reconcile historically inconsistent stock/orders separately; this repair does not infer historical stock effects.

Using the intended development/staging deployment configuration, run:

```sh
npx tsx --env-file=.env.local scripts/prepare-order-storage.ts
```

The command checks topology, creates collections and declared indexes additively, and never drops indexes or rewrites records. It must succeed before traffic. Runtime creation accepts only these supported contracts:

| Collection | Exact ordered ascending key | Partial filter |
| --- | --- | --- |
| orders | `{ orderNumber: 1 }` | Absent |
| invoices | `{ invoiceNumber: 1 }` | Absent |
| invoices | `{ orderId: 1 }` | Absent |
| orders | `{ createdBy: 1, idempotencyKey: 1 }` | Exactly `{ idempotencyKey: { $type: "string" } }` |

Every index must have `unique: true`, be non-sparse, have no TTL expiry, and use simple collation (absent/default simple or explicit `locale: "simple"`). Index names do not matter. Extra key fields, reversed key order, extra partial-filter predicates (including `status: "confirmed"`), or different filter representations are rejected. Even a logically equivalent but unsupported filter representation must be replaced through a reviewed migration rather than accepted by a subset check. The three global identifiers must never use partial indexes. Legacy orders without a creation key remain excluded from the supported creation-key index.

Resolve incompatible existing indexes/duplicate data before rollout rather than bypassing uniqueness. Runtime creation waits for development index initialization and checks the full index contract, returning 503 without business writes if it is missing/incompatible. Production may disable automatic index creation after explicit preparation. Do not drop or alter indexes while accepting writes; the readiness check does not lock the index catalog. New service callers require an established Mongoose connection.

## Disposable regression suite

Dependencies: locked npm install, Node compatible with Next/Mongoose, Docker, and MongoDB 8. The tests deliberately ignore application `MONGODB_URI`; they connect only to ports 27027 (replica set) and 27028 (standalone) on loopback and drop only their own randomly named `inventory_phase3_test_*` databases. Do not point those ports at an existing/shared database. Fixtures contain generated IDs and synthetic products/customers only; no seed script or production credentials are used.

```sh
npm ci --no-audit --no-fund
docker run -d --name inventory-phase3-mongo -p 127.0.0.1:27027:27017 mongo:8.0 --replSet phase3 --bind_ip_all
docker exec inventory-phase3-mongo mongosh --quiet --eval 'rs.initiate({_id:"phase3",members:[{_id:0,host:"localhost:27017"}]})'
# Wait until hello().isWritablePrimary is true before running the suite.
docker exec inventory-phase3-mongo mongosh --quiet --eval 'db.hello().isWritablePrimary'
docker run -d --name inventory-phase3-standalone -p 127.0.0.1:27028:27017 mongo:8.0 --bind_ip_all
npm test
# Requires compatible Chromium; set CHROMIUM_PATH if it is not /usr/bin/chromium.
npm run test:browser
npm run typecheck
npm run lint
npm run build
# Remove only this disposable fixture, including its anonymous volumes.
docker rm -fv inventory-phase3-mongo inventory-phase3-standalone
```

The tests use directConnection because the container advertises its internal replica-set port. This single-node fixture tests real database atomicity, contention and rollback; it does not model multi-node failover, sharded transactions, production capacity, or deployment authorization. The separate browser suite uses pinned Playwright and an installed Chromium. It intercepts HTTPS, localhost HTTP, and ordinary HTTP origins locally and executes the actual UUID helper/submit handler with synthetic responses. It verifies native versus fallback paths, same-key retries, and errors before a request when secure entropy fails. It does not mount the full application, exercise real TLS/authentication, or replace HTTP role tests and full UI end-to-end tests. Readiness results are recorded separately in the implementation PR.
