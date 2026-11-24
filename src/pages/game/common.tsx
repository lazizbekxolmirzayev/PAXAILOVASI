import type { ReactNode } from 'react';
import { useGame } from '../../store/game';
import type { Country, World } from '../../types/game';
import { EmptyState } from '../../components/ui';
import { Skull } from 'lucide-react';
import { tr, trName } from '../../i18n';

export function usePlayer(): { w: World; c: Country | null } {
  useGame((s) => s.version);
  const w = useGame((s) => s.world)!;
  const c = w.player ? w.countries[w.player] : null;
  return { w, c };
}
export function RequirePlayer({ children }: { children: (c: Country, w: World) => ReactNode }) {
  const { w, c } = usePlayer();
  if (!c) return <EmptyState title="Observer mode" text="You are not controlling a country in this world." />;
  if (!c.alive) return <EmptyState icon={<Skull className="h-8 w-8" />} title={tr('{c} has fallen', { c: trName(c.name) })} text="Your nation no longer exists." />;
  return <>{children(c, w)}</>;
}
