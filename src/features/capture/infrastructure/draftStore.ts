import { getNoteAiDb } from "@/features/tasks/infrastructure/indexedDb";

const DRAFT_KEY = "capture-draft";

export async function loadCaptureDraft(): Promise<string> {
  const db = await getNoteAiDb();
  return (await db.get("meta", DRAFT_KEY))?.value ?? "";
}

export async function saveCaptureDraft(value: string): Promise<void> {
  const db = await getNoteAiDb();
  await db.put("meta", { key: DRAFT_KEY, value });
}

export async function clearCaptureDraft(): Promise<void> {
  const db = await getNoteAiDb();
  await db.delete("meta", DRAFT_KEY);
}
