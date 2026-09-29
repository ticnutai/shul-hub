/**
 * A synagogue's logos, kept in its settings row (settings.logos) and shown in
 * the site header when one is chosen (settings.header_logo). Uploaded in its
 * details window under "בתי כנסת"; chosen in "תצוגת דף הבית".
 */
export interface SynagogueLogo {
  id: string;
  url: string;
  /** The file in the community-media bucket, so it can be removed with the logo. */
  path: string;
  name: string;
}

/** Whatever is stored, as logos - a hand-edited or damaged value is skipped, not trusted. */
export function readLogos(value: unknown): SynagogueLogo[] {
  return Array.isArray(value)
    ? value.filter(
        (l): l is SynagogueLogo =>
          Boolean(l) && typeof l.id === "string" && typeof l.url === "string" && typeof l.path === "string",
      )
    : [];
}
