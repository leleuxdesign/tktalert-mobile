module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./",
          },
        },
      ],
      // Reanimated v4 (SDK 54): the worklets Babel transform moved out of
      // react-native-reanimated into react-native-worklets.
      "react-native-worklets/plugin",
    ],
  };
};
