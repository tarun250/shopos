export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  model?: string;
}

export abstract class BaseAIProvider {
  abstract getName(): string;
  abstract generate(prompt: string, options?: GenerationOptions): Promise<string>;
  abstract isHealthy(): Promise<boolean>;
}
