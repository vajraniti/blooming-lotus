//! IDEA, the International Data Encryption Algorithm (Xuejia Lai and James Massey, 1991).
//!
//! 64-bit blocks, a 128-bit key, eight rounds and an output transformation, built
//! from three operations on 16-bit words that do not get along: XOR, addition
//! modulo 2^16 and multiplication modulo 2^16 + 1.
//!
//! ```
//! use idea::Idea;
//!
//! let cipher = Idea::new(&[0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8]);
//! let mut block = [0, 0, 0, 1, 0, 2, 0, 3];
//! cipher.encrypt_block(&mut block);
//! assert_eq!(block, [0x11, 0xFB, 0xED, 0x2B, 0x01, 0x98, 0x6D, 0xE5]);
//! cipher.decrypt_block(&mut block);
//! assert_eq!(block, [0, 0, 0, 1, 0, 2, 0, 3]);
//! ```
//!
//! Features: `alloc` (default) adds [`modes`]; `seal` adds [`seal`], an
//! authenticated file format on top of CBC or CTR.
#![cfg_attr(not(test), no_std)]

#[cfg(feature = "alloc")]
extern crate alloc;

mod arith;
mod cipher;
mod error;
#[cfg(feature = "alloc")]
pub mod modes;
#[cfg(feature = "seal")]
pub mod seal;

pub use arith::{add, mul, mul_inv};
pub use cipher::{
    BLOCK_SIZE, BlockTrace, Idea, KEY_SIZE, OutputTrace, ROUNDS, RoundTrace, SUBKEYS,
};
pub use error::Error;
