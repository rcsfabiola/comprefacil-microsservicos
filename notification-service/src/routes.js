// Interface REST do serviço de notificação (consulta das notificações enviadas).
const express = require('express');
const db = require('./db');

const router = express.Router();

// Lista as notificações enviadas.
// Filtros opcionais: ?userId=10 ou ?transactionId=<id>
router.get('/notifications', async (req, res) => {
  try {
    const notifications = await db.listNotifications({
      userId: req.query.userId,
      transactionId: req.query.transactionId,
    });
    res.json(notifications);
  } catch (err) {
    res.status(400).json({ error: 'Filtro inválido' });
  }
});

router.get('/health', (req, res) => {
  res.json({ service: 'notification-service', status: 'ok' });
});

module.exports = router;
