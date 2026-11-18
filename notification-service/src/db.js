// Acesso ao banco de dados PostgreSQL do serviço de notificação.
const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({ connectionString: config.databaseUrl });

// Cria a tabela de notificações, caso ainda não exista.
// A restrição UNIQUE (transaction_id, type) impede que a mesma
// notificação seja registrada duas vezes se a mensagem chegar repetida.
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id  UUID          NOT NULL,
      user_id         VARCHAR(50)   NOT NULL,
      destination     VARCHAR(150)  NOT NULL,
      type            VARCHAR(30)   NOT NULL,
      message         TEXT          NOT NULL,
      sent_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      UNIQUE (transaction_id, type)
    );
  `);
}

// Registra a notificação enviada. Retorna null se ela já existia.
async function saveNotification({ transactionId, userId, destination, type, message }) {
  const result = await pool.query(
    `INSERT INTO notifications (transaction_id, user_id, destination, type, message)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (transaction_id, type) DO NOTHING
     RETURNING *`,
    [transactionId, userId, destination, type, message]
  );
  return result.rows[0] ? toNotification(result.rows[0]) : null;
}

async function listNotifications({ userId, transactionId }) {
  const where = [];
  const params = [];
  if (userId) {
    params.push(userId);
    where.push(`user_id = $${params.length}`);
  }
  if (transactionId) {
    params.push(transactionId);
    where.push(`transaction_id = $${params.length}`);
  }
  const sql = `SELECT * FROM notifications
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY sent_at DESC LIMIT 100`;
  const result = await pool.query(sql, params);
  return result.rows.map(toNotification);
}

function toNotification(row) {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    userId: row.user_id,
    destination: row.destination,
    type: row.type,
    message: row.message,
    sentAt: row.sent_at,
  };
}

module.exports = { pool, initDatabase, saveNotification, listNotifications };
