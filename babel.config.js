module.exports = {
  presets: [['miaoda-expo-devkit/babel-preset', { excludePaths: ['src/components/ui'] }]],
  plugins: ['@babel/plugin-transform-react-jsx'],
};
