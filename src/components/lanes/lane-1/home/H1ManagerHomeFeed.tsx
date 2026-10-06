import { SkeletonBlock } from "@/components/bylda";
import {
  useCalls,
  useCoachingFoci,
  useReports,
  useTeamMembers,
  type HomeFeed,
  type Insight,
} from "@/lib/data";
import { HomeTab } from "./shared/HomeTab";
import { HeroInsight } from "./feed/HeroInsight";
import { AttentionRow, FeedStream } from "./feed/FeedStream";
import { buildPosts } from "./feed/posts";

/**
 * H1 · Manager Home — Feed (For You)
 * Figma 7:2 (page 1:6) · Lane 1 — Ansh · route /app/home
 *
 * An intelligence feed — insight → evidence → action. Not a KPI grid, not a chat stream
 * (CLAUDE.md §4). Hero = the top For You insight; below it, every other Bylda post
 * newest-first; context panel = today at a glance. Hooks: useHomeFeed (+ useCalls,
 * useCoachingFoci, useReports, useTeamMembers to compose posts and the panel).
 */
export function H1ManagerHomeFeed() {
  return <HomeTab eyebrow="HOME · FEED">{(data) => <ForYou feed={data} />}</HomeTab>;
}

/** Hero pick: the newest For You insight that can carry an action; else the newest one. */
function pickHero(feed: HomeFeed): Insight | null {
  const byNewest = (a: Insight, b: Insight) => Date.parse(b.createdAt) - Date.parse(a.createdAt);
  const forYou = feed.items
    .filter((f) => f.tab === "for_you")
    .map((f) => f.insight)
    .sort(byNewest);
  const all = feed.items.map((f) => f.insight).sort(byNewest);
  return (
    forYou.find((i) => i.confidence !== "low") ??
    forYou[0] ??
    all.find((i) => i.confidence !== "low") ??
    all[0] ??
    null
  );
}

function ForYou({ feed }: { feed: HomeFeed }) {
  const reports = useReports();
  const calls = useCalls();
  const foci = useCoachingFoci();
  const members = useTeamMembers();

  const hero = pickHero(feed);
  const heroRep =
    hero && hero.affectedRepIds.length === 1
      ? (members.data?.find((p) => p.id === hero.affectedRepIds[0]) ?? null)
      : null;

  const posts = buildPosts({
    insights: feed.items.map((f) => f.insight).filter((i) => i.id !== hero?.id),
    reports: reports.data ?? [],
    calls: calls.data ?? [],
    foci: foci.data ?? [],
  });
  const secondaryLoading = reports.isLoading || calls.isLoading || foci.isLoading;

  return (
    <>
      {feed.attention.map((a) => (
        <AttentionRow key={a.id} item={a} />
      ))}
      {hero ? <HeroInsight insight={hero} rep={heroRep} /> : null}
      <FeedStream posts={posts} />
      {secondaryLoading ? <SkeletonBlock height={64} className="rounded-by-card" /> : null}
    </>
  );
}
