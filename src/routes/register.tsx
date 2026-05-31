import { createFileRoute, Navigate } from "@tanstack/react-router";

// Public self-registration is disabled. Only the platform owner (Wintek)
// can create schools, from the Super Admin console.
export const Route = createFileRoute("/register")({
  component: () => <Navigate to="/login" replace />,
});
