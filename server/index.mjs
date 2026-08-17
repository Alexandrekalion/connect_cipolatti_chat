import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { getSecureConfig, publicConfig, saveSecureConfig } from "./config.mjs";
import { createId, dataDir, initStore, readStore, updateStore } from "./store.mjs";
import {
  maxAttachmentBytes,
  readUploadedAttachment, readUploadedAudio, readUploadedImage,
  removeUploadedImage, saveUploadedAttachment, saveUploadedAudio, saveUploadedImage,
} from "./uploads.mjs";
import {
  applyCorsHeaders,
  authenticate, canAccessConversation, changePassword, clearSessionCookie, createUser,
  canAccessContact, canAccessInternalConversation, canAccessMeeting, canAccessQuickReply,
  canManageContact,
  deleteUser, ensureAuthSchema, isAdmin, listPermissions, listPersistentSessions, listUsers,
  login, logout, logoutAllDevices, revokeAllPersistentSessions, revokePersistentSession,
  revokePersistentSessionsByUser,
  clearRememberCookie, handleCorsPreflight, restoreRememberedSession, savePermissions,
  setRememberCookie, setSessionCookie, updateUser, validateMutationOrigin,
} from "./auth.mjs";
import { processIncomingMessage, processStatusEvent, runWaitingMessages } from "./triage.mjs";
import { handleMeetingUpgrade } from "./meeting-signaling.mjs";
import { attachPresence, handlePresenceUpgrade, listPresenceForActor, presenceDiagnosticsForActor } from "./presence.mjs";
import {
  extractWebhookEvents, isMetaTestMessageEvent, listMessageTemplates, normalizeIncomingMessage, sendTemplate, sendText,
  serializeWhatsAppError, subscribeAppToWaba, testConnection, userFacingSendFailure,
  validateMetaSignature,
} from "./whatsapp.mjs";

await initStore();
await ensureAuthSchema();

const port = Number(process.env.PORT || 3001);
const releaseVersion = "2026.06.21-collaboration-persistence-v1";

