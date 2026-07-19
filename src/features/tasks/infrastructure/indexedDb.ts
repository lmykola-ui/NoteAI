import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Task } from "../domain/task";

interface NoteAiDb extends DBSchema {
  tasks: {
    key: string;
    value: Task;
    indexes: { "by-date": string; "by-status": Task["status"] };
  };
  meta: { key: string; value: { key: string; value: string } };
}

let noteAiDb: Promise<IDBPDatabase<NoteAiDb>> | undefined;

export function getNoteAiDb(): Promise<IDBPDatabase<NoteAiDb>> {
  noteAiDb ??= openDB<NoteAiDb>("noteai", 1, {
    upgrade(db) {
      const tasks = db.createObjectStore("tasks", { keyPath: "id" });
      tasks.createIndex("by-date", "scheduledDate");
      tasks.createIndex("by-status", "status");
      db.createObjectStore("meta", { keyPath: "key" });
    },
  });

  return noteAiDb;
}
