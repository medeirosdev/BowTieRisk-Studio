import { useEffect, useMemo, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { AuditFilters, AuditLogRow, MAX_ROWS, listAuditEntityTypes, listAuditLog, listAuditLogForExport, listAuditUsers } from '../../db/repositories/auditRepo';
import { auditLogToCsv } from './csv';
import { slugify } from '../../db/slug';
import { strings } from '../../i18n/strings.pt-BR';
import { useNavStore } from '../../store/navStore';
import { useOpenProjectStore } from '../../store/openProjectStore';
import { AUDIT_ACTIONS } from '../../types/enums';
import type { AuditAction } from '../../types/enums';

interface AuditSummary {
  total: number;
  byAction: { key: string; count: number }[];
  byUser: { key: string; count: number }[];
  byDay: { key: string; count: number }[];
}

function summarize(rows: AuditLogRow[]): AuditSummary {
  const byAction = new Map<string, number>();
  const byUser = new Map<string, number>();
  const byDay = new Map<string, number>();

  for (const row of rows) {
    byAction.set(row.action, (byAction.get(row.action) ?? 0) + 1);
    byUser.set(row.user_name, (byUser.get(row.user_name) ?? 0) + 1);
    const day = row.ts.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  const toSortedEntries = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

  return {
    total: rows.length,
    byAction: toSortedEntries(byAction),
    byUser: toSortedEntries(byUser),
    byDay: toSortedEntries(byDay).sort((a, b) => (a.key < b.key ? 1 : -1)),
  };
}

function actionBadgeClass(action: AuditAction): string {
  switch (action) {
    case 'CREATE':
      return 'badge--success';
    case 'DELETE':
      return 'badge--danger';
    case 'LOCK':
    case 'UNLOCK':
    case 'SYNC':
      return 'badge--warning';
    default:
      return 'badge--neutral';
  }
}

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// input[type=date] nativo no WebKitGTK renderiza os segmentos internos com
// o esquema de cores do SO por baixo do nosso CSS (o segmento em foco fica
// branco mesmo em tema escuro) — texto simples evita esse problema.
function isValidDate(value: string): boolean {
  return DATE_PATTERN.test(value);
}

export function AuditScreen() {
  const project = useOpenProjectStore((s) => s.project);
  const goBackFromAudit = useNavStore((s) => s.goBackFromAudit);

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [users, setUsers] = useState<{ name: string; email: string }[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [userEmail, setUserEmail] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (!project) return;
    (async () => {
      try {
        setUsers(await listAuditUsers(project.dbPath));
        setEntityTypes(await listAuditEntityTypes(project.dbPath));
      } catch (err) {
        console.error(err);
      }
    })();
  }, [project?.dbPath]);

  // Debounced: datas são texto livre digitado tecla a tecla — sem isso, cada
  // tecla dispararia uma consulta nova (sensação de "travado" ao digitar).
  useEffect(() => {
    const timeout = setTimeout(() => {
      void refresh();
    }, 300);
    return () => clearTimeout(timeout);
  }, [project?.dbPath, userEmail, entityType, action, from, to]);

  function buildFilters(): AuditFilters {
    return {
      userEmail: userEmail || undefined,
      entityType: entityType || undefined,
      action: action || undefined,
      from: isValidDate(from) ? `${from}T00:00:00.000Z` : undefined,
      to: isValidDate(to) ? `${to}T23:59:59.999Z` : undefined,
    };
  }

  async function refresh() {
    if (!project) return;
    setLoading(true);
    try {
      setRows(await listAuditLog(project.dbPath, buildFilters()));
      setError(null);
    } catch (err) {
      console.error(err);
      setError(strings.common.loadError);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportCsv() {
    if (!project) return;
    setExporting(true);
    try {
      const exportRows = await listAuditLogForExport(project.dbPath, buildFilters());
      const csv = auditLogToCsv(exportRows);

      // Não usar <a download> aqui: dentro do WebView do Tauri o clique num
      // link de download não é confiável (sem manipulador nativo, é
      // descartado silenciosamente). Diálogo "Salvar como" nativo + escrita
      // de arquivo é o caminho garantido.
      const path = await save({
        defaultPath: `auditoria-${slugify(project.name) || 'projeto'}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (!path) return; // usuário cancelou o diálogo

      // BOM: sem ele, o Excel no Windows abre CSV UTF-8 assumindo a
      // codepage do sistema e corrompe acentos (nomes/descrições em PT-BR).
      await writeTextFile(path, '﻿' + csv);
    } catch (err) {
      console.error(err);
      setError(strings.audit.exportError);
    } finally {
      setExporting(false);
    }
  }

  const summary = useMemo(() => summarize(rows), [rows]);

  function clearFilters() {
    setUserEmail('');
    setEntityType('');
    setAction('');
    setFrom('');
    setTo('');
  }

  if (!project) return null;

  const hasFilters = Boolean(userEmail || entityType || action || from || to);

  return (
    <div className="screen" style={{ maxWidth: 760 }}>
      <div className="screen__header">
        <div className="audit-header">
          <div>
            <h2>{strings.audit.title}</h2>
            <p>{strings.audit.subtitle(project.name)}</p>
          </div>
          <div className="audit-header__actions">
            <button type="button" className="btn-secondary" onClick={() => void handleExportCsv()} disabled={exporting || rows.length === 0}>
              {exporting ? strings.audit.exporting : strings.audit.exportCsv}
            </button>
            <button type="button" className="btn-secondary" onClick={goBackFromAudit}>
              {strings.common.back}
            </button>
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="panel audit-summary">
          <div className="audit-summary__total">
            {strings.audit.summaryTotal(summary.total)}
            {rows.length >= MAX_ROWS && <span className="audit-summary__note"> — {strings.audit.summaryCapped}</span>}
          </div>
          <div className="audit-summary__groups">
            <div className="audit-summary__group">
              <span className="audit-summary__group-title">{strings.audit.summaryByAction}</span>
              <div className="audit-summary__badges">
                {summary.byAction.map((item) => (
                  <span key={item.key} className={`badge ${actionBadgeClass(item.key as AuditAction)}`}>
                    {item.key} · {item.count}
                  </span>
                ))}
              </div>
            </div>
            <div className="audit-summary__group">
              <span className="audit-summary__group-title">{strings.audit.summaryByUser}</span>
              <div className="audit-summary__badges">
                {summary.byUser.map((item) => (
                  <span key={item.key} className="badge badge--neutral">
                    {item.key} · {item.count}
                  </span>
                ))}
              </div>
            </div>
            <div className="audit-summary__group">
              <span className="audit-summary__group-title">{strings.audit.summaryByDay}</span>
              <div className="audit-summary__badges">
                {summary.byDay.map((item) => (
                  <span key={item.key} className="badge badge--neutral">
                    {item.key} · {item.count}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="audit-filters">
          <label className="field">
            {strings.audit.userLabel}
            <select value={userEmail} onChange={(e) => setUserEmail(e.target.value)}>
              <option value="">{strings.audit.allOption}</option>
              {users.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            {strings.audit.entityLabel}
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              <option value="">{strings.audit.allOption}</option>
              {entityTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            {strings.audit.actionLabel}
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">{strings.audit.allOption}</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          <div className="form__row">
            <label className="field">
              {strings.audit.fromLabel}
              <input
                type="text"
                inputMode="numeric"
                placeholder={strings.audit.datePlaceholder}
                maxLength={10}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="field">
              {strings.audit.toLabel}
              <input
                type="text"
                inputMode="numeric"
                placeholder={strings.audit.datePlaceholder}
                maxLength={10}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>

          {hasFilters && (
            <button type="button" className="btn-secondary" onClick={clearFilters}>
              {strings.audit.clearFilters}
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? null : rows.length === 0 ? (
        <p className="empty-state">{strings.audit.empty}</p>
      ) : (
        <div className="list">
          {rows.map((row) => (
            <div className="audit-row" key={row.id}>
              <div className="audit-row__main" onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>
                <span className={`badge ${actionBadgeClass(row.action)}`}>{row.action}</span>
                <div className="audit-row__body">
                  <span className="audit-row__entity">
                    {row.entity_type}
                    {row.entity_label ? ` — ${row.entity_label}` : ''}
                  </span>
                  <span className="audit-row__meta">
                    {row.user_name} · {formatTs(row.ts)}
                  </span>
                </div>
              </div>
              {expandedId === row.id && row.changes_json && <pre className="audit-row__changes">{JSON.stringify(JSON.parse(row.changes_json), null, 2)}</pre>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
