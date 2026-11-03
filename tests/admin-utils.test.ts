import { describe, it, expect } from "vitest";
import { generateCampusCode, generateCodeFromName, formatYearWiseRooms } from "@/lib/utils";

describe("admin utils (A3)", () => {
  describe("generateCampusCode", () => {
    it("handles single-word campus names", () => {
      expect(generateCampusCode("Stanford")).toBe("STANFO");
      expect(generateCampusCode("Harvard")).toBe("HARVAR");
      expect(generateCampusCode("MIT")).toBe("MIT");
    });

    it("filters out stopwords and forms acronyms", () => {
      expect(generateCampusCode("Indian Institute of Technology")).toBe("IIT");
      expect(generateCampusCode("College of Engineering and Technology")).toBe("CET");
    });

    it("preserves pre-existing uppercase acronyms", () => {
      expect(generateCampusCode("FP City Campus")).toBe("FPCC");
      expect(generateCampusCode("SRM University")).toBe("SRMU");
    });

    it("handles empty or blank names safely", () => {
      expect(generateCampusCode("")).toBe("");
      expect(generateCampusCode("   ")).toBe("");
    });
  });

  describe("generateCodeFromName", () => {
    it("converts course names into standardized abbreviations", () => {
      expect(generateCodeFromName("Bachelor of Computer Applications")).toBe("B-O-C-A");
      expect(generateCodeFromName("BSc Computer Science")).toBe("BSC-C-S");
      expect(generateCodeFromName("BBA Finance")).toBe("BBA-F");
    });

    it("handles empty strings safely", () => {
      expect(generateCodeFromName("")).toBe("");
    });
  });

  describe("formatYearWiseRooms", () => {
    it("formats valid JSON string", () => {
      const json = JSON.stringify({ "1": "Room 101", "2": "Room 202" });
      expect(formatYearWiseRooms(json)).toBe("Year 1: Room 101, Year 2: Room 202");
    });

    it("returns raw string if not JSON", () => {
      expect(formatYearWiseRooms("Room A")).toBe("Room A");
    });

    it("returns 'None' when falsy", () => {
      expect(formatYearWiseRooms("")).toBe("None");
      expect(formatYearWiseRooms(undefined)).toBe("None");
    });
  });
});
