use anchor_lang::prelude::*;
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
}

impl<'info> UpdateWinner<'info> {
    pub fn update_winner(
        &mut self,
        is_any_winner: bool,
        remaining_accounts: &'info [AccountInfo<'info>],
    ) -> Result<()> {
        require!(
            !(is_any_winner == false && remaining_accounts.is_empty()),
            StakeMyScoreError::UnexpectedWinnerAccounts
        );

        if is_any_winner {
            self.game.is_any_winner = true;

            // update all the winners is_winner to true
            let mut count: u8 = 0;
            for bettor_info in remaining_accounts.iter() {
                if bettor_info.owner != &crate::ID {
                    continue; // skip if not a program account
                }

                let mut bettor_account: Account<BettorAccount> =
                    Account::try_from(bettor_info).unwrap();

                bettor_account.is_winner = true;
                count += 1;

                bettor_account.exit(&crate::ID)?;
            }

            self.game.winner_count = count;
            self.game.payout_amount = self.game.total_bettors/count;


        } else {
            self.game.is_any_winner = false;
        }
        Ok(())
    }
}
