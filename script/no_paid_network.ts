import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";

const blocked = () => { throw new Error("External HTTP is disabled during the zero-cost repair"); };
globalThis.fetch = async () => blocked();
http.request = blocked;
http.get = blocked;
https.request = blocked;
https.get = blocked;
syncBuiltinESMExports();
