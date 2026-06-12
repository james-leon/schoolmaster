import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/personnel")({ component: () => <Outlet /> });
