import { describe, it, expect } from "vitest";
import { parseSubjectInput, cleanSubjectName, normalizeSubjectType, parseHoursToken } from "../src/lib/subjectParser";

describe("subjectParser", () => {
  it("parses newline-separated subject names", () => {
    const text = `Data Structures & Algorithms\nComputer Networks\nOperating Systems`;
    const res = parseSubjectInput(text, "SKILL", 4);
    expect(res).toHaveLength(3);
    expect(res[0].name).toBe("Data Structures & Algorithms");
    expect(res[1].name).toBe("Computer Networks");
    expect(res[2].name).toBe("Operating Systems");
    expect(res[0].type).toBe("SKILL");
    expect(res[0].weekly_hours).toBe(4);
  });

  it("parses comma-separated subject names on a single line", () => {
    const text = "Data Structures, Computer Networks, Operating Systems, Database Systems";
    const res = parseSubjectInput(text, "ACADEMIC", 3);
    expect(res).toHaveLength(4);
    expect(res.map(r => r.name)).toEqual([
      "Data Structures",
      "Computer Networks",
      "Operating Systems",
      "Database Systems"
    ]);
    expect(res[0].type).toBe("ACADEMIC");
    expect(res[0].weekly_hours).toBe(3);
  });

  it("parses semicolon-separated subject names", () => {
    const text = "Advanced Java; Machine Learning; Cloud Computing";
    const res = parseSubjectInput(text, "SKILL", 4);
    expect(res).toHaveLength(3);
    expect(res[0].name).toBe("Advanced Java");
    expect(res[1].name).toBe("Machine Learning");
    expect(res[2].name).toBe("Cloud Computing");
  });

  it("parses Excel / Google Sheets tab-separated rows with columns", () => {
    const excelText = `Data Structures\tSKILL\t4\nComputer Networks\tTHEORY\t3\nWeb Technology Lab\tLAB\t2`;
    const res = parseSubjectInput(excelText);
    expect(res).toHaveLength(3);
    expect(res[0].name).toBe("Data Structures");
    expect(res[0].type).toBe("SKILL");
    expect(res[0].weekly_hours).toBe(4);

    expect(res[1].name).toBe("Computer Networks");
    expect(res[1].type).toBe("ACADEMIC");
    expect(res[1].weekly_hours).toBe(3);

    expect(res[2].name).toBe("Web Technology Lab");
    expect(res[2].type).toBe("LAB");
    expect(res[2].weekly_hours).toBe(2);
  });

  it("skips leading serial numbers in Excel tab-separated rows", () => {
    const excelText = `1\tArtificial Intelligence\tSKILL\t4\n2\tCompiler Design\tTHEORY\t3`;
    const res = parseSubjectInput(excelText);
    expect(res).toHaveLength(2);
    expect(res[0].name).toBe("Artificial Intelligence");
    expect(res[1].name).toBe("Compiler Design");
  });

  it("ignores header row in Excel/CSV tables", () => {
    const textWithHeader = `Subject Name\tDomain / Type\tWeekly Hours\nData Structures\tSKILL\t4\nOperating Systems\tTHEORY\t4`;
    const res = parseSubjectInput(textWithHeader);
    expect(res).toHaveLength(2);
    expect(res[0].name).toBe("Data Structures");
    expect(res[1].name).toBe("Operating Systems");
  });

  it("cleans bullets and numbering prefixes", () => {
    const text = `1. Object Oriented Programming\n2) Discrete Mathematics\n• Digital Electronics\n- Software Engineering`;
    const res = parseSubjectInput(text);
    expect(res).toHaveLength(4);
    expect(res[0].name).toBe("Object Oriented Programming");
    expect(res[1].name).toBe("Discrete Mathematics");
    expect(res[2].name).toBe("Digital Electronics");
    expect(res[3].name).toBe("Software Engineering");
  });

  it("parses single CSV row with type and hours correctly", () => {
    const csvRow = `Engineering Physics, ACADEMIC, 3`;
    const res = parseSubjectInput(csvRow);
    expect(res).toHaveLength(1);
    expect(res[0].name).toBe("Engineering Physics");
    expect(res[0].type).toBe("ACADEMIC");
    expect(res[0].weekly_hours).toBe(3);
  });

  it("deduplicates identical subject names", () => {
    const text = `Python Programming\npython programming\nPYTHON PROGRAMMING\nJava Programming`;
    const res = parseSubjectInput(text);
    expect(res).toHaveLength(2);
    expect(res[0].name).toBe("Python Programming");
    expect(res[1].name).toBe("Java Programming");
  });
});
