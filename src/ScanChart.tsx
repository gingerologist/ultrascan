import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Typography,
  Paper,
} from '@mui/material';
import * as echarts from 'echarts';
import { CompleteScanData } from './parser';

interface ScanChartProps {
  scanData: CompleteScanData;
}

const initXAxisData: string[] = Array.from({ length: 40 }, (_, i) =>
  (40 + i).toString()
);

const ScanChart: React.FC<ScanChartProps> = ({ scanData }) => {
  // Selection state
  const [selectedAngleIndex, setSelectedAngleIndex] = useState(0);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [selectedChannels, setSelectedChannels] = useState<Set<number>>(
    () => new Set(Array.from({ length: 64 }, (_, i) => i))
  );

  const [xAxisData, setxAxisData] = useState<string[]>(initXAxisData);

  // Chart reference
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);

  // Check if we have scan data
  const hasData = scanData && scanData.angles && scanData.angles.length > 0;

  // Available steps for the selected angle (only if we have data)
  const availableSteps = hasData
    ? scanData.angles[selectedAngleIndex]?.steps || []
    : [];
  const maxStepIndex = hasData
    ? Math.max(...availableSteps.map(step => step.index), -1)
    : -1;

  useEffect(() => {
    console.log(scanData);
    if (scanData == null) return;

    const start = scanData.config.captureStartUs;
    const end = scanData.config.captureEndUs;
    const length = (end - start) * 20 + 1;

    setxAxisData(
      Array.from({ length }, (_, i) => (i * 0.05 + start).toFixed(1).toString())
    );
  }, [scanData]);

  // Reset step selection when angle changes
  useEffect(() => {
    if (hasData && selectedStepIndex > maxStepIndex) {
      setSelectedStepIndex(0);
    }
  }, [selectedAngleIndex, maxStepIndex, hasData]);

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    chartInstance.current = echarts.init(chartRef.current);

    const initialOption = {
      animation: false,
      animationDuration: 0,
      useGPUTranslucency: true,
      progressive: 2000,
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
        name: 'Time (μs)',
        nameLocation: 'middle',
        nameGap: 30,
        data: xAxisData,
        axisLabel: {
          interval: 200,
        },
      },
      yAxis: {
        type: 'value',
        name: 'ADC Value',
        nameLocation: 'middle',
        nameGap: 50,
        scale: false,
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
      series: hasData
        ? []
        : [
            {
              name: 'No Data',
              type: 'line',
              data: [] as number[],
              symbol: 'none',
              lineStyle: {
                width: 0,
                opacity: 0,
              },
            },
          ],
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
  }, [hasData]);

  // Update chart when selection changes
  useEffect(() => {
    updateChart();
  }, [
    selectedChannels,
    selectedAngleIndex,
    selectedStepIndex,
    xAxisData,
    scanData,
  ]);

  const getChannelColor = (channel: number): string => {
    const hue = ((channel * 360) / 64) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  const updateChart = () => {
    if (!chartInstance.current) return;

    if (!hasData) {
      // Show empty chart with default axes
      chartInstance.current.setOption(
        {
          xAxis: { data: xAxisData },
          series: [],
        },
        {
          replaceMerge: ['series'],
        }
      );
      return;
    }

    const currentAngle = scanData.angles[selectedAngleIndex];
    if (!currentAngle) return;

    const currentStep = currentAngle.steps.find(
      step => step.index === selectedStepIndex
    );
    if (!currentStep) {
      chartInstance.current.setOption(
        {
          xAxis: { data: xAxisData },
          series: [],
        },
        {
          replaceMerge: ['series'],
        }
      );
      return;
    }

    const series: any[] = [];
    let maxSamples = 0;

    // Only process channels that are selected
    selectedChannels.forEach(channelIndex => {
      const channelData = currentStep.channels.find(
        ch => ch.index === channelIndex
      );

      if (
        channelData &&
        channelData.samples &&
        channelData.samples.length > 0
      ) {
        maxSamples = Math.max(maxSamples, channelData.samples.length);

        series.push({
          name: `Channel ${channelIndex}`,
          type: 'line',
          data: channelData.samples,
          symbol: 'none',
          lineStyle: { width: 1.5, opacity: 0.8 },
          itemStyle: { color: getChannelColor(channelIndex) },
        });
      }
    });

    // const xAxisData = Array.from({ length: maxSamples || 40 }, (_, i) =>
    //   (40 + i).toString()
    // );

    chartInstance.current.setOption(
      {
        xAxis: { data: xAxisData },
        series: series,
      },
      {
        replaceMerge: ['series'],
      }
    );
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
      {/* Controls Section - Only show if we have data */}

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
            <FormControl fullWidth size="small" disabled={!hasData}>
              <InputLabel>Angle</InputLabel>
              <Select
                value={selectedAngleIndex}
                label="Angle"
                onChange={e => setSelectedAngleIndex(Number(e.target.value))}
              >
                {hasData &&
                  scanData.angles.map((angle, index) => (
                    <MenuItem key={index} value={index}>
                      {angle.label} ({angle.steps.length} steps)
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ minWidth: 150 }}>
            <FormControl fullWidth size="small" disabled={!hasData}>
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
        </Box>
      </Paper>

      {/* Chart */}
      <Box
        ref={chartRef}
        sx={{
          width: '100%',
          height: 600,
          minHeight: 600,
        }}
      />

      {/* Select All Checkbox - Always visible */}
      <Box sx={{ textAlign: 'center', my: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={isAllSelected}
              indeterminate={isSomeSelected}
              onChange={e => handleCheckAll(e.target.checked)}
            />
          }
          label="Select All Channels"
        />
      </Box>

      {/* Channel Selection Grid - Always visible */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(16, 1fr)',
          gridTemplateRows: 'repeat(4, 1fr)',
          gap: 1,
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        {Array.from({ length: 64 }, (_, channelIndex) => {
          const isChecked = selectedChannels.has(channelIndex);
          return (
            <FormControlLabel
              key={channelIndex}
              control={
                <Checkbox
                  size="small"
                  checked={isChecked}
                  onChange={e => {
                    handleChannelToggle(channelIndex, e.target.checked);
                  }}
                />
              }
              label={channelIndex.toString()}
              sx={{
                m: 0,
                justifyContent: 'center',
                '& .MuiFormControlLabel-label': {
                  fontSize: '0.75rem',
                  minWidth: '16px',
                  textAlign: 'center',
                },
                '& .MuiCheckbox-root': {
                  padding: '2px',
                },
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
};

export default ScanChart;
