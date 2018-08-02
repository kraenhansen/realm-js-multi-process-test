const { resolve } = require("path");
const faker = require("faker");
const { mkdirSync, existsSync } = require("fs");

// Make the "processes" path if it doesn't exist
const PROCESSES_PATH = resolve(__dirname, "../processes");
if (!existsSync(PROCESSES_PATH)) {
  mkdirSync(PROCESSES_PATH);
}
// Make the data path if it doesn't exist
const DATA_PATH = resolve(__dirname, "../data");
if (!existsSync(DATA_PATH)) {
  mkdirSync(DATA_PATH);
}

const WD_PATH = resolve(PROCESSES_PATH, process.pid.toString());
mkdirSync(WD_PATH);
process.chdir(WD_PATH);

const Realm = require("realm");

const prefix = process.argv[2];
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

debug(`Started (pid = ${process.pid})`);

let realm;

function addChangeListener(realm) {
  realm.addListener("change", (r, name) => {
    // Something changed in the Realm
    process.send({ status: "realm-changed", name });
  });
}

process.on("message", (data) => {
  const { action } = data;
  debug(`Received action: ${action}`);

  if (action === "open-realm") {
    realm = new Realm({
      path: REALM_PATH,
      schema: SCHEMA,
    });
    addChangeListener(realm);
    process.send({ status: "realm-opened" });
  } else if (action === "create-person") {
    realm.write(() => {
      const person = realm.create('Person', {
        uuid: faker.random.uuid(),
        name: faker.name.firstName(),
        age: faker.random.number(40),
      });
      debug(`Created person named ${person.name}`);
      process.send({
        status: "person-created",
        uuid: person.uuid,
      });
    });
  } else if (action === "change-person") {
    realm.write(() => {
      const person = realm.objectForPrimaryKey('Person', data.uuid);
      person.age = faker.random.number(40) + 40;
      process.send({
        status: "person-changed",
        uuid: person.uuid,
        newAge: person.age,
      });
    });
  } else if (action === "ping") {
    process.send({ status: "pong" });
  } else {
    throw new Error(`Unexpected action: ${action}`);
  }
});
