// Interface AMQP do serviço de notificação: lê a fila "notificacoes"
// e envia a notificação ao usuário (passos III e VI do fluxo).
const config = require('./config');
const db = require('./db');
const { getChannel } = require('./rabbitmq');
const { buildMessage } = require('./messages');
const { retryOrDeadLetter } = require('./retry');

// Simula o envio da notificação (por exemplo, um e-mail).
// Em produção, aqui entraria a integração com um provedor de e-mail ou SMS.
function sendNotification(destination, text) {
  console.log(`[notificacao] >>> Enviando e-mail para ${destination}: "${text}"`);
}

// Regra de negócio do consumidor, separada do RabbitMQ para poder ser
// testada sozinha (ver __tests__/consumer.test.js).
// Retorna "ENVIADA", "DUPLICADA" ou "DESCONHECIDA".
async function handleNotification({ event, transaction }, deps) {
  if (!transaction || !transaction.id) throw new Error('Mensagem sem dados da transação');

  const text = buildMessage(event, transaction);
  if (!text) return 'DESCONHECIDA';

  // Registra a notificação; se ela já existir, não envia de novo
  const saved = await deps.db.saveNotification({
    transactionId: transaction.id,
    userId: transaction.userId,
    destination: transaction.userEmail,
    type: event,
    message: text,
  });

  if (!saved) return 'DUPLICADA';

  deps.send(transaction.userEmail, text);
  return 'ENVIADA';
}

async function startConsumer() {
  const channel = getChannel();
  channel.prefetch(1);

  await channel.consume(config.notificationQueue, async (msg) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());
      console.log(`[notificacao] Evento ${payload.event} recebido com a chave "${msg.fields.routingKey}"`);

      const result = await handleNotification(payload, { db, send: sendNotification });

      if (result === 'DESCONHECIDA') {
        console.log(`[notificacao] Evento desconhecido "${payload.event}". Mensagem descartada.`);
      } else if (result === 'DUPLICADA') {
        console.log('[notificacao] Notificação já enviada anteriormente. Ignorando mensagem repetida.');
      }

      channel.ack(msg);
    } catch (err) {
      // Tenta de novo até o limite; depois envia para a fila de erros
      await retryOrDeadLetter(channel, msg, config.notificationQueue, {
        maxAttempts: config.maxAttempts,
        baseDelayMs: config.retryDelayMs,
        error: err.message,
        log: (text) => console.error(`[notificacao] ${text}`),
      });
    }
  });

  console.log(`[notificacao] Aguardando mensagens na fila "${config.notificationQueue}"`);
}

module.exports = { startConsumer, handleNotification, sendNotification };
