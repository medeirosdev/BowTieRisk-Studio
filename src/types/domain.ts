import type { Effectiveness } from './enums';

interface AuditFields {
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
}

export interface Project extends AuditFields {
  id: string;
  name: string;
  description: string | null;
  // Aviso geral do projeto (ex.: "não mexer no bowtie X, em revisão") —
  // um só por projeto, com autor e data.
  notice: string | null;
  notice_by: string | null;
  notice_at: string | null;
}

export type CategoryKind = 'threat' | 'consequence';

// Categoria de ameaça ou consequência, personalizável por projeto. Uma lista
// separada por tipo (kind); a cor é uma chave da paleta fixa
// (features/categories/palette.ts).
export interface Category {
  id: string;
  kind: CategoryKind;
  label: string;
  color: string;
  order_index: number;
}

export interface Session extends AuditFields {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
}

export interface Bowtie extends AuditFields {
  id: string;
  session_id: string;
  name: string;
  description: string | null;
  hazard: string | null;
  top_event: string | null;
}

export interface Threat extends AuditFields {
  id: string;
  bowtie_id: string;
  label: string;
  description: string | null;
  category_id: string | null;
  order_index: number;
}

export interface Consequence extends AuditFields {
  id: string;
  bowtie_id: string;
  label: string;
  description: string | null;
  category_id: string | null;
  order_index: number;
}

export interface PreventiveBarrier extends AuditFields {
  id: string;
  threat_id: string;
  label: string;
  description: string | null;
  barrier_type: string | null;
  effectiveness: Effectiveness;
  order_index: number;
}

export interface MitigativeBarrier extends AuditFields {
  id: string;
  consequence_id: string;
  label: string;
  description: string | null;
  barrier_type: string | null;
  effectiveness: Effectiveness;
  order_index: number;
}
