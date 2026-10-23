import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The design-system scales (client/src/index.css @theme) add text-*, leading-* and
// tracking-* names that tailwind-merge does not know. Without this, a size such as
// `text-label` is read as a color and dropped next to `text-[var(--ui-text-muted)]`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["micro", "caption", "label", "body-sm", "body", "lead", "title-sm", "title", "title-lg", "heading", "display"] }],
      leading: [{ leading: ["ui-none", "ui-tight", "ui-snug", "ui-normal"] }],
      tracking: [{ tracking: ["display", "tight-caps", "caps", "wide-caps", "kicker"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
