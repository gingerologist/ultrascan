// Ultrasonic detection system data parser
// Based on C structures from firmware

const PACKET_PREAMBLE = 0xA5A5A5A5
const SIZEOF_PACKET_PREAMBLE = 4
const SIZEOF_PACKET_HEADER_T = 8
const SIZEOF_DATA_PACKET_HEADER_T = SIZEOF_PACKET_HEADER_T + 4
const SIZEOF_PACKET_CRC = 4
const SIZEOF_META_PACKET_PAYLOAD = 5760 + 12 // size of scan_conf_t TODO: why we need to hardcode this?

const DATA_PACKET_ANGLE_OFFSET = SIZEOF_PACKET_PREAMBLE + SIZEOF_PACKET_HEADER_T
const DATA_PACKET_STEP_OFFSET = DATA_PACKET_ANGLE_OFFSET + 1
const DATA_PACKET_CHANNEL_OFFSET = DATA_PACKET_STEP_OFFSET + 1
const DATA_PACKET_FORMAT_OFFSET = DATA_PACKET_CHANNEL_OFFSET + 1
const DATA_PACKET_CHUNK_OFFSET = DATA_PACKET_FORMAT_OFFSET + 4

/**
 * Data Structure of Scan Configuration.
 * 
 * @interface
 */
export interface ScanConfig {
  name: string;                    // 32-byte null-terminated string
  patternSegments: any[];          // 16 segments - structure TBD
  numPatternSegments: number;      // 0-16
  repeatCount: number;             // 0-31
  tailCount: number;               // 0-31
  txStartDel: number;              // 0-511
  trSwDelMode: boolean;            // flag
  captureStartUs: number;          // 0-500 microseconds - capture window start
  captureEndUs: number;            // 0-500 microseconds - capture window end
  angles: any[];                   // 16 angles - structure TBD
  numAngles: number;               // Actual number of angles used
  totalSteps?: number;             // Total steps across all angles
  // Note: Samples per packet = 20 × (captureEndUs - captureStartUs) due to 20MHz ADC clock

  bfClk: number;
  adcClk: number;
  baseline: boolean;
}

export interface MetadataPacket {
  packetType: 0x01;
  scanId: number;
  scanConfig: ScanConfig;
}

export interface DataPacket {
  packetType: 0x02;
  scanId: number;
  angleIndex: number;    // Changed from 'angle' to match C struct
  stepIndex: number;     // Changed from 'step' to match C struct  
  channelIndex: number;  // Changed from 'channel' to match C struct
  sampleFormat: number;
  samples: number[];     // Unpacked 10-bit ADC samples
}

export interface ScanData {
  scanId: number;
  metadata: MetadataPacket;
  dataPackets: Map<string, DataPacket>; // key: "angleIndex_stepIndex_channelIndex"
  isComplete: boolean;
  timestamp: number;
}

export const stm32h7_crc32 = (data: Uint32Array): number => {
  let crc32: number = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc32 = crc32 ^ (data[i] >>> 0);
    for (let j = 0; j < 32; j++) {
      if (crc32 & 0x80000000)
        crc32 = ((crc32 << 1) >>> 0) ^ 0x04C11DB7; // 0xB71DC104
      else
        crc32 = ((crc32 << 1) >>> 0);
    }
  }
  return (crc32 >>> 0);
}

/**
 * @class
 */
export class UltrasonicDataParser {
  private buffer: Uint8Array = new Uint8Array(0);
  private currentScan: ScanData | null = null;
  private completedScan: ScanData | null = null; // For auto mode - keep last completed scan
  private scans: Map<string, ScanData> = new Map(); // key: "bootId_scanId"
  private triggerMode: 'auto' | 'single' = 'auto';

  // TODO: remove this
  // Sync pattern for packet alignment (fixed boot ID in little-endian)
  // private static readonly SYNC_PATTERN = [0xA6, 0xA5, 0xA5, 0xA5]; // 0xA5A5A5A6 in little-endian

  // Callbacks for events
  public onMetadataReceived?: (metadata: MetadataPacket) => void;
  public onDataPacketReceived?: (packet: DataPacket) => void;
  public onScanComplete?: (scan: ScanData) => void;
  public onDeviceReboot?: (newBootId: number, oldBootId: number) => void;
  public onParseError?: (error: string, data: Uint8Array) => void;

