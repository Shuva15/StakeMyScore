import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  SystemProgram,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { assert } from "chai";
import { StakeMyScore } from "../target/types/stake_my_score";
import oracle_wallet from "../oracle-wallet.json";
import feeReceiver_wallet from "../feereceiver-wallet.json";
import * as helpers from "./helpers";

const GAME_SEED = Buffer.from("game");
const ESCROW_SEED = Buffer.from("escrow");
const BETTOR_SEED = Buffer.from("bettor");

// Constents
const FIXED_STAKE_SOL = 1 * LAMPORTS_PER_SOL;
const NUM_BETTORS = 10; // devnet small test
const PLATFORM_FEE_BPS = 300;
const BPS_DENOMINATOR = 10_000;

// A tone down version of the tests to intract with the instrutions in devnet
// To run tests without a lot devnet sol consumption
describe("stake_my_score devnet test", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.StakeMyScore as Program<StakeMyScore>;

  const payer = provider.wallet.publicKey;
  const oracle = Keypair.fromSecretKey(new Uint8Array(oracle_wallet));
  const feeReceiver = Keypair.fromSecretKey(new Uint8Array(feeReceiver_wallet));

  const matchId = `AUSvPAK_${Date.now()}`;
  const poolIndex = 0;

  let gamePda: PublicKey, escrowPda: PublicKey;
  const bettors: Keypair[] = [];
  let winners: anchor.ProgramAccount<{
    game: anchor.web3.PublicKey;
    bettor: anchor.web3.PublicKey;
    runsPredicted: number;
    wicketsPredicted: number;
    isWinner: boolean;
    bump: number;
  }>[] = [];

  it("1) Initialize pool", async () => {
    [gamePda] = PublicKey.findProgramAddressSync(
      [
        GAME_SEED,
        Buffer.from(matchId),
        new anchor.BN(poolIndex).toArrayLike(Buffer, "le", 2),
      ],
      program.programId
    );
    [escrowPda] = PublicKey.findProgramAddressSync(
      [ESCROW_SEED, gamePda.toBuffer()],
      program.programId
    );

    await program.methods
      .initializePool(matchId, poolIndex)
      .accountsPartial({
        game: gamePda,
        oracle: oracle.publicKey,
        escrowVault: escrowPda,
        payer,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
      .then((signature) => helpers.confirm(provider.connection, signature))
      .then((signature) => helpers.log(provider.connection, signature));
    console.log();
  });

  it(`2) Add ${NUM_BETTORS} bettors`, async () => {
    for (let i = 0; i < NUM_BETTORS; i++) {
      const bettor = Keypair.generate();
      bettors.push(bettor);

      await helpers.fundAccount(provider, bettor.publicKey, 1.3); // 1 SOL stake + rent

      const [bettorPda] = PublicKey.findProgramAddressSync(
        [BETTOR_SEED, gamePda.toBuffer(), bettor.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .placePrediction(i % 4, i % 4)
        .accountsPartial({
          game: gamePda,
          bettorAccount: bettorPda,
          escrowVault: escrowPda,
          bettor: bettor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor])
        .rpc({ commitment: "confirmed" })
        .then((signature) => helpers.confirm(provider.connection, signature))
    }

    console.log(
      "Escrow balance after bets:",
      await helpers.lamports(provider.connection, escrowPda)
    );
  });

  it("3) Lock pool", async () => {
    await program.methods
      .lockPool()
      .accountsPartial({
        game: gamePda,
        oracle: oracle.publicKey,
      })
      .signers([oracle])
      .rpc()
      .then((signature) => helpers.confirm(provider.connection, signature))
      .then((signature) => helpers.log(provider.connection, signature));
  });

  it("4) Submit result & find winners", async () => {
    const finalRuns = 2;
    const finalWickets = 2;

    await program.methods
      .submitResult(finalRuns, finalWickets)
      .accountsPartial({
        game: gamePda,
        oracle: oracle.publicKey,
      })
      .signers([oracle])
      .rpc()
      .then((signature) => helpers.confirm(provider.connection, signature))
      .then((signature) => helpers.log(provider.connection, signature));

    const allBettors = await program.account.bettorAccount.all([
      { memcmp: { offset: 8, bytes: gamePda.toBase58() } },
    ]);

    winners = allBettors.filter(
      (acc) =>
        acc.account.runsPredicted === finalRuns &&
        acc.account.wicketsPredicted === finalWickets
    );

    console.log(`Found ${winners.length} winners`);
    assert.isAbove(winners.length, 0, "Expected some winners");
  });

  it("5) Update winners", async () => {
    await program.methods
      .updateWinner(true)
      .accountsPartial({
        game: gamePda,
        oracle: oracle.publicKey,
        escrowVault: escrowPda,
        feeReceiver: feeReceiver.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(
        winners.map((pda) => ({
          pubkey: pda.publicKey,
          isWritable: true,
          isSigner: false,
        }))
      )
      .signers([oracle])
      .rpc({ commitment: "confirmed" });

    console.log(
      "Fee receiver balance:",
      await helpers.lamports(provider.connection, feeReceiver.publicKey)
    );
  });

  it("6) Claim payouts", async () => {
    const payoutAmount =
      (NUM_BETTORS * FIXED_STAKE_SOL -
        (NUM_BETTORS * FIXED_STAKE_SOL * PLATFORM_FEE_BPS) / BPS_DENOMINATOR) /
      winners.length;

    for (const w of winners) {
      const kp = bettors.find((b) => b.publicKey.equals(w.account.bettor))!;
      const before = await helpers.lamports(provider.connection, kp.publicKey);

      await program.methods
        .claimOrRefund()
        .accountsPartial({
          game: gamePda,
          bettorAccount: w.publicKey,
          bettor: kp.publicKey,
          escrowVault: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([kp])
        .rpc({ commitment: "confirmed" })
        .then((signature) => helpers.confirm(provider.connection, signature))
        .then((signature) => helpers.log(provider.connection, signature));

      const after = await helpers.lamports(provider.connection, kp.publicKey);
      assert.isAtLeast(after - before, payoutAmount, "Winner got payout");
    }
  });
});
