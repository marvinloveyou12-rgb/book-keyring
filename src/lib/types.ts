export type ProviderId = 'yes24' | 'aladin' | 'kakao' | 'google' | 'mock';

export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  pubDate?: string;
  description?: string;
  /** Largest cover image available. */
  coverUrl: string;
  /** Small cover for result lists; also the fallback if coverUrl fails to load. */
  thumbUrl: string;
  backCoverUrl?: string;
  source: ProviderId;
}

export interface SearchResult {
  provider: ProviderId;
  items: Book[];
  page: number;
  hasMore: boolean;
  total?: number;
}

/** side: back|front joined left-right (fold is vertical). stack: back(rotated 180°) over front. separate: each face cut on its own. */
export type JoinMode = 'side' | 'stack' | 'separate';
export type PaperId = 'A4' | 'A5' | 'Letter' | '4x6';

/** All lengths are in millimetres. */
export interface PrintSettings {
  innerW: number;
  innerH: number;
  /** Subtracted from the inner size so the insert slides in easily. */
  slack: number;
  bleed: number;
  gap: number;
  margin: number;
  paper: PaperId;
  join: JoinMode;
  cropMarks: boolean;
  trimOutline: boolean;
  testRuler: boolean;
  dpi: number;
}

export interface FaceImage {
  src: string;
  fit: 'fill' | 'fit';
  zoom: number;
  /** Offset of the image centre, as a fraction of the face width/height. */
  offX: number;
  offY: number;
  bg: string;
}

export interface BackTemplate {
  bg: string;
  fg: string;
  blurb: string;
  barcode: boolean;
}

export interface PrintItem {
  id: string;
  book: Book;
  copies: number;
  front: FaceImage;
  back: {
    mode: 'template' | 'image';
    image: FaceImage;
    template: BackTemplate;
  };
}
