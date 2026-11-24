'use client';
import { computeLayout, faceSize, JOIN_LABELS, PAPERS, SIZE_MAX, SIZE_MIN, SIZE_PRESETS } from '@/lib/layout';
import type { JoinMode, PaperId, PrintSettings } from '@/lib/types';
import { NumberField } from './NumberField';

export function SettingsPanel({ settings: s, onChange }: { settings: PrintSettings; onChange: (s: PrintSettings) => void }) {
  const set = (patch: Partial<PrintSettings>) => onChange({ ...s, ...patch });
  const l = computeLayout(s);
  const f = faceSize(s);
  const preset = SIZE_PRESETS.find((p) => p.w === s.innerW && p.h === s.innerH);

  return (
    <section className="panel" aria-label="사이즈와 출력 설정">
      <h2>사이즈 · 출력 설정</h2>
      <div className="row" style={{ alignItems: 'end' }}>
        <NumberField id="innerW" label="가로 (내경)" value={s.innerW} min={SIZE_MIN} max={SIZE_MAX} onChange={(v) => set({ innerW: v })} />
        <button type="button" title="가로·세로 바꾸기" onClick={() => set({ innerW: s.innerH, innerH: s.innerW })} aria-label="가로 세로 바꾸기">
          ⇄
        </button>
        <NumberField id="innerH" label="세로 (내경)" value={s.innerH} min={SIZE_MIN} max={SIZE_MAX} onChange={(v) => set({ innerH: v })} />
      </div>
      <label className="field" style={{ marginTop: 8 }}>
        프리셋
        <select
          value={preset ? preset.label : ''}
          onChange={(e) => {
            const p = SIZE_PRESETS.find((x) => x.label === e.target.value);
            if (p) set({ innerW: p.w, innerH: p.h });
          }}
        >
          <option value="" disabled>
            직접 입력 ({s.innerW}×{s.innerH}mm)
          </option>
          {SIZE_PRESETS.map((p) => (
            <option key={p.label}>{p.label}</option>
          ))}
        </select>
      </label>

      <h3>접는 방식 · 용지</h3>
      <div className="stack">
        <select value={s.join} onChange={(e) => set({ join: e.target.value as JoinMode })} aria-label="접는 방식">
          {Object.entries(JOIN_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={s.paper} onChange={(e) => set({ paper: e.target.value as PaperId })} aria-label="용지">
          {Object.entries(PAPERS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <h3>세부 치수</h3>
      <div className="row">
        <NumberField label="끼움 여유" value={s.slack} min={0} max={3} step={0.1} onChange={(v) => set({ slack: v })} />
        <NumberField label="도련" value={s.bleed} min={0} max={3} step={0.5} onChange={(v) => set({ bleed: v })} />
        <NumberField label="간격" value={s.gap} min={0} max={20} step={0.5} onChange={(v) => set({ gap: v })} />
        <NumberField label="여백" value={s.margin} min={0} max={30} step={1} onChange={(v) => set({ margin: v })} />
      </div>
      {s.bleed > s.gap / 2 && <p className="small warn">간격이 좁아 도련을 {l.bleed}mm로 줄였습니다 (간격 ≥ 도련×2).</p>}

      <h3>표시</h3>
      <div className="stack">
        <label className="check">
          <input type="checkbox" checked={s.cropMarks} onChange={(e) => set({ cropMarks: e.target.checked })} /> 재단 표시(크롭 마크)
        </label>
        <label className="check">
          <input type="checkbox" checked={s.trimOutline} onChange={(e) => set({ trimOutline: e.target.checked })} /> 자르는 선·접는 선 표시
        </label>
        <label className="check">
          <input type="checkbox" checked={s.testRuler} onChange={(e) => set({ testRuler: e.target.checked })} /> 50mm 테스트 자 (첫 장)
        </label>
      </div>

      <div className="summary" style={{ marginTop: 12 }} data-testid="layout-summary">
        한 면 <strong>{f.w}×{f.h}mm</strong> · 한 장에 <strong>{l.perPage}개</strong> ({l.cols}열×{l.rows}행)
        {l.perPage === 0 && <div className="bad">용지에 들어가지 않습니다. 사이즈나 여백을 줄여 주세요.</div>}
      </div>
    </section>
  );
}
