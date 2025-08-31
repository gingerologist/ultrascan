import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Select,
  Text,
  VStack,
  HStack,
  Grid,
  GridItem,
  NumberInput,
  // NumberInputField,
  Slider,
  // SliderTrack,
  // SliderFilledTrack,
  // SliderThumb,
  // RangeSlider,
  // RangeSliderTrack,
  // RangeSliderFilledTrack,
  // RangeSliderThumb,
  Alert,
  // AlertIcon,
  AlertDescription,
  Code,
  SegmentGroup,
} from '@chakra-ui/react';

import { FormControl, FormLabel } from '@chakra-ui/form-control';

/** */

// Type definitions matching your schema
interface JsonAngle {
  degree: number;
  masks: number[];
}

type JsonPatternSegment = [number, number]; // [duration, level]
type CharPatternLevel = 'F' | 'M' | 'P' | 'G';

export interface JsonConfig {
  version: string;
  name: string;
  angles: JsonAngle[];
  patterns: JsonPatternSegment[];
  repeat: number;
  tail: number;
  txStartDel: number;
  startUs: number;
  endUs: number;
}

interface ControlPanelProps {
  onConfigChange?: (config: JsonConfig) => void;
}

const seg32: string[] = new Array(32).fill(0).map((x, i) => i.toString());

