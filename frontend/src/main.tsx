import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LandingPage from './pages/LandingPage';
import DocsPage from './pages/DocsPage';
import './index.css';

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const Page =
  path === '/demo' ? App :
  path === '/docs' ? DocsPage :
  LandingPage;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>
);
