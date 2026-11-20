import { createFileRoute, redirect } from "@tanstack/react-router";

// The portal opens on the enquiry screen: a dealer's main job is asking about an item and
// quantity, so the item search is the first thing they see rather than a browse list.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/enquiry" });
  },
});
