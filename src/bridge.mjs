const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' }
});

function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('01')) return `+20${digits.slice(1)}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  throw new Error('Invalid phone number');
}

export function createBridge({ token, now = () => new Date().toISOString() } = {}) {
  if (!token) throw new Error('BRIDGE_TOKEN is required');
  let authorized = false;
  let executor = 'disconnected';
  const queue = [];

  function authenticated(request) {
    return request.headers.get('authorization') === `Bearer ${token}`;
  }

  return {
    setExecutorStatus(status) { executor = status; },
    async handle(request) {
      if (!authenticated(request)) return json({ error: 'Unauthorized' }, 401);
      const url = new URL(request.url);
      if (url.pathname === '/authorize' && request.method === 'POST') {
        authorized = true;
        return json({ authorized: true, at: now() });
      }
      if (url.pathname === '/stop' && request.method === 'POST') {
        authorized = false;
        queue.length = 0;
        return json({ authorized: false, queued: 0 });
      }
      if (url.pathname === '/status' && request.method === 'GET') {
        return json({ authorized, queued: queue.length, executor });
      }
      if (url.pathname === '/send' && request.method === 'POST') {
        if (!authorized) return json({ error: 'Automatic sending is not authorized' }, 403);
        let body;
        try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
        if (!body?.message?.trim()) return json({ error: 'Message is required' }, 400);
        let to;
        try { to = normalizePhone(body.to); } catch { return json({ error: 'Invalid phone number' }, 400); }
        const item = { id: crypto.randomUUID(), to, message: body.message.trim(), createdAt: now() };
        queue.push(item);
        return json({ queued: true, to: item.to, message: item.message }, 202);
      }
      if (url.pathname === '/queue' && request.method === 'GET') return json({ items: queue });
      return json({ error: 'Not found' }, 404);
    }
  };
}

export default { fetch(request, env) {
  const bridge = createBridge({ token: env.BRIDGE_TOKEN });
  return bridge.handle(request);
} };
