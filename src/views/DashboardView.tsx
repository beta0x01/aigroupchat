import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useConversationStore } from '../store/conversationStore';
import { Trash2, MessageSquare, Calendar, AlertCircle, Plus } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';

const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { conversations, fetchConversations, deleteConversation } = useConversationStore();
  const { openAiApiKey, googleApiKey, mistralApiKey } = useSettingsStore();
  const hasApiKey = Boolean(openAiApiKey || googleApiKey || mistralApiKey);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleStartNewChat = async () => {
    navigate('/new-chat');
  };

  const handleOpenConversation = (id: number) => {
    navigate(`/chat/${id}`);
  };

  const handleDeleteConversation = async (id: number) => {
    await deleteConversation(id);
  };

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
          Welcome back
        </h1>
        <p className="text-gray-400 text-lg">Continue your AI conversations or start something new</p>
      </div>

      {!hasApiKey && (
        <div className="card p-6 mb-8 border-l-4 border-amber-500">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-500" />
            <div>
              <h3 className="font-semibold text-amber-400">API Key Required</h3>
              <p className="text-gray-300 mt-1">
                You need to set up an API key in Settings to start chatting with AI models.
                <Link to="/settings" className="text-blue-400 hover:underline ml-1">
                  Go to Settings
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <button
          className={`${hasApiKey ? 'btn-primary' : 'bg-gray-600 cursor-not-allowed text-gray-300 py-3 px-6 rounded-xl shadow-modern'}`}
          onClick={hasApiKey ? handleStartNewChat : undefined}
          disabled={!hasApiKey}
        >
          <Plus className="w-5 h-5 inline-block mr-2" />
          Start New Chat
        </button>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-6">
          <MessageSquare className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold">Your Conversations</h2>
          <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm">
            {conversations.length}
          </span>
        </div>

        {conversations.length === 0 ? (
          <div className="card p-12 text-center">
            <MessageSquare className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No conversations yet</h3>
            <p className="text-gray-400 mb-6">Start your first chat to see it appear here!</p>
            <button
              className={`${hasApiKey ? 'btn-secondary' : 'bg-gray-600 cursor-not-allowed text-gray-300 py-2 px-4 rounded-lg'}`}
              onClick={hasApiKey ? handleStartNewChat : undefined}
              disabled={!hasApiKey}
            >
              Create your first chat
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {conversations.map(conversation => (
              <div key={conversation.id} className="card-hover p-6">
                <div className="flex justify-between items-start">
                  <div
                    className={`flex-1 ${hasApiKey ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    onClick={hasApiKey ? () => handleOpenConversation(conversation.id) : undefined}
                  >
                    <h3 className={`text-xl font-semibold mb-2 ${hasApiKey ? 'hover:text-blue-400' : 'text-gray-400'}`}>
                      {conversation.title}
                    </h3>
                    <p className="text-gray-400 mb-3 line-clamp-2">{conversation.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{conversation.startDate.toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        <span>{conversation.agents.length} agents</span>
                      </div>
                    </div>
                  </div>
                  <button
                    className="ml-4 p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                    onClick={() => handleDeleteConversation(conversation.id)}
                    aria-label="Delete conversation"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;
