/**
 * BIDGUARD AI — FastAPI Backend REST Client
 * Communicates with the Python / FastAPI server running on http://localhost:8000/api/v1
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export async function checkBackendHealth(): Promise<{ isOnline: boolean; version?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL.replace('/api/v1', '')}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(2000)
    });
    if (res.ok) {
      const data = (await res.json()) as { version?: string };
      return { isOnline: true, version: data.version };
    }
  } catch {
    // Offline or server not started
  }
  return { isOnline: false };
}

export async function fetchAssessmentsFromBackend() {
  const res = await fetch(`${API_BASE_URL}/assessments`, {
    headers: { 'X-Principal-Id': 'officer@mopng.gov.in', 'X-Principal-Role': 'OFFICER' }
  });
  if (!res.ok) throw new Error(`Backend error: ${res.statusText}`);
  return res.json();
}

export async function createBackendAssessment(payload: {
  title: string;
  reference: string;
  procuring_entity: string;
  deadline: string;
}) {
  const res = await fetch(`${API_BASE_URL}/assessments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Principal-Id': 'officer@mopng.gov.in',
      'X-Principal-Role': 'OFFICER'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to create assessment on backend: ${res.statusText}`);
  return res.json();
}
