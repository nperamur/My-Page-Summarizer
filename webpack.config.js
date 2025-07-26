const path = require('path');

module.exports = {
  entry: {
    firebasehandler: './firebasehandler.js',
    popup: './popup.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      }
    ]
  },
  mode: 'production'
};
