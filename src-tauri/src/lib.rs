use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Schema v1 do domínio Bow Tie (about.md, Seção 5.3).
    // NOTA (Fase 1): `add_migrations` associa as migrations a um identificador
    // de banco fixo, definido em tempo de compilação. Como cada projeto vira
    // um arquivo .db com nome dinâmico (slug do nome do projeto — Seção 6.6),
    // a criação de bancos por projeto vai precisar aplicar este mesmo schema
    // manualmente (via comando Rust) ao invés de depender só deste registro.
    let migrations = vec![Migration {
        version: 1,
        description: "initial_schema",
        sql: include_str!("../migrations/001_initial.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:working.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
