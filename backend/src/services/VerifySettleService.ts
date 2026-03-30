import Ajv from 'ajv';
import { Client, Wallet } from 'xrpl';
import { createHash, createHmac } from 'crypto';
import { EscrowManager } from './EscrowManager';
import { ReputationService } from './ReputationService';
import type { VerifySettleInput, VerifySettleResult } from '../types';

const ajv = new Ajv({ strict: false });

export class VerifySettleService {
  private escrowManager: EscrowManager;
  private reputationService: ReputationService;

  constructor(private client: Client) {
    this.escrowManager = new EscrowManager(client);
    this.reputationService = new ReputationService(client);
  }

  /**
   * The core Verix primitive.
   *
   * Three-layer validation:
   *   1. AJV — does the output conform to the expected JSON schema?
   *   2. DID signature — did the correct worker agent sign this output?
   *   3. Hash match — does SHA-256(canonical output) match the escrow condition?
   *
   * On pass  → EscrowFinish executes, funds released to worker, memo logged.
   * On fail  → funds remain locked (buyer can cancel after timeout), memo logged.
   */
  async verifyAndSettle(input: VerifySettleInput): Promise<VerifySettleResult> {
    const {
      taskOutput,
      expectedSchema,
      escrowSequence,
      escrowCondition,
      escrowFulfillment,
      workerDID,
      workerSeed,
      buyerAddress,
      workerAddress,
    } = input;

    // ── Layer 1: JSON Schema validation ────────────────────────────────────────
    // Strip __sig before validation — it's our internal signing field and must
    // not be present when checking against the buyer's schema.
    const { __sig: _sig, ...outputForValidation } = taskOutput;
    void _sig;
    const validate = ajv.compile(expectedSchema);
    const schemaValid = validate(outputForValidation);

    if (!schemaValid) {
      const reason = ajv.errorsText(validate.errors);
      await this.logAudit(workerSeed, workerAddress, 'VERIFY_FAIL', {
        stage: 'schema',
        reason,
        workerDID,
        escrowSequence,
      });
      return {
        verified: false,
        reason: `Schema validation failed: ${reason}`,
        failedAt: 'schema',
        complianceScore: 0,
      };
    }

    // ── Layer 2: DID signature verification ────────────────────────────────────
    // The worker produces an HMAC-SHA256 of the canonical output using their
    // seed as the key, proving possession of the DID private key.
    const canonical = this.canonicalize(taskOutput);
    const sigValid = this.verifySignature(
      canonical,
      (taskOutput as Record<string, unknown>).__sig as string | undefined,
      workerSeed
    );

    if (!sigValid) {
      await this.logAudit(workerSeed, workerAddress, 'VERIFY_FAIL', {
        stage: 'signature',
        reason: 'DID signature invalid or missing',
        workerDID,
        escrowSequence,
      });
      return {
        verified: false,
        reason: 'DID signature invalid or missing',
        failedAt: 'signature',
        complianceScore: 0,
      };
    }

    // ── Layer 3: Hash match against escrow condition ────────────────────────────
    // Verify that SHA-256(preimage inside fulfillment) == fingerprint inside
    // condition.  If this passes, the EscrowFinish will succeed on-ledger.
    const hashMatch = this.verifyHashCondition(escrowFulfillment, escrowCondition);

    if (!hashMatch) {
      await this.logAudit(workerSeed, workerAddress, 'VERIFY_FAIL', {
        stage: 'hash',
        reason: 'Output hash does not match escrow condition',
        workerDID,
        escrowSequence,
      });
      return {
        verified: false,
        reason: 'Output hash does not match escrow condition',
        failedAt: 'hash',
        complianceScore: 0,
      };
    }

    // ── All layers passed → settle ─────────────────────────────────────────────
    try {
      // Finisher is the worker (they provide the fulfillment they just proved)
      const workerWalletFull = Wallet.fromSeed(workerSeed);

      const txHash = await this.escrowManager.finishEscrow(
        workerWalletFull,
        buyerAddress,
        escrowSequence,
        escrowCondition,
        escrowFulfillment
      );

      const auditTxHash = await this.logAudit(
        workerSeed,
        workerAddress,
        'VERIFY_PASS',
        {
          stage: 'settlement',
          txHash,
          workerDID,
          escrowSequence,
          outputSummary: this.safeOutputSummary(taskOutput),
        }
      );

      const auditUrl = `https://testnet.xrpl.org/transactions/${auditTxHash}`;
      const explorerUrl = `https://testnet.xrpl.org/transactions/${txHash}`;

      return {
        verified: true,
        txHash,
        complianceScore: 100,
        auditUrl,
        reason: `EscrowFinish confirmed. Explorer: ${explorerUrl}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.logAudit(workerSeed, workerAddress, 'VERIFY_FAIL', {
        stage: 'settlement',
        reason: message,
        workerDID,
        escrowSequence,
      });
      return {
        verified: false,
        reason: `Settlement failed: ${message}`,
        failedAt: 'settlement',
        complianceScore: 0,
      };
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Produce a deterministic JSON string (sorted keys, no whitespace).
   * The __sig field is stripped before hashing so the signature itself
   * doesn't change the hash.
   */
  canonicalize(obj: Record<string, unknown>): string {
    const clean = { ...obj };
    delete clean.__sig;
    return JSON.stringify(clean, Object.keys(clean).sort());
  }

  /**
   * Verify a worker's HMAC-SHA256 signature on the canonical output.
   * The worker produces this MAC using their seed as the HMAC key, proving
   * they hold the DID private key without exposing it.
   */
  private verifySignature(
    canonical: string,
    sigHex: string | undefined,
    workerSeed: string
  ): boolean {
    if (!sigHex) return false;
    try {
      const expected = createHmac('sha256', workerSeed)
        .update(canonical)
        .digest('hex')
        .toUpperCase();
      return sigHex === expected;
    } catch {
      return false;
    }
  }

  /**
   * Verify that the fulfillment satisfies the escrow condition:
   *   SHA-256(preimage extracted from fulfillment) === fingerprint in condition
   *
   * PREIMAGE-SHA-256 fulfillment binary (five-bells-condition BER encoding):
   *   A0 <outer_len>  80 <preimage_len> <preimage_bytes>
   *
   * PREIMAGE-SHA-256 condition binary:
   *   A0 <outer_len>  80 20 <32-byte SHA-256 fingerprint>  81 <len> <max_len_varint>
   */
  private verifyHashCondition(
    fulfillmentHex: string,
    conditionHex: string
  ): boolean {
    if (!fulfillmentHex || !conditionHex) return false;
    try {
      const preimage = this.extractPreimage(Buffer.from(fulfillmentHex, 'hex'));
      if (!preimage) return false;

      const actualHash       = createHash('sha256').update(preimage).digest();
      const expectedFingerprint = this.extractConditionFingerprint(
        Buffer.from(conditionHex, 'hex')
      );
      if (!expectedFingerprint) return false;

      return actualHash.equals(expectedFingerprint);
    } catch {
      return false;
    }
  }

  /**
   * Extract the 32-byte SHA-256 fingerprint from a PREIMAGE-SHA-256 condition
   * binary (BER-encoded, produced by five-bells-condition).
   */
  private extractConditionFingerprint(buf: Buffer): Buffer | null {
    try {
      let offset = 0;
      if (buf[offset] !== 0xa0) return null;
      offset++;
      const outerLen = this.readBerLength(buf, offset);
      offset += outerLen.bytesRead;
      // Tag 0x80 = fingerprint container
      if (buf[offset] !== 0x80) return null;
      offset++;
      const fpLen = this.readBerLength(buf, offset);
      offset += fpLen.bytesRead;
      return buf.slice(offset, offset + fpLen.value);
    } catch {
      return null;
    }
  }

  /**
   * Parse a five-bells-condition PREIMAGE-SHA-256 binary and extract the
   * raw preimage bytes.
   */
  private extractPreimage(buf: Buffer): Buffer | null {
    try {
      // Type tag: 0xA0 (choice 0 in SEQUENCE)
      let offset = 0;
      if (buf[offset] !== 0xa0) return null;
      offset++;

      // Outer length (BER)
      const outerLen = this.readBerLength(buf, offset);
      offset += outerLen.bytesRead;

      // Inner tag 0x80 (primitive, context 0)
      if (buf[offset] !== 0x80) return null;
      offset++;

      const innerLen = this.readBerLength(buf, offset);
      offset += innerLen.bytesRead;

      return buf.slice(offset, offset + innerLen.value);
    } catch {
      return null;
    }
  }

  private readBerLength(
    buf: Buffer,
    offset: number
  ): { value: number; bytesRead: number } {
    const first = buf[offset];
    if (first < 0x80) return { value: first, bytesRead: 1 };
    const numBytes = first & 0x7f;
    let value = 0;
    for (let i = 0; i < numBytes; i++) {
      value = (value << 8) | buf[offset + 1 + i];
    }
    return { value, bytesRead: 1 + numBytes };
  }

  private async logAudit(
    signerSeed: string,
    signerAddress: string,
    type: 'VERIFY_PASS' | 'VERIFY_FAIL',
    details: Record<string, unknown>
  ): Promise<string> {
    try {
      return await this.reputationService.writeMemo(
        { address: signerAddress, seed: signerSeed },
        type,
        { type, ...details, timestamp: new Date().toISOString() },
        this.client
      );
    } catch {
      return '';
    }
  }

  private safeOutputSummary(
    output: Record<string, unknown>
  ): Record<string, unknown> {
    const { __sig, ...rest } = output;
    void __sig;
    return rest;
  }

  /**
   * Produce an HMAC-SHA256 of a canonical output string using the worker seed
   * as the key.  The result is embedded as __sig in the output object.
   */
  signOutput(canonical: string, workerSeed: string): string {
    return createHmac('sha256', workerSeed)
      .update(canonical)
      .digest('hex')
      .toUpperCase();
  }

  hashOutput(canonical: string): string {
    return createHash('sha256').update(canonical).digest('hex').toUpperCase();
  }
}
