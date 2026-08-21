import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import scriptsProxy from '../api/scripts-proxy.js';

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    chunks: [],
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = String(value); },
    end(value) { if (value !== undefined) this.chunks.push(Buffer.from(value)); },
  };
}

test('the first-party screenplay proxy preserves nested paths, writes, session cookies, and query data', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url: String(url), options };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ETag: 'project-v1' },
    });
  };

  try {
    const req = Readable.from([Buffer.from('{"status":"ready"}')]);
    req.method = 'PATCH';
    req.url = '/api/scripts-proxy?path=scr_abc%2Fpreproduction%2Fbudget&view=summary';
    req.query = { path: 'scr_abc/preproduction/budget', view: 'summary' };
    req.headers = {
      accept: 'application/json',
      cookie: 'filmscript_session=private',
      origin: 'https://filmscript.app',
      'content-type': 'application/json',
      'x-filmscript-client-id': 'client_123',
    };
    const res = responseRecorder();

    await scriptsProxy(req, res);

    assert.equal(captured.url, 'https://api.filmscript.app/api/scripts/scr_abc/preproduction/budget?view=summary');
    assert.equal(captured.options.method, 'PATCH');
    assert.equal(captured.options.headers.Cookie, 'filmscript_session=private');
    assert.equal(captured.options.headers.Origin, 'https://filmscript.app');
    assert.equal(captured.options.headers['X-FilmScript-Client-Id'], 'client_123');
    assert.equal(Buffer.from(captured.options.body).toString('utf8'), '{"status":"ready"}');
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers.etag, 'project-v1');
    assert.equal(Buffer.concat(res.chunks).toString('utf8'), '{"ok":true}');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the screenplay proxy rejects path traversal before contacting AWS', async () => {
  const originalFetch = globalThis.fetch;
  let contacted = false;
  globalThis.fetch = async () => { contacted = true; return new Response(); };
  try {
    const req = Readable.from([]);
    req.method = 'GET';
    req.url = '/api/scripts-proxy?path=..%2Fsecrets';
    req.query = { path: '../secrets' };
    req.headers = {};
    const res = responseRecorder();
    await scriptsProxy(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(contacted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
