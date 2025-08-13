use anchor_lang::prelude::*;
use crate::state::{GameAccount, PoolState};
use crate::error::StakeMyScoreError;

#[derive(Accounts)]
pub struct LockPool<'info> {
    #[account(
        mut,
        has_one = oracle @ StakeMyScoreError::UnauthorizedOracle
    )]
    pub game: Account<'info, GameAccount>,

    /// CHECK: Verified via has_one
    pub oracle: Signer<'info>,
}

impl<'info> LockPool<'info> {
    pub fn lock_pool(&mut self) -> Result<()> {
        require!(
            self.game.pool_state == PoolState::Open,
            StakeMyScoreError::PoolNotOpen
        );

        self.game.pool_state = PoolState::Locked;
        Ok(())
    }
}
