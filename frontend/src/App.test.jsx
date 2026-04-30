import React from "react";
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
import App from "./App";

// Mocks des pages (on force un contenu simple et stable)
vi.mock("./pages/Home.jsx", () => ({ default: () => <h1>HOME_PAGE</h1> }));
vi.mock("./pages/Sponsors.jsx", () => ({ default: () => <h1>SPONSORS_PAGE</h1> }));
vi.mock("./pages/Tournoi.jsx", () => ({ default: () => <h1>TOURNOI_PAGE</h1> }));
vi.mock("./pages/InscriptionTournoi.jsx", () => ({ default: () => <h1>INSCRIPTION_PAGE</h1> }));

vi.mock("./pages/AdminLogin.jsx", () => ({ default: () => <h1>ADMIN_LOGIN_PAGE</h1> }));
vi.mock("./pages/AdminDashboard.jsx", () => ({ default: () => <h1>ADMIN_DASHBOARD_PAGE</h1> }));
vi.mock("./pages/AdminUsers.jsx", () => ({ default: () => <h1>ADMIN_USERS_PAGE</h1> }));
vi.mock("./pages/GestionTournoi", () => ({ default: () => <h1>ADMIN_TOURNOIS_PAGE</h1> }));

// ✅ Layout mock qui rend réellement <Outlet />
vi.mock("./components/Layout.jsx", () => ({
  default: function LayoutMock() {
    return (
      <div>
        <header>LAYOUT</header>
        <Outlet />
      </div>
    );
  },
}));

describe("App routing", () => {
  test("route /admin affiche la page AdminLogin", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("ADMIN_LOGIN_PAGE")).toBeInTheDocument();
  });

  test("route / affiche la page Home", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("HOME_PAGE")).toBeInTheDocument();
  });

  test("route /admin/dashboard affiche le dashboard", () => {
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("ADMIN_DASHBOARD_PAGE")).toBeInTheDocument();
  });
});