import { describe, expect, it } from "vitest";
import { parseEntryText, parseTimetablePages, selectEntriesForStudent } from "./pdfTimetableParser";

// ---- Synthetic page builder, laid out like the JIIT sheet (842×595 pt, 10 hourly columns) ----
const HEADERS = [
  ["8 - 8:50 AM", 87.8, 21.9], ["9 - 9:50 AM", 174.9, 21.9], ["10:00-10:50 AM", 256.2, 29.9], ["11:00-11:50 AM", 344.7, 29.5],
  ["12:00 - 12:50 PM", 430.1, 31.9], ["1:00 PM - 1:50PM", 504.5, 34.3], ["2:00 PM - 2:50 PM", 578.1, 35.4],
  ["3:00 PM - 3 :50 PM", 653.7, 36.5], ["4:00 PM -4:50 PM", 722.3, 34.3], ["5:00 PM - 5:50 PM", 777.5, 35.4],
];
const CENTRE = Object.fromEntries(HEADERS.map(([, x, w], i) => [8 + i, x + w / 2]));
const headerItems = () => HEADERS.map(([str, x, w]) => ({ str, x, y: 38.9, w, h: 4.4 }));
const label = (str, y) => ({ str, x: 25, y, w: 22, h: 4.7 });
/** An entry of width `w` centred at `cx`. */
const cell = (str, cx, y, w = 50) => ({ str, x: cx - w / 2, y, w, h: 4.4 });
const page = (items) => ({ width: 842, height: 595, items: [...headerItems(), ...items] });

describe("parseEntryText", () => {
  it("reads a standard entry", () => {
    expect(parseEntryText("LE1E2(24B41EC311)- 226/ANG")).toEqual({
      type: "L", batches: ["E1", "E2"], code: "24B41EC311", room: "226", teachers: ["ANG"],
    });
  });

  it("tolerates spaces after the type, inside batches and around the code", () => {
    expect(parseEntryText("P F18 F19(24B15CS313) -CR99/HMA/MINAL/NISHANT")).toMatchObject({
      type: "P", batches: ["F18", "F19"], room: "CR99", teachers: ["HMA", "MINAL", "NISHANT"],
    });
    expect(parseEntryText("LALL (16B1NPH531) -CR54 /KAS")).toMatchObject({ batches: ["ALL"], code: "16B1NPH531", room: "CR54", teachers: ["KAS"] });
  });

  it("keeps a blank room blank instead of shifting the teacher into it", () => {
    const r = parseEntryText("TF10(24B11CS313)-/VAIBHAV SHARMA");
    expect(r).toMatchObject({ room: "", teachers: ["VAIBHAV SHARMA"] });
    expect(r.warning).toBe("no room");
  });

  it("trims stray dashes and reports a missing teacher", () => {
    expect(parseEntryText("PF3F7(26B16CS318)-3067-/JSH")).toMatchObject({ room: "3067", teachers: ["JSH"] });
    expect(parseEntryText("PF7F8F18(24B16CS320)-3067/-PRY")).toMatchObject({ room: "3067", teachers: ["PRY"] });
    expect(parseEntryText("LALL(26B12CS316) -226/").warning).toBe("no teacher");
  });

  it("splits a room that runs into the teacher name, with a warning", () => {
    const r = parseEntryText("TF6(24B11CS313)-244VAISHNAVI");
    expect(r).toMatchObject({ room: "244", teachers: ["VAISHNAVI"] });
    expect(r.warning).toMatch(/not separated/);
  });

  it("repairs a batch list with a dropped letter", () => {
    const r = parseEntryText("PF3 F16F17F1819(26B16CS314)-3067/NFCS");
    expect(r.batches).toEqual(["F3", "F16", "F17", "F18", "F19"]);
    expect(r.warning).toMatch(/F1819/);
  });

  it("handles special batch names and multi-word rooms", () => {
    expect(parseEntryText("LFXFY(24B11CS312)-230/AB").batches).toEqual(["FXFY"]);
    expect(parseEntryText("PALL(26B16CS315)-AIML LAB/NFCS9/NFCS10")).toMatchObject({ room: "AIML LAB", teachers: ["NFCS9", "NFCS10"] });
  });

  it("rejects text that is not an entry", () => {
    expect(parseEntryText("Faculty Abbreviation")).toBeNull();
    expect(parseEntryText("LE1E2 missing code")).toBeNull();
  });
});

