# CompreFácil – Microsserviços de Pagamento e Notificação

Desafio da Unidade Curricular **Desenvolvimento de Sistemas Distribuídos**
Curso Superior de Tecnologia em Análise e Desenvolvimento de Sistemas – UniSENAI SC
Autoras: Daiane Olete da Silva Maniçoba e Fabíola Reginaldo Corrêa da Silva

Este projeto implementa dois microsserviços independentes em **Node.js**, que se comunicam de forma **assíncrona** por meio do **RabbitMQ** (protocolo AMQP):

| Serviço | Porta | Interfaces | Responsabilidade |
| --- | --- | --- | --- |
| `payment-service` | 3000 | REST + AMQP | Recebe a solicitação de transação, grava no banco, processa e confirma o pagamento |
| `notification-service` | 3001 | REST + AMQP | Recebe os eventos de transação e notifica o usuário sobre o recebimento e a confirmação |

A infraestrutura (PostgreSQL e RabbitMQ) é criada com **docker-compose**. Cada serviço tem o **seu próprio banco de dados** (`payment_db` e `notification_db`).

## Arquitetura

```mermaid
flowchart LR
    U[Cliente] -->|"POST /transactions (REST)"| P[payment-service<br/>porta 3000]
    P --- DBP[(payment_db)]
    P -->|"envia"| QP[["fila<br/>pagamentos.processar"]]
    QP -->|"consome (AMQP)"| P
    P -->|"publica eventos<br/>transacao.recebida<br/>transacao.confirmada"| EX{{"exchange topic<br/>comprefacil.eventos"}}
    EX -->|"binding transacao.#"| QN[["fila<br/>notificacoes"]]
    QN -->|"consome (AMQP)"| N[notification-service<br/>porta 3001]
    N --- DBN[(notification_db)]
    N -->|"e-mail (simulado)"| U
```

O pagamento **não publica direto na fila da notificação**. Ele publica os eventos numa *exchange* do tipo `topic`, com uma chave de roteamento (`transacao.recebida` ou `transacao.confirmada`). O serviço de notificação liga (*binding*) a sua própria fila a essa exchange com o padrão `transacao.#`, que recebe qualquer evento de transação. Assim, o pagamento não precisa saber quem consome os eventos: no futuro, um serviço de logística ou de relatórios pode criar a sua fila e assinar os mesmos eventos **sem nenhuma alteração no pagamento**.

## Fluxo de processamento (assíncrono)

Ao receber `POST /transactions`, o serviço de pagamento responde na hora com **HTTP 202 (Accepted)** e o restante acontece em segundo plano:

| Passo | O que acontece | Onde está no código |
| --- | --- | --- |
| I | O pagamento grava a transação com status **PENDENTE** | `payment-service/src/routes.js` → `db.createTransaction` |
| II | O pagamento publica o evento `TRANSACAO_RECEBIDA` (chave `transacao.recebida`) | `payment-service/src/routes.js` → `notify(...)` |
| III | A notificação recebe o evento e avisa o usuário do recebimento | `notification-service/src/consumer.js` |
| IV | O pagamento processa a transação (fila interna `pagamentos.processar`) e muda o status para **SUCESSO** | `payment-service/src/processor.js` → `db.confirmTransaction` |
| V | O pagamento publica o evento `TRANSACAO_CONFIRMADA` (chave `transacao.confirmada`) | `payment-service/src/processor.js` → `notify(...)` |
| VI | A notificação recebe o evento e avisa o usuário da confirmação | `notification-service/src/consumer.js` |

O processamento do pagamento é simulado com uma espera de 5 segundos (variável `PROCESSING_DELAY_MS`), representando a consulta à operadora do cartão. O envio do e-mail é simulado com uma mensagem no log do serviço de notificação e fica registrado no banco `notification_db`.

## Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e aberto (já inclui o docker-compose).

Para rodar sem Docker ou executar os testes, é preciso também o [Node.js](https://nodejs.org/) 18 ou superior.

## Como executar

1. Clone o repositório e entre na pasta:

   ```bash
   git clone <URL-DESTE-REPOSITORIO>
   cd comprefacil-microsservicos
   ```

2. Suba toda a estrutura (Postgres, RabbitMQ e os dois serviços):

   ```bash
   docker compose up --build
   ```

   Aguarde até aparecerem no terminal as mensagens:

   ```
   [pagamento] API REST disponível em http://localhost:3000
   [notificacao] API REST disponível em http://localhost:3001
   ```

3. Para encerrar: `Ctrl + C` e depois `docker compose down`.

## Como testar o fluxo

### 1. Enviar uma solicitação de transação

**Linux / macOS / Git Bash:**

```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"userId":"10","userEmail":"cliente@teste.com.br","orderNumber":"PED-1001","amount":259.90}'
```

**Windows (PowerShell):**

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/transactions `
  -ContentType "application/json" `
  -Body '{"userId":"10","userEmail":"cliente@teste.com.br","orderNumber":"PED-1001","amount":259.90}'
```

**Thunder Client (extensão do VS Code), Postman ou Insomnia:**

- Método: `POST`
- URL: `http://localhost:3000/transactions`
- Em **Body**, selecionar **JSON** e enviar:

```json
{
  "userId": "10",
  "userEmail": "cliente@teste.com.br",
  "orderNumber": "PED-1001",
  "amount": 259.90
}
```

Resposta esperada (HTTP 202), com o status ainda **PENDENTE**:

```json
{
  "message": "Solicitação de transação recebida. O pagamento será processado.",
  "transaction": {
    "id": "72c499e5-ac9f-4fb8-8795-900c6b04104f",
    "userId": "10",
    "userEmail": "cliente@teste.com.br",
    "orderNumber": "PED-1001",
    "amount": 259.9,
    "status": "PENDENTE"
  }
}
```

### 2. Acompanhar o status da transação

Logo após o envio o status é `PENDENTE`; depois de cerca de 5 segundos passa a ser `SUCESSO`:

```bash
curl http://localhost:3000/transactions/<id-da-transacao>
```

### 3. Ver as notificações enviadas ao usuário

```bash
curl "http://localhost:3001/notifications?userId=10"
```

Devem aparecer duas notificações: `TRANSACAO_RECEBIDA` e `TRANSACAO_CONFIRMADA`.

### 4. Acompanhar pelos logs

No terminal do `docker compose up`, o fluxo aparece assim:

```
[pagamento] Transação 72c4... recebida e gravada (status PENDENTE)
[pagamento] Evento TRANSACAO_RECEBIDA publicado com a chave "transacao.recebida"
[notificacao] Evento TRANSACAO_RECEBIDA recebido com a chave "transacao.recebida"
[notificacao] >>> Enviando e-mail para cliente@teste.com.br: "Olá! Recebemos a sua solicitação de pagamento do pedido PED-1001, no valor de R$ 259,90. Ela está sendo processada."
[pagamento] Processando transação 72c4...
[pagamento] Evento TRANSACAO_CONFIRMADA publicado com a chave "transacao.confirmada"
[pagamento] Transação 72c4... confirmada (status SUCESSO)
[notificacao] Evento TRANSACAO_CONFIRMADA recebido com a chave "transacao.confirmada"
[notificacao] >>> Enviando e-mail para cliente@teste.com.br: "Pagamento confirmado! O pagamento do pedido PED-1001, no valor de R$ 259,90, foi aprovado. Obrigado por comprar na CompreFácil."
```

### 5. Painel do RabbitMQ

Acesse http://localhost:15673 (usuário `admin`, senha `admin`):

- aba **Exchanges** → `comprefacil.eventos` (tipo `topic`) e, em *Bindings*, a ligação com a fila `notificacoes` pela chave `transacao.#`;
- aba **Queues** → `notificacoes`, `pagamentos.processar` e as filas de erros `*.dlq`.

## Demonstração da independência dos serviços

Os serviços não se chamam diretamente: só trocam mensagens pelo RabbitMQ. Para comprovar:

```bash
# 1. Desligue apenas o serviço de notificação
docker compose stop notification-service

# 2. Envie uma transação: o pagamento continua funcionando e chega a SUCESSO
curl -X POST http://localhost:3000/transactions -H "Content-Type: application/json" \
  -d '{"userId":"20","userEmail":"outro@teste.com.br","orderNumber":"PED-2002","amount":89.50}'

# 3. No painel do RabbitMQ, a fila "notificacoes" mostra 2 mensagens aguardando

# 4. Ligue o serviço de notificação de novo
docker compose start notification-service
```

Ao voltar, o serviço de notificação lê as mensagens que ficaram guardadas na fila e envia as duas notificações. Nenhuma mensagem é perdida, porque as filas são **duráveis** e as mensagens são **persistentes**.

> A fila `notificacoes` e a sua ligação com a exchange são criadas pelo serviço de notificação ao iniciar. Por isso, ele precisa ter sido iniciado ao menos uma vez (o `docker compose up` já faz isso) antes de ser desligado para o teste.

## Resiliência: novas tentativas e fila de erros

Quando o processamento de uma mensagem falha (por exemplo, o banco de dados está fora do ar), o consumidor **não descarta a mensagem nem a devolve para a fila indefinidamente**:

1. A mensagem é reenviada para a mesma fila, com o número da tentativa no cabeçalho `x-tentativas`.
2. A espera entre as tentativas dobra a cada vez (**backoff exponencial**: 2s, 4s...).
3. Depois da 3ª tentativa, a mensagem vai para a **fila de erros** (*Dead Letter Queue*): `notificacoes.dlq` ou `pagamentos.processar.dlq`, com o motivo da falha no cabeçalho `x-erro`, para ser analisada e reprocessada depois.

A quantidade de tentativas e a espera inicial são configuradas por `MAX_ATTEMPTS` e `RETRY_DELAY_MS`. A lógica está em `src/retry.js` de cada serviço.

Os dois serviços não fazem chamadas HTTP um ao outro (toda a comunicação entre eles é assíncrona), por isso não foi necessário um *circuit breaker* entre eles: se um serviço cai, o outro continua funcionando e as mensagens esperam na fila.

## Testes automatizados

Cada serviço tem testes unitários com **Jest**, na pasta `__tests__`. Os testes substituem o banco de dados e o RabbitMQ por funções falsas (*mocks*), então rodam sem precisar do Docker:

```bash
cd payment-service
npm install
npm test
```

```bash
cd notification-service
npm install
npm test
```

| Serviço | Arquivo | O que é testado |
| --- | --- | --- |
| pagamento | `validation.test.js` | Validação dos dados da transação (e-mail, valor, campos obrigatórios) |
| pagamento | `processor.test.js` | Confirmação da transação e publicação do evento; mensagem repetida não gera nova notificação |
| pagamento | `retry.test.js` | Contagem de tentativas, backoff exponencial e envio para a fila de erros |
| notificação | `messages.test.js` | Texto das notificações, com valor em reais |
| notificação | `consumer.test.js` | Envio da notificação, proteção contra mensagens repetidas e eventos desconhecidos |

Resultado: 19 testes, todos passando.

## Endpoints

### payment-service (porta 3000)

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/transactions` | Solicita uma transação. Corpo: `userId`, `userEmail`, `orderNumber`, `amount` |
| GET | `/transactions/:id` | Consulta uma transação (status `PENDENTE` ou `SUCESSO`) |
| GET | `/transactions` | Lista as últimas transações |
| GET | `/` | Mostra que o serviço está no ar e lista as rotas |
| GET | `/health` | Verifica se o serviço está no ar |

### notification-service (porta 3001)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/notifications` | Lista as notificações enviadas. Filtros opcionais: `?userId=` e `?transactionId=` |
| GET | `/` | Mostra que o serviço está no ar e lista as rotas |
| GET | `/health` | Verifica se o serviço está no ar |

### Eventos AMQP (exchange `comprefacil.eventos`)

| Evento | Chave de roteamento | Publicado no passo |
| --- | --- | --- |
| `TRANSACAO_RECEBIDA` | `transacao.recebida` | II |
| `TRANSACAO_CONFIRMADA` | `transacao.confirmada` | V |

Formato da mensagem:

```json
{
  "event": "TRANSACAO_RECEBIDA",
  "sentAt": "2026-11-18T17:29:24.720Z",
  "transaction": {
    "id": "72c499e5-ac9f-4fb8-8795-900c6b04104f",
    "userId": "10",
    "userEmail": "cliente@teste.com.br",
    "orderNumber": "PED-1001",
    "amount": 259.9,
    "status": "PENDENTE"
  }
}
```

## Decisões técnicas

- **Comunicação assíncrona:** o cliente recebe a resposta (HTTP 202) sem esperar o processamento nem o envio das notificações.
- **Exchange do tipo topic:** o produtor publica eventos sem conhecer os consumidores; novos serviços podem assinar os eventos sem alterar o pagamento.
- **Banco de dados por serviço:** `payment_db` pertence só ao pagamento e `notification_db` só à notificação. Um serviço nunca acessa o banco do outro.
- **Filas duráveis e mensagens persistentes:** as mensagens não se perdem se um serviço estiver fora do ar.
- **Confirmação manual (ack):** a mensagem só sai da fila depois de tratada.
- **Novas tentativas com backoff e fila de erros (DLQ):** falhas temporárias são tentadas de novo; falhas permanentes vão para análise, sem travar a fila.
- **Proteção contra duplicidade (idempotência):** a confirmação só altera transações que ainda estão `PENDENTE`, e a tabela de notificações tem uma restrição `UNIQUE (transaction_id, type)`. Assim, se uma mensagem chegar repetida, o usuário não recebe a mesma notificação duas vezes.
- **Reconexão na inicialização:** os serviços tentam conectar ao banco e ao RabbitMQ várias vezes, porque esses containers podem demorar alguns segundos para ficar prontos.
- **Desligamento limpo:** ao receber o sinal de parada (`docker compose stop` ou `Ctrl + C`), cada serviço fecha as conexões e encerra. Uma mensagem que estava em processamento não recebe `ack` e volta para a fila, sendo tratada quando o serviço voltar.
- **Portas sem conflito:** o Postgres não expõe porta no computador, e o RabbitMQ usa as portas 5673 e 15673 (em vez das padrão 5672 e 15672). Assim o projeto sobe mesmo em máquinas que já têm PostgreSQL ou RabbitMQ instalados.

## Executar sem Docker (opcional)

É preciso um PostgreSQL rodando no computador, com os bancos `payment_db` e `notification_db` criados (o script `docker/postgres/01-criar-bancos.sql` faz isso), e o RabbitMQ (pode ser só ele via `docker compose up rabbitmq`):

```bash
cd payment-service
npm install
npm start
```

Em outro terminal:

```bash
cd notification-service
npm install
npm start
```

As configurações padrão estão nos arquivos `.env.example` de cada serviço.

> No docker-compose, o Postgres **não expõe porta no computador**: só os dois serviços, pela rede interna do Docker, acessam o banco. Isso evita conflito com um PostgreSQL que já esteja instalado na máquina (porta 5432 ocupada). Se usar o RabbitMQ do docker-compose com os serviços rodando fora do Docker, use `RABBITMQ_URL=amqp://admin:admin@localhost:5673`.

## Estrutura do projeto

```
comprefacil-microsservicos/
├── docker-compose.yml          # Postgres, RabbitMQ e os dois serviços
├── docker/postgres/            # script que cria payment_db e notification_db
├── payment-service/
│   ├── Dockerfile
│   ├── package.json
│   ├── __tests__/              # testes unitários (Jest)
│   └── src/
│       ├── index.js            # inicialização do serviço
│       ├── config.js           # variáveis de ambiente
│       ├── db.js               # acesso ao banco payment_db
│       ├── rabbitmq.js         # conexão AMQP, exchange e filas
│       ├── notifications.js    # publicação dos eventos de transação
│       ├── validation.js       # validação dos dados recebidos
│       ├── routes.js           # interface REST
│       ├── processor.js        # interface AMQP: processa e confirma a transação
│       └── retry.js            # novas tentativas e fila de erros
└── notification-service/
    ├── Dockerfile
    ├── package.json
    ├── __tests__/              # testes unitários (Jest)
    └── src/
        ├── index.js            # inicialização do serviço
        ├── config.js           # variáveis de ambiente
        ├── db.js               # acesso ao banco notification_db
        ├── rabbitmq.js         # conexão AMQP e ligação da fila à exchange
        ├── messages.js         # texto das notificações
        ├── consumer.js         # interface AMQP: recebe o evento e envia a notificação
        ├── retry.js            # novas tentativas e fila de erros
        └── routes.js           # interface REST
```

## Tecnologias

Node.js 20, Express 5, amqplib 2, node-postgres (pg), Jest, PostgreSQL 16, RabbitMQ 3 e Docker Compose.
