# Bow Tie Risk Studio

Aplicação desktop, local e offline-first, para construir e gerenciar análises de risco no formato **Bow Tie** (Gravata Borboleta): ameaças e barreiras preventivas à esquerda, evento de topo no centro, consequências e barreiras mitigatórias à direita.

Ver [about.md](about.md) para a especificação completa do produto e o roadmap por fases.

## Stack

- [Tauri 2](https://tauri.app/) (Rust) + [React](https://react.dev/) + TypeScript + Vite
- SQLite local (`tauri-plugin-sql`), um banco por projeto
- [@xyflow/react](https://reactflow.dev/) para o canvas do diagrama
- Zustand para estado

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
