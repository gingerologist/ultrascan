// Ultrasonic detection system data parser
// Based on C structures from firmware

const PACKET_PREAMBLE = 0xa5a5a5a5;
const SIZEOF_PACKET_PREAMBLE = 4;
const SIZEOF_PACKET_HEADER_T = 8;
const SIZEOF_DATA_PACKET_HEADER_T = SIZEOF_PACKET_HEADER_T + 4;
const SIZEOF_PACKET_CRC = 4;
const SIZEOF_META_PACKET_PAYLOAD = 5760 + 12; // size of scan_conf_t TODO: why we need to hardcode this?
const SIZEOF_META2_PACKET_PAYLOAD = 13888 + 12;

const DATA_PACKET_ANGLE_OFFSET =
  SIZEOF_PACKET_PREAMBLE + SIZEOF_PACKET_HEADER_T;
const DATA_PACKET_STEP_OFFSET = DATA_PACKET_ANGLE_OFFSET + 1;
const DATA_PACKET_CHANNEL_OFFSET = DATA_PACKET_STEP_OFFSET + 1;
const DATA_PACKET_FORMAT_OFFSET = DATA_PACKET_CHANNEL_OFFSET + 1;
const DATA_PACKET_CHUNK_OFFSET = DATA_PACKET_FORMAT_OFFSET + 4;

/**
 * Data Structure of Scan Configuration.
 *
 * @interface
 */
export interface ScanConfig {
  // 32-byte null-terminated string
  name: string;
  // 16 segments - structure TBD
  patternSegments: any[];
  // 0-16
  numPatternSegments: number;
  // 0-31
  repeatCount: number;
  // 0-31
  tailCount: number;
  // 0-511
  txStartDel: number;
  // flag
  trSwDelMode: boolean;
  // 0-500 microseconds - capture window start
  captureStartUs: number;
  // 0-500 microseconds - capture window end
  captureEndUs: number;
  // 16 angles - structure TBD
  angles: any[];
  // Actual number of angles used
  numAngles: number;
  // Total steps across all angles
  totalSteps?: number;
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
  // Changed from 'angle' to match C struct
  angleIndex: number;
  // Changed from 'step' to match C struct
  stepIndex: number;
  // Changed from 'channel' to match C struct
  channelIndex: number;
  sampleFormat: number;
  // Unpacked 10-bit ADC samples
  samples: number[];
}

export interface ScanData {
  scanId: number;
  metadata: MetadataPacket;
  // key: "angleIndex_stepIndex_channelIndex"
  dataPackets: Map<string, DataPacket>;
  isComplete: boolean;
  timestamp: number;
}

export const stm32h7_crc32 = (data: Uint32Array): number => {
  let crc32: number = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc32 = crc32 ^ (data[i] >>> 0);
    for (let j = 0; j < 32; j++) {
      if (crc32 & 0x80000000)
        // 0xB71DC104
        crc32 = ((crc32 << 1) >>> 0) ^ 0x04c11db7;
      else crc32 = (crc32 << 1) >>> 0;
    }
  }
  return crc32 >>> 0;
};

/**
 * @class
 */
export class UltrasonicDataParser {
  private buffer: Uint8Array = new Uint8Array(0);
  private currentScan: ScanData | null = null;
  // key: "bootId_scanId"
    private scans: Map<string, ScanData> = new Map();

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

