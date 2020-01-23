"use babel";

import { CompositeDisposable } from "atom";
import { dirname } from "path";

const linterName = "linter-kondo";
let kondoExecutablePath;
let lintsOnChange;

export default {
  activate() {
    require("atom-package-deps").install("linter-kondo");

    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      atom.config.observe(`${linterName}.kondoExecutablePath`, value => {
        kondoExecutablePath = value;
      })
    );

    this.subscriptions.add(
      atom.config.observe(`${linterName}.lintsOnChange`, value => {
        lintsOnChange = value;
      })
    );
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  provideLinter() {
    const helpers = require("atom-linter");

    return {
      name: "linter-kondo",
      scope: "file", // or 'project'
      lintsOnChange: lintsOnChange,
      grammarScopes: ["source.clojure"],
      lint(textEditor) {
        const editorPath = textEditor.getPath();
        const editorText = textEditor.getText();
        const [extension] = editorPath.match(/\.\w+$/gi) || [];

        const args = ["--lang", extension.substr(1), "--lint", "-"];

        return helpers
          .exec(kondoExecutablePath, args, {
            cwd: dirname(editorPath),
            uniqueKey: linterName,
            stdin: editorText,
            stream: "both"
          })
          .then(function(data, err) {
            if (!data) {
              return null;
            }

            const { exitCode, stdout, stderr } = data;

            if (exitCode !== 0 && stdout) {
              const regex = /[^:]+:(\d+):(\d+): ([\s\S]+)/;

              const messages = stdout
                .split(/[\r\n]+/)
                .map(function(lint) {
                  const exec = regex.exec(lint);

                  if (!exec) {
                    return null;
                  }

                  const line = Number(exec[1]);
                  const excerpt = exec[3];

                  return {
                    severity: excerpt.startsWith("warning:")
                      ? "warning"
                      : "error",
                    location: {
                      file: editorPath,
                      position: helpers.generateRange(textEditor, line - 1)
                    },
                    excerpt: `${excerpt}`
                  };
                })
                .filter(m => m); // filter out null messages

              return messages;
            }

            return [];
          });
      }
    };
  }
};
