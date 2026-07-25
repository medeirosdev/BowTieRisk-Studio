#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Sem `add_migrations`: cada projeto é um arquivo .db com nome dinâmico
    // (slug do nome do projeto — about.md, Seção 6.6), e o mecanismo de
    // migrations do plugin funciona por identificador fixo definido em tempo
    // de compilação. O schema (src-tauri/migrations/001_initial.sql) é
    // aplicado dinamicamente pelo frontend ao criar o banco de cada projeto
    // (src/db/repositories/projectRepo.ts), via import `?raw` do mesmo
    // arquivo — única fonte de verdade do schema.
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
