export const ukrainianAcceptanceCases = [
  {
    input: "Молоко купити сьогодні, пошту глянути завтра, а рахунок я вже оплатив",
    expectedTaskCount: 3,
  },
  { input: "Подзвони лікарю сьогодні до п’ятої", expectedTaskCount: 1 },
  { input: "Перенеси зустріч на завтра", expectedTaskCount: 1 },
  { input: "Купити лампочку", expectedTaskCount: 1 },
] as const;
