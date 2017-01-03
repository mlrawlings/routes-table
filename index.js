var fs = require('fs');
var path = require('path');
var byKey = require('by-key');
var sortRoutes = require('sort-routes');

exports.build = function(dir, options, cb) {
    if(!cb && typeof options == 'function') {
        cb = options;
        options = {};
    }

    options = options || {};

    var routes = [];
    var promise = new Promise((resolve, reject) => {
        fs.readdir(dir, (err, pages) => {
            if(err) return reject(err);
            pages.forEach(pageName => {
                var requirePath = path.join(dir, pageName);
                try {
                    var page = require(requirePath);
                    var handler = page.handler;
                    var metadata = page.metadata;
                    var params = page.params || [];
                    var routePath = page.route || page.routes || '/' + pageName;
                    var route = Object.assign({ path:routePath, params, handler, __dirname:requirePath }, metadata);

                    if(options.onRoute) {
                        route = options.onRoute(page, requirePath, route);
                    }

                    if(route && typeof route.handler === 'function') {
                        if(route.path === '/index') {
                            routes.push(Object.assign({}, route, { path:'/' }));
                        }

                        if(Array.isArray(route.path)) {
                            route.path.forEach(path => {
                                routes.push(Object.assign({}, route, { path }));
                            });
                        } else {
                            routes.push(route);
                        }
                    }
                } catch(e) {
                    if(e.code !== 'MODULE_NOT_FOUND') {
                        throw e;
                    }
                }
            })

            resolve(routes.sort(byKey('path', sortRoutes)));
        });
    })

    if(cb) {
        promise.then(r => cb(null, r), e => cb(e));
    }

    return promise;
}