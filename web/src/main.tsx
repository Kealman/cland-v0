import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from './Shell.tsx';
import './tokens.css';
import './fonts.css';
import './global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing shell root');
createRoot(root).render(<StrictMode><Shell /></StrictMode>);
