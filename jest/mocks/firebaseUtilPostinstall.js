// @firebase/util's ESM build imports this file to detect a Node postinstall
// step that only applies outside React Native. It isn't part of Firebase's
// public API, and Jest's resolver can't parse its real .mjs source, so we
// stub it to a no-op for tests only — Metro resolves the real file fine at
// app runtime, this mock never ships in the app bundle.
module.exports = {
  getDefaultsFromPostinstall: () => undefined,
};
