# Sistema de Controle de Consultas para Clínicas

Projeto inicial baseado no DVP: Vue.js 3 (front-end), Node.js + Express (API) e MySQL 8 (banco de dados).

## Requisitos
- Node.js LTS
- MySQL 8
- Visual Studio Code

## 1. Banco de dados
No MySQL, execute o arquivo `database/schema.sql`.

## 2. Back-end
No terminal:
```bash
cd backend
npm install
```
Copie `.env.example` para `.env` e configure os dados do MySQL.
Depois execute:
```bash
npm run dev
```
A API ficará em `http://localhost:3000`.

**Primeiro acesso:** crie o usuário administrador usando o endpoint de cadastro conforme indicado abaixo. Para facilitar a configuração local, o endpoint `/api/auth/primeiro-admin` só funciona enquanto não existir nenhum usuário.

## 3. Front-end
Em outro terminal:
```bash
cd frontend
npm install
npm run dev
```
Abra o endereço informado pelo Vite.

## Funcionalidades desta versão inicial
- Login e encerramento de sessão
- Cadastro, consulta e desativação de pacientes
- Cadastro e consulta de médicos
- Cadastro e consulta de convênios
- Agendamento, confirmação, reagendamento e cancelamento de consultas
- Verificação de disponibilidade de horários
- Registro de atendimento e histórico do paciente

## Observações
Este é um projeto acadêmico inicial e deve ser testado e revisado antes de qualquer uso real. O envio de lembretes automáticos é citado no DVP, mas depende da configuração de um serviço externo, que não foi definido no documento. A recuperação de senha também precisa de um serviço de envio/validação para ser usada com segurança.
