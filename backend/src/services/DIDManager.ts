import { Client, Wallet, convertStringToHex } from 'xrpl';
import type { Agent, AgentConfig, DIDDocument } from '../types';

export class DIDManager {
  constructor(private client: Client) {}

  /**
   * Generate a fresh wallet, fund it from the testnet faucet, and register an
   * XLS-40 DID on-chain in a single call.
   */
  async createAndFundAgent(config: AgentConfig): Promise<Agent> {
    // fundWallet(null) generates a new Ed25519 wallet and hits the testnet faucet
    const { wallet, balance } = await this.client.fundWallet(null as unknown as Wallet);

    const did = await this.registerDID(wallet);

    return {
      name: config.name,
      type: config.type,
      did,
      address: wallet.address,
      publicKey: wallet.publicKey,
      seed: wallet.seed!,
      balanceDrops: String(Math.floor(balance * 1_000_000)),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Write a DIDSet transaction for the wallet, anchoring its public key on-chain
   * as an XLS-40 DID.
   *
   * XRPL enforces a hard 256-byte limit on the DIDDocument, URI, and Data fields.
   * We use a minimal JSON document (well under 256 bytes) for DIDDocument and
   * store the raw public key bytes in Data so it can be resolved later.
   */
  async registerDID(wallet: Wallet): Promise<string> {
    const did = `did:xrpl:1:${wallet.address}`;

    // Minimal W3C DID document — stays well under the 256-byte ledger limit
    const minimalDoc = {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: did,
    };

    const prepared = await this.client.autofill({
      TransactionType: 'DIDSet',
      Account: wallet.address,
      // JSON string → hex (each char = 1 byte; total ~90 bytes for a 34-char address)
      DIDDocument: convertStringToHex(JSON.stringify(minimalDoc)),
      // Public key is already hex; pass directly so it's stored as raw bytes (~33 bytes)
      Data: wallet.publicKey,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { tx_blob } = wallet.sign(prepared);
    const result = await this.client.submitAndWait(tx_blob);

    const txResult = (result.result.meta as unknown as Record<string, unknown>)
      ?.TransactionResult as string | undefined;

    if (txResult !== 'tesSUCCESS') {
      throw new Error(`DID registration failed: ${txResult ?? 'unknown error'}`);
    }

    return did;
  }

  /**
   * Resolve the DID stored on-chain for a given XRPL address.
   * Returns a reconstructed DIDDocument including the public key from the Data field.
   */
  async resolveDID(address: string): Promise<DIDDocument | null> {
    try {
      const result = await this.client.request({
        command: 'account_objects',
        account: address,
        type: 'did',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const objects = (result.result as Record<string, unknown>)
        .account_objects as Array<Record<string, unknown>> | undefined;

      const didObj = objects?.[0];
      if (!didObj) return null;

      const did = `did:xrpl:1:${address}`;

      // Reconstruct the full DID document from on-chain fields
      const doc: DIDDocument = {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: did,
        verificationMethod: [],
        authentication: [],
      };

      // If DIDDocument field exists, parse it
      if (didObj.DIDDocument) {
        try {
          const parsed = JSON.parse(
            Buffer.from(didObj.DIDDocument as string, 'hex').toString('utf8')
          ) as Partial<DIDDocument>;
          Object.assign(doc, parsed);
        } catch { /* use defaults */ }
      }

      // If Data field exists it's the public key hex
      if (didObj.Data) {
        const pubKeyHex = (didObj.Data as string).toUpperCase();
        doc.verificationMethod = [{
          id: `${did}#keys-1`,
          type: 'Ed25519VerificationKey2020',
          controller: did,
          publicKeyHex: pubKeyHex,
        }];
        doc.authentication = [`${did}#keys-1`];
      }

      return doc;
    } catch {
      return null;
    }
  }

  /**
   * Return an XRP balance in drops for any XRPL address.
   */
  async getBalanceDrops(address: string): Promise<string> {
    try {
      const result = await this.client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'current',
      });
      return result.result.account_data.Balance;
    } catch {
      return '0';
    }
  }

  getWalletFromSeed(seed: string): Wallet {
    return Wallet.fromSeed(seed);
  }
}
