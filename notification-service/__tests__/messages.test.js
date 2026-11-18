const { buildMessage } = require('../src/messages');

describe('buildMessage', () => {
  const transacao = { orderNumber: 'PED-1001', amount: 259.9 };

  test('monta a mensagem de recebimento com o pedido e o valor em reais', () => {
    const texto = buildMessage('TRANSACAO_RECEBIDA', transacao);
    expect(texto).toContain('Recebemos a sua solicitação');
    expect(texto).toContain('PED-1001');
    expect(texto).toMatch(/R\$\s259,90/);
  });

  test('monta a mensagem de confirmação', () => {
    const texto = buildMessage('TRANSACAO_CONFIRMADA', transacao);
    expect(texto).toContain('Pagamento confirmado');
  });

  test('retorna null para um evento desconhecido', () => {
    expect(buildMessage('OUTRO_EVENTO', transacao)).toBeNull();
  });
});
