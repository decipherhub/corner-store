import {cpSync, mkdirSync, rmSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = resolve(here, "..");
const repoRoot = resolve(cliRoot, "../..");
const target = resolve(cliRoot, "bundle/contracts");

rmSync(resolve(cliRoot, "bundle"), {recursive: true, force: true});
mkdirSync(target, {recursive: true});

for (const path of ["src", "script", "test/fixtures", "test/mocks"]) {
  cpSync(resolve(repoRoot, path), resolve(target, path), {recursive: true});
}

const contractDependencies = [
  ["openzeppelin-contracts", "contracts"],
  ["openzeppelin-contracts-upgradeable", "contracts"],
  ["solidity", "contracts"],
  ["ERC-3643", "contracts"],
  ["forge-std", "src"]
];
for (const [dependency, sourceDirectory] of contractDependencies) {
  cpSync(
    resolve(repoRoot, "lib", dependency, sourceDirectory),
    resolve(target, "lib", dependency, sourceDirectory),
    {recursive: true}
  );
}

const dependencyLicenses = [
  ["openzeppelin-contracts", "LICENSE"],
  ["openzeppelin-contracts-upgradeable", "LICENSE"],
  ["solidity", "LICENSE.md"],
  ["ERC-3643", "LICENSE.md"],
  ["forge-std", "LICENSE-APACHE"],
  ["forge-std", "LICENSE-MIT"]
];
for (const [dependency, license] of dependencyLicenses) {
  cpSync(
    resolve(repoRoot, "lib", dependency, license),
    resolve(target, "lib", dependency, license)
  );
}
for (const path of ["foundry.toml", "remappings.txt"]) {
  cpSync(resolve(repoRoot, path), resolve(target, path));
}
mkdirSync(resolve(target, "deployments"), {recursive: true});
cpSync(
  resolve(repoRoot, "services/rfq-demo-backend/config/demo-scenario.json"),
  resolve(target, "deployments/anvil-e2e-scenario.json")
);

const sandboxServices = {
  toolkit: ["package.json", "package-lock.json", "tsconfig.json", "src"],
  rfq: ["package.json", "package-lock.json", "tsconfig.json", "src"],
  cli: ["package.json", "package-lock.json", "tsconfig.json", "src"],
  "rfq-demo-backend": ["package.json", "package-lock.json", "tsconfig.json", "src"],
  "operator-api": ["package.json", "package-lock.json", "tsconfig.json", "src"],
  "operator-dashboard": ["package.json", "server.js", "index.html", "styles.css", "app.js"],
  "deployment-studio": ["package.json", "package-lock.json", "tsconfig.json", "src", "web"]
};
for (const [service, paths] of Object.entries(sandboxServices)) {
  for (const path of paths) {
    const destination = resolve(cliRoot, "bundle/services", service, path);
    mkdirSync(dirname(destination), {recursive: true});
    cpSync(
      resolve(repoRoot, "services", service, path),
      destination,
      {recursive: true}
    );
  }
}