  /**
   * A packet starts with a fixed size preamble (4 bytes of 0xA5), then a fixed size header (8 bytes),
   * then payload, then crc (uitn32_t).
   *
   * Header contains a type (first byte), a scanId (the next 3 bytes), and payload size (the last 4 bytes).
   *
   * CRC includes header but not preamble.
   */
  private tryParsePacket(): MetadataPacket | DataPacket | null {
    // Minimum packet size
    while (this.buffer.length >= 16) {
      const view = new DataView(this.buffer.buffer, this.buffer.byteOffset);
      // little endian
      const preamble = view.getUint32(0, true);
      if (preamble !== PACKET_PREAMBLE) {
        this.buffer = this.buffer.slice(1);
        continue;
      }

      const typeAndScanId = view.getUint32(4, true);
      const packetType = typeAndScanId & 0xff;

      // Validate packet type
      if (
        packetType !== 0x01 &&
        packetType !== 0x02 &&
        packetType !== 0x03 &&
        packetType !== 0x04
      ) {
        this.onParseError?.(
          `Invalid packet type: 0x${packetType.toString(16)}`,
          this.buffer.slice(0, Math.min(32, this.buffer.length))
        );
        // Skip this byte and try again
        this.buffer = this.buffer.slice(1);
        continue;
      }

      const scanId = (typeAndScanId >>> 8) & 0xffffff;
      // payload size
      const payloadSize = view.getUint32(8, true);

      // packetSize = header size + payload size, and crc but not preamble
      // packetSizeWithPreamble = packetSize + preamble size
      const packetSize =
        SIZEOF_PACKET_HEADER_T + payloadSize + SIZEOF_PACKET_CRC;
      const packetSizeWithPreamble = SIZEOF_PACKET_PREAMBLE + packetSize;

      console.log(`packetSize: ${packetSize}, payloadSize: ${payloadSize}`);

      if (this.buffer.length < packetSizeWithPreamble) {
        // Need more data;
        return null;
      }

      // strip off preamble as well as CRC, packetData starts from header (inclusive), ends at crc (exclusive).
      // these are offsets
      const headerStart = SIZEOF_PACKET_PREAMBLE;
      const crcStart = packetSizeWithPreamble - SIZEOF_PACKET_CRC;

      // header + paylaod, included for crc calculation
      const packetData = this.buffer.slice(headerStart, crcStart);
      const receivedCrc = view.getUint32(crcStart, true);

      // change to data format required by crc function
      const packetData32 = new Uint32Array(
        packetData.buffer,
        packetData.byteOffset,
        packetData.length / 4
      );
      const calculatedCrc = stm32h7_crc32(packetData32);

      if (receivedCrc !== calculatedCrc) {
        console.log(
          `CRC mismatch: calculated 0x${calculatedCrc.toString(
            16
          )}, got 0x${receivedCrc.toString(16)}`
        );
        this.buffer = this.buffer.slice(1);
        continue;
      } else {
        // console.log(`CRC match: 0x${calculatedCrc.toString(16).toUpperCase()}`);
      }

      // remove full packet from buffer
      this.buffer = this.buffer.slice(packetSizeWithPreamble);

      /**
       * Now packetData is header + payload
       * TODO: slice payload here and used by all branches?
       */
      if (packetType === 0x01) {
        const configData = packetData.slice(
          SIZEOF_PACKET_HEADER_T,
          SIZEOF_PACKET_HEADER_T + SIZEOF_META_PACKET_PAYLOAD
        );
        const scanConfig = this.parseScanConfig(configData);

        if (scanId === 0) {
          console.log(
            'testing (scan id = 0) metadata packet received',
            scanConfig
          );
          return null;
        }

        return {
          packetType: 0x01,
          scanId,
          scanConfig,
        };
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
            angleIndex,
            stepIndex,
            channelIndex,
            sampleFormat,
            samples,
          });
          return null;
        }

