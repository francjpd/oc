'use strict';

const async = require('async');
const colors = require('colors/safe');
const format = require('stringformat');
const path = require('path');
const read = require('read');
const _ = require('underscore');

const strings = require('../../resources/index');
const wrapCliCallback = require('../wrap-cli-callback');

module.exports = function(dependencies){

  let registry = dependencies.registry,
      local = dependencies.local,
      logger = dependencies.logger;

  const log = {
    err: function(msg){ return logger.log(colors.red(msg)); },
    ok: function(msg){ return logger.log(colors.green(msg)); },
    warn: function(msg){ return logger.log(colors.yellow(msg)); }
  };

  return function(opts, callback){

    let componentPath = opts.componentPath,
        packageDir = path.resolve(componentPath, '_package'),
        compressedPackagePath = path.resolve(componentPath, 'package.tar.gz'),
        errorMessage;

    callback = wrapCliCallback(callback);

    const getCredentials = function(cb){
      if(opts.username && opts.password){
        log.ok(strings.messages.cli.USING_CREDS);
        return cb(null, _.pick(opts, 'username', 'password'));
      }

      log.warn(strings.messages.cli.ENTER_USERNAME);

      read({}, function(err, username){
        log.warn(strings.messages.cli.ENTER_PASSWORD);

        read({ silent: true }, function(err, password){
          cb(null, { username: username, password: password});
        });
      });
    };

    const packageAndCompress = function(cb){
      log.warn(format(strings.messages.cli.PACKAGING, packageDir));
      const packageOptions = {
        componentPath: path.resolve(componentPath)
      };
      local.package(packageOptions, function(err, component){
        if(err){ return cb(err); }

        log.warn(format(strings.messages.cli.COMPRESSING, compressedPackagePath));

        local.compress(packageDir, compressedPackagePath, function(err){
          if(err){ return cb(err); }
          cb(null, component);
        });
      });
    };

    var putComponentToRegistry = function(options, cb){
      log.warn(format(strings.messages.cli.PUBLISHING, options.route));

      registry.putComponent(options, function(err){

        if(err){
          if(err === 'Unauthorized'){
            if(!!options.username || !!options.password){
              log.err(format(strings.errors.cli.PUBLISHING_FAIL, strings.errors.cli.INVALID_CREDENTIALS));
              return cb(err);
            }

            log.warn(strings.messages.cli.REGISTRY_CREDENTIALS_REQUIRED);

            return getCredentials(function(err, credentials){
              putComponentToRegistry(_.extend(options, credentials), cb);
            });

          } else if(err.code === 'cli_version_not_valid') {
            let upgradeCommand = format(strings.commands.cli.UPGRADE, err.details.suggestedVersion),
                errorDetails = format(strings.errors.cli.OC_CLI_VERSION_NEEDS_UPGRADE, colors.blue(upgradeCommand));

            errorMessage = format(strings.errors.cli.PUBLISHING_FAIL, errorDetails);
            log.err(errorMessage);
            return cb(errorMessage);
          } else if(err.code === 'node_version_not_valid') {
            const details = format(strings.errors.cli.NODE_CLI_VERSION_NEEDS_UPGRADE, err.details.suggestedVersion);

            errorMessage = format(strings.errors.cli.PUBLISHING_FAIL, details);
            log.err(errorMessage);
            return cb(errorMessage);
          } else {
            errorMessage = format(strings.errors.cli.PUBLISHING_FAIL, err);
            log.err(errorMessage);
            return cb(errorMessage);
          }
        } else {
          log.ok(format(strings.messages.cli.PUBLISHED, options.route));
          return cb(null, 'ok');
        }
      });
    };

    registry.get(function(err, registryLocations){
      if(err){ 
        log.err(err);
        return callback(err);
      }

      packageAndCompress(function(err, component){
        if(err){
          errorMessage = format(strings.errors.cli.PACKAGE_CREATION_FAIL, err);
          log.err(errorMessage);
          return callback(errorMessage);
        }

        async.eachSeries(registryLocations, function(registryUrl, next){
          let registryLength = registryUrl.length,
              registryNormalised = registryUrl.slice(registryLength - 1) === '/' ? registryUrl.slice(0, registryLength - 1) : registryUrl,
              componentRoute = format('{0}/{1}/{2}', registryNormalised, component.name, component.version);

          putComponentToRegistry({ route: componentRoute, path: compressedPackagePath}, next);
        }, function(err){
          local.cleanup(compressedPackagePath, function(err2, res){
            if(err){ return callback(err); }
            callback(err2, res);
          });
        });
      });
    });
  };
};
