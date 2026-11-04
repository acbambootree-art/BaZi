// Presence for 歇腳廟: one Durable Object per hall (room), max 100 people, no chat.
// Uses the WebSocket hibernation API so idle rooms cost nothing.
import { DurableObject } from 'cloudflare:workers';

const CAP = 100;
const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0);
const ACTS = new Set(['bai', 'palms', 'incense', 'jiao', 'qian', 'lamp', 'kneel', 'muyu']);

export class Room extends DurableObject {
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    if (this.ctx.getWebSockets().length >= CAP) {
      server.accept();
      server.send(JSON.stringify({ t: 'full' }));
      server.close(1000, 'full');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), ready: false });
    return new Response(null, { status: 101, webSocket: client });
  }

  others(ws) { return this.ctx.getWebSockets().filter((s) => s !== ws && s.deserializeAttachment()?.ready); }
  count() { return this.ctx.getWebSockets().filter((s) => s.deserializeAttachment()?.ready).length; }
  broadcast(ws, msg) { const s = JSON.stringify(msg); for (const o of this.others(ws)) { try { o.send(s); } catch {} } }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 400) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    const me = ws.deserializeAttachment();
    if (!me) return;

    if (m.t === 'hello' && !me.ready) {
      Object.assign(me, {
        ready: true,
        name: String(m.name || '有緣人').slice(0, 12),
        color: num(m.color, 0, 0xffffff) | 0,
        x: num(m.x, -40, 40), z: num(m.z, -40, 40), ry: num(m.ry, -10, 10),
        last: 0,
      });
      ws.serializeAttachment(me);
      const peers = this.others(ws).map((s) => { const p = s.deserializeAttachment(); return { id: p.id, name: p.name, color: p.color, x: p.x, z: p.z, ry: p.ry }; });
      ws.send(JSON.stringify({ t: 'welcome', id: me.id, peers, count: this.count() }));
      this.broadcast(ws, { t: 'join', peer: { id: me.id, name: me.name, color: me.color, x: me.x, z: me.z, ry: me.ry }, count: this.count() });
      return;
    }
    if (!me.ready) return;

    if (m.t === 'pos') {
      const now = Date.now();
      if (now - me.last < 60) return;            // max ~16 updates/s per person
      me.last = now;
      me.x = num(m.x, -40, 40); me.z = num(m.z, -40, 40); me.ry = num(m.ry, -10, 10);
      ws.serializeAttachment(me);
      this.broadcast(ws, { t: 'pos', id: me.id, x: me.x, z: me.z, ry: me.ry });
    } else if (m.t === 'act' && ACTS.has(m.a)) {
      const r = Array.isArray(m.r) ? m.r.slice(0, 2).map((v) => (typeof v === 'boolean' ? v : num(v, 0, 999) | 0)) : undefined;
      this.broadcast(ws, { t: 'act', id: me.id, a: m.a, r });
    }
  }

  async webSocketClose(ws) { this.leave(ws); }
  async webSocketError(ws) { this.leave(ws); }
  leave(ws) {
    const me = ws.deserializeAttachment();
    try { ws.close(); } catch {}
    if (me?.ready) this.broadcast(ws, { t: 'leave', id: me.id, count: this.others(ws).length });
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/room\/(\d{1,4})$/);
    if (!m) return new Response('歇腳廟 presence', { status: 200 });
    const room = env.ROOM.get(env.ROOM.idFromName('hall-' + m[1]));
    return room.fetch(req);
  },
};
