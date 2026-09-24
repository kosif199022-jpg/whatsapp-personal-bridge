import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridge } from '../src/bridge.mjs';

test('shows a public landing page when the root is opened in a browser', async () => {
  const bridge = createBridge({ token: 'test-token' });
  const response = await bridge.handle(new Request('https://bridge.test/'));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /WhatsApp Personal Bridge/);
});

test('requires explicit prior authorization before queueing a message', async () => {
  const bridge = createBridge({ token: 'test-token' });
  const response = await bridge.handle(new Request('https://bridge.test/send', {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify({ to: '+201023082293', message: 'ازيك' })
  }));
  assert.equal(response.status, 403);
});

test('queues a normalized message after authorization', async () => {
  const bridge = createBridge({ token: 'test-token' });
  await bridge.handle(new Request('https://bridge.test/authorize', {
    method: 'POST',
    headers: { authorization: 'Bearer test-token' },
  }));
  const response = await bridge.handle(new Request('https://bridge.test/send', {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify({ to: '01023082293', message: ' ازيك ' })
  }));
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    queued: true,
    to: '+201023082293',
    message: 'ازيك'
  });
});

test('stop revokes authorization and clears pending messages', async () => {
  const bridge = createBridge({ token: 'test-token' });
  await bridge.handle(new Request('https://bridge.test/authorize', { method: 'POST', headers: { authorization: 'Bearer test-token' } }));
  await bridge.handle(new Request('https://bridge.test/send', {
    method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify({ to: '+201023082293', message: 'test' })
  }));
  const stopped = await bridge.handle(new Request('https://bridge.test/stop', { method: 'POST', headers: { authorization: 'Bearer test-token' } }));
  assert.equal(stopped.status, 200);
  const status = await bridge.handle(new Request('https://bridge.test/status', { headers: { authorization: 'Bearer test-token' } }));
  assert.deepEqual(await status.json(), { authorized: false, queued: 0, executor: 'disconnected' });
});
