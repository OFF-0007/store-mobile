module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    overrides: [
      {
        test: /node_modules\/expo-file-system\/.*\.tsx?$/,
        plugins: [
          ["@babel/plugin-transform-typescript", { allowDeclareFields: true }],
        ],
      },
    ],
  };
};
