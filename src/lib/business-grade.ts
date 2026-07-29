// Shared 0–100 → letter grade / GPA conversion, used by both the Business
// Roadmap's Health Score panel and Campus's Business GPA card — one scale,
// so the two numbers never disagree.

export interface Grade {
  letter: string;
  gpa: number;
}

const SCALE: Array<{ min: number; letter: string; gpa: number }> = [
  { min: 93, letter: "A", gpa: 4.0 },
  { min: 90, letter: "A-", gpa: 3.7 },
  { min: 87, letter: "B+", gpa: 3.3 },
  { min: 83, letter: "B", gpa: 3.0 },
  { min: 80, letter: "B-", gpa: 2.7 },
  { min: 77, letter: "C+", gpa: 2.3 },
  { min: 73, letter: "C", gpa: 2.0 },
  { min: 70, letter: "C-", gpa: 1.7 },
  { min: 60, letter: "D", gpa: 1.0 },
  { min: 0, letter: "F", gpa: 0.0 },
];

export function gradeForScore(score: number): Grade {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const band = SCALE.find((b) => s >= b.min) ?? SCALE[SCALE.length - 1];
  return { letter: band.letter, gpa: band.gpa };
}
