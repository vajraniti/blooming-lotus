//! Modes of operation: ECB, CBC and CTR, one-shot and streaming.
//!
//! ECB and CBC work on whole blocks and use PKCS#7 padding unless told
//! otherwise. CTR turns IDEA into a stream cipher and never pads: the
//! 8-byte IV is the first counter block, incremented as one big-endian
//! 64-bit integer per block (NIST SP 800-38A's standard incrementing function
//! applied to the whole block).

use alloc::vec::Vec;

use crate::{BLOCK_SIZE, Error, Idea};

/// Cipher mode with its IV where it has one.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    /// Electronic codebook: every block encrypted on its own. Leaks repeated blocks.
    Ecb,
    /// Cipher block chaining with this IV.
    Cbc([u8; BLOCK_SIZE]),
    /// Counter mode starting from this counter block.
    Ctr([u8; BLOCK_SIZE]),
}

/// How ECB and CBC fill up the last block. CTR ignores it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Padding {
    /// PKCS#7: append N bytes of value N, 1 ≤ N ≤ 8, so the length always grows.
    Pkcs7,
    /// No padding: the input must already be a whole number of blocks.
    None,
}

/// Encrypts `data` in one go.
///
/// # Errors
/// [`Error::Unaligned`] for ECB or CBC with [`Padding::None`] when `data` is not
/// a whole number of blocks.
pub fn encrypt(cipher: &Idea, mode: Mode, padding: Padding, data: &[u8]) -> Result<Vec<u8>, Error> {
    if let Mode::Ctr(iv) = mode {
        let mut out = data.to_vec();
        Ctr::new(cipher.clone(), iv).apply(&mut out);
        return Ok(out);
    }
    let mut out = match padding {
        Padding::Pkcs7 => pad(data),
        Padding::None => aligned(data)?.to_vec(),
    };
    let blocks = out.as_chunks_mut::<BLOCK_SIZE>().0;
    match mode {
        Mode::Ecb => blocks.iter_mut().for_each(|b| cipher.encrypt_block(b)),
        Mode::Cbc(iv) => {
            let mut prev = iv;
            for b in blocks {
                cbc_encrypt_block(cipher, &mut prev, b);
            }
        }
        Mode::Ctr(_) => unreachable!("handled above"),
    }
    Ok(out)
}

/// Decrypts `data` in one go.
///
/// # Errors
/// [`Error::Unaligned`] if ECB or CBC ciphertext is not a whole number of blocks,
/// [`Error::BadPadding`] if PKCS#7 padding does not check out.
pub fn decrypt(cipher: &Idea, mode: Mode, padding: Padding, data: &[u8]) -> Result<Vec<u8>, Error> {
    if let Mode::Ctr(iv) = mode {
        let mut out = data.to_vec();
        Ctr::new(cipher.clone(), iv).apply(&mut out);
        return Ok(out);
    }
    let mut out = aligned(data)?.to_vec();
    let blocks = out.as_chunks_mut::<BLOCK_SIZE>().0;
    match mode {
        Mode::Ecb => blocks.iter_mut().for_each(|b| cipher.decrypt_block(b)),
        Mode::Cbc(iv) => {
            let mut prev = iv;
            for b in blocks {
                cbc_decrypt_block(cipher, &mut prev, b);
            }
        }
        Mode::Ctr(_) => unreachable!("handled above"),
    }
    if padding == Padding::Pkcs7 {
        let keep = data.len() - padding_len(&out)?;
        out.truncate(keep);
    }
    Ok(out)
}

/// Streaming CBC encryption with PKCS#7 padding, for input that arrives in chunks.
pub struct CbcEncryptor {
    cipher: Idea,
    prev: [u8; BLOCK_SIZE],
    buf: [u8; BLOCK_SIZE],
    buf_len: usize,
}

impl CbcEncryptor {
    /// Starts a stream with this key schedule and IV.
    #[must_use]
    pub fn new(cipher: Idea, iv: [u8; BLOCK_SIZE]) -> Self {
        Self {
            cipher,
            prev: iv,
            buf: [0; BLOCK_SIZE],
            buf_len: 0,
        }
    }

