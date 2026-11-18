// Testes unitários do consumidor de notificações.
// O banco e o envio de e-mail são substituídos por funções falsas do Jest.
const { handleNotification } = require('../src/consumer');

const transacao = {
  id: 'abc-123',
  userId: '10',
  userEmail: 'cliente@teste.com.br',
  orderNumber: 'PED-1001',
  amount: 259.9,
};

function criarDependencias({ jaExistia }) {
  return {
    db: { saveNotification: jest.fn().mockResolvedValue(jaExistia ? null : { id: 'n-1' }) },
    send: jest.fn(),
  };
}

describe('handleNotification', () => {
  test('registra e envia a notificação de recebimento ao e-mail do usuário', async () => {
    const deps = criarDependencias({ jaExistia: false });

    const resultado = await handleNotification({ event: 'TRANSACAO_RECEBIDA', transaction: transacao }, deps);

    expect(resultado).toBe('ENVIADA');
    expect(deps.db.saveNotification).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 'abc-123', type: 'TRANSACAO_RECEBIDA' })
    );
    expect(deps.send).toHaveBeenCalledWith('cliente@teste.com.br', expect.stringContaining('PED-1001'));
  });

  test('não envia de novo quando a mensagem chega repetida', async () => {
    const deps = criarDependencias({ jaExistia: true });

    const resultado = await handleNotification({ event: 'TRANSACAO_CONFIRMADA', transaction: transacao }, deps);

    expect(resultado).toBe('DUPLICADA');
    expect(deps.send).not.toHaveBeenCalled();
  });

  test('descarta eventos que o serviço não conhece', async () => {
    const deps = criarDependencias({ jaExistia: false });

    const resultado = await handleNotification({ event: 'OUTRO_EVENTO', transaction: transacao }, deps);

    expect(resultado).toBe('DESCONHECIDA');
    expect(deps.db.saveNotification).not.toHaveBeenCalled();
  });

  test('gera erro quando a mensagem não tem os dados da transação', async () => {
    const deps = criarDependencias({ jaExistia: false });

    await expect(handleNotification({ event: 'TRANSACAO_RECEBIDA' }, deps)).rejects.toThrow();
  });
});
