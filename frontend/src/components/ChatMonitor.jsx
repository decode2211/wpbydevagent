import React, { useEffect, useState } from "react";
import apiClient from "../api/client";
import { MessageSquare, AlertCircle, CheckCircle, Clock } from "lucide-react";

/**
 * ChatMonitor Component
 * Displays a list of active conversation threads/sessions for the selected tenant.
 * Polls the backend every 5 seconds to get real-time status and message updates.
 * 
 * Props:
 * - activeTenantId: string
 * - activeSessionId: string
 * - setActiveSessionId: function
 */
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

    // Set up polling interval every 5 seconds for live status monitoring
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [activeTenantId]);

  // Format date helper
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Render status badge helper
  const renderStatusBadge = (status) => {
    let bg = "bg-slate-800 text-slate-400";
    let icon = <Clock className="w-3 h-3" />;
    
    if (status === "RESOLVED") {
      bg = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
      icon = <CheckCircle className="w-3 h-3" />;
    } else if (status === "AGENT_RESPONDING") {
      bg = "bg-amber-500/20 text-amber-400 border border-amber-500/30";
      icon = <Clock className="w-3 h-3" />;
    } else if (status === "NEEDS_HUMAN") {
      bg = "bg-red-500/20 text-red-400 border border-red-500/30";
      icon = <AlertCircle className="w-3 h-3" />;
    } else if (status === "ERROR") {
      bg = "bg-red-900/30 text-red-500 border border-red-900/50";
      icon = <AlertCircle className="w-3 h-3" />;
    }

    return (
      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${bg}`}>
        {icon}
        {status.replace("_", " ")}
      </span>
    );
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mb-2"></div>
        <div className="text-xs">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/35">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-300">Chats ({sessions.length})</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
            <MessageSquare className="w-8 h-8 text-slate-700 mb-2" />
            <div className="text-xs font-medium">No conversation sessions found</div>
            <div className="text-[10px] text-slate-600 mt-1 max-w-[180px]">
              New sessions appear automatically when a customer messages WhatsApp.
            </div>
          </div>
        ) : (
          sessions.map((sess) => {
            const isSelected = sess.session_id === activeSessionId;
            const needsHuman = sess.status === "NEEDS_HUMAN";

            return (
              <button
                key={sess.session_id}
                onClick={() => setActiveSessionId(sess.session_id)}
                className={`w-full flex flex-col p-3.5 rounded-xl border text-left transition-all duration-300 ${
                  isSelected
                    ? "bg-slate-800 border-slate-700 shadow-md shadow-slate-950/20"
                    : needsHuman
                    ? "bg-red-950/10 border-red-950/80 hover:bg-red-950/20 animate-border-pulse"
                    : "bg-slate-900/25 border-slate-800/60 hover:bg-slate-800/35 hover:border-slate-800"
                }`}
              >
                <div className="flex justify-between items-start w-full mb-1">
                  <div className="font-semibold text-sm text-slate-200 tracking-wide">
                    {sess.customer_phone}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {formatTime(sess.last_message_time)}
                  </div>
                </div>

                <div className="text-xs text-slate-400 line-clamp-1 mb-3 w-full pr-2">
                  {sess.last_message_content || "..."}
                </div>

                <div className="flex items-center justify-between w-full">
                  {renderStatusBadge(sess.status)}
                  {needsHuman && (
                    <span className="text-[10px] text-red-400 font-semibold animate-pulse">
                      Requires Handover
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