  public processData(newData: Uint8Array): void {
    // Append new data to buffer
    const combined = new Uint8Array(this.buffer.length + newData.length);
    combined.set(this.buffer);
    combined.set(newData, this.buffer.length);
    this.buffer = combined;

    // Try to parse packets from buffer
    while (this.buffer.length > 0) {
      const packet = this.tryParsePacket();
      if (!packet) {
        break; // Need more data or no valid packet found
      }

      this.handlePacket(packet);
    }
  }

  private tryParsePacket(): MetadataPacket | DataPacket | null {

    while (this.buffer.length >= 16) { // Minimum packet size

      const view = new DataView(this.buffer.buffer, this.buffer.byteOffset);

      const preamble = view.getUint32(0, true); // little endian
      if (preamble !== PACKET_PREAMBLE) {
        this.buffer = this.buffer.slice(1);
        continue;
      }

      const typeAndScanId = view.getUint32(4, true);
      const packetType = typeAndScanId & 0xff;

      // Validate packet type
      if (packetType !== 0x01 && packetType !== 0x02) {
        this.onParseError?.(`Invalid packet type: 0x${packetType.toString(16)}`, this.buffer.slice(0, Math.min(32, this.buffer.length)));
        this.buffer = this.buffer.slice(1); // Skip this byte and try again
        continue;
      }

      const scanId = (typeAndScanId >>> 8) & 0xffffff;
      const payloadSize = view.getUint32(8, true);

      // packetSize includes header, payload, and crc but not preamble
      const packetSize = SIZEOF_PACKET_HEADER_T + payloadSize + SIZEOF_PACKET_CRC;
      const packetSizeWithPreamble = SIZEOF_PACKET_PREAMBLE + packetSize;

      // console.log(`packetSize: ${packetSize}, payloadSize: ${payloadSize}`);

      if (this.buffer.length < packetSizeWithPreamble) {
        return null; // Need more data;
      }

      // strip off preamble as well as CRC, packetData starts from header (inclusive), ends at crc (exclusive).
      const headerStart = SIZEOF_PACKET_PREAMBLE;
      const crcStart = packetSizeWithPreamble - SIZEOF_PACKET_CRC;
      const packetData = this.buffer.slice(headerStart, crcStart);
      const receivedCrc = view.getUint32(crcStart, true);

      const packetData32 = new Uint32Array(packetData.buffer, packetData.byteOffset, packetData.length / 4);
      const calculatedCrc = stm32h7_crc32(packetData32);

      if (receivedCrc !== calculatedCrc) {
        console.log(`CRC mismatch: calculated 0x${calculatedCrc.toString(16)}, got 0x${receivedCrc.toString(16)}`);
        this.buffer = this.buffer.slice(1);
        continue;
      } else {
        // console.log(`CRC match: 0x${calculatedCrc.toString(16).toUpperCase()}`);
      }

      // remove full packet from buffer
      this.buffer = this.buffer.slice(packetSizeWithPreamble);

      if (packetType === 0x01) {
        const configData = packetData.slice(SIZEOF_PACKET_HEADER_T, SIZEOF_PACKET_HEADER_T + SIZEOF_META_PACKET_PAYLOAD);
        const scanConfig = this.parseScanConfig(configData);

        if (scanId === 0) {
          console.log('testing (scan id = 0) metadata packet received', scanConfig);
          return null;
        }

        return {
          packetType: 0x01,
          scanId,
          scanConfig
        }
      } else if (packetType === 0x02) {
        // view is aligned with the beginning of preamble
        const angleIndex = view.getUint8(DATA_PACKET_ANGLE_OFFSET);
        const stepIndex = view.getUint8(DATA_PACKET_STEP_OFFSET);
        const channelIndex = view.getUint8(DATA_PACKET_CHANNEL_OFFSET);
        const sampleFormat = view.getUint8(DATA_PACKET_FORMAT_OFFSET);

        // data is aligned with the beginning of header
        const dataChunk = packetData.slice(SIZEOF_DATA_PACKET_HEADER_T);

        // console.log(`sizeof dataChunk is ${dataChunk.length}`)

        // Unpack 10-bit samples (8 samples per 10 bytes)
        const samples = this.unpack10BitSamples(dataChunk);

        if (scanId === 0) {
          console.log('testing (scan id = 0) data packet received', {
            angleIndex, stepIndex, channelIndex, sampleFormat, samples
          });
          return null;
        }

        // Validate sample count if we have scan configuration
        if (this.currentScan && this.currentScan.metadata) {
          const config = this.currentScan.metadata.scanConfig;
          const expectedSamples = 20 * (config.captureEndUs - config.captureStartUs);

          if (samples.length !== expectedSamples) {
            console.warn(`Sample count mismatch: expected ${expectedSamples}, got ${samples.length} ` +
              `(capture window: ${config.captureStartUs}-${config.captureEndUs}μs)` +
              `(dataChunk.length: ${dataChunk.length})`);
          }
        }

        return {
          packetType: 0x02,
          scanId,
          angleIndex,
          stepIndex,
          channelIndex,
          sampleFormat,
          samples,
        };
      }
    }

    return null; // Need more data or no valid packet found
  }

