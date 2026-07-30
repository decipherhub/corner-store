import {createOperatorApi} from "./api";

const configPath = process.env.CORNER_STORE_CONFIG ?? "corner-store.config.json";
const artifactPath = process.env.CORNER_STORE_ARTIFACT;
const manifestPath = process.env.CORNER_STORE_MANIFEST;
const eventsPath = process.env.CORNER_STORE_EVENTS;
const authToken = process.env.CORNER_STORE_API_TOKEN;
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const server = createOperatorApi({configPath, artifactPath, manifestPath, eventsPath, authToken});
server.listen(port, host, () => console.log(`Corner Store operator API listening on ${host}:${port}`));
