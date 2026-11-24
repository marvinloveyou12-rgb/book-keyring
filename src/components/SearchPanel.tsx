'use client';
import { useState } from 'react';
import { proxify } from '@/lib/render';
import type { Book, SearchResult } from '@/lib/types';

const PROVIDER_NAMES: Record<string, string> = {
  yes24: 'YES24',
  aladin: '알라딘',
  kakao: '카카오',
  google: 'Google Books',
  mock: '샘플 데이터',
};

export function SearchPanel({ onPick, onUpload }: { onPick: (b: Book) => void; onUpload: () => void }) {
  const [q, setQ] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [lastQ, setLastQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(query: string, page: number) {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(query.trim())}&page=${page}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
      setLastQ(query.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel" aria-label="도서 검색">
      <h2>1. 책 검색</h2>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          run(q, 1);
        }}
      >
        <input
          type="search"
          placeholder="제목, 저자, ISBN"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
          aria-label="검색어"
          maxLength={100}
        />
        <button className="primary" disabled={loading || !q.trim()}>
          {loading ? '검색 중…' : '검색'}
        </button>
      </form>
      <div className="row spread small" style={{ marginTop: 8 }}>
        <span className="muted">{result ? `${PROVIDER_NAMES[result.provider]} 검색 결과${result.total ? ` ${result.total.toLocaleString()}건` : ''}` : ''}</span>
        <button className="ghost small" onClick={onUpload} type="button">
          내 이미지로 만들기
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {result && result.items.length === 0 && <p className="empty">검색 결과가 없습니다.</p>}
      {result && result.items.length > 0 && (
        <>
          <div className="results">
            {result.items.map((b) => (
              <button key={b.id} className="result" onClick={() => onPick(b)} title={`${b.title} — ${b.author}`}>
                {b.thumbUrl ? <img src={proxify(b.thumbUrl)} alt="" loading="lazy" /> : <div className="noimg" />}
                <div className="t">{b.title}</div>
                <div className="a">{b.author}</div>
                <div className="a">{b.publisher}</div>
              </button>
            ))}
          </div>
          <div className="row spread" style={{ marginTop: 12 }}>
            <button disabled={loading || result.page <= 1} onClick={() => run(lastQ, result.page - 1)}>
              이전
            </button>
            <span className="muted small">{result.page} 페이지</span>
            <button disabled={loading || !result.hasMore} onClick={() => run(lastQ, result.page + 1)}>
              다음
            </button>
          </div>
        </>
      )}
    </section>
  );
}
