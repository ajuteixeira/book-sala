# BookSala - Sistema de agendamentos de salas da biblioteca (UNIFOR)

Projeto full-stack (Node.js + Express + Sequelize + React) fornecido como exemplo funcional.

**Características principais**
- Autenticação por **matrícula** (não email) e senha.
  - Usuário comum: matrícula **exatamente 7 dígitos numéricos**.
  - Administrador: matrícula **exatamente 9 dígitos numéricos**.
- Senhas armazenadas com `bcrypt`.
- Autenticação por JWT.
- Rotas protegidas por middleware.
- Sequelize ORM (configurado para PostgreSQL; também suporta dialect 'sqlite' para testes locais).
- React SPA (TailwindCSS, Axios, React Router, FullCalendar básico).

## Como usar (desenvolvimento)

### Backend
1. Vá para a pasta `server`:
```bash
cd server
```
2. Copie `.env.example` para `.env` e ajuste:
```
DATABASE_URL=postgres://USER:PASS@HOST:PORT/DBNAME
JWT_SECRET=uma_chave_secreta
PORT=4000
```
Se preferir testar sem Postgres, altere `config/config.js` `dialect` para `sqlite` e deixe `storage` apontando para `./db.sqlite`.

3. Instale dependências e rode:
```bash
npm install
npm run dev
```
O servidor irá sincronizar o banco automaticamente (usando `sequelize.sync()`).

### Frontend
1. Vá para `client`:
```bash
cd client
```
2. Instale dependências:
```bash
npm install
```
3. Rode a SPA:
```bash
npm start
```

### Usuários
- Registre-se pela API ou pela interface:
  - para **usuário comum**, insira `matricula` com 7 dígitos.
  - para **admin**, insira `matricula` com 9 dígitos e `role: admin`.

### Notas
- O backend expõe endpoints REST em `/api`.
- O frontend consome essas rotas via Axios; ajuste `REACT_APP_API_URL` conforme necessário.
- Este projeto é um ponto de partida; recomenda-se endurecer segurança e adicionar validações adicionais antes de colocar em produção.

