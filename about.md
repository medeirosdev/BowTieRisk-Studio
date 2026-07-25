# Bow Tie Risk Studio — Plano de Aplicação

> Documento de planejamento e especificação técnica para desenvolvimento assistido por IA (Claude Code no VS Code).
> Serve simultaneamente como **spec de produto** e como **guia de trabalho** para o agente.

---

## 0. Como usar este documento

Este arquivo é a fonte da verdade do projeto. Ao trabalhar com o Claude Code:

1. Leia este documento inteiro antes de gerar código.
2. Siga o **roadmap por fases** (Seção 12). Não pule para features avançadas antes do MVP funcionar.
3. Respeite as **convenções e regras de ouro** (Seção 13).
4. Sempre que uma decisão de arquitetura não estiver clara aqui, **pergunte antes de implementar** — não invente.
5. Mantenha este `.md` atualizado conforme decisões forem tomadas.

**Decisões já fechadas** (ver detalhes ao longo do doc):
- Lock com **heartbeat automático** desde o início.
- **Um banco SQLite por projeto**; a UI tem "Criar banco para o projeto".
- Pastas na **raiz do executável**: `bancos/` e `backups/` (portátil, é o que vai pro SharePoint).
- **Email obrigatório** na identificação do usuário.
- **Sem autenticação** (só atribuição por nome).
- **Exportação só em PNG** por enquanto.
- **Sem i18n**: só PT-BR, mas com textos centralizados num arquivo de strings.
- **Sempre usar ENUM** para campos com valores fixos (via `CHECK` no SQLite + union types no TypeScript).

---

## 1. Visão do produto

Aplicação **desktop, local e executável** para construir e gerenciar análises de risco no formato **Bow Tie** (Gravata Borboleta).

O Bow Tie é uma ferramenta visual que mapeia, em torno de um **Evento de Topo** central:

- **Lado esquerdo — Ameaças e Barreiras Preventivas:** as causas-raiz e os controles que impedem o evento crítico de ocorrer.
- **Centro — Evento de Topo (Top Event):** o acontecimento crítico / perda de controle sobre o perigo (ex.: vazamento químico, queda de sistema, acidente veicular).
- **Lado direito — Consequências e Barreiras Mitigatórias:** os impactos possíveis e os controles que contêm ou reduzem os danos.

Estrutura hierárquica de dados que o usuário manipula:

```
Projeto  (= um arquivo .db próprio)
 └── Sessão                (com autor registrado — auditável)
      └── Bowtie           (vários por sessão, cada um com nome + descrição próprios)
           ├── Perigo (Hazard) + Evento de Topo
           ├── Ameaças        → Barreiras Preventivas
           └── Consequências  → Barreiras Mitigatórias
```

### Requisitos não-negociáveis

- **Local e offline-first.** Roda como executável, sem servidor.
- **Banco SQLite local** como armazenamento — **um banco por projeto**.
- **Auditável.** Toda ação de criação/edição registra **quem** fez e **quando**.
- **Identificação do usuário na entrada** (nome + **email obrigatório**), antes de criar/editar qualquer coisa.
- **Os bancos ficam numa pasta na raiz do executável e essa pasta vai pro SharePoint / é compartilhada** — exige tratamento especial (ver Seção 6).
- **Canvas de diagramação fluido** para desenhar o Bow Tie.

---

## 2. Conceitos de domínio (glossário)

| Termo | Definição |
|---|---|
| **Perigo (Hazard)** | Condição/atividade com potencial de causar dano (ex.: "armazenamento de cloro"). |
| **Evento de Topo (Top Event)** | Momento em que se perde o controle sobre o perigo (ex.: "liberação de cloro"). Centro da gravata. |
| **Ameaça (Threat)** | Causa que pode levar ao evento de topo (ex.: "falha na válvula"). Fica à esquerda. |
| **Consequência (Consequence)** | Resultado indesejado caso o evento ocorra (ex.: "intoxicação"). Fica à direita. |
| **Barreira Preventiva** | Controle entre uma ameaça e o evento de topo. Impede que o evento aconteça. |
| **Barreira Mitigatória** | Controle entre o evento de topo e uma consequência. Reduz/contém o dano. |
| **Fator de Escalada** | *(avançado / fase 3)* Condição que degrada uma barreira. |
| **Controle de Fator de Escalada** | *(avançado)* Barreira que protege contra um fator de escalada. |

