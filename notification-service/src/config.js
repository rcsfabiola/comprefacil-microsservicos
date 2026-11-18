// Configurações do serviço de notificação.
module.exports = {
  port: Number(process.env.PORT || 3001),

  // Banco de dados exclusivo do serviço de notificação
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/notification_db',

  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672',

  // Exchange onde o pagamento publica os eventos
  eventsExchange: process.env.EVENTS_EXCHANGE || 'comprefacil.eventos',

  // Fila própria do serviço de notificação, ligada à exchange
  notificationQueue: process.env.NOTIFICATION_QUEUE || 'notificacoes',

  // Padrão de chave de roteamento: "#" significa "qualquer coisa depois",
  // então a fila recebe transacao.recebida, transacao.confirmada e
  // qualquer evento de transação que venha a ser criado no futuro.
  bindingKey: process.env.BINDING_KEY || 'transacao.#',

  // Política de novas tentativas quando o envio falha
  maxAttempts: Number(process.env.MAX_ATTEMPTS || 3),
  retryDelayMs: Number(process.env.RETRY_DELAY_MS || 2000),
};
