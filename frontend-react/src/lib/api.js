const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function request(path, options) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new Error("Can't reach the backend. Is it running?");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // response wasn't JSON - fall back to statusText
    }
    throw new Error(detail);
  }

  return res.json();
}

export function getMeetings() {
  return request("/api/meetings");
}

export function uploadMeeting(file, title) {
  const formData = new FormData();
  formData.append("file", file);
  const query = title?.trim() ? `?title=${encodeURIComponent(title.trim())}` : "";
  return request(`/api/upload${query}`, {
    method: "POST",
    body: formData,
  });
}

export function getMeeting(id) {
  return request(`/api/meetings/${id}`);
}

export function deleteMeeting(id) {
  return request(`/api/meetings/${id}`, { method: "DELETE" });
}

export function extractCrm(meetingId) {
  return request(`/api/meetings/${meetingId}/extract-crm`, { method: "POST" });
}

export function saveCrm(meetingId, data) {
  return request(`/api/meetings/${meetingId}/save-crm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function getCrmRecords() {
  return request("/api/crm/records");
}

export function getCrmRecord(id) {
  return request(`/api/crm/records/${id}`);
}

export function deleteCrmRecord(id) {
  return request(`/api/crm/records/${id}`, { method: "DELETE" });
}

export function askCrm(question) {
  return request("/api/crm/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}
