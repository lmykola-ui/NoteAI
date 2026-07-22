import Image from "next/image";

type EmptyTaskStateProps = {
  message: string;
};

export function EmptyTaskState({ message }: EmptyTaskStateProps) {
  return (
    <div className="empty-task-state">
      <Image src="/empty-task-state-cat.png" alt="" width={1254} height={1254} priority />
      <p>{message}</p>
    </div>
  );
}
