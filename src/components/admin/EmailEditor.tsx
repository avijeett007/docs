'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Recipient } from '@/lib/emailCampaigns';

interface EmailEditorProps {
  initialContent?: string;
  onContentChange: (content: string) => void;
  recipients?: Recipient[];
  onGenerateWithAI?: (prompt: string) => Promise<string>;
}

const EmailEditor: React.FC<EmailEditorProps> = ({
  initialContent = '',
  onContentChange,
  recipients = [],
  onGenerateWithAI
}) => {
  const [content, setContent] = useState(initialContent);
  const [showVariableMenu, setShowVariableMenu] = useState(false);
  const [variableMenuPosition, setVariableMenuPosition] = useState({ top: 0, left: 0 });
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialContent && initialContent !== content) {
      setContent(initialContent);
    }
  }, [initialContent]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    onContentChange(newContent);
  };

  const insertVariable = (variable: string) => {
    if (!editorRef.current) return;

    const cursorPosition = editorRef.current.selectionStart;
    const textBeforeCursor = content.substring(0, cursorPosition);
    const textAfterCursor = content.substring(cursorPosition);
    
    const newContent = `${textBeforeCursor}{${variable}}${textAfterCursor}`;
    setContent(newContent);
    onContentChange(newContent);
    
    // Close the variable menu
    setShowVariableMenu(false);
    
    // Set focus back to editor and place cursor after the inserted variable
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
        const newCursorPosition = cursorPosition + variable.length + 2; // +2 for the braces {}
        editorRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 0);
  };

  const handleShowVariableMenu = (e: React.MouseEvent) => {
    // Position the menu near the cursor
    setVariableMenuPosition({
      top: e.clientY,
      left: e.clientX
    });
    setShowVariableMenu(true);
  };

  const handleGenerateWithAI = async () => {
    if (!onGenerateWithAI || !aiPrompt) return;
    
    setIsGeneratingAI(true);
    try {
      const generatedContent = await onGenerateWithAI(aiPrompt);
      setContent(generatedContent);
      onContentChange(generatedContent);
      setShowAIPrompt(false);
      setAiPrompt('');
    } catch (error) {
      console.error('Error generating content with AI:', error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="email-editor-container">
      <div className="email-editor-toolbar">
        <button 
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={handleShowVariableMenu}
        >
          Insert Variable
        </button>
        <button 
          type="button"
          className="btn btn-sm btn-outline-primary ml-2"
          onClick={() => setShowAIPrompt(true)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-robot" viewBox="0 0 16 16">
            <path d="M6 12.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5M3 8.062C3 6.76 4.235 5.765 5.53 5.886a26.6 26.6 0 0 0 4.94 0C11.765 5.765 13 6.76 13 8.062v1.157a.93.93 0 0 1-.765.935c-.845.147-2.34.346-4.235.346s-3.39-.2-4.235-.346A.93.93 0 0 1 3 9.219zm4.542-.827a.25.25 0 0 0-.217.068l-.92.9a24.8 24.8 0 0 1-1.871-.183.25.25 0 0 0-.068.495c.55.076 1.232.149 2.02.193a.25.25 0 0 0 .189-.071l.754-.736.847 1.71a.25.25 0 0 0 .404.062l.932-.97a25 25 0 0 0 1.922-.188.25.25 0 0 0-.068-.495c-.538.074-1.207.145-1.98.189a.25.25 0 0 0-.166.076l-.754.785-.842-1.7a.25.25 0 0 0-.182-.135"/>
            <path d="M8.5 1.866a1 1 0 1 0-1 0V3h-2A4.5 4.5 0 0 0 1 7.5V8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1v-.5A4.5 4.5 0 0 0 10.5 3h-2zM2 7.5A3.5 3.5 0 0 1 5.5 4h5A3.5 3.5 0 0 1 14 7.5V8H2zm9 6h2a1 1 0 0 0 1-1v-1H2v1a1 1 0 0 0 1 1h2z"/>
          </svg> Write with AI
        </button>
      </div>
      
      <textarea
        ref={editorRef}
        className="email-editor-textarea"
        value={content}
        onChange={handleContentChange}
        rows={15}
        placeholder="Write your email content here. You can insert variables like {contact.name} or {contact.email}."
      />
      
      {showVariableMenu && (
        <div 
          className="variable-menu"
          style={{
            position: 'absolute',
            top: `${variableMenuPosition.top}px`,
            left: `${variableMenuPosition.left}px`,
            zIndex: 1000,
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '0.375rem',
            padding: '0.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div className="variable-menu-header">
            <strong>Insert Variable</strong>
            <button 
              type="button" 
              className="close-btn"
              onClick={() => setShowVariableMenu(false)}
            >
              &times;
            </button>
          </div>
          <div className="variable-menu-items">
            <button onClick={() => insertVariable('contact.name')}>Contact Name</button>
            <button onClick={() => insertVariable('contact.email')}>Contact Email</button>
            <button onClick={() => insertVariable('contact.businessName')}>Business Name</button>
            {/* Add more variables as needed */}
          </div>
        </div>
      )}
      
      {showAIPrompt && (
        <div className="ai-prompt-modal">
          <div className="ai-prompt-content">
            <div className="ai-prompt-header">
              <h3>Generate Email with AI</h3>
              <button 
                type="button" 
                className="close-btn"
                onClick={() => setShowAIPrompt(false)}
              >
                &times;
              </button>
            </div>
            <div className="ai-prompt-body">
              <p>Describe what you want in your email:</p>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={4}
                placeholder="E.g., Write an email announcing our new feature that helps users track their progress..."
              />
            </div>
            <div className="ai-prompt-footer">
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAIPrompt(false)}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-primary ml-2"
                onClick={handleGenerateWithAI}
                disabled={isGeneratingAI || !aiPrompt}
              >
                {isGeneratingAI ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        .email-editor-container {
          position: relative;
          width: 100%;
        }
        
        .email-editor-toolbar {
          display: flex;
          padding: 0.5rem 0;
          margin-bottom: 0.5rem;
        }
        
        .email-editor-textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          background-color: #111827;
          color: #f9fafb;
          font-family: inherit;
          font-size: 0.875rem;
          line-height: 1.5;
          resize: vertical;
        }
        
        .variable-menu-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #374151;
        }
        
        .variable-menu-items {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        
        .variable-menu-items button {
          background: none;
          border: none;
          text-align: left;
          padding: 0.375rem 0.5rem;
          color: #f9fafb;
          border-radius: 0.25rem;
          cursor: pointer;
        }
        
        .variable-menu-items button:hover {
          background-color: #374151;
        }
        
        .close-btn {
          background: none;
          border: none;
          font-size: 1.25rem;
          line-height: 1;
          padding: 0;
          color: #9ca3af;
          cursor: pointer;
        }
        
        .ai-prompt-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .ai-prompt-content {
          background-color: #1f2937;
          border-radius: 0.5rem;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }
        
        .ai-prompt-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid #374151;
        }
        
        .ai-prompt-header h3 {
          margin: 0;
          color: #f9fafb;
        }
        
        .ai-prompt-body {
          padding: 1rem;
        }
        
        .ai-prompt-body textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          background-color: #111827;
          color: #f9fafb;
          font-family: inherit;
          font-size: 0.875rem;
          line-height: 1.5;
          resize: vertical;
        }
        
        .ai-prompt-footer {
          display: flex;
          justify-content: flex-end;
          padding: 1rem;
          border-top: 1px solid #374151;
        }
        
        .btn {
          display: inline-flex;
          align-items: center;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-weight: 500;
          cursor: pointer;
        }
        
        .btn-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.875rem;
        }
        
        .btn-primary {
          background-color: #3b82f6;
          color: white;
          border: none;
        }
        
        .btn-secondary {
          background-color: transparent;
          color: #f9fafb;
          border: 1px solid #4b5563;
        }
        
        .btn-outline-primary {
          background-color: transparent;
          color: #3b82f6;
          border: 1px solid #3b82f6;
        }
        
        .btn-outline-secondary {
          background-color: transparent;
          color: #9ca3af;
          border: 1px solid #4b5563;
        }
        
        .ml-2 {
          margin-left: 0.5rem;
        }
      `}</style>
    </div>
  );
};

export default EmailEditor;
