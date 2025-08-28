
import { error } from 'console';
import { HydraTestParticipant } from './HydraTestParticipant';
import { Value } from 'libcardano'; // Import Value
import { KuberHydraApiProvider } from '../src/service/KuberHydraApiProvider';
import { HydraHeadState } from '../src/utils/hydraTypes';

interface ParticipantConfig {
  httpUrl: string;
  fundKeyFile: string;
  nodeKeyFile: string;
}

interface ClusterConfig {
  participants: ParticipantConfig[];
}

export class HydraTestCluster {
  private clusterConfig: ClusterConfig;
  private participants: HydraTestParticipant[] = [];

  constructor(initialConfig?: ClusterConfig) {
    this.clusterConfig = initialConfig || { participants: [] };
    this.loadParticipants();
  }

  private loadParticipants(): void {
    this.participants = this.clusterConfig.participants.map(
      (p) => new HydraTestParticipant(p.httpUrl, p.fundKeyFile, p.nodeKeyFile)
    );
  }

  public addParticipantConfig(httpUrl: string, fundKeyFile: string, nodeKeyFile: string): void {
    const newParticipantConfig = { httpUrl, fundKeyFile, nodeKeyFile };
    this.clusterConfig.participants.push(newParticipantConfig);
    this.participants.push(new HydraTestParticipant(httpUrl, fundKeyFile, nodeKeyFile));
  }

  public getParticipant(participantIndex: number): HydraTestParticipant | undefined {
    if (participantIndex >= 0 && participantIndex < this.participants.length) {
      return this.participants[participantIndex];
    }
    return undefined;
  }

  public getAllParticipants(): HydraTestParticipant[] {
    return this.participants;
  }

  public async checkAllParticipantsHaveFunds(minAmount: bigint = 1000000n): Promise<boolean> {
    for (const participant of this.participants) {
      const hasFunds = await participant.hasFunds(minAmount);
      if (!hasFunds) {
        console.warn(`Participant ${participant.getKuberHydraUrl()} does not have sufficient funds.`);
        return false;
      }
    }
    return true;
  }


  private async transitionIdleToInitial(hydra: KuberHydraApiProvider): Promise<void> {
    console.log(`[Cluster Transition] from: Idle to: Initial`)
    await hydra.initialize(true);
    await hydra.waitForHeadState("Initial", 180000);
  }

  private async transitionInitialToOpen(): Promise<void> {
    console.log(`[Cluster Transition] from: Initial to: Open`)

    for (const participant of this.participants) {
      const hydra = participant.getKuberHydraApiProvider();
      const cip30Wallet = await participant.getCip30Wallet();
      const walletAddress = (await cip30Wallet.getChangeAddress()).toBech32();
      const head = await hydra.queryHead();

      let alreadyCommitted = false;
      for (const commit in head.contents.committed!) {
        const utxos = head.contents.committed[commit];
        for (const txin in utxos) {
          const tout = utxos[txin];
          if (tout.address == walletAddress) {
            alreadyCommitted = true;
          }
        }
      }
      if (alreadyCommitted) {
        console.log(`Participant ${walletAddress} has already committed. Used url: ${participant.getKuberHydraUrl()}`);
        continue;
      }
      const l1Utxos = await hydra.l1Api.queryUTxOByAddress(walletAddress);
      if (l1Utxos.length === 0) {
        throw new Error(`not enough balance on ${walletAddress} in l1Chain for ${participant.getKuberHydraUrl()}`);
      }
      const selectedUtxos = l1Utxos.filter((x) => x.txOut.value.greaterThan(Value.fromString("4A")));
      if (selectedUtxos.length === 0) {
        throw new Error(`not enough balance on ${walletAddress} in l1Chain for ${participant.getKuberHydraUrl()}`);
      }
      const txIn = selectedUtxos[0].txIn;
      const commitResult = await hydra.commit({ utxos: [`${txIn.txHash.toString("hex")}#${txIn.index}`] });
      const signResult = await cip30Wallet.signTx(commitResult.cborHex);

      await hydra.l1Api.submitTx(signResult.updatedTxBytes.toString("hex"));
      await hydra.l1Api.waitForUtxoConsumption(selectedUtxos[0].txIn, 280000, true);
    }
    this.participants[0].getKuberHydraApiProvider().waitForHeadState('Open',120000)
    
  }

  private async transitionOpenToClose(hydra: KuberHydraApiProvider): Promise<void> {
    console.log(`[Cluster Transition] from: Open to: Closed`)
    await hydra.close(true);
    await hydra.waitForHeadState("Closed", 180000, true);
  }

  private async transitionClosedToFanoutReady(hydra: KuberHydraApiProvider): Promise<void> {
    console.log(`[Cluster Transition] from: Closed to: FanoutReady`);
    const head = await hydra.queryHead();
    const deadline = new Date(head.contents.contestationDeadline);
    const target = deadline.getTime() + 3 * 60 * 1000;          // +3 min
    const now = Date.now();
    const waitMs = Math.max(0, target - now);                   // ms until deadline+3 min
    const waitSec = Math.ceil(waitMs / 1000);                   // seconds, rounded up

    console.log(
      `ContestationDeadline: ${deadline.toISOString()}, ` +
      `Current date: ${new Date(now).toISOString()}, ` +
      `Waiting until: ${new Date(target).toISOString()}, ` +
      `waitSec: ${waitSec})`
    );

    await hydra.waitWhile(
      (currentHead) => {
        return currentHead.contents.readyToFanoutSent == true;
      },
      waitMs
    );

    console.log(`[Cluster Transition] Transition closed→FanoutReady completed`);
  }

