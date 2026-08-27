import React from 'react';
import './StartupSplash.css';

/*
 * VP52 startup splash.
 *
 * Behaviour / guarantees (see PART 3 / PART 5 of the branding task):
 *  - Pure visual overlay. Renders once when the app mounts (i.e. once per app
 *    launch) and then unmounts itself. It is a sibling of the router, NOT a
 *    route, so normal in-app navigation never re-triggers it.
 *  - Touches no auth / localStorage / session / API / navigation state.
 *  - The app renders underneath the whole time, so the splash never delays
 *    auth initialisation or API setup — those run concurrently behind it.
 *  - Cannot block the app permanently: the CSS master animation fades the
 *    overlay out and sets pointer-events:none on its own; a JS timer also
 *    unmounts it; and any render error is swallowed by the boundary below.
 *  - Respects prefers-reduced-motion (shorter, simpler fade).
 */

// The supplied logo lives at src/assets/vp52-logo.png. Resolving it via
// import.meta.url keeps the build green even if the PNG has not been dropped in
// yet (Vite bundles + hashes it when present; otherwise the <img> onError below
// falls back to a clean VP52 wordmark). The logo is never recreated here.
function resolveLogoUrl() {
  try {
    return new URL('../assets/vp52-logo.png', import.meta.url).href;
  } catch (e) {
    return null;
  }
}

function prefersReducedMotion() {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch (e) {
    return false;
  }
}

function Splash() {
  const [gone, setGone] = React.useState(false);
  const [logoOk, setLogoOk] = React.useState(true);

  React.useEffect(() => {
    // Unmount slightly after the CSS lifecycle finishes (2400ms normal / 900ms
    // reduced), purely for DOM cleanup. The CSS has already hidden it by then.
    const total = prefersReducedMotion() ? 1000 : 2500;
    const timer = setTimeout(() => setGone(true), total);
    return () => clearTimeout(timer);
  }, []);

  if (gone) return null;

  const logoUrl = resolveLogoUrl();

  return (
    <div className="vp52-splash" role="presentation" aria-hidden="true">
      <div className="vp52-splash__logo-wrap">
        <div className="vp52-splash__glow" />
        {logoOk && logoUrl ? (
          <img
            className="vp52-splash__logo"
            src={logoUrl}
            alt=""
            draggable="false"
            onError={() => setLogoOk(false)}
          />
        ) : (
          <div className="vp52-splash__fallback">VP52</div>
        )}
      </div>
      <div className="vp52-splash__name">VP52</div>
    </div>
  );
}

// Error boundary: the intro animation must NEVER take the app down. If Splash
// throws for any reason, we render nothing and the app proceeds normally.
class StartupSplash extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // Intentionally swallowed — a broken splash should be invisible, not fatal.
  }

  render() {
    if (this.state.failed) return null;
    return <Splash />;
  }
}

export default StartupSplash;
