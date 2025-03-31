// Mapping for finger positions
export type FingerPositionMap = {
  [key: string]: boolean[];
};

// Updated fingerboard configuration for Alto Sax based on the chart
// For each note, defines: [octaveKey, First finger, Second finger, Third finger, Fourth finger, Fifth finger, Sixth finger]
// True = key is pressed/covered, False = key is open/not pressed
export const fingerPositions: FingerPositionMap = {
  // First register (lower octave)
  Bb1: [false, true, true, true, true, true, true],
  B1: [false, true, false, false, false, false, false],
  C1: [false, false, true, false, false, false, false],
  "C#1": [false, false, false, true, false, false, false],
  D1: [false, true, true, true, true, true, true],
  E1: [false, true, true, true, true, true, false],
  F1: [false, true, true, true, true, false, false],
  "F#1": [false, true, true, true, false, true, false],
  G1: [false, true, true, true, false, false, false],
  A1: [false, true, true, false, false, false, false],

  // Second register (higher octave - with octave key)
  B2: [true, true, false, false, false, false, false],
  C2: [true, false, true, false, false, false, false],
  "C#2": [true, false, false, true, false, false, false],
  D2: [true, true, true, true, true, true, true],
  E2: [true, true, true, true, true, true, false],
  F2: [true, true, true, true, true, false, false],
  "F#2": [true, true, true, true, false, true, false],
  G2: [true, true, true, true, false, false, false],
  A2: [true, true, true, false, false, false, false],
} as const; // Make it readonly
