import type { Instrumentation } from "next";

const verboseServerErrorsEnabled =
  process.env.CMS_VERBOSE_SERVER_ERRORS === "true";

export function register() {
  if (!verboseServerErrorsEnabled || process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const globalWithLoggingState = globalThis as typeof globalThis & {
    __lapuertahostelsPreviewErrorLoggingRegistered?: boolean;
  };

  if (globalWithLoggingState.__lapuertahostelsPreviewErrorLoggingRegistered) {
    return;
  }

  globalWithLoggingState.__lapuertahostelsPreviewErrorLoggingRegistered = true;

  process.on("uncaughtException", (error) => {
    logPreviewServerError("uncaughtException", error);
  });
  process.on("unhandledRejection", (reason) => {
    logPreviewServerError("unhandledRejection", reason);
  });
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  if (!verboseServerErrorsEnabled) {
    return;
  }

  logPreviewServerError("requestError", error, {
    context,
    request: {
      method: request.method,
      path: request.path,
    },
  });
};

function logPreviewServerError(
  kind: string,
  error: unknown,
  meta?: Record<string, unknown>,
) {
  console.error(
    "[preview-server-error]",
    JSON.stringify(
      {
        error: serializeUnknown(error),
        kind,
        meta,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

function serializeUnknown(value: unknown, depth = 0): unknown {
  if (depth > 3) {
    return "[depth-limit]";
  }

  if (value instanceof Error) {
    const serialized: Record<string, unknown> = {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };

    for (const property of Object.getOwnPropertyNames(value)) {
      if (!(property in serialized)) {
        serialized[property] = serializeUnknown(
          (value as unknown as Record<string, unknown>)[property],
          depth + 1,
        );
      }
    }

    if (value.cause) {
      serialized.cause = serializeUnknown(value.cause, depth + 1);
    }

    return serialized;
  }

  if (typeof value === "function") {
    return `[function ${value.name || "anonymous"}]`;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeUnknown(item, depth + 1));
  }

  const serialized: Record<string, unknown> = {};
  for (const property of Object.getOwnPropertyNames(value)) {
    serialized[property] = serializeUnknown(
      (value as unknown as Record<string, unknown>)[property],
      depth + 1,
    );
  }

  return serialized;
}
