// node read-client.js
const fs   = require('fs');
const path = require('path');
const pkgDir = path.join(__dirname, 'node_modules', 'encar', 'dist');

// client.js болон config.js бүрэн уншина
['config.js', 'client.js', 'index.js'].forEach(file => {
  const full = path.join(pkgDir, file);
  if (!fs.existsSync(full)) return;
  console.log('\n' + '═'.repeat(60));
  console.log('📄 FILE:', file);
  console.log('═'.repeat(60));
  console.log(fs.readFileSync(full, 'utf8'));
});