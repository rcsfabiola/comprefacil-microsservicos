const { validateTransaction } = require('../src/validation');

describe('validateTransaction', () => {
  const valida = {
    userId: '10',
    userEmail: 'cliente@teste.com.br',
    orderNumber: 'PED-1001',
    amount: 259.9,
  };

  test('aceita uma transação com todos os dados corretos', () => {
    expect(validateTransaction(valida)).toEqual([]);
  });

  test('recusa e-mail inválido', () => {
    expect(validateTransaction({ ...valida, userEmail: 'cliente' })).toContain('userEmail inválido');
  });

  test('recusa valor zero ou negativo', () => {
    expect(validateTransaction({ ...valida, amount: 0 })).toContain('amount deve ser um número maior que zero');
    expect(validateTransaction({ ...valida, amount: -5 })).toContain('amount deve ser um número maior que zero');
  });

  test('aponta todos os campos que faltam', () => {
    expect(validateTransaction({})).toHaveLength(4);
  });
});
