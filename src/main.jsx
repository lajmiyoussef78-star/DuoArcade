import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Arcade from './pages/Arcade.jsx';
import Arena from './pages/Arena.jsx';
import ArenaMatch from './pages/ArenaMatch.jsx';
import Whiteboard from './pages/Whiteboard.jsx';
import './styles/base.css';
import './styles/landing.scoped.css';
import './styles/arcade.scoped.css';
import './styles/couple.css';
import './styles/arena.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Arcade />} />
        <Route path="/arena" element={<Arena />} />
        <Route path="/arena/:matchCode" element={<ArenaMatch />} />
        <Route path="/whiteboard/:code" element={<Whiteboard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
