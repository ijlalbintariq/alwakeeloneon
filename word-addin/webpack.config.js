const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const devCerts = require("office-addin-dev-certs");

module.exports = async (env, options) => {
  const dev = options.mode === "development";
  const optionsHttps = env.WEBPACK_BUILD || !dev ? false : await devCerts.getHttpsServerOptions();

  return {
    entry: {
      taskpane: "./src/taskpane/index.tsx",
      commands: "./src/commands/commands.ts"
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].bundle.js"
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"]
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"]
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/taskpane.html",
        chunks: ["taskpane"]
      }),
      new HtmlWebpackPlugin({
        filename: "commands.html",
        template: "./src/commands/commands.html",
        chunks: ["commands"]
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "assets",
            to: "assets"
          }
        ]
      })
    ],
    devServer: {
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      server: {
        type: "https",
        options: env.WEBPACK_BUILD || !dev ? {} : optionsHttps,
      },
      port: 3000,
      hot: true,
      proxy: [
        {
          context: ["/api"],
          target: "http://localhost:5001",
          changeOrigin: true,
          secure: false
        }
      ]
    }
  };
};
