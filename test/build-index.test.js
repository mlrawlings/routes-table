const fs = require('fs');
const path = require('path');
const build = require('../').build;

describe('build-index', () => {
  let structuresDir = path.join(__dirname, 'build-index');
  fs.readdirSync(structuresDir).forEach(structureName => {
    it(structureName, async () => {
      let structureDir = path.join(structuresDir, structureName);

      let results = await build(structureDir, { index:true });
      results.forEach(result => {
        result.__dirname = path.relative(structuresDir, result.__dirname);
      });
      expect(results).toMatchSnapshot();
    });
  });
});