function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function readBody(request, limit = 5 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("Payload excede o limite permitido.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function cleanAttachmentCaption(value) {
  let decoded = String(value || "");
  try { decoded = decodeURIComponent(decoded); } catch {}
  return decoded.replace(/\u0000/g, "").trim().slice(0, 2000);
}

function fileCategoryFromStored(file = {}) {
  const mime = String(file.mime || file.type || "").toLowerCase();
  const extension = String(file.extension || file.name?.split(".").pop() || file.originalName?.split(".").pop() || "").toLowerCase();
  if (extension === "ico" || mime === "image/x-icon" || mime === "image/vnd.microsoft.icon") return "image";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (extension === "pdf") return "pdf";
  if (["doc", "docx"].includes(extension)) return "word";
  if (["xls", "xlsx", "csv"].includes(extension)) return "sheet";
  if (["skp", "dwg", "dxf"].includes(extension)) return "technical";
  return "document";
}

function requireInternalKey(request, response) {
  const expected = process.env.KALION_INTERNAL_API_KEY;
  if (!expected || request.headers["x-kalion-api-key"] !== expected) {
    json(response, 401, { error: "Chave interna inválida ou ausente." });
    return false;
  }
  return true;
}

function actorScope(request) {
  return request.auth;
}

function audit(data, request, action, detail) {
  data.auditLogs.unshift({
    id: createId("audit"), at: new Date().toISOString(), action, detail,
    actor: request.auth?.name || "Backend", actorId: request.auth?.id || null,
    ip: request.socket.remoteAddress,
  });
}

function requireRole(request, response, roles) {
  if (!roles.includes(request.auth?.role)) {
    json(response, 403, { error: "Sem permissão para esta operação." });
    return false;
  }
  return true;
}

function requestErrorStatus(error) {
  if (/não encontrad[ao]|nao encontrad[ao]/i.test(error.message)) return 404;
  if (/sem permissão|sem permissao|fora do seu departamento|fora do departamento|indisponível|indisponivel/i.test(error.message)) return 403;
  return 400;
}

function webhookPayloadSummary(payload) {
  const changes = (payload.entry || []).flatMap((entry) => entry.changes || []);
  const values = changes.map((change) => change.value || {});
  return {
    object: payload.object || "",
    entries: payload.entry?.length || 0,
    changes: changes.length,
    messages: values.reduce((sum, value) => sum + (value.messages?.length || 0), 0),
    statuses: values.reduce((sum, value) => sum + (value.statuses?.length || 0), 0),
    errors: values.reduce((sum, value) => sum + (value.errors?.length || 0), 0),
    phoneNumberIds: [...new Set(values.map((value) => value.metadata?.phone_number_id).filter(Boolean))],
    displayPhoneNumbers: [...new Set(values.map((value) => value.metadata?.display_phone_number).filter(Boolean))],
    messageTypes: [...new Set(values.flatMap((value) => (value.messages || []).map((message) => message.type)).filter(Boolean))],
  };
}

async function auditWebhookReceipt({ request, raw, payload = null, signatureValid = false, error = "" }) {
  const receivedAt = new Date().toISOString();
  const payloadHash = crypto.createHash("sha256").update(raw).digest("hex");
  const summary = payload ? webhookPayloadSummary(payload) : {};
  await updateStore((data) => {
    data.webhookEvents ||= [];
    data.integrationLogs ||= [];
    const event = {
      id: createId("webhook"), at: receivedAt, source: "Meta WhatsApp",
      method: request.method, path: request.url, remoteAddress: request.socket.remoteAddress,
      userAgent: request.headers["user-agent"] || "", contentLength: raw.length,
      signaturePresent: Boolean(request.headers["x-hub-signature-256"]),
      signatureValid, payloadHash, summary, payload: payload || null, error,
    };
    data.webhookEvents.unshift(event);
    data.webhookEvents = data.webhookEvents.slice(0, 200);
    data.integrationLogs.unshift({
      id: createId("webhook"), at: receivedAt, level: signatureValid ? "info" : "error",
      source: "Meta webhook", code: signatureValid ? "WEBHOOK_RECEIVED" : "WEBHOOK_REJECTED",
      message: signatureValid ? "Webhook recebido e auditado." : "Webhook rejeitado antes do processamento.",
      operation: "webhook_receive", detail: { ...summary, payloadHash, error },
    });
  });
  return { payloadHash, summary };
}

function publicDirectoryUser(user) {
  const outOfOffice = outOfOfficeStatus(user.outOfOffice);
  return attachPresence({
    id: user.id,
    name: user.name,
    displayName: user.displayName || user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    jobTitle: user.jobTitle || user.cargo || "",
    department: user.department || user.dept || "",
    dept: user.department || user.dept || "",
    initials: user.initials || "KC",
    photoUrl: user.photoUrl || "",
    avatarUrl: user.photoUrl || "",
    phone: user.phone || "",
    extension: user.extension || user.ramal || "",
    mobile: user.mobile || "",
    company: user.company || "",
    lastSeenAt: user.lastSeenAt || "",
    status: user.status || "Offline",
    outOfOffice,
  });
}

function parseOutOfOfficeDate(value, boundary = "start") {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const suffix = boundary === "end" ? "T23:59:59.999-03:00" : "T00:00:00.000-03:00";
    return new Date(`${raw}${suffix}`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(raw)) {
    return new Date(`${raw}${raw.length === 16 ? ":00.000" : ""}-03:00`);
  }
  return new Date(raw);
}

function outOfOfficeStatus(outOfOffice = {}, now = new Date()) {
  const enabled = outOfOffice?.enabled === true;
  const start = outOfOffice?.startAt ? parseOutOfOfficeDate(outOfOffice.startAt, "start") : null;
  const end = outOfOffice?.endAt ? parseOutOfOfficeDate(outOfOffice.endAt, "end") : null;
  const validStart = start && Number.isFinite(start.getTime());
  const validEnd = end && Number.isFinite(end.getTime());
  const message = String(outOfOffice?.message || "").trim().slice(0, 1000);
  const active = Boolean(enabled && message && validStart && validEnd && start.getTime() <= now.getTime() && now.getTime() <= end.getTime());
  const scheduled = Boolean(enabled && validStart && validEnd && now.getTime() < start.getTime());
  const expired = Boolean(enabled && validEnd && now.getTime() > end.getTime());
  return {
    enabled,
    active,
    scheduled,
    expired,
    startAt: validStart ? start.toISOString() : "",
    endAt: validEnd ? end.toISOString() : "",
    message,
    label: active ? `Fora da empresa - retorna em ${end.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}`
      : scheduled ? `Programado - começa em ${start.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}`
      : expired ? "Expirado" : "Desativado",
  };
}

function normalizeOutOfOfficeInput(input = {}, actor) {
  const enabled = input.enabled === true;
  const start = input.startAt ? parseOutOfOfficeDate(input.startAt, "start") : null;
  const end = input.endAt ? parseOutOfOfficeDate(input.endAt, "end") : null;
  const message = String(input.message || "").trim();
  if (enabled) {
    if (!start || !Number.isFinite(start.getTime())) throw new Error("Informe a data e hora de início.");
    if (!end || !Number.isFinite(end.getTime())) throw new Error("Informe a data e hora de retorno.");
    if (end.getTime() < start.getTime()) throw new Error("A data de retorno precisa ser igual ou posterior ao início.");
    if (!message) throw new Error("Informe a mensagem automática.");
    if (message.length > 1000) throw new Error("A mensagem automática deve ter no máximo 1.000 caracteres.");
  }
  return {
    enabled,
    startAt: enabled ? start.toISOString() : "",
    endAt: enabled ? end.toISOString() : "",
    message: enabled ? message.slice(0, 1000) : "",
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.id || "",
  };
}

function deactivateExpiredOutOfOffice(data, user, now = new Date()) {
  const status = outOfOfficeStatus(user?.outOfOffice, now);
  if (!status.expired || user.outOfOffice.autoDisabledAt) return status;
  user.outOfOffice = {
    ...user.outOfOffice,
    enabled: false,
    autoDisabledAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  data.auditLogs.unshift({
    id: createId("audit"), at: now.toISOString(), action: "Fora da empresa desativado automaticamente",
    detail: user.name, actor: "Backend", actorId: null, ip: "",
  });
  return outOfOfficeStatus(user.outOfOffice, now);
}

function maybeAppendOutOfOfficeReply(data, conversation, senderId, now = new Date()) {
  ensureInternalShape(conversation);
  if ((conversation.type || "individual") === "group") return null;
  if ((conversation.participantIds || []).length !== 2) return null;
  if (conversation.status === "closed") return null;
  const recipientId = (conversation.participantIds || []).find((id) => id !== senderId);
  if (!recipientId) return null;
  const absentUser = (data.users || []).find((user) => user.id === recipientId && String(user.accessStatus || "Ativo").toLowerCase() !== "inativo");
  if (!absentUser) return null;
  const status = deactivateExpiredOutOfOffice(data, absentUser, now);
  if (!status.active) return null;
  data.outOfOfficeReplies = Array.isArray(data.outOfOfficeReplies) ? data.outOfOfficeReplies : [];
  const existing = data.outOfOfficeReplies.find((item) =>
    item.absentUserId === absentUser.id && item.senderUserId === senderId && item.conversationId === conversation.id
  );
  const lastReplyAt = existing?.lastReplyAt ? new Date(existing.lastReplyAt) : null;
  if (lastReplyAt && Number.isFinite(lastReplyAt.getTime()) && now.getTime() - lastReplyAt.getTime() < 24 * 60 * 60 * 1000) return null;
  const message = {
    id: createId("internal-msg"),
    type: "system",
    messageType: "out_of_office",
    isAutomatic: true,
    senderId: absentUser.id,
    sender: absentUser.displayName || absentUser.name,
    text: status.message,
    createdAt: now.toISOString(),
    status: "system",
    automatic: true,
    outOfOffice: true,
    absentUserId: absentUser.id,
    notifyUserIds: [senderId],
  };
  conversation.messages.push(message);
  conversation.events.push(internalEvent("out_of_office_reply", { id: absentUser.id, name: absentUser.name }, `Resposta automática de ausência enviada para ${senderId}.`, { messageId: message.id }));
  if (existing) existing.lastReplyAt = now.toISOString();
  else data.outOfOfficeReplies.push({ absentUserId: absentUser.id, senderUserId: senderId, conversationId: conversation.id, lastReplyAt: now.toISOString() });
  data.auditLogs.unshift({
    id: createId("audit"), at: now.toISOString(), action: "Resposta automática de ausência enviada",
    detail: `Usuário ausente: ${absentUser.id}; conversa: ${conversation.id}; remetente: ${senderId}; mensagem: ${message.id}`,
    actor: "Backend", actorId: null, ip: "",
  });
  return message;
}

function visibleDirectoryUsers(data, actor) {
  return data.users
    .filter((user) => user.accessStatus === "Ativo")
    .filter((user) => isAdmin(actor) || user.department === actor.department)
    .map(publicDirectoryUser);
}

function departmentKey(data, departmentName) {
  const name = String(departmentName || "").trim();
  const department = (data.departments || []).find((item) => item.id === name || item.name === name);
  return department?.id || name;
}

function normalizeContactVisibility(data, contact, actor, input = {}) {
  const ownerDepartmentId = input.ownerDepartmentId
    ? departmentKey(data, input.ownerDepartmentId)
    : contact.ownerDepartmentId || departmentKey(data, actor.department || actor.dept);
  contact.ownerUserId ||= input.ownerUserId || actor.id || "";
  contact.ownerDepartmentId = ownerDepartmentId;
  contact.createdBy ||= actor.id || "";
  contact.updatedBy = actor.id || contact.updatedBy || "";
  contact.sharedDepartmentIds = Array.from(new Set([
    ...(Array.isArray(contact.sharedDepartmentIds) ? contact.sharedDepartmentIds : []),
    ...(Array.isArray(input.sharedDepartmentIds) ? input.sharedDepartmentIds.map((item) => departmentKey(data, item)) : []),
    ownerDepartmentId,
  ].filter(Boolean)));
  contact.linkedAttendanceIds = Array.from(new Set(Array.isArray(contact.linkedAttendanceIds) ? contact.linkedAttendanceIds : []));
  const requestedScope = input.visibilityScope || contact.visibilityScope || "department";
  contact.visibilityScope = isAdmin(actor) && requestedScope === "global" ? "global" : requestedScope === "private" ? "private" : "department";
  return contact;
}

function linkContactToConversation(data, contactId, conversationId, departmentName) {
  const contact = (data.contacts || []).find((item) => item.id === contactId);
  if (!contact) return;
  contact.linkedAttendanceIds = Array.from(new Set([...(contact.linkedAttendanceIds || []), conversationId].filter(Boolean)));
  const key = departmentKey(data, departmentName);
  if (key) contact.sharedDepartmentIds = Array.from(new Set([...(contact.sharedDepartmentIds || []), key]));
  if (contact.visibilityScope !== "global" && contact.sharedDepartmentIds.length) contact.visibilityScope = "shared_by_attendance";
  contact.updatedAt = new Date().toISOString();
}

function findActiveUsers(data, ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const found = data.users.filter((user) => uniqueIds.includes(user.id) && user.accessStatus === "Ativo");
  if (found.length !== uniqueIds.length) throw new Error("Um ou mais participantes são inválidos ou estão inativos.");
  return found;
}

function internalEvent(type, actor, text, extra = {}) {
  return {
    id: createId("internal-event"),
    type,
    actorId: actor?.id || null,
    actor: actor?.name || "Sistema",
    text,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

function friendlyList(names = []) {
  const clean = names.filter(Boolean);
  if (clean.length <= 1) return clean[0] || "";
  if (clean.length === 2) return `${clean[0]} e ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} e ${clean.at(-1)}`;
}

function quotedGroupTitle(notification = {}, conversation = null) {
  return notification.groupTitle || conversation?.title || conversation?.name || "Grupo interno";
}

function permissionError(message) {
  const error = new Error(message);
  error.status = 403;
  return error;
}

function notFoundError(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}

function groupRole(conversation, userId) {
  ensureInternalShape(conversation);
  if (!userId || !(conversation.participantIds || []).includes(userId)) return "none";
  if (conversation.ownerId === userId) return "owner";
  if ((conversation.adminIds || []).includes(userId)) return "admin";
  return "participant";
}

function roleLabel(role) {
  return role === "owner" ? "Propriet?rio" : role === "admin" ? "Administrador" : "Participante";
}


function auditDeniedConversationAccess(request, conversationId, action) {
  updateStore((data) => {
    audit(data, request, "Acesso negado a conversa interna", `${action}: ${conversationId}`);
  }).catch(() => {});
}

const allowedMessageReactions = new Set([
  "\u{1F44D}",
  "\u2764\uFE0F",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F64F}",
  "\u{1F44F}",
  "\u2705",
]);

function internalReactionView(data, reaction) {
  const user = (data.users || []).find((item) => item.id === reaction.userId);
  return {
    id: reaction.id,
    messageId: reaction.messageId || null,
    userId: reaction.userId,
    userName: reaction.userName || user?.name || "Usuário",
    emoji: reaction.emoji,
    createdAt: reaction.createdAt || reaction.updatedAt || new Date().toISOString(),
    updatedAt: reaction.updatedAt || reaction.createdAt || new Date().toISOString(),
  };
}

function ensureInternalShape(conversation) {
  conversation.type ||= (conversation.participantIds || []).length > 2 || conversation.title ? "group" : "individual";
  conversation.description ||= "";
  conversation.imageUrl ||= "";
  conversation.adminIds = Array.isArray(conversation.adminIds) && conversation.adminIds.length
    ? conversation.adminIds
    : [conversation.ownerId].filter(Boolean);
  conversation.events = Array.isArray(conversation.events) ? conversation.events : [];
  if (conversation.type === "group"
    && (conversation.participantIds || []).length === 2
    && !conversation.description
    && !conversation.events.some((event) => event.type === "group_created")) {
    conversation.type = "individual";
  }
  conversation.readBy = conversation.readBy && typeof conversation.readBy === "object" && !Array.isArray(conversation.readBy) ? conversation.readBy : {};
  for (const id of conversation.participantIds || []) if (!Object.hasOwn(conversation.readBy, id)) conversation.readBy[id] = null;
  for (const message of conversation.messages || []) {
    message.replyToMessageId ??= null;
    message.forwardedFrom ??= null;
    message.deletedAt ??= null;
    message.editedAt ??= null;
    message.editedBy ??= null;
    message.editHistory = Array.isArray(message.editHistory) ? message.editHistory : [];
    message.status ||= message.type === "system" ? "system" : "sent";
    message.reactions = Array.isArray(message.reactions) ? message.reactions.filter((reaction) => allowedMessageReactions.has(reaction?.emoji)) : [];
  }
  return conversation;
}

function internalUnreadCount(conversation, actor) {
  ensureInternalShape(conversation);
  if (!(conversation.participantIds || []).includes(actor.id)) return 0;
  const lastRead = conversation.readBy?.[actor.id] ? new Date(conversation.readBy[actor.id]).getTime() : 0;
  return (conversation.messages || []).filter((message) => {
    const notifiedSystemMessage = message.type === "system" && Array.isArray(message.notifyUserIds) && message.notifyUserIds.includes(actor.id);
    if (message.deletedAt || message.senderId === actor.id) return false;
    if (message.type === "system" && !notifiedSystemMessage) return false;
    const createdAt = new Date(message.createdAt || 0).getTime();
    return Number.isFinite(createdAt) && createdAt > lastRead;
  }).length;
}

function canAccessNotification(actor, notification, data = null) {
  const internalConversationId = notification.internalConversationId || notification.internalId;
  const linkedConversation = internalConversationId
    ? (data?.internalConversations || []).find((conversation) => conversation.id === internalConversationId)
    : null;
  if (linkedConversation) return canAccessInternalConversation(actor, linkedConversation);
  if (notification.userId && notification.userId === actor.id) return true;
  if (Array.isArray(notification.userIds) && notification.userIds.includes(actor.id)) return true;
  return notification.department && notification.department === actor.department;
}

function notificationConversation(data, notification) {
  const id = notification.internalConversationId || notification.internalId || notification.groupId || notification.conversationId;
  return id ? (data?.internalConversations || []).find((conversation) => conversation.id === id) : null;
}

function notificationTextForActor(notification, actor, data = null) {
  const conversation = notificationConversation(data, notification);
  const groupTitle = quotedGroupTitle(notification, conversation);
  const actorName = notification.actorName || notification.actor || "Alguém";
  const targetIds = notification.targetUserIds || [notification.targetUserId || notification.userId].filter(Boolean);
  const targetNames = notification.targetUserNames || [notification.targetUserName].filter(Boolean);
  const targetIsActor = targetIds.includes(actor?.id);
  const actorIsAuthor = notification.actorId && notification.actorId === actor?.id;
  if (notification.type === "group_participant_added") {
    const names = targetNames.length ? targetNames : targetIds.map((id) => conversation?.participantSnapshots?.[id]?.name).filter(Boolean);
    if (targetIsActor && targetIds.length === 1) return `${actorName} adicionou você ao grupo “${groupTitle}”.`;
    const list = friendlyList(names);
    if (!list) return "";
    if (actorIsAuthor) return `Você adicionou ${list} ao grupo “${groupTitle}”.`;
    return `${actorName} adicionou ${list} ao grupo “${groupTitle}”.`;
  }
  return notification.message || notification.text || notification.detail || notification.title || "";
}

function ensureNotificationShape(notification) {
  notification.readBy = notification.readBy && typeof notification.readBy === "object" && !Array.isArray(notification.readBy) ? notification.readBy : {};
  notification.resolvedBy = notification.resolvedBy && typeof notification.resolvedBy === "object" && !Array.isArray(notification.resolvedBy) ? notification.resolvedBy : {};
  notification.createdAt ||= notification.at || new Date().toISOString();
  notification.eventType ||= notification.type || notification.event || "notification";
  return notification;
}

function markNotificationRead(notification, userId, now) {
  ensureNotificationShape(notification);
  if (!notification.readBy[userId]) notification.readBy[userId] = now;
  if (!notification.resolvedBy[userId]) notification.resolvedBy[userId] = now;
  return notification;
}

function linkedNotificationConversationId(notification) {
  return notification.internalConversationId || notification.internalId || notification.groupId || notification.conversationId || "";
}

function markRelatedConversationNotificationsRead(data, actor, conversation, now, messageId = "") {
  if (!actor?.id || !conversation?.id) return 0;
  let changed = 0;
  for (const notification of data.notifications || []) {
    const linkedId = linkedNotificationConversationId(notification);
    if (linkedId !== conversation.id) continue;
    if (messageId && notification.messageId && notification.messageId !== messageId) continue;
    if (!canAccessNotification(actor, notification, data)) continue;
    ensureNotificationShape(notification);
    const wasUnread = !notification.readBy[actor.id];
    markNotificationRead(notification, actor.id, now);
    if (wasUnread) changed += 1;
  }
  return changed;
}

function hasEquivalentNotification(data, draft) {
  const users = [draft.userId, ...(draft.userIds || [])].filter(Boolean).sort().join("|");
  const key = [users, draft.messageId || "", draft.type || draft.eventType || "", linkedNotificationConversationId(draft), draft.targetUserId || ""].join("::");
  return (data.notifications || []).some((item) => {
    ensureNotificationShape(item);
    const itemUsers = [item.userId, ...(item.userIds || [])].filter(Boolean).sort().join("|");
    const itemKey = [itemUsers, item.messageId || "", item.type || item.eventType || "", linkedNotificationConversationId(item), item.targetUserId || ""].join("::");
    return itemKey === key;
  });
}

function addNotificationOnce(data, draft) {
  data.notifications ||= [];
  if (hasEquivalentNotification(data, draft)) return false;
  data.notifications.unshift({ id: createId("notification"), ...draft });
  return true;
}

function notificationView(notification, actor, data = null) {
  ensureNotificationShape(notification);
  const message = notificationTextForActor(notification, actor, data).trim();
  const title = (notification.title || (notification.type === "group_participant_added" ? "Grupo atualizado" : "Notificação")).trim();
  if (!message && !title) return null;
  return {
    ...notification,
    title,
    message: message || title,
    read: Boolean(notification.readBy?.[actor.id]),
    isRead: Boolean(notification.readBy?.[actor.id]),
    readAt: notification.readBy?.[actor.id] || null,
    resolvedAt: notification.resolvedBy?.[actor.id] || notification.readBy?.[actor.id] || null,
  };
}

function buildUnreadCounts(data, actor) {
  const messagesUnread = (data.internalConversations || [])
    .filter((conversation) => canAccessInternalConversation(actor, conversation))
    .reduce((sum, conversation) => sum + internalUnreadCount(conversation, actor), 0);
  const notificationsUnread = (data.notifications || [])
    .filter((notification) => canAccessNotification(actor, notification, data))
    .reduce((sum, notification) => {
      const view = notificationView(notification, actor, data);
      if (!view?.message) return sum;
      return sum + (notification.readBy?.[actor.id] ? 0 : 1);
    }, 0);
  return { notificationsUnread, messagesUnread };
}

function canManageInternalConversation(actor, conversation) {
  return ["owner", "admin"].includes(groupRole(conversation, actor.id));
}

function canRemoveGroupParticipant(actor, conversation, participantId) {
  const actorRole = groupRole(conversation, actor.id);
  const targetRole = groupRole(conversation, participantId);
  if (actorRole === "owner") return participantId !== actor.id;
  if (actorRole === "admin") return targetRole === "participant" && participantId !== actor.id;
  return false;
}

function canPromoteGroupParticipant(actor, conversation, participantId) {
  return ["owner", "admin"].includes(groupRole(conversation, actor.id)) && groupRole(conversation, participantId) === "participant";
}

function canDemoteGroupAdmin(actor, conversation, participantId) {
  return groupRole(conversation, actor.id) === "owner" && groupRole(conversation, participantId) === "admin";
}

function internalReplyPreview(conversation, messageId) {
  if (!messageId) return null;
  const original = (conversation.messages || []).find((message) => message.id === messageId);
  if (!original || original.deletedAt) return { id: messageId, unavailable: true, sender: "Mensagem indisponivel", text: "Mensagem indisponivel" };
  const albumItems = original.albumId
    ? (conversation.messages || []).filter((message) => message.albumId === original.albumId && !message.deletedAt)
    : [];
  const albumImages = albumItems.filter((message) => fileCategoryFromStored(message.file) === "image").length;
  return {
    id: original.id,
    senderId: original.senderId || null,
    sender: original.sender || "Sistema",
    type: original.albumId ? "album" : original.type || "message",
    text: original.albumId
      ? `Album com ${albumItems.length || 1} ${albumImages === (albumItems.length || 1) ? "imagens" : "arquivos"}`
      : original.type === "audio" ? "Mensagem de audio" : String(original.text || "").slice(0, 180),
    createdAt: original.createdAt || "",
  };
}

function internalConversationView(data, conversation, actor = null) {
  ensureInternalShape(conversation);
  const participants = (conversation.participantIds || []).map((id) => {
    const user = data.users.find((item) => item.id === id);
    return user ? publicDirectoryUser(user) : conversation.participantSnapshots?.[id];
  }).filter(Boolean);
  const participantsById = new Map(participants.map((user) => [user.id, user]));
  const readBy = conversation.readBy || {};
  const messages = (conversation.messages || []).map((message) => {
    const createdAt = new Date(message.createdAt || 0).getTime();
    const readers = Object.entries(readBy)
      .filter(([userId, readAt]) =>
        userId !== message.senderId
        && readAt
        && Number.isFinite(createdAt)
        && new Date(readAt).getTime() >= createdAt
      )
      .map(([userId, readAt]) => {
        const user = participantsById.get(userId);
        return { userId, name: user?.name || user?.displayName || userId, readAt };
      });
    const pendingReadBy = participants
      .filter((user) => user.id !== message.senderId && !readers.some((reader) => reader.userId === user.id))
      .map((user) => ({ userId: user.id, name: user.name || user.displayName || user.username }));
    const status = message.type === "system" ? "system"
      : message.senderId === actor?.id && readers.length ? "read"
      : message.status || "sent";
    return {
      ...message,
      status,
      readDetails: { readers, pending: pendingReadBy },
      replyTo: internalReplyPreview(conversation, message.replyToMessageId),
      reactions: (message.reactions || []).map((reaction) => internalReactionView(data, reaction)),
    };
  });
  const memberRoles = Object.fromEntries(participants.map((user) => [user.id, groupRole(conversation, user.id)]));
  return {
    ...conversation,
    messages,
    participants: participants.map((user) => user.name),
    participantUsers: participants.map((user) => ({ ...user, groupRole: memberRoles[user.id], groupRoleLabel: roleLabel(memberRoles[user.id]) })),
    memberRoles,
    currentUserGroupRole: actor ? groupRole(conversation, actor.id) : null,
    participantCount: participants.length,
    unreadCount: actor ? internalUnreadCount(conversation, actor) : 0,
    readAt: actor ? conversation.readBy?.[actor.id] || null : null,
  };
}

function meetingView(data, meeting) {
  const participants = (meeting.participantIds || []).map((id) => {
    const user = data.users.find((item) => item.id === id);
    return user ? publicDirectoryUser(user) : meeting.participantSnapshots?.[id];
  }).filter(Boolean);
  return {
    ...meeting,
    participants: participants.map((user) => user.name),
    participantUsers: participants,
  };
}

function isClosedMeeting(meeting) {
  const status = String(meeting.status || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return status === "encerrada" || status === "closed" || Boolean(meeting.endedAt || meeting.closedAt);
}

function meetingSortDate(meeting) {
  return new Date(meeting.endedAt || meeting.updatedAt || `${meeting.date || "1970-01-01"}T${meeting.time || "00:00"}`).getTime() || 0;
}

function pageNumber(value, fallback, max = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function statusGroup(status) {
  if (status === "closed" || status === "resolved") return "solved";
  if (status === "active") return "active";
  if (status === "waiting") return "waiting";
  return "pending";
}

function buildMetrics(data, actor) {
  {
    const internal = (data.internalConversations || []).filter((item) => canAccessInternalConversation(actor, item));
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const messages = internal.flatMap((conversation) => (conversation.messages || [])
      .filter((message) => message.type !== "system")
      .map((message) => ({ ...message, conversation })));
    const periodMessages = messages.filter((message) => new Date(message.createdAt || 0) >= weekStart);
    const byHour = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      return {
        time: date.toLocaleDateString("pt-BR", { weekday: "short" }),
        value: periodMessages.filter((message) => String(message.createdAt || "").startsWith(key)).length,
      };
    });
    const people = {};
    for (const conversation of internal) {
      for (const id of conversation.participantIds || []) {
        if (id === actor.id) continue;
        const user = data.users.find((item) => item.id === id) || conversation.participantSnapshots?.[id];
        if (user?.name) people[user.name] = (people[user.name] || 0) + (conversation.messages || []).filter((message) => message.senderId === id || message.senderId === actor.id).length;
      }
    }
    return {
      mode: "internal-user",
      totals: {
        messages: periodMessages.length,
        today: periodMessages.filter((message) => String(message.createdAt || "").startsWith(today)).length,
        individual: internal.filter((item) => item.type !== "group").length,
        groups: internal.filter((item) => item.type === "group").length,
        waiting: internal.filter((item) => item.type !== "group").length,
        active: internal.filter((item) => item.type === "group").length,
        pending: internal.reduce((sum, item) => sum + (Number(item.unreadCount) || 0), 0),
        solved: periodMessages.filter((message) => message.senderId === actor.id).length,
        all: internal.length,
        contacts: new Set(internal.flatMap((item) => item.participantIds || []).filter((id) => id !== actor.id)).size,
        activeUsers: (data.users || []).filter((user) => (user.accessStatus || "Ativo") === "Ativo").length,
        received: periodMessages.filter((message) => message.senderId !== actor.id).length,
        sent: periodMessages.filter((message) => message.senderId === actor.id).length,
        files: periodMessages.filter((message) => message.audio || message.attachment).length,
      },
      byDepartment: [
        { name: "Conversas individuais", value: internal.filter((item) => item.type !== "group").length },
        { name: "Grupos", value: internal.filter((item) => item.type === "group").length },
      ],
      byHour,
      byOwner: Object.entries(people).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })),
      averageResponseSeconds: 0,
      recent: internal.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 8).map((item) => ({
        id: item.id,
        name: item.type === "group" ? item.title : (item.participantIds || []).map((id) => data.users.find((user) => user.id === id)?.name).find((name) => name && name !== actor.name) || item.title || "Conversa interna",
        phone: `${(item.participantIds || []).length} participante(s)`,
        department: item.type === "group" ? "Grupo interno" : "Conversa individual",
        owner: item.owner,
        status: item.status,
        updatedAt: item.updatedAt,
        tone: item.type === "group" ? "blue" : "green",
      })),
    };
  }
  const conversations = data.conversations.filter((item) => canAccessConversation(actor, item));
  const contacts = data.contacts.filter((item) => canAccessContact(actor, item, data));
  const today = new Date().toISOString().slice(0, 10);
  const todayConversations = conversations.filter((item) => String(item.createdAt || "").startsWith(today));
  const byStatus = { waiting: 0, active: 0, pending: 0, solved: 0 };
  const byDepartment = {};
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ time: `${String(hour).padStart(2, "0")}:00`, value: 0 }));
  const byOwner = {};
  for (const conversation of conversations) {
    byStatus[statusGroup(conversation.status)] += 1;
    byDepartment[conversation.department] = (byDepartment[conversation.department] || 0) + 1;
    if (conversation.owner && conversation.owner !== "Não atribuído") byOwner[conversation.owner] = (byOwner[conversation.owner] || 0) + 1;
  }
  for (const conversation of todayConversations) {
    const hour = new Date(conversation.createdAt).getHours();
    if (Number.isInteger(hour)) byHour[hour].value += 1;
  }
  const responseDurations = conversations.flatMap((conversation) => {
    const incoming = (conversation.messages || []).find((message) => message.direction === "in");
    const outgoing = (conversation.messages || []).find((message) => message.direction === "out" && new Date(message.createdAt) >= new Date(incoming?.createdAt || 0));
    return incoming && outgoing ? [new Date(outgoing.createdAt) - new Date(incoming.createdAt)] : [];
  }).filter((value) => value >= 0);
  const averageResponseSeconds = responseDurations.length
    ? Math.round(responseDurations.reduce((sum, value) => sum + value, 0) / responseDurations.length / 1000)
    : 0;
  return {
    totals: {
      today: todayConversations.length,
      waiting: byStatus.waiting,
      active: byStatus.active,
      pending: byStatus.pending,
      solved: byStatus.solved,
      all: conversations.length,
      contacts: contacts.length,
    },
    byDepartment: Object.entries(byDepartment).map(([name, value]) => ({ name, value })),
    byHour,
    byOwner: Object.entries(byOwner).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    averageResponseSeconds,
    recent: [...conversations].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 10),
  };
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/health" && request.method === "GET") {
    const config = await getSecureConfig();
    return json(response, 200, {
      status: "ok", service: "kalion-whatsapp-cloud", releaseVersion,
      startedAt: processStartTime, graphVersion: config.graphVersion,
      configured: publicConfig(config).configured,
    });
  }
  if (!requireInternalKey(request, response)) return;
  if (!validateMutationOrigin(request)) return json(response, 403, { error: "Origem da requisição inválida." });

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    const rememberLogin = Boolean(input.rememberMe ?? input.remember);
    const result = await login(input.identifier, input.password, request, rememberLogin);
    if (result?.error) return json(response, result.status || 401, { error: result.error });
    setSessionCookie(response, result.token, request);
    if (result.rememberToken) setRememberCookie(response, result.rememberToken, request, result.rememberMaxAge);
    return json(response, 200, { user: result.user });
  }

  const validateAdOnOpen = url.pathname === "/api/auth/me" && request.method === "GET";
  request.auth = await authenticate(request, { validateAd: validateAdOnOpen });
  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    if (!request.auth) {
      if (request.authError?.clearSession) clearSessionCookie(response, request);
      if (request.authError?.clearRemember) clearRememberCookie(response, request);
      if (request.authError) return json(response, request.authError.status || 401, {
        error: request.authError.error || "Sessão inválida ou expirada.",
        code: request.authError.code || undefined,
        title: request.authError.title || undefined,
      });
      const restored = await restoreRememberedSession(request);
      if (restored?.user) {
        setSessionCookie(response, restored.token, request);
        if (restored.rememberToken) setRememberCookie(response, restored.rememberToken, request, restored.rememberMaxAge);
        return json(response, 200, { user: restored.user, restored: true });
      }
      if (restored?.clearRemember) clearRememberCookie(response, request);
      return json(response, restored?.status || 401, {
        error: restored?.error || "Sessão inválida ou expirada.",
        code: restored?.code || undefined,
        title: restored?.title || undefined,
      });
    }
    return json(response, 200, { user: request.auth });
  }
  if (!request.auth) {
    if (request.authError?.clearSession) clearSessionCookie(response, request);
    if (request.authError?.clearRemember) clearRememberCookie(response, request);
    return json(response, request.authError?.status || 401, {
      error: request.authError?.error || "Autenticação obrigatória.",
      code: request.authError?.code || undefined,
      title: request.authError?.title || undefined,
    });
  }

  if (url.pathname === "/api/me/out-of-office" && request.method === "GET") {
    let userView;
    await updateStore((data) => {
      const user = data.users.find((item) => item.id === request.auth.id);
      if (!user) throw new Error("Usuário não encontrado.");
      deactivateExpiredOutOfOffice(data, user);
      userView = outOfOfficeStatus(user.outOfOffice);
    });
    return json(response, 200, { ok: true, outOfOffice: userView });
  }

  if (url.pathname === "/api/me/out-of-office" && request.method === "PUT") {
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    try {
      await updateStore((data) => {
        const user = data.users.find((item) => item.id === request.auth.id);
        if (!user) throw new Error("Usuário não encontrado.");
        user.outOfOffice = normalizeOutOfOfficeInput(input, request.auth);
        data.outOfOfficeReplies = (data.outOfOfficeReplies || []).filter((item) => item.absentUserId !== user.id);
        audit(data, request, user.outOfOffice.enabled ? "Fora da empresa configurado" : "Fora da empresa desativado", user.name);
      });
      const persisted = await readStore();
      const persistedUser = persisted.users.find((item) => item.id === request.auth.id);
      if (!persistedUser) throw new Error("Usuário não encontrado após salvar.");
      const persistedView = outOfOfficeStatus(persistedUser.outOfOffice);
      return json(response, 200, { ok: true, outOfOffice: persistedView });
    } catch (error) {
      return json(response, requestErrorStatus(error), { error: error.message });
    }
  }

  if (url.pathname === "/api/me/out-of-office" && request.method === "DELETE") {
    await updateStore((data) => {
      const user = data.users.find((item) => item.id === request.auth.id);
      if (!user) throw new Error("Usuário não encontrado.");
      user.outOfOffice = { ...(user.outOfOffice || {}), enabled: false, updatedAt: new Date().toISOString(), updatedBy: request.auth.id, disabledAt: new Date().toISOString() };
      data.outOfOfficeReplies = (data.outOfOfficeReplies || []).filter((item) => item.absentUserId !== user.id);
      audit(data, request, "Fora da empresa desativado manualmente", user.name);
    });
    const persisted = await readStore();
    const persistedUser = persisted.users.find((item) => item.id === request.auth.id);
    const persistedView = outOfOfficeStatus(persistedUser?.outOfOffice);
    return json(response, 200, { ok: true, outOfOffice: persistedView });
  }

  if (url.pathname === "/api/profile" && request.method === "PUT") {
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    let updated;
    await updateStore((data) => {
      const user = data.users.find((item) => item.id === request.auth.id);
      if (!user) throw new Error("Usuário não encontrado.");
      const displayName = String(input.displayName ?? input.name ?? user.displayName ?? user.name).trim().slice(0, 120);
      const status = String(input.status ?? user.status ?? "Online").trim().slice(0, 40);
      Object.assign(user, {
        name: displayName || user.name,
        displayName: displayName || user.displayName || user.name,
        phone: String(input.phone ?? user.phone ?? "").trim().slice(0, 40),
        extension: String(input.extension ?? input.ramal ?? user.extension ?? user.ramal ?? "").trim().slice(0, 20),
        jobTitle: String(input.jobTitle ?? user.jobTitle ?? "").trim().slice(0, 80),
        signature: String(input.signature ?? user.signature ?? "").trim().slice(0, 240),
        status,
        preferences: {
          ...(user.preferences || {}),
          ...(input.preferences && typeof input.preferences === "object" && !Array.isArray(input.preferences) ? input.preferences : {}),
        },
        updatedAt: new Date().toISOString(),
      });
      audit(data, request, "Perfil atualizado", user.name);
      updated = user;
    });
    const data = await readStore();
    return json(response, 200, {
      user: {
        ...request.auth,
        name: updated.displayName || updated.name,
        displayName: updated.displayName || updated.name,
        phone: updated.phone || "",
        extension: updated.extension || "",
        jobTitle: updated.jobTitle || "",
        signature: updated.signature || "",
        status: updated.status || "Online",
        preferences: updated.preferences || {},
      },
    });
  }

  const uploadReadMatch = url.pathname.match(/^\/api\/uploads\/(company|users|contacts)\/([^/]+)$/);
  if (uploadReadMatch && request.method === "GET") {
    try {
      const image = await readUploadedImage(uploadReadMatch[1], uploadReadMatch[2]);
      response.writeHead(200, {
        "Content-Type": image.mime,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      });
      return response.end(image.buffer);
    } catch {
      return json(response, 404, { error: "Imagem não encontrada." });
    }
  }

  const audioReadMatch = url.pathname.match(/^\/api\/uploads\/audio\/([^/]+)$/);
  if (audioReadMatch && request.method === "GET") {
    try {
      const data = await readStore();
      const hasAccess = (data.internalConversations || []).some((conversation) =>
        canAccessInternalConversation(request.auth, conversation)
        && (conversation.messages || []).some((message) => message.type === "audio" && message.audio?.url === `/api/uploads/audio/${audioReadMatch[1]}`)
      );
      if (!hasAccess) return json(response, 403, { error: "Sem permissão para este áudio." });
      const audio = await readUploadedAudio(audioReadMatch[1]);
      response.writeHead(200, {
        "Content-Type": audio.mime,
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
      });
      return response.end(audio.buffer);
    } catch (error) {
      return json(response, requestErrorStatus(error), { error: error.message || "Áudio não encontrado." });
    }
  }

  const attachmentReadMatch = url.pathname.match(/^\/api\/internal\/attachments\/([^/]+)\/download$/);
  if (attachmentReadMatch && request.method === "GET") {
    try {
      const data = await readStore();
      let found = null;
      for (const conversation of data.internalConversations || []) {
        if (!canAccessInternalConversation(request.auth, conversation)) continue;
        const message = (conversation.messages || []).find((item) => item.type === "file" && item.file?.id === attachmentReadMatch[1]);
        if (message) {
          found = { conversation, message };
          break;
        }
      }
      if (!found) return json(response, 403, { error: "Sem permissao para este anexo." });
      const file = found.message.file;
      const buffer = await readUploadedAttachment(file.storedName);
      const safeName = String(file.originalName || file.name || "arquivo").replace(/[\r\n"]/g, "_");
      response.writeHead(200, {
        "Content-Type": file.mime || "application/octet-stream",
        "Content-Length": buffer.length,
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      });
      return response.end(buffer);
    } catch (error) {
      return json(response, requestErrorStatus(error), { error: error.message || "Anexo nao encontrado." });
    }
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    await logout(request);
    clearSessionCookie(response, request);
    clearRememberCookie(response, request);
    return json(response, 200, { success: true });
  }
  if (url.pathname === "/api/auth/logout-all-devices" && request.method === "POST") {
    const result = await logoutAllDevices(request.auth.id, request);
    clearSessionCookie(response, request);
    clearRememberCookie(response, request);
    return json(response, 200, { success: true, ...result });
  }
  if (url.pathname === "/api/auth/change-password" && request.method === "POST") {
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    if (String(input.newPassword || "").length < 8) return json(response, 400, { error: "A nova senha deve ter ao menos 8 caracteres." });
    const changed = await changePassword(request.auth.id, input.currentPassword, input.newPassword);
    if (!changed) return json(response, 400, { error: "Senha atual inválida." });
    clearSessionCookie(response, request);
    return json(response, 200, { success: true, reloginRequired: true });
  }

  const userPhotoMatch = url.pathname.match(/^\/api\/uploads\/users\/([^/]+)\/photo$/);
  if (userPhotoMatch && ["POST", "DELETE"].includes(request.method)) {
    const data = await readStore();
    const target = data.users.find((item) => item.id === userPhotoMatch[1]);
    if (!target) return json(response, 404, { error: "Usuário não encontrado." });
    if (!isAdmin(request.auth) && request.auth.id !== target.id) return json(response, 403, { error: "Sem permissão para alterar a foto deste colaborador." });
    try {
      let updated;
      if (request.method === "DELETE") {
        await updateStore(async (store) => {
          const user = store.users.find((item) => item.id === target.id);
          await removeUploadedImage(user.photoUrl);
          user.photoUrl = "";
          user.updatedAt = new Date().toISOString();
          audit(store, request, "Foto de colaborador removida", user.name);
          updated = user;
        });
      } else {
        const uploaded = await saveUploadedImage("users", await readBody(request, 4 * 1024 * 1024), request.headers["content-type"]);
        await updateStore(async (store) => {
          const user = store.users.find((item) => item.id === target.id);
          await removeUploadedImage(user.photoUrl);
          user.photoUrl = uploaded.url;
          user.updatedAt = new Date().toISOString();
          audit(store, request, "Foto de colaborador atualizada", user.name);
          updated = user;
        });
      }
      const fresh = await readStore();
      return json(response, 200, fresh.users.find((item) => item.id === updated.id));
    } catch (error) {
      return json(response, requestErrorStatus(error), { error: error.message });
    }
  }

  if (url.pathname === "/api/uploads/company/logo" && ["POST", "DELETE"].includes(request.method)) {
    if (!requireRole(request, response, ["Administrador"])) return;
    try {
      if (request.method === "DELETE") {
        await updateStore(async (data) => {
          data.settings ||= {};
          await removeUploadedImage(data.settings.companyLogoUrl);
          data.settings.companyLogoUrl = "";
          data.settings.updatedAt = new Date().toISOString();
          audit(data, request, "Logo da empresa removido", data.settings.companyName || "Empresa");
        });
      } else {
        const uploaded = await saveUploadedImage("company", await readBody(request, 4 * 1024 * 1024), request.headers["content-type"]);
        await updateStore(async (data) => {
          data.settings ||= {};
          await removeUploadedImage(data.settings.companyLogoUrl);
          data.settings.companyLogoUrl = uploaded.url;
          data.settings.updatedAt = new Date().toISOString();
          audit(data, request, "Logo da empresa atualizado", data.settings.companyName || "Empresa");
        });
      }
      const data = await readStore();
      return json(response, 200, data.settings || {});
    } catch (error) {
      return json(response, requestErrorStatus(error), { error: error.message });
    }
  }

  const contactPhotoMatch = url.pathname.match(/^\/api\/uploads\/contacts\/([^/]+)\/photo$/);
  if (contactPhotoMatch && ["POST", "DELETE"].includes(request.method)) {
    const currentData = await readStore();
    const contact = currentData.contacts.find((item) => item.id === contactPhotoMatch[1]);
    if (!contact) return json(response, 404, { error: "Contato não encontrado." });
    if (!canManageContact(request.auth, contact, currentData)) return json(response, 403, { error: "Sem permissão para alterar este contato." });
    try {
      let updated;
      if (request.method === "DELETE") {
        await updateStore(async (data) => {
          const target = data.contacts.find((item) => item.id === contact.id);
          await removeUploadedImage(target.photoUrl);
          target.photoUrl = "";
          target.photoSource = "Imagem padrão";
          target.updatedAt = new Date().toISOString();
          audit(data, request, "Foto de contato removida", target.name);
          updated = target;
        });
      } else {
        const uploaded = await saveUploadedImage("contacts", await readBody(request, 4 * 1024 * 1024), request.headers["content-type"]);
        await updateStore(async (data) => {
          const target = data.contacts.find((item) => item.id === contact.id);
          await removeUploadedImage(target.photoUrl);
          target.photoUrl = uploaded.url;
          target.photoSource = "Imagem manual enviada no Kalion";
          target.updatedAt = new Date().toISOString();
          audit(data, request, "Foto de contato atualizada", target.name);
          updated = target;
        });
      }
      return json(response, 200, updated);
    } catch (error) {
      return json(response, requestErrorStatus(error), { error: error.message });
    }
  }


  if (url.pathname === "/api/users" && request.method === "GET") {
    const rows = await listUsers(request.auth);
    return json(response, 200, rows.map(attachPresence));
  }
  if (url.pathname === "/api/presence" && request.method === "GET") {
    return json(response, 200, await listPresenceForActor(request.auth));
  }
  if (url.pathname === "/api/presence/debug" && request.method === "GET") {
    return json(response, 200, presenceDiagnosticsForActor(request.auth));
  }
  if (url.pathname === "/api/admin/persistent-sessions" && request.method === "GET") {
    if (!requireRole(request, response, ["Administrador"])) return;
    return json(response, 200, await listPersistentSessions(request.auth));
  }
  if (url.pathname === "/api/admin/persistent-sessions/revoke-all" && request.method === "POST") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    return json(response, 200, await revokeAllPersistentSessions(request.auth, request, input.reason || "Revogação administrativa global"));
  }
  const persistentSessionUserMatch = url.pathname.match(/^\/api\/admin\/persistent-sessions\/user\/([^/]+)\/revoke$/);
  if (persistentSessionUserMatch && request.method === "POST") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    return json(response, 200, await revokePersistentSessionsByUser(persistentSessionUserMatch[1], request.auth, request, input.reason || "Revogação administrativa por usuário"));
  }
  const persistentSessionMatch = url.pathname.match(/^\/api\/admin\/persistent-sessions\/([^/]+)\/revoke$/);
  if (persistentSessionMatch && request.method === "POST") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    return json(response, 200, await revokePersistentSession(persistentSessionMatch[1], request.auth, request, input.reason || "Revogação administrativa"));
  }
  if (url.pathname === "/api/users" && request.method === "POST") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    if (!input.name || !input.email || !input.username || String(input.password || "").length < 8) return json(response, 400, { error: "Nome, e-mail, login e senha válida são obrigatórios." });
    try {
      const created = await createUser(input, request.auth);
      await updateStore((data) => audit(data, request, "Usuário criado", `${created.name} (${created.role})`));
      return json(response, 201, created);
    } catch (error) {
      return json(response, 400, { error: error.message });
    }
  }
  const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && request.method === "PUT") {
    if (!requireRole(request, response, ["Administrador", "Gestor"])) return;
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    try {
      const updated = await updateUser(userMatch[1], input, request.auth);
      await updateStore((data) => audit(data, request, "Usuário atualizado", `${updated.name} (${updated.role})`));
      return json(response, 200, updated);
    } catch (error) {
      return json(response, 400, { error: error.message });
    }
  }
  if (userMatch && request.method === "DELETE") {
    if (!requireRole(request, response, ["Administrador"])) return;
    try {
      await deleteUser(userMatch[1], request.auth);
      await updateStore((data) => audit(data, request, "Usuário excluído", userMatch[1]));
      return json(response, 200, { success: true });
    } catch (error) {
      return json(response, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/collaborators" && request.method === "GET") {
    const data = await readStore();
    return json(response, 200, data.users
      .filter((user) => user.accessStatus === "Ativo")
      .map(publicDirectoryUser));
  }

  if (url.pathname === "/api/migrations/browser-storage" && request.method === "POST") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const input = JSON.parse((await readBody(request, 2 * 1024 * 1024)).toString("utf8") || "{}");
    const legacyConversations = Array.isArray(input.internalConversations) ? input.internalConversations.slice(0, 500) : [];
    const legacyMeetings = Array.isArray(input.meetings) ? input.meetings.slice(0, 500) : [];
    const legacyReplies = Array.isArray(input.quickReplies) ? input.quickReplies.slice(0, 1000) : [];
    const imported = { internalConversations: 0, meetings: 0, quickReplies: 0 };
    await updateStore((data) => {
      const actorSnapshot = publicDirectoryUser(request.auth);
      const legacyParticipants = (names, department) => {
        const participantIds = [request.auth.id];
        const participantSnapshots = { [request.auth.id]: actorSnapshot };
        for (const name of [...new Set(names.filter(Boolean))].filter((item) => item !== request.auth.name)) {
          const matched = data.users.find((user) => user.name === name && user.accessStatus === "Ativo");
          const id = matched?.id || createId("legacy-user");
          if (!participantIds.includes(id)) participantIds.push(id);
          participantSnapshots[id] = matched ? publicDirectoryUser(matched) : {
            id, name, role: "Participante legado", department, dept: department,
            initials: String(name).split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
            status: "Histórico",
          };
        }
        return { participantIds, participantSnapshots };
      };
      for (const [index, legacy] of legacyConversations.entries()) {
        const legacySourceId = `browser-internal:${legacy.id || index}`;
        if (data.internalConversations.some((item) => item.legacySourceId === legacySourceId)) continue;
        const now = new Date().toISOString();
        const department = legacy.department || legacy.dept || request.auth.department;
        const participants = legacyParticipants([request.auth.name, ...(legacy.participants || [])], department);
        data.internalConversations.push({
          id: createId("internal"), legacySourceId,
          title: legacy.name || `Conversa importada ${index + 1}`, department,
          ownerId: request.auth.id, owner: legacy.owner || request.auth.name,
          ...participants, status: legacy.ended ? "closed" : "active",
          createdAt: now, updatedAt: now, closedAt: legacy.ended ? now : null,
          messages: (legacy.messages || []).slice(0, 5000).map((message) => ({
            id: createId("internal-msg"), type: message.type === "system" ? "system" : "message",
            senderId: message.type === "system" ? null : (message.sender === request.auth.name ? request.auth.id : null),
            sender: message.type === "system" ? "Sistema Kalion" : message.sender || "Participante legado",
            role: message.role || "", text: String(message.text || ""), createdAt: now, legacyTime: message.time || "",
          })),
        });
        imported.internalConversations += 1;
      }
      for (const [index, legacy] of legacyMeetings.entries()) {
        const legacySourceId = `browser-meeting:${legacy.id || index}`;
        if (data.meetings.some((item) => item.legacySourceId === legacySourceId)) continue;
        const now = new Date().toISOString();
        const department = legacy.department || request.auth.department;
        const participants = legacyParticipants([request.auth.name, ...(legacy.participants || [])], department);
        data.meetings.push({
          id: createId("meeting"), legacySourceId,
          title: legacy.title || `Reunião importada ${index + 1}`, department,
          date: legacy.date || now.slice(0, 10), time: legacy.time || "00:00",
          ownerId: request.auth.id, owner: legacy.owner || request.auth.name,
          ...participants, status: legacy.status || "Encerrada", duration: legacy.duration || "",
          chat: (legacy.chat || []).slice(0, 5000).map((message) => ({
            id: createId("meeting-msg"), senderId: message.sender === request.auth.name ? request.auth.id : null,
            sender: message.sender || "Participante legado", text: String(message.text || ""),
            createdAt: now, legacyTime: message.time || "",
          })),
          attendance: [], createdAt: now, updatedAt: now,
          startedAt: legacy.startedAt || null, endedAt: legacy.endedAt || null,
        });
        imported.meetings += 1;
      }
      for (const row of legacyReplies) {
        const shortcut = String(Array.isArray(row) ? row[0] : row.shortcut || "").trim();
        if (!/^\/[a-z0-9_-]{2,40}$/i.test(shortcut) || data.quickReplies.some((item) => item.shortcut.toLowerCase() === shortcut.toLowerCase())) continue;
        const description = String(Array.isArray(row) ? row[1] : row.description || "").trim();
        const department = String(Array.isArray(row) ? row[2] : row.department || request.auth.department);
        const status = String(Array.isArray(row) ? row[4] : row.status || "Ativo") === "Inativo" ? "Inativo" : "Ativo";
        const now = new Date().toISOString();
        data.quickReplies.push({
          id: createId("quick"), legacySourceId: `browser-quick:${shortcut}`,
          shortcut, description: description || "Resposta importada do navegador",
          content: String(Array.isArray(row) ? description : row.content || description),
          scope: department === "Todos" ? "global" : "department", department,
          ownerId: null, owner: null, status,
          usageCount: Number.parseInt(String(Array.isArray(row) ? row[3] : row.usageCount || 0), 10) || 0,
          createdById: request.auth.id, createdBy: request.auth.name, createdAt: now, updatedAt: now,
        });
        imported.quickReplies += 1;
      }
      if (Object.values(imported).some(Boolean)) audit(data, request, "Dados locais migrados", JSON.stringify(imported));
    });
    return json(response, 200, { success: true, imported });
  }

  if (url.pathname === "/api/permissions" && request.method === "GET") {
    if (!requireRole(request, response, ["Administrador"])) return;
    return json(response, 200, await listPermissions());
  }
  if (url.pathname === "/api/permissions" && request.method === "PUT") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    const saved = await savePermissions(input);
    await updateStore((data) => audit(data, request, "Permissões atualizadas", "Matriz de perfis persistida no backend"));
    return json(response, 200, saved);
  }

  if (url.pathname === "/api/departments" && request.method === "GET") {
    const data = await readStore();
    const visible = isAdmin(request.auth) ? data.departments : data.departments.filter((item) => item.name === request.auth.department);
    return json(response, 200, visible);
  }
  if (url.pathname === "/api/departments" && request.method === "POST") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    if (!String(input.name || "").trim()) return json(response, 400, { error: "Nome do departamento é obrigatório." });
    let created;
    await updateStore((data) => {
      if (data.departments.some((item) => item.name.toLowerCase() === input.name.trim().toLowerCase())) throw new Error("Departamento já cadastrado.");
      created = {
        id: createId("dept"), name: input.name.trim(), description: input.description || "",
        color: input.color || "#2875ed", icon: input.icon || "Building2", status: input.status || "Ativo",
        manager: input.manager || "Não definido", members: input.members || [],
        schedule: input.schedule || "Segunda a sexta, 08:00 às 18:00",
        aliases: input.aliases || [input.name.trim().toLowerCase()],
        welcomeMessages: input.welcomeMessages || [], questions: input.questions || [],
        waitMessages: input.waitMessages || [], alertAfter: input.alertAfter || "Formulário concluído",
        alerts: input.alerts || ["Gestor responsável", "Colaboradores do departamento"],
      };
      data.departments.push(created);
      audit(data, request, "Departamento criado", created.name);
    });
    return json(response, 201, created);
  }
  const departmentMatch = url.pathname.match(/^\/api\/departments\/([^/]+)$/);
  if (departmentMatch && request.method === "PUT") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    let updated;
    await updateStore((data) => {
      const department = data.departments.find((item) => item.id === departmentMatch[1] || item.name === decodeURIComponent(departmentMatch[1]));
      if (!department) throw new Error("Departamento não encontrado.");
      const previousName = department.name;
      Object.assign(department, input, { id: department.id || departmentMatch[1] });
      if (input.name && input.name !== previousName) {
        for (const user of data.users) if (user.department === previousName) user.department = input.name;
        for (const conversation of data.conversations) if (conversation.department === previousName) conversation.department = input.name;
      }
      updated = department;
      audit(data, request, "Departamento atualizado", department.name);
    });
    return json(response, 200, updated);
  }

  if (url.pathname === "/api/internal/conversations" && request.method === "GET") {
    const data = await readStore();
    const rows = data.internalConversations
      .filter((conversation) => canAccessInternalConversation(request.auth, conversation))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map((conversation) => internalConversationView(data, conversation, request.auth));
    return json(response, 200, rows);
  }
  if (url.pathname === "/api/internal/conversations" && request.method === "POST") {
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    let created;
    try {
      await updateStore((data) => {
        const requestedIds = [...new Set([request.auth.id, ...(input.participantIds || [])])];
        const participants = findActiveUsers(data, requestedIds);
        if (participants.length < 2) throw new Error("Selecione pelo menos dois participantes.");
        const isGroup = input.type === "group" || participants.length > 2 || Boolean(String(input.title || "").trim());
        const existing = isGroup ? null : data.internalConversations.find((conversation) =>
          conversation.status !== "closed"
          && (conversation.type || "individual") !== "group"
          && conversation.participantIds.length === requestedIds.length
          && requestedIds.every((id) => conversation.participantIds.includes(id))
        );
        if (existing) {
          created = existing;
          return;
        }
        const now = new Date().toISOString();
        const snapshots = Object.fromEntries(participants.map((user) => [user.id, publicDirectoryUser(user)]));
        const title = String(input.title || "").trim() || participants.filter((user) => user.id !== request.auth.id).map((user) => user.name).join(", ");
        created = {
          id: createId("internal"),
          type: isGroup ? "group" : "individual",
          title,
          description: String(input.description || "").trim(),
          imageUrl: "",
          department: isAdmin(request.auth) ? (input.department || request.auth.department) : request.auth.department,
          ownerId: request.auth.id,
          owner: request.auth.name,
          createdBy: request.auth.id,
          adminIds: [request.auth.id],
          participantIds: requestedIds,
          participantSnapshots: snapshots,
          readBy: Object.fromEntries(requestedIds.map((id) => [id, id === request.auth.id ? now : null])),
          status: "active",
          createdAt: now,
          updatedAt: now,
          lastMessageAt: now,
          closedAt: null,
          events: [internalEvent(isGroup ? "group_created" : "created", request.auth, `${request.auth.name} criou ${isGroup ? "o grupo" : "a conversa"}.`)],
          messages: [{
            id: createId("internal-msg"), type: "system",
            text: `${request.auth.name} iniciou ${isGroup ? `o grupo ${title}` : "a conversa"}.`,
            senderId: null, sender: "Sistema", createdAt: now, status: "system",
          }],
        };
        data.internalConversations.unshift(created);
        audit(data, request, "Conversa interna criada", created.title);
      });
      const data = await readStore();
      return json(response, created.createdAt ? 201 : 200, internalConversationView(data, created, request.auth));
    } catch (error) {
      return json(response, requestErrorStatus(error), { error: error.message });
    }
  }
  if (url.pathname === "/api/unread-counts" && request.method === "GET") {
    const data = await readStore();
    return json(response, 200, buildUnreadCounts(data, request.auth));
  }
  if (url.pathname === "/api/notifications" && request.method === "GET") {
    const data = await readStore();
    const rows = (data.notifications || [])
      .filter((notification) => canAccessNotification(request.auth, notification, data))
      .sort((a, b) => new Date(b.createdAt || b.at || 0) - new Date(a.createdAt || a.at || 0))
      .map((notification) => notificationView(notification, request.auth, data))
      .filter((notification) => notification?.message)
      .slice(0, 50);
    return json(response, 200, { notifications: rows, counts: buildUnreadCounts(data, request.auth) });
  }
  if (url.pathname === "/api/notifications/read-all" && request.method === "POST") {
    let counts;
    await updateStore((data) => {
      const now = new Date().toISOString();
      for (const notification of data.notifications || []) {
        if (!canAccessNotification(request.auth, notification, data)) continue;
        ensureNotificationShape(notification);
        notification.readBy[request.auth.id] = now;
      }
      counts = buildUnreadCounts(data, request.auth);
      audit(data, request, "Notificações marcadas como lidas", request.auth.name);
    });
    return json(response, 200, counts);
  }
  const notificationReadMatch = url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (notificationReadMatch && request.method === "POST") {
    let counts;
    let updated;
    try {
      await updateStore((data) => {
        const notification = (data.notifications || []).find((item) => item.id === notificationReadMatch[1]);
        if (!notification) throw new Error("Notificação não encontrada.");
        if (!canAccessNotification(request.auth, notification, data)) throw new Error("Sem permissão para esta notificação.");
        ensureNotificationShape(notification);
        const now = new Date().toISOString();
        markNotificationRead(notification, request.auth.id, now);
        const linkedId = linkedNotificationConversationId(notification);
        const conversation = linkedId ? (data.internalConversations || []).find((item) => item.id === linkedId) : null;
        if (conversation && canAccessInternalConversation(request.auth, conversation)) {
          ensureInternalShape(conversation);
          conversation.readBy[request.auth.id] = now;
          markRelatedConversationNotificationsRead(data, request.auth, conversation, now, notification.messageId || "");
        }
        updated = notificationView(notification, request.auth, data);
        counts = buildUnreadCounts(data, request.auth);
      });
      return json(response, 200, { notification: updated, counts });
    } catch (error) {
      return json(response, requestErrorStatus(error), { error: error.message });
    }
  }
  const aroundMatch = url.pathname.match(/^\/api\/internal\/conversations\/([^/]+)\/messages\/around\/([^/]+)$/);
  if (aroundMatch && request.method === "GET") {
    const data = await readStore();
    const conversation = data.internalConversations.find((item) => item.id === aroundMatch[1]);
    if (!conversation) return json(response, 404, { error: "Conversa interna nao encontrada." });
    if (!canAccessInternalConversation(request.auth, conversation)) {
      auditDeniedConversationAccess(request, aroundMatch[1], "messages-around");
      return json(response, 403, { error: "Sem permissao para esta conversa." });
    }
    const messages = conversation.messages || [];
    const index = messages.findIndex((message) => message.id === aroundMatch[2] && !message.deletedAt);
    if (index < 0) return json(response, 404, { error: "Nao foi possivel localizar a mensagem original." });
    const start = Math.max(0, index - 25);
    const end = Math.min(messages.length, index + 26);
    return json(response, 200, { conversationId: conversation.id, messageId: aroundMatch[2], messages: messages.slice(start, end), cursors: { before: start > 0 ? messages[start].id : null, after: end < messages.length ? messages[end - 1].id : null } });
  }
  const internalMatch = url.pathname.match(/^\/api\/internal\/conversations\/([^/]+)(?:\/(messages|audio|files|participants|forward|close|read|react|edit))?$/);
  if (internalMatch && request.method === "GET" && !internalMatch[2]) {
    const data = await readStore();
    const conversation = data.internalConversations.find((item) => item.id === internalMatch[1]);
    if (!conversation) return json(response, 404, { error: "Conversa interna não encontrada." });
    if (!canAccessInternalConversation(request.auth, conversation)) {
      auditDeniedConversationAccess(request, internalMatch[1], "detalhe");
      return json(response, 403, { error: "Sem permissão para esta conversa." });
    }
    return json(response, 200, internalConversationView(data, conversation, request.auth));
  }
  if (internalMatch && request.method === "POST" && internalMatch[2]) {
    const rawBody = await readBody(request, internalMatch[2] === "audio" ? 9 * 1024 * 1024 : internalMatch[2] === "files" ? maxAttachmentBytes + 1024 * 1024 : 5 * 1024 * 1024);
    const input = ["audio", "files"].includes(internalMatch[2]) ? {} : JSON.parse(rawBody.toString("utf8") || "{}");
    let updated;
    let skippedDuplicateMessage = false;
    try {
      if (["audio", "files"].includes(internalMatch[2])) {
        const snapshot = await readStore();
        const conversation = snapshot.internalConversations.find((item) => item.id === internalMatch[1]);
        if (!conversation) throw new Error("Conversa interna não encontrada.");
        if (!canAccessInternalConversation(request.auth, conversation)) {
          auditDeniedConversationAccess(request, internalMatch[1], internalMatch[2]);
          throw new Error("Sem permissão para esta conversa.");
        }
        if (conversation.status === "closed") throw new Error("A conversa está encerrada.");
      }
      const uploadedAudio = internalMatch[2] === "audio" ? await saveUploadedAudio(rawBody, request.headers["content-type"]) : null;
      const uploadedFile = internalMatch[2] === "files" ? await saveUploadedAttachment(rawBody, request.headers["content-type"]) : null;
      await updateStore((data) => {
        const conversation = data.internalConversations.find((item) => item.id === internalMatch[1]);
        if (!conversation) throw new Error("Conversa interna não encontrada.");
        if (!canAccessInternalConversation(request.auth, conversation)) {
          auditDeniedConversationAccess(request, internalMatch[1], internalMatch[2]);
          throw new Error("Sem permissão para esta conversa.");
        }
        if (internalMatch[2] === "read") {
          ensureInternalShape(conversation);
          const now = new Date().toISOString();
          conversation.readBy[request.auth.id] = now;
          markRelatedConversationNotificationsRead(data, request.auth, conversation, now);
          updated = conversation;
          return;
        }
        if (internalMatch[2] === "messages") {
          if (conversation.status === "closed") throw new Error("A conversa est? encerrada.");
          const text = String(input.text || "").trim();
          if (!text) throw new Error("Digite uma mensagem.");
          if (input.replyToMessageId && !conversation.messages.some((message) => message.id === input.replyToMessageId)) throw new Error("Mensagem original indisponivel.");
          const now = new Date();
          const clientMessageId = String(input.clientMessageId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
          const idempotentMessage = clientMessageId ? [...(conversation.messages || [])].reverse().find((message) =>
            message.type === "message" && message.senderId === request.auth.id && message.clientMessageId === clientMessageId
          ) : null;
          if (idempotentMessage) {
            skippedDuplicateMessage = true;
            updated = conversation;
            return;
          }
          const duplicateWindowMs = 2000;
          const duplicate = [...(conversation.messages || [])].reverse().find((message) => {
            if (message.type !== "message" || message.senderId !== request.auth.id || String(message.text || "").trim() !== text) return false;
            const createdAt = new Date(message.createdAt || 0).getTime();
            return Number.isFinite(createdAt) && now.getTime() - createdAt >= 0 && now.getTime() - createdAt <= duplicateWindowMs;
          });
          if (duplicate) {
            skippedDuplicateMessage = true;
          } else {
            conversation.messages.push({
              id: createId("internal-msg"), type: "message",
              senderId: request.auth.id, sender: request.auth.name,
              role: request.auth.role, text, createdAt: now.toISOString(),
              replyToMessageId: input.replyToMessageId || null,
              forwardedFrom: input.forwardedFrom || null,
              clientMessageId: clientMessageId || null,
              status: "sent",
            });
          }
        } else if (internalMatch[2] === "audio") {
          if (conversation.status === "closed") throw new Error("A conversa está encerrada.");
          const durationSeconds = Math.max(0, Math.min(180, Number.parseInt(String(request.headers["x-audio-duration"] || 0), 10) || 0));
          const replyToMessageId = String(request.headers["x-reply-to-message-id"] || "").trim();
          if (replyToMessageId && !conversation.messages.some((message) => message.id === replyToMessageId && !message.deletedAt)) throw new Error("Mensagem original indisponivel.");
          conversation.messages.push({
            id: createId("internal-msg"), type: "audio",
            senderId: request.auth.id, sender: request.auth.name,
            role: request.auth.role, text: "Mensagem de áudio", createdAt: new Date().toISOString(),
            audio: {
              url: uploadedAudio.url,
              mime: uploadedAudio.mime,
              size: uploadedAudio.size,
              durationSeconds,
              originalName: uploadedAudio.originalName,
            },
            replyToMessageId: replyToMessageId || null,
            forwardedFrom: null,
            status: "sent",
          });
        } else if (internalMatch[2] === "files") {
          if (conversation.status === "closed") throw new Error("A conversa est? encerrada.");
          const replyToMessageId = String(request.headers["x-reply-to-message-id"] || "").trim();
          const clientMessageId = String(request.headers["x-client-message-id"] || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
          const caption = cleanAttachmentCaption(request.headers["x-attachment-caption"]);
          const albumId = String(request.headers["x-attachment-album-id"] || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
          const albumCaption = cleanAttachmentCaption(request.headers["x-attachment-album-caption"]);
          const batchOrder = Math.max(1, Math.min(100, Number.parseInt(String(request.headers["x-attachment-batch-order"] || 1), 10) || 1));
          const batchTotal = Math.max(1, Math.min(100, Number.parseInt(String(request.headers["x-attachment-batch-total"] || 1), 10) || 1));
          if (replyToMessageId && !conversation.messages.some((message) => message.id === replyToMessageId && !message.deletedAt)) throw new Error("Mensagem original indisponivel.");
          const idempotentFileMessage = clientMessageId ? [...(conversation.messages || [])].reverse().find((message) =>
            message.type === "file" && message.senderId === request.auth.id && message.clientMessageId === clientMessageId
          ) : null;
          if (idempotentFileMessage) {
            skippedDuplicateMessage = true;
            updated = conversation;
            return;
          }
          conversation.messages.push({
            id: createId("internal-msg"), type: "file",
            senderId: request.auth.id, sender: request.auth.name,
            role: request.auth.role, text: batchOrder === 1 ? albumCaption || caption : caption,
            file: uploadedFile,
            albumId: albumId || null,
            albumCaption: albumCaption || null,
            itemCaption: caption || null,
            batchOrder,
            batchTotal,
            createdAt: new Date().toISOString(),
            replyToMessageId: replyToMessageId || null,
            forwardedFrom: null,
            clientMessageId: clientMessageId || null,
            status: "sent",
          });
        } else if (internalMatch[2] === "react") {
          if (conversation.status === "closed") throw new Error("A conversa est? encerrada.");
          ensureInternalShape(conversation);
          const messageId = String(input.messageId || "").trim();
          const emoji = String(input.emoji || "").trim();
          const target = (conversation.messages || []).find((message) => message.id === messageId && message.type !== "system" && !message.deletedAt);
          if (!target) throw new Error("Mensagem original indisponivel.");
          if (!allowedMessageReactions.has(emoji)) throw new Error("Reação inválida. Escolha um emoji disponível no menu.");
          target.reactions = Array.isArray(target.reactions) ? target.reactions : [];
          const now = new Date().toISOString();
          const existingIndex = target.reactions.findIndex((reaction) => reaction.userId === request.auth.id);
          if (existingIndex >= 0 && target.reactions[existingIndex].emoji === emoji) {
            target.reactions.splice(existingIndex, 1);
          } else if (existingIndex >= 0) {
            target.reactions[existingIndex] = {
              ...target.reactions[existingIndex],
              emoji,
              userName: request.auth.name,
              updatedAt: now,
            };
          } else {
            target.reactions.push({
              id: createId("reaction"),
              messageId,
              userId: request.auth.id,
              userName: request.auth.name,
              emoji,
              createdAt: now,
              updatedAt: now,
            });
          }
        } else if (internalMatch[2] === "edit") {
          if (conversation.status === "closed") throw new Error("A conversa est? encerrada.");
          ensureInternalShape(conversation);
          const messageId = String(input.messageId || "").trim();
          const nextText = String(input.text || "").trim();
          if (!nextText) throw new Error("Digite uma mensagem.");
          const target = (conversation.messages || []).find((message) => message.id === messageId && message.type !== "system" && !message.deletedAt);
          if (!target) throw new Error("Mensagem original indisponivel.");
          if (target.senderId !== request.auth.id) throw new Error("Somente o remetente pode editar esta mensagem.");
          if (!["message", "file"].includes(target.type || "message")) throw new Error("Este tipo de mensagem nao pode ser editado.");
          const createdAtMs = new Date(target.createdAt || 0).getTime();
          if (!Number.isFinite(createdAtMs)) throw new Error("Data da mensagem invalida.");
          if (Date.now() - createdAtMs > 24 * 60 * 60 * 1000) throw new Error("O prazo de 24 horas para editar esta mensagem expirou.");
          const previousText = String(target.text || "").trim();
          if (previousText === nextText) {
            updated = conversation;
            return;
          }
          const now = new Date().toISOString();
          target.editHistory ||= [];
          target.editHistory.push({
            id: createId("message-edit"),
            editedBy: request.auth.id,
            editedByName: request.auth.name,
            editedAt: now,
            previousText,
            newText: nextText,
          });
          target.text = nextText;
          target.editedAt = now;
          target.editedBy = request.auth.id;
          conversation.events ||= [];
          conversation.events.push(internalEvent("message_edited", request.auth, `${request.auth.name} editou uma mensagem.`, { messageId }));
          audit(data, request, "Mensagem interna editada", `${conversation.title || conversation.id}: ${messageId}`);
        } else if (internalMatch[2] === "participants") {
          if (conversation.status === "closed") throw new Error("A conversa est? encerrada.");
          ensureInternalShape(conversation);
          const action = input.action || "add";
          if (conversation.type !== "group") throw new Error("Conversa individual n?o permite alterar participantes. Crie um grupo para incluir outras pessoas.");
          if (action === "leave") {
            if (!(conversation.participantIds || []).includes(request.auth.id)) throw new Error("Sem permissao para esta conversa.");
            const remaining = conversation.participantIds.filter((id) => id !== request.auth.id);
            if ((conversation.adminIds || []).includes(request.auth.id) && !remaining.some((id) => (conversation.adminIds || []).includes(id))) {
              throw new Error("Promova outro administrador antes de sair do grupo.");
            }
            conversation.participantIds = remaining;
            conversation.adminIds = (conversation.adminIds || []).filter((id) => id !== request.auth.id);
            conversation.messages.push({ id: createId("internal-msg"), type: "system", senderId: null, sender: "Sistema", text: `${request.auth.name} saiu da conversa.`, createdAt: new Date().toISOString(), status: "system" });
            conversation.events.push(internalEvent("participant_left", request.auth, `${request.auth.name} saiu da conversa.`));
          } else {
            if (!canManageInternalConversation(request.auth, conversation)) throw permissionError("Somente propriet?rios e administradores do grupo podem alterar participantes.");
            const [participant] = findActiveUsers(data, [input.userId]);
            if (action === "remove") {
              if (participant.id === request.auth.id) throw new Error("Use a op??o sair do grupo.");
              if (!conversation.participantIds.includes(participant.id)) throw notFoundError("Participante n?o est? no grupo.");
              if (!canRemoveGroupParticipant(request.auth, conversation, participant.id)) throw permissionError("Voc? n?o tem permiss?o para remover este participante.");
              if ((conversation.adminIds || []).includes(participant.id) && conversation.adminIds.length === 1) throw new Error("O grupo precisa manter pelo menos um administrador.");
              conversation.participantIds = conversation.participantIds.filter((id) => id !== participant.id);
              conversation.adminIds = (conversation.adminIds || []).filter((id) => id !== participant.id);
              conversation.messages.push({ id: createId("internal-msg"), type: "system", senderId: null, sender: "Sistema", text: `${participant.name} foi removido por ${request.auth.name}.`, createdAt: new Date().toISOString(), status: "system" });
              conversation.events.push(internalEvent("participant_removed", request.auth, `${participant.name} foi removido por ${request.auth.name}.`, { targetUserId: participant.id }));
            } else if (action === "promote") {
              if (!conversation.participantIds.includes(participant.id)) throw notFoundError("Participante n?o est? no grupo.");
              if (!canPromoteGroupParticipant(request.auth, conversation, participant.id)) throw permissionError("Voc? n?o tem permiss?o para tornar este participante administrador.");
              conversation.adminIds = Array.from(new Set([...(conversation.adminIds || []), participant.id]));
              conversation.messages.push({ id: createId("internal-msg"), type: "system", senderId: null, sender: "Sistema", text: `${participant.name} foi promovido a administrador por ${request.auth.name}.`, createdAt: new Date().toISOString(), status: "system" });
              conversation.events.push(internalEvent("admin_promoted", request.auth, `${participant.name} foi promovido a administrador.`, { targetUserId: participant.id, groupId: conversation.id }));
            } else if (action === "demote") {
              if (!conversation.participantIds.includes(participant.id)) throw notFoundError("Participante n?o est? no grupo.");
              if (!canDemoteGroupAdmin(request.auth, conversation, participant.id)) throw permissionError("Somente o propriet?rio pode remover administradores.");
              conversation.adminIds = (conversation.adminIds || []).filter((id) => id !== participant.id);
              conversation.messages.push({ id: createId("internal-msg"), type: "system", senderId: null, sender: "Sistema", text: `${participant.name} deixou de ser administrador por ${request.auth.name}.`, createdAt: new Date().toISOString(), status: "system" });
              conversation.events.push(internalEvent("admin_demoted", request.auth, `${participant.name} deixou de ser administrador.`, { targetUserId: participant.id, groupId: conversation.id }));
            } else {
              if (!conversation.participantIds.includes(participant.id)) {
                const now = new Date().toISOString();
                conversation.participantIds.push(participant.id);
                conversation.participantSnapshots ||= {};
                conversation.participantSnapshots[participant.id] = publicDirectoryUser(participant);
                conversation.readBy ||= {};
                conversation.readBy[participant.id] = null;
                                conversation.messages.push({ id: createId("internal-msg"), type: "system", senderId: null, sender: "Sistema", text: `${participant.name} foi adicionado ao grupo por ${request.auth.name}.`, createdAt: now, status: "system", notifyUserIds: [participant.id] });
                conversation.events.push(internalEvent("participant_added", request.auth, `${participant.name} foi adicionado por ${request.auth.name}.`, { targetUserId: participant.id, groupId: conversation.id }));
                addNotificationOnce(data, {
                  type: "group_participant_added",
                  eventType: "group_participant_added",
                  title: "Grupo atualizado",
                  message: "",
                  userId: participant.id,
                  userIds: [...new Set(conversation.participantIds)],
                  targetUserId: participant.id,
                  targetUserIds: [participant.id],
                  targetUserName: participant.name,
                  targetUserNames: [participant.name],
                  internalConversationId: conversation.id,
                  conversationId: conversation.id,
                  groupId: conversation.id,
                  groupTitle: conversation.title || "Grupo interno",
                  actorId: request.auth.id,
                  actorName: request.auth.name,
                  actor: request.auth.name,
                  readBy: {},
                  resolvedBy: {},
                  createdAt: now,
                });
              }
            }
          }
        } else if (internalMatch[2] === "forward") {
          if (conversation.status === "closed") throw new Error("A conversa est? encerrada.");
          const original = (conversation.messages || []).find((message) => message.id === input.messageId && message.type !== "system");
          if (!original || original.deletedAt) throw new Error("Mensagem original indisponivel.");
          const destinationIds = Array.isArray(input.destinationIds) ? input.destinationIds : [];
          if (!destinationIds.length) throw new Error("Selecione pelo menos um destino.");
          for (const destinationId of destinationIds) {
            const destination = data.internalConversations.find((item) => item.id === destinationId);
            if (!destination) throw new Error("Conversa de destino nao encontrada.");
            if (!canAccessInternalConversation(request.auth, destination)) throw new Error("Sem permissao para encaminhar para este destino.");
            if (destination.status === "closed") throw new Error("Uma conversa de destino esta encerrada.");
            const comment = String(input.comment || "").trim();
            const albumMessages = original.albumId
              ? (conversation.messages || []).filter((message) => message.albumId === original.albumId && message.type === "file" && !message.deletedAt).sort((a, b) => (a.batchOrder || 0) - (b.batchOrder || 0))
              : [];
            if (albumMessages.length > 1) {
              const forwardedAlbumId = createId("album");
              const albumCaption = comment || original.albumCaption || original.text || "";
              for (const [index, item] of albumMessages.entries()) {
                destination.messages.push({
                  id: createId("internal-msg"), type: "file",
                  senderId: request.auth.id, sender: request.auth.name, role: request.auth.role,
                  text: index === 0 ? albumCaption : item.itemCaption || "",
                  audio: null,
                  file: item.file || null,
                  albumId: forwardedAlbumId,
                  albumCaption,
                  itemCaption: item.itemCaption || "",
                  batchOrder: index + 1,
                  batchTotal: albumMessages.length,
                  createdAt: new Date().toISOString(), replyToMessageId: null,
                  forwardedFrom: { conversationId: conversation.id, messageId: original.id, sender: original.sender, type: "album" },
                  status: "sent",
                });
              }
            } else {
              destination.messages.push({
                id: createId("internal-msg"), type: original.type === "audio" ? "audio" : original.type === "file" ? "file" : "message",
                senderId: request.auth.id, sender: request.auth.name, role: request.auth.role,
                text: comment || original.text || "Mensagem encaminhada",
                audio: original.audio || null,
                file: original.file || null,
                createdAt: new Date().toISOString(), replyToMessageId: null,
                forwardedFrom: { conversationId: conversation.id, messageId: original.id, sender: original.sender, type: original.type || "message" },
                status: "sent",
              });
            }
            destination.updatedAt = new Date().toISOString();
            destination.lastMessageAt = destination.updatedAt;
            destination.events ||= [];
            destination.events.push(internalEvent("message_forwarded", request.auth, `${request.auth.name} encaminhou uma mensagem para esta conversa.`));
          }
          conversation.events ||= [];
          conversation.events.push(internalEvent("message_forwarded_out", request.auth, `${request.auth.name} encaminhou uma mensagem.`, { messageId: original.id, destinationIds }));
        } else {
          if (!canManageInternalConversation(request.auth, conversation)) throw new Error("Sem permissao para encerrar esta conversa.");
          conversation.status = "closed";
          conversation.closedAt = new Date().toISOString();
          conversation.messages.push({
            id: createId("internal-msg"), type: "system", senderId: null, sender: "Sistema Kalion",
            text: `Conversa encerrada por ${request.auth.name}.`, createdAt: conversation.closedAt,
          });
        }
        if (["messages", "audio", "files"].includes(internalMatch[2]) && !skippedDuplicateMessage) {
          maybeAppendOutOfOfficeReply(data, conversation, request.auth.id);
        }
        conversation.updatedAt = new Date().toISOString();
        conversation.lastMessageAt = conversation.updatedAt;
        conversation.readBy ||= {};
        conversation.readBy[request.auth.id] = conversation.updatedAt;
        updated = conversation;
        audit(data, request, `Conversa interna: ${internalMatch[2]}`, conversation.title);
      });
      const data = await readStore();
      const view = internalConversationView(data, updated, request.auth);
      if (internalMatch[2] === "read") return json(response, 200, { conversation: view, counts: buildUnreadCounts(data, request.auth) });
      if (internalMatch[2] === "messages") view.skippedDuplicateMessage = skippedDuplicateMessage;
      return json(response, ["messages", "audio", "files"].includes(internalMatch[2]) && !skippedDuplicateMessage ? 201 : 200, view);
    } catch (error) {
      return json(response, requestErrorStatus(error), { error: error.message });
    }
  }

  if (url.pathname === "/api/meetings" && request.method === "GET") {
    const data = await readStore();
    const status = String(url.searchParams.get("status") || "active").toLowerCase();
    const accessible = data.meetings.filter((meeting) => canAccessMeeting(request.auth, meeting));
    if (["closed", "encerrada", "encerradas", "history", "historico"].includes(status)) {
      const page = pageNumber(url.searchParams.get("page"), 1);
      const pageSize = pageNumber(url.searchParams.get("pageSize"), 20, 50);
      const closed = accessible
        .filter(isClosedMeeting)
        .sort((a, b) => meetingSortDate(b) - meetingSortDate(a));
      const total = closed.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const start = (page - 1) * pageSize;
      return json(response, 200, {
        items: closed.slice(start, start + pageSize).map((meeting) => meetingView(data, meeting)),
        page,
        pageSize,
        total,
        totalPages,
      });
    }
    return json(response, 200, accessible
      .filter((meeting) => !isClosedMeeting(meeting))
      .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
      .map((meeting) => meetingView(data, meeting)));
  }
  if (url.pathname === "/api/meetings" && request.method === "POST") {
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    let created;
    try {
      await updateStore((data) => {
        const department = isAdmin(request.auth) ? input.department : request.auth.department;
        if (!data.departments.some((item) => item.name === department && item.status !== "Inativo")) throw new Error("Departamento inválido.");
        const participantIds = [...new Set([request.auth.id, ...(input.participantIds || [])])];
        const participants = findActiveUsers(data, participantIds);
        if (!isAdmin(request.auth) && participants.some((user) => user.department !== department)) throw new Error("Participantes fora do departamento.");
        const now = new Date().toISOString();
        created = {
          id: createId("meeting"), title: String(input.title || "").trim(),
          department, date: input.date, time: input.time,
          ownerId: request.auth.id, owner: request.auth.name,
          participantIds,
          participantSnapshots: Object.fromEntries(participants.map((user) => [user.id, publicDirectoryUser(user)])),
          status: "Agendada", duration: "", chat: [], attendance: [],
          createdAt: now, updatedAt: now, startedAt: null, endedAt: null,
        };
        if (!created.title || !created.date || !created.time) throw new Error("Título, data e horário são obrigatórios.");
        data.meetings.unshift(created);
        audit(data, request, "Reunião agendada", created.title);
      });
      const data = await readStore();
      return json(response, 201, meetingView(data, created));
    } catch (error) {
      return json(response, requestErrorStatus(error), { error: error.message });
    }
  }
  const meetingMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/(start|messages|close)$/);
  if (meetingMatch && request.method === "POST") {
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    let updated;
    try {
      await updateStore((data) => {
        const meeting = data.meetings.find((item) => item.id === meetingMatch[1]);
        if (!meeting) throw new Error("Reunião não encontrada.");
        if (!canAccessMeeting(request.auth, meeting)) throw new Error("Sem permissão para esta reunião.");
        const now = new Date().toISOString();
        if (meetingMatch[2] === "start") {
          if (meeting.status === "Encerrada") throw new Error("A reunião está encerrada.");
          meeting.status = "Em andamento";
          meeting.startedAt ||= now;
          meeting.attendance ||= [];
          if (!meeting.attendance.some((entry) => entry.userId === request.auth.id)) {
            meeting.attendance.push({ userId: request.auth.id, name: request.auth.name, joinedAt: now, leftAt: null });
          }
        } else if (meetingMatch[2] === "messages") {
          if (meeting.status === "Encerrada") throw new Error("A reunião está encerrada.");
          const text = String(input.text || "").trim();
          if (!text) throw new Error("Digite uma mensagem.");
          meeting.chat.push({ id: createId("meeting-msg"), senderId: request.auth.id, sender: request.auth.name, text, createdAt: now });
        } else {
          const canClose = isAdmin(request.auth) || meeting.ownerId === request.auth.id
            || (request.auth.role === "Gestor" && meeting.department === request.auth.department);
          if (!canClose) throw new Error("Somente o responsável ou gestor pode encerrar a reunião.");
          meeting.status = "Encerrada";
          meeting.endedAt = now;
          meeting.closedById = request.auth.id;
          meeting.closedBy = request.auth.name;
          if (meeting.startedAt) {
            const seconds = Math.max(0, Math.round((new Date(now) - new Date(meeting.startedAt)) / 1000));
            meeting.duration = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
          }
          for (const entry of meeting.attendance || []) if (!entry.leftAt) entry.leftAt = now;
        }
        meeting.updatedAt = now;
        updated = meeting;
        audit(data, request, `Reunião: ${meetingMatch[2]}`, meeting.title);
      });
      const data = await readStore();
      return json(response, meetingMatch[2] === "messages" ? 201 : 200, meetingView(data, updated));
    } catch (error) {
      return json(response, requestErrorStatus(error), { error: error.message });
    }
  }

  if (url.pathname === "/api/quick-replies" && request.method === "GET") {
    const data = await readStore();
    return json(response, 200, data.quickReplies
      .filter((reply) => canAccessQuickReply(request.auth, reply))
      .sort((a, b) => a.shortcut.localeCompare(b.shortcut)));
  }
  if (url.pathname === "/api/quick-replies" && request.method === "POST") {
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    let created;
    try {
      await updateStore((data) => {
        let scope = input.scope || "personal";
        let department = input.department || request.auth.department;
        if (request.auth.role === "Usuário") scope = "personal";
        if (request.auth.role === "Gestor" && scope === "global") throw new Error("Gestor não pode criar resposta global.");
        if (!isAdmin(request.auth)) department = request.auth.department;
        const shortcut = String(input.shortcut || "").trim();
        if (!/^\/[a-z0-9_-]{2,40}$/i.test(shortcut)) throw new Error("O atalho deve começar com / e usar letras, números, _ ou -.");
        if (data.quickReplies.some((item) => item.shortcut.toLowerCase() === shortcut.toLowerCase()
          && item.scope === scope && item.department === department && item.ownerId === (scope === "personal" ? request.auth.id : null))) {
          throw new Error("Já existe uma resposta rápida com este atalho no mesmo escopo.");
        }
        const now = new Date().toISOString();
        created = {
          id: createId("quick"), shortcut, description: String(input.description || "").trim(),
          content: String(input.content || "").trim(), scope,
          department: scope === "global" ? "Todos" : department,
          ownerId: scope === "personal" ? request.auth.id : null,
          owner: scope === "personal" ? request.auth.name : null,
          status: input.status === "Inativo" ? "Inativo" : "Ativo",
          usageCount: 0, createdById: request.auth.id, createdBy: request.auth.name,
          createdAt: now, updatedAt: now,
        };
        if (!created.description || !created.content) throw new Error("Descrição e mensagem são obrigatórias.");
        data.quickReplies.push(created);
        audit(data, request, "Resposta rápida criada", `${created.shortcut} (${created.scope})`);
      });
      return json(response, 201, created);
    } catch (error) {
      return json(response, requestErrorStatus(error), { error: error.message });
    }
  }
  const quickReplyMatch = url.pathname.match(/^\/api\/quick-replies\/([^/]+)$/);
  if (quickReplyMatch && ["PUT", "DELETE"].includes(request.method)) {
    const input = request.method === "PUT" ? JSON.parse((await readBody(request)).toString("utf8") || "{}") : {};
    let result;
    try {
      await updateStore((data) => {
        const reply = data.quickReplies.find((item) => item.id === quickReplyMatch[1]);
        if (!reply) throw new Error("Resposta rápida não encontrada.");
        const canManage = isAdmin(request.auth)
          || (request.auth.role === "Gestor" && reply.scope !== "global" && reply.department === request.auth.department)
          || (reply.scope === "personal" && reply.ownerId === request.auth.id);
        if (!canManage) throw new Error("Sem permissão para alterar esta resposta rápida.");
        if (request.method === "DELETE") {
          data.quickReplies = data.quickReplies.filter((item) => item.id !== reply.id);
          audit(data, request, "Resposta rápida excluída", reply.shortcut);
          result = { success: true };
          return;
        }
        if (input.shortcut && !/^\/[a-z0-9_-]{2,40}$/i.test(input.shortcut)) throw new Error("Atalho inválido.");
        const nextShortcut = input.shortcut?.trim() || reply.shortcut;
        if (data.quickReplies.some((item) => item.id !== reply.id
          && item.shortcut.toLowerCase() === nextShortcut.toLowerCase()
          && item.scope === reply.scope && item.department === reply.department && item.ownerId === reply.ownerId)) {
          throw new Error("Já existe uma resposta rápida com este atalho no mesmo escopo.");
        }
        Object.assign(reply, {
          shortcut: nextShortcut,
          description: input.description?.trim() || reply.description,
          content: input.content?.trim() || reply.content,
          status: input.status === "Inativo" ? "Inativo" : "Ativo",
          updatedAt: new Date().toISOString(),
        });
        audit(data, request, "Resposta rápida atualizada", reply.shortcut);
        result = reply;
      });
      return json(response, 200, result);
    } catch (error) {
      return json(response, requestErrorStatus(error), { error: error.message });
    }
  }
  const quickReplyUseMatch = url.pathname.match(/^\/api\/quick-replies\/([^/]+)\/use$/);
  if (quickReplyUseMatch && request.method === "POST") {
    let used;
    try {
      await updateStore((data) => {
        const reply = data.quickReplies.find((item) => item.id === quickReplyUseMatch[1]);
        if (!reply) throw new Error("Resposta rápida não encontrada.");
        if (!canAccessQuickReply(request.auth, reply) || reply.status !== "Ativo") throw new Error("Resposta rápida indisponível.");
        reply.usageCount = (reply.usageCount || 0) + 1;
        reply.lastUsedAt = new Date().toISOString();
        used = reply;
      });
      return json(response, 200, used);
    } catch (error) {
      return json(response, requestErrorStatus(error), { error: error.message });
    }
  }

  if (url.pathname === "/api/metrics/reports" && request.method === "GET") {
    const data = await readStore();
    return json(response, 200, buildMetrics(data, request.auth));
  }
  if (url.pathname === "/api/settings/general" && request.method === "GET") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const data = await readStore();
    return json(response, 200, data.settings || {});
  }
  if (url.pathname === "/api/settings/general" && request.method === "PUT") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    const companyName = String(input.companyName || "").trim();
    if (companyName.length < 2 || companyName.length > 120) {
      return json(response, 400, { error: "O nome da empresa deve ter entre 2 e 120 caracteres." });
    }
    await updateStore((data) => {
      data.settings ||= {};
      const previous = data.settings.companyName || "";
      Object.assign(data.settings, {
        companyName,
        companyLogoUrl: data.settings.companyLogoUrl || "",
        companyDescription: String(input.companyDescription ?? data.settings.companyDescription ?? "").trim().slice(0, 240),
        officialWhatsappNumber: String(input.officialWhatsappNumber ?? data.settings.officialWhatsappNumber ?? "").replace(/\D/g, "").slice(0, 20),
        timezone: input.timezone || data.settings.timezone || "America/Sao_Paulo",
        language: input.language || data.settings.language || "pt-BR",
        dateFormat: input.dateFormat || data.settings.dateFormat || "DD/MM/YYYY",
        agentIdentification: input.agentIdentification || data.settings.agentIdentification || "{atendente} - Departamento {departamento}:",
        automaticRefresh: input.automaticRefresh ?? data.settings.automaticRefresh ?? true,
        auditEnabled: input.auditEnabled ?? data.settings.auditEnabled ?? true,
        preserveTransferHistory: input.preserveTransferHistory ?? data.settings.preserveTransferHistory ?? true,
        updatedAt: new Date().toISOString(),
      });
      audit(data, request, "Nome da empresa atualizado", `${previous || "Não informado"} -> ${companyName}`);
    });
    const data = await readStore();
    return json(response, 200, data.settings);
  }
  if (url.pathname === "/api/integrations/whatsapp" && request.method === "GET") {
    if (!requireRole(request, response, ["Administrador"])) return;
    return json(response, 200, publicConfig(await getSecureConfig()));
  }
  if (url.pathname === "/api/integrations/whatsapp/readiness" && request.method === "GET") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const status = publicConfig(await getSecureConfig());
    return json(response, status.readyForMeta ? 200 : 409, status);
  }
  if (url.pathname === "/api/integrations/whatsapp/validate-webhook" && request.method === "POST") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const config = await getSecureConfig();
    if (!/^https:\/\/[^/]+/i.test(config.webhookUrl)) return json(response, 400, { error: "Configure uma URL pública HTTPS para o webhook." });
    if (!config.verifyToken) return json(response, 400, { error: "Configure o Verify Token antes de validar o webhook." });
    const challenge = `kalion-${Date.now()}`;
    const target = new URL(config.webhookUrl);
    target.searchParams.set("hub.mode", "subscribe");
    target.searchParams.set("hub.verify_token", config.verifyToken);
    target.searchParams.set("hub.challenge", challenge);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const webhookResponse = await fetch(target, { signal: controller.signal });
      const body = await webhookResponse.text();
      if (!webhookResponse.ok || body !== challenge) throw new Error(`Webhook respondeu ${webhookResponse.status} sem devolver o desafio esperado.`);
      await updateStore((data) => audit(data, request, "Webhook público validado", config.webhookUrl));
      return json(response, 200, { valid: true, webhookUrl: config.webhookUrl });
    } catch (error) {
      return json(response, 502, { error: `Não foi possível validar o webhook público: ${error.message}` });
    } finally {
      clearTimeout(timeout);
    }
  }
  if (url.pathname === "/api/integrations/whatsapp" && request.method === "PUT") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    const saved = await saveSecureConfig(input);
    await updateStore((data) => audit(data, request, "WhatsApp Cloud API atualizada", `Phone Number ID: ${saved.phoneNumberId}; WABA: ${saved.businessAccountId}; versão: ${saved.graphVersion}`));
    return json(response, 200, publicConfig(saved));
  }
  if (url.pathname === "/api/integrations/whatsapp/test" && request.method === "POST") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const result = await testConnection();
    await updateStore((data) => audit(data, request, "Conexão WhatsApp testada", result.display_phone_number || "Número validado"));
    return json(response, 200, result);
  }
  if (url.pathname === "/api/integrations/whatsapp/subscribe" && request.method === "POST") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const result = await subscribeAppToWaba();
    await updateStore((data) => audit(data, request, "Aplicativo vinculado ao WABA", result.success ? "Assinatura confirmada" : "Solicitação concluída"));
    return json(response, 200, result);
  }
  if (url.pathname === "/api/integrations/whatsapp/templates" && request.method === "GET") {
    if (!requireRole(request, response, ["Administrador"])) return;
    try {
      return json(response, 200, await listMessageTemplates());
    } catch (error) {
      return json(response, 502, { error: error.message, code: error.code || "META_ERROR" });
    }
  }
  if (url.pathname === "/api/integrations/whatsapp/template-message" && request.method === "POST") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    if (!input.to || !input.name) return json(response, 400, { error: "Destino e nome do template são obrigatórios." });
    try {
      const result = await sendTemplate(input.to, input.name, input.language || "pt_BR", input.components || []);
      await updateStore((data) => audit(data, request, "Template WhatsApp enviado", `${input.name} para ${String(input.to).replace(/\D/g, "")}`));
      return json(response, 200, result);
    } catch (error) {
      const technical = serializeWhatsAppError(error, input.to, "template_message");
      await updateStore((data) => data.integrationLogs.unshift({
        id: createId("error"), at: technical.at, level: "error", source: "WhatsApp template",
        code: technical.code, message: technical.message, phone: technical.phone,
        operation: technical.operation, detail: technical, metaResponse: technical.metaResponse,
      })).catch(() => {});
      return json(response, 502, { error: userFacingSendFailure(error), code: technical.code });
    }
  }
  if (url.pathname === "/api/integrations/whatsapp/test-message" && request.method === "POST") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    if (!input.to) return json(response, 400, { error: "Informe o telefone de destino com código do país." });
    const phone = input.to.replace(/\D/g, "");
    try {
      const result = await sendText(phone, input.message || "Mensagem de teste do Kalion Connect.");
      await updateStore((data) => audit(data, request, "Mensagem WhatsApp de teste enviada", `Destino: ${input.to}`));
      return json(response, 200, result);
    } catch (error) {
      const technical = serializeWhatsAppError(error, phone, "test_message");
      await updateStore((data) => data.integrationLogs.unshift({
        id: createId("error"), at: technical.at, level: "error", source: "WhatsApp send",
        code: technical.code, message: technical.message, phone, operation: technical.operation, detail: technical,
        phoneNumberId: technical.phoneNumberId, businessAccountId: technical.businessAccountId,
        messageType: technical.messageType, metaResponse: technical.metaResponse,
      })).catch(() => {});
      return json(response, 502, { error: userFacingSendFailure(error), code: technical.code });
    }
  }
  if (url.pathname === "/api/whatsapp/conversations" && request.method === "GET") {
    const data = await readStore();
    return json(response, 200, data.conversations
      .filter((conversation) => canAccessConversation(request.auth, conversation))
      .map((conversation) => {
        const contact = data.contacts.find((item) => item.id === conversation.contactId || item.phone === conversation.phone);
        return {
          ...conversation,
          name: contact?.name || conversation.name,
          photoUrl: contact?.photoUrl || conversation.photoUrl || "",
          photoSource: contact?.photoSource || conversation.photoSource || "Imagem padrão",
        };
      }));
  }
  if (url.pathname === "/api/whatsapp/contacts" && request.method === "GET") {
    const data = await readStore();
    return json(response, 200, data.contacts.filter((contact) => canAccessContact(request.auth, contact, data)));
  }
  if (url.pathname === "/api/whatsapp/contacts" && request.method === "POST") {
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    const phone = String(input.phone || "").replace(/\D/g, "");
    if (!input.name?.trim() || !/^[1-9]\d{7,14}$/.test(phone)) return json(response, 400, { error: "Nome e telefone válido são obrigatórios." });
    let created;
    await updateStore((data) => {
      const existing = data.contacts.find((item) => item.phone === phone);
      if (existing) {
        if (!canAccessContact(request.auth, existing, data)) throw new Error("Telefone ja existe em outro escopo. Abra um atendimento ou solicite compartilhamento ao Administrador.");
        normalizeContactVisibility(data, existing, request.auth, input);
        existing.updatedAt = new Date().toISOString();
        existing.updatedBy = request.auth.id;
        created = existing;
        audit(data, request, "Contato existente vinculado", `${existing.name} (${phone})`);
        return;
      }
      created = {
        id: createId("contact"), name: input.name.trim(), fullName: input.name.trim(),
        phone, cpf: String(input.cpf || "").replace(/\D/g, ""), cnpj: String(input.cnpj || "").replace(/\D/g, ""),
        company: input.tradeName || input.legalName || input.company || "", legalName: input.legalName || "",
        tradeName: input.tradeName || "", email: input.email || "", notes: input.notes || "",
        whatsappProfileName: "", photoUrl: "", photoSource: "Imagem padrão",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      normalizeContactVisibility(data, created, request.auth, input);
      data.contacts.push(created);
      audit(data, request, "Contato criado", `${created.name} (${phone})`);
    });
    return json(response, 201, created);
  }
  const contactMatch = url.pathname.match(/^\/api\/whatsapp\/contacts\/([^/]+)$/);
  if (contactMatch && request.method === "PUT") {
    if (!requireRole(request, response, ["Administrador", "Gestor"])) return;
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    let updated;
    await updateStore((data) => {
      const contact = data.contacts.find((item) => item.id === contactMatch[1]);
      if (!contact) throw new Error("Contato não encontrado.");
      if (!canManageContact(request.auth, contact, data)) throw new Error("Sem permissão para alterar este contato.");
      const nextPhone = input.phone ? String(input.phone).replace(/\D/g, "") : contact.phone;
      if (nextPhone !== contact.phone && data.contacts.some((item) => item.id !== contact.id && item.phone === nextPhone)) throw new Error("Telefone ja cadastrado em outro contato.");
      Object.assign(contact, {
        name: input.name?.trim() || contact.name,
        fullName: input.name?.trim() || contact.fullName,
        phone: nextPhone,
        cpf: input.cpf !== undefined ? String(input.cpf).replace(/\D/g, "") : contact.cpf,
        cnpj: input.cnpj !== undefined ? String(input.cnpj).replace(/\D/g, "") : contact.cnpj,
        company: input.tradeName || input.legalName || input.company || contact.company,
        legalName: input.legalName ?? contact.legalName,
        tradeName: input.tradeName ?? contact.tradeName,
        email: input.email ?? contact.email,
        notes: input.notes ?? contact.notes,
        updatedAt: new Date().toISOString(),
      });
      if (isAdmin(request.auth) && (input.ownerDepartmentId || input.sharedDepartmentIds || input.visibilityScope)) normalizeContactVisibility(data, contact, request.auth, input);
      else contact.updatedBy = request.auth.id;
      updated = contact;
      audit(data, request, "Contato atualizado", contact.name);
    });
    return json(response, 200, updated);
  }
  if (url.pathname === "/api/whatsapp/notifications" && request.method === "GET") {
    const data = await readStore();
    const actor = actorScope(request);
    return json(response, 200, (data.notifications || []).filter((item) => canAccessNotification(actor, item, data)));
  }
  if (url.pathname === "/api/whatsapp/logs" && request.method === "GET") {
    if (!requireRole(request, response, ["Administrador"])) return;
    const data = await readStore();
    return json(response, 200, { integration: data.integrationLogs, audit: data.auditLogs, login: data.loginLogs || [] });
  }
  const messageMatch = url.pathname.match(/^\/api\/whatsapp\/conversations\/([^/]+)\/messages$/);
  if (messageMatch && request.method === "POST") {
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    const data = await readStore();
    const conversation = data.conversations.find((item) => item.id === messageMatch[1]);
    if (!conversation) return json(response, 404, { error: "Conversa n?o encontrada." });
    if (!canAccessConversation(request.auth, conversation)) return json(response, 403, { error: "Sem permiss?o para responder este atendimento." });
    input.text = String(input.text || "").trim();
    if (!input.text) return json(response, 400, { error: "Digite uma mensagem." });
    const now = new Date();
    const duplicateWindowMs = 2000;
    const duplicate = [...(conversation.messages || [])].reverse().find((message) => {
      if (message.direction !== "out" || message.type !== "text" || message.sender !== request.auth.name || String(message.text || "").trim() !== input.text) return false;
      const createdAt = new Date(message.createdAt || 0).getTime();
      return Number.isFinite(createdAt) && now.getTime() - createdAt >= 0 && now.getTime() - createdAt <= duplicateWindowMs;
    });
    if (duplicate) return json(response, 200, { duplicate: true, messageId: duplicate.id });
    let result;
    try {
      result = await sendText(conversation.phone, input.text);
    } catch (error) {
      const technical = serializeWhatsAppError(error, conversation.phone, "agent_text");
      await updateStore((store) => {
        const target = store.conversations.find((item) => item.id === conversation.id);
        if (target) {
          target.messages.push({
            id: createId("msg"), direction: "system", type: "system",
            text: userFacingSendFailure(error), sender: "Sistema Kalion", automatic: false,
            status: "failed", errors: [technical], createdAt: technical.at,
          });
          target.lastDeliveryError = technical;
        }
        store.integrationLogs.unshift({
          id: createId("error"), at: technical.at, level: "error", source: "WhatsApp send",
          code: technical.code, message: technical.message, phone: technical.phone,
          operation: technical.operation, conversationId: conversation.id, detail: technical,
          phoneNumberId: technical.phoneNumberId, businessAccountId: technical.businessAccountId,
          messageType: technical.messageType, metaResponse: technical.metaResponse,
        });
      }).catch(() => {});
      return json(response, 502, { error: userFacingSendFailure(error), code: technical.code });
    }
    await updateStore((store) => {
      const target = store.conversations.find((item) => item.id === conversation.id);
      const at = new Date().toISOString();
      target.messages.push({ id: createId("msg"), whatsappMessageId: result.messages?.[0]?.id, direction: "out", type: "text", text: input.text, sender: request.auth.name, automatic: false, status: "sent", transport: result._kalion || {}, createdAt: at });
      target.updatedAt = new Date().toISOString();
      store.integrationLogs.unshift({
        id: createId("send"), at, level: "info", source: "WhatsApp send", code: "ACCEPTED",
        message: "Mensagem manual aceita pela Meta para processamento.", phone: conversation.phone,
        phoneNumberId: result._kalion?.phoneNumberId || "", businessAccountId: result._kalion?.businessAccountId || "",
        messageType: result._kalion?.messageType || "text", operation: "agent_text",
        conversationId: conversation.id, metaResponse: result,
      });
    });
    return json(response, 201, result);
  }
  const actionMatch = url.pathname.match(/^\/api\/whatsapp\/conversations\/([^/]+)\/(assume|transfer|close)$/);
  if (actionMatch && request.method === "POST") {
    const [, conversationId, action] = actionMatch;
    const input = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    const snapshot = (await readStore()).conversations.find((item) => item.id === conversationId);
    if (!snapshot) return json(response, 404, { error: "Conversa não encontrada." });
    if (!canAccessConversation(request.auth, snapshot)) return json(response, 403, { error: "Sem permissão para alterar este atendimento." });
    let transferResult = null;
    let transferError = null;
    let transferNotice = "";
    if (action === "transfer") {
      if (!input.department) return json(response, 400, { error: "Informe o departamento de destino." });
      const store = await readStore();
      if (!store.departments.some((item) => item.name === input.department && item.status !== "Inativo")) return json(response, 400, { error: "Departamento de destino inválido ou inativo." });
      if (input.user && !store.users.some((item) => item.name === input.user && item.accessStatus === "Ativo" && (item.department === input.department || item.role === "Administrador"))) {
        return json(response, 400, { error: "O responsável selecionado não pertence ao departamento de destino." });
      }
      transferNotice = `Seu atendimento foi transferido para ${input.department}${input.user ? `, responsável ${input.user}` : ""}.`;
      try {
        transferResult = await sendText(snapshot.phone, transferNotice);
      } catch (error) {
        transferError = serializeWhatsAppError(error, snapshot.phone, "transfer_notice");
      }
    }
    let updated;
    await updateStore((data) => {
      const conversation = data.conversations.find((item) => item.id === conversationId);
      if (action === "assume") {
        conversation.owner = input.user;
        conversation.status = "active";
      } else if (action === "transfer") {
        conversation.transferHistory.push({ from: conversation.owner, to: input.user, department: input.department, reason: input.reason, at: new Date().toISOString() });
        conversation.owner = input.user || "Não atribuído";
        conversation.department = input.department;
        conversation.status = input.user ? "active" : "waiting";
        linkContactToConversation(data, conversation.contactId, conversation.id, input.department);
        conversation.messages.push(transferError ? {
          id: createId("msg"), direction: "system", type: "system",
          text: userFacingSendFailure(transferError), sender: "Sistema Kalion",
          automatic: true, status: "failed", errors: [transferError], createdAt: transferError.at,
        } : {
          id: createId("msg"), whatsappMessageId: transferResult?.messages?.[0]?.id || null,
          direction: "out", type: "system", text: transferNotice, sender: "Sistema Kalion",
          automatic: true, status: "sent", transport: transferResult?._kalion || {}, createdAt: new Date().toISOString(),
        });
        if (transferError) {
          conversation.lastDeliveryError = transferError;
          data.integrationLogs.unshift({
            id: createId("error"), at: transferError.at, level: "error", source: "WhatsApp send",
            code: transferError.code, message: transferError.message, phone: transferError.phone,
            operation: transferError.operation, conversationId: conversation.id, detail: transferError,
            phoneNumberId: transferError.phoneNumberId, businessAccountId: transferError.businessAccountId,
            messageType: transferError.messageType, metaResponse: transferError.metaResponse,
          });
        }
      } else {
        conversation.status = "closed";
        conversation.closedAt = new Date().toISOString();
      }
      conversation.updatedAt = new Date().toISOString();
      audit(data, request, `Atendimento ${action}`, `${conversation.protocol}: ${input.reason || input.user || ""}`);
      updated = conversation;
    });
    return json(response, 200, { ...updated, deliveryWarning: transferError ? userFacingSendFailure(transferError) : null });
  }
  const mediaMatch = url.pathname.match(/^\/api\/whatsapp\/media\/([^/]+)$/);
  if (mediaMatch && request.method === "GET") {
    const safeName = path.basename(mediaMatch[1]);
    try {
      const content = await readFile(path.join(dataDir, "media", safeName));
      response.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${safeName}"` });
      return response.end(content);
    } catch {
      return json(response, 404, { error: "Mídia não encontrada." });
    }
  }
  return json(response, 404, { error: "Endpoint não encontrado." });
}

