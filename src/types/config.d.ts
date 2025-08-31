export interface ScanAngle {
  degree: number; // 整数，范围 -45 到 45
  masks: number[]; // 长度固定为32的数组，每个元素为0到4294967295的整数
}

export interface ScanPatternSegment {
  0: number; // 第一个元素：1到31的整数
  1: 0 | 1 | 2 | 3; // 第二个元素：只能是0、1、2、3中的一个
}

export interface ScanConfig {
  version: '1.0'; // 固定值为"1.0"
  name: string; // 字符串，最大长度31
  angles: ScanAngle[]; // 数组长度1到91，元素唯一
  pattern: ScanPatternSegment[]; // 数组长度1到16，每个元素是包含两个元素的数组
  repeat: number; // 整数，范围0到31
  tail: number; // 整数，范围0到31
  txStartDel: -1; // 固定值为-1
  startUs: number; // 整数，20到198之间的偶数
  endUs: number; // 整数，22到200之间的偶数
}
