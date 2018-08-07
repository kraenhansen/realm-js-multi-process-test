const { fork } = require("child_process");
const { resolve } = require("path");
const { expect } = require("chai");
const debug = require("debug")(`realm-js-test/harness`);

const RUNNER_PATH = resolve(__dirname, "runner.js");

function spawnRunner(prefix) {
  const runner = fork(RUNNER_PATH, [ prefix ]);
  runner.on('close', (code) => {
    debug(`Child process ${prefix} exited with code ${code}`);
  });
  return runner;
}

describe("Realm JS running in two processes", () => {
  let processA;
  let processB;

  beforeEach(() => {
    processA = spawnRunner("A");
    processB = spawnRunner("B");
  });

  afterEach(() => {
    if (processA) {
      processA.kill();
    }
    if (processB) {
      processB.kill();
    }
  });

  it("can open, read, write and observe changes", (done) => {
    let processAChangeCount = 0;
    let processBChangeCount = 0;
    let pongCount = 0;

    function checkPongs(who) {
      if (pongCount === 2) {
        // Now that process A has also changed the person, lets count how many times its changed
        // Its actually strange that this has to be 3 and not 2 ...
        expect(processAChangeCount).to.equal(3);
        expect(processBChangeCount).to.equal(3);
        // All done ...
        done();
      }
    }
    // Listen for message from process A
    processA.on("message", (data) => {
      debug(`Received status from A: ${data.status}`);
      if (data.status === "realm-opened") {
        // Once process A has opened the Realm, ask process B to do the same
        processB.send({ action: "open-realm" });
      } else if (data.status === "person-created") {
        // Once process A has created a Person, ask process B to change it
        processB.send({ action: "change-person", uuid: data.uuid });
      } else if (data.status === "person-changed") {
        // Wait for process B to respond to the change
        setTimeout(() => {
          // Ensure that both processes are not blocking
          processA.send({ action: "ping" });
          processB.send({ action: "ping" });
        }, 1000);
      } else if (data.status === "realm-changed") {
        processAChangeCount++;
      } else if (data.status === "pong") {
        pongCount++;
        checkPongs("A");
      } else {
        const err = new Error(`Unexpected status ${data.status}`);
        done(err);
      }
    });
    // Listen for message from process B
    processB.on("message", (data) => {
      debug(`Received status from B: ${data.status}`);
      if (data.status === "realm-opened") {
        // Once process B has opened the Realm, ask process A to create an object
        processA.send({ action: "create-person" });
      } else if (data.status === "person-changed") {
        // Once process B has changed the Person, ask process A to change it too
        processA.send({ action: "change-person", uuid: data.uuid });
      } else if (data.status === "realm-changed") {
        processBChangeCount++;
      } else if (data.status === "pong") {
        pongCount++;
        checkPongs("B");
      } else {
        const err = new Error(`Unexpected status ${data.status}`);
        done(err);
      }
    });
    // Let the games begin
    processA.send({ action: "open-realm" });
  });
});