describe("parseTimetablePages", () => {
  it("maps entries to day and hour from their position", () => {
    const { entries, warnings } = parseTimetablePages([
      page([
        label("MONDAY", 112.4), label("TUESDAY", 252.7),
        cell("LE1E2(24B41EC311)- 226/ANG", CENTRE[11], 114.7),
        cell("TE1(24B41EC311)- 138/ANG", CENTRE[10], 60),
        cell("LE1E2(20B13HS311) -CR54/SHV", CENTRE[10], 201.1),
      ]),
    ]);
    expect(warnings).toEqual([]);
    expect(entries.map((e) => [e.day, e.dayIndex, e.startMinutes, e.durationMinutes, e.type])).toEqual([
      ["MONDAY", 1, 600, 50, "T"],
      ["MONDAY", 1, 660, 50, "L"],
      ["TUESDAY", 2, 600, 50, "L"],
    ]);
  });

  it("gives a lab centred on a column boundary two hours, and a centred lab one", () => {
    const boundary = (CENTRE[14] + CENTRE[15]) / 2;
    const { entries } = parseTimetablePages([
      page([label("MONDAY", 112.4), cell("PE1(24B45EC311)-142/RAP", boundary, 103.9), cell("PE2(18B15EC212)-256A/KDT", CENTRE[10], 80)]),
    ]);
    expect(entries.map((e) => [e.code, e.startMinutes, e.durationMinutes])).toEqual([
      ["18B15EC212", 600, 50],
      ["24B45EC311", 840, 110],
    ]);
  });

  it("re-joins entries that wrap onto following lines", () => {
    const x = CENTRE[8];
    const { entries } = parseTimetablePages([
      page([
        label("MONDAY", 112.4),
        cell("LF10F11F12F13F14F16F17F18F19", x, 61.4, 70), cell("(26B12CS311) -226/JDK", x, 72, 50),
        cell("LF1F2F3F4F5F6F7F8F9(26B12CS318) -244", x, 82.8, 80), cell("B/JSH", x, 93.6, 16),
        cell("TF4(24B11CS313)-138/VAIBHAV", CENTRE[10], 104.4, 60), cell("SHARMA", CENTRE[10], 115.2, 20),
      ]),
    ]);
    expect(entries.map((e) => [e.code, e.room, e.teachers.join("/"), e.batches.length])).toEqual([
      ["26B12CS311", "226", "JDK", 9],
      ["26B12CS318", "244B", "JSH", 9],
      ["24B11CS313", "138", "VAIBHAV SHARMA", 1],
    ]);
  });

  it("continues the last day onto the next page and stops at the faculty table", () => {
    const { entries } = parseTimetablePages([
      page([label("WEDNESDAY", 393), label("THURSDAY", 528.1), cell("LE1E2(24B41EC311)- 230/ANG", CENTRE[12], 560)]),
      page([
        label("THURSDAY", 20.7), // repeated above the header, like the real sheet
        cell("TE1(18B11EC212) -229/PAA", CENTRE[10], 58),
        label("FRIDAY", 155.5), cell("LE1E2(18B11EC212) -226/PAA", CENTRE[10], 150),
        label("SATURDAY", 290.4), cell("LE1E2(18B11EC212) -138/PAA", CENTRE[12], 330),
        { str: "Faculty Abbreviation", x: 73.7, y: 361.3, w: 50.9, h: 5.6 },
        cell("LE9(99X99X999) -1/ZZZ", CENTRE[12], 400), // below the grid: ignored
        { str: "2", x: 814.9, y: 572.8, w: 4, h: 4.4 },
      ]),
      page([cell("26B12CS312", 580, 46.5)]), // headers but no days: course table page, skipped
    ]);
    expect(entries.map((e) => `${e.day} ${e.startMinutes} ${e.room}`)).toEqual([
      "THURSDAY 600 229",
      "THURSDAY 720 230",
      "FRIDAY 600 226",
      "SATURDAY 720 138",
    ]);
  });

  it("lists batches naturally sorted and elective codes", () => {
    const { batches, electives } = parseTimetablePages([
      page([
        label("MONDAY", 112.4),
        cell("LF10F2(1X)-1/A", CENTRE[8], 60), cell("LE1(2X)-1/A", CENTRE[9], 60),
        cell("LALL(18B12MA312)-3040/MUKESH", CENTRE[10], 60), cell("LALL(26B42EC311)-230/ASR", CENTRE[11], 60),
      ]),
    ]);
    expect(batches).toEqual(["E1", "F2", "F10"]);
    expect(electives).toEqual(["18B12MA312", "26B42EC311"]);
  });

  it("warns when the document has no timetable grid", () => {
    const { entries, warnings } = parseTimetablePages([{ width: 595, height: 842, items: [{ str: "Hello", x: 10, y: 10, w: 20, h: 5 }] }]);
    expect(entries).toEqual([]);
    expect(warnings[0]).toMatch(/No time columns/);
  });
});

describe("selectEntriesForStudent", () => {
  const entries = [
    { code: "A", batches: ["E1", "E2"] },
    { code: "B", batches: ["E2"] },
    { code: "C", batches: ["ALL"] },
    { code: "D", batches: ["ALL"] },
  ];

  it("keeps the batch's classes plus chosen electives only", () => {
    expect(selectEntriesForStudent(entries, { batch: "e1 ", electiveCodes: ["c"] }).map((e) => e.code)).toEqual(["A", "C"]);
    expect(selectEntriesForStudent(entries, { batch: "E2" }).map((e) => e.code)).toEqual(["A", "B"]);
  });
});
