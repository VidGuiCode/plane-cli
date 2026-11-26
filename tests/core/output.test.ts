import { describe, expect, it, vi, afterEach } from "vitest";
import { PlaneApiError, PlaneApiRateLimitError } from "../../src/core/api-client.js";
import { describeBatchError, printErrorJson, ValidationError } from "../../src/core/errors.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("printErrorJson", () => {
  it("prints structured API errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new PlaneApiError(404, "Not found", "GET", "projects/123/", {
      requestId: "abc",
    });

    printErrorJson(error, "plane issue get");

    const payload = JSON.parse(spy.mock.calls[0]?.[0] as string) as {
      code: string;
      details: { httpStatus: number; method: string; path: string; requestId: string };
    };
    expect(payload.code).toBe("API_ERROR");
    expect(payload.details.httpStatus).toBe(404);
    expect(payload.details.method).toBe("GET");
    expect(payload.details.path).toBe("projects/123/");
    expect(payload.details.requestId).toBe("abc");
    expect(payload).toMatchObject({
      command: "plane issue get",
      retryable: false,
      suggestedFix: expect.stringContaining("Verify"),
    });
  });

  it("prints structured rate limit errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new PlaneApiRateLimitError(429, "Slow down", 30, "POST", "issues/", {
      response: "later",
    });

    printErrorJson(error);

    const payload = JSON.parse(spy.mock.calls[0]?.[0] as string) as {
      code: string;
      details: { retryAfter: number; httpStatus: number };
    };
    expect(payload.code).toBe("RATE_LIMITED");
    expect(payload.details.httpStatus).toBe(429);
    expect(payload.details.retryAfter).toBe(30);
    expect(payload).toMatchObject({
      retryable: true,
      suggestedFix: expect.stringContaining("rate limit"),
    });
  });

  it.each(["GET", "POST"])("classifies HTTP 503 for %s", (method) => {
    const { errorDetails } = describeBatchError(
      new PlaneApiError(503, "Unavailable", method, "issues/"),
      "plane issue bulk-create",
    );
    expect(errorDetails).toMatchObject({
      code: "API_ERROR",
      command: "plane issue bulk-create",
      retryable: method === "GET",
      suggestedFix: expect.stringContaining(method === "GET" ? "Wait" : "took effect"),
    });
  });

  it("preserves the batch error text and flags a validation failure", () => {
    expect(
      describeBatchError(new ValidationError("Invalid date"), "plane issue bulk-create"),
    ).toMatchObject({
      error: "Invalid date",
      errorDetails: {
        code: "ValidationError",
        command: "plane issue bulk-create",
        retryable: false,
        suggestedFix: expect.stringContaining("Correct the input"),
      },
    });
  });
});