    /// Feeds plaintext; appends every block that is complete to `out`.
    pub fn update(&mut self, mut input: &[u8], out: &mut Vec<u8>) {
        if self.buf_len > 0 {
            let take = (BLOCK_SIZE - self.buf_len).min(input.len());
            self.buf[self.buf_len..self.buf_len + take].copy_from_slice(&input[..take]);
            self.buf_len += take;
            input = &input[take..];
            if self.buf_len < BLOCK_SIZE {
                return;
            }
            let mut block = self.buf;
            cbc_encrypt_block(&self.cipher, &mut self.prev, &mut block);
            out.extend_from_slice(&block);
            self.buf_len = 0;
        }
        let (blocks, rest) = input.as_chunks::<BLOCK_SIZE>();
        out.reserve(blocks.len() * BLOCK_SIZE);
        for b in blocks {
            let mut block = *b;
            cbc_encrypt_block(&self.cipher, &mut self.prev, &mut block);
            out.extend_from_slice(&block);
        }
        self.buf[..rest.len()].copy_from_slice(rest);
        self.buf_len = rest.len();
    }

    /// Pads and encrypts the tail; appends the last block to `out`.
    pub fn finish(mut self, out: &mut Vec<u8>) {
        let n = BLOCK_SIZE - self.buf_len;
        let mut block = self.buf;
        block[self.buf_len..].fill(n as u8);
        cbc_encrypt_block(&self.cipher, &mut self.prev, &mut block);
        out.extend_from_slice(&block);
        self.buf.fill(0);
    }
}

/// Streaming CBC decryption with PKCS#7 padding.
///
/// The last full block is held back until [`CbcDecryptor::finish`], because only
/// then is it known to carry the padding.
pub struct CbcDecryptor {
    cipher: Idea,
    prev: [u8; BLOCK_SIZE],
    buf: [u8; BLOCK_SIZE],
    buf_len: usize,
}

impl CbcDecryptor {
    /// Starts a stream with this key schedule and IV.
    #[must_use]
    pub fn new(cipher: Idea, iv: [u8; BLOCK_SIZE]) -> Self {
        Self {
            cipher,
            prev: iv,
            buf: [0; BLOCK_SIZE],
            buf_len: 0,
        }
    }

    /// Feeds ciphertext; appends plaintext of every block that is certainly not the last.
    pub fn update(&mut self, mut input: &[u8], out: &mut Vec<u8>) {
        while !input.is_empty() {
            if self.buf_len == BLOCK_SIZE {
                // More data follows, so the held block was not the last one.
                let mut block = self.buf;
                cbc_decrypt_block(&self.cipher, &mut self.prev, &mut block);
                out.extend_from_slice(&block);
                self.buf_len = 0;
            }
            let take = (BLOCK_SIZE - self.buf_len).min(input.len());
            self.buf[self.buf_len..self.buf_len + take].copy_from_slice(&input[..take]);
            self.buf_len += take;
            input = &input[take..];
        }
    }

    /// Decrypts the held-back block and strips the padding.
    ///
    /// # Errors
    /// [`Error::Unaligned`] if the stream was not a whole, non-empty number of
    /// blocks, [`Error::BadPadding`] if the padding does not check out.
    pub fn finish(mut self, total_len: usize, out: &mut Vec<u8>) -> Result<(), Error> {
        if self.buf_len != BLOCK_SIZE {
            return Err(Error::Unaligned { len: total_len });
        }
        let mut block = self.buf;
        cbc_decrypt_block(&self.cipher, &mut self.prev, &mut block);
        let n = padding_len(&block)?;
        out.extend_from_slice(&block[..BLOCK_SIZE - n]);
        self.buf.fill(0);
        Ok(())
    }
}

/// Counter mode. Encryption and decryption are the same operation.
pub struct Ctr {
    cipher: Idea,
    counter: u64,
    keystream: [u8; BLOCK_SIZE],
    used: usize,
}

impl Ctr {
    /// Starts the keystream at counter block `iv`.
    #[must_use]
    pub fn new(cipher: Idea, iv: [u8; BLOCK_SIZE]) -> Self {
        Self {
            cipher,
            counter: u64::from_be_bytes(iv),
            keystream: [0; BLOCK_SIZE],
            used: BLOCK_SIZE,
        }
    }

