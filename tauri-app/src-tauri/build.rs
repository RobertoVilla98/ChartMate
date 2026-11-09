fn main() {
    // Windows + MinGW: webview2-com-sys links WebView2Loader.dll at load time, so the program would
    // not start without the DLL next to it (MSVC builds link the static loader and need nothing).
    // We link a *delay-import* library instead: the DLL is resolved on first use, after
    // `main` has written the copy embedded in the executable (see src/webview2_loader.rs).
    let target = std::env::var("TARGET").unwrap_or_default();
    if target == "x86_64-pc-windows-gnu" {
        let out = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap());
        let lib = out.join("libWebView2Loader.dll.a");
        let status = std::process::Command::new("dlltool")
            .args(["-d", "webview2/WebView2Loader.def", "-D", "WebView2Loader.dll", "-y"])
            .arg(&lib)
            .status()
            .expect("dlltool (MinGW binutils) is required for the windows-gnu build");
        assert!(status.success(), "dlltool failed to build the WebView2Loader delay-import library");
        println!("cargo:rustc-link-search=native={}", out.display());
        println!("cargo:rustc-link-lib=delayimp");
        println!("cargo:rerun-if-changed=webview2/WebView2Loader.def");
    }
    tauri_build::build()
}
