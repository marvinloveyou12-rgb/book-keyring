'use client';
import { useState } from 'react';
import { countCells } from '@/lib/layout';
import { proxify } from '@/lib/render';
import type { PrintItem, PrintSettings } from '@/lib/types';

export function PrintList(props: {
  items: PrintItem[];
  settings: PrintSettings;
  onEdit: (it: PrintItem) => void;
  onUpdate: (it: PrintItem) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onClear: () => void;
}) {
  const { items, settings, onEdit, onUpdate, onRemove, onMove, onClear } = props;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const totals = countCells(items.map((i) => i.copies), settings);

  async function download() {
    setError(null);
    setDone(null);
    setBusy('준비 중…');
    try {
      const { exportPdf } = await import('@/lib/exportPdf');
      const r = await exportPdf(items, settings, (d, t) => setBusy(`표지 만드는 중 ${d}/${t}`));
      setDone(`${r.name} 다운로드 완료`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel" aria-label="인쇄 목록">
      <div className="row spread">
        <h2 style={{ margin: 0 }}>3. 인쇄 목록</h2>
        {items.length > 0 && (
          <button className="ghost small" onClick={() => confirm('인쇄 목록을 모두 지울까요?') && onClear()}>
            모두 지우기
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="empty">책을 검색해 편집한 뒤 “인쇄 목록에 담기”를 누르세요.</p>
      ) : (
        <ul className="list" style={{ marginTop: 12 }}>
          {items.map((it, i) => {
            const thumb = it.front.src || it.book.thumbUrl;
            return (
              <li key={it.id}>
                {thumb ? <img src={proxify(thumb)} alt="" /> : <div className="noimg" />}
                <div style={{ minWidth: 0 }}>
                  <div className="t" title={it.book.title}>
                    {it.book.title}
                  </div>
                  <div className="row small">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={it.copies}
                      aria-label={`${it.book.title} 수량`}
                      onChange={(e) => onUpdate({ ...it, copies: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })}
                    />
                    개
                    <button className="ghost" onClick={() => onEdit(it)}>
                      편집
                    </button>
                  </div>
                </div>
                <div className="stack" style={{ gap: 0 }}>
                  <button className="ghost" disabled={i === 0} onClick={() => onMove(it.id, -1)} aria-label="위로">
                    ▲
                  </button>
                  <button className="ghost" onClick={() => onRemove(it.id)} aria-label="삭제" title="삭제">
                    ✕
                  </button>
                  <button className="ghost" disabled={i === items.length - 1} onClick={() => onMove(it.id, 1)} aria-label="아래로">
                    ▼
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="summary" style={{ marginTop: 12 }}>
        {items.length}권 · {totals.sets}개 · <strong>{settings.paper} {totals.pages}장</strong>
      </div>
      <button className="primary" style={{ width: '100%', marginTop: 12 }} disabled={!items.length || !!busy || totals.pages === 0} onClick={download}>
        {busy ?? 'PDF 다운로드'}
      </button>
      <p className="small muted" style={{ marginBottom: 0 }}>
        인쇄할 때 <strong>“실제 크기 / 100%”</strong>를 선택하세요. “페이지에 맞추기”로 인쇄하면 크기가 줄어듭니다. 첫 장의 50mm 자로 확인할 수 있어요.
      </p>
      {done && <p className="small ok">{done}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
