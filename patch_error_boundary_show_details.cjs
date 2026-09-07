const fs = require('fs');
const path = 'client/src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldRender = `  render() {
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
  }`;

const newRender = `
  state: { hasError: boolean; error?: Error } = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
          <div className="w-16 h-16 mb-6 rounded-2xl bg-red-100 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Application Crash Log</h2>
          <div className="bg-red-50 text-red-900 border border-red-200 p-4 rounded-lg w-full max-w-3xl mb-6 overflow-auto max-h-[300px] text-sm font-mono text-left">
            <p className="font-bold mb-2">{this.state.error?.name}: {this.state.error?.message}</p>
            <pre className="whitespace-pre-wrap">{this.state.error?.stack}</pre>
          </div>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            Please copy the error above and send it to the developer.
          </p>
          <div className="flex gap-4">
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }} 
              className="px-6 py-2 bg-[#105B38] text-white rounded-md hover:bg-[#105B38]/90 font-medium"
            >
              Clear Cache & Force Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }`;

content = content.replace(oldRender, newRender);
fs.writeFileSync(path, content, 'utf8');
