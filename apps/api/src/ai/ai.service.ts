import { Injectable, Logger } from '@nestjs/common';
import { ProviderFactory } from './providers/provider.factory';
import { GenerationOptions } from './providers/base.provider';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(private prisma: PrismaService) {}

  async generate(prompt: string, options?: GenerationOptions & { taskType?: string; allowMock?: boolean }): Promise<string> {
    const settings = await this.prisma.client.systemSetting.findMany().catch(() => []);
    const getSetting = (key: string, fallback: string) => settings.find(s => s.key === key)?.value || fallback;

    // Load provider priority configuration
    const configuredPriorityStr = getSetting('ai_provider_priority', 'OpenRouter,Groq,Gemini');
    const priorityList = configuredPriorityStr.split(',').map(s => s.trim());

    // Filter and sort providers according to priorityList
    const dbOpenrouter = getSetting('openrouter_api_key', '');
    const dbGroq = getSetting('groq_api_key', '');
    const dbGemini = getSetting('gemini_api_key', '');

    const rawProviders = ProviderFactory.getProviders({
      openrouter: dbOpenrouter,
      groq: dbGroq,
      gemini: dbGemini
    });
    const providers = [...rawProviders].sort((a, b) => {
      const idxA = priorityList.indexOf(a.getName());
      const idxB = priorityList.indexOf(b.getName());
      const valA = idxA === -1 ? 99 : idxA;
      const valB = idxB === -1 ? 99 : idxB;
      return valA - valB;
    });

    // Task-based model mapping configurations
    let activeModel = options?.model;
    const task = options?.taskType || 'DEFAULT';

    if (!activeModel) {
      if (task === 'OCR') {
        activeModel = getSetting('ai_model_ocr', 'gemini-2.5-flash');
      } else if (task === 'REASONING') {
        activeModel = getSetting('ai_model_reasoning', 'google/gemini-2.5-pro');
      } else if (task === 'AUTOCOMPLETE') {
        activeModel = getSetting('ai_model_autocomplete', 'llama-3.3-70b-specdec');
      } else {
        activeModel = getSetting('ai_model_default', 'google/gemini-2.5-flash');
      }
    }

    const { taskType: _taskType, allowMock = true, ...generationOptions } = options || {};

    for (const provider of providers) {
      const isHealthy = await provider.isHealthy();
      if (!isHealthy) {
        this.logger.warn(`Provider ${provider.getName()} is marked unhealthy, bypassing.`);
        continue;
      }

      // Model names differ per provider, so resolve one this provider actually serves
      const providerModel = this.resolveModel(provider.getName(), activeModel, getSetting);
      const runOptions: GenerationOptions = {
        ...generationOptions,
        model: providerModel,
        temperature: Number(getSetting('ai_temperature', '0.3')),
      };

      try {
        this.logger.log(`Attempting generation with provider: ${provider.getName()} using model: ${providerModel}`);
        
        // Timeout wrapper (8 seconds limit)
        const result = await Promise.race([
          provider.generate(prompt, runOptions),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000))
        ]);
        if (!result.trim()) {
          throw new Error('Empty response');
        }
        
        this.logger.log(`Generation succeeded using provider: ${provider.getName()}`);

        // Perform token cost tracking estimation
        const promptTokens = Math.ceil(prompt.split(/\s+/).length * 1.3);
        const completionTokens = Math.ceil(result.split(/\s+/).length * 1.3);
        let tokenRate = 0.000002; // standard baseline rate per token (in USD)
        if (provider.getName() === 'OpenRouter') tokenRate = 0.000005;
        else if (provider.getName() === 'Groq') tokenRate = 0.0000008;
        else if (provider.getName() === 'Gemini') tokenRate = 0.0000002;

        const estimatedCost = (promptTokens + completionTokens) * tokenRate;

        // Log token metrics to DB auditing ledger
        await this.prisma.client.aiCostLog.create({
          data: {
            provider: provider.getName(),
            model: providerModel,
            taskType: task,
            promptTokens,
            completionTokens,
            estimatedCost,
          }
        }).catch(e => this.logger.error(`Failed to write cost audit log: ${e.message}`));

        return result;
      } catch (err: any) {
        this.logger.error(`Provider ${provider.getName()} failed: ${err.message}. Falling back...`);
      }
    }

    if (!allowMock) {
      this.logger.error('All AI providers failed.');
      throw new Error('All AI providers are unavailable. Check the API keys and credits in AI Settings.');
    }

    // Default fallback structured simulation if all providers fail
    this.logger.error('All AI providers failed. Falling back to structured parser simulation.');
    return this.mockStructuredResponse(prompt);
  }

  private resolveModel(providerName: string, taskModel: string, getSetting: (key: string, fallback: string) => string): string {
    if (providerName === 'Gemini') {
      // Native Gemini API takes bare names like "gemini-2.5-flash", not "google/..."
      return taskModel.startsWith('gemini') ? taskModel : getSetting('gemini_model', 'gemini-2.5-flash');
    }
    if (providerName === 'Groq') {
      return getSetting('groq_model', 'openai/gpt-oss-120b');
    }
    // OpenRouter uses "vendor/model" names
    return taskModel.includes('/') ? taskModel : getSetting('openrouter_model', 'google/gemini-2.5-flash');
  }

  private mockStructuredResponse(prompt: string): string {
    const cleaned = prompt.toLowerCase();
    
    if (cleaned.includes('led') || cleaned.includes('bulb')) {
      return JSON.stringify({
        brand: 'Philips',
        category: 'Electricals',
        variant: 'Cool Day Light',
        volume: '9W',
        color: 'White',
        gst: 18.0,
        hsn: '85395200',
        units: 'Piece',
        supplier: 'Polycab Wire Distributors',
        confidence: 0.95
      });
    }
    
    if (cleaned.includes('wire') || cleaned.includes('cable')) {
      return JSON.stringify({
        brand: 'Polycab',
        category: 'Electricals',
        variant: '1.5 Sqmm FR',
        volume: '100m Roll',
        color: 'Red',
        gst: 18.0,
        hsn: '85444920',
        units: 'Meter',
        supplier: 'Polycab Wire Distributors',
        confidence: 0.92
      });
    }

    return JSON.stringify({
      brand: 'Generic',
      category: 'Hardware & Tools',
      variant: 'Standard',
      volume: 'N/A',
      color: 'Default',
      gst: 18.0,
      hsn: '73181500',
      units: 'Piece',
      supplier: 'Local Vendor',
      confidence: 0.6
    });
  }
}
