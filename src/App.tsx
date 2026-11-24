import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { GameLayout } from './components/game/GameLayout';
import { LoadingScreen } from './components/layout/LoadingScreen';
import { NameGate } from './components/layout/NameGate';
import { Toasts } from './components/layout/Toasts';
import { Loading } from './components/ui';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { useSettings } from './services/settings';

const MainMenu = lazy(() => import('./pages/MainMenu'));
const NewGame = lazy(() => import('./pages/NewGame'));
const EraSelect = lazy(() => import('./pages/EraSelect'));
const WhatIfHistory = lazy(() => import('./pages/WhatIfHistory'));
const ScenarioLibrary = lazy(() => import('./pages/ScenarioLibrary'));
const ScenarioDetails = lazy(() => import('./pages/ScenarioDetails'));
const ScenarioEditor = lazy(() => import('./pages/ScenarioEditor'));
const ImperialSandbox = lazy(() => import('./pages/ImperialSandbox'));
const WorldExplorer = lazy(() => import('./pages/WorldExplorer'));
const SaveLoad = lazy(() => import('./pages/SaveLoad'));
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'));
const Achievements = lazy(() => import('./pages/Achievements'));
const StaticPage = lazy(() => import('./pages/Static'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const CountryPage = lazy(() => import('./pages/game/Country'));
const DiplomacyPage = lazy(() => import('./pages/game/Diplomacy'));
const MilitaryPage = lazy(() => import('./pages/game/Military'));

export default function App() {
  const reduce = useSettings((s) => s.reduceMotion);
  useEffect(() => { document.documentElement.classList.toggle('reduce-motion', reduce); }, [reduce]);
  return (
    <ErrorBoundary>
      <NameGate />
      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center"><Loading label="Unrolling the scrolls" /></div>}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<MainMenu />} />
            <Route path="new" element={<NewGame />} />
            <Route path="eras" element={<EraSelect />} />
            <Route path="scenarios" element={<WhatIfHistory />} />
            <Route path="scenarios/:id" element={<ScenarioDetails />} />
            <Route path="library" element={<ScenarioLibrary />} />
            <Route path="editor" element={<ScenarioEditor />} />
            <Route path="editor/:id" element={<ScenarioEditor />} />
            <Route path="sandbox" element={<ImperialSandbox />} />
            <Route path="explorer" element={<WorldExplorer />} />
            <Route path="saves" element={<SaveLoad />} />
            <Route path="worlds" element={<Navigate to="/saves" replace />} />
            <Route path="profile" element={<PlayerProfile />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="royhat" element={<StaticPage />} />
            <Route path="static" element={<Navigate to="/royhat" replace />} />
          </Route>
          <Route path="game" element={<GameLayout />}>
            <Route index element={null} />
            <Route path="country" element={<CountryPage />} />
            <Route path="diplomacy" element={<DiplomacyPage />} />
            <Route path="military" element={<MilitaryPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <LoadingScreen />
      <Toasts />
    </ErrorBoundary>
  );
}
