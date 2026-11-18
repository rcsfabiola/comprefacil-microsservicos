// Interface AMQP do serviço de notificação: lê a fila "notificacoes"
// e envia a notificação ao usuário (passos III e VI do fluxo).
const config = require('./config');
const db = require('./db');
const { getChannel } = require('./rabbitmq');

// Texto da notificação para cada tipo de evento
function buildMessage(event, t) {
  const valor = Number(t.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  switch (event) {
    case 'TRANSACAO_RECEBIDA':
      return `Olá! Recebemos a sua solicitação de pagamento do pedido ${t.orderNumber}, no valor de ${valor}. Ela está sendo processada.`;
    case 'TRANSACAO_CONFIRMADA':
      return `Pagamento confirmado! O pagamento do pedido ${t.orderNumber}, no valor de ${valor}, foi aprovado. Obrigado por comprar na CompreFácil.`;
    default:
      return null;
  }
}

// Simula o envio da notificação (por exemplo, um e-mail).
// Em produção, aqui entraria a integração com um provedor de e-mail ou SMS.
function sendNotification(destination, text) {
  console.log(`[notificacao] >>> Enviando e-mail para ${destination}: "${text}"`);
}

async function startConsumer() {
  const channel = getChannel();
  channel.prefetch(1);

  await channel.consume(config.notificationQueue, async (msg) => {
    if (!msg) return;

    try {
      const { event, transaction } = JSON.parse(msg.content.toString());
      console.log(`[notificacao] Mensagem ${event} lida da fila (transação ${transaction.id})`);

      const text = buildMessage(event, transaction);
      if (!text) {
        console.log(`[notificacao] Evento desconhecido "${event}". Mensagem descartada.`);
        return channel.ack(msg);
      }

      // Registra a notificação; se ela já existir, não envia de novo
      const saved = await db.saveNotification({
        transactionId: transaction.id,
        userId: transaction.userId,
        destination: transaction.userEmail,
        type: event,
        message: text,
      });

      if (saved) {
        sendNotification(transaction.userEmail, text);
      } else {
        console.log('[notificacao] Notificação já enviada anteriormente. Ignorando mensagem repetida.');
      }

      channel.ack(msg);
    } catch (err) {
      console.error('[notificacao] Erro ao processar mensagem:', err.message);
      // Espera 2 segundos e devolve a mensagem para a fila, para tentar de novo
      await new Promise((r) => setTimeout(r, 2000));
      channel.nack(msg, false, true);
    }
  });

  console.log(`[notificacao] Aguardando mensagens na fila "${config.notificationQueue}"`);
}

module.exports = { startConsumer };
