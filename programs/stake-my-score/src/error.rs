use anchor_lang::prelude::*;

#[error_code]
pub enum StakeMyScoreError {
    #[msg("Pool is full")]
    PoolFull,

    #[msg("Pool is locked, no more bets allowed")]
    PoolLocked,

    #[msg("Unauthorized Oracle")]
    UnauthorizedOracle,

    #[msg("Pool is not open, so can't be locked")]
    PoolNotOpen,

    #[msg("Pool is not locked")]
    PoolNotLocked,

    #[msg("Pool is not yet settled")]
    PoolNotSettled,

    #[msg("If no winners, there shouldn't be any winner accounts")]
    UnexpectedWinnerAccounts,

    #[msg("Wrong bettor account")]
    UnauthorizedBettor,

    #[msg("You didn't win")]
    NotAWinner,

}
