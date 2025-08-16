#![allow(unexpected_cfgs, deprecated)]
pub mod constants;
pub mod error;
pub mod handlers;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use handlers::*;
pub use state::*;

declare_id!("GP4V3sVgGuqTWAbmBn6T6ZCxtzBE2o5zsudYQS1YzjGQ");

#[program]
pub mod stake_my_score {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        match_id: String,
        pool_index: u16,
    ) -> Result<()> {
        ctx.accounts.initialize_pool(match_id, pool_index, ctx.bumps.game, ctx.bumps.escrow_vault)
    }

    pub fn place_prediction(
        ctx: Context<PlacePrediction>,
        runs: u16,
        wickets: u8,
    ) -> Result<()> {
        ctx.accounts.place_prediction(runs, wickets, ctx.bumps.bettor_account)
    }

    pub fn lock_pool(ctx: Context<LockPool>) -> Result<()> {
        ctx.accounts.lock_pool()
    }

    pub fn submit_result(
        ctx: Context<SubmitResult>,
        final_runs: u16,
        final_wickets: u8
    ) -> Result<()> {
        ctx.accounts.submit_result(final_runs, final_wickets)
    }

    pub fn update_winner<'info>(
        ctx: Context<'_, '_, 'info, 'info, UpdateWinner<'info>>,
        is_any_winner: bool,
    ) -> Result<()> {
        ctx.accounts.update_winner(is_any_winner, ctx.remaining_accounts)
    }

    pub fn claim_or_refund(ctx: Context<ClaimOrRefund>) -> Result<()> {
        ctx.accounts.claim_or_refund()
    }
}
