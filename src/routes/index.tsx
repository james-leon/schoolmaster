import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { loading, isAuthenticated, user, originalUser, isImpersonating } = useAuth();
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (originalUser?.role === "super_admin" && !isImpersonating) {
      navigate({ to: "/super-admin", replace: true });
      return;
    }
    if (user.role === "parent") {
      navigate({ to: "/parent", replace: true });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }, [loading, isAuthenticated, user, originalUser, isImpersonating, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}
