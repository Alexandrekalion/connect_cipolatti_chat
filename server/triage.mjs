import { createId, createProtocol, updateStore } from "./store.mjs";
import {
  downloadMedia, isRecipientNotAllowed, markAsRead, sendInteractiveDepartmentList,
  sendText, serializeWhatsAppError, userFacingSendFailure,
} from "./whatsapp.mjs";

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function findDepartment(input, departments) {
  const normalized = input.toLowerCase().trim();
  const numbered = Number(normalized);
  if (numbered >= 1 && numbered <= departments.length) return departments[numbered - 1];
  return departments.find((department) => department.name.toLowerCase() === normalized || department.aliases?.some((alias) => normalized.includes(alias)));
}

function departmentKey(data, departmentName) {
  const name = String(departmentName || "").trim();
  const department = (data.departments || []).find((item) => item.id === name || item.name === name);
  return department?.id || name;
}

function linkContactToConversation(data, contact, conversation, departmentName) {
  if (!contact || !conversation) return;
  contact.linkedAttendanceIds = Array.from(new Set([...(contact.linkedAttendanceIds || []), conversation.id].filter(Boolean)));
  const key = departmentKey(data, departmentName || conversation.department);
  if (key) contact.sharedDepartmentIds = Array.from(new Set([...(contact.sharedDepartmentIds || []), key]));
  if (!contact.ownerDepartmentId && key) contact.ownerDepartmentId = key;
  if (contact.visibilityScope !== "global") contact.visibilityScope = contact.sharedDepartmentIds.length ? "shared_by_attendance" : "department";
  contact.updatedAt = new Date().toISOString();
}

async function sendAndRecord(data, conversation, text, automatic = true) {
  try {
    const response = await sendText(conversation.phone, text);
    const message = {
      id: createId("msg"), whatsappMessageId: response.messages?.[0]?.id || null, direction: "out",
      type: "text", text, sender: automatic ? "Automação Kalion" : "Atendente",
      automatic, status: "sent", transport: response._kalion || {}, createdAt: new Date().toISOString(),
    };
    conversation.messages.push(message);
    conversation.updatedAt = message.createdAt;
    data.integrationLogs.unshift({
      id: createId("send"), at: message.createdAt, level: "info", source: "WhatsApp send",
      code: "ACCEPTED", message: "Mensagem aceita pela Meta para processamento.",
      phone: conversation.phone, phoneNumberId: response._kalion?.phoneNumberId || "",
      businessAccountId: response._kalion?.businessAccountId || "",
      messageType: response._kalion?.messageType || "text",
      operation: automatic ? "automatic_text" : "agent_text",
      conversationId: conversation.id, metaResponse: response,
    });
    return { sent: true, message };
  } catch (error) {
    const technical = serializeWhatsAppError(error, conversation.phone, automatic ? "automatic_text" : "agent_text");
    const warningText = userFacingSendFailure(error);
    const warning = {
      id: createId("msg"), whatsappMessageId: null, direction: "system", type: "system",
      text: warningText, sender: "Sistema Kalion", automatic: true, status: "failed",
      errors: [technical], createdAt: technical.at,
    };
    conversation.messages.push(warning);
    conversation.updatedAt = technical.at;
    conversation.deliveryBlocked = isRecipientNotAllowed(error);
    conversation.lastDeliveryError = technical;
    data.integrationLogs.unshift({
      id: createId("error"), at: technical.at, level: "error", source: "WhatsApp send",
      code: technical.code, message: technical.message, phone: technical.phone,
      operation: technical.operation, conversationId: conversation.id, detail: technical,
      phoneNumberId: technical.phoneNumberId, businessAccountId: technical.businessAccountId,
      messageType: technical.messageType, metaResponse: technical.metaResponse,
    });
    return { sent: false, error: technical, message: warning };
  }
}