        // Validate sample count if we have scan configuration
        if (this.currentScan && this.currentScan.metadata) {
          const config = this.currentScan.metadata.scanConfig;
          const expectedSamples =
            20 * (config.captureEndUs - config.captureStartUs);

          if (samples.length !== expectedSamples) {
            console.warn(
              `Sample count mismatch: expected ${expectedSamples}, got ${samples.length} ` +
                `(capture window: ${config.captureStartUs}-${config.captureEndUs}μs)` +
                `(dataChunk.length: ${dataChunk.length})`
            );
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
      } else if (packetType == 0x03) {
        const configData = packetData.slice(
          SIZEOF_PACKET_HEADER_T,
          SIZEOF_PACKET_HEADER_T + SIZEOF_META2_PACKET_PAYLOAD
        );
        const scanConfig = this.parseScan2Config(configData);

        if (scanId === 0) {
          console.log(
            'testing (scan id = 0) metadata packet received',
            scanConfig
          );
          return null;
        }

        return {
          packetType: 0x01,
          scanId,
          scanConfig,
        };
      } else if (packetType == 0x04) {
        const payload = packetData.slice(SIZEOF_PACKET_HEADER_T);
        const decoder = new TextDecoder('ascii');
        const jsonStr = decoder.decode(payload);

        // console.log(`jsonStr length: ${jsonStr.length}`);
        console.log('jsonStr', jsonStr);

        try {
          const jconf = JSON.parse(jsonStr);

          const angles: any[] = [];
          let totalSteps = 0;

          for (let i = 0; i < jconf.angles.length; i++) {
            const { degree, steps } = jconf.angles[i];
            const label =
              degree === 1 ? `${degree} degree` : `${degree} degrees`;

            angles.push({
              label,
              numSteps: steps.length,
            });

            totalSteps += steps.length;
            console.log(
              `📊 Angle ${i}: ${steps.length} steps, label: "${label}"`
            );
          }

          console.log(
            `Total steps across ${angles.length} angles: ${totalSteps}`
          );
          console.log(`Baseline mode is off`);
          console.log(
            `Expected packets: ${totalSteps} steps × 64 channels = ${
              totalSteps * 64
            }`
          );

          const scanConfig: ScanConfig = {
            name: jconf.name || 'noname',
            patternSegments: [],
            numPatternSegments: jconf.pattern.length,
            repeatCount: jconf.repeat,
            tailCount: jconf.tail,
            txStartDel: jconf.txStartDel,
            trSwDelMode: false,
            captureStartUs: jconf.captureStartUs,
            captureEndUs: jconf.captureEndUs,
            angles,
            numAngles: jconf.angles.length,
            totalSteps,
            bfClk: 80000000,
            adcClk: 20000000,
            baseline: false, // forced
          };

          return {
            packetType: 0x01,
            scanId,
            scanConfig,
          };
        } catch (e) {
          console.log(e);
          return null;
        }
      } else {
        console.log(`unknown packetType ${packetType}`);
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
      throw new Error(
        `Scan config too short: ${configData.length} bytes, expected ${SIZEOF_META_PACKET_PAYLOAD}`
      );
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
    const name = new TextDecoder().decode(
      nameBytes.slice(0, nullIndex >= 0 ? nullIndex : 32)
    );

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
      // angles[16] starts at offset 8, each angle is 356 bytes
      const angleOffset = 8 + i * 356;
      // num_steps is first field (uint32_t)
      const numSteps = view.getUint32(angleOffset, true);

      // Parse label (32 bytes starting at angleOffset + 4)
      const labelBytes = configData.slice(angleOffset + 4, angleOffset + 36);
      const labelNullIndex = labelBytes.indexOf(0);
      const label = new TextDecoder().decode(
        labelBytes.slice(0, labelNullIndex >= 0 ? labelNullIndex : 32)
      );

      angles.push({
        numSteps,
        label,
      });

      totalSteps += numSteps;
      console.log(`📊 Angle ${i}: ${numSteps} steps, label: "${label}"`);
    }

    console.log(`Total steps across ${numAngles} angles: ${totalSteps}`);
    console.log(`Baseline mode is ${baseline ? 'on' : 'off'}`);
    console.log(
      `Expected packets: ${totalSteps} steps × ${
        baseline ? 65 : 64
      } channels = ${totalSteps * (baseline ? 65 : 64)}`
    );

    return {
      name,
      // Skip parsing pattern_segments for now
      patternSegments: [],
      numPatternSegments,
      repeatCount,
      tailCount,
      txStartDel,
      trSwDelMode,
      captureStartUs,
      captureEndUs,
      angles,
      numAngles,
      // Add this for easy access in checkScanComplete
      totalSteps,

      bfClk,
      adcClk,
      baseline,
    };
  }

