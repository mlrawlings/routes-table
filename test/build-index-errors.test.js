const fs = require('fs');
const path = require('path');
const build = require('../').build;

describe('build-index-errors', () => {
  let structuresDir = path.join(__dirname, 'build-index-errors');
  fs.readdirSync(structuresDir).forEach(structureName => {
    it(structureName, async () => {
      let error;
      let structureDir = path.join(structuresDir, structureName);
      try {
        await build(structureDir, { index:true });
      } catch(e) {
        error = e;
      }

      if (!error) throw new Error('Expected Error');
      expect(error).toMatchSnapshot();
    });
  });
});
