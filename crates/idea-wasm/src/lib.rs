//! WebAssembly face of the `idea` crate. Every cipher operation the site performs
//! goes through these functions; JavaScript only moves bytes and draws.

use idea::modes::{self, Padding};
use idea::seal::{Opener, SealMode, Sealer};
use idea::{BLOCK_SIZE, Error, Idea, KEY_SIZE, ROUNDS};
use wasm_bindgen::prelude::*;

/// Cipher mode for the text lab.
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    /// Electronic codebook.
    Ecb = 0,
    /// Cipher block chaining.
    Cbc = 1,
    /// Counter mode.
    Ctr = 2,
}

/// Words per round in [`trace`]: input (4), subkeys (6), steps (14).
pub const TRACE_ROUND_WORDS: usize = 4 + 6 + 14;
/// Words of the output transformation in [`trace`]: input (4), subkeys (4), output (4).
pub const TRACE_OUTPUT_WORDS: usize = 12;

/// Encrypts `data`. `iv` is ignored for ECB; `pad` selects PKCS#7 for ECB and CBC.
///
/// # Errors
/// Wrong key or IV length, or unpadded input that is not whole blocks.
#[wasm_bindgen]
pub fn encrypt(
    key: &[u8],
    mode: Mode,
    iv: &[u8],
    pad: bool,
    data: &[u8],
) -> Result<Vec<u8>, JsError> {
    let cipher = Idea::new_from_slice(key)?;
    Ok(modes::encrypt(
        &cipher,
        lab_mode(mode, iv)?,
        padding(pad),
        data,
    )?)
}

/// Decrypts `data`; arguments as for [`encrypt`].
///
/// # Errors
/// Wrong key or IV length, ciphertext that is not whole blocks, or bad padding.
#[wasm_bindgen]
pub fn decrypt(
    key: &[u8],
    mode: Mode,
    iv: &[u8],
    pad: bool,
    data: &[u8],
) -> Result<Vec<u8>, JsError> {
    let cipher = Idea::new_from_slice(key)?;
    Ok(modes::decrypt(
        &cipher,
        lab_mode(mode, iv)?,
        padding(pad),
        data,
    )?)
}

/// Runs one block through the cipher and returns every intermediate word.
///
/// Layout: 8 rounds of [`TRACE_ROUND_WORDS`] words (input X1..X4, subkeys
/// Z1..Z6, steps 1..14), then [`TRACE_OUTPUT_WORDS`] words for the output
/// transformation (input, subkeys, output); 204 words in all.
///
/// # Errors
/// Key not 16 bytes or block not 8 bytes.
#[wasm_bindgen]
pub fn trace(key: &[u8], block: &[u8], decrypt: bool) -> Result<Vec<u16>, JsError> {
    let cipher = Idea::new_from_slice(key)?;
    let block = <&[u8; BLOCK_SIZE]>::try_from(block)
        .map_err(|_| JsError::new(&format!("a block is 8 bytes, got {}", block.len())))?;
    let t = if decrypt {
        cipher.trace_decrypt(block)
    } else {
        cipher.trace_encrypt(block)
    };
    let mut out = Vec::with_capacity(ROUNDS * TRACE_ROUND_WORDS + TRACE_OUTPUT_WORDS);
    for r in &t.rounds {
        out.extend_from_slice(&r.input);
        out.extend_from_slice(&r.subkeys);
        out.extend_from_slice(&r.steps);
    }
    out.extend_from_slice(&t.output.input);
    out.extend_from_slice(&t.output.subkeys);
    out.extend_from_slice(&t.output.output);
    Ok(out)
}

/// The 52 encryption subkeys followed by the 52 decryption subkeys.
///
/// # Errors
/// Key not 16 bytes.
#[wasm_bindgen]
pub fn subkeys(key: &[u8]) -> Result<Vec<u16>, JsError> {
    let cipher = Idea::new_from_slice(key)?;
    let mut out = cipher.encryption_subkeys().to_vec();
    out.extend_from_slice(cipher.decryption_subkeys());
    Ok(out)
}

/// Multiplication modulo 2^16 + 1, the word 0 standing for 2^16.
#[wasm_bindgen]
#[must_use]
pub fn mul(a: u16, b: u16) -> u16 {
    idea::mul(a, b)
}

