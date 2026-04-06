'use client';

import React, { useState, useRef, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FiX, FiSend, FiMessageCircle, FiLoader, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatAgentTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
}

const ChatAgentTestModal: React.FC<ChatAgentTestModalProps> = ({
  isOpen,
  onClose,
  agentId,
  agentName,
}) => {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatEnded, setChatEnded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !chatId && !isCreatingChat) {
      startNewChat();
    }
  }, [isOpen]);

  const getToken = () => localStorage.getItem('partner_token');

  const startNewChat = async () => {
    try {
      setIsCreatingChat(true);
      setError(null);
      setMessages([]);
      setChatEnded(false);
      setChatId(null);

      const token = getToken();
      if (!token) {
        setError('Authentication required. Please refresh the page.');
        return;
      }

      const response = await fetch(`/api/partner/retell-chat-agents/${agentId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'quota_exceeded') {
          setError('Your Retell account has reached its usage limit.');
        } else if (data.error === 'invalid_api_key') {
          setError('Your Retell API key appears to be invalid.');
        } else {
          setError(data.message || data.error || 'Failed to create chat session');
        }
        return;
      }

      setChatId(data.chatId);
      addMessage('system', 'Chat session started. Type a message to begin.');
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: any) {
      setError(err.message || 'Failed to start chat');
    } finally {
      setIsCreatingChat(false);
    }
  };

  const addMessage = (role: ChatMessage['role'], content: string) => {
    setMessages(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      timestamp: new Date(),
    }]);
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || !chatId || isSending || chatEnded) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    addMessage('user', userMessage);
    setIsSending(true);

    try {
      const token = getToken();
      if (!token) {
        addMessage('system', 'Authentication expired. Please refresh.');
        return;
      }

      const response = await fetch(`/api/partner/retell-chat-agents/${agentId}/test/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, content: userMessage }),
      });

      const data = await response.json();

      if (!response.ok) {
        addMessage('system', `Error: ${data.error || 'Failed to send message'}`);
        return;
      }

      if (data.messages && data.messages.length > 0) {
        for (const msg of data.messages) {
          addMessage('agent', msg.content);
        }
      }

      if (data.chatStatus === 'ended') {
        setChatEnded(true);
        addMessage('system', 'Chat session has ended.');
      }
    } catch (err: any) {
      addMessage('system', `Error: ${err.message || 'Failed to send message'}`);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClose = () => {
    setChatId(null);
    setMessages([]);
    setInputValue('');
    setError(null);
    setChatEnded(false);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-2xl h-[80vh] bg-gray-900 rounded-xl shadow-xl border border-gray-800 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <FiMessageCircle className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-white">Test Chat Agent</Dialog.Title>
                      <p className="text-sm text-gray-400">{agentName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {chatId && (
                      <button
                        onClick={startNewChat}
                        disabled={isCreatingChat}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                      >
                        <FiRefreshCw className={`w-3.5 h-3.5 ${isCreatingChat ? 'animate-spin' : ''}`} />
                        New Chat
                      </button>
                    )}
                    <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
                      <FiX className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {error ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                        <FiAlertTriangle className="w-8 h-8 text-red-400" />
                      </div>
                      <p className="text-red-400 text-center max-w-sm">{error}</p>
                      <button onClick={startNewChat} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
                        Try Again
                      </button>
                    </div>
                  ) : isCreatingChat ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <FiLoader className="w-8 h-8 text-emerald-400 animate-spin" />
                      <p className="text-gray-400">Creating chat session...</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                            msg.role === 'user'
                              ? 'bg-emerald-600 text-white rounded-br-sm'
                              : msg.role === 'agent'
                              ? 'bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-sm'
                              : 'bg-gray-800/50 text-gray-500 text-xs italic text-center w-full rounded-lg'
                          }`}>
                            {msg.role === 'agent' && (
                              <div className="text-[10px] text-emerald-400 font-medium mb-1">Agent</div>
                            )}
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          </div>
                        </div>
                      ))}
                      {isSending && (
                        <div className="flex justify-start">
                          <div className="bg-gray-800 border border-gray-700 rounded-xl rounded-bl-sm px-4 py-3">
                            <div className="flex gap-1.5">
                              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-gray-800">
                  {chatEnded ? (
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-sm text-gray-500">Chat ended</span>
                      <button onClick={startNewChat} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
                        Start New Chat
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={chatId ? 'Type a message...' : 'Waiting for chat session...'}
                        disabled={!chatId || isSending}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50 transition-colors"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!inputValue.trim() || !chatId || isSending}
                        className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl transition-colors"
                      >
                        <FiSend className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ChatAgentTestModal;

