import type { Bowtie, Consequence, MitigativeBarrier, PreventiveBarrier, Threat } from '../../../types/domain';

// IDs lógicos dos nós (about.md, Seção 7.1): threat:<id>, prev-barrier:<id>,
// top-event, mit-barrier:<id>, consequence:<id>.
export type BowtieNodeData =
  | { kind: 'top-event'; bowtie: Bowtie }
  | { kind: 'threat'; threat: Threat }
  | { kind: 'consequence'; consequence: Consequence }
  | { kind: 'prevention-barrier'; barrier: PreventiveBarrier; threatId: string }
  | { kind: 'mitigation-barrier'; barrier: MitigativeBarrier; consequenceId: string };

export type BowtieNodeKind = BowtieNodeData['kind'];
