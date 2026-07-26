<div align="center">

# BTR Studio

### BowTieRisk Studio

Aplicação desktop, local e offline-first, para construir e gerenciar análises de risco no formato **Bow Tie** (Gravata Borboleta): ameaças e barreiras preventivas à esquerda, evento de topo no centro, consequências e barreiras mitigatórias à direita.

![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-local--first-07405E?logo=sqlite&logoColor=white)
![Platform](https://img.shields.io/badge/plataforma-Windows%20%7C%20Linux-lightgrey)

Ver [about.md](about.md) para a especificação completa do produto e o roadmap por fases.

</div>

---

## Capturas de tela

<p align="center">
  <img src="Prints/Login.png" alt="Tela de identificação do Bow Tie Risk Studio" width="850">
  <br>
  <sub>Identificação do usuário — wallpaper com blur do Sirius/LNLS e identidade visual CNPEM/LNLS.</sub>
</p>

<p align="center">
  <img src="Prints/Diagrama.png" alt="Editor do diagrama Bow Tie" width="850">
  <br>
  <sub>Editor do diagrama — canvas interativo com ameaças, barreiras, evento de topo e consequências.</sub>
</p>

## Funcionalidades

- Hierarquia Projeto → Sessão → Bowtie, cada projeto salvo em um arquivo SQLite próprio.
- Canvas visual do bowtie (React Flow): layout determinístico por colunas, nós customizados por tipo, reordenar barreiras arrastando, exportação em PNG.
- Barreiras classificadas pela taxonomia CCPS/DNV-GL (Detectar-Decidir-Agir) e escala de efetividade numérica.
- Auditoria completa: toda criação, edição e exclusão é registrada com autor e data; tela de Histórico com filtros por usuário, entidade, ação e período, resumo por ação/usuário/dia e exportação em CSV.
- Sincronização segura para pastas compartilhadas (ex.: SharePoint/OneDrive): cópia de trabalho local, lock com heartbeat, backups automáticos rotacionados e checagem de integridade a cada sincronização.
- Identificação por nome e email (atribuição, não autenticação) e textos de interface centralizados em português.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Runtime desktop | [Tauri 2](https://tauri.app/) (Rust) |
| Interface | [React](https://react.dev/) 19 + TypeScript + Vite |
| Dados | SQLite local via `tauri-plugin-sql`, um banco por projeto |
| Canvas | [@xyflow/react](https://reactflow.dev/) (React Flow) |
| Estado | Zustand |

## Desenvolvimento

```bash
npm install
npm run tauri dev
```

Pré-requisitos: Rust (via [rustup](https://rustup.rs/)) e as [dependências de sistema do Tauri](https://tauri.app/start/prerequisites/) para a sua plataforma.

## Build

```bash
npm run tauri build
```

Gera o executável e os instaladores para a plataforma em que o build é executado (Linux, Windows ou macOS) — não há cross-compilação automática entre plataformas.

## Autor

**Guilherme de Medeiros**
Software Engineer — Computational and Applied Mathematics @ UNICAMP — Research Collaborator at the Artificial Intelligence Lab., Recod.ai

[LinkedIn](https://www.linkedin.com/in/guilhermedemedeiros/)
