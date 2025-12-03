const fs = require('fs');
const path = 'app/renderer/src/pages/Deploy.tsx';
const s = fs.readFileSync(path, 'utf8').split('\n');
let stack = [];
for (let i = 0; i < s.length; i++) {
    const line = s[i];
    // Count opening <div but ignore self-closing <div /> occurrences
    const rawOpens = (line.match(/<div\b/g) || []).length;
    const selfClosing = (line.match(/<div\b[^>]*\/\>/g) || []).length;
    const opens = Math.max(0, rawOpens - selfClosing);
    const closes = (line.match(/<\/div>/g) || []).length;
    for (let k = 0; k < opens; k++) stack.push({ line: i + 1, text: line.trim().slice(0, 120) });
    for (let k = 0; k < closes; k++) stack.pop();
}
console.log('unclosed <div> count:', stack.length);
if (stack.length) console.log('unclosed at lines:', stack.map(x => x.line).join(', '));
