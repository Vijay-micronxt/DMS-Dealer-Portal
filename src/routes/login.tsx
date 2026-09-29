import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/erp-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LoginSearch = { redirect?: string | undefined };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect:
      typeof search["redirect"] === "string" ? search["redirect"] : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, requestOtp, verifyOtp, loginWithPassword } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [method, setMethod] = React.useState<"otp" | "password">("otp");
  const [step, setStep] = React.useState<"phone" | "otp">("phone");
  const [phone, setPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (user) navigate({ to: search.redirect ?? "/catalog" });
  }, [user, navigate, search.redirect]);

  function switchMethod(next: "otp" | "password") {
    setMethod(next);
    setStep("phone");
    setError(null);
  }

  async function handleLoginWithPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setSubmitting(true);
    try {
      await loginWithPassword(email.trim(), password);
      navigate({ to: search.redirect ?? "/catalog" });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await requestOtp(phone.trim());
      setStep("otp");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await verifyOtp(phone.trim(), otp.trim());
      navigate({ to: search.redirect ?? "/catalog" });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not verify that code. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-zinc-900">
            Pacific Dealer Portal
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {method === "otp"
              ? "Sign in with your registered phone number"
              : "Sign in with your email and password"}
          </p>
        </div>

        <div className="mb-6 flex rounded-lg border border-zinc-200 bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => switchMethod("otp")}
            className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
              method === "otp"
                ? "bg-zinc-900 text-white"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Phone (OTP)
          </button>
          <button
            type="button"
            onClick={() => switchMethod("password")}
            className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
              method === "password"
                ? "bg-zinc-900 text-white"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Email &amp; Password
          </button>
        </div>

        {method === "password" ? (
          <form onSubmit={handleLoginWithPassword} className="space-y-3">
            <label className="block text-sm font-medium text-zinc-700">
              Email
              <Input
                type="email"
                inputMode="email"
                autoFocus
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Password
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              loading={submitting}
              disabled={!email.trim() || !password}
            >
              Sign in
            </Button>
            <p className="text-center text-xs text-zinc-400">
              Forgot your password? Switch to Phone (OTP) to sign in, then set a
              new one from your Profile.
            </p>
          </form>
        ) : step === "phone" ? (
          <form onSubmit={handleRequestOtp} className="space-y-3">
            <label className="block text-sm font-medium text-zinc-700">
              Phone number
              <Input
                type="tel"
                inputMode="tel"
                autoFocus
                placeholder="+91 90000 00000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" loading={submitting} disabled={!phone.trim()}>
              Send code
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <p className="text-sm text-zinc-500">
              Enter the 6-digit code sent to your WhatsApp for{" "}
              <strong>{phone}</strong>.
            </p>
            <label className="block text-sm font-medium text-zinc-700">
              Verification code
              <Input
                type="text"
                inputMode="numeric"
                autoFocus
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="mt-1.5 tracking-[0.4em]"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              loading={submitting}
              disabled={otp.length !== 6}
            >
              Verify &amp; sign in
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-zinc-500 underline"
              onClick={() => {
                setStep("phone");
                setOtp("");
                setError(null);
              }}
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
