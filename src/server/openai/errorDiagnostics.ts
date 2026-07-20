import "server-only";

export type OpenAIErrorDiagnostic = {
  event: "openai_request_failed";
  errorType:
    | "authentication"
    | "rate_limit"
    | "bad_request"
    | "permission"
    | "not_found"
    | "conflict"
    | "unprocessable"
    | "connection"
    | "timeout"
    | "api_error"
    | "invalid_ai_response"
    | "unknown";
  status: number | null;
  code: string | null;
  requestId: string | null;
  timedOut: boolean;
};

const errorTypes = {
  AuthenticationError: "authentication",
  RateLimitError: "rate_limit",
  BadRequestError: "bad_request",
  PermissionDeniedError: "permission",
  NotFoundError: "not_found",
  ConflictError: "conflict",
  UnprocessableEntityError: "unprocessable",
  APIConnectionError: "connection",
  APIConnectionTimeoutError: "timeout",
  APIError: "api_error",
  InternalServerError: "api_error",
  ZodError: "invalid_ai_response",
  SyntaxError: "invalid_ai_response",
  LengthFinishReasonError: "invalid_ai_response",
  ContentFilterFinishReasonError: "invalid_ai_response",
} as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function safeString(value: unknown, pattern: RegExp, maxLength: number) {
  return typeof value === "string" &&
    value.length <= maxLength &&
    pattern.test(value)
    ? value
    : null;
}

function safeRead(record: Record<string, unknown> | null, key: string) {
  try {
    return record ? Reflect.get(record, key) : undefined;
  } catch {
    return undefined;
  }
}

export function toOpenAIErrorDiagnostic(
  error: unknown,
): OpenAIErrorDiagnostic {
  const record = asRecord(error);
  const constructor = safeRead(record, "constructor");
  const constructorName =
    typeof constructor === "function"
      ? safeString(constructor.name, /^[A-Za-z]+Error$/, 80)
      : null;
  const declaredName = safeString(
    safeRead(record, "name"),
    /^[A-Za-z]+Error$/,
    80,
  );
  const name =
    constructorName && constructorName in errorTypes
      ? constructorName
      : declaredName;
  const rawStatus = safeRead(record, "status");
  const status =
    typeof rawStatus === "number" &&
    Number.isInteger(rawStatus) &&
    rawStatus >= 400 &&
    rawStatus <= 599
      ? rawStatus
      : null;
  const code = safeString(
    safeRead(record, "code"),
    /^[A-Za-z0-9_.-]+$/,
    100,
  );
  const requestId =
    safeString(safeRead(record, "requestID"), /^[A-Za-z0-9_.-]+$/, 200) ??
    safeString(safeRead(record, "request_id"), /^[A-Za-z0-9_.-]+$/, 200);
  const timedOut = name === "APIConnectionTimeoutError";
  const invalidAIResponse =
    safeRead(record, "message") === "INVALID_AI_RESPONSE";

  return {
    event: "openai_request_failed",
    errorType: invalidAIResponse
      ? "invalid_ai_response"
      : name && name in errorTypes
        ? errorTypes[name as keyof typeof errorTypes]
        : status !== null
          ? "api_error"
          : "unknown",
    status,
    code,
    requestId,
    timedOut,
  };
}
