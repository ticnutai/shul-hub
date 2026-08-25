export interface CommentaryAnswer {
  id: number;
  mefaresh: string;
  text: string;
}

export interface TorahQuestion {
  id: number;
  text: string;
  perushim: CommentaryAnswer[];
}

export interface TorahTopic {
  id: number;
  title: string;
  questions: TorahQuestion[];
}

export interface TorahVerse {
  id: number;
  pasuk_num: number;
  text: string;
  content?: TorahTopic[];
}

export interface TorahChapter {
  perek_num: number;
  pesukim: TorahVerse[];
}

export interface TorahParsha {
  parsha_id: number;
  parsha_name: string;
  perakim: TorahChapter[];
}

export interface TorahBook {
  sefer_id: number;
  sefer_name: string;
  english_name: string;
  parshiot: TorahParsha[];
}

export interface SiddurSection {
  title: string;
  lines: string[];
}

export interface SiddurCategory {
  name: string;
  sections: SiddurSection[];
}

export type SiddurData = Record<string, SiddurCategory>;
