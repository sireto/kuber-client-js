import { HydraTestCluster } from '../../__tests__/HydraTestCluster';
import { HydraHeadState } from '../../src/utils/hydraTypes';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const devnetPath = path.join(__dirname, '../../../kuber-hydra/devnet');
const participantConfigs = HydraTestCluster.scanDevnetFolder(devnetPath,"localhost",8082);

const hydraStates: HydraHeadState[] = ["Initial", "Open", "Closed"];
const testResultsDir = "test-results";

async function runTestsWithClusterReset() {
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
      const command = `HYDRA_TESTS=1 yarn test`;
      console.log(`Executing command: ${command}`);
      execSync(command, { stdio: 'inherit' });

    } catch (e ) {
              console.error(e)

      // Continue to the next state even if one fails
    } finally {
      try{
      if(fs.existsSync('./reports'))
        fs.renameSync(path.resolve('./reports'), stateResultsDir);
      }catch( e){
          console.error(e)
      }
      // Clean up cluster config for the next iteration if necessary, though HydraTestCluster creates new participants on each addParticipantConfig
      // For a clean slate, we might want to clear the config, but the current setup creates a new cluster instance per state.
      // hydraCluster.clearConfig(); // This might not be strictly necessary if a new HydraTestCluster is created each time.
    }
  }
  console.log("\n--- All test runs completed ---");
}

runTestsWithClusterReset().catch((error) => {
  console.error("An unexpected error occurred:", error);
  process.exit(1);
});
