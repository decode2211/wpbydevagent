import React, { useEffect, useState, useRef } from "react";
import apiClient from "../api/client";
import { FileText, Download, Image as ImageIcon, CheckCircle, Clock, AlertCircle } from "lucide-react";

export default function ChatThread({ activeSessionId, sessionStatus }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

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
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [activeSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!activeSessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0F0F0F]">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-4 opacity-50">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p className="text-sm text-[#555]">Select a conversation to begin</p>
      </div>
    );
  }

  // Determine status for header. In real app, we'd fetch the session details or pass it down. 
  // We'll mock a generic status for now based on if it's open.
  const activeStatus = sessionStatus || "AGENT_RESPONDING";
  
  const renderStatusBadge = (status) => {
    let bg = "bg-[#2A2A2A] text-[#888]";
    let icon = <Clock className="w-3 h-3" />;
    
    if (status === "RESOLVED") {
      bg = "bg-[#00D4AA]/10 text-[#00D4AA]";
      icon = <CheckCircle className="w-3 h-3" />;
    } else if (status === "AGENT_RESPONDING") {
      bg = "bg-[#F59E0B]/10 text-[#F59E0B]";
      icon = <Clock className="w-3 h-3" />;
    } else if (status === "NEEDS_HUMAN") {
      bg = "bg-[#FF4757]/10 text-[#FF4757] animate-pulse";
      icon = <AlertCircle className="w-3 h-3" />;
    }

    return (
      <span className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold tracking-wide uppercase ${bg}`}>
        {icon}
        {status.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0F0F0F] relative">
      {/* Thread Header */}
      <div className="h-[60px] flex items-center justify-between px-6 border-b border-[#1A1A1A] bg-[#0F0F0F] shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="font-semibold text-[15px] text-[#F5F5F5] tracking-wide">
            {activeSessionId.split("_").pop()}
          </div>
          {renderStatusBadge(activeStatus)}
        </div>
        <button className="px-3 py-1.5 rounded border border-[#2A2A2A] text-[#888] hover:text-[#F5F5F5] hover:bg-[#1A1A1A] text-xs font-medium transition-all flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" />
          Mark Resolved
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#555] text-xs">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#555] text-xs">
            No messages logged for this session.
          </div>
        ) : (
          messages.map((msg, index) => {
            const isInbound = msg.direction === "inbound";

            if (msg.message_type === "typing") {
              return (
                <div key={msg.id || index} className="flex justify-start my-2">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1 p-2 rounded-2xl bg-[#1A1A1A]">
                      <div className="w-1.5 h-1.5 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-[#555] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-[10px] text-[#555]">AI is responding...</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id || index}
                className={`flex flex-col w-full ${isInbound ? "items-start" : "items-end"} animate-fade-in`}
              >
                <div
                  className={`max-w-[70%] px-4 py-3 flex flex-col gap-2 ${
                    isInbound
                      ? "bg-[#1F1F1F] text-[#F5F5F5] rounded-[0_16px_16px_16px]"
                      : "bg-[#2D1F5E] text-[#F5F5F5] rounded-[16px_0_16px_16px] border-l-2 border-l-[#7C5CFC]"
                  }`}
                  style={!isInbound ? { boxShadow: "inset 2px 0 10px rgba(124, 92, 252, 0.15)" } : {}}
                >
                  {msg.message_type === "text" && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  )}

                  {msg.message_type === "image" && (
                    <div className="flex flex-col gap-2">
                      {msg.media_url ? (
                        <div className="rounded overflow-hidden bg-[#141414] border border-[#2A2A2A] max-w-[280px]">
                          <img
                            src={msg.media_url}
                            alt="Attachment"
                            className="w-full h-auto object-cover max-h-56"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?auto=format&fit=crop&w=400&q=80";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-[#888] bg-[#141414] p-2 rounded">
                          <ImageIcon className="w-4 h-4" />
                          <span>Image attached</span>
                        </div>
                      )}
                      {msg.content && (
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      )}
                    </div>
                  )}

                  {msg.message_type === "document" && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-4 p-3 bg-[#1A1A1A] rounded border border-[#2A2A2A]">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-[#888]" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate max-w-[150px] text-[#F5F5F5]">
                              {msg.content || "document.pdf"}
                            </span>
                          </div>
                        </div>
                        {msg.media_url ? (
                          <a
                            href={msg.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#00D4AA] text-xs font-semibold hover:underline"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-[#00D4AA] text-xs font-semibold cursor-pointer hover:underline">Download</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Timestamp */}
                <div className="mt-1.5">
                  <span className="text-[10px] text-[#555] font-medium">
                    {formatTime(msg.timestamp)}
                  </span>
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
