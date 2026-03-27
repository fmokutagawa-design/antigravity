use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

// ─────────────────────────────────────────────
// Data types
// ─────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub kind: String, // "file" or "directory"
    pub handle: String, // absolute path (acts as handle in frontend)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileEntry>>,
}

// ─────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────

#[tauri::command]
fn open_project_dialog() -> Option<String> {
    // Uses tauri-plugin-dialog at runtime.
    // For now, return None; the actual dialog is handled
    // via the dialog plugin on the JS side:
    //   import { open } from '@tauri-apps/plugin-dialog';
    //   const path = await open({ directory: true });
    // So this command is a placeholder.
    // Frontend should use the dialog plugin directly.
    None
}

#[tauri::command]
fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }
    read_dir_recursive(dir).map_err(|e| e.to_string())
}

fn read_dir_recursive(dir: &Path) -> Result<Vec<FileEntry>, std::io::Error> {
    let mut entries = Vec::new();

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/folders
        if name.starts_with('.') {
            continue;
        }

        let path = entry.path();
        let kind = if path.is_dir() {
            "directory"
        } else {
            "file"
        };

        if kind == "file" {
            // Only include .txt and .md files
            if !name.ends_with(".txt") && !name.ends_with(".md") {
                continue;
            }
            entries.push(FileEntry {
                name,
                kind: "file".to_string(),
                handle: path.to_string_lossy().to_string(),
                children: None,
            });
        } else {
            let children = read_dir_recursive(&path)?;
            entries.push(FileEntry {
                name,
                kind: "directory".to_string(),
                handle: path.to_string_lossy().to_string(),
                children: Some(children),
            });
        }
    }

    // Sort: directories first, then files, alphabetically
    entries.sort_by(|a, b| {
        if a.kind == b.kind {
            a.name.cmp(&b.name)
        } else if a.kind == "directory" {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(entries)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| format!("Failed to write {}: {}", path, e))
}

#[tauri::command]
fn create_file(parent_path: String, file_name: String, content: String) -> Result<String, String> {
    let file_path = PathBuf::from(&parent_path).join(&file_name);
    fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn create_folder(parent_path: String, folder_name: String) -> Result<String, String> {
    let folder_path = PathBuf::from(&parent_path).join(&folder_name);
    fs::create_dir_all(&folder_path)
        .map_err(|e| format!("Failed to create folder: {}", e))?;
    Ok(folder_path.to_string_lossy().to_string())
}

#[tauri::command]
fn rename_entry(old_path: String, new_name: String) -> Result<String, String> {
    let old = PathBuf::from(&old_path);
    let parent = old
        .parent()
        .ok_or_else(|| "Cannot determine parent directory".to_string())?;
    let new_path = parent.join(&new_name);
    fs::rename(&old, &new_path)
        .map_err(|e| format!("Failed to rename: {}", e))?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_entry(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| format!("Failed to delete directory: {}", e))
    } else {
        fs::remove_file(p).map_err(|e| format!("Failed to delete file: {}", e))
    }
}

#[tauri::command]
fn move_file(source_path: String, target_dir: String) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    let file_name = source
        .file_name()
        .ok_or_else(|| "Cannot determine file name".to_string())?;
    let dest = PathBuf::from(&target_dir).join(file_name);
    fs::rename(&source, &dest)
        .map_err(|e| format!("Failed to move: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn show_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(
                Path::new(&path)
                    .parent()
                    .unwrap_or(Path::new(&path))
                    .to_string_lossy()
                    .to_string(),
            )
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn save_file_dialog(default_path: String) -> Result<Option<String>, String> {
    // Placeholder — actual dialog should use tauri-plugin-dialog on JS side:
    //   import { save } from '@tauri-apps/plugin-dialog';
    //   const path = await save({ defaultPath });
    // This command exists for parity; frontend should prefer the plugin.
    Ok(Some(default_path))
}

// ─────────────────────────────────────────────
// App setup
// ─────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            open_project_dialog,
            read_directory,
            read_file,
            write_file,
            create_file,
            create_folder,
            rename_entry,
            delete_entry,
            move_file,
            show_in_explorer,
            save_file_dialog,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
