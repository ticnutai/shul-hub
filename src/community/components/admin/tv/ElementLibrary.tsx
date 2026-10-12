import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { confirmAction } from '@/components/ConfirmDialog';
import type { TvConfig } from '@/tv/config';
import { elementId, exportElementSet, importElementSet, MAX_ELEMENTS, MAX_ELEMENT_SETS } from '@/tv/elements';
import { READY_PARTS } from '@/tv/readyParts';
import { hideReady, isHiddenReady, showReady } from '@/tv/readyItems';
import { HiddenShelf } from './ReadyShelf';
import { SubPart } from './Parts';
import { NameForm } from './editorParts';
import { PartGrid, PartTile } from './GalleryTile';
import { SharedCatalogLibrary } from './SharedCatalogLibrary';

export function ElementLibrary({ config, selected, onEdit, onSelect }: {
  config: TvConfig;
  selected: string[];
  onSelect: (ids: string[]) => void;
  onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void;
}) {
  const [name, setName] = useState<string | null>(null);
  const chosen = config.elements.filter((e) => selected.includes(e.id));
  const insert = (key: string, elements: TvConfig['elements']) => {
    const added = importElementSet(exportElementSet(elements)).map((e) => ({ ...e, locked: false, hidden: false }));
    onEdit(`${key}:${elementId()}`, (c) => ({ ...c, elements: [...c.elements, ...added].slice(0, MAX_ELEMENTS) }));
    onSelect(added.map((e) => e.id));
  };
  const full = (n: number) => config.elements.length + n > MAX_ELEMENTS;

  /** The chosen parts kept under a name; the same name is asked about, then replaced. */
  const save = async () => {
    const clean = (name ?? '').trim().slice(0, 80);
    if (!clean || !chosen.length) return;
    const same = config.elementLibrary.find((x) => x.name === clean);
    if (same) {
      const ok = await confirmAction({
        title: `כבר יש חלק בשם „${clean}”`,
        description: 'להחליף אותו בחלקים שבחרתם עכשיו?',
        confirmLabel: 'החלפה',
        destructive: false,
      });
      if (!ok) return;
    } else if (config.elementLibrary.length >= MAX_ELEMENT_SETS) {
      toast.error(`הגעתם למספר החלקים השמורים המרבי (${MAX_ELEMENT_SETS}).`);
      return;
    }
    const kept = structuredClone(chosen);
    onEdit(`element-library:add:${same?.id ?? clean}`, (c) => ({
      ...c,
      elementLibrary: same
        ? c.elementLibrary.map((x) => (x.id === same.id ? { ...x, elements: kept } : x))
        : [...c.elementLibrary, { id: elementId(), name: clean, elements: kept }].slice(0, MAX_ELEMENT_SETS),
    }));
    setName(null);
    toast.success(`"${clean}" נשמר בחלקים שלי. הוא יישמר עם הלוח ב"שמור ושדר".`);
  };

  const remove = async (item: TvConfig['elementLibrary'][number]) => {
    const ok = await confirmAction({
      title: `למחוק את „${item.name}” מהחלקים שלי?`,
      description: 'עותקים שכבר על הלוח יישארו.',
      confirmLabel: 'מחיקה',
    });
    if (ok) onEdit(`element-library:remove:${item.id}`, (c) => ({ ...c, elementLibrary: c.elementLibrary.filter((x) => x.id !== item.id) }));
  };

  return (
    <div className="space-y-5">
      <SubPart title="חלקים משותפים מכל הערכות" testId="shared-catalog-parts" hint="זמינים בכל לוח, גם חדש. הוספה משנה את הטיוטה בלבד, ולא את המקור המשותף.">
        <SharedCatalogLibrary config={config} onEdit={onEdit} onSelect={onSelect} />
      </SubPart>

      <SubPart title="חלקים מוכנים מהערכות" testId="ready-parts" hint="עמודים, קשתות, מסגרות שעון ופמוטים מתוך הערכות - כל אחד לבד, בלי הקיר שמסביבו. מוסיפים לכל לוח, ומזיזים ומגדילים כרצונכם.">
        <PartGrid>
          {READY_PARTS.filter((item) => !isHiddenReady(config, 'part', item.id)).map((item) => (
            <PartTile
              key={item.id}
              name={item.name}
              elements={item.elements}
              addLabel={`הוספת ${item.name}`}
              disabled={full(item.elements.length)}
              onAdd={() => insert('ready-part:insert', item.elements)}
              // Hidden from this board's list, brought back from the shelf below - as every ready gallery.
              remove={{ ready: true, onClick: () => onEdit(`ready-part:hide:${item.id}`, (c) => hideReady(c, 'part', item.id)) }}
            />
          ))}
        </PartGrid>
        <HiddenShelf
          testId="ready-parts-hidden"
          items={READY_PARTS.filter((item) => isHiddenReady(config, 'part', item.id)).map((item) => ({ key: item.id, name: item.name }))}
          onRestore={(id) => onEdit(`ready-part:show:${id}`, (c) => showReady(c, 'part', id))}
        />
      </SubPart>

      <SubPart title="החלקים והתיבות שלי" testId="element-library" hint='שומרים בחירה פעם אחת ומוסיפים עותקים לכל לוח. אותה רשימה מופיעה גם ב"הוספת תוכן", ותיבה שנשמרה מ"עוד אפשרויות" של מסגרת נכנסת לכאן. נשמרת עם הלוח ובקובץ הלוח.'>
        {name === null ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={!chosen.length || config.elementLibrary.length >= MAX_ELEMENT_SETS}
              onClick={() => setName('')}
            >
              שמירת הבחירה בחלקים שלי
            </Button>
            <span className="text-[11px] text-muted-foreground">
              {chosen.length ? `נבחרו ${chosen.length} חלקים` : 'בחרו חלק או קבוצה ברשימה למעלה כדי לשמור אותם.'}
            </span>
          </div>
        ) : (
          <NameForm
            label="שם החלק"
            value={name}
            maxLength={80}
            placeholder="למשל: זוג עמודים מוזהבים"
            onChange={setName}
            onSave={() => void save()}
            onCancel={() => setName(null)}
          />
        )}
        {config.elementLibrary.length > 0 && (
          <PartGrid>
            {config.elementLibrary.map((item) => (
              <PartTile
                key={item.id}
                name={item.name}
                elements={item.elements}
                addLabel={`הוספת ${item.name} מהחלקים שלי`}
                disabled={full(item.elements.length)}
                onAdd={() => insert('element-library:insert', item.elements)}
                remove={{ ready: false, onClick: () => void remove(item) }}
              />
            ))}
          </PartGrid>
        )}
      </SubPart>
    </div>
  );
}
