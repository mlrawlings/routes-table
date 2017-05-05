var fs = require('fs');
var path = require('path');
var byKey = require('by-key');
var sortRoutes = require('sort-routes');
var validRouteKeys = {
    path:1,
    paths:1,
    params:1,
    handler:1,
    metadata:1,
    __dirname:1
};

function isDotFile(routeName) {
    return (/(^|\/)\.[^\/\.]/g).test(routeName);
}

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

            routeNames.map(routeName => {
                var routeDir = path.join(dir, routeName);
                addRoutes(routeName, routeDir, options, routes, (err) => {
                    if (error) return;
                    else if (error = err) cb(err);
                    else if (!--remaining) cb(err, normalize(routes));
                });
            });
        });
    }
}

function addRoutes(routeName, routeDir, options, routes, cb) {
    var subroutesDir = path.join(routeDir, 'routes');

    fs.stat(subroutesDir, (err, stat) => {
        if(!err && stat.isDirectory()) {
            var subroutesOptions = Object.assign({}, options, { path:options.path+'/'+routeName });
            return build(subroutesDir, subroutesOptions, (err, subroutes) => {
                if(err) return cb(err);

                routes.push(subroutes);
                cb();
            })
        } else {
            try {
                // We should ignore dotfiles
                if (isDotFile(routeName)) return cb();
                routes.push(buildRoute(routeDir, routeName, options));
                cb();
            } catch(e) {
                cb(e);
            }
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

    if(options.onRoute) {
        route = options.onRoute(route) || route;
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
    } else {
        throw new Error('All routes under a routes/ directory must export an handler function!\nAt: '+routeDir);
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
