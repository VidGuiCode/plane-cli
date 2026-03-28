import { describe, expect, it } from "vitest";
import { parseIssueRef } from "../../src/core/resolvers.js";

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
