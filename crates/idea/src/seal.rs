//! Sealed files: IDEA-CBC or IDEA-CTR, authenticated with HMAC-SHA256
//! (encrypt-then-MAC), with the original file name stored inside the ciphertext.
//!
//! Layout, integers big-endian:
//!
//! | bytes          | content                                                  |
//! |----------------|----------------------------------------------------------|
//! | 0..4           | magic `IDEA`                                             |
//! | 4              | format version, `1`                                      |
//! | 5              | mode: `1` CBC with PKCS#7, `2` CTR                       |
//! | 6..8           | reserved, zero                                           |
//! | 8..16          | IV (CBC) or first counter block (CTR), random per file   |
//! | 16..n−32       | ciphertext of `name length (u16) ‖ name (UTF-8) ‖ data`  |
//! | n−32..n        | HMAC-SHA256 over bytes 0..n−32                           |
//!
//! The 128-bit user key never touches data directly. HKDF-SHA256, salted with
//! the per-file IV, derives a fresh IDEA key and a separate MAC key for every
//! file. Fresh keys per file also keep each key far below the 2^32-block
//! birthday bound of a 64-bit block cipher (Sweet32) for any realistic file.
//!
//! The tag is checked before padding is looked at, so a forged file can never
//! turn padding errors into a decryption oracle.

use alloc::string::String;
use alloc::vec::Vec;

use hkdf::Hkdf;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use zeroize::Zeroize;

use crate::modes::{CbcDecryptor, CbcEncryptor, Ctr};
use crate::{BLOCK_SIZE, Error, Idea, KEY_SIZE};

/// Header length in bytes.
pub const HEADER_LEN: usize = 16;
/// Tag length in bytes.
pub const TAG_LEN: usize = 32;

const MAGIC: [u8; 4] = *b"IDEA";
const VERSION: u8 = 1;
const INFO_ENC: &[u8] = b"idea-seal/v1 encryption key";
const INFO_MAC: &[u8] = b"idea-seal/v1 mac key";

type HmacSha256 = Hmac<Sha256>;

/// Cipher mode of a sealed file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SealMode {
    /// CBC with PKCS#7 padding; the sealed file is 1–8 bytes longer than CTR.
    Cbc,
    /// Counter mode; no padding.
    Ctr,
}

impl SealMode {
    const fn id(self) -> u8 {
        match self {
            Self::Cbc => 1,
            Self::Ctr => 2,
        }
    }

    const fn from_id(id: u8) -> Result<Self, Error> {
        match id {
            1 => Ok(Self::Cbc),
            2 => Ok(Self::Ctr),
            _ => Err(Error::UnknownMode(id)),
        }
    }
}

enum EncStream {
    Cbc(CbcEncryptor),
    Ctr(Ctr),
}

enum DecStream {
    Cbc(CbcDecryptor),
    Ctr(Ctr),
}

/// Writes a sealed file in chunks.
///
/// Concatenating everything returned by [`Sealer::update`] and [`Sealer::finish`]
/// gives the sealed file; the header comes out with the first call.
pub struct Sealer {
    stream: EncStream,
    mac: HmacSha256,
    pending: Vec<u8>,
}

impl Sealer {
    /// Starts a sealed file.
    ///
    /// `iv` must be fresh random bytes for every file.
    ///
    /// # Errors
    /// [`Error::FileNameTooLong`] if `file_name` exceeds 65535 bytes of UTF-8.
    pub fn new(
        key: &[u8; KEY_SIZE],
        mode: SealMode,
        iv: [u8; BLOCK_SIZE],
        file_name: &str,
    ) -> Result<Self, Error> {
        let name_len = u16::try_from(file_name.len()).map_err(|_| Error::FileNameTooLong {
            len: file_name.len(),
        })?;
        let header = header(mode, iv);
        let (cipher, mac) = derive(key, iv);
        let stream = match mode {
            SealMode::Cbc => EncStream::Cbc(CbcEncryptor::new(cipher, iv)),
            SealMode::Ctr => EncStream::Ctr(Ctr::new(cipher, iv)),
        };
        let mut sealer = Self {
            stream,
            mac,
            pending: header.to_vec(),
        };
        sealer.mac.update(&header);
        sealer.encrypt(&name_len.to_be_bytes());
        sealer.encrypt(file_name.as_bytes());
        Ok(sealer)
    }

