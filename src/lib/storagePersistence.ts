export type StorageMode = "persistent" | "best-effort";

export async function requestLocalPersistence(): Promise<StorageMode> {
  if (!navigator.storage?.persisted || !navigator.storage.persist) {
    return "best-effort";
  }

  if (await navigator.storage.persisted()) return "persistent";

  return (await navigator.storage.persist()) ? "persistent" : "best-effort";
}
