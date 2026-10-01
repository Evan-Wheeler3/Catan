// Expo's default Metro config already supports npm workspaces (the shared engine).
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
