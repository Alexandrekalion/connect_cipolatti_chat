export const departments = [
  { name: "Comercial", people: 12, open: 45, color: "#2775ed" },
  { name: "Vendas", people: 8, open: 28, color: "#31b95b" },
  { name: "RH", people: 6, open: 22, color: "#8950e8" },
  { name: "Suporte", people: 10, open: 18, color: "#f3a51c" },
  { name: "Financeiro", people: 5, open: 9, color: "#ef3e43" },
  { name: "Outros", people: 3, open: 6, color: "#58a8df" },
];

export const contacts = [
  { id: 1, name: "Mariana Alves", phone: "+55 12 98234-5678", company: "Alves Consultoria", dept: "Comercial", status: "Em atendimento", initials: "MA", color: "#d78165", unread: 3, time: "09:48", preview: "Quero informações sobre o curso..." },
  { id: 2, name: "Lucas Pereira", phone: "+55 12 98123-4567", company: "Pereira & Lima", dept: "Suporte", status: "Aguardando", initials: "LP", color: "#b85c4a", unread: 5, time: "09:47", preview: "Preciso de ajuda com meu pedido" },
  { id: 3, name: "Empresa ABC Ltda", phone: "+55 11 97654-3210", company: "ABC Ltda", dept: "Vendas", status: "Pendente", initials: "AB", color: "#5b779d", unread: 2, time: "09:45", preview: "Falar sobre proposta comercial" },
  { id: 4, name: "João Santos", phone: "+55 12 96345-6789", company: "Autônomo", dept: "Financeiro", status: "Em atendimento", initials: "JS", color: "#3b7e67", unread: 1, time: "09:44", preview: "Não consegui acessar o sistema" },
  { id: 5, name: "Ana Beatriz", phone: "+55 12 98456-7890", company: "Studio Ana", dept: "RH", status: "Em atendimento", initials: "AN", color: "#965c76", unread: 2, time: "09:43", preview: "Envio de documentos" },
  { id: 6, name: "Carlos Eduardo", phone: "+55 11 99876-1122", company: "Tech Solutions", dept: "Suporte", status: "Solucionado", initials: "CE", color: "#53668d", unread: 1, time: "Ontem", preview: "Suporte técnico" },
  { id: 7, name: "Juliana Costa", phone: "+55 12 99774-2233", company: "Costa Imóveis", dept: "Comercial", status: "Solucionado", initials: "JC", color: "#9e5e72", unread: 0, time: "Ontem", preview: "Informações sobre planos" },
];

export const users = [
  { name: "João Silva", email: "joao@kalion.com.br", role: "Administrador", dept: "Comercial", status: "Online", initials: "JS" },
  { name: "Maria Santos", email: "maria@kalion.com.br", role: "Gestor", dept: "Suporte", status: "Online", initials: "MS" },
  { name: "Pedro Costa", email: "pedro@kalion.com.br", role: "Atendente", dept: "Vendas", status: "Em atendimento", initials: "PC" },
  { name: "Júlia Souza", email: "julia@kalion.com.br", role: "Supervisor", dept: "Financeiro", status: "Ausente", initials: "JS" },
  { name: "Felipe Lima", email: "felipe@kalion.com.br", role: "Consulta", dept: "RH", status: "Offline", initials: "FL" },
];

export const activity = [
  { title: "Novo atendimento recebido", detail: "Departamento: Comercial", time: "09:48", tone: "red" },
  { title: "Atendimento aguardando há mais de 10 min", detail: "Cliente: Mariana Alves", time: "09:47", tone: "amber" },
  { title: "Atendimento transferido", detail: "De: Suporte para RH", time: "09:46", tone: "orange" },
  { title: "Cliente enviou um arquivo", detail: "Cliente: Lucas Pereira", time: "09:45", tone: "green" },
  { title: "Colaborador chamado para ajudar", detail: "Por: Maria Santos", time: "09:44", tone: "blue" },
];

export const chartData = [
  { time: "00:00", value: 2 },
  { time: "02:00", value: 8 },
  { time: "04:00", value: 11 },
  { time: "06:00", value: 22 },
  { time: "08:00", value: 17 },
  { time: "10:00", value: 25 },
  { time: "12:00", value: 28 },
  { time: "14:00", value: 33 },
  { time: "16:00", value: 23 },
  { time: "18:00", value: 29 },
  { time: "20:00", value: 27 },
  { time: "22:00", value: 37 },
  { time: "23:59", value: 36 },
];
