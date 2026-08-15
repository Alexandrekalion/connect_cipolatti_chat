import crypto from "node:crypto";
import { authenticate, canAccessMeeting } from "./auth.mjs";
import { createId, readStore, updateStore } from "./store.mjs";

const rooms = new Map();

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
  const header = [];
  header.push(0x81);
  if (body.length < 126) {
    header.push(body.length);
  } else if (body.length < 65536) {
    header.push(126, (body.length >> 8) & 0xff, body.length & 0xff);
  } else {
    header.push(127, 0, 0, 0, 0, (body.length >> 24) & 0xff, (body.length >> 16) & 0xff, (body.length >> 8) & 0xff, body.length & 0xff);
  }
  socket.write(Buffer.concat([Buffer.from(header), body]));
}

function sendPing(socket) {
  if (!socket.destroyed) socket.write(Buffer.from([0x89, 0x00]));
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
      if (high !== 0) throw new Error("Quadro WebSocket muito grande.");
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
    if (opcode === 0x9) {
      continue;
    }
    if (opcode !== 0x1) continue;
    if (mask) for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    messages.push(JSON.parse(payload.toString("utf8")));
  }
  state.buffer = state.buffer.subarray(offset);
  return messages;
}

function publicPeer(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    department: user.department || user.dept || "",
    initials: user.initials || "KC",
    photoUrl: user.photoUrl || "",
  };
}

function roomFor(meetingId) {
  if (!rooms.has(meetingId)) rooms.set(meetingId, { peers: new Map(), activeShare: null, activeMics: new Map() });
  return rooms.get(meetingId);
}

function broadcast(room, payload, exceptUserId = null) {
  for (const peer of room.peers.values()) {
    if (peer.user.id !== exceptUserId) sendFrame(peer.socket, payload);
  }
}

function logSignalEvent(meetingId, actor, action, detail = "") {
  updateStore((data) => {
    data.integrationLogs ||= [];
    data.integrationLogs.unshift({
      id: createId("meeting-signal"),
      at: new Date().toISOString(),
      level: "info",
      source: "Reuniao WebRTC",
      action,
      meetingId,
      actorId: actor?.id || null,
      actor: actor?.name || "Participante",
      detail,
    });
    data.integrationLogs = data.integrationLogs.slice(0, 1000);
  }).catch(() => {});
}

