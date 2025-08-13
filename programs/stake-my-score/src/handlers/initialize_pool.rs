use anchor_lang::prelude::*;
use crate::state::{GameAccount, PoolState};
use crate::constants::*;

#[derive(Accounts)]
#[instruction(match_id: String, pool_index: u16)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = payer,
        seeds = [
            GAME_SEED,
            match_id.as_bytes(),
            &pool_index.to_le_bytes()
        ],
        bump,
        space = 8 + GameAccount::INIT_SPACE
    )]
    pub game: Account<'info, GameAccount>,

    /// CHECK: Oracle authority — validated in logic
    pub oracle: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump,
        space = 8
    )]
    /// CHECK: Escrow vault for holding SOL
    pub escrow_vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializePool<'info> {
    pub fn initialize_pool(
        &mut self,
        match_id: String,
        pool_index: u16,
        bump: u8,
        escrow_bump: u8,
    ) -> Result<()> {

        self.game.set_inner(GameAccount { 
            bump, 
            match_id, 
            pool_index,
            oracle: self.oracle.key(),
            escrow_vault: self.escrow_vault.key(),
            escrow_bump,
            total_bettors: 0,
            pool_state: PoolState::Open,
            is_any_winner: false,
            winner_count: 0,
            payout_amount: 1,
            final_runs: None,
            final_wickets: None,
            fee_collected: false,
            created_at: Clock::get()?.unix_timestamp
        });

        Ok(())
    }
}
