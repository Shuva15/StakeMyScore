import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  SystemProgram,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { assert, expect } from "chai";
import { StakeMyScore } from "../target/types/stake_my_score";

const GAME_SEED = Buffer.from("game");
const ESCROW_SEED = Buffer.from("escrow");
const BETTOR_SEED = Buffer.from("bettor");

// Constents
const FIXED_STAKE_SOL = 1 * LAMPORTS_PER_SOL;
const MAX_BETTORS = 200;
const PLATFORM_FEE_BPS = 300; // 3%
const BPS_DENOMINATOR = 10_000;

describe("stake_my_score, full flow with two pools", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.StakeMyScore as Program<StakeMyScore>;

  const payer = provider.wallet.publicKey;
  const oracle = Keypair.generate();
  const feeReceiver = Keypair.generate();

  const matchId = "INDvPAK_2025-08-15_T20";
  const poolIndex1 = 0;
  const poolIndex2 = 1;

  let game1Pda: PublicKey, escrow1Pda: PublicKey;
  let game2Pda: PublicKey, escrow2Pda: PublicKey;

  // Keypair of all the bettors, to sign the claim_or_refund instruction
  // In practical the bettor will siging this instruction with their wallet so we won't have to store it
  const bettorsGame1: Keypair[] = [];
  const bettorsGame2: Keypair[] = [];

  // Winners we’ll compute and keep PDAs for claims
  let winnersG1: anchor.ProgramAccount<{
    game: anchor.web3.PublicKey;
    bettor: anchor.web3.PublicKey;
    runsPredicted: number;
    wicketsPredicted: number;
    isWinner: boolean;
    bump: number;
  }>[] = [];
  let winnersG2: anchor.ProgramAccount<{
    game: anchor.web3.PublicKey;
    bettor: anchor.web3.PublicKey;
    runsPredicted: number;
    wicketsPredicted: number;
    isWinner: boolean;
    bump: number;
  }>[] = [];

  async function airdrop(pubkey: PublicKey, sol: number) {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL),
      "confirmed"
    );
  }

  async function lamports(pubkey: PublicKey) {
    return provider.connection.getBalance(pubkey, "confirmed");
  }

  it("1) Initialize pool 1", async () => {
    await airdrop(payer, 6);
    await airdrop(oracle.publicKey, 2);
    await airdrop(feeReceiver.publicKey, 1);

    [game1Pda] = PublicKey.findProgramAddressSync(
      [
        GAME_SEED,
        Buffer.from(matchId),
        new anchor.BN(poolIndex1).toArrayLike(Buffer, "le", 2),
      ],
      program.programId
    );
    [escrow1Pda] = PublicKey.findProgramAddressSync(
      [ESCROW_SEED, game1Pda.toBuffer()],
      program.programId
    );

    await program.methods
      .initializePool(matchId, poolIndex1)
      .accountsPartial({
        game: game1Pda,
        oracle: oracle.publicKey,
        escrowVault: escrow1Pda,
        payer,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("2) Add exactly 200 bettors to pool 1", async () => {
    for (let i = 0; i < MAX_BETTORS; i++) {
      const bettor = Keypair.generate();
      bettorsGame1.push(bettor);
      await airdrop(bettor.publicKey, 2);

      const [bettorPda] = PublicKey.findProgramAddressSync(
        [BETTOR_SEED, game1Pda.toBuffer(), bettor.publicKey.toBuffer()],
        program.programId
      );

      // runs = i%50, wickets = i%10
      await program.methods
        .placePrediction(
          Number(new anchor.BN(i % 50)),
          Number(new anchor.BN(i % 10))
        )
        .accountsPartial({
          game: game1Pda,
          bettorAccount: bettorPda,
          escrowVault: escrow1Pda,
          bettor: bettor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor])
        .rpc({ commitment: "confirmed" });
    }
    console.log(
      "Pool one escrow balance after 200 bet: ",
      await lamports(escrow1Pda)
    );
  });

  it("3) 201st bettor should fail with PoolFull", async () => {
    const extra = Keypair.generate();
    await airdrop(extra.publicKey, 2);

    const [bettorPda] = PublicKey.findProgramAddressSync(
      [BETTOR_SEED, game1Pda.toBuffer(), extra.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .placePrediction(Number(new anchor.BN(10)), Number(new anchor.BN(2)))
        .accountsPartial({
          game: game1Pda,
          bettorAccount: bettorPda,
          escrowVault: escrow1Pda,
          bettor: extra.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([extra])
        .rpc();
    } catch (e) {
      expect(e).to.match(/PoolFull/);
      console.log("Expected PoolFull error found: ", e.message);
    }
  });

  it("4) Initialize pool 2 and place ~50 bets", async () => {
    [game2Pda] = PublicKey.findProgramAddressSync(
      [
        GAME_SEED,
        Buffer.from(matchId),
        new anchor.BN(poolIndex2).toArrayLike(Buffer, "le", 2),
      ],
      program.programId
    );
    [escrow2Pda] = PublicKey.findProgramAddressSync(
      [ESCROW_SEED, game2Pda.toBuffer()],
      program.programId
    );

    await program.methods
      .initializePool(matchId, poolIndex2)
      .accountsPartial({
        game: game2Pda,
        oracle: oracle.publicKey,
        escrowVault: escrow2Pda,
        payer,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    for (let i = 0; i < 50; i++) {
      const bettor = Keypair.generate();
      bettorsGame2.push(bettor);
      await airdrop(bettor.publicKey, 2);

      const [bettorPda] = PublicKey.findProgramAddressSync(
        [BETTOR_SEED, game2Pda.toBuffer(), bettor.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .placePrediction(
          Number(new anchor.BN(i % 50)),
          Number(new anchor.BN(i % 10))
        )
        .accountsPartial({
          game: game2Pda,
          bettorAccount: bettorPda,
          escrowVault: escrow2Pda,
          bettor: bettor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor])
        .rpc({ commitment: "confirmed" });
    }
    console.log(
      "Pool two escrow balance after 50 bet: ",
      await lamports(escrow2Pda)
    );
  });

  it("5) Lock both pools; adding to locked pool should fail", async () => {
    await program.methods
      .lockPool()
      .accountsPartial({
        game: game1Pda,
        oracle: oracle.publicKey,
      })
      .signers([oracle])
      .rpc();

    await program.methods
      .lockPool()
      .accountsPartial({
        game: game2Pda,
        oracle: oracle.publicKey,
      })
      .signers([oracle])
      .rpc();

    // Try to add bettor to locked pool2
    const lateBettor = Keypair.generate();
    await airdrop(lateBettor.publicKey, 2);
    const [lateBettorPda] = PublicKey.findProgramAddressSync(
      [BETTOR_SEED, game2Pda.toBuffer(), lateBettor.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .placePrediction(Number(new anchor.BN(1)), Number(new anchor.BN(1)))
        .accountsPartial({
          game: game2Pda,
          bettorAccount: lateBettorPda,
          escrowVault: escrow2Pda,
          bettor: lateBettor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([lateBettor])
        .rpc();
    } catch (e) {
      expect(e).to.match(/PoolLocked/);
      console.log("Expected PoolLocked error found: ", e.message);
    }
  });

  it("6) Submit result with unauthorized oracle should fail", async () => {
    const finalRuns1 = 42;
    const finalWickets1 = 2;

    try {
      await program.methods
        .submitResult(
          Number(new anchor.BN(finalRuns1)),
          Number(new anchor.BN(finalWickets1))
        )
        .accountsPartial({
          game: game1Pda,
          oracle: feeReceiver.publicKey,
        })
        .signers([feeReceiver])
        .rpc();
    } catch (e) {
      expect(e).to.match(/UnauthorizedOracle/);
    }
  });

  it("7) Submit results: pool1 with winners, pool2 no winners, then update winners", async () => {
    // we have to choose scores consistent with the (i%50, i%10) calculation
    // For solutions to exist, we need finalWickets ≡ finalRuns (mod 10)
    const finalRuns1 = 42;
    const finalWickets1 = 2; // 42 % 10 === 2 ⇒ winners exist (4 winners -> 42, 92, 142, 192)
    const noWinnerRuns2 = 999;
    const noWinnerWkts2 = 9;

    await program.methods
      .submitResult(
        Number(new anchor.BN(finalRuns1)),
        Number(new anchor.BN(finalWickets1))
      )
      .accountsPartial({
        game: game1Pda,
        oracle: oracle.publicKey,
      })
      .signers([oracle])
      .rpc();

    // Pool2: submit a score pattern that matches no bettors
    await program.methods
      .submitResult(
        Number(new anchor.BN(noWinnerRuns2)),
        Number(new anchor.BN(noWinnerWkts2))
      )
      .accounts({
        game: game2Pda,
        oracle: oracle.publicKey,
      })
      .signers([oracle])
      .rpc();
  });

  it("8) Backend finds winners for pool 1", async () => {
    // Backend fetching all bettor PDAs for pool 1
    const allBettors = await program.account.bettorAccount.all([
      { memcmp: { offset: 8, bytes: game1Pda.toBase58() } },
    ]);

    assert.equal(allBettors.length, MAX_BETTORS, "Should have 200 bettors");

    // Find winners based on final score
    const finalRuns1 = 42;
    const finalWickets1 = 2;
    winnersG1 = allBettors.filter(
      (acc) =>
        acc.account.runsPredicted === finalRuns1 &&
        acc.account.wicketsPredicted === finalWickets1
    );
    console.log(`Backend found ${winnersG1.length} winners in pool 1`);
    assert.isAbove(winnersG1.length, 0, "Expected some winners");
  });

  it("9) Backend finds 0 winners for pool 2", async () => {
    const allBettors = await program.account.bettorAccount.all([
      { memcmp: { offset: 8, bytes: game2Pda.toBase58() } },
    ]);

    assert.equal(allBettors.length, 50, "Should have 50 bettors");

    // Find winners based on final score
    const finalRuns2 = 999;
    const finalWickets2 = 9;
    winnersG2 = allBettors.filter(
      (acc) =>
        acc.account.runsPredicted === finalRuns2 &&
        acc.account.wicketsPredicted === finalWickets2
    );
    console.log(`Backend found ${winnersG2.length} winners in pool 2`);
    assert.equal(winnersG2.length, 0, "Expected no winners");
  });

  it("10) UpdateWinner error cases: winner true with now accounts, winner false with accounts", async () => {
    // calling updateWinner(true) with empty winners list
    try {
      await program.methods
        .updateWinner(true)
        .accountsPartial({
          game: game1Pda,
          oracle: oracle.publicKey,
          escrowVault: escrow1Pda,
          feeReceiver: feeReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([oracle])
        .rpc();
    } catch (e) {
      expect(e).to.match(/NoWinnersProvided/);
    }

    // calling updateWinner(false) but passing accounts
    try {
      await program.methods
        .updateWinner(false)
        .accountsPartial({
          game: game1Pda,
          oracle: oracle.publicKey,
          escrowVault: escrow1Pda,
          feeReceiver: feeReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: escrow1Pda, isWritable: false, isSigner: false },
        ])
        .signers([oracle])
        .rpc();
    } catch (e) {
      expect(e).to.match(/UnexpectedWinnerAccounts/);
    }
  });

  it("11) UpdateWinner: pool1 winners, pool2 no winners", async () => {
    // POOL 1: winners exist
    try {
      await program.methods
        .updateWinner(true)
        .accountsPartial({
          game: game1Pda,
          oracle: oracle.publicKey,
          escrowVault: escrow1Pda,
          feeReceiver: feeReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(
          winnersG1.map((pda) => ({
            pubkey: pda.publicKey,
            isWritable: true,
            isSigner: false,
          }))
        )
        .signers([oracle])
        .rpc({ commitment: "confirmed" });
    } catch (e) {
      console.log(e);
    }

    const updatedAcc = await program.account.bettorAccount.fetch(
      winnersG1[0].publicKey
    );
    console.log("Updated isWinner:", updatedAcc.isWinner);
    // Check fee transferred to feeReceiver
    const feeBal = await lamports(feeReceiver.publicKey);
    const expectedFee =
      (MAX_BETTORS * FIXED_STAKE_SOL * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
    console.log(
      "feeReciver account balance: ",
      feeBal,
      "and expectedFee is: ",
      expectedFee
    );
    assert.isAtLeast(feeBal, expectedFee, "Fee receiver got the platform fee");

    // POOL 2: no winners
    try {
      await program.methods
        .updateWinner(false)
        .accountsPartial({
          game: game2Pda,
          oracle: oracle.publicKey,
          escrowVault: escrow2Pda,
          feeReceiver: feeReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([oracle])
        .rpc();
    } catch (e) {
      console.log(e);
    }
  });

  it("12) Claim winners from pool 1", async () => {
    const payoutAmount =
      (MAX_BETTORS * FIXED_STAKE_SOL -
        (MAX_BETTORS * FIXED_STAKE_SOL * PLATFORM_FEE_BPS) / BPS_DENOMINATOR) /
      winnersG1.length;
    // console.log("payout amount: ", payoutAmount);

    for (const pda of winnersG1) {
      const before = await lamports(pda.account.bettor);

      const bettorKp = bettorsGame1.find(
        (b) => b.publicKey.toBase58() === pda.account.bettor.toBase58()
      )!;
      await program.methods
        .claimOrRefund()
        .accountsPartial({
          game: game1Pda,
          bettorAccount: pda.publicKey,
          bettor: pda.account.bettor,
          escrowVault: escrow1Pda,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettorKp])
        .rpc({ commitment: "confirmed" });

      const after = await lamports(pda.account.bettor);
      // console.log("\nbefore balance: ", before, "\nafter balance: ", after, "\nbalance difference should be equal to payout + account close rent: ", after - before)
      assert.isAtLeast(after - before, payoutAmount, "Winner got payout");
    }
  });

  it("13) Claim losers from pool 1 should fail", async () => {
    // Pick a random bettor from pool1 who is not a winner
    const allBettors = await program.account.bettorAccount.all([
      { memcmp: { offset: 8, bytes: game1Pda.toBase58() } },
    ]);
    const loserAcc = allBettors.find(
      (b) => !winnersG1.find((w) => w.publicKey.equals(b.publicKey))
    )!;
    const loserKp = bettorsGame1.find((b) =>
      b.publicKey.equals(loserAcc.account.bettor)
    )!;

    try {
      await program.methods
        .claimOrRefund()
        .accountsPartial({
          game: game1Pda,
          bettorAccount: loserAcc.publicKey,
          bettor: loserKp.publicKey,
          escrowVault: escrow1Pda,
          systemProgram: SystemProgram.programId,
        })
        .signers([loserKp])
        .rpc({ commitment: "confirmed" });
      assert.fail("Expected NotAWinner error");
    } catch (e) {
      expect(e).to.match(/NotAWinner/);
    }
  });

  it("14) Claim refunds from pool 2 (no winners)", async () => {
    const allBettors2 = await program.account.bettorAccount.all([
      { memcmp: { offset: 8, bytes: game2Pda.toBase58() } },
    ]);

    for (const acc of allBettors2) {
      const bettorKp = bettorsGame2.find((b) =>
        b.publicKey.equals(acc.account.bettor)
      )!;
      const before = await lamports(bettorKp.publicKey);

      await program.methods
        .claimOrRefund()
        .accountsPartial({
          game: game2Pda,
          bettorAccount: acc.publicKey,
          bettor: bettorKp.publicKey,
          escrowVault: escrow2Pda,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettorKp])
        .rpc({ commitment: "confirmed" });

      const after = await lamports(bettorKp.publicKey);
      assert.isAtLeast(after - before, FIXED_STAKE_SOL, "Refund correct");
    }
  });

  it("15) Double claim attempt should fail", async () => {
    const claimedAcc = winnersG1[0]; // already claimed above

    const claimedKp = bettorsGame1.find((b) =>
      b.publicKey.equals(claimedAcc.account.bettor)
    );

    try {
      await program.methods
        .claimOrRefund()
        .accountsPartial({
          game: game1Pda,
          bettorAccount: claimedAcc.publicKey,
          bettor: claimedAcc.account.bettor,
          escrowVault: escrow1Pda,
          systemProgram: SystemProgram.programId,
        })
        .signers([claimedKp])
        .rpc();
      assert.fail("Expected account not found or already closed");
    } catch (e) {
      expect(e.message).to.match(
        /The program expected this account to be already initialized/
      );
    }
  });
});
