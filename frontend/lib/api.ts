const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";

// ─── Types ──────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "subagent";
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface StepInfo {
  id: string;
  agent: string;
  payload_sent: Record<string, unknown>;
  payload_received: Record<string, unknown> | null;
  status: string;
  step_number: number;
  created_at: string;
}

export interface WSMessage {
  type: "ack" | "status" | "delegation" | "step_result" | "approval_required" | "final" | "error" | "cancelled";
  message_id?: string;
  status?: string;
  agent?: string;
  iteration?: number;
  action?: string;
  step_number?: number;
  step_id?: string;
  payload?: Record<string, unknown>;
  stdout?: string;
  stderr?: string;
  content?: string;
  message?: string;
  command?: string;
  task_id?: string;
}

export interface DelegationStep {
  agent: string;
  action: string;
  stepNumber: number;
  stepId: string;
  status: "pending" | "running" | "success" | "error" | "blocked";
  stdout?: string;
  stderr?: string;
  payload?: { action?: string; parameters?: Record<string, string> };
  timestamp: Date;
}

export interface ApprovalData {
  agent: string;
  stepId: string;
  taskId: string;
  command: string;
  message: string;
}

// ─── REST API ───────────────────────────────────────────────────

export async function fetchConversations(): Promise<Conversation[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/conversations`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export async function createConversation(): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/api/v1/conversations`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create conversation");
  return res.json();
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/conversations/${conversationId}/messages`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await fetch(`${API_BASE}/api/v1/conversations/${conversationId}`, { method: "DELETE" });
}

export async function cancelTask(conversationId: string): Promise<void> {
  await fetch(`${API_BASE}/api/v1/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId }),
  });
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    return res.ok;
  } catch { return false; }
}

// ─── API Key Management ────────────────────────────────────────

export interface APIKeyInfo {
  name: string;
  masked_key: string;
  model_name: string | null;
  active: boolean;
  request_count: number;
  error_count: number;
  last_used: number;
}

export async function fetchAPIKeys(): Promise<Record<string, APIKeyInfo[]>> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/keys`);
    if (!res.ok) return {};
    return res.json();
  } catch { return {}; }
}

export async function addAPIKey(provider: string, name: string, key: string, modelName?: string): Promise<{status: string}> {
  const res = await fetch(`${API_BASE}/api/v1/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, name, key, model_name: modelName || null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to add key");
  }
  return res.json();
}

export async function removeAPIKey(provider: string, name: string): Promise<void> {
  await fetch(`${API_BASE}/api/v1/keys`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, name }),
  });
}

export async function validateAPIKey(provider: string, key: string, modelName?: string): Promise<{valid: boolean; message: string}> {
  const res = await fetch(`${API_BASE}/api/v1/keys/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, key, model_name: modelName || null }),
  });
  return res.json();
}

// ─── WebSocket ──────────────────────────────────────────────────

export function createChatWebSocket(
  conversationId: string,
  onMessage: (msg: WSMessage) => void,
  onClose?: () => void,
  onError?: (err: Event) => void
): WebSocket {
  const ws = new WebSocket(`${WS_BASE}/ws/chat/${conversationId}`);
  ws.onmessage = (event) => {
    try {
      const data: WSMessage = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error("WS parse error:", e);
    }
  };
  ws.onclose = () => onClose?.();
  ws.onerror = (err) => onError?.(err);
  return ws;
}
