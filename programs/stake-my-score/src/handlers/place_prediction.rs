use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::*;
use crate::error::*;

use anchor_lang::system_program::{transfer, Transfer};

#[derive(Accounts)]
#[instruction(runs: u16, wickets: u8)]
pub struct PlacePrediction<'info> {
    #[account(
        mut,
        seeds = [
            GAME_SEED,
            game.match_id.as_bytes(),
            &game.pool_index.to_le_bytes()
        ],
        bump = game.bump,
        constraint = game.pool_state == PoolState::Open @ StakeMyScoreError::PoolLocked,
        constraint = game.total_bettors < MAX_BETTORS @ StakeMyScoreError::PoolFull
    )]
    pub game: Account<'info, GameAccount>,

    #[account(
        init,
        payer = bettor,
        seeds = [
            BETTOR_SEED,
            game.key().as_ref(),
            bettor.key().as_ref()
        ],
        bump,
        space = 8 + BettorAccount::INIT_SPACE
    )]
    pub bettor_account: Account<'info, BettorAccount>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump = game.escrow_bump
    )]
    pub escrow_vault: SystemAccount<'info>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> PlacePrediction<'info> {
    pub fn place_prediction(
        &mut self,
        runs: u16,
        wickets: u8,
        bettor_bump: u8
    ) -> Result<()> {
        // Transfer exactly 1 SOL to the escrow vault
        let cpi_accounts = Transfer {
            from: self.bettor.to_account_info(),
            to: self.escrow_vault.to_account_info(),
        };

        let cpi_ix = CpiContext::new(self.system_program.to_account_info(), cpi_accounts);

        transfer(cpi_ix, FIXED_STAKE_SOL)?;


        // Initialize bettor account
        self.bettor_account.set_inner(BettorAccount {
            game: self.game.key(),
            bettor: self.bettor.key(),
            runs_predicted: runs,
            wickets_predicted: wickets,
            is_winner: false,
            bump: bettor_bump,
        });

        // Increment pool bettors
        self.game.total_bettors += 1;

        Ok(())
    }
}
