import { HydraTestCluster } from '../../src/cluster/HydraTestCluster';
import { HydraHeadState } from '../../src/utils/hydraTypes';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const devnetPath = path.join(__dirname, '../../../kuber-hydra/devnet');
const dockerHost = process.env.docker_host ?? process.env.DOCKER_HOST ?? 'localhost';
const hydraPort = Number(process.env.HYDRA_PORT ?? process.env.hydra_port ?? 8082);
const participantConfigs = HydraTestCluster.scanDevnetFolder(devnetPath, dockerHost, hydraPort);

const hydraStates: HydraHeadState[] = ["Initial", "Open", "Closed"];
const testResultsDir = "test-results";

async function runTestsWithClusterReset() {
  console.log(`Using Hydra docker host ${dockerHost}:${hydraPort}`);
  const failedStates: HydraHeadState[] = [];
  for (const state of hydraStates) {
    const stateResultsDir = path.join(testResultsDir, state);
    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
    }

    console.log(`\n--- Resetting cluster to ${state} state and running tests ---`);

    const hydraCluster = new HydraTestCluster({ participants: participantConfigs });

    try {
      await hydraCluster.resetCluster(state);
      console.log(`Cluster successfully reset to ${state} state.`);

      // Command to run vitest, outputting JSON and HTML reports to state-specific files
      const command = `${process.execPath} ./node_modules/vitest/vitest.mjs run --coverage`;
      console.log(`Executing command: ${command}`);
      execSync(command, {
        stdio: 'inherit',
        env: {
          ...process.env,
          HYDRA_TESTS: '1',
          docker_host: dockerHost,
          DOCKER_HOST: dockerHost,
        },
      });

    } catch (e ) {
      console.error(e);
      failedStates.push(state);

      // Continue to the next state even if one fails
    } finally {
      try{
      if(fs.existsSync('./reports')) {
        fs.rmSync(stateResultsDir, { recursive: true, force: true });
        fs.renameSync(path.resolve('./reports'), stateResultsDir);
      }
      }catch( e){
          console.error(e)
      }
      // Clean up cluster config for the next iteration if necessary, though HydraTestCluster creates new participants on each addParticipantConfig
      // For a clean slate, we might want to clear the config, but the current setup creates a new cluster instance per state.
      // hydraCluster.clearConfig(); // This might not be strictly necessary if a new HydraTestCluster is created each time.
    }
  }
  if (failedStates.length > 0) {
    throw new Error(`Test runs failed for Hydra states: ${failedStates.join(", ")}`);
  }
  console.log("\n--- All test runs completed ---");
}

runTestsWithClusterReset().catch((error) => {
  console.error("An unexpected error occurred:", error);
  process.exit(1);
});
