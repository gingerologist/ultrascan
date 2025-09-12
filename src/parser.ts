// Simplified ultrasonic detection system data parser
// All-or-none approach - only emits complete scan data

const PACKET_PREAMBLE = 0xa5a5a5a5;
const SIZEOF_PACKET_PREAMBLE = 4;
const SIZEOF_PACKET_HEADER_T = 8;
const SIZEOF_DATA_PACKET_HEADER_T = SIZEOF_PACKET_HEADER_T + 4;
const SIZEOF_PACKET_CRC = 4;

const DATA_PACKET_ANGLE_OFFSET =
  SIZEOF_PACKET_PREAMBLE + SIZEOF_PACKET_HEADER_T;
const DATA_PACKET_STEP_OFFSET = DATA_PACKET_ANGLE_OFFSET + 1;
const DATA_PACKET_CHANNEL_OFFSET = DATA_PACKET_STEP_OFFSET + 1;
const DATA_PACKET_FORMAT_OFFSET = DATA_PACKET_CHANNEL_OFFSET + 1;
const DATA_PACKET_CHUNK_OFFSET = DATA_PACKET_FORMAT_OFFSET + 4;

export interface ScanConfig {
  name: string;
  captureStartUs: number;
  captureEndUs: number;
  angles: { label: string; numSteps: number }[];
  numAngles: number;
  totalSteps: number;
}

export interface ChannelData {
  index: number;
  samples: number[];
}

export interface StepData {
  index: number;
  channels: ChannelData[];
}

export interface AngleData {
  index: number;
  label: string;
  steps: StepData[];
}

export interface CompleteScanData {
  scanId: number;
  config: ScanConfig;
  angles: AngleData[];
}

export interface DataPacket {
  scanId: number;
  angleIndex: number;
  stepIndex: number;
  channelIndex: number;
  samples: number[];
}

interface CurrentScan {
  scanId: number;
  config: ScanConfig;
  dataPackets: Map<string, DataPacket>;
  totalExpectedPackets: number;
}

export const stm32h7_crc32 = (data: Uint32Array): number => {
  let crc32: number = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc32 = crc32 ^ (data[i] >>> 0);
    for (let j = 0; j < 32; j++) {
      if (crc32 & 0x80000000) crc32 = ((crc32 << 1) >>> 0) ^ 0x04c11db7;
      else crc32 = (crc32 << 1) >>> 0;
    }
  }
  return crc32 >>> 0;
};

export class UltrasonicDataParser {
  private buffer: Uint8Array = new Uint8Array(0);
  private currentScan: CurrentScan | null = null;

  // Callback for complete scan data
  public onScanComplete?: (scanData: CompleteScanData) => void;
  public onParseError?: (error: string) => void;
  public onConfig?: (cfg: ScanConfig) => void;
  public onPacketReceived?: (num: number) => void;

  public processData(newData: Uint8Array): void {
    const combined = new Uint8Array(this.buffer.length + newData.length);
    combined.set(this.buffer);
    combined.set(newData, this.buffer.length);
    this.buffer = combined;

    while (this.buffer.length > 0) {
      const packet = this.tryParsePacket();
      if (!packet) break;
      this.handlePacket(packet);
    }
  }

