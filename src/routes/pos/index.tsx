import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/pos/")({
  component: PosIndexRedirect,
});

function PosIndexRedirect() {
  return <Navigate to="/" search={{ area: undefined, activeOnly: false }} />;
}