    /// Encrypts the next chunk of file data and returns the sealed bytes ready so far.
    pub fn update(&mut self, chunk: &[u8]) -> Vec<u8> {
        self.encrypt(chunk);
        core::mem::take(&mut self.pending)
    }

    /// Closes the file: returns the remaining ciphertext and the tag.
    #[must_use]
    pub fn finish(mut self) -> Vec<u8> {
        let mut out = core::mem::take(&mut self.pending);
        let start = out.len();
        if let EncStream::Cbc(enc) = self.stream {
            enc.finish(&mut out);
        }
        self.mac.update(&out[start..]);
        out.extend_from_slice(&self.mac.finalize().into_bytes());
        out
    }

    fn encrypt(&mut self, data: &[u8]) {
        let start = self.pending.len();
        match &mut self.stream {
            EncStream::Cbc(enc) => enc.update(data, &mut self.pending),
            EncStream::Ctr(ctr) => {
                self.pending.extend_from_slice(data);
                ctr.apply(&mut self.pending[start..]);
            }
        }
        self.mac.update(&self.pending[start..]);
    }
}

/// Reads a sealed file in chunks.
///
/// Feed the header to [`Opener::new`], then every byte between header and tag
/// to [`Opener::update`], then the tag to [`Opener::finish`].
///
/// Plaintext returned by `update` is **not yet authenticated**: hold on to it
/// and throw it away unless `finish` returns `Ok`.
pub struct Opener {
    stream: DecStream,
    mac: HmacSha256,
    consumed: usize,
    name: NameState,
}

enum NameState {
    /// Collecting the length prefix and then the name itself.
    Reading(Vec<u8>),
    /// The raw name bytes, checked for UTF-8 only once the tag is verified.
    Done(Vec<u8>),
}

/// What [`Opener::finish`] hands back once the tag checks out.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Opened {
    /// The original file name.
    pub name: String,
    /// The last plaintext bytes, still held back by CBC padding.
    pub tail: Vec<u8>,
}

impl Opener {
    /// Parses the header.
    ///
    /// # Errors
    /// [`Error::Truncated`], [`Error::NotSealed`], [`Error::UnsupportedVersion`] or
    /// [`Error::UnknownMode`] if `header` is not a header this code wrote.
    pub fn new(key: &[u8; KEY_SIZE], header: &[u8]) -> Result<Self, Error> {
        let header = <&[u8; HEADER_LEN]>::try_from(header).map_err(|_| Error::Truncated)?;
        if header[..4] != MAGIC {
            return Err(Error::NotSealed);
        }
        if header[4] != VERSION {
            return Err(Error::UnsupportedVersion(header[4]));
        }
        let mode = SealMode::from_id(header[5])?;
        let mut iv = [0u8; BLOCK_SIZE];
        iv.copy_from_slice(&header[8..]);
        let (cipher, mut mac) = derive(key, iv);
        mac.update(header);
        let stream = match mode {
            SealMode::Cbc => DecStream::Cbc(CbcDecryptor::new(cipher, iv)),
            SealMode::Ctr => DecStream::Ctr(Ctr::new(cipher, iv)),
        };
        Ok(Self {
            stream,
            mac,
            consumed: 0,
            name: NameState::Reading(Vec::new()),
        })
    }

    /// Decrypts the next chunk of ciphertext. See the type-level note on authentication.
    pub fn update(&mut self, chunk: &[u8]) -> Vec<u8> {
        self.mac.update(chunk);
        self.consumed += chunk.len();
        let mut out = Vec::with_capacity(chunk.len());
        match &mut self.stream {
            DecStream::Cbc(dec) => dec.update(chunk, &mut out),
            DecStream::Ctr(ctr) => {
                out.extend_from_slice(chunk);
                ctr.apply(&mut out);
            }
        }
        strip_name_prefix(&mut self.name, out)
    }

