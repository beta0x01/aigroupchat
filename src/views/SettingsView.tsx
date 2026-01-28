import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { db } from '../db';
import type { Agent, Conversation, Message, Setting } from '../types';
import { getAvailableModels, getDefaultModel } from '../lib/llm-providers';

const SettingsView: React.FC = () => {
  const {
    openAiApiKey,
    googleApiKey,
    mistralApiKey,
    autoAdvance,
    maxAutoAdvance,
    maxContextMessages,
    nextSpeakerModel,
    setOpenAiApiKey,
    setGoogleApiKey,
    setMistralApiKey,
    setAutoAdvance,
    setMaxAutoAdvance,
    setMaxContextMessages,
    setNextSpeakerModel,
    init,
  } = useSettingsStore();

  const apiKeys = { openAiApiKey, googleApiKey, mistralApiKey };
  const availableModels = getAvailableModels(apiKeys);
  const defaultModel = getDefaultModel(apiKeys);
  const nextSpeakerModelValue = availableModels.some(
    (m) => m.id === nextSpeakerModel,
  )
    ? nextSpeakerModel
    : defaultModel;

  useEffect(() => {
    if (nextSpeakerModel !== nextSpeakerModelValue) {
      setNextSpeakerModel(nextSpeakerModelValue);
    }
  }, [nextSpeakerModel, nextSpeakerModelValue, setNextSpeakerModel]);

  useEffect(() => {
    init();
  }, [init]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [openAiSaved, setOpenAiSaved] = useState(false);
  const [googleSaved, setGoogleSaved] = useState(false);
  const [mistralSaved, setMistralSaved] = useState(false);
  const openAiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const googleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mistralTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpenAiChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    await setOpenAiApiKey(value);
    setOpenAiSaved(true);
    if (openAiTimeoutRef.current) clearTimeout(openAiTimeoutRef.current);
    openAiTimeoutRef.current = setTimeout(() => setOpenAiSaved(false), 2000);
  };

  const handleMistralChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    await setMistralApiKey(value);
    setMistralSaved(true);
    if (mistralTimeoutRef.current) clearTimeout(mistralTimeoutRef.current);
    mistralTimeoutRef.current = setTimeout(() => setMistralSaved(false), 2000);
  };

  const handleGoogleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    await setGoogleApiKey(value);
    setGoogleSaved(true);
    if (googleTimeoutRef.current) clearTimeout(googleTimeoutRef.current);
    googleTimeoutRef.current = setTimeout(() => setGoogleSaved(false), 2000);
  };

  type ExportData = {
    agents: Agent[];
    conversations: (Omit<Conversation, 'startDate'> & { startDate: string })[];
    messages: (Omit<Message, 'sendTime'> & { sendTime: string })[];
    settings: Setting[];
  };

  const handleExport = async () => {
    const data: ExportData = {
      agents: await db.agents.toArray(),
      conversations: (await db.conversations.toArray()).map((c) => ({
        ...c,
        startDate: c.startDate.toISOString(),
      })),
      messages: (await db.messages.toArray()).map((m) => ({
        ...m,
        sendTime: m.sendTime.toISOString(),
      })),
      settings: await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chatmeld-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') throw new Error('Invalid file');
        const data = JSON.parse(text) as ExportData;
        await db.transaction('rw', [
          db.agents,
          db.conversations,
          db.messages,
          db.settings,
        ], async () => {
          await Promise.all([
            db.agents.clear(),
            db.conversations.clear(),
            db.messages.clear(),
            db.settings.clear(),
          ]);
          await db.agents.bulkAdd(data.agents || []);
          await db.conversations.bulkAdd(
            (data.conversations || []).map((c) => ({
              ...c,
              startDate: new Date(c.startDate),
            }))
          );
          await db.messages.bulkAdd(
            (data.messages || []).map((m) => ({
              ...m,
              sendTime: new Date(m.sendTime),
            }))
          );
          await db.settings.bulkAdd(data.settings || []);
        });
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert('Failed to import data');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = async () => {
    const confirmed = window.confirm(
      'This will remove all chats, agents, and settings. Are you sure?'
    );
    if (confirmed) {
      await db.delete();
      window.location.reload();
    }
  };

  return (
    <div className="p-6 space-y-8">
      <header className="space-y-2">
        <h2 className="text-3xl font-bold">Settings</h2>
        <p>
          Configure your API keys, adjust conversation behavior, or manage stored data.
          <strong> All data is stored locally in your browser.</strong>
        </p>
      </header>

      <section className="space-y-4">
        <h3 className="text-xl font-semibold">API Keys</h3>
        <div className="space-y-2">
          <label htmlFor="openAiApiKey" className="block text-sm font-medium">
            OpenAI API Key
          </label>
          <div className="relative">
            <input
              id="openAiApiKey"
              type="password"
              placeholder="sk-..."
              className="w-full p-2 rounded bg-gray-700 text-white"
              value={openAiApiKey}
              onChange={handleOpenAiChange}
            />
            {openAiSaved && (
              <span className="absolute right-0 -top-5 flex items-center gap-1 text-xs text-green-500 whitespace-nowrap">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="googleApiKey" className="block text-sm font-medium">
            Google AI Studio API Key
          </label>
          <div className="relative">
            <input
              id="googleApiKey"
              type="password"
              placeholder="AIza..."
              className="w-full p-2 rounded bg-gray-700 text-white"
              value={googleApiKey}
              onChange={handleGoogleChange}
            />
            {googleSaved && (
              <span className="absolute right-0 -top-5 flex items-center gap-1 text-xs text-green-500 whitespace-nowrap">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
          </div>
        </div>
        <div className="space-y-2">  
          <label htmlFor="mistralApiKey" className="block text-sm font-medium">  
            Mistral API Key  
          </label>  
          <div className="relative">  
            <input  
              id="mistralApiKey"  
              type="password"  
              placeholder="Mistral API Key... (32 Chars azAZ09)"  
              className="w-full p-2 rounded bg-gray-700 text-white"  
              value={mistralApiKey}  
              onChange={handleMistralChange}  
            />  
            {mistralSaved && (  
              <span className="absolute right-0 -top-5 flex items-center gap-1 text-xs text-green-500 whitespace-nowrap">  
                <Check className="h-4 w-4" />  
                Saved  
              </span>  
            )}  
          </div>  
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-semibold">Conversation</h3>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="autoAdvance"
            checked={autoAdvance}
            onChange={(e) => setAutoAdvance(e.target.checked)}
          />
          <label htmlFor="autoAdvance" className="text-sm font-medium">
            Auto-advance conversations
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="maxAutoAdvance" className="text-sm font-medium">
            Max Auto-advance
          </label>
          <input
            type="number"
            id="maxAutoAdvance"
            min={2}
            max={999}
            className="w-20 p-1 rounded bg-gray-700 text-white"
            value={maxAutoAdvance}
            onChange={(e) => setMaxAutoAdvance(Number(e.target.value))}
          />
          <span className="text-sm text-gray-400">
            Consecutive AI messages before auto-advance turns off.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="maxContextMessages" className="text-sm font-medium">
            Max Context Messages
          </label>
          <input
            type="number"
            id="maxContextMessages"
            min={3}
            max={999}
            className="w-20 p-1 rounded bg-gray-700 text-white"
            value={maxContextMessages}
            onChange={(e) => setMaxContextMessages(Number(e.target.value))}
          />
          <span className="text-sm text-gray-400">
            Recent messages included in prompts.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="nextSpeakerModel" className="text-sm font-medium">
            Next Speaker Model
          </label>
          <select
            id="nextSpeakerModel"
            className="p-1 rounded bg-gray-700 text-white"
            value={nextSpeakerModelValue}
            onChange={(e) => setNextSpeakerModel(e.target.value)}
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-400">
            Model used to determine next speaker.
          </span>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-semibold">Data Management</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded bg-gray-700 text-white"
            onClick={handleExport}
          >
            Export All Data
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded bg-gray-700 text-white"
            onClick={handleImport}
          >
            Import Data
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white"
            onClick={handleClearData}
          >
            Clear All Local Data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </section>

      <footer>
        <p className="text-sm">
          Manage your{' '}
          <Link to="/agents" className="text-blue-400 hover:underline">
            custom agents
          </Link>
        </p>
      </footer>
    </div>
  );
};

export default SettingsView;
