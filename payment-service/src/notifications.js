// Monta e publica as mensagens destinadas ao serviço de notificação.
const config = require('./config');
const { publish } = require('./rabbitmq');

// Tipos de evento que o serviço de notificação sabe tratar
const EVENTS = {
  RECEBIDA: 'TRANSACAO_RECEBIDA',
  CONFIRMADA: 'TRANSACAO_CONFIRMADA',
};

function notify(event, transaction) {
  const message = {
    event,
    sentAt: new Date().toISOString(),
    transaction,
  };
  publish(config.notificationQueue, message);
  console.log(`[pagamento] Mensagem ${event} publicada na fila "${config.notificationQueue}" (transação ${transaction.id})`);
}

module.exports = { EVENTS, notify };
