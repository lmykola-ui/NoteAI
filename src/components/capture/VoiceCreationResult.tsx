import type { Task } from "@/features/tasks/domain/task";

type VoiceCreationResultProps = {
  tasks: Task[];
  today: string;
};

function placementLabel(task: Task, today: string) {
  if (!task.scheduledDate) return null;
  return task.scheduledDate === today ? "Сьогодні" : "Заплановані";
}

export function VoiceCreationResult({ tasks, today }: VoiceCreationResultProps) {
  const taskLabel = tasks.length === 1 ? "задачу" : "задачі";
  const message = `Створено ${tasks.length} ${taskLabel}`;

  return (
    <section className="voice-creation-result" role="status" aria-label={message}>
      {tasks.map((task, index) => {
        const placement = placementLabel(task, today);

        return (
          <article
            className="voice-creation-card"
            key={task.id}
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <strong>{task.title}</strong>
            <p>
              <span>Вхідні</span>
              {placement ? <span> · {placement}</span> : null}
              {task.priority === "high" ? <span> · Високий пріоритет</span> : null}
            </p>
          </article>
        );
      })}
    </section>
  );
}
