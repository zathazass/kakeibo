import type { CategoryKey } from "~/lib/types";
import { CATEGORY_COLOR } from "~/lib/types";

/**
 * A distinct silhouette per kakeibo bucket. Shape carries identity alongside
 * hue, so the four categories stay separable for colourblind readers, in
 * greyscale print, and at a glance in a dense ledger.
 */
const PATHS: Record<CategoryKey, string> = {
  // basket — the weekly shop, the things you must buy again
  needs: "M2.6 5.9h10.8l-1.2 7H3.8zM5.6 5.9l1.9-3.3M10.4 5.9 8.5 2.6M6.3 8.3v2.3M9.7 8.3v2.3",
  // heart — bought because you wanted it
  wants: "M8 13.1S2.7 9.9 2.7 6.2a2.85 2.85 0 0 1 5.3-1.5 2.85 2.85 0 0 1 5.3 1.5c0 3.7-5.3 6.9-5.3 6.9Z",
  // open book — the bucket kakeibo asks you to protect
  culture: "M8 4.6S6.5 3.1 3 3.1v8.6c3.5 0 5 1.5 5 1.5s1.5-1.5 5-1.5V3.1c-3.5 0-5 1.5-5 1.5ZM8 4.6v8.6",
  // bolt — the thing you could not have planned for
  unexpected: "M9.4 2.3 4.2 9.1h3.3l-.7 4.6 5.1-6.9H8.6l.8-4.5Z",
};

export function CategoryIcon({
  category,
  size = 16,
  tinted = false,
}: {
  category: CategoryKey;
  size?: number;
  tinted?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={tinted ? CATEGORY_COLOR[category] : "currentColor"}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[category]} />
    </svg>
  );
}
