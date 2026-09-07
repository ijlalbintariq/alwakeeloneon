import fs from 'fs';

let content = fs.readFileSync('client/src/experimental/components/judgments/PrecedentGraph.tsx', 'utf8');

const oldSvgStr = `            {/* SVG Network Graph Visualization */}
            <svg
              className="w-full h-full transition-transform duration-100"
              style={{
                transform: \`scale(\${zoomLevel}) translate(\${panOffset.x}px, \${panOffset.y}px)\`,
                transformOrigin: "center center",
              }}
              viewBox="0 0 800 360"
            >
              {/* Center Anchor Node: Current Judgment */}
              <g transform="translate(400, 180)">`;

const newSvgStr = `            {/* SVG Network Graph Visualization */}
            {(() => {
              const maxNodes = Math.max(5, filteredMade.length, filteredReceived.length);
              const svgHeight = Math.max(360, maxNodes * 56 + 100);
              const centerY = svgHeight / 2;
              return (
            <svg
              className="w-full h-full transition-transform duration-100"
              style={{
                transform: \`scale(\${zoomLevel}) translate(\${panOffset.x}px, \${panOffset.y}px)\`,
                transformOrigin: "center center",
              }}
              viewBox={\`0 0 800 \${svgHeight}\`}
            >
              {/* Center Anchor Node: Current Judgment */}
              <g transform={\`translate(400, \${centerY})\`}>`;

const oldPath1Str = `                      {/* Connection Line */}
                      <path
                        d={\`M 352 180 C 260 180, 240 \${y}, \${x + 65} \${y}\`}`;

const newPath1Str = `                      {/* Connection Line */}
                      <path
                        d={\`M 352 \${centerY} C 260 \${centerY}, 240 \${y}, \${x + 65} \${y}\`}`;

const oldPath2Str = `                      {/* Connection Line */}
                      <path
                        d={\`M 448 180 C 540 180, 560 \${y}, \${x - 65} \${y}\`}`;

const newPath2Str = `                      {/* Connection Line */}
                      <path
                        d={\`M 448 \${centerY} C 540 \${centerY}, 560 \${y}, \${x - 65} \${y}\`}`;


let updated = content.replace(oldSvgStr, newSvgStr);
updated = updated.replace(oldPath1Str, newPath1Str);
updated = updated.replace(oldPath2Str, newPath2Str);

updated = updated.replace('filteredMade.slice(0, 5).map', 'filteredMade.map');
updated = updated.replace('filteredReceived.slice(0, 5).map', 'filteredReceived.map');
updated = updated.replace('const y = 70 + idx * 56;', 'const y = (centerY - (filteredMade.length * 56) / 2) + 28 + idx * 56;');
updated = updated.replace('const y = 70 + idx * 56;', 'const y = (centerY - (filteredReceived.length * 56) / 2) + 28 + idx * 56;');

updated = updated.replace(`            </svg>

            {/* Quick Helper Label */}`, `            </svg>
              );
            })()}

            {/* Quick Helper Label */}`);

fs.writeFileSync('client/src/experimental/components/judgments/PrecedentGraph.tsx', updated);
console.log(content.length, '->', updated.length);
