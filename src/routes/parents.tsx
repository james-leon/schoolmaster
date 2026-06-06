import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ParentsListView } from "@/components/ParentsListView";

export const Route = createFileRoute("/parents")({
  component: ParentsPage,
});

function ParentsPage() {
  return (
    <AppLayout title="Parents">
      <ParentsListView />
    </AppLayout>
  );
}
