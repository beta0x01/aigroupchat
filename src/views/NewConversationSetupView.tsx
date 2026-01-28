import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { db } from '../db';
import { useAgentStore } from '../store/agentStore';
import { useConversationStore } from '../store/conversationStore';
import AgentMultiSelect from '../components/AgentMultiSelect';
import { useSettingsStore } from '../store/settingsStore';
import { getAvailableModels, getDefaultModel } from '../lib/llm-providers';

const NewConversationSetupView: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { presetAgents, customAgents, fetchCustomAgents } = useAgentStore();
  const { addConversation } = useConversationStore();
  const { openAiApiKey, googleApiKey } = useSettingsStore();
  const apiKeys = { openAiApiKey, googleApiKey };

  const [title, setTitle] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<number[]>([]);

  useEffect(() => {
    fetchCustomAgents();
  }, [fetchCustomAgents]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const agentId = params.get('agentId');
    if (agentId) {
      const id = Number(agentId);
      setSelectedAgents((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }
  }, [location.search]);

  useEffect(() => {
    const loadConversation = async () => {
      if (conversationId) {
        const existing = await db.conversations.get(Number(conversationId));
        if (existing) {
          setTitle(existing.title);
          setSelectedAgents(existing.agents.map((a) => a.id));
        }
      }
    };
    loadConversation();
  }, [conversationId]);

  useEffect(() => {
    if (!openAiApiKey && !googleApiKey) {
      navigate('/settings');
    }
  }, [openAiApiKey, googleApiKey, navigate]);

  const toggleAgent = (id: number) => {
    setSelectedAgents((prev) => {
      if (prev.includes(id)) {
        return prev.filter((a) => a !== id);
      }
      if (prev.length >= 20) return prev;
      return [...prev, id];
    });
  };

  const startChat = async () => {
    const allAgents = [...presetAgents, ...customAgents];
    const availableModels = getAvailableModels(apiKeys);
    const defaultModel = getDefaultModel(apiKeys);
    const chosenAgents = allAgents
      .filter((a) => selectedAgents.includes(a.id))
      .map((a) => ({
        ...a,
        defaultModel: availableModels.some((m) => m.id === a.defaultModel)
          ? a.defaultModel
          : defaultModel,
      }));
    const newConversation = await addConversation({
      title: title || 'Untitled Chat',
      description: '',
      language: 'en',
      agents: chosenAgents,
    });
    navigate(`/chat/${newConversation.id}`);
  };


  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">New Conversation Setup</h2>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Conversation Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My Chat"
          className="w-full p-2 rounded bg-gray-800 text-white"
        />
      </div>
      <AgentMultiSelect
        agents={[...presetAgents, ...customAgents]}
        selectedIds={selectedAgents}
        onToggle={toggleAgent}
        maxSelect={20}
      />
      <p className="text-sm mt-2">
        Need more options?{' '}
        <Link to="/agents" className="text-blue-400 hover:underline">Manage Agents</Link>
      </p>
      <button
        onClick={startChat}
        disabled={selectedAgents.length < 1}
        className={`mt-4 px-4 py-2 rounded ${selectedAgents.length < 1 ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        Start Chat
      </button>
    </div>
  );
};

export default NewConversationSetupView;
