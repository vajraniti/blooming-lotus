use core::fmt;

/// Everything that can go wrong in this crate.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[non_exhaustive]
pub enum Error {
    /// A key was not exactly 16 bytes.
    KeyLength {
        /// Length that was passed in.
        got: usize,
    },
    /// An IV or counter block was not exactly 8 bytes.
    IvLength {
        /// Length that was passed in.
        got: usize,
    },
    /// ECB/CBC ciphertext, or plaintext without padding, is not a whole number of 8-byte blocks.
    Unaligned {
        /// Length that was passed in.
        len: usize,
    },
    /// PKCS#7 padding at the end of the decrypted data is malformed:
    /// the key or IV is wrong, or the ciphertext was cut or altered.
    BadPadding,
    /// The data does not start with the sealed-file magic bytes `IDEA`.
    NotSealed,
    /// The sealed file was written by a format version this code does not know.
    UnsupportedVersion(u8),
    /// The sealed file names a cipher mode this code does not know.
    UnknownMode(u8),
    /// The sealed file is shorter than its header, tag or embedded name require.
    Truncated,
    /// The authentication tag does not match: wrong key, or the file was altered.
    Tampered,
    /// A file name longer than a sealed file can carry.
    FileNameTooLong {
        /// Length of the name in UTF-8 bytes.
        len: usize,
    },
    /// The embedded file name is not valid UTF-8 (only possible with a forged file).
    BadFileName,
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            Self::KeyLength { got } => {
                write!(f, "key must be 16 bytes (128 bits), got {got}")
            }
            Self::IvLength { got } => write!(f, "IV must be 8 bytes (64 bits), got {got}"),
            Self::Unaligned { len } => write!(
                f,
                "ECB/CBC data must be a whole number of 8-byte blocks, got {len} bytes"
            ),
            Self::BadPadding => f.write_str(
                "bad PKCS#7 padding after decryption: wrong key or IV, or damaged ciphertext",
            ),
            Self::NotSealed => f.write_str("not a sealed IDEA file: magic bytes `IDEA` missing"),
            Self::UnsupportedVersion(v) => {
                write!(f, "sealed file format version {v} is not supported")
            }
            Self::UnknownMode(m) => write!(f, "sealed file uses unknown cipher mode {m}"),
            Self::Truncated => f.write_str("sealed file is truncated"),
            Self::Tampered => {
                f.write_str("authentication failed: wrong key, or the file was modified")
            }
            Self::FileNameTooLong { len } => write!(
                f,
                "file name is {len} bytes in UTF-8, a sealed file holds at most {}",
                u16::MAX
            ),
            Self::BadFileName => f.write_str("embedded file name is not valid UTF-8"),
        }
    }
}

impl core::error::Error for Error {}
