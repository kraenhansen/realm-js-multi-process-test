const { ipcRenderer, remote } = require("electron");
const { resolve } = require("path");
const faker = require("faker");
const { mkdirSync, existsSync } = require("fs");

global.console = remote.getGlobal("console");
console.log("Hello from Renderer!");

// Make the "processes" path if it doesn't exist
const PROCESSES_PATH = resolve(__dirname, "../../processes");
if (!existsSync(PROCESSES_PATH)) {
  mkdirSync(PROCESSES_PATH);
}
// Make the data path if it doesn't exist
const DATA_PATH = resolve(__dirname, "../../data");
if (!existsSync(DATA_PATH)) {
  mkdirSync(DATA_PATH);
}

const WD_PATH = resolve(PROCESSES_PATH, process.pid.toString());
mkdirSync(WD_PATH);
process.chdir(WD_PATH);

const Realm = require("realm");

const prefix = process.pid;
const debug = require("debug")(`realm-js-test/runner-${prefix}`);

const REALM_PATH = resolve(DATA_PATH, "test.realm");

const SCHEMA = [{
  name: "Person",
  primaryKey: "uuid",
  properties: {
    uuid: "string",
    name: "string",
    age: "int"
  }
}];

debug(`Started`);

let realm;

function addChangeListener(realm) {
  realm.addListener("change", (r, name) => {
    // Something changed in the Realm
    ipcRenderer.send("message", { status: "realm-changed", name });
  });
}

ipcRenderer.on("message", (e, data) => {
  const { action } = data;
  debug(`Received action: ${action}`);

  if (action === "open-realm") {
    realm = new Realm({
      path: REALM_PATH,
      schema: SCHEMA,
    });
    addChangeListener(realm);
    ipcRenderer.send("message", { status: "realm-opened" });
  } else if (action === "create-person") {
    realm.write(() => {
      const person = realm.create('Person', {
        uuid: faker.random.uuid(),
        name: faker.name.firstName(),
        age: faker.random.number(40),
      });
      debug(`Created person named ${person.name}`);
      ipcRenderer.send("message", {
        status: "person-created",
        uuid: person.uuid,
      });
    });
  } else if (action === "change-person") {
    realm.write(() => {
      const person = realm.objectForPrimaryKey('Person', data.uuid);
      person.age = faker.random.number(40) + 40;
      ipcRenderer.send("message", {
        status: "person-changed",
        uuid: person.uuid,
        newAge: person.age,
      });
    });
  } else if (action === "ping") {
    ipcRenderer.send("message", { status: "pong" });
  } else {
    throw new Error(`Unexpected action: ${action}`);
  }
});
