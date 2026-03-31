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

export type FailAt = 'none' | 'schema' | 'signature';

export type DemoStepStatus = 'running' | 'completed' | 'failed';

export interface DemoEvent {
  step: DemoStepId;
  status: DemoStepStatus;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}
