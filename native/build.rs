extern crate napi_build;

fn main() {
  napi_build::setup();
  pkg_config::probe_library("mpv").unwrap();
}
