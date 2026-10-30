import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import CataloguePage from "../frontend/pages/catalogue-page";

describe("CataloguePage", () => {
  it("filters courses by search and restores all courses", async () => {
    const user = userEvent.setup();
    render(<CataloguePage />);

    expect(screen.getAllByRole("article")).toHaveLength(3);

    await user.type(screen.getByLabelText("Search courses"), "nonexistent course");
    expect(screen.getByRole("heading", { name: "No courses match that search." })).toBeVisible();
    expect(screen.queryAllByRole("article")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Show all courses" }));
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("filters courses by starting level", async () => {
    const user = userEvent.setup();
    render(<CataloguePage />);

    await user.selectOptions(screen.getByLabelText("Your starting point"), "Beginner");

    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Beginner courses" })).toBeVisible();
  });
});
