import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';

process.env.VERCEL = '1';
process.env.SUPABASE_URL = 'https://be-imports-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-secret';
process.env.ADMIN_PASSWORD_HASH = `scrypt:${'a'.repeat(32)}:${scryptSync('senha-de-teste', 'a'.repeat(32), 64).toString('hex')}`;
const { handler } = await import('../server.js');

async function request(url, options = {}) {
  const req = {
    url, method: options.method || 'GET', headers: { host: 'be-imports.vercel.app', ...options.headers },
    async *[Symbol.asyncIterator]() { if (options.body) yield Buffer.from(options.body); }
  };
  const res = {
    status: 200, headers: {}, output: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(chunk = '') { this.output += chunk; }
  };
  await handler(req, res);
  return { status: res.status, headers: res.headers, data: JSON.parse(res.output) };
}

test('Vercel emite URL de upload somente para o painel autenticado', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let signedRequests = 0;
    globalThis.fetch = async (url, options) => {
      signedRequests++;
      assert.match(url, /^https:\/\/be-imports-test\.supabase\.co\/storage\/v1\/object\/upload\/sign\/be-imports-products\/[a-f0-9-]+\.png$/);
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.apikey, 'test-secret');
      const path = new URL(url).pathname.replace('/storage/v1', '');
      return { ok: true, text: async () => JSON.stringify({ url: `${path}?token=signed-test-token` }) };
    };
    const body = JSON.stringify({ type: 'image/png' });
    const headers = { 'content-type': 'application/json' };
    assert.equal((await request('/api/admin/upload-url', { method: 'POST', headers, body })).status, 401);
    const login = await request('/api/admin/login', { method: 'POST', headers, body: JSON.stringify({ password: 'senha-de-teste' }) });
    assert.equal(login.status, 200);
    const cookie = login.headers['Set-Cookie'].split(';')[0];
    assert.match(login.headers['Set-Cookie'], /; Secure$/);
    const authorized = { ...headers, cookie };
    assert.equal((await request('/api/admin/upload-url', { method: 'POST', headers: authorized, body: JSON.stringify({ type: 'image/svg+xml' }) })).status, 400);
    const signed = await request('/api/admin/upload-url', { method: 'POST', headers: authorized, body });
    assert.equal(signed.status, 200);
    assert.equal(signed.data.direct, true);
    assert.match(signed.data.uploadUrl, /^https:\/\/be-imports-test\.supabase\.co\/storage\/v1\/object\/upload\/sign\/be-imports-products\/[a-f0-9-]+\.png\?token=signed-test-token$/);
    assert.match(signed.data.url, /^https:\/\/be-imports-test\.supabase\.co\/storage\/v1\/object\/public\/be-imports-products\/[a-f0-9-]+\.png$/);
    assert.equal(signedRequests, 1);
  } finally { globalThis.fetch = originalFetch; }
});
