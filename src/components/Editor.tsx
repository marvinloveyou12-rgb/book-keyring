'use client';
import { useEffect, useRef, useState } from 'react';
import { cellRegions, effectiveBleed, faceSize, type FaceRegion } from '@/lib/layout';
import { fileToDataUrl, renderCell, renderFace } from '@/lib/render';
import type { FaceImage, PrintItem, PrintSettings } from '@/lib/types';
import { pxPerMm } from '@/lib/units';

const PREVIEW_DPI = 200;
const SEPARATE_GAP = 4; // mm between faces in the separate-mode preview

interface Geom {
  W: number;
  H: number;
  regions: FaceRegion[];
}

async function renderPreview(item: PrintItem, s: PrintSettings) {
  const k = pxPerMm(PREVIEW_DPI);
  if (s.join !== 'separate') {
    const r = await renderCell(item, s, PREVIEW_DPI);
    return { canvas: r.canvas, effDpi: r.effDpi, applied: r.applied, geom: cellRegions(s) as Geom };
  }
  const [f, b] = await Promise.all([renderFace(item, 'front', s, PREVIEW_DPI), renderFace(item, 'back', s, PREVIEW_DPI)]);
  const fs = faceSize(s);
  const bl = effectiveBleed(s);
  const one = fs.w + 2 * bl;
  const W = one * 2 + SEPARATE_GAP;
  const H = fs.h + 2 * bl;
  const c = document.createElement('canvas');
  c.width = Math.round(W * k);
  c.height = Math.round(H * k);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(f.canvas, 0, 0);
  ctx.drawImage(b.canvas, Math.round((one + SEPARATE_GAP) * k), 0);
  return {
    canvas: c,
    effDpi: { front: f.effDpi, back: b.effDpi },
    applied: { front: f.applied, back: b.applied },
    geom: {
      W,
      H,
      regions: [
        { which: 'front', x: bl, y: bl, w: fs.w, h: fs.h, rotated: false },
        { which: 'back', x: one + SEPARATE_GAP + bl, y: bl, w: fs.w, h: fs.h, rotated: false },
      ],
    } as Geom,
  };
}

function DpiNote({ dpi }: { dpi: number | null }) {
  if (dpi === null) return null;
  const v = Math.round(dpi);
  if (v < 150) return <span className="small bad">해상도 {v}dpi — 흐리게 인쇄될 수 있어요</span>;
  if (v < 300) return <span className="small warn">해상도 {v}dpi — 보통</span>;
  return <span className="small ok">해상도 {v}dpi — 좋음</span>;
}

function FaceControls({ face, onChange, onUpload, dpi }: { face: FaceImage; onChange: (f: FaceImage) => void; onUpload: (f: File) => void; dpi: number | null }) {
  const set = (patch: Partial<FaceImage>) => onChange({ ...face, ...patch });
  return (
    <>
      <div className="row">
        <div className="seg" role="group" aria-label="맞춤 방식">
          <button type="button" aria-pressed={face.fit === 'fill'} onClick={() => set({ fit: 'fill' })}>
            채우기
          </button>
          <button type="button" aria-pressed={face.fit === 'fit'} onClick={() => set({ fit: 'fit' })}>
            맞추기
          </button>
        </div>
        {face.fit === 'fit' && (
          <label className="row small muted">
            여백색 <input type="color" value={face.bg} onChange={(e) => set({ bg: e.target.value })} />
          </label>
        )}
      </div>
      <label className="row small">
        확대
        <input type="range" min={0.5} max={3} step={0.01} value={face.zoom} onChange={(e) => set({ zoom: Number(e.target.value) })} />
        <span className="muted">{Math.round(face.zoom * 100)}%</span>
      </label>
      <div className="row">
        <button type="button" onClick={() => set({ zoom: 1, offX: 0, offY: 0 })}>
          위치 초기화
        </button>
        <label className="button">
          이미지 교체
          <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </label>
      </div>
      <DpiNote dpi={dpi} />
    </>
  );
}

