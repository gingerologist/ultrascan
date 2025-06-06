import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// Import the parser and ECharts
import { UltrasonicDataParser, stm32h7_crc32 } from '../src/parser';

// // Example function to test
// function add(a: number, b: number): number {
//   return a + b
// }

// function multiply(a: number, b: number): number {
//   return a * b
// }

// describe('Math utilities', () => {
//   it('should add two numbers correctly', () => {
//     expect(add(2, 3)).toBe(5)
//     expect(add(-1, 1)).toBe(0)
//   })

//   it('should multiply two numbers correctly', () => {
//     expect(multiply(3, 4)).toBe(12)
//     expect(multiply(0, 5)).toBe(0)
//   })
// })

describe('CRC test', () => {
  it('crc32([0x00000000]) should be 0xc704dd7b', () => {
    expect(stm32h7_crc32(new Uint32Array([0x00000000]))).toBe(0xc704dd7b)
  })

  it('crc32([0xffffffff]) should be 0x00000000', () => {
    expect(stm32h7_crc32(new Uint32Array([0xffffffff]))).toBe(0x00000000)
  })

  it('crc32([0x12345678]) should be 0xdf8a8a2b', () => {
    expect(stm32h7_crc32(new Uint32Array([0x12345678]))).toBe(0xdf8a8a2b)
  })

  it('crc32([0x9ABCDEF0]) should be 0x25d59e18', () => {
    expect(stm32h7_crc32(new Uint32Array([0x9ABCDEF0]))).toBe(0x25d59e18)
  })

  it('crc32([0x12345678,0x9ABCDEF0]) should be 0x7d24a31b', () => {
    expect(stm32h7_crc32(new Uint32Array([0x12345678,0x9ABCDEF0]))).toBe(0x7d24a31b)
  })

  it('crc32([0x9ABCDEF0,0x12345678]) should be 0x44e8fa0f', () => {
    expect(stm32h7_crc32(new Uint32Array([0x9ABCDEF0,0x12345678]))).toBe(0x44e8fa0f)
  })
})

/*
0x0001: 01 04 10 40 00 01 04 10 40 00
0x0002: 02 08 20 80 00 02 08 20 80 00
0x0003: 03 0c 30 c0 00 03 0c 30 c0 00
0x0005: 05 14 50 40 01 05 14 50 40 01
0x0007: 07 1c 70 c0 01 07 1c 70 c0 01
0x000b: 0b 2c b0 c0 02 0b 2c b0 c0 02
0x000d: 0d 34 d0 40 03 0d 34 d0 40 03
0x0011: 11 44 10 41 04 11 44 10 41 04
0x0013: 13 4c 30 c1 04 13 4c 30 c1 04 */

describe('parser test', () => {
  it('should extract 8x -511', () => {
    const parser = new UltrasonicDataParser();
    const bytes = new Uint8Array([0x01, 0x04, 0x10, 0x40, 0x00, 0x01, 0x04, 0x10, 0x40, 0x00]);
    const samples = parser.extract8SamplesFrom10Bytes(bytes);
    expect(samples).toStrictEqual([-511,-511,-511,-511,-511,-511,-511,-511]);
  })

  it('should extract 8x -510', () => {
    const parser = new UltrasonicDataParser()
    const bytes = new Uint8Array([0x02, 0x08, 0x20, 0x80, 0x00, 0x02, 0x08, 0x20, 0x80, 0x00]);
    const samples = parser.extract8SamplesFrom10Bytes(bytes);
    expect(samples).toStrictEqual([-510,-510,-510,-510,-510,-510,-510,-510]);
  })
})