import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { myProfile, myDues } from "@/api/profile";
import { CredentialsForm } from "@/components/SetCredentialsPrompt";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [editingCredentials, setEditingCredentials] = React.useState(false);

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: myProfile,
  });
  const duesQuery = useQuery({ queryKey: ["my-dues"], queryFn: myDues });

  if (profileQuery.isLoading) {
    return (
      <AppShell>
        <Spinner />
      </AppShell>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <AppShell>
        <ErrorState
          message="Couldn't load your profile."
          onRetry={() => profileQuery.refetch()}
        />
      </AppShell>
    );
  }

  const profile = profileQuery.data;

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-zinc-900">Profile</h1>

        <Card>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-zinc-400">Dealer</p>
              <p className="text-base font-medium text-zinc-900">
                {profile.name}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Phone</p>
              <p className="text-sm text-zinc-900">{profile.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Email</p>
              <p className="text-sm text-zinc-900">{profile.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Classification</p>
              <p className="text-sm text-zinc-900">
                {profile.classification ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-zinc-900">
                Email &amp; password sign-in
              </p>
              <p className="text-xs text-zinc-500">
                {profile.hasPassword
                  ? "Set — you can sign in with your email and password."
                  : "Not set — you sign in with a WhatsApp code."}
              </p>
            </div>
            {editingCredentials ? (
              <CredentialsForm
                profile={profile}
                onDone={() => setEditingCredentials(false)}
                onSecondary={() => setEditingCredentials(false)}
              />
            ) : (
              <Button
                variant="outline"
                onClick={() => setEditingCredentials(true)}
              >
                {profile.hasPassword
                  ? "Change password"
                  : "Set email & password"}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="text-xs text-zinc-400">Outstanding dues</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">
              {duesQuery.isLoading
                ? "…"
                : formatCurrency(duesQuery.data?.outstanding ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          onClick={() => {
            signOut();
            navigate({ to: "/login" });
          }}
        >
          Sign out
        </Button>
      </div>
    </AppShell>
  );
}