async function requestDepartments(data, conversation) {
  try {
    const response = await sendInteractiveDepartmentList(conversation.phone, data.departments);
    conversation.messages.push({
      id: createId("msg"), whatsappMessageId: response.messages?.[0]?.id || null, direction: "out",
      type: "interactive", text: "Qual departamento deseja falar?", sender: "Automação Kalion",
      automatic: true, status: "sent", transport: response._kalion || {}, createdAt: new Date().toISOString(),
    });
  } catch (error) {
    const technical = serializeWhatsAppError(error, conversation.phone, "automatic_interactive");
    data.integrationLogs.unshift({
      id: createId("error"), at: technical.at, level: "error", source: "WhatsApp send",
      code: technical.code, message: technical.message, phone: technical.phone,
      operation: technical.operation, conversationId: conversation.id, detail: technical,
      phoneNumberId: technical.phoneNumberId, businessAccountId: technical.businessAccountId,
      messageType: technical.messageType, metaResponse: technical.metaResponse,
    });
    if (isRecipientNotAllowed(error)) {
      const warningText = userFacingSendFailure(error);
      conversation.messages.push({
        id: createId("msg"), whatsappMessageId: null, direction: "system", type: "system",
        text: warningText, sender: "Sistema Kalion", automatic: true, status: "failed",
        errors: [technical], createdAt: technical.at,
      });
      conversation.deliveryBlocked = true;
      conversation.lastDeliveryError = technical;
    } else {
      const options = data.departments.map((department, index) => `${index + 1}. ${department.name}`).join("\n");
      await sendAndRecord(data, conversation, `Qual departamento deseja falar?\n\n${options}`);
    }
  }
  conversation.triage.stage = "awaiting_department";
}

