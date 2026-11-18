// Conexão com o RabbitMQ (protocolo AMQP).
const amqp = require('amqplib');
const config = require('./config');

let channel;

// Tenta conectar várias vezes, porque ao subir com o docker-compose
// o RabbitMQ pode demorar alguns segundos para ficar pronto.
async function connectRabbitMQ(attempts = 15) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const connection = await amqp.connect(config.rabbitmqUrl);
      channel = await connection.createChannel();

      // Exchange do tipo "topic": recebe os eventos e os distribui para
      // as filas ligadas a ela, de acordo com a chave de roteamento.
      await channel.assertExchange(config.eventsExchange, 'topic', { durable: true });

      // Fila interna de processamento e a sua fila de erros (DLQ).
      // Filas duráveis: as mensagens ficam guardadas mesmo que o
      // serviço que vai lê-las esteja fora do ar.
      await channel.assertQueue(config.processingQueue, { durable: true });
      await channel.assertQueue(`${config.processingQueue}.dlq`, { durable: true });

      connection.on('close', () => {
        console.error('[pagamento] Conexão com o RabbitMQ encerrada. Encerrando o serviço.');
        process.exit(1);
      });

      console.log('[pagamento] Conectado ao RabbitMQ');
      return channel;
    } catch (err) {
      console.log(`[pagamento] RabbitMQ indisponível (tentativa ${i}/${attempts}). Tentando de novo em 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('Não foi possível conectar ao RabbitMQ');
}

const messageOptions = { persistent: true, contentType: 'application/json' };

// Publica um evento na exchange, com a chave de roteamento informada
// (ex.: "transacao.recebida"). "persistent: true" grava a mensagem em
// disco no RabbitMQ, para não perdê-la se ele reiniciar.
function publishEvent(routingKey, message) {
  channel.publish(config.eventsExchange, routingKey, Buffer.from(JSON.stringify(message)), messageOptions);
}

// Envia uma mensagem diretamente para uma fila (usado na fila interna).
function sendToQueue(queue, message) {
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), messageOptions);
}

function getChannel() {
  return channel;
}

module.exports = { connectRabbitMQ, publishEvent, sendToQueue, getChannel };
