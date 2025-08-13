use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GameAccount {
    /// PDA bump for this GameAccount
    pub bump: u8,
    /// Short match identifier (e.g. "INDvPAK_2025-08-15_T20")
    #[max_len(64)]
    pub match_id: String,
    /// Which pool number this is for the given match
    pub pool_index: u16,
    /// Authorized oracle who can call lock_pool & submit_result
    pub oracle: Pubkey,
    /// Escrow token account that holds the pool funds
    pub escrow_vault: Pubkey,
    pub escrow_bump: u8,
    pub total_bettors: u8,
    /// Pool lifecycle state (Open / Locked / Settled / Cancelled)
    pub pool_state: PoolState,
    /// For determining is the pool will be refunded
    pub is_any_winner: bool,
    /// Number of winners identified after settlement
    pub winner_count: u8,
    pub payout_amount: u64,
    pub final_runs: Option<u16>,
    pub final_wickets: Option<u8>,
    pub fee_collected: bool,
    /// Creation timestamp
    pub created_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum PoolState {
    Open,
    Locked,
    Settled,
    Cancelled,
}