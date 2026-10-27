import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { pool } from './db.js';
import { autenticar, permitir } from './middleware.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const clean = (v) => (typeof v === 'string' ? v.trim() : v);
const required = (body, fields) =>
  fields.filter((f) => !body[f] || String(body[f]).trim() === '');

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    sistema: 'Sistema de Controle de Consultas para Clínicas'
  });
});

app.post('/api/auth/primeiro-admin', asyncRoute(async (req, res) => {
  const [users] = await pool.query('SELECT id FROM usuarios LIMIT 1');
  if (users.length) return res.status(403).json({ erro: 'O administrador inicial já foi criado.' });
  const faltantes = required(req.body, ['nome', 'cpf', 'email', 'senha']);
  if (faltantes.length) {
    return res.status(400).json({ erro: `Preencha: ${faltantes.join(', ')}` });
  }
  if (String(req.body.senha).length < 8) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 8 caracteres.' });
  }
  const hash = await bcrypt.hash(req.body.senha, 12);
  const [r] = await pool.query(
    'INSERT INTO usuarios (nome,cpf,telefone,email,senha_hash,perfil) VALUES (?,?,?,?,?,?)',
    [clean(req.body.nome), clean(req.body.cpf), clean(req.body.telefone) || null, clean(req.body.email).toLowerCase(), hash, 'Administrador']
  );
  res.status(201).json({ id: r.insertId, mensagem: 'Administrador criado. Faça login.' });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const faltantes = required(req.body, ['email', 'senha']);
  if (faltantes.length) return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ? AND ativo = TRUE', [clean(req.body.email).toLowerCase()]);
  if (!rows.length || !(await bcrypt.compare(req.body.senha, rows[0].senha_hash))) {
    return res.status(401).json({ erro: 'Credenciais inválidas.' });
  }
  const u = rows[0];
  const token = jwt.sign({ id: u.id, nome: u.nome, perfil: u.perfil }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, usuario: { id: u.id, nome: u.nome, perfil: u.perfil, email: u.email } });
}));

app.get('/api/auth/me', autenticar, (req, res) => {
  res.json({ usuario: req.usuario });
});
app.post('/api/auth/logout', autenticar, (req, res) => {
  res.json({ mensagem: 'Sessão encerrada. Remova o token do navegador.' });
});

// Usuários: gerenciamento administrativo
app.get('/api/usuarios', autenticar, permitir('Administrador'), asyncRoute(async (req, res) => {
  const [rows] = await pool.query('SELECT id,nome,cpf,telefone,email,perfil,ativo,criado_em FROM usuarios ORDER BY nome');
  res.json(rows);
}));
app.post('/api/usuarios', autenticar, permitir('Administrador'), asyncRoute(async (req, res) => {
  const faltantes = required(req.body, ['nome', 'cpf', 'email', 'senha', 'perfil']);
  if (faltantes.length) {
    return res.status(400).json({ erro: `Preencha: ${faltantes.join(', ')}` });
  }
  if (!['Administrador', 'Profissional', 'Atendente'].includes(req.body.perfil)) {
    return res.status(400).json({ erro: 'Perfil inválido.' });
  }
  if (String(req.body.senha).length < 8) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 8 caracteres.' });
  }
  const hash = await bcrypt.hash(req.body.senha, 12);
  const [r] = await pool.query('INSERT INTO usuarios (nome,cpf,telefone,email,senha_hash,perfil) VALUES (?,?,?,?,?,?)',
    [clean(req.body.nome), clean(req.body.cpf), clean(req.body.telefone) || null, clean(req.body.email).toLowerCase(), hash, req.body.perfil]);
  res.status(201).json({ id: r.insertId, mensagem: 'Usuário cadastrado.' });
}));
app.patch('/api/usuarios/:id/desativar', autenticar, permitir('Administrador'), asyncRoute(async (req, res) => {
  if (Number(req.params.id) === req.usuario.id) {
    return res.status(400).json({ erro: 'Não é permitido desativar o próprio usuário.' });
  }
  await pool.query('UPDATE usuarios SET ativo = FALSE WHERE id = ?', [req.params.id]);
  res.json({ mensagem: 'Usuário desativado.' });
}));

