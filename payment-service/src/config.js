// Configurações do serviço de pagamento.
// Os valores vêm de variáveis de ambiente (definidas no docker-compose.yml
// ou no arquivo .env). Se não existirem, usa os valores padrão abaixo.
module.exports = {
  port: Number(process.env.PORT || 3000),

  // Banco de dados exclusivo do serviço de pagamento
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/payment_db',

  // Endereço do RabbitMQ (sistema de mensageria)
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672',

  // Exchange do tipo "topic" onde o pagamento publica os seus eventos
  // (transacao.recebida e transacao.confirmada). O pagamento não sabe
  // quem vai consumir: cada serviço interessado liga a sua própria fila.
  eventsExchange: process.env.EVENTS_EXCHANGE || 'comprefacil.eventos',

  // Fila interna do próprio serviço de pagamento, usada para processar
  // (confirmar) as transações de forma assíncrona
  processingQueue: process.env.PROCESSING_QUEUE || 'pagamentos.processar',

  // Tempo (em milissegundos) que simula o processamento do pagamento,
  // por exemplo a consulta à operadora do cartão
  processingDelayMs: Number(process.env.PROCESSING_DELAY_MS || 5000),

  // Política de novas tentativas quando o processamento falha
  maxAttempts: Number(process.env.MAX_ATTEMPTS || 3),
  retryDelayMs: Number(process.env.RETRY_DELAY_MS || 2000),
};
