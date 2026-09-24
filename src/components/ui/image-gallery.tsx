import * as React from "react";
import { ImageOff } from "lucide-react";
import { resolveFileUrl } from "@/lib/erp-client";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/api/types";

/** BRD C.13.1 -- primary product image first, then application/room and any
 * additional images, in whatever order the backend returned them. */
function orderedImages(images: ProductImage[]): ProductImage[] {
  const primary = images.filter((i) => i.isPrimary);
  const rest = images.filter((i) => !i.isPrimary);
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
  className?: string;
}) {
  const primary = images.find((i) => i.isPrimary) ?? images[0];
  return (
    <SafeImage
      src={primary ? resolveFileUrl(primary.image) : null}
      className={cn("shrink-0 rounded-lg", className)}
    />
  );
}
