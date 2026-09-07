const fs = require('fs');
const path = 'client/src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldRenderStart = `  render() {`;
const oldRenderEnd = `    return this.props.children;
  }`;

// Find the boundaries of the render block
const startIndex = content.indexOf(oldRenderStart);
const endIndex = content.indexOf(oldRenderEnd, startIndex) + oldRenderEnd.length;

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find render block");
    process.exit(1);
}

const newRender = `  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FBFBFA] text-[#0F172A] font-sans">
          <div className="w-16 h-16 mb-6 rounded-2xl bg-[#105B38]/10 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#105B38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.94-4.81"></path></svg>
          </div>
          <h2 className="text-2xl font-serif font-bold mb-3 text-[#105B38]">Update Available</h2>
          <p className="text-[#64748B] text-center mb-8 max-w-md text-sm leading-relaxed">
            We've just released a new version of the Al Wakeelo platform. Your browser is holding onto an older version in its cache, which is preventing the page from loading correctly.
          </p>
          
          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl p-6 w-full max-w-md mb-8">
            <h3 className="font-semibold text-[13px] uppercase tracking-wider text-[#64748B] mb-4 text-center">How to continue</h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-gray-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"></path></svg>
                </div>
                <div>
                  <p className="text-sm font-medium">Windows & Linux Users</p>
                  <p className="text-xs text-[#64748B] mt-1">Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">F5</kbd> or <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">R</kbd></p>
                </div>
              </div>
              
              <div className="h-px w-full bg-[#E2E8F0]"></div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-gray-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"></path><path d="M10 2c1 .5 2 2 2 5"></path></svg>
                </div>
                <div>
                  <p className="text-sm font-medium">Mac Users</p>
                  <p className="text-xs text-[#64748B] mt-1">Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">R</kbd></p>
                </div>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => {
              localStorage.clear();
              const url = new URL(window.location.href);
              url.searchParams.set('v', Date.now().toString());
              window.location.href = url.toString();
            }} 
            className="px-6 py-2.5 bg-[#105B38] text-white rounded-lg hover:bg-[#105B38]/90 font-medium text-sm transition-colors shadow-sm"
          >
            Or click here to Auto-Update
          </button>
        </div>
      );
    }
    return this.props.children;
  }`;

const newContent = content.substring(0, startIndex) + newRender + content.substring(endIndex);
fs.writeFileSync(path, newContent, 'utf8');
console.log("Successfully updated Error Boundary UI");
