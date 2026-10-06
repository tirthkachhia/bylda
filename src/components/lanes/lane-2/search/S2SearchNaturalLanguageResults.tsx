import { LocalSearchGate, LocalSearchScreen } from "./LocalSearch";
export function S2SearchNaturalLanguageResults() {
  return <LocalSearchGate>{(viewer) => <LocalSearchScreen viewer={viewer} />}</LocalSearchGate>;
}
