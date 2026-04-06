import { useState, KeyboardEvent } from "react";
import { AccentColor } from "@/types/theme";

type ChatMessageInputProps = {
  placeholder: string;
  accentColor: AccentColor;
  onSend: (message: string) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Maximum length of the message */
  maxLength?: number;
};

export const ChatMessageInput = ({
  placeholder,
  accentColor,
  onSend,
  disabled = false,
  maxLength = 1000
}: ChatMessageInputProps) => {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled) {
      onSend(trimmedMessage);
      setMessage("");
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center border-t border-gray-200 p-4">
      <input
        className={`flex-grow px-4 py-2 border border-gray-300 rounded-l-lg 
          focus:outline-none focus:ring-2 focus:ring-${accentColor}-500
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        type="text"
        placeholder={disabled ? 'Chat is disabled' : placeholder}
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, maxLength))}
        onKeyPress={handleKeyPress}
        disabled={disabled}
        maxLength={maxLength}
        aria-label="Chat message input"
      />
      <button
        className={`px-4 py-2 bg-${accentColor}-500 text-white rounded-r-lg
          hover:bg-${accentColor}-600 transition-colors
          ${disabled || !message.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={handleSend}
        disabled={disabled || !message.trim()}
        aria-label="Send message"
      >
        Send
      </button>
    </div>
  );
};