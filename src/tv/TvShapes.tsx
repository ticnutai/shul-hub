/**
 * The silhouettes the ornate skins are cut to.
 *
 * A CSS border-radius can only make an ellipse, so a dome, an onion dome, a
 * scalloped edge or a shield has to come from a real path. These are clip
 * paths in `objectBoundingBox` units: the path is written once in a 0..1
 * square and every element stretches it to its own size, at any resolution,
 * with no image to download.
 *
 * The skins reference them as `clip-path: url(#tv-shape-dome)`. The element
 * itself carries the frame colour and its ::before carries the inner face,
 * inset by the frame's width and cut to the same shape - that is how a
 * clipped panel gets a border, since a real border would be cut away.
 */
export function TvShapes() {
  return (
    <svg aria-hidden focusable="false" width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        {/* a round arch: the top is half an ellipse, the foot is square */}
        <clipPath id="tv-shape-dome" clipPathUnits="objectBoundingBox">
          <path d="M0,0.3 C0,0.12 0.2,0 0.5,0 C0.8,0 1,0.12 1,0.3 L1,0.97 Q1,1 0.97,1 L0.03,1 Q0,1 0,0.97 Z" />
        </clipPath>

        {/* a כיפה: shoulders that swell out and draw in to a point */}
        <clipPath id="tv-shape-onion" clipPathUnits="objectBoundingBox">
          <path d="M0.5,0 C0.55,0.05 0.67,0.05 0.82,0.11 C0.94,0.16 1,0.22 1,0.38 L1,0.97 Q1,1 0.97,1 L0.03,1 Q0,1 0,0.97 L0,0.38 C0,0.22 0.06,0.16 0.18,0.11 C0.33,0.05 0.45,0.05 0.5,0 Z" />
        </clipPath>

        {/* a pointed arch, as over the doors of an old study hall */}
        <clipPath id="tv-shape-lancet" clipPathUnits="objectBoundingBox">
          <path d="M0.5,0 C0.68,0.06 0.86,0.14 1,0.26 L1,0.97 Q1,1 0.97,1 L0.03,1 Q0,1 0,0.97 L0,0.26 C0.14,0.14 0.32,0.06 0.5,0 Z" />
        </clipPath>

        {/* a scalloped plate: eight shells along the top and the foot */}
        <clipPath id="tv-shape-scallop" clipPathUnits="objectBoundingBox">
          <path
            d="M0,0.05
               q0.0625,-0.05 0.125,0 q0.0625,-0.05 0.125,0 q0.0625,-0.05 0.125,0 q0.0625,-0.05 0.125,0
               q0.0625,-0.05 0.125,0 q0.0625,-0.05 0.125,0 q0.0625,-0.05 0.125,0 q0.0625,-0.05 0.125,0
               L1,0.95
               q-0.0625,0.05 -0.125,0 q-0.0625,0.05 -0.125,0 q-0.0625,0.05 -0.125,0 q-0.0625,0.05 -0.125,0
               q-0.0625,0.05 -0.125,0 q-0.0625,0.05 -0.125,0 q-0.0625,0.05 -0.125,0 q-0.0625,0.05 -0.125,0 Z"
          />
        </clipPath>

        {/* a shield, for the plate that carries a name */}
        <clipPath id="tv-shape-shield" clipPathUnits="objectBoundingBox">
          <path d="M0.04,0 L0.96,0 Q1,0 1,0.06 L1,0.58 C1,0.8 0.78,0.93 0.5,1 C0.22,0.93 0,0.8 0,0.58 L0,0.06 Q0,0 0.04,0 Z" />
        </clipPath>

        {/* the corners cut away, as on a cut stone slab */}
        <clipPath id="tv-shape-octagon" clipPathUnits="objectBoundingBox">
          <path d="M0.06,0 L0.94,0 L1,0.1 L1,0.9 L0.94,1 L0.06,1 L0,0.9 L0,0.1 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}
