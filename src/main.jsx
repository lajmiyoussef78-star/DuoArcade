import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Arcade from './pages/Arcade.jsx';
import './styles/base.css';
import './styles/landing.scoped.css';
import './styles/arcade.scoped.css';
import './styles/couple.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Arcade />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
