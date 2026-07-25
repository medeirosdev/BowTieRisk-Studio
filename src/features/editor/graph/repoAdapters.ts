import { createConsequence, deleteConsequence, listConsequences, reorderConsequence, updateConsequence } from '../../../db/repositories/consequenceRepo';
import {
  createMitigativeBarrier,
  deleteMitigativeBarrier,
  listMitigativeBarriers,
  reorderMitigativeBarrier,
  updateMitigativeBarrier,
} from '../../../db/repositories/mitigativeBarrierRepo';
import {
  createPreventiveBarrier,
  deletePreventiveBarrier,
  listPreventiveBarriers,
  reorderPreventiveBarrier,
  updatePreventiveBarrier,
} from '../../../db/repositories/preventiveBarrierRepo';
import { createThreat, deleteThreat, listThreats, reorderThreat, updateThreat } from '../../../db/repositories/threatRepo';

// Mesmo padrão de adaptador da Fase 1 (BowtieColumn): os dois lados da
// gravata são estruturalmente idênticos, só muda qual repositório usar.
export const threatRepo = { list: listThreats, create: createThreat, update: updateThreat, remove: deleteThreat, reorder: reorderThreat };
export const preventiveBarrierRepo = {
  list: listPreventiveBarriers,
  create: createPreventiveBarrier,
  update: updatePreventiveBarrier,
  remove: deletePreventiveBarrier,
  reorder: reorderPreventiveBarrier,
};
export const consequenceRepo = { list: listConsequences, create: createConsequence, update: updateConsequence, remove: deleteConsequence, reorder: reorderConsequence };
export const mitigativeBarrierRepo = {
  list: listMitigativeBarriers,
  create: createMitigativeBarrier,
  update: updateMitigativeBarrier,
  remove: deleteMitigativeBarrier,
  reorder: reorderMitigativeBarrier,
};
