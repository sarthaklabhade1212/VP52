# VP52 assets

## `vp52-logo.png` (required)

Place the supplied **VP52 logo** here as:

```
client/src/assets/vp52-logo.png
```

Use the original supplied image as-is — do **not** recreate, redraw, crop, or
stretch it. It should keep its native (square) proportions.

### Where it is used
- `src/components/StartupSplash.jsx` — the startup animation logo.

### Behaviour when the file is absent
The startup splash resolves the logo via `new URL('../assets/vp52-logo.png',
import.meta.url)`, so the app still **builds and runs** without the file; the
splash simply shows a clean `VP52` gold wordmark until the PNG is added. Once
the file is dropped in at the path above and the app is rebuilt, the real logo
is bundled and shown automatically — no code change needed.

### Optional: Android launcher icon
The Android launcher icon (`android/app/src/main/res/mipmap-*`) was intentionally
left unchanged. To brand it from this same logo later, generate the density
variants from `vp52-logo.png` (e.g. `@capacitor/assets`) — this does not require
any change to the application id `com.sarthak.customerrewards`.
