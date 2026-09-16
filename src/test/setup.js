import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  // Tests that opt into the Node environment (e.g. pdf.js tests) have no localStorage.
  if (typeof localStorage !== "undefined") localStorage.clear();
});
