import { BaseAIProvider, GenerationOptions } from './base.provider';

export class GroqProvider extends BaseAIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'openai/gpt-oss-120b') {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  getName(): string {
    return 'Groq';
  }

  async isHealthy(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generate(prompt: string, options?: GenerationOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Groq API key is missing');
    }
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options?.model || this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 1000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }
}
