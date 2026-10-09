import React, { useState } from 'react';
import { X, Sparkles, Send, Bot, User, ArrowRight } from 'lucide-react';
import { askCopilot } from '../services/api';

interface CopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CopilotModal: React.FC<CopilotModalProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: "Hello! I am your Life-Loop Operations Copilot. I analyze real-time inventory, solver outputs, expiry timelines, and emergency surge scenarios. How can I assist your logistics decision-making?",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const quickPrompts = [
    "Which facilities have the highest projected shortage risk?",
    "Why did the optimizer recommend this transfer?",
    "Which batches are approaching expiry?",
    "Compare the baseline with the latest optimized plan."
  ];

  const handleSend = async (queryText?: string) => {
    const q = queryText || inputVal;
    if (!q.trim() || loading) return;

    const userMsg = {
      sender: 'user' as const,
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setLoading(true);

    try {
      const res = await askCopilot(q);
      const botMsg = {
        sender: 'bot' as const,
        text: res.answer,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: `Error connecting to operations assistant: ${e.message}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="p-4 bg-navy-900 text-white flex items-center justify-between border-b border-navy-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-teal-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide">AI Operations Copilot</h2>
              <p className="text-[11px] text-teal-300">Live Decision Support & Explainability Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Prompts */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Suggested Queries</span>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                className="text-left text-xs bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200 hover:border-teal-300 px-2.5 py-1 rounded-md transition flex items-center space-x-1"
              >
                <span>{prompt}</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start space-x-2.5 ${m.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                  m.sender === 'user' ? 'bg-navy-800 text-white' : 'bg-teal-600 text-white shadow-sm'
                }`}
              >
                {m.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              <div
                className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-xs shadow-sm ${
                  m.sender === 'user'
                    ? 'bg-navy-900 text-white rounded-tr-none'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none whitespace-pre-line leading-relaxed'
                }`}
              >
                <p>{m.text}</p>
                <span className={`text-[10px] block mt-1 ${m.sender === 'user' ? 'text-slate-400 text-right' : 'text-slate-400'}`}>
                  {m.time}
                </span>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center space-x-2 text-xs text-slate-500 p-2">
              <Sparkles className="w-4 h-4 animate-spin text-teal-600" />
              <span>Analyzing supply chain data...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
          <input
            type="text"
            placeholder="Ask about inventory, rationale, transfers, risks..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !inputVal.trim()}
            className="p-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 transition shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
