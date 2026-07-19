export type SecretMatch = {
  index: number;
  value: string;
};

export function findOpenAiSecrets(text: string): SecretMatch[];

export function scanRepository(): {
  references: string[];
  secrets: string[];
};