const UltrasonicControlPanel: React.FC<ControlPanelProps> = ({
  onConfigChange,
}) => {
  const [config, setConfig] = useState<JsonConfig>({
    version: '1.0',
    name: '',
    angles: [],
    patterns: [],
    repeat: 1,
    tail: 0,
    txStartDel: -1,
    startUs: 20,
    endUs: 22,
  });

  const [jsonOutput, setJsonOutput] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Pattern management
  const [newPatternDuration, setNewPatternDuration] = useState(1);
  const [newPatternLevel, setNewPatternLevel] = useState<CharPatternLevel>('F');

  // Angle management (dummy for now)
  const [newAngleDegree, setNewAngleDegree] = useState('0');

  // const toast = useToast(); TODO: new toaster?

  const levelMap: Record<CharPatternLevel, number> = {
    F: 0, // Float
    M: 1, // Minus (negative)
    P: 2, // Positive
    G: 3, // Ground
  };

  const levelDisplayMap: Record<number, string> = {
    0: 'F (Float)',
    1: 'M (Minus)',
    2: 'P (Positive)',
    3: 'G (Ground)',
  };

  // Generate default mask (all zeros for simplicity)
  const generateDefaultMask = () => {
    return new Array(32).fill(0);
  };

  // Validate configuration
  const validateConfig = useCallback((configToValidate: JsonConfig) => {
    const newErrors: string[] = [];

    // Check angles uniqueness
    const degrees = configToValidate.angles.map(a => a.degree);
    const uniqueDegrees = [...new Set(degrees)];
    if (degrees.length !== uniqueDegrees.length) {
      newErrors.push('All angle degrees must be unique');
    }

    // Check endUs > startUs
    if (configToValidate.endUs <= configToValidate.startUs) {
      newErrors.push('End time must be greater than start time');
    }

    // Check required arrays
    if (configToValidate.angles.length === 0) {
      newErrors.push('At least one angle is required');
    }

    if (configToValidate.patterns.length === 0) {
      newErrors.push('At least one pattern is required');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  }, []);

  const updateConfig = useCallback(
    (updates: Partial<JsonConfig>) => {
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);
      validateConfig(newConfig);

      if (onConfigChange) {
        onConfigChange(newConfig);
      }
    },
    [config, onConfigChange, validateConfig]
  );

  // Pattern management functions
  const addPattern = () => {
    const duration = newPatternDuration;
    const level = levelMap[newPatternLevel];

    if (duration < 1 || duration > 31) {
      // toast({
      //   title: 'Invalid Duration',
      //   description: 'Duration must be between 1 and 31 clocks',
      //   status: 'error',
      //   duration: 3000,
      // });
      return;
    }

    if (config.patterns.length >= 16) {
      // toast({
      //   title: 'Maximum Patterns Reached',
      //   description: 'Maximum 16 patterns allowed',
      //   status: 'error',
      //   duration: 3000,
      // });
      return;
    }

    const newPattern: JsonPatternSegment = [duration, level];
    updateConfig({
      patterns: [...config.patterns, newPattern],
    });
    setNewPatternDuration(1);
    setNewPatternLevel('F');
  };

  const removePattern = (index: number) => {
    const newPatterns = config.patterns.filter((_, i) => i !== index);
    updateConfig({ patterns: newPatterns });
  };

  // Dummy angle functions
  const addAngle = () => {
    const degree = parseInt(newAngleDegree);
    if (degree < -45 || degree > 45) {
      // toast({
      //   title: 'Invalid Degree',
      //   description: 'Degree must be between -45 and 45',
      //   status: 'error',
      //   duration: 3000,
      // });
      return;
    }

    const newAngle = {
      degree: degree,
      masks: generateDefaultMask(),
    };

    updateConfig({
      angles: [...config.angles, newAngle],
    });
    setNewAngleDegree('0');
  };

  const removeAngle = (index: number) => {
    const newAngles = config.angles.filter((_, i) => i !== index);
    updateConfig({ angles: newAngles });
  };

  const generateConfig = () => {
    if (!validateConfig(config)) {
      // toast({
      //   title: 'Validation Failed',
      //   description: 'Please fix the errors before generating JSON',
      //   status: 'error',
      //   duration: 3000,
      // });
      return;
    }

    const jsonString = JSON.stringify(config, null, 2);
    setJsonOutput(jsonString);
    setShowJson(true);
  };

  const resetConfig = () => {
    const defaultConfig: JsonConfig = {
      version: '1.0',
      name: '',
      angles: [],
      patterns: [],
      repeat: 1,
      tail: 0,
      txStartDel: -1,
      startUs: 20,
      endUs: 22,
    };
    setConfig(defaultConfig);
    setJsonOutput('');
    setShowJson(false);
    setErrors([]);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonOutput);
      // toast({
      //   title: 'Copied!',
      //   description: 'Configuration copied to clipboard',
      //   status: 'success',
      //   duration: 2000,
      // });
    } catch (err) {
      // toast({
      //   title: 'Copy Failed',
      //   description: 'Could not copy to clipboard',
      //   status: 'error',
      //   duration: 3000,
      // });
    }
  };

  return (
    <Box
      bg="white"
      border="2px solid"
      borderColor="gray.200"
      borderRadius="lg"
      p={6}
      mb={8}
    >
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="md" color="gray.700">
          Scan Configuration
        </Heading>
        <HStack gap={3}>
          <Button colorScheme="gray" onClick={resetConfig}>
            Reset
          </Button>
          <Button
            colorScheme="blue"
            onClick={generateConfig}
            disabled={errors.length > 0}
          >
            Generate JSON
          </Button>
        </HStack>
      </Flex>

      {/* Error Display */}
      {/* {errors.length > 0 && (
        <Alert status="error" mb={4}> TODO:
          <AlertIcon />
          <Box>
            <AlertDescription>
              <Text fontWeight="bold">Validation Errors:</Text>
              {errors.map((error, index) => (
                <Text key={index} fontSize="sm">
                  • {error}
                </Text>
              ))}
            </AlertDescription>
          </Box>
        </Alert>
      )} */}

      <VStack gap={6} align="stretch">
        {/* Angles Section (Dummy) */}
        <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4}>
          <Flex justify="space-between" align="center" mb={4}>
            <Heading size="sm" color="gray.600">
              Angles ({config.angles.length}/91)
            </Heading>
            <Button size="sm" colorScheme="blue" variant="outline">
              Generate Range
            </Button>
          </Flex>

          <HStack mb={4} gap={4}>
            <FormControl maxW="100px">
              <FormLabel fontSize="sm">Degree:</FormLabel>
              {/* <NumberInput TODO:
                value={newAngleDegree}
                onChange={setNewAngleDegree}
                min={-45}
                max={45}
              >
                <NumberInputField />
              </NumberInput> */}
            </FormControl>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={addAngle}
              alignSelf="end"
            >
              Add Angle
            </Button>
          </HStack>

          {config.angles.length === 0 ? (
            <Text color="gray.500" fontStyle="italic" textAlign="center" py={4}>
              No angles defined
            </Text>
          ) : (
            <Grid
              templateColumns="repeat(auto-fill, minmax(100px, 1fr))"
              gap={2}
            >
              {config.angles.map((angle, index) => (
                <GridItem key={index}>
                  <HStack
                    p={2}
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="md"
                    fontSize="sm"
                  >
                    <Text>{angle.degree}°</Text>
                    <Button
                      size="xs"
                      colorScheme="red"
                      onClick={() => removeAngle(index)}
                    >
                      ×
                    </Button>
                  </HStack>
                </GridItem>
              ))}
            </Grid>
          )}
        </Box>

        {/* Patterns Section */}
        <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4}>
          <Heading size="sm" color="gray.600" mb={4}>
            Patterns ({config.patterns.length}/16)
          </Heading>

          <HStack mb={4} gap={4}>
            <FormControl maxW="100px">
              <FormLabel fontSize="sm">Duration:</FormLabel>
              {/* <NumberInput TODO:
                value={newPatternDuration}
                onChange={(_, num) => setNewPatternDuration(num || 1)}
                min={1}
                max={31}
              >
                <NumberInputField />
              </NumberInput> */}
            </FormControl>
            <FormControl maxW="150px">
              <FormLabel fontSize="sm">Level:</FormLabel>
              {/* <Select TODO:
                value={newPatternLevel}
                onChange={e =>
                  setNewPatternLevel(e.target.value as CharPatternLevel)
                }
              >
                <option value="F">F (Float)</option>
                <option value="M">M (Minus)</option>
                <option value="P">P (Positive)</option>
                <option value="G">G (Ground)</option>
              </Select> */}
            </FormControl>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={addPattern}
              alignSelf="end"
            >
              Add Pattern
            </Button>
          </HStack>

          {config.patterns.length === 0 ? (
            <Text color="gray.500" fontStyle="italic" textAlign="center" py={4}>
              No patterns defined
            </Text>
          ) : (
            <VStack gap={2} align="stretch">
              {config.patterns.map((pattern, index) => (
                <Flex
                  key={index}
                  justify="space-between"
                  align="center"
                  p={3}
                  border="1px solid"
                  borderColor="gray.100"
                  borderRadius="md"
                  fontSize="sm"
                >
                  <Text>
                    Duration: {pattern[0]} clocks, Level:{' '}
                    {levelDisplayMap[pattern[1]]}
                  </Text>
                  <Button
                    size="xs"
                    colorScheme="red"
                    onClick={() => removePattern(index)}
                  >
                    Remove
                  </Button>
                </Flex>
              ))}
            </VStack>
          )}
        </Box>

        {/* Repeat and Tail Section */}
        <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4}>
          <Heading size="sm" color="gray.600" mb={4}>
            Pattern Settings
          </Heading>
          <Grid templateColumns="1fr 1fr" gap={6}>
            <FormControl>
              <FormLabel>Repeat: {config.repeat}</FormLabel>
              {/* <Slider TODO:
                value={config.repeat}
                // onChange={value => updateConfig({ repeat: value })}
                onChange={() => {}}
                min={0}
                max={31}
                step={1}
                transition="none"
              >
                <SliderTrack>
                  <SliderFilledTrack />
                </SliderTrack>
                <SliderThumb />
              </Slider> */}
              <Slider.Root defaultValue={[40]}>
                <Slider.Control></Slider.Control>
                <Slider.Track></Slider.Track>
                <Slider.Range />
                <Slider.Thumb>
                  <Slider.DraggingIndicator />
                </Slider.Thumb>
              </Slider.Root>
              <HStack
                justify="space-between"
                fontSize="xs"
                color="gray.500"
                mt={1}
              >
                <Text>1</Text>
                <Text>31</Text>
              </HStack>
            </FormControl>

            <FormControl>
              <FormLabel>Tail: {config.tail}</FormLabel>
              {/* <Slider TODO:
                value={config.tail}
                onChange={value => updateConfig({ tail: value })}
                min={0}
                max={31}
                step={1}
              >
                <SliderTrack>
                  <SliderFilledTrack />
                </SliderTrack>
                <SliderThumb />
              </Slider> */}
              {/* <HStack
                justify="space-between"
                fontSize="xs"
                color="gray.500"
                mt={1}
              >
                <Text>0</Text>
                <Text>31</Text>
              </HStack> */}

              <SegmentGroup.Root size="xs" defaultValue="5">
                <SegmentGroup.Indicator />
                <SegmentGroup.Items items={seg32} />
              </SegmentGroup.Root>
            </FormControl>
          </Grid>
        </Box>

        {/* Time Range Section */}
        <Box border="1px solid" borderColor="gray.200" borderRadius="lg" p={4}>
          <Heading size="sm" color="gray.600" mb={4}>
            Time Range: {config.startUs}μs - {config.endUs}μs
          </Heading>
          <FormControl>
            {/* <RangeSlider TODO:
              value={[config.startUs, config.endUs]}
              onChange={([start, end]) => {
                // Ensure even numbers and proper constraints
                const evenStart = start % 2 === 0 ? start : start + 1;
                const evenEnd = end % 2 === 0 ? end : end + 1;
                const finalStart = Math.max(20, Math.min(198, evenStart));
                const finalEnd = Math.max(
                  finalStart + 2,
                  Math.min(200, evenEnd)
                );
                updateConfig({ startUs: finalStart, endUs: finalEnd });
              }}
              min={20}
              max={200}
              step={2}
            >
              <RangeSliderTrack>
                <RangeSliderFilledTrack />
              </RangeSliderTrack>
              <RangeSliderThumb index={0} />
              <RangeSliderThumb index={1} />
            </RangeSlider> */}
            <Slider.Root
              defaultValue={[40, 80]}
              step={2}
              minStepsBetweenThumbs={2}
              min={20}
              max={200}
            >
              <HStack justify={'space-between'}>
                <Slider.Label>Scan Window</Slider.Label>
                <Slider.ValueText />
              </HStack>
              <Slider.Control>
                <Slider.Track>
                  <Slider.Range />
                </Slider.Track>
                <Slider.Thumbs>
                  <Slider.DraggingIndicator />
                  <Slider.DraggingIndicator />
                </Slider.Thumbs>
                <Slider.Marks
                  marks={[
                    { value: 20, label: '20μs' },
                    { value: 200, label: '200μs' },
                  ]}
                />
              </Slider.Control>
            </Slider.Root>
          </FormControl>
        </Box>

        {/* JSON Output Section */}
        {showJson && (
          <Box
            border="1px solid"
            borderColor="gray.200"
            borderRadius="lg"
            p={4}
            bg="gray.50"
          >
            <Flex justify="space-between" align="center" mb={4}>
              <Heading size="sm" color="gray.600">
                Configuration JSON
              </Heading>
              <Button size="sm" colorScheme="blue" onClick={copyToClipboard}>
                Copy
              </Button>
            </Flex>
            <Code
              display="block"
              whiteSpace="pre"
              p={4}
              bg="white"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="md"
              fontSize="xs"
              overflowX="auto"
              maxH="300px"
              overflowY="auto"
            >
              {jsonOutput}
            </Code>
          </Box>
        )}

        {/* Status indicator */}
        <Box
          p={3}
          bg="gray.50"
          borderRadius="md"
          border="1px solid"
          borderColor="gray.200"
        >
          <Text fontSize="sm" color="gray.600">
            <Text as="span" fontWeight="bold">
              Status:
            </Text>{' '}
            {config.angles.length} angles, {config.patterns.length} patterns,
            Range: {config.startUs}μs - {config.endUs}μs
            {errors.length > 0 && (
              <Text as="span" color="red.500" ml={2}>
                ⚠ {errors.length} error(s)
              </Text>
            )}
          </Text>
        </Box>
      </VStack>
    </Box>
  );
};

export default UltrasonicControlPanel;
