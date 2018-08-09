const { basename, resolve } = require("path");
const Realm = require("realm");

const debug = require("debug")(`realm-js-test/${basename(__filename)}`);
const REALM_PATH = resolve(__dirname, "../test.realm");

debug(`Started (pid = ${process.pid})`);

let realm;

process.on("message", (msg) => {
  if (msg === "open realm") {
    debug(`Opening realm`);
    realm = new Realm({
      path: REALM_PATH,
      schema: [],
    });
    process.send("realm opened");
  } else {
    console.error(`Unexpected message ${msg}`);
    process.exit(1);
  }
});
