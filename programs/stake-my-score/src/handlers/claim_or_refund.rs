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
        seeds = [BETTOR_SEED, game.key().as_ref(), bettor.key().as_ref()],
        bump = bettor_account.bump,
        has_one = bettor @ StakeMyScoreError::UnauthorizedBettor,
        close = bettor
    )]
    pub bettor_account: Account<'info, BettorAccount>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump = game.escrow_bump,
    )]
    pub escrow_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> ClaimOrRefund<'info> {
    pub fn claim_or_refund(&mut self) -> Result<()> {
        // Winners case
        if self.game.is_any_winner {
            require!(self.bettor_account.is_winner, StakeMyScoreError::NotAWinner);
            require!(self.game.fee_collected, StakeMyScoreError::FeeNotCollected);

            self.bettor_account.is_winner = false;
            let payout = self.game.payout_amount;

            let game = self.game.key();
            // Transfer payout to bettor
            let seeds = &[
                ESCROW_SEED,
                game.as_ref(),
                &[self.game.escrow_bump],
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
            transfer(cpi_ctx, payout)?;
        }
        // Refund case (no winners)
        else {
            // Refund fixed stake amount
            let game = self.game.key();
            let seeds = &[
                ESCROW_SEED,
                game.as_ref(),
                &[self.game.escrow_bump],
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