// Pacientes
app.get('/api/pacientes', autenticar, asyncRoute(async (req, res) => {
  const q = `%${clean(req.query.q || '')}%`;
  const [rows] = await pool.query('SELECT * FROM pacientes WHERE ativo=TRUE AND (nome LIKE ? OR cpf LIKE ?) ORDER BY nome', [q, q]);
  res.json(rows);
}));
app.post('/api/pacientes', autenticar, permitir('Administrador', 'Atendente'), asyncRoute(async (req, res) => {
  const fields = ['nome', 'cpf'];
  const faltantes = required(req.body, fields);
  if (faltantes.length) {
    return res.status(400).json({ erro: `Preencha: ${faltantes.join(', ')}` });
  }
  const [r] = await pool.query('INSERT INTO pacientes (nome,cpf,data_nascimento,telefone,endereco,email) VALUES (?,?,?,?,?,?)',
    [clean(req.body.nome), clean(req.body.cpf), req.body.data_nascimento || null, clean(req.body.telefone) || null, clean(req.body.endereco) || null, clean(req.body.email) || null]);
  res.status(201).json({ id: r.insertId, mensagem: 'Paciente cadastrado.' });
}));
app.put('/api/pacientes/:id', autenticar, permitir('Administrador', 'Atendente'), asyncRoute(async (req, res) => {
  const { nome, cpf, data_nascimento, telefone, endereco, email } = req.body;
  if (!nome || !cpf) return res.status(400).json({ erro: 'Nome e CPF são obrigatórios.' });
  await pool.query('UPDATE pacientes SET nome=?,cpf=?,data_nascimento=?,telefone=?,endereco=?,email=? WHERE id=?',
    [clean(nome), clean(cpf), data_nascimento || null, clean(telefone) || null, clean(endereco) || null, clean(email) || null, req.params.id]);
  res.json({ mensagem: 'Paciente atualizado.' });
}));
app.patch('/api/pacientes/:id/desativar', autenticar, permitir('Administrador', 'Atendente'), asyncRoute(async (req, res) => {
  await pool.query('UPDATE pacientes SET ativo=FALSE WHERE id=?', [req.params.id]);
  res.json({ mensagem: 'Paciente desativado; o histórico foi preservado.' });
}));

// Médicos
app.get('/api/medicos', autenticar, asyncRoute(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM medicos WHERE ativo=TRUE ORDER BY nome');
  res.json(rows);
}));
app.post('/api/medicos', autenticar, permitir('Administrador'), asyncRoute(async (req, res) => {
  const faltantes = required(req.body, ['nome', 'cpf', 'registro_profissional', 'especialidade']);
  if (faltantes.length) {
    return res.status(400).json({ erro: `Preencha: ${faltantes.join(', ')}` });
  }
  const [r] = await pool.query('INSERT INTO medicos (nome,cpf,registro_profissional,especialidade,telefone,email) VALUES (?,?,?,?,?,?)',
    [clean(req.body.nome), clean(req.body.cpf), clean(req.body.registro_profissional), clean(req.body.especialidade), clean(req.body.telefone) || null, clean(req.body.email) || null]);
  res.status(201).json({ id: r.insertId, mensagem: 'Médico cadastrado.' });
}));

app.delete('/api/medicos/:id', autenticar, permitir('Administrador'), asyncRoute(async (req, res) => {
  const [resultado] = await pool.query(
    'UPDATE medicos SET ativo = FALSE WHERE id = ? AND ativo = TRUE',
    [req.params.id]
  );

  if (resultado.affectedRows === 0) {
    return res.status(404).json({
      erro: 'Médico não encontrado ou já está inativo.'
    });
  }

  res.json({
    mensagem: 'Médico excluído da lista de ativos. O histórico foi preservado.'
  });
}));


// Convênios e vínculo paciente-convênio
app.get('/api/convenios', autenticar, asyncRoute(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM convenios ORDER BY nome'); res.json(rows);
}));
app.post('/api/convenios', autenticar, permitir('Administrador', 'Atendente'), asyncRoute(async (req, res) => {
  const faltantes = required(req.body, ['nome', 'codigo']);
  if (faltantes.length) {
    return res.status(400).json({ erro: `Preencha: ${faltantes.join(', ')}` });
  }
  const [r] = await pool.query('INSERT INTO convenios (nome,codigo,telefone,email) VALUES (?,?,?,?)',
    [clean(req.body.nome), clean(req.body.codigo), clean(req.body.telefone) || null, clean(req.body.email) || null]);
  res.status(201).json({ id: r.insertId, mensagem: 'Convênio cadastrado.' });
}));
app.patch('/api/convenios/:id/status', autenticar, permitir('Administrador'), asyncRoute(async (req, res) => {
  await pool.query('UPDATE convenios SET ativo=? WHERE id=?', [req.body.ativo ? 1 : 0, req.params.id]);
  res.json({ mensagem: 'Situação do convênio atualizada.' });
}));
app.post('/api/paciente-convenios', autenticar, permitir('Administrador', 'Atendente'), asyncRoute(async (req, res) => {
  const { paciente_id, convenio_id, numero_carteirinha, validade } = req.body;
  if (!paciente_id || !convenio_id) return res.status(400).json({ erro: 'Selecione paciente e convênio.' });
  const [r] = await pool.query('INSERT INTO paciente_convenios (paciente_id,convenio_id,numero_carteirinha,validade) VALUES (?,?,?,?)',
    [paciente_id, convenio_id, clean(numero_carteirinha) || null, validade || null]);
  res.status(201).json({ id: r.insertId, mensagem: 'Convênio associado ao paciente.' });
}));

