import { Navigate } from 'react-router-dom';

/** Legacy couch route — remote play is via the Play shelf invite flow. */
export default function SparkSplash() {
  return <Navigate to="/app" replace />;
}
