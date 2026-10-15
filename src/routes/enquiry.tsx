import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/erp-client";
import {
  clearEnquiryList,
  removeFromEnquiryList,
  setEnquiryQty,
  useEnquiryList,
} from "@/lib/enquiry-list";
import { raiseInquiries } from "@/api/inquiries";

export const Route = createFileRoute("/enquiry")({
  component: EnquiryListPage,
});

/** The items collected while browsing, sent to Pacific as one enquiry. Pacific replies with
 * a quotation (Quotes tab); accepting that is what places the order. */
function EnquiryListPage() {
  const lines = useEnquiryList();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const sendMutation = useMutation({
    mutationFn: () =>
      raiseInquiries({
        items: lines.map((l) => ({ item: l.code, qty: l.qty })),
        remarks: remarks.trim() || undefined,
      }),
    onSuccess: () => {
      clearEnquiryList();
      queryClient.invalidateQueries({ queryKey: ["my-inquiries"] });
      void navigate({ to: "/inquiries" });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : "Could not send the enquiry.",
      ),
  });

  const invalid = lines.some((l) => !(l.qty > 0));

  return (
    <AppShell>
      <div className="space-y-4">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1 text-sm text-zinc-500"
        >
          <ChevronLeft className="h-4 w-4" /> Back to catalog
        </Link>
        <h1 className="text-lg font-semibold text-zinc-900">Enquiry list</h1>

        {lines.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">
            Your enquiry list is empty. Open an item in the catalog and choose
            “Add to enquiry list”.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {lines.map((line) => (
                <Card key={line.code}>
                  <CardContent className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {line.name}
                      </p>
                      <p className="text-xs text-zinc-500">{line.code}</p>
                    </div>
                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
                      Boxes
                      <Input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={line.qty || ""}
                        onChange={(e) =>
                          setEnquiryQty(line.code, Number(e.target.value) || 0)
                        }
                        className="h-9 w-20"
                      />
                    </label>
                    <button
                      aria-label={`Remove ${line.name}`}
                      onClick={() => removeFromEnquiryList(line.code)}
                      className="shrink-0 p-1 text-zinc-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <label className="block text-sm font-medium text-zinc-700">
              Remarks (optional)
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="mt-1.5"
                placeholder="Site, delivery town, timing…"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              onClick={() => sendMutation.mutate()}
              loading={sendMutation.isPending}
              disabled={invalid}
            >
              Send enquiry ({lines.length} item{lines.length === 1 ? "" : "s"})
            </Button>
            <p className="text-center text-xs text-zinc-500">
              Pacific will reply with a quotation showing the price.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
