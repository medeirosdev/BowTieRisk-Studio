import { EFFECTIVENESS_LABELS, EFFECTIVENESS_NOT_EVALUATED_LABEL } from '../../../types/enums';
import type { MitigativeBarrier, PreventiveBarrier } from '../../../types/domain';
import type { BowtieGraphData } from './deriveGraph';

// Nome/descrição são texto livre digitado pelo usuário — rótulos técnicos
// com "_" (ex.: "válvula_XV-101") ou um "*"/"`" digitado por acaso vira
// formatação markdown não intencional (itálico, código) se não escapar.
function escapeMd(text: string): string {
  return text.replace(/[*_`]/g, '\\$&');
}

function barrierLine(index: number, barrier: PreventiveBarrier | MitigativeBarrier): string {
  const type = barrier.barrier_type ? escapeMd(barrier.barrier_type) : 'Tipo não definido';
  const effectiveness = barrier.effectiveness ? EFFECTIVENESS_LABELS[barrier.effectiveness] : EFFECTIVENESS_NOT_EVALUATED_LABEL;
  let line = `${index}. **${escapeMd(barrier.label)}** — ${type} — Efetividade: ${effectiveness}`;
  if (barrier.description) {
    line += `\n   > ${escapeMd(barrier.description).replace(/\n/g, '\n   > ')}`;
  }
  return line;
}

// Relatório em texto simples com todo o conteúdo do bowtie — ameaças e suas
// barreiras preventivas, consequências e suas barreiras mitigatórias.
// Markdown puro (sem lib nova): reaproveita o mesmo diálogo "Salvar como" +
// writeFile já usado pra PNG/CSV.
export function bowtieToMarkdown(graph: BowtieGraphData): string {
  const { bowtie, threats, preventiveBarriersByThreat, consequences, mitigativeBarriersByConsequence } = graph;
  const lines: string[] = [];

  lines.push(`# ${escapeMd(bowtie.name)}`);
  lines.push('');
  if (bowtie.hazard) lines.push(`**Perigo:** ${escapeMd(bowtie.hazard)}`);
  if (bowtie.top_event) lines.push(`**Evento de topo:** ${escapeMd(bowtie.top_event)}`);
  if (bowtie.hazard || bowtie.top_event) lines.push('');
  if (bowtie.description) {
    lines.push(escapeMd(bowtie.description));
    lines.push('');
  }
  lines.push(`_Gerado em ${new Date().toLocaleString('pt-BR')} pelo BTR Studio._`);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## Ameaças e barreiras preventivas');
  lines.push('');
  if (threats.length === 0) {
    lines.push('_Nenhuma ameaça cadastrada._');
    lines.push('');
  }
  threats.forEach((threat, i) => {
    lines.push(`### ${i + 1}. ${escapeMd(threat.label)}`);
    if (threat.description) lines.push(escapeMd(threat.description));
    lines.push('');
    const barriers = preventiveBarriersByThreat[threat.id] ?? [];
    if (barriers.length === 0) {
      lines.push('_Sem barreiras preventivas cadastradas._');
    } else {
      lines.push('Barreiras (ameaça → evento de topo):');
      lines.push('');
      barriers.forEach((barrier, j) => lines.push(barrierLine(j + 1, barrier)));
    }
    lines.push('');
  });

  lines.push('## Consequências e barreiras mitigatórias');
  lines.push('');
  if (consequences.length === 0) {
    lines.push('_Nenhuma consequência cadastrada._');
    lines.push('');
  }
  consequences.forEach((consequence, i) => {
    lines.push(`### ${i + 1}. ${escapeMd(consequence.label)}`);
    if (consequence.description) lines.push(escapeMd(consequence.description));
    lines.push('');
    const barriers = mitigativeBarriersByConsequence[consequence.id] ?? [];
    if (barriers.length === 0) {
      lines.push('_Sem barreiras mitigatórias cadastradas._');
    } else {
      lines.push('Barreiras (evento de topo → consequência):');
      lines.push('');
      barriers.forEach((barrier, j) => lines.push(barrierLine(j + 1, barrier)));
    }
    lines.push('');
  });

  return lines.join('\n');
}
