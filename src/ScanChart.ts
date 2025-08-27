import { EventEmitter } from 'events';
import {
  UltrasonicDataParser,
  MetadataPacket,
  DataPacket,
  ScanData,
  ScanConfig,
} from './parser';

interface ScanStartEvent {
  config: ScanConfig;
  totalPackets: number;
}

interface ScanProgressEvent {
  receivedPackets: number;
}

interface ScanStopEvent {
  config: ScanConfig;
  data: {
    angles: AngleData[];
  };
}

interface AngleData {
  index: number;
  label: string;
  steps: StepData[];
}

interface StepData {
  index: number;
  channels: ChannelData[];
}

interface ChannelData {
  index: number;
  samples: number[];
}

/**
 * Event-driven wrapper for UltrasonicDataParser that provides a cleaner interface
 * for UI consumption. Aggregates individual packet events into meaningful scan lifecycle events.
 *
 * Events:
 * - 'start': { config, totalPackets } - Scan begins with metadata
 * - 'progress': { receivedPackets } - Progress updates during data collection
 * - 'stop': { config, data } - Scan complete with all data, or error occurred
 */
export class ScanDataAggregator extends EventEmitter {
  private parser: UltrasonicDataParser;
  private currentScanId: number | null = null;
  private totalExpectedPackets: number = 0;
  private lastProgressEmit: number = 0;
  private progressThrottle: number = 100; // Throttle progress events to every 100ms

  constructor() {
    super();
    this.parser = new UltrasonicDataParser();
    this.setupParserCallbacks();
  }

  private setupParserCallbacks(): void {
    this.parser.onMetadataReceived = (metadata: MetadataPacket) => {
      this.handleMetadata(metadata);
    };

    this.parser.onDataPacketReceived = (packet: DataPacket) => {
      this.handleDataPacket(packet);
    };

    this.parser.onScanComplete = (scan: ScanData) => {
      this.handleScanComplete(scan);
    };

    this.parser.onParseError = (error: string, data: Uint8Array) => {
      this.handleParseError(error);
    };

    this.parser.onDeviceReboot = (newBootId: number, oldBootId: number) => {
      // Reset current scan on device reboot
      this.currentScanId = null;
      this.totalExpectedPackets = 0;
    };
  }

  /**
   * Process incoming serial data
   */
  public processData(data: Uint8Array): void {
    this.parser.processData(data);
  }

  /**
   * Reset parser state
   */
  public reset(): void {
    this.parser.reset();
    this.currentScanId = null;
    this.totalExpectedPackets = 0;
    this.lastProgressEmit = 0;
  }

  private handleMetadata(metadata: MetadataPacket): void {
    this.currentScanId = metadata.scanId;

    // Calculate total expected packets
    const config = metadata.scanConfig;
    const totalSteps =
      config.totalSteps ||
      config.angles.reduce((sum, angle) => sum + (angle.numSteps || 0), 0);

    const channelsPerStep = config.baseline ? 65 : 64;
    this.totalExpectedPackets = totalSteps * channelsPerStep;

    // Emit start event
    const startEvent: ScanStartEvent = {
      config: config,
      totalPackets: this.totalExpectedPackets,
    };

    this.emit('start', startEvent);
  }

  private handleDataPacket(packet: DataPacket): void {
    // Only emit progress for the current scan
    if (packet.scanId !== this.currentScanId) {
      return;
    }

    // Throttle progress events to avoid overwhelming the UI
    const now = Date.now();
    if (now - this.lastProgressEmit < this.progressThrottle) {
      return;
    }

    const currentScan = this.parser.getCurrentScan();
    if (currentScan) {
      const progressEvent: ScanProgressEvent = {
        receivedPackets: currentScan.dataPackets.size,
      };

      this.emit('progress', progressEvent);
      this.lastProgressEmit = now;
    }
  }

  private handleScanComplete(scan: ScanData): void {
    // Only process completion for the current scan
    if (scan.scanId !== this.currentScanId) {
      return;
    }

    try {
      // Transform raw scan data into structured format
      const structuredData = this.transformScanData(scan);

      const stopEvent: ScanStopEvent = {
        config: scan.metadata.scanConfig,
        data: structuredData,
      };

      this.emit('stop', stopEvent);
    } catch (error) {
      this.handleParseError(`Failed to transform scan data: ${error}`);
    } finally {
      // Reset tracking
      this.currentScanId = null;
      this.totalExpectedPackets = 0;
    }
  }

  private handleParseError(error: string): void {
    // Emit stop event with error
    this.emit('stop', new Error(error));

    // Reset tracking
    this.currentScanId = null;
    this.totalExpectedPackets = 0;
  }

  private transformScanData(scan: ScanData): { angles: AngleData[] } {
    const config = scan.metadata.scanConfig;
    const angles: AngleData[] = [];

    // Process each angle
    for (let angleIndex = 0; angleIndex < config.numAngles; angleIndex++) {
      const angleConfig = config.angles[angleIndex];
      const numSteps = angleConfig?.numSteps || 0;
      const label = angleConfig?.label || `Angle ${angleIndex}`;

      const steps: StepData[] = [];

      // Process each step within this angle
      for (let stepIndex = 0; stepIndex < numSteps; stepIndex++) {
        const channels: ChannelData[] = [];

        // Process each channel within this step
        const maxChannels = config.baseline ? 65 : 64;
        for (let channelIndex = 0; channelIndex < maxChannels; channelIndex++) {
          const dataKey = `${angleIndex}_${stepIndex}_${channelIndex}`;
          const packet = scan.dataPackets.get(dataKey);

          if (packet && packet.samples) {
            channels.push({
              index: channelIndex,
              samples: [...packet.samples], // Copy samples to avoid reference issues
            });
          }
        }

        // Only include steps that have data
        if (channels.length > 0) {
          steps.push({
            index: stepIndex,
            channels: channels,
          });
        }
      }

      // Only include angles that have data
      if (steps.length > 0) {
        angles.push({
          index: angleIndex,
          label: label,
          steps: steps,
        });
      }
    }

    return { angles };
  }

  /**
   * Get current scan progress information
   */
  public getProgress(): {
    received: number;
    total: number;
    percentage: number;
  } | null {
    if (!this.currentScanId) {
      return null;
    }

    const currentScan = this.parser.getCurrentScan();
    if (!currentScan) {
      return null;
    }

    const received = currentScan.dataPackets.size;
    const total = this.totalExpectedPackets;
    const percentage = total > 0 ? (received / total) * 100 : 0;

    return { received, total, percentage };
  }

  /**
   * Check if currently processing a scan
   */
  public isScanning(): boolean {
    return this.currentScanId !== null;
  }
}

// Type exports for consumers
export type {
  ScanStartEvent,
  ScanProgressEvent,
  ScanStopEvent,
  AngleData,
  StepData,
  ChannelData,
};
