import { createHash } from 'crypto';

export interface ReputationCredentialInput {
  subjectDid: string;
  issuerDid: string;
  outcome: 'pass' | 'fail';
  before: number;
  after: number;
  delta: number;
  failedAt?: string;
  failedReason?: string;
  escrowCreateTx?: string;
  escrowFinishTx?: string;
  auditUrl?: string;
}

export interface ReputationCredential {
  type: 'verix.reputation.credential.v1';
  subjectDid: string;
  issuerDid: string;
  outcome: 'pass' | 'fail';
  score: {
    before: number;
    after: number;
    delta: number;
  };
  evidence: {
    escrowCreateTx?: string;
    escrowFinishTx?: string;
    auditUrl?: string;
    failedAt?: string;
    failedReason?: string;
  };
  issuedAt: string;
}

export function buildReputationCredential(
  input: ReputationCredentialInput
): ReputationCredential {
  return {
    type: 'verix.reputation.credential.v1',
    subjectDid: input.subjectDid,
    issuerDid: input.issuerDid,
    outcome: input.outcome,
    score: {
      before: input.before,
      after: input.after,
      delta: input.delta,
    },
    evidence: {
      escrowCreateTx: input.escrowCreateTx,
      escrowFinishTx: input.escrowFinishTx,
      auditUrl: input.auditUrl,
      failedAt: input.failedAt,
      failedReason: input.failedReason,
    },
    issuedAt: new Date().toISOString(),
  };
}

export function hashCredential(credential: ReputationCredential): string {
  const canonical = JSON.stringify(credential, Object.keys(credential).sort());
  return createHash('sha256').update(canonical).digest('hex').toUpperCase();
}

