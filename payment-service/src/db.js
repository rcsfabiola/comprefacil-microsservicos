// Acesso ao banco de dados PostgreSQL do serviço de pagamento.
const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({ connectionString: config.databaseUrl });

// Cria a tabela de transações, caso ainda não exista.
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       VARCHAR(50)    NOT NULL,
      user_email    VARCHAR(150)   NOT NULL,
      order_number  VARCHAR(50)    NOT NULL,
      amount        NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      status        VARCHAR(20)    NOT NULL DEFAULT 'PENDENTE',
      created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    );
  `);
}

// Passo I do fluxo: grava a transação com status PENDENTE.
async function createTransaction({ userId, userEmail, orderNumber, amount }) {
  const result = await pool.query(
    `INSERT INTO transactions (user_id, user_email, order_number, amount, status)
     VALUES ($1, $2, $3, $4, 'PENDENTE')
     RETURNING *`,
    [userId, userEmail, orderNumber, amount]
  );
  return toTransaction(result.rows[0]);
}

// Passo IV do fluxo: confirma a transação, mudando o status para SUCESSO.
// O "AND status = 'PENDENTE'" garante que a mesma transação não seja
// confirmada duas vezes, caso a mensagem seja entregue de novo.
async function confirmTransaction(id) {
  const result = await pool.query(
    `UPDATE transactions
        SET status = 'SUCESSO', updated_at = NOW()
      WHERE id = $1 AND status = 'PENDENTE'
      RETURNING *`,
    [id]
  );
  return result.rows[0] ? toTransaction(result.rows[0]) : null;
}

async function findTransaction(id) {
  const result = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
  return result.rows[0] ? toTransaction(result.rows[0]) : null;
}

async function listTransactions() {
  const result = await pool.query(
    'SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100'
  );
  return result.rows.map(toTransaction);
}

// Converte uma linha do banco (snake_case) para o formato usado na API.
function toTransaction(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    orderNumber: row.order_number,
    amount: Number(row.amount),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  pool,
  initDatabase,
  createTransaction,
  confirmTransaction,
  findTransaction,
  listTransactions,
};
