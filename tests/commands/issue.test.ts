import { describe, expect, it } from "vitest";
import { assertIssueUpdateRoundTrip } from "../../src/commands/issue.js";
import type { PlaneIssue } from "../../src/core/types.js";

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

describe("assertIssueUpdateRoundTrip", () => {
  it("accepts matching returned fields", () => {
    expect(() =>
      assertIssueUpdateRoundTrip(
        issue({
          name: "Updated",
          description_stripped: "New description",
          priority: "high",
          state: "state-1",
          assignees: ["user-1"],
          labels: [{ id: "label-1", name: "Backend", color: "#000000" }],
          target_date: "2030-01-01",
          start_date: null,
        }),
        {
          name: "Updated",
          description_html: "<p>New description</p>",
          priority: "high",
          state: "state-1",
          assignees: ["user-1"],
          labels: ["label-1"],
          target_date: "2030-01-01",
          start_date: null,
        },
      ),
    ).not.toThrow();
  });

  it("throws when a requested field is silently ignored", () => {
    expect(() =>
      assertIssueUpdateRoundTrip(issue({ target_date: null }), {
        target_date: "2030-01-01",
      }),
    ).toThrow(/target_date/);
  });

  it("throws when returned labels do not include requested label IDs", () => {
    expect(() =>
      assertIssueUpdateRoundTrip(issue({ labels: [] }), {
        labels: ["label-1"],
      }),
    ).toThrow(/labels/);
  });
});
