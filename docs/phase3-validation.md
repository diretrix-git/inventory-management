# Phase 3 validation record

Date: 5 November 2026. Baseline: master at `f7d95e9843eed20b490f8e3e445eb86b5ce090e1`.

The implementation replaces pretransaction stock checks/unguarded decrements, separately saved status/stock effects, and count-based numbering with guarded transaction services, conditional status claims, atomic daily counters and creator-scoped creation keys. The NPR 15,000 tax-inclusive boundary, role guards and existing best-effort audit actions are preserved. See [transaction protocol and deployment prerequisites](transaction-safety.md).

## Actual commands and outcomes

| Command | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Passed; 765 locked packages installed. Existing dependency deprecation notices. |
| `npm test` | Passed: 20 tests, 20 passed, zero failed/skipped. Real MongoDB 8.0 disposable single-node replica set and standalone containers, random synthetic databases, no production credentials. |
| `npm run typecheck` (`tsc --noEmit`) | Passed. |
| `npm run lint` | Failed: 18 errors, 15 warnings. Baseline archive lint independently reproduced all 18 errors (and 16 warnings). Existing errors include React hooks/purity rules in dashboard/shared UI and other baseline lint findings; unrelated source was not repaired. |
| `npx eslint src/lib/order-service.ts src/lib/order-utils.ts src/models/Order.ts src/models/Sequence.ts src/types/index.ts src/app/api/orders/route.ts 'src/app/api/orders/[id]/route.ts' src/components/orders/OrderForm.tsx scripts/prepare-order-storage.ts tests/*.test.ts` | Passed with zero errors; two existing unused-import warnings in OrderForm. |
| `npm run build` | Failed while fetching DM Sans and IBM Plex Mono from Google Fonts. The configured proxy returned HTTP 403 for `fonts.googleapis.com`; production build completion is unverified. No fonts were stubbed and no verification was disabled. |
| `git diff --check` | Passed. |
| `node --import tsx scripts/prepare-order-storage.ts` | Exercised by tests against a synthetic replica-set database twice successfully; rejected standalone topology explicitly. |

Before the identifier repair, the focused concurrency test failed: twelve concurrent allocations produced only one distinct identifier. The repaired suite checks number uniqueness and initialization above legacy suffixes, including deletion gaps and suffixes above 9999.

## Regression coverage

- Last-item contention at automatic checkout and between different pending approvals.
- Concurrent/repeated creation with the same key; conflicting payloads; creator scoping.
- Duplicate cart lines and invalid product/order IDs.
- Exact tax-inclusive NPR 15,000 boundary and below-boundary behavior.
- Insufficient stock during approval after an earlier stock write: complete rollback.
- Concurrent/repeated approval and double cancellation; approval racing cancellation.
- Missing product during cancellation: earlier stock restoration and status both roll back.
- Real server-side invoice validation failure after stock writes: order/invoice/stock rollback.
- Missing required unique index fails closed.
- Standalone transaction rejection leaves stock/orders/invoices unchanged.
- Repeatable storage preparation and explicit unsupported-topology rejection.

The container image used was `mongo:8.0`, pulled with digest `sha256:b9924c330a8bbc5800fe9c69f04a84e221eca7b28fd049a0354147d9908fa142`. Both containers were dedicated to this task. No application seed, external SMTP/Cloudinary operation, or production database operation was performed.

## Remaining limitations

These results demonstrate local database concurrency and rollback, not production correctness. Multi-node failover, sharded deployments, capacity/load, real HTTP authorization, and browser retry behavior were not tested end to end. Existing role guards and browser key retention were reviewed by inspection. Post-commit audit/notification/email effects remain best effort; no durable outbox was added. Historical stock discrepancies and invoice voiding are outside this repair.

Drain old writers and prepare required indexes before rollout. Missing/invalid creation keys now return 400, so other API clients must adopt the documented header. Review the protocol document before deploying; this task does not deploy or merge anything.

## External access limits

Both Phase 2 review packets were read through Git refs without modifying those PRs or the portfolio. GitHub API access returned Forbidden, preventing automatic PR creation at the time of validation. The necessary additive domains (`api.github.com`, `fonts.googleapis.com`, `fonts.gstatic.com`) were saved to the cloud environment settings draft. Saving does not apply or publish that configuration; network policy remained unchanged during these checks.
