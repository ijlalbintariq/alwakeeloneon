import fs from 'fs';

const filePath = 'client/src/experimental/pages/PreviewAuth.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

if (!code.includes('ArrowLeft')) {
  code = code.replace('ArrowRight, Phone', 'ArrowLeft, ArrowRight, Phone');
}

const targetReturn = `  return (
    <div className="preview-theme-scope min-h-screen bg-[#F8FAFC] flex items-center justify-center p-3 sm:p-6 relative overflow-hidden text-[#0F172A]">
      {/* Background ambient lighting */}
      <div className="absolute top-[-12%] left-[-12%] w-[48%] h-[48%] bg-[#105B38]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-14%] right-[-12%] w-[40%] h-[40%] bg-[#105B38]/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-lg bg-white border border-[#E2E8F0] shadow-xl shadow-[#105B38]/5 p-6 sm:p-10 rounded-[1.8rem] sm:rounded-[2.2rem] relative z-10">`;

const replaceReturn = `  return (
    <div className="preview-theme-scope min-h-screen bg-[#F8FAFC] flex items-center justify-center p-3 sm:p-6 relative overflow-hidden text-[#0F172A]">
      {/* Back to Home Button */}
      <div className="absolute top-6 left-6 z-20">
        <Link href="/preview">
          <a className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-[#E2E8F0] shadow-sm rounded-full text-xs font-bold text-[#105B38] hover:bg-white hover:shadow-md transition-all">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </a>
        </Link>
      </div>

      {/* Background ambient lighting */}
      <div className="absolute top-[-12%] left-[-12%] w-[48%] h-[48%] bg-[#105B38]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-14%] right-[-12%] w-[40%] h-[40%] bg-[#105B38]/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-lg bg-white border border-[#E2E8F0] shadow-xl shadow-[#105B38]/5 p-6 sm:p-10 rounded-[1.8rem] sm:rounded-[2.2rem] relative z-10">`;

code = code.replace(targetReturn, replaceReturn);

fs.writeFileSync(filePath, code);
