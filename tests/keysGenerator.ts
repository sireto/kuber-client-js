import { execSync } from "child_process";
import { join } from "path";
import fs from "fs";

const keysDirectory = join("src", "tests", "keys");

function ensureDirectoryExists(path: string) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
}

function fileExists(path: string) {
  return fs.existsSync(path);
}

function generateNodeKeys(name: string, dir: string) {
  const vkPath = join(dir, `${name}-node.vk`);
  const skPath = join(dir, `${name}-node.sk`);
  const addrPath = join(dir, `${name}-node.addr`);

  if (!(fileExists(vkPath) && fileExists(skPath))) {
    execSync(
      `cardano-cli address key-gen \
      --verification-key-file ${vkPath} \
      --signing-key-file ${skPath}`,
      { stdio: "inherit" },
    );
  }

  if (!fileExists(addrPath)) {
    execSync(
      `cardano-cli address build \
      --verification-key-file ${vkPath} \
      --out-file ${addrPath} \
      --testnet-magic 2`,
      { stdio: "inherit" },
    );
  }
}

function setupParticipant(name: string) {
  ensureDirectoryExists(keysDirectory);
  generateNodeKeys(name, keysDirectory);
}

// Main execution
["test"].forEach(setupParticipant);
