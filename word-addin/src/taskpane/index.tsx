import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import './styles/global.css';

Office.onReady(() => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App />);
  }
});
