use anchor_lang::prelude::*;
use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;
use anchor_lang::system_program::{transfer, Transfer};

use crate::state::{GameAccount, BettorAccount, PoolState};
use crate::error::StakeMyScoreError;
use crate::constants::*;

#[derive(Accounts)]
pub struct ClaimOrRefund<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, game.match_id.as_bytes(), &game.pool_index.to_le_bytes()],
        bump = game.bump,
        constraint = game.pool_state == PoolState::Settled @ StakeMyScoreError::PoolNotSettled
    )]
    pub game: Account<'info, GameAccount>,

    #[account(
        mut,
        seeds = [BETTOR_SEED, bettor_account.bettor.as_ref(), game.key().as_ref()],
        bump = bettor_account.bump,
        has_one = bettor @ StakeMyScoreError::UnauthorizedBettor,
        close = bettor
    )]
    pub bettor_account: Account<'info, BettorAccount>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(mut)]
    pub escrow_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> ClaimOrRefund<'info> {
    pub fn claim_or_refund(&mut self) -> Result<()> {
        // Winners case
        if self.game.is_any_winner {
            require!(self.bettor_account.is_winner, StakeMyScoreError::NotAWinner);

            let payout = self.game.payout_amount;

            // Transfer payout to bettor
            let seeds = &[
                GAME_SEED,
                self.game.match_id.as_bytes(),
                &self.game.pool_index.to_le_bytes(),
                &[self.game.bump],
            ];
            let signer_seeds = &[&seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.escrow_vault.to_account_info(),
                    to: self.bettor.to_account_info(),
                },
                signer_seeds,
            );
            transfer(cpi_ctx, payout as u64 * LAMPORTS_PER_SOL)?;
        }
        // Refund case (no winners)
        else {
            // Refund fixed stake amount
            let seeds = &[
                GAME_SEED,
                self.game.match_id.as_bytes(),
                &self.game.pool_index.to_le_bytes(),
                &[self.game.bump],
            ];
            let signer_seeds = &[&seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.escrow_vault.to_account_info(),
                    to: self.bettor.to_account_info(),
                },
                signer_seeds,
            );
            transfer(cpi_ctx, FIXED_STAKE_SOL)?;
        }

        Ok(())
    }
}
