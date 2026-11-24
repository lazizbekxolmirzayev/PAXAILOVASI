// Turns structured real-time notices into text in the current language (so they re-translate when the language changes).
import type { NoticeKind, RtNotice, World } from '../types/game';
import { tr, trName } from '../i18n';

export function noticeTone(kind: NoticeKind): 'info' | 'good' | 'bad' | 'event' {
  switch (kind) {
    case 'incoming': case 'battleLost': case 'lost': case 'war': case 'loanDefault': case 'loanDue': return 'bad';
    case 'battleWon': case 'captured': case 'peace': case 'allied': case 'support': return 'good';
    default: return 'event';
  }
}

export function cityName(w: World, pid: number | undefined): string { return pid === undefined ? '?' : trName(w.provinces[pid]?.name ?? '?'); }
export function nationName(w: World, id: string | number | undefined): string { return id === undefined ? '?' : trName(w.countries[String(id)]?.name ?? '?'); }

export function noticeText(w: World, n: RtNotice): string {
  const p = n.params;
  const a = nationName(w, p.a), d = nationName(w, p.d);
  const city = cityName(w, n.province);
  switch (n.kind) {
    case 'incoming': return tr('{a} has set out from {from} against your {city} with about {n} soldiers. They arrive in about {secs} seconds!', { a, from: cityName(w, Number(p.from)), city, n: p.n, secs: p.secs });
    case 'battleWon': return tr('Victory at {city}!', { city });
    case 'battleLost': return tr('Defeat at {city}.', { city });
    case 'captured': return tr('{city} has been captured from {d}.', { city, d });
    case 'lost': return tr('{city} has been taken by {a}!', { city, a });
    case 'war': return tr('{a} is now at war with {d}.', { a, d: p.d ? d : tr('you') });
    case 'peace': return tr('Peace between {a} and {d}.', { a, d });
    case 'loanDue': return tr('Your loan from {a} ({n} gold) is due within a minute!', { a, n: p.n });
    case 'loanDefault': return tr('The loan between {a} and your nation was not repaid: war!', { a });
    case 'offer': return tr('{a} sends you a proposal.', { a });
    case 'allied': return tr('{a} is now your ally.', { a });
    case 'support': return tr('{n} soldiers reached {city}.', { n: p.n, city });
  }
}
