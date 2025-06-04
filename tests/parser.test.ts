import { describe, it, expect } from 'vitest';
// Import the parser and ECharts
import { stm32h7_crc32 } from '../src/parser';

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