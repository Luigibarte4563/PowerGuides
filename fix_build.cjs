const fs = require('fs');
const path = 'src/pages/Dashboard/Outages.jsx';
const c = fs.readFileSync(path, 'utf8');
const lines = c.split('\n');

// Find the line with '  return (' and insert modal variable BEFORE it
let insertIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '  return (') {
    insertIdx = i;
    break;
  }
}

if (insertIdx >= 0) {
  // Insert the modal variable BEFORE the return
  const modalVar = '  const _editorModal = editor ? <OutageFormModal key={editor.outage?.id ?? "new"} open onClose={() => setEditor(null)} onResult={(result) => setFeedback(result)} /> : null;';
  lines.splice(insertIdx, 0, modalVar);
}

// Now replace {editor ? ( with {_editorModal} in the return section
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{editor ? (') && lines[i].includes('OutageFormModal')) {
    lines[i] = lines[i].replace('{editor ? (', '{_editorModal}');
  }
}

fs.writeFileSync(path, lines.join('\n'));
console.log('Fixed build, inserted modal var at line', insertIdx + 1, 'and replaced ternaries');