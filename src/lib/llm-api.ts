// src/lib/llm-api.ts
import type { Message } from '../types';
import {
  getProviderForModel,
  getModelInfo,
  type ApiKeys,
} from './llm-providers';

interface LlmApiOptions {
  model: string;
  messages: Pick<Message, 'role' | 'content'>[];
  temperature?: number;
  max_tokens?: number;
  stop?: string[];
  apiKeys: ApiKeys;
  signal?: AbortSignal;
}

export async function callLlmApi(options: LlmApiOptions): Promise<string> {
  const {
    model,
    messages,
    temperature = 0.7,
    max_tokens,
    stop,
    apiKeys,
    signal,
  } = options;

  const defaultMaxTokens = getModelInfo(model)?.maxTokens ?? 4000;
  const resolvedMaxTokens = max_tokens ?? defaultMaxTokens;

  const provider = getProviderForModel(model);
  if (!provider) {
    throw new Error(`Unsupported model: ${model}`);
  }

  const apiKey = apiKeys[provider.apiKeyName];
  if (!apiKey) {
    throw new Error('API key is missing.');
  }

  try {
    return await provider.call(
      { model, messages, temperature, max_tokens: resolvedMaxTokens, stop, signal },
      apiKey,
    );
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {  
      console.error('Failed to call LLM API:', error);  
    }
    return '';
  }
}