  /**
   * 
   * 
   * @param configData 
   * @returns 
   */
  private parseScanConfig(configData: Uint8Array): ScanConfig {
    if (configData.length < SIZEOF_META_PACKET_PAYLOAD) {
      throw new Error(`Scan config too short: ${configData.length} bytes, expected ${SIZEOF_META_PACKET_PAYLOAD}`);
    }

    const view = new DataView(configData.buffer, configData.byteOffset);

    // Read basic fields
    const captureStartUs = view.getUint16(0, true);
    const captureEndUs = view.getUint16(2, true);
    const numAngles = view.getUint16(4, true);
    const numPatternSegments = view.getUint16(6, true);

    // Parse name from offset 5704
    const nameBytes = configData.slice(5704, 5736);
    const nullIndex = nameBytes.indexOf(0);
    const name = new TextDecoder().decode(nameBytes.slice(0, nullIndex >= 0 ? nullIndex : 32));

    const trSwDelMode = view.getUint16(5752, true) !== 0;
    const repeatCount = view.getUint16(5754, true);
    const tailCount = view.getUint16(5756, true);
    const txStartDel = view.getUint16(5758, true);
    const bfClk = view.getUint32(5760, true);
    const adcClk = view.getUint32(5764, true);
    const baseline = ((view.getUint32(5768, true) >>> 0) & 1) === 1;

    // Parse angles array to get num_steps for each angle
    const angles: any[] = [];
    let totalSteps = 0;

    for (let i = 0; i < numAngles; i++) {
      const angleOffset = 8 + (i * 356); // angles[16] starts at offset 8, each angle is 356 bytes
      const numSteps = view.getUint32(angleOffset, true); // num_steps is first field (uint32_t)

      // Parse label (32 bytes starting at angleOffset + 4)
      const labelBytes = configData.slice(angleOffset + 4, angleOffset + 36);
      const labelNullIndex = labelBytes.indexOf(0);
      const label = new TextDecoder().decode(labelBytes.slice(0, labelNullIndex >= 0 ? labelNullIndex : 32));

      angles.push({
        numSteps,
        label
      });

      totalSteps += numSteps;
      console.log(`📊 Angle ${i}: ${numSteps} steps, label: "${label}"`);
    }

    console.log(`Total steps across ${numAngles} angles: ${totalSteps}`);
    console.log(`Baseline mode is ${baseline ? 'on' : 'off'}`);
    console.log(`Expected packets: ${totalSteps} steps × ${(baseline ? 65 : 64)} channels = ${totalSteps * (baseline ? 65 : 64)}`);

    return {
      name,
      patternSegments: [], // Skip parsing pattern_segments for now
      numPatternSegments,
      repeatCount,
      tailCount,
      txStartDel,
      trSwDelMode,
      captureStartUs,
      captureEndUs,
      angles,
      numAngles,
      totalSteps, // Add this for easy access in checkScanComplete

      bfClk,
      adcClk,
      baseline
    };
  }

  private unpack10BitSamples(dataChunk: Uint8Array): number[] {
    const samples: number[] = [];

    // Process in groups of 10 bytes (8 samples each)
    for (let i = 0; i < dataChunk.length; i += 10) {
      if (i + 9 >= dataChunk.length) break; // Incomplete group

      // Extract 8 samples from 10 bytes
      const bytes = dataChunk.slice(i, i + 10);
      const group = this.extract8SamplesFrom10Bytes(bytes);
      samples.push(...group);
    }

    return samples;
  }

