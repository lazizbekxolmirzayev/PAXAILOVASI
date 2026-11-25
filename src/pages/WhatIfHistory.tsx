import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Users } from 'lucide-react';
import { SCENARIOS } from '../data/scenarios';
import { Banner } from '../components/art/SceneArt';
import { Badge, SectionTitle } from '../components/ui';
import { ERAS, formatYear } from '../data/eras';
import { MONTHS } from '../engine/date';
import { tr } from '../i18n';

export default function WhatIfHistory() {
  return (
    <div>
      <SectionTitle kicker={tr('Game mode one')}>{tr('What If History')}</SectionTitle>
      <p className="-mt-3 mb-8 max-w-3xl font-serif text-lg text-parchment-200/85">{tr('Each scenario begins at a documented moment. You decide how a pivotal event turns out — then the simulation, not a script, determines what follows. Documented facts and alternative outcomes are always labelled separately.')}</p>
      <div className="grid gap-5 md:grid-cols-2">
        {SCENARIOS.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={`/scenarios/${s.id}`} className="panel group block overflow-hidden transition hover:-translate-y-1 hover:shadow-glow">
              <div className="relative h-56 overflow-hidden rounded-t-lg">
                <Banner scenarioId={s.id} hue={s.artHue} year={formatYear(s.start.y)} seed={i + 2} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/30 to-transparent" />
                <div className="absolute left-4 top-4 flex gap-1.5"><Badge>{tr(ERAS.find((e) => e.id === s.era)?.name ?? '')}</Badge></div>
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-gold-300/90">{tr(s.subtitle)}</div>
                  <h2 className="title-display text-xl text-gold-50">{tr(s.title)}</h2>
                </div>
              </div>
              <div className="p-4">
                <p className="font-serif text-lg italic text-parchment-100">{tr(s.question)}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-parchment-300/70">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{tr(MONTHS[s.start.m])} {formatYear(s.start.y)}</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{s.characters.length} {tr('historical figures')}</span>
                  <span>{s.decisions.length} {tr('divergence points')}</span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
