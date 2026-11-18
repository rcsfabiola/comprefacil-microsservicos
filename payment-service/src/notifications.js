// Publica os eventos de transação na exchange "comprefacil.eventos".
// O serviço de notificação recebe esses eventos porque ligou a sua fila
// à exchange com o padrão "transacao.#".
const { publishEvent } = require('./rabbitmq');

// Cada evento tem um nome (lido pelo consumidor) e uma chave de
// roteamento (usada pela exchange para decidir para quais filas enviar)
const EVENTS = {
  RECEBIDA: { name: 'TRANSACAO_RECEBIDA', routingKey: 'transacao.recebida' },
  CONFIRMADA: { name: 'TRANSACAO_CONFIRMADA', routingKey: 'transacao.confirmada' },
};

function notify(event, transaction) {
  const message = {
    event: event.name,
    sentAt: new Date().toISOString(),
    transaction,
  };
  publishEvent(event.routingKey, message);
  console.log(`[pagamento] Evento ${event.name} publicado com a chave "${event.routingKey}" (transação ${transaction.id})`);
}

module.exports = { EVENTS, notify };
