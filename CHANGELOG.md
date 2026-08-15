# Changelog

Todas as alterações relevantes deste projeto devem ser documentadas neste arquivo.

O formato segue a ideia de versionamento semântico:

- correções pequenas incrementam o patch: `1.0.1`;
- novas funcionalidades compatíveis incrementam o minor: `1.1.0`;
- mudanças incompatíveis incrementam o major: `2.0.0`.

## 1.3.1 - 2026-07-24

### Corrigido

- Separadores de data das mensagens passam a usar a data original de envio em vez de exibir sempre `Hoje`.
- Mensagens sem data original válida passam a exibir `Data não informada` e gerar aviso técnico sem conteúdo da mensagem.
- Reações em mensagens internas passam a validar emojis reais em UTF-8, evitando aviso indevido de valor inválido.
- Troca e remoção da própria reação passam a ser persistidas corretamente pelo backend.

### Migração

- Não há migração de banco nesta versão.

## 1.3.0 - 2026-07-22

### Adicionado

- A preferência de tamanho da fonte das mensagens agora também afeta a caixa de digitação, edição de mensagens e texto enviado com anexos.
- Rolagem automática inteligente para acompanhar novas mensagens quando o usuário está no final da conversa.
- Botão flutuante de novas mensagens quando o usuário está lendo mensagens antigas.
- Atalho `Esc` para fechar a conversa selecionada quando não houver modal, busca, edição ou menu aberto.

### Ajustado

- Altura da caixa de digitação passa a acompanhar proporcionalmente o tamanho de fonte escolhido.
- Imagens/anexos que alteram a altura da conversa mantêm a rolagem no final somente quando o usuário já estava acompanhando as mensagens recentes.

### Migração

- Não há migração de banco nesta versão.

## 1.2.0 - 2026-07-22

### Adicionado

- Preferência de acessibilidade para tamanho da fonte das mensagens.
- Opções Pequena (14 px), Padrão (16 px), Grande (18 px) e Muito grande (20 px).
- Aplicação imediata da preferência por usuário, sem recarregar a página.

### Ajustado

- Espaçamento entre mensagens passa a acompanhar proporcionalmente o tamanho escolhido.

### Migração

- Não há migração manual. A preferência é salva no campo existente de preferências do usuário.

## 1.1.0 - 2026-07-21

### Adicionado

- Edição de mensagens próprias em conversas internas, com limite de 24 horas.
- Registro interno do histórico de edição da mensagem para auditoria.
- Selo visual `(Editada às HH:mm)` nas mensagens alteradas.
- Banner interno persistente para novas mensagens não lidas.
- Repetição inteligente de alerta a cada 60 segundos até a conversa ser aberta.
- Preferências de notificação para som, notificações do Windows, repetição até leitura, não perturbe e horário silencioso.

### Corrigido

- Lista de usuários e colaboradores ordenada alfabeticamente por nome, ignorando maiúsculas, minúsculas e acentos.

### Migração

- Não há migração manual. Mensagens antigas recebem os campos de edição automaticamente quando carregadas pelo backend.

## 1.0.1 - 2026-07-17

### Corrigido

- Posicionamento do menu de ações das mensagens para evitar corte dentro da bolha.
- Direção do menu conforme autoria da mensagem: recebidas abrem para a direita, enviadas pelo usuário abrem para a esquerda.
- Caixa de resposta com aparência consistente nos temas claro e escuro.

### Documentação

- Registrado o padrão obrigatório de versionamento e cópia segura no GitHub.
- Reforçada a regra de não publicar dados de produção, credenciais, certificados, logs, backups, banco, uploads ou informações internas da empresa.
- Ampliado o `.env.example` com variáveis genéricas de identidade visual, armazenamento e instalação.

### Migração

- Não há migração de banco nesta versão.

### Observações

- A publicação no GitHub deve usar somente código e arquivos genéricos instaláveis.
- Dados reais de produção permanecem exclusivamente no ambiente operacional.
