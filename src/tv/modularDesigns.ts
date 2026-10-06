import type { SavedDesign } from './designs';

/** Independent artwork, native box fills and live content; no cropped composite. */
export const MODULAR_DESIGNS: SavedDesign[] = [{
  id: 'd_sapphireparts', name: 'ספיר ופלטינה · חלקים עצמאיים',
  parts: ['background', 'frames', 'text', 'layout'], theme: 'navy',
  colours: { '--tv-text': '#f4f7ff', '--tv-text-dim': '#bacbe3', '--tv-accent': '#c7ddff', '--tv-accent-2': '#a9c2e5', '--tv-panel': '#0d203a' },
  values: {
    backgroundImage: '/new-shul-assets/sapphire-modular-background.webp',
    backgroundGradient: null, backgroundOverlay: null, backgroundDim: 0,
    backgroundTune: { brightness: .8, saturation: 1, hue: 0, blur: 0, tint: null, tintStrength: .35 },
    boardFrame: 'picture', boardFrameImage: '/new-shul-assets/sapphire-modular-outer-frame.webp',
    boardFrameTune: { size: 1, length: 1, x: 0, y: 0, sides: 'both' },
    frame: { shape: 'round', top: 0, bottom: 0 },
    frameStyle: { fill: '#0b1628', fillOpacity: 1, line: null, lineWidth: 0, depth: 0, image: '/new-shul-assets/sapphire-modular-panel-frame.webp', imageSlice: 20, imageWidth: 2.5 },
    frameLooks: {}, styles: {}, elements: [], titleStyle: 'plain', font: 'classic', textScale: 1, tracking: null,
    screenLayout: 'dashboard', clockStyle: 'digital', spacing: { top: 2.6, bottom: 1.6, sides: 5, gap: 2 },
  },
}];
