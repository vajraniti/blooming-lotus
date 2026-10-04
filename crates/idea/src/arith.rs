//! The three group operations IDEA mixes on 16-bit words.
//!
//! IDEA gets its strength from never letting two of these operations meet in an
//! algebraically friendly way: XOR on (Z/2)^16, addition on Z/2^16 and
//! multiplication on (Z/(2^16 + 1))^*. No pair of them is distributive or
//! associative over the other.

/// Addition modulo 2^16 (the `⊞` box in the round diagram).
#[inline]
#[must_use]
pub const fn add(a: u16, b: u16) -> u16 {
    a.wrapping_add(b)
}

/// Multiplication modulo 2^16 + 1 (the `⊙` box), where the word 0 stands for 2^16.
///
/// 65537 is prime, so every word has an inverse under this operation. The code is
/// branch-free: the textbook `if a == 0` shortcut makes the running time depend
/// on key words.
#[inline]
#[must_use]
pub const fn mul(a: u16, b: u16) -> u16 {
    // Both factors are in [1, 2^16], so the product fits in 33 bits.
    let p = widen(a) * widen(b);
    let lo = (p & 0xFFFF) as i64;
    let hi = (p >> 16) as i64;
    // 2^16 ≡ −1 (mod 2^16 + 1), hence p = hi·2^16 + lo ≡ lo − hi.
    let t = lo - hi;
    // t lies in [−2^16, 2^16 − 1]; add the modulus back when it went negative.
    let r = t + ((t >> 63) & 0x1_0001);
    // r lies in [1, 2^16], and IDEA writes 2^16 as the word 0, which is what the cast does.
    r as u16
}

/// Multiplicative inverse modulo 2^16 + 1, with 0 standing for 2^16 as in [`mul`].
///
/// Uses Fermat's little theorem, a^(p−2) ≡ a^(−1) (mod p). The exponent is a
/// public constant, so the sequence of multiplications never depends on `a`.
#[must_use]
pub const fn mul_inv(a: u16) -> u16 {
    const EXPONENT: u32 = 0x1_0001 - 2;
    let mut result = 1;
    let mut base = a;
    let mut e = EXPONENT;
    while e != 0 {
        if e & 1 == 1 {
            result = mul(result, base);
        }
        base = mul(base, base);
        e >>= 1;
    }
    result
}

/// Maps the word 0 to 2^16 and leaves every other word as is, without branching.
#[inline]
const fn widen(a: u16) -> u64 {
    let a = a as u64;
    // a − 1 borrows through bit 16 only when a == 0.
    a | (((a.wrapping_sub(1) >> 16) & 1) << 16)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reference_mul(a: u16, b: u16) -> u16 {
        let wide = |x: u16| if x == 0 { 0x1_0000u64 } else { u64::from(x) };
        let r = wide(a) * wide(b) % 0x1_0001;
        if r == 0x1_0000 { 0 } else { r as u16 }
    }

    #[test]
    fn mul_matches_reference_on_edges() {
        let edges = [0u16, 1, 2, 0x7FFF, 0x8000, 0x8001, 0xFFFE, 0xFFFF];
        for &a in &edges {
            for b in 0..=u16::MAX {
                assert_eq!(mul(a, b), reference_mul(a, b), "a={a:#06x} b={b:#06x}");
            }
        }
    }

    #[test]
    fn mul_matches_reference_on_random_pairs() {
        // xorshift32: deterministic, so a failure reproduces.
        let mut s = 0x9E37_79B9u32;
        for _ in 0..2_000_000 {
            s ^= s << 13;
            s ^= s >> 17;
            s ^= s << 5;
            let (a, b) = ((s >> 16) as u16, s as u16);
            assert_eq!(mul(a, b), reference_mul(a, b), "a={a:#06x} b={b:#06x}");
        }
    }

    #[test]
    fn zero_is_two_to_the_sixteen() {
        // 2^16 · 2^16 = (−1)(−1) = 1
        assert_eq!(mul(0, 0), 1);
        // 2^16 · 2 = −2 = 2^16 − 1
        assert_eq!(mul(0, 2), 0xFFFF);
    }

    #[test]
    fn every_word_has_an_inverse() {
        for a in 0..=u16::MAX {
            assert_eq!(mul(a, mul_inv(a)), 1, "a={a:#06x}");
        }
        assert_eq!(mul_inv(0), 0, "2^16 ≡ −1 is its own inverse");
        assert_eq!(mul_inv(1), 1);
    }
}
