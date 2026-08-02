import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Arcade from './pages/Arcade.jsx';
import FriendMatchScreen from './pages/FriendMatchScreen.jsx';
import './styles/friends.css';
import Whiteboard from './pages/Whiteboard.jsx';
import Snap from './pages/Snap.jsx';
import SparkSplash from './pages/SparkSplash.jsx';
import Week from './pages/Week.jsx';
import { initAppearance } from './lib/appearance.js';
import './styles/base.css';

initAppearance();
import './styles/landing.scoped.css';
import './styles/arcade.scoped.css';
import './styles/couple.css';
import './styles/arena.css';
import './styles/todos.css';
import './styles/kitchen.scoped.css';
import './styles/timetable.css';
import './styles/soccer.css';
import './styles/moles.css';
import './styles/forbidden.css';
import './styles/wordbomb.css';
import './styles/uno.css';
import './styles/coup.css';
import './styles/xp.css';
import './styles/challenges.css';
import './styles/seabattle.css';
/* Redesign layer — must stay last so it can restyle the sheets above. */
import './styles/ui-2026.css';

function ChallengeRedirect() {
  const { code } = useParams();
  return <Navigate to={`/app?duo=${encodeURIComponent(code || '')}`} replace />;
}

function ArenaRedirect() {
  const { matchCode } = useParams();
  return <Navigate to={matchCode ? `/app/arena/${matchCode}` : '/app/arena'} replace />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
    <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app/*" element={<Arcade />} />
        <Route path="/leaderboard" element={<Navigate to="/app/leaderboard" replace />} />
        <Route path="/challenges/:code" element={<ChallengeRedirect />} />
        <Route path="/arena" element={<ArenaRedirect />} />
        <Route path="/arena/:matchCode" element={<ArenaRedirect />} />
        <Route path="/friend/:matchCode" element={<FriendMatchScreen />} />
        <Route path="/whiteboard/:code" element={<Whiteboard />} />
        <Route path="/snap/:code" element={<Snap />} />
        <Route path="/spark-splash" element={<SparkSplash />} />
        <Route path="/week/:code" element={<Week />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
