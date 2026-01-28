// src/lib/chat-logic.ts
import type { Agent, Message } from '../types';
import { Prompts } from './prompts';
import { callLlmApi } from './llm-api';
import { getDefaultModel, type ApiKeys } from './llm-providers';

function formatConversationToString(messages: Message[], agents: Agent[]): string {
  return messages
    .map((msg) => {
      const senderName = msg.agentId === 'user'
        ? 'User'
        : agents.find((a) => a.id === msg.agentId)?.name || 'Unknown';
      return `${senderName}: ${msg.content}`;
    })
    .join('\n');
}

function getConversationContext(
  messages: Message[],
  agents: Agent[],
  maxContext: number,
): string {
  const total = messages.length;
  const relevant = messages.slice(-maxContext);
  const formatted = formatConversationToString(relevant, agents);
  if (total > relevant.length) {
    const omitted = total - relevant.length;
    return `[${omitted} previous messages not shown]\n${formatted}`;
  }
  return formatted;
}

function buildPrompt<T>(template: T, replacements: Record<string, string>): T {
  console.log('[chat-logic] buildPrompt original', JSON.stringify(template));

  // Deep clone and replace placeholders in the actual data structure
  const replaceInValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return Object.entries(replacements).reduce((acc, [key, val]) => {
        return acc.replace(new RegExp(`{{${key}}}`, 'g'), val);
      }, value);
    } else if (Array.isArray(value)) {
      return value.map(replaceInValue);
    } else if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = replaceInValue(v);
      }
      return result;
    }
    return value;
  };

  const result = replaceInValue(template) as T;
  console.log('[chat-logic] buildPrompt replaced', JSON.stringify(result));
  return result;
}

export async function determineNextSpeaker(
  conversationMessages: Message[],
  agents: Agent[],
  apiKeys: ApiKeys,
  maxContextMessages: number,
  model?: string,
  signal?: AbortSignal,
): Promise<number | string | null> {
  const isFirstTurn = conversationMessages.length === 0;
  const promptTemplate = isFirstTurn ? Prompts.firstSpeaker() : Prompts.nextSpeaker();
  const agentsList = agents
    .map((a) => `- ${a.name}: ${a.description} ${a.traits || ''}`)
    .join('\n');
  const conversationString = getConversationContext(
    conversationMessages,
    agents,
    maxContextMessages,
  );

  const replacements = {
    agents: agentsList,
    conversation: conversationString,
  };
  const finalPrompt = buildPrompt(promptTemplate, replacements);
  console.log('[chat-logic] determineNextSpeaker prompt', finalPrompt);

  const modelToUse = model || getDefaultModel(apiKeys);
  const response = await callLlmApi({
    model: modelToUse,
    messages: finalPrompt as unknown as Pick<Message, 'role' | 'content'>[],
    temperature: 0.5,
    max_tokens: 15,
    apiKeys,
    signal,
  });

  console.log('[chat-logic] determineNextSpeaker response', response);

  const nextSpeaker = agents.find((a) => response.includes(a.name));
  if (response.toLowerCase().includes('user')) {  
    return 'user';
  }
  return nextSpeaker ? nextSpeaker.id : null;
}

export async function generateAgentResponse(
  speakingAgentId: number,
  conversationMessages: Message[],
  agents: Agent[],
  apiKeys: ApiKeys,
  options: { checkIn?: boolean; traits?: string | null | undefined } = {},
  maxContextMessages: number,
  signal?: AbortSignal,
): Promise<string> {
  const speakingAgent = agents.find((a) => a.id === speakingAgentId);
  if (!speakingAgent) return '';

  const otherAgents = agents.filter((a) => a.id !== speakingAgentId);
  const lastMessage = conversationMessages[conversationMessages.length - 1];
  const isFirstMessage = conversationMessages.length === 0;
  const isAgentContinuing = lastMessage?.agentId === speakingAgentId;

  let promptTemplate;
  if (options.checkIn) {
    promptTemplate = Prompts.checkInMessage();
  } else if (isFirstMessage) {
    promptTemplate = Prompts.firstMessage();
  } else if (isAgentContinuing) {
    promptTemplate = Prompts.continueMessage();
  } else {
    promptTemplate = Prompts.nextMessage();
  }

  const conversationString = getConversationContext(
    conversationMessages,
    agents,
    maxContextMessages,
  );
  const otherNames = otherAgents.map((a) => `[${a.name}]`).join(', ');

  const replacements = {
    name: speakingAgent.name,
    description: speakingAgent.description,
    traits: options.traits || speakingAgent.traits || '',
    agents: otherNames,
    username: 'User',
    conversation: conversationString,
  };

  const finalPrompt = buildPrompt(promptTemplate, replacements);
  console.log('[chat-logic] generateAgentResponse prompt', finalPrompt);

  const response = await callLlmApi({
    model: speakingAgent.model || speakingAgent.defaultModel || getDefaultModel(apiKeys),
    temperature: speakingAgent.temperature || speakingAgent.defaultTemperature || 0.7,
    messages: finalPrompt as unknown as Pick<Message, 'role' | 'content'>[],
    apiKeys,
    signal,
  });

  console.log('[chat-logic] generateAgentResponse response', response);

  const prefixPattern = new RegExp(String.raw`^${speakingAgent.name}:\s*`, 'i');
  let cleaned = response.replace(prefixPattern, '');
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned;
}
