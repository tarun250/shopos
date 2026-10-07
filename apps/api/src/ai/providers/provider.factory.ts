import { OpenRouterProvider } from './openrouter.provider';
import { GroqProvider } from './groq.provider';
import { GeminiProvider } from './gemini.provider';
import { BaseAIProvider } from './base.provider';

export class ProviderFactory {
  static getProviders(keys?: { openrouter?: string; groq?: string; gemini?: string }): BaseAIProvider[] {
    const providers: BaseAIProvider[] = [];

    const openrouterKey = keys?.openrouter || process.env.OPENROUTER_API_KEY || '';
    const groqKey = keys?.groq || process.env.GROQ_API_KEY || '';
    const geminiKey = keys?.gemini || process.env.GEMINI_API_KEY || '';

    // Load in order of priority: OpenRouter -> Groq -> Gemini
    providers.push(new OpenRouterProvider(openrouterKey));
    providers.push(new GroqProvider(groqKey));
    providers.push(new GeminiProvider(geminiKey));

    return providers;
  }
}
