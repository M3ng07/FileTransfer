fn main() {
    println!("cargo:rerun-if-changed=../../server/network.c");
    println!("cargo:rerun-if-changed=../../server/http.c");
    println!("cargo:rerun-if-changed=../../server/httpserver.c");
    println!("cargo:rerun-if-changed=../../server/network.h");
    println!("cargo:rerun-if-changed=../../server/http.h");
    println!("cargo:rerun-if-changed=../../server/httpserver.h");

    cc::Build::new()
        .file("../../server/network.c")
        .file("../../server/http.c")
        .file("../../server/httpserver.c")
        .include("../../server")
        .warnings(true)
        .compile("file_transfer_server");

    println!("cargo:rustc-link-lib=ws2_32");
    tauri_build::build();
}
