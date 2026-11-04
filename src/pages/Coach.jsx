import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Bot, User, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Knowledge base + LLM call live server-side in the `coachAnswer` backend function
// (topic-selective retrieval + cheaper model) to keep token usage low at scale.

const STARTER_QUESTIONS = [
  'How much does the Alpha7 cost me as an installer?',
  'What is the installer welcome programme?',
  'What DIP switch settings do I need for 32A?',
  'How do I set up dynamic load balancing?',
  'What does a red LED mean?',
  'Do I need an earth rod?',
  'What cable size do I need?',
  'How do I wire twin load sharing?',
];

export default function Coach() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hi! I'm your FastAmps Alpha7 technical coach. Ask me anything about installation, wiring, DIP switch settings, LED faults, optional features, or the mobile app. I'm here to help you get every job done right.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    const question = text || input.trim();
    if (!question || loading) return;
    setInput('');
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const res = await base44.functions.invoke('coachAnswer', { question, history });
      const reply = res?.data?.answer || 'Sorry, I could not generate an answer right now.';
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[800px]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Zap className="w-6 h-6 text-primary" />
          Alpha7 Technical Coach
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Ask anything about the Alpha7 — installation, wiring, faults, features.</p>
      </div>

      {/* Chat window */}
      <div className="flex-1 overflow-y-auto bg-card border border-border rounded-xl p-4 space-y-4 mb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${m.role === 'user' ? 'bg-primary' : 'bg-secondary'}`}>
              {m.role === 'user' ? <User className="w-4 h-4 text-primary-foreground" /> : <Bot className="w-4 h-4 text-accent" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary text-foreground rounded-tl-sm'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-accent" />
            </div>
            <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Starter questions */}
      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {STARTER_QUESTIONS.map((q) => (
            <button key={q} onClick={() => send(q)}
              className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Ask about installation, wiring, LED faults, DIP switches…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading}
        />
        <Button onClick={() => send()} disabled={loading || !input.trim()} size="icon" className="rounded-xl w-12 h-12 flex-shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}