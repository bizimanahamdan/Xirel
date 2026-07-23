import { useId } from "react";

type LogoProps = {
  /** "full" shows the icon + wordmark; "icon" shows just the badge mark. */
  variant?: "full" | "icon";
  /** Height of the icon badge in pixels. */
  size?: number;
  /** Additional classes for the wordmark text. */
  textClassName?: string;
  className?: string;
};

/**
 * Xirel brand mark: a lightning bolt (electronics) and a soft ribbon curve
 * (outfits/fashion) crossing to form the brand's "X", set in the site's
 * signature rose gradient.
 */
export function Logo({ variant = "full", size = 36, textClassName = "", className = "" }: LogoProps) {
  const gradientId = useId();
  const glossId = useId();

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="14" y1="14" x2="86" y2="86" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f81f58" />
            <stop offset="1" stopColor="#ff6d84" />
          </linearGradient>
          <radialGradient id={glossId} cx="0.32" cy="0.26" r="0.55">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="50" cy="50" r="48" fill={`url(#${gradientId})`} />
        <circle cx="50" cy="50" r="48" fill={`url(#${glossId})`} />
        <circle cx="50" cy="50" r="45.5" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="1.5" />

        {/* Bolt: electronics */}
        <polyline
          points="30,22 62,45 42,45 72,80"
          fill="none"
          stroke="#ffffff"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Ribbon: outfits/fashion */}
        <path
          d="M 72 22 C 55 38 63 55 40 58 C 30 60 32 70 28 80"
          fill="none"
          stroke="#ffe3bc"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {variant === "full" && (
        <span
          className={`gradient-text font-bold ${textClassName}`}
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Xirel
        </span>
      )}
    </span>
  );
}
