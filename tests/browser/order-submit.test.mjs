import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
import { chromium } from 'playwright';

// Exercise the actual handler/helper in browser security contexts without
// starting the app, contacting these origins, authenticating, or loading fonts.
const form = readFileSync(new URL('../../src/components/orders/OrderForm.tsx', import.meta.url), 'utf8');
const start = form.indexOf('  async function onSubmit(');
const end = form.indexOf('\n\n  return (', start);
assert.ok(start >= 0 && end > start, 'OrderForm submit handler must be located');
const handler = form.slice(start, end).replace('data: OrderFormValues', 'data');
const helper = ts.transpileModule(
  readFileSync(new URL('../../src/lib/idempotency-key.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.ESNext } },
).outputText.replace(/^export /gm, '');
let browser;
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    headless: true,
    args: ['--no-sandbox'],
  });
});
after(async () => { await browser?.close(); });

for (const origin of ['https://inventory-review.invalid', 'http://localhost:32109', 'http://inventory-review.invalid']) {
  test(`${origin}: native/fallback UUID, stable retry key, and handled entropy failure`, async () => {
    const page = await browser.newPage();
    try {
      await page.route(`${origin}/**`, route => route.fulfill({
        body: '<html><body>Synthetic browser fixture</body></html>', contentType: 'text/html',
      }));
      await page.goto(`${origin}/`);
      await page.addScriptTag({ content: helper });
      const result = await page.evaluate(async handler => {
        const cart = [{ productId: '0123456789abcdef01234567', quantity: 1 }];
        const submission = { current: null };
        let requests = [], errors = [], successes = 0, firstRequest = true;
        const toast = { error: error => errors.push(error), success: () => {}, warning: () => {} };
        const fetch = async (url, options) => {
          requests.push(options.headers['Idempotency-Key']);
          if (firstRequest) { firstRequest = false; throw new Error('Synthetic lost response'); }
          return { ok: true, json: async () => ({ order: { orderNumber: 'SYNTHETIC', totalAmount: 100 } }) };
        };
        const fn = new Function('cart', 'submission', 'fetch', 'toast', 'onSuccess', 'friendlyError', `return (${handler})`)(
          cart, submission, fetch, toast, () => successes++, error => error,
        );
        const nativeAvailable = typeof crypto.randomUUID === 'function';
        const data = { customerName: 'Synthetic', customerEmail: '', notes: '' };
        await fn(data);
        await fn(data);
        const retry = { keys: [...requests], errors: errors.length, successes };
        Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
          getRandomValues() { throw new Error('Synthetic entropy failure'); },
        } });
        requests = []; errors = []; successes = 0;
        await fn(data);
        return { secure: isSecureContext, nativeAvailable, retry, entropyFailure: { requests: requests.length, errors: errors.length, successes } };
      }, handler);
      const secure = origin !== 'http://inventory-review.invalid';
      assert.equal(result.secure, secure);
      assert.equal(result.nativeAvailable, secure);
      assert.equal(result.retry.keys.length, 2);
      assert.equal(result.retry.keys[0], result.retry.keys[1]);
      assert.match(result.retry.keys[0], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      assert.equal(result.retry.successes, 1);
      assert.equal(result.retry.errors, 1);
      assert.deepEqual(result.entropyFailure, { requests: 0, errors: 1, successes: 0 });
    } finally {
      await page.close();
    }
  });
}
