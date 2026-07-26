import { useEffect, useState } from 'react';
import { AuditFilters, AuditLogRow, listAuditEntityTypes, listAuditLog, listAuditUsers } from '../../db/repositories/auditRepo';
import { strings } from '../../i18n/strings.pt-BR';
import { useNavStore } from '../../store/navStore';
import { useOpenProjectStore } from '../../store/openProjectStore';
import { AUDIT_ACTIONS } from '../../types/enums';
import type { AuditAction } from '../../types/enums';

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

  async function refresh() {
    if (!project) return;
    setLoading(true);
    try {
      const filters: AuditFilters = {
        userEmail: userEmail || undefined,
        entityType: entityType || undefined,
        action: action || undefined,
        from: isValidDate(from) ? `${from}T00:00:00.000Z` : undefined,
        to: isValidDate(to) ? `${to}T23:59:59.999Z` : undefined,
      };
      setRows(await listAuditLog(project.dbPath, filters));
      setError(null);
    } catch (err) {
      console.error(err);
      setError(strings.common.loadError);
    } finally {
      setLoading(false);
    }
  }

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
          <button type="button" className="btn-secondary" onClick={goBackFromAudit}>
            {strings.common.back}
          </button>
        </div>
      </div>

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
