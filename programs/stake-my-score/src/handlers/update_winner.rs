use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::{GameAccount, BettorAccount, PoolState};
use crate::error::StakeMyScoreError;
use crate::constants::*;

#[derive(Accounts)]
pub struct UpdateWinner<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, game.match_id.as_bytes(), &game.pool_index.to_le_bytes()],
        bump = game.bump,
        has_one = oracle @ StakeMyScoreError::UnauthorizedOracle,
        constraint = game.pool_state == PoolState::Settled @ StakeMyScoreError::PoolNotSettled
    )]
    pub game: Account<'info, GameAccount>,
    pub oracle: Signer<'info>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump = game.escrow_bump,
    )]
    pub escrow_vault: SystemAccount<'info>,
    #[account(mut)]
    pub fee_receiver: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> UpdateWinner<'info> {
    pub fn update_winner(
        &mut self,
        is_any_winner: bool,
        remaining_accounts: &'info [AccountInfo<'info>],
    ) -> Result<()> {
        if is_any_winner {
            require!(
                !remaining_accounts.is_empty(),
                StakeMyScoreError::NoWinnersProvided
            );

            self.game.is_any_winner = true;

            // update all the winners is_winner to true
            let mut count: u8 = 0;
            for bettor_info in remaining_accounts.iter() {
                if bettor_info.owner != &crate::ID {
                    continue; // skip if not a program account
                }

                let mut bettor_account: Account<BettorAccount> =
                    Account::try_from(bettor_info)
                    .map_err(|_| StakeMyScoreError::InvalidBettorAccount)?;

                bettor_account.is_winner = true;
                count += 1;

                bettor_account.exit(&crate::ID)?;
            }

            self.game.winner_count = count;

            // Transfer platform fee
            // total after platform fee
            let fee_amount = (self.game.total_bettors as u64 * FIXED_STAKE_SOL) * PLATFORM_FEE_BPS / BPS_DENOMINATOR;
            let total_after_fee = (self.game.total_bettors as u64 * FIXED_STAKE_SOL) - fee_amount;

            let game = self.game.key();
            let seeds = &[
                ESCROW_SEED,
                game.as_ref(),
                &[self.game.escrow_bump],
            ];
            let signer_seeds = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: self.escrow_vault.to_account_info(),
                to: self.fee_receiver.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            );
            transfer(cpi_ctx, fee_amount)?;
            self.game.fee_collected = true;

            self.game.payout_amount = total_after_fee / (count as u64);

        } else {
            require!(
                remaining_accounts.is_empty(),
                StakeMyScoreError::UnexpectedWinnerAccounts
            );
            self.game.is_any_winner = false;
        }
        Ok(())
    }
}
