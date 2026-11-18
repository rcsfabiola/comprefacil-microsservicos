// Interface AMQP do serviço de pagamento: consome a fila interna
// "pagamentos.processar" e confirma as transações pendentes.
const config = require('./config');
const db = require('./db');
const { getChannel } = require('./rabbitmq');
const { EVENTS, notify } = require('./notifications');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function startProcessor() {
  const channel = getChannel();

  // Processa uma mensagem por vez
  channel.prefetch(1);

  await channel.consume(config.processingQueue, async (msg) => {
    if (!msg) return;

    try {
      const { transactionId } = JSON.parse(msg.content.toString());
      console.log(`[pagamento] Processando transação ${transactionId}...`);

      // Simula o tempo de processamento junto à operadora do cartão
      await wait(config.processingDelayMs);

      // Passo IV: confirma a transação e atualiza o status para SUCESSO
      const confirmed = await db.confirmTransaction(transactionId);

      if (confirmed) {
        console.log(`[pagamento] Transação ${transactionId} confirmada (status SUCESSO)`);

        // Passo V: publica mensagem para o serviço de notificação
        notify(EVENTS.CONFIRMADA, confirmed);
      } else {
        console.log(`[pagamento] Transação ${transactionId} já estava confirmada ou não existe. Nada a fazer.`);
      }

      // Confirma ao RabbitMQ que a mensagem foi tratada (ack)
      channel.ack(msg);
    } catch (err) {
      console.error('[pagamento] Erro ao processar transação:', err.message);
      // Espera 2 segundos e devolve a mensagem para a fila, para tentar de novo
      await wait(2000);
      channel.nack(msg, false, true);
    }
  });

  console.log(`[pagamento] Aguardando transações na fila "${config.processingQueue}"`);
}

module.exports = { startProcessor };
