import {
  AudioLines,
  CalendarDays,
  Check,
  CheckCheck,
  Inbox,
  Keyboard,
  Mic,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";

const icons = {
  audio: AudioLines,
  calendar: CalendarDays,
  check: Check,
  tasks: CheckCheck,
  inbox: Inbox,
  keyboard: Keyboard,
  mic: Mic,
  more: MoreHorizontal,
  edit: Pencil,
  retry: RotateCcw,
  send: Send,
  stop: Square,
  trash: Trash2,
  close: X,
} as const;

export type AppIconName = keyof typeof icons;

const labels: Record<AppIconName, string> = {
  audio: "Аудіозапис",
  calendar: "Календар",
  check: "Вибрано",
  tasks: "Задачі",
  inbox: "Inbox",
  keyboard: "Клавіатура",
  mic: "Мікрофон",
  more: "Інші дії",
  edit: "Редагувати",
  retry: "Повторити",
  send: "Продовжити",
  stop: "Зупинити",
  trash: "Видалити",
  close: "Закрити",
};

type AppIconProps = {
  name: AppIconName;
  size?: number;
  decorative?: boolean;
};

export function AppIcon({
  name,
  size = 20,
  decorative = false,
}: AppIconProps) {
  const Icon = icons[name];

  return decorative ? (
    <Icon size={size} strokeWidth={1.8} aria-hidden="true" />
  ) : (
    <Icon
      size={size}
      strokeWidth={1.8}
      role="img"
      aria-label={labels[name]}
    />
  );
}