export async function handleMeetingUpgrade(request, socket, head) {
  try {
    const expected = process.env.KALION_INTERNAL_API_KEY;
    if (expected && request.headers["x-kalion-api-key"] !== expected) return rejectUpgrade(socket, 401, "Unauthorized");
    const url = new URL(request.url, `http://${request.headers.host || "kalion.invalid"}`);
    const match = url.pathname.match(/^\/api\/meetings\/([^/]+)\/signaling$/);
    if (!match) return rejectUpgrade(socket, 404, "Not Found");
    const key = request.headers["sec-websocket-key"];
    if (!key) return rejectUpgrade(socket, 400, "Bad Request");
    const user = await authenticate(request);
    if (!user) return rejectUpgrade(socket, 401, "Unauthorized");
    const data = await readStore();
    const meeting = (data.meetings || []).find((item) => item.id === match[1]);
    if (!meeting || !canAccessMeeting(user, meeting)) return rejectUpgrade(socket, 403, "Forbidden");
    if (meeting.status === "Encerrada") return rejectUpgrade(socket, 409, "Meeting Closed");

    socket.write([
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey(key)}`,
      "",
      "",
    ].join("\r\n"));
    if (head?.length) socket.unshift(head);
    socket.setKeepAlive(true, 20_000);

    const meetingId = meeting.id;
    const room = roomFor(meetingId);
    const existing = room.peers.get(user.id);
    if (existing) closeFrame(existing.socket);
    const peer = { socket, user, state: { buffer: Buffer.alloc(0) }, meetingId, connectedAt: new Date().toISOString(), alive: true };
    room.peers.set(user.id, peer);

    const peers = [...room.peers.values()].map((item) => publicPeer(item.user));
    sendFrame(socket, { type: "meeting-presence", selfId: user.id, peers, activeShare: room.activeShare, activeMics: [...room.activeMics.values()] });
    broadcast(room, { type: "peer-joined", peer: publicPeer(user), peers }, user.id);
    logSignalEvent(meetingId, user, "join", "Participante conectado ao canal de sinalizacao.");

    const cleanup = () => {
      const current = room.peers.get(user.id);
      if (current?.socket !== socket) return;
      room.peers.delete(user.id);
      const wasSharing = room.activeShare?.peer?.id === user.id;
      if (wasSharing) room.activeShare = null;
      const hadMic = room.activeMics.delete(user.id);
      const nextPeers = [...room.peers.values()].map((item) => publicPeer(item.user));
      broadcast(room, { type: "peer-left", peerId: user.id, peers: nextPeers });
      if (wasSharing) broadcast(room, { type: "screen-share-stopped", peerId: user.id, reason: "disconnect" });
      if (hadMic) broadcast(room, { type: "mic-stopped", peerId: user.id, reason: "disconnect" });
      if (!room.peers.size) rooms.delete(meetingId);
      logSignalEvent(meetingId, user, wasSharing ? "disconnect-sharing" : "disconnect", "Participante desconectado do canal de sinalizacao.");
    };

    const pingTimer = setInterval(async () => {
      if (socket.destroyed) return clearInterval(pingTimer);
      const stillAuthenticated = await authenticate(request);
      if (!stillAuthenticated) {
        sendFrame(socket, {
          type: "session-ended",
          error: request.authError?.error || "Sessão encerrada. Faça login novamente.",
        });
        cleanup();
        closeFrame(socket);
        return clearInterval(pingTimer);
      }
      if (!peer.alive) {
        logSignalEvent(meetingId, user, "timeout", "WebSocket sem resposta de keepalive.");
        cleanup();
        socket.destroy();
        return clearInterval(pingTimer);
      }
      peer.alive = false;
      sendPing(socket);
    }, 20_000);
    pingTimer.unref?.();

    socket.on("data", (chunk) => {
      try {
        for (const message of parseFrames(peer.state, chunk)) {
          if (message.pong) {
            peer.alive = true;
            continue;
          }
          if (message.close) {
            cleanup();
            return socket.destroy();
          }
          if (message.type === "screen-start") {
            room.activeShare = { peer: publicPeer(user), startedAt: new Date().toISOString() };
            broadcast(room, { type: "screen-share-started", share: room.activeShare }, user.id);
            logSignalEvent(meetingId, user, "screen-start", "Compartilhamento iniciado.");
          } else if (message.type === "screen-stop") {
            if (room.activeShare?.peer?.id === user.id) room.activeShare = null;
            broadcast(room, { type: "screen-share-stopped", peerId: user.id, reason: "stopped" }, user.id);
            logSignalEvent(meetingId, user, "screen-stop", "Compartilhamento encerrado.");
          } else if (message.type === "mic-start") {
            room.activeMics.set(user.id, { peer: publicPeer(user), startedAt: new Date().toISOString() });
            broadcast(room, { type: "mic-started", peer: publicPeer(user) }, user.id);
            logSignalEvent(meetingId, user, "mic-start", "Microfone ativado.");
          } else if (message.type === "mic-stop") {
            room.activeMics.delete(user.id);
            broadcast(room, { type: "mic-stopped", peerId: user.id, reason: "muted" }, user.id);
            logSignalEvent(meetingId, user, "mic-stop", "Microfone silenciado.");
          } else if (message.type === "peer-status") {
            broadcast(room, { type: "peer-status", from: user.id, peer: publicPeer(user), status: message.status, detail: message.detail || "" }, user.id);
          } else if (message.type === "signal" && message.to && message.signal) {
            const target = room.peers.get(message.to);
            if (target) sendFrame(target.socket, { type: "signal", from: user.id, peer: publicPeer(user), signal: message.signal });
          }
        }
      } catch (error) {
        sendFrame(socket, { type: "error", error: "Falha ao processar sinalizacao da reuniao." });
        logSignalEvent(meetingId, user, "error", error.message);
      }
    });
    socket.on("error", cleanup);
    socket.on("close", () => { clearInterval(pingTimer); cleanup(); });
    socket.on("end", () => { clearInterval(pingTimer); cleanup(); });
  } catch (error) {
    rejectUpgrade(socket, 500, "Internal Server Error");
  }
}
