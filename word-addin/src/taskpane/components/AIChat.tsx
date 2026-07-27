import React, { useState, useRef, useEffect } from 'react';
import { 
  makeStyles, 
  shorthands, 
  Button, 
  Spinner, 
  Text,
  Textarea,
  Avatar,
  Badge,
  tokens
} from '@fluentui/react-components';
import { SendRegular, DeleteRegular, AddRegular, BookOpenRegular } from '@fluentui/react-icons';
import { streamAIChat, ChatMessage } from '../services/api';
import { insertFormattedContent } from '../services/word';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('12px', '16px'),
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  chatArea: {
    flexGrow: 1,
    overflowY: 'auto',
    ...shorthands.padding('14px'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('14px'),
  },
  messageRow: {
    display: 'flex',
    ...shorthands.gap('10px'),
    maxWidth: '100%',
  },
  userRow: {
    flexDirection: 'row-reverse',
  },
  messageBubble: {
    ...shorthands.padding('12px', '14px'),
    ...shorthands.borderRadius('8px'),
    maxWidth: '88%',
    wordBreak: 'break-word',
    fontSize: '12.5px',
    lineHeight: '1.5',
    boxSizing: 'border-box',
  },
  userBubble: {
    backgroundColor: '#C9A84C',
    color: '#ffffff',
    borderBottomRightRadius: '0px',
    fontWeight: '500',
  },
  aiBubble: {
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    borderBottomLeftRadius: '0px',
    boxShadow: tokens.shadow2,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  inputArea: {
    ...shorthands.padding('12px'),
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('8px'),
  },
  inputControls: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  statusText: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
  heading: {
    fontWeight: '700',
    fontSize: '13.5px',
    color: '#1F2937',
    marginTop: '8px',
    marginBottom: '4px',
    paddingBottom: '2px',
    borderBottom: '1px solid #F0ECE1',
  },
  paragraph: {
    marginBottom: '4px',
    lineHeight: '1.5',
    textAlign: 'justify',
    color: '#374151',
  },
  citationChip: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: '#F9F5EC',
    color: '#C9A84C',
    border: '1px solid #C9A84C',
    ...shorthands.borderRadius('4px'),
    ...shorthands.padding('1px', '6px'),
    fontSize: '11px',
    fontWeight: '700',
    marginRight: '4px',
    marginLeft: '2px',
  },
  statuteChip: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    color: '#4F46E5',
    border: '1px solid #C7D2FE',
    ...shorthands.borderRadius('4px'),
    ...shorthands.padding('1px', '6px'),
    fontSize: '11px',
    fontWeight: '600',
    marginRight: '4px',
  },
  referencesBox: {
    marginTop: '8px',
    ...shorthands.padding('10px', '12px'),
    backgroundColor: '#FAF9F6',
    ...shorthands.borderRadius('6px'),
    border: '1px solid #E8E5DE',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  refItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontSize: '11px',
    lineHeight: '1.4',
  }
});

interface LocalChatMessage extends ChatMessage {
  id: string;
  isStreaming?: boolean;
  status?: string;
}

// Clean AI message text and extract JSON references block
function sanitizeAIMessage(text: string): { cleanText: string; references?: any } {
  if (!text) return { cleanText: '' };

  let clean = text;

  // 1. Extract and strip ```references ... ``` blocks
  let references: any = null;
  const refMatch = clean.match(/```references\s*([\s\S]*?)\s*```/);
  if (refMatch) {
    try {
      references = JSON.parse(refMatch[1]);
    } catch (e) {}
    clean = clean.replace(/```references\s*[\s\S]*?```/g, '');
  }

  // 2. Remove duplicate motto repetitions
  const motto = "Knowledge of Law is Power — and I'm Your Power Source. I am Al Wakeelo — Your Digital Lawyer, Always on Duty.";
  const firstIdx = clean.indexOf(motto);
  if (firstIdx !== -1) {
    const before = clean.substring(0, firstIdx + motto.length);
    const after = clean.substring(firstIdx + motto.length).split(motto).join('');
    clean = before + after;
  }

  // 3. Fix bullet line breaks (e.g. "•\nSection" -> "• Section")
  clean = clean.replace(/•\s*\n+/g, '• ');

  return { cleanText: clean.trim(), references };
}

