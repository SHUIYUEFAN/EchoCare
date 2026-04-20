/** Realtime channel naming — align with Supabase topic / table conventions in Sprint 1. */
export const familyRoomChannel = (familyId: string) => `family:${familyId}:messages`;

export type ChatRole = "elder" | "family" | "assistant";

export interface ChatMessagePayload {
  id: string;
  familyId: string;
  authorRole: ChatRole;
  body: string;
  createdAt: string;
}

/** Placeholder for client-side tool actions (Voice-OS). */
export type LocalToolAction =
  | { action: "read_gallery"; query: string }
  | { action: "create_calendar_event"; title: string; startIso: string };

export function isLocalToolAction(value: unknown): value is LocalToolAction {
  if (!value || typeof value !== "object") return false;
  const a = (value as { action?: string }).action;
  return a === "read_gallery" || a === "create_calendar_event";
}

export * from "./designTokens";
