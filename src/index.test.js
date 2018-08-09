const { fork } = require("child_process");
const { resolve } = require("path");

const debug = require("debug")(`realm-js-test/test`);

function forkProcess(prefix) {
  const p = fork(resolve(__dirname, `process-${prefix}.js`), [ prefix ]);
  p.on('close', (code) => {
    debug(`Child process ${prefix} exited with code ${code}`);
  });
  return p;
}

describe("Realm JS opening the same RealmFile", () => {
  let processA;
  let processB;

  afterEach(() => {
    if (processA) {
      processA.kill();
    }
    if (processB) {
      processB.kill();
    }
  });

  it("opens and writes twice", (done) => {
    processA = forkProcess("a");
    processB = forkProcess("b");

    processA.on("message", (msg) => {
      if (msg === "realm opened") {
        // When process A has opened the Realm, we'll ask B to do the same
        processB.send("open realm");
      } else if (msg === "written something") {
        // When process B has opened the Realm, we'll ask A to write
        processA.send("write something else");
      } else if (msg === "written something else") {
        done();
      } else {
        throw new Error(`Unexpected message from A: ${msg}`);
      }
    });

    processB.on("message", (msg) => {
      if (msg === "realm opened") {
        // When process A has opened the Realm, we'll ask B to do the same
        processA.send("write something");
      } else {
        throw new Error(`Unexpected message from A: ${msg}`);
      }
    });

    debug("Sending 'open realm'");
    // Ask process A to open the realm
    processA.send("open realm");
  });
});
