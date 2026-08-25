export interface Perush {
  id: number;
  mefaresh: string;
  text: string;
}

export interface Question {
  id: number;
  text: string;
  perushim: Perush[];
}

export interface Content {
  id: number;
  title: string;
  questions: Question[];
}

export interface Pasuk {
  id: number;
  pasuk_num: number;
  text: string;
  text_en?: string;
  content: Content[];
}

export interface Perek {
  perek_num: number;
  pesukim: Pasuk[];
}

export interface Parsha {
  parsha_id: number;
  parsha_name: string;
  perakim: Perek[];
}

export interface Sefer {
  sefer_id: number;
  sefer_name: string;
  english_name: string;
  parshiot: Parsha[];
}

// Helper type for flattened pasuk with metadata
export interface FlatPasuk {
  id: number;
  sefer: number;
  sefer_name: string;
  perek: number;
  pasuk_num: number;
  text: string;
  text_en?: string;
  content: Content[];
  parsha_id?: number;
  parsha_name?: string;
}
