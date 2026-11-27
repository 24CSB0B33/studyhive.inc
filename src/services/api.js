// REST client for StudyHive endpoints

const API_BASE = process.env.REACT_APP_API_URL || '';
let authToken = null;
let roomInviteToken = '';
export const setAuthToken = (token) => { authToken = token; };
export const setRoomInviteToken = (token) => { roomInviteToken = token || ''; };
function withInvite(url) { return roomInviteToken ? `${url}${url.includes('?') ? '&' : '?'}invite=${encodeURIComponent(roomInviteToken)}` : url; }
async function apiFetch(url, options = {}) {
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return fetch(`${API_BASE}${url}`, { ...options, headers });
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.json();
}

export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/api/users`);
  return res.json();
}

export async function fetchRooms() {
  const res = await apiFetch('/api/rooms');
  return res.json();
}

export async function fetchRoom(id, invite = '') {
  const res = await apiFetch(`/api/rooms/${encodeURIComponent(id)}${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`);
  return res.json();
}

export async function createRoom(roomData) {
  const res = await apiFetch('/api/rooms', {
    method: 'POST',
    body: JSON.stringify(roomData)
  });
  return res.json();
}

export async function fetchMessages(roomId) {
  const res = await apiFetch(withInvite(`/api/rooms/${roomId}/messages`));
  return res.json();
}

export async function fetchResources(roomId, tag = '', search = '') {
  const params = new URLSearchParams();
  if (tag) params.append('tag', tag);
  if (search) params.append('search', search);
  const res = await apiFetch(withInvite(`/api/rooms/${encodeURIComponent(roomId)}/resources?${params.toString()}`));
  return res.json();
}

export async function createResource(roomId, resourceData) {
  const res = await apiFetch(withInvite(`/api/rooms/${encodeURIComponent(roomId)}/resources`), {
    method: 'POST',
    body: JSON.stringify(resourceData)
  });
  return res.json();
}

export async function voteResource(roomId, id, userId, voteType) {
  const res = await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/resources/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    body: JSON.stringify({ voteType })
  });
  return res.json();
}

export async function upvoteResource(roomId, id, userId) {
  return voteResource(roomId, id, userId, 'up');
}

export async function uploadFile(file, roomId, userId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('roomId', roomId);
  formData.append('userId', userId);
  const res = await apiFetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  return res.json();
}

export async function getProfile() { return (await apiFetch('/api/profile/me')).json(); }
export async function saveProfile(profile) { return (await apiFetch('/api/profile/me', { method: 'PUT', body: JSON.stringify(profile) })).json(); }
export async function deleteRoom(id) { return (await apiFetch(`/api/rooms/${encodeURIComponent(id)}`, { method: 'DELETE' })).json(); }

export async function generateQuiz({ topic, notesContext, difficulty, questionCount, model }) {
  const res = await fetch(`${API_BASE}/api/quiz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, notesContext, difficulty, questionCount, model })
  });
  return res.json();
}

export async function testGeminiKey() {
  const res = await fetch(`${API_BASE}/api/quiz/test-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  return res.json();
}