async function handleWebhook(request, response, url) {
  const config = await getSecureConfig();
  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === config.verifyToken) {
      response.writeHead(200, { "Content-Type": "text/plain" });
      return response.end(challenge || "");
    }
    return json(response, 403, { error: "Falha na verificação do webhook." });
  }
  if (request.method === "POST") {
    const raw = await readBody(request);
    let payloadForAudit = null;
    let payloadParseError = "";
    try {
      payloadForAudit = JSON.parse(raw.toString("utf8") || "{}");
    } catch (error) {
      payloadParseError = `JSON invalido: ${error.message}`;
    }
    const signatureValid = validateMetaSignature(raw, request.headers["x-hub-signature-256"], config.appSecret);
    await auditWebhookReceipt({
      request, raw, payload: payloadForAudit, signatureValid,
      error: payloadParseError || (signatureValid ? "" : "Assinatura HMAC invalida ou ausente."),
    });
    if (!validateMetaSignature(raw, request.headers["x-hub-signature-256"], config.appSecret)) return json(response, 401, { error: "Assinatura do webhook inválida." });
    const payload = JSON.parse(raw.toString("utf8") || "{}");
    const events = extractWebhookEvents(payload);
    await updateStore((data) => {
      data.integrationLogs ||= [];
      data.integrationLogs.unshift({
        id: createId("webhook"), at: new Date().toISOString(), level: "info",
        source: "Meta webhook", code: "WEBHOOK_EVENTS_EXTRACTED",
        message: `${events.length} evento(s) extraido(s) do webhook.`,
        operation: "webhook_extract", detail: {
          messages: events.filter((event) => event.kind === "message").length,
          statuses: events.filter((event) => event.kind === "status").length,
          errors: events.filter((event) => event.kind === "error").length,
          phoneNumberIds: webhookPayloadSummary(payload).phoneNumberIds,
        },
      });
    });
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end("EVENT_RECEIVED");
    queueMicrotask(() => (async () => {
      for (const event of events) {
        try {
          if (event.kind === "message") await processIncomingMessage({
            ...event,
            normalized: normalizeIncomingMessage(event.message),
            suppressAutomaticReplies: isMetaTestMessageEvent(event),
          });
          if (event.kind === "status") await processStatusEvent(event.status);
          if (event.kind === "error") await updateStore((data) => data.integrationLogs.unshift({ id: createId("error"), at: new Date().toISOString(), level: "error", source: "Meta webhook", detail: event.error }));
        } catch (error) {
          await updateStore((data) => data.integrationLogs.unshift({
            id: createId("error"), at: new Date().toISOString(), level: "error",
            source: "Webhook processing", message: error.message, detail: error.message,
          })).catch(() => {});
        }
      }
    })().catch((error) => console.error("Webhook processing failure:", error)));
    return;
  }
  return json(response, 405, { error: "Método não permitido." });
}

