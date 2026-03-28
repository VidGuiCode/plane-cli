import { describe, expect, it } from "vitest";
import { unwrap, PlaneApiClient, PlaneApiError } from "../../src/core/api-client.js";

describe("unwrap", () => {
  describe("array input", () => {
    it("should return array as-is", () => {
      const input = [1, 2, 3];
      const result = unwrap<number>(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should handle empty array", () => {
      const input: number[] = [];
      const result = unwrap<number>(input);
      expect(result).toEqual([]);
    });

    it("should handle array with objects", () => {
      const input = [{ id: 1 }, { id: 2 }];
      const result = unwrap<{ id: number }>(input);
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("should handle array with strings", () => {
      const input = ["a", "b", "c"];
      const result = unwrap<string>(input);
      expect(result).toEqual(["a", "b", "c"]);
    });
  });

  describe("object with results", () => {
    it("should extract results from object", () => {
      const input = { results: [1, 2, 3] };
      const result = unwrap<number>(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should handle empty results array", () => {
      const input = { results: [] };
      const result = unwrap<unknown>(input);
      expect(result).toEqual([]);
    });

    it("should handle results with objects", () => {
      const input = { results: [{ name: "test" }, { name: "other" }] };
      const result = unwrap<{ name: string }>(input);
      expect(result).toEqual([{ name: "test" }, { name: "other" }]);
    });

    it("should not mutate original object", () => {
      const input = { results: [1, 2, 3], other: "property" };
      unwrap<number>(input);
      expect(input).toEqual({ results: [1, 2, 3], other: "property" });
    });
  });

  describe("null input", () => {
    it("should return empty array for null", () => {
      const result = unwrap<unknown>(null);
      expect(result).toEqual([]);
    });
  });

  describe("undefined input", () => {
    it("should return empty array for undefined", () => {
      const result = unwrap<unknown>(undefined);
      expect(result).toEqual([]);
    });
  });

  describe("string input", () => {
    it("should return empty array for string", () => {
      const result = unwrap<unknown>("test");
      expect(result).toEqual([]);
    });

    it("should return empty array for empty string", () => {
      const result = unwrap<unknown>("");
      expect(result).toEqual([]);
    });
  });

  describe("number input", () => {
    it("should return empty array for number", () => {
      const result = unwrap<unknown>(42);
      expect(result).toEqual([]);
    });

    it("should return empty array for zero", () => {
      const result = unwrap<unknown>(0);
      expect(result).toEqual([]);
    });
  });

  describe("boolean input", () => {
    it("should return empty array for true", () => {
      const result = unwrap<unknown>(true);
      expect(result).toEqual([]);
    });

    it("should return empty array for false", () => {
      const result = unwrap<unknown>(false);
      expect(result).toEqual([]);
    });
  });

  describe("object without results", () => {
    it("should return empty array for plain object", () => {
      const input = { foo: "bar" };
      const result = unwrap<unknown>(input);
      expect(result).toEqual([]);
    });

    it("should return empty array for object with non-array results property", () => {
      const input = { results: "not an array" };
      const result = unwrap<unknown>(input);
      expect(result).toEqual([]);
    });

    it("should return empty array for empty object", () => {
      const input = {};
      const result = unwrap<unknown>(input);
      expect(result).toEqual([]);
    });
  });
});

describe("PlaneApiError", () => {
  it("should create error with status and message", () => {
    const error = new PlaneApiError(404, "Not found");
    expect(error.status).toBe(404);
    expect(error.message).toBe("API error 404: Not found");
  });

  it("should be instance of Error", () => {
    const error = new PlaneApiError(500, "Server error");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("PlaneApiClient", () => {
  it("should create client with options", () => {
    const client = new PlaneApiClient({
      baseUrl: "https://api.example.com",
      token: "test-token",
      apiStyle: "issues",
    });
    expect(client.baseUrl).toBe("https://api.example.com");
    expect(client.token).toBe("test-token");
  });

  it("should return 'issues' for issues segment when apiStyle is 'issues'", () => {
    const client = new PlaneApiClient({
      baseUrl: "https://api.example.com",
      token: "test-token",
      apiStyle: "issues",
    });
    expect(client.issuesSegment()).toBe("issues");
  });

  it("should return 'work-items' for issues segment when apiStyle is 'work-items'", () => {
    const client = new PlaneApiClient({
      baseUrl: "https://api.example.com",
      token: "test-token",
      apiStyle: "work-items",
    });
    expect(client.issuesSegment()).toBe("work-items");
  });
});
