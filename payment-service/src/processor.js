// Interface AMQP do serviço de pagamento: consome a fila interna
// "pagamentos.processar" e confirma as transações pendentes.
const config = require('./config');
const db = require('./db');
const { getChannel } = require('./rabbitmq');
const { EVENTS, notify } = require('./notifications');
const { retryOrDeadLetter } = require('./retry');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Regra de negócio do processamento, separada do RabbitMQ para poder
// ser testada sozinha (ver __tests__/processor.test.js).
// Retorna "CONFIRMADA" ou "IGNORADA".
async function handleProcessingMessage({ transactionId }, deps) {
  if (!transactionId) throw new Error('Mensagem sem transactionId');

  // Simula o tempo de processamento junto à operadora do cartão
  await deps.wait(deps.delayMs);

  // Passo IV: confirma a transação e atualiza o status para SUCESSO
  const confirmed = await deps.db.confirmTransaction(transactionId);

  if (!confirmed) {
    // Já estava confirmada ou não existe: não faz nada de novo
    return 'IGNORADA';
  }

  // Passo V: publica o evento para o serviço de notificação
  deps.notify(EVENTS.CONFIRMADA, confirmed);
  return 'CONFIRMADA';
}

async function startProcessor() {
  const channel = getChannel();

  // Processa uma mensagem por vez
  channel.prefetch(1);

  await channel.consume(config.processingQueue, async (msg) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());
      console.log(`[pagamento] Processando transação ${payload.transactionId}...`);

      const result = await handleProcessingMessage(payload, {
        db,
        notify,
        wait,
        delayMs: config.processingDelayMs,
      });

      if (result === 'CONFIRMADA') {
        console.log(`[pagamento] Transação ${payload.transactionId} confirmada (status SUCESSO)`);
      } else {
        console.log(`[pagamento] Transação ${payload.transactionId} já estava confirmada ou não existe. Nada a fazer.`);
      }

      // Confirma ao RabbitMQ que a mensagem foi tratada (ack)
      channel.ack(msg);
    } catch (err) {
      // Tenta de novo até o limite; depois envia para a fila de erros
      await retryOrDeadLetter(channel, msg, config.processingQueue, {
        maxAttempts: config.maxAttempts,
        baseDelayMs: config.retryDelayMs,
        error: err.message,
        log: (text) => console.error(`[pagamento] ${text}`),
      });
    }
  });

  console.log(`[pagamento] Aguardando transações na fila "${config.processingQueue}"`);
}

module.exports = { startProcessor, handleProcessingMessage };
