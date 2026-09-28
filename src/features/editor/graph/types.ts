import type { Bowtie, Category, Consequence, MitigativeBarrier, PreventiveBarrier, Threat } from '../../../types/domain';

// IDs lógicos dos nós (about.md, Seção 7.1): threat:<id>, prev-barrier:<id>,
// top-event, mit-barrier:<id>, consequence:<id>.
export type BowtieNodeData =
  | { kind: 'top-event'; bowtie: Bowtie }
  | { kind: 'threat'; threat: Threat; category: Category | null }
  | { kind: 'consequence'; consequence: Consequence; category: Category | null }
  | { kind: 'prevention-barrier'; barrier: PreventiveBarrier; threatId: string }
  | { kind: 'mitigation-barrier'; barrier: MitigativeBarrier; consequenceId: string };

export type BowtieNodeKind = BowtieNodeData['kind'];
