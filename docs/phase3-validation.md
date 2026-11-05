# Phase 3 validation record

Date: 5 November 2026. Baseline: master at `f7d95e9843eed20b490f8e3e445eb86b5ce090e1`. This record includes the follow-up to independent review of `7c319c5`, on the existing `fix/phase3-transaction-safety` branch and draft [PR #2](https://github.com/diretrix-git/inventory-management/pull/2).

The original transaction/stock repair remains intact. This follow-up closes the index-validator subset-match defect, adds secure UUIDv4 fallback on ordinary HTTP, and keeps the mandatory creation-key safety protocol. See [transaction protocol and deployment prerequisites](transaction-safety.md).

## Fresh commands and outcomes

| Command | Result |
| --- | --- |
| `npm install --save-dev --save-exact playwright@1.62.1 --no-audit --no-fund` | Passed; added two packages. Playwright is pinned as a test-only dependency with lockfile integrity records. |
| `npm test` | Passed: 35 tests, 35 passed, zero failed/skipped. Includes 30 real MongoDB tests using disposable replica-set/standalone databases and five UUID helper tests. |
| `npm run test:browser` | Passed: three Chromium origin tests (HTTPS, localhost HTTP, ordinary non-secure HTTP), zero failed/skipped. |
| `npm run typecheck` (`tsc --noEmit`) | Passed. |
| `npx eslint src/lib/order-service.ts src/lib/idempotency-key.ts src/components/orders/OrderForm.tsx tests/idempotency-key.test.ts tests/order-transactions.test.ts tests/browser/order-submit.test.mjs` | Passed with zero errors; two existing unused-import warnings in OrderForm. |
| `npm run lint` | Failed: 18 errors, 15 warnings, matching the existing branch's baseline errors. Independent master archive lint previously reproduced all 18 errors (16 warnings). Unrelated hooks/purity and other baseline lint issues were not changed. |
| `npm run build` | Failed while fetching DM Sans and IBM Plex Mono from Google Fonts under the unchanged restricted network policy. Proxy access to `fonts.googleapis.com` returned HTTP 403 during independent review; production build completion remains unverified. No fonts were stubbed and no TLS verification was disabled. |
| `git diff --check` | Passed. |

The initial Phase 3 installation (`npm ci --no-audit --no-fund`) and 20-test result at `7c319c5` are historical, not a substitute for the fresh results above.

## Review defects and regression evidence

The independent review reproduced duplicate pending orders under a weakened unique creation-key index with an extra `status: "confirmed"` partial predicate. Before this fix, newly added index regressions failed against the old subset validator. They now require all 20 concurrent requests to fail with 503 under each of nine incompatible real-server index configurations, with zero order/invoice writes and unchanged stock. Cases cover the reproduced status filter, partial global order/invoice/orderId indexes, nonunique/reversed/extended creation keys, sparse identifiers, and non-simple collation. Supported indexes continue to pass normal creation/replay tests.

Before the UUID fix, fallback tests reproduced `randomUUID is not a function`. The helper tests now verify native receiver binding, all 16 secure entropy bytes, correct v4/variant bits for all-zero/all-one input, distinct values with real secure entropy, and failure without an insecure fallback. Browser tests execute the actual helper and submit handler on locally intercepted origins, verify UUIDv4 header values and stable retry keys after a synthetic network failure, and verify secure-entropy failure produces an error without sending a request. They explicitly assert which origins are secure and where native randomUUID is available.

Migration regression: missing/malformed header values return status 400 with no stock/order/invoice changes; an upgraded client creates once, retries the same key successfully without a second deduction, and receives 409 on a changed payload. This tests the service contract reached by the route, not live HTTP authentication. The required header was not removed or made optional.

## Retained regression coverage

- Last-item contention at checkout and between different pending approvals.
- Concurrent/repeated creation keys, payload conflicts and creator scoping.
- Duplicate cart lines, invalid IDs and the exact tax-inclusive NPR 15,000 boundary.
- Insufficient approval stock and rollback after an earlier stock write.
- Concurrent approvals, double cancellation and approval racing cancellation.
- Missing restoration product and server-side invoice validation failure: complete business rollback.
- Identifier races and initialization above legacy suffixes, including deletion gaps and values above 9999.
- Standalone rejection without business writes, missing required index, and repeatable storage preparation.

All database tests used task-owned `mongo:8.0` containers (image digest `sha256:b9924c330a8bbc5800fe9c69f04a84e221eca7b28fd049a0354147d9908fa142`) and randomly named synthetic databases. No application seed, production credentials, portfolio write, deployment, merge or visibility change was performed. Independent follow-up code review found no blocking correctness issue in the fixes.

## Remaining limitations and rollout

These checks demonstrate local atomicity/concurrency and browser capability handling, not production correctness. Multi-node failover, unknown commit results/network partitions, sharded deployments, load, live HTTP authorization and complete mounted UI workflows remain unverified. Audit/notification/email effects remain best effort; no durable outbox or historical reconciliation was added. Existing cancellation invoice behavior is unchanged.

Before rollout, drain all old backend writers, prepare the exact supported indexes, migrate external clients, and refresh/close old browser forms. Headerless clients are intentionally incompatible; there is no deduplication bypass. Browser keys remain component-lifetime only, so recovery after reload/ambiguous responses requires checking saved orders before creating another submission. Consult the protocol document for the full migration contract.

No replacement PR or repository settings change is required: pushing this branch updates PR #2. Google Fonts access remains blocked in the running environment; no network configuration changes were made in this follow-up.
