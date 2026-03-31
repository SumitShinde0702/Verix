import OpenAI from 'openai';

export interface AIDecision {
  decision: 'HIRE_DATA_AGENT';
  reasoning: string;
  taskDescription: string;
  coinId: string;    // CoinGecko coin ID
  symbol: string;    // e.g. "BTC"
  confidence: number;
}

// Supported assets: display name → CoinGecko ID
export const SUPPORTED_ASSETS: Record<string, string> = {
  ETH:  'ethereum',
  BTC:  'bitcoin',
  SOL:  'solana',
  XRP:  'ripple',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  ADA:  'cardano',
  DOT:  'polkadot',
};

const SYSTEM_PROMPT = `You are an autonomous crypto portfolio management AI agent.
You have access to the Verix agent marketplace — you can hire specialist data agents
to fetch real-time market data and pay them automatically via XRPL escrow.

Available assets you can request prices for: ${Object.keys(SUPPORTED_ASSETS).join(', ')}.

When the user asks for a price, identify which asset they want and respond with a 
JSON hiring decision. No markdown, no explanation outside the JSON.`;

export class AIAgent {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    });
  }

  /**
   * Process a natural-language user request (e.g. "get me the bitcoin price")
   * and return a structured hiring decision including which CoinGecko coin to fetch.
   */
  async processRequest(userQuery: string): Promise<AIDecision> {
    const userPrompt = `User request: "${userQuery}"

Based on this request, decide which asset price to fetch and respond ONLY with:
{
  "decision": "HIRE_DATA_AGENT",
  "symbol": "<ticker from the available list, e.g. BTC>",
  "coinId": "<coingecko id, e.g. bitcoin>",
  "reasoning": "<one sentence explaining your decision>",
  "taskDescription": "<precise instruction for the worker agent>",
  "confidence": <integer 0-100>
}`;

    try {
      const response = await this.client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userPrompt    },
        ],
        temperature: 0.2,
        max_tokens: 250,
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as Partial<AIDecision>;

      // Validate the coin is in our supported list; fall back to ETH if unknown
      const symbol = (parsed.symbol?.toUpperCase() ?? 'ETH') as string;
      const validSymbol = symbol in SUPPORTED_ASSETS ? symbol : 'ETH';
      const coinId = SUPPORTED_ASSETS[validSymbol] ?? 'ethereum';

      return {
        decision:        'HIRE_DATA_AGENT',
        symbol:          validSymbol,
        coinId,
        reasoning:       parsed.reasoning       ?? `Need current ${validSymbol}/USD price for portfolio decision.`,
        taskDescription: parsed.taskDescription ?? `Fetch current ${validSymbol}/USD price and return structured JSON.`,
        confidence:      parsed.confidence      ?? 95,
      };
    } catch {
      return this.fallback(userQuery);
    }
  }

  private fallback(userQuery: string): AIDecision {
    // Best-effort parse of user query without LLM
    const q = userQuery.toUpperCase();
    const match = Object.keys(SUPPORTED_ASSETS).find((s) => q.includes(s));
    const symbol = match ?? 'ETH';
    return {
      decision:        'HIRE_DATA_AGENT',
      symbol,
      coinId:          SUPPORTED_ASSETS[symbol] ?? 'ethereum',
      reasoning:       `User requested ${symbol}/USD price data.`,
      taskDescription: `Fetch current ${symbol}/USD price from CoinGecko and return structured JSON.`,
      confidence:      80,
    };
  }

  static isConfigured(apiKey: string | undefined): apiKey is string {
    return typeof apiKey === 'string' && apiKey.trim().length > 0;
  }
}
