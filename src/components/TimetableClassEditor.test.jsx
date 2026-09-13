import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TimetableClassEditor from "./TimetableClassEditor";

const existingClass = {
  id: "1-660-L-24B41EC311",
  dayIndex: 1,
  startMinutes: 660,
  durationMinutes: 50,
  type: "L",
  code: "24B41EC311",
  name: "Operating System Concepts",
  room: "226",
  teachers: ["ANG"],
  batches: ["E1"],
};

describe("TimetableClassEditor", () => {
  it("adding a class: no delete button, defaults, calls onSave with a well-formed candidate", () => {
    const onSave = vi.fn();
    render(<TimetableClassEditor open onOpenChange={() => {}} initial={null} onSave={onSave} onDelete={null} />);

    expect(screen.getByText("Add class")).toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Subject code"), { target: { value: "18b11ec212" } });
    fireEvent.change(screen.getByLabelText("Room"), { target: { value: "226" } });
    fireEvent.click(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ dayIndex: 1, startMinutes: 540, durationMinutes: 50, type: "L", code: "18B11EC212", room: "226", batches: [] }),
      null,
    );
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("id");
  });

  it("editing pre-fills fields, keeps the id, and offers delete", () => {
    const onSave = vi.fn();
    const onDelete = vi.fn();
    render(<TimetableClassEditor open onOpenChange={() => {}} initial={existingClass} onSave={onSave} onDelete={onDelete} />);

    expect(screen.getByText("Edit class")).toBeInTheDocument();
    expect(screen.getByDisplayValue("24B41EC311")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Operating System Concepts")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ANG")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Room"), { target: { value: "CR54" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: existingClass.id, room: "CR54" }), null);
  });

  it("passes a non-empty portal-code field through as the alias, and empty as null", () => {
    const onSave = vi.fn();
    render(<TimetableClassEditor open onOpenChange={() => {}} initial={existingClass} onSave={onSave} onDelete={() => {}} />);

    fireEvent.change(screen.getByLabelText(/Portal calls this subject/), { target: { value: "25b22ec311" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith(expect.anything(), "25B22EC311");
  });

  it("shows a validation error instead of saving when the end time isn't after the start", () => {
    const onSave = vi.fn();
    render(<TimetableClassEditor open onOpenChange={() => {}} initial={existingClass} onSave={onSave} onDelete={() => {}} />);

    fireEvent.change(screen.getByLabelText("End"), { target: { value: "10:00" } }); // before/at some starts, but pick before start:
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "12:00" } });
    fireEvent.click(screen.getByText("Save"));

    expect(screen.getByRole("alert")).toHaveTextContent(/after start/);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("existingAlias pre-fills the portal-code field", () => {
    render(<TimetableClassEditor open onOpenChange={() => {}} initial={existingClass} existingAlias="25B22EC311" onSave={() => {}} onDelete={() => {}} />);
    expect(screen.getByDisplayValue("25B22EC311")).toBeInTheDocument();
  });
});