**Regra de forma:** ameaças convergem da esquerda para o evento de topo; consequências divergem do evento de topo para a direita. As barreiras ficam **na linha** (aresta) entre os nós, em sequência.

---

## 3. Arquitetura geral

**Stack: Tauri (Rust) + React/TypeScript + SQLite.** Executável pequeno, RAM baixa, ecossistema web para o canvas.

```
┌──────────────────────────────────────────────┐
│  Frontend (WebView) — React + TS + Vite       │
│  • UI, telas, canvas React Flow               │
│  • Zustand (estado) · strings PT-BR central   │
│  • Camada de repositório (queries + auditoria)│
└───────────────┬──────────────────────────────┘
                │ IPC / plugin bindings
┌───────────────┴──────────────────────────────┐
│  Backend (Rust) — Tauri core                  │
│  • tauri-plugin-sql  → SQLite (sqlx)          │
│  • tauri-plugin-fs   → copiar DB, backups     │
│  • tauri-plugin-store → settings/último user  │
│  • Comandos custom: descobrir ./bancos,       │
│    lock+heartbeat, sync, backup, integridade  │
└───────────────┬──────────────────────────────┘
                │
   ┌────────────┴─────────────┐        ┌───────────────────────────────┐
   │ DB de trabalho (cópia)   │  copia │ ./bancos/<projeto>.db          │
   │ local, em AppData        │◄──────►│ (canônico, na pasta do .exe,   │
   │ NÃO sincronizado         │  sync  │  sincronizada pelo SharePoint) │
   └──────────────────────────┘        └───────────────────────────────┘
```

> **Princípio central:** a aplicação **nunca** abre o SQLite diretamente do arquivo em `./bancos/` (pasta sincronizada). Trabalha sempre numa **cópia local** em AppData e sincroniza de forma controlada. Ver Seção 6.

---

## 4. Tech stack (versões de referência)

| Camada | Tecnologia | Versão ref. | Observação |
|---|---|---|---|
| Shell desktop | **Tauri** | 2.x | Executável nativo, portátil. |
| Backend | **Rust** | stable | — |
| SQL plugin (Rust) | `tauri-plugin-sql` (feature `sqlite`) | ~2.4 | Usa `sqlx`; migrations em Rust. |
| SQL plugin (JS) | `@tauri-apps/plugin-sql` | ~2.x | `import Database from '@tauri-apps/plugin-sql'`. |
| Frontend | **React** + **TypeScript** | React 19 | — |
| Bundler | **Vite** | latest | Template oficial Tauri. |
| Canvas/grafo | **@xyflow/react** (React Flow v12) | ~12.11 | `import { ReactFlow } from '@xyflow/react'` + `import '@xyflow/react/dist/style.css'`. |
| Auto-layout | `@dagrejs/dagre` | latest | **Opcional**, fase 3. |
| Estado | **Zustand** | latest | — |
| Estilo | **Tailwind CSS** ou CSS Modules | — | Tailwind combina bem com React Flow. |
| FS | `tauri-plugin-fs` | 2.x | Copiar DB, criar `bancos/`/`backups/`, backups. |
| Settings | `tauri-plugin-store` | 2.x | Nome/email do usuário, último projeto aberto. |
| IDs | `ulid` | latest | ULID para todas as PKs. |
| Export imagem | `html-to-image` (`toPng` do React Flow) | latest | Exportar bowtie em **PNG**. |

> **Import do React Flow:** desde a v12 o pacote é `@xyflow/react` (não é mais `reactflow`, e não é default import). Dimensões medidas em `node.measured.width/height`.

---

## 5. Modelo de dados (SQLite)

Cada **projeto** é um arquivo `.db` próprio, contendo **exatamente uma linha** em `projects` mais suas sessões, bowties e entidades. A listagem de projetos vem de um registro leve (`bancos/index.json`, Seção 6.2) para não precisar abrir todos os bancos.

