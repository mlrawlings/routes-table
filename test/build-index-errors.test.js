const fs = require('fs');
const path = require('path');
const build = require('../').build;
const isDotFile = require('../util/isDotFile');

const GIT_DOTFILE = '.file';

describe.only('build-index-errors', () => {
  let structuresDir = path.join(__dirname, 'build-index-errors');
  let files = fs.readdirSync(structuresDir);
  let dotFilePaths = [];

  function removeDotFiles (dirPath) {
    try {
      var files = fs.readdirSync(dirPath);
    } catch(e) {
      return;
    }

    if (files.length > 0) {
      for (var i = 0; i < files.length; i++) {
        var filePath = dirPath + '/' + files[i];
        if (fs.statSync(filePath).isFile() && filePath.endsWith(GIT_DOTFILE)) {
          dotFilePaths.push(filePath);
          fs.unlinkSync(filePath);
        } else {
          removeDotFiles(filePath);
        }
      }
    }
  }

  beforeAll(() => {
    // Find all dotfiles and remove them
    files.forEach((structureName) => {
      let structureDir = path.join(structuresDir, structureName);
      removeDotFiles(structureDir);
    });
  });

  afterAll(() => {
    // Add back the dotfiles
    dotFilePaths.forEach((dotFilePath) => {
      fs.closeSync(fs.openSync(dotFilePath, 'w'));
    });
  });

  files.forEach(structureName => {
    it(structureName, async () => {
      let error;
      let structureDir = path.join(structuresDir, structureName);

      try {
        await build(structureDir, { index: true });
      } catch(e) {
        error = e;
      }

      if (!error) throw new Error('Expected Error');
      expect(error).toMatchSnapshot();
    });
  });
});
