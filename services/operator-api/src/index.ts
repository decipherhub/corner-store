import {createOperatorApi} from "./api";

const configPath = process.env.CORNER_STORE_CONFIG ?? "corner-store.config.json";
const artifactPath = process.env.CORNER_STORE_ARTIFACT;
const eventsPath = process.env.CORNER_STORE_EVENTS;
const port = Number(process.env.PORT ?? 8787);
const server = createOperatorApi({configPath, artifactPath, eventsPath});
server.listen(port, "127.0.0.1", () => console.log(`Corner Store operator API listening on 127.0.0.1:${port}`));
