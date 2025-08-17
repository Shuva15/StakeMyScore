# Stake My Score 
A Solana betting protocol where users stake SOL to predict cricket match outcomes (runs and wickets).  

---

## Overview
A **pool-based betting system** on Solana. Users lock a fixed stake into the **escrow PDA** by placing predictions. An **oracle** account submits the final match result. The program determines **winners** and distributes the pot proportionally.
Winners share the pool, losers get nothing, and a small platform fee is deducted.
If a pool has no winners (correct prediction) all bets are refunded.

Built with [Anchor](https://www.anchor-lang.com/).

---

## Features
- ✅ Predict `runs` and `wickets` of a cricket match.  
- ✅ Funds securely stored in an **escrow PDA**.  
- ✅ **Oracle-submitted results** ensure fair outcome.  
- ✅ **Automatic winner detection** and payouts.  
- ✅ **Platform fee collection** sent to a admin account.  
- ✅ Tested on both **localnet** and **devnet**.  

---

## Program Accounts

### **GameAccount (Pool State)**
Represents **one betting pool** for a given cricket match.
- Each match (`match_id`) can have multiple pools (`pool_index`).  
- Stores:
  - Which **oracle** is authorized.  
  - Whether the pool is **open** or **locked**.  
  - The **final result** (runs, wickets) once submitted.  
  - Total **Bettors** in the pool.  
  - A flag if **winners have already been updated**.  

### **Escrow Vault (PDA)**  
  Holds the staked SOL until results are finalized for a **GameAccount (Pool)**.

### **BettorAccount**
Represents **a single bettor’s prediction** for a specific pool.  
Each **GameAccount (Pool)** can support **up to 200 BettorAccount (bettors)**. 
- Stores:
  - Bettor’s **public key**.
  - Their **prediction** (runs + wickets).  
  - Whether they won (after result is added in game account).

---

## Program Instructions

### 1. initializePool
➡️ Create a new game pool.  
**Interact:** Created with `match_id`, `pool_index`.

### 2. placePrediction
➡️ Bettor stakes SOL and records prediction.  
**Interact:** Bettor calls with `(runs_predicted, wickets_predicted)` and staking the bet amount.

### 3. lockPool
➡️ Stop new bets.  
**Interact:** Oracle signs to lock the pool when the match begins.

### 4. submitResult
➡️ Record final runs & wickets.  
**Interact:** Oracle signs with `(final_runs, final_wickets)` after the match finished.

### 5. updateWinner
➡️ Mark winners, collect fee, prep payouts.  
**Interact:** Oracle provides winner bettor accounts, the instruction updates them as winner.

### 6. claimOrRefund
➡️ Winner claims payout or bettor gets refund.  
**Interact:** Bettor calls, providing their BettorAccount PDA.

---

## 🌐 Devnet Deployment
- **Contract Address:** `GP4V3sVgGuqTWAbmBn6T6ZCxtzBE2o5zsudYQS1YzjGQ`  
- Verify on Devnet:  
  ```bash
  solana program show GP4V3sVgGuqTWAbmBn6T6ZCxtzBE2o5zsudYQS1YzjGQ --url devnet

---

MIT License © 2025