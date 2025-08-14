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

    #[msg("The bettor account provided is invalid")]
    InvalidBettorAccount,

    #[msg("If no winners, there shouldn't be any winner accounts")]
    UnexpectedWinnerAccounts,

    #[msg("Winners can't be empty")]
    NoWinnersProvided,

    #[msg("Wrong bettor account")]
    UnauthorizedBettor,

    #[msg("You didn't win")]
    NotAWinner,

    #[msg("Fee yet not collected")]
    FeeNotCollected,

    #[msg("Result is already updated")]
    ResultsAlreadyExcepted
}
