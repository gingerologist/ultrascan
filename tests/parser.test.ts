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
  it('should do something', () => {
    expect(2).toBe(2);
    console.log(`[0x00000000]: 0x${((stm32h7_crc32(new Uint32Array([0x00000000]))) >>> 0).toString(16).padStart(8, '0').toUpperCase()}`);
    console.log(`[0xffffffff]: 0x${((stm32h7_crc32(new Uint32Array([0xffffffff]))) >>> 0).toString(16).padStart(8, '0').toUpperCase()}`);
    console.log(`[0x12345678]: 0x${((stm32h7_crc32(new Uint32Array([0x12345678]))) >>> 0).toString(16).padStart(8, '0').toUpperCase()}`);
    console.log(`[0x78563412]: 0x${((stm32h7_crc32(new Uint32Array([0x78563412]))) >>> 0).toString(16).padStart(8, '0').toUpperCase()}`);
    console.log(`[0x9ABCDEF0]: 0x${((stm32h7_crc32(new Uint32Array([0x9ABCDEF0]))) >>> 0).toString(16).padStart(8, '0').toUpperCase()}`);
    console.log(`[0x12345678, 0x9ABCDEF0]: 0x${((stm32h7_crc32(new Uint32Array([0x12345678, 0x9ABCDEF0]))) >>> 0).toString(16).padStart(8, '0').toUpperCase()}`);
    console.log(`[0x9ABCDEF0, 0x12345678]: 0x${((stm32h7_crc32(new Uint32Array([0x9ABCDEF0, 0x12345678]))) >>> 0).toString(16).padStart(8, '0').toUpperCase()}`);
  })
})