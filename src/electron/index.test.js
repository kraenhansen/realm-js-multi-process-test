const { expect } = require("chai");
const { Application } = require("spectron");
const electronPath = require("electron");
const { resolve } = require("path");

describe("Realm JS running in two Electron renderer processes", () => {
  let app;
  let server;

  before(async function() {
    // We need a longer timeout as starting Spectron app takes forever on Windows
    this.timeout(30000);
    // Start the application
    app = new Application({
      path: electronPath,
      args: [resolve(__dirname, "main.js")]
    })
    await app.start();
    await app.client.waitUntilWindowLoaded();
  });

  after(async () => {
    // Print the main process logs
    const lines = await app.client.getMainProcessLogs();
    lines.forEach(line => {
      console.log(line);
    });
    // Stop the app if it's running
    if (app && app.isRunning()) {
      await app.stop();
    }
  })


  it("can open, read, write and observe changes", async function() {
    // We need a longer timeout as starting Spectron app takes forever on Windows
    this.timeout(30000);

    let processAChangeCount = 0;
    let processBChangeCount = 0;
    let pongCount = 0;

    // Read logs and resolve when reading "Great success!"
    await new Promise((resolve, reject) => {
      const timeout = setInterval(() => {
        app.client.getMainProcessLogs().then(lines => {
          for (const line of lines) {
            console.log(line);
            if (line === "Great success!") {
              clearTimeout(timeout);
              resolve();
            }
          }
        }, reject);
      }, 100);
    });
  });
});
