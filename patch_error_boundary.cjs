const fs = require('fs');
const path = 'client/src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const errorBoundaryCode = `
import React, { ErrorInfo } from "react";

class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Global Error Caught:", error, errorInfo);
    // If it's a chunk load error (React lazy), force a reload to get new JS chunks
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
          <div className="w-16 h-16 mb-6 rounded-2xl bg-red-100 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            We've encountered an unexpected issue while loading the application. This is usually caused by an outdated browser cache.
          </p>
          <div className="flex gap-4">
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-2 bg-[#105B38] text-white rounded-md hover:bg-[#105B38]/90 font-medium"
            >
              Reload Application
            </button>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }} 
              className="px-6 py-2 border border-border bg-card text-foreground rounded-md hover:bg-muted font-medium"
            >
              Clear Cache & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
`;

content = content.replace('function App({ onReady }: { onReady?: () => void }) {', errorBoundaryCode + '\nfunction App({ onReady }: { onReady?: () => void }) {');

content = content.replace(
  '<AppContent onReady={onReady} />',
  '<GlobalErrorBoundary>\n            <AppContent onReady={onReady} />\n          </GlobalErrorBoundary>'
);

fs.writeFileSync(path, content, 'utf8');