  private async transitionFanoutToInitial(hydra: KuberHydraApiProvider): Promise<void> {
    console.log(`[Cluster Transition] from: FanoutReady to: Initial`)
    await hydra.fanout(true);
    await hydra.waitForHeadState("Initial", 180000);
  }


  public async resetClusterToInitialState(): Promise<void> {
  const participant = this.participants[0];
  const hydra = participant.getKuberHydraApiProvider();
  let head = await hydra.queryHead();
  const participantUrl = participant.getKuberHydraUrl();

  if (head.tag === "Initial") {
    console.log(`Head is already in Initial state for ${participantUrl}`);
    return;
  }
  console.log(`[Cluster Reset] from: ${head.tag} to: Initial`)


    if (head.tag === "Idle") {
      await this.transitionIdleToInitial(hydra);
    } else if (head.tag === "Open") {
      await this.transitionOpenToClose(hydra);
      await this.transitionClosedToFanoutReady(hydra);
      await this.transitionFanoutToInitial(hydra);
    } else if (head.tag === "Closed") {
      await this.transitionClosedToFanoutReady(hydra);
      await this.transitionFanoutToInitial(hydra);
    } else {
      throw Error(`Could not transition to Initial state for ${participantUrl}. Current state: ${head.tag}`);
    }
  }

  public async resetClusterToOpenState(): Promise<void> {
    const participant = this.participants[0];
    const hydra = participant.getKuberHydraApiProvider();
    let head = await hydra.queryHead();
    const participantUrl = participant.getKuberHydraUrl();


    if (head.tag === "Open") {
      console.log(`Head is already in Open state for ${participantUrl}`);
      return;
    }
    console.log(`[Cluster Reset] from: ${head.tag} to: Open`)

    if (head.tag === "Closed") {
      await this.transitionClosedToFanoutReady(hydra);
      await this.transitionFanoutToInitial(hydra);
      head = await hydra.queryHead();
    }

    if (head.tag === "Idle") {
      await this.transitionIdleToInitial(hydra);
      head = await hydra.queryHead();

    }
    if (head.tag === "Initial") {
      await this.transitionInitialToOpen();
      this.participants[0].getKuberHydraApiProvider().waitForHeadState("Open", 180000, true);
      return
    }
    else {
      console.warn(`Could not transition to Open state for ${participantUrl}. Current state: ${head.tag}`);
      throw Error("Missing logic to transition from " + head.tag + " to Open");
    }
  }

  public async resetClusterToClosedState(options?: { contested?: boolean, fanoutReady?: boolean }): Promise<void> {
    const participant = this.participants[0];
    const hydra = participant.getKuberHydraApiProvider();
    let head = await hydra.queryHead();
    const participantUrl = participant.getKuberHydraUrl();

    if (head.tag === "Closed") {
      console.log(`[Cluster Reset] from: ${head.tag} to: Closed`)
      console.log(`Head is already in Closed state for ${participantUrl}`);
      if (options?.contested) {
        if (head.contents.readyToFanoutSent) {
          console.log(`Fanouting head for ${participantUrl}`);
          const result = await hydra.fanout(true);
          console.log("fanout result", result);
          this.resetClusterToClosedState({ contested: true });
          return;
        }
      }
      if (options?.fanoutReady) {
        if (!head.contents.readyToFanoutSent) {
          await this.transitionClosedToFanoutReady(hydra);
          return
        } else { // already in ready to fanout state
          console.log("Already ready to fanout");
          return;
        }
      } else if (!options?.contested && head.contents.readyToFanoutSent) {
        await this.transitionFanoutToInitial(hydra);
        await this.resetClusterToOpenState();
      } else {
        return;
      }
    }

    // Ensure it's in Open state first
    if (head.tag !== "Open") {
      console.log(`[Cluster Reset] from: ${head.tag} to: Closed, Start by resetting to Open`)
      await this.resetClusterToOpenState();
      head = await hydra.queryHead(); // Re-query head state after transition
    }

    if (head.tag === "Open") {
      await this.transitionOpenToClose(hydra);
      if (options) {
        await this.resetClusterToClosedState(options);
      }
    } else {
      console.warn(`Could not transition to Closed state for ${participantUrl}. Current state: ${head.tag}`);
    }
  }

  public async resetCluster(targetState: HydraHeadState): Promise<void> {
    const participant = this.participants[0];
    const hydra = participant.getKuberHydraApiProvider();
    let head = await hydra.queryHead();
    const participantUrl = participant.getKuberHydraUrl();

    if (targetState === head.tag) {
      console.log(`Head is already in ${targetState} state for ${participantUrl}`);
      return;
    }

    switch (targetState) {
      case "Idle":
      case "Initial":
        // If the target is Idle or Initial, we can use resetClusterToInitialState
        // which will bring it to Initial. If the target was Idle, and it's now Initial, it's considered successful.
        await this.resetClusterToInitialState();
        break;
      case "Open":
        await this.resetClusterToOpenState();
        break;
      case "Closed":
        await this.resetClusterToClosedState();
        break;
      default:
        throw new Error(`Unsupported target state: ${targetState}`);
    }

    // Verify final state
    head = await hydra.queryHead();
    if (head.tag !== targetState) {
      // Special handling for Idle/Initial after fanout. Fanout transitions to Initial, which is effectively Idle.
      if ((targetState === "Idle" || targetState === "Initial") && (head.tag === "Idle" || head.tag === "Initial")) {
        console.log(`Cluster successfully reset to ${targetState} state (actual: ${head.tag}).`);
        return;
      }
      throw new Error(`Failed to transition to ${targetState}. Current state: ${head.tag}`);
    }
    console.log(`Cluster successfully reset to ${targetState} state.`);
  }

  public clearConfig(): void {
    this.clusterConfig.participants = [];
    this.participants = [];
  }
}
