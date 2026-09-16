import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ScheduleGrid from "./ScheduleGrid";

const schedule = {
  version: 1,
  batch: "E1",
  codeAliases: { "26B42EC313": "25B22EC311" },
  classes: [
    { id: "1-660-L-24B41EC311", dayIndex: 1, startMinutes: 660, durationMinutes: 50, type: "L", code: "24B41EC311", name: "OS Concepts", room: "226", teachers: ["ANG"], batches: ["E1"] },
    { id: "2-480-L-26B42EC313", dayIndex: 2, startMinutes: 480, durationMinutes: 50, type: "L", code: "26B42EC313", name: "VLSI", room: "228", teachers: ["HIG"], batches: ["ALL"] },
  ],
};

describe("ScheduleGrid", () => {
  it("renders each class in its day/time cell, with day headers for every weekday", () => {
    render(<ScheduleGrid schedule={schedule} todayDayIndex={1} onSaveClass={() => {}} onDeleteClass={() => {}} />);
    expect(screen.getByText("OS Concepts")).toBeInTheDocument();
    expect(screen.getByText("VLSI")).toBeInTheDocument();
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((d) => expect(screen.getByText(d)).toBeInTheDocument());
  });

  it("clicking a class opens the editor pre-filled with that class's fields, aliased with its code alias", () => {
    render(<ScheduleGrid schedule={schedule} todayDayIndex={1} onSaveClass={() => {}} onDeleteClass={() => {}} />);
    fireEvent.click(screen.getByTestId("class-2-480-L-26B42EC313"));
    expect(screen.getByText("Edit class")).toBeInTheDocument();
    expect(screen.getByDisplayValue("26B42EC313")).toBeInTheDocument();
    expect(screen.getByDisplayValue("25B22EC311")).toBeInTheDocument(); // pre-filled alias
  });

  it("saving an edit calls onSaveClass with the original class and the updated candidate", () => {
    const onSaveClass = vi.fn();
    render(<ScheduleGrid schedule={schedule} todayDayIndex={1} onSaveClass={onSaveClass} onDeleteClass={() => {}} />);
    fireEvent.click(screen.getByTestId("class-1-660-L-24B41EC311"));
    fireEvent.change(screen.getByLabelText("Room"), { target: { value: "CR54" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSaveClass).toHaveBeenCalledWith(schedule.classes[0], expect.objectContaining({ room: "CR54" }), null);
    expect(screen.queryByText("Edit class")).not.toBeInTheDocument(); // dialog closes after saving
  });

  it("deleting from the editor calls onDeleteClass with the class id and closes the dialog", () => {
    const onDeleteClass = vi.fn();
    render(<ScheduleGrid schedule={schedule} todayDayIndex={1} onSaveClass={() => {}} onDeleteClass={onDeleteClass} />);
    fireEvent.click(screen.getByTestId("class-1-660-L-24B41EC311"));
    fireEvent.click(screen.getByText("Delete"));
    expect(onDeleteClass).toHaveBeenCalledWith("1-660-L-24B41EC311");
    expect(screen.queryByText("Edit class")).not.toBeInTheDocument();
  });

  it("clicking an empty slot opens an empty editor pre-filled with that day and time, and no delete option", () => {
    render(<ScheduleGrid schedule={schedule} todayDayIndex={1} onSaveClass={() => {}} onDeleteClass={() => {}} />);
    fireEvent.click(screen.getByTestId("empty-1-480")); // Monday 08:00, no class there
    expect(screen.getByRole("heading", { name: "Add class" })).toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("08:00")).toBeInTheDocument();
  });
});
