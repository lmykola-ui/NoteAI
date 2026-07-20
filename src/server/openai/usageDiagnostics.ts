import "server-only";

export type OpenAIOperation = "parse" | "transcribe";

export type OpenAIUsageInput = {
  operation: OpenAIOperation;
  model: string;
  requestId?: unknown;
  usage?: unknown;
  audioDurationSeconds?: number;
};

export type OpenAIUsageDiagnostic = {
  event: "openai_usage";
  operation: OpenAIOperation;
  outcome: "provider_response";
  model: string;
  requestId: string | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  audioDurationSeconds: number | null;
  estimatedCostUsdMicros: number | null;
  pricingSnapshot: "2026-07-20";
  retryPolicy: "sdk_max_1";
};

const safeModelPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function safeRead(record: Record<string, unknown> | null, key: string) {
  try {
    return record ? Reflect.get(record, key) : undefined;
  } catch {
    return undefined;
  }
}

function tokenCount(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function safeDuration(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 60
    ? value
    : null;
}

function safeRequestId(value: unknown) {
  return typeof value === "string" &&
    value.length <= 200 &&
    /^[A-Za-z0-9._-]+$/.test(value)
    ? value
    : null;
}

function estimateParseCost(
  model: string,
  inputTokens: number | null,
  cachedInputTokens: number | null,
  outputTokens: number | null,
) {
  if (model !== "gpt-5-nano" || inputTokens === null || outputTokens === null) {
    return null;
  }

  const cached = Math.min(cachedInputTokens ?? 0, inputTokens);
  const uncached = inputTokens - cached;
  return Math.round(
    (uncached * 50 + cached * 5 + outputTokens * 400) / 1_000,
  );
}

function estimateTranscriptionCost(
  model: string,
  durationSeconds: number | null,
) {
  if (model !== "gpt-4o-mini-transcribe" || durationSeconds === null) {
    return null;
  }
  return Math.round(durationSeconds * 50);
}

export function toOpenAIUsageDiagnostic(
  input: OpenAIUsageInput,
): OpenAIUsageDiagnostic {
  const usage = asRecord(input.usage);
  const inputDetails = asRecord(safeRead(usage, "input_tokens_details"));
  const outputDetails = asRecord(safeRead(usage, "output_tokens_details"));
  const model = safeModelPattern.test(input.model) ? input.model : "unknown";
  const inputTokens = tokenCount(safeRead(usage, "input_tokens"));
  const cachedInputTokens = tokenCount(
    safeRead(inputDetails, "cached_tokens"),
  );
  const outputTokens = tokenCount(safeRead(usage, "output_tokens"));
  const reasoningTokens = tokenCount(
    safeRead(outputDetails, "reasoning_tokens"),
  );
  const totalTokens = tokenCount(safeRead(usage, "total_tokens"));
  const audioDurationSeconds = safeDuration(input.audioDurationSeconds);

  return {
    event: "openai_usage",
    operation: input.operation,
    outcome: "provider_response",
    model,
    requestId: safeRequestId(input.requestId),
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
    audioDurationSeconds,
    estimatedCostUsdMicros:
      input.operation === "parse"
        ? estimateParseCost(
            model,
            inputTokens,
            cachedInputTokens,
            outputTokens,
          )
        : estimateTranscriptionCost(model, audioDurationSeconds),
    pricingSnapshot: "2026-07-20",
    retryPolicy: "sdk_max_1",
  };
}

export function emitOpenAIUsage(diagnostic: OpenAIUsageDiagnostic) {
  try {
    console.info(diagnostic);
  } catch {
    // Observability must not change the user-visible API result.
  }
}
