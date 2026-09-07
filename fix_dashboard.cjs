const fs = require('fs');
let code = fs.readFileSync('client/src/experimental/pages/PreviewDashboard.tsx', 'utf-8');

// Add isLoadingUsage to the usage query
code = code.replace(
  'const { data: usage } = useQuery<UsageData>({',
  'const { data: usage, isLoading: isLoadingUsage } = useQuery<UsageData>({'
);

const newRender = `
  if (isLoadingUsage) {
    return (
      <PreviewShell>
        <div className="flex flex-col h-full bg-[#FBFBFA]">
          <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
            <div className="animate-pulse space-y-8">
              <div className="h-24 bg-gray-200 rounded-2xl w-full"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="h-32 bg-gray-200 rounded-2xl"></div>
                <div className="h-32 bg-gray-200 rounded-2xl"></div>
                <div className="h-32 bg-gray-200 rounded-2xl"></div>
                <div className="h-32 bg-gray-200 rounded-2xl"></div>
              </div>
            </div>
          </div>
        </div>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell>`;

code = code.replace('  return (\n    <PreviewShell>', newRender);

fs.writeFileSync('client/src/experimental/pages/PreviewDashboard.tsx', code);
console.log("Fixed dashboard empty flash");
