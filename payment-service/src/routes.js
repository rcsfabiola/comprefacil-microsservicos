// Interface REST do serviço de pagamento.
const express = require('express');
const config = require('./config');
const db = require('./db');
const { sendToQueue } = require('./rabbitmq');
const { EVENTS, notify } = require('./notifications');
const { validateTransaction } = require('./validation');

const router = express.Router();

// Recebe a solicitação de transação.
// Responde na hora com status 202 (Accepted) e o pagamento segue
// sendo processado de forma assíncrona.
router.post('/transactions', async (req, res) => {
  const errors = validateTransaction(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const { userId, userEmail, orderNumber, amount } = req.body;

  try {
    // Passo I: armazena a transação com status PENDENTE
    const transaction = await db.createTransaction({
      userId: String(userId),
      userEmail: String(userEmail),
      orderNumber: String(orderNumber),
      amount: Number(amount),
    });
    console.log(`[pagamento] Transação ${transaction.id} recebida e gravada (status PENDENTE)`);

    // Passo II: publica o evento para o serviço de notificação
    // informar o recebimento da solicitação
    notify(EVENTS.RECEBIDA, transaction);

    // Envia a transação para a fila interna de processamento.
    // A confirmação (passos IV e V) acontece depois, no processor.js.
    sendToQueue(config.processingQueue, { transactionId: transaction.id });

    return res.status(202).json({
      message: 'Solicitação de transação recebida. O pagamento será processado.',
      transaction,
    });
  } catch (err) {
    console.error('[pagamento] Erro ao registrar transação:', err.message);
    return res.status(500).json({ error: 'Erro ao registrar a transação' });
  }
});

// Consulta uma transação pelo id (para acompanhar o status)
router.get('/transactions/:id', async (req, res) => {
  try {
    const transaction = await db.findTransaction(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transação não encontrada' });
    return res.json(transaction);
  } catch (err) {
    return res.status(400).json({ error: 'Id inválido' });
  }
});

// Lista as últimas transações
router.get('/transactions', async (req, res) => {
  const transactions = await db.listTransactions();
  res.json(transactions);
});

// Rota inicial: mostra que o serviço está no ar e quais rotas existem
router.get('/', (req, res) => {
  res.json({
    service: 'payment-service',
    message: 'Serviço de pagamento funcionando!',
    routes: ['POST /transactions', 'GET /transactions', 'GET /transactions/:id', 'GET /health'],
  });
});

// Verificação de saúde do serviço
router.get('/health', (req, res) => {
  res.json({ service: 'payment-service', status: 'ok' });
});

module.exports = router;
