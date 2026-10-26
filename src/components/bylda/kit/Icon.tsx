import {
  AtSign,
  Bell,
  Bookmark,
  Calendar,
  ChartColumn,
  ChevronDown,
  CircleCheck,
  Ellipsis,
  ExternalLink,
  File,
  FileText,
  Hash,
  House,
  Lock,
  MessageSquare,
  Mic,
  Phone,
  Play,
  Plug,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  Smile,
  Sparkles,
  Spline,
  Target,
  TrendingUp,
  TriangleAlert,
  User,
  Users,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "./cn";

/**
 * The 34 icons from Figma `Icons` (35:15), mapped to Lucide at 1.6 stroke.
 * Always use <Icon name="…" /> — never import lucide-react directly in a V1 screen.
 */
export const ICONS = {
  home: House,
  intelligence: Sparkles,
  calls: Phone,
  reports: FileText,
  team: Users,
  coaching: Target,
  rooms: MessageSquare,
  hash: Hash,
  search: Search,
  bell: Bell,
  bookmark: Bookmark,
  plug: Plug,
  settings: Settings,
  plus: Plus,
  chevron: ChevronDown,
  share: Share2,
  more: Ellipsis,
  chart: ChartColumn,
  video: Video,
  calendar: Calendar,
  pattern: Spline,
  alert: TriangleAlert,
  check: CircleCheck,
  mic: Mic,
  smile: Smile,
  at: AtSign,
  send: Send,
  play: Play,
  lock: Lock,
  user: User,
  file: File,
  x: X,
  external: ExternalLink,
  trend: TrendingUp,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export type IconProps = {
  name: IconName;
  /** px — Figma uses 13, 14, 16, 18. Default 16. */
  size?: number;
  className?: string;
  /** Accessible label. Omit for decorative icons (default). */
  label?: string;
};

export function Icon({ name, size = 16, className, label }: IconProps) {
  const Cmp = ICONS[name];
  return (
    <Cmp
      width={size}
      height={size}
      strokeWidth={1.6}
      className={cn("shrink-0", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
