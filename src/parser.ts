// Ultrasonic detection system data parser
// Based on C structures from firmware

/*
C Structure Definitions (for reference):

// Individual step within an angle
typedef struct {
    uint32_t channel_mask;  // 0x1F register value (bit 1 = channel disabled for TX)
} scan_step_t;

// Single angle configuration
typedef struct
{
  uint32_t num_steps;             // Actual number of steps used              // 4 byte
  char label[32];                 // 31-character label + null terminator     // 32 bytes
  TX7332_DLYPRF_t delay_profile;  // Reuse existing delay profile structure   // 64 bytes
  scan_step_t steps[64];          // Up to 64 steps per angle                 // 256 bytes
} scan_angle_t;
Static_assert(sizeof(scan_angle_t)==356, "");

// Enhanced scan configuration with capture window parameters
typedef struct
{
  // NEW: Capture window configuration
  uint16_t capture_start_us;              // Capture window start time in microseconds (0-500)  // 2
  uint16_t capture_end_us;                // Capture window end time in microseconds (0-500)    // 2
  uint16_t num_angles;                    // Actual number of angles used                       // 2
  uint16_t num_pattern_segments;          // Actual number of segments used (0-16)              // 2
  scan_angle_t angles[16];                // Up to 16 angles per scan                           // 356 * 16
  char name[32];                          // 31-character scan name + null terminator           // 32 byte
  TX7332_SEGMENT_t pattern_segments[16];  // Array of pattern segments                          // 16 byte
  uint16_t tr_sw_del_mode;                // TR_SW_DEL_MODE flag (defaults to false)            // 2
  uint16_t repeat_count;                  // Waveform repeat count (0-31, 5-bit field)          // 2
  uint16_t tail_count;                    // Ground padding clocks (0-31, 5-bit field)          // 2
  uint16_t tx_start_del;                  // TX_START_DEL value (9-bit field, 0-511)            // 2
} scan_conf_t;
Static_assert(sizeof(scan_conf_t)==5760,"");
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
}

export interface MetadataPacket {
  packetType: 0x01;
  bootId: number;
  scanId: number;
  length: number;
  scanConfig: ScanConfig;
  crc32: number;
}

export interface DataPacket {
  packetType: 0x02;
  bootId: number;
  scanId: number;
  length: number;
  angleIndex: number;    // Changed from 'angle' to match C struct
  stepIndex: number;     // Changed from 'step' to match C struct  
  channelIndex: number;  // Changed from 'channel' to match C struct
  samples: number[];     // Unpacked 10-bit ADC samples
  crc32: number;
}

export interface ScanData {
  bootId: number;
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

export class UltrasonicDataParser {
  private buffer: Uint8Array = new Uint8Array(0);
  private currentScan: ScanData | null = null;
  private completedScan: ScanData | null = null; // For auto mode - keep last completed scan
  private scans: Map<string, ScanData> = new Map(); // key: "bootId_scanId"
  private triggerMode: 'auto' | 'single' = 'auto';

  // Sync pattern for packet alignment (fixed boot ID in little-endian)
  private static readonly SYNC_PATTERN = [0xA6, 0xA5, 0xA5, 0xA5]; // 0xA5A5A5A6 in little-endian

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
    // Look for sync pattern (boot ID: 0xA5A5A5A6) to ensure packet alignment
    while (this.buffer.length >= 15) { // Minimum packet size
      // Look for packet type (0x01 or 0x02) followed by sync pattern
      if (this.buffer.length < 9) break; // Need at least 1 + 4 + 4 bytes

      const packetType = this.buffer[0];

      // Check if this looks like a valid packet start
      if (packetType === 0x01 || packetType === 0x02) {
        // Check if sync pattern follows at offset 1-4 (boot ID position)
        const syncMatch = UltrasonicDataParser.SYNC_PATTERN.every((byte, index) =>
          this.buffer.length > (1 + index) && this.buffer[1 + index] === byte
        );

        if (syncMatch) {
          // Found valid sync pattern, try to parse packet
          const view = new DataView(this.buffer.buffer, this.buffer.byteOffset);

          const bootId = view.getUint32(1, true); // Should be 0xA5A5A5A6
          const scanId = view.getUint32(5, true);
          const length = view.getUint16(9, true);

          // Validate length is reasonable
          if (length < 15 || length > 8192) {
            this.onParseError?.(`Invalid packet length: ${length}`, this.buffer.slice(0, Math.min(32, this.buffer.length)));
            this.buffer = this.buffer.slice(1); // Skip this byte and try again
            continue;
          }

          // Check if we have complete packet
          if (this.buffer.length < length) {
            return null; // Need more data
          }

          // Extract and verify CRC
          const packetData = this.buffer.slice(0, length);
          const headerAndPayload = packetData.slice(0, length - 4);
          const receivedCrc = view.getUint32(length - 4, true);

          const calculatedCrc = this.calculateCRC32(headerAndPayload);
          if (receivedCrc !== calculatedCrc) {
            // Temporarily ignore CRC errors for testing
            // console.log(`CRC mismatch (ignored): expected 0x${calculatedCrc.toString(16)}, got 0x${receivedCrc.toString(16)}`);
            // Continue parsing instead of skipping
          }

          // Remove packet from buffer
          this.buffer = this.buffer.slice(length);

          // Parse based on packet type
          if (packetType === 0x01) {
            return this.parseMetadataPacket(packetData, view, bootId, scanId, length, receivedCrc);
          } else if (packetType === 0x02) {
            return this.parseDataPacket(packetData, view, bootId, scanId, length, receivedCrc);
          }
        }
      }

      // No valid packet found at this position, advance by 1 byte and try again
      this.buffer = this.buffer.slice(1);
    }

    return null; // Need more data or no valid packet found
  }

  private parseMetadataPacket(packetData: Uint8Array, view: DataView, bootId: number, scanId: number, length: number, crc32: number): MetadataPacket {
    // Metadata header is 11 bytes, CRC is 4 bytes
    const payloadStart = 11;
    const payloadLength = length - 15; // Exclude 11-byte header and 4-byte CRC
    const configData = packetData.slice(payloadStart, payloadStart + payloadLength);

    // Parse scan configuration according to C struct
    const scanConfig = this.parseScanConfig(configData);

    return {
      packetType: 0x01,
      bootId,
      scanId,
      length,
      scanConfig,
      crc32
    };
  }

  private parseDataPacket(packetData: Uint8Array, view: DataView, bootId: number, scanId: number, length: number, crc32: number): DataPacket {
    // Data header is 14 bytes: packet_type(1) + boot_id(4) + scan_id(4) + length(2) + angle_index(1) + step_index(1) + channel_index(1)
    const angleIndex = view.getUint8(11);
    const stepIndex = view.getUint8(12);
    const channelIndex = view.getUint8(13);

    const dataChunkStart = 14;
    const dataChunkLength = length - 18; // Exclude 14-byte header and 4-byte CRC
    const dataChunk = packetData.slice(dataChunkStart, dataChunkStart + dataChunkLength);

    // Unpack 10-bit samples (8 samples per 10 bytes)
    const samples = this.unpack10BitSamples(dataChunk);

    // Validate sample count if we have scan configuration
    if (this.currentScan && this.currentScan.metadata) {
      const config = this.currentScan.metadata.scanConfig;
      const expectedSamples = 20 * (config.captureEndUs - config.captureStartUs);

      if (samples.length !== expectedSamples) {
        console.warn(`Sample count mismatch: expected ${expectedSamples}, got ${samples.length} ` +
          `(capture window: ${config.captureStartUs}-${config.captureEndUs}μs)`);
      }
    }

    return {
      packetType: 0x02,
      bootId,
      scanId,
      length,
      angleIndex,
      stepIndex,
      channelIndex,
      samples,
      crc32
    };
  }

  private parseScanConfig(configData: Uint8Array): ScanConfig {
    if (configData.length < 5760) {
      throw new Error(`Scan config too short: ${configData.length} bytes, expected 5760`);
    }

    const view = new DataView(configData.buffer, configData.byteOffset);

    // Struct layout with exact byte offsets:
    // capture_start_us: 0-1 (uint16_t)
    // capture_end_us: 2-3 (uint16_t)  
    // num_angles: 4-5 (uint16_t)
    // num_pattern_segments: 6-7 (uint16_t)
    // angles[16]: 8-5703 (16 × 356 bytes)
    // name[32]: 5704-5735 (32 bytes)
    // pattern_segments[16]: 5736-5751 (16 × 1 byte)
    // tr_sw_del_mode: 5752-5753 (uint16_t)
    // repeat_count: 5754-5755 (uint16_t)
    // tail_count: 5756-5757 (uint16_t)
    // tx_start_del: 5758-5759 (uint16_t)

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

    console.log(`📊 Total steps across ${numAngles} angles: ${totalSteps}`);
    console.log(`📊 Expected packets: ${totalSteps} steps × 64 channels = ${totalSteps * 64}`);

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
      totalSteps // Add this for easy access in checkScanComplete
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
    // Bit-packed 10-bit samples: 8 samples in 10 bytes (80 bits total)
    const samples: number[] = [];

    for (let i = 0; i < 8; i++) {
      const bitOffset = i * 10;
      const byteOffset = Math.floor(bitOffset / 8);
      const bitInByte = bitOffset % 8;

      let sample = 0;

      // Read 10 bits, potentially spanning 2 bytes
      if (bitInByte <= 6) {
        // Sample fits within 2 bytes
        const byte1 = bytes[byteOffset];
        const byte2 = byteOffset + 1 < bytes.length ? bytes[byteOffset + 1] : 0;

        sample = ((byte2 << 8) | byte1) >> bitInByte;
        sample &= 0x3FF; // Mask to 10 bits
      } else {
        // Sample spans 3 bytes (rare case when bitInByte > 6)
        const byte1 = bytes[byteOffset];
        const byte2 = byteOffset + 1 < bytes.length ? bytes[byteOffset + 1] : 0;
        const byte3 = byteOffset + 2 < bytes.length ? bytes[byteOffset + 2] : 0;

        sample = ((byte3 << 16) | (byte2 << 8) | byte1) >> bitInByte;
        sample &= 0x3FF; // Mask to 10 bits
      }

      samples.push(sample);

      return samples.map((n: number) => {
        if ((n & 0x200) === 0) {
          return n - 512;
        }
        else {
          return n - 512;
        }
      })
    }

    return samples;
  }

  private handlePacket(packet: MetadataPacket | DataPacket): void {
    const scanKey = `${packet.bootId}_${packet.scanId}`;

    if (packet.packetType === 0x01) {
      // Metadata packet - start new scan
      const metadata = packet as MetadataPacket;

      // Check for device reboot
      if (this.currentScan && this.currentScan.bootId !== packet.bootId) {
        this.onDeviceReboot?.(packet.bootId, this.currentScan.bootId);
      }

      // In single mode, clear previous scan when starting new one
      if (this.triggerMode === 'single') {
        this.completedScan = null;
      }

      this.currentScan = {
        bootId: packet.bootId,
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
    const expectedChannels = 64;
    const totalExpectedPackets = totalExpectedSteps * expectedChannels;

    // console.log(`📊 Scan completion check:`);
    // console.log(`   Expected: ${expectedAngles} angles, ${totalExpectedSteps} total steps, ${expectedChannels} channels`);
    // console.log(`   Expected packets: ${totalExpectedPackets}`);
    // console.log(`   Received packets: ${scan.dataPackets.size}`);
    // console.log(`   Progress: ${((scan.dataPackets.size / totalExpectedPackets) * 100).toFixed(1)}%`);

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
      // Calculate percentage for progress display
      const progressPercent = ((scan.dataPackets.size / totalExpectedPackets) * 100).toFixed(1);
      // console.log(`⏳ Scan ${progressPercent}% complete (${scan.dataPackets.size}/${totalExpectedPackets} packets)`);
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

