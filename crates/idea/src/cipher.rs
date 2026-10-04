use core::fmt;

use zeroize::Zeroize;

use crate::Error;
use crate::arith::{add, mul, mul_inv};

/// Block size in bytes (64 bits).
pub const BLOCK_SIZE: usize = 8;
/// Key size in bytes (128 bits).
pub const KEY_SIZE: usize = 16;
/// Number of full rounds; an output transformation ("half round") follows them.
pub const ROUNDS: usize = 8;
/// Number of 16-bit subkeys: six per round plus four for the output transformation.
pub const SUBKEYS: usize = 6 * ROUNDS + 4;

/// An IDEA instance with both key schedules expanded.
///
/// Subkeys are wiped from memory when the value is dropped.
#[derive(Clone)]
pub struct Idea {
    enc: [u16; SUBKEYS],
    dec: [u16; SUBKEYS],
}

impl Idea {
    /// Expands a 128-bit key into the 52 encryption and 52 decryption subkeys.
    #[must_use]
    pub fn new(key: &[u8; KEY_SIZE]) -> Self {
        let enc = expand_key(key);
        let dec = invert_key(&enc);
        Self { enc, dec }
    }

    /// Same as [`Idea::new`], for a key whose length is only known at run time.
    ///
    /// # Errors
    /// [`Error::KeyLength`] if `key` is not exactly 16 bytes.
    pub fn new_from_slice(key: &[u8]) -> Result<Self, Error> {
        let key =
            <&[u8; KEY_SIZE]>::try_from(key).map_err(|_| Error::KeyLength { got: key.len() })?;
        Ok(Self::new(key))
    }

    /// Encrypts one 64-bit block in place.
    pub fn encrypt_block(&self, block: &mut [u8; BLOCK_SIZE]) {
        *block = to_bytes(crypt(from_bytes(*block), &self.enc));
    }

    /// Decrypts one 64-bit block in place.
    pub fn decrypt_block(&self, block: &mut [u8; BLOCK_SIZE]) {
        *block = to_bytes(crypt(from_bytes(*block), &self.dec));
    }

    /// The 52 encryption subkeys Z1..Z52, in the order the rounds consume them.
    #[must_use]
    pub fn encryption_subkeys(&self) -> &[u16; SUBKEYS] {
        &self.enc
    }

    /// The 52 decryption subkeys, in the order the rounds consume them.
    #[must_use]
    pub fn decryption_subkeys(&self) -> &[u16; SUBKEYS] {
        &self.dec
    }

    /// Encrypts one block and records every intermediate word along the way.
    #[must_use]
    pub fn trace_encrypt(&self, block: &[u8; BLOCK_SIZE]) -> BlockTrace {
        trace(from_bytes(*block), &self.enc)
    }

    /// Decrypts one block and records every intermediate word along the way.
    #[must_use]
    pub fn trace_decrypt(&self, block: &[u8; BLOCK_SIZE]) -> BlockTrace {
        trace(from_bytes(*block), &self.dec)
    }
}

impl Drop for Idea {
    fn drop(&mut self) {
        self.enc.zeroize();
        self.dec.zeroize();
    }
}

impl fmt::Debug for Idea {
    // Never print subkeys: they are the key.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Idea").finish_non_exhaustive()
    }
}

/// One full round, as drawn in the classic IDEA diagram.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RoundTrace {
    /// Words X1..X4 entering the round.
    pub input: [u16; 4],
    /// Subkeys Z1..Z6 of this round.
    pub subkeys: [u16; 6],
    /// Results of the 14 steps of the round; `steps[i]` is step `i + 1`.
    ///
    /// 1. X1 ⊙ Z1  2. X2 ⊞ Z2  3. X3 ⊞ Z3  4. X4 ⊙ Z4
    /// 5. (1) ⊕ (3)  6. (2) ⊕ (4)  7. (5) ⊙ Z5  8. (6) ⊞ (7)
    /// 9. (8) ⊙ Z6  10. (7) ⊞ (9)
    /// 11. (1) ⊕ (9)  12. (3) ⊕ (9)  13. (2) ⊕ (10)  14. (4) ⊕ (10)
    pub steps: [u16; 14],
}

