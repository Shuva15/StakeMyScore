import * as anchor from "@coral-xyz/anchor";
import {
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

export async function airdrop(
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
  sol: number
) {
  await connection.confirmTransaction(
    await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL),
    "confirmed"
  );
}

export async function lamports(connection: anchor.web3.Connection, pubkey: PublicKey) {
  return connection.getBalance(pubkey, "confirmed");
}

export async function fundAccount(
  provider: anchor.AnchorProvider,
  to: PublicKey,
  sol: number
) {
  const tx = new anchor.web3.Transaction().add(
    SystemProgram.transfer({
      fromPubkey: provider.wallet.publicKey,
      toPubkey: to,
      lamports: sol * LAMPORTS_PER_SOL,
    })
  );
  await provider.sendAndConfirm(tx, [provider.wallet.payer]);
}

export async function confirm(
  connection: anchor.web3.Connection,
  signature: string
) {
  const block = await connection.getLatestBlockhash();

  await connection.confirmTransaction({
    signature,
    ...block,
  });

  return signature;
}

export async function log(
  connection: anchor.web3.Connection,
  signature: string,
) {
  console.log(
    `Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`
  );

  return signature;
}
