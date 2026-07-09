import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseIssueRef,
  normalizeIssue,
  resolveIssueRef,
  getMemberRole,
  findUnknownFields,
} from "../../src/core/resolvers.js";
import { PlaneApiClient } from "../../src/core/api-client.js";
import { ValidationError } from "../../src/core/errors.js";
import type { PlaneIssue, PlaneMember } from "../../src/core/types.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function makeClient(): PlaneApiClient {
  return new PlaneApiClient({
    baseUrl: "https://plane.example.test",
    token: "test-token",
    apiStyle: "issues",
    retries: 0,
  });
}

function issue(overrides: Partial<PlaneIssue> = {}): PlaneIssue {
  return {
    id: "issue-1",
    sequence_id: 1,
    name: "Original",
    priority: "none",
    assignees: [],
    labels: [],
    target_date: null,
    start_date: null,
    created_at: "2026-05-06T00:00:00Z",
    updated_at: "2026-05-06T00:00:00Z",
    ...overrides,
  };
}

describe("normalizeIssue label fields", () => {
  it("exposes UUIDs in label_ids and names in labels for the nested shape", () => {
    const out = normalizeIssue(
      issue({ labels: [{ id: "label-uuid-1", name: "Backend", color: "#000000" }] }),
      new Map(),
      "ROADMAP",
      "project-123",
    );
    expect(out.labels).toEqual(["Backend"]);
    expect(out.label_ids).toEqual(["label-uuid-1"]);
  });

  it("passes through UUID strings for the flat shape", () => {
    const out = normalizeIssue(
      issue({ labels: ["label-uuid-2"] as unknown as PlaneIssue["labels"] }),
      new Map(),
      "ROADMAP",
      "project-123",
    );
    expect(out.label_ids).toEqual(["label-uuid-2"]);
  });
});

describe("findUnknownFields", () => {
  it("reports names that are not keys of the normalized issue", () => {
    const normalized = normalizeIssue(issue(), new Map(), "ROADMAP", "project-123");
    // description_stripped is the classic trap: normalizeIssue exposes `description`
    expect(findUnknownFields(normalized, "title,description_stripped,bogus")).toEqual([
      "description_stripped",
      "bogus",
    ]);
  });

  it("returns an empty array when every requested name is known", () => {
    const normalized = normalizeIssue(issue(), new Map(), "ROADMAP", "project-123");
    expect(findUnknownFields(normalized, "title,state,priority,dueDate")).toEqual([]);
  });
});

describe("getMemberRole", () => {
  it("reads the top-level flat role", () => {
    expect(getMemberRole({ id: "m1", role: 5 } as PlaneMember)).toBe(5);
  });

  it("reads the double-underscore annotated role", () => {
    expect(getMemberRole({ id: "m1", member__role: 20 } as PlaneMember)).toBe(20);
  });

  it("prefers the nested member.role over a defaulted top-level role", () => {
    const member = {
      id: "m1",
      role: 20,
      member: { id: "u1", display_name: "Owner", role: 5 },
    } as PlaneMember;
    expect(getMemberRole(member)).toBe(5);
  });

  it("returns undefined when no role field is present", () => {
    expect(getMemberRole({ id: "m1", member: "u1" } as PlaneMember)).toBeUndefined();
  });

  it("handles role 0 without treating it as missing", () => {
    expect(getMemberRole({ id: "m1", role: 0 } as PlaneMember)).toBe(0);
  });
});