/// Multiplicative inverse modulo 2^16 + 1.
#[wasm_bindgen(js_name = mulInv)]
#[must_use]
pub fn mul_inv(a: u16) -> u16 {
    idea::mul_inv(a)
}

/// Length of a sealed file's header.
#[wasm_bindgen(js_name = sealHeaderLen)]
#[must_use]
pub fn seal_header_len() -> usize {
    idea::seal::HEADER_LEN
}

/// Length of a sealed file's tag.
#[wasm_bindgen(js_name = sealTagLen)]
#[must_use]
pub fn seal_tag_len() -> usize {
    idea::seal::TAG_LEN
}

/// Streams a file into the sealed format. Concatenate every returned chunk.
#[wasm_bindgen]
pub struct SealWriter(Sealer);

#[wasm_bindgen]
impl SealWriter {
    /// Starts a sealed file. `iv` must be 8 fresh random bytes.
    ///
    /// # Errors
    /// Wrong key or IV length, or a file name over 65535 bytes.
    #[wasm_bindgen(constructor)]
    pub fn new(key: &[u8], ctr: bool, iv: &[u8], name: &str) -> Result<SealWriter, JsError> {
        let mode = if ctr { SealMode::Ctr } else { SealMode::Cbc };
        Ok(Self(Sealer::new(&key16(key)?, mode, iv8(iv)?, name)?))
    }

    /// Encrypts a chunk; returns the sealed bytes ready so far.
    pub fn update(&mut self, chunk: &[u8]) -> Vec<u8> {
        self.0.update(chunk)
    }

    /// Returns the last ciphertext bytes and the tag. The writer is used up.
    #[must_use]
    pub fn finish(self) -> Vec<u8> {
        self.0.finish()
    }
}

/// Streams a sealed file back. Output of `update` is unauthenticated until `finish` succeeds.
#[wasm_bindgen]
pub struct SealReader(Opener);

#[wasm_bindgen]
impl SealReader {
    /// Parses the 16-byte header.
    ///
    /// # Errors
    /// Wrong key length, or a header this format does not recognise.
    #[wasm_bindgen(constructor)]
    pub fn new(key: &[u8], header: &[u8]) -> Result<SealReader, JsError> {
        Ok(Self(Opener::new(&key16(key)?, header)?))
    }

    /// Decrypts a chunk of the bytes between header and tag.
    pub fn update(&mut self, chunk: &[u8]) -> Vec<u8> {
        self.0.update(chunk)
    }

    /// Verifies the tag and returns the file name with the last plaintext bytes.
    ///
    /// # Errors
    /// Wrong key or a modified file.
    pub fn finish(self, tag: &[u8]) -> Result<OpenedFile, JsError> {
        let opened = self.0.finish(tag)?;
        Ok(OpenedFile {
            name: opened.name,
            tail: opened.tail,
        })
    }
}

/// Result of [`SealReader::finish`].
#[wasm_bindgen]
pub struct OpenedFile {
    name: String,
    tail: Vec<u8>,
}

#[wasm_bindgen]
impl OpenedFile {
    /// The original file name.
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn name(&self) -> String {
        self.name.clone()
    }

    /// The final plaintext bytes that CBC held back until the padding was checked.
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn tail(&self) -> Vec<u8> {
        self.tail.clone()
    }
}

fn padding(pad: bool) -> Padding {
    if pad { Padding::Pkcs7 } else { Padding::None }
}

fn lab_mode(mode: Mode, iv: &[u8]) -> Result<modes::Mode, Error> {
    Ok(match mode {
        Mode::Ecb => modes::Mode::Ecb,
        Mode::Cbc => modes::Mode::Cbc(iv8(iv)?),
        Mode::Ctr => modes::Mode::Ctr(iv8(iv)?),
    })
}

fn key16(key: &[u8]) -> Result<[u8; KEY_SIZE], Error> {
    key.try_into()
        .map_err(|_| Error::KeyLength { got: key.len() })
}

fn iv8(iv: &[u8]) -> Result<[u8; BLOCK_SIZE], Error> {
    iv.try_into().map_err(|_| Error::IvLength { got: iv.len() })
}
