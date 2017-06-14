module.exports = function isDotFile(routeName) {
  return (/(^|\/)\.[^\/\.]/g).test(routeName);
}
