// Política de novas tentativas (retry) para mensagens que falharam.
//
// Cada mensagem carrega no cabeçalho "x-tentativas" quantas vezes já foi
// processada. Se ainda não atingiu o limite, ela é reenviada para a mesma
// fila depois de uma espera que dobra a cada tentativa (backoff exponencial:
// 2s, 4s, 8s...). Se atingiu o limite, vai para a fila de erros
// "<nome-da-fila>.dlq" (Dead Letter Queue), para ser analisada depois,
// em vez de ficar voltando para a fila para sempre.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function getAttempt(msg) {
  const headers = (msg.properties && msg.properties.headers) || {};
  return Number(headers['x-tentativas'] || 1);
}

function backoffDelay(attempt, baseDelayMs) {
  return baseDelayMs * 2 ** (attempt - 1);
}

async function retryOrDeadLetter(channel, msg, queue, { maxAttempts, baseDelayMs, error, log = console.log }) {
  const attempt = getAttempt(msg);
  const options = { persistent: true, contentType: 'application/json' };

  if (attempt < maxAttempts) {
    const delay = backoffDelay(attempt, baseDelayMs);
    log(`Falha na tentativa ${attempt}/${maxAttempts}: ${error}. Nova tentativa em ${delay / 1000}s.`);
    await wait(delay);
    channel.sendToQueue(queue, msg.content, { ...options, headers: { 'x-tentativas': attempt + 1 } });
  } else {
    log(`Falha na tentativa ${attempt}/${maxAttempts}: ${error}. Mensagem enviada para a fila de erros "${queue}.dlq".`);
    channel.sendToQueue(`${queue}.dlq`, msg.content, {
      ...options,
      headers: { 'x-tentativas': attempt, 'x-erro': String(error) },
    });
  }

  // Confirma a mensagem original: ela foi reenviada ou guardada na DLQ
  channel.ack(msg);
}

module.exports = { retryOrDeadLetter, getAttempt, backoffDelay };
