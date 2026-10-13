# Hard-sci-fi geometry review

All seven families were modeled after the [generated concept sheets](../concept-art/README.md). Existing station identities, orbit data, planet surfaces and HUD are preserved. Segmented habitats, radiator leaves, pressure-vessel bands, docking mechanisms, gantries, dish ribs and supported base structures are actual geometry or explicit structural linework.

## Matched model renders

Captured from the same isolated Three.js viewer, with the application’s bloom settings, camera direction and bounds-relative framing. Baseline is commit `8581b59`; after images include the reduced edge intensity needed for the added detail. These are actual WebGL renders, not generated images. The reference art guides structure and silhouette rather than supplying textures.

| Family | Before | After | Draw calls before → after | Triangles before → after |
| --- | --- | --- | --- | --- |
| generationShip | [Before](before-generationShip.png) | [After](after-generationShip.png) | 270 → 20 | 8346 → 10034 |
| ringResort | [Before](before-ringResort.png) | [After](after-ringResort.png) | 82 → 20 | 6742 → 8422 |
| modularLab | [Before](before-modularLab.png) | [After](after-modularLab.png) | 152 → 17 | 2330 → 4010 |
| shipyard | [Before](before-shipyard.png) | [After](after-shipyard.png) | 131 → 17 | 7166 → 8246 |
| transferHub | [Before](before-transferHub.png) | [After](after-transferHub.png) | 107 → 20 | 7962 → 9258 |
| relaySat | [Before](before-relaySat.png) | [After](after-relaySat.png) | 41 → 17 | 614 → 1718 |
| surfaceSite | [Before](before-surfaceSite.png) | [After](after-surfaceSite.png) | 48 → 17 | 1958 → 4142 |

Counts include the identical bloom/output pipeline. Rigid geometry is batched per moving assembly; the turntable and spinning habitats remain independent. More triangles and line segments are intentional, while fewer draw calls reduce submission overhead.

Raw measurements are in `before-metrics.json` and `after-metrics.json`. Timings are a short synchronous render-submission microbenchmark (five warm-up renders, ten measured renders), with browser timer quantization; they are **not** a GPU frame-time or device FPS guarantee. Zero values indicate timer resolution. Draw counts and visual comparison are the reliable evidence here.

## Reproduce

Run `node scripts/review-stations.cjs 8581b59` for the baseline, or `node scripts/review-stations.cjs` for the working tree. Open `http://localhost:8091`. Stop the server before switching versions. The viewer builds only into `node_modules/.cache/station-review`, outside the app bundle.

The browser console exposes `review.types`, `review.show(type, highlighted, angle)`, `review.spin(seconds)`, `review.capture()`, `review.stats()` and `review.benchmark()`. It renders deterministically without an animation loop, allowing identical viewing angles and consistent capture.

## Validation

- TypeScript checking and production webpack build pass. Webpack retains its asset-size advisories for the existing textures and app bundle.
- The focused batching regression test checks world bounds, independent moving assemblies, reduced renderable count, highlight reset and distance fade.
- The existing full Jest suite fails on the baseline before executing `App.test.tsx`: Jest cannot parse `three/examples/jsm/libs/stats.module.js` (`Unexpected token export`). This change does not repair that unrelated test configuration.
- Visually inspected all seven after renders against their concept sheets; reduced additive edge brightness after the first pass over-bloomed the ark tanks and resort spokes.

## Application integration

Visited Home, Terra, Luna and Jupiter. All nine station IDs entered focus successfully through the existing selection event, and Escape restored overview after each sector. A pointer click on Axios also entered focus. No browser `error` events were recorded during that desktop pass. Captures of settled focus views are included as `sector-0-focus.png` through `sector-3-focus.png` (canvas-only, without the DOM HUD). Luna's capture includes the surface mine, relay network and transfer hub.

The browser's full-page screenshot path initially timed out, so deterministic model images use a preserved WebGL drawing buffer. Application canvas captures used a browser-only timer-backed animation callback to work around background requestAnimationFrame throttling; no instrumentation was added to application code. This limits performance conclusions from the application pass.

Mobile layout was exercised at 390 × 844; document scroll width remained 390 and the ark focus panel was present. Desktop and mobile integration observations are smoke checks, not automated end-to-end assertions or a device performance certification.
