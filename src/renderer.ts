export {}; // Make this file a module

import {
  UltrasonicDataParser,
  MetadataPacket,
  DataPacket,
  ScanData,
} from './parser';
import * as echarts from 'echarts';

import { saveScanData } from './saveScanData';

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
  private totalChannels: number = 64;

  // Serial port management
  private portSelect: HTMLSelectElement;
  private connectButton: HTMLButtonElement;
  private disconnectButton: HTMLButtonElement;

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

  // NEW: Channel selection elements
  private channelSelectionContainer: HTMLElement;
  private checkAllChannels: HTMLInputElement;
  private channelGrid: HTMLElement;
  private selectionSummary: HTMLElement;

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

  // NEW: Channel selection state
  private selectedChannels: Set<number> = new Set();

  constructor() {
    console.log('🚀 Constructor: isRunning initial value =', this.isRunning);

    // Initialize all channels as selected by default
    for (let i = 0; i < 64; i++) {
      this.selectedChannels.add(i);
    }

    this.initializeElements();
    this.initializeParser();
    this.initializeEventListeners();
    this.initializeChart();
    this.initializeChannelSelection(); // NEW
    this.startPortPolling();
    this.updateUI();

    this.debugElementStatus();
    this.verifyCSSLoaded();
  }

  private initializeElements(): void {
    // Get all DOM elements
    this.portSelect = document.getElementById(
      'portSelect'
    ) as HTMLSelectElement;
    this.connectButton = document.getElementById(
      'connectButton'
    ) as HTMLButtonElement;
    this.disconnectButton = document.getElementById(
      'disconnectButton'
    ) as HTMLButtonElement;
    this.runStopButton = document.getElementById(
      'runStopButton'
    ) as HTMLButtonElement;

    this.bootIdEl = document.getElementById('bootId') as HTMLElement;
    this.scanIdEl = document.getElementById('scanId') as HTMLElement;
    this.scanNameEl = document.getElementById('scanName') as HTMLElement;
    this.numAnglesEl = document.getElementById('numAngles') as HTMLElement;
    this.dataPacketCountEl = document.getElementById(
      'dataPacketCount'
    ) as HTMLElement;
    this.expectedPacketsEl = document.getElementById(
      'expectedPackets'
    ) as HTMLElement;
    this.progressFill = document.getElementById('progressFill') as HTMLElement;
    this.scanResult = document.getElementById('scanResult') as HTMLElement;
    this.scanCounter = document.getElementById('scanCounter') as HTMLElement;

    this.angleSelect = document.getElementById(
      'angleSelect'
    ) as HTMLSelectElement;
    this.stepSelect = document.getElementById(
      'stepSelect'
    ) as HTMLSelectElement;
    this.updateChartButton = document.getElementById(
      'updateChartButton'
    ) as HTMLButtonElement;
    this.chartContainer = document.getElementById(
      'chartContainer'
    ) as HTMLElement;
    this.chartControlsContainer = document.getElementById(
      'chartControlsContainer'
    ) as HTMLElement;
    this.scanConfigDisplay = document.getElementById(
      'scanConfigDisplay'
    ) as HTMLElement;
    this.scanConfigText = document.getElementById(
      'scanConfigText'
    ) as HTMLElement;

    // NEW: Channel selection elements
    this.channelSelectionContainer = document.getElementById(
      'channelSelectionContainer'
    ) as HTMLElement;
    this.checkAllChannels = document.getElementById(
      'checkAllChannels'
    ) as HTMLInputElement;
    this.channelGrid = document.getElementById('channelGrid') as HTMLElement;
    this.selectionSummary = document.getElementById(
      'selectionSummary'
    ) as HTMLElement;

    // Check core elements
    const missingElements: string[] = [];

    if (!this.portSelect) missingElements.push('portSelect');
    if (!this.connectButton) missingElements.push('connectButton');
    if (!this.disconnectButton) missingElements.push('disconnectButton');
    if (!this.runStopButton) missingElements.push('runStopButton');
    if (!this.chartContainer) missingElements.push('chartContainer');
    if (!this.channelSelectionContainer)
      missingElements.push('channelSelectionContainer');

    if (missingElements.length > 0) {
      console.error('Missing HTML elements:', missingElements.join(', '));
    }
  }

  // 6. Helper method to create channel checkbox
  private createChannelCheckbox(channel: number, isChecked: boolean): void {
    const channelItem = document.createElement('div');
    channelItem.className = isChecked
      ? 'channel-item selected'
      : 'channel-item';

    const label = document.createElement('label');
    label.textContent = `CH${channel}`;
    label.setAttribute('for', `channel_${channel}`);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `channel_${channel}`;
    checkbox.checked = isChecked;
    checkbox.dataset.channel = channel.toString();

    checkbox.addEventListener('change', e => {
      const target = e.target as HTMLInputElement;
      this.handleChannelCheckboxChange(
        parseInt(target.dataset.channel!),
        target.checked
      );
    });

    channelItem.appendChild(label);
    channelItem.appendChild(checkbox);
    this.channelGrid.appendChild(channelItem);
  }

  // 5. Update initializeChannelSelection() to support 65 channels
  private initializeChannelSelection(): void {
    console.log('📋 Initializing channel selection grid');

    if (!this.channelGrid) {
      console.error('Channel grid element not found');
      return;
    }

    // Clear existing content
    this.channelGrid.innerHTML = '';

    // Create checkboxes for regular channels (0-63)
    for (let channel = 0; channel < 64; channel++) {
      this.createChannelCheckbox(channel, true);
    }

    // Initialize check-all checkbox event listener (existing code)
    if (this.checkAllChannels) {
      this.checkAllChannels.addEventListener('change', e => {
        const target = e.target as HTMLInputElement;
        this.handleCheckAllChange(target.checked);
      });
    }

    this.updateSelectionSummary();
    console.log(
      '📋 Channel selection grid initialized with 64 channels + baseline'
    );
  }

  // 7. New method to handle baseline checkbox changes
  // Handle individual channel checkbox changes
  private handleChannelCheckboxChange(
    channel: number,
    isChecked: boolean
  ): void {
    console.log(
      `📋 Channel ${channel} ${isChecked ? 'selected' : 'deselected'}`
    );

    // Update selected channels set
    if (isChecked) {
      this.selectedChannels.add(channel);
    } else {
      this.selectedChannels.delete(channel);
    }

    // Update visual state
    const channelItem = document.querySelector(
      `#channel_${channel}`
    )?.parentElement;
    if (channelItem) {
      if (isChecked) {
        channelItem.classList.add('selected');
      } else {
        channelItem.classList.remove('selected');
      }
    }

    // Update check-all checkbox state
    this.updateCheckAllState();

    // Update selection summary
    this.updateSelectionSummary();

    // Update chart if data is available
    if (this.displayScanData && this.chart) {
      this.updateChart();
    }
  }

  // 8. Update handleCheckAllChange to only affect regular channels (0-63)
  private handleCheckAllChange(isChecked: boolean): void {
    console.log(`📋 Check all regular channels: ${isChecked}`);

    // Update all regular channel checkboxes (0-63 only)
    for (let channel = 0; channel < 64; channel++) {
      const checkbox = document.getElementById(
        `channel_${channel}`
      ) as HTMLInputElement;
      const channelItem = checkbox?.parentElement;

      if (checkbox && checkbox.checked !== isChecked) {
        checkbox.checked = isChecked;

        if (channelItem) {
          if (isChecked) {
            channelItem.classList.add('selected');
            this.selectedChannels.add(channel);
          } else {
            channelItem.classList.remove('selected');
            this.selectedChannels.delete(channel);
          }
        }
      }
    }

    this.updateSelectionSummary();

    if (this.displayScanData && this.chart) {
      this.updateChart();
    }
  }

  // NEW: Update check-all checkbox state based on individual selections
  private updateCheckAllState(): void {
    if (!this.checkAllChannels) return;

    const selectedCount = this.selectedChannels.size;

    if (selectedCount === 64) {
      // All channels selected
      this.checkAllChannels.checked = true;
      this.checkAllChannels.indeterminate = false;
    } else if (selectedCount === 0) {
      // No channels selected
      this.checkAllChannels.checked = false;
      this.checkAllChannels.indeterminate = false;
    } else {
      // Some channels selected
      this.checkAllChannels.checked = false;
      this.checkAllChannels.indeterminate = true;
    }
  }

  private updateSelectionSummary(): void {
    if (!this.selectionSummary) return;

    const selectedCount = this.selectedChannels.size;
    const maxChannels = 64;

    const countSpan = this.selectionSummary.querySelector('.count');
    if (countSpan) {
      countSpan.textContent = selectedCount.toString();
    }

    // Update text content
    this.selectionSummary.innerHTML = `Selected: <span class="count">${selectedCount}</span> of ${maxChannels} channels`;

    // Update colors based on selection
    if (selectedCount === 0) {
      this.selectionSummary.style.backgroundColor = '#ffebee';
      this.selectionSummary.style.borderColor = '#f8bbd9';
    } else if (selectedCount < maxChannels) {
      this.selectionSummary.style.backgroundColor = '#fff3e0';
      this.selectionSummary.style.borderColor = '#ffcc80';
    } else {
      this.selectionSummary.style.backgroundColor = '#e7f3ff';
      this.selectionSummary.style.borderColor = '#b3d7ff';
    }
  }

  private initializeParser(): void {
    this.dataParser = new UltrasonicDataParser();

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
      console.log(
        `Device rebooted: 0x${oldBootId.toString(16)} -> 0x${newBootId.toString(
          16
        )}`
      );
      };


    this.dataParser.onParseError = (error: string, data: Uint8Array) => {
      console.error('Parse error:', error);
      };
  }

  private initializeEventListeners(): void {
    // Serial port controls
    if (this.portSelect) {
      this.portSelect.addEventListener('change', () => {
        const selectedIndex = parseInt(this.portSelect.value);
        this.selectedPort = isNaN(selectedIndex)
          ? null
          : this.availablePorts[selectedIndex];
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
        this.toggleRunStop();
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
        this.updateStepSelector(this.displayScanData?.metadata.scanConfig);
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
        return;
    }

    try {
      const ports = await navigator.serial.getPorts();

      if (this.hasPortListChanged(ports)) {
        this.availablePorts = ports;
        this.updatePortDropdown();

        if (this.connectedPort && this.connectionState === 'connected') {
          const stillExists = ports.some(
            port =>
              JSON.stringify(port.getInfo()) ===
              JSON.stringify(this.connectedPort!.getInfo())
          );

          if (!stillExists) {
            this.handlePortRemoved();
          }
        }
      }
    } catch (error) {
      console.error('Error scanning ports:', error);
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

      if (
        currentSelection &&
        this.portSelect.querySelector(`option[value="${currentSelection}"]`)
      ) {
        this.portSelect.value = currentSelection;
        const selectedIndex = parseInt(currentSelection);
        this.selectedPort = isNaN(selectedIndex)
          ? null
          : this.availablePorts[selectedIndex];
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
        return;
    }

    this.connectionState = 'connecting';
    this.updateUI();

    try {
      await this.selectedPort.open({
        baudRate: 115200,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
      });

      this.connectedPort = this.selectedPort;
      this.connectionState = 'connected';

      this.startDataReading();
      this.updateUI();
    } catch (error) {
      console.error('Connection error:', error);
      this.connectionState = 'error';


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
          const { value, done } = await this.reader.read();

          if (done) {
            console.log('❌ Data stream ended - connection closed');
            break;
          }

          if (this.isRunning) {
            this.dataParser.processData(value);
          }
        }
      } catch (loopError) {
        console.error('💥 Error in read loop:', loopError);
        this.connectionState = 'error';
      }
    } catch (error) {
      if ((error as Error).name !== 'NetworkError') {
        console.error('Data reading error:', error);

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

    // Cleanup chart
    this.cleanupChart();

    // Hide chart controls and channel selection
    if (this.chartControlsContainer) {
      
    }
    if (this.chartContainer) {
      
    }
    if (this.channelSelectionContainer) {
      // NEW
      
    }
    if (this.scanConfigDisplay) {
      
    }

    this.dataParser.reset();
    this.updateUI();
    this.updateScanDisplay();
  }

  private handlePortRemoved(): void {
    this.connectedPort = null;
    this.connectionState = 'disconnected';
    this.isRunning = false;
    this.waitingForScan = false;
    this.displayScanData = null;

    this.updateUI();
    this.updateScanDisplay();

    setTimeout(() => {
      if (this.connectionState === 'disconnected') {
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
    if (!this.runStopButton) return;

    if (this.isRunning) {
      this.runStopButton.textContent = 'STOP';
      this.runStopButton.className = 'run-stop-btn running';
    } else {
      this.runStopButton.textContent = 'RUN';
      this.runStopButton.className = 'run-stop-btn stopped';
    }
  }

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

    try {
      saveScanData(scan);
    } catch (error) {
      console.error('Failed to save scan data: ', error);
    }

    this.scanCount++;
    this.displayScanData = scan;

    this.isRunning = false;
    this.waitingForScan = false;
    this.updateRunStopButton();

    this.updateScanDisplay('good', 'SCAN COMPLETE ✓');
    this.displayScanConfiguration(scan.metadata.scanConfig);
    this.populateSelectors(scan.metadata.scanConfig);
    this.showChartControls(() => {
      this.updateChart();
    });
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
    
  }

  private populateSelectors(config: any): void {
    console.log('📊 Populating selectors with config:', config);

    // Populate angles based on actual number of angles
    if (this.angleSelect) {
      this.angleSelect.innerHTML = '';
      for (let i = 0; i < config.numAngles; i++) {
        const option = document.createElement('option');
        option.value = i.toString();

        // Use label if available, otherwise default naming
        const label = config.angles[i]?.label || `Angle ${i}`;
        option.textContent = `${label} (${
          config.angles[i]?.numSteps || 0
        } steps)`;

        this.angleSelect.appendChild(option);
      }

      // Add change listener to update steps when angle changes
      this.angleSelect.addEventListener('change', () => {
        this.updateStepSelector(config);
      });
    }

    // Populate steps based on the first angle initially
    this.updateStepSelector(config);
  }

  private updateStepSelector(config?: any): void {
    if (!this.stepSelect || !this.angleSelect) return;

    const selectedAngleIndex = parseInt(this.angleSelect.value) || 0;
    const selectedAngle = config?.angles[selectedAngleIndex];
    const numSteps = selectedAngle?.numSteps || 0;

    console.log(
      `📊 Updating step selector for angle ${selectedAngleIndex}: ${numSteps} steps available`
    );

    this.stepSelect.innerHTML = '';

    if (numSteps === 0) {
      const option = document.createElement('option');
      option.value = '0';
      option.textContent = 'No steps available';
      option.disabled = true;
      this.stepSelect.appendChild(option);
    } else {
      for (let i = 0; i < numSteps; i++) {
        const option = document.createElement('option');
        option.value = i.toString();
        option.textContent = `Step ${i}`;
        this.stepSelect.appendChild(option);
      }
    }

    // Reset to step 0 when angle changes
    this.stepSelect.value = '0';
  }

  private showChartControls(func: () => void = () => {}): void {
    console.log('📊 Showing chart controls and channel selection');

    if (this.chartControlsContainer) {
      
    }

    if (this.chartContainer) {
      // Force explicit dimensions BEFORE showing
      
      this.chartContainer.style.width = '100%';
      this.chartContainer.style.height = '400px';
      this.chartContainer.style.minHeight = '400px';
      

      // Force layout recalculation
      this.chartContainer.offsetHeight;

      console.log(
        '📊 Container dimensions after forcing:',
        this.chartContainer.getBoundingClientRect().width,
        'x',
        this.chartContainer.getBoundingClientRect().height
      );
    }

    // NEW: Show channel selection
    if (this.channelSelectionContainer) {
      
    }

    // Small delay to ensure layout is computed
    setTimeout(() => {
      this.initializeChartNow();
      func();
    }, 100);
  }

  private initializeChartNow(): void {
    if (!this.chartContainer || this.chart) {
      console.log('📊 Skipping chart init - container missing or chart exists');
      return;
    }

    // Final dimension check
    const rect = this.chartContainer.getBoundingClientRect();
    console.log(
      '📊 Final chart container dimensions:',
      rect.width,
      'x',
      rect.height
    );

    if (rect.width === 0 || rect.height === 0) {
      console.error('📊 Chart container still has no dimensions, aborting');
      return;
    }

    // Initialize chart
    try {
      this.chart = echarts.init(this.chartContainer);
      console.log('📊 ECharts initialized successfully');
    } catch (error) {
      console.error('📊 Failed to initialize ECharts:', error);
      return;
    }

    // Set initial chart options
    const initialOption = {
      title: {
        text: 'Ultrasonic Data - 64 Channels',
        left: 'center',
      },
      animation: false, // Disable animatio
      animationDuration: 0, // Disable animation duration
      useGPUTranslucency: true,
      progressive: 2000,
      blendMode: 'source-over',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        padding: 5,
        textStyle: {
          fontSize: 9,
          fontFamily: 'Consolas, Courier New, monospace',
        },
        formatter: function (params: any) {
          if (!params || params.length === 0) return '';

          let html = '';

          // Add header with x-axis value
          if (params[0].axisValueLabel || params[0].name) {
            html +=
              '<div style="margin-bottom: 4px; font-weight: bold; font-size: 13px;">' +
              (params[0].axisValueLabel || params[0].name) +
              '</div>';
          }

          // Process each series with minimal bullets
          for (let i = 0; i < params.length; i++) {
            const param = params[i];
            const color = param.color || '#000';
            const name = param.seriesName || 'Channel ' + (i + 1);
            const value = param.value !== undefined ? param.value : 'N/A';

            html +=
              '<div style="display: flex; align-items: center; margin: 1px 0; font-size: 11px; line-height: 1.1;">' +
              '<span style="display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: ' +
              color +
              '; margin-right: 5px; flex-shrink: 0;"></span>' +
              '<span style="margin-right: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100px;">' +
              name +
              ':</span>' +
              '<span style="font-weight: bold;">' +
              value +
              '</span>' +
              '</div>';
          }

          return html;
        },
      },
      legend: {
        show: false,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        name: 'Sample Index',
        nameLocation: 'middle',
        nameGap: 30,
        data: [] as any, // Empty initially
      },
      yAxis: {
        type: 'value',
        name: 'ADC Value',
        nameLocation: 'middle',
        nameGap: 50,
        scale: true,
        min: -512,
        max: 512,
        startFromZero: true,
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          preventDefaultMouseMove: false,
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          height: 20,
          bottom: 30,
        },
      ],
      series: [] as any, // Empty initially
    };

    this.chart.setOption(initialOption);

    // Add resize handler
    this.setupChartResize();
  }

  private setupChartResize(): void {
    if (!this.chart) return;

    let resizeTimeout: number;
    const handleResize = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = window.setTimeout(() => {
        if (this.chart && !this.chart.isDisposed()) {
          try {
            this.chart.resize();
          } catch (error) {
            console.warn('📊 Chart resize failed:', error);
          }
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // Store cleanup function
    (this.chart as any)._cleanupResize = () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
    };
  }

  // MODIFIED: Update chart to only show selected channels
  private updateChart2(): void {
    if (
      !this.chart ||
      !this.displayScanData ||
      !this.angleSelect ||
      !this.stepSelect
    ) {
      console.warn('📊 Cannot update chart: missing dependencies');
      return;
    }

    // ds suggested, not tried yet.
    // if (!this.chart.isDisposed()) {
    //   this.chart.clear();
    // }

    if (this.chart.isDisposed()) {
      console.warn('📊 Chart is disposed, reinitializing...');
      this.chart = null;
      this.initializeChartNow();
      if (!this.chart) return;
    }

    const angleIndex = parseInt(this.angleSelect.value) || 0;
    const stepIndex = parseInt(this.stepSelect.value) || 0;

    console.log(`📊 Updating chart for angle ${angleIndex}, step ${stepIndex}`);
    console.log(`📊 Selected channels: ${this.selectedChannels.size}/64`);

    // Debug: Check what data keys are available
    const availableKeys = Array.from(this.displayScanData.dataPackets.keys());
    const keysForThisAngleStep = availableKeys.filter(key =>
      key.startsWith(`${angleIndex}_${stepIndex}_`)
    );

    console.log(
      `📊 Available data keys for angle ${angleIndex}, step ${stepIndex}:`,
      keysForThisAngleStep.length
    );

    const series: any[] = [];
    let maxSamples = 0;
    let channelsWithData = 0;

    // Create series for each SELECTED channel only
    for (let channel = 0; channel < 64; channel++) {
      // NEW: Skip channels that are not selected
      if (!this.selectedChannels.has(channel)) {
        continue;
      }

      const dataKey = `${angleIndex}_${stepIndex}_${channel}`;
      const packet = this.displayScanData.dataPackets.get(dataKey);

      const hasData = packet && packet.samples && packet.samples.length > 0;
      const data = hasData ? packet.samples : [];

      if (hasData) {
        maxSamples = Math.max(maxSamples, data.length);
        channelsWithData++;

        series.push({
          name: `Channel ${channel}`,
          type: 'line',
          data: data,
          symbol: 'none',
          lineStyle: {
            width: 1.5,
            opacity: 0.8,
          },
          itemStyle: {
            color: this.getChannelColor(channel),
          },
          legendHoverLink: true,
        });
      }
    }

    const xAxisData = Array.from({ length: maxSamples }, (_, i) => i);

    console.log(
      `📊 Chart update: ${channelsWithData}/${this.selectedChannels.size} selected channels have data, max samples: ${maxSamples}`
    );

    try {
      this.chart.setOption(
        {
          title: {
            text: `Ultrasonic Data - Angle ${angleIndex}, Step ${stepIndex} (${channelsWithData}/${this.selectedChannels.size} selected channels)`,
          },
          xAxis: {
            data: xAxisData,
          },
          series: series,
        },
        {
          replaceMerge: 'series',
        }
      );

      console.log('📊 Chart updated successfully');

      // Show warning if no data available for selected channels
      if (channelsWithData === 0 && this.selectedChannels.size > 0) {
        console.warn(
          `📊 No data available for selected channels in Angle ${angleIndex}, Step ${stepIndex}`
        );
      }
    } catch (error) {
      console.error('📊 Failed to update chart:', error);
    }
  }

  // 12. Update updateChart to include baseline data when selected
  private updateChart(): void {
    if (
      !this.chart ||
      !this.displayScanData ||
      !this.angleSelect ||
      !this.stepSelect
    ) {
      console.warn('📊 Cannot update chart: missing dependencies');
      return;
    }

    const angleIndex = parseInt(this.angleSelect.value) || 0;
    const stepIndex = parseInt(this.stepSelect.value) || 0;

    console.log(`📊 Updating chart for angle ${angleIndex}, step ${stepIndex}`);
    console.log(`📊 Selected channels: ${this.selectedChannels.size}/64`);

    const series: any[] = [];
    let maxSamples = 0;
    let channelsWithData = 0;

    // Process regular channels (0-63)
    for (let channel = 0; channel < 64; channel++) {
      if (!this.selectedChannels.has(channel)) {
        continue;
      }

      const dataKey = `${angleIndex}_${stepIndex}_${channel}`;
      const packet = this.displayScanData.dataPackets.get(dataKey);

      const hasData = packet && packet.samples && packet.samples.length > 0;
      const data = hasData ? packet.samples : [];

      if (hasData) {
        maxSamples = Math.max(maxSamples, data.length);
        channelsWithData++;

        series.push({
          name: `Channel ${channel}`,
          type: 'line',
          data: data,
          symbol: 'none',
          lineStyle: {
            width: 1.5,
            opacity: 0.8,
          },
          itemStyle: {
            color: this.getChannelColor(channel),
          },
          legendHoverLink: true,
        });
      }
    }

    const xAxisData = Array.from({ length: maxSamples }, (_, i) => i);
    const totalSelected = this.selectedChannels.size;

    console.log(
      `📊 Chart update: ${channelsWithData}/${totalSelected} selected channels have data, max samples: ${maxSamples}`
    );

    try {
      this.chart.setOption(
        {
          title: {
            text: `Ultrasonic Data - Angle ${angleIndex}, Step ${stepIndex} (${channelsWithData}/${totalSelected} selected)`,
          },
          xAxis: {
            data: xAxisData,
          },
          series: series,
        },
        {
          replaceMerge: 'series',
        }
      );

      console.log('📊 Chart updated successfully');

      if (channelsWithData === 0 && totalSelected > 0) {
        console.warn(
          `📊 No data available for selected channels in Angle ${angleIndex}, Step ${stepIndex}`
        );
      }
    } catch (error) {
      console.error('📊 Failed to update chart:', error);
    }
  }

  private cleanupChart(): void {
    if (this.chart) {
      
      try {
        // Call custom cleanup if it exists
        if ((this.chart as any)._cleanupResize) {
          (this.chart as any)._cleanupResize();
        }

        this.chart.dispose();
        this.chart = null;
        console.log('📊 Chart disposed successfully');
      } catch (error) {
        console.warn('📊 Error disposing chart:', error);
      }
    }
  }

  private getChannelColor(channel: number): string {
    const hue = ((channel * 360) / 64) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  private updateUI(): void {
    const hasSelection = this.selectedPort !== null;
    const isConnected = this.connectionState === 'connected';
    const isConnecting = this.connectionState === 'connecting';

    if (this.connectButton) {
      this.connectButton.disabled =
        !hasSelection || isConnected || isConnecting;
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

  private updateScanDisplay(
    status?: 'good' | 'bad' | 'waiting',
    message?: string
  ): void {
    if (this.scanCounter) {
      this.scanCounter.textContent = `Scans Received: ${this.scanCount}`;
    }

    const scanToDisplay = this.displayScanData || this.dataParser.getDisplayScan();

    if (scanToDisplay) {
      const scan = scanToDisplay;
      const metadata = scan.metadata;

      if (this.scanIdEl) {
        this.scanIdEl.textContent = scan.scanId.toString();
      }
      if (this.scanNameEl) {
        this.scanNameEl.textContent = metadata.scanConfig.name || '-';
      }
      if (this.numAnglesEl) {
        this.numAnglesEl.textContent =
          metadata.scanConfig.numAngles?.toString() || '-';
      }
      if (this.dataPacketCountEl) {
        this.dataPacketCountEl.textContent = scan.dataPackets.size.toString();
      }

      // FIXED: Use the correct calculation from metadata
      const totalExpectedSteps =
        metadata.scanConfig.totalSteps ||
        metadata.scanConfig.angles.reduce(
          (sum: number, angle: any) => sum + (angle.numSteps || 0),
          0
        );
      const expected = totalExpectedSteps * 64; // 64 channels per step

      if (this.expectedPacketsEl) {
        this.expectedPacketsEl.textContent = expected.toString();
      }

      const progress =
        expected > 0 ? (scan.dataPackets.size / expected) * 100 : 0;
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


  private debugElementStatus(): void {
    console.log('🔍 Element Debug Status:');
    console.log(
      '- chartContainer:',
      !!this.chartContainer,
      this.chartContainer?.id
    );
    console.log(
      '- chartControlsContainer:',
      !!this.chartControlsContainer,
      this.chartControlsContainer?.id
    );
    console.log(
      '- scanConfigDisplay:',
      !!this.scanConfigDisplay,
      this.scanConfigDisplay?.id
    );
    console.log(
      '- channelSelectionContainer:',
      !!this.channelSelectionContainer,
      this.channelSelectionContainer?.id
    ); // NEW
    console.log('- angleSelect:', !!this.angleSelect, this.angleSelect?.id);
    console.log('- stepSelect:', !!this.stepSelect, this.stepSelect?.id);
    console.log(
      '- updateChartButton:',
      !!this.updateChartButton,
      this.updateChartButton?.id
    );

    if (this.chartContainer) {
      const styles = window.getComputedStyle(this.chartContainer);
      console.log('📊 Chart container computed styles:');
      console.log('- display:', styles.display);
      console.log('- width:', styles.width);
      console.log('- height:', styles.height);
      console.log('- min-height:', styles.minHeight);
    }
  }

  private verifyCSSLoaded(): void {
    if (this.chartContainer) {
      // Test 1: Check if basic CSS is applied
      const testEl = document.createElement('div');
      testEl.id = 'chartContainer';
      testEl.style.visibility = 'hidden';
      testEl.style.position = 'absolute';
      testEl.style.top = '-9999px';
      document.body.appendChild(testEl);

      const styles1 = window.getComputedStyle(testEl);
      console.log('🎨 CSS Test 1 (hidden):');
      console.log('- display:', styles1.display);
      console.log('- height:', styles1.height);
      console.log('- width:', styles1.width);

      // Test 2: Check if chart-visible class works
      testEl.classList.add('chart-visible');
      const styles2 = window.getComputedStyle(testEl);
      console.log('🎨 CSS Test 2 (chart-visible):');
      console.log('- display:', styles2.display);
      console.log('- height:', styles2.height);
      console.log('- width:', styles2.width);

      document.body.removeChild(testEl);

      // Test 3: Check actual chart container styles after forcing
      console.log('🎨 CSS Test 3 (actual container):');
      const actualStyles = window.getComputedStyle(this.chartContainer);
      console.log('- display:', actualStyles.display);
      console.log('- height:', actualStyles.height);
      console.log('- width:', actualStyles.width);
      console.log('- min-height:', actualStyles.minHeight);
    }
  }
}

// Initialize the interface
document.addEventListener('DOMContentLoaded', () => {
  if ('serial' in navigator) {
    new UltrasonicScannerInterface();
  } else {
  }
});
