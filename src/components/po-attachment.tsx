import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/erp-client";
import { attachMyPo, myPoKey, useMyPo } from "@/api/customerPo";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,application/pdf";

/** The dealer's PO for one enquiry: attach it (a photo or PDF), see that it is on file, replace it.
 * That is all a dealer sees -- once it is uploaded there is nothing more to wait for or act on
 * here; what Pacific does with it afterwards is not shown. */
export function PoAttachment({ inquiry }: { inquiry: string }) {
  const queryClient = useQueryClient();
  const po = useMyPo(inquiry);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => attachMyPo(inquiry, file),
    onSuccess: (state) => {
      setError(null);
      queryClient.setQueryData(myPoKey(inquiry), state);
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : "Could not upload the PO.",
      ),
  });

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("The file is too large. Please keep it under 10 MB.");
      return;
    }
    setError(null);
    upload.mutate(file);
  }

  const attached = po.data?.attached ?? false;
  const required = po.data?.required ?? false;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-zinc-700">
        Your purchase order (PO){required && !attached ? " — required" : ""}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onPick}
      />
      {attached && (
        <p className="flex items-start gap-1.5 text-xs break-all text-emerald-600">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>PO attached — {po.data?.fileName}</span>
        </p>
      )}
      <Button
        size="sm"
        variant="outline"
        className="w-auto"
        onClick={() => inputRef.current?.click()}
        loading={upload.isPending}
      >
        <Paperclip className="h-4 w-4" />
        {attached ? "Replace PO" : "Attach PO (photo or PDF)"}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
