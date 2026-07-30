import type { Node } from '@xyflow/react';
import { FormEvent, useEffect, useState } from 'react';
import { updateBowtie } from '../../../db/repositories/bowtieRepo';
import { strings } from '../../../i18n/strings.pt-BR';
import type { CurrentUser } from '../../../store/currentUserStore';
import { useDialog } from '../../ui/DialogProvider';
import type { Bowtie } from '../../../types/domain';
import type { BarrierTypeRow } from '../../../db/repositories/barrierTypeRepo';
import { EFFECTIVENESS_LABELS, EFFECTIVENESS_NOT_EVALUATED_LABEL, EFFECTIVENESS_SCALE } from '../../../types/enums';
import type { Effectiveness } from '../../../types/enums';
import type { BarrierInput } from '../../../db/repositories/preventiveBarrierRepo';
import type { BowtieGraphData } from './deriveGraph';
import { consequenceRepo, mitigativeBarrierRepo, preventiveBarrierRepo, threatRepo } from './repoAdapters';
import type { BowtieNodeData } from './types';

type OrderedEntity = { id: string; label: string; description: string | null; order_index: number };
type BarrierEntity = {
  id: string;
  label: string;
  description: string | null;
  barrier_type: string | null;
  effectiveness: Effectiveness;
  order_index: number;
};

interface ItemRepo<TItem extends OrderedEntity> {
  update: (dbPath: string, item: TItem, label: string, description: string | null, user: CurrentUser) => Promise<void>;
  remove: (dbPath: string, item: TItem, user: CurrentUser) => Promise<void>;
}

interface BarrierRepo<TBarrier extends BarrierEntity> {
  create: (dbPath: string, itemId: string, input: BarrierInput, user: CurrentUser) => Promise<TBarrier>;
  update: (dbPath: string, barrier: TBarrier, input: BarrierInput, user: CurrentUser) => Promise<void>;
  remove: (dbPath: string, barrier: TBarrier, user: CurrentUser) => Promise<void>;
  reorder: (dbPath: string, barriers: TBarrier[], id: string, direction: 'up' | 'down', user: CurrentUser) => Promise<void>;
}

interface SidePanelProps {
  dbPath: string;
  user: CurrentUser;
  graph: BowtieGraphData;
  barrierTypes: BarrierTypeRow[];
  selectedNode: Node<BowtieNodeData> | null;
  creatingSide: 'threat' | 'consequence' | null;
  readOnly: boolean;
  onClose: () => void;
  onReload: () => Promise<void> | void;
}

export function SidePanel({ dbPath, user, graph, barrierTypes, selectedNode, creatingSide, readOnly, onClose, onReload }: SidePanelProps) {
  if (creatingSide) {
    return (
      <aside className="side-panel">
        <NewLaneItemForm
          dbPath={dbPath}
          bowtieId={graph.bowtie.id}
          user={user}
          side={creatingSide}
          onDone={onReload}
          onClose={onClose}
        />
      </aside>
    );
  }

  if (!selectedNode) return null;

  return (
    <aside className="side-panel">
      {selectedNode.data.kind === 'top-event' && (
        <TopEventPanel dbPath={dbPath} user={user} bowtie={graph.bowtie} readOnly={readOnly} onSaved={onReload} onClose={onClose} />
      )}

      {selectedNode.data.kind === 'threat' && (
        <LaneItemPanel
          key={selectedNode.id}
          dbPath={dbPath}
          user={user}
          item={selectedNode.data.threat}
          barriers={graph.preventiveBarriersByThreat[selectedNode.data.threat.id] ?? []}
          barrierTypes={barrierTypes}
          itemRepo={threatRepo}
          barrierRepo={preventiveBarrierRepo}
          itemNounSingular={strings.editor.threatNoun}
          barrierNounSingular={strings.editor.preventiveBarrierNoun}
          readOnly={readOnly}
          onReload={onReload}
          onClose={onClose}
        />
      )}

      {selectedNode.data.kind === 'consequence' && (
        <LaneItemPanel
          key={selectedNode.id}
          dbPath={dbPath}
          user={user}
          item={selectedNode.data.consequence}
          barriers={graph.mitigativeBarriersByConsequence[selectedNode.data.consequence.id] ?? []}
          barrierTypes={barrierTypes}
          itemRepo={consequenceRepo}
          barrierRepo={mitigativeBarrierRepo}
          itemNounSingular={strings.editor.consequenceNoun}
          barrierNounSingular={strings.editor.mitigativeBarrierNoun}
          readOnly={readOnly}
          onReload={onReload}
          onClose={onClose}
        />
      )}

      {selectedNode.data.kind === 'prevention-barrier' && (
        <BarrierPanel
          key={selectedNode.id}
          dbPath={dbPath}
          user={user}
          barrier={selectedNode.data.barrier}
          barrierTypes={barrierTypes}
          barrierRepo={preventiveBarrierRepo}
          barrierNounSingular={strings.editor.preventiveBarrierNoun}
          readOnly={readOnly}
          onReload={onReload}
          onClose={onClose}
        />
      )}

      {selectedNode.data.kind === 'mitigation-barrier' && (
        <BarrierPanel
          key={selectedNode.id}
          dbPath={dbPath}
          user={user}
          barrier={selectedNode.data.barrier}
          barrierTypes={barrierTypes}
          barrierRepo={mitigativeBarrierRepo}
          barrierNounSingular={strings.editor.mitigativeBarrierNoun}
          readOnly={readOnly}
          onReload={onReload}
          onClose={onClose}
        />
      )}
    </aside>
  );
}

