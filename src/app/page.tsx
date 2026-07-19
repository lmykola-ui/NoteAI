import { CaptureScreen } from "@/components/capture/CaptureScreen";
import { TaskProvider } from "@/features/tasks/application/TaskProvider";

export default function HomePage() {
  return (
    <TaskProvider>
      <main className="mobile-shell">
        <CaptureScreen />
        <nav aria-label="Основна навігація" className="bottom-nav">
          <button type="button" aria-current="page">Capture</button>
          <button type="button">Inbox</button>
          <button type="button">План</button>
        </nav>
      </main>
    </TaskProvider>
  );
}