describe("resolveIssueRef with duplicate sequence_id", () => {
  function mockFetch(issues: unknown[]): void {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      let body: unknown = {};
      if (url.includes("/states/")) {
        body = {
          results: [
            { id: "state-done", name: "Done", group: "completed" },
            { id: "state-backlog", name: "Backlog", group: "backlog" },
          ],
        };
      } else if (url.includes("/issues/")) {
        body = { results: issues, next_page_results: false };
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;
  }

  it("throws a ValidationError naming every candidate UUID when a sequence is ambiguous", async () => {
    mockFetch([
      { id: "uuid-done", sequence_id: 141, name: "Finished ticket", state: "state-done" },
      { id: "uuid-backlog", sequence_id: 141, name: "Planned ticket", state: "state-backlog" },
    ]);

    const client = makeClient();
    let caught: unknown;
    try {
      await resolveIssueRef(client, "workspace", "project-123", "ROADMAP", "issues", "141");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ValidationError);
    const message = (caught as Error).message;
    expect(message).toContain("uuid-done");
    expect(message).toContain("uuid-backlog");
    // State names render on the slow duplicate path
    expect(message).toContain("Done");
    expect(message).toContain("Backlog");
    expect(message).toMatch(/ambiguous/i);
  });

  it("resolves normally when the sequence is unique", async () => {
    mockFetch([{ id: "uuid-only", sequence_id: 141, name: "Only ticket", state: "state-done" }]);

    const client = makeClient();
    const result = await resolveIssueRef(
      client,
      "workspace",
      "project-123",
      "ROADMAP",
      "issues",
      "141",
    );

    expect(result.issueId).toBe("uuid-only");
    expect(result.sequenceId).toBe(141);
  });
});

describe("parseIssueRef", () => {
  describe("UUID format", () => {
    it("should parse standard UUID", () => {
      const result = parseIssueRef("550e8400-e29b-41d4-a716-446655440000");
      expect(result).toEqual({
        type: "uuid",
        uuid: "550e8400-e29b-41d4-a716-446655440000",
      });
    });

    it("should parse uppercase UUID", () => {
      const result = parseIssueRef("550E8400-E29B-41D4-A716-446655440000");
      expect(result).toEqual({
        type: "uuid",
        uuid: "550E8400-E29B-41D4-A716-446655440000",
      });
    });

    it("should parse mixed case UUID", () => {
      const result = parseIssueRef("550e8400-E29B-41d4-A716-446655440000");
      expect(result).toEqual({
        type: "uuid",
        uuid: "550e8400-E29B-41d4-A716-446655440000",
      });
    });
  });

  describe("Slug format", () => {
    it("should parse PROJ-42 format", () => {
      const result = parseIssueRef("PROJ-42");
      expect(result).toEqual({
        type: "slug",
        identifier: "PROJ",
        seq: 42,
      });
    });

    it("should uppercase lowercase identifier", () => {
      const result = parseIssueRef("proj-42");
      expect(result).toEqual({
        type: "slug",
        identifier: "PROJ",
        seq: 42,
      });
    });

    it("should parse mixed case identifier", () => {
      const result = parseIssueRef("Proj-123");
      expect(result).toEqual({
        type: "slug",
        identifier: "PROJ",
        seq: 123,
      });
    });

    it("should parse identifier with numbers", () => {
      const result = parseIssueRef("PROJ2-5");
      expect(result).toEqual({
        type: "slug",
        identifier: "PROJ2",
        seq: 5,
      });
    });

    it("should parse identifier with underscores", () => {
      const result = parseIssueRef("MY_PROJ-99");
      expect(result).toEqual({
        type: "slug",
        identifier: "MY_PROJ",
        seq: 99,
      });
    });

    it("should parse large sequence numbers", () => {
      const result = parseIssueRef("PROJ-999999");
      expect(result).toEqual({
        type: "slug",
        identifier: "PROJ",
        seq: 999999,
      });
    });
  });

  describe("Sequence only format", () => {
    it("should parse plain number", () => {
      const result = parseIssueRef("42");
      expect(result).toEqual({
        type: "seq",
        seq: 42,
      });
    });

    it("should parse single digit", () => {
      const result = parseIssueRef("1");
      expect(result).toEqual({
        type: "seq",
        seq: 1,
      });
    });

    it("should parse large number", () => {
      const result = parseIssueRef("999999");
      expect(result).toEqual({
        type: "seq",
        seq: 999999,
      });
    });

    it("should parse zero", () => {
      const result = parseIssueRef("0");
      expect(result).toEqual({
        type: "seq",
        seq: 0,
      });
    });
  });

  describe("Invalid format", () => {
    it("should throw for empty string", () => {
      expect(() => parseIssueRef("")).toThrow(
        'Cannot parse issue ref: "". Use a sequence number, PROJ-42, or UUID.'
      );
    });

    it("should throw for only letters", () => {
      expect(() => parseIssueRef("PROJ")).toThrow(
        'Cannot parse issue ref: "PROJ". Use a sequence number, PROJ-42, or UUID.'
      );
    });

    it("should throw for invalid format with hyphen", () => {
      expect(() => parseIssueRef("-42")).toThrow(
        'Cannot parse issue ref: "-42". Use a sequence number, PROJ-42, or UUID.'
      );
    });

    it("should throw for space in identifier", () => {
      expect(() => parseIssueRef("MY PROJ-42")).toThrow(
        'Cannot parse issue ref: "MY PROJ-42". Use a sequence number, PROJ-42, or UUID.'
      );
    });

    it("should throw for special characters", () => {
      expect(() => parseIssueRef("PROJ@42")).toThrow(
        'Cannot parse issue ref: "PROJ@42". Use a sequence number, PROJ-42, or UUID.'
      );
    });

    it("should throw for decimal number", () => {
      expect(() => parseIssueRef("42.5")).toThrow(
        'Cannot parse issue ref: "42.5". Use a sequence number, PROJ-42, or UUID.'
      );
    });

    it("should throw for negative number", () => {
      expect(() => parseIssueRef("-5")).toThrow(
        'Cannot parse issue ref: "-5". Use a sequence number, PROJ-42, or UUID.'
      );
    });

    it("should throw for identifier starting with number", () => {
      expect(() => parseIssueRef("2PROJ-42")).toThrow(
        'Cannot parse issue ref: "2PROJ-42". Use a sequence number, PROJ-42, or UUID.'
      );
    });
  });
});
