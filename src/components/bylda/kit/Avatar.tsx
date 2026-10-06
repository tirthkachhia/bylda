import { cn } from "./cn";
import { initialsOf } from "./initials";

/**
 * Avatar (4:35). Runtime uses the user's SSO/Google photo; without one it shows the
 * warm-metal monogram from Figma. White 1.5px ring, pill.
 */
export function Avatar({
  name,
  src,
  size = 28,
  className,
}: {
  name: string;
  src?: string | null;
  size?: 16 | 22 | 28 | 34 | 36 | number;
  className?: string;
}) {
  const initials = initialsOf(name);
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-by-pill border-[1.5px] border-by-surface-raised bg-by-avatar-metal",
        className,
      )}
      style={{ width: size, height: size }}
      title={name}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={cn("type-mono-micro text-by-text-on-control", size < 20 && "text-[7px]")}>
          {initials}
        </span>
      )}
    </span>
  );
}
