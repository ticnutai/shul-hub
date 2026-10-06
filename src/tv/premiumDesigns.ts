import { newElement, type BoardElement } from './elements';
import type { SavedDesign } from './designs';

/** Textless original artwork is sampled in separate movable regions, never baked with data.
 * Regions include adjoining material; these are rectangular art pieces, not alpha cutouts. */
const presets = [
  { id: 'heritage-wood', name: 'עץ היכל · עיצוב מקורי 5', ink: '#321b07', light: true,
    pieces: [
      ['כתר וכותרת',0,0,100,12], ['בסיס ופס תחתון',0,88,100,12],
      ['עמוד שמאל',0,12,6.5,76], ['מסגרת תפילות',6.5,12,23,76], ['עמוד פנימי שמאל',29.5,12,4.5,76],
      ['אזור השעון',34,12,32.5,27], ['מסגרת מרכזית ופמוטים',34,39,32.5,49],
      ['עמוד פנימי ימין',66.5,12,4.5,76], ['מסגרת שיעורים',71,12,23,76], ['עמוד ימין',94,12,6,76],
    ],
    title: [38,2,24,8,6], main: [35,40,30,14,10], welcome: [39,56,24,8,4.6],
    left: [8,36,20,8,4.8], right: [72,36,21,8,4.8], prayers: [10,47,17,29,3.3], lessons: [74,48,17,29,3.3],
    clock: [45,32,10,5,4.2], analog: [44,11.5,11.8,19.5,4], footer: [36,89,28,7,3.8],
  },
  { id: 'luminous-ivory', name: 'שיש מואר · עיצוב מקורי 6', ink: '#3e2809', light: true,
    pieces: [
      ['עמוד שיש שמאל',0,0,10.5,100], ['עמוד שיש ימין',89.5,0,10.5,100],
      ['קשת עליונה ומדליון שעון',10.5,0,79,20], ['מסגרת הכותרת',30.5,20,39,12],
      ['מסגרת מרכזית ופמוטים',30.5,32,39,54], ['מסגרת תפילות',10.5,20,20,66], ['מסגרת שיעורים',69.5,20,20,66],
      ['בסיס ופס תחתון',10.5,86,79,14],
    ],
    title: [33,21,34,9,6.7], main: [33,38,35,12,9.8], welcome: [40,55,24,8,4.4],
    left: [11.5,33,18,8,4.2], right: [70,33,19,8,4.2], prayers: [13,46,15,29,3.1], lessons: [72,46,15,29,3.1],
    analog: [45,1.5,10,18.5,4], footer: [36,88,28,7,3.8],
  },
  { id: 'royal-sapphire', name: 'ספיר מלכותי · עיצוב מקורי 7', ink: '#ffe9af', light: false,
    pieces: [
      ['עמוד זהב שמאל',0,0,7,100], ['עמוד זהב ימין',93,0,7,100], ['כתר ווילונות',7,0,86,18],
      ['מסגרת תפילות',7,18,22.5,66], ['עמוד פנימי שמאל',29.5,18,4,66],
      ['מדליון השעון',33.5,18,33,17], ['מסגרת מרכזית ופמוטים',33.5,35,33,49],
      ['עמוד פנימי ימין',66.5,18,4.5,66], ['מסגרת שיעורים',71,18,22,66], ['בסיס ופס תחתון',7,84,86,16],
    ],
    title: [38,2.5,24,8,5.8], main: [34,38,32,12,9.2], welcome: [39,53,24,8,4.4],
    left: [9,33,19,8,4.6], right: [72,33,20,8,4.6], prayers: [10,46,17.5,29,3.3], lessons: [73,46,17.5,29,3.3],
    clock: [44,17.5,12,9,6.6], footer: [36,86,28,7,3.8],
  },
] as const;

