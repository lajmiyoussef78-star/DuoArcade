import { useNavigate } from 'react-router-dom';
import '../styles/sparksplash.css';

export default function SparkSplash() {
  const navigate = useNavigate();

  return (
    <div className="ss-page">
      <div className="ss-top">
        <button type="button" className="btn small ghost" onClick={() => navigate('/app')}>&larr; Back</button>
        <div className="ss-title">Spark &amp; Splash</div>
        <div className="ss-tag">Crystal Caverns</div>
      </div>
      <iframe
        className="ss-frame"
        src="/spark-splash/index.html"
        title="Spark & Splash — Crystal Caverns Adventure"
        allow="autoplay"
      />
      <p className="ss-note">
        Co-op on one keyboard — <span className="ss-fire">Spark</span> (A/D/W) and{' '}
        <span className="ss-water">Splash</span> (arrow keys). Both reach your doors to clear a level.
      </p>
    </div>
  );
}