### 5.1. Enums do domínio (sempre ENUM)

Como SQLite não tem tipo `ENUM` nativo, cada campo restrito usa `TEXT` + `CHECK`, e no frontend um union type TypeScript.

**`barrier_type` — taxonomia canônica da metodologia Bow Tie (CCPS / DNV-GL, padrão do BowTieXP).**
Classifica a barreira pelo princípio **Detectar–Decidir–Agir (DDA)**, ou seja, *como* a barreira funciona e de quem ela depende (hardware, pessoas, ou combinação). São **cinco tipos**:

| Valor (chave) | Rótulo PT-BR | O que é | Exemplos |
|---|---|---|---|
| `hardware_passivo` | Hardware Passivo | Sempre presente; não detecta, não decide, não age — só existe. | Dique, bacia de contenção, parede corta-fogo, distância de segurança. |
| `hardware_ativo` | Hardware Ativo | Detecta + decide + age, tudo por tecnologia. | Válvula de alívio, intertravamento (SIS), trip de alta pressão. |
| `hardware_ativo_humano` | Hardware Ativo + Humano | Combinação: parte tecnológica, parte decisão/ação humana. (Substitui "sociotécnico".) | Detecção de gás → operador decide → aciona válvula ESD. |
| `humano_comportamental` | Humano / Comportamental | Todo o ciclo DDA é feito por pessoas. | Operador respondendo a alarme, inspeção, rondas. |
| `hardware_continuo` | Hardware Contínuo | Sempre presente, mas com ação contínua (movimento/energia), sem detecção. | Ventilação/exaustão, drenagem contínua. |

> Ter **tipos diversos** de barreira num mesmo lado é bom: reduz falha em modo comum (não depender só de hardware ou só de comportamento). A UI pode até mostrar essa diversidade por bowtie.

```ts
// src/types/enums.ts
export const BARRIER_TYPES = [
  'hardware_passivo',
  'hardware_ativo',
  'hardware_ativo_humano',
  'humano_comportamental',
  'hardware_continuo',
] as const;
export type BarrierType = typeof BARRIER_TYPES[number];

// Rótulos exibidos na UI (mantidos no arquivo central de strings PT-BR)
export const BARRIER_TYPE_LABELS: Record<BarrierType, string> = {
  hardware_passivo:       'Hardware Passivo',
  hardware_ativo:         'Hardware Ativo',
  hardware_ativo_humano:  'Hardware Ativo + Humano',
  humano_comportamental:  'Humano / Comportamental',
  hardware_continuo:      'Hardware Contínuo',
};

// Efetividade (escala qualitativa simples). A metodologia exige que a barreira
// seja "efetiva, independente e auditável"; esta escala apoia essa avaliação.
export const EFFECTIVENESS = ['alta', 'media', 'baixa', 'nao_avaliada'] as const;
export type Effectiveness = typeof EFFECTIVENESS[number];

export const AUDIT_ACTIONS = ['CREATE','UPDATE','DELETE','OPEN','CLOSE','SYNC','LOCK','UNLOCK'] as const;
export type AuditAction = typeof AUDIT_ACTIONS[number];
```

> **Alternativa mais simples** (se um dia quiser algo menos específico de segurança de processo): classificar por `hardware | comportamental | procedimento | organizacional`. Não é o padrão Bow Tie clássico, mas é comum em HSE geral. Fica registrado como opção; o padrão adotado é o CCPS de 5 tipos acima.

### 5.2. Convenções gerais das tabelas

- `id TEXT PRIMARY KEY` — **ULID** gerado na aplicação (evita colisão ao mesclar bancos; ver Seção 6.4).
- `created_by TEXT`, `created_at TEXT` (ISO-8601 UTC), `updated_by TEXT`, `updated_at TEXT`.
- `order_index INTEGER` onde a ordem importa (ameaças, consequências, barreiras).
- Campos restritos usam `CHECK (campo IN (...))`.

### 5.3. Migration inicial (v1)