    /// XORs the next `data.len()` keystream bytes into `data`.
    pub fn apply(&mut self, data: &mut [u8]) {
        for byte in data {
            if self.used == BLOCK_SIZE {
                self.keystream = self.counter.to_be_bytes();
                self.cipher.encrypt_block(&mut self.keystream);
                // Wraps after 2^64 blocks; 64-bit block ciphers must never get near that anyway.
                self.counter = self.counter.wrapping_add(1);
                self.used = 0;
            }
            *byte ^= self.keystream[self.used];
            self.used += 1;
        }
    }
}

impl Drop for Ctr {
    fn drop(&mut self) {
        self.keystream.fill(0);
    }
}

fn cbc_encrypt_block(c: &Idea, prev: &mut [u8; BLOCK_SIZE], block: &mut [u8; BLOCK_SIZE]) {
    xor_into(block, *prev);
    c.encrypt_block(block);
    *prev = *block;
}

fn cbc_decrypt_block(c: &Idea, prev: &mut [u8; BLOCK_SIZE], block: &mut [u8; BLOCK_SIZE]) {
    let ciphertext = *block;
    c.decrypt_block(block);
    xor_into(block, *prev);
    *prev = ciphertext;
}

fn xor_into(dst: &mut [u8; BLOCK_SIZE], src: [u8; BLOCK_SIZE]) {
    for (d, s) in dst.iter_mut().zip(src) {
        *d ^= s;
    }
}

fn pad(data: &[u8]) -> Vec<u8> {
    let n = BLOCK_SIZE - data.len() % BLOCK_SIZE;
    let mut out = Vec::with_capacity(data.len() + n);
    out.extend_from_slice(data);
    out.resize(data.len() + n, n as u8);
    out
}

fn aligned(data: &[u8]) -> Result<&[u8], Error> {
    if data.len().is_multiple_of(BLOCK_SIZE) {
        Ok(data)
    } else {
        Err(Error::Unaligned { len: data.len() })
    }
}

