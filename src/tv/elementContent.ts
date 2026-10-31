import type { BoardSlide } from './useBoardData';
import { prayerLabel } from '@/community/lib/data';
import type { TvConfig } from './config';
import { formatTime, ZMAN_DISPLAY_LABELS, ZMAN_DISPLAY_KEYS, type Zmanim } from '@/community/lib/zmanim';
import { amudYomi, dafYomi, weeklyParasha, seasonalPrayers } from './learning';
import { dayTitleOn, holyDayEnd } from '@community/lib/specialDays';
import { jerusalemWeekday } from '@community/lib/minyan-time';
import { torahReadingOn } from './torahReading';
import { hebrewDayAt } from './hebrewDay';
export interface ElementData { now: Date; shabbat?: [string, string][]; shabbatTitle?: string; prayers: [string, string][]; lessons: [string, string][]; title?: string; date?: string; occasion?: string; zmanim?: [string,string][]; zmanKeys?: string[]; hiddenZmanKeys?: string[]; parasha?:string; dafYomi?:string; amudYomi?:string; seasonal?:string; footer?: string; logos?: {url:string;name:string}[]; announcements?: string }
/**
 * This Shabbat - today's on Shabbat, else the coming one: its start (Friday's
 * candle lighting), its end, the last time for the Shema, the parasha and the
 * haftarah - worked out anew every week, nothing typed.
 */
export function shabbatInfo(now: Date, zmanimOn: (d: Date) => Zmanim): { title: string; rows: [string, string][] } {
  const sat = new Date(now.getTime() + ((6 - jerusalemWeekday(now) + 7) % 7) * 86_400_000);
  const fri = new Date(sat.getTime() - 86_400_000);
  const z = zmanimOn(sat);
  const parasha = weeklyParasha(sat);
  const haftarah = torahReadingOn(sat)?.haftarah;
  return {
    title: ['שבת קודש', parasha].filter(Boolean).join(' · '),
    rows: [
      ['כניסת השבת', formatTime(zmanimOn(fri).candle)],
      ['יציאת השבת', formatTime(holyDayEnd(z))],
      ['סוף זמן ק״ש מג״א', formatTime(z.sof_zman_shma_mga72)],
      ['סוף זמן ק״ש גר״א', formatTime(z.sof_zman_shma)],
      ...(parasha ? [['פרשת השבוע', parasha.replace(/^פרשת\s+/, '')] as [string, string]] : []),
      ...(haftarah ? [['הפטרה', haftarah] as [string, string]] : []),
    ],
  };
}

export function elementData(slides: BoardSlide[], now: Date, context?: {config:TvConfig; name:string; zmanim:Zmanim; zmanimOn?: (d: Date) => Zmanim; endMinutes?: number}): ElementData {
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
  // The Hebrew day: from sunset tomorrow's date, from מוצאי שבת the coming week's parasha (hebrewDay.ts).
  const day=context?hebrewDayAt(now,context.zmanim,context.endMinutes??config?.shabbat.endMinutesAfterSunset):null;
  return { now, prayers, lessons,
    ...(context ? { title:config?.texts['header.title']??context.name,
      date:`${day!.hebrew} · ${day!.weekday}`,
      // The day's special days in a line - Rosh Chodesh with its month and, on two days, which: "ראש חודש חשון · היום הראשון".
      occasion:dayTitleOn(now),
      zmanim:keys.map(k=>[config?.texts[`zman.${k}`]??ZMAN_DISPLAY_LABELS[k],formatTime(context.zmanim[k])] as [string,string]),
      zmanKeys:[...keys],hiddenZmanKeys:keys.filter(k=>config?.hidden.includes(`zman.${k}`)),
      parasha:day!.parasha??undefined,dafYomi:`דף יומי: ${dafYomi(day!.date)?.label??'—'}`,amudYomi:`עמוד יומי: ${amudYomi(day!.date).label}`,seasonal:seasonalPrayers(day!.date).text,
      footer:[day!.parasha,`דף יומי: ${dafYomi(day!.date)?.label??''}`,`עמוד יומי: ${amudYomi(day!.date).label}`,seasonalPrayers(day!.date).text].filter(Boolean).join('   ·   '),
      logos:config?.logos.map(l=>({url:l.urlDark||l.url,name:l.name})),
      ...(context.zmanimOn ? (() => { const s = shabbatInfo(now, context.zmanimOn!); return { shabbat: s.rows, shabbatTitle: s.title }; })() : {}),
      announcements:notices.length?notices.map(a=>[a.title,a.body].filter(Boolean).join('\n')).join('\n\n'):'אין הודעות כרגע',
    }:{}),
  };
}
