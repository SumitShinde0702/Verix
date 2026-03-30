import { Client, Wallet, dropsToXrp } from 'xrpl';
// five-bells-condition ships CommonJS with no bundled types; we require it at
// runtime and add a minimal ambient declaration in types.ts so TS stays happy.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cc = require('five-bells-condition') as FiveBellsCondition;

import type { EscrowData } from '../types';

// ─── Minimal five-bells-condition surface we actually use ────────────────────
interface PreimageSha256Instance {
  setPreimage(buf: Buffer): void;
  getConditionBinary(): Buffer;
  serializeBinary(): Buffer;
}
interface FiveBellsCondition {
  PreimageSha256: new () => PreimageSha256Instance;
}
// ─────────────────────────────────────────────────────────────────────────────

export interface CryptoConditionPair {
  /** Hex-encoded condition to store on-chain in EscrowCreate */
  conditionHex: string;
  /** Hex-encoded fulfillment to provide in EscrowFinish */
  fulfillmentHex: string;
  /** The raw preimage used — keep this to verify later */
  preimage: string;
}

export class EscrowManager {
  constructor(private client: Client) {}

  /**
   * Derive a PREIMAGE-SHA-256 crypto-condition pair from a canonical schema
   * string.  The schema JSON is the preimage; its SHA-256 hash is the condition.
   *
   * Buyer commits to this condition when posting the task.  Verix holds the
   * fulfillment and releases it only after successful output validation.
   */
  buildCryptoCondition(canonicalSchema: string): CryptoConditionPair {
    const fulfillment = new cc.PreimageSha256();
    fulfillment.setPreimage(Buffer.from(canonicalSchema, 'utf8'));

    const conditionHex = fulfillment
      .getConditionBinary()
      .toString('hex')
      .toUpperCase();

    const fulfillmentHex = fulfillment
      .serializeBinary()
      .toString('hex')
      .toUpperCase();

    return { conditionHex, fulfillmentHex, preimage: canonicalSchema };
  }

  /**
   * Lock `rewardDrops` XRP in a native XRPL escrow.
   * The escrow releases only when the correct fulfillment is provided (or
   * it can be cancelled after `cancelAfterSeconds`).
   */
  async createEscrow(
    buyerWallet: Wallet,
    workerAddress: string,
    rewardDrops: string,
    conditionHex: string,
    taskId: string,
    cancelAfterSeconds = 3600
  ): Promise<EscrowData> {
    const cancelAfter = Math.floor(Date.now() / 1000) + cancelAfterSeconds;
    // XRPL uses Ripple Epoch: seconds since 1 Jan 2000
    const rippleEpochOffset = 946684800;
    const cancelAfterRipple = cancelAfter - rippleEpochOffset;

    const prepared = await this.client.autofill({
      TransactionType: 'EscrowCreate',
      Account: buyerWallet.address,
      Destination: workerAddress,
      Amount: rewardDrops,
      Condition: conditionHex,
      CancelAfter: cancelAfterRipple,
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('verix/task-id', 'utf8')
              .toString('hex')
              .toUpperCase(),
            MemoData: Buffer.from(taskId, 'utf8')
              .toString('hex')
              .toUpperCase(),
          },
        },
      ],
    });

    const { tx_blob } = buyerWallet.sign(prepared);
    const result = await this.client.submitAndWait(tx_blob);

    const txResult = (result.result.meta as unknown as Record<string, unknown>)
      ?.TransactionResult as string | undefined;

    if (txResult !== 'tesSUCCESS') {
      throw new Error(`EscrowCreate failed: ${txResult ?? 'unknown'}`);
    }

    const sequence = (result.result.tx_json as unknown as Record<string, unknown>)
      ?.Sequence as number;

    return {
      sequence,
      condition: conditionHex,
      fulfillment: '',
      rewardDrops,
      buyerAddress: buyerWallet.address,
      workerAddress,
      txHash: String(result.result.hash ?? ''),
      taskId,
    };
  }

  /**
   * Finish (release) the escrow by providing the fulfillment.
   * Returns the EscrowFinish transaction hash.
   */
  async finishEscrow(
    finisherWallet: Wallet,
    ownerAddress: string,
    escrowSequence: number,
    conditionHex: string,
    fulfillmentHex: string
  ): Promise<string> {
    const prepared = await this.client.autofill({
      TransactionType: 'EscrowFinish',
      Account: finisherWallet.address,
      Owner: ownerAddress,
      OfferSequence: escrowSequence,
      Condition: conditionHex,
      Fulfillment: fulfillmentHex,
    });

    const { tx_blob } = finisherWallet.sign(prepared);
    const result = await this.client.submitAndWait(tx_blob);

    const txResult = (result.result.meta as unknown as Record<string, unknown>)
      ?.TransactionResult as string | undefined;

    if (txResult !== 'tesSUCCESS') {
      throw new Error(`EscrowFinish failed: ${txResult ?? 'unknown'}`);
    }

    return String(result.result.hash ?? '');
  }

  /**
   * Cancel (return funds to buyer) the escrow after the CancelAfter time has
   * elapsed.
   */
  async cancelEscrow(
    cancellerWallet: Wallet,
    ownerAddress: string,
    escrowSequence: number
  ): Promise<string> {
    const prepared = await this.client.autofill({
      TransactionType: 'EscrowCancel',
      Account: cancellerWallet.address,
      Owner: ownerAddress,
      OfferSequence: escrowSequence,
    });

    const { tx_blob } = cancellerWallet.sign(prepared);
    const result = await this.client.submitAndWait(tx_blob);

    const txResult = (result.result.meta as unknown as Record<string, unknown>)
      ?.TransactionResult as string | undefined;

    if (txResult !== 'tesSUCCESS') {
      throw new Error(`EscrowCancel failed: ${txResult ?? 'unknown'}`);
    }

    return String(result.result.hash ?? '');
  }

  dropsToXrp(drops: string): string {
    return String(dropsToXrp(drops));
  }
}
