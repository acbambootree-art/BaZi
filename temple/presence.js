// Shared rooms: see each other, no chat. Talks to temple/worker (Cloudflare Durable Object).
// No URL → solo mode, every call is a no-op.
export function connectPresence(url, h) {
  let ws = null, room = 1, closed = false, retry = 0, lastPos = '';
  const send = (m) => ws?.readyState === 1 && ws.send(JSON.stringify(m));

  function open() {
    if (!url) return;
    closed = false;
    ws = new WebSocket(`${url.replace(/\/$/, '')}/room/${room}`);
    ws.onopen = () => { retry = 0; send({ t: 'hello', ...h.me() }); };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      switch (m.t) {
        case 'welcome': h.onWelcome({ ...m, room }); h.onCount(m.count); break;
        case 'full': room++; ws.onclose = null; ws.close(); open(); break;   // room has 100 people, try the next hall
        case 'join': h.onJoin(m.peer); h.onCount(m.count); break;
        case 'leave': h.onLeave(m.id); h.onCount(m.count); break;
        case 'pos': h.onPos(m); break;
        case 'act': h.onAct(m); break;
      }
    };
    ws.onclose = () => {
      if (closed) return;
      setTimeout(open, Math.min(15000, 1000 * 2 ** retry++));
    };
  }
  open();

  return {
    pos(x, z, ry) {
      const k = `${x.toFixed(2)},${z.toFixed(2)},${ry.toFixed(2)}`;
      if (k !== lastPos) { lastPos = k; send({ t: 'pos', x: +x.toFixed(2), z: +z.toFixed(2), ry: +ry.toFixed(2) }); }
    },
    act(a, r) { send({ t: 'act', a, r }); },
    close() { closed = true; ws?.close(); ws = null; },
    open() { if (!ws) open(); },
  };
}
