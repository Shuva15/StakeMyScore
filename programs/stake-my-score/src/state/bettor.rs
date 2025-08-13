use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct BettorAccount {
    /// The game/pool this bet belongs to
    pub game: Pubkey,
    pub bettor: Pubkey,
    pub runs_predicted: u16,
    pub wickets_predicted: u8,
    pub is_winner: bool,
    pub bump: u8,
}
