import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatMessage } from '../components/chat/ChatMessage';
import { useMessageStore } from '../store/messageStore';
import { useConversationStore } from '../store/conversationStore';
import { useChatStore } from '../store/chatStore';
import { ChatSidebar } from '../components/sidebar/ChatSidebar';
import { useChatConductor } from '../hooks/useChatConductor';

export const ChatView = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { messages, fetchMessages, addMessage } = useMessageStore();
  const { conversations, fetchConversations } = useConversationStore();
  const { setActiveConversation, activeConversation } = useChatStore();

  const numericId = conversationId ? Number(conversationId) : 0;
  const conductor = useChatConductor(numericId);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const prevLengthRef = useRef(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch all conversations on component mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Set active conversation in chatStore once conversations are loaded
  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const conversation = conversations.find(
        (c) => c.id === Number(conversationId),
      );
      setActiveConversation(conversation || null);
    }
  }, [conversationId, conversations, setActiveConversation]);

  // Fetch messages for the current conversation
  useEffect(() => {
    if (conversationId) {
      fetchMessages(Number(conversationId));
    }
  }, [conversationId, fetchMessages]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const atBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 10;
      setIsAtBottom(atBottom);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowNewMessageIndicator(false);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      const last = messages[messages.length - 1];
      if (last.agentId !== 'user') {
        if (isAtBottom) {
          scrollToBottom();
        } else {
          setShowNewMessageIndicator(true);
        }
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages, isAtBottom]);

  useEffect(() => {
    if (isAtBottom) {
      setShowNewMessageIndicator(false);
    }
  }, [isAtBottom]);

  const handleSendMessage = async (content: string) => {
    if (conversationId) {
      await addMessage({
        conversationId: Number(conversationId),
        agentId: 'user',
        content,
      });
      scrollToBottom();
    }
  };

  return (
    <div className="flex h-screen">
      {numericId > 0 && (
        <>
          <div
            className={`fixed inset-y-0 left-0 z-50 transform transition-transform ${  
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'  
            }`}
          >
            <ChatSidebar
              conversationId={numericId}
              conductor={conductor}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40"  
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </>
      )}
      <main className="relative flex flex-1 flex-col bg-gradient-primary text-white">
        <button
          className="absolute top-4 left-4 z-10 p-2 rounded hover:bg-gray-700"  
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X /> : <Menu />}
        </button>
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {conductor.isThinking && activeConversation && conductor.thinkingAgentId && (
              <div className="text-sm text-gray-400 mt-2">
                {activeConversation.agents.find((a) => a.id === conductor.thinkingAgentId)?.name || 'AI'} is typing...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        {showNewMessageIndicator && (
          <button
            className="fixed bottom-48 right-4 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 z-10"
            onClick={scrollToBottom}
          >
            New message
          </button>
        )}
        <div className="max-w-4xl mx-auto w-full">
          <ChatInput
            onSendMessage={handleSendMessage}
            onUserTyping={conductor.handleUserTyping}
          />
        </div>
      </main>
    </div>
  );
};
