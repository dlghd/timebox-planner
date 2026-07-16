// Timebox Planner 동기화 서버 (Cloudflare Worker + KV)
// - POST /register {id, name, pinHash}  → {token, name}
// - POST /login    {id, pinHash}        → {token, name}
// - GET  /data     (Bearer token)       → {savedAt, data}
// - PUT  /data     (Bearer token) {savedAt, data} → {ok}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors },
      });

    try {
      if (url.pathname === '/register' && req.method === 'POST') {
        const { id, name, pinHash } = await req.json();
        if (!id || !/^[A-Za-z0-9_-]{2,30}$/.test(id) || !pinHash) return json({ error: 'invalid' }, 400);
        if (await env.KV.get('acct:' + id)) return json({ error: 'exists' }, 409);
        await env.KV.put('acct:' + id, JSON.stringify({
          name: String(name || '').slice(0, 50),
          pinHash,
          createdAt: new Date().toISOString(),
        }));
        const token = crypto.randomUUID();
        await env.KV.put('tok:' + token, id);
        return json({ token, name });
      }

      if (url.pathname === '/login' && req.method === 'POST') {
        const { id, pinHash } = await req.json();
        const acct = JSON.parse((await env.KV.get('acct:' + id)) || 'null');
        if (!acct) return json({ error: 'no-account' }, 404);
        if (acct.pinHash !== pinHash) return json({ error: 'auth' }, 401);
        const token = crypto.randomUUID();
        await env.KV.put('tok:' + token, id);
        return json({ token, name: acct.name });
      }

      // ── 이하 로그인 필요 ──
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const uid = token ? await env.KV.get('tok:' + token) : null;
      if (!uid) return json({ error: 'unauthorized' }, 401);

      if (url.pathname === '/data' && req.method === 'GET') {
        const d = await env.KV.get('data:' + uid);
        return json(d ? JSON.parse(d) : { savedAt: 0, data: {} });
      }

      if (url.pathname === '/data' && req.method === 'PUT') {
        const body = await req.text();
        if (body.length > 2_000_000) return json({ error: 'too-large' }, 413);
        const j = JSON.parse(body);
        await env.KV.put('data:' + uid, JSON.stringify({
          savedAt: j.savedAt || Date.now(),
          data: j.data || {},
        }));
        return json({ ok: true });
      }

      return json({ error: 'not-found' }, 404);
    } catch (e) {
      return json({ error: 'bad-request' }, 400);
    }
  },
};