export const PREMIUM_DESIGNS: SavedDesign[] = presets.map(p => {
  const elements: BoardElement[] = p.pieces.map(([name,x,y,width,height], i) => ({
    ...newElement('image'), id: `premium_${p.id}_art_${i}`, name, x,y,width,height,
    image: `/new-shul-assets/${p.id}.webp`, crop: {x,y,width,height},
  }));
  const add = (name: string, content: string, pos: readonly number[], binding?: BoardElement['binding'], color: string = p.ink) => {
    const [x,y,width,height,fontSize] = pos;
    elements.push({ ...newElement('text'), id: `premium_${p.id}_text_${elements.length}`, name, text: content, x,y,width,height,fontSize,color,binding });
  };
  add('שם בית הכנסת','בית הכנסת',p.title,undefined,p.light ? p.ink : '#10233e');
  if (p.id === 'heritage-wood') elements[elements.length - 1].color = '#f8d991';
  add('כותרת מרכזית','שבת שלום',p.main);
  add('ברכת קבלת פנים','ברוכים הבאים',p.welcome);
  add('כותרת תפילות','זמני תפילות',p.left);
  add('כותרת שיעורים','שיעורי תורה',p.right);
  add('תפילות היום','',p.prayers,'prayers');
  add('שיעורי היום','',p.lessons,'lessons');
  if ('clock' in p) add('שעון דיגיטלי','',p.clock,'clock',p.id === 'heritage-wood' ? '#f8d991' : p.ink);
  if ('analog' in p) add('שעון מחוגים','',p.analog,'analog');
  add('שורת תחתית','תורה  ·  תפילה  ·  קהילה',p.footer,undefined,p.id === 'heritage-wood' ? '#f8d991' : p.ink);
  return {
    id: `d_premium_${p.id}`, name: p.name, parts: ['background','frames','text','layout'], theme: p.light ? 'stone' : 'navy',
    colours: { '--tv-text': p.ink, '--tv-accent': '#d3ae60' },
    values: { screenLayout: 'composition', elements, boardFrame: null, backgroundImage: null,
      backgroundGradient: null, backgroundDim: 0, font: 'traditional', textScale: 1, titleStyle: 'plain',
      spacing: { top: 0, bottom: 0, sides: 0, gap: 0 },
    },
  };
});

/** Ten additional art plates share the same editable ivory-region geometry. */
export const EXTRA_ART_STYLES = [
  ['jerusalem-stone', 'אבן ירושלים', '#49341b', true],
  ['emerald-palace', 'ארמון אמרלד', '#ffebba', false],
  ['ruby-palace', 'אודם ונחושת', '#fff0cc', false],
  ['pearl-silver', 'פנינה וכסף', '#343b48', true],
  ['black-onyx', 'אוניקס וזהב', '#ffe8af', false],
  ['olive-mosaic', 'פסיפס זית', '#364023', true],
  ['cedar-copper', 'ארז ונחושת', '#4a2a13', true],
  ['sky-porcelain', 'תכלת ופורצלן', '#1e3955', true],
  ['amethyst-royal', 'אחלמה מלכותית', '#fff0d0', false],
  ['rose-alabaster', 'אלבסטר ורוד', '#643c30', true],
] as const;
const ivory = PREMIUM_DESIGNS.find(d => d.id === 'd_premium_luminous-ivory')!;
PREMIUM_DESIGNS.push(...EXTRA_ART_STYLES.map(([id, name, ink, light], index): SavedDesign => ({
  ...structuredClone(ivory), id: `d_premium_${id}`, name: `${name} · אוסף חדש ${index + 8}`,
  theme: light ? 'stone' : 'navy', colours: { '--tv-text': ink, '--tv-accent': '#d3ae60' },
  values: { ...structuredClone(ivory.values), elements: ivory.values.elements!.map((e, i) => ({
    ...structuredClone(e), id: `premium_${id}_${i}`,
    image: e.kind === 'image' ? `/new-shul-assets/${id}.webp` : e.image,
    color: id === 'ruby-palace' && (e.binding === 'analog' || e.name === 'שם בית הכנסת') ? '#49341b' : ink,
    hidden: ['olive-mosaic', 'sky-porcelain'].includes(id) && e.name === 'שורת תחתית',
  })) },
})));
