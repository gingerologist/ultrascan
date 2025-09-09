import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import * as echarts from 'echarts';
import { CompleteScanData } from './parser';

interface ScanChartProps {
  scanData: CompleteScanData;
}

const ScanChart: React.FC<ScanChartProps> = ({ scanData }) => {
  // Early return if no scan data
  if (!scanData || !scanData.angles || scanData.angles.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No scan data available
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please complete a scan to view data
        </Typography>
      </Box>
    );
  }

  // Selection state
  const [selectedAngleIndex, setSelectedAngleIndex] = useState(0);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [selectedChannels, setSelectedChannels] = useState<Set<number>>(
    () => new Set(Array.from({ length: 64 }, (_, i) => i))
  );

  // Chart reference
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);

  // Available steps for the selected angle
  const availableSteps = scanData.angles[selectedAngleIndex]?.steps || [];
  const maxStepIndex = Math.max(...availableSteps.map(step => step.index), -1);

  // Reset step selection when angle changes
  useEffect(() => {
    if (selectedStepIndex > maxStepIndex) {
      setSelectedStepIndex(0);
    }
  }, [selectedAngleIndex, maxStepIndex]);

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    chartInstance.current = echarts.init(chartRef.current);

    const initialOption = {
      title: {
        text: `Ultrasonic Data - Angle ${selectedAngleIndex}, Step ${selectedStepIndex}`,
        left: 'center',
      },
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        formatter: function (params: any) {
          if (!params || params.length === 0) return '';

          let html = `<div style="margin-bottom: 4px; font-weight: bold;">Sample ${params[0].name}</div>`;

          params.forEach((param: any) => {
            const color = param.color || '#000';
            const name = param.seriesName || 'Channel';
            const value = param.value !== undefined ? param.value : 'N/A';

            html += `<div style="display: flex; align-items: center; margin: 1px 0;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color}; margin-right: 5px;"></span>
              <span style="margin-right: 5px;">${name}:</span>
              <span style="font-weight: bold;">${value}</span>
            </div>`;
          });

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
        data: [] as any,
      },
      yAxis: {
        type: 'value',
        name: 'ADC Value',
        nameLocation: 'middle',
        nameGap: 50,
        scale: true,
        min: -512,
        max: 512,
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          height: 20,
          bottom: 30,
        },
      ],
      series: [] as any,
    };

    chartInstance.current.setOption(initialOption);

    // Resize handler
    const handleResize = () => {
      if (chartInstance.current && !chartInstance.current.isDisposed()) {
        chartInstance.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  // Update chart when selection changes
  useEffect(() => {
    updateChart();
  }, [selectedAngleIndex, selectedStepIndex, selectedChannels, scanData]);

  const getChannelColor = (channel: number): string => {
    const hue = ((channel * 360) / 64) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  const updateChart = () => {
    if (!chartInstance.current) return;

    const currentAngle = scanData.angles[selectedAngleIndex];
    if (!currentAngle) return;

    const currentStep = currentAngle.steps.find(
      step => step.index === selectedStepIndex
    );

    if (!currentStep) {
      // No data for this step, show empty chart
      chartInstance.current.setOption({
        title: {
          text: `Ultrasonic Data - Angle ${selectedAngleIndex}, Step ${selectedStepIndex} (No Data)`,
        },
        xAxis: { data: [] },
        series: [],
      });
      return;
    }

    const series: any[] = [];
    let maxSamples = 0;
    let channelsWithData = 0;

    // Process selected channels
    selectedChannels.forEach(channelIndex => {
      const channelData = currentStep.channels.find(
        ch => ch.index === channelIndex
      );

      if (channelData && channelData.samples.length > 0) {
        maxSamples = Math.max(maxSamples, channelData.samples.length);
        channelsWithData++;

        series.push({
          name: `Channel ${channelIndex}`,
          type: 'line',
          data: channelData.samples,
          symbol: 'none',
          lineStyle: {
            width: 1.5,
            opacity: 0.8,
          },
          itemStyle: {
            color: getChannelColor(channelIndex),
          },
        });
      }
    });

    const xAxisData = Array.from({ length: maxSamples }, (_, i) => i);

    chartInstance.current.setOption({
      title: {
        text: `Ultrasonic Data - Angle ${selectedAngleIndex}, Step ${selectedStepIndex} (${channelsWithData}/${selectedChannels.size} selected)`,
      },
      xAxis: {
        data: xAxisData,
      },
      series: series,
    });
  };

  const handleChannelToggle = (channel: number, checked: boolean) => {
    const newSelected = new Set(selectedChannels);
    if (checked) {
      newSelected.add(channel);
    } else {
      newSelected.delete(channel);
    }
    setSelectedChannels(newSelected);
  };

  const handleCheckAll = (checked: boolean) => {
    if (checked) {
      setSelectedChannels(new Set(Array.from({ length: 64 }, (_, i) => i)));
    } else {
      setSelectedChannels(new Set());
    }
  };

  const isAllSelected = selectedChannels.size === 64;
  const isNoneSelected = selectedChannels.size === 0;
  const isSomeSelected =
    selectedChannels.size > 0 && selectedChannels.size < 64;

  return (
    <Box sx={{ p: 2 }}>
      {/* Controls Section */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ minWidth: 200 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Angle</InputLabel>
              <Select
                value={selectedAngleIndex}
                label="Angle"
                onChange={e => setSelectedAngleIndex(Number(e.target.value))}
              >
                {scanData.angles.map((angle, index) => (
                  <MenuItem key={index} value={index}>
                    {angle.label} ({angle.steps.length} steps)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ minWidth: 150 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Step</InputLabel>
              <Select
                value={selectedStepIndex}
                label="Step"
                onChange={e => setSelectedStepIndex(Number(e.target.value))}
              >
                {availableSteps.map(step => (
                  <MenuItem key={step.index} value={step.index}>
                    Step {step.index}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Button
            variant="contained"
            onClick={updateChart}
            size="small"
            sx={{ minWidth: 120 }}
          >
            Update Chart
          </Button>

          <Chip
            label={`Selected: ${selectedChannels.size}/64`}
            color={
              isNoneSelected ? 'error' : isSomeSelected ? 'warning' : 'success'
            }
            variant="outlined"
          />
        </Box>
      </Paper>

      {/* Channel Selection */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Channel Selection
        </Typography>

        <FormControlLabel
          control={
            <Checkbox
              checked={isAllSelected}
              indeterminate={isSomeSelected}
              onChange={e => handleCheckAll(e.target.checked)}
            />
          }
          label="Select All Channels"
          sx={{ mb: 1 }}
        />

        <Box
          sx={{
            maxHeight: 200,
            overflow: 'auto',
            border: '1px solid #ddd',
            borderRadius: 1,
            p: 1,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.5,
          }}
        >
          {Array.from({ length: 64 }, (_, i) => (
            <Box key={i} sx={{ minWidth: '90px' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={selectedChannels.has(i)}
                    onChange={e => handleChannelToggle(i, e.target.checked)}
                  />
                }
                label={`CH${i}`}
                sx={{
                  m: 0,
                  '& .MuiFormControlLabel-label': {
                    fontSize: '0.75rem',
                  },
                }}
              />
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Chart */}
      <Paper sx={{ p: 1 }}>
        <Box
          ref={chartRef}
          sx={{
            width: '100%',
            height: 400,
            minHeight: 400,
          }}
        />
      </Paper>
    </Box>
  );
};

export default ScanChart;
