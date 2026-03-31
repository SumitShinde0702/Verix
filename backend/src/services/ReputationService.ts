import { Client, Wallet, convertHexToString } from 'xrpl';
import type { ReputationResult } from '../types';

interface MemoEntry {
  Memo: {
    MemoType?: string;
    MemoData?: string;
  };
}

interface TxRecord {
  meta?: unknown;
  tx?: {
    Account?: string;
    Memos?: MemoEntry[];
    hash?: string;
  };
}

export interface ReputationAnchorMemo {
  txHash: string;
  subjectDid: string;
  outcome?: 'pass' | 'fail';
  credentialHash?: string;
  prevAnchorTxHash?: string;
  newScore?: number;
  failedReason?: string;
  timestamp?: string;
}

export class ReputationService {
  constructor(private client: Client) {}

  async getLatestReputationAnchor(
    account: string,
    subjectDid?: string
  ): Promise<ReputationAnchorMemo | null> {
    try {
      let marker: unknown = undefined;
      let fetched = 0;
      const maxTx = 300;

      do {
        const params: Record<string, unknown> = {
          command: 'account_tx',
          account,
          limit: 50,
          ledger_index_min: -1,
          ledger_index_max: -1,
        };
        if (marker) params.marker = marker;

        const result = await this.client.request(
          params as Parameters<typeof this.client.request>[0]
        );
        const res = result.result as { transactions: TxRecord[]; marker?: unknown };

        for (const record of res.transactions) {
          const memos = record.tx?.Memos;
          if (!memos || !record.tx?.hash) continue;
          for (const memoEntry of memos) {
            const typeHex = memoEntry.Memo?.MemoType;
            const dataHex = memoEntry.Memo?.MemoData;
            if (!typeHex || !dataHex) continue;
            const type = convertHexToString(typeHex);
            if (type !== 'verix/REPUTATION_ANCHOR') continue;
            const data = convertHexToString(dataHex);
            try {
              const parsed = JSON.parse(data) as {
                subjectDid?: string;
                outcome?: 'pass' | 'fail';
                credentialHash?: string;
                prevAnchorTxHash?: string;
                newScore?: number;
                failedReason?: string;
                timestamp?: string;
              };
              if (subjectDid && parsed.subjectDid !== subjectDid) continue;
              return {
                txHash: record.tx.hash,
                subjectDid: parsed.subjectDid ?? '',
                outcome: parsed.outcome,
                credentialHash: parsed.credentialHash,
                prevAnchorTxHash: parsed.prevAnchorTxHash,
                newScore: typeof parsed.newScore === 'number' ? parsed.newScore : undefined,
                failedReason: parsed.failedReason,
                timestamp: parsed.timestamp,
              };
            } catch {
              // ignore malformed memo payload
            }
          }
        }

        fetched += res.transactions.length;
        marker = res.marker;
      } while (marker && fetched < maxTx);
    } catch {
      return null;
    }

    return null;
  }

  /**
   * Score an agent by scanning their on-chain transaction history for Verix
   * audit memos.  Each VERIFY_PASS adds +1, VERIFY_FAIL adds -0.5 (floored at 0).
   *
   * Score is expressed as a 0–100 integer.
   */
  async getReputation(address: string): Promise<ReputationResult> {
    const did = `did:xrpl:1:${address}`;
    let successfulTasks = 0;
    let failedTasks = 0;

    try {
      let marker: unknown = undefined;
      let fetched = 0;
      const maxTx = 200;

      do {
        const params: Record<string, unknown> = {
          command: 'account_tx',
          account: address,
          limit: 50,
          ledger_index_min: -1,
          ledger_index_max: -1,
        };
        if (marker) params.marker = marker;

        const result = await this.client.request(
          params as Parameters<typeof this.client.request>[0]
        );

        const res = result.result as {
          transactions: TxRecord[];
          marker?: unknown;
        };

        for (const record of res.transactions) {
          const memos = record.tx?.Memos;
          if (!memos) continue;

          for (const memoEntry of memos) {
            const typeHex = memoEntry.Memo?.MemoType;
            const dataHex = memoEntry.Memo?.MemoData;
            if (!typeHex || !dataHex) continue;

            const type = convertHexToString(typeHex);
            if (!type.startsWith('verix/')) continue;

            const data = convertHexToString(dataHex);
            try {
              const parsed = JSON.parse(data) as { type?: string };
              if (parsed.type === 'VERIFY_PASS') successfulTasks++;
              if (parsed.type === 'VERIFY_FAIL') failedTasks++;
            } catch {
              // not a JSON memo — skip
            }
          }
        }

        fetched += res.transactions.length;
        marker = res.marker;
      } while (marker && fetched < maxTx);
    } catch {
      // account may have no history yet — return zeroed result
    }

    const totalTasks = successfulTasks + failedTasks;
    const rawScore =
      totalTasks === 0
        ? 50
        : Math.round((successfulTasks / totalTasks) * 100);
    const score = Math.max(0, Math.min(100, rawScore));

    return { did, address, score, totalTasks, successfulTasks, failedTasks };
  }

  /**
   * Write a Verix audit memo on-chain by sending a 1-drop payment to the
   * canonical sink address.  Memos are immutable once the ledger closes.
   */
  async writeMemo(
    wallet: { address: string; seed: string },
    memoType: string,
    memoData: Record<string, unknown>,
    xrplClient: Client
  ): Promise<string> {
    const signer = Wallet.fromSeed(wallet.seed);

    const prepared = await xrplClient.autofill({
      TransactionType: 'Payment',
      Account: signer.address,
      // XRPL canonical sink — 1 drop burn for memo anchoring
      Destination: 'rrrrrrrrrrrrrrrrrrrrBZbvji',
      Amount: '1',
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from(`verix/${memoType}`, 'utf8')
              .toString('hex')
              .toUpperCase(),
            MemoData: Buffer.from(JSON.stringify(memoData), 'utf8')
              .toString('hex')
              .toUpperCase(),
          },
        },
      ],
    });

    const { tx_blob } = signer.sign(prepared);
    const result = await xrplClient.submitAndWait(tx_blob);
    return result.result.hash ?? '';
  }
}
