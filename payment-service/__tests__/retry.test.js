// Testes da política de novas tentativas (retry + fila de erros).
const { retryOrDeadLetter, getAttempt, backoffDelay } = require('../src/retry');

function mensagem(tentativa) {
  return {
    content: Buffer.from('{"transactionId":"abc-123"}'),
    properties: { headers: tentativa ? { 'x-tentativas': tentativa } : {} },
  };
}

function canalFalso() {
  return { sendToQueue: jest.fn(), ack: jest.fn() };
}

describe('retry', () => {
  test('a primeira entrega conta como tentativa 1', () => {
    expect(getAttempt(mensagem())).toBe(1);
  });

  test('a espera dobra a cada tentativa (backoff exponencial)', () => {
    expect(backoffDelay(1, 2000)).toBe(2000);
    expect(backoffDelay(2, 2000)).toBe(4000);
    expect(backoffDelay(3, 2000)).toBe(8000);
  });

  test('reenvia para a mesma fila enquanto não atinge o limite', async () => {
    const canal = canalFalso();
    const msg = mensagem(1);

    await retryOrDeadLetter(canal, msg, 'pagamentos.processar', {
      maxAttempts: 3, baseDelayMs: 0, error: 'falha', log: () => {},
    });

    expect(canal.sendToQueue).toHaveBeenCalledWith(
      'pagamentos.processar',
      msg.content,
      expect.objectContaining({ headers: { 'x-tentativas': 2 } })
    );
    expect(canal.ack).toHaveBeenCalledWith(msg);
  });

  test('envia para a fila de erros (DLQ) na última tentativa', async () => {
    const canal = canalFalso();
    const msg = mensagem(3);

    await retryOrDeadLetter(canal, msg, 'pagamentos.processar', {
      maxAttempts: 3, baseDelayMs: 0, error: 'falha', log: () => {},
    });

    expect(canal.sendToQueue).toHaveBeenCalledWith(
      'pagamentos.processar.dlq',
      msg.content,
      expect.objectContaining({ headers: { 'x-tentativas': 3, 'x-erro': 'falha' } })
    );
    expect(canal.ack).toHaveBeenCalledWith(msg);
  });
});
