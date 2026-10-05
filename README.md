# IDEA

A single-page site about IDEA, the International Data Encryption Algorithm
(Xuejia Lai and James L. Massey, 1991): its history, the three operations, the
round, the key schedule, decryption, the attacks — and a working implementation
you can use in the page.

The cipher is written in Rust (`crates/idea`) and compiled to WebAssembly
(`crates/idea-wasm`). Every number the page shows comes from that code.

## Look at it

Open `index.html` in a desktop browser. No build and no server needed: the
WebAssembly binary is inlined in `assets/wasm/idea_wasm_bytes.js` because
browsers refuse to `fetch()` a `.wasm` file from `file://`.

The page has an English and a Russian version (switch at the bottom of the
menu; the choice is remembered, the default follows the browser language).
Russian copy lives in `assets/js/i18n-ru.js`, keyed by the English text.

## What is in the page

- **III. The round** — interactive diagram of all 14 steps for any key and
  block, round by round, encrypt or decrypt.
- **IV–V.** Key schedule with the bits each subkey was cut from; the inverted
  decryption subkeys.
- **VII.** An image encrypted with ECB, CBC and CTR, live.
- **VIII.** Text lab: ECB / CBC / CTR, PKCS#7 or none, hex or base64.
- **IX.** File sealing: IDEA-CBC or IDEA-CTR with HMAC-SHA256
  (encrypt-then-MAC), per-file keys from HKDF-SHA256. The file never leaves
  the page.

## Rust

```sh
cargo test --workspace --all-features
cargo clippy --workspace --all-features --all-targets -- -D warnings
```

`crates/idea` is `no_std` (with `alloc` for modes), forbids `unsafe`, and is
checked against:

- the 900 NESSIE IDEA test vectors (including the ×100 and ×1000 iterations),
- pyca/cryptography's CBC vectors (verified against Botan),
- CTR output from OpenSSL's IDEA.

Multiplication mod 2¹⁶+1 is branch-free; subkeys are zeroized on drop.

### Rebuild the WebAssembly

Needs the `wasm32-unknown-unknown` target and `wasm-bindgen-cli` of the same
version as the `wasm-bindgen` crate in `Cargo.lock` (0.2.129):

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129 --locked
./scripts/build-wasm.sh
```

## Credits

Type: Cormorant Garamond, UnifrakturMaguntia, IBM Plex Mono (SIL OFL, licences
in `assets/fonts`). The IDEA wordmark is drawn for this site from Cormorant
Garamond Bold capitals.
