// One initial render plus live appends; both widths and all eight phases in either plan.
export function threadSeedPlan(soak: boolean) {
  return { seeds: Array.from({ length: soak ? 4 : 2 }, (_, i) => i + 1), renders: soak ? 25 : 12 };
}