// Structured Legal Formatting Component
const FormattedMessageText: React.FC<{ content: string }> = ({ content }) => {
  const styles = useStyles();

  const { cleanText, references } = sanitizeAIMessage(content);
  if (!cleanText && !references) return null;

  const blocks = cleanText.split(/\n+/);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // 1. Headers (### or ##)
        if (trimmed.startsWith('#')) {
          const headerText = trimmed.replace(/^#{1,6}\s*/, '');
          return (
            <div key={i} className={styles.heading}>
              ⚖️ {headerText}
            </div>
          );
        }

        // 2. Bullet points (* or - or •)
        if (/^[\*\-\•]\s+/.test(trimmed)) {
          const bulletText = trimmed.replace(/^[\*\-\•]\s+/, '');
          return (
            <div key={i} style={{ display: 'flex', gap: '6px', paddingLeft: '6px', marginBottom: '3px' }}>
              <span style={{ color: '#C9A84C', fontWeight: 'bold' }}>•</span>
              <span className={styles.paragraph}>{parseInlineFormatting(bulletText, styles)}</span>
            </div>
          );
        }

        // 3. Numbered lists (1. 2.)
        if (/^\d+\.\s+/.test(trimmed)) {
          const numMatch = trimmed.match(/^(\d+\.)\s+(.*)/);
          if (numMatch) {
            return (
              <div key={i} style={{ display: 'flex', gap: '6px', paddingLeft: '6px', marginBottom: '3px' }}>
                <span style={{ color: '#C9A84C', fontWeight: '700', minWidth: '16px' }}>{numMatch[1]}</span>
                <span className={styles.paragraph}>{parseInlineFormatting(numMatch[2], styles)}</span>
              </div>
            );
          }
        }

        // 4. Standard Paragraph
        return (
          <div key={i} className={styles.paragraph}>
            {parseInlineFormatting(trimmed, styles)}
          </div>
        );
      })}

      {/* Render Structured References Box */}
      {references && (references.laws?.length > 0 || references.judgments?.length > 0) && (
        <div className={styles.referencesBox}>
          <Text weight="semibold" size={100} style={{ color: '#C9A84C', letterSpacing: '0.5px' }}>
            📜 CITED LEGAL PRECEDENTS & STATUTES
          </Text>
          {references.judgments?.map((j: any, idx: number) => (
            <div key={`j-${idx}`} className={styles.refItem}>
              <span className={styles.citationChip}>📜 {j.citation}</span>
              <span style={{ fontSize: '11px', color: '#4B5563' }}>{j.court || 'Court Judgment'} — {j.description}</span>
            </div>
          ))}
          {references.laws?.map((l: any, idx: number) => (
            <div key={`l-${idx}`} className={styles.refItem}>
              <span className={styles.statuteChip}>⚖️ {l.name} ({l.section})</span>
              {l.description && <span style={{ fontSize: '11px', color: '#4B5563' }}>{l.description}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Inline Formatting: **bold**, citations [1988 SCMR 824] or (2019 YLR 2246)
function parseInlineFormatting(text: string, styles: any): React.ReactNode {
  // Regex to match **[citation]** or **bold** or standalone citations
  const parts = text.split(/(\*\*(?:\[.*?\]|.*?)\*\*|\[\d{4}\s+[A-Za-z]+\s+\d+\]|\(\d{4}\s+[A-Za-z]+\s+\d+\)|\b\d{4}\s+(?:SCMR|PLD|YLR|MLD|CLC|PCrLJ|CLD|PLC|PLJ|NLR|PTD)\s+\d+\b)/gi);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Check if bold string wraps a citation e.g. **[1988 SCMR 824]**
    const innerCitation = part.match(/\*\*\[(\d{4}\s+[A-Za-z]+\s+\d+)\]\*\*/i) || part.match(/\*\*(\d{4}\s+[A-Za-z]+\s+\d+)\*\*/i);
    if (innerCitation) {
      return (
        <span key={idx} className={styles.citationChip}>
          📜 {innerCitation[1].toUpperCase()}
        </span>
      );
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} style={{ color: '#1F2937' }}>{part.slice(2, -2)}</strong>;
    }

    if (/^[\[\(]?\d{4}\s+[A-Za-z]+\s+\d+[\]\)]?$/i.test(part) || /^\d{4}\s+(?:SCMR|PLD|YLR|MLD|CLC|PCrLJ|CLD|PLC|PLJ|NLR|PTD)\s+\d+$/i.test(part)) {
      const citeClean = part.replace(/[\[\]\(\)]/g, '').toUpperCase();
      return (
        <span key={idx} className={styles.citationChip}>
          📜 {citeClean}
        </span>
      );
    }

    return part;
  });
}

const AIChat: React.FC = () => {
  const styles = useStyles();
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setIsProcessing(true);

    const userMsg: LocalChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
    };

    const aiMsgId = (Date.now() + 1).toString();
    const initialAiMsg: LocalChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, initialAiMsg]);

    try {
      const stream = streamAIChat(userMessage, 'al-wakeelo');
      
      for await (const chunk of stream) {
        setMessages(prev => prev.map(msg => {
          if (msg.id !== aiMsgId) return msg;

          let newContent = msg.content;
          let newStatus = msg.status;

          if (chunk.type === 'text') {
            newContent += chunk.text;
            newStatus = undefined;
          } else if (chunk.type === 'status') {
            newStatus = chunk.query ? `Searching court records for: ${chunk.query}...` : 'Searching Pakistani legal database...';
          } else if (chunk.type === 'thinking') {
            newStatus = 'Analyzing legal statutes & precedents...';
          } else if (chunk.type === 'done') {
            return { ...msg, content: newContent, isStreaming: false, status: undefined };
          }

          return { ...msg, content: newContent, status: newStatus };
        }));
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === aiMsgId 
          ? { ...msg, content: msg.content || 'Sorry, an error occurred while communicating with the AI service.', isStreaming: false, status: undefined }
          : msg
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    if (!isProcessing) setMessages([]);
  };

  const handleInsert = async (content: string) => {
    try {
      const { cleanText } = sanitizeAIMessage(content);
      await insertFormattedContent(cleanText);
    } catch (e) {
      console.error('Error inserting content:', e);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text weight="semibold" size={300}>AI Legal Assistant</Text>
        <Button 
          icon={<DeleteRegular />} 
          appearance="subtle" 
          onClick={clearChat}
          disabled={isProcessing}
          title="New Conversation"
        />
      </div>

      <div className={styles.chatArea}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: tokens.colorNeutralForeground3, marginTop: '24px', fontSize: '13px', lineHeight: '1.5' }}>
            ⚖️ Ask legal research questions, request statute explanations, or cite case precedents.
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`${styles.messageRow} ${msg.role === 'user' ? styles.userRow : ''}`}>
            {msg.role === 'assistant' && (
              <Avatar name="AL WAKEELO" color="brand" style={{ backgroundColor: '#C9A84C' }} />
            )}

            <div className={`${styles.messageBubble} ${msg.role === 'user' ? styles.userBubble : styles.aiBubble}`}>
              {msg.role === 'user' ? (
                <div>{msg.content}</div>
              ) : (
                <>
                  <FormattedMessageText content={msg.content} />
                  
                  {msg.status && (
                    <div className={styles.statusText}>
                      <Spinner size="tiny" /> {msg.status}
                    </div>
                  )}

                  {msg.content && !msg.isStreaming && (
                    <Button 
                      appearance="subtle"
                      size="small"
                      icon={<AddRegular />}
                      onClick={() => handleInsert(msg.content)}
                      style={{ alignSelf: 'flex-end', marginTop: '4px', color: '#C9A84C' }}
                    >
                      Insert into Word
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className={styles.inputArea}>
        <Textarea 
          placeholder="Ask AI Legal Assistant (e.g. Bail grounds under 497 CrPC)..."
          value={input}
          onChange={(e, d) => setInput(d.value)}
          onKeyDown={handleKeyDown}
          resize="none"
          style={{ minHeight: '60px' }}
        />
        <div className={styles.inputControls}>
          <Button 
            appearance="primary"
            icon={<SendRegular />}
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            style={{ backgroundColor: '#C9A84C' }}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