impl RoundTrace {
    /// Words leaving the round: steps 11, 12, 13, 14 — the inner pair already swapped.
    #[must_use]
    pub fn output(&self) -> [u16; 4] {
        [
            self.steps[10],
            self.steps[11],
            self.steps[12],
            self.steps[13],
        ]
    }
}

/// The output transformation that closes the cipher (the "half round").
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OutputTrace {
    /// Words leaving round 8.
    pub input: [u16; 4],
    /// Subkeys Z49..Z52.
    pub subkeys: [u16; 4],
    /// The final block: X1 ⊙ Z49, X3 ⊞ Z50, X2 ⊞ Z51, X4 ⊙ Z52.
    pub output: [u16; 4],
}

/// Every intermediate value of one block passing through IDEA.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlockTrace {
    /// The eight full rounds.
    pub rounds: [RoundTrace; ROUNDS],
    /// The output transformation.
    pub output: OutputTrace,
}

impl BlockTrace {
    /// The resulting block as bytes.
    #[must_use]
    pub fn output_bytes(&self) -> [u8; BLOCK_SIZE] {
        to_bytes(self.output.output)
    }
}

/// Key schedule: the 128-bit key cut into eight 16-bit words, then rotated left
/// by 25 bits for every next group of eight, until 52 words are taken.
fn expand_key(key: &[u8; KEY_SIZE]) -> [u16; SUBKEYS] {
    let mut k = u128::from_be_bytes(*key);
    let mut z = [0u16; SUBKEYS];
    for (i, zi) in z.iter_mut().enumerate() {
        let slot = i % 8;
        *zi = (k >> (112 - 16 * slot)) as u16;
        if slot == 7 {
            k = k.rotate_left(25);
        }
    }
    k.zeroize();
    z
}

/// Decryption runs the same rounds with inverted subkeys taken in reverse order:
/// ⊙-keys become multiplicative inverses, ⊞-keys additive inverses, the two ⊞-keys
/// of every inner round trade places (undoing the word swap), and the MA-structure
/// keys Z5, Z6 are reused unchanged because XOR-ing their output twice cancels it.
fn invert_key(z: &[u16; SUBKEYS]) -> [u16; SUBKEYS] {
    let mut d = [0u16; SUBKEYS];
    for i in 0..=ROUNDS {
        let j = ROUNDS - i;
        d[6 * i] = mul_inv(z[6 * j]);
        d[6 * i + 3] = mul_inv(z[6 * j + 3]);
        let (a, b) = if i == 0 || i == ROUNDS {
            (1, 2)
        } else {
            (2, 1)
        };
        d[6 * i + 1] = z[6 * j + a].wrapping_neg();
        d[6 * i + 2] = z[6 * j + b].wrapping_neg();
        if i < ROUNDS {
            d[6 * i + 4] = z[6 * (j - 1) + 4];
            d[6 * i + 5] = z[6 * (j - 1) + 5];
        }
    }
    d
}

/// One round. Returns the words for the next round and all 14 step results.
///
/// The fast path and the tracer both call this, so a traced block is by
/// construction the block that was really encrypted. Once inlined into the fast
/// path, which only reads `.0`, the step array is dead code and disappears.
#[inline]
fn round(x: [u16; 4], z: &[u16]) -> ([u16; 4], [u16; 14]) {
    let s1 = mul(x[0], z[0]);
    let s2 = add(x[1], z[1]);
    let s3 = add(x[2], z[2]);
    let s4 = mul(x[3], z[3]);
    // MA-structure: the only place where subkeys meet data from all four words.
    let s5 = s1 ^ s3;
    let s6 = s2 ^ s4;
    let s7 = mul(s5, z[4]);
    let s8 = add(s6, s7);
    let s9 = mul(s8, z[5]);
    let s10 = add(s7, s9);
    let s11 = s1 ^ s9;
    let s12 = s3 ^ s9;
    let s13 = s2 ^ s10;
    let s14 = s4 ^ s10;
    (
        // The inner two words swap places on the way out.
        [s11, s12, s13, s14],
        [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14],
    )
}

/// Output transformation. It crosses the inner words back, undoing the swap of round 8.
#[inline]
fn output_transform(x: [u16; 4], z: &[u16]) -> [u16; 4] {
    [
        mul(x[0], z[0]),
        add(x[2], z[1]),
        add(x[1], z[2]),
        mul(x[3], z[3]),
    ]
}

