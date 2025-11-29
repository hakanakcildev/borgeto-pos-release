import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/pos")({
  component: PosRedirect,
});

function PosRedirect() {
  return <Navigate to="/" search={{ area: undefined, activeOnly: false }} />;
}
