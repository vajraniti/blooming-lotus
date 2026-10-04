//! Known-answer tests against independent sources.
//!
//! - `vectors/idea-ecb.txt`: the NESSIE project's verified IDEA vectors, as
//!   reformatted by pyca/cryptography (`cryptography_vectors` package).
//! - `vectors/idea-cbc.txt`: pyca/cryptography's CBC vectors, verified against Botan.
//! - CTR vectors below: produced with OpenSSL's IDEA (through pyca/cryptography,
//!   `decrepit.ciphers.algorithms.IDEA` in ECB) and a counter incremented as a
//!   big-endian 64-bit integer.

use idea::Idea;
use idea::modes::{self, Mode, Padding};

struct Vector {
    fields: Vec<(String, String)>,
}

impl Vector {
    fn get(&self, name: &str) -> Option<Vec<u8>> {
        self.fields
            .iter()
            .find(|(k, _)| k == name)
            .map(|(_, v)| unhex(v))
    }

    fn must(&self, name: &str) -> Vec<u8> {
        self.get(name)
            .unwrap_or_else(|| panic!("vector without {name}: {:?}", self.fields))
    }
}

fn unhex(s: &str) -> Vec<u8> {
    assert!(s.len().is_multiple_of(2), "odd hex length in {s:?}");
    (0..s.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&s[i..i + 2], 16).unwrap_or_else(|e| panic!("bad hex {s:?}: {e}"))
        })
        .collect()
}

/// Parses NIST-style `NAME = value` blocks separated by blank lines.
fn parse(text: &str) -> Vec<Vector> {
    let mut out = Vec::new();
    let mut fields = Vec::new();
    for line in text.lines().map(str::trim) {
        if line.is_empty() {
            if !fields.is_empty() {
                out.push(Vector {
                    fields: std::mem::take(&mut fields),
                });
            }
            continue;
        }
        if line.starts_with('#') || line.starts_with('[') {
            continue;
        }
        let (k, v) = line
            .split_once(" = ")
            .unwrap_or_else(|| panic!("unparsable line {line:?}"));
        fields.push((k.to_owned(), v.to_owned()));
    }
    if !fields.is_empty() {
        out.push(Vector { fields });
    }
    out
}

fn block(v: &[u8]) -> [u8; 8] {
    v.try_into().expect("8-byte block")
}

#[test]
fn nessie_ecb() {
    let vectors = parse(include_str!("vectors/idea-ecb.txt"));
    assert_eq!(vectors.len(), 900, "all NESSIE vectors parsed");
    for v in &vectors {
        let cipher = Idea::new_from_slice(&v.must("KEY")).expect("16-byte key");
        let plain = block(&v.must("PLAINTEXT"));
        let mut b = plain;
        cipher.encrypt_block(&mut b);
        assert_eq!(b, block(&v.must("CIPHERTEXT")), "{:?}", v.fields);
        cipher.decrypt_block(&mut b);
        assert_eq!(b, plain, "decrypt {:?}", v.fields);

        // NESSIE also gives the result of encrypting the block 100 and 1000 times over.
        if let (Some(c100), Some(c1000)) = (v.get("CIPHERTEXT100"), v.get("CIPHERTEXT1000")) {
            let mut b = plain;
            for i in 1..=1000 {
                cipher.encrypt_block(&mut b);
                if i == 100 {
                    assert_eq!(b, block(&c100), "x100 {:?}", v.fields);
                }
            }
            assert_eq!(b, block(&c1000), "x1000 {:?}", v.fields);
        }
    }
}

#[test]
fn cbc_vectors() {
    let vectors = parse(include_str!("vectors/idea-cbc.txt"));
    assert!(!vectors.is_empty());
    for v in &vectors {
        let cipher = Idea::new_from_slice(&v.must("KEY")).expect("16-byte key");
        let mode = Mode::Cbc(block(&v.must("IV")));
        let plain = v.must("PLAINTEXT");
        let ct = modes::encrypt(&cipher, mode, Padding::None, &plain).expect("aligned");
        assert_eq!(ct, v.must("CIPHERTEXT"), "{:?}", v.fields);
        assert_eq!(
            modes::decrypt(&cipher, mode, Padding::None, &ct).expect("aligned"),
            plain
        );
    }
}

#[test]
fn ctr_matches_openssl() {
    // (key, counter block, plaintext, ciphertext)
    const CASES: [(&str, &str, &str, &str); 3] = [
        (
            "000102030405060708090a0b0c0d0e0f",
            "0000000000000000",
            "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021222324",
            "d2727a912e7f646dac8f8e1d95e5cd3b7deb596636270af608a1d415d13351230f3e30e87f",
        ),
        (
            // The counter wraps from ff..ff to 00..00 inside this message.
            "2bd6459f82c5b300952c49104881ff48",
            "fffffffffffffffe",
            "6465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f8081828384",
            "2bb99b78cc8a03c9af17a4f496ff759d3726e16766071ad541132b1b6fd282ba19",
        ),
        (
            "dab960fd040df9b7d4d33852cb1213cd",
            "eba5876edd5bba89",
            "439028a6a027a9c9dd6f984ab3096ab8d5e3760211f9a03cf41504474b16d4a7d8f26451823d811fe62ff5d561419ffa2a785cf312b1dc6a5f3f660dd23ef7f8",
            "b2d14090a5dcddd4652f8b68ec514704c411d908022bfdbf2e9522a97c15852db55949c4aafada8c73e3b8564ab88af5e21a1297552ed645db500f6bbf716d12",
        ),
    ];
    for (key, iv, plain, expected) in CASES {
        let cipher = Idea::new_from_slice(&unhex(key)).expect("16-byte key");
        let mode = Mode::Ctr(block(&unhex(iv)));
        let ct =
            modes::encrypt(&cipher, mode, Padding::Pkcs7, &unhex(plain)).expect("ctr never fails");
        assert_eq!(ct, unhex(expected), "key {key}");
        assert_eq!(
            modes::decrypt(&cipher, mode, Padding::Pkcs7, &ct).expect("ctr never fails"),
            unhex(plain)
        );
    }
}