// ============ Evento de topo (perigo + evento de topo) ============
function TopEventPanel({
  dbPath,
  user,
  bowtie,
  readOnly,
  onSaved,
  onClose,
}: {
  dbPath: string;
  user: CurrentUser;
  bowtie: Bowtie;
  readOnly: boolean;
  onSaved: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [hazard, setHazard] = useState(bowtie.hazard ?? '');
  const [topEvent, setTopEvent] = useState(bowtie.top_event ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHazard(bowtie.hazard ?? '');
    setTopEvent(bowtie.top_event ?? '');
  }, [bowtie.id, bowtie.hazard, bowtie.top_event]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await updateBowtie(
        dbPath,
        bowtie,
        { name: bowtie.name, description: bowtie.description, hazard: hazard.trim() || null, top_event: topEvent.trim() || null },
        user,
      );
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="side-panel__head">
        <span className="section-title">{strings.editor.headerTitle}</span>
        <button type="button" className="icon-btn" onClick={onClose}>
          {strings.common.close}
        </button>
      </div>
      <fieldset className="form-fieldset" disabled={readOnly}>
        <label className="field">
          {strings.editor.hazardLabel}
          <input value={hazard} onChange={(e) => setHazard(e.target.value)} placeholder={strings.editor.hazardPlaceholder} />
        </label>
        <label className="field">
          {strings.editor.topEventLabel}
          <input value={topEvent} onChange={(e) => setTopEvent(e.target.value)} placeholder={strings.editor.topEventPlaceholder} />
        </label>
        <div className="form__actions">
          <button type="submit" disabled={saving}>
            {strings.common.save}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

// ============ Ameaça / Consequência (com sua cadeia de barreiras) ============
interface LaneItemPanelProps<TItem extends OrderedEntity, TBarrier extends BarrierEntity> {
  dbPath: string;
  user: CurrentUser;
  item: TItem;
  barriers: TBarrier[];
  barrierTypes: BarrierTypeRow[];
  itemRepo: ItemRepo<TItem>;
  barrierRepo: BarrierRepo<TBarrier>;
  itemNounSingular: string;
  barrierNounSingular: string;
  readOnly: boolean;
  onReload: () => Promise<void> | void;
  onClose: () => void;
}

function LaneItemPanel<TItem extends OrderedEntity, TBarrier extends BarrierEntity>({
  dbPath,
  user,
  item,
  barriers,
  barrierTypes,
  itemRepo,
  barrierRepo,
  itemNounSingular,
  barrierNounSingular,
  readOnly,
  onReload,
  onClose,
}: LaneItemPanelProps<TItem, TBarrier>) {
  const [label, setLabel] = useState(item.label);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useDialog();

  useEffect(() => setLabel(item.label), [item.id, item.label]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await itemRepo.update(dbPath, item, trimmed, item.description, user);
      await onReload();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!(await confirm(strings.editor.confirmDeleteItem(item.label)))) return;
    try {
      await itemRepo.remove(dbPath, item, user);
      onClose();
      await onReload();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  async function handleAddBarrier(input: BarrierInput) {
    try {
      await barrierRepo.create(dbPath, item.id, input, user);
      await onReload();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  async function handleRemoveBarrier(barrier: TBarrier) {
    if (!(await confirm(strings.editor.confirmDeleteItem(barrier.label)))) return;
    try {
      await barrierRepo.remove(dbPath, barrier, user);
      await onReload();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  async function handleReorderBarrier(id: string, direction: 'up' | 'down') {
    try {
      await barrierRepo.reorder(dbPath, barriers, id, direction, user);
      await onReload();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  return (
    <div>
      <div className="side-panel__head">
        <span className="section-title">{itemNounSingular}</span>
        <button type="button" className="icon-btn" onClick={onClose}>
          {strings.common.close}
        </button>
      </div>

      <form className="form" onSubmit={submit}>
        <fieldset className="form-fieldset" disabled={readOnly}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
          <div className="form__actions">
            <button type="button" className="btn-danger" onClick={() => void handleDelete()}>
              {strings.common.delete}
            </button>
            <button type="submit" disabled={saving}>
              {strings.common.save}
            </button>
          </div>
        </fieldset>
      </form>

      {error && <p className="error-text">{error}</p>}

      <div className="side-panel__section-title">{barrierNounSingular}</div>
      <BarrierManager
        barriers={barriers}
        barrierTypes={barrierTypes}
        barrierNounSingular={barrierNounSingular}
        readOnly={readOnly}
        onAdd={handleAddBarrier}
        onRemove={handleRemoveBarrier}
        onReorder={handleReorderBarrier}
      />
    </div>
  );
}

// ============ Gerenciador de barreiras (lista + form de adicionar) ============
interface BarrierManagerProps<TBarrier extends BarrierEntity> {
  barriers: TBarrier[];
  barrierTypes: BarrierTypeRow[];
  barrierNounSingular: string;
  readOnly: boolean;
  onAdd: (input: BarrierInput) => void;
  onRemove: (barrier: TBarrier) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
}

function BarrierManager<TBarrier extends BarrierEntity>({ barriers, barrierTypes, barrierNounSingular, readOnly, onAdd, onRemove, onReorder }: BarrierManagerProps<TBarrier>) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [barrierType, setBarrierType] = useState('');
  const [effectiveness, setEffectiveness] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError(strings.editor.barrierLabelRequired);
      return;
    }
    setError(null);
    onAdd({ label: trimmed, description: null, barrier_type: barrierType || null, effectiveness: effectiveness ? (Number(effectiveness) as Effectiveness) : null });
    setLabel('');
    setBarrierType('');
    setEffectiveness('');
    setAdding(false);
  }

  return (
    <div className="barrier-list">
      {barriers.map((barrier, index) => (
        <div className="barrier-item" key={barrier.id}>
          <div className="barrier-item__head">
            <span>{barrier.label}</span>
            {!readOnly && (
              <div className="list-item__actions">
                <button className="icon-btn" disabled={index === 0} onClick={() => onReorder(barrier.id, 'up')}>
                  ↑
                </button>
                <button className="icon-btn" disabled={index === barriers.length - 1} onClick={() => onReorder(barrier.id, 'down')}>
                  ↓
                </button>
                <button className="icon-btn icon-btn--danger" onClick={() => onRemove(barrier)}>
                  {strings.common.delete}
                </button>
              </div>
            )}
          </div>
          <div className="barrier-item__badges">
            <span className="badge badge--neutral">{barrier.barrier_type ?? strings.editor.noBarrierType}</span>
            <span className="badge badge--neutral">{barrier.effectiveness ? EFFECTIVENESS_LABELS[barrier.effectiveness] : EFFECTIVENESS_NOT_EVALUATED_LABEL}</span>
          </div>
        </div>
      ))}

      {!readOnly &&
        (adding ? (
          <form className="form" onSubmit={submit}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={strings.editor.barrierLabelPlaceholder(barrierNounSingular)} autoFocus />
            {error && <p className="error-text">{error}</p>}
            <div className="form__row">
              <select value={barrierType} onChange={(e) => setBarrierType(e.target.value)}>
                <option value="">{strings.editor.barrierTypePlaceholder}</option>
                {barrierTypes.map((type) => (
                  <option key={type.id} value={type.label}>
                    {type.label}
                  </option>
                ))}
              </select>
              <select value={effectiveness} onChange={(e) => setEffectiveness(e.target.value)}>
                <option value="">{EFFECTIVENESS_NOT_EVALUATED_LABEL}</option>
                {EFFECTIVENESS_SCALE.map((value) => (
                  <option key={value} value={value}>
                    {value} — {EFFECTIVENESS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form__actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setAdding(false);
                  setError(null);
                }}
              >
                {strings.common.cancel}
              </button>
              <button type="submit">{strings.common.add}</button>
            </div>
          </form>
        ) : (
          <button type="button" className="icon-btn" onClick={() => setAdding(true)}>
            + {strings.editor.addBarrier(barrierNounSingular)}
          </button>
        ))}
    </div>
  );
}

// ============ Edição de uma barreira específica ============
interface BarrierPanelProps<TBarrier extends BarrierEntity> {
  dbPath: string;
  user: CurrentUser;
  barrier: TBarrier;
  barrierTypes: BarrierTypeRow[];
  barrierRepo: Pick<BarrierRepo<TBarrier>, 'update' | 'remove'>;
  barrierNounSingular: string;
  readOnly: boolean;
  onReload: () => Promise<void> | void;
  onClose: () => void;
}

function BarrierPanel<TBarrier extends BarrierEntity>({ dbPath, user, barrier, barrierTypes, barrierRepo, barrierNounSingular, readOnly, onReload, onClose }: BarrierPanelProps<TBarrier>) {
  const [label, setLabel] = useState(barrier.label);
  const [description, setDescription] = useState(barrier.description ?? '');
  const [barrierType, setBarrierType] = useState(barrier.barrier_type ?? '');
  const [effectiveness, setEffectiveness] = useState(barrier.effectiveness ? String(barrier.effectiveness) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useDialog();

  useEffect(() => {
    setLabel(barrier.label);
    setDescription(barrier.description ?? '');
    setBarrierType(barrier.barrier_type ?? '');
    setEffectiveness(barrier.effectiveness ? String(barrier.effectiveness) : '');
  }, [barrier.id, barrier.label, barrier.description, barrier.barrier_type, barrier.effectiveness]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await barrierRepo.update(dbPath, barrier, { label: trimmed, description: description.trim() || null, barrier_type: barrierType || null, effectiveness: effectiveness ? (Number(effectiveness) as Effectiveness) : null }, user);
      await onReload();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!(await confirm(strings.editor.confirmDeleteItem(barrier.label)))) return;
    try {
      await barrierRepo.remove(dbPath, barrier, user);
      onClose();
      await onReload();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="side-panel__head">
        <span className="section-title">{barrierNounSingular}</span>
        <button type="button" className="icon-btn" onClick={onClose}>
          {strings.common.close}
        </button>
      </div>

      <fieldset className="form-fieldset" disabled={readOnly}>
        <label className="field">
          {strings.editor.barrierLabelPlaceholder(barrierNounSingular)}
          <input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
        </label>

        <label className="field">
          {strings.editor.descriptionLabel}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={strings.editor.descriptionPlaceholder} />
        </label>

        <label className="field">
          {strings.editor.barrierTypePlaceholder}
          <select value={barrierType} onChange={(e) => setBarrierType(e.target.value)}>
            <option value="">{strings.editor.barrierTypePlaceholder}</option>
            {barrierType && !barrierTypes.some((t) => t.label === barrierType) && (
              <option value={barrierType}>{barrierType}</option>
            )}
            {barrierTypes.map((type) => (
              <option key={type.id} value={type.label}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          {strings.editor.effectivenessLabel}
          <select value={effectiveness} onChange={(e) => setEffectiveness(e.target.value)}>
            <option value="">{EFFECTIVENESS_NOT_EVALUATED_LABEL}</option>
            {EFFECTIVENESS_SCALE.map((value) => (
              <option key={value} value={value}>
                {value} — {EFFECTIVENESS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="error-text">{error}</p>}

        <div className="form__actions">
          <button type="button" className="btn-danger" onClick={() => void handleDelete()}>
            {strings.common.delete}
          </button>
          <button type="submit" disabled={saving}>
            {strings.common.save}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

// ============ Nova ameaça / consequência ============
function NewLaneItemForm({
  dbPath,
  bowtieId,
  user,
  side,
  onDone,
  onClose,
}: {
  dbPath: string;
  bowtieId: string;
  user: CurrentUser;
  side: 'threat' | 'consequence';
  onDone: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isThreat = side === 'threat';

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      if (isThreat) {
        await threatRepo.create(dbPath, bowtieId, trimmed, null, user);
      } else {
        await consequenceRepo.create(dbPath, bowtieId, trimmed, null, user);
      }
      setLabel('');
      await onDone();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="side-panel__head">
        <span className="section-title">{isThreat ? strings.editor.threatNoun : strings.editor.consequenceNoun}</span>
        <button type="button" className="icon-btn" onClick={onClose}>
          {strings.common.close}
        </button>
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={isThreat ? strings.editor.threatPlaceholder : strings.editor.consequencePlaceholder}
        autoFocus
      />
      {error && <p className="error-text">{error}</p>}
      <div className="form__actions">
        <button type="submit" disabled={saving}>
          {strings.common.add}
        </button>
      </div>
    </form>
  );
}