export async function processIncomingMessage(event) {
  const incoming = event.normalized;
  const displayName = event.contacts?.[0]?.profile?.name || "";
  const metadata = event.metadata || {};
  let readError = null;
  await markAsRead(incoming.whatsappMessageId).catch((error) => { readError = error; });
  let mediaInfo = null;
  if (incoming.media?.id) mediaInfo = await downloadMedia(incoming.media.id, incoming.media.mimeType).catch(() => null);

  return updateStore(async (data) => {
    data.integrationLogs ||= [];
    data.notifications ||= [];
    let contact = data.contacts.find((item) => item.phone === incoming.from);
    let createdContact = false;
    if (!contact) {
      contact = {
        id: createId("contact"), phone: incoming.from, name: displayName || "Novo contato",
        whatsappProfileName: displayName, fullName: "", cpf: "", cnpj: "", company: "",
        email: "", photoUrl: "", photoSource: "Imagem padrão",
        ownerUserId: "", ownerDepartmentId: "", sharedDepartmentIds: [], linkedAttendanceIds: [],
        createdBy: "", updatedBy: "", visibilityScope: "shared_by_attendance",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      data.contacts.push(contact);
      createdContact = true;
    } else if (displayName && contact.whatsappProfileName !== displayName) {
      contact.whatsappProfileName = displayName;
      if (!contact.fullName || contact.name === "Novo contato" || contact.name === contact.phone) contact.name = displayName;
    }
    let conversation = data.conversations.find((item) => item.phone === incoming.from && !["closed", "resolved"].includes(item.status));
    let createdConversation = false;
    if (!conversation) {
      conversation = {
        id: createId("conversation"), protocol: null, contactId: contact.id, phone: incoming.from, name: contact.name || displayName || incoming.from,
        department: "Boas-vindas", owner: "Automação Kalion", status: "triage", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        messages: [], transferHistory: [], formAnswers: [], alerts: [], waitSent: {},
        triage: { stage: "awaiting_name", documentType: "", departmentQuestions: [], questionIndex: 0 },
      };
      data.conversations.push(conversation);
      createdConversation = true;
      const alert = {
        id: createId("notification"), department: conversation.department, conversationId: conversation.id,
        protocol: conversation.protocol, title: "Novo atendimento recebido", message: `${conversation.name || conversation.phone} iniciou contato pelo WhatsApp.`,
        targets: ["manager", "agents"], readBy: [], createdAt: new Date().toISOString(),
      };
      data.notifications.push(alert);
      conversation.alerts.push(alert.id);
    }
    linkContactToConversation(data, contact, conversation, conversation.department);
    if (conversation.messages.some((message) => message.whatsappMessageId === incoming.whatsappMessageId)) {
      data.integrationLogs.unshift({
        id: createId("webhook"), at: new Date().toISOString(), level: "info", source: "WhatsApp webhook",
        code: "DUPLICATE_MESSAGE", message: "Evento duplicado ignorado pelo whatsappMessageId.",
        phone: incoming.from, conversationId: conversation.id, phoneNumberId: metadata.phone_number_id || "",
        businessAccountId: metadata.display_phone_number || "", messageType: incoming.type,
        operation: "incoming_message_duplicate",
      });
      return conversation;
    }
    conversation.messages.push({
      id: createId("msg"), whatsappMessageId: incoming.whatsappMessageId, direction: "in", sender: contact.name || displayName || incoming.from,
      type: incoming.type, text: incoming.text, media: mediaInfo, status: "received", createdAt: incoming.timestamp,
    });
    conversation.updatedAt = new Date().toISOString();
    data.integrationLogs.unshift({
      id: createId("webhook"), at: conversation.updatedAt, level: "info", source: "WhatsApp webhook",
      code: "MESSAGE_RECEIVED", message: "Mensagem recebida e persistida no atendimento.",
      phone: incoming.from, conversationId: conversation.id, contactId: contact.id,
      phoneNumberId: metadata.phone_number_id || "", displayPhoneNumber: metadata.display_phone_number || "",
      messageType: incoming.type, operation: "incoming_message_persisted",
      detail: { createdContact, createdConversation, stage: conversation.triage?.stage || "", whatsappMessageId: incoming.whatsappMessageId },
    });
    if (readError) {
      const technical = serializeWhatsAppError(readError, conversation.phone, "mark_as_read");
      data.integrationLogs.unshift({
        id: createId("error"), at: technical.at, level: "error", source: "WhatsApp status",
        code: technical.code, message: technical.message, phone: technical.phone,
        operation: technical.operation, conversationId: conversation.id, detail: technical,
      });
    }

    if (event.suppressAutomaticReplies) {
      const at = new Date().toISOString();
      const warningText = "Evento de teste da Meta recebido. Nenhuma resposta automática real foi enviada.";
      conversation.messages.push({
        id: createId("msg"), direction: "system", type: "system", text: warningText,
        sender: "Sistema Kalion", automatic: true, status: "skipped", createdAt: at,
      });
      conversation.metaTestEvent = true;
      data.integrationLogs.unshift({
        id: createId("info"), at, level: "info", source: "Meta webhook test",
        code: "META_TEST_EVENT", message: warningText, phone: conversation.phone,
        operation: "automatic_reply_skipped", conversationId: conversation.id,
      });
      return conversation;
    }

    const answer = incoming.text.trim();
    const stage = conversation.triage.stage;
    if (conversation.messages.filter((message) => message.direction === "in").length === 1 && stage === "awaiting_name") {
      const greeting = await sendAndRecord(data, conversation, `Olá, seja bem-vindo à ${data.settings.companyName}.`);
      if (greeting.sent) await sendAndRecord(data, conversation, "Por favor informe seu nome completo.");
      return conversation;
    }
    if (stage === "awaiting_name") {
      contact.fullName = answer;
      if (!contact.whatsappProfileName) contact.name = answer || "Novo contato";
      conversation.name = contact.name || contact.phone;
      conversation.formAnswers.push({ question: "Nome completo", answer });
      conversation.triage.stage = "awaiting_reason";
      await sendAndRecord(data, conversation, "Como podemos ajudar?");
    } else if (stage === "awaiting_reason") {
      conversation.reason = answer;
      conversation.formAnswers.push({ question: "Motivo do atendimento", answer });
      conversation.triage.stage = "awaiting_document";
      await sendAndRecord(data, conversation, "Você é Pessoa Física ou Pessoa Jurídica? Digite CPF ou CNPJ.");
    } else if (stage === "awaiting_document") {
      const document = digits(answer);
      if (![11, 14].includes(document.length)) {
        await sendAndRecord(data, conversation, "Documento inválido. Digite um CPF com 11 números ou CNPJ com 14 números.");
        return conversation;
      }
      conversation.triage.documentType = document.length === 14 ? "CNPJ" : "CPF";
      if (document.length === 14) contact.cnpj = document; else contact.cpf = document;
      conversation.formAnswers.push({ question: conversation.triage.documentType, answer: document });
      if (document.length === 14) {
        conversation.triage.stage = "awaiting_company";
        await sendAndRecord(data, conversation, "Informe o nome da empresa.");
      } else await requestDepartments(data, conversation);
    } else if (stage === "awaiting_company") {
      contact.company = answer;
      conversation.formAnswers.push({ question: "Nome da empresa", answer });
      await requestDepartments(data, conversation);
    } else if (stage === "awaiting_department") {
      const department = incoming.interactiveId?.startsWith("department_")
        ? data.departments[Number(incoming.interactiveId.replace("department_", ""))]
        : findDepartment(answer, data.departments);
      if (!department) {
        await sendAndRecord(data, conversation, "Não identifiquei o departamento. Escolha uma das opções apresentadas.");
        await requestDepartments(data, conversation);
        return conversation;
      }
      conversation.protocol = createProtocol();
      conversation.department = department.name;
      conversation.owner = "Não atribuído";
      conversation.status = "collecting_department_form";
      linkContactToConversation(data, contact, conversation, department.name);
      conversation.triage.departmentQuestions = department.questions || [];
      conversation.triage.questionIndex = 0;
      conversation.formAnswers.push({ question: "Departamento escolhido", answer: department.name });
      await sendAndRecord(data, conversation, `Protocolo criado: ${conversation.protocol}. Atendimento encaminhado para ${department.name}.`);
      if (conversation.triage.departmentQuestions.length) {
        conversation.triage.stage = "department_form";
        await sendAndRecord(data, conversation, conversation.triage.departmentQuestions[0]);
      } else await finishDepartmentForm(data, conversation);
    } else if (stage === "department_form") {
      const question = conversation.triage.departmentQuestions[conversation.triage.questionIndex];
      conversation.formAnswers.push({ question, answer });
      conversation.triage.questionIndex += 1;
      const next = conversation.triage.departmentQuestions[conversation.triage.questionIndex];
      if (next) await sendAndRecord(data, conversation, next);
      else await finishDepartmentForm(data, conversation);
    }
    contact.updatedAt = new Date().toISOString();
    return conversation;
  });
}

async function finishDepartmentForm(data, conversation) {
  conversation.triage.stage = "queued";
  conversation.status = "waiting";
  conversation.queuedAt = new Date().toISOString();
  conversation.owner = "Não atribuído";
  const alert = {
    id: createId("notification"), department: conversation.department, conversationId: conversation.id,
    protocol: conversation.protocol, title: "Novo atendimento aguardando", message: `${conversation.name} concluiu a triagem.`,
    targets: ["manager", "agents"], readBy: [], createdAt: new Date().toISOString(),
  };
  data.notifications.push(alert);
  conversation.alerts.push(alert.id);
  await sendAndRecord(data, conversation, `Triagem concluída. Seu atendimento está na fila do departamento ${conversation.department}.`);
}

export async function processStatusEvent(status) {
  return updateStore((data) => {
    for (const conversation of data.conversations) {
      const message = conversation.messages.find((item) => item.whatsappMessageId === status.id);
      if (message) {
        message.status = status.status;
        message.statusAt = new Date(Number(status.timestamp) * 1000).toISOString();
        if (status.errors?.length) {
          message.errors = status.errors;
          const metaError = status.errors[0];
          const technical = {
            code: metaError.code || "UNKNOWN",
            subcode: metaError.error_subcode || null,
            type: metaError.title || "Meta delivery error",
            message: metaError.message || metaError.title || "Falha na entrega da mensagem.",
            details: metaError.error_data?.details || "",
            traceId: "",
            phone: conversation.phone,
            phoneNumberId: message.transport?.phoneNumberId || "",
            businessAccountId: message.transport?.businessAccountId || "",
            messageType: message.transport?.messageType || message.type,
            operation: "delivery_status",
            at: message.statusAt,
          };
          const warningText = userFacingSendFailure(technical);
          const duplicate = conversation.messages.some((item) => item.type === "system" && item.status === "failed" && item.errors?.some((entry) => String(entry.code) === String(technical.code)));
          if (!duplicate) {
            conversation.messages.push({
              id: createId("msg"), direction: "system", type: "system", text: warningText,
              sender: "Sistema Kalion", automatic: true, status: "failed",
              errors: [technical], createdAt: technical.at,
            });
          }
          conversation.lastDeliveryError = technical;
          data.integrationLogs.unshift({
            id: createId("error"), at: technical.at, level: "error", source: "Meta delivery status",
            code: technical.code, message: technical.message, phone: technical.phone,
            operation: technical.operation, conversationId: conversation.id, detail: technical,
            phoneNumberId: technical.phoneNumberId, businessAccountId: technical.businessAccountId,
            messageType: technical.messageType, metaResponse: status,
          });
        }
        break;
      }
    }
  });
}

export async function runWaitingMessages() {
  const due = [];
  await updateStore((data) => {
    const now = Date.now();
    for (const conversation of data.conversations.filter((item) => item.status === "waiting" && item.queuedAt)) {
      const elapsed = Math.floor((now - new Date(conversation.queuedAt).getTime()) / 1000);
      for (const rule of data.settings.waitMessages) {
        if (elapsed < rule.afterSeconds) continue;
        const key = `${rule.afterSeconds}`;
        const lastSent = conversation.waitSent[key] ? new Date(conversation.waitSent[key]).getTime() : 0;
        if (!lastSent || (rule.repeatSeconds && now - lastSent >= rule.repeatSeconds * 1000)) {
          conversation.waitSent[key] = new Date().toISOString();
          due.push({ conversationId: conversation.id, phone: conversation.phone, text: rule.text });
          if (!rule.repeatSeconds) break;
        }
      }
    }
  });
  for (const item of due) {
    try {
      const response = await sendText(item.phone, item.text);
      await updateStore((data) => {
        const conversation = data.conversations.find((entry) => entry.id === item.conversationId);
        if (conversation) conversation.messages.push({ id: createId("msg"), whatsappMessageId: response.messages?.[0]?.id, direction: "out", type: "text", text: item.text, sender: "Automação Kalion", automatic: true, status: "sent", transport: response._kalion || {}, createdAt: new Date().toISOString() });
      });
    } catch (error) {
      const technical = serializeWhatsAppError(error, item.phone, "waiting_message");
      await updateStore((data) => {
        const conversation = data.conversations.find((entry) => entry.id === item.conversationId);
        if (conversation) {
          conversation.messages.push({
            id: createId("msg"), direction: "system", type: "system",
            text: userFacingSendFailure(error), sender: "Sistema Kalion", automatic: true,
            status: "failed", errors: [technical], createdAt: technical.at,
          });
          conversation.deliveryBlocked = isRecipientNotAllowed(error);
          conversation.lastDeliveryError = technical;
        }
        data.integrationLogs.unshift({
          id: createId("error"), at: technical.at, level: "error", source: "WhatsApp send",
          code: technical.code, message: technical.message, phone: technical.phone,
          operation: technical.operation, conversationId: item.conversationId, detail: technical,
          phoneNumberId: technical.phoneNumberId, businessAccountId: technical.businessAccountId,
          messageType: technical.messageType, metaResponse: technical.metaResponse,
        });
      });
    }
  }
}
