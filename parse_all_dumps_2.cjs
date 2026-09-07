const fs = require('fs');

const fileList = [
"/Users/macbook/.gemini/antigravity/brain/e96b54c6-d394-49e9-8255-db8ae3a2bc76/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/a72f367d-8e35-4029-a639-898cbec44a24/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/31b8c0e0-fa7e-48b0-b0d3-ea3b998b4d31/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/06073929-442b-40ff-8063-fc56b2a8f188/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/a044ac3c-33d9-474c-8781-79e129fcfa0c/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/aa7ae19e-7886-4df8-b545-cee4dc8a65dd/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/70628666-82f5-4632-81bd-6a12b75d6c3b/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/91e4ea42-c405-4d42-856c-cb1d658aa4f8/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/19c49ae4-1890-4c1e-ba9f-fbe9ddf26d01/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/0865a663-1326-4eaf-8a70-8a0105d8bd23/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/450f61ea-1005-45b0-8507-6788ae264691/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/c6c4e60b-344a-4cc9-8b47-a1f61bc635b6/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/3dc0769e-b86e-4219-a628-cc44da73f2ef/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/08a530cd-07d4-4837-97c9-900ff29b6932/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/4cf04743-cfc7-4f28-bfe9-40698bd7fa81/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/7f0912b1-d20e-451a-a3b6-0cd01b07a247/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/d7a09d5e-023f-4a06-a09e-5760d0dc6e0c/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/ea52b412-8406-4664-8200-e30b3dfe7029/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/4326c187-17b9-4c3e-92c9-c6b24feb79d9/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/f37e6e06-9d09-471e-9660-570a7fd9dedc/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/1b182b85-d8c6-4a91-8624-e9b3d6aceecd/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/1395328b-c8b5-429d-b007-2070c522fb8e/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/bfc77985-6b2c-4777-bc3e-83603723cf67/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/a02735c8-136f-4109-8dd2-78319f771872/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/b11daed1-264e-40d4-9592-4e8a2a5ecc3d/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/3328e55b-b952-4a17-955b-1e6c4e6930e4/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/44460e4e-9553-46e2-b2f5-4d213148937f/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/c7d8057c-2053-498e-91b0-7b1499edc174/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/119fd6d7-0733-4a84-aa0e-cda94e79febe/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/84fa857a-291b-4b64-af4b-473f206e73f3/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/6d857c7a-3656-490b-a762-12d5b1dc99b0/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/df9304be-fdf6-48c3-8f5c-a99ab893a370/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/1b236e3e-83e5-45fa-a5ff-75b6e19c3fce/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/e46ad3a1-2cdc-4cde-99b1-e8b02386f1f4/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/8110e90b-166f-41d8-9b0b-aa48fef4e14d/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/82d4af37-1e20-4c2b-8bcd-88920c988e4d/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/467e9499-02b9-4788-94c0-d1a3d83bab90/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/2697108d-b941-43b1-909b-47943004a635/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/a664db4e-9974-4d46-8fa4-99d4d4dbc0e9/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/55595047-4b85-4cf3-9092-c2da7c8f4d77/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/426e5052-6135-41cf-8446-a462b81b7019/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/87d489b3-2ca8-4f3f-a081-2eaf7b70c982/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/662ec94a-abc7-4be3-b8d5-0c0028b5e212/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/b701f0e2-41cc-4ea2-90ff-280d836c22fa/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/efe4c346-333a-42e1-a3a4-9c262f5798a0/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/54184e06-e70a-4adc-9659-9677d1bc55b9/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/9d7ad9cb-e14c-48cf-96ee-f6f6f65e7571/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/c2f9d49c-a713-4fa1-b4df-68d902a263e9/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/c0048107-1b37-4758-955d-2617475e09da/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/5b5750bd-cf9b-432d-949a-32391b38029a/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/ffaf41b1-f16d-4471-bfca-5842ece2fe53/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/270dd529-e12f-46a2-88df-ed828a5bc38e/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/c4319a4c-8db4-422d-8031-13aaf5e55dc5/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/75244a71-e2a8-4f44-af27-052cc19cafb5/.system_generated/logs/transcript_full.jsonl",
"/Users/macbook/.gemini/antigravity/brain/a02012f5-d4de-4233-84f2-82be8b0df1c1/.system_generated/logs/transcript_full.jsonl"
];

let bestContent = null;
let maxTimestamp = 0;

for (const file of fileList) {
  if (!fs.existsSync(file)) continue;
  
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].trim()) continue;
    try {
      const obj = JSON.parse(lines[i]);
      if (obj.tool_calls) {
        for (const call of obj.tool_calls) {
          if (call.name === 'write_to_file' && call.arguments && call.arguments.TargetFile && call.arguments.TargetFile.includes('PreviewLanding.tsx')) {
             if (call.arguments.CodeContent.length > 500 && !call.arguments.CodeContent.includes('const expPath = ')) {
               const ts = new Date(obj.created_at).getTime();
               if (ts > maxTimestamp) {
                 maxTimestamp = ts;
                 bestContent = call.arguments.CodeContent;
               }
             }
          }
          if (call.name === 'run_command' && call.arguments && call.arguments.CommandLine && call.arguments.CommandLine.includes('PreviewLanding.tsx')) {
             if (call.arguments.CommandLine.includes('EOF')) {
               const match = call.arguments.CommandLine.match(/cat << ['"]?EOF['"]? > .*PreviewLanding\.tsx\n([\s\S]*?)\nEOF/);
               if (match && match[1].length > 500 && !match[1].includes('const expPath = ')) {
                 const ts = new Date(obj.created_at).getTime();
                 if (ts > maxTimestamp) {
                   maxTimestamp = ts;
                   bestContent = match[1];
                 }
               }
             }
          }
        }
      }
    } catch (e) {}
  }
}

if (bestContent) {
  fs.writeFileSync('client/src/experimental/pages/PreviewLanding.tsx', bestContent);
  console.log("SUCCESS");
} else {
  console.log("NOT FOUND");
}
