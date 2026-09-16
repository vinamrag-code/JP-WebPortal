import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PdfTimetableImport from "./PdfTimetableImport";
import { loadSchedule } from "@/lib/timetable/timetableStore";

// PdfTimetableImport loads the parser and pdf.js dynamically to keep them out of the main bundle. Mock only
// parseTimetablePdf (via vi.hoisted, since vi.mock factories run before any top-level const); schedule.js's own
// real use of selectEntriesForStudent from the same module must keep working unmocked.
const { parseResult } = vi.hoisted(() => ({
  parseResult: {
    entries: [
      { day: "MONDAY", dayIndex: 1, startMinutes: 660, durationMinutes: 50, type: "L", batches: ["E1", "E2"], code: "24B41EC311", room: "226", teachers: ["ANG"] },
      { day: "TUESDAY", dayIndex: 2, startMinutes: 480, durationMinutes: 50, type: "L", batches: ["ALL"], code: "18B12MA312", room: "3040", teachers: ["MUKESH"] },
    ],
    batches: ["E1", "E2"],
    electives: ["18B12MA312"],
    warnings: ["Page 1: no room or teacher in \"x\""],
  },
}));

vi.mock("@/lib/timetable/pdfTimetableParser", async (importOriginal) => ({
  ...(await importOriginal()),
  parseTimetablePdf: vi.fn().mockResolvedValue(parseResult),
}));
vi.mock("@/lib/timetable/pdfjsBrowser", () => ({ default: {} }));

const registeredSubjects = [
  { subject_code: "24B41EC311", subject_desc: "OPERATING SYSTEM CONCEPTS" },
  { subject_code: "18B12MA312", subject_desc: "LOGICAL REASONING AND INEQUALITIES" },
];

const uploadFile = async () => {
  const file = new File(["%PDF-1.4"], "timetable.pdf", { type: "application/pdf" });
  Object.defineProperty(file, "arrayBuffer", { value: () => Promise.resolve(new ArrayBuffer(8)) });
  fireEvent.change(screen.getByTestId("pdf-file-input"), { target: { files: [file] } });
  await screen.findByTestId("batch-select");
};

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("PdfTimetableImport", () => {
  it("parses the file, suggests a batch from registered subjects, and auto-selects a registered elective", async () => {
    render(<PdfTimetableImport registeredSubjects={registeredSubjects} onSaved={() => {}} />);
    await uploadFile();

    expect(screen.getByTestId("batch-select")).toHaveTextContent("E1"); // ranked ahead of E2 (matches the registered subject)
    expect(screen.getByTestId("elective-18B12MA312")).toHaveClass(/primary/);
    expect(screen.getByText(/1 spot in the PDF needed a guess/)).toBeInTheDocument();
    expect(screen.getByText("Preview — 2 classes/week")).toBeInTheDocument();
  });

  it("deselecting an elective removes it from the preview count", async () => {
    render(<PdfTimetableImport registeredSubjects={registeredSubjects} onSaved={() => {}} />);
    await uploadFile();

    fireEvent.click(screen.getByTestId("elective-18B12MA312"));
    expect(screen.getByText("Preview — 1 classes/week")).toBeInTheDocument();
  });

  it("saving writes a valid schedule to storage and calls onSaved", async () => {
    const onSaved = vi.fn();
    render(<PdfTimetableImport registeredSubjects={registeredSubjects} onSaved={onSaved} />);
    await uploadFile();

    fireEvent.click(screen.getByTestId("save-schedule"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    const { schedule, status } = loadSchedule();
    expect(status).toBe("ok");
    expect(schedule.batch).toBe("E1");
    expect(schedule.fileName).toBe("timetable.pdf");
    expect(schedule.classes).toHaveLength(2);
  });
});
