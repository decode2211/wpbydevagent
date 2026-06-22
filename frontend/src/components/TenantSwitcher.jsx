import React, { useEffect, useState } from "react";
import apiClient from "../api/client";

export default function TenantSwitcher({ activeTenantId, setActiveTenantId }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchTenants() {
      try {
        setLoading(true);
        const response = await apiClient.get("/api/tenants");
        setTenants(response.data);
        if (response.data.length > 0 && !activeTenantId) {
          setActiveTenantId(response.data[0].tenant_id);
        }
        setError(null);
      } catch (err) {
        console.error("Error fetching tenants:", err);
        setError("Failed to load tenants");
        const staticTenants = [
          { tenant_id: "tenant_luxfurn", name: "LuxFurn" },
          { tenant_id: "tenant_autocare", name: "AutoCare" },
        ];
        setTenants(staticTenants);
        if (!activeTenantId) setActiveTenantId(staticTenants[0].tenant_id);
      } finally {
        setLoading(false);
      }
    }

    fetchTenants();
  }, []);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-5 py-5 mb-2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 5C6 3.89543 6.89543 3 8 3H16C17.1046 3 18 3.89543 18 5V14L13 19H8C6.89543 19 6 18.1046 6 17V5Z" fill="#7C5CFC" fillOpacity="0.8"/>
          <path d="M10 9C10 7.89543 10.8954 7 12 7H20C21.1046 7 22 7.89543 22 9V18L17 23H12C10.8954 23 10 22.1046 10 21V9Z" fill="#00D4AA" fillOpacity="0.9"/>
        </svg>
        <span className="text-base font-bold tracking-wide text-[#F5F5F5]">Nexus</span>
      </div>

      <div className="flex flex-col gap-1 px-3 pb-3">
        {loading && tenants.length === 0 ? (
          <div className="px-2 py-2 text-xs text-[#555] animate-pulse">Loading workspaces...</div>
        ) : (
          tenants.map((tenant) => {
            const isActive = tenant.tenant_id === activeTenantId;
            const isLux = tenant.tenant_id === "tenant_luxfurn";
            const initial = tenant.name.charAt(0);

            return (
              <button
                key={tenant.tenant_id}
                onClick={() => setActiveTenantId(tenant.tenant_id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded transition-colors text-left border ${
                  isActive
                    ? "bg-[#1E1A2E] border-[#1E1A2E] border-l-[3px] border-l-[#7C5CFC]"
                    : "bg-[#1A1A1A] border-[#2A2A2A] hover:bg-[#1F1F1F] border-l-[3px] border-l-[#1A1A1A] hover:border-l-[#1F1F1F]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isLux ? 'bg-amber-900/40 text-amber-500' : 'bg-blue-900/40 text-blue-500'}`}>
                    {initial}
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${isActive ? 'text-[#F5F5F5]' : 'text-[#F5F5F5]'}`}>
                      {tenant.name}
                    </div>
                    <div className="text-[10px] text-[#888]">
                      {isLux ? "Premium Sales" : "Service & Support"}
                    </div>
                  </div>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#00D4AA]"></div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
