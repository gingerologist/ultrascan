export {}; // Make this file a module

// Import the parser and ECharts
import { UltrasonicDataParser, MetadataPacket, DataPacket, ScanData } from './parser';
import * as echarts from 'echarts';

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

class UltrasonicScannerInterface {
  // Serial port management
  private portSelect: HTMLSelectElement;
  private connectButton: HTMLButtonElement;
  private disconnectButton: HTMLButtonElement;
  private connectionStatus: HTMLElement;
  
  // Single mode controls
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
  
  // Chart elements
  private angleSelect: HTMLSelectElement;
  private stepSelect: HTMLSelectElement;
  private updateChartButton: HTMLButtonElement;
  private chartContainer: HTMLElement;
  private chartControlsContainer: HTMLElement;
  private scanConfigDisplay: HTMLElement;
  private scanConfigText: HTMLElement;
  
  // State
  private availablePorts: SerialPort[] = [];
  private selectedPort: SerialPort | null = null;
  private connectedPort: SerialPort | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private pollingTimer: number | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  
  // Parser and data
  private dataParser: UltrasonicDataParser;
  private isRunning: boolean = false;
  private scanCount: number = 0;
  private displayScanData: ScanData | null = null;
  private waitingForScan: boolean = false;
  
  // Chart instance
  private chart: any = null;

  constructor() {

    console.log('🚀 Constructor: isRunning initial value =', this.isRunning);

    this.initializeElements();
    this.initializeParser();
    this.initializeEventListeners();
    this.initializeChart();
    this.startPortPolling();
    this.updateUI();

    setTimeout(() => {
      console.log('🔍 RUN button status:', {
        exists: !!this.runStopButton,
        visible: this.runStopButton?.style.display,
        disabled: this.runStopButton?.disabled,
        text: this.runStopButton?.textContent
      });
    }, 1000);
  }

  private initializeElements(): void {
    // Get all DOM elements
    this.portSelect = document.getElementById('portSelect') as HTMLSelectElement;
    this.connectButton = document.getElementById('connectButton') as HTMLButtonElement;
    this.disconnectButton = document.getElementById('disconnectButton') as HTMLButtonElement;
    this.connectionStatus = document.getElementById('connectionStatus') as HTMLElement;
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
    
    this.angleSelect = document.getElementById('angleSelect') as HTMLSelectElement;
    this.stepSelect = document.getElementById('stepSelect') as HTMLSelectElement;
    this.updateChartButton = document.getElementById('updateChartButton') as HTMLButtonElement;
    this.chartContainer = document.getElementById('chartContainer') as HTMLElement;
    this.chartControlsContainer = document.getElementById('chartControlsContainer') as HTMLElement;
    this.scanConfigDisplay = document.getElementById('scanConfigDisplay') as HTMLElement;
    this.scanConfigText = document.getElementById('scanConfigText') as HTMLElement;

    // Check core elements
    const missingElements: string[] = [];
    
    if (!this.portSelect) missingElements.push('portSelect');
    if (!this.connectButton) missingElements.push('connectButton');
    if (!this.disconnectButton) missingElements.push('disconnectButton');
    if (!this.connectionStatus) missingElements.push('connectionStatus');
    if (!this.runStopButton) missingElements.push('runStopButton');
    if (!this.chartContainer) missingElements.push('chartContainer');
    
    if (missingElements.length > 0) {
      console.error('Missing HTML elements:', missingElements.join(', '));
      console.log('Element status:');
      console.log('- portSelect:', !!this.portSelect);
      console.log('- connectButton:', !!this.connectButton);
      console.log('- disconnectButton:', !!this.disconnectButton);
      console.log('- connectionStatus:', !!this.connectionStatus);
      console.log('- runStopButton:', !!this.runStopButton);
      console.log('- chartContainer:', !!this.chartContainer);
    }
  }

