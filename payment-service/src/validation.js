// Validação dos dados recebidos em POST /transactions.
// Retorna a lista de erros encontrados (vazia quando está tudo certo).
function validateTransaction(body) {
  const { userId, userEmail, orderNumber, amount } = body || {};
  const errors = [];

  if (!userId) errors.push('userId é obrigatório');
  if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(userEmail))) errors.push('userEmail inválido');
  if (!orderNumber) errors.push('orderNumber é obrigatório');
  if (!(Number(amount) > 0)) errors.push('amount deve ser um número maior que zero');

  return errors;
}

module.exports = { validateTransaction };
