import { Buffer } from "buffer";
import { Address } from '@stellar/stellar-sdk';
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from '@stellar/stellar-sdk/contract';
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  AssembledTransactionOptions,
  Option,
  Typepoint,
  Duration,
} from '@stellar/stellar-sdk/contract';
export * from '@stellar/stellar-sdk'
export * as contract from '@stellar/stellar-sdk/contract'
export * as rpc from '@stellar/stellar-sdk/rpc'

if (typeof window !== 'undefined') {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CB6XESIFAPPOSSV2NRIGQSV4K3NZTS6UBLUX6HN64FJZFXJFPBLGEQTD",
  }
} as const


export interface Order {
  amount: i128;
  customer: string;
  items: Array<string>;
  status: string;
}

export interface Client {
  /**
   * Construct and simulate a get_order transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_order: ({order_id}: {order_id: u32}, options?: AssembledTransactionOptions<Order>) => Promise<AssembledTransaction<Order>>

  /**
   * Construct and simulate a create_order transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_order: ({customer, token_address, amount, items}: {customer: string, token_address: string, amount: i128, items: Array<string>}, options?: AssembledTransactionOptions<u32>) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a fulfill_order transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  fulfill_order: ({waiter, order_id, token_address, cafe_owner}: {waiter: string, order_id: u32, token_address: string, cafe_owner: string}, options?: AssembledTransactionOptions<null>) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABU9yZGVyAAAAAAAABAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAhjdXN0b21lcgAAABMAAAAAAAAABWl0ZW1zAAAAAAAD6gAAABEAAAAAAAAABnN0YXR1cwAAAAAAEQ==",
        "AAAAAAAAAAAAAAAJZ2V0X29yZGVyAAAAAAAAAQAAAAAAAAAIb3JkZXJfaWQAAAAEAAAAAQAAB9AAAAAFT3JkZXIAAAA=",
        "AAAAAAAAAAAAAAAMY3JlYXRlX29yZGVyAAAABAAAAAAAAAAIY3VzdG9tZXIAAAATAAAAAAAAAA10b2tlbl9hZGRyZXNzAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAVpdGVtcwAAAAAAA+oAAAARAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAANZnVsZmlsbF9vcmRlcgAAAAAAAAQAAAAAAAAABndhaXRlcgAAAAAAEwAAAAAAAAAIb3JkZXJfaWQAAAAEAAAAAAAAAA10b2tlbl9hZGRyZXNzAAAAAAAAEwAAAAAAAAAKY2FmZV9vd25lcgAAAAAAEwAAAAA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_order: this.txFromJSON<Order>,
        create_order: this.txFromJSON<u32>,
        fulfill_order: this.txFromJSON<null>
  }
}