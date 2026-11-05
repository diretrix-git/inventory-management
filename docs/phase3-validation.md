# Phase 3 validation record

Date: 5 November 2026. Baseline: master at `f7d95e9843eed20b490f8e3e445eb86b5ce090e1`. This record includes the follow-ups to independent review of `7c319c5` and the production-build verification at `faa1b4f`, on the existing `fix/phase3-transaction-safety` branch and draft [PR #2](https://github.com/diretrix-git/inventory-management/pull/2).

The original transaction/stock repair, exact index validator, secure UUIDv4 fallback and mandatory creation-key protocol remain intact. The latest change replaces build-time Google font fetches with pinned, locally bundled copies of the same font families. See [transaction protocol and deployment prerequisites](transaction-safety.md).

## Fresh commands and outcomes

| Command | Result |
| --- | --- |
| `npm install --save-exact @fontsource-variable/dm-sans@5.3.0 @fontsource/ibm-plex-mono@5.3.0 --no-audit --no-fund` | Passed; added two pinned font packages from the permitted npm registry with lockfile integrity records. |
| `npm test` | Passed: 35 tests, 35 passed, zero failed/skipped. Includes 30 real MongoDB tests using disposable replica-set/standalone databases and five UUID helper tests. |
| `npm run test:browser` | Passed: three Chromium origin tests (HTTPS, localhost HTTP, ordinary non-secure HTTP), zero failed/skipped. |
| `npm run typecheck` (`tsc --noEmit`) | Passed. |
| `npx eslint src/app/layout.tsx` | Passed with zero errors/warnings for the source changed in this build-only follow-up. |
| `npm run lint` (previous verification) | Previously failed with 18 baseline errors and 15 warnings; not rerun or repaired in this build-only task. |
| `npm run build` | Passed after the local-font change: compiled, completed Next.js TypeScript checks, generated all 36 pages and finalized optimization. Before the change, the same command failed fetching DM Sans/IBM Plex Mono; fresh CONNECT probes to both `fonts.googleapis.com` and `fonts.gstatic.com` returned HTTP 403. No checks or TLS verification were disabled. |
| `npm run start -- --hostname 127.0.0.1 --port 3100` plus `node /tmp/inventory-font-smoke.cjs` | Passed local production-page smoke: `/login` returned 200; DM Sans including the rupee sign and IBM Plex Mono weights 400/500/600/700 loaded through six local font responses, all 200; both OFL notices returned 200; zero external requests. |
| `git diff --check` | Passed. |

The initial Phase 3 installation (`npm ci --no-audit --no-fund`) and 20-test result at `7c319c5` are historical, not a substitute for the fresh results above.

## Production font build correction

`src/app/layout.tsx` uses Fontsource's supported CSS imports instead of `next/font/google`. DM Sans normal variable weight 100–1000 and IBM Plex Mono normal weights 400/500/600/700 remain unchanged. CSS variables, extended Unicode subsets and `font-display: swap` are retained. Font files are bundled into Next.js hashed static assets; future builds no longer require Google Fonts access. No remote font payload was mocked or replaced with unrelated assets.

The exact packages were obtained over the permitted npm registry using normal TLS and integrity verification. Both carry SIL OFL 1.1 licenses; complete unmodified notices are copied to public assets. See [font provenance and license notes](../public/fonts/README.md). No production or network settings were changed.

The local production smoke verifies actual font loading, not pixel-for-pixel parity with the previous remote font response. Fontsource's CSS does not recreate Next's automatic font preloads or generated fallback metrics. Transient font-swap layout shift/performance is therefore a remaining visual uncertainty; no complete visual comparison is claimed. Font package versions are pinned rather than implicitly following changes to Google's current font response.

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

No replacement PR or repository settings change is required: pushing this branch updates PR #2. Google Fonts access remains blocked in the running environment, but the real production build now passes using locally bundled licensed fonts. No network configuration changes were made in this follow-up. The build gate is resolved; operational and historical evidence limits above remain.
