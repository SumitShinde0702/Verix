import { promises as fs } from 'fs';
import path from 'path';

export interface StoredAgent {
  name: string;
  type: 'buyer' | 'worker';
  did: string;
  address: string;
  publicKey: string;
  seed: string;
  createdAt: string;
}

export interface ReputationEntry {
  timestamp: string;
  outcome: 'pass' | 'fail';
  delta: number;
  before: number;
  after: number;
  credentialHash?: string;
  credentialTxHash?: string;
  credentialUrl?: string;
  auditUrl?: string;
  escrowCreateTx?: string;
  escrowFinishTx?: string;
  failedAt?: string;
  failedReason?: string;
}

interface DemoState {
  agents?: {
    buyer?: StoredAgent;
    worker?: StoredAgent;
  };
  reputationByDid: Record<string, ReputationEntry[]>;
}

const EMPTY_STATE: DemoState = {
  agents: {},
  reputationByDid: {},
};

export class DemoStateStore {
  constructor(private filePath: string) {}

  async getAgents(): Promise<{ buyer?: StoredAgent; worker?: StoredAgent }> {
    const state = await this.readState();
    return state.agents ?? {};
  }

  async saveAgents(agents: { buyer: StoredAgent; worker: StoredAgent }): Promise<void> {
    const state = await this.readState();
    state.agents = agents;
    await this.writeState(state);
  }

  async getHistory(did: string): Promise<ReputationEntry[]> {
    const state = await this.readState();
    return state.reputationByDid[did] ?? [];
  }

  async appendHistory(
    did: string,
    payload: Omit<ReputationEntry, 'before' | 'after' | 'delta'>
  ): Promise<{ before: number; after: number; delta: number; history: ReputationEntry[] }> {
    const state = await this.readState();
    const history = state.reputationByDid[did] ?? [];
    const before = history.length > 0 ? history[history.length - 1].after : 50;
    const delta = payload.outcome === 'pass' ? 10 : -10;
    const after = Math.max(0, Math.min(100, before + delta));
    const entry: ReputationEntry = { ...payload, before, after, delta };
    const next = [...history, entry];
    state.reputationByDid[did] = next;
    await this.writeState(state);
    return { before, after, delta, history: next };
  }

  async appendHistoryEntry(did: string, entry: ReputationEntry): Promise<void> {
    const state = await this.readState();
    const history = state.reputationByDid[did] ?? [];
    state.reputationByDid[did] = [...history, entry];
    await this.writeState(state);
  }

  private async readState(): Promise<DemoState> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DemoState>;
      return {
        agents: parsed.agents ?? {},
        reputationByDid: parsed.reputationByDid ?? {},
      };
    } catch {
      return { ...EMPTY_STATE };
    }
  }

  private async writeState(state: DemoState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf8');
  }
}

