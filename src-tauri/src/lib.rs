use std::path::PathBuf;

// A API de path do Tauri expõe `executableDir()`, mas ela resolve pro
// diretório de binários do usuário no padrão XDG (dirs::executable_dir()) —
// documentado como "Not supported" no Windows e no macOS, onde sempre
// retorna Error::UnknownPath. No Linux ela até "funciona" (resolve pra
// algo tipo ~/.local/bin), mas nunca foi de fato o diretório do .exe em
// execução — só não dava erro, mascarando o bug nos nossos testes.
// O que a gente realmente quer ("pasta ao lado do executável", about.md
// Seção 6.2) é std::env::current_exe(), que não tem equivalente na API JS
// de path — daí esta função e o comando abaixo, única fonte de verdade
// usada tanto pelo comando exposto ao frontend quanto pelo setup() do escopo.
fn executable_dir() -> std::io::Result<PathBuf> {
    let exe = std::env::current_exe()?;
    exe.parent().map(PathBuf::from).ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::NotFound, "executável sem diretório pai")
    })
}

#[tauri::command]
fn get_executable_dir() -> Result<String, String> {
    executable_dir()
        .map(|dir| dir.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

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
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_executable_dir])
        .setup(|app| {
            // O escopo `$EXE` das capabilities (fs:allow-exe-*) depende da
            // mesma resolução "Not supported" no Windows/macOS (ver
            // executable_dir acima) — REMOVIDO de capabilities/default.json.
            // Em troca, concede acesso de leitura/escrita ao diretório real do
            // executável em runtime, que funciona em qualquer plataforma.
            use tauri_plugin_fs::FsExt;
            match executable_dir() {
                Ok(dir) => {
                    if let Err(e) = app.fs_scope().allow_directory(&dir, true) {
                        eprintln!("falha ao conceder escopo de fs para {dir:?}: {e}");
                    }
                }
                Err(e) => eprintln!("falha ao resolver o diretório do executável: {e}"),
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
