import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-10", className)}>
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm text-red-800">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm font-medium text-red-900 underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
