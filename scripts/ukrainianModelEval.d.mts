type ModelTask = {
  title: string;
  description?: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  status: "active" | "completed";
  priority: "low" | "medium" | "high" | null;
};

export type UkrainianModelEvalCase = {
  name: string;
  input: string;
  today: string;
  expected: {
    tasks: Array<Omit<ModelTask, "title"> & { titleConcepts: string[][] }>;
    clarification: "none" | "required";
  };
};

export const ukrainianModelEvalCases: UkrainianModelEvalCase[];

export function evaluateUkrainianModelCase(
  definition: UkrainianModelEvalCase,
  actual: { tasks: ModelTask[]; clarification: string | null },
): string[];

export function resolveUkrainianModel(env: {
  OPENAI_MODEL?: string;
}): string;

export function runUkrainianModelEval(options: {
  client: {
    responses: {
      parse(request: unknown, options: unknown): Promise<{ output_parsed: unknown }>;
    };
  };
  model: string;
}): Promise<Array<{ name: string; issues: string[] }>>;
