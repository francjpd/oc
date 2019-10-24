'use strict';

const fs = require('fs-extra');
const path = require('path');

const strings = require('../../../resources');

const replaceComponentPath = name => file =>
  file.replace(/__componentName__/g, name);
const isNotFile = possibleFile => !fs.statSync(possibleFile).isFile();

const applyFnToAllFiles = (dir, fn) => {
  const possibleFiles = fs.readdirSync(dir);
  possibleFiles.forEach(possibleFile => {
    if (isNotFile(path.join(dir, possibleFile))) {
      applyFnToAllFiles(path.join(dir, possibleFile), fn);
    } else {
      const fileModified = fn(
        fs.readFileSync(path.join(dir, possibleFile), 'UTF-8')
      );
      fs.writeFileSync(
        path.join(componentPath, dir, possibleFile),
        fileModified
      );
    }
  });
};

module.exports = function scaffold(options, callback) {
  const {
    compiler,
    compilerPath,
    componentName,
    componentPath,
    templateType
  } = options;

  const baseComponentPath = path.join(compilerPath, 'scaffold');
  const baseComponentFiles = path.join(baseComponentPath, 'src');
  const compilerPackage = fs.readJSONSync(
    path.join(compilerPath, 'package.json')
  );

  try {
    fs.copySync(baseComponentFiles, componentPath);

    const replaceWith = replaceComponentPath(componentName);
    applyFnToAllFiles(path.join(compilerPath, 'scaffold'), replaceWith);

    const componentPackage = fs.readJSONSync(
      path.join(componentPath, 'package.json')
    );
    componentPackage.name = componentName;
    componentPackage.devDependencies[compiler] = compilerPackage.version;
    fs.writeJsonSync(componentPath + '/package.json', componentPackage, {
      spaces: 2
    });

    return callback(null, { ok: true });
  } catch (error) {
    const url =
      (compilerPackage.bugs && compilerPackage.bugs.url) ||
      `the ${templateType} repo`;
    return callback(strings.errors.cli.scaffoldError(url, error));
  }
};
