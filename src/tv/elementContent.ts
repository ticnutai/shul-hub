import type { BoardSlide } from './useBoardData';
import { prayerLabel } from '@/community/lib/data';
import type { TvConfig } from './config';
import { formatTime, ZMAN_DISPLAY_LABELS, ZMAN_DISPLAY_KEYS, type Zmanim } from '@/community/lib/zmanim';
import { HDate } from '@hebcal/core';
import { amudYomi, dafYomi, weeklyParasha, seasonalPrayers } from './learning';
export interface ElementData { now: Date; prayers: [string, string][]; lessons: [string, string][]; title?: string; date?: string; zmanim?: [string,string][]; zmanKeys?: string[]; hiddenZmanKeys?: string[]; parasha?:string; dafYomi?:string; amudYomi?:string; seasonal?:string; footer?: string; logos?: {url:string;name:string}[]; announcements?: string }
export function elementData(slides: BoardSlide[], now: Date, context?: {config:TvConfig; name:string; zmanim:Zmanim}): ElementData {
  const flat = (s: BoardSlide[]): BoardSlide[] => s.flatMap(x => x.kind === 'composed' ? flat(x.parts.flatMap(p => p.slide ? [p.slide] : [])) : [x]);
  const seen = new Set<string>();
  const prayers: [string, string][] = [], lessons: [string, string][] = [];
  for (const s of flat(slides)) {
    if (s.kind === 'prayer' && s.isToday !== false) for (const r of s.rows) {
      if(context?.config.hidden.includes(`minyan:${r.minyan.id}`)) continue;
      if (seen.has(r.minyan.id)) continue; seen.add(r.minyan.id);
      prayers.push([[r.minyan.label || prayerLabel(s.subcategories, r.minyan.prayer), r.note].filter(Boolean).join(' · '), r.cancelled ? 'בוטל' : r.time]);
    }
    if (s.kind === 'shiurim') for (const r of s.items) {
      if (seen.has(`lesson:${r.id}`)) continue; seen.add(`lesson:${r.id}`);
      lessons.push([[r.title, r.teacher].filter(Boolean).join(' · '), r.time_text || '']);
    }
  }
  const config=context?.config;
  const keys=ZMAN_DISPLAY_KEYS;
  const notices=flat(slides).flatMap(s=>s.kind==='announcements'?s.items:[]);
  return { now, prayers, lessons,
    ...(context ? { title:config?.texts['header.title']??context.name,
      date:`${new HDate(now).renderGematriya(true)} · ${now.toLocaleDateString('he-IL',{weekday:'long',timeZone:'Asia/Jerusalem'})}`,
      zmanim:keys.map(k=>[config?.texts[`zman.${k}`]??ZMAN_DISPLAY_LABELS[k],formatTime(context.zmanim[k])] as [string,string]),
      zmanKeys:[...keys],hiddenZmanKeys:keys.filter(k=>config?.hidden.includes(`zman.${k}`)),
      parasha:weeklyParasha(now),dafYomi:`דף יומי: ${dafYomi(now)?.label??'—'}`,amudYomi:`עמוד יומי: ${amudYomi(now).label}`,seasonal:seasonalPrayers(now).text,
      footer:[weeklyParasha(now),`דף יומי: ${dafYomi(now)?.label??''}`,`עמוד יומי: ${amudYomi(now).label}`,seasonalPrayers(now).text].filter(Boolean).join('   ·   '),
      logos:config?.logos.map(l=>({url:l.urlDark||l.url,name:l.name})),
      announcements:notices.length?notices.map(a=>[a.title,a.body].filter(Boolean).join('\n')).join('\n\n'):'אין הודעות כרגע',
    }:{}),
  };
}