```sql
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
  barrier_type  TEXT CHECK (barrier_type IN
                  ('hardware_passivo','hardware_ativo','hardware_ativo_humano',
                   'humano_comportamental','hardware_continuo')),
  effectiveness TEXT CHECK (effectiveness IN ('alta','media','baixa','nao_avaliada')),
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
  barrier_type   TEXT CHECK (barrier_type IN
                   ('hardware_passivo','hardware_ativo','hardware_ativo_humano',
                    'humano_comportamental','hardware_continuo')),
  effectiveness  TEXT CHECK (effectiveness IN ('alta','media','baixa','nao_avaliada')),
  order_index    INTEGER NOT NULL DEFAULT 0,   -- ordem na cadeia topo→consequência
  created_by     TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_by     TEXT, updated_at TEXT
);

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
```

> **Fatores de escalada (fase 3):** adicionar `escalation_factors` e `escalation_factor_barriers`. Fora do MVP.

### 5.4. PRAGMAs e journaling — importante

Por causa da sincronização (Seção 6), deixe o arquivo sempre consistente e simples de copiar:

```sql
PRAGMA journal_mode = DELETE;   -- NÃO usar WAL num arquivo que será sincronizado
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

> **Não use WAL** no arquivo destinado ao SharePoint: os arquivos `-wal`/`-shm` complicam a sincronização e causam corrupção. Em `DELETE`, em estado quiescente, existe só o `.db`.

---

## 6. Bancos na pasta do executável + compartilhamento via SharePoint

### 6.1. O problema (por que não abrir o DB direto da pasta sincronizada)

SQLite coordena acesso concorrente com **locks de arquivo do SO**, que **não funcionam de forma confiável em pastas sincronizadas** (OneDrive/SharePoint): o locking é silenciosamente não confiável e o serviço sincroniza o `.db` como **blob inteiro**, gerando **cópias em conflito** quando duas pessoas editam. Resultado: perda de dados ou corrupção. Por isso a disciplina de acesso fica na aplicação.

### 6.2. Layout de pastas (portátil, na raiz do executável)

Tudo isto vive na **mesma pasta do `.exe`**, e é essa pasta que é sincronizada pelo SharePoint:

```
<pasta do executável>  (sincronizada pelo SharePoint)
├─ BowtieStudio.exe
├─ bancos/
│  ├─ index.json                 # registro leve de projetos (para listar sem abrir tudo)
│  ├─ <projeto-a>.db             # 1 banco por projeto (canônico)
│  ├─ <projeto-a>.db.lock.json   # lock + heartbeat do projeto A
│  ├─ <projeto-b>.db
│  └─ <projeto-b>.db.lock.json
└─ backups/
   ├─ <projeto-a>_20260725_143000.db
   └─ ...
