import { FormEvent, useEffect, useState } from 'react';
import { strings } from '../../i18n/strings.pt-BR';
import type { CurrentUser } from '../../store/currentUserStore';
import { BARRIER_TYPE_LABELS, BARRIER_TYPES, EFFECTIVENESS_LABELS, EFFECTIVENESS_NOT_EVALUATED_LABEL, EFFECTIVENESS_SCALE } from '../../types/enums';
import type { BarrierType, Effectiveness } from '../../types/enums';
import type { BarrierInput } from '../../db/repositories/preventiveBarrierRepo';

type OrderedEntity = { id: string; label: string; description: string | null; order_index: number };
type BarrierEntity = {
  id: string;
  label: string;
  description: string | null;
  barrier_type: BarrierType | null;
  effectiveness: Effectiveness;
  order_index: number;
};

interface ItemRepo<TItem extends OrderedEntity> {
  list: (dbPath: string, bowtieId: string) => Promise<TItem[]>;
  create: (dbPath: string, bowtieId: string, label: string, description: string | null, user: CurrentUser) => Promise<TItem>;
  remove: (dbPath: string, item: TItem, user: CurrentUser) => Promise<void>;
  reorder: (dbPath: string, items: TItem[], id: string, direction: 'up' | 'down', user: CurrentUser) => Promise<void>;
}

interface BarrierRepo<TBarrier extends BarrierEntity> {
  list: (dbPath: string, itemId: string) => Promise<TBarrier[]>;
  create: (dbPath: string, itemId: string, input: BarrierInput, user: CurrentUser) => Promise<TBarrier>;
  remove: (dbPath: string, barrier: TBarrier, user: CurrentUser) => Promise<void>;
  reorder: (dbPath: string, barriers: TBarrier[], id: string, direction: 'up' | 'down', user: CurrentUser) => Promise<void>;
}

interface BowtieColumnProps<TItem extends OrderedEntity, TBarrier extends BarrierEntity> {
  accentClass: string;
  title: string;
  itemNounSingular: string;
  itemPlaceholder: string;
  barrierNounSingular: string;
  dbPath: string;
  bowtieId: string;
  user: CurrentUser;
  itemRepo: ItemRepo<TItem>;
  barrierRepo: BarrierRepo<TBarrier>;
}

