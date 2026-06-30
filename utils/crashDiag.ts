// Synchronous crash step tracker.
// MatchesScreen sets this before each hook call; ErrorBoundary reads it directly.
// No AsyncStorage or async needed — module singletons are shared across files in Metro.
export let lastStep = '(henüz başlamadı)';
export function markStep(step: string) { lastStep = step; }
