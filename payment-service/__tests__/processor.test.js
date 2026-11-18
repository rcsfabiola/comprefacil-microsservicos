// Testes unitários do processador de pagamentos.
// O banco de dados e a publicação de eventos são substituídos por
// "dublês" (funções falsas do Jest), então o teste não precisa de
// Postgres nem de RabbitMQ rodando.
const { handleProcessingMessage } = require('../src/processor');
const { EVENTS } = require('../src/notifications');

function criarDependencias({ resultadoDoBanco }) {
  return {
    db: { confirmTransaction: jest.fn().mockResolvedValue(resultadoDoBanco) },
    notify: jest.fn(),
    wait: jest.fn().mockResolvedValue(),
    delayMs: 5000,
  };
}

describe('handleProcessingMessage', () => {
  const transacaoConfirmada = { id: 'abc-123', status: 'SUCESSO', orderNumber: 'PED-1001' };

  test('confirma a transação pendente e publica o evento TRANSACAO_CONFIRMADA', async () => {
    const deps = criarDependencias({ resultadoDoBanco: transacaoConfirmada });

    const resultado = await handleProcessingMessage({ transactionId: 'abc-123' }, deps);

    expect(resultado).toBe('CONFIRMADA');
    expect(deps.wait).toHaveBeenCalledWith(5000);
    expect(deps.db.confirmTransaction).toHaveBeenCalledWith('abc-123');
    expect(deps.notify).toHaveBeenCalledWith(EVENTS.CONFIRMADA, transacaoConfirmada);
  });

  test('não publica nada se a transação já estava confirmada (mensagem repetida)', async () => {
    const deps = criarDependencias({ resultadoDoBanco: null });

    const resultado = await handleProcessingMessage({ transactionId: 'abc-123' }, deps);

    expect(resultado).toBe('IGNORADA');
    expect(deps.notify).not.toHaveBeenCalled();
  });

  test('gera erro quando a mensagem não tem transactionId', async () => {
    const deps = criarDependencias({ resultadoDoBanco: null });

    await expect(handleProcessingMessage({}, deps)).rejects.toThrow('Mensagem sem transactionId');
    expect(deps.db.confirmTransaction).not.toHaveBeenCalled();
  });

  test('o evento de confirmação usa a chave de roteamento transacao.confirmada', () => {
    expect(EVENTS.CONFIRMADA.routingKey).toBe('transacao.confirmada');
    expect(EVENTS.RECEBIDA.routingKey).toBe('transacao.recebida');
  });
});
