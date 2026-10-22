import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { myProfile, setMyPassword, updateMyEmail } from "@/api/profile";
import { clearCredentialsPrompt, isCredentialsPromptDue } from "@/lib/auth";
import { ApiError } from "@/lib/erp-client";
import type { DealerProfile } from "@/api/types";

/**
 * After every OTP sign-in, a dealer with no password yet is offered to set an email + password
 * so next time they can sign in without waiting for a WhatsApp code (Pacific's ask, Oct 2026).
 * "Later" only dismisses it for this sign-in -- it comes back on the next OTP sign-in until a
 * password exists. Mounted once in AppShell.
 */
export function SetCredentialsPrompt() {
  const [due, setDue] = React.useState(isCredentialsPromptDue);
  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: myProfile,
    enabled: due,
  });

  const profile = profileQuery.data;
  // A dealer who already has a password is never prompted; the due flag is simply left to be
  // cleared by sign-out/next answer, since nothing reads it once this returns null.
  if (!due || !profile || profile.hasPassword) return null;

  function close() {
    clearCredentialsPrompt();
    setDue(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="set-credentials-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-zinc-700" />
          <h2
            id="set-credentials-title"
            className="text-base font-semibold text-zinc-900"
          >
            Sign in faster next time
          </h2>
        </div>
        <p className="mb-4 text-sm text-zinc-500">
          Set an email and password, and next time you can sign in with them
          instead of waiting for a WhatsApp code.
        </p>
        <CredentialsForm
          profile={profile}
          onDone={close}
          secondaryLabel="Later"
          onSecondary={close}
        />
      </div>
    </div>
  );
}

/** Email + password form, shared by the post-OTP prompt and the Profile page. */
export function CredentialsForm({
  profile,
  onDone,
  secondaryLabel,
  onSecondary,
}: {
  profile: DealerProfile;
  onDone: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = React.useState(profile.email ?? "");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      if (trimmed !== (profile.email ?? "")) await updateMyEmail(trimmed);
      await setMyPassword(password);
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      onDone();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't save. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm font-medium text-zinc-700">
        Email
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Password
        <Input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Confirm password
        <Input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1.5"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" loading={saving}>
        Save
      </Button>
      {onSecondary && (
        <button
          type="button"
          className="w-full text-center text-sm text-zinc-500 underline"
          onClick={onSecondary}
          disabled={saving}
        >
          {secondaryLabel ?? "Cancel"}
        </button>
      )}
    </form>
  );
}
