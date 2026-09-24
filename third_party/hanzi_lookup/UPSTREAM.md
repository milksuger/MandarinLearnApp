# Vendored upstream snapshot

- Repository: <https://github.com/gugray/hanzi_lookup>
- Commit: `01f90c3ab99a8fadf0696c28e5eb097223c500db`
- Upstream code license: GNU LGPL version 3; see [`LICENSE`](LICENSE).
- Embedded character stroke-shape data license: Arphic Public License; see [`LICENSE-APL`](LICENSE-APL).
- Rust source and `Cargo.toml` are preserved here. The matching generated WASM and JavaScript glue are served from `public/vendor/hanzi-lookup/` without code changes.
- Upstream README/build description is preserved in [`UPSTREAM_README.md`](UPSTREAM_README.md).

The app calls the library from a separate browser worker. Keep the code and data licenses separate from the root MIT license when redistributing.