  private initializeParser(): void {
    this.dataParser = new UltrasonicDataParser();
    this.dataParser.setTriggerMode('single');
    
    this.dataParser.onMetadataReceived = (metadata: MetadataPacket) => {
      this.handleMetadataReceived(metadata);
    };

    this.dataParser.onDataPacketReceived = (packet: DataPacket) => {
      this.handleDataPacketReceived(packet);
    };

    this.dataParser.onScanComplete = (scan: ScanData) => {
      this.handleScanComplete(scan);
    };

    this.dataParser.onDeviceReboot = (newBootId: number, oldBootId: number) => {
      console.log(`Device rebooted: 0x${oldBootId.toString(16)} -> 0x${newBootId.toString(16)}`);
      this.setConnectionStatus('Device rebooted', 'connected');
    };

    this.dataParser.onParseError = (error: string, data: Uint8Array) => {
      console.error('Parse error:', error);
      this.setConnectionStatus(`Parse error: ${error}`, 'error');
    };
  }

  private initializeEventListeners(): void {
    // Serial port controls
    if (this.portSelect) {
      this.portSelect.addEventListener('change', () => {
        const selectedIndex = parseInt(this.portSelect.value);
        this.selectedPort = isNaN(selectedIndex) ? null : this.availablePorts[selectedIndex];
        this.updateUI();
      });
    }

    if (this.connectButton) {
      this.connectButton.addEventListener('click', () => {
        this.connectToSelectedPort();
      });
    }

    if (this.disconnectButton) {
      this.disconnectButton.addEventListener('click', () => {
        this.disconnectPort();
      });
    }

    if (this.runStopButton) {
      this.runStopButton.addEventListener('click', () => {
        console.log('🖱️ CLICK: isRunning BEFORE toggle =', this.isRunning);
        this.toggleRunStop();
        console.log('🖱️ CLICK: isRunning AFTER toggle =', this.isRunning);
      });
    }

    // Chart controls
    if (this.updateChartButton) {
      this.updateChartButton.addEventListener('click', () => {
        this.updateChart();
      });
    }

    if (this.angleSelect) {
      this.angleSelect.addEventListener('change', () => {
        this.updateChart();
      });
    }

    if (this.stepSelect) {
      this.stepSelect.addEventListener('change', () => {
        this.updateChart();
      });
    }
  }

