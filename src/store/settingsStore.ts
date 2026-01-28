import { create } from 'zustand';
import { db } from '../db';
import { getDefaultModel } from '../lib/llm-providers';

interface SettingsState {
  openAiApiKey: string;
  googleApiKey: string;
  mistralApiKey: string;
  autoAdvance: boolean;
  maxAutoAdvance: number;
  maxContextMessages: number;
  nextSpeakerModel: string;
  initialized: boolean;
  init: () => Promise<void>;
  setOpenAiApiKey: (key: string) => Promise<void>;
  setGoogleApiKey: (key: string) => Promise<void>;
  setMistralApiKey: (key: string) => Promise<void>;
  setAutoAdvance: (value: boolean) => Promise<void>;
  setMaxAutoAdvance: (value: number) => Promise<void>;
  setMaxContextMessages: (value: number) => Promise<void>;
  setNextSpeakerModel: (model: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  openAiApiKey: '',
  googleApiKey: '',
  mistralApiKey: '',
  autoAdvance: true,
  maxAutoAdvance: 7,
  maxContextMessages: 20,
  nextSpeakerModel: '',
  initialized: false,
  init: async () => {
    const openAiKeyResult = await db.settings.get('openaiApiKey');
    const googleKeyResult = await db.settings.get('googleApiKey');
    const mistralKeyResult = await db.settings.get('googleApiKey');
    const autoAdvResult = await db.settings.get('autoAdvance');
    const maxAutoAdvResult = await db.settings.get('maxAutoAdvance');
    const maxContextResult = await db.settings.get('maxContextMessages');
    const nextSpeakerModelResult = await db.settings.get('nextSpeakerModel');
    const apiKeys = {
      openAiApiKey: openAiKeyResult?.value,
      googleApiKey: googleKeyResult?.value,
      mistralApiKey: mistralKeyResult?.value,
    };
    set({
      openAiApiKey: openAiKeyResult?.value || '',
      googleApiKey: googleKeyResult?.value || '',
      mistralApiKey: mistralKeyResult?.value || '',
      autoAdvance: autoAdvResult ? autoAdvResult.value === 'true' : true,
      maxAutoAdvance: maxAutoAdvResult
        ? Math.max(2, Math.min(999, Number(maxAutoAdvResult.value)))
        : 7,
      maxContextMessages: maxContextResult
        ? Math.max(1, Math.min(999, Number(maxContextResult.value)))
        : 20,
      nextSpeakerModel:
        nextSpeakerModelResult?.value || getDefaultModel(apiKeys),
      initialized: true,
    });
  },
  setOpenAiApiKey: async (key) => {
    await db.settings.put({ key: 'openaiApiKey', value: key });
    set({ openAiApiKey: key });
  },
  setGoogleApiKey: async (key) => {
    await db.settings.put({ key: 'googleApiKey', value: key });
    set({ googleApiKey: key });
  },
  setMistralApiKey: async (key) => {  
  await db.settings.put({ key: 'mistralApiKey', value: key });  
  set({ mistralApiKey: key });  
  },
  setAutoAdvance: async (value) => {
    await db.settings.put({ key: 'autoAdvance', value: String(value) });
    set({ autoAdvance: value });
  },
  setMaxAutoAdvance: async (value) => {
    const clamped = Math.max(2, Math.min(999, value));
    await db.settings.put({ key: 'maxAutoAdvance', value: String(clamped) });
    set({ maxAutoAdvance: clamped });
  },
  setMaxContextMessages: async (value) => {
    const clamped = Math.max(1, Math.min(999, value));
    await db.settings.put({ key: 'maxContextMessages', value: String(clamped) });
    set({ maxContextMessages: clamped });
  },
  setNextSpeakerModel: async (model) => {
    await db.settings.put({ key: 'nextSpeakerModel', value: model });
    set({ nextSpeakerModel: model });
  },
}));