  private parseScan2Config(configData: Uint8Array): ScanConfig {
    if (configData.length < SIZEOF_META2_PACKET_PAYLOAD) {
      throw new Error(
        `Scan config too short: ${configData.length} bytes, expected ${SIZEOF_META2_PACKET_PAYLOAD}`
      );
    }

    const view = new DataView(configData.buffer, configData.byteOffset);

    // Read basic fields
    const captureStartUs = view.getUint16(0, true);
    const captureEndUs = view.getUint16(2, true);
    const numAngles = view.getUint16(4, true);
    const numPatternSegments = view.getUint16(6, true);

    // Parse name from offset 13824 + 8
    const nameBytes = configData.slice(13824 + 8, 13824 + 8 + 32);
    const nullIndex = nameBytes.indexOf(0);
    const name = new TextDecoder().decode(
      nameBytes.slice(0, nullIndex >= 0 ? nullIndex : 32)
    );

    const trSwDelMode = view.getUint16(13824 + 8 + 48, true) !== 0;
    const repeatCount = view.getUint16(13824 + 8 + 48 + 2, true);
    const tailCount = view.getUint16(13824 + 8 + 48 + 4, true);
    const txStartDel = view.getUint16(13824 + 8 + 48 + 6, true);
    const bfClk = view.getUint32(13824 + 8 + 48 + 8, true);
    const adcClk = view.getUint32(13824 + 8 + 48 + 12, true);
    const baseline =
      ((view.getUint32(13824 + 8 + 48 + 16, true) >>> 0) & 1) === 1;

    // Parse angles array to get num_steps for each angle
    const angles: any[] = [];
    let totalSteps = 0;

    for (let i = 0; i < numAngles; i++) {
      // angles[MAX_ANGLES_PER_CONFIG] starts at offset 8, each angle is 144 bytes
      const angleOffset = 8 + i * 144;
      // num_steps is first field (uint32_t)
      const numSteps = view.getUint32(angleOffset, true);
      // delay_profile_index is second field
      const delayProfileIndex = view.getUint32(angleOffset + 4, true);

      // // Parse label (32 bytes starting at angleOffset + 4)
      // const labelBytes = configData.slice(angleOffset + 4, angleOffset + 36);
      // const labelNullIndex = labelBytes.indexOf(0);
      // const label = new TextDecoder().decode(labelBytes.slice(0, labelNullIndex >= 0 ? labelNullIndex : 32));

      angles.push({
        numSteps,
        delayProfileIndex,
      });

      totalSteps += numSteps;
      // console.log(`📊 Angle ${i}: ${numSteps} steps, label: "${label}"`);
    }

    console.log(`Total steps across ${numAngles} angles: ${totalSteps}`);
    console.log(`Baseline mode is ${baseline ? 'on' : 'off'}`);
    console.log(
      `Expected packets: ${totalSteps} steps × ${
        baseline ? 65 : 64
      } channels = ${totalSteps * (baseline ? 65 : 64)}`
    );

    return {
      name,
      // Skip parsing pattern_segments for now
      patternSegments: [],
      numPatternSegments,
      repeatCount,
      tailCount,
      txStartDel,
      trSwDelMode,
      captureStartUs,
      captureEndUs,
      angles,
      numAngles,
      // Add this for easy access in checkScanComplete
      totalSteps,

      bfClk,
      adcClk,
      baseline,
    };
  }

  private unpack10BitSamples(dataChunk: Uint8Array): number[] {
    const samples: number[] = [];

    // Process in groups of 10 bytes (8 samples each)
    for (let i = 0; i < dataChunk.length; i += 10) {
      // Incomplete group
      if (i + 9 >= dataChunk.length) break;

      // Extract 8 samples from 10 bytes
      const bytes = dataChunk.slice(i, i + 10);
      const group = this.extract8SamplesFrom10Bytes(bytes);
      samples.push(...group);
    }

    return samples;
  }

