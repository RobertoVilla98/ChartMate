//! Embedded WebView2 loader for MinGW builds (no WebView2Loader.dll needed next to the .exe).
//!
//! The executable links WebView2Loader.dll with delay-loading (build.rs). Before the first WebView2
//! call, the DLL embedded here is written once to `%LOCALAPPDATA%\ChartMate\runtime\<size>\` and
//! loaded from there; the delay-load helper then finds it already in memory by its module name.

#[cfg(all(windows, target_env = "gnu", target_arch = "x86_64"))]
pub fn ensure_loaded() {
    use std::os::windows::ffi::OsStrExt;
    static DLL: &[u8] = include_bytes!("../webview2/WebView2Loader.dll");
    #[link(name = "kernel32")]
    extern "system" {
        fn LoadLibraryW(name: *const u16) -> *mut core::ffi::c_void;
    }
    let base = std::env::var_os("LOCALAPPDATA").map(std::path::PathBuf::from).unwrap_or_else(std::env::temp_dir);
    let dir = base.join("ChartMate").join("runtime").join(DLL.len().to_string());
    let path = dir.join("WebView2Loader.dll");
    let current = std::fs::metadata(&path).map(|m| m.len() as usize == DLL.len()).unwrap_or(false);
    if !current {
        let _ = std::fs::create_dir_all(&dir);
        let tmp = dir.join("WebView2Loader.dll.tmp");
        if std::fs::write(&tmp, DLL).is_ok() {
            let _ = std::fs::rename(&tmp, &path);
        }
    }
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    unsafe {
        LoadLibraryW(wide.as_ptr());
    }
}

#[cfg(not(all(windows, target_env = "gnu", target_arch = "x86_64")))]
pub fn ensure_loaded() {}