fn crypt(mut x: [u16; 4], z: &[u16; SUBKEYS]) -> [u16; 4] {
    for rk in z[..6 * ROUNDS].chunks_exact(6) {
        x = round(x, rk).0;
    }
    output_transform(x, &z[6 * ROUNDS..])
}

fn trace(mut x: [u16; 4], z: &[u16; SUBKEYS]) -> BlockTrace {
    let empty = RoundTrace {
        input: [0; 4],
        subkeys: [0; 6],
        steps: [0; 14],
    };
    let mut rounds = [empty; ROUNDS];
    for (r, rk) in rounds.iter_mut().zip(z[..6 * ROUNDS].chunks_exact(6)) {
        let (next, steps) = round(x, rk);
        let mut subkeys = [0; 6];
        subkeys.copy_from_slice(rk);
        *r = RoundTrace {
            input: x,
            subkeys,
            steps,
        };
        x = next;
    }
    let mut subkeys = [0; 4];
    subkeys.copy_from_slice(&z[6 * ROUNDS..]);
    let output = OutputTrace {
        input: x,
        subkeys,
        output: output_transform(x, &subkeys),
    };
    BlockTrace { rounds, output }
}

/// IDEA reads a block as four big-endian 16-bit words.
#[inline]
fn from_bytes(b: [u8; BLOCK_SIZE]) -> [u16; 4] {
    [
        u16::from_be_bytes([b[0], b[1]]),
        u16::from_be_bytes([b[2], b[3]]),
        u16::from_be_bytes([b[4], b[5]]),
        u16::from_be_bytes([b[6], b[7]]),
    ]
}

#[inline]
fn to_bytes(x: [u16; 4]) -> [u8; BLOCK_SIZE] {
    let [a, b] = x[0].to_be_bytes();
    let [c, d] = x[1].to_be_bytes();
    let [e, f] = x[2].to_be_bytes();
    let [g, h] = x[3].to_be_bytes();
    [a, b, c, d, e, f, g, h]
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Key 0001 0002 … 0008, the example from Lai's description of the cipher.
    const KEY: [u8; 16] = [0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8];

    #[test]
    fn first_eight_subkeys_are_the_key() {
        let c = Idea::new(&KEY);
        assert_eq!(c.encryption_subkeys()[..8], [1, 2, 3, 4, 5, 6, 7, 8]);
    }

    #[test]
    fn ninth_subkey_comes_after_a_25_bit_rotation() {
        let c = Idea::new(&KEY);
        let rotated = u128::from_be_bytes(KEY).rotate_left(25);
        assert_eq!(c.encryption_subkeys()[8], (rotated >> 112) as u16);
    }

    #[test]
    fn decryption_keys_invert_encryption_keys() {
        let c = Idea::new(&KEY);
        let (z, d) = (c.encryption_subkeys(), c.decryption_subkeys());
        assert_eq!(mul(d[0], z[48]), 1);
        assert_eq!(add(d[1], z[49]), 0);
        assert_eq!(add(d[2], z[50]), 0);
        assert_eq!(mul(d[3], z[51]), 1);
        assert_eq!(mul(d[48], z[0]), 1);
    }

    #[test]
    fn trace_agrees_with_fast_path() {
        let c = Idea::new(&KEY);
        let plain = [0, 0, 0, 1, 0, 2, 0, 3];
        let mut block = plain;
        c.encrypt_block(&mut block);
        let t = c.trace_encrypt(&plain);
        assert_eq!(t.output_bytes(), block);
        assert_eq!(t.rounds[0].input, from_bytes(plain));
        for w in t.rounds.windows(2) {
            assert_eq!(w[0].output(), w[1].input);
        }
        assert_eq!(t.rounds[ROUNDS - 1].output(), t.output.input);
        assert_eq!(c.trace_decrypt(&block).output_bytes(), plain);
    }

    #[test]
    fn debug_hides_subkeys() {
        assert_eq!(std::format!("{:?}", Idea::new(&KEY)), "Idea { .. }");
    }

    #[test]
    fn wrong_key_length_is_reported() {
        assert_eq!(
            Idea::new_from_slice(&[0; 15]).unwrap_err(),
            Error::KeyLength { got: 15 }
        );
    }
}