  private extract8SamplesFrom10Bytes(bytes: Uint8Array): number[] {
    const s0 = ((bytes[0] + bytes[1] * 256) >>> 0) & 0x000003ff
    const s1 = ((bytes[1] + bytes[2] * 256) >>> 2) & 0x000003ff
    const s2 = ((bytes[2] + bytes[3] * 256) >>> 4) & 0x000003ff
    const s3 = ((bytes[3] + bytes[4] * 256) >>> 6) & 0x000003ff
    const s4 = ((bytes[5] + bytes[6] * 256) >>> 0) & 0x000003ff
    const s5 = ((bytes[6] + bytes[7] * 256) >>> 2) & 0x000003ff
    const s6 = ((bytes[7] + bytes[8] * 256) >>> 4) & 0x000003ff
    const s7 = ((bytes[8] + bytes[9] * 256) >>> 6) & 0x000003ff
    return [s0, s1, s2, s3, s4, s5, s6, s7].map(x => x - 512)
  }

  private handlePacket(packet: MetadataPacket | DataPacket): void {
    const scanKey = `${packet.scanId}`;

    if (packet.packetType === 0x01) {
      // Metadata packet - start new scan
      const metadata = packet as MetadataPacket;

      // // Check for device reboot
      // if (this.currentScan && this.currentScan.bootId !== packet.bootId) {
      //   this.onDeviceReboot?.(packet.bootId, this.currentScan.bootId);
      // }

      // In single mode, clear previous scan when starting new one
      if (this.triggerMode === 'single') {
        this.completedScan = null;
      }

      this.currentScan = {
        scanId: packet.scanId,
        metadata,
        dataPackets: new Map(),
        isComplete: false,
        timestamp: Date.now()
      };

      this.scans.set(scanKey, this.currentScan);
      this.onMetadataReceived?.(metadata);

    } else if (packet.packetType === 0x02) {
      // Data packet
      const dataPacket = packet as DataPacket;

      const scan = this.scans.get(scanKey);
      if (!scan) {
        this.onParseError?.(`Received data packet without metadata for scan ${scanKey}`, new Uint8Array());
        return;
      }

      // Store data packet
      const dataKey = `${dataPacket.angleIndex}_${dataPacket.stepIndex}_${dataPacket.channelIndex}`;
      scan.dataPackets.set(dataKey, dataPacket);

      this.onDataPacketReceived?.(dataPacket);

      // Check if scan is complete
      this.checkScanComplete(scan);
    }
  }

  // Fixed checkScanComplete method for parser.ts

  private checkScanComplete(scan: ScanData): void {
    if (scan.isComplete) return;

    const config = scan.metadata.scanConfig;

    // Use metadata to determine expected totals - this is the authoritative source
    const expectedAngles = config.numAngles;
    const expectedStepsPerAngle = config.angles.map(angle => angle.numSteps);
    const totalExpectedSteps = config.totalSteps || expectedStepsPerAngle.reduce((sum, steps) => sum + steps, 0);

    // Each step is transmitted on 64 channels (0-63)
    const expectedChannels = config.baseline ? 65 : 64;
    const totalExpectedPackets = totalExpectedSteps * expectedChannels;

    console.log(`Scan completion check:`);
    console.log(`   Expected: ${expectedAngles} angles, ${totalExpectedSteps} total steps, ${expectedChannels} channels`);
    console.log(`   Expected packets: ${totalExpectedPackets}`);
    console.log(`   Received packets: ${scan.dataPackets.size}`);
    console.log(`   Progress: ${((scan.dataPackets.size / totalExpectedPackets) * 100).toFixed(1)}%`);

    // Only mark complete when we have received ALL expected packets
    if (scan.dataPackets.size >= totalExpectedPackets) {
      // Additional verification: check that we have the expected range of indices
      const receivedKeys = Array.from(scan.dataPackets.keys());
      const angles = new Set<number>();
      const steps = new Set<number>();
      const channels = new Set<number>();

      receivedKeys.forEach(key => {
        const [angle, step, channel] = key.split('_').map(Number);
        angles.add(angle);
        steps.add(step);
        channels.add(channel);
      });

      const maxAngleReceived = Math.max(...Array.from(angles));
      const maxStepReceived = Math.max(...Array.from(steps));
      const maxChannelReceived = Math.max(...Array.from(channels));

      console.log(`📊 Received ranges: angles 0-${maxAngleReceived}, steps 0-${maxStepReceived}, channels 0-${maxChannelReceived}`);

      // Verify we received data for all expected ranges
      // TODO: these code are verbose. need clean.
      const hasAllAngles = maxAngleReceived >= (expectedAngles - 1);
      const hasAllChannels = maxChannelReceived >= 63; // Channels should be 0-63

      if (hasAllAngles && hasAllChannels) {
        scan.isComplete = true;

        if (this.triggerMode === 'auto') {
          this.completedScan = scan;
        }

        console.log(`✅ Scan marked complete: ${scan.dataPackets.size}/${totalExpectedPackets} packets`);
        this.onScanComplete?.(scan);
      } else {
        console.log(`⏳ Scan not complete yet - missing ranges. All angles: ${hasAllAngles}, All channels: ${hasAllChannels}`);
      }
    } else {
      const progressPercent = ((scan.dataPackets.size / totalExpectedPackets) * 100).toFixed(1);
    }
  }

