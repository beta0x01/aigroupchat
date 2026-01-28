// src/hooks/useChatConductor.ts
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useConversationStore } from '../store/conversationStore';
import { useMessageStore } from '../store/messageStore';
import { useSettingsStore } from '../store/settingsStore';
import { determineNextSpeaker, generateAgentResponse } from '../lib/chat-logic';
import type { Message } from '../types';

const NEXT_SPEAKER_DELAY = 3000;
const USER_TYPING_COOLDOWN = 3000;

const getNextMessageDelay = (lastMessage: Message | undefined): number => {
  if (!lastMessage || lastMessage.agentId === 'user') {
    return 3000;
  }
  const wordCount = lastMessage.content.split(/\s+/).length;
  const delay = Math.max(2000, wordCount * 250);
  return Math.min(delay, 5000);
};

export function useChatConductor(conversationId: number) {
  const { conversations, updateConversation } = useConversationStore();
  const { messages, addMessage } = useMessageStore();
  const {
    openAiApiKey,
    googleApiKey,
    mistralApiKey,
    autoAdvance,
    maxAutoAdvance,
    maxContextMessages,
    nextSpeakerModel,
    setAutoAdvance,
  } = useSettingsStore();
  const [isPaused, setIsPaused] = useState(!autoAdvance);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingAgentId, setThinkingAgentId] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false); // Track if a turn is currently being processed
  const abortControllerRef = useRef<AbortController | null>(null);
  const turnIdRef = useRef(0); // Incrementing ID to ignore stale turns
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestStartedRef = useRef(false);
  const needsRestartRef = useRef(false);
  
  const conversation = conversations.find((c) => c.id === conversationId);
  
  // Ensure agent settings are properly merged with base agent data
  const agents = useMemo(() => {
    if (!conversation) return [];
    
    return conversation.agents.map((baseAgent) => {
      const settings = conversation.agentSettings?.find(
        (s) => s.agentId === baseAgent.id,
      );
      return {
        ...baseAgent,
        ...(settings || {}),
      };
    });
  }, [conversation]);

  useEffect(() => {
    setIsPaused(!autoAdvance);
  }, [autoAdvance]);

  const startConductor = useCallback(() => {
    if (!isRunningRef.current) {
      console.log('[Conductor] Started');
      isRunningRef.current = true;
      setIsRunning(true);
    }
  }, []);

  const finishTurn = useCallback(() => {
    setIsThinking(false);
    setThinkingAgentId(null);
  }, []);

  const stopConductor = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    finishTurn();
    isProcessingRef.current = false;
    requestStartedRef.current = false;
    needsRestartRef.current = false;
    if (isRunningRef.current) {
      console.log('[Conductor] Stopped');
      isRunningRef.current = false;
      setIsRunning(false);
    }
  }, [finishTurn]);

  const getAiSinceUser = useCallback(() => {
    let count = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].agentId === 'user') break;
      count++;
    }
    return count;
  }, [messages]);

  const runNextTurn = useCallback(
    async (forcedNextSpeakerId?: number, overridePause = false) => {
    if (isProcessingRef.current) {
      console.log('[Conductor] Already processing a message, skipping');
      return;
    }

    const turnId = ++turnIdRef.current;
    console.log('[Conductor] Triggered');
    isProcessingRef.current = true;
    startConductor();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    requestStartedRef.current = false;

    try {
      if (
        isPaused &&
        !overridePause &&
        !forcedNextSpeakerId &&
        (!messages.length || messages[messages.length - 1].agentId !== 'user')
      ) {
        console.log('[Conductor] Paused');
        stopConductor();
        return;
      }

      const apiKeys = { openAiApiKey, googleApiKey, mistralApiKey };
      if (!Object.values(apiKeys).some(Boolean)) {
        console.log('[Conductor] Missing API key');
        stopConductor();
        return;
      }

      if (agents.length === 0) {
        console.log('[Conductor] No agents in conversation');
        stopConductor();
        return;
      }

      setIsThinking(true);
      console.log('[Conductor] Determining next speaker');
      const nextSpeakerId =
        forcedNextSpeakerId ??
        (await determineNextSpeaker(
          messages,
          agents,
          apiKeys,
          maxContextMessages,
          nextSpeakerModel,
          abortController.signal,
        ));

      if (!nextSpeakerId) {
        console.log('[Conductor] Could not determine next speaker');
        stopConductor();
        return;
      }
      if (nextSpeakerId === 'user') {  
        console.log('[Conductor] User selected - waiting');
        // Don't fully stop, just finish this turn
        finishTurn();
        isProcessingRef.current = false;
        return;  
      }

      const speakerId = typeof nextSpeakerId === 'number' ? nextSpeakerId : parseInt(String(nextSpeakerId), 10);
      if (isNaN(speakerId)) {
        console.error('[Conductor] Invalid speaker ID:', nextSpeakerId);
        return;
      }
      setThinkingAgentId(speakerId);
      await updateConversation(conversationId, { nextSpeakerId: speakerId });
      console.log(`[Conductor] Next speaker is ${speakerId}`);

      const delay = forcedNextSpeakerId
        ? 0
        : getNextMessageDelay(messages[messages.length - 1]);
      if (delay > 0) {
        console.log(`[Conductor] Waiting ${delay}ms before generating message`);
        await new Promise((res) => setTimeout(res, delay));

        if (!isRunningRef.current || abortController.signal.aborted) {
          console.log('[Conductor] Aborted before generating message');
          return;
        }

        const lastMsg = messages[messages.length - 1];
        if (
          isPaused &&
          !overridePause &&
          !forcedNextSpeakerId &&
          lastMsg &&
          lastMsg.agentId !== 'user'
        ) {
          console.log('[Conductor] Paused during wait');
          stopConductor();
          return;
        }
      } else {
        console.log('[Conductor] Skipping delay for forced turn');
      }

      requestStartedRef.current = true;
      console.log(`[Conductor] Generating response for ${nextSpeakerId}`);
      const checkIn = autoAdvance && getAiSinceUser() >= maxAutoAdvance; // Check-in with User after limit

      const agent = agents.find((a) => a.id === nextSpeakerId);

      const responseContent = await generateAgentResponse(
        speakerId,
        messages,
        agents,
        apiKeys,
        { checkIn, traits: agent?.traits },
        maxContextMessages,
        abortController.signal,
      );

      if (abortController.signal.aborted) {
        console.log('[Conductor] Response generation aborted');
        return;
      }

      if (responseContent) {
        console.log(
          `[Conductor] Adding message from ${nextSpeakerId}:`,
          responseContent,
        );
        await addMessage({
          conversationId,
          agentId: speakerId,
          content: responseContent,
        });

        if (checkIn) {
          setAutoAdvance(false);
        }
      }
    } finally {
      if (turnIdRef.current === turnId) {
        abortControllerRef.current = null;
        isProcessingRef.current = false;
        finishTurn();
      }
    }
  }, [
    isPaused,
    openAiApiKey,
    googleApiKey,
    agents,
    messages,
    conversationId,
    addMessage,
    finishTurn,
    stopConductor,
    startConductor,
    updateConversation,
    autoAdvance,
    maxAutoAdvance,
    maxContextMessages,
    getAiSinceUser,
    nextSpeakerModel,
    setAutoAdvance,
  ]);

  const handleUserTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Cancel pending turn if user is typing
    if (isThinking && !requestStartedRef.current) {
      stopConductor();
      needsRestartRef.current = true;
    } else {
      needsRestartRef.current = false; // Clear if not applicable
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (needsRestartRef.current && !isPaused) {
        needsRestartRef.current = false;
        runNextTurn();
      }
    }, USER_TYPING_COOLDOWN);
  }, [isThinking, isPaused, runNextTurn, stopConductor]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    const lastMessage = messages[messages.length - 1];
    
    if (isPaused && (!lastMessage || lastMessage.agentId !== 'user')) {
      return;
    }
    
    startConductor();
    timerRef.current = setTimeout(() => {
      runNextTurn();
    }, NEXT_SPEAKER_DELAY);
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [messages.length, isPaused, runNextTurn, startConductor]);

  const pause = () => setAutoAdvance(false);
  const resume = () => setAutoAdvance(true);

  const forceTurn = (agentId: number) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    finishTurn();
    isProcessingRef.current = false;
    requestStartedRef.current = false; // Add this
    needsRestartRef.current = false;   // Add this
    
    runNextTurn(agentId);
  };

  const advanceOne = useCallback(async () => {
    await runNextTurn(undefined, true);
    stopConductor();
  }, [runNextTurn, stopConductor]);

  return {
    isPaused,
    isThinking,
    thinkingAgentId,
    isRunning,
    pause,
    resume,
    forceTurn,
    advanceOne,
    handleUserTyping,
  };
}