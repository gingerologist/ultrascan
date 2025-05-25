// Ultrasonic detection system data parser
// Based on C structures from firmware

/*
C Structure Definitions (for reference):

// Packet type definitions
typedef enum {
    PACKET_TYPE_METADATA = 0x01,
    PACKET_TYPE_DATA     = 0x02
} packet_type_t;

// Metadata packet header
typedef struct __attribute__((packed)) {
    uint8_t  packet_type;       // PACKET_TYPE_METADATA (0x01)
    uint32_t boot_id;           // Random boot identifier (from TRNG)
    uint32_t scan_id;           // Sequential scan identifier (0, 1, 2, ...)
    uint16_t length;            // Total packet length including header and CRC
    // Followed by: scan_conf_t data, then uint32_t crc
} meta_packet_header_t;

// Data packet header
typedef struct __attribute__((packed)) {
    uint8_t  packet_type;       // PACKET_TYPE_DATA (0x02)
    uint32_t boot_id;           // Random boot identifier (matches metadata)
    uint32_t scan_id;           // Sequential scan identifier (matches metadata)
    uint16_t length;            // Total packet length including header and CRC
    uint8_t  angle_index;       // Angle index within scan (0-15)
    uint8_t  step_index;        // Step index within angle (0-63)
    uint8_t  channel_index;     // Channel index (0-63)
    // Followed by: data chunk, then uint32_t crc
} data_packet_header_t;

// Scan configuration structure
typedef struct {
    char name[32];                        // 31-character scan name + null terminator
    TX7332_SEGMENT_t pattern_segments[16]; // Array of pattern segments
    uint8_t num_pattern_segments;         // Actual number of segments used (0-16)
    uint8_t repeat_count;                 // Waveform repeat count (0-31, 5-bit field)
    uint8_t tail_count;                   // Ground padding clocks (0-31, 5-bit field)
    uint16_t tx_start_del;                // TX_START_DEL value (9-bit field, 0-511)
    bool tr_sw_del_mode;                  // TR_SW_DEL_MODE flag (defaults to false)
    // NEW: Capture window configuration
    uint16_t capture_start_us;            // Capture window start time in microseconds (0-500)
    uint16_t capture_end_us;              // Capture window end time in microseconds (0-500)
    scan_angle_t angles[16];              // Up to 16 angles per scan
    uint8_t num_angles;                   // Actual number of angles used
} scan_conf_t;

Static_assert(sizeof(meta_packet_header_t) == 11, "meta_packet_header_t must be 11 bytes");
Static_assert(sizeof(data_packet_header_t) == 14, "data_packet_header_t must be 14 bytes");
*/

export interface ScanConfig {
    name: string;                    // 32-byte null-terminated string
    patternSegments: any[];          // 16 segments - structure TBD
    numPatternSegments: number;      // 0-16
    repeatCount: number;             // 0-31
    tailCount: number;               // 0-31
    txStartDel: number;              // 0-511
    trSwDelMode: boolean;            // flag
    captureStartUs: number;          // 0-500 microseconds
    captureEndUs: number;            // 0-500 microseconds
    angles: any[];                   // 16 angles - structure TBD
    numAngles: number;               // Actual number of angles used
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
  
  export class UltrasonicDataParser {
    private buffer: Uint8Array = new Uint8Array(0);
    private currentScan: ScanData | null = null;
    private scans: Map<string, ScanData> = new Map(); // key: "bootId_scanId"
    
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
          break; // Need more data
        }
        
