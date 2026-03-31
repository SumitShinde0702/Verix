// ─── Agent ────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  name: string;
  type: 'buyer' | 'worker';
}

export interface Agent {
  name: string;
  type: 'buyer' | 'worker';
  did: string;
  address: string;
  publicKey: string;
  seed: string;
  balanceDrops: string;
  createdAt: string;
}

// ─── DID ──────────────────────────────────────────────────────────────────────

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyHex: string;
}

export interface DIDDocument {
  '@context': string[];
  id: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export interface TaskDefinition {
  id: string;
  description: string;
  expectedSchema: Record<string, unknown>;
  rewardDrops: string;
  buyerDID: string;
  buyerAddress: string;
}

// ─── Escrow ───────────────────────────────────────────────────────────────────

export interface EscrowData {
  sequence: number;
  condition: string;
  fulfillment: string;
  rewardDrops: string;
  buyerAddress: string;
  workerAddress: string;
  txHash: string;
  taskId: string;
}

// ─── Verify & Settle ─────────────────────────────────────────────────────────

export interface VerifySettleInput {
  taskOutput: Record<string, unknown>;
  expectedSchema: Record<string, unknown>;
  escrowSequence: number;
  escrowCondition: string;
  escrowFulfillment: string;
  workerDID: string;
  workerSeed: string;
  buyerAddress: string;
  workerAddress: string;
}

export type VerifyFailStage = 'schema' | 'signature' | 'hash' | 'settlement';

export interface VerifySettleResult {
  verified: boolean;
  txHash?: string;
  reason?: string;
  failedAt?: VerifyFailStage;
  complianceScore?: number;
  auditUrl?: string;
}

// ─── Reputation ───────────────────────────────────────────────────────────────

export interface ReputationResult {
  did: string;
  address: string;
  score: number;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
}

// ─── On-chain Log ─────────────────────────────────────────────────────────────

export interface LogEntry {
  type: 'VERIFY_PASS' | 'VERIFY_FAIL' | 'ESCROW_CREATED' | 'ESCROW_FINISHED' | 'ESCROW_CANCELLED' | 'DID_REGISTERED';
  did: string;
  event: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// ─── Demo SSE Events ──────────────────────────────────────────────────────────

export type DemoStepId =
  | 'agents_created'
  | 'dids_registered'
  | 'ai_decision'
  | 'task_posted'
  | 'escrow_created'
  | 'api_called'
  | 'output_signed'
  | 'schema_validated'
  | 'sig_validated'
  | 'hash_validated'
  | 'escrow_finished'
  | 'audit_logged'
  | 'funds_protected';

export type DemoStepStatus = 'running' | 'completed' | 'failed';

export interface DemoEvent {
  step: DemoStepId;
  status: DemoStepStatus;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}
