# Apollo GraphQL for Visual Studio Code

[![GitHub license](https://img.shields.io/badge/license-MIT-lightgrey.svg?maxAge=2592000)](https://raw.githubusercontent.com/apollographql/vscode-graphql/master/LICENSE)

The README and project structure have been adapted from this [Language Server sample app](https://github.com/Microsoft/vscode-extension-samples/tree/master/lsp-sample).

Also see:
* https://code.visualstudio.com/docs/extensions/example-language-server
* https://code.visualstudio.com/docs/extensionAPI/language-support
* https://github.com/Microsoft/vscode-languageserver-node

The extension requires a `.graphqlconfig` file, and has only been tested with `.graphql` files.

The code for the extension is in the 'client' folder. It uses the 'vscode-languageclient' node module to launch the language server.

The language server is located in the 'server' folder.

# How to run locally
* `npm install` to initialize the extension and the server
* `npm run compile` to compile the extension and the server
* open this folder in VS Code. In the Debug viewlet, run 'Launch Client' from drop-down to launch the extension and attach to the extension.
* to debug the server use the 'Attach to Server' launch config.
* set breakpoints in the client or the server.