import { BaseAIProvider, GenerationOptions } from './base.provider';

export class GeminiProvider extends BaseAIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  getName(): string {
    return 'Gemini';
  }

  async isHealthy(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generate(prompt: string, options?: GenerationOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is missing');
    }
    const activeModel = options?.model || this.model;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? 0.2,
          maxOutputTokens: options?.maxTokens ?? 1000,
        }
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${err}`);
    }

    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || '';
  }
}