```

- O app **descobre** essas pastas a partir do diretório do próprio executável (em Rust, via `std::env::current_exe()`), cria `bancos/` e `backups/` se não existirem.
- **Cópia de trabalho** (a que o SQLite realmente abre) fica **fora** dessa pasta, em AppData local **não sincronizado** (ex.: `%APPDATA%/BowtieStudio/working/<projeto>.db`).
- **Dev vs produção:** em `tauri dev` o `.exe` está em `src-tauri/target/debug`, então `bancos/` cairia lá. Ter uma variável/config de "pasta de dados de dev" para não poluir; em produção, sempre relativo ao `.exe`.

`index.json` (registro de projetos):
```json
{
  "projects": [
    { "id": "01J...", "name": "Planta Química",
      "db_file": "planta-quimica.db",
      "created_by": "Fulano", "created_at": "2026-07-25T..." }
  ]
}
```
Conflitos no `index.json` são de baixo risco (afetam só a listagem, nunca os dados). Se um projeto sumir da lista por conflito de sync, ele reaparece ao ressincronizar.

### 6.3. Fluxo de trabalho (com heartbeat desde o início)

1. **Criar projeto → "Criar banco para o projeto":** o app gera o `slug` a partir do nome (ver 6.6), cria `bancos/<slug>.db`, roda as migrations, insere a única linha em `projects`, e adiciona a entrada em `index.json`.
2. **Abrir projeto:**
   - Copia `bancos/<projeto>.db` → **cópia de trabalho local** (AppData). Abre e edita **só a cópia local**.
   - **Lock com heartbeat:** ao entrar em modo de edição, grava `bancos/<projeto>.db.lock.json` com `{ user, email, machine, acquired_at, heartbeat }`.
   - **Parâmetros do heartbeat:** batida a cada **30s** (`HEARTBEAT_BEAT_MS = 30_000`); lock considerado **obsoleto após 3 min** sem batida (`LOCK_STALE_MS = 180_000`, ~6 batidas perdidas — margem para o atraso de sync do SharePoint). *(Se houver liberação indevida por sync lento, subir `LOCK_STALE_MS` para 5 min.)*
   - Se já existir lock com batida **recente** (dentro de 3 min) de outra pessoa → abrir em **somente leitura** e mostrar quem está editando.
   - Lock **obsoleto** (sem batida há mais de 3 min) pode ser reivindicado, com aviso.
3. **Sincronizar (publicar):**
   - Relê o `.db` em `bancos/` para detectar mudança de terceiros desde a abertura (comparar hash/`updated_at`). Divergência inesperada → alertar (Seção 6.4).
   - **Fecha a conexão** (estado quiescente), copia a cópia de trabalho por cima de `bancos/<projeto>.db` (copiar p/ temp + rename), grava backup carimbado em `backups/`, atualiza `heartbeat`.
   - Registra `SYNC` no `audit_log`.
4. **Fechar:** libera o lock (remove `.lock.json`), registra `UNLOCK`/`CLOSE`.
5. **Backups automáticos:** a cada sync, cópia em `backups/<projeto>_YYYYMMDD_HHMMSS.db`; rotacionar (ex.: manter últimos 30 por projeto).

> O lock é **advisory** (a sincronização do SharePoint tem atraso; não é lock atômico). Reduz muito a chance de edição simultânea, mas **backups + auditoria** são a rede de segurança real.

### 6.4. Regras que evitam corrupção

- **Uma única conexão** SQLite por vez; feche-a **antes** de qualquer cópia de arquivo.
- **Nunca** copie o `.db` com conexão aberta/escrevendo.
- `journal_mode = DELETE` (nada de `-wal`/`-shm` no SharePoint).
- Cópia atômica: escrever em temp + `rename` no destino.
- Após sync crítico: `PRAGMA integrity_check;`.

### 6.5. Merge / recuperação (fase 3)

Como IDs são ULID, bancos de origens diferentes não colidem. Isso viabiliza reconciliação futura via **export/import de bowtie em JSON** e regra "last-write-wins" por `updated_at`. **No MVP não há merge automático:** cópia de trabalho + heartbeat + backups + aviso de concorrência bastam.

### 6.6. Nome do arquivo `.db` (slug + deduplicação)

O nome do arquivo vem do nome do projeto, "sluguificado":

- minúsculas; remover acentos; espaços → hífens; remover tudo que não for `[a-z0-9-]`; colapsar hífens repetidos.
  - Ex.: `"Planta Química — Unidade 2"` → `planta-quimica-unidade-2.db`.
- **Deduplicação:** se `<slug>.db` já existir em `bancos/`, tentar `<slug>-2.db`, `<slug>-3.db`, … O nome de exibição do projeto continua sendo o texto original (guardado em `projects.name` e no `index.json`); só o **arquivo** ganha o sufixo.
- Se por algum motivo não sobrar slug (nome só com símbolos), usar um fragmento curto do ULID: `projeto-<6 chars do id>.db`.
- O `id` (ULID) do projeto é a chave real; o nome do arquivo é só conveniência humana e nunca é usado como identidade.

---

## 7. Canvas e algoritmo de layout

### 7.1. Derivação nós/arestas a partir do domínio

O grafo do React Flow é **derivado** do modelo relacional:

- 1 nó para o **Evento de Topo** (centro).
- Cada **ameaça**: 1 nó (coluna mais à esquerda) + cadeia de **barreiras preventivas** até o topo. Arestas: `ameaça → barreira₁ → … → topo`.
- Cada **consequência**: 1 nó (coluna mais à direita) + cadeia de **barreiras mitigatórias** do topo até ela. Arestas: `topo → barreira₁ → … → consequência`.

IDs lógicos: `threat:<id>`, `prev-barrier:<id>`, `top-event`, `mit-barrier:<id>`, `consequence:<id>`.

### 7.2. Layout determinístico (recomendado para o MVP)

Para a forma clássica de gravata, **não precisa de dagre**. Layout por colunas:

- **Eixo X = coluna:** `ameaças → barreiras prev. → EVENTO DE TOPO → barreiras mit. → consequências`, com largura de coluna fixa (ex.: 220px). O X de cada barreira = `x_topo ± (order_index+1) * largura_coluna`.
- **Eixo Y = raia:** cada ameaça/consequência ocupa uma raia horizontal (`y = base + linha_index * espaçamento`); as barreiras herdam o Y da sua cadeia.
- **Evento de topo** centralizado verticalmente.

Implemente como função pura `computeLayout(bowtieData) → { nodes, edges }`. Overrides em `node_positions` são aplicados por cima.

### 7.3. Dagre — só na fase 3

Guarde `@dagrejs/dagre` (rankdir `LR`) para quando entrarem fatores de escalada e o grafo deixar de ser linear por raia.

### 7.4. Interações do canvas

- Nós custom: `ThreatNode`, `BarrierNode` (preventiva/mitigatória com cores distintas), `TopEventNode`, `ConsequenceNode`.
- Clicar num nó → painel lateral para editar (label, descrição, `barrier_type`, `effectiveness` — via selects de ENUM).
- Botões para adicionar ameaça/consequência/barreira; reordenar barreiras (`order_index`).
- Zoom/pan, minimapa, `Background`, `Controls`.
- **Exportar PNG** (`toPng`/`html-to-image`).

---

## 8. Telas e fluxo de UX

1. **Identificação do usuário (gate).**
   - Ao abrir, se não houver usuário na sessão, pedir **nome + email (ambos obrigatórios)**.
   - Registrar/atualizar em `users`; guardar como usuário atual (estado + `tauri-plugin-store`).
   - Aviso: *"Nome e email serão registrados nas ações para fins de auditoria."*
2. **Home — Projetos.**
   - Lista lida de `bancos/index.json`. Ações: **Criar banco para o projeto**, abrir, renomear, excluir.
   - Abrir → cópia de trabalho local + tenta adquirir lock (heartbeat). Mostra *Editando* / *Somente leitura (Fulano está editando)*.
3. **Projeto — Sessões.** Listar/criar sessões. **`created_by` = usuário atual** (auditoria). Mostrar autor e data.
4. **Sessão — Bowties.** Listar/criar bowties, cada um com **nome + descrição** próprios.
5. **Editor de Bowtie.** Canvas + painéis laterais (perigo, evento de topo, ameaças, consequências, barreiras com selects de ENUM).
6. **Histórico / Auditoria.** Visualizador do `audit_log`, filtrável por usuário, entidade e período.
7. **Barra de status/sync (global).** Usuário atual · estado do lock/heartbeat · botão **Sincronizar** · último sync.

---

## 9. Auditoria

- **Atribuição, não autenticação.** Sem senha; nome e email declarados. Deixar explícito na UI/doc.
- **Toda mutação escreve no `audit_log` na mesma transação** da alteração. Centralizar na camada de repositório.
- `created_by/created_at/updated_by/updated_at` preenchidos automaticamente pela camada de repositório (usuário atual + `now()` UTC).
- Registrar eventos de ciclo: `OPEN`, `CLOSE`, `SYNC`, `LOCK`, `UNLOCK`. (O heartbeat em si **não** vira linha de auditoria, para não poluir; fica só no `.lock.json`.)
- `audit_log` é **append-only**.

---

## 10. Estrutura de pastas do projeto (código-fonte)

```
bowtie-studio/
├─ src/                          # Frontend React/TS
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ app/                       # roteamento, providers, layout global
│  ├─ i18n/strings.pt-BR.ts      # TODOS os textos da UI centralizados aqui
│  ├─ features/
│  │  ├─ user/                   # gate de identificação (nome + email)
│  │  ├─ projects/               # lista via index.json, "criar banco para projeto"
│  │  ├─ sessions/
│  │  ├─ bowties/
│  │  ├─ editor/                 # canvas React Flow
│  │  │  ├─ nodes/               # ThreatNode, BarrierNode, ...
│  │  │  ├─ layout.ts            # computeLayout() determinístico
│  │  │  └─ deriveGraph.ts       # domínio → nodes/edges
│  │  ├─ audit/
│  │  └─ sync/                   # lock+heartbeat, copiar DB, backups
│  ├─ db/
│  │  ├─ client.ts               # abre a cópia de trabalho, PRAGMAs
│  │  ├─ repositories/           # projectRepo, sessionRepo, ... (auditam + enums)
│  │  └─ ids.ts                  # gerador de ULID
│  ├─ store/                     # Zustand (usuário atual, projeto/bowtie aberto)
│  └─ types/                     # tipos de domínio + enums.ts
├─ src-tauri/
│  ├─ src/
│  │  ├─ lib.rs                  # registra plugins + migrations
│  │  ├─ main.rs
│  │  └─ commands/               # descobrir ./bancos, lock/heartbeat, backup, integrity_check
│  ├─ migrations/                # SQL de migração (v1, v2, ...)
│  ├─ capabilities/              # permissões (sql, fs, store)
│  └─ tauri.conf.json
├─ BOWTIE_APP_PLAN.md            # este documento
└─ package.json
```

Layout **em runtime** (portátil, ver 6.2): `BowtieStudio.exe` + `bancos/` + `backups/` na mesma pasta (sincronizada pelo SharePoint).

---

## 11. Comandos de desenvolvimento

```bash
# criar o app (uma vez)
npm create tauri-app@latest        # React + TypeScript + Vite

