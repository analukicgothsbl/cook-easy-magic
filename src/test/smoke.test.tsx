import { render, screen } from "@testing-library/react";

function TestComponent() {
  return <h1>Cook Master</h1>;
}

describe("test setup", () => {
  it("renders a component in jsdom", () => {
    render(<TestComponent />);
    expect(screen.getByRole("heading", { name: "Cook Master" })).toBeInTheDocument();
  });
});
