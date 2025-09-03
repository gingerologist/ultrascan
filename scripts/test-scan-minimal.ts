import * as net from 'net';
import {
  UltrasonicDataParser,
  MetadataPacket,
  DataPacket,
} from '../src/parser';

// Test configuration JSON
const testConfig = {
  version: '1.0',
  angles: [
    {
      degree: 0,
      masks: [0],
    },
  ],
  pattern: [
    [5, 2],
    [5, 1],
  ],
  repeat: 2,
  tail: 5,
  startUs: 40,
  endUs: 80,
};

class UltrasonicTester {
  private client: net.Socket;
  private parser: UltrasonicDataParser;
  private metadataReceived = false;
  private dataPacketReceived = false;
  private testStartTime: number;
  private readonly TIMEOUT_MS = 10000; // 10 seconds

  constructor(private ipAddress: string) {
    this.client = new net.Socket();
    this.parser = new UltrasonicDataParser();
    this.testStartTime = Date.now();

    this.setupParser();
    this.setupClient();
  }

  private setupParser(): void {
    this.parser.onMetadataReceived = (metadata: MetadataPacket) => {
      console.log('✅ Metadata packet received');
      console.log('📋 Scan Configuration:');
      console.log(JSON.stringify(metadata.scanConfig, null, 2));

      this.metadataReceived = true;

      // Start timeout for data packet after receiving metadata
      setTimeout(() => {
        if (!this.dataPacketReceived) {
          this.handleError(
            '❌ Timeout: No data packet received within 10 seconds after metadata'
          );
        }
      }, this.TIMEOUT_MS);
    };

    this.parser.onDataPacketReceived = (packet: DataPacket) => {
      console.log('✅ Data packet received');
      console.log(`📊 Data packet details:
   - Scan ID: ${packet.scanId}
   - Angle Index: ${packet.angleIndex}
   - Step Index: ${packet.stepIndex}
   - Channel Index: ${packet.channelIndex}
   - Sample Format: ${packet.sampleFormat}
   - Samples count: ${packet.samples.length}
   - First 10 samples: [${packet.samples.slice(0, 10).join(', ')}]`);

      this.dataPacketReceived = true;
      this.handleSuccess();
    };

    this.parser.onParseError = (error: string, data: Uint8Array) => {
      this.handleError(`❌ Parse error: ${error}`);
    };
  }

  private setupClient(): void {
    this.client.on('connect', () => {
      console.log(`🔗 Connected to ${this.ipAddress}:7332`);
      this.sendTestConfig();
    });

    this.client.on('data', (data: Buffer) => {
      console.log(`📥 Received ${data.length} bytes`);
      // Process data through parser
      this.parser.processData(new Uint8Array(data));
    });

    this.client.on('close', () => {
      console.log('🔌 Connection closed');
      if (!this.metadataReceived || !this.dataPacketReceived) {
        this.handleError('❌ Connection closed before test completion');
      }
    });

    this.client.on('error', err => {
      this.handleError(`❌ Connection error: ${err.message}`);
    });

    // Set overall timeout
    this.client.setTimeout(this.TIMEOUT_MS);
    this.client.on('timeout', () => {
      if (!this.metadataReceived) {
        this.handleError(
          '❌ Timeout: No metadata packet received within 10 seconds'
        );
      }
    });
  }

  private sendTestConfig(): void {
    const jsonString = JSON.stringify(testConfig) + '\n';
    console.log('📤 Sending test configuration:');
    console.log(jsonString.trim());

    this.client.write(jsonString);
    console.log('⏳ Waiting for response...');
  }

  private handleSuccess(): void {
    const duration = Date.now() - this.testStartTime;
    console.log(`🎉 Test completed successfully in ${duration}ms`);
    console.log('✅ Both metadata and data packets received');
    this.client.end();
    process.exit(0);
  }

  private handleError(message: string): void {
    const duration = Date.now() - this.testStartTime;
    console.error(`${message} (after ${duration}ms)`);
    this.client.destroy();
    process.exit(1);
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`🚀 Starting ultrasonic data test`);
        console.log(`🎯 Target: ${this.ipAddress}:7332`);
        this.client.connect(7332, this.ipAddress);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Main execution
async function main(): Promise<void> {
  const ipAddress = process.argv[2];

  if (!ipAddress) {
    console.error('❌ Usage: tsx scripts/test.ts <ip_address>');
    console.error('❌ Example: tsx scripts/test.ts 192.168.1.100');
    process.exit(1);
  }

  console.log('🔬 Ultrasonic Data Parser Test');
  console.log('===============================');

  try {
    const tester = new UltrasonicTester(ipAddress);
    await tester.start();
  } catch (error) {
    console.error('❌ Failed to start test:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', error => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

main().catch(error => {
  console.error('❌ Main execution failed:', error);
  process.exit(1);
});
