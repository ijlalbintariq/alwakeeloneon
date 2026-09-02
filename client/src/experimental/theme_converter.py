import re
import os

files = [
    "/Users/macbook/Downloads/Alwakeelo/client/src/experimental/pages/PreviewDrafting.tsx",
    "/Users/macbook/Downloads/Alwakeelo/client/src/experimental/components/dashboard/ExecutiveHeader.tsx",
    "/Users/macbook/Downloads/Alwakeelo/client/src/experimental/pages/PreviewDashboard.tsx"
]

mapping = [
    (r'#181816', r'#FFFFFF'),
    (r'#222220', r'#FFFFFF'),
    (r'#2A2A27', r'#F5F4F2'),
    (r'#252523', r'#F5F4F2'),
    (r'#32312D', r'#E5E4E2'),
    (r'#3A3935', r'#E5E4E2'),
    (r'#3E3C38', r'#D9D8D6'),
    (r'#EDECE8', r'#1A1A1A'),
    (r'#C8C6C0', r'#4A4A4A'),
    (r'#9E9C96', r'#666666'),
    (r'#78756F', r'#999999'),
    (r'#DA6D42', r'#DA7756'),
    (r'#CC5A36', r'#C4603A'),
    (r'#1E1E1C', r'#F5F5F5'),
    (r'bg-black/70', r'bg-black/30'),
    (r'bg-black/60', r'bg-black/20'),
    (r'bg-slate-950', r'bg-white'),
    (r'bg-slate-900', r'bg-[#F5F4F2]'),
    (r'bg-slate-800', r'bg-[#E5E4E2]'),
    (r'border-slate-800', r'border-[#E5E4E2]'),
    (r'text-slate-400', r'text-[#666666]'),
    (r'text-slate-300', r'text-[#4A4A4A]'),
    (r'text-slate-600', r'text-[#999999]'),
    (r'text-slate-500', r'text-[#666666]'),
    (r'text-slate-200', r'text-[#1A1A1A]'),
    (r'text-slate-100', r'text-[#1A1A1A]'),
    (r'text-amber-300', r'text-[#DA7756]'),
    (r'text-amber-400', r'text-[#DA7756]'),
    (r'bg-blue-600', r'bg-white'),
    (r'border-blue-500', r'border-[#E5E4E2]'),
    (r'text-white', r'text-[#1A1A1A]'),
    (r'bg-amber-500/20', r'bg-[#DA7756]/10'),
    (r'border-amber-500/30', r'border-[#DA7756]/20'),
]

button_mapping = [
    (r'text-\[\#1A1A1A\] border-\[\#C4603A\]', r'text-white border-[#C4603A]'), 
    (r'bg-\[\#DA7756\] text-\[\#1A1A1A\]', r'bg-[#DA7756] text-white'), 
]

for fpath in files:
    if not os.path.exists(fpath):
        print(f"File not found: {fpath}")
        continue
    with open(fpath, "r") as f:
        content = f.read()
    
    for old, new in mapping:
        content = re.sub(old, new, content)
        
    for old, new in button_mapping:
        content = re.sub(old, new, content)

    if "PreviewDrafting.tsx" in fpath:
        content = content.replace('hover:text-white', 'hover:text-[#1A1A1A]')
        content = content.replace('hover:text-rose-400', 'hover:text-rose-600')
        content = content.replace('text-emerald-400', 'text-emerald-600')
        
    with open(fpath, "w") as f:
        f.write(content)
    print(f"Processed {fpath}")
