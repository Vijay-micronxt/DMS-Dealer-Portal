import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner, ErrorState } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/erp-client";
import { myProfile, myDues, updateMyEmail } from "@/api/profile";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

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
              <p className="text-xs text-zinc-400">Classification</p>
              <p className="text-sm text-zinc-900">
                {profile.classification ?? "—"}
              </p>
            </div>
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

        <SignInSecurityCard email={profile.email} />

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

/** Lets a dealer set the email + password that loginWithPassword (lib/auth) checks
 * next time -- OTP always stays the fallback (no "forgot password" flow exists,
 * since this app sends no real email), so this is the only way in to set one up. */
function SignInSecurityCard({ email }: { email: string | null }) {
  const { setMyPassword } = useAuth();
  const queryClient = useQueryClient();

  const [emailInput, setEmailInput] = React.useState(email ?? "");
  const [emailStatus, setEmailStatus] = React.useState<string | null>(null);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [savingEmail, setSavingEmail] = React.useState(false);

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordStatus, setPasswordStatus] = React.useState<string | null>(
    null,
  );
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [savingPassword, setSavingPassword] = React.useState(false);

  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailStatus(null);
    setEmailError(null);
    setSavingEmail(true);
    try {
      await updateMyEmail(emailInput.trim());
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      setEmailStatus("Email saved.");
    } catch (err) {
      setEmailError(
        err instanceof ApiError ? err.message : "Couldn't save that email.",
      );
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordStatus(null);
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    setSavingPassword(true);
    try {
      await setMyPassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus("Password set. You can now sign in with it.");
    } catch (err) {
      setPasswordError(
        err instanceof ApiError ? err.message : "Couldn't set that password.",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <p className="text-sm font-medium text-zinc-900">
            Sign-in & security
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Set an email and password for a faster way in, alongside phone +
            OTP.
          </p>
        </div>

        <form onSubmit={handleSaveEmail} className="space-y-2">
          <label className="block text-xs font-medium text-zinc-700">
            Email
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="mt-1"
            />
          </label>
          {emailError && <p className="text-xs text-red-600">{emailError}</p>}
          {emailStatus && (
            <p className="text-xs text-emerald-700">{emailStatus}</p>
          )}
          <Button
            type="submit"
            size="sm"
            variant="outline"
            loading={savingEmail}
            disabled={!emailInput.trim() || emailInput.trim() === email}
          >
            Save email
          </Button>
        </form>

        <form
          onSubmit={handleSetPassword}
          className="space-y-2 border-t border-zinc-100 pt-4"
        >
          <label className="block text-xs font-medium text-zinc-700">
            New password
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-700">
            Confirm password
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1"
            />
          </label>
          {!emailInput.trim() && (
            <p className="text-xs text-zinc-400">
              Save an email above first — a password needs one to sign in with.
            </p>
          )}
          {passwordError && (
            <p className="text-xs text-red-600">{passwordError}</p>
          )}
          {passwordStatus && (
            <p className="text-xs text-emerald-700">{passwordStatus}</p>
          )}
          <Button
            type="submit"
            size="sm"
            variant="outline"
            loading={savingPassword}
            disabled={!emailInput.trim() || !newPassword || !confirmPassword}
          >
            Set password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
