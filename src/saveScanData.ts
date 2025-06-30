import * as fs from 'fs';
import * as path from 'path';

export interface ScanData {
  scanId: number;
  metadata: {
    packetType: number;
    scanId: number;
    scanConfig: {
      name: string;
      numAngles: number;
      angles: Array<{
        numSteps: number;
        label: string;
      }>;
      [key: string]: any;
    };
  };
  dataPackets: Map<string, {
    angleIndex: number;
    stepIndex: number;
    channelIndex: number;
    samples: number[];
  }>;
  isComplete: boolean;
  timestamp: number;
}

/**
 * Saves scan data to organized folder structure
 * Creates: /data/scan-YYYYMMDD-HHMM/angle_N/step_N.csv
 */
export function saveScanData(scanData: ScanData): void {
  try {
    // Create timestamp-based folder name
    const scanDate = new Date(scanData.timestamp);
    const year = scanDate.getFullYear();
    const month = String(scanDate.getMonth() + 1).padStart(2, '0');
    const day = String(scanDate.getDate()).padStart(2, '0');
    const hours = String(scanDate.getHours()).padStart(2, '0');
    const minutes = String(scanDate.getMinutes()).padStart(2, '0');
    
    const scanFolderName = `scan-${year}${month}${day}-${hours}${minutes}`;
    
    // Create root data folder (permissive if exists)
    const dataRootPath = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataRootPath)) {
      fs.mkdirSync(dataRootPath, { recursive: true });
    }
    
    // Create scan-specific folder (strict - must not exist)
    const scanFolderPath = path.join(dataRootPath, scanFolderName);
    if (fs.existsSync(scanFolderPath)) {
      throw new Error(`Scan folder already exists: ${scanFolderPath}`);
    }
    fs.mkdirSync(scanFolderPath);
    
    // Save metadata as config.json
    const configPath = path.join(scanFolderPath, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(scanData.metadata, null, 2), 'utf8');
    console.log(`📁 Saved config.json: ${configPath}`);
    
    // Organize data by angle and step
    const organizedData = organizeDataPackets(scanData.dataPackets);
    
    // Create angle folders and step CSV files
    const numAngles = scanData.metadata.scanConfig.numAngles;
    
    for (let angleIndex = 0; angleIndex < numAngles; angleIndex++) {
      const angleFolderName = `angle_${angleIndex}`;
      const angleFolderPath = path.join(scanFolderPath, angleFolderName);
      
      // Create angle folder (strict)
      if (fs.existsSync(angleFolderPath)) {
        throw new Error(`Angle folder already exists: ${angleFolderPath}`);
      }
      fs.mkdirSync(angleFolderPath);
      
      // Get number of steps for this angle
      const angleConfig = scanData.metadata.scanConfig.angles[angleIndex];
      const numSteps = angleConfig?.numSteps || 0;
      
      // Create CSV files for each step
      for (let stepIndex = 0; stepIndex < numSteps; stepIndex++) {
        const csvFileName = `step_${stepIndex}.csv`;
        const csvFilePath = path.join(angleFolderPath, csvFileName);
        
        // Get data for this angle/step combination
        const stepData = organizedData.get(`${angleIndex}_${stepIndex}`);
        
        // Generate CSV content
        const csvContent = generateStepCSV(stepData);
        
        // Write CSV file (strict - must not exist)
        if (fs.existsSync(csvFilePath)) {
          throw new Error(`Step CSV file already exists: ${csvFilePath}`);
        }
        fs.writeFileSync(csvFilePath, csvContent, 'utf8');
        
        const channelCount = stepData ? stepData.size : 0;
        const sampleCount = stepData && stepData.size > 0 ? 
          Array.from(stepData.values())[0].length : 0;
        
        console.log(`📁 Saved ${csvFileName}: ${channelCount} channels, ${sampleCount} samples each`);
      }
      
      console.log(`📁 Created angle folder: ${angleFolderName} (${numSteps} steps)`);
    }
    
    console.log(`✅ Scan data saved successfully to: ${scanFolderPath}`);
    
  } catch (error) {
    console.error(`❌ Error saving scan data:`, error);
    throw error; // Re-throw to interrupt operation as requested
  }
}

/**
 * Organizes data packets by angle and step
 * Returns Map<"angleIndex_stepIndex", Map<channelIndex, samples[]>>
 */
function organizeDataPackets(
  dataPackets: Map<string, any>
): Map<string, Map<number, number[]>> {
  
  const organized = new Map<string, Map<number, number[]>>();
  
  // Process each data packet
  for (const [key, packet] of dataPackets) {
    const angleStepKey = `${packet.angleIndex}_${packet.stepIndex}`;
    
    // Get or create the step data map
    if (!organized.has(angleStepKey)) {
      organized.set(angleStepKey, new Map<number, number[]>());
    }
    
    const stepData = organized.get(angleStepKey)!;
    stepData.set(packet.channelIndex, packet.samples);
  }
  
  return organized;
}

/**
 * Generates CSV content for a single step
 * Format: Header row with channel names, then sample rows with indices
 */
function generateStepCSV(stepData: Map<number, number[]> | undefined): string {
  if (!stepData || stepData.size === 0) {
    // Empty step - create header only with placeholder
    return 'sample_index,channel_0\n';
  }
  
  // Get all channel indices and sort them
  const channelIndices = Array.from(stepData.keys()).sort((a, b) => a - b);
  
  // Get maximum number of samples (should be consistent across channels)
  const maxSamples = Math.max(...Array.from(stepData.values()).map(samples => samples.length));
  
  // Build CSV content
  const lines: string[] = [];
  
  // Header row: sample_index,channel_0,channel_1,...
  const headerRow = ['sample_index', ...channelIndices.map(ch => `channel_${ch}`)];
  lines.push(headerRow.join(','));
  
  // Data rows: sample index (1-based) + sample values for each channel
  for (let sampleIndex = 0; sampleIndex < maxSamples; sampleIndex++) {
    const row = [
      (sampleIndex + 1).toString(), // 1-based sample index as requested
      ...channelIndices.map(channelIndex => {
        const samples = stepData.get(channelIndex) || [];
        return sampleIndex < samples.length ? samples[sampleIndex].toString() : '';
      })
    ];
    lines.push(row.join(','));
  }
  
  return lines.join('\n');
}

// Example usage in handleScanComplete:
/*
private handleScanComplete(scan: ScanData): void {
  console.log('Scan complete:', scan);
  this.scanCount++;
  this.displayScanData = scan;

  // Save scan data to disk
  try {
    saveScanData(scan);
  } catch (error) {
    console.error('Failed to save scan data:', error);
    // Handle the error as needed - maybe show user notification
  }

  // Continue with existing logic...
  this.isRunning = false;
  this.waitingForScan = false;
  this.updateRunStopButton();
  // ... rest of existing code
}
*/