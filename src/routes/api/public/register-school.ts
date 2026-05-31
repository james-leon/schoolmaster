import { createFileRoute } from "@tanstack/react-router";

// Public school self-registration has been disabled. Schools are now created
// exclusively by the Wintek platform owner via /api/public/super-admin.
export const Route = createFileRoute("/api/public/register-school")({
  server: {
    handlers: {
      POST: async () =>
        Response.json(
          { error: "L'inscription publique est désactivée. Contactez Wintek pour créer votre école." },
          { status: 403 },
        ),
    },
  },
});
