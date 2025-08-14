use anchor_lang::prelude::*;
use crate::state::{GameAccount, PoolState};
use crate::error::StakeMyScoreError;
use crate::constants::*;

#[derive(Accounts)]
pub struct SubmitResult<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, game.match_id.as_bytes(), &game.pool_index.to_le_bytes()],
        bump = game.bump,
        has_one = oracle @ StakeMyScoreError::UnauthorizedOracle,
        constraint = game.pool_state == PoolState::Locked @ StakeMyScoreError::PoolNotLocked
    )]
    pub game: Account<'info, GameAccount>,
    pub oracle: Signer<'info>,
}

impl<'info> SubmitResult<'info> {
    pub fn submit_result(
        &mut self,
        final_runs: u16,
        final_wickets: u8,
    ) -> Result<()> {
        require!(self.game.final_runs == None && self.game.final_wickets == None, StakeMyScoreError::ResultsAlreadyExcepted);
        // write final score and mark settled
        self.game.final_runs = Some(final_runs);
        self.game.final_wickets = Some(final_wickets);
        self.game.pool_state = PoolState::Settled;

        Ok(())
    }
}
