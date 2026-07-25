import { FormEvent, useEffect, useState } from 'react';
import { getBowtie, updateBowtie } from '../../db/repositories/bowtieRepo';
import { createConsequence, deleteConsequence, listConsequences, reorderConsequence } from '../../db/repositories/consequenceRepo';
import { createMitigativeBarrier, deleteMitigativeBarrier, listMitigativeBarriers, reorderMitigativeBarrier } from '../../db/repositories/mitigativeBarrierRepo';
import { createPreventiveBarrier, deletePreventiveBarrier, listPreventiveBarriers, reorderPreventiveBarrier } from '../../db/repositories/preventiveBarrierRepo';
import { createThreat, deleteThreat, listThreats, reorderThreat } from '../../db/repositories/threatRepo';
import { strings } from '../../i18n/strings.pt-BR';
import { useCurrentUserStore } from '../../store/currentUserStore';
import { useNavStore } from '../../store/navStore';
import { useOpenProjectStore } from '../../store/openProjectStore';
import type { Bowtie } from '../../types/domain';
import { BowtieColumn } from './BowtieColumn';

const threatRepo = { list: listThreats, create: createThreat, remove: deleteThreat, reorder: reorderThreat };
const preventiveBarrierRepo = { list: listPreventiveBarriers, create: createPreventiveBarrier, remove: deletePreventiveBarrier, reorder: reorderPreventiveBarrier };
const consequenceRepo = { list: listConsequences, create: createConsequence, remove: deleteConsequence, reorder: reorderConsequence };
const mitigativeBarrierRepo = { list: listMitigativeBarriers, create: createMitigativeBarrier, remove: deleteMitigativeBarrier, reorder: reorderMitigativeBarrier };

export function EditorScreen() {
  const user = useCurrentUserStore((s) => s.user);
  const project = useOpenProjectStore((s) => s.project);
  const view = useNavStore((s) => s.view);
  const bowtieId = view.screen === 'editor' ? view.bowtieId : null;

  const [bowtie, setBowtie] = useState<Bowtie | null>(null);
  const [hazard, setHazard] = useState('');
  const [topEvent, setTopEvent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [bowtieId]);

  async function refresh() {
    if (!project || !bowtieId) return;
    try {
      const found = await getBowtie(project.dbPath, bowtieId);
      setBowtie(found);
      setHazard(found.hazard ?? '');
      setTopEvent(found.top_event ?? '');
      setError(null);
    } catch (err) {
      console.error(err);
      setError(strings.common.loadError);
    }
  }

  async function handleSaveHeader(event: FormEvent) {
    event.preventDefault();
    if (!project || !bowtie || !user || saving) return;
    setSaving(true);
    try {
      await updateBowtie(
        project.dbPath,
        bowtie,
        { name: bowtie.name, description: bowtie.description, hazard: hazard.trim() || null, top_event: topEvent.trim() || null },
        user,
      );
      await refresh();
    } catch (err) {
      console.error(err);
      setError(strings.common.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (!project || !bowtieId || !user) return null;

  if (!bowtie) {
    return error ? <p className="error-text">{error}</p> : null;
  }

  return (
    <div className="screen" style={{ maxWidth: 960 }}>
      <div className="screen__header">
        <h2>{bowtie.name}</h2>
        <p>{strings.editor.subtitle}</p>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="panel">
        <p className="section-title">{strings.editor.headerTitle}</p>
        <form className="form" onSubmit={handleSaveHeader}>
          <div className="form__row">
            <label className="field">
              {strings.editor.hazardLabel}
              <input value={hazard} onChange={(e) => setHazard(e.target.value)} placeholder={strings.editor.hazardPlaceholder} />
            </label>
            <label className="field">
              {strings.editor.topEventLabel}
              <input value={topEvent} onChange={(e) => setTopEvent(e.target.value)} placeholder={strings.editor.topEventPlaceholder} />
            </label>
          </div>
          <div className="form__actions">
            <button type="submit" disabled={saving}>
              {strings.common.save}
            </button>
          </div>
        </form>
      </div>

      <div className="bowtie-columns">
        <BowtieColumn
          accentClass="bowtie-column--threats"
          title={strings.editor.threatsTitle}
          itemNounSingular={strings.editor.threatNoun}
          itemPlaceholder={strings.editor.threatPlaceholder}
          barrierNounSingular={strings.editor.preventiveBarrierNoun}
          dbPath={project.dbPath}
          bowtieId={bowtie.id}
          user={user}
          itemRepo={threatRepo}
          barrierRepo={preventiveBarrierRepo}
        />
        <BowtieColumn
          accentClass="bowtie-column--consequences"
          title={strings.editor.consequencesTitle}
          itemNounSingular={strings.editor.consequenceNoun}
          itemPlaceholder={strings.editor.consequencePlaceholder}
          barrierNounSingular={strings.editor.mitigativeBarrierNoun}
          dbPath={project.dbPath}
          bowtieId={bowtie.id}
          user={user}
          itemRepo={consequenceRepo}
          barrierRepo={mitigativeBarrierRepo}
        />
      </div>
    </div>
  );
}
