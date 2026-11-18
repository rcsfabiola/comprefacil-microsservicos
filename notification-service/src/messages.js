// Texto da notificação enviada ao usuário para cada tipo de evento.
function formatCurrency(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildMessage(event, t) {
  const valor = formatCurrency(t.amount);
  switch (event) {
    case 'TRANSACAO_RECEBIDA':
      return `Olá! Recebemos a sua solicitação de pagamento do pedido ${t.orderNumber}, no valor de ${valor}. Ela está sendo processada.`;
    case 'TRANSACAO_CONFIRMADA':
      return `Pagamento confirmado! O pagamento do pedido ${t.orderNumber}, no valor de ${valor}, foi aprovado. Obrigado por comprar na CompreFácil.`;
    default:
      return null;
  }
}

module.exports = { buildMessage, formatCurrency };