export function Editor(props: {
  item: PrintItem;
  settings: PrintSettings;
  onChange: (it: PrintItem) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  const { item, settings, onChange, onSave, onCancel, saveLabel } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geomRef = useRef<Geom | null>(null);
  const appliedRef = useRef<Record<'front' | 'back', { offX: number; offY: number } | null>>({ front: null, back: null });
  const itemRef = useRef(item);
  itemRef.current = item;
  const [effDpi, setEffDpi] = useState<{ front: number | null; back: number | null }>({ front: null, back: null });
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ region: FaceRegion; x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    renderPreview(item, settings)
      .then(({ canvas, effDpi, applied, geom }) => {
        const c = canvasRef.current;
        if (cancelled || !c) return;
        c.width = canvas.width;
        c.height = canvas.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(canvas, 0, 0);
        const k = canvas.width / geom.W;
        // Dim the bleed (it gets cut off) and outline each face's trim box.
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.rect(0, 0, c.width, c.height);
        for (const r of geom.regions) ctx.rect(r.x * k + r.w * k, r.y * k, -r.w * k, r.h * k);
        ctx.fill('evenodd');
        ctx.restore();
        ctx.strokeStyle = 'rgba(220,38,38,0.9)';
        ctx.lineWidth = Math.max(1, k * 0.15);
        ctx.setLineDash([k * 0.8, k * 0.6]);
        for (const r of geom.regions) ctx.strokeRect(r.x * k, r.y * k, r.w * k, r.h * k);
        geomRef.current = geom;
        appliedRef.current = applied;
        setEffDpi(effDpi);
        setError(null);
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [item, settings]);

  const faceOf = (it: PrintItem, which: 'front' | 'back') => (which === 'front' ? it.front : it.back.image);
  const withFace = (it: PrintItem, which: 'front' | 'back', f: FaceImage): PrintItem =>
    which === 'front' ? { ...it, front: f } : { ...it, back: { ...it.back, image: f } };

  const toMm = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const g = geomRef.current!;
    return { x: ((e.clientX - rect.left) / rect.width) * g.W, y: ((e.clientY - rect.top) / rect.height) * g.H };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!geomRef.current) return;
    const p = toMm(e);
    const region = geomRef.current.regions.find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
    if (!region) return;
    if (region.which === 'back' && item.back.mode === 'template') return;
    if (!faceOf(item, region.which).src) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // Start from what is actually drawn, so an offset clamped at the edge does not feel "stuck".
    const applied = appliedRef.current[region.which];
    const f = faceOf(item, region.which);
    if (applied && (applied.offX !== f.offX || applied.offY !== f.offY)) onChange(withFace(item, region.which, { ...f, ...applied }));
    drag.current = { region, ...p };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toMm(e);
    const sign = d.region.rotated ? -1 : 1;
    const it = itemRef.current;
    const f = faceOf(it, d.region.which);
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    onChange(
      withFace(it, d.region.which, {
        ...f,
        offX: clamp(f.offX + (sign * (p.x - d.x)) / d.region.w),
        offY: clamp(f.offY + (sign * (p.y - d.y)) / d.region.h),
      }),
    );
    drag.current = { ...d, ...p };
  };

  const upload = async (which: 'front' | 'back', file: File) => {
    try {
      const src = await fileToDataUrl(file);
      const it = itemRef.current;
      const next = withFace(it, which, { ...faceOf(it, which), src, zoom: 1, offX: 0, offY: 0 });
      onChange(which === 'back' ? { ...next, back: { ...next.back, mode: 'image' } } : next);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const tpl = item.back.template;
  const setTpl = (patch: Partial<typeof tpl>) => onChange({ ...item, back: { ...item.back, template: { ...tpl, ...patch } } });
  const fs = faceSize(settings);

  return (
    <section className="panel" aria-label="표지 편집">
      <div className="row spread">
        <h2 style={{ margin: 0 }}>2. 앞·뒷면 편집</h2>
        <span className="muted small">
          한 면 {fs.w}×{fs.h}mm · {settings.join === 'separate' ? '앞면 | 뒷면 따로' : settings.join === 'side' ? '뒷면 | 앞면 (가운데 접기)' : '뒷면(뒤집힘) / 앞면 (가운데 접기)'}
        </span>
      </div>
      <p className="muted small" style={{ margin: '4px 0 12px' }}>
        <strong style={{ color: 'var(--ink)' }}>{item.book.title}</strong> {item.book.author && `· ${item.book.author}`}
        {' '}— 미리보기에서 이미지를 끌어 위치를 옮기세요. 빨간 점선 밖(흐린 부분)은 잘려 나가는 도련입니다.
      </p>
      <div className="preview-wrap">
        <canvas
          ref={canvasRef}
          data-testid="preview"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          style={{ width: 'min(100%, 520px)' }}
          aria-label="합쳐진 앞·뒷면 미리보기"
        />
      </div>
      {error && <p className="error">{error}</p>}

      <div className="faces" style={{ marginTop: 16 }}>
        <div className="face">
          <h4>앞면</h4>
          <FaceControls face={item.front} dpi={effDpi.front} onChange={(f) => onChange({ ...item, front: f })} onUpload={(f) => upload('front', f)} />
        </div>
        <div className="face">
          <div className="row spread">
            <h4>뒷면</h4>
            <div className="seg" role="group" aria-label="뒷면 방식">
              <button type="button" aria-pressed={item.back.mode === 'template'} onClick={() => onChange({ ...item, back: { ...item.back, mode: 'template' } })}>
                자동 생성
              </button>
              <button
                type="button"
                aria-pressed={item.back.mode === 'image'}
                disabled={!item.back.image.src}
                title={item.back.image.src ? '' : '뒷표지 이미지가 없습니다. "이미지 업로드"로 추가하세요.'}
                onClick={() => onChange({ ...item, back: { ...item.back, mode: 'image' } })}
              >
                이미지
              </button>
            </div>
          </div>
          {item.back.mode === 'image' ? (
            <FaceControls face={item.back.image} dpi={effDpi.back} onChange={(f) => onChange({ ...item, back: { ...item.back, image: f } })} onUpload={(f) => upload('back', f)} />
          ) : (
            <>
              <div className="row small">
                <label className="row">
                  배경 <input type="color" value={tpl.bg} onChange={(e) => setTpl({ bg: e.target.value })} />
                </label>
                <label className="row">
                  글자 <input type="color" value={tpl.fg} onChange={(e) => setTpl({ fg: e.target.value })} />
                </label>
                <label className="check">
                  <input type="checkbox" checked={tpl.barcode} onChange={(e) => setTpl({ barcode: e.target.checked })} /> ISBN 바코드
                </label>
              </div>
              <label className="field">
                소개 문구
                <textarea rows={3} maxLength={300} value={tpl.blurb} onChange={(e) => setTpl({ blurb: e.target.value })} />
              </label>
              <label className="button" style={{ justifySelf: 'start' }}>
                이미지 업로드
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload('back', e.target.files[0])} />
              </label>
            </>
          )}
        </div>
      </div>

      <div className="row spread" style={{ marginTop: 16 }}>
        <label className="row">
          수량
          <input
            type="number"
            min={1}
            max={99}
            value={item.copies}
            onChange={(e) => onChange({ ...item, copies: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })}
          />
          개
        </label>
        <div className="row">
          <button onClick={onCancel}>닫기</button>
          <button className="primary" onClick={onSave}>
            {saveLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
