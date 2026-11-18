// Configurações do serviço de notificação.
module.exports = {
  port: Number(process.env.PORT || 3001),

  // Banco de dados exclusivo do serviço de notificação
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/notification_db',

  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672',

  // Fila de onde o serviço lê as mensagens publicadas pelo pagamento
  notificationQueue: process.env.NOTIFICATION_QUEUE || 'notificacoes',
};
