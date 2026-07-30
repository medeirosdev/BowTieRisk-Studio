-- Migration v1 — schema inicial do Bow Tie Risk Studio.
-- Ver about.md, Seção 5. Cada projeto é um arquivo .db próprio contendo
-- exatamente uma linha em `projects` mais suas sessões, bowties e entidades.

-- ============ USUÁRIOS (atribuição, NÃO autenticação) ============
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,      -- OBRIGATÓRIO
  first_seen  TEXT NOT NULL,
  last_seen   TEXT NOT NULL
);

-- ============ HIERARQUIA (1 linha em projects por arquivo .db) ============
CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_by  TEXT,
  updated_at  TEXT
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_by  TEXT NOT NULL,      -- autor da sessão (requisito de auditoria)
  created_at  TEXT NOT NULL,
  updated_by  TEXT,
  updated_at  TEXT
);

CREATE TABLE bowties (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,               -- descrição própria de cada bowtie
  hazard      TEXT,               -- Perigo
  top_event   TEXT,               -- Evento de Topo (texto central)
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_by  TEXT,
  updated_at  TEXT
);

-- ============ TIPOS DE BARREIRA (personalizáveis por projeto) ============
-- Taxonomia CCPS/DNV-GL (about.md, Seção 5.1) como conjunto inicial — cada
-- projeto pode adicionar os seus. barrier_type nas tabelas de barreira é
-- texto livre (o nome do tipo, não uma referência): simples de estender sem
-- FK/remapeamento, ao custo de renomear um tipo aqui não atualizar barreiras
-- que já usam o nome antigo.
CREATE TABLE barrier_types (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL UNIQUE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT NOT NULL, created_at TEXT NOT NULL
);

INSERT INTO barrier_types (id, label, order_index, created_by, created_at) VALUES
  ('hardware_passivo', 'Hardware Passivo', 0, 'sistema', datetime('now')),
  ('hardware_ativo', 'Hardware Ativo', 1, 'sistema', datetime('now')),
  ('hardware_ativo_humano', 'Hardware Ativo + Humano', 2, 'sistema', datetime('now')),
  ('humano_comportamental', 'Humano / Comportamental', 3, 'sistema', datetime('now')),
  ('hardware_continuo', 'Hardware Contínuo', 4, 'sistema', datetime('now'));

-- ============ LADO ESQUERDO ============
CREATE TABLE threats (
  id          TEXT PRIMARY KEY,
  bowtie_id   TEXT NOT NULL REFERENCES bowties(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_by  TEXT, updated_at TEXT
);

CREATE TABLE preventive_barriers (
  id            TEXT PRIMARY KEY,
  threat_id     TEXT NOT NULL REFERENCES threats(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  description   TEXT,
  barrier_type  TEXT,             -- nome do tipo (ver barrier_types); texto livre
  -- Efetividade: escala numérica 1 (muito baixa) a 5 (muito alta); NULL = não avaliada.
  effectiveness INTEGER CHECK (effectiveness IS NULL OR effectiveness BETWEEN 1 AND 5),
  order_index   INTEGER NOT NULL DEFAULT 0,   -- ordem na cadeia ameaça→topo
  created_by    TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_by    TEXT, updated_at TEXT
);

-- ============ LADO DIREITO ============
CREATE TABLE consequences (
  id          TEXT PRIMARY KEY,
  bowtie_id   TEXT NOT NULL REFERENCES bowties(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_by  TEXT, updated_at TEXT
);

CREATE TABLE mitigative_barriers (
  id             TEXT PRIMARY KEY,
  consequence_id TEXT NOT NULL REFERENCES consequences(id) ON DELETE CASCADE,
  label          TEXT NOT NULL,
  description    TEXT,
  barrier_type   TEXT,            -- nome do tipo (ver barrier_types); texto livre
  effectiveness  INTEGER CHECK (effectiveness IS NULL OR effectiveness BETWEEN 1 AND 5),
  order_index    INTEGER NOT NULL DEFAULT 0,   -- ordem na cadeia topo→consequência
  created_by     TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_by     TEXT, updated_at TEXT
);

-- ============ PLANOS DE AÇÃO (etapa 7 da metodologia Bow Tie) ============
-- Referencia a barreira de forma polimórfica via (barrier_kind, barrier_id),
-- já que preventive_barriers e mitigative_barriers são tabelas separadas.
CREATE TABLE action_plans (
  id           TEXT PRIMARY KEY,
  barrier_kind TEXT NOT NULL CHECK (barrier_kind IN ('preventive', 'mitigative')),
  barrier_id   TEXT NOT NULL,
  description  TEXT NOT NULL,
  responsible  TEXT,
  due_date     TEXT,
  status       TEXT NOT NULL DEFAULT 'pendente'
               CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'cancelado')),
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_by   TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_by   TEXT, updated_at TEXT
);

CREATE INDEX idx_action_plans_barrier ON action_plans(barrier_kind, barrier_id);

-- ============ POSIÇÕES MANUAIS (override opcional do layout) ============
CREATE TABLE node_positions (
  bowtie_id  TEXT NOT NULL REFERENCES bowties(id) ON DELETE CASCADE,
  node_id    TEXT NOT NULL,      -- id lógico do nó derivado (ex.: "threat:<id>")
  x          REAL NOT NULL,
  y          REAL NOT NULL,
  PRIMARY KEY (bowtie_id, node_id)
);

-- ============ AUDITORIA (append-only) ============
CREATE TABLE audit_log (
  id           TEXT PRIMARY KEY,
  ts           TEXT NOT NULL,     -- ISO-8601 UTC
  user_name    TEXT NOT NULL,
  user_email   TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN
                 ('CREATE','UPDATE','DELETE','OPEN','CLOSE','SYNC','LOCK','UNLOCK')),
  entity_type  TEXT NOT NULL,     -- project | session | bowtie | threat | barrier | ...
  entity_id    TEXT,
  entity_label TEXT,
  changes_json TEXT,              -- {"before": {...}, "after": {...}}
  app_version  TEXT
);

CREATE INDEX idx_audit_ts ON audit_log(ts);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
