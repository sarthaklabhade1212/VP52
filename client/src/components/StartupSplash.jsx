
import React from 'react';
import './StartupSplash.css';

// 1x1 solid black PNG data URI to prevent Chromium WebView from showing default poster
const BLACK_POSTER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function Splash() {
  const [gone, setGone] = React.useState(false);
  const [videoFailed, setVideoFailed] = React.useState(false);
  const [showSkip, setShowSkip] = React.useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = React.useState(false);

  const videoRef = React.useRef(null);

  React.useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const skipTimer = window.setTimeout(() => {
      setShowSkip(true);
    }, 1500);

    const timer = window.setTimeout(
      () => setGone(true),
      reducedMotion ? 1200 : 10000
    );

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(skipTimer);
    };
  }, []);

  const startVideo = React.useCallback(async () => {
    const video = videoRef.current;
    if (!video || gone) return;

    video.muted = true;

    try {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (error) {
      console.warn('Splash video autoplay was blocked or failed:', error);
      setVideoFailed(true);
      setGone(true);
    }
  }, [gone]);

  React.useEffect(() => {
    startVideo();
  }, [startVideo]);

  if (gone) return null;

  return (
    <div
      className="vp52-splash"
      role="presentation"
      aria-hidden="true"
      onClick={() => setGone(true)}
      style={{ cursor: 'pointer' }}
    >
      {!videoFailed && (
        <video
          ref={videoRef}
          className={`vp52-splash__video ${isVideoPlaying ? 'vp52-splash__video--playing' : ''}`}
          autoPlay
          muted
          playsInline
          loop={false}
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          preload="auto"
          poster={BLACK_POSTER}
          onCanPlay={startVideo}
          onPlaying={() => setIsVideoPlaying(true)}
          onEnded={() => setGone(true)}
          onError={() => {
            setVideoFailed(true);
            setGone(true);
          }}
        >
          <source src="/vp52-splash.mp4" type="video/mp4" />
          <source src="/vp52-splash.mov" type="video/quicktime" />
        </video>
      )}

      {showSkip && (
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            color: 'rgba(212, 175, 55, 0.75)',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            pointerEvents: 'none'
          }}
        >
          Tap anywhere to skip
        </div>
      )}
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

  componentDidCatch(error, info) {
    console.error('Startup splash error:', error, info);
  }

  render() {
    if (this.state.failed) return null;
    return <Splash />;
  }
}

export default StartupSplash;
