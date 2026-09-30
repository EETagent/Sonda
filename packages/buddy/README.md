Buddy is the launcher's animated SVG avatar.

```ts
import { defineBuddyAvatar, type BuddyAvatarState } from "@sonda/buddy";

defineBuddyAvatar();
```

Use `<buddy-avatar>` to render it. Customize its colors with
`--buddy-avatar-color` and `--buddy-avatar-eye-color`. The SVG exposes its current
state through `data-buddy-state`.

The engine can also be imported from `@sonda/buddy/engine`, which exports
`createBuddyEngine`, `circlePath`, `shapePaths`, and the engine types.

The implementation lives in `engine/`:

- `types.ts`: shared engine and avatar contracts.
- `artwork.ts`: eye contours and SVG artwork.
- `geometry.ts` and `shapes.ts`: contour math, face fitting, and body shapes.
- `math.ts` and `springs.ts`: easing, random ranges, and spring integration.
- `state-presets.ts`: expression choices and state timing.
- `particles.ts`: confetti, orbit belts, and gradient trails.
- `morphs.ts` and `morph-renderers.ts`: morph geometry and SVG rendering.
- `create-engine.ts`: animation state and the frame loop.
- `index.ts`: public engine exports.

Run `pnpm --filter @sonda/buddy typecheck` for strict TypeScript validation.
