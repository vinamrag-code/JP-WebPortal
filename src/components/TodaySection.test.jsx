import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TodaySection from "./TodaySection";
import { saveSchedule } from "@/lib/timetable/timetableStore";
import { buildSchedule } from "@/lib/timetable/schedule";

const entries = [
  { day: "MONDAY", dayIndex: 1, startMinutes: 660, durationMinutes: 50, type: "L", batches: ["E1"], code: "24B41EC311", room: "226", teachers: ["ANG"] },
];
const scheduleFixture = buildSchedule(entries, { batch: "E1", registeredSubjects: [{ subject_code: "24B41EC311", subject_desc: "Operating System Concepts" }] });

/** 14 Sep 2026 is a Monday. */
const MONDAY_9AM = new Date(2026, 8, 14, 9, 0);

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TodaySection", () => {
  it("prompts to import when no schedule has been saved", () => {
    renderWithRouter(<TodaySection w={null} />);
    expect(screen.getByTestId("today-empty")).toBeInTheDocument();
    expect(screen.getByText("Import timetable")).toBeInTheDocument();
  });

  it("shows today's class without attendance when there is no session", async () => {
    saveSchedule(scheduleFixture);
    // Fake only Date, not setTimeout/setInterval, so Testing Library's real-timer-based polling (waitFor/findBy)
    // still runs; the component's own 60s refresh interval is irrelevant to these tests either way.
    vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(MONDAY_9AM);

    renderWithRouter(<TodaySection w={{ session: null }} />);

    expect(await screen.findByTestId("today-section")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Operating System Concepts")).toBeInTheDocument();
    expect(screen.getByText("–")).toBeInTheDocument(); // no attendance available
  });

  it("fetches and displays attendance when a portal session is available", async () => {
    saveSchedule(scheduleFixture);
    // Fake only Date, not setTimeout/setInterval, so Testing Library's real-timer-based polling (waitFor/findBy)
    // still runs; the component's own 60s refresh interval is irrelevant to these tests either way.
    vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(MONDAY_9AM);

    const w = {
      session: {},
      get_attendance_meta: vi.fn().mockResolvedValue({
        latest_header: () => ({}),
        latest_semester: () => ({ registration_id: "REG1", registration_code: "2026ODDSEM" }),
      }),
      get_attendance: vi.fn().mockResolvedValue({
        studentattendancelist: [{ subjectcode: "OPERATING SYSTEM CONCEPTS(24B41EC311)", LTpercantage: 77.8 }],
      }),
    };

    renderWithRouter(<TodaySection w={w} attendanceGoal={80} />);

    await waitFor(() => expect(screen.getByText("78%")).toBeInTheDocument());
    expect(screen.getByText("78%").className).toMatch(/destructive/); // below the 80% goal passed in
    expect(w.get_attendance_meta).toHaveBeenCalledTimes(1);
  });

  it("shows an inline error without crashing when the attendance fetch fails", async () => {
    saveSchedule(scheduleFixture);
    // Fake only Date, not setTimeout/setInterval, so Testing Library's real-timer-based polling (waitFor/findBy)
    // still runs; the component's own 60s refresh interval is irrelevant to these tests either way.
    vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(MONDAY_9AM);

    const w = { session: {}, get_attendance_meta: vi.fn().mockRejectedValue(new Error("network down")) };
    renderWithRouter(<TodaySection w={w} />);

    expect(await screen.findByText("network down")).toBeInTheDocument();
    expect(screen.getByTestId("today-section")).toBeInTheDocument(); // still renders the schedule
  });
});
