import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";

/** Shown instead of a screen the signed-in person's dealer role does not allow. The server
 * refuses the calls anyway; this is what they see instead of an error. */
export function NoAccess({ what }: { what: string }) {
  return (
    <AppShell>
      <Card>
        <CardContent className="space-y-1 text-center">
          <p className="text-sm font-medium text-zinc-900">
            Your account can't {what}.
          </p>
          <p className="text-sm text-zinc-500">
            Please ask the person who manages your account with Pacific.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