# dependências JS
npm i @xyflow/react @tauri-apps/plugin-sql @tauri-apps/plugin-fs \
      @tauri-apps/plugin-store zustand ulid html-to-image
# (dagre só na fase 3): npm i @dagrejs/dagre

# dependências Rust (dentro de src-tauri)
cargo add tauri-plugin-sql --features sqlite
cargo add tauri-plugin-fs tauri-plugin-store

# rodar em dev
npm run tauri dev

# build do executável
npm run tauri build
```

Não esquecer:
- Registrar os plugins em `src-tauri/src/lib.rs`.
- Declarar permissões em `src-tauri/capabilities/default.json` (sql, fs, store).
- Definir as **migrations** no builder do `tauri-plugin-sql` (Rust), `version` única e incremental.
- Comando Rust para resolver o diretório do executável e garantir `bancos/`/`backups/`.

---

## 12. Roadmap por fases

### Fase 0 — Fundação
- Scaffold Tauri + React + TS.
- Plugin SQL + migration v1 (com `CHECK`/enums).
- Gerador de ULID, `client.ts` com PRAGMAs.
- Gate de identificação (nome + email obrigatórios).
- Arquivo único de strings PT-BR.

### Fase 1 — MVP (CRUD + auditoria, um db por projeto, ainda local)
- Descoberta de `./bancos/` + `index.json`; **"criar banco para o projeto"**.
- CRUD Projeto → Sessões → Bowties (com `created_by` e auditoria).
- Editor básico: ameaças, consequências, barreiras (formulários com selects de ENUM).
- `audit_log` gravando todas as mutações.
- Ainda **sem sync** (validar modelo com bancos locais).

### Fase 2 — Canvas + sincronização SharePoint + heartbeat
- Canvas React Flow com layout determinístico por colunas.
- Nós custom, edição por painel lateral, **exportar PNG**.
- **Cópia de trabalho local + lock com heartbeat + backups automáticos**.
- Detecção de edição concorrente e aviso; `integrity_check` pós-sync.

### Fase 3 — Avançado
- Fatores de escalada e controles (+ dagre se necessário).
- Merge/import de bowtie via JSON.
- Filtros ricos na auditoria; relatórios.
- (Eventual) i18n de verdade e autenticação, se um dia forem necessários.

---

## 13. Convenções e regras de ouro (para o agente)

1. **Segurança do banco acima de tudo:** nunca abrir o `.db` direto de `./bancos/`; sempre cópia de trabalho; fechar conexão antes de copiar; nunca WAL.
2. **Toda mutação passa pela camada de repositório**, que preenche `*_by`/`*_at` e grava no `audit_log` na mesma transação.
3. **IDs sempre ULID** gerados na aplicação (nunca autoincrement).
4. **Datas em ISO-8601 UTC.**
5. **Campos restritos sempre ENUM:** `CHECK` no SQLite + union type no TS; UI usa `<select>`. Nunca texto livre nesses campos.
6. **Um banco por projeto**; criação sempre pela função "criar banco para o projeto" (cria `.db`, roda migrations, atualiza `index.json`).
7. **Textos da UI centralizados** em `src/i18n/strings.pt-BR.ts` (sem biblioteca de i18n por ora, mas nada de string solta no JSX).
8. **Layout do bowtie é função pura e determinística**; posições manuais são override opcional.
9. **TypeScript estrito.**
10. **Incremental:** cada fase funcionando ponta a ponta antes de avançar.
11. Quando algo não estiver neste documento, **perguntar** — não assumir.

---

## 14. Decisões

### Fechadas
- ✅ Lock com **heartbeat automático** desde a fase 2 (sem check-out manual). **Batida 30s, expiração 3 min** (subir p/ 5 min se o sync do SharePoint atrasar muito).
- ✅ **Um `.db` por projeto**, criado via "criar banco para o projeto".
- ✅ Pastas `bancos/` e `backups/` na **raiz do executável** (sincronizadas pelo SharePoint).
- ✅ **Email obrigatório** (junto do nome).
- ✅ **Sem autenticação** por enquanto.
- ✅ **Export só PNG** por enquanto.
- ✅ **Sem i18n** (só PT-BR), mas textos centralizados.
- ✅ **Sempre ENUM** (via `CHECK` + union types).
- ✅ **`barrier_type` = taxonomia canônica CCPS (5 tipos, princípio Detectar–Decidir–Agir):** `hardware_passivo`, `hardware_ativo`, `hardware_ativo_humano`, `humano_comportamental`, `hardware_continuo` (ver 5.1).
- ✅ **Nome do arquivo `.db` = slug do nome do projeto**, com deduplicação por sufixo `-2`, `-3`… (ver 6.6).

### A confirmar
- [ ] Valores de `effectiveness`: `alta | media | baixa | nao_avaliada`. OK, ou prefere escala numérica / outro rótulo?
- [ ] Quantidade de backups a reter por projeto (proposto 30).
- [ ] Deseja também um campo/aba de **planos de ação** por barreira (etapa 7 da metodologia Bow Tie)? Fora do MVP, mas vale decidir cedo se o modelo já deve prever.

---

## 15. Referências técnicas úteis

- SQLite — *How To Corrupt An SQLite Database File* (por que evitar rede/sync): `sqlite.org/howtocorrupt.html`
- Tauri SQL plugin: `@tauri-apps/plugin-sql` / crate `tauri-plugin-sql` (feature `sqlite`, migrations em Rust).
- React Flow v12: `reactflow.dev` — pacote `@xyflow/react`, guia de migração v12, layout com dagre.
- dagre: `@dagrejs/dagre` (rankdir `LR`) — apenas para grafos complexos (fase 3).
- **Metodologia Bow Tie / classificação de barreiras:** padronização CCPS/DNV-GL (5 tipos, Detectar–Decidir–Agir); base de conhecimento "Barrier types" da Wolters Kluwer (BowTieXP); IOGP 544/415 (definição de barreiras em segurança de processo). Termos-chave: barreira **efetiva, independente e auditável**; regra do mínimo de 2 barreiras por lado (IOGP).

---

*Fim do documento. Mantenha-o versionado junto ao código.*