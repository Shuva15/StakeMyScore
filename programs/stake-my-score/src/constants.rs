use anchor_lang::prelude::*;

#[constant]
pub const MAX_BETTORS: u8 = 200;
pub const PLATFORM_FEE_BPS: u64 = 300; // 3% in basis points
pub const FIXED_STAKE_SOL: u64 = 1_000_000_000;
pub const BPS_DENOMINATOR: u64 = 10000;
/// Seeds
pub const GAME_SEED: &[u8] = b"game";
pub const BETTOR_SEED: &[u8] = b"bettor";
pub const ESCROW_SEED: &[u8] = b"escrow";
