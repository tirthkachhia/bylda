/**
 * @/components/bylda — the Bylda V1 UI kit. The ONLY component import surface for V1 screens.
 * Built from Figma page 02 (1:3) + page 03 shell (1:4) + page 17 states (1:18).
 * Frozen once merged (CLAUDE.md §12 A) — request changes in LANE_REQUESTS.md.
 *
 * Legacy files in this folder (AiOriginCard, ByldaAvatar, ByldaBar, CrmNextBestAction,
 * DailyBriefingCard, MomentumRail) belong to the quarantined routes and are NOT exported.
 */

// Primitives
export { cn } from "./kit/cn";
export { Icon, ICONS, ICON_NAMES, type IconName, type IconProps } from "./kit/Icon";
export { ByldaGlyph, Wordmark } from "./kit/ByldaGlyph";
export { Button, type ButtonProps, type ButtonVariant } from "./kit/Button";
export { Tag, DirectionTag, type TagTone } from "./kit/Tag";
export { Avatar } from "./kit/Avatar";
export { initialsOf } from "./kit/initials";
export { SidebarItem, type SidebarItemState } from "./kit/SidebarItem";
export { ConfidenceMeter, type ConfidenceLevel } from "./kit/ConfidenceMeter";
export { EvidenceBlock, type Evidence } from "./kit/EvidenceBlock";
export { TrendChart, type TrendSeries } from "./kit/TrendChart";
export {
  InsightCard,
  type InsightCardProps,
  type InsightKind,
  type InsightAction,
} from "./kit/InsightCard";
export { AppBadge } from "./kit/AppBadge";
export { Reactions, type Reaction } from "./kit/Reactions";
export { SkeletonBar, SkeletonBlock } from "./kit/Skeleton";

// Room message blocks
export {
  ReportBlock,
  CallBlock,
  CoachingBlock,
  StructuredInsightBlock,
  type StructuredColumn,
} from "./blocks/Blocks";

// Page-17 states
export {
  SystemState,
  StateEmpty,
  StateError,
  StateLoading,
  type SystemStateProps,
  type StateAction,
} from "./states/SystemState";
export { systemStates, STATE_CODES, type SystemStateId } from "./states/presets";
export { SystemStatePreset } from "./states/SystemStatePreset";
export { DataBoundary, type QueryLike } from "./states/DataBoundary";
export { ScreenPlaceholder } from "./states/ScreenPlaceholder";

// Shell pieces screens may use
export { ContextPanel } from "./shell/ContextPanel";
export { CallMoreMenu } from "./menus/ShellMenus";
export { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, MenuSeparator } from "./menus/Menu";
export { SCREENS, screenForRoute, type ScreenEntry } from "./shell/screens";
