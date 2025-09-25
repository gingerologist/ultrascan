const archiver = require('archiver');
const fs = require('fs');

const filename = (() => {
  const date = new Date();

  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `../ultrascan-src-${year}${month}${day}-${hours}${minutes}.zip`;
})();

console.log(`archive file: ${filename}`);

const output = fs.createWriteStream(filename);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.pipe(output);

// Add files with exclusions
archive.glob('**/*', {
  dot: true,
  ignore: ['node_modules/**', '.webpack/**', 'out/**'],
});

archive.finalize();
