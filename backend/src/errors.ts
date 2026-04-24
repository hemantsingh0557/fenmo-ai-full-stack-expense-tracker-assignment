import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { MoneyError } from "./money";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message);
  }
}

export function badRequest(
  message: string,
  fields?: Record<string, string>
): HttpError {
  return new HttpError(400, "bad_request", message, fields);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // express requires 4 args to recognise this as an error handler
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const path = issue.path.join(".") || "_";
      if (!fields[path]) fields[path] = issue.message;
    }
    res.status(400).json({
      error: { code: "validation_error", message: "invalid request", fields },
    });
    return;
  }

  if (err instanceof MoneyError) {
    res.status(400).json({
      error: {
        code: "validation_error",
        message: "invalid amount",
        fields: { amount: err.message },
      },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, fields: err.fields },
    });
    return;
  }

  console.error("unhandled error:", err);
  res.status(500).json({
    error: { code: "internal_error", message: "something went wrong" },
  });
}