const processStartTime = new Date().toISOString();
const server = createServer(async (request, response) => {
  try {
    applyCorsHeaders(request, response);
    if (handleCorsPreflight(request, response)) return;
    const url = new URL(request.url, `http://${request.headers.host || "kalion.invalid"}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(request, response, url);
    if (url.pathname === "/webhooks/whatsapp") return await handleWebhook(request, response, url);
    return json(response, 404, { error: "Rota não encontrada." });
  } catch (error) {
    console.error(error);
    if (!response.headersSent) json(response, 500, { error: error.message || "Erro interno." });
  }
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || "kalion.invalid"}`);
  if (url.pathname === "/api/presence") {
    handlePresenceUpgrade(request, socket, head).catch(() => {
      socket.write("HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n");
      socket.destroy();
    });
    return;
  }
  if (url.pathname.startsWith("/api/meetings/") && url.pathname.endsWith("/signaling")) {
    handleMeetingUpgrade(request, socket, head).catch(() => {
      socket.write("HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n");
      socket.destroy();
    });
    return;
  }
  socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
  socket.destroy();
});

const host = process.env.HOST || "0.0.0.0";
server.listen(port, host, () => console.log(`Kalion WhatsApp backend ${releaseVersion} ativo em http://${host}:${port}`));
setInterval(runWaitingMessages, 15_000).unref();
