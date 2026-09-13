import { describe, expect, it } from "vitest";
import {
  attendanceByCode,
  attendanceCodeFor,
  extractSubjectCode,
  extractSubjectName,
  rankBatches,
  shortNameFor,
  subjectNamesByCode,
  suggestElectives,
  unmatchedCodes,
} from "./subjectMatching";

// Shapes as observed live (Sept 2026); IDs and values synthetic.
const registered = [
  { subject_code: "24B41EC311", subject_desc: "OPERATING SYSTEM CONCEPTS", subject_component_code: "L" },
  { subject_code: "24B41EC311", subject_desc: "OPERATING SYSTEM CONCEPTS", subject_component_code: "T" },
  { subject_code: "18B12MA312", subject_desc: "LOGICAL REASONING AND INEQUALITIES", subject_component_code: "L" },
  { subject_code: "25B22EC311", subject_desc: "Design Principles of VLSI Systems using Verilog", subject_component_code: "L" },
];
const attendanceRows = [
  { subjectcode: "OPERATING SYSTEM CONCEPTS(24B41EC311)", Lpercentage: 76.9, Tpercentage: "80.0", Ppercentage: null, LTpercantage: 77.8 },
  { subjectcode: "Design Principles of VLSI Systems using Verilog(25B22EC311)", Lpercentage: 93.3, LTpercantage: 93.3 },
  { subjectcode: "SUMMER TRAINING-II(24B17EC311)", LTpercantage: "" },
];

describe("code and name extraction", () => {
  it("splits NAME(CODE) and tolerates bare codes and brackets inside names", () => {
    expect(extractSubjectCode("OPERATING SYSTEM CONCEPTS(24B41EC311)")).toBe("24B41EC311");
    expect(extractSubjectName("OPERATING SYSTEM CONCEPTS(24B41EC311)")).toBe("OPERATING SYSTEM CONCEPTS");
    expect(extractSubjectCode("ELECTIVE (DEPT) TOPIC(25b22ec311) ")).toBe("25B22EC311");
    expect(extractSubjectName("ELECTIVE (DEPT) TOPIC(25B22EC311)")).toBe("ELECTIVE (DEPT) TOPIC");
    expect(extractSubjectCode(" 24b41ec311 ")).toBe("24B41EC311");
  });
});

describe("registered subjects", () => {
  it("maps codes to names once per subject", () => {
    expect([...subjectNamesByCode(registered).entries()]).toEqual([
      ["24B41EC311", "OPERATING SYSTEM CONCEPTS"],
      ["18B12MA312", "LOGICAL REASONING AND INEQUALITIES"],
      ["25B22EC311", "Design Principles of VLSI Systems using Verilog"],
    ]);
  });

  it("suggests only electives the student is registered for", () => {
    expect(suggestElectives(["18B12MA312", "26B42EC311", "26B42EC313"], registered)).toEqual(["18B12MA312"]);
  });

  it("ranks batches by overlap with registered subjects", () => {
    const entries = [
      { batches: ["E1", "E2"], code: "24B41EC311" },
      { batches: ["E1"], code: "18B11EC212" },
      { batches: ["F1"], code: "99X" },
      { batches: ["ALL"], code: "18B12MA312" },
    ];
    expect(rankBatches(entries, registered)).toEqual([
      { batch: "E2", matched: 1, total: 1 },
      { batch: "E1", matched: 1, total: 2 },
    ]);
  });
});

describe("attendance joining", () => {
  it("indexes attendance rows by portal code with numeric percentages", () => {
    const byCode = attendanceByCode({ studentattendancelist: attendanceRows });
    expect(byCode.get("24B41EC311")).toEqual({ code: "24B41EC311", name: "OPERATING SYSTEM CONCEPTS", combined: 77.8, lecture: 76.9, tutorial: 80, practical: null });
    expect(byCode.get("24B17EC311").combined).toBeNull();
    expect(attendanceByCode({ response: { studentattendancelist: attendanceRows } }).size).toBe(3);
  });

  it("applies confirmed aliases and reports what is still unmatched", () => {
    expect(attendanceCodeFor("26b42ec313", { "26B42EC313": "25B22EC311" })).toBe("25B22EC311");
    expect(attendanceCodeFor("24B41EC311", {})).toBe("24B41EC311");

    const before = unmatchedCodes(["24B41EC311", "26B42EC313"], attendanceRows);
    expect(before.timetable).toEqual(["26B42EC313"]);
    expect(before.attendance.map((a) => a.code)).toEqual(["25B22EC311", "24B17EC311"]);

    const after = unmatchedCodes(["24B41EC311", "26B42EC313"], attendanceRows, { "26B42EC313": "25B22EC311" });
    expect(after.timetable).toEqual([]);
  });
});

describe("shortNameFor", () => {
  it("acronyms significant words, dropping stopwords", () => {
    expect(shortNameFor("ANALOG AND DIGITAL COMMUNICATION")).toBe("ADC");
    expect(shortNameFor("Design and Analysis of Algorithms")).toBe("DAA");
    expect(shortNameFor("Computer Networks")).toBe("CN");
  });

  it("keeps a trailing Lab as a word instead of folding it into the acronym", () => {
    expect(shortNameFor("ANALOG AND DIGITAL COMMUNICATION LAB")).toBe("ADC Lab");
  });

  it("leaves single-word (or single-significant-word) names unchanged", () => {
    expect(shortNameFor("Mathematics")).toBe("Mathematics");
    expect(shortNameFor("")).toBe("");
    expect(shortNameFor(null)).toBe(null);
  });
});
