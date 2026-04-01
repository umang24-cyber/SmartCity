// src/api/smartcity.js

const API_BASE_URL = 'http://localhost:8000/api/v1';

export const apiFetch = async (endpoint, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server error: ${response.status}`);
  }
  return response.json();
};

export const apiPost = async (endpoint, body, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server error: ${response.status}`);
  }
  return response.json();
};

// -- Auth Operations --

export const loginUser = async (email, password) => {
  return apiPost('/auth/login/user', { email, password });
};

export const loginSupervisor = async (email, accessKey) => {
  return apiPost('/auth/login/supervisor', { email, access_key: accessKey });
};

export const signupUser = async (name, email, password) => {
  return apiPost('/auth/signup/user', { name, email, password });
};

export const signupSupervisor = async (name, email, password, accessKey) => {
  return apiPost('/auth/signup/supervisor', { name, email, password, access_key: accessKey });
};

export const signupUserWithGoogle = async (name, email) => {
  return apiPost('/auth/signup/google', { name, email });
};

export const getMe = async (token) => {
  return apiFetch('/auth/me', token);
};

// -- Feature Operations --

export const getIntersections = async () => {
  return apiFetch('/intersections');
};

export const getIncidents = async () => {
  return apiFetch('/incidents');
};

export const postReport = async (reportData, token) => {
  return apiPost('/reports', reportData, token);
};

export const getSafeRoute = async (start, end) => {
  return apiFetch(`/safe-route?start=${start}&end=${end}`);
};

export const getOverview = async (token) => {
  return apiFetch('/supervisor/dashboard/overview', token);
};

export const verifyIncident = async (id, verified, note, token) => {
  const response = await fetch(`${API_BASE_URL}/supervisor/incidents/${id}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ verified, note })
  });
  if (!response.ok) throw new Error("Verification update failed");
  return response.json();
};
