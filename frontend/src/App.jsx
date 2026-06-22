import React, { useState } from "react";
import TenantSwitcher from "./components/TenantSwitcher";
import ChatMonitor from "./components/ChatMonitor";
import ChatThread from "./components/ChatThread";
import BroadcastDrawer from "./components/BroadcastDrawer";
import { Megaphone, Bell, User } from "lucide-react";

export default function App() {
  const [activeTenantId, setActiveTenantId] = useState("");
  const [activeSessionId, setActiveSessionId] = useState("");
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  const handleTenantChange = (tenantId) => {
    setActiveTenantId(tenantId);
    setActiveSessionId("");
  };

  return (
    <div className="flex h-screen w-screen bg-[#0F0F0F] overflow-hidden text-[#F5F5F5] font-['Inter']">
      
      {/* LEFT COLUMN: Sidebar */}
      <aside className="w-[260px] border-r border-[#222] bg-[#141414] flex flex-col justify-between select-none shrink-0">
        <div className="flex-1 flex flex-col min-h-0">
          
          <div className="border-b border-[#222]">
            <TenantSwitcher
              activeTenantId={activeTenantId}
              setActiveTenantId={handleTenantChange}
            />
          </div>

          <div className="flex-1 min-h-0">
            <ChatMonitor
              activeTenantId={activeTenantId}
              activeSessionId={activeSessionId}
              setActiveSessionId={setActiveSessionId}
            />
          </div>
        </div>

        {/* Sidebar Footer Details */}
        <div className="p-4 border-t border-[#222] flex items-center justify-between text-[#888]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#1A1A1A] flex items-center justify-center border border-[#2A2A2A]">
              <User className="w-3.5 h-3.5 text-[#555]" />
            </div>
          </div>
          <svg className="w-4 h-4 text-[#555] hover:text-[#888] cursor-pointer transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </div>
      </aside>

      {/* RIGHT COLUMN: Viewport Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0F0F0F] h-full relative">
        <header className="h-[56px] px-6 border-b border-[#1A1A1A] bg-[#0F0F0F] flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center text-sm font-medium text-[#888]">
            <span>Nexus</span>
            <span className="mx-2">/</span>
            <span className="text-[#F5F5F5]">{activeTenantId === "tenant_luxfurn" ? "LuxFurn" : activeTenantId === "tenant_autocare" ? "AutoCare" : "Workspace"}</span>
            <span className="mx-2">/</span>
            <span>Chat</span>
          </div>

          <div className="flex items-center gap-4">
            {activeTenantId && (
              <button
                onClick={() => setIsBroadcastOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#141414] hover:bg-[#1A1A1A] border border-[#2A2A2A] text-[#F5F5F5] text-xs font-medium transition-all"
              >
                <Megaphone className="w-3.5 h-3.5 text-[#888]" />
                <span>Broadcast</span>
              </button>
            )}
            <button className="text-[#888] hover:text-[#F5F5F5] transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-[#555]" />
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0">
          <ChatThread activeSessionId={activeSessionId} />
        </div>
      </main>

      <BroadcastDrawer
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        activeTenantId={activeTenantId}
      />
    </div>
  );
}
