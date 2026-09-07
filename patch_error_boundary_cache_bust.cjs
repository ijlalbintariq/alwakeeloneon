const fs = require('fs');
const path = 'client/src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const getDerivedStateFn = `  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }`;

const componentDidCatchFn = `  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    const msg = error.message || "";
    if (
      error.name === 'ChunkLoadError' || 
      msg.includes('Loading chunk') || 
      msg.includes('Unable to preload CSS') ||
      msg.includes('Failed to fetch dynamically imported module')
    ) {
      // Hard cache-busting reload
      const url = new URL(window.location.href);
      url.searchParams.set('v', Date.now().toString());
      window.location.href = url.toString();
    }
  }`;

content = content.replace(getDerivedStateFn, componentDidCatchFn);

// Also fix the button to use cache-busting
const oldButton = `              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }} `;
const newButton = `              onClick={() => {
                localStorage.clear();
                const url = new URL(window.location.href);
                url.searchParams.set('v', Date.now().toString());
                window.location.href = url.toString();
              }} `;

content = content.replace(oldButton, newButton);
fs.writeFileSync(path, content, 'utf8');
