import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/unauthorized")({
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold">Accès refusé</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vous n'avez pas les droits pour accéder à cette section.
        </p>
        <div className="mt-6">
          <Button
            onClick={() =>
              navigate({ to: user?.role === "parent" ? "/parent" : "/dashboard" })
            }
          >
            Retour au tableau de bord
          </Button>
        </div>
      </div>
    </div>
  );
}
