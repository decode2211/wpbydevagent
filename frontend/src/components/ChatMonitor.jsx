import React, { useEffect, useState } from "react";
import apiClient from "../api/client";
import { Search, Inbox } from "lucide-react";

export default function ChatMonitor({ activeTenantId, activeSessionId, setActiveSessionId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTenantId) return;

    async function fetchSessions() {
      try {
        const response = await apiClient.get(`/api/tenants/${activeTenantId}/sessions`);
        setSessions(response.data);
      } catch (err) {
        console.error("Error fetching sessions:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [activeTenantId]);

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    
    if (diffMins < 60) return `${diffMins || 1}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const renderStatusBadge = (status) => {
    let bg = "bg-[#2A2A2A] text-[#888]";
    let dot = "bg-[#555]";
    
    if (status === "RESOLVED") {
      bg = "bg-[#00D4AA]/10 text-[#00D4AA]";
      dot = "bg-[#00D4AA]";
    } else if (status === "AGENT_RESPONDING") {
      bg = "bg-[#F59E0B]/10 text-[#F59E0B]";
      dot = "bg-[#F59E0B]";
    } else if (status === "NEEDS_HUMAN") {
      bg = "bg-[#FF4757]/10 text-[#FF4757] animate-border-pulse border border-[#FF4757]/30";
      dot = "bg-[#FF4757] animate-pulse";
    }

    return (
      <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase ${bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
        {status.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full border-t border-[#222]">
      <div className="p-4 border-b border-[#222]">
        <div className="flex items-center bg-[#0F0F0F] rounded border border-[#2A2A2A] px-3 py-1.5 focus-within:border-[#555] transition-colors">
          <Search className="w-3.5 h-3.5 text-[#555]" />
          <input 
            type="text" 
            placeholder="Search conversations..." 
            className="bg-transparent border-none outline-none text-xs text-[#F5F5F5] ml-2 w-full placeholder-[#555]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && sessions.length === 0 ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex items-start gap-3 p-3 rounded bg-[#1A1A1A]">
                <div className="w-full flex flex-col gap-2">
                  <div className="h-3 bg-[#2A2A2A] rounded w-24"></div>
                  <div className="h-2 bg-[#2A2A2A] rounded w-full"></div>
                  <div className="h-4 bg-[#2A2A2A] rounded w-16 mt-1"></div>
                </div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="w-8 h-8 text-[#2A2A2A] mb-3" />
            <div className="text-xs text-[#888]">No active conversations</div>
          </div>
        ) : (
          sessions.map((sess) => {
            const isSelected = sess.session_id === activeSessionId;
            const needsHuman = sess.status === "NEEDS_HUMAN";
            const isUnread = sess.status === "NEEDS_HUMAN" || sess.status === "WAITING_FOR_BOT";

            return (
              <button
                key={sess.session_id}
                onClick={() => setActiveSessionId(sess.session_id)}
                className={`w-full flex flex-col p-3 rounded border text-left transition-colors relative ${
                  isSelected
                    ? "bg-[#1E1A2E] border-[#1E1A2E] border-l-[3px] border-l-[#7C5CFC]"
                    : "bg-transparent border-transparent hover:bg-[#1A1A1A] border-l-[3px] border-l-transparent hover:border-[#1A1A1A]"
                }`}
              >
                {isUnread && !isSelected && (
                  <span className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-[#7C5CFC]"></span>
                )}
                
                <div className="flex justify-between items-start w-full mb-1 pl-3">
                  <div className={`font-semibold text-sm tracking-wide truncate ${isSelected ? 'text-[#F5F5F5]' : 'text-[#F5F5F5]'}`}>
                    {sess.customer_phone.substring(0, 15)}
                  </div>
                  <div className="text-[10px] text-[#555] shrink-0">
                    {formatTime(sess.last_message_time)}
                  </div>
                </div>

                <div className="text-xs text-[#888] line-clamp-1 mb-2.5 w-full pl-3 pr-2">
                  {sess.last_message_content || "..."}
                </div>

                <div className="flex items-center justify-between w-full pl-3">
                  {renderStatusBadge(sess.status)}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
