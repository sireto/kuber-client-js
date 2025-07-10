import path from "path";
import fs from "fs";
import { KuberHydraService } from "../../service/kuberHydraService";
import { ShelleyWallet, Ed25519Key } from "libcardano";
import { HydraWallet } from "../../wallet/hydraWallet";
import { respondWithError } from "../../service/utils/errorHandler";
import { setup } from "libcardano/lib/cardano/crypto";

await setup();

export const RUNS = 10;

export const timeAsync = async <T>(
  label: string,
  fn: () => Promise<T>,
  log: Record<string, number>
) => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  log[label] = end - start;
  return result;
};

/**
 * Writes benchmark results as a markdown table.
 *
 * @param results - An array of timing logs for each run
 * @param outputDir - Subfolder under "src/tests/benchmark/results" (e.g., "serial", "parallel")
 * @param filenamePrefix - Optional filename prefix (defaults to "benchmark")
 * @param bulkLog - Optional bulk operation timings (e.g., { submitTxBulk: 123.45 })
 */
export const writeBenchmarkResults = (
  results: Record<string, number>[],
  outputDir: "serial" | "parallel",
  bulkLog?: Record<string, number>
) => {
  const headers = ["Run", ...Object.keys(results[0] ?? {})];
  const rows = results.map((res, idx) => {
    return [
      idx + 1,
      ...headers.slice(1).map((key) => res[key]?.toFixed(2) || "-"),
    ];
  });

  const tableLines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ];

  if (bulkLog && Object.keys(bulkLog).length > 0) {
    tableLines.push(
      `\n### Bulk Operation Timing\n`,
      `| Operation | Time (ms) |`,
      `| --- | --- |`,
      ...Object.entries(bulkLog).map(
        ([key, val]) => `| ${key} | ${val?.toFixed(2) || "-"} |`
      )
    );
  }

  const table = tableLines.join("\n");

  const outputPath = path.join(
    "src",
    "tests",
    "benchmark",
    "results",
    outputDir,
    `${new Date().toISOString()}.md`
  );

  fs.writeFileSync(outputPath, table, "utf-8");
  console.log(`Benchmark results written to ${outputPath}`);
};

export const testWalletSigningKey = await Ed25519Key.fromCardanoCliFile(
  path.join("src", "tests", "keys", "test-node.sk")
);

export const testWalletAddress = new ShelleyWallet(
  testWalletSigningKey
).addressBech32(0);

export async function createHydraWallet(
  service: KuberHydraService,
  ed25519Key: Ed25519Key,
  network: 0 | 1
): Promise<HydraWallet> {
  try {
    const shelleyWallet = new ShelleyWallet(ed25519Key);
    const hydraWallet = new HydraWallet(service, shelleyWallet, network);
    return hydraWallet;
  } catch (error: any) {
    return respondWithError(error);
  }
}

export const createSampleOutputTx = (
  selectionAddress: string,
  outputAddress: string
) => {
  return {
    selections: [selectionAddress],
    outputs: [
      {
        address: outputAddress,
        value: 2000000,
        datum: {
          fields: [],
          constructor: 1,
        },
      },
      {
        address: outputAddress,
        value: 2000000,
        datum: {
          fields: [],
          constructor: 2,
        },
      },
    ],
  };
};
