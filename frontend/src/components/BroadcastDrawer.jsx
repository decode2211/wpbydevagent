import React, { useState, useEffect } from "react";
import apiClient from "../api/client";
import { X, CheckCircle2 } from "lucide-react";

export default function BroadcastDrawer({ isOpen, onClose, activeTenantId }) {
  const [template, setTemplate] = useState("");
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!isOpen || !activeTenantId) return;

    async function loadContacts() {
      try {
        setLoading(true);
        setStatus(null);
        setSelectedContacts([]);
        const response = await apiClient.get(`/api/tenants/${activeTenantId}/sessions`);
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

  const toggleContact = (phone) => {
    setSelectedContacts(prev =>
      prev.includes(phone)
        ? prev.filter(c => c !== phone)
        : [...prev, phone]
    );
  };

  const toggleAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts([...contacts]);
    }
  };

  const handleSendBroadcast = async () => {
    if (selectedContacts.length === 0 || !template.trim()) return;

    try {
      setSending(true);
      setStatus(null);
      await apiClient.post("/api/broadcast", {
        tenant_id: activeTenantId,
        phone_numbers: selectedContacts,
        template_message: template,
      });

      setStatus({ type: "success", message: `Sent to ${selectedContacts.length} recipients` });
      setTemplate("");
      setSelectedContacts([]);
    } catch (err) {
      console.error("Broadcast failed:", err);
      setStatus({ type: "error", message: "Failed to send broadcast." });
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-[#000000] opacity-50 transition-opacity" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 flex max-w-full">
        <div className="w-[420px] bg-[#141414] border-l border-[#2A2A2A] flex flex-col shadow-2xl">
          
          {/* Header */}
          <div className="px-6 py-5 border-b border-[#2A2A2A] flex items-center justify-between">
            <h2 className="text-base font-bold text-[#F5F5F5]">Send Broadcast</h2>
            <button onClick={onClose} className="text-[#888] hover:text-[#F5F5F5] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            
            {/* Success State */}
            {status && status.type === "success" && (
              <div className="flex items-center justify-center flex-col py-8 animate-fade-in">
                <CheckCircle2 className="w-12 h-12 text-[#00D4AA] mb-4" />
                <div className="text-[#F5F5F5] font-medium text-sm">{status.message}</div>
              </div>
            )}

            {/* Error State */}
            {status && status.type === "error" && (
              <div className="p-3 bg-[#FF4757]/10 border border-[#FF4757]/30 text-[#FF4757] text-sm rounded">
                {status.message}
              </div>
            )}

            {(!status || status.type === "error") && (
              <>
                {/* Textarea */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-[#888]">MESSAGE</label>
                  <textarea
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    placeholder="Type your broadcast message..."
                    rows={6}
                    className="w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded p-3 text-sm text-[#F5F5F5] placeholder-[#555] focus:outline-none focus:border-[#555] transition-colors resize-none"
                  />
                </div>

                {/* Recipients */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-[#888]">
                      RECIPIENTS ({selectedContacts.length})
                    </label>
                    {contacts.length > 0 && (
                      <button onClick={toggleAll} className="text-xs text-[#00D4AA] hover:text-[#00D4AA]/80 font-medium transition-colors">
                        {selectedContacts.length === contacts.length ? "Deselect All" : "Select All"}
                      </button>
                    )}
                  </div>

                  {loading ? (
                    <div className="text-sm text-[#555] py-4">Loading contacts...</div>
                  ) : contacts.length === 0 ? (
                    <div className="text-sm text-[#555] py-4">No contacts found.</div>
                  ) : (
                    <div className="border border-[#2A2A2A] rounded bg-[#0F0F0F] overflow-hidden">
                      <div className="max-h-[240px] overflow-y-auto divide-y divide-[#2A2A2A]">
                        {contacts.map((phone) => {
                          const isChecked = selectedContacts.includes(phone);
                          return (
                            <label key={phone} className="flex items-center gap-3 px-4 py-3 hover:bg-[#1A1A1A] cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleContact(phone)}
                                className="w-4 h-4 rounded border-[#555] bg-transparent text-[#7C5CFC] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                              />
                              <span className="text-sm text-[#F5F5F5] font-medium">{phone}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer Action */}
          <div className="p-6 border-t border-[#2A2A2A]">
            <button
              onClick={handleSendBroadcast}
              disabled={sending || selectedContacts.length === 0 || !template.trim() || status?.type === "success"}
              className="w-full py-3 rounded bg-[#7C5CFC] text-white font-bold text-sm hover:bg-[#6b4de0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : null}
              Send to Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
