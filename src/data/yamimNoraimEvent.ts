export interface EventScheduleItem {
  label: string;
  time: string;
  emphasis?: boolean;
}

export interface EventScheduleDay {
  title: string;
  hebrewDate: string;
  date: string;
  items: EventScheduleItem[];
  note?: string;
}

export const YAMIM_NORAIM_EVENT = {
  slug: "yamim-noraim-concord-2026",
  title: "תפילות הימים הנוראים",
  subtitle: "ראש השנה ויום כיפור בנוסח ספרדי",
  venue: "אולמי קונקורד",
  address: "רחוב מצדה 9, בני ברק",
  dateRange: "11–21 בספטמבר 2026",
  poster: "/events/yamim-noraim-concord-2026.jpg",
  contactName: "הרב עושרי",
  contactPhone: "054-6473461",
  contactPhoneRaw: "0546473461",
  seatPrice: "20 ₪",
  highlights: [
    "תפילות בנוסח ספרדי",
    "אווירה נעימה ומיוחדת",
    "חזנים נהדרים ובעלי רגש",
    "כיבוד ופינוקים בצאת הצום",
  ],
  notice: "אין עזרת נשים במקום",
  roshHashana: [
    {
      title: "ערב ראש השנה",
      hebrewDate: "יום שישי, כ״ט באלול",
      date: "11.9",
      items: [
        { label: "מנחה", time: "18:30" },
        { label: "אחות קטנה", time: "19:00" },
        { label: "ערבית", time: "19:30" },
      ],
    },
    {
      title: "יום א׳ של ראש השנה",
      hebrewDate: "שבת, א׳ בתשרי",
      date: "12.9",
      items: [
        { label: "שחרית", time: "8:00" },
        { label: "מנחה", time: "18:00" },
        { label: "תשליך", time: "18:30" },
        { label: "דברי התעוררות — הרב שמואל ממן", time: "19:00", emphasis: true },
        { label: "ערבית", time: "19:30" },
      ],
    },
    {
      title: "יום ב׳ של ראש השנה",
      hebrewDate: "יום ראשון, ב׳ בתשרי",
      date: "13.9",
      items: [
        { label: "שחרית", time: "8:00" },
        { label: "מנחה", time: "18:30" },
        { label: "מתחזקים", time: "19:00" },
        { label: "ערבית", time: "19:30" },
      ],
    },
  ] satisfies EventScheduleDay[],
  yomKippur: [
    {
      title: "ערב יום כיפור",
      hebrewDate: "יום ראשון, ט׳ בתשרי",
      date: "20.9",
      items: [
        { label: "כל נדרי", time: "18:00" },
        { label: "ערבית", time: "19:00" },
      ],
    },
    {
      title: "יום כיפור",
      hebrewDate: "יום שני, י׳ בתשרי",
      date: "21.9",
      items: [
        { label: "שחרית", time: "8:00" },
        { label: "מנחה", time: "15:00" },
        { label: "נעילה", time: "17:00" },
        { label: "הבדלה וסגירת הצום", time: "19:10", emphasis: true },
        { label: "רבנו תם — פינוקים מיוחדים", time: "19:54", emphasis: true },
      ],
    },
  ] satisfies EventScheduleDay[],
  selichot: {
    title: "מעמד הסליחות האחרונות והתרת נדרים",
    hebrewDate: "מוצאי שבת, ח׳ בתשרי",
    date: "19.9",
    time: "12:00",
    venue: "אולמי קונקורד",
  },
} as const;
