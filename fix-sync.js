const fs = require('fs');
let code = fs.readFileSync('./sync.js', 'utf8');
code = code.replace(/await db\.\$transaction\(([\w]+)\);/g, 'await db.$transaction($1, { maxWait: 10000, timeout: 60000 });');
code = code.replace(/await db\.\$transaction\(\[([\s\S]*?)\]\);/g, 'await db.$transaction([$1], { maxWait: 10000, timeout: 60000 });');
if (!code.includes('m_department: true')) {
  code = code.replace(/m_organization: true,/g, 'm_department: true,\n      m_organization: true,');
}
fs.writeFileSync('./sync.js', code);
console.log('Fixed sync.js');