        this.handlePacket(packet);
      }
    }
  
    private tryParsePacket(): MetadataPacket | DataPacket | null {
      // Minimum packet sizes: metadata=11+4=15, data=14+4=18
      if (this.buffer.length < 15) {
        return null;
      }
  
      const view = new DataView(this.buffer.buffer, this.buffer.byteOffset);
      
      // Read header
      const packetType = view.getUint8(0);
      const bootId = view.getUint32(1, true); // little-endian
      const scanId = view.getUint32(5, true);
      const length = view.getUint16(9, true);
  
      // Validate packet type
      if (packetType !== 0x01 && packetType !== 0x02) {
        this.onParseError?.(`Invalid packet type: 0x${packetType.toString(16)}`, this.buffer.slice(0, Math.min(32, this.buffer.length)));
        // Skip this byte and try again
        this.buffer = this.buffer.slice(1);
        return null;
      }
  
      // Check if we have complete packet
      if (this.buffer.length < length) {
        return null; // Need more data
      }
  
      // Verify length is reasonable
      if (length < 15 || length > 8192) { // Sanity check
        this.onParseError?.(`Invalid packet length: ${length}`, this.buffer.slice(0, Math.min(32, this.buffer.length)));
        this.buffer = this.buffer.slice(1);
        return null;
      }
  
      // Extract complete packet
      const packetData = this.buffer.slice(0, length);
      const headerAndPayload = packetData.slice(0, length - 4);
      const receivedCrc = view.getUint32(length - 4, true);
      
      // Verify CRC32
      const calculatedCrc = this.calculateCRC32(headerAndPayload);
      if (receivedCrc !== calculatedCrc) {
        this.onParseError?.(`CRC mismatch: expected 0x${calculatedCrc.toString(16)}, got 0x${receivedCrc.toString(16)}`, packetData);
        // Skip this byte and try again
        this.buffer = this.buffer.slice(1);
        return null;
      }
  
      // Remove packet from buffer
      this.buffer = this.buffer.slice(length);
  
      // Parse based on packet type
      if (packetType === 0x01) {
        return this.parseMetadataPacket(packetData, view, bootId, scanId, length, receivedCrc);
      } else if (packetType === 0x02) {
        return this.parseDataPacket(packetData, view, bootId, scanId, length, receivedCrc);
      }
  
      return null;
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
      if (configData.length < 32) {
        throw new Error(`Scan config too short: ${configData.length} bytes`);
      }
  
      const view = new DataView(configData.buffer, configData.byteOffset);
      let offset = 0;
      
      // Parse name (32 bytes, null-terminated)
      const nameBytes = configData.slice(offset, offset + 32);
      const nullIndex = nameBytes.indexOf(0);
      const name = new TextDecoder().decode(nameBytes.slice(0, nullIndex >= 0 ? nullIndex : 32));
      offset += 32;
      
      // Skip pattern_segments[16] for now - structure depends on TX7332_SEGMENT_t
      // Assuming each segment is some fixed size, we'll skip for now
      const patternSegments: any[] = []; // TODO: Parse based on TX7332_SEGMENT_t definition
      offset += 16 * 8; // Assuming 8 bytes per segment - adjust as needed
      
      if (offset >= configData.length) {
        throw new Error('Scan config data truncated');
      }
      
      const numPatternSegments = view.getUint8(offset++);
      const repeatCount = view.getUint8(offset++);
      const tailCount = view.getUint8(offset++);
      const txStartDel = view.getUint16(offset, true); offset += 2;
      const trSwDelMode = view.getUint8(offset++) !== 0;
      const captureStartUs = view.getUint16(offset, true); offset += 2;
      const captureEndUs = view.getUint16(offset, true); offset += 2;
      
      // Skip angles[16] for now - structure depends on scan_angle_t
      const angles: any[] = []; // TODO: Parse based on scan_angle_t definition
      offset += 16 * 4; // Assuming 4 bytes per angle - adjust as needed
      
      if (offset < configData.length) {
        const numAngles = view.getUint8(offset++);
        
        return {
          name,
          patternSegments,
          numPatternSegments,
          repeatCount,
          tailCount,
          txStartDel,
          trSwDelMode,
          captureStartUs,
          captureEndUs,
          angles,
          numAngles
        };
      }
      
      throw new Error('Scan config parsing failed - insufficient data');
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
  
    private checkScanComplete(scan: ScanData): void {
      if (scan.isComplete) return;
      
      const config = scan.metadata.scanConfig;
      const expectedPackets = config.numAngles * 64 * 64; // numAngles * 64 steps * 64 channels
      
      if (scan.dataPackets.size >= expectedPackets) {
        scan.isComplete = true;
        this.onScanComplete?.(scan);
      }
    }
  
    private calculateCRC32(data: Uint8Array): number {
      // Standard CRC-32 (IEEE 802.3) polynomial: 0x04C11DB7
      // This should match your hardware CRC implementation
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
    public getCurrentScan(): ScanData | null {
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
  }