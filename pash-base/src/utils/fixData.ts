import { replaceHashemName, normalizeHebrewText } from './textUtils';

// Utility to fix data issues in text content
export const fixText = (text: string): string => {
  if (!text) return text;
  
  // Normalize invisible joiners / presentation forms so nikud & te'amim stay
  // attached to their base letter.
  let fixed = normalizeHebrewText(text);

  // Replace "אבן עזרה" with "אבן עזרא"
  fixed = fixed.replace(/אבן עזרה/g, 'אבן עזרא');
  
  // Replace "יקוק" with "יהוה" (handles with nikkud too)
  fixed = replaceHashemName(fixed);
  
  return fixed;
};

// Legacy function for backward compatibility - deprecated
export const fixJsonContent = (content: string): string => {
  return fixText(content);
};
