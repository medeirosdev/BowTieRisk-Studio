// Marca geométrica: duas ameaças convergindo da esquerda, o evento de topo
// no centro, duas consequências divergindo à direita — a forma do próprio
// domínio (about.md, Seção 2), não um ícone genérico.
export function BowtieMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="bowtie-mark"
    >
      <path d="M2 6 L15 16 L2 26" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 6 L17 16 L30 26" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="2.75" fill="currentColor" />
    </svg>
  );
}
