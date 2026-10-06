import { createFileRoute } from "@tanstack/react-router";
import { SafeRouteApp } from "@/components/saferoute/SafeRouteApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SafeRoute — The safest path, not just the shortest" },
      { name: "description", content: "Compare campus routes by lighting, active places, help points and verified reports. Safe Walk, SOS and community reporting." },
      { property: "og:title", content: "SafeRoute — The safest path, not just the shortest" },
      { property: "og:description", content: "Campus route safety scoring, Safe Walk sharing, SOS and moderated reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SafeRouteApp,
});
