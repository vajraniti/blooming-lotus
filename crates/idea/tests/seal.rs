//! Sealed-file format: roundtrips, streaming, and every way a file can be wrong.
#![cfg(feature = "seal")]

use idea::Error;
use idea::seal::{self, HEADER_LEN, Opener, SealMode, Sealer, TAG_LEN};

const KEY: [u8; 16] = *b"seen this angel?";
const IV: [u8; 8] = [9, 8, 7, 6, 5, 4, 3, 2];

fn data(len: usize) -> Vec<u8> {
    (0..len).map(|i| (i * 131 + 17) as u8).collect()
}

#[test]
fn roundtrip_both_modes_many_sizes() {
    for mode in [SealMode::Cbc, SealMode::Ctr] {
        for len in [0, 1, 7, 8, 9, 63, 64, 65, 1000] {
            let d = data(len);
            let sealed = seal::seal(&KEY, mode, IV, "relic.png", &d).unwrap();
            assert_eq!(&sealed[..4], b"IDEA");
            let opened = seal::open(&KEY, &sealed).unwrap();
            assert_eq!(opened.name, "relic.png");
            assert_eq!(opened.data, d, "{mode:?} len={len}");
        }
    }
}

#[test]
fn unicode_and_empty_names() {
    for name in ["", "ангел.txt", "🖤"] {
        let sealed = seal::seal(&KEY, SealMode::Ctr, IV, name, b"x").unwrap();
        assert_eq!(seal::open(&KEY, &sealed).unwrap().name, name);
    }
}

#[test]
fn streaming_equals_one_shot() {
    let d = data(5000);
    for mode in [SealMode::Cbc, SealMode::Ctr] {
        let expected = seal::seal(&KEY, mode, IV, "a.bin", &d).unwrap();
        for step in [1, 5, 8, 333, 5000] {
            let mut s = Sealer::new(&KEY, mode, IV, "a.bin").unwrap();
            let mut out = Vec::new();
            for chunk in d.chunks(step) {
                out.extend(s.update(chunk));
            }
            out.extend(s.finish());
            assert_eq!(out, expected, "{mode:?} step={step}");

            // Read it back in chunks, the way the site does.
            let (body, tag) = out.split_at(out.len() - TAG_LEN);
            let mut o = Opener::new(&KEY, &body[..HEADER_LEN]).unwrap();
            let mut plain = Vec::new();
            for chunk in body[HEADER_LEN..].chunks(step) {
                plain.extend(o.update(chunk));
            }
            let opened = o.finish(tag).unwrap();
            plain.extend(opened.tail);
            assert_eq!(opened.name, "a.bin");
            assert_eq!(plain, d, "{mode:?} read step={step}");
        }
    }
}

#[test]
fn every_flipped_bit_is_detected() {
    let sealed = seal::seal(&KEY, SealMode::Cbc, IV, "n", &data(40)).unwrap();
    for i in 0..sealed.len() {
        let mut bad = sealed.clone();
        bad[i] ^= 0x01;
        let err = seal::open(&KEY, &bad).unwrap_err();
        let expected = match i {
            0..4 => Error::NotSealed,
            4 => Error::UnsupportedVersion(0),
            5 => Error::UnknownMode(0),
            _ => Error::Tampered,
        };
        assert_eq!(err, expected, "byte {i}");
    }
}

#[test]
fn wrong_key_is_tampered() {
    let sealed = seal::seal(&KEY, SealMode::Ctr, IV, "n", b"secret").unwrap();
    assert_eq!(
        seal::open(b"are you real????", &sealed).unwrap_err(),
        Error::Tampered
    );
}

#[test]
fn truncation_is_detected() {
    let sealed = seal::seal(&KEY, SealMode::Cbc, IV, "n", &data(30)).unwrap();
    assert_eq!(
        seal::open(&KEY, &sealed[..HEADER_LEN + TAG_LEN - 1]).unwrap_err(),
        Error::Truncated
    );
    assert_eq!(
        seal::open(&KEY, &sealed[..sealed.len() - 8]).unwrap_err(),
        Error::Tampered
    );
    assert_eq!(seal::open(&KEY, &[0; 10]).unwrap_err(), Error::Truncated);
}

#[test]
fn fresh_iv_gives_unrelated_files() {
    let a = seal::seal(&KEY, SealMode::Ctr, IV, "n", &[0; 64]).unwrap();
    let b = seal::seal(&KEY, SealMode::Ctr, [1; 8], "n", &[0; 64]).unwrap();
    assert_ne!(a[HEADER_LEN..], b[HEADER_LEN..]);
}

#[test]
fn name_too_long_is_rejected() {
    let name = "x".repeat(70_000);
    assert_eq!(
        Sealer::new(&KEY, SealMode::Cbc, IV, &name).err(),
        Some(Error::FileNameTooLong { len: 70_000 })
    );
}
