import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);
// Loaded fine: allow one future auto-reload after a new deploy.
setTimeout(() => { try { sessionStorage.removeItem('pb.reloaded'); } catch { /* blocked */ } }, 10000);
