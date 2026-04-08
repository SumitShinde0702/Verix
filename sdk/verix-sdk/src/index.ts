export type FailAt = 'none' | 'schema' | 'signature';

export interface DemoRunEvent {
  step: string;
  status: 'running' | 'completed' | 'failed';
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface ReputationHistoryResponse {
  success: boolean;
  did: string;
  currentScore: number;
  runs: number;
  history: Array<Record<string, unknown>>;
}

export class VerixClient {
  constructor(private baseUrl: string) {}

  streamDemo(params: {
    query: string;
    failAt?: FailAt;
    onEvent: (event: DemoRunEvent) => void;
    onDone?: () => void;
    onError?: (error: Event) => void;
  }): EventSource {
    const failAt = params.failAt ?? 'none';
    const url =
      `${this.baseUrl}/api/demo/run` +
      `?query=${encodeURIComponent(params.query)}` +
      `&failAt=${failAt}`;
    const source = new EventSource(url);
    source.onmessage = (msg) => {
      if (msg.data === '[DONE]') {
        params.onDone?.();
        source.close();
        return;
      }
      try {
        params.onEvent(JSON.parse(msg.data) as DemoRunEvent);
      } catch {
        // ignore malformed events
      }
    };
    source.onerror = (err) => {
      params.onError?.(err);
      source.close();
    };
    return source;
  }

  async getReputationHistoryByDid(did: string): Promise<ReputationHistoryResponse> {
    const resp = await fetch(
      `${this.baseUrl}/api/reputation-history?did=${encodeURIComponent(did)}`
    );
    if (!resp.ok) {
      throw new Error(`Failed to fetch reputation history: ${resp.status}`);
    }
    return (await resp.json()) as ReputationHistoryResponse;
  }
}

