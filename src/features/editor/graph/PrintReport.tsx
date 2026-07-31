import { EFFECTIVENESS_LABELS, EFFECTIVENESS_NOT_EVALUATED_LABEL } from '../../../types/enums';
import type { MitigativeBarrier, PreventiveBarrier } from '../../../types/domain';
import type { BowtieGraphData } from './deriveGraph';

function BarrierItem({ barrier }: { barrier: PreventiveBarrier | MitigativeBarrier }) {
  const effectiveness = barrier.effectiveness ? EFFECTIVENESS_LABELS[barrier.effectiveness] : EFFECTIVENESS_NOT_EVALUATED_LABEL;
  return (
    <li>
      <strong>{barrier.label}</strong> — {barrier.barrier_type ?? 'Tipo não definido'} — Efetividade: {effectiveness}
      {barrier.description && <p>{barrier.description}</p>}
    </li>
  );
}

// Renderizado sempre no DOM (fora da tela, via CSS), só visível ao imprimir
// — ver @media print em canvas.css. Mesmo conteúdo de exportMarkdown.ts, em
// HTML semântico simples pra imprimir/"salvar como PDF" pelo diálogo do SO.
export function PrintReport({ graph }: { graph: BowtieGraphData }) {
  const { bowtie, threats, preventiveBarriersByThreat, consequences, mitigativeBarriersByConsequence } = graph;

  return (
    <article className="print-report">
      <h1>{bowtie.name}</h1>
      {bowtie.hazard && (
        <p>
          <strong>Perigo:</strong> {bowtie.hazard}
        </p>
      )}
      {bowtie.top_event && (
        <p>
          <strong>Evento de topo:</strong> {bowtie.top_event}
        </p>
      )}
      {bowtie.description && <p>{bowtie.description}</p>}
      <p>
        <em>Gerado em {new Date().toLocaleString('pt-BR')} pelo BTR Studio.</em>
      </p>

      <h2>Ameaças e barreiras preventivas</h2>
      {threats.length === 0 && <p>Nenhuma ameaça cadastrada.</p>}
      {threats.map((threat) => (
        <section key={threat.id}>
          <h3>{threat.label}</h3>
          {threat.description && <p>{threat.description}</p>}
          {(preventiveBarriersByThreat[threat.id] ?? []).length === 0 ? (
            <p>Sem barreiras preventivas cadastradas.</p>
          ) : (
            <ol>
              {(preventiveBarriersByThreat[threat.id] ?? []).map((barrier) => (
                <BarrierItem key={barrier.id} barrier={barrier} />
              ))}
            </ol>
          )}
        </section>
      ))}

      <h2>Consequências e barreiras mitigatórias</h2>
      {consequences.length === 0 && <p>Nenhuma consequência cadastrada.</p>}
      {consequences.map((consequence) => (
        <section key={consequence.id}>
          <h3>{consequence.label}</h3>
          {consequence.description && <p>{consequence.description}</p>}
          {(mitigativeBarriersByConsequence[consequence.id] ?? []).length === 0 ? (
            <p>Sem barreiras mitigatórias cadastradas.</p>
          ) : (
            <ol>
              {(mitigativeBarriersByConsequence[consequence.id] ?? []).map((barrier) => (
                <BarrierItem key={barrier.id} barrier={barrier} />
              ))}
            </ol>
          )}
        </section>
      ))}
    </article>
  );
}
