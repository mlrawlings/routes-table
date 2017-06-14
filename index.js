'use strict';

const fs = require('fs');
const path = require('path');
const byKey = require('by-key');
const sortRoutes = require('sort-routes');
const isDotFile = require('./util/isDotFile');

var validRouteKeys = {
    path:1,
    paths:1,
    params:1,
    handler:1,
    metadata:1,
    subRoutesExist:1,
    __dirname:1
};

exports.build = function(dir, options, cb) {
    if(!cb && typeof options == 'function') {
        cb = options;
        options = {};
    }

    var promise = new Promise((resolve, reject) => {
        build(dir, options, (err, routes) => {
            if (err) reject(err);
            else resolve(routes);
        });
    });

    if(cb) {
        promise.then(r => cb(null, r), e => cb(e));
    }

    return promise;
}

function build(dir, options, cb) {
    options = options || {};
    options.path = options.path || '';

    var routes = [];

    if (options.index) {
        delete options.index;
        addRoutes('', dir, options, routes, (err) => {
            cb(err, normalize(routes));
        });
    } else {
        fs.readdir(dir, (err, routeNames) => {
            if(err) return cb(err);

            var remaining = routeNames.length;
            var error;

            if (!remaining) {
                return cb(new Error('Empty `routes/` directory at ' + path.relative(process.cwd(), dir)));
            }

            routeNames.map(routeName => {
                var routeDir = path.join(dir, routeName);
                addRoutes(routeName, routeDir, options, routes, (err) => {
                    if (error) return;
                    else if (error = err) cb(err);
                    else if (!--remaining) cb(err, normalize(routes))
                });
            });
        });
    }
}

function addRoutes(routeName, routeDir, options, routes, cb) {
    var route;
    var subroutesDir = path.join(routeDir, 'routes');

    fs.stat(subroutesDir, (err, stat) => {
        let isDirectory = false;

        if (!err) {
          isDirectory = stat.isDirectory();
        }

        // We should ignore dotfiles
        if (!isDotFile(routeName)) {
          try {
            options.subRoutesExist = isDirectory;
            route = buildRoute(routeDir, routeName, options);
            if (route) {
              routes.push(route);
            }
          } catch (e) {
            // Failed to build route
            throw e;
          }
        }

        if(!err && isDirectory) {
            var subroutesOptions = Object.assign({}, options, { path:options.path+(routeName ? '/'+routeName : '') });
            return build(subroutesDir, subroutesOptions, (err, subroutes) => {
                if(err) return cb(err);

                routes.push(subroutes);
                cb();
            });
        } else if(!route) {
          cb(new Error('Expected a `route.js`, template, or `routes/` directory at '+path.relative(process.cwd(), routeDir)));
        } else {
            cb();
        }
    });
}

function buildSync(dir, options) {
    options = options || {};
    options.path = options.path || '';

    var routes = fs.readdirSync(dir).map(routeName => {
        var routeDir = path.join(dir, routeName);
        var subroutesDir = path.join(routeDir, 'routes');

        if(isDirectorySync(subroutesDir)) {
            var subroutesOptions = Object.assign({}, options, { path:options.path+'/'+routeName });
            return buildSync(subroutesDir, subroutesOptions);
        }

        return buildRoute(routeDir, routeName, options);
    });

    return normalize(routes);
}

function buildRoute(routeDir, routeName, options) {
    var requirePath = path.join(routeDir, 'route.js');
    var route = tryRequire(requirePath);

    route.path = route.path || route.paths || '/' + (routeName === 'index' ? '' : routeName);
    route.params = route.params || [];
    route.__dirname = routeDir;
    route.subRoutesExist = options.subRoutesExist;

    if (options.onRoute) {
        let onRouteResult = options.onRoute(route);

        if (onRouteResult === false) {
          return false;
        } else {
          route = onRouteResult || route;
        }
    }

    if (!route) {
      return;
    }

    Object.keys(route).forEach(key => {
        if(!validRouteKeys[key]) {
            throw new Error(
                'Unexpected property exported from route: ' + key +
                '\nAt: ' + routeDir
            );
        }
    });

    if(typeof route.handler === 'function') {
        if(Array.isArray(route.path)) {
            return route.path.map(path => Object.assign({}, route, { path:options.path+path }));
        } else {
            route.path = options.path + route.path;
            return route;
        }
    }
}

function normalize(routes) {
    return flatten(routes).sort(byKey('path', sortRoutes));
}

function flatten(array) {
    for(var i = 0; i < array.length; i++) {
        if(Array.isArray(array[i])) {
            array.splice.apply(array, [i, 1].concat(array[i]));
            i--;
        }
    }
    return array;
}

function isDirectorySync(path) {
    try {
        return fs.statSync(path).isDirectory();
    } catch(e) {
        return false;
    }
}

function tryRequire(requirePath) {
    try {
        return require(requirePath);
    } catch(e) {
        if(e.code !== 'MODULE_NOT_FOUND' || !e.message.includes(requirePath)) {
            throw e;
        }
        return {};
    }
}