  private extract8SamplesFrom10Bytes(bytes: Uint8Array): number[] {
    const s0 = ((bytes[0] + bytes[1] * 256) >>> 0) & 0x000003ff;
    const s1 = ((bytes[1] + bytes[2] * 256) >>> 2) & 0x000003ff;
    const s2 = ((bytes[2] + bytes[3] * 256) >>> 4) & 0x000003ff;
    const s3 = ((bytes[3] + bytes[4] * 256) >>> 6) & 0x000003ff;
    const s4 = ((bytes[5] + bytes[6] * 256) >>> 0) & 0x000003ff;
    const s5 = ((bytes[6] + bytes[7] * 256) >>> 2) & 0x000003ff;
    const s6 = ((bytes[7] + bytes[8] * 256) >>> 4) & 0x000003ff;
    const s7 = ((bytes[8] + bytes[9] * 256) >>> 6) & 0x000003ff;
    return [s0, s1, s2, s3, s4, s5, s6, s7].map(x => x - 512);
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

      this.currentScan = {
        scanId: packet.scanId,
        metadata,
        dataPackets: new Map(),
        isComplete: false,
        timestamp: Date.now(),
      };

      this.scans.set(scanKey, this.currentScan);
      this.onMetadataReceived?.(metadata);
    } else if (packet.packetType === 0x02) {
      // Data packet
      const dataPacket = packet as DataPacket;

      const scan = this.scans.get(scanKey);
      if (!scan) {
        this.onParseError?.(
          `Received data packet without metadata for scan ${scanKey}`,
          new Uint8Array()
        );
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
    const totalExpectedSteps =
      config.totalSteps ||
      expectedStepsPerAngle.reduce((sum, steps) => sum + steps, 0);

    // Each step is transmitted on 64 channels (0-63)
    const expectedChannels = config.baseline ? 65 : 64;
    const totalExpectedPackets = totalExpectedSteps * expectedChannels;

    console.log(`Scan completion check:`);
    console.log(
      `   Expected: ${expectedAngles} angles, ${totalExpectedSteps} total steps, ${expectedChannels} channels`
    );
    console.log(`   Expected packets: ${totalExpectedPackets}`);
    console.log(`   Received packets: ${scan.dataPackets.size}`);
    console.log(
      `   Progress: ${(
        (scan.dataPackets.size / totalExpectedPackets) *
        100
      ).toFixed(1)}%`
    );

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

      console.log(
        `📊 Received ranges: angles 0-${maxAngleReceived}, steps 0-${maxStepReceived}, channels 0-${maxChannelReceived}`
      );

      // Verify we received data for all expected ranges
      // TODO: these code are verbose. need clean.
      const hasAllAngles = maxAngleReceived >= expectedAngles - 1;
      // Channels should be 0-63
      const hasAllChannels = maxChannelReceived >= 63;

      if (hasAllAngles && hasAllChannels) {
        scan.isComplete = true;

        console.log(
          `✅ Scan marked complete: ${scan.dataPackets.size}/${totalExpectedPackets} packets`
        );
        this.onScanComplete?.(scan);
      } else {
        console.log(
          `⏳ Scan not complete yet - missing ranges. All angles: ${hasAllAngles}, All channels: ${hasAllChannels}`
        );
      }
    } else {
      const progressPercent = (
        (scan.dataPackets.size / totalExpectedPackets) *
        100
      ).toFixed(1);
    }
  }

  private calculateCRC32(data: Uint8Array): number {
    // Standard IEEE 802.3 CRC-32 (original implementation)
    let crc = 0xffffffff;

    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 1) {
          // Reversed polynomial
          crc = (crc >>> 1) ^ 0xedb88320;
        } else {
          crc = crc >>> 1;
        }
      }
    }
    // Convert to unsigned 32-bit
    return ~crc >>> 0;
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
      // header + data + CRC
      return 14 + dataChunkSize + 4;
    }
    return null;
  }

  public getCurrentScan(): ScanData | null {
    return this.currentScan;
  }

  public getDisplayScan(): ScanData | null {
      return this.currentScan;
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
    this.scans.clear();
    this.buffer = new Uint8Array(0);
  }
}
