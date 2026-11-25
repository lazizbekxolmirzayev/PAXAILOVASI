import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, Download, FolderOpen, Pencil, Save, Trash2, Upload } from 'lucide-react';
import { deleteSave, downloadSaveFile, importSaveFile, listSaves, loadWorld, renameSave, saveWorld, type SaveMeta } from '../services/saves';
import { useGame } from '../store/game';
import { Badge, Button, EmptyState, ErrorBox, Loading, Modal, Panel, SectionTitle } from '../components/ui';
import { Flag } from '../components/ui/Flag';
import { fmtDate } from '../engine/date';
import { SCENARIO_BY_ID } from '../data/scenarios';
import { tr } from '../i18n';

export default function SaveLoad() {
  const [saves, setSaves] = useState<SaveMeta[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rename, setRename] = useState<SaveMeta | null>(null);
  const [newName, setNewName] = useState('');
  const [confirmDel, setConfirmDel] = useState<SaveMeta | null>(null);
  const world = useGame((s) => s.world);
  const setWorld = useGame((s) => s.setWorld);
  const toast = useGame((s) => s.toast);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [slotName, setSlotName] = useState(() => (world ? `${world.name} — ${fmtDate(world.date, true)}` : ''));
  const reload = () => { setErr(null); listSaves().then(setSaves).catch((e) => { setErr(e.message); setSaves([]); }); };
  useEffect(reload, []);
  const load = async (m: SaveMeta) => { try { await setWorld(await loadWorld(m.slot)); toast(`Loaded “${m.name}”.`, 'good'); navigate('/game'); } catch (e) { toast((e as Error).message, 'bad'); } };
  const saveNew = async () => { if (!world) return; const slot = world.settings.difficulty === 'ironman' ? `iron-${world.id}` : `s${Date.now().toString(36)}`; await saveWorld(world, slot, slotName || world.name); toast('Saved.', 'good'); reload(); };
  return (
    <div>
      <SectionTitle kicker={tr('Save & load · My worlds')}>{tr('Your historical universes')}</SectionTitle>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Panel title={tr('Saved worlds')} subtitle={tr('Compressed (gzip) and stored in your browser; mirrored to the cloud when signed in.')}>
          {err && <ErrorBox error={err} onRetry={reload} />}
          {saves === null ? <Loading /> : !saves.length ? <EmptyState icon={<FolderOpen className="h-8 w-8" />} title={tr('No saved worlds')} text={tr('Start a game — autosave keeps your progress, or save manually.')} /> : (
            <div className="space-y-2">
              {saves.map((m) => (
                <div key={m.slot} className="flex flex-wrap items-center gap-3 rounded-md bg-ink-950/50 p-3 ring-1 ring-gold-700/30">
                  {m.playerFlag ? <Flag flag={m.playerFlag} className="h-9 w-14 rounded-sm" /> : <div className="h-9 w-14 rounded-sm bg-ink-800" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-semibold text-parchment-50">{m.name}{m.auto && <Badge tone="gray">{tr('autosave')}</Badge>}{m.cloud && <Badge tone="blue"><Cloud className="h-3 w-3" />{tr('cloud')}</Badge>}</div>
                    <div className="text-xs text-parchment-300/70">{m.playerName ?? 'Observer'} · {m.date} · {m.mode}{m.scenarioId ? ` · ${SCENARIO_BY_ID[m.scenarioId]?.title ?? m.scenarioId}` : ''} · {Math.round(m.months / 12)} yrs played · {(m.sizeBytes / 1024).toFixed(0)} {tr('KB')}</div>
                    <div className="text-[10px] text-parchment-300/50">{tr('Saved')} {new Date(m.savedAt).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="gold" onClick={() => void load(m)}>{tr('Load')}</Button>
                    <Button size="sm" onClick={() => { setRename(m); setNewName(m.name); }} aria-label={tr('Rename')}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="danger" onClick={() => setConfirmDel(m)} aria-label={tr('Delete')}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <div className="space-y-4">
          <Panel title={tr('Save current world')}>
            {world ? <>
              <input className="input mb-2" value={slotName} onChange={(e) => setSlotName(e.target.value)} />
              <Button variant="gold" className="w-full" icon={<Save className="h-4 w-4" />} onClick={() => void saveNew()}>{tr('Save to new slot')}</Button>
              <Button className="mt-2 w-full" icon={<Download className="h-4 w-4" />} onClick={() => downloadSaveFile(world)}>{tr('Export .wif file')}</Button>
              <Button className="mt-2 w-full" onClick={() => navigate('/game')}>{tr('Return to game')}</Button>
            </> : <p className="text-sm text-parchment-300/70">{tr('No world loaded.')}</p>}
          </Panel>
          <Panel title={tr('Import')}>
            <input ref={fileRef} type="file" accept=".wif" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const w = await importSaveFile(f); await setWorld(w); toast('Save imported.', 'good'); navigate('/game'); } catch (er) { toast((er as Error).message, 'bad'); } }} />
            <Button className="w-full" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>{tr('Import .wif file')}</Button>
          </Panel>
        </div>
      </div>
      <Modal open={!!rename} onClose={() => setRename(null)} title={tr('Rename save')} footer={<Button variant="gold" onClick={() => rename && void renameSave(rename.slot, newName).then(() => { setRename(null); reload(); })}>{tr('Rename')}</Button>}>
        <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
      </Modal>
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title={tr('Delete save?')} footer={<><Button onClick={() => setConfirmDel(null)}>{tr('Cancel')}</Button><Button variant="danger" onClick={() => confirmDel && void deleteSave(confirmDel.slot).then(() => { setConfirmDel(null); reload(); })}>{tr('Delete permanently')}</Button></>}>
        <p className="text-sm">“{confirmDel?.name}” will be permanently deleted (local and cloud copy). This cannot be undone.</p>
      </Modal>
    </div>
  );
}
