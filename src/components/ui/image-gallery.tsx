import * as React from "react";
import { ImageOff, X } from "lucide-react";
import { resolveFileUrl } from "@/lib/erp-client";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/api/types";

/** BRD C.13.1 -- primary product image first, then application/room and any
 * additional images, in whatever order the backend returned them. */
function orderedImages(images: ProductImage[]): ProductImage[] {
  const safeImages = Array.isArray(images) ? images : [];
  const primary = safeImages.filter((i) => i.isPrimary);
  const rest = safeImages.filter((i) => !i.isPrimary);
  return [...primary, ...rest];
}

function SafeImage({
  src,
  alt = "",
  className,
}: {
  src: string | null;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-zinc-100 text-zinc-300",
          className,
        )}
      >
        <ImageOff className="h-1/3 w-1/3" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}

/** Item-detail gallery -- a big hero image with a tappable thumbnail strip
 * beneath it when there's more than one image (product / application / room /
 * additional, per BRD C.13.1 and C.14.1). */
export function ImageGallery({ images }: { images: ProductImage[] }) {
  const ordered = React.useMemo(() => orderedImages(images), [images]);
  const [active, setActive] = React.useState(0);
  const hero = ordered[active] ?? ordered[0];

  return (
    <div className="space-y-2">
      <SafeImage
        src={hero ? resolveFileUrl(hero.image) : null}
        className="aspect-square w-full rounded-2xl"
      />
      {ordered.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ordered.map((img, i) => (
            <button
              key={`${img.image}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2",
                i === active ? "border-zinc-900" : "border-transparent",
              )}
            >
              <SafeImage
                src={resolveFileUrl(img.image)}
                className="h-full w-full"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small square thumbnail for a catalog list row -- the primary image, or the
 * first available one if none is flagged primary. */
export function ItemThumbnail({
  images,
  className,
}: {
  images: ProductImage[];
  className?: string | undefined;
}) {
  // `images` is typed as always-an-array, but a catalog search result's real shape isn't
  // guaranteed to match at runtime (ISS report: every search crashed the page with "Cannot
  // read properties of undefined (reading 'find')" -- some row's images came back missing).
  const safeImages = Array.isArray(images) ? images : [];
  const primary = safeImages.find((i) => i.isPrimary) ?? safeImages[0];
  return (
    <SafeImage
      src={primary ? resolveFileUrl(primary.image) : null}
      className={cn("shrink-0 rounded-lg", className)}
    />
  );
}

/** Client request, 2 Nov 2026 -- wherever an item thumbnail shows in a list (the enquiry
 * cart, an enquiry's item list, ...) that isn't already a link to that item's own detail
 * page (which already shows the full ImageGallery), tapping it pops the same gallery up
 * over the current screen instead. Renders a plain, non-interactive ItemThumbnail with no
 * popup when there's nothing to show -- a real image is required to make the thumbnail
 * tappable at all. */
export function ClickableThumbnail({
  images,
  className,
  alt,
}: {
  images: ProductImage[];
  className?: string | undefined;
  alt?: string | undefined;
}) {
  const [open, setOpen] = React.useState(false);
  const safeImages = Array.isArray(images) ? images : [];

  if (safeImages.length === 0) {
    return <ItemThumbnail images={safeImages} className={className} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={alt ? `View ${alt} images` : "View item images"}
        className="shrink-0"
      >
        <ItemThumbnail images={safeImages} className={className} />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              {alt && (
                <p className="truncate text-sm font-medium text-white">{alt}</p>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="ml-auto rounded-full bg-white/10 p-1.5 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ImageGallery images={safeImages} />
          </div>
        </div>
      )}
    </>
  );
}
