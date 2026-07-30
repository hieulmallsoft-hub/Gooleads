const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

function findSpecs(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findSpecs(path);
    return entry.name.endsWith('.spec.js') ? [path] : [];
  });
}

const root = process.argv[2];
const specs = findSpecs(root);
if (!specs.length) {
  console.error(`No compiled specs found under ${root}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...specs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_PATH: [join(process.cwd(), 'node_modules'), process.env.NODE_PATH]
      .filter(Boolean)
      .join(';'),
  },
});
process.exit(result.status ?? 1);