/// Length of valid PKCS#7 padding at the end of `data`.
fn padding_len(data: &[u8]) -> Result<usize, Error> {
    let n = usize::from(*data.last().ok_or(Error::BadPadding)?);
    if n == 0 || n > BLOCK_SIZE || n > data.len() {
        return Err(Error::BadPadding);
    }
    if data[data.len() - n..].iter().all(|&b| usize::from(b) == n) {
        Ok(n)
    } else {
        Err(Error::BadPadding)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: [u8; 16] = *b"0123456789abcdef";
    const IV: [u8; 8] = *b"\x01\x23\x45\x67\x89\xab\xcd\xef";

    fn sample(len: usize) -> Vec<u8> {
        (0..len).map(|i| (i * 31 + 7) as u8).collect()
    }

    #[test]
    fn roundtrip_every_mode_and_length() {
        let c = Idea::new(&KEY);
        for mode in [Mode::Ecb, Mode::Cbc(IV), Mode::Ctr(IV)] {
            for len in 0..40 {
                let p = sample(len);
                let ct = encrypt(&c, mode, Padding::Pkcs7, &p).unwrap();
                match mode {
                    Mode::Ctr(_) => assert_eq!(ct.len(), len),
                    _ => assert_eq!(ct.len(), (len / 8 + 1) * 8),
                }
                assert_eq!(
                    decrypt(&c, mode, Padding::Pkcs7, &ct).unwrap(),
                    p,
                    "{mode:?} len={len}"
                );
            }
        }
    }

    #[test]
    fn no_padding_requires_whole_blocks() {
        let c = Idea::new(&KEY);
        assert_eq!(
            encrypt(&c, Mode::Ecb, Padding::None, &[0; 9]),
            Err(Error::Unaligned { len: 9 })
        );
        let ct = encrypt(&c, Mode::Cbc(IV), Padding::None, &[7; 16]).unwrap();
        assert_eq!(ct.len(), 16);
        assert_eq!(
            decrypt(&c, Mode::Cbc(IV), Padding::None, &ct).unwrap(),
            [7; 16]
        );
    }

    #[test]
    fn ecb_leaks_repeated_blocks_and_cbc_does_not() {
        let c = Idea::new(&KEY);
        let p = [0x55u8; 16];
        let ecb = encrypt(&c, Mode::Ecb, Padding::None, &p).unwrap();
        let cbc = encrypt(&c, Mode::Cbc(IV), Padding::None, &p).unwrap();
        assert_eq!(ecb[..8], ecb[8..]);
        assert_ne!(cbc[..8], cbc[8..]);
    }

    #[test]
    fn wrong_key_is_caught_by_padding_check_most_of_the_time() {
        let ct = encrypt(
            &Idea::new(&KEY),
            Mode::Cbc(IV),
            Padding::Pkcs7,
            b"attack at dawn",
        )
        .unwrap();
        let other = Idea::new(b"fedcba9876543210");
        assert_eq!(
            decrypt(&other, Mode::Cbc(IV), Padding::Pkcs7, &ct),
            Err(Error::BadPadding)
        );
    }

    #[test]
    fn bad_padding_is_rejected() {
        assert_eq!(
            padding_len(&[1, 2, 3, 4, 5, 6, 7, 0]),
            Err(Error::BadPadding)
        );
        assert_eq!(
            padding_len(&[1, 2, 3, 4, 5, 6, 7, 9]),
            Err(Error::BadPadding)
        );
        assert_eq!(
            padding_len(&[1, 2, 3, 4, 5, 6, 3, 2]),
            Err(Error::BadPadding)
        );
        assert_eq!(padding_len(&[8; 8]), Ok(8));
        assert_eq!(padding_len(&[]), Err(Error::BadPadding));
    }

    #[test]
    fn streaming_matches_one_shot_for_any_chunking() {
        let c = Idea::new(&KEY);
        let p = sample(1000);
        let expected = encrypt(&c, Mode::Cbc(IV), Padding::Pkcs7, &p).unwrap();
        for step in [1, 3, 7, 8, 9, 64, 999, 1000, 4096] {
            let mut enc = CbcEncryptor::new(c.clone(), IV);
            let mut ct = Vec::new();
            for chunk in p.chunks(step) {
                enc.update(chunk, &mut ct);
            }
            enc.finish(&mut ct);
            assert_eq!(ct, expected, "encrypt step={step}");

            let mut dec = CbcDecryptor::new(c.clone(), IV);
            let mut pt = Vec::new();
            for chunk in ct.chunks(step) {
                dec.update(chunk, &mut pt);
            }
            dec.finish(ct.len(), &mut pt).unwrap();
            assert_eq!(pt, p, "decrypt step={step}");

            let mut ctr = Ctr::new(c.clone(), IV);
            let mut stream = p.clone();
            for chunk in stream.chunks_mut(step) {
                ctr.apply(chunk);
            }
            assert_eq!(
                stream,
                encrypt(&c, Mode::Ctr(IV), Padding::Pkcs7, &p).unwrap(),
                "ctr step={step}"
            );
        }
    }

    #[test]
    fn streaming_decrypt_rejects_unaligned_and_empty() {
        let c = Idea::new(&KEY);
        let mut out = Vec::new();
        let mut dec = CbcDecryptor::new(c.clone(), IV);
        dec.update(&[0; 12], &mut out);
        assert_eq!(dec.finish(12, &mut out), Err(Error::Unaligned { len: 12 }));
        let dec = CbcDecryptor::new(c, IV);
        assert_eq!(dec.finish(0, &mut out), Err(Error::Unaligned { len: 0 }));
    }

    #[test]
    fn ctr_counter_carries_across_bytes() {
        let c = Idea::new(&KEY);
        let iv = [0, 0, 0, 0, 0, 0, 0xFF, 0xFF];
        let mut ks = [0u8; 24];
        Ctr::new(c.clone(), iv).apply(&mut ks);
        let mut second = [0, 0, 0, 0, 0, 1, 0, 0];
        c.encrypt_block(&mut second);
        assert_eq!(ks[8..16], second);
    }
}
