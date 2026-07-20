import { AppShell } from "@/components/app-shell/AppShell";
import { TaskProvider } from "@/features/tasks/application/TaskProvider";

export default function HomePage() {
  return <TaskProvider><AppShell /></TaskProvider>;
}
