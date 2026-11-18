// Ponto de entrada do serviço de pagamento.
const express = require('express');
const config = require('./config');
const db = require('./db');
const { connectRabbitMQ } = require('./rabbitmq');
const { startProcessor } = require('./processor');
const routes = require('./routes');

async function waitForDatabase(attempts = 15) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await db.initDatabase();
      console.log('[pagamento] Banco de dados pronto');
      return;
    } catch (err) {
      console.log(`[pagamento] Banco indisponível (tentativa ${i}/${attempts}). Tentando de novo em 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error('Não foi possível conectar ao banco de dados');
}

async function main() {
  await waitForDatabase();
  await connectRabbitMQ();
  await startProcessor();

  const app = express();
  app.use(express.json());
  app.use(routes);

  app.listen(config.port, () => {
    console.log(`[pagamento] API REST disponível em http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('[pagamento] Falha ao iniciar:', err.message);
  process.exit(1);
});
