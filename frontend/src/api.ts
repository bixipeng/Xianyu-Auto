const BASE = '';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Status
  getStatus: () => request<any>('/api/status'),

  // Products
  getProducts: (page = 1, pageSize = 20) =>
    request<any>(`/api/products?page=${page}&pageSize=${pageSize}`),
  getProductDetail: (id: string) => request<any>(`/api/products/${id}`),
  polishProduct: (id: string) => request<any>(`/api/products/${id}/polish`, { method: 'POST' }),
  polishAll: () => request<any>('/api/products/polish-all', { method: 'POST' }),
  offlineProduct: (id: string) => request<any>(`/api/products/${id}/offline`, { method: 'POST' }),
  deleteProduct: (id: string) => request<any>(`/api/products/${id}`, { method: 'DELETE' }),

  // Reply
  getReplyStats: () => request<any>('/api/reply/stats'),
  getReplyRules: () => request<any>('/api/reply/rules'),
  updateReplyRules: (data: any) =>
    request<any>('/api/reply/rules', { method: 'PUT', body: JSON.stringify(data) }),
  sendReply: (buyerId: string, content: string) =>
    request<any>('/api/reply/send', { method: 'POST', body: JSON.stringify({ buyerId, content }) }),

  // Messages
  getMessages: (limit = 100, offset = 0) =>
    request<any>(`/api/messages?limit=${limit}&offset=${offset}`),
  getSessions: () => request<any>('/api/messages/sessions'),
  getSessionMessages: (sessionId: string) =>
    request<any>(`/api/messages/session/${encodeURIComponent(sessionId)}`),

  // Price
  getPriceAlerts: () => request<any>('/api/price/alerts'),
  getPriceHistory: (itemId: string) => request<any>(`/api/price/history/${itemId}`),
  checkPrices: () => request<any>('/api/price/check', { method: 'POST' }),

  // Scraper
  getStats: () => request<any>('/api/scraper/stats'),
  search: (keyword: string, page = 1) =>
    request<any>(`/api/scraper/search?keyword=${encodeURIComponent(keyword)}&page=${page}`),

  // Deliver
  getDeliverStats: () => request<any>('/api/deliver/stats'),
  getDeliverRules: () => request<any>('/api/deliver/rules'),
  updateDeliverRules: (data: any) =>
    request<any>('/api/deliver/rules', { method: 'PUT', body: JSON.stringify(data) }),

  // Config
  getConfig: () => request<any>('/api/config'),
  updateConfig: (data: any) =>
    request<any>('/api/config', { method: 'PUT', body: JSON.stringify(data) }),

  // Scheduler
  restartScheduler: () => request<any>('/api/scheduler/restart', { method: 'POST' }),
};
