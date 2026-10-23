import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { isOnline, getOfflineQueueCount, flushOfflineQueue } from "../utils/offlineQueue";
import { createSale } from "../services/api";
import { useToast } from "./Toast";

const OfflineStatusBanner = () => {
  const [online, setOnline] = useState(isOnline());
  const [queueCount, setQueueCount] = useState(getOfflineQueueCount());
  const [syncing, setSyncing] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      // Auto-flush when coming back online
      handleSync();
    };

    const handleOffline = () => {
      setOnline(false);
    };

    const handleQueueChange = (e) => {
      setQueueCount(e.detail?.count ?? getOfflineQueueCount());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("safari-offline-queue-changed", handleQueueChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("safari-offline-queue-changed", handleQueueChange);
    };
  }, []);

  const handleSync = async () => {
    if (!navigator.onLine) {
      addToast("Cannot sync: device is currently offline.", "error");
      return;
    }
    setSyncing(true);
    try {
      const res = await flushOfflineQueue(createSale, (msg) => {
        addToast(msg, "success");
      });
      setQueueCount(res.remaining);
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Only render banner if offline or if there are items in the queue
  if (online && queueCount === 0) return null;

  return (
    <div
      className={`px-4 py-2 text-xs font-semibold flex items-center justify-between gap-3 transition-colors ${
        !online
          ? "bg-amber-500 text-slate-950 shadow-md"
          : "bg-indigo-600 text-white shadow-md"
      }`}
    >
      <div className="flex items-center gap-2">
        {!online ? (
          <>
            <WifiOff className="w-4 h-4 text-slate-950 animate-pulse" />
            <span>
              <strong>Offline Mode Active:</strong> Spotty network detected. Sales will be safely queued locally on your phone.
            </span>
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4 text-emerald-300" />
            <span>
              <strong>Back Online!</strong> {queueCount} offline sale(s) waiting to sync.
            </span>
          </>
        )}
      </div>

      {queueCount > 0 && (
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing || !online}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          <span>{syncing ? "Syncing..." : `Sync (${queueCount})`}</span>
        </button>
      )}
    </div>
  );
};

export default OfflineStatusBanner;
