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

      // Filas duráveis: as mensagens ficam guardadas mesmo que o
      // serviço que vai lê-las esteja fora do ar.
      await channel.assertQueue(config.notificationQueue, { durable: true });
      await channel.assertQueue(config.processingQueue, { durable: true });

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

// Publica uma mensagem em uma fila. "persistent: true" grava a mensagem
// em disco no RabbitMQ, para não perdê-la se ele reiniciar.
function publish(queue, message) {
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
    persistent: true,
    contentType: 'application/json',
  });
}

function getChannel() {
  return channel;
}

module.exports = { connectRabbitMQ, publish, getChannel };
