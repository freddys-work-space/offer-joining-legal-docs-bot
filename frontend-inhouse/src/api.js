const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const API_BASE = rawApiUrl
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`)
  : '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  verifyKey: (accessKey) =>
    request('/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey }),
    }),
  listCandidates: (key) =>
    request('/candidates', { headers: { 'x-authority-key': key } }),
  getCandidate: (id, key) =>
    request(`/candidates/${id}`, { headers: { 'x-authority-key': key } }),
  createInvite: (payload, key) =>
    request('/candidates/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authority-key': key },
      body: JSON.stringify(payload),
    }),
  sendForm: (id, key) =>
    request(`/candidates/${id}/send-form`, {
      method: 'POST',
      headers: { 'x-authority-key': key },
    }),
  sendOfferBundle: (id, payload, key) =>
    request(`/candidates/${id}/send-offer-bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authority-key': key },
      body: JSON.stringify(payload),
    }),
  markAccepted: (id, key) =>
    request(`/candidates/${id}/accept`, {
      method: 'POST',
      headers: { 'x-authority-key': key },
    }),
  sendJoining: (id, payload, key) =>
    request(`/candidates/${id}/send-joining`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authority-key': key },
      body: JSON.stringify(payload),
    }),
  generateSingleDoc: (payload, key) =>
    request('/documents/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authority-key': key },
      body: JSON.stringify(payload),
    }),
  uploadLetterhead: async (file, key) => {
    const fd = new FormData();
    fd.append('letterhead', file);
    const res = await fetch(`${API_BASE}/documents/letterhead`, {
      method: 'POST',
      headers: { 'x-authority-key': key },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },
  downloadUrl: (docId, key) => `${API_BASE}/documents/${docId}/download?key=${encodeURIComponent(key)}`,
};

