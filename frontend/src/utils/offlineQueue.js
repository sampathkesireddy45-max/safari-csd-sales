const QUEUE_KEY = "safari_offline_sales_queue";

export const isOnline = () => {
  return typeof navigator !== "undefined" && navigator.onLine;
};

export const getOfflineQueue = () => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to read offline queue:", e);
    return [];
  }
};

export const getOfflineQueueCount = () => {
  return getOfflineQueue().length;
};

export const enqueueOfflineSale = (saleData) => {
  try {
    const queue = getOfflineQueue();
    const queuedItem = {
      ...saleData,
      _offline_id: `OFFLINE-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      _queued_at: new Date().toISOString(),
    };
    queue.push(queuedItem);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent("safari-offline-queue-changed", { detail: { count: queue.length } }));
    return queuedItem;
  } catch (e) {
    console.error("Failed to enqueue offline sale:", e);
    throw e;
  }
};

export const flushOfflineQueue = async (createSaleApi, notifySuccess) => {
  if (!isOnline()) return { synced: 0, remaining: getOfflineQueueCount() };

  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  console.log(`📡 Online connection restored: Flushing ${queue.length} offline sales...`);
  const remaining = [];
  let synced = 0;

  for (const item of queue) {
    try {
      const { _offline_id, _queued_at, ...payload } = item;
      await createSaleApi(payload);
      synced++;
    } catch (err) {
      console.error("Failed to sync offline item:", err);
      remaining.push(item);
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  window.dispatchEvent(new CustomEvent("safari-offline-queue-changed", { detail: { count: remaining.length } }));

  if (synced > 0 && typeof notifySuccess === "function") {
    notifySuccess(`✅ Successfully synced ${synced} offline sale(s) to server!`);
  }

  return { synced, remaining: remaining.length };
};
