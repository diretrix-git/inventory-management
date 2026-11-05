# Transaction safety implementation plan

Baseline: master at f7d95e9843eed20b490f8e3e445eb86b5ce090e1.
References: inventory-management PR #1 (INV-01–INV-07), private portfolio PR #1 (read only).

1. Add focused Node/tsx integration tests against a disposable local MongoDB replica set. Cover last-item contention, repeated/concurrent creation keys, conflicting key payloads, duplicate cart lines, insufficient approval stock, double cancellation, concurrent approvals, partial-write rollback, and the tax-inclusive NPR 15,000 boundary.
2. Extract order mutations into a database service. Read products/settings in the transaction; reject duplicate product lines; decrement with quantity >= requested predicates. Create order and invoice in that transaction, with sequential operations and driver-managed retries.
3. Allocate daily identifiers through atomic counters outside business transactions (gaps allowed), initialized above existing numeric suffixes. Preserve ORD/INV date prefixes and unique indexes. Scope creation idempotency keys to the authenticated creator and compare canonical payload hashes; return existing orders without repeat side effects.
4. Claim status changes with a prior-status predicate inside a transaction; guard approval decrements and check cancellation restoration matches. Preserve pending stock behavior, admin-only transitions, and existing post-commit best-effort audit/notification semantics.
5. Integrate routes and browser creation keys. Document replica-set/sharded deployment requirements, explicit index preparation, retries, and evidence limits. Standalone MongoDB must fail closed; no nontransaction fallback.
6. Run npm lint, tsc, full tests, and production build. Record actual outcomes. Commit only on the implementation branch; push and open a draft PR targeting master if GitHub API authorization permits.

Review focus: legacy identifier gaps, missing products during cancellation, invalid ObjectIds, payload changes with reused keys, and transaction callback retries. Tests use synthetic fixtures only and never read application MONGODB_URI.
