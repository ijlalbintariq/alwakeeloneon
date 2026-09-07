const fs = require('fs');
const path = 'client/src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

// Change Router to not block on isLoading
content = content.replace(
`  useEffect(() => {
    if (!isLoading && !readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
  }, [isLoading, onReady]);

  if (isLoading) {
    return null;
  }`,
`  useEffect(() => {
    if (!readyFired.current) {
      readyFired.current = true;
      onReady?.(); // Hide splash screen instantly
    }
  }, [onReady]);`
);

fs.writeFileSync(path, content, 'utf8');
