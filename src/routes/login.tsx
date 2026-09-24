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
  const { user, requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [step, setStep] = React.useState<"phone" | "otp">("phone");
  const [phone, setPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (user) navigate({ to: search.redirect ?? "/catalog" });
  }, [user, navigate, search.redirect]);

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
            Sign in with your registered phone number
          </p>
        </div>

        {step === "phone" ? (
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