// Consultas
app.get('/api/consultas', autenticar, asyncRoute(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT c.*, p.nome AS paciente_nome, m.nome AS medico_nome, cv.nome AS convenio_nome
    FROM consultas c JOIN pacientes p ON p.id=c.paciente_id
    JOIN medicos m ON m.id=c.medico_id LEFT JOIN convenios cv ON cv.id=c.convenio_id
    ORDER BY c.data_consulta, c.horario`);
  res.json(rows);
}));
app.get('/api/consultas/disponibilidade', autenticar, asyncRoute(async (req, res) => {
  const { medico_id, data } = req.query;
  if (!medico_id || !data) return res.status(400).json({ erro: 'Informe médico e data.' });
  const [medicos] = await pool.query('SELECT id FROM medicos WHERE id=? AND ativo=TRUE', [medico_id]);
  if (!medicos.length) {
    return res.status(400).json({ erro: 'Médico não encontrado ou inativo.' });
  }
  const [ocupados] = await pool.query(`SELECT horario FROM consultas WHERE medico_id=? AND data_consulta=? AND situacao IN ('Agendada','Confirmada')`, [medico_id, data]);
  const usados = new Set(ocupados.map(x => String(x.horario).slice(0, 5)));
  // Horários-base de exemplo; ajuste aos horários de atendimento cadastrados da clínica.
  const horarios = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
  console.log('Médico:', medico_id, 'Data:', data);
  console.log('Horários disponíveis:', horarios.filter(h => !usados.has(h)));
  res.json(horarios.filter(h => !usados.has(h)));
}));
app.post('/api/consultas', autenticar, permitir('Administrador', 'Atendente'), asyncRoute(async (req, res) => {
  const { paciente_id, medico_id, convenio_id, especialidade, data_consulta, horario, tipo_atendimento, observacoes } = req.body;
  if (!paciente_id || !medico_id || !especialidade || !data_consulta || !horario) return res.status(400).json({ erro: 'Preencha paciente, médico, especialidade, data e horário.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [patients] = await conn.query('SELECT id FROM pacientes WHERE id=? AND ativo=TRUE FOR UPDATE', [paciente_id]);
    const [doctors] = await conn.query('SELECT id FROM medicos WHERE id=? AND ativo=TRUE FOR UPDATE', [medico_id]);
    if (!patients.length || !doctors.length) {
      await conn.rollback();
      return res.status(400).json({ erro: 'Paciente ou médico inválido/inativo.' });
    }
    if (convenio_id) {
      const [cv] = await conn.query('SELECT id FROM convenios WHERE id=? AND ativo=TRUE', [convenio_id]);
      if (!cv.length) {
        await conn.rollback();
        return res.status(400).json({ erro: 'Convênio inativo ou não encontrado.' });
      }
    }
    const [conflict] = await conn.query(`SELECT id FROM consultas WHERE medico_id=? AND data_consulta=? AND horario=? AND situacao IN ('Agendada','Confirmada') FOR UPDATE`, [medico_id, data_consulta, horario]);
    if (conflict.length) {
      await conn.rollback();
      return res.status(409).json({ erro: 'Este horário já está ocupado para o médico.' });
    }
    const [r] = await conn.query(`INSERT INTO consultas (paciente_id,medico_id,convenio_id,especialidade,data_consulta,horario,tipo_atendimento,observacoes,criado_por) VALUES (?,?,?,?,?,?,?,?,?)`,
      [paciente_id, medico_id, convenio_id || null, clean(especialidade), data_consulta, horario, tipo_atendimento === 'Convênio' && convenio_id ? 'Convênio' : 'Particular', clean(observacoes) || null, req.usuario.id]);
    await conn.commit(); res.status(201).json({ id: r.insertId, mensagem: 'Consulta agendada.' });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));
app.patch('/api/consultas/:id/cancelar', autenticar, permitir('Administrador', 'Atendente'), asyncRoute(async (req, res) => {
  const [r] = await pool.query(`UPDATE consultas SET situacao='Cancelada' WHERE id=? AND situacao IN ('Agendada','Confirmada')`, [req.params.id]);
  if (!r.affectedRows) {
    return res.status(400).json({ erro: 'Consulta não encontrada ou não pode ser cancelada.' });
  }
  res.json({ mensagem: 'Consulta cancelada; horário liberado.' });
}));
app.patch('/api/consultas/:id/confirmar', autenticar, permitir('Administrador', 'Atendente'), asyncRoute(async (req, res) => {
  const [r] = await pool.query(`UPDATE consultas SET situacao='Confirmada' WHERE id=? AND situacao='Agendada'`, [req.params.id]);
  if (!r.affectedRows) {
    return res.status(400).json({ erro: 'Consulta não encontrada ou não está agendada.' });
  }
  res.json({ mensagem: 'Consulta confirmada.' });
}));
app.patch('/api/consultas/:id/reagendar', autenticar, permitir('Administrador', 'Atendente'), asyncRoute(async (req, res) => {
  const { data_consulta, horario } = req.body;
  if (!data_consulta || !horario) return res.status(400).json({ erro: 'Informe nova data e horário.' });
  const [old] = await pool.query(
    "SELECT * FROM consultas WHERE id = ? AND situacao IN ('Agendada', 'Confirmada')",
    [req.params.id]
  );
  if (!old.length) {
    return res.status(404).json({ erro: 'Consulta não encontrada.' });
  }
  const c = old[0];
  const [conflict] = await pool.query(`SELECT id FROM consultas WHERE medico_id=? AND data_consulta=? AND horario=? AND situacao IN ('Agendada','Confirmada') AND id<>?`, [c.medico_id, data_consulta, horario, c.id]);
  if (conflict.length) {
    return res.status(409).json({ erro: 'Novo horário já está ocupado.' });
  }
  await pool.query(`UPDATE consultas SET data_consulta=?,horario=?,situacao='Agendada' WHERE id=?`, [data_consulta, horario, c.id]);
  res.json({ mensagem: 'Consulta reagendada.' });
}));
app.post('/api/atendimentos', autenticar, permitir('Administrador', 'Profissional'), asyncRoute(async (req, res) => {
  const { consulta_id, motivo, observacoes, procedimentos, orientacoes } = req.body;
  if (!consulta_id || !motivo) return res.status(400).json({ erro: 'Selecione a consulta e informe o motivo.' });
  const [cs] = await pool.query(
    "SELECT id FROM consultas WHERE id = ? AND situacao IN ('Agendada', 'Confirmada')",
    [consulta_id]
  );
  if (!cs.length) {
    return res.status(400).json({ erro: 'A consulta não existe ou já foi realizada/cancelada.' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query('INSERT INTO atendimentos (consulta_id,motivo,observacoes,procedimentos,orientacoes,registrado_por) VALUES (?,?,?,?,?,?)',
      [consulta_id, clean(motivo), clean(observacoes) || null, clean(procedimentos) || null, clean(orientacoes) || null, req.usuario.id]);
    await conn.query(`UPDATE consultas SET situacao='Realizada' WHERE id=?`, [consulta_id]);
    await conn.commit(); res.status(201).json({ id: r.insertId, mensagem: 'Atendimento registrado.' });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));
app.get('/api/pacientes/:id/historico', autenticar, asyncRoute(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT c.id, c.data_consulta, c.horario, c.especialidade, c.situacao, c.tipo_atendimento,
           m.nome AS medico_nome, cv.nome AS convenio_nome,
           a.motivo, a.observacoes AS atendimento_observacoes, a.procedimentos, a.orientacoes
    FROM consultas c JOIN medicos m ON m.id=c.medico_id
    LEFT JOIN convenios cv ON cv.id=c.convenio_id
    LEFT JOIN atendimentos a ON a.consulta_id=c.id
    WHERE c.paciente_id=? ORDER BY c.data_consulta DESC,c.horario DESC`, [req.params.id]);
  res.json(rows);
}));

app.use((err, req, res, next) => {
  console.error('Detalhes do erro:', err);

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      erro: 'Já existe um registro com esse CPF, e-mail, código ou nome único.'
    });
  }

  res.status(500).json({
    erro: 'Erro interno do servidor. Confira a configuração e o terminal do back-end.'
  });
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});