  private initializeChart(): void {
    // Don't initialize chart immediately since container is hidden
    // Chart will be initialized when first needed in showChartControls()
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
        this.availablePorts = ports;
        this.updatePortDropdown();
        
        if (this.connectedPort && this.connectionState === 'connected') {
          const stillExists = ports.some(port => 
            JSON.stringify(port.getInfo()) === JSON.stringify(this.connectedPort!.getInfo())
          );
          
          if (!stillExists) {
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
    if (!this.portSelect) return;

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

      // ADD THIS DEBUG:
      console.log('🔗 After connection: isRunning =', this.isRunning);

      this.setConnectionStatus(`Connected to ${this.getPortDisplayName(this.connectedPort)}`, 'connected');
      
      console.log('🔗 About to start data reading...'); // ADD THIS
      this.startDataReading();
      console.log('🔗 startDataReading() call completed'); // ADD THIS
      this.updateUI();
      
    } catch (error) {
      console.error('Connection error:', error);
      this.connectionState = 'error';
      this.setConnectionStatus(`Connection failed: ${(error as Error).message}`, 'error');
      
      setTimeout(() => {
        if (this.connectionState === 'error') {
          this.connectionState = 'disconnected';
          this.updateUI();
        }
      }, 2000);
    }
  }

  private async startDataReading(): Promise<void> {
    if (!this.connectedPort || !this.connectedPort.readable) {
      return;
    }

    try {
      this.reader = this.connectedPort.readable.getReader();
      try {
        while (this.reader && this.connectionState === 'connected') {
          console.log('🔄 About to read from serial port...');
          const { value, done } = await this.reader.read();
          
          if (done) {
            console.log('❌ Data stream ended - connection closed');
            break;
          }

          console.log('📦 Raw data received:', value.length, 'bytes');
          console.log('🏃 isRunning:', this.isRunning);        
          
          if (this.isRunning) {
            this.dataParser.processData(value);
          }
        }
      } catch (loopError) {
        console.error('💥 Error in read loop:', loopError);
        // break;
        this.connectionState = 'error';
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

  private async disconnectPort(): Promise<void> {
    if (!this.connectedPort) return;

    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      
      await this.connectedPort.close();
    } catch (error) {
      console.error('Error disconnecting port:', error);
    }

    this.connectedPort = null;
    this.connectionState = 'disconnected';
    this.isRunning = false;
    this.waitingForScan = false;
    this.displayScanData = null;
    
    this.dataParser.reset();
    this.setConnectionStatus('Disconnected', 'disconnected');
    this.updateUI();
    this.updateScanDisplay();
  }

  private handlePortRemoved(): void {
    this.connectedPort = null;
    this.connectionState = 'disconnected';
    this.isRunning = false;
    this.waitingForScan = false;
    this.displayScanData = null;
    
    this.setConnectionStatus('Device was unplugged', 'error');
    this.updateUI();
    this.updateScanDisplay();
    
    setTimeout(() => {
      if (this.connectionState === 'disconnected') {
        this.setConnectionStatus('No connection', 'disconnected');
      }
    }, 3000);
  }

  private toggleRunStop(): void {
    this.isRunning = !this.isRunning;
    this.updateRunStopButton();
    
    if (this.isRunning) {
      this.startSingleCapture();
    } else {
      this.stopCapture();
    }
  }
  private updateRunStopButton(): void {
    console.log('🎨 updateRunStopButton called: isRunning =', this.isRunning);
    console.trace('🎨 Call stack:');
    console.log('🎨 runStopButton exists:', !!this.runStopButton);
    
    if (!this.runStopButton) return;
    
    if (this.isRunning) {
      console.log('🎨 Setting button to STOP (red)');
      this.runStopButton.textContent = 'STOP';
      this.runStopButton.className = 'run-stop-btn running';
    } else {
      console.log('🎨 Setting button to RUN (green)');
      this.runStopButton.textContent = 'RUN';
      this.runStopButton.className = 'run-stop-btn stopped';
    }
    
    console.log('🎨 Button text after update:', this.runStopButton.textContent);
  }

  // private updateRunStopButton(): void {
  //   if (!this.runStopButton) return;
    
  //   if (this.isRunning) {
  //     this.runStopButton.textContent = 'STOP';
  //     this.runStopButton.className = 'run-stop-btn running';
  //   } else {
  //     this.runStopButton.textContent = 'RUN';
  //     this.runStopButton.className = 'run-stop-btn stopped';
  //   }
  // }

  private startSingleCapture(): void {
    this.displayScanData = null;
    this.waitingForScan = true;
    this.updateScanDisplay('waiting', 'Waiting for scan data...');
  }

  private stopCapture(): void {
    this.waitingForScan = false;
    this.updateScanDisplay('bad', 'Capture stopped by user');
  }

  private handleMetadataReceived(metadata: MetadataPacket): void {
    if (!this.waitingForScan) {
      console.log('Ignoring metadata - not waiting for scan');
      return;
    }
    
    this.updateScanDisplay('waiting', 'Receiving scan data...');
  }

  private handleDataPacketReceived(packet: DataPacket): void {
    this.updateScanDisplay();
  }

  private handleScanComplete(scan: ScanData): void {
    console.log('Scan complete:', scan);
    this.scanCount++;
    this.displayScanData = scan;
    
    this.isRunning = false;
    this.waitingForScan = false;
    this.updateRunStopButton();
    
    this.updateScanDisplay('good', 'SCAN COMPLETE ✓');
    this.displayScanConfiguration(scan.metadata.scanConfig);
    this.populateSelectors(scan.metadata.scanConfig);
    this.showChartControls();
    this.updateChart();
  }

  private displayScanConfiguration(config: any): void {
    if (!this.scanConfigDisplay || !this.scanConfigText) return;
    
    const configText = `Scan Name: ${config.name}
Angles: ${config.numAngles}
Pattern Segments: ${config.numPatternSegments}
Repeat Count: ${config.repeatCount}
Tail Count: ${config.tailCount}
TX Start Delay: ${config.txStartDel}
TR Switch Delay Mode: ${config.trSwDelMode}
Capture Window: ${config.captureStartUs}μs - ${config.captureEndUs}μs
Samples per Channel: ${20 * (config.captureEndUs - config.captureStartUs)}`;
    
    this.scanConfigText.textContent = configText;
    this.scanConfigDisplay.style.display = 'block';
  }

  private populateSelectors(config: any): void {
    if (this.angleSelect) {
      this.angleSelect.innerHTML = '';
      for (let i = 0; i < config.numAngles; i++) {
        const option = document.createElement('option');
        option.value = i.toString();
        option.textContent = `Angle ${i}`;
        this.angleSelect.appendChild(option);
      }
    }
    
    if (this.stepSelect) {
      this.stepSelect.innerHTML = '';
      for (let i = 0; i < 64; i++) {
        const option = document.createElement('option');
        option.value = i.toString();
        option.textContent = `Step ${i}`;
        this.stepSelect.appendChild(option);
      }
    }
  }

  private showChartControls(): void {
    if (this.chartControlsContainer) {
      this.chartControlsContainer.style.display = 'flex';
    }
    if (this.chartContainer) {
      this.chartContainer.style.display = 'block';
    }
    
    // Initialize chart now that container is visible
    this.initializeChartNow();
  }

  private initializeChartNow(): void {
    if (!this.chartContainer || this.chart) return; // Already initialized

    this.chart = echarts.init(this.chartContainer);

    const option = {
      title: {
        text: 'Ultrasonic Data - 64 Channels',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      legend: {
        show: false
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        name: 'Sample Index',
        nameLocation: 'middle',
        nameGap: 30
      },
      yAxis: {
        type: 'value',
        name: 'ADC Value',
        nameLocation: 'middle',
        nameGap: 50,
        min: 0,
        max: 1023
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          height: 20,
          bottom: 30
        }
      ],
      series: [] as any[]
    };

    this.chart.setOption(option);

    // Add resize handler
    window.addEventListener('resize', () => {
      if (this.chart) {
        this.chart.resize();
      }
    });
  }

  private updateChart(): void {
    if (!this.chart || !this.displayScanData || !this.angleSelect || !this.stepSelect) {
      return;
    }
    
    const angleIndex = parseInt(this.angleSelect.value) || 0;
    const stepIndex = parseInt(this.stepSelect.value) || 0;
    
    const series: any[] = [];
    let maxSamples = 0;
    
    // Create series for each channel
    for (let channel = 0; channel < 64; channel++) {
      const dataKey = `${angleIndex}_${stepIndex}_${channel}`;
      const packet = this.displayScanData.dataPackets.get(dataKey);
      
      const hasData = packet && packet.samples && packet.samples.length > 0;
      const data = hasData ? packet.samples : [];
      
      if (hasData) {
        maxSamples = Math.max(maxSamples, data.length);
      }
      
      series.push({
        name: `Channel ${channel}`,
        type: 'line',
        data: data,
        symbol: 'none',
        lineStyle: {
          width: 1,
          opacity: hasData ? 0.8 : 0.3
        },
        itemStyle: {
          color: hasData ? this.getChannelColor(channel) : '#cccccc'
        }
      });
    }
    
    const xAxisData = Array.from({length: maxSamples}, (_, i) => i);
    
    this.chart.setOption({
      title: {
        text: `Ultrasonic Data - Angle ${angleIndex}, Step ${stepIndex}`
      },
      xAxis: {
        data: xAxisData
      },
      series: series
    });
  }

  private getChannelColor(channel: number): string {
    const hue = (channel * 360 / 64) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  private updateUI(): void {
    const hasSelection = this.selectedPort !== null;
    const isConnected = this.connectionState === 'connected';
    const isConnecting = this.connectionState === 'connecting';
    
    if (this.connectButton) {
      this.connectButton.disabled = !hasSelection || isConnected || isConnecting;
    }
    if (this.disconnectButton) {
      this.disconnectButton.disabled = !isConnected;
    }
    if (this.portSelect) {
      this.portSelect.disabled = isConnected || isConnecting;
    }
    if (this.runStopButton) {
      this.runStopButton.disabled = !isConnected;
    }
  }

  private updateScanDisplay(status?: 'good' | 'bad' | 'waiting', message?: string): void {
    if (this.scanCounter) {
      this.scanCounter.textContent = `Scans Received: ${this.scanCount}`;
    }
    
    const scanToDisplay = this.displayScanData || this.dataParser.getDisplayScan();
    
    if (scanToDisplay) {
      const scan = scanToDisplay;
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