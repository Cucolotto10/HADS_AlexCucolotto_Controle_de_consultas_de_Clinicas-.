CREATE DATABASE IF NOT EXISTS clinica_consultas
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE clinica_consultas;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  telefone VARCHAR(25),
  email VARCHAR(160) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil ENUM('Administrador','Profissional','Atendente') NOT NULL DEFAULT 'Atendente',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pacientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  data_nascimento DATE,
  telefone VARCHAR(25),
  endereco VARCHAR(255),
  email VARCHAR(160),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medicos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  registro_profissional VARCHAR(50) NOT NULL UNIQUE,
  especialidade VARCHAR(100) NOT NULL,
  telefone VARCHAR(25),
  email VARCHAR(160),
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS convenios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL UNIQUE,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  telefone VARCHAR(25),
  email VARCHAR(160),
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS paciente_convenios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT NOT NULL,
  convenio_id INT NOT NULL,
  numero_carteirinha VARCHAR(80),
  validade DATE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  FOREIGN KEY (convenio_id) REFERENCES convenios(id),
  UNIQUE KEY uq_paciente_convenio_carteira (paciente_id, convenio_id, numero_carteirinha)
);

CREATE TABLE IF NOT EXISTS consultas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT NOT NULL,
  medico_id INT NOT NULL,
  convenio_id INT NULL,
  especialidade VARCHAR(100) NOT NULL,
  data_consulta DATE NOT NULL,
  horario TIME NOT NULL,
  tipo_atendimento ENUM('Convênio','Particular') NOT NULL DEFAULT 'Particular',
  observacoes TEXT,
  situacao ENUM('Agendada','Confirmada','Cancelada','Realizada') NOT NULL DEFAULT 'Agendada',
  criado_por INT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
  FOREIGN KEY (medico_id) REFERENCES medicos(id),
  FOREIGN KEY (convenio_id) REFERENCES convenios(id),
  FOREIGN KEY (criado_por) REFERENCES usuarios(id),
  INDEX idx_consulta_medico_data (medico_id, data_consulta, horario, situacao)
);

CREATE TABLE IF NOT EXISTS atendimentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  consulta_id INT NOT NULL UNIQUE,
  motivo TEXT NOT NULL,
  observacoes TEXT,
  procedimentos TEXT,
  orientacoes TEXT,
  registrado_por INT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (consulta_id) REFERENCES consultas(id),
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
);
