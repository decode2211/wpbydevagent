import React, { useEffect, useState, useRef } from "react";
import apiClient from "../api/client";
import { Send, FileText, Download, Image as ImageIcon, Bot, User, HelpCircle } from "lucide-react";

/**
 * ChatThread Component
 * Renders a WhatsApp-styled viewport showing the conversation history logs.
 * Polls the backend every 3 seconds if there's an active thread.
 * 
 * Props:
 * - activeSessionId: string
 * - sessionStatus: string (optional, can be passed to check AGENT_RESPONDING)
 */
export default function ChatThread({ activeSessionId, sessionStatus }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of conversation helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!activeSessionId) return;

    async function fetchMessages() {
      try {
        const response = await apiClient.get(`/api/sessions/${activeSessionId}/messages`);
        setMessages(response.data);
      } catch (err) {
        console.error("Error fetching message logs:", err);
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    fetchMessages();

    // Auto-refresh chat thread history every 3 seconds
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [activeSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Format timestamp helper
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!activeSessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-950/20">
        <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4 border border-slate-800">
          <Bot className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-sm font-semibold text-slate-300">No Chat Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-[280px] text-center leading-relaxed">
          Select a customer conversation from the side column to review the AI agent history logs.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b141a] relative">
      {/* Thread Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#111b21] z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm tracking-wider">
            {activeSessionId.split("_").pop()?.substring(0, 2) || "U"}
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-200 tracking-wide">
              {activeSessionId.split("_").pop()}
            </div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1.5 font-medium mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync Active
            </div>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-whatsapp-darkchatbg bg-opacity-30">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-xs">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-xs">
            No messages logged for this session.
          </div>
        ) : (
          messages.map((msg, index) => {
            const isInbound = msg.direction === "inbound";

            // If it is typing type divider
            if (msg.message_type === "typing") {
              return (
                <div key={msg.id || index} className="flex justify-center my-2">
                  <span className="bg-[#182229] border border-slate-800 text-[10px] text-slate-400 px-3 py-1 rounded-full flex items-center gap-1">
                    <Bot className="w-3 h-3 text-indigo-400" />
                    🤖 Bot was typing...
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id || index}
                className={`flex w-full ${isInbound ? "justify-start" : "justify-end"} animate-fade-in`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-md flex flex-col gap-1.5 ${
                    isInbound
                      ? "bg-[#202c33] text-slate-200 rounded-tl-none border border-[#2b3942]/40"
                      : "bg-[#005c4b] text-white rounded-tr-none border border-[#006e5a]/40"
                  }`}
                >
                  {/* Message Sender Title */}
                  <div className="flex items-center gap-1 opacity-60 text-[9px] font-bold uppercase tracking-wider">
                    {isInbound ? (
                      <>
                        <User className="w-2.5 h-2.5" />
                        <span>Customer</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-2.5 h-2.5" />
                        <span>AI Assistant</span>
                      </>
                    )}
                  </div>

                  {/* Render content based on message type */}
                  {msg.message_type === "text" && (
                    <p className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
                      {msg.content}
                    </p>
                  )}

                  {msg.message_type === "image" && (
                    <div className="flex flex-col gap-2">
                      {msg.media_url ? (
                        <div className="rounded-lg overflow-hidden border border-black/10 bg-slate-950/20 max-w-[280px]">
                          <img
                            src={msg.media_url}
                            alt="WhatsApp Attachment"
                            className="w-full h-auto object-cover max-h-56 hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?auto=format&fit=crop&w=400&q=80"; // Fallback image error placeholder
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-slate-400 bg-black/15 p-2 rounded-lg">
                          <ImageIcon className="w-4 h-4 text-indigo-400" />
                          <span>📷 Attachment sent</span>
                        </div>
                      )}
                      {msg.content && (
                        <p className="text-xs leading-relaxed font-sans">{msg.content}</p>
                      )}
                    </div>
                  )}

                  {msg.message_type === "document" && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-4 p-3 bg-black/15 hover:bg-black/25 rounded-xl border border-white/5 transition-colors duration-200">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-red-600/20 text-red-500 border border-red-500/10 flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold truncate max-w-[150px]">
                              {msg.content || "document.pdf"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">PDF Document</span>
                          </div>
                        </div>
                        {msg.media_url && (
                          <a
                            href={msg.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
                            title="Download document file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timestamp & Info footer */}
                  <div className="flex justify-end items-center gap-1">
                    <span className="text-[9px] opacity-50 font-mono">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
