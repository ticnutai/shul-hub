/**
 * The board's pictures that live in CSS variables (the background and the
 * frames' image: --tv-bg-image, --frame-image), put in as data for the length
 * of a picture. html-to-image draws the board inside an SVG, where a picture
 * the page links to is not loaded - it embeds the ones in an element's own
 * style, but not those reached through a variable. So "צילום מסך אמיתי" of a
 * board in carved wood came back as its bare colours: the wall right, the
 * picture of it wrong. Returns the way back.
 */
export async function inlineVariableImages(root: HTMLElement): Promise<() => void> {
  const before = root.getAttribute("style");
  const toData = async (url: string) => {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  };
  for (const name of Array.from(root.style).filter((p) => p.startsWith("--"))) {
    const value = root.style.getPropertyValue(name);
    let next = value;
    for (const [whole, url] of value.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (url.startsWith("data:")) continue;
      try {
        next = next.replace(whole, `url("${await toData(url)}")`);
      } catch {
        /* a picture that does not load is left as it was */
      }
    }
    if (next !== value) root.style.setProperty(name, next);
  }
  return () => {
    if (before === null) root.removeAttribute("style");
    else root.setAttribute("style", before);
  };
}
