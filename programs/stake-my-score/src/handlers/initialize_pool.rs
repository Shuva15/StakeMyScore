use anchor_lang::prelude::*;
use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;
use anchor_lang::system_program::{transfer, Transfer};
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
        mut,
        seeds = [ESCROW_SEED, game.key().as_ref()],
        bump,
    )]
    pub escrow_vault: SystemAccount<'info>,

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

        let rent_exempt = Rent::get()?.minimum_balance(self.escrow_vault.to_account_info().data_len());

        let cpi_accounts = Transfer {
            from: self.payer.to_account_info(),
            to: self.escrow_vault.to_account_info()
        };

        let cpi_ctx = CpiContext::new(self.system_program.to_account_info(), cpi_accounts);

        transfer(cpi_ctx, rent_exempt)?;

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
            payout_amount: FIXED_STAKE_SOL,
            final_runs: None,
            final_wickets: None,
            fee_collected: false,
            created_at: Clock::get()?.unix_timestamp
        });

        Ok(())
    }
}
