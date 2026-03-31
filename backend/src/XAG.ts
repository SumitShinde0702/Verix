import { Client, Wallet, xrpToDrops } from 'xrpl';
import { DIDManager } from './services/DIDManager';
import { EscrowManager } from './services/EscrowManager';
import { ReputationService } from './services/ReputationService';
import { VerifySettleService } from './services/VerifySettleService';
import type { ReputationAnchorMemo } from './services/ReputationService';
import type {
  Agent,
  AgentConfig,
  DIDDocument,
  EscrowData,
  ReputationResult,
  TaskDefinition,
  VerifySettleInput,
  VerifySettleResult,
} from './types';

export interface XAGConfig {
  xrplNode: string;
}

/**
 * X-Agent Gateway — the single entry point for all Verix operations.
 *
 * Initialise once, call connect(), then use the public methods.
 */
export class XAG {
  private client: Client;
  private didManager!: DIDManager;
  private escrowManager!: EscrowManager;
  private reputationService!: ReputationService;
  private verifySettleService!: VerifySettleService;

  constructor(private config: XAGConfig) {
    this.client = new Client(config.xrplNode);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.didManager = new DIDManager(this.client);
    this.escrowManager = new EscrowManager(this.client);
    this.reputationService = new ReputationService(this.client);
    this.verifySettleService = new VerifySettleService(this.client);
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }

  // ─── Identity ───────────────────────────────────────────────────────────────

  async createAgent(config: AgentConfig): Promise<Agent> {
    return this.didManager.createAndFundAgent(config);
  }

  async resolveDID(address: string): Promise<DIDDocument | null> {
    return this.didManager.resolveDID(address);
  }

  // ─── Task & Escrow ──────────────────────────────────────────────────────────

  /**
   * Post a task: build a crypto condition from the expected schema and lock
   * the reward in an XRPL escrow.  Returns the escrow data including the
   * fulfillment hex (held by Verix, never sent to the worker).
   */
  async postTask(
    buyerSeed: string,
    task: Omit<TaskDefinition, 'buyerAddress' | 'buyerDID'>
  ): Promise<{ task: TaskDefinition; escrow: EscrowData }> {
    const buyerWallet = Wallet.fromSeed(buyerSeed);

    const taskDef: TaskDefinition = {
      ...task,
      buyerAddress: buyerWallet.address,
      buyerDID: `did:xrpl:1:${buyerWallet.address}`,
    };

    // Canonical schema is the preimage for the PREIMAGE-SHA-256 condition
    const canonicalSchema = JSON.stringify(
      task.expectedSchema,
      Object.keys(task.expectedSchema).sort()
    );

    const { conditionHex, fulfillmentHex } =
      this.escrowManager.buildCryptoCondition(canonicalSchema);

    const escrow = await this.escrowManager.createEscrow(
      buyerWallet,
      task.rewardDrops.startsWith('did')
        ? task.rewardDrops
        : task.rewardDrops,
      task.rewardDrops,
      conditionHex,
      task.id
    );

    escrow.fulfillment = fulfillmentHex;

    return { task: taskDef, escrow };
  }

  /**
   * Post a task with a known worker address (used in the demo flow).
   */
  async postTaskForWorker(
    buyerSeed: string,
    workerAddress: string,
    task: Omit<TaskDefinition, 'buyerAddress' | 'buyerDID'>
  ): Promise<{ task: TaskDefinition; escrow: EscrowData }> {
    const buyerWallet = Wallet.fromSeed(buyerSeed);

    const taskDef: TaskDefinition = {
      ...task,
      buyerAddress: buyerWallet.address,
      buyerDID: `did:xrpl:1:${buyerWallet.address}`,
    };

    const canonicalSchema = JSON.stringify(
      task.expectedSchema,
      Object.keys(task.expectedSchema).sort()
    );

    const { conditionHex, fulfillmentHex } =
      this.escrowManager.buildCryptoCondition(canonicalSchema);

    const escrow = await this.escrowManager.createEscrow(
      buyerWallet,
      workerAddress,
      task.rewardDrops,
      conditionHex,
      task.id
    );

    escrow.fulfillment = fulfillmentHex;

    return { task: taskDef, escrow };
  }

  // ─── Verify & Settle ────────────────────────────────────────────────────────

  async verifyAndSettle(input: VerifySettleInput): Promise<VerifySettleResult> {
    return this.verifySettleService.verifyAndSettle(input);
  }

  signOutput(output: Record<string, unknown>, workerSeed: string): string {
    const canonical = this.verifySettleService.canonicalize(output);
    return this.verifySettleService.signOutput(canonical, workerSeed);
  }

  // ─── Reputation ─────────────────────────────────────────────────────────────

  async getReputation(address: string): Promise<ReputationResult> {
    return this.reputationService.getReputation(address);
  }

  async anchorReputationHash(
    signer: { address: string; seed: string },
    payload: Record<string, unknown>
  ): Promise<string> {
    return this.reputationService.writeMemo(
      signer,
      'REPUTATION_ANCHOR',
      payload,
      this.client
    );
  }

  async getLatestReputationAnchor(
    account: string,
    subjectDid?: string
  ): Promise<ReputationAnchorMemo | null> {
    return this.reputationService.getLatestReputationAnchor(account, subjectDid);
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  xrpToDrops(xrp: string): string {
    return xrpToDrops(xrp);
  }

  dropsToXrp(drops: string): string {
    return this.escrowManager.dropsToXrp(drops);
  }

  getWalletFromSeed(seed: string): Wallet {
    return Wallet.fromSeed(seed);
  }

  async getBalance(address: string): Promise<string> {
    return this.didManager.getBalanceDrops(address);
  }
}
