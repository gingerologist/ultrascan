export {}; // Make this file a module

// Import the parser
import { UltrasonicDataParser, MetadataPacket, DataPacket, ScanData } from './parser';

// Web Serial API type definitions
declare global {
  interface Navigator {
    serial: {
      getPorts(): Promise<SerialPort[]>;
      requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
    };
  }
  
  interface SerialPort {
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    getInfo(): SerialPortInfo;
    readable: ReadableStream<Uint8Array> | null;
  }
  
  interface SerialPortInfo {
    usbVendorId?: number;
    usbProductId?: number;
  }
  
  interface SerialOptions {
    baudRate: number;
    dataBits?: number;
    parity?: 'none' | 'even' | 'odd';
    stopBits?: number;
  }
  
  interface SerialPortRequestOptions {
    filters?: Array<{
      usbVendorId?: number;
      usbProductId?: number;
    }>;
  }
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
type TriggerMode = 'auto' | 'single';

class UltrasonicScannerInterface {
  // Serial port management
  private portSelect: HTMLSelectElement;
  private connectButton: HTMLButtonElement;
  private disconnectButton: HTMLButtonElement;
  private connectionStatus: HTMLElement;
  
  // Trigger controls
  private triggerModeRadios: NodeListOf<HTMLInputElement>;
  private runStopButton: HTMLButtonElement;
  
  // Display elements
  private bootIdEl: HTMLElement;
  private scanIdEl: HTMLElement;
  private scanNameEl: HTMLElement;
  private numAnglesEl: HTMLElement;
  private dataPacketCountEl: HTMLElement;
  private expectedPacketsEl: HTMLElement;
  private progressFill: HTMLElement;
  private scanResult: HTMLElement;
  private scanCounter: HTMLElement;
  
  // State
  private availablePorts: SerialPort[] = [];
  private selectedPort: SerialPort | null = null;
  private connectedPort: SerialPort | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private pollingTimer: number | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  
  // Parser and trigger mode
  private dataParser: UltrasonicDataParser;
  private triggerMode: TriggerMode = 'auto';
  private isRunning: boolean = false;
  private scanCount: number = 0;
  private currentScanData: ScanData | null = null;
  private waitingForScan: boolean = false;

  constructor() {
    // Get DOM elements with null checks
    this.portSelect = document.getElementById('portSelect') as HTMLSelectElement;
    this.connectButton = document.getElementById('connectButton') as HTMLButtonElement;
    this.disconnectButton = document.getElementById('disconnectButton') as HTMLButtonElement;
    this.connectionStatus = document.getElementById('connectionStatus') as HTMLElement;
    
    this.triggerModeRadios = document.querySelectorAll('input[name="triggerMode"]') as NodeListOf<HTMLInputElement>;
    this.runStopButton = document.getElementById('runStopButton') as HTMLButtonElement;
    
    this.bootIdEl = document.getElementById('bootId') as HTMLElement;
    this.scanIdEl = document.getElementById('scanId') as HTMLElement;
    this.scanNameEl = document.getElementById('scanName') as HTMLElement;
    this.numAnglesEl = document.getElementById('numAngles') as HTMLElement;
    this.dataPacketCountEl = document.getElementById('dataPacketCount') as HTMLElement;
    this.expectedPacketsEl = document.getElementById('expectedPackets') as HTMLElement;
    this.progressFill = document.getElementById('progressFill') as HTMLElement;
    this.scanResult = document.getElementById('scanResult') as HTMLElement;
    this.scanCounter = document.getElementById('scanCounter') as HTMLElement;

    // Check if all required elements were found
    if (!this.portSelect || !this.connectButton || !this.disconnectButton || !this.connectionStatus ||
        !this.runStopButton || !this.bootIdEl || !this.scanIdEl || !this.scanNameEl || 
        !this.numAnglesEl || !this.dataPacketCountEl || !this.expectedPacketsEl || 
        !this.progressFill || !this.scanResult || !this.scanCounter) {
      console.error('Required elements not found:', {
        portSelect: !!this.portSelect,
        connectButton: !!this.connectButton,
        disconnectButton: !!this.disconnectButton,
        connectionStatus: !!this.connectionStatus,
        runStopButton: !!this.runStopButton,
        bootIdEl: !!this.bootIdEl,
        scanIdEl: !!this.scanIdEl,
        scanNameEl: !!this.scanNameEl,
        numAnglesEl: !!this.numAnglesEl,
        dataPacketCountEl: !!this.dataPacketCountEl,
        expectedPacketsEl: !!this.expectedPacketsEl,
        progressFill: !!this.progressFill,
        scanResult: !!this.scanResult,
        scanCounter: !!this.scanCounter
      });
      return;
    }

    // Initialize parser
    this.dataParser = new UltrasonicDataParser();
    this.setupParserCallbacks();
    
    this.initializeEventListeners();
    this.startPortPolling();
    this.updateUI();
    this.updateScanDisplay();
  }

  private setupParserCallbacks(): void {
    this.dataParser.onMetadataReceived = (metadata: MetadataPacket) => {
      this.onMetadataReceived(metadata);
    };

    this.dataParser.onDataPacketReceived = (packet: DataPacket) => {
      this.onDataPacketReceived(packet);
    };

    this.dataParser.onScanComplete = (scan: ScanData) => {
      this.onScanComplete(scan);
    };

    this.dataParser.onDeviceReboot = (newBootId: number, oldBootId: number) => {
      console.log(`Device rebooted: ${oldBootId.toString(16)} -> ${newBootId.toString(16)}`);
      this.setConnectionStatus('Device rebooted - new session started', 'connected');
    };

    this.dataParser.onParseError = (error: string, data: Uint8Array) => {
      console.error('Parse error:', error);
      this.setConnectionStatus(`Parse error: ${error}`, 'error');
    };
  }

  private initializeEventListeners(): void {
    // Serial port events
    this.portSelect.addEventListener('change', () => {
      const selectedIndex = parseInt(this.portSelect.value);
      this.selectedPort = isNaN(selectedIndex) ? null : this.availablePorts[selectedIndex];
      console.log('Port selected:', this.selectedPort?.getInfo());
      this.updateUI();
    });

    this.connectButton.addEventListener('click', () => {
      this.connectToSelectedPort();
    });

    this.disconnectButton.addEventListener('click', () => {
      this.disconnectPort();
    });

    // Trigger mode events
    this.triggerModeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.triggerMode = (e.target as HTMLInputElement).value as TriggerMode;
        this.updateTriggerControls();
      });
    });

    this.runStopButton.addEventListener('click', () => {
      this.toggleRunStop();
    });
  }

  private startPortPolling(): void {
    this.scanPorts();
    this.pollingTimer = window.setInterval(() => {
      this.scanPorts();
    }, 2000);
  }

  private async scanPorts(): Promise<void> {
    if (!('serial' in navigator)) {
      this.setConnectionStatus('Web Serial API not supported', 'error');
      return;
    }

    try {
      const ports = await navigator.serial.getPorts();
      
      if (this.hasPortListChanged(ports)) {
        console.log('Port list changed. New ports:', ports.length);
        this.availablePorts = ports;
        this.updatePortDropdown();
        
        if (this.connectedPort && this.connectionState === 'connected') {
          const stillExists = ports.some(port => 
            JSON.stringify(port.getInfo()) === JSON.stringify(this.connectedPort!.getInfo())
          );
          
          if (!stillExists) {
            console.log('Connected port was removed, auto-disconnecting');
            this.handlePortRemoved();
          }
        }
      }
    } catch (error) {
      console.error('Error scanning ports:', error);
      this.setConnectionStatus('Error scanning ports', 'error');
    }
  }

  private hasPortListChanged(newPorts: SerialPort[]): boolean {
    if (newPorts.length !== this.availablePorts.length) {
      return true;
    }
    
    for (let i = 0; i < newPorts.length; i++) {
      const newInfo = JSON.stringify(newPorts[i].getInfo());
      const oldInfo = JSON.stringify(this.availablePorts[i]?.getInfo());
      if (newInfo !== oldInfo) {
        return true;
      }
    }
    
    return false;
  }

  private updatePortDropdown(): void {
    const currentSelection = this.portSelect.value;
    this.portSelect.innerHTML = '';
    
    if (this.availablePorts.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No serial ports found';
      this.portSelect.appendChild(option);
      this.selectedPort = null;
    } else {
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select a port...';
      this.portSelect.appendChild(defaultOption);
      
      this.availablePorts.forEach((port, index) => {
        const option = document.createElement('option');
        option.value = index.toString();
        option.textContent = this.getPortDisplayName(port);
        this.portSelect.appendChild(option);
      });
      
      if (currentSelection && this.portSelect.querySelector(`option[value="${currentSelection}"]`)) {
        this.portSelect.value = currentSelection;
        const selectedIndex = parseInt(currentSelection);
        this.selectedPort = isNaN(selectedIndex) ? null : this.availablePorts[selectedIndex];
      } else {
        this.selectedPort = null;
      }
    }
    
    this.updateUI();
  }

  private getPortDisplayName(port: SerialPort): string {
    const info = port.getInfo();
    
    let displayName = 'Serial Port';
    
    if (info.usbVendorId && info.usbProductId) {
      const chipType = this.getChipType(info.usbVendorId, info.usbProductId);
      displayName = chipType || 'USB Serial Device';
    }
    
    try {
      const portString = port.toString();
      const comMatch = portString.match(/COM\d+/i);
      if (comMatch) {
        displayName = `${displayName} (${comMatch[0].toUpperCase()})`;
      }
    } catch (e) {
      // Ignore errors
    }
    
    return displayName;
  }

  private getChipType(vendorId: number, productId: number): string | null {
    if (vendorId === 0x1a86) return 'CH340 USB Serial';
    if (vendorId === 0x0403) return 'FTDI USB Serial';
    if (vendorId === 0x10c4) return 'CP210x USB Serial';
    return null;
  }

  private async connectToSelectedPort(): Promise<void> {
    if (!this.selectedPort) {
      this.setConnectionStatus('No port selected', 'error');
      return;
    }

    this.connectionState = 'connecting';
    this.updateUI();
    this.setConnectionStatus('Connecting...', 'connecting');

    try {
      await this.selectedPort.open({
        baudRate: 115200,
        dataBits: 8,
        parity: 'none',
        stopBits: 1
      });

      this.connectedPort = this.selectedPort;
      this.connectionState = 'connected';
      this.setConnectionStatus(`Connected to ${this.getPortDisplayName(this.connectedPort)}`, 'connected');
      
      console.log('Successfully connected to port:', this.connectedPort.getInfo());
      
      // Start reading data
      this.startDataReading();
      
      // Enable trigger controls
      this.updateTriggerControls();
      
      // Auto-start in auto mode
      if (this.triggerMode === 'auto') {
        this.isRunning = true;
        this.waitingForScan = true;
        this.updateScanDisplay('waiting', 'Waiting for scan data...');
      }
      
    } catch (error) {
      console.error('Connection error:', error);
      this.connectionState = 'error';
      this.setConnectionStatus(`Connection failed: ${(error as Error).message}`, 'error');
      
      setTimeout(() => {
        if (this.connectionState === 'error') {
          this.connectionState = 'disconnected';
          this.updateUI();
          this.setConnectionStatus('Connection failed', 'error');
        }
      }, 2000);
    }
    
    this.updateUI();
  }

  private async startDataReading(): Promise<void> {
    if (!this.connectedPort || !this.connectedPort.readable) {
      return;
    }

    try {
      this.reader = this.connectedPort.readable.getReader();
      
      while (this.reader && this.connectionState === 'connected') {
        const { value, done } = await this.reader.read();
        
        if (done) {
          console.log('Data stream ended');
          break;
        }
        
        // Only process data if we're in a mode that accepts it
        if (this.shouldProcessData()) {
          this.dataParser.processData(value);
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'NetworkError') {
        console.error('Data reading error:', error);
        this.setConnectionStatus(`Data reading error: ${(error as Error).message}`, 'error');
      }
    } finally {
      if (this.reader) {
        this.reader.releaseLock();
        this.reader = null;
      }
    }
  }

  private shouldProcessData(): boolean {
    if (this.triggerMode === 'auto') {
      return true; // Always process in auto mode
    } else {
      return this.isRunning; // Only process in single mode when running
    }
  }

  private async disconnectPort(): Promise<void> {
    if (!this.connectedPort) {
      return;
    }

    try {
      // Stop data reading
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      
      // Close port
      await this.connectedPort.close();
      console.log('Port disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting port:', error);
    }

    this.connectedPort = null;
    this.connectionState = 'disconnected';
    this.isRunning = false;
    this.waitingForScan = false;
    this.currentScanData = null;
    
    this.setConnectionStatus('Disconnected', 'disconnected');
    this.updateUI();
    this.updateScanDisplay('waiting', 'Waiting for connection...');
  }

  private handlePortRemoved(): void {
    this.connectedPort = null;
    this.connectionState = 'disconnected';
    this.isRunning = false;
    this.waitingForScan = false;
    this.currentScanData = null;
    
    this.setConnectionStatus('Device was unplugged', 'error');
    this.updateUI();
    this.updateScanDisplay('bad', 'Device disconnected');
    
    setTimeout(() => {
      if (this.connectionState === 'disconnected') {
        this.setConnectionStatus('No connection', 'disconnected');
      }
    }, 3000);
  }

  // Trigger mode controls
  private updateTriggerControls(): void {
    const isConnected = this.connectionState === 'connected';
    
    if (this.triggerMode === 'auto') {
      // In auto mode, hide run/stop button and auto-start
      if (this.runStopButton) {
        this.runStopButton.style.display = 'none';
      }
      if (isConnected) {
        this.isRunning = true;
        this.waitingForScan = true;
      }
    } else {
      // In single mode, show run/stop button
      if (this.runStopButton) {
        this.runStopButton.style.display = 'block';
        this.runStopButton.disabled = !isConnected;
        this.updateRunStopButton();
      }
    }
  }

  private updateRunStopButton(): void {
    if (!this.runStopButton) return;
    
    if (this.isRunning) {
      this.runStopButton.textContent = 'STOP';
      this.runStopButton.className = 'run-stop-btn running';
    } else {
      this.runStopButton.textContent = 'RUN';
      this.runStopButton.className = 'run-stop-btn stopped';
    }
  }

  private toggleRunStop(): void {
    if (this.triggerMode === 'single') {
      this.isRunning = !this.isRunning;
      this.updateRunStopButton();
      
      if (this.isRunning) {
        this.startSingleCapture();
      } else {
        this.stopCapture();
      }
    }
  }

  private startSingleCapture(): void {
    // Reset for new capture
    this.currentScanData = null;
    this.waitingForScan = true;
    this.updateScanDisplay('waiting', 'Waiting for scan data...');
  }

  private stopCapture(): void {
    this.waitingForScan = false;
    this.updateScanDisplay('bad', 'Capture stopped by user');
  }

  // Parser event handlers
  private onMetadataReceived(metadata: MetadataPacket): void {
    console.log('Metadata received:', metadata);
    
    // Only accept metadata if we're waiting for a scan
    if (!this.waitingForScan) {
      console.log('Ignoring metadata - not waiting for scan');
      return;
    }
    
    // Start new scan tracking
    this.currentScanData = {
      bootId: metadata.bootId,
      scanId: metadata.scanId,
      metadata: metadata,
      dataPackets: new Map(),
      isComplete: false,
      timestamp: Date.now()
    };
    
    this.updateScanDisplay('waiting', 'Receiving scan data...');
  }

  private onDataPacketReceived(packet: DataPacket): void {
    if (!this.currentScanData || 
        packet.bootId !== this.currentScanData.bootId || 
        packet.scanId !== this.currentScanData.scanId) {
      // Data packet without matching metadata - ignore
      console.log('Ignoring orphaned data packet');
      return;
    }
    
    const dataKey = `${packet.angleIndex}_${packet.stepIndex}_${packet.channelIndex}`;
    this.currentScanData.dataPackets.set(dataKey, packet);
    
    // Update display
    this.updateScanDisplay();
  }

  private onScanComplete(scan: ScanData): void {
    console.log('Scan complete:', scan);
    this.scanCount++;
    this.currentScanData = scan;
    
    this.updateScanDisplay('good', 'SCAN COMPLETE ✓');
    
    // Handle trigger modes
    if (this.triggerMode === 'single') {
      // Stop after completing one scan
      this.isRunning = false;
      this.waitingForScan = false;
      this.updateRunStopButton();
    } else {
      // In auto mode, automatically wait for next scan
      this.waitingForScan = true;
      // Keep the completed scan displayed but be ready for next one
      setTimeout(() => {
        if (this.triggerMode === 'auto' && this.waitingForScan) {
          this.updateScanDisplay('waiting', 'Waiting for next scan...');
        }
      }, 2000);
    }
  }

  // UI update methods
  private updateUI(): void {
    const hasSelection = this.selectedPort !== null;
    const isConnected = this.connectionState === 'connected';
    const isConnecting = this.connectionState === 'connecting';
    
    this.connectButton.disabled = !hasSelection || isConnected || isConnecting;
    this.disconnectButton.disabled = !isConnected;
    this.portSelect.disabled = isConnected || isConnecting;
    
    // Update trigger controls
    this.triggerModeRadios.forEach(radio => {
      radio.disabled = !isConnected;
    });
    
    this.updateTriggerControls();
  }

  private updateScanDisplay(status?: 'good' | 'bad' | 'waiting', message?: string): void {
    // Update scan counter
    if (this.scanCounter) {
      this.scanCounter.textContent = `Scans Received: ${this.scanCount}`;
    }
    
    if (this.currentScanData) {
      const scan = this.currentScanData;
      const metadata = scan.metadata;
      
      if (this.bootIdEl) {
        this.bootIdEl.textContent = `0x${scan.bootId.toString(16).toUpperCase().padStart(8, '0')}`;
      }
      if (this.scanIdEl) {
        this.scanIdEl.textContent = scan.scanId.toString();
      }
      if (this.scanNameEl) {
        this.scanNameEl.textContent = metadata.scanConfig.name || '-';
      }
      if (this.numAnglesEl) {
        this.numAnglesEl.textContent = metadata.scanConfig.numAngles?.toString() || '-';
      }
      if (this.dataPacketCountEl) {
        this.dataPacketCountEl.textContent = scan.dataPackets.size.toString();
      }
      
      const expected = metadata.scanConfig.numAngles * 64 * 64;
      if (this.expectedPacketsEl) {
        this.expectedPacketsEl.textContent = expected.toString();
      }
      
      // Update progress
      const progress = expected > 0 ? (scan.dataPackets.size / expected) * 100 : 0;
      if (this.progressFill) {
        this.progressFill.style.width = `${progress}%`;
        this.progressFill.textContent = `${Math.round(progress)}%`;
      }
      
    } else {
      // Clear display
      if (this.bootIdEl) this.bootIdEl.textContent = '-';
      if (this.scanIdEl) this.scanIdEl.textContent = '-';
      if (this.scanNameEl) this.scanNameEl.textContent = '-';
      if (this.numAnglesEl) this.numAnglesEl.textContent = '-';
      if (this.dataPacketCountEl) this.dataPacketCountEl.textContent = '0';
      if (this.expectedPacketsEl) this.expectedPacketsEl.textContent = '-';
      if (this.progressFill) {
        this.progressFill.style.width = '0%';
        this.progressFill.textContent = '0%';
      }
    }
    
    // Update result status
    if (status && message && this.scanResult) {
      this.scanResult.className = `scan-result ${status}`;
      this.scanResult.textContent = message;
    }
  }

  private setConnectionStatus(message: string, type: ConnectionState): void {
    if (this.connectionStatus) {
      this.connectionStatus.textContent = message;
      this.connectionStatus.className = `status ${type}`;
    }
  }

  // Public methods for testing/debugging
  public getCurrentScan(): ScanData | null {
    return this.dataParser.getCurrentScan();
  }

  public getCompletedScans(): ScanData[] {
    return this.dataParser.getCompletedScans();
  }
}

// Initialize the interface
document.addEventListener('DOMContentLoaded', () => {
  if ('serial' in navigator) {
    new UltrasonicScannerInterface();
  } else {
    const status = document.getElementById('connectionStatus');
    if (status) {
      status.textContent = 'Web Serial API is not supported in this browser';
      status.className = 'status error';
    }
  }
});