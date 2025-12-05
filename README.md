# BookSala - Sistema de Agendamento de Salas da Biblioteca UNIFOR

Sistema completo de gerenciamento e reserva de salas da biblioteca desenvolvido com stack moderno (Node.js + Express + React).

## 📋 Sobre o Projeto

Sistema web para agendamento de salas da biblioteca com controle de acesso baseado em papéis (usuário comum e administrador), validações de horários, histórico de reservas e interface responsiva.

## ✨ Funcionalidades

### Autenticação & Autorização

- ✅ Login com matrícula e senha
- ✅ Validação de matrícula: **7-9 dígitos numéricos**
- ✅ Senhas criptografadas com **bcrypt** (salt rounds = 10)
- ✅ Autenticação JWT com token de 8 horas
- ✅ Opção "Lembrar identificação de usuário"
- ✅ Rotas protegidas por middleware de autenticação

### Funcionalidades do Usuário Comum

- ✅ Visualizar salas disponíveis por horário e capacidade
- ✅ Criar nova reserva (data, horário, motivo)
- ✅ Visualizar reservas ativas
- ✅ Editar reservas próprias
- ✅ Cancelar reservas próprias
- ✅ Histórico de reservas com paginação (3 por página)
- ✅ Validações: horário de funcionamento, duração mínima 15min, não permitir horários passados

### Funcionalidades do Administrador

- ✅ Visualizar TODAS as reservas em grid 5×3 (15 por página)
- ✅ Editar qualquer reserva
- ✅ Cancelar qualquer reserva
- ✅ Filtrar por sala específica
- ✅ Buscar por ID/usuário/sala/motivo no histórico
- ✅ Múltiplas reservas no mesmo dia (salas diferentes)

### Interface & UX

- ✅ Design responsivo com TailwindCSS
- ✅ ID numérico de 5 dígitos para cada reserva
- ✅ Ícones de calendário e relógio
- ✅ Status visual: ativa (verde), concluída (cinza), cancelada (vermelho)
- ✅ Modal FAQ com instruções
- ✅ Validação em tempo real (frontend + backend)

## 🛠️ Tecnologias

### Backend

- **Node.js** 16+
- **Express.js** 4.18
- **Sequelize** 6+ (ORM)
- **SQLite** (desenvolvimento) / **PostgreSQL** (produção)
- **bcrypt** 10+ (criptografia de senhas)
- **jsonwebtoken** (JWT)
- **cors**, **dotenv**

### Frontend

- **React** 18
- **React Router** v6
- **TailwindCSS** 3
- **Axios** (HTTP client)
- **react-datepicker** (seleção de datas)

## 🚀 Como Executar

### Pré-requisitos

- Node.js 16+ instalado
- npm ou yarn

### 1. Backend

```bash
# Entre na pasta server
cd server

# Instale as dependências
npm install

# (Opcional) Configure variáveis de ambiente
# Crie arquivo .env se necessário:
# JWT_SECRET=sua_chave_secreta
# PORT=4000

# Popule o banco de dados com dados iniciais
node seed.js

# Inicie o servidor
npm start
```

O servidor rodará em `http://localhost:4000`

### 2. Frontend

```bash
# Entre na pasta client
cd client

# Instale as dependências
npm install

# Inicie a aplicação React
npm start
```

O frontend abrirá em `http://localhost:3000`

## 👥 Usuários de Teste

Após rodar `node seed.js`, você terá:

**Administrador:**

- Matrícula: `123456789`
- Senha: `adminpass`

**Usuário Comum:**

- Matrícula: `1234567`
- Senha: `userpass`

**Salas disponíveis:** 7 salas (Sala 101, 102, 201, 202, 301, 302, Sala Rachel de Queiroz)

## 📂 Estrutura do Projeto

```
booksala_project/
├── client/                  # Frontend React
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.js    # Página de autenticação
│   │   │   └── Dashboard.js # Dashboard principal (1890 linhas)
│   │   ├── App.js
│   │   └── index.js
│   ├── public/
│   └── package.json
│
├── server/                  # Backend Node.js
│   ├── models/             # Modelos Sequelize
│   │   ├── user.js
│   │   ├── room.js
│   │   ├── reservation.js
│   │   └── index.js
│   ├── routes/             # Rotas da API
│   │   ├── auth.js         # POST /register, /login
│   │   ├── rooms.js        # GET /rooms, /rooms/available
│   │   └── reservations.js # CRUD de reservas
│   ├── middlewares/
│   │   └── auth.js         # Middleware JWT
│   ├── index.js            # Servidor Express
│   ├── seed.js             # População inicial do banco
│   ├── database.sqlite     # Banco SQLite (gerado)
│   └── package.json
│
└── README.md
```

## 🔒 Segurança

- ✅ **Senhas criptografadas**: bcrypt com 10 salt rounds
- ✅ **JWT**: Tokens expiram em 8 horas
- ✅ **Validação dupla**: Frontend e backend
- ✅ **Rotas protegidas**: Middleware de autenticação obrigatório
- ✅ **SQL Injection**: Prevenido pelo Sequelize ORM
- ✅ **CORS configurado**: Apenas origens permitidas

## 📊 Banco de Dados

**Desenvolvimento:** SQLite (`database.sqlite`)  
**Produção:** PostgreSQL (via `DATABASE_URL`)

### Tabelas:

- **Users**: id, name, matricula, passwordHash, role
- **Rooms**: id, name, capacity
- **Reservations**: id, userId, roomId, date, startTime, endTime, quantity, reason, status, title, notes

## 🧪 Regras de Negócio

- Biblioteca funciona: **Segunda a Sábado, 07:00 às 22:00**
- Duração mínima de reserva: **15 minutos**
- Usuário comum: **1 reserva ativa por dia**
- Administrador: **múltiplas reservas no mesmo dia** (salas diferentes)
- Não é possível reservar horários passados
- Reservas concluídas automaticamente após o horário final

## 📝 API Endpoints

### Autenticação

- `POST /auth/register` - Criar novo usuário
- `POST /auth/login` - Login e geração de token JWT

### Salas

- `GET /rooms` - Listar todas as salas
- `GET /rooms/available` - Verificar disponibilidade

### Reservas (Protegidas)

- `GET /reservations` - Listar reservas ativas
- `GET /reservations/history` - Histórico com paginação
- `POST /reservations` - Criar nova reserva
- `PUT /reservations/:id` - Editar reserva
- `DELETE /reservations/:id` - Cancelar reserva

## 🎨 Melhorias Futuras

- [ ] Testes unitários e de integração
- [ ] Visualização em calendário (FullCalendar.js)
- [ ] Notificações por email
- [ ] Exportar relatórios (CSV/PDF)
- [ ] Logs de auditoria para ações de admin
- [ ] Rate limiting para proteção de API
- [ ] Deploy em produção (Vercel/Heroku)

## 📄 Licença

Projeto acadêmico - UNIFOR 2025

---

**Desenvolvido por:** Juliana Inacio Teixeira
**Disciplina:** Desenvolvimento de Plataformas Web - Semestre 3
