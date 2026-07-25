// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // On Linux + KDE: prefer server-side decorations so the window
    // respects the system theme (Breeze, etc.) instead of GTK's CSD.
    #[cfg(target_os = "linux")]
    {
        if std::env::var("XDG_CURRENT_DESKTOP")
            .unwrap_or_default()
            .contains("KDE")
        {
            std::env::set_var("GTK_CSD", "0");
        }
    }

    snag_lib::run()
}