export function BowtieColumn<TItem extends OrderedEntity, TBarrier extends BarrierEntity>({
  accentClass,
  title,
  itemNounSingular,
  itemPlaceholder,
  barrierNounSingular,
  dbPath,
  bowtieId,
  user,
  itemRepo,
  barrierRepo,
}: BowtieColumnProps<TItem, TBarrier>) {
  const [items, setItems] = useState<TItem[]>([]);
  const [barriersByItem, setBarriersByItem] = useState<Record<string, TBarrier[]>>({});
  const [newItemLabel, setNewItemLabel] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshItems();
  }, [bowtieId]);

  async function refreshItems() {
    try {
      const list = await itemRepo.list(dbPath, bowtieId);
      setItems(list);
      const entries = await Promise.all(list.map(async (item) => [item.id, await barrierRepo.list(dbPath, item.id)] as const));
      setBarriersByItem(Object.fromEntries(entries));
    } catch (err) {
      console.error(err);
      setError(strings.common.loadError);
    }
  }

  async function handleAddItem(event: FormEvent) {
    event.preventDefault();
    if (addingItem) return;
    const label = newItemLabel.trim();
    if (!label) return;
    setAddingItem(true);
    try {
      await itemRepo.create(dbPath, bowtieId, label, null, user);
      setNewItemLabel('');
      await refreshItems();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    } finally {
      setAddingItem(false);
    }
  }

  async function handleRemoveItem(item: TItem) {
    if (!window.confirm(strings.editor.confirmDeleteItem(item.label))) return;
    try {
      await itemRepo.remove(dbPath, item, user);
      await refreshItems();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  async function handleReorderItem(id: string, direction: 'up' | 'down') {
    try {
      await itemRepo.reorder(dbPath, items, id, direction, user);
      await refreshItems();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  async function handleAddBarrier(item: TItem, input: BarrierInput) {
    try {
      await barrierRepo.create(dbPath, item.id, input, user);
      await refreshItems();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  async function handleRemoveBarrier(barrier: TBarrier) {
    if (!window.confirm(strings.editor.confirmDeleteItem(barrier.label))) return;
    try {
      await barrierRepo.remove(dbPath, barrier, user);
      await refreshItems();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  async function handleReorderBarrier(item: TItem, id: string, direction: 'up' | 'down') {
    try {
      await barrierRepo.reorder(dbPath, barriersByItem[item.id] ?? [], id, direction, user);
      await refreshItems();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    }
  }

  return (
    <div className={`panel ${accentClass}`}>
      <div className="bowtie-column__header">
        <span className="section-title">{title}</span>
      </div>

      {error && <p className="error-text">{error}</p>}

      {items.length === 0 && <p className="empty-state">{strings.editor.emptyItems(itemNounSingular)}</p>}

      <div className="list">
        {items.map((item, index) => (
          <div className="list-item list-item--stacked" key={item.id}>
            <div className="list-item__head">
              <span className="list-item__title">{item.label}</span>
              <div className="list-item__actions">
                <button className="icon-btn" disabled={index === 0} onClick={() => void handleReorderItem(item.id, 'up')}>
                  ↑
                </button>
                <button className="icon-btn" disabled={index === items.length - 1} onClick={() => void handleReorderItem(item.id, 'down')}>
                  ↓
                </button>
                <button className="icon-btn icon-btn--danger" onClick={() => void handleRemoveItem(item)}>
                  {strings.common.delete}
                </button>
              </div>
            </div>

            <BarrierSection
              barriers={barriersByItem[item.id] ?? []}
              barrierNounSingular={barrierNounSingular}
              onAdd={(input) => handleAddBarrier(item, input)}
              onRemove={handleRemoveBarrier}
              onReorder={(id, direction) => handleReorderBarrier(item, id, direction)}
            />
          </div>
        ))}
      </div>

      <form className="form" onSubmit={handleAddItem}>
        <div className="form__row">
          <input value={newItemLabel} onChange={(e) => setNewItemLabel(e.target.value)} placeholder={itemPlaceholder} />
          <button type="submit" disabled={addingItem}>
            {strings.common.add}
          </button>
        </div>
      </form>
    </div>
  );
}

interface BarrierSectionProps<TBarrier extends BarrierEntity> {
  barriers: TBarrier[];
  barrierNounSingular: string;
  onAdd: (input: BarrierInput) => void;
  onRemove: (barrier: TBarrier) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
}

function BarrierSection<TBarrier extends BarrierEntity>({ barriers, barrierNounSingular, onAdd, onRemove, onReorder }: BarrierSectionProps<TBarrier>) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [barrierType, setBarrierType] = useState<BarrierType | ''>('');
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
    onAdd({
      label: trimmed,
      description: null,
      barrier_type: barrierType || null,
      effectiveness: effectiveness ? (Number(effectiveness) as Effectiveness) : null,
    });
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
          </div>
          <div className="barrier-item__badges">
            <span className="badge badge--neutral">{barrier.barrier_type ? BARRIER_TYPE_LABELS[barrier.barrier_type] : strings.editor.noBarrierType}</span>
            <span className="badge badge--neutral">
              {barrier.effectiveness ? EFFECTIVENESS_LABELS[barrier.effectiveness] : EFFECTIVENESS_NOT_EVALUATED_LABEL}
            </span>
          </div>
        </div>
      ))}

      {adding ? (
        <form className="form" onSubmit={submit}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={strings.editor.barrierLabelPlaceholder(barrierNounSingular)} autoFocus />
          {error && <p className="error-text">{error}</p>}
          <div className="form__row">
            <select value={barrierType} onChange={(e) => setBarrierType(e.target.value as BarrierType | '')}>
              <option value="">{strings.editor.barrierTypePlaceholder}</option>
              {BARRIER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {BARRIER_TYPE_LABELS[type]}
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
      )}
    </div>
  );
}
