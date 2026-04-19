'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://hsm-management.onrender.com';
import { CleffAvatar } from './CleffAvatar';

interface PublicMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  cta?: 'book_demo' | null;
}

interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

interface PublicCleffChatProps {
  onBookDemo: () => void;
}

const WELCOME: PublicMessage = {
  id: 'welcome',
  sender: 'bot',
  text: "Hey there! 🎵 I'm Cleff — your musical guide to HSM. Ask me anything about our instruments, schedule, fees, or just how to get started!",
  cta: null,
};

const STARTER_CHIPS = [
  'What instruments do you teach?',
  'Is there a free trial class?',
  'What are the working hours?',
  'How much are the fees?',
];

export function PublicCleffChat({ onBookDemo }: PublicCleffChatProps) {
  const [isOpen, setIsOpen]       = useState(false);
  const [messages, setMessages]   = useState<PublicMessage[]>([WELCOME]);
  const [chips, setChips]         = useState<string[]>(STARTER_CHIPS);
  const [input, setInput]         = useState('');
  const [isTyping, setIsTyping]   = useState(false);
  const [history, setHistory]     = useState<HistoryEntry[]>([]);
  const [nudged, setNudged]               = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const nudgeTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  // Nudge after 20s of inactivity on landing page
  useEffect(() => {
    if (nudged || nudgeDismissed || isOpen) return;
    nudgeTimer.current = setTimeout(() => {
      setNudged(true);
    }, 20_000);
    return () => { if (nudgeTimer.current) clearTimeout(nudgeTimer.current); };
  }, [nudged, nudgeDismissed, isOpen]);

  // Auto-dismiss nudge badge after 6s
  useEffect(() => {
    if (!nudged || isOpen) return;
    nudgeDismissTimer.current = setTimeout(() => dismissNudge(), 6_000);
    return () => { if (nudgeDismissTimer.current) clearTimeout(nudgeDismissTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudged, isOpen]);

  const dismissNudge = () => {
    setNudged(false);
    setNudgeDismissed(true);
    if (nudgeDismissTimer.current) clearTimeout(nudgeDismissTimer.current);
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;
    const trimmed = text.trim();

    const userMsg: PublicMessage = { id: crypto.randomUUID(), sender: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setChips([]);
    setIsTyping(true);
    setInput('');

    const newHistory: HistoryEntry[] = [...history, { role: 'user', content: trimmed }];

    try {
      const res = await fetch(`${API_BASE_URL}/api/public/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const data = await res.json();

      const botMsg: PublicMessage = {
        id:     crypto.randomUUID(),
        sender: 'bot',
        text:   data.text || "I didn't quite catch that — could you rephrase?",
        cta:    data.cta ?? null,
      };

      setHistory([...newHistory, { role: 'assistant', content: data.text }]);
      setMessages(prev => [...prev, botMsg]);
      setChips(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), sender: 'bot',
        text: "Oops, something went off-key! Please try again.",
        cta: null,
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [history, isTyping]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const presentCount = messages.filter(m => m.sender === 'user').length;

  return (
    <>
      {/* Nudge badge */}
      {nudged && !isOpen && (
        <div
          style={{
            position: 'fixed', bottom: 82, right: 16, zIndex: 1001,
            background: '#1b1307', color: '#f3c13a',
            borderRadius: 12, padding: '8px 14px',
            fontSize: 13, fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            maxWidth: 220,
            animation: 'fadeSlideUp 0.35s ease',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}
        >
          <div onClick={() => setIsOpen(true)} style={{ cursor: 'pointer', flex: 1 }}>
            🎵 Book your free demo — no credit card needed!
            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>Chat with Cleff</div>
          </div>
          <button
            onClick={dismissNudge}
            type="button"
            style={{
              background: 'transparent', border: 'none',
              color: '#f3c13a', cursor: 'pointer',
              fontSize: 16, lineHeight: 1, padding: 0, opacity: 0.7,
              flexShrink: 0, marginTop: -2,
            }}
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 82, right: 16, zIndex: 1001,
          width: 'min(360px, calc(100vw - 16px))',
          height: 'min(520px, calc(100vh - 100px))',
          background: '#fff', borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'fadeSlideUp 0.25s ease',
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1b1307 0%, #2d2110 100%)',
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <CleffAvatar size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#f3c13a', letterSpacing: 0.4 }}>Cleff</div>
              <div style={{ fontSize: 11, color: '#f3c13a', opacity: 0.7, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#27ae60', display: 'inline-block' }} />
                Your musical guide to HSM
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              type="button"
              style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#f3c13a', lineHeight: 1, padding: 4 }}
              aria-label="Close"
            >×</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  {msg.sender === 'bot' && <div style={{ flexShrink: 0, marginTop: 2 }}><CleffAvatar size={24} /></div>}
                  <div style={{
                    background: msg.sender === 'user' ? '#1a6cf5' : '#f7f5f0',
                    color: msg.sender === 'user' ? '#fff' : '#1b1307',
                    borderRadius: msg.sender === 'user' ? '12px 0 12px 12px' : '0 12px 12px 12px',
                    padding: '9px 13px',
                    fontSize: 13, lineHeight: 1.5,
                    maxWidth: '82%', wordBreak: 'break-word',
                  }}>
                    {msg.text}
                  </div>
                </div>
                {msg.cta === 'book_demo' && (
                  <button
                    onClick={onBookDemo}
                    type="button"
                    style={{
                      marginTop: 6, marginLeft: 30,
                      background: 'linear-gradient(135deg, #ff904e, #f3c13a)',
                      color: '#1b1307', border: 'none', borderRadius: 20,
                      padding: '7px 16px', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,144,78,0.4)',
                    }}
                  >
                    Book Free Demo Class 🎵
                  </button>
                )}
              </div>
            ))}

            {isTyping && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}><CleffAvatar size={24} /></div>
                <div style={{ background: '#f7f5f0', borderRadius: '0 12px 12px 12px', padding: '10px 14px', display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#f3c13a',
                      display: 'inline-block',
                      animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Chips */}
          {chips.length > 0 && (
            <div style={{ padding: '4px 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0 }}>
              {chips.map(chip => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  disabled={isTyping}
                  type="button"
                  style={{
                    background: '#fff9e6', border: '1px solid #f3c13a',
                    borderRadius: 16, padding: '5px 12px',
                    fontSize: 12, color: '#1b1307', cursor: 'pointer',
                    opacity: isTyping ? 0.5 : 1,
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div style={{
            borderTop: '1px solid #f0ede6', padding: '8px 10px',
            display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={isTyping}
              placeholder="Ask about HSM…"
              type="text"
              style={{
                flex: 1, border: '1px solid #e5e0d5', borderRadius: 20,
                padding: '8px 14px', fontSize: 13, outline: 'none',
                background: '#fafaf8',
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isTyping || !input.trim()}
              type="button"
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: input.trim() ? '#ff904e' : '#e5e0d5',
                border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                transition: 'background 0.15s',
              }}
              aria-label="Send"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        type="button"
        style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 1001,
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #1b1307, #2d2110)',
          border: '2px solid #f3c13a',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          transition: 'transform 150ms ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        aria-label={isOpen ? 'Close chat' : 'Chat with Cleff'}
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="#f3c13a" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <>
            <CleffAvatar size={36} />
            {!nudged && presentCount === 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                width: 14, height: 14, borderRadius: '50%',
                background: '#27ae60', border: '2px solid #fff',
              }} />
            )}
            {nudged && !isOpen && !nudgeDismissed && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                width: 18, height: 18, borderRadius: '50%',
                background: '#ff904e', border: '2px solid #fff',
                fontSize: 10, fontWeight: 700, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>1</span>
            )}
          </>
        )}
      </button>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); }
          30%           { transform: translateY(-5px); }
        }
      `}</style>
    </>
  );
}
