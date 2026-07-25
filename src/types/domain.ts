import type { BarrierType, Effectiveness } from './enums';

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
  order_index: number;
}

export interface Consequence extends AuditFields {
  id: string;
  bowtie_id: string;
  label: string;
  description: string | null;
  order_index: number;
}

export interface PreventiveBarrier extends AuditFields {
  id: string;
  threat_id: string;
  label: string;
  description: string | null;
  barrier_type: BarrierType | null;
  effectiveness: Effectiveness;
  order_index: number;
}

export interface MitigativeBarrier extends AuditFields {
  id: string;
  consequence_id: string;
  label: string;
  description: string | null;
  barrier_type: BarrierType | null;
  effectiveness: Effectiveness;
  order_index: number;
}
