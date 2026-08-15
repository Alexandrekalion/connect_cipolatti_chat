import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSecureConfig } from "./config.mjs";
import { dataDir } from "./store.mjs";

export function validateMetaSignature(rawBody, signature, appSecret) {
  if (!appSecret) return process.env.WHATSAPP_MOCK_MODE === "true";
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

async function graphRequest(pathname, options = {}) {
  const config = await getSecureConfig();
  const { kalionContext = {}, ...fetchOptions } = options;
  if (process.env.WHATSAPP_MOCK_MODE === "true") {
    if (pathname.endsWith("/messages") && fetchOptions.method === "POST") {
      const body = JSON.parse(fetchOptions.body || "{}");
      if (process.env.WHATSAPP_MOCK_REJECT_PHONE && body.to === process.env.WHATSAPP_MOCK_REJECT_PHONE) {
        const error = new Error("(#131030) Recipient phone number not in allowed list");
        error.name = "MetaGraphError";
        error.code = 131030;
        error.type = "OAuthException";
        error.httpStatus = 400;
        error.details = "Recipient phone number not in allowed list";
        error.phoneNumberId = config.phoneNumberId;
        error.businessAccountId = config.businessAccountId;
        error.destination = body.to;
        error.messageType = body.type || kalionContext.messageType || "text";
        error.metaResponse = {
          error: {
            message: error.message,
            type: error.type,
            code: error.code,
            error_data: { details: error.details },
          },
        };
        throw error;
      }
    }
    if (pathname.includes("?fields=")) {
      return { id: config.phoneNumberId || "mock-phone-id", display_phone_number: "+55 11 00000-0000", verified_name: "Kalion Connect - Teste", quality_rating: "GREEN" };
    }
    return {
      messaging_product: "whatsapp",
      messages: [{ id: `mock-${Date.now()}` }],
      _kalion: {
        phoneNumberId: config.phoneNumberId,
        businessAccountId: config.businessAccountId,
        destination: kalionContext.destination || "",
        messageType: kalionContext.messageType || "",
        httpStatus: 200,
      },
    };
  }
  if (!config.accessToken) throw new Error("Access Token não configurado.");
  const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${pathname}`, {
    ...fetchOptions,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      ...(fetchOptions.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const meta = payload?.error || {};
    const error = new Error(meta.message || `Meta Graph API respondeu ${response.status}.`);
    error.name = "MetaGraphError";
    error.code = meta.code || response.status;
    error.subcode = meta.error_subcode || null;
    error.type = meta.type || "MetaGraphError";
    error.traceId = meta.fbtrace_id || "";
    error.httpStatus = response.status;
    error.details = meta.error_data?.details || "";
    error.metaResponse = payload;
    error.phoneNumberId = config.phoneNumberId;
    error.businessAccountId = config.businessAccountId;
    error.destination = kalionContext.destination || "";
    error.messageType = kalionContext.messageType || "";
    throw error;
  }
  return {
    ...payload,
    _kalion: {
      phoneNumberId: config.phoneNumberId,
      businessAccountId: config.businessAccountId,
      destination: kalionContext.destination || "",
      messageType: kalionContext.messageType || "",
      httpStatus: response.status,
    },
  };
}

export function normalizeWhatsAppPhone(value) {
  const phone = String(value || "").replace(/\D/g, "");
  if (!/^[1-9]\d{7,14}$/.test(phone)) {
    const error = new Error("Telefone de destino inválido. Use apenas código do país, DDD e número.");
    error.name = "WhatsAppPhoneError";
    error.code = "INVALID_DESTINATION";
    error.destination = phone;
    throw error;
  }
  return phone;
}

export function serializeWhatsAppError(error, to = "", operation = "send") {
  const phone = String(to || error?.destination || "").replace(/\D/g, "");
  return {
    code: error?.code || error?.httpStatus || "UNKNOWN",
    subcode: error?.subcode || null,
    type: error?.type || error?.name || "Error",
    message: error?.message || "Falha desconhecida na WhatsApp Cloud API.",
    details: error?.details || "",
    traceId: error?.traceId || "",
    phone,
    phoneNumberId: error?.phoneNumberId || "",
    businessAccountId: error?.businessAccountId || "",
    messageType: error?.messageType || "",
    metaResponse: error?.metaResponse || null,
    operation,
    at: new Date().toISOString(),
  };
}

export function isRecipientNotAllowed(error) {
  return Number(error?.code) === 131030
    || /recipient phone number not in allowed list/i.test(error?.message || "");
}

export function userFacingSendFailure(error) {
  if (isRecipientNotAllowed(error)) {
    return "Mensagem não enviada ao WhatsApp: número não autorizado na lista de teste da Meta.";
  }
  if (Number(error?.code) === 130497) {
    return "Mensagem não enviada ao WhatsApp: a conta empresarial está restrita para enviar mensagens a usuários deste país.";
  }
  return `Mensagem recebida, mas resposta automática não enviada: ${error?.message || "falha na integração com a Meta"}`;
}

export async function testConnection() {
  const config = await getSecureConfig();
  if (!config.phoneNumberId) throw new Error("Phone Number ID não configurado.");
  if (!config.businessAccountId) throw new Error("WhatsApp Business Account ID não configurado.");
  const [phone, accountPhones] = await Promise.all([
    graphRequest(`${config.phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`),
    graphRequest(`${config.businessAccountId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`),
  ]);
  const belongsToAccount = accountPhones.data?.some((item) => item.id === config.phoneNumberId);
  if (!belongsToAccount) throw new Error("O Phone Number ID informado não pertence ao WABA configurado ou o token não possui permissão.");
  return { ...phone, businessAccountId: config.businessAccountId, belongsToAccount: true };
}

export async function subscribeAppToWaba() {
  const config = await getSecureConfig();
  if (!config.businessAccountId) throw new Error("WhatsApp Business Account ID não configurado.");
  return graphRequest(`${config.businessAccountId}/subscribed_apps`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function listMessageTemplates() {
  const config = await getSecureConfig();
  if (!config.businessAccountId) throw new Error("WhatsApp Business Account ID não configurado.");
  return graphRequest(`${config.businessAccountId}/message_templates?fields=id,name,status,category,language,quality_score`);
}

export async function sendTemplate(to, name, language = "pt_BR", components = []) {
  const config = await getSecureConfig();
  if (!config.phoneNumberId) throw new Error("Phone Number ID não configurado.");
  const destination = normalizeWhatsAppPhone(to);
  return graphRequest(`${config.phoneNumberId}/messages`, {
    method: "POST",
    kalionContext: { destination, messageType: "template" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: destination,
      type: "template",
      template: { name, language: { code: language }, ...(components.length ? { components } : {}) },
    }),
  });
}

export async function sendText(to, body, options = {}) {
  const config = await getSecureConfig();
  if (!config.phoneNumberId) throw new Error("Phone Number ID não configurado.");
  const destination = normalizeWhatsAppPhone(to);
  return graphRequest(`${config.phoneNumberId}/messages`, {
    method: "POST",
    kalionContext: { destination, messageType: "text" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: destination,
      type: "text",
      text: { preview_url: false, body },
      ...(options.contextMessageId ? { context: { message_id: options.contextMessageId } } : {}),
    }),
  });
}

export async function sendInteractiveDepartmentList(to, departments) {
  const config = await getSecureConfig();
  const destination = normalizeWhatsAppPhone(to);
  return graphRequest(`${config.phoneNumberId}/messages`, {
    method: "POST",
    kalionContext: { destination, messageType: "interactive_list" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: destination,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: "Qual departamento deseja falar?" },
        action: {
          button: "Escolher departamento",
          sections: [{
            title: "Departamentos",
            rows: departments.slice(0, 10).map((department, index) => ({
              id: `department_${index}`,
              title: department.name.slice(0, 24),
              description: `Atendimento ${department.name}`.slice(0, 72),
            })),
          }],
        },
      },
    }),
  });
}

export async function markAsRead(messageId) {
  const config = await getSecureConfig();
  return graphRequest(`${config.phoneNumberId}/messages`, {
    method: "POST",
    kalionContext: { messageType: "mark_as_read" },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
  });
}

export async function downloadMedia(mediaId, mimeType = "application/octet-stream") {
  const metadata = await graphRequest(mediaId);
  const config = await getSecureConfig();
  const response = await fetch(metadata.url, { headers: { Authorization: `Bearer ${config.accessToken}` } });
  if (!response.ok) throw new Error(`Falha ao baixar mídia: ${response.status}.`);
  const extension = mimeType.split("/")[1]?.split(";")[0] || "bin";
  const directory = path.join(dataDir, "media");
  await mkdir(directory, { recursive: true });
  const filename = `${mediaId}.${extension}`;
  await writeFile(path.join(directory, filename), Buffer.from(await response.arrayBuffer()));
  return { filename, mimeType, sha256: metadata.sha256 || "", fileSize: metadata.file_size || 0 };
}

export function extractWebhookEvents(payload) {
  const events = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const message of value.messages || []) {
        events.push({ kind: "message", message, contacts: value.contacts || [], metadata: value.metadata || {} });
      }
      for (const status of value.statuses || []) {
        events.push({ kind: "status", status, metadata: value.metadata || {} });
      }
      for (const error of value.errors || []) {
        events.push({ kind: "error", error, metadata: value.metadata || {} });
      }
    }
  }
  return events;
}

export function isMetaTestMessageEvent(event) {
  const from = String(event?.message?.from || "");
  const displayName = String(event?.contacts?.[0]?.profile?.name || "").toLowerCase();
  const text = String(event?.message?.text?.body || "").toLowerCase();
  return from === "16505551111"
    || displayName === "test user"
    || text === "message_text";
}

export function normalizeIncomingMessage(message) {
  const base = {
    whatsappMessageId: message.id,
    from: normalizeWhatsAppPhone(message.from),
    timestamp: new Date(Number(message.timestamp) * 1000).toISOString(),
    type: message.type,
    contextMessageId: message.context?.id || null,
  };
  if (message.type === "text") return { ...base, text: message.text?.body || "" };
  if (message.type === "interactive") {
    const selection = message.interactive?.list_reply || message.interactive?.button_reply || {};
    return { ...base, text: selection.title || selection.id || "", interactiveId: selection.id || "" };
  }
  if (message.type === "button") return { ...base, text: message.button?.text || "", interactiveId: message.button?.payload || "" };
  if (message.type === "contacts") return { ...base, text: "Contato compartilhado", contacts: message.contacts || [] };
  const media = message[message.type] || {};
  return {
    ...base,
    text: media.caption || `[${message.type}]`,
    media: { id: media.id, mimeType: media.mime_type, sha256: media.sha256, filename: media.filename || "" },
  };
}
