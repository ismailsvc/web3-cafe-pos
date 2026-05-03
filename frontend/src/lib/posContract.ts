import {
  Contract,
  TransactionBuilder,
  nativeToScVal,
  Address,
  xdr,
  rpc as StellarRpc,
  Account,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { config } from "./stellar";
import albedo from "@albedo-link/intent";

// ─── Contract addresses ────────────────────────────────────────────────────────
export const CAFE_OWNER =
  "GDSPUJG45447VF2YSW6SIEYHZVPBCVQVBXO2BS3ESA5MHPCXUJHBAFDA";

export const CONTRACT_ID =
  "CCDRWVJTAIOB7TADJEE6XYG2EZSH3CLE35AN5BWEVVAANRNGDXY53VXK";

export const NATIVE_TOKEN =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const sorobanRpc = new StellarRpc.Server(config.rpcUrl, { allowHttp: false });

/**
 * createOrder — Locks XLM in the smart contract escrow (Soroban SDK v14)
 * Returns the tx hash. Backend resolves contract orderId from the hash.
 */
export const createOrder = async (
  customerAddress: string,
  amountXlm: string,
  tableId: string
): Promise<string> => {
  const amountStroops = BigInt(Math.round(parseFloat(amountXlm) * 10_000_000));
  const contract = new Contract(CONTRACT_ID);

  const args = [
    new Address(customerAddress).toScVal(),
    new Address(NATIVE_TOKEN).toScVal(),
    nativeToScVal(amountStroops, { type: "i128" }),
    xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(`Masa${tableId}`)]),
  ];

  // Use Horizon to get account (more stable than Soroban RPC for account loading)
  const horizonRes = await fetch(
    `https://horizon-testnet.stellar.org/accounts/${customerAddress}`
  );
  if (!horizonRes.ok) throw new Error("Hesap bulunamadı. Testnet bakiyeniz var mı?");
  const horizonAccount = await horizonRes.json();

  const account = new Account(customerAddress, horizonAccount.sequence);

  const tx = new TransactionBuilder(account, {
    fee: "1000000", // 0.1 XLM max fee for Soroban
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call("create_order", ...args))
    .setTimeout(300)
    .build();

  // Simulate & prepare using SDK v14 (handles auth entries correctly)
  const sim = await sorobanRpc.simulateTransaction(tx);
  if (StellarRpc.Api.isSimulationError(sim)) {
    throw new Error("Simülasyon hatası: " + sim.error);
  }

  const prepared = StellarRpc.assembleTransaction(tx, sim).build();

  // Sign with Freighter
  const signResult = await signTransaction(prepared.toXDR(), {
    networkPassphrase: config.networkPassphrase,
  });

  if (signResult.error) {
    const msg =
      typeof signResult.error === "string"
        ? signResult.error
        : (signResult.error as any)?.message ?? "Freighter imzalama başarısız";
    throw new Error(msg);
  }

  // Send via raw fetch (avoids SDK fromXDR union switch issue)
  const sendRes = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: Date.now(),
      method: "sendTransaction",
      params: { transaction: signResult.signedTxXdr },
    }),
  });
  const sendData = await sendRes.json();
  if (sendData.error) throw new Error("RPC hatası: " + JSON.stringify(sendData.error));
  if (sendData.result?.status === "ERROR") {
    throw new Error("Ödeme reddedildi. Bakiyenizi kontrol edin.");
  }

  const txHash = sendData.result.hash;

  // Poll for confirmation
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(config.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "getTransaction", params: { hash: txHash } }),
    });
    const pollData = await poll.json();
    const status = pollData.result?.status;
    if (status === "SUCCESS") break;
    if (status === "FAILED") throw new Error("İşlem başarısız oldu. Tekrar deneyin.");
  }

  return txHash;
};

/**
 * albedoPayOrder — Mobile payment via Albedo (Direct Payment, no escrow)
 */
export const albedoPayOrder = async (
  amountXlm: string,
  tableId: string
): Promise<string> => {
  const result = await albedo.pay({
    amount: parseFloat(amountXlm).toFixed(7),
    destination: CAFE_OWNER,
    network: "testnet",
    memo: `Masa${tableId}`,
    submit: true,
  });
  return result.tx_hash;
};
