/** Discovery tags only: never calendar conditions or board scheduling. */
export const CATALOG_CATEGORIES=['הכול','ראש חודש','שבת','סוכות','חנוכה','פסח','שבועות','ראש השנה','פורים','כללי'] as const;
export type CatalogCategory=typeof CATALOG_CATEGORIES[number];
export function catalogCategory(item:{id:string;name:string}):CatalogCategory {
 const text=item.id+' '+item.name;
 for(const [label,pattern] of [
  ['ראש חודש',/d_rc_|ראש חודש/],['ראש השנה',/roshcomplete|shofarvoice|ראש השנה|קול שופר/],
  ['סוכות',/sukk|סוכות|סוכה/],['חנוכה',/hanukk|chanuk|חנוכה/],
  ['פסח',/pesach|פסח/],['שבועות',/shavu|שבועות|מתן תורה/],['פורים',/purim|פורים/],
  ['שבת',/shabbat|salon|שבת|חלות/],
 ] as const)if(pattern.test(text))return label;
 return 'כללי';
}
