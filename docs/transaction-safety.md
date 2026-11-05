# Phase 3 order and inventory transactions

Implements the future-mutation repairs identified as INV-01–INV-04 in [Phase 2 PR #1](https://github.com/diretrix-git/inventory-management/pull/1). The private portfolio review packet was consulted read-only. This branch starts from master; it does not change the Phase 2 documentation branch.

## Behavior and API contract

- The tax-inclusive NPR 15,000 boundary is unchanged: lower totals are confirmed and deducted at creation; totals at or above it remain pending without reserving stock. Pending creation still validates availability, but later approval must check it again.
- Authenticated staff/admin may create. Confirmation and cancellation retain the existing admin guard. Valid transitions remain pending → confirmed/cancelled and confirmed → cancelled. Repeated/invalid transitions return 409 without stock or audit side effects.
- POST `/api/orders` now requires `Idempotency-Key`: 16–128 ASCII letters, digits, `_` or `-` (UUID recommended). Reuse the key for retries of the same logical request. The key is scoped to the authenticated creator; the canonical customer/items/notes payload must match. First success returns 201; replay returns 200 with `replayed: true`; conflicting payloads return 409. Missing/invalid keys or duplicate product lines return 400. Other API clients must adopt the header.
- The browser retains the key across failed requests while the form payload is unchanged, and clears it after success. This is component-lifetime retry protection, not persistent recovery across reloads or devices. Different keys intentionally represent different orders.
- Product/settings reads, guarded decrements, order creation and invoice creation share a snapshot transaction with majority commit. Each decrement requires `quantity >= requested`. Approval/cancellation claim the prior order status and perform stock effects in the same transaction. A missing restoration product aborts cancellation instead of silently losing stock.
- The driver retries transient transaction conflicts. Callback operations are sequential. No email, notification or audit action runs inside a retryable callback. Existing audit action names and best-effort post-commit behavior are preserved; crashes can still lose those side effects. There is no durable outbox or exactly-once delivery claim.
- ORD/INV identifiers retain UTC dates and at least four sequence digits. Independent atomic counters initialize above the largest existing numeric suffix. Deleted documents do not cause reuse. Failed/replayed attempts may consume numbers; gaps are expected. Counters must not be deleted/reset.
- Cancellation retains the existing invoice behavior (invoice snapshots are not voided by this change).

## Database deployment prerequisites

MongoDB transactions require a replica set or supported sharded cluster; standalone MongoDB is unsupported. There is no nontransaction fallback. Ensure snapshot/majority operations and normal transaction privileges are supported by the target topology.

Before switching writers, stop/drain **all old application instances**. Mixed-version writes are unsafe because the old count-based allocator and unguarded transition code do not participate in this protocol. Back up the database and reconcile historically inconsistent stock/orders separately; this repair does not infer historical stock effects.

Using the intended development/staging deployment configuration, run:

```sh
npx tsx --env-file=.env.local scripts/prepare-order-storage.ts
```

The command checks topology, creates collections and declared indexes additively, and never drops indexes or rewrites records. It must succeed before traffic. In particular, retain unique orderNumber, invoiceNumber, invoice.orderId, and the partial unique `(createdBy, idempotencyKey)` index. Legacy orders without a key are excluded from that new index. Resolve incompatible existing indexes/duplicate data before rollout rather than bypassing uniqueness. Runtime creation waits for development index initialization and verifies required unique indexes, failing closed when they are missing. Production may disable automatic index creation after explicit preparation. New service callers require an established Mongoose connection.

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
npm run typecheck
npm run lint
npm run build
# Remove only this disposable fixture, including its anonymous volumes.
docker rm -fv inventory-phase3-mongo inventory-phase3-standalone
```

The tests use directConnection because the container advertises its internal replica-set port. This single-node fixture tests real database atomicity, contention and rollback; it does not model multi-node failover, sharded transactions, production capacity, or deployment authorization. Service-level tests do not replace HTTP role/authentication or browser end-to-end tests. Readiness results are recorded separately in the implementation PR.
