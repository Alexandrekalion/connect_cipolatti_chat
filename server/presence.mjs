import crypto from "node:crypto";
import { authenticate } from "./auth.mjs";
import { readStore, updateStore } from "./store.mjs";

const HEARTBEAT_TIMEOUT_MS = 90_000;
const AWAY_AFTER_MS = 5 * 60_000;
const PRESENCE_SWEEP_MS = 15_000;
const connections = new Map();
const lastKnownPresence = new Map();
let nextConnectionId = 1;

function rejectUpgrade(socket, status = 403, message = "Forbidden") {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function acceptKey(key) {
  return crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
}

function sendFrame(socket, payload) {
  if (socket.destroyed) return;
  const body = Buffer.from(JSON.stringify(payload));
  const header = [0x81];
  if (body.length < 126) {
    header.push(body.length);
  } else if (body.length < 65536) {
    header.push(126, (body.length >> 8) & 0xff, body.length & 0xff);
  } else {
    header.push(127, 0, 0, 0, 0, (body.length >> 24) & 0xff, (body.length >> 16) & 0xff, (body.length >> 8) & 0xff, body.length & 0xff);
  }
  socket.write(Buffer.concat([Buffer.from(header), body]));
}

function closeFrame(socket) {
  if (!socket.destroyed) socket.end(Buffer.from([0x88, 0x00]));
}

function parseFrames(state, chunk) {
  state.buffer = state.buffer ? Buffer.concat([state.buffer, chunk]) : chunk;
  const messages = [];
  let offset = 0;
  while (state.buffer.length - offset >= 2) {
    const first = state.buffer[offset];
    const second = state.buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let length = second & 0x7f;
    let cursor = offset + 2;
    if (length === 126) {
      if (state.buffer.length - cursor < 2) break;
      length = state.buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (length === 127) {
      if (state.buffer.length - cursor < 8) break;
      const high = state.buffer.readUInt32BE(cursor);
      const low = state.buffer.readUInt32BE(cursor + 4);
      if (high !== 0) throw new Error("WebSocket frame too large.");
      length = low;
      cursor += 8;
    }
    const maskLength = masked ? 4 : 0;
    if (state.buffer.length - cursor < maskLength + length) break;
    const mask = masked ? state.buffer.subarray(cursor, cursor + 4) : null;
    cursor += maskLength;
    const payload = Buffer.from(state.buffer.subarray(cursor, cursor + length));
    cursor += length;
    offset = cursor;
    if (opcode === 0x8) {
      messages.push({ close: true });
      continue;
    }
    if (opcode === 0x0a) {
      messages.push({ pong: true });
      continue;
    }
    if (opcode !== 0x1) continue;
    if (mask) for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    messages.push(JSON.parse(payload.toString("utf8")));
  }
  state.buffer = state.buffer.subarray(offset);
  return messages;
}

function liveConnectionsFor(userId, now = Date.now()) {
  return [...connections.values()].filter((item) =>
    item.userId === userId
    && !item.socket.destroyed
    && now - item.lastHeartbeatAt <= HEARTBEAT_TIMEOUT_MS
  );
}

export function presenceForUser(user = {}) {
  const now = Date.now();
  const live = liveConnectionsFor(user.id, now);
  if (!live.length) {
    return {
      userId: user.id,
      status: "Offline",
      online: false,
      away: false,
      lastSeenAt: lastKnownPresence.get(user.id)?.lastSeenAt || user.lastSeenAt || "",
    };
  }
  const lastActivityAt = Math.max(...live.map((item) => item.lastActivityAt || item.connectedAt || now));
  const away = now - lastActivityAt > AWAY_AFTER_MS;
  return {
    userId: user.id,
    status: away ? "Ausente" : "Online",
    online: !away,
    away,
    lastSeenAt: lastKnownPresence.get(user.id)?.lastSeenAt || user.lastSeenAt || "",
  };
}

export function attachPresence(user = {}) {
  const presence = presenceForUser(user);
  return {
    ...user,
    status: presence.status,
    lastSeenAt: presence.lastSeenAt || user.lastSeenAt || "",
    presence,
  };
}

export async function listPresenceForActor(actor) {
  const data = await readStore();
  return (data.users || [])
    .filter((user) => user.accessStatus === "Ativo")
    .map((user) => presenceForUser(user));
}

export function presenceDiagnosticsForActor(actor) {
  const now = Date.now();
  const rows = [...connections.values()].map((item) => ({
    connectionId: item.id,
    userId: item.userId,
    self: item.userId === actor?.id,
    connectedForSeconds: Math.max(0, Math.round((now - item.connectedAt) / 1000)),
    heartbeatAgeSeconds: Math.max(0, Math.round((now - item.lastHeartbeatAt) / 1000)),
    idleSeconds: Math.max(0, Math.round((now - item.lastActivityAt) / 1000)),
    socketDestroyed: Boolean(item.socket.destroyed),
  }));
  return {
    activeConnections: rows.filter((item) => !item.socketDestroyed && item.heartbeatAgeSeconds <= HEARTBEAT_TIMEOUT_MS / 1000).length,
    selfConnections: rows.filter((item) => item.self && !item.socketDestroyed && item.heartbeatAgeSeconds <= HEARTBEAT_TIMEOUT_MS / 1000).length,
    heartbeatTimeoutSeconds: HEARTBEAT_TIMEOUT_MS / 1000,
    awayAfterSeconds: AWAY_AFTER_MS / 1000,
    connections: rows,
  };
}

function publicPresenceForKnownUsers() {
  const userIds = new Set([...connections.values()].map((item) => item.userId));
  for (const [userId] of lastKnownPresence) userIds.add(userId);
  return [...userIds].map((userId) => presenceForUser({ id: userId, lastSeenAt: lastKnownPresence.get(userId)?.lastSeenAt || "" }));
}

function broadcastPresence(users = publicPresenceForKnownUsers()) {
  const payload = { type: "presence:update", users };
  for (const item of connections.values()) sendFrame(item.socket, payload);
}

async function persistLastSeen(userId, iso) {
  if (!userId || !iso) return;
  try {
    await updateStore((data) => {
      const user = (data.users || []).find((item) => item.id === userId);
      if (!user) return;
      const previous = new Date(user.lastSeenAt || 0).getTime();
      const next = new Date(iso).getTime();
      if (!previous || next - previous > 60_000) user.lastSeenAt = iso;
    });
  } catch {}
}

function markDisconnected(connection) {
  if (!connection || connection.closed) return;
  connection.closed = true;
  connections.delete(connection.id);
  const stillLive = liveConnectionsFor(connection.userId);
  if (!stillLive.length) {
    const lastSeenAt = new Date().toISOString();
    lastKnownPresence.set(connection.userId, { status: "Offline", lastSeenAt });
    persistLastSeen(connection.userId, lastSeenAt);
  }
  broadcastPresence(publicPresenceForKnownUsers());
}

function sweepPresence() {
  const now = Date.now();
  let changed = false;
  for (const connection of [...connections.values()]) {
    if (connection.socket.destroyed || now - connection.lastHeartbeatAt > HEARTBEAT_TIMEOUT_MS) {
      markDisconnected(connection);
      changed = true;
    }
  }
  const current = publicPresenceForKnownUsers();
  for (const presence of current) {
    const signature = `${presence.status}|${presence.lastSeenAt || ""}`;
    if (lastKnownPresence.get(presence.userId)?.signature !== signature) {
      lastKnownPresence.set(presence.userId, { ...presence, signature });
      changed = true;
    }
  }
  if (changed) broadcastPresence(current);
}

setInterval(sweepPresence, PRESENCE_SWEEP_MS).unref?.();

export async function handlePresenceUpgrade(request, socket, head) {
  try {
    const key = request.headers["sec-websocket-key"];
    if (!key) return rejectUpgrade(socket, 400, "Bad Request");
    const user = await authenticate(request);
    if (!user) return rejectUpgrade(socket, 401, "Unauthorized");
    socket.write([
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey(key)}`,
      "",
      "",
    ].join("\r\n"));
    if (head?.length) socket.unshift(head);
    socket.setKeepAlive(true, 30_000);

    const now = Date.now();
    const connection = {
      id: `presence-${nextConnectionId++}`,
      userId: user.id,
      socket,
      state: { buffer: Buffer.alloc(0) },
      connectedAt: now,
      lastHeartbeatAt: now,
      lastActivityAt: now,
      closed: false,
    };
    connections.set(connection.id, connection);
    lastKnownPresence.set(user.id, { status: "Online", lastSeenAt: user.lastSeenAt || "", signature: `Online|${user.lastSeenAt || ""}` });
    sendFrame(socket, { type: "presence:snapshot", heartbeatMs: 30_000, awayAfterMs: AWAY_AFTER_MS, offlineAfterMs: HEARTBEAT_TIMEOUT_MS, users: await listPresenceForActor(user) });
    broadcastPresence(publicPresenceForKnownUsers());

    socket.on("data", (chunk) => {
      try {
        for (const message of parseFrames(connection.state, chunk)) {
          if (message.close) return markDisconnected(connection);
          if (message.pong) {
            connection.lastHeartbeatAt = Date.now();
            continue;
          }
          if (message.type === "presence:heartbeat") connection.lastHeartbeatAt = Date.now();
          if (message.type === "presence:activity") {
            const at = Date.now();
            connection.lastHeartbeatAt = at;
            connection.lastActivityAt = at;
          }
        }
        broadcastPresence(publicPresenceForKnownUsers());
      } catch {
        sendFrame(socket, { type: "error", error: "Falha ao processar presenca." });
      }
    });
    socket.on("error", () => markDisconnected(connection));
    socket.on("close", () => markDisconnected(connection));
    socket.on("end", () => markDisconnected(connection));
  } catch {
    rejectUpgrade(socket, 500, "Internal Server Error");
  }
}
