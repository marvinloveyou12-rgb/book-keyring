'use client';
import { useCallback, useEffect, useState } from 'react';
import { Editor } from '@/components/Editor';
import { PrintList } from '@/components/PrintList';
import { SearchPanel } from '@/components/SearchPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { blankItem, newItem, sanitizeItems } from '@/lib/items';
import { DEFAULT_SETTINGS, sanitizeSettings } from '@/lib/layout';
import { dominantColor, loadFirst, textColorFor } from '@/lib/render';
import type { Book, PrintItem, PrintSettings } from '@/lib/types';

const KEY_SETTINGS = 'bk.settings.v1';
const KEY_ITEMS = 'bk.items.v1';

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);
  const [items, setItems] = useState<PrintItem[]>([]);
  const [draft, setDraft] = useState<PrintItem | null>(null);
  const [editingExisting, setEditingExisting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);

  // Restore after mount (localStorage is unavailable during server render).
  useEffect(() => {
    setSettings(sanitizeSettings(read<Partial<PrintSettings>>(KEY_SETTINGS)));
    setItems(sanitizeItems(read(KEY_ITEMS)));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
      localStorage.setItem(KEY_ITEMS, JSON.stringify(items));
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
  }, [settings, items, loaded]);

  const pick = useCallback(async (book: Book) => {
    let colors: { bg: string; fg: string } | undefined;
    try {
      const img = await loadFirst([book.coverUrl, book.thumbUrl]);
      const bg = dominantColor(img);
      colors = { bg, fg: textColorFor(bg) };
    } catch {
      /* keep template defaults */
    }
    setDraft(newItem(book, colors));
    setEditingExisting(false);
  }, []);

  const save = () => {
    if (!draft) return;
    setItems((list) => (list.some((i) => i.id === draft.id) ? list.map((i) => (i.id === draft.id ? draft : i)) : [...list, draft]));
    setDraft(null);
  };

  const move = (id: string, dir: -1 | 1) =>
    setItems((list) => {
      const i = list.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <>
      <header className="app">
        <h1>책표지 열쇠고리 메이커</h1>
        <span>검색 → 편집 → PDF 인쇄</span>
      </header>
      <main className="grid">
        <div>
          <SearchPanel
            onPick={pick}
            onUpload={() => {
              setDraft(blankItem());
              setEditingExisting(false);
            }}
          />
        </div>
        <div>
          {draft ? (
            <Editor
              item={draft}
              settings={settings}
              onChange={setDraft}
              onSave={save}
              onCancel={() => setDraft(null)}
              saveLabel={editingExisting ? '수정 저장' : '인쇄 목록에 담기'}
            />
          ) : (
            <section className="panel">
              <h2>2. 앞·뒷면 편집</h2>
              <p className="empty">책을 검색해 고르면 여기에서 앞·뒷면을 편집할 수 있어요.</p>
            </section>
          )}
        </div>
        <div>
          <SettingsPanel settings={settings} onChange={(s) => setSettings(sanitizeSettings(s))} />
          <PrintList
            items={items}
            settings={settings}
            onEdit={(it) => {
              setDraft(it);
              setEditingExisting(true);
            }}
            onUpdate={(it) => setItems((list) => list.map((x) => (x.id === it.id ? it : x)))}
            onRemove={(id) => setItems((list) => list.filter((x) => x.id !== id))}
            onMove={move}
            onClear={() => setItems([])}
          />
          {storageWarning && <p className="small warn">브라우저 저장 공간이 부족해 목록이 새로고침 후 유지되지 않을 수 있어요.</p>}
        </div>
      </main>
      <footer className="app-footer">
        <p>
          표지 이미지와 도서 정보의 저작권은 각 출판사와 저작권자에게 있습니다. 이 도구로 만든 표지는 <strong>개인적·비상업적 용도</strong>로만
          사용해 주세요. 판매하거나 단체에 배포하려면 해당 출판사의 허락을 받아야 합니다.
        </p>
        <p>도서 정보와 표지 이미지는 외부 도서 검색 서비스(카카오 등)에서 받아오며, 이 사이트는 이를 별도로 저장하지 않습니다.</p>
      </footer>
    </>
  );
}
