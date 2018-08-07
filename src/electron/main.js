const { expect } = require("chai");
const { app, BrowserWindow, ipcMain } = require("electron");
const { resolve } = require("path");
const debug = require("debug")(`realm-js-test/main`);

const RENDERER_PATH = resolve(__dirname, "renderer.html");

let windows = {};

function createWindow(prefix) {
  const window = new BrowserWindow({ show: false });
  window.loadURL(`file://${RENDERER_PATH}`);
  windows[prefix] = window;
  return window;
}

let processAChangeCount = 0;
let processBChangeCount = 0;
let pongCount = 0;

function done(err) {
  if (err) {
    console.error(err.stack);
    app.quit(1);
  } else {
    console.log("Great success!");
    // Allow the test harness to close the window
  }
}

function checkPongs(who) {
  if (pongCount === 2) {
    // Now that process A has also changed the person, lets count how many times its changed
    // Its actually strange that this has to be 3 and not 2 ...
    expect(processAChangeCount).to.equal(3);
    expect(processBChangeCount).to.equal(3);
    done();
  }
}

app.on("ready", () => {
  const windowA = createWindow("A");
  const windowB = createWindow("B");

  ipcMain.on("message", (e, data) => {
    if (e.sender === windowA.webContents) {
      debug(`Received status from A: ${data.status}`);
      if (data.status === "realm-opened") {
        // Once process A has opened the Realm, ask process B to do the same
        windowB.webContents.send("message", { action: "open-realm" });
      } else if (data.status === "person-created") {
        // Once process A has created a Person, ask process B to change it
        windowB.webContents.send("message", { action: "change-person", uuid: data.uuid });
      } else if (data.status === "person-changed") {
        // Wait for process B to respond to the change
        setTimeout(() => {
          // Ensure that both processes are not blocking
          windowA.webContents.send("message", { action: "ping" });
          windowB.webContents.send("message", { action: "ping" });
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
    } else {
      debug(`Received status from B: ${data.status}`);
      if (data.status === "realm-opened") {
        // Once process B has opened the Realm, ask process A to create an object
        windowA.webContents.send("message", { action: "create-person" });
      } else if (data.status === "person-changed") {
        // Once process B has changed the Person, ask process A to change it too
        windowA.webContents.send("message", { action: "change-person", uuid: data.uuid });
      } else if (data.status === "realm-changed") {
        processBChangeCount++;
      } else if (data.status === "pong") {
        pongCount++;
        checkPongs("B");
      } else {
        const err = new Error(`Unexpected status ${data.status}`);
        done(err);
      }
    }
  });

  // Let the games begin ...
  windowA.webContents.on('did-finish-load', () => {
    windowA.webContents.send("message", { action: "open-realm" });
  });
});
