import { Link } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { useEnquiryList } from "@/lib/enquiry-list";

/** Shows how many items are waiting on the enquiry list and opens it. Hidden while the
 * list is empty, so it only appears once the dealer has started building one. */
export function EnquiryListLink() {
  const lines = useEnquiryList();
  if (lines.length === 0) return null;
  return (
    <Link
      to="/enquiry"
      className="flex items-center justify-between rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-3 text-sm font-medium text-white"
    >
      <span className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4" />
        Enquiry list · {lines.length} item{lines.length === 1 ? "" : "s"}
      </span>
      <span>Review &amp; send →</span>
    </Link>
  );
}
