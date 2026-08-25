import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ALL_MEFARSHIM_HEBREW } from "@/types/sefaria";

interface SearchFiltersProps {
  sefer: number | null;
  searchType: "all" | "question" | "perush" | "pasuk";
  mefaresh: string;
  onSeferChange: (value: number | null) => void;
  onSearchTypeChange: (value: "all" | "question" | "perush" | "pasuk") => void;
  onMefareshChange: (value: string) => void;
}

const SEFARIM = [
  { id: 1, name: "בראשית" },
  { id: 2, name: "שמות" },
  { id: 3, name: "ויקרא" },
  { id: 4, name: "במדבר" },
  { id: 5, name: "דברים" }
];

const MEFARSHIM = ["הכל", ...ALL_MEFARSHIM_HEBREW];

export const SearchFilters = ({
  sefer,
  searchType,
  mefaresh,
  onSeferChange,
  onSearchTypeChange,
  onMefareshChange
}: SearchFiltersProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" dir="rtl">
      <div className="space-y-2 text-right">
        <Label>ספר</Label>
        <Select
          value={sefer?.toString() || "all"}
          onValueChange={(v) => onSeferChange(v === "all" ? null : parseInt(v))}
        >
          <SelectTrigger>
            <SelectValue placeholder="כל הספרים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הספרים</SelectItem>
            {SEFARIM.map(s => (
              <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 text-right">
        <Label>סוג</Label>
        <Select value={searchType} onValueChange={onSearchTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="pasuk">פסוקים</SelectItem>
            <SelectItem value="question">שאלות</SelectItem>
            <SelectItem value="perush">פירושים</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 text-right">
        <Label>מפרש</Label>
        <Select value={mefaresh} onValueChange={onMefareshChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEFARSHIM.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
