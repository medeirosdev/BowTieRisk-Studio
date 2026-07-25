// Enums do domínio Bow Tie. Ver about.md, Seção 5.1.
// SQLite não tem tipo ENUM nativo: cada campo restrito usa TEXT/INTEGER + CHECK
// no schema (src-tauri/migrations) e o union type correspondente aqui.

export const BARRIER_TYPES = [
  'hardware_passivo',
  'hardware_ativo',
  'hardware_ativo_humano',
  'humano_comportamental',
  'hardware_continuo',
] as const;
export type BarrierType = typeof BARRIER_TYPES[number];

export const BARRIER_TYPE_LABELS: Record<BarrierType, string> = {
  hardware_passivo: 'Hardware Passivo',
  hardware_ativo: 'Hardware Ativo',
  hardware_ativo_humano: 'Hardware Ativo + Humano',
  humano_comportamental: 'Humano / Comportamental',
  hardware_continuo: 'Hardware Contínuo',
};

// Efetividade: escala numérica 1 (muito baixa) a 5 (muito alta).
// `null` significa "não avaliada" (decisão registrada em about.md, Seção 14).
export const EFFECTIVENESS_SCALE = [1, 2, 3, 4, 5] as const;
export type Effectiveness = typeof EFFECTIVENESS_SCALE[number] | null;

export const EFFECTIVENESS_LABELS: Record<typeof EFFECTIVENESS_SCALE[number], string> = {
  1: 'Muito baixa',
  2: 'Baixa',
  3: 'Média',
  4: 'Alta',
  5: 'Muito alta',
};
export const EFFECTIVENESS_NOT_EVALUATED_LABEL = 'Não avaliada';

export const AUDIT_ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'OPEN', 'CLOSE', 'SYNC', 'LOCK', 'UNLOCK',
] as const;
export type AuditAction = typeof AUDIT_ACTIONS[number];

// Lado da gravata ao qual uma barreira pertence — usado para referenciar a
// barreira de forma polimórfica em action_plans (preventive_barriers e
// mitigative_barriers são tabelas separadas).
export const BARRIER_KINDS = ['preventive', 'mitigative'] as const;
export type BarrierKind = typeof BARRIER_KINDS[number];

// Plano de ação por barreira (etapa 7 da metodologia Bow Tie).
export const ACTION_PLAN_STATUSES = [
  'pendente', 'em_andamento', 'concluido', 'cancelado',
] as const;
export type ActionPlanStatus = typeof ACTION_PLAN_STATUSES[number];

export const ACTION_PLAN_STATUS_LABELS: Record<ActionPlanStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};
