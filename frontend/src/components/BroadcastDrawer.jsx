import React, { useState, useEffect } from "react";
import apiClient from "../api/client";
import { X, Send, Users, Megaphone, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * BroadcastDrawer Component
 * Slides in from the right to compose a broadcast and select recipients from the active tenant's contacts.
 * 
 * Props:
 * - isOpen: boolean (drawer visibility)
 * - onClose: function (closes the drawer)
 * - activeTenantId: string
 */
export default function BroadcastDrawer({ isOpen, onClose, activeTenantId }) {
  const [template, setTemplate] = useState("");
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }

  // Load known contacts from the session list
  useEffect(() => {
    if (!isOpen || !activeTenantId) return;

    async function loadContacts() {
      try {
        setLoading(true);
        setStatus(null);
        setSelectedContacts([]);
        const response = await apiClient.get(`/api/tenants/${activeTenantId}/sessions`);
        // Map to unique list of phone numbers
        const numbers = response.data.map(sess => sess.customer_phone);
        const uniqueNumbers = [...new Set(numbers)];
        setContacts(uniqueNumbers);
      } catch (err) {
        console.error("Error loading broadcast contacts:", err);
      } finally {
        setLoading(false);
      }
    }

    loadContacts();
  }, [isOpen, activeTenantId]);

  // Toggle selection helper
  const toggleContact = (phone) => {
    setSelectedContacts(prev =>
      prev.includes(phone)
        ? prev.filter(c => c !== phone)
        : [...prev, phone]
    );
  };

  // Toggle all helper
  const toggleAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts([...contacts]);
    }
  };

  // Submit broadcast handler
  const handleSendBroadcast = async () => {
    if (selectedContacts.length === 0) {
      setStatus({ type: "error", message: "Please select at least one recipient." });
      return;
    }
    if (!template.trim()) {
      setStatus({ type: "error", message: "Broadcast message body cannot be empty." });
      return;
    }

    try {
      setSending(true);
      setStatus(null);
      await apiClient.post("/api/broadcast", {
        tenant_id: activeTenantId,
        phone_numbers: selectedContacts,
        template_message: template,
      });

      setStatus({
        type: "success",
        message: `Broadcast successfully queued for ${selectedContacts.length} recipient(s).`,
      });
      setTemplate("");
      setSelectedContacts([]);
    } catch (err) {
      console.error("Broadcast failed:", err);
      setStatus({
        type: "error",
        message: err.response?.data?.detail || "Failed to trigger broadcast dispatch.",
      });
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Background Backdrop Overlay */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex">
        {/* Drawer Window */}
        <div className="w-screen max-w-md bg-[#0f172a] border-l border-slate-800 shadow-2xl flex flex-col justify-between">
          
          {/* Drawer Header */}
          <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Megaphone className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-slate-100 tracking-wide">Compose Broadcast</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Scroll Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {status && (
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 animate-fade-in ${
                  status.type === "success"
                    ? "bg-emerald-950/20 border-emerald-900/60 text-emerald-300"
                    : "bg-red-950/20 border-red-900/60 text-red-300"
                }`}
              >
                {status.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="text-xs font-medium leading-relaxed">{status.message}</div>
              </div>
            )}

            {/* Template Composition */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Broadcast Template
              </label>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder="Enter template content. Supports WhatsApp markdown: *bold*, _italic_."
                rows={5}
                className="w-full bg-[#18222f] border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none transition-all duration-300"
              />
            </div>

            {/* Recipient Selection */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-400" />
                  Select Recipients ({selectedContacts.length})
                </label>
                {contacts.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold uppercase tracking-wider"
                  >
                    {selectedContacts.length === contacts.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {loading ? (
                <div className="text-xs text-slate-500 py-6 text-center">Loading contact directory...</div>
              ) : contacts.length === 0 ? (
                <div className="text-xs text-slate-600 py-6 text-center bg-[#18222f]/30 border border-slate-800/40 rounded-xl">
                  No registered numbers found for this workspace.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#18222f]/25 divide-y divide-slate-800 max-h-56 overflow-y-auto">
                  {contacts.map((phone) => {
                    const isChecked = selectedContacts.includes(phone);
                    return (
                      <label
                        key={phone}
                        className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#1e293b]/30 cursor-pointer transition-colors duration-150 select-none text-slate-200 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleContact(phone)}
                          className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                        />
                        <span className="font-medium font-mono">{phone}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Drawer Footer Actions */}
          <div className="px-6 py-5 border-t border-slate-800 bg-slate-900/30 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 text-xs font-semibold tracking-wider uppercase transition-all duration-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSendBroadcast}
              disabled={sending || selectedContacts.length === 0 || !template.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold tracking-wider uppercase transition-all duration-300 shadow-md shadow-indigo-950/30"
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Broadcast</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