  private calculateCRC32(data: Uint8Array): number {
    // Standard IEEE 802.3 CRC-32 (original implementation)
    let crc = 0xFFFFFFFF;

    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 1) {
          crc = (crc >>> 1) ^ 0xEDB88320; // Reversed polynomial
        } else {
          crc = crc >>> 1;
        }
      }
    }

    return (~crc) >>> 0; // Convert to unsigned 32-bit
  }

  // Utility methods
  public setTriggerMode(mode: 'auto' | 'single'): void {
    this.triggerMode = mode;

    // When switching to single mode, clear completed scan buffer
    if (mode === 'single') {
      this.completedScan = null;
    }
  }

  public getExpectedSamplesPerPacket(): number | null {
    // Calculate expected samples based on current scan configuration
    if (this.currentScan && this.currentScan.metadata) {
      const config = this.currentScan.metadata.scanConfig;
      return 20 * (config.captureEndUs - config.captureStartUs);
    }
    return null;
  }

  public getExpectedDataChunkSize(): number | null {
    // Calculate expected data chunk size in bytes
    const expectedSamples = this.getExpectedSamplesPerPacket();
    if (expectedSamples !== null) {
      // 8 samples per 10 bytes, so bytes = (samples / 8) * 10
      return Math.ceil(expectedSamples / 8) * 10;
    }
    return null;
  }

  public getExpectedPacketLength(): number | null {
    // Calculate expected total packet length
    const dataChunkSize = this.getExpectedDataChunkSize();
    if (dataChunkSize !== null) {
      return 14 + dataChunkSize + 4; // header + data + CRC
    }
    return null;
  }

  public getCurrentScan(): ScanData | null {
    return this.currentScan;
  }

  public getCompletedScan(): ScanData | null {
    return this.completedScan;
  }

  public getDisplayScan(): ScanData | null {
    // Return the appropriate scan for display based on mode
    if (this.triggerMode === 'auto') {
      // In auto mode, prefer completed scan, fallback to current if receiving
      return this.completedScan || this.currentScan;
    } else {
      // In single mode, show current scan (which becomes completed when done)
      return this.currentScan;
    }
  }

  public getScan(bootId: number, scanId: number): ScanData | null {
    return this.scans.get(`${bootId}_${scanId}`) || null;
  }

  public getCompletedScans(): ScanData[] {
    return Array.from(this.scans.values()).filter(scan => scan.isComplete);
  }

  public clearOldScans(maxAge: number = 60000): void {
    // Remove scans older than maxAge milliseconds
    const now = Date.now();
    for (const [key, scan] of this.scans.entries()) {
      if (now - scan.timestamp > maxAge) {
        this.scans.delete(key);
      }
    }
  }

  public reset(): void {
    // Clear all scan data - useful when switching modes or reconnecting
    this.currentScan = null;
    this.completedScan = null;
    this.scans.clear();
    this.buffer = new Uint8Array(0);
  }
}
