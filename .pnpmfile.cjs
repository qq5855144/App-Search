function readPackage(pkg, context) {
  let blockedPackages = [];
  try {
    const config = require(require.resolve('miaoda-expo-devkit/pnpm-config.json'));
    blockedPackages = config.blockedPackages ?? [];
  } catch {}

  const blocked = blockedPackages.find(b => b.name === pkg.name);
  if (blocked) {
    context.log(`Blocked installation of ${pkg.name}`);
    throw new Error(`Restricted: ${blocked.reason}`);
  }

  return pkg;
}

module.exports = {
  hooks: {
    readPackage
  }
};
