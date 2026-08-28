import React from 'react';
import './StartupSplash.css';

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
    const total = prefersReducedMotion() ? 1000 : 4000;
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
          <div className="vp52-splash__coin-container">
            <img
              className="vp52-splash__logo"
              src={logoUrl}
              alt=""
              draggable="false"
              onError={() => setLogoOk(false)}
            />
            <div className="vp52-splash__sheen" />
          </div>
        ) : (
          <div className="vp52-splash__fallback">VP52</div>
        )}
      </div>
    </div>
  );
}

class StartupSplash extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {}

  render() {
    if (this.state.failed) return null;
    return <Splash />;
  }
}

export default StartupSplash;
