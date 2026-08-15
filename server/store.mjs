import "./env.mjs";
import { chmod, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

const dataDir = path.resolve(process.env.KALION_DATA_DIR || "server/data");
const databaseFile = path.join(dataDir, "database.json");

const seed = {
  contacts: [],
  conversations: [],
  internalConversations: [],
  meetings: [],
  quickReplies: [],
  notifications: [],
  outOfOfficeReplies: [],
  integrationLogs: [],
  auditLogs: [],
  departments: [
    { name: "RH", aliases: ["rh", "recursos humanos"], questions: ["Qual vaga deseja consultar?", "Já enviou currículo?", "Possui experiência na área?"] },
    { name: "Recrutamento", aliases: ["recrutamento", "vagas"], questions: ["Qual vaga deseja consultar?", "Já enviou currículo?", "Possui experiência na área?"] },
    { name: "Financeiro", aliases: ["financeiro", "financeira"], questions: ["Informe o assunto financeiro que deseja tratar."] },
    { name: "TI", aliases: ["ti", "tecnologia", "suporte"], questions: ["Descreva o problema técnico encontrado."] },
    { name: "Comercial", aliases: ["comercial", "vendas"], questions: ["Qual produto ou serviço deseja conhecer?"] },
    { name: "Almoxarifado", aliases: ["almoxarifado", "estoque"], questions: ["Qual material ou item deseja consultar?"] },
  ],
  settings: {
    companyName: "EMPRESA X",
    companyLogoUrl: "",
    companyDescription: "",
    officialWhatsappNumber: "",
    timezone: "America/Sao_Paulo",
    language: "pt-BR",
    dateFormat: "DD/MM/YYYY",
    agentIdentification: "{atendente} - Departamento {departamento}:",
    automaticRefresh: true,
    auditEnabled: true,
    preserveTransferHistory: true,
    waitMessages: [
      { afterSeconds: 30, repeatSeconds: null, text: "Recebemos sua solicitação. Aguarde um instante." },
      { afterSeconds: 120, repeatSeconds: null, text: "Estamos encaminhando seu atendimento." },
      { afterSeconds: 240, repeatSeconds: 120, text: "Você já será atendido." },
    ],
  },
};

let queue = Promise.resolve();
let initQueue = null;
let initialized = false;
let cache = null;
let cacheStat = null;

export async function initStore() {
  if (initialized) return;
  if (initQueue) return initQueue;
  initQueue = ensureStoreInitialized()
    .then(() => { initialized = true; })
    .finally(() => { initQueue = null; });
  return initQueue;
}

async function ensureStoreInitialized() {
  await mkdir(path.join(dataDir, "media"), { recursive: true });
  await mkdir(path.join(dataDir, "uploads", "company"), { recursive: true });
  await mkdir(path.join(dataDir, "uploads", "users"), { recursive: true });
  await mkdir(path.join(dataDir, "uploads", "contacts"), { recursive: true });
  await mkdir(path.join(dataDir, "uploads", "audio"), { recursive: true });
  let current;
  try {
    current = JSON.parse(await readFile(databaseFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      await atomicWrite(seed);
      return;
    }
    throw error;
  }
  let changed = false;
  for (const contact of current.contacts || []) {
      const normalizedPhone = String(contact.phone || "").replace(/\D/g, "");
      if (contact.phone !== normalizedPhone) { contact.phone = normalizedPhone; changed = true; }
      const conversations = (current.conversations || []).filter((item) => item.contactId === contact.id);
      const firstConversation = conversations[0];
      const ownerUser = (current.users || []).find((user) => user.id === contact.ownerUserId || user.id === contact.createdBy || user.name === firstConversation?.owner);
      const ownerDepartmentName = contact.ownerDepartmentId || contact.ownerDepartment || ownerUser?.department || firstConversation?.department || "";
      const ownerDepartment = (current.departments || []).find((department) => department.id === ownerDepartmentName || department.name === ownerDepartmentName);
      if (!Object.hasOwn(contact, "ownerUserId")) { contact.ownerUserId = ownerUser?.id || ""; changed = true; }
      if (!Object.hasOwn(contact, "ownerDepartmentId")) { contact.ownerDepartmentId = ownerDepartment?.id || ownerDepartmentName || ""; changed = true; }
      if (!Array.isArray(contact.sharedDepartmentIds)) { contact.sharedDepartmentIds = []; changed = true; }
      for (const conversation of conversations) {
        const department = (current.departments || []).find((item) => item.name === conversation.department || item.id === conversation.department);
        const key = department?.id || conversation.department;
        if (key && !contact.sharedDepartmentIds.includes(key)) { contact.sharedDepartmentIds.push(key); changed = true; }
        for (const transfer of conversation.transferHistory || []) {
          const transferDepartment = (current.departments || []).find((item) => item.name === transfer.department || item.id === transfer.department);
          const transferKey = transferDepartment?.id || transfer.department;
          if (transferKey && !contact.sharedDepartmentIds.includes(transferKey)) { contact.sharedDepartmentIds.push(transferKey); changed = true; }
        }
      }
      if (!Array.isArray(contact.linkedAttendanceIds)) { contact.linkedAttendanceIds = []; changed = true; }
      for (const conversation of conversations) {
        if (conversation.id && !contact.linkedAttendanceIds.includes(conversation.id)) { contact.linkedAttendanceIds.push(conversation.id); changed = true; }
      }
      if (!Object.hasOwn(contact, "createdBy")) { contact.createdBy = contact.ownerUserId || ""; changed = true; }
      if (!Object.hasOwn(contact, "updatedBy")) { contact.updatedBy = contact.createdBy || ""; changed = true; }
      if (!contact.visibilityScope) { contact.visibilityScope = contact.sharedDepartmentIds.length ? "shared_by_attendance" : "department"; changed = true; }
      const profileName = conversations.flatMap((item) => item.messages || [])
        .find((message) => message.direction === "in" && message.sender && message.sender !== contact.phone)?.sender || "";
      if (!contact.whatsappProfileName && profileName) { contact.whatsappProfileName = profileName; changed = true; }
      if (!Object.hasOwn(contact, "fullName")) { contact.fullName = ""; changed = true; }
      if (!contact.photoSource) { contact.photoSource = "Imagem padrão"; changed = true; }
      if (!Object.hasOwn(contact, "photoUrl")) { contact.photoUrl = ""; changed = true; }
      const collectedName = conversations.flatMap((item) => item.formAnswers || []).find((answer) => answer.question === "Nome completo")?.answer;
      if (contact.whatsappProfileName && (!contact.name || contact.name === contact.phone || contact.name === collectedName)) {
        contact.fullName = contact.fullName || collectedName || "";
        contact.name = contact.whatsappProfileName;
        for (const conversation of conversations) conversation.name = contact.name;
        changed = true;
      }
  }
  for (const conversation of current.conversations || []) {
      const normalizedPhone = String(conversation.phone || "").replace(/\D/g, "");
      if (conversation.phone !== normalizedPhone) { conversation.phone = normalizedPhone; changed = true; }
      for (const message of conversation.messages || []) {
        if (!message.status) {
          message.status = message.direction === "in" ? "received" : "sent";
          changed = true;
        }
      }
  }
  current.settings ||= structuredClone(seed.settings);
  for (const [key, value] of Object.entries(seed.settings)) {
    if (!Object.hasOwn(current.settings, key)) {
      current.settings[key] = structuredClone(value);
      changed = true;
    }
  }
  for (const [index, department] of (current.departments || []).entries()) {
    const defaults = {
      id: `dept-${index + 1}`,
      description: `Atendimento especializado do departamento ${department.name}.`,
      color: ["#8950e8", "#58a8df", "#ef3e43", "#2875ed", "#31b95b", "#f3a51c"][index % 6],
      icon: "Building2",
      status: "Ativo",
      manager: "Não definido",
      members: [],
      schedule: "Segunda a sexta, 08:00 às 18:00",
      welcomeMessages: [],
      waitMessages: current.settings.waitMessages.map((item) => ({
        afterSeconds: item.afterSeconds,
        repeatSeconds: item.repeatSeconds,
        text: item.text,
      })),
      alertAfter: "Formulário concluído",
      alerts: ["Gestor responsável", "Colaboradores do departamento"],
    };
    for (const [key, value] of Object.entries(defaults)) {
      if (!Object.hasOwn(department, key)) {
        department[key] = structuredClone(value);
        changed = true;
      }
    }
  }
  if (!Array.isArray(current.sessions)) { current.sessions = []; changed = true; }
  if (!Array.isArray(current.loginLogs)) { current.loginLogs = []; changed = true; }
  if (!Array.isArray(current.internalConversations)) { current.internalConversations = []; changed = true; }
  for (const conversation of current.internalConversations || []) {
    const now = conversation.updatedAt || conversation.createdAt || new Date().toISOString();
    if (!conversation.type) {
      conversation.type = (conversation.participantIds || []).length > 2 || conversation.title ? "group" : "individual";
      changed = true;
    }
    if (!Object.hasOwn(conversation, "description")) { conversation.description = ""; changed = true; }
    if (!Object.hasOwn(conversation, "imageUrl")) { conversation.imageUrl = ""; changed = true; }
    if (!Array.isArray(conversation.adminIds)) {
      conversation.adminIds = [conversation.ownerId].filter(Boolean);
      changed = true;
    }
    if (!Array.isArray(conversation.events)) {
      conversation.events = [{
        id: createId("internal-event"),
        type: "created",
        actorId: conversation.ownerId || null,
        actor: conversation.owner || "Sistema",
        text: `${conversation.owner || "Sistema"} criou a conversa.`,
        createdAt: conversation.createdAt || now,
      }];
      changed = true;
    }
    if (conversation.type === "group"
      && (conversation.participantIds || []).length === 2
      && !conversation.description
      && !conversation.events.some((event) => event.type === "group_created")) {
      conversation.type = "individual";
      changed = true;
    }
    if (!conversation.createdBy) { conversation.createdBy = conversation.ownerId || ""; changed = true; }
    if (!Object.hasOwn(conversation, "lastMessageAt")) { conversation.lastMessageAt = now; changed = true; }
    if (!conversation.readBy || typeof conversation.readBy !== "object" || Array.isArray(conversation.readBy)) {
      conversation.readBy = {};
      changed = true;
    }
    for (const id of conversation.participantIds || []) {
      if (!Object.hasOwn(conversation.readBy, id)) {
        conversation.readBy[id] = null;
        changed = true;
      }
    }
    for (const message of conversation.messages || []) {
      if (!message.id) { message.id = createId("internal-msg"); changed = true; }
      if (!Object.hasOwn(message, "replyToMessageId")) { message.replyToMessageId = null; changed = true; }
      if (!Object.hasOwn(message, "forwardedFrom")) { message.forwardedFrom = null; changed = true; }
      if (!message.status) { message.status = message.type === "system" ? "system" : "sent"; changed = true; }
      if (!Object.hasOwn(message, "deletedAt")) { message.deletedAt = null; changed = true; }
    }
  }
  if (!Array.isArray(current.meetings)) { current.meetings = []; changed = true; }
  if (!Array.isArray(current.quickReplies)) { current.quickReplies = []; changed = true; }
  if (!Array.isArray(current.outOfOfficeReplies)) { current.outOfOfficeReplies = []; changed = true; }
  for (const user of current.users || []) {
    if (!Object.hasOwn(user, "photoUrl")) { user.photoUrl = ""; changed = true; }
    if (!Array.isArray(user.loginAliases)) { user.loginAliases = []; changed = true; }
    if (!user.outOfOffice || typeof user.outOfOffice !== "object" || Array.isArray(user.outOfOffice)) {
      user.outOfOffice = { enabled: false, startAt: "", endAt: "", message: "", updatedAt: "", updatedBy: "" };
      changed = true;
    } else {
      for (const [key, value] of Object.entries({ enabled: false, startAt: "", endAt: "", message: "", updatedAt: "", updatedBy: "" })) {
        if (!Object.hasOwn(user.outOfOffice, key)) { user.outOfOffice[key] = value; changed = true; }
      }
    }
  }
  if (changed) await atomicWrite(current);
}

export async function readStore() {
  await initStore();
  const currentStat = await stat(databaseFile);
  if (cache
    && cacheStat
    && cacheStat.mtimeMs === currentStat.mtimeMs
    && cacheStat.size === currentStat.size) {
    return cache;
  }
  cache = JSON.parse(await readFile(databaseFile, "utf8"));
  cacheStat = { mtimeMs: currentStat.mtimeMs, size: currentStat.size };
  return cache;
}

async function atomicWrite(data) {
  const temp = `${databaseFile}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o640 });
    await rename(temp, databaseFile);
    await chmod(databaseFile, 0o640);
    const currentStat = await stat(databaseFile);
    cache = data;
    cacheStat = { mtimeMs: currentStat.mtimeMs, size: currentStat.size };
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
}

export function updateStore(updater) {
  const operation = queue.catch(() => undefined).then(async () => {
    const data = structuredClone(await readStore());
    const result = await updater(data);
    await atomicWrite(data);
    return result;
  });
  queue = operation.catch(() => undefined);
  return operation;
}

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createProtocol() {
  const now = new Date();
  return `KC-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${String(now.getTime()).slice(-7)}`;
}

export { dataDir };
