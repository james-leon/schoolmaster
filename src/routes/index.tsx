import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { loading, isAuthenticated, user } = useAuth();
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user) navigate({ to: "/login", replace: true });
    else if (user.role === "parent") navigate({ to: "/parent", replace: true });
    else navigate({ to: "/dashboard", replace: true });
  }, [loading, isAuthenticated, user, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}
