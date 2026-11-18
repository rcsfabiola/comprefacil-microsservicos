// Ponto de entrada do serviço de notificação.
const express = require('express');
const config = require('./config');
const db = require('./db');
const { connectRabbitMQ } = require('./rabbitmq');
const { startConsumer } = require('./consumer');
const routes = require('./routes');

async function waitForDatabase(attempts = 15) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await db.initDatabase();
      console.log('[notificacao] Banco de dados pronto');
      return;
    } catch (err) {
      console.log(`[notificacao] Banco indisponível (tentativa ${i}/${attempts}). Tentando de novo em 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('Não foi possível conectar ao banco de dados');
}

async function main() {
  await waitForDatabase();
  await connectRabbitMQ();
  await startConsumer();

  const app = express();
  app.use(express.json());
  app.use(routes);

  const server = app.listen(config.port, () => {
    console.log(`[notificacao] API REST disponível em http://localhost:${config.port}`);
  });

  // Desligamento limpo: ao receber o sinal de parada (docker compose stop,
  // Ctrl + C), para de aceitar requisições, fecha o banco e encerra.
  // Uma mensagem que estava sendo tratada não é confirmada ao RabbitMQ
  // (ack) e volta para a fila, sendo tratada quando o serviço voltar.
  const shutdown = (signal) => {
    console.log(`[notificacao] Sinal ${signal} recebido. Encerrando o serviço...`);
    server.close();
    db.pool.end().finally(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[notificacao] Falha ao iniciar:', err.message);
  process.exit(1);
});