  private tryParsePacket():
    | { type: 'metadata'; scanId: number; config: ScanConfig }
    | { type: 'data'; packet: DataPacket }
    | null {
    while (this.buffer.length >= 16) {
      const view = new DataView(this.buffer.buffer, this.buffer.byteOffset);
      const preamble = view.getUint32(0, true);

      if (preamble !== PACKET_PREAMBLE) {
        this.buffer = this.buffer.slice(1);
        continue;
      }

      const typeAndScanId = view.getUint32(4, true);
      const packetType = typeAndScanId & 0xff;

      // Only handle metadata (0x04) and data (0x02) packets
      if (packetType !== 0x02 && packetType !== 0x04) {
        this.buffer = this.buffer.slice(1);
        continue;
      }

      const scanId = (typeAndScanId >>> 8) & 0xffffff;
      const payloadSize = view.getUint32(8, true);
      const packetSizeWithPreamble =
        SIZEOF_PACKET_PREAMBLE +
        SIZEOF_PACKET_HEADER_T +
        payloadSize +
        SIZEOF_PACKET_CRC;

      if (this.buffer.length < packetSizeWithPreamble) {
        return null; // Need more data
      }

      // Verify CRC
      const headerStart = SIZEOF_PACKET_PREAMBLE;
      const crcStart = packetSizeWithPreamble - SIZEOF_PACKET_CRC;
      const packetData = this.buffer.slice(headerStart, crcStart);
      const receivedCrc = view.getUint32(crcStart, true);
      const packetData32 = new Uint32Array(
        packetData.buffer,
        packetData.byteOffset,
        packetData.length / 4
      );
      const calculatedCrc = stm32h7_crc32(packetData32);

      if (receivedCrc !== calculatedCrc) {
        this.buffer = this.buffer.slice(1);
        continue;
      }

      this.buffer = this.buffer.slice(packetSizeWithPreamble);

      if (packetType === 0x04) {
        // JSON metadata packet
        const payload = packetData.slice(SIZEOF_PACKET_HEADER_T);
        const jsonStr = new TextDecoder('ascii').decode(payload);

        try {
          const jconf = JSON.parse(jsonStr);
          const angles: { label: string; numSteps: number }[] = [];
          let totalSteps = 0;

          for (const angleConf of jconf.angles) {
            const { degree, steps } = angleConf;
            const label =
              degree === 1 ? `${degree} degree` : `${degree} degrees`;
            angles.push({ label, numSteps: steps.length });
            totalSteps += steps.length;
          }

          const config: ScanConfig = {
            name: jconf.name || 'noname',
            captureStartUs: jconf.captureStartUs,
            captureEndUs: jconf.captureEndUs,
            angles,
            numAngles: jconf.angles.length,
            totalSteps,
          };

          return { type: 'metadata', scanId, config };
        } catch (e) {
          this.onParseError?.(`Failed to parse JSON metadata: ${e}`);
          return null;
        }
      } else if (packetType === 0x02) {
        // Data packet
        if (scanId === 0) return null; // Skip test packets

        const angleIndex = view.getUint8(DATA_PACKET_ANGLE_OFFSET);
        const stepIndex = view.getUint8(DATA_PACKET_STEP_OFFSET);
        const channelIndex = view.getUint8(DATA_PACKET_CHANNEL_OFFSET);
        const dataChunk = packetData.slice(SIZEOF_DATA_PACKET_HEADER_T);
        const samples = this.unpack10BitSamples(dataChunk);

        return {
          type: 'data',
          packet: { scanId, angleIndex, stepIndex, channelIndex, samples },
        };
      }
    }

    return null;
  }

  private handlePacket(
    packet:
      | { type: 'metadata'; scanId: number; config: ScanConfig }
      | { type: 'data'; packet: DataPacket }
  ): void {
    if (packet.type === 'metadata') {
      // Start new scan
      this.currentScan = {
        scanId: packet.scanId,
        config: packet.config,
        dataPackets: new Map(),
        totalExpectedPackets: packet.config.totalSteps * 64, // 64 channels, no baseline
      };

      console.log(
        'parser, handle metadata packet',
        packet.config,
        this.onConfig
      );

      this.onConfig?.(packet.config);
    } else if (packet.type === 'data') {
      // Handle data packet
      if (
        !this.currentScan ||
        this.currentScan.scanId !== packet.packet.scanId
      ) {
        return; // No active scan or wrong scan
      }

      const dataKey = `${packet.packet.angleIndex}_${packet.packet.stepIndex}_${packet.packet.channelIndex}`;
      this.currentScan.dataPackets.set(dataKey, packet.packet);

      this.onPacketReceived?.(this.currentScan.dataPackets.size);

      // Check if scan is complete
      if (
        this.currentScan.dataPackets.size >=
        this.currentScan.totalExpectedPackets
      ) {
        this.completeScan();
      }
    }
  }

  private completeScan(): void {
    if (!this.currentScan) return;

    const angles: AngleData[] = [];
    const config = this.currentScan.config;

    // Transform data into structured format
    for (let angleIndex = 0; angleIndex < config.numAngles; angleIndex++) {
      const angleConfig = config.angles[angleIndex];
      const steps: StepData[] = [];

      for (let stepIndex = 0; stepIndex < angleConfig.numSteps; stepIndex++) {
        const channels: ChannelData[] = [];

        for (let channelIndex = 0; channelIndex < 64; channelIndex++) {
          const dataKey = `${angleIndex}_${stepIndex}_${channelIndex}`;
          const packet = this.currentScan.dataPackets.get(dataKey);

          if (packet?.samples) {
            channels.push({
              index: channelIndex,
              samples: [...packet.samples],
            });
          }
        }

        if (channels.length > 0) {
          steps.push({ index: stepIndex, channels });
        }
      }

      if (steps.length > 0) {
        angles.push({
          index: angleIndex,
          label: angleConfig.label,
          steps,
        });
      }
    }

    const completeScanData: CompleteScanData = {
      scanId: this.currentScan.scanId,
      config: this.currentScan.config,
      angles,
    };

    this.onScanComplete?.(completeScanData);
    this.currentScan = null; // Reset for next scan
  }

  private unpack10BitSamples(dataChunk: Uint8Array): number[] {
    const samples: number[] = [];

    for (let i = 0; i < dataChunk.length; i += 10) {
      if (i + 9 >= dataChunk.length) break;
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

  public reset(): void {
    this.currentScan = null;
    this.buffer = new Uint8Array(0);
  }
}
