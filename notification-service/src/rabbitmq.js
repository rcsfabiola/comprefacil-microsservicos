// Conexão com o RabbitMQ (protocolo AMQP).
const amqp = require('amqplib');
const config = require('./config');

let channel;

async function connectRabbitMQ(attempts = 15) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const connection = await amqp.connect(config.rabbitmqUrl);
      channel = await connection.createChannel();
      await channel.assertQueue(config.notificationQueue, { durable: true });

      connection.on('close', () => {
        console.error('[notificacao] Conexão com o RabbitMQ encerrada. Encerrando o serviço.');
        process.exit(1);
      });

      console.log('[notificacao] Conectado ao RabbitMQ');
      return channel;
    } catch (err) {
      console.log(`[notificacao] RabbitMQ indisponível (tentativa ${i}/${attempts}). Tentando de novo em 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('Não foi possível conectar ao RabbitMQ');
}

function getChannel() {
  return channel;
}

module.exports = { connectRabbitMQ, getChannel };
