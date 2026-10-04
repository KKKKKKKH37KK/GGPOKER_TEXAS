import { useEffect, useMemo, useRef, useState } from 'react';
import type { Position } from './parser/types';
import { POSITIONS, STACK_GROUPS, aggregate, applyFilter, stackGroup } from './stats/aggregate';
import type { Replay } from './stats/replay';
import { GLOSSARY, STAT_KEYS, type StatKey } from './stats/definitions';
import type { Filter, HandFacts } from './stats/types';
import { createStatsWorker } from './worker/client';
import type { FromWorker, InputFile, LoadSummary } from './worker/protocol';
import { download, statsToCsv } from './ui/exportCsv';
import type { Drill } from './ui/drill';
import { Filters, stackLabel } from './ui/Filters';
import { HandList } from './ui/HandList';
import { HandReplay } from './ui/HandReplay';
import { dollars, int } from './ui/format';
import { GroupTable } from './ui/GroupTable';
import { KpiCards } from './ui/KpiCards';
import { LinesTable } from './ui/LinesTable';
import { DiagnosisCard } from './ui/DiagnosisCard';
import { DEFAULT_MIN_OPP, diagnose } from './stats/diagnose';
import { benchFor } from './ui/settings';
import { RakeCard } from './ui/RakeCard';
import { RangeGrid } from './ui/RangeGrid';
import { SettingsPanel } from './ui/SettingsPanel';
import { useSettings } from './ui/settings';
import { StatsTable } from './ui/StatsTable';
import { Upload } from './ui/Upload';
import { Warnings } from './ui/Warnings';
import { WinGraph } from './ui/WinGraph';

/** Overall reference ranges do not apply per position; only RFI has position-specific ones. */
function positionBench(p: Position): Partial<Record<StatKey, StatKey | null>> {
  const none = Object.fromEntries(STAT_KEYS.map((k) => [k, null])) as Record<StatKey, StatKey | null>;
  return { ...none, rfi: p === 'BB' ? null : (`rfi${p}` as StatKey) };
}

const PHASE_LABEL: Record<string, string> = {
  read: '讀取檔案',
  unzip: '解壓縮',
  parse: '解析手牌',
  stats: '計算統計',
  ev: '計算 All-in EV',
};