    /// Checks the tag, then finishes decryption.
    ///
    /// # Errors
    /// [`Error::Tampered`] if the tag does not match (wrong key or modified file),
    /// [`Error::Truncated`] or [`Error::BadFileName`] for a malformed name prefix,
    /// which only a holder of the key could have produced.
    pub fn finish(mut self, tag: &[u8]) -> Result<Opened, Error> {
        self.mac.verify_slice(tag).map_err(|_| Error::Tampered)?;
        let mut tail = Vec::new();
        if let DecStream::Cbc(dec) = self.stream {
            dec.finish(self.consumed, &mut tail)?;
        }
        let tail = strip_name_prefix(&mut self.name, tail);
        match self.name {
            NameState::Done(name) => {
                let name = String::from_utf8(name).map_err(|_| Error::BadFileName)?;
                Ok(Opened { name, tail })
            }
            NameState::Reading(_) => Err(Error::Truncated),
        }
    }
}

/// Moves bytes of the `u16 length ‖ name` prefix out of `plain` until the name is complete.
fn strip_name_prefix(state: &mut NameState, mut plain: Vec<u8>) -> Vec<u8> {
    while let NameState::Reading(prefix) = state {
        let wanted = if prefix.len() < 2 {
            2
        } else {
            2 + usize::from(u16::from_be_bytes([prefix[0], prefix[1]]))
        };
        let take = (wanted - prefix.len()).min(plain.len());
        prefix.extend(plain.drain(..take));
        if prefix.len() < wanted {
            // The chunk ran out inside the prefix.
            break;
        }
        if wanted > 2 || prefix[..2] == [0, 0] {
            *state = NameState::Done(prefix.split_off(2));
        }
    }
    plain
}

/// Seals `data` in one go.
///
/// # Errors
/// [`Error::FileNameTooLong`] if `file_name` exceeds 65535 bytes of UTF-8.
pub fn seal(
    key: &[u8; KEY_SIZE],
    mode: SealMode,
    iv: [u8; BLOCK_SIZE],
    file_name: &str,
    data: &[u8],
) -> Result<Vec<u8>, Error> {
    let mut sealer = Sealer::new(key, mode, iv, file_name)?;
    let mut out = sealer.update(data);
    out.extend_from_slice(&sealer.finish());
    Ok(out)
}

/// A sealed file opened in one go.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Unsealed {
    /// The original file name.
    pub name: String,
    /// The file contents.
    pub data: Vec<u8>,
}

/// Opens a sealed file in one go.
///
/// # Errors
/// Any header error from [`Opener::new`], [`Error::Truncated`] if the file is
/// shorter than header and tag, [`Error::Tampered`] if the tag does not match.
pub fn open(key: &[u8; KEY_SIZE], sealed: &[u8]) -> Result<Unsealed, Error> {
    if sealed.len() < HEADER_LEN + TAG_LEN {
        return Err(Error::Truncated);
    }
    let (body, tag) = sealed.split_at(sealed.len() - TAG_LEN);
    let mut opener = Opener::new(key, &body[..HEADER_LEN])?;
    let mut data = opener.update(&body[HEADER_LEN..]);
    let Opened { name, tail } = opener.finish(tag)?;
    data.extend_from_slice(&tail);
    Ok(Unsealed { name, data })
}

fn header(mode: SealMode, iv: [u8; BLOCK_SIZE]) -> [u8; HEADER_LEN] {
    let mut h = [0u8; HEADER_LEN];
    h[..4].copy_from_slice(&MAGIC);
    h[4] = VERSION;
    h[5] = mode.id();
    h[8..].copy_from_slice(&iv);
    h
}

fn derive(key: &[u8; KEY_SIZE], iv: [u8; BLOCK_SIZE]) -> (Idea, HmacSha256) {
    let hk = Hkdf::<Sha256>::new(Some(&iv), key);
    let mut enc = [0u8; KEY_SIZE];
    let mut mac = [0u8; 32];
    hk.expand(INFO_ENC, &mut enc)
        .expect("16 bytes is a valid HKDF-SHA256 output length");
    hk.expand(INFO_MAC, &mut mac)
        .expect("32 bytes is a valid HKDF-SHA256 output length");
    let cipher = Idea::new(&enc);
    let hmac = HmacSha256::new_from_slice(&mac).expect("HMAC accepts keys of any length");
    enc.zeroize();
    mac.zeroize();
    (cipher, hmac)
}
