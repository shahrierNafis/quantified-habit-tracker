import { Storage } from "@ionic/storage";
import { StateStorage } from "zustand/middleware";

const store = new Storage();
// Every call awaits this, so nothing reads the DB before it has been created.
const ready = store.create();

export const ionicStorage: StateStorage = {
  getItem: async (name) => {
    await ready;
    const value = await store.get(name);
    return value ? JSON.stringify(value) : null;
  },
  setItem: async (name, value) => {
    await ready;
    // persist passes a stringified JSON value
    await store.set(name, JSON.parse(value));
  },
  removeItem: async (name) => {
    await ready;
    await store.remove(name);
  },
};
