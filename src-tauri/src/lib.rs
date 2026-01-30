mod commands;
mod database;
mod terminal;

use commands::*;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .manage(Arc::new(terminal::TerminalManager::new()))
        .invoke_handler(tauri::generate_handler![
            // Vault management
            get_vaults,
            get_active_vault,
            add_vault,
            remove_vault,
            set_active_vault,
            update_vault,
            // File tree
            get_file_tree,
            // File operations
            read_file,
            write_file,
            create_file,
            create_folder,
            delete_item,
            move_item,
            // Search
            search_vault,
            // Settings
            get_settings,
            save_settings,
            // Database
            db_init,
            db_index_vault,
            db_search,
            db_get_notes,
            db_get_notes_by_tag,
            db_get_tags,
            db_get_backlinks,
            db_toggle_favorite,
            db_get_favorites,
            db_add_recent,
            db_get_recent,
            db_query,
            db_get_stats,
            // File metadata
            db_get_file,
            db_get_files,
            db_set_file_metadata,
            db_get_file_metadata,
            db_add_file_tag,
            db_remove_file_tag,
            db_get_file_tags,
            db_get_files_by_tag,
            // Tasks
            db_index_tasks,
            db_get_tasks,
            db_get_task,
            db_get_tasks_today,
            db_get_tasks_upcoming,
            task_create,
            task_update,
            // Projects
            db_index_projects,
            db_get_projects,
            db_get_project,
            db_get_project_tasks,
            db_remove_project,
            project_create,
            // Inbox
            quick_capture,
            get_inbox_items,
            // Dev Projects
            db_get_dev_projects,
            db_add_dev_project,
            db_update_dev_project,
            db_remove_dev_project,
            // Vulnerability Scans
            db_save_vulnerability_scan,
            db_get_latest_vulnerability_scan,
            db_get_vulnerability_scan_history,
            // Terminal
            terminal::spawn_shell,
            terminal::write_shell,
            terminal::resize_shell,
            terminal::kill_shell,
            terminal::get_shell_pid,
            // Utilities
            run_command,
            check_port_in_use,
            get_process_stats,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
