// Todos os textos da UI centralizados aqui (about.md, Seção 13, regra 7).
// Sem biblioteca de i18n por ora — só PT-BR — mas nada de string solta no JSX.
export const strings = {
  userGate: {
    title: 'Bow Tie Risk Studio',
    subtitle: 'Identifique-se para continuar',
    nameLabel: 'Nome',
    namePlaceholder: 'Seu nome completo',
    emailLabel: 'Email',
    emailPlaceholder: 'seu.email@empresa.com',
    submit: 'Continuar',
    auditNotice: 'Nome e email serão registrados nas ações para fins de auditoria.',
    nameRequired: 'Informe seu nome.',
    emailRequired: 'Informe um email válido.',
  },
  app: {
    title: 'Bow Tie Risk Studio',
    homePlaceholder: 'Em breve: lista de projetos.',
    signedInAs: 'Identificado como',
  },
} as const;
