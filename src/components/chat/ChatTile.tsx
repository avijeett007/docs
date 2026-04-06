import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatMessageInput } from "@/components/chat/ChatMessageInput";
import { useEffect, useRef } from "react";
import { AccentColor } from "@/types/theme";

export type ChatMessageType = {
  name: string;
  message: string;
  isSelf: boolean;
  timestamp: number;
  /** Optional metadata for the message */
  metadata?: {
    type?: 'text' | 'system' | 'error';
    error?: string;
  };
};

type ChatTileProps = {
  messages: ChatMessageType[];
  accentColor: AccentColor;
  onSend: (message: string) => void;
  /** Optional loading state */
  isLoading?: boolean;
};

export const ChatTile = ({ 
  messages, 
  accentColor, 
  onSend,
  isLoading = false 
}: ChatTileProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={containerRef} className="flex-grow overflow-y-auto px-4 py-2">
        {messages.map((message, index) => (
          <ChatMessage
            key={`${message.timestamp}-${index}`}
            name={message.name}
            message={message.message}
            accentColor={accentColor}
            isSelf={message.isSelf}
          />
        ))}
      </div>
      <ChatMessageInput
        placeholder="Type your message here..."
        accentColor={accentColor}
        onSend={onSend}
      />
    </div>
  );
};