export default function App() {
  const [facts, setFacts] = useState<HandFacts[] | null>(null);
  const [summary, setSummary] = useState<LoadSummary | null>(null);
  const [ev, setEv] = useState<{ net: Record<string, number>; pre: Record<string, number> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ label: string; frac: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>({});
  const [settings, setSettings] = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [replayNav, setReplayNav] = useState<{ ids: string[]; index: number } | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const uploadingRef = useRef(false);
  const workerRef = useRef<ReturnType<typeof createStatsWorker> | null>(null);

  useEffect(() => {
    const w = createStatsWorker((msg: FromWorker) => {
      switch (msg.type) {
        case 'progress':
          setProgress({ label: `${PHASE_LABEL[msg.phase]} ${msg.done}/${msg.total}`, frac: msg.total ? msg.done / msg.total : 0 });
          break;
        case 'loaded':
          if (uploadingRef.current) {
            const s = msg.summary;
            setNotice(
              s.newFiles === 0
                ? '這些檔案已經載入過（同檔名、同大小），沒有新增資料。'
                : s.sourceFiles.length > s.newFiles
                  ? `新增 ${s.newFiles} 個檔案，已和既有的 ${s.sourceFiles.length - s.newFiles} 個檔案合併${s.duplicates ? `（重複的 ${s.duplicates} 手已自動去除）` : ''}。`
                  : null,
            );
            uploadingRef.current = false;
          }
          setFacts(msg.facts);
          setSummary(msg.summary);
          setBusy(false);
          setError(null);
          break;
        case 'ev':
          setEv({ net: msg.ev, pre: msg.evPreRake });
          setProgress(null);
          break;
        case 'exported':
          download('hands.json', msg.json, 'application/json');
          break;
        case 'empty':
          setBusy(false);
          setProgress(null);
          break;
        case 'cleared':
          setFacts(null);
          setSummary(null);
          setEv(null);
          setFilter({});
          setBusy(false);
          setProgress(null);
          break;
        case 'replay':
          if (msg.replay) setReplay(msg.replay);
          else {
            setReplayNav(null);
            setError(`找不到手牌 ${msg.id}（只能查已載入的 Hold'em 手牌）`);
          }
          break;
        case 'error':
          setError(msg.message);
          setBusy(false);
          setProgress(null);
          break;
      }
    });
    workerRef.current = w;
    if (settings.persist) {
      setBusy(true);
      setProgress({ label: '載入本機保存的資料', frac: 0 });
      w.restore();
    }
    return () => w.terminate();
    // Restore once on mount with the persisted setting; later toggles go through setPersist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = (files: InputFile[]) => {
    setBusy(true);
    setEv(null);
    setError(null);
    setFilter({});
    setProgress({ label: '讀取檔案', frac: 0 });
    setNotice(null);
    uploadingRef.current = true;
    workerRef.current?.load(files, settings.persist);
  };

  // Turning persistence on saves what is loaded; turning it off deletes the stored copies.
  const persistRef = useRef(settings.persist);
  useEffect(() => {
    if (persistRef.current === settings.persist) return;
    persistRef.current = settings.persist;
    workerRef.current?.setPersist(settings.persist);
  }, [settings.persist]);

  const clearData = () => {
    const where = settings.persist ? '，也會刪除這台電腦瀏覽器裡保存的檔案' : '';
    if (window.confirm(`清除目前載入的所有手牌資料${where}？此動作無法復原（原始 zip 檔不受影響）。`)) {
      workerRef.current?.clear();
    }
  };

  const withEv = useMemo(
    () =>
      facts && ev
        ? facts.map((f) => (ev.net[f.id] !== undefined ? { ...f, evNetCents: ev.net[f.id], evPreRakeCents: ev.pre[f.id] } : f))
        : facts,
    [facts, ev],
  );
  const result = useMemo(() => (withEv ? aggregate(withEv, filter, settings.bounds) : null), [withEv, filter, settings.bounds]);
  const diagnosis = useMemo(
    () =>
      result
        ? diagnose(result, { minHands: settings.minHands, minOpp: DEFAULT_MIN_OPP, rangeOf: (k) => benchFor(settings, k) })
        : null,
    [result, settings],
  );
  const dateRange = useMemo<[string, string]>(
    () => (facts?.length ? [facts[0].timestamp.slice(0, 10), facts[facts.length - 1].timestamp.slice(0, 10)] : ['', '']),
    [facts],
  );

  const exportJson = () => {
    if (!withEv) return;
    workerRef.current?.exportHands(applyFilter(withEv, filter, settings.bounds).map((f) => f.id));
  };

  const skipped = summary ? Object.values(summary.skipped).reduce((a, b) => a + b, 0) : 0;
  const filtered = useMemo(() => (withEv ? applyFilter(withEv, filter, settings.bounds) : []), [withEv, filter, settings.bounds]);

  const openReplay = (ids: string[], index: number) => {
    setReplayNav({ ids, index });
    setReplay(null);
    workerRef.current?.getReplay(ids[index]);
  };
  const stepReplay = (delta: number) => {
    if (!replayNav) return;
    const index = replayNav.index + delta;
    if (index < 0 || index >= replayNav.ids.length) return;
    openReplay(replayNav.ids, index);
  };
  const searchHand = () => {
    const id = search.trim().replace(/^#/, '').toUpperCase();
    if (id) openReplay([id.startsWith('RC') ? id : `RC${id}`], 0);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>HH Stats Viewer</h1>
        {summary && facts && (
          <div className="load-summary">
            共 <b>{int(facts.length)}</b> 手 / 跳過 <b>{skipped}</b> 手（非 Hold'em）/ 錯誤 <b>{summary.errorCount}</b> 手
            {summary.duplicates > 0 && <> / 重複 {summary.duplicates} 手</>}
            <span className="muted">
              {' '}
              · {summary.sourceFiles.length} 個上傳檔（{summary.fileCount} 個 .txt）· {Math.round(summary.elapsedMs)} ms{settings.persist ? ' · 已保存在本機' : ''}
            </span>
          </div>
        )}
        <div className="actions">
          {facts && (
            <form
              className="search"
              onSubmit={(e) => {
                e.preventDefault();
                searchHand();
              }}
            >
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="手牌 ID，例如 RC4772226199" aria-label="手牌 ID" />
              <button type="submit">查看</button>
            </form>
          )}
          {result && (
            <>
              <button onClick={() => download('stats.csv', statsToCsv(result, settings.bounds), 'text/csv')}>匯出 CSV</button>
              <button onClick={exportJson}>匯出 JSON</button>
            </>
          )}
          {facts && <button onClick={clearData}>清除資料</button>}
          <button onClick={() => setShowSettings(true)}>設定</button>
        </div>
      </header>

      <Upload onFiles={load} busy={busy} progress={progress} compact={!!facts} />
      {notice && <div className="notice">{notice}</div>}
      {error && <div className="error">{error}</div>}

      {result && summary && (
        <main>
          <Filters filter={filter} onChange={setFilter} bounds={settings.bounds} dateRange={dateRange} />
          <p className="tip">
            提示：點任何<b>統計數字、表格的列、起手牌格</b>，都會列出那些手牌，再點一手就能<b>逐街重播</b>（← → 切換上一手／下一手）；右上角可以用<b>手牌 ID 搜尋</b>；拖入新的 zip 會和目前資料<b>合併</b>。
          </p>
          {result.hands === 0 ? (
            <p className="empty">篩選後沒有手牌。</p>
          ) : (
            <>
              <KpiCards r={result} settings={settings} evReady={!!ev} onDrill={setDrill} />
              {diagnosis && <DiagnosisCard d={diagnosis} onDrill={setDrill} onOpenSettings={() => setShowSettings(true)} />}
              <WinGraph data={result.graph} evReady={!!ev} />
              <StatsTable r={result} settings={settings} evReady={!!ev} onDrill={setDrill} />
              <LinesTable r={result} onDrill={setDrill} />
              <RakeCard r={result} settings={settings} onRakeback={(pct) => setSettings({ ...settings, rakebackPct: pct })} />
              <GroupTable
                title="依位置"
                note="參考範圍依位置差異很大，此表只對 RFI 標色（用各位置的 RFI 範圍）"
                rows={POSITIONS.map((p) => ({
                  key: p,
                  label: p,
                  zh: GLOSSARY[p],
                  row: result.byPosition[p],
                  bench: positionBench(p),
                  match: (f: HandFacts) => f.position === p,
                }))}
                settings={settings}
                onDrill={setDrill}
              />
              <GroupTable
                title="依籌碼深度"
                note={settings.bounds.basis === 'hero' ? 'Hero 起始籌碼' : '有效籌碼（Hero vs 仍在牌局中最深的對手）'}
                rows={STACK_GROUPS.map((g) => ({
                  key: g,
                  label: stackLabel(g, settings.bounds),
                  row: result.byStack[g],
                  match: (f: HandFacts) => stackGroup(f, settings.bounds) === g,
                }))}
                settings={settings}
                onDrill={setDrill}
              />
              <RangeGrid grid={result.grid} onCell={(combo) => setDrill({ title: `起手牌 ${combo}`, match: (f) => f.combo === combo && !f.walk })} />
            </>
          )}
          {skipped > 0 && (
            <p className="muted small">
              非 Hold'em 手（{Object.entries(summary.skipped).map(([g, n]) => `${g} ${n}`).join('、')}）Hero 合計{' '}
              {dollars(summary.otherGamesNetCents)}；全部手牌合計 Net {dollars((facts ? facts.reduce((a, f) => a + f.netCents, 0) : 0) + summary.otherGamesNetCents)}（不受篩選影響）。
            </p>
          )}
          <Warnings warnings={summary.warnings} />
        </main>
      )}

      {drill && <HandList drill={drill} facts={filtered} onOpen={openReplay} onClose={() => setDrill(null)} />}
      {replayNav && (
        <HandReplay
          replay={replay}
          loading={!replay}
          position={replayNav.ids.length > 1 ? { index: replayNav.index, total: replayNav.ids.length } : null}
          onPrev={() => stepReplay(-1)}
          onNext={() => stepReplay(1)}
          onClose={() => {
            setReplayNav(null);
            setReplay(null);
          }}
        />
      )}
      {showSettings && <